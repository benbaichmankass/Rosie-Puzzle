/**
 * Day/night cycle (pure TS). Time of day follows the distance walked, so every run starts in the
 * afternoon and rolls through sunset, night and dawn back into day.
 */

/** Metres for one full day. */
export const DAY_LENGTH = 1600;
/** Time of day at the start of a run (0 = noon-ish day, 0.38 = sunset, 0.6 = midnight, 0.88 = dawn). */
export const START_TOD = 0.06;

export function timeOfDay(d: number): number {
  const x = START_TOD + d / DAY_LENGTH;
  return x - Math.floor(x);
}

export interface Light {
  skyTop: string;
  skyMid: string;
  skyLow: string;
  haze: string;
  /** Multiply tint for the whole world (white = full daylight). */
  tint: string;
  /** Sun height: 1 high, 0 on the horizon, below 0 set. */
  sun: number;
  sunColor: string;
  /** 0..1 */
  moon: number;
  stars: number;
  /** Street lamps, lit windows and tram lights (0..1). */
  lamps: number;
  /** Quantised step for caches (changes a few dozen times per day). */
  step: number;
}

interface Key { t: number; skyTop: string; skyMid: string; skyLow: string; haze: string; tint: string; sun: number; sunColor: string; moon: number; stars: number; lamps: number }

const KEYS: Key[] = [
  { t: 0.0, skyTop: '#4f86c6', skyMid: '#9cc0dd', skyLow: '#e6e3cf', haze: '#ece0c6', tint: '#ffffff', sun: 1.0, sunColor: '#fffbe8', moon: 0, stars: 0, lamps: 0 },
  { t: 0.24, skyTop: '#5b86b8', skyMid: '#a8bfd2', skyLow: '#f3c99a', haze: '#f2d2ae', tint: '#fff6ea', sun: 0.45, sunColor: '#fff4d6', moon: 0, stars: 0, lamps: 0 },
  { t: 0.34, skyTop: '#4d5f9a', skyMid: '#c98f8a', skyLow: '#ffb46e', haze: '#f6c08e', tint: '#ffd6ab', sun: 0.05, sunColor: '#ffd9a0', moon: 0, stars: 0, lamps: 0.2 },
  { t: 0.42, skyTop: '#33386e', skyMid: '#7b5f8e', skyLow: '#e0866a', haze: '#c7958f', tint: '#b9a2cf', sun: -0.25, sunColor: '#ff9c6a', moon: 0.3, stars: 0.25, lamps: 0.85 },
  { t: 0.5, skyTop: '#1a2150', skyMid: '#2f3c78', skyLow: '#55609a', haze: '#5c6596', tint: '#5d6898', sun: -1, sunColor: '#ff9c6a', moon: 1, stars: 1, lamps: 1 },
  { t: 0.76, skyTop: '#1a2150', skyMid: '#2f3c78', skyLow: '#55609a', haze: '#5c6596', tint: '#5d6898', sun: -1, sunColor: '#ff9c6a', moon: 1, stars: 1, lamps: 1 },
  { t: 0.84, skyTop: '#3e4f8e', skyMid: '#a28ab0', skyLow: '#f2b3a2', haze: '#dcb4b4', tint: '#d8bccd', sun: -0.05, sunColor: '#ffd0b0', moon: 0.2, stars: 0.15, lamps: 0.6 },
  { t: 0.92, skyTop: '#4f80c0', skyMid: '#a9c4dc', skyLow: '#f6dcc0', haze: '#efdcc4', tint: '#fff2e8', sun: 0.4, sunColor: '#fff4e0', moon: 0, stars: 0, lamps: 0 },
  { t: 1.0, skyTop: '#4f86c6', skyMid: '#9cc0dd', skyLow: '#e6e3cf', haze: '#ece0c6', tint: '#ffffff', sun: 1.0, sunColor: '#fffbe8', moon: 0, stars: 0, lamps: 0 },
];

function hex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mixHex(a: string, b: string, k: number): string {
  const A = hex(a), B = hex(b);
  const h = (v: number) => Math.round(v).toString(16).padStart(2, '0');
  return `#${h(A[0] + (B[0] - A[0]) * k)}${h(A[1] + (B[1] - A[1]) * k)}${h(A[2] + (B[2] - A[2]) * k)}`;
}
const smooth = (k: number) => k * k * (3 - 2 * k);

export const STEPS = 48;

/** Lighting for a time of day. Quantised to STEPS so colour caches stay valid between steps. */
export function lightAt(tod: number): Light {
  const step = Math.floor(tod * STEPS) % STEPS;
  const q = step / STEPS;
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].t <= q) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const k = smooth((q - a.t) / (b.t - a.t));
  const n = (x: number, y: number) => x + (y - x) * k;
  return {
    skyTop: mixHex(a.skyTop, b.skyTop, k),
    skyMid: mixHex(a.skyMid, b.skyMid, k),
    skyLow: mixHex(a.skyLow, b.skyLow, k),
    haze: mixHex(a.haze, b.haze, k),
    tint: mixHex(a.tint, b.tint, k),
    sun: n(a.sun, b.sun),
    sunColor: mixHex(a.sunColor, b.sunColor, k),
    moon: n(a.moon, b.moon),
    stars: n(a.stars, b.stars),
    lamps: n(a.lamps, b.lamps),
    step,
  };
}

/** Name of the part of the day (for tests / UI). */
export function phaseName(tod: number): 'day' | 'sunset' | 'night' | 'dawn' {
  if (tod < 0.3 || tod >= 0.9) return 'day';
  if (tod < 0.46) return 'sunset';
  if (tod < 0.8) return 'night';
  return 'dawn';
}
