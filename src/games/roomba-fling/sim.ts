/**
 * Roomba Fling: simulation, physics and level generation. Plain TS (no React/DOM) so the
 * check script can generate and verify hundreds of levels headlessly.
 *
 * World units: the room interior is W x H (portrait). The Roomba is a circle of radius R.
 * Start is near the bottom wall, the charging dock is on the top wall.
 */

export const W = 360;
export const H = 640;
export const R = 15;
export const MAX_SPEED = 1250;
/** Distance (screen-independent, world units) of a full-power drag. */
export const MAX_DRAG = 150;
export const DOCK_Y = R + 12;
export const DOCK_CAPTURE = 18;
export const CLEAN_CELL = 6;
const STOP_SPEED = 9;

// ---------------------------------------------------------------- random

export type Rng = () => number;
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rr = (rng: Rng, a: number, b: number) => a + (b - a) * rng();
const ri = (rng: Rng, a: number, b: number) => Math.floor(rr(rng, a, b + 1));
function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

// ---------------------------------------------------------------- shapes

export interface RectShape { kind: 'rect'; x: number; y: number; w: number; h: number }
export interface CircleShape { kind: 'circle'; x: number; y: number; r: number }
export type Shape = RectShape | CircleShape;

export type SolidTag = 'furniture' | 'soft' | 'rosie' | 'pillow' | 'gate' | 'glass';
export interface Solid { shape: Shape; bounce: number; tag: SolidTag; /** index of owning piece */ owner: number }

export type PieceType =
  | 'sofa'
  | 'coffee'
  | 'armchair'
  | 'desk'
  | 'bookcase'
  | 'plant'
  | 'lamp'
  | 'sidetable'
  | 'backpack'
  | 'dogbed'
  | 'pillow'
  | 'gate';

export interface Piece {
  type: PieceType;
  /** bounding box */
  x: number;
  y: number;
  w: number;
  h: number;
  /** sofa: which side wall the long part sits on and which end the arm is at */
  side?: 'left' | 'right';
  end?: 'top' | 'bottom';
  /** sofa: rectangles of the two parts (long part first) */
  parts?: RectShape[];
  /** wall-snapped pieces: which wall they lean on */
  wall?: 'left' | 'right' | 'top' | 'bottom';
  /** free variety value 0..1 for art (colours, pot pattern ...) */
  look: number;
  /** pillow: rotation in radians */
  rot?: number;
}

export type ZoneKind = 'rug' | 'puddle';
export interface Zone { kind: ZoneKind; shape: Shape; look: number }

export interface Mover {
  r: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** seconds for one full back-and-forth */
  period: number;
  phase: number;
}

export type RosieSpot = 'floor' | 'couch' | 'bed';
export interface Rosie { where: RosieSpot; x: number; y: number; angle: number; scale: number }

export interface Level {
  level: number;
  seed: number;
  start: { x: number; y: number };
  dock: { x: number; y: number };
  pieces: Piece[];
  solids: Solid[];
  zones: Zone[];
  movers: Mover[];
  rosie: Rosie;
  /** flings available this level (the battery) */
  budget: number;
}

// ---------------------------------------------------------------- geometry helpers

function rectsOverlap(a: RectShape, b: RectShape, gap = 0) {
  return a.x - gap < b.x + b.w && a.x + a.w + gap > b.x && a.y - gap < b.y + b.h && a.y + a.h + gap > b.y;
}
function shapeBBox(s: Shape): RectShape {
  return s.kind === 'rect' ? s : { kind: 'rect', x: s.x - s.r, y: s.y - s.r, w: s.r * 2, h: s.r * 2 };
}
/** Distance from point to shape surface (negative inside for circles, 0 inside rects). */
export function distToShape(px: number, py: number, s: Shape): number {
  if (s.kind === 'circle') return Math.hypot(px - s.x, py - s.y) - s.r;
  const cx = Math.max(s.x, Math.min(px, s.x + s.w));
  const cy = Math.max(s.y, Math.min(py, s.y + s.h));
  return Math.hypot(px - cx, py - cy);
}
export function pointInShape(px: number, py: number, s: Shape): boolean {
  if (s.kind === 'circle') return (px - s.x) ** 2 + (py - s.y) ** 2 <= s.r * s.r;
  return px >= s.x && px <= s.x + s.w && py >= s.y && py <= s.y + s.h;
}

export function moverPos(m: Mover, t: number): { x: number; y: number } {
  // smooth ping-pong (eased at the ends)
  const u = 0.5 - 0.5 * Math.cos(((t / m.period + m.phase) % 1) * Math.PI * 2);
  return { x: m.x0 + (m.x1 - m.x0) * u, y: m.y0 + (m.y1 - m.y0) * u };
}

// ---------------------------------------------------------------- Rosie

/** Collision circles for Rosie lying on the floor, in local space (head toward +x). */
const ROSIE_CIRCLES: [number, number, number][] = [
  [-16, 0, 12],
  [2, 0, 13],
  [20, 2, 10],
  [33, 0, 9],
  [-2, 13, 10],
];
export function rosieCircles(r: Rosie): CircleShape[] {
  const c = Math.cos(r.angle), s = Math.sin(r.angle);
  return ROSIE_CIRCLES.map(([lx, ly, lr]) => ({
    kind: 'circle' as const,
    x: r.x + (lx * c - ly * s) * r.scale,
    y: r.y + (lx * s + ly * c) * r.scale,
    r: lr * r.scale,
  }));
}

// ---------------------------------------------------------------- level generation

interface Difficulty {
  extras: number;
  minGap: number;
  gates: number;
  gateGap: number;
  rugs: number;
  puddles: number;
  pillows: number;
  movers: number;
  budget: number;
}

export function difficulty(level: number): Difficulty {
  const L = Math.max(1, level);
  return {
    extras: Math.min(1 + Math.floor((L - 1) * 0.75), 8),
    minGap: Math.max(2 * R + 14, 74 - L * 3),
    gates: L >= 9 ? 2 : L >= 5 ? 1 : 0,
    gateGap: Math.max(2 * R + 18, 92 - (L - 5) * 4),
    rugs: L >= 3 ? (L >= 7 ? 2 : 1) : 0,
    puddles: L >= 6 ? (L >= 10 ? 2 : 1) : 0,
    pillows: L >= 2 ? Math.min(1 + Math.floor((L - 2) / 3), 3) : 0,
    movers: L >= 4 ? (L >= 8 ? 2 : 1) : 0,
    budget: 8 + Math.floor(L / 3),
  };
}

/** Builds the physics solids from pieces + Rosie. */
export function buildSolids(pieces: Piece[], rosie: Rosie): Solid[] {
  const out: Solid[] = [];
  pieces.forEach((p, i) => {
    const rect = (b: number, tag: SolidTag = 'furniture'): void => {
      out.push({ shape: { kind: 'rect', x: p.x, y: p.y, w: p.w, h: p.h }, bounce: b, tag, owner: i });
    };
    const circ = (b: number, tag: SolidTag = 'furniture', shrink = 0): void => {
      out.push({ shape: { kind: 'circle', x: p.x + p.w / 2, y: p.y + p.h / 2, r: p.w / 2 - shrink }, bounce: b, tag, owner: i });
    };
    switch (p.type) {
      case 'sofa':
        p.parts!.forEach((s) => out.push({ shape: s, bounce: 0.45, tag: 'soft', owner: i }));
        break;
      case 'coffee':
        rect(0.7, 'glass');
        break;
      case 'armchair':
        rect(0.45, 'soft');
        break;
      case 'desk':
      case 'bookcase':
      case 'backpack':
        rect(p.type === 'backpack' ? 0.35 : 0.65, p.type === 'backpack' ? 'soft' : 'furniture');
        break;
      case 'gate':
        rect(0.8, 'gate');
        break;
      case 'plant':
      case 'lamp':
      case 'sidetable':
        circ(0.7);
        break;
      case 'dogbed':
        // with Rosie asleep in it, bumping the bed disturbs her
        circ(0.4, rosie.where === 'bed' ? 'rosie' : 'soft');
        break;
      case 'pillow':
        circ(1.35, 'pillow', 1);
        break;
    }
  });
  if (rosie.where === 'floor') rosieCircles(rosie).forEach((c) => out.push({ shape: c, bounce: 0.5, tag: 'rosie', owner: -1 }));
  return out;
}

interface Builder {
  rng: Rng;
  pieces: Piece[];
  keepouts: Shape[];
  minGap: number;
}

function fits(b: Builder, box: RectShape, gap: number, ignoreGates = false): boolean {
  if (box.x < 0 || box.y < 0 || box.x + box.w > W || box.y + box.h > H) return false;
  for (const k of b.keepouts) {
    const kb = shapeBBox(k);
    if (rectsOverlap(box, kb, 0)) return false;
  }
  for (const p of b.pieces) {
    if (ignoreGates && p.type === 'gate') continue;
    const g = p.type === 'gate' ? Math.max(gap, 2 * R + 12) : gap;
    if (p.parts) {
      if (p.parts.some((s) => rectsOverlap(box, s, g))) return false;
    } else if (rectsOverlap(box, { kind: 'rect', x: p.x, y: p.y, w: p.w, h: p.h }, g)) return false;
  }
  return true;
}

function addPiece(b: Builder, p: Omit<Piece, 'look'> & { look?: number }, gap = b.minGap): boolean {
  const box: RectShape = { kind: 'rect', x: p.x, y: p.y, w: p.w, h: p.h };
  if (p.type === 'sofa') {
    if (!p.parts!.every((s) => fits(b, s, gap))) return false;
  } else if (!fits(b, box, gap)) return false;
  b.pieces.push({ look: b.rng(), ...p });
  return true;
}

function placeSofa(b: Builder): boolean {
  const { rng } = b;
  for (let i = 0; i < 20; i++) {
    const side = rng() < 0.5 ? 'left' : 'right';
    const end = rng() < 0.5 ? 'top' : 'bottom';
    const depth = ri(rng, 58, 66);
    const longLen = ri(rng, 170, 210);
    const armLen = ri(rng, 100, 130);
    const y0 = end === 'top' ? ri(rng, 90, 150) : H - ri(rng, 90, 150) - longLen;
    const x0 = side === 'left' ? 0 : W - depth;
    const long: RectShape = { kind: 'rect', x: x0, y: y0, w: depth, h: longLen };
    const arm: RectShape = {
      kind: 'rect',
      x: side === 'left' ? depth : W - depth - armLen,
      y: end === 'top' ? y0 : y0 + longLen - depth,
      w: armLen,
      h: depth,
    };
    const x = Math.min(long.x, arm.x), y = Math.min(long.y, arm.y);
    const bw = Math.max(long.x + long.w, arm.x + arm.w) - x;
    const bh = Math.max(long.y + long.h, arm.y + arm.h) - y;
    if (addPiece(b, { type: 'sofa', x, y, w: bw, h: bh, side, end, parts: [long, arm] })) return true;
  }
  return false;
}

function placeNear(b: Builder, type: PieceType, w: number, h: number, near: Piece | null, tries = 40): boolean {
  const { rng } = b;
  for (let i = 0; i < tries; i++) {
    let x: number, y: number;
    if (near && near.type === 'sofa' && i < tries / 2) {
      const long = near.parts![0];
      const gap = rr(rng, b.minGap, b.minGap + 30);
      x = near.side === 'left' ? long.x + long.w + gap : long.x - gap - w;
      y = rr(rng, long.y, long.y + long.h - h);
    } else {
      x = rr(rng, 0, W - w);
      y = rr(rng, 60, H - 80 - h);
    }
    if (addPiece(b, { type, x, y, w, h })) return true;
  }
  return false;
}

function placeOnWall(b: Builder, type: PieceType, len: number, depth: number, tries = 40): boolean {
  const { rng } = b;
  for (let i = 0; i < tries; i++) {
    const wall = pick(rng, ['left', 'right', 'left', 'right', 'top', 'bottom'] as const);
    let x: number, y: number, w: number, h: number;
    if (wall === 'left' || wall === 'right') {
      w = depth; h = len;
      x = wall === 'left' ? 0 : W - depth;
      y = rr(rng, 40, H - 40 - len);
    } else {
      w = len; h = depth;
      y = wall === 'top' ? 0 : H - depth;
      x = rr(rng, 0, W - len);
    }
    if (addPiece(b, { type, x, y, w, h, wall })) return true;
  }
  return false;
}

function placeCircle(b: Builder, type: PieceType, r: number, corner: boolean, tries = 40, gap?: number): boolean {
  const { rng } = b;
  for (let i = 0; i < tries; i++) {
    let cx: number, cy: number;
    if (corner && i < tries / 2) {
      cx = rng() < 0.5 ? r + 4 : W - r - 4;
      cy = rr(rng, r + 4, H - r - 4);
    } else {
      cx = rr(rng, r, W - r);
      cy = rr(rng, 70, H - 80);
    }
    const p: Omit<Piece, 'look'> = { type, x: cx - r, y: cy - r, w: r * 2, h: r * 2 };
    if (type === 'pillow') p.rot = rr(rng, -0.6, 0.6);
    if (addPiece(b, p, gap)) return true;
  }
  return false;
}

function placeGate(b: Builder, gapW: number, avoidY: number | null, gapSide: 'left' | 'right' | 'any'): { y: number; gx: number } | null {
  const { rng } = b;
  const T = 8;
  const sofa = b.pieces.find((p) => p.type === 'sofa');
  for (let i = 0; i < 40; i++) {
    const y = rr(rng, 200, 440);
    if (avoidY !== null && Math.abs(y - avoidY) < 110) continue;
    // the gate runs from wall to wall, or from the sofa's side to the far wall
    let xmin = 0, xmax = W;
    if (sofa) {
      const [long, arm] = sofa.parts!;
      if (y + T > arm.y - (2 * R + 12) && y < arm.y + arm.h + 2 * R + 12) continue;
      if (y + T > long.y && y < long.y + long.h) {
        if (sofa.side === 'left') xmin = long.x + long.w; else xmax = long.x;
      }
    }
    const lo = xmin + 10, hi = xmax - 10 - gapW;
    if (hi <= lo) continue;
    const mid = (xmin + xmax) / 2;
    let gx: number;
    if (gapSide === 'left') gx = rr(rng, lo, Math.max(lo, mid - gapW));
    else if (gapSide === 'right') gx = rr(rng, Math.min(hi, mid), hi);
    else gx = rr(rng, lo, hi);
    const segs = ([
      { kind: 'rect', x: xmin, y, w: gx - xmin, h: T },
      { kind: 'rect', x: gx + gapW, y, w: xmax - gx - gapW, h: T },
    ] as RectShape[]).filter((s) => s.w > 4);
    const others = b.pieces.filter((p) => p.type !== 'sofa');
    const saved = b.pieces;
    b.pieces = others;
    const ok = segs.every((s) => fits(b, s, 2 * R + 12));
    b.pieces = saved;
    if (!ok) continue;
    segs.forEach((s) => b.pieces.push({ type: 'gate', x: s.x, y: s.y, w: s.w, h: s.h, look: b.rng() }));
    return { y, gx };
  }
  return null;
}

/** Pieces whose solids block the floor (for clean-% and reachability). */
export function floorBlocked(level: Level, x: number, y: number, pad = 0): boolean {
  for (const s of level.solids) if (distToShape(x, y, s.shape) <= pad) return true;
  return false;
}

/**
 * Reachability proof: BFS on a 4-connected grid of cells of size 4 in configuration space.
 * A cell is free when the Roomba centred there keeps at least R+2 from every solid and wall,
 * so any straight move between neighbouring free cells keeps clearance >= R. Moving obstacles
 * are ignored (they never stand still). Returns the cell path length or -1.
 */
export function reachable(level: Level): number {
  const C = 4;
  const cols = Math.floor(W / C), rows = Math.floor(H / C);
  const clear = R + 2;
  const free = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * C + C / 2, y = r * C + C / 2;
      if (x < clear || y < clear || x > W - clear || y > H - clear) continue;
      let ok = true;
      for (const s of level.solids) {
        if (distToShape(x, y, s.shape) < clear) { ok = false; break; }
      }
      if (ok) free[r * cols + c] = 1;
    }
  }
  const cellOf = (x: number, y: number) => Math.floor(y / C) * cols + Math.floor(x / C);
  const s = cellOf(level.start.x, level.start.y);
  if (!free[s]) return -1;
  const goalX = level.dock.x, goalY = level.dock.y;
  const dist = new Int32Array(cols * rows).fill(-1);
  const q = new Int32Array(cols * rows);
  let qh = 0, qt = 0;
  q[qt++] = s; dist[s] = 0;
  while (qh < qt) {
    const cur = q[qh++];
    const cx = cur % cols, cy = (cur - cx) / cols;
    const x = cx * C + C / 2, y = cy * C + C / 2;
    if (Math.hypot(x - goalX, y - goalY) < DOCK_CAPTURE - 2) return dist[cur];
    const nb = [cx > 0 ? cur - 1 : -1, cx < cols - 1 ? cur + 1 : -1, cy > 0 ? cur - cols : -1, cy < rows - 1 ? cur + cols : -1];
    for (const n of nb) {
      if (n >= 0 && free[n] && dist[n] < 0) { dist[n] = dist[cur] + 1; q[qt++] = n; }
    }
  }
  return -1;
}

function tryBuild(level: number, seed: number, rng: Rng, relax: number): Level | null {
  const d = difficulty(level);
  const start = { x: rr(rng, 50, W - 50), y: H - 40 };
  const dock = { x: rr(rng, 50, W - 50), y: DOCK_Y };
  const b: Builder = {
    rng,
    pieces: [],
    keepouts: [
      { kind: 'circle', x: start.x, y: start.y, r: 52 },
      { kind: 'circle', x: dock.x, y: dock.y, r: 60 },
    ],
    minGap: d.minGap + relax * 4,
  };

  if (!placeSofa(b)) return null;
  const sofa = b.pieces.find((p) => p.type === 'sofa')!;

  // Pet gates span the room (wall or sofa to wall) with one opening; furniture fits around them.
  let gate: { y: number; gx: number } | null = null;
  for (let g = 0; g < d.gates; g++) {
    // a second gate opens on the other side, so the Roomba has to zig-zag
    const side = !gate ? 'any' : gate.gx < W / 2 - 40 ? 'right' : 'left';
    const next = placeGate(b, d.gateGap + relax * 3, gate ? gate.y : null, side);
    if (!next) return null;
    gate = next;
  }

  placeNear(b, 'coffee', ri(rng, 84, 104), ri(rng, 52, 62), sofa);

  // Rosie's spot
  const spots: RosieSpot[] = ['floor', 'couch', 'bed'];
  const where = pick(rng, spots);
  let rosie: Rosie | null = null;
  if (where === 'bed') {
    if (placeCircle(b, 'dogbed', 34, true)) {
      const bed = b.pieces[b.pieces.length - 1];
      rosie = { where: 'bed', x: bed.x + bed.w / 2, y: bed.y + bed.h / 2, angle: rr(rng, 0, Math.PI * 2), scale: 0.72 };
    }
  }
  if (!rosie && where !== 'floor') {
    const long = sofa.parts![0];
    const angle = (rng() < 0.5 ? 1 : -1) * Math.PI / 2;
    rosie = { where: 'couch', x: long.x + long.w / 2 + (sofa.side === 'left' ? -2 : 2), y: rr(rng, long.y + 70, long.y + long.h - 50), angle, scale: 0.86 };
  }
  if (!rosie) {
    for (let i = 0; i < 40 && !rosie; i++) {
      const cand: Rosie = { where: 'floor', x: rr(rng, 60, W - 60), y: rr(rng, 110, H - 130), angle: rr(rng, 0, Math.PI * 2), scale: 1 };
      const box: RectShape = { kind: 'rect', x: cand.x - 42, y: cand.y - 42, w: 84, h: 84 };
      if (fits(b, box, Math.max(b.minGap - 24, 2 * R + 6))) rosie = cand;
    }
    if (!rosie) return null;
    b.keepouts.push({ kind: 'circle', x: rosie.x, y: rosie.y, r: 42 + Math.max(b.minGap - 24, 2 * R + 6) });
  }

  // Extra furniture, a mix of wall pieces and free-standing ones.
  const pool: (() => boolean)[] = [
    () => placeNear(b, 'armchair', ri(rng, 56, 64), ri(rng, 56, 64), null),
    () => placeOnWall(b, 'desk', ri(rng, 100, 124), ri(rng, 46, 54)),
    // tall white bookcase: a compact, deep unit against a wall
    () => placeOnWall(b, 'bookcase', ri(rng, 58, 72), ri(rng, 36, 42)),
    () => placeCircle(b, 'plant', ri(rng, 15, 20), true),
    () => placeCircle(b, 'lamp', 11, true),
    () => placeCircle(b, 'sidetable', ri(rng, 17, 21), false),
    () => placeNear(b, 'backpack', ri(rng, 32, 38), ri(rng, 26, 30), null),
  ];
  const order = pool.map((f, i) => ({ f, k: rng() + (i < 3 ? -0.3 : 0) })).sort((a, c) => a.k - c.k);
  let placed = 0;
  for (let i = 0; placed < d.extras && i < order.length * 2; i++) {
    if (order[i % order.length].f()) placed++;
  }
  for (let i = 0; i < d.pillows; i++) placeCircle(b, 'pillow', 15, false, 30, Math.max(b.minGap - 10, 2 * R + 10));

  // Zones (rugs slow you down, puddles are slippery). They never collide.
  const zones: Zone[] = [];
  const zoneFree = (z: Shape) => {
    const zb = shapeBBox(z);
    if (b.keepouts.slice(0, 2).some((k) => rectsOverlap(zb, shapeBBox(k), 0))) return false;
    return zones.every((o) => !rectsOverlap(zb, shapeBBox(o.shape), 8));
  };
  for (let i = 0; i < d.rugs; i++) {
    for (let tries = 0; tries < 20; tries++) {
      let shape: Shape;
      if (rng() < 0.55) shape = { kind: 'circle', x: rr(rng, 80, W - 80), y: rr(rng, 150, H - 170), r: ri(rng, 52, 72) };
      else {
        const w = ri(rng, 120, 170), h = ri(rng, 80, 120);
        shape = { kind: 'rect', x: rr(rng, 20, W - 20 - w), y: rr(rng, 120, H - 140 - h), w, h };
      }
      if (zoneFree(shape)) { zones.push({ kind: 'rug', shape, look: rng() }); break; }
    }
  }
  for (let i = 0; i < d.puddles; i++) {
    for (let tries = 0; tries < 20; tries++) {
      const shape: Shape = { kind: 'circle', x: rr(rng, 70, W - 70), y: rr(rng, 140, H - 150), r: ri(rng, 34, 46) };
      if (zoneFree(shape)) { zones.push({ kind: 'puddle', shape, look: rng() }); break; }
    }
  }

  const solids = buildSolids(b.pieces, rosie);
  const lvl: Level = { level, seed, start, dock, pieces: b.pieces, solids, zones, movers: [], rosie, budget: d.budget };

  // Moving obstacles: Rosie's tennis ball rolling back and forth along a clear lane.
  for (let m = 0; m < d.movers; m++) {
    for (let i = 0; i < 40; i++) {
      const y = rr(rng, 130, H - 140);
      const x0 = rr(rng, 20, W / 2 - 40), x1 = rr(rng, W / 2 + 40, W - 20);
      const r = 10;
      let ok = Math.abs(y - start.y) > 70 && Math.abs(y - dock.y) > 70;
      for (let x = x0; ok && x <= x1; x += 4) if (floorBlocked(lvl, x, y, r + 3)) ok = false;
      if (ok && lvl.movers.some((o) => Math.abs(o.y0 - y) < 60)) ok = false;
      if (ok) {
        lvl.movers.push({ r, x0, y0: y, x1, y1: y, period: rr(rng, 3.2, 5) * (1 - Math.min(level, 14) * 0.025), phase: rng() });
        break;
      }
    }
  }
  return lvl;
}

/** Fallback layout that is reachable by construction (sofa on a side wall, Rosie on it). */
function fallback(level: number, seed: number): Level {
  const parts: RectShape[] = [
    { kind: 'rect', x: 0, y: 200, w: 60, h: 190 },
    { kind: 'rect', x: 60, y: 330, w: 110, h: 60 },
  ];
  const pieces: Piece[] = [{ type: 'sofa', x: 0, y: 200, w: 170, h: 190, side: 'left', end: 'bottom', parts, look: 0.3 }];
  const rosie: Rosie = { where: 'couch', x: 28, y: 260, angle: Math.PI / 2, scale: 0.86 };
  return {
    level, seed, start: { x: W / 2, y: H - 40 }, dock: { x: W / 2, y: DOCK_Y }, pieces,
    solids: buildSolids(pieces, rosie), zones: [], movers: [], rosie, budget: difficulty(level).budget,
  };
}

export function generateLevel(level: number, seed: number = Math.floor(Math.random() * 2 ** 31)): Level {
  const rng = mulberry32(seed);
  for (let attempt = 0; attempt < 120; attempt++) {
    const relax = Math.floor(attempt / 30);
    const l = tryBuild(level, seed, rng, relax);
    if (l && reachable(l) >= 0) return l;
  }
  return fallback(level, seed);
}

// ---------------------------------------------------------------- physics

export interface Body { x: number; y: number; vx: number; vy: number }
export interface Hit { tag: SolidTag | 'wall' | 'ball'; speed: number; owner: number; x: number; y: number }

export function zoneAt(level: Level, x: number, y: number): ZoneKind | null {
  let out: ZoneKind | null = null;
  for (const z of level.zones) if (pointInShape(x, y, z.shape)) out = z.kind === 'puddle' ? 'puddle' : out ?? 'rug';
  return out;
}

function collideShape(b: Body, s: Shape, bounce: number, mvx = 0, mvy = 0): number {
  let nx = 0, ny = 0, pen = 0;
  if (s.kind === 'circle') {
    const dx = b.x - s.x, dy = b.y - s.y;
    const d = Math.hypot(dx, dy);
    if (d >= s.r + R) return 0;
    if (d < 1e-6) { nx = 0; ny = -1; } else { nx = dx / d; ny = dy / d; }
    pen = s.r + R - d;
  } else {
    const cx = Math.max(s.x, Math.min(b.x, s.x + s.w));
    const cy = Math.max(s.y, Math.min(b.y, s.y + s.h));
    const dx = b.x - cx, dy = b.y - cy;
    const d = Math.hypot(dx, dy);
    if (d >= R) return 0;
    if (d > 1e-6) { nx = dx / d; ny = dy / d; pen = R - d; } else {
      // centre inside the rect: push out along the shortest axis
      const l = b.x - s.x, r = s.x + s.w - b.x, t = b.y - s.y, bo = s.y + s.h - b.y;
      const m = Math.min(l, r, t, bo);
      if (m === l) { nx = -1; pen = l + R; } else if (m === r) { nx = 1; pen = r + R; } else if (m === t) { ny = -1; pen = t + R; } else { ny = 1; pen = bo + R; }
    }
  }
  b.x += nx * pen;
  b.y += ny * pen;
  const rvx = b.vx - mvx, rvy = b.vy - mvy;
  const vn = rvx * nx + rvy * ny;
  if (vn >= 0) return 0;
  // reflect normal part, keep most of the tangential part (slight scrub)
  const tx = rvx - vn * nx, ty = rvy - vn * ny;
  const nvx = tx * 0.96 - vn * bounce * nx, nvy = ty * 0.96 - vn * bounce * ny;
  b.vx = nvx + mvx;
  b.vy = nvy + mvy;
  return -vn;
}

/** Advances the body by dt (call with small dt, e.g. 1/240). Pushes impacts into hits. */
export function step(level: Level, b: Body, t: number, dt: number, hits?: Hit[]): void {
  const zone = zoneAt(level, b.x, b.y);
  const k = zone === 'rug' ? 3.2 : zone === 'puddle' ? 0.12 : 0.85;
  const decel = zone === 'rug' ? 240 : zone === 'puddle' ? 8 : 70;
  const sp = Math.hypot(b.vx, b.vy);
  if (sp > 0) {
    let ns = sp * Math.exp(-k * dt) - decel * dt;
    if (ns < STOP_SPEED && zone !== 'puddle') ns = 0;
    if (ns < 2) ns = 0;
    b.vx *= ns / sp;
    b.vy *= ns / sp;
  }
  b.x += b.vx * dt;
  b.y += b.vy * dt;

  // walls
  const wb = 0.78;
  if (b.x < R) { b.x = R; if (b.vx < 0) { hits?.push({ tag: 'wall', speed: -b.vx, owner: -1, x: 0, y: b.y }); b.vx = -b.vx * wb; } }
  if (b.x > W - R) { b.x = W - R; if (b.vx > 0) { hits?.push({ tag: 'wall', speed: b.vx, owner: -1, x: W, y: b.y }); b.vx = -b.vx * wb; } }
  if (b.y < R) { b.y = R; if (b.vy < 0) { hits?.push({ tag: 'wall', speed: -b.vy, owner: -1, x: b.x, y: 0 }); b.vy = -b.vy * wb; } }
  if (b.y > H - R) { b.y = H - R; if (b.vy > 0) { hits?.push({ tag: 'wall', speed: b.vy, owner: -1, x: b.x, y: H }); b.vy = -b.vy * wb; } }

  for (const s of level.solids) {
    const imp = collideShape(b, s.shape, s.bounce);
    if (imp > 0) {
      if (s.tag === 'pillow') {
        // pinball bumper: always kicks out with a minimum speed
        const v = Math.hypot(b.vx, b.vy);
        const want = Math.min(MAX_SPEED, Math.max(v, 420));
        if (v > 0) { b.vx *= want / v; b.vy *= want / v; }
      }
      hits?.push({ tag: s.tag, speed: imp, owner: s.owner, x: b.x, y: b.y });
    }
  }
  for (let i = 0; i < level.movers.length; i++) {
    const m = level.movers[i];
    const p = moverPos(m, t);
    const p2 = moverPos(m, t + 0.01);
    const imp = collideShape(b, { kind: 'circle', x: p.x, y: p.y, r: m.r }, 0.95, (p2.x - p.x) * 100, (p2.y - p.y) * 100);
    if (imp > 0) hits?.push({ tag: 'ball', speed: imp, owner: i, x: b.x, y: b.y });
  }
  const v = Math.hypot(b.vx, b.vy);
  if (v > MAX_SPEED) { b.vx *= MAX_SPEED / v; b.vy *= MAX_SPEED / v; }
}

export function atDock(level: Level, b: Body): boolean {
  return Math.hypot(b.x - level.dock.x, b.y - level.dock.y) < DOCK_CAPTURE;
}

/** Fling velocity from a drag vector (world units, pointing where the Roomba should go). */
export function flingVelocity(dx: number, dy: number): { vx: number; vy: number; power: number } {
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return { vx: 0, vy: 0, power: 0 };
  const power = Math.min(1, len / MAX_DRAG);
  // ease-in so small drags give fine control
  const speed = MAX_SPEED * (0.12 + 0.88 * power * power) * (power > 0 ? 1 : 0);
  return { vx: (dx / len) * speed, vy: (dy / len) * speed, power };
}

/** Trajectory preview: positions until the first bounce plus a little, or until it stops. */
export function predict(level: Level, from: Body, t: number, maxTime = 1.1): { x: number; y: number }[] {
  const b = { ...from };
  const pts: { x: number; y: number }[] = [];
  const dt = 1 / 240;
  let bounces = 0, after = 0;
  const hits: Hit[] = [];
  for (let i = 0; i < maxTime / dt; i++) {
    hits.length = 0;
    step(level, b, t + i * dt, dt, hits);
    if (hits.length) bounces++;
    if (bounces > 0) after++;
    if (i % 6 === 0) pts.push({ x: b.x, y: b.y });
    if ((b.vx === 0 && b.vy === 0) || after > 50 || atDock(level, b)) break;
  }
  return pts;
}

// ---------------------------------------------------------------- cleaning

export interface CleanGrid {
  cols: number;
  rows: number;
  /** 0 = blocked (not floor), 1 = dirty, 2 = clean */
  cells: Uint8Array;
  total: number;
  cleaned: number;
}

export function makeCleanGrid(level: Level): CleanGrid {
  const cols = Math.ceil(W / CLEAN_CELL), rows = Math.ceil(H / CLEAN_CELL);
  const cells = new Uint8Array(cols * rows);
  let total = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * CLEAN_CELL + CLEAN_CELL / 2, y = r * CLEAN_CELL + CLEAN_CELL / 2;
      // a cell counts as floor when a Roomba could physically touch it
      const reach = x >= 2 && y >= 2 && x <= W - 2 && y <= H - 2 && !floorBlocked(level, x, y, 1);
      if (reach) { cells[r * cols + c] = 1; total++; }
    }
  }
  return { cols, rows, cells, total, cleaned: 0 };
}

export const CLEAN_RADIUS = R * 0.9;
export function cleanAt(g: CleanGrid, x: number, y: number): number {
  const rad = CLEAN_RADIUS;
  const c0 = Math.max(0, Math.floor((x - rad) / CLEAN_CELL)), c1 = Math.min(g.cols - 1, Math.floor((x + rad) / CLEAN_CELL));
  const r0 = Math.max(0, Math.floor((y - rad) / CLEAN_CELL)), r1 = Math.min(g.rows - 1, Math.floor((y + rad) / CLEAN_CELL));
  let n = 0;
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const i = r * g.cols + c;
      if (g.cells[i] !== 1) continue;
      const cx = c * CLEAN_CELL + CLEAN_CELL / 2, cy = r * CLEAN_CELL + CLEAN_CELL / 2;
      if ((cx - x) ** 2 + (cy - y) ** 2 <= rad * rad) { g.cells[i] = 2; n++; }
    }
  }
  g.cleaned += n;
  return n;
}
export const cleanPct = (g: CleanGrid) => (g.total ? g.cleaned / g.total : 0);

// ---------------------------------------------------------------- scoring

/** Points lost each time the Roomba bumps Rosie and wakes her from her nap. */
export const ROSIE_PENALTY = 150;
/** Bumps closer together than this (seconds) count as one disturbance. */
export const ROSIE_COOLDOWN = 1.2;

export interface LevelScore { cleanPts: number; flingPts: number; rosiePts: number; bumps: number; total: number; pct: number }
/**
 * Score per level: % of the floor cleaned (x12 per percent) + 100 per unused battery bar,
 * minus ROSIE_PENALTY for every time Rosie was disturbed. Never below 0.
 */
export function levelScore(flings: number, pct: number, budget: number, bumps = 0): LevelScore {
  const p = Math.round(pct * 100);
  const cleanPts = p * 12;
  const flingPts = Math.max(0, budget - flings) * 100;
  const rosiePts = bumps * ROSIE_PENALTY;
  return { cleanPts, flingPts, rosiePts, bumps, total: Math.max(0, cleanPts + flingPts - rosiePts), pct: p };
}
