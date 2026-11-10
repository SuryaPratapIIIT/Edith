/**
 * Gnani AI Voice Service (FRIDAY Co-Pilot)
 * Replaces remote cloud WebRTC with native low-latency Gnani AI models:
 *   - STT: Gnani Prisma (Real-time Indian language speech-to-text)
 *   - TTS: Gnani Timbre (Natural Indian conversational voices e.g. Pranav, Nalini)
 *   - Integrated with VELO AI Calculus Pace Engine & ANPR Telemetry
 *
 * Full two-way hands-free natural voice interaction with live audio visualizer
 * and automatic VAD (Voice Activity Detection).
 */

import { VoiceLanguage } from '../types/pace';
import { apiUrl } from '../config/env';

export type CallState = 'idle' | 'connecting' | 'ringing' | 'active' | 'ended';

export interface GnaniTelemetryContext {
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

// Backward-compatibility alias
export type BolnaTelemetryContext = GnaniTelemetryContext;
export type BolnaStateListener = (state: CallState) => void;
export type BolnaVolumeListener = (volume: number) => void;
export type BolnaErrorListener = (error: string | null) => void;
export type BolnaAgentSpeechListener = (text: string, eventType: string) => void;

export type GnaniStateListener = BolnaStateListener;
export type GnaniVolumeListener = BolnaVolumeListener;
export type GnaniErrorListener = BolnaErrorListener;
export type GnaniSpeechListener = BolnaAgentSpeechListener;

// ─── High-Fidelity 16kHz WAV PCM Encoder for Gnani STT ────────────────────────
function writeWavString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function downsampleBuffer(buffer: Float32Array, inputRate: number, outputRate: number = 16000): Float32Array {
  if (inputRate === outputRate) return buffer;
  const ratio = inputRate / outputRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
}

function encodeWAV(samples: Float32Array, sampleRate: number = 16000): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  writeWavString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeWavString(view, 8, 'WAVE');

  // fmt sub-chunk (16-bit PCM mono)
  writeWavString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // Format = PCM
  view.setUint16(22, 1, true); // Channels = 1 (mono)
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // Byte rate
  view.setUint16(32, 2, true); // Block align
  view.setUint16(34, 16, true); // Bits per sample

  // data sub-chunk
  writeWavString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  // Write clamped 16-bit PCM samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([view], { type: 'audio/wav' });
}

class GnaniVoiceService {
  private state: CallState = 'idle';
  private volume: number = 0;
  private error: string | null = null;
  private isMuted: boolean = false;
  private currentLanguage: VoiceLanguage = 'hinglish';

  private stateListeners: Set<GnaniStateListener> = new Set();
  private volumeListeners: Set<GnaniVolumeListener> = new Set();
  private errorListeners: Set<GnaniErrorListener> = new Set();
  private speechListeners: Set<GnaniSpeechListener> = new Set();

  private audioCtx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private playbackSource: AudioBufferSourceNode | null = null;

  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private pcmChunks: Float32Array[] = [];
  private pcmProcessor: ScriptProcessorNode | null = null;
  private isRecordingQuery: boolean = false;
  private isProcessingQuery: boolean = false;
  private isAssistantSpeaking: boolean = false;

  private lastSpeechTime: number = 0;
  private silenceTimer: any = null;
  private vadInterval: any = null;
  private callSessionStartTime: number = 0;
  private lastTriggerTime: number = 0;
  private lastTriggerEvent: string = '';

  constructor() {
    // Silence any native browser speech synthesis to prevent second voice
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
  }

  private getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

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
    return this.isAssistantSpeaking || (Date.now() - this.lastSpeechTime < 2000);
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

  public setLanguage(lang: VoiceLanguage) {
    this.currentLanguage = lang;
  }

  public subscribeState(listener: GnaniStateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => this.stateListeners.delete(listener);
  }

  public subscribeVolume(listener: GnaniVolumeListener): () => void {
    this.volumeListeners.add(listener);
    return () => this.volumeListeners.delete(listener);
  }

  public subscribeError(listener: GnaniErrorListener): () => void {
    this.errorListeners.add(listener);
    listener(this.error);
    return () => this.errorListeners.delete(listener);
  }

  public subscribeSpeech(listener: GnaniSpeechListener): () => void {
    this.speechListeners.add(listener);
    return () => this.speechListeners.delete(listener);
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
   * Starts hands-free voice conversation with Gnani AI co-pilot.
   */
  public async startCall(context?: GnaniTelemetryContext): Promise<void> {
    if (this.state === 'active' || this.state === 'connecting' || this.state === 'ringing') {
      return;
    }

    this.callSessionStartTime = Date.now();
    this.notifyError(null);
    this.notifyState('connecting');

    // 1. Reset backend hangup flags
    try {
      await fetch(apiUrl('/api/bolna/reset-hangup'), { method: 'POST' });
    } catch {}

    // 2. Request microphone access
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
        this.micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
      }
    } catch (err: any) {
      console.warn('[Gnani Voice] Microphone access not granted or unavailable:', err);
    }

    // 3. Initialize backend session with Gnani
    try {
      const sessRes = await fetch(apiUrl('/api/gnani/session'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          route_id: context?.route_id || 'gurgaon-nh48',
          language: this.currentLanguage,
          context: context || {}
        })
      });

      if (sessRes.ok) {
        const sessData = await sessRes.json();
        this.notifyState('active');

        // Play initial greeting audio if provided
        if (sessData.audio_base64) {
          this.notifySpeech(sessData.greeting_text, 'greeting');
          await this.playAudioBase64(sessData.audio_base64);
        } else {
          this.notifySpeech(sessData.greeting_text, 'greeting');
        }
      } else {
        this.notifyState('active');
        this.notifySpeech('EDITH online. Monitoring active.', 'greeting');
      }

      // Start monitoring mic input for user queries
      this.startVoiceActivityDetection();
    } catch (err: any) {
      console.error('[Gnani Voice Start Error]:', err);
      this.notifyError(err.message || 'Failed to start Gnani Voice');
      this.notifyState('idle');
      this.stopCall();
    }
  }

  /**
   * Voice Activity Detection (VAD) loop:
   * Analyzes live microphone amplitude. When driver speaks, records audio
   * and automatically queries Gnani STT and telemetry on pause.
   */
  private startVoiceActivityDetection() {
    this.stopVoiceActivityDetection();
    if (!this.micStream) return;

    try {
      const ctx = this.getAudioContext();
      this.micSource = ctx.createMediaStreamSource(this.micStream);
      this.micAnalyser = ctx.createAnalyser();
      this.micAnalyser.fftSize = 512;
      this.micAnalyser.smoothingTimeConstant = 0.2;
      this.micSource.connect(this.micAnalyser);

      const buffer = new Uint8Array(this.micAnalyser.frequencyBinCount);

      this.vadInterval = setInterval(() => {
        if (!this.isCallActive() || this.isMuted) return;

        // If assistant is currently speaking, show output volume and don't record echo
        if (this.isAssistantSpeaking) return;

        if (this.micAnalyser) {
          this.micAnalyser.getByteFrequencyData(buffer);
          let sum = 0;
          for (let i = 0; i < buffer.length; i++) {
            sum += buffer[i];
          }
          const avg = sum / buffer.length;
          const normalizedVol = Math.min(1.0, avg / 128.0);

          if (!this.isAssistantSpeaking) {
            this.notifyVolume(normalizedVol);
          }

          const SPEECH_THRESHOLD = 0.05;

          if (normalizedVol > SPEECH_THRESHOLD && !this.isRecordingQuery && !this.isProcessingQuery) {
            this.startRecordingDriverSpeech();
          } else if (normalizedVol > SPEECH_THRESHOLD && this.isRecordingQuery) {
            // Still speaking, clear silence timeout
            if (this.silenceTimer) {
              clearTimeout(this.silenceTimer);
              this.silenceTimer = null;
            }
          } else if (normalizedVol <= SPEECH_THRESHOLD && this.isRecordingQuery && !this.silenceTimer) {
            // User paused speaking; wait 800ms before sending utterance
            this.silenceTimer = setTimeout(() => {
              this.stopRecordingAndDispatchQuery();
            }, 800);
          }
        }
      }, 50);
    } catch (err) {
      console.warn('[Gnani VAD Setup Warn]:', err);
    }
  }

  private stopVoiceActivityDetection() {
    if (this.vadInterval) {
      clearInterval(this.vadInterval);
      this.vadInterval = null;
    }
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.micSource) {
      try {
        this.micSource.disconnect();
      } catch {}
      this.micSource = null;
    }
    this.micAnalyser = null;
  }

  private startRecordingDriverSpeech() {
    if (!this.micStream || this.isRecordingQuery || this.isProcessingQuery) return;
    this.isRecordingQuery = true;
    this.pcmChunks = [];

    try {
      const ctx = this.getAudioContext();
      // bufferSize 4096, 1 input channel, 1 output channel
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (e) => {
        if (!this.isRecordingQuery) return;
        const inputData = e.inputBuffer.getChannelData(0);
        this.pcmChunks.push(new Float32Array(inputData));
      };
      if (this.micSource) {
        this.micSource.connect(processor);
        // Connect through a silent gain node so user doesn't hear microphone loopback through speakers
        const silentGain = ctx.createGain();
        silentGain.gain.value = 0;
        processor.connect(silentGain);
        silentGain.connect(ctx.destination);
      }
      this.pcmProcessor = processor;
      console.log('[Gnani Voice] Recording driver speech...');
    } catch (err) {
      console.warn('[Gnani PCM Recorder Start Failed]:', err);
      this.isRecordingQuery = false;
    }
  }

  private stopRecordingAndDispatchQuery() {
    if (!this.isRecordingQuery) return;
    this.isRecordingQuery = false;

    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    if (this.pcmProcessor) {
      try {
        this.pcmProcessor.disconnect();
      } catch {}
      this.pcmProcessor = null;
    }

    if (this.pcmChunks.length === 0) return;

    try {
      let totalLength = 0;
      for (const chunk of this.pcmChunks) {
        totalLength += chunk.length;
      }
      if (totalLength < 2400) {
        // Under ~0.15s, ignore short noise blip
        this.pcmChunks = [];
        return;
      }
      const merged = new Float32Array(totalLength);
      let offset = 0;
      for (const chunk of this.pcmChunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }
      this.pcmChunks = [];

      console.log(`[Gnani Voice] Processing utterance (${Math.round(totalLength / this.getAudioContext().sampleRate * 10) / 10}s), encoding 16kHz WAV...`);
      // Downsample from AudioContext rate (44100/48000 Hz) to 16,000 Hz for Gnani Prisma STT
      const ctx = this.getAudioContext();
      const downsampled = downsampleBuffer(merged, ctx.sampleRate, 16000);
      const wavBlob = encodeWAV(downsampled, 16000);

      this.sendDriverVoiceBlob(wavBlob);
    } catch (err) {
      console.warn('[Gnani WAV Processing Error]:', err);
    }
  }

  /**
   * Transcribes driver voice via Gnani STT, evaluates telemetry, and plays synthesized response.
   */
  public async sendDriverVoiceBlob(blob: Blob) {
    if (this.isProcessingQuery) return;
    this.isProcessingQuery = true;

    try {
      const formData = new FormData();
      formData.append('file', blob, 'driver_query.wav');
      formData.append('language', this.currentLanguage);
      formData.append('session_id', 'live_ride');

      const res = await fetch(apiUrl('/api/gnani/chat'), {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        if (data.query) {
          console.log('[Gnani Driver STT]:', data.query);
        }
        if (data.response_text) {
          this.notifySpeech(data.response_text, 'driver_reply');
        }
        if (data.hangup) {
          console.log('[Gnani Voice] Hangup command recognized. Disconnecting call...');
          if (data.audio_base64) {
            try {
              await this.playAudioBase64(data.audio_base64);
            } catch (e) {
              console.warn('[Gnani Voice] Hangup audio playback skipped:', e);
            }
          }
          await this.stopCall();
          return;
        } else if (data.audio_base64) {
          await this.playAudioBase64(data.audio_base64);
        }
      }
    } catch (err) {
      console.error('[Gnani Query Exception]:', err);
    } finally {
      this.isProcessingQuery = false;
    }
  }

  /**
   * Manual text query for testing and fallback
   */
  public async sendTextQuery(queryText: string) {
    try {
      const res = await fetch(apiUrl('/api/gnani/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: queryText,
          language: this.currentLanguage,
          session_id: 'live_ride'
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.response_text) {
          this.notifySpeech(data.response_text, 'driver_reply');
        }
        if (data.hangup) {
          console.log('[Gnani Voice] Hangup command recognized. Disconnecting call...');
          if (data.audio_base64) {
            try {
              await this.playAudioBase64(data.audio_base64);
            } catch (e) {
              console.warn('[Gnani Voice] Hangup audio playback skipped:', e);
            }
          }
          await this.stopCall();
          return;
        } else if (data.audio_base64) {
          await this.playAudioBase64(data.audio_base64);
        }
      }
    } catch (err) {
      console.error('[Gnani Text Query Error]:', err);
    }
  }

  /**
   * Plays base64 WAV/MP3 audio returned by Gnani Timbre TTS
   * and drives the visual volume waveform.
   */
  public async playAudioBase64(base64Str: string): Promise<void> {
    if (this.isMuted || !base64Str) return;

    try {
      this.stopCurrentPlayback();
      const ctx = this.getAudioContext();
      const binaryStr = window.atob(base64Str);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      const audioBuffer = await ctx.decodeAudioData(bytes.buffer);
      this.playbackSource = ctx.createBufferSource();
      this.playbackSource.buffer = audioBuffer;

      const playbackAnalyser = ctx.createAnalyser();
      playbackAnalyser.fftSize = 256;
      this.playbackSource.connect(playbackAnalyser);
      playbackAnalyser.connect(ctx.destination);

      this.isAssistantSpeaking = true;
      this.lastSpeechTime = Date.now();

      // Volume animation loop during playback
      const buffer = new Uint8Array(playbackAnalyser.frequencyBinCount);
      const animTimer = setInterval(() => {
        if (!this.isAssistantSpeaking) {
          clearInterval(animTimer);
          return;
        }
        playbackAnalyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) sum += buffer[i];
        const vol = Math.min(1.0, (sum / buffer.length) / 100.0);
        this.notifyVolume(vol);
      }, 40);

      return new Promise<void>((resolve) => {
        if (this.playbackSource) {
          this.playbackSource.onended = () => {
            this.isAssistantSpeaking = false;
            clearInterval(animTimer);
            this.notifyVolume(0);
            this.playbackSource = null;
            resolve();
          };
          this.playbackSource.start(0);
        } else {
          resolve();
        }
      });
    } catch (err) {
      console.warn('[Gnani Playback Warn]:', err);
      this.isAssistantSpeaking = false;
    }
  }

  private stopCurrentPlayback() {
    if (this.playbackSource) {
      try {
        this.playbackSource.stop();
        this.playbackSource.disconnect();
      } catch {}
      this.playbackSource = null;
    }
    this.isAssistantSpeaking = false;
  }

  /**
   * Terminate active call
   */
  public async stopCall(): Promise<void> {
    this.stopVoiceActivityDetection();
    this.stopCurrentPlayback();

    if (this.pcmProcessor) {
      try {
        this.pcmProcessor.disconnect();
      } catch {}
      this.pcmProcessor = null;
    }
    this.pcmChunks = [];

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {}
    }
    this.mediaRecorder = null;
    this.isRecordingQuery = false;
    this.isProcessingQuery = false;

    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }

    this.notifyVolume(0);
    this.notifyState('ended');
    setTimeout(() => {
      if (this.state === 'ended') {
        this.notifyState('idle');
      }
    }, 1200);
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopCurrentPlayback();
      this.notifyVolume(0);
    }
    return this.isMuted;
  }

  public clearQueueAndStopAudio(): void {
    this.stopCurrentPlayback();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
  }

  /**
   * Proactive voice alert trigger for speed, cameras, and checkpoints.
   */
  public async speakProactiveVoiceAlert(text: string): Promise<void> {
    if (this.isMuted || !text) return;
    this.notifySpeech(text, 'proactive_alert');
    if (this.isCallActive()) {
      try {
        const lang = this.currentLanguage === 'hindi' || this.currentLanguage === 'hinglish' ? 'hi-IN' : 'en-IN';
        const res = await fetch(apiUrl('/api/gnani/tts'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, language: lang })
        });
        if (res.ok) {
          const blob = await res.blob();
          const reader = new FileReader();
          reader.onloadend = () => {
            const b64 = (reader.result as string).split(',')[1];
            if (b64) this.playAudioBase64(b64);
          };
          reader.readAsDataURL(blob);
        }
      } catch (err) {
        console.warn('[Gnani Alert TTS Failed]:', err);
      }
    }
  }

  public async speakAnnouncement(text: string, _language: VoiceLanguage = 'hinglish'): Promise<void> {
    if (this.isMuted || !text) return;
    this.notifySpeech(text, 'announcement');
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
      ? `cp_${telemetryData?.checkpoint_index}`
      : eventType === 'camera_100m'
      ? `cam_${telemetryData?.camera_nearby}`
      : eventType === 'speed_alert'
      ? `spd_${telemetryData?.alert}`
      : eventType;

    const minInterval = eventType === 'speed_alert' ? 3000 : 2000;
    if (this.lastTriggerEvent === throttleKey && now - this.lastTriggerTime < minInterval) {
      return;
    }
    this.lastTriggerEvent = throttleKey;
    this.lastTriggerTime = now;

    // 1. Sync live telemetry to FastAPI backend
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
      next_camera: telemetryData?.camera_nearby ?? 'Upcoming Gantry',
      distance_to_camera_m: telemetryData?.distance_to_camera_m ?? 100,
      checkpoint_index: telemetryData?.checkpoint_index,
      checkpoint_name: telemetryData?.checkpoint_name,
      test_case_id: telemetryData?.test_case_id,
      situation_context: telemetryData?.situation_notes,
      language: telemetryData?.language ?? this.currentLanguage,
      challan_risk: telemetryData?.challan_risk ?? 'Zero Risk',
      route_origin: telemetryData?.route_origin,
      route_destination: telemetryData?.route_destination,
      total_journey_m: telemetryData?.total_journey_m,
      journey_elapsed_s: telemetryData?.journey_elapsed_s,
      total_cameras: telemetryData?.total_cameras,
      cleared_cameras: telemetryData?.cleared_cameras,
      challan_count: telemetryData?.challan_count
    };

    fetch(apiUrl('/api/telemetry/live'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(() => {});

    // 2. Query situational reasoning engine to update visual subtitles
    try {
      const analyzeRes = await fetch(apiUrl('/api/bolna/analyze-situation'), {
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
          language: telemetryData?.language ?? this.currentLanguage,
          challan_count: telemetryData?.challan_count ?? 0
        })
      });

      if (analyzeRes.ok) {
        const data = await analyzeRes.json();
        if (data.spoken_text) {
          this.notifySpeech(data.spoken_text, eventType);
        }
        if (data.audio_base64 && this.isCallActive() && !this.isMuted) {
          await this.playAudioBase64(data.audio_base64);
        }
      }
    } catch {}
  }
}

export const gnaniVoiceService = new GnaniVoiceService();
// Backward compatibility export so existing code works seamlessly
export const bolnaVoiceService = gnaniVoiceService;

