/** Tiny Web Audio synth for Squeegee Survival (no sound files). */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private shower: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  muted = false;

  /** Must be called from a user gesture. */
  start(): void {
    if (this.ctx) { void this.ctx.resume(); return; }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    this.master.connect(ctx.destination);
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    // the running shower: looped filtered noise
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2600;
    bp.Q.value = 0.6;
    this.shower = ctx.createGain();
    this.shower.gain.value = 0;
    src.connect(bp).connect(this.shower).connect(this.master);
    src.start();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  setShower(on: boolean): void {
    if (this.shower && this.ctx) this.shower.gain.setTargetAtTime(on ? 0.05 : 0, this.ctx.currentTime, 0.3);
  }

  suspend(): void { void this.ctx?.suspend(); }
  resume(): void { void this.ctx?.resume(); }

  private burst(freq: number, q: number, dur: number, vol: number, sweepTo?: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.noise) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  private tone(freq: number, dur: number, vol: number, type: OscillatorType = 'sine', to?: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  swish(vol: number): void { this.burst(700, 1.2, 0.22, 0.12 + vol * 0.12, 2200); }
  gurgle(): void { this.tone(220, 0.18, 0.08, 'sine', 90); this.burst(500, 4, 0.2, 0.05); }
  bubbles(): void { for (let k = 0; k < 6; k++) setTimeout(() => this.tone(500 + Math.random() * 700, 0.08, 0.06, 'sine', 1400), k * 70); }
  plop(): void { this.tone(300, 0.2, 0.12, 'sine', 120); }
  zap(): void { this.tone(90, 0.9, 0.12, 'sawtooth', 60); this.burst(3000, 0.8, 0.7, 0.18); }
  warn(): void { this.burst(4000, 2, 0.06, 0.05); }
}
