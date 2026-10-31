import React, { useState } from 'react';
import { bolnaService } from '../services/bolnaService';
import { PaceStatusResult } from '../types/pace';
import { Database, Server, Terminal, CheckCircle2, Copy, Check } from 'lucide-react';

interface BackendApiModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPace: PaceStatusResult;
}

export const BackendApiModal: React.FC<BackendApiModalProps> = ({
  isOpen,
  onClose,
  currentPace
}) => {
  const [activeTab, setActiveTab] = useState<'endpoints' | 'schema' | 'liveSession'>('liveSession');
  const [copiedEndpoint, setCopiedEndpoint] = useState<string | null>(null);

  if (!isOpen) return null;

  const session = bolnaService.getSession();

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedEndpoint(id);
    setTimeout(() => setCopiedEndpoint(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-3xl bg-gray-900 border border-gray-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-gray-950 via-gray-900 to-gray-950 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-mono font-bold text-base text-gray-100">
                Backend API & PostGIS Data Model (Section 10)
              </h3>
              <p className="text-xs text-gray-400">
                FastAPI / Node endpoints, SQLite / PostGIS schema, and live session state
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white flex items-center justify-center cursor-pointer transition-all"
          >
            ✕
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center border-b border-gray-800 px-4 bg-gray-950">
          <button
            onClick={() => setActiveTab('liveSession')}
            className={`px-4 py-3 text-xs font-mono font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'liveSession'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Live Session State (Active)</span>
          </button>
          <button
            onClick={() => setActiveTab('endpoints')}
            className={`px-4 py-3 text-xs font-mono font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'endpoints'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>REST API Endpoints</span>
          </button>
          <button
            onClick={() => setActiveTab('schema')}
            className={`px-4 py-3 text-xs font-mono font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'schema'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>SQL Schema (gantries, sections, sessions)</span>
          </button>
        </div>

        {/* Modal body */}
        <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-4 text-xs font-mono">
          {activeTab === 'liveSession' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>Active Session: <strong className="text-cyan-300">{session?.id}</strong></span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Synchronized with Telemetry
                </span>
              </div>

              <div className="bg-gray-950 p-4 rounded-xl border border-gray-800 text-gray-200 space-y-3">
                <div className="text-[11px] text-gray-400 font-bold uppercase tracking-wider text-cyan-400">
                  GET /api/sessions/{session?.id}/status Response Payload:
                </div>
                <pre className="text-[11px] text-cyan-300 bg-gray-900 p-3 rounded-lg border border-gray-800 overflow-x-auto leading-relaxed">
{JSON.stringify(
  {
    session_id: session?.id,
    phone: session?.phone,
    section_id: session?.sectionId,
    state: currentPace.state,
    elapsed_seconds: currentPace.elapsed_s,
    covered_meters: currentPace.covered_m,
    remaining_meters: currentPace.remaining_m,
    instant_speed_kmh: currentPace.speed_kmh,
    max_average_ceiling_kmh: currentPace.max_avg_kmh,
    current_average_kmh: currentPace.currentAvg_kmh,
    alert_level: currentPace.alert,
    checkpoint: currentPace.checkpoint,
    banked_time_seconds: currentPace.banked_time_s,
    timestamp: new Date().toISOString()
  },
  null,
  2
)}
                </pre>
              </div>

              <div className="p-3 rounded-xl bg-gray-950 border border-gray-800 text-gray-400 text-[11px] leading-relaxed">
                <strong className="text-amber-400">Bolna Tool Invocation:</strong> When the caller asks Bolna "Mera max speed kitna hona chahiye?", Bolna's LLM agent executes the `get_pace_status` tool calling this exact endpoint and speaks back the `max_average_ceiling_kmh` and `alert_level`.
              </div>
            </div>
          )}

          {activeTab === 'endpoints' && (
            <div className="flex flex-col gap-3">
              {[
                {
                  method: 'POST',
                  path: '/api/trips',
                  desc: 'Take origin, destination and vehicle class; return route geometry and enforcement sections'
                },
                {
                  method: 'POST',
                  path: '/api/sessions',
                  desc: 'Start a ride session upon crossing first gantry; return unique session id'
                },
                {
                  method: 'POST',
                  path: '/api/sessions/{id}/location',
                  desc: 'Receive latitude, longitude, timestamp and speed at 1 Hz; update covered distance'
                },
                {
                  method: 'GET',
                  path: '/api/sessions/{id}/status',
                  desc: 'Return section id, elapsed seconds, remaining meters, max_avg_kmh ceiling and alert level'
                },
                {
                  method: 'POST',
                  path: '/api/bolna/call',
                  desc: 'Trigger the pre-trip outbound call through Bolna Telephony API'
                },
                {
                  method: 'POST',
                  path: '/api/bolna/webhook',
                  desc: 'Receive Bolna execution data, transcripts, duration and telephony status (whitelisting 13.203.39.153)'
                }
              ].map((ep) => (
                <div
                  key={ep.path}
                  className="p-3 rounded-xl bg-gray-950 border border-gray-800 flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        ep.method === 'GET' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      }`}>
                        {ep.method}
                      </span>
                      <span className="font-bold text-gray-200">{ep.path}</span>
                    </div>
                    <button
                      onClick={() => copyText(`curl -X ${ep.method} https://api.pacecoach.in${ep.path}`, ep.path)}
                      className="text-gray-400 hover:text-cyan-300 cursor-pointer"
                    >
                      {copiedEndpoint === ep.path ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-gray-400 text-[11px]">{ep.desc}</p>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'schema' && (
            <div className="flex flex-col gap-3">
              <span className="text-gray-400 text-xs">
                SQLite / Postgres with PostGIS Schema (Section 10):
              </span>

              <div className="bg-gray-950 p-3 rounded-xl border border-gray-800 space-y-3">
                <div>
                  <div className="text-cyan-400 font-bold mb-1">TABLE gantries:</div>
                  <pre className="text-gray-300 text-[11px] bg-gray-900 p-2.5 rounded border border-gray-800 overflow-x-auto">
{`CREATE TABLE gantries (
  id TEXT PRIMARY KEY,
  name TEXT,
  lat REAL,
  lon REAL,
  direction TEXT,
  kind TEXT,        -- 'average', 'spot', 'display_only'
  source TEXT,
  verified_on TEXT
);`}
                  </pre>
                </div>

                <div>
                  <div className="text-amber-400 font-bold mb-1">TABLE sections:</div>
                  <pre className="text-gray-300 text-[11px] bg-gray-900 p-2.5 rounded border border-gray-800 overflow-x-auto">
{`CREATE TABLE sections (
  id TEXT PRIMARY KEY,
  start_gantry TEXT REFERENCES gantries(id),
  end_gantry TEXT REFERENCES gantries(id),
  length_m REAL,
  limit_kmh REAL,
  vehicle_class TEXT,
  lane_note TEXT,
  geometry TEXT,     -- GeoJSON / WKT polyline
  source TEXT,
  verified_on TEXT
);`}
                  </pre>
                </div>

                <div>
                  <div className="text-purple-400 font-bold mb-1">TABLE sessions:</div>
                  <pre className="text-gray-300 text-[11px] bg-gray-900 p-2.5 rounded border border-gray-800 overflow-x-auto">
{`CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  phone TEXT,
  vehicle_class TEXT,
  section_id TEXT REFERENCES sections(id),
  entered_at TEXT,
  covered_m REAL,
  last_speed_kmh REAL,
  updated_at TEXT
);`}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
