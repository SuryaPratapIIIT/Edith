import React from 'react';
import { EnforcementSection, Gantry } from '../types/pace';
import { PlannedJourney } from '../services/journeyService';
import { Camera, CheckCircle2, ChevronRight, Flag, ShieldCheck, Zap, AlertTriangle } from 'lucide-react';

export interface SectionSummaryResult {
  sectionIndex: number;
  name: string;
  length_m: number;
  elapsed_s: number;
  avgSpeed_kmh: number;
  limit_kmh: number;
  hasViolation: boolean;
  hadSpotChallan: boolean;
}

interface JourneySectionStepperProps {
  journey: PlannedJourney;
  activeSectionIndex: number;
  sectionHistory: SectionSummaryResult[];
  onSelectSection: (index: number) => void;
}

export const JourneySectionStepper: React.FC<JourneySectionStepperProps> = ({
  journey,
  activeSectionIndex,
  sectionHistory,
  onSelectSection
}) => {
  return (
    <div className="w-full bg-gray-900/90 rounded-2xl border border-gray-800 p-3.5 backdrop-blur-md shadow-lg flex flex-col gap-2.5">
      {/* Top Header Label */}
      <div className="flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-cyan-400" />
          <span className="font-bold text-gray-200 uppercase tracking-wide">
            GMDA ITMS Camera Sequence ({journey.cameras.length} Gantries · {journey.sections.length} Sections)
          </span>
        </div>
        <span className="text-[11px] text-gray-400">
          Click any section to inspect cameras & checkpoints
        </span>
      </div>

      {/* Horizontal Camera-to-Camera Section Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {journey.sections.map((section, idx) => {
          const isActive = idx === activeSectionIndex;
          const historyItem = sectionHistory.find(h => h.sectionIndex === idx);
          const isCompleted = Boolean(historyItem);
          const isUpcoming = !isActive && !isCompleted;

          const startCam = section.startGantry;
          const endCam = section.endGantry;

          return (
            <button
              key={section.id}
              onClick={() => onSelectSection(idx)}
              className={`text-left p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                isActive
                  ? 'bg-cyan-950/70 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)] ring-1 ring-cyan-400/50'
                  : isCompleted
                  ? historyItem?.hasViolation || historyItem?.hadSpotChallan
                    ? 'bg-red-950/40 border-red-500/50 hover:border-red-400'
                    : 'bg-emerald-950/40 border-emerald-500/50 hover:border-emerald-400'
                  : 'bg-gray-950/60 border-gray-800 hover:border-gray-700 text-gray-400'
              }`}
            >
              {/* Card Header: Section Number & Status Badge */}
              <div className="flex items-center justify-between gap-1 text-[10px] font-mono">
                <span className={`font-bold ${isActive ? 'text-cyan-300' : isCompleted ? 'text-emerald-300' : 'text-gray-400'}`}>
                  SECTION {idx + 1} OF {journey.sections.length}
                </span>

                {isActive && (
                  <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 text-[9px] font-bold flex items-center gap-1 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                    LIVE PACING
                  </span>
                )}

                {isCompleted && (
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold flex items-center gap-1 ${
                    historyItem?.hasViolation || historyItem?.hadSpotChallan
                      ? 'bg-red-500/20 text-red-300 border border-red-400/40'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                  }`}>
                    {historyItem?.hasViolation || historyItem?.hadSpotChallan ? (
                      <>
                        <AlertTriangle className="w-2.5 h-2.5" />
                        <span>CHALLAN</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        <span>CLEARED</span>
                      </>
                    )}
                  </span>
                )}

                {isUpcoming && (
                  <span className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-500 text-[9px]">
                    UPCOMING
                  </span>
                )}
              </div>

              {/* Camera Pair Names */}
              <div className="text-xs font-mono font-semibold text-gray-100 flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="text-[10px] text-cyan-400 font-bold">C{idx + 1}:</span>
                  <span className="truncate">{startCam.name}</span>
                </div>
                <div className="flex items-center gap-1.5 truncate text-gray-400">
                  <ChevronRight className="w-3 h-3 text-gray-600 flex-shrink-0" />
                  <span className="text-[10px] text-emerald-400 font-bold">C{idx + 2}:</span>
                  <span className="truncate">{endCam.name}</span>
                </div>
              </div>

              {/* Bottom Metrics: Road Distance & Limit / Result */}
              <div className="pt-1.5 border-t border-gray-800/80 flex items-center justify-between text-[10px] font-mono">
                <span className="text-gray-400">
                  {(section.length_m / 1000).toFixed(2)} km · 4 CPs
                </span>

                {isCompleted && historyItem ? (
                  <span className={`font-bold ${historyItem.hasViolation ? 'text-red-400' : 'text-emerald-400'}`}>
                    Avg: {historyItem.avgSpeed_kmh} km/h
                  </span>
                ) : (
                  <span className="text-cyan-400 font-semibold">
                    Limit: {section.limit_kmh} km/h
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
