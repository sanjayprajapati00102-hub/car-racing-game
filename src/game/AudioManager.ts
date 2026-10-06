import { GameSettings } from './types';

export type SoundEffectKey =
  | 'menu_click'
  | 'menu_hover'
  | 'countdown_beep'
  | 'countdown_go'
  | 'collision'
  | 'coin'
  | 'lap_complete'
  | 'victory'
  | 'defeat'
  | 'upgrade'
  | 'unlock';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineSubOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private skidNoiseNode: AudioBufferSourceNode | null = null;
  private skidGain: GainNode | null = null;
  private nitroGain: GainNode | null = null;

  private isEngineRunning = false;
  private settings: GameSettings;
  private customAudioFiles: Partial<Record<SoundEffectKey, string>> = {};

  constructor(settings: GameSettings) {
    this.settings = settings;
  }

  public updateSettings(settings: GameSettings): void {
    this.settings = settings;
    if (this.settings.muted && this.isEngineRunning) {
      this.stopEngine();
    }
  }

  /**
   * Allows replacing synthesized sounds with local audio files if desired.
   */
  public registerCustomAudio(key: SoundEffectKey, url: string): void {
    this.customAudioFiles[key] = url;
  }

  private ensureContext(): AudioContext | null {
    if (this.settings.muted) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private getEffectiveSfxVolume(): number {
    if (this.settings.muted) return 0;
    return (this.settings.masterVolume / 100) * (this.settings.sfxVolume / 100);
  }

  public startEngine(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.isEngineRunning) return;

    try {
      this.engineGain = ctx.createGain();
      this.engineGain.gain.value = 0.001;
      this.engineGain.connect(ctx.destination);

      this.engineOsc = ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;

      this.engineSubOsc = ctx.createOscillator();
      this.engineSubOsc.type = 'triangle';
      this.engineSubOsc.frequency.value = 27.5;

      // Lowpass filter to warm up the engine sound
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;

      this.engineOsc.connect(filter);
      this.engineSubOsc.connect(filter);
      filter.connect(this.engineGain);

      this.engineOsc.start();
      this.engineSubOsc.start();

      // Setup continuous noise buffer for tire skid and nitro rush
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      this.skidNoiseNode = ctx.createBufferSource();
      this.skidNoiseNode.buffer = noiseBuffer;
      this.skidNoiseNode.loop = true;

      const skidFilter = ctx.createBiquadFilter();
      skidFilter.type = 'bandpass';
      skidFilter.frequency.value = 1100;
      skidFilter.Q.value = 3.5;

      this.skidGain = ctx.createGain();
      this.skidGain.gain.value = 0;

      const nitroFilter = ctx.createBiquadFilter();
      nitroFilter.type = 'bandpass';
      nitroFilter.frequency.value = 420;
      nitroFilter.Q.value = 1.2;

      this.nitroGain = ctx.createGain();
      this.nitroGain.gain.value = 0;

      this.skidNoiseNode.connect(skidFilter);
      skidFilter.connect(this.skidGain);
      this.skidGain.connect(ctx.destination);

      this.skidNoiseNode.connect(nitroFilter);
      nitroFilter.connect(this.nitroGain);
      this.nitroGain.connect(ctx.destination);

      this.skidNoiseNode.start();
      this.isEngineRunning = true;
    } catch {
      // Ignore audio init errors on restricted autoplay
    }
  }

  public updateEngineTelemetry(params: {
    speedRatio: number;
    accelerating: boolean;
    braking: boolean;
    drifting: boolean;
    nitroActive: boolean;
  }): void {
    if (this.settings.muted) {
      if (this.isEngineRunning) this.stopEngine();
      return;
    }
    if (!this.isEngineRunning) {
      this.startEngine();
    }
    const ctx = this.ctx;
    if (!ctx || !this.engineOsc || !this.engineSubOsc || !this.engineGain) return;

    const vol = this.getEffectiveSfxVolume();
    const now = ctx.currentTime;

    // Simulate gear shifts & RPM pitch
    const gearRatio = (params.speedRatio * 3.6) % 1.0;
    const baseFreq = 48 + params.speedRatio * 125 + gearRatio * 38 + (params.accelerating ? 14 : 0) + (params.nitroActive ? 35 : 0);

    this.engineOsc.frequency.setTargetAtTime(baseFreq, now, 0.05);
    this.engineSubOsc.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.05);

    const targetEngineGain = Math.min(0.14, (0.04 + params.speedRatio * 0.07 + (params.accelerating ? 0.02 : 0)) * vol);
    this.engineGain.gain.setTargetAtTime(targetEngineGain, now, 0.06);

    if (this.skidGain) {
      const isSkidding = params.drifting || (params.braking && params.speedRatio > 0.25);
      const targetSkid = isSkidding ? 0.08 * vol : 0;
      this.skidGain.gain.setTargetAtTime(targetSkid, now, 0.05);
    }

    if (this.nitroGain) {
      const targetNitro = params.nitroActive ? 0.14 * vol : 0;
      this.nitroGain.gain.setTargetAtTime(targetNitro, now, 0.05);
    }
  }

  public stopEngine(): void {
    try {
      this.engineOsc?.stop();
      this.engineSubOsc?.stop();
      this.skidNoiseNode?.stop();
    } catch {
      // ignore
    }
    this.engineOsc = null;
    this.engineSubOsc = null;
    this.engineGain = null;
    this.skidNoiseNode = null;
    this.skidGain = null;
    this.nitroGain = null;
    this.isEngineRunning = false;
  }

  public playSfx(key: SoundEffectKey): void {
    const vol = this.getEffectiveSfxVolume();
    if (vol <= 0.001) return;

    // Support custom audio asset if registered
    const customUrl = this.customAudioFiles[key];
    if (customUrl) {
      const audio = new Audio(customUrl);
      audio.volume = Math.min(1, vol);
      audio.play().catch(() => {});
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    switch (key) {
      case 'menu_hover':
        this.playTone(ctx, 520, 560, 0.035, 'sine', 0.04 * vol, now);
        break;
      case 'menu_click':
        this.playTone(ctx, 660, 880, 0.07, 'triangle', 0.1 * vol, now);
        break;
      case 'countdown_beep':
        this.playTone(ctx, 440, 440, 0.18, 'sine', 0.18 * vol, now);
        break;
      case 'countdown_go':
        this.playTone(ctx, 880, 1174.66, 0.35, 'triangle', 0.24 * vol, now);
        break;
      case 'coin':
        this.playTone(ctx, 987.77, 1318.51, 0.12, 'sine', 0.14 * vol, now);
        break;
      case 'collision':
        this.playTone(ctx, 130, 42, 0.16, 'sawtooth', 0.22 * vol, now);
        break;
      case 'upgrade':
      case 'unlock':
        this.playTone(ctx, 523.25, 659.25, 0.09, 'triangle', 0.15 * vol, now);
        this.playTone(ctx, 659.25, 1046.5, 0.18, 'triangle', 0.18 * vol, now + 0.09);
        break;
      case 'lap_complete':
        this.playTone(ctx, 587.33, 587.33, 0.1, 'triangle', 0.16 * vol, now);
        this.playTone(ctx, 783.99, 783.99, 0.1, 'triangle', 0.16 * vol, now + 0.1);
        this.playTone(ctx, 1174.66, 1174.66, 0.25, 'triangle', 0.2 * vol, now + 0.2);
        break;
      case 'victory':
        this.playTone(ctx, 523.25, 523.25, 0.14, 'triangle', 0.2 * vol, now);
        this.playTone(ctx, 659.25, 659.25, 0.14, 'triangle', 0.2 * vol, now + 0.14);
        this.playTone(ctx, 783.99, 783.99, 0.14, 'triangle', 0.2 * vol, now + 0.28);
        this.playTone(ctx, 1046.5, 1046.5, 0.45, 'triangle', 0.24 * vol, now + 0.42);
        break;
      case 'defeat':
        this.playTone(ctx, 392.0, 369.99, 0.2, 'sawtooth', 0.15 * vol, now);
        this.playTone(ctx, 349.23, 293.66, 0.4, 'sawtooth', 0.15 * vol, now + 0.22);
        break;
    }
  }

  private playTone(
    ctx: AudioContext,
    startFreq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    startTime: number
  ): void {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(startFreq, startTime);
      if (startFreq !== endFreq) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), startTime + duration);
      }

      gain.gain.setValueAtTime(volume, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.02);
    } catch {
      // ignore
    }
  }
}
