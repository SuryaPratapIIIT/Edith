/**
 * CheckpointTracker — Road-Distance-Based 4-Checkpoint Warning Display
 *
 * Shows the 4 quarter-distance checkpoints along the enforcement section.
 * When covered_m crosses each threshold, a contextual warning card pops up
 * with the EXACT calculated ceiling speed the rider must stay under.
 *
 * CP-1 @ 25%  →  Early calibration
 * CP-2 @ 50%  →  Midway reassessment
 * CP-3 @ 75%  →  Pace recovery / lock-in
 * CP-4 @ 100% →  Exit gantry — legal verdict
 */

import React, { useEffect, useRef, useState } from 'react';
import { AlertLevel, PaceStatusResult } from '../types/pace';
import {
  CheckCircle2,
  Flag,
  Radio,
  AlertTriangle,
  Zap,
  Timer,
  TrendingDown,
  TrendingUp,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import {
  CheckpointWarning,
  CheckpointIndex,
  URGENCY_COLORS,
  WarningUrgency,
} from '../engine/warningEngine';

interface CheckpointTrackerProps {
  pace: PaceStatusResult;
  sectionDistance_m: number;
  /** Latest checkpoint warning to display (passed down from App.tsx) */
  activeWarning: CheckpointWarning | null;
  /** History of all warnings fired this session */
  warningHistory: CheckpointWarning[];
  /** Callback to dismiss the active warning card */
  onDismissWarning: () => void;
  /** True if vehicle violated speed limit in a 15m camera field of view */
  hasSpotChallan?: boolean;
}

/** Returns the icon for the warning urgency */
function UrgencyIcon({ urgency, className }: { urgency: WarningUrgency; className?: string }) {
  switch (urgency) {
    case 'critical': return <Zap className={className} />;
    case 'warn':     return <AlertTriangle className={className} />;
    case 'caution':  return <TrendingDown className={className} />;
    case 'ok':       return <TrendingUp className={className} />;
    case 'done':     return <ShieldCheck className={className} />;
  }
}

/** A single checkpoint milestone marker on the progress rail */
function CheckpointMarker({
  percent,
  label,
  cpIndex,
  isFired,
  isCurrent,
  isNext,
  warning,
  alert,
}: {
  percent: number;
  label: string;
  cpIndex: CheckpointIndex;
  isFired: boolean;
  isCurrent: boolean;
  isNext: boolean;
  warning: CheckpointWarning | undefined;
  alert: AlertLevel;
}) {
  const markerStyle = isFired
    ? 'bg-emerald-500 border-emerald-400 text-emerald-950'
    : isCurrent
    ? alert === 'red'
      ? 'bg-red-500/20 border-red-400 text-red-300 animate-pulse'
      : alert === 'amber'
      ? 'bg-amber-500/20 border-amber-400 text-amber-300 animate-pulse'
      : 'bg-cyan-500/20 border-cyan-400 text-cyan-300 animate-pulse'
    : 'bg-gray-800/60 border-gray-700 text-gray-500';

  return (
    <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
      {/* Circle marker */}
      <div
        className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-[10px] font-black transition-all duration-300 ${markerStyle}`}
      >
        {isFired ? <CheckCircle2 className="w-4 h-4" /> : `C${cpIndex}`}
      </div>

      {/* Labels */}
      <div className="text-center">
        <div className={`text-[10px] font-mono font-bold ${isFired ? 'text-emerald-400' : isCurrent ? 'text-cyan-300' : 'text-gray-500'}`}>
          {percent}%
        </div>
        <div className="text-[9px] text-gray-600 truncate max-w-[60px]">{label}</div>
        {isFired && warning && (
          <div className={`text-[9px] font-bold mt-0.5 ${URGENCY_COLORS[warning.urgency].title}`}>
            {warning.urgency === 'done' ? 'EXIT' : `${warning.ceiling_kmh ?? '—'} km/h`}
          </div>
        )}
      </div>
    </div>
  );
}

/** The main warning card that slides in when a checkpoint fires */
function WarningCard({
  warning,
  language,
  onDismiss,
}: {
  warning: CheckpointWarning;
  language: 'hinglish' | 'english';
  onDismiss: () => void;
}) {
  const colors = URGENCY_COLORS[warning.urgency];
  const message = language === 'english' ? warning.english : warning.hinglish;

  return (
    <div
      className={`
        relative w-full rounded-2xl border p-4 flex flex-col gap-2 transition-all duration-300
        ${colors.bg} ${colors.border} ${colors.glow}
        animate-in slide-in-from-top-2 fade-in duration-300
      `}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${colors.badge}`}>
            <UrgencyIcon urgency={warning.urgency} className="w-3.5 h-3.5 text-white" />
          </span>
          <span className={`text-sm font-bold font-mono truncate ${colors.title}`}>
            {warning.title}
          </span>
        </div>
        <button
          onClick={onDismiss}
          className="flex-shrink-0 text-gray-500 hover:text-gray-300 transition-colors"
          aria-label="Dismiss warning"
        >
          <XCircle className="w-4 h-4" />
        </button>
      </div>

      {/* Main message */}
      <p className="text-xs text-gray-200 leading-relaxed font-mono">{message}</p>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-2 mt-1 pt-2 border-t border-white/10">
        {warning.ceiling_kmh !== null && (
          <div className="flex flex-col items-center">
            <span className="text-[9px] text-gray-500 uppercase tracking-wider">Max Speed</span>
            <span className={`text-lg font-black font-mono ${colors.title}`}>
              {warning.ceiling_kmh}
            </span>
            <span className="text-[9px] text-gray-500">km/h</span>
          </div>
        )}
        <div className="flex flex-col items-center">
          <span className="text-[9px] text-gray-500 uppercase tracking-wider">Avg Now</span>
          <span className="text-lg font-black font-mono text-gray-200">
            {warning.currentAvg_kmh}
          </span>
          <span className="text-[9px] text-gray-500">km/h</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[9px] text-gray-500 uppercase tracking-wider">
            {warning.banked_time_s >= 0 ? 'Time Banked' : 'Time Deficit'}
          </span>
          <span
            className={`text-lg font-black font-mono ${
              warning.banked_time_s >= 0 ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {Math.abs(warning.banked_time_s)}s
          </span>
          <span className="text-[9px] text-gray-500">
            {warning.banked_time_s >= 0 ? '↑ ahead' : '↓ behind'}
          </span>
        </div>
        {warning.remaining_m > 0 && (
          <div className="flex flex-col items-center col-span-3 border-t border-white/10 pt-1 mt-0.5">
            <span className="text-[9px] text-gray-500 uppercase tracking-wider">Remaining Road Distance</span>
            <span className="text-sm font-bold font-mono text-cyan-300">
              {(warning.remaining_m / 1000).toFixed(2)} km
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export const CheckpointTracker: React.FC<CheckpointTrackerProps> = ({
  pace,
  sectionDistance_m,
  activeWarning,
  warningHistory,
  onDismissWarning,
  hasSpotChallan = false,
}) => {
  const [language, setLanguage] = useState<'hinglish' | 'english'>('hinglish');

  const CHECKPOINTS = [
    { cpIndex: 1 as CheckpointIndex, percent: 25, label: 'Q1 Calibration', distance_m: sectionDistance_m * 0.25 },
    { cpIndex: 2 as CheckpointIndex, percent: 50, label: 'Q2 Midway',      distance_m: sectionDistance_m * 0.50 },
    { cpIndex: 3 as CheckpointIndex, percent: 75, label: 'Q3 Pace Lock',   distance_m: sectionDistance_m * 0.75 },
    { cpIndex: 4 as CheckpointIndex, percent: 100, label: 'Q4 Exit Gantry', distance_m: sectionDistance_m },
  ];

  const progressPct = Math.min(100, (pace.covered_m / sectionDistance_m) * 100);

  return (
    <div className="bg-gray-900/90 rounded-2xl border border-gray-800 shadow-xl backdrop-blur-md flex flex-col gap-3 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-gray-200">
            Road-Distance Checkpoint Pacing
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLanguage(l => l === 'hinglish' ? 'english' : 'hinglish')}
            className="text-[9px] font-mono px-2 py-0.5 rounded-full border border-gray-700 text-gray-400 hover:text-cyan-300 hover:border-cyan-500 transition-colors"
          >
            {language === 'hinglish' ? 'हिन्' : 'EN'}
          </button>
          <span className="text-[11px] font-mono text-gray-400">
            Progress: <strong className="text-cyan-300">{Math.round(progressPct)}%</strong>
          </span>
        </div>
      </div>

      {/* Progress bar with checkpoint ticks */}
      <div className="relative w-full h-3 bg-gray-950 rounded-full overflow-visible border border-gray-800">
        {/* Filled progress */}
        <div
          className={`h-full transition-all duration-300 rounded-full ${
            pace.alert === 'red'
              ? 'bg-gradient-to-r from-red-600 to-red-400'
              : pace.alert === 'amber'
              ? 'bg-gradient-to-r from-amber-600 to-amber-400'
              : 'bg-gradient-to-r from-emerald-600 to-cyan-400'
          }`}
          style={{ width: `${progressPct}%` }}
        />
        {/* Checkpoint tick marks */}
        {[25, 50, 75].map(pct => (
          <div
            key={pct}
            className="absolute top-0 bottom-0 w-px bg-gray-600 opacity-70"
            style={{ left: `${pct}%` }}
          />
        ))}
      </div>

      {/* 4 checkpoint markers */}
      <div className="flex items-start gap-0">
        {CHECKPOINTS.map((cp, idx) => {
          const isFired = pace.covered_m >= cp.distance_m;
          const prevThreshold = idx === 0 ? 0 : CHECKPOINTS[idx - 1].distance_m;
          const isCurrent = !isFired && pace.covered_m >= prevThreshold;
          const isNext = !isFired && !isCurrent && idx === CHECKPOINTS.findIndex(c => pace.covered_m < c.distance_m);
          const warning = warningHistory.find(w => w.checkpoint === cp.cpIndex);

          return (
            <CheckpointMarker
              key={cp.cpIndex}
              percent={cp.percent}
              label={cp.label}
              cpIndex={cp.cpIndex}
              isFired={isFired}
              isCurrent={isCurrent}
              isNext={isNext}
              warning={warning}
              alert={pace.alert}
            />
          );
        })}
      </div>

      {/* Spot Challan Warning Strip */}
      {hasSpotChallan && (
        <div className="bg-red-950/70 border border-red-500/80 rounded-xl p-2.5 flex items-center gap-2 text-xs font-mono text-red-200 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse">
          <Zap className="w-4 h-4 text-red-400 flex-shrink-0 animate-bounce" />
          <div className="text-[11px] leading-tight text-left">
            <strong className="text-red-300">15m Camera Range Violation:</strong> Spot challan detected! High risk of challan in this camera region even if average speed is safe.
          </div>
        </div>
      )}

      {/* Active Warning Card */}
      {activeWarning && (
        <WarningCard
          warning={activeWarning}
          language={language}
          onDismiss={onDismissWarning}
        />
      )}

      {/* Idle state — show pace summary when no warning is active */}
      {!activeWarning && (
        <div className="flex items-center justify-between px-2 py-2 bg-gray-950/60 rounded-xl border border-gray-800">
          <div className="flex items-center gap-2">
            <Timer className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-[10px] font-mono text-gray-500">
              Avg: <span className="text-gray-300 font-bold">{pace.currentAvg_kmh} km/h</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-mono font-bold ${pace.banked_time_s >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {pace.banked_time_s >= 0 ? `+${pace.banked_time_s}s banked` : `${pace.banked_time_s}s deficit`}
            </span>
          </div>
          {pace.max_avg_kmh !== null && (
            <div className="text-[10px] font-mono text-gray-500">
              Ceiling: <span className={`font-bold ${
                pace.alert === 'red' ? 'text-red-400' : pace.alert === 'amber' ? 'text-amber-400' : 'text-emerald-400'
              }`}>{pace.max_avg_kmh} km/h</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
