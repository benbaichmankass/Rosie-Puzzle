/** Roomba Fling runtime: canvas rendering, input and the game loop around the pure sim. */
import {
  W, H, R, MAX_DRAG, CLEAN_RADIUS, generateLevel, makeCleanGrid, cleanAt, cleanPct, step, atDock, flingVelocity,
  predict, levelScore, type Level, type Body, type Hit, type CleanGrid, type LevelScore, moverPos,
} from './sim';
import {
  WALL, drawFloor, drawDirt, drawWalls, drawPiece, drawPuddle, drawPillow, drawDock, drawBall, drawRosie, drawRosieZ, drawRoomba,
} from './draw';
import { Sfx } from './audio';

export interface HudState { level: number; flings: number; budget: number; pct: number; run: number }
export interface ClearInfo { level: number; flings: number; score: LevelScore; run: number }
interface Callbacks { onHud: (h: HudState) => void; onClear: (c: ClearInfo) => void; onOver: (c: ClearInfo) => void }

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string }
interface Popup { x: number; y: number; text: string; life: number; color: string }

const DIRT_K = 2;
const SUB = 1 / 240;

export class Engine {
  sfx = new Sfx();
  private ctx: CanvasRenderingContext2D;
  private bg = document.createElement('canvas');
  private fg = document.createElement('canvas');
  private dirt = document.createElement('canvas');
  private dirtCtx: CanvasRenderingContext2D;
  private cssW = 0;
  private cssH = 0;
  private dpr = 1;
  private scale = 1;
  private ox = 0;
  private oy = 0;

  private level!: Level;
  private grid!: CleanGrid;
  private body: Body = { x: 0, y: 0, vx: 0, vy: 0 };
  private heading = -Math.PI / 2;
  private brush = 0;
  private t = 0;
  private flings = 0;
  private run = 0;
  private runBeforeLevel = 0;
  private active = false;
  private paused = false;
  private raf = 0;
  private last = 0;
  private state: 'aim' | 'moving' | 'docking' | 'done' = 'aim';
  private dockT = 0;
  private dockFrom = { x: 0, y: 0 };
  private overT = 0;
  private rosieWake = 0;
  private squash = new Map<number, number>();
  private particles: Particle[] = [];
  private popups: Popup[] = [];
  private shake = 0;
  private aim: { id: number; sx: number; sy: number; dx: number; dy: number } | null = null;
  private lastStretch = 0;
  private lastPct = -1;
  private hits: Hit[] = [];
  private hintT = 0;

  constructor(private canvas: HTMLCanvasElement, private cb: Callbacks) {
    this.ctx = canvas.getContext('2d')!;
    this.dirt.width = W * DIRT_K;
    this.dirt.height = H * DIRT_K;
    this.dirtCtx = this.dirt.getContext('2d')!;
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onCancel);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointermove', this.onMove);
    this.canvas.removeEventListener('pointerup', this.onUp);
    this.canvas.removeEventListener('pointercancel', this.onCancel);
    this.sfx.hum(0);
    this.sfx.suspend();
  }

  // ------------------------------------------------------------ lifecycle

  start() {
    this.last = performance.now();
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      if (!this.paused) this.update(dt);
      this.render();
    };
    this.raf = requestAnimationFrame(loop);
  }

  setPaused(p: boolean) {
    this.paused = p;
    if (p) { this.sfx.hum(0); this.sfx.suspend(); this.aim = null; } else { this.last = performance.now(); this.sfx.resume(); }
  }

  setActive(a: boolean) { this.active = a; }

  newRun() {
    this.run = 0;
    this.runBeforeLevel = 0;
    this.loadLevel(generateLevel(1));
  }

  nextLevel() {
    this.runBeforeLevel = this.run;
    this.loadLevel(generateLevel(this.level.level + 1));
    this.active = true;
  }

  retryLevel() {
    this.run = this.runBeforeLevel;
    this.loadLevel(this.level);
  }

  private loadLevel(l: Level) {
    this.level = l;
    this.grid = makeCleanGrid(l);
    this.body = { x: l.start.x, y: l.start.y, vx: 0, vy: 0 };
    this.heading = -Math.PI / 2;
    this.flings = 0;
    this.state = 'aim';
    this.rosieWake = 0;
    this.squash.clear();
    this.particles = [];
    this.popups = [];
    this.lastPct = -1;
    this.hintT = 0;
    const d = this.dirtCtx;
    d.setTransform(1, 0, 0, 1, 0, 0);
    d.globalCompositeOperation = 'source-over';
    d.clearRect(0, 0, this.dirt.width, this.dirt.height);
    d.setTransform(DIRT_K, 0, 0, DIRT_K, 0, 0);
    drawDirt(d, l);
    // the start spot is where the Roomba was parked: clean it
    this.cleanSegment(this.body.x, this.body.y, this.body.x, this.body.y);
    this.buildLayers();
    this.pushHud(true);
  }

  resize(w: number, h: number) {
    if (w <= 0 || h <= 0) return;
    this.cssW = w;
    this.cssH = h;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    const pad = 6;
    this.scale = Math.min((w - pad * 2) / (W + WALL * 2), (h - pad * 2) / (H + WALL * 2));
    this.ox = (w - W * this.scale) / 2;
    this.oy = (h - H * this.scale) / 2;
    if (this.level) this.buildLayers();
  }

  private worldTransform(ctx: CanvasRenderingContext2D) {
    const k = this.scale * this.dpr;
    ctx.setTransform(k, 0, 0, k, this.ox * this.dpr, this.oy * this.dpr);
  }

  private buildLayers() {
    for (const c of [this.bg, this.fg]) { c.width = this.canvas.width; c.height = this.canvas.height; }
    const b = this.bg.getContext('2d')!;
    this.worldTransform(b);
    drawFloor(b, this.level);
    const f = this.fg.getContext('2d')!;
    this.worldTransform(f);
    drawWalls(f, this.level);
    for (const p of this.level.pieces) drawPiece(f, p, this.level);
  }

  private pushHud(force = false) {
    const pct = cleanPct(this.grid);
    const pr = Math.round(pct * 100);
    if (!force && pr === this.lastPct) return;
    this.lastPct = pr;
    this.cb.onHud({ level: this.level.level, flings: this.flings, budget: this.level.budget, pct, run: this.run });
  }

  // ------------------------------------------------------------ input

  private toWorld(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left - this.ox) / this.scale, y: (e.clientY - r.top - this.oy) / this.scale };
  }

  private canAim() { return this.active && !this.paused && this.state === 'aim' && this.flings < this.level.budget; }

  private onDown = (e: PointerEvent) => {
    this.sfx.unlock();
    if (!this.canAim() || this.aim) return;
    const p = this.toWorld(e);
    this.aim = { id: e.pointerId, sx: p.x, sy: p.y, dx: 0, dy: 0 };
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  private onMove = (e: PointerEvent) => {
    if (!this.aim || e.pointerId !== this.aim.id) return;
    const p = this.toWorld(e);
    // slingshot: pull back, the Roomba goes the opposite way
    let dx = this.aim.sx - p.x, dy = this.aim.sy - p.y;
    const len = Math.hypot(dx, dy);
    if (len > MAX_DRAG) { dx *= MAX_DRAG / len; dy *= MAX_DRAG / len; }
    this.aim.dx = dx;
    this.aim.dy = dy;
    const step10 = Math.floor((Math.min(len, MAX_DRAG) / MAX_DRAG) * 8);
    if (step10 !== this.lastStretch) { this.lastStretch = step10; if (step10 > 0) this.sfx.stretch(step10 / 8); }
  };

  private onUp = (e: PointerEvent) => {
    if (!this.aim || e.pointerId !== this.aim.id) return;
    const { dx, dy } = this.aim;
    this.aim = null;
    this.lastStretch = 0;
    const v = flingVelocity(dx, dy);
    if (v.power < 0.08 || !this.canAim()) return;
    this.body.vx = v.vx;
    this.body.vy = v.vy;
    this.flings++;
    this.state = 'moving';
    this.sfx.fling(v.power);
    this.pushHud(true);
    for (let i = 0; i < 8; i++) this.puff(this.body.x - (dx / Math.hypot(dx, dy)) * R, this.body.y - (dy / Math.hypot(dx, dy)) * R, '#d8cbb6', 60);
  };

  private onCancel = () => { this.aim = null; };

  // ------------------------------------------------------------ simulation

  private cleanSegment(x0: number, y0: number, x1: number, y1: number) {
    const d = this.dirtCtx;
    d.globalCompositeOperation = 'destination-out';
    d.strokeStyle = 'rgba(0,0,0,1)';
    d.lineCap = 'round';
    d.lineJoin = 'round';
    d.lineWidth = CLEAN_RADIUS * 2 + 2;
    d.beginPath();
    d.moveTo(x0, y0);
    d.lineTo(x1 + 0.01, y1);
    d.stroke();
    d.globalCompositeOperation = 'source-over';
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.ceil(len / 3));
    for (let i = 0; i <= n; i++) cleanAt(this.grid, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n);
  }

  private puff(x: number, y: number, color: string, speed: number) {
    const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random());
    this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: 0.4 + Math.random() * 0.4, size: 1.5 + Math.random() * 2.5, color });
  }

  private update(dt: number) {
    this.t += dt;
    this.hintT += dt;
    this.rosieWake = Math.max(0, this.rosieWake - dt * 0.6);
    for (const [k, v] of this.squash) { const n = v - dt * 4; if (n <= 0) this.squash.delete(k); else this.squash.set(k, n); }
    this.shake = Math.max(0, this.shake - dt * 30);

    if (this.state === 'moving') {
      const x0 = this.body.x, y0 = this.body.y;
      const n = Math.max(1, Math.round(dt / SUB));
      let px = x0, py = y0;
      for (let i = 0; i < n; i++) {
        this.hits.length = 0;
        step(this.level, this.body, this.t + i * SUB, dt / n, this.hits);
        this.cleanSegment(px, py, this.body.x, this.body.y);
        px = this.body.x; py = this.body.y;
        for (const h of this.hits) this.onHit(h);
        if (atDock(this.level, this.body)) {
          this.state = 'docking';
          this.dockT = 0;
          this.dockFrom = { x: this.body.x, y: this.body.y };
          this.sfx.dock();
          for (let k = 0; k < 24; k++) this.puff(this.level.dock.x, this.level.dock.y, k % 2 ? '#7dffb0' : '#ffe27a', 140);
          break;
        }
      }
      const sp = Math.hypot(this.body.vx, this.body.vy);
      if (sp > 1) {
        const want = Math.atan2(this.body.vy, this.body.vx);
        let d = want - this.heading;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        this.heading += d * Math.min(1, dt * 14);
      }
      this.brush += dt * (8 + sp / 30);
      this.sfx.hum(Math.min(1, sp / 900));
      if (sp > 200 && Math.random() < dt * 30) this.puff(this.body.x, this.body.y, 'rgba(150,125,95,0.8)', 30);
      if (this.state === 'moving' && sp === 0) {
        this.sfx.hum(0);
        if (this.flings >= this.level.budget) { this.state = 'done'; this.overT = 0.8; } else this.state = 'aim';
      }
      this.pushHud();
    } else if (this.state === 'docking') {
      this.dockT += dt;
      const u = Math.min(1, this.dockT / 0.45);
      const e = 1 - (1 - u) ** 3;
      this.body.x = this.dockFrom.x + (this.level.dock.x - this.dockFrom.x) * e;
      this.body.y = this.dockFrom.y + (this.level.dock.y - 6 - this.dockFrom.y) * e;
      let d = -Math.PI / 2 - this.heading;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.heading += d * Math.min(1, dt * 10);
      this.brush += dt * 4;
      this.sfx.hum(0);
      if (this.dockT > 1.0) {
        this.state = 'done';
        const score = levelScore(this.flings, cleanPct(this.grid), this.level.budget);
        this.run = this.runBeforeLevel + score.total;
        this.active = false;
        this.pushHud(true);
        this.cb.onClear({ level: this.level.level, flings: this.flings, score, run: this.run });
      }
    } else if (this.state === 'done' && this.overT > 0) {
      this.overT -= dt;
      if (this.overT <= 0) {
        this.active = false;
        this.sfx.fail();
        const score = levelScore(this.level.budget, cleanPct(this.grid), this.level.budget);
        // battery died: the cleaning still counts toward the run
        this.run = this.runBeforeLevel + score.cleanPts;
        this.pushHud(true);
        this.cb.onOver({ level: this.level.level, flings: this.flings, score: { ...score, flingPts: 0, total: score.cleanPts }, run: this.run });
      }
    }

    for (const p of this.particles) {
      p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - dt * 4; p.vy *= 1 - dt * 4;
    }
    this.particles = this.particles.filter((p) => p.life < p.max);
    for (const p of this.popups) { p.life += dt; p.y -= dt * 22; }
    this.popups = this.popups.filter((p) => p.life < 1.1);
  }

  private onHit(h: Hit) {
    const v = Math.min(1, h.speed / 900);
    this.sfx.bump(h.tag, v);
    if (h.speed > 500) this.shake = Math.min(6, h.speed / 180);
    for (let i = 0; i < Math.round(3 + v * 8); i++) this.puff(h.x, h.y, h.tag === 'pillow' ? '#fff3b0' : 'rgba(200,185,160,0.9)', 50 + v * 120);
    if (h.tag === 'pillow') this.squash.set(h.owner, 1);
    if (h.tag === 'rosie' && h.speed > 60) {
      if (this.rosieWake < 0.3) this.popups.push({ x: this.level.rosie.x, y: this.level.rosie.y - 30, text: 'Woof!', life: 0, color: '#d93a3a' });
      this.rosieWake = 1;
    }
  }

  // ------------------------------------------------------------ rendering

  private render() {
    const ctx = this.ctx;
    if (!this.level || !this.canvas.width) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#2e2925';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const sx = this.shake ? (Math.random() - 0.5) * this.shake * this.dpr : 0;
    const sy = this.shake ? (Math.random() - 0.5) * this.shake * this.dpr : 0;
    ctx.drawImage(this.bg, sx, sy);
    const k = this.scale * this.dpr;
    ctx.setTransform(k, 0, 0, k, this.ox * this.dpr + sx, this.oy * this.dpr + sy);
    ctx.drawImage(this.dirt, 0, 0, W, H);
    for (const z of this.level.zones) if (z.kind === 'puddle') drawPuddle(ctx, z, this.t);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.fg, sx, sy);
    ctx.setTransform(k, 0, 0, k, this.ox * this.dpr + sx, this.oy * this.dpr + sy);

    const L = this.level;
    drawDock(ctx, L, this.t, this.state === 'docking' || (this.state === 'done' && this.overT <= 0 && atDock(L, this.body)) ? 1 : 0);
    L.pieces.forEach((p, i) => { if (p.type === 'pillow') drawPillow(ctx, p, this.squash.get(i) ?? 0); });
    drawRosie(ctx, L.rosie, this.t, this.rosieWake);
    for (const m of L.movers) {
      // faint lane marks so the ball's path reads
      ctx.strokeStyle = 'rgba(160,190,40,0.18)';
      ctx.setLineDash([2, 6]);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(m.x0, m.y0); ctx.lineTo(m.x1, m.y1); ctx.stroke();
      ctx.setLineDash([]);
      drawBall(ctx, m, this.t);
      void moverPos;
    }

    // aiming: slingshot band, power ring and trajectory preview
    if (this.aim && this.state === 'aim') {
      const { dx, dy } = this.aim;
      const len = Math.hypot(dx, dy);
      if (len > 2) {
        const v = flingVelocity(dx, dy);
        const pts = predict(L, { x: this.body.x, y: this.body.y, vx: v.vx, vy: v.vy }, this.t);
        pts.forEach((p, i) => {
          const a = 1 - i / pts.length;
          ctx.fillStyle = `rgba(255,255,255,${0.85 * a})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, 2.6 * a + 1, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = `rgba(40,120,90,${0.6 * a})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        });
        const ux = dx / len, uy = dy / len;
        const bx = this.body.x - ux * (R + len * 0.5), by = this.body.y - uy * (R + len * 0.5);
        const col = v.power > 0.85 ? '#ff6a4d' : v.power > 0.5 ? '#ffc34d' : '#7ee0a0';
        ctx.strokeStyle = col;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(this.body.x - uy * R * 0.8, this.body.y + ux * R * 0.8);
        ctx.lineTo(bx, by);
        ctx.lineTo(this.body.x + uy * R * 0.8, this.body.y - ux * R * 0.8);
        ctx.stroke();
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(bx, by, 5, 0, Math.PI * 2); ctx.fill();
        // power arc around the Roomba
        ctx.strokeStyle = col;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(this.body.x, this.body.y, R + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * v.power);
        ctx.stroke();
      }
    }

    drawRoomba(ctx, this.body.x, this.body.y, this.heading, this.brush, 0.5 + 0.5 * Math.sin(this.t * 4), this.state === 'docking' ? 1 : 0);

    // idle hint: pulsing ring + "drag back" on the very first fling
    if (this.state === 'aim' && !this.aim && this.active) {
      const pulse = (this.t * 1.2) % 1;
      ctx.strokeStyle = `rgba(255,255,255,${0.6 * (1 - pulse)})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(this.body.x, this.body.y, R + 4 + pulse * 14, 0, Math.PI * 2); ctx.stroke();
      if (this.flings === 0 && L.level === 1) {
        const off = Math.sin(this.hintT * 3) * 6;
        ctx.save();
        ctx.font = '600 13px Fredoka, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(46,41,37,0.8)';
        const tx = Math.max(80, Math.min(W - 80, this.body.x)), ty = this.body.y - 38 + off;
        const tw = 150;
        ctx.beginPath(); ctx.roundRect(tx - tw / 2, ty - 15, tw, 22, 11); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillText('Drag back & let go', tx, ty);
        ctx.restore();
      }
    }

    for (const p of this.particles) {
      const a = 1 - p.life / p.max;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.6 + a * 0.4), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    drawRosieZ(ctx, L.rosie, this.t, this.rosieWake);
    for (const p of this.popups) {
      ctx.globalAlpha = Math.max(0, 1 - p.life / 1.1);
      ctx.font = '700 14px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#fff';
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }
}
