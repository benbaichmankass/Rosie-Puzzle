/**
 * Gas Leak simulation: pure TS, no React/DOM. The game and scripts/check-gas-leak.ts both use it.
 *
 * The living room is a COLS x ROWS grid. Gas enters from the kitchen doorway on the right wall and
 * travels as one stream, one cell per tick, like water in a pipe puzzle:
 *  - Every fan blows wind along a straight line: its own cell plus REACH[strength] cells ahead
 *    (stopped by furniture), with force = strength.
 *  - Ceiling fans swirl the 8 cells around them clockwise (force 2). A running AC blows like a fixed fan.
 *  - Each tick the gas adds up the wind on its cell plus a little momentum (0.5) in the direction it
 *    is already moving and goes along the strongest axis. With no wind it keeps going straight.
 *  - Out through an open exit on the left wall = WIN. Next to Bentzi = BOOM. Running into a wall,
 *    furniture or going round in circles = the gas pools, fills the room and his joint lights it: BOOM.
 */

export const COLS = 7;
export const ROWS = 9;

export type Dir = 0 | 1 | 2 | 3; // N E S W
export const DR = [-1, 0, 1, 0] as const;
export const DC = [0, 1, 0, -1] as const;
export const N: Dir = 0;
export const E: Dir = 1;
export const S: Dir = 2;
export const W: Dir = 3;
export type Strength = 1 | 2 | 3;
/** Extra cells a fan reaches beyond its own cell, by strength. */
export const REACH = [0, 1, 3, 5] as const;
export const MOMENTUM = 0.5;
export const CEILING_FORCE = 2;

export type ExitId = 'window' | 'door' | 'acWindow';
/** Rows of the three openings on the left wall (top to bottom: window, door, window with AC). */
export const EXIT_ROW: Record<ExitId, number> = { window: 1, door: 4, acWindow: 7 };
export const EXITS: ExitId[] = ['window', 'door', 'acWindow'];

export interface Cell {
  r: number;
  c: number;
}
export interface Fan extends Cell {
  dir: Dir;
  s: Strength;
}
export type FurnitureKind = 'sofa' | 'table' | 'plant' | 'armchair' | 'tv' | 'dogbed' | 'cabinet';
export interface Furniture extends Cell {
  kind: FurnitureKind;
  w: number;
  h: number;
}

export interface Level {
  id: number;
  name: string;
  /** Short tip shown on the level card. */
  tip: string;
  /** Row of the kitchen doorway on the right wall where the gas comes in. */
  source: number;
  open: Record<ExitId, boolean>;
  /** How many fans the player may place. */
  fans: number;
  /** Bentzi's seat (must be inside a sofa piece). */
  bentzi: Cell;
  furniture: Furniture[];
  ceilingFans: Cell[];
  /** A running AC unit above the AC window: blows like a fixed fan from the wall cell of that row. */
  ac: { dir: Dir; s: Strength } | null;
  /** A known winning fan setup (verified by scripts/check-gas-leak.ts). */
  solution: Fan[];
  /** Real-time leak speed (defaults from the level number, see paceOf). */
  pace?: { startMs: number; minMs: number };
}

export type Outcome = 'win' | 'boom' | 'stuck' | 'loop';
export interface SimResult {
  /** Cells the gas passes through, in order. The first is the kitchen doorway cell. */
  path: Cell[];
  outcome: Outcome;
  /** For 'win': which exit the gas left through. */
  exit?: ExitId;
}

export const inBounds = (r: number, c: number) => r >= 0 && r < ROWS && c >= 0 && c < COLS;

export function solidGrid(level: Level): boolean[][] {
  const g = Array.from({ length: ROWS }, () => Array<boolean>(COLS).fill(false));
  for (const f of level.furniture)
    for (let r = f.r; r < f.r + f.h; r++) for (let c = f.c; c < f.c + f.w; c++) if (inBounds(r, c)) g[r][c] = true;
  return g;
}

/** Cells where gas makes Bentzi's joint go BOOM (open cells next to his seat). */
export function dangerCells(level: Level, solid = solidGrid(level)): Cell[] {
  const out: Cell[] = [];
  for (let d = 0; d < 4; d++) {
    const r = level.bentzi.r + DR[d];
    const c = level.bentzi.c + DC[d];
    if (inBounds(r, c) && !solid[r][c]) out.push({ r, c });
  }
  return out;
}

export const sourceCell = (level: Level): Cell => ({ r: level.source, c: COLS - 1 });

/** Can the player put a floor fan here? */
export function canPlace(level: Level, r: number, c: number, solid = solidGrid(level)): boolean {
  if (!inBounds(r, c) || solid[r][c]) return false;
  if (r === level.source && c === COLS - 1) return false;
  if (level.ceilingFans.some((f) => f.r === r && f.c === c)) return false;
  return true;
}

export interface Wind {
  x: number;
  y: number;
}

/** Cells a directional blower affects (its own cell first). */
export function beamCells(r: number, c: number, dir: Dir, s: Strength, solid: boolean[][]): Cell[] {
  const out: Cell[] = [];
  for (let k = 0; k <= REACH[s]; k++) {
    const rr = r + DR[dir] * k;
    const cc = c + DC[dir] * k;
    if (!inBounds(rr, cc) || (k > 0 && solid[rr][cc])) break;
    out.push({ r: rr, c: cc });
  }
  return out;
}

/** Clockwise swirl around a ceiling fan: [dr, dc, dir]. */
export const SWIRL: [number, number, Dir][] = [
  [-1, -1, E],
  [-1, 0, E],
  [-1, 1, S],
  [0, 1, S],
  [1, 1, W],
  [1, 0, W],
  [1, -1, N],
  [0, -1, N],
];

export const acCell = (): Cell => ({ r: EXIT_ROW.acWindow, c: 0 });

export function windField(level: Level, fans: Fan[], solid = solidGrid(level)): Wind[][] {
  const w = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => ({ x: 0, y: 0 })));
  const blow = (r: number, c: number, dir: Dir, s: Strength) => {
    for (const p of beamCells(r, c, dir, s, solid)) {
      w[p.r][p.c].x += DC[dir] * s;
      w[p.r][p.c].y += DR[dir] * s;
    }
  };
  for (const f of fans) blow(f.r, f.c, f.dir, f.s);
  if (level.ac) blow(acCell().r, acCell().c, level.ac.dir, level.ac.s);
  for (const cf of level.ceilingFans)
    for (const [dr, dc, dir] of SWIRL) {
      const r = cf.r + dr;
      const c = cf.c + dc;
      if (!inBounds(r, c) || solid[r][c]) continue;
      w[r][c].x += DC[dir] * CEILING_FORCE;
      w[r][c].y += DR[dir] * CEILING_FORCE;
    }
  return w;
}

/** Direction the gas leaves a cell, given the wind there and the way it was moving. */
export function nextDir(wind: Wind, moving: Dir): Dir {
  const vx = wind.x + DC[moving] * MOMENTUM;
  const vy = wind.y + DR[moving] * MOMENTUM;
  // Momentum is 0.5 and forces are whole numbers, so |vx| never equals |vy|.
  if (Math.abs(vx) > Math.abs(vy)) return vx > 0 ? E : W;
  return vy > 0 ? S : N;
}

const MAX_STEPS = 400;

export function simulate(level: Level, fans: Fan[]): SimResult {
  const solid = solidGrid(level);
  const wind = windField(level, fans, solid);
  const danger = new Set(dangerCells(level, solid).map((d) => d.r * COLS + d.c));
  let { r, c } = sourceCell(level);
  let dir: Dir = W;
  const path: Cell[] = [{ r, c }];
  if (danger.has(r * COLS + c)) return { path, outcome: 'boom' };
  const seen = new Set<number>();
  for (let step = 0; step < MAX_STEPS; step++) {
    const key = (r * COLS + c) * 4 + dir;
    if (seen.has(key)) return { path, outcome: 'loop' };
    seen.add(key);
    const nd = nextDir(wind[r][c], dir);
    const nr = r + DR[nd];
    const nc = c + DC[nd];
    if (nc < 0) {
      const exit = EXITS.find((e) => EXIT_ROW[e] === r && level.open[e]);
      if (exit) return { path, outcome: 'win', exit };
      return { path, outcome: 'stuck' };
    }
    if (!inBounds(nr, nc) || solid[nr][nc]) return { path, outcome: 'stuck' };
    r = nr;
    c = nc;
    dir = nd;
    path.push({ r, c });
    if (danger.has(r * COLS + c)) return { path, outcome: 'boom' };
  }
  return { path, outcome: 'loop' };
}

/**
 * Search used by the check script and for designing levels: finds a winning setup with at most
 * maxFans fans. It only tries fans whose wind touches the current gas path (any solution can be built
 * that way) and skips fans that lead to a gas path it already reached with as few fans. That pruning
 * is a heuristic (it may miss exotic solutions), but anything it returns is a real, verified win.
 */
export function solve(level: Level, maxFans: number, budget = 200000): Fan[] | null {
  const solid = solidGrid(level);
  let sims = 0;
  const pathKey = (res: SimResult) => res.outcome + ':' + res.path.map((p) => p.r * COLS + p.c).join(',');
  const dfs = (fans: Fan[], res: SimResult, limit: number, seen: Map<string, number>): Fan[] | null => {
    if (res.outcome === 'win') return fans;
    if (fans.length >= limit || sims > budget) return null;
    const used = new Set(fans.map((f) => f.r * COLS + f.c));
    const tried = new Set<string>();
    for (let i = 0; i < res.path.length; i++) {
      const p = res.path[i];
      for (let d = 0; d < 4; d++)
        for (const s of [1, 2, 3] as Strength[])
          for (let k = 0; k <= REACH[s]; k++) {
            const r = p.r - DR[d] * k;
            const c = p.c - DC[d] * k;
            const key = `${r},${c},${d},${s}`;
            if (tried.has(key)) continue;
            tried.add(key);
            if (!canPlace(level, r, c, solid) || used.has(r * COLS + c)) continue;
            const beam = beamCells(r, c, d as Dir, s, solid);
            if (!beam.some((b) => b.r === p.r && b.c === p.c)) continue;
            const next = [...fans, { r, c, dir: d as Dir, s }];
            const nres = simulate(level, next);
            sims++;
            const pk = pathKey(nres);
            if ((seen.get(pk) ?? 99) <= next.length) continue;
            seen.set(pk, next.length);
            const got = dfs(next, nres, limit, seen);
            if (got) return got;
            if (sims > budget) return null;
          }
    }
    return null;
  };
  const start = simulate(level, []);
  for (let limit = 0; limit <= maxFans; limit++) {
    const seen = new Map<string, number>([[pathKey(start), 0]]);
    const got = dfs([], start, limit, seen);
    if (got) return got;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Real-time play. The leak starts on its own and the gas head advances one cell per tick while
// the player keeps editing fans; every tick reads the CURRENT fans. Ticks start slow and speed up.
// If the gas can't reach new floor (blocked, or circling over its own trail) pressure builds;
// at PRESSURE_LIMIT the room fills up and the joint lights it ('burst' -> BOOM).
// ---------------------------------------------------------------------------------------------

/** Seconds of countdown before the leak starts (fans can already be placed). */
export const COUNTDOWN_S = 3;
export const PRESSURE_LIMIT = 6;

export interface Pace {
  /** Milliseconds for the first tick. */
  startMs: number;
  /** Fastest tick, reached as the leak builds up. */
  minMs: number;
}
const SPEEDUP = 0.92;
/** Ticks the gas spends seeping and building up at the kitchen doorway before it starts to travel. */
export const SEEP_TICKS = 2;

export function paceOf(level: Level): Pace {
  return level.pace ?? { startMs: 1700 - level.id * 30, minMs: 720 - level.id * 22 };
}

/** Duration of tick n (0-based) in ms: slow seepage first, building up to the level's top speed. */
export function tickMs(level: Level, n: number): number {
  const p = paceOf(level);
  return Math.max(p.minMs, p.startMs * Math.pow(SPEEDUP, n));
}

export type LiveOutcome = 'flowing' | 'win' | 'boom' | 'burst';
export interface LiveState {
  head: Cell;
  dir: Dir;
  /** Every cell the gas has filled, in order (cells can repeat when it crosses its own trail). */
  trail: Cell[];
  ticks: number;
  pressure: number;
  outcome: LiveOutcome;
  exit?: ExitId;
}

export function startLive(level: Level): LiveState {
  const head = sourceCell(level);
  return { head, dir: W, trail: [head], ticks: 0, pressure: 0, outcome: 'flowing' };
}

/** Advance the leak by one tick with the fans as they are right now. */
export function stepLive(level: Level, fans: Fan[], st: LiveState, solid = solidGrid(level)): LiveState {
  if (st.outcome !== 'flowing') return st;
  if (st.ticks < SEEP_TICKS) return { ...st, ticks: st.ticks + 1 };
  const wind = windField(level, fans, solid);
  const { r, c } = st.head;
  const nd = nextDir(wind[r][c], st.dir);
  const nr = r + DR[nd];
  const nc = c + DC[nd];
  const ticks = st.ticks + 1;
  if (nc < 0) {
    const exit = EXITS.find((e) => EXIT_ROW[e] === r && level.open[e]);
    if (exit) return { ...st, ticks, dir: nd, outcome: 'win', exit };
  }
  if (!inBounds(nr, nc) || solid[nr][nc]) {
    const pressure = st.pressure + 1;
    // Keep the old heading: the gas presses on in the way it was going.
    return { ...st, ticks, pressure, outcome: pressure >= PRESSURE_LIMIT ? 'burst' : 'flowing' };
  }
  const head = { r: nr, c: nc };
  const revisit = st.trail.some((p) => p.r === nr && p.c === nc);
  const pressure = revisit ? st.pressure + 1 : 0;
  const trail = [...st.trail, head];
  const danger = dangerCells(level, solid).some((d) => d.r === nr && d.c === nc);
  const outcome: LiveOutcome = danger ? 'boom' : pressure >= PRESSURE_LIMIT ? 'burst' : 'flowing';
  return { head, dir: nd, trail, ticks, pressure, outcome };
}

export interface TimedFan {
  fan: Fan;
  /** Seconds after the leak starts when the fan is in place (negative = during the countdown). */
  at: number;
}
export interface LiveRun {
  state: LiveState;
  /** Seconds from leak start to the end of the run. */
  seconds: number;
}

/** Play a whole level in game time with fans appearing on a schedule (used by the check script). */
export function runLive(level: Level, schedule: TimedFan[], maxTicks = 300): LiveRun {
  const solid = solidGrid(level);
  let st = startLive(level);
  let t = 0;
  while (st.outcome === 'flowing' && st.ticks < maxTicks) {
    t += tickMs(level, st.ticks) / 1000;
    const fans = schedule.filter((s) => s.at <= t).map((s) => s.fan);
    st = stepLive(level, fans, st, solid);
  }
  return { state: st, seconds: t };
}

/** Par time: the stored solution in place before the leak starts. */
export function parSeconds(level: Level): number {
  return runLive(
    level,
    level.solution.map((fan) => ({ fan, at: -1 })),
  ).seconds;
}

/**
 * Order a solution the way a player would build it: fans the gas meets first come first
 * (by the first point on the winning path their wind touches).
 */
export function orderByNeed(level: Level, fans: Fan[]): Fan[] {
  const solid = solidGrid(level);
  const path = simulate(level, fans).path;
  const firstTouch = (f: Fan) => {
    const beam = beamCells(f.r, f.c, f.dir, f.s, solid);
    const i = path.findIndex((p) => beam.some((b) => b.r === p.r && b.c === p.c));
    return i < 0 ? path.length : i;
  };
  return [...fans].sort((a, b) => firstTouch(a) - firstTouch(b));
}
