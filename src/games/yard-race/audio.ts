/** Web Audio synth for the yard race. No sound files. */

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  muted = false;

  /** Must be called from a user gesture. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.6;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.6, this.ctx.currentTime, 0.02);
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  private tone(freq: number, dur: number, vol: number, type: OscillatorType = 'sine', when = 0, slideTo?: number) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private burst(freq: number, q: number, dur: number, vol: number, when = 0, type: BiquadFilterType = 'bandpass') {
    if (!this.ctx || !this.master || !this.noise) return;
    const t = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  /** Turtle footstep: soft low thump. */
  step() {
    this.tone(90 + Math.random() * 15, 0.12, 0.35, 'sine', 0, 55);
    this.burst(400, 1, 0.05, 0.08, 0, 'lowpass');
  }

  /** Bunny landing a hop: light pat. */
  hop() {
    this.burst(1400 + Math.random() * 400, 1.2, 0.04, 0.09);
    this.tone(260 + Math.random() * 40, 0.05, 0.05, 'triangle');
  }

  /** Crunchy nibble. */
  munch() {
    for (let i = 0; i < 2; i++) this.burst(3000 + Math.random() * 1500, 3, 0.045, 0.22, i * 0.06);
  }

  flop() {
    this.tone(520, 0.5, 0.18, 'triangle', 0, 120);
    this.burst(300, 1, 0.18, 0.18, 0.35, 'lowpass');
  }

  up() {
    this.tone(330, 0.1, 0.12, 'triangle');
    this.tone(495, 0.14, 0.12, 'triangle', 0.08);
  }

  tired() {
    this.tone(300, 0.45, 0.12, 'sine', 0, 160);
  }

  beep(high: boolean) {
    this.tone(high ? 880 : 520, high ? 0.45 : 0.18, 0.22, 'square');
  }

  shutter() {
    this.burst(5000, 0.7, 0.05, 0.35, 0, 'highpass');
    this.burst(2500, 0.8, 0.07, 0.3, 0.07, 'highpass');
  }

  fanfare() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((n, i) => this.tone(n, i === 3 ? 0.6 : 0.16, 0.16, 'triangle', i * 0.12));
    this.tone(784, 0.6, 0.08, 'sine', 0.36);
  }

  click() {
    this.tone(660, 0.05, 0.08, 'triangle');
  }
}
