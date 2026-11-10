"""
Gnani AI Voice Service (STT Prisma & TTS Timbre)
Provides:
  - Speech-to-Text via Gnani Prisma (REST / transcribe_bytes)
  - Text-to-Speech via Gnani Timbre (REST / synthesize)
  - Conversational automotive co-pilot reasoning over live telemetry
  - Zero hardcoding: fully configurable via environment variables
"""

import os
import io
import time
import re
import wave
import struct
import math
import logging
from typing import Optional, Dict, Any, Tuple
from pathlib import Path

# Load environment variables if not already loaded
try:
    from dotenv import load_dotenv
    backend_env = Path(__file__).resolve().parent / ".env"
    root_env = Path(__file__).resolve().parent.parent / ".env"
    if backend_env.exists():
        load_dotenv(dotenv_path=backend_env)
    if root_env.exists():
        load_dotenv(dotenv_path=root_env, override=False)
except ImportError:
    pass

logger = logging.getLogger("gnani_service")
logger.setLevel(logging.INFO)

# ─── Configuration ─────────────────────────────────────────────────────────────
GNANI_API_KEY = os.getenv("GNANI_API_KEY", "").strip()
GNANI_BASE_URL = os.getenv("GNANI_BASE_URL", "https://api.vachana.ai").rstrip("/")
GNANI_STT_MODEL = os.getenv("GNANI_STT_MODEL", "prisma-v3.0").strip()
GNANI_TTS_MODEL = os.getenv("GNANI_TTS_MODEL", "timbre-v3.0").strip()

# Smart voice default depending on timbre model version
TIMBRE_V30_VOICES = {
    "Avinash", "Chetana", "Devansh", "Harshad", "Kalpana",
    "Lakshmi", "Prakash", "Riyaa", "Shivani", "Shubham",
    "Tarika", "Vasudha", "Yashraj"
}

if "v3" in GNANI_TTS_MODEL:
    default_voice_en = "Avinash"
    default_voice_hi = "Shivani"
else:
    default_voice_en = "Pranav"
    default_voice_hi = "Nalini"

GNANI_TTS_VOICE_EN = os.getenv("GNANI_TTS_VOICE_EN", default_voice_en).strip()
GNANI_TTS_VOICE_HI = os.getenv("GNANI_TTS_VOICE_HI", default_voice_hi).strip()
try:
    GNANI_SPEED = float(os.getenv("GNANI_SPEED", "1.0"))
except ValueError:
    GNANI_SPEED = 1.0


def is_gnani_configured() -> bool:
    """Returns True if a real Gnani API key is configured."""
    key = os.getenv("GNANI_API_KEY", "").strip()
    return bool(key and key != "your_gnani_api_key_here")


def get_gnani_config() -> Dict[str, Any]:
    return {
        "configured": is_gnani_configured(),
        "base_url": GNANI_BASE_URL,
        "stt_model": GNANI_STT_MODEL,
        "tts_model": GNANI_TTS_MODEL,
        "voice_en": GNANI_TTS_VOICE_EN,
        "voice_hi": GNANI_TTS_VOICE_HI,
        "speed": GNANI_SPEED,
    }


def generate_fallback_wav(duration_s: float = 0.5, freq_hz: float = 440.0) -> bytes:
    """Generates a clean synthetic PCM WAV tone as fallback when API key is missing."""
    sample_rate = 16000
    num_samples = int(sample_rate * duration_s)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        frames = []
        for i in range(num_samples):
            # Smooth gentle sine beep with envelope
            envelope = math.sin(math.pi * i / num_samples)
            val = int(32767 * 0.2 * envelope * math.sin(2 * math.pi * freq_hz * i / sample_rate))
            frames.append(val)
        w.writeframes(struct.pack(f"<{num_samples}h", *frames))
    return buf.getvalue()


# ─── Gnani STT Client ──────────────────────────────────────────────────────────
def transcribe_audio_bytes(
    audio_bytes: bytes,
    filename: str = "audio.wav",
    language_code: Optional[str] = None
) -> Dict[str, Any]:
    """
    Transcribes audio bytes using Gnani Prisma STT model.
    Supports Prisma v3.0 automatic language identification (Hindi + English).
    Falls back gracefully if API key is not yet set.
    """
    lang = language_code or "hi-IN"
    if not is_gnani_configured():
        logger.warning("[Gnani STT] GNANI_API_KEY is not configured yet. Returning dev fallback.")
        return {
            "success": False,
            "configured": False,
            "transcript": "",
            "message": "GNANI_API_KEY not configured. Please set GNANI_API_KEY in backend/.env"
        }

    try:
        from gnani.stt import GnaniSTTClient
        client = GnaniSTTClient(
            api_key=os.getenv("GNANI_API_KEY"),
            base_url=GNANI_BASE_URL
        )

        # For Prisma v3.0, use indic-auto with Hindi & English candidates for zero-friction detection
        if "v3" in GNANI_STT_MODEL:
            target_lang = "indic-auto"
            candidates = ["hi-IN", "en-IN"]
        else:
            target_lang = lang
            candidates = None

        res = client.transcribe_bytes(
            audio_bytes,
            filename=filename,
            language_code=target_lang,
            language_candidates=candidates,
            model=GNANI_STT_MODEL,
            format="transcribe"
        )
        detected_lang = res.get("detected_language_code") or target_lang
        return {
            "success": True,
            "transcript": res.get("transcript", ""),
            "request_id": res.get("request_id"),
            "language": detected_lang
        }
    except Exception as e:
        logger.error(f"[Gnani STT Error]: {e}")
        return {
            "success": False,
            "error": str(e),
            "transcript": ""
        }


# ─── Gnani TTS Client ──────────────────────────────────────────────────────────
def synthesize_speech(
    text: str,
    language: Optional[str] = None,
    voice: Optional[str] = None,
    speed: Optional[float] = None
) -> Tuple[bytes, str]:
    """
    Synthesizes text into high-quality speech using Gnani Timbre TTS.
    Returns (audio_bytes, content_type).
    """
    if not text or not text.strip():
        return generate_fallback_wav(0.1), "audio/wav"

    # Default voice selection based on language / model
    effective_lang = language or "en-IN"
    if "hi" in effective_lang.lower() or effective_lang == "hinglish":
        default_voice = GNANI_TTS_VOICE_HI
        lang_code = "hi-IN"
    else:
        default_voice = GNANI_TTS_VOICE_EN
        lang_code = "en-IN"

    chosen_voice = voice or default_voice
    # Normalize voice based on active model version to avoid ValueError
    if "v3" in GNANI_TTS_MODEL:
        if chosen_voice not in TIMBRE_V30_VOICES:
            chosen_voice = "Shivani" if "hi" in effective_lang.lower() or effective_lang == "hinglish" else "Avinash"
    else:
        if chosen_voice in TIMBRE_V30_VOICES:
            chosen_voice = "Nalini" if "hi" in effective_lang.lower() or effective_lang == "hinglish" else "Pranav"

    chosen_speed = speed if speed is not None else GNANI_SPEED
    # Clamp speed between 0.85 and 1.15 as specified by Gnani docs
    chosen_speed = max(0.85, min(1.15, chosen_speed))

    if not is_gnani_configured():
        logger.warning("[Gnani TTS] GNANI_API_KEY not configured. Returning fallback acoustic tone.")
        return generate_fallback_wav(0.6, freq_hz=523.25), "audio/wav"

    try:
        from gnani.tts import GnaniTTSClient, AudioConfig
        client = GnaniTTSClient(
            api_key=os.getenv("GNANI_API_KEY"),
            base_url=GNANI_BASE_URL
        )
        audio = client.synthesize(
            text=text.strip(),
            voice=chosen_voice,
            model=GNANI_TTS_MODEL,
            language=lang_code,
            speed=chosen_speed,
            audio_config=AudioConfig(sample_rate=24000, container="wav", encoding="linear_pcm")
        )
        return audio, "audio/wav"
    except Exception as e:
        logger.error(f"[Gnani TTS Error]: {e}")
        return generate_fallback_wav(0.5, freq_hz=440.0), "audio/wav"


# ─── Natural Intent Classifier & Response Generator ────────────────────────────
def answer_telemetry_query(query: str, session: Dict[str, Any], lang: str = "hinglish") -> Dict[str, Any]:
    """
    Understands driver spoken commands in English, Hindi (Devanagari & Latin), and Hinglish.
    Answers with the exact real-time ANPR calculus pacing data from the session.
    """
    q = (query or "").strip().lower()
    has_devanagari = any('\u0900' <= char <= '\u097f' for char in q)
    is_hi = (
        lang in ("hindi", "hinglish")
        or has_devanagari
        or any(w in q for w in ["kya", "kitna", "kahan", "hai", "batao", "kar", "do", "meri", "aage"])
    )

    # 1. Hangup / Disconnect Command
    hangup_patterns = [
        "cut call", "cut the call", "cut this call", "cut my call", "call cut",
        "cut call from your side", "cut the call from your side", "cut it from your side", "cut from your side",
        "from your side", "from your end",
        "hang up", "hangup", "disconnect", "disconnect call", "disconnect the call",
        "end call", "end the call", "end session", "end this session",
        "stop call", "stop the call", "stop listening", "stop talking", "call end",
        "drop call", "drop the call", "close call", "close the call",
        "bye", "goodbye", "alvida", "tata", "band kar do", "band karo", "rakh do", "rakh lo",
        "call kaat", "call kat", "call kato", "call kaato", "fone kaat", "phone kaat",
        "cut kar do", "cut kardo", "cut kar", "cut phone", "phone cut",
        "apni taraf se", "apne taraf se", "apni side se", "apne side se",
        "कॉल काटो", "फोन काटो", "कॉल बंद करो", "फोन रखो", "रख दो", "बाय", "अलविदा", "बंद करो", "काट दो", "काटो"
    ]
    words = set(re.findall(r"\b\w+\b", q))
    has_cut = any(w in words for w in ["cut", "disconnect", "hangup", "hang", "drop", "end", "close", "stop"])
    has_call_target = any(w in words for w in ["call", "phone", "session", "side", "line"])
    has_side_cut = ("side" in words or "end" in words or "taraf" in q) and any(
        w in words or w in q for w in ["cut", "disconnect", "close", "kaat", "kato", "kaato"]
    )

    is_hangup = (
        not ("challan" in q or "चालान" in q or "chalan" in q)
        and (
            any(p in q for p in hangup_patterns)
            or (has_cut and has_call_target)
            or has_side_cut
        )
    )
    if is_hangup:
        response_text = (
            "Call cut kar rahi hoon boss, safe driving kijiye!"
            if is_hi else
            "Cutting the call now, boss. Drive safely!"
        )
        return {
            "action": "hangup",
            "hangup": True,
            "response_text": response_text,
            "category": "call_control"
        }

    # Extract session metrics with safe defaults
    speed = round(session.get("current_speed_kmh", 0))
    limit = round(session.get("limit_kmh", 70))
    ceiling = round(session.get("ceiling_kmh", limit))
    avg_speed = round(session.get("current_avg_kmh", speed))
    alert = session.get("alert", "green").lower()
    next_cam = session.get("next_camera", "Upcoming GMDA Gantry")
    dist_m = round(session.get("distance_to_camera_m", 500))
    total_cams = session.get("total_cameras") or session.get("cameras_total") or 6
    if total_cams <= 0:
        total_cams = 6
    passed_cams = session.get("cameras_passed") or session.get("cleared_cameras") or 0
    rem_cams = max(0, total_cams - passed_cams)
    rem_m = session.get("remaining_m", 5000)
    rem_km = round(rem_m / 1000, 1)
    banked_s = round(session.get("banked_time_s", 0), 1)

    # 2. Camera / Gantry Query
    camera_patterns = [
        "camera", "gantry", "radar", "trap", "aage", "ahead", "next", "pass",
        "कैमरा", "कैमरे", "गैंट्री", "रडार", "आगे", "अगला"
    ]
    if any(w in q for w in camera_patterns):
        # 2a. Total Cameras / Count Query ("total kitne camera hain", "how many cameras", "total camera", "kitne camera", "kul kitne")
        if any(w in q for w in ["total", "kitne", "how many", "count", "number", "sab", "saare", "bache", "kul", "कुल", "कितने", "कितना", "संख्या"]):
            if is_hi:
                resp = f"Is route par total {total_cams} ANPR cameras hain. Aapne {passed_cams} cameras cross kar liye hain aur {rem_cams} camera aage bache hain. Agla camera {next_cam} {dist_m} meter aage hai."
            else:
                resp = f"There are {total_cams} total ANPR cameras on this route. You have passed {passed_cams} so far, with {rem_cams} cameras remaining ahead. Next camera at {next_cam} is {dist_m} meters ahead."
        # 2b. Passed / Cross Query ("kitne cross hue", "passed")
        elif any(w in q for w in ["passed", "cross", "cleared", "kitne pass", "क्रॉस", "पार", "निकले"]):
            if is_hi:
                resp = f"Aapne {total_cams} cameras me se {passed_cams} cross kar liye hain, {rem_cams} camera aage bache hain."
            else:
                resp = f"You have passed {passed_cams} cameras so far out of {total_cams} total cameras. {rem_cams} cameras remaining ahead."
        # 2c. Upcoming / Next Camera Query
        else:
            time_to_cam = round(dist_m / max(0.1, (speed / 3.6))) if speed > 0 else 999
            if is_hi:
                resp = f"Agla camera {next_cam} {dist_m} meter aage hai, lagbhag {round(time_to_cam)} second me pahuchenge. Total {total_cams} me se {rem_cams} camera aage bache hain. Limit {limit} km/h hai."
            else:
                resp = f"Next ANPR gantry at {next_cam} is {dist_m} meters ahead, arriving in {round(time_to_cam)} seconds. {rem_cams} of {total_cams} total cameras remaining ahead. Posted limit is {limit} km/h."
        return {
            "action": "reply",
            "hangup": False,
            "response_text": resp,
            "category": "cameras"
        }

    # 3. Safe Pace Ceiling / Average Speed Query
    ceiling_patterns = [
        "ceiling", "pace", "allowed", "max", "limit", "safe pace", "maximum", "kitna chal",
        "सीलिंग", "पेस", "लिमिट", "सीमा", "कितना चलूं", "कितनी गति", "अधिकतम"
    ]
    if any(w in q for w in ceiling_patterns):
        if is_hi:
            resp = f"Aapka dynamic safe pace ceiling {ceiling} km/h hai. Iske andar chalte rahein toh zero challan risk rahega."
        else:
            resp = f"Your dynamic safe pace ceiling is {ceiling} km/h. Cruising within this ceiling guarantees zero average-speed challans."
        return {
            "action": "reply",
            "hangup": False,
            "response_text": resp,
            "category": "ceiling"
        }

    # 4. Challan / Fine Risk Query
    challan_patterns = [
        "challan", "fine", "penalty", "risk", "katega", "police", "safe",
        "चालान", "जुर्माना", "कटेगा", "पेनाल्टी", "फाइन", "पुलिस", "रिस्क"
    ]
    if any(w in q for w in challan_patterns):
        risk = session.get("challan_risk", "zero")
        if speed > ceiling or alert in ("red", "warn", "critical"):
            excess_c = max(1, round(speed - ceiling))
            if is_hi:
                resp = f"High Challan Risk! Aap safe ceiling se +{excess_c} km/h exceed kar rahe hain. Challan se bachne ke liye abhi slow kijiye."
            else:
                resp = f"High Challan Risk! Exceeding safe ceiling by +{excess_c} km/h. Slow down immediately to avoid an automated challan."
        else:
            if is_hi:
                resp = "Clean record boss, zero challan risk. Safe pace maintained."
            else:
                resp = "Clean record boss, zero challan risk. Cruising safely within bounds."
        return {
            "action": "reply",
            "hangup": False,
            "response_text": resp,
            "category": "challan_risk"
        }

    # 5. Current Speed / Overspeeding Query
    speed_patterns = [
        "speed", "velocity", "raftar", "tez", "fast", "slow", "overspeed",
        "स्पीड", "रफ्तार", "रफ़्तार", "गति", "तेज़", "धीमे", "स्लो", "फास्ट"
    ]
    if any(w in q for w in speed_patterns):
        excess = speed - limit
        if excess > 0:
            if is_hi:
                resp = f"Aapki current speed {speed} km/h hai jo limit {limit} se {round(excess)} km/h upar hai. Throttle kam karke {ceiling} km/h par layein!"
            else:
                resp = f"You are cruising at {speed} km/h, exceeding the posted limit of {limit} km/h by +{round(excess)} km/h. Ease throttle to {ceiling} km/h."
        else:
            if is_hi:
                resp = f"Aapki speed {speed} km/h safe limit {limit} km/h ke andar chal rahi hai. All nominal boss."
            else:
                resp = f"Cruising safely at {speed} km/h within the {limit} km/h limit. Safe compliance maintained."
        return {
            "action": "reply",
            "hangup": False,
            "response_text": resp,
            "category": "speed"
        }

    # 6. Checkpoints / Progress Query
    checkpoint_patterns = [
        "checkpoint", "check point", "cp", "right way", "wrong way", "status", "performance",
        "चेकपॉइंट", "चेक पॉइंट", "चेक", "प्रोग्रेस"
    ]
    if any(w in q for w in checkpoint_patterns):
        latest_cp = session.get("latest_checkpoint")
        if latest_cp:
            cp_name = latest_cp.get("name", "Checkpoint")
            cp_spd = latest_cp.get("speed_kmh", speed)
            if latest_cp.get("is_exceeding"):
                if is_hi:
                    resp = f"Warning: {cp_name} ko {cp_spd} km/h par cross kiya tha jo ceiling se zyada tha. Yeh wrong way hai, speed control kijiye!"
                else:
                    resp = f"Warning: {cp_name} crossed at {cp_spd} km/h exceeding safe ceiling. You are doing it the wrong way, decelerate now!"
            else:
                if is_hi:
                    resp = f"{cp_name} {cp_spd} km/h par cross hua. Aap bilkul sahi tareeqe se safe pace maintain kar rahe hain (Right Way)!"
                else:
                    resp = f"{cp_name} crossed at {cp_spd} km/h. You are doing it the right way! Safe pace maintained."
        else:
            if is_hi:
                resp = f"Abhi tak koi checkpoint nahi aaya hai. Current speed {speed} km/h safe limit me hai."
            else:
                resp = f"No checkpoint crossed yet. Current cruising pace is {speed} km/h."
        return {
            "action": "reply",
            "hangup": False,
            "response_text": resp,
            "category": "checkpoints"
        }

    # 7. ETA / Distance / Trip Progress Query
    eta_patterns = [
        "eta", "time", "distance", "door", "dur", "pahunch", "reach", "destination", "kitna bacha",
        "दूरी", "दूर", "पहुंचेंगे", "पहुंच", "टाइम", "समय", "कितना बचा", "किलोमीटर", "डेस्टिनेशन"
    ]
    if any(w in q for w in eta_patterns):
        speed_ms = (speed / 3.6) if speed > 10 else (limit / 3.6)
        eta_s = int(rem_m / max(1.0, speed_ms))
        eta_mins = eta_s // 60
        eta_sec = eta_s % 60
        if is_hi:
            resp = f"{rem_km} kilometer bache hain. Destination pahunchne me lagbhag {eta_mins} minute {eta_sec} second lagenge."
        else:
            resp = f"{rem_km} kilometers remaining. Estimated time to destination is {eta_mins} minutes {eta_sec} seconds."
        return {
            "action": "reply",
            "hangup": False,
            "response_text": resp,
            "category": "trip_progress"
        }

    # 8. Default Co-pilot Briefing / Status
    if is_hi:
        resp = f"Live speed {speed} km/h, safe ceiling {ceiling} km/h hai. Agla camera {next_cam} {dist_m} meter aage hai. All systems nominal!"
    else:
        resp = f"Cruising at {speed} km/h with safe ceiling of {ceiling} km/h. Next camera at {next_cam} is {dist_m} meters ahead. All systems nominal."

    return {
        "action": "reply",
        "hangup": False,
        "response_text": resp,
        "category": "status_summary"
    }

