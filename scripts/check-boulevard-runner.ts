// Jerusalem Boulevard Runner: proves the spawner never builds an unavoidable wall.
// For many seeds it streams a long run, then (independently of the spawner's own planner) searches for a
// way through every obstacle using the game's real timings and roof rules: jump or run up a ramp onto a
// tram, run along its roof, drop off the end, hop down to the bike path, or leap across to the other track.
// It also proves the search is not vacuous (a hand-made wall is rejected), checks determinism and density,
// and that no distance is blocked by tall obstacles in all three lanes. Exits non-zero on failure.
import { Spawner, CONTROLS, speedAt, LANES, makeObstacle, type Obstacle, type Timings } from '../src/games/boulevard-runner/spawner';

const SEEDS = 80;
const RUN = 5000; // units (metres); top speed is reached long before this
const H = 0.25; // finer grid than the spawner uses

function passable(obs: Obstacle[], length: number, t: Timings = CONTROLS): { ok: boolean; stuckAt: number } {
  const n = Math.ceil(length / H) + 600;
  const mk = () => Array.from({ length: LANES }, () => new Uint8Array(n));
  const tall = mk(), low = mk(), tram = mk(), ramp = mk();
  for (const o of obs) {
    const a = Math.floor(o.start / H), b = Math.min(n - 1, Math.ceil(o.end / H));
    const arr = o.tram ? tram : o.tall ? tall : low;
    for (let i = a; i <= b; i++) arr[o.lane][i] = 1;
    if (o.ramp) ramp[o.lane][a] = 1;
  }
  const any = (l: number, i: number) => tall[l][i] || low[l][i] || tram[l][i];
  const ground = new Uint8Array(n + 400), roof = new Uint8Array(n + 400);
  ground[0] = 1 << 1; // the game starts in the middle lane
  let last = 0;
  const end = Math.ceil(length / H);
  for (let i = 0; i < end; i++) {
    const gm = ground[i], rm = roof[i];
    if (!gm && !rm) continue;
    last = i;
    const s = speedAt(i * H);
    const kc = Math.ceil((t.laneChangeTime * s) / H);
    const kj = Math.ceil((t.jumpTime * s) / H);
    const kf = Math.ceil((t.fallTime * s) / H);
    const ja = Math.floor(t.airFrom * kj), jb = Math.ceil(t.airTo * kj);
    const ma = Math.ceil(t.mountFrom * kj), mb = Math.floor(t.mountTo * kj);
    for (let l = 0; l < LANES; l++) {
      const bit = 1 << l;
      if (gm & bit) {
        if (tram[l][i]) { if (ramp[l][i] && !tall[l][i] && !low[l][i] && tram[l][i + 1]) roof[i + 1] |= bit; }
        else if (!tall[l][i] && !low[l][i]) ground[i + 1] |= bit;
        let ok = true, mountAt = -1;
        for (let k = 0; k < kj && ok && mountAt < 0; k++) {
          const c = i + k;
          if (tram[l][c]) { if (k >= ma && k <= mb) mountAt = c; else ok = false; }
          else if (tall[l][c]) ok = false;
          else if (low[l][c] && (k <= ja || k >= jb)) ok = false;
        }
        if (ok) { if (mountAt >= 0) roof[mountAt] |= bit; else ground[i + kj] |= bit; }
        for (const nb of [l - 1, l + 1]) {
          if (nb < 0 || nb >= LANES) continue;
          let ok2 = true;
          for (let k = 0; k < kc && ok2; k++) if (any(l, i + k) || any(nb, i + k)) ok2 = false;
          if (ok2) ground[i + kc] |= 1 << nb;
        }
      }
      if ((rm & bit) && tram[l][i]) {
        if (tram[l][i + 1]) roof[i + 1] |= bit;
        else {
          let ok = true;
          for (let k = 1; k <= kf && ok; k++) if (any(l, i + k)) ok = false;
          if (ok) ground[i + 1 + kf] |= bit;
        }
        for (const nb of [l - 1, l + 1]) {
          if (nb < 0 || nb >= LANES) continue;
          let ok2 = true;
          for (let k = 0; k < kc + kf && ok2; k++) if (any(nb, i + k)) ok2 = false;
          if (ok2) ground[i + kc + kf] |= 1 << nb;
        }
        const far = 2 - l;
        if (far !== l) {
          let ok3 = true;
          for (let k = 0; k <= 2 * kc && ok3; k++) if (!tram[far][i + k]) ok3 = false;
          if (ok3) roof[i + 2 * kc] |= 1 << far;
        }
      }
    }
  }
  return { ok: !!(ground[end] || roof[end]), stuckAt: last * H };
}

function wallAt(obs: Obstacle[], length: number): number {
  // Any distance where all three lanes are covered by tall, non-tram obstacles? (Trams can be climbed.)
  const n = Math.ceil(length / H) + 400;
  const cover = new Uint8Array(n);
  for (const o of obs) {
    if (!o.tall || o.tram) continue;
    const a = Math.floor(o.start / H), b = Math.min(n - 1, Math.floor(o.end / H));
    for (let i = a; i <= b; i++) cover[i] |= 1 << o.lane;
  }
  for (let i = 0; i < n; i++) if (cover[i] === 0b111) return i * H;
  return -1;
}

let failures = 0;
const fail = (m: string) => { console.error(m); failures++; };
const t0 = performance.now();

// 0. The search must actually reject impossible layouts (guards against a vacuous check).
{
  const wall = [makeObstacle(1, 'tramIn', 100, 0), makeObstacle(2, 'walker', 100, 0), makeObstacle(3, 'tramOut', 96, 0, false)];
  // A tram in each side lane with no ramp and a walker in the middle is still passable by jumping onto a roof...
  if (!passable(wall, 300).ok) fail('roof jump should get past tram/walker/tram');
  // ...but not if Rosie could never jump high enough (no mount window): then it must be a wall.
  if (passable(wall, 300, { ...CONTROLS, mountFrom: 2, mountTo: 3 }).ok) fail('check accepts an impossible wall');
  // A ramp tram can be climbed without jumping.
  const rampOnly = [makeObstacle(1, 'tramOut', 60, 0, true), makeObstacle(2, 'walker', 60, 0), makeObstacle(3, 'tramIn', 60, 0)];
  if (!passable(rampOnly, 300, { ...CONTROLS, mountFrom: 2, mountTo: 3 }).ok) fail('ramp should let Rosie climb a tram');
}

const counts: Record<string, number> = {};
let total = 0, ramps = 0;
for (let seed = 1; seed <= SEEDS; seed++) {
  const sp = new Spawner(seed * 7919 + 13);
  sp.ensure(RUN);
  const obs = sp.obstacles.filter((o) => o.start < RUN);
  const length = Math.max(...obs.map((o) => o.end)) + 30;
  for (const o of obs) { counts[o.kind] = (counts[o.kind] ?? 0) + 1; total++; if (o.ramp) ramps++; }
  const w = wallAt(obs, length);
  if (w >= 0) fail(`seed ${seed}: wall of tall obstacles at ${w.toFixed(1)}m`);
  const p = passable(obs, length);
  if (!p.ok) fail(`seed ${seed}: no way through, stuck at ${p.stuckAt.toFixed(1)}m`);
  for (let i = 0; i < obs.length; i++) {
    const o = obs[i];
    if (!(o.end > o.start) || (i > 0 && o.start < obs[i - 1].start)) { fail(`seed ${seed}: bad obstacle ${o.id}`); break; }
  }
}
// Determinism: same seed, same boulevard, even when generated in different chunk sizes.
const a = new Spawner(42); a.ensure(3000);
const b = new Spawner(42); for (let d = 0; d < 3000; d += 37) b.ensure(d); b.ensure(3000);
const key = (s: Spawner) => s.obstacles.filter((o) => o.D < 2900).map((o) => `${o.kind}${o.ramp ? 'R' : ''}@${o.D.toFixed(3)}`).join(',');
if (key(a) !== key(b)) fail('spawner is not deterministic');
const perKm = total / SEEDS / (RUN / 1000);
if (perKm < 40) fail(`too few obstacles: ${perKm.toFixed(1)} per km`);
if (!ramps) fail('no ramp trams generated');

const ms = performance.now() - t0;
console.log(
  `boulevard-runner: ${SEEDS} runs x ${RUN}m, ${perKm.toFixed(0)} obstacles/km ` +
    `(${Object.entries(counts).map(([k, v]) => `${k} ${((100 * v) / total).toFixed(0)}%`).join(', ')}; ${ramps} ramps), ` +
    `${failures} failures, ${(ms / 1000).toFixed(1)}s`,
);
if (failures) process.exit(1);
