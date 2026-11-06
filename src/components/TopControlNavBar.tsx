import React from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Gauge,
  Navigation,
  Radio,
  MapPin,
  ChevronDown,
  ChevronUp,
  Sliders
} from 'lucide-react';

interface TopControlNavBarProps {
  currentScreen: 'planning' | 'navigation';
  onChangeScreen: (screen: 'planning' | 'navigation') => void;
  currentSpeedThrottle: number;
  onChangeSpeedThrottle: (speed: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onReset: () => void;
  playbackSpeed: number;
  onChangePlaybackSpeed: (speed: number) => void;
  trackingMode: 'simulated' | 'live_gps';
  onToggleTrackingMode: (mode: 'simulated' | 'live_gps') => void;
  tunnelOnline: boolean | null;
  postedLimit: number;
  ceilingSpeed: number | null;
}

export const TopControlNavBar: React.FC<TopControlNavBarProps> = ({
  currentScreen,
  onChangeScreen,
  currentSpeedThrottle,
  onChangeSpeedThrottle,
  isPlaying,
  onTogglePlay,
  onReset,
  playbackSpeed,
  onChangePlaybackSpeed,
  trackingMode,
  onToggleTrackingMode,
  tunnelOnline,
  postedLimit,
  ceilingSpeed
}) => {
  const [isExpanded, setIsExpanded] = React.useState<boolean>(false);

  const handleStepSpeed = (delta: number) => {
    onChangeSpeedThrottle(Math.max(0, Math.min(140, currentSpeedThrottle + delta)));
  };

  return (
    <div className="w-full bg-[#071324] border-b border-[#14325a] shadow-xl z-50 text-white font-mono text-xs select-none">
      {/* Main Slim Strip */}
      <div className="max-w-7xl mx-auto px-3 py-2 flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
        {/* Left: Screen Switcher Tabs */}
        <div className="flex items-center gap-1.5 bg-[#0a1f3d] p-1 rounded-xl border border-[#1b437a]">
          <button
            onClick={() => onChangeScreen('planning')}
            className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              currentScreen === 'planning'
                ? 'bg-[#1a73e8] text-white shadow-md'
                : 'text-gray-300 hover:text-white'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>1. Plan Route</span>
          </button>

          <button
            onClick={() => onChangeScreen('navigation')}
            className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              currentScreen === 'navigation'
                ? 'bg-[#1a73e8] text-white shadow-md'
                : 'text-gray-300 hover:text-white'
            }`}
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>2. Trip & FRIDAY</span>
          </button>
        </div>

        {/* Center: Vehicle Speed Adjuster Bar */}
        <div className="flex items-center gap-2 bg-[#0a1f3d] px-2.5 py-1 rounded-xl border border-[#1b437a]">
          <Gauge className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-gray-400 font-semibold hidden md:inline">Throttle:</span>

          <button
            onClick={() => handleStepSpeed(-5)}
            title="Decrease 5 km/h"
            className="w-5 h-5 rounded bg-[#102a50] hover:bg-[#163a70] text-cyan-300 border border-[#1b437a] flex items-center justify-center font-bold cursor-pointer"
          >
            -
          </button>

          <input
            type="range"
            min="0"
            max="140"
            step="1"
            value={currentSpeedThrottle}
            onChange={(e) => onChangeSpeedThrottle(Number(e.target.value))}
            className="w-20 sm:w-28 accent-[#1a73e8] cursor-pointer"
            title={`Adjust vehicle speed (${currentSpeedThrottle} km/h)`}
          />

          <button
            onClick={() => handleStepSpeed(5)}
            title="Increase 5 km/h"
            className="w-5 h-5 rounded bg-[#102a50] hover:bg-[#163a70] text-cyan-300 border border-[#1b437a] flex items-center justify-center font-bold cursor-pointer"
          >
            +
          </button>

          <span className="font-black text-cyan-300 w-14 text-right">
            {Math.round(currentSpeedThrottle)} <span className="text-[10px] text-gray-400">km/h</span>
          </span>
        </div>

        {/* Right: Simulation Controls & Expansion Toggle */}
        <div className="flex items-center gap-2">
          {/* Play / Pause */}
          <button
            onClick={onTogglePlay}
            className={`px-2.5 py-1 rounded-lg border font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
              isPlaying
                ? 'bg-amber-950/80 border-amber-500/60 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                : 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300 hover:bg-emerald-900 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
            }`}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? 'STOP' : 'START'}</span>
          </button>

          {/* Reset */}
          <button
            onClick={onReset}
            title="Reset trip to starting position"
            className="p-1.5 rounded-lg bg-[#0a1f3d] hover:bg-[#14325a] text-gray-300 border border-[#1b437a] cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Toggle More Controls */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Collapse advanced controls' : 'Expand speed multipliers & GPS options'}
            className="p-1.5 rounded-lg bg-[#0a1f3d] hover:bg-[#14325a] text-cyan-400 border border-[#1b437a] cursor-pointer flex items-center gap-1"
          >
            <Sliders className="w-3.5 h-3.5" />
            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Expanded Advanced Controls Drawer */}
      {isExpanded && (
        <div className="bg-[#050e1a] border-t border-[#14325a] px-4 py-2.5 flex items-center justify-between gap-4 flex-wrap animate-fade-in text-[11px]">
          {/* Multiplier buttons */}
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Replay Speed:</span>
            {[1, 2, 5].map((spd) => (
              <button
                key={spd}
                onClick={() => onChangePlaybackSpeed(spd)}
                className={`px-2 py-0.5 rounded border cursor-pointer font-bold ${
                  playbackSpeed === spd
                    ? 'bg-[#1a73e8] border-[#1a73e8] text-white'
                    : 'bg-[#0a1f3d] border-[#1b437a] text-gray-300 hover:text-white'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>

          {/* Tracking Mode */}
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Driver Mode:</span>
            <button
              onClick={() => onToggleTrackingMode('simulated')}
              className={`px-2 py-0.5 rounded border cursor-pointer font-bold ${
                trackingMode === 'simulated'
                  ? 'bg-cyan-950 border-cyan-500/70 text-cyan-300'
                  : 'bg-[#0a1f3d] border-[#1b437a] text-gray-400'
              }`}
            >
              Simulated Replay
            </button>
            <button
              onClick={() => onToggleTrackingMode('live_gps')}
              className={`px-2 py-0.5 rounded border cursor-pointer font-bold flex items-center gap-1 ${
                trackingMode === 'live_gps'
                  ? 'bg-emerald-950 border-emerald-500/70 text-emerald-300'
                  : 'bg-[#0a1f3d] border-[#1b437a] text-gray-400'
              }`}
            >
              <Radio className="w-3 h-3" />
              Device GPS
            </button>
          </div>

          {/* Real-time Math Summary */}
          <div className="flex items-center gap-3 text-gray-300">
            <span>Posted Limit: <strong className="text-white">{postedLimit} km/h</strong></span>
            <span>•</span>
            <span>Ceiling: <strong className="text-cyan-300">{ceilingSpeed !== null ? `${Math.round(ceilingSpeed)} km/h` : `${postedLimit} km/h`}</strong></span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${tunnelOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span>{tunnelOnline ? 'TUNNEL OK' : 'TUNNEL SYNCING'}</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
