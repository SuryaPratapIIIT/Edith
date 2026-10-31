import React from 'react';
import { EnforcementSection, VehicleClass, VoiceLanguage } from '../types/pace';
import { EXPRESSWAY_SECTIONS } from '../data/expressways';
import { voiceCoach } from '../services/voiceCoach';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Gauge,
  Sliders,
  Car,
  Bike,
  Truck,
  Globe
} from 'lucide-react';

interface SimulationControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onReset: () => void;
  playbackSpeed: number;
  onChangePlaybackSpeed: (speed: number) => void;
  selectedSection: EnforcementSection;
  onSelectSection: (section: EnforcementSection) => void;
  availableSections?: EnforcementSection[];
  vehicleClass: VehicleClass;
  onChangeVehicleClass: (vClass: VehicleClass) => void;
  safetyMargin: number;
  onChangeSafetyMargin: (margin: number) => void;
  amberGap: number;
  onChangeAmberGap: (gap: number) => void;
  currentSpeedThrottle: number;
  onChangeSpeedThrottle: (speed: number) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  voiceLanguage: VoiceLanguage;
  onChangeVoiceLanguage: (lang: VoiceLanguage) => void;
}

export const SimulationControls: React.FC<SimulationControlsProps> = ({
  isPlaying,
  onTogglePlay,
  onReset,
  playbackSpeed,
  onChangePlaybackSpeed,
  selectedSection,
  onSelectSection,
  availableSections,
  vehicleClass,
  onChangeVehicleClass,
  safetyMargin,
  onChangeSafetyMargin,
  amberGap,
  onChangeAmberGap,
  currentSpeedThrottle,
  onChangeSpeedThrottle,
  isMuted,
  onToggleMute,
  voiceLanguage,
  onChangeVoiceLanguage
}) => {
  return (
    <div className="bg-gray-900/90 rounded-2xl border border-gray-800 shadow-2xl backdrop-blur-md p-4 flex flex-col gap-4">
      {/* Primary playback & simulation toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 pb-3">
        {/* Play / Pause / Reset buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onTogglePlay}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer ${
              isPlaying
                ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]'
            }`}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            <span>{isPlaying ? 'PAUSE REPLAY' : 'START REPLAY'}</span>
          </button>

          <button
            onClick={onReset}
            className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 transition-all cursor-pointer"
            title="Reset Simulation"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Speed Multipliers */}
          <div className="flex items-center bg-gray-950 p-1 rounded-xl border border-gray-800 text-xs font-mono">
            {[1, 2, 5, 10].map((spd) => (
              <button
                key={spd}
                onClick={() => onChangePlaybackSpeed(spd)}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  playbackSpeed === spd
                    ? 'bg-cyan-600 text-white font-bold'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>

        {/* Audio Mute & Language Selectors */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleMute}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              isMuted
                ? 'bg-red-950/40 border-red-500/40 text-red-400'
                : 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-cyan-400'
            }`}
            title={isMuted ? 'Unmute Audio Voice' : 'Mute Voice Alerts'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <div className="flex items-center bg-gray-950 px-2 py-1 rounded-xl border border-gray-800 text-xs font-mono text-gray-300 gap-1.5">
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <select
              value={voiceLanguage}
              onChange={(e) => onChangeVoiceLanguage(e.target.value as VoiceLanguage)}
              className="bg-transparent text-xs font-mono text-gray-200 border-none outline-none cursor-pointer"
            >
              <option value="hinglish" className="bg-gray-900">Hinglish</option>
              <option value="english" className="bg-gray-900">English (India)</option>
              <option value="hindi" className="bg-gray-900">Hindi</option>
            </select>
          </div>
        </div>
      </div>

      {/* Throttle slider & Interactive Live Speed Control */}
      <div className="bg-gray-950/70 p-3 rounded-xl border border-gray-800 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-1.5 text-gray-300">
            <Gauge className="w-4 h-4 text-cyan-400" />
            <span>INSTANT SPEED THROTTLE:</span>
          </div>
          <span className="font-bold text-cyan-300 text-sm">
            {currentSpeedThrottle} <span className="text-xs text-gray-400">km/h</span>
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="140"
          step="1"
          value={currentSpeedThrottle}
          onChange={(e) => onChangeSpeedThrottle(Number(e.target.value))}
          className="w-full accent-cyan-400 cursor-pointer h-2 bg-gray-800 rounded-lg"
        />
        <div className="flex justify-between text-[10px] font-mono text-gray-500">
          <span>0 km/h (Stopped / Idle)</span>
          <span className="text-emerald-400 font-semibold">90 km/h (Safe Cruise)</span>
          <span className="text-cyan-400 font-semibold">{selectedSection.limit_kmh} km/h (Limit)</span>
          <span className="text-red-400 font-semibold">140 km/h (Extreme)</span>
        </div>
      </div>

      {/* Grid of parameters: Expressway, Vehicle Class, Safety Margin */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
        {/* Expressway Section Selector */}
        <div className="bg-gray-950/70 p-2.5 rounded-xl border border-gray-800 flex flex-col gap-1.5">
          <span className="text-[10px] text-gray-400 uppercase font-semibold">
            Active Camera Section
          </span>
          <select
            value={selectedSection.id}
            onChange={(e) => {
              const list = availableSections && availableSections.length > 0 ? availableSections : EXPRESSWAY_SECTIONS;
              const sec = list.find((s) => s.id === e.target.value);
              if (sec) onSelectSection(sec);
            }}
            className="bg-gray-900 text-gray-200 border border-gray-700/80 rounded-lg p-1.5 outline-none font-mono text-xs cursor-pointer"
          >
            {(availableSections && availableSections.length > 0 ? availableSections : EXPRESSWAY_SECTIONS).map((sec, idx) => (
              <option key={sec.id} value={sec.id}>
                Section {idx + 1}: {sec.name} ({sec.limit_kmh} km/h)
              </option>
            ))}
          </select>
        </div>

        {/* Vehicle Class Selector */}
        <div className="bg-gray-950/70 p-2.5 rounded-xl border border-gray-800 flex flex-col gap-1.5">
          <span className="text-[10px] text-gray-400 uppercase font-semibold">
            Vehicle Class & Limit
          </span>
          <div className="grid grid-cols-3 gap-1 bg-gray-900 p-1 rounded-lg border border-gray-800">
            <button
              onClick={() => onChangeVehicleClass('car')}
              className={`flex items-center justify-center gap-1 py-1 rounded text-[11px] cursor-pointer transition-all ${
                vehicleClass === 'car' ? 'bg-cyan-600 text-white font-bold' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Car className="w-3 h-3" />
              <span>Car</span>
            </button>
            <button
              onClick={() => onChangeVehicleClass('bike')}
              className={`flex items-center justify-center gap-1 py-1 rounded text-[11px] cursor-pointer transition-all ${
                vehicleClass === 'bike' ? 'bg-cyan-600 text-white font-bold' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Bike className="w-3 h-3" />
              <span>Bike</span>
            </button>
            <button
              onClick={() => onChangeVehicleClass('truck')}
              className={`flex items-center justify-center gap-1 py-1 rounded text-[11px] cursor-pointer transition-all ${
                vehicleClass === 'truck' ? 'bg-cyan-600 text-white font-bold' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Truck className="w-3 h-3" />
              <span>Truck</span>
            </button>
          </div>
        </div>

        {/* Safety Margin Adjuster */}
        <div className="bg-gray-950/70 p-2.5 rounded-xl border border-gray-800 flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-400 uppercase font-semibold">
              Safety Margin:
            </span>
            <span className="font-bold text-amber-300">
              {(safetyMargin * 100).toFixed(0)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="0.10"
            step="0.01"
            value={safetyMargin}
            onChange={(e) => onChangeSafetyMargin(Number(e.target.value))}
            className="w-full accent-amber-400 cursor-pointer h-1.5 bg-gray-800 rounded-lg"
          />
          <div className="flex justify-between text-[9px] text-gray-500">
            <span>0% (Strict)</span>
            <span className="text-amber-400">4% (Recommended)</span>
            <span>10% (Ultra Safe)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
