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
  bonk() {
    if (!this.ok()) return;
    const t = this.ctx!.currentTime;
    this.tone(180, t, 0.3, 'sine', 0.6, 60);
    this.noise(t, 0.18, 0.6, 500);
    this.tone(620, t + 0.05, 0.25, 'triangle', 0.15, 300);
  }
}
