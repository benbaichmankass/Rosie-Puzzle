/**
 * Squeegee Survival: pure simulation (no React / DOM).
 *
 * The bathroom floor is a 1-D height field seen in cross-section. Cell 0 is the shower end (left,
 * high, with the drain in the corner); the last cell is the sink end (right, low) where the vanity
 * with its three shelves stands. Water is a shallow-water "virtual pipe" model: each cell edge
 * carries a flux that accelerates with the surface-height difference, is damped, and is limited
 * so no cell can go negative. Mass is conserved apart from shower inflow and drain outflow.
 */

export const N = 64; // floor cells (about 3.3 cm each)
export const DRAIN_CELLS = [1, 2, 3];
export const SPRAY_FROM = 4;
export const CART_FROM = 50; // the trolley stands on cells CART_FROM.. (player can't walk there)
export const SLOPE_DROP = 13; // the floor falls this many cm from the shower end to the sink end
/** Water-surface height (cm above the lowest floor) at which each trolley tray floods: bottom, middle, top. */
export const SHELF_LEVELS = [12, 40, 68] as const;
export const BLADE_OFF = 9; // the squeegee blade rests this many cells in front of Bentzi's feet

/** Tunable numbers (the check script and tuning runs may tweak them). */
export const T = {
  G: 30,
  DAMP: 6, // bed friction strength
  FRICTION_H: 1, // depth (cm) at which friction halves
  DRAIN_K: 1, // outflow per cm of depth per drain cell (units/s)
  DRAIN_CAP: 7, // passive outflow cap per drain cell (units/s) when unclogged
  INFLOW0: 150, // shower units/s at t=0
  INFLOW_RAMP: 0.015, // inflow grows by this fraction of INFLOW0 per second
  SWING_GRAB: 4, // cells downhill of the blade that are scooped
  SWING_FRACTION: 0.7,
  THROW_V0: 30, // initial uphill speed of a swung wave (cells/s)
  THROW_DECEL: 22.5, // how fast the wave slows (cells/s^2): range = V0^2 / (2 * DECEL)
  SWING_CAP: 36, // most water one stroke can carry (units)
  FORCE_DRAIN: 36, // how much of a wave that hits the drain goes straight down it (unclogged)
  ROLL_DRIFT: 5, // cells/s a soggy roll creeps toward the drain
  WALK_SPEED: 11, // cells per second
  SPRAY_TO: 26,
};

const MAX_SUB_DT = 1 / 240;

export const SWING_COOLDOWN = 0.32;

export const MIN_X = BLADE_OFF + 1;
export const MAX_X = CART_FROM - 1;

export interface Roll {
  x: number; // cell position (float)
  vx: number;
  stuck: boolean; // stuck in the drain
  falling: number; // seconds left of the falling-off-the-shelf animation
}

export interface Slug {
  x: number;
  v: number; // negative = moving uphill
  vol: number;
}

export interface Input {
  move: number; // -1 = up (toward shower), +1 = down (toward sink), 0 = stand
  swing: boolean; // a swing was requested this step (one per tap)
}

export interface State {
  t: number;
  bed: Float64Array; // floor elevation per cell
  h: Float64Array; // water depth per cell
  q: Float64Array; // flux across edge i (between cell i and i+1), N-1 edges
  px: number; // player position in cells (float)
  pv: number; // player velocity (cells/s)
  facing: number; // -1 faces the shower
  swingT: number; // time since last swing (s)
  swings: number;
  flooded: [boolean, boolean, boolean];
  floodTime: [number, number, number];
  rolls: Roll[];
  slugs: Slug[];
  lastSwingVol: number;
  drained: number; // total volume drained
  inflowTotal: number;
  over: boolean;
  events: string[]; // one-shot events for the view (cleared by the view)
}

export function makeBed(): Float64Array {
  const b = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    // a gentle, even fall from the shower to the sink
    let z = SLOPE_DROP * (1 - i / (N - 1));
    // a small dip at the drain so water that reaches it stays there
    if (DRAIN_CELLS.includes(i)) z -= 2.5;
    if (i === 0) z -= 1;
    b[i] = z;
  }
  return b;
}

export function createState(): State {
  return {
    t: 0,
    bed: makeBed(),
    h: new Float64Array(N),
    q: new Float64Array(N - 1),
    px: 24,
    pv: 0,
    facing: -1,
    swingT: 10,
    swings: 0,
    flooded: [false, false, false],
    floodTime: [0, 0, 0],
    rolls: [],
    slugs: [],
    lastSwingVol: 0,
    drained: 0,
    inflowTotal: 0,
    over: false,
    events: [],
  };
}

export function inflowRate(t: number): number {
  return T.INFLOW0 * (1 + t * T.INFLOW_RAMP);
}

/** Drain efficiency: each paper roll stuck in the drain chokes it further. */
export function drainFactor(s: State): number {
  const stuck = s.rolls.filter((r) => r.stuck).length;
  return Math.max(0.25, 1 - 0.25 * stuck);
}

export function totalWater(s: State): number {
  let v = 0;
  for (const g of s.slugs) v += g.vol;
  for (let i = 0; i < N; i++) v += s.h[i];
  return v;
}

/** Water surface elevation at the vanity (lowest point). */
export function sinkLevel(s: State): number {
  return s.bed[N - 1] + s.h[N - 1];
}

export function surfaceAt(s: State, x: number): number {
  const i = Math.max(0, Math.min(N - 1, Math.round(x)));
  return s.bed[i] + s.h[i];
}

export function depthAt(s: State, x: number): number {
  const i = Math.max(0, Math.min(N - 1, Math.round(x)));
  return s.h[i];
}

/** Flow velocity at a cell edge region (cells/s), 0 in a dry spot. */
export function velocityAt(s: State, x: number): number {
  const e = Math.max(0, Math.min(N - 2, Math.floor(x)));
  const hh = 0.5 * (s.h[e] + s.h[e + 1]);
  return hh > 0.05 ? s.q[e] / hh : 0;
}

function doSwing(s: State): void {
  const blade = Math.max(0, Math.round(s.px) - BLADE_OFF); // the blade is out in front, toward the shower
  // scoop water from the blade and a bit downhill of it (the blade only holds so much)
  let avail = 0;
  const lo = Math.max(0, blade), hi = Math.min(N - 1, blade + T.SWING_GRAB);
  for (let i = lo; i <= hi; i++) avail += s.h[i] * T.SWING_FRACTION;
  const vol = Math.min(avail, T.SWING_CAP);
  const k = avail > 0 ? vol / avail : 0;
  for (let i = lo; i <= hi; i++) s.h[i] -= s.h[i] * T.SWING_FRACTION * k;
  // the scooped water becomes a wave sliding up the floor
  if (vol > 1e-6) s.slugs.push({ x: blade, v: -T.THROW_V0, vol });
  for (const r of s.rolls) {
    if (!r.stuck && r.falling <= 0 && r.x >= blade - 1 && r.x <= hi + 1) r.vx = -T.THROW_V0 * 0.8;
  }
  s.swings++;
  s.lastSwingVol = vol;
  s.events.push('swing');
}

/** Drop a slug's water into the height field around x. */
function deposit(s: State, x: number, vol: number): void {
  const c = Math.max(0, Math.min(N - 1, Math.round(x)));
  const cells = [c - 1, c, c + 1].filter((i) => i >= 0 && i < N);
  for (const i of cells) s.h[i] += vol / cells.length;
}

function slugsStep(s: State, dt: number): void {
  const drainEdge = DRAIN_CELLS[DRAIN_CELLS.length - 1] + 0.5;
  for (const g of s.slugs) {
    g.v += T.THROW_DECEL * dt;
    g.x += g.v * dt;
    if (g.x <= drainEdge) {
      // reached the drain: the wave forces most of itself down the grate (less when clogged),
      // the rest pools in the drain dip
      const forced = Math.min(g.vol, T.FORCE_DRAIN * drainFactor(s));
      s.drained += forced;
      for (const i of DRAIN_CELLS) s.h[i] += (g.vol - forced) / DRAIN_CELLS.length;
      g.vol = 0;
    } else if (g.v >= 0) {
      deposit(s, g.x, g.vol);
      g.vol = 0;
    }
  }
  s.slugs = s.slugs.filter((g) => g.vol > 0);
}

function waterStep(s: State, dt: number): void {
  const { bed, h, q } = s;
  // 1. accelerate fluxes
  for (let e = 0; e < N - 1; e++) {
    const d = bed[e] + h[e] - (bed[e + 1] + h[e + 1]);
    // bed friction: thin films crawl, deep water sloshes freely
    const hh = 0.5 * (h[e] + h[e + 1]);
    const damp = Math.exp((-T.DAMP * dt) / (T.FRICTION_H + hh));
    q[e] = (q[e] + dt * T.G * d) * damp;
    // no flow out of a dry cell
    if (q[e] > 0 && h[e] <= 0) q[e] = 0;
    if (q[e] < 0 && h[e + 1] <= 0) q[e] = 0;
  }
  // 2. limit outflow so no cell goes negative
  for (let i = 0; i < N; i++) {
    let out = 0;
    if (i < N - 1 && q[i] > 0) out += q[i];
    if (i > 0 && q[i - 1] < 0) out -= q[i - 1];
    const maxOut = h[i] / dt;
    if (out > maxOut && out > 0) {
      const k = maxOut / out;
      if (i < N - 1 && q[i] > 0) q[i] *= k;
      if (i > 0 && q[i - 1] < 0) q[i - 1] *= k;
    }
  }
  // 3. move water
  for (let e = 0; e < N - 1; e++) {
    const f = q[e] * dt;
    h[e] -= f;
    h[e + 1] += f;
  }
  // 4. shower inflow (splashes onto the floor below the shower head)
  const rate = inflowRate(s.t);
  const span = T.SPRAY_TO - SPRAY_FROM + 1;
  for (let i = SPRAY_FROM; i <= T.SPRAY_TO; i++) h[i] += (rate / span) * dt;
  s.inflowTotal += rate * dt;
  // 5. drain
  const f = drainFactor(s);
  for (const i of DRAIN_CELLS) {
    const out = Math.min(h[i], Math.min(h[i] * T.DRAIN_K, T.DRAIN_CAP * f) * dt);
    h[i] -= out;
    s.drained += out;
  }
  for (let i = 0; i < N; i++) if (h[i] < 1e-9) h[i] = 0;
}

function playerStep(s: State, input: Input, dt: number): void {
  const slippery = s.flooded[0];
  const target = input.move * T.WALK_SPEED;
  if (!slippery) {
    // crisp: reach target speed fast
    s.pv += (target - s.pv) * Math.min(1, dt * 18);
  } else {
    // soapy: weak grip, slide downhill, overshoot
    s.pv += (target * 1.15 - s.pv) * Math.min(1, dt * 2.2);
    s.pv += 0.8 * dt; // the slope still nudges him toward the sink
  }
  s.px += s.pv * dt;
  if (s.px < MIN_X) { s.px = MIN_X; s.pv = slippery ? Math.abs(s.pv) * 0.3 : 0; }
  if (s.px > MAX_X) { s.px = MAX_X; s.pv = slippery ? -Math.abs(s.pv) * 0.3 : 0; }
  s.facing = -1;
}

function rollsStep(s: State, dt: number): void {
  for (const r of s.rolls) {
    if (r.stuck) continue;
    if (r.falling > 0) { r.falling -= dt; continue; }
    const wet = depthAt(s, r.x) > 0.15;
    const v = wet ? velocityAt(s, r.x) : 0;
    // soggy paper gets sucked along toward the drain as well as riding the flow
    r.vx += (v - (wet ? T.ROLL_DRIFT : 0) - r.vx) * Math.min(1, dt * 3);
    if (!wet) r.vx *= Math.exp(-4 * dt);
    r.x += r.vx * dt;
    r.x = Math.max(0.5, Math.min(N - 1.5, r.x));
    if (r.x <= DRAIN_CELLS[DRAIN_CELLS.length - 1] + 0.6) {
      r.stuck = true;
      s.events.push('clog');
    }
  }
}

function checkShelves(s: State): void {
  const lvl = sinkLevel(s);
  for (let k = 0; k < 3; k++) {
    if (!s.flooded[k] && lvl >= SHELF_LEVELS[k]) {
      s.flooded[k] = true;
      s.floodTime[k] = s.t;
      if (k === 0) s.events.push('suds');
      if (k === 1) {
        s.events.push('paper');
        for (let j = 0; j < 3; j++) s.rolls.push({ x: N - 4 - j * 2.5, vx: 0, stuck: false, falling: 0.8 + j * 0.2 });
      }
      if (k === 2) {
        s.events.push('zap');
        s.over = true;
      }
    }
  }
}

/** Advance the simulation by dt seconds (any size; internally substepped). */
export function step(s: State, input: Input, dt: number): void {
  if (s.over) return;
  dt = Math.min(dt, 0.1);
  s.swingT += dt;
  if (input.swing && s.swingT >= SWING_COOLDOWN) {
    s.swingT = 0;
    doSwing(s);
  }
  const n = Math.max(1, Math.ceil(dt / MAX_SUB_DT));
  const sub = dt / n;
  for (let k = 0; k < n; k++) {
    waterStep(s, sub);
    slugsStep(s, sub);
    s.t += sub;
  }
  playerStep(s, input, dt);
  rollsStep(s, dt);
  checkShelves(s);
}

/** Cells a swing from position px sends water uphill (wave range). */
export function throwRange(): number {
  return (T.THROW_V0 * T.THROW_V0) / (2 * T.THROW_DECEL);
}

/**
 * A simple "good player" used by the check script (and handy for tuning): stand where a swing
 * throws water straight into the drain, catching the run-off from the shower, and swing whenever
 * possible. When the pool under the sink gets deep it runs down and flings that water up too.
 */
export function botInput(s: State): Input {
  const camp = Math.floor(DRAIN_CELLS[DRAIN_CELLS.length - 1] + throwRange() + BLADE_OFF - 6);
  const target = Math.max(MIN_X, Math.min(MAX_X, camp));
  const d = target - s.px;
  const move = Math.abs(d) < 0.6 ? 0 : Math.sign(d);
  return { move, swing: Math.abs(d) < 1.5 };
}
