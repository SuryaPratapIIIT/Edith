"""
Comprehensive Test Suite for all 7 Bolna FRIDAY Voice Features
Validates telemetry ingestion, calculation, and response formatting in backend/main.py.
"""
import sys
import os
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent / "backend"
sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from main import app, sessions

client = TestClient(app)

def test_features():
    print("=" * 60)
    print("RUNNING COMPREHENSIVE 7-FEATURE BOLNA INTEGRATION TESTS")
    print("=" * 60)

    # 1. Start a fresh session
    start_resp = client.post("/api/sessions", json={
        "session_id": "live_ride",
        "section_name": "Ambience Mall → Shankar Chowk",
        "section_distance_m": 3450.0,
        "limit_kmh": 70.0
    })
    assert start_resp.status_code == 200, f"Failed to start session: {start_resp.text}"
    print("✓ Session created")

    # 2. Test Feature 1 & 3: Speed, Limit, and Safe Pace Ceiling
    # Vehicle cruising safely at 64 km/h with 70 km/h limit
    sync_resp = client.post("/api/telemetry/live", json={
        "session_id": "live_ride",
        "section_name": "Ambience Mall → Shankar Chowk",
        "speed_kmh": 64.0,
        "limit_kmh": 70.0,
        "ceiling_kmh": 68.0,
        "covered_m": 1200.0,
        "remaining_m": 8400.0,
        "next_camera": "Atlas Chowk Skywalk",
        "distance_to_camera_m": 450.0,
        "total_cameras": 6,
        "cleared_cameras": 0,
        "cameras_passed": 0,
        "cameras_remaining": 6,
        "route_origin": "Ambience Mall",
        "route_destination": "Rajiv Chowk",
        "total_journey_m": 9600.0,
        "journey_elapsed_s": 85.0
    })
    assert sync_resp.status_code == 200, f"Failed live sync: {sync_resp.text}"

    status_resp = client.get("/api/live/status")
    assert status_resp.status_code == 200
    data = status_resp.json()

    # Feature 1 Check
    print("\n--- FEATURE 1: Speed & Speed Limits ---")
    print("Current speed:", data["current_speed"])
    print("Posted limit:", data["posted_limit"])
    print("Speed statement (EN):", data["speed_statement"])
    print("Speed statement (HI):", data["speed_statement_hi"])
    assert data["speed_kmh"] == 64
    assert data["limit_kmh"] == 70
    assert "64 km/h" in data["speed_statement"]
    assert "70 km/h" in data["speed_statement"]

    # Feature 2 Check
    print("\n--- FEATURE 2: ANPR Cameras (0 passed, 6 ahead) ---")
    print("Cameras passed:", data["cameras_passed"])
    print("Total cameras:", data["total_cameras"])
    print("Passed statement (EN):", data["cameras_passed_statement"])
    print("Passed statement (HI):", data["cameras_passed_statement_hi"])
    print("Next camera statement:", data["next_camera_statement"])
    assert data["cameras_passed"] == 0
    assert data["total_cameras"] == 6
    assert "0 cameras" in data["cameras_passed_statement"]
    assert "Atlas Chowk Skywalk" in data["next_camera_statement"]
    assert "450 meters" in data["next_camera_statement"]

    # Feature 3 Check
    print("\n--- FEATURE 3: Dynamic Safe Pace Ceiling ---")
    print("Max allowed pace:", data["max_allowed_pace"])
    print("Pace ceiling statement (EN):", data["pace_ceiling_statement"])
    print("Pace ceiling statement (HI):", data["pace_ceiling_statement_hi"])
    assert "68" in data["max_allowed_pace"]
    assert "68" in data["pace_ceiling_statement"]

    # Feature 4 Check (Safe Cruise)
    print("\n--- FEATURE 4: Overspeeding & Challan Risk (Compliant) ---")
    print("Exceeding status:", data["exceeding_status"])
    print("Overspeeding statement:", data["overspeeding_statement"])
    print("Challan risk statement:", data["challan_risk_statement"])
    assert data["exceeding_status"] == "compliant"
    assert "Clean record" in data["challan_risk_statement"]

    # Feature 5 Check (Compliant Checkpoint 1 - Right Way)
    print("\n--- FEATURE 5: Checkpoints (Right Way) ---")
    client.post("/api/telemetry/live", json={
        "session_id": "live_ride",
        "speed_kmh": 62.0,
        "limit_kmh": 70.0,
        "ceiling_kmh": 68.0,
        "covered_m": 2400.0,
        "remaining_m": 7200.0,
        "checkpoint_index": 1,
        "checkpoint_name": "Checkpoint 1 (25%)",
        "event_type": "checkpoint"
    })
    status_resp = client.get("/api/live/status")
    data = status_resp.json()
    print("Latest checkpoint:", data["latest_checkpoint_name"])
    print("Latest checkpoint statement (EN):", data["latest_checkpoint_statement"])
    print("Latest checkpoint statement (HI):", data["latest_checkpoint_statement_hi"])
    assert "Checkpoint 1" in data["latest_checkpoint_statement"]
    assert "right way" in data["latest_checkpoint_statement"].lower()
    assert not data["latest_checkpoint_exceeding"]

    # Feature 5 Check (Exceeding Checkpoint 2 - Wrong Way)
    print("\n--- FEATURE 5: Checkpoints (Wrong Way) ---")
    client.post("/api/telemetry/live", json={
        "session_id": "live_ride",
        "speed_kmh": 82.0,
        "limit_kmh": 70.0,
        "ceiling_kmh": 65.0,
        "covered_m": 4800.0,
        "remaining_m": 4800.0,
        "checkpoint_index": 2,
        "checkpoint_name": "Checkpoint 2 (50%)",
        "event_type": "checkpoint"
    })
    status_resp = client.get("/api/live/status")
    data = status_resp.json()
    print("Latest checkpoint:", data["latest_checkpoint_name"])
    print("Latest checkpoint statement (EN):", data["latest_checkpoint_statement"])
    print("Latest checkpoint statement (HI):", data["latest_checkpoint_statement_hi"])
    assert "Checkpoint 2" in data["latest_checkpoint_statement"]
    assert "wrong way" in data["latest_checkpoint_statement"].lower()
    assert data["latest_checkpoint_exceeding"]

    # Feature 4 Check (Overspeeding Triggered)
    print("\n--- FEATURE 4: Overspeeding & Challan Risk (Speeding) ---")
    print("Exceeding status:", data["exceeding_status"])
    print("Overspeeding statement:", data["overspeeding_statement"])
    print("Challan risk statement:", data["challan_risk_statement"])
    assert data["exceeding_status"] == "exceeding"
    assert "exceeding safe ceiling" in data["overspeeding_statement"].lower()

    # Feature 2 Check (2 cameras passed out of 5 total)
    print("\n--- FEATURE 2: ANPR Cameras (2 passed out of 5) ---")
    client.post("/api/telemetry/live", json={
        "session_id": "live_ride",
        "speed_kmh": 65.0,
        "limit_kmh": 70.0,
        "ceiling_kmh": 65.0,
        "covered_m": 6000.0,
        "remaining_m": 3600.0,
        "total_cameras": 5,
        "cleared_cameras": 2,
        "cameras_passed": 2,
        "cameras_remaining": 3
    })
    status_resp = client.get("/api/live/status")
    data = status_resp.json()
    print("Passed statement (EN):", data["cameras_passed_statement"])
    print("Passed statement (HI):", data["cameras_passed_statement_hi"])
    assert "2 cameras so far out of 5 total" in data["cameras_passed_statement"]
    assert "3 cameras remaining ahead" in data["cameras_passed_statement"]
    assert "2 cameras cross kar liye hain 5 me se" in data["cameras_passed_statement_hi"]

    # Feature 6 Check (ETA & Progress)
    print("\n--- FEATURE 6: ETA & Trip Progress ---")
    print("Remaining km:", data["remaining_km"])
    print("Estimated time to destination:", data["estimated_time_to_destination"])
    print("Trip progress statement (EN):", data["trip_progress_statement"])
    print("Trip progress statement (HI):", data["trip_progress_statement_hi"])
    assert data["remaining_km"] == 3.6
    assert "remaining" in data["trip_progress_statement"].lower()

    # Feature 7 Check (Voice Call Controls / Hangup)
    print("\n--- FEATURE 7: Voice Call Controls (Hangup) ---")
    hangup_resp = client.post("/api/bolna/hangup", json={"user_command": "cut the call friday"})
    assert hangup_resp.status_code == 200
    hangup_data = hangup_resp.json()
    print("Hangup response:", hangup_data)
    assert hangup_data["action"] == "cut_call"

    # Check hangup status endpoint
    poll_resp = client.get("/api/bolna/hangup-status")
    assert poll_resp.status_code == 200
    poll_data = poll_resp.json()
    print("Hangup poll status:", poll_data)
    assert poll_data["hangup_requested"] is True
    assert poll_data["timestamp"] > 0

    # Reset hangup
    reset_resp = client.post("/api/bolna/reset-hangup")
    assert reset_resp.status_code == 200
    poll_resp2 = client.get("/api/bolna/hangup-status")
    assert poll_resp2.json()["hangup_requested"] is False
    print("✓ Hangup flow verified cleanly")

    print("\n" + "=" * 60)
    print("ALL 7 BOLNA FRIDAY FEATURES PASSED WITH 100% SUCCESS!")
    print("=" * 60)

if __name__ == "__main__":
    test_features()
