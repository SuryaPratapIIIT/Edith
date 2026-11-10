"""
Test Suite for Gnani AI Voice Integration (STT Prisma & TTS Timbre)
Validates endpoints, telemetry context reasoning, TTS audio generation,
STT file handling, and natural voice interaction flows.
"""
import sys
import os
import io
import wave
import struct
import base64
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent / "backend"
sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from main import app, sessions

client = TestClient(app)

def create_sample_wav(duration_s=0.2, freq=440.0):
    sample_rate = 16000
    num_samples = int(sample_rate * duration_s)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        frames = [int(1000 * math.sin(2 * math.pi * freq * i / sample_rate)) for i in range(num_samples)] if 'math' in globals() else [0] * num_samples
        w.writeframes(struct.pack(f"<{num_samples}h", *frames))
    return buf.getvalue()

import math

def test_gnani_suite():
    print("=" * 60)
    print("RUNNING GNANI AI (STT & TTS) INTEGRATION TESTS")
    print("=" * 60)

    # 1. Test Config Endpoint
    conf_resp = client.get("/api/gnani/config")
    assert conf_resp.status_code == 200
    conf = conf_resp.json()
    print("✓ Gnani Config:", conf)
    assert "stt_model" in conf
    assert "tts_model" in conf
    assert conf["stt_model"] == "prisma-v3.0"
    assert conf["tts_model"] == "timbre-v3.0"

    # 2. Test Session Creation / Greeting
    sess_resp = client.post("/api/gnani/session", json={"language": "hinglish"})
    assert sess_resp.status_code == 200
    sess_data = sess_resp.json()
    print("✓ Gnani Session Greeting:", sess_data["greeting_text"])
    assert "greeting_text" in sess_data
    assert "audio_base64" in sess_data
    assert len(sess_data["audio_base64"]) > 100

    # 3. Setup Telemetry in Session
    client.post("/api/telemetry/live", json={
        "session_id": "live_ride",
        "speed_kmh": 66.0,
        "limit_kmh": 70.0,
        "ceiling_kmh": 68.0,
        "covered_m": 1500.0,
        "remaining_m": 5000.0,
        "next_camera": "Cyber Hub Overpass",
        "distance_to_camera_m": 350.0,
        "total_cameras": 5,
        "cameras_passed": 1,
        "challan_risk": "Zero Risk - Clean Record"
    })

    # 4. Test Chat Interaction (Speed Query)
    chat_speed = client.post("/api/gnani/chat", data={
        "query": "What is my current speed?",
        "language": "english",
        "session_id": "live_ride"
    })
    assert chat_speed.status_code == 200
    sp_data = chat_speed.json()
    print("\n--- TEST: Speed Query ---")
    print("Query:", sp_data["query"])
    print("Response:", sp_data["response_text"])
    assert "66" in sp_data["response_text"]
    assert "70" in sp_data["response_text"]
    assert bool(sp_data["audio_base64"])

    # 5. Test Chat Interaction (Next Camera Query - Hinglish)
    chat_cam = client.post("/api/gnani/chat", data={
        "query": "Agla camera kahan hai aur kitne bache hain?",
        "language": "hinglish",
        "session_id": "live_ride"
    })
    assert chat_cam.status_code == 200
    cam_data = chat_cam.json()
    print("\n--- TEST: Camera Query (Hinglish) ---")
    print("Query:", cam_data["query"])
    print("Response:", cam_data["response_text"])
    assert "Cyber Hub Overpass" in cam_data["response_text"] or "camera" in cam_data["response_text"].lower()
    assert bool(cam_data["audio_base64"])

    # 6. Test Chat Interaction (Pace Ceiling Query)
    chat_ceiling = client.post("/api/gnani/chat", data={
        "query": "Safe pace ceiling kya hai?",
        "language": "hinglish",
        "session_id": "live_ride"
    })
    assert chat_ceiling.status_code == 200
    ceil_data = chat_ceiling.json()
    print("\n--- TEST: Pace Ceiling Query ---")
    print("Response:", ceil_data["response_text"])
    assert "68" in ceil_data["response_text"]

    # 7. Test Chat Interaction (Hangup Command)
    chat_hangup = client.post("/api/gnani/chat", data={
        "query": "Cut the call friday, disconnect now",
        "language": "english",
        "session_id": "live_ride"
    })
    assert chat_hangup.status_code == 200
    hu_data = chat_hangup.json()
    print("\n--- TEST: Hangup Command ---")
    print("Response:", hu_data["response_text"])
    print("Hangup flag:", hu_data["hangup"])
    assert hu_data["hangup"] is True
    assert hu_data["action"] == "hangup"

    # Verify backend hangup status was toggled
    hu_status = client.get("/api/bolna/hangup-status").json()
    assert hu_status["hangup_requested"] is True
    print("✓ Hangup state propagated across backend sessions")

    # 8. Test Direct TTS Endpoint
    tts_resp = client.post("/api/gnani/tts", json={
        "text": "Slow down, camera ahead in 200 meters.",
        "language": "en-IN",
        "voice": "Avinash",
        "speed": 1.0
    })
    assert tts_resp.status_code == 200
    assert len(tts_resp.content) > 100
    assert tts_resp.headers["content-type"] == "audio/wav"
    print("\n✓ Direct TTS endpoint returned valid audio bytes:", len(tts_resp.content))

    # 9. Test Direct STT Endpoint
    sample_wav = create_sample_wav()
    stt_resp = client.post(
        "/api/gnani/stt",
        files={"file": ("test.wav", sample_wav, "audio/wav")},
        data={"language_code": "hi-IN"}
    )
    assert stt_resp.status_code == 200
    stt_data = stt_resp.json()
    print("✓ Direct STT endpoint handled audio file:", stt_data)

    print("\n" + "=" * 60)
    print("ALL GNANI AI INTEGRATION TESTS PASSED 100% SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    test_gnani_suite()

