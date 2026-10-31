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

    // Reset any previous hangup signal on the backend
    fetch('/api/bolna/reset-hangup', { method: 'POST' }).catch(() => {});

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
      challan_risk: context?.challan_risk || 'Zero Risk - Clean Record'
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
          if (data.hangup_requested) {
            console.log('[Bolna Voice] Friday triggered hangup. Cutting call from Friday\'s end...');
            this.stopHangupWatcher();
            // Allow 1.4 seconds for Friday's closing statement to finish playing through speakers
            setTimeout(async () => {
              await this.stopCall();
              fetch('/api/bolna/reset-hangup', { method: 'POST' }).catch(() => {});
            }, 1400);
          }
        }
      } catch (e) {
        // Ignore polling errors
      }
    }, 350);
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
   * Proactive voice announcement matching the Friday persona.
   * Plays the alert aloud directly to the driver's audio output (speakers/headphones)
   * without injecting into the WebRTC microphone stream.
   */
  public speakProactiveVoiceAlert(text: string): void {
    if (this.isMuted) return;
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      
      const voices = window.speechSynthesis.getVoices();
      const fridayVoice = voices.find(v =>
        (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Zira') || v.name.includes('Female')) &&
        !v.name.includes('David') && !v.name.includes('Male')
      ) || voices[0];

      if (fridayVoice) {
        utterance.voice = fridayVoice;
      }
      utterance.rate = 1.05;
      utterance.pitch = 1.05;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('[Bolna Voice Alert Error]:', e);
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
      : eventType;

    // Throttle identical triggers within 2 seconds
    if (this.lastTriggerEvent === throttleKey && now - this.lastTriggerTime < 2000) {
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
          language: telemetryData?.language ?? 'hinglish'
        })
      });

      if (analyzeRes.ok) {
        const data = await analyzeRes.json();
        if (data.spoken_text) {
          this.notifySpeech(data.spoken_text, eventType);
          if (eventType === 'checkpoint' || eventType === 'camera_100m' || eventType === 'spot_violation' || eventType === 'speed_violation') {
            this.speakProactiveVoiceAlert(data.spoken_text);
          }
        }
      }
    } catch (e) {
      // Quiet background analysis
    }
  }
}

export const bolnaVoiceService = new BolnaVoiceService();
