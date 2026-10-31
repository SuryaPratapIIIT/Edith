import React, { useEffect, useRef, useState } from 'react';
import { AlertLevel, CameraFOVStatus } from '../types/pace';
import { PlannedJourney, CameraEnforcementZone } from '../services/journeyService';
import { ENV } from '../config/env';
import { getPointAlongPolylineAtFraction } from '../engine/paceEngine';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, Radio, ShieldCheck } from 'lucide-react';

interface ExpresswayMapProps {
  journey: PlannedJourney;
  journeyCovered_m: number;
  currentSpeed: number;
  alert: AlertLevel;
  isEnforcementActive: boolean;
  activeZone: CameraEnforcementZone | null;
  cameraFOV?: CameraFOVStatus;
  hasSpotChallan?: boolean;
  isFollowingVehicle: boolean;
  isMapPickActive?: boolean;
  trackingMode?: 'simulated' | 'live_gps';
  onMapClick?: (lat: number, lon: number) => void;
}

/**
 * Calculates geographical compass bearing (0-360 degrees) between two points
 */
function computeBearing(from: [number, number], to: [number, number]): number {
  if (from[0] === to[0] && from[1] === to[1]) return 0;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const lat1 = toRad(from[0]);
  const lat2 = toRad(to[0]);
  const dLon = toRad(to[1] - from[1]);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.cos(lat1) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export const ExpresswayMap: React.FC<ExpresswayMapProps> = ({
  journey,
  journeyCovered_m,
  currentSpeed,
  alert,
  isEnforcementActive,
  activeZone,
  cameraFOV,
  hasSpotChallan,
  isFollowingVehicle,
  isMapPickActive = false,
  trackingMode = 'simulated',
  onMapClick
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<L.Map | null>(null);

  // Markers and layers references
  const vehicleMarkerRef = useRef<L.Marker | null>(null);
  const vehicleVectorDotRef = useRef<L.CircleMarker | null>(null);
  const vehicleVectorHaloRef = useRef<L.Circle | null>(null);
  const fullRouteLineRef = useRef<L.Polyline | null>(null);
  const fullRouteCasingRef = useRef<L.Polyline | null>(null);
  const tracedRouteLineRef = useRef<L.Polyline | null>(null);
  const activeZoneLineRef = useRef<L.Polyline | null>(null);
  const activeZoneGlowRef = useRef<L.Polyline | null>(null);
  const cameraMarkersRef = useRef<L.Marker[]>([]);
  const fovCirclesRef = useRef<L.Circle[]>([]);
  const checkpointMarkersRef = useRef<L.Marker[]>([]);
  const landmarkMarkersRef = useRef<L.Marker[]>([]);

  // Compute continuous progress fraction along the full journey polyline
  const progressFraction = Math.min(
    1,
    Math.max(0, journeyCovered_m / Math.max(1, journey.totalDistance_m))
  );
  const vehiclePos = getPointAlongPolylineAtFraction(journey.fullPolyline, progressFraction);

  // Compute look-ahead point for directional heading of the vehicle
  const aheadFraction = Math.min(1, progressFraction + 0.006);
  const aheadPos = getPointAlongPolylineAtFraction(journey.fullPolyline, aheadFraction);
  const vehicleBearing = computeBearing(vehiclePos, aheadPos);

  // 1. Initialize Leaflet Map once on mount (stores instance in state to trigger child layer effects immediately)
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (map) return;

    const initialPos = journey.fullPolyline[0] || [28.5022, 77.0872];
    const mapInstance = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false
    }).setView(initialPos, 14);

    // Dark sleek navigation tiles
    L.tileLayer(ENV.OSM_TILE_URL, {
      maxZoom: 19,
      subdomains: 'abc',
      attribution: '© OpenStreetMap contributors'
    }).addTo(mapInstance);

    L.control.zoom({ position: 'bottomright' }).addTo(mapInstance);

    setMap(mapInstance);

    return () => {
      mapInstance.remove();
      setMap(null);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Map Click Listener for interactive "Pick on Map" mode
  useEffect(() => {
    if (!map) return;
    const clickHandler = (e: L.LeafletMouseEvent) => {
      if (onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    };
    map.on('click', clickHandler);
    return () => {
      map.off('click', clickHandler);
    };
  }, [map, onMapClick]);

  // 2. Render Full Continuous Route, Camera Gantries, 15m FOV zones, and Origin/Destination pins
  useEffect(() => {
    if (!map) return;

    // Clean up previous layers
    if (fullRouteCasingRef.current) map.removeLayer(fullRouteCasingRef.current);
    if (fullRouteLineRef.current) map.removeLayer(fullRouteLineRef.current);
    if (tracedRouteLineRef.current) map.removeLayer(tracedRouteLineRef.current);
    if (activeZoneLineRef.current) map.removeLayer(activeZoneLineRef.current);
    if (activeZoneGlowRef.current) map.removeLayer(activeZoneGlowRef.current);
    cameraMarkersRef.current.forEach(m => map.removeLayer(m));
    cameraMarkersRef.current = [];
    fovCirclesRef.current.forEach(c => map.removeLayer(c));
    fovCirclesRef.current = [];
    checkpointMarkersRef.current.forEach(m => map.removeLayer(m));
    checkpointMarkersRef.current = [];
    landmarkMarkersRef.current.forEach(m => map.removeLayer(m));
    landmarkMarkersRef.current = [];

    // 1. Google Maps Route Line: Dark casing border + Vivid center road ribbon
    if (journey.fullPolyline.length > 1) {
      const casingLine = L.polyline(journey.fullPolyline, {
        color: '#075985',
        weight: 9,
        opacity: 0.65,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);
      fullRouteCasingRef.current = casingLine;

      const routeLine = L.polyline(journey.fullPolyline, {
        color: '#0284c7',
        weight: 5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);
      fullRouteLineRef.current = routeLine;

      map.fitBounds(routeLine.getBounds(), { padding: [60, 60] });
    }

    // 2. Origin Pin (Green Start Marker, anchored with offset so it never obscures the vehicle marker)
    const originPos = journey.fullPolyline[0];
    if (originPos) {
      const originIcon = L.divIcon({
        className: 'origin-marker',
        html: `
          <div style="background:#064e3b;color:#34d399;padding:3px 8px;border-radius:10px;border:1.5px solid #10b981;box-shadow:0 0 12px rgba(16,185,129,0.4);font-family:monospace;font-size:9px;font-weight:bold;white-space:nowrap;display:flex;align-items:center;gap:3px;">
            <span>🟢 START: ${journey.origin.name}</span>
          </div>
        `,
        iconSize: [130, 24],
        iconAnchor: [65, 42]
      });
      const mOrigin = L.marker(originPos, { icon: originIcon, zIndexOffset: 200 }).addTo(map);
      landmarkMarkersRef.current.push(mOrigin);
    }

    // 3. Destination Pin (Chequered Flag Pin)
    const destPos = journey.fullPolyline[journey.fullPolyline.length - 1];
    if (destPos) {
      const destIcon = L.divIcon({
        className: 'dest-marker',
        html: `
          <div style="background:#7f1d1d;color:#fca5a5;padding:3px 8px;border-radius:10px;border:1.5px solid #ef4444;box-shadow:0 0 12px rgba(239,68,68,0.4);font-family:monospace;font-size:9px;font-weight:bold;white-space:nowrap;display:flex;align-items:center;gap:3px;">
            <span>🏁 END: ${journey.destination.name}</span>
          </div>
        `,
        iconSize: [130, 24],
        iconAnchor: [65, 42]
      });
      const mDest = L.marker(destPos, { icon: destIcon, zIndexOffset: 200 }).addTo(map);
      landmarkMarkersRef.current.push(mDest);
    }

    // 4. Mark all GMDA ANPR Cameras along the continuous route
    journey.cameras.forEach((cam, idx) => {
      const isStartCam = activeZone?.startCamera.id === cam.id;
      const isEndCam = activeZone?.endCamera.id === cam.id;

      const badgeBg = isStartCam ? '#0369a1' : isEndCam ? '#047857' : '#1e293b';
      const borderColor = isStartCam ? '#38bdf8' : isEndCam ? '#34d399' : '#64748b';

      const camIcon = L.divIcon({
        className: 'gantry-marker',
        html: `
          <div style="background:${badgeBg};color:white;padding:3.5px 8px;border-radius:10px;border:2px solid ${borderColor};box-shadow:0 0 12px ${borderColor}80;display:flex;align-items:center;gap:4px;font-family:monospace;font-size:10px;font-weight:bold;white-space:nowrap;">
            <span>📷 C${idx + 1}: ${cam.name} (${cam.limit_kmh} km/h)</span>
          </div>
        `,
        iconSize: [160, 24],
        iconAnchor: [80, 12]
      });

      const mCam = L.marker([cam.lat, cam.lon], { icon: camIcon, zIndexOffset: 400 })
        .bindPopup(`<b>Camera ${idx + 1}: ${cam.name}</b><br/>Speed Limit: ${cam.limit_kmh} km/h<br/>Route Pos: ${(cam.journeyDistance_m / 1000).toFixed(2)} km`)
        .addTo(map);
      cameraMarkersRef.current.push(mCam);

      // 15-meter Camera Field of View (FOV) Spot Speed Radar Circle
      const fovCircle = L.circle([cam.lat, cam.lon], {
        radius: 15,
        color: '#f43f5e',
        fillColor: '#f43f5e',
        fillOpacity: isStartCam || isEndCam ? 0.45 : 0.2,
        weight: 2,
        dashArray: '3, 3'
      }).bindPopup(`<b>${cam.name}</b><br/>15m Camera Field of View Spot Speed Radar Trap`).addTo(map);
      fovCirclesRef.current.push(fovCircle);
    });
  }, [map, journey]); // Runs cleanly as soon as map instance is ready

  // 3. Render Active Camera Enforcement Zone & 4 Checkpoints (Dynamic Overlay)
  useEffect(() => {
    if (!map) return;

    if (activeZoneLineRef.current) map.removeLayer(activeZoneLineRef.current);
    if (activeZoneGlowRef.current) map.removeLayer(activeZoneGlowRef.current);
    checkpointMarkersRef.current.forEach(m => map.removeLayer(m));
    checkpointMarkersRef.current = [];

    // ONLY when inside an active camera enforcement zone:
    if (isEnforcementActive && activeZone) {
      const alertColor = alert === 'red' ? '#ef4444' : alert === 'amber' ? '#f59e0b' : '#10b981';

      // Neon outer glow for the active camera section
      const activeGlow = L.polyline(activeZone.polyline, {
        color: alertColor,
        weight: 12,
        opacity: 0.5,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);
      activeZoneGlowRef.current = activeGlow;

      // Vivid inner polyline for active camera section
      const activeLine = L.polyline(activeZone.polyline, {
        color: alertColor,
        weight: 6,
        opacity: 1.0,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);
      activeZoneLineRef.current = activeLine;

      // Render the 4 Checkpoints along the active camera zone
      activeZone.checkpoints.slice(0, 3).forEach((cp) => {
        const cpIcon = L.divIcon({
          className: 'cp-pin',
          html: `
            <div style="background:#090d16;color:#38bdf8;padding:3px 7px;border-radius:8px;border:1.5px solid #38bdf8;box-shadow:0 0 10px rgba(56,189,248,0.5);font-family:monospace;font-size:10px;font-weight:bold;white-space:nowrap;">
              🏁 ${cp.label}
            </div>
          `,
          iconSize: [85, 22],
          iconAnchor: [42, 11]
        });

        const mCP = L.marker(cp.pos, { icon: cpIcon, zIndexOffset: 500 })
          .bindPopup(`<b>Checkpoint ${cp.pct}%</b><br/>Zone Dist: ${(cp.zoneDistance_m / 1000).toFixed(2)} km<br/>Trip Dist: ${(cp.journeyDistance_m / 1000).toFixed(2)} km`)
          .addTo(map);
        checkpointMarkersRef.current.push(mCP);
      });
    }
  }, [map, isEnforcementActive, activeZone, alert]);

  // 4. Update Vehicle Marker (Guaranteed 100% Visibility with Dual Layer Vector Dot + 3D Vehicle Icon)
  useEffect(() => {
    if (!map) return;

    const alertColor = hasSpotChallan
      ? '#ef4444'
      : isEnforcementActive
      ? alert === 'red'
        ? '#ef4444'
        : alert === 'amber'
        ? '#f59e0b'
        : '#10b981'
      : '#00e5ff';

    // Layer A: Vector CircleMarker (guaranteed SVG rendering directly in Leaflet engine, cannot be hidden by CSS)
    if (!vehicleVectorDotRef.current) {
      vehicleVectorDotRef.current = L.circleMarker(vehiclePos, {
        radius: 12,
        color: '#ffffff',
        fillColor: alertColor,
        fillOpacity: 1,
        weight: 3.5,
        pane: 'markerPane'
      }).addTo(map);
    } else {
      vehicleVectorDotRef.current.setLatLng(vehiclePos);
      vehicleVectorDotRef.current.setStyle({ fillColor: alertColor });
    }

    // Outer Pulsing Radar Ring
    if (!vehicleVectorHaloRef.current) {
      vehicleVectorHaloRef.current = L.circle(vehiclePos, {
        radius: 35,
        color: alertColor,
        fillColor: alertColor,
        fillOpacity: 0.25,
        weight: 1.5,
        pane: 'overlayPane'
      }).addTo(map);
    } else {
      vehicleVectorHaloRef.current.setLatLng(vehiclePos);
      vehicleVectorHaloRef.current.setStyle({ color: alertColor, fillColor: alertColor });
    }

    // Layer B: High-Impact 3D Vehicle Icon with Label and Rotating Navigation Chevron
    const vehicleIcon = L.divIcon({
      className: 'live-vehicle-marker',
      html: `
        <div style="display:flex;flex-direction:column;align-items:center;pointer-events:none;">
          <!-- Top Floating Callout Label -->
          <div style="background:#050811;color:${alertColor};padding:3px 9px;border-radius:8px;border:2px solid ${alertColor};box-shadow:0 0 16px ${alertColor}90;font-family:monospace;font-size:10px;font-weight:900;letter-spacing:0.3px;white-space:nowrap;margin-bottom:6px;display:flex;align-items:center;gap:5px;">
            <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${alertColor};box-shadow:0 0 8px ${alertColor};"></span>
            <span>YOUR VEHICLE (${Math.round(currentSpeed)} km/h)</span>
          </div>

          <!-- Animated Google Maps 3D Navigation Vehicle Chevron & Glow -->
          <div style="position:relative;width:54px;height:54px;display:flex;align-items:center;justify-content:center;">
            <!-- Inner Glowing Directional Vehicle Body -->
            <div style="position:relative;width:40px;height:40px;border-radius:50%;background:#090d16;border:3px solid ${alertColor};box-shadow:0 0 24px ${alertColor};display:flex;align-items:center;justify-content:center;transform:rotate(${vehicleBearing}deg);transition:transform 0.15s ease-out;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="${alertColor}" stroke="#ffffff" stroke-width="2" stroke-linejoin="round">
                <path d="M12 2L19 21L12 17L5 21L12 2Z" />
              </svg>
            </div>
          </div>
        </div>
      `,
      iconSize: [180, 90],
      iconAnchor: [90, 60]
    });

    if (!vehicleMarkerRef.current) {
      vehicleMarkerRef.current = L.marker(vehiclePos, { icon: vehicleIcon, zIndexOffset: 25000 }).addTo(map);
    } else {
      vehicleMarkerRef.current.setLatLng(vehiclePos);
      vehicleMarkerRef.current.setIcon(vehicleIcon);
    }

    // Real-Time Route Tracing Breadcrumb (Google Maps Traveled Segment)
    if (journey.fullPolyline.length > 1) {
      const targetIdx = Math.floor(progressFraction * (journey.fullPolyline.length - 1));
      const tracedCoords: [number, number][] = journey.fullPolyline.slice(0, targetIdx + 1);
      tracedCoords.push(vehiclePos);

      if (!tracedRouteLineRef.current) {
        tracedRouteLineRef.current = L.polyline(tracedCoords, {
          color: '#10b981',
          weight: 6,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(map);
      } else {
        tracedRouteLineRef.current.setLatLngs(tracedCoords);
      }
    }

    // Google Maps Follow Mode: Keep vehicle centered smoothly
    if (isFollowingVehicle) {
      map.panTo(vehiclePos, { animate: true, duration: 0.1 });
    }
  }, [map, journeyCovered_m, alert, isEnforcementActive, vehiclePos, vehicleBearing, isFollowingVehicle, hasSpotChallan, currentSpeed, progressFraction, journey.fullPolyline]);

  return (
    <div className={`relative w-full h-[540px] lg:h-[620px] rounded-3xl overflow-hidden border border-gray-800 shadow-2xl bg-gray-950 flex flex-col ${isMapPickActive ? 'cursor-crosshair ring-2 ring-cyan-400/50' : ''}`}>
      {/* Leaflet Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Top Left Floating HUD: Vehicle Tracking Lock & Live GPS Status */}
      <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2 pointer-events-none">
        <div className="bg-gray-950/95 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-gray-800 shadow-2xl flex items-center gap-2.5 font-mono pointer-events-auto">
          <div className="relative flex items-center justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping absolute"></span>
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-emerald-300">
                {trackingMode === 'live_gps' ? '📡 LIVE DEVICE GPS' : 'VEHICLE TRACKED'}
              </span>
              <span className="px-1.5 py-0.2 rounded text-[8px] font-black bg-emerald-950 text-emerald-400 border border-emerald-500/40">
                {trackingMode === 'live_gps' ? 'REAL-TIME STREAM' : '10 Hz ROAD LOCK'}
              </span>
            </div>
            <span className="text-[9px] text-gray-300 font-semibold">
              🛣️ {(journeyCovered_m / 1000).toFixed(2)} km on road · {vehiclePos[0].toFixed(5)}°N, {vehiclePos[1].toFixed(5)}°E
            </span>
          </div>
        </div>
      </div>

      {/* Floating Speedometer Bubble (Top-Right / Google Maps style) */}
      <div className="absolute top-4 right-4 z-[1000] bg-gray-950/90 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-gray-800 shadow-2xl flex items-center gap-3 font-mono">
        <div className="flex flex-col">
          <span className="text-[9px] uppercase text-gray-500 font-bold">Speed</span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-cyan-300">
              {Math.round(currentSpeed)}
            </span>
            <span className="text-xs text-gray-400">km/h</span>
          </div>
        </div>

        <div className="w-px h-8 bg-gray-800" />

        <div className="flex flex-col items-end">
          <span className="text-[9px] uppercase text-emerald-400 font-bold flex items-center gap-1">
            🛣️ ROAD DISTANCE
          </span>
          <span className="text-xs font-bold text-gray-200">
            {(journeyCovered_m / 1000).toFixed(2)} / {(journey.totalDistance_m / 1000).toFixed(2)} km
          </span>
          <span className="text-[8px] text-gray-400">
            (Displacement: {(journey.straightDisplacement_m / 1000).toFixed(1)} km · +{journey.detourPct}% Detour)
          </span>
        </div>
      </div>

      {/* Bottom Floating Snap-to-Vehicle Button */}
      <div className="absolute bottom-4 left-4 z-[1000]">
        <button
          onClick={() => {
            if (map) {
              map.setView(vehiclePos, 15, { animate: true });
            }
          }}
          className="bg-gray-950/90 hover:bg-gray-900 border border-gray-800 text-cyan-300 px-3 py-1.5 rounded-xl shadow-xl font-mono text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer hover:border-cyan-500/50"
        >
          <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
          <span>Center Vehicle</span>
        </button>
      </div>
    </div>
  );
};
