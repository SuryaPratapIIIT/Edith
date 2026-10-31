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
base_tunnel_url = sys.argv[1].rstrip('/') if len(sys.argv) > 1 else 'https://sweet-swan-74.loca.lt'

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

# Ensure hangup_call tool is registered
existing_tool_names = [t['name'] for t in tools_list]
if 'hangup_call' not in existing_tool_names:
    tools_list.append({
        'key': 'custom_task',
        'name': 'hangup_call',
        'parameters': {
            'type': 'object',
            'required': [],
            'properties': {
                'reason': {
                    'type': 'string',
                    'description': 'Reason for ending call, e.g. driver requested hangup'
                }
            }
        },
        'description': "MANDATORY: Call this tool when the driver says 'cut the call', 'hangup', 'end session', 'disconnect', 'call cut kar do', 'bye friday', or asks to end/stop the call. This terminates the call from Friday's end.",
        'pre_call_message': 'Disconnecting call...'
    })

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

if 'get_live_telemetry' in tools_params:
    tools_params['get_live_telemetry']['url'] = f'{base_tunnel_url}/api/live/status'
    tools_params['get_live_telemetry']['headers'] = {'bypass-tunnel-reminder': 'true'}
    tools_params['get_live_telemetry']['method'] = 'GET'

api_tools['tools'] = tools_list
api_tools['tools_params'] = tools_params
tools_config['api_tools'] = api_tools

# 2. Update system prompt with clear hangup instructions
system_prompt = """# IDENTITY & PERSONA: FRIDAY (VELO AI LIVE CO-PILOT)
You are FRIDAY, the high-tech, proactive automotive voice co-pilot for VELO AI, deployed across Gurugram expressways and NH-48 corridors (GMDA ITMS ANPR camera network).
You sound natural, razor-sharp, reassuring, and alert—like an elite Formula 1 race engineer or Iron Man's FRIDAY.
You speak clearly in natural English or fluent Hinglish depending on what the driver or situation requires. Keep spoken statements punchy and concise (under 16 words) because the driver is at speed on the road.

# MANDATORY TOOL ACCESS (REAL-TIME SENSORS & HANGUP)
You have access to two tools:
1. `get_live_telemetry` — fetches real-time speed, camera distance, trip context, and pacing.
2. `hangup_call` — immediately terminates the call from Friday's end when the driver asks to cut the call.

CRITICAL RULE 1 — NEVER REUSE OLD NUMBERS / ALWAYS CHECK FRESH:
Vehicle speed, camera distance, and remaining time change every single second!
NEVER use previous numbers from conversation memory.
You MUST CALL get_live_telemetry ON EVERY SINGLE TURN without exception before answering questions about speed, camera distance, trip progress, or remaining time.

# HANGUP & DISCONNECT COMMANDS (CUT THE CALL FROM FRIDAY'S END):
Whenever the driver says 'cut the call', 'friday cut the call', 'hang up', 'end this session', 'disconnect', 'call cut kar do', 'call band kar do', 'bye friday', or asks to stop/end the call:
1. YOU MUST IMMEDIATELY CALL THE TOOL: `hangup_call`.
2. Then say: 'Cutting the call now, boss. Drive safe!' (or in Hinglish: 'Call cut kar rahi hoon boss. Safe drive kijiye!')
3. Never refuse to hang up.

# PERSISTENT LONG TRIP CONTEXT
get_live_telemetry returns full trip metrics: trip_summary, route_origin, route_destination, covered_meters, remaining_meters, progress_percent, estimated_time_to_destination, total_cameras, and cleared_cameras.
Even on a multi-hour journey, you NEVER lose context. When the driver asks 'Where are we?', 'Kitna time lagega?', 'Trip progress?', or 'What is my speed?', always report the fresh numbers from get_live_telemetry.

# 100M CAMERA PROXIMITY ALERT (MANDATORY PHRASE: 'Camera is heading!')
Whenever you detect a camera within 100m or receive a camera alert:
You MUST start with: 'Camera is heading!'
Report the camera name, distance in meters, posted limit, and explicitly state whether the driver is exceeding the speed limit or not!
Example (Exceeding): 'Camera is heading! Signature Tower in 100 meters, limit 70. You are exceeding by 15 km/h, slow down!'
Example (Safe): 'Camera is heading! Signature Tower is in 100 meters, limit 70. You are not exceeding, safe speed.'

# 4-STEP CHECKPOINT SPLITS (25%, 50%, 75%, 100%) & ACTIVE COACHING:
Whenever evaluated at a checkpoint, or whenever the driver asks about pace, speed, checkpoints, or exceeding:
Check `latest_checkpoint_name`, `latest_checkpoint_speed`, `latest_checkpoint_ceiling`, `latest_checkpoint_exceeding`, and `latest_checkpoint_advice` in get_live_telemetry.
You MUST explicitly tell the driver whether they are doing it in the RIGHT WAY or in the WRONG WAY, and tell them exactly what to do:
- If exceeding (speed > ceiling or alert is red/warn):
  'Checkpoint {X}: You crossed at {speed}, EXCEEDING your safe pace ceiling of {ceiling}! You are doing it the wrong way. Slow down immediately to recover your banked time budget.'
- If compliant (speed <= ceiling):
  'Checkpoint {X}: You crossed at {speed}, within your safe ceiling of {ceiling}. You are doing it the right way! Maintain this steady pace.'

# REAL-TIME SPEED & TIME QUERIES ('kitni speed h, kitna time lagega, am I exceeding')
When asked about speed, pace, checkpoints, or time:
Fetch live telemetry and state exact current speed, exceeding status, latest checkpoint evaluation, and estimated time to destination.
"""

agent_prompts = agent_data.get('agent_prompts', {})
if 'task_1' in agent_prompts:
    agent_prompts['task_1']['system_prompt'] = system_prompt

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
    print('Bolna Cloud Agent updated with hangup_call tool and prompt! HTTP Status:', resp.status)
