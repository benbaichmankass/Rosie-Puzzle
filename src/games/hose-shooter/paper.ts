/** Cut-paper drawing helpers: wobbly ellipses and polygons that look hand-cut with scissors. */

export type Ctx = CanvasRenderingContext2D;

/** Deterministic hash noise in [-1, 1]. */
export function hn(a: number, b = 0): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}

/** Adds a wobbly ellipse to the current path. */
export function ellipsePath(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, seed: number, wob = 0.045, rot = 0) {
  const n = Math.max(10, Math.min(28, Math.round((rx + ry) / 2.2)));
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + hn(seed, i % n) * wob;
    const px = Math.cos(a) * rx * k;
    const py = Math.sin(a) * ry * k;
    const x = cx + px * c - py * s;
    const y = cy + px * s + py * c;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export function blob(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, fill: string, seed: number, wob = 0.045, rot = 0) {
  ctx.beginPath();
  ellipsePath(ctx, cx, cy, rx, ry, seed, wob, rot);
  ctx.fillStyle = fill;
  ctx.fill();
}

/** Polygon with slightly jittered vertices (scissor cut). */
export function poly(ctx: Ctx, pts: number[], fill: string, seed: number, jit = 0.6) {
  ctx.beginPath();
  for (let i = 0; i < pts.length; i += 2) {
    const x = pts[i] + hn(seed, i) * jit;
    const y = pts[i + 1] + hn(seed, i + 1) * jit;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

/** Thick rounded stroke (tails, legs, branches). */
export function limb(ctx: Ctx, pts: number[], width: number, color: string) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  if (pts.length === 6) ctx.quadraticCurveTo(pts[2], pts[3], pts[4], pts[5]);
  else for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.stroke();
}

/** Paper drop shadow for the next fills (offset in device pixels). */
export function paperShadow(ctx: Ctx, px: number, k = 1) {
  ctx.shadowColor = 'rgba(45,25,5,0.32)';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 1.4 * px * k;
  ctx.shadowOffsetY = 2 * px * k;
}

export function noShadow(ctx: Ctx) {
  ctx.shadowColor = 'transparent';
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

/** South-Park-ish pair of touching eyes. lookX/lookY move the pupils (-1..1). */
export function eyes(ctx: Ctx, x: number, y: number, r: number, seed: number, lookX = 0.4, lookY = 0, pupil = '#111', pupilR = 0.32, gap = 0.95) {
  blob(ctx, x - r * gap, y, r, r * 1.15, '#fff', seed + 1, 0.05);
  blob(ctx, x + r * gap, y, r, r * 1.15, '#fff', seed + 2, 0.05);
  const pr = r * pupilR;
  blob(ctx, x - r * gap + lookX * r * 0.45, y + lookY * r * 0.45, pr, pr, pupil, seed + 3, 0.02);
  blob(ctx, x + r * gap + lookX * r * 0.45, y + lookY * r * 0.45, pr, pr, pupil, seed + 4, 0.02);
}

/** Mix two #rrggbb colours. */
export function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
  const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
  const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

/** A tileable paper-grain canvas. */
export function makeGrain(size = 160): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = 128 + (Math.random() - 0.5) * 90;
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v * 0.97;
    img.data[i * 4 + 2] = v * 0.9;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  // a few fibres
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 0.6;
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const a = Math.random() * Math.PI;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * 8, y + Math.sin(a) * 8);
    ctx.stroke();
  }
  return c;
}

export const FONT = '"Rye", "Pixelify Sans", Georgia, serif';
