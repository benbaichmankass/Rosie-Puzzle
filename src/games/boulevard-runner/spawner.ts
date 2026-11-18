/**
 * Jerusalem Boulevard Runner: deterministic world rules and obstacle spawner.
 * Pure TypeScript (no DOM), so scripts/check-boulevard-runner.ts can test it headlessly.
 *
 * Everything is measured in "player distance" d (world units, shown as metres): the distance
 * Rosie has walked. An obstacle is described by the distance D at which its near end reaches Rosie
 * and the interval [start, end] of player distance during which it occupies her spot in its lane.
 * Moving things (walkers, bikes, oncoming trams) pass faster, so their interval is shorter than
 * their length; a slower tram going the same way passes slowly, so its interval is longer.
 *
 * Trams have walkable roofs (Subway Surfers style): Rosie gets onto a roof by being in the air when
 * the tram reaches her, or by running up the ramp some same-direction trams have at the rear. On a
 * roof she runs along it, drops off its end, can hop down to the bike path, or leap across the bike
 * path onto a tram on the other track. Running into a tram on the ground is a crash.
 *
 * The spawner only accepts an obstacle when a reachability search over the whole stream so far
 * (with generous "comfort" timings, slower than the real controls) still finds a way through.
 * So by construction it never builds an unavoidable wall.
 */

export const LANES = 3;
export type Lane = 0 | 1 | 2;
/** 0 = left track (oncoming trams), 1 = bike path (walkers, bikes, low stuff), 2 = right track (trams going our way). */

export type Kind = 'walker' | 'bike' | 'low' | 'tramIn' | 'tramOut';

export interface Obstacle {
  id: number;
  kind: Kind;
  lane: Lane;
  /** Player distance at which the obstacle's near end reaches Rosie. */
  D: number;
  /** Physical length along the boulevard (world units), including a tram's ramp. */
  len: number;
  /** Own speed toward Rosie (units/s). Negative = moving the same way, slower than Rosie. */
  v: number;
  /** Rosie's speed when it reaches her (fixed per obstacle so drawing and collisions agree). */
  sD: number;
  /** Tall obstacles must be dodged by changing lane (or, for trams, by getting on the roof); low ones can be jumped. */
  tall: boolean;
  /** Trams: a walkable roof. */
  tram: boolean;
  /** Same-direction trams only: a ramp at the rear that Rosie can run up. */
  ramp: boolean;
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

export interface Timings {
  laneChangeTime: number;
  jumpTime: number;
  /** Fraction of the jump during which Rosie is high enough to clear a low obstacle. */
  airFrom: number;
  airTo: number;
  /** Fraction of the jump during which reaching a tram puts Rosie on its roof. */
  mountFrom: number;
  mountTo: number;
  /** Seconds to drop from a roof to the ground. */
  fallTime: number;
}

/** Real controls (used by the game and by the strict check). */
export const CONTROLS: Timings = {
  laneChangeTime: 0.16,
  jumpTime: 0.62,
  airFrom: 0.085,
  airTo: 0.915,
  // The game mounts when Rosie is >= MOUNT_Y high: fractions 0.13..0.87; the check uses a margin.
  mountFrom: 0.16,
  mountTo: 0.84,
  fallTime: 0.52,
};

/** Comfort timings the spawner plans with: slower and stricter than the real controls. */
export const COMFORT: Timings = {
  laneChangeTime: 0.34,
  jumpTime: 0.62,
  airFrom: 0.2,
  airTo: 0.8,
  mountFrom: 0.28,
  mountTo: 0.72,
  fallTime: 0.65,
};

export const JUMP_H = 1.15;
/** Rosie counts as "in the air" for getting onto a roof above this height. */
export const MOUNT_Y = 0.5;
export const ROOF_H = 2.9;
export const TRAM_LEN = 30;
export const RAMP_LEN = 6;
/** Oncoming tram speed. */
export const TRAM_IN_SPEED = 9;
/** A same-direction tram moves at this fraction of Rosie's speed (so she catches up with it). */
export const TRAM_OUT_FRAC = 0.42;
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
export function makeObstacle(id: number, kind: Kind, D: number, variant: number, ramp = false): Obstacle {
  const sD = speedAt(D);
  let lane: Lane = 1;
  let len = 0.6;
  let v = 0;
  let tall = true;
  let tram = false;
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
      tram = true;
      ramp = false;
      break;
    case 'tramOut':
      lane = 2;
      len = TRAM_LEN + (ramp ? RAMP_LEN : 0);
      v = -TRAM_OUT_FRAC * sD;
      tram = true;
      break;
  }
  if (kind !== 'tramOut') ramp = false;
  // Closing speed relative to Rosie, and the player distance it takes the obstacle to pass her.
  const closing = sD + v;
  const pass = (len * sD) / closing;
  return {
    id, kind, lane, D, len, v, sD, tall, tram, ramp,
    start: D,
    end: D + pass,
    warnFrom: tram ? D - TRAM_WARN_TIME * sD : D,
    variant,
  };
}

/** How far along the obstacle (world units from its near end) Rosie is at distance d. */
export function alongObstacle(o: Obstacle, d: number): number {
  return ((d - o.start) * (o.sD + o.v)) / o.sD;
}

/**
 * Gap (world units ahead of Rosie, negative = behind) of the obstacle's near and far ends when
 * Rosie is at distance d. Used for drawing; consistent with the occupancy interval.
 */
export function obstacleGap(o: Obstacle, d: number): { near: number; far: number } {
  const near = ((o.D - d) * (o.sD + o.v)) / o.sD;
  return { near, far: near + o.len };
}

// ---------- reachability grid ----------
export const CELL = 0.5;

/**
 * Grid of obstacle counts per lane plus forward reachability of "Rosie on the ground / on a roof
 * in lane L at cell i". Incremental: adding an obstacle only recomputes from just before it.
 */
class Reach {
  tall: Uint16Array[] = [];
  low: Uint16Array[] = [];
  tram: Uint16Array[] = [];
  rampStart: Uint16Array[] = [];
  ground: Uint8Array = new Uint8Array(0);
  roof: Uint8Array = new Uint8Array(0);
  size = 0;
  /** Reachability is valid up to this cell. */
  private done = 0;
  constructor(private t: Timings) {
    this.grow(4096);
    this.ground[0] = 0b111;
  }
  private grow(n: number) {
    if (n <= this.size) return;
    let s = Math.max(this.size * 2, 4096);
    while (s < n) s *= 2;
    const cp16 = (a: Uint16Array | undefined) => { const b = new Uint16Array(s); if (a) b.set(a); return b; };
    const cp8 = (a: Uint8Array) => { const b = new Uint8Array(s); b.set(a); return b; };
    for (let l = 0; l < LANES; l++) {
      this.tall[l] = cp16(this.tall[l]); this.low[l] = cp16(this.low[l]);
      this.tram[l] = cp16(this.tram[l]); this.rampStart[l] = cp16(this.rampStart[l]);
    }
    this.ground = cp8(this.ground);
    this.roof = cp8(this.roof);
    this.size = s;
  }
  mark(o: Obstacle, delta: 1 | -1) {
    const a = Math.floor(o.start / CELL), b = Math.floor(o.end / CELL);
    this.grow(b + 400);
    const arr = (o.tram ? this.tram : o.tall ? this.tall : this.low)[o.lane];
    for (let i = a; i <= b; i++) arr[i] += delta;
    if (o.ramp) this.rampStart[o.lane][a] += delta;
  }
  private any(l: number, i: number) { return this.tall[l][i] > 0 || this.low[l][i] > 0 || this.tram[l][i] > 0; }
  /** Recompute reachability from cell `from` up to cell `to`; returns true if anything is reachable at `to`. */
  recompute(from: number, to: number): boolean {
    this.grow(to + 400);
    const kmax = 120;
    from = Math.min(from, this.done);
    const s0 = Math.max(0, from - kmax);
    this.ground.fill(0, Math.max(1, from), to + kmax + 2);
    this.roof.fill(0, from, to + kmax + 2);
    this.done = to;
    const t = this.t;
    const { tall, low, tram } = this;
    for (let i = s0; i < to; i++) {
      const gm = this.ground[i], rm = this.roof[i];
      if (!gm && !rm) continue;
      const s = speedAt(i * CELL);
      const kc = Math.max(1, Math.ceil((t.laneChangeTime * s) / CELL));
      const kj = Math.max(1, Math.ceil((t.jumpTime * s) / CELL));
      const kf = Math.max(1, Math.ceil((t.fallTime * s) / CELL));
      const ja = Math.floor(t.airFrom * kj), jb = Math.ceil(t.airTo * kj);
      const ma = Math.ceil(t.mountFrom * kj), mb = Math.floor(t.mountTo * kj);
      for (let l = 0; l < LANES; l++) {
        const bit = 1 << l;
        if (gm & bit) {
          // walk on: free cell, or up a ramp that starts here
          if (tram[l][i] > 0) {
            if (this.rampStart[l][i] > 0 && tall[l][i] === 0 && low[l][i] === 0 && tram[l][i + 1] > 0) this.roof[i + 1] |= bit;
          } else if (tall[l][i] === 0 && low[l][i] === 0) this.ground[i + 1] |= bit;
          // jump: clear low stuff, or land on a tram roof
          let ok = true, mountAt = -1;
          for (let k = 0; k < kj && ok && mountAt < 0; k++) {
            const c = i + k;
            if (tram[l][c] > 0) { if (k >= ma && k <= mb) mountAt = c; else ok = false; }
            else if (tall[l][c] > 0) ok = false;
            else if (low[l][c] > 0 && (k <= ja || k >= jb)) ok = false;
          }
          if (ok) { if (mountAt >= 0) this.roof[mountAt] |= bit; else this.ground[i + kj] |= bit; }
          // change lane on the ground
          for (const n of [l - 1, l + 1]) {
            if (n < 0 || n >= LANES) continue;
            let ok2 = true;
            for (let k = 0; k < kc && ok2; k++) if (this.any(l, i + k) || this.any(n, i + k)) ok2 = false;
            if (ok2) this.ground[i + kc] |= 1 << n;
          }
        }
        if ((rm & bit) && tram[l][i] > 0) {
          // keep running along the roof, or drop off its end
          if (tram[l][i + 1] > 0) this.roof[i + 1] |= bit;
          else {
            let ok = true;
            for (let k = 1; k <= kf && ok; k++) if (this.any(l, i + k)) ok = false;
            if (ok) this.ground[i + 1 + kf] |= bit;
          }
          // hop down to a neighbouring lane
          for (const n of [l - 1, l + 1]) {
            if (n < 0 || n >= LANES) continue;
            let ok2 = true;
            for (let k = 0; k < kc + kf && ok2; k++) if (this.any(n, i + k)) ok2 = false;
            if (ok2) this.ground[i + kc + kf] |= 1 << n;
          }
          // leap across the bike path onto a tram on the other track
          const far = 2 - l;
          if (far !== l) {
            let ok3 = true;
            for (let k = 0; k <= 2 * kc && ok3; k++) if (tram[far][i + k] === 0) ok3 = false;
            if (ok3) this.roof[i + 2 * kc] |= 1 << far;
          }
        }
      }
    }
    return this.ground[to] !== 0 || this.roof[to] !== 0;
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
      ['bike', 0.8 + 2.4 * Math.min(1, diff * 2.5)],
      ['low', 1.6 + 0.8 * diff],
      ['tramIn', 1.4 + 2.0 * diff],
      ['tramOut', 1.0 + 1.2 * diff],
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
      const o = makeObstacle(this.nextId, kind, D, Math.floor(r() * 1000), r() < 0.6);
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
    while (n < this.obstacles.length && this.obstacles[n].end < d - 30) n++;
    if (n > 50) this.obstacles.splice(0, n);
  }
}
