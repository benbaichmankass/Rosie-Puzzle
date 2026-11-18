/**
 * Cabinet Breaker runtime: canvas rendering, the fixed-step loop, input and all the juice
 * (particles, shake, popups, hit-stop). Rules live in sim.ts.
 */
import { BOARD_MAX_H, BOARD_MIN_H, BOARD_W, levelDef, plankY, type Brick, type ItemKind } from './levels';
import {
  BALL_R,
  createSim,
  launch,
  resize as resizeSim,
  startLevel,
  step,
  type Sim,
  type SimEvent,
} from './sim';
import { counterTop, drawBackground, drawBall, drawCritter, drawItem, drawPaddle, drawSplat, drawSlime, itemColors, PAL, SLOT_H, SLOT_W } from './art';
import { Sfx } from './audio';

export interface Hud {
  score: number;
  lives: number;
  level: number;
}

export interface EngineCallbacks {
  onHud: (h: Hud) => void;
  onClear: (bonus: number) => void;
  onOver: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  life: number;
  max: number;
  size: number;
  color: string;
  shape: 'shard' | 'ring' | 'spark' | 'dust' | 'item' | 'goo';
  kind?: ItemKind;
  variant?: number;
  damage?: number;
}

interface Popup {
  x: number;
  y: number;
  text: string;
  life: number;
  color: string;
  big: boolean;
}

const STEP = 1 / 120;
const PAD = 8; // sprite padding (units)
const FONT = '"Fredoka", "Baloo 2", system-ui, sans-serif';

const variantOf = (b: Brick) => (b.row + b.col * 2) % 3;

export class Engine {
  sim: Sim;
  sfx = new Sfx();
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cb: EngineCallbacks;
  private scale = 1;
  private dpr = 1;
  private H = 700;
  private bg: HTMLCanvasElement | null = null;
  private sprites = new Map<string, HTMLCanvasElement>();
  private particles: Particle[] = [];
  private popups: Popup[] = [];
  private splats: { x: number; y: number; roach: boolean; life: number }[] = [];
  private shake = 0;
  private hitStop = 0;
  private bumps = new Map<number, number>();
  private squash = 0;
  private spin = 0;
  private trail: { x: number; y: number }[] = [];
  private slimeStart: number | null = null;
  private banner = 0;
  private lostFlash = 0;
  private acc = 0;
  private last = 0;
  private raf = 0;
  private running = false;
  paused = false;
  private target: number | null = null;
  private time = 0;
  private hud: Hud = { score: -1, lives: -1, level: -1 };

  constructor(canvas: HTMLCanvasElement, cb: EngineCallbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.cb = cb;
    this.sim = createSim(700);
  }

  /** Fit the board into a CSS box. Returns the board's CSS size and offset. */
  layout(cssW: number, cssH: number) {
    const s = Math.min(cssW / BOARD_W, cssH / BOARD_MIN_H);
    const H = Math.round(Math.max(BOARD_MIN_H, Math.min(BOARD_MAX_H, cssH / s)));
    this.scale = s;
    this.H = H;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const w = BOARD_W * s;
    const h = H * s;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    resizeSim(this.sim, H);
    this.sprites.clear();
    this.bg = null;
    this.render();
    return { w, h, scale: s };
  }

  private k() {
    return this.scale * this.dpr;
  }

  private background() {
    if (!this.bg) {
      const c = document.createElement('canvas');
      c.width = this.canvas.width;
      c.height = this.canvas.height;
      const x = c.getContext('2d')!;
      x.setTransform(this.k(), 0, 0, this.k(), 0, 0);
      drawBackground(x, this.H);
      this.bg = c;
    }
    return this.bg;
  }

  private sprite(kind: ItemKind, variant: number, damage: number) {
    const key = `${kind}:${variant}:${damage}`;
    let c = this.sprites.get(key);
    if (!c) {
      c = document.createElement('canvas');
      const k = this.k();
      c.width = Math.ceil((SLOT_W + PAD * 2) * k);
      c.height = Math.ceil((SLOT_H + PAD * 2) * k);
      const x = c.getContext('2d')!;
      x.setTransform(k, 0, 0, k, 0, 0);
      drawItem(x, kind, PAD, PAD, SLOT_W, SLOT_H, variant, damage);
      this.sprites.set(key, c);
    }
    return c;
  }

  /* ---------------------------------------------------------------- control */

  newGame() {
    this.sim = createSim(this.H);
    this.particles = [];
    this.popups = [];
    this.trail = [];
    this.slimeStart = null;
    this.splats = [];
    this.levelBanner();
    this.target = this.sim.paddle.x;
    this.pushHud();
    this.start();
  }

  nextLevel() {
    startLevel(this.sim, this.sim.level + 1);
    this.particles = this.particles.filter((p) => p.shape !== 'item');
    this.slimeStart = null;
    this.splats = [];
    this.trail = [];
    this.levelBanner();
    this.pushHud();
    this.start();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      if (!this.paused) this.update(dt);
      this.render();
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  pause() {
    this.paused = true;
    this.sfx.suspend();
  }

  resume() {
    this.paused = false;
    this.last = performance.now();
    this.sfx.unlock();
  }

  /** Pointer x in board units, from a client x and the canvas rect. */
  pointer(clientX: number) {
    const r = this.canvas.getBoundingClientRect();
    this.target = (clientX - r.left) / this.scale;
  }

  release() {
    if (this.sim.ball.stuck && !this.paused) {
      launch(this.sim);
      if (!this.sim.ball.stuck) {
        this.sfx.launch();
        this.banner = Math.min(this.banner, 0.4);
      }
    }
  }

  private pushHud() {
    const s = this.sim;
    if (s.score !== this.hud.score || s.lives !== this.hud.lives || s.level !== this.hud.level) {
      this.hud = { score: s.score, lives: s.lives, level: s.level };
      this.cb.onHud({ ...this.hud });
    }
  }

  /* ---------------------------------------------------------------- update */

  private update(dt: number) {
    this.time += dt;
    this.updateFx(dt);
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      return;
    }
    this.acc += dt;
    const s = this.sim;
    while (this.acc >= STEP) {
      this.acc -= STEP;
      if (s.cleared || s.over) break;
      // Ease the paddle toward the finger: snappy but not teleporting.
      let tgt: number | null = null;
      if (this.target !== null) {
        const d = this.target - s.paddle.x;
        tgt = s.paddle.x + d * Math.min(1, STEP * 32);
      }
      const evs = step(s, STEP, tgt);
      for (const e of evs) this.onEvent(e);
      if (!s.ball.stuck) {
        this.spin += (s.ball.vx * STEP) / BALL_R;
      }
    }
    if (!s.ball.stuck && !s.cleared) {
      this.trail.push({ x: s.ball.x, y: s.ball.y });
      if (this.trail.length > 9) this.trail.shift();
    } else this.trail = [];
    const c = s.critter;
    if (c && c.kind === 'slug') {
      if (this.slimeStart === null) this.slimeStart = c.x;
    } else this.slimeStart = null;
    this.pushHud();
  }

  private updateFx(dt: number) {
    this.shake *= Math.exp(-dt * 10);
    if (this.shake < 0.05) this.shake = 0;
    this.squash = Math.max(0, this.squash - dt * 5);
    this.banner = Math.max(0, this.banner - dt);
    this.lostFlash = Math.max(0, this.lostFlash - dt);
    for (const [id, t] of this.bumps) {
      const nt = t - dt;
      if (nt <= 0) this.bumps.delete(id);
      else this.bumps.set(id, nt);
    }
    const g = 900;
    const floor = this.H + 40;
    this.particles = this.particles.filter((p) => {
      p.life -= dt;
      if (p.shape === 'dust') {
        p.vx *= 1 - dt * 3;
        p.vy *= 1 - dt * 3;
        p.size += dt * 14;
      } else if (p.shape === 'goo') {
        p.vy += g * 0.4 * dt;
      } else p.vy += g * (p.shape === 'spark' ? 0.5 : 1) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      return p.life > 0 && p.y < floor;
    });
    this.splats = this.splats.filter((q) => (q.life -= dt) > 0);
    this.popups = this.popups.filter((p) => {
      p.life -= dt;
      p.y -= dt * (p.big ? 30 : 40);
      return p.life > 0;
    });
  }

  private rand(a: number, b: number) {
    return a + Math.random() * (b - a);
  }

  private onEvent(e: SimEvent) {
    switch (e.type) {
      case 'wall':
        this.sfx.wall();
        this.dust(e.x, e.y, 3, 'rgba(255,255,255,0.8)');
        break;
      case 'paddle':
        this.sfx.paddle(e.offset);
        this.squash = 1;
        for (let i = 0; i < 5; i++) this.spark(e.x, e.y, this.rand(-140, 140), this.rand(-200, -80), '#fff3b0');
        break;
      case 'hit': {
        const b = e.brick;
        this.sfx.smash(b.def.material, false);
        this.bumps.set(b.id, 0.18);
        this.shake = Math.max(this.shake, 1.2);
        const cx = b.x + b.w / 2;
        const cy = b.y + b.h / 2;
        if (b.def.material === 'cardboard' || b.def.material === 'ceramic') this.dust(cx, cy, 4, '#fff');
        else for (let i = 0; i < 8; i++) this.spark(cx, cy, this.rand(-220, 220), this.rand(-260, 40), '#ffe27a');
        this.popup(cx, b.y, '+10', '#fff', false);
        break;
      }
      case 'break':
        this.smash(e.brick, e.points);
        break;
      case 'critterSpawn':
        this.sfx.critter();
        break;
      case 'critter': {
        const c = e.critter;
        const roach = c.kind === 'roach';
        this.sfx.squish(roach);
        this.shake = Math.max(this.shake, roach ? 5 : 3.5);
        this.hitStop = 0.07;
        for (let i = 0; i < 16; i++) {
          this.particles.push({
            x: c.x,
            y: c.y + c.h / 2,
            vx: this.rand(-160, 160),
            vy: this.rand(-220, 20),
            rot: 0,
            vr: 0,
            life: this.rand(0.4, 0.8),
            max: 0.8,
            size: this.rand(1.5, 3.5),
            color: roach ? (i % 2 ? '#5c2f12' : '#c9a35a') : i % 2 ? '#b8d86a' : '#a08a3e',
            shape: 'goo',
          });
        }
        this.popup(c.x, c.y - 6, `${roach ? 'ROACH' : 'SLUG'} +${e.points}`, roach ? '#ffcf3a' : '#b8f070', true);
        this.splats.push({ x: c.x, y: c.y + c.h, roach, life: 2.5 });
        this.slimeStart = null;
        break;
      }
      case 'lost':
        this.sfx.lose();
        this.shake = 9;
        this.lostFlash = 0.5;
        this.trail = [];
        if (e.livesLeft <= 0) {
          this.sfx.gameOver();
          this.pushHud();
          this.cb.onOver();
        } else this.showBanner('Oops! Butterfingers', e.livesLeft === 1 ? 'Last lemon!' : `${e.livesLeft} lemons left`, 1.6);
        break;
      case 'clear':
        this.sfx.clear();
        this.pushHud();
        // Confetti of crumbs.
        for (let i = 0; i < 40; i++) {
          this.particles.push({
            x: this.rand(30, BOARD_W - 30),
            y: this.rand(80, 200),
            vx: this.rand(-80, 80),
            vy: this.rand(-300, -100),
            rot: this.rand(0, 6),
            vr: this.rand(-12, 12),
            life: 1.6,
            max: 1.6,
            size: this.rand(2, 4),
            color: ['#ffd23f', '#e2453c', '#3e8fa0', '#fff', '#2f8f6a'][i % 5],
            shape: 'shard',
          });
        }
        this.cb.onClear(e.bonus);
        break;
    }
  }

  private smash(b: Brick, points: number) {
    const m = b.def.material;
    const variant = variantOf(b);
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    this.sfx.smash(m, true);
    const heavy = m === 'metal' || m === 'iron' || m === 'tin';
    this.shake = Math.max(this.shake, heavy ? 3.5 : 2.2);
    if (m === 'iron' || m === 'metal') this.hitStop = 0.045;
    const ball = this.sim.ball;
    const push = Math.sign(ball.vx || 1) * 40;
    const cols = itemColors(b.def.kind, variant);
    if (m === 'ceramic' || m === 'glass') {
      const n = m === 'glass' ? 18 : 16;
      for (let i = 0; i < n; i++) {
        this.particles.push({
          x: cx + this.rand(-b.w / 2, b.w / 2),
          y: cy + this.rand(-b.h / 2, b.h / 2),
          vx: this.rand(-170, 170) + push,
          vy: this.rand(-300, -40),
          rot: this.rand(0, 6),
          vr: this.rand(-18, 18),
          life: this.rand(0.9, 1.6),
          max: 1.6,
          size: this.rand(2.2, m === 'glass' ? 4 : 5.2),
          color: cols[i % cols.length],
          shape: 'shard',
        });
      }
      if (m === 'glass') for (let i = 0; i < 6; i++) this.spark(cx, cy, this.rand(-200, 200), this.rand(-240, 0), '#ffffff');
      this.dust(cx, cy + 6, 5, 'rgba(255,255,255,0.9)');
    } else {
      // Sturdy things tumble off the shelf in one piece.
      this.particles.push({
        x: cx,
        y: cy,
        vx: this.rand(-60, 60) + push * 1.5,
        vy: this.rand(-220, -140),
        rot: 0,
        vr: this.rand(5, 9) * (Math.random() < 0.5 ? -1 : 1),
        life: 3,
        max: 3,
        size: 1,
        color: '',
        shape: 'item',
        kind: b.def.kind,
        variant,
        damage: b.def.hits - 1,
      });
      if (m === 'cardboard') {
        // Spilled cereal / pasta.
        for (let i = 0; i < 14; i++) {
          this.particles.push({
            x: cx + this.rand(-8, 8),
            y: cy - 6,
            vx: this.rand(-120, 120) + push,
            vy: this.rand(-260, -60),
            rot: 0,
            vr: 0,
            life: this.rand(0.9, 1.5),
            max: 1.5,
            size: this.rand(1.6, 2.4),
            color: ['#f2c46b', '#e8a33a', '#f7dc8c'][i % 3],
            shape: 'ring',
          });
        }
      } else {
        for (let i = 0; i < 12; i++) this.spark(cx, cy, this.rand(-260, 260), this.rand(-300, 30), i % 2 ? '#ffe27a' : '#ffffff');
      }
      this.dust(cx, cy + 8, 4, 'rgba(255,240,220,0.9)');
    }
    this.popup(cx, b.y - 2, `+${points}`, heavy ? '#ffe27a' : '#ffffff', false);
  }

  private spark(x: number, y: number, vx: number, vy: number, color: string) {
    this.particles.push({ x, y, vx, vy, rot: 0, vr: 0, life: this.rand(0.2, 0.45), max: 0.45, size: 1.4, color, shape: 'spark' });
  }

  private dust(x: number, y: number, n: number, color: string) {
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: x + this.rand(-6, 6),
        y: y + this.rand(-4, 4),
        vx: this.rand(-50, 50),
        vy: this.rand(-50, 10),
        rot: 0,
        vr: 0,
        life: this.rand(0.3, 0.55),
        max: 0.55,
        size: this.rand(2.5, 5),
        color,
        shape: 'dust',
      });
    }
  }

  private popup(x: number, y: number, text: string, color: string, big: boolean) {
    this.popups.push({ x, y, text, color, life: big ? 1.3 : 0.75, big });
  }

  /* ---------------------------------------------------------------- render */

  render() {
    const c = this.ctx;
    const k = this.k();
    const s = this.sim;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    let ox = 0;
    let oy = 0;
    if (this.shake > 0) {
      ox = (Math.random() - 0.5) * this.shake * 2;
      oy = (Math.random() - 0.5) * this.shake * 2;
    }
    c.setTransform(k, 0, 0, k, ox * k, oy * k);
    c.drawImage(this.background(), 0, 0, BOARD_W, this.H);

    // Slime trail.
    const cr = s.critter;
    if (cr && cr.kind === 'slug' && this.slimeStart !== null) drawSlime(c, plankY(cr.row), this.slimeStart, cr.x - cr.dir * 8);

    // Items.
    for (const b of s.bricks) {
      const spr = this.sprite(b.def.kind, variantOf(b), b.def.hits - b.hitsLeft);
      const bump = this.bumps.get(b.id);
      if (bump) {
        const t = bump / 0.18;
        c.save();
        c.translate(b.x + b.w / 2, b.y + b.h);
        c.rotate(Math.sin(t * 18) * 0.12 * t);
        const sc = 1 + 0.12 * t;
        c.scale(sc, sc);
        c.drawImage(spr, -b.w / 2 - PAD, -b.h - PAD, SLOT_W + PAD * 2, SLOT_H + PAD * 2);
        c.restore();
      } else c.drawImage(spr, b.x - PAD, b.y - PAD, SLOT_W + PAD * 2, SLOT_H + PAD * 2);
    }

    for (const q of this.splats) drawSplat(c, q.x, q.y, q.roach, Math.min(1, q.life / 0.8));
    if (cr) drawCritter(c, cr);

    // Paddle + ball.
    const p = s.paddle;
    const tilt = Math.max(-0.12, Math.min(0.12, p.vx / 6000));
    drawPaddle(c, p.x, p.y, p.w, p.h, this.squash, tilt);
    // Anything that falls past the paddle drops behind the counter.
    c.save();
    c.beginPath();
    c.rect(0, 0, BOARD_W, counterTop(this.H) + 2);
    c.clip();
    if (!s.over) {
      for (let i = 0; i < this.trail.length; i++) {
        const t = this.trail[i];
        const a = (i + 1) / this.trail.length;
        c.fillStyle = `rgba(255,220,60,${a * 0.28})`;
        c.beginPath();
        c.arc(t.x, t.y, BALL_R * (0.4 + a * 0.5), 0, Math.PI * 2);
        c.fill();
      }
      drawBall(c, s.ball.x, s.ball.y, BALL_R, this.spin);
    }

    // Particles.
    for (const q of this.particles) {
      const a = Math.min(1, q.life / (q.max * 0.4));
      c.globalAlpha = a;
      if (q.shape === 'item' && q.kind) {
        c.save();
        c.translate(q.x, q.y);
        c.rotate(q.rot);
        c.drawImage(this.sprite(q.kind, q.variant ?? 0, q.damage ?? 0), -SLOT_W / 2 - PAD, -SLOT_H / 2 - PAD, SLOT_W + PAD * 2, SLOT_H + PAD * 2);
        c.restore();
      } else if (q.shape === 'shard') {
        c.save();
        c.translate(q.x, q.y);
        c.rotate(q.rot);
        c.fillStyle = q.color;
        c.strokeStyle = 'rgba(60,40,30,0.5)';
        c.lineWidth = 0.6;
        c.beginPath();
        c.moveTo(-q.size, -q.size * 0.4);
        c.lineTo(q.size * 0.9, -q.size * 0.7);
        c.lineTo(q.size * 0.2, q.size * 0.8);
        c.closePath();
        c.fill();
        c.stroke();
        c.restore();
      } else if (q.shape === 'ring') {
        c.strokeStyle = q.color;
        c.lineWidth = 1.3;
        c.beginPath();
        c.arc(q.x, q.y, q.size, 0, Math.PI * 2);
        c.stroke();
      } else if (q.shape === 'spark') {
        c.strokeStyle = q.color;
        c.lineWidth = q.size;
        c.beginPath();
        c.moveTo(q.x, q.y);
        c.lineTo(q.x - q.vx * 0.025, q.y - q.vy * 0.025);
        c.stroke();
      } else {
        c.fillStyle = q.color;
        c.globalAlpha = a * (q.shape === 'dust' ? 0.55 : 1);
        c.beginPath();
        c.arc(q.x, q.y, q.size, 0, Math.PI * 2);
        c.fill();
      }
    }
    c.globalAlpha = 1;
    c.restore();

    // Score popups.
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (const q of this.popups) {
      const a = Math.min(1, q.life / 0.3);
      const pop = q.big ? 1 + Math.max(0, q.life - 1.1) * 3 : 1;
      c.globalAlpha = a;
      c.font = `700 ${(q.big ? 15 : 11) * pop}px ${FONT}`;
      c.lineWidth = 3;
      c.strokeStyle = PAL.ink;
      c.strokeText(q.text, q.x, q.y);
      c.fillStyle = q.color;
      c.fillText(q.text, q.x, q.y);
    }
    c.globalAlpha = 1;

    // Banner + launch hint.
    const mid = (plankY(7) + p.y) / 2 + 20;
    if (this.banner > 0 && !s.over && !s.cleared) {
      const a = Math.min(1, this.banner / 0.4);
      c.globalAlpha = a;
      c.font = `700 22px ${FONT}`;
      c.lineWidth = 5;
      c.strokeStyle = PAL.ink;
      c.strokeText(this.bannerTitle, BOARD_W / 2, mid - 14);
      c.fillStyle = '#ffd23f';
      c.fillText(this.bannerTitle, BOARD_W / 2, mid - 14);
      c.font = `600 14px ${FONT}`;
      c.lineWidth = 4;
      c.strokeText(this.bannerSub, BOARD_W / 2, mid + 10);
      c.fillStyle = '#fff';
      c.fillText(this.bannerSub, BOARD_W / 2, mid + 10);
      c.globalAlpha = 1;
    }
    if (this.running && s.ball.stuck && !s.over && !s.cleared && !this.paused) {
      c.globalAlpha = 0.6 + 0.4 * Math.sin(this.time * 5);
      c.font = `600 13px ${FONT}`;
      c.lineWidth = 2.5;
      c.strokeStyle = PAL.ink;
      c.strokeText('Drag to move · release to toss the lemon', BOARD_W / 2, p.y - 30);
      c.fillStyle = '#fff';
      c.fillText('Drag to move · release to toss the lemon', BOARD_W / 2, p.y - 30);
      c.globalAlpha = 1;
    }

    if (this.lostFlash > 0) {
      c.fillStyle = `rgba(200,40,30,${this.lostFlash * 0.35})`;
      c.fillRect(0, 0, BOARD_W, this.H);
    }
  }

  private bannerTitle = '';
  private bannerSub = '';
  private showBanner(title: string, sub: string, t: number) {
    this.bannerTitle = title;
    this.bannerSub = sub;
    this.banner = t;
  }

  private levelBanner() {
    this.showBanner(`Level ${this.sim.level + 1}`, levelDef(this.sim.level).name, 2.2);
  }
}
