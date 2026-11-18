/**
 * Pen-and-ink + watercolour helpers for canvas (original "storybook" look: wobbly sepia ink lines,
 * cross-hatching and soft, blotchy washes on warm paper). All randomness is seeded so drawings
 * don't shimmer from frame to frame.
 */

export const INK = '#2b2016';
export const PAPER = '#f3e9d2';

export type Ctx = CanvasRenderingContext2D;
export type Pt = [number, number];

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Polyline with hand-drawn wobble. Each segment is subdivided and nudged. */
export function inkLine(c: Ctx, pts: Pt[], seed = 1, wobble = 0.8, width = 1.3, color = INK, close = false): void {
  const r = rng(seed);
  c.save();
  c.strokeStyle = color;
  c.lineWidth = width;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.beginPath();
  const all = close ? [...pts, pts[0]] : pts;
  for (let i = 0; i < all.length; i++) {
    const [x, y] = all[i];
    if (i === 0) { c.moveTo(x + (r() - 0.5) * wobble, y + (r() - 0.5) * wobble); continue; }
    const [px, py] = all[i - 1];
    const len = Math.hypot(x - px, y - py);
    const steps = Math.max(1, Math.round(len / 9));
    for (let k = 1; k <= steps; k++) {
      const t = k / steps;
      c.lineTo(px + (x - px) * t + (r() - 0.5) * wobble, py + (y - py) * t + (r() - 0.5) * wobble);
    }
  }
  c.stroke();
  c.restore();
}

export function rectPts(x: number, y: number, w: number, h: number): Pt[] {
  return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
}

export function ellipsePts(cx: number, cy: number, rx: number, ry: number, n = 20, a0 = 0, a1 = Math.PI * 2): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return out;
}

export function pathFrom(c: Ctx, pts: Pt[]): void {
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
}

/** Watercolour wash: several translucent, slightly offset fills with a darker pooled edge. */
export function wash(c: Ctx, pts: Pt[], color: string, seed = 7, alpha = 0.32, spread = 2.2, passes = 3): void {
  const r = rng(seed);
  c.save();
  c.fillStyle = color;
  for (let p = 0; p < passes; p++) {
    c.globalAlpha = alpha;
    c.beginPath();
    pts.forEach(([x, y], i) => {
      const nx = x + (r() - 0.5) * spread * 2;
      const ny = y + (r() - 0.5) * spread * 2;
      if (i) c.lineTo(nx, ny); else c.moveTo(nx, ny);
    });
    c.closePath();
    c.fill();
  }
  // pooled pigment at the edge
  c.globalAlpha = alpha * 0.9;
  c.strokeStyle = color;
  c.lineWidth = 1.6;
  c.stroke();
  c.restore();
}

/** Parallel hatching inside the current clip region (call between save/clip/restore). */
export function hatchRect(
  c: Ctx, x: number, y: number, w: number, h: number,
  angle: number, gap: number, seed = 3, width = 0.7, color = INK, alpha = 0.55,
): void {
  const r = rng(seed);
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const cx = x + w / 2, cy = y + h / 2;
  const R = Math.hypot(w, h) / 2 + 2;
  c.save();
  c.strokeStyle = color;
  c.globalAlpha = alpha;
  c.lineWidth = width;
  c.lineCap = 'round';
  c.beginPath();
  for (let d = -R; d <= R; d += gap) {
    const o = d + (r() - 0.5) * gap * 0.35;
    // line perpendicular offset o along normal (-sin, cos)
    const lx = cx - sin * o, ly = cy + cos * o;
    const a = -R * (0.85 + r() * 0.15), b = R * (0.85 + r() * 0.15);
    c.moveTo(lx + cos * a, ly + sin * a);
    c.lineTo(lx + cos * b + (r() - 0.5), ly + sin * b + (r() - 0.5));
  }
  c.stroke();
  c.restore();
}

/** Hatch inside a polygon. density 1 = single hatch, 2 = cross-hatch, 3 = dense cross-hatch. */
export function hatchPoly(c: Ctx, pts: Pt[], density = 1, gap = 4, seed = 5, angle = -0.9, alpha = 0.5, width = 0.7): void {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  c.save();
  pathFrom(c, pts);
  c.clip();
  hatchRect(c, x0, y0, x1 - x0, y1 - y0, angle, gap, seed, width, INK, alpha);
  if (density >= 2) hatchRect(c, x0, y0, x1 - x0, y1 - y0, angle + 1.35, gap * 1.1, seed + 1, width, INK, alpha * 0.85);
  if (density >= 3) hatchRect(c, x0, y0, x1 - x0, y1 - y0, angle + 0.6, gap * 0.9, seed + 2, width, INK, alpha * 0.8);
  c.restore();
}

/** Paper grain: speckles and faint fibres. */
export function paper(c: Ctx, w: number, h: number, seed = 11): void {
  const r = rng(seed);
  c.save();
  c.fillStyle = PAPER;
  c.fillRect(0, 0, w, h);
  const n = Math.floor((w * h) / 90);
  for (let i = 0; i < n; i++) {
    const x = r() * w, y = r() * h;
    c.fillStyle = r() < 0.5 ? 'rgba(120,90,50,0.06)' : 'rgba(255,255,255,0.18)';
    c.fillRect(x, y, 1 + r() * 1.5, 1 + r() * 1.5);
  }
  // big soft blooms
  for (let i = 0; i < 14; i++) {
    const x = r() * w, y = r() * h, rad = 30 + r() * 90;
    const g = c.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, 'rgba(190,150,90,0.07)');
    g.addColorStop(1, 'rgba(190,150,90,0)');
    c.fillStyle = g;
    c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  c.restore();
}
