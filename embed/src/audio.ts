/**
 * WebClaw Audio Handler
 * Manages microphone capture with Voice Activity Detection (VAD)
 * and gapless audio playback via Web Audio API.
 * Seamless mode: mic is always on, VAD detects when user speaks.
 */

export type AudioState = 'idle' | 'listening' | 'speaking' | 'playing';

export interface AudioHandlerOptions {
  /** VAD energy threshold (0-1). Lower = more sensitive. Default 0.01 */
  vadThreshold?: number;

  /** Milliseconds of silence before stopping speech. Default 1500 */
  vadSilenceTimeout?: number;

  /** Whether to use seamless (always-on) mode. Default true */
  seamless?: boolean;

  /** Sample rate for capture. Default 16000 */
  captureSampleRate?: number;

  /** Sample rate for playback. Gemini Live audio output is 24000 Hz. */
  playbackSampleRate?: number;

  /**
   * Seconds of jitter buffer before playback (re)starts.
   * Increase (0.15 - 0.3) if network is unstable. Default 0.08
   */
  playbackLeadTime?: number;
}

const DEFAULT_OPTS: Required<AudioHandlerOptions> = {
  vadThreshold: 0.01,
  vadSilenceTimeout: 1500,
  seamless: true,
  captureSampleRate: 16000,

  // Gemini Live audio output is 24kHz.
  // Using 16kHz here causes distorted / slow / robotic audio.
  playbackSampleRate: 24000,

  playbackLeadTime: 0.08,
};

/** Number of silent frames kept so the start of speech is not cut off. */
const PRE_ROLL_FRAMES = 3;

/** Fade-in length (seconds) used after an underrun to avoid a click. */
const FADE_IN_SECONDS = 0.005;

type CaptureMode = 'vad' | 'continuous';

export class AudioHandler {
  private audioContext: AudioContext | null = null;
  private playbackContext: AudioContext | null = null;

  private mediaStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private muteOutput: GainNode | null = null;
  private analyser: AnalyserNode | null = null;

  private onAudioData: ((data: ArrayBuffer) => void) | null = null;

  private opts: Required<AudioHandlerOptions>;

  // Capture / VAD state
  private _state: AudioState = 'idle';
  private captureMode: CaptureMode = 'vad';
  private isSpeaking = false;
  private silenceStart = 0;
  private speechActiveFrames = 0;
  private speechIdleFrames = 0;
  private preRoll: Int16Array[] = [];

  // Playback state (gapless scheduling)
  private nextStartTime = 0;
  private activeSources = new Set<AudioBufferSourceNode>();
  private pendingByte: number | null = null; // leftover byte if a chunk splits a sample
  private isPlaying = false;
  private playbackAnalyser: AnalyserNode | null = null;

  // Callbacks
  private onStateChange: ((state: AudioState) => void) | null = null;
  private onSpeechStart: (() => void) | null = null;
  private onSpeechEnd: (() => void) | null = null;
  private onAmplitude: ((amplitude: number) => void) | null = null;

  constructor(options?: AudioHandlerOptions) {
    this.opts = { ...DEFAULT_OPTS, ...options };
  }

  get state(): AudioState {
    return this._state;
  }

  /** Check if mic is currently available */
  get isCapturing(): boolean {
    return this.mediaStream !== null;
  }

  on(event: 'stateChange', cb: (state: AudioState) => void): void;
  on(event: 'speechStart', cb: () => void): void;
  on(event: 'speechEnd', cb: () => void): void;
  on(event: 'amplitude', cb: (amplitude: number) => void): void;
  on(event: string, cb: (...args: any[]) => void): void {
    switch (event) {
      case 'stateChange':
        this.onStateChange = cb;
        break;
      case 'speechStart':
        this.onSpeechStart = cb;
        break;
      case 'speechEnd':
        this.onSpeechEnd = cb;
        break;
      case 'amplitude':
        this.onAmplitude = cb;
        break;
    }
  }

  getPlaybackAnalyser(): AnalyserNode | null {
    return this.playbackAnalyser;
  }

  async waitForPlaybackToFinish(timeoutMs = 12000, quietPeriodMs = 500): Promise<void> {
    const startedAt = Date.now();
    let idleSince: number | null = null;

    while (Date.now() - startedAt < timeoutMs) {
      const playbackPending = this.activeSources.size > 0
        || (this.playbackContext !== null
          && this.playbackContext.currentTime < this.nextStartTime);

      if (playbackPending) {
        idleSince = null;
      } else if (idleSince === null) {
        idleSince = Date.now();
      } else if (Date.now() - idleSince >= quietPeriodMs) {
        return;
      }

      await new Promise(resolve => window.setTimeout(resolve, 25));
    }
  }

  private setState(state: AudioState): void {
    if (this._state !== state) {
      this._state = state;
      this.onStateChange?.(state);
    }
  }

  // ---------------------------------------------------------------------------
  // Capture
  // ---------------------------------------------------------------------------

  /**
   * Start seamless capture - mic is always on, VAD handles the rest.
   * Audio data is only sent when speech is detected.
   */
  async startSeamless(onData: (data: ArrayBuffer) => void): Promise<void> {
    await this.openMic(onData, 'vad');
    this.setState('listening');
  }

  /**
   * Start capture. In seamless mode this uses VAD,
   * otherwise streams continuously (push-to-talk style).
   */
  async startCapture(onData: (data: ArrayBuffer) => void): Promise<void> {
    if (this.opts.seamless) {
      return this.startSeamless(onData);
    }

    await this.openMic(onData, 'continuous');
    this.setState('speaking');
  }

  private async openMic(
    onData: (data: ArrayBuffer) => void,
    mode: CaptureMode
  ): Promise<void> {
    // Avoid leaking a previous capture session
    if (this.mediaStream || this.audioContext) {
      this.stopCapture();
    }

    this.onAudioData = onData;
    this.captureMode = mode;
    this.preRoll = [];
    this.isSpeaking = false;
    this.speechActiveFrames = 0;
    this.speechIdleFrames = 0;

    this.audioContext = new AudioContext({
      sampleRate: this.opts.captureSampleRate,
    });

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: this.opts.captureSampleRate,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    this.micSource = this.audioContext.createMediaStreamSource(
      this.mediaStream
    );

    // Analyser (useful for external visualisation)
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 512;
    this.micSource.connect(this.analyser);

    // Processor to get raw PCM
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (event) => {
      const inputData = event.inputBuffer.getChannelData(0);

      // RMS energy
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) {
        sum += inputData[i] * inputData[i];
      }
      const rms = Math.sqrt(sum / inputData.length);

      this.onAmplitude?.(rms);

      const pcm16 = this.floatToPcm16(inputData);

      if (this.captureMode === 'continuous') {
        this.onAudioData?.(pcm16.buffer as ArrayBuffer);
        return;
      }

      // VAD mode
      const wasSpeaking = this.isSpeaking;
      this.processVAD(rms);

      if (this.isSpeaking) {
        if (!wasSpeaking) {
          // Speech just started: flush pre-roll so first words aren't lost
          for (const frame of this.preRoll) {
            this.onAudioData?.(frame.buffer as ArrayBuffer);
          }
          this.preRoll = [];
        }
        this.onAudioData?.(pcm16.buffer as ArrayBuffer);
      } else {
        this.preRoll.push(pcm16);
        if (this.preRoll.length > PRE_ROLL_FRAMES) {
          this.preRoll.shift();
        }
      }
    };

    this.micSource.connect(this.processor);

    // ScriptProcessor must be connected to destination to fire; mute it.
    this.muteOutput = this.audioContext.createGain();
    this.muteOutput.gain.value = 0;
    this.processor.connect(this.muteOutput);
    this.muteOutput.connect(this.audioContext.destination);
  }

  private floatToPcm16(input: Float32Array): Int16Array {
    const pcm16 = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return pcm16;
  }

  private processVAD(rms: number): void {
    const now = Date.now();
    const threshold = this.opts.vadThreshold;

    if (rms > threshold) {
      this.speechActiveFrames += 1;
      this.speechIdleFrames = 0;

      if (!this.isSpeaking && this.speechActiveFrames >= 2) {
        this.isSpeaking = true;
        this.setState('speaking');
        this.onSpeechStart?.();
      }

      if (this.isSpeaking) {
        this.silenceStart = now;
      }
    } else {
      this.speechIdleFrames += 1;
      this.speechActiveFrames = 0;

      if (
        this.isSpeaking &&
        this.speechIdleFrames >= 2 &&
        now - this.silenceStart > this.opts.vadSilenceTimeout
      ) {
        this.isSpeaking = false;
        this.setState(this.isPlaying ? 'playing' : 'listening');
        this.onSpeechEnd?.();
      }
    }
  }

  stopCapture(): void {
    if (this.processor) {
      this.processor.onaudioprocess = null;
      this.processor.disconnect();
    }
    this.micSource?.disconnect();
    this.analyser?.disconnect();
    this.muteOutput?.disconnect();

    this.mediaStream?.getTracks().forEach((t) => t.stop());

    if (this.audioContext && this.audioContext.state !== 'closed') {
      void this.audioContext.close();
    }

    this.processor = null;
    this.micSource = null;
    this.analyser = null;
    this.muteOutput = null;
    this.mediaStream = null;
    this.audioContext = null;

    this.isSpeaking = false;
    this.speechActiveFrames = 0;
    this.speechIdleFrames = 0;
    this.preRoll = [];

    this.setState(this.isPlaying ? 'playing' : 'idle');
  }

  // ---------------------------------------------------------------------------
  // Playback (gapless)
  // ---------------------------------------------------------------------------

  /**
   * Queue audio data for playback.
   *
   * Accepts ArrayBuffer (raw PCM16 little-endian binary)
   * or base64-encoded string (legacy).
   *
   * Gemini Live output is PCM16 mono @ 24kHz.
   *
   * Every chunk is scheduled on the AudioContext clock right after the
   * previous one, so there are no gaps/clicks between chunks.
   */
  playAudio(audioData: ArrayBuffer | string): void {
    if (!this.playbackContext) {
      this.playbackContext = new AudioContext({
        sampleRate: this.opts.playbackSampleRate,
      });

      // Playback analyser for lip-sync
      this.playbackAnalyser = this.playbackContext.createAnalyser();
      this.playbackAnalyser.fftSize = 256;
      this.playbackAnalyser.connect(this.playbackContext.destination);
    }

    const ctx = this.playbackContext;

    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    const float32 = this.decodeToFloat32(audioData);
    if (!float32 || float32.length === 0) return;

    const sampleRate = this.opts.playbackSampleRate;
    const buffer = ctx.createBuffer(1, float32.length, sampleRate);

    // Schedule right after the previous chunk. If we ran dry (underrun)
    // restart with a small jitter buffer and a short fade-in to avoid a click.
    const now = ctx.currentTime;
    if (this.nextStartTime < now) {
      this.nextStartTime = now + this.opts.playbackLeadTime;

      const fadeSamples = Math.min(
        float32.length,
        Math.floor(FADE_IN_SECONDS * sampleRate)
      );
      for (let i = 0; i < fadeSamples; i++) {
        float32[i] *= i / fadeSamples;
      }
    }

    buffer.getChannelData(0).set(float32);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.playbackAnalyser ?? ctx.destination);

    source.start(this.nextStartTime);
    this.nextStartTime += buffer.duration;

    this.activeSources.add(source);
    this.isPlaying = true;
    this.setState('playing');

    source.onended = () => {
      this.activeSources.delete(source);

      if (this.activeSources.size === 0) {
        this.isPlaying = false;

        if (this.isSpeaking) {
          this.setState('speaking');
        } else if (this.mediaStream) {
          this.setState('listening');
        } else {
          this.setState('idle');
        }
      }
    };
  }

  /**
   * Convert PCM16 LE (ArrayBuffer or base64) to Float32.
   * Handles odd-length chunks by carrying the leftover byte over
   * to the next chunk, so samples are never split/corrupted.
   */
  private decodeToFloat32(audioData: ArrayBuffer | string): Float32Array | null {
    let bytes: Uint8Array;

    if (audioData instanceof ArrayBuffer) {
      bytes = new Uint8Array(audioData);
    } else {
      const bin = atob(audioData);
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) {
        bytes[i] = bin.charCodeAt(i);
      }
    }

    // Prepend leftover byte from previous chunk
    if (this.pendingByte !== null) {
      const merged = new Uint8Array(bytes.length + 1);
      merged[0] = this.pendingByte;
      merged.set(bytes, 1);
      bytes = merged;
      this.pendingByte = null;
    }

    // Keep trailing odd byte for next chunk
    if (bytes.length % 2 === 1) {
      this.pendingByte = bytes[bytes.length - 1];
      bytes = bytes.subarray(0, bytes.length - 1);
    }

    if (bytes.length === 0) return null;

    // DataView avoids alignment problems with Int16Array on odd byteOffsets
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const sampleCount = bytes.length / 2;
    const float32 = new Float32Array(sampleCount);

    for (let i = 0; i < sampleCount; i++) {
      float32[i] = view.getInt16(i * 2, true) / 0x8000;
    }

    return float32;
  }

  /**
   * Stop all playback immediately (barge-in)
   */
  stopPlayback(): void {
    // Clear handlers first so they don't fire state changes mid-stop
    for (const src of this.activeSources) {
      src.onended = null;
      try {
        src.stop();
      } catch {
        // Source may already have ended.
      }
      src.disconnect();
    }

    this.activeSources.clear();
    this.nextStartTime = 0;
    this.pendingByte = null;
    this.isPlaying = false;

    if (this.isSpeaking) {
      this.setState('speaking');
    } else if (this.mediaStream) {
      this.setState('listening');
    } else {
      this.setState('idle');
    }
  }

  destroy(): void {
    this.stopPlayback();
    this.stopCapture();

    if (this.playbackContext && this.playbackContext.state !== 'closed') {
      void this.playbackContext.close();
    }

    this.playbackContext = null;
    this.playbackAnalyser = null;
    this.onAudioData = null;
    this.setState('idle');
  }
}