/**
 * The utility trolley under the sink: a round-cornered metal cart with three lipped trays on four
 * little castors (original drawing, no logo). Bottom: cleaning supplies. Middle: toilet paper.
 * Top: electric toothbrush and trimmer, plugged into the wall.
 */
import * as S from './sim';
import { CART_L, CART_R, CART_TOP, TRAY_Y, Y, bedAt } from './geom';
import { INK, type Ctx, type Pt, ellipsePts, hatchPoly, inkLine, rectPts, rng, wash } from './ink';

const METAL = '#8a2a35';
const LIP = 13;

function roundRect(x0: number, y0: number, x1: number, y1: number, r: number): Pt[] {
  const pts: Pt[] = [];
  const corner = (cx: number, cy: number, a0: number) => {
    for (let k = 0; k <= 4; k++) {
      const a = a0 + (k / 4) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  };
  corner(x1 - r, y0 + r, -Math.PI / 2);
  corner(x1 - r, y1 - r, 0);
  corner(x0 + r, y1 - r, Math.PI / 2);
  corner(x0 + r, y0 + r, Math.PI);
  return pts;
}

export function drawRoll(c: Ctx, x: number, y: number, rad: number, seed: number, soggy: boolean): void {
  const pts = ellipsePts(x, y, rad, rad * (soggy ? 0.7 : 1), 16);
  wash(c, pts, soggy ? '#d6d0bf' : '#fbfaf5', seed, 0.95, 0.3, 2);
  inkLine(c, pts, seed + 1, 0.5, 1.1);
  inkLine(c, ellipsePts(x, y, rad * 0.35, rad * 0.35 * (soggy ? 0.7 : 1), 10), seed + 2, 0.3, 0.9);
  if (!soggy) inkLine(c, ellipsePts(x, y, rad * 0.7, rad * 0.7, 12, -0.4, 1.4), seed + 3, 0.3, 0.5);
}

export function spark(c: Ctx, x: number, y: number, size: number, r: () => number): void {
  c.save();
  c.strokeStyle = '#f2c418';
  c.lineWidth = 1.8;
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

function post(c: Ctx, x: number, floorY: number, seed: number, back: boolean): void {
  const pts: Pt[] = [[x, floorY - 12], [x, CART_TOP + 8], [x + (x < (CART_L + CART_R) / 2 ? 4 : -4), CART_TOP]];
  inkLine(c, pts, seed, 0.2, 5.4, INK);
  inkLine(c, pts, seed + 1, 0.2, 3.4, back ? '#6b1f2a' : METAL);
}

function castor(c: Ctx, x: number, floorY: number, seed: number): void {
  inkLine(c, [[x, floorY - 12], [x + 2, floorY - 8]], seed, 0.1, 2, '#666');
  const w = ellipsePts(x + 3, floorY - 4.5, 4.5, 4.5, 12);
  wash(c, w, '#3a3a3a', seed + 1, 0.95, 0.1, 2);
  inkLine(c, w, seed + 2, 0.2, 1);
}

function trayFront(c: Ctx, ty: number, seed: number): void {
  const pts = roundRect(CART_L - 2, ty - LIP, CART_R + 2, ty + 2, 6);
  wash(c, pts, METAL, seed, 0.85, 0.3, 2);
  hatchPoly(c, [[CART_R - 18, ty - LIP], [CART_R + 2, ty - LIP], [CART_R + 2, ty + 2], [CART_R - 18, ty + 2]], 1, 2.4, seed + 1, 0.5, 0.35);
  inkLine(c, pts, seed + 2, 0.4, 1.3, INK, true);
  inkLine(c, [[CART_L + 3, ty - LIP + 3], [CART_R - 3, ty - LIP + 3]], seed + 3, 0.3, 0.6, 'rgba(255,255,255,0.8)');
}

function trayBack(c: Ctx, ty: number, seed: number): void {
  // the inside back rim of the tray, seen just above the front lip
  const pts = roundRect(CART_L + 2, ty - LIP - 5, CART_R - 2, ty - LIP + 4, 4);
  wash(c, pts, '#6b1f2a', seed, 0.75, 0.2, 1);
  inkLine(c, pts, seed + 1, 0.3, 0.9, INK, true);
}

export function drawCart(c: Ctx, s: S.State, t: number): void {
  const mid = (S.CART_FROM + S.N - 1) / 2;
  const floorY = Y(bedAt(s.bed, mid)) + 1;
  const [y0, y1, y2] = TRAY_Y;
  const L = CART_L + 4;
  post(c, CART_L + 9, floorY, 700, true);
  post(c, CART_R - 9, floorY, 702, true);
  castor(c, CART_L + 9, floorY, 704);
  castor(c, CART_R - 12, floorY, 707);

  // bottom tray: cleaning supplies
  trayBack(c, y0, 710);
  const b0 = y0 - 1;
  const spray: Pt[] = [[L, b0], [L + 13, b0], [L + 13, b0 - 26], [L + 10, b0 - 31], [L + 10, b0 - 40], [L + 3, b0 - 40], [L + 3, b0 - 31], [L, b0 - 26]];
  wash(c, spray, '#4f8fc0', 712, 0.8, 0.3, 2);
  inkLine(c, spray, 713, 0.4, 1.1, INK, true);
  inkLine(c, [[L + 3, b0 - 40], [L - 4, b0 - 37]], 714, 0.2, 1.6);
  const jug: Pt[] = [[L + 17, b0], [L + 37, b0], [L + 37, b0 - 26], [L + 31, b0 - 33], [L + 23, b0 - 33], [L + 17, b0 - 26]];
  wash(c, jug, '#f2efe6', 715, 0.95, 0.3, 2);
  hatchPoly(c, jug, 1, 3, 716, 0.4, 0.28);
  inkLine(c, jug, 717, 0.4, 1.1, INK, true);
  wash(c, rectPts(L + 24, b0 - 38, 6, 5), '#c0392b', 718, 0.95, 0.1, 1);
  inkLine(c, rectPts(L + 24, b0 - 38, 6, 5), 719, 0.2, 1, INK, true);
  wash(c, rectPts(L + 21, b0 - 20, 12, 8), '#4f8fc0', 720, 0.55, 0.1, 1);
  const sp = rectPts(L + 42, b0 - 11, 18, 11);
  wash(c, sp, '#e8c547', 721, 0.9, 0.2, 2);
  wash(c, rectPts(L + 42, b0 - 11, 18, 3.5), '#5e9a4b', 722, 0.9, 0.1, 1);
  inkLine(c, sp, 723, 0.3, 1, INK, true);
  trayFront(c, y0, 724);
  if (s.flooded[0]) {
    const r = rng(725);
    for (let k = 0; k < 14; k++) {
      const bx = L + r() * 62, by = b0 - 8 - r() * 16 + Math.sin(t * 2 + k) * 1.5;
      c.fillStyle = 'rgba(255,255,255,0.88)';
      c.beginPath(); c.arc(bx, by, 3 + r() * 5, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(43,32,22,0.5)'; c.lineWidth = 0.6; c.stroke();
    }
  }

  // middle tray: toilet paper (until it floods and tumbles into the water)
  trayBack(c, y1, 730);
  if (!s.flooded[1]) {
    for (let k = 0; k < 3; k++) drawRoll(c, L + 9 + k * 20, y1 - 10, 9, 732 + k * 4, false);
    drawRoll(c, L + 19, y1 - 28, 9, 750, false);
  }
  trayFront(c, y1, 755);

  // top tray: electric toothbrush on its charger and a hair trimmer, cords to the wall socket
  trayBack(c, y2, 760);
  const b2 = y2 - 1;
  const base = rectPts(L + 4, b2 - 8, 14, 8);
  wash(c, base, '#e9e6de', 762, 0.95, 0.1, 1);
  inkLine(c, base, 763, 0.2, 1, INK, true);
  const brush: Pt[] = [[L + 7, b2 - 8], [L + 15, b2 - 8], [L + 14, b2 - 34], [L + 8, b2 - 34]];
  wash(c, brush, '#f6f5f0', 764, 0.95, 0.1, 1);
  wash(c, rectPts(L + 8.5, b2 - 25, 5, 5), '#3f7fbf', 765, 0.95, 0.1, 1);
  inkLine(c, brush, 766, 0.2, 1, INK, true);
  inkLine(c, [[L + 9.5, b2 - 34], [L + 9.5, b2 - 42], [L + 12.5, b2 - 42], [L + 12.5, b2 - 34]], 767, 0.2, 1);
  const tr: Pt[] = [[L + 26, b2], [L + 54, b2 - 4], [L + 54, b2 - 13], [L + 26, b2 - 14]];
  wash(c, tr, '#2a2a2e', 768, 0.9, 0.1, 2);
  inkLine(c, tr, 769, 0.2, 1, INK, true);
  inkLine(c, [[L + 54, b2 - 10], [L + 59, b2 - 10]], 770, 0.1, 2, '#9a9a9a');
  trayFront(c, y2, 771);
  c.save();
  c.strokeStyle = INK; c.lineWidth = 1.1;
  c.beginPath(); c.moveTo(L + 6, b2 - 4); c.bezierCurveTo(L - 6, b2 - 2, 296, 452, 288, 441); c.stroke();
  c.beginPath(); c.moveTo(L + 27, b2 - 8); c.bezierCurveTo(L + 10, b2 - 24, 300, 430, 289, 439); c.stroke();
  c.restore();

  // front posts and castors over everything
  post(c, CART_L + 1, floorY, 780, false);
  post(c, CART_R - 1, floorY, 782, false);
  castor(c, CART_L + 1, floorY, 784);
  castor(c, CART_R - 4, floorY, 787);
  // the top tray's rounded handle rail
  inkLine(c, [[CART_L + 1, CART_TOP + 2], [CART_R - 1, CART_TOP + 2]], 790, 0.3, 4.6, INK);
  inkLine(c, [[CART_L + 1, CART_TOP + 2], [CART_R - 1, CART_TOP + 2]], 791, 0.3, 2.8, METAL);

  // warning sparks when the water creeps toward the top tray
  const lvl = S.sinkLevel(s);
  const near = (lvl - (S.SHELF_LEVELS[2] - 9)) / 9;
  if (near > 0 && !s.over) {
    const r = rng(Math.floor(t * 14));
    const n = Math.ceil(near * 4);
    for (let k = 0; k < n; k++) if (r() < 0.6) spark(c, L + 6 + r() * 50, b2 - 6 - r() * 22, 6 + r() * 7, r);
  }
}
