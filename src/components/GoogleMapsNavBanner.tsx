import React from 'react';
import { Camera, Navigation, AlertTriangle, ShieldCheck, Flag, Zap } from 'lucide-react';
import { CameraEnforcementZone, RouteCameraSpot, PlannedJourney } from '../services/journeyService';
import { AlertLevel, CameraFOVStatus, ChallanEvent } from '../types/pace';

interface GoogleMapsNavBannerProps {
  navMode: 'normal_routing' | 'camera_enforcement' | 'destination_reached';
  journey: PlannedJourney;
  activeZone: CameraEnforcementZone | null;
  nextCamera: RouteCameraSpot | null;
  distToNextCamera_m: number;
  currentSpeed_kmh: number;
  ceilingSpeed_kmh: number | null;
  currentAvg_kmh: number;
  postedLimit: number;
  alert: AlertLevel;
  activeCheckpointIndex: number | null;
  cameraFOV?: CameraFOVStatus;
  hasSpotChallan?: boolean;
  challanHistory?: ChallanEvent[];
  destinationName: string;
  distToDestination_m: number;
  onOpenReport?: () => void;
}

export const GoogleMapsNavBanner: React.FC<GoogleMapsNavBannerProps> = ({
  navMode,
  journey,
  activeZone,
  nextCamera,
  distToNextCamera_m,
  currentSpeed_kmh,
  ceilingSpeed_kmh,
  currentAvg_kmh,
  postedLimit,
  alert,
  activeCheckpointIndex,
  cameraFOV,
  hasSpotChallan,
  challanHistory = [],
  destinationName,
  distToDestination_m,
  onOpenReport
}) => {
  const isChallan = hasSpotChallan || cameraFOV?.spotViolation;
  const totalChallanCount = challanHistory.length;

  return (
    <div className="w-full bg-gray-950/95 backdrop-blur-xl border border-gray-800 rounded-2xl shadow-2xl p-3.5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-white">
      {/* Left: Navigation Turn / Mode Icon & Primary Maneuver Instruction */}
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        {/* Mode Icon */}
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg border ${
          isChallan
            ? 'bg-red-600 border-red-400 text-white animate-bounce'
            : navMode === 'camera_enforcement'
            ? alert === 'red'
              ? 'bg-red-950 border-red-500 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.5)]'
              : alert === 'amber'
              ? 'bg-amber-950 border-amber-500 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.5)]'
              : 'bg-cyan-950 border-cyan-400 text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.5)]'
            : navMode === 'destination_reached'
            ? 'bg-emerald-950 border-emerald-500 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.5)]'
            : 'bg-blue-950 border-blue-500 text-blue-400'
        }`}>
          {isChallan ? (
            <Zap className="w-6 h-6 fill-current animate-pulse" />
          ) : navMode === 'camera_enforcement' ? (
            <Camera className="w-6 h-6 animate-pulse" />
          ) : navMode === 'destination_reached' ? (
            <Flag className="w-6 h-6" />
          ) : (
            <Navigation className="w-6 h-6 fill-current" />
          )}
        </div>

        {/* Text Instruction Details */}
        <div className="min-w-0 flex-1">
          {isChallan ? (
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-black bg-red-600 text-white uppercase tracking-wider animate-pulse">
                  15m FOV SPOT CHALLAN
                </span>
                <span className="text-red-400 text-xs font-mono font-bold">
                  Speed: {Math.round(currentSpeed_kmh)} km/h (Limit: {postedLimit} km/h)
                </span>
              </div>
              <p className="text-sm font-mono font-black text-red-200 truncate mt-0.5">
                Speed exceeded in {cameraFOV?.cameraName || 'Camera Gantry'} 15-meter zone!
              </p>
            </div>
          ) : navMode === 'camera_enforcement' && activeZone ? (
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-black bg-cyan-950 text-cyan-300 border border-cyan-400/40 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                  ANPR SPEED TRAP ACTIVE
                </span>
                <span className="text-[11px] font-mono text-cyan-300 font-bold">
                  {activeCheckpointIndex ? `Checkpoint ${activeCheckpointIndex} of 4 (${activeCheckpointIndex * 25}%)` : 'Zone Pacing In Progress'}
                </span>
                <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                  {(activeZone.length_m / 1000).toFixed(2)} km Zone
                </span>
              </div>
              <p className="text-sm font-mono font-bold text-gray-100 truncate mt-0.5">
                {activeZone.name} · Real-time camera pace monitoring
              </p>
            </div>
          ) : navMode === 'destination_reached' ? (
            <div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-black bg-emerald-950 text-emerald-300 border border-emerald-500/40 uppercase tracking-wider">
                DESTINATION ARRIVED
              </span>
              <p className="text-sm font-mono font-bold text-emerald-200 truncate mt-0.5">
                {destinationName} · All {(journey.totalDistance_m / 1000).toFixed(1)} km Completed!
              </p>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-950 text-blue-300 border border-blue-500/30 uppercase tracking-wider">
                  NORMAL ROUTING
                </span>
                <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                  {(journey.totalDistance_m / 1000).toFixed(1)} km Route
                </span>
              </div>
              <p className="text-sm font-mono font-bold text-gray-200 truncate mt-0.5">
                {nextCamera ? (
                  <>
                    Next Camera: <span className="text-cyan-300">{nextCamera.name}</span> in{' '}
                    <strong className="text-white">{(distToNextCamera_m / 1000).toFixed(1)} km</strong>
                  </>
                ) : (
                  <>
                    Continuing to <span className="text-emerald-300">{destinationName}</span> ({(distToDestination_m / 1000).toFixed(1)} km remaining)
                  </>
                )}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Right: Challan Risk Status Badge, Speed Ceilings & Posted Limit */}
      <div className="flex items-center gap-3 self-end md:self-center flex-shrink-0 flex-wrap sm:flex-nowrap">
        {/* Real-Time Total Challan Risk Badge */}
        <button
          onClick={onOpenReport}
          title="Click to view full Challan Breakdown & Verdict"
          className={`px-3 py-1.5 rounded-xl border flex flex-col items-start transition-all cursor-pointer font-mono ${
            totalChallanCount > 0
              ? 'bg-red-950/90 border-red-500 text-red-200 shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-pulse'
              : 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
          }`}
        >
          <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider">
            {totalChallanCount > 0 ? (
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span>{totalChallanCount > 0 ? 'CHALLAN RISK: HIGH' : 'CHALLAN RISK: ZERO'}</span>
          </div>
          <div className="text-xs font-black mt-0.5">
            {totalChallanCount > 0 ? (
              <span className="text-red-300">
                {totalChallanCount} Regional Violation{totalChallanCount > 1 ? 's' : ''} Detected
              </span>
            ) : (
              <span className="text-emerald-300">0 Challans · Clean Pace</span>
            )}
          </div>
        </button>

        {/* Speed Ceiling Gauge Badge (Only in Camera Enforcement Mode) */}
        {navMode === 'camera_enforcement' && (
          <div className="bg-gray-900/90 px-3 py-1.5 rounded-xl border border-gray-800 flex flex-col items-end text-right font-mono">
            <span className="text-[9px] uppercase text-gray-400 font-semibold">
              Live Avg / Max Ceiling
            </span>
            <div className="flex items-baseline gap-1">
              <span className={`text-sm font-black ${alert === 'red' ? 'text-red-400' : alert === 'amber' ? 'text-amber-400' : 'text-emerald-400'}`}>
                {currentAvg_kmh.toFixed(1)}
              </span>
              <span className="text-xs text-gray-500">/</span>
              <span className="text-sm font-black text-cyan-300">
                {ceilingSpeed_kmh !== null ? Math.round(ceilingSpeed_kmh) : postedLimit}
              </span>
              <span className="text-[10px] text-gray-500">km/h</span>
            </div>
          </div>
        )}

        {/* Circular Speed Limit Sign (Standard Indian Road Sign: White circle, thick Red border) */}
        <div className="w-12 h-12 rounded-full bg-white border-4 border-red-600 flex flex-col items-center justify-center text-black font-mono font-black shadow-lg flex-shrink-0">
          <span className="text-base leading-none tracking-tighter">{postedLimit}</span>
          <span className="text-[7px] leading-none uppercase font-bold text-gray-700">LIMIT</span>
        </div>
      </div>
    </div>
  );
};
