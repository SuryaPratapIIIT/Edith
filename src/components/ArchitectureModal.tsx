import React from 'react';
import { Shield, Cpu, PhoneCall, Award, BookOpen, Layers } from 'lucide-react';

interface ArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ArchitectureModal: React.FC<ArchitectureModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-3xl bg-gray-900 border border-gray-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-gray-950 via-gray-900 to-gray-950 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-400 border border-purple-500/40 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-mono font-bold text-base text-gray-100">
                Pace Coach Architecture & 4-Sprint YC Hackathon Plan
              </h3>
              <p className="text-xs text-gray-400">
                Prescriptive pacing engine, Bolna telephony layer & India ANPR camera dataset
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

        {/* Modal content */}
        <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-5 text-xs font-mono text-gray-300">
          {/* Section 1: The Core Mathematical Algorithm */}
          <div className="bg-gray-950 p-4 rounded-2xl border border-gray-800">
            <div className="flex items-center gap-2 text-cyan-400 font-bold mb-2">
              <Cpu className="w-4 h-4" />
              <span>1. MATHEMATICAL FORMULATION & PACE ENGINE</span>
            </div>
            <div className="space-y-2 text-gray-300">
              <div className="p-2.5 rounded-xl bg-gray-900 border border-gray-800 font-mono space-y-1">
                <div>• <span className="text-gray-400">Section Distance:</span> D (meters)</div>
                <div>• <span className="text-gray-400">Posted Speed Limit:</span> V (km/h)</div>
                <div>• <span className="text-gray-400">Safety Margin:</span> m = 4% (0.04)</div>
                <div>• <span className="text-gray-400">Effective Margined Limit:</span> V' = V × (1 - m)</div>
                <div>• <span className="text-gray-400">Minimum Legal Time:</span> T_min = D / (V' / 3.6) seconds</div>
                <div>• <span className="text-gray-400">Time Budget Remaining:</span> need_s = T_min - elapsed_s</div>
                <div>• <span className="text-gray-400">Live Pace Ceiling:</span> ceiling = min(V, (remaining_m / need_s) × 3.6)</div>
                <div>• <span className="text-gray-400">Alert Classification:</span></div>
                <div className="pl-4 text-[11px] space-y-0.5">
                  <span className="text-red-400 block">- RED: speed &gt; ceiling OR speed &gt; V (Immediate warning)</span>
                  <span className="text-amber-400 block">- AMBER: speed &gt; ceiling - 5 km/h (Caution buffer)</span>
                  <span className="text-emerald-400 block">- GREEN: speed &le; ceiling - 5 km/h (Optimal pace)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: The Bolna Split */}
          <div className="bg-gray-950 p-4 rounded-2xl border border-gray-800">
            <div className="flex items-center gap-2 text-amber-400 font-bold mb-2">
              <PhoneCall className="w-4 h-4" />
              <span>2. ARCHITECTURE: THE BOLNA SPLIT</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 text-[10px]">
                    <th className="py-2 pr-3">LAYER</th>
                    <th className="py-2 px-3">HANDLES</th>
                    <th className="py-2 pl-3">WHY</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60 text-[11px]">
                  <tr>
                    <td className="py-2 pr-3 text-cyan-300 font-bold">On-device pace engine & TTS</td>
                    <td className="py-2 px-3">Real-time calculation and RED/AMBER audio alerts</td>
                    <td className="py-2 pl-3 text-gray-400">Zero latency, works 100% offline, zero phone call drop risk</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3 text-purple-300 font-bold">Bolna Voice Agent</td>
                    <td className="py-2 px-3">Pre-trip planning call, hands-free Q&A ("Mera max speed kitna?"), post-trip summary</td>
                    <td className="py-2 pl-3 text-gray-400">Natural Hindi/Hinglish conversation, telephony integration (Exotel/Plivo)</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3 text-emerald-300 font-bold">Backend & DB</td>
                    <td className="py-2 px-3">Route, gantry pairs, session state, Bolna webhooks</td>
                    <td className="py-2 pl-3 text-gray-400">Single source of truth for ANPR coordinates and e-challan metrics</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: The 4 Sprints Plan */}
          <div className="bg-gray-950 p-4 rounded-2xl border border-gray-800">
            <div className="flex items-center gap-2 text-emerald-400 font-bold mb-2">
              <Award className="w-4 h-4" />
              <span>3. THE 4 HACKATHON SPRINTS (48 HOURS)</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
              <div className="p-3 rounded-xl bg-gray-900 border border-gray-800">
                <span className="font-bold text-cyan-300 block mb-1">Sprint 1: Data & Pace Engine</span>
                <p className="text-gray-400">
                  Section tables for Bengaluru-Mysuru and Dwarka Expressways. Implemented `pace_status` with full unit test suite passing ground truth.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-gray-900 border border-gray-800">
                <span className="font-bold text-amber-300 block mb-1">Sprint 2: Live App & On-Device Voice</span>
                <p className="text-gray-400">
                  Interactive Leaflet map, geofence detection (2km and 500m pre-alerts), tachometer gauge, and Web Audio/Speech TTS synthesis in English & Hinglish.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-gray-900 border border-gray-800">
                <span className="font-bold text-purple-300 block mb-1">Sprint 3: Bolna Voice Agent</span>
                <p className="text-gray-400">
                  Bolna agent configuration with toolchain `[["transcriber", "llm", "synthesizer"]]`, Sarvam Hindi TTS, and tool `get_pace_status` integration.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-gray-900 border border-gray-800">
                <span className="font-bold text-emerald-300 block mb-1">Sprint 4: Validation & Pitch</span>
                <p className="text-gray-400">
                  7 full test suites across 28 timestamps, zero challan guarantee, live HUD simulation replay, and B2B fleet logistics angle.
                </p>
              </div>
            </div>
          </div>

          {/* Section 4: Moat & Positioning */}
          <div className="bg-gray-950 p-4 rounded-2xl border border-gray-800 flex items-center justify-between">
            <div>
              <span className="font-bold text-gray-200 block text-xs">Compliance & Safety Assistant, Not Evasion</span>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Competitors (Radarbot, TomTom) only alert near cameras. Pace Coach is the only assistant that actively prescribes the exact legal ceiling you must hold to avoid automated e-challans.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
