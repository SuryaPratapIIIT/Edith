/**
 * Checkpoint Warning Engine
 * Generates contextual, prescriptive warnings at the 4 road-distance checkpoints.
 * Each warning includes the exact calculated ceiling speed the rider MUST stay below.
 *
 * Checkpoint triggers:
 *  CP-1: 25% of section road distance
 *  CP-2: 50% of section road distance
 *  CP-3: 75% of section road distance
 *  CP-4: 100% of section road distance (exit gantry)
 */

import type { AlertLevel, VoiceLanguage } from '../types/pace';

export type CheckpointIndex = 1 | 2 | 3 | 4;
export type WarningUrgency = 'critical' | 'warn' | 'caution' | 'ok' | 'done';

export interface CheckpointWarning {
  /** Which checkpoint fired this warning (1–4) */
  checkpoint: CheckpointIndex;
  /** Percentage of section completed */
  percent: 25 | 50 | 75 | 100;
  /** Urgency tier that drives color + sound */
  urgency: WarningUrgency;
  /** Short header line shown in the card */
  title: string;
  /** Full Hinglish message with actual numbers */
  hinglish: string;
  /** Full English message with actual numbers */
  english: string;
  /** Numeric ceiling the rider must stay under from here onward */
  ceiling_kmh: number | null;
  /** Current average speed at this checkpoint */
  currentAvg_kmh: number;
  /** Banked time in seconds (positive = ahead of budget) */
  banked_time_s: number;
  /** Remaining road distance in meters */
  remaining_m: number;
  /** Timestamp when warning was triggered */
  triggeredAt: number;
}

/** Map from urgency to Tailwind colour tokens (used by UI) */
export const URGENCY_COLORS: Record<WarningUrgency, {
  bg: string; border: string; title: string; glow: string; badge: string;
}> = {
  critical: {
    bg: 'bg-red-950/60',
    border: 'border-red-500/70',
    title: 'text-red-300',
    glow: 'shadow-[0_0_20px_rgba(239,68,68,0.45)]',
    badge: 'bg-red-500',
  },
  warn: {
    bg: 'bg-orange-950/60',
    border: 'border-orange-400/70',
    title: 'text-orange-300',
    glow: 'shadow-[0_0_20px_rgba(249,115,22,0.45)]',
    badge: 'bg-orange-500',
  },
  caution: {
    bg: 'bg-amber-950/60',
    border: 'border-amber-400/60',
    title: 'text-amber-300',
    glow: 'shadow-[0_0_16px_rgba(245,158,11,0.4)]',
    badge: 'bg-amber-500',
  },
  ok: {
    bg: 'bg-emerald-950/50',
    border: 'border-emerald-500/60',
    title: 'text-emerald-300',
    glow: 'shadow-[0_0_16px_rgba(16,185,129,0.3)]',
    badge: 'bg-emerald-500',
  },
  done: {
    bg: 'bg-cyan-950/50',
    border: 'border-cyan-400/60',
    title: 'text-cyan-300',
    glow: 'shadow-[0_0_20px_rgba(6,182,212,0.35)]',
    badge: 'bg-cyan-500',
  },
};

/**
 * Determines urgency tier from how far current speed is above or below ceiling.
 */
function classifyUrgency(
  speed_kmh: number,
  ceiling_kmh: number | null,
  limit_kmh: number,
  checkpoint: CheckpointIndex,
  banked_time_s: number
): WarningUrgency {
  if (checkpoint === 4) return 'done';
  if (ceiling_kmh === null) return 'ok';

  const overhead = speed_kmh - ceiling_kmh;

  if (speed_kmh > limit_kmh) return 'critical';   // Over posted limit — always critical
  if (overhead > 10) return 'critical';            // >10 km/h over ceiling
  if (overhead > 3) return 'warn';                 // 4–10 km/h over ceiling
  if (overhead > 0) return 'caution';              // just over ceiling
  if (banked_time_s < -15) return 'warn';          // Too slow, running a time deficit
  return 'ok';
}

/**
 * Core warning generator: called once when covered_m crosses each checkpoint.
 */
export function generateCheckpointWarning(params: {
  checkpoint: CheckpointIndex;
  ceiling_kmh: number | null;
  currentSpeed_kmh: number;
  currentAvg_kmh: number;
  banked_time_s: number;
  remaining_m: number;
  limit_kmh: number;
  elapsed_s: number;
  hasSpotChallan?: boolean;
}): CheckpointWarning {
  const {
    checkpoint,
    ceiling_kmh,
    currentSpeed_kmh,
    currentAvg_kmh,
    banked_time_s,
    remaining_m,
    limit_kmh,
    elapsed_s,
    hasSpotChallan = false,
  } = params;

  const percent = ([25, 50, 75, 100] as const)[checkpoint - 1];
  const urgency = classifyUrgency(currentSpeed_kmh, ceiling_kmh, limit_kmh, checkpoint, banked_time_s);
  const ceil = ceiling_kmh !== null ? Math.round(ceiling_kmh) : null;
  const avgRounded = Math.round(currentAvg_kmh);
  const bankAbs = Math.abs(Math.round(banked_time_s));
  const bankSign = banked_time_s >= 0 ? 'ahead' : 'deficit';
  const remainKm = (remaining_m / 1000).toFixed(1);
  const elapsedMin = Math.floor(elapsed_s / 60);
  const elapsedSec = Math.round(elapsed_s % 60);

  let title = '';
  let hinglish = '';
  let english = '';

  // --- CHECKPOINT 4: EXIT GANTRY ---
  if (checkpoint === 4) {
    const isAverageLegal = banked_time_s >= 0;

    // Edge Case: Even if average speed was legal, a spot speed violation inside 15m camera FOV guarantees a challan!
    if (hasSpotChallan) {
      title = '🚨 Section Complete — Spot Challan Triggered!';
      hinglish = `Gantry cross hui! Average speed ${avgRounded} km/h safe thi, LEKIN Camera 15m FOV range mein speed limit cross hui thi! Spot speed challan aayega!`;
      english = `Exit gantry reached! Average speed was safe at ${avgRounded} km/h, BUT a spot challan has been issued due to exceeding the limit inside the 15m camera field of view!`;
      return {
        checkpoint, percent: 100, urgency: 'critical',
        title, hinglish, english,
        ceiling_kmh: null, currentAvg_kmh: avgRounded, banked_time_s,
        remaining_m: 0, triggeredAt: Date.now(),
      };
    }

    title = isAverageLegal ? '✅ Section Complete — Legal!' : '🚨 Section Complete — Challan Risk';
    hinglish = isAverageLegal
      ? `Gantry cross ho gayi! Average speed ${avgRounded} km/h rahi. Legal ride complete. No challan!`
      : `Gantry cross ho gayi. Average speed ${avgRounded} km/h rahi — limit se zyada! Challan aa sakta hai.`;
    english = isAverageLegal
      ? `Exit gantry reached! Your average speed was ${avgRounded} km/h — within legal limits. Challan-free ride!`
      : `Exit gantry reached. Average speed ${avgRounded} km/h exceeded the legal threshold. Challan risk!`;
    return {
      checkpoint, percent: 100, urgency: isAverageLegal ? 'done' : 'critical',
      title, hinglish, english,
      ceiling_kmh: null, currentAvg_kmh: avgRounded, banked_time_s,
      remaining_m: 0, triggeredAt: Date.now(),
    };
  }

  // --- CHECKPOINTS 1, 2, 3 ---
  switch (urgency) {
    case 'critical':
      if (currentSpeed_kmh > limit_kmh) {
        title = `🚨 CP-${checkpoint} (${percent}%): Over Limit!`;
        hinglish = `Alert! Aap ${Math.round(currentSpeed_kmh)} km/h pe hain — yeh posted limit ${limit_kmh} se zyada hai! Turant ruko.`;
        english = `Critical! You are at ${Math.round(currentSpeed_kmh)} km/h — above the posted limit of ${limit_kmh}! Reduce speed immediately.`;
      } else {
        title = `🚨 CP-${checkpoint} (${percent}%): Ceiling Breach!`;
        hinglish = `Aap average speed mein ${Math.round(currentSpeed_kmh - (ceil ?? 0))} km/h zyada hain. Ab ${ceil} km/h ya neeche rehna ZAROORI hai. ${remainKm} km bacha hai.`;
        english = `You are ${Math.round(currentSpeed_kmh - (ceil ?? 0))} km/h above your allowed ceiling of ${ceil} km/h. You MUST drop to ${ceil} km/h or below. ${remainKm} km remaining.`;
      }
      break;

    case 'warn':
      if (banked_time_s < -15) {
        title = `⚠️ CP-${checkpoint} (${percent}%): Time Deficit`;
        hinglish = `Aap ${bankAbs}s time deficit mein hain. Average ${avgRounded} km/h hai — ab aapko pace badhani hogi par limit ke andar. Ceiling: ${ceil} km/h.`;
        english = `You have a ${bankAbs}s time deficit. Your average is ${avgRounded} km/h — increase pace within the ceiling of ${ceil} km/h.`;
      } else {
        title = `⚠️ CP-${checkpoint} (${percent}%): Near Ceiling`;
        hinglish = `Speed ${Math.round(currentSpeed_kmh)} km/h — ceiling se sirf ${Math.round(currentSpeed_kmh - (ceil ?? 0))} km/h upar. Ab ${ceil} km/h se neeche aa jao. ${remainKm} km bacha hai.`;
        english = `At ${Math.round(currentSpeed_kmh)} km/h, you are ${Math.round(currentSpeed_kmh - (ceil ?? 0))} km/h above your ceiling of ${ceil} km/h. Slow to ${ceil} km/h. ${remainKm} km left.`;
      }
      break;

    case 'caution':
      title = `🟡 CP-${checkpoint} (${percent}%): Borderline`;
      hinglish = `Theek hai par dhyan rakhein — ceiling ${ceil} km/h, aap ${Math.round(currentSpeed_kmh)} pe hain. Thoda aur slow karo. ${remainKm} km bacha hai.`;
      english = `Borderline caution — ceiling is ${ceil} km/h, you are at ${Math.round(currentSpeed_kmh)} km/h. Ease off slightly. ${remainKm} km remaining.`;
      break;

    case 'ok':
    default:
      if (ceil !== null && ceil >= limit_kmh) {
        // Time budget fully recovered
        title = `✅ CP-${checkpoint} (${percent}%): Budget Restored`;
        hinglish = `Wah! ${bankAbs}s aage hain aur time budget fully recover ho gaya. Ab aap full ${limit_kmh} km/h tak ja sakte ho. ${remainKm} km bacha hai.`;
        english = `Excellent! ${bankAbs}s ahead — time budget fully restored. You can use the full ${limit_kmh} km/h limit for the rest. ${remainKm} km left.`;
      } else {
        // On pace, ceiling still below limit
        title = `✅ CP-${checkpoint} (${percent}%): On Pace`;
        hinglish = `Achha chal rahe ho! ${bankAbs}s ${bankSign === 'ahead' ? 'aage' : 'deficit'} mein, ceiling ${ceil} km/h hai. Isi pace pe raho. ${remainKm} km bacha.`;
        english = `Good pacing! ${bankAbs}s ${bankSign} of budget. Ceiling is ${ceil} km/h. Hold this pace. ${remainKm} km remaining.`;
      }
      break;
  }

  return {
    checkpoint,
    percent,
    urgency,
    title,
    hinglish,
    english,
    ceiling_kmh: ceil,
    currentAvg_kmh: avgRounded,
    banked_time_s: Math.round(banked_time_s),
    remaining_m,
    triggeredAt: Date.now(),
  };
}

/**
 * Generates an instantaneous warning when a vehicle exceeds the posted limit
 * within a camera's 15-meter Field of View (FOV).
 */
export function generateSpotFOVWarning(params: {
  cameraName: string;
  currentSpeed_kmh: number;
  limit_kmh: number;
  distanceToCamera_m: number;
}): CheckpointWarning {
  const { cameraName, currentSpeed_kmh, limit_kmh, distanceToCamera_m } = params;
  return {
    checkpoint: 1,
    percent: 25,
    urgency: 'critical',
    title: `🚨 15m CAMERA FOV: SPOT CHALLAN!`,
    hinglish: `Alert! ${cameraName} ke 15 meter range mein speed ${Math.round(currentSpeed_kmh)} km/h detect hui (Limit: ${limit_kmh} km/h)! Spot speed challan issue ho gaya!`,
    english: `Alert! Speed of ${Math.round(currentSpeed_kmh)} km/h recorded inside ${cameraName}'s 15m field of view (Limit: ${limit_kmh} km/h)! Instant spot challan issued!`,
    ceiling_kmh: limit_kmh,
    currentAvg_kmh: Math.round(currentSpeed_kmh),
    banked_time_s: 0,
    remaining_m: Math.round(distanceToCamera_m),
    triggeredAt: Date.now(),
  };
}

/**
 * Gets the correct voice text for a checkpoint warning.
 */
export function getWarningVoiceText(
  warning: CheckpointWarning,
  language: VoiceLanguage
): string {
  return language === 'english' ? warning.english : warning.hinglish;
}

/**
 * Checks whether covered_m has crossed a new checkpoint threshold.
 * Returns the checkpoint index (1–4) if a NEW threshold was just crossed, else null.
 */
export function detectNewCheckpoint(
  prevCovered_m: number,
  newCovered_m: number,
  sectionLength_m: number
): CheckpointIndex | null {
  const thresholds: [number, CheckpointIndex][] = [
    [sectionLength_m * 0.25, 1],
    [sectionLength_m * 0.50, 2],
    [sectionLength_m * 0.75, 3],
    [sectionLength_m * 1.00, 4],
  ];

  for (const [threshold, cp] of thresholds) {
    if (prevCovered_m < threshold && newCovered_m >= threshold) {
      return cp;
    }
  }
  return null;
}

