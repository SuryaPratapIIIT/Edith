"""
Voice-First Pace Coach – FastAPI Backend
Provides:
  POST /api/sessions                         – Start a new ANPR enforcement section session
  POST /api/sessions/{id}/location           – Push telemetry from the React frontend (1 Hz)
  GET  /api/sessions/{id}/status             – Bolna get_pace_status tool endpoint
  GET  /api/gantries                         – Serve verified NH-48 ANPR gantry dataset
  GET  /api/gantries/sections                – All enforcement sections derived from gantries
  GET  /health                               – Liveness probe
"""
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import time
import json
import os
import asyncio
import httpx
from pathlib import Path
from typing import Optional

# ─── Load Environment Variables ──────────────────────────────────────────────
try:
    from dotenv import load_dotenv
    # Load backend/.env first, then root .env if present
    backend_env = Path(__file__).resolve().parent / ".env"
    root_env = Path(__file__).resolve().parent.parent / ".env"
    if backend_env.exists():
        load_dotenv(dotenv_path=backend_env)
    if root_env.exists():
        load_dotenv(dotenv_path=root_env, override=False)
except ImportError:
    pass

PORT = int(os.getenv("PORT", "8000"))
HOST = os.getenv("HOST", "0.0.0.0")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
BACKEND_PUBLIC_URL = os.getenv("BACKEND_PUBLIC_URL", "http://localhost:8000")
BOLNA_API_KEY = os.getenv("BOLNA_API_KEY", "")
BOLNA_AGENT_ID = os.getenv("BOLNA_AGENT_ID", "")
BOLNA_API_URL = os.getenv("BOLNA_API_URL", "https://api.bolna.ai")
SAFETY_MARGIN = float(os.getenv("SAFETY_MARGIN", "0.04"))
AMBER_GAP_KMH = float(os.getenv("AMBER_GAP_KMH", "5.0"))
GANTRIES_FILE_PATH = os.getenv("GANTRIES_FILE_PATH", "./data/gantries.json")

try:
    from pace_engine import calculate_pace, haversine_m
except ImportError:
    from backend.pace_engine import calculate_pace, haversine_m

app = FastAPI(
    title="Voice-First Pace Coach API",
    version="1.0.0",
    description="ANPR average-speed enforcement section tracker for Indian expressways"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Verified GMDA NH-48 Gantry Dataset with JSON File Fallback ──────────────
DEFAULT_GANTRIES = [
    {"id": "GMDA-NH48-01", "name": "Shankar Chowk (Cyber Hub)",  "coords": [77.091726, 28.500893], "anpr_count": 18, "road": "NH-48", "limit_kmh": 70},
    {"id": "GMDA-NH48-02", "name": "Atlas Chowk Skywalk",         "coords": [77.069430, 28.478109], "anpr_count": 12, "road": "NH-48", "limit_kmh": 70},
    {"id": "GMDA-NH48-04", "name": "Signature Tower",             "coords": [77.057311, 28.468526], "anpr_count": 24, "road": "NH-48", "limit_kmh": 70},
    {"id": "GMDA-NH48-05", "name": "Jharsa Chowk",                "coords": [77.044394, 28.454378], "anpr_count": 13, "road": "NH-48", "limit_kmh": 70},
    {"id": "GMDA-NH48-06", "name": "Rajiv Chowk Underpass",       "coords": [77.033597, 28.445508], "anpr_count":  9, "road": "NH-48", "limit_kmh": 70},
    {"id": "GMDA-NH48-07", "name": "Hero Honda Chowk",            "coords": [77.010077, 28.435464], "anpr_count": 10, "road": "NH-48", "limit_kmh": 70},
    {"id": "GMDA-NH48-08", "name": "IMT Chowk Manesar",           "coords": [76.938491, 28.361593], "anpr_count": 10, "road": "NH-48", "limit_kmh": 80},
]

def load_gantries():
    # Candidate paths to locate gantries.json
    candidates = [
        Path(GANTRIES_FILE_PATH),
        Path(__file__).resolve().parent / GANTRIES_FILE_PATH,
        Path(__file__).resolve().parent.parent / "data" / "gantries.json",
        Path("data/gantries.json"),
    ]
    for p in candidates:
        if p.exists() and p.is_file():
            try:
                with open(p, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, list) and len(data) > 0:
                        parsed = []
                        for g in data:
                            coords = g.get("coords") or [g.get("lon", 0), g.get("lat", 0)]
                            parsed.append({
                                "id": g.get("id"),
                                "name": g.get("name"),
                                "coords": coords,
                                "anpr_count": g.get("anpr_cameras", g.get("anpr_count", 10)),
                                "road": g.get("road", "NH-48"),
                                "limit_kmh": g.get("limit_kmh", 70)
                            })
                        return parsed
            except Exception as e:
                print(f"[WARN] Failed to load gantries from {p}: {e}")
    return DEFAULT_GANTRIES

GANTRIES = load_gantries()

# Verified shortest road distances via NH-48 Expressway geometry (accounting for flyovers, loops & curves)
NH48_ROAD_DISTANCES_M = [3450, 1850, 2680, 1200, 2850, 12250]

# Build enforcement sections from consecutive gantry pairs using true road distance
def build_sections():
    sections = []
    for i in range(len(GANTRIES) - 1):
        g1, g2 = GANTRIES[i], GANTRIES[i + 1]
        lon1, lat1 = g1["coords"]
        lon2, lat2 = g2["coords"]
        displacement_m = haversine_m(lat1, lon1, lat2, lon2)
        # Use verified road network distance, or apply curvature factor (+12%) over chord displacement
        road_dist_m = NH48_ROAD_DISTANCES_M[i] if i < len(NH48_ROAD_DISTANCES_M) else round(displacement_m * 1.12)
        sections.append({
            "section_id": f"{g1['id']}_to_{g2['id']}",
            "name": f"{g1['name']} → {g2['name']}",
            "start_gantry": g1,
            "end_gantry": g2,
            "distance_m": round(road_dist_m),
            "displacement_m": round(displacement_m),
            "curvature_extra_m": round(road_dist_m - displacement_m),
            "limit_kmh": g1["limit_kmh"]
        })
    return sections

SECTIONS = build_sections()

# ─── In-Memory Session Store ─────────────────────────────────────────────────
sessions: dict = {}


# ─── Pydantic Models ──────────────────────────────────────────────────────────
class StartSessionRequest(BaseModel):
    session_id: str
    section_name: str
    section_distance_m: float
    limit_kmh: float
    start_gantry_id: Optional[str] = None


class LocationTelemetry(BaseModel):
    lat: float
    lon: float
    covered_m: float
    speed_kmh: float


class LiveTelemetryPayload(BaseModel):
    session_id: Optional[str] = "live_ride"
    section_name: Optional[str] = "Gurugram Corridor"
    speed_kmh: float
    limit_kmh: float
    covered_m: float
    remaining_m: float
    next_camera: Optional[str] = None
    distance_to_camera_m: Optional[float] = None
    challan_risk: Optional[str] = "zero"
    alert: Optional[str] = "green"
    event_type: Optional[str] = None
    checkpoint_index: Optional[int] = None
    checkpoint_name: Optional[str] = None
    ceiling_kmh: Optional[float] = None
    current_avg_kmh: Optional[float] = None
    banked_time_s: Optional[float] = None
    test_case_id: Optional[str] = None
    situation_context: Optional[str] = None
    language: Optional[str] = "hinglish"
    route_origin: Optional[str] = "Gurugram"
    route_destination: Optional[str] = "Destination"
    total_journey_m: Optional[float] = None
    journey_elapsed_s: Optional[float] = None
    total_cameras: Optional[int] = None
    cleared_cameras: Optional[int] = None
    challan_count: Optional[int] = None


class BolnaSessionRequest(BaseModel):
    user_data: Optional[dict] = None


# ─── Routes ──────────────────────────────────────────────────────────────────

@app.post("/api/bolna/session")
async def create_bolna_web_session(req: Optional[BolnaSessionRequest] = None):
    """
    Mint an ephemeral WebRTC session with Bolna for browser-based voice conversation.
    Proxies securely using server-side BOLNA_API_KEY and BOLNA_AGENT_ID.
    """
    if not BOLNA_API_KEY or BOLNA_API_KEY == "your_bolna_api_key_here":
        raise HTTPException(status_code=500, detail="BOLNA_API_KEY not configured in backend/.env")
    if not BOLNA_AGENT_ID or BOLNA_AGENT_ID == "your_bolna_agent_id_here":
        raise HTTPException(status_code=500, detail="BOLNA_AGENT_ID not configured in backend/.env")

    user_data = (req.user_data if req else {}) or {}

    headers = {
        "Authorization": f"Bearer {BOLNA_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "agent_id": BOLNA_AGENT_ID,
        "user_data": user_data
    }

    url = f"{BOLNA_API_URL.rstrip('/')}/web-call/session"
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(url, headers=headers, json=payload, timeout=12.0)
            if resp.status_code != 200:
                raise HTTPException(status_code=resp.status_code, detail=f"Bolna API error: {resp.text}")
            session_data = resp.json()
            global active_bolna_run_id
            active_bolna_run_id = session_data.get("run_id")
            # Always ensure hangup flag is cleared on new call creation
            for s in sessions.values():
                s["hangup_requested"] = False
                s["hangup_timestamp"] = 0
            if "live_ride" in sessions:
                sessions["live_ride"]["hangup_requested"] = False
                sessions["live_ride"]["hangup_timestamp"] = 0
            return session_data
        except httpx.RequestError as exc:
            raise HTTPException(status_code=502, detail=f"Failed to reach Bolna API: {str(exc)}")

active_bolna_run_id: Optional[str] = None

async def push_bolna_event(event_name: str, properties: dict):
    """Pushes real-time road/checkpoint/camera events into the active Bolna call."""
    global active_bolna_run_id
    if not active_bolna_run_id or not BOLNA_API_KEY:
        return
    try:
        url = f"{BOLNA_API_URL.rstrip('/')}/v1/call/{active_bolna_run_id}/events"
        headers = {
            "Authorization": f"Bearer {BOLNA_API_KEY}",
            "Content-Type": "application/json"
        }
        async with httpx.AsyncClient() as client:
            await client.post(url, headers=headers, json={"event": event_name, "properties": properties}, timeout=2.5)
    except Exception as e:
        # Non-blocking telemetry event notification
        pass

@app.get("/health")
def health():
    return {"status": "ok", "sessions": len(sessions), "timestamp": round(time.time())}


@app.get("/api/gantries")
def get_gantries():
    """Return verified GMDA NH-48 ANPR gantry dataset."""
    return {"gantries": GANTRIES, "count": len(GANTRIES)}


@app.get("/api/gantries/sections")
def get_sections():
    """Return all enforcement sections computed from consecutive gantry pairs."""
    return {"sections": SECTIONS, "count": len(SECTIONS)}


@app.get("/api/road-distance")
def get_road_distance(lat1: float, lon1: float, lat2: float, lon2: float):
    """
    Computes shortest road distance vs. straight-line chord displacement.
    """
    displacement_m = round(haversine_m(lat1, lon1, lat2, lon2))
    road_distance_m = round(displacement_m * 1.12)
    return {
        "start": [lat1, lon1],
        "end": [lat2, lon2],
        "displacement_m": displacement_m,
        "road_distance_m": road_distance_m,
        "curvature_extra_m": road_distance_m - displacement_m,
        "detour_factor": 1.12,
        "note": "Road network distance accounts for road curves, flyovers, and loops rather than chord displacement."
    }


@app.post("/api/sessions")
def start_session(req: StartSessionRequest):
    """Begin an ANPR enforcement section session at the moment of Gantry 1 crossing."""
    sessions[req.session_id] = {
        "section_name": req.section_name,
        "section_distance_m": req.section_distance_m,
        "limit_kmh": req.limit_kmh,
        "start_gantry_id": req.start_gantry_id,
        "start_time": time.time(),
        "covered_m": 0.0,
        "current_speed_kmh": 0.0,
        "ceiling_kmh": req.limit_kmh,
        "alert": "green",
        "remaining_m": req.section_distance_m,
        "current_avg_kmh": 0.0,
        "banked_time_s": 0,
    }
    return {"status": "active", "session_id": req.session_id, "section": req.section_name}


@app.post("/api/sessions/{session_id}/location")
def update_telemetry(session_id: str, ping: LocationTelemetry):
    """Receive 1 Hz GPS+speed telemetry from the React frontend. Runs full pace math and updates session state."""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    sess = sessions[session_id]
    elapsed_s = time.time() - sess["start_time"]

    res = calculate_pace(
        section_m=sess["section_distance_m"],
        limit_kmh=sess["limit_kmh"],
        elapsed_s=elapsed_s,
        covered_m=ping.covered_m,
        current_speed_kmh=ping.speed_kmh,
        margin=SAFETY_MARGIN,
        amber_gap_kmh=AMBER_GAP_KMH
    )

    # Update session state
    sess["covered_m"] = ping.covered_m
    sess["current_speed_kmh"] = ping.speed_kmh
    sess["ceiling_kmh"] = res["ceiling_kmh"]
    sess["alert"] = res["alert"]
    sess["remaining_m"] = res.get("remaining_m", 0)
    sess["current_avg_kmh"] = res.get("current_avg_kmh", 0)
    sess["banked_time_s"] = res.get("banked_time_s", 0)

    return res


@app.post("/api/telemetry/live")
async def update_live_telemetry(payload: LiveTelemetryPayload):
    """
    Syncs real-time ride telemetry from frontend so Bolna agent tools always get instant live data.
    """
    session_id = payload.session_id or "live_ride"
    if session_id not in sessions:
        sessions[session_id] = {
            "section_name": payload.section_name or "Gurugram Corridor",
            "section_distance_m": payload.covered_m + payload.remaining_m,
            "limit_kmh": payload.limit_kmh,
            "start_time": time.time(),
        }

    sess = sessions[session_id]
    sess["section_name"] = payload.section_name or sess.get("section_name", "Gurugram Corridor")
    sess["current_speed_kmh"] = payload.speed_kmh
    sess["limit_kmh"] = payload.limit_kmh
    sess["covered_m"] = payload.covered_m
    sess["remaining_m"] = payload.remaining_m
    sess["ceiling_kmh"] = payload.ceiling_kmh if payload.ceiling_kmh is not None else payload.limit_kmh
    sess["alert"] = payload.alert or "green"
    sess["next_camera"] = payload.next_camera or "Upcoming GMDA Gantry"
    sess["distance_to_camera_m"] = payload.distance_to_camera_m if payload.distance_to_camera_m is not None else 0
    sess["challan_risk"] = payload.challan_risk or "zero"

    # Persistent Checkpoint Storage
    if "checkpoints" not in sess:
        sess["checkpoints"] = {}

    if payload.checkpoint_index is not None or payload.event_type == "checkpoint":
        cp_idx = payload.checkpoint_index or 1
        ceiling = payload.ceiling_kmh if payload.ceiling_kmh is not None else payload.limit_kmh
        is_exc = (payload.speed_kmh > ceiling) or (payload.speed_kmh > payload.limit_kmh) or (bool(payload.alert) and payload.alert.lower() in ["red", "danger", "violation", "critical"])
        excess = max(0.0, round(payload.speed_kmh - ceiling, 1))

        cp_record = {
            "index": cp_idx,
            "name": payload.checkpoint_name or f"Checkpoint {cp_idx}",
            "speed_kmh": payload.speed_kmh,
            "ceiling_kmh": ceiling,
            "limit_kmh": payload.limit_kmh,
            "is_exceeding": is_exc,
            "excess_kmh": excess,
            "current_avg_kmh": payload.current_avg_kmh or payload.speed_kmh,
            "banked_time_s": payload.banked_time_s or 0.0,
            "status_label": "EXCEEDING (Wrong Way / Overspeeding)" if is_exc else "NOT EXCEEDING (Right Way / Safe Pace)",
            "advice": (
                f"You crossed Checkpoint {cp_idx} at {payload.speed_kmh} km/h, EXCEEDING your safe ceiling of {ceiling} km/h by +{excess} km/h! "
                f"You are doing it the wrong way. Slow down immediately to recover your banked time budget."
                if is_exc else
                f"You crossed Checkpoint {cp_idx} at {payload.speed_kmh} km/h. You are NOT exceeding your safe ceiling of {ceiling} km/h. "
                f"You are doing it the right way! Safe pace maintained."
            ),
            "timestamp": time.time()
        }
        sess["checkpoints"][cp_idx] = cp_record
        sess["latest_checkpoint"] = cp_record
        sess["checkpoint_index"] = cp_idx
        sess["checkpoint_name"] = cp_record["name"]
        sess["event_type"] = "checkpoint"
    elif payload.event_type is not None:
        sess["event_type"] = payload.event_type

    if payload.current_avg_kmh is not None:
        sess["current_avg_kmh"] = payload.current_avg_kmh
    if payload.banked_time_s is not None:
        sess["banked_time_s"] = payload.banked_time_s
    if payload.test_case_id is not None:
        sess["test_case_id"] = payload.test_case_id
    if payload.situation_context is not None:
        sess["situation_context"] = payload.situation_context
    sess["language"] = payload.language or "hinglish"
    sess["route_origin"] = payload.route_origin or sess.get("route_origin", "Gurugram Origin")
    sess["route_destination"] = payload.route_destination or sess.get("route_destination", "Gurugram Destination")
    sess["total_journey_m"] = payload.total_journey_m if payload.total_journey_m is not None else sess.get("total_journey_m", payload.covered_m + payload.remaining_m)
    sess["journey_elapsed_s"] = payload.journey_elapsed_s if payload.journey_elapsed_s is not None else sess.get("journey_elapsed_s", 0)
    sess["total_cameras"] = payload.total_cameras if payload.total_cameras is not None else sess.get("total_cameras", 7)
    sess["cleared_cameras"] = payload.cleared_cameras if payload.cleared_cameras is not None else sess.get("cleared_cameras", 0)
    sess["challan_count"] = payload.challan_count if payload.challan_count is not None else sess.get("challan_count", 0)
    sess["updated_at"] = time.time()

    # Trigger proactive live event into active Bolna voice call
    if payload.event_type in ["camera_100m", "checkpoint", "spot_violation", "speed_violation"]:
        asyncio.create_task(push_bolna_event(payload.event_type, {
            "speed_kmh": payload.speed_kmh,
            "camera": payload.next_camera,
            "dist_m": payload.distance_to_camera_m,
            "ceiling_kmh": payload.ceiling_kmh,
            "alert": payload.alert
        }))

    return {"status": "synced", "session_id": session_id}


@app.get("/api/live/status")
@app.get("/api/session/status")
def get_live_bolna_status(response: Response):
    """
    Direct endpoint for Bolna agent tools without requiring session_id.
    Returns real-time vehicle speed, camera proximity, legal ceiling speed, ETA, and challan risk.
    Guaranteed zero-cache freshness for real-time AI tool querying.
    """
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0, proxy-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"

    if "live_ride" in sessions:
        latest_sess = sessions["live_ride"]
    elif sessions:
        latest_sess = list(sessions.values())[-1]
    else:
        latest_sess = None

    if not latest_sess:
        return {
            "current_section": "Gurugram Open Road Alignment",
            "posted_limit": "70 km/h",
            "current_speed": "0 km/h",
            "speed_kmh": 0,
            "limit_kmh": 70,
            "ceiling_kmh": 70.0,
            "speed_status": "legal",
            "exceeding_status": "compliant",
            "exceeding_details": "You are not exceeding any speed threshold.",
            "current_avg_speed": "0 km/h",
            "max_allowed_pace": "70 km/h",
            "status": "green",
            "camera_nearby": "Upcoming GMDA ANPR gantry along route",
            "next_camera_name": "GMDA ANPR Gantry",
            "distance_to_camera_m": 800,
            "estimated_time_to_camera": "Reaching in 41 seconds at 70 km/h",
            "estimated_time_to_destination": "12 minutes",
            "covered_meters": 0,
            "remaining_meters": 800,
            "banked_time_seconds": 0,
            "active_event": "idle",
            "checkpoint_index": None,
            "checkpoint_name": None,
            "test_case_id": None,
            "total_cameras": 7,
            "cleared_cameras": 0,
            "remaining_cameras": 7,
            "camera_summary": "There are 7 total ANPR cameras configured along the Gurugram NH-48 corridor.",
            "challan_risk": "Zero Risk - Clean Record",
            "trip_summary": "Stationary at trip starting point. All sensors live.",
            "situation_analysis": "Vehicle stationary at starting point. All systems nominal.",
            "coaching_note": "Aap safe speed par hain. Full legal pace maintain rakhein.",
            "freshness_timestamp": round(time.time(), 3)
        }

    speed_val = round(latest_sess.get("current_speed_kmh", 0))
    limit_val = round(latest_sess.get("limit_kmh", 70))
    ceiling_val = round(latest_sess.get("ceiling_kmh", limit_val), 1)
    alert = latest_sess.get("alert", "green")
    cam_name = latest_sess.get("next_camera", "Upcoming GMDA Camera Gantry")
    dist_m = round(latest_sess.get("distance_to_camera_m", round(latest_sess.get("remaining_m", 500))))
    covered_m = round(latest_sess.get("covered_m", 0))
    remaining_m = round(latest_sess.get("remaining_m", 0))
    avg_speed_val = round(latest_sess.get("current_avg_kmh", speed_val), 1)
    banked_time_val = round(latest_sess.get("banked_time_s", 0), 1)
    event_type = latest_sess.get("event_type", "driver_query")
    checkpoint_idx = latest_sess.get("checkpoint_index")
    checkpoint_name = latest_sess.get("checkpoint_name")
    test_case_id = latest_sess.get("test_case_id")
    situation_ctx = latest_sess.get("situation_context")

    # Accurate Physics Calculations
    speed_ms = speed_val / 3.6
    effective_ms = speed_ms if speed_val > 5 else (limit_val / 3.6)
    time_to_cam_s = round(dist_m / effective_ms, 1)
    time_to_cam_human = f"{time_to_cam_s} seconds" if time_to_cam_s < 60 else f"{round(time_to_cam_s/60, 1)} minutes"

    # ETA to destination
    eta_dest_sec = round(remaining_m / effective_ms)
    eta_dest_human = f"{int(eta_dest_sec // 60)} min {int(eta_dest_sec % 60)} sec" if eta_dest_sec >= 60 else f"{int(eta_dest_sec)} seconds"

    excess_limit = max(0.0, round(speed_val - limit_val, 1))
    excess_ceiling = max(0.0, round(speed_val - ceiling_val, 1))
    is_speeding = excess_limit > 0.0
    is_ceiling_breached = excess_ceiling > 0.0

    target_speed_ms = (ceiling_val / 3.6) if ceiling_val < speed_val else (limit_val / 3.6)
    required_decel_ms2 = round(max(0.0, (speed_ms**2 - target_speed_ms**2) / (2 * max(1.0, dist_m))), 2) if speed_val > ceiling_val else 0.0

    # Explicit Exceeding Status & Detail
    if is_speeding:
        speed_status_str = "speeding"
        exceeding_status = "exceeding"
        exceeding_details = f"You are exceeding the posted speed limit by +{round(excess_limit)} km/h"
    elif is_ceiling_breached:
        speed_status_str = "over_ceiling"
        exceeding_status = "exceeding"
        exceeding_details = f"You are exceeding the dynamic safe pace ceiling by +{round(excess_ceiling)} km/h"
    else:
        speed_status_str = "safe"
        exceeding_status = "compliant"
        exceeding_details = "You are NOT exceeding any speed threshold"

    # Persistent Long Trip Context
    origin_name = latest_sess.get("route_origin", "Gurugram Origin")
    dest_name = latest_sess.get("route_destination", "Gurugram Destination")
    total_trip_km = round(latest_sess.get("total_journey_m", covered_m + remaining_m) / 1000, 1)
    covered_km = round(covered_m / 1000, 1)
    remaining_km = round(remaining_m / 1000, 1)
    progress_pct = min(100, round((covered_m / max(1.0, covered_m + remaining_m)) * 100))
    total_cams = latest_sess.get("total_cameras", 7)
    cleared_cams = latest_sess.get("cleared_cameras", 0)
    trip_challans = latest_sess.get("challan_count", 0)
    elapsed_s = latest_sess.get("journey_elapsed_s", 0)
    elapsed_min = round(elapsed_s / 60, 1)

    trip_summary = (
        f"Trip from {origin_name} to {dest_name} ({total_trip_km} km total). "
        f"Elapsed time: {elapsed_min} mins. Covered: {covered_km} km ({progress_pct}% done). "
        f"Remaining: {remaining_km} km (ETA: {eta_dest_human}). "
        f"Cameras cleared: {cleared_cams} of {total_cams}. "
        f"Challan status: {'Zero Challans' if trip_challans == 0 else f'{trip_challans} violation(s)'}."
    )

    # Dynamic situation analysis with persistent Checkpoint Context, 'Camera is heading' and 'exceeding or not'
    analysis_parts = []
    latest_cp = latest_sess.get("latest_checkpoint")

    # Persistent Checkpoint Status Injection
    if latest_cp:
        analysis_parts.append(
            f"Checkpoint Status ({latest_cp['name']}): {latest_cp['advice']} "
            f"(Crossed at {latest_cp['speed_kmh']} km/h vs safe ceiling {latest_cp['ceiling_kmh']} km/h). "
            f"{'Driver is doing it the wrong way / exceeding!' if latest_cp['is_exceeding'] else 'Driver is doing it the right way / compliant!'}"
        )

    if event_type == "camera_100m" or event_type == "camera_proximity":
        analysis_parts.append(
            f"Camera is heading! ANPR Camera {cam_name} is {dist_m}m ahead (ETA {time_to_cam_human}). "
            f"Posted limit is {limit_val} km/h. "
            f"{'You are EXCEEDING the limit by +' + str(round(excess_limit)) + ' km/h! Slow down!' if is_speeding else 'You are NOT exceeding the limit.'}"
        )
    elif event_type == "spot_violation":
        analysis_parts.append(f"Spot Radar Crossing: Instant speed {speed_val} km/h exceeded {limit_val} km/h limit by +{excess_limit} km/h at {cam_name}.")
    elif event_type == "speed_violation":
        analysis_parts.append(f"Corridor Average Violation: Section average speed {avg_speed_val} km/h exceeded legal limit {limit_val} km/h. Time deficit {banked_time_val}s.")
    elif event_type == "checkpoint":
        cp_num = checkpoint_idx or (latest_cp["index"] if latest_cp else 1)
        analysis_parts.append(
            f"Checkpoint {cp_num} ({progress_pct}% progress): Speed {speed_val} km/h, average {avg_speed_val} km/h. "
            f"Ceiling is {ceiling_val} km/h. "
            f"{'You are EXCEEDING the safe ceiling by +' + str(round(excess_ceiling)) + ' km/h!' if is_ceiling_breached else 'You are NOT exceeding the ceiling.'} "
            f"Banked time: {banked_time_val:+}s."
        )
    elif event_type == "route_planned":
        analysis_parts.append(f"Route Initialized: Path from {origin_name} to {dest_name} ({total_trip_km} km).")
    elif event_type == "journey_complete":
        analysis_parts.append(f"Destination Arrived: Reached {dest_name}! Total covered {covered_km} km with {cleared_cams} cameras cleared.")
    elif event_type == "test_case_eval":
        analysis_parts.append(f"Scenario {test_case_id} Step: Speed {speed_val} km/h, ceiling {ceiling_val} km/h, alert {alert.upper()}. {situation_ctx or ''}")
    
    if is_speeding:
        analysis_parts.append(f"Vehicle is {excess_limit} km/h over posted limit. Required deceleration: {required_decel_ms2} m/s².")
    elif is_ceiling_breached:
        analysis_parts.append(f"Vehicle speed {speed_val} km/h exceeds safe ceiling {ceiling_val} km/h by +{excess_ceiling} km/h.")
    else:
        analysis_parts.append(f"Vehicle cruising legally within bounds (limit {limit_val} km/h).")

    situation_analysis = " ".join(analysis_parts)

    if latest_cp and latest_cp["is_exceeding"]:
        advice = f"Warning at {latest_cp['name']}: You crossed at {latest_cp['speed_kmh']} km/h exceeding {latest_cp['ceiling_kmh']} km/h ceiling. You are doing it the wrong way. Slow down immediately! Current pace ceiling: {ceiling_val} km/h."
    elif is_speeding:
        advice = f"Camera is heading! Speed is {speed_val} km/h (+{excess_limit} km/h over limit). Camera {cam_name} is in {dist_m}m ({time_to_cam_human}). Decelerate immediately to {ceiling_val} km/h to prevent a challan!"
    elif is_ceiling_breached:
        advice = f"You are exceeding the pace ceiling of {ceiling_val} km/h by +{excess_ceiling} km/h. Slow down to recover your time budget."
    elif alert == "amber":
        advice = f"Speed {speed_val} km/h is approaching safe ceiling {ceiling_val} km/h. You are not exceeding yet. Hold steady."
    else:
        advice = f"Cruising safely at {speed_val} km/h within {limit_val} km/h limit. You are doing it the right way! Safe pace maintained."

    return {
        "current_section": latest_sess.get("section_name", "Gurugram Corridor"),
        "posted_limit": f"{limit_val} km/h",
        "current_speed": f"{speed_val} km/h",
        "speed_kmh": speed_val,
        "limit_kmh": limit_val,
        "ceiling_kmh": ceiling_val,
        "max_allowed_pace": f"{ceiling_val} km/h",
        "speed_status": speed_status_str,
        "exceeding_status": exceeding_status,
        "exceeding_details": exceeding_details,
        "current_avg_speed": f"{avg_speed_val} km/h",
        "status": alert,
        "camera_nearby": f"{cam_name} (in {dist_m} meters)",
        "next_camera_name": cam_name,
        "distance_to_camera_m": dist_m,
        "estimated_time_to_camera": time_to_cam_human,
        "estimated_time_to_destination": eta_dest_human,
        "covered_meters": covered_m,
        "remaining_meters": remaining_m,
        "banked_time_seconds": banked_time_val,
        "active_event": event_type,
        "checkpoint_index": checkpoint_idx or (latest_cp["index"] if latest_cp else None),
        "checkpoint_name": checkpoint_name or (latest_cp["name"] if latest_cp else None),
        "latest_checkpoint_index": latest_cp["index"] if latest_cp else None,
        "latest_checkpoint_name": latest_cp["name"] if latest_cp else None,
        "latest_checkpoint_speed": f"{latest_cp['speed_kmh']} km/h" if latest_cp else None,
        "latest_checkpoint_ceiling": f"{latest_cp['ceiling_kmh']} km/h" if latest_cp else None,
        "latest_checkpoint_exceeding": latest_cp["is_exceeding"] if latest_cp else False,
        "latest_checkpoint_status_label": latest_cp["status_label"] if latest_cp else "No checkpoint crossed yet",
        "latest_checkpoint_advice": latest_cp["advice"] if latest_cp else "Maintain safe legal speed within ceiling.",
        "checkpoints_crossed_count": len(latest_sess.get("checkpoints", {})),
        "total_cameras": total_cams,
        "cleared_cameras": cleared_cams,
        "remaining_cameras": max(0, total_cams - cleared_cams),
        "camera_summary": f"There are {total_cams} total cameras on this route. {cleared_cams} have been cleared, and {max(0, total_cams - cleared_cams)} remaining.",
        "test_case_id": test_case_id,
        "challan_risk": latest_sess.get("challan_risk", "Zero Risk - Clean Record"),
        "trip_summary": trip_summary,
        "route_origin": origin_name,
        "route_destination": dest_name,
        "progress_percent": progress_pct,
        "situation_analysis": situation_analysis,
        "coaching_note": advice,
        "freshness_timestamp": round(time.time(), 3)
    }


@app.get("/api/sessions/{session_id}/status")
def get_bolna_status(session_id: str):
    """
    Bolna agent get_pace_status tool endpoint.
    Returns a human-readable summary for the voice agent to read back in Hinglish.
    """
    if session_id not in sessions:
        return {"error": "No active ride session found for this rider. Please start a session from the app."}

    sess = sessions[session_id]
    alert = sess["alert"]
    remaining_km = round(sess["remaining_m"] / 1000, 2)

    # Hinglish coaching note for the Bolna agent
    if alert == "red":
        advice = "Speed bahut zyada hai! Abhi slow karo."
    elif alert == "amber":
        advice = f"Speed limit ke karib aa rahe hain. {round(sess['ceiling_kmh'])} ke neeche rakho."
    else:
        advice = f"Sab sahi hai. {round(sess['ceiling_kmh'])} tak chal sakte ho."

    return {
        "current_section": sess["section_name"],
        "posted_limit": f"{sess['limit_kmh']} km/h",
        "current_speed": f"{round(sess['current_speed_kmh'])} km/h",
        "current_avg_speed": f"{round(sess.get('current_avg_kmh', 0))} km/h",
        "max_allowed_pace": f"{round(sess['ceiling_kmh'])} km/h",
        "status": alert,
        "remaining_km": remaining_km,
        "banked_time_s": sess.get("banked_time_s", 0),
        "coaching_note": advice
    }


global_hangup_requested: bool = False
global_hangup_timestamp: float = 0.0


class HangupPayload(BaseModel):
    reason: Optional[str] = "driver requested hangup"
    user_command: Optional[str] = None


@app.post("/api/bolna/hangup")
def handle_bolna_hangup(payload: Optional[HangupPayload] = None, response: Response = None):
    """
    Called by Bolna Agent tool hangup_call when the driver explicitly says 'cut the call', 'hang up', or 'end session'.
    Sets hangup flag with current timestamp so frontend terminates the WebRTC call from Friday's end.
    """
    global global_hangup_requested, global_hangup_timestamp
    if response:
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    now = time.time()
    global_hangup_requested = True
    global_hangup_timestamp = now
    if "live_ride" not in sessions:
        sessions["live_ride"] = {}
    for s in sessions.values():
        s["hangup_requested"] = True
        s["hangup_timestamp"] = now
    return {
        "status": "hangup_initiated",
        "action": "cut_call",
        "message": "Cutting the call now, boss. Drive safely!"
    }


@app.get("/api/bolna/hangup-status")
def get_hangup_status(response: Response):
    """
    Polled by frontend WebRTC service to cleanly drop the call when Friday initiates hangup.
    """
    global global_hangup_requested, global_hangup_timestamp
    if response:
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    sess = sessions.get("live_ride")
    hangup_req = global_hangup_requested or (bool(sess.get("hangup_requested", False)) if sess else False)
    hangup_time = max(global_hangup_timestamp, sess.get("hangup_timestamp", 0) if sess else 0)
    return {"hangup_requested": hangup_req, "timestamp": hangup_time}


@app.post("/api/bolna/reset-hangup")
def reset_hangup_status(response: Response):
    global global_hangup_requested, global_hangup_timestamp
    if response:
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    global_hangup_requested = False
    global_hangup_timestamp = 0.0
    for s in sessions.values():
        s["hangup_requested"] = False
        s["hangup_timestamp"] = 0
    return {"status": "reset"}


class AnalyzeSituationRequest(BaseModel):
    speed_kmh: float
    limit_kmh: float
    covered_m: float
    remaining_m: float
    camera_nearby: Optional[str] = None
    distance_to_camera_m: Optional[float] = None
    alert: Optional[str] = "green"
    ceiling_kmh: Optional[float] = None
    current_avg_kmh: Optional[float] = None
    banked_time_s: Optional[float] = None
    event_type: Optional[str] = "live_telemetry"
    checkpoint_index: Optional[int] = None
    checkpoint_name: Optional[str] = None
    test_case_id: Optional[str] = None
    situation_notes: Optional[str] = None
    language: Optional[str] = "hinglish"


@app.post("/api/bolna/analyze-situation")
async def analyze_situation_dynamically(req: AnalyzeSituationRequest):
    """
    Real-time dynamic situational reasoning engine matching FRIDAY Bolna Persona.
    Dynamically reasons over live vehicle physics, speed deltas, arrival times,
    deceleration budgets, and banked time without hardcoded scripts.
    """
    speed = round(req.speed_kmh, 1)
    limit = round(req.limit_kmh, 1)
    ceiling = round(req.ceiling_kmh if req.ceiling_kmh is not None else limit, 1)
    dist_m = round(req.distance_to_camera_m if req.distance_to_camera_m is not None else req.remaining_m)
    cam = req.camera_nearby or "Upcoming ANPR Camera"
    lang = req.language or "hinglish"
    alert = (req.alert or "green").lower()
    avg_speed = round(req.current_avg_kmh if req.current_avg_kmh is not None else speed, 1)
    banked_s = round(req.banked_time_s or 0.0, 1)
    covered = round(req.covered_m)
    remaining = round(req.remaining_m)
    total_dist = max(1, covered + remaining)
    pct_progress = min(100, round((covered / total_dist) * 100))

    speed_ms = speed / 3.6
    time_to_cam_s = round(dist_m / max(0.1, speed_ms), 1) if speed_ms > 0 else 999.0
    excess_limit = max(0.0, round(speed - limit, 1))
    excess_ceiling = max(0.0, round(speed - ceiling, 1))
    target_ms = (ceiling / 3.6) if ceiling < speed else (limit / 3.6)
    decel_required = round(max(0.0, (speed_ms**2 - target_ms**2) / (2 * max(1.0, dist_m))), 2) if speed > ceiling else 0.0
    is_speeding = excess_limit > 0.0

    # Dynamic real-time situational synthesis
    if req.event_type == "camera_100m" or req.event_type == "camera_proximity":
        if is_speeding:
            if lang == "english":
                spoken = f"Camera is heading! {cam} is {dist_m}m ahead with {time_to_cam_s}s arrival. Posted limit is {limit} km/h. You are EXCEEDING the limit by +{round(excess_limit)} km/h! Decelerate at {decel_required} m/s2 down to {round(ceiling)} km/h to prevent a challan."
            else:
                spoken = f"Camera is heading boss! {dist_m} meter aage {cam} hai, arrival {time_to_cam_s} second mein. Live speed {round(speed)} km/h limit {limit} se {round(excess_limit)} km/h exceed kar rahi hai. Turant {round(ceiling)} km/h par layein!"
        elif speed > ceiling:
            if lang == "english":
                spoken = f"Camera is heading! {cam} in {dist_m}m. Posted limit is {limit} km/h. You are EXCEEDING your safe pace ceiling of {round(ceiling)} km/h by +{round(excess_ceiling)} km/h. Ease throttle!"
            else:
                spoken = f"Camera is heading boss! {cam} {dist_m} meter door hai. Aap safe ceiling {round(ceiling)} km/h se {round(excess_ceiling)} km/h exceed kar rahe hain. Speed steady kijiye!"
        else:
            if lang == "english":
                spoken = f"Camera is heading! Passing {cam} in {dist_m}m at {round(speed)} km/h. Posted limit is {limit} km/h. You are NOT exceeding the limit. Safe compliance."
            else:
                spoken = f"Camera is heading boss! {cam} {dist_m} meter aage hai, limit {limit} km/h. Aap exceed nahi kar rahe hain, speed {round(speed)} km/h bilkul safe hai."

    elif req.event_type == "spot_violation":
        if lang == "english":
            spoken = f"Spot radar violation: Crossing speed recorded {round(speed)} km/h at {cam}, exceeding {round(limit)} km/h by +{round(excess_limit)} km/h. Spot challan penalty triggered."
        else:
            spoken = f"Spot radar violation: {cam} par crossing speed {round(speed)} km/h record hui jo {round(limit)} km/h se +{round(excess_limit)} km/h upar hai. Spot challan penalty active!"

    elif req.event_type == "speed_violation":
        if lang == "english":
            spoken = f"Section average speed violation: Section mean speed is {round(avg_speed)} km/h exceeding legal ceiling {round(limit)} km/h. Time deficit is {abs(banked_s)} seconds."
        else:
            spoken = f"Corridor average violation: Section mean speed {round(avg_speed)} km/h limit {round(limit)} km/h se upar chali gayi hai. Time deficit {abs(banked_s)} second hai."

    elif req.event_type == "checkpoint":
        cp_label = req.checkpoint_name or f"Checkpoint {req.checkpoint_index or 1}"
        if speed > ceiling or is_speeding or alert in ("red", "warn", "critical"):
            overhead = round(excess_ceiling if speed > ceiling else excess_limit)
            if lang == "english":
                spoken = f"{cp_label} ({pct_progress}% split): You are EXCEEDING your safe pace ceiling of {round(ceiling)} km/h by +{overhead} km/h! Your speed is {round(speed)} km/h. You are doing it the wrong way! Decelerate immediately to recover your banked time budget."
            else:
                spoken = f"{cp_label} ({pct_progress}% split): Aap safe pace ceiling {round(ceiling)} km/h ko exceed kar rahe hain! Aapki speed {round(speed)} km/h hai jo ceiling se {overhead} km/h upar hai. Aap wrong speed par hain, turant slow kijiye!"
        else:
            if lang == "english":
                spoken = f"{cp_label} ({pct_progress}% split): You are NOT exceeding! Cruising safely at {round(speed)} km/h within your safe ceiling of {round(ceiling)} km/h. You are doing it the right way, keep this steady pace."
            else:
                spoken = f"{cp_label} ({pct_progress}% split): Aap exceed nahi kar rahe hain! Speed {round(speed)} km/h safe ceiling {round(ceiling)} km/h ke andar hai. Aap bilkul sahi pace maintain kar rahe hain."

    elif req.event_type == "test_case_eval":
        if lang == "english":
            spoken = f"Scenario {req.test_case_id} evaluation: Speed {round(speed)} km/h against safe ceiling {round(ceiling)} km/h. Alert {alert.upper()}. {covered}m covered, {remaining}m remaining."
        else:
            spoken = f"Scenario {req.test_case_id} evaluation: Speed {round(speed)} km/h, safe ceiling {round(ceiling)} km/h. Alert {alert.upper()}. {covered} meter covered, {remaining} meter remaining."

    elif req.event_type == "route_planned":
        if lang == "english":
            spoken = f"Route plan active: Trajectory mapped across {round(remaining / 1000, 1)} kilometers under active ANPR radar monitoring."
        else:
            spoken = f"Route active ho gaya boss: {round(remaining / 1000, 1)} kilometer path par ANPR radar network live hai."

    elif req.event_type == "journey_complete":
        if lang == "english":
            spoken = f"Destination reached safely: Total {round(covered / 1000, 1)} km completed with clean ANPR compliance. Zero challans!"
        else:
            spoken = f"Safalta purvak destination pahunch gaye boss: Total {round(covered / 1000, 1)} kilometer clean ANPR compliance ke sath clear hue!"

    elif req.event_type == "section_transition":
        if lang == "english":
            spoken = f"Section transition: Entering new corridor towards {cam}. Average pace was {round(avg_speed)} km/h, posted limit is {round(limit)} km/h."
        else:
            spoken = f"Section transition: Agle camera {cam} ki taraf badh rahe hain. Pichla average {round(avg_speed)} km/h tha, new limit {round(limit)} km/h hai."

    elif is_speeding:
        if lang == "english":
            spoken = f"Live telemetry alert: Speed {round(speed)} km/h exceeds limit {round(limit)} km/h by +{round(excess_limit)} km/h. Ease throttle to {round(ceiling)} km/h."
        else:
            spoken = f"Live alert boss: Aapki speed {round(speed)} km/h limit {round(limit)} km/h se +{round(excess_limit)} km/h upar hai. Throttle kam karke {round(ceiling)} km/h par layein."

    elif alert == "amber":
        if lang == "english":
            spoken = f"Pace advisory: Speed {round(speed)} km/h is approaching safe ceiling {round(ceiling)} km/h. Maintain current rhythm."
        else:
            spoken = f"Pace advisory: Speed {round(speed)} km/h safe ceiling {round(ceiling)} km/h ke karib hai. Speed steady rakhein."

    else:
        if lang == "english":
            spoken = f"Cruise status: Speed {round(speed)} km/h within {round(limit)} km/h limit. All telemetry nominal."
        else:
            spoken = f"Status green: Speed {round(speed)} km/h safe limit {round(limit)} km/h ke andar chal rahi hai."

    return {
        "status": "analyzed",
        "event_type": req.event_type,
        "speed_kmh": speed,
        "limit_kmh": limit,
        "ceiling_kmh": ceiling,
        "alert": req.alert,
        "spoken_text": spoken,
        "persona": "FRIDAY (Bolna Voice AI Agent)"
    }


voice_audio_cache: dict = {}


class SynthesizeAlertRequest(BaseModel):
    text: str
    language: Optional[str] = "hinglish"


@app.post("/api/voice/synthesize-alert")
async def synthesize_proactive_alert(req: SynthesizeAlertRequest):
    """
    Synthesizes proactive voice warnings matching Friday's exact persona (Tripti / Natural Indian Neural Voice).
    If ELEVENLABS_API_KEY is configured, uses ElevenLabs voice_id 1Z7Y8o9cvUeWq8oLKgMY (Tripti).
    Otherwise, uses high-fidelity neural edge-tts (en-IN-NeerjaExpressiveNeural / hi-IN-SwaraNeural).
    Returns real audio/mpeg stream directly to the browser audio player with zero-latency caching.
    """
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text required")

    cache_key = f"{req.language}:{text}"
    if cache_key in voice_audio_cache:
        return Response(content=voice_audio_cache[cache_key], media_type="audio/mpeg")

    eleven_key = os.getenv("ELEVENLABS_API_KEY", "")
    voice_id = os.getenv("ELEVENLABS_VOICE_ID", "1Z7Y8o9cvUeWq8oLKgMY")  # Friday's Tripti voice

    if eleven_key:
        try:
            url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
            headers = {
                "xi-api-key": eleven_key,
                "Content-Type": "application/json"
            }
            payload = {
                "text": text,
                "model_id": "eleven_turbo_v2_5",
                "voice_settings": {
                    "stability": 0.5,
                    "similarity_boost": 0.6
                }
            }
            async with httpx.AsyncClient() as client:
                resp = await client.post(url, headers=headers, json=payload, timeout=8.0)
                if resp.status_code == 200:
                    voice_audio_cache[cache_key] = resp.content
                    return Response(content=resp.content, media_type="audio/mpeg")
        except Exception as e:
            print(f"[WARN] ElevenLabs direct synthesis fallback to neural edge-tts: {e}")

    try:
        import edge_tts
        neural_voice = "hi-IN-SwaraNeural" if req.language == "hindi" else "en-IN-NeerjaExpressiveNeural"
        communicate = edge_tts.Communicate(text, neural_voice, rate="+5%")
        audio_chunks = []
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_chunks.append(chunk["data"])
        final_audio = b"".join(audio_chunks)
        voice_audio_cache[cache_key] = final_audio
        return Response(content=final_audio, media_type="audio/mpeg")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"TTS synthesis failed: {str(exc)}")


@app.get("/api/config")
def get_config():
    """Return public backend configuration loaded from .env."""
    return {
        "environment": ENVIRONMENT,
        "safety_margin": SAFETY_MARGIN,
        "amber_gap_kmh": AMBER_GAP_KMH,
        "public_url": BACKEND_PUBLIC_URL,
        "bolna_api_url": BOLNA_API_URL,
        "has_bolna_key": bool(BOLNA_API_KEY and BOLNA_API_KEY != "your_bolna_api_key_here"),
        "bolna_agent_id": BOLNA_AGENT_ID,
        "port": PORT,
        "host": HOST,
    }


@app.delete("/api/sessions/{session_id}")
def end_session(session_id: str):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    sess = sessions.pop(session_id)
    return {"status": "ended", "session_id": session_id, "section": sess["section_name"]}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=HOST, port=PORT, reload=True)
