import React from 'react';
import { PlannedJourney } from '../services/journeyService';
import { SectionSummaryResult } from './JourneySectionStepper';
import { ChallanEvent } from '../types/pace';
import {
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Trophy,
  RotateCcw,
  X,
  Camera,
  Zap,
  Gauge,
  Clock,
  ShieldAlert
} from 'lucide-react';

interface JourneySummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  journey: PlannedJourney;
  sectionHistory: SectionSummaryResult[];
  challanHistory: ChallanEvent[];
  journeyElapsed_s: number;
  onReplay: () => void;
}

export const JourneySummaryModal: React.FC<JourneySummaryModalProps> = ({
  isOpen,
  onClose,
  journey,
  sectionHistory,
  challanHistory = [],
  journeyElapsed_s,
  onReplay
}) => {
  if (!isOpen) return null;

  const totalDistance_km = journey.totalDistance_m / 1000;
  // Use actual journey elapsed time if available, otherwise sum sections
  const totalElapsed_s = Math.max(
    1,
    journeyElapsed_s > 0 ? journeyElapsed_s : sectionHistory.reduce((acc, s) => acc + s.elapsed_s, 0)
  );
  const totalHours = totalElapsed_s / 3600;
  const overallAvgSpeed = totalHours > 0 ? totalDistance_km / totalHours : 0;

  // Split challans by type
  const speedChallans = challanHistory.filter(c => c.type === 'speed_challan');
  const spotChallans = challanHistory.filter(c => c.type === 'spot_challan');
  const totalChallanCount = challanHistory.length;

  const isAllClear = totalChallanCount === 0;

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = Math.round(s % 60);
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="w-full max-w-3xl bg-gray-950 border border-gray-800 rounded-3xl p-5 sm:p-7 shadow-2xl flex flex-col gap-5 relative animate-in fade-in zoom-in-95 duration-200 my-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-400 hover:text-white transition-all cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Verdict Header */}
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 border ${
            isAllClear
              ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.4)]'
              : 'bg-red-950/80 border-red-500/50 text-red-400 shadow-[0_0_25px_rgba(239,68,68,0.4)] animate-pulse'
          }`}>
            {isAllClear ? <Trophy className="w-8 h-8" /> : <ShieldAlert className="w-8 h-8" />}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase text-gray-400 tracking-wider">
                GMDA ITMS CONTINUOUS JOURNEY VERDICT
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                isAllClear
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
                  : 'bg-red-950 text-red-300 border-red-500/40'
              }`}>
                {isAllClear ? 'PASSED · ZERO RISK' : `FLAGGED · ${totalChallanCount} CHALLAN RISKS`}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black font-mono text-white mt-0.5">
              {isAllClear ? '100% CHALLAN-FREE JOURNEY CLEARED!' : `CHALLAN RISKS DETECTED · ${totalChallanCount} VIOLATIONS IN REGION`}
            </h2>
            <p className="text-xs font-mono text-gray-400 mt-0.5">
              {journey.origin.name} → {journey.destination.name}
            </p>
          </div>
        </div>

        {/* Primary High-Level Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="bg-gray-900/90 rounded-2xl p-3 border border-gray-800 flex flex-col">
            <span className="text-[10px] font-mono text-gray-500 uppercase flex items-center gap-1">
              🛣️ Road Distance
            </span>
            <span className="text-lg font-black font-mono text-cyan-300 mt-0.5">
              {totalDistance_km.toFixed(1)} km
            </span>
            <span className="text-[9px] font-mono text-gray-500">
              +{journey.detourPct}% curvature
            </span>
          </div>

          <div className="bg-gray-900/90 rounded-2xl p-3 border border-gray-800 flex flex-col">
            <span className="text-[10px] font-mono text-gray-500 uppercase flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-400" /> Trip Duration
            </span>
            <span className="text-lg font-black font-mono text-amber-300 mt-0.5">
              {formatTime(totalElapsed_s)}
            </span>
            <span className="text-[9px] font-mono text-gray-500">
              {journey.cameras.length} cameras passed
            </span>
          </div>

          <div className="bg-gray-900/90 rounded-2xl p-3 border border-gray-800 flex flex-col">
            <span className="text-[10px] font-mono text-gray-500 uppercase flex items-center gap-1">
              <Gauge className="w-3 h-3 text-blue-400" /> Overall Avg
            </span>
            <span className="text-lg font-black font-mono text-blue-300 mt-0.5">
              {overallAvgSpeed.toFixed(1)} km/h
            </span>
            <span className="text-[9px] font-mono text-gray-500">
              Across full journey
            </span>
          </div>

          <div className="bg-gray-900/90 rounded-2xl p-3 border border-gray-800 flex flex-col">
            <span className="text-[10px] font-mono text-gray-500 uppercase flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 text-red-400" /> Challan Risk
            </span>
            <span className={`text-lg font-black font-mono mt-0.5 ${isAllClear ? 'text-emerald-400' : 'text-red-400'}`}>
              {isAllClear ? 'ZERO RISK' : `${totalChallanCount} RISKS`}
            </span>
            <span className="text-[9px] font-mono text-gray-500">
              {spotChallans.length} Spot · {speedChallans.length} Speed
            </span>
          </div>
        </div>

        {/* 2 Dedicated Challan Risk Breakdown Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Card 1: Speed Challan (Average Speed between 2 cameras) */}
          <div className="bg-gray-900/95 border border-gray-800 rounded-2xl p-3.5 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-orange-950/80 border border-orange-500/40 flex items-center justify-center text-orange-400">
                  <Clock className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-mono font-bold text-gray-200">
                  1. Speed Challans (Average Speed Risk)
                </span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                speedChallans.length === 0
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                  : 'bg-red-950 text-red-400 border border-red-500/40'
              }`}>
                {speedChallans.length === 0 ? '✓ Zero Risk (Safe)' : `🚨 High Risk (${speedChallans.length} Violation(s))`}
              </span>
            </div>
            <p className="text-[11px] font-mono text-gray-400 leading-snug">
              Risk of average speed challan in this corridor measured across physical road distance between two consecutive camera gantries.
            </p>

            {speedChallans.length === 0 ? (
              <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-2.5 flex items-center gap-2 text-emerald-400 text-xs font-mono">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>All camera enforcement zones traversed legally below posted limits.</span>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto">
                {speedChallans.map((c, i) => (
                  <div key={i} className="bg-red-950/30 border border-red-500/30 rounded-xl p-2 flex items-center justify-between text-xs font-mono">
                    <div>
                      <div className="font-bold text-red-200 truncate">{c.sectionName || c.cameraName}</div>
                      <div className="text-[10px] text-red-400">
                        Avg: <span className="font-bold">{c.recordedSpeed_kmh} km/h</span> (Limit: {c.limit_kmh} km/h) · +{c.excessSpeed_kmh} km/h over
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-red-900/60 text-red-200 font-bold text-[10px] border border-red-500/40">
                      High Challan Risk
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card 2: Spot Challan (Instantaneous Speed Camera Radar) */}
          <div className="bg-gray-900/95 border border-gray-800 rounded-2xl p-3.5 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-red-950/80 border border-red-500/40 flex items-center justify-center text-red-400">
                  <Zap className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-mono font-bold text-gray-200">
                  2. Spot Challans (Instant Camera Risk)
                </span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                spotChallans.length === 0
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                  : 'bg-red-950 text-red-400 border border-red-500/40'
              }`}>
                {spotChallans.length === 0 ? '✓ Zero Risk (Safe)' : `🚨 High Risk (${spotChallans.length} Violation(s))`}
              </span>
            </div>
            <p className="text-[11px] font-mono text-gray-400 leading-snug">
              Risk of instant camera radar challan in this spot if vehicle speed exceeds limit while passing any camera gantry.
            </p>

            {spotChallans.length === 0 ? (
              <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-2.5 flex items-center gap-2 text-emerald-400 text-xs font-mono">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>Vehicle crossed all camera gantries below instantaneous speed limits.</span>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto">
                {spotChallans.map((c, i) => (
                  <div key={i} className="bg-red-950/30 border border-red-500/30 rounded-xl p-2 flex items-center justify-between text-xs font-mono">
                    <div>
                      <div className="font-bold text-red-200 truncate">{c.cameraName}</div>
                      <div className="text-[10px] text-red-400">
                        Crossing Speed: <span className="font-bold">{c.recordedSpeed_kmh} km/h</span> (Limit: {c.limit_kmh} km/h) · +{c.excessSpeed_kmh} km/h over
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-red-900/60 text-red-200 font-bold text-[10px] border border-red-500/40">
                      High Challan Risk
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Breakdown of Every Traversed Camera-to-Camera Section */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-gray-300 uppercase flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-cyan-400" />
              Sectional Enforcement Results ({sectionHistory.length} Traversed Sections)
            </span>
            <span className="text-[10px] font-mono text-gray-500">
              {journey.cameras.length} Cameras Intersected
            </span>
          </div>

          <div className="max-h-48 overflow-y-auto pr-1 flex flex-col gap-2">
            {sectionHistory.length === 0 ? (
              <div className="bg-gray-900/60 rounded-xl p-3 border border-gray-800 text-xs font-mono text-gray-400 text-center">
                No intermediate camera enforcement zones along this route stretch.
              </div>
            ) : (
              sectionHistory.map((s, idx) => (
                <div
                  key={idx}
                  className={`rounded-xl p-3 border flex items-center justify-between gap-3 text-xs font-mono transition-all ${
                    s.hasViolation
                      ? 'bg-red-950/20 border-red-500/40'
                      : 'bg-gray-900/80 border-gray-800/80'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      s.hasViolation
                        ? 'bg-red-950 text-red-400 border border-red-500/50'
                        : 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                    }`}>
                      {s.hasViolation ? (
                        <Zap className="w-3.5 h-3.5" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-gray-200 truncate">{s.name}</div>
                      <div className="text-[10px] text-gray-400">
                        {(s.length_m / 1000).toFixed(2)} km · {Math.round(s.elapsed_s)}s · Limit: {s.limit_kmh} km/h
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className={`font-bold ${s.hasViolation ? 'text-red-400' : 'text-emerald-400'}`}>
                      Avg: {s.avgSpeed_kmh} km/h
                    </div>
                    <div className="text-[10px]">
                      {s.hasViolation ? (
                        <span className="text-red-400 font-bold">High Challan Risk</span>
                      ) : (
                        <span className="text-emerald-400">✓ Legal & Safe</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-300 hover:text-white font-mono text-xs font-semibold cursor-pointer transition-all"
          >
            Close Summary
          </button>
          <button
            onClick={() => {
              onClose();
              onReplay();
            }}
            className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold flex items-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Replay Full Journey</span>
          </button>
        </div>
      </div>
    </div>
  );
};
