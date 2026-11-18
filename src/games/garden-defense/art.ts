/**
 * Garden Defense art: Japanese watercolor washes on paper, with the bunnies and the watering can drawn as
 * jointed cut-paper puppets (separate paper pieces pinned at the joints). Everything is drawn in code.
 */
import { mulberry32, type Bunny, type Plant, type Rng, TUNING } from './sim';

export type Pt = [number, number];

// ---------------------------------------------------------------- layout

export interface Layout {
  W: number;
  H: number;
  /** Scale relative to a 390 px wide phone. */
  s: number;
  wallTop: number;
  /** Where the wall meets the plant bed (plants are rooted just below). */
  soilY: number;
  plantBaseY: number;
  fenceTop: number;
  fenceBottom: number;
  groundTop: number;
  groundRange: number;
  plantMaxH: number;
}

export function makeLayout(W: number, H: number): Layout {
  const s = Math.min(W / 390, H / 700);
  const soilY = Math.round(H * 0.545);
  const fenceBottom = soilY + 40 * s;
  const fenceH = 22 * s;
  const groundTop = fenceBottom + 6 * s;
  return {
    W,
    H,
    s,
    wallTop: Math.round(H * 0.13),
    soilY,
    plantBaseY: soilY + 14 * s,
    fenceTop: fenceBottom - fenceH,
    fenceBottom,
    groundTop,
    groundRange: H - groundTop - 70 * s,
    plantMaxH: Math.min(H * 0.25, 215 * s),
  };
}

/** Screen y of a bunny's feet for depth d. */
export function depthY(L: Layout, d: number) {
  if (d >= 0) return L.groundTop + 18 * L.s + d * L.groundRange;
  return L.groundTop + 18 * L.s + d * 360 * L.s;
}
export function bunnyScale(L: Layout, d: number) {
  return L.s * (1.3 + 0.45 * Math.max(0, d));
}

// ---------------------------------------------------------------- helpers

const TAU = Math.PI * 2;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** A rough ellipse: n points with a little jitter, like paper cut with scissors. */
export function blob(cx: number, cy: number, rx: number, ry: number, rng: Rng, n = 18, rough = 0.06, rot = 0): Pt[] {
  const pts: Pt[] = [];
  const c = Math.cos(rot);
  const sn = Math.sin(rot);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const k = 1 + (rng() - 0.5) * 2 * rough;
    const x = Math.cos(a) * rx * k;
    const y = Math.sin(a) * ry * k;
    pts.push([cx + x * c - y * sn, cy + x * sn + y * c]);
  }
  return pts;
}

function trace(ctx: CanvasRenderingContext2D, pts: Pt[]) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

/** Smooth closed curve through points (for washes). */
function traceSmooth(ctx: CanvasRenderingContext2D, pts: Pt[]) {
  const n = pts.length;
  ctx.beginPath();
  const m0: Pt = [(pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2];
  ctx.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % n];
    ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
  }
  ctx.closePath();
}

function jitterPts(pts: Pt[], amt: number, rng: Rng): Pt[] {
  return pts.map(([x, y]) => [x + (rng() - 0.5) * 2 * amt, y + (rng() - 0.5) * 2 * amt]);
}

/** A watercolor wash: several translucent passes with wandering edges and a darker pigment rim. */
function wash(ctx: CanvasRenderingContext2D, pts: Pt[], rgb: string, alpha: number, rng: Rng, spread = 3, passes = 4, rim = 0.5) {
  for (let i = 0; i < passes; i++) {
    traceSmooth(ctx, jitterPts(pts, spread, rng));
    ctx.fillStyle = `rgba(${rgb},${alpha / passes + 0.02})`;
    ctx.fill();
  }
  if (rim > 0) {
    traceSmooth(ctx, jitterPts(pts, spread * 0.5, rng));
    ctx.strokeStyle = `rgba(${rgb},${alpha * rim})`;
    ctx.lineWidth = 1.1;
    ctx.stroke();
  }
}

/** A jagged band polygon between two wavy horizontal lines. */
function band(x0: number, x1: number, yTop: number, yBot: number, rng: Rng, wob: number, step = 18): Pt[] {
  const top: Pt[] = [];
  const bot: Pt[] = [];
  for (let x = x0; x <= x1 + step; x += step) {
    top.push([x, yTop + (rng() - 0.5) * wob]);
    bot.push([x, yBot + (rng() - 0.5) * wob]);
  }
  return [...top, ...bot.reverse()];
}

// ---------------------------------------------------------------- paper texture

let grainCanvas: HTMLCanvasElement | null = null;
function grain(): HTMLCanvasElement {
  if (grainCanvas) return grainCanvas;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const img = g.createImageData(256, 256);
  const rng = mulberry32(77);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 228 + rng() * 27;
    img.data[i] = v;
    img.data[i + 1] = v - 4;
    img.data[i + 2] = v - 12;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // Fibres.
  for (let i = 0; i < 260; i++) {
    const x = rng() * 256;
    const y = rng() * 256;
    const a = rng() * TAU;
    const l = 4 + rng() * 14;
    g.strokeStyle = `rgba(${rng() < 0.5 ? '120,100,70' : '255,255,250'},${0.12 + rng() * 0.15})`;
    g.lineWidth = 0.6;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a + 0.5) * l * 0.5, y + Math.sin(a + 0.5) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  grainCanvas = c;
  return c;
}

let paperPat: CanvasPattern | null = null;
let paperPatCtx: CanvasRenderingContext2D | null = null;
function paperPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (paperPat && paperPatCtx === ctx) return paperPat;
  paperPat = ctx.createPattern(grain(), 'repeat');
  paperPatCtx = ctx;
  return paperPat;
}

// ---------------------------------------------------------------- background

/** Paints the static scene (sky, wall, bed, yard, hose) into ctx at layout size. */
export function paintBackground(ctx: CanvasRenderingContext2D, L: Layout) {
  const { W, H, s } = L;
  const rng = mulberry32(2024);
  ctx.fillStyle = '#f2ead9';
  ctx.fillRect(0, 0, W, H);

  // Sky: pale washes above the wall.
  const sky = ctx.createLinearGradient(0, 0, 0, L.wallTop);
  sky.addColorStop(0, '#d9e3e2');
  sky.addColorStop(1, '#efe6d6');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, L.wallTop + 6);
  wash(ctx, band(-20, W + 20, -20, L.wallTop * 0.6, rng, 16), '178,204,214', 0.35, rng, 8, 3, 0);
  wash(ctx, blob(W * 0.75, L.wallTop * 0.4, W * 0.35, L.wallTop * 0.35, rng, 14, 0.2), '230,214,200', 0.35, rng, 8, 3, 0);

  // Wall: cream render, layered washes.
  wash(ctx, band(-20, W + 20, L.wallTop, L.soilY + 6, rng, 6 * s), '233,220,194', 0.85, rng, 3, 4, 0.25);
  for (let i = 0; i < 7; i++) {
    const y = lerp(L.wallTop + 20 * s, L.soilY - 40 * s, rng());
    wash(
      ctx,
      blob(rng() * W, y, (60 + rng() * 120) * s, (14 + rng() * 26) * s, rng, 14, 0.25),
      rng() < 0.5 ? '222,204,176' : '240,228,206',
      0.35,
      rng,
      6,
      3,
      0.3,
    );
  }
  // Wall cap line.
  wash(ctx, band(-20, W + 20, L.wallTop - 3 * s, L.wallTop + 5 * s, rng, 2 * s, 24), '190,170,140', 0.55, rng, 1.5, 3, 0.4);
  // Dirt splash stain along the bottom of the wall (like the photos).
  wash(ctx, band(-20, W + 20, L.soilY - 60 * s, L.soilY + 4, rng, 10 * s, 12), '176,128,96', 0.22, rng, 8, 4, 0);
  wash(ctx, band(-20, W + 20, L.soilY - 24 * s, L.soilY + 4, rng, 6 * s, 10), '150,104,76', 0.25, rng, 4, 3, 0);
  // Dappled leaf shadows from the tree on the wall.
  for (let k = 0; k < 2; k++) {
    const cx = [W * 0.62, W * 0.9][k];
    const cy = L.wallTop + (40 + 50 * k) * s;
    for (let i = 0; i < 10; i++) {
      wash(
        ctx,
        blob(cx + (rng() - 0.5) * 110 * s, cy + (rng() - 0.5) * 70 * s, (5 + rng() * 9) * s, (3 + rng() * 5) * s, rng, 10, 0.25, rng() * TAU),
        '128,136,170',
        0.05,
        rng,
        1.5,
        2,
        0,
      );
    }
  }

  // Ink branch reaching in from the top-left corner (the yard tree).
  ctx.save();
  ctx.lineCap = 'round';
  const branch = (x0: number, y0: number, x1: number, y1: number, w: number) => {
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = `rgba(50,40,34,${0.35 + i * 0.12})`;
      ctx.lineWidth = w * (1 - i * 0.28);
      ctx.beginPath();
      ctx.moveTo(x0 + (rng() - 0.5), y0 + (rng() - 0.5));
      ctx.quadraticCurveTo((x0 + x1) / 2 + 8 * s, (y0 + y1) / 2 - 10 * s, x1, y1);
      ctx.stroke();
    }
  };
  branch(-10, L.wallTop * 0.55, W * 0.36, L.wallTop * 0.35, 6 * s);
  branch(W * 0.18, L.wallTop * 0.48, W * 0.3, L.wallTop * 0.85, 3 * s);
  branch(W * 0.3, L.wallTop * 0.38, W * 0.48, L.wallTop * 0.5, 2.5 * s);
  ctx.restore();
  for (let i = 0; i < 26; i++) {
    const t = rng();
    const x = lerp(0, W * 0.5, t) + (rng() - 0.5) * 30 * s;
    const y = lerp(L.wallTop * 0.55, L.wallTop * 0.4, t) + (rng() - 0.5) * 34 * s;
    const pts = leafShape(x, y, (8 + rng() * 6) * s, (3 + rng() * 2) * s, rng() * TAU);
    wash(ctx, pts, rng() < 0.6 ? '86,120,80' : '120,140,84', 0.5, rng, 0.8, 2, 0.6);
  }

  // Plant bed: dark soil.
  wash(ctx, band(-20, W + 20, L.soilY - 2 * s, L.fenceBottom + 6 * s, rng, 6 * s, 14), '104,72,50', 0.9, rng, 3, 4, 0.4);
  for (let i = 0; i < 40; i++) {
    wash(
      ctx,
      blob(rng() * W, lerp(L.soilY + 4 * s, L.fenceBottom, rng()), (6 + rng() * 16) * s, (2 + rng() * 4) * s, rng, 10, 0.3),
      rng() < 0.5 ? '70,48,34' : '140,104,74',
      0.35,
      rng,
      2,
      2,
      0,
    );
  }

  // Yard: packed dirt.
  wash(ctx, band(-20, W + 20, L.fenceBottom - 2 * s, H + 20, rng, 8 * s, 20), '178,140,104', 0.75, rng, 4, 4, 0);
  for (let i = 0; i < 34; i++) {
    const y = lerp(L.groundTop, H, rng());
    wash(ctx, blob(rng() * W, y, (20 + rng() * 60) * s, (5 + rng() * 12) * s, rng, 12, 0.3), rng() < 0.5 ? '150,110,78' : '200,170,130', 0.3, rng, 5, 3, 0);
  }
  // Gravel.
  for (let i = 0; i < 160; i++) {
    const y = lerp(L.groundTop, H, Math.pow(rng(), 0.8));
    ctx.fillStyle = `rgba(${rng() < 0.5 ? '110,86,66' : '230,214,190'},${0.35 + rng() * 0.3})`;
    traceSmooth(ctx, blob(rng() * W, y, (1 + rng() * 2) * s, (0.8 + rng() * 1.4) * s, rng, 6, 0.3));
    ctx.fill();
  }
  // Dry fallen leaves.
  for (let i = 0; i < 26; i++) {
    const x = rng() * W;
    const y = lerp(L.groundTop + 10 * s, H - 10 * s, rng());
    const col = ['196,150,74', '170,112,60', '150,128,80', '120,96,60'][Math.floor(rng() * 4)];
    const pts = leafShape(x, y, (10 + rng() * 9) * s, (4 + rng() * 3) * s, rng() * TAU);
    wash(ctx, pts, col, 0.55, rng, 0.8, 2, 0.7);
  }

  // The teal garden hose snaking across the yard.
  const hose: Pt[] = [
    [W + 20, H * 0.72],
    [W * 0.8, H * 0.7],
    [W * 0.62, H * 0.8],
    [W * 0.42, H * 0.76],
    [W * 0.26, H * 0.86],
    [W * 0.05, H * 0.83],
    [-20, H * 0.9],
  ];
  const strokeHose = (w: number, col: string, dy = 0) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(hose[0][0], hose[0][1] + dy);
    for (let i = 1; i < hose.length - 1; i++) {
      const p = hose[i];
      const q = hose[i + 1];
      ctx.quadraticCurveTo(p[0], p[1] + dy, (p[0] + q[0]) / 2, (p[1] + q[1]) / 2 + dy);
    }
    ctx.lineTo(hose[hose.length - 1][0], hose[hose.length - 1][1] + dy);
    ctx.stroke();
  };
  strokeHose(9 * s, 'rgba(60,40,30,0.18)', 3 * s);
  strokeHose(8 * s, 'rgba(26,120,132,0.8)');
  strokeHose(5 * s, 'rgba(40,160,170,0.55)', -0.5 * s);
  strokeHose(1.6 * s, 'rgba(220,250,250,0.5)', -2 * s);

  // Warm vignette at the paper edges.
  const g = ctx.createRadialGradient(W / 2, H * 0.5, Math.min(W, H) * 0.35, W / 2, H * 0.5, Math.max(W, H) * 0.75);
  g.addColorStop(0, 'rgba(120,80,40,0)');
  g.addColorStop(1, 'rgba(120,80,40,0.22)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Paper grain over everything.
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = paperPattern(ctx) ?? '#fff';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/** The low green wire fence in front of the bed (drawn above the bed but below yard bunnies). */
export function paintFence(ctx: CanvasRenderingContext2D, L: Layout) {
  const { W, s } = L;
  const rng = mulberry32(99);
  ctx.save();
  ctx.lineCap = 'round';
  const top = L.fenceTop;
  const bot = L.fenceBottom;
  const wob = (y: number) => y + (rng() - 0.5) * 1.2 * s;
  // Shadow on the soil.
  ctx.strokeStyle = 'rgba(50,30,20,0.18)';
  ctx.lineWidth = 3 * s;
  ctx.beginPath();
  ctx.moveTo(0, bot + 3 * s);
  ctx.lineTo(W, bot + 3 * s);
  ctx.stroke();
  // Grid.
  const cell = 11 * s;
  for (let x = -4 * s; x < W + cell; x += cell) {
    ctx.strokeStyle = `rgba(36,104,76,${0.55 + rng() * 0.25})`;
    ctx.lineWidth = 1.2 * s;
    ctx.beginPath();
    ctx.moveTo(x + (rng() - 0.5) * s, wob(top));
    ctx.lineTo(x + (rng() - 0.5) * s, wob(bot));
    ctx.stroke();
  }
  for (let k = 0; k <= 3; k++) {
    const y = lerp(top, bot, k / 3);
    ctx.strokeStyle = `rgba(36,104,76,${0.6 + rng() * 0.2})`;
    ctx.lineWidth = (k === 0 ? 1.8 : 1.2) * s;
    ctx.beginPath();
    ctx.moveTo(-4, wob(y));
    for (let x = 0; x <= W + 30; x += 30 * s) ctx.lineTo(x, wob(y));
    ctx.stroke();
  }
  // Posts.
  for (let x = 30 * s; x < W; x += 110 * s) {
    ctx.strokeStyle = 'rgba(30,80,60,0.85)';
    ctx.lineWidth = 2.4 * s;
    ctx.beginPath();
    ctx.moveTo(x, top - 5 * s);
    ctx.lineTo(x + 0.5 * s, bot + 2 * s);
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- plants

export function leafShape(x: number, y: number, len: number, w: number, ang: number): Pt[] {
  const pts: Pt[] = [];
  const n = 10;
  const c = Math.cos(ang);
  const sn = Math.sin(ang);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const lx = t * len;
    const ly = Math.sin(Math.PI * Math.pow(t, 0.8)) * w;
    pts.push([x + lx * c - ly * sn, y + lx * sn + ly * c]);
  }
  for (let i = n - 1; i > 0; i--) {
    const t = i / n;
    const lx = t * len;
    const ly = -Math.sin(Math.PI * Math.pow(t, 0.8)) * w;
    pts.push([x + lx * c - ly * sn, y + lx * sn + ly * c]);
  }
  return pts;
}

interface LeafSlot {
  stem: number;
  t: number;
  side: number;
  len: number;
  w: number;
  spread: number;
}
export interface PlantShape {
  stems: { lean: number; len: number; bend: number; dx: number }[];
  slots: LeafSlot[];
  tint: number;
  seed: number;
}

export function makePlantShape(i: number): PlantShape {
  const rng = mulberry32(500 + i * 31);
  const stems = [
    { lean: -0.12 - rng() * 0.05, len: 0.8 + rng() * 0.1, bend: -0.16, dx: -3 },
    { lean: (rng() - 0.5) * 0.06, len: 1, bend: 0.06 * (rng() - 0.5), dx: 0 },
    { lean: 0.12 + rng() * 0.05, len: 0.84 + rng() * 0.1, bend: 0.16, dx: 3 },
  ];
  const slots: LeafSlot[] = [];
  for (let k = 0; k < TUNING.maxLeaves; k++) {
    const stem = [1, 0, 2][k % 3];
    const t = 0.12 + (k / (TUNING.maxLeaves - 1)) * 0.84;
    slots.push({ stem, t, side: k % 2 ? 1 : -1, len: 22 + rng() * 4 - k * 0.5, w: 16 + rng() * 3 - k * 0.3, spread: 0.55 + rng() * 0.25 });
  }
  return { stems, slots, tint: [0.15, 0.85, 0.35, 0.95, 0.55][i % 5], seed: 900 + i };
}

function stemPoint(bx: number, by: number, st: PlantShape['stems'][number], H: number, t: number): { x: number; y: number; ang: number } {
  const len = st.len * H;
  const x1 = bx + st.dx + Math.sin(st.lean) * len;
  const y1 = by - Math.cos(st.lean) * len;
  const cx = bx + st.dx + Math.sin(st.lean + st.bend) * len * 0.5;
  const cy = by - Math.cos(st.lean + st.bend) * len * 0.55;
  const u = 1 - t;
  const x = u * u * (bx + st.dx) + 2 * u * t * cx + t * t * x1;
  const y = u * u * by + 2 * u * t * cy + t * t * y1;
  const dx = 2 * u * (cx - bx - st.dx) + 2 * t * (x1 - cx);
  const dy = 2 * u * (cy - by) + 2 * t * (y1 - cy);
  return { x, y, ang: Math.atan2(dy, dx) };
}

/** Where the can should pour for plant i (top of its foliage). */
export function plantTop(L: Layout, p: Plant, shape: PlantShape) {
  const n = Math.max(1, p.leaves);
  const t = shape.slots[Math.min(n, shape.slots.length) - 1].t;
  return { x: p.x * L.W, y: L.plantBaseY - t * L.plantMaxH * 0.95 - 20 * L.s };
}

export function drawPlant(ctx: CanvasRenderingContext2D, L: Layout, p: Plant, shape: PlantShape, appear: number[], now: number, wobble: number, danger = 0) {
  const bx = p.x * L.W;
  const by = L.plantBaseY;
  const H = L.plantMaxH;
  const s = L.s;
  const rng = mulberry32(shape.seed);

  // Each plant sits in its own little soil mound ringed with pebbles.
  const mound = blob(bx, by + 4 * s, 30 * s, 11 * s, rng, 16, 0.08);
  wash(
    ctx,
    mound.map(([x, y]) => [x, Math.min(y, by + 6 * s)] as Pt),
    '84,56,38',
    0.85,
    rng,
    1,
    2,
    0.5,
  );
  wash(ctx, blob(bx - 4 * s, by - 2 * s, 16 * s, 4 * s, rng, 12, 0.1), '150,112,80', 0.35, rng, 1, 2, 0);
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (0.05 + (i / 6) * 0.9);
    const px = bx - Math.cos(a) * 31 * s;
    const py = by + 6 * s - Math.sin(a) * 3 * s + 2 * s;
    traceSmooth(ctx, blob(px, py, 3.4 * s, 2.2 * s, rng, 8, 0.2));
    ctx.fillStyle = i % 2 ? 'rgba(206,190,166,0.9)' : 'rgba(170,156,136,0.9)';
    ctx.fill();
  }

  // Wet soil spot.
  if (p.moisture > 0.02) {
    ctx.fillStyle = `rgba(60,38,26,${0.35 * p.moisture})`;
    traceSmooth(ctx, blob(bx, by + 6 * s, 30 * s, 7 * s, rng, 12, 0.15));
    ctx.fill();
  }

  if (danger > 0 && p.alive) {
    // A pulsing red wash behind a plant that is about to be eaten bare.
    const r = 52 * s;
    const g = ctx.createRadialGradient(bx, by - 26 * s, 0, bx, by - 26 * s, r);
    const al = danger * (0.16 + 0.1 * Math.sin(now * 8));
    g.addColorStop(0, `rgba(196,64,44,${al})`);
    g.addColorStop(1, 'rgba(196,64,44,0)');
    ctx.fillStyle = g;
    ctx.fillRect(bx - r, by - 26 * s - r, r * 2, r * 2);
  }
  if (!p.alive) {
    drawDeadPlant(ctx, L, bx, by, shape, now - p.diedAt);
    return;
  }

  const visible = p.leaves;
  const topT = visible > 0 ? shape.slots[visible - 1].t : 0.1;
  const sway = Math.sin(now * 1.3 + shape.seed) * 0.015 + wobble;

  // Ink stems (sumi brush): drawn up to just above the highest leaf.
  ctx.save();
  ctx.lineCap = 'round';
  shape.stems.forEach((st, si) => {
    const maxT = Math.min(1, topT / st.len + 0.06);
    const segs = 10;
    for (let pass = 0; pass < 2; pass++) {
      ctx.beginPath();
      for (let k = 0; k <= segs; k++) {
        const t = (k / segs) * maxT;
        const q = stemPoint(bx, by, { ...st, lean: st.lean + sway * t }, H, t);
        if (k === 0) ctx.moveTo(q.x, q.y);
        else ctx.lineTo(q.x, q.y);
      }
      ctx.strokeStyle = pass === 0 ? 'rgba(70,58,40,0.35)' : 'rgba(54,44,32,0.8)';
      ctx.lineWidth = (pass === 0 ? 4 : 2.1 - si * 0.2) * s;
      ctx.stroke();
    }
  });
  ctx.restore();

  // Leaf colour: sage green, brighter when watered, yellowing when nearly bare.
  const m = p.moisture;
  const weak = clamp01((4 - visible) / 4);
  const baseR = lerp(lerp(124, 92, m), 170, weak * 0.6);
  const baseG = lerp(lerp(150, 158, m), 158, weak * 0.3);
  const baseB = lerp(lerp(112, 104, m), 90, weak * 0.6);
  const tint = (shape.tint - 0.5) * 34;

  for (let k = 0; k < visible; k++) {
    const sl = shape.slots[k];
    const st = shape.stems[sl.stem];
    const t = Math.min(1, sl.t / st.len);
    const q = stemPoint(bx, by, { ...st, lean: st.lean + sway * t }, H, t);
    const grow = clamp01((now - (appear[k] ?? -10)) / 0.4);
    const sc = (0.25 + 0.75 * (1 - Math.pow(1 - grow, 3))) * s;
    for (let j = 0; j < 2; j++) {
      const ang = q.ang + (j ? -sl.side : sl.side) * sl.spread * (j ? 0.85 : 1) + Math.sin(now * 2 + k + j) * 0.03;
      const len = sl.len * (j ? 0.82 : 1);
      const pts = leafShape(q.x, q.y, len * sc, sl.w * sc * (j ? 0.42 : 0.5), ang);
      const r = Math.round(baseR + tint + (k % 3) * 6);
      const g = Math.round(baseG - (k % 2) * 8);
      const b = Math.round(baseB + tint * 0.5);
      // Bleed, body, pigment rim, vein.
      traceSmooth(
        ctx,
        pts.map(([x, y]) => [x + 0.8 * s, y + 0.6 * s] as Pt),
      );
      ctx.fillStyle = `rgba(${r - 20},${g - 20},${b - 20},0.22)`;
      ctx.fill();
      traceSmooth(ctx, pts);
      ctx.fillStyle = `rgba(${r},${g},${b},0.78)`;
      ctx.fill();
      ctx.strokeStyle = `rgba(${r - 50},${g - 50},${b - 45},0.5)`;
      ctx.lineWidth = 0.9 * s;
      ctx.stroke();
      ctx.strokeStyle = `rgba(240,245,230,0.35)`;
      ctx.lineWidth = 0.7 * s;
      ctx.beginPath();
      ctx.moveTo(q.x, q.y);
      ctx.lineTo(q.x + Math.cos(ang) * len * sc * 0.8, q.y + Math.sin(ang) * len * sc * 0.8);
      ctx.stroke();
    }
  }
}

function drawDeadPlant(ctx: CanvasRenderingContext2D, L: Layout, bx: number, by: number, shape: PlantShape, since: number) {
  const s = L.s;
  const droop = clamp01(since / 1.2);
  ctx.save();
  ctx.lineCap = 'round';
  shape.stems.forEach((st, si) => {
    const len = (34 + (si === 1 ? 14 : 0)) * s * (1 - droop * 0.25);
    const a0 = st.lean * (1 + droop * 1.6);
    const x1 = bx + st.dx + Math.sin(a0) * len;
    const y1 = by - Math.cos(a0) * len;
    ctx.strokeStyle = 'rgba(96,74,50,0.85)';
    ctx.lineWidth = 2.2 * s;
    ctx.beginPath();
    ctx.moveTo(bx + st.dx, by);
    ctx.quadraticCurveTo(bx + st.dx + Math.sin(a0) * len * 0.3, by - len * 0.7, x1, y1 + droop * 6 * s);
    ctx.stroke();
    // A curled brown leaf.
    const pts = leafShape(x1, y1 + droop * 6 * s, 13 * s, 4.5 * s, a0 + Math.PI * 0.5 + droop);
    traceSmooth(ctx, pts);
    ctx.fillStyle = 'rgba(150,108,60,0.7)';
    ctx.fill();
  });
  ctx.restore();
}

// ---------------------------------------------------------------- cut-paper puppets

interface Piece {
  polys: Pt[][];
  fill: string;
  /** Extra patches clipped to this piece. */
  patches?: { pts: Pt[]; fill: string }[];
}

function paperPiece(ctx: CanvasRenderingContext2D, pc: Piece, shadow = true) {
  if (shadow) {
    ctx.save();
    ctx.translate(1.3, 1.9);
    ctx.fillStyle = 'rgba(50,32,18,0.28)';
    for (const p of pc.polys) {
      trace(ctx, p);
      ctx.fill();
    }
    ctx.restore();
  }
  for (const p of pc.polys) {
    trace(ctx, p);
    ctx.fillStyle = pc.fill;
    ctx.fill();
  }
  if (pc.patches) {
    ctx.save();
    ctx.beginPath();
    for (const p of pc.polys) {
      ctx.moveTo(p[0][0], p[0][1]);
      for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]);
      ctx.closePath();
    }
    ctx.clip();
    for (const pt of pc.patches) {
      trace(ctx, pt.pts);
      ctx.fillStyle = pt.fill;
      ctx.fill();
    }
    ctx.restore();
  }
  // Paper fibre texture and a light cut edge.
  const pat = paperPattern(ctx);
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.3;
  if (pat) ctx.fillStyle = pat;
  for (const p of pc.polys) {
    trace(ctx, p);
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 0.7;
  for (const p of pc.polys) {
    trace(ctx, p);
    ctx.stroke();
  }
}

function pin(ctx: CanvasRenderingContext2D, x: number, y: number, r = 1.5) {
  ctx.fillStyle = 'rgba(40,30,20,0.35)';
  ctx.beginPath();
  ctx.arc(x + 0.5, y + 0.6, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#b8924e';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,240,200,0.8)';
  ctx.beginPath();
  ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.4, 0, TAU);
  ctx.fill();
}

export type BunnyKind = 'white' | 'dutch' | 'grey';
export const BUNNY_KINDS: BunnyKind[] = ['white', 'dutch', 'grey'];

interface BunnyPuppet {
  kind: BunnyKind;
  size: number;
  tail: Piece;
  hind: Piece;
  hindFar: Piece;
  body: Piece;
  front: Piece;
  frontFar: Piece;
  head: Piece;
  earNear: Piece;
  earFar: Piece;
  eye: string;
}

const FUR = '#f6f2ea';
const FUR_FAR = '#ddd6c8';
const BLACK = '#211d1b';
const BLACK_FAR = '#151210';
const GREY = '#80838b';
const GREY_FAR = '#686a71';
const PINK = '#eeb0b8';

export function makeBunnyPuppet(kind: BunnyKind, seed: number): BunnyPuppet {
  const rng = mulberry32(seed);
  const dark = kind === 'dutch' ? BLACK : kind === 'grey' ? GREY : FUR;
  const darkFar = kind === 'dutch' ? BLACK_FAR : kind === 'grey' ? GREY_FAR : FUR_FAR;
  const earFill = kind === 'white' ? FUR : dark;

  // Body-frame coordinates (facing right, origin at body centre).
  const bodyPatches: { pts: Pt[]; fill: string }[] = [];
  if (kind === 'dutch') bodyPatches.push({ pts: blob(-14, 0, 14, 18, rng, 14, 0.08), fill: BLACK });
  if (kind === 'grey') {
    bodyPatches.push({ pts: blob(-6, -10, 14, 7, rng, 14, 0.15), fill: GREY });
    bodyPatches.push({ pts: blob(-16, 2, 8, 10, rng, 12, 0.15), fill: GREY });
  }
  const headPatches: { pts: Pt[]; fill: string }[] = [];
  if (kind !== 'white') {
    headPatches.push({ pts: blob(4, -6, 12, 11, rng, 14, 0.05), fill: dark });
    // White blaze down the face and a white muzzle.
    const blaze: Pt[] =
      kind === 'dutch'
        ? [
            [9, -16],
            [14, -15],
            [19, -6],
            [17, 2],
            [9, 3],
            [8, -4],
          ]
        : [
            [11, -16],
            [14, -15],
            [18, -7],
            [17, 1],
            [11, 2],
            [11, -6],
          ];
    headPatches.push({ pts: blaze, fill: FUR });
  }
  const hindPatches =
    kind === 'dutch'
      ? [{ pts: blob(0, 0, 16, 16, rng, 10, 0.05), fill: BLACK }]
      : kind === 'grey'
        ? [{ pts: blob(-4, -2, 8, 7, rng, 10, 0.2), fill: GREY }]
        : undefined;

  const hindPolys = (): Pt[][] => [blob(-1, 3, 10, 8.5, rng, 14, 0.07), blob(3, 10, 9.5, 2.8, rng, 10, 0.08)];
  const earPts = (big: number) => blob(-1, -10 * big, 3.6, 11 * big, rng, 14, 0.06, -0.12);
  const big = kind === 'white' ? 1.1 : 1;

  return {
    kind,
    size: kind === 'white' ? 1.14 : kind === 'dutch' ? 0.98 : 1,
    tail: { polys: [blob(0, 0, 5.2, 4.8, rng, 12, 0.15)], fill: kind === 'dutch' ? '#2c2725' : FUR },
    hind: { polys: hindPolys(), fill: FUR, patches: hindPatches },
    hindFar: { polys: hindPolys(), fill: kind === 'dutch' ? BLACK_FAR : FUR_FAR },
    body: { polys: [blob(0, 0, 20, 13.5, rng, 20, 0.05)], fill: FUR, patches: bodyPatches },
    front: { polys: [blob(1, 6, 3.2, 7.5, rng, 10, 0.08)], fill: FUR },
    frontFar: { polys: [blob(1, 6, 3.2, 7.5, rng, 10, 0.08)], fill: FUR_FAR },
    head: { polys: [blob(6, -6, 10.5, 8.6, rng, 18, 0.05, -0.2)], fill: FUR, patches: headPatches },
    earNear: {
      polys: [earPts(big)],
      fill: earFill,
      patches: [{ pts: blob(0, -10 * big, 1.6, 8 * big, rng, 10, 0.08, -0.12), fill: kind === 'white' ? PINK : kind === 'dutch' ? '#3a2f2e' : '#9a8f94' }],
    },
    earFar: { polys: [earPts(big)], fill: darkFar },
    eye: kind === 'white' ? '#c0283a' : '#1a1210',
  };
}

export interface BunnyPose {
  bodyRot: number;
  hindRot: number;
  frontRot: number;
  headRot: number;
  earRot: number;
  earFarRot: number;
  lift: number;
  squash: number;
}

/** Works out the puppet's joint angles from the simulation state. */
export function bunnyPose(b: Bunny, now: number, biteAge: number, hopHeight: number): BunnyPose {
  const ph = (Math.sin(now * 0.7 + b.id * 2.1) + Math.sin(now * 1.9 + b.id)) * 0.5;
  const twitch = Math.max(0, Math.sin(now * 3.1 + b.id * 5) - 0.92) * 6;
  if (b.mode === 'hop' && b.hop > 0) {
    const h = b.hop;
    const sinh = Math.sin(Math.PI * h);
    return {
      bodyRot: -0.32 * Math.sin(TAU * h),
      hindRot: 0.95 * Math.sin(Math.PI * Math.min(1, h * 1.5)),
      frontRot: -0.9 * sinh,
      headRot: 0.12 * Math.sin(TAU * h),
      earRot: 0.4 * sinh,
      earFarRot: 0.5 * sinh,
      lift: sinh * hopHeight * (b.hopHigh ? 1.9 : 1),
      squash: 1 + 0.06 * sinh,
    };
  }
  if (b.mode === 'eat') {
    // Reared up, nibbling; jerks back with each bite.
    const jerk = Math.exp(-biteAge * 8);
    const chew = Math.sin(now * 22) * 0.04;
    return {
      bodyRot: -0.3 + jerk * 0.05,
      hindRot: -0.2,
      frontRot: -0.7 + chew * 3,
      headRot: 0.1 + chew - jerk * 0.25,
      earRot: -0.1 + twitch * 0.3 + jerk * 0.2,
      earFarRot: 0.05 + jerk * 0.25,
      lift: 0,
      squash: 1,
    };
  }
  // Resting: breathing, the odd ear twitch, and now and then a paw-wash.
  const groomCycle = (now * 0.23 + b.id * 0.37) % 1;
  const groom = groomCycle < 0.18 ? Math.sin((groomCycle / 0.18) * Math.PI) : 0;
  if (groom > 0) {
    const scrub = Math.sin(now * 16) * 0.12 * groom;
    return {
      bodyRot: -0.18 * groom,
      hindRot: -0.1 * groom,
      frontRot: (-1.6 + scrub * 2) * groom + 0.05,
      headRot: 0.15 + 0.45 * groom + scrub,
      earRot: 0.1 + 0.35 * groom,
      earFarRot: 0.2 + 0.3 * groom,
      lift: 0,
      squash: 1,
    };
  }
  return {
    bodyRot: 0.02 * ph,
    hindRot: 0,
    frontRot: 0.05,
    headRot: 0.15 + 0.06 * ph,
    earRot: 0.1 + twitch * 0.4,
    earFarRot: 0.2 + twitch * 0.2,
    lift: 0,
    squash: 1 + 0.02 * Math.sin(now * 4 + b.id),
  };
}

export function drawBunny(ctx: CanvasRenderingContext2D, pup: BunnyPuppet, x: number, y: number, scale: number, face: number, pose: BunnyPose, now: number) {
  const k = scale * pup.size;
  // Ground shadow.
  ctx.fillStyle = `rgba(60,38,24,${0.22 * Math.max(0.3, 1 - pose.lift / (40 * k))})`;
  ctx.beginPath();
  ctx.ellipse(x, y, 22 * k * (1 - Math.min(0.4, pose.lift / (80 * k))), 4.5 * k, 0, 0, TAU);
  ctx.fill();

  ctx.save();
  ctx.translate(x, y - pose.lift);
  ctx.scale(face * k, k);
  // Body centre sits above the feet.
  ctx.translate(0, -15);
  ctx.rotate(pose.bodyRot);
  ctx.scale(1, pose.squash);

  // Far side legs and ear first.
  ctx.save();
  ctx.translate(12, 5);
  ctx.rotate(pose.frontRot * 0.7 + 0.15);
  paperPiece(ctx, pup.frontFar, false);
  ctx.restore();
  ctx.save();
  ctx.translate(-8, 3);
  ctx.rotate(pose.hindRot * 0.8 + 0.1);
  paperPiece(ctx, pup.hindFar, false);
  ctx.restore();
  ctx.save();
  ctx.translate(15, -6);
  ctx.rotate(pose.headRot);
  ctx.translate(2, -11);
  ctx.rotate(pose.earFarRot - 0.15);
  paperPiece(ctx, pup.earFar, false);
  ctx.restore();

  // Tail.
  ctx.save();
  ctx.translate(-19, -4);
  paperPiece(ctx, pup.tail);
  ctx.restore();

  // Body.
  paperPiece(ctx, pup.body);

  // Hind leg (pinned at the hip).
  ctx.save();
  ctx.translate(-10, 4);
  ctx.rotate(pose.hindRot);
  paperPiece(ctx, pup.hind);
  pin(ctx, -1, 0);
  ctx.restore();

  // Front leg (pinned at the shoulder).
  ctx.save();
  ctx.translate(12, 4);
  ctx.rotate(pose.frontRot);
  paperPiece(ctx, pup.front);
  pin(ctx, 1, 1, 1.2);
  ctx.restore();

  // Head (pinned at the neck) with the near ear.
  ctx.save();
  ctx.translate(15, -6);
  ctx.rotate(pose.headRot);
  paperPiece(ctx, pup.head);
  // Eye, nose, whiskers.
  ctx.fillStyle = pup.eye;
  ctx.beginPath();
  ctx.ellipse(9.5, -8, 1.9, 2.2, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(10.1, -8.8, 0.6, 0, TAU);
  ctx.fill();
  const nose = Math.sin(now * 14 + pup.size * 10) * 0.4;
  ctx.fillStyle = '#d98a96';
  ctx.beginPath();
  ctx.ellipse(16.4, -3.4 + nose, 1.4, 1.1, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(60,50,45,0.45)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(15, -2.5);
  ctx.lineTo(23, -4.5 + nose);
  ctx.moveTo(15, -2);
  ctx.lineTo(22.5, -0.5 + nose);
  ctx.stroke();
  pin(ctx, 0, 0, 1.3);
  ctx.save();
  ctx.translate(2, -11);
  ctx.rotate(pose.earRot - 0.25);
  paperPiece(ctx, pup.earNear);
  pin(ctx, 0, 0, 1.2);
  ctx.restore();
  ctx.restore();

  ctx.restore();
}

// ---------------------------------------------------------------- watering can

export interface CanPuppet {
  body: Piece;
  handle: Piece;
  spout: Piece;
  rose: Piece;
}

export function makeCanPuppet(): CanPuppet {
  const rng = mulberry32(4242);
  const jag = (pts: Pt[]) => jitterPts(pts, 0.4, rng);
  return {
    body: {
      polys: [
        jag([
          [-15, -14],
          [15, -14],
          [17, -12],
          [18, 14],
          [15, 16],
          [-15, 16],
          [-18, 14],
          [-17, -12],
        ]),
      ],
      fill: '#3f8d5e',
      patches: [
        {
          pts: jag([
            [-18, -6],
            [18, -6],
            [18, -2],
            [-18, -2],
          ]),
          fill: '#357a50',
        },
        {
          pts: jag([
            [-12, -12],
            [-8, -12],
            [-8, 13],
            [-12, 13],
          ]),
          fill: 'rgba(255,255,255,0.18)',
        },
      ],
    },
    handle: {
      polys: [
        jag([
          [-8, -14],
          [-6, -25],
          [8, -27],
          [16, -18],
          [17, -12],
          [12, -12],
          [11, -17],
          [6, -21],
          [-2, -20],
          [-3, -14],
        ]),
      ],
      fill: '#367f53',
    },
    spout: {
      polys: [
        jag([
          [0, -2.6],
          [-30, -11],
          [-31, -6.5],
          [0, 3],
        ]),
      ],
      fill: '#3a8858',
    },
    rose: { polys: [blob(0, 0, 3.2, 6, rng, 10, 0.06)], fill: '#2f7046' },
  };
}

/** Draws the can at (x, y) tilted by `tilt` (negative tips the spout down). Returns the rose position. */
export function drawCan(ctx: CanvasRenderingContext2D, can: CanPuppet, x: number, y: number, scale: number, tilt: number, spoutWiggle: number): Pt {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.rotate(tilt);
  paperPiece(ctx, can.handle);
  // Spout pinned at the lower front of the body.
  ctx.save();
  ctx.translate(-14, 6);
  ctx.rotate(spoutWiggle);
  paperPiece(ctx, can.spout);
  ctx.save();
  ctx.translate(-31, -8.8);
  ctx.rotate(-0.5);
  paperPiece(ctx, can.rose);
  ctx.restore();
  ctx.restore();
  paperPiece(ctx, can.body);
  pin(ctx, -14, 6, 1.6);
  pin(ctx, -5, -20, 1.3);
  ctx.restore();
  // Rose position in screen space.
  const c = Math.cos(tilt);
  const sn = Math.sin(tilt);
  const cw = Math.cos(spoutWiggle);
  const sw = Math.sin(spoutWiggle);
  const lx = -14 + (-33 * cw - -8.8 * sw);
  const ly = 6 + (-33 * sw + -8.8 * cw);
  return [x + (lx * c - ly * sn) * scale, y + (lx * sn + ly * c) * scale];
}

// ---------------------------------------------------------------- particles

export interface Particle {
  kind: 'drop' | 'leaf' | 'dust' | 'splash';
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  life: number;
  max: number;
  color: string;
  floor: number;
}

export function drawParticles(ctx: CanvasRenderingContext2D, ps: Particle[], s: number) {
  for (const p of ps) {
    const a = clamp01(p.life / p.max);
    if (p.kind === 'drop') {
      ctx.fillStyle = `rgba(86,146,196,${0.65 * a})`;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 1.6 * s, 3 * s, Math.atan2(p.vy, p.vx) - Math.PI / 2, 0, TAU);
      ctx.fill();
    } else if (p.kind === 'leaf') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = a;
      traceSmooth(ctx, leafShape(-5 * s, 0, 10 * s, 3.4 * s, 0));
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.restore();
    } else if (p.kind === 'splash') {
      ctx.strokeStyle = `rgba(86,146,196,${0.55 * a})`;
      ctx.lineWidth = 1 * s;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, (2 + (1 - a) * 6) * s, (0.8 + (1 - a) * 2) * s, 0, 0, TAU);
      ctx.stroke();
    } else {
      ctx.fillStyle = `rgba(150,115,80,${0.4 * a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, (2 + (1 - a) * 4) * s, 0, TAU);
      ctx.fill();
    }
  }
}

export function stepParticles(ps: Particle[], dt: number) {
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i];
    p.life -= dt;
    if (p.kind === 'leaf') {
      p.vy += 160 * dt;
      p.vx *= 1 - 1.5 * dt;
      p.vy = Math.min(p.vy, 70);
      p.x += (p.vx + Math.sin(p.life * 7) * 20) * dt;
    } else if (p.kind === 'drop') {
      p.vy += 900 * dt;
      p.x += p.vx * dt;
    } else {
      p.x += p.vx * dt;
      p.vy *= 1 - 3 * dt;
    }
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
    if ((p.kind === 'drop' || p.kind === 'leaf') && p.y > p.floor) {
      if (p.kind === 'drop') {
        p.kind = 'splash';
        p.life = p.max = 0.35;
        p.vx = p.vy = 0;
      } else {
        p.y = p.floor;
        p.vx = 0;
        p.vy = 0;
        p.vr = 0;
      }
    }
    if (p.life <= 0) ps.splice(i, 1);
  }
}

/** Screen position of leaf slot k on a plant (for the scrap that flies off when it is eaten). */
export function leafPos(L: Layout, p: Plant, shape: PlantShape, k: number): Pt {
  const sl = shape.slots[Math.max(0, Math.min(shape.slots.length - 1, k))];
  const st = shape.stems[sl.stem];
  const q = stemPoint(p.x * L.W, L.plantBaseY, st, L.plantMaxH, Math.min(1, sl.t / st.len));
  return [q.x + Math.cos(q.ang + sl.side * sl.spread) * sl.len * 0.5 * L.s, q.y + Math.sin(q.ang + sl.side * sl.spread) * sl.len * 0.5 * L.s];
}

/**
 * A little paper tag hung on the fence in front of each plant: one pip per leaf, so the player can see at a
 * glance which plant is in trouble. Red when a bunny is eating it bare, an ink cross once it is gone.
 */
export function drawPlantTag(ctx: CanvasRenderingContext2D, L: Layout, p: Plant, index: number, now: number, danger: number) {
  const s = L.s;
  const cx = p.x * L.W;
  const w = 46 * s;
  const h = 18 * s;
  const y = L.fenceTop + 2 * s;
  const rng = mulberry32(700 + index);
  const shake = danger > 0 ? Math.sin(now * 30) * 0.04 : Math.sin(now * 1.2 + index) * 0.02;
  ctx.save();
  ctx.translate(cx, y - 3 * s);
  ctx.rotate(shake + (index % 2 ? 0.03 : -0.03));
  // String loop.
  ctx.strokeStyle = 'rgba(60,45,30,0.7)';
  ctx.lineWidth = 0.8 * s;
  ctx.beginPath();
  ctx.moveTo(-4 * s, 3 * s);
  ctx.lineTo(0, -1 * s);
  ctx.lineTo(4 * s, 3 * s);
  ctx.stroke();
  const card: Pt[] = jitterPts(
    [
      [-w / 2, 3 * s],
      [w / 2, 3 * s],
      [w / 2, 3 * s + h],
      [-w / 2, 3 * s + h],
    ],
    0.5 * s,
    rng,
  );
  const tagFill = !p.alive ? '#d8cfbf' : danger > 0 ? `rgb(${Math.round(244 - 10 * Math.sin(now * 8))},214,200)` : '#f6efdf';
  paperPiece(ctx, { polys: [card], fill: tagFill });
  pin(ctx, 0, 5 * s, 1.1 * s);
  if (!p.alive) {
    ctx.strokeStyle = 'rgba(60,40,30,0.75)';
    ctx.lineWidth = 2 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-6 * s, 7 * s);
    ctx.lineTo(6 * s, 3 * s + h - 3 * s);
    ctx.moveTo(6 * s, 7 * s);
    ctx.lineTo(-6 * s, 3 * s + h - 3 * s);
    ctx.stroke();
  } else {
    const n = TUNING.maxLeaves;
    for (let k = 0; k < n; k++) {
      const col = k % 6;
      const row = Math.floor(k / 6);
      const x = -w / 2 + 7.5 * s + col * 6.2 * s;
      const yy = 3 * s + 7.5 * s + row * 5.6 * s;
      ctx.beginPath();
      ctx.ellipse(x, yy, 2.4 * s, 1.9 * s, -0.5, 0, TAU);
      if (k < p.leaves) {
        ctx.fillStyle = p.leaves <= 4 ? 'rgba(186,70,48,0.9)' : 'rgba(78,128,82,0.9)';
        ctx.fill();
      } else {
        ctx.strokeStyle = 'rgba(90,80,60,0.35)';
        ctx.lineWidth = 0.7 * s;
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}
