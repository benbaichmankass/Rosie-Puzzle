// Roomba Fling: generates hundreds of random levels and checks every one is reachable from the
// start to the dock (C-space BFS proof), keeps start/dock clear, always has Rosie, and generates fast.
import {
  generateLevel, reachable, makeCleanGrid, distToShape, step, flingVelocity, atDock,
  levelScore, ROSIE_PENALTY, R, W, H, type Level, type Body,
} from '../src/games/roomba-fling/sim';

const LEVELS = 16;
const PER_LEVEL = 25;
let failures = 0;
let worst = 0;
let fallbacks = 0;
const fail = (msg: string) => { failures++; if (failures < 20) console.error('FAIL', msg); };

function checkLevel(l: Level, tag: string) {
  if (reachable(l) < 0) fail(`${tag}: dock not reachable`);
  for (const s of l.solids) {
    if (distToShape(l.start.x, l.start.y, s.shape) < R + 2) fail(`${tag}: start blocked by ${s.tag}`);
    if (distToShape(l.dock.x, l.dock.y, s.shape) < R + 2) fail(`${tag}: dock blocked by ${s.tag}`);
  }
  if (!l.rosie || !['floor', 'couch', 'bed'].includes(l.rosie.where)) fail(`${tag}: no Rosie`);
  if (l.rosie.where === 'bed' && !l.pieces.some((p) => p.type === 'dogbed')) fail(`${tag}: Rosie in bed but no bed`);
  if (l.rosie.where === 'couch' && !l.pieces.some((p) => p.type === 'sofa')) fail(`${tag}: Rosie on couch but no couch`);
  if (!l.pieces.some((p) => p.type === 'sofa')) fail(`${tag}: no sofa`);
  if (l.rosie.where !== 'couch' && !l.solids.some((s) => s.tag === 'rosie')) fail(`${tag}: Rosie (${l.rosie.where}) cannot be bumped`);
  for (const p of l.pieces) if (p.x < -0.01 || p.y < -0.01 || p.x + p.w > W + 0.01 || p.y + p.h > H + 0.01) fail(`${tag}: ${p.type} outside room`);
  const g = makeCleanGrid(l);
  if (g.total < 1000) fail(`${tag}: too little floor (${g.total})`);
  for (const m of l.movers) for (const s of l.solids) {
    if (distToShape(m.x0, m.y0, s.shape) < m.r || distToShape(m.x1, m.y1, s.shape) < m.r) fail(`${tag}: ball lane through furniture`);
  }
}

const seen = new Set<string>();
for (let lv = 1; lv <= LEVELS; lv++) {
  for (let i = 0; i < PER_LEVEL; i++) {
    const seed = lv * 100003 + i * 7919;
    const t = performance.now();
    const l = generateLevel(lv, seed);
    worst = Math.max(worst, performance.now() - t);
    if (l.pieces.length === 1) fallbacks++;
    seen.add(l.pieces.map((p) => `${p.type}${Math.round(p.x)},${Math.round(p.y)}`).join('|'));
    checkLevel(l, `level ${lv} seed ${seed}`);
  }
}
const total = LEVELS * PER_LEVEL;
if (seen.size < total * 0.95) fail(`layouts not varied enough: ${seen.size}/${total} distinct`);
if (fallbacks > total * 0.05) fail(`too many fallback layouts: ${fallbacks}`);

// Physics sanity: a fling settles, never leaves the room, and a straight shot on an empty room docks.
{
  const l = generateLevel(1, 42);
  const empty: Level = { ...l, solids: [], movers: [], zones: [], start: { x: W / 2, y: H - 40 }, dock: { x: W / 2, y: l.dock.y } };
  const b: Body = { x: empty.start.x, y: empty.start.y, ...flingVelocity(0, -150) };
  let docked = false;
  for (let i = 0; i < 240 * 6 && !docked; i++) { step(empty, b, i / 240, 1 / 240); docked = atDock(empty, b); }
  if (!docked) fail('full-power straight shot in an empty room did not reach the dock');
  for (let lv = 1; lv <= 12; lv++) {
    const L = generateLevel(lv, 900 + lv);
    const body: Body = { x: L.start.x, y: L.start.y, ...flingVelocity(37, -150) };
    let stopped = false;
    for (let i = 0; i < 240 * 20; i++) {
      step(L, body, i / 240, 1 / 240);
      if (body.x < R - 0.5 || body.x > W - R + 0.5 || body.y < R - 0.5 || body.y > H - R + 0.5) { fail(`level ${lv}: Roomba left the room`); break; }
      if (body.vx === 0 && body.vy === 0) { stopped = true; break; }
    }
    if (!stopped && L.zones.every((z) => z.kind !== 'puddle')) fail(`level ${lv}: Roomba never came to rest`);
  }
  const s = levelScore(3, 0.25, 8);
  if (s.total !== 25 * 12 + 500) fail('score formula changed unexpectedly');
  // waking Rosie costs ROSIE_PENALTY per bump, and a level score never goes below 0
  const s2 = levelScore(3, 0.25, 8, 2);
  if (s2.rosiePts !== 2 * ROSIE_PENALTY || s2.total !== 25 * 12 + 500 - 2 * ROSIE_PENALTY) fail('Rosie penalty not applied');
  if (levelScore(8, 0.01, 8, 5).total !== 0) fail('level score went negative');
}

console.log(`roomba-fling: ${total} levels, ${seen.size} distinct, ${fallbacks} fallbacks, slowest ${worst.toFixed(1)}ms, failures ${failures}`);
process.exit(failures ? 1 : 0);
