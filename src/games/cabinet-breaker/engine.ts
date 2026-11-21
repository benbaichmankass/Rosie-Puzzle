/**
 * Cabinet Breaker runtime: canvas rendering, the fixed-step loop, input and all the juice
 * (particles, shake, popups, hit-stop). Rules live in sim.ts.
 */
import { BOARD_MAX_H, BOARD_MIN_H, BOARD_W, CABINET_BOTTOM, levelDef, plankY, type Brick, type ItemKind } from './levels';
import {
  BALL_R,
  createSim,
  EFFECT_TIME,
  isStuck,
  launch,
  mainBall,
  type EffectKind,
  type Pickup,
  type PickupKind,
  resize as resizeSim,
  startLevel,
  step,
  type Sim,
  type SimEvent,
} from './sim';
import { counterTop, drawBackground, drawBall, drawPickup, drawCritter, drawItem, drawPaddle, drawSplat, drawSlime, itemColors, PAL, SLOT_H, SLOT_W } from './art';
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
  shape: 'shard' | 'ring' | 'spark' | 'dust' | 'item' | 'goo' | 'flame' | 'steam';
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
  private ballSquash = 0;
  private combo = 0;
  private spin = 0;
  private trails = new Map<number, { x: number; y: number }[]>();
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
    this.trails.clear();
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
    this.trails.clear();
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
    if (isStuck(this.sim) && !this.paused) {
      launch(this.sim);
      if (!isStuck(this.sim)) {
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
      if (!isStuck(s) && s.balls.length) this.spin += (mainBall(s).vx * STEP) / BALL_R;
    }
    this.updateBallFx(dt);
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
    this.ballSquash = Math.max(0, this.ballSquash - dt * 7);
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
      } else if (p.shape === 'flame') {
        p.vy -= 160 * dt;
        p.vx *= 1 - dt * 4;
      } else if (p.shape === 'steam') {
        p.vy -= 20 * dt;
        p.vx += Math.sin((this.time + p.rot) * 6) * 30 * dt;
        p.size += dt * 6;
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
        this.ballSquash = 0.7;
        this.sfx.wall();
        this.dust(e.x, e.y, 3, 'rgba(255,255,255,0.8)');
        break;
      case 'paddle':
        this.sfx.paddle(e.offset);
        this.squash = 1;
        this.ballSquash = 1;
        this.combo = 0;
        for (let i = 0; i < 5; i++) this.spark(e.x, e.y, this.rand(-140, 140), this.rand(-200, -80), '#fff3b0');
        break;
      case 'hit': {
        const b = e.brick;
        this.ballSquash = 1;
        this.sfx.smash(b.def.material, false);
        this.bumps.set(b.id, 0.18);
        this.shake = Math.max(this.shake, 1.2);
        const cx = b.x + b.w / 2;
        const cy = b.y + b.h / 2;
        const mm = b.def.material;
        if (mm === 'metal' || mm === 'tin' || mm === 'iron') for (let i = 0; i < 8; i++) this.spark(cx, cy, this.rand(-220, 220), this.rand(-260, 40), '#ffe27a');
        else if (mm === 'clay' || mm === 'wood') this.chips(cx, cy, 6, itemColors(b.def.kind, variantOf(b)));
        else this.dust(cx, cy, 4, '#fff');
        this.popup(cx, b.y, '+10', '#fff', false);
        break;
      }
      case 'break':
        this.smash(e.brick, e.points);
        if (e.burnt) {
          this.sfx.sizzle();
          const bx = e.brick.x + e.brick.w / 2;
          const by = e.brick.y + e.brick.h / 2;
          for (let i = 0; i < 10; i++) this.spark(bx, by, this.rand(-200, 200), this.rand(-260, 20), i % 2 ? '#ff7a1a' : '#ffd23f');
          this.flames(bx, by, 6, 10);
        }
        break;
      case 'pickupSpawn':
        this.sfx.pop();
        break;
      case 'pickupCatch':
        this.onCatch(e.pickup, e.points);
        break;
      case 'pickupMiss':
        this.onMiss(e.pickup);
        break;
      case 'ballLost':
        this.sfx.plop();
        this.trails.delete(e.ball.id);
        this.popup(Math.max(30, Math.min(BOARD_W - 30, e.ball.x)), this.sim.paddle.y - 20, e.left === 1 ? 'one lemon left' : `${e.left} lemons left`, '#ffd23f', false);
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
        this.combo = 0;
        this.sfx.lose();
        this.shake = 9;
        this.lostFlash = 0.5;
        this.trails.clear();
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
    this.combo++;
    this.ballSquash = 1;
    this.sfx.pitch = 1 + Math.min(this.combo - 1, 10) * 0.045;
    this.sfx.smash(m, true);
    this.sfx.pitch = 1;
    if (this.combo >= 3) this.popup(cx, b.y - 16, `COMBO x${this.combo}`, '#ffb347', false);
    const heavy = m === 'metal' || m === 'iron' || m === 'tin' || m === 'clay' || b.def.hits >= 3;
    this.shake = Math.max(this.shake, b.def.hits >= 3 ? 4.5 : heavy ? 3.5 : 2.2);
    if (b.def.hits >= 2 && (m === 'iron' || m === 'metal' || m === 'clay' || b.def.hits >= 3)) this.hitStop = 0.05;
    const ball = mainBall(this.sim) ?? { vx: 1 };
    const push = Math.sign(ball.vx || 1) * 40;
    const cols = itemColors(b.def.kind, variant);
    if (m === 'ceramic' || m === 'glass' || m === 'clay') {
      const n = m === 'glass' ? 18 : m === 'clay' ? 22 : 16;
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
      if (b.def.kind === 'pickles') this.chips(cx, cy, 6, ['#6f9a35', '#8bb84a']);
      if (b.def.kind === 'frenchPress') this.chips(cx, cy, 8, ['#5a3420', '#ef94b2']);
      if (b.def.kind === 'spices') this.chips(cx, cy, 12, ['#c8402a', '#e6a91f', '#5c8a2e']);
      if (b.def.kind === 'honey') this.chips(cx, cy, 10, ['#e9a21e', '#f5c04a']);
      if (b.def.kind === 'oliveOil') this.chips(cx, cy, 10, ['#9fb02a', '#c7c94a']);
      if (b.def.kind === 'canisters') this.dust(cx, cy, 8, 'rgba(255,255,255,0.95)'); // sugar & flour cloud
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
      if (b.def.kind === 'soap' || b.def.kind === 'colander' || b.def.kind === 'filterJug' || b.def.kind === 'sodaStream') {
        // Soap bubbles / splashes of water.
        const bubble = b.def.kind === 'soap' ? ['#ffffff', '#e9f7c0', '#f8d8e0'] : ['#bfe6f7', '#ffffff', '#8fd0ee'];
        for (let i = 0; i < 14; i++) {
          this.particles.push({
            x: cx + this.rand(-8, 8),
            y: cy - 6,
            vx: this.rand(-110, 110) + push,
            vy: this.rand(-240, -60),
            rot: 0,
            vr: 0,
            life: this.rand(0.8, 1.4),
            max: 1.4,
            size: this.rand(1.4, 3),
            color: bubble[i % 3],
            shape: 'ring',
          });
        }
      } else if (b.def.kind === 'coffee') {
        this.chips(cx, cy - 4, 14, ['#4a2a16', '#5a3420', '#3a200f']); // spilled beans
      } else if (b.def.kind === 'cereal') {
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
      } else if (m === 'paper') {
        this.chips(cx, cy, 8, itemColors(b.def.kind, variant));
      } else if (m === 'wood') {
        this.chips(cx, cy, 8, itemColors(b.def.kind, variant));
      } else {
        for (let i = 0; i < 12; i++) this.spark(cx, cy, this.rand(-260, 260), this.rand(-300, 30), i % 2 ? '#ffe27a' : '#ffffff');
      }
      this.dust(cx, cy + 8, 4, 'rgba(255,240,220,0.9)');
    }
    this.popup(cx, b.y - 2, `+${points}`, heavy ? '#ffe27a' : '#ffffff', false);
  }

  private chips(x: number, y: number, n: number, colors: string[]) {
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: x + this.rand(-8, 8),
        y: y + this.rand(-5, 5),
        vx: this.rand(-150, 150),
        vy: this.rand(-240, -40),
        rot: this.rand(0, 6),
        vr: this.rand(-15, 15),
        life: this.rand(0.6, 1.1),
        max: 1.1,
        size: this.rand(1.6, 3),
        color: colors[i % colors.length],
        shape: 'shard',
      });
    }
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
    for (const q of s.pickups) drawPickup(c, q.kind, q.x, q.y, q.t);
    if (!s.over) for (const b of s.balls) this.drawLemon(c, b.id, b.x, b.y, b.vx, b.vy);

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
      } else if (q.shape === 'flame') {
        c.globalCompositeOperation = 'lighter';
        c.fillStyle = q.color;
        c.globalAlpha = a * 0.8;
        c.beginPath();
        c.arc(q.x, q.y, q.size * (0.4 + 0.6 * (q.life / q.max)), 0, Math.PI * 2);
        c.fill();
        c.globalCompositeOperation = 'source-over';
      } else {
        c.fillStyle = q.color;
        c.globalAlpha = a * (q.shape === 'dust' ? 0.55 : q.shape === 'steam' ? 0.35 : 1);
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

    this.drawEffects(c);

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
    if (this.running && isStuck(s) && !s.over && !s.cleared && !this.paused) {
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

  /* ---------------------------------------------------------------- pickups & effects */

  private updateBallFx(dt: number) {
    const s = this.sim;
    const live = new Set<number>();
    for (const b of s.balls) {
      live.add(b.id);
      if (b.stuck || s.cleared) {
        this.trails.delete(b.id);
        continue;
      }
      const tr = this.trails.get(b.id) ?? [];
      tr.push({ x: b.x, y: b.y });
      if (tr.length > 9) tr.shift();
      this.trails.set(b.id, tr);
      if (this.paused) continue;
      const e = s.effects;
      if (e.fire > 0) this.flames(b.x, b.y, Math.random() < 0.5 ? 2 : 1, 5);
      else if (e.slow > 0 && Math.random() < dt * 14) {
        // Gooey tahini drips.
        this.particles.push({
          x: b.x + this.rand(-3, 3),
          y: b.y + 3,
          vx: this.rand(-10, 10),
          vy: this.rand(10, 40),
          rot: 0,
          vr: 0,
          life: 0.9,
          max: 0.9,
          size: this.rand(1.4, 2.4),
          color: Math.random() < 0.5 ? '#d9b27c' : '#c79a5e',
          shape: 'goo',
        });
      } else if (e.fast > 0 && Math.random() < dt * 22) {
        // Coffee steam.
        this.particles.push({
          x: b.x + this.rand(-3, 3),
          y: b.y - 2,
          vx: this.rand(-8, 8),
          vy: this.rand(-40, -20),
          rot: this.rand(0, 6),
          vr: 0,
          life: 0.8,
          max: 0.8,
          size: this.rand(2, 3.5),
          color: '#f2ece2',
          shape: 'steam',
        });
      }
    }
    for (const id of this.trails.keys()) if (!live.has(id)) this.trails.delete(id);
  }

  private flames(x: number, y: number, n: number, size: number) {
    const cols = ['#ff4a12', '#ff8a1a', '#ffd23f', '#ff6a00'];
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: x + this.rand(-3, 3),
        y: y + this.rand(-3, 3),
        vx: this.rand(-30, 30),
        vy: this.rand(-40, 10),
        rot: 0,
        vr: 0,
        life: this.rand(0.25, 0.45),
        max: 0.45,
        size: this.rand(size * 0.5, size),
        color: cols[Math.floor(Math.random() * cols.length)],
        shape: 'flame',
      });
    }
  }

  private drawLemon(c: CanvasRenderingContext2D, id: number, x: number, y: number, vx: number, vy: number) {
    const e = this.sim.effects;
    const tr = this.trails.get(id) ?? [];
    const trailCol = e.fire > 0 ? '255,110,30' : e.slow > 0 ? '205,165,110' : e.fast > 0 ? '235,225,210' : '255,220,60';
    for (let i = 0; i < tr.length; i++) {
      const t = tr[i];
      const a = (i + 1) / tr.length;
      c.fillStyle = `rgba(${trailCol},${a * (e.fire > 0 ? 0.45 : 0.28)})`;
      c.beginPath();
      c.arc(t.x, t.y, BALL_R * (0.4 + a * 0.5), 0, Math.PI * 2);
      c.fill();
    }
    if (e.fire > 0) {
      const flicker = 1 + Math.sin(this.time * 30 + id) * 0.08;
      const g = c.createRadialGradient(x, y, 2, x, y, BALL_R * 3.4 * flicker);
      g.addColorStop(0, 'rgba(255,220,90,0.9)');
      g.addColorStop(0.4, 'rgba(255,110,20,0.55)');
      g.addColorStop(1, 'rgba(255,60,0,0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(x, y, BALL_R * 3.4 * flicker, 0, Math.PI * 2);
      c.fill();
    }
    drawBall(c, x, y, BALL_R, this.spin + id, this.ballSquash, Math.atan2(vy, vx));
    if (e.fire > 0) {
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = 'rgba(255,90,20,0.55)';
      c.beginPath();
      c.arc(x, y, BALL_R * 1.1, 0, Math.PI * 2);
      c.fill();
      c.globalCompositeOperation = 'source-over';
    } else if (e.slow > 0) {
      // Tahini coating drip on the lemon.
      c.fillStyle = 'rgba(214,176,120,0.85)';
      c.beginPath();
      c.ellipse(x - 1, y - 2.5, BALL_R * 0.9, BALL_R * 0.5, 0, Math.PI, 0);
      c.fill();
      c.beginPath();
      c.ellipse(x + 2, y + 1 + Math.sin(this.time * 4) * 0.6, 1.4, 2.6, 0, 0, Math.PI * 2);
      c.fill();
    }
  }

  private onCatch(q: Pickup, points: number) {
    const s = this.sim;
    const labels: Record<PickupKind, [string, string]> = {
      lemon: ['EXTRA LEMON!', '#ffd23f'],
      tahini: ['TAHINI: SLOW', '#e0bf8a'],
      coffee: ['COFFEE RUSH x2', '#f0d9b5'],
      tabasco: ['FIREBALL!', '#ff6a2a'],
    };
    const [txt, col] = labels[q.kind];
    this.sfx.pickup(q.kind);
    this.shake = Math.max(this.shake, q.kind === 'tabasco' ? 4 : 2);
    this.squash = 1;
    this.popup(Math.max(50, Math.min(BOARD_W - 50, q.x)), s.paddle.y - 26, `${txt} +${points}`, col, true);
    for (let i = 0; i < 10; i++) this.spark(q.x, s.paddle.y, this.rand(-180, 180), this.rand(-260, -60), i % 2 ? col : '#ffffff');
    if (q.kind === 'tabasco') this.flames(q.x, s.paddle.y - 4, 14, 9);
  }

  private onMiss(q: Pickup) {
    const y = counterTop(this.H) - 2;
    this.sfx.splat(q.kind);
    const goo: Record<PickupKind, string[]> = {
      lemon: ['#ffd92e', '#fff3a0', '#e0a300'],
      tahini: ['#d9b27c', '#c79a5e', 'rgba(220,238,245,0.9)'],
      coffee: ['#5a3420', '#7a4a2a', '#ffffff'],
      tabasco: ['#d0201a', '#ff4a2a', 'rgba(220,238,245,0.9)'],
    };
    const cols = goo[q.kind];
    for (let i = 0; i < 14; i++) {
      this.particles.push({
        x: q.x + this.rand(-6, 6),
        y,
        vx: this.rand(-120, 120),
        vy: this.rand(-200, -40),
        rot: this.rand(0, 6),
        vr: this.rand(-10, 10),
        life: this.rand(0.4, 0.8),
        max: 0.8,
        size: this.rand(1.4, 3),
        color: cols[i % cols.length],
        shape: i % 3 === 2 && q.kind !== 'lemon' && q.kind !== 'coffee' ? 'shard' : 'goo',
      });
    }
  }

  /** Active effects as little chips (icon + draining bar) on the backsplash under the cabinets. */
  private drawEffects(c: CanvasRenderingContext2D) {
    const s = this.sim;
    const chips: { kind: PickupKind; frac: number; label: string }[] = [];
    const map: [EffectKind, PickupKind, string][] = [
      ['fire', 'tabasco', 'FIRE'],
      ['slow', 'tahini', 'SLOW'],
      ['fast', 'coffee', 'x2'],
    ];
    for (const [k, kind, label] of map) if (s.effects[k] > 0) chips.push({ kind, frac: s.effects[k] / EFFECT_TIME[k], label });
    if (s.balls.length > 1) chips.push({ kind: 'lemon', frac: 1, label: `x${s.balls.length}` });
    if (!chips.length) return;
    let x = 20;
    const y = CABINET_BOTTOM + 14;
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    for (const ch of chips) {
      const w = 62;
      c.fillStyle = 'rgba(20,18,16,0.72)';
      c.beginPath();
      c.roundRect(x, y, w, 22, 11);
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.25)';
      c.lineWidth = 1;
      c.stroke();
      c.save();
      c.translate(x + 11, y + 11);
      c.scale(0.62, 0.62);
      drawPickup(c, ch.kind, 0, 0, 0, false);
      c.restore();
      c.font = `700 9px ${FONT}`;
      c.fillStyle = '#fff';
      c.fillText(ch.label, x + 22, y + 8);
      // Draining timer bar (blinks when nearly out).
      const blink = ch.frac < 0.25 && Math.sin(this.time * 18) > 0;
      c.fillStyle = 'rgba(255,255,255,0.18)';
      c.fillRect(x + 22, y + 14, w - 30, 3);
      c.fillStyle = blink ? '#ffffff' : ch.kind === 'tabasco' ? '#ff6a2a' : ch.kind === 'tahini' ? '#e0bf8a' : ch.kind === 'coffee' ? '#c9935a' : '#ffd23f';
      c.fillRect(x + 22, y + 14, (w - 30) * ch.frac, 3);
      x += w + 6;
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
