// Garden Defense balance check: runs the real simulation with simulated players. Goal: grow every surviving
// hedge to the target height (hiding the apartments across the street) before the bunnies eat them all.
// An idle player must lose, a careless one should mostly lose, and a good player should win in about 2-3 minutes.
// The bunnies keep getting greedier, so every game ends.
import { createGame, step, TUNING, type GameState } from '../src/games/garden-defense/sim';

const DT = 1 / 30;
const LIMIT = 900; // seconds; a game still going after this means the difficulty never catches up
const SEEDS = 120;

type Mem = { cur: number; until: number; next?: number };
type Player = (s: GameState, mem: Mem) => number;

/** Never waters. */
const idle: Player = () => -1;

/** Taps a random plant for half a second, then lifts the finger for a second. */
const careless: Player = (s, mem) => {
  if (s.t >= mem.until) {
    if (mem.cur >= 0) {
      mem.cur = -1;
      mem.until = s.t + 1.0;
    } else {
      mem.cur = Math.floor(s.rng() * TUNING.plantCount);
      mem.until = s.t + 0.5;
    }
  }
  return mem.cur;
};

/** Mindlessly sweeps the can along the hedges, 0.5 s on each (0.15 s of that sliding over), ignoring the bunnies. */
const rotator: Player = (s) => (s.t % 0.5 < 0.15 ? -1 : Math.floor(s.t / 0.5) % TUNING.plantCount);

/**
 * A good player: re-decides every 0.35 s (human reaction). Rushes to a hedge a bunny is eating once its soil
 * dries; otherwise sweeps the can over the hedges that still need to grow, driest first, skipping the ones
 * already tall enough. Moving the can takes 0.15 s.
 */
const good: Player = (s, mem) => {
  if (s.t < mem.until) return mem.cur;
  let best = -1;
  let score = -Infinity;
  s.plants.forEach((p, i) => {
    if (!p.alive) return;
    const eaters = s.bunnies.filter((b) => b.target === i && b.mode === 'eat').length;
    const threat = eaters * (1 + (TUNING.maxLeaves - p.leaves) / 3);
    const grow = p.height < 1 ? 1 : 0.1;
    const sc = (1 - p.moisture) * (grow + threat * 2) + (i === mem.cur ? 0.15 : 0);
    if (sc > score) {
      score = sc;
      best = i;
    }
  });
  const switching = best !== mem.cur;
  mem.until = s.t + 0.35 + (switching ? 0.15 : 0);
  mem.cur = switching ? -1 : best; // finger in transit while switching
  if (switching) mem.next = best;
  return mem.cur;
};

function play(player: Player, seed: number) {
  const s = createGame(seed);
  const mem: Mem = { cur: -1, until: 0 };
  while (!s.over && s.t < LIMIT) {
    let w = player(s, mem);
    if (w === -1 && mem.next !== undefined && s.t >= mem.until - 0.35) {
      mem.cur = mem.next;
      mem.next = undefined;
      w = mem.cur;
    }
    step(s, DT, w);
    s.events.length = 0;
  }
  return { time: s.t, won: s.won, saved: s.plants.filter((p) => p.alive).length, finished: s.over };
}

function stats(name: string, player: Player) {
  const t0 = performance.now();
  const runs = Array.from({ length: SEEDS }, (_, i) => play(player, 1000 + i * 7919));
  const med = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[xs.length >> 1] : NaN);
  const wins = runs.filter((r) => r.won);
  const losses = runs.filter((r) => r.finished && !r.won);
  const winRate = wins.length / SEEDS;
  const winTime = med(wins.map((r) => r.time));
  const lossTime = med(losses.map((r) => r.time));
  const saved = wins.reduce((n, r) => n + r.saved, 0) / Math.max(1, wins.length);
  const unfinished = runs.filter((r) => !r.finished).length;
  console.log(
    `${name.padEnd(9)} wins ${(winRate * 100).toFixed(0).padStart(3)}%  median win ${winTime.toFixed(0)}s (hedges saved ${saved.toFixed(1)})  ` +
      `median loss ${lossTime.toFixed(0)}s  never-ending ${unfinished}  (${(performance.now() - t0).toFixed(0)}ms)`,
  );
  return { winRate, winTime, lossTime, saved, unfinished };
}

const I = stats('idle', idle);
const C = stats('careless', careless);
const R = stats('rotator', rotator);
const G = stats('good', good);

const fails: string[] = [];
if (I.winRate > 0) fails.push('an idle player must never win');
if (I.lossTime < 25 || I.lossTime > 90) fails.push(`an idle player should lose in 25-90 s (median ${I.lossTime.toFixed(0)})`);
if (C.winRate > 0.3) fails.push(`careless tapping should mostly lose (wins ${(C.winRate * 100).toFixed(0)}%)`);
if (G.winRate < 0.85) fails.push(`a good player should win at least 85% of games (wins ${(G.winRate * 100).toFixed(0)}%)`);
if (!(G.winTime >= 110 && G.winTime <= 190)) fails.push(`a good player should win in about 2-3 minutes: median 110-190 s (got ${G.winTime.toFixed(0)})`);
// Results rank by hedges saved first, so skill shows as more wins or more hedges saved than sweeping the can.
if (G.winRate < R.winRate + 0.25 && G.saved < R.saved + 0.6)
  fails.push(`watering where it is needed must clearly beat mindlessly sweeping the can (saved ${G.saved.toFixed(1)} vs ${R.saved.toFixed(1)})`);
if (G.unfinished + C.unfinished + I.unfinished + R.unfinished > 0) fails.push('every game must end (difficulty must keep rising)');

if (fails.length) {
  console.error('FAIL:\n  ' + fails.join('\n  '));
  process.exit(1);
}
console.log('garden-defense balance OK');
