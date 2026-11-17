/**
 * Web Audio API synthesizer for cozy sound effects.
 * Safe for all mobile and desktop browsers without external audio assets.
 */

/**
 * Dog growl, built like a voice rather than a synth tone.
 *
 * Source: a train of glottal pulses at a low pitch (~70-110Hz) with heavy
 * jitter, shimmer and period-doubling (every other pulse weaker) - that
 * irregularity is the "rough" in a growl. Breath noise rides on each pulse.
 * The source goes through a dog's vocal tract (low throat resonance plus
 * mouth formants that open up for the snarl), with a slow ~20Hz flutter and
 * a swelling envelope. Rendered sample-by-sample into a buffer.
 */
export interface GrowlPart {
  dur: number;
  f0: number;
  level: number;
  snarl?: boolean;
}

export function renderGrowl(ctx: BaseAudioContext, parts: GrowlPart[], gap = 0.03): AudioBuffer {
  const sr = ctx.sampleRate;
  const total = parts.reduce((t, p) => t + p.dur + gap, 0.05);
  const out = new Float32Array(Math.ceil(total * sr));
  let offset = 0;

  for (const part of parts) {
    const n = Math.floor(part.dur * sr);
    const src = new Float32Array(n);
    // 1) glottal pulse train with jitter, shimmer and period doubling
    let t = 0;
    let k = 0;
    while (t < part.dur) {
      const u = t / part.dur;
      const contour = part.snarl ? 0.85 + 0.25 * Math.sin(Math.min(1, u * 1.5) * Math.PI * 0.5) - (u > 0.8 ? (u - 0.8) * 0.6 : 0) : 1 - 0.12 * u;
      const f0 = part.f0 * contour * (0.85 + Math.random() * 0.3);
      const amp = (0.55 + Math.random() * 0.45) * (k % 2 ? 0.45 + Math.random() * 0.35 : 1);
      const start = Math.floor(t * sr);
      const tau = sr * 0.0006;
      for (let i = 0; i < tau * 10 && start + i < n; i++) {
        const e = Math.exp(-i / tau);
        // sharp closing click + breathy noise riding on the pulse
        src[start + i] += amp * (e * (i < 3 ? -1.6 : 0.9) + (Math.random() * 2 - 1) * 0.55 * e);
      }
      t += 1 / f0;
      k++;
    }
    // continuous breath under the voice
    for (let i = 0; i < n; i++) src[i] += (Math.random() * 2 - 1) * (part.snarl ? 0.05 : 0.035);

    // 2) vocal tract: parallel two-pole resonators
    const formants = part.snarl
      ? [ { f: 160, bw: 90, g: 0.3 }, { f: 450, bw: 170, g: 1.0 }, { f: 1150, bw: 260, g: 1.15 }, { f: 2300, bw: 380, g: 0.55 } ]
      : [ { f: 150, bw: 80, g: 0.4 }, { f: 380, bw: 150, g: 1.0 }, { f: 950, bw: 240, g: 0.85 }, { f: 2100, bw: 360, g: 0.3 } ];
    const voiced = new Float32Array(n);
    for (const fm of formants) {
      const r = Math.exp((-Math.PI * fm.bw) / sr);
      const a1 = 2 * r * Math.cos((2 * Math.PI * fm.f) / sr);
      const a2 = -r * r;
      const g = fm.g * (1 - r);
      let y1 = 0;
      let y2 = 0;
      for (let i = 0; i < n; i++) {
        const y = g * src[i] + a1 * y1 + a2 * y2;
        y2 = y1;
        y1 = y;
        voiced[i] += y;
      }
    }

    // 3) flutter + envelope + grit
    let peak = 1e-9;
    let phase = Math.random() * 6;
    for (let i = 0; i < n; i++) {
      const u = i / n;
      phase += (2 * Math.PI * (17 + Math.random() * 8)) / sr;
      const flutter = 0.62 + 0.38 * Math.sin(phase);
      const attack = Math.min(1, u / 0.08);
      const release = Math.min(1, (1 - u) / 0.18);
      const swell = part.snarl ? 0.7 + 0.3 * Math.sin(Math.min(1, u / 0.7) * Math.PI * 0.5) : 1;
      voiced[i] = Math.tanh(voiced[i] * 6 * flutter) * attack * release * swell;
      peak = Math.max(peak, Math.abs(voiced[i]));
    }
    for (let i = 0; i < n && offset + i < out.length; i++) out[offset + i] += (voiced[i] / peak) * part.level;
    offset += n + Math.floor(gap * sr);
  }

  const buf = ctx.createBuffer(1, out.length, sr);
  buf.getChannelData(0).set(out);
  return buf;
}

function playBuffer(ctx: AudioContext, buf: AudioBuffer) {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  // trim rumble below what small speakers can play, keep it clean
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 90;
  src.connect(hp);
  hp.connect(ctx.destination);
  src.start();
}


/**
 * Recorded sound effects (assets/sounds). All from SoundBible.com:
 *   pop     Button Click          Mike Koenig      CC BY 3.0
 *   click   Click On              Mike Koenig      CC BY 3.0
 *   growl   Dog Growling          Mike Koenig      CC BY 3.0
 *   bite    Dog Bite              Mike Koenig      CC BY 3.0
 *   bark    Puppy Barking         Daniel Simon     CC BY 3.0
 *   crunch  Biting Apple          Mike Koenig      CC BY 3.0
 *   squeak  Dog Toy Squeaks       Mike Koenig      CC BY 3.0
 *   win     Winning Triumphal Fanfare  John Stracke  CC BY 3.0
 *   snore   Snoring               Popup Pixels     CC BY 3.0
 *   chime   Daydreaming           Lisa Redfern     Public Domain
 *   fart    Quick Fart            Mike Koenig      CC BY 3.0
 *   phone   Phone Vibrating       Sound Explorer   CC BY 3.0
 *   crinkle Rockslide Small (crumpled paper)  Sound Explorer  CC BY 3.0
 * Each cue plays just the useful slice of its file, loudness-normalised.
 */
interface Cue {
  file: string;
  start: number;
  dur: number;
  vol: number;
  rate?: number;
}
const CUES: Record<string, Cue> = {
  pop: { file: 'pop', start: 0.25, dur: 0.16, vol: 0.45 },
  click: { file: 'click', start: 0, dur: 0.12, vol: 0.35 },
  growl: { file: 'growl', start: 0, dur: 2.5, vol: 0.9 },
  grumble: { file: 'growl', start: 0, dur: 0.75, vol: 0.55, rate: 0.92 },
  bite: { file: 'bite', start: 0, dur: 0.6, vol: 0.9 },
  bark: { file: 'bark', start: 1.0, dur: 0.35, vol: 0.8 },
  crunch: { file: 'crunch', start: 1.05, dur: 0.6, vol: 0.8 },
  squeak: { file: 'squeak', start: 0, dur: 0.38, vol: 0.7 },
  win: { file: 'win', start: 0, dur: 3.6, vol: 0.7 },
  snore: { file: 'snore', start: 2.1, dur: 1.3, vol: 0.8 },
  chime: { file: 'chime', start: 0.6, dur: 2.2, vol: 0.6 },
  fart: { file: 'fart', start: 0.1, dur: 0.4, vol: 0.95, rate: 0.85 },
  phone: { file: 'phone', start: 0, dur: 1.1, vol: 0.75 },
  crinkle: { file: 'crinkle', start: 0.3, dur: 0.9, vol: 0.7 },
};
const FILES = Array.from(new Set(Object.values(CUES).map((c) => c.file)));

class SoundEngine {
  private samples: Record<string, { buf: AudioBuffer; norm: number }> = {};
  private loading = false;

  /** Start fetching and decoding the recordings (call after a user gesture). */
  public preload() {
    const ctx = this.getContext();
    if (!ctx || this.loading) return;
    this.loading = true;
    FILES.forEach(async (f) => {
      try {
        const res = await fetch(`assets/sounds/${f}.mp3`);
        const buf = await ctx.decodeAudioData(await res.arrayBuffer());
        let peak = 1e-6;
        for (let c = 0; c < buf.numberOfChannels; c++) {
          const d = buf.getChannelData(c);
          for (let i = 0; i < d.length; i += 4) peak = Math.max(peak, Math.abs(d[i]));
        }
        this.samples[f] = { buf, norm: Math.min(14, 0.95 / peak) };
      } catch {
        /* keep the synth fallback */
      }
    });
  }

  /** Play a recorded cue; returns false if it isn't loaded (caller falls back to synth). */
  private clip(name: string, delay = 0): boolean {
    const ctx = this.ctx;
    const cue = CUES[name];
    const s = cue && this.samples[cue.file];
    if (!ctx || !cue || !s) return false;
    try {
      const src = ctx.createBufferSource();
      src.buffer = s.buf;
      src.playbackRate.value = cue.rate ?? 1;
      const g = ctx.createGain();
      const t = ctx.currentTime + delay;
      const len = cue.dur / (cue.rate ?? 1);
      const level = cue.vol * s.norm;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(level, t + 0.01);
      g.gain.setValueAtTime(level, t + len * 0.75);
      g.gain.linearRampToValueAtTime(0.0001, t + len);
      src.connect(g);
      g.connect(ctx.destination);
      src.start(t, cue.start, cue.dur);
      return true;
    } catch {
      return false;
    }
  }

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
    this.preload();
    if (this.clip('pop')) return;
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
    this.preload();
    if (this.clip('click')) return;
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
    this.preload();
    if (this.clip('grumble')) return;
    try {
      playBuffer(ctx, renderGrowl(ctx, [{ dur: 0.65, f0: 78, level: 0.45 }]));
    } catch {}
  }

  /** Phone on vibrate: two buzzy pulses. */
  public playPhoneBuzz() {
    const ctx = this.getContext();
    if (!ctx) return;
    this.preload();
    if (this.clip('phone')) return;
    try {
      const now = ctx.currentTime;
      [0, 0.32].forEach((off) => {
        const osc = ctx.createOscillator();
        const am = ctx.createOscillator();
        const amGain = ctx.createGain();
        const gain = ctx.createGain();
        const lp = ctx.createBiquadFilter();
        osc.type = 'square';
        osc.frequency.value = 165;
        am.type = 'square';
        am.frequency.value = 50;
        amGain.gain.value = 0.5;
        lp.type = 'lowpass';
        lp.frequency.value = 900;
        gain.gain.setValueAtTime(0.0001, now + off);
        gain.gain.exponentialRampToValueAtTime(0.22, now + off + 0.02);
        gain.gain.setValueAtTime(0.22, now + off + 0.22);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + off + 0.26);
        am.connect(amGain);
        amGain.connect(gain.gain);
        osc.connect(lp);
        lp.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + off);
        am.start(now + off);
        osc.stop(now + off + 0.28);
        am.stop(now + off + 0.28);
      });
    } catch {}
  }

  /** Crinkly tissue box: a flurry of tiny bright noise crackles. */
  public playCrinkle() {
    const ctx = this.getContext();
    if (!ctx) return;
    this.preload();
    if (this.clip('crinkle')) return;
    try {
      const now = ctx.currentTime;
      const dur = 0.5;
      const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
      const d = buf.getChannelData(0);
      let i = 0;
      while (i < d.length) {
        const len = Math.floor(ctx.sampleRate * (0.002 + Math.random() * 0.01));
        const amp = Math.random() < 0.6 ? Math.random() : 0;
        for (let j = 0; j < len && i < d.length; j++, i++) d[i] = (Math.random() * 2 - 1) * amp * (1 - j / len);
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 2500;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.linearRampToValueAtTime(0.0001, now + dur);
      src.connect(hp);
      hp.connect(gain);
      gain.connect(ctx.destination);
      src.start(now);
    } catch {}
  }

  /** A short, wobbly "pfrrrt": a buzzing low tone plus breathy noise. */
  public playFart() {
    const ctx = this.getContext();
    if (!ctx) return;
    this.preload();
    if (this.clip('fart')) return;
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
    this.preload();
    if (this.clip('growl')) return;
    try {
      playBuffer(
        ctx,
        renderGrowl(ctx, [
          { dur: 0.4, f0: 84, level: 0.55 },
          { dur: 1.05, f0: 96, level: 0.8, snarl: true },
        ])
      );
    } catch {}
  }

  public playDogChomp() {
    const ctx = this.getContext();
    if (!ctx) return;
    this.preload();
    if ((this.clip('bite') && (this.clip('bark', 0.25), true))) return;
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
    this.preload();
    if (this.clip('bark')) return;
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
    this.preload();
    if (this.clip('crunch')) return;
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
    this.preload();
    if (this.clip('squeak')) return;
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
    this.preload();
    if (this.clip('win')) return;
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
    this.preload();
    if (this.clip('snore')) return;
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
    this.preload();
    if (this.clip('chime')) return;
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
