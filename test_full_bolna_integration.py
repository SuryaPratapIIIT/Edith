import urllib.request
import json
import time

def run_tests():
    print("=== TESTING VELO AI <-> BOLNA INTEGRATION ===")
    
    # 1. Test live telemetry sync
    telemetry_payload = {
        "session_id": "live_ride",
        "speed_kmh": 85,
        "limit_kmh": 70,
        "ceiling_kmh": 68.5,
        "covered_m": 2500,
        "remaining_m": 7500,
        "current_avg_kmh": 82.0,
        "banked_time_s": -14.2,
        "alert": "red",
        "next_camera": "Signature Tower ANPR Gantry",
        "distance_to_camera_m": 100,
        "event_type": "camera_100m",
        "checkpoint_index": 2,
        "checkpoint_name": "Checkpoint 2 (50%)",
        "route_origin": "Cyber City Gurugram",
        "route_destination": "Manesar IMT Toll",
        "total_journey_m": 10000,
        "journey_elapsed_s": 110,
        "total_cameras": 5,
        "cleared_cameras": 1,
        "challan_count": 0
    }
    
    req = urllib.request.Request(
        "http://localhost:8000/api/telemetry/live",
        data=json.dumps(telemetry_payload).encode(),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode())
        assert res.get("status") == "synced", f"Unexpected sync status: {res}"
        print("[OK] Telemetry Sync")

    # 2. Test GET /api/live/status directly
    req = urllib.request.Request("http://localhost:8000/api/live/status")
    with urllib.request.urlopen(req) as resp:
        status_data = json.loads(resp.read().decode())
        headers = dict(resp.headers)
        
        # Verify anti-cache headers
        cache_hdr = resp.getheader("cache-control", "")
        assert "no-cache" in cache_hdr, f"Cache-Control header missing no-cache: {cache_hdr}"
        assert status_data["current_speed"] == "85 km/h", f"Speed mismatch: {status_data['current_speed']}"
        assert status_data["distance_to_camera_m"] == 100, f"Distance mismatch: {status_data['distance_to_camera_m']}"
        assert "Camera is heading" in status_data["situation_analysis"], "Missing 'Camera is heading' in analysis"
        assert "EXCEEDING" in status_data["situation_analysis"], "Missing 'EXCEEDING' alert in analysis"
        assert status_data["exceeding_status"] == "exceeding", "Expected status 'exceeding'"
        print("[OK] Live Telemetry Status & Anti-Cache Headers")
        print(f"  -> Spoken Status: {status_data['situation_analysis']}")
        print(f"  -> Trip Summary:  {status_data['trip_summary']}")

    # 3. Test GET /api/live/status through Localtunnel
    req = urllib.request.Request(
        "https://velo-live-suraj.loca.lt/api/live/status",
        headers={"bypass-tunnel-reminder": "true"}
    )
    with urllib.request.urlopen(req) as resp:
        tunnel_data = json.loads(resp.read().decode())
        assert tunnel_data["speed_kmh"] == 85, f"Tunnel speed mismatch: {tunnel_data['speed_kmh']}"
        print("[OK] Localtunnel Tunnel Status Response (HTTP 200)")

    # 4. Test Hangup Flow
    # Reset first
    req = urllib.request.Request("http://localhost:8000/api/bolna/reset-hangup", data=b"{}", headers={"Content-Type": "application/json"})
    urllib.request.urlopen(req)
    
    # Check status is false
    req = urllib.request.Request("http://localhost:8000/api/bolna/hangup-status")
    with urllib.request.urlopen(req) as resp:
        d = json.loads(resp.read().decode())
        assert d["hangup_requested"] is False, "Expected hangup_requested to be False"

    # Trigger hangup via tunnel
    req = urllib.request.Request(
        "https://velo-live-suraj.loca.lt/api/bolna/hangup",
        data=json.dumps({"reason": "User said cut the call friday"}).encode(),
        headers={"Content-Type": "application/json", "bypass-tunnel-reminder": "true"}
    )
    with urllib.request.urlopen(req) as resp:
        hangup_resp = json.loads(resp.read().decode())
        assert hangup_resp["status"] == "hangup_initiated", f"Unexpected response: {hangup_resp}"

    # Verify status is true
    req = urllib.request.Request("http://localhost:8000/api/bolna/hangup-status")
    with urllib.request.urlopen(req) as resp:
        d = json.loads(resp.read().decode())
        assert d["hangup_requested"] is True, "Expected hangup_requested to be True"
        print("[OK] Hangup Call Flow (Trigger -> Status True)")

    # 5. Verify Bolna Cloud Agent Configuration
    import os
    from pathlib import Path
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent / "backend" / ".env")
    api_key = os.getenv("BOLNA_API_KEY", "")
    agent_id = os.getenv("BOLNA_AGENT_ID", "e629dcb5-36f8-4ef6-9748-8eff47c824e5")
    req = urllib.request.Request(
        f"https://api.bolna.ai/v2/agent/{agent_id}",
        headers={"Authorization": f"Bearer {api_key}"}
    )
    with urllib.request.urlopen(req) as resp:
        agent_data = json.loads(resp.read().decode())
        tools_params = agent_data["tasks"][0]["tools_config"]["api_tools"]["tools_params"]
        assert "get_live_telemetry" in tools_params, "get_live_telemetry tool missing"
        assert "hangup_call" in tools_params, "hangup_call tool missing"
        assert "velo-live-suraj.loca.lt" in tools_params["get_live_telemetry"]["url"], "get_live_telemetry URL mismatch"
        assert "velo-live-suraj.loca.lt" in tools_params["hangup_call"]["url"], "hangup_call URL mismatch"
        print("[OK] Bolna Cloud Agent Tools Registered & Pointing to Active Tunnel")

    # Reset hangup back to false for next call
    req = urllib.request.Request("http://localhost:8000/api/bolna/reset-hangup", data=b"{}", headers={"Content-Type": "application/json"})
    urllib.request.urlopen(req)

    print("\n>>> ALL BOLNA & REAL-TIME INTEGRATION CHECKS PASSED PERFECTLY! <<<")

if __name__ == "__main__":
    run_tests()
