// Hose Shooter: plays many seeded 60 s rounds headlessly and checks the round works end to end.
// - every round ends at 60 s and emits 'end'
// - cats, the chicken, all three bunnies and the turtles all show up
// - an aiming bot scores well (cats and chickens are hittable on the wall, tree and ground)
// - a careless sprayer does hit bunnies/turtles sometimes (penalties work) and score never goes negative
// - no NaN positions, entity counts stay bounded
import { createGame, hitBox, step, ROUND_SECONDS, COUNTDOWN_SECONDS, POINTS, type GameState, type Input } from '../src/games/hose-shooter/logic';

const fail = (msg: string) => {
  console.error('FAIL:', msg);
  process.exit(1);
};

function aimBot(g: GameState): Input {
  // aim at the most valuable hittable target, leading it a little; never aim near a friendly
  let best: { x: number; y: number; v: number } | null = null;
  for (const e of g.ents) {
    if (e.state !== 'move' || (e.kind !== 'cat' && e.kind !== 'chicken')) continue;
    const hb = hitBox(e, g.L);
    if (!hb) continue;
    const lead = e.kind === 'cat' && e.pose === 'run' ? e.dir * e.speed * e.s * 0.35 : 0;
    const x = hb.cx + lead;
    const y = hb.cy;
    const friendlyNear = g.ents.some((f) => {
      if (f.kind !== 'bunny' && f.kind !== 'turtle') return false;
      const fb = hitBox(f, g.L);
      return !!fb && Math.abs(fb.cx - x) < fb.rx + 30 && Math.abs(fb.cy - y) < fb.ry + 30;
    });
    if (friendlyNear) continue;
    const v = e.kind === 'chicken' ? 1000 : 100 + e.s * 10;
    if (!best || v > best.v) best = { x, y, v };
  }
  return best ? { aimX: best.x, aimY: best.y, spraying: true } : { aimX: g.aimX, aimY: g.aimY, spraying: false };
}

function sweepBot(g: GameState): Input {
  const t = g.time;
  return { aimX: 200 + Math.sin(t * 1.3) * 190, aimY: g.L.wallBase + 40 + (Math.sin(t * 0.7) * 0.5 + 0.5) * (g.L.aimMaxY - g.L.wallBase - 40), spraying: true };
}

function play(seed: number, H: number, bot: (g: GameState) => Input) {
  const g = createGame(H, seed);
  const dt = 1 / 60;
  let ended = false;
  let maxEnts = 0;
  let minScore = 0;
  for (let i = 0; i < (ROUND_SECONDS + 3) * 60; i++) {
    step(g, dt, bot(g));
    for (const ev of g.events) if (ev.type === 'end') ended = true;
    g.events.length = 0;
    maxEnts = Math.max(maxEnts, g.ents.length);
    minScore = Math.min(minScore, g.score);
    for (const e of g.ents) if (!Number.isFinite(e.x) || !Number.isFinite(e.y) || !Number.isFinite(e.s)) fail(`NaN entity seed ${seed}`);
  }
  if (!ended || !g.over) fail(`round did not end (seed ${seed})`);
  if (minScore < 0) fail(`negative score (seed ${seed})`);
  if (maxEnts > 14) fail(`too many entities on screen: ${maxEnts} (seed ${seed})`);
  return g;
}

const t0 = performance.now();
// READY/STEADY/DRAW: no spraying, no clock and no characters until DRAW, then the round runs
{
  const g = createGame(866, 42);
  const beats: string[] = [];
  for (let i = 0; i < Math.ceil(COUNTDOWN_SECONDS * 60) - 2; i++) {
    step(g, 1 / 60, { aimX: 200, aimY: 400, spraying: true });
    for (const ev of g.events) if (ev.type === 'count') beats.push(ev.beat);
    g.events.length = 0;
    if (g.spraying || g.drops.length || g.time > 0 || g.ents.length) fail('something happened during the countdown');
  }
  for (let i = 0; i < 30; i++) {
    step(g, 1 / 60, { aimX: 200, aimY: 400, spraying: true });
    for (const ev of g.events) if (ev.type === 'count') beats.push(ev.beat);
    g.events.length = 0;
  }
  if (beats.join(',') !== 'ready,steady,draw') fail(`countdown beats were ${beats.join(',')}`);
  if (!g.spraying || g.time <= 0) fail('round did not start after the countdown');
}
const N = 60;
let aimTotal = 0;
let sweepPenalties = 0;
let chickensHit = 0;
const zonesHit = new Set<string>();
for (let i = 0; i < N; i++) {
  const H = [780, 866, 940][i % 3];
  const g = play(1000 + i, H, aimBot);
  const s = g.stats;
  if (s.catsSpawned < 25) fail(`only ${s.catsSpawned} cats in a round (seed ${1000 + i})`);
  if (s.chickensSpawned < 3) fail(`only ${s.chickensSpawned} chickens in a round (seed ${1000 + i})`);
  if (s.bunnyVariantsSeen.length < 3) fail(`not all three bunnies appeared (seed ${1000 + i})`);
  if (s.turtlesSpawned < 2) fail(`only ${s.turtlesSpawned} turtles (seed ${1000 + i})`);
  if (g.score < 1500) fail(`aiming bot only scored ${g.score} (seed ${1000 + i})`);
  aimTotal += g.score;
  chickensHit += s.chickens;
  const sw = play(5000 + i, H, sweepBot);
  sweepPenalties += sw.stats.bunnies + sw.stats.turtles;
}
// which zones can actually be hit: run the aim bot and track cat zone at soak time via points
for (let i = 0; i < 10; i++) {
  const g = createGame(866, 9000 + i);
  for (let k = 0; k < ROUND_SECONDS * 60; k++) {
    step(g, 1 / 60, aimBot(g));
    for (const ev of g.events) if (ev.type === 'hit' && ev.kind === 'cat') zonesHit.add(String(ev.points));
    g.events.length = 0;
  }
}
const ms = performance.now() - t0;
if (chickensHit < N) fail(`chickens are too hard to hit (${chickensHit} in ${N} rounds)`);
if (sweepPenalties === 0) fail('careless spraying never hit a bunny or turtle');
for (const p of [POINTS.catGround, POINTS.catWall, POINTS.catTree]) if (!zonesHit.has(String(p))) fail(`no cat was ever soaked for ${p} points`);
if (ms > 9000) fail(`check too slow: ${ms.toFixed(0)}ms`);
console.log(
  `hose-shooter OK: ${N} rounds, aim bot avg ${Math.round(aimTotal / N)}, chickens hit ${chickensHit}, sweep penalties ${sweepPenalties}, cat zones ${[...zonesHit].join('/')}, ${ms.toFixed(0)}ms`,
);
