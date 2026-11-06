import React, { useState, useEffect } from 'react';
import { PlannedJourney, CameraEnforcementZone, RouteCameraSpot } from '../services/journeyService';
import { BolnaTelemetryContext, bolnaVoiceService } from '../services/bolnaVoiceService';
import { CallState } from '@bolna/web-call';
import { AlertLevel, ChallanEvent } from '../types/pace';
import {
  CornerUpRight,
  Mic,
  Search,
  Pause,
  Play,
  Volume2,
  VolumeX,
  Navigation as NavigationArrow,
  X,
  GitFork,
  Radio,
  Wifi,
  BatteryMedium
} from 'lucide-react';

interface ActiveTripViewProps {
  journey: PlannedJourney;
  currentSpeed: number;
  postedLimit: number;
  ceilingSpeed: number | null;
  alert: AlertLevel;
  activeZone: CameraEnforcementZone | null;
  activeCheckpointIndex: number | null;
  nextCamera: RouteCameraSpot | null;
  distToNextCamera_m: number;
  distToDestination_m: number;
  journeyCovered_m: number;
  journeyElapsed_s: number;
  challanHistory: ChallanEvent[];
  isPlaying: boolean;
  isMuted: boolean;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onCenterVehicle: () => void;
  onStopTrip: () => void;
  onOpenRoutePlanner: () => void;
  bolnaTelemetryContext: BolnaTelemetryContext;
  onOpenReport?: () => void;
}

export const ActiveTripView: React.FC<ActiveTripViewProps> = ({
  journey,
  currentSpeed,
  postedLimit,
  ceilingSpeed,
  alert: _alert,
  activeZone,
  activeCheckpointIndex = 1,
  nextCamera,
  distToNextCamera_m,
  distToDestination_m,
  journeyCovered_m: _journeyCovered_m,
  journeyElapsed_s: _journeyElapsed_s,
  challanHistory,
  isPlaying,
  isMuted,
  onTogglePlay,
  onToggleMute,
  onCenterVehicle,
  onStopTrip,
  onOpenRoutePlanner,
  bolnaTelemetryContext,
  onOpenReport
}) => {
  // Bolna FRIDAY Voice Call state
  const [callState, setCallState] = useState<CallState>('idle');
  useEffect(() => {
    const unsub = bolnaVoiceService.subscribeState((st) => setCallState(st));
    return unsub;
  }, []);

  const handleToggleFridayCall = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (callState === 'active' || callState === 'connecting' || callState === 'ringing') {
      await bolnaVoiceService.stopCall();
    } else {
      await bolnaVoiceService.startCall(bolnaTelemetryContext);
    }
  };

  const isFridayActive = callState === 'active';
  const isFridayConnecting = callState === 'connecting' || callState === 'ringing';

  // Live spoken text subscription from Bolna Voice AI Agent
  const [latestSpeech, setLatestSpeech] = useState<string | null>(null);
  useEffect(() => {
    const unsub = bolnaVoiceService.subscribeSpeech((text) => {
      setLatestSpeech(text);
    });
    return unsub;
  }, []);

  // Calculate ETA for bottom sheet
  const effSpeed_mps = currentSpeed > 0 ? currentSpeed / 3.6 : (postedLimit * 0.7) / 3.6;
  const remainingSeconds = distToDestination_m / Math.max(1, effSpeed_mps);
  const remainingMinutes = Math.max(1, Math.ceil(remainingSeconds / 60));
  const remainingMiles = (distToDestination_m / 1609.34).toFixed(1);

  const [arrivalTime, setArrivalTime] = useState<string>('11:00 AM');
  useEffect(() => {
    const timer = setTimeout(() => {
      const d = new Date(Date.now() + remainingSeconds * 1000);
      setArrivalTime(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 0);
    return () => clearTimeout(timer);
  }, [remainingSeconds]);

  // Maneuver title & zone specs
  const nextTargetName = activeZone
    ? activeZone.name.split('→')[0].trim()
    : nextCamera
    ? nextCamera.name
    : journey.destination?.name || 'Shankar Chowk';
  const targetDistanceMiles = ((distToNextCamera_m > 0 ? distToNextCamera_m : 320) / 1609.34).toFixed(1);

  const nameParts = nextTargetName.includes('(')
    ? [nextTargetName.split('(')[0].trim(), `(${nextTargetName.split('(')[1]}`]
    : [nextTargetName, ''];

  const cpNum = activeCheckpointIndex || 1;
  const zoneLengthKm = activeZone ? (activeZone.length_m / 1000).toFixed(2) : '3.35';
  const displayCeiling = ceilingSpeed !== null ? ceilingSpeed.toFixed(1) : (postedLimit - 2.8).toFixed(1);

  // Dynamic Bolna Coach bubble message
  const bolnaCoachMessage =
    currentSpeed > (ceilingSpeed || postedLimit)
      ? `Slow down to < ${Math.round(ceilingSpeed || postedLimit)} km/h. Banked deficit!`
      : currentSpeed > (ceilingSpeed || postedLimit) - 5
      ? `Pace steady. Safe ceiling is ${Math.round(ceilingSpeed || postedLimit)} km/h.`
      : `ANPR Trap. Keep speed < ${postedLimit} km/h`;

  return (
    <div className="relative w-full max-w-[420px] mx-auto min-h-[820px] flex flex-col justify-between select-none pointer-events-none p-3 sm:p-4">
      {/* 1. Top Section: Status Bar + Sticky Navigation Card + Floating Bolna Bubble */}
      <div className="pointer-events-auto flex flex-col gap-2.5">
        {/* Smartphone Status Bar (11:00, Signal, Battery) */}
        <div className="flex items-center justify-between px-3 text-white text-xs font-semibold drop-shadow-md">
          <span>11:00</span>
          <div className="flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5" />
            <Wifi className="w-3.5 h-3.5" />
            <BatteryMedium className="w-4 h-4" />
          </div>
        </div>

        {/* Top Navigation Card (Deep Navy/Teal Card with Right Turn Arrow) */}
        <div className="bg-[#092847] rounded-[28px] p-4 shadow-2xl border border-[#164372]/60 flex flex-col gap-2.5">
          <div className="flex items-start justify-between">
            {/* Left: Right-Turn Arrow + Distance + Destination Text */}
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <CornerUpRight className="w-10 h-10 text-white stroke-[2.5]" />
                <span className="text-white text-lg font-black tracking-tight leading-tight mt-0.5">
                  {targetDistanceMiles} mi
                </span>
              </div>

              <div className="flex flex-col pt-0.5">
                <span className="text-white text-xl font-bold leading-tight">
                  {nameParts[0]}
                </span>
                {nameParts[1] ? (
                  <span className="text-white text-xl font-bold leading-tight">
                    {nameParts[1]}
                  </span>
                ) : null}
              </div>
            </div>

            {/* Right: FRIDAY Bolna Voice AI Square Button */}
            <button
              onClick={handleToggleFridayCall}
              title={isFridayActive ? 'Click to disconnect FRIDAY call' : 'Click to talk with FRIDAY Voice AI'}
              className={`w-20 h-20 rounded-2xl flex flex-col items-center justify-between p-2 text-white font-mono cursor-pointer transition-all shadow-md flex-shrink-0 ${
                isFridayActive
                  ? 'bg-gradient-to-b from-emerald-600 to-teal-700 border border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.5)]'
                  : isFridayConnecting
                  ? 'bg-amber-600 animate-pulse border border-amber-400'
                  : 'bg-[#165bb6] hover:bg-blue-600 border border-blue-400/50'
              }`}
            >
              <span className="text-[10px] font-bold tracking-wider uppercase">
                {isFridayActive ? 'ONLINE' : 'FRIDAY'}
              </span>

              {/* Waveform graphic */}
              <div className="flex items-end gap-1 h-6 px-1 my-auto">
                <span className={`w-1 bg-white rounded-full transition-all ${isFridayActive ? 'h-5 animate-pulse' : 'h-3'}`} />
                <span className={`w-1 bg-white rounded-full transition-all ${isFridayActive ? 'h-6 animate-pulse' : 'h-5'}`} />
                <span className={`w-1 bg-white rounded-full transition-all ${isFridayActive ? 'h-4 animate-pulse' : 'h-2'}`} />
                <span className={`w-1 bg-white rounded-full transition-all ${isFridayActive ? 'h-5 animate-pulse' : 'h-4'}`} />
              </div>

              <span className="text-[8px] font-extrabold tracking-tight text-center leading-tight">
                {isFridayActive ? 'CONNECTED' : isFridayConnecting ? 'CONNECTING...' : 'TALK TO FRIDAY'}
              </span>
            </button>
          </div>

          {/* Attached Bottom Strip: ANPR Speed Trap Active Banner */}
          <div className="bg-[#051324] rounded-xl py-1.5 px-3 flex items-center gap-2 text-xs font-semibold text-gray-200">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
            <span className="truncate">
              ANPR SPEED TRAP ACTIVE • Checkpoint {cpNum} of 4 ({cpNum * 25}%) • {zoneLengthKm} km Zone
            </span>
          </div>
        </div>

        {/* Floating Bolna AI Speech Bubble (Top Left) */}
        <div className="self-start bg-[#1d6ee5] text-white rounded-xl py-2 px-3.5 shadow-lg flex items-center gap-2 max-w-[310px] animate-fade-in border border-blue-300/30">
          <Mic className="w-4 h-4 text-white flex-shrink-0 animate-pulse" />
          <span className="text-xs font-semibold leading-snug">
            BOLNA AI: "{latestSpeech || bolnaCoachMessage}"
          </span>
        </div>
      </div>

      {/* 2. Middle Section: Floating Action Stack (Right Edge) */}
      <div className="pointer-events-auto self-end flex flex-col gap-3 mr-1 -mt-8">
        {/* Search floating action button */}
        <button
          onClick={onOpenRoutePlanner}
          title="Search destinations & routes"
          className="w-11 h-11 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white flex items-center justify-center shadow-lg hover:bg-black/80 cursor-pointer transition-all active:scale-95"
        >
          <Search className="w-5 h-5" />
        </button>

        {/* Play / Pause simulation floating action button */}
        <button
          onClick={onTogglePlay}
          title={isPlaying ? 'Pause simulation' : 'Start simulation'}
          className="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center shadow-2xl hover:bg-gray-100 cursor-pointer transition-all active:scale-95"
        >
          {isPlaying ? (
            <Pause className="w-5 h-5 fill-black stroke-black" />
          ) : (
            <Play className="w-5 h-5 fill-black stroke-black ml-0.5" />
          )}
        </button>

        {/* Speaker / Mute floating action button */}
        <button
          onClick={onToggleMute}
          title={isMuted ? 'Unmute voice co-pilot' : 'Mute voice co-pilot'}
          className="w-11 h-11 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white flex items-center justify-center shadow-lg hover:bg-black/80 cursor-pointer transition-all active:scale-95"
        >
          {isMuted ? <VolumeX className="w-5 h-5 text-red-300" /> : <Volume2 className="w-5 h-5" />}
        </button>
      </div>

      {/* 3. Bottom HUD Section (Above Bottom Sheet) */}
      <div className="pointer-events-auto flex flex-col gap-2 mt-auto">
        {/* Row of HUD Gauges: Left Speedometers + Center Vehicle Arrow + Right Pace Box */}
        <div className="flex items-end justify-between gap-2 px-1">
          {/* Bottom Left: Dual Gauges (Current Speed Square + Red Ring Limit Circle) */}
          <div className="flex items-center gap-1.5">
            {/* White rounded square: Live Speed */}
            <div className="w-14 h-14 bg-white rounded-2xl shadow-2xl flex flex-col items-center justify-center text-black border border-gray-100">
              <span className="text-xl font-black leading-none">
                {Math.round(currentSpeed)}
              </span>
              <span className="text-[10px] font-bold text-gray-700 leading-tight">
                km/h
              </span>
            </div>

            {/* White circle with thick red border: Posted Limit */}
            <div className="w-14 h-14 bg-white border-[3.5px] border-[#d93025] rounded-full shadow-2xl flex flex-col items-center justify-center text-black">
              <span className="text-lg font-black leading-none">
                {postedLimit}
              </span>
              <span className="text-[8px] font-black text-[#d93025] uppercase tracking-tight leading-tight">
                LIMIT
              </span>
            </div>
          </div>

          {/* Bottom Center: Vehicle Marker & Center Vehicle Pill */}
          <div className="flex flex-col items-center gap-1">
            <div className="w-16 h-12 bg-white/90 backdrop-blur-md rounded-full shadow-2xl flex items-center justify-center border border-white">
              <NavigationArrow className="w-7 h-7 text-[#1a73e8] fill-[#1a73e8]" />
            </div>

            <button
              onClick={onCenterVehicle}
              className="bg-[#1a73e8] hover:bg-blue-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md cursor-pointer transition-all"
            >
              Center Vehicle
            </button>
          </div>

          {/* Bottom Right: Dynamic Speed Pace Card */}
          <div
            onClick={onOpenReport}
            className="bg-[#082245] border border-blue-500/50 rounded-2xl p-2.5 shadow-2xl flex flex-col items-end cursor-pointer hover:border-blue-400 transition-colors"
          >
            <span className="text-[9px] font-bold tracking-wider text-blue-300 uppercase">
              SPEED TO MAINTAIN
            </span>
            <span className="text-xl font-black text-cyan-300 leading-tight">
              {displayCeiling} <span className="text-xs font-semibold text-gray-300">km/h</span>
            </span>
            <span className="text-[9px] text-gray-400 text-right leading-tight mt-0.5">
              Max avg for remaining section
            </span>
            <span className="text-[9px] text-emerald-400 font-semibold text-right">
              • {challanHistory.length} Challans • Clean Pace
            </span>
          </div>
        </div>

        {/* Banner above Bottom Sheet: ANPR Speed Trap Active Strip */}
        <div className="bg-[#051324] rounded-xl py-1.5 px-3 flex items-center gap-2 text-xs font-semibold text-gray-200 shadow-md">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
          <span className="truncate">
            ANPR SPEED TRAP ACTIVE • Checkpoint ({cpNum} of 4) • {zoneLengthKm} km Zone
          </span>
        </div>

        {/* 4. Bottom Navigation Sheet (Fixed White Card with Rounded Top Corners) */}
        <div className="bg-white text-gray-900 rounded-t-[32px] p-4 shadow-[0_-10px_35px_rgba(0,0,0,0.5)] flex flex-col gap-1">
          {/* Drag handle */}
          <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-1" />

          <div className="flex items-center justify-between">
            {/* Left Close Button (Cancels Navigation -> returns to Route Planning) */}
            <button
              onClick={onStopTrip}
              title="End navigation and return to route planning"
              className="w-12 h-12 rounded-full border border-gray-200 bg-white hover:bg-gray-100 flex items-center justify-center text-gray-600 cursor-pointer shadow-sm transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Center: ETA & Distance (Orange Large Text) */}
            <div className="flex flex-col items-center">
              <span className="text-2xl font-black text-[#e8710a] leading-none">
                {remainingMinutes} min
              </span>
              <span className="text-xs text-gray-500 font-medium mt-1">
                {remainingMiles} mi • {arrivalTime}
              </span>
            </div>

            {/* Right: Route Fork Button (Opens Route Planner) */}
            <button
              onClick={onOpenRoutePlanner}
              title="Change route / view alternative paths"
              className="w-12 h-12 rounded-full border border-gray-200 bg-white hover:bg-gray-100 flex items-center justify-center text-[#1a73e8] cursor-pointer shadow-sm transition-all"
            >
              <GitFork className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
