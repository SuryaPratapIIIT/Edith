import React, { useState, useEffect, useRef } from 'react';
import {
  AlertLevel,
  PaceStatusResult,
  VehicleClass,
  VoiceLanguage,
  ChallanEvent
} from './types/pace';
import { pace_status } from './engine/paceEngine';
import {
  generateCheckpointWarning,
  generateSpotFOVWarning,
  detectNewCheckpoint,
  CheckpointWarning
} from './engine/warningEngine';
import { voiceCoach } from './services/voiceCoach';
import { bolnaVoiceService, BolnaTelemetryContext } from './services/bolnaVoiceService';
import {
  planJourney,
  planDynamicJourney,
  PlannedJourney,
  CameraEnforcementZone,
  RouteCameraSpot
} from './services/journeyService';
import { GurgaonPlace, createCustomPlace } from './data/gurgaonPlaces';
import { gpsTrackingService, LiveGPSFix } from './services/gpsTrackingService';
import { ExpresswayMap } from './components/ExpresswayMap';
import { TopControlNavBar } from './components/TopControlNavBar';
import { RoutePlanningView } from './components/RoutePlanningView';
import { ActiveTripView } from './components/ActiveTripView';
import type { SectionSummaryResult } from './components/JourneySectionStepper';
import { JourneySummaryModal } from './components/JourneySummaryModal';
import { PACE_CONFIG, apiUrl } from './config/env';

export default function App() {
  // 1. Planned Journey State (Unified Continuous Journey)
  const [journey, setJourney] = useState<PlannedJourney>(() =>
    planJourney('place-ambience', 'place-rajiv-chowk')
  );
  const [currentScreen, setCurrentScreen] = useState<'planning' | 'navigation'>('planning');
  const [tunnelOnline, setTunnelOnline] = useState<boolean | null>(null);

  useEffect(() => {
    const checkTunnel = () => {
      fetch(apiUrl('/api/tunnel/status')).then(r => r.json()).then(data => setTunnelOnline(Boolean(data?.active && data?.status === 'healthy')))
        .catch(() => setTunnelOnline(false));
    };
    checkTunnel();
    const iv = setInterval(checkTunnel, 10000);
    return () => clearInterval(iv);
  }, []);

  const handleStartNavigation = () => {
    setCurrentScreen('navigation');
    setIsPlaying(true);
    voiceCoach.triggerRoutePlanned(
      journey.origin.name,
      journey.destination.name,
      journey.cameras.length,
      journey.totalDistance_m / 1000
    );
    if (!bolnaVoiceService.isCallActive() && !bolnaVoiceService.isConnecting()) {
      bolnaVoiceService.startCall(bolnaTelemetryContext).catch(() => {});
    }
  };

  const handleStopTrip = () => {
    setIsPlaying(false);
    setCurrentScreen('planning');
    bolnaVoiceService.clearQueueAndStopAudio();
  };

  // Dynamic Routing, Real-Time GPS & Map Pick State
  const [isLoadingRoute, setIsLoadingRoute] = useState<boolean>(false);
  const [isMapPickActive, setIsMapPickActive] = useState<boolean>(false);
  const [mapPickTarget, setMapPickTarget] = useState<'origin' | 'destination' | null>(null);
  const [trackingMode, setTrackingMode] = useState<'simulated' | 'live_gps'>('simulated');
  const [_isLocatingUser, setIsLocatingUser] = useState<boolean>(false);
  const [_gpsNotice, setGpsNotice] = useState<string | null>(null);
  const [_gpsError, setGpsError] = useState<string | null>(null);

  // 2. Continuous Journey Telemetry (meters from trip start, seconds from trip start)
  const [currentSpeedThrottle, setCurrentSpeedThrottle] = useState<number>(70);
  const [telemetry, setTelemetry] = useState<{
    journeyCovered_m: number;
    journeyElapsed_s: number;
  }>({
    journeyCovered_m: 0,
    journeyElapsed_s: 0
  });
  const { journeyCovered_m, journeyElapsed_s } = telemetry;

  // 3. Navigation & Camera Follow State
  const [isFollowingVehicle, setIsFollowingVehicle] = useState<boolean>(true);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [voiceLanguage, _setVoiceLanguage] = useState<VoiceLanguage>('hinglish');

  // 4. Zone Tracking & Challan State
  const [sectionHistory, setSectionHistory] = useState<SectionSummaryResult[]>([]);
  const [challanHistory, setChallanHistory] = useState<ChallanEvent[]>([]);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState<boolean>(false);
  const [zoneEntryElapsed_s, setZoneEntryElapsed_s] = useState<number>(0);
  const currentZoneIndexRef = useRef<number | null>(null);
  const prevCoveredInZoneRef = useRef<number>(0);
  const firedCheckpointsRef = useRef<Set<number>>(new Set());
  const checkedSpotCamerasRef = useRef<Set<string>>(new Set());
  const alertedCameras100mRef = useRef<Set<string>>(new Set());
  const completedZonesRef = useRef<Set<number>>(new Set());
  const zoneEntryTimesRef = useRef<Record<number, number>>({});

  // 5. Warnings and Spot FOV State
  const [_activeWarning, setActiveWarning] = useState<CheckpointWarning | null>(null);
  const [_warningHistory, setWarningHistory] = useState<CheckpointWarning[]>([]);
  const [hasSpotChallan, setHasSpotChallan] = useState<boolean>(false);
  const spotChallanTriggeredRef = useRef<boolean>(false);
  const lastAlertLevelRef = useRef<AlertLevel>('green');
  const lastTelemetrySyncTimeRef = useRef<number>(0);
  const lastBackendFailTimeRef = useRef<number>(0);
  const lastSentTelemetryRef = useRef<{
    speed: number;
    covered: number;
    alert: string;
    camera: string;
    challanCount: number;
    distToCamera: number;
  } | null>(null);

  // Vehicle class and safety configs
  const vehicleClass: VehicleClass = 'car';
  const safetyMargin = PACE_CONFIG.MARGIN;
  const amberGap = PACE_CONFIG.AMBER_GAP_KMH;

  // Sync Voice Language & Mute
  useEffect(() => {
    voiceCoach.setMuted(isMuted);
    voiceCoach.setLanguage(voiceLanguage);
  }, [isMuted, voiceLanguage]);

  // Determine current Zone along the continuous journey
  const activeZoneIndex = journey.enforcementZones.findIndex(
    z => journeyCovered_m >= z.startJourneyDist_m && journeyCovered_m <= z.endJourneyDist_m
  );
  const activeZone: CameraEnforcementZone | null =
    activeZoneIndex !== -1 ? journey.enforcementZones[activeZoneIndex] : null;
  const isEnforcementActive = activeZone !== null;

  // Next Camera lookup (for normal routing stretch)
  const nextCamera: RouteCameraSpot | null =
    journey.cameras.find(c => c.journeyDistance_m > journeyCovered_m) || null;
  const distToNextCamera_m = nextCamera ? Math.max(0, nextCamera.journeyDistance_m - journeyCovered_m) : 0;
  const distToDestination_m = Math.max(0, journey.totalDistance_m - journeyCovered_m);

  // Posted Limit for current stretch
  const postedLimit = activeZone ? activeZone.limit_kmh : 70;

  // Active Zone Transition Hook: When vehicle enters a new camera enforcement zone
  useEffect(() => {
    if (activeZoneIndex !== currentZoneIndexRef.current) {
      currentZoneIndexRef.current = activeZoneIndex;
      setZoneEntryElapsed_s(journeyElapsed_s);
      prevCoveredInZoneRef.current = 0;
      firedCheckpointsRef.current = new Set();
      setActiveWarning(null);

      if (activeZone && isPlaying && activeZoneIndex > 0) {
        voiceCoach.triggerSectionTransition(
          activeZone.startCamera.name,
          currentPace?.currentAvg_kmh || postedLimit,
          activeZone.endCamera.name,
          activeZone.limit_kmh
        );
      }
    }
  }, [activeZoneIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Compute Active Zone Telemetry & Pace Status
  let coveredInZone_m = 0;
  let elapsedInZone_s = 0;
  let currentPace: PaceStatusResult;

  if (activeZone) {
    coveredInZone_m = Math.max(0, journeyCovered_m - activeZone.startJourneyDist_m);
    elapsedInZone_s = Math.max(0.1, journeyElapsed_s - zoneEntryElapsed_s);

    currentPace = pace_status(
      activeZone.length_m,
      postedLimit,
      elapsedInZone_s,
      coveredInZone_m,
      currentSpeedThrottle,
      safetyMargin,
      amberGap
    );

    // 20m FOV proximity check against bounding cameras
    const distToCam1 = coveredInZone_m;
    const distToCam2 = Math.max(0, activeZone.length_m - coveredInZone_m);
    const inFOV = distToCam1 <= 20 || distToCam2 <= 20;
    const camName = distToCam1 <= 20 ? activeZone.startCamera.name : activeZone.endCamera.name;
    const isSpotViolation = inFOV && currentSpeedThrottle > postedLimit;

    currentPace.cameraFOV = {
      inCameraFOV: inFOV,
      cameraName: inFOV ? camName : null,
      distanceToCamera_m: Math.min(distToCam1, distToCam2),
      spotViolation: isSpotViolation,
      violationSpeed_kmh: isSpotViolation ? currentSpeedThrottle : undefined
    };
  } else {
    // Normal Map Routing (outside camera speed enforcement)
    currentPace = {
      state: 'active',
      max_avg_kmh: null,
      alert: currentSpeedThrottle > postedLimit + 5 ? 'red' : currentSpeedThrottle > postedLimit ? 'amber' : 'green',
      checkpoint: 0,
      effectiveLimit_kmh: postedLimit,
      t_min_s: distToDestination_m / (postedLimit / 3.6),
      elapsed_s: journeyElapsed_s,
      covered_m: journeyCovered_m,
      remaining_m: distToDestination_m,
      need_s: distToDestination_m / (postedLimit / 3.6),
      speed_kmh: currentSpeedThrottle,
      currentAvg_kmh: currentSpeedThrottle,
      banked_time_s: 0,
      cameraFOV: {
        inCameraFOV: false,
        cameraName: null,
        distanceToCamera_m: distToNextCamera_m,
        spotViolation: false
      }
    };
  }

  // Record Zone Entry Times along journey
  useEffect(() => {
    journey.enforcementZones.forEach(z => {
      if (journeyCovered_m >= z.startJourneyDist_m && zoneEntryTimesRef.current[z.sectionIndex] === undefined) {
        zoneEntryTimesRef.current[z.sectionIndex] = journeyElapsed_s;
      }
    });
  }, [journeyCovered_m, journeyElapsed_s, journey.enforcementZones]);

  // 1. Instantaneous Spot Camera Radar Check: Detects speed at camera gantry + 100m proximity warning
  useEffect(() => {
    journey.cameras.forEach(cam => {
      const distDelta = journeyCovered_m - cam.journeyDistance_m;

      // 100m Camera Proximity Voice Alert Trigger: between 30m and 120m before camera
      if (distDelta >= -120 && distDelta <= -30) {
        if (!alertedCameras100mRef.current.has(cam.id)) {
          alertedCameras100mRef.current.add(cam.id);
          const distRemaining = Math.max(10, Math.round(Math.abs(distDelta)));
          voiceCoach.triggerCameraNearby100m(cam.name, cam.limit_kmh, distRemaining, currentSpeedThrottle);
        }
      }

      // Proximity radar window: within 20m before to 30m after gantry
      if (distDelta >= -20 && distDelta <= 30) {
        if (!checkedSpotCamerasRef.current.has(cam.id)) {
          if (currentSpeedThrottle > cam.limit_kmh) {
            checkedSpotCamerasRef.current.add(cam.id);
            setHasSpotChallan(true);

            const excess = Math.round(currentSpeedThrottle - cam.limit_kmh);
            const newSpotChallan: ChallanEvent = {
              id: `spot-${cam.id}-${Date.now()}`,
              type: 'spot_challan',
              title: 'Instantaneous Camera Spot Risk',
              cameraName: cam.name,
              sectionName: cam.name,
              recordedSpeed_kmh: Math.round(currentSpeedThrottle),
              limit_kmh: cam.limit_kmh,
              excessSpeed_kmh: excess,
              riskLevel: 'high_risk',
              timestamp_s: Math.round(journeyElapsed_s),
              journeyDistance_m: Math.round(cam.journeyDistance_m),
              description: `Radar at ${cam.name} recorded instant crossing speed of ${Math.round(currentSpeedThrottle)} km/h exceeding the ${cam.limit_kmh} km/h limit. High risk of spot challan in this camera region.`
            };

            setChallanHistory(prev => [...prev, newSpotChallan]);
            voiceCoach.triggerSpotChallan(cam.name, currentSpeedThrottle, cam.limit_kmh);

            const fovWarning = generateSpotFOVWarning({
              cameraName: cam.name,
              currentSpeed_kmh: currentSpeedThrottle,
              limit_kmh: cam.limit_kmh,
              distanceToCamera_m: Math.abs(distDelta)
            });
            setActiveWarning(fovWarning);
          }
        }
      } else if (distDelta > 30) {
        checkedSpotCamerasRef.current.add(cam.id);
      }
    });
  }, [journeyCovered_m, currentSpeedThrottle, journey.cameras, journeyElapsed_s]);

  // 2. Sectional Speed Challan Evaluation: Average speed between two cameras
  useEffect(() => {
    journey.enforcementZones.forEach(z => {
      const isPastZoneEnd = journeyCovered_m >= z.endJourneyDist_m;
      const isDestinationReached = journeyCovered_m >= journey.totalDistance_m && journeyCovered_m >= z.startJourneyDist_m;

      if ((isPastZoneEnd || isDestinationReached) && !completedZonesRef.current.has(z.sectionIndex)) {
        completedZonesRef.current.add(z.sectionIndex);

        const entryTime = zoneEntryTimesRef.current[z.sectionIndex] ?? 0;
        const elapsedInZone = Math.max(0.5, journeyElapsed_s - entryTime);
        const finalAvg = (z.length_m / elapsedInZone) * 3.6;
        const hasSpeedViolation = finalAvg > z.limit_kmh;

        if (hasSpeedViolation) {
          const excess = Math.round((finalAvg - z.limit_kmh) * 10) / 10;
          const newSpeedChallan: ChallanEvent = {
            id: `speed-${z.sectionIndex}-${Date.now()}`,
            type: 'speed_challan',
            title: 'Average Speed Corridor Risk',
            sectionName: z.name,
            cameraName: `${z.startCamera.name} → ${z.endCamera.name}`,
            recordedSpeed_kmh: Math.round(finalAvg * 10) / 10,
            limit_kmh: z.limit_kmh,
            excessSpeed_kmh: excess,
            riskLevel: 'high_risk',
            timestamp_s: Math.round(journeyElapsed_s),
            journeyDistance_m: Math.round(z.endJourneyDist_m),
            description: `Average speed over ${(z.length_m / 1000).toFixed(2)} km road section was ${finalAvg.toFixed(1)} km/h exceeding the ${z.limit_kmh} km/h limit. High risk of speed challan in this region.`
          };

          setChallanHistory(prev => [...prev, newSpeedChallan]);
          voiceCoach.triggerSpeedChallan(z.name, finalAvg, z.limit_kmh);
        }

        const hadSpotInThisZone = challanHistory.some(
          c => c.type === 'spot_challan' && c.journeyDistance_m >= z.startJourneyDist_m - 30 && c.journeyDistance_m <= z.endJourneyDist_m + 30
        );

        const summary: SectionSummaryResult = {
          sectionIndex: z.sectionIndex,
          name: z.name,
          length_m: z.length_m,
          elapsed_s: elapsedInZone,
          avgSpeed_kmh: Number(finalAvg.toFixed(1)),
          limit_kmh: z.limit_kmh,
          hasViolation: hasSpeedViolation,
          hadSpotChallan: hadSpotInThisZone || hasSpotChallan
        };

        setSectionHistory(prevList => {
          const filtered = prevList.filter(p => p.sectionIndex !== z.sectionIndex);
          return [...filtered, summary];
        });

        const nextZone = journey.enforcementZones[z.sectionIndex + 1];
        if (nextZone) {
          voiceCoach.triggerSectionTransition(
            z.name,
            finalAvg,
            nextZone.name,
            nextZone.limit_kmh
          );
        }
      }
    });
  }, [journeyCovered_m, journeyElapsed_s, journey.enforcementZones, journey.totalDistance_m, challanHistory, hasSpotChallan]);

  // Checkpoint Warning Detection: Fires prescriptive warnings at 25%, 50%, 75%, 100% inside camera zone
  useEffect(() => {
    if (!activeZone) return;

    const prev = prevCoveredInZoneRef.current;
    const newCovered = coveredInZone_m;
    prevCoveredInZoneRef.current = newCovered;

    const cp = detectNewCheckpoint(prev, newCovered, activeZone.length_m);
    if (cp === null) return;
    if (firedCheckpointsRef.current.has(cp)) return;
    firedCheckpointsRef.current.add(cp);

    const warning = generateCheckpointWarning({
      checkpoint: cp,
      ceiling_kmh: currentPace.max_avg_kmh,
      currentSpeed_kmh: currentSpeedThrottle,
      currentAvg_kmh: currentPace.currentAvg_kmh,
      banked_time_s: currentPace.banked_time_s,
      remaining_m: currentPace.remaining_m,
      limit_kmh: postedLimit,
      elapsed_s: Math.round(elapsedInZone_s),
      hasSpotChallan: hasSpotChallan || currentPace.cameraFOV?.spotViolation
    });

    setActiveWarning(warning);
    setWarningHistory(prevList => [...prevList, warning]);
    voiceCoach.triggerCheckpointWarning(warning, currentSpeedThrottle, postedLimit);

    const t = setTimeout(() => {
      setActiveWarning(w => (w?.checkpoint === cp ? null : w));
    }, 7000);
    return () => clearTimeout(t);
  }, [coveredInZone_m, activeZone]); // eslint-disable-line react-hooks/exhaustive-deps

  // Voice alert on Pace Alert shift (Green / Amber / Red)
  useEffect(() => {
    if (isEnforcementActive && currentPace.alert !== lastAlertLevelRef.current) {
      lastAlertLevelRef.current = currentPace.alert;
      voiceCoach.triggerPaceAlert(
        currentPace.alert,
        currentPace.speed_kmh,
        currentPace.max_avg_kmh,
        postedLimit,
        currentPace.state
      );
    }
  }, [currentPace.alert, isEnforcementActive, currentPace.speed_kmh, currentPace.max_avg_kmh, postedLimit, currentPace.state]);

  // Destination Arrival Hook: Announces challan verdict & automatically cuts the Friday call
  const hasAnnouncedCompletionRef = useRef<boolean>(false);
  useEffect(() => {
    const isAtDestination = journeyCovered_m >= journey.totalDistance_m && journeyElapsed_s > 0;
    if (isAtDestination && !hasAnnouncedCompletionRef.current) {
      hasAnnouncedCompletionRef.current = true;
      setIsPlaying(false);
      const totalChallans = challanHistory.length;

      voiceCoach.triggerJourneyComplete(
        journey.destination.name,
        journey.totalDistance_m / 1000,
        journey.cameras.length,
        totalChallans
      ).finally(() => {
        setIsSummaryModalOpen(true);
      });

      // Safety guard: ensure summary modal opens within 4s regardless of audio drivers
      const timer = setTimeout(() => {
        setIsSummaryModalOpen(true);
        if (bolnaVoiceService.isCallActive() || bolnaVoiceService.isConnecting()) {
          bolnaVoiceService.stopCall().catch(() => {});
        }
      }, 4000);

      return () => clearTimeout(timer);
    }
  }, [journeyCovered_m, journey.totalDistance_m, journeyElapsed_s, challanHistory.length, journey.cameras.length, journey.destination.name]);

  // Pre-Ride Route Context Sync:
  // Fires immediately whenever a journey is loaded or changed (route switch, map pick, preset).
  // Ensures FRIDAY always has the correct origin/destination/camera data even before "Start Ride".
  // Sends speed = 0 so the backend session reflects a stationary pre-ride state, not the slider value.
  useEffect(() => {
    const firstCamera = journey.cameras[0] ?? null;
    fetch(apiUrl('/api/telemetry/live'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: 'live_ride',
        section_name: 'Open Gurugram Road Alignment',
        speed_kmh: 0,
        limit_kmh: 70,
        ceiling_kmh: 70,
        current_avg_kmh: 0,
        banked_time_s: 0,
        covered_m: 0,
        remaining_m: Math.round(journey.totalDistance_m),
        next_camera: firstCamera ? firstCamera.name : 'Upcoming GMDA ANPR Camera',
        distance_to_camera_m: firstCamera ? Math.round(firstCamera.journeyDistance_m) : 0,
        challan_risk: 'Zero Challan Risk (Clean Record)',
        alert: 'green',
        language: voiceLanguage,
        route_origin: journey.origin.name,
        route_destination: journey.destination.name,
        total_journey_m: Math.round(journey.totalDistance_m),
        journey_elapsed_s: 0,
        total_cameras: journey.cameras.length,
        cleared_cameras: 0,
        cameras_passed: 0,
        cameras_remaining: journey.cameras.length,
        passed_camera_names: [],
        challan_count: 0
      })
    }).catch(() => {}); // Non-blocking — silent fail if backend not yet up
  }, [journey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Continuous 10 FPS Google Maps Real-Time Replay Loop
  useEffect(() => {
    if (!isPlaying) return;

    const intervalMs = 100;
    const timer = setInterval(() => {
      setTelemetry((prev) => {
        if (prev.journeyCovered_m >= journey.totalDistance_m) {
          setIsPlaying(false);
          return prev;
        }

        const delta_s = (intervalMs / 1000) * playbackSpeed;
        const delta_m = (currentSpeedThrottle / 3.6) * delta_s;
        const nextCovered = Math.min(journey.totalDistance_m, prev.journeyCovered_m + delta_m);

        return {
          journeyCovered_m: nextCovered,
          journeyElapsed_s: prev.journeyElapsed_s + delta_s
        };
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, currentSpeedThrottle, playbackSpeed, journey.totalDistance_m]);

  // Reset entire journey simulation
  const handleReset = () => {
    hasAnnouncedCompletionRef.current = false;
    setIsPlaying(false);
    setTelemetry({ journeyCovered_m: 0, journeyElapsed_s: 0 });
    setSectionHistory([]);
    setChallanHistory([]);
    checkedSpotCamerasRef.current.clear();
    alertedCameras100mRef.current.clear();
    completedZonesRef.current.clear();
    zoneEntryTimesRef.current = {};
    currentZoneIndexRef.current = null;
    setZoneEntryElapsed_s(0);
    prevCoveredInZoneRef.current = 0;
    firedCheckpointsRef.current = new Set();
    setHasSpotChallan(false);
    spotChallanTriggeredRef.current = false;
    setActiveWarning(null);
    setWarningHistory([]);
    lastAlertLevelRef.current = 'green';
    bolnaVoiceService.clearQueueAndStopAudio();
  };

  // Dynamic Route Planning Handlers (Supports ANY place, sector, or map click in Gurugram)
  const handleSelectOriginPlace = async (place: GurgaonPlace) => {
    setIsLoadingRoute(true);
    try {
      const newJourney = await planDynamicJourney(place, journey.destination);
      setJourney(newJourney);
      handleReset();
    } catch (err) {
      console.error('Failed to plan dynamic journey:', err);
    } finally {
      setIsLoadingRoute(false);
    }
  };

  const handleSelectDestinationPlace = async (place: GurgaonPlace) => {
    setIsLoadingRoute(true);
    try {
      const newJourney = await planDynamicJourney(journey.origin, place);
      setJourney(newJourney);
      handleReset();
    } catch (err) {
      console.error('Failed to plan dynamic journey:', err);
    } finally {
      setIsLoadingRoute(false);
    }
  };

  const handleSwapPlaces = async () => {
    setIsLoadingRoute(true);
    try {
      const newJourney = await planDynamicJourney(journey.destination, journey.origin);
      setJourney(newJourney);
      handleReset();
    } catch (err) {
      console.error('Failed to swap places:', err);
    } finally {
      setIsLoadingRoute(false);
    }
  };

  const handleToggleMapPick = (target: 'origin' | 'destination') => {
    if (isMapPickActive && mapPickTarget === target) {
      setIsMapPickActive(false);
      setMapPickTarget(null);
    } else {
      setIsMapPickActive(true);
      setMapPickTarget(target);
    }
  };

  const handleMapClick = async (lat: number, lon: number) => {
    if (!isMapPickActive || !mapPickTarget) return;

    const customPlace = createCustomPlace(lat, lon);
    const target = mapPickTarget;
    setIsMapPickActive(false);
    setMapPickTarget(null);

    if (target === 'origin') {
      await handleSelectOriginPlace(customPlace);
    } else {
      await handleSelectDestinationPlace(customPlace);
    }
  };

  // 1-Click "My Location" GPS Resolver
  const handleUseCurrentLocation = async () => {
    setIsLocatingUser(true);
    setGpsError(null);
    setGpsNotice(null);
    try {
      const pos = await gpsTrackingService.getCurrentPosition();
      const isNCR = pos.lat >= 28.1 && pos.lat <= 28.8 && pos.lon >= 76.6 && pos.lon <= 77.4;
      let placeLat = pos.lat;
      let placeLon = pos.lon;
      let placeName = '📍 My Current Location';

      if (!isNCR) {
        placeLat = 28.4980;
        placeLon = 77.0890;
        placeName = '📍 Gurugram Location (Near Cyber City)';
        setGpsNotice('Device GPS is outside Gurugram; starting from Cyber City corridor.');
      } else {
        setGpsNotice('Live device GPS lock acquired in Gurugram.');
      }

      const currentPlace = createCustomPlace(placeLat, placeLon, placeName);
      await handleSelectOriginPlace(currentPlace);
    } catch (err: any) {
      console.warn('Geolocation error:', err);
      setGpsError(err.message || 'Unable to retrieve device GPS. Check location permissions.');
    } finally {
      setIsLocatingUser(false);
    }
  };

  // Real-Time GPS Tracking Stream Effect
  useEffect(() => {
    if (trackingMode !== 'live_gps') {
      gpsTrackingService.stopTracking();
      return;
    }

    gpsTrackingService.startTracking(
      journey.fullPolyline,
      (fix: LiveGPSFix) => {
        setGpsError(null);
        setTelemetry(prev => ({
          journeyCovered_m: fix.journeyCovered_m,
          journeyElapsed_s: prev.journeyElapsed_s + 1
        }));
        if (fix.speed_kmh >= 0) {
          setCurrentSpeedThrottle(Math.max(0, fix.speed_kmh));
        }
      },
      (err) => {
        setGpsError(`Device GPS Error: ${err.message}. Switched to simulation.`);
        setTrackingMode('simulated');
      }
    );

    return () => {
      gpsTrackingService.stopTracking();
    };
  }, [trackingMode, journey.fullPolyline]);


  // Active checkpoint index (1, 2, 3, 4)
  const activeCheckpointIndex = activeZone
    ? Math.min(4, Math.max(1, Math.floor((coveredInZone_m / activeZone.length_m) * 4) + 1))
    : null;

  // Real-time camera calculations
  const passedCameras = journey.cameras.filter(c => c.journeyDistance_m <= journeyCovered_m);
  const clearedCamerasCount = passedCameras.length;
  const remainingCamerasCount = Math.max(0, journey.cameras.length - clearedCamerasCount);
  const passedCameraNames = passedCameras.map(c => c.name);

  // Real-time telemetry context prepared for Bolna Voice AI Agent (FRIDAY)
  const bolnaTelemetryContext: BolnaTelemetryContext = {
    route_id: `${journey.origin.id}_to_${journey.destination.id}`,
    route_origin: journey.origin.name,
    route_destination: journey.destination.name,
    vehicle_class: vehicleClass,
    posted_speed_limit: postedLimit,
    current_speed: Math.round(currentSpeedThrottle),
    current_avg_speed: Math.round(currentPace.currentAvg_kmh),
    pace_ceiling: currentPace.max_avg_kmh !== null ? Math.round(currentPace.max_avg_kmh) : postedLimit,
    section_name: activeZone ? activeZone.name : 'Open Gurugram Road Alignment',
    next_camera: nextCamera ? nextCamera.name : 'Upcoming GMDA ANPR Camera',
    distance_to_camera_m: Math.round(distToNextCamera_m),
    remaining_km: Number((distToDestination_m / 1000).toFixed(1)),
    status_alert: currentPace.alert,
    challan_risk:
      challanHistory.length > 0
        ? `High Challan Risk (${challanHistory.length} incident(s) in region)`
        : 'Zero Challan Risk (Safe & Clean Record)',
    total_cameras: journey.cameras.length,
    cleared_cameras: clearedCamerasCount,
    cameras_passed: clearedCamerasCount,
    cameras_remaining: remainingCamerasCount,
    passed_camera_names: passedCameraNames
  };

  // Smart Adaptive Telemetry Sync: Cuts HTTP network traffic by 85%+
  // Only transmits when meaningful driving telemetry changes OR on an idle 5-second keepalive
  useEffect(() => {
    const now = Date.now();
    const timeSinceLastSync = now - lastTelemetrySyncTimeRef.current;

    // Backoff if backend is temporarily unreachable
    if (lastBackendFailTimeRef.current > 0 && timeSinceLastSync < 5000) {
      return;
    }

    const currentSpeed = Math.round(currentSpeedThrottle);
    const covered = Math.round(journeyCovered_m);
    const cameraName = nextCamera ? nextCamera.name : 'Upcoming GMDA ANPR Camera';
    const distCamera = Math.round(distToNextCamera_m);
    const challanCount = challanHistory.length;
    const alert = currentPace.alert;
    const currentClearedCams = journey.cameras.filter(c => c.journeyDistance_m <= journeyCovered_m).length;

    const last = lastSentTelemetryRef.current;

    // Meaningful driving events (Zero-cache real-time dispatch):
    // 1. Speed changed by >= 0.5 km/h
    // 2. Traveled >= 10 meters
    // 3. Alert status changed (green <-> amber <-> red)
    // 4. Target camera changed or camera approach distance shifted >= 10m
    // 5. Challan status changed
    // 6. Camera crossed / passed count changed
    const lastDistToCamera = last ? ((last as any).distToCamera ?? 0) : 0;
    const hasMeaningfulChange =
      !last ||
      Math.abs(currentSpeed - last.speed) >= 0.5 ||
      Math.abs(covered - last.covered) >= 10 ||
      alert !== last.alert ||
      cameraName !== last.camera ||
      challanCount !== last.challanCount ||
      currentClearedCams !== (last as any).clearedCameras ||
      Math.abs(distCamera - lastDistToCamera) >= 10;

    // Guaranteed 1 Hz (1000ms) sync while ride is playing/driving, 2000ms when stationary
    const keepaliveThreshold = isPlaying ? 1000 : 2000;
    const isKeepaliveDue = timeSinceLastSync >= keepaliveThreshold;

    // If no meaningful change and keepalive interval not reached, SKIP network request!
    if (!hasMeaningfulChange && !isKeepaliveDue) {
      return;
    }

    // High-responsiveness microburst throttle: allow real-time updates every 250ms on slider/driving changes
    if (!isKeepaliveDue && timeSinceLastSync < 250) {
      return;
    }

    lastTelemetrySyncTimeRef.current = now;
    lastSentTelemetryRef.current = {
      speed: currentSpeed,
      covered,
      alert,
      camera: cameraName,
      challanCount,
      distToCamera: distCamera,
      clearedCameras: currentClearedCams
    } as any;

    const currentPassedCams = journey.cameras.filter(c => c.journeyDistance_m <= journeyCovered_m);
    const currentPassedCount = currentPassedCams.length;
    const currentRemainingCount = Math.max(0, journey.cameras.length - currentPassedCount);

    const payload = {
      session_id: 'live_ride',
      section_name: activeZone ? activeZone.name : 'Open Gurugram Road Alignment',
      speed_kmh: currentSpeed,
      limit_kmh: postedLimit,
      ceiling_kmh: currentPace.max_avg_kmh !== null ? Math.round(currentPace.max_avg_kmh) : postedLimit,
      current_avg_kmh: Math.round(currentPace.currentAvg_kmh),
      banked_time_s: Math.round(currentPace.banked_time_s),
      covered_m: covered,
      remaining_m: Math.round(distToDestination_m),
      next_camera: cameraName,
      distance_to_camera_m: distCamera,
      challan_risk:
        challanCount > 0
          ? `High Challan Risk (${challanCount} incident(s) in region)`
          : 'Zero Challan Risk (Clean Record)',
      alert: alert,
      language: voiceLanguage,
      route_origin: journey.origin.name,
      route_destination: journey.destination.name,
      total_journey_m: Math.round(journey.totalDistance_m),
      journey_elapsed_s: Math.round(journeyElapsed_s),
      total_cameras: journey.cameras.length,
      cleared_cameras: currentPassedCount,
      cameras_passed: currentPassedCount,
      cameras_remaining: currentRemainingCount,
      passed_camera_names: currentPassedCams.map(c => c.name),
      challan_count: challanCount
    };

    fetch(apiUrl('/api/telemetry/live'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => {
        if (res.ok) {
          lastBackendFailTimeRef.current = 0;
        } else {
          lastBackendFailTimeRef.current = Date.now();
        }
      })
      .catch(() => {
        lastBackendFailTimeRef.current = Date.now();
      });
  }, [
    journeyCovered_m,
    currentSpeedThrottle,
    postedLimit,
    activeZone,
    nextCamera,
    distToNextCamera_m,
    distToDestination_m,
    challanHistory.length,
    currentPace.alert,
    currentPace.max_avg_kmh,
    currentPace.currentAvg_kmh,
    currentPace.banked_time_s,
    voiceLanguage,
    journey,
    journeyElapsed_s
  ]);

  // 2-Second Idle Keepalive Pulse: Ensures stationary vehicles refresh live timestamp
  useEffect(() => {
    const keepaliveTimer = setInterval(() => {
      const now = Date.now();
      if (now - lastTelemetrySyncTimeRef.current >= 2000) {
        const currentKeepalivePassed = journey.cameras.filter(c => c.journeyDistance_m <= journeyCovered_m);
        const payload = {
          session_id: 'live_ride',
          section_name: activeZone ? activeZone.name : 'Open Gurugram Road Alignment',
          speed_kmh: Math.round(currentSpeedThrottle),
          limit_kmh: postedLimit,
          ceiling_kmh: currentPace.max_avg_kmh !== null ? Math.round(currentPace.max_avg_kmh) : postedLimit,
          current_avg_kmh: Math.round(currentPace.currentAvg_kmh),
          banked_time_s: Math.round(currentPace.banked_time_s),
          covered_m: Math.round(journeyCovered_m),
          remaining_m: Math.round(distToDestination_m),
          next_camera: nextCamera ? nextCamera.name : 'Upcoming GMDA ANPR Camera',
          distance_to_camera_m: Math.round(distToNextCamera_m),
          challan_risk:
            challanHistory.length > 0
              ? `High Challan Risk (${challanHistory.length} incident(s) in region)`
              : 'Zero Challan Risk (Clean Record)',
          alert: currentPace.alert,
          language: voiceLanguage,
          route_origin: journey.origin.name,
          route_destination: journey.destination.name,
          total_journey_m: Math.round(journey.totalDistance_m),
          journey_elapsed_s: Math.round(journeyElapsed_s),
          total_cameras: journey.cameras.length,
          cleared_cameras: currentKeepalivePassed.length,
          cameras_passed: currentKeepalivePassed.length,
          cameras_remaining: Math.max(0, journey.cameras.length - currentKeepalivePassed.length),
          passed_camera_names: currentKeepalivePassed.map(c => c.name),
          challan_count: challanHistory.length
        };
        lastTelemetrySyncTimeRef.current = now;
        fetch(apiUrl('/api/telemetry/live'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).catch(() => {});
      }
    }, 2000);

    return () => clearInterval(keepaliveTimer);
  }, [
    activeZone,
    currentSpeedThrottle,
    postedLimit,
    currentPace,
    journeyCovered_m,
    distToDestination_m,
    nextCamera,
    distToNextCamera_m,
    challanHistory.length,
    voiceLanguage,
    journey,
    journeyElapsed_s
  ]);

  // Handle Play/Pause with automatic Bolna AI Agent (FRIDAY) session launch
  const handleTogglePlay = () => {
    const nextPlaying = !isPlaying;
    setIsPlaying(nextPlaying);
    if (nextPlaying && !bolnaVoiceService.isCallActive() && !bolnaVoiceService.isConnecting()) {
      bolnaVoiceService.startCall(bolnaTelemetryContext).catch(err => {
        console.warn('Bolna voice auto-connect on ride start:', err);
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-gray-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black overflow-x-hidden">
      {/* 1. Upper Navbar: Speed Throttle, Stop/Start, Multipliers, Driver Mode & Screen Switcher */}
      <TopControlNavBar
        currentScreen={currentScreen}
        onChangeScreen={setCurrentScreen}
        currentSpeedThrottle={currentSpeedThrottle}
        onChangeSpeedThrottle={setCurrentSpeedThrottle}
        isPlaying={isPlaying}
        onTogglePlay={handleTogglePlay}
        onReset={handleReset}
        playbackSpeed={playbackSpeed}
        onChangePlaybackSpeed={setPlaybackSpeed}
        trackingMode={trackingMode}
        onToggleTrackingMode={setTrackingMode}
        tunnelOnline={tunnelOnline}
        postedLimit={postedLimit}
        ceilingSpeed={currentPace.max_avg_kmh}
      />

      {/* 2. Main Navigation Canvas with Underlying Dark Map & Side-Docked Automotive Cards */}
      <div className={`relative flex-1 w-full overflow-hidden flex transition-all duration-500 ${
        currentScreen === 'navigation'
          ? 'items-stretch justify-start p-1 sm:p-3 md:pl-5'
          : 'items-stretch justify-center lg:justify-start lg:pl-6 p-1 sm:p-2'
      }`}>
        {/* Full-Screen Underlying Dark-Themed Road Map */}
        <ExpresswayMap
          className="absolute inset-0 w-full h-full z-0"
          journey={journey}
          journeyCovered_m={journeyCovered_m}
          currentSpeed={currentSpeedThrottle}
          alert={currentPace.alert}
          isEnforcementActive={isEnforcementActive}
          activeZone={activeZone}
          cameraFOV={currentPace.cameraFOV}
          hasSpotChallan={hasSpotChallan}
          isFollowingVehicle={isFollowingVehicle}
          isMapPickActive={isMapPickActive}
          trackingMode={trackingMode}
          onMapClick={handleMapClick}
          showOverlays={false}
        />

        {/* Floating Mobile Smartphone Frame / Automotive HUD Cards (Docks to side during active ride) */}
        <div className={`relative z-10 w-full pointer-events-none flex flex-col justify-between py-1 sm:py-2 transition-all duration-500 ease-out ${
          currentScreen === 'navigation'
            ? 'max-w-[420px] md:max-w-[390px] h-full'
            : 'max-w-[420px] h-full max-h-full'
        }`}>
          {currentScreen === 'planning' ? (
            <RoutePlanningView
              journey={journey}
              isLoadingRoute={isLoadingRoute}
              isMapPickActive={isMapPickActive}
              onToggleMapPick={handleToggleMapPick}
              onUseCurrentLocation={handleUseCurrentLocation}
              onSelectOriginPlace={handleSelectOriginPlace}
              onSelectDestinationPlace={handleSelectDestinationPlace}
              onSwapPlaces={handleSwapPlaces}
              onStartNavigation={handleStartNavigation}
              bolnaTelemetryContext={bolnaTelemetryContext}
            />
          ) : (
            <ActiveTripView
              journey={journey}
              currentSpeed={currentSpeedThrottle}
              postedLimit={postedLimit}
              ceilingSpeed={currentPace.max_avg_kmh}
              alert={currentPace.alert}
              activeZone={activeZone}
              activeCheckpointIndex={activeCheckpointIndex}
              nextCamera={nextCamera}
              distToNextCamera_m={distToNextCamera_m}
              distToDestination_m={distToDestination_m}
              journeyCovered_m={journeyCovered_m}
              journeyElapsed_s={journeyElapsed_s}
              challanHistory={challanHistory}
              isPlaying={isPlaying}
              isMuted={isMuted}
              onTogglePlay={handleTogglePlay}
              onToggleMute={() => setIsMuted(!isMuted)}
              onCenterVehicle={() => setIsFollowingVehicle(true)}
              onStopTrip={handleStopTrip}
              onOpenRoutePlanner={() => setCurrentScreen('planning')}
              bolnaTelemetryContext={bolnaTelemetryContext}
              onOpenReport={() => setIsSummaryModalOpen(true)}
            />
          )}
        </div>
      </div>

      {/* 3. Journey Verdict Report Modal */}
      <JourneySummaryModal
        isOpen={isSummaryModalOpen}
        onClose={() => setIsSummaryModalOpen(false)}
        journey={journey}
        sectionHistory={sectionHistory}
        challanHistory={challanHistory}
        journeyElapsed_s={journeyElapsed_s}
        onReplay={handleReset}
      />
    </div>
  );
}
