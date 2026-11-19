/**
 * Turtle vs Bunny race simulation. Pure TS (no DOM) so scripts/check-yard-race.ts can run it.
 *
 * Turtle: TAP to take steps. Every step gives a shove of speed that quickly fades, up to a top speed, so the
 * faster and steadier you tap, the faster it goes. Its energy bar is a lap gauge: energy is spent per distance
 * walked, and the tank holds exactly one lap, so the turtle never runs out (Ben: "the turtle has enough energy to
 * make one full circle"). The challenge is keeping up a fast rhythm for the whole lap.
 *
 * Bunny: HOLD to run, much faster than the turtle, but the tank only lasts about a quarter of a lap.
 * Let go inside a food spot to stop and eat: energy refills, fastest when the tank is low. Let go anywhere else
 * and the bunny just waits. Run the tank dry and the bunny flops over and recovers slowly.
 */
import { FOOD, LAP, foodAt } from './track';

export const TUNING = {
  // turtle
  turtleMax: 31.4, // top speed (world units / s), approached as the tap rate rises
  turtleRate0: 2.6, // tap rate scale of the speed curve: speed = max * (1 - exp(-rate / rate0))
  turtleBeat: 0.35, // how quickly the felt tap rate follows each new tap (0..1)
  turtleEase: 0.25, // seconds for the speed to catch up with the tap rate
  turtlePace: 6, // a brisk tapping rate (taps per second); used for hints and the walk animation
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
  beat: number; // turtle: smoothed taps per second
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
  | { type: 'finish'; who: number; first: boolean };

export interface Race {
  t: number;
  racers: Racer[];
  events: RaceEvent[];
  over: boolean;
  winner: number; // index into racers, -1 until someone finishes
}

export function newRacer(kind: Kind): Racer {
  return { kind, s: 0, v: 0, energy: 1, state: 'run', timer: 0, finished: false, finishT: 0, steps: 0, beat: 0, lastStep: -9, food: -1, eaten: 0 };
}

export function createRace(kinds: Kind[] = ['turtle', 'bunny']): Race {
  return { t: 0, racers: kinds.map(newRacer), events: [], over: false, winner: -1 };
}

/** Turtle speed for a given tap rate. */
export function turtleSpeedAt(rate: number): number {
  return TUNING.turtleMax * (1 - Math.exp(-Math.max(0, rate) / TUNING.turtleRate0));
}

function stepTurtle(r: Racer, dt: number, taps: number, t: number, ev: RaceEvent[] | null, who: number) {
  const T = TUNING;
  if (taps > 0) {
    const gap = Math.max(1 / 14, t - r.lastStep);
    const inst = r.lastStep < 0 ? 3 : Math.min(14, 1 / gap);
    r.beat += (inst - r.beat) * T.turtleBeat;
    r.steps += taps;
    r.lastStep = t;
    ev?.push({ type: 'step', who });
  }
  // stop tapping and the felt rate falls away
  const rate = Math.min(r.beat, 1 / Math.max(1e-3, t - r.lastStep));
  const target = turtleSpeedAt(rate);
  r.v += (target - r.v) * Math.min(1, dt / T.turtleEase);
  r.s += r.v * dt;
  // lap gauge: one tank = one lap, spent per distance, so it can never run out before the line
  r.energy = Math.max(0, 1 - r.s / LAP);
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

