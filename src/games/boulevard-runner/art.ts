/**
 * Jerusalem Boulevard Runner art: everything drawn in code. Sprites are pre-rendered once into
 * offscreen canvases (in a few haze levels for distance), then scaled with drawImage each frame.
 * Coordinates inside draw functions are world units with the origin at the feet, y negative = up.
 */

export const HAZE = '#f2d2ae';
export const FOG_LEVELS = [0, 0.32, 0.58];

export interface Sprite {
  frames: HTMLCanvasElement[][]; // [frame][fogLevel]
  w: number; // world units
  h: number;
}

type Draw = (g: CanvasRenderingContext2D, frame: number) => void;

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

export function makeSprite(w: number, h: number, ppu: number, draw: Draw, frames = 1, fog = true): Sprite {
  const out: HTMLCanvasElement[][] = [];
  for (let f = 0; f < frames; f++) {
    const base = makeCanvas(w * ppu, h * ppu);
    const g = base.getContext('2d')!;
    g.translate(base.width / 2, base.height);
    g.scale(ppu, ppu);
    g.lineJoin = 'round';
    g.lineCap = 'round';
    draw(g, f);
    const levels = [base];
    if (fog) {
      for (let i = 1; i < FOG_LEVELS.length; i++) {
        const c = makeCanvas(base.width, base.height);
        const cg = c.getContext('2d')!;
        cg.drawImage(base, 0, 0);
        cg.globalCompositeOperation = 'source-atop';
        cg.globalAlpha = FOG_LEVELS[i];
        cg.fillStyle = HAZE;
        cg.fillRect(0, 0, c.width, c.height);
        levels.push(c);
      }
    }
    out.push(levels);
  }
  return { frames: out, w, h };
}

// ---------- tiny helpers ----------
function ell(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string) {
  g.beginPath();
  g.ellipse(x, y, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2);
  g.fillStyle = fill;
  g.fill();
}
function rrect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  g.fillStyle = fill;
  g.fill();
}
function line(g: CanvasRenderingContext2D, pts: number[], w: number, color: string) {
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.lineWidth = w;
  g.strokeStyle = color;
  g.stroke();
}
function hash(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}
export function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(k >= 0 ? c + (255 - c) * k : c * (1 + k))));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
const rgbCache = new Map<string, [number, number, number]>();
function rgb(hex: string): [number, number, number] {
  let v = rgbCache.get(hex);
  if (!v) {
    const n = parseInt(hex.slice(1), 16);
    v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    rgbCache.set(hex, v);
  }
  return v;
}
/** Blend a colour toward the haze by t (0..1). */
export function fogc(hex: string, t: number): string {
  if (t <= 0.01) return hex;
  const a = rgb(hex), b = rgb(HAZE);
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
}

// ---------- people ----------
const SKINS = ['#f1c7a5', '#e0a882', '#c98d66', '#9a6646', '#f5d3b8'];
const HAIRS = ['#2a1d16', '#4a3222', '#7a5230', '#c9a15a', '#1a1a1a', '#9b9b9b'];
const SHIRTS = ['#e8503a', '#2f7fc1', '#f2c14e', '#5aa86b', '#f4f1ea', '#a259c4', '#ef8f5e', '#2b2b33', '#4fb8b0'];
const PANTS = ['#2c3e5a', '#3b3b44', '#6b5844', '#c9b48e', '#1f2a36', '#556b2f'];

interface Look { skin: string; hair: string; shirt: string; pants: string; style: number }
function lookFor(v: number): Look {
  return {
    skin: SKINS[Math.floor(hash(v * 3 + 1) * SKINS.length)],
    hair: HAIRS[Math.floor(hash(v * 5 + 2) * HAIRS.length)],
    shirt: SHIRTS[Math.floor(hash(v * 7 + 3) * SHIRTS.length)],
    pants: PANTS[Math.floor(hash(v * 11 + 4) * PANTS.length)],
    style: v % 6,
  };
}

/** A walker seen from the front, coming toward Rosie. frame 0/1 = stride. */
function drawWalker(g: CanvasRenderingContext2D, L: Look, f: number) {
  const a = (f / 4) * Math.PI * 2;
  const st = Math.sin(a) * 1.6;
  g.translate(0, -Math.abs(Math.cos(a)) * 0.03);
  const longHair = L.style === 1 || L.style === 4;
  const dress = L.style === 4;
  // shadow
  ell(g, 0, 0, 0.32, 0.06, 'rgba(40,25,10,0.28)');
  // legs (one forward = lower & bigger foot)
  const legW = 0.12;
  if (!dress) {
    rrect(g, -0.15, -0.86, legW, 0.82 + st * 0.03, 0.04, shade(L.pants, -0.08));
    rrect(g, 0.03, -0.86, legW, 0.82 - st * 0.03, 0.04, L.pants);
  } else {
    rrect(g, -0.12, -0.6, 0.08, 0.56 + st * 0.03, 0.03, L.skin);
    rrect(g, 0.04, -0.6, 0.08, 0.56 - st * 0.03, 0.03, shade(L.skin, -0.1));
  }
  ell(g, -0.09, -0.02 + st * 0.03, 0.09, 0.045, '#2b2622');
  ell(g, 0.09, -0.02 - st * 0.03, 0.09, 0.045, '#2b2622');
  // torso
  g.beginPath();
  if (dress) {
    g.moveTo(-0.2, -1.38); g.lineTo(0.2, -1.38); g.lineTo(0.3, -0.58); g.lineTo(-0.3, -0.58);
  } else {
    g.moveTo(-0.22, -1.4); g.lineTo(0.22, -1.4); g.lineTo(0.2, -0.82); g.lineTo(-0.2, -0.82);
  }
  g.closePath();
  g.fillStyle = L.shirt;
  g.fill();
  // side shading
  g.globalAlpha = 0.18; g.fillStyle = '#000';
  g.fillRect(0.1, -1.4, 0.12, dress ? 0.8 : 0.58);
  g.globalAlpha = 1;
  // arms swing opposite to legs
  line(g, [-0.24, -1.34, -0.3 - st * 0.03, -1.05, -0.28 - st * 0.06, -0.86], 0.1, shade(L.shirt, -0.12));
  line(g, [0.24, -1.34, 0.3 - st * 0.03, -1.05, 0.28 - st * 0.06, -0.86], 0.1, shade(L.shirt, -0.12));
  ell(g, -0.28 - st * 0.06, -0.84, 0.055, 0.06, L.skin);
  ell(g, 0.28 - st * 0.06, -0.84, 0.055, 0.06, L.skin);
  // props
  if (L.style === 2) {
    // phone held up, eyes on screen
    line(g, [0.24, -1.3, 0.16, -1.22], 0.09, shade(L.shirt, -0.12));
    rrect(g, 0.06, -1.32, 0.1, 0.15, 0.02, '#1b1d22');
  }
  if (L.style === 1) {
    // tote bag on the shoulder
    rrect(g, 0.22, -1.08, 0.2, 0.26, 0.03, '#e9dcc0');
    line(g, [0.24, -1.08, 0.18, -1.38], 0.025, '#b8a77f');
  }
  if (L.style === 5) {
    // shopping bag
    rrect(g, -0.42, -1.0, 0.18, 0.22, 0.03, '#f4f4f4');
    line(g, [-0.36, -1.0, -0.33, -0.86], 0.02, '#999');
  }
  // neck + head
  rrect(g, -0.05, -1.5, 0.1, 0.12, 0.03, shade(L.skin, -0.1));
  if (longHair) rrect(g, -0.15, -1.74, 0.3, 0.36, 0.12, L.hair);
  ell(g, 0, -1.62, 0.12, 0.14, L.skin);
  // face
  ell(g, -0.045, -1.63, 0.016, 0.02, '#2a1d16');
  ell(g, 0.045, -1.63, 0.016, 0.02, '#2a1d16');
  line(g, [-0.035, -1.56, 0, -1.545, 0.035, -1.56], 0.014, '#7a3b2e');
  // hair / hats
  if (L.style === 3) {
    // cap
    g.beginPath(); g.ellipse(0, -1.7, 0.13, 0.09, 0, Math.PI, 0); g.fillStyle = '#d64545'; g.fill();
    rrect(g, -0.14, -1.71, 0.28, 0.035, 0.015, '#b83232');
  } else if (L.style === 5) {
    // sun hat
    ell(g, 0, -1.72, 0.22, 0.045, '#e8d6a8');
    g.beginPath(); g.ellipse(0, -1.73, 0.12, 0.09, 0, Math.PI, 0); g.fillStyle = '#e8d6a8'; g.fill();
    rrect(g, -0.12, -1.75, 0.24, 0.03, 0.01, '#c06b4a');
  } else {
    g.beginPath(); g.ellipse(0, -1.68, 0.125, 0.09, 0, Math.PI, 0); g.fillStyle = L.hair; g.fill();
  }
  if (L.style === 0) {
    // headphones
    g.beginPath(); g.arc(0, -1.64, 0.14, Math.PI * 1.05, Math.PI * 1.95); g.lineWidth = 0.025; g.strokeStyle = '#222'; g.stroke();
    ell(g, -0.13, -1.62, 0.035, 0.05, '#222');
    ell(g, 0.13, -1.62, 0.035, 0.05, '#222');
  }
}

/** Bike rider, front view. kind 0 = city bike, 1 = e-scooter, 2 = delivery e-bike with a box. */
function drawBiker(g: CanvasRenderingContext2D, L: Look, kind: number, f: number) {
  const st = Math.sin((f / 4) * Math.PI * 2) * (kind === 1 ? 0.25 : 1.2);
  ell(g, 0, 0, 0.36, 0.07, 'rgba(40,25,10,0.3)');
  if (kind === 1) {
    // e-scooter: narrow deck, tall stem, rider standing
    rrect(g, -0.035, -0.32, 0.07, 0.32, 0.03, '#1d1f24'); // wheel
    rrect(g, -0.025, -1.08, 0.05, 0.78, 0.02, '#30343c'); // stem
    line(g, [-0.28, -1.08, 0.28, -1.08], 0.045, '#1d1f24');
    ell(g, 0, -0.98, 0.04, 0.025, '#fff7c2');
    rrect(g, -0.14, -0.95, 0.11, 0.78, 0.04, L.pants);
    rrect(g, 0.03, -0.95, 0.11, 0.78, 0.04, shade(L.pants, -0.1));
  } else {
    // bike wheel (seen edge-on), fork, handlebars
    rrect(g, -0.045, -0.66, 0.09, 0.66, 0.04, '#1d1f24');
    rrect(g, -0.02, -0.62, 0.04, 0.56, 0.02, '#8a8f99');
    line(g, [0, -0.66, 0, -0.98], 0.05, kind === 2 ? '#2f8f57' : '#c43d3d');
    line(g, [-0.3, -1.0, -0.12, -0.98, 0.12, -0.98, 0.3, -1.0], 0.045, '#25272c');
    ell(g, 0, -0.86, 0.05, 0.035, '#fff7c2');
    // legs pedalling
    line(g, [-0.13, -1.0, -0.17, -0.62 - st * 0.12, -0.13, -0.32 - st * 0.12], 0.12, L.pants);
    line(g, [0.13, -1.0, 0.17, -0.62 + st * 0.12, 0.13, -0.32 + st * 0.12], 0.12, shade(L.pants, -0.1));
    ell(g, -0.13, -0.3 - st * 0.12, 0.07, 0.04, '#2b2622');
    ell(g, 0.13, -0.3 + st * 0.12, 0.07, 0.04, '#2b2622');
  }
  if (kind === 2) {
    // delivery box behind the rider
    rrect(g, -0.3, -1.72, 0.6, 0.52, 0.05, '#36b37e');
    rrect(g, -0.26, -1.62, 0.52, 0.06, 0.02, shade('#36b37e', 0.35));
  }
  // torso leaning forward (shorter from the front)
  g.beginPath();
  g.moveTo(-0.23, -1.5); g.lineTo(0.23, -1.5); g.lineTo(0.2, -0.98); g.lineTo(-0.2, -0.98); g.closePath();
  g.fillStyle = L.shirt; g.fill();
  // arms to bars
  line(g, [-0.22, -1.44, -0.3, -1.2, -0.28, -1.02], 0.1, shade(L.shirt, -0.15));
  line(g, [0.22, -1.44, 0.3, -1.2, 0.28, -1.02], 0.1, shade(L.shirt, -0.15));
  ell(g, -0.28, -1.0, 0.05, 0.05, L.skin);
  ell(g, 0.28, -1.0, 0.05, 0.05, L.skin);
  // head + helmet
  rrect(g, -0.05, -1.58, 0.1, 0.1, 0.03, shade(L.skin, -0.1));
  ell(g, 0, -1.68, 0.12, 0.13, L.skin);
  ell(g, -0.045, -1.68, 0.016, 0.02, '#2a1d16');
  ell(g, 0.045, -1.68, 0.016, 0.02, '#2a1d16');
  line(g, [-0.035, -1.615, 0.035, -1.615], 0.014, '#7a3b2e');
  const helmet = kind === 2 ? '#2b2b33' : kind === 1 ? '#f4f1ea' : '#f2c14e';
  g.beginPath(); g.ellipse(0, -1.73, 0.15, 0.12, 0, Math.PI, 0); g.fillStyle = helmet; g.fill();
  rrect(g, -0.15, -1.74, 0.3, 0.035, 0.015, shade(helmet, -0.2));
}

// ---------- low obstacles ----------
function drawLow(g: CanvasRenderingContext2D, kind: number) {
  ell(g, 0, 0, 0.62, 0.08, 'rgba(40,25,10,0.3)');
  if (kind === 0) {
    // crate of Jaffa oranges
    rrect(g, -0.5, -0.42, 1.0, 0.42, 0.03, '#b98a52');
    for (let i = 0; i < 3; i++) rrect(g, -0.48, -0.38 + i * 0.13, 0.96, 0.05, 0.01, shade('#b98a52', -0.18));
    line(g, [-0.5, -0.42, -0.5, 0], 0.05, '#8c6236');
    line(g, [0.5, -0.42, 0.5, 0], 0.05, '#8c6236');
    for (let i = 0; i < 9; i++) {
      const x = -0.4 + (i % 5) * 0.2 + (i >= 5 ? 0.1 : 0);
      const y = i >= 5 ? -0.58 : -0.47;
      ell(g, x, y, 0.1, 0.095, '#f28a1c');
      ell(g, x - 0.03, y - 0.03, 0.03, 0.025, '#ffc070');
    }
    ell(g, 0.05, -0.62, 0.05, 0.025, '#4f8a35');
  } else if (kind === 1) {
    // rental e-scooter lying on its side
    line(g, [-0.55, -0.12, 0.45, -0.12], 0.08, '#2d3038');
    line(g, [0.42, -0.14, 0.62, -0.42], 0.06, '#3a3f49');
    line(g, [0.62, -0.42, 0.62, -0.2], 0.05, '#1f2228');
    ell(g, -0.48, -0.12, 0.12, 0.12, '#1b1c20');
    ell(g, -0.48, -0.12, 0.05, 0.05, '#9aa0aa');
    ell(g, 0.44, -0.12, 0.12, 0.12, '#1b1c20');
    ell(g, 0.44, -0.12, 0.05, 0.05, '#9aa0aa');
    rrect(g, -0.4, -0.2, 0.7, 0.07, 0.03, '#9be04a');
  } else {
    // pile of fallen palm fronds
    for (let i = 0; i < 4; i++) {
      const y = -0.08 - i * 0.07;
      const dir = i % 2 ? 1 : -1;
      g.beginPath();
      g.moveTo(-0.6 * dir, y + 0.04);
      g.quadraticCurveTo(0, y - 0.18, 0.62 * dir, y);
      g.lineWidth = 0.05; g.strokeStyle = '#8a7a3c'; g.stroke();
      for (let k = 0; k < 10; k++) {
        const t = k / 10;
        const x = (-0.6 + 1.2 * t) * dir;
        const yy = y + 0.04 - 0.22 * t * (1 - t) * 1.6;
        line(g, [x, yy, x + 0.08 * dir, yy - 0.16], 0.03, i % 2 ? '#7d8f3a' : '#a59a4a');
        line(g, [x, yy, x + 0.1 * dir, yy + 0.05], 0.03, '#6e7d33');
      }
    }
  }
}

// ---------- trees & park furniture ----------
function drawPalm(g: CanvasRenderingContext2D, v: number) {
  const h = 7.2 + hash(v) * 2.2;
  const lean = (hash(v + 9) - 0.5) * 0.9;
  ell(g, 0, 0, 0.9, 0.18, 'rgba(60,35,10,0.22)');
  // trunk: tapered with ring texture
  const steps = 26;
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps, t1 = (i + 1) / steps;
    const x0 = lean * t0 * t0, x1 = lean * t1 * t1;
    const w0 = 0.26 - 0.1 * t0, w1 = 0.26 - 0.1 * t1;
    g.beginPath();
    g.moveTo(x0 - w0, -h * t0); g.lineTo(x0 + w0, -h * t0); g.lineTo(x1 + w1, -h * t1 - 0.02); g.lineTo(x1 - w1, -h * t1 - 0.02);
    g.closePath();
    g.fillStyle = i % 2 ? '#8b6b4b' : '#7a5c3f';
    g.fill();
    g.fillStyle = 'rgba(255,214,150,0.25)';
    g.fillRect(x0 - w0, -h * t1, w0 * 0.6, h / steps);
  }
  const cx = lean, cy = -h;
  // dead fronds hanging
  for (let i = 0; i < 6; i++) {
    const a = Math.PI * 0.5 + (i - 2.5) * 0.28;
    frond(g, cx, cy + 0.2, a, 1.8, '#8f7a45', '#a8925a');
  }
  // green crown
  const n = 11;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI * 0.05 - (i / (n - 1)) * Math.PI * 1.1 + (hash(v * 13 + i) - 0.5) * 0.2;
    const droop = Math.sin(a) > 0 ? 1 : 0;
    frond(g, cx, cy, a + droop * 0.4, 2.6 + hash(v + i) * 0.6, i % 2 ? '#3f6b2c' : '#4f7d34', '#7ea446');
  }
  ell(g, cx, cy + 0.05, 0.25, 0.22, '#6b5a2e');
  // date clusters
  ell(g, cx - 0.2, cy + 0.35, 0.14, 0.2, '#c7782a');
  ell(g, cx + 0.22, cy + 0.32, 0.12, 0.18, '#b8692a');
}
function frond(g: CanvasRenderingContext2D, x: number, y: number, a: number, len: number, c: string, hi: string) {
  const ex = x + Math.cos(a) * len;
  const ey = y + Math.sin(a) * len * 0.75 + len * 0.35; // gravity droop
  const mx = x + Math.cos(a) * len * 0.5;
  const my = y + Math.sin(a) * len * 0.5 - 0.1;
  g.beginPath();
  g.moveTo(x, y);
  g.quadraticCurveTo(mx, my, ex, ey);
  g.lineWidth = 0.06; g.strokeStyle = c; g.stroke();
  // leaflets
  for (let k = 1; k < 12; k++) {
    const t = k / 12;
    const px = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * mx + t * t * ex;
    const py = (1 - t) * (1 - t) * y + 2 * (1 - t) * t * my + t * t * ey;
    const l = 0.55 * (1 - t * 0.6);
    const nx = -Math.sin(a), ny = Math.cos(a);
    line(g, [px, py, px + nx * l * 0.6 + 0.05, py + ny * l * 0.3 + l * 0.5], 0.07, k % 3 === 0 ? hi : c);
    line(g, [px, py, px - nx * l * 0.6 + 0.05, py - ny * l * 0.3 + l * 0.5], 0.07, c);
  }
}
function drawFicus(g: CanvasRenderingContext2D, v: number) {
  const h = 6.2 + hash(v) * 1.6;
  const r = 2.4 + hash(v + 3) * 0.8;
  ell(g, 0, 0, r * 0.9, 0.35, 'rgba(40,30,10,0.28)');
  // thick grey trunk with buttress roots and a couple of aerial roots
  g.beginPath();
  g.moveTo(-0.55, 0); g.quadraticCurveTo(-0.25, -0.4, -0.28, -h * 0.45);
  g.lineTo(0.3, -h * 0.45); g.quadraticCurveTo(0.25, -0.4, 0.6, 0); g.closePath();
  g.fillStyle = '#8e8a80'; g.fill();
  g.fillStyle = 'rgba(255,220,170,0.25)'; g.fillRect(-0.22, -h * 0.45, 0.14, h * 0.42);
  line(g, [-0.1, -h * 0.45, -0.9, -h * 0.62], 0.16, '#7f7b72');
  line(g, [0.1, -h * 0.45, 0.95, -h * 0.66], 0.16, '#7f7b72');
  line(g, [-0.75, -h * 0.58, -0.8, -0.2], 0.03, '#7a746a');
  line(g, [0.85, -h * 0.6, 0.9, -0.5], 0.03, '#7a746a');
  // dense canopy: dark base, mid blobs, warm sunlit tops
  const cy = -h + r * 0.55;
  const blobs = 16;
  const pts: [number, number, number][] = [];
  for (let i = 0; i < blobs; i++) {
    const a = hash(v * 31 + i) * Math.PI * 2;
    const d = Math.sqrt(hash(v * 17 + i)) * r * 0.75;
    pts.push([Math.cos(a) * d * 1.15, cy + Math.sin(a) * d * 0.62, r * (0.38 + hash(v * 7 + i) * 0.22)]);
  }
  for (const [x, y, rr] of pts) ell(g, x, y + rr * 0.12, rr, rr * 0.85, '#1f3d22');
  for (const [x, y, rr] of pts) ell(g, x, y, rr * 0.9, rr * 0.78, '#2f5a2c');
  for (const [x, y, rr] of pts) if (y < cy + 0.2) ell(g, x - rr * 0.15, y - rr * 0.25, rr * 0.6, rr * 0.45, '#46783a');
  for (const [x, y, rr] of pts) if (y < cy - 0.3) ell(g, x - rr * 0.25, y - rr * 0.4, rr * 0.32, rr * 0.22, '#7fa64e');
  // leaf speckles
  for (let i = 0; i < 70; i++) {
    const a = hash(v * 101 + i) * Math.PI * 2;
    const d = Math.sqrt(hash(v * 103 + i)) * r * 0.95;
    const x = Math.cos(a) * d * 1.15, y = cy + Math.sin(a) * d * 0.62;
    ell(g, x, y, 0.07, 0.05, i % 3 ? '#5c8c41' : '#1a3320');
  }
}
function drawBench(g: CanvasRenderingContext2D) {
  // wooden slatted bench, seen from the front at an angle
  ell(g, 0, 0, 0.95, 0.1, 'rgba(40,25,10,0.25)');
  line(g, [-0.7, 0, -0.7, -0.45], 0.06, '#3b3b3e');
  line(g, [0.7, 0, 0.7, -0.45], 0.06, '#3b3b3e');
  for (let i = 0; i < 2; i++) rrect(g, -0.85, -0.48 - i * 0.07, 1.7, 0.055, 0.02, i ? '#9b6a3e' : '#8a5c33');
  for (let i = 0; i < 3; i++) rrect(g, -0.85, -0.95 + i * 0.11, 1.7, 0.08, 0.02, '#a8743f');
  line(g, [-0.7, -0.45, -0.72, -0.98], 0.05, '#3b3b3e');
  line(g, [0.7, -0.45, 0.72, -0.98], 0.05, '#3b3b3e');
}
function drawPicnic(g: CanvasRenderingContext2D) {
  ell(g, 0, 0, 1.3, 0.14, 'rgba(40,25,10,0.25)');
  rrect(g, -1.15, -0.48, 2.3, 0.08, 0.02, '#7d5530');
  line(g, [-0.7, -0.75, -0.95, 0], 0.08, '#6b4626');
  line(g, [0.7, -0.75, 0.95, 0], 0.08, '#6b4626');
  rrect(g, -1.0, -0.82, 2.0, 0.1, 0.02, '#a8743f');
  rrect(g, -1.0, -0.86, 2.0, 0.04, 0.02, '#c08a52');
}
function drawLampPost(g: CanvasRenderingContext2D) {
  line(g, [0, 0, 0, -4.8], 0.1, '#4a4c50');
  line(g, [0, -4.6, 0.5, -4.85], 0.06, '#4a4c50');
  rrect(g, 0.35, -4.95, 0.35, 0.14, 0.05, '#3a3c40');
  ell(g, 0.52, -4.8, 0.12, 0.05, '#ffe9b0');
}
/** Median ficus: tall bare trunk so the canopy arches over the bike path and the tracks. */
function drawMedianFicus(g: CanvasRenderingContext2D, v: number) {
  const h = 7.4 + hash(v) * 1.2;
  const r = 2.1 + hash(v + 3) * 0.5;
  ell(g, 0, 0, 0.6, 0.12, 'rgba(40,30,10,0.28)');
  g.beginPath();
  g.moveTo(-0.32, 0); g.quadraticCurveTo(-0.16, -0.4, -0.17, -h * 0.62);
  g.lineTo(0.17, -h * 0.62); g.quadraticCurveTo(0.16, -0.4, 0.34, 0); g.closePath();
  g.fillStyle = '#8e8a80'; g.fill();
  g.fillStyle = 'rgba(255,220,170,0.25)'; g.fillRect(-0.12, -h * 0.62, 0.08, h * 0.6);
  line(g, [-0.05, -h * 0.6, -0.8, -h * 0.74], 0.12, '#7f7b72');
  line(g, [0.05, -h * 0.6, 0.85, -h * 0.76], 0.12, '#7f7b72');
  const cy = -h + r * 0.5;
  const pts: [number, number, number][] = [];
  for (let i = 0; i < 14; i++) {
    const a = hash(v * 31 + i) * Math.PI * 2;
    const d = Math.sqrt(hash(v * 17 + i)) * r * 0.75;
    pts.push([Math.cos(a) * d * 1.25, cy + Math.sin(a) * d * 0.5, r * (0.36 + hash(v * 7 + i) * 0.2)]);
  }
  for (const [x, y, rr] of pts) ell(g, x, y + rr * 0.12, rr, rr * 0.8, '#1f3d22');
  for (const [x, y, rr] of pts) ell(g, x, y, rr * 0.9, rr * 0.72, '#2f5a2c');
  for (const [x, y, rr] of pts) if (y < cy + 0.2) ell(g, x - rr * 0.15, y - rr * 0.25, rr * 0.6, rr * 0.42, '#46783a');
  for (const [x, y, rr] of pts) if (y < cy - 0.3) ell(g, x - rr * 0.25, y - rr * 0.4, rr * 0.32, rr * 0.2, '#7fa64e');
  for (let i = 0; i < 50; i++) {
    const a = hash(v * 101 + i) * Math.PI * 2;
    const d = Math.sqrt(hash(v * 103 + i)) * r * 0.95;
    ell(g, Math.cos(a) * d * 1.25, cy + Math.sin(a) * d * 0.5, 0.07, 0.05, i % 3 ? '#5c8c41' : '#1a3320');
  }
}
/** Tamarisk: feathery grey-green small tree (planted on the southern stretch). */
function drawTamarisk(g: CanvasRenderingContext2D, v: number) {
  const h = 4.2 + hash(v) * 1.0;
  ell(g, 0, 0, 0.7, 0.12, 'rgba(40,30,10,0.22)');
  line(g, [0, 0, 0.1, -h * 0.45, -0.05, -h * 0.6], 0.16, '#7a6a58');
  line(g, [0.08, -h * 0.4, 0.6, -h * 0.7], 0.08, '#7a6a58');
  for (let i = 0; i < 26; i++) {
    const a = hash(v * 13 + i) * Math.PI * 2, d = Math.sqrt(hash(v * 7 + i)) * 1.5;
    const x = Math.cos(a) * d * 1.1, y = -h * 0.72 + Math.sin(a) * d * 0.6;
    ell(g, x, y, 0.45, 0.32, i % 3 ? '#8fa27a' : '#6f8460');
    if (i % 4 === 0) ell(g, x - 0.1, y - 0.1, 0.2, 0.12, '#b5c49c');
  }
}
/** Fenced planter with grasses (the median's planters between the trees). */
function drawPlanter(g: CanvasRenderingContext2D) {
  rrect(g, -0.7, -0.35, 1.4, 0.35, 0.03, '#8b8f94');
  for (let i = 0; i < 9; i++) { const x = -0.6 + i * 0.15; line(g, [x, -0.3, x - 0.05 + hash(i) * 0.1, -0.75 - hash(i + 3) * 0.2], 0.05, i % 2 ? '#a7b56d' : '#7f9450'); }
  line(g, [-0.7, -0.5, 0.7, -0.5], 0.03, '#5c6066');
  for (const x of [-0.7, 0, 0.7]) line(g, [x, -0.5, x, -0.35], 0.03, '#5c6066');
}
function drawMinaret(g: CanvasRenderingContext2D) {
  rrect(g, -0.45, -13, 0.9, 13, 0.05, '#e6dccb');
  rrect(g, -0.62, -10.4, 1.24, 0.35, 0.05, '#cfc2ac');
  rrect(g, -0.55, -12.6, 1.1, 0.3, 0.05, '#cfc2ac');
  for (let i = 0; i < 3; i++) rrect(g, -0.12, -9.5 + i * 2.6, 0.24, 0.9, 0.12, '#5a5246');
  g.beginPath(); g.moveTo(-0.45, -13); g.lineTo(0, -14.6); g.lineTo(0.45, -13); g.closePath(); g.fillStyle = '#4f8a6a'; g.fill();
  line(g, [0, -14.6, 0, -15.2], 0.05, '#c9a54a');
  // the mosque's dome below
  g.beginPath(); g.ellipse(2.4, -5.2, 2.2, 2.0, 0, Math.PI, 0); g.fillStyle = '#4f8a6a'; g.fill();
  rrect(g, 0.2, -5.2, 4.4, 5.2, 0.05, '#e6dccb');
  for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(1.1 + i * 1.3, -3.2, 0.35, 0.6, 0, Math.PI, 0); g.lineTo(1.45 + i * 1.3, -1.6); g.lineTo(0.75 + i * 1.3, -1.6); g.closePath(); g.fillStyle = '#5a5246'; g.fill(); }
}
function drawFloodlights(g: CanvasRenderingContext2D) {
  // Bloomfield Stadium seen over the rooftops: a long stand roof and floodlight masts
  g.beginPath(); g.moveTo(-9, -9); g.quadraticCurveTo(0, -11, 9, -9); g.lineTo(9, -7.6); g.quadraticCurveTo(0, -9.4, -9, -7.6); g.closePath();
  g.fillStyle = '#d8dde2'; g.fill();
  rrect(g, -9, -7.7, 18, 7.7, 0.05, '#9aa4ae');
  for (let i = 0; i < 8; i++) rrect(g, -8.6 + i * 2.2, -6.8, 1.6, 0.5, 0.05, '#6f7c8a');
  for (const x of [-8.5, 8.5]) {
    line(g, [x, 0, x, -16], 0.18, '#7d858c');
    rrect(g, x - 1, -17.4, 2, 1.4, 0.1, '#5c646b');
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) ell(g, x - 0.6 + i * 0.6, -17.0 + j * 0.6, 0.2, 0.2, '#f6f1d8');
  }
}
function drawClockTower(g: CanvasRenderingContext2D) {
  // Jaffa's Ottoman clock tower: pale limestone, three storeys, clock faces, crenellated top
  const C = '#e2cfa8', D = '#c8b48c';
  rrect(g, -1.4, -4, 2.8, 4, 0.05, C);
  rrect(g, -1.2, -8, 2.4, 4, 0.05, C);
  rrect(g, -1.0, -11.5, 2.0, 3.5, 0.05, C);
  for (const y of [-4, -8, -11.5]) rrect(g, -1.5, y - 0.25, 3.0, 0.35, 0.05, D);
  g.beginPath(); g.ellipse(0, -2.2, 0.5, 0.9, 0, Math.PI, 0); g.lineTo(0.5, -0.1); g.lineTo(-0.5, -0.1); g.closePath(); g.fillStyle = '#5b4b3a'; g.fill();
  for (const y of [-6.2]) { g.beginPath(); g.ellipse(0, y, 0.35, 0.7, 0, Math.PI, 0); g.lineTo(0.35, y + 1.1); g.lineTo(-0.35, y + 1.1); g.closePath(); g.fillStyle = '#5b4b3a'; g.fill(); }
  ell(g, 0, -10.0, 0.75, 0.75, '#f7f3e6');
  g.strokeStyle = '#2b2b2b'; g.lineWidth = 0.08;
  g.beginPath(); g.arc(0, -10.0, 0.75, 0, Math.PI * 2); g.stroke();
  line(g, [0, -10.0, 0, -10.5], 0.08, '#2b2b2b'); line(g, [0, -10.0, 0.35, -10.0], 0.08, '#2b2b2b');
  for (let i = 0; i < 5; i++) rrect(g, -1.05 + i * 0.47, -12.1, 0.3, 0.6, 0.02, C);
  line(g, [0, -12.1, 0, -13.2], 0.06, '#666'); 
}
function drawBeitGidi(g: CanvasRenderingContext2D) {
  // Etzel Museum: a ruined stone house with a dark glass box set on top of it
  const S = '#d8c39a';
  rrect(g, -3, -3.4, 6, 3.4, 0.05, S);
  for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(-2.1 + i * 1.4, -2.0, 0.4, 0.6, 0, Math.PI, 0); g.lineTo(-1.7 + i * 1.4, -0.4); g.lineTo(-2.5 + i * 1.4, -0.4); g.closePath(); g.fillStyle = '#6b5a44'; g.fill(); }
  g.beginPath(); g.moveTo(-3, -3.4); g.lineTo(-2.2, -4.2); g.lineTo(-1.2, -3.6); g.lineTo(0.4, -4.4); g.lineTo(1.6, -3.7); g.lineTo(3, -4.0); g.lineTo(3, -3.4); g.closePath(); g.fillStyle = S; g.fill();
  rrect(g, -2.6, -6.6, 5.4, 2.6, 0.05, '#2c3e4f');
  for (let i = 0; i < 6; i++) line(g, [-2.6 + i * 0.9, -6.6, -2.6 + i * 0.9, -4.0], 0.05, '#7f99ad');
  g.globalAlpha = 0.35; rrect(g, -2.4, -6.4, 2.2, 1.0, 0.05, '#cfe3f2'); g.globalAlpha = 1;
}

// ---------- things to duck under ----------
/** A ficus limb drooping low over the bike path (street level): leaves hang down to ~0.65. */
function drawLowBranch(g: CanvasRenderingContext2D) {
  line(g, [-1.2, -1.75, -0.4, -1.45, 0.5, -1.35, 1.2, -1.55], 0.12, '#7f7b72');
  for (let i = 0; i < 22; i++) {
    const x = -0.95 + (i % 11) * 0.19, y = -1.25 + (i > 10 ? 0.28 : 0) + hash(i) * 0.12;
    ell(g, x, y, 0.2, 0.15, i % 3 ? '#2f5a2c' : '#46783a');
    if (i % 4 === 0) ell(g, x - 0.05, y + 0.12, 0.09, 0.07, '#1f3d22');
  }
  for (let i = 0; i < 6; i++) line(g, [-0.8 + i * 0.32, -1.1, -0.82 + i * 0.32, -0.66 - hash(i + 4) * 0.1], 0.025, '#6f6a60');
}
/** Red-and-white barrier boom across the path (street level). */
function drawBoom(g: CanvasRenderingContext2D) {
  rrect(g, -0.95, -1.05, 0.12, 1.05, 0.03, '#5a5d63');
  rrect(g, 0.83, -1.05, 0.12, 1.05, 0.03, '#5a5d63');
  for (let i = 0; i < 8; i++) rrect(g, -0.9 + i * 0.225, -0.95, 0.225, 0.2, 0.0, i % 2 ? '#f4f1ea' : '#d63a2f');
  rrect(g, -0.3, -0.75, 0.6, 0.3, 0.04, '#f4f1ea');
  rrect(g, -0.3, -0.75, 0.6, 0.06, 0.02, '#d63a2f');
  ell(g, 0, -0.6, 0.08, 0.08, '#d63a2f');
}
/** Overhanging ficus foliage at tram-roof height (sprite drawn hanging; its base sits at roof + 0.6). */
function drawRoofBranch(g: CanvasRenderingContext2D, v: number) {
  line(g, [-1.1, -1.5, -0.3, -1.2, 0.6, -1.15, 1.1, -1.4], 0.11, '#7f7b72');
  for (let i = 0; i < 18; i++) {
    const x = -0.9 + (i % 9) * 0.22, y = -1.0 + (i > 8 ? 0.3 : 0) + hash(v * 9 + i) * 0.14;
    ell(g, x, y, 0.22, 0.17, i % 3 ? '#2f5a2c' : '#46783a');
    if (i % 3 === 0) ell(g, x - 0.06, y - 0.08, 0.1, 0.07, '#7fa64e');
  }
}
/** A palm frond sweeping down across the track at roof height. */
function drawRoofFrond(g: CanvasRenderingContext2D) {
  g.beginPath(); g.moveTo(-1.1, -1.5); g.quadraticCurveTo(0, -1.15, 1.1, -0.6);
  g.lineWidth = 0.06; g.strokeStyle = '#6e7d33'; g.stroke();
  for (let k = 0; k < 14; k++) {
    const t = k / 14, x = -1.1 + 2.2 * t, y = -1.5 + 0.9 * t * t + 0.25 * t;
    line(g, [x, y, x + 0.08, y + 0.45], 0.05, k % 3 ? '#4f7d34' : '#7ea446');
    line(g, [x, y, x - 0.1, y + 0.35], 0.05, '#3f6b2c');
  }
}
/** A low steel gantry across a track: legs outside the tram, beam at roof + ~0.8. */
function drawGantry(g: CanvasRenderingContext2D) {
  const top = -(2.9 + 1.0);
  rrect(g, -0.98, top, 0.1, -top, 0.02, '#6a6f76');
  rrect(g, 0.88, top, 0.1, -top, 0.02, '#6a6f76');
  rrect(g, -1.05, top - 0.05, 2.1, 0.22, 0.03, '#7d838b');
  for (let i = 0; i < 7; i++) line(g, [-0.95 + i * 0.3, top + 0.17, -0.8 + i * 0.3, top - 0.03], 0.03, '#5a5f66');
  rrect(g, -0.25, top + 0.17, 0.5, 0.18, 0.02, '#f2c230');
}
/** A station canopy beam reaching over the track (red fascia, white underside). */
function drawCanopyBeam(g: CanvasRenderingContext2D) {
  rrect(g, -1.0, -0.42, 2.0, 0.16, 0.02, '#e8e4dc');
  rrect(g, -1.0, -0.3, 2.0, 0.22, 0.02, '#d22e2e');
  for (const x of [-0.6, 0.6]) line(g, [x, -0.42, x, -0.75], 0.04, '#5c5f66');
}

function drawSolar(g: CanvasRenderingContext2D) {
  // rooftop solar water heater ("dud shemesh"): tank + tilted panels
  line(g, [-0.6, 0, -0.6, -0.5], 0.05, '#8a8a88');
  line(g, [0.6, 0, 0.6, -0.5], 0.05, '#8a8a88');
  rrect(g, -0.75, -0.95, 1.5, 0.42, 0.2, '#e9e7e2');
  rrect(g, -0.75, -0.95, 1.5, 0.1, 0.05, '#ffffff');
  g.beginPath();
  g.moveTo(-0.9, -0.1); g.lineTo(0.9, -0.1); g.lineTo(0.75, -0.55); g.lineTo(-0.75, -0.55); g.closePath();
  g.fillStyle = '#2f4a6b'; g.fill();
  line(g, [0, -0.1, 0, -0.55], 0.03, '#8aa2c0');
}

// ---------- treats and power-ups ----------
function drawBone(g: CanvasRenderingContext2D) {
  // dog biscuit bone, centred at y = -0.2
  g.translate(0, -0.2);
  const C = '#e9c37c', O = '#8a5a26';
  const shape = () => {
    g.beginPath();
    g.roundRect(-0.2, -0.06, 0.4, 0.12, 0.04);
    for (const [x, y] of [[-0.22, -0.07], [-0.22, 0.07], [0.22, -0.07], [0.22, 0.07]]) { g.moveTo(x + 0.08, y); g.arc(x, y, 0.08, 0, Math.PI * 2); }
  };
  shape(); g.lineWidth = 0.05; g.strokeStyle = O; g.stroke();
  shape(); g.fillStyle = C; g.fill();
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.beginPath(); g.roundRect(-0.15, -0.045, 0.22, 0.03, 0.015); g.fill();
  for (const x of [-0.08, 0, 0.08]) ell(g, x, 0.02, 0.012, 0.012, '#b98a4a');
}
function drawBoardItem(g: CanvasRenderingContext2D) {
  g.translate(0, -0.25);
  g.rotate(-0.25);
  rrect(g, -0.42, -0.07, 0.84, 0.14, 0.07, '#1f9aa6');
  rrect(g, -0.38, -0.07, 0.76, 0.05, 0.03, '#2b2b30');
  rrect(g, -0.2, -0.02, 0.4, 0.05, 0.02, '#f2c14e');
  for (const x of [-0.27, 0.27]) { ell(g, x, 0.1, 0.06, 0.06, '#ff7a3a'); ell(g, x, 0.1, 0.025, 0.025, '#ffd8a0'); }
}
function drawMagnet(g: CanvasRenderingContext2D) {
  g.translate(0, -0.25);
  g.beginPath();
  g.arc(0, 0, 0.2, Math.PI, 0, false);
  g.lineWidth = 0.13; g.strokeStyle = '#d63a2f'; g.stroke();
  g.beginPath(); g.arc(0, 0, 0.2, Math.PI * 1.15, Math.PI * 1.4); g.lineWidth = 0.035; g.strokeStyle = 'rgba(255,255,255,0.6)'; g.stroke();
  rrect(g, -0.265, 0, 0.13, 0.14, 0.02, '#d63a2f');
  rrect(g, 0.135, 0, 0.13, 0.14, 0.02, '#d63a2f');
  rrect(g, -0.265, 0.1, 0.13, 0.09, 0.02, '#dfe3e8');
  rrect(g, 0.135, 0.1, 0.13, 0.09, 0.02, '#dfe3e8');
}

/** Rosie's skateboard seen from behind (drawn under her feet, in units). */
export function drawBoardUnder(g: CanvasRenderingContext2D, x: number, y: number, u: number, tilt: number) {
  g.save();
  g.translate(x, y);
  g.scale(u, u);
  g.rotate(tilt);
  rrect(g, -0.24, -0.07, 0.48, 0.07, 0.035, '#1f9aa6');
  rrect(g, -0.24, -0.075, 0.48, 0.025, 0.012, '#2b2b30');
  for (const sx of [-0.17, 0.17]) { rrect(g, sx - 0.045, -0.02, 0.09, 0.07, 0.03, '#ff7a3a'); }
  g.restore();
}

// ---------- the cast ----------
export interface Sprites {
  walkers: Sprite[];
  bikers: Sprite[];
  lows: Sprite[];
  palms: Sprite[];
  ficus: Sprite[];
  bench: Sprite;
  picnic: Sprite;
  lamp: Sprite;
  solar: Sprite;
  medianFicus: Sprite[];
  tamarisk: Sprite[];
  planter: Sprite;
  minaret: Sprite;
  stadium: Sprite;
  clockTower: Sprite;
  beitGidi: Sprite;
  bone: Sprite;
  boardItem: Sprite;
  magnet: Sprite;
  lowBranch: Sprite;
  boom: Sprite;
  roofBranch: Sprite[];
  roofFrond: Sprite;
  gantry: Sprite;
  canopyBeam: Sprite;
}

export function buildSprites(): Sprites {
  const walkers: Sprite[] = [];
  for (let v = 0; v < 12; v++) {
    const L = lookFor(v + 1);
    walkers.push(makeSprite(1.0, 1.9, 90, (g, f) => drawWalker(g, L, f), 4));
  }
  const bikers: Sprite[] = [];
  for (let v = 0; v < 6; v++) {
    const L = lookFor(v + 40);
    bikers.push(makeSprite(0.9, 1.9, 90, (g, f) => drawBiker(g, L, v % 3, f), 4));
  }
  const lows = [0, 1, 2].map((k) => makeSprite(1.9, 1.1, 80, (g) => { g.scale(1.3, 1.3); drawLow(g, k); }));
  const palms = [1, 2, 3].map((v) => makeSprite(7, 10.5, 46, (g) => drawPalm(g, v)));
  const ficus = [1, 2, 3].map((v) => makeSprite(7.6, 8.4, 46, (g) => drawFicus(g, v)));
  return {
    walkers, bikers, lows, palms, ficus,
    bench: makeSprite(2, 1.1, 60, drawBench),
    picnic: makeSprite(2.8, 1.0, 60, drawPicnic),
    lamp: makeSprite(1.4, 5.1, 40, drawLampPost),
    solar: makeSprite(2, 1.1, 40, drawSolar),
    medianFicus: [1, 2, 3].map((v) => makeSprite(6.6, 9.0, 40, (g) => drawMedianFicus(g, v))),
    tamarisk: [1, 2].map((v) => makeSprite(3.8, 5.6, 40, (g) => drawTamarisk(g, v))),
    planter: makeSprite(1.6, 1.0, 60, drawPlanter),
    minaret: makeSprite(5, 15.4, 24, drawMinaret),
    stadium: makeSprite(20, 17.8, 14, drawFloodlights),
    clockTower: makeSprite(3.2, 13.4, 26, drawClockTower),
    beitGidi: makeSprite(6.4, 6.8, 30, drawBeitGidi),
    lowBranch: makeSprite(2.6, 1.9, 60, drawLowBranch),
    boom: makeSprite(2.0, 1.1, 70, drawBoom),
    roofBranch: [1, 2].map((v) => makeSprite(2.4, 1.6, 60, (g) => drawRoofBranch(g, v))),
    roofFrond: makeSprite(2.4, 1.6, 60, drawRoofFrond),
    gantry: makeSprite(2.2, 4.0, 40, drawGantry),
    canopyBeam: makeSprite(2.1, 0.8, 70, drawCanopyBeam),
    bone: makeSprite(0.7, 0.42, 120, drawBone),
    boardItem: makeSprite(1.0, 0.55, 110, drawBoardItem),
    magnet: makeSprite(0.65, 0.5, 120, drawMagnet),
  };
}

/**
 * Rosie seen from behind, walking away from the camera. Origin at her feet, `u` px per world unit.
 * phase: gait cycle (radians). tailWag: radians. lean: -1..1 sideways lean while changing lanes.
 */
export function drawRosie(g: CanvasRenderingContext2D, x: number, y: number, u: number, phase: number, wag: number, lean: number, airborne: boolean) {
  g.save();
  g.translate(x, y);
  g.scale(u, u);
  // body rolls with each stride and leans into lane changes
  g.rotate(lean * 0.14 + (airborne ? 0 : Math.sin(phase) * 0.04));
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const bob = airborne ? 0 : Math.abs(Math.sin(phase)) * 0.055;
  const s1 = Math.sin(phase), s2 = Math.sin(phase + Math.PI);
  const WHITE = '#f6f3ee', SHADOW = '#d9d3ca', BLACK = '#161616', TEAL = '#1f9aa6';
  // front legs (behind the body), visible under the chest
  const fl = (lx: number, s: number) => {
    const lift = airborne ? 0.14 : Math.max(0, s) * 0.14;
    line(g, [lx, -0.42 - bob, lx + s * 0.01, -0.18 - lift, lx, -0.03 - lift], 0.05, SHADOW);
    ell(g, lx, -0.025 - lift, 0.035, 0.022, '#cfc8bd');
  };
  fl(-0.075, s2);
  fl(0.075, s1);
  // head (black) and ears, seen from behind, above the back
  // head bobs a beat behind the body and sways; ears flap with every stride (and fly up in a jump)
  const hy = -0.79 - bob * 1.1 + Math.sin(phase * 2 + 0.9) * 0.02;
  const hx = Math.sin(phase) * 0.018;
  const flap = airborne ? -0.7 : Math.sin(phase * 2 + 1.3) * 0.34;
  ell(g, hx * 0.5, hy + 0.12, 0.085, 0.09, WHITE); // white neck/chest edge
  ell(g, hx, hy, 0.115, 0.115, BLACK);
  g.save();
  g.translate(hx - 0.095, hy - 0.05); g.rotate(-0.5 + flap);
  ell(g, 0, 0.05, 0.05, 0.09 + Math.max(0, -flap) * 0.02, BLACK); g.restore();
  g.save();
  g.translate(hx + 0.095, hy - 0.05); g.rotate(0.5 - flap);
  ell(g, 0, 0.05, 0.05, 0.09 + Math.max(0, -flap) * 0.02, BLACK); g.restore();
  ell(g, hx - 0.04, hy - 0.05, 0.03, 0.02, 'rgba(255,255,255,0.18)');
  // torso (receding)
  ell(g, 0, -0.56 - bob, 0.17, 0.15, WHITE);
  ell(g, 0.05, -0.53 - bob, 0.1, 0.1, SHADOW);
  // harness: teal straps round the chest + back plate with the D-ring
  g.beginPath();
  g.ellipse(0, -0.6 - bob, 0.175, 0.1, 0, Math.PI * 1.05, Math.PI * 1.95);
  g.lineWidth = 0.05; g.strokeStyle = TEAL; g.stroke();
  rrect(g, -0.07, -0.72 - bob, 0.14, 0.1, 0.03, TEAL);
  rrect(g, -0.07, -0.72 - bob, 0.14, 0.025, 0.012, '#4cc2cc');
  g.beginPath(); g.arc(0, -0.735 - bob, 0.025, 0, Math.PI * 2); g.lineWidth = 0.014; g.strokeStyle = '#d8dde0'; g.stroke();
  // hind legs: thigh then thin shank, alternating
  const hl = (lx: number, s: number, dir: number) => {
    const lift = airborne ? 0.18 : Math.max(0, s) * 0.19;
    g.beginPath();
    g.ellipse(lx, -0.4 - bob, 0.07, 0.11, dir * 0.15, 0, Math.PI * 2);
    g.fillStyle = WHITE; g.fill();
    line(g, [lx + dir * 0.02, -0.33 - bob, lx + dir * 0.03, -0.17 - lift * 0.6, lx + dir * 0.015, -0.03 - lift], 0.05, WHITE);
    ell(g, lx + dir * 0.015, -0.025 - lift, 0.038, 0.024, '#e6e0d6');
  };
  hl(-0.1, s1, -1);
  hl(0.1, s2, 1);
  // rump with her big black spot near the tail
  ell(g, 0, -0.45 - bob, 0.16, 0.13, WHITE);
  g.save();
  g.beginPath(); g.ellipse(0, -0.45 - bob, 0.16, 0.13, 0, 0, Math.PI * 2); g.clip();
  g.beginPath();
  g.moveTo(-0.02, -0.56 - bob);
  g.bezierCurveTo(-0.08, -0.6 - bob, -0.15, -0.55 - bob, -0.14, -0.48 - bob);
  g.bezierCurveTo(-0.13, -0.43 - bob, -0.07, -0.44 - bob, -0.05, -0.48 - bob);
  g.bezierCurveTo(-0.02, -0.5 - bob, -0.01, -0.53 - bob, -0.02, -0.56 - bob);
  g.fillStyle = BLACK; g.fill();
  ell(g, -0.05, -0.36 - bob, 0.13, 0.05, 'rgba(0,0,0,0.06)');
  g.restore();
  // grey ticking
  const ticks = [[-0.11, -0.5], [-0.06, -0.42], [-0.1, -0.6], [0.12, -0.58], [-0.02, -0.62], [-0.13, -0.38], [0.09, -0.38]];
  for (const [tx, ty] of ticks) ell(g, tx, ty - bob, 0.011, 0.009, '#9a9a9a');
  // long thin tail, sweeping side to side (wag in -1..1)
  const tb = -0.54 - bob;
  const sw = wag;
  const tipX = sw * 0.36, tipY = tb + 0.12 - Math.abs(sw) * 0.26;
  const tail = () => { g.beginPath(); g.moveTo(0, tb); g.bezierCurveTo(sw * 0.1, tb - 0.1, sw * 0.3, tb - 0.08, tipX, tipY); };
  tail();
  g.lineWidth = 0.058; g.strokeStyle = '#bdb5a8'; g.stroke();
  tail();
  g.lineWidth = 0.042; g.strokeStyle = WHITE; g.stroke();
  g.beginPath();
  g.moveTo(sw * 0.3, tb - 0.04);
  g.quadraticCurveTo(sw * 0.34, tipY - 0.02, tipX, tipY);
  g.lineWidth = 0.028; g.strokeStyle = SHADOW; g.stroke();
  g.restore();
}

/** Bentzi's forearm and fist holding the leash, rising from the bottom of the screen (screen px). */
export function drawBentziArm(g: CanvasRenderingContext2D, hx: number, hy: number, k: number, tilt = 0) {
  g.save();
  g.translate(hx, hy);
  g.scale(k, k);
  g.rotate(tilt);
  g.lineCap = 'round';
  // forearm from below-right
  g.beginPath();
  g.moveTo(10, 0); g.lineTo(46, 150); g.lineTo(96, 150); g.lineTo(38, -6); g.closePath();
  g.fillStyle = '#e8b48f'; g.fill();
  g.fillStyle = 'rgba(120,60,30,0.18)';
  g.beginPath(); g.moveTo(30, -4); g.lineTo(90, 150); g.lineTo(96, 150); g.lineTo(38, -6); g.closePath(); g.fill();
  // arm hair
  g.strokeStyle = 'rgba(90,59,38,0.45)'; g.lineWidth = 1.2;
  for (let i = 0; i < 9; i++) { const yy = 30 + i * 13; const xx = 22 + yy * 0.33 + (i % 3) * 6; g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx + 4, yy - 3); g.stroke(); }
  // black t-shirt sleeve
  g.beginPath(); g.moveTo(36, 118); g.lineTo(108, 106); g.lineTo(122, 170); g.lineTo(40, 170); g.closePath();
  g.fillStyle = '#1b1b1f'; g.fill();
  g.strokeStyle = '#2c2c33'; g.lineWidth = 3; g.beginPath(); g.moveTo(38, 121); g.lineTo(108, 109); g.stroke();
  // fist
  g.beginPath(); g.ellipse(22, -10, 24, 21, -0.3, 0, Math.PI * 2); g.fillStyle = '#eab996'; g.fill();
  g.fillStyle = 'rgba(120,60,30,0.2)';
  g.beginPath(); g.ellipse(30, -4, 16, 13, -0.3, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(140,80,50,0.55)'; g.lineWidth = 1.6;
  for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(4 + i * 9, -26 + i * 2); g.quadraticCurveTo(8 + i * 9, -20, 6 + i * 9, -14); g.stroke(); }
  // thumb
  g.beginPath(); g.ellipse(4, -6, 9, 13, 0.5, 0, Math.PI * 2); g.fillStyle = '#e3ad88'; g.fill();
  g.restore();
}
