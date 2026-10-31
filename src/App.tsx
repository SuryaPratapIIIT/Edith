import React, { useState, useEffect, useRef } from 'react';
import {
  AlertLevel,
  EnforcementSection,
  PaceStatusResult,
  VehicleClass,
  VoiceLanguage,
  CameraFOVStatus,
  ChallanEvent
} from './types/pace';
import { pace_status, checkGantryPreAlert } from './engine/paceEngine';
import {
  generateCheckpointWarning,
  generateSpotFOVWarning,
  detectNewCheckpoint,
  CheckpointWarning
} from './engine/warningEngine';
import { voiceCoach } from './services/voiceCoach';
import { bolnaVoiceService } from './services/bolnaVoiceService';
import {
  planJourney,
  planDynamicJourney,
  PlannedJourney,
  CameraEnforcementZone,
  RouteCameraSpot
} from './services/journeyService';
import { GurgaonPlace, getPlaceById, createCustomPlace } from './data/gurgaonPlaces';
import { gpsTrackingService, LiveGPSFix } from './services/gpsTrackingService';
import { SpeedometerGauge } from './components/SpeedometerGauge';
import { CheckpointTracker } from './components/CheckpointTracker';
import { ExpresswayMap } from './components/ExpresswayMap';
import { GoogleMapsNavBanner } from './components/GoogleMapsNavBanner';
import { GoogleMapsBottomBar } from './components/GoogleMapsBottomBar';
import { JourneyPlannerBar } from './components/JourneyPlannerBar';
import { JourneySectionStepper, SectionSummaryResult } from './components/JourneySectionStepper';
import { JourneySummaryModal } from './components/JourneySummaryModal';
import { BolnaVoiceControl } from './components/BolnaVoiceControl';
import { PACE_CONFIG } from './config/env';
import {
  ShieldCheck,
  Radio,
  Compass,
  Navigation,
  Crosshair,
  AlertTriangle,
  FileText
} from 'lucide-react';

export default function App() {
  // 1. Planned Journey State (Unified Continuous Journey)
  const [journey, setJourney] = useState<PlannedJourney>(() =>
    planJourney('place-ambience', 'place-rajiv-chowk')
  );

  // Dynamic Routing, Real-Time GPS & Map Pick State
  const [isLoadingRoute, setIsLoadingRoute] = useState<boolean>(false);
  const [isMapPickActive, setIsMapPickActive] = useState<boolean>(false);
  const [mapPickTarget, setMapPickTarget] = useState<'origin' | 'destination' | null>(null);
  const [trackingMode, setTrackingMode] = useState<'simulated' | 'live_gps'>('simulated');
  const [isLocatingUser, setIsLocatingUser] = useState<boolean>(false);
  const [gpsNotice, setGpsNotice] = useState<string | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);

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
  const [voiceLanguage, setVoiceLanguage] = useState<VoiceLanguage>('hinglish');

  // 4. Zone Tracking & Challan State
  const [sectionHistory, setSectionHistory] = useState<SectionSummaryResult[]>([]);
  const [challanHistory, setChallanHistory] = useState<ChallanEvent[]>([]);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState<boolean>(false);
  const zoneEntryElapsedRef = useRef<number>(0);
  const currentZoneIndexRef = useRef<number | null>(null);
  const prevCoveredInZoneRef = useRef<number>(0);
  const firedCheckpointsRef = useRef<Set<number>>(new Set());
  const checkedSpotCamerasRef = useRef<Set<string>>(new Set());
  const alertedCameras100mRef = useRef<Set<string>>(new Set());
  const completedZonesRef = useRef<Set<number>>(new Set());
  const zoneEntryTimesRef = useRef<Record<number, number>>({});

  // 5. Warnings and Spot FOV State
  const [activeWarning, setActiveWarning] = useState<CheckpointWarning | null>(null);
  const [warningHistory, setWarningHistory] = useState<CheckpointWarning[]>([]);
  const [hasSpotChallan, setHasSpotChallan] = useState<boolean>(false);
  const spotChallanTriggeredRef = useRef<boolean>(false);
  const lastAlertLevelRef = useRef<AlertLevel>('green');
  const lastTelemetrySyncTimeRef = useRef<number>(0);

  // Vehicle class and safety configs
  const [vehicleClass, setVehicleClass] = useState<VehicleClass>('car');
  const [safetyMargin, setSafetyMargin] = useState<number>(PACE_CONFIG.MARGIN);
  const [amberGap, setAmberGap] = useState<number>(PACE_CONFIG.AMBER_GAP_KMH);

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

  // Navigation Mode
  let navMode: 'normal_routing' | 'camera_enforcement' | 'destination_reached' = 'normal_routing';
  if (journeyCovered_m >= journey.totalDistance_m) {
    navMode = 'destination_reached';
  } else if (isEnforcementActive) {
    navMode = 'camera_enforcement';
  } else {
    navMode = 'normal_routing';
  }

  // Posted Limit for current stretch
  const postedLimit = activeZone ? activeZone.limit_kmh : 70;

  // Active Zone Transition Hook: When vehicle enters a new camera enforcement zone
  useEffect(() => {
    if (activeZoneIndex !== currentZoneIndexRef.current) {
      currentZoneIndexRef.current = activeZoneIndex;
      zoneEntryElapsedRef.current = journeyElapsed_s;
      prevCoveredInZoneRef.current = 0;
      firedCheckpointsRef.current = new Set();
      setActiveWarning(null);

      if (activeZone) {
        voiceCoach.triggerRoutePlanned(
          activeZone.startCamera.name,
          activeZone.endCamera.name,
          2,
          activeZone.length_m / 1000
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
    elapsedInZone_s = Math.max(0.1, journeyElapsed_s - zoneEntryElapsedRef.current);

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

  // Destination Arrival Hook
  useEffect(() => {
    if (journeyCovered_m >= journey.totalDistance_m && isPlaying) {
      setIsPlaying(false);
      voiceCoach.triggerJourneyComplete(
        journey.destination.name,
        journey.totalDistance_m / 1000,
        journey.cameras.length,
        challanHistory.length > 0 || sectionHistory.some(s => s.hasViolation)
      );
      setIsSummaryModalOpen(true);
    }
  }, [journeyCovered_m, journey.totalDistance_m, isPlaying, challanHistory.length, sectionHistory]);

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
    setIsPlaying(false);
    setTelemetry({ journeyCovered_m: 0, journeyElapsed_s: 0 });
    setSectionHistory([]);
    setChallanHistory([]);
    checkedSpotCamerasRef.current.clear();
    alertedCameras100mRef.current.clear();
    completedZonesRef.current.clear();
    zoneEntryTimesRef.current = {};
    currentZoneIndexRef.current = null;
    zoneEntryElapsedRef.current = 0;
    prevCoveredInZoneRef.current = 0;
    firedCheckpointsRef.current = new Set();
    setHasSpotChallan(false);
    spotChallanTriggeredRef.current = false;
    setActiveWarning(null);
    setWarningHistory([]);
    lastAlertLevelRef.current = 'green';
  };

  // Dynamic Route Planning Handlers (Supports ANY place, sector, or map click in Gurugram)
  const handleSelectOriginPlace = async (place: GurgaonPlace) => {
    setIsLoadingRoute(true);
    try {
      const newJourney = await planDynamicJourney(place, journey.destination);
      setJourney(newJourney);
      handleReset();
      voiceCoach.triggerRoutePlanned(
        newJourney.origin.name,
        newJourney.destination.name,
        newJourney.cameras.length,
        newJourney.totalDistance_m / 1000
      );
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
      voiceCoach.triggerRoutePlanned(
        newJourney.origin.name,
        newJourney.destination.name,
        newJourney.cameras.length,
        newJourney.totalDistance_m / 1000
      );
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
      voiceCoach.triggerRoutePlanned(
        newJourney.origin.name,
        newJourney.destination.name,
        newJourney.cameras.length,
        newJourney.totalDistance_m / 1000
      );
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

  const handleSelectPreset = async (originId: string, destId: string) => {
    const originPlace = getPlaceById(originId) || journey.origin;
    const destPlace = getPlaceById(destId) || journey.destination;
    setIsLoadingRoute(true);
    try {
      const newJourney = await planDynamicJourney(originPlace, destPlace);
      setJourney(newJourney);
      handleReset();
      voiceCoach.triggerRoutePlanned(
        newJourney.origin.name,
        newJourney.destination.name,
        newJourney.cameras.length,
        newJourney.totalDistance_m / 1000
      );
    } catch (err) {
      console.error('Failed to select preset:', err);
    } finally {
      setIsLoadingRoute(false);
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

  // Jump to specific camera section
  const handleJumpToSection = (idx: number) => {
    const targetZone = journey.enforcementZones[idx];
    if (targetZone) {
      setTelemetry(prev => ({
        journeyCovered_m: targetZone.startJourneyDist_m,
        journeyElapsed_s: prev.journeyElapsed_s
      }));
    }
  };

  // Active checkpoint index (1, 2, 3, 4)
  const activeCheckpointIndex = activeZone
    ? Math.min(4, Math.max(1, Math.floor((coveredInZone_m / activeZone.length_m) * 4) + 1))
    : null;

  // Real-time telemetry context prepared for Bolna Voice AI Agent (FRIDAY)
  const bolnaTelemetryContext = {
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
        : 'Zero Challan Risk (Safe & Clean Record)'
  };

  // Continuous Telemetry Sync to Backend: Keeps /api/live/status completely fresh in real time for Bolna AI
  useEffect(() => {
    const now = Date.now();
    // Throttle updates to ~300ms to guarantee zero-lag real-time sync without socket flooding
    if (now - lastTelemetrySyncTimeRef.current < 300) {
      return;
    }
    lastTelemetrySyncTimeRef.current = now;

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
      cleared_cameras: journey.cameras.filter(c => c.journeyDistance_m <= journeyCovered_m).length,
      challan_count: challanHistory.length
    };

    fetch('/api/telemetry/live', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(() => {});
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
    voiceLanguage
  ]);

  // Heartbeat Telemetry Sync: Guarantees /api/live/status stays alive even when the vehicle is stationary
  useEffect(() => {
    const heartbeatTimer = setInterval(() => {
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
        cleared_cameras: journey.cameras.filter(c => c.journeyDistance_m <= journeyCovered_m).length,
        challan_count: challanHistory.length
      };

      fetch('/api/telemetry/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(() => {});
    }, 1000);

    return () => clearInterval(heartbeatTimer);
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
    journey
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
    <div className="min-h-screen bg-[#07090e] text-gray-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black">
      {/* Top Streamlined Header Bar */}
      <header className="sticky top-0 z-50 bg-gray-950/90 backdrop-blur-xl border-b border-gray-800/80 px-4 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center shadow-[0_0_18px_rgba(6,182,212,0.4)] border border-cyan-400/30">
              <Compass className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black font-mono tracking-wider bg-gradient-to-r from-cyan-300 via-teal-200 to-white bg-clip-text text-transparent">
                VELO_AI
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono flex-wrap sm:flex-nowrap">
            {/* Bolna Voice AI Agent (FRIDAY) Live Control */}
            <BolnaVoiceControl telemetryContext={bolnaTelemetryContext} />

            {/* Live Challan Status Pill */}
            <button
              onClick={() => setIsSummaryModalOpen(true)}
              className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all cursor-pointer ${
                challanHistory.length > 0
                  ? 'bg-red-950/90 border-red-500 text-red-200 shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-pulse'
                  : 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60'
              }`}
            >
              {challanHistory.length > 0 ? (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                  <span className="font-bold">
                    {challanHistory.length} Challan Risk{challanHistory.length > 1 ? 's' : ''} in Region
                  </span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Zero Challan Risk · Safe</span>
                </>
              )}
            </button>

            {sectionHistory.length > 0 && (
              <button
                onClick={() => setIsSummaryModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-gray-900 hover:bg-gray-850 text-cyan-300 border border-cyan-500/40 flex items-center gap-1.5 transition-all cursor-pointer shadow-[0_0_10px_rgba(6,182,212,0.2)]"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Trip Verdict ({sectionHistory.length} cleared)</span>
              </button>
            )}

            <div className="bg-gray-900/90 px-3 py-1.5 rounded-xl border border-gray-800 text-gray-300 flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span>{(journeyCovered_m / 1000).toFixed(1)} / {(journey.totalDistance_m / 1000).toFixed(1)} km</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Navigation Canvas */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 flex flex-col gap-4">
        {/* 1. Origin & Destination Selector Bar */}
        <JourneyPlannerBar
          journey={journey}
          activeSectionIndex={activeZone?.sectionIndex ?? 0}
          isLoadingRoute={isLoadingRoute}
          isMapPickActive={isMapPickActive}
          mapPickTarget={mapPickTarget}
          trackingMode={trackingMode}
          isLocatingUser={isLocatingUser}
          gpsNotice={gpsNotice}
          gpsError={gpsError}
          onToggleTrackingMode={setTrackingMode}
          onUseCurrentLocation={handleUseCurrentLocation}
          onToggleMapPick={handleToggleMapPick}
          onSelectOriginPlace={handleSelectOriginPlace}
          onSelectDestinationPlace={handleSelectDestinationPlace}
          onSwapPlaces={handleSwapPlaces}
          onSelectPreset={handleSelectPreset}
        />

        {/* 2. Top Turn / Maneuver Banner */}
        <GoogleMapsNavBanner
          navMode={navMode}
          journey={journey}
          activeZone={activeZone}
          nextCamera={nextCamera}
          distToNextCamera_m={distToNextCamera_m}
          currentSpeed_kmh={currentSpeedThrottle}
          ceilingSpeed_kmh={currentPace.max_avg_kmh}
          currentAvg_kmh={currentPace.currentAvg_kmh}
          postedLimit={postedLimit}
          alert={currentPace.alert}
          activeCheckpointIndex={activeCheckpointIndex}
          cameraFOV={currentPace.cameraFOV}
          hasSpotChallan={hasSpotChallan || challanHistory.some(c => c.type === 'spot_challan')}
          challanHistory={challanHistory}
          destinationName={journey.destination.name}
          distToDestination_m={distToDestination_m}
          onOpenReport={() => setIsSummaryModalOpen(true)}
        />

        {/* 3. Central Cockpit Layout: Speedometer & Checkpoints (Left) + Leaflet Full Map (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Automotive Cockpit Instruments (4 cols) */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            <SpeedometerGauge
              currentSpeed={currentSpeedThrottle}
              ceilingSpeed={currentPace.max_avg_kmh}
              postedLimit={postedLimit}
              alert={currentPace.alert}
              state={currentPace.state}
              cameraFOV={currentPace.cameraFOV}
              hasSpotChallan={hasSpotChallan || challanHistory.some(c => c.type === 'spot_challan')}
              challanHistory={challanHistory}
            />

            {/* Checkpoint Tracker is active only inside camera zones */}
            {isEnforcementActive && activeZone ? (
              <CheckpointTracker
                pace={currentPace}
                sectionDistance_m={activeZone.length_m}
                activeWarning={activeWarning}
                warningHistory={warningHistory}
                onDismissWarning={() => setActiveWarning(null)}
                hasSpotChallan={hasSpotChallan}
              />
            ) : (
              <div className="bg-gray-900/90 rounded-2xl border border-gray-800 p-4 shadow-xl backdrop-blur-md flex flex-col gap-3 font-mono">
                <div className="flex items-center gap-2 text-cyan-400">
                  <Navigation className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Normal Road Navigation
                  </span>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed">
                  You are cruising on open road alignment outside ANPR camera traps. Average-speed enforcement is paused until entering the next camera gantry.
                </p>
                {nextCamera && (
                  <div className="bg-gray-950 p-2.5 rounded-xl border border-gray-800 flex items-center justify-between text-xs">
                    <span className="text-gray-400">Next ANPR Camera:</span>
                    <span className="font-bold text-cyan-300">
                      {nextCamera.name} (in {(distToNextCamera_m / 1000).toFixed(1)} km)
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Google Maps Seamless Viewport (8 cols) */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            <ExpresswayMap
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
            />
          </div>
        </div>

        {/* 4. Google Maps Bottom Bar: ETA, Distance Left, Speed Slider & Controls */}
        <GoogleMapsBottomBar
          isPlaying={isPlaying}
          onTogglePlay={handleTogglePlay}
          onReset={handleReset}
          playbackSpeed={playbackSpeed}
          onChangePlaybackSpeed={setPlaybackSpeed}
          currentSpeedThrottle={currentSpeedThrottle}
          onChangeSpeedThrottle={setCurrentSpeedThrottle}
          postedLimit={postedLimit}
          remainingDistance_m={distToDestination_m}
          totalDistance_m={journey.totalDistance_m}
          straightDisplacement_m={journey.straightDisplacement_m}
          detourPct={journey.detourPct}
          elapsed_s={journeyElapsed_s}
          destinationName={journey.destination.name}
          isMuted={isMuted}
          onToggleMute={() => setIsMuted(!isMuted)}
          voiceLanguage={voiceLanguage}
          onChangeVoiceLanguage={setVoiceLanguage}
          isFollowingVehicle={isFollowingVehicle}
          onToggleFollow={() => setIsFollowingVehicle(!isFollowingVehicle)}
        />
      </main>

      {/* Clean Minimal Footer */}
      <footer className="bg-gray-950 border-t border-gray-800/80 px-4 py-3 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-mono text-gray-500">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>VELO_AI · Real-Time Speed Compliance & ANPR Navigation</span>
          </div>

          <div className="flex items-center gap-3 text-[11px]">
            <span>Active Camera Pacing</span>
            <span>•</span>
            <span>Live Voice Guidance</span>
          </div>
        </div>
      </footer>

      {/* Journey Verdict Report Modal */}
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
