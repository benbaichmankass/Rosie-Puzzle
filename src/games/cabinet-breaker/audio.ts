/** Synthesized kitchen sounds (Web Audio, no files). */
import type { ItemDef } from './levels';

type Material = ItemDef['material'];

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  muted = false;

  /** Must be called from a user gesture (tap) to unlock audio on mobile. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 0.6;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  private ready() {
    return !this.muted && this.ctx && this.master && this.ctx.state === 'running' ? this.ctx : null;
  }

  private tone(freq: number, dur: number, vol: number, type: OscillatorType = 'sine', delay = 0, slideTo?: number) {
    const ctx = this.ready();
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private burst(dur: number, vol: number, filter: BiquadFilterType, freq: number, q = 1, delay = 0) {
    const ctx = this.ready();
    if (!ctx || !this.noise) return;
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master!);
    s.start(t, Math.random() * 0.2, dur + 0.05);
  }

  /** Little high pings: shards tinkling. */
  private tinkles(n: number, lo: number, hi: number, vol: number, spread: number) {
    for (let i = 0; i < n; i++) {
      this.tone(lo + Math.random() * (hi - lo), 0.08 + Math.random() * 0.18, vol, 'sine', Math.random() * spread);
    }
  }

  smash(m: Material, final: boolean) {
    const r = () => 0.9 + Math.random() * 0.2;
    switch (m) {
      case 'ceramic':
        this.burst(0.12, 0.7, 'bandpass', 2600 * r(), 0.8);
        this.burst(0.06, 0.5, 'lowpass', 500, 1);
        this.tinkles(6, 2400, 5200, 0.09, 0.22);
        break;
      case 'glass':
        this.burst(0.09, 0.55, 'highpass', 4000 * r(), 0.7);
        this.tinkles(9, 3800, 8000, 0.08, 0.3);
        break;
      case 'cardboard':
        this.burst(0.14, 0.9, 'lowpass', 700 * r(), 1.2);
        this.tone(110, 0.1, 0.25, 'triangle', 0, 70);
        if (final) this.burst(0.25, 0.25, 'bandpass', 3000, 0.6, 0.05); // spilled cereal rattle
        break;
      case 'tin':
        this.metal(final ? 620 : 760, final ? 0.35 : 0.22, 0.18);
        if (final) this.burst(0.1, 0.4, 'bandpass', 1500, 2);
        break;
      case 'metal':
        this.metal(final ? 330 : 410, final ? 0.8 : 0.5, 0.22);
        break;
      case 'iron':
        this.metal(final ? 180 : 220, final ? 0.9 : 0.55, 0.26);
        this.burst(0.08, 0.5, 'lowpass', 400, 1);
        break;
    }
  }

  /** Inharmonic partials = a pot/pan clang. */
  private metal(base: number, dur: number, vol: number) {
    const ratios = [1, 2.76, 5.4, 8.93];
    ratios.forEach((k, i) => this.tone(base * k * (0.98 + Math.random() * 0.04), dur / (1 + i * 0.6), vol / (1 + i), i ? 'sine' : 'triangle'));
    this.burst(0.03, 0.4, 'highpass', 3000);
  }

  paddle(offset: number) {
    this.tone(330 + offset * 60, 0.09, 0.22, 'square', 0, 250);
    this.burst(0.04, 0.3, 'lowpass', 900);
  }

  wall() {
    this.burst(0.04, 0.35, 'bandpass', 1100, 3);
    this.tone(180, 0.05, 0.1, 'triangle');
  }

  squish(roach: boolean) {
    this.burst(0.18, 0.7, 'lowpass', roach ? 1400 : 600, 4);
    this.tone(roach ? 520 : 260, 0.18, 0.18, 'sawtooth', 0, roach ? 140 : 90);
    // Little bonus chime.
    [880, 1175, 1568].forEach((f, i) => this.tone(f * (roach ? 1.25 : 1), 0.18, 0.12, 'triangle', 0.1 + i * 0.07));
  }

  critter() {
    this.tone(1300, 0.04, 0.05, 'square');
    this.tone(1500, 0.04, 0.05, 'square', 0.07);
  }

  launch() {
    this.tone(440, 0.12, 0.15, 'triangle', 0, 880);
  }

  lose() {
    [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.22, 0.2, 'triangle', i * 0.14));
  }

  clear() {
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, 0.2, 0.18, 'triangle', i * 0.1));
  }

  gameOver() {
    [440, 415, 392, 370, 349].forEach((f, i) => this.tone(f, 0.3, 0.18, 'sawtooth', i * 0.18));
  }
}
