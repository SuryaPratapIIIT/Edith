/**
 * Bolna Voice AI Agent Service (FRIDAY)
 * Connects directly to Bolna's WebRTC Voice Agent using @bolna/web-call.
 * Provides two-way hands-free natural conversational voice with low-latency audio.
 */

import { BolnaWebCall, CallState, CallError } from '@bolna/web-call';

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

class BolnaVoiceService {
  private call: BolnaWebCall | null = null;
  private state: CallState = 'idle';
  private volume: number = 0;
  private error: string | null = null;
  private isMuted: boolean = false;

  private stateListeners: Set<BolnaStateListener> = new Set();
  private volumeListeners: Set<BolnaVolumeListener> = new Set();
  private errorListeners: Set<BolnaErrorListener> = new Set();

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

  /**
   * Start 2-way WebRTC voice conversation with Bolna Voice Agent (FRIDAY)
   * Must be called in response to a user click gesture to allow audio playback & mic permission.
   */
  public async startCall(context?: BolnaTelemetryContext): Promise<void> {
    if (this.state === 'active' || this.state === 'connecting' || this.state === 'ringing') {
      return;
    }

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
      });

      this.call.on('call-end', () => {
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
      });

      await this.call.start();
    } catch (err: any) {
      console.error('[Bolna Start Exception]:', err);
      this.notifyError(err.message || 'Failed to connect to Bolna Voice Agent');
      this.notifyState('idle');
    }
  }

  /**
   * Terminate active call with Bolna
   */
  public async stopCall(): Promise<void> {
    if (this.call) {
      try {
        await this.call.stop();
      } catch (err) {
        console.warn('[Bolna Stop Warn]:', err);
      } finally {
        this.call = null;
        this.notifyState('idle');
        this.notifyVolume(0);
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
}

export const bolnaVoiceService = new BolnaVoiceService();
