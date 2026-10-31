import React, { useState } from 'react';
import { bolnaService } from '../services/bolnaService';
import { BolnaCallLog, PaceStatusResult } from '../types/pace';
import { voiceCoach } from '../services/voiceCoach';
import {
  Phone,
  PhoneCall,
  PhoneOff,
  Mic,
  MessageSquare,
  Code,
  Copy,
  Check,
  Radio,
  Shield,
  Volume2
} from 'lucide-react';

interface BolnaPhoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPace: PaceStatusResult;
  sectionName: string;
  postedLimit: number;
  effectiveLimit: number;
}

export const BolnaPhoneModal: React.FC<BolnaPhoneModalProps> = ({
  isOpen,
  onClose,
  currentPace,
  sectionName,
  postedLimit,
  effectiveLimit
}) => {
  const [activeTab, setActiveTab] = useState<'phone' | 'config' | 'logs'>('phone');
  const [isCalling, setIsCalling] = useState<boolean>(false);
  const [currentCallType, setCurrentCallType] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [logs, setLogs] = useState<BolnaCallLog[]>(bolnaService.getCallLogs());

  if (!isOpen) return null;

  const agentConfig = bolnaService.getAgentPayload();

  const handlePreTripCall = () => {
    setIsCalling(true);
    setCurrentCallType('Pre-Trip Briefing');
    voiceCoach.playAlertChime('pre_alert');

    setTimeout(() => {
      const log = bolnaService.simulatePreTripCall(sectionName, postedLimit, effectiveLimit);
      setLogs([...bolnaService.getCallLogs()]);
      setIsCalling(false);
      voiceCoach.speak(
        `Namaste! Main Pace hoon. Bangalore Mysore Expressway par Ramanagara se Channapatna section active hai. Safe limit ${effectiveLimit} km/h hai. ANPR dono taraf active hai. Safe ride ke liye all the best!`,
        true
      );
    }, 1200);
  };

  const handlePaceQuery = () => {
    setIsCalling(true);
    setCurrentCallType('Hands-Free Pace Query');
    voiceCoach.playAlertChime('amber');

    setTimeout(() => {
      const log = bolnaService.simulatePaceQuery(currentPace);
      setLogs([...bolnaService.getCallLogs()]);
      setIsCalling(false);

      if (currentPace.state === 'done') {
        voiceCoach.speak(
          `Aapka enforcement section complete ho chuka hai! Aapka average speed ${currentPace.currentAvg_kmh} km/h raha. Zero challan!`,
          true
        );
      } else if (currentPace.alert === 'red') {
        voiceCoach.speak(
          `Dhyan deinge! Aapki speed ${Math.round(currentPace.speed_kmh)} km/h hai. Alert level RED hai! Challan se bachne ke liye maximum ${currentPace.max_avg_kmh} km/h par chalna hoga.`,
          true
        );
      } else {
        voiceCoach.speak(
          `Aapka pace bilkul green hai. Safe speed ceiling ${currentPace.max_avg_kmh} km/h hai. Bilkul safe!`,
          true
        );
      }
    }, 1000);
  };

  const handlePostTripCall = () => {
    setIsCalling(true);
    setCurrentCallType('Post-Trip Summary');
    voiceCoach.playAlertChime('green');

    setTimeout(() => {
      const isLegal = currentPace.currentAvg_kmh <= effectiveLimit;
      const log = bolnaService.simulatePostTripCall(
        currentPace.currentAvg_kmh || 92.3,
        currentPace.elapsed_s || 780,
        20.0,
        isLegal
      );
      setLogs([...bolnaService.getCallLogs()]);
      setIsCalling(false);

      voiceCoach.speak(
        `Badhai ho! Aapne 20 km section 13 minute mein complete kiya. Final average speed legal limit ke andar hai. ZERO CHALLAN! Shandaar compliance.`,
        true
      );
    }, 1200);
  };

  const copyConfig = () => {
    navigator.clipboard.writeText(JSON.stringify(agentConfig, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl bg-gray-900 border border-gray-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-gray-950 via-gray-900 to-gray-950 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center">
              <PhoneCall className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-mono font-bold text-base text-gray-100">
                  Bolna AI Voice Telephony Agent
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  V2 AGENT ONLINE
                </span>
              </div>
              <p className="text-xs text-gray-400">
                The conversational layer: Hinglish phone calls + real-time backend tool calling
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
            onClick={() => setActiveTab('phone')}
            className={`px-4 py-3 text-xs font-mono font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'phone'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Phone className="w-3.5 h-3.5" />
            <span>Interactive Phone Simulator</span>
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-3 text-xs font-mono font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'logs'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Call Transcripts ({logs.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`px-4 py-3 text-xs font-mono font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'config'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>Bolna Agent API Spec (JSON)</span>
          </button>
        </div>

        {/* Modal body */}
        <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-4">
          {activeTab === 'phone' && (
            <div className="flex flex-col md:flex-row gap-5 items-center justify-center">
              {/* Phone Device Mockup */}
              <div className="w-72 bg-gray-950 border-4 border-gray-800 rounded-[38px] p-4 shadow-2xl flex flex-col items-center gap-4 relative">
                {/* Speaker pill */}
                <div className="w-16 h-2 bg-gray-800 rounded-full" />

                {/* Call status banner */}
                <div className="flex flex-col items-center mt-2">
                  <div className="w-16 h-16 rounded-full bg-cyan-900/40 border-2 border-cyan-400 text-cyan-300 flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.4)]">
                    <Radio className="w-8 h-8 animate-pulse" />
                  </div>
                  <span className="font-mono font-bold text-sm text-gray-200 mt-2">
                    PACE COACH (BOLNA)
                  </span>
                  <span className="text-[11px] font-mono text-cyan-400">
                    {isCalling ? `Calling (${currentCallType})...` : '+91 98765 43210 (Verified)'}
                  </span>
                </div>

                {/* Simulated conversation wave */}
                <div className="w-full h-12 bg-gray-900/80 rounded-xl border border-gray-800 flex items-center justify-center gap-1 px-3">
                  {[40, 75, 55, 90, 30, 85, 60, 45, 95, 70, 50, 80].map((h, i) => (
                    <div
                      key={i}
                      className={`w-1 rounded-full ${
                        isCalling ? 'bg-cyan-400 animate-pulse' : 'bg-gray-700'
                      }`}
                      style={{ height: `${isCalling ? h : 20}%` }}
                    />
                  ))}
                </div>

                {/* Dial action triggers */}
                <div className="w-full flex flex-col gap-2 mt-2">
                  <button
                    disabled={isCalling}
                    onClick={handlePreTripCall}
                    className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-mono text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>1. Pre-Trip Briefing Call</span>
                  </button>

                  <button
                    disabled={isCalling}
                    onClick={handlePaceQuery}
                    className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-mono text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span>2. "Mera max speed kitna?"</span>
                  </button>

                  <button
                    disabled={isCalling}
                    onClick={handlePostTripCall}
                    className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-mono text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>3. Post-Trip Audit Call</span>
                  </button>
                </div>

                <div className="text-[10px] text-gray-500 font-mono text-center">
                  Telephony: Exotel / Plivo • STT & TTS: Sarvam / ElevenLabs
                </div>
              </div>

              {/* Architecture Context info */}
              <div className="flex-1 flex flex-col gap-3">
                <div className="bg-gray-950 p-4 rounded-2xl border border-gray-800">
                  <h4 className="font-mono font-bold text-xs text-cyan-300 uppercase tracking-wider mb-1">
                    The Bolna Telephony Architecture Split
                  </h4>
                  <p className="text-xs text-gray-300 leading-relaxed">
                    Bolna handles the conversational phone layer: pre-trip planning, hands-free speed questions, and post-trip summaries in Hindi/Hinglish.
                  </p>
                  <div className="mt-3 p-3 rounded-xl bg-gray-900 border border-gray-800 text-[11px] font-mono text-gray-300 space-y-1.5">
                    <div className="text-emerald-400 font-bold">✓ Safety alert rule:</div>
                    <p className="text-gray-400">
                      The safety-critical RED/AMBER alert stays on-device (zero latency, offline capable). Phone telephony is reserved for natural conversation.
                    </p>
                  </div>
                </div>

                {/* Live Tool Calling Inspection */}
                <div className="bg-gray-950 p-4 rounded-2xl border border-gray-800">
                  <h4 className="font-mono font-bold text-xs text-amber-300 uppercase tracking-wider mb-2">
                    Active Function Tool: get_pace_status
                  </h4>
                  <div className="text-xs font-mono bg-gray-900 p-2.5 rounded-xl border border-gray-800 text-gray-300 space-y-1">
                    <div><span className="text-gray-500">Target:</span> GET /api/sessions/sess-8821/status</div>
                    <div><span className="text-gray-500">Live Return:</span> ceiling: <strong className="text-amber-400">{currentPace.max_avg_kmh} km/h</strong>, alert: <strong className="text-cyan-400">{currentPace.alert}</strong></div>
                    <div><span className="text-gray-500">Remaining:</span> {(currentPace.remaining_m / 1000).toFixed(1)} km, need: {currentPace.need_s}s</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-gray-300 uppercase">
                  Bolna Call Execution Logs
                </span>
                <span className="text-xs text-gray-400 font-mono">
                  Webhook IP Whitelist: 13.203.39.153
                </span>
              </div>

              {logs.length === 0 ? (
                <div className="p-8 text-center text-xs font-mono text-gray-500 bg-gray-950 rounded-xl border border-gray-800">
                  No calls simulated yet. Click one of the buttons on the Phone tab to initiate a Bolna call.
                </div>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3.5 rounded-xl bg-gray-950 border border-gray-800 flex flex-col gap-2 font-mono text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-900/50 text-cyan-300 border border-cyan-500/30 uppercase">
                          {log.type.replace('_', ' ')}
                        </span>
                        <span className="text-gray-400 text-[11px]">{log.timestamp}</span>
                      </div>
                      <span className="text-emerald-400 text-[10px] font-bold uppercase">
                        COMPLETED (200 OK)
                      </span>
                    </div>

                    <div className="bg-gray-900 p-2.5 rounded-lg border border-gray-800 text-gray-200 whitespace-pre-wrap leading-relaxed text-[11px]">
                      {log.transcript}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-gray-500 pt-1">
                      <span>Direction: {log.direction}</span>
                      <span>Audio synthesized: Sarvam Bulbul / ElevenLabs</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'config' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-gray-400">
                  POST https://api.bolna.ai/v2/agent (Bearer BOLNA_API_KEY)
                </span>
                <button
                  onClick={copyConfig}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-mono text-cyan-300 border border-gray-700 cursor-pointer transition-all"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy JSON'}</span>
                </button>
              </div>

              <pre className="bg-gray-950 p-4 rounded-xl border border-gray-800 text-[11px] font-mono text-cyan-300/90 overflow-x-auto max-h-96 leading-relaxed">
                {JSON.stringify(agentConfig, null, 2)}
              </pre>

              <div className="p-3 rounded-xl bg-gray-950 border border-gray-800 text-xs font-mono text-gray-400 flex items-center justify-between">
                <span>Webhook Security:</span>
                <span className="text-emerald-400 font-bold">IP 13.203.39.153 whitelisted</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
