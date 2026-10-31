import { useState, useRef, useCallback } from 'react';
import * as turf from '@turf/turf';
import type { EnforcementSection } from '../data/gantries';
import { ENV, PACE_CONFIG } from '../config/env';

export type AlertLevel = 'green' | 'amber' | 'red';

export interface PaceState {
  riderCoords: [number, number];
  currentSpeed: number;
  ceilingSpeed: number;
  alertLevel: AlertLevel;
  remainingMeters: number;
  coveredMeters: number;
  elapsedSeconds: number;
  currentAvgKmh: number;
  bankedTimeS: number;
  isActive: boolean;
  sectionName: string;
}

export interface UsePaceCoachReturn extends PaceState {
  startSection: (section: EnforcementSection, routeCoords: [number, number][]) => void;
  processLocationUpdate: (lat: number, lon: number, rawSpeedKmh: number) => void;
  stopSection: () => void;
  sessionId: string;
}

const BACKEND_URL = ENV.BACKEND_URL;
const SESSION_ID = ENV.SESSION_ID;
const MARGIN = PACE_CONFIG.MARGIN;

function speakHinglish(_text: string) {
  // Completely disabled per user requirement: Bolna AI Agent FRIDAY handles all voice guidance
  return;
}

export function usePaceCoach(): UsePaceCoachReturn {
  const [state, setState] = useState<PaceState>({
    riderCoords: [77.0872, 28.5022],
    currentSpeed: 0,
    ceilingSpeed: 70,
    alertLevel: 'green',
    remainingMeters: 0,
    coveredMeters: 0,
    elapsedSeconds: 0,
    currentAvgKmh: 0,
    bankedTimeS: 0,
    isActive: false,
    sectionName: '',
  });

  const sectionRef = useRef<EnforcementSection | null>(null);
  const routeCoordsRef = useRef<[number, number][]>([]);
  const startTimeRef = useRef<number>(0);
  const lastAlertRef = useRef<AlertLevel>('green');

  // ── Start a new enforcement section session ──────────────────────────────
  const startSection = useCallback((section: EnforcementSection, routeCoords: [number, number][]) => {
    sectionRef.current = section;
    routeCoordsRef.current = routeCoords;
    startTimeRef.current = Date.now();
    lastAlertRef.current = 'green';

    setState(prev => ({
      ...prev,
      isActive: true,
      sectionName: section.name,
      remainingMeters: section.distance_m,
      ceilingSpeed: section.limit_kmh,
      riderCoords: section.start_gantry.coords,
    }));

    // Register session with backend
    fetch(`${BACKEND_URL}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: SESSION_ID,
        section_name: section.name,
        section_distance_m: section.distance_m,
        limit_kmh: section.limit_kmh,
        start_gantry_id: section.start_gantry.id,
      }),
    }).catch(err => console.debug('Backend session start (offline OK):', err));
  }, []);

  // ── Process a GPS update at ~1 Hz ────────────────────────────────────────
  const processLocationUpdate = useCallback((lat: number, lon: number, rawSpeedKmh: number) => {
    const section = sectionRef.current;
    const routeCoords = routeCoordsRef.current;
    if (!section || routeCoords.length < 2) return;

    // 1. Build Turf.js route line
    const routeLine = turf.lineString(routeCoords);
    const rawPoint = turf.point([lon, lat]);

    // 2. Snap noisy GPS onto the expressway polyline
    const snapped = turf.nearestPointOnLine(routeLine, rawPoint);
    const snappedCoords = snapped.geometry.coordinates as [number, number];

    // 3. Compute road-distance covered from start gantry
    const startPoint = turf.point(section.start_gantry.coords);
    const slicedLine = turf.lineSlice(startPoint, turf.point(snappedCoords), routeLine);
    const coveredM = turf.length(slicedLine, { units: 'kilometers' }) * 1000;

    // 4. Run the same mathematical pace formula (mirror of Python backend)
    const elapsedS = (Date.now() - startTimeRef.current) / 1000;
    const D = section.distance_m;
    const V = section.limit_kmh;
    const effMs = (V * (1 - MARGIN)) / 3.6;
    const tMin = D / effMs;
    const remainingM = Math.max(D - coveredM, 0);
    const needS = tMin - elapsedS;

    let ceiling = V;
    if (needS > 0 && remainingM > 0) {
      ceiling = Math.min(V, (remainingM / needS) * 3.6);
    }

    const currentAvgKmh = elapsedS > 0 ? (coveredM / elapsedS) * 3.6 : 0;
    const bankedTimeS = Math.round(elapsedS - (coveredM / effMs));

    let alertLevel: AlertLevel = 'green';
    if (rawSpeedKmh > ceiling || rawSpeedKmh > V) alertLevel = 'red';
    else if (rawSpeedKmh > ceiling - 5) alertLevel = 'amber';

    // 5. On-device voice alerts (zero latency, works offline)
    if (alertLevel === 'red' && lastAlertRef.current !== 'red') {
      speakHinglish(`Speed zyada hai. Abhi ${Math.round(ceiling)} kilometer pe aao.`);
    } else if (alertLevel === 'amber' && lastAlertRef.current === 'green') {
      speakHinglish(`Dhyan rakho. Speed ${Math.round(ceiling)} se neeche rakho.`);
    }
    lastAlertRef.current = alertLevel;

    // 6. Update React state
    setState(prev => ({
      ...prev,
      riderCoords: snappedCoords,
      currentSpeed: Math.round(rawSpeedKmh),
      ceilingSpeed: Math.round(ceiling),
      alertLevel,
      remainingMeters: Math.round(remainingM),
      coveredMeters: Math.round(coveredM),
      elapsedSeconds: Math.round(elapsedS),
      currentAvgKmh: Math.round(currentAvgKmh),
      bankedTimeS,
    }));

    // 7. Async telemetry sync to FastAPI backend (fire-and-forget)
    fetch(`${BACKEND_URL}/api/sessions/${SESSION_ID}/location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lon, covered_m: coveredM, speed_kmh: rawSpeedKmh }),
    }).catch(() => {}); // graceful offline — on-device math already ran
  }, []);

  const stopSection = useCallback(() => {
    sectionRef.current = null;
    setState(prev => ({ ...prev, isActive: false }));
    fetch(`${BACKEND_URL}/api/sessions/${SESSION_ID}`, { method: 'DELETE' }).catch(() => {});
  }, []);

  return { ...state, startSection, processLocationUpdate, stopSection, sessionId: SESSION_ID };
}
