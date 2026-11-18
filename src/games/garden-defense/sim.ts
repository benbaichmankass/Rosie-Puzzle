/**
 * Garden Defense simulation. Goal (Ben's rule): water the 5 hedges until they grow tall enough to hide the
 * apartments across the street. Win when every hedge still alive reaches height 1; lose when the bunnies kill
 * all of them.
 *
 * Plain TS, no DOM, so scripts/check-garden-defense.ts can run it headless.
 *
 * World units: x runs 0..1 across the plant bed (left to right). Bunnies also have a depth `d`:
 * d < 0 is up on the plant bed (behind the wire fence), 0..1 is the dirt yard in front, 1 = nearest the viewer.
 */

export const TUNING = {
  plantCount: 5,
  startLeaves: 6,
  maxLeaves: 9,
  /** Leaves per second a plant grows on dry soil. */
  baseGrowth: 0.05,
  /** Extra leaves per second at full soil moisture. */
  waterGrowth: 1.0,
  /** Moisture gained per second while the can pours on a plant (moisture is 0..1). */
  waterRate: 4,
  /** Moisture lost per second. */
  moistureDecay: 0.9,

  /** Hedge height: 1 = tall enough to hide the apartment windows across the street (the goal). */
  startHeight: 0.2,
  /** Height gained per second at full moisture and full foliage. Thin hedges grow slower. */
  heightRate: 0.022,
  /** Hedges stop growing a little above the target. */
  heightCap: 1.06,

  /** Seconds for aggression to go from 0 to 1. It keeps rising after that. */
  ramp: 165,
  /** Bunny travel speed (bed widths per second) at aggression 0, and how much it grows per unit aggression. */
  hopSpeed0: 0.2,
  hopSpeedK: 0.5,
  hopSpeedMaxMul: 2.4,
  /** Seconds between bites at aggression 0, and how fast that shrinks. */
  bite0: 1.7,
  biteK: 1.1,
  biteMin: 0.28,
  /** Bites a bunny takes per visit before it wanders off. */
  meal0: 3,
  mealK: 3,
  mealMax: 40,
  /** Rest between visits (seconds) at aggression 0, and how fast that shrinks. */
  rest0: 6,
  restK: 1.6,
  restMin: 0.5,
  /** When choosing a plant, weight of a plant another bunny is already on (lower = bunnies spread out). */
  crowdWeight0: 0.35,
  /** Grace period before the first bunny moves. */
  firstMoves: [2.5, 5, 7.5],
} as const;

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Plant {
  x: number;
  /** 0..heightCap; 1 = the target height. */
  height: number;
  leaves: number;
  /** Progress towards the next leaf, 0..1. */
  growth: number;
  moisture: number;
  alive: boolean;
  /** Time of death (for the wilt animation). */
  diedAt: number;
}

export type BunnyMode = 'rest' | 'hop' | 'eat';

export interface Bunny {
  id: number;
  x: number;
  d: number;
  mode: BunnyMode;
  /** Hop destination. */
  tx: number;
  td: number;
  /** Plant index it is heading to / eating, -1 when going to rest. */
  target: number;
  slot: number;
  /** Rest countdown. */
  timer: number;
  bitesLeft: number;
  biteTimer: number;
  /** 0..1 through the current hop; 0 when on the ground. */
  hop: number;
  hopHigh: boolean;
  face: 1 | -1;
}

export type SimEvent =
  | { type: 'bite'; plant: number; bunny: number }
  | { type: 'grow'; plant: number }
  | { type: 'die'; plant: number }
  | { type: 'land'; bunny: number }
  | { type: 'tall'; plant: number }
  | { type: 'over'; won: boolean };

export interface GameState {
  t: number;
  plants: Plant[];
  bunnies: Bunny[];
  over: boolean;
  /** Set when the game ends with every surviving hedge at the target height. */
  won: boolean;
  events: SimEvent[];
  rng: Rng;
}

/** Where on the bed each eating slot sits, relative to the plant. */
export const SLOTS = [
  { dx: -0.055, d: -0.085 },
  { dx: 0.055, d: -0.085 },
  { dx: 0.0, d: -0.03 },
];

export const plantX = (i: number, n = TUNING.plantCount) => (i + 0.5) / n;

export function createGame(seed: number): GameState {
  const rng = mulberry32(seed);
  const plants: Plant[] = [];
  for (let i = 0; i < TUNING.plantCount; i++) {
    plants.push({
      x: plantX(i),
      height: TUNING.startHeight + (rng() - 0.5) * 0.04,
      leaves: TUNING.startLeaves,
      growth: rng() * 0.5,
      moisture: 0.3,
      alive: true,
      diedAt: 0,
    });
  }
  const restSpots = [
    { x: 0.2, d: 0.62 },
    { x: 0.5, d: 0.82 },
    { x: 0.78, d: 0.55 },
  ];
  const bunnies: Bunny[] = restSpots.map((p, id) => ({
    id,
    x: p.x,
    d: p.d,
    mode: 'rest',
    tx: p.x,
    td: p.d,
    target: -1,
    slot: 0,
    timer: TUNING.firstMoves[id],
    bitesLeft: 0,
    biteTimer: 0,
    hop: 0,
    hopHigh: false,
    face: id === 2 ? -1 : 1,
  }));
  return { t: 0, plants, bunnies, over: false, won: false, events: [], rng };
}

/** 0 at the start, 1 after `ramp` seconds, and still rising after. */
export const aggression = (t: number) => t / TUNING.ramp;

export function hopSpeed(a: number) {
  return TUNING.hopSpeed0 * Math.min(TUNING.hopSpeedMaxMul, 1 + TUNING.hopSpeedK * a);
}
export function biteInterval(a: number) {
  return Math.max(TUNING.biteMin, TUNING.bite0 / (1 + TUNING.biteK * a));
}
export function mealBites(a: number, rng: Rng) {
  return Math.min(TUNING.mealMax, Math.round(TUNING.meal0 + TUNING.mealK * a + rng() * 2));
}
export function restTime(a: number, rng: Rng) {
  return Math.max(TUNING.restMin, (TUNING.rest0 / (1 + TUNING.restK * a)) * (0.6 + 0.8 * rng()));
}
/** Hop duration grows shorter as bunnies get keener. */
export function hopDuration(a: number) {
  return 0.42 / Math.sqrt(Math.min(TUNING.hopSpeedMaxMul, 1 + TUNING.hopSpeedK * a));
}

export const alivePlants = (s: GameState) => s.plants.reduce((n, p) => n + (p.alive ? 1 : 0), 0);

function chooseTarget(s: GameState, b: Bunny): number {
  let total = 0;
  const w: number[] = [];
  const a = aggression(s.t);
  // Bunnies get a bit more willing to gang up as they get greedier.
  const crowd = Math.min(1, TUNING.crowdWeight0 + 0.15 * a);
  s.plants.forEach((p, i) => {
    if (!p.alive) return w.push(0);
    const others = s.bunnies.filter((o) => o !== b && o.target === i && o.mode !== 'rest').length;
    const wi = (p.leaves + 2) * Math.pow(crowd, others);
    w.push(wi);
    total += wi;
  });
  if (total <= 0) return -1;
  let r = s.rng() * total;
  for (let i = 0; i < w.length; i++) {
    r -= w[i];
    if (r <= 0 && w[i] > 0) return i;
  }
  return w.findIndex((x) => x > 0);
}

function goToPlant(s: GameState, b: Bunny, i: number) {
  const used = new Set(s.bunnies.filter((o) => o !== b && o.target === i && o.mode !== 'rest').map((o) => o.slot));
  let slot = 0;
  while (used.has(slot) && slot < SLOTS.length - 1) slot++;
  b.slot = slot;
  b.target = i;
  b.tx = s.plants[i].x + SLOTS[slot].dx;
  b.td = SLOTS[slot].d;
  b.mode = 'hop';
}

function goRest(s: GameState, b: Bunny) {
  b.target = -1;
  b.tx = 0.08 + s.rng() * 0.84;
  b.td = 0.3 + s.rng() * 0.62;
  b.mode = 'hop';
}

/** Advance the game by dt seconds. `watering` is the plant index under the can, or -1. */
export function step(s: GameState, dt: number, watering: number) {
  if (s.over) return;
  s.t += dt;
  const T = TUNING;
  const a = aggression(s.t);

  // Plants.
  s.plants.forEach((p, i) => {
    if (!p.alive) return;
    const pour = i === watering ? T.waterRate : 0;
    p.moisture = Math.min(1, Math.max(0, p.moisture + (pour - T.moistureDecay) * dt));
    p.growth += (T.baseGrowth + T.waterGrowth * p.moisture) * dt;
    if (p.height < T.heightCap) {
      const before = p.height;
      p.height = Math.min(T.heightCap, p.height + T.heightRate * p.moisture * (0.3 + (0.7 * p.leaves) / T.maxLeaves) * dt);
      if (before < 1 && p.height >= 1) s.events.push({ type: 'tall', plant: i });
    }
    while (p.growth >= 1) {
      if (p.leaves >= T.maxLeaves) {
        p.growth = 1;
        break;
      }
      p.growth -= 1;
      p.leaves++;
      s.events.push({ type: 'grow', plant: i });
    }
  });

  // Bunnies.
  for (const b of s.bunnies) {
    if (b.mode === 'rest') {
      b.timer -= dt;
      if (b.timer <= 0) {
        const i = chooseTarget(s, b);
        if (i >= 0) {
          goToPlant(s, b, i);
          b.bitesLeft = mealBites(a, s.rng);
        } else b.timer = 1;
      }
    } else if (b.mode === 'hop') {
      // Retarget if the plant died on the way.
      if (b.target >= 0 && !s.plants[b.target].alive) {
        const i = chooseTarget(s, b);
        if (i >= 0) goToPlant(s, b, i);
        else goRest(s, b);
      }
      const dx = b.tx - b.x;
      const dd = (b.td - b.d) * 0.45;
      const dist = Math.hypot(dx, dd);
      const v = hopSpeed(a) * dt;
      if (dist > 0) {
        if (Math.abs(dx) > 0.004) b.face = dx > 0 ? 1 : -1;
        if (b.hop === 0) b.hopHigh = b.d >= 0 !== b.td >= 0; // crossing the fence: jump higher
        if (dist <= v || dist < 1e-4) {
          b.x = b.tx;
          b.d = b.td;
        } else {
          b.x += (dx / dist) * v;
          b.d += ((dd / dist) * v) / 0.45;
        }
      }
      const prevHop = b.hop;
      b.hop += dt / hopDuration(a);
      const arrived = b.x === b.tx && b.d === b.td;
      if (b.hop >= 1 || (arrived && prevHop === 0)) {
        if (b.hop >= 1) s.events.push({ type: 'land', bunny: b.id });
        b.hop = arrived ? 0 : b.hop % 1;
        if (arrived) {
          if (b.target >= 0) {
            const p = s.plants[b.target];
            if (p.alive) {
              b.mode = 'eat';
              b.biteTimer = biteInterval(a) * 0.7;
              b.face = p.x >= b.x ? 1 : -1;
              if (b.slot === 2) b.face = b.id % 2 ? -1 : 1;
            } else {
              const i = chooseTarget(s, b);
              if (i >= 0) goToPlant(s, b, i);
              else goRest(s, b);
            }
          } else {
            b.mode = 'rest';
            b.timer = restTime(a, s.rng);
          }
        }
      }
    } else if (b.mode === 'eat') {
      const p = s.plants[b.target];
      if (!p.alive) {
        if (b.bitesLeft > 0) {
          const i = chooseTarget(s, b);
          if (i >= 0) goToPlant(s, b, i);
          else goRest(s, b);
        } else goRest(s, b);
        continue;
      }
      b.biteTimer -= dt;
      if (b.biteTimer <= 0) {
        b.biteTimer += biteInterval(a);
        if (p.leaves > 0) {
          p.leaves--;
          b.bitesLeft--;
          s.events.push({ type: 'bite', plant: b.target, bunny: b.id });
          if (p.leaves === 0) {
            p.alive = false;
            p.moisture = 0;
            p.diedAt = s.t;
            s.events.push({ type: 'die', plant: b.target });
          }
        }
        if (b.bitesLeft <= 0 && p.alive) goRest(s, b);
      }
    }
  }

  const alive = alivePlants(s);
  if (alive === 0) {
    s.over = true;
    s.events.push({ type: 'over', won: false });
  } else if (s.plants.every((p) => !p.alive || p.height >= 1)) {
    s.over = true;
    s.won = true;
    s.events.push({ type: 'over', won: true });
  }
}
