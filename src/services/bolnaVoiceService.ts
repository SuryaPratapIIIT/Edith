/**
 * Bolna Voice AI Agent Service (FRIDAY)
 * Connects directly to Bolna's WebRTC Voice Agent using @bolna/web-call.
 * Provides two-way hands-free natural conversational voice with low-latency audio.
 *
 * Real-time interface telemetry is continuously synced directly to the backend
 * so FRIDAY accesses 100% fresh, live vehicle data on every single turn (zero second voice).
 *
 * Supports call termination from Friday's end when the driver says:
 * "cut the call friday", "hangup", "end this session", "disconnect", or "call end kar do".
 */

import { BolnaWebCall, CallState, CallError } from '@bolna/web-call';
import { VoiceLanguage } from '../types/pace';

export interface BolnaTelemetryContext {
  route_id?: string;
  route_origin?: string;
  route_destination?: string;
  vehicle_class?: string;
  posted_speed_limit?: number;
  current_speed?: number;
  current_avg_speed?: number;
  pace_ceiling?: number | null;
  section_name?: string;
  next_camera?: string;
  distance_to_camera_m?: number;
  remaining_km?: number;
  status_alert?: string;
  challan_risk?: string;
  total_cameras?: number;
  cleared_cameras?: number;
  cameras_passed?: number;
  cameras_remaining?: number;
  passed_camera_names?: string[];
}

export interface VoiceQueueItem {
  id: string;
  text: string;
  language: VoiceLanguage;
  priority: number; // 1 = Critical Emergency, 2 = Milestone, 3 = Caution, 4 = Routine Status
  eventType: string;
  createdAt: number;
}

export type BolnaStateListener = (state: CallState) => void;
export type BolnaVolumeListener = (volume: number) => void;
export type BolnaErrorListener = (error: string | null) => void;
export type BolnaAgentSpeechListener = (text: string, eventType: string) => void;

class BolnaVoiceService {
  private call: BolnaWebCall | null = null;
  private state: CallState = 'idle';
  private volume: number = 0;
  private error: string | null = null;
  private isMuted: boolean = false;

  private stateListeners: Set<BolnaStateListener> = new Set();
  private volumeListeners: Set<BolnaVolumeListener> = new Set();
  private errorListeners: Set<BolnaErrorListener> = new Set();
  private speechListeners: Set<BolnaAgentSpeechListener> = new Set();

  private userMicStream: MediaStream | null = null;
  private lastTriggerTime: number = 0;
  private lastTriggerEvent: string = '';
  private hangupPollTimer: any = null;
  private callSessionStartTime: number = 0;
  private currentAlertAudio: HTMLAudioElement | null = null;

  // ── Synchronized Voice Queue & Mutex ─────────────────────────
  private queue: VoiceQueueItem[] = [];
  private isProcessingQueue: boolean = false;
  private currentPlayingItem: VoiceQueueItem | null = null;
  private lastSpokenTime: number = 0;
  private lastAgentSpeechTime: number = 0;
  private lastSpokenEvents: Map<string, number> = new Map();

  constructor() {
    // Completely silence and cancel any browser SpeechSynthesis (no second voice)
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
  }

  /**
   * Current connection state
   */
  public getState(): CallState {
    return this.state;
  }

  public isCallActive(): boolean {
    return this.state === 'active';
  }

  public isConnecting(): boolean {
    return this.state === 'connecting' || this.state === 'ringing';
  }

  public isAgentSpeaking(): boolean {
    const isVolumeHigh = this.volume > 0.04;
    const isRecentlySpoken = Date.now() - this.lastAgentSpeechTime < 2200;
    const isWelcomePhase = this.isCallActive() && (Date.now() - this.callSessionStartTime < 3500);
    return isVolumeHigh || isRecentlySpoken || isWelcomePhase;
  }

  public getVolume(): number {
    return this.volume;
  }

  public getError(): string | null {
    return this.error;
  }

  public isMicMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Subscribe to state changes (idle, connecting, ringing, active, ended)
   */
  public subscribeState(listener: BolnaStateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  /**
   * Subscribe to remote speech volume level for audio visualizer (0..1)
   */
  public subscribeVolume(listener: BolnaVolumeListener): () => void {
    this.volumeListeners.add(listener);
    return () => {
      this.volumeListeners.delete(listener);
    };
  }

  /**
   * Subscribe to connection or audio errors
   */
  public subscribeError(listener: BolnaErrorListener): () => void {
    this.errorListeners.add(listener);
    listener(this.error);
    return () => {
      this.errorListeners.delete(listener);
    };
  }

  /**
   * Subscribe to Bolna Agent spoken events (for UI subtitles / alerts)
   */
  public subscribeSpeech(listener: BolnaAgentSpeechListener): () => void {
    this.speechListeners.add(listener);
    return () => {
      this.speechListeners.delete(listener);
    };
  }

  private notifyState(newState: CallState) {
    this.state = newState;
    this.stateListeners.forEach((l) => l(newState));
  }

  private notifyVolume(newVol: number) {
    this.volume = newVol;
    this.volumeListeners.forEach((l) => l(newVol));
  }

  private notifyError(err: string | null) {
    this.error = err;
    this.errorListeners.forEach((l) => l(err));
  }

  private notifySpeech(text: string, eventType: string) {
    this.speechListeners.forEach((l) => l(text, eventType));
  }

  /**
   * Start hands-free WebRTC voice conversation with Bolna Voice Agent (FRIDAY).
   * Voice is 100% handled by Bolna with zero synthetic second voices.
   */
  public async startCall(context?: BolnaTelemetryContext): Promise<void> {
    if (this.state === 'active' || this.state === 'connecting' || this.state === 'ringing') {
      return;
    }

    this.callSessionStartTime = Date.now();
    // Synchronously reset previous hangup signal on the backend so stale hangups never cut the new call
    try {
      await fetch('/api/bolna/reset-hangup', { method: 'POST' });
    } catch {}

    this.notifyError(null);
    this.notifyState('connecting');

    const userData: Record<string, unknown> = {
      route_id: context?.route_id || 'gurgaon-nh48',
      route_origin: context?.route_origin || 'Gurugram',
      route_destination: context?.route_destination || 'Destination',
      vehicle_class: context?.vehicle_class || 'car',
      posted_speed_limit: context?.posted_speed_limit ?? 70,
      current_speed: context?.current_speed ?? 0,
      current_avg_speed: context?.current_avg_speed ?? 0,
      pace_ceiling: context?.pace_ceiling ?? 70,
      section_name: context?.section_name || 'Gurugram NH-48 Corridor',
      next_camera: context?.next_camera || 'Upcoming Camera Gantry',
      distance_to_camera_m: context?.distance_to_camera_m ?? 800,
      remaining_km: context?.remaining_km ?? 0,
      status_alert: context?.status_alert || 'green',
      challan_risk: context?.challan_risk || 'Zero Risk - Clean Record',
      total_cameras: context?.total_cameras ?? 0,
      cleared_cameras: context?.cleared_cameras ?? 0,
      cameras_passed: context?.cameras_passed ?? context?.cleared_cameras ?? 0,
      cameras_remaining: context?.cameras_remaining ?? 0,
      passed_camera_names: context?.passed_camera_names ?? []
    };

    try {
      this.call = new BolnaWebCall({
        sessionUrl: '/api/bolna/session',
        userData
      });

      this.call.on('state-change', (st: CallState) => {
        this.notifyState(st);
      });

      this.call.on('call-start', () => {
        this.notifyState('active');
        this.notifyError(null);
        // Begin monitoring for hangup requests from Friday's end
        this.startHangupWatcher();
      });

      this.call.on('call-end', () => {
        this.stopHangupWatcher();
        this.notifyState('ended');
        this.notifyVolume(0);
        setTimeout(() => {
          if (this.state === 'ended') {
            this.notifyState('idle');
          }
        }, 1500);
      });

      this.call.on('volume-level', (vol: number) => {
        this.notifyVolume(vol);
        if (vol > 0.04) {
          this.lastAgentSpeechTime = Date.now();
        }
      });

      this.call.on('error', (err: CallError) => {
        console.error('[Bolna Voice Error]:', err);
        const msg = err.message || `Bolna error: ${err.code}`;
        this.notifyError(msg);
        this.notifyState('idle');
        this.stopHangupWatcher();
      });

      await this.call.start();
    } catch (err: any) {
      console.error('[Bolna Start Exception]:', err);
      this.notifyError(err.message || 'Failed to connect to Bolna Voice Agent');
      this.notifyState('idle');
      this.stopHangupWatcher();
    }
  }

  /**
   * Terminate active call with Bolna
   */
  public async stopCall(): Promise<void> {
    this.stopHangupWatcher();
    this.clearQueueAndStopAudio();

    if (this.call) {
      try {
        await this.call.stop();
      } catch (err) {
        console.warn('[Bolna Stop Warn]:', err);
      } finally {
        this.call = null;
        this.notifyState('idle');
        this.notifyVolume(0);
        if (this.userMicStream) {
          this.userMicStream.getTracks().forEach((t) => t.stop());
          this.userMicStream = null;
        }
      }
    } else {
      this.notifyState('idle');
    }
  }

  /**
   * Toggle local microphone mute
   */
  public toggleMute(): boolean {
    if (this.call) {
      this.isMuted = !this.isMuted;
      this.call.setMuted(this.isMuted);
    }
    return this.isMuted;
  }

  /**
   * Polls the backend to detect when Friday triggers the `hangup_call` tool.
   * When Friday decides to cut the call (e.g., driver says "cut the call friday"),
   * this watcher cleanly terminates the WebRTC session from Friday's end.
   */
  private startHangupWatcher() {
    this.stopHangupWatcher();
    this.hangupPollTimer = setInterval(async () => {
      if (!this.isCallActive()) {
        this.stopHangupWatcher();
        return;
      }
      try {
        const res = await fetch('/api/bolna/hangup-status');
        if (res.ok) {
          const data = await res.json();
          // STRICT CONDITION: Only terminate if Friday explicitly triggered hangup AFTER this specific call started!
          const hangupTimestampMs = (data.timestamp || 0) * 1000;
          if (data.hangup_requested && hangupTimestampMs >= this.callSessionStartTime) {
            console.log('[Bolna Voice] Driver explicitly commanded hangup. Cutting call from Friday\'s end...');
            this.stopHangupWatcher();
            // Allow 1.2 seconds for Friday's closing statement to finish playing through speakers
            setTimeout(async () => {
              await this.stopCall();
              fetch('/api/bolna/reset-hangup', { method: 'POST' }).catch(() => {});
            }, 1200);
          }
        }
      } catch {
        // Ignore polling errors
      }
    }, 1000);
  }

  private stopHangupWatcher() {
    if (this.hangupPollTimer) {
      clearInterval(this.hangupPollTimer);
      this.hangupPollTimer = null;
    }
  }

  /**
   * Syncs real-time interface telemetry to backend for Bolna AI Agent.
   * Completely avoids any second voice or fake synthetic audio cues.
   * Bolna AI Agent is the sole, exclusive voice co-pilot.
   */
  /**
   * Proactive voice announcement:
   * Streams high-fidelity neural audio matching Friday's exact voice directly through
   * speakers unprompted, without robotic browser TTS or synthetic second voices.
   */
  /**
   * Evaluates alert event urgency:
   * 1 = Critical Emergency (spot violation, speed violation)
   * 2 = High Priority Road Milestone (checkpoint, camera proximity, route complete)
   * 3 = Caution (amber pace alert, route planned)
   * 4 = Routine Status (green cruise pace, nominal updates)
   */
  private getEventPriority(eventType: string, alert?: string): number {
    if (eventType === 'spot_violation' || eventType === 'speed_violation') {
      return 1;
    }
    if (eventType === 'camera_100m' || eventType === 'checkpoint' || eventType === 'journey_complete') {
      return 2;
    }
    if (eventType === 'route_planned' || (eventType === 'speed_alert' && alert === 'red')) {
      return 2;
    }
    if (eventType === 'speed_alert' && alert === 'amber') {
      return 3;
    }
    return 4;
  }

  /**
   * Enqueues a voice alert into the synchronized FIFO audio queue.
   * Completely eliminates voice overlapping, async race conditions, and WebRTC clashes.
   */
  public enqueueProactiveVoiceAlert(
    text: string,
    language: VoiceLanguage = 'hinglish',
    eventType: string = 'status_update',
    alert?: string
  ): void {
    if (this.isMuted || !text || text.trim() === '') return;

    const priority = this.getEventPriority(eventType, alert);
    const now = Date.now();

    // 1. Cooldown per event type to prevent rapid repetitive announcements
    const lastTimeForThisEvent = this.lastSpokenEvents.get(eventType) || 0;
    const cooldownMs =
      priority === 1 ? 5000 : // Emergency: min 5s gap
      priority === 2 ? 7000 : // Milestones: min 7s gap
      priority === 3 ? 9000 : // Caution: min 9s gap
      15000; // Routine Green status: min 15s gap

    if (now - lastTimeForThisEvent < cooldownMs) {
      return;
    }

    // 2. Drop routine status (Priority 4) if anything is active or queued
    if (priority >= 4) {
      if (this.currentPlayingItem !== null || this.queue.length > 0 || this.isAgentSpeaking()) {
        return;
      }
      if (now - this.lastSpokenTime < 10000) {
        return;
      }
    }

    // 3. Deduplicate: Never queue identical eventType if already pending
    if (this.queue.some((item) => item.eventType === eventType)) {
      return;
    }

    // 4. Preemption: Emergency Priority 1 interrupts playing routine Priority 3/4 audio immediately
    if (priority === 1 && this.currentPlayingItem && this.currentPlayingItem.priority >= 3) {
      if (this.currentAlertAudio) {
        try {
          this.currentAlertAudio.pause();
          this.currentAlertAudio.currentTime = 0;
        } catch {}
        this.currentAlertAudio = null;
      }
      this.currentPlayingItem = null;
    }

    // 5. Construct queue item
    const item: VoiceQueueItem = {
      id: `${eventType}_${now}`,
      text: text.trim(),
      language,
      priority,
      eventType,
      createdAt: now
    };

    // Strictly limit queue size to max 2 items so driver never hears outdated road alerts
    if (this.queue.length >= 2) {
      this.queue.sort((a, b) => a.priority - b.priority);
      if (item.priority < this.queue[this.queue.length - 1].priority) {
        this.queue.pop();
        this.queue.push(item);
      } else {
        return;
      }
    } else {
      this.queue.push(item);
    }

    this.queue.sort((a, b) => a.priority - b.priority);
    this.lastSpokenEvents.set(eventType, now);

    this.processQueue();
  }

  /**
   * Processes the synchronized audio queue sequentially (one voice at a time).
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.queue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      while (this.queue.length > 0) {
        if (this.isMuted) {
          this.queue = [];
          break;
        }

        // Wait if FRIDAY is actively speaking over WebRTC (e.g. welcome message or answering query)
        let waitCount = 0;
        while (this.isAgentSpeaking() && waitCount < 16) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          waitCount++;
        }

        if (this.isAgentSpeaking()) {
          // If Friday is still talking, discard non-critical items
          this.queue = this.queue.filter((it) => it.priority === 1);
          if (this.queue.length === 0) break;
        }

        const item = this.queue.shift();
        if (!item) break;

        // Skip expired alerts (>12s old)
        if (Date.now() - item.createdAt > 12000) {
          continue;
        }

        this.currentPlayingItem = item;
        await this.playSingleAudioItem(item);
        this.currentPlayingItem = null;
        this.lastSpokenTime = Date.now();

        // 350ms clean breathing pause between spoken sentences
        if (this.queue.length > 0) {
          await new Promise((resolve) => setTimeout(resolve, 350));
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Plays a single voice alert synchronously with WebRTC mic ducking.
   */
  private playSingleAudioItem(item: VoiceQueueItem): Promise<void> {
    return new Promise(async (resolve) => {
      let resolved = false;
      const finish = () => {
        if (!resolved) {
          resolved = true;
          if (this.currentAlertAudio) {
            try {
              this.currentAlertAudio.onended = null;
              this.currentAlertAudio.onerror = null;
            } catch {}
            this.currentAlertAudio = null;
          }
          if (this.isCallActive() && !this.isMuted) {
            this.call?.setMuted(false);
          }
          resolve();
        }
      };

      const timeoutTimer = setTimeout(finish, 8000);

      try {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
          window.speechSynthesis.cancel();
        }

        const res = await fetch('/api/voice/synthesize-alert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: item.text, language: item.language })
        });

        if (!res.ok) {
          clearTimeout(timeoutTimer);
          finish();
          return;
        }

        const blob = await res.blob();
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        this.currentAlertAudio = audio;

        // Duck WebRTC mic so vehicle speakers don't loop back into Friday's microphone
        if (this.isCallActive() && !this.isMuted) {
          this.call?.setMuted(true);
        }

        audio.onended = () => {
          clearTimeout(timeoutTimer);
          URL.revokeObjectURL(audioUrl);
          finish();
        };

        audio.onerror = () => {
          clearTimeout(timeoutTimer);
          URL.revokeObjectURL(audioUrl);
          finish();
        };

        await audio.play();
      } catch (err) {
        console.warn('[Synchronized Voice Playback Error]:', err);
        clearTimeout(timeoutTimer);
        finish();
      }
    });
  }

  /**
   * Public interface to trigger proactive voice alerts (routes into synchronized queue).
   */
  public async speakProactiveVoiceAlert(
    text: string,
    language: VoiceLanguage = 'hinglish',
    eventType: string = 'status_update',
    alert?: string
  ): Promise<void> {
    this.enqueueProactiveVoiceAlert(text, language, eventType, alert);
  }

  /**
   * Speaks an announcement such as trip completion and challan summary.
   * Routes into synchronized queue and avoids synthetic second voices.
   */
  public async speakAnnouncement(text: string, language: VoiceLanguage = 'hinglish'): Promise<void> {
    if (this.isMuted || !text || text.trim() === '') return;
    this.notifySpeech(text, 'journey_complete');
    this.enqueueProactiveVoiceAlert(text, language, 'journey_complete');
  }

  /**
   * Flushes queue and terminates any playing audio immediately (called on stop/reset/hangup).
   */
  public clearQueueAndStopAudio(): void {
    this.queue = [];
    if (this.currentAlertAudio) {
      try {
        this.currentAlertAudio.pause();
        this.currentAlertAudio.currentTime = 0;
        this.currentAlertAudio.src = '';
      } catch {}
      this.currentAlertAudio = null;
    }
    this.currentPlayingItem = null;
    this.isProcessingQueue = false;
    if (this.isCallActive() && !this.isMuted) {
      this.call?.setMuted(false);
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
  }

  public async triggerAgentSituation(
    eventType: string,
    telemetryData?: {
      speed_kmh?: number;
      limit_kmh?: number;
      covered_m?: number;
      remaining_m?: number;
      ceiling_kmh?: number | null;
      current_avg_kmh?: number;
      banked_time_s?: number;
      alert?: string;
      camera_nearby?: string;
      distance_to_camera_m?: number;
      checkpoint_index?: number;
      checkpoint_name?: string;
      test_case_id?: string;
      situation_notes?: string;
      language?: VoiceLanguage;
      challan_risk?: string;
      route_origin?: string;
      route_destination?: string;
      total_journey_m?: number;
      journey_elapsed_s?: number;
      total_cameras?: number;
      cleared_cameras?: number;
      challan_count?: number;
    }
  ): Promise<void> {
    const now = Date.now();
    const throttleKey = eventType === 'checkpoint' 
      ? `checkpoint_${telemetryData?.checkpoint_index}` 
      : eventType === 'camera_100m'
      ? `camera_100m_${telemetryData?.camera_nearby}`
      : eventType === 'speed_alert'
      ? `speed_alert_${telemetryData?.alert}`
      : eventType;

    // Throttle identical triggers (3s for speed status, 2s for others)
    const minInterval = eventType === 'speed_alert' ? 3000 : 2000;
    if (this.lastTriggerEvent === throttleKey && now - this.lastTriggerTime < minInterval) {
      return;
    }
    this.lastTriggerEvent = throttleKey;
    this.lastTriggerTime = now;

    // 1. Sync live interface data to FastAPI backend immediately with zero caching
    const payload = {
      session_id: 'live_ride',
      event_type: eventType,
      speed_kmh: telemetryData?.speed_kmh ?? 70,
      limit_kmh: telemetryData?.limit_kmh ?? 70,
      covered_m: telemetryData?.covered_m ?? 0,
      remaining_m: telemetryData?.remaining_m ?? 500,
      ceiling_kmh: telemetryData?.ceiling_kmh,
      current_avg_kmh: telemetryData?.current_avg_kmh,
      banked_time_s: telemetryData?.banked_time_s,
      alert: telemetryData?.alert ?? 'green',
      next_camera: telemetryData?.camera_nearby ?? 'Upcoming Camera Gantry',
      distance_to_camera_m: telemetryData?.distance_to_camera_m ?? 100,
      checkpoint_index: telemetryData?.checkpoint_index,
      checkpoint_name: telemetryData?.checkpoint_name,
      test_case_id: telemetryData?.test_case_id,
      situation_context: telemetryData?.situation_notes,
      language: telemetryData?.language ?? 'hinglish',
      challan_risk: telemetryData?.challan_risk ?? 'Zero Risk',
      route_origin: telemetryData?.route_origin,
      route_destination: telemetryData?.route_destination,
      total_journey_m: telemetryData?.total_journey_m,
      journey_elapsed_s: telemetryData?.journey_elapsed_s,
      total_cameras: telemetryData?.total_cameras,
      cleared_cameras: telemetryData?.cleared_cameras,
      challan_count: telemetryData?.challan_count
    };

    fetch('/api/telemetry/live', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(() => {});

    // 2. Query dynamic reasoning engine to keep UI subtitles updated and speak alert in real time
    try {
      const analyzeRes = await fetch('/api/bolna/analyze-situation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          speed_kmh: telemetryData?.speed_kmh ?? 70,
          limit_kmh: telemetryData?.limit_kmh ?? 70,
          covered_m: telemetryData?.covered_m ?? 0,
          remaining_m: telemetryData?.remaining_m ?? 500,
          ceiling_kmh: telemetryData?.ceiling_kmh,
          current_avg_kmh: telemetryData?.current_avg_kmh,
          banked_time_s: telemetryData?.banked_time_s,
          camera_nearby: telemetryData?.camera_nearby,
          distance_to_camera_m: telemetryData?.distance_to_camera_m,
          alert: telemetryData?.alert ?? 'green',
          event_type: eventType,
          checkpoint_index: telemetryData?.checkpoint_index,
          checkpoint_name: telemetryData?.checkpoint_name,
          test_case_id: telemetryData?.test_case_id,
          situation_notes: telemetryData?.situation_notes,
          language: telemetryData?.language ?? 'hinglish',
          challan_count: telemetryData?.challan_count ?? 0
        })
      });

      if (analyzeRes.ok) {
        const data = await analyzeRes.json();
        if (data.spoken_text) {
          // Update visual UI subtitles / notifications
          this.notifySpeech(data.spoken_text, eventType);
          // Proactively speak in Friday's warm voice unprompted for road status and camera alerts
          if (
            eventType === 'camera_100m' ||
            eventType === 'checkpoint' ||
            eventType === 'spot_violation' ||
            eventType === 'speed_violation' ||
            eventType === 'speed_alert' ||
            eventType === 'route_planned' ||
            eventType === 'status_update'
          ) {
            this.enqueueProactiveVoiceAlert(
              data.spoken_text,
              telemetryData?.language ?? 'hinglish',
              eventType,
              telemetryData?.alert
            );
          }
        }
      }
    } catch {
      // Quiet background analysis
    }
  }
}

export const bolnaVoiceService = new BolnaVoiceService();
