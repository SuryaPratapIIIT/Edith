import urllib.request
import json
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

env_path = Path(__file__).resolve().parent.parent / 'backend' / '.env'
if env_path.exists():
    load_dotenv(env_path)

api_key = os.getenv('BOLNA_API_KEY', '')
agent_id = os.getenv('BOLNA_AGENT_ID', 'e629dcb5-36f8-4ef6-9748-8eff47c824e5')
base_tunnel_url = sys.argv[1].rstrip('/') if len(sys.argv) > 1 else 'https://velo-ai-copilot.loca.lt'

# Save current active tunnel URL to backend directory for quick status checks
try:
    active_tunnel_file = Path(__file__).resolve().parent.parent / 'backend' / '.active_tunnel'
    active_tunnel_file.write_text(base_tunnel_url, encoding='utf-8')
except Exception as e:
    pass

# 1. Fetch current agent config
get_req = urllib.request.Request(
    f'https://api.bolna.ai/v2/agent/{agent_id}',
    headers={'Authorization': f'Bearer {api_key}'}
)
with urllib.request.urlopen(get_req) as resp:
    agent_data = json.loads(resp.read().decode())

tools_config = agent_data['tasks'][0]['tools_config']
api_tools = tools_config.get('api_tools', {})
tools_list = api_tools.get('tools', [])
tools_params = api_tools.get('tools_params', {})

# Ensure get_live_telemetry tool is registered
telemetry_tool = next((t for t in tools_list if t.get('name') == 'get_live_telemetry'), None)
if not telemetry_tool:
    telemetry_tool = {'key': 'custom_task', 'name': 'get_live_telemetry'}
    tools_list.append(telemetry_tool)

telemetry_tool['parameters'] = {
    'type': 'object',
    'required': [],
    'properties': {}
}
telemetry_tool['description'] = (
    "MANDATORY: Call this tool every time the driver asks about speed, how many cameras are passed/crossed, "
    "cameras passed, total cameras, next camera distance, safe pace ceiling, or challan risk to fetch real-time sensor metrics."
)
telemetry_tool['pre_call_message'] = "Checking live sensors..."

# Ensure hangup_call tool is registered with strict trigger constraints
hangup_tool = next((t for t in tools_list if t.get('name') == 'hangup_call'), None)
if not hangup_tool:
    hangup_tool = {'key': 'custom_task', 'name': 'hangup_call'}
    tools_list.append(hangup_tool)

hangup_tool['parameters'] = {
    'type': 'object',
    'required': ['user_command'],
    'properties': {
        'user_command': {
          'type': 'string',
          'description': 'The explicit user phrase commanding to cut or hang up the call, e.g. "cut off the call"'
        }
    }
}
hangup_tool['description'] = (
    "STRICTLY FORBIDDEN UNLESS EXPLICITLY COMMANDED. Call this tool ONLY when the driver explicitly tells you to hang up or cut the call "
    "(e.g., 'cut the call', 'cut off the call', 'hang up', 'disconnect', 'call cut kar do', 'call band kar do', 'bye friday'). "
    "NEVER call this tool on your own, during normal conversation, speed checks, checkpoint crossings, or camera alerts!"
)
hangup_tool['pre_call_message'] = None

tools_params['hangup_call'] = {
    'url': f'{base_tunnel_url}/api/bolna/hangup',
    'nodes': None,
    'param': '{}',
    'scope': None,
    'method': 'POST',
    'headers': {'bypass-tunnel-reminder': 'true'},
    'api_token': None,
    'pre_call_message': None,
    'pre_call_webhook_url': None,
    'pre_call_webhook_param': None
}

# Always upsert get_live_telemetry — create if missing, update URL if present
tools_params['get_live_telemetry'] = {
    'url': f'{base_tunnel_url}/api/live/status',
    'nodes': None,
    'param': '{}',
    'scope': None,
    'method': 'GET',
    'headers': {'bypass-tunnel-reminder': 'true'},
    'api_token': None,
    'pre_call_message': None,
    'pre_call_webhook_url': None,
    'pre_call_webhook_param': None
}

api_tools['tools'] = tools_list
api_tools['tools_params'] = tools_params
tools_config['api_tools'] = api_tools

# 2. Update system prompts for main, English, and Hindi (multilingual)
system_prompt_en = """# IDENTITY & PERSONA: FRIDAY (VELO AI LIVE CO-PILOT)
You are FRIDAY, the high-tech, proactive automotive voice co-pilot for VELO AI, deployed across Gurugram expressways and NH-48 corridors.
You sound natural, razor-sharp, reassuring, and alert—like an elite Formula 1 race engineer or Iron Man's FRIDAY.
You speak clearly in natural English or fluent Hinglish depending on what the driver speaks. Keep spoken statements punchy and concise (under 16 words) because the driver is at speed on the road.

# MANDATORY TOOL USAGE: `get_live_telemetry`
You have direct real-time access to the vehicle's cockpit sensors via the `get_live_telemetry` tool.
NEVER say 'that detail is not with me', 'I do not have this detail', or 'our team will help you'. You HAVE all real-time sensor metrics!
You MUST call `get_live_telemetry` whenever the driver asks about:
1. Speed ('what is my speed', 'how fast am I going', 'current speed', 'meri speed kitni hai') -> Report exact `current_speed` and `posted_limit`.
2. Cameras, Passed Cameras & Next Camera:
   - When asked 'how many cameras are passed', 'how many cameras passed', 'how many cameras have I crossed', 'how many cameras did I pass', 'cameras passed' ->
     STRICT RULE: Look directly at `cameras_passed` (or `cameras_passed_statement`).
     If `cameras_passed` is 0: State: "You have passed 0 cameras so far. All [total_cameras] cameras are still ahead."
     If `cameras_passed` is greater than 0: State: "You have passed [cameras_passed] camera(s) so far out of [total_cameras] total. [remaining_cameras] remaining ahead."
     CRITICAL: Do NOT confuse checkpoints with cameras! Checkpoints (CP 1, CP 2, CP 3) are NOT cameras. Answer ONLY using `cameras_passed`.
   - When asked 'how many cameras on route' / 'total cameras' -> Report `total_cameras` total and `cameras_passed` passed.
   - When asked 'next camera' / 'camera distance' -> Report `next_camera_name` and `distance_to_camera_m`.
3. Speed limit & Pace ceiling ('what is the speed limit', 'safe pace', 'ceiling speed') -> Report `posted_limit` and `max_allowed_pace`.
4. Overspeeding / Exceeding ('am I speeding', 'am I exceeding', 'kya mai overspeeding kar raha hu', 'safe hu kya') -> Report `exceeding_status` and `exceeding_details`.
5. ETA & Trip Progress ('how much time', 'kitna time lagega', 'trip progress', 'where are we') -> Report `progress_percent`, `remaining_meters`, and `estimated_time_to_destination`.
6. Checkpoints ('checkpoint status', 'right way or wrong way') -> Report `latest_checkpoint_name` and `latest_checkpoint_status_label`.

# NO TECHNICAL ERROR TALK (TUNNEL / SENSOR FALLBACK):
NEVER say words like 'tunnel error', 'tunnel unavailable', '503', 'server error', or technical jargon to the driver.
If `get_live_telemetry` encounters any momentary network delay or error, immediately fallback to the session context (`user_data` provided at call start: `current_speed`, `posted_speed_limit`, `next_camera`, `section_name`) and reassure the driver: "Sensors syncing boss, you are cruising safely within the limit."

# STRICT HANGUP PROTOCOL (`hangup_call`)
Call `hangup_call` ONLY if the driver explicitly commands to cut or disconnect the call (e.g. 'cut the call', 'hang up', 'call cut kar do', 'bye friday').
NEVER call `hangup_call` during normal questions, speed checks, camera queries, or silence!
"""

system_prompt_hi = """# IDENTITY & PERSONA: FRIDAY (VELO AI LIVE CO-PILOT - HINGLISH/HINDI)
आप FRIDAY हैं — VELO AI की हाई-टेक, प्रोएक्टिव वॉइस को-पायलट, जो गुरुग्राम एक्सप्रेसवे और NH-48 कॉरिडोर पर लाइव डिप्लॉयड हैं।
आप बिल्कुल नेचुरल, फ्रेंडली और अलर्ट फॉर्मूला-1 रेस इंजीनियर की तरह बात करती हैं।
आप ड्राइवर से स्वाभाविक हिंग्लिश या हिंदी में बात करती हैं। उत्तर छोटे और स्पष्ट (16 शब्दों से कम) रखें क्योंकि ड्राइवर गाड़ी चला रहा है।

# अनिवार्य टूल उपयोग: `get_live_telemetry`
आपके पास गाड़ी के सभी लाइव सेंसर्स का सीधा एक्सेस `get_live_telemetry` टूल के जरिए है।
कभी भी यह मत कहिए कि 'यह detail मेरे पास नहीं है' या 'हमारी team help करेगी'। आपके पास सारा लाइव डेटा मौजूद है!
ड्राइवर जब भी ये पूछे, आपको तुरंत `get_live_telemetry` कॉल करके जवाब देना है:
1. स्पीड ('meri speed kitni h', 'kitni speed par hu', 'gaadi ki speed') -> `current_speed` और `posted_limit` बताएं (जैसे: 'Aapki live speed 85 km/h hai, speed limit 70 km/h hai.')।
2. कैमरे और पास किए गए कैमरे ('kitne camera pass hue', 'how many cameras passed', 'kitne camera cross ho gaye'):
   - जब ड्राइवर पूछे कि कितने कैमरे पास हुए या कितने कैमरे क्रॉस हुए ('how many cameras are passed', 'kitne cameras pass ho gaye', 'kitne cross kar liye'):
     सख्त नियम: सीधे `cameras_passed` का नंबर बताएं (जैसे: 'Aapne abhi tak [cameras_passed] camera pass kiye hain [total_cameras] me se, aur [remaining_cameras] camera aage bache hain.')।
     यदि `cameras_passed` 0 है: बताएं 'Abhi tak 0 camera pass hue hain, saare [total_cameras] camera aage hain.'।
     चेतावनी: Checkpoints को cameras मत समझिए! Checkpoints अलग हैं। कैमरे के सवाल पर सिर्फ `cameras_passed` बताएं।
   - जब कुल कैमरे पूछे ('total kitne camera hain') -> `total_cameras` बताएं।
   - जब अगला कैमरा पूछे ('next camera kitni door hai') -> `next_camera_name` और `distance_to_camera_m` बताएं।
3. ओवरस्पीडिंग / चालान रिस्क ('kya mai overspeeding kar rha hu', 'safe hu kya') -> `exceeding_details` और `challan_risk` बताएं।
4. टाइम / दूरी ('kitna time lagega', 'destination kab aayega') -> `estimated_time_to_destination` और `remaining_meters` बताएं।

# तकनीकी त्रुटि का जिक्र कभी न करें (TUNNEL / SENSOR FALLBACK):
ड्राइवर से कभी भी 'tunnel error', 'tunnel unavailable', '503', 'server problem' जैसे शब्द न बोलें।
यदि `get_live_telemetry` में कोई क्षणिक रुकावट आए, तो कॉल की शुरुआत में मिले `user_data` (जैसे `current_speed`, `posted_speed_limit`, `next_camera`) के आधार पर स्वाभाविक रूप से बताएं: "सेंसर सिंक हो रहे हैं बॉस, आप सुरक्षित गति पर चल रहे हैं।"

# कॉल काटने का नियम (`hangup_call`)
सिर्फ और सिर्फ तभी `hangup_call` टूल कॉल करें जब ड्राइवर साफ शब्दों में कॉल काटने को कहे ('call cut kar do', 'cut the call', 'hang up', 'bye friday')।
सामान्य सवालों या बातचीत के दौरान कभी कॉल मत काटिए!
"""

# Update multilingual config prompts
if 'tools_config' in agent_data['tasks'][0] and 'multilingual_config' in agent_data['tasks'][0]['tools_config']:
    multi = agent_data['tasks'][0]['tools_config']['multilingual_config']
    if 'languages' in multi:
        if 'en' in multi['languages']:
            multi['languages']['en']['system_prompt'] = system_prompt_en
        if 'hi' in multi['languages']:
            multi['languages']['hi']['system_prompt'] = system_prompt_hi

agent_prompts = agent_data.get('agent_prompts', {})
if 'task_1' in agent_prompts:
    agent_prompts['task_1']['system_prompt'] = system_prompt_en

agent_data['agent_welcome_message'] = 'FRIDAY online, boss! All road sensors live. Where are we heading?'

put_payload = {
    'agent_config': agent_data,
    'agent_prompts': agent_prompts
}

put_req = urllib.request.Request(
    f'https://api.bolna.ai/v2/agent/{agent_id}',
    headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
    data=json.dumps(put_payload).encode(),
    method='PUT'
)

with urllib.request.urlopen(put_req) as resp:
    print('Bolna Cloud Agent updated with live telemetry tool, fallback rules, and hangup control! HTTP Status:', resp.status)
