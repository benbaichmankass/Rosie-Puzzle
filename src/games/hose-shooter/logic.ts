/**
 * Hose Shooter simulation: pure TypeScript, no DOM. The view (draw.ts) reads the state; the
 * check script (scripts/check-hose-shooter.ts) drives it headlessly.
 *
 * World units: the screen is always W = 400 wide and H = 400 * (height / width) tall.
 */

export const W = 400;
export const ROUND_SECONDS = 60;

export const POINTS = {
  catGround: 100,
  catWall: 150,
  catTree: 200,
  chicken: 500,
  bunny: -150,
  turtle: -150,
} as const;

// ---------------------------------------------------------------- random

export type Rng = () => number;

/** Small fast seeded RNG (mulberry32). */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ---------------------------------------------------------------- layout

export interface Layout {
  W: number;
  H: number;
  /** y of the top of the back wall (cats walk along it). */
  wallTop: number;
  /** y where the back wall meets the dirt. */
  wallBase: number;
  /** Ground lanes: depth 0 is the wall base, depth 1 the nearest lane. */
  groundNear: number;
  treeX: number;
  treeBaseY: number;
  branchY: number;
  branchEndX: number;
  colanderX: number;
  pondX0: number;
  pondX1: number;
  /** Pivot of the nozzle (bottom of the screen, a little right of centre). */
  pivotX: number;
  pivotY: number;
  nozzleLen: number;
  /** Lowest point the player can aim at. */
  aimMaxY: number;
}

export function makeLayout(H: number): Layout {
  const wallTop = Math.round(H * 0.215);
  const wallBase = Math.round(H * 0.5);
  return {
    W,
    H,
    wallTop,
    wallBase,
    groundNear: Math.round(H * 0.79),
    treeX: 70,
    treeBaseY: wallBase + 22,
    branchY: Math.round(lerp(wallTop, wallBase, 0.32)),
    branchEndX: 215,
    colanderX: 150,
    pondX0: 290,
    pondX1: 392,
    pivotX: 228,
    pivotY: H + 6,
    nozzleLen: 150,
    aimMaxY: Math.round(H * 0.8),
  };
}

/** Feet y and drawing scale of a ground lane. */
export function groundAt(L: Layout, depth: number): { y: number; s: number } {
  return { y: lerp(L.wallBase + 16, L.groundNear, depth), s: lerp(0.55, 1.3, depth) };
}

/** Inverse of groundAt: depth of a ground y (clamped). */
export function depthOfY(L: Layout, y: number): number {
  return clamp((y - (L.wallBase + 16)) / (L.groundNear - (L.wallBase + 16)), 0, 1);
}

export const WALL_SCALE = 0.5;
export const TREE_SCALE = 0.58;

// ---------------------------------------------------------------- entities

export type Kind = 'cat' | 'chicken' | 'bunny' | 'turtle';
export type Pose = 'run' | 'sit' | 'climb' | 'down' | 'jump' | 'hop' | 'nibble' | 'crawl' | 'peek';
export type Zone = 'ground' | 'wall' | 'tree';

export interface Waypoint {
  x: number;
  y: number;
  s: number;
  zone: Zone;
  /** Seconds to rest at this point before moving on. */
  wait?: number;
  /** Pose while resting here. */
  waitPose?: Pose;
  /** Move to this point with a jump arc (fixed duration). */
  jump?: boolean;
}

export type EntState = 'move' | 'soaked' | 'flee' | 'shell' | 'gone';

export interface Ent {
  id: number;
  kind: Kind;
  /** cat colour / bunny id / turtle id. */
  variant: number;
  path: Waypoint[];
  seg: number;
  /** 0..1 progress along the current segment. */
  u: number;
  /** Time left resting at path[seg]. */
  rest: number;
  speed: number;
  x: number;
  y: number;
  s: number;
  zone: Zone;
  dir: 1 | -1;
  pose: Pose;
  state: EntState;
  stateT: number;
  age: number;
  /** Water drops that landed on it (soaks at a threshold). */
  wet: number;
  /** Visual height offset (hops, jumps, chicken rise). */
  lift: number;
  /** Distance travelled, drives walk cycles. */
  dist: number;
  /** For the speech bubble after a hit. */
  shout: string;
}

export interface Drop {
  x0: number;
  y0: number;
  cx: number;
  cy: number;
  x1: number;
  y1: number;
  t: number;
  T: number;
  /** Emission index, to join consecutive drops into a stream. */
  n: number;
}

export type FxKind = 'splash' | 'wallsplat' | 'groundsplat' | 'feathers' | 'points' | 'drip';
export interface Fx {
  kind: FxKind;
  x: number;
  y: number;
  s: number;
  t: number;
  life: number;
  value?: number;
  seed: number;
}

export type GameEvent =
  | { type: 'hit'; kind: Kind; points: number; x: number; y: number }
  | { type: 'splash'; x: number; y: number }
  | { type: 'chicken-up' }
  | { type: 'tick'; secondsLeft: number }
  | { type: 'end' };

export interface Stats {
  cats: number;
  chickens: number;
  bunnies: number;
  turtles: number;
  catsSpawned: number;
  chickensSpawned: number;
  bunniesSpawned: number;
  turtlesSpawned: number;
  bunnyVariantsSeen: number[];
}

export interface Input {
  aimX: number;
  aimY: number;
  spraying: boolean;
}

export interface GameState {
  L: Layout;
  rng: Rng;
  /** Seconds since the round started. */
  time: number;
  running: boolean;
  /** Attract mode: actors wander, no timer, no scoring. */
  demo: boolean;
  over: boolean;
  score: number;
  ents: Ent[];
  drops: Drop[];
  fx: Fx[];
  events: GameEvent[];
  stats: Stats;
  nextId: number;
  dropN: number;
  emitAcc: number;
  aimX: number;
  aimY: number;
  spraying: boolean;
  /** Nozzle angle (radians, 0 = pointing up), eased toward the aim. */
  angle: number;
  timers: { cat: number; chicken: number; bunny: number; turtle: number };
  bunnyCycle: number;
  turtleCycle: number;
  lastTick: number;
}

export const CAT_VARIANTS = 5;

export function createGame(H: number, seed: number, demo = false): GameState {
  const L = makeLayout(H);
  const rng = makeRng(seed);
  return {
    L,
    rng,
    time: 0,
    running: true,
    demo,
    over: false,
    score: 0,
    ents: [],
    drops: [],
    fx: [],
    events: [],
    stats: {
      cats: 0,
      chickens: 0,
      bunnies: 0,
      turtles: 0,
      catsSpawned: 0,
      chickensSpawned: 0,
      bunniesSpawned: 0,
      turtlesSpawned: 0,
      bunnyVariantsSeen: [],
    },
    nextId: 1,
    dropN: 0,
    emitAcc: 0,
    aimX: W / 2,
    aimY: L.wallBase,
    spraying: false,
    angle: 0,
    timers: { cat: 0.6, chicken: lerp(7, 11, rng()), bunny: lerp(3.5, 5, rng()), turtle: lerp(6, 9, rng()) },
    bunnyCycle: Math.floor(rng() * 3),
    turtleCycle: 0,
    lastTick: ROUND_SECONDS + 1,
  };
}

/** 0 at the start of a round, 1 at the end. */
export function progress(g: GameState): number {
  return g.demo ? 0.15 : clamp(g.time / ROUND_SECONDS, 0, 1);
}

export function secondsLeft(g: GameState): number {
  return Math.max(0, ROUND_SECONDS - g.time);
}

// ---------------------------------------------------------------- routes

function wp(x: number, y: number, s: number, zone: Zone, extra: Partial<Waypoint> = {}): Waypoint {
  return { x, y, s, zone, ...extra };
}

function catGroundRoute(g: GameState): Waypoint[] {
  const { L, rng } = g;
  const d = lerp(0.05, 0.95, rng());
  const { y, s } = groundAt(L, d);
  const fromLeft = rng() < 0.5;
  const x0 = fromLeft ? -40 : W + 40;
  const x1 = fromLeft ? W + 40 : -40;
  const path = [wp(x0, y, s, 'ground')];
  if (rng() < 0.35) {
    const mx = lerp(80, W - 80, rng());
    path.push(wp(mx, y, s, 'ground', { wait: lerp(0.5, 1.1, rng()), waitPose: 'sit' }));
  }
  path.push(wp(x1, y, s, 'ground'));
  return path;
}

function catWallRoute(g: GameState): Waypoint[] {
  const { L, rng } = g;
  const s = WALL_SCALE;
  const y = L.wallTop;
  const fromLeft = rng() < 0.5;
  const x0 = fromLeft ? -30 : W + 30;
  const x1 = fromLeft ? W + 30 : -30;
  const r = rng();
  if (r < 0.3) {
    // run along the wall, then jump down into the yard and run off
    const jx = lerp(140, 300, rng());
    const d = lerp(0.1, 0.4, rng());
    const gnd = groundAt(L, d);
    const lx = jx + (fromLeft ? 30 : -30);
    return [
      wp(x0, y, s, 'wall'),
      wp(jx, y, s, 'wall', { wait: lerp(0.3, 0.7, rng()), waitPose: 'sit' }),
      wp(lx, gnd.y, gnd.s, 'ground', { jump: true }),
      wp(x1, gnd.y, gnd.s, 'ground'),
    ];
  }
  const path = [wp(x0, y, s, 'wall')];
  if (r < 0.65) path.push(wp(lerp(110, W - 60, rng()), y, s, 'wall', { wait: lerp(0.6, 1.2, rng()), waitPose: 'sit' }));
  path.push(wp(x1, y, s, 'wall'));
  return path;
}

function catTreeRoute(g: GameState): Waypoint[] {
  const { L, rng } = g;
  const s = TREE_SCALE;
  const trunk = L.treeX;
  const base = groundAt(L, 0.08);
  const branchTip = L.branchEndX - 10;
  const sitX = lerp(L.treeX + 50, branchTip, rng());
  if (rng() < 0.5) {
    // climb up from the ground, out along the branch, leap onto the wall and away
    return [
      wp(-30, base.y, base.s, 'ground'),
      wp(trunk, base.y - 6, s, 'tree'),
      wp(trunk, L.branchY, s, 'tree'),
      wp(sitX, L.branchY, s, 'tree', { wait: lerp(0.5, 1.2, rng()), waitPose: 'sit' }),
      wp(Math.min(sitX + 60, W - 60), L.wallTop, WALL_SCALE, 'wall', { jump: true }),
      wp(W + 30, L.wallTop, WALL_SCALE, 'wall'),
    ];
  }
  // come along the wall, drop onto the branch, scramble down the trunk and away
  return [
    wp(W + 30, L.wallTop, WALL_SCALE, 'wall'),
    wp(L.branchEndX + 40, L.wallTop, WALL_SCALE, 'wall'),
    wp(sitX, L.branchY, s, 'tree', { jump: true, wait: lerp(0.4, 1.0, rng()), waitPose: 'sit' }),
    wp(trunk, L.branchY, s, 'tree'),
    wp(trunk, base.y - 6, s, 'tree'),
    wp(-30, base.y, base.s, 'ground'),
  ];
}

function bunnyRoute(g: GameState): Waypoint[] {
  const { L, rng } = g;
  const d = lerp(0.1, 0.85, rng());
  const { y, s } = groundAt(L, d);
  const fromLeft = rng() < 0.5;
  const x0 = fromLeft ? -40 : W + 40;
  const x1 = fromLeft ? W + 40 : -40;
  const path = [wp(x0, y, s, 'ground')];
  const stops = rng() < 0.6 ? 2 : 1;
  for (let i = 1; i <= stops; i++) {
    const t = i / (stops + 1) + lerp(-0.08, 0.08, rng());
    const x = lerp(x0, x1, t);
    const d2 = clamp(d + lerp(-0.15, 0.15, rng()), 0.05, 0.9);
    const p = groundAt(L, d2);
    path.push(wp(x, p.y, p.s, 'ground', { wait: lerp(0.8, 1.8, rng()), waitPose: 'nibble' }));
  }
  path.push(wp(x1, path[path.length - 1].y, path[path.length - 1].s, 'ground'));
  return path;
}

function turtleRoute(g: GameState): Waypoint[] {
  const { L, rng } = g;
  const pond = groundAt(L, 0.02);
  const px = lerp(L.pondX0 + 25, L.pondX1 - 20, rng());
  const far = groundAt(L, lerp(0.35, 0.75, rng()));
  if (rng() < 0.6) {
    // crawl out of the pond and off to the left
    return [wp(px, pond.y, pond.s, 'ground'), wp(-50, far.y, far.s, 'ground')];
  }
  // come back from the left and slide into the pond
  return [wp(-50, far.y, far.s, 'ground'), wp(px, pond.y, pond.s, 'ground')];
}

function spawn(g: GameState, kind: Kind, path: Waypoint[], speed: number, variant: number): Ent {
  const p = path[0];
  const e: Ent = {
    id: g.nextId++,
    kind,
    variant,
    path,
    seg: 0,
    u: 0,
    rest: 0,
    speed,
    x: p.x,
    y: p.y,
    s: p.s,
    zone: p.zone,
    dir: path.length > 1 && path[1].x < p.x ? -1 : 1,
    pose: kind === 'bunny' ? 'hop' : kind === 'turtle' ? 'crawl' : 'run',
    state: 'move',
    stateT: 0,
    age: 0,
    wet: 0,
    lift: 0,
    dist: 0,
    shout: '',
  };
  g.ents.push(e);
  return e;
}

function spawnCat(g: GameState) {
  const p = progress(g);
  const r = g.rng();
  const path = r < 0.42 ? catGroundRoute(g) : r < 0.74 ? catWallRoute(g) : catTreeRoute(g);
  const speed = lerp(125, 200, p) * lerp(0.85, 1.2, g.rng());
  spawn(g, 'cat', path, speed, Math.floor(g.rng() * CAT_VARIANTS));
  g.stats.catsSpawned++;
}

function spawnChicken(g: GameState) {
  const { L, rng } = g;
  const x = lerp(L.branchEndX + 20, L.pondX0 + 40, rng()) * (rng() < 0.3 ? 0.55 : 1);
  const hold = lerp(1.6, 1.05, progress(g)) + rng() * 0.3;
  const e = spawn(g, 'chicken', [wp(x, L.wallTop, 0.62, 'wall')], 0, 0);
  e.pose = 'peek';
  e.rest = hold;
  e.dir = rng() < 0.5 ? 1 : -1;
  g.stats.chickensSpawned++;
  g.events.push({ type: 'chicken-up' });
}

function spawnBunny(g: GameState) {
  const v = g.bunnyCycle % 3;
  g.bunnyCycle++;
  spawn(g, 'bunny', bunnyRoute(g), lerp(70, 95, g.rng()), v);
  g.stats.bunniesSpawned++;
  if (!g.stats.bunnyVariantsSeen.includes(v)) g.stats.bunnyVariantsSeen.push(v);
}

function spawnTurtle(g: GameState) {
  const v = g.turtleCycle % 2;
  g.turtleCycle++;
  spawn(g, 'turtle', turtleRoute(g), lerp(22, 30, g.rng()), v);
  g.stats.turtlesSpawned++;
}

const count = (g: GameState, k: Kind) => g.ents.reduce((n, e) => n + (e.kind === k && e.state !== 'gone' ? 1 : 0), 0);

function runSpawners(g: GameState, dt: number) {
  const p = progress(g);
  const t = g.timers;
  t.cat -= dt;
  t.chicken -= dt;
  t.bunny -= dt;
  t.turtle -= dt;
  const maxCats = Math.round(lerp(2, 5, p));
  if (t.cat <= 0) {
    if (count(g, 'cat') < maxCats) spawnCat(g);
    t.cat = lerp(1.9, 0.85, p) * lerp(0.7, 1.3, g.rng());
  }
  if (t.chicken <= 0) {
    if (count(g, 'chicken') === 0) {
      spawnChicken(g);
      t.chicken = lerp(9, 14, g.rng());
    } else t.chicken = 1;
  }
  if (t.bunny <= 0) {
    if (count(g, 'bunny') < 2) spawnBunny(g);
    t.bunny = lerp(5, 8.5, g.rng());
  }
  if (t.turtle <= 0) {
    if (count(g, 'turtle') < 1) spawnTurtle(g);
    t.turtle = lerp(10, 16, g.rng());
  }
}

// ---------------------------------------------------------------- movement

const JUMP_TIME = 0.5;

function segLength(a: Waypoint, b: Waypoint) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function moveAlongPath(e: Ent, dt: number, speedMul: number) {
  const path = e.path;
  let time = dt;
  let guard = 8;
  while (time > 0 && guard-- > 0) {
    if (e.rest > 0) {
      const used = Math.min(e.rest, time);
      e.rest -= used;
      time -= used;
      const here = path[e.seg];
      e.pose = here.waitPose ?? 'sit';
      e.x = here.x;
      e.y = here.y;
      e.s = here.s;
      e.lift = 0;
      if (e.rest > 0) return;
      continue;
    }
    if (e.seg >= path.length - 1) {
      e.state = 'gone';
      return;
    }
    const a = path[e.seg];
    const b = path[e.seg + 1];
    const len = Math.max(1, segLength(a, b));
    const avgS = (a.s + b.s) / 2;
    const dur = b.jump ? JUMP_TIME : len / (e.speed * speedMul * avgS);
    const du = time / dur;
    const left = 1 - e.u;
    const step = Math.min(du, left);
    e.u += step;
    time -= step * dur;
    e.dist += step * len;
    const u = e.u;
    e.x = lerp(a.x, b.x, u);
    e.y = lerp(a.y, b.y, u);
    e.s = lerp(a.s, b.s, u);
    e.zone = u < 0.5 ? a.zone : b.zone;
    if (Math.abs(b.x - a.x) > 2) e.dir = b.x > a.x ? 1 : -1;
    if (b.jump) {
      e.pose = 'jump';
      e.lift = Math.sin(Math.PI * u) * (40 * avgS + Math.max(0, a.y - b.y) * 0.15);
    } else if (e.kind === 'bunny') {
      e.pose = 'hop';
      const ph = (e.dist / (46 * avgS)) * Math.PI;
      e.lift = Math.abs(Math.sin(ph)) * 16 * avgS;
    } else if (e.kind === 'turtle') {
      e.pose = 'crawl';
      e.lift = 0;
    } else {
      const vertical = Math.abs(b.y - a.y) > Math.abs(b.x - a.x) * 1.5;
      e.pose = vertical ? (b.y < a.y ? 'climb' : 'down') : 'run';
      e.lift = 0;
    }
    if (e.u >= 1 - 1e-9) {
      e.seg++;
      e.u = 0;
      e.rest = path[e.seg].wait ?? 0;
      e.lift = 0;
    }
  }
}

/** Build a quick getaway path after a hit (cats and bunnies run for it). */
function fleePath(g: GameState, e: Ent): Waypoint[] {
  const { L } = g;
  const here = wp(e.x, e.y, e.s, e.zone);
  const side = e.x < W / 2 ? -50 : W + 50;
  if (e.kind === 'cat' && e.zone === 'tree') {
    // leap from the tree onto the wall and bolt
    const tx = clamp(e.x + (side > 0 ? 70 : -40), 10, W - 10);
    return [here, wp(tx, L.wallTop, WALL_SCALE, 'wall', { jump: true }), wp(side, L.wallTop, WALL_SCALE, 'wall')];
  }
  if (e.zone === 'wall') return [here, wp(side, L.wallTop, WALL_SCALE, 'wall')];
  return [here, wp(side, e.y, e.s, 'ground')];
}

function updateEnt(g: GameState, e: Ent, dt: number) {
  e.age += dt;
  e.stateT += dt;
  if (e.kind === 'chicken') {
    // rise (0.25s), hold, duck (0.25s); after a hit drop fast
    const up = 0.25;
    if (e.state === 'move') {
      if (e.stateT < up) e.lift = e.stateT / up;
      else {
        e.lift = 1;
        e.rest -= dt;
        if (e.rest <= 0) {
          e.state = 'flee';
          e.stateT = 0;
        }
      }
    } else if (e.state === 'soaked') {
      e.lift = 1;
      if (e.stateT > 0.45) {
        e.state = 'flee';
        e.stateT = 0;
      }
    } else if (e.state === 'flee') {
      e.lift = Math.max(0, 1 - e.stateT / 0.22);
      if (e.lift <= 0) e.state = 'gone';
    }
    return;
  }
  if (e.state === 'move') {
    moveAlongPath(e, dt, 1);
  } else if (e.state === 'soaked') {
    e.lift = 0;
    const hold = e.kind === 'cat' ? 0.75 : 0.55;
    if (e.stateT > hold) {
      e.state = 'flee';
      e.stateT = 0;
      e.path = fleePath(g, e);
      e.seg = 0;
      e.u = 0;
      e.rest = 0;
      e.speed = e.kind === 'cat' ? 330 : 190;
    }
  } else if (e.state === 'flee') {
    moveAlongPath(e, e.kind === 'turtle' ? dt * 0.6 : dt, 1);
  } else if (e.state === 'shell') {
    if (e.stateT > 1.6) {
      e.state = 'flee';
      e.stateT = 0;
    }
  }
}

// ---------------------------------------------------------------- water

/** Where the stream leaves the nozzle for the current angle. */
export function nozzleTip(g: GameState): { x: number; y: number } {
  const { L } = g;
  return { x: L.pivotX + Math.sin(g.angle) * L.nozzleLen, y: L.pivotY - Math.cos(g.angle) * L.nozzleLen };
}

const EMIT_RATE = 55;

function emitDrops(g: GameState, dt: number) {
  if (!g.spraying) {
    g.emitAcc = 0;
    return;
  }
  g.emitAcc += dt * EMIT_RATE;
  while (g.emitAcc >= 1) {
    g.emitAcc -= 1;
    const tip = nozzleTip(g);
    const depth = g.aimY >= g.L.wallBase ? depthOfY(g.L, g.aimY) : 0;
    const spread = lerp(3, 6, depth);
    const x1 = g.aimX + (g.rng() - 0.5) * 2 * spread;
    const y1 = g.aimY + (g.rng() - 0.5) * 2 * spread * 0.6;
    const dist = Math.hypot(x1 - tip.x, y1 - tip.y);
    const T = 0.22 + (dist / g.L.H) * 0.5;
    const lift = 18 + dist * 0.2;
    g.drops.push({
      x0: tip.x,
      y0: tip.y,
      cx: tip.x + (x1 - tip.x) * 0.55,
      cy: Math.min(tip.y, y1) - lift,
      x1,
      y1,
      t: 0,
      T,
      n: g.dropN++,
    });
  }
}

export function dropPos(d: Drop, t = d.t): { x: number; y: number } {
  const u = clamp(t / d.T, 0, 1);
  const a = (1 - u) * (1 - u);
  const b = 2 * (1 - u) * u;
  const c = u * u;
  return { x: a * d.x0 + b * d.cx + c * d.x1, y: a * d.y0 + b * d.cy + c * d.y1 };
}

/** Hit box: centre and radii for an entity, in world units. */
export function hitBox(e: Ent, L: Layout): { cx: number; cy: number; rx: number; ry: number } | null {
  const s = e.s;
  switch (e.kind) {
    case 'cat': {
      if (e.pose === 'climb' || e.pose === 'down') return { cx: e.x, cy: e.y - 26 * s, rx: 16 * s, ry: 30 * s };
      if (e.pose === 'sit') return { cx: e.x, cy: e.y - 30 * s, rx: 22 * s, ry: 30 * s };
      return { cx: e.x, cy: e.y - 24 * s - e.lift, rx: 34 * s, ry: 22 * s };
    }
    case 'chicken': {
      const visible = 58 * s * e.lift;
      if (visible < 8) return null;
      return { cx: e.x, cy: L.wallTop - visible / 2, rx: 26 * s, ry: Math.max(visible / 2, 8) };
    }
    case 'bunny':
      return { cx: e.x, cy: e.y - 22 * s - e.lift, rx: 28 * s, ry: 22 * s };
    case 'turtle':
      return { cx: e.x, cy: e.y - 12 * s, rx: 34 * s, ry: 14 * s };
  }
}

function hittable(e: Ent): boolean {
  return e.state === 'move';
}

/** Drops needed to soak each kind. */
const SOAK_AT: Record<Kind, number> = { cat: 3, chicken: 3, bunny: 3, turtle: 3 };

const CAT_SHOUTS = ['MRRAW!', 'HISSS!', 'PFFT!', 'MEOW!', 'YOWL!'];
const BUNNY_SHOUTS = ['EEP!', 'HEY!', 'OI!'];

function landDrop(g: GameState, d: Drop) {
  const { L } = g;
  const x = d.x1;
  const y = d.y1;
  const splashR = y >= L.wallBase ? lerp(6, 12, depthOfY(L, y)) : 6;
  let best: Ent | null = null;
  for (const e of g.ents) {
    if (!hittable(e)) continue;
    const hb = hitBox(e, L);
    if (!hb) continue;
    const dx = (x - hb.cx) / (hb.rx + splashR);
    const dy = (y - hb.cy) / (hb.ry + splashR);
    if (dx * dx + dy * dy > 1) continue;
    if (!best || e.s > best.s) best = e;
  }
  if (best) {
    const e = best;
    e.wet++;
    g.fx.push({ kind: 'splash', x, y, s: e.s, t: 0, life: 0.35, seed: g.rng() });
    if (e.wet >= SOAK_AT[e.kind]) soak(g, e);
    return;
  }
  // landed on the scenery
  if (y < L.wallBase) {
    g.fx.push({ kind: 'wallsplat', x, y, s: 0.7, t: 0, life: 1.8, seed: g.rng() });
  } else {
    const s = groundAt(L, depthOfY(L, y)).s;
    g.fx.push({ kind: 'groundsplat', x, y, s, t: 0, life: 1.6, seed: g.rng() });
  }
  if (d.n % 3 === 0) g.fx.push({ kind: 'splash', x, y, s: y < L.wallBase ? 0.6 : groundAt(L, depthOfY(L, y)).s, t: 0, life: 0.3, seed: g.rng() });
}

function pointsFor(e: Ent): number {
  switch (e.kind) {
    case 'cat':
      return e.zone === 'tree' ? POINTS.catTree : e.zone === 'wall' ? POINTS.catWall : POINTS.catGround;
    case 'chicken':
      return POINTS.chicken;
    case 'bunny':
      return POINTS.bunny;
    case 'turtle':
      return POINTS.turtle;
  }
}

function soak(g: GameState, e: Ent) {
  const pts = pointsFor(e);
  e.state = e.kind === 'turtle' ? 'shell' : 'soaked';
  e.stateT = 0;
  e.lift = e.kind === 'chicken' ? e.lift : 0;
  if (e.kind === 'cat') e.shout = CAT_SHOUTS[Math.floor(g.rng() * CAT_SHOUTS.length)];
  else if (e.kind === 'bunny') e.shout = BUNNY_SHOUTS[Math.floor(g.rng() * BUNNY_SHOUTS.length)];
  else if (e.kind === 'chicken') e.shout = 'BAWK!';
  else e.shout = '!';
  const hb = hitBox(e, g.L);
  const fx = hb ? hb.cx : e.x;
  const fy = hb ? hb.cy - hb.ry : e.y;
  if (!g.demo) {
    g.score = Math.max(0, g.score + pts);
    if (e.kind === 'cat') g.stats.cats++;
    else if (e.kind === 'chicken') g.stats.chickens++;
    else if (e.kind === 'bunny') g.stats.bunnies++;
    else g.stats.turtles++;
    g.fx.push({ kind: 'points', x: fx, y: fy - 10, s: 1, t: 0, life: 1.1, value: pts, seed: 0 });
  }
  if (e.kind === 'chicken') g.fx.push({ kind: 'feathers', x: fx, y: fy + 10, s: 1, t: 0, life: 1.2, seed: g.rng() });
  g.events.push({ type: 'hit', kind: e.kind, points: pts, x: fx, y: fy });
}

// ---------------------------------------------------------------- step

export function step(g: GameState, dt: number, input: Input) {
  if (!g.running) return;
  dt = Math.min(dt, 0.05);
  const { L } = g;
  g.aimX = clamp(input.aimX, 0, W);
  g.aimY = clamp(input.aimY, 30, L.aimMaxY);
  g.spraying = input.spraying && !g.over;

  if (!g.demo && !g.over) {
    g.time += dt;
    const left = Math.ceil(secondsLeft(g));
    if (left <= 5 && left < g.lastTick && left > 0) g.events.push({ type: 'tick', secondsLeft: left });
    g.lastTick = left;
    if (g.time >= ROUND_SECONDS) {
      g.over = true;
      g.spraying = false;
      g.events.push({ type: 'end' });
    }
  }

  // nozzle eases toward the aim point
  const target = Math.atan2(g.aimX - L.pivotX, L.pivotY - g.aimY);
  g.angle += (target - g.angle) * Math.min(1, dt * 18);

  if (!g.over) runSpawners(g, dt);
  for (const e of g.ents) updateEnt(g, e, dt);
  g.ents = g.ents.filter((e) => e.state !== 'gone');

  emitDrops(g, dt);
  for (const d of g.drops) {
    d.t += dt;
    if (d.t >= d.T) landDrop(g, d);
  }
  g.drops = g.drops.filter((d) => d.t < d.T);

  for (const f of g.fx) f.t += dt;
  g.fx = g.fx.filter((f) => f.t < f.life);
  // keep the effect list bounded
  if (g.fx.length > 220) g.fx.splice(0, g.fx.length - 220);
}
