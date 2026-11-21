/**
 * Cabinet Breaker art, all drawn with canvas paths (no images). Coordinates are board units.
 * Look: Ben and Shai's real kitchen in a flat cartoon style: white flat-panel cabinets with brass
 * bow handles, glossy black marble backsplash, black speckled granite counter, and their own things
 * on the shelves (pink French press, clay pot, kettle, air fryer, Spark soap, green colander…).
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
import { paddleY, type Critter } from './sim';

type C = CanvasRenderingContext2D;

export const PAL = {
  white: '#f8f7f3',
  whiteShade: '#e4e1da',
  whiteDeep: '#cfcac0',
  brass: '#b8924a',
  brassLight: '#ecd08a',
  marble: '#17171a',
  granite: '#262629',
  wood: '#d6ae74',
  woodDark: '#a97c43',
  woodLight: '#ecd09c',
  bamboo: '#ecd29a',
  bambooDark: '#b99558',
  steelDark: '#7b858c',
  steelLight: '#f2f5f7',
  ink: '#241a14',
};

/** The counter top: the cutting board rests on it. */
export function counterTop(H: number) {
  return paddleY(H) + 14;
}

function rr(c: C, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}

/** Small deterministic random so the marble veins and granite specks don't change per frame. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a * 1664525 + 1013904223) >>> 0;
    return a / 4294967296;
  };
}

function steel(c: C, x: number, w: number) {
  const g = c.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, PAL.steelDark);
  g.addColorStop(0.3, PAL.steelLight);
  g.addColorStop(0.55, '#c6cdd2');
  g.addColorStop(1, '#6d777e');
  return g;
}

/** Curved antique-brass bow handle. Vertical when `vertical`, otherwise horizontal. */
function bowHandle(c: C, x: number, y: number, len: number, vertical: boolean, bulge = 3) {
  c.save();
  c.lineCap = 'round';
  c.strokeStyle = '#6e5320';
  c.lineWidth = 2.6;
  c.beginPath();
  if (vertical) {
    c.moveTo(x, y);
    c.quadraticCurveTo(x - bulge * 2, y + len / 2, x, y + len);
  } else {
    c.moveTo(x, y);
    c.quadraticCurveTo(x + len / 2, y + bulge * 2, x + len, y);
  }
  c.stroke();
  c.strokeStyle = PAL.brass;
  c.lineWidth = 1.8;
  c.stroke();
  c.strokeStyle = PAL.brassLight;
  c.lineWidth = 0.7;
  c.stroke();
  c.fillStyle = '#7d5f26';
  for (const [px, py] of vertical
    ? [
        [x, y],
        [x, y + len],
      ]
    : [
        [x, y],
        [x + len, y],
      ]) {
    c.beginPath();
    c.arc(px, py, 1.4, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

/* ------------------------------------------------------------------ background */

/** Glossy black marble tiles with thin white veins, filling a rectangle. */
function marble(c: C, x0: number, y0: number, x1: number, y1: number) {
  c.save();
  c.beginPath();
  c.rect(x0, y0, x1 - x0, y1 - y0);
  c.clip();
  c.fillStyle = '#2c2c31';
  c.fillRect(x0, y0, x1 - x0, y1 - y0);
  const tw = 60;
  const th = 40;
  const rnd = seeded(7);
  for (let ty = y0, r = 0; ty < y1; ty += th, r++) {
    for (let tx = x0 - (r % 2) * 30; tx < x1; tx += tw) {
      const g = c.createLinearGradient(tx, ty, tx + tw, ty + th);
      g.addColorStop(0, '#1d1d21');
      g.addColorStop(0.5, PAL.marble);
      g.addColorStop(1, '#202024');
      c.fillStyle = g;
      c.fillRect(tx + 0.6, ty + 0.6, tw - 1.2, th - 1.2);
      // Veins.
      const n = 1 + Math.floor(rnd() * 3);
      for (let i = 0; i < n; i++) {
        c.strokeStyle = `rgba(235,235,240,${0.18 + rnd() * 0.32})`;
        c.lineWidth = 0.4 + rnd() * 0.6;
        c.beginPath();
        const sx = tx + rnd() * tw;
        const sy = ty + rnd() * 6;
        c.moveTo(sx, sy);
        c.bezierCurveTo(
          sx + (rnd() - 0.5) * 40,
          ty + th * 0.35,
          sx + (rnd() - 0.5) * 40,
          ty + th * 0.7,
          sx + (rnd() - 0.5) * 50,
          ty + th,
        );
        c.stroke();
        if (rnd() < 0.5) {
          // A little branch.
          c.beginPath();
          c.moveTo(sx + (rnd() - 0.5) * 10, ty + th * 0.5);
          c.lineTo(sx + (rnd() - 0.5) * 30, ty + th * (0.6 + rnd() * 0.3));
          c.stroke();
        }
      }
      // Gloss streak.
      c.fillStyle = 'rgba(255,255,255,0.05)';
      c.beginPath();
      c.moveTo(tx + tw * 0.15, ty + 1);
      c.lineTo(tx + tw * 0.4, ty + 1);
      c.lineTo(tx + tw * 0.2, ty + th - 1);
      c.lineTo(tx + 1, ty + th - 1);
      c.closePath();
      c.fill();
    }
  }
  c.restore();
}

export function drawBackground(c: C, H: number) {
  const ct = counterTop(H);

  // Black marble everywhere behind (wall above the cabinets and the backsplash).
  marble(c, 0, 0, BOARD_W, ct);

  // Warm under-cabinet light on the marble.
  const glow = c.createLinearGradient(0, CABINET_BOTTOM, 0, CABINET_BOTTOM + 160);
  glow.addColorStop(0, 'rgba(255,220,160,0.22)');
  glow.addColorStop(1, 'rgba(255,220,160,0)');
  c.fillStyle = glow;
  c.fillRect(0, CABINET_BOTTOM, BOARD_W, 160);

  drawCounterDecor(c, ct);

  // Cabinet interior.
  const back = c.createLinearGradient(0, WALL_T, 0, CABINET_BOTTOM);
  back.addColorStop(0, '#c9c4ba');
  back.addColorStop(0.2, '#dad6cd');
  back.addColorStop(1, '#e2ded5');
  c.fillStyle = back;
  c.fillRect(WALL_L, WALL_T, WALL_R - WALL_L, CABINET_BOTTOM - WALL_T);
  const sh = c.createLinearGradient(0, WALL_T, 0, WALL_T + 20);
  sh.addColorStop(0, 'rgba(40,30,20,0.28)');
  sh.addColorStop(1, 'rgba(40,30,20,0)');
  c.fillStyle = sh;
  c.fillRect(WALL_L, WALL_T, WALL_R - WALL_L, 20);

  // White shelves.
  for (let r = 0; r < MAX_ROWS; r++) {
    const y = plankY(r);
    const s = c.createLinearGradient(0, y + PLANK_H, 0, y + PLANK_H + 9);
    s.addColorStop(0, 'rgba(50,40,30,0.22)');
    s.addColorStop(1, 'rgba(50,40,30,0)');
    c.fillStyle = s;
    c.fillRect(WALL_L, y + PLANK_H, WALL_R - WALL_L, 9);
    c.fillStyle = '#fdfcf9';
    c.fillRect(WALL_L, y, WALL_R - WALL_L, 2.5);
    c.fillStyle = PAL.whiteShade;
    c.fillRect(WALL_L, y + 2.5, WALL_R - WALL_L, PLANK_H - 2.5);
    c.fillStyle = PAL.whiteDeep;
    c.fillRect(WALL_L, y + PLANK_H - 1, WALL_R - WALL_L, 1);
  }

  // Partitions between the cabinets of the run (decor only: the ball passes in front).
  for (let k = 1; k < 4; k++) {
    const x = WALL_L + k * 2 * COL_W;
    c.fillStyle = 'rgba(40,30,20,0.12)';
    c.fillRect(x + 2, WALL_T, 3, CABINET_BOTTOM - WALL_T);
    c.fillStyle = PAL.white;
    c.fillRect(x - 2, WALL_T, 4, CABINET_BOTTOM - WALL_T);
    c.fillStyle = PAL.whiteShade;
    c.fillRect(x + 1, WALL_T, 1, CABINET_BOTTOM - WALL_T);
  }

  // Cabinet bottom rail.
  c.fillStyle = PAL.white;
  c.fillRect(0, CABINET_BOTTOM - 4, BOARD_W, 10);
  c.fillStyle = PAL.whiteShade;
  c.fillRect(0, CABINET_BOTTOM + 4, BOARD_W, 2);
  c.fillStyle = 'rgba(0,0,0,0.35)';
  c.fillRect(0, CABINET_BOTTOM + 6, BOARD_W, 2);

  // Side frames: the open doors, swung out towards us, brass bow handles on show.
  for (const left of [true, false]) {
    const x0 = left ? 0 : WALL_R;
    const x1 = left ? WALL_L : BOARD_W;
    const g = c.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, left ? '#d9d5cd' : '#ffffff');
    g.addColorStop(1, left ? '#ffffff' : '#d9d5cd');
    c.fillStyle = g;
    c.fillRect(x0, WALL_T - 3, x1 - x0, CABINET_BOTTOM - WALL_T + 9);
    // Door edge line.
    c.fillStyle = PAL.whiteDeep;
    c.fillRect(left ? x1 - 1.2 : x0, WALL_T - 3, 1.2, CABINET_BOTTOM - WALL_T + 9);
    // Panel inset.
    c.strokeStyle = 'rgba(120,110,95,0.25)';
    c.lineWidth = 0.8;
    c.strokeRect(x0 + 3, WALL_T, x1 - x0 - 6, CABINET_BOTTOM - WALL_T - 14);
    // Handles near the bottom of each upper door (and a second pair halfway up).
    const hx = left ? 5 : BOARD_W - 5;
    bowHandle(c, hx, CABINET_BOTTOM - 46, 22, true, left ? 1.6 : -1.6);
    bowHandle(c, hx, WALL_T + 70, 22, true, left ? 1.6 : -1.6);
  }

  // Below the cabinets: thin black side trim so the play walls read.
  c.fillStyle = 'rgba(255,255,255,0.08)';
  c.fillRect(WALL_L - 1, CABINET_BOTTOM + 8, 1, ct - CABINET_BOTTOM - 8);
  c.fillRect(WALL_R, CABINET_BOTTOM + 8, 1, ct - CABINET_BOTTOM - 8);

  drawTopLedge(c);
  drawCounter(c, H, ct);
}

/** The light wood ledge on top of the cabinets: boards, the copper-handled pan and the fern. */
function drawTopLedge(c: C) {
  const ly = WALL_T - 9;
  // Cabinet top rail.
  c.fillStyle = PAL.white;
  c.fillRect(0, ly + 6, BOARD_W, WALL_T - ly - 6);
  c.fillStyle = 'rgba(0,0,0,0.25)';
  c.fillRect(0, WALL_T - 2.5, BOARD_W, 2.5);

  // Boards leaning on the wall.
  c.save();
  c.translate(76, ly + 2);
  c.rotate(-0.08);
  c.fillStyle = PAL.woodDark;
  rr(c, 0, -34, 22, 34, 4);
  c.fill();
  c.fillStyle = '#c9965a';
  rr(c, 1, -34, 20, 33, 4);
  c.fill();
  c.restore();
  c.save();
  c.translate(92, ly + 2);
  c.rotate(0.06);
  c.fillStyle = PAL.bambooDark;
  rr(c, 0, -30, 26, 30, 5);
  c.fill();
  c.fillStyle = PAL.bamboo;
  rr(c, 1, -30, 24, 29, 5);
  c.fill();
  c.fillStyle = PAL.bambooDark;
  c.beginPath();
  c.arc(13, -25, 2, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = 'rgba(160,120,60,0.4)';
  c.lineWidth = 0.6;
  for (const sx of [6, 11, 16, 21]) {
    c.beginPath();
    c.moveTo(sx, -20);
    c.lineTo(sx, -2);
    c.stroke();
  }
  c.restore();

  // Copper-handled pan.
  const px = 246;
  c.strokeStyle = '#7a3f1c';
  c.lineWidth = 3.4;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(px - 13, ly - 4);
  c.lineTo(px - 30, ly - 14);
  c.stroke();
  c.strokeStyle = '#d07a42';
  c.lineWidth = 2;
  c.stroke();
  c.fillStyle = '#2f2c2a';
  c.beginPath();
  c.moveTo(px - 16, ly - 8);
  c.lineTo(px + 16, ly - 8);
  c.lineTo(px + 13, ly);
  c.lineTo(px - 13, ly);
  c.closePath();
  c.fill();
  c.fillStyle = '#4a4542';
  c.beginPath();
  c.ellipse(px, ly - 8, 16, 2.4, 0, 0, Math.PI * 2);
  c.fill();

  // The ledge itself.
  c.fillStyle = PAL.woodLight;
  c.fillRect(0, ly, BOARD_W, 2.5);
  c.fillStyle = PAL.wood;
  c.fillRect(0, ly + 2.5, BOARD_W, 4);
  c.fillStyle = PAL.woodDark;
  c.fillRect(0, ly + 6, BOARD_W, 1);

  drawFern(c, ly);
}

function drawFern(c: C, ly: number) {
  // Pot on the ledge at the top-right corner.
  const px = 330;
  c.fillStyle = '#f1efe9';
  c.beginPath();
  c.moveTo(px - 11, ly - 14);
  c.lineTo(px + 11, ly - 14);
  c.lineTo(px + 8, ly);
  c.lineTo(px - 8, ly);
  c.closePath();
  c.fill();
  c.fillStyle = PAL.whiteShade;
  c.fillRect(px - 11, ly - 14, 22, 3);
  // Trailing fronds.
  const frond = (x: number, y: number, len: number, ang: number, droop: number, col: string) => {
    c.save();
    c.translate(x, y);
    c.strokeStyle = col;
    c.fillStyle = col;
    c.lineWidth = 0.9;
    const steps = Math.floor(len / 4);
    let fx = 0;
    let fy = 0;
    let a = ang;
    for (let i = 0; i < steps; i++) {
      const nx = fx + Math.cos(a) * 4;
      const ny = fy + Math.sin(a) * 4;
      c.beginPath();
      c.moveTo(fx, fy);
      c.lineTo(nx, ny);
      c.stroke();
      const leaf = 3.4 * (1 - i / steps) + 1;
      for (const side of [-1, 1]) {
        c.save();
        c.translate(nx, ny);
        c.rotate(a + side * 1.1);
        c.beginPath();
        c.ellipse(leaf * 0.6, 0, leaf, leaf * 0.38, 0, 0, Math.PI * 2);
        c.fill();
        c.restore();
      }
      fx = nx;
      fy = ny;
      a += droop;
    }
    c.restore();
  };
  const greens = ['#2f7a35', '#3f9440', '#55a94a'];
  frond(px, ly - 14, 34, -2.2, 0.02, greens[0]);
  frond(px, ly - 14, 30, -1.2, 0.05, greens[2]);
  frond(px - 4, ly - 12, 70, 2.4, -0.03, greens[1]);
  frond(px + 4, ly - 12, 110, 1.75, 0.0, greens[0]);
  frond(px + 6, ly - 12, 140, 1.5, 0.012, greens[2]);
  frond(px + 8, ly - 13, 60, 0.6, 0.05, greens[1]);
}

/** Things standing on the counter behind the paddle: tea towels, foil ball, the gooseneck tap. */
function drawCounterDecor(c: C, ct: number) {
  // Stacked tea towels.
  const tx = 22;
  const cols = ['#e9e4d8', '#c7d9e6', '#e9e4d8'];
  for (let i = 0; i < 3; i++) {
    const y = ct - 6 - i * 5;
    c.fillStyle = cols[i];
    rr(c, tx - (i % 2), y, 30, 5, 1.5);
    c.fill();
    c.fillStyle = i === 1 ? '#5b88b0' : '#c25a4e';
    c.fillRect(tx + 6 - (i % 2), y + 1, 2, 3);
    c.fillRect(tx + 22 - (i % 2), y + 1, 2, 3);
  }
  // Scrunched foil ball.
  const g = c.createRadialGradient(64, ct - 6, 1, 66, ct - 4, 5);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, '#9aa3a9');
  c.fillStyle = g;
  c.beginPath();
  c.arc(66, ct - 4.5, 4.5, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = 'rgba(80,90,95,0.5)';
  c.lineWidth = 0.5;
  c.beginPath();
  c.moveTo(63, ct - 6);
  c.lineTo(67, ct - 4);
  c.lineTo(65, ct - 2);
  c.stroke();

  // Chrome gooseneck mixer tap over the sink.
  const sx = 182;
  c.lineCap = 'round';
  c.strokeStyle = '#59636a';
  c.lineWidth = 4.5;
  c.beginPath();
  c.moveTo(sx, ct - 2);
  c.lineTo(sx, ct - 40);
  c.arc(sx + 9, ct - 40, 9, Math.PI, 0);
  c.lineTo(sx + 18, ct - 32);
  c.stroke();
  c.strokeStyle = '#dfe5e9';
  c.lineWidth = 2.2;
  c.stroke();
  c.fillStyle = '#9aa4ab';
  rr(c, sx - 4, ct - 8, 8, 8, 2);
  c.fill();
  c.strokeStyle = '#c9d0d5';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(sx - 1, ct - 22);
  c.lineTo(sx - 9, ct - 26);
  c.stroke();
}

/** Black speckled granite counter, white base cabinets with a drawer stack and the white stove. */
function drawCounter(c: C, H: number, ct: number) {
  const stoveX = 262;
  const rnd = seeded(3);
  // Granite top surface + front edge.
  c.fillStyle = PAL.granite;
  c.fillRect(0, ct, stoveX, 9);
  c.fillStyle = '#1a1a1d';
  c.fillRect(0, ct + 9, stoveX, 6);
  for (let i = 0; i < 260; i++) {
    const x = rnd() * stoveX;
    const y = ct + rnd() * 15;
    const v = rnd();
    c.fillStyle = v < 0.5 ? 'rgba(255,255,255,0.35)' : v < 0.8 ? 'rgba(160,160,170,0.5)' : 'rgba(120,100,80,0.6)';
    c.fillRect(x, y, 0.8, 0.8);
  }
  c.fillStyle = 'rgba(255,255,255,0.16)';
  c.fillRect(0, ct, stoveX, 1);
  c.fillRect(0, ct + 9, stoveX, 0.8);

  // White base cabinets.
  const by = ct + 15;
  const bh = H - by;
  c.fillStyle = PAL.white;
  c.fillRect(0, by, stoveX, bh);
  c.fillStyle = 'rgba(0,0,0,0.12)';
  c.fillRect(0, by, stoveX, 2.5);
  c.strokeStyle = PAL.whiteDeep;
  c.lineWidth = 1;
  // Stack of 4 drawers.
  const dw = 96;
  const dh = bh / 4;
  for (let i = 0; i < 4; i++) {
    c.strokeRect(4.5, by + 2 + i * dh, dw, dh - 2);
    bowHandle(c, 4.5 + dw / 2 - 9, by + 5 + i * dh, 18, false, 1.6);
  }
  // Two doors.
  for (let i = 0; i < 2; i++) {
    const x = 104 + i * 79;
    c.strokeRect(x + 0.5, by + 2, 76, bh);
    bowHandle(c, i === 0 ? x + 70 : x + 6, by + 6, 16, true, i === 0 ? 1.4 : -1.4);
  }

  // Freestanding white stove at the end of the run.
  const sw = BOARD_W - stoveX;
  c.fillStyle = '#fbfbf9';
  c.fillRect(stoveX, ct - 1, sw, H - ct + 1);
  c.fillStyle = '#e8e6e1';
  c.fillRect(stoveX, ct - 1, 2, H - ct + 1);
  // Hob grate.
  c.fillStyle = '#2b2b2e';
  c.fillRect(stoveX + 6, ct - 3, sw - 12, 3);
  // Knob strip with round white knobs.
  c.fillStyle = '#efede8';
  c.fillRect(stoveX + 2, ct + 2, sw - 2, 11);
  for (let i = 0; i < 4; i++) {
    const kx = stoveX + 16 + i * 21;
    c.fillStyle = '#ffffff';
    c.strokeStyle = '#bdb8ae';
    c.beginPath();
    c.arc(kx, ct + 7.5, 4, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.fillStyle = '#8c877e';
    c.fillRect(kx - 0.6, ct + 4, 1.2, 3);
  }
  // Oven door with window.
  c.strokeStyle = '#c9c4ba';
  c.strokeRect(stoveX + 5.5, ct + 16.5, sw - 11, H - ct - 16);
  c.fillStyle = '#2a2a2e';
  rr(c, stoveX + 14, ct + 26, sw - 28, Math.max(10, H - ct - 34), 3);
  c.fill();
  c.fillStyle = 'rgba(255,255,255,0.12)';
  c.fillRect(stoveX + 18, ct + 28, 8, Math.max(6, H - ct - 40));
  c.fillStyle = '#d6d2ca';
  rr(c, stoveX + 14, ct + 19, sw - 28, 3, 1.5);
  c.fill();
}

/* ------------------------------------------------------------------ items */

const RIMS = ['#4d7fbf', '#3c9a76', '#c4574a'];

/** Main colours of an item, for debris particles. */
export function itemColors(kind: ItemKind, variant: number): string[] {
  switch (kind) {
    case 'rackPlates':
      return ['#fbf8f1', '#fbf8f1', RIMS[variant % 3]];
    case 'glasses':
      return ['rgba(190,230,245,0.9)', '#ffffff', '#a9d8ea'];
    case 'steelBowls':
    case 'moka':
    case 'kettle':
    case 'pot':
      return ['#c9cfd3', '#8e979d', '#eef2f4'];
    case 'colander':
      return ['#6fd13a', '#4fae22'];
    case 'soap':
      return ['#c8e03a', '#f3d6dc', '#ffffff'];
    case 'frenchPress':
      return ['#ef94b2', 'rgba(220,240,250,0.9)', '#ffffff'];
    case 'coffee':
      return ['#b8895a', '#5a3420', '#f4ead8'];
    case 'cereal':
      return [['#e2453c', '#2f6fd0', '#f2a516'][variant % 3], '#ffd23f', '#e8a33a'];
    case 'tea':
      return ['#3f8f4a', '#c0463a', '#f4ead8'];
    case 'canisters':
      return ['#ffffff', '#f3ead6', '#4d7fbf', '#d6ae74'];
    case 'spices':
      return ['#c8402a', '#e6a91f', '#5c8a2e', 'rgba(220,238,245,0.9)'];
    case 'oliveOil':
      return ['#2f5a1e', '#3f7a28', '#d7b347'];
    case 'honey':
      return ['#e9a21e', '#f5c04a', 'rgba(220,238,245,0.9)'];
    case 'mugs':
      return [['#4d7fbf', '#f2b632', '#3c9a76', '#d45a7a'][variant % 4], '#ffffff'];
    case 'filterJug':
      return ['#ffffff', '#bfe3f2'];
    case 'pickles':
      return ['rgba(200,235,210,0.9)', '#6f9a35', '#d7b347'];
    case 'tomatoes':
      return ['#d23b2c', '#c9cfd3', '#f0e0c0'];
    case 'crock':
      return ['#b98450', '#8d5d32', '#e2b979'];
    case 'sodaStream':
      return ['#a9d4ec', '#7f8b93', '#ffffff'];
    case 'clayPot':
      return ['#b0603a', '#7d3f22', '#e0a070'];
    case 'airFryer':
      return ['#45474b', '#2c2d30', '#77797d'];
    case 'pan':
      return ['#3a3634', '#55504c'];
  }
}

function cracks(c: C, x: number, y: number, w: number, h: number, damage: number, color: string) {
  c.strokeStyle = color;
  c.lineWidth = 0.9;
  c.beginPath();
  c.moveTo(x + w * 0.3, y + h * 0.15);
  c.lineTo(x + w * 0.42, y + h * 0.45);
  c.lineTo(x + w * 0.34, y + h * 0.7);
  if (damage > 1) {
    c.moveTo(x + w * 0.72, y + h * 0.3);
    c.lineTo(x + w * 0.6, y + h * 0.55);
    c.lineTo(x + w * 0.7, y + h * 0.85);
    c.moveTo(x + w * 0.42, y + h * 0.45);
    c.lineTo(x + w * 0.55, y + h * 0.5);
  }
  c.stroke();
}

function dent(c: C, x: number, y: number) {
  c.strokeStyle = 'rgba(40,40,40,0.55)';
  c.lineWidth = 1;
  c.beginPath();
  c.arc(x, y, 3.5, 0.6, 2.6);
  c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.75)';
  c.beginPath();
  c.arc(x, y - 1, 3.5, 3.6, 5.6);
  c.stroke();
}

/**
 * Draw an item in its slot. `damage` 0 = pristine, rising with each hit taken.
 * The item rests on the bottom edge of the slot (the shelf).
 */
export function drawItem(c: C, kind: ItemKind, x: number, y: number, w: number, h: number, variant: number, damage: number) {
  const b = y + h;
  const cx = x + w / 2;
  c.save();
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.lineWidth = 1;
  c.strokeStyle = PAL.ink;
  switch (kind) {
    case 'rackPlates': {
      // Plates standing upright in a wire dish rack.
      for (let i = 0; i < 4; i++) {
        const px = x + 7 + i * 7.6;
        c.fillStyle = i % 2 ? '#f4f0e6' : '#fdfbf6';
        c.strokeStyle = '#a99d88';
        c.lineWidth = 0.8;
        c.beginPath();
        c.ellipse(px, b - 12, 6, 11.5, 0, 0, Math.PI * 2);
        c.fill();
        c.stroke();
        c.strokeStyle = RIMS[(variant + i) % 3];
        c.lineWidth = 1;
        c.beginPath();
        c.ellipse(px, b - 12, 4.6, 9.6, 0, 0, Math.PI * 2);
        c.stroke();
      }
      // Wire rack.
      c.strokeStyle = '#8c959b';
      c.lineWidth = 1.1;
      c.beginPath();
      c.moveTo(x + 1, b - 1);
      c.lineTo(x + w - 1, b - 1);
      c.moveTo(x + 1, b - 7);
      c.lineTo(x + w - 1, b - 7);
      for (let i = 0; i <= 6; i++) {
        const tx = x + 2 + i * ((w - 4) / 6);
        c.moveTo(tx, b - 1);
        c.lineTo(tx, b - 10);
      }
      c.stroke();
      break;
    }
    case 'glasses': {
      const gw = (w - 4) / 3;
      for (let i = 0; i < 3; i++) {
        const gx = x + 2 + i * gw;
        const gh = i === 1 ? h - 1 : h - 5;
        const gt = b - gh;
        c.beginPath();
        c.moveTo(gx + 0.5, gt);
        c.lineTo(gx + gw - 0.5, gt);
        c.lineTo(gx + gw - 1.8, b);
        c.lineTo(gx + 1.8, b);
        c.closePath();
        c.fillStyle = 'rgba(210,238,248,0.5)';
        c.fill();
        c.fillStyle = 'rgba(120,195,230,0.45)';
        c.fillRect(gx + 1.5, gt + gh * 0.35, gw - 3, gh * 0.65 - 1);
        c.fillStyle = 'rgba(255,255,255,0.6)';
        c.fillRect(gx + 1.5, gt + gh * 0.35, gw - 3, 0.8);
        c.strokeStyle = 'rgba(70,120,150,0.9)';
        c.lineWidth = 0.9;
        c.stroke();
        c.strokeStyle = 'rgba(255,255,255,0.95)';
        c.lineWidth = 1.2;
        c.beginPath();
        c.moveTo(gx + 2.4, gt + 2.5);
        c.lineTo(gx + 2.9, b - 4);
        c.stroke();
      }
      break;
    }
    case 'steelBowls': {
      const bw = w - 2;
      const bx = x + 1;
      const top = b - 17;
      c.fillStyle = steel(c, bx, bw);
      c.beginPath();
      c.moveTo(bx, top);
      c.bezierCurveTo(bx, top + 14, bx + bw * 0.22, b, bx + bw * 0.34, b);
      c.lineTo(bx + bw * 0.66, b);
      c.bezierCurveTo(bx + bw * 0.78, b, bx + bw, top + 14, bx + bw, top);
      c.closePath();
      c.fill();
      c.stroke();
      for (let i = 2; i >= 0; i--) {
        c.fillStyle = i === 0 ? '#dfe4e7' : '#b9c1c6';
        c.beginPath();
        c.ellipse(cx, top - i * 3, bw / 2 - i * 1.4, 2.8, 0, 0, Math.PI * 2);
        c.fill();
        c.stroke();
      }
      c.fillStyle = 'rgba(255,255,255,0.7)';
      c.beginPath();
      c.ellipse(bx + bw * 0.3, top + 6, 2, 4, 0.4, 0, Math.PI * 2);
      c.fill();
      if (damage > 0) dent(c, bx + bw * 0.65, top + 7);
      break;
    }
    case 'colander': {
      // Bright green colander sitting on a little wire rack.
      const bw = w - 4;
      const bx = x + 2;
      const top = b - 18;
      c.strokeStyle = '#8c959b';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(x + 2, b - 0.5);
      c.lineTo(x + w - 2, b - 0.5);
      c.stroke();
      c.fillStyle = '#5cc22e';
      c.strokeStyle = '#2c6a12';
      c.beginPath();
      c.moveTo(bx, top);
      c.bezierCurveTo(bx + 1, top + 14, bx + bw * 0.25, b - 2, bx + bw * 0.38, b - 2);
      c.lineTo(bx + bw * 0.62, b - 2);
      c.bezierCurveTo(bx + bw * 0.75, b - 2, bx + bw - 1, top + 14, bx + bw, top);
      c.closePath();
      c.fill();
      c.stroke();
      // Handles.
      c.fillStyle = '#4fae22';
      rr(c, bx - 2, top - 1, 5, 3, 1.5);
      c.fill();
      rr(c, bx + bw - 3, top - 1, 5, 3, 1.5);
      c.fill();
      c.fillStyle = '#86e05a';
      c.beginPath();
      c.ellipse(cx, top, bw / 2, 3, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      // Holes.
      c.fillStyle = '#1f5a0c';
      for (let r = 0; r < 2; r++) {
        for (let i = 0; i < 6 - r; i++) {
          c.beginPath();
          c.arc(bx + bw * (0.16 + r * 0.07 + i * 0.135), top + 6 + r * 5, 0.9, 0, Math.PI * 2);
          c.fill();
        }
      }
      break;
    }
    case 'soap': {
      // Yellow-green "Spark" dish soap bottle and a hand-soap pump.
      const sx = x + 3;
      c.fillStyle = '#c8e03a';
      c.strokeStyle = '#4f5d10';
      rr(c, sx, b - 22, 13, 22, 3);
      c.fill();
      c.stroke();
      c.fillStyle = '#f3f7d0';
      c.fillRect(sx + 2, b - 15, 9, 7);
      c.fillStyle = '#d0372e';
      c.fillRect(sx + 3, b - 13.5, 7, 1.6);
      c.fillStyle = '#3c78c0';
      c.fillRect(sx + 3, b - 11, 5, 1.2);
      c.fillStyle = '#2e5fa8';
      rr(c, sx + 3.5, b - 26, 6, 4.5, 1.5);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.45)';
      c.fillRect(sx + 1.5, b - 20, 1.5, 16);
      // Pump bottle.
      const px = x + 19;
      c.fillStyle = '#f3d6dc';
      c.strokeStyle = '#6e4b52';
      rr(c, px, b - 15, 14, 15, 4);
      c.fill();
      c.stroke();
      c.fillStyle = '#ffffff';
      c.fillRect(px + 3, b - 10, 8, 5);
      c.fillStyle = '#f2f2f0';
      c.fillRect(px + 5, b - 20, 4, 5);
      c.strokeRect(px + 5, b - 20, 4, 5);
      c.fillRect(px + 3, b - 23, 10, 3);
      c.strokeRect(px + 3, b - 23, 10, 3);
      break;
    }
    case 'frenchPress': {
      const fx = x + 8;
      const fw = 18;
      const top = b - 20;
      // Pink frame & handle.
      c.strokeStyle = '#c95f84';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(fx + fw + 1, top + 4);
      c.quadraticCurveTo(fx + fw + 8, top + 4, fx + fw + 7, top + 11);
      c.quadraticCurveTo(fx + fw + 6, b - 4, fx + fw + 1, b - 4);
      c.stroke();
      c.lineWidth = 1;
      // Glass carafe with coffee.
      c.fillStyle = 'rgba(220,240,250,0.5)';
      c.fillRect(fx, top, fw, 20);
      c.fillStyle = '#5a3420';
      c.fillRect(fx + 1, top + 7, fw - 2, 12);
      c.fillStyle = '#c9a07a';
      c.fillRect(fx + 1, top + 7, fw - 2, 1.5);
      c.strokeStyle = 'rgba(70,90,110,0.8)';
      c.strokeRect(fx, top, fw, 20);
      c.fillStyle = 'rgba(255,255,255,0.6)';
      c.fillRect(fx + 2, top + 1, 1.5, 17);
      // Frame bands, lid and plunger.
      c.fillStyle = '#ef94b2';
      c.fillRect(fx - 1, b - 3, fw + 2, 3);
      c.fillRect(fx - 1, top - 3, fw + 2, 3.5);
      c.fillStyle = '#ef94b2';
      rr(c, fx + 2, top - 6, fw - 4, 3, 1.5);
      c.fill();
      c.fillStyle = '#d9dfe3';
      c.fillRect(cx - 0.8, top - 10, 1.6, 4);
      c.fillStyle = '#c95f84';
      c.beginPath();
      c.arc(cx, top - 10.5, 2.2, 0, Math.PI * 2);
      c.fill();
      break;
    }
    case 'coffee': {
      // Kraft bag of coffee beans with a folded top, and a glass jar of beans.
      const bx = x + 2;
      const bw = 17;
      const top = b - 24;
      c.fillStyle = '#b8895a';
      c.strokeStyle = '#4a3220';
      c.beginPath();
      c.moveTo(bx + 1, top + 4);
      c.lineTo(bx + bw - 1, top + 4);
      c.lineTo(bx + bw, b);
      c.lineTo(bx, b);
      c.closePath();
      c.fill();
      c.stroke();
      c.fillStyle = '#9c7046';
      c.fillRect(bx + 1, top, bw - 2, 4.5);
      c.strokeRect(bx + 1, top, bw - 2, 4.5);
      c.fillStyle = '#d7b47a';
      c.fillRect(bx + 1.5, top + 1.6, bw - 3, 1.2);
      // Label with a coffee bean.
      c.fillStyle = '#f4ead8';
      rr(c, bx + 3, top + 9, bw - 6, 9, 1.5);
      c.fill();
      c.fillStyle = '#4a2a16';
      c.beginPath();
      c.ellipse(bx + bw / 2, top + 13.5, 2.4, 3.2, 0.4, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#c99a62';
      c.lineWidth = 0.6;
      c.beginPath();
      c.moveTo(bx + bw / 2 - 1, top + 11);
      c.quadraticCurveTo(bx + bw / 2 + 1, top + 13.5, bx + bw / 2 - 0.5, top + 16);
      c.stroke();
      // Jar of beans.
      const jx = x + 21;
      const jw = 13;
      c.fillStyle = 'rgba(215,235,240,0.55)';
      rr(c, jx, b - 16, jw, 16, 2.5);
      c.fill();
      c.fillStyle = '#5a3420';
      for (let i = 0; i < 9; i++) {
        c.beginPath();
        c.ellipse(jx + 2.5 + (i % 3) * 4, b - 3 - Math.floor(i / 3) * 3.6, 1.6, 1.2, i, 0, Math.PI * 2);
        c.fill();
      }
      c.strokeStyle = 'rgba(60,80,90,0.8)';
      c.lineWidth = 0.9;
      rr(c, jx, b - 16, jw, 16, 2.5);
      c.stroke();
      c.fillStyle = '#2b2b2e';
      rr(c, jx + 0.5, b - 19, jw - 1, 3.5, 1);
      c.fill();
      break;
    }
    case 'cereal': {
      const colors = [
        ['#e2453c', '#ffd23f'],
        ['#2f6fd0', '#ffffff'],
        ['#f2a516', '#7a3b12'],
      ][variant % 3];
      const bw = w * 0.6;
      c.fillStyle = colors[0];
      rr(c, x + 1, y, bw, h, 1.5);
      c.fill();
      c.stroke();
      c.fillStyle = 'rgba(0,0,0,0.15)';
      c.fillRect(x + bw - 3, y + 0.5, 3.5, h - 1);
      c.fillStyle = colors[1];
      rr(c, x + 3.5, y + 3, bw - 8, 6, 1.5);
      c.fill();
      c.fillStyle = '#fff';
      c.beginPath();
      c.arc(x + 1 + bw / 2 - 1.5, y + 16, 6, 0, Math.PI);
      c.fill();
      c.strokeStyle = colors[1] === '#ffffff' ? '#ffd23f' : colors[1];
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
      // Bowl beside it.
      c.fillStyle = '#fdfbf6';
      c.strokeStyle = PAL.ink;
      c.lineWidth = 0.9;
      const ox = x + bw + 2;
      const ow = w - bw - 3;
      c.beginPath();
      c.moveTo(ox, b - 8);
      c.quadraticCurveTo(ox + ow / 2, b + 2, ox + ow, b - 8);
      c.closePath();
      c.fill();
      c.stroke();
      c.fillStyle = '#e8a33a';
      c.beginPath();
      c.ellipse(ox + ow / 2, b - 8.5, ow / 2 - 0.5, 1.6, 0, 0, Math.PI * 2);
      c.fill();
      break;
    }
    case 'tea': {
      // Two stacked tea boxes and a tea bag tag.
      const tx = x + 3;
      const tw = w - 6;
      const boxes: [string, string][] = [
        ['#3f8f4a', '#e8d27a'],
        ['#c0463a', '#f4ead8'],
      ];
      boxes.forEach(([main, acc], i) => {
        const by = b - 11 - i * 11;
        const bx = tx + (i ? 2 : 0);
        const bw = tw - (i ? 4 : 0);
        c.fillStyle = main;
        c.strokeStyle = PAL.ink;
        c.lineWidth = 0.9;
        rr(c, bx, by, bw, 11, 1.2);
        c.fill();
        c.stroke();
        c.fillStyle = acc;
        rr(c, bx + 3, by + 2.5, bw - 6, 6, 1);
        c.fill();
        // Teacup icon.
        c.fillStyle = main;
        c.beginPath();
        c.arc(bx + bw / 2, by + 5, 2.2, 0, Math.PI);
        c.fill();
        c.strokeStyle = main;
        c.lineWidth = 0.7;
        c.beginPath();
        c.arc(bx + bw / 2 + 2.6, by + 5.8, 1, -1.5, 1.5);
        c.stroke();
      });
      // Tea bag hanging off the top box.
      c.strokeStyle = '#efe7d6';
      c.lineWidth = 0.6;
      c.beginPath();
      c.moveTo(tx + tw - 5, b - 22);
      c.lineTo(tx + tw + 1, b - 16);
      c.stroke();
      c.fillStyle = '#f4ead8';
      c.fillRect(tx + tw - 0.5, b - 16, 3.5, 4);
      break;
    }
    case 'canisters': {
      // Sugar and flour canisters with wooden lids.
      const items: [number, number, string, string][] = [
        [x + 2, 16, '#ffffff', '#4d7fbf'],
        [x + 19, 13, '#f3ead6', '#c79a3a'],
      ];
      items.forEach(([cx0, cw, body, band], i) => {
        const ch = i ? 17 : 21;
        const top = b - ch;
        const g = c.createLinearGradient(cx0, 0, cx0 + cw, 0);
        g.addColorStop(0, '#d6d1c6');
        g.addColorStop(0.35, body);
        g.addColorStop(1, '#cbc5b8');
        c.fillStyle = g;
        c.strokeStyle = '#5d5548';
        c.lineWidth = 0.9;
        rr(c, cx0, top + 3, cw, ch - 3, 2.5);
        c.fill();
        c.stroke();
        c.fillStyle = band;
        c.fillRect(cx0 + 0.5, top + 9, cw - 1, 3);
        // Lid with knob.
        c.fillStyle = PAL.wood;
        rr(c, cx0 - 0.5, top, cw + 1, 4, 1.5);
        c.fill();
        c.strokeStyle = PAL.woodDark;
        c.stroke();
        c.fillStyle = PAL.woodDark;
        c.beginPath();
        c.arc(cx0 + cw / 2, top - 0.6, 1.6, 0, Math.PI * 2);
        c.fill();
      });
      // Little icons: sugar cube, wheat ear.
      c.fillStyle = '#4d7fbf';
      c.fillRect(x + 8, b - 7, 4, 4);
      c.strokeStyle = '#c79a3a';
      c.lineWidth = 0.8;
      c.beginPath();
      c.moveTo(x + 25.5, b - 2);
      c.lineTo(x + 25.5, b - 7);
      for (const dy of [-3, -5, -7]) {
        c.moveTo(x + 25.5, b + dy);
        c.lineTo(x + 24, b + dy - 1.5);
        c.moveTo(x + 25.5, b + dy);
        c.lineTo(x + 27, b + dy - 1.5);
      }
      c.stroke();
      break;
    }
    case 'spices': {
      // Three spice jars: paprika, turmeric, herbs.
      const fills = ['#c8402a', '#e6a91f', '#5c8a2e'];
      for (let i = 0; i < 3; i++) {
        const sx = x + 2 + i * 11.2;
        const sh = i === 1 ? 19 : 16;
        const top = b - sh;
        c.fillStyle = 'rgba(220,238,245,0.5)';
        rr(c, sx, top + 4, 10, sh - 4, 2);
        c.fill();
        c.fillStyle = fills[(i + variant) % 3];
        c.fillRect(sx + 1, top + 4 + (sh - 4) * 0.35, 8, (sh - 4) * 0.65 - 1);
        c.fillStyle = '#fbf6ea';
        c.fillRect(sx + 1.5, top + 8, 7, 3.5);
        c.strokeStyle = 'rgba(60,80,90,0.85)';
        c.lineWidth = 0.8;
        rr(c, sx, top + 4, 10, sh - 4, 2);
        c.stroke();
        c.fillStyle = '#232326';
        rr(c, sx + 0.5, top, 9, 4.5, 1.2);
        c.fill();
        c.fillStyle = 'rgba(255,255,255,0.25)';
        c.fillRect(sx + 1.5, top + 1, 6, 1);
      }
      break;
    }
    case 'oliveOil': {
      // Tall dark-green olive oil bottle and a little dish of olives.
      const ox = x + 8;
      const ow = 12;
      const top = b - h - 1;
      c.fillStyle = '#2f5a1e';
      c.strokeStyle = '#132a08';
      c.beginPath();
      c.moveTo(ox + 4, top + 2);
      c.lineTo(ox + ow - 4, top + 2);
      c.lineTo(ox + ow - 4, top + 8);
      c.quadraticCurveTo(ox + ow, top + 10, ox + ow, top + 13);
      c.lineTo(ox + ow, b);
      c.lineTo(ox, b);
      c.lineTo(ox, top + 13);
      c.quadraticCurveTo(ox, top + 10, ox + 4, top + 8);
      c.closePath();
      c.fill();
      c.stroke();
      c.fillStyle = '#d7b347';
      c.fillRect(ox + 4, top - 1, ow - 8, 3.5);
      c.fillStyle = '#f2e6b8';
      rr(c, ox + 1.5, b - 13, ow - 3, 8, 1);
      c.fill();
      c.fillStyle = '#5c8a2e';
      c.beginPath();
      c.ellipse(ox + ow / 2, b - 9, 1.8, 2.5, 0.3, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.3)';
      c.fillRect(ox + 1.6, top + 13, 1.3, 11);
      // Olive dish.
      c.fillStyle = '#f4f0e6';
      c.strokeStyle = PAL.ink;
      c.lineWidth = 0.8;
      c.beginPath();
      c.ellipse(x + w - 7, b - 2, 6, 2.2, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.fillStyle = '#6f8a2a';
      for (const dx of [-3, 0, 3]) {
        c.beginPath();
        c.ellipse(x + w - 7 + dx, b - 3.6, 1.6, 1.2, 0, 0, Math.PI * 2);
        c.fill();
      }
      break;
    }
    case 'honey': {
      const hx = x + 6;
      const hw = 19;
      const top = b - 19;
      // Honey.
      c.fillStyle = '#e9a21e';
      rr(c, hx, top + 3, hw, 16, 4);
      c.fill();
      c.fillStyle = 'rgba(255,220,120,0.6)';
      c.beginPath();
      c.ellipse(hx + 5, top + 9, 2, 4.5, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#fbf2d8';
      rr(c, hx + 3.5, top + 9, hw - 7, 6, 1.5);
      c.fill();
      // Little bee stripes on the label.
      c.fillStyle = '#2b2118';
      c.fillRect(hx + hw / 2 - 2, top + 10.5, 1.2, 3);
      c.fillRect(hx + hw / 2 + 0.6, top + 10.5, 1.2, 3);
      c.strokeStyle = '#7a4d0a';
      c.lineWidth = 0.9;
      rr(c, hx, top + 3, hw, 16, 4);
      c.stroke();
      // Lid with gingham top.
      c.fillStyle = '#d7b347';
      rr(c, hx + 1, top, hw - 2, 4, 1);
      c.fill();
      c.stroke();
      // Wooden dipper.
      c.strokeStyle = PAL.woodDark;
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(hx + hw - 3, top + 1);
      c.lineTo(hx + hw + 5, top - 5);
      c.stroke();
      c.fillStyle = PAL.wood;
      c.beginPath();
      c.ellipse(hx + hw + 6, top - 6, 2.6, 2, -0.6, 0, Math.PI * 2);
      c.fill();
      break;
    }
    case 'mugs': {
      const cols = ['#4d7fbf', '#f2b632', '#3c9a76', '#d45a7a'];
      for (let i = 0; i < 2; i++) {
        const mx = x + 2 + i * 17;
        const mw = 12;
        const mh = 14 + (i ? 0 : 2);
        const top = b - mh;
        const col = cols[(variant + i) % 4];
        c.strokeStyle = PAL.ink;
        c.lineWidth = 2.4;
        c.beginPath();
        c.arc(mx + mw + 0.5, top + mh / 2, 3.4, -1.4, 1.4);
        c.stroke();
        c.strokeStyle = col;
        c.lineWidth = 1.2;
        c.stroke();
        c.fillStyle = col;
        c.strokeStyle = PAL.ink;
        c.lineWidth = 0.9;
        rr(c, mx, top, mw, mh, 2);
        c.fill();
        c.stroke();
        c.fillStyle = 'rgba(255,255,255,0.85)';
        c.beginPath();
        c.arc(mx + mw / 2, top + mh / 2 + 1, 2.4, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = 'rgba(255,255,255,0.35)';
        c.fillRect(mx + 1.5, top + 1.5, 1.4, mh - 3);
      }
      break;
    }
    case 'moka': {
      // Stovetop espresso pot: eight-sided aluminium body pinched at the waist.
      const mx = cx - 2;
      const top = b - 24;
      const g = steel(c, mx - 8, 16);
      c.fillStyle = g;
      c.strokeStyle = PAL.ink;
      c.lineWidth = 0.9;
      // Bottom chamber.
      c.beginPath();
      c.moveTo(mx - 8, b);
      c.lineTo(mx + 8, b);
      c.lineTo(mx + 5, b - 10);
      c.lineTo(mx - 5, b - 10);
      c.closePath();
      c.fill();
      c.stroke();
      // Top chamber.
      c.beginPath();
      c.moveTo(mx - 5, b - 10);
      c.lineTo(mx + 5, b - 10);
      c.lineTo(mx + 7.5, top + 3);
      c.lineTo(mx - 7.5, top + 3);
      c.closePath();
      c.fill();
      c.stroke();
      // Facet lines.
      c.strokeStyle = 'rgba(60,70,75,0.45)';
      c.beginPath();
      c.moveTo(mx - 2.5, b);
      c.lineTo(mx - 1.8, b - 10);
      c.lineTo(mx - 2.6, top + 3);
      c.moveTo(mx + 2.5, b);
      c.lineTo(mx + 1.8, b - 10);
      c.lineTo(mx + 2.6, top + 3);
      c.stroke();
      // Lid, knob, spout and black handle.
      c.fillStyle = '#d6dcdf';
      c.strokeStyle = PAL.ink;
      c.beginPath();
      c.moveTo(mx - 7.5, top + 3);
      c.lineTo(mx + 7.5, top + 3);
      c.lineTo(mx + 5, top);
      c.lineTo(mx - 5, top);
      c.closePath();
      c.fill();
      c.stroke();
      c.fillStyle = '#222';
      rr(c, mx - 1.6, top - 2.8, 3.2, 3, 1);
      c.fill();
      c.fillStyle = '#c6cdd2';
      c.beginPath();
      c.moveTo(mx - 7.5, top + 3);
      c.lineTo(mx - 11, top + 1);
      c.lineTo(mx - 7, top + 6);
      c.closePath();
      c.fill();
      c.stroke();
      c.strokeStyle = '#1d1d1f';
      c.lineWidth = 2.6;
      c.beginPath();
      c.moveTo(mx + 6.5, top + 5);
      c.quadraticCurveTo(mx + 14, top + 6, mx + 11, b - 12);
      c.stroke();
      if (damage > 0) dent(c, mx + 1, b - 5);
      break;
    }
    case 'filterJug': {
      const jx = x + 8;
      const jw = 18;
      const top = b - 23;
      c.strokeStyle = '#4c5a62';
      // Handle.
      c.fillStyle = '#ffffff';
      rr(c, jx + jw - 1, top + 5, 7, 13, 3);
      c.fill();
      c.stroke();
      c.fillStyle = '#f3f2ef';
      rr(c, jx + jw + 1, top + 8, 3, 7, 1.5);
      c.fill();
      // Body: clear with water, white filter top.
      c.fillStyle = 'rgba(205,235,248,0.65)';
      c.beginPath();
      c.moveTo(jx, top + 3);
      c.lineTo(jx + jw, top + 3);
      c.lineTo(jx + jw - 1, b);
      c.lineTo(jx + 1, b);
      c.closePath();
      c.fill();
      c.stroke();
      c.fillStyle = 'rgba(110,190,230,0.45)';
      c.fillRect(jx + 1.3, top + 12, jw - 2.6, b - top - 12.5);
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.moveTo(jx - 3, top + 3);
      c.lineTo(jx + jw, top);
      c.lineTo(jx + jw, top + 8);
      c.lineTo(jx, top + 8);
      c.closePath();
      c.fill();
      c.stroke();
      c.fillStyle = '#5aa7cf';
      c.beginPath();
      c.arc(jx + jw - 4, top + 4.5, 1.2, 0, Math.PI * 2);
      c.fill();
      break;
    }
    case 'pickles': {
      const jx = x + 9;
      const jw = 19;
      const top = b - 21;
      c.fillStyle = 'rgba(215,240,220,0.6)';
      rr(c, jx, top + 3, jw, 18, 3);
      c.fill();
      c.fillStyle = 'rgba(190,210,120,0.55)';
      c.fillRect(jx + 1, top + 7, jw - 2, 13);
      c.fillStyle = '#6f9a35';
      c.strokeStyle = '#3f5c18';
      c.lineWidth = 0.7;
      for (const [px, py, a] of [
        [jx + 5, top + 13, 0.3],
        [jx + 10, top + 12, -0.2],
        [jx + 14.5, top + 14, 0.25],
        [jx + 7.5, top + 17.5, -0.4],
        [jx + 13, top + 18, 0.5],
      ]) {
        c.beginPath();
        c.ellipse(px, py, 2.2, 4.6, a, 0, Math.PI * 2);
        c.fill();
        c.stroke();
      }
      c.fillStyle = '#e8d06a';
      c.fillRect(jx + 3, top + 9, jw - 6, 4);
      c.strokeStyle = 'rgba(60,90,70,0.8)';
      c.lineWidth = 0.9;
      rr(c, jx, top + 3, jw, 18, 3);
      c.stroke();
      c.fillStyle = '#d7b347';
      rr(c, jx + 1, top, jw - 2, 4, 1);
      c.fill();
      c.strokeStyle = '#7e6416';
      c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.6)';
      c.fillRect(jx + 2, top + 5, 1.4, 13);
      break;
    }
    case 'kettle': {
      const kw = 24;
      const kx = cx - kw / 2 - 2;
      const top = b - 17;
      // Spout.
      c.fillStyle = '#c3cacf';
      c.beginPath();
      c.moveTo(kx + 2, top + 8);
      c.lineTo(kx - 4, top + 2);
      c.lineTo(kx - 3, top + 1);
      c.lineTo(kx + 4, top + 5);
      c.closePath();
      c.fill();
      c.stroke();
      // Dome body.
      c.fillStyle = steel(c, kx, kw);
      c.beginPath();
      c.moveTo(kx, b - 2);
      c.bezierCurveTo(kx - 1, top + 2, kx + kw + 1, top + 2, kx + kw, b - 2);
      c.closePath();
      c.fill();
      c.stroke();
      c.fillStyle = '#2b2b2e';
      c.fillRect(kx - 1, b - 2.5, kw + 2, 2.5);
      // Handle on top.
      c.strokeStyle = '#222';
      c.lineWidth = 2.4;
      c.beginPath();
      c.moveTo(kx + 5, top + 4);
      c.quadraticCurveTo(kx + kw / 2, top - 9, kx + kw - 5, top + 4);
      c.stroke();
      c.fillStyle = '#222';
      c.beginPath();
      c.arc(kx + kw / 2, top + 1.5, 1.8, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.75)';
      c.beginPath();
      c.ellipse(kx + 7, top + 9, 1.6, 3.4, 0.3, 0, Math.PI * 2);
      c.fill();
      if (damage > 0) dent(c, kx + kw * 0.68, top + 10);
      break;
    }
    case 'tomatoes': {
      const cw = (w - 4) / 2;
      for (let i = 0; i < 2; i++) {
        const tx = x + 1.5 + i * (cw + 1);
        const ch = h - 3;
        const top = b - ch;
        c.fillStyle = steel(c, tx, cw);
        rr(c, tx, top, cw, ch, 2);
        c.fill();
        c.fillStyle = '#d23b2c';
        c.fillRect(tx, top + 3.5, cw, ch - 7);
        // Tomato on the label.
        c.fillStyle = '#ff5a3c';
        c.beginPath();
        c.arc(tx + cw / 2, top + ch / 2 + 0.5, 4, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#3d8a3f';
        c.beginPath();
        c.ellipse(tx + cw / 2, top + ch / 2 - 3.2, 2.4, 1, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#f0e0c0';
        c.fillRect(tx + 1, top + ch - 6.5, cw - 2, 1.6);
        c.strokeStyle = PAL.ink;
        c.lineWidth = 0.9;
        rr(c, tx, top, cw, ch, 2);
        c.stroke();
        c.fillStyle = '#d8dee1';
        c.beginPath();
        c.ellipse(tx + cw / 2, top + 0.5, cw / 2 - 0.5, 1.5, 0, 0, Math.PI * 2);
        c.fill();
        c.stroke();
      }
      if (damage > 0) {
        c.strokeStyle = 'rgba(30,30,30,0.6)';
        c.lineWidth = 1.2;
        c.beginPath();
        c.moveTo(x + 5, y + 8);
        c.quadraticCurveTo(x + 9, y + 11, x + 6, y + 15);
        c.moveTo(x + w - 9, y + 12);
        c.quadraticCurveTo(x + w - 5, y + 15, x + w - 8, y + 19);
        c.stroke();
      }
      break;
    }
    case 'crock': {
      // Wooden utensil crock with spatulas and slotted spoons.
      const ux = x + 9;
      const uw = 19;
      const top = b - 15;
      c.lineWidth = 1.8;
      c.strokeStyle = '#8d5d32';
      for (const [dx, a] of [
        [5, -0.25],
        [10, 0.05],
        [14, 0.3],
      ]) {
        c.beginPath();
        c.moveTo(ux + dx, top + 4);
        c.lineTo(ux + dx + Math.sin(a) * 14, top - 10);
        c.stroke();
      }
      c.fillStyle = '#c99a62';
      c.strokeStyle = '#6b4320';
      c.lineWidth = 0.8;
      // Spatula head.
      c.save();
      c.translate(ux + 5 - 3.5, top - 11);
      c.rotate(-0.25);
      rr(c, -3, -4, 6, 7, 1.5);
      c.fill();
      c.stroke();
      c.restore();
      // Slotted spoon (steel).
      c.fillStyle = '#c6cdd2';
      c.beginPath();
      c.ellipse(ux + 14 + 4.2, top - 12, 3, 4, 0.3, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.strokeStyle = '#59636a';
      c.beginPath();
      c.moveTo(ux + 17.5, top - 14);
      c.lineTo(ux + 18.6, top - 10.5);
      c.stroke();
      // Crock.
      const g = c.createLinearGradient(ux, 0, ux + uw, 0);
      g.addColorStop(0, '#8d5d32');
      g.addColorStop(0.35, '#d4a46c');
      g.addColorStop(1, '#7d4f28');
      c.fillStyle = g;
      c.strokeStyle = PAL.ink;
      c.lineWidth = 1;
      rr(c, ux, top, uw, 15, 2);
      c.fill();
      c.stroke();
      c.strokeStyle = 'rgba(90,55,25,0.5)';
      c.lineWidth = 0.6;
      for (const ly of [top + 4, top + 9]) {
        c.beginPath();
        c.moveTo(ux + 1, ly);
        c.quadraticCurveTo(ux + uw / 2, ly + 1.5, ux + uw - 1, ly);
        c.stroke();
      }
      if (damage > 0) cracks(c, ux, top, uw, 15, damage, 'rgba(60,30,10,0.8)');
      break;
    }
    case 'sodaStream': {
      const sx = x + 10;
      const sw = 15;
      // Clear bottle on top.
      c.fillStyle = 'rgba(215,238,248,0.7)';
      c.strokeStyle = 'rgba(70,110,140,0.8)';
      rr(c, sx + 3, b - h - 1, sw - 6, 10, 2);
      c.fill();
      c.stroke();
      c.fillStyle = '#7f8b93';
      c.fillRect(sx + 4.5, b - h - 3, sw - 9, 2.5);
      // Light-blue body.
      c.fillStyle = '#a9d4ec';
      c.strokeStyle = '#3b6177';
      rr(c, sx, b - 18, sw, 18, 3);
      c.fill();
      c.stroke();
      c.fillStyle = '#7f8b93';
      rr(c, sx - 1, b - 19, sw + 2, 4, 1.5);
      c.fill();
      c.fillStyle = '#ffffff';
      c.fillRect(sx + 3, b - 12, sw - 6, 2);
      c.fillStyle = 'rgba(255,255,255,0.5)';
      c.fillRect(sx + 1.6, b - 14, 1.4, 12);
      // Glass of fizzy water next to it.
      c.fillStyle = 'rgba(200,236,248,0.6)';
      c.fillRect(x + 1, b - 10, 7, 10);
      c.strokeStyle = 'rgba(70,120,150,0.8)';
      c.strokeRect(x + 1, b - 10, 7, 10);
      c.fillStyle = '#ffffff';
      for (const [bx2, by2] of [
        [3, 3],
        [5.5, 6],
        [3.5, 8],
      ]) {
        c.beginPath();
        c.arc(x + bx2, b - by2, 0.7, 0, Math.PI * 2);
        c.fill();
      }
      if (damage > 0) cracks(c, sx, b - 18, sw, 18, damage, 'rgba(30,60,80,0.7)');
      break;
    }
    case 'pot': {
      const pw = w - 10;
      const px = x + 5;
      const ph = h - 9;
      const top = b - ph;
      c.strokeStyle = '#3b3f42';
      c.lineWidth = 2.6;
      c.beginPath();
      c.moveTo(px - 0.5, top + 4);
      c.lineTo(px - 4, top + 4);
      c.moveTo(px + pw + 0.5, top + 4);
      c.lineTo(px + pw + 4, top + 4);
      c.stroke();
      c.fillStyle = steel(c, px, pw);
      c.strokeStyle = PAL.ink;
      c.lineWidth = 1;
      rr(c, px, top, pw, ph, 3);
      c.fill();
      c.stroke();
      const tilt = damage > 0 ? -0.18 : 0;
      c.save();
      c.translate(cx, top);
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
      if (damage > 0) dent(c, px + pw * 0.62, top + ph * 0.5);
      break;
    }
    case 'clayPot': {
      // Round terracotta lidded clay pot on a colourful bead trivet.
      const beads = ['#e8433a', '#f2b632', '#3c9a76', '#4d7fbf', '#d45aa0'];
      for (let i = 0; i < 9; i++) {
        c.fillStyle = beads[i % beads.length];
        c.beginPath();
        c.arc(x + 3 + i * ((w - 6) / 8), b - 1.6, 1.6, 0, Math.PI * 2);
        c.fill();
      }
      const top = b - 20;
      const g = c.createRadialGradient(cx - 5, top + 6, 2, cx, top + 10, 18);
      g.addColorStop(0, '#d98a5c');
      g.addColorStop(0.6, '#b0603a');
      g.addColorStop(1, '#7d3f22');
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(cx, b - 10.5, w / 2 - 2, 8, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      // Lid + knob.
      c.fillStyle = '#9c5232';
      c.beginPath();
      c.ellipse(cx, top + 2.5, w / 2 - 7, 3.2, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.fillStyle = '#7d3f22';
      c.beginPath();
      c.ellipse(cx, top - 0.5, 3, 2, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      // Little handles.
      c.fillStyle = '#9c5232';
      c.beginPath();
      c.ellipse(x + 2.5, b - 12, 2, 1.4, 0, 0, Math.PI * 2);
      c.ellipse(x + w - 2.5, b - 12, 2, 1.4, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = 'rgba(255,220,180,0.45)';
      c.lineWidth = 0.8;
      c.beginPath();
      c.ellipse(cx, b - 9, w / 2 - 5, 3, 0, 0.2, Math.PI - 0.2);
      c.stroke();
      if (damage > 0) cracks(c, x + 4, b - 18, w - 8, 15, damage, 'rgba(60,25,10,0.85)');
      break;
    }
    case 'airFryer': {
      const ax = x + 2;
      const aw = w - 4;
      const top = b - h + 1;
      const g = c.createLinearGradient(ax, 0, ax + aw, 0);
      g.addColorStop(0, '#36383c');
      g.addColorStop(0.35, '#55575c');
      g.addColorStop(1, '#2a2b2e');
      c.fillStyle = g;
      rr(c, ax, top, aw, h - 1, 6);
      c.fill();
      c.stroke();
      // Display panel.
      c.fillStyle = '#1c1d20';
      rr(c, ax + 6, top + 3, aw - 12, 5, 2);
      c.fill();
      c.fillStyle = '#ff8a3c';
      c.fillRect(ax + 10, top + 4.6, 5, 1.8);
      c.fillStyle = '#9fd0ff';
      c.fillRect(ax + aw - 14, top + 4.6, 3, 1.8);
      // Basket drawer + handle.
      c.strokeStyle = '#1c1d20';
      c.lineWidth = 0.9;
      rr(c, ax + 2.5, top + 10, aw - 5, h - 13, 3);
      c.stroke();
      c.fillStyle = '#1c1d20';
      rr(c, cx - 5, top + 13, 10, 4, 2);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.18)';
      c.fillRect(ax + 3, top + 2, 2, h - 6);
      if (damage > 0) cracks(c, ax + 2, top + 9, aw - 4, h - 11, damage, 'rgba(230,230,235,0.7)');
      break;
    }
    case 'pan': {
      for (let i = 0; i < 2; i++) {
        const py = b - 6 - i * 8;
        const rx = (w - 11) / 2;
        const pcx = x + 1 + rx + (i ? 2 : 0);
        // Copper handle like theirs.
        c.strokeStyle = '#7a3f1c';
        c.lineWidth = 3.4;
        c.beginPath();
        c.moveTo(pcx + rx - 1, py);
        c.lineTo(pcx + rx + 9, py - 2.5);
        c.stroke();
        c.strokeStyle = '#d07a42';
        c.lineWidth = 1.8;
        c.stroke();
        c.fillStyle = '#2d2a28';
        c.beginPath();
        c.ellipse(pcx, py + 1.5, rx, 4.6, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#4a4542';
        c.beginPath();
        c.ellipse(pcx, py, rx, 4.2, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#25221f';
        c.beginPath();
        c.ellipse(pcx, py + 0.4, rx - 2.4, 2.8, 0, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = 'rgba(255,255,255,0.22)';
        c.lineWidth = 1;
        c.beginPath();
        c.ellipse(pcx, py, rx - 0.6, 3.6, 0, Math.PI * 1.05, Math.PI * 1.6);
        c.stroke();
      }
      if (damage > 0) cracks(c, x + 4, b - 16, w - 14, 14, damage, 'rgba(255,190,120,0.85)');
      break;
    }
  }
  c.restore();
}

/* ------------------------------------------------------------------ ball, paddle */

/** The ball is a lemon. */
export function drawBall(c: C, x: number, y: number, r: number, spin: number, squash = 0, dir = 0) {
  c.save();
  c.translate(x, y);
  c.fillStyle = 'rgba(60,30,0,0.18)';
  c.beginPath();
  c.ellipse(1.5, 2.5, r * 1.05, r * 0.9, 0, 0, Math.PI * 2);
  c.fill();
  if (squash > 0) {
    // Squash along the travel direction right after an impact.
    c.rotate(dir);
    c.scale(1 - squash * 0.22, 1 + squash * 0.18);
    c.rotate(-dir);
  }
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

/** The paddle is their bamboo cutting board. `squash` 0..1 after a hit. */
export function drawPaddle(c: C, x: number, y: number, w: number, h: number, squash: number, tilt: number) {
  c.save();
  c.translate(x, y + h / 2);
  c.rotate(tilt);
  const sw = w * (1 + squash * 0.08);
  const sh = h * (1 - squash * 0.25);
  c.fillStyle = 'rgba(0,0,0,0.35)';
  rr(c, -sw / 2 + 2, -sh / 2 + 4, sw, sh, 4);
  c.fill();
  // Board edge (thickness).
  c.fillStyle = PAL.bambooDark;
  rr(c, -sw / 2, -sh / 2 + 2.5, sw, sh, 4);
  c.fill();
  const g = c.createLinearGradient(0, -sh / 2, 0, sh / 2);
  g.addColorStop(0, '#f6e2b4');
  g.addColorStop(1, PAL.bamboo);
  c.fillStyle = g;
  rr(c, -sw / 2, -sh / 2, sw, sh - 1.5, 4);
  c.fill();
  // Laminated bamboo strips with little nodes.
  c.strokeStyle = 'rgba(170,130,70,0.45)';
  c.lineWidth = 0.6;
  for (let i = 1; i < 4; i++) {
    const yy = -sh / 2 + (i * (sh - 1.5)) / 4;
    c.beginPath();
    c.moveTo(-sw / 2 + 3, yy);
    c.lineTo(sw / 2 - 3, yy);
    c.stroke();
  }
  c.fillStyle = 'rgba(150,110,55,0.5)';
  for (const [nx, row] of [
    [-0.32, 1],
    [-0.05, 2],
    [0.18, 0],
    [0.36, 3],
    [-0.2, 3],
  ]) {
    c.fillRect(sw * nx, -sh / 2 + row * ((sh - 1.5) / 4) + 0.6, 1.2, (sh - 1.5) / 4 - 1.2);
  }
  // Hanging hole at the right end.
  c.fillStyle = PAL.bambooDark;
  c.beginPath();
  c.ellipse(sw / 2 - 7, -0.5, 2.6, 2, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = PAL.ink;
  c.lineWidth = 1;
  rr(c, -sw / 2, -sh / 2, sw, sh + 1, 4);
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

/** What is left of a squished critter, flat on the shelf. */
export function drawSplat(c: C, x: number, y: number, roach: boolean, alpha: number) {
  c.save();
  c.globalAlpha = alpha;
  c.translate(x, y);
  c.fillStyle = roach ? 'rgba(201,163,90,0.85)' : 'rgba(184,216,106,0.8)';
  c.beginPath();
  c.ellipse(0, -1, 11, 2.6, 0, 0, Math.PI * 2);
  c.fill();
  for (const [dx, r] of [
    [-12, 1.6],
    [10, 1.3],
    [14, 1],
  ]) {
    c.beginPath();
    c.arc(dx, -1.2, r, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = roach ? '#5c2f12' : '#8a7a3a';
  c.beginPath();
  c.ellipse(0, -1.4, roach ? 7 : 9, 1.6, 0, 0, Math.PI * 2);
  c.fill();
  if (roach) {
    c.strokeStyle = '#3a1d0c';
    c.lineWidth = 0.8;
    c.beginPath();
    for (const lx of [-4, 0, 4]) {
      c.moveTo(lx, -1.4);
      c.lineTo(lx - 3, -4);
      c.moveTo(lx, -1.4);
      c.lineTo(lx + 3, -4);
    }
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

/* ------------------------------------------------------------------ pickups */

/**
 * A falling pickup, centred on (x, y), about 18×22 units. `t` drives a gentle sway; `halo` adds the
 * soft glow that marks it as something to catch.
 */
export function drawPickup(c: C, kind: 'lemon' | 'tahini' | 'coffee' | 'tabasco', x: number, y: number, t: number, halo = true) {
  c.save();
  c.translate(x, y);
  if (halo) {
    const pulse = 1 + Math.sin(t * 7) * 0.08;
    const glowCol =
      kind === 'tabasco' ? '255,90,40' : kind === 'coffee' ? '240,210,170' : kind === 'tahini' ? '235,205,150' : '255,230,90';
    const g = c.createRadialGradient(0, 0, 3, 0, 0, 17 * pulse);
    g.addColorStop(0, `rgba(${glowCol},0.55)`);
    g.addColorStop(1, `rgba(${glowCol},0)`);
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, 0, 17 * pulse, 0, Math.PI * 2);
    c.fill();
    c.rotate(Math.sin(t * 4) * 0.18);
  }
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.lineWidth = 1;
  c.strokeStyle = PAL.ink;
  switch (kind) {
    case 'lemon': {
      c.restore();
      drawBall(c, x, y, 8.5, halo ? Math.sin(t * 4) * 0.4 - 0.3 : -0.3);
      if (halo) {
        // "+" badge so an extra-lemon pickup never looks like a lemon in play.
        c.save();
        c.fillStyle = '#3c9a3a';
        c.strokeStyle = '#ffffff';
        c.lineWidth = 1.2;
        c.beginPath();
        c.arc(x + 8, y - 7, 4.6, 0, Math.PI * 2);
        c.fill();
        c.stroke();
        c.lineWidth = 1.6;
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(x + 8, y - 9.4);
        c.lineTo(x + 8, y - 4.6);
        c.moveTo(x + 5.6, y - 7);
        c.lineTo(x + 10.4, y - 7);
        c.stroke();
        c.restore();
      }
      return;
    }
    case 'tahini': {
      // Squat glass jar of tahini with a red lid and a sesame label.
      c.fillStyle = '#d9b27c';
      c.beginPath();
      c.roundRect(-8, -6, 16, 15, 3);
      c.fill();
      c.fillStyle = 'rgba(255,240,210,0.5)';
      c.fillRect(-6.5, -4.5, 2, 11);
      c.fillStyle = '#f7efdc';
      c.beginPath();
      c.roundRect(-6, -2, 12, 7, 1.5);
      c.fill();
      c.fillStyle = '#2d6aa6';
      c.fillRect(-6, -2, 12, 2);
      c.fillStyle = '#8a6a3a';
      for (const [sx, sy, a] of [
        [-3, 2.6, 0.4],
        [0, 1.8, -0.3],
        [3, 2.8, 0.2],
        [-1.4, 3.8, -0.5],
        [1.8, 4, 0.6],
      ]) {
        c.beginPath();
        c.ellipse(sx, sy, 0.7, 1.1, a, 0, Math.PI * 2);
        c.fill();
      }
      c.strokeStyle = 'rgba(80,60,30,0.9)';
      c.beginPath();
      c.roundRect(-8, -6, 16, 15, 3);
      c.stroke();
      c.fillStyle = '#c8352e';
      c.strokeStyle = PAL.ink;
      c.beginPath();
      c.roundRect(-8.5, -10.5, 17, 5, 1.5);
      c.fill();
      c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.3)';
      c.fillRect(-7, -9.5, 14, 1);
      // A drip of tahini down the side.
      c.fillStyle = '#d9b27c';
      c.beginPath();
      c.ellipse(6.5, -4, 1.4, 2.6, 0, 0, Math.PI * 2);
      c.fill();
      break;
    }
    case 'coffee': {
      // Takeaway cup with sleeve, lid and steam.
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.moveTo(-7, -6);
      c.lineTo(7, -6);
      c.lineTo(5.2, 11);
      c.lineTo(-5.2, 11);
      c.closePath();
      c.fill();
      c.stroke();
      c.fillStyle = '#b8895a';
      c.beginPath();
      c.moveTo(-6.4, -1);
      c.lineTo(6.4, -1);
      c.lineTo(5.8, 6);
      c.lineTo(-5.8, 6);
      c.closePath();
      c.fill();
      c.stroke();
      c.fillStyle = '#5a3420';
      c.beginPath();
      c.ellipse(0, 2.5, 2.2, 1.6, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#3a2a22';
      c.beginPath();
      c.roundRect(-8, -9.5, 16, 4, 1.5);
      c.fill();
      c.fillRect(-5, -11, 10, 2);
      // Steam.
      c.strokeStyle = 'rgba(255,255,255,0.85)';
      c.lineWidth = 1.2;
      for (const sx of [-2.5, 2]) {
        c.beginPath();
        c.moveTo(sx, -12);
        c.bezierCurveTo(sx - 2.5, -14.5, sx + 2.5, -16, sx, -19 - Math.sin(t * 5 + sx) * 0.8);
        c.stroke();
      }
      break;
    }
    case 'tabasco': {
      // Small hot-sauce bottle: red sauce, red cap, green neck band, pale diamond label.
      c.fillStyle = '#c4161c';
      c.beginPath();
      c.moveTo(-2.4, -6);
      c.lineTo(2.4, -6);
      c.quadraticCurveTo(6.5, -3, 6.5, 2);
      c.lineTo(6.5, 10);
      c.quadraticCurveTo(6.5, 12, 4.5, 12);
      c.lineTo(-4.5, 12);
      c.quadraticCurveTo(-6.5, 12, -6.5, 10);
      c.lineTo(-6.5, 2);
      c.quadraticCurveTo(-6.5, -3, -2.4, -6);
      c.closePath();
      c.fill();
      c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.fillRect(-5, 0, 1.6, 9);
      // Diamond label.
      c.fillStyle = '#f6ecd2';
      c.beginPath();
      c.moveTo(0, -1);
      c.lineTo(5, 4.5);
      c.lineTo(0, 10);
      c.lineTo(-5, 4.5);
      c.closePath();
      c.fill();
      c.fillStyle = '#c4161c';
      c.beginPath();
      c.ellipse(0, 4.5, 1.6, 2.4, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#3c7a2e';
      c.fillRect(-2.6, -8.5, 5.2, 3);
      // Neck + cap.
      c.fillStyle = '#c4161c';
      c.strokeStyle = PAL.ink;
      c.beginPath();
      c.roundRect(-2, -13, 4, 5, 1);
      c.fill();
      c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.5)';
      c.fillRect(-1.2, -12.2, 0.9, 3);
      break;
    }
  }
  c.restore();
}
