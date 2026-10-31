/**
 * journeyService.ts
 *
 * Universal Continuous Journey Planner for Gurugram:
 *  1. Supports ANY Origin and Destination across Gurugram (Sectors 1-115, landmarks, custom map clicks).
 *  2. Evaluates STRICT road network distance along real OpenStreetMap roadways,
 *     NEVER straight-line Euclidean displacement.
 *  3. Dynamically intersects the planned road route with the GMDA ITMS CCTV/ANPR camera database.
 *  4. Snaps cameras within the road carriageway (CTE <= 70m), orders them in direction of travel,
 *     and marks their exact cumulative distance from trip start.
 *  5. Automatically creates CameraEnforcementZones between consecutive cameras with 4 checkpoints (25%, 50%, 75%, 100%).
 *  6. Seamlessly switches between:
 *     - Normal Map Routing mode (before first camera, between distant gaps, after last camera)
 *     - Active Camera Enforcement mode (between camera pairs)
 */

import { EnforcementSection, Gantry } from '../types/pace';
import { GurgaonPlace, GURGAON_PLACES, getPlaceById, createCustomPlace } from '../data/gurgaonPlaces';
import { haversine_m, computePolylineCumulativeDistances, getPointAlongPolylineAtFraction } from '../engine/paceEngine';
import { getDrivingRoute, routeViaArterialGraph, projectPointToSegment } from './roadRoutingService';
import gantriesData from '../data/gantries.json';

export interface RouteCameraSpot {
  id: string;
  name: string;
  lat: number;
  lon: number;
  journeyDistance_m: number; // Exact cumulative distance from trip start (meters)
  limit_kmh: number;
  road: string;
  source: string;
  direction?: string;
  crossTrackError_m?: number;
}

export interface RouteCheckpoint {
  index: 1 | 2 | 3 | 4;
  pct: 25 | 50 | 75 | 100;
  label: string;
  journeyDistance_m: number; // Exact cumulative distance along the full journey
  zoneDistance_m: number;    // Distance from start of this camera zone
  pos: [number, number];     // [lat, lon]
}

export interface CameraEnforcementZone {
  id: string;
  name: string;
  sectionIndex: number;
  startCamera: RouteCameraSpot;
  endCamera: RouteCameraSpot;
  startJourneyDist_m: number;
  endJourneyDist_m: number;
  length_m: number;
  displacement_m: number;   // Straight chord displacement for user transparency
  detourPct: number;        // Road curvature detour % over chord displacement
  limit_kmh: number;
  checkpoints: RouteCheckpoint[];
  polyline: [number, number][];
}

export interface PlannedJourney {
  id: string;
  name: string;
  origin: GurgaonPlace;
  destination: GurgaonPlace;
  totalDistance_m: number;         // STRICT Road Network Distance (m)
  straightDisplacement_m: number;  // Straight chord displacement (m)
  detourPct: number;               // Road curvature factor (+X% over displacement)
  corridor: string;
  cameras: RouteCameraSpot[];
  enforcementZones: CameraEnforcementZone[];
  fullPolyline: [number, number][];
  cumulativeDistances: number[];
  preCameraDistance_m: number;
  postCameraDistance_m: number;
  // Backward compatibility alias
  sections: EnforcementSection[];
}

// Master GMDA ITMS ANPR Camera Gantries across Gurugram (calibrated directly onto road centerlines)
export const GURGAON_GANTRIES: Gantry[] = (gantriesData as any[]).map(g => ({
  id: g.id,
  name: g.name,
  road: g.road || 'Expressway',
  lat: g.lat,
  lon: g.lon,
  limit_kmh: g.limit_kmh ?? 70,
  source: g.source || 'GMDA ITMS',
  direction: g.direction || 'Southbound / Jaipur',
  kind: (g.kind || 'average') as 'average',
  verified_on: g.verified_on || '2026-10-31'
}));

/**
 * Snaps all CCTV / ANPR cameras that lie along the planned route polyline.
 * Cross-track error threshold is set to 85m to capture highway main carriageway,
 * underpasses, flyovers, and wide junction interchanges.
 */
export function detectCamerasAlongPolyline(
  fullPolyline: [number, number][],
  gantries: Gantry[] = GURGAON_GANTRIES
): {
  cameras: RouteCameraSpot[];
  enforcementZones: CameraEnforcementZone[];
  legacySections: EnforcementSection[];
} {
  if (fullPolyline.length < 2) {
    return { cameras: [], enforcementZones: [], legacySections: [] };
  }

  const cumDists = computePolylineCumulativeDistances(fullPolyline);

  interface CandidateCamera {
    gantry: Gantry;
    cte_m: number;
    journeyDist_m: number;
    polyIndex: number;
    snappedPos: [number, number];
  }

  const detectedCandidates: CandidateCamera[] = [];

  for (const g of gantries) {
    const camPos: [number, number] = [g.lat, g.lon];
    let bestCTE = 1e9;
    let bestDist = 0;
    let bestIdx = 0;
    let bestSnapped: [number, number] = camPos;

    for (let i = 0; i < fullPolyline.length - 1; i++) {
      const a = fullPolyline[i];
      const b = fullPolyline[i + 1];
      const p = projectPointToSegment(camPos, a, b);

      if (p.cte_m < bestCTE) {
        bestCTE = p.cte_m;
        bestSnapped = p.snapped;
        bestIdx = i;
        bestDist = cumDists[i] + p.t * haversine_m(a, b);
      }
    }

    // Camera is confirmed to be on this road if cross-track error <= 85 meters
    if (bestCTE <= 85) {
      detectedCandidates.push({
        gantry: g,
        cte_m: Math.round(bestCTE),
        journeyDist_m: Math.round(bestDist),
        polyIndex: bestIdx,
        snappedPos: bestSnapped
      });
    }
  }

  // Sort candidate cameras in direction of travel (distance from origin)
  detectedCandidates.sort((a, b) => a.journeyDist_m - b.journeyDist_m);

  // De-duplicate any detections that are too close (e.g. duplicate gantry entries within 80m)
  const filteredCandidates: CandidateCamera[] = [];
  for (const cand of detectedCandidates) {
    const existing = filteredCandidates.find(
      c => Math.abs(c.journeyDist_m - cand.journeyDist_m) < 80
    );
    if (!existing) {
      filteredCandidates.push(cand);
    } else if (cand.cte_m < existing.cte_m) {
      // Replace with tighter cross-track snap
      const idx = filteredCandidates.indexOf(existing);
      filteredCandidates[idx] = cand;
    }
  }

  // Convert to RouteCameraSpots - anchored directly on road centerline
  const routeCameras: RouteCameraSpot[] = filteredCandidates.map(c => ({
    id: c.gantry.id,
    name: c.gantry.name,
    lat: c.snappedPos[0],
    lon: c.snappedPos[1],
    journeyDistance_m: c.journeyDist_m,
    limit_kmh: c.gantry.limit_kmh ?? 70,
    road: c.gantry.road ?? 'Expressway',
    source: c.gantry.source,
    direction: c.gantry.direction ?? 'Bidirectional',
    crossTrackError_m: c.cte_m
  }));

  // Build CameraEnforcementZones between consecutive detected cameras
  const enforcementZones: CameraEnforcementZone[] = [];
  const legacySections: EnforcementSection[] = [];

  for (let i = 0; i < routeCameras.length - 1; i++) {
    const cam1 = routeCameras[i];
    const cam2 = routeCameras[i + 1];
    const zoneDist_m = cam2.journeyDistance_m - cam1.journeyDistance_m;

    // Only build a zone if cameras are at least 150m apart
    if (zoneDist_m < 150) continue;

    // Slice polyline points for this zone
    const cand1 = filteredCandidates[i];
    const cand2 = filteredCandidates[i + 1];
    const zonePolyline: [number, number][] = [
      [cam1.lat, cam1.lon],
      ...fullPolyline.slice(cand1.polyIndex + 1, cand2.polyIndex + 1),
      [cam2.lat, cam2.lon]
    ];

    const cp1Pos = getPointAlongPolylineAtFraction(zonePolyline, 0.25);
    const cp2Pos = getPointAlongPolylineAtFraction(zonePolyline, 0.50);
    const cp3Pos = getPointAlongPolylineAtFraction(zonePolyline, 0.75);
    const cp4Pos = [cam2.lat, cam2.lon] as [number, number];

    const checkpoints: RouteCheckpoint[] = [
      {
        index: 1,
        pct: 25,
        label: 'CP 1 (25%)',
        journeyDistance_m: Math.round(cam1.journeyDistance_m + zoneDist_m * 0.25),
        zoneDistance_m: Math.round(zoneDist_m * 0.25),
        pos: cp1Pos
      },
      {
        index: 2,
        pct: 50,
        label: 'CP 2 (50%)',
        journeyDistance_m: Math.round(cam1.journeyDistance_m + zoneDist_m * 0.50),
        zoneDistance_m: Math.round(zoneDist_m * 0.50),
        pos: cp2Pos
      },
      {
        index: 3,
        pct: 75,
        label: 'CP 3 (75%)',
        journeyDistance_m: Math.round(cam1.journeyDistance_m + zoneDist_m * 0.75),
        zoneDistance_m: Math.round(zoneDist_m * 0.75),
        pos: cp3Pos
      },
      {
        index: 4,
        pct: 100,
        label: 'CP 4 (100% Exit)',
        journeyDistance_m: cam2.journeyDistance_m,
        zoneDistance_m: zoneDist_m,
        pos: cp4Pos
      }
    ];

    const straightDisp = Math.round(haversine_m([cam1.lat, cam1.lon], [cam2.lat, cam2.lon]));
    const detourPct = Number(((zoneDist_m / Math.max(1, straightDisp) - 1) * 100).toFixed(1));
    const postedLimit = Math.min(cam1.limit_kmh, cam2.limit_kmh);

    const zone: CameraEnforcementZone = {
      id: `zone-${cam1.id}-to-${cam2.id}`,
      name: `${cam1.name} → ${cam2.name}`,
      sectionIndex: enforcementZones.length,
      startCamera: cam1,
      endCamera: cam2,
      startJourneyDist_m: cam1.journeyDistance_m,
      endJourneyDist_m: cam2.journeyDistance_m,
      length_m: zoneDist_m,
      displacement_m: straightDisp,
      detourPct,
      limit_kmh: postedLimit,
      checkpoints,
      polyline: zonePolyline
    };

    enforcementZones.push(zone);

    // Legacy section compatibility
    legacySections.push({
      id: zone.id,
      name: zone.name,
      expressway: cam1.road,
      startGantry: {
        id: cam1.id,
        name: cam1.name,
        road: cam1.road,
        lat: cam1.lat,
        lon: cam1.lon,
        limit_kmh: cam1.limit_kmh,
        source: cam1.source,
        direction: cam1.direction || 'Southbound',
        kind: 'average',
        verified_on: '2026-10-31'
      },
      endGantry: {
        id: cam2.id,
        name: cam2.name,
        road: cam2.road,
        lat: cam2.lat,
        lon: cam2.lon,
        limit_kmh: cam2.limit_kmh,
        source: cam2.source,
        direction: cam2.direction || 'Southbound',
        kind: 'average',
        verified_on: '2026-10-31'
      },
      length_m: zoneDist_m,
      displacement_m: straightDisp,
      detourPct,
      limit_kmh: postedLimit,
      vehicleLimits: { car: postedLimit, bike: postedLimit, truck: Math.max(40, postedLimit - 10) },
      laneNote: 'GMDA ITMS Continuous Road Enforcement',
      polyline: zonePolyline,
      source: 'GMDA ITMS',
      verified_on: '2026-10-31'
    });
  }

  return { cameras: routeCameras, enforcementZones, legacySections };
}

/**
 * Plans a continuous journey between ANY two places in Gurugram (synchronous baseline).
 */
export function planJourney(originId: string, destinationId: string): PlannedJourney {
  const origin = getPlaceById(originId) || GURGAON_PLACES[0];
  const destination = getPlaceById(destinationId) || GURGAON_PLACES[8]; // Rajiv Chowk

  const routeRes = routeViaArterialGraph([origin.lat, origin.lon], [destination.lat, destination.lon]);
  const { cameras, enforcementZones, legacySections } = detectCamerasAlongPolyline(routeRes.polyline);

  const cumDists = computePolylineCumulativeDistances(routeRes.polyline);
  const totalDistance_m = cumDists[cumDists.length - 1];
  const straightDisplacement_m = Math.round(haversine_m([origin.lat, origin.lon], [destination.lat, destination.lon]));
  const detourPct = Number(((totalDistance_m / Math.max(1, straightDisplacement_m) - 1) * 100).toFixed(1));

  const preCameraDistance_m = cameras.length > 0 ? cameras[0].journeyDistance_m : 0;
  const postCameraDistance_m = cameras.length > 0 ? Math.max(0, totalDistance_m - cameras[cameras.length - 1].journeyDistance_m) : 0;

  return {
    id: `journey-${origin.id}-to-${destination.id}`,
    name: `${origin.name} → ${destination.name}`,
    origin,
    destination,
    totalDistance_m,
    straightDisplacement_m,
    detourPct,
    corridor: `${origin.corridor || 'Gurugram'} to ${destination.corridor || 'Gurugram'}`,
    cameras,
    enforcementZones,
    fullPolyline: routeRes.polyline,
    cumulativeDistances: cumDists,
    preCameraDistance_m,
    postCameraDistance_m,
    sections: legacySections
  };
}

/**
 * Plans a continuous journey between ANY two places in Gurugram using real-time driving OSRM
 * with instant fallback to the calibrated arterial graph.
 */
export async function planDynamicJourney(
  origin: GurgaonPlace,
  destination: GurgaonPlace
): Promise<PlannedJourney> {
  const routeRes = await getDrivingRoute([origin.lat, origin.lon], [destination.lat, destination.lon]);
  const { cameras, enforcementZones, legacySections } = detectCamerasAlongPolyline(routeRes.polyline);

  const cumDists = computePolylineCumulativeDistances(routeRes.polyline);
  const totalDistance_m = cumDists[cumDists.length - 1];
  const straightDisplacement_m = Math.round(haversine_m([origin.lat, origin.lon], [destination.lat, destination.lon]));
  const detourPct = Number(((totalDistance_m / Math.max(1, straightDisplacement_m) - 1) * 100).toFixed(1));

  const preCameraDistance_m = cameras.length > 0 ? cameras[0].journeyDistance_m : 0;
  const postCameraDistance_m = cameras.length > 0 ? Math.max(0, totalDistance_m - cameras[cameras.length - 1].journeyDistance_m) : 0;

  return {
    id: `journey-${origin.id}-to-${destination.id}`,
    name: `${origin.name} → ${destination.name}`,
    origin,
    destination,
    totalDistance_m,
    straightDisplacement_m,
    detourPct,
    corridor: `${origin.corridor || 'Gurugram'} to ${destination.corridor || 'Gurugram'}`,
    cameras,
    enforcementZones,
    fullPolyline: routeRes.polyline,
    cumulativeDistances: cumDists,
    preCameraDistance_m,
    postCameraDistance_m,
    sections: legacySections
  };
}

export interface PopularJourneyPreset {
  title: string;
  originId: string;
  destinationId: string;
  distanceKm: string;
  corridor: string;
}

export const POPULAR_JOURNEYS: PopularJourneyPreset[] = [
  {
    title: 'Cyber Hub → Rajiv Chowk (NH-48)',
    originId: 'place-ambience',
    destinationId: 'place-rajiv-chowk',
    distanceKm: '9.1 km',
    corridor: 'NH-48'
  },
  {
    title: 'Bristol Chowk → Rajesh Pilot (GCR)',
    originId: 'place-bristol-chowk',
    destinationId: 'place-rajesh-pilot',
    distanceKm: '7.5 km',
    corridor: 'Golf Course Road'
  },
  {
    title: 'Cyber City → Sector 56 Huda Market',
    originId: 'place-cyber-city',
    destinationId: 'place-sector-56',
    distanceKm: '8.8 km',
    corridor: 'Cyber City to GCR'
  },
  {
    title: 'Signature Tower → IMT Manesar',
    originId: 'place-signature-tower',
    destinationId: 'place-imt-manesar',
    distanceKm: '18.4 km',
    corridor: 'NH-48'
  },
  {
    title: 'Medanta Hospital → Vatika Chowk',
    originId: 'place-medanta',
    destinationId: 'place-vatika-chowk',
    distanceKm: '6.2 km',
    corridor: 'Sohna Road'
  }
];
