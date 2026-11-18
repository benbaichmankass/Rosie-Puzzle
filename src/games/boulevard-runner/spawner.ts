/**
 * Jerusalem Boulevard Runner: deterministic world rules and obstacle spawner.
 * Pure TypeScript (no DOM), so scripts/check-boulevard-runner.ts can test it headlessly.
 *
 * Everything is measured in "player distance" d (world units, shown as metres): the distance
 * Rosie has walked. An obstacle is described by the distance D at which it reaches Rosie and the
 * interval [start, end] of player distance during which it occupies her spot in its lane.
 * Moving things (walkers, bikes, trams) pass faster, so their interval is shorter than their length;
 * a tram overtaking from behind passes slowly, so its interval is longer.
 *
 * The spawner only accepts an obstacle when a reachability search over the whole stream so far
 * (with generous "comfort" timings, slower than the real controls) still finds a way through.
 * So by construction it never builds an unavoidable wall.
 */

export const LANES = 3;
export type Lane = 0 | 1 | 2;
/** 0 = left tram track (oncoming trams), 1 = promenade (walkers, bikes, low stuff), 2 = right track (trams from behind). */

export type Kind = 'walker' | 'bike' | 'low' | 'tramIn' | 'tramOut';

export interface Obstacle {
  id: number;
  kind: Kind;
  lane: Lane;
  /** Player distance at which the obstacle's near edge reaches Rosie. */
  D: number;
  /** Physical length along the boulevard (world units). */
  len: number;
  /** Own speed toward Rosie (units/s). Negative = moving the same way, faster (tram from behind). */
  v: number;
  /** Rosie's speed when it reaches her (fixed per obstacle so drawing and collisions agree). */
  sD: number;
  /** Tall obstacles must be dodged by changing lane; low ones can be jumped. */
  tall: boolean;
  /** Occupancy of Rosie's spot, in player distance. */
  start: number;
  end: number;
  /** Player distance at which the warning for a tram starts. */
  warnFrom: number;
  /** Look variant (sprite choice). */
  variant: number;
}

// ---------- tuning shared by the game and the check ----------
export const SPEED0 = 8.5;
export const SPEED_MAX = 19;
export const RAMP = 1400;
/** Rosie's speed (units/s) after walking d units. Smooth ramp toward SPEED_MAX. */
export function speedAt(d: number): number {
  return SPEED0 + (SPEED_MAX - SPEED0) * (1 - Math.exp(-Math.max(0, d) / RAMP));
}
/** 0 at the start, approaching 1 at top speed. */
export function difficultyAt(d: number): number {
  return (speedAt(d) - SPEED0) / (SPEED_MAX - SPEED0);
}

/** Real controls (used by the game and by the strict check). */
export const CONTROLS = {
  laneChangeTime: 0.16,
  jumpTime: 0.62,
  /** Fraction of the jump during which Rosie is high enough to clear a low obstacle. */
  airFrom: 0.085,
  airTo: 0.915,
};

/** Comfort timings the spawner plans with: slower and stricter than the real controls. */
export const COMFORT = {
  laneChangeTime: 0.34,
  jumpTime: 0.62,
  airFrom: 0.2,
  airTo: 0.8,
};

export const TRAM_LEN = 30;
/** Oncoming tram speed. */
export const TRAM_IN_SPEED = 9;
/** How much faster than Rosie a tram from behind travels. */
export const TRAM_OUT_REL = 7.5;
/** Seconds of warning before a tram reaches Rosie. */
export const TRAM_WARN_TIME = 2.4;

// ---------- seeded random ----------
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Build an obstacle with its occupancy interval. */
export function makeObstacle(id: number, kind: Kind, D: number, variant: number): Obstacle {
  const sD = speedAt(D);
  let lane: Lane = 1;
  let len = 0.6;
  let v = 0;
  let tall = true;
  switch (kind) {
    case 'walker':
      len = 0.6;
      v = 1.3;
      break;
    case 'bike':
      len = 1.8;
      v = 4.5;
      break;
    case 'low':
      len = 0.9;
      v = 0;
      tall = false;
      break;
    case 'tramIn':
      lane = 0;
      len = TRAM_LEN;
      v = TRAM_IN_SPEED;
      break;
    case 'tramOut':
      lane = 2;
      len = TRAM_LEN;
      v = -(sD + TRAM_OUT_REL);
      break;
  }
  // Closing speed relative to Rosie, and the player distance it takes the obstacle to pass her.
  const closing = kind === 'tramOut' ? TRAM_OUT_REL : sD + v;
  const pass = (len * sD) / closing;
  return {
    id, kind, lane, D, len, v, sD, tall,
    start: D,
    end: D + pass,
    warnFrom: kind === 'tramIn' || kind === 'tramOut' ? D - TRAM_WARN_TIME * sD : D,
    variant,
  };
}

/**
 * Gap (world units ahead of Rosie, negative = behind) of the obstacle's near and far ends when
 * Rosie is at distance d. Used for drawing; consistent with the occupancy interval.
 */
export function obstacleGap(o: Obstacle, d: number): { near: number; far: number } {
  if (o.kind === 'tramOut') {
    // Front reaches Rosie at D and then pulls ahead; the rear trails len behind the front.
    const front = ((d - o.D) * TRAM_OUT_REL) / o.sD;
    return { near: front - o.len, far: front };
  }
  const near = ((o.D - d) * (o.sD + o.v)) / o.sD;
  return { near, far: near + o.len };
}

// ---------- reachability grid ----------
const CELL = 0.5;

interface Timings { laneChangeTime: number; jumpTime: number; airFrom: number; airTo: number }

/**
 * Grid of obstacle counts per lane plus forward reachability of "Rosie standing in lane L at cell i".
 * Incremental: adding an obstacle only recomputes reachability from just before it.
 */
class Reach {
  tall: Uint16Array[] = [];
  low: Uint16Array[] = [];
  reach: Uint8Array = new Uint8Array(0);
  size = 0;
  /** Reachability is valid up to this cell. */
  private done = 0;
  constructor(private t: Timings) {
    this.grow(4096);
    this.reach[0] = 0b111;
  }
  private grow(n: number) {
    if (n <= this.size) return;
    let s = Math.max(this.size * 2, 4096);
    while (s < n) s *= 2;
    const cp = (a: Uint16Array | undefined) => { const b = new Uint16Array(s); if (a) b.set(a); return b; };
    for (let l = 0; l < LANES; l++) { this.tall[l] = cp(this.tall[l]); this.low[l] = cp(this.low[l]); }
    const r = new Uint8Array(s); r.set(this.reach); this.reach = r;
    this.size = s;
  }
  private cells(o: Obstacle): [number, number] {
    return [Math.floor(o.start / CELL), Math.floor(o.end / CELL)];
  }
  mark(o: Obstacle, delta: 1 | -1) {
    const [a, b] = this.cells(o);
    this.grow(b + 200);
    const arr = (o.tall ? this.tall : this.low)[o.lane];
    for (let i = a; i <= b; i++) arr[i] += delta;
  }
  private blocked(l: number, i: number) { return this.tall[l][i] > 0 || this.low[l][i] > 0; }
  /** Recompute reachability from cell `from` up to cell `to`; returns true if any lane is reachable at `to`. */
  recompute(from: number, to: number): boolean {
    this.grow(to + 200);
    const kmax = 40;
    from = Math.min(from, this.done);
    const s0 = Math.max(0, from - kmax);
    this.reach.fill(0, Math.max(1, from), to + kmax + 2);
    this.done = to;
    const t = this.t;
    for (let i = s0; i < to; i++) {
      const m = this.reach[i];
      if (!m) continue;
      const s = speedAt(i * CELL);
      const kc = Math.max(1, Math.ceil((t.laneChangeTime * s) / CELL));
      const kj = Math.max(1, Math.ceil((t.jumpTime * s) / CELL));
      const ja = Math.floor(t.airFrom * kj);
      const jb = Math.ceil(t.airTo * kj);
      for (let l = 0; l < LANES; l++) {
        if (!(m & (1 << l))) continue;
        // stay
        if (!this.blocked(l, i)) this.reach[i + 1] |= 1 << l;
        // jump in place
        let ok = true;
        for (let k = 0; k < kj && ok; k++) {
          if (this.tall[l][i + k] > 0) ok = false;
          else if (this.low[l][i + k] > 0 && (k <= ja || k >= jb)) ok = false;
        }
        if (ok) this.reach[i + kj] |= 1 << l;
        // change lane
        for (const n of [l - 1, l + 1]) {
          if (n < 0 || n >= LANES) continue;
          let ok2 = true;
          for (let k = 0; k < kc && ok2; k++) if (this.blocked(l, i + k) || this.blocked(n, i + k)) ok2 = false;
          if (ok2) this.reach[i + kc] |= 1 << n;
        }
      }
    }
    return this.reach[to] !== 0;
  }
  try(o: Obstacle, horizonEnd: number): boolean {
    this.mark(o, 1);
    const from = Math.floor(o.start / CELL);
    const to = Math.ceil(horizonEnd / CELL) + 20;
    if (this.recompute(from, to)) return true;
    this.mark(o, -1);
    this.recompute(from, to);
    return false;
  }
}

/** Streams obstacles ahead of the player. Same seed = same boulevard. */
export class Spawner {
  readonly obstacles: Obstacle[] = [];
  private rand: () => number;
  private cursor: number;
  private nextId = 1;
  private reach = new Reach(COMFORT);
  private maxEnd = 0;
  private laneFree: number[] = [0, 0, 0];

  constructor(seed: number, startClear = 45) {
    this.rand = mulberry32(seed);
    this.cursor = startClear;
  }

  /** Generate obstacles until the cursor is past `until`. */
  ensure(until: number) {
    while (this.cursor < until) this.step();
  }

  private pick(diff: number): Kind {
    const w: [Kind, number][] = [
      ['walker', 3.2],
      ['bike', 0.6 + 2.2 * Math.min(1, diff * 2.5)],
      ['low', 1.6 + 0.8 * diff],
      ['tramIn', 1.5 + 2.2 * diff],
      ['tramOut', 1.2 + 2.0 * diff],
    ];
    let total = 0;
    for (const [, x] of w) total += x;
    let r = this.rand() * total;
    for (const [k, x] of w) { r -= x; if (r <= 0) return k; }
    return 'walker';
  }

  private step() {
    const r = this.rand;
    const s = speedAt(this.cursor);
    const diff = difficultyAt(this.cursor);
    // Time between events shrinks as the run goes on.
    const gapT = (1.25 - 0.62 * diff) * (0.75 + r() * 0.6);
    let D = this.cursor + gapT * s;
    for (let attempt = 0; attempt < 12; attempt++) {
      const kind = this.pick(diff);
      const o = makeObstacle(this.nextId, kind, D, Math.floor(r() * 1000));
      // Trams in the same lane keep a healthy spacing; nothing overlaps in its lane.
      const spacing = o.lane === 1 ? 1.5 : 14;
      if (o.start < this.laneFree[o.lane] + spacing) { if (attempt % 3 === 2) D += 4; continue; }
      if (this.reach.try(o, Math.max(this.maxEnd, o.end) + 25)) {
        this.obstacles.push(o);
        this.nextId++;
        this.laneFree[o.lane] = Math.max(this.laneFree[o.lane], o.end);
        this.maxEnd = Math.max(this.maxEnd, o.end);
        this.cursor = D;
        return;
      }
      if (attempt % 3 === 2) D += 4;
    }
    // Nothing fit here: leave a breather.
    this.cursor = D + 6;
  }

  /** Drop obstacles Rosie has fully passed (keeps arrays small in long runs). */
  prune(d: number) {
    let n = 0;
    // A tram that overtook Rosie stays visible ahead for a while, so keep ~200 units of history.
    while (n < this.obstacles.length && this.obstacles[n].end < d - 200) n++;
    if (n > 50) this.obstacles.splice(0, n);
  }
}
