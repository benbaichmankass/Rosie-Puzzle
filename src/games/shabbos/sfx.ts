/** Tiny Web Audio synth for the game's sound effects. Respects a mute flag. */

let ctx: AudioContext | null = null;
let muted = false;
let boilNode: { src: AudioBufferSourceNode; gain: GainNode } | null = null;

export function setMuted(m: boolean) {
  muted = m;
  if (m) stopBoil();
}

function ac(): AudioContext | null {
  if (muted) return null;
  try {
    if (!ctx) {
      const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new C();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.15, when = 0, slideTo?: number) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + when;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(dur: number, vol = 0.2, when = 0, freq = 800) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + when;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = freq;
  const g = a.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

export const sfx = {
  tap: () => tone(520, 0.06, 'triangle', 0.08),
  plug: () => {
    noise(0.05, 0.25, 0, 2500);
    tone(180, 0.08, 'square', 0.06);
  },
  click: () => {
    noise(0.03, 0.2, 0, 4000);
    tone(900, 0.04, 'square', 0.05);
  },
  braid: () => tone(330, 0.12, 'sine', 0.14, 0, 440),
  wrong: () => {
    tone(220, 0.14, 'sawtooth', 0.07);
    tone(170, 0.18, 'sawtooth', 0.07, 0.1);
  },
  done: () => {
    tone(660, 0.12, 'triangle', 0.12);
    tone(880, 0.12, 'triangle', 0.12, 0.1);
    tone(1320, 0.2, 'triangle', 0.1, 0.2);
  },
  thud: () => {
    tone(110, 0.12, 'sine', 0.2, 0, 70);
    noise(0.06, 0.12, 0, 600);
  },
  crash: () => {
    noise(0.45, 0.35, 0, 3000);
    tone(300, 0.3, 'square', 0.05, 0, 90);
  },
  ring: () => {
    for (let i = 0; i < 6; i++) {
      tone(1046, 0.05, 'square', 0.05, i * 0.1);
      tone(1318, 0.05, 'square', 0.05, i * 0.1 + 0.05);
    }
  },
  blip: () => tone(760, 0.07, 'sine', 0.08),
  tick: (loud = false) => {
    tone(loud ? 1700 : 1250, 0.035, 'square', loud ? 0.09 : 0.035);
    noise(0.02, loud ? 0.12 : 0.05, 0, 5000);
  },
  fanfare: () => {
    [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 'triangle', 0.12, i * 0.12));
  },
  lose: () => {
    [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, 'triangle', 0.12, i * 0.18));
  },
};

/** Gentle looping bubble noise while the urn boils. */
export function startBoil() {
  const a = ac();
  if (!a || boilNode) return;
  const len = a.sampleRate * 2;
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const pop = Math.random() < 0.0009 ? 1 : 0;
    d[i] = (Math.random() * 2 - 1) * 0.25 + pop * (Math.random() * 2 - 1);
  }
  const src = a.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const f = a.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 500;
  const gain = a.createGain();
  gain.gain.value = 0.12;
  src.connect(f).connect(gain).connect(a.destination);
  src.start();
  boilNode = { src, gain };
}

export function stopBoil() {
  if (!boilNode) return;
  try {
    boilNode.src.stop();
  } catch {}
  boilNode = null;
}
