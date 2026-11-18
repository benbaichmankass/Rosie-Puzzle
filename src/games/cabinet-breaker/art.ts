/**
 * Cabinet Breaker art, all drawn with canvas paths (no images). Coordinates are board units.
 * Look: warm flat cartoon kitchen: teal painted cabinets, honey-wood shelves, cream tiles.
 */
import {
  BOARD_W,
  CABINET_BOTTOM,
  COL_W,
  ITEM_H,
  MAX_ROWS,
  PLANK_H,
  plankY,
  WALL_L,
  WALL_R,
  WALL_T,
  type ItemKind,
} from './levels';
import type { Critter } from './sim';

type C = CanvasRenderingContext2D;

export const PAL = {
  teal: '#2c7c78',
  tealDark: '#1d5956',
  tealLight: '#3f9d97',
  cream: '#f7ead0',
  creamDark: '#e9d5b0',
  wood: '#d79a55',
  woodDark: '#a8692f',
  woodLight: '#efbd7c',
  tile: '#fbf6ec',
  grout: '#dfd4c0',
  ink: '#2b1d14',
};

export function counterTop(H: number) {
  return H - 46;
}

function rr(c: C, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}

/* ------------------------------------------------------------------ background */

export function drawBackground(c: C, H: number) {
  const ct = counterTop(H);
  // Backsplash tiles (full board first).
  c.fillStyle = PAL.grout;
  c.fillRect(0, 0, BOARD_W, H);
  const tw = 30;
  const th = 15;
  for (let y = CABINET_BOTTOM, r = 0; y < ct; y += th, r++) {
    for (let x = -(r % 2) * (tw / 2); x < BOARD_W; x += tw) {
      const g = c.createLinearGradient(0, y, 0, y + th);
      g.addColorStop(0, '#fffdf7');
      g.addColorStop(1, PAL.tile);
      c.fillStyle = g;
      rr(c, x + 1, y + 1, tw - 2, th - 2, 2.5);
      c.fill();
    }
  }
  // Warm under-cabinet light spill.
  const glow = c.createLinearGradient(0, CABINET_BOTTOM, 0, CABINET_BOTTOM + 140);
  glow.addColorStop(0, 'rgba(255,214,140,0.45)');
  glow.addColorStop(1, 'rgba(255,214,140,0)');
  c.fillStyle = glow;
  c.fillRect(0, CABINET_BOTTOM, BOARD_W, 140);

  // Hanging utensil rail under the cabinet.
  drawUtensils(c);

  // Cabinet interior back panel.
  const back = c.createLinearGradient(0, WALL_T, 0, CABINET_BOTTOM);
  back.addColorStop(0, '#e8d3ad');
  back.addColorStop(1, PAL.cream);
  c.fillStyle = back;
  c.fillRect(WALL_L, WALL_T, WALL_R - WALL_L, CABINET_BOTTOM - WALL_T);
  // Beadboard lines.
  c.strokeStyle = 'rgba(160,120,70,0.13)';
  c.lineWidth = 1;
  for (let x = WALL_L + 12; x < WALL_R; x += 12) {
    c.beginPath();
    c.moveTo(x, WALL_T);
    c.lineTo(x, CABINET_BOTTOM);
    c.stroke();
  }
  // Inner shadow from the crown.
  const sh = c.createLinearGradient(0, WALL_T, 0, WALL_T + 22);
  sh.addColorStop(0, 'rgba(60,30,10,0.35)');
  sh.addColorStop(1, 'rgba(60,30,10,0)');
  c.fillStyle = sh;
  c.fillRect(WALL_L, WALL_T, WALL_R - WALL_L, 22);

  // Centre stile between the two open cupboards (decor only).
  const mid = BOARD_W / 2;
  c.fillStyle = 'rgba(60,30,10,0.12)';
  c.fillRect(mid - 1, WALL_T, 4, CABINET_BOTTOM - WALL_T);

  // Shelves.
  for (let r = 0; r < MAX_ROWS; r++) {
    const y = plankY(r);
    // Shadow on the back panel under the plank.
    const s = c.createLinearGradient(0, y + PLANK_H, 0, y + PLANK_H + 10);
    s.addColorStop(0, 'rgba(70,35,10,0.28)');
    s.addColorStop(1, 'rgba(70,35,10,0)');
    c.fillStyle = s;
    c.fillRect(WALL_L, y + PLANK_H, WALL_R - WALL_L, 10);
    c.fillStyle = PAL.woodLight;
    c.fillRect(WALL_L, y, WALL_R - WALL_L, 2.5);
    c.fillStyle = PAL.wood;
    c.fillRect(WALL_L, y + 2.5, WALL_R - WALL_L, PLANK_H - 2.5);
    c.fillStyle = PAL.woodDark;
    c.fillRect(WALL_L, y + PLANK_H - 1.2, WALL_R - WALL_L, 1.2);
    // Grain dashes.
    c.strokeStyle = 'rgba(140,80,30,0.35)';
    c.lineWidth = 0.7;
    for (let i = 0; i < 9; i++) {
      const gx = WALL_L + ((i * 53 + r * 31) % (WALL_R - WALL_L - 30)) + 5;
      c.beginPath();
      c.moveTo(gx, y + 4.2);
      c.lineTo(gx + 14 + ((i * 7) % 10), y + 4.2);
      c.stroke();
    }
  }

  // Cabinet bottom rail.
  c.fillStyle = PAL.tealDark;
  c.fillRect(0, CABINET_BOTTOM - 4, BOARD_W, 12);
  c.fillStyle = PAL.teal;
  c.fillRect(0, CABINET_BOTTOM - 4, BOARD_W, 8);
  c.fillStyle = PAL.tealLight;
  c.fillRect(0, CABINET_BOTTOM - 4, BOARD_W, 2);

  // Side frames: cabinet sides on top, tile trim below.
  for (const [x0, x1] of [
    [0, WALL_L],
    [WALL_R, BOARD_W],
  ]) {
    const g = c.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, x0 === 0 ? PAL.tealDark : PAL.teal);
    g.addColorStop(1, x0 === 0 ? PAL.teal : PAL.tealDark);
    c.fillStyle = g;
    c.fillRect(x0, 0, x1 - x0, CABINET_BOTTOM + 8);
    // Hinges.
    for (const hy of [WALL_T + 26, CABINET_BOTTOM - 34]) {
      c.fillStyle = '#c9b27a';
      rr(c, x0 === 0 ? x1 - 5 : x0 + 1, hy, 4, 14, 1.5);
      c.fill();
    }
    // Below the cabinet: a band of darker trim tiles.
    for (let y = CABINET_BOTTOM + 8; y < ct; y += 15) {
      c.fillStyle = '#4c9a92';
      rr(c, x0 + 1, y + 1, x1 - x0 - 2, 13, 2);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.18)';
      c.fillRect(x0 + 2, y + 2, x1 - x0 - 4, 2);
    }
  }

  // Crown moulding (the HUD sits on it).
  const crown = c.createLinearGradient(0, 0, 0, WALL_T);
  crown.addColorStop(0, PAL.tealDark);
  crown.addColorStop(0.55, PAL.teal);
  crown.addColorStop(1, PAL.tealDark);
  c.fillStyle = crown;
  c.fillRect(0, 0, BOARD_W, WALL_T);
  c.fillStyle = PAL.tealLight;
  c.fillRect(0, WALL_T - 9, BOARD_W, 2);
  c.fillStyle = 'rgba(0,0,0,0.25)';
  c.fillRect(0, WALL_T - 3, BOARD_W, 3);

  // Countertop + lower cabinets.
  const top = c.createLinearGradient(0, ct, 0, ct + 10);
  top.addColorStop(0, PAL.woodLight);
  top.addColorStop(1, PAL.wood);
  c.fillStyle = top;
  c.fillRect(0, ct, BOARD_W, 10);
  c.fillStyle = PAL.woodDark;
  c.fillRect(0, ct + 10, BOARD_W, 3);
  c.fillStyle = PAL.teal;
  c.fillRect(0, ct + 13, BOARD_W, H - ct - 13);
  c.strokeStyle = PAL.tealDark;
  c.lineWidth = 2;
  for (let x = 6; x < BOARD_W; x += 87) {
    rr(c, x, ct + 18, 81, H - ct - 14, 4);
    c.stroke();
    c.fillStyle = '#d8c48c';
    rr(c, x + 34, ct + 21, 14, 3, 1.5);
    c.fill();
  }
  // Counter edge shadow onto the tiles.
  c.fillStyle = 'rgba(60,30,10,0.18)';
  c.fillRect(WALL_L, ct - 3, WALL_R - WALL_L, 3);
}

function drawUtensils(c: C) {
  const y = CABINET_BOTTOM + 22;
  c.strokeStyle = '#9aa3a8';
  c.lineWidth = 2.5;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(40, y);
  c.lineTo(BOARD_W - 40, y);
  c.stroke();
  c.lineWidth = 1.5;
  const items: [number, 'ladle' | 'whisk' | 'spatula' | 'spoon'][] = [
    [70, 'ladle'],
    [120, 'whisk'],
    [240, 'spatula'],
    [290, 'spoon'],
  ];
  c.globalAlpha = 0.55;
  for (const [x, kind] of items) {
    c.strokeStyle = '#8b949a';
    c.beginPath();
    c.arc(x, y + 3, 3, Math.PI, 0);
    c.stroke();
    c.strokeStyle = kind === 'spatula' || kind === 'spoon' ? PAL.woodDark : '#8b949a';
    c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(x, y + 6);
    c.lineTo(x, y + 38);
    c.stroke();
    c.lineWidth = 1.5;
    c.fillStyle = kind === 'spatula' || kind === 'spoon' ? PAL.wood : '#aab3b8';
    if (kind === 'ladle') {
      c.beginPath();
      c.arc(x, y + 44, 7, 0, Math.PI);
      c.fill();
    } else if (kind === 'whisk') {
      c.strokeStyle = '#9aa3a8';
      for (const k of [-5, -2, 2, 5]) {
        c.beginPath();
        c.moveTo(x, y + 36);
        c.quadraticCurveTo(x + k * 1.6, y + 48, x, y + 56);
        c.stroke();
      }
    } else if (kind === 'spatula') {
      rr(c, x - 6, y + 36, 12, 16, 3);
      c.fill();
    } else {
      c.beginPath();
      c.ellipse(x, y + 44, 5, 8, 0, 0, Math.PI * 2);
      c.fill();
    }
  }
  c.globalAlpha = 1;
}

/* ------------------------------------------------------------------ items */

const BANDS = ['#3c6fb4', '#2f8f6a', '#c0463a'];
const BOWLS = [
  ['#d46a43', '#f0a07a'],
  ['#3e8fa0', '#82c6d0'],
  ['#e2b23a', '#f5d98a'],
];
const BOXES = [
  ['#e2453c', '#ffd23f'],
  ['#2f6fd0', '#ffffff'],
  ['#f2a516', '#7a3b12'],
];
const CANS = ['#c8352e', '#3d8a3f', '#e6a520'];

/** Main colours of an item, for shard particles. */
export function itemColors(kind: ItemKind, variant: number): string[] {
  switch (kind) {
    case 'plates':
      return ['#fbf7ee', '#fbf7ee', BANDS[variant % 3]];
    case 'bowls':
      return BOWLS[variant % 3];
    case 'glasses':
      return ['rgba(190,230,245,0.9)', '#ffffff', '#a9d8ea'];
    case 'box':
      return [...BOXES[variant % 3], '#f0c060'];
    case 'cans':
      return [CANS[variant % 3], '#c9cfd3'];
    case 'pot':
      return ['#c9cfd3', '#8e979d'];
    case 'pan':
      return ['#3a3634', '#55504c'];
  }
}

/**
 * Draw an item in its slot. `damage` 0 = pristine, rising with each hit taken.
 * The item rests on the bottom edge of the slot (the plank).
 */
export function drawItem(c: C, kind: ItemKind, x: number, y: number, w: number, h: number, variant: number, damage: number) {
  const bottom = y + h;
  c.save();
  c.lineJoin = 'round';
  c.lineCap = 'round';
  switch (kind) {
    case 'plates': {
      const n = 5;
      const pw = w - 3;
      const px = x + 1.5;
      for (let i = 0; i < n; i++) {
        const py = bottom - 4.6 - i * 4.4;
        c.fillStyle = '#fbf7ee';
        c.strokeStyle = '#b8ab95';
        c.lineWidth = 0.8;
        rr(c, px + (i % 2) * 0.6, py, pw, 4.4, 2.2);
        c.fill();
        c.stroke();
        c.strokeStyle = BANDS[variant % 3];
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(px + 3, py + 2.2);
        c.lineTo(px + pw - 3, py + 2.2);
        c.stroke();
      }
      const ty = bottom - 4.6 - (n - 1) * 4.4;
      c.fillStyle = '#fffdf8';
      c.strokeStyle = '#b8ab95';
      c.lineWidth = 0.8;
      c.beginPath();
      c.ellipse(x + w / 2, ty, pw / 2, 3.4, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.strokeStyle = BANDS[variant % 3];
      c.beginPath();
      c.ellipse(x + w / 2, ty, pw / 2 - 3.5, 2, 0, 0, Math.PI * 2);
      c.stroke();
      break;
    }
    case 'bowls': {
      const [col, light] = BOWLS[variant % 3];
      // Three nested bowls: draw the bottom (biggest) body, then rims.
      const bw = w - 2;
      const bx = x + 1;
      const top = bottom - 19;
      c.fillStyle = col;
      c.strokeStyle = PAL.ink;
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(bx, top);
      c.bezierCurveTo(bx, top + 15, bx + bw * 0.2, bottom - 2, bx + bw * 0.3, bottom - 2);
      c.lineTo(bx + bw * 0.7, bottom - 2);
      c.bezierCurveTo(bx + bw * 0.8, bottom - 2, bx + bw, top + 15, bx + bw, top);
      c.closePath();
      c.fill();
      c.stroke();
      c.fillStyle = PAL.ink;
      c.fillRect(bx + bw * 0.32, bottom - 2, bw * 0.36, 2);
      // Rims of the stacked bowls peeking above.
      for (let i = 2; i >= 0; i--) {
        const ry = top - i * 3.2;
        const inset = i * 1.5;
        c.fillStyle = i === 0 ? light : col;
        c.beginPath();
        c.ellipse(x + w / 2, ry, bw / 2 - inset, 3, 0, 0, Math.PI * 2);
        c.fill();
        c.stroke();
      }
      c.fillStyle = 'rgba(0,0,0,0.18)';
      c.beginPath();
      c.ellipse(x + w / 2, top - 6.4, bw / 2 - 6, 1.6, 0, 0, Math.PI * 2);
      c.fill();
      // Dots pattern.
      c.fillStyle = 'rgba(255,255,255,0.55)';
      for (let i = 0; i < 4; i++) {
        c.beginPath();
        c.arc(bx + bw * (0.22 + i * 0.19), top + 6 + (i % 2) * 3, 1.3, 0, Math.PI * 2);
        c.fill();
      }
      break;
    }
    case 'glasses': {
      const gw = (w - 4) / 3;
      for (let i = 0; i < 3; i++) {
        const gx = x + 2 + i * gw;
        const gh = i === 1 ? h - 1 : h - 5;
        const gt = bottom - gh;
        c.beginPath();
        c.moveTo(gx + 0.5, gt);
        c.lineTo(gx + gw - 0.5, gt);
        c.lineTo(gx + gw - 1.8, bottom);
        c.lineTo(gx + 1.8, bottom);
        c.closePath();
        c.fillStyle = 'rgba(200,236,248,0.55)';
        c.fill();
        if ((variant + i) % 3 === 0) {
          // Juice!
          c.fillStyle = 'rgba(255,160,40,0.75)';
          c.fillRect(gx + 1.6, gt + gh * 0.45, gw - 3.2, gh * 0.55 - 1);
        }
        c.strokeStyle = 'rgba(70,120,150,0.9)';
        c.lineWidth = 0.9;
        c.stroke();
        c.strokeStyle = 'rgba(255,255,255,0.95)';
        c.lineWidth = 1.2;
        c.beginPath();
        c.moveTo(gx + 2.4, gt + 2.5);
        c.lineTo(gx + 2.9, bottom - 4);
        c.stroke();
        c.fillStyle = 'rgba(70,120,150,0.35)';
        c.fillRect(gx + 1.8, bottom - 2, gw - 3.6, 2);
      }
      break;
    }
    case 'box': {
      const [main, acc] = BOXES[variant % 3];
      // Tall cereal box.
      const bw = w * 0.58;
      c.fillStyle = main;
      c.strokeStyle = PAL.ink;
      c.lineWidth = 1;
      rr(c, x + 1, y, bw, h, 1.5);
      c.fill();
      c.stroke();
      c.fillStyle = 'rgba(0,0,0,0.15)';
      c.fillRect(x + 1 + bw - 4, y + 0.5, 3.5, h - 1);
      c.fillStyle = acc;
      rr(c, x + 3.5, y + 3, bw - 8, 6, 1.5);
      c.fill();
      // Bowl of O's logo.
      c.fillStyle = '#fff';
      c.beginPath();
      c.arc(x + 1 + bw / 2 - 1.5, y + 16, 6, 0, Math.PI);
      c.fill();
      c.strokeStyle = acc === '#ffffff' ? '#ffd23f' : acc;
      c.lineWidth = 1.2;
      for (const [ox, oy] of [
        [-3.5, 14.5],
        [0, 13],
        [3.2, 14.6],
      ]) {
        c.beginPath();
        c.arc(x + 1 + bw / 2 - 1.5 + ox, y + oy, 1.6, 0, Math.PI * 2);
        c.stroke();
      }
      // Small pasta box beside it.
      const sx = x + bw + 2;
      const sw = w - bw - 3;
      const sh2 = h * 0.62;
      c.fillStyle = variant % 2 ? '#f5f0e6' : '#ffd23f';
      c.strokeStyle = PAL.ink;
      c.lineWidth = 1;
      rr(c, sx, bottom - sh2, sw, sh2, 1.5);
      c.fill();
      c.stroke();
      c.fillStyle = variant % 2 ? '#2f6fd0' : '#c8352e';
      c.fillRect(sx + 1.5, bottom - sh2 + 4, sw - 3, 5);
      // Little pasta window.
      c.fillStyle = '#f2c46b';
      c.fillRect(sx + 2.5, bottom - 6, sw - 5, 3);
      break;
    }
    case 'cans': {
      const cw = (w - 4) / 2;
      for (let i = 0; i < 2; i++) {
        const cx = x + 1.5 + i * (cw + 1);
        const ch = h - 3;
        const top = bottom - ch;
        const g = c.createLinearGradient(cx, 0, cx + cw, 0);
        g.addColorStop(0, '#9aa3a8');
        g.addColorStop(0.35, '#eef2f4');
        g.addColorStop(1, '#8a9398');
        c.fillStyle = g;
        rr(c, cx, top, cw, ch, 2);
        c.fill();
        c.fillStyle = CANS[(variant + i) % 3];
        c.fillRect(cx, top + 4, cw, ch - 8);
        c.fillStyle = 'rgba(255,255,255,0.85)';
        c.beginPath();
        c.ellipse(cx + cw / 2, top + ch / 2, cw / 2 - 3, 3.2, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = CANS[(variant + i) % 3];
        c.beginPath();
        c.arc(cx + cw / 2, top + ch / 2, 1.6, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = 'rgba(255,255,255,0.35)';
        c.fillRect(cx + 2.5, top + 4, 2, ch - 8);
        c.strokeStyle = PAL.ink;
        c.lineWidth = 0.9;
        rr(c, cx, top, cw, ch, 2);
        c.stroke();
        c.beginPath();
        c.ellipse(cx + cw / 2, top + 0.5, cw / 2 - 0.5, 1.6, 0, 0, Math.PI * 2);
        c.fillStyle = '#d8dee1';
        c.fill();
        c.stroke();
      }
      break;
    }
    case 'pot': {
      const pw = w - 10;
      const px = x + 5;
      const ph = h - 9;
      const top = bottom - ph;
      const g = c.createLinearGradient(px, 0, px + pw, 0);
      g.addColorStop(0, '#7f888e');
      g.addColorStop(0.3, '#f1f4f6');
      g.addColorStop(0.6, '#c3cace');
      g.addColorStop(1, '#6f787e');
      // Handles.
      c.strokeStyle = '#3b3f42';
      c.lineWidth = 2.6;
      c.beginPath();
      c.moveTo(px - 0.5, top + 4);
      c.lineTo(px - 4, top + 4);
      c.moveTo(px + pw + 0.5, top + 4);
      c.lineTo(px + pw + 4, top + 4);
      c.stroke();
      c.fillStyle = g;
      c.strokeStyle = PAL.ink;
      c.lineWidth = 1;
      rr(c, px, top, pw, ph, 3);
      c.fill();
      c.stroke();
      c.fillStyle = 'rgba(0,0,0,0.12)';
      c.fillRect(px + 1, bottom - 4, pw - 2, 3);
      // Lid.
      const tilt = damage > 0 ? -0.18 : 0;
      c.save();
      c.translate(x + w / 2, top);
      c.rotate(tilt);
      c.fillStyle = '#d6dcdf';
      c.beginPath();
      c.ellipse(0, 0, pw / 2 + 1.5, 3.6, 0, Math.PI, 0);
      c.closePath();
      c.fill();
      c.stroke();
      c.fillStyle = '#3b3f42';
      rr(c, -3.5, -7, 7, 3.5, 1.5);
      c.fill();
      c.restore();
      if (damage > 0) {
        c.strokeStyle = 'rgba(40,40,40,0.55)';
        c.lineWidth = 1;
        c.beginPath();
        c.arc(px + pw * 0.62, top + ph * 0.5, 4, 0.6, 2.6);
        c.stroke();
        c.strokeStyle = 'rgba(255,255,255,0.7)';
        c.beginPath();
        c.arc(px + pw * 0.62, top + ph * 0.5 - 1, 4, 3.6, 5.6);
        c.stroke();
      }
      break;
    }
    case 'pan': {
      // Two cast-iron skillets stacked, handles sticking out.
      for (let i = 0; i < 2; i++) {
        const cy = bottom - 6 - i * 8;
        const rx = (w - 11) / 2;
        const cx = x + 1 + rx + (i ? 2 : 0);
        c.strokeStyle = '#211e1c';
        c.lineWidth = 3.4;
        c.beginPath();
        c.moveTo(cx + rx - 1, cy);
        c.lineTo(cx + rx + 9, cy - 2.5);
        c.stroke();
        c.fillStyle = '#2d2a28';
        c.beginPath();
        c.ellipse(cx, cy + 1.5, rx, 4.6, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#4a4542';
        c.beginPath();
        c.ellipse(cx, cy, rx, 4.2, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#25221f';
        c.beginPath();
        c.ellipse(cx, cy + 0.4, rx - 2.4, 2.8, 0, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = 'rgba(255,255,255,0.22)';
        c.lineWidth = 1;
        c.beginPath();
        c.ellipse(cx, cy, rx - 0.6, 3.6, 0, Math.PI * 1.05, Math.PI * 1.6);
        c.stroke();
      }
      // A wooden spoon resting on top for character.
      c.strokeStyle = PAL.woodDark;
      c.lineWidth = 1.8;
      c.beginPath();
      c.moveTo(x + 6, y + 6);
      c.lineTo(x + w - 10, y + 2);
      c.stroke();
      c.fillStyle = PAL.wood;
      c.beginPath();
      c.ellipse(x + 5, y + 6.3, 3.2, 2, -0.2, 0, Math.PI * 2);
      c.fill();
      if (damage > 0) {
        c.strokeStyle = 'rgba(255,190,120,0.85)';
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(x + w * 0.35, bottom - 8);
        c.lineTo(x + w * 0.45, bottom - 4);
        c.lineTo(x + w * 0.4, bottom - 1);
        if (damage > 1) {
          c.moveTo(x + w * 0.6, bottom - 16);
          c.lineTo(x + w * 0.52, bottom - 12);
          c.lineTo(x + w * 0.6, bottom - 9);
        }
        c.stroke();
      }
      break;
    }
  }
  if (damage > 0 && kind === 'cans') {
    c.strokeStyle = 'rgba(30,30,30,0.6)';
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(x + 5, y + 8);
    c.quadraticCurveTo(x + 9, y + 11, x + 6, y + 15);
    c.moveTo(x + w - 9, y + 12);
    c.quadraticCurveTo(x + w - 5, y + 15, x + w - 8, y + 19);
    c.stroke();
  }
  c.restore();
}

/* ------------------------------------------------------------------ ball, paddle */

/** The ball is a lemon. */
export function drawBall(c: C, x: number, y: number, r: number, spin: number) {
  c.save();
  c.translate(x, y);
  c.fillStyle = 'rgba(60,30,0,0.18)';
  c.beginPath();
  c.ellipse(1.5, 2.5, r * 1.05, r * 0.9, 0, 0, Math.PI * 2);
  c.fill();
  c.rotate(spin);
  const g = c.createRadialGradient(-r * 0.4, -r * 0.4, 1, 0, 0, r * 1.2);
  g.addColorStop(0, '#fff7a8');
  g.addColorStop(0.5, '#ffd92e');
  g.addColorStop(1, '#e0a300');
  c.fillStyle = g;
  c.beginPath();
  c.ellipse(0, 0, r * 1.12, r * 0.95, 0, 0, Math.PI * 2);
  c.fill();
  // Nubs.
  c.fillStyle = '#e8b400';
  c.beginPath();
  c.ellipse(r * 1.12, 0, 1.8, 1.4, 0, 0, Math.PI * 2);
  c.ellipse(-r * 1.12, 0, 1.4, 1.1, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#a86f00';
  c.lineWidth = 0.9;
  c.beginPath();
  c.ellipse(0, 0, r * 1.12, r * 0.95, 0, 0, Math.PI * 2);
  c.stroke();
  // Leaf.
  c.fillStyle = '#4c9a3a';
  c.beginPath();
  c.ellipse(r * 1.05, -2.6, 2.6, 1.2, -0.7, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = 'rgba(255,255,255,0.8)';
  c.beginPath();
  c.ellipse(-r * 0.35, -r * 0.4, 1.8, 1.1, -0.6, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

/** The paddle is a wooden cutting board. `squash` 0..1 after a hit. */
export function drawPaddle(c: C, x: number, y: number, w: number, h: number, squash: number, tilt: number) {
  c.save();
  c.translate(x, y + h / 2);
  c.rotate(tilt);
  const sw = w * (1 + squash * 0.08);
  const sh = h * (1 - squash * 0.25);
  c.fillStyle = 'rgba(60,30,10,0.25)';
  rr(c, -sw / 2 + 2, -sh / 2 + 4, sw, sh, sh / 2);
  c.fill();
  // Board edge (thickness).
  c.fillStyle = PAL.woodDark;
  rr(c, -sw / 2, -sh / 2 + 2.5, sw, sh, sh / 2);
  c.fill();
  const g = c.createLinearGradient(0, -sh / 2, 0, sh / 2);
  g.addColorStop(0, '#f2c48a');
  g.addColorStop(1, PAL.wood);
  c.fillStyle = g;
  rr(c, -sw / 2, -sh / 2, sw, sh - 1.5, sh / 2);
  c.fill();
  // Grain.
  c.strokeStyle = 'rgba(150,90,40,0.4)';
  c.lineWidth = 0.8;
  for (const [a, b, yy] of [
    [-0.36, 0.1, -2.2],
    [-0.05, 0.32, 0.8],
    [-0.3, -0.12, 2.6],
  ]) {
    c.beginPath();
    c.moveTo(sw * a, yy);
    c.lineTo(sw * b, yy);
    c.stroke();
  }
  // Hanging hole at the right end.
  c.fillStyle = PAL.woodDark;
  c.beginPath();
  c.ellipse(sw / 2 - 7, -0.5, 2.6, 2, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = PAL.ink;
  c.lineWidth = 1;
  rr(c, -sw / 2, -sh / 2, sw, sh + 1, sh / 2);
  c.stroke();
  c.restore();
}

/* ------------------------------------------------------------------ critters */

export function drawCritter(c: C, k: Critter) {
  c.save();
  c.translate(k.x, k.y + k.h);
  c.scale(k.dir, 1);
  if (k.kind === 'slug') {
    const wob = Math.sin(k.t * 4) * 1.2;
    const len = k.w + wob;
    // Body.
    c.fillStyle = '#a08a3e';
    c.strokeStyle = '#4d3f16';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(-len / 2, 0);
    c.quadraticCurveTo(-len / 2 + 4, -7, len * 0.15, -9);
    c.quadraticCurveTo(len / 2 + 2, -10, len / 2, -2);
    c.lineTo(len / 2, 0);
    c.closePath();
    c.fill();
    c.stroke();
    // Mantle + belly.
    c.fillStyle = '#b9a352';
    c.beginPath();
    c.ellipse(len * 0.18, -6.8, 6.5, 2.8, -0.1, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#d8c98a';
    c.fillRect(-len / 2 + 2, -1.6, len - 3, 1.6);
    // Spots.
    c.fillStyle = 'rgba(77,63,22,0.55)';
    for (const sx of [-6, -1, 5]) {
      c.beginPath();
      c.arc(sx + wob * 0.3, -4, 0.9, 0, Math.PI * 2);
      c.fill();
    }
    // Eye stalks.
    c.strokeStyle = '#7d6a2c';
    c.lineWidth = 1.2;
    const sway = Math.sin(k.t * 3) * 1.5;
    c.beginPath();
    c.moveTo(len / 2 - 3, -7);
    c.lineTo(len / 2 + 2 + sway, -15);
    c.moveTo(len / 2 - 1, -6);
    c.lineTo(len / 2 + 5 + sway, -12);
    c.stroke();
    c.fillStyle = '#1b160a';
    c.beginPath();
    c.arc(len / 2 + 2 + sway, -15, 1.5, 0, Math.PI * 2);
    c.arc(len / 2 + 5 + sway, -12, 1.4, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(255,255,255,0.6)';
    c.beginPath();
    c.ellipse(len * 0.05, -7.5, 3, 0.9, -0.1, 0, Math.PI * 2);
    c.fill();
  } else {
    const legT = k.moving ? k.t * 40 : 0;
    // Legs.
    c.strokeStyle = '#3a1d0c';
    c.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const lx = -5 + i * 5;
      const ph = Math.sin(legT + i * 2.1) * 2.2;
      c.beginPath();
      c.moveTo(lx, -3);
      c.lineTo(lx - 2 + ph, 0.5);
      c.moveTo(lx, -3);
      c.lineTo(lx + 2 - ph, 0.5);
      c.stroke();
    }
    // Body.
    const g = c.createLinearGradient(0, -k.h, 0, 0);
    g.addColorStop(0, '#9b5a2c');
    g.addColorStop(1, '#5c2f12');
    c.fillStyle = g;
    c.strokeStyle = '#2a1407';
    c.beginPath();
    c.ellipse(-1, -4.6, k.w / 2 - 1.5, 4.4, 0, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    // Wing split + shine.
    c.beginPath();
    c.moveTo(4, -4.6);
    c.lineTo(-k.w / 2 + 1, -4.6);
    c.stroke();
    c.fillStyle = 'rgba(255,220,180,0.45)';
    c.beginPath();
    c.ellipse(-2, -7, 4.5, 1, 0, 0, Math.PI * 2);
    c.fill();
    // Head.
    c.fillStyle = '#4a250e';
    c.beginPath();
    c.ellipse(k.w / 2 - 1.5, -4, 3, 2.6, 0, 0, Math.PI * 2);
    c.fill();
    // Antennae.
    const wig = Math.sin(k.t * 18) * 1.8;
    c.strokeStyle = '#3a1d0c';
    c.lineWidth = 0.8;
    c.beginPath();
    c.moveTo(k.w / 2, -5.5);
    c.quadraticCurveTo(k.w / 2 + 6, -12, k.w / 2 + 12, -10 + wig);
    c.moveTo(k.w / 2, -4.5);
    c.quadraticCurveTo(k.w / 2 + 7, -8, k.w / 2 + 13, -5 - wig);
    c.stroke();
  }
  c.restore();
}

/** Glossy slime trail the slug leaves on its shelf. */
export function drawSlime(c: C, y: number, x0: number, x1: number) {
  const a = Math.min(x0, x1);
  const b = Math.max(x0, x1);
  const g = c.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, 'rgba(210,235,200,0)');
  g.addColorStop(1, 'rgba(210,235,200,0.75)');
  c.fillStyle = g;
  c.fillRect(a, y - 1.5, b - a, 1.5);
}

export const SLOT_W = COL_W - 4;
export const SLOT_H = ITEM_H;
