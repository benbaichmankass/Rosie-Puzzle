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
  /** The goal line: hedges this tall hide every window of the apartments across the street. */
  targetY: number;
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
    wallTop: Math.round(H * 0.39),
    targetY: Math.round(H * 0.135),
    soilY,
    plantBaseY: soilY + 14 * s,
    fenceTop: fenceBottom - fenceH,
    fenceBottom,
    groundTop,
    groundRange: H - groundTop - 70 * s,
    plantMaxH: Math.min(H * 0.22, 190 * s),
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

  paintApartments(ctx, L, rng);

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

  // The yard tree: trunk up the left side, a branch overhanging the scene (with the old colander on it).
  paintTree(ctx, L, rng);

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

/** The neighbours' apartment across the street, peeking over the yard wall: one facade, two windows. */
function paintApartments(ctx: CanvasRenderingContext2D, L: Layout, rng: Rng) {
  const { W, s } = L;
  const sky = ctx.createLinearGradient(0, 0, 0, L.targetY);
  sky.addColorStop(0, '#d6e2e3');
  sky.addColorStop(1, '#efe6d6');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, L.wallTop + 6);
  wash(ctx, band(-20, W + 20, -20, L.targetY * 0.5, rng, 16), '178,204,214', 0.35, rng, 8, 3, 0);

  // One house front: warm Jaffa sandstone render with a flat roof.
  const x0 = W * 0.08;
  const x1 = W * 0.94;
  const roof = L.targetY - 30 * s;
  wash(ctx, band(x0, x1, roof, L.wallTop + 12, rng, 2 * s, 30), '230,204,164', 0.92, rng, 1.5, 3, 0.4);
  for (let i = 0; i < 5; i++)
    wash(
      ctx,
      blob(lerp(x0, x1, rng()), lerp(roof + 20 * s, L.wallTop, rng()), (30 + rng() * 50) * s, (10 + rng() * 14) * s, rng, 12, 0.25),
      '214,184,140',
      0.25,
      rng,
      4,
      2,
      0,
    );
  wash(ctx, band(x0 - 4 * s, x1 + 4 * s, roof - 4 * s, roof + 6 * s, rng, 1.5 * s, 30), '196,166,124', 0.85, rng, 1, 2, 0.4);
  // Roof: a solar water heater and a TV antenna.
  const hx = lerp(x0, x1, 0.72);
  const hy = roof - 4 * s;
  ctx.strokeStyle = 'rgba(70,64,60,0.7)';
  ctx.lineWidth = 1.2 * s;
  ctx.beginPath();
  ctx.moveTo(hx - 12 * s, hy);
  ctx.lineTo(hx - 10 * s, hy - 14 * s);
  ctx.moveTo(hx + 12 * s, hy);
  ctx.lineTo(hx + 10 * s, hy - 14 * s);
  ctx.stroke();
  wash(ctx, blob(hx, hy - 17 * s, 15 * s, 5 * s, rng, 14, 0.04), '236,236,232', 0.95, rng, 0.6, 2, 0.6);
  wash(
    ctx,
    [
      [hx - 28 * s, hy],
      [hx - 16 * s, hy - 12 * s],
      [hx + 2 * s, hy - 12 * s],
      [hx - 10 * s, hy],
    ],
    '60,78,110',
    0.85,
    rng,
    0.5,
    2,
    0.5,
  );
  const ax = lerp(x0, x1, 0.3);
  ctx.strokeStyle = 'rgba(60,55,50,0.7)';
  ctx.lineWidth = 1 * s;
  ctx.beginPath();
  ctx.moveTo(ax, roof - 4 * s);
  ctx.lineTo(ax, roof - 30 * s);
  ctx.moveTo(ax - 9 * s, roof - 24 * s);
  ctx.lineTo(ax + 9 * s, roof - 24 * s);
  ctx.moveTo(ax - 6 * s, roof - 17 * s);
  ctx.lineTo(ax + 6 * s, roof - 17 * s);
  ctx.stroke();

  // Two big windows with nosy neighbours, each with a sill and part-open shutters.
  const top = L.targetY + 10 * s;
  const wh = Math.min((L.wallTop - L.targetY) * 0.62, 150 * s);
  const ww = Math.min(W * 0.22, 90 * s);
  const looks = [
    { cx: W * 0.3, binoculars: true, cat: false },
    { cx: W * 0.72, binoculars: false, cat: true },
  ];
  for (const lk of looks) {
    const wx0 = lk.cx - ww / 2;
    // Arched Jaffa window: frame, dark interior, a shutter leaf on each side.
    wash(ctx, band(wx0 - 6 * s, wx0 + ww + 6 * s, top - 6 * s, top + wh + 6 * s, rng, 0.8 * s, ww), '246,240,228', 0.92, rng, 0.5, 2, 0.35);
    wash(ctx, band(wx0, wx0 + ww, top, top + wh, rng, 0.8 * s, ww / 2), '84,96,112', 0.78, rng, 0.6, 3, 0.4);
    wash(ctx, band(wx0, wx0 + ww, top, top + wh * 0.35, rng, 0.8 * s, ww / 2), '120,136,150', 0.3, rng, 0.6, 2, 0);
    for (const side of [-1, 1]) {
      const sx0 = side < 0 ? wx0 - 6 * s - ww * 0.22 : wx0 + ww + 6 * s;
      wash(ctx, band(sx0, sx0 + ww * 0.22, top - 4 * s, top + wh + 4 * s, rng, 0.5 * s, ww * 0.22), '104,150,140', 0.9, rng, 0.4, 2, 0.5);
      ctx.strokeStyle = 'rgba(60,96,90,0.55)';
      ctx.lineWidth = 0.8 * s;
      for (let y = top + 2 * s; y < top + wh; y += 5 * s) {
        ctx.beginPath();
        ctx.moveTo(sx0 + 2 * s, y);
        ctx.lineTo(sx0 + ww * 0.22 - 2 * s, y);
        ctx.stroke();
      }
    }
    paintNeighbour(ctx, lk.cx, top + wh, ww, wh, rng, s, lk.binoculars, lk.cat);
    // Sill.
    wash(ctx, band(wx0 - 10 * s, wx0 + ww + 10 * s, top + wh + 3 * s, top + wh + 10 * s, rng, 0.8 * s, ww), '206,180,140', 0.9, rng, 0.5, 2, 0.5);
    // A pot of geraniums on the sill.
    const px = lk.cx + (lk.cat ? -ww * 0.3 : ww * 0.3);
    wash(ctx, band(px - 7 * s, px + 7 * s, top + wh - 8 * s, top + wh + 3 * s, rng, 0.5 * s, 14 * s), '176,96,62', 0.9, rng, 0.4, 2, 0.5);
    for (let i = 0; i < 5; i++)
      wash(ctx, blob(px + (rng() - 0.5) * 14 * s, top + wh - 12 * s - rng() * 6 * s, 3.5 * s, 3 * s, rng, 8, 0.2), '210,60,70', 0.85, rng, 0.4, 2, 0);
  }
  // Soft atmospheric haze so the house sits back behind the yard.
  ctx.fillStyle = 'rgba(232,226,214,0.18)';
  ctx.fillRect(0, 0, W, L.wallTop);
}

/** The yard tree: an ink-and-wash trunk up the left edge and a branch overhanging the top of the scene. */
function paintTree(ctx: CanvasRenderingContext2D, L: Layout, rng: Rng) {
  const { W, H, s } = L;
  const base = L.soilY + 8 * s;
  // Trunk as a tapered, slightly bent polygon.
  const pts: Pt[] = [];
  const steps = 14;
  const curve = (t: number) => -4 * s + Math.sin(t * 2.4) * 10 * s + t * 14 * s;
  const yAt = (t: number) => lerp(base, H * 0.06, t);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push([curve(t) + lerp(34, 12, t) * s, yAt(t)]);
  }
  for (let i = steps; i >= 0; i--) {
    const t = i / steps;
    pts.push([curve(t) - lerp(34, 12, t) * s, yAt(t)]);
  }
  wash(ctx, pts, '78,64,52', 0.97, rng, 1, 3, 0.8);
  wash(
    ctx,
    pts
      .map(([x, y]) => [x - 6 * s, y] as Pt)
      .slice(0, steps + 1)
      .concat(pts.slice(steps + 1)),
    '48,38,32',
    0.25,
    rng,
    1,
    2,
    0,
  );
  // Bark: dry-brush ink strokes.
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < 18; i++) {
    const t = rng();
    const y = yAt(t);
    const x = curve(t) + (rng() - 0.5) * lerp(30, 10, t) * s;
    ctx.strokeStyle = `rgba(40,32,28,${0.25 + rng() * 0.3})`;
    ctx.lineWidth = (0.8 + rng() * 1.4) * s;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rng() - 0.5) * 3 * s, y - (8 + rng() * 16) * s);
    ctx.stroke();
  }
  // The overhanging branch and its twigs.
  const bx0 = curve(0.92);
  const by0 = yAt(0.92);
  const limb = (x0: number, y0: number, x1: number, y1: number, w: number, bend: number) => {
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = `rgba(60,48,40,${0.3 + i * 0.18})`;
      ctx.lineWidth = w * (1 - i * 0.3);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + bend, x1, y1);
      ctx.stroke();
    }
  };
  const tipX = W * 0.82;
  const tipY = H * 0.075;
  limb(bx0, by0, tipX, tipY, 13 * s, -18 * s);
  const twigs: [number, number, number, number][] = [
    [0.25, -1, 26, 2.5],
    [0.4, 1, 30, 3],
    [0.55, -1, 22, 2.2],
    [0.7, 1, 28, 2.5],
    [0.85, -1, 18, 2],
  ];
  const along = (t: number): Pt => [lerp(bx0, tipX, t), lerp(by0, tipY, t) - Math.sin(t * Math.PI) * 9 * s];
  for (const [t, dir, len, w] of twigs) {
    const [x, y] = along(t);
    limb(x, y, x + len * 0.6 * s, y + dir * len * s, w * s, dir * 4 * s);
  }
  ctx.restore();

  // The metal colander hanging from the branch on a string.
  const [cx, cyTop] = along(0.47);
  const cy = Math.min(cyTop + 30 * s, L.targetY - 14 * s);
  ctx.strokeStyle = 'rgba(70,60,50,0.7)';
  ctx.lineWidth = 0.9 * s;
  ctx.beginPath();
  ctx.moveTo(cx, cyTop);
  ctx.lineTo(cx, cy - 8 * s);
  ctx.stroke();
  wash(
    ctx,
    [
      [cx - 13 * s, cy - 7 * s],
      [cx + 13 * s, cy - 7 * s],
      [cx + 9 * s, cy + 5 * s],
      [cx - 9 * s, cy + 5 * s],
    ],
    '178,184,190',
    0.95,
    rng,
    0.4,
    2,
    0.7,
  );
  ctx.fillStyle = 'rgba(70,74,80,0.55)';
  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    ctx.arc(cx - 8 * s + (i % 5) * 4 * s, cy - 3 * s + Math.floor(i / 5) * 4 * s, 0.9 * s, 0, TAU);
    ctx.fill();
  }

  // Foliage: clusters of small ficus leaves along the branch and over the top of the trunk.
  for (let i = 0; i < 26; i++) {
    const [x, y] = along(rng());
    wash(
      ctx,
      blob(x + (rng() - 0.5) * 40 * s, y + (rng() - 0.6) * 26 * s, (12 + rng() * 10) * s, (8 + rng() * 6) * s, rng, 12, 0.25),
      rng() < 0.5 ? '78,112,72' : '108,140,86',
      0.45,
      rng,
      2,
      2,
      0.4,
    );
  }
  for (let i = 0; i < 130; i++) {
    const t = rng();
    const [x, y] = along(t);
    const lx = x + (rng() - 0.5) * 50 * s;
    const ly = y + (rng() - 0.6) * 40 * s;
    const leaf = leafShape(lx, ly, (9 + rng() * 6) * s, (3.5 + rng() * 2) * s, rng() * TAU);
    wash(ctx, leaf, ['70,108,70', '96,132,82', '122,150,92'][Math.floor(rng() * 3)], 0.6, rng, 0.6, 2, 0.6);
  }
}

/** A neighbour peering out of a window (head and shoulders, sometimes with binoculars or a cat on the sill). */
function paintNeighbour(
  ctx: CanvasRenderingContext2D,
  cx: number,
  sill: number,
  ww: number,
  wh: number,
  rng: Rng,
  s: number,
  binoculars: boolean,
  cat: boolean,
) {
  const skins = ['232,190,160', '214,166,130', '176,124,92', '240,206,180'];
  const shirts = ['190,70,60', '70,110,150', '230,200,90', '120,150,100', '200,200,196'];
  const hairs = ['50,36,28', '30,24,22', '150,110,70', '200,196,190'];
  const x = cx + (rng() - 0.5) * ww * 0.3;
  const headR = Math.min(ww * 0.2, wh * 0.24);
  const hy = sill - wh * 0.45;
  wash(ctx, blob(x, sill - wh * 0.08, ww * 0.34, wh * 0.26, rng, 14, 0.06), shirts[Math.floor(rng() * shirts.length)], 0.9, rng, 0.4, 2, 0.4);
  wash(ctx, blob(x, hy, headR, headR * 1.1, rng, 14, 0.05), skins[Math.floor(rng() * skins.length)], 0.95, rng, 0.3, 2, 0.4);
  wash(ctx, blob(x, hy - headR * 0.55, headR * 1.05, headR * 0.6, rng, 12, 0.1), hairs[Math.floor(rng() * hairs.length)], 0.9, rng, 0.3, 2, 0.3);
  if (binoculars) {
    // Binoculars, nosy.
    ctx.fillStyle = 'rgba(30,30,34,0.9)';
    ctx.beginPath();
    ctx.arc(x - headR * 0.4, hy + headR * 0.1, headR * 0.38, 0, TAU);
    ctx.arc(x + headR * 0.4, hy + headR * 0.1, headR * 0.38, 0, TAU);
    ctx.fill();
  } else {
    ctx.fillStyle = 'rgba(30,24,20,0.85)';
    ctx.beginPath();
    ctx.arc(x - headR * 0.35, hy + headR * 0.05, 1.1 * s, 0, TAU);
    ctx.arc(x + headR * 0.35, hy + headR * 0.05, 1.1 * s, 0, TAU);
    ctx.fill();
  }
  if (cat) {
    // A cat on the sill.
    const kx = cx + ww * 0.28;
    wash(ctx, blob(kx, sill - 4 * s, 7 * s, 4.5 * s, rng, 10, 0.08), '70,66,64', 0.95, rng, 0.3, 2, 0);
    wash(ctx, blob(kx + 5 * s, sill - 9 * s, 3.6 * s, 3.4 * s, rng, 10, 0.06), '70,66,64', 0.95, rng, 0.3, 2, 0);
    ctx.fillStyle = 'rgba(70,66,64,0.95)';
    ctx.beginPath();
    ctx.moveTo(kx + 2.4 * s, sill - 11 * s);
    ctx.lineTo(kx + 3.4 * s, sill - 14.5 * s);
    ctx.lineTo(kx + 4.8 * s, sill - 11.5 * s);
    ctx.moveTo(kx + 5.6 * s, sill - 11.5 * s);
    ctx.lineTo(kx + 7.2 * s, sill - 14.5 * s);
    ctx.lineTo(kx + 8 * s, sill - 10.5 * s);
    ctx.fill();
  }
}

/** The goal line across the apartment windows, with a little paper flag. */
export function drawTargetLine(ctx: CanvasRenderingContext2D, L: Layout, now: number, font: string) {
  const { W, s } = L;
  const y = L.targetY;
  ctx.save();
  ctx.setLineDash([7 * s, 6 * s]);
  ctx.lineDashOffset = -now * 6 * s;
  ctx.strokeStyle = 'rgba(183,58,46,0.75)';
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(W, y);
  ctx.stroke();
  ctx.restore();
  // Flag on the right edge.
  const fx = W - 8 * s;
  const fw = 74 * s;
  const fh = 17 * s;
  const rng = mulberry32(55);
  const flag: Pt[] = jitterPts(
    [
      [fx - fw, y - fh / 2],
      [fx, y - fh / 2],
      [fx, y + fh / 2],
      [fx - fw, y + fh / 2],
      [fx - fw - 6 * s, y],
    ],
    0.4 * s,
    rng,
  );
  paperPiece(ctx, { polys: [flag], fill: '#b73a2e' });
  ctx.fillStyle = '#fbefe0';
  ctx.font = `800 ${10.5 * s}px ${font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('hide the view', fx - fw / 2 - 1 * s, y + 0.5 * s);
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

interface Cluster {
  /** -1..1 across the hedge. */
  u: number;
  /** 0..1 up the hedge. */
  v: number;
  r: number;
  /** Foliage level (0..1) at which this cluster is present: the thin outer bits go first. */
  thr: number;
  shade: number;
  pts: Pt[];
}
export interface PlantShape {
  clusters: Cluster[];
  twigs: { u: number; top: number }[];
  tint: number;
  seed: number;
}

/** A hedge: a column of watercolor leaf clusters over an ink branch skeleton. */
export function makePlantShape(i: number): PlantShape {
  const rng = mulberry32(500 + i * 31);
  const clusters: Cluster[] = [];
  for (let k = 0; k < 74; k++) {
    const v = Math.pow(rng(), 0.85);
    const u = (rng() * 2 - 1) * (1 - 0.35 * v * v);
    clusters.push({
      u,
      v,
      r: 11 + rng() * 8,
      thr: Math.min(0.97, 0.04 + 0.6 * rng() * 0.8 + 0.45 * Math.abs(u) * rng()),
      shade: rng(),
      pts: blob(0, 0, 1, 0.82, rng, 12, 0.16, rng() * TAU),
    });
  }
  clusters.sort((a, b) => a.shade - b.shade);
  const twigs = [-0.7, -0.35, 0, 0.35, 0.7].map((u) => ({ u: u + (rng() - 0.5) * 0.15, top: 0.75 + rng() * 0.2 }));
  return { clusters, twigs, tint: [0.15, 0.85, 0.35, 0.95, 0.55][i % 5], seed: 900 + i };
}

/** Hedges start as separate bushes and widen as they grow, closing the gaps only near full height. */
const hedgeHalfW = (L: Layout, p?: Plant) => (L.W / 5) * 0.6 * (p ? 0.5 + 0.5 * Math.min(1, p.height) : 1);
const hedgePx = (L: Layout, p: Plant) => p.height * (L.plantBaseY - L.targetY);

/** Where the can should pour for hedge i (its top). */
export function plantTop(L: Layout, p: Plant, _shape: PlantShape) {
  return { x: p.x * L.W, y: L.plantBaseY - hedgePx(L, p) };
}

export function drawPlant(ctx: CanvasRenderingContext2D, L: Layout, p: Plant, shape: PlantShape, now: number, wobble: number, danger = 0) {
  const bx = p.x * L.W;
  const by = L.plantBaseY;
  const s = L.s;
  const rng = mulberry32(shape.seed);
  const hPx = hedgePx(L, p);

  // Soil mound ringed with pebbles.
  const mound = blob(bx, by + 4 * s, 34 * s, 11 * s, rng, 16, 0.08);
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
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (0.05 + (i / 6) * 0.9);
    traceSmooth(ctx, blob(bx - Math.cos(a) * 35 * s, by + 8 * s - Math.sin(a) * 3 * s, 3.4 * s, 2.2 * s, rng, 8, 0.2));
    ctx.fillStyle = i % 2 ? 'rgba(206,190,166,0.9)' : 'rgba(170,156,136,0.9)';
    ctx.fill();
  }
  if (p.moisture > 0.02) {
    ctx.fillStyle = `rgba(60,38,26,${0.35 * p.moisture})`;
    traceSmooth(ctx, blob(bx, by + 6 * s, 34 * s, 7 * s, rng, 12, 0.15));
    ctx.fill();
  }

  const halfW = hedgeHalfW(L, p);
  const sway = Math.sin(now * 1.1 + shape.seed) * 1.5 * s + wobble * 40 * s;

  // Ink branch skeleton (shows through when the hedge is thin, and is all that is left when it dies).
  ctx.save();
  ctx.lineCap = 'round';
  for (const tw of shape.twigs) {
    const tx = bx + tw.u * halfW * 0.7 + sway * tw.top;
    const ty = by - hPx * tw.top;
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = p.alive ? (pass ? 'rgba(60,46,34,0.8)' : 'rgba(70,58,40,0.3)') : pass ? 'rgba(110,88,62,0.85)' : 'rgba(110,88,62,0.25)';
      ctx.lineWidth = (pass ? 1.8 : 3.6) * s;
      ctx.beginPath();
      ctx.moveTo(bx + tw.u * 4 * s, by);
      ctx.quadraticCurveTo(bx + tw.u * halfW * 0.25, by - hPx * 0.45, tx, ty);
      ctx.stroke();
    }
  }
  ctx.restore();

  if (!p.alive) {
    // A few dry brown leaves cling to the bare branches.
    const since = now - p.diedAt;
    for (let k = 0; k < 7; k++) {
      const tw = shape.twigs[k % shape.twigs.length];
      const t = 0.4 + ((k * 0.37) % 0.55);
      const x = bx + tw.u * halfW * 0.7 * t;
      const y = by - hPx * tw.top * t + Math.min(1, since) * 4 * s;
      traceSmooth(ctx, leafShape(x, y, 10 * s, 3.6 * s, 1.2 + k));
      ctx.fillStyle = 'rgba(150,108,60,0.7)';
      ctx.fill();
    }
    return;
  }

  if (danger > 0) {
    const r = 56 * s;
    const cy = by - Math.min(hPx, 120 * s) * 0.4;
    const g = ctx.createRadialGradient(bx, cy, 0, bx, cy, r);
    const al = danger * (0.18 + 0.1 * Math.sin(now * 8));
    g.addColorStop(0, `rgba(196,64,44,${al})`);
    g.addColorStop(1, 'rgba(196,64,44,0)');
    ctx.fillStyle = g;
    ctx.fillRect(bx - r, cy - r, r * 2, r * 2);
  }

  // Foliage. Fullness is continuous (leaves plus growth towards the next) so clusters fade in and out.
  const full = clamp01((p.leaves + Math.min(1, p.growth)) / TUNING.maxLeaves);
  const m = p.moisture;
  const weak = clamp01((3.5 - p.leaves) / 3.5);
  const tint = (shape.tint - 0.5) * 30;
  const grow = 0.75 + 0.25 * Math.min(1, p.height);
  for (const c of shape.clusters) {
    const a = clamp01((full - c.thr) / 0.08);
    if (a <= 0) continue;
    const r = c.r * s * grow;
    const x = bx + c.u * halfW * (0.75 + 0.25 * full) + sway * c.v;
    const y = by - r * 0.55 - c.v * Math.max(0, hPx - r * 1.1);
    const dark = c.shade < 0.35;
    const R = Math.round(lerp(lerp(dark ? 52 : 86, dark ? 44 : 78, m), 160, weak * 0.5) + tint);
    const G = Math.round(lerp(lerp(dark ? 92 : 132, dark ? 98 : 146, m), 150, weak * 0.25) + c.shade * 18);
    const B = Math.round(lerp(lerp(dark ? 64 : 84, dark ? 60 : 80, m), 84, weak * 0.5) + tint * 0.4);
    const pts = c.pts.map(([px, py]) => [x + px * r, y + py * r] as Pt);
    traceSmooth(ctx, pts);
    ctx.fillStyle = `rgba(${R},${G},${B},${0.82 * a})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(${R - 40},${G - 45},${B - 35},${0.4 * a})`;
    ctx.lineWidth = 0.9 * s;
    ctx.stroke();
    if (!dark) {
      // Light dab: wet-in-wet highlight.
      traceSmooth(
        ctx,
        c.pts.map(([px, py]) => [x - r * 0.25 + px * r * 0.45, y - r * 0.3 + py * r * 0.45] as Pt),
      );
      ctx.fillStyle = `rgba(${Math.min(255, R + 50)},${Math.min(255, G + 40)},${Math.min(255, B + 30)},${0.35 * a})`;
      ctx.fill();
    }
  }
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
export function bunnyPose(b: Bunny, now: number, biteAge: number, hopHeight: number, wetAge = 99): BunnyPose {
  const ph = (Math.sin(now * 0.7 + b.id * 2.1) + Math.sin(now * 1.9 + b.id)) * 0.5;
  const twitch = Math.max(0, Math.sin(now * 3.1 + b.id * 5) - 0.92) * 6;
  if (wetAge < 0.7 && !(b.mode === 'hop' && b.hop > 0)) {
    // Just got sprayed: a fast shake-off, ears flapping.
    const k = 1 - wetAge / 0.7;
    const sh = Math.sin(now * 55) * k;
    return {
      bodyRot: sh * 0.12,
      hindRot: 0,
      frontRot: 0.1,
      headRot: sh * 0.5,
      earRot: sh * 1.2,
      earFarRot: -sh * 1.2,
      lift: Math.abs(sh) * 2,
      squash: 1 - 0.05 * k,
    };
  }
  if (b.mode === 'frisky') {
    // Love-struck: a comic wiggle and bounce, ears up, nuzzling forward.
    const w = Math.sin(now * 16 + b.id * 1.7);
    return {
      bodyRot: -0.12 + w * 0.09,
      hindRot: -0.15 + w * 0.15,
      frontRot: -0.3 - w * 0.2,
      headRot: 0.05 + Math.sin(now * 8 + b.id) * 0.12,
      earRot: -0.35 + w * 0.12,
      earFarRot: -0.2 - w * 0.12,
      lift: Math.max(0, w) * 3,
      squash: 1 + w * 0.04,
    };
  }
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

/** Where a bunny's bite takes a leaf from (the lower part of the hedge), for the flying leaf scrap. */
export function leafPos(L: Layout, p: Plant, _shape: PlantShape, k: number): Pt {
  const h = hedgePx(L, p);
  const f = ((k * 0.618) % 1) - 0.5;
  return [p.x * L.W + f * hedgeHalfW(L, p), L.plantBaseY - Math.min(h, 60 * L.s) * (0.3 + 0.4 * ((k * 0.37) % 1))];
}

/**
 * A little paper tag hung on the fence in front of each hedge: one pip per leaf so the player sees at a glance
 * which hedge is in trouble (red when a bunny is eating it bare), a check mark once it is tall enough, and an
 * ink cross once it is gone.
 */
export function drawPlantTag(ctx: CanvasRenderingContext2D, L: Layout, p: Plant, index: number, now: number, danger: number) {
  const s = L.s;
  const w = 46 * s;
  const h = 18 * s;
  const rng = mulberry32(700 + index);
  const shake = danger > 0 ? Math.sin(now * 30) * 0.04 : Math.sin(now * 1.2 + index) * 0.02;
  ctx.save();
  ctx.translate(p.x * L.W, L.fenceTop - 1 * s);
  ctx.rotate(shake + (index % 2 ? 0.03 : -0.03));
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
  const tall = p.alive && p.height >= 1;
  const fill = !p.alive ? '#d8cfbf' : danger > 0 ? `rgb(${Math.round(244 - 10 * Math.sin(now * 8))},214,200)` : tall ? '#eef3dc' : '#f6efdf';
  paperPiece(ctx, { polys: [card], fill });
  pin(ctx, 0, 5 * s, 1.1 * s);
  ctx.lineCap = 'round';
  if (!p.alive) {
    ctx.strokeStyle = 'rgba(60,40,30,0.75)';
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(-6 * s, 7 * s);
    ctx.lineTo(6 * s, h);
    ctx.moveTo(6 * s, 7 * s);
    ctx.lineTo(-6 * s, h);
    ctx.stroke();
  } else {
    const n = TUNING.maxLeaves;
    const perRow = Math.ceil(n / 2);
    for (let k = 0; k < n; k++) {
      const col = k % perRow;
      const row = Math.floor(k / perRow);
      const x = -w / 2 + 6.5 * s + col * 6.6 * s + row * 3.3 * s;
      const yy = 10.5 * s + row * 5.6 * s;
      ctx.beginPath();
      ctx.ellipse(x, yy, 2.3 * s, 1.8 * s, -0.5, 0, TAU);
      if (k < p.leaves) {
        ctx.fillStyle = p.leaves <= 3 ? 'rgba(186,70,48,0.9)' : 'rgba(78,128,82,0.9)';
        ctx.fill();
      } else {
        ctx.strokeStyle = 'rgba(90,80,60,0.35)';
        ctx.lineWidth = 0.7 * s;
        ctx.stroke();
      }
    }
    if (tall) {
      // Ink check mark: this hedge reaches the line.
      ctx.strokeStyle = 'rgba(50,110,60,0.95)';
      ctx.lineWidth = 2.4 * s;
      ctx.beginPath();
      ctx.moveTo(w / 2 - 9 * s, 2 * s);
      ctx.lineTo(w / 2 - 5 * s, 6 * s);
      ctx.lineTo(w / 2 + 3 * s, -5 * s);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function heartPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.9);
  ctx.bezierCurveTo(x - r * 1.5, y - r * 0.1, x - r * 0.75, y - r * 1.25, x, y - r * 0.45);
  ctx.bezierCurveTo(x + r * 0.75, y - r * 1.25, x + r * 1.5, y - r * 0.1, x, y + r * 0.9);
  ctx.closePath();
}

/**
 * Over a frisky pair: hearts floating up and a big heart that fills as the baby countdown runs out, with the
 * seconds left inside and a blue ring showing how close the spray is to breaking them up.
 */
export function drawPairMeter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  fill: number,
  secondsLeft: number,
  wet: number,
  now: number,
  font: string,
) {
  // Floating hearts.
  for (let i = 0; i < 4; i++) {
    const t = (now * 0.6 + i / 4) % 1;
    const hx = x + Math.sin((t + i) * 6) * 14 * s + (i - 1.5) * 8 * s;
    const hy = y + 10 * s - t * 46 * s;
    ctx.globalAlpha = Math.sin(t * Math.PI) * 0.85;
    heartPath(ctx, hx, hy, (4 + t * 3) * s);
    ctx.fillStyle = i % 2 ? '#e2566a' : '#f08aa0';
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // The countdown heart, pulsing faster as it fills.
  const my = y - 40 * s;
  const r = 15 * s * (1 + 0.06 * Math.sin(now * (6 + fill * 14)));
  ctx.save();
  heartPath(ctx, x + 1.5 * s, my + 2 * s, r);
  ctx.fillStyle = 'rgba(60,30,30,0.25)';
  ctx.fill();
  heartPath(ctx, x, my, r);
  ctx.fillStyle = '#fbefe6';
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = '#d93d55';
  const top = my + r * 0.9 - fill * r * 2.2;
  ctx.fillRect(x - r * 2, top, r * 4, r * 3);
  ctx.restore();
  heartPath(ctx, x, my, r);
  ctx.strokeStyle = '#7d2219';
  ctx.lineWidth = 1.6 * s;
  ctx.stroke();
  ctx.fillStyle = fill > 0.5 ? '#fff' : '#7d2219';
  ctx.font = `800 ${13 * s}px ${font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(Math.max(1, Math.ceil(secondsLeft))), x, my - 1 * s);
  if (wet > 0) {
    ctx.strokeStyle = 'rgba(70,140,200,0.9)';
    ctx.lineWidth = 3 * s;
    ctx.beginPath();
    ctx.arc(x, my - 1 * s, r + 6 * s, -Math.PI / 2, -Math.PI / 2 + wet * TAU);
    ctx.stroke();
  }
}
