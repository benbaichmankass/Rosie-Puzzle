// Garden Defense balance check: runs the real simulation with simulated players and checks that
// an idle player loses fast, a careless tapper does a bit better, and a good player lasts a few minutes
// but always loses eventually (the bunnies keep getting greedier).
import { createGame, step, TUNING, type GameState } from '../src/games/garden-defense/sim';

const DT = 1 / 30;
const LIMIT = 900; // seconds; a game that lasts longer than this means the difficulty never catches up
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

/**
 * A good player: re-decides every 0.35 s (human reaction), waters the plant under the most bunny pressure
 * (bunnies on it vs leaves left), otherwise tops up the driest plant. Moving the can takes 0.2 s.
 */
const good: Player = (s, mem) => {
  if (s.t < mem.until) return mem.cur;
  let best = -1;
  let score = -Infinity;
  s.plants.forEach((p, i) => {
    if (!p.alive) return;
    const eaters = s.bunnies.filter((b) => b.target === i && b.mode === 'eat').length;
    const coming = s.bunnies.filter((b) => b.target === i && b.mode === 'hop').length;
    const sc = (eaters * 3 + coming) / (p.leaves + 1) + (1 - p.moisture) * 0.25;
    if (sc > score) {
      score = sc;
      best = i;
    }
  });
  const switching = best !== mem.cur;
  mem.until = s.t + 0.35 + (switching ? 0.2 : 0);
  mem.cur = switching ? -1 : best; // finger in transit while switching
  if (switching) mem.next = best;
  return mem.cur;
};

function play(player: Player, seed: number) {
  const s = createGame(seed);
  const mem: Mem = { cur: -1, until: 0 };
  let firstDeath = -1;
  while (!s.over && s.t < LIMIT) {
    let w = player(s, mem);
    if (w === -1 && mem.next !== undefined && s.t >= mem.until - 0.35) {
      mem.cur = mem.next;
      mem.next = undefined;
      w = mem.cur;
    }
    step(s, DT, w);
    if (firstDeath < 0 && s.plants.some((p) => !p.alive)) firstDeath = s.t;
    s.events.length = 0;
  }
  return { time: s.t, firstDeath, finished: s.over };
}

function stats(name: string, player: Player) {
  const t0 = performance.now();
  const runs = Array.from({ length: SEEDS }, (_, i) => play(player, 1000 + i * 7919));
  const times = runs.map((r) => r.time).sort((a, b) => a - b);
  const q = (f: number) => times[Math.min(times.length - 1, Math.floor(f * times.length))];
  const firstDeaths = runs.map((r) => r.firstDeath).sort((a, b) => a - b);
  const unfinished = runs.filter((r) => !r.finished).length;
  console.log(
    `${name.padEnd(9)} survive p10 ${q(0.1).toFixed(0)}s  median ${q(0.5).toFixed(0)}s  p90 ${q(0.9).toFixed(0)}s  ` +
      `first plant lost (median) ${firstDeaths[SEEDS >> 1].toFixed(0)}s  never-ending ${unfinished}  (${(performance.now() - t0).toFixed(0)}ms)`,
  );
  return { median: q(0.5), p10: q(0.1), p90: q(0.9), unfinished };
}

const I = stats('idle', idle);
const C = stats('careless', careless);
const G = stats('good', good);

const fails: string[] = [];
if (I.median < 25 || I.median > 80) fails.push(`idle player should lose in 25-80 s (median ${I.median.toFixed(0)})`);
if (C.median <= I.median + 5) fails.push('careless tapping should beat doing nothing');
if (G.median <= C.median * 1.5) fails.push('a good player should clearly outlast a careless one');
if (G.median < 150 || G.median > 360) fails.push(`a good player should last a few minutes: median 150-360 s (got ${G.median.toFixed(0)})`);
if (G.unfinished + C.unfinished + I.unfinished > 0) fails.push('every game must end (difficulty must keep rising)');

if (fails.length) {
  console.error('FAIL:\n  ' + fails.join('\n  '));
  process.exit(1);
}
console.log('garden-defense balance OK');
