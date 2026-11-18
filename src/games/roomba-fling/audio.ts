/** Tiny Web Audio synth for Roomba Fling: no files, all generated. */
export class Sfx {
  private ac: AudioContext | null = null;
  private master: GainNode | null = null;
  private humGain: GainNode | null = null;
  private humFilter: BiquadFilterNode | null = null;
  private noise: AudioBuffer | null = null;
  muted = false;

  /** Must be called from a user gesture. */
  unlock() {
    if (this.ac) { if (this.ac.state === 'suspended') void this.ac.resume(); return; }
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ac = new Ctor();
    this.ac = ac;
    this.master = ac.createGain();
    this.master.gain.value = this.muted ? 0 : 0.7;
    this.master.connect(ac.destination);
    const len = ac.sampleRate;
    this.noise = ac.createBuffer(1, len, ac.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // continuous vacuum hum: looped noise through a band-pass, volume follows speed
    const src = ac.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    this.humFilter = ac.createBiquadFilter();
    this.humFilter.type = 'bandpass';
    this.humFilter.frequency.value = 900;
    this.humFilter.Q.value = 1.4;
    this.humGain = ac.createGain();
    this.humGain.gain.value = 0;
    src.connect(this.humFilter).connect(this.humGain).connect(this.master);
    src.start();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ac) this.master.gain.setTargetAtTime(m ? 0 : 0.7, this.ac.currentTime, 0.02);
  }

  suspend() { void this.ac?.suspend(); }
  resume() { if (this.ac && this.ac.state === 'suspended') void this.ac.resume(); }

  /** speed 0..1 */
  hum(speed: number) {
    if (!this.ac || !this.humGain || !this.humFilter) return;
    const t = this.ac.currentTime;
    this.humGain.gain.setTargetAtTime(speed > 0.005 ? 0.05 + speed * 0.12 : 0, t, 0.05);
    this.humFilter.frequency.setTargetAtTime(700 + speed * 1600, t, 0.05);
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0) {
    if (!this.ac || !this.master) return;
    const t = this.ac.currentTime + delay;
    const o = this.ac.createOscillator();
    const g = this.ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private burst(dur: number, freq: number, vol: number, q = 1, type: BiquadFilterType = 'lowpass') {
    if (!this.ac || !this.master || !this.noise) return;
    const t = this.ac.currentTime;
    const s = this.ac.createBufferSource();
    s.buffer = this.noise;
    const f = this.ac.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  stretch(power: number) { this.tone(200 + power * 500, 0.05, 'triangle', 0.05); }

  fling(power: number) {
    this.burst(0.25, 1200 + power * 2500, 0.25 + power * 0.25, 0.8, 'bandpass');
    this.tone(220 + power * 200, 0.18, 'triangle', 0.15, 520 + power * 500);
  }

  bump(kind: string, intensity: number) {
    const v = Math.min(1, intensity);
    if (v < 0.04) return;
    if (kind === 'pillow') { this.tone(300, 0.16, 'sine', 0.35 * v + 0.1, 720); return; }
    if (kind === 'rosie') { this.burst(0.1, 300, 0.2 * v + 0.05, 1); return; }
    if (kind === 'ball') { this.tone(600, 0.07, 'sine', 0.25 * v, 300); return; }
    if (kind === 'glass') { this.tone(1900, 0.18, 'sine', 0.12 * v + 0.03); this.tone(2850, 0.12, 'sine', 0.06 * v); }
    if (kind === 'gate') { this.tone(1100, 0.12, 'triangle', 0.1 * v + 0.03, 900); }
    const soft = kind === 'soft';
    this.burst(soft ? 0.12 : 0.09, soft ? 350 : 900, (soft ? 0.25 : 0.35) * v + 0.03, 1);
    this.tone(soft ? 90 : 140, 0.1, 'sine', 0.35 * v, soft ? 60 : 80);
  }

  /** Grumpy dog growl + short huff when Rosie is woken. */
  growl() {
    if (!this.ac || !this.master) return;
    const t = this.ac.currentTime;
    const o = this.ac.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(95, t);
    o.frequency.linearRampToValueAtTime(120, t + 0.25);
    o.frequency.linearRampToValueAtTime(85, t + 0.55);
    // rough "rrr" flutter
    const lfo = this.ac.createOscillator();
    lfo.frequency.value = 28;
    const lfoGain = this.ac.createGain();
    lfoGain.gain.value = 0.5;
    const g = this.ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.05);
    g.gain.setValueAtTime(0.22, t + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    const amp = this.ac.createGain();
    amp.gain.value = 0.5;
    lfo.connect(lfoGain).connect(amp.gain);
    const f = this.ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 700;
    o.connect(f).connect(amp).connect(g).connect(this.master);
    o.start(t); lfo.start(t);
    o.stop(t + 0.65); lfo.stop(t + 0.65);
    // annoyed single bark at the end
    this.tone(420, 0.09, 'square', 0.1, 300, 0.6);
    this.burst(0.08, 900, 0.12, 2, 'bandpass');
  }

  dock() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.18, undefined, i * 0.09));
  }

  fail() {
    [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.28, 'square', 0.07, f * 0.97, i * 0.16));
  }

  click() { this.tone(880, 0.05, 'square', 0.06); }
}
