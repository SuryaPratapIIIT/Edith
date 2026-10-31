import React from 'react';
import { AlertLevel, PaceStatusResult } from '../types/pace';
import { ShieldCheck, AlertTriangle, Clock, TrendingUp, TrendingDown } from 'lucide-react';

interface PaceCeilingBarProps {
  pace: PaceStatusResult;
  postedLimit: number;
  amberGap: number;
}

export const PaceCeilingBar: React.FC<PaceCeilingBarProps> = ({
  pace,
  postedLimit,
  amberGap
}) => {
  const maxDisplaySpeed = Math.max(130, postedLimit + 20);
  const currentSpeed = pace.speed_kmh;
  const ceiling = pace.max_avg_kmh ?? postedLimit;

  // Percentage placements on a 0 to maxDisplaySpeed scale
  const currentPct = Math.min((currentSpeed / maxDisplaySpeed) * 100, 100);
  const ceilingPct = Math.min((ceiling / maxDisplaySpeed) * 100, 100);
  const postedPct = Math.min((postedLimit / maxDisplaySpeed) * 100, 100);
  const amberStartPct = Math.max(0, ((ceiling - amberGap) / maxDisplaySpeed) * 100);

  const isBankedPositive = pace.banked_time_s >= 0;

  return (
    <div className="bg-gray-900/90 p-4 rounded-2xl border border-gray-800 shadow-xl backdrop-blur-md flex flex-col gap-3">
      {/* Top metrics bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {pace.alert === 'red' ? (
            <div className="p-1.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse">
              <AlertTriangle className="w-5 h-5" />
            </div>
          ) : pace.alert === 'amber' ? (
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40">
              <AlertTriangle className="w-5 h-5" />
            </div>
          ) : (
            <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
              <ShieldCheck className="w-5 h-5" />
            </div>
          )}
          <div>
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-gray-300">
              {pace.state === 'done'
                ? 'Section Complete'
                : pace.alert === 'red'
                ? 'EXCEEDING SAFE PACE'
                : pace.alert === 'amber'
                ? 'APPROACHING CEILING'
                : 'OPTIMAL COMPLIANT PACE'}
            </div>
            <div className="text-[11px] text-gray-400">
              {pace.state === 'done'
                ? `Finished with avg ${pace.currentAvg_kmh} km/h`
                : pace.alert === 'red'
                ? `Reduce speed below ${pace.max_avg_kmh} km/h immediately`
                : pace.alert === 'amber'
                ? `Within ${amberGap} km/h buffer of ceiling`
                : `Holding safe section pace`}
            </div>
          </div>
        </div>

        {/* Banked time chip */}
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-bold ${
          isBankedPositive
            ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
            : 'bg-red-950/40 border-red-500/30 text-red-300'
        }`}>
          {isBankedPositive ? (
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          ) : (
            <TrendingDown className="w-4 h-4 text-red-400 animate-bounce" />
          )}
          <span>
            {isBankedPositive ? `+${pace.banked_time_s}s BANKED` : `${pace.banked_time_s}s DEFICIT`}
          </span>
        </div>
      </div>

      {/* Visual Pace Spectrum Bar */}
      <div className="space-y-1 pt-1">
        <div className="flex justify-between text-[10px] font-mono text-gray-400">
          <span>0 km/h</span>
          <span className="text-amber-400 font-semibold">Ceiling: {ceiling.toFixed(1)} km/h</span>
          <span className="text-cyan-400 font-semibold">Posted: {postedLimit} km/h</span>
          <span>{maxDisplaySpeed} km/h</span>
        </div>

        <div className="relative w-full h-8 bg-gray-950 rounded-xl overflow-hidden border border-gray-800 p-0.5">
          {/* Green zone (0 to amberStart) */}
          <div
            className="absolute top-0 bottom-0 left-0 bg-emerald-500/20 border-r border-emerald-500/40"
            style={{ width: `${amberStartPct}%` }}
          />

          {/* Amber zone (amberStart to ceiling) */}
          <div
            className="absolute top-0 bottom-0 bg-amber-500/25 border-r border-amber-500/50"
            style={{
              left: `${amberStartPct}%`,
              width: `${Math.max(0, ceilingPct - amberStartPct)}%`
            }}
          />

          {/* Red zone (ceiling to end) */}
          <div
            className="absolute top-0 bottom-0 right-0 bg-red-500/25"
            style={{ left: `${ceilingPct}%` }}
          />

          {/* Current Speed fill / indicator */}
          <div
            className={`h-full rounded-lg transition-all duration-200 ${
              pace.alert === 'red'
                ? 'bg-gradient-to-r from-red-600 to-red-500 shadow-[0_0_12px_rgba(239,68,68,0.7)]'
                : pace.alert === 'amber'
                ? 'bg-gradient-to-r from-amber-600 to-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.7)]'
                : 'bg-gradient-to-r from-emerald-600 to-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.7)]'
            }`}
            style={{ width: `${currentPct}%` }}
          />

          {/* Ceiling line notch */}
          <div
            className="absolute top-0 bottom-0 w-1 bg-amber-400 shadow-[0_0_8px_#f59e0b] z-10"
            style={{ left: `${ceilingPct}%` }}
          >
            <div className="absolute -top-1 -left-1.5 w-4 h-2 bg-amber-400 rounded-b-sm" />
          </div>

          {/* Posted Limit line notch */}
          <div
            className="absolute top-0 bottom-0 w-1 bg-cyan-400 shadow-[0_0_8px_#06b6d4] z-10"
            style={{ left: `${postedPct}%` }}
          >
            <div className="absolute -bottom-1 -left-1.5 w-4 h-2 bg-cyan-400 rounded-t-sm" />
          </div>
        </div>
      </div>

      {/* Bottom quick stats */}
      <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono pt-1">
        <div className="bg-gray-800/40 p-2 rounded-xl border border-gray-800">
          <div className="text-[10px] text-gray-400">DISTANCE LEFT</div>
          <div className="text-sm font-bold text-gray-200">
            {(pace.remaining_m / 1000).toFixed(1)} <span className="text-[10px] text-gray-400">km</span>
          </div>
        </div>

        <div className="bg-gray-800/40 p-2 rounded-xl border border-gray-800">
          <div className="text-[10px] text-gray-400">TIME BUDGET</div>
          <div className="text-sm font-bold text-amber-300">
            {pace.need_s > 0 ? `${Math.floor(pace.need_s / 60)}m ${pace.need_s % 60}s` : '0s (Met)'}
          </div>
        </div>

        <div className="bg-gray-800/40 p-2 rounded-xl border border-gray-800">
          <div className="text-[10px] text-gray-400">CURRENT AVG</div>
          <div className={`text-sm font-bold ${
            pace.currentAvg_kmh > pace.effectiveLimit_kmh ? 'text-red-400' : 'text-emerald-400'
          }`}>
            {pace.currentAvg_kmh.toFixed(1)} <span className="text-[10px] text-gray-400">km/h</span>
          </div>
        </div>

        <div className="bg-gray-800/40 p-2 rounded-xl border border-gray-800">
          <div className="text-[10px] text-gray-400">MIN SECTION TIME</div>
          <div className="text-sm font-bold text-cyan-300">
            {Math.floor(pace.t_min_s / 60)}m {pace.t_min_s % 60}s
          </div>
        </div>
      </div>
    </div>
  );
};
