import React, { useState, useEffect, useRef } from 'react';
import { MapView } from './MapView';
import { usePaceCoach } from '../hooks/usePaceCoach';
import { NH48_GANTRIES, NH48_SECTIONS, NH48_ROUTE_COORDS } from '../data/gantries';
import type { EnforcementSection as GantrySectionType } from '../data/gantries';
import {
  Play, Pause, RotateCcw, ChevronRight, Gauge, Navigation2,
  Clock, Route, TrendingUp, Zap, ShieldCheck, AlertTriangle, CheckCircle2
} from 'lucide-react';

// Map gantry-section to an injectable speed value for simulation
interface SimPoint {
  t: number;   // seconds since start
  lat: number;
  lon: number;
  speed: number;
}

function buildSimTrack(section: GantrySectionType, avgSpeed: number): SimPoint[] {
  // Build a series of GPS waypoints along the section at 1-second intervals
  const [lon1, lat1] = section.start_gantry.coords;
  const [lon2, lat2] = section.end_gantry.coords;
  const distM = section.distance_m;
  const durationS = (distM / 1000) / avgSpeed * 3600;
  const points: SimPoint[] = [];
  const steps = Math.ceil(durationS);
  for (let i = 0; i <= steps; i++) {
    const frac = Math.min(i / steps, 1);
    points.push({
      t: i,
      lat: lat1 + (lat2 - lat1) * frac,
      lon: lon1 + (lon2 - lon1) * frac,
      speed: avgSpeed,
    });
  }
  return points;
}

const ALERT_PALETTE = {
  green:  { bg: 'bg-emerald-950/60', border: 'border-emerald-500/40', text: 'text-emerald-300', dot: 'bg-emerald-400', label: 'SAFE', icon: CheckCircle2 },
  amber:  { bg: 'bg-amber-950/60',   border: 'border-amber-500/40',   text: 'text-amber-300',   dot: 'bg-amber-400',   label: 'CAUTION', icon: AlertTriangle },
  red:    { bg: 'bg-red-950/60',     border: 'border-red-500/40',     text: 'text-red-300',     dot: 'bg-red-400',     label: 'OVER LIMIT', icon: AlertTriangle },
};

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export function LiveRideView() {
  const [selectedSectionIdx, setSelectedSectionIdx] = useState(0);
  const [simSpeed, setSimSpeed] = useState(65);
  const [isSimRunning, setIsSimRunning] = useState(false);

  const section = NH48_SECTIONS[selectedSectionIdx];

  const coach = usePaceCoach();
  const simTrackRef = useRef<SimPoint[]>([]);
  const simIdxRef = useRef(0);
  const simIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start or stop simulation
  const startSim = () => {
    if (!section) return;
    simTrackRef.current = buildSimTrack(section, simSpeed);
    simIdxRef.current = 0;

    // Start the backend session
    coach.startSection(section, NH48_ROUTE_COORDS);
    setIsSimRunning(true);
  };

  const stopSim = () => {
    setIsSimRunning(false);
    coach.stopSection();
  };

  const resetSim = () => {
    stopSim();
    simIdxRef.current = 0;
  };

  // Simulation ticker at 1 Hz
  useEffect(() => {
    if (!isSimRunning) {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
      return;
    }

    simIntervalRef.current = setInterval(() => {
      const track = simTrackRef.current;
      const idx = simIdxRef.current;

      if (idx >= track.length) {
        setIsSimRunning(false);
        return;
      }

      const pt = track[idx];
      coach.processLocationUpdate(pt.lat, pt.lon, pt.speed);
      simIdxRef.current = idx + 1;
    }, 1000);

    return () => { if (simIntervalRef.current) clearInterval(simIntervalRef.current); };
  }, [isSimRunning, coach]);

  const alert = coach.alertLevel;
  const palette = ALERT_PALETTE[alert];
  const AlertIcon = palette.icon;
  const progressPct = section ? Math.min((coach.coveredMeters / section.distance_m) * 100, 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Section Selector */}
      <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-mono text-gray-400 uppercase tracking-widest">NH-48 Section</span>
          <div className="flex flex-wrap gap-2">
            {NH48_SECTIONS.map((s, i) => (
              <button
                key={s.section_id}
                onClick={() => { resetSim(); setSelectedSectionIdx(i); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all cursor-pointer border ${
                  i === selectedSectionIdx
                    ? 'bg-cyan-600 text-white border-cyan-500 shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                    : 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700'
                }`}
              >
                {s.start_gantry.name.split(' ')[0]} → {s.end_gantry.name.split(' ')[0]}
                <span className="ml-1 text-gray-400">({(s.distance_m / 1000).toFixed(1)} km)</span>
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-gray-500 font-mono">Sim Speed:</span>
            <input
              type="range" min={0} max={70} step={5} value={simSpeed}
              onChange={e => setSimSpeed(Number(e.target.value))}
              className="w-24 accent-cyan-400"
              disabled={isSimRunning}
            />
            <span className="text-xs font-mono text-cyan-300 w-12">{simSpeed} km/h</span>
          </div>
        </div>
      </div>

      {/* Main 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* Left: HUD Panel */}
        <div className="lg:col-span-4 flex flex-col gap-3">

          {/* Alert Status Badge */}
          <div className={`flex items-center gap-3 p-4 rounded-2xl border ${palette.bg} ${palette.border} transition-all`}>
            <div className={`w-3 h-3 rounded-full ${palette.dot} animate-pulse`} />
            <AlertIcon className={`w-5 h-5 ${palette.text}`} />
            <div>
              <div className={`text-sm font-black font-mono tracking-wide ${palette.text}`}>{palette.label}</div>
              <div className="text-xs text-gray-500 font-mono">{section?.name}</div>
            </div>
          </div>

          {/* Speed Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-3">
              <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-1">Current Speed</div>
              <div className={`text-3xl font-black font-mono ${alert === 'red' ? 'text-red-400' : 'text-white'}`}>
                {coach.currentSpeed}
              </div>
              <div className="text-xs text-gray-500 font-mono">km/h</div>
            </div>

            <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-3">
              <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-1">Max Pace Ceiling</div>
              <div className={`text-3xl font-black font-mono ${alert === 'green' ? 'text-emerald-400' : alert === 'amber' ? 'text-amber-400' : 'text-red-400'}`}>
                {coach.ceilingSpeed}
              </div>
              <div className="text-xs text-gray-500 font-mono">km/h limit</div>
            </div>

            <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-3">
              <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-1">Avg Speed</div>
              <div className="text-2xl font-bold font-mono text-cyan-300">{coach.currentAvgKmh}</div>
              <div className="text-xs text-gray-500 font-mono">km/h avg</div>
            </div>

            <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-3">
              <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-1">Banked Time</div>
              <div className={`text-2xl font-bold font-mono ${coach.bankedTimeS >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {coach.bankedTimeS >= 0 ? '+' : ''}{coach.bankedTimeS}s
              </div>
              <div className="text-xs text-gray-500 font-mono">{coach.bankedTimeS >= 0 ? 'time buffer' : 'time deficit'}</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-3">
            <div className="flex justify-between text-[10px] font-mono text-gray-500 mb-2">
              <span className="flex items-center gap-1"><Route className="w-3 h-3" /> Progress</span>
              <span>{(progressPct).toFixed(1)}%</span>
            </div>
            <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  alert === 'red' ? 'bg-red-500' : alert === 'amber' ? 'bg-amber-400' : 'bg-emerald-500'
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono text-gray-600 mt-1">
              <span>{(coach.coveredMeters / 1000).toFixed(2)} km covered</span>
              <span>{(coach.remainingMeters / 1000).toFixed(2)} km left</span>
            </div>
          </div>

          {/* Time Stats */}
          <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Timing</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div>
                <span className="text-gray-500">Elapsed</span>
                <div className="text-cyan-200 font-bold">{fmtTime(coach.elapsedSeconds)}</div>
              </div>
              <div>
                <span className="text-gray-500">Limit: {section?.limit_kmh} km/h</span>
                <div className="text-gray-300 font-bold">{section ? `${(section.distance_m / 1000).toFixed(2)} km` : '—'}</div>
              </div>
            </div>
          </div>

          {/* Simulation Controls */}
          <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-3">
            <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-3">Simulation Control</div>
            <div className="flex gap-2">
              {!isSimRunning ? (
                <button
                  onClick={startSim}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-mono font-bold transition-all cursor-pointer shadow-[0_0_15px_rgba(34,197,94,0.3)]"
                >
                  <Play className="w-4 h-4" />
                  Simulate Ride
                </button>
              ) : (
                <button
                  onClick={stopSim}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-mono font-bold transition-all cursor-pointer"
                >
                  <Pause className="w-4 h-4" />
                  Pause
                </button>
              )}
              <button
                onClick={resetSim}
                className="p-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 transition-all cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-2 text-[10px] text-gray-600 font-mono text-center">
              {isSimRunning ? '🟢 Live GPS → Turf.js snap → Pace math → FastAPI telemetry' : 'Start to simulate 1 Hz GPS updates'}
            </div>
          </div>

          {/* Gantry List */}
          <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-3">
            <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-2">
              GMDA NH-48 ANPR Gantries
            </div>
            <div className="space-y-1 max-h-44 overflow-y-auto">
              {NH48_GANTRIES.map((g, i) => (
                <div key={g.id} className="flex items-center gap-2 py-1 text-xs font-mono">
                  <span className="text-gray-600 w-3">{i + 1}</span>
                  <span className="text-lg">📷</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-gray-300 truncate">{g.name}</div>
                    <div className="text-gray-600 text-[10px]">{g.limit_kmh} km/h · {g.anpr_count} cameras</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: MapLibre GL Map */}
        <div className="lg:col-span-8 rounded-2xl overflow-hidden border border-gray-800 shadow-2xl" style={{ minHeight: '600px' }}>
          <MapView
            routeCoords={NH48_ROUTE_COORDS}
            riderCoords={coach.riderCoords}
            gantries={NH48_GANTRIES}
            alertLevel={coach.alertLevel}
          />
        </div>
      </div>

      {/* Footer legend */}
      <div className="flex flex-wrap items-center gap-4 text-[10px] font-mono text-gray-600 border-t border-gray-800/60 pt-3">
        <div className="flex items-center gap-1"><ShieldCheck className="w-3 h-3 text-emerald-500" /> 4% GPS/clock safety margin applied</div>
        <div className="flex items-center gap-1"><Navigation2 className="w-3 h-3 text-blue-400" /> Turf.js nearestPointOnLine snap-to-road</div>
        <div className="flex items-center gap-1"><Zap className="w-3 h-3 text-amber-400" /> On-device math runs 100% offline</div>
        <div className="flex items-center gap-1"><Gauge className="w-3 h-3 text-cyan-400" /> FastAPI telemetry sync to backend</div>
        <div className="flex items-center gap-1"><TrendingUp className="w-3 h-3 text-purple-400" /> Bolna status endpoint: /api/sessions/{'{id}'}/status</div>
      </div>
    </div>
  );
}
