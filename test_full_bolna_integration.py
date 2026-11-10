import urllib.request
import json
import time
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / "backend" / ".env")
api_key = os.getenv("BOLNA_API_KEY", "")
agent_id = os.getenv("BOLNA_AGENT_ID", "e629dcb5-36f8-4ef6-9748-8eff47c824e5")

def run_tests():
    print("=== TESTING VELO AI <-> BOLNA INTEGRATION ===")
    
    if not api_key or api_key.startswith("your_") or len(api_key) < 10:
        print("[INFO] Bolna key not configured. Gnani AI is active voice engine.")
        print("[OK] Skipping legacy cloud Bolna test.")
        return

    # 1. Fetch active tunnel URL directly from Bolna agent configuration
    req = urllib.request.Request(
        f"https://api.bolna.ai/v2/agent/{agent_id}",
        headers={"Authorization": f"Bearer {api_key}"}
    )
    with urllib.request.urlopen(req) as resp:
        agent_data = json.loads(resp.read().decode())
        tools_params = agent_data["tasks"][0]["tools_config"]["api_tools"]["tools_params"]
        assert "get_live_telemetry" in tools_params, "get_live_telemetry tool missing"
        assert "hangup_call" in tools_params, "hangup_call tool missing"
        active_tunnel_url = "/".join(tools_params["get_live_telemetry"]["url"].split("/")[:3])
        print(f"[OK] Bolna Cloud Agent Verified: Tools pointing to active tunnel {active_tunnel_url}")

    # 2. Test live telemetry sync
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
        f"{active_tunnel_url}/api/telemetry/live",
        data=json.dumps(telemetry_payload).encode(),
        headers={"Content-Type": "application/json", "bypass-tunnel-reminder": "true"}
    )
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode())
        assert res.get("status") == "synced", f"Unexpected sync status: {res}"
        print("[OK] Telemetry Sync (Session ID: integration_test_session)")

    # 3. Test GET /api/live/status directly
    req = urllib.request.Request(
        f"{active_tunnel_url}/api/live/status",
        headers={"bypass-tunnel-reminder": "true"}
    )
    with urllib.request.urlopen(req) as resp:
        status_data = json.loads(resp.read().decode())
        cache_hdr = resp.getheader("cache-control", "")
        assert "no-cache" in cache_hdr, f"Cache-Control header missing no-cache: {cache_hdr}"
        assert status_data["limit_kmh"] == 70, f"Limit mismatch: {status_data['limit_kmh']}"
        assert "situation_analysis" in status_data, "Missing situation_analysis"
        assert "exceeding_status" in status_data, "Missing exceeding_status"
        print("[OK] Live Telemetry Status & Anti-Cache Headers")
        print(f"  -> Situation Analysis: {status_data['situation_analysis']}")
        print(f"  -> Trip Summary:      {status_data['trip_summary']}")

    # 4. Test GET /api/live/status through active URL
    req = urllib.request.Request(
        f"{active_tunnel_url}/api/live/status",
        headers={"bypass-tunnel-reminder": "true"}
    )
    with urllib.request.urlopen(req) as resp:
        tunnel_data = json.loads(resp.read().decode())
        assert "status" in tunnel_data or "current_speed" in tunnel_data
        print(f"[OK] Active Tunnel Response (HTTP 200 via {active_tunnel_url})")

    # 5. Test Hangup Flow
    # Reset first
    req = urllib.request.Request(f"{active_tunnel_url}/api/bolna/reset-hangup", data=b"{}", headers={"Content-Type": "application/json", "bypass-tunnel-reminder": "true"})
    urllib.request.urlopen(req)
    
    # Check status is false
    req = urllib.request.Request(f"{active_tunnel_url}/api/bolna/hangup-status", headers={"bypass-tunnel-reminder": "true"})
    with urllib.request.urlopen(req) as resp:
        d = json.loads(resp.read().decode())
        assert d["hangup_requested"] is False, "Expected hangup_requested to be False"

    # Trigger hangup via tunnel
    req = urllib.request.Request(
        f"{active_tunnel_url}/api/bolna/hangup",
        data=json.dumps({"reason": "User commanded cut the call", "user_command": "cut the call friday"}).encode(),
        headers={"Content-Type": "application/json", "bypass-tunnel-reminder": "true"}
    )
    with urllib.request.urlopen(req) as resp:
        hangup_resp = json.loads(resp.read().decode())
        assert hangup_resp["status"] == "hangup_initiated", f"Unexpected response: {hangup_resp}"

    # Verify status is true
    req = urllib.request.Request(f"{active_tunnel_url}/api/bolna/hangup-status", headers={"bypass-tunnel-reminder": "true"})
    with urllib.request.urlopen(req) as resp:
        d = json.loads(resp.read().decode())
        assert d["hangup_requested"] is True, "Expected hangup_requested to be True"
        print("[OK] Hangup Call Flow (Trigger -> Status True via active tunnel)")

    # Reset hangup back to false so next call is completely clean
    req = urllib.request.Request(f"{active_tunnel_url}/api/bolna/reset-hangup", data=b"{}", headers={"Content-Type": "application/json", "bypass-tunnel-reminder": "true"})
    urllib.request.urlopen(req)
    print("[OK] Hangup Flag Reset Cleanly")

    print("\n>>> ALL BOLNA & REAL-TIME INTEGRATION CHECKS PASSED 100%! <<<")

if __name__ == "__main__":
    run_tests()
