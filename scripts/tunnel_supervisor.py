import subprocess
import re
import time
import urllib.request
import sys
import os

from pathlib import Path
from dotenv import load_dotenv

env_path = Path(__file__).resolve().parent.parent / 'backend' / '.env'
if env_path.exists():
    load_dotenv(env_path)

API_KEY = os.getenv('BOLNA_API_KEY', '')
AGENT_ID = os.getenv('BOLNA_AGENT_ID', 'e629dcb5-36f8-4ef6-9748-8eff47c824e5')

def update_bolna(tunnel_url: str):
    print(f"[SUPERVISOR] Syncing Bolna Cloud Agent to: {tunnel_url}", flush=True)
    try:
        script_path = os.path.join(os.path.dirname(__file__), "update_bolna_hangup.py")
        res = subprocess.run([sys.executable, script_path, tunnel_url], capture_output=True, text=True, check=True)
        print(f"[SUPERVISOR] Bolna synced successfully: {res.stdout.strip()}", flush=True)
        return True
    except Exception as e:
        print(f"[SUPERVISOR ERROR] Failed to update Bolna: {e}", flush=True)
        return False

def ping_tunnel(tunnel_url: str):
    try:
        req = urllib.request.Request(
            f"{tunnel_url}/health",
            headers={"bypass-tunnel-reminder": "true"}
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.status == 200
    except Exception:
        return False

def run():
    print("[SUPERVISOR] Starting self-healing localtunnel supervisor...")
    while True:
        print("[SUPERVISOR] Launching npx localtunnel...")
        proc = subprocess.Popen(
            ["npx.cmd", "-y", "localtunnel", "--port", "8000", "--subdomain", "velo-ai-copilot"],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )
        tunnel_url = None
        while True:
            line = proc.stdout.readline()
            if not line:
                break
            print(f"[LT OUTPUT] {line.strip()}", flush=True)
            match = re.search(r"https://[a-zA-Z0-9-]+\.loca\.lt", line)
            if match:
                tunnel_url = match.group(0)
                break
        
        if not tunnel_url:
            print("[SUPERVISOR WARN] Failed to get tunnel URL, restarting in 3s...")
            proc.kill()
            time.sleep(3)
            continue

        print(f"[SUPERVISOR] Tunnel established at {tunnel_url}")
        update_bolna(tunnel_url)

        # Heartbeat loop to keep tunnel connection warm and prevent localtunnel 503 drops
        consecutive_failures = 0
        while True:
            time.sleep(20)
            if proc.poll() is not None:
                print("[SUPERVISOR] Localtunnel process exited. Restarting...")
                break
            
            is_alive = ping_tunnel(tunnel_url)
            if is_alive:
                consecutive_failures = 0
                # print(f"[SUPERVISOR HEARTBEAT] Tunnel {tunnel_url} healthy.")
            else:
                consecutive_failures += 1
                print(f"[SUPERVISOR WARN] Tunnel ping failed ({consecutive_failures}/3)")
                if consecutive_failures >= 3:
                    print("[SUPERVISOR] Tunnel unresponsive. Recycling process...")
                    proc.kill()
                    break

if __name__ == "__main__":
    run()
