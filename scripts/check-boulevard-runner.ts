// Jerusalem Boulevard Runner: proves the spawner never builds an unavoidable wall.
// For many seeds it streams a long run, then (independently of the spawner's own planner) searches for a
// way through every obstacle using the game's real lane-change and jump timings. Also checks determinism
// and that no distance is ever blocked by tall obstacles in all three lanes. Exits non-zero on failure.
import { Spawner, CONTROLS, speedAt, LANES, type Obstacle } from '../src/games/boulevard-runner/spawner';

const SEEDS = 120;
const RUN = 5000; // units (metres); top speed is reached long before this
const H = 0.25; // finer grid than the spawner uses

function passable(obs: Obstacle[], length: number): { ok: boolean; stuckAt: number } {
  const n = Math.ceil(length / H) + 400;
  const tall = Array.from({ length: LANES }, () => new Uint8Array(n));
  const low = Array.from({ length: LANES }, () => new Uint8Array(n));
  for (const o of obs) {
    const a = Math.floor(o.start / H), b = Math.min(n - 1, Math.ceil(o.end / H));
    for (let i = a; i <= b; i++) (o.tall ? tall : low)[o.lane][i] = 1;
  }
  const blocked = (l: number, i: number) => tall[l][i] || low[l][i];
  const reach = new Uint8Array(n + 200);
  reach[0] = 1 << 1; // the game starts in the middle lane
  let last = 0;
  const end = Math.ceil(length / H);
  for (let i = 0; i < end; i++) {
    const m = reach[i];
    if (!m) continue;
    last = i;
    const s = speedAt(i * H);
    const kc = Math.ceil((CONTROLS.laneChangeTime * s) / H);
    const kj = Math.ceil((CONTROLS.jumpTime * s) / H);
    const ja = Math.floor(CONTROLS.airFrom * kj), jb = Math.ceil(CONTROLS.airTo * kj);
    for (let l = 0; l < LANES; l++) {
      if (!(m & (1 << l))) continue;
      if (!blocked(l, i)) reach[i + 1] |= 1 << l;
      let ok = true;
      for (let k = 0; k < kj && ok; k++) {
        if (tall[l][i + k]) ok = false;
        else if (low[l][i + k] && (k <= ja || k >= jb)) ok = false;
      }
      if (ok) reach[i + kj] |= 1 << l;
      for (const nb of [l - 1, l + 1]) {
        if (nb < 0 || nb >= LANES) continue;
        let ok2 = true;
        for (let k = 0; k < kc && ok2; k++) if (blocked(l, i + k) || blocked(nb, i + k)) ok2 = false;
        if (ok2) reach[i + kc] |= 1 << nb;
      }
    }
  }
  return { ok: reach[end] !== 0, stuckAt: last * H };
}

function wallAt(obs: Obstacle[], length: number): number {
  // Any distance where all three lanes are covered by tall obstacles?
  const n = Math.ceil(length / H) + 400;
  const cover = new Uint8Array(n);
  for (const o of obs) {
    if (!o.tall) continue;
    const a = Math.floor(o.start / H), b = Math.min(n - 1, Math.floor(o.end / H));
    for (let i = a; i <= b; i++) cover[i] |= 1 << o.lane;
  }
  for (let i = 0; i < n; i++) if (cover[i] === 0b111) return i * H;
  return -1;
}

const t0 = performance.now();
let failures = 0;
const counts: Record<string, number> = {};
let total = 0;
for (let seed = 1; seed <= SEEDS; seed++) {
  const sp = new Spawner(seed * 7919 + 13);
  sp.ensure(RUN);
  // Everything that starts within the run; then search until well past the last one.
  const obs = sp.obstacles.filter((o) => o.start < RUN);
  const length = Math.max(...obs.map((o) => o.end)) + 30;
  for (const o of obs) { counts[o.kind] = (counts[o.kind] ?? 0) + 1; total++; }
  const w = wallAt(obs, length);
  if (w >= 0) { console.error(`seed ${seed}: wall of tall obstacles at ${w.toFixed(1)}m`); failures++; }
  const p = passable(obs, length);
  if (!p.ok) { console.error(`seed ${seed}: no way through, stuck at ${p.stuckAt.toFixed(1)}m`); failures++; }
  // sorted, sane intervals
  for (let i = 0; i < obs.length; i++) {
    const o = obs[i];
    if (!(o.end > o.start) || (i > 0 && o.start < obs[i - 1].start)) { console.error(`seed ${seed}: bad obstacle ${o.id}`); failures++; break; }
  }
}
// Determinism: same seed, same boulevard, even when generated in different chunk sizes.
const a = new Spawner(42); a.ensure(3000);
const b = new Spawner(42); for (let d = 0; d < 3000; d += 37) b.ensure(d); b.ensure(3000);
const key = (s: Spawner) => s.obstacles.filter((o) => o.D < 2900).map((o) => `${o.kind}@${o.D.toFixed(3)}`).join(',');
if (key(a) !== key(b)) { console.error('spawner is not deterministic'); failures++; }
// Density: the run should actually be busy.
const perKm = total / SEEDS / (RUN / 1000);
if (perKm < 40) { console.error(`too few obstacles: ${perKm.toFixed(1)} per km`); failures++; }

const ms = performance.now() - t0;
console.log(
  `boulevard-runner: ${SEEDS} runs x ${RUN}m, ${perKm.toFixed(0)} obstacles/km ` +
    `(${Object.entries(counts).map(([k, v]) => `${k} ${((100 * v) / total).toFixed(0)}%`).join(', ')}), ` +
    `${failures} failures, ${(ms / 1000).toFixed(1)}s`,
);
if (failures) process.exit(1);
