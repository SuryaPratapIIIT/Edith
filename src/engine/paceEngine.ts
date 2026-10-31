import type { AlertLevel, EnforcementSection, PaceStatusResult } from '../types/pace';

/**
 * Calculates great-circle distance between two coordinates in meters.
 * Point format: [latitude, longitude]
 */
export function haversine_m(a: [number, number], b: [number, number]): number {
  const R = 6371000.0; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const la1 = toRad(a[0]);
  const lo1 = toRad(a[1]);
  const la2 = toRad(b[0]);
  const lo2 = toRad(b[1]);

  const dLat = la2 - la1;
  const dLon = lo2 - lo1;

  const sinDlat = Math.sin(dLat / 2);
  const sinDlon = Math.sin(dLon / 2);

  const d = sinDlat * sinDlat + Math.cos(la1) * Math.cos(la2) * sinDlon * sinDlon;
  return 2 * R * Math.asin(Math.sqrt(d));
}

/**
 * Computes cumulative distance in meters along an expressway polyline.
 */
export function computePolylineCumulativeDistances(polyline: [number, number][]): number[] {
  const distances: number[] = [0];
  let total = 0;
  for (let i = 0; i < polyline.length - 1; i++) {
    const dist = haversine_m(polyline[i], polyline[i + 1]);
    total += dist;
    distances.push(total);
  }
  return distances;
}

/**
 * Finds the exact GPS coordinate [lat, lon] at a given distance (or fraction) along the polyline.
 */
export function getPointAlongPolylineAtFraction(
  polyline: [number, number][],
  fraction: number
): [number, number] {
  if (polyline.length === 0) return [0, 0];
  if (fraction <= 0) return polyline[0];
  if (fraction >= 1) return polyline[polyline.length - 1];

  const cumulative = computePolylineCumulativeDistances(polyline);
  const totalLength = cumulative[cumulative.length - 1];
  const targetDist = fraction * totalLength;

  for (let i = 0; i < cumulative.length - 1; i++) {
    if (targetDist >= cumulative[i] && targetDist <= cumulative[i + 1]) {
      const segLength = cumulative[i + 1] - cumulative[i];
      if (segLength === 0) return polyline[i];
      const t = (targetDist - cumulative[i]) / segLength;
      const lat = polyline[i][0] + (polyline[i + 1][0] - polyline[i][0]) * t;
      const lon = polyline[i][1] + (polyline[i + 1][1] - polyline[i][1]) * t;
      return [lat, lon];
    }
  }

  return polyline[polyline.length - 1];
}

/**
 * Map matching: Snaps any raw GPS point to the expressway road polyline
 * and computes the distance along the road from Gantry 1 in meters.
 */
export function snapToPolyline(
  point: [number, number],
  polyline: [number, number][]
): {
  snappedPoint: [number, number];
  covered_m: number;
  crossTrackError_m: number;
  segmentIndex: number;
} {
  if (polyline.length === 0) {
    return { snappedPoint: point, covered_m: 0, crossTrackError_m: 0, segmentIndex: 0 };
  }
  if (polyline.length === 1) {
    return {
      snappedPoint: polyline[0],
      covered_m: 0,
      crossTrackError_m: haversine_m(point, polyline[0]),
      segmentIndex: 0
    };
  }

  const cumulative = computePolylineCumulativeDistances(polyline);
  let bestDistanceToRoad = Infinity;
  let bestSnapped: [number, number] = polyline[0];
  let bestCovered = 0;
  let bestSegment = 0;

  // Project point onto each segment of the polyline
  for (let i = 0; i < polyline.length - 1; i++) {
    const p1 = polyline[i];
    const p2 = polyline[i + 1];

    // Local cartesian projection around segment
    const midLatRad = ((p1[0] + p2[0]) / 2) * (Math.PI / 180);
    const kx = 111320 * Math.cos(midLatRad); // meters per lon deg
    const ky = 110540; // meters per lat deg

    const x1 = p1[1] * kx;
    const y1 = p1[0] * ky;
    const x2 = p2[1] * kx;
    const y2 = p2[0] * ky;
    const px = point[1] * kx;
    const py = point[0] * ky;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;

    let t = 0;
    if (lenSq > 0) {
      t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
    }

    const snappedLat = p1[0] + (p2[0] - p1[0]) * t;
    const snappedLon = p1[1] + (p2[1] - p1[1]) * t;
    const distToRoad = haversine_m(point, [snappedLat, snappedLon]);

    if (distToRoad < bestDistanceToRoad) {
      bestDistanceToRoad = distToRoad;
      bestSnapped = [snappedLat, snappedLon];
      bestSegment = i;

      // Distance from Gantry 1 up to start of segment + along this segment
      const segLength = cumulative[i + 1] - cumulative[i];
      bestCovered = cumulative[i] + t * segLength;
    }
  }

  return {
    snappedPoint: bestSnapped,
    covered_m: Math.round(bestCovered),
    crossTrackError_m: Math.round(bestDistanceToRoad * 10) / 10,
    segmentIndex: bestSegment
  };
}

/**
 * Core Dynamic Pace Engine Algorithm:
 * Evaluates live telemetry state from covered distance, elapsed time, and speed.
 */
export function pace_status(
  section_m: number,
  limit_kmh: number,
  elapsed_s: number,
  covered_m: number,
  speed_kmh: number,
  margin: number = 0.04,
  amber_gap_kmh: number = 5
): PaceStatusResult {
  // 1. Safety-margined limit in m/s (e.g. 100 * 0.96 / 3.6 = 26.6667 m/s)
  const eff_ms = (limit_kmh * (1 - margin)) / 3.6;

  // 2. Minimum legal time required to complete the section (e.g. 20000 / 26.6667 = 750s)
  const t_min = section_m / eff_ms;

  // 3. Remaining distance in meters
  const remaining_m = Math.max(section_m - covered_m, 0.0);

  // 4. Current average speed up to this point
  const currentAvg_kmh = elapsed_s > 0 ? (covered_m / elapsed_s) * 3.6 : 0;

  // 5. Checkpoint index (0: 0-25%, 1: 25-50%, 2: 50-75%, 3: 75-100%, 4: 100%)
  const checkpoint = Math.min(Math.floor((covered_m / Math.max(section_m, 1)) * 4), 4);

  // 6. Time banked / deficit:
  const ideal_s = eff_ms > 0 ? covered_m / eff_ms : 0;
  const banked_time_s = elapsed_s - ideal_s;

  // Check if section is already completed
  if (remaining_m === 0) {
    const isLegal = elapsed_s >= t_min;
    return {
      state: 'done',
      max_avg_kmh: null,
      alert: isLegal ? 'green' : 'red',
      checkpoint: 4,
      effectiveLimit_kmh: Math.round(limit_kmh * (1 - margin) * 10) / 10,
      t_min_s: Math.round(t_min),
      elapsed_s,
      covered_m,
      remaining_m: 0,
      need_s: 0,
      speed_kmh,
      currentAvg_kmh: Math.round(currentAvg_kmh * 10) / 10,
      banked_time_s: Math.round(banked_time_s),
      cameraFOV: {
        inCameraFOV: true,
        cameraName: 'Camera 2 Exit',
        distanceToCamera_m: 0,
        spotViolation: speed_kmh > limit_kmh,
        violationSpeed_kmh: speed_kmh > limit_kmh ? speed_kmh : undefined
      }
    };
  }

  // 7. Time that must still be spent in the remaining section
  const need_s = t_min - elapsed_s;

  let ceiling: number;
  if (need_s <= 0) {
    // Time budget already satisfied; only the posted limit applies
    ceiling = Number(limit_kmh);
  } else {
    // Max average speed allowable for remaining distance
    // Strictly capped at the posted limit
    ceiling = Math.min(Number(limit_kmh), (remaining_m / need_s) * 3.6);
  }

  // 8. 15-Meter Camera Field of View (FOV) Detection & Spot Speed Enforcement
  const fovRadius_m = 15;
  const inCam1FOV = covered_m <= fovRadius_m;
  const inCam2FOV = remaining_m <= fovRadius_m;
  const inCameraFOV = inCam1FOV || inCam2FOV;
  const cameraName = inCam1FOV ? 'Camera 1 Entry' : inCam2FOV ? 'Camera 2 Exit' : null;
  const distanceToCamera_m = inCam1FOV ? covered_m : inCam2FOV ? remaining_m : Math.min(covered_m, remaining_m);
  const spotViolation = inCameraFOV && speed_kmh > limit_kmh;

  const cameraFOV = {
    inCameraFOV,
    cameraName,
    distanceToCamera_m: Math.round(distanceToCamera_m * 10) / 10,
    spotViolation,
    violationSpeed_kmh: spotViolation ? speed_kmh : undefined
  };

  // 9. Determine alert level dynamically (Spot speed violation in camera FOV forces immediate RED)
  let alert: AlertLevel;
  if (spotViolation || speed_kmh > ceiling || speed_kmh > limit_kmh) {
    alert = 'red';
  } else if (speed_kmh > ceiling - amber_gap_kmh) {
    alert = 'amber';
  } else {
    alert = 'green';
  }

  return {
    state: 'active',
    max_avg_kmh: Math.round(ceiling * 10) / 10,
    alert,
    checkpoint,
    effectiveLimit_kmh: Math.round(limit_kmh * (1 - margin) * 10) / 10,
    t_min_s: Math.round(t_min),
    elapsed_s,
    covered_m,
    remaining_m: Math.round(remaining_m),
    need_s: Math.round(need_s),
    speed_kmh,
    currentAvg_kmh: Math.round(currentAvg_kmh * 10) / 10,
    banked_time_s: Math.round(banked_time_s),
    cameraFOV
  };
}

/**
 * High-Level GPS-Driven Location Processing Function:
 * Takes raw vehicle GPS coordinates [lat, lon], timestamp, and speed.
 * Snaps to the road polyline, determines covered distance, elapsed time,
 * checks geofence proximity to gantries, and calculates the live pace ceiling.
 */
export function calculatePaceFromGPSLocation(params: {
  section: EnforcementSection;
  lat: number;
  lon: number;
  timestamp_s: number;
  sessionStartTime_s: number;
  speed_kmh: number;
  margin?: number;
  amber_gap_kmh?: number;
}): PaceStatusResult {
  const {
    section,
    lat,
    lon,
    timestamp_s,
    sessionStartTime_s,
    speed_kmh,
    margin = 0.04,
    amber_gap_kmh = 5
  } = params;

  // 1. Map match vehicle location to expressway polyline
  const snap = snapToPolyline([lat, lon], section.polyline);

  // 2. Compute elapsed time from GPS timestamps
  const elapsed_s = Math.max(0, Math.round(timestamp_s - sessionStartTime_s));

  // 3. Compute dynamic pace status
  const basePace = pace_status(
    section.length_m,
    section.limit_kmh,
    elapsed_s,
    snap.covered_m,
    speed_kmh,
    margin,
    amber_gap_kmh
  );

  // 4. Geofence pre-alert calculation using remaining road distance to exit gantry
  // Note: Uses actual shortest road distance (remaining_m) rather than chord displacement
  // so road curvature doesn't trigger false alerts prematurely.
  const remainingRoadDistance_m = basePace.remaining_m;
  const preAlert = checkGantryPreAlert(remainingRoadDistance_m);

  return {
    ...basePace,
    preAlert,
    snappedPosition: snap.snappedPoint,
    crossTrackError_m: snap.crossTrackError_m
  };
}

/**
 * Compares actual road distance along polyline curvature versus straight-line displacement.
 */
export function getRoadDistanceComparison(
  polyline: [number, number][]
): {
  roadDistance_m: number;
  displacement_m: number;
  curvatureExtra_m: number;
  detourFactor: number;
} {
  if (polyline.length < 2) {
    return { roadDistance_m: 0, displacement_m: 0, curvatureExtra_m: 0, detourFactor: 1.0 };
  }
  const displacement_m = Math.round(haversine_m(polyline[0], polyline[polyline.length - 1]));
  const cumulative = computePolylineCumulativeDistances(polyline);
  const roadDistance_m = Math.round(cumulative[cumulative.length - 1]);
  const curvatureExtra_m = Math.max(0, roadDistance_m - displacement_m);
  const detourFactor = Math.round((roadDistance_m / Math.max(displacement_m, 1)) * 100) / 100;

  return {
    roadDistance_m,
    displacement_m,
    curvatureExtra_m,
    detourFactor
  };
}

/**
 * Checks for camera-ahead geofence pre-alerts (2km and 500m before gantry)
 */
export function checkGantryPreAlert(distanceToGantry_m: number): '2km' | '500m' | null {
  if (distanceToGantry_m <= 600 && distanceToGantry_m >= 400) {
    return '500m';
  }
  if (distanceToGantry_m <= 2100 && distanceToGantry_m >= 1900) {
    return '2km';
  }
  return null;
}
