// Garden Defense balance check: runs the real simulation with simulated players. Goal: grow all five hedges to
// the target height (hiding the neighbours' windows) before the bunnies kill any of them. Bunnies also pair up
// from time to time; unless sprayed, a pair makes a baby that joins in.
// An idle player must lose, a careless one should mostly lose, and a good player should win in about 2-3 minutes.
// The bunnies keep getting greedier, so every game ends.
import { createGame, step, TUNING, type GameState } from '../src/games/garden-defense/sim';

const DT = 1 / 30;
const LIMIT = 900; // seconds; a game still going after this means the difficulty never catches up
const SEEDS = 120;

type Mem = { cur: number; until: number; next?: number };
/** A player returns the hedge to water, SPRAY + pair id to spray a frisky pair, or -1. */
type Player = (s: GameState, mem: Mem) => number;
const SPRAY = 100;

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
 * A good player: re-decides every 0.35 s (human reaction). Sprays a frisky pair as soon as it settles, unless a
 * hedge is about to be eaten bare. Rushes to a hedge a bunny is eating once its soil dries; otherwise sweeps the can
 * over the hedges that still need to grow, driest first, skipping the ones already tall enough. Moving the can
 * takes 0.15 s.
 */
const good: Player = (s, mem) => {
  if (s.t < mem.until) return mem.cur;
  let best = -1;
  let score = -Infinity;
  const pair = s.pairs.find((p) => p.started);
  if (pair) {
    best = SPRAY + pair.id;
    score = 1.2;
  }
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

/** The same good player, but it never sprays the frisky bunnies: shows that breeding is a real threat. */
const noSpray: Player = (s, mem) => {
  const pairs = s.pairs;
  s.pairs = [];
  const w = good(s, mem);
  s.pairs = pairs;
  return w;
};

function play(player: Player, seed: number) {
  const s = createGame(seed);
  const mem: Mem = { cur: -1, until: 0 };
  let babies = 0;
  while (!s.over && s.t < LIMIT) {
    let w = player(s, mem);
    if (w === -1 && mem.next !== undefined && s.t >= mem.until - 0.35) {
      mem.cur = mem.next;
      mem.next = undefined;
      w = mem.cur;
    }
    if (w >= SPRAY) step(s, DT, -1, w - SPRAY);
    else step(s, DT, w);
    babies += s.events.filter((e) => e.type === 'baby').length;
    s.events.length = 0;
  }
  return { time: s.t, won: s.won, babies, finished: s.over };
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
  const babies = runs.reduce((n, r) => n + r.babies, 0) / SEEDS;
  const unfinished = runs.filter((r) => !r.finished).length;
  console.log(
    `${name.padEnd(9)} wins ${(winRate * 100).toFixed(0).padStart(3)}%  median win ${winTime.toFixed(0)}s  babies/game ${babies.toFixed(1)}  ` +
      `median loss ${lossTime.toFixed(0)}s  never-ending ${unfinished}  (${(performance.now() - t0).toFixed(0)}ms)`,
  );
  return { winRate, winTime, lossTime, babies, unfinished };
}

const I = stats('idle', idle);
const C = stats('careless', careless);
const R = stats('rotator', rotator);
const G = stats('good', good);
const N = stats('no-spray', noSpray);

const fails: string[] = [];
if (I.winRate > 0) fails.push('an idle player must never win');
if (I.lossTime < 25 || I.lossTime > 90) fails.push(`an idle player should lose in 25-90 s (median ${I.lossTime.toFixed(0)})`);
if (C.winRate > 0.3) fails.push(`careless tapping should mostly lose (wins ${(C.winRate * 100).toFixed(0)}%)`);
if (G.winRate < 0.85) fails.push(`a good player should win at least 85% of games (wins ${(G.winRate * 100).toFixed(0)}%)`);
if (!(G.winTime >= 110 && G.winTime <= 190)) fails.push(`a good player should win in about 2-3 minutes: median 110-190 s (got ${G.winTime.toFixed(0)})`);
if (G.winRate < R.winRate + 0.25)
  fails.push(
    `watering where it is needed must clearly beat mindlessly sweeping the can (wins ${(G.winRate * 100).toFixed(0)}% vs ${(R.winRate * 100).toFixed(0)}%)`,
  );
if (N.winRate > G.winRate - 0.3) fails.push(`ignoring the frisky bunnies must cost a lot (no-spray wins ${(N.winRate * 100).toFixed(0)}%)`);
if (G.unfinished + C.unfinished + I.unfinished + R.unfinished + N.unfinished > 0) fails.push('every game must end (difficulty must keep rising)');

if (fails.length) {
  console.error('FAIL:\n  ' + fails.join('\n  '));
  process.exit(1);
}
console.log('garden-defense balance OK');
