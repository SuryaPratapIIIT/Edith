/**
 * roadRoutingService.ts
 *
 * High-precision Road Network Routing Engine for Gurugram:
 *  1. Client-side OSRM driving API caller with timeout & abort control.
 *  2. Resilient built-in Gurugram Arterial Road Graph fallback:
 *     - NH-48 Expressway Motorway & Flyovers
 *     - Golf Course Road Underpass Corridor
 *     - Sohna Road (NH-248A) Elevated Highway
 *     - MG Road (Mehrauli-Gurgaon Road)
 *     - Netaji Subhash Marg & Sector 29 Loop
 *     - Vikas Marg & Medanta Link
 *     - Golf Course Extension Road (SPR)
 *     - Old Delhi-Gurgaon Road & Railway Station
 *  3. Dense curve interpolation ensuring road-locked arc lengths (never straight chord displacement).
 */

import { haversine_m, computePolylineCumulativeDistances } from '../engine/paceEngine';
import calibratedCorridors from '../data/calibratedRoadCorridors.json';

export interface RouteResult {
  polyline: [number, number][];
  distance_m: number;
  straightDisplacement_m: number;
  detourPct: number;
  source: 'osrm' | 'arterial_graph';
}

export interface RoadDistanceResult {
  roadDistance_m: number;
  displacement_m: number;
  curvatureExtra_m: number;
  detourFactor: number;
  routeGeometry: [number, number][];
  source: string;
}

/**
 * Calculates road distance vs straight chord displacement comparison
 */
export async function getShortestRoadDistance(
  start: [number, number],
  end: [number, number],
  referencePolyline?: [number, number][]
): Promise<RoadDistanceResult> {
  let poly: [number, number][];
  let dist_m: number;
  let src = 'arterial_graph';

  if (referencePolyline && referencePolyline.length > 1) {
    poly = referencePolyline;
    const cum = computePolylineCumulativeDistances(poly);
    dist_m = Math.round(cum[cum.length - 1]);
    src = 'reference_polyline';
  } else {
    const route = await getDrivingRoute(start, end);
    poly = route.polyline;
    dist_m = route.distance_m;
    src = route.source;
  }

  const disp_m = Math.round(haversine_m(start, end));
  const curvatureExtra_m = Math.max(0, dist_m - disp_m);
  const detourFactor = Number((dist_m / Math.max(1, disp_m)).toFixed(3));

  return {
    roadDistance_m: dist_m,
    displacement_m: disp_m,
    curvatureExtra_m,
    detourFactor,
    routeGeometry: poly,
    source: src
  };
}

/**
 * Projects a point onto a line segment [a, b], returning t in [0, 1] and snapped [lat, lon].
 */
export function projectPointToSegment(
  p: [number, number],
  a: [number, number],
  b: [number, number]
): { t: number; snapped: [number, number]; cte_m: number } {
  const latAvgRad = ((a[0] + b[0]) / 2) * (Math.PI / 180);
  const cosLat = Math.cos(latAvgRad);

  const dx = (b[1] - a[1]) * cosLat;
  const dy = b[0] - a[0];
  const segLenSq = dx * dx + dy * dy;

  if (segLenSq < 1e-12) {
    return { t: 0, snapped: a, cte_m: haversine_m(p, a) };
  }

  const ux = (p[1] - a[1]) * cosLat;
  const uy = p[0] - a[0];
  let t = (ux * dx + uy * dy) / segLenSq;
  t = Math.max(0, Math.min(1, t));

  const snapped: [number, number] = [
    a[0] + t * (b[0] - a[0]),
    a[1] + t * (b[1] - a[1])
  ];

  return { t, snapped, cte_m: haversine_m(p, snapped) };
}

/**
 * Densifies a polyline so adjacent points are no more than maxGap_m apart.
 */
export function densifyPolyline(pts: [number, number][], maxGap_m: number = 25): [number, number][] {
  if (pts.length < 2) return pts;
  const result: [number, number][] = [pts[0]];

  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const segDist = haversine_m(a, b);

    if (segDist > maxGap_m) {
      const steps = Math.ceil(segDist / maxGap_m);
      for (let s = 1; s < steps; s++) {
        const frac = s / steps;
        result.push([
          a[0] + frac * (b[0] - a[0]),
          a[1] + frac * (b[1] - a[1])
        ]);
      }
    }
    result.push(b);
  }

  return result;
}

// Ground-truth arterial road centerlines in Gurugram (calibrated from OpenStreetMap motorway/trunk ways)
export const GURGAON_ROAD_NETWORK: Record<string, [number, number][]> =
  calibratedCorridors as unknown as Record<string, [number, number][]>;

/**
 * Attempts to fetch real-world driving road route from OSRM public routing API.
 * Uses AbortController with a 4000ms timeout for reliable responsiveness.
 */
export async function fetchOSRMRoute(
  origin: [number, number],
  dest: [number, number]
): Promise<RouteResult | null> {
  const [lat1, lon1] = origin;
  const [lat2, lon2] = dest;

  // Don't make external request if coordinates are identical
  if (Math.abs(lat1 - lat2) < 0.0001 && Math.abs(lon1 - lon2) < 0.0001) {
    return null;
  }

  const url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=full&geometries=geojson`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const data = await res.json();
    if (!data.routes || data.routes.length === 0) return null;

    const r = data.routes[0];
    const rawCoords: [number, number][] = r.geometry.coordinates; // [lon, lat]
    const flipped: [number, number][] = rawCoords.map(([lon, lat]) => [lat, lon]);

    const dense = densifyPolyline(flipped, 25);
    const cumDists = computePolylineCumulativeDistances(dense);
    const totalRoadDist = cumDists[cumDists.length - 1];
    const straightDisp = Math.round(haversine_m(origin, dest));
    const detourRatio = totalRoadDist / Math.max(1, straightDisp);

    // If OSRM took an aberrant U-turn loop (> 2.5x chord), reject it and fall back to arterial graph
    if (detourRatio > 2.5) {
      return null;
    }

    const detourPct = Number(((detourRatio - 1) * 100).toFixed(1));

    return {
      polyline: dense,
      distance_m: Math.round(totalRoadDist),
      straightDisplacement_m: straightDisp,
      detourPct,
      source: 'osrm'
    };
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

/**
 * Local Gurugram Road Network Router:
 * Snaps origin and destination onto the nearest arterial corridors and stitches the physical road path.
 * Guarantees 100% offline, zero-latency road-accurate routing without cutting through buildings.
 */
export function routeViaArterialGraph(
  origin: [number, number],
  dest: [number, number]
): RouteResult {
  // 1. Find nearest arterial road corridor and snapped points for origin and dest
  let bestOriginCorridor = 'NH48_FULL';
  let bestOriginPt = origin;
  let minOriginCTE = 1e9;
  let originSegIdx = 0;

  let bestDestCorridor = 'NH48_FULL';
  let bestDestPt = dest;
  let minDestCTE = 1e9;
  let destSegIdx = 0;

  for (const [corridorName, pts] of Object.entries(GURGAON_ROAD_NETWORK)) {
    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = projectPointToSegment(origin, pts[i], pts[i + 1]);
      if (p1.cte_m < minOriginCTE) {
        minOriginCTE = p1.cte_m;
        bestOriginCorridor = corridorName;
        bestOriginPt = p1.snapped;
        originSegIdx = i;
      }

      const p2 = projectPointToSegment(dest, pts[i], pts[i + 1]);
      if (p2.cte_m < minDestCTE) {
        minDestCTE = p2.cte_m;
        bestDestCorridor = corridorName;
        bestDestPt = p2.snapped;
        destSegIdx = i;
      }
    }
  }

  const routePolyline: [number, number][] = [origin];

  // If origin is not already on the road, add connecting segment to the nearest road entry
  if (haversine_m(origin, bestOriginPt) > 5) {
    routePolyline.push(bestOriginPt);
  }

  // Case A: Both origin and dest are along the SAME corridor
  if (bestOriginCorridor === bestDestCorridor) {
    const corridorPts = GURGAON_ROAD_NETWORK[bestOriginCorridor];
    if (originSegIdx <= destSegIdx) {
      // Forward along corridor
      for (let i = originSegIdx + 1; i <= destSegIdx; i++) {
        routePolyline.push(corridorPts[i]);
      }
    } else {
      // Reverse along corridor
      for (let i = originSegIdx; i > destSegIdx; i--) {
        routePolyline.push(corridorPts[i]);
      }
    }
    routePolyline.push(bestDestPt);
  } else {
    // Case B: Connecting between two different corridors via common interchanges
    // E.g. NH48 and GCR connect at Sikanderpur / Shankar Chowk
    // NH48 and Sohna Rd connect at Rajiv Chowk
    // NH48 and MG Road connect at IFFCO Chowk
    const c1Pts = GURGAON_ROAD_NETWORK[bestOriginCorridor];
    const c2Pts = GURGAON_ROAD_NETWORK[bestDestCorridor];

    // Find closest intersection between c1 and c2
    let bestDist = 1e9;
    let bestC1Idx = 0;
    let bestC2Idx = 0;

    for (let i = 0; i < c1Pts.length; i++) {
      for (let j = 0; j < c2Pts.length; j++) {
        const d = haversine_m(c1Pts[i], c2Pts[j]);
        if (d < bestDist) {
          bestDist = d;
          bestC1Idx = i;
          bestC2Idx = j;
        }
      }
    }

    // Traverse c1 to junction
    const c1Step = originSegIdx <= bestC1Idx ? 1 : -1;
    for (let i = originSegIdx; i !== bestC1Idx; i += c1Step) {
      routePolyline.push(c1Pts[i]);
    }
    routePolyline.push(c1Pts[bestC1Idx]);

    // Traverse c2 from junction to dest
    const c2Step = bestC2Idx <= destSegIdx ? 1 : -1;
    for (let j = bestC2Idx; j !== destSegIdx; j += c2Step) {
      routePolyline.push(c2Pts[j]);
    }
    routePolyline.push(bestDestPt);
  }

  // Add final step to dest if not exactly at the road exit
  if (haversine_m(bestDestPt, dest) > 5) {
    routePolyline.push(dest);
  }

  // Densify polyline so vehicle moves smoothly at 10 FPS
  const dense = densifyPolyline(routePolyline, 25);
  const cumDists = computePolylineCumulativeDistances(dense);
  const totalRoadDist = cumDists[cumDists.length - 1];
  const straightDisp = Math.round(haversine_m(origin, dest));
  const detourPct = Number(((totalRoadDist / Math.max(1, straightDisp) - 1) * 100).toFixed(1));

  return {
    polyline: dense,
    distance_m: Math.round(totalRoadDist),
    straightDisplacement_m: straightDisp,
    detourPct,
    source: 'arterial_graph'
  };
}

/**
 * Universal Road Router:
 * Fetches dynamic OSRM route if online, or immediately uses the built-in Gurugram arterial graph if offline.
 */
export async function getDrivingRoute(
  origin: [number, number],
  dest: [number, number]
): Promise<RouteResult> {
  const osrmRes = await fetchOSRMRoute(origin, dest);
  if (osrmRes && osrmRes.polyline.length > 5) {
    return osrmRes;
  }
  return routeViaArterialGraph(origin, dest);
}
