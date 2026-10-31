import React from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Crosshair,
  Gauge,
  Navigation,
  Globe
} from 'lucide-react';
import { VoiceLanguage } from '../types/pace';

interface GoogleMapsBottomBarProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onReset: () => void;
  playbackSpeed: number;
  onChangePlaybackSpeed: (speed: number) => void;
  currentSpeedThrottle: number;
  onChangeSpeedThrottle: (speed: number) => void;
  postedLimit: number;
  remainingDistance_m: number;
  totalDistance_m: number;
  straightDisplacement_m?: number;
  detourPct?: number;
  elapsed_s: number;
  destinationName: string;
  isMuted: boolean;
  onToggleMute: () => void;
  voiceLanguage: VoiceLanguage;
  onChangeVoiceLanguage: (lang: VoiceLanguage) => void;
  isFollowingVehicle: boolean;
  onToggleFollow: () => void;
}

export const GoogleMapsBottomBar: React.FC<GoogleMapsBottomBarProps> = ({
  isPlaying,
  onTogglePlay,
  onReset,
  playbackSpeed,
  onChangePlaybackSpeed,
  currentSpeedThrottle,
  onChangeSpeedThrottle,
  postedLimit,
  remainingDistance_m,
  totalDistance_m,
  straightDisplacement_m,
  detourPct,
  elapsed_s,
  destinationName,
  isMuted,
  onToggleMute,
  voiceLanguage,
  onChangeVoiceLanguage,
  isFollowingVehicle,
  onToggleFollow
}) => {
  // Estimate remaining travel time in minutes based on current speed or posted limit
  const effSpeed_mps = currentSpeedThrottle > 0 ? currentSpeedThrottle / 3.6 : (postedLimit * 0.7) / 3.6;
  const remainingSeconds = remainingDistance_m / Math.max(1, effSpeed_mps);
  const remainingMinutes = Math.max(1, Math.ceil(remainingSeconds / 60));

  // Projected arrival time
  const arrivalTime = new Date(Date.now() + remainingSeconds * 1000).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="w-full bg-gray-950/95 backdrop-blur-xl border border-gray-800 rounded-2xl shadow-2xl p-4 flex flex-col gap-3 font-mono">
      {/* Top Row: Navigation Trip Metrics & Playback Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-gray-800/80 pb-3">
        {/* Left: Google Maps ETA & Road Network Distance */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-400">
                {remainingMinutes} min
              </span>
              <span className="text-xs text-gray-200 font-bold bg-gray-900 px-2 py-0.5 rounded-lg border border-gray-800 flex items-center gap-1">
                🛣️ {(remainingDistance_m / 1000).toFixed(1)} km road distance left
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-gray-400 flex-wrap">
              <span>ETA {arrivalTime}</span>
              <span>•</span>
              <span className="text-emerald-300 font-semibold">Real Road Curve ∫ds</span>
              {straightDisplacement_m !== undefined && detourPct !== undefined && (
                <>
                  <span>•</span>
                  <span className="text-gray-400 hidden sm:inline">
                    Chord Disp: {(straightDisplacement_m / 1000).toFixed(1)} km (+{detourPct}% Road Detour)
                  </span>
                </>
              )}
              <span>•</span>
              <span className="text-gray-300 truncate max-w-[200px]">To {destinationName}</span>
            </div>
          </div>
        </div>

        {/* Center/Right: Play / Pause, Multipliers & Vehicle Follow Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Follow Vehicle Camera Button */}
          <button
            onClick={onToggleFollow}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
              isFollowingVehicle
                ? 'bg-cyan-950/80 border-cyan-400/80 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white'
            }`}
            title="Toggle smooth Google Maps vehicle tracking"
          >
            <Crosshair className={`w-3.5 h-3.5 ${isFollowingVehicle ? 'text-cyan-400 animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isFollowingVehicle ? 'Tracking Car' : 'Free Map'}</span>
          </button>

          {/* Start / Pause Button */}
          <button
            onClick={onTogglePlay}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-lg ${
              isPlaying
                ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]'
            }`}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            <span>{isPlaying ? 'PAUSE DRIVE' : 'DRIVE / REPLAY'}</span>
          </button>

          {/* Reset Trip */}
          <button
            onClick={onReset}
            className="p-2 rounded-xl bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white border border-gray-800 transition-all cursor-pointer"
            title="Reset Journey to Start"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Speed Multipliers */}
          <div className="flex items-center bg-gray-900 p-1 rounded-xl border border-gray-800 text-xs">
            {[1, 2, 5, 10].map((spd) => (
              <button
                key={spd}
                onClick={() => onChangePlaybackSpeed(spd)}
                className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
                  playbackSpeed === spd
                    ? 'bg-cyan-600 text-white font-bold'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>

          {/* Audio Controls */}
          <div className="flex items-center gap-1.5 bg-gray-900 px-2 py-1.5 rounded-xl border border-gray-800">
            <button
              onClick={onToggleMute}
              className={`p-1 rounded-lg transition-all cursor-pointer ${
                isMuted ? 'text-red-400' : 'text-cyan-400 hover:text-white'
              }`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>

            <select
              value={voiceLanguage}
              onChange={(e) => onChangeVoiceLanguage(e.target.value as VoiceLanguage)}
              className="bg-transparent text-[11px] text-gray-300 outline-none cursor-pointer border-none"
            >
              <option value="hinglish" className="bg-gray-900">Hinglish</option>
              <option value="english" className="bg-gray-900">English</option>
              <option value="hindi" className="bg-gray-900">Hindi</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bottom Row: Instant Real-Time Speed Throttle Slider */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-gray-400">
            <Gauge className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-semibold uppercase text-[10px]">VEHICLE SPEED THROTTLE:</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-400">
              Drag to accelerate or brake in real-time:
            </span>
            <span className="font-black text-cyan-300 text-sm">
              {currentSpeedThrottle} <span className="text-[10px] text-gray-400">km/h</span>
            </span>
          </div>
        </div>

        <input
          type="range"
          min="0"
          max="140"
          step="1"
          value={currentSpeedThrottle}
          onChange={(e) => onChangeSpeedThrottle(Number(e.target.value))}
          className="w-full accent-cyan-400 cursor-pointer h-2 bg-gray-900 rounded-lg"
        />

        <div className="flex justify-between text-[9px] text-gray-500">
          <span>0 km/h (Stopped / Idle)</span>
          <span className="text-emerald-400 font-bold">60 km/h (Cruise)</span>
          <span className="text-cyan-400 font-bold">{postedLimit} km/h (Legal Limit)</span>
          <span className="text-red-400 font-bold">140 km/h (Violation Risk)</span>
        </div>
      </div>
    </div>
  );
};

