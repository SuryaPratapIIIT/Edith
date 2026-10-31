import urllib.request
import json
import time

BASE_URL = "http://localhost:8000"

def test_checkpoint_edge_cases():
    print("=== TESTING CHECKPOINT VOICE & CONTEXT EDGE CASES ===")

    # Edge Case 1: Checkpoint 1 crossed at FASTER speed (Exceeding Ceiling)
    cp1_payload = {
        "session_id": "live_ride",
        "speed_kmh": 115,
        "limit_kmh": 100,
        "ceiling_kmh": 88.5,
        "current_avg_kmh": 128.6,
        "banked_time_s": -48.0,
        "covered_m": 5000,
        "remaining_m": 15000,
        "alert": "red",
        "next_camera": "GMDA Gantry 1",
        "distance_to_camera_m": 500,
        "event_type": "checkpoint",
        "checkpoint_index": 1,
        "checkpoint_name": "Checkpoint 1 (25%)",
        "situation_context": "Aggressive acceleration after toll gate"
    }

    req = urllib.request.Request(f"{BASE_URL}/api/telemetry/live", data=json.dumps(cp1_payload).encode(), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        assert json.loads(resp.read().decode())["status"] == "synced"
    print("[OK] Checkpoint 1 (Faster speed: 115 km/h vs ceiling 88.5 km/h) pushed to backend.")

    # Verify Checkpoint 1 state in get_live_bolna_status
    req = urllib.request.Request(f"{BASE_URL}/api/live/status")
    with urllib.request.urlopen(req) as resp:
        status_data = json.loads(resp.read().decode())
        assert status_data["latest_checkpoint_index"] == 1, f"Expected cp 1, got {status_data['latest_checkpoint_index']}"
        assert status_data["latest_checkpoint_exceeding"] is True, "Expected latest_checkpoint_exceeding to be True"
        assert "EXCEEDING" in status_data["latest_checkpoint_status_label"], "Status label missing EXCEEDING"
        assert "wrong way" in status_data["latest_checkpoint_advice"].lower(), "Advice missing 'wrong way' warning"
        assert "slow down" in status_data["latest_checkpoint_advice"].lower(), "Advice missing 'slow down' directive"
        print("[OK] Verification 1: Voice Agent Context correctly flags Checkpoint 1 EXCEEDING (Wrong Way).")

    # Edge Case 2: Regular 300ms continuous telemetry arrives WITHOUT checkpoint index
    # (Testing that regular ticks do NOT wipe out checkpoint context!)
    tick_payload = {
        "session_id": "live_ride",
        "speed_kmh": 110,
        "limit_kmh": 100,
        "ceiling_kmh": 88.5,
        "covered_m": 5200,
        "remaining_m": 14800,
        "alert": "red",
        "distance_to_camera_m": 300
    }
    req = urllib.request.Request(f"{BASE_URL}/api/telemetry/live", data=json.dumps(tick_payload).encode(), headers={"Content-Type": "application/json"})
    urllib.request.urlopen(req)

    # Checkpoint 1 MUST STILL PERSIST in get_live_bolna_status!
    req = urllib.request.Request(f"{BASE_URL}/api/live/status")
    with urllib.request.urlopen(req) as resp:
        status_data = json.loads(resp.read().decode())
        assert status_data["latest_checkpoint_index"] == 1, "CRITICAL BUG: Regular tick wiped out checkpoint_index!"
        assert status_data["latest_checkpoint_exceeding"] is True, "CRITICAL BUG: Regular tick wiped out exceeding status!"
        print("[OK] Verification 2: Checkpoint Context perfectly retained across continuous non-checkpoint ticks.")

    # Edge Case 3: Checkpoint 2 crossed at SAFE pace (Within Ceiling)
    cp2_payload = {
        "session_id": "live_ride",
        "speed_kmh": 90,
        "limit_kmh": 100,
        "ceiling_kmh": 92.3,
        "current_avg_kmh": 100.0,
        "banked_time_s": -15.0,
        "covered_m": 10000,
        "remaining_m": 10000,
        "alert": "amber",
        "event_type": "checkpoint",
        "checkpoint_index": 2,
        "checkpoint_name": "Checkpoint 2 (50%)"
    }
    req = urllib.request.Request(f"{BASE_URL}/api/telemetry/live", data=json.dumps(cp2_payload).encode(), headers={"Content-Type": "application/json"})
    urllib.request.urlopen(req)

    req = urllib.request.Request(f"{BASE_URL}/api/live/status")
    with urllib.request.urlopen(req) as resp:
        status_data = json.loads(resp.read().decode())
        assert status_data["latest_checkpoint_index"] == 2, f"Expected cp 2, got {status_data['latest_checkpoint_index']}"
        assert status_data["latest_checkpoint_exceeding"] is False, "Expected cp 2 to be compliant"
        assert "NOT EXCEEDING" in status_data["latest_checkpoint_status_label"]
        assert "right way" in status_data["latest_checkpoint_advice"].lower(), "Advice missing 'right way' reassurance"
        assert status_data["checkpoints_crossed_count"] >= 2, "Expected history of multiple checkpoints"
        print("[OK] Verification 3: Checkpoint 2 COMPLIANT (Right Way) recorded; history retains both checkpoints.")

    # Edge Case 4: Analyze Situation Spoken Text generation for Checkpoint crossing
    req = urllib.request.Request(
        f"{BASE_URL}/api/bolna/analyze-situation",
        data=json.dumps({
            "speed_kmh": 125,
            "limit_kmh": 100,
            "ceiling_kmh": 75.9,
            "covered_m": 10000,
            "remaining_m": 10000,
            "alert": "red",
            "event_type": "checkpoint",
            "checkpoint_index": 2,
            "checkpoint_name": "Checkpoint 2",
            "language": "english"
        }).encode(),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        analyze_data = json.loads(resp.read().decode())
        spoken = analyze_data.get("spoken_text", "")
        assert "EXCEEDING" in spoken, f"Expected EXCEEDING in spoken text: {spoken}"
        assert "wrong way" in spoken.lower(), f"Expected 'wrong way' in spoken text: {spoken}"
        assert "reduce throttle" in spoken.lower() or "decelerate" in spoken.lower(), f"Expected deceleration directive: {spoken}"
        print(f"[OK] Verification 4: Dynamic Spoken Alert for Over-speeding: \"{spoken}\"")

    # Edge Case 5: Analyze Situation Spoken Text for Safe Compliance Checkpoint
    req = urllib.request.Request(
        f"{BASE_URL}/api/bolna/analyze-situation",
        data=json.dumps({
            "speed_kmh": 85,
            "limit_kmh": 100,
            "ceiling_kmh": 100.0,
            "covered_m": 15000,
            "remaining_m": 5000,
            "alert": "green",
            "event_type": "checkpoint",
            "checkpoint_index": 3,
            "checkpoint_name": "Checkpoint 3",
            "language": "english"
        }).encode(),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        analyze_data = json.loads(resp.read().decode())
        spoken = analyze_data.get("spoken_text", "")
        assert "NOT exceeding" in spoken, f"Expected NOT exceeding in spoken text: {spoken}"
        assert "right way" in spoken.lower(), f"Expected 'right way' in spoken text: {spoken}"
        print(f"[OK] Verification 5: Dynamic Spoken Alert for Compliant Pacing: \"{spoken}\"")

    print("\n>>> ALL CHECKPOINT VOICE & CONTEXT EDGE CASES PASSED 100%! <<<")

if __name__ == "__main__":
    test_checkpoint_edge_cases()
