/**
 * Squeegee Survival canvas renderer. Scene is drawn in a fixed 390x600 "scene space" and scaled
 * to the canvas. The static room is painted once into an offscreen canvas; water, Bentzi, the
 * trolley, bubbles and effects are drawn every frame.
 */
import * as S from './sim';
import { INK, PAPER, type Ctx, type Pt, ellipsePts, pathFrom, rng } from './ink';
import { CART_L, DX, HEAD, SH, SW, TRAY_Y, X, Y, bedAt } from './geom';
import { paintRoom } from './room';
import { drawCart, drawRoll, spark } from './cart';
import { drawBentzi } from './bentzi';

export { SW, SH, X, Y };

interface Bubble { x: number; y: number; r: number; vx: number; vy: number; life: number; hue: number }
interface Drop { x: number; y: number; vx: number; vy: number; life: number }

export interface View {
  bg: HTMLCanvasElement | null;
  bgKey: string;
  bubbles: Bubble[];
  drops: Drop[];
  flash: number;
  zapT: number; // seconds since electrocution (-1 = alive)
  shake: number;
  rnd: () => number;
}

export function createView(): View {
  return { bg: null, bgKey: '', bubbles: [], drops: [], flash: 0, zapT: -1, shake: 0, rnd: rng(99) };
}

function ensureBg(v: View, bed: Float64Array, scale: number): HTMLCanvasElement {
  const key = String(scale);
  if (v.bg && v.bgKey === key) return v.bg;
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(SW * scale);
  cv.height = Math.ceil(SH * scale);
  const c = cv.getContext('2d')!;
  c.scale(scale, scale);
  paintRoom(c, bed);
  v.bg = cv;
  v.bgKey = key;
  return cv;
}

/* ------------------------------------------------------------------ frame */

export function draw(
  canvas: HTMLCanvasElement, s: S.State, v: View, dt: number,
  pose: { walk: number },
): void {
  const c = canvas.getContext('2d')!;
  const cw = canvas.width, ch = canvas.height;
  // fit the scene: full width, anchored to the bottom (extra height becomes ceiling)
  // cover the canvas, allowing a little side crop, anchored to the bottom
  const k = Math.min(Math.max(cw / SW, ch / SH), (cw / SW) * 1.12);
  const ox = (cw - SW * k) / 2, oy = ch - SH * k;
  const t = s.t;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = PAPER;
  c.fillRect(0, 0, cw, ch);
  if (oy > 0) {
    // extend the plaster wall upward
    c.fillStyle = '#c3cdbf';
    c.fillRect(0, 0, cw, oy + 2);
  }
  const shake = v.shake > 0 ? (v.rnd() - 0.5) * v.shake * 6 * k : 0;
  c.setTransform(k, 0, 0, k, ox + shake, oy);
  c.drawImage(ensureBg(v, s.bed, k), 0, 0, SW, SH);

  drawCart(c, s, t);
  drawSpray(c, s, t);

  // Bentzi
  const fx = X(s.px);
  const fy = Y(bedAt(s.bed, s.px));
  const swingP = s.swingT < 0.3 ? Math.sin((s.swingT / 0.3) * Math.PI) : 0;
  const bladeCell = s.px - S.BLADE_OFF + 0.5 - swingP * 3.5;
  const bx = X(bladeCell), by = Y(bedAt(s.bed, bladeCell));
  const lean = s.flooded[0] ? Math.max(-0.12, Math.min(0.12, s.pv * 0.012)) + Math.sin(t * 5) * 0.015 : s.pv * 0.003;
  const zapT = v.zapT;
  drawBentzi(c, fx, fy, bx, by, { swing: swingP, walk: pose.walk, lean, zap: zapT >= 0 }, t);

  drawWater(c, s, t);
  drawDrainSwirl(c, s, t);
  drawRolls(c, s);
  updateParticles(c, s, v, dt);

  if (zapT >= 0) drawZap(c, s, v, fx, fy);
  if (v.flash > 0) {
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = `rgba(255,248,210,${Math.min(0.8, v.flash)})`;
    c.fillRect(0, 0, cw, ch);
  }
  v.flash = Math.max(0, v.flash - dt * 3);
  v.shake = Math.max(0, v.shake - dt * 2);
}

function drawSpray(c: Ctx, s: S.State, t: number): void {
  const r = rng(Math.floor(t * 20));
  c.save();
  c.lineCap = 'round';
  const n = 26;
  for (let k = 0; k < n; k++) {
    const cell = S.SPRAY_FROM + ((k + r() * 0.8) / n) * (S.T.SPRAY_TO - S.SPRAY_FROM);
    const ex = X(cell), ey = Y(s.bed[Math.round(cell)]) - 2;
    const sx = HEAD[0] + (r() - 0.5) * 6, sy = HEAD[1] + 4;
    const ph = (t * 3 + k * 0.37) % 1;
    // dashed falling streaks along a slight arc
    const mx = (sx + ex) / 2 - 10, my = (sy + ey) / 2 - 18;
    c.strokeStyle = 'rgba(96,150,190,0.55)';
    c.lineWidth = 1.2;
    c.setLineDash([6, 9]);
    c.lineDashOffset = -ph * 30;
    c.beginPath();
    c.moveTo(sx, sy);
    c.quadraticCurveTo(mx, my, ex, ey);
    c.stroke();
  }
  c.setLineDash([]);
  // splash ticks on the floor
  for (let k = 0; k < 10; k++) {
    const cell = S.SPRAY_FROM + r() * (S.T.SPRAY_TO - S.SPRAY_FROM);
    const ex = X(cell), ey = Y(s.bed[Math.round(cell)] + s.h[Math.round(cell)]);
    c.strokeStyle = 'rgba(43,32,22,0.6)';
    c.lineWidth = 0.7;
    c.beginPath();
    c.moveTo(ex - 3, ey - 1); c.lineTo(ex - 5, ey - 5);
    c.moveTo(ex + 3, ey - 1); c.lineTo(ex + 5, ey - 5);
    c.stroke();
  }
  c.restore();
}

function surfaceView(s: S.State, t: number): Float64Array {
  const out = new Float64Array(S.N);
  for (let i = 0; i < S.N; i++) {
    let h = s.h[i];
    for (const g of s.slugs) {
      const d = (i - g.x) / 2.6;
      h += g.vol * 0.3 * Math.exp(-d * d);
    }
    const ripple = h > 0.08 ? Math.sin(t * 4 + i * 0.8) * Math.min(h, 4) * 0.25 : 0;
    // thin films are drawn a little thicker than they are so they stay readable
    out[i] = h > 0.05 ? s.bed[i] + Math.max(h, 1.8) + ripple : s.bed[i];
  }
  return out;
}

function drawWater(c: Ctx, s: S.State, t: number): void {
  const surf = surfaceView(s, t);
  const top: Pt[] = [];
  for (let i = 0; i < S.N; i++) top.push([X(i), Y(surf[i])]);
  top.push([SW, Y(surf[S.N - 1])]);
  const bottom: Pt[] = [[SW, Y(0) + 1]];
  for (let i = S.N - 1; i >= 0; i--) bottom.push([X(i), Y(s.bed[i]) + 1]);
  const poly = [...top, ...bottom];
  c.save();
  pathFrom(c, poly);
  c.fillStyle = 'rgba(92,150,190,0.42)';
  c.fill();
  c.clip();
  // inner wash variation and a few ink ripple lines
  c.fillStyle = 'rgba(60,110,160,0.18)';
  c.fillRect(0, Y(S.sinkLevel(s)) + 10, SW, SH);
  c.strokeStyle = 'rgba(43,32,22,0.35)';
  c.lineWidth = 0.6;
  c.beginPath();
  for (let yy = 0; yy < 6; yy++) {
    for (let i = 2; i < S.N; i += 3) {
      const h = surf[i] - s.bed[i];
      if (h < 0.6 + yy * 0.9) continue;
      const y = Y(surf[i]) + 5 + yy * 9 + Math.sin(t * 1.5 + i) * 1.2;
      c.moveTo(X(i) - 4, y);
      c.lineTo(X(i) + 4, y);
    }
  }
  c.stroke();
  c.restore();
  // ink on the surface where there is water
  c.save();
  c.strokeStyle = INK;
  c.lineWidth = 1.1;
  c.lineCap = 'round';
  c.beginPath();
  let pen = false;
  for (let i = 0; i < S.N; i++) {
    const wet = surf[i] - s.bed[i] > 0.12;
    if (wet) {
      const [x, y] = top[i];
      if (!pen) c.moveTo(x, y); else c.lineTo(x, y);
      pen = true;
    } else pen = false;
  }
  if (pen) c.lineTo(SW, top[S.N][1]);
  c.stroke();
  // highlight strokes
  c.strokeStyle = 'rgba(255,255,255,0.7)';
  c.lineWidth = 1;
  c.beginPath();
  for (let i = 1; i < S.N; i += 5) {
    if (surf[i] - s.bed[i] < 0.4) continue;
    const y = Y(surf[i]) + 2.5;
    c.moveTo(X(i) - 3, y);
    c.lineTo(X(i) + 3, y);
  }
  c.stroke();
  // suds foam riding on the surface
  if (s.flooded[0]) {
    const r = rng(5);
    for (let i = 0; i < S.N; i += 1) {
      if (surf[i] - s.bed[i] < 0.25 || r() < 0.4) continue;
      const bx = X(i) + (r() - 0.5) * 4, by = Y(surf[i]) - 1 + Math.sin(t * 3 + i) * 0.8;
      const rad = 2 + r() * 3;
      c.fillStyle = 'rgba(255,255,255,0.9)';
      c.beginPath(); c.arc(bx, by, rad, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(43,32,22,0.45)'; c.lineWidth = 0.5; c.stroke();
    }
  }
  c.restore();
}

function drawRolls(c: Ctx, s: S.State): void {
  for (let k = 0; k < s.rolls.length; k++) {
    const r = s.rolls[k];
    if (r.falling > 0) {
      // tumbling down from the middle shelf
      const f = 1 - r.falling / 0.8;
      const x = CART_L + 20 + k * 18;
      const y = TRAY_Y[1] - 10 + Math.max(0, f) * (Y(S.surfaceAt(s, S.N - 3)) - TRAY_Y[1] + 4);
      drawRoll(c, x, y, 8, 330 + k, false);
      continue;
    }
    const x = r.stuck ? X(S.DRAIN_CELLS[1]) + (k - 1) * 4 : X(r.x);
    const y = r.stuck ? Y(s.bed[2]) - 3 : Y(S.surfaceAt(s, r.x)) - 2;
    drawRoll(c, x, y, r.stuck ? 6 : 7, 340 + k, true);
  }
}

function updateParticles(c: Ctx, s: S.State, v: View, dt: number): void {
  const R = v.rnd;
  // suds bubbles drift around the room once the cleaning supplies flood
  if (s.flooded[0] && !s.over) {
    const target = 70;
    if (v.bubbles.length < target && R() < dt * 20) {
      // half pour out of the soaked cleaning shelf, half rise off the soapy water anywhere
      const fromShelf = R() < 0.5;
      const cell = 6 + R() * (S.N - 8);
      v.bubbles.push({
        x: fromShelf ? CART_L + R() * 70 : X(cell), y: fromShelf ? TRAY_Y[0] - 10 : Y(S.surfaceAt(s, cell)) - 4,
        r: 4 + R() * 13, vx: fromShelf ? -15 - R() * 45 : (R() - 0.5) * 16, vy: -5 - R() * 14, life: 8 + R() * 8, hue: R(),
      });
    }
  }
  for (const b of v.bubbles) {
    b.life -= dt;
    b.x += (b.vx + Math.sin(s.t * 1.3 + b.hue * 9) * 6) * dt;
    b.y += b.vy * dt;
    b.vx *= Math.exp(-0.3 * dt);
    b.vy = b.vy * Math.exp(-0.5 * dt) - 1.5 * dt;
    if (b.y < 80) b.vy = Math.abs(b.vy);
  }
  v.bubbles = v.bubbles.filter((b) => b.life > 0 && b.x > -20);
  for (const b of v.bubbles) {
    const a = Math.min(1, b.life / 1.5);
    const col = b.hue < 0.33 ? '200,170,230' : b.hue < 0.66 ? '160,210,230' : '230,200,170';
    c.fillStyle = `rgba(${col},${0.22 * a})`;
    c.beginPath(); c.arc(b.x, b.y, b.r, 0, Math.PI * 2); c.fill();
    c.strokeStyle = `rgba(43,32,22,${0.55 * a})`;
    c.lineWidth = 0.7; c.stroke();
    c.fillStyle = `rgba(255,255,255,${0.8 * a})`;
    c.beginPath(); c.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.22, 0, Math.PI * 2); c.fill();
  }
  // wave crests: a curling ink stroke at the front of each flung wave
  for (const g of s.slugs) {
    const x = X(g.x), y = Y(S.surfaceAt(s, g.x) + g.vol * 0.3 + 1.8);
    const sz = 4 + Math.min(g.vol, 16) * 0.35;
    c.save();
    c.strokeStyle = INK; c.lineWidth = 1.2; c.fillStyle = 'rgba(92,150,190,0.55)';
    c.beginPath();
    c.moveTo(x + sz * 1.8, y + sz);
    c.quadraticCurveTo(x + sz * 0.6, y - sz * 0.9, x - sz * 0.6, y - sz * 0.2);
    c.quadraticCurveTo(x - sz * 0.9, y + sz * 0.3, x - sz * 0.2, y + sz * 0.3);
    c.stroke();
    c.restore();
  }
  // splashy footsteps when Bentzi walks through water
  if (Math.abs(s.pv) > 2 && S.depthAt(s, s.px) > 0.15 && R() < dt * 18) {
    const x = X(s.px), y = Y(S.surfaceAt(s, s.px));
    for (let k = 0; k < 3; k++) v.drops.push({ x: x + (R() - 0.5) * 10, y, vx: (R() - 0.5) * 50, vy: -30 - R() * 40, life: 0.45 });
  }
  // slug spray: droplets at the front of moving waves
  for (const g of s.slugs) {
    if (R() < 0.7) {
      const x = X(g.x), y = Y(S.surfaceAt(s, g.x)) - 3;
      v.drops.push({ x, y, vx: g.v * DX * 0.4 + (R() - 0.5) * 30, vy: -40 - R() * 50, life: 0.5 });
    }
  }
  for (const d of v.drops) {
    d.life -= dt;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.vy += 260 * dt;
  }
  v.drops = v.drops.filter((d) => d.life > 0);
  c.fillStyle = 'rgba(92,150,190,0.8)';
  c.strokeStyle = 'rgba(43,32,22,0.5)';
  c.lineWidth = 0.5;
  for (const d of v.drops) {
    c.beginPath(); c.arc(d.x, d.y, 1.6, 0, Math.PI * 2); c.fill(); c.stroke();
  }
}

/** A little ink whirlpool over the drain while it swallows water (slower and smaller when clogged). */
function drawDrainSwirl(c: Ctx, s: S.State, t: number): void {
  const d = S.depthAt(s, S.DRAIN_CELLS[1]);
  if (d < 0.08) return;
  const f = S.drainFactor(s);
  const cx = X(S.DRAIN_CELLS[1]), cy = Y(s.bed[S.DRAIN_CELLS[1]] + d) + 1;
  const rx = 4 + Math.min(d, 2) * 3;
  c.save();
  c.strokeStyle = 'rgba(43,32,22,0.7)';
  c.lineWidth = 0.9;
  c.beginPath();
  const spin = t * 6 * f;
  for (let k = 0; k <= 40; k++) {
    const a = spin + k * 0.45;
    const r = rx * (1 - k / 44);
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.35;
    if (k) c.lineTo(x, y); else c.moveTo(x, y);
  }
  c.stroke();
  c.restore();
}

/** Splash of droplets (e.g. when a wave hits the drain). */
export function splash(v: View, x: number, y: number, n = 10): void {
  for (let k = 0; k < n; k++) v.drops.push({ x, y, vx: (v.rnd() - 0.5) * 80, vy: -40 - v.rnd() * 70, life: 0.6 });
}

function drawZap(c: Ctx, s: S.State, v: View, fx: number, fy: number): void {
  const r = rng(Math.floor(v.zapT * 18));
  c.save();
  c.lineJoin = 'round';
  const bolts = 3;
  for (let b = 0; b < bolts; b++) {
    let x = CART_L + 20 + r() * 40, y = TRAY_Y[2] - 8;
    const tx = fx + (r() - 0.5) * 40, ty = fy - 120 - r() * 120;
    const pts: Pt[] = [[x, y]];
    for (let k = 1; k <= 8; k++) {
      x = x + (tx - x) / (9 - k) + (r() - 0.5) * 18;
      y = y + (ty - y) / (9 - k) + (r() - 0.5) * 14;
      pts.push([x, y]);
    }
    c.strokeStyle = 'rgba(255,230,90,0.9)';
    c.lineWidth = 4;
    c.beginPath(); pts.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.stroke();
    c.strokeStyle = INK; c.lineWidth = 1;
    c.stroke();
  }
  for (let k = 0; k < 10; k++) spark(c, fx + (r() - 0.5) * 90, fy - r() * 290, 8 + r() * 10, r);
  c.restore();
  void s;
}

