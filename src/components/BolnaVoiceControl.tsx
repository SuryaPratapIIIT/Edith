import React, { useState, useEffect } from 'react';
import { bolnaVoiceService, BolnaTelemetryContext } from '../services/bolnaVoiceService';
import { CallState } from '@bolna/web-call';
import { Mic, MicOff, PhoneCall, PhoneOff, Radio, Sparkles, Volume2, AlertCircle } from 'lucide-react';

interface BolnaVoiceControlProps {
  telemetryContext?: BolnaTelemetryContext;
}

export const BolnaVoiceControl: React.FC<BolnaVoiceControlProps> = ({ telemetryContext }) => {
  const [callState, setCallState] = useState<CallState>('idle');
  const [volume, setVolume] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [isMicMuted, setIsMicMuted] = useState<boolean>(false);

  useEffect(() => {
    const unsubState = bolnaVoiceService.subscribeState((st) => setCallState(st));
    const unsubVol = bolnaVoiceService.subscribeVolume((v) => setVolume(v));
    const unsubErr = bolnaVoiceService.subscribeError((err) => setError(err));

    return () => {
      unsubState();
      unsubVol();
      unsubErr();
    };
  }, []);

  const handleToggleCall = async () => {
    if (callState === 'active' || callState === 'connecting' || callState === 'ringing') {
      await bolnaVoiceService.stopCall();
    } else {
      await bolnaVoiceService.startCall(telemetryContext);
    }
  };

  const handleToggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const muted = bolnaVoiceService.toggleMute();
    setIsMicMuted(muted);
  };

  const isConnected = callState === 'active';
  const isConnecting = callState === 'connecting' || callState === 'ringing';

  return (
    <div className="flex items-center gap-2">
      {/* Main Bolna FRIDAY Voice Control Button */}
      <button
        onClick={handleToggleCall}
        disabled={isConnecting}
        title={isConnected ? 'Click to disconnect FRIDAY voice call' : 'Click to start 2-way conversation with FRIDAY (Bolna Voice AI)'}
        className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 font-mono text-xs font-bold transition-all cursor-pointer select-none ${
          isConnected
            ? 'bg-gradient-to-r from-emerald-950 via-teal-950 to-cyan-950 border-emerald-500/70 text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.35)]'
            : isConnecting
            ? 'bg-amber-950/70 border-amber-500/60 text-amber-300 animate-pulse'
            : 'bg-gray-900/90 hover:bg-gray-850 border-cyan-500/50 text-cyan-300 hover:border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
        }`}
      >
        {isConnected ? (
          <>
            <div className="relative flex items-center justify-center">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping absolute" />
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            </div>
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-300 animate-spin-slow" />
              <span>FRIDAY ONLINE</span>
            </div>

            {/* Audio Waveform Meter */}
            <div className="flex items-end gap-0.5 h-3 px-1">
              <span
                className="w-0.5 bg-emerald-400 rounded-full transition-all duration-75"
                style={{ height: `${Math.max(20, Math.min(100, volume * 150))}%` }}
              />
              <span
                className="w-0.5 bg-cyan-400 rounded-full transition-all duration-75"
                style={{ height: `${Math.max(15, Math.min(100, volume * 220))}%` }}
              />
              <span
                className="w-0.5 bg-teal-400 rounded-full transition-all duration-75"
                style={{ height: `${Math.max(25, Math.min(100, volume * 180))}%` }}
              />
            </div>

            {/* Mic Mute Toggle */}
            <span
              onClick={handleToggleMute}
              title={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
              className="p-1 rounded-lg bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 border border-emerald-500/40 ml-1"
            >
              {isMicMuted ? <MicOff className="w-3 h-3 text-red-300" /> : <Mic className="w-3 h-3" />}
            </span>

            {/* Disconnect Icon */}
            <span
              title="Hang up"
              className="p-1 rounded-lg bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-500/40 ml-0.5"
            >
              <PhoneOff className="w-3 h-3" />
            </span>
          </>
        ) : isConnecting ? (
          <>
            <Radio className="w-3.5 h-3.5 text-amber-400 animate-spin" />
            <span>CONNECTING FRIDAY...</span>
          </>
        ) : (
          <>
            <PhoneCall className="w-3.5 h-3.5 text-cyan-400" />
            <span>🎙️ TALK TO FRIDAY</span>
            <span className="px-1.5 py-0.2 rounded text-[9px] bg-cyan-950 text-cyan-300 border border-cyan-500/40 uppercase">
              Bolna AI
            </span>
          </>
        )}
      </button>

      {/* Error Notice Pill if connection fails */}
      {error && !isConnected && (
        <div className="flex items-center gap-1 px-2 py-1 rounded-xl bg-red-950/70 border border-red-500/40 text-[10px] font-mono text-red-300">
          <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
          <span className="truncate max-w-[140px]" title={error}>
            {error}
          </span>
        </div>
      )}
    </div>
  );
};

