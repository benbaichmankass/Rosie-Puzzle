// Turtle vs Bunny balance check: runs the real race simulation with simulated HUMAN-like players.
//  - the turtle never runs out of energy before the finish, at any tapping speed (its bar is a lap gauge)
//  - human turtle (4-7 taps/s, irregular rhythm, hesitations, tiring thumb) vs the computer bunny: 35-65% wins
//  - human bunny (reasonable play, imperfect timing and meals) vs the computer turtle: 35-65% wins
//  - two players, good bunny vs good turtle: 35-65% wins
//  - a careless or greedy bunny loses to a good turtle; a lazy (slow-tapping) turtle loses to a good bunny
import { CPU_BUNNY, CPU_TURTLE, GOOD_BUNNY, bunnyBrain, mulberry, turtleBrain, type Brain, type Rng } from '../src/games/yard-race/ai';
import { createRace, step } from '../src/games/yard-race/sim';
import { FOOD, LAP } from '../src/games/yard-race/track';

const DT = 1 / 120;
const N = 80;
let failed = false;
const check = (ok: boolean, msg: string) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!ok) failed = true;
};

/** Head-to-head race. Also reports the turtle's lowest energy while still short of the line. */
function race(turtle: Brain, bunny: Brain) {
  const r = createRace(['turtle', 'bunny']);
  let minE = 1;
  while (!r.over && r.t < 150) {
    step(r, DT, [turtle.input(r.racers[0], r.t, DT), bunny.input(r.racers[1], r.t, DT)]);
    const tu = r.racers[0];
    if (!tu.finished && tu.s < LAP * 0.995) minE = Math.min(minE, tu.energy);
  }
  return { t: r.racers[0].finished ? r.racers[0].finishT : Infinity, b: r.racers[1].finished ? r.racers[1].finishT : Infinity, minE };
}

const between = (r: Rng, a: number, b: number) => a + r() * (b - a);

/** A human tapping the turtle pad: 4-7 taps a second, uneven gaps, the odd hesitation, a tiring thumb. */
const humanTurtle = (r: Rng, lo = 4, hi = 7) =>
  turtleBrain({ rate: between(r, lo, hi), jitter: between(r, 0.2, 0.45), pauseEvery: between(r, 6, 12), pauseLen: between(r, 0.2, 0.6), fatigue: between(r, 0, 0.15) }, r);
/** A human playing the bunny reasonably: imperfect let-go timing, slowish reactions, misjudged meals. */
const humanBunny = (r: Rng) =>
  bunnyBrain({ ...GOOD_BUNNY, margin: between(r, 0.02, 0.07), aimErr: between(r, 4, 16), react: between(r, 0.15, 0.45), sloppy: between(r, 0, 0.15) }, r);
/** A good bunny player (2-player mode). */
const goodBunny = (r: Rng) => bunnyBrain({ ...GOOD_BUNNY, margin: between(r, 0.02, 0.05), aimErr: between(r, 3, 10), react: between(r, 0.1, 0.25), sloppy: between(r, 0, 0.08) }, r);
/** A good turtle player (2-player mode): brisk, fairly even tapping. */
const goodTurtle = (r: Rng) => turtleBrain({ rate: between(r, 5, 7), jitter: between(r, 0.15, 0.35), pauseEvery: 10, pauseLen: 0.3, fatigue: between(r, 0, 0.1) }, r);

function matchup(name: string, mk: (r: Rng) => [Brain, Brain]) {
  let tw = 0;
  let tt = 0;
  let bt = 0;
  let minE = 1;
  for (let s = 0; s < N; s++) {
    const r = mulberry(7919 * (s + 1) + name.length);
    const [t, b] = mk(r);
    const res = race(t, b);
    if (res.t < res.b) tw++;
    tt += res.t / N;
    bt += res.b / N;
    minE = Math.min(minE, res.minE);
  }
  const rate = tw / N;
  console.log(`${name}: turtle wins ${tw}/${N} (${Math.round(rate * 100)}%), mean turtle ${tt.toFixed(1)} s, bunny ${bt.toFixed(1)} s`);
  return { rate, minE };
}

console.log(`lap ${LAP.toFixed(0)} units, ${FOOD.length} food spots`);

// 1. The turtle never runs dry before the line, from a slow 2 taps/s to a frantic 14.
let lowest = 1;
for (const rate of [2, 3, 4, 5, 6, 7, 8, 10, 12, 14])
  for (let s = 0; s < 6; s++) {
    const r = mulberry(100 * rate + s);
    const res = race(turtleBrain({ rate, jitter: s * 0.08, pauseEvery: 8, pauseLen: 0.5, fatigue: 0.1 }, r), { input: () => ({ hold: false, taps: 0 }) });
    lowest = Math.min(lowest, res.minE);
    if (!(res.t < Infinity)) lowest = -1;
  }
check(lowest > 0, `turtle energy never hits zero before the finish at 2-14 taps/s (lowest ${(lowest * 100).toFixed(1)}% just before the line)`);

// 2. The three matchups people actually play.
const a = matchup('human turtle (4-7 taps/s) vs CPU bunny', (r) => [humanTurtle(r), bunnyBrain(CPU_BUNNY, r)]);
check(a.rate >= 0.35 && a.rate <= 0.65, 'human turtle vs CPU bunny is close (35-65%)');
const b = matchup('human bunny vs CPU turtle', (r) => [turtleBrain(CPU_TURTLE, r), humanBunny(r)]);
check(b.rate >= 0.35 && b.rate <= 0.65, 'human bunny vs CPU turtle is close (35-65%)');
const c = matchup('2 players: good turtle vs good bunny', (r) => [goodTurtle(r), goodBunny(r)]);
check(c.rate >= 0.35 && c.rate <= 0.65, 'good turtle vs good bunny is close (35-65%)');
check(Math.min(a.minE, b.minE, c.minE) > 0, 'no turtle ran out of energy in any matchup');

// 3. Effort and tactics matter.
const slow = matchup('lazy turtle (2.5-3.5 taps/s) vs good bunny', (r) => [humanTurtle(r, 2.5, 3.5), goodBunny(r)]);
check(slow.rate <= 0.05, 'a lazy turtle loses to a good bunny');
const fast = matchup('fast turtle (7-9 taps/s) vs human bunny', (r) => [humanTurtle(r, 7, 9), humanBunny(r)]);
check(fast.rate >= 0.6, 'a fast, keen turtle usually beats a casual bunny');
const careless = matchup('good turtle vs careless bunny', (r) => [goodTurtle(r), bunnyBrain({ careless: true, stopBelow: between(r, 0.05, 0.2) }, r)]);
check(careless.rate >= 0.95, 'a careless bunny (runs until empty, stops anywhere) loses');
const greedy = matchup('good turtle vs greedy bunny (always eats to full)', (r) => [goodTurtle(r), bunnyBrain({ ...GOOD_BUNNY, fill: 1 }, r)]);
check(greedy.rate >= 0.9, 'a bunny that always eats to full loses');

// 4. Nobody finishes without input.
const none = race({ input: () => ({ hold: false, taps: 0 }) }, { input: () => ({ hold: false, taps: 0 }) });
check(none.t === Infinity && none.b === Infinity, 'idle racers never finish');

if (failed) {
  console.error('yard-race balance check FAILED');
  process.exit(1);
}
console.log('yard-race balance check passed');
