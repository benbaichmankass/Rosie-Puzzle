// Turtle vs Bunny balance check: runs the real race simulation with simulated players.
//  - a perfectly steady turtle has exactly enough energy for one lap (ends nearly empty, never runs dry)
//  - a well-played bunny and a perfectly played turtle finish close together, and each side wins some races
//  - a careless bunny (runs until nearly empty, stops wherever it is) loses to a good turtle
//  - a lazy turtle (slow taps or rests) loses to a good bunny, and so does a turtle that rushes
import { GOOD_BUNNY, GOOD_TURTLE, bunnyBrain, mulberry, turtleBrain, type Brain } from '../src/games/yard-race/ai';
import { createRace, step } from '../src/games/yard-race/sim';
import { FOOD, LAP } from '../src/games/yard-race/track';

const DT = 1 / 120;
const SEEDS = 40;
let failed = false;
const check = (ok: boolean, msg: string) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!ok) failed = true;
};

/** Runs a head-to-head race; returns both finish times (Infinity if not finished in 150 s). */
function race(turtle: Brain, bunny: Brain) {
  const r = createRace(['turtle', 'bunny']);
  while (!r.over && r.t < 150) step(r, DT, [turtle.input(r.racers[0], r.t, DT), bunny.input(r.racers[1], r.t, DT)]);
  return {
    t: r.racers[0].finished ? r.racers[0].finishT : Infinity,
    b: r.racers[1].finished ? r.racers[1].finishT : Infinity,
    tEnergy: r.racers[0].energy,
    flops: 0,
  };
}

const perfectTurtle = () => turtleBrain({ pace: 1, jitter: 0 }, mulberry(1));
const goodTurtle = (s: number) => {
  const r = mulberry(s);
  return turtleBrain({ ...GOOD_TURTLE, pace: 0.97 + r() * 0.05, jitter: 0.08 + r() * 0.1 }, r);
};
/** Good bunny players differ a little: how precisely they let go, how quickly they react, how much they keep in reserve. */
const goodBunny = (s: number) => {
  const r = mulberry(1000 + s);
  return bunnyBrain({ ...GOOD_BUNNY, margin: 0.02 + r() * 0.05, aimErr: 4 + r() * 10, react: 0.1 + r() * 0.25 }, r);
};
const idleBunny = (): Brain => ({ input: () => ({ hold: false, taps: 0 }) });
const idleTurtle = (): Brain => ({ input: () => ({ hold: false, taps: 0 }) });

console.log(`lap ${LAP.toFixed(0)} units, ${FOOD.length} food spots`);

// 1. The perfect turtle: one lap on exactly one tank.
const solo = race(perfectTurtle(), idleBunny());
const T = solo.t;
console.log(`perfect turtle: ${T.toFixed(2)} s, ${(solo.tEnergy * 100).toFixed(1)}% energy left`);
check(solo.tEnergy > 0 && solo.tEnergy < 0.03, 'perfect turtle finishes with 0-3% energy left (exactly enough for one lap)');
check(T > 40 && T < 65, 'a lap takes 40-65 s');

// 2. Good bunny vs perfect turtle: close, both can win.
const goodTimes: number[] = [];
let bunnyWins = 0;
for (let s = 0; s < SEEDS; s++) {
  const r = race(perfectTurtle(), goodBunny(s));
  goodTimes.push(r.b);
  if (r.b < r.t) bunnyWins++;
}
const mean = goodTimes.reduce((a, b) => a + b, 0) / SEEDS;
const best = Math.min(...goodTimes);
const worst = Math.max(...goodTimes);
console.log(`good bunny: mean ${mean.toFixed(2)} s (best ${best.toFixed(2)}, worst ${worst.toFixed(2)}), beat the perfect turtle ${bunnyWins}/${SEEDS}`);
check(Math.abs(mean - T) < 1.5, 'good bunny finishes within 1.5 s of the perfect turtle on average');
check(bunnyWins >= SEEDS * 0.1 && bunnyWins <= SEEDS * 0.9, 'each side wins some of these races');

// 3. Good (human-like, adaptive) turtle vs good bunny: also close.
let gtWins = 0;
let gtGap = 0;
for (let s = 0; s < SEEDS; s++) {
  const r = race(goodTurtle(s), goodBunny(s));
  if (r.t < r.b) gtWins++;
  gtGap += r.t - r.b;
}
console.log(`good turtle vs good bunny: turtle won ${gtWins}/${SEEDS}, mean gap ${(gtGap / SEEDS).toFixed(2)} s`);
check(gtWins >= SEEDS * 0.1 && gtWins <= SEEDS * 0.9, 'good turtle vs good bunny is a contest');

// 4. A careless bunny loses to a good turtle.
let carelessLosses = 0;
let carelessMean = 0;
for (let s = 0; s < SEEDS; s++) {
  const r = race(goodTurtle(s), bunnyBrain({ careless: true, stopBelow: 0.08 + (s % 5) * 0.03 }, mulberry(s)));
  if (r.b > r.t) carelessLosses++;
  carelessMean += r.b / SEEDS;
}
console.log(`careless bunny: mean ${carelessMean.toFixed(2)} s, lost ${carelessLosses}/${SEEDS}`);
check(carelessLosses === SEEDS, 'a careless bunny always loses to a good turtle');

// A greedy bunny that always eats to full also loses.
let greedyLosses = 0;
for (let s = 0; s < SEEDS; s++) {
  const r = race(goodTurtle(s), bunnyBrain({ ...GOOD_BUNNY, fill: 1 }, mulberry(s)));
  if (r.b > r.t) greedyLosses++;
}
console.log(`greedy bunny (always eats to full): lost ${greedyLosses}/${SEEDS}`);
check(greedyLosses >= SEEDS * 0.9, 'a bunny that always eats to full loses');

// 5. A lazy turtle loses to a good bunny.
const lazies: [string, () => Brain][] = [
  ['slow taps (80% pace)', () => turtleBrain({ pace: 0.8, jitter: 0.1 }, mulberry(5))],
  ['rests 1 s in every 5', () => turtleBrain({ pace: 1, jitter: 0.1, rest: 1, restEvery: 5 }, mulberry(6))],
  ['rushes (130% pace)', () => turtleBrain({ pace: 1.3, jitter: 0.1 }, mulberry(7))],
];
for (const [name, mk] of lazies) {
  let losses = 0;
  let tm = 0;
  for (let s = 0; s < SEEDS; s++) {
    const r = race(mk(), goodBunny(s));
    if (r.t > r.b) losses++;
    tm += r.t / SEEDS;
  }
  console.log(`turtle that ${name}: ${tm.toFixed(2)} s, lost ${losses}/${SEEDS}`);
  check(losses >= SEEDS * 0.95, `a turtle that ${name} loses to a good bunny`);
}

// 6. Sanity: nobody finishes without input.
const none = race(idleTurtle(), idleBunny());
check(none.t === Infinity && none.b === Infinity, 'idle racers never finish');

if (failed) {
  console.error('yard-race balance check FAILED');
  process.exit(1);
}
console.log('yard-race balance check passed');
