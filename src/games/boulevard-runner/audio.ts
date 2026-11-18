/** Tiny Web Audio synth for the runner: tram bell, bike bell, jump, swish, bonk. No files. */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = false;

  /** Must be called from a user gesture (PLAY) so mobile browsers allow audio. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  suspend() { if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend(); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume(); }

  private tone(freq: number, start: number, dur: number, type: OscillatorType, vol: number, slideTo?: number) {
    const c = this.ctx!, m = this.master!;
    const o = c.createOscillator();
    const gn = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
    gn.gain.setValueAtTime(0.0001, start);
    gn.gain.exponentialRampToValueAtTime(vol, start + 0.008);
    gn.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(gn).connect(m);
    o.start(start);
    o.stop(start + dur + 0.02);
  }
  private noise(start: number, dur: number, vol: number, freq: number) {
    const c = this.ctx!, m = this.master!;
    const len = Math.ceil(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    const gn = c.createGain();
    gn.gain.value = vol;
    src.connect(f).connect(gn).connect(m);
    src.start(start);
  }
  private ok() { return !!this.ctx && !this.muted && this.ctx.state === 'running'; }

  /** Light-rail bell: ding-ding. */
  tramBell() {
    if (!this.ok()) return;
    const t = this.ctx!.currentTime;
    for (const dt of [0, 0.22]) {
      this.tone(1180, t + dt, 0.7, 'sine', 0.35);
      this.tone(2950, t + dt, 0.35, 'sine', 0.12);
      this.tone(1770, t + dt, 0.5, 'triangle', 0.08);
    }
  }
  /** Bicycle bell: quick ring-ring. */
  bikeBell() {
    if (!this.ok()) return;
    const t = this.ctx!.currentTime;
    for (let i = 0; i < 2; i++) {
      for (let k = 0; k < 4; k++) this.tone(2350, t + i * 0.16 + k * 0.025, 0.12, 'square', 0.04);
      this.tone(3500, t + i * 0.16, 0.18, 'sine', 0.06);
    }
  }
  jump() {
    if (!this.ok()) return;
    this.tone(330, this.ctx!.currentTime, 0.16, 'triangle', 0.25, 720);
  }
  swish() {
    if (!this.ok()) return;
    this.noise(this.ctx!.currentTime, 0.09, 0.35, 1800);
  }
  /** Scrabbling up onto a tram roof. */
  mount() {
    if (!this.ok()) return;
    const t = this.ctx!.currentTime;
    this.tone(420, t, 0.1, 'square', 0.08, 840);
    this.tone(640, t + 0.07, 0.12, 'triangle', 0.18, 1100);
  }
  /** Soft paw thump on landing. */
  land() {
    if (!this.ok()) return;
    this.noise(this.ctx!.currentTime, 0.06, 0.25, 400);
  }
  /** Treat: bright two-note blip. */
  treat() {
    if (!this.ok()) return;
    const t = this.ctx!.currentTime;
    this.tone(1320, t, 0.08, 'triangle', 0.16);
    this.tone(1760, t + 0.05, 0.1, 'triangle', 0.14);
  }
  /** Power-up: rising arpeggio. */
  power() {
    if (!this.ok()) return;
    const t = this.ctx!.currentTime;
    [660, 880, 1100, 1320].forEach((f, i) => this.tone(f, t + i * 0.06, 0.16, 'square', 0.07));
  }
  /** Skateboard takes the hit: crack + whoosh. */
  shield() {
    if (!this.ok()) return;
    const t = this.ctx!.currentTime;
    this.noise(t, 0.12, 0.5, 2500);
    this.tone(500, t, 0.25, 'sawtooth', 0.12, 120);
  }
  bonk() {
    if (!this.ok()) return;
    const t = this.ctx!.currentTime;
    this.tone(180, t, 0.3, 'sine', 0.6, 60);
    this.noise(t, 0.18, 0.6, 500);
    this.tone(620, t + 0.05, 0.25, 'triangle', 0.15, 300);
  }
}
