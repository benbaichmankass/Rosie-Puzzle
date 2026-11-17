/**
 * Web Audio API synthesizer for cozy sound effects.
 * Safe for all mobile and desktop browsers without external audio assets.
 */

/**
 * Dog growl voice. A rough, low "voiced" source (jittery sawtooth + square)
 * mixed with breath noise, chopped into irregular ~30Hz pulses (the "rrrr"),
 * shaped by throat formants, lightly overdriven, under a swelling envelope.
 * Exported so it can be rendered offline for checking.
 */
export function scheduleGrowl(
  ctx: BaseAudioContext,
  dest: AudioNode,
  t0: number,
  opts: { dur: number; level: number; pitch: number; snarl?: boolean }
) {
  const { dur, level, pitch, snarl } = opts;
  const end = t0 + dur;

  const voice = ctx.createOscillator();
  voice.type = 'sawtooth';
  const voice2 = ctx.createOscillator();
  voice2.type = 'square';
  // Pitch contour with jitter: starts low, rises into the snarl, sags at the end.
  for (let t = t0; t < end; t += 0.025) {
    const u = (t - t0) / dur;
    const contour = snarl ? 0.82 + 0.3 * Math.sin(Math.min(1, u * 1.4) * Math.PI * 0.5) - (u > 0.8 ? (u - 0.8) * 0.8 : 0) : 0.95 - 0.1 * u;
    const f = pitch * contour * (0.9 + Math.random() * 0.2);
    voice.frequency.setValueAtTime(f, t);
    voice2.frequency.setValueAtTime(f * 1.01, t);
  }

  const noiseBuf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * (dur + 0.05))), ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuf;

  const vGain = ctx.createGain();
  vGain.gain.value = 0.55;
  const v2Gain = ctx.createGain();
  v2Gain.gain.value = 0.25;
  const nGain = ctx.createGain();
  nGain.gain.value = snarl ? 0.55 : 0.4;

  // Irregular pulse chopping: the rattle that makes it a growl, not a hum.
  const rattle = ctx.createGain();
  rattle.gain.setValueAtTime(0, t0);
  let t = t0;
  while (t < end) {
    const period = 1 / (19 + Math.random() * 12);
    rattle.gain.setValueAtTime(0.65 + Math.random() * 0.35, t);
    rattle.gain.linearRampToValueAtTime(0.08 + Math.random() * 0.15, t + period * 0.7);
    t += period;
  }

  // Throat / open-mouth formants
  const mix = ctx.createGain();
  const formants = [
    { f: 190, q: 2, g: 0.55 },
    { f: snarl ? 520 : 420, q: 2.2, g: 1.6 },
    { f: snarl ? 1100 : 900, q: 3.5, g: snarl ? 0.8 : 0.45 },
  ].map(({ f, q, g }) => {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f;
    bp.Q.value = q;
    const fg = ctx.createGain();
    fg.gain.value = g * 1.2;
    rattle.connect(bp);
    bp.connect(fg);
    fg.connect(mix);
    return bp;
  });
  void formants;
  // Chesty body: the low rumble straight from the source
  const body = ctx.createBiquadFilter();
  body.type = 'lowpass';
  body.frequency.value = 320;
  const bodyGain = ctx.createGain();
  bodyGain.gain.value = 0.3;
  rattle.connect(body);
  body.connect(bodyGain);
  bodyGain.connect(mix);

  // Grit
  const drive = ctx.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * 3.2);
  }
  drive.curve = curve;
  const low = ctx.createBiquadFilter();
  low.type = 'lowpass';
  low.frequency.value = snarl ? 2200 : 1500;
  // Trim the deepest bass so it still reads on small phone speakers.
  const trim = ctx.createBiquadFilter();
  trim.type = 'highpass';
  trim.frequency.value = 120;

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(level * 0.7, t0 + Math.min(0.12, dur * 0.3));
  env.gain.linearRampToValueAtTime(level, t0 + dur * 0.65);
  env.gain.linearRampToValueAtTime(level * 0.6, t0 + dur * 0.88);
  env.gain.exponentialRampToValueAtTime(0.0001, end);

  voice.connect(vGain);
  voice2.connect(v2Gain);
  noise.connect(nGain);
  vGain.connect(rattle);
  v2Gain.connect(rattle);
  nGain.connect(rattle);
  mix.connect(drive);
  drive.connect(low);
  low.connect(trim);
  trim.connect(env);
  env.connect(dest);

  voice.start(t0);
  voice2.start(t0);
  noise.start(t0);
  voice.stop(end + 0.02);
  voice2.stop(end + 0.02);
  noise.stop(end + 0.02);
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  private getContext(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public playPop() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(580, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.09);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch {
      // Audio might be blocked until user interaction
    }
  }

  public playRotate() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(260, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(420, ctx.currentTime + 0.06);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.07);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch {}
  }

  /** Low, short warning rumble ("hrrr"). */
  public playDogGrumble() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      scheduleGrowl(ctx, ctx.destination, ctx.currentTime, { dur: 0.6, level: 0.4, pitch: 78 });
    } catch {}
  }

  /** A short, wobbly "pfrrrt": a buzzing low tone plus breathy noise. */
  public playFart() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const dur = 0.75;

      // Buzzing lip-trill tone
      const osc = ctx.createOscillator();
      const wobble = ctx.createOscillator();
      const wobbleGain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(95, now);
      osc.frequency.linearRampToValueAtTime(70, now + dur * 0.6);
      osc.frequency.linearRampToValueAtTime(110, now + dur);
      wobble.type = 'square';
      wobble.frequency.setValueAtTime(22, now);
      wobble.frequency.linearRampToValueAtTime(14, now + dur);
      wobbleGain.gain.setValueAtTime(30, now);
      wobble.connect(wobbleGain);
      wobbleGain.connect(osc.frequency);

      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.setValueAtTime(420, now);
      tone.Q.setValueAtTime(6, now);

      // Breathy noise
      const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.6;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.setValueAtTime(180, now);
      band.frequency.linearRampToValueAtTime(120, now + dur);
      band.Q.setValueAtTime(3, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.32, now + 0.04);
      gain.gain.setValueAtTime(0.28, now + dur * 0.55);
      gain.gain.exponentialRampToValueAtTime(0.01, now + dur);

      osc.connect(tone);
      tone.connect(gain);
      noise.connect(band);
      band.connect(gain);
      gain.connect(ctx.destination);

      wobble.start(now);
      osc.start(now);
      noise.start(now);
      wobble.stop(now + dur);
      osc.stop(now + dur);
      noise.stop(now + dur);
    } catch {}
  }

  /** An annoyed dog: a rough "grrr" that swells into a snarl ("grr-RRRR"). */
  public playDogGrowl() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const t = ctx.currentTime;
      scheduleGrowl(ctx, ctx.destination, t, { dur: 0.42, level: 0.4, pitch: 80 });
      scheduleGrowl(ctx, ctx.destination, t + 0.38, { dur: 1.05, level: 0.5, pitch: 94, snarl: true });
    } catch {}
  }

  public playDogChomp() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      // Quick snap + squeak
      const snap = ctx.createOscillator();
      const snapGain = ctx.createGain();
      snap.type = 'sawtooth';
      snap.frequency.setValueAtTime(180, ctx.currentTime);
      snap.frequency.exponentialRampToValueAtTime(45, ctx.currentTime + 0.08);

      snapGain.gain.setValueAtTime(0.3, ctx.currentTime);
      snapGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.09);

      snap.connect(snapGain);
      snapGain.connect(ctx.destination);
      snap.start();
      snap.stop(ctx.currentTime + 0.1);

      // Yelping squeak
      const ouch = ctx.createOscillator();
      const ouchGain = ctx.createGain();
      ouch.type = 'sine';
      ouch.frequency.setValueAtTime(620, ctx.currentTime + 0.06);
      ouch.frequency.exponentialRampToValueAtTime(280, ctx.currentTime + 0.24);

      ouchGain.gain.setValueAtTime(0.2, ctx.currentTime + 0.06);
      ouchGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.26);

      ouch.connect(ouchGain);
      ouchGain.connect(ctx.destination);
      ouch.start(ctx.currentTime + 0.06);
      ouch.stop(ctx.currentTime + 0.28);
    } catch {}
  }

  public playDogBark() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(240, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(480, ctx.currentTime + 0.05);
      osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } catch {}
  }

  public playTreatCrunch() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      [0, 0.07, 0.14].forEach((t, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(450 + i * 80, ctx.currentTime + t);
        osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + t + 0.04);

        gain.gain.setValueAtTime(0.12, ctx.currentTime + t);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + t + 0.05);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + t);
        osc.stop(ctx.currentTime + t + 0.06);
      });
    } catch {}
  }

  public playSqueak() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(950, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(1300, ctx.currentTime + 0.08);
      osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.16);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch {}
  }

  public playWinFanfare() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const notes = [392.0, 523.25, 659.25, 783.99, 1046.5]; // G4, C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const start = ctx.currentTime + idx * 0.1;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.16, start);
        gain.gain.exponentialRampToValueAtTime(0.005, start + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.4);
      });
    } catch {}
  }

  public playCrunch() {
    this.playTreatCrunch();
  }

  public playSnore() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(120, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch {}
  }

  public playCuddleChime() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const notes = [587.33, 659.25, 880.0, 1174.66]; // D5, E5, A5, D6
      notes.forEach((freq, idx) => {
        const start = ctx.currentTime + idx * 0.08;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.14, start);
        gain.gain.exponentialRampToValueAtTime(0.005, start + 0.4);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.45);
      });
    } catch {}
  }

  public playPeeSplash() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      [0, 0.06, 0.14, 0.22].forEach((t, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(650 - i * 110, ctx.currentTime + t);
        osc.frequency.exponentialRampToValueAtTime(160, ctx.currentTime + t + 0.08);
        gain.gain.setValueAtTime(0.2, ctx.currentTime + t);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + t + 0.09);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + t);
        osc.stop(ctx.currentTime + t + 0.1);
      });
    } catch {}
  }
}

export const sound = new SoundEngine();
