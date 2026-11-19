/**
 * Computer players (also used by scripts/check-yard-race.ts as simulated humans). Pure TS.
 */
import { BUNNY_COST, TUNING, brakeDistance, type Input, type Racer } from './sim';
import { FOOD, LAP, foodAt, nextFood } from './track';

export type Rng = () => number;

export function mulberry(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Brain {
  input(r: Racer, t: number, dt: number): Input;
}

// ---------------------------------------------------------------- turtle

export interface TurtleSkill {
  /** Tap rate as a multiple of the ideal steady pace. */
  pace: number;
  /** Random timing wobble of each tap, as a fraction of the interval. */
  jitter: number;
  /** Seconds of rest taken every `restEvery` seconds (a lazy player). */
  rest?: number;
  restEvery?: number;
  /** Speeds up when it has spare energy and eases off when the tank runs low (a thinking player). */
  adaptive?: boolean;
}

export function turtleBrain(skill: TurtleSkill, rng: Rng): Brain {
  let next = 0;
  return {
    input(r, t) {
      if (skill.rest && skill.restEvery && t % skill.restEvery > skill.restEvery - skill.rest) {
        next = t + 0.05;
        return { hold: false, taps: 0 };
      }
      if (t < next) return { hold: false, taps: 0 };
      let pace = skill.pace;
      if (skill.adaptive) {
        // ideal: energy left matches the share of the lap left
        const want = 1 - r.s / LAP;
        pace *= 1 + Math.max(-0.08, Math.min(0.08, (r.energy - want) * 0.8));
      }
      const iv = 1 / (TUNING.turtlePace * pace);
      next = Math.max(next, t - iv) + iv * (1 + (rng() * 2 - 1) * skill.jitter);
      return { hold: false, taps: 1 };
    },
  };
}

// ---------------------------------------------------------------- bunny

export interface BunnySkill {
  /** Energy kept in reserve when planning. */
  margin: number;
  /** How many food spots ahead it fuels up for (1 = just the next one). */
  look: number;
  /** Also eats at least up to this level at every stop. */
  fill: number;
  /** Error (world units) in where it lets go, either way. */
  aimErr: number;
  /** Seconds of reaction delay when leaving a food spot. */
  react: number;
}

/** A careless bunny: runs until nearly empty, then stops wherever it is, eats until full. */
export interface CarelessSkill {
  careless: true;
  stopBelow: number;
}

const center = (i: number) => (FOOD[i].s0 + FOOD[i].s1) / 2;

export function bunnyBrain(skill: BunnySkill | CarelessSkill, rng: Rng): Brain {
  if ('careless' in skill) {
    let eating = false;
    return {
      input(r) {
        if (r.state === 'flop') return { hold: false, taps: 0 };
        if (r.state === 'eat' || r.state === 'sit') {
          eating = r.energy < 0.98;
          return { hold: !eating, taps: 0 };
        }
        if (r.state === 'wait') return { hold: true, taps: 0 }; // stopped off a food spot: give up and run on
        return { hold: r.energy > skill.stopBelow || foodAt(r.s + brakeDistance(r.v)) < 0, taps: 0 };
      },
    };
  }

  let stopAt = -2; // -2: not planned yet; -1: run to the finish
  let aim = 0;
  let leaveAt = 1;
  let leaveDelay = 0;
  let wasStopped = false;

  /** Farthest target reachable with `e` energy from s (finish = -1). */
  const plan = (s: number, e: number) => {
    if ((LAP - s) * BUNNY_COST + skill.margin * 0.5 <= e) return -1;
    let best = nextFood(s + 1);
    for (let i = best; i >= 0 && i < FOOD.length; i++) {
      if ((center(i) - s) * BUNNY_COST + skill.margin <= e) best = i;
      else break;
    }
    return best;
  };
  const setAim = () => {
    aim = stopAt >= 0 ? center(stopAt) + (rng() * 2 - 1) * skill.aimErr : LAP + 100;
  };
  /** Energy to leave food spot i with. */
  const fuelFor = (i: number, s: number) => {
    const target = i + skill.look;
    const finishCost = (LAP - s) * BUNNY_COST + skill.margin * 0.5;
    let need: number;
    if (target >= FOOD.length) need = finishCost;
    else need = Math.min(finishCost, (center(target) - s) * BUNNY_COST + skill.margin);
    return Math.min(0.995, Math.max(skill.fill, need));
  };

  return {
    input(r, t, dt) {
      if (stopAt === -2) {
        stopAt = plan(r.s, r.energy);
        setAim();
      }
      if (r.state === 'flop') {
        wasStopped = true;
        return { hold: false, taps: 0 };
      }
      if (r.state === 'sit' || r.state === 'eat') {
        if (!wasStopped) {
          wasStopped = true;
          leaveAt = fuelFor(r.food, r.s);
          leaveDelay = skill.react * (0.5 + rng());
        }
        if (r.energy >= leaveAt) {
          leaveDelay -= dt;
          if (leaveDelay <= 0) {
            wasStopped = false;
            stopAt = plan(r.s, r.energy);
            setAim();
            return { hold: true, taps: 0 };
          }
        }
        return { hold: false, taps: 0 };
      }
      if (r.state === 'wait') {
        // stopped short of / past a spot, or just got up from a flop: re-plan and go
        wasStopped = false;
        stopAt = plan(r.s, r.energy);
        if (stopAt >= 0 && center(stopAt) < r.s) stopAt = nextFood(r.s);
        setAim();
        return { hold: true, taps: 0 };
      }
      // running
      if (stopAt >= 0 && r.s >= FOOD[stopAt].s1) {
        // overshot: aim for the next one
        stopAt = nextFood(r.s);
        setAim();
      }
      if (stopAt >= 0 && r.s + brakeDistance(r.v) >= aim) return { hold: false, taps: 0 };
      void t;
      return { hold: true, taps: 0 };
    },
  };
}

/** The good-player profile used for balance and the strongest computer opponent. */
export const GOOD_BUNNY: BunnySkill = { margin: 0.04, look: 1, fill: 0, aimErr: 8, react: 0.15 };
export const GOOD_TURTLE: TurtleSkill = { pace: 1, jitter: 0.12, adaptive: true };
