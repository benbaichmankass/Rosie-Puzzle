/**
 * Canvas art for the yard race, all drawn in code. Top-down, warm illustrated look: red-brown packed dirt
 * with leaves and gravel, cream rendered walls, the sunken turtle pond, the tree, the cable-spool table,
 * the teal hose, the green wire garden bed and the pallet planters. Everything is drawn in world units
 * (see track.ts); the caller sets the transform.
 */
import { mulberry } from './ai';
import { FOOD, HOUSE, LAP, POOL, TRACK_W, WALL, WORLD, pointAt, type FoodKind } from './track';

export const C = {
  dirt: '#a5704b',
  dirtDark: '#8a5a3b',
  dirtLight: '#bf8a5f',
  path: '#d4a679',
  pathEdge: '#94613f',
  wall: '#eadcc0',
  wallTop: '#f6ecd6',
  wallShade: '#cdbb98',
  roof: '#dcd6cc',
  roofDark: '#bdb5a8',
  hose: '#1f9aa6',
  hoseDark: '#136a73',
  wire: '#3f7a3a',
  leaf: '#5d8a3a',
  leafDark: '#3f6b2a',
  wood: '#a87a4e',
  woodDark: '#7a5233',
  water: '#5a4632',
  rim: '#a3a8a8',
  // racers
  bunny: '#f7f7f4',
  bunnyShade: '#dcdcd6',
  bunnyEar: '#f2b0bb',
  bunnyEye: '#c0283a',
  shell: '#5b5a2e',
  shellLight: '#7d7b3d',
  shellLine: '#3b3a1c',
  tSkin: '#55702c',
  tStripe: '#e3cf4a',
  tEar: '#c8382b',
  ink: '#3a2618',
};

type Ctx = CanvasRenderingContext2D;

function rr(g: Ctx, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function ellipse(g: Ctx, x: number, y: number, rx: number, ry: number, rot = 0) {
  g.beginPath();
  g.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, Math.PI * 2);
}

/** Is world point (x,y) inside the yard (not the house, not outside the walls)? */
function inYard(x: number, y: number) {
  if (x < WALL || y < WALL || x > WORLD.w - WALL || y > WORLD.h - WALL) return false;
  if (x > HOUSE.x && y < HOUSE.y + HOUSE.h) return false;
  return true;
}

function trackPath(g: Ctx, off = 0) {
  g.beginPath();
  for (let s = 0; s <= LAP; s += 3) {
    const p = pointAt(s, off);
    if (s === 0) g.moveTo(p.x, p.y);
    else g.lineTo(p.x, p.y);
  }
  g.closePath();
}

/** Distance from (x,y) to the track centre line (coarse). */
function distToTrack(x: number, y: number) {
  let best = 1e9;
  for (let s = 0; s < LAP; s += 4) {
    const p = pointAt(s);
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

// ------------------------------------------------------------------ static props

function drawLeaf(g: Ctx, x: number, y: number, r: number, rot: number, color: string) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(-r, 0);
  g.quadraticCurveTo(0, -r * 0.6, r, 0);
  g.quadraticCurveTo(0, r * 0.6, -r, 0);
  g.fill();
  g.strokeStyle = 'rgba(60,35,20,0.35)';
  g.lineWidth = 0.3;
  g.beginPath();
  g.moveTo(-r, 0);
  g.lineTo(r, 0);
  g.stroke();
  g.restore();
}

function drawPlantTuft(g: Ctx, x: number, y: number, r: number, rng: () => number, hue = 0) {
  const n = 6 + Math.floor(rng() * 4);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng() * 0.5;
    const col = i % 2 ? (hue ? '#7a9a6a' : C.leaf) : hue ? '#9ab48a' : '#6f9c45';
    drawLeaf(g, x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.6, a, col);
  }
  g.fillStyle = hue ? '#b9caa8' : '#86b356';
  ellipse(g, x, y, r * 0.25, r * 0.25);
  g.fill();
}

function drawPool(g: Ctx) {
  const { x, y, w, h } = POOL;
  // dug-out edge
  g.fillStyle = 'rgba(60,35,20,0.35)';
  rr(g, x - 3, y - 3, w + 6, h + 6, 5);
  g.fill();
  // metal rim
  g.fillStyle = C.rim;
  rr(g, x, y, w, h, 3);
  g.fill();
  g.fillStyle = '#c7cbca';
  rr(g, x + 1, y + 1, w - 2, 3, 1);
  g.fill();
  // water
  const wg = g.createLinearGradient(x, y, x + w, y + h);
  wg.addColorStop(0, '#4b3a2a');
  wg.addColorStop(0.6, '#6a4c36');
  wg.addColorStop(1, '#7b5a3e');
  g.fillStyle = wg;
  rr(g, x + 4, y + 4, w - 8, h - 8, 2);
  g.fill();
  // inner shadow along the top edge
  g.fillStyle = 'rgba(20,10,5,0.35)';
  g.fillRect(x + 4, y + 4, w - 8, 5);
  // light glints
  g.strokeStyle = 'rgba(255,240,220,0.25)';
  g.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    g.beginPath();
    g.moveTo(x + 12 + i * 11, y + 20 + (i % 2) * 18);
    g.lineTo(x + 20 + i * 11, y + 20 + (i % 2) * 18);
    g.stroke();
  }
  // flat sunning stone with the second turtle on it
  g.fillStyle = '#8f8a80';
  ellipse(g, x + w - 18, y + h - 20, 13, 10, 0.3);
  g.fill();
  g.fillStyle = '#a9a398';
  ellipse(g, x + w - 19, y + h - 22, 11, 8, 0.3);
  g.fill();
  drawTurtle(g, x + w - 19, y + h - 22, -2.2, { scale: 0.62, steps: 0, t: 0, tired: false, sun: true });
}

function drawTree(g: Ctx, x: number, y: number, r: number, rng: () => number) {
  // shadow
  g.fillStyle = 'rgba(40,20,10,0.25)';
  ellipse(g, x + 6, y + 7, r * 1.02, r * 0.95);
  g.fill();
  // canopy clumps
  const clumps = 14;
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < clumps; i++) {
      const a = (i / clumps) * Math.PI * 2 + pass * 0.4;
      const d = r * (0.62 - pass * 0.2) * (0.85 + rng() * 0.3);
      const cr = r * (0.42 - pass * 0.06);
      g.fillStyle = ['#46702f', '#5a8a3a', '#78a64a'][pass];
      ellipse(g, x + Math.cos(a) * d - pass * 1.5, y + Math.sin(a) * d - pass * 1.5, cr, cr * 0.92);
      g.fill();
    }
  }
  g.fillStyle = '#86b356';
  ellipse(g, x - 4, y - 5, r * 0.3, r * 0.26);
  g.fill();
  // little highlights
  for (let i = 0; i < 26; i++) {
    const a = rng() * Math.PI * 2;
    const d = rng() * r * 0.85;
    drawLeaf(g, x + Math.cos(a) * d, y + Math.sin(a) * d, 2.2, rng() * 6, rng() < 0.5 ? '#9cc463' : '#3d6428');
  }
  // the metal colander hanging in the tree
  const cx = x + r * 0.45;
  const cy = y + r * 0.35;
  g.fillStyle = 'rgba(30,20,10,0.3)';
  ellipse(g, cx + 2, cy + 3, 6.5, 6.5);
  g.fill();
  g.fillStyle = '#c9cdd0';
  ellipse(g, cx, cy, 6.5, 6.5);
  g.fill();
  g.fillStyle = '#9aa0a5';
  ellipse(g, cx, cy, 4.6, 4.6);
  g.fill();
  g.fillStyle = '#5a6066';
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    ellipse(g, cx + Math.cos(a) * 2.6, cy + Math.sin(a) * 2.6, 0.5, 0.5);
    g.fill();
  }
  g.strokeStyle = '#e7eaec';
  g.lineWidth = 0.8;
  g.beginPath();
  g.arc(cx, cy, 6, -2.6, -1.2);
  g.stroke();
}

function drawSpool(g: Ctx, x: number, y: number, r: number) {
  g.fillStyle = 'rgba(40,20,10,0.3)';
  ellipse(g, x + 4, y + 5, r, r);
  g.fill();
  g.fillStyle = C.woodDark;
  ellipse(g, x, y, r, r);
  g.fill();
  g.fillStyle = '#b88a5a';
  ellipse(g, x, y, r - 2, r - 2);
  g.fill();
  // planks
  g.save();
  ellipse(g, x, y, r - 2, r - 2);
  g.clip();
  g.strokeStyle = 'rgba(90,55,30,0.55)';
  g.lineWidth = 0.8;
  for (let i = -r; i < r; i += 6.5) {
    g.beginPath();
    g.moveTo(x + i, y - r);
    g.lineTo(x + i, y + r);
    g.stroke();
  }
  g.strokeStyle = 'rgba(255,230,190,0.18)';
  g.lineWidth = 1.5;
  for (let i = -r + 3; i < r; i += 6.5) {
    g.beginPath();
    g.moveTo(x + i, y - r);
    g.lineTo(x + i, y + r);
    g.stroke();
  }
  g.restore();
  // weathered ring + bolt heads + centre hole
  g.strokeStyle = 'rgba(90,55,30,0.5)';
  g.lineWidth = 1;
  ellipse(g, x, y, r * 0.62, r * 0.62);
  g.stroke();
  g.fillStyle = '#4a3020';
  ellipse(g, x, y, 4, 4);
  g.fill();
  g.fillStyle = '#6b6b66';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    ellipse(g, x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8, 0.9, 0.9);
    g.fill();
  }
  // a mug on the table
  g.fillStyle = '#f0ebe0';
  ellipse(g, x - 8, y - 6, 3, 3);
  g.fill();
  g.fillStyle = '#5b3a24';
  ellipse(g, x - 8, y - 6, 2, 2);
  g.fill();
}

function drawWireBed(g: Ctx, x: number, y: number, w: number, h: number, rng: () => number) {
  g.fillStyle = '#7d4e31';
  rr(g, x, y, w, h, 3);
  g.fill();
  g.fillStyle = 'rgba(0,0,0,0.12)';
  for (let i = 0; i < 60; i++) {
    ellipse(g, x + rng() * w, y + rng() * h, 0.8, 0.8);
    g.fill();
  }
  // plants
  const cols = Math.max(2, Math.round(w / 18));
  const rows = Math.max(2, Math.round(h / 18));
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++) {
      const px = x + ((i + 0.5) / cols) * w + (rng() - 0.5) * 4;
      const py = y + ((j + 0.5) / rows) * h + (rng() - 0.5) * 4;
      drawPlantTuft(g, px, py, 6 + rng() * 2.5, rng, j % 2);
    }
  // green wire fence (mesh drawn as a grid border)
  g.strokeStyle = C.wire;
  g.lineWidth = 1.1;
  rr(g, x, y, w, h, 3);
  g.stroke();
  g.lineWidth = 0.45;
  g.strokeStyle = 'rgba(63,122,58,0.75)';
  for (let i = 0; i <= w; i += 3) {
    g.beginPath();
    g.moveTo(x + i, y - 1.5);
    g.lineTo(x + i, y + 1.5);
    g.moveTo(x + i, y + h - 1.5);
    g.lineTo(x + i, y + h + 1.5);
    g.stroke();
  }
  for (let j = 0; j <= h; j += 3) {
    g.beginPath();
    g.moveTo(x - 1.5, y + j);
    g.lineTo(x + 1.5, y + j);
    g.moveTo(x + w - 1.5, y + j);
    g.lineTo(x + w + 1.5, y + j);
    g.stroke();
  }
}

function drawPallet(g: Ctx, x: number, y: number, w: number, h: number, rng: () => number, crate: boolean) {
  g.fillStyle = 'rgba(40,20,10,0.3)';
  g.fillRect(x + 2, y + 2, w, h);
  g.fillStyle = '#c4a57a';
  g.fillRect(x, y, w, h);
  g.strokeStyle = 'rgba(110,80,50,0.7)';
  g.lineWidth = 0.6;
  for (let j = 3; j < h; j += 4.5) {
    g.beginPath();
    g.moveTo(x, y + j);
    g.lineTo(x + w, y + j);
    g.stroke();
  }
  if (crate) {
    g.fillStyle = '#5f8fa8';
    g.fillRect(x + 2, y + 3, w - 4, h * 0.45);
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.fillRect(x + 2, y + 3, w - 4, 1.5);
  }
  for (let i = 0; i < 2; i++) drawPlantTuft(g, x + w / 2 + (rng() - 0.5) * 3, y + h * (crate ? 0.78 : 0.3 + i * 0.4), 4.5, rng);
}

function drawWateringCan(g: Ctx, x: number, y: number, rot: number) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.fillStyle = 'rgba(30,20,10,0.3)';
  ellipse(g, 2, 2, 8, 6);
  g.fill();
  g.fillStyle = '#3f9a4a';
  rr(g, -7, -6, 14, 12, 3);
  g.fill();
  g.fillStyle = '#5fbf68';
  rr(g, -5, -4, 8, 4, 2);
  g.fill();
  g.strokeStyle = '#2f7a38';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(7, 0);
  g.lineTo(16, -3);
  g.stroke();
  g.fillStyle = '#2f7a38';
  ellipse(g, 16.5, -3.2, 2, 2);
  g.fill();
  g.strokeStyle = '#2f7a38';
  g.lineWidth = 1.6;
  g.beginPath();
  g.arc(-3, 0, 5, Math.PI * 0.7, Math.PI * 1.3);
  g.stroke();
  g.restore();
}

function drawPot(g: Ctx, x: number, y: number, r: number, rng: () => number) {
  g.fillStyle = 'rgba(30,20,10,0.3)';
  ellipse(g, x + 2, y + 2, r, r);
  g.fill();
  g.fillStyle = '#b8603d';
  ellipse(g, x, y, r, r);
  g.fill();
  g.fillStyle = '#5a3a24';
  ellipse(g, x, y, r * 0.78, r * 0.78);
  g.fill();
  drawPlantTuft(g, x, y, r * 0.95, rng, rng() < 0.5 ? 1 : 0);
}

/** The teal hose snaking across the ground: a smooth curve through the given points. */
function drawHose(g: Ctx, pts: [number, number][]) {
  const path = () => {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2;
      const my = (pts[i][1] + pts[i + 1][1]) / 2;
      g.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    const l = pts[pts.length - 1];
    g.lineTo(l[0], l[1]);
  };
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = 'rgba(30,15,5,0.3)';
  g.lineWidth = 3.4;
  g.save();
  g.translate(1.5, 1.8);
  path();
  g.stroke();
  g.restore();
  g.strokeStyle = C.hoseDark;
  g.lineWidth = 3.2;
  path();
  g.stroke();
  g.strokeStyle = C.hose;
  g.lineWidth = 2.2;
  path();
  g.stroke();
  g.strokeStyle = 'rgba(200,250,255,0.45)';
  g.lineWidth = 0.7;
  g.save();
  g.translate(-0.5, -0.6);
  path();
  g.stroke();
  g.restore();
}

// ------------------------------------------------------------------ the house roof

function drawHouse(g: Ctx) {
  const { x, y, w, h } = HOUSE;
  // flat roof
  g.fillStyle = C.roof;
  g.fillRect(x, y, w, h);
  // roofing sheet seams
  g.strokeStyle = 'rgba(120,110,100,0.18)';
  g.lineWidth = 1;
  for (let i = y + 20; i < y + h; i += 24) {
    g.beginPath();
    g.moveTo(x, i);
    g.lineTo(x + w, i);
    g.stroke();
  }
  // parapet
  g.strokeStyle = '#efe9df';
  g.lineWidth = 7;
  g.strokeRect(x + 3.5, y + 3.5, w - 7, h - 7);
  g.strokeStyle = 'rgba(0,0,0,0.12)';
  g.lineWidth = 1;
  g.strokeRect(x + 7, y + 7, w - 14, h - 14);
  // living room / bedroom roof split
  g.strokeStyle = 'rgba(0,0,0,0.1)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(x + 7, y + 250);
  g.lineTo(x + w - 7, y + 250);
  g.stroke();
  // solar water heater
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.fillRect(x + w - 64, y + h - 72, 50, 42);
  g.fillStyle = '#2c3f5c';
  g.fillRect(x + w - 68, y + h - 76, 50, 34);
  g.strokeStyle = '#8ea4c0';
  g.lineWidth = 0.7;
  for (let i = 1; i < 5; i++) {
    g.beginPath();
    g.moveTo(x + w - 68 + i * 10, y + h - 76);
    g.lineTo(x + w - 68 + i * 10, y + h - 42);
    g.stroke();
  }
  g.fillStyle = '#e8e4dc';
  rr(g, x + w - 70, y + h - 40, 54, 10, 5);
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.2)';
  g.stroke();
  // the AC unit's outdoor box on the yard wall (window with AC)
  g.fillStyle = 'rgba(0,0,0,0.2)';
  g.fillRect(x - 13, y + 183, 14, 26);
  g.fillStyle = '#ecebe6';
  g.fillRect(x - 15, y + 180, 14, 26);
  g.strokeStyle = '#b9b7ae';
  g.lineWidth = 0.6;
  for (let i = 0; i < 6; i++) {
    g.beginPath();
    g.moveTo(x - 14, y + 183 + i * 3.6);
    g.lineTo(x - 2, y + 183 + i * 3.6);
    g.stroke();
  }
}

/** Openings in the house's yard-facing wall and the yard's outer walls. */
function drawWallFeatures(g: Ctx) {
  const hx = HOUSE.x;
  // windows on the house wall
  const win = (y0: number, y1: number) => {
    g.fillStyle = '#8fb8c8';
    g.fillRect(hx - 2, y0, 4, y1 - y0);
    g.fillStyle = '#e8f2f5';
    g.fillRect(hx - 1, y0 + 2, 1, y1 - y0 - 4);
    g.fillStyle = '#6a6a66';
    g.fillRect(hx - 3, y0, 6, 1.5);
    g.fillRect(hx - 3, y1 - 1.5, 6, 1.5);
  };
  win(24, 66);
  win(170, 214);
  // front door (living room <-> yard) with a doormat
  g.fillStyle = '#7a5233';
  g.fillRect(hx - 3, 86, 6, 52);
  g.fillStyle = '#5a3a22';
  g.fillRect(hx - 3, 86, 6, 2);
  g.fillRect(hx - 3, 136, 6, 2);
  g.fillStyle = '#9a7a4a';
  rr(g, hx - 16, 94, 12, 36, 2);
  g.fill();
  g.strokeStyle = 'rgba(90,60,30,0.6)';
  g.lineWidth = 0.5;
  for (let i = 97; i < 128; i += 3) {
    g.beginPath();
    g.moveTo(hx - 15, i);
    g.lineTo(hx - 5, i);
    g.stroke();
  }
  // bedroom window
  win(300, 350);
  // street door in the left wall
  g.fillStyle = '#6e4a2c';
  g.fillRect(0, 70, WALL + 1, 58);
  g.fillStyle = '#8a5f3a';
  g.fillRect(1.5, 72, WALL - 2, 54);
  g.strokeStyle = 'rgba(60,35,20,0.7)';
  g.lineWidth = 0.6;
  for (let i = 79; i < 126; i += 7) {
    g.beginPath();
    g.moveTo(1.5, i);
    g.lineTo(WALL - 0.5, i);
    g.stroke();
  }
  g.fillStyle = '#d6b54a';
  ellipse(g, WALL - 2.5, 100, 1, 1);
  g.fill();
}

function drawWalls(g: Ctx) {
  const W = WORLD.w;
  const H = WORLD.h;
  // cast shadow onto the dirt (walls lit from the top-left)
  g.save();
  g.beginPath();
  g.rect(WALL, WALL, HOUSE.x - WALL, H - 2 * WALL);
  g.rect(HOUSE.x, HOUSE.y + HOUSE.h, W - HOUSE.x - WALL, H - WALL - HOUSE.h);
  g.clip();
  const sh = (x: number, y: number, w: number, h: number, x0: number, y0: number, x1: number, y1: number) => {
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, 'rgba(50,25,10,0.4)');
    gr.addColorStop(1, 'rgba(50,25,10,0)');
    g.fillStyle = gr;
    g.fillRect(x, y, w, h);
  };
  sh(WALL, WALL, W, 16, 0, WALL, 0, WALL + 16); // top wall
  sh(WALL, WALL, 14, H, WALL, 0, WALL + 14, 0); // left wall
  sh(HOUSE.x, HOUSE.h, W, 12, 0, HOUSE.h, 0, HOUSE.h + 12); // under the house
  g.restore();
  // the walls themselves
  g.fillStyle = C.wall;
  g.fillRect(0, 0, W, WALL);
  g.fillRect(0, 0, WALL, H);
  g.fillRect(0, H - WALL, W, WALL);
  g.fillRect(W - WALL, HOUSE.h, WALL, H - HOUSE.h);
  g.fillStyle = C.wallTop;
  g.fillRect(0, 0, W, 3);
  g.fillRect(0, 0, 3, H);
  g.fillRect(0, H - WALL, W, 3);
  g.fillRect(W - WALL, HOUSE.h, 3, H - HOUSE.h);
  g.fillStyle = C.wallShade;
  g.fillRect(WALL - 1.5, WALL - 1.5, HOUSE.x - WALL + 1.5, 1.5);
  g.fillRect(WALL - 1.5, WALL - 1.5, 1.5, H - 2 * WALL + 3);
  // rendered plaster speckle
  const rng = mulberry(77);
  g.fillStyle = 'rgba(150,130,100,0.25)';
  for (let i = 0; i < 400; i++) {
    const t = rng();
    let x = 0;
    let y = 0;
    if (t < 0.35) {
      x = rng() * W;
      y = rng() * WALL;
    } else if (t < 0.7) {
      x = rng() * WALL;
      y = rng() * H;
    } else {
      x = rng() * W;
      y = H - WALL + rng() * WALL;
    }
    g.fillRect(x, y, 0.8, 0.8);
  }
}

// ------------------------------------------------------------------ background

/** Paints everything that never moves. g must already be scaled to world units. */
export function paintYard(g: Ctx) {
  const rng = mulberry(20240611);
  const W = WORLD.w;
  const H = WORLD.h;
  // ground
  g.fillStyle = C.dirt;
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 70; i++) {
    const x = rng() * W;
    const y = rng() * H;
    const r = 14 + rng() * 40;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    const c = rng() < 0.5 ? '138,88,56' : '196,146,104';
    gr.addColorStop(0, `rgba(${c},0.35)`);
    gr.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // gravel & grit
  for (let i = 0; i < 2600; i++) {
    const x = rng() * W;
    const y = rng() * H;
    const v = rng();
    g.fillStyle = v < 0.4 ? 'rgba(80,50,30,0.35)' : v < 0.75 ? 'rgba(220,180,140,0.35)' : 'rgba(170,165,155,0.6)';
    const r = 0.3 + rng() * (v > 0.9 ? 1.4 : 0.7);
    ellipse(g, x, y, r, r * (0.7 + rng() * 0.3));
    g.fill();
  }

  // the race path: worn lighter dirt
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.strokeStyle = 'rgba(110,70,45,0.45)';
  g.lineWidth = TRACK_W + 6;
  trackPath(g);
  g.stroke();
  g.strokeStyle = C.path;
  g.lineWidth = TRACK_W;
  trackPath(g);
  g.stroke();
  g.strokeStyle = 'rgba(232,196,152,0.55)';
  g.lineWidth = TRACK_W * 0.55;
  trackPath(g);
  g.stroke();
  // path texture
  for (let s = 0; s < LAP; s += 1.3) {
    const p = pointAt(s, (rng() - 0.5) * TRACK_W * 0.95);
    const v = rng();
    g.fillStyle = v < 0.5 ? 'rgba(150,100,60,0.35)' : 'rgba(250,225,190,0.4)';
    ellipse(g, p.x, p.y, 0.4 + rng() * 0.6, 0.4 + rng() * 0.5);
    g.fill();
  }
  // lane divider: faint chalk dashes
  g.strokeStyle = 'rgba(255,248,232,0.55)';
  g.lineWidth = 1.1;
  g.setLineDash([5, 7]);
  trackPath(g);
  g.stroke();
  g.setLineDash([]);
  // border pebbles
  for (const side of [-1, 1]) {
    for (let s = 0; s < LAP; s += 7 + rng() * 3) {
      const p = pointAt(s, side * (TRACK_W / 2 + 1.5));
      const r = 1.3 + rng() * 1.1;
      g.fillStyle = 'rgba(60,35,20,0.35)';
      ellipse(g, p.x + 0.6, p.y + 0.8, r, r * 0.8);
      g.fill();
      const c = 200 + Math.floor(rng() * 40);
      g.fillStyle = `rgb(${c},${c - 12},${c - 30})`;
      ellipse(g, p.x, p.y, r, r * 0.8, rng() * 3);
      g.fill();
    }
  }

  // dry leaves everywhere except on the house
  for (let i = 0; i < 260; i++) {
    const x = rng() * W;
    const y = rng() * H;
    if (!inYard(x, y)) continue;
    const onPath = distToTrack(x, y) < TRACK_W / 2;
    if (onPath && rng() < 0.75) continue;
    const cols = ['#c48a3a', '#9a6a32', '#d9b25a', '#7a5a2e', '#b5793d'];
    drawLeaf(g, x, y, 2 + rng() * 2.2, rng() * Math.PI * 2, cols[Math.floor(rng() * cols.length)]);
  }

  // props in the island and along the walls
  // bunny wall: a low strip of herbs and greens behind green wire on the left wall
  for (let y = 150; y < 420; y += 13 + rng() * 6) drawPlantTuft(g, 17 + rng() * 2, y, 4.5 + rng() * 2, rng, rng() < 0.3 ? 1 : 0);
  g.strokeStyle = C.wire;
  g.lineWidth = 0.8;
  g.beginPath();
  g.moveTo(24, 146);
  g.lineTo(24, 424);
  g.stroke();
  g.setLineDash([1, 2]);
  g.lineWidth = 2.5;
  g.strokeStyle = 'rgba(63,122,58,0.5)';
  g.beginPath();
  g.moveTo(24, 146);
  g.lineTo(24, 424);
  g.stroke();
  g.setLineDash([]);

  drawWireBed(g, 76, 196, 58, 62, rng);
  drawTree(g, 104, 128, 32, rng);
  drawSpool(g, 108, 330, 24);
  drawWateringCan(g, 92, 385, 0.5);
  drawPot(g, 128, 392, 6, rng);
  drawPot(g, 82, 282, 5.5, rng);

  // pallet planters along the house wall
  for (let i = 0; i < 6; i++) drawPallet(g, 184, 230 + i * 26, 13, 22, rng, i % 2 === 1);

  // teal hose: from a tap by the house corner, snaking along the arm island
  drawHose(g, [
    [200, 418],
    [196, 432],
    [214, 478],
    [240, 500],
    [270, 486],
    [300, 504],
    [326, 490],
    [342, 498],
    [338, 486],
    [318, 480],
  ]);
  // a tap on the house wall
  g.fillStyle = '#9a9a96';
  g.fillRect(195, 414, 8, 5);
  drawPot(g, 252, 490, 5, rng);
  drawPot(g, 288, 494, 4.5, rng);

  drawPool(g);
  drawHouse(g);
  drawWalls(g);
  drawWallFeatures(g);

  // start / finish line
  drawFinishLine(g);
}

function drawFinishLine(g: Ctx) {
  const p = pointAt(0);
  g.save();
  g.translate(p.x, p.y);
  g.rotate(p.angle + Math.PI / 2);
  const n = 8;
  const cw = TRACK_W / n;
  for (let r = 0; r < 2; r++)
    for (let i = 0; i < n; i++) {
      g.fillStyle = (i + r) % 2 ? '#2a2420' : '#f6f0e2';
      g.fillRect(-TRACK_W / 2 + i * cw, -cw + r * cw, cw, cw);
    }
  g.restore();
  // flag posts
  for (const side of [-1, 1]) {
    const q = pointAt(0, side * (TRACK_W / 2 + 4));
    g.fillStyle = 'rgba(30,15,5,0.35)';
    ellipse(g, q.x + 1.5, q.y + 1.5, 2.2, 2.2);
    g.fill();
    g.fillStyle = '#e8e2d4';
    ellipse(g, q.x, q.y, 2.2, 2.2);
    g.fill();
  }
}

// ------------------------------------------------------------------ food

function drawLettuce(g: Ctx, x: number, y: number, r: number, bite: number) {
  const n = 9;
  for (let ring = 0; ring < 3; ring++) {
    for (let i = 0; i < n - ring * 2; i++) {
      const a = (i / (n - ring * 2)) * Math.PI * 2 + ring * 0.5;
      const d = r * (0.55 - ring * 0.2);
      g.fillStyle = ['#4f8f34', '#79b84a', '#b4dd7a'][ring];
      ellipse(g, x + Math.cos(a) * d, y + Math.sin(a) * d, r * (0.5 - ring * 0.1), r * (0.42 - ring * 0.08), a);
      g.fill();
    }
  }
  g.strokeStyle = 'rgba(240,255,220,0.5)';
  g.lineWidth = 0.4;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8);
    g.stroke();
  }
  if (bite > 0) {
    g.fillStyle = C.dirt;
    ellipse(g, x + r * 0.8, y - r * 0.2, r * 0.3 * bite, r * 0.3 * bite);
    g.fill();
  }
}

function drawCarrots(g: Ctx, x: number, y: number, r: number) {
  for (let i = 0; i < 3; i++) {
    const cx = x + (i - 1) * r * 0.6;
    const cy = y + (i % 2) * r * 0.3 - r * 0.1;
    // tops
    for (let k = 0; k < 4; k++) {
      const a = -Math.PI / 2 + (k - 1.5) * 0.45;
      drawLeaf(g, cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55, r * 0.45, a, k % 2 ? '#4f8f34' : '#79b84a');
    }
    // shoulder of the carrot peeking out of the soil
    g.fillStyle = '#e8792a';
    ellipse(g, cx, cy + r * 0.05, r * 0.28, r * 0.24);
    g.fill();
    g.fillStyle = '#f59a4a';
    ellipse(g, cx - r * 0.08, cy - r * 0.02, r * 0.1, r * 0.08);
    g.fill();
  }
}

function drawDandelions(g: Ctx, x: number, y: number, r: number, t: number) {
  // rosette of toothed leaves
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    drawLeaf(g, x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5, r * 0.6, a, i % 2 ? '#4f8f34' : '#6aa83f');
  }
  const heads: [number, number][] = [
    [-0.35, -0.2],
    [0.35, 0.05],
    [0, 0.4],
  ];
  heads.forEach(([dx, dy], i) => {
    const hx = x + dx * r;
    const hy = y + dy * r;
    const sway = Math.sin(t * 2 + i) * 0.4;
    g.fillStyle = '#e0a51a';
    ellipse(g, hx + sway, hy, r * 0.3, r * 0.3);
    g.fill();
    g.fillStyle = '#ffd43a';
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      ellipse(g, hx + sway + Math.cos(a) * r * 0.2, hy + Math.sin(a) * r * 0.2, r * 0.11, r * 0.06, a);
      g.fill();
    }
    g.fillStyle = '#fff07a';
    ellipse(g, hx + sway, hy, r * 0.09, r * 0.09);
    g.fill();
  });
}

/** Food spots: a tinted stopping zone on the track plus the plant beside it. `active` = a bunny is eating here. */
export function drawFood(g: Ctx, t: number, active: boolean[], highlight: number, cue = -1) {
  FOOD.forEach((f, i) => {
    // zone band on the track
    g.save();
    g.lineCap = 'butt';
    const pulse = cue === i ? 0.6 : highlight === i ? 0.3 + Math.sin(t * 6) * 0.1 : 0.2;
    g.strokeStyle = cue === i ? `rgba(255,236,120,${pulse})` : `rgba(150,215,90,${pulse})`;
    g.lineWidth = TRACK_W - 2;
    g.beginPath();
    for (let s = f.s0; s <= f.s1; s += 2) {
      const p = pointAt(s);
      if (s === f.s0) g.moveTo(p.x, p.y);
      else g.lineTo(p.x, p.y);
    }
    g.stroke();
    // dotted borders across the track
    for (const s of [f.s0, f.s1]) {
      const a = pointAt(s, -TRACK_W / 2 + 2);
      const b = pointAt(s, TRACK_W / 2 - 2);
      g.strokeStyle = 'rgba(255,255,235,0.7)';
      g.lineWidth = 1.2;
      g.setLineDash([2, 2]);
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      g.stroke();
      g.setLineDash([]);
    }
    g.restore();
    const c = pointAt((f.s0 + f.s1) / 2, f.side * (TRACK_W / 2 + 1));
    const bob = active[i] ? Math.sin(t * 22) * 0.6 : 0;
    g.fillStyle = 'rgba(40,20,10,0.3)';
    ellipse(g, c.x + 1.5, c.y + 2, 11, 9.5);
    g.fill();
    g.fillStyle = '#7a4a2c';
    ellipse(g, c.x, c.y, 11, 9.5);
    g.fill();
    g.fillStyle = '#5e3820';
    ellipse(g, c.x, c.y + 1, 9, 7.5);
    g.fill();
    drawFoodIcon(g, f.kind, c.x + bob, c.y, 10.5, t, active[i] ? 0.6 : 0);
    if (cue === i) {
      // speech-bubble cue beside the patch
      const mp = pointAt((f.s0 + f.s1) / 2, f.side * (TRACK_W / 2 + 26));
      g.save();
      g.font = '700 9px "Fredoka", system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const w = g.measureText('LET GO!').width + 8;
      const m = { x: Math.max(WALL + w / 2 + 2, Math.min(WORLD.w - WALL - w / 2 - 2, mp.x)), y: Math.max(WALL + 9, Math.min(WORLD.h - WALL - 9, mp.y)) };
      g.fillStyle = '#fff8ea';
      g.strokeStyle = C.ink;
      g.lineWidth = 1.2;
      rr(g, m.x - w / 2, m.y - 7, w, 14, 5);
      g.fill();
      g.stroke();
      g.fillStyle = C.ink;
      g.fillText('LET GO!', m.x, m.y + 0.5);
      g.restore();
    }
  });
}

export function drawFoodIcon(g: Ctx, kind: FoodKind, x: number, y: number, r: number, t: number, bite = 0) {
  if (kind === 'lettuce') drawLettuce(g, x, y, r, bite);
  else if (kind === 'carrot') drawCarrots(g, x, y, r);
  else drawDandelions(g, x, y, r, t);
}

// ------------------------------------------------------------------ racers

export interface TurtlePose {
  scale: number;
  steps: number; // step counter, drives the leg paddle
  t: number;
  tired: boolean;
  sun?: boolean;
  /** 0..1 progress through the current step (for a smooth paddle). */
  stepPhase?: number;
}

/** Red-eared slider from above, facing +x in local space. */
export function drawTurtle(g: Ctx, x: number, y: number, angle: number, p: TurtlePose) {
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  g.scale(p.scale, p.scale);
  const ph = (p.stepPhase ?? 0) * Math.PI;
  const swing = p.sun ? 0 : Math.sin(ph + (p.steps % 2) * Math.PI) * 3;
  // shadow
  g.fillStyle = 'rgba(30,15,5,0.32)';
  ellipse(g, 1.5, 2.2, 12, 9.5);
  g.fill();
  // legs (front pair swing opposite to the back pair)
  const leg = (lx: number, ly: number, sw: number, front: boolean) => {
    g.save();
    g.translate(lx + sw, ly);
    g.rotate(front ? (ly < 0 ? -0.6 : 0.6) : ly < 0 ? -2.4 : 2.4);
    g.fillStyle = C.tSkin;
    ellipse(g, 3, 0, 4.2, 2.4);
    g.fill();
    g.fillStyle = C.tStripe;
    g.fillRect(1, -0.3, 4, 0.6);
    g.fillStyle = '#2f3f18';
    for (let k = -1; k <= 1; k++) {
      ellipse(g, 6.6, k * 1, 0.6, 0.45);
      g.fill();
    }
    g.restore();
  };
  leg(5, -7, swing, true);
  leg(5, 7, -swing, true);
  leg(-6, -6.5, -swing, false);
  leg(-6, 6.5, swing, false);
  // tail
  g.fillStyle = C.tSkin;
  g.beginPath();
  g.moveTo(-10, -1.5);
  g.lineTo(-15, 0);
  g.lineTo(-10, 1.5);
  g.fill();
  // head + neck, bobbing with each step
  const hx = 12 + (p.sun ? 1 : Math.cos(ph) * 1.2);
  g.fillStyle = C.tSkin;
  ellipse(g, hx - 2, 0, 4, 3);
  g.fill();
  ellipse(g, hx + 1.5, 0, 3.6, 3.1);
  g.fill();
  // yellow stripes
  g.strokeStyle = C.tStripe;
  g.lineWidth = 0.55;
  for (const sy of [-1.6, 0, 1.6]) {
    g.beginPath();
    g.moveTo(hx - 5, sy * 0.9);
    g.quadraticCurveTo(hx, sy, hx + 3.5, sy * 0.5);
    g.stroke();
  }
  // red ear patches
  g.fillStyle = C.tEar;
  ellipse(g, hx - 0.5, -2.7, 1.5, 0.75);
  g.fill();
  ellipse(g, hx - 0.5, 2.7, 1.5, 0.75);
  g.fill();
  // eyes
  g.fillStyle = '#1a1a10';
  ellipse(g, hx + 2.2, -1.9, 0.75, 0.6);
  g.fill();
  ellipse(g, hx + 2.2, 1.9, 0.75, 0.6);
  g.fill();
  // shell
  const sg = g.createRadialGradient(-2, -3, 1, 0, 0, 12);
  sg.addColorStop(0, C.shellLight);
  sg.addColorStop(1, C.shell);
  g.fillStyle = '#c9b860';
  ellipse(g, 0, 0, 11.4, 9.2);
  g.fill();
  g.fillStyle = sg;
  ellipse(g, 0, 0, 10.6, 8.5);
  g.fill();
  // scutes
  g.strokeStyle = C.shellLine;
  g.lineWidth = 0.6;
  g.beginPath();
  g.moveTo(-6, 0);
  g.lineTo(6, 0);
  for (const sx of [-3.5, 0.5, 4.5]) {
    g.moveTo(sx, -6.8);
    g.lineTo(sx + 0.6, 6.8);
  }
  g.stroke();
  g.strokeStyle = 'rgba(227,207,74,0.55)';
  g.lineWidth = 0.4;
  for (const sx of [-5.5, -1.5, 2.5, 6]) {
    g.beginPath();
    g.arc(sx, -3.2, 1.6, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.arc(sx, 3.2, 1.6, 0, Math.PI * 2);
    g.stroke();
  }
  // shine
  g.fillStyle = 'rgba(255,255,220,0.22)';
  ellipse(g, -2.5, -3.5, 4, 1.8, -0.2);
  g.fill();
  g.restore();
  if (p.tired && !p.sun) {
    // sweat drops
    const k = (p.t * 1.5) % 1;
    g.fillStyle = `rgba(150,200,240,${1 - k})`;
    ellipse(g, x + 8, y - 10 - k * 6, 1.4, 2);
    g.fill();
    ellipse(g, x - 7, y - 9 - ((k + 0.5) % 1) * 6, 1.2, 1.8);
    g.fill();
  }
}

export interface BunnyPose {
  scale: number;
  /** 0..1 hop phase while running. */
  hop: number;
  running: boolean;
  eating: boolean;
  flop: boolean;
  t: number;
}

/** The big white bunny (pink ears, red eyes) from above, facing +x in local space. */
export function drawBunny(g: Ctx, x: number, y: number, angle: number, p: BunnyPose) {
  g.save();
  g.translate(x, y);
  if (p.flop) {
    // flopped on its side, belly up-ish
    g.rotate(angle + 0.9);
    g.scale(p.scale, p.scale);
    g.fillStyle = 'rgba(30,15,5,0.28)';
    ellipse(g, 1, 2, 13, 8);
    g.fill();
    g.fillStyle = C.bunny;
    ellipse(g, -1, 0, 11, 7.5);
    g.fill();
    g.fillStyle = C.bunnyShade;
    ellipse(g, -2, 2.5, 8, 3.5);
    g.fill();
    // legs sticking out
    g.fillStyle = C.bunny;
    for (const [lx, ly, r] of [
      [4, 6, 0.6],
      [-6, 6, -0.4],
      [-8, 5, 0.2],
    ] as const) {
      ellipse(g, lx, ly + 2, 2, 3.4, r);
      g.fill();
    }
    g.fillStyle = C.bunny;
    ellipse(g, 10, -1, 5.5, 5);
    g.fill();
    g.fillStyle = C.bunnyEar;
    ellipse(g, 12, -6, 5.5, 1.6, 0.5);
    g.fill();
    ellipse(g, 15, -2, 5.5, 1.6, 0.15);
    g.fill();
    // closed eye
    g.strokeStyle = '#8a2030';
    g.lineWidth = 0.6;
    g.beginPath();
    g.arc(12, 0, 1.1, 0, Math.PI);
    g.stroke();
    g.restore();
    // dizzy stars
    for (let i = 0; i < 3; i++) {
      const a = p.t * 3 + (i * Math.PI * 2) / 3;
      drawStar(g, x + Math.cos(a) * 9, y - 12 + Math.sin(a) * 3, 2.2, '#ffd43a');
    }
    return;
  }
  g.rotate(angle);
  const hopUp = p.running ? Math.sin(p.hop * Math.PI) : 0;
  const stretch = p.running ? 1 + hopUp * 0.22 : 1;
  const sc = p.scale * (1 + hopUp * 0.1);
  g.scale(sc, sc);
  // shadow stays on the ground, smaller when airborne
  g.fillStyle = `rgba(30,15,5,${0.32 - hopUp * 0.12})`;
  ellipse(g, 1 + hopUp * 3, 2.5 + hopUp * 4, 12 * stretch * (1 - hopUp * 0.15), 7.5 * (1 - hopUp * 0.15));
  g.fill();
  g.save();
  g.scale(stretch, 1 / Math.sqrt(stretch));
  // feet
  if (p.running) {
    g.fillStyle = C.bunnyShade;
    const f = hopUp;
    ellipse(g, -9 - f * 3, -4.5, 4.2, 1.8);
    g.fill();
    ellipse(g, -9 - f * 3, 4.5, 4.2, 1.8);
    g.fill();
    ellipse(g, 5 + f * 3, -3, 2, 1.3);
    g.fill();
    ellipse(g, 5 + f * 3, 3, 2, 1.3);
    g.fill();
  } else {
    g.fillStyle = C.bunnyShade;
    ellipse(g, -6, -6.4, 4, 1.8);
    g.fill();
    ellipse(g, -6, 6.4, 4, 1.8);
    g.fill();
  }
  // body
  const bg = g.createRadialGradient(-3, -3, 1, -1, 0, 12);
  bg.addColorStop(0, '#ffffff');
  bg.addColorStop(1, C.bunnyShade);
  g.fillStyle = bg;
  ellipse(g, -2, 0, p.eating ? 9.5 : 10.5, p.eating ? 7.6 : 7);
  g.fill();
  // fluffy tail
  g.fillStyle = '#ffffff';
  ellipse(g, -12, 0, 2.8, 2.8);
  g.fill();
  g.strokeStyle = 'rgba(180,180,175,0.6)';
  g.lineWidth = 0.4;
  g.stroke();
  g.restore();
  // head
  const chew = p.eating ? Math.sin(p.t * 22) * 0.6 : 0;
  const hx = (p.eating ? 8.5 : 9.5) * stretch;
  g.fillStyle = C.bunny;
  ellipse(g, hx, 0, 5.4 + chew * 0.2, 4.8);
  g.fill();
  // ears: laid back while running, up and twitching while eating
  const earA = p.running ? 0.12 : p.eating ? 0.35 + Math.sin(p.t * 3) * 0.08 : 0.3;
  const earL = p.running ? 8.5 : 7;
  for (const side of [-1, 1]) {
    g.save();
    g.translate(hx - 2, side * 2.2);
    g.rotate(Math.PI + side * -earA);
    g.fillStyle = C.bunny;
    ellipse(g, earL / 2, 0, earL / 2 + 0.6, 2.1);
    g.fill();
    g.fillStyle = C.bunnyEar;
    ellipse(g, earL / 2 + 0.3, 0, earL / 2 - 0.5, 1.15);
    g.fill();
    g.restore();
  }
  // red eyes
  g.fillStyle = C.bunnyEye;
  ellipse(g, hx + 1.2, -3.4, 1.1, 0.9);
  g.fill();
  ellipse(g, hx + 1.2, 3.4, 1.1, 0.9);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.8)';
  ellipse(g, hx + 1.5, -3.6, 0.35, 0.3);
  g.fill();
  // pink nose
  g.fillStyle = '#e88a9a';
  ellipse(g, hx + 5.2 + chew * 0.3, 0, 0.9, 1.1);
  g.fill();
  // whiskers
  g.strokeStyle = 'rgba(120,120,120,0.5)';
  g.lineWidth = 0.25;
  g.beginPath();
  for (const s of [-1, 1]) {
    g.moveTo(hx + 4.5, s * 0.8);
    g.lineTo(hx + 8, s * 3);
    g.moveTo(hx + 4.5, s * 0.8);
    g.lineTo(hx + 8.5, s * 1.5);
  }
  g.stroke();
  g.restore();
}

export function drawStar(g: Ctx, x: number, y: number, r: number, color: string) {
  g.fillStyle = color;
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? r * 0.45 : r;
    g.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  g.closePath();
  g.fill();
}

// ------------------------------------------------------------------ particles

export interface Particle {
  kind: 'dust' | 'crumb' | 'heart' | 'confetti';
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  r: number;
  color: string;
  rot: number;
}

export function stepParticles(ps: Particle[], dt: number) {
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i];
    p.life -= dt;
    if (p.life <= 0) {
      ps.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const drag = p.kind === 'dust' ? 3 : 1.5;
    p.vx *= Math.exp(-drag * dt);
    p.vy *= Math.exp(-drag * dt);
    if (p.kind === 'confetti') p.vy += 40 * dt;
    p.rot += dt * 5;
  }
}

export function drawParticles(g: Ctx, ps: Particle[]) {
  for (const p of ps) {
    const k = p.life / p.max;
    if (p.kind === 'dust') {
      g.fillStyle = `rgba(225,195,155,${0.5 * k})`;
      ellipse(g, p.x, p.y, p.r * (1.6 - k * 0.6), p.r * (1.6 - k * 0.6));
      g.fill();
    } else if (p.kind === 'crumb') {
      g.fillStyle = p.color;
      g.globalAlpha = Math.min(1, k * 2);
      ellipse(g, p.x, p.y, p.r, p.r * 0.6, p.rot);
      g.fill();
      g.globalAlpha = 1;
    } else if (p.kind === 'confetti') {
      g.save();
      g.globalAlpha = Math.min(1, k * 2);
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      g.fillStyle = p.color;
      g.fillRect(-p.r, -p.r * 0.4, p.r * 2, p.r * 0.8);
      g.restore();
    } else {
      g.globalAlpha = Math.min(1, k * 2);
      drawStar(g, p.x, p.y, p.r, p.color);
      g.globalAlpha = 1;
    }
  }
}
