/** The static bathroom (painted once into an offscreen canvas). */
import * as S from './sim';
import { CEIL_Y, COUNTER_Y, HEAD, SH, SW, TILE_TOP, X, Y } from './geom';
import { INK, type Ctx, type Pt, ellipsePts, hatchPoly, hatchRect, inkLine, paper, pathFrom, rectPts, rng, wash } from './ink';

function leaf(c: Ctx, x: number, y: number, len: number, ang: number, w: number, col: string, seed: number): void {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const tip: Pt = [x + ca * len, y + sa * len];
  const nx = -sa * w, ny = ca * w;
  const pts: Pt[] = [
    [x, y],
    [x + ca * len * 0.45 + nx, y + sa * len * 0.45 + ny],
    tip,
    [x + ca * len * 0.45 - nx, y + sa * len * 0.45 - ny],
  ];
  wash(c, pts, col, seed, 0.7, 0.6, 2);
  inkLine(c, pts, seed + 1, 0.4, 0.9, INK, true);
  inkLine(c, [[x, y], [x + ca * len * 0.8, y + sa * len * 0.8]], seed + 2, 0.3, 0.5);
}

function heartLeaf(c: Ctx, x: number, y: number, r: number, seed: number): void {
  const pts: Pt[] = [[x, y + r], [x - r, y - r * 0.1], [x - r * 0.6, y - r * 0.8], [x, y - r * 0.4], [x + r * 0.6, y - r * 0.8], [x + r, y - r * 0.1]];
  wash(c, pts, seed % 2 ? '#5f8f4a' : '#7aa457', seed, 0.75, 0.4, 2);
  inkLine(c, pts, seed + 1, 0.3, 0.8, INK, true);
}

function bottle(c: Ctx, x: number, y: number, w: number, h: number, col: string, cap: string, seed: number, pump = false): void {
  const body: Pt[] = [[x, y], [x + w, y], [x + w, y - h + 4], [x + w - 2, y - h], [x + 2, y - h], [x, y - h + 4]];
  wash(c, body, col, seed, 0.8, 0.3, 2);
  hatchPoly(c, [[x + w * 0.6, y], [x + w, y], [x + w, y - h + 4], [x + w * 0.6, y - h]], 1, 2.2, seed + 1, 0.5, 0.35);
  inkLine(c, body, seed + 2, 0.4, 1, INK, true);
  wash(c, rectPts(x + w * 0.2, y - h * 0.65, w * 0.6, h * 0.3), '#f5efe0', seed + 3, 0.7, 0.2, 1);
  const cp = rectPts(x + w * 0.25, y - h - 5, w * 0.5, 5);
  wash(c, cp, cap, seed + 4, 0.9, 0.2, 1);
  inkLine(c, cp, seed + 5, 0.3, 0.9, INK, true);
  if (pump) inkLine(c, [[x + w / 2, y - h - 5], [x + w / 2, y - h - 10], [x + w / 2 - 6, y - h - 10]], seed + 6, 0.2, 1.4);
}

export function paintRoom(c: Ctx, bed: Float64Array): void {
  paper(c, SW, SH, 4);
  const floorPts: Pt[] = [[0, Y(bed[0])]];
  for (let i = 0; i < S.N; i++) floorPts.push([X(i), Y(bed[i])]);
  floorPts.push([SW, Y(0)]);

  // ceiling and plaster
  wash(c, [[0, 0], [SW, 0], [SW, CEIL_Y], [0, CEIL_Y]], '#c9c0a8', 20, 0.4, 2, 3);
  hatchRect(c, 0, 0, SW, CEIL_Y, -0.5, 4, 31, 0.6, INK, 0.3);
  inkLine(c, [[0, CEIL_Y], [SW, CEIL_Y]], 32, 0.8, 1.5);
  inkLine(c, [[0, CEIL_Y + 5], [SW, CEIL_Y + 5]], 33, 0.8, 0.7);
  wash(c, [[0, CEIL_Y + 5], [SW, CEIL_Y + 5], [SW, TILE_TOP], [0, TILE_TOP]], '#a9bfb3', 21, 0.26, 3, 3);
  hatchRect(c, 0, CEIL_Y + 5, SW, 40, -0.7, 5, 34, 0.5, INK, 0.18);

  // tiles (wainscot, about 1.2 m high)
  const r = rng(77);
  const tile = 22;
  const wallBottom: Pt[] = [[0, TILE_TOP], [SW, TILE_TOP], ...floorPts.slice().reverse()];
  c.save();
  pathFrom(c, wallBottom);
  c.clip();
  for (let ty = TILE_TOP; ty < Y(0) + 4; ty += tile) {
    for (let tx = 0; tx < SW; tx += tile) {
      const col = r() < 0.16 ? '#7fa7a4' : r() < 0.5 ? '#efe0bf' : '#e6d3ad';
      wash(c, rectPts(tx + 1.5, ty + 1.5, tile - 3, tile - 3), col, 100 + tx * 7 + ty, 0.35, 0.8, 2);
    }
  }
  for (let ty = TILE_TOP; ty < Y(0) + 4; ty += tile) inkLine(c, [[0, ty], [SW, ty]], 300 + ty, 0.9, 0.6);
  for (let tx = 0; tx < SW; tx += tile) inkLine(c, [[tx, TILE_TOP], [tx, Y(0)]], 400 + tx, 0.9, 0.6);
  hatchRect(c, 0, 460, SW, 100, -0.75, 4.5, 51, 0.6, INK, 0.22);
  c.restore();
  inkLine(c, [[0, TILE_TOP], [SW, TILE_TOP]], 5, 1, 1.4);
  inkLine(c, [[0, TILE_TOP + 4], [SW, TILE_TOP + 4]], 6, 1, 0.7);

  // the window: two frosted casements, a sill with plants
  const wx = 132, wy = 108, ww = 104, wh = 118;
  const glass = rectPts(wx, wy, ww, wh);
  wash(c, glass, '#cfe3e6', 60, 0.6, 1, 3);
  c.save();
  pathFrom(c, glass);
  c.clip();
  // blurry garden beyond the frosted glass
  for (let k = 0; k < 7; k++) {
    const g = c.createRadialGradient(wx + 10 + k * 15, wy + wh - 10 - (k % 3) * 14, 2, wx + 10 + k * 15, wy + wh - 10 - (k % 3) * 14, 26);
    g.addColorStop(0, 'rgba(110,150,90,0.35)');
    g.addColorStop(1, 'rgba(110,150,90,0)');
    c.fillStyle = g;
    c.fillRect(wx, wy, ww, wh);
  }
  hatchRect(c, wx, wy, ww, wh, -0.9, 9, 61, 1.2, '#ffffff', 0.5);
  hatchRect(c, wx, wy, ww, wh, -0.9, 3.5, 62, 0.5, INK, 0.12);
  c.restore();
  wash(c, [...rectPts(wx - 7, wy - 7, ww + 14, wh + 14)], '#9a6b3c', 63, 0.18, 0.5, 1);
  inkLine(c, rectPts(wx - 7, wy - 7, ww + 14, wh + 14), 64, 0.8, 1.6, INK, true);
  inkLine(c, glass, 65, 0.6, 1.1, INK, true);
  for (const fx of [wx + ww / 2 - 2, wx + ww / 2 + 2]) inkLine(c, [[fx, wy], [fx, wy + wh]], 66 + fx, 0.4, 1.3);
  inkLine(c, [[wx, wy + wh * 0.42], [wx + ww, wy + wh * 0.42]], 68, 0.5, 1.2);
  // handles
  inkLine(c, [[wx + ww / 2 - 8, wy + wh * 0.6], [wx + ww / 2 - 8, wy + wh * 0.6 + 9]], 69, 0.2, 2.2, '#7a7368');
  // sill
  const sill: Pt[] = [[wx - 12, wy + wh + 7], [wx + ww + 12, wy + wh + 7], [wx + ww + 12, wy + wh + 14], [wx - 12, wy + wh + 14]];
  wash(c, sill, '#e6dccb', 70, 0.9, 0.3, 2);
  inkLine(c, sill, 71, 0.5, 1.2, INK, true);
  const sy = wy + wh + 7;
  // snake plant in a terracotta pot
  const pot1: Pt[] = [[wx + 6, sy], [wx + 30, sy], [wx + 33, sy - 20], [wx + 3, sy - 20]];
  wash(c, pot1, '#c06a3e', 72, 0.85, 0.4, 2);
  hatchPoly(c, pot1, 1, 2.6, 73, 0.6, 0.35);
  inkLine(c, pot1, 74, 0.4, 1.1, INK, true);
  for (let k = 0; k < 6; k++) leaf(c, wx + 9 + k * 4, sy - 20, 34 + (k % 3) * 9, -Math.PI / 2 + (k - 2.5) * 0.12, 3.5, k % 2 ? '#4f7d43' : '#6d9a4c', 75 + k * 3);
  // little succulent
  const pot2: Pt[] = [[wx + ww - 26, sy], [wx + ww - 8, sy], [wx + ww - 6, sy - 12], [wx + ww - 28, sy - 12]];
  wash(c, pot2, '#d9c7a0', 95, 0.85, 0.3, 2);
  inkLine(c, pot2, 96, 0.4, 1, INK, true);
  for (let k = 0; k < 7; k++) leaf(c, wx + ww - 17, sy - 12, 9, -Math.PI / 2 + (k - 3) * 0.45, 3, '#7fae8a', 97 + k * 3);

  // hanging pothos from the ceiling
  const hx = 264, potY = 150;
  for (const dx of [-12, 0, 12]) inkLine(c, [[hx, CEIL_Y + 6], [hx + dx, potY - 14]], 120 + dx, 0.5, 0.8);
  inkLine(c, ellipsePts(hx, CEIL_Y + 8, 3, 3, 8), 124, 0.2, 1);
  const pot3: Pt[] = [[hx - 15, potY - 14], [hx + 15, potY - 14], [hx + 11, potY + 6], [hx - 11, potY + 6]];
  wash(c, pot3, '#b85f3a', 125, 0.85, 0.4, 2);
  hatchPoly(c, pot3, 1, 2.6, 126, 0.6, 0.35);
  inkLine(c, pot3, 127, 0.4, 1.1, INK, true);
  const vines: Pt[][] = [
    [[hx - 12, potY - 12], [hx - 22, potY + 30], [hx - 18, potY + 80], [hx - 26, potY + 120]],
    [[hx + 2, potY], [hx + 4, potY + 40], [hx - 2, potY + 85]],
    [[hx + 13, potY - 12], [hx + 24, potY + 24], [hx + 30, potY + 70], [hx + 26, potY + 104]],
  ];
  vines.forEach((v, vi) => {
    inkLine(c, v, 130 + vi, 0.8, 0.8, '#3d5a30');
    for (let k = 1; k < v.length; k++) {
      const [x0, y0] = v[k - 1], [x1, y1] = v[k];
      for (let t = 0.25; t < 1; t += 0.4) heartLeaf(c, x0 + (x1 - x0) * t + (k % 2 ? 5 : -5), y0 + (y1 - y0) * t, 5.5, 140 + vi * 20 + k * 3 + Math.round(t * 10));
    }
  });

  // left wall edge (shower corner)
  wash(c, [[0, 0], [12, 0], [12, Y(bed[0])], [0, Y(bed[0])]], '#8c9a90', 170, 0.4, 1, 2);
  hatchPoly(c, [[0, 0], [12, 0], [12, Y(bed[0])], [0, Y(bed[0])]], 2, 3, 171, 0.3, 0.45);
  inkLine(c, [[12, 0], [12, Y(bed[0])]], 172, 1, 1.4);

  // shower curtain bunched at the end of its rail
  inkLine(c, [[12, CEIL_Y + 14], [124, CEIL_Y + 14]], 173, 0.5, 2);
  const cx0 = 96;
  const cur: Pt[] = [[cx0, CEIL_Y + 16], [cx0 + 26, CEIL_Y + 16], [cx0 + 30, 220], [cx0 + 24, 360], [cx0 + 30, 470], [cx0 - 2, 476], [cx0 + 4, 360], [cx0 - 2, 220]];
  wash(c, cur, '#c96f5c', 174, 0.33, 2, 3);
  hatchPoly(c, cur, 1, 3.5, 175, 1.35, 0.3);
  inkLine(c, cur, 176, 1.2, 1.2, INK, true);
  for (const fx of [6, 13, 20]) inkLine(c, [[cx0 + fx, CEIL_Y + 20], [cx0 + fx - 2, 200], [cx0 + fx + 3, 340], [cx0 + fx - 1, 466]], 177 + fx, 1.5, 0.7);
  for (let k = 0; k < 4; k++) inkLine(c, ellipsePts(cx0 + 3 + k * 7, CEIL_Y + 14, 3, 3, 8), 200 + k, 0.3, 0.8);

  // shower riser, arm and head, taps
  const pipe: Pt[] = [[22, 432], [22, 188], [34, 182], [48, 192]];
  inkLine(c, pipe, 210, 0.5, 4, '#8d8a80');
  inkLine(c, pipe, 211, 0.7, 1.1);
  const head: Pt[] = [[42, 188], [66, 200], [62, 212], [38, 200]];
  wash(c, head, '#b8b3a6', 212, 0.7, 0.5, 2);
  hatchPoly(c, head, 1, 2.4, 213, 0.4, 0.5);
  inkLine(c, head, 214, 0.6, 1.3, INK, true);
  const mixer = rectPts(16, 426, 14, 20);
  wash(c, mixer, '#b8b3a6', 215, 0.8, 0.3, 2);
  inkLine(c, mixer, 216, 0.4, 1.1, INK, true);
  inkLine(c, [[23, 432], [38, 426]], 217, 0.3, 2.2, '#6a675f');
  inkLine(c, [[23, 432], [38, 426]], 218, 0.3, 0.8);

  // hanging shower caddy on the riser, with shampoo bottles
  const kx = 24, ky0 = 236;
  inkLine(c, [[kx, ky0], [kx + 4, ky0 - 8], [kx - 2, ky0 - 10]], 220, 0.2, 1.4, '#6a675f');
  const tiers = [276, 322];
  inkLine(c, [[kx, ky0], [kx + 4, tiers[0] - 26], [kx + 42, tiers[0] - 26]], 221, 0.3, 1);
  tiers.forEach((ty, ti) => {
    const bx0 = kx + 2, bx1 = kx + 46;
    // bottles first (behind the front wire)
    if (ti === 0) {
      bottle(c, bx0 + 3, ty, 12, 30, '#3f74a8', '#f0e6cf', 230);
      bottle(c, bx0 + 17, ty, 11, 24, '#d98aa0', '#f6f0e2', 240);
      bottle(c, bx0 + 30, ty, 10, 20, '#e2b84a', '#3a3a3a', 250);
    } else {
      bottle(c, bx0 + 3, ty, 13, 28, '#5f9a6a', '#f2ede0', 260, true);
      const soap = ellipsePts(bx0 + 30, ty - 5, 8, 5, 12);
      wash(c, soap, '#efe2c4', 270, 0.9, 0.3, 2);
      inkLine(c, soap, 271, 0.3, 1);
    }
    inkLine(c, [[bx0, ty - 14], [bx0, ty], [bx1, ty], [bx1, ty - 14]], 280 + ti, 0.3, 1.1);
    inkLine(c, [[bx0, ty - 8], [bx1, ty - 8]], 284 + ti, 0.3, 0.7);
    for (let k = 1; k < 6; k++) inkLine(c, [[bx0 + k * 7.5, ty - 14], [bx0 + k * 7.5, ty]], 290 + ti * 10 + k, 0.2, 0.5);
    if (ti === 0) inkLine(c, [[bx1, ty], [bx1, tiers[1] - 14]], 288, 0.2, 0.9);
  });
  inkLine(c, [[kx + 2, tiers[0]], [kx + 2, tiers[1] - 14]], 289, 0.2, 0.9);

  // sink: wall-hung counter at hip height with a bowl basin, mirror, plumbing
  const L = 276;
  const mir = rectPts(300, 232, 74, 120);
  wash(c, mir, '#d6e4e2', 300, 0.55, 1, 3);
  c.save(); pathFrom(c, mir); c.clip();
  hatchRect(c, 300, 232, 74, 120, -1.0, 8, 301, 0.6, INK, 0.2);
  hatchRect(c, 300, 232, 74, 120, -1.0, 14, 302, 3, '#ffffff', 0.45);
  c.restore();
  inkLine(c, mir, 303, 0.8, 1.5, INK, true);
  inkLine(c, rectPts(296, 228, 82, 128), 304, 1, 1.1, INK, true);
  wash(c, rectPts(296, 228, 82, 128), '#a8742f', 305, 0.2, 0.5, 1);
  // light above the mirror
  const lamp = rectPts(306, 212, 62, 9);
  wash(c, lamp, '#efe4c0', 306, 0.9, 0.3, 2);
  inkLine(c, lamp, 307, 0.4, 1.1, INK, true);
  // P-trap and wall pipe (behind the trolley)
  inkLine(c, [[342, COUNTER_Y + 8], [342, 430], [350, 438], [362, 432], [362, 420], [388, 420]], 310, 0.4, 5, '#a9a59a');
  inkLine(c, [[342, COUNTER_Y + 8], [342, 430], [350, 438], [362, 432], [362, 420], [388, 420]], 311, 0.5, 1);
  // brackets
  for (const bx of [L + 10, 380]) inkLine(c, [[bx, COUNTER_Y + 8], [bx, COUNTER_Y + 30], [bx + (bx > 300 ? 8 : -2), COUNTER_Y + 30]], 312 + bx, 0.2, 1.6);
  // counter slab
  const ctr: Pt[] = [[L, COUNTER_Y], [SW, COUNTER_Y], [SW, COUNTER_Y + 9], [L, COUNTER_Y + 9]];
  wash(c, ctr, '#cbb08a', 320, 0.85, 0.4, 2);
  hatchPoly(c, ctr, 1, 2.5, 321, 0.1, 0.4);
  inkLine(c, ctr, 322, 0.5, 1.4, INK, true);
  // bowl basin on top
  const bowl = ellipsePts(340, COUNTER_Y, 28, 16, 20, Math.PI, Math.PI * 2);
  wash(c, bowl, '#f6f3ec', 323, 0.95, 0.3, 2);
  hatchPoly(c, ellipsePts(352, COUNTER_Y - 4, 12, 9, 12, Math.PI * 1.3, Math.PI * 2), 1, 2.4, 324, 0.6, 0.3);
  inkLine(c, bowl, 325, 0.5, 1.3);
  inkLine(c, [[311, COUNTER_Y - 15], [369, COUNTER_Y - 15]], 326, 0.4, 1);
  // tall faucet from the counter
  const tap: Pt[] = [[372, COUNTER_Y], [372, COUNTER_Y - 34], [356, COUNTER_Y - 36], [354, COUNTER_Y - 28]];
  inkLine(c, tap, 327, 0.4, 3.2, '#8d8a80');
  inkLine(c, tap, 328, 0.5, 1);
  // little succulent and a cup on the counter
  const pot4 = rectPts(L + 6, COUNTER_Y - 12, 14, 12);
  wash(c, pot4, '#9fc0cf', 330, 0.85, 0.3, 2);
  inkLine(c, pot4, 331, 0.3, 1, INK, true);
  for (let k = 0; k < 5; k++) leaf(c, L + 13, COUNTER_Y - 12, 10, -Math.PI / 2 + (k - 2) * 0.5, 2.6, '#6f9e64', 332 + k * 3);
  // wall socket for the chargers, beside the trolley
  const sock = rectPts(282, 432, 10, 12);
  wash(c, sock, '#efe7d6', 350, 0.95, 0.2, 1);
  inkLine(c, sock, 351, 0.3, 1, INK, true);
  c.fillStyle = INK;
  c.fillRect(285, 436, 1.4, 3); c.fillRect(288.5, 436, 1.4, 3);

  // floor slab in cross-section, with tiles along the top
  const slab: Pt[] = [...floorPts, [SW, SH], [0, SH]];
  wash(c, slab, '#a88a6a', 380, 0.5, 1, 3);
  hatchPoly(c, slab, 2, 4.5, 381, 0.8, 0.35);
  const tileStrip: Pt[] = [...floorPts, ...floorPts.slice().reverse().map(([x, y]) => [x, y + 7] as Pt)];
  wash(c, tileStrip, '#d9cbb0', 382, 0.85, 0.4, 2);
  for (let i = 2; i < S.N; i += 4) inkLine(c, [[X(i), Y(bed[i])], [X(i), Y(bed[i]) + 7]], 390 + i, 0.3, 0.8);
  inkLine(c, floorPts, 383, 0.6, 1.8);
  inkLine(c, floorPts.map(([x, y]) => [x, y + 7] as Pt), 384, 0.6, 0.8);
  // drain pipe and grate
  const d0 = X(S.DRAIN_CELLS[0]) - 1, d1 = X(S.DRAIN_CELLS[S.DRAIN_CELLS.length - 1]) + 1;
  const dy = Y(bed[2]);
  const dp: Pt[] = [[d0 + 2, dy + 2], [d1 - 2, dy + 2], [d1 - 2, SH], [d0 + 2, SH]];
  wash(c, dp, '#3b3a38', 385, 0.7, 0.3, 2);
  inkLine(c, dp, 386, 0.5, 1.2, INK, true);
  for (let k = 0; k < 4; k++) inkLine(c, [[d0 + 3 + k * 4, dy - 1], [d0 + 3 + k * 4, dy + 4]], 387 + k, 0.2, 1.2);
  inkLine(c, [[d0, dy], [d1, dy]], 395, 0.2, 2);
  void HEAD;
}
