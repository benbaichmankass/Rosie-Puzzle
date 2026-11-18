/**
 * Squeegee Survival canvas renderer. Scene is drawn in a fixed 390x600 "scene space" and scaled
 * to the canvas. The static room is painted once into an offscreen canvas; water, Bentzi, shelf
 * items, bubbles and effects are drawn every frame.
 */
import * as S from './sim';
import {
  INK, PAPER, type Ctx, type Pt, ellipsePts, hatchPoly, hatchRect, inkLine, paper, pathFrom, rectPts, rng, wash,
} from './ink';

export const SW = 390;
export const SH = 600;
const X0 = 18;
const DX = (372 - X0) / (S.N - 1);
const Y_LOW = 520;
const ZS = 22;
export const X = (i: number) => X0 + i * DX;
export const Y = (z: number) => Y_LOW - z * ZS;
const CAB_L = 296, CAB_R = 382;
const COUNTER_Y = Y(9.4);
const SHELF_Y = S.SHELF_LEVELS.map((l) => Y(l - 0.5));
const HEAD: Pt = [44, 124]; // shower head nozzle

function bedAt(bed: Float64Array, x: number): number {
  const i = Math.max(0, Math.min(S.N - 2, Math.floor(x)));
  const f = Math.max(0, Math.min(1, x - i));
  return bed[i] * (1 - f) + bed[i + 1] * f;
}

interface Bubble { x: number; y: number; r: number; vx: number; vy: number; life: number; hue: number }
interface Drop { x: number; y: number; vx: number; vy: number; life: number }

export interface View {
  bg: HTMLCanvasElement | null;
  bgKey: string;
  bubbles: Bubble[];
  drops: Drop[];
  flash: number;
  zapT: number; // seconds since electrocution (-1 = alive)
  shake: number;
  rnd: () => number;
}

export function createView(): View {
  return { bg: null, bgKey: '', bubbles: [], drops: [], flash: 0, zapT: -1, shake: 0, rnd: rng(99) };
}

/* ------------------------------------------------------------------ static room */

function paintRoom(c: Ctx, bed: Float64Array): void {
  paper(c, SW, SH, 4);
  const floorPts: Pt[] = [[0, Y(bed[0])]];
  for (let i = 0; i < S.N; i++) floorPts.push([X(i), Y(bed[i])]);
  floorPts.push([SW, Y(0)]);

  // back wall: plaster above, tiles below
  const tileTop = 196;
  wash(c, [[0, 0], [SW, 0], [SW, tileTop], [0, tileTop]], '#9fb7ae', 21, 0.28, 3, 3);
  wash(c, [[0, 0], [SW, 0], [SW, 26], [0, 26]], '#6f7f86', 22, 0.2, 2, 2);
  hatchRect(c, 0, 0, SW, 30, -0.6, 4, 31, 0.6, INK, 0.35);
  // tiles: warm cream with a few blue-green ones, slightly irregular
  const r = rng(77);
  const tile = 24;
  const wallBottom: Pt[] = [[0, tileTop], [SW, tileTop], ...floorPts.slice().reverse()];
  c.save();
  pathFrom(c, wallBottom);
  c.clip();
  for (let ty = tileTop; ty < Y_LOW + 4; ty += tile) {
    for (let tx = 0; tx < SW; tx += tile) {
      const col = r() < 0.18 ? '#7fa7a4' : r() < 0.5 ? '#efe0bf' : '#e6d3ad';
      wash(c, rectPts(tx + 1.5, ty + 1.5, tile - 3, tile - 3), col, 100 + tx * 7 + ty, 0.35, 0.8, 2);
    }
  }
  for (let ty = tileTop; ty < Y_LOW + 4; ty += tile) inkLine(c, [[0, ty], [SW, ty]], 300 + ty, 0.9, 0.6, INK);
  for (let tx = 0; tx < SW; tx += tile) inkLine(c, [[tx, tileTop], [tx, Y_LOW]], 400 + tx, 0.9, 0.6, INK);
  // shadow toward the floor and the corners
  hatchRect(c, 0, 300, SW, 230, -0.75, 4.5, 51, 0.6, INK, 0.22);
  hatchRect(c, 0, tileTop, 40, 340, 0.8, 4, 52, 0.6, INK, 0.25);
  c.restore();
  inkLine(c, [[0, tileTop], [SW, tileTop]], 5, 1, 1.4);
  inkLine(c, [[0, tileTop + 4], [SW, tileTop + 4]], 6, 1, 0.7);

  // little round window with a moon
  const wx = 168, wy = 92, wr = 34;
  wash(c, ellipsePts(wx, wy, wr, wr, 28), '#2f4a6b', 61, 0.55, 1, 3);
  c.save();
  pathFrom(c, ellipsePts(wx, wy, wr, wr, 28));
  c.clip();
  hatchRect(c, wx - wr, wy - wr, wr * 2, wr * 2, -0.5, 3, 62, 0.6, INK, 0.45);
  hatchRect(c, wx - wr, wy - wr, wr * 2, wr * 2, 0.9, 3.4, 63, 0.6, INK, 0.3);
  // crescent moon
  c.fillStyle = '#f6e7a8';
  c.beginPath();
  c.arc(wx + 10, wy - 8, 11, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#2f4a6b';
  c.beginPath();
  c.arc(wx + 15, wy - 12, 9.5, 0, Math.PI * 2);
  c.fill();
  for (const [sx, sy] of [[wx - 16, wy - 14], [wx - 8, wy + 12], [wx + 18, wy + 14], [wx - 20, wy + 4]] as Pt[]) {
    c.fillStyle = '#f6e7a8';
    c.fillRect(sx - 1, sy - 1, 2, 2);
  }
  c.restore();
  inkLine(c, ellipsePts(wx, wy, wr, wr, 28), 64, 1, 1.6);
  inkLine(c, ellipsePts(wx, wy, wr + 5, wr + 5, 30), 65, 1.2, 1.1);
  inkLine(c, [[wx - wr, wy], [wx + wr, wy]], 66, 0.8, 1.1);
  inkLine(c, [[wx, wy - wr], [wx, wy + wr]], 67, 0.8, 1.1);

  // left wall edge (shower corner)
  wash(c, [[0, 0], [12, 0], [12, Y(bed[0])], [0, Y(bed[0])]], '#8c9a90', 70, 0.4, 1, 2);
  hatchPoly(c, [[0, 0], [12, 0], [12, Y(bed[0])], [0, Y(bed[0])]], 2, 3, 71, 0.3, 0.45);
  inkLine(c, [[12, 0], [12, Y(bed[0])]], 72, 1, 1.4);

  // shower pipe, arm and head
  inkLine(c, [[16, 30], [16, 104], [30, 112]], 80, 0.6, 3.2, '#5d5a52');
  inkLine(c, [[16, 30], [16, 104], [30, 112]], 81, 0.8, 1.1);
  const headPts: Pt[] = [[26, 106], [50, 116], [46, 132], [30, 124]];
  wash(c, headPts, '#b8b3a6', 82, 0.6, 0.6, 2);
  hatchPoly(c, headPts, 1, 2.5, 83, 0.4, 0.5);
  inkLine(c, headPts, 84, 0.7, 1.3, INK, true);
  // tap handles
  inkLine(c, ellipsePts(16, 168, 6, 6, 14), 85, 0.6, 1.2);
  inkLine(c, [[10, 168], [22, 168]], 86, 0.4, 1.2);
  // curtain bunched in the corner
  const cur: Pt[] = [[13, 22], [40, 22], [36, 80], [42, 150], [30, 210], [36, 268], [16, 280], [13, 280]];
  wash(c, cur, '#c96f5c', 90, 0.35, 2, 3);
  hatchPoly(c, cur, 1, 3.5, 91, 1.35, 0.35);
  inkLine(c, cur, 92, 1.2, 1.2, INK, true);
  for (const fx of [20, 27, 33]) inkLine(c, [[fx, 26], [fx - 2, 120], [fx + 1, 200], [fx - 3, 270]], 93 + fx, 1.5, 0.7);
  inkLine(c, [[8, 20], [120, 20]], 97, 0.6, 2);
  for (let k = 0; k < 4; k++) inkLine(c, ellipsePts(16 + k * 7, 22, 3, 3, 8), 98 + k, 0.3, 0.8);

  // towel on a hook (decor)
  const tw: Pt[] = [[226, 210], [256, 210], [260, 276], [222, 280]];
  wash(c, tw, '#d9a441', 110, 0.45, 1.5, 3);
  hatchPoly(c, tw, 1, 3.4, 111, 1.4, 0.4);
  inkLine(c, tw, 112, 1, 1.2, INK, true);
  inkLine(c, [[222, 262], [260, 258]], 113, 0.8, 0.8);
  inkLine(c, [[222, 268], [260, 264]], 114, 0.8, 0.8);
  inkLine(c, ellipsePts(241, 204, 4, 4, 10), 115, 0.3, 1.2);

  // vanity: mirror, counter, sink, open cabinet
  const mx = 339, my = 222;
  wash(c, ellipsePts(mx, my, 32, 44, 30), '#cfe0e0', 120, 0.5, 1, 3);
  c.save();
  pathFrom(c, ellipsePts(mx, my, 32, 44, 30));
  c.clip();
  hatchRect(c, mx - 32, my - 44, 64, 88, -1.0, 7, 121, 0.6, INK, 0.25);
  c.restore();
  inkLine(c, ellipsePts(mx, my, 32, 44, 30), 122, 1, 1.6);
  inkLine(c, ellipsePts(mx, my, 36, 48, 30), 123, 1.2, 1.2);
  wash(c, ellipsePts(mx, my, 36, 48, 30).concat(ellipsePts(mx, my, 32, 44, 30).reverse()), '#a8742f', 124, 0.45, 0.5, 2);

  // cabinet body
  const body: Pt[] = [[CAB_L, COUNTER_Y], [CAB_R, COUNTER_Y], [CAB_R, Y_LOW], [CAB_L, Y_LOW]];
  wash(c, body, '#5b3e2a', 130, 0.55, 1, 3);
  hatchPoly(c, body, 3, 3, 131, -0.8, 0.5);
  // inner frame
  const inner: Pt[] = [[CAB_L + 6, COUNTER_Y + 10], [CAB_R - 6, COUNTER_Y + 10], [CAB_R - 6, Y_LOW], [CAB_L + 6, Y_LOW]];
  wash(c, inner, '#2c1f18', 132, 0.45, 0.5, 2);
  inkLine(c, inner, 133, 0.8, 1.2, INK, true);
  inkLine(c, body, 134, 1, 1.6, INK, true);
  // shelves
  SHELF_Y.forEach((sy, k) => {
    const sh: Pt[] = [[CAB_L + 6, sy], [CAB_R - 6, sy], [CAB_R - 6, sy + 5], [CAB_L + 6, sy + 5]];
    wash(c, sh, '#c49a6c', 140 + k, 0.7, 0.4, 2);
    inkLine(c, sh, 145 + k, 0.6, 1.1, INK, true);
  });
  // open door swung toward us on the left
  const door: Pt[] = [[CAB_L, COUNTER_Y + 4], [CAB_L - 16, COUNTER_Y + 16], [CAB_L - 16, Y_LOW - 8], [CAB_L, Y_LOW - 2]];
  wash(c, door, '#7a5638', 150, 0.6, 0.6, 3);
  hatchPoly(c, door, 1, 3, 151, 0.3, 0.45);
  inkLine(c, door, 152, 0.8, 1.3, INK, true);
  inkLine(c, ellipsePts(CAB_L - 11, (COUNTER_Y + Y_LOW) / 2, 1.8, 3, 8), 153, 0.2, 1.2);
  // counter
  const ctr: Pt[] = [[CAB_L - 8, COUNTER_Y - 8], [SW, COUNTER_Y - 8], [SW, COUNTER_Y + 2], [CAB_L - 8, COUNTER_Y + 2]];
  wash(c, ctr, '#d8d0c0', 160, 0.8, 0.4, 2);
  inkLine(c, ctr, 161, 0.6, 1.3, INK, true);
  // basin and tap
  const basin = ellipsePts(339, COUNTER_Y - 8, 28, 7, 20, Math.PI, Math.PI * 2);
  wash(c, basin, '#f4f1ea', 162, 0.9, 0.3, 2);
  inkLine(c, basin, 163, 0.5, 1.2);
  inkLine(c, [[352, COUNTER_Y - 14], [352, COUNTER_Y - 30], [334, COUNTER_Y - 30], [334, COUNTER_Y - 24]], 164, 0.5, 2.6, '#7d7a72');
  inkLine(c, [[352, COUNTER_Y - 14], [352, COUNTER_Y - 30], [334, COUNTER_Y - 30], [334, COUNTER_Y - 24]], 165, 0.6, 1);
  // a toothbrush cup on the counter
  const cup = rectPts(366, COUNTER_Y - 22, 10, 14);
  wash(c, cup, '#6c9ac0', 166, 0.6, 0.3, 2);
  inkLine(c, cup, 167, 0.4, 1, INK, true);
  inkLine(c, [[369, COUNTER_Y - 22], [367, COUNTER_Y - 32]], 168, 0.3, 1.2);
  // the wall socket for the chargers (inside the cabinet, top shelf)
  const sock = rectPts(CAB_R - 16, SHELF_Y[2] - 30, 8, 10);
  wash(c, sock, '#efe7d6', 169, 0.9, 0.2, 1);
  inkLine(c, sock, 170, 0.3, 1, INK, true);

  // floor slab in cross-section
  const slab: Pt[] = [...floorPts, [SW, SH], [0, SH]];
  wash(c, slab, '#a88a6a', 180, 0.5, 1, 3);
  hatchPoly(c, slab, 2, 4.5, 181, 0.8, 0.35);
  // floor tiles along the top edge
  const tileStrip: Pt[] = [...floorPts, ...floorPts.slice().reverse().map(([x, y]) => [x, y + 7] as Pt)];
  wash(c, tileStrip, '#d9cbb0', 182, 0.85, 0.4, 2);
  for (let i = 2; i < S.N; i += 4) {
    const x = X(i), y = Y(bed[i]);
    inkLine(c, [[x, y], [x, y + 7]], 190 + i, 0.3, 0.8);
  }
  inkLine(c, floorPts, 183, 0.6, 1.8);
  inkLine(c, floorPts.map(([x, y]) => [x, y + 7] as Pt), 184, 0.6, 0.8);
  // drain pipe going down from the drain
  const d0 = X(S.DRAIN_CELLS[0]) - 1, d1 = X(S.DRAIN_CELLS[S.DRAIN_CELLS.length - 1]) + 1;
  const dy = Y(bed[2]);
  const pipe: Pt[] = [[d0 + 2, dy + 2], [d1 - 2, dy + 2], [d1 - 2, SH], [d0 + 2, SH]];
  wash(c, pipe, '#3b3a38', 185, 0.7, 0.3, 2);
  inkLine(c, pipe, 186, 0.5, 1.2, INK, true);
  // drain grate
  for (let k = 0; k < 4; k++) inkLine(c, [[d0 + 3 + k * 4, dy - 1], [d0 + 3 + k * 4, dy + 4]], 187 + k, 0.2, 1.2);
  inkLine(c, [[d0, dy], [d1, dy]], 188, 0.2, 2);
  // signature-like floor shadow under the vanity
  hatchRect(c, CAB_L - 20, Y_LOW - 12, 110, 12, -0.2, 3, 199, 0.6, INK, 0.3);
}

function ensureBg(v: View, bed: Float64Array, scale: number): HTMLCanvasElement {
  const key = String(scale);
  if (v.bg && v.bgKey === key) return v.bg;
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(SW * scale);
  cv.height = Math.ceil(SH * scale);
  const c = cv.getContext('2d')!;
  c.scale(scale, scale);
  paintRoom(c, bed);
  v.bg = cv;
  v.bgKey = key;
  return cv;
}

/* ------------------------------------------------------------------ shelf items */

function drawShelfItems(c: Ctx, s: S.State, t: number): void {
  const [y0, y1, y2] = SHELF_Y;
  const L = CAB_L + 10;
  // bottom: cleaning supplies (spray bottle, bleach jug, sponge)
  const wet0 = s.flooded[0];
  const spray: Pt[] = [[L, y0], [L + 12, y0], [L + 12, y0 - 20], [L + 9, y0 - 24], [L + 9, y0 - 30], [L + 2, y0 - 30], [L + 2, y0 - 24], [L, y0 - 20]];
  wash(c, spray, '#4f8fc0', 201, 0.7, 0.4, 2);
  inkLine(c, spray, 202, 0.5, 1.1, INK, true);
  inkLine(c, [[L + 2, y0 - 30], [L - 4, y0 - 28]], 203, 0.3, 1.4);
  const jug: Pt[] = [[L + 18, y0], [L + 38, y0], [L + 38, y0 - 22], [L + 32, y0 - 28], [L + 24, y0 - 28], [L + 18, y0 - 22]];
  wash(c, jug, '#f2efe6', 204, 0.9, 0.4, 2);
  hatchPoly(c, jug, 1, 3, 205, 0.4, 0.3);
  inkLine(c, jug, 206, 0.5, 1.1, INK, true);
  wash(c, rectPts(L + 25, y0 - 33, 6, 5), '#c0392b', 207, 0.9, 0.2, 1);
  inkLine(c, rectPts(L + 25, y0 - 33, 6, 5), 208, 0.2, 1, INK, true);
  wash(c, rectPts(L + 22, y0 - 16, 12, 8), '#4f8fc0', 209, 0.5, 0.2, 1);
  const sp = rectPts(L + 44, y0 - 9, 18, 9);
  wash(c, sp, '#e8c547', 210, 0.85, 0.3, 2);
  wash(c, rectPts(L + 44, y0 - 9, 18, 3), '#5e9a4b', 211, 0.85, 0.2, 1);
  inkLine(c, sp, 212, 0.4, 1, INK, true);
  if (wet0) {
    // foam spilling out of the shelf
    const r = rng(213);
    for (let k = 0; k < 12; k++) {
      const bx = L + r() * 60, by = y0 - 4 - r() * 12 + Math.sin(t * 2 + k) * 1.5;
      c.fillStyle = 'rgba(255,255,255,0.85)';
      c.beginPath(); c.arc(bx, by, 3 + r() * 4, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(43,32,22,0.5)'; c.lineWidth = 0.6; c.stroke();
    }
  }
  // middle: toilet paper (until it floods and falls in)
  if (!s.flooded[1]) {
    for (let k = 0; k < 3; k++) drawRoll(c, L + 8 + k * 21, y1 - 10, 9, 300 + k, false);
    drawRoll(c, L + 18, y1 - 28, 9, 310, false);
  }
  // top: electric toothbrush on its base + trimmer, both plugged into the socket
  const tb: Pt[] = [[L + 6, y2], [L + 18, y2], [L + 18, y2 - 6], [L + 6, y2 - 6]];
  wash(c, tb, '#e9e6de', 220, 0.9, 0.2, 1);
  inkLine(c, tb, 221, 0.3, 1, INK, true);
  const brush: Pt[] = [[L + 9, y2 - 6], [L + 15, y2 - 6], [L + 14, y2 - 34], [L + 10, y2 - 34]];
  wash(c, brush, '#f6f5f0', 222, 0.9, 0.2, 1);
  wash(c, rectPts(L + 10, y2 - 24, 4, 5), '#3f7fbf', 223, 0.9, 0.1, 1);
  inkLine(c, brush, 224, 0.3, 1, INK, true);
  inkLine(c, [[L + 11, y2 - 34], [L + 11, y2 - 42], [L + 13, y2 - 42], [L + 13, y2 - 34]], 225, 0.2, 0.9);
  const tr: Pt[] = [[L + 30, y2], [L + 52, y2 - 3], [L + 52, y2 - 11], [L + 30, y2 - 12]];
  wash(c, tr, '#2a2a2e', 226, 0.85, 0.2, 2);
  inkLine(c, tr, 227, 0.3, 1, INK, true);
  inkLine(c, [[L + 52, y2 - 9], [L + 56, y2 - 9]], 228, 0.2, 1.6, '#9a9a9a');
  // cords to the socket
  const sx = CAB_R - 12, sy = y2 - 25;
  c.save();
  c.strokeStyle = INK; c.lineWidth = 1;
  c.beginPath(); c.moveTo(L + 18, y2 - 3); c.bezierCurveTo(L + 30, y2 - 22, sx - 20, sy + 4, sx, sy); c.stroke();
  c.beginPath(); c.moveTo(L + 31, y2 - 6); c.bezierCurveTo(L + 40, y2 - 30, sx - 10, sy - 6, sx, sy - 2); c.stroke();
  c.restore();
  // warning sparks when the water creeps near the top shelf
  const lvl = S.sinkLevel(s);
  const near = (lvl - (S.SHELF_LEVELS[2] - 1.2)) / 1.2;
  if (near > 0 && !s.over) {
    const r = rng(Math.floor(t * 14));
    const n = Math.ceil(near * 4);
    for (let k = 0; k < n; k++) if (r() < 0.6) spark(c, L + 8 + r() * 48, y2 - 6 - r() * 16, 5 + r() * 6, r);
  }
}

function drawRoll(c: Ctx, x: number, y: number, rad: number, seed: number, soggy: boolean): void {
  const pts = ellipsePts(x, y, rad, rad * (soggy ? 0.7 : 1), 16);
  wash(c, pts, soggy ? '#d6d0bf' : '#fbfaf5', seed, 0.95, 0.3, 2);
  inkLine(c, pts, seed + 1, 0.5, 1.1);
  inkLine(c, ellipsePts(x, y, rad * 0.35, rad * 0.35 * (soggy ? 0.7 : 1), 10), seed + 2, 0.3, 0.9);
  if (!soggy) inkLine(c, ellipsePts(x, y, rad * 0.7, rad * 0.7, 12, -0.4, 1.4), seed + 3, 0.3, 0.5);
}

function spark(c: Ctx, x: number, y: number, size: number, r: () => number): void {
  c.save();
  c.strokeStyle = '#f2c418';
  c.lineWidth = 1.6;
  c.beginPath();
  for (let k = 0; k < 4; k++) {
    const a = r() * Math.PI * 2;
    c.moveTo(x, y);
    c.lineTo(x + Math.cos(a) * size * 0.5 + (r() - 0.5) * 3, y + Math.sin(a) * size * 0.5);
    c.lineTo(x + Math.cos(a) * size, y + Math.sin(a) * size);
  }
  c.stroke();
  c.strokeStyle = INK; c.lineWidth = 0.5; c.stroke();
  c.restore();
}

/* ------------------------------------------------------------------ Bentzi */

interface Pose { swing: number; walk: number; lean: number; zap: number }

function drawBentzi(c: Ctx, fx: number, fy: number, bladeX: number, bladeY: number, p: Pose, t: number): void {
  const B = { skin: '#e8b48f', hair: '#4a3222', beard: '#5a3b26', shirt: '#1b1b1f' };
  c.save();
  c.translate(fx, fy);
  c.rotate(p.lean);
  const SC = 1.22;
  c.scale(SC, SC);
  const zap = p.zap > 0;
  if (zap) {
    const g = c.createRadialGradient(0, -40, 4, 0, -40, 60);
    g.addColorStop(0, 'rgba(255,236,120,0.55)');
    g.addColorStop(1, 'rgba(255,236,120,0)');
    c.fillStyle = g;
    c.fillRect(-60, -110, 120, 120);
  }
  const step = Math.sin(p.walk) * 3;
  // legs (shorts + bare legs) and feet
  for (const [lx, s] of [[-6, step], [6, -step]] as [number, number][]) {
    const leg: Pt[] = [[lx - 3.5, -20], [lx + 3.5, -20], [lx + 3 + s * 0.4, -3], [lx - 3 + s * 0.4, -3]];
    wash(c, leg, B.skin, 400 + lx, 0.9, 0.3, 2);
    inkLine(c, leg, 401 + lx, 0.4, 1.1, INK, true);
    const foot = ellipsePts(lx - 3 + s * 0.4, -2, 6.5, 2.8, 12);
    wash(c, foot, B.skin, 402 + lx, 0.9, 0.3, 2);
    inkLine(c, foot, 403 + lx, 0.3, 1.1);
  }
  const shorts: Pt[] = [[-13, -34], [13, -34], [13, -18], [1, -19], [-1, -19], [-13, -18]];
  wash(c, shorts, '#6b6f4a', 410, 0.9, 0.4, 2);
  hatchPoly(c, shorts, 1, 2.6, 411, 0.6, 0.45);
  inkLine(c, shorts, 412, 0.4, 1.2, INK, true);
  // torso: round, stocky, black tee
  const torso = ellipsePts(0, -45, 17, 16, 24);
  wash(c, torso, B.shirt, 420, 0.85, 0.3, 3);
  hatchPoly(c, torso, 1, 3, 421, 1.2, 0.35, 0.6);
  // soft highlight strokes on the black shirt
  c.save();
  c.strokeStyle = 'rgba(243,233,210,0.35)';
  c.lineWidth = 0.8;
  c.beginPath();
  c.arc(-2, -45, 12, -2.4, -1.4);
  c.stroke();
  c.restore();
  inkLine(c, torso, 422, 0.5, 1.4, INK, true);

  // squeegee: hands on the handle, blade on the floor uphill
  const sw = p.swing;
  const hx = -14 - sw * 12, hy = -44 + sw * 6; // upper hand
  const lbx = (bladeX - fx) / SC, lby = (bladeY - fy) / SC;
  // handle
  inkLine(c, [[hx + 6, hy - 8], [lbx + 2, lby - 4]], 430, 0.3, 4, '#c0502f');
  inkLine(c, [[hx + 6, hy - 8], [lbx + 2, lby - 4]], 431, 0.4, 0.9);
  // blade holder and rubber
  const bl: Pt[] = [[lbx - 4, lby - 9], [lbx + 6, lby - 9], [lbx + 6, lby - 1.5], [lbx - 4, lby - 1.5]];
  wash(c, bl, '#d9d4c7', 432, 0.9, 0.2, 1);
  inkLine(c, bl, 433, 0.2, 1, INK, true);
  inkLine(c, [[lbx - 4, lby], [lbx + 6, lby]], 434, 0.1, 3, '#222');
  // arms
  const midX = hx + (lbx - hx) * 0.22, midY = hy + (lby - hy) * 0.22;
  for (const [ax, ay, sx, sy, seed] of [[hx, hy, -6, -53, 440], [midX, midY, 6, -52, 450]] as number[][]) {
    const elbowX = (ax + sx) / 2 + 2, elbowY = (ay + sy) / 2 + 6;
    // sleeve
    inkLine(c, [[sx, sy], [sx + (elbowX - sx) * 0.4, sy + (elbowY - sy) * 0.4]], seed, 0.3, 7, B.shirt);
    inkLine(c, [[sx + (elbowX - sx) * 0.4, sy + (elbowY - sy) * 0.4], [elbowX, elbowY], [ax, ay]], seed + 1, 0.3, 5, B.skin);
    inkLine(c, [[sx + (elbowX - sx) * 0.4, sy + (elbowY - sy) * 0.4], [elbowX, elbowY], [ax, ay]], seed + 2, 0.4, 0.8);
    const hand = ellipsePts(ax, ay, 3.6, 3.2, 10);
    wash(c, hand, B.skin, seed + 3, 0.95, 0.2, 1);
    inkLine(c, hand, seed + 4, 0.3, 1);
  }

  // head
  const hxh = -3, hyh = -74;
  const bob = Math.sin(p.walk * 2) * 0.8;
  c.translate(0, bob);
  // ear (on the right, he faces left)
  const ear = ellipsePts(hxh + 11, hyh + 1, 3.4, 4.6, 10);
  wash(c, ear, B.skin, 460, 0.9, 0.2, 1);
  inkLine(c, ear, 461, 0.3, 1);
  const head = ellipsePts(hxh, hyh, 14.5, 15.5, 26);
  wash(c, head, B.skin, 462, 0.9, 0.4, 3);
  hatchPoly(c, ellipsePts(hxh + 6, hyh + 2, 9, 13, 16), 1, 2.6, 463, 0.9, 0.25);
  inkLine(c, head, 464, 0.5, 1.4, INK, true);
  // hair: short dark-brown cap; spiky when zapped
  if (zap) {
    const r = rng(Math.floor(t * 20));
    const spikes: Pt[] = [];
    for (let k = 0; k <= 12; k++) {
      const a = Math.PI + (k / 12) * Math.PI;
      const rr = k % 2 ? 26 + r() * 6 : 15;
      spikes.push([hxh + Math.cos(a) * rr, hyh - 2 + Math.sin(a) * rr]);
    }
    wash(c, spikes, B.hair, 465, 0.9, 0.3, 2);
    inkLine(c, spikes, 466, 0.6, 1.2, INK, true);
  } else {
    const hair: Pt[] = [...ellipsePts(hxh + 1, hyh - 2, 15, 15, 16, Math.PI * 1.08, Math.PI * 2.05), [hxh + 12, hyh - 2], [hxh + 4, hyh - 9], [hxh - 10, hyh - 9]];
    wash(c, hair, B.hair, 467, 0.9, 0.3, 3);
    hatchPoly(c, hair, 2, 2.2, 468, -0.4, 0.45);
    inkLine(c, hair, 469, 0.4, 1.1, INK, true);
  }
  // sunglasses pushed up on the head
  if (!zap) {
    const g1 = ellipsePts(hxh - 7, hyh - 13, 5, 3, 10), g2 = ellipsePts(hxh + 3, hyh - 14, 4.5, 3, 10);
    for (const [g, sd] of [[g1, 470], [g2, 472]] as [Pt[], number][]) {
      wash(c, g, '#1e1e22', sd, 0.95, 0.1, 2);
      inkLine(c, g, sd + 1, 0.2, 1);
    }
    inkLine(c, [[hxh - 2, hyh - 13.5], [hxh - 1.5, hyh - 14]], 474, 0.1, 1.2);
    inkLine(c, [[hxh + 7.5, hyh - 14], [hxh + 12, hyh - 10]], 475, 0.2, 1.1);
  }
  // full brown beard wrapping the jaw, open grin inside it
  const beard: Pt[] = [
    [hxh + 11, hyh - 1], [hxh + 10, hyh + 9], [hxh + 3, hyh + 17], [hxh - 7, hyh + 18], [hxh - 15, hyh + 11],
    [hxh - 16, hyh + 4], [hxh - 11, hyh + 4], [hxh - 5, hyh + 2], [hxh + 2, hyh + 4], [hxh + 7, hyh + 1],
  ];
  wash(c, beard, B.beard, 476, 0.9, 0.4, 3);
  hatchPoly(c, beard, 2, 2, 477, 1.1, 0.5);
  inkLine(c, beard, 478, 0.6, 1.1, INK, true);
  const mouthOpen = zap ? 5 : 3.2 + p.swing * 1.5;
  const mouth: Pt[] = [[hxh - 13, hyh + 6], [hxh - 3, hyh + 7], [hxh - 5, hyh + 7 + mouthOpen], [hxh - 11, hyh + 6 + mouthOpen * 0.8]];
  wash(c, mouth, '#7a2a22', 479, 0.95, 0.1, 1);
  wash(c, [[hxh - 12.5, hyh + 6.2], [hxh - 3.5, hyh + 7.2], [hxh - 4, hyh + 8.6], [hxh - 12, hyh + 7.6]], '#fffaf0', 480, 0.95, 0.1, 1);
  inkLine(c, mouth, 481, 0.3, 1, INK, true);
  // nose (big, friendly) and cheek
  const nose: Pt[] = [[hxh - 10, hyh - 4], [hxh - 17, hyh + 2], [hxh - 15, hyh + 4], [hxh - 10, hyh + 3]];
  wash(c, nose, '#dc9c7a', 482, 0.9, 0.2, 1);
  inkLine(c, nose, 483, 0.3, 1.1);
  c.fillStyle = 'rgba(214,110,90,0.35)';
  c.beginPath(); c.arc(hxh - 3, hyh + 1, 3.4, 0, Math.PI * 2); c.fill();
  // eye and brow
  if (zap) {
    inkLine(c, ellipsePts(hxh - 7, hyh - 5, 3, 3.4, 10), 484, 0.2, 1.1);
    c.fillStyle = INK; c.fillRect(hxh - 8, hyh - 6, 2, 2);
  } else {
    c.fillStyle = INK;
    c.beginPath(); c.ellipse(hxh - 8, hyh - 4.5, 1.5, 2, 0, 0, Math.PI * 2); c.fill();
    inkLine(c, [[hxh - 11, hyh - 9], [hxh - 5, hyh - 10]], 485, 0.2, 1.4);
    inkLine(c, [[hxh - 9, hyh - 2], [hxh - 6, hyh - 1.5]], 486, 0.2, 0.6);
  }
  c.restore();
}

/* ------------------------------------------------------------------ frame */

export function draw(
  canvas: HTMLCanvasElement, s: S.State, v: View, dt: number,
  pose: { walk: number },
): void {
  const c = canvas.getContext('2d')!;
  const cw = canvas.width, ch = canvas.height;
  // fit the scene: full width, anchored to the bottom (extra height becomes ceiling)
  // cover the canvas, allowing a little side crop, anchored to the bottom
  const k = Math.min(Math.max(cw / SW, ch / SH), (cw / SW) * 1.12);
  const ox = (cw - SW * k) / 2, oy = ch - SH * k;
  const t = s.t;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = PAPER;
  c.fillRect(0, 0, cw, ch);
  if (oy > 0) {
    // extend the plaster wall upward
    c.fillStyle = '#c3cdbf';
    c.fillRect(0, 0, cw, oy + 2);
  }
  const shake = v.shake > 0 ? (v.rnd() - 0.5) * v.shake * 6 * k : 0;
  c.setTransform(k, 0, 0, k, ox + shake, oy);
  c.drawImage(ensureBg(v, s.bed, k), 0, 0, SW, SH);

  drawShelfItems(c, s, t);
  drawSpray(c, s, t);

  // Bentzi
  const fx = X(s.px);
  const fy = Y(bedAt(s.bed, s.px));
  const swingP = s.swingT < 0.3 ? Math.sin((s.swingT / 0.3) * Math.PI) : 0;
  const bladeCell = s.px - 1.6 - swingP * 3.2;
  const bx = X(bladeCell), by = Y(bedAt(s.bed, bladeCell));
  const lean = s.flooded[0] ? Math.max(-0.25, Math.min(0.25, s.pv * 0.02)) + Math.sin(t * 5) * 0.03 : s.pv * 0.006;
  const zapT = v.zapT;
  drawBentzi(c, fx, fy, bx, by, { swing: swingP, walk: pose.walk, lean, zap: zapT >= 0 ? 1 : 0 }, t);

  drawWater(c, s, t);
  drawRolls(c, s);
  updateParticles(c, s, v, dt);

  if (zapT >= 0) drawZap(c, s, v, fx, fy);
  if (v.flash > 0) {
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = `rgba(255,248,210,${Math.min(0.8, v.flash)})`;
    c.fillRect(0, 0, cw, ch);
  }
  v.flash = Math.max(0, v.flash - dt * 3);
  v.shake = Math.max(0, v.shake - dt * 2);
}

function drawSpray(c: Ctx, s: S.State, t: number): void {
  const r = rng(Math.floor(t * 20));
  c.save();
  c.lineCap = 'round';
  const n = 26;
  for (let k = 0; k < n; k++) {
    const cell = S.SPRAY_FROM + ((k + r() * 0.8) / n) * (S.T.SPRAY_TO - S.SPRAY_FROM);
    const ex = X(cell), ey = Y(s.bed[Math.round(cell)]) - 2;
    const sx = HEAD[0] + (r() - 0.5) * 6, sy = HEAD[1] + 4;
    const ph = (t * 3 + k * 0.37) % 1;
    // dashed falling streaks along a slight arc
    const mx = (sx + ex) / 2 - 10, my = (sy + ey) / 2 - 18;
    c.strokeStyle = 'rgba(96,150,190,0.55)';
    c.lineWidth = 1.2;
    c.setLineDash([6, 9]);
    c.lineDashOffset = -ph * 30;
    c.beginPath();
    c.moveTo(sx, sy);
    c.quadraticCurveTo(mx, my, ex, ey);
    c.stroke();
  }
  c.setLineDash([]);
  // splash ticks on the floor
  for (let k = 0; k < 10; k++) {
    const cell = S.SPRAY_FROM + r() * (S.T.SPRAY_TO - S.SPRAY_FROM);
    const ex = X(cell), ey = Y(s.bed[Math.round(cell)] + s.h[Math.round(cell)]);
    c.strokeStyle = 'rgba(43,32,22,0.6)';
    c.lineWidth = 0.7;
    c.beginPath();
    c.moveTo(ex - 3, ey - 1); c.lineTo(ex - 5, ey - 5);
    c.moveTo(ex + 3, ey - 1); c.lineTo(ex + 5, ey - 5);
    c.stroke();
  }
  c.restore();
}

function surfaceView(s: S.State, t: number): Float64Array {
  const out = new Float64Array(S.N);
  for (let i = 0; i < S.N; i++) {
    let h = s.h[i];
    for (const g of s.slugs) {
      const d = (i - g.x) / 2.6;
      h += g.vol * 0.3 * Math.exp(-d * d);
    }
    const ripple = h > 0.08 ? Math.sin(t * 4 + i * 0.8) * Math.min(h, 1) * 0.08 : 0;
    out[i] = h > 0.02 ? s.bed[i] + h + ripple : s.bed[i];
  }
  return out;
}

function drawWater(c: Ctx, s: S.State, t: number): void {
  const surf = surfaceView(s, t);
  const top: Pt[] = [];
  for (let i = 0; i < S.N; i++) top.push([X(i), Y(surf[i])]);
  top.push([SW, Y(surf[S.N - 1])]);
  const bottom: Pt[] = [[SW, Y(0) + 1]];
  for (let i = S.N - 1; i >= 0; i--) bottom.push([X(i), Y(s.bed[i]) + 1]);
  const poly = [...top, ...bottom];
  c.save();
  pathFrom(c, poly);
  c.fillStyle = 'rgba(92,150,190,0.42)';
  c.fill();
  c.clip();
  // inner wash variation and a few ink ripple lines
  c.fillStyle = 'rgba(60,110,160,0.18)';
  c.fillRect(0, Y(S.sinkLevel(s)) + 10, SW, SH);
  c.strokeStyle = 'rgba(43,32,22,0.35)';
  c.lineWidth = 0.6;
  c.beginPath();
  for (let yy = 0; yy < 6; yy++) {
    for (let i = 2; i < S.N; i += 3) {
      const h = surf[i] - s.bed[i];
      if (h < 0.6 + yy * 0.9) continue;
      const y = Y(surf[i]) + 5 + yy * 9 + Math.sin(t * 1.5 + i) * 1.2;
      c.moveTo(X(i) - 4, y);
      c.lineTo(X(i) + 4, y);
    }
  }
  c.stroke();
  c.restore();
  // ink on the surface where there is water
  c.save();
  c.strokeStyle = INK;
  c.lineWidth = 1.1;
  c.lineCap = 'round';
  c.beginPath();
  let pen = false;
  for (let i = 0; i < S.N; i++) {
    const wet = surf[i] - s.bed[i] > 0.12;
    if (wet) {
      const [x, y] = top[i];
      if (!pen) c.moveTo(x, y); else c.lineTo(x, y);
      pen = true;
    } else pen = false;
  }
  if (pen) c.lineTo(SW, top[S.N][1]);
  c.stroke();
  // highlight strokes
  c.strokeStyle = 'rgba(255,255,255,0.7)';
  c.lineWidth = 1;
  c.beginPath();
  for (let i = 1; i < S.N; i += 5) {
    if (surf[i] - s.bed[i] < 0.4) continue;
    const y = Y(surf[i]) + 2.5;
    c.moveTo(X(i) - 3, y);
    c.lineTo(X(i) + 3, y);
  }
  c.stroke();
  // suds foam riding on the surface
  if (s.flooded[0]) {
    const r = rng(5);
    for (let i = 0; i < S.N; i += 1) {
      if (surf[i] - s.bed[i] < 0.25 || r() < 0.4) continue;
      const bx = X(i) + (r() - 0.5) * 4, by = Y(surf[i]) - 1 + Math.sin(t * 3 + i) * 0.8;
      const rad = 2 + r() * 3;
      c.fillStyle = 'rgba(255,255,255,0.9)';
      c.beginPath(); c.arc(bx, by, rad, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(43,32,22,0.45)'; c.lineWidth = 0.5; c.stroke();
    }
  }
  c.restore();
}

function drawRolls(c: Ctx, s: S.State): void {
  for (let k = 0; k < s.rolls.length; k++) {
    const r = s.rolls[k];
    if (r.falling > 0) {
      // tumbling down from the middle shelf
      const f = 1 - r.falling / 0.8;
      const x = CAB_L + 20 + k * 18;
      const y = SHELF_Y[1] - 10 + Math.max(0, f) * (Y(S.surfaceAt(s, S.N - 3)) - SHELF_Y[1] + 4);
      drawRoll(c, x, y, 8, 330 + k, false);
      continue;
    }
    const x = r.stuck ? X(S.DRAIN_CELLS[1]) + (k - 1) * 4 : X(r.x);
    const y = r.stuck ? Y(s.bed[2]) - 3 : Y(S.surfaceAt(s, r.x)) - 2;
    drawRoll(c, x, y, r.stuck ? 6 : 7, 340 + k, true);
  }
}

function updateParticles(c: Ctx, s: S.State, v: View, dt: number): void {
  const R = v.rnd;
  // suds bubbles drift around the room once the cleaning supplies flood
  if (s.flooded[0] && !s.over) {
    const target = 70;
    if (v.bubbles.length < target && R() < dt * 20) {
      // half pour out of the soaked cleaning shelf, half rise off the soapy water anywhere
      const fromShelf = R() < 0.5;
      const cell = 6 + R() * (S.N - 8);
      v.bubbles.push({
        x: fromShelf ? CAB_L + R() * 70 : X(cell), y: fromShelf ? SHELF_Y[0] - 10 : Y(S.surfaceAt(s, cell)) - 4,
        r: 4 + R() * 13, vx: fromShelf ? -15 - R() * 45 : (R() - 0.5) * 16, vy: -5 - R() * 14, life: 8 + R() * 8, hue: R(),
      });
    }
  }
  for (const b of v.bubbles) {
    b.life -= dt;
    b.x += (b.vx + Math.sin(s.t * 1.3 + b.hue * 9) * 6) * dt;
    b.y += b.vy * dt;
    b.vx *= Math.exp(-0.3 * dt);
    b.vy = b.vy * Math.exp(-0.5 * dt) - 1.5 * dt;
    if (b.y < 40) b.vy = Math.abs(b.vy);
  }
  v.bubbles = v.bubbles.filter((b) => b.life > 0 && b.x > -20);
  for (const b of v.bubbles) {
    const a = Math.min(1, b.life / 1.5);
    const col = b.hue < 0.33 ? '200,170,230' : b.hue < 0.66 ? '160,210,230' : '230,200,170';
    c.fillStyle = `rgba(${col},${0.22 * a})`;
    c.beginPath(); c.arc(b.x, b.y, b.r, 0, Math.PI * 2); c.fill();
    c.strokeStyle = `rgba(43,32,22,${0.55 * a})`;
    c.lineWidth = 0.7; c.stroke();
    c.fillStyle = `rgba(255,255,255,${0.8 * a})`;
    c.beginPath(); c.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.22, 0, Math.PI * 2); c.fill();
  }
  // slug spray: droplets at the front of moving waves
  for (const g of s.slugs) {
    if (R() < 0.7) {
      const x = X(g.x), y = Y(S.surfaceAt(s, g.x)) - 3;
      v.drops.push({ x, y, vx: g.v * DX * 0.4 + (R() - 0.5) * 30, vy: -40 - R() * 50, life: 0.5 });
    }
  }
  for (const d of v.drops) {
    d.life -= dt;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.vy += 260 * dt;
  }
  v.drops = v.drops.filter((d) => d.life > 0);
  c.fillStyle = 'rgba(92,150,190,0.8)';
  c.strokeStyle = 'rgba(43,32,22,0.5)';
  c.lineWidth = 0.5;
  for (const d of v.drops) {
    c.beginPath(); c.arc(d.x, d.y, 1.6, 0, Math.PI * 2); c.fill(); c.stroke();
  }
}

/** Splash of droplets (e.g. when a wave hits the drain). */
export function splash(v: View, x: number, y: number, n = 10): void {
  for (let k = 0; k < n; k++) v.drops.push({ x, y, vx: (v.rnd() - 0.5) * 80, vy: -40 - v.rnd() * 70, life: 0.6 });
}

function drawZap(c: Ctx, s: S.State, v: View, fx: number, fy: number): void {
  const r = rng(Math.floor(v.zapT * 18));
  c.save();
  c.lineJoin = 'round';
  const bolts = 3;
  for (let b = 0; b < bolts; b++) {
    let x = CAB_L + 20 + r() * 40, y = SHELF_Y[2] - 8;
    const tx = fx + (r() - 0.5) * 20, ty = fy - 40 - r() * 30;
    const pts: Pt[] = [[x, y]];
    for (let k = 1; k <= 8; k++) {
      x = x + (tx - x) / (9 - k) + (r() - 0.5) * 18;
      y = y + (ty - y) / (9 - k) + (r() - 0.5) * 14;
      pts.push([x, y]);
    }
    c.strokeStyle = 'rgba(255,230,90,0.9)';
    c.lineWidth = 4;
    c.beginPath(); pts.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.stroke();
    c.strokeStyle = INK; c.lineWidth = 1;
    c.stroke();
  }
  for (let k = 0; k < 8; k++) spark(c, fx + (r() - 0.5) * 50, fy - r() * 90, 6 + r() * 8, r);
  c.restore();
  void s;
}

export function cellToScene(cell: number, bed: Float64Array): Pt {
  return [X(cell), Y(bedAt(bed, cell))];
}

export { ellipsePts };
