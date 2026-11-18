/** Synthesized sound for Hose Shooter (Web Audio, no files). */

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sprayGain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  muted = false;

  /** Must be called from a user gesture. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
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
      // continuous hiss for the hose, gated by sprayGain
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2300;
      bp.Q.value = 0.6;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 5200;
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 7;
      lfoGain.gain.value = 500;
      lfo.connect(lfoGain).connect(bp.frequency);
      lfo.start();
      this.sprayGain = ctx.createGain();
      this.sprayGain.gain.value = 0;
      src.connect(bp).connect(lp).connect(this.sprayGain).connect(this.master);
      src.start();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.02);
  }

  suspend() {
    this.spray(false);
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  close() {
    if (this.ctx) void this.ctx.close();
    this.ctx = null;
  }

  spray(on: boolean) {
    if (!this.ctx || !this.sprayGain) return;
    this.sprayGain.gain.setTargetAtTime(on ? 0.22 : 0, this.ctx.currentTime, on ? 0.03 : 0.06);
  }

  private burst(dur: number, freq: number, gain: number, type: BiquadFilterType = 'lowpass') {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.noise) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + dur + 0.02);
  }

  private tone(type: OscillatorType, freqs: [number, number][], dur: number, gain: number, at = 0, vibrato = 0) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freqs[0][1], t);
    for (const [time, f] of freqs) o.frequency.linearRampToValueAtTime(f, t + time);
    if (vibrato) {
      const v = ctx.createOscillator();
      const vg = ctx.createGain();
      v.frequency.value = 28;
      vg.gain.value = vibrato;
      v.connect(vg).connect(o.frequency);
      v.start(t);
      v.stop(t + dur);
    }
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2600;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(lp).connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  splash() {
    this.burst(0.18, 1800, 0.35);
  }

  cat() {
    this.burst(0.25, 1400, 0.4);
    const base = 480 + Math.random() * 160;
    this.tone('sawtooth', [[0, base], [0.12, base * 1.9], [0.38, base * 0.8]], 0.42, 0.22, 0.03, 18);
  }

  chicken() {
    this.burst(0.3, 2400, 0.35);
    for (let i = 0; i < 3; i++) this.tone('square', [[0, 700 + i * 60], [0.05, 1100 + i * 80], [0.1, 600]], 0.12, 0.12, i * 0.11);
    // a little bonus jingle
    [784, 988, 1175, 1568].forEach((f, i) => this.tone('triangle', [[0, f], [0.1, f]], 0.16, 0.12, 0.35 + i * 0.07));
  }

  oops() {
    this.burst(0.2, 900, 0.3);
    this.tone('triangle', [[0, 330], [0.12, 300]], 0.16, 0.22);
    this.tone('triangle', [[0, 220], [0.25, 150]], 0.32, 0.22, 0.15);
  }

  chickenUp() {
    this.tone('square', [[0, 900], [0.06, 1300]], 0.09, 0.06);
  }

  tick() {
    this.tone('square', [[0, 1000], [0.04, 1000]], 0.06, 0.08);
  }

  whistle() {
    this.tone('sine', [[0, 1900], [0.1, 2300], [0.5, 2200]], 0.6, 0.18, 0, 40);
  }
}
