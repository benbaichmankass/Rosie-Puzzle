/**
 * Draws the house map in the strict 4-shade Game Boy palette onto canvases.
 * The static map is painted once into an offscreen canvas; sprites and a few animated bits
 * (pool shimmer, bunnies, spot arrows, tree canopy) are drawn every frame by HouseMap.
 */
import { GB } from '../shared/characters';
import {
  COLS, ROWS, TILE, GRID, PROPS, ROOM_AT, isWall, type Kind, type Prop, type Dir,
} from './layout';
import { BENTZI, ROSIE, BUNNY, TURTLE, ARROW, ARROW_SOON, type Frame } from './sprites';

export const SHADES = [GB.darkest, GB.dark, GB.light, GB.lightest] as const;
type S = 0 | 1 | 2 | 3;

/** Deterministic per-position noise in [0, 1). */
export function hash(x: number, y: number, salt = 0): number {
  let h = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export class Painter {
  constructor(public ctx: CanvasRenderingContext2D) {}
  rect(x: number, y: number, w: number, h: number, s: S) {
    this.ctx.fillStyle = SHADES[s];
    this.ctx.fillRect(x, y, w, h);
  }
  px(x: number, y: number, s: S) { this.rect(x, y, 1, 1, s); }
  hline(x: number, y: number, w: number, s: S) { this.rect(x, y, w, 1, s); }
  vline(x: number, y: number, h: number, s: S) { this.rect(x, y, 1, h, s); }
  /** Outlined box: border shade b, fill f. */
  box(x: number, y: number, w: number, h: number, b: S, f: S) {
    this.rect(x, y, w, h, b);
    this.rect(x + 1, y + 1, w - 2, h - 2, f);
  }
  bmp(x: number, y: number, rows: string[], flip = false) {
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      for (let c = 0; c < row.length; c++) {
        const ch = row[flip ? row.length - 1 - c : c];
        if (ch >= '0' && ch <= '3') this.px(x + c, y + r, Number(ch) as S);
      }
    }
  }
}

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// ---------------------------------------------------------------- floors

function floor(p: Painter, k: Kind, tx: number, ty: number) {
  const X = tx * TILE, Y = ty * TILE;
  const n = (x: number, y: number, salt = 0) => hash(tx * TILE + x, ty * TILE + y, salt);
  switch (k) {
    case 'grass': {
      // neighbours' gardens outside the house: darker, so the house reads clearly
      p.rect(X, Y, TILE, TILE, 1);
      for (let i = 0; i < 4; i++) {
        if (hash(tx, ty, i) < 0.6) {
          const x = X + 1 + Math.floor(hash(tx, ty, i + 10) * 12), y = Y + 2 + Math.floor(hash(tx, ty, i + 20) * 12);
          p.px(x, y, 0); p.px(x + 2, y, 0); p.px(x + 1, y + 1, 0); p.px(x + 1, y - 1, 2);
        }
      }
      if (hash(tx, ty, 7) < 0.07) { // bush
        const x = X + 8, y = Y + 8;
        p.rect(x - 5, y - 4, 10, 8, 0); p.rect(x - 4, y - 5, 8, 10, 0);
        p.rect(x - 4, y - 4, 8, 7, 2); p.rect(x - 3, y - 3, 3, 2, 3); p.px(x + 2, y + 1, 1); p.px(x - 1, y + 2, 1);
      } else if (hash(tx, ty, 8) < 0.06) { // flower
        const x = X + 6, y = Y + 6;
        p.px(x, y - 1, 3); p.px(x - 1, y, 3); p.px(x + 1, y, 3); p.px(x, y + 1, 3); p.px(x, y, 0);
      }
      break;
    }
    case 'walk': {
      p.rect(X, Y, TILE, TILE, 3);
      p.hline(X, Y + 7, TILE, 2);
      p.hline(X, Y + 15, TILE, 2);
      p.vline(X + (ty % 2 ? 4 : 11), Y, 7, 2);
      p.vline(X + (ty % 2 ? 11 : 4), Y + 8, 7, 2);
      break;
    }
    case 'rail': {
      p.rect(X, Y, TILE, TILE, 2);
      for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) if (n(x, y) < 0.12) p.px(X + x, Y + y, 1);
      for (let y = 1; y < TILE; y += 4) p.rect(X + 1, Y + y, 14, 2, 1); // sleepers
      p.vline(X + 3, Y, TILE, 0); p.vline(X + 4, Y, TILE, 3);
      p.vline(X + 11, Y, TILE, 0); p.vline(X + 12, Y, TILE, 3);
      break;
    }
    case 'dirt': {
      p.rect(X, Y, TILE, TILE, 2);
      for (let y = 0; y < TILE; y++)
        for (let x = 0; x < TILE; x++) {
          const v = n(x, y);
          if (v < 0.018) p.px(X + x, Y + y, 1);
          else if (v > 0.965) p.px(X + x, Y + y, 3);
        }
      const f = hash(tx, ty, 3);
      if (f < 0.28) { // dry leaf
        const x = X + 2 + Math.floor(hash(tx, ty, 4) * 9), y = Y + 2 + Math.floor(hash(tx, ty, 5) * 10);
        if (hash(tx, ty, 6) < 0.5) {
          p.hline(x + 1, y, 2, 1); p.hline(x, y + 1, 4, 1); p.hline(x + 1, y + 2, 2, 1); p.px(x + 4, y + 2, 0); p.hline(x + 1, y + 1, 2, 3);
        } else {
          p.vline(x, y + 1, 2, 1); p.vline(x + 1, y, 4, 1); p.vline(x + 2, y + 1, 2, 1); p.px(x + 1, y + 4, 0); p.vline(x + 1, y + 1, 2, 3);
        }
      } else if (f < 0.4) { // gravel
        const x = X + 3 + Math.floor(hash(tx, ty, 8) * 9), y = Y + 3 + Math.floor(hash(tx, ty, 9) * 9);
        p.rect(x, y, 2, 2, 1); p.px(x, y, 3); p.px(x + 3, y + 1, 1); p.px(x + 1, y + 3, 0);
      }
      break;
    }
    case 'wood': {
      p.rect(X, Y, TILE, TILE, 3);
      for (let r = 0; r < 4; r++) {
        const y = Y + r * 4;
        p.hline(X, y + 3, TILE, 2);
        const j = (((tx * 7 + ty * 3 + r * 5) % 4) + 4) % 4;
        p.vline(X + j * 4 + 1, y, 3, 2);
        if (hash(tx, ty, r + 30) < 0.4) p.hline(X + Math.floor(hash(tx, ty, r + 40) * 10) + 3, y + 1, 3, 2);
      }
      break;
    }
    case 'carpet': {
      p.rect(X, Y, TILE, TILE, 2);
      for (let y = 0; y < TILE; y++)
        for (let x = 0; x < TILE; x++) if ((x + 2 * y) % 4 === 0 && (y % 2 === 0)) p.px(X + x, Y + y, 3);
      break;
    }
    case 'ktile': {
      for (let y = 0; y < 2; y++)
        for (let x = 0; x < 2; x++) {
          const dark = (tx * 2 + x + ty * 2 + y) % 2 === 0;
          p.rect(X + x * 8, Y + y * 8, 8, 8, dark ? 2 : 3);
          if (!dark) p.px(X + x * 8 + 1, Y + y * 8 + 1, 3);
        }
      break;
    }
    case 'btile': {
      p.rect(X, Y, TILE, TILE, 3);
      for (let i = 0; i < 4; i++) { p.hline(X, Y + i * 4 + 3, TILE, 2); p.vline(X + i * 4 + 3, Y, TILE, 2); }
      break;
    }
    default:
      p.rect(X, Y, TILE, TILE, 3);
  }
}

const isIndoor = (x: number, y: number) => {
  const r = ROOM_AT[y]?.[x];
  return !!r && r !== 'yard';
};
/** A wall is a house wall when it touches indoor floor, otherwise a yard (stucco) wall. */
function houseWall(tx: number, ty: number) {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (isIndoor(tx + dx, ty + dy)) return true;
  return false;
}
function floorUnder(tx: number, ty: number): Kind {
  // the floor a door or window tile sits on: the room on the far side
  for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
    const k = GRID[ty + dy]?.[tx + dx];
    if (k && ROOM_AT[ty + dy][tx + dx] && k !== 'door') return k;
  }
  return 'wood';
}

/** Walls in 3/4 view: a top cap, plus a face where open floor is below. */
function wall(p: Painter, tx: number, ty: number) {
  const X = tx * TILE, Y = ty * TILE;
  const house = houseWall(tx, ty);
  const top: S = house ? 0 : 1;
  p.rect(X, Y, TILE, TILE, top);
  if (house) {
    // subtle brick texture on the cap
    for (let y = 2; y < TILE; y += 4) p.hline(X + ((y >> 2) % 2 ? 2 : 6), Y + y, 4, 1);
  } else {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) if (hash(X + x, Y + y, 2) < 0.1) p.px(X + x, Y + y, 2);
  }
  const W = (x: number, y: number) => isWall(x, y);
  // light rim along open edges of the cap
  const rim: S = house ? 1 : 2;
  if (!W(tx, ty - 1)) p.hline(X, Y, TILE, rim);
  if (!W(tx - 1, ty)) p.vline(X, Y, TILE, rim);
  if (!W(tx + 1, ty)) p.vline(X + TILE - 1, Y, TILE, rim);
  if (!W(tx, ty + 1)) {
    // face
    const fy = Y + 8;
    if (isIndoor(tx, ty + 1)) {
      p.rect(X, fy, TILE, 8, 3);
      p.hline(X, fy, TILE, 0);
      p.hline(X, fy + 6, TILE, 1);
      p.hline(X, fy + 7, TILE, 0);
    } else {
      p.rect(X, fy, TILE, 8, 2);
      for (let y = 1; y < 7; y++) for (let x = 0; x < TILE; x++) if (hash(X + x, fy + y, 5) < 0.18) p.px(X + x, fy + y, 3);
      p.hline(X, fy, TILE, 0);
      p.hline(X, fy + 7, TILE, 1);
    }
  }
}

function door(p: Painter, tx: number, ty: number) {
  const X = tx * TILE, Y = ty * TILE;
  floor(p, floorUnder(tx, ty), tx, ty);
  const vertical = isWall(tx, ty - 1) || isWall(tx, ty + 1) || GRID[ty - 1]?.[tx] === 'door';
  if (vertical) {
    // doorway in a left/right wall: threshold strip and frame
    p.rect(X + 4, Y, 8, TILE, 1);
    p.rect(X + 5, Y, 6, TILE, 2);
    for (let y = 1; y < TILE; y += 3) p.hline(X + 5, Y + y, 6, 1);
    if (isWall(tx, ty - 1)) p.rect(X + 2, Y, 12, 2, 0);
    if (isWall(tx, ty + 1)) p.rect(X + 2, Y + 14, 12, 2, 0);
  } else {
    p.rect(X, Y + 4, TILE, 8, 1);
    p.rect(X, Y + 5, TILE, 6, 2);
    for (let x = 1; x < TILE; x += 3) p.vline(X + x, Y + 5, 6, 1);
    p.rect(X, Y, 2, TILE, 0);
    p.rect(X + 14, Y, 2, TILE, 0);
  }
}

function windowTile(p: Painter, tx: number, ty: number, ac: boolean) {
  const X = tx * TILE, Y = ty * TILE;
  wall(p, tx, ty);
  const vertical = isWall(tx, ty - 1) || isWall(tx, ty + 1);
  if (vertical) {
    p.rect(X + 4, Y, 8, TILE, 0);
    p.rect(X + 5, Y + (isWall(tx, ty - 1) && GRID[ty - 1][tx] !== 'window' ? 1 : 0), 6, TILE - 1, 3);
    p.vline(X + 7, Y, TILE, 0); // mullion
    p.px(X + 5, Y + 3, 2); p.px(X + 6, Y + 4, 2); p.px(X + 9, Y + 9, 2); p.px(X + 10, Y + 10, 2);
    if (ac) {
      // AC box hanging on the yard side of the wall
      p.box(X - 7, Y + 1, 9, 12, 0, 2);
      for (let y = 3; y < 12; y += 2) p.hline(X - 5, Y + y, 5, 1);
      p.px(X - 6, Y + 13, 1); p.px(X - 6, Y + 14, 1); // drip pipe
    }
  } else {
    p.rect(X + 1, Y + 3, 14, 10, 0);
    p.rect(X + 2, Y + 4, 12, 8, 3);
    p.hline(X + 2, Y + 8, 12, 0);
    p.px(X + 3, Y + 5, 2); p.px(X + 4, Y + 6, 2); p.px(X + 10, Y + 9, 2);
  }
}

function streetDoor(p: Painter, tx: number, ty: number) {
  const X = tx * TILE, Y = ty * TILE;
  wall(p, tx, ty);
  const topHalf = GRID[ty + 1]?.[tx] === 'streetdoor';
  // a heavy wooden gate seen edge-on in the left wall, swinging into the yard
  p.rect(X + 3, Y, 10, TILE, 0);
  p.rect(X + 4, Y + (topHalf ? 1 : 0), 8, topHalf ? 15 : 15, 1);
  for (let y = topHalf ? 3 : 1; y < TILE; y += 3) p.hline(X + 5, Y + y, 6, 0);
  if (!topHalf) { p.rect(X + 9, Y + 2, 2, 2, 3); p.hline(X + 4, Y + 15, 8, 0); }
  else p.hline(X + 4, Y, 8, 0);
}

// ---------------------------------------------------------------- props

function prop(p: Painter, o: Prop) {
  const X = o.x * TILE, Y = o.y * TILE, W = o.w * TILE, H = o.h * TILE;
  switch (o.kind) {
    case 'streettree': {
      // ficus on the boulevard sidewalk
      p.rect(X + 6, Y + 9, 4, 6, 0);
      p.rect(X + 7, Y + 9, 1, 6, 1);
      p.box(X + 1, Y - 6, 14, 15, 0, 1);
      for (let i = 0; i < 18; i++) p.px(X + 2 + Math.floor(hash(o.y, i, 1) * 12), Y - 5 + Math.floor(hash(o.y, i, 2) * 13), i % 3 ? 2 : 0);
      p.rect(X + 3, Y - 4, 4, 2, 2);
      break;
    }
    case 'tree': break; // trunk + colander here, canopy drawn on top of the sprites
    case 'pallets': {
      for (let i = 0; i < 3; i++) {
        const x = X + i * 16;
        p.box(x + 1, Y + 3, 14, 12, 0, 2);
        for (let y = 5; y < 14; y += 3) p.hline(x + 2, Y + y, 12, 1);
        // herbs growing out of the planter
        for (let k = 0; k < 5; k++) {
          const lx = x + 2 + k * 3, h = 3 + Math.floor(hash(i, k, 3) * 4);
          p.vline(lx, Y + 3 - h, h, 1);
          p.px(lx - 1, Y + 3 - h, 0); p.px(lx + 1, Y + 4 - h, 0); p.px(lx, Y + 3 - h - 1, 3);
        }
      }
      break;
    }
    case 'herbs': {
      p.rect(X + 4, Y + 9, 8, 6, 0);
      p.rect(X + 5, Y + 10, 6, 4, 1);
      p.hline(X + 3, Y + 9, 10, 0);
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI;
        const lx = X + 8 + Math.round(Math.cos(a) * 6), ly = Y + 8 - Math.round(Math.sin(a) * 6);
        p.rect(lx - 1, ly - 1, 3, 2, 1); p.px(lx, ly - 1, 3);
      }
      p.rect(X + 6, Y + 4, 4, 5, 1); p.px(X + 7, Y + 5, 3);
      break;
    }
    case 'spool': {
      // big wooden cable-spool table, seen from above
      const cx = X + W / 2, cy = Y + H / 2;
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const d = Math.hypot(x + 0.5 - W / 2, y + 0.5 - H / 2);
          if (d < 14) p.px(X + x, Y + y, d > 12.6 ? 0 : d > 11 ? 1 : (Math.floor(d) % 4 === 0 ? 2 : 3));
        }
      p.rect(cx - 3, cy - 3, 6, 6, 0); p.rect(cx - 2, cy - 2, 4, 4, 1);
      // a mug and the watering can spout on the table
      p.box(cx + 5, cy - 8, 4, 4, 0, 3);
      break;
    }
    case 'reel': {
      p.rect(X + 2, Y + 2, 12, 12, 0);
      p.rect(X + 3, Y + 3, 10, 10, 1);
      for (let r = 0; r < 3; r++) p.box(X + 4 + r, Y + 4 + r, 8 - 2 * r, 8 - 2 * r, 0, 1);
      p.px(X + 7, Y + 7, 3);
      break;
    }
    case 'gardenbed': {
      p.rect(X, Y, W, H, 1);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (hash(X + x, Y + y, 9) < 0.12) p.px(X + x, Y + y, 0);
      // leafy plants
      for (let i = 0; i < 9; i++) {
        const py = Y + 8 + i * 16, px = X + 5 + (i % 2) * 3;
        if (i === 1 || i === 7) continue; // gaps where the bunnies sit
        for (const [dx, dy] of [[0, -4], [-3, -1], [3, -1], [-2, 2], [2, 2], [0, 0]]) {
          p.rect(px + dx - 1, py + dy - 1, 3, 3, 0);
        }
        for (const [dx, dy] of [[0, -4], [-3, -1], [3, -1], [-2, 2], [2, 2], [0, 0]]) {
          p.px(px + dx, py + dy, 3); p.px(px + dx + (dx > 0 ? -1 : 1), py + dy, 2);
        }
      }
      // low green wire fence
      for (let y = Y; y < Y + H; y++) {
        p.px(X + 14, y, y % 2 ? 0 : 1);
        if (y % 4 === 0) { p.px(X + 13, y, 0); p.px(X + 15, y, 0); }
      }
      for (let y = Y + 4; y < Y + H; y += 24) p.rect(X + 13, y, 3, 3, 0);
      break;
    }
    case 'can': {
      // green watering can
      p.box(X + 3, Y + 6, 8, 8, 0, 1);
      p.hline(X + 4, Y + 7, 6, 2);
      p.rect(X + 4, Y + 3, 6, 1, 0); p.px(X + 3, Y + 4, 0); p.px(X + 10, Y + 4, 0); p.px(X + 3, Y + 5, 0); p.px(X + 10, Y + 5, 0);
      for (let i = 0; i < 4; i++) p.px(X + 11 + i, Y + 9 - i, 0);
      p.rect(X + 14, Y + 4, 2, 2, 0);
      break;
    }
    case 'pool':
      break; // animated, drawn each frame
    case 'rug': {
      p.box(X + 2, Y + 2, W - 4, H - 4, 0, 2);
      p.box(X + 4, Y + 4, W - 8, H - 8, 1, 2);
      for (let y = Y + 6; y < Y + H - 6; y++)
        for (let x = X + 6; x < X + W - 6; x++) if ((x + y) % 6 === 0) p.px(x, y, 3);
      for (let x = X + 3; x < X + W - 3; x += 2) { p.px(x, Y + 1, 1); p.px(x, Y + H - 2, 1); }
      break;
    }
    case 'shelf': {
      // wall shelf with books (against the top wall)
      p.box(X, Y - 6, W, 14, 0, 1);
      p.hline(X + 1, Y + 1, W - 2, 0);
      let x = X + 2;
      let i = 0;
      while (x < X + W - 3) {
        const w = 2 + Math.floor(hash(i, 1, 4) * 2), h = 4 + Math.floor(hash(i, 2, 4) * 3);
        p.rect(x, Y + 1 - h, w, h, i % 3 === 0 ? 3 : i % 3 === 1 ? 2 : 0);
        x += w + (i % 4 === 3 ? 2 : 0);
        i++;
      }
      // shadow on the floor
      p.hline(X + 1, Y + 8, W - 2, 2);
      break;
    }
    case 'lamp': {
      p.rect(X + 7, Y - 4, 2, 6, 0);
      p.box(X + 4, Y + 1, 8, 5, 0, 3);
      p.hline(X + 5, Y + 2, 6, 3);
      p.px(X + 7, Y + 7, 2); p.px(X + 6, Y + 8, 2); p.px(X + 9, Y + 8, 2);
      break;
    }
    case 'sofaV': {
      // dark grey L-sofa, the long side against the right wall
      p.box(X, Y, W, H, 0, 1);
      p.rect(X + 9, Y + 1, 6, H - 2, 0); // backrest
      p.rect(X + 10, Y + 2, 4, H - 4, 1);
      for (let y = Y + 16; y < Y + H - 4; y += 16) p.hline(X + 2, y, 7, 0); // seat seams
      // cushions
      p.box(X + 3, Y + 4, 6, 9, 0, 2);
      p.box(X + 3, Y + 30, 6, 9, 0, 2);
      p.hline(X + 4, Y + 6, 4, 3); p.hline(X + 4, Y + 32, 4, 3);
      break;
    }
    case 'sofaH': {
      p.box(X, Y, W, H, 0, 1);
      p.rect(X + 1, Y + 9, W - 2, 6, 0); // backrest toward the bottom
      p.rect(X + 2, Y + 10, W - 4, 4, 1);
      p.rect(X, Y, 5, H, 0); p.rect(X + 1, Y + 1, 3, H - 2, 1); // arm
      for (let x = X + 18; x < X + W - 2; x += 16) p.vline(x, Y + 2, 7, 0);
      // Rosie's favourite blanket
      p.box(X + 22, Y + 2, 14, 7, 0, 3);
      for (let x = X + 24; x < X + 35; x += 3) p.vline(x, Y + 3, 5, 2);
      break;
    }
    case 'coffee': {
      // glass coffee table
      p.box(X + 1, Y + 2, W - 2, H - 4, 0, 3);
      p.box(X + 2, Y + 3, W - 4, H - 6, 2, 3);
      for (let i = 0; i < 6; i++) { p.px(X + 5 + i, Y + 6 + i, 2); p.px(X + 9 + i, Y + 6 + i, 2); }
      // a mug and a book
      p.box(X + 20, Y + 7, 5, 5, 0, 2);
      p.box(X + 6, Y + 18, 9, 6, 0, 1);
      p.vline(X + 10, Y + 18, 6, 0);
      break;
    }
    case 'plant': {
      p.rect(X + 4, Y + 9, 8, 6, 0); p.rect(X + 5, Y + 10, 6, 4, 2);
      for (const [dx, dy] of [[0, 0], [-4, 2], [4, 2], [-3, -3], [3, -3], [0, -5]]) {
        p.rect(X + 7 + dx - 1, Y + 6 + dy - 1, 4, 3, 0);
        p.rect(X + 7 + dx, Y + 6 + dy, 2, 1, 1);
      }
      break;
    }
    case 'roomba': {
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          const d = Math.hypot(x - 7.5, y - 8);
          if (d < 7) p.px(X + x, Y + y, d > 6 ? 0 : d > 4.2 ? 1 : 2);
        }
      p.rect(X + 6, Y + 5, 4, 2, 0); p.px(X + 7, Y + 5, 3); // button
      p.rect(X + 5, Y + 9, 6, 1, 3);
      // dock behind it, against the wall
      p.rect(X + 13, Y + 3, 3, 10, 0); p.px(X + 14, Y + 5, 3);
      break;
    }
    case 'bedrug': {
      p.box(X + 1, Y + 2, W - 2, H - 4, 0, 3);
      for (let y = Y + 4; y < Y + H - 4; y += 4) for (let x = X + 3; x < X + W - 3; x += 4) p.rect(x, y, 2, 2, 2);
      for (let y = Y + 3; y < Y + H - 3; y += 2) { p.px(X, y, 1); p.px(X + W - 1, y, 1); }
      break;
    }
    case 'bed': {
      // double bed, headboard against the top wall, two pillows, rumpled duvet
      p.box(X, Y - 4, W, 8, 0, 1); // headboard
      p.box(X, Y + 2, W, H - 2, 0, 3);
      p.box(X + 3, Y + 4, 11, 7, 0, 3); p.box(X + 18, Y + 4, 11, 7, 0, 3);
      p.hline(X + 5, Y + 9, 7, 2); p.hline(X + 20, Y + 9, 7, 2);
      p.rect(X + 1, Y + 14, W - 2, H - 15, 2); // duvet
      p.hline(X + 1, Y + 14, W - 2, 0);
      for (let y = Y + 18; y < Y + H - 2; y += 6) for (let x = X + 3 + ((y >> 1) % 2) * 3; x < X + W - 3; x += 6) p.rect(x, y, 2, 2, 3);
      p.hline(X + 1, Y + H - 4, W - 2, 1);
      // a small curled dog shape (Rosie's spot) as a darker dent at the foot
      p.rect(X + 20, Y + 30, 8, 1, 1);
      break;
    }
    case 'nightstand': {
      p.box(X + 2, Y - 2, 12, 14, 0, 1);
      p.hline(X + 3, Y + 4, 10, 0);
      p.px(X + 8, Y + 7, 3);
      p.box(X + 4, Y - 1, 4, 4, 0, 3); // little lamp / phone
      break;
    }
    case 'wardrobe': {
      p.box(X, Y - 8, W, H + 6, 0, 2);
      p.vline(X + W / 2, Y - 7, H + 4, 0);
      p.rect(X + W / 2 - 3, Y + 6, 2, 4, 0); p.rect(X + W / 2 + 2, Y + 6, 2, 4, 0);
      p.hline(X + 1, Y - 7, W - 2, 3);
      for (let y = Y - 4; y < Y + H - 4; y += 8) { p.hline(X + 3, y, 10, 1); p.hline(X + 19, y, 10, 1); }
      break;
    }
    case 'fridge': {
      p.box(X, Y - 6, W, H + 5, 0, 3);
      p.hline(X + 1, Y + 8, W - 2, 0);
      p.rect(X + 12, Y - 2, 2, 6, 0); p.rect(X + 12, Y + 12, 2, 8, 0);
      p.rect(X + 3, Y + 14, 4, 3, 2); // magnet
      p.rect(X + 2, Y - 4, 6, 1, 2);
      break;
    }
    case 'counterTop': {
      // upper and lower cabinets along the top wall
      p.rect(X, Y - 8, W, 7, 0);
      for (let x = X; x < X + W; x += 16) { p.box(x, Y - 8, 16, 7, 0, 2); p.rect(x + 7, Y - 4, 2, 1, 0); }
      p.rect(X, Y, W, H, 0);
      p.rect(X, Y + 1, W, 4, 3); // worktop
      p.hline(X, Y + 5, W, 0);
      for (let x = X; x < X + W; x += 16) {
        p.rect(x + 1, Y + 6, 14, 9, 1);
        p.vline(x + 8, Y + 6, 9, 0);
        p.px(x + 6, Y + 9, 3); p.px(x + 10, Y + 9, 3);
      }
      // jars and a dish stack on the worktop
      p.box(X + 3, Y - 2, 4, 5, 0, 2); p.box(X + 8, Y - 1, 4, 4, 0, 3);
      p.box(X + 34, Y - 1, 8, 3, 0, 3); p.hline(X + 35, Y - 3, 6, 0); p.hline(X + 35, Y - 2, 6, 3);
      p.box(X + 126, Y - 3, 5, 6, 0, 1);
      break;
    }
    case 'stove': {
      p.rect(X, Y + 1, W, 4, 1);
      for (const cx of [X + 7, X + 23]) {
        p.box(cx - 4, Y + 1, 9, 4, 0, 1);
        p.hline(cx - 2, Y + 2, 5, 3);
      }
      // pot on the left burner
      p.box(X + 3, Y - 5, 9, 7, 0, 1); p.hline(X + 4, Y - 4, 7, 2); p.px(X + 2, Y - 2, 0); p.px(X + 12, Y - 2, 0);
      p.rect(X + 6, Y + 8, 20, 6, 0); p.rect(X + 7, Y + 9, 18, 4, 2); // oven door
      p.hline(X + 9, Y + 7, 14, 0);
      break;
    }
    case 'sink': {
      p.box(X + 3, Y, 26, 6, 0, 2);
      p.rect(X + 5, Y + 1, 22, 4, 1);
      p.rect(X + 15, Y - 4, 2, 4, 0); p.rect(X + 15, Y - 4, 5, 1, 0);
      p.px(X + 19, Y + 2, 3);
      break;
    }
    case 'counterLow': {
      // counter against the bottom wall: worktop toward us
      p.rect(X, Y, W, H, 0);
      p.rect(X, Y + 1, W, 7, 3);
      p.hline(X, Y + 8, W, 0);
      for (let x = X; x < X + W; x += 16) { p.rect(x + 1, Y + 9, 14, 7, 1); p.vline(x + 8, Y + 9, 7, 0); }
      break;
    }
    case 'urn': {
      // coffee urn for Shabbos
      p.box(X + 3, Y - 6, 10, 13, 0, 3);
      p.hline(X + 4, Y - 4, 8, 2); p.hline(X + 4, Y + 2, 8, 2);
      p.rect(X + 6, Y - 8, 4, 2, 0);
      p.rect(X + 13, Y + 1, 2, 2, 0); // tap
      p.px(X + 5, Y - 2, 1);
      break;
    }
    case 'plata': {
      // hot plate with a pot and a challah
      p.box(X + 1, Y + 1, W - 2, 7, 0, 1);
      p.hline(X + 3, Y + 3, W - 6, 2);
      p.box(X + 4, Y - 6, 10, 9, 0, 2); p.hline(X + 5, Y - 5, 8, 3); p.px(X + 3, Y - 3, 0); p.px(X + 14, Y - 3, 0);
      // challah: braided loaf
      p.box(X + 17, Y - 3, 12, 6, 0, 2);
      for (let x = X + 19; x < X + 28; x += 3) { p.px(x, Y - 2, 3); p.px(x + 1, Y - 1, 1); p.px(x, Y, 3); }
      break;
    }
    case 'mat': {
      p.box(X + 2, Y + 3, W - 4, H - 6, 0, 2);
      for (let y = Y + 5; y < Y + H - 5; y += 2) p.hline(X + 4, y, W - 8, y % 4 === 1 ? 3 : 2);
      break;
    }
    case 'toilet': {
      p.box(X + 3, Y - 6, 10, 7, 0, 3); // tank
      p.hline(X + 4, Y - 4, 8, 2);
      for (let y = 0; y < 12; y++)
        for (let x = 0; x < 12; x++) {
          const d = Math.hypot((x - 5.5) / 6, (y - 5) / 6.5);
          if (d < 1) p.px(X + 2 + x, Y + 1 + y, d > 0.82 ? 0 : d > 0.55 ? 3 : 2);
        }
      break;
    }
    case 'basin': {
      // sink with the shelf cabinet underneath
      p.box(X + 1, Y - 4, W - 2, 16, 0, 2);
      p.hline(X + 2, Y + 4, W - 4, 0);
      p.box(X + 6, Y - 3, 20, 7, 0, 3); p.rect(X + 9, Y - 2, 14, 4, 2);
      p.rect(X + 15, Y - 6, 2, 3, 0);
      p.px(X + 14, Y + 8, 3); p.px(X + 17, Y + 8, 3);
      // toothbrush and trimmer on the edge
      p.vline(X + 3, Y - 3, 5, 3); p.px(X + 3, Y - 4, 1);
      p.rect(X + 28, Y - 3, 2, 5, 0);
      break;
    }
    case 'shower': {
      // glass shower corner with a drain
      p.rect(X, Y, W, H, 3);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x + y) % 8 === 0) p.px(X + x, Y + y, 2);
      p.vline(X, Y, H, 0); p.hline(X, Y + H - 1, W, 0);
      p.vline(X + 1, Y, H - 1, 2); p.hline(X + 1, Y + H - 2, W - 1, 2);
      p.box(X + 21, Y + 21, 7, 7, 0, 1); p.hline(X + 22, Y + 24, 5, 0); // drain
      p.rect(X + W - 6, Y - 6, 3, 8, 0); p.box(X + W - 10, Y + 2, 8, 4, 0, 2); // head
      // falling drops
      for (let i = 0; i < 10; i++) p.vline(X + 22 + Math.floor(hash(i, 0, 11) * 20), Y + 8 + Math.floor(hash(i, 1, 11) * 30), 2, 1);
      break;
    }
    case 'puddle': {
      const cx = X + 15, cy = Y + 14;
      for (let y = -9; y <= 9; y++)
        for (let x = -13; x <= 13; x++) {
          const d = Math.hypot(x / 13, y / 8 + 0.1 * Math.sin(x));
          if (d < 1) p.px(cx + x, cy + y, d > 0.85 ? 1 : 2);
        }
      p.hline(cx - 6, cy - 3, 4, 3); p.hline(cx + 2, cy + 2, 5, 3);
      // squeegee lying by the puddle
      p.rect(cx + 6, cy - 12, 2, 10, 0); p.rect(cx + 2, cy - 3, 10, 2, 0);
      break;
    }
  }
}

/** Paints the whole static map (floors, walls, doors, props) once. */
export function renderStatic(): HTMLCanvasElement {
  const c = makeCanvas(COLS * TILE, ROWS * TILE);
  const p = new Painter(c.getContext('2d')!);
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) {
      const k = GRID[y][x];
      if (k === 'wall') wall(p, x, y);
      else if (k === 'door') door(p, x, y);
      else if (k === 'window' || k === 'windowAC' || k === 'streetdoor') continue;
      else floor(p, k, x, y);
    }
  // windows and the street door last, so the AC box can overhang the yard
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) {
      const k = GRID[y][x];
      if (k === 'window' || k === 'windowAC') windowTile(p, x, y, k === 'windowAC');
      if (k === 'streetdoor') streetDoor(p, x, y);
    }
  hose(p);
  for (const o of PROPS) prop(p, o);
  const tree = PROPS.find((o) => o.kind === 'tree')!;
  trunk(p, tree.x * TILE, tree.y * TILE);
  return c;
}

/** The teal hose snaking from its reel across the dirt. */
function hose(p: Painter) {
  const reel = PROPS.find((o) => o.kind === 'reel')!;
  const sx = reel.x * TILE + 4, sy = reel.y * TILE + 10;
  let prev: [number, number] | null = null;
  for (let t = 0; t <= 1; t += 0.002) {
    const x = Math.round(sx - t * 78 + Math.sin(t * 9) * 10);
    const y = Math.round(sy + t * 70 + Math.sin(t * 5 + 1) * 8);
    if (prev && prev[0] === x && prev[1] === y) continue;
    p.rect(x - 1, y - 1, 3, 3, 0);
    prev = [x, y];
  }
  prev = null;
  for (let t = 0; t <= 1; t += 0.002) {
    const x = Math.round(sx - t * 78 + Math.sin(t * 9) * 10);
    const y = Math.round(sy + t * 70 + Math.sin(t * 5 + 1) * 8);
    p.px(x, y, 1);
  }
  // nozzle
  const ex = Math.round(sx - 78 + Math.sin(9) * 10), ey = Math.round(sy + 70 + Math.sin(6) * 8);
  p.rect(ex - 2, ey - 2, 4, 4, 0); p.px(ex - 1, ey - 1, 3);
}

function trunk(p: Painter, X: number, Y: number) {
  p.rect(X + 12, Y + 14, 8, 18, 0);
  p.rect(X + 14, Y + 14, 3, 17, 1);
  p.rect(X + 9, Y + 29, 14, 3, 0); // roots
  // branch reaching right with the hanging colander
  p.rect(X + 18, Y + 18, 14, 2, 0);
  p.vline(X + 30, Y + 20, 3, 0);
  for (let y = 0; y < 5; y++) p.hline(X + 26 + y / 2, Y + 23 + y, 9 - y, y === 0 ? 0 : 3);
  p.hline(X + 27, Y + 28, 7, 0);
  p.px(X + 28, Y + 25, 1); p.px(X + 31, Y + 25, 1); p.px(X + 29, Y + 26, 1); p.px(X + 32, Y + 27, 1);
  p.px(X + 26, Y + 24, 0); p.px(X + 35, Y + 24, 0);
}

/** Tree canopy, drawn above characters. */
export function drawCanopy(p: Painter, ox: number, oy: number, t: number) {
  const tree = PROPS.find((o) => o.kind === 'tree')!;
  const X = tree.x * TILE - ox, Y = tree.y * TILE - oy;
  const sway = Math.round(Math.sin(t / 900));
  const blobs: [number, number, number][] = [[12, 4, 11], [24, 8, 9], [6, 12, 8], [18, 16, 8], [28, 0, 6]];
  for (const [bx, by, r] of blobs) disc(p, X + bx + sway, Y + by - 8, r + 1, 0);
  for (const [bx, by, r] of blobs) disc(p, X + bx + sway, Y + by - 8, r, 1);
  for (const [bx, by, r] of blobs) disc(p, X + bx + sway - 2, Y + by - 10, r - 4, 2);
  for (let i = 0; i < 26; i++) {
    const a = hash(i, 3, 12) * 6.28, d = hash(i, 4, 12) * 13;
    p.px(X + 16 + sway + Math.round(Math.cos(a) * d), Y + 2 + Math.round(Math.sin(a) * d * 0.8), i % 2 ? 3 : 0);
  }
}
function disc(p: Painter, cx: number, cy: number, r: number, s: S) {
  for (let y = -r; y <= r; y++) {
    const w = Math.floor(Math.sqrt(r * r - y * y));
    p.hline(cx - w, cy + y, w * 2 + 1, s);
  }
}

/** Turtle pool with shimmering water and the two turtles stacked on their stone. */
export function drawPool(p: Painter, ox: number, oy: number, t: number) {
  const o = PROPS.find((q) => q.kind === 'pool')!;
  const X = o.x * TILE - ox, Y = o.y * TILE - oy, W = o.w * TILE, H = o.h * TILE;
  p.box(X, Y, W, H, 0, 2); // stone rim
  p.box(X + 3, Y + 3, W - 6, H - 6, 0, 1);
  const f = Math.floor(t / 500) % 2;
  for (let y = Y + 6; y < Y + H - 4; y += 5)
    for (let x = X + 6 + ((y + f * 3) % 7); x < X + W - 8; x += 11) p.hline(x, y, 3, 2);
  for (let x = X + 2; x < X + W - 2; x += 4) { p.px(x, Y + 1, 3); p.px(x + 2, Y + H - 2, 1); }
  // flat stone with turtles stacked on it
  const sx = X + 38, sy = Y + 28;
  p.box(sx, sy, 24, 14, 0, 2);
  p.hline(sx + 2, sy + 2, 16, 3);
  p.bmp(sx + 2, sy + 1, TURTLE);
  p.bmp(sx + 9, sy - 3 - f, TURTLE, true);
  // a lily pad
  disc(p, X + 18, Y + 18, 5, 0); disc(p, X + 18, Y + 18, 4, 2); p.hline(X + 18, Y + 18, 4, 1);
}

/** The three bunnies in the garden bed, nibbling (ears twitch now and then). */
export function drawBunnies(p: Painter, ox: number, oy: number, t: number) {
  const bed = PROPS.find((q) => q.kind === 'gardenbed')!;
  const X = bed.x * TILE - ox, Y = bed.y * TILE - oy;
  // white (biggest), Dutch black-and-white, grey-and-white; they sit in the gaps of the bed
  const spots: [number, number][] = [[2, 19], [3, 115], [17, 40]];
  spots.forEach(([dx, dy], i) => {
    const hop = Math.floor(t / 300 + i * 7) % 11 === 0 ? -2 : 0;
    const flip = i === 2;
    const bx = X + dx, by = Y + dy + hop;
    p.bmp(bx, by, BUNNY, flip);
    const at = (x: number, y: number, w: number, h: number, s: S) => p.rect(flip ? bx + 10 - x - w : bx + x, by + y, w, h, s);
    if (i === 0) { at(8, 4, 1, 1, 1); at(6, 1, 1, 2, 2); at(8, 1, 1, 2, 2); } // red eye, pink ears
    if (i === 1) { at(5, 1, 5, 4, 0); at(7, 3, 1, 2, 3); at(1, 4, 3, 3, 0); at(6, 1, 1, 2, 0); at(8, 1, 1, 2, 0); }
    if (i === 2) { at(5, 1, 5, 3, 1); at(7, 3, 1, 1, 3); at(8, 4, 1, 1, 0); at(2, 4, 3, 2, 1); }
  });
}

export function drawArrow(p: Painter, x: number, y: number, ready: boolean) {
  p.bmp(x, y, ready ? ARROW : ARROW_SOON);
}

// ---------------------------------------------------------------- characters

const spriteCache = new Map<string, HTMLCanvasElement>();
function spriteCanvas(key: string, rows: string[], flip: boolean) {
  let c = spriteCache.get(key);
  if (!c) {
    c = makeCanvas(16, 16);
    new Painter(c.getContext('2d')!).bmp(0, 0, rows, flip);
    spriteCache.set(key, c);
  }
  return c;
}
export function bentziSprite(dir: Dir, frame: Frame) {
  const d = dir === 'left' ? 'right' : dir;
  return spriteCanvas(`b-${dir}-${frame}`, BENTZI[d][frame], dir === 'left');
}
export function rosieSprite(dir: Dir, frame: 'a' | 'b') {
  const d = dir === 'left' ? 'right' : dir;
  return spriteCanvas(`r-${dir}-${frame}`, ROSIE[d][frame], dir === 'left');
}
/** Soft oval shadow under a character. */
export function shadow(p: Painter, x: number, y: number) {
  p.hline(x + 4, y + 15, 8, 1);
  p.hline(x + 5, y + 16, 6, 1);
}
