export type AlertLevel = 'green' | 'amber' | 'red';
export type SectionState = 'approaching' | 'active' | 'done';
export type VehicleClass = 'car' | 'bike' | 'truck';
export type VoiceLanguage = 'hinglish' | 'english' | 'hindi';

export interface Gantry {
  id: string;
  name: string;
  lat: number;
  lon: number;
  direction: string;
  kind: 'average' | 'spot' | 'display_only';
  source: string;
  verified_on: string;
  limit_kmh?: number;
  road?: string;
}

export interface EnforcementSection {
  id: string;
  name: string;
  expressway: string;
  startGantry: Gantry;
  endGantry: Gantry;
  length_m: number;
  displacement_m?: number; // Straight-line Euclidean chord displacement
  detourPct?: number;      // Road curvature detour percentage over chord displacement
  limit_kmh: number;
  vehicleLimits: Record<VehicleClass, number>;
  laneNote: string;
  polyline: [number, number][]; // [lat, lon]
  source: string;
  verified_on: string;
}

export interface GPSLocation {
  lat: number;
  lon: number;
  timestamp_s: number;
  speed_kmh: number;
}

export interface CameraFOVStatus {
  inCameraFOV: boolean; // Within 15m capture range of Camera 1 or Camera 2
  cameraName: string | null; // e.g. "Camera 1 Entry" or "Camera 2 Exit"
  distanceToCamera_m: number; // Distance in meters to closest camera
  spotViolation: boolean; // Speed exceeded limit while in 15m FOV
  violationSpeed_kmh?: number; // Speed recorded at time of violation
}

export interface ChallanEvent {
  id: string;
  type: 'speed_challan' | 'spot_challan';
  title: string;
  cameraName: string;
  sectionName?: string;
  recordedSpeed_kmh: number;
  limit_kmh: number;
  excessSpeed_kmh: number;
  riskLevel: 'high_risk' | 'critical';
  penalty_inr?: number; // Optional legacy metadata, never rendered as fine amount to user
  timestamp_s: number;
  journeyDistance_m: number;
  description: string;
}

export interface PaceStatusResult {
  state: SectionState;
  max_avg_kmh: number | null; // ceiling speed allowed for remainder
  alert: AlertLevel;
  checkpoint: number; // 0: 0-25%, 1: 25-50%, 2: 50-75%, 3: 75-100%, 4: 100% (done)
  effectiveLimit_kmh: number;
  t_min_s: number;
  elapsed_s: number;
  covered_m: number;
  remaining_m: number;
  need_s: number;
  speed_kmh: number;
  currentAvg_kmh: number;
  banked_time_s: number; // positive = ahead of minimum time, negative = deficit
  preAlert?: string | null; // '2km' | '500m' | null
  snappedPosition?: [number, number]; // Projected [lat, lon] on road
  crossTrackError_m?: number; // Distance from raw GPS to road center
  cameraFOV?: CameraFOVStatus; // 15m Camera Field of View status
  hasSpotChallan?: boolean; // True if a spot speed violation occurred in 15m FOV
}

export interface TimestampStep {
  timestampIndex: 1 | 2 | 3 | 4;
  checkpointPercent: 25 | 50 | 75 | 100;
  checkpointName: string;
  gpsLocation: GPSLocation;
  elapsed_s: number;
  covered_m: number; // Shortest road distance covered so far
  remaining_road_m?: number; // Shortest road distance remaining
  chord_displacement_m?: number; // Direct chord displacement (for comparison)
  speed_kmh: number;
  expectedCeiling_kmh: number | null;
  expectedAlert: AlertLevel;
  timelineEvent?: string; // Narrative timeline event ("At T=150s: Vehicle reached...")
  voicePrompt: {
    english: string;
    hinglish: string;
  };
  explanation: string;
}

export interface TestCaseScenario {
  id: string;
  title: string;
  description: string;
  persona: string;
  section: {
    length_m: number; // Shortest road network distance
    limit_kmh: number;
    margin: number;
    amber_gap_kmh: number;
    displacement_m?: number; // Direct Euclidean displacement
    detourFactor?: number; // Road distance / Displacement ratio
  };
  fourTimestamps: [TimestampStep, TimestampStep, TimestampStep, TimestampStep];
}

export interface SessionState {
  id: string;
  phone: string;
  vehicleClass: VehicleClass;
  sectionId: string;
  enteredAt: string;
  covered_m: number;
  lastSpeed_kmh: number;
  elapsed_s: number;
  currentPace: PaceStatusResult;
  updatedAt: string;
}

export interface BolnaCallLog {
  id: string;
  timestamp: string;
  direction: 'outbound' | 'inbound';
  type: 'pre_trip' | 'pace_query' | 'post_trip';
  transcript: string;
  status: 'completed' | 'in_progress' | 'failed';
  speedReported?: number;
  alertReported?: AlertLevel;
}
