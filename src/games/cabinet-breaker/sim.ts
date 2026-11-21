/**
 * Cabinet Breaker simulation: balls, paddle, item collisions, falling pickups and the shelf critters.
 * Pure TS (no DOM). The React layer feeds it the paddle target and turns its events into juice.
 */
import {
  BOARD_W,
  buildBricks,
  levelDef,
  LEVELS,
  MAX_ROWS,
  plankY,
  WALL_L,
  WALL_R,
  WALL_T,
  type Brick,
  type ItemDef,
} from './levels';

export const BALL_R = 6.5;
export const PADDLE_W = 76;
export const PADDLE_H = 13;
export const START_LIVES = 3;
/** Max bounce angle off the paddle, measured from straight up. */
export const MAX_BOUNCE = (64 * Math.PI) / 180;
/** Most lemons in play at once. */
export const MAX_BALLS = 4;

export const CRITTERS = {
  slug: { w: 26, h: 11, speed: 20, points: 300 },
  roach: { w: 20, h: 10, speed: 125, points: 1000 },
} as const;
export type CritterKind = keyof typeof CRITTERS;

/* ---------------------------------------------------------------- pickups */

export type PickupKind = 'lemon' | 'tahini' | 'coffee' | 'tabasco';

/**
 * Drop chance per smashed item, by kind (≈ one pickup every 5 smashes in total; the fireball is rarest).
 * Lemon = extra lemon ball + points; tahini = slower ball; coffee = faster ball and double points;
 * Tabasco = fireball that burns straight through items.
 */
export const PICKUPS: Record<PickupKind, { chance: number; points: number }> = {
  lemon: { chance: 0.075, points: 250 },
  tahini: { chance: 0.05, points: 50 },
  coffee: { chance: 0.05, points: 50 },
  tabasco: { chance: 0.025, points: 100 },
};
export const PICKUP_W = 18;
export const PICKUP_H = 22;
/** Effect lengths in seconds (catching again refreshes the timer; it never stacks past this). */
export const EFFECT_TIME = { slow: 8, fast: 8, fire: 6 } as const;
export type EffectKind = keyof typeof EFFECT_TIME;
/** Ball speed multipliers for tahini (slow) and coffee (fast). */
export const SLOW_MUL = 0.62;
export const FAST_MUL = 1.35;

export interface Pickup {
  id: number;
  kind: PickupKind;
  x: number; // centre
  y: number; // centre
  vy: number;
  t: number;
}

export interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  stuck: boolean;
  /** Where on the paddle the ball sits while stuck (-1..1). */
  stuckOffset: number;
}

export interface Paddle {
  x: number; // centre
  y: number; // top
  w: number;
  h: number;
  vx: number;
}

export interface Critter {
  kind: CritterKind;
  x: number; // centre
  y: number; // top
  w: number;
  h: number;
  dir: 1 | -1;
  row: number;
  /** Roaches dash and pause; this counts down the current phase. */
  phase: number;
  moving: boolean;
  t: number;
}

export type SimEvent =
  | { type: 'wall'; x: number; y: number }
  | { type: 'paddle'; x: number; y: number; offset: number }
  | { type: 'hit'; brick: Brick }
  | { type: 'break'; brick: Brick; points: number; burnt: boolean }
  | { type: 'critter'; critter: Critter; points: number }
  | { type: 'critterSpawn'; critter: Critter }
  | { type: 'pickupSpawn'; pickup: Pickup }
  | { type: 'pickupCatch'; pickup: Pickup; points: number }
  | { type: 'pickupMiss'; pickup: Pickup }
  | { type: 'ballLost'; ball: Ball; left: number }
  | { type: 'lost'; livesLeft: number }
  | { type: 'clear'; bonus: number };

export interface Sim {
  H: number;
  level: number;
  bricks: Brick[];
  balls: Ball[];
  paddle: Paddle;
  speed: number;
  maxSpeed: number;
  critter: Critter | null;
  critterTimer: number;
  pickups: Pickup[];
  /** Seconds left on each effect (0 = off). */
  effects: Record<EffectKind, number>;
  score: number;
  lives: number;
  cleared: boolean;
  over: boolean;
  time: number;
  nextId: number;
  rng: () => number;
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ball speed (units/s) at the start of a level; later levels and later loops are faster. */
export function baseSpeed(level: number) {
  return Math.min(300 + level * 13, 500);
}

/** The cutting board gets a little narrower from level 4 on. */
export function paddleWidth(level: number) {
  return Math.max(60, PADDLE_W - Math.max(0, level - 2) * 1.5);
}

/** Critters scurry faster on later levels. */
export function critterSpeed(kind: CritterKind, level: number) {
  return CRITTERS[kind].speed * (1 + Math.min(0.6, level * 0.04));
}

export function paddleY(H: number) {
  return H - 84;
}

/** The ball speed right now, with tahini/coffee applied. */
export function effectiveSpeed(sim: Sim) {
  const mul = sim.effects.slow > 0 ? SLOW_MUL : sim.effects.fast > 0 ? FAST_MUL : 1;
  return sim.speed * mul;
}

/** The first lemon (the one that sits on the board between lives). */
export function mainBall(sim: Sim): Ball {
  return sim.balls[0];
}

export function isStuck(sim: Sim) {
  return sim.balls.length > 0 && sim.balls[0].stuck;
}

export function createSim(H: number, rng: () => number = Math.random): Sim {
  const sim: Sim = {
    H,
    level: 0,
    bricks: [],
    balls: [],
    paddle: { x: BOARD_W / 2, y: paddleY(H), w: PADDLE_W, h: PADDLE_H, vx: 0 },
    speed: 0,
    maxSpeed: 0,
    critter: null,
    critterTimer: 0,
    pickups: [],
    effects: { slow: 0, fast: 0, fire: 0 },
    score: 0,
    lives: START_LIVES,
    cleared: false,
    over: false,
    time: 0,
    nextId: 1,
    rng,
  };
  startLevel(sim, 0);
  return sim;
}

export function startLevel(sim: Sim, level: number) {
  sim.level = level;
  sim.bricks = buildBricks(level);
  sim.paddle.w = paddleWidth(level);
  sim.paddle.x = clampPaddleX(sim.paddle.x, sim.paddle.w);
  sim.cleared = false;
  sim.critter = null;
  sim.critterTimer = 7 + sim.rng() * 6;
  resetBall(sim);
}

/** One lemon back on the board; pickups and effects are cleared. */
export function resetBall(sim: Sim) {
  sim.speed = baseSpeed(sim.level);
  sim.maxSpeed = sim.speed + 120;
  sim.pickups = [];
  sim.effects = { slow: 0, fast: 0, fire: 0 };
  sim.balls = [{ id: sim.nextId++, x: 0, y: 0, vx: 0, vy: 0, stuck: true, stuckOffset: (sim.rng() - 0.5) * 0.5 }];
  placeStuckBall(sim);
}

/** Change the board height (screen resize) keeping things on the paddle line. */
export function resize(sim: Sim, H: number) {
  const dy = paddleY(H) - sim.paddle.y;
  sim.H = H;
  sim.paddle.y = paddleY(H);
  for (const b of sim.balls) {
    if (b.stuck) continue;
    if (b.y > sim.paddle.y - 40) b.y += dy;
  }
  for (const p of sim.pickups) if (p.y > sim.paddle.y - 60) p.y += dy;
  if (isStuck(sim)) placeStuckBall(sim);
}

function placeStuckBall(sim: Sim) {
  const b = sim.balls[0];
  const p = sim.paddle;
  b.x = p.x + b.stuckOffset * (p.w / 2 - BALL_R);
  b.y = p.y - BALL_R - 0.5;
}

/** Launch the stuck ball, aimed by where it sits on the paddle. */
export function launch(sim: Sim) {
  if (!isStuck(sim) || sim.cleared || sim.over) return;
  const b = sim.balls[0];
  b.stuck = false;
  const a = b.stuckOffset * 0.5 + (sim.rng() - 0.5) * 0.12;
  const sp = effectiveSpeed(sim);
  b.vx = Math.sin(a) * sp;
  b.vy = -Math.cos(a) * sp;
}

/** Clamp the paddle centre so it stays between the cabinet sides. */
export function clampPaddleX(x: number, w = PADDLE_W) {
  return Math.max(WALL_L + w / 2, Math.min(WALL_R - w / 2, x));
}

function setSpeed(b: Ball, speed: number) {
  const m = Math.hypot(b.vx, b.vy) || 1;
  b.vx = (b.vx / m) * speed;
  b.vy = (b.vy / m) * speed;
}

/** Keep the ball from travelling (almost) horizontally forever. */
function fixAngle(b: Ball, speed: number) {
  const minVy = speed * 0.28;
  if (Math.abs(b.vy) < minVy) {
    b.vy = (b.vy < 0 ? -1 : 1) * minVy;
    b.vx = Math.sign(b.vx || 1) * Math.sqrt(Math.max(0, speed * speed - minVy * minVy));
  }
}

/** Points are doubled while the coffee rush is on. */
function addScore(sim: Sim, pts: number) {
  const p = sim.effects.fast > 0 ? pts * 2 : pts;
  sim.score += p;
  return p;
}

function smash(sim: Sim, brick: Brick, events: SimEvent[], burnt: boolean) {
  const pts = addScore(sim, brick.def.points);
  events.push({ type: 'break', brick, points: pts, burnt });
  sim.bricks = sim.bricks.filter((x) => x !== brick);
  maybeDrop(sim, brick, events);
}

function hitBrick(sim: Sim, brick: Brick, events: SimEvent[]) {
  brick.hitsLeft--;
  if (brick.hitsLeft <= 0) smash(sim, brick, events, false);
  else {
    addScore(sim, 10);
    events.push({ type: 'hit', brick });
  }
}

/** Roll for a pickup falling out of a smashed item. */
function maybeDrop(sim: Sim, brick: Brick, events: SimEvent[]) {
  let r = sim.rng();
  for (const kind of Object.keys(PICKUPS) as PickupKind[]) {
    const ch = PICKUPS[kind].chance;
    if (r < ch) {
      spawnPickup(sim, kind, brick.x + brick.w / 2, brick.y + brick.h / 2, events);
      return;
    }
    r -= ch;
  }
}

export function spawnPickup(sim: Sim, kind: PickupKind, x: number, y: number, events: SimEvent[] = []) {
  const p: Pickup = { id: sim.nextId++, kind, x, y, vy: -60, t: 0 };
  sim.pickups.push(p);
  events.push({ type: 'pickupSpawn', pickup: p });
  return p;
}

/** Apply a caught pickup's effect. */
export function applyPickup(sim: Sim, kind: PickupKind, events: SimEvent[] = []) {
  switch (kind) {
    case 'lemon': {
      if (sim.balls.length >= MAX_BALLS) break;
      const p = sim.paddle;
      const a = (sim.rng() - 0.5) * 1.0;
      const sp = effectiveSpeed(sim);
      const src = sim.balls.find((b) => !b.stuck);
      sim.balls.push({
        id: sim.nextId++,
        x: src ? p.x : p.x + 10,
        y: p.y - BALL_R - 1,
        vx: Math.sin(a) * sp,
        vy: -Math.cos(a) * sp,
        stuck: false,
        stuckOffset: 0,
      });
      // A lemon caught while the first one still waits on the board launches it too.
      if (isStuck(sim)) launch(sim);
      break;
    }
    case 'tahini':
      sim.effects.slow = EFFECT_TIME.slow;
      sim.effects.fast = 0;
      break;
    case 'coffee':
      sim.effects.fast = EFFECT_TIME.fast;
      sim.effects.slow = 0;
      break;
    case 'tabasco':
      sim.effects.fire = EFFECT_TIME.fire;
      break;
  }
  return events;
}

function updatePickups(sim: Sim, dt: number, events: SimEvent[]) {
  const p = sim.paddle;
  sim.pickups = sim.pickups.filter((q) => {
    q.t += dt;
    q.vy = Math.min(230, q.vy + 320 * dt);
    q.y += q.vy * dt;
    // Caught by the cutting board?
    if (
      q.vy > 0 &&
      q.y + PICKUP_H / 2 >= p.y &&
      q.y - PICKUP_H / 2 <= p.y + p.h &&
      q.x + PICKUP_W / 2 >= p.x - p.w / 2 &&
      q.x - PICKUP_W / 2 <= p.x + p.w / 2
    ) {
      const pts = addScore(sim, PICKUPS[q.kind].points);
      applyPickup(sim, q.kind, events);
      events.push({ type: 'pickupCatch', pickup: q, points: pts });
      return false;
    }
    if (q.y - PICKUP_H / 2 > p.y + p.h + 18) {
      events.push({ type: 'pickupMiss', pickup: q });
      return false;
    }
    return true;
  });
}

function spawnCritter(sim: Sim, events: SimEvent[]) {
  const rows = levelDef(sim.level).rows.length;
  const maxRow = Math.min(MAX_ROWS - 1, rows);
  // Prefer the emptiest shelf (critters are easier to see and reach there).
  let best: number[] = [];
  let bestCount = Infinity;
  for (let r = 0; r <= maxRow; r++) {
    const n = sim.bricks.filter((b) => b.row === r).length;
    if (n < bestCount) {
      bestCount = n;
      best = [r];
    } else if (n === bestCount) best.push(r);
  }
  const row = best[Math.floor(sim.rng() * best.length)];
  const roachChance = Math.min(0.6, 0.3 + sim.level * 0.03);
  const kind: CritterKind = sim.rng() < roachChance ? 'roach' : 'slug';
  const d = CRITTERS[kind];
  const dir: 1 | -1 = sim.rng() < 0.5 ? 1 : -1;
  const c: Critter = {
    kind,
    w: d.w,
    h: d.h,
    dir,
    row,
    x: dir === 1 ? WALL_L - d.w / 2 : WALL_R + d.w / 2,
    y: plankY(row) - d.h,
    phase: 0.6,
    moving: true,
    t: 0,
  };
  sim.critter = c;
  events.push({ type: 'critterSpawn', critter: c });
}

function updateCritter(sim: Sim, dt: number, events: SimEvent[]) {
  const c = sim.critter;
  if (!c) {
    sim.critterTimer -= dt;
    if (sim.critterTimer <= 0 && !isStuck(sim)) spawnCritter(sim, events);
    return;
  }
  c.t += dt;
  const speed = critterSpeed(c.kind, sim.level);
  if (c.kind === 'roach') {
    c.phase -= dt;
    if (c.phase <= 0) {
      c.moving = !c.moving;
      c.phase = c.moving ? 0.5 + sim.rng() * 0.9 : 0.15 + sim.rng() * 0.35;
    }
  }
  if (c.moving) c.x += c.dir * speed * dt;
  if ((c.dir === 1 && c.x - c.w / 2 > WALL_R) || (c.dir === -1 && c.x + c.w / 2 < WALL_L)) {
    sim.critter = null;
    sim.critterTimer = 10 + sim.rng() * 8;
  }
}

/** Move one ball through one sub-step. Returns 'gone' when it fell past the counter. */
function stepBall(sim: Sim, b: Ball, sdt: number, speed: number, events: SimEvent[]): 'ok' | 'gone' {
  const p = sim.paddle;
  const px = b.x;
  const py = b.y;
  b.x += b.vx * sdt;
  b.y += b.vy * sdt;

  // Cabinet walls.
  if (b.x - BALL_R < WALL_L) {
    b.x = WALL_L + BALL_R;
    b.vx = Math.abs(b.vx);
    events.push({ type: 'wall', x: b.x - BALL_R, y: b.y });
  } else if (b.x + BALL_R > WALL_R) {
    b.x = WALL_R - BALL_R;
    b.vx = -Math.abs(b.vx);
    events.push({ type: 'wall', x: b.x + BALL_R, y: b.y });
  }
  if (b.y - BALL_R < WALL_T) {
    b.y = WALL_T + BALL_R;
    b.vy = Math.abs(b.vy);
    events.push({ type: 'wall', x: b.x, y: b.y - BALL_R });
  }

  // Paddle (only from above, only while falling).
  if (
    b.vy > 0 &&
    b.y + BALL_R >= p.y &&
    py + BALL_R <= p.y + p.h * 0.6 &&
    b.x + BALL_R >= p.x - p.w / 2 &&
    b.x - BALL_R <= p.x + p.w / 2
  ) {
    const offset = Math.max(-1, Math.min(1, (b.x - p.x) / (p.w / 2 + BALL_R * 0.5)));
    sim.speed = Math.min(sim.maxSpeed, sim.speed + 4 / Math.max(1, sim.balls.length));
    const sp = effectiveSpeed(sim);
    const a = offset * MAX_BOUNCE;
    b.vx = Math.sin(a) * sp;
    b.vy = -Math.cos(a) * sp;
    b.y = p.y - BALL_R;
    events.push({ type: 'paddle', x: b.x, y: p.y, offset });
  }

  if (sim.effects.fire > 0) {
    // Fireball: burns through everything it touches, no bounce.
    for (const brick of [...sim.bricks]) {
      const cx = Math.max(brick.x, Math.min(b.x, brick.x + brick.w));
      const cy = Math.max(brick.y, Math.min(b.y, brick.y + brick.h));
      if ((b.x - cx) ** 2 + (b.y - cy) ** 2 <= BALL_R * BALL_R) smash(sim, brick, events, true);
    }
  } else {
    // Items: resolve against the first one we overlap, at most one per sub-step.
    for (const brick of sim.bricks) {
      const cx = Math.max(brick.x, Math.min(b.x, brick.x + brick.w));
      const cy = Math.max(brick.y, Math.min(b.y, brick.y + brick.h));
      const dx = b.x - cx;
      const dy = b.y - cy;
      if (dx * dx + dy * dy > BALL_R * BALL_R) continue;
      // Decide which face we came through using the previous position.
      const wasLeft = px + BALL_R <= brick.x;
      const wasRight = px - BALL_R >= brick.x + brick.w;
      const wasAbove = py + BALL_R <= brick.y;
      const wasBelow = py - BALL_R >= brick.y + brick.h;
      let horiz: boolean;
      if ((wasLeft || wasRight) && !(wasAbove || wasBelow)) horiz = true;
      else if ((wasAbove || wasBelow) && !(wasLeft || wasRight)) horiz = false;
      else horiz = Math.abs(dx) > Math.abs(dy);
      if (horiz) {
        b.vx = b.x < brick.x + brick.w / 2 ? -Math.abs(b.vx) : Math.abs(b.vx);
        b.x = b.x < brick.x + brick.w / 2 ? brick.x - BALL_R : brick.x + brick.w + BALL_R;
      } else {
        b.vy = b.y < brick.y + brick.h / 2 ? -Math.abs(b.vy) : Math.abs(b.vy);
        b.y = b.y < brick.y + brick.h / 2 ? brick.y - BALL_R : brick.y + brick.h + BALL_R;
      }
      hitBrick(sim, brick, events);
      break;
    }
  }
  fixAngle(b, speed);

  // Critter squish (does not deflect the ball).
  const c = sim.critter;
  if (c) {
    const cx = Math.max(c.x - c.w / 2 - 3, Math.min(b.x, c.x + c.w / 2 + 3));
    const cy = Math.max(c.y - 3, Math.min(b.y, c.y + c.h + 3));
    if ((b.x - cx) ** 2 + (b.y - cy) ** 2 <= BALL_R * BALL_R) {
      const pts = addScore(sim, CRITTERS[c.kind].points);
      events.push({ type: 'critter', critter: c, points: pts });
      sim.critter = null;
      sim.critterTimer = 10 + sim.rng() * 8;
    }
  }

  return b.y - BALL_R > sim.H ? 'gone' : 'ok';
}

/**
 * Advance the simulation. `paddleTarget` is where the player wants the paddle centre (board units)
 * or null to leave it. Returns the events that happened this step.
 */
export function step(sim: Sim, dt: number, paddleTarget: number | null): SimEvent[] {
  const events: SimEvent[] = [];
  if (sim.cleared || sim.over) return events;
  sim.time += dt;
  const p = sim.paddle;
  const prevX = p.x;
  if (paddleTarget !== null) p.x = clampPaddleX(paddleTarget, p.w);
  p.vx = dt > 0 ? (p.x - prevX) / dt : 0;

  if (isStuck(sim)) {
    placeStuckBall(sim);
    updateCritter(sim, dt, events);
    return events;
  }

  for (const k of Object.keys(sim.effects) as EffectKind[]) sim.effects[k] = Math.max(0, sim.effects[k] - dt);
  updatePickups(sim, dt, events);

  const speed = effectiveSpeed(sim);
  const n = Math.max(1, Math.ceil((speed * dt) / 2.5));
  const sdt = dt / n;
  for (let i = 0; i < n; i++) {
    for (const b of [...sim.balls]) {
      if (b.stuck) continue;
      if (stepBall(sim, b, sdt, effectiveSpeed(sim), events) === 'gone') {
        sim.balls = sim.balls.filter((x) => x !== b);
        if (sim.balls.length > 0) events.push({ type: 'ballLost', ball: b, left: sim.balls.length });
      }
    }

    if (sim.bricks.length === 0) {
      const bonus = 250 * (sim.level + 1) + 100 * sim.lives;
      sim.score += bonus;
      sim.cleared = true;
      sim.pickups = [];
      events.push({ type: 'clear', bonus });
      return events;
    }

    if (sim.balls.length === 0) {
      sim.lives--;
      events.push({ type: 'lost', livesLeft: sim.lives });
      if (sim.lives <= 0) sim.over = true;
      else resetBall(sim);
      return events;
    }
  }
  const sp = effectiveSpeed(sim);
  for (const b of sim.balls) setSpeed(b, sp);
  updateCritter(sim, dt, events);
  return events;
}

export const LEVEL_COUNT = LEVELS.length;
export type { Brick, ItemDef };
