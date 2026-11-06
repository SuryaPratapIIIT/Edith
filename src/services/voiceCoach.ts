import { AlertLevel, VoiceLanguage } from '../types/pace';
import type { CheckpointWarning } from '../engine/warningEngine';
import { bolnaVoiceService } from './bolnaVoiceService';

class VoiceCoachService {
  private audioCtx: AudioContext | null = null;
  private isMuted: boolean = false;
  private currentLanguage: VoiceLanguage = 'hinglish';

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setLanguage(lang: VoiceLanguage) {
    this.currentLanguage = lang;
  }

  public getLanguage(): VoiceLanguage {
    return this.currentLanguage;
  }

  /**
   * Generates clean radar audio chimes using Web Audio API oscillators.
   * Provides zero-latency auditory cues for red, amber, green, and pre-alert.
   */
  public playAlertChime(level: AlertLevel | 'pre_alert') {
    if (this.isMuted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    if (level === 'red') {
      // Urgent, rapid dual high-pitch pulse (880Hz -> 700Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(880, now);
      osc1.frequency.setValueAtTime(700, now + 0.1);
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.25);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(880, now + 0.3);
      osc2.frequency.setValueAtTime(700, now + 0.4);
      gain2.gain.setValueAtTime(0.3, now + 0.3);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.55);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.3);
      osc2.stop(now + 0.55);
    } else if (level === 'amber') {
      // Harmonic gentle double chime (587Hz & 880Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.setValueAtTime(880, now + 0.12);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    } else if (level === 'pre_alert') {
      // Radar chirp for gantry pre-alerts (1046Hz -> 1318Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1046.5, now);
      osc.frequency.exponentialRampToValueAtTime(1318.5, now + 0.15);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } else {
      // Green pleasant confirmation tone (523Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    }
  }

  /**
   * Immediately stops any pending speech or audio
   */
  public stop() {
    bolnaVoiceService.clearQueueAndStopAudio();
  }

  /**
   * Real-time 100m Camera Proximity Voice Alert:
   * Plays the radar chime and delegates voice alerting 100% to Bolna Voice AI Agent.
   * Bolna's LLM agent fetches live telemetry and generates dynamic warning in real time.
   */
  public triggerCameraNearby100m(cameraName: string, limit: number, dist_m: number, speed_kmh?: number) {
    if (this.isMuted) return;
    this.playAlertChime('pre_alert');
    bolnaVoiceService.triggerAgentSituation('camera_100m', {
      camera_nearby: cameraName,
      speed_kmh: speed_kmh,
      limit_kmh: limit,
      distance_to_camera_m: dist_m,
      language: this.currentLanguage
    });
  }

  /**
   * Camera Field of View (FOV) Spot Speed Violation Voice Alert:
   * Plays urgent radar chime and triggers Bolna Voice AI Agent.
   */
  public triggerSpotChallan(cameraName: string, speed: number, limit: number) {
    if (this.isMuted) return;
    this.playAlertChime('red');
    bolnaVoiceService.triggerAgentSituation('spot_violation', {
      camera_nearby: cameraName,
      speed_kmh: speed,
      limit_kmh: limit,
      alert: 'red',
      challan_risk: 'High Risk - Instant Spot Camera Violation',
      language: this.currentLanguage
    });
  }

  /**
   * Average Speed Violation Voice Alert across an enforcement zone:
   * Plays urgent chime and triggers Bolna Voice AI Agent.
   */
  public triggerSpeedChallan(sectionName: string, avgSpeed: number, limit: number) {
    if (this.isMuted) return;
    this.playAlertChime('red');
    bolnaVoiceService.triggerAgentSituation('speed_violation', {
      camera_nearby: sectionName,
      speed_kmh: avgSpeed,
      limit_kmh: limit,
      alert: 'red',
      challan_risk: 'High Risk - Average Speed Corridor Violation',
      language: this.currentLanguage
    });
  }

  /**
   * Prescriptive Pace Alert Voice Trigger (Green / Amber / Red shift)
   */
  public triggerPaceAlert(
    alert: AlertLevel,
    speed: number,
    ceiling: number | null,
    limit: number,
    state: string
  ) {
    if (this.isMuted) return;
    this.playAlertChime(alert);
    bolnaVoiceService.triggerAgentSituation('speed_alert', {
      speed_kmh: speed,
      ceiling_kmh: ceiling,
      limit_kmh: limit,
      alert: alert,
      situation_notes: state === 'done' ? 'Section completed legally' : undefined,
      language: this.currentLanguage
    });
  }

  /**
   * Checkpoint Warning Voice Trigger:
   * Evaluated dynamically by Bolna Voice AI Agent.
   */
  public triggerCheckpointWarning(warning: CheckpointWarning, speed_kmh?: number, limit_kmh?: number) {
    if (this.isMuted) return;

    const chimeMap: Record<string, AlertLevel | 'pre_alert'> = {
      critical: 'red',
      warn: 'red',
      caution: 'amber',
      ok: 'green',
      done: 'pre_alert'
    };
    this.playAlertChime(chimeMap[warning.urgency] ?? 'amber');

    bolnaVoiceService.triggerAgentSituation('checkpoint', {
      checkpoint_index: warning.checkpoint,
      checkpoint_name: `Checkpoint ${warning.checkpoint} (${warning.percent}%)`,
      speed_kmh: speed_kmh ?? warning.currentAvg_kmh,
      limit_kmh: limit_kmh ?? (warning.ceiling_kmh ?? 70),
      ceiling_kmh: warning.ceiling_kmh,
      current_avg_kmh: warning.currentAvg_kmh,
      banked_time_s: warning.banked_time_s,
      remaining_m: warning.remaining_m,
      alert: warning.urgency === 'critical' ? 'red' : warning.urgency === 'caution' ? 'amber' : 'green',
      language: this.currentLanguage
    });
  }

  /**
   * Delegates speech directly to Bolna Voice AI Agent in real time.
   */
  public speak(text: string, _force?: boolean) {
    if (this.isMuted) return;
    bolnaVoiceService.triggerAgentSituation('status_update', {
      situation_notes: text,
      language: this.currentLanguage
    });
  }

  public speakWithCallback(text: string, onEnd?: () => void) {
    this.speak(text);
    if (onEnd) {
      setTimeout(onEnd, 2500);
    }
  }

  /**
   * Gantry Pre-alert (2km and 500m before gantry)
   */
  public triggerPreAlert(distanceText: string, gantryName: string) {
    if (this.isMuted) return;
    this.playAlertChime('pre_alert');
    bolnaVoiceService.triggerAgentSituation('camera_proximity', {
      camera_nearby: gantryName,
      situation_notes: `Upcoming enforcement camera ahead in ${distanceText}`,
      language: this.currentLanguage
    });
  }

  /**
   * Section Transition Voice Alert (when passing intermediate camera)
   */
  public triggerSectionTransition(
    clearedName: string,
    avgSpeed: number,
    nextName: string,
    nextLimit: number
  ) {
    if (this.isMuted) return;
    this.playAlertChime('pre_alert');
    bolnaVoiceService.triggerAgentSituation('section_transition', {
      camera_nearby: nextName,
      speed_kmh: avgSpeed,
      limit_kmh: nextLimit,
      situation_notes: `Cleared ${clearedName} with ${Math.round(avgSpeed)} km/h average speed`,
      language: this.currentLanguage
    });
  }

  /**
   * Full Journey Completion Voice Celebration & Challan Verdict
   * Speaks: "You have completed your ride and have X challans recorded."
   * Then automatically hangs up the call with Friday.
   */
  public async triggerJourneyComplete(
    destName: string,
    totalDistKm: number,
    cameraCount: number,
    challanCount: number
  ): Promise<void> {
    const lang = this.currentLanguage;
    let spokenText = '';
    if (challanCount === 0) {
      spokenText = lang === 'english'
        ? 'You have completed your ride and have 0 challans recorded. Clean and safe trip!'
        : 'Aapne apni ride complete kar li hai aur aapke 0 challan record hue hain. Shandaar aur safe trip!';
    } else if (challanCount === 1) {
      spokenText = lang === 'english'
        ? 'You have completed your ride and have 1 challan recorded. Please review your trip summary.'
        : 'Aapne apni ride complete kar li hai aur aapka 1 challan record hua hai. Trip summary check kar lijiye.';
    } else {
      spokenText = lang === 'english'
        ? `You have completed your ride and have ${challanCount} challans recorded. Please review your trip summary.`
        : `Aapne apni ride complete kar li hai aur aapke ${challanCount} challan record hue hain. Trip summary check kar lijiye.`;
    }

    if (!this.isMuted) {
      this.playAlertChime(challanCount > 0 ? 'amber' : 'green');
    }

    // 1. Sync live completed journey state with Bolna backend
    bolnaVoiceService.triggerAgentSituation('journey_complete', {
      camera_nearby: destName,
      covered_m: totalDistKm * 1000,
      challan_risk: challanCount > 0 ? `${challanCount} Violation(s) Recorded` : 'Zero Challan - Safe Journey',
      situation_notes: `Arrived at ${destName}. Distance ${totalDistKm.toFixed(1)} km across ${cameraCount} cameras. Challans: ${challanCount}`,
      language: this.currentLanguage,
      challan_count: challanCount
    });

    // 2. Announce verdict audibly through Friday's voice co-pilot
    if (!this.isMuted) {
      await bolnaVoiceService.speakAnnouncement(spokenText, this.currentLanguage);
    }

    // 3. Automatically cut the call with Friday now that arrival and verdict are announced!
    if (bolnaVoiceService.isCallActive() || bolnaVoiceService.isConnecting()) {
      console.log('[Ride Complete] Automatically cutting call with Friday...');
      await bolnaVoiceService.stopCall();
      fetch('/api/bolna/hangup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'ride_completed' })
      }).catch(() => {});
    }
  }

  /**
   * Route Planned Announcement
   */
  public triggerRoutePlanned(
    originName: string,
    destName: string,
    cameraCount: number,
    totalDistKm: number
  ) {
    if (this.isMuted) return;
    this.playAlertChime('green');
    bolnaVoiceService.triggerAgentSituation('route_planned', {
      camera_nearby: `${cameraCount} ANPR Cameras`,
      remaining_m: totalDistKm * 1000,
      situation_notes: `Route from ${originName} to ${destName}. Total ${totalDistKm.toFixed(1)} km with ${cameraCount} gantries`,
      language: this.currentLanguage
    });
  }
}

export const voiceCoach = new VoiceCoachService();
