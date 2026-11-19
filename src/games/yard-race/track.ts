/**
 * The race track: one lap of the L-shaped yard, seen from above. Pure geometry, no DOM.
 *
 * World units: the yard is 400 wide and 580 tall. The yard is an L: a tall column on the left (x 0..200)
 * and an arm along the bottom (y 420..580) under the house. The lap starts by the turtle pool (bottom-left),
 * runs up the left side past the bunny wall to the street door, back down beside the house, out along the
 * arm to the far end, and home along the bottom wall.
 */

export const WORLD = { w: 400, h: 580 } as const;
/** Inner edge of the outer walls. */
export const WALL = 10;
/** The house occupies the top-right block: x 200..400, y 0..420. */
export const HOUSE = { x: 200, y: 0, w: 200, h: 420 } as const;
export const POOL = { x: 14, y: 494, w: 64, h: 70 } as const;
export const TRACK_W = 40;

type P = [number, number];

/** Control points of the lap's centre line (closed Catmull-Rom spline), starting at the start line. */
const CTRL: P[] = [
  [48, 440],
  [46, 360],
  [52, 280],
  [42, 200],
  [46, 120],
  [58, 62],
  [100, 36],
  [144, 52],
  [160, 104],
  [152, 170],
  [164, 250],
  [158, 330],
  [168, 398],
  [206, 452],
  [262, 448],
  [318, 458],
  [366, 476],
  [372, 516],
  [338, 542],
  [270, 540],
  [200, 544],
  [140, 538],
  [108, 508],
  [84, 474],
];

export interface Sample {
  x: number;
  y: number;
  /** Unit tangent (direction of travel). */
  tx: number;
  ty: number;
  s: number;
}

function catmull(p0: P, p1: P, p2: P, p3: P, t: number): P {
  const t2 = t * t;
  const t3 = t2 * t;
  const f = (a: number, b: number, c: number, d: number) =>
    0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])];
}

function build(): { samples: Sample[]; length: number } {
  const pts: P[] = [];
  const n = CTRL.length;
  const SUB = 40;
  for (let i = 0; i < n; i++) {
    const p0 = CTRL[(i - 1 + n) % n];
    const p1 = CTRL[i];
    const p2 = CTRL[(i + 1) % n];
    const p3 = CTRL[(i + 2) % n];
    for (let k = 0; k < SUB; k++) pts.push(catmull(p0, p1, p2, p3, k / SUB));
  }
  pts.push(pts[0]);
  // Resample at a fixed spacing of 1 world unit.
  const raw: { x: number; y: number; s: number }[] = [];
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    if (i > 0) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    raw.push({ x: pts[i][0], y: pts[i][1], s });
  }
  const length = s;
  const samples: Sample[] = [];
  let j = 0;
  const N = Math.ceil(length);
  for (let k = 0; k <= N; k++) {
    const target = Math.min(length, (k / N) * length);
    while (j < raw.length - 2 && raw[j + 1].s < target) j++;
    const a = raw[j];
    const b = raw[j + 1];
    const u = b.s > a.s ? (target - a.s) / (b.s - a.s) : 0;
    samples.push({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, tx: 0, ty: 0, s: target });
  }
  for (let k = 0; k < samples.length; k++) {
    const a = samples[Math.max(0, k - 2)];
    const b = samples[Math.min(samples.length - 1, k + 2)];
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    if (k < 2 || k > samples.length - 3) {
      // wrap around the closed loop
      const pa = samples[(k - 2 + samples.length - 1) % (samples.length - 1)];
      const pb = samples[(k + 2) % (samples.length - 1)];
      dx = pb.x - pa.x;
      dy = pb.y - pa.y;
    }
    const d = Math.hypot(dx, dy) || 1;
    samples[k].tx = dx / d;
    samples[k].ty = dy / d;
  }
  return { samples, length };
}

const T = build();
export const SAMPLES = T.samples;
/** Length of one lap in world units. */
export const LAP = T.length;

/** Point on the centre line at distance s (wraps), shifted sideways by `off` (positive = to the runner's right). */
export function pointAt(s: number, off = 0): { x: number; y: number; angle: number; tx: number; ty: number } {
  const n = SAMPLES.length - 1;
  let u = ((s % LAP) + LAP) % LAP;
  u = (u / LAP) * n;
  const i = Math.min(n - 1, Math.floor(u));
  const f = u - i;
  const a = SAMPLES[i];
  const b = SAMPLES[i + 1];
  let tx = a.tx + (b.tx - a.tx) * f;
  let ty = a.ty + (b.ty - a.ty) * f;
  const d = Math.hypot(tx, ty) || 1;
  tx /= d;
  ty /= d;
  // right-hand normal in screen coords (y down): (-ty, tx)
  const x = a.x + (b.x - a.x) * f - ty * off;
  const y = a.y + (b.y - a.y) * f + tx * off;
  return { x, y, angle: Math.atan2(ty, tx), tx, ty };
}

export type FoodKind = 'lettuce' | 'carrot' | 'dandelion';

export interface FoodSpot {
  kind: FoodKind;
  /** Start of the eating zone along the lap. */
  s0: number;
  /** End of the eating zone. */
  s1: number;
  /** Which side of the track the plant grows on (+1 right of the runner, -1 left). */
  side: 1 | -1;
}

/** Length of a food spot's eating zone. The bunny must come to a stop inside it. */
export const FOOD_ZONE = 46;

const FOOD_AT: { f: number; kind: FoodKind; side: 1 | -1 }[] = [
  { f: 0.19, kind: 'lettuce', side: 1 },
  { f: 0.37, kind: 'dandelion', side: 1 },
  { f: 0.55, kind: 'carrot', side: 1 },
  { f: 0.72, kind: 'lettuce', side: 1 },
  { f: 0.87, kind: 'dandelion', side: 1 },
];

export const FOOD: FoodSpot[] = FOOD_AT.map((o) => ({
  kind: o.kind,
  s0: o.f * LAP - FOOD_ZONE / 2,
  s1: o.f * LAP + FOOD_ZONE / 2,
  side: o.side,
}));

/** The food spot whose zone contains s, or -1. */
export function foodAt(s: number): number {
  for (let i = 0; i < FOOD.length; i++) if (s >= FOOD[i].s0 && s <= FOOD[i].s1) return i;
  return -1;
}

/** Index of the next food spot whose zone has not been passed yet (s < s1), or -1 if none is left. */
export function nextFood(s: number): number {
  for (let i = 0; i < FOOD.length; i++) if (s <= FOOD[i].s1) return i;
  return -1;
}
