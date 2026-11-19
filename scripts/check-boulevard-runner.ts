// Jerusalem Boulevard Runner: proves the spawner never builds an unavoidable wall.
// For many seeds it streams a long run, then (independently of the spawner's own planner) searches for a
// way through every obstacle using the game's real timings and roof rules: jump or run up a ramp onto a
// tram, run along its roof, drop off the end, hop down to the bike path, or leap across to the other track.
// It also proves the search is not vacuous (a hand-made wall is rejected), checks determinism and density,
// and that no distance is blocked by tall obstacles in all three lanes. Exits non-zero on failure.
import { timeOfDay, lightAt, phaseName, DAY_LENGTH, STEPS } from '../src/games/boulevard-runner/daynight';
import { ROUTE_STATIONS, NORTH_END, PARK_START, LAP, TRACKS_END, numberToU, hasTracks } from '../src/games/boulevard-runner/route';
import { Spawner, CONTROLS, speedAt, LANES, makeObstacle, BOARD_SPEED, SPRING_JUMP_H, SPRING_JUMP_TIME, type Obstacle, type Timings } from '../src/games/boulevard-runner/spawner';

const SEEDS = 32;
const RUN = 4000; // units (metres); top speed is reached long before this
const H = 0.25; // finer grid than the spawner uses

interface Grid { tall: Uint8Array[]; low: Uint8Array[]; tram: Uint8Array[]; ramp: Uint8Array[]; duckG: Uint8Array[]; duckR: Uint8Array[]; n: number }

function buildGrid(obs: Obstacle[], length: number): Grid {
  const n = Math.ceil(length / H) + 600;
  const mk = () => Array.from({ length: LANES }, () => new Uint8Array(n));
  const tall = mk(), low = mk(), tram = mk(), ramp = mk(), duckG = mk(), duckR = mk();
  for (const o of obs) {
    const a = Math.floor(o.start / H), b = Math.min(n - 1, Math.ceil(o.end / H));
    const arr = o.duck ? (o.duckLevel ? duckR : duckG) : o.tram ? tram : o.tall ? tall : low;
    for (let i = a; i <= b; i++) arr[o.lane][i] = 1;
    if (o.ramp) ramp[o.lane][a] = 1;
  }
  return { tall, low, tram, ramp, duckG, duckR, n };
}

/**
 * Every move Rosie can make from (cell i, lane l, on the street or on a roof), with the game's rules.
 * Calls out(j, lane, roof) for each state she can be in next.
 */
function successors(G: Grid, t: Timings, i: number, l: number, onRoof: boolean, out: (j: number, l: number, roof: boolean) => void) {
  const { tall, low, tram, ramp, duckG, duckR } = G;
  const any = (ll: number, c: number) => tall[ll][c] || low[ll][c] || tram[ll][c] || duckG[ll][c];
  const s = speedAt(i * H);
  const kc = Math.ceil((t.laneChangeTime * s) / H);
  const kj = Math.ceil((t.jumpTime * s) / H);
  const kf = Math.ceil((t.fallTime * s) / H);
  const ja = Math.floor(t.airFrom * kj), jb = Math.ceil(t.airTo * kj);
  const ma = Math.ceil(t.mountFrom * kj), mb = Math.floor(t.mountTo * kj);
  const kd = Math.ceil((t.duckTime * s) / H);
  const da = Math.floor(t.duckFrom * kd), db = Math.ceil(t.duckTo * kd);
  const ta = t.tallFrom !== undefined ? Math.ceil(t.tallFrom * kj) : -1, tb = t.tallTo !== undefined ? Math.floor(t.tallTo * kj) : -1;
  if (!onRoof) {
    if (tram[l][i]) { if (ramp[l][i] && !tall[l][i] && !low[l][i] && !duckG[l][i] && tram[l][i + 1]) out(i + 1, l, true); }
    else if (!tall[l][i] && !low[l][i] && !duckG[l][i]) out(i + 1, l, false);
    let ok = true, mountAt = -1;
    for (let k = 0; k < kj && ok && mountAt < 0; k++) {
      const c = i + k;
      if (tram[l][c]) { if (k >= ma && k <= mb && !duckR[l][c]) mountAt = c; else ok = false; }
      else if (duckG[l][c]) ok = false;
      else if (tall[l][c] && !(ta >= 0 && k >= ta && k <= tb)) ok = false;
      else if (low[l][c] && (k <= ja || k >= jb)) ok = false;
    }
    if (ok) { if (mountAt >= 0) out(mountAt, l, true); else out(i + kj, l, false); }
    // duck under a street-level bar
    let okd = true;
    for (let k = 0; k < kd && okd; k++) {
      const c = i + k;
      if (tall[l][c] || low[l][c] || tram[l][c]) okd = false;
      else if (duckG[l][c] && (k < da || k > db)) okd = false;
    }
    if (okd) out(i + kd, l, false);
    for (const nb of [l - 1, l + 1]) {
      if (nb < 0 || nb >= LANES) continue;
      let ok2 = true;
      for (let k = 0; k < kc && ok2; k++) if (any(l, i + k) || any(nb, i + k)) ok2 = false;
      if (ok2) out(i + kc, nb, false);
    }
    return;
  }
  if (!tram[l][i]) return;
  // duck under something at roof height
  let okd = true;
  for (let k = 0; k <= kd && okd; k++) {
    const c = i + k;
    if (!tram[l][c]) okd = false;
    else if (duckR[l][c] && (k < da || k > db)) okd = false;
  }
  if (okd) out(i + kd, l, true);
  if (duckR[l][i]) return;
  if (tram[l][i + 1]) out(i + 1, l, true);
  else {
    let ok = true;
    for (let k = 1; k <= kf && ok; k++) if (any(l, i + k)) ok = false;
    if (ok) out(i + 1 + kf, l, false);
  }
  for (const nb of [l - 1, l + 1]) {
    if (nb < 0 || nb >= LANES) continue;
    let ok2 = true;
    for (let k = 0; k < kc + kf && ok2; k++) if (any(nb, i + k) || (k < kc && duckR[l][i + k])) ok2 = false;
    if (ok2) out(i + kc + kf, nb, false);
  }
  const far = 2 - l;
  if (far !== l) {
    let ok3 = true;
    for (let k = 0; k <= 2 * kc && ok3; k++) if (!tram[far][i + k] || duckR[far][i + k] || duckR[l][i + k]) ok3 = false;
    if (ok3) out(i + 2 * kc, far, true);
  }
}

/** Forward reachability from the start (middle lane) and backward "can still get to the end" sets. */
function solve(obs: Obstacle[], length: number, t: Timings = CONTROLS) {
  const G = buildGrid(obs, length);
  const end = Math.ceil(length / H);
  const size = G.n + 400;
  const fg = new Uint8Array(size), fr = new Uint8Array(size);
  fg[0] = 1 << 1;
  let last = 0;
  for (let i = 0; i < end; i++) {
    for (let l = 0; l < LANES; l++) {
      for (const roof of [false, true]) {
        if (!((roof ? fr : fg)[i] & (1 << l))) continue;
        last = i;
        successors(G, t, i, l, roof, (j, nl, nr) => { (nr ? fr : fg)[j] |= 1 << nl; });
      }
    }
  }
  const ok = !!(fg[end] || fr[end]);
  // backward: a state is good if some move leads to a good state; everything at the end is good
  const bg = new Uint8Array(size), br = new Uint8Array(size);
  for (let i = end; i < size; i++) { bg[i] = 0b111; br[i] = 0b111; }
  for (let i = end - 1; i >= 0; i--) {
    for (let l = 0; l < LANES; l++) {
      for (const roof of [false, true]) {
        let good = false;
        successors(G, t, i, l, roof, (j, nl, nr) => { if (!good && ((nr ? br : bg)[j] & (1 << nl))) good = true; });
        if (good) (roof ? br : bg)[i] |= 1 << l;
      }
    }
  }
  return { ok, stuckAt: last * H, fg, fr, bg, br };
}

function passable(obs: Obstacle[], length: number, t: Timings = CONTROLS): { ok: boolean; stuckAt: number } {
  const r = solve(obs, length, t);
  return { ok: r.ok, stuckAt: r.stuckAt };
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
  // bars must be ducked: with ducking disabled a full row of bars is a wall, with it they're passable
  const bars = [0, 1, 2].map((l) => makeObstacle(10 + l, 'bar', 120, 0, false, l as 0 | 1 | 2));
  if (!passable(bars, 300).ok) fail('ducking should get under a row of bars');
  if (passable(bars, 300, { ...CONTROLS, duckFrom: 2, duckTo: 3 }).ok) fail('check accepts bars without ducking');
}

const counts: Record<string, number> = {};
let total = 0, ramps = 0, treats = 0, powers = 0, boardFails = 0, springFails = 0;
for (let seed = 1; seed <= SEEDS; seed++) {
  const sp = new Spawner(seed * 7919 + 13);
  sp.ensure(RUN);
  const obs = sp.obstacles.filter((o) => o.start < RUN);
  const length = Math.max(...obs.map((o) => o.end)) + 30;
  for (const o of obs) { counts[o.kind] = (counts[o.kind] ?? 0) + 1; total++; if (o.ramp) ramps++; }
  const w = wallAt(obs, length);
  if (w >= 0) fail(`seed ${seed}: wall of tall obstacles at ${w.toFixed(1)}m`);
  const sol = solve(obs, length);
  if (!sol.ok) fail(`seed ${seed}: no way through, stuck at ${sol.stuckAt.toFixed(1)}m`);
  // every treat / power-up sits on some complete way through: reachable from the start, and the run can
  // still be finished from there (collecting it never forces a crash)
  for (const pk of sp.pickups.filter((q) => q.d < RUN - 100)) {
    const i = Math.floor(pk.d / H), bit = 1 << pk.lane;
    const f = pk.roof ? sol.fr : sol.fg, bk = pk.roof ? sol.br : sol.bg;
    // the treat is collected within about a cell of its spot
    let good = false;
    for (let c = i - 4; c <= i + 4 && !good; c++) if ((f[c] & bit) && (bk[c] & bit)) good = true;
    if (!good) fail(`seed ${seed}: ${pk.kind} at ${pk.d.toFixed(1)}m lane ${pk.lane}${pk.roof ? ' (roof)' : ''} cannot be collected safely`);
    if (pk.kind === 'treat') treats++; else powers++;
  }
  // on the skateboard Rosie covers 20% more ground per second: check the run with those (tighter) timings too;
  // where it would not be passable the board's one-hit shield is what saves her
  const scale = BOARD_SPEED;
  const boardT = { ...CONTROLS, laneChangeTime: CONTROLS.laneChangeTime * scale, jumpTime: CONTROLS.jumpTime * scale, fallTime: CONTROLS.fallTime * scale };
  if (!passable(obs, Math.min(length, 1200), boardT).ok) boardFails++;
  // spring booties: longer, much higher jumps (clear walkers and bikes mid-jump, land on roofs from far off)
  const sh = SPRING_JUMP_H, win = (h: number) => { const q = Math.sqrt(Math.max(0, 1 - h / sh)) / 2; return [0.5 - q, 0.5 + q]; };
  const [aF, aT] = win(0.35), [mF, mT] = win(0.55), [tF, tT] = win(2.05);
  const springT = { ...CONTROLS, jumpTime: SPRING_JUMP_TIME, airFrom: aF, airTo: aT, mountFrom: mF, mountTo: mT, tallFrom: tF, tallTo: tT };
  if (!passable(obs, Math.min(length, 1200), springT).ok) springFails++;
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
if (treats / SEEDS < 50) fail(`too few treats: ${(treats / SEEDS).toFixed(0)} per run`);
if (!powers) fail('no power-ups generated');
if (springFails) fail(`spring booties made ${springFails} run(s) impassable`);

// Day/night: a run starts in daylight and passes sunset, night and dawn in order within one day's walk,
// with no sudden jumps in the sky colours between steps.
{
  if (phaseName(timeOfDay(0)) !== 'day') fail('runs should start in daylight');
  const seen: string[] = [];
  for (let d = 0; d <= DAY_LENGTH; d += 5) { const ph = phaseName(timeOfDay(d)); if (seen[seen.length - 1] !== ph) seen.push(ph); }
  if (seen.join('>') !== 'day>sunset>night>dawn>day') fail(`day/night order is ${seen.join('>')}`);
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  for (let i = 0; i < STEPS; i++) {
    const a = lightAt(i / STEPS), b = lightAt(((i + 1) % STEPS) / STEPS);
    const jump = Math.max(...rgb(a.skyTop).map((v, j) => Math.abs(v - rgb(b.skyTop)[j])), ...rgb(a.tint).map((v, j) => Math.abs(v - rgb(b.tint)[j])));
    if (jump > 60) fail(`day/night colour jump of ${jump} at step ${i}`);
  }
  if (lightAt(0.6).lamps < 0.9 || lightAt(0.1).lamps > 0.01) fail('lamps should be on at night and off by day');
}

// The real route: stations northbound in order, the park after the north end, a faster tier on the next lap,
// no trams beyond the end of the track, and street numbers counting down as Rosie walks north.
{
  const order = ROUTE_STATIONS.map((x) => x.en).join(',');
  if (order !== 'HaBesht,Isakov,Ehrlich,Bloomfield Stadium,Shalma') fail(`station order ${order}`);
  for (let i = 1; i < ROUTE_STATIONS.length; i++) if (!(ROUTE_STATIONS[i].at > ROUTE_STATIONS[i - 1].at)) fail('stations out of order');
  if (!(ROUTE_STATIONS[4].at < TRACKS_END && TRACKS_END < NORTH_END && NORTH_END < PARK_START && PARK_START < LAP)) fail('route segments out of order');
  if (!(speedAt(LAP + 300) > speedAt(300) + 1)) fail('second lap should be a faster tier');
  if (!(numberToU(127) < numberToU(82) && numberToU(82) < numberToU(2))) fail('house numbers should count down northbound');
  const sp = new Spawner(99); sp.ensure(LAP * 2 + 100);
  const bad = sp.obstacles.find((o) => o.tram && (!hasTracks(o.start) || !hasTracks(o.end)));
  if (bad) fail(`tram off the tracks at ${bad.start.toFixed(0)}m`);
}

const ms = performance.now() - t0;
console.log(
  `boulevard-runner: ${SEEDS} runs x ${RUN}m, ${perKm.toFixed(0)} obstacles/km ` +
    `(${Object.entries(counts).map(([k, v]) => `${k} ${((100 * v) / total).toFixed(0)}%`).join(', ')}; ${ramps} ramps), ` +
    `${(treats / SEEDS).toFixed(0)} treats + ${(powers / SEEDS).toFixed(1)} power-ups per run all safely collectable, ` +
    `board-speed first 1.2km passable in ${SEEDS - boardFails}/${SEEDS}, spring-booties in ${SEEDS - springFails}/${SEEDS}, ` +
    `${failures} failures, ${(ms / 1000).toFixed(1)}s`,
);
if (failures) process.exit(1);
