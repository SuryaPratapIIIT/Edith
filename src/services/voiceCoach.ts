import { AlertLevel, VoiceLanguage } from '../types/pace';
import type { CheckpointWarning } from '../engine/warningEngine';
import { getWarningVoiceText } from '../engine/warningEngine';
import { bolnaVoiceService } from './bolnaVoiceService';

class VoiceCoachService {
  private synth: SpeechSynthesis | null = null;
  private audioCtx: AudioContext | null = null;
  private isMuted: boolean = false;
  private currentLanguage: VoiceLanguage = 'hinglish';
  private lastAlertSpoken: string = '';
  private lastAlertTime: number = 0;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      // Cancel any lingering browser speech synthesis so only Bolna FRIDAY speaks
      window.speechSynthesis.cancel();
    }
    this.synth = null;
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted && this.synth) {
      this.synth.cancel();
    }
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
   * Generates clean audio tones using Web Audio API oscillators.
   */
  public playAlertChime(level: AlertLevel | 'pre_alert') {
    if (this.isMuted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    if (level === 'red') {
      // Urgent, rapid dual high-pitch pulse (880Hz -> 660Hz)
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
      // Radar chirp for gantry pre-alerts
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
   * Browser SpeechSynthesis completely disabled per user requirement.
   * All voice guidance and conversational pacing is handled exclusively by Bolna AI Agent (FRIDAY).
   */
  public speak(_text: string, _force: boolean = false) {
    // Disabled: Bolna AI Agent FRIDAY handles all voice
    return;
  }

  /**
   * Callback helper - resolves immediately since browser voice is replaced by Bolna.
   */
  public speakWithCallback(_text: string, onEnd?: () => void) {
    if (onEnd) onEnd();
  }

  /**
   * Immediately stops any speech in progress
   */
  public stop() {
    if (this.synth) {
      this.synth.cancel();
    }
  }

  /**
   * Prescriptive Pace Alert Voice Trigger
   */
  public triggerPaceAlert(
    alert: AlertLevel,
    speed: number,
    ceiling: number | null,
    limit: number,
    state: string
  ) {
    this.playAlertChime(alert);

    if (state === 'done') {
      if (alert === 'green') {
        const text =
          this.currentLanguage === 'english'
            ? 'Section completed legally. Safe average speed maintained. Zero challan!'
            : 'Section safe complete hua! Average speed safe limit me hai. No challan!';
        this.speak(text, true);
      } else {
        const text =
          this.currentLanguage === 'english'
            ? 'Section completed. Warning, average speed exceeded the legal threshold.'
            : 'Section complete hua. Warning, average speed limit se zyada rahi.';
        this.speak(text, true);
      }
      return;
    }

    if (alert === 'red' && ceiling !== null) {
      const text =
        this.currentLanguage === 'english'
          ? `Slow down! Speed is ${Math.round(speed)}. Maximum safe ceiling is ${Math.round(ceiling)} kilometers per hour.`
          : `Speed kam karein! Aap ${Math.round(speed)} pe hain. Legal ceiling ${Math.round(ceiling)} km/h hai.`;
      this.speak(text);
    } else if (alert === 'amber' && ceiling !== null) {
      const text =
        this.currentLanguage === 'english'
          ? `Caution. Speed ${Math.round(speed)} is near the ${Math.round(ceiling)} ceiling. Maintain pace.`
          : `Dhyan deinge. Speed ${Math.round(speed)} ceiling ${Math.round(ceiling)} ke paas hai. Dhere rakhein.`;
      this.speak(text);
    }
  }

  /**
   * Checkpoint Warning Voice Trigger
   * Plays the appropriate chime + speaks the prescriptive ceiling warning.
   */
  public triggerCheckpointWarning(warning: CheckpointWarning) {
    if (this.isMuted) return;

    // Pick chime based on urgency
    const chimeMap: Record<string, AlertLevel | 'pre_alert'> = {
      critical: 'red',
      warn: 'red',
      caution: 'amber',
      ok: 'green',
      done: 'pre_alert',
    };
    this.playAlertChime(chimeMap[warning.urgency] ?? 'amber');

    const text = getWarningVoiceText(warning, this.currentLanguage);
    // Always force-speak checkpoint warnings (they fire at most 4 times per ride)
    setTimeout(() => this.speak(text, true), 600);
  }

  /**
   * Camera 15m Field of View (FOV) Spot Speed Violation Voice Alert
   */
  public triggerSpotChallan(cameraName: string, speed: number, limit: number) {
    this.playAlertChime('red');
    const text =
      this.currentLanguage === 'english'
        ? `Warning! High risk of spot challan at ${cameraName}! Instant speed recorded was ${Math.round(speed)} in a ${limit} km/h zone. Risk of challan detected in this camera region!`
        : `Dhyan deinge! ${cameraName} par spot challan risk detect hua! Instant speed ${Math.round(speed)} km/h limit se zyada hai. Is region mein challan ka risk hai!`;
    this.speak(text, true);
  }

  /**
   * Average Speed Violation Voice Alert across an enforcement zone
   */
  public triggerSpeedChallan(sectionName: string, avgSpeed: number, limit: number) {
    this.playAlertChime('red');
    const text =
      this.currentLanguage === 'english'
        ? `Average speed violation in ${sectionName}! Section average was ${Math.round(avgSpeed)} in a ${limit} km/h zone. High risk of speed challan in this region!`
        : `Dhyan deinge! ${sectionName} section mein average speed limit cross hui! Average speed ${Math.round(avgSpeed)} km/h thi. Is corridor mein speed challan ka high risk hai!`;
    this.speak(text, true);
  }

  /**
   * Gantry Pre-alert (2km and 500m before gantry)
   */
  public triggerPreAlert(distanceText: string, gantryName: string) {
    this.playAlertChime('pre_alert');
    const text =
      this.currentLanguage === 'english'
        ? `Attention: ${gantryName} enforcement camera ahead in ${distanceText}. Check your speed.`
        : `Dhyan deinge: ${distanceText} mein ${gantryName} speed camera gantry aane wali hai.`;
    this.speak(text, true);
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
    this.playAlertChime('pre_alert');
    const text =
      this.currentLanguage === 'english'
        ? `Section cleared with ${Math.round(avgSpeed)} kilometers per hour average speed. Entering next section: ${nextName}. Legal limit is ${nextLimit} kilometers per hour.`
        : `Section safe clear hua! Average speed ${Math.round(avgSpeed)} km/h rahi. Next section start ho raha hai: ${nextName}. Speed limit ${nextLimit} km/h hai.`;
    this.speak(text, true);
  }

  /**
   * Full Journey Completion Voice Celebration
   */
  public triggerJourneyComplete(
    destName: string,
    totalDistKm: number,
    cameraCount: number,
    hadChallan: boolean
  ) {
    this.playAlertChime(hadChallan ? 'amber' : 'green');
    const text =
      this.currentLanguage === 'english'
        ? hadChallan
          ? `Journey complete. Arrived at ${destName}. Total distance ${totalDistKm.toFixed(1)} kilometers, passed ${cameraCount} cameras. Notice: spot violation was flagged.`
          : `Journey successfully completed! Arrived at ${destName}. Total distance ${totalDistKm.toFixed(1)} kilometers across ${cameraCount} ANPR cameras with zero challans!`
        : hadChallan
          ? `Journey complete! ${destName} pohach gaye. Total distance ${totalDistKm.toFixed(1)} km. Sabhi ${cameraCount} cameras cross hue. Ek spot violation hui hai.`
          : `Safalta se pohach gaye ${destName}! Total distance ${totalDistKm.toFixed(1)} km. Sabhi ${cameraCount} cameras safe clear hue with zero challan!`;
    this.speak(text, true);
  }

  /**
   * Route Planned Announcement
   */
  public triggerRoutePlanned(originName: string, destName: string, cameraCount: number, totalDistKm: number) {
    this.playAlertChime('green');
    const text =
      this.currentLanguage === 'english'
        ? `Route mapped from ${originName} to ${destName}. Total distance ${totalDistKm.toFixed(1)} kilometers with ${cameraCount} ANPR camera gantries.`
        : `Route map ho gaya: ${originName} se ${destName}. Total distance ${totalDistKm.toFixed(1)} km, raaste mein ${cameraCount} camera gantries hain.`;
    this.speak(text, false);
  }
}

export const voiceCoach = new VoiceCoachService();
