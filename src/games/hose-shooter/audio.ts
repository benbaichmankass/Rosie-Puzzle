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

  private strings = new Map<number, AudioBuffer>();

  /** Karplus-Strong plucked string: a twangy desert guitar note. */
  private twang(freq: number, at = 0, gain = 0.3, dur = 1.4) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const key = Math.round(freq);
    let buf = this.strings.get(key);
    if (!buf) {
      const sr = ctx.sampleRate;
      const len = Math.floor(sr * dur);
      buf = ctx.createBuffer(1, len, sr);
      const d = buf.getChannelData(0);
      const n = Math.max(2, Math.round(sr / freq));
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      for (let i = n; i < len; i++) d[i] = 0.4985 * (d[i - n] + d[i - n + 1]);
      this.strings.set(key, buf);
    }
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    // a touch of "spaghetti western" spring reverb wobble
    src.detune.setValueAtTime(0, t);
    src.detune.linearRampToValueAtTime(-25, t + dur);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 90;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(hp).connect(g).connect(this.master);
    const echo = ctx.createDelay(0.5);
    echo.delayTime.value = 0.18;
    const eg = ctx.createGain();
    eg.gain.value = 0.28;
    g.connect(echo).connect(eg).connect(this.master);
    src.start(t);
    src.stop(t + dur);
  }

  /** Ricochet: a falling whine off a splash. */
  private ricochet(at = 0, gain = 0.1) {
    const f = 2600 + Math.random() * 900;
    this.tone('sine', [[0, f], [0.28, f * 0.42]], 0.32, gain, at, 60);
  }

  private bell(freq: number, at = 0, gain = 0.22) {
    for (const [mul, gk] of [[1, 1], [2.76, 0.45], [5.4, 0.25]] as const) this.tone('sine', [[0, freq * mul], [1, freq * mul]], 1.1, gain * gk, at);
  }

  splash() {
    this.burst(0.18, 1800, 0.35);
  }

  cat() {
    this.burst(0.25, 1400, 0.4);
    this.ricochet(0.02, 0.08);
    const base = 480 + Math.random() * 160;
    this.tone('sawtooth', [[0, base], [0.12, base * 1.9], [0.38, base * 0.8]], 0.42, 0.2, 0.06, 18);
  }

  chicken() {
    this.burst(0.3, 2400, 0.35);
    for (let i = 0; i < 3; i++) this.tone('square', [[0, 700 + i * 60], [0.05, 1100 + i * 80], [0.1, 600]], 0.12, 0.1, i * 0.11);
    // outlaw caught: a bright twangy run
    [330, 392, 494, 659, 988].forEach((f, i) => this.twang(f, 0.32 + i * 0.07, 0.24));
  }

  oops() {
    this.burst(0.2, 900, 0.3);
    this.twang(110, 0, 0.32, 1.2);
    this.twang(104, 0.16, 0.3, 1.2);
  }

  chickenUp() {
    this.twang(880, 0, 0.12, 0.6);
  }

  tick() {
    this.bell(1320, 0, 0.08);
  }

  count(beat: 'ready' | 'steady' | 'draw') {
    if (beat === 'draw') {
      this.burst(0.25, 3000, 0.45, 'bandpass');
      this.ricochet(0.04, 0.12);
      [165, 247, 330].forEach((f, i) => this.twang(f, 0.05 + i * 0.05, 0.3));
    } else this.bell(beat === 'ready' ? 660 : 784, 0, 0.18);
  }

  /** Round over: a mournful low twang riff and a long whistle. */
  whistle() {
    [330, 294, 247, 165].forEach((f, i) => this.twang(f, i * 0.2, 0.3, 1.6));
    this.tone('sine', [[0, 1500], [0.25, 1900], [1.1, 1700]], 1.2, 0.1, 0.85, 30);
  }
}
