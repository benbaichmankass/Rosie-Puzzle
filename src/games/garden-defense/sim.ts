/**
 * Garden Defense simulation. Goal (Ben's rules): water the 5 hedges until all of them grow tall enough to hide the
 * neighbours' apartment across the street (each hedge covers its own part of the view). Win when all five reach
 * height 1; lose as soon as the bunnies kill any hedge (the gap lets the neighbours see in).
 * From time to time two bunnies pair up (hearts); spray them to break it up, or a baby bunny pops out, grows up
 * and joins in.
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
  heightRate: 0.024,
  /** Hedges stop growing a little above the target. */
  heightCap: 1.06,

  /** Seconds for aggression to go from 0 to 1. It keeps rising after that. */
  ramp: 200,
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

  /** Breeding: first pair-up after this many seconds. */
  breedStart: 22,
  /** Gap between pair-ups at aggression 0 (shrinks as the bunnies get keener), and its floor. */
  breedGap0: 24,
  breedGapK: 0.7,
  breedGapMin: 8,
  /** Seconds a frisky pair takes to make a baby (the heart countdown). */
  breedTime: 7,
  /** Seconds of spraying that break a pair up. Partial spraying dries off slowly. */
  sprayTime: 0.7,
  sprayDry: 0.3,
  /** Seconds a baby takes to grow up and start eating, and its size at birth. */
  babyGrow: 7,
  babySize: 0.45,
  /** Never more bunnies than this (keeps the yard readable). */
  maxBunnies: 7,
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

export type BunnyMode = 'rest' | 'hop' | 'eat' | 'frisky';

export interface Bunny {
  id: number;
  /** Coat: 0 white, 1 black-and-white Dutch, 2 grey-and-white. */
  kind: number;
  /** 1 for adults; babies grow from TUNING.babySize. */
  size: number;
  /** Pair id while pairing up, else -1. */
  pair: number;
  /** Time it was last sprayed off (for the shake-off animation), or -99. */
  wetAt: number;
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
  | { type: 'frisky'; pair: number }
  | { type: 'splash'; pair: number }
  | { type: 'baby'; bunny: number }
  | { type: 'over'; won: boolean };

export interface GameState {
  t: number;
  plants: Plant[];
  bunnies: Bunny[];
  over: boolean;
  /** Set when the game ends with all five hedges at the target height. */
  won: boolean;
  pairs: Pair[];
  nextPair: number;
  pairCount: number;
  events: SimEvent[];
  rng: Rng;
}

/** Two bunnies pairing up in the yard. */
export interface Pair {
  id: number;
  a: number;
  b: number;
  x: number;
  d: number;
  /** Countdown to the baby; it only runs once both bunnies have arrived. */
  timer: number;
  started: boolean;
  /** 0..1 spray progress; 1 breaks the pair up. */
  wet: number;
}

/** Where on the bed each eating slot sits, relative to the plant. */
export const SLOTS = [
  { dx: -0.055, d: -0.085 },
  { dx: 0.055, d: -0.085 },
  { dx: 0.0, d: -0.03 },
  { dx: -0.07, d: -0.015 },
  { dx: 0.07, d: -0.015 },
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
    kind: id,
    size: 1,
    pair: -1,
    wetAt: -99,
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
  return { t: 0, plants, bunnies, over: false, won: false, events: [], rng, pairs: [], nextPair: TUNING.breedStart, pairCount: 0 };
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

export function breedGap(a: number, rng: Rng) {
  return Math.max(TUNING.breedGapMin, TUNING.breedGap0 / (1 + TUNING.breedGapK * a)) * (0.8 + 0.4 * rng());
}

/** Two grown bunnies drop what they are doing and pair up somewhere in the yard. */
function startPair(s: GameState) {
  const free = s.bunnies.filter((b) => b.pair < 0 && b.size >= 1);
  if (free.length < 2 || s.bunnies.length >= TUNING.maxBunnies) return false;
  const i = Math.floor(s.rng() * free.length);
  const a = free[i];
  free.splice(i, 1);
  // Partner: the nearest other free bunny.
  free.sort((p, q) => Math.hypot(p.x - a.x, p.d - a.d) - Math.hypot(q.x - a.x, q.d - a.d));
  const b = free[0];
  const pair: Pair = {
    id: s.pairCount++,
    a: a.id,
    b: b.id,
    x: Math.min(0.82, Math.max(0.18, (a.x + b.x) / 2)),
    d: 0.4 + s.rng() * 0.4,
    timer: TUNING.breedTime,
    started: false,
    wet: 0,
  };
  s.pairs.push(pair);
  for (const [bn, side] of [
    [a, -1],
    [b, 1],
  ] as const) {
    bn.pair = pair.id;
    bn.target = -1;
    bn.tx = pair.x + side * 0.035;
    bn.td = pair.d;
    bn.mode = 'hop';
  }
  s.events.push({ type: 'frisky', pair: pair.id });
  return true;
}

function endPair(s: GameState, pair: Pair, splashed: boolean) {
  s.pairs = s.pairs.filter((p) => p !== pair);
  for (const id of [pair.a, pair.b]) {
    const b = s.bunnies[id];
    b.pair = -1;
    if (splashed) b.wetAt = s.t;
    goRest(s, b);
  }
  s.nextPair = s.t + breedGap(aggression(s.t), s.rng);
}

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
  b.pair = -1;
  b.target = -1;
  b.tx = 0.08 + s.rng() * 0.84;
  b.td = 0.3 + s.rng() * 0.62;
  b.mode = 'hop';
}

/**
 * Advance the game by dt seconds. `watering` is the plant index under the can, or -1; `spray` is the id of the
 * pair being sprayed, or -1 (the can is over one or the other, never both).
 */
export function step(s: GameState, dt: number, watering: number, spray = -1) {
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
  // Pairing up.
  if (s.pairs.length === 0 && s.t >= s.nextPair) {
    if (!startPair(s)) s.nextPair = s.t + 1;
  }
  for (const pair of [...s.pairs]) {
    const a = s.bunnies[pair.a];
    const b = s.bunnies[pair.b];
    if (!pair.started && a.mode === 'frisky' && b.mode === 'frisky') pair.started = true;
    if (!pair.started) continue;
    if (spray === pair.id) pair.wet += dt / T.sprayTime;
    else pair.wet = Math.max(0, pair.wet - T.sprayDry * dt);
    if (pair.wet >= 1) {
      s.events.push({ type: 'splash', pair: pair.id });
      endPair(s, pair, true);
      continue;
    }
    pair.timer -= dt;
    if (pair.timer <= 0) {
      const baby: Bunny = {
        id: s.bunnies.length,
        kind: Math.floor(s.rng() * 3),
        size: T.babySize,
        pair: -1,
        wetAt: -99,
        x: pair.x,
        d: Math.min(0.95, pair.d + 0.06),
        mode: 'rest',
        tx: pair.x,
        td: pair.d,
        target: -1,
        slot: 0,
        timer: T.babyGrow,
        bitesLeft: 0,
        biteTimer: 0,
        hop: 0,
        hopHigh: false,
        face: s.rng() < 0.5 ? 1 : -1,
      };
      s.bunnies.push(baby);
      s.events.push({ type: 'baby', bunny: baby.id });
      endPair(s, pair, false);
    }
  }

  for (const b of s.bunnies) {
    if (b.size < 1) b.size = Math.min(1, b.size + ((1 - T.babySize) / T.babyGrow) * dt);
    if (b.mode === 'frisky') continue;
    if (b.mode === 'rest') {
      b.timer -= dt;
      if (b.timer <= 0 && b.size >= 1) {
        const i = chooseTarget(s, b);
        if (i >= 0) {
          goToPlant(s, b, i);
          b.bitesLeft = mealBites(a, s.rng);
        } else b.timer = 1;
      }
    } else if (b.mode === 'hop') {
      // Retarget if the plant died on the way.
      if (b.pair < 0 && b.target >= 0 && !s.plants[b.target].alive) {
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
          if (b.pair >= 0) {
            b.mode = 'frisky';
            const pr = s.pairs.find((q) => q.id === b.pair);
            b.face = pr && pr.x > b.x ? 1 : -1;
          } else if (b.target >= 0) {
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

  if (alivePlants(s) < s.plants.length) {
    s.over = true;
    s.events.push({ type: 'over', won: false });
  } else if (s.plants.every((p) => p.height >= 1)) {
    s.over = true;
    s.won = true;
    s.events.push({ type: 'over', won: true });
  }
}
