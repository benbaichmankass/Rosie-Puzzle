/** Tiny Web Audio synth for Gas Leak. Everything is generated, no files. */
let ctx: AudioContext | null = null;
let muted = false;
let hiss: { src: AudioBufferSourceNode; gain: GainNode } | null = null;

export function setMuted(m: boolean) {
  muted = m;
  if (m) stopHiss();
}

function ac(): AudioContext | null {
  if (muted) return null;
  try {
    if (!ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function noiseBuffer(a: AudioContext, seconds: number) {
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * seconds), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
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
  o.stop(t + dur + 0.02);
}

export const sfx = {
  place: () => tone(520, 0.08, 'triangle', 0.12),
  turn: () => tone(760, 0.05, 'square', 0.05),
  power: (s: number) => tone(300 + s * 140, 0.09, 'triangle', 0.1),
  remove: () => tone(380, 0.12, 'triangle', 0.1, 0, 180),
  nope: () => tone(150, 0.12, 'square', 0.06),
  win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'triangle', 0.13, i * 0.1)),
  boom: () => {
    const a = ac();
    if (!a) return;
    const t = a.currentTime;
    const src = a.createBufferSource();
    src.buffer = noiseBuffer(a, 1.4);
    const lp = a.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1800, t);
    lp.frequency.exponentialRampToValueAtTime(80, t + 1.2);
    const g = a.createGain();
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.3);
    src.connect(lp).connect(g).connect(a.destination);
    src.start(t);
    tone(90, 0.8, 'sine', 0.5, 0, 35);
  },
};

export function startHiss() {
  const a = ac();
  if (!a || hiss) return;
  const src = a.createBufferSource();
  src.buffer = noiseBuffer(a, 2);
  src.loop = true;
  const hp = a.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 4000;
  const gain = a.createGain();
  gain.gain.value = 0.035;
  src.connect(hp).connect(gain).connect(a.destination);
  src.start();
  hiss = { src, gain };
}

export function stopHiss() {
  if (!hiss) return;
  try {
    hiss.src.stop();
  } catch {}
  hiss = null;
}
