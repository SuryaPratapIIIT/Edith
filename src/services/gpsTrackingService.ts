/**
 * gpsTrackingService.ts
 *
 * Real-Time Geolocation & Navigation Service:
 *  - Interfaces HTML5 navigator.geolocation API (watchPosition & getCurrentPosition) with high accuracy.
 *  - Calculates speed in km/h from device telemetry (or delta displacement / delta time).
 *  - Snaps live GPS fixes onto the planned Gurugram road polyline.
 *  - Computes exact continuous cumulative meter mark (journeyCovered_m) along the route.
 */

import { haversine_m, computePolylineCumulativeDistances } from '../engine/paceEngine';
import { projectPointToSegment } from './roadRoutingService';

export interface LiveGPSFix {
  lat: number;
  lon: number;
  accuracy: number;
  speed_kmh: number;
  heading: number | null;
  timestamp: number;
  snappedPos: [number, number];
  journeyCovered_m: number;
  crossTrackError_m: number;
}

class GPSTrackingService {
  private watchId: number | null = null;
  private lastFix: { lat: number; lon: number; timestamp: number } | null = null;
  private onFixCallback: ((fix: LiveGPSFix) => void) | null = null;
  private onErrorCallback: ((err: GeolocationPositionError) => void) | null = null;

  /**
   * Checks if browser supports HTML5 Geolocation
   */
  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'geolocation' in navigator;
  }

  /**
   * Gets current one-shot device GPS coordinates
   */
  public async getCurrentPosition(): Promise<{ lat: number; lon: number; accuracy: number }> {
    return new Promise((resolve, reject) => {
      if (!this.isSupported()) {
        reject(new Error('Geolocation is not supported by this browser.'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            accuracy: pos.coords.accuracy
          });
        },
        (err) => {
          reject(err);
        },
        {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 1000
        }
      );
    });
  }

  /**
   * Starts real-time GPS tracking stream and snaps incoming coordinates to the journey polyline.
   */
  public startTracking(
    polyline: [number, number][],
    onFix: (fix: LiveGPSFix) => void,
    onError?: (err: GeolocationPositionError) => void
  ): void {
    this.stopTracking();
    this.onFixCallback = onFix;
    this.onErrorCallback = onError || null;

    if (!this.isSupported()) {
      if (onError) {
        onError({
          code: 2,
          message: 'Geolocation not supported',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3
        } as GeolocationPositionError);
      }
      return;
    }

    const cumDists = computePolylineCumulativeDistances(polyline);

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const rawLat = pos.coords.latitude;
        const rawLon = pos.coords.longitude;
        const now = pos.timestamp || Date.now();

        // Compute speed
        let speed_kmh = 0;
        if (pos.coords.speed !== null && pos.coords.speed !== undefined && pos.coords.speed >= 0) {
          speed_kmh = pos.coords.speed * 3.6;
        } else if (this.lastFix) {
          const deltaDist_m = haversine_m([this.lastFix.lat, this.lastFix.lon], [rawLat, rawLon]);
          const delta_s = Math.max(0.2, (now - this.lastFix.timestamp) / 1000);
          speed_kmh = (deltaDist_m / delta_s) * 3.6;
        }

        this.lastFix = { lat: rawLat, lon: rawLon, timestamp: now };

        // Snap onto the journey route polyline
        const rawPos: [number, number] = [rawLat, rawLon];
        let bestCTE = 1e9;
        let bestSnapped = rawPos;
        let bestCovered_m = 0;

        for (let i = 0; i < polyline.length - 1; i++) {
          const a = polyline[i];
          const b = polyline[i + 1];
          const proj = projectPointToSegment(rawPos, a, b);

          if (proj.cte_m < bestCTE) {
            bestCTE = proj.cte_m;
            bestSnapped = proj.snapped;
            bestCovered_m = cumDists[i] + proj.t * haversine_m(a, b);
          }
        }

        const fix: LiveGPSFix = {
          lat: rawLat,
          lon: rawLon,
          accuracy: pos.coords.accuracy,
          speed_kmh: Math.round(speed_kmh),
          heading: pos.coords.heading,
          timestamp: now,
          snappedPos: bestSnapped,
          journeyCovered_m: Math.round(bestCovered_m),
          crossTrackError_m: Math.round(bestCTE)
        };

        if (this.onFixCallback) {
          this.onFixCallback(fix);
        }
      },
      (err) => {
        if (this.onErrorCallback) {
          this.onErrorCallback(err);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 6000,
        maximumAge: 500
      }
    );
  }

  /**
   * Stops real-time GPS tracking stream
   */
  public stopTracking(): void {
    if (this.watchId !== null && this.isSupported()) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.lastFix = null;
    this.onFixCallback = null;
    this.onErrorCallback = null;
  }
}

export const gpsTrackingService = new GPSTrackingService();

