# Voice-First Pace Coach: End-to-End System Blueprint & Integration Prompt

Prepared: 31 October 2026  
Architecture: React (Frontend) + Python FastAPI (Backend) + Bolna AI (Voice Agent) + 100% Free Spatial Stack

---

## Table of Contents
1. [Executive Summary of the Entire Conversation](#1-executive-summary-of-the-entire-conversation)
2. [Verified Gurugram NH-48 ANPR Gantry Dataset](#2-verified-gurugram-nh-48-anpr-gantry-dataset)
3. [The Core Pace Algorithm & Mathematical Contract](#3-the-core-pace-algorithm--mathematical-contract)
4. [Master Integration Prompt (Copy-Paste for Other Device / Agent)](#4-master-integration-prompt)
   - [A. Python FastAPI Backend](#a-python-fastapi-backend)
   - [B. React Frontend & Real-Time Map](#b-react-frontend--real-time-map)
   - [C. Bolna Agent Tool & Prompt Configuration](#c-bolna-agent-tool--prompt-configuration)
   - [D. How to Adjust Existing Logic](#d-how-to-adjust-existing-logic)

---

## 1. Executive Summary of the Entire Conversation

### The Problem
Indian expressways (such as NH-48, Bengaluru-Mysuru, and Dwarka Expressway) enforce speed through **Automatic Number Plate Recognition (ANPR)** gantries that calculate **average speed** between two points. Slowing down only directly beneath cameras does not work. Riders and drivers cannot mentally calculate how fast they can still go for the remainder of a section.

### The Product
A **voice-first pace coach** that calculates the maximum legal average speed a driver can maintain without incurring a challan. **It never advises exceeding the posted speed limit.**

### The Split Architecture
| Layer | Technology | Role |
| :--- | :--- | :--- |
| **On-Device Edge (Frontend)** | React + MapLibre GL + Turf.js + Web Speech API | Real-time 1 Hz GPS, snap-to-road, local speed ceiling math, and zero-latency audio alerts. Works offline. |
| **Backend State Store** | Python (FastAPI) | In-memory session store, telemetry ingestion, and Bolna status tool API. |
| **Conversational Voice** | Bolna AI | Telephony agent answering rider queries in Hindi/Hinglish (e.g., *"Mera speed limit kitna hai?"*). |

### The 100% Free Stack ($0, Zero Credit Cards)
1. **Map Display:** MapLibre GL JS with **OpenFreeMap** vector tiles (`https://tiles.openfreemap.org/styles/liberty`) — No API key.
2. **Routing / Polyline:** Public **OSRM** (`https://router.project-osrm.org/route/v1/driving/...`) or **OpenRouteService** free tier (2,000 req/day).
3. **Place Search:** **Photon API** by Komoot (`https://photon.komoot.io/api/?q=...`) — No API key.
4. **Road Snapping:** Client-side **Turf.js** (`nearestPointOnLine`) — 0 API calls, $0 cost.
5. **Gantry DB:** Local `gantries.json` from verified Gurugram Smart City ITMS data.
6. **On-Device TTS:** Browser `window.speechSynthesis` or Android `TextToSpeech`.

---

## 2. Verified Gurugram NH-48 ANPR Gantry Dataset

Extracted from the official Gurugram Metropolitan Development Authority (GMDA) ITMS deployment (filtered for active `ANPR Solution > 0`):

```json
[
  {
    "id": "GMDA-NH48-01",
    "name": "Shankar Chowk (Cyber Hub)",
    "coords": [77.0913, 28.4970],
    "anpr_count": 18,
    "road": "NH-48",
    "limit_kmh": 70
  },
  {
    "id": "GMDA-NH48-02",
    "name": "Atlas Chowk Skywalk",
    "coords": [77.0693, 28.4777],
    "anpr_count": 12,
    "road": "NH-48",
    "limit_kmh": 70
  },
  {
    "id": "GMDA-NH48-03",
    "name": "Signature Tower",
    "coords": [77.0575, 28.4686],
    "anpr_count": 24,
    "road": "NH-48",
    "limit_kmh": 70
  },
  {
    "id": "GMDA-NH48-04",
    "name": "Jharsa Chowk",
    "coords": [77.0419, 28.4519],
    "anpr_count": 13,
    "road": "NH-48",
    "limit_kmh": 70
  },
  {
    "id": "GMDA-NH48-05",
    "name": "Rajiv Chowk Underpass",
    "coords": [77.0320, 28.4486],
    "anpr_count": 9,
    "road": "NH-48",
    "limit_kmh": 70
  },
  {
    "id": "GMDA-NH48-06",
    "name": "Hero Honda Chowk",
    "coords": [77.0101, 28.4359],
    "anpr_count": 10,
    "road": "NH-48",
    "limit_kmh": 70
  },
  {
    "id": "GMDA-NH48-07",
    "name": "IMT Chowk Manesar",
    "coords": [76.9384, 28.3618],
    "anpr_count": 10,
    "road": "NH-48",
    "limit_kmh": 80
  }
]
```

---

## 3. The Core Pace Algorithm & Mathematical Contract

Given:
- Section Distance: $D$ (meters)
- Posted Speed Limit: $V$ (km/h)
- Safety Margin: $m = 0.04$ (4% clock and GPS buffer)
- Covered Distance: $d_{\text{cov}}$ (meters, snapped to road polyline)
- Elapsed Time: $t_{\text{el}}$ (seconds)
- Current Speed: $v_{\text{curr}}$ (km/h)

### Math Formulation
1. **Effective Limit:**
   $$V' = \frac{V \times (1 - m)}{3.6} \quad (\text{m/s})$$
2. **Minimum Legal Duration:**
   $$T_{\min} = \frac{D}{V'} \quad (\text{seconds})$$
3. **Remaining Distance & Time Budget:**
   $$d_{\text{rem}} = \max(D - d_{\text{cov}}, 0)$$
   $$t_{\text{need}} = T_{\min} - t_{\text{el}}$$
4. **Dynamic Ceiling Speed:**
   $$\text{ceiling} = \begin{cases} 
   V & \text{if } t_{\text{need}} \le 0 \\
   \min\left(V, \frac{d_{\text{rem}}}{t_{\text{need}}} \times 3.6\right) & \text{if } t_{\text{need}} > 0 
   \end{cases}$$
5. **Alert State:**
   - **RED:** $v_{\text{curr}} > \text{ceiling}$ OR $v_{\text{curr}} > V$
   - **AMBER:** $v_{\text{curr}} > (\text{ceiling} - 5\text{ km/h})$
   - **GREEN:** Otherwise

---

## 4. Master Integration Prompt
*(Copy the block below and paste it into the codebase or AI assistant where your existing logic resides)*

````markdown
# TASK: Integrate Existing Speed Logic into Voice-First Pace Coach (React + FastAPI + Bolna)

We have existing speed-tracking logic that we need to adapt to a production-ready, real-time Voice-First Pace Coach for Indian expressway ANPR gantries.
The stack is:
- Frontend: React (Vite) + MapLibre GL + OpenFreeMap + Turf.js
- Backend: Python (FastAPI)
- Voice Layer: Bolna AI voice agent
- Dataset: Gurugram NH-48 ANPR gantries (70 km/h limit)

Adapt our existing logic to follow the architecture, data schemas, and endpoints specified below.

---

### 1. PYTHON BACKEND (FastAPI)

Implement `backend/main.py` and `backend/pace_engine.py`:

#### `backend/pace_engine.py`
```python
def calculate_pace(section_m: float, limit_kmh: float, elapsed_s: float, covered_m: float, current_speed_kmh: float, margin: float = 0.04, amber_gap_kmh: float = 5.0):
    eff_ms = (limit_kmh * (1.0 - margin)) / 3.6
    t_min = section_m / eff_ms
    remaining_m = max(section_m - covered_m, 0.0)

    if remaining_m <= 0:
        return {"state": "completed", "ceiling_kmh": limit_kmh, "alert": "green"}

    need_s = t_min - elapsed_s
    if need_s <= 0:
        ceiling = float(limit_kmh)
    else:
        ceiling = min(float(limit_kmh), (remaining_m / need_s) * 3.6)

    if current_speed_kmh > ceiling or current_speed_kmh > limit_kmh:
        alert = "red"
    elif current_speed_kmh > (ceiling - amber_gap_kmh):
        alert = "amber"
    else:
        alert = "green"

    return {
        "state": "active",
        "ceiling_kmh": round(ceiling, 1),
        "alert": alert,
        "remaining_m": round(remaining_m),
        "need_s": round(max(need_s, 0))
    }
```

#### `backend/main.py`
```python
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import time
from pace_engine import calculate_pace

app = FastAPI(title="Pace Coach API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

sessions = {}

class StartSessionRequest(BaseModel):
    session_id: str
    section_name: str
    section_distance_m: float
    limit_kmh: float

class LocationTelemetry(BaseModel):
    lat: float
    lon: float
    covered_m: float
    speed_kmh: float

@app.post("/api/sessions")
def start_session(req: StartSessionRequest):
    sessions[req.session_id] = {
        "section_name": req.section_name,
        "section_distance_m": req.section_distance_m,
        "limit_kmh": req.limit_kmh,
        "start_time": time.time(),
        "covered_m": 0.0,
        "current_speed_kmh": 0.0,
        "ceiling_kmh": req.limit_kmh,
        "alert": "green",
        "remaining_m": req.section_distance_m
    }
    return {"status": "active", "session_id": req.session_id}

@app.post("/api/sessions/{session_id}/location")
def update_telemetry(session_id: str, ping: LocationTelemetry):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    sess = sessions[session_id]
    elapsed_s = time.time() - sess["start_time"]

    res = calculate_pace(
        section_m=sess["section_distance_m"],
        limit_kmh=sess["limit_kmh"],
        elapsed_s=elapsed_s,
        covered_m=ping.covered_m,
        current_speed_kmh=ping.speed_kmh
    )

    sess["covered_m"] = ping.covered_m
    sess["current_speed_kmh"] = ping.speed_kmh
    sess["ceiling_kmh"] = res["ceiling_kmh"]
    sess["alert"] = res["alert"]
    sess["remaining_m"] = res["remaining_m"]
    return res

# TOOL ENDPOINT FOR BOLNA AGENT
@app.get("/api/sessions/{session_id}/status")
def get_bolna_status(session_id: str):
    if session_id not in sessions:
        return {"error": "No active ride session found for this rider."}
    sess = sessions[session_id]
    return {
        "current_section": sess["section_name"],
        "posted_limit": f"{sess['limit_kmh']} km/h",
        "current_speed": f"{round(sess['current_speed_kmh'])} km/h",
        "max_allowed_pace": f"{round(sess['ceiling_kmh'])} km/h",
        "status": sess["alert"],
        "remaining_km": round(sess["remaining_m"] / 1000, 2)
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
```

---

### 2. REACT FRONTEND HOOK & MAP COMPONENTS

#### A. Custom Hook: `src/hooks/usePaceCoach.js`
This hook wraps GPS updates, snaps coordinates to the road polyline using Turf.js, runs the on-device math, triggers native Web Speech alerts, and syncs telemetry to FastAPI:

```javascript
import { useState, useRef } from 'react';
import * as turf from '@turf/turf';

const BACKEND_URL = "http://localhost:8000";
const SESSION_ID = "ride_gurgaon_101";

export function usePaceCoach(routeGeoJSON, startGantryCoords, sectionDistanceM = 10700, limitKmh = 70) {
  const [riderCoords, setRiderCoords] = useState(startGantryCoords);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [ceilingSpeed, setCeilingSpeed] = useState(limitKmh);
  const [alertLevel, setAlertLevel] = useState("green");
  const [remainingMeters, setRemainingMeters] = useState(sectionDistanceM);

  const startTimeRef = useRef(Date.now());
  const lastSpokenAlert = useRef("green");

  const speakWarning = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const msg = new SpeechSynthesisUtterance(text);
      msg.rate = 1.1;
      window.speechSynthesis.speak(msg);
    }
  };

  const processLocationUpdate = (lat, lon, rawSpeedKmh) => {
    if (!routeGeoJSON) return;

    // 1. Snap noisy GPS coordinate to expressway polyline
    const rawPoint = turf.point([lon, lat]);
    const routeFeature = turf.feature(routeGeoJSON);
    const snapped = turf.nearestPointOnLine(routeFeature, rawPoint);
    const snappedCoords = snapped.geometry.coordinates;
    setRiderCoords(snappedCoords);
    setCurrentSpeed(rawSpeedKmh);

    // 2. Measure covered distance along route from start gantry
    const startPoint = turf.point(startGantryCoords);
    const sliced = turf.lineSlice(startPoint, snapped, routeFeature);
    const coveredM = turf.length(sliced, { units: 'kilometers' }) * 1000;

    // 3. Local Pace Math
    const elapsedS = (Date.now() - startTimeRef.current) / 1000;
    const effSpeedMs = (limitKmh * 0.96) / 3.6;
    const tMin = sectionDistanceM / effSpeedMs;
    const remainingM = Math.max(sectionDistanceM - coveredM, 0);
    const needS = tMin - elapsedS;

    let ceiling = limitKmh;
    if (needS > 0 && remainingM > 0) {
      ceiling = Math.min(limitKmh, (remainingM / needS) * 3.6);
    }

    let alert = "green";
    if (rawSpeedKmh > ceiling) alert = "red";
    else if (rawSpeedKmh > ceiling - 5) alert = "amber";

    setCeilingSpeed(Math.round(ceiling));
    setAlertLevel(alert);
    setRemainingMeters(Math.round(remainingM));

    // 4. On-Device Voice Alerts
    if (alert === "red" && lastSpokenAlert.current !== "red") {
      speakWarning(`Slow down! Maximum allowed pace is ${Math.round(ceiling)} kilometers per hour.`);
    } else if (alert === "amber" && lastSpokenAlert.current === "green") {
      speakWarning(`Approaching limit. Hold pace below ${Math.round(ceiling)}.`);
    }
    lastSpokenAlert.current = alert;

    // 5. Telemetry Sync to FastAPI
    fetch(`${BACKEND_URL}/api/sessions/${SESSION_ID}/location`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lon, covered_m: coveredM, speed_kmh: rawSpeedKmh })
    }).catch(err => console.debug("Syncing telemetry:", err));
  };

  return {
    riderCoords,
    currentSpeed,
    ceilingSpeed,
    alertLevel,
    remainingMeters,
    processLocationUpdate,
    sessionId: SESSION_ID
  };
}
```

#### B. Component: `src/components/MapView.jsx`
Uses free OpenFreeMap vector tiles (no API keys, WebGL 60 FPS):
```jsx
import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export function MapView({ routeGeoJSON, riderCoords, gantries }) {
  const mapContainer = useRef(null);
  const map = useRef(null);

  useEffect(() => {
    if (map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [77.0600, 28.4700],
      zoom: 12.5,
      pitch: 45
    });

    map.current.on('load', () => {
      map.current.addSource('route', {
        type: 'geojson',
        data: { type: 'Feature', geometry: routeGeoJSON || { type: 'LineString', coordinates: [] } }
      });
      map.current.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        paint: { 'line-color': '#2563eb', 'line-width': 6 }
      });

      map.current.addSource('rider-dot', {
        type: 'geojson',
        data: { type: 'Feature', geometry: { type: 'Point', coordinates: riderCoords } }
      });
      map.current.addLayer({
        id: 'rider-point',
        type: 'circle',
        source: 'rider-dot',
        paint: {
          'circle-radius': 9,
          'circle-color': '#0284c7',
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ffffff'
        }
      });

      gantries.forEach(g => {
        new maplibregl.Marker({ color: '#dc2626' })
          .setLngLat(g.coords)
          .setPopup(new maplibregl.Popup().setHTML(`<b>📷 ANPR Gantry</b><br>${g.name}<br>Limit: ${g.limit_kmh} km/h`))
          .addTo(map.current);
      });
    });
  }, []);

  useEffect(() => {
    if (!map.current || !routeGeoJSON) return;
    const source = map.current.getSource('route');
    if (source) source.setData({ type: 'Feature', geometry: routeGeoJSON });
  }, [routeGeoJSON]);

  useEffect(() => {
    if (!map.current || !riderCoords) return;
    const source = map.current.getSource('rider-dot');
    if (source) {
      source.setData({ type: 'Feature', geometry: { type: 'Point', coordinates: riderCoords } });
    }
    map.current.easeTo({ center: riderCoords, duration: 1000, easing: (t) => t });
  }, [riderCoords]);

  return <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />;
}
```

---

### 3. BOLNA VOICE AGENT INTEGRATION

#### A. Tool Definition for Bolna (`api_tools`):
```json
{
  "name": "get_pace_status",
  "description": "Fetch live speed limit, max ceiling pace, and distance to the next ANPR camera for the active rider.",
  "method": "GET",
  "url": "https://YOUR-PUBLIC-URL/api/sessions/ride_gurgaon_101/status",
  "parameters": {
    "type": "object",
    "properties": {},
    "required": []
  }
}
```

#### B. Bolna Agent System Prompt:
```text
You are Pace, a calm and concise riding assistant on Indian expressways.
Speak primarily in simple, natural Hinglish.
Keep all spoken sentences short (under 12 words) because the rider is wearing a helmet/earphones on the road.

Rules:
1. NEVER tell the rider to exceed the posted speed limit under any circumstances.
2. When the rider asks about speed (e.g., "Kitni speed pe chaloon?", "Am I safe?"), immediately call the `get_pace_status` tool.
3. Read back their current speed, the max ceiling speed, and remaining distance to the next camera.
4. If status is "red", firmly advise them to slow down immediately.
5. If the tool is unreachable, tell them to follow roadside signs safely.
```

---

### 4. HOW TO ADAPT YOUR EXISTING LOGIC

1. **If your existing logic already computes distance or speed:**
   - Plug your distance computation into `covered_m` in `processLocationUpdate(...)`.
   - Ensure you replace direct line-of-sight distance with **snapped road distance** (`turf.lineSlice`) to avoid false speed swings.
2. **If your logic is in Python:**
   - Place your functions directly inside `backend/pace_engine.py` and ensure it exposes the `calculate_pace()` function interface returning `ceiling_kmh` and `alert`.
3. **Connect Bolna:**
   - Run `ngrok http 8000` to expose your local FastAPI backend to Bolna.
   - Point Bolna's `get_pace_status` tool URL to your ngrok tunnel.
````

---

## 5. Summary Checklist of Next Actions

| Step | Action | Tool / Command |
| :---: | :--- | :--- |
| **1** | Start FastAPI backend | `uvicorn main:app --reload --port 8000` |
| **2** | Expose backend for Bolna | `ngrok http 8000` |
| **3** | Update Bolna tool URL | Set `https://<ngrok-id>.ngrok-free.app/api/sessions/ride_gurgaon_101/status` |
| **4** | Start React frontend | `npm run dev` |
| **5** | Test with simulation | Click **▶ Simulate NH-48 Ride** in React, then ask Bolna: *"Mera speed limit kitna hai?"* |