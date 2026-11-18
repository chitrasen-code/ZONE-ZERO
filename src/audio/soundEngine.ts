import { WeaponId } from '../types/game';

class ProceduralSoundEngine {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private volume = 0.65;
  private muted = false;

  public configure(volume: number, muted: boolean): void {
    this.volume = Math.max(0, Math.min(1, volume));
    this.muted = muted;
  }

  private ensureContext(): AudioContext | null {
    if (this.muted || this.volume <= 0.001) return null;
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    if (!this.noiseBuffer && this.ctx) {
      const sampleRate = this.ctx.sampleRate;
      const length = Math.floor(sampleRate * 0.6);
      const buffer = this.ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buffer;
    }
    return this.ctx;
  }

  public playUiClick(accent = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = accent ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(accent ? 640 : 480, now);
    osc.frequency.exponentialRampToValueAtTime(accent ? 320 : 240, now + 0.045);

    gain.gain.setValueAtTime(0.08 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  public playPickup(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [420, 620].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.06);
      gain.gain.setValueAtTime(0.09 * this.volume, now + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 0.09);
    });
  }

  public playFootstep(surface: 'grass' | 'road' | 'concrete' | 'sand'): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    const baseFreq =
      surface === 'concrete' ? 950 : surface === 'road' ? 720 : surface === 'sand' ? 520 : 380;
    filter.frequency.setValueAtTime(baseFreq * (0.9 + Math.random() * 0.2), now);
    filter.Q.value = 1.4;

    const gain = ctx.createGain();
    const amp = (surface === 'concrete' ? 0.09 : 0.065) * this.volume;
    gain.gain.setValueAtTime(amp, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now, Math.random() * 0.2, 0.07);
  }

  public playJump(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(190, now + 0.09);
    gain.gain.setValueAtTime(0.11 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  public playLand(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(95, now);
    osc.frequency.exponentialRampToValueAtTime(36, now + 0.11);
    oscGain.gain.setValueAtTime(0.14 * this.volume, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  public playShot(weaponId: WeaponId): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    const params: Record<
      WeaponId,
      { freq: number; endFreq: number; dur: number; peak: number; oscFreq: number }
    > = {
      vx47: { freq: 1450, endFreq: 280, dur: 0.14, peak: 0.26, oscFreq: 180 },
      k9smg: { freq: 1900, endFreq: 420, dur: 0.1, peak: 0.19, oscFreq: 220 },
      lsr90: { freq: 920, endFreq: 130, dur: 0.34, peak: 0.38, oscFreq: 115 },
      sg12: { freq: 780, endFreq: 150, dur: 0.26, peak: 0.36, oscFreq: 130 },
      p45: { freq: 1700, endFreq: 380, dur: 0.11, peak: 0.21, oscFreq: 210 },
    };

    const p = params[weaponId];

    // Acoustic noise crack
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(p.freq, now);
    filter.frequency.exponentialRampToValueAtTime(p.endFreq, now + p.dur);
    filter.Q.value = weaponId === 'sg12' ? 0.55 : 0.85;

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(p.peak * this.volume, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + p.dur);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(ctx.destination);
    noise.start(now, 0, p.dur + 0.02);

    // Mechanical low-end punch
    const osc = ctx.createOscillator();
    const oGain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(p.oscFreq, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.09);
    oGain.gain.setValueAtTime(0.18 * this.volume, now);
    oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(oGain);
    oGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  public playReload(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    [0, 0.24].forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(idx === 0 ? 520 : 820, now + offset);
      osc.frequency.exponentialRampToValueAtTime(idx === 0 ? 280 : 440, now + offset + 0.04);
      gain.gain.setValueAtTime(0.065 * this.volume, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.045);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.05);
    });
  }

  public playTargetHit(isHeadshot = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc1.type = 'triangle';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(isHeadshot ? 1480 : 980, now);
    osc2.frequency.setValueAtTime(isHeadshot ? 2320 : 1460, now);

    gain.gain.setValueAtTime((isHeadshot ? 0.19 : 0.14) * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isHeadshot ? 0.28 : 0.19));

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.3);
    osc2.stop(now + 0.3);
  }
}

export const soundEngine = new ProceduralSoundEngine();
