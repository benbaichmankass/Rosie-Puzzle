/** Small Web Audio synth for Garden Defense: water, nibbles, plucked notes. No sound files. */

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private waterGain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  muted = false;

  /** Must be called from a user gesture. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.7;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 2;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      // Continuous water noise, faded in while pouring.
      const src = this.ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2400;
      bp.Q.value = 0.7;
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 900;
      this.waterGain = this.ctx.createGain();
      this.waterGain.gain.value = 0;
      src.connect(bp).connect(hp).connect(this.waterGain).connect(this.master);
      src.start();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.7, this.ctx.currentTime, 0.02);
  }

  suspend() {
    this.water(false);
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  water(on: boolean) {
    if (!this.ctx || !this.waterGain) return;
    this.waterGain.gain.setTargetAtTime(on ? 0.16 : 0, this.ctx.currentTime, on ? 0.05 : 0.12);
  }

  /** Crunchy nibble. */
  bite() {
    if (!this.ctx || !this.master || !this.noise) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noise;
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 3200 + Math.random() * 1500;
      f.Q.value = 3;
      const g = this.ctx.createGain();
      const st = t + i * 0.07;
      g.gain.setValueAtTime(0, st);
      g.gain.linearRampToValueAtTime(0.35, st + 0.005);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.05);
      src.connect(f).connect(g).connect(this.master);
      src.start(st, Math.random());
      src.stop(st + 0.06);
    }
  }

  /** Plucked string (koto-ish). */
  pluck(freq: number, when = 0, vol = 0.25, dur = 1.2) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const o2 = this.ctx.createOscillator();
    o.type = 'triangle';
    o2.type = 'sine';
    o.frequency.value = freq;
    o2.frequency.value = freq * 2.01;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    const g2 = this.ctx.createGain();
    g2.gain.value = 0.3;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(freq * 8, t);
    lp.frequency.exponentialRampToValueAtTime(freq * 1.5, t + dur * 0.6);
    o.connect(lp);
    o2.connect(g2).connect(lp);
    lp.connect(g).connect(this.master);
    o.start(t);
    o2.start(t);
    o.stop(t + dur);
    o2.stop(t + dur);
  }

  /** Soft hop thump. */
  hop() {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.08);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.12);
  }

  // Japanese "in" pentatonic-ish scale (D E F A Bb).
  private scale = [293.66, 329.63, 349.23, 440, 466.16, 587.33, 659.25, 698.46, 880];

  start() {
    [0, 2, 3, 5].forEach((n, i) => this.pluck(this.scale[n], i * 0.12, 0.2));
  }
  grow() {
    this.pluck(this.scale[5 + Math.floor(Math.random() * 4)], 0, 0.05, 0.5);
  }
  die() {
    this.pluck(this.scale[4], 0, 0.28, 1.5);
    this.pluck(this.scale[1], 0.18, 0.28, 1.8);
    this.pluck(this.scale[0] / 2, 0.36, 0.22, 2);
  }
  tall() {
    [3, 5, 7].forEach((n, i) => this.pluck(this.scale[n], i * 0.08, 0.18, 1));
  }
  win() {
    [0, 2, 3, 5, 6, 7, 8].forEach((n, i) => this.pluck(this.scale[n], i * 0.13, 0.22, 1.6));
  }
  over() {
    [7, 5, 4, 2, 1, 0].forEach((n, i) => this.pluck(this.scale[n], i * 0.2, 0.22, 1.8));
  }
}
