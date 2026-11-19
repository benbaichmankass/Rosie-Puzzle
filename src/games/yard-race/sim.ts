/**
 * Turtle vs Bunny race simulation. Pure TS (no DOM) so scripts/check-yard-race.ts can run it.
 *
 * Turtle: TAP to take a step. Every step gives a shove of speed that fades; energy burns with speed squared,
 * so a steady rhythm goes furthest per unit of energy. The tank holds exactly one lap at the steady pace
 * (TUNING.turtlePace taps a second). Rushing empties it early and the last stretch is a weary crawl.
 *
 * Bunny: HOLD to run, much faster than the turtle, but the tank only lasts about a quarter of a lap.
 * Let go inside a food spot to stop and eat: energy refills, fastest when the tank is low. Let go anywhere else
 * and the bunny just waits. Run the tank dry and the bunny flops over and recovers slowly.
 */
import { FOOD, LAP, foodAt } from './track';

export const TUNING = {
  // turtle
  turtleShove: 20, // speed added by one step (world units / s)
  turtleTau: 0.55, // seconds for the speed to fade by 1/e
  turtleMax: 60, // speed cap
  turtlePace: 2.6, // taps per second of the ideal steady rhythm
  turtleCrawl: 7, // speed cap once the tank is empty
  // bunny
  bunnySpeed: 74,
  bunnyAccel: 320,
  bunnyBrake: 900,
  bunnyRange: 0.27, // fraction of a lap one full tank lasts at full speed
  bunnySit: 0.3, // seconds to settle before eating starts
  bunnyEat: 0.125, // energy per second while eating at an empty tank...
  bunnyEatFull: 0.04, // ...falling to this near a full tank
  bunnyFlopRegen: 0.07, // energy per second while flopped
  bunnyFlopUntil: 0.3, // energy needed to get back up
};

export type Kind = 'turtle' | 'bunny';
export type BunnyState = 'run' | 'wait' | 'sit' | 'eat' | 'flop';

export interface Racer {
  kind: Kind;
  s: number;
  v: number;
  energy: number; // 0..1
  state: BunnyState; // turtles stay 'run'
  timer: number; // sit / flop timer
  finished: boolean;
  finishT: number;
  steps: number; // turtle step counter (animation)
  lastStep: number; // time of the last step
  food: number; // food spot being eaten, -1 if none
  eaten: number; // total energy eaten (stats)
}

export interface Input {
  /** Bunny: finger down. */
  hold: boolean;
  /** Turtle: taps since the previous step. */
  taps: number;
}

export type RaceEvent =
  | { type: 'step'; who: number }
  | { type: 'eat-start'; who: number; food: number }
  | { type: 'eat-stop'; who: number }
  | { type: 'flop'; who: number }
  | { type: 'up'; who: number }
  | { type: 'tired'; who: number }
  | { type: 'finish'; who: number; first: boolean };

export interface Race {
  t: number;
  racers: Racer[];
  events: RaceEvent[];
  over: boolean;
  winner: number; // index into racers, -1 until someone finishes
}

/** Turtle energy burned per second at speed v. */
const turtleK = { k: 1 };

/**
 * Calibrates the turtle's burn so a perfectly steady tapper at TUNING.turtlePace ends the lap with an
 * (almost) empty tank: "exactly enough energy for one lap".
 */
function calibrateTurtle() {
  turtleK.k = 1;
  const dt = 1 / 120;
  const r = newRacer('turtle');
  r.energy = 1e9;
  let t = 0;
  let next = 0;
  let burned = 0;
  while (r.s < LAP && t < 600) {
    let taps = 0;
    if (t >= next) {
      taps = 1;
      next += 1 / TUNING.turtlePace;
    }
    const before = r.energy;
    stepTurtle(r, dt, taps, t, null, 0);
    burned += before - r.energy;
    t += dt;
  }
  turtleK.k = 1 / (burned * 1.015);
}

export function newRacer(kind: Kind): Racer {
  return { kind, s: 0, v: 0, energy: 1, state: 'run', timer: 0, finished: false, finishT: 0, steps: 0, lastStep: -9, food: -1, eaten: 0 };
}

export function createRace(kinds: Kind[] = ['turtle', 'bunny']): Race {
  return { t: 0, racers: kinds.map(newRacer), events: [], over: false, winner: -1 };
}

function stepTurtle(r: Racer, dt: number, taps: number, t: number, ev: RaceEvent[] | null, who: number) {
  const T = TUNING;
  if (taps > 0) {
    for (let i = 0; i < taps; i++) r.v = Math.min(T.turtleMax, r.v + T.turtleShove);
    r.steps += taps;
    r.lastStep = t;
    ev?.push({ type: 'step', who });
  }
  r.v *= Math.exp(-dt / T.turtleTau);
  if (r.energy <= 0) r.v = Math.min(r.v, T.turtleCrawl);
  const burn = turtleK.k * r.v * r.v * dt;
  if (r.energy > 0) {
    r.energy -= burn;
    if (r.energy <= 0) {
      r.energy = 0;
      ev?.push({ type: 'tired', who });
    }
  }
  r.s += r.v * dt;
}

/** Energy one unit of bunny running costs. */
export const BUNNY_COST = 1 / (TUNING.bunnyRange * LAP);

/** Eating rate at a given energy level. */
export function eatRate(energy: number): number {
  return TUNING.bunnyEat + (TUNING.bunnyEatFull - TUNING.bunnyEat) * energy;
}

/** Distance the bunny slides after letting go at speed v. */
export function brakeDistance(v: number): number {
  return (v * v) / (2 * TUNING.bunnyBrake);
}

function stepBunny(r: Racer, dt: number, hold: boolean, ev: RaceEvent[] | null, who: number) {
  const T = TUNING;
  if (r.state === 'flop') {
    r.v = 0;
    r.energy = Math.min(1, r.energy + T.bunnyFlopRegen * dt);
    if (r.energy >= T.bunnyFlopUntil) {
      r.state = 'wait';
      ev?.push({ type: 'up', who });
    }
    return;
  }
  if (hold) {
    if (r.state === 'eat' || r.state === 'sit') ev?.push({ type: 'eat-stop', who });
    r.state = 'run';
    r.food = -1;
    r.v = Math.min(T.bunnySpeed, r.v + T.bunnyAccel * dt);
  } else if (r.v > 0) {
    r.v = Math.max(0, r.v - T.bunnyBrake * dt);
  }
  if (r.v > 0) {
    const d = r.v * dt;
    r.s += d;
    r.energy -= d * BUNNY_COST;
    if (r.energy <= 0) {
      r.energy = 0;
      r.v = 0;
      r.state = 'flop';
      r.food = -1;
      ev?.push({ type: 'flop', who });
      return;
    }
  }
  if (!hold && r.v === 0) {
    if (r.state === 'run') {
      const f = foodAt(r.s);
      if (f >= 0) {
        r.state = 'sit';
        r.timer = T.bunnySit;
        r.food = f;
      } else r.state = 'wait';
    }
    if (r.state === 'sit') {
      r.timer -= dt;
      if (r.timer <= 0) {
        r.state = 'eat';
        ev?.push({ type: 'eat-start', who, food: r.food });
      }
    } else if (r.state === 'eat') {
      const add = Math.min(1 - r.energy, eatRate(r.energy) * dt);
      r.energy += add;
      r.eaten += add;
    }
  }
}

/** Advance the race by dt seconds. `inputs[i]` drives racer i. */
export function step(race: Race, dt: number, inputs: Input[]) {
  if (race.over) return;
  race.t += dt;
  race.racers.forEach((r, i) => {
    if (r.finished) {
      // coast to a stop past the line
      r.v *= Math.exp(-dt * 3);
      r.s += r.v * dt;
      if (r.kind === 'bunny' && r.state !== 'flop') r.state = r.v > 5 ? 'run' : 'wait';
      return;
    }
    const inp = inputs[i] ?? { hold: false, taps: 0 };
    const s0 = r.s;
    if (r.kind === 'turtle') stepTurtle(r, dt, inp.taps, race.t, race.events, i);
    else stepBunny(r, dt, inp.hold, race.events, i);
    if (r.s >= LAP) {
      // interpolate the exact crossing time
      const frac = r.s > s0 ? (LAP - s0) / (r.s - s0) : 1;
      r.finishT = race.t - dt + dt * frac;
      r.finished = true;
      const first = race.winner < 0;
      if (first) race.winner = i;
      else if (r.finishT < race.racers[race.winner].finishT) race.winner = i; // same-frame photo finish
      race.events.push({ type: 'finish', who: i, first });
    }
  });
  if (race.racers.every((r) => r.finished)) race.over = true;
}

/** Progress 0..1 around the lap. */
export const progress = (r: Racer) => Math.min(1, r.s / LAP);

export { FOOD, LAP };

calibrateTurtle();
