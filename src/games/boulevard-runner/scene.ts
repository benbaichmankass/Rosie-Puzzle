/**
 * Fake-3D renderer for the boulevard: a pinhole camera behind Rosie projects world points
 * (x across, y up, gap = distance ahead of Rosie) onto the canvas. Painter's algorithm, far to near.
 */
import { type Obstacle, type Pickup, obstacleGap, RAMP_LEN, ROOF_H } from './spawner';
import { lightAt, type Light } from './daynight';
import { SHOPS_EVEN, SHOPS_ODD, type Shop } from './street';
import { pieces, segmentAt, lapU, lapOf, LAP, TRACKS_END, stationsIn, station, platformStart, PLATFORM_LEN, numberToU, LANDMARKS, hasTracks, type Segment } from './route';
import { type Sprite, type Sprites, buildSprites, drawRosie, drawBentziArm, drawBoardUnder, fogc, shade, HAZE } from './art';

export const LANE_W = 1.9;
const CAM_H = 4.0;
const CAM_BACK = 8.5;
const FAR = 120;
const NEAR_Z = 0.9;
const WIRE_Y = 4.7;

export interface Player {
  lanePos: number; // 0..2 float
  /** Height of Rosie's feet and of the surface under her (street, ramp or tram roof). */
  y: number;
  base: number;
  vy: number;
  phase: number;
  wag: number;
  lean: number;
  airborne: boolean;
  crashed: boolean;
  /** Seconds since the crash (-1 = no crash). */
  crashT: number;
  /** Seconds since the last landing. */
  landT: number;
  /** Riding the skateboard power-up; flickering after it took a hit. */
  board: boolean;
  ghost: boolean;
  /** 0..1 how far into a duck (crouch-roll) Rosie is. */
  crouch: number;
}

export interface Frame {
  d: number;
  t: number; // seconds, for animation
  obstacles: Obstacle[];
  player: Player;
  showObstacles: boolean;
  shake: number;
  /** Extra camera height (follows Rosie up onto roofs). */
  camLift: number;
  /** Time of day 0..1 (see daynight.ts). */
  tod: number;
  pickups: Pickup[];
  /** Pickup id -> run time it was collected (for the pop). */
  taken: Map<number, number>;
  magnet: boolean;
}

interface Pt { x: number; y: number; s: number }

function hash2(a: number, b: number): number {
  let x = Math.imul(a ^ 0x27d4eb2d, 0x9e3779b1) ^ Math.imul(b + 0x165667b1, 0x85ebca77);
  x ^= x >>> 15;
  x = Math.imul(x, 0x2c1b3c6d);
  x ^= x >>> 12;
  return (x >>> 0) / 4294967296;
}

const BUILDING_COLORS = ['#ead9b8', '#e3c79a', '#efe6d4', '#e6bf91', '#e9c9b4', '#d9cdb5', '#f0dcc0'];
const SHUTTERS = ['#5d7f8f', '#7a8f6a', '#8a6f55', '#6c7a8a', '#b9b2a2'];
/** Plain plaster of the post-1948 housing blocks, and Jaffa limestone of the older buildings. */
const PLAIN_COLORS = ['#e8e2d4', '#ddd6c6', '#e6dccd', '#d9d3c4', '#ece6d8'];
const STONE_COLORS = ['#dcc49c', '#d2b88e', '#e3cfa9', '#cdb489'];
const AWNINGS = ['#c8462f', '#2f7f8a', '#e0a63a', '#3f6b45', '#b8563a'];
/** Shop sign colour pairs (board, lettering). */
const SIGN_COLORS: [string, string][] = [
  ['#1f4e79', '#ffffff'], ['#f4efe2', '#b3261e'], ['#2e6b3a', '#fff6d6'], ['#f2c14e', '#3a2614'],
  ['#8c1c13', '#fff3e0'], ['#ffffff', '#1d3557'], ['#3d2b1f', '#f7d08a'], ['#0f7c80', '#ffffff'],
];

export class Scene {
  W = 390;
  H = 844;
  F = 844;
  horizon = 290;
  camX = 0;
  camH = CAM_H;
  private L: Light = lightAt(0);
  private tintRGB: [number, number, number] = [1, 1, 1];
  private tintCache = new Map<string, string>();
  private tintStep = -1;
  private spriteTint = new Map<HTMLCanvasElement, { step: number; c: HTMLCanvasElement }>();
  private retintBudget = 0;
  private scratch: HTMLCanvasElement | null = null;
  private scratch2: HTMLCanvasElement | null = null;
  private glowImgs = new Map<string, HTMLCanvasElement>();
  private sp: Sprites;
  private dpr = 1;
  private ctx: CanvasRenderingContext2D | null = null;
  private t = 0;

  constructor() {
    this.sp = buildSprites();
  }

  resize(W: number, H: number, dpr: number) {
    this.W = W;
    this.H = H;
    this.dpr = dpr;
    // Focal length from height, but keep all three lanes on narrow screens.
    this.F = Math.min(H * 0.98, W * 1.85);
    this.horizon = H * 0.80 - (CAM_H * this.F) / CAM_BACK;
  }

  private P(x: number, y: number, gap: number): Pt {
    const z = Math.max(NEAR_Z, gap + CAM_BACK);
    const s = this.F / z;
    return { x: this.W / 2 + (x - this.camX) * s, y: this.horizon + (this.camH - y) * s, s };
  }
  private fog(gap: number): number {
    const z = gap + CAM_BACK;
    return Math.max(0, Math.min(1, (z - 18) / 100)) * 0.9;
  }

  // ---------- day / night ----------
  private setLight(tod: number) {
    const L = lightAt(tod);
    this.L = L;
    if (L.step !== this.tintStep) {
      this.tintStep = L.step;
      this.tintCache.clear();
      this.litCache.clear();
      const n = parseInt(L.tint.slice(1), 16);
      this.tintRGB = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    }
    this.retintBudget = 16;
  }
  private get daylight() { return this.tintRGB[0] > 0.995 && this.tintRGB[1] > 0.995 && this.tintRGB[2] > 0.995; }
  /** A colour (hex, rgb() or rgba()) multiplied by the current world tint. */
  tc(color: string): string {
    if (this.daylight) return color;
    let v = this.tintCache.get(color);
    if (v) return v;
    let r = 0, g = 0, b = 0, a = 1;
    if (color[0] === '#') {
      const n = parseInt(color.slice(1, 7), 16);
      r = (n >> 16) & 255; g = (n >> 8) & 255; b = n & 255;
    } else {
      const m = color.match(/[\d.]+/g);
      if (!m) return color;
      r = +m[0]; g = +m[1]; b = +m[2]; if (m.length > 3) a = +m[3];
    }
    const [tr, tg, tb] = this.tintRGB;
    v = `rgba(${Math.round(r * tr)},${Math.round(g * tg)},${Math.round(b * tb)},${a})`;
    this.tintCache.set(color, v);
    return v;
  }
  /** A tinted copy of a sprite canvas for the current light step (built lazily, a few per frame). */
  private tintImg(img: HTMLCanvasElement): HTMLCanvasElement {
    if (this.daylight) return img;
    const hit = this.spriteTint.get(img);
    if (hit && (hit.step === this.tintStep || this.retintBudget <= 0)) return hit.c;
    if (this.retintBudget <= 0) return img;
    this.retintBudget--;
    const c = hit?.c ?? document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = this.L.tint;
    g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'source-over';
    this.spriteTint.set(img, { step: this.tintStep, c });
    return c;
  }
  /**
   * Draw something procedural (Rosie, Bentzi's arm) through the night tint: render it into a scratch
   * canvas, tint it (a bit lighter than the world so the heroes read), then copy it onto the screen.
   */
  private tinted(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
    if (this.daylight) { draw(g); return; }
    x = Math.floor(x); y = Math.floor(y); w = Math.ceil(w); h = Math.ceil(h);
    if (w < 1 || h < 1) return;
    const d = this.dpr;
    if (!this.scratch) { this.scratch = document.createElement('canvas'); this.scratch2 = document.createElement('canvas'); }
    const c = this.scratch, c2 = this.scratch2!;
    const need = (cv: HTMLCanvasElement) => { if (cv.width < w * d || cv.height < h * d) { cv.width = Math.max(cv.width, Math.ceil(w * d)); cv.height = Math.max(cv.height, Math.ceil(h * d)); } };
    need(c); need(c2);
    const s = c.getContext('2d')!, s2 = c2.getContext('2d')!;
    s.setTransform(1, 0, 0, 1, 0, 0);
    s.globalCompositeOperation = 'source-over';
    s.clearRect(0, 0, w * d, h * d);
    s.setTransform(d, 0, 0, d, -x * d, -y * d);
    draw(s);
    s.setTransform(1, 0, 0, 1, 0, 0);
    // keep a copy for the alpha mask (multiply also fills the transparent pixels)
    s2.setTransform(1, 0, 0, 1, 0, 0);
    s2.globalCompositeOperation = 'copy';
    s2.drawImage(c, 0, 0, w * d, h * d, 0, 0, w * d, h * d);
    s2.globalCompositeOperation = 'source-over';
    const [tr, tg, tb] = this.tintRGB;
    const lift = (v: number) => Math.round(255 * (v + (1 - v) * 0.35));
    s.globalCompositeOperation = 'multiply';
    s.fillStyle = `rgb(${lift(tr)},${lift(tg)},${lift(tb)})`;
    s.fillRect(0, 0, w * d, h * d);
    s.globalCompositeOperation = 'destination-in';
    s.drawImage(c2, 0, 0, w * d, h * d, 0, 0, w * d, h * d);
    s.globalCompositeOperation = 'source-over';
    g.drawImage(c, 0, 0, w * d, h * d, x, y, w, h);
  }

  private stars: [number, number, number][] = Array.from({ length: 70 }, (_, i) => [hash2(i, 101), hash2(i, 202), hash2(i, 303)]);

  private drawSky(g: CanvasRenderingContext2D) {
    const L = this.L, hz = this.horizon, W = this.W;
    const grd = g.createLinearGradient(0, 0, 0, hz);
    grd.addColorStop(0, L.skyTop);
    grd.addColorStop(0.5, L.skyMid);
    grd.addColorStop(0.85, L.skyLow);
    grd.addColorStop(1, L.haze);
    g.fillStyle = grd;
    g.fillRect(0, 0, W, hz + 4);
    // stars and moon
    if (L.stars > 0.01) {
      for (const [sx, sy, b] of this.stars) {
        const tw = 0.6 + 0.4 * Math.sin(this.t * (1 + b * 3) + sx * 50);
        g.globalAlpha = L.stars * tw * (0.4 + b * 0.6) * (1 - sy * 0.6);
        g.fillStyle = '#ffffff';
        const r = 0.6 + b * 1.1;
        g.fillRect(sx * W, sy * hz * 0.8, r, r);
      }
      g.globalAlpha = 1;
    }
    if (L.moon > 0.01) {
      const mx = W * 0.22, my = hz * 0.22;
      g.globalAlpha = L.moon;
      const mg = g.createRadialGradient(mx, my, 4, mx, my, 60);
      mg.addColorStop(0, 'rgba(220,230,255,0.35)');
      mg.addColorStop(1, 'rgba(220,230,255,0)');
      g.fillStyle = mg; g.fillRect(mx - 60, my - 60, 120, 120);
      g.beginPath(); g.arc(mx, my, 13, 0, Math.PI * 2); g.fillStyle = '#f4f1e2'; g.fill();
      g.beginPath(); g.arc(mx + 6, my - 3, 11.5, 0, Math.PI * 2); g.fillStyle = L.skyTop; g.fill();
      g.globalAlpha = 1;
    }
    // the sun, low ahead down the boulevard toward the sea
    if (L.sun > -0.2) {
      const sx = W * 0.58, sy = hz - 12 - Math.max(-0.2, L.sun) * hz * 0.55;
      const glow = g.createRadialGradient(sx, sy, 4, sx, sy, W * 0.75);
      const warm = L.sun < 0.5;
      glow.addColorStop(0, warm ? 'rgba(255,240,200,0.95)' : 'rgba(255,255,240,0.9)');
      glow.addColorStop(0.08, warm ? 'rgba(255,214,150,0.65)' : 'rgba(255,250,230,0.35)');
      glow.addColorStop(0.35, warm ? 'rgba(255,190,130,0.18)' : 'rgba(255,250,230,0.08)');
      glow.addColorStop(1, 'rgba(255,190,130,0)');
      g.fillStyle = glow;
      g.fillRect(0, 0, W, hz + 4);
      if (sy < hz + 10) { g.beginPath(); g.arc(sx, sy, 15, 0, Math.PI * 2); g.fillStyle = L.sunColor; g.fill(); }
    }
    // soft streaky clouds, lit by the sky
    const clouds: [number, number, number][] = [[0.15, 0.35, 120], [0.72, 0.22, 150], [0.4, 0.55, 90], [0.9, 0.5, 110]];
    for (const [cx, cy, w] of clouds) {
      g.fillStyle = this.tc('rgba(255,225,205,0.55)');
      g.beginPath(); g.ellipse(W * cx, hz * cy, w * 0.6, 7, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = this.tc('rgba(240,170,150,0.35)');
      g.beginPath(); g.ellipse(W * cx + 12, hz * cy + 5, w * 0.45, 4, 0, 0, Math.PI * 2); g.fill();
    }
    // distant city silhouettes at the end of the boulevard (with a few lit windows at night)
    g.fillStyle = this.tc('rgba(214,170,140,0.55)');
    for (let i = 0; i < 26; i++) {
      const x = (i / 26) * W;
      const h = 6 + hash2(i, 7) * 16;
      g.fillRect(x, hz - h, W / 26 + 1, h + 4);
    }
    if (L.lamps > 0.05) {
      g.fillStyle = `rgba(255,214,140,${0.7 * L.lamps})`;
      for (let i = 0; i < 40; i++) if (hash2(i, 9) < 0.6) g.fillRect(hash2(i, 5) * W, hz - 3 - hash2(i, 6) * 14, 1.5, 1.5);
    }
    g.fillStyle = this.tc('rgba(200,160,130,0.55)');
    for (let i = 0; i < 8; i++) {
      const x = hash2(i, 3) * W;
      g.fillRect(x, hz - 18 - hash2(i, 9) * 8, 1.4, 20);
      g.beginPath(); g.ellipse(x, hz - 20 - hash2(i, 9) * 8, 6, 3, 0, 0, Math.PI * 2); g.fill();
    }
  }

  /** Additive pool of lamplight lying on the ground (an ellipse in perspective). */
  private groundPool(g: CanvasRenderingContext2D, p: Pt, r: number, a: number) {
    const rx = p.s * r, ry = p.s * r * 0.32;
    if (rx < 2) return;
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = Math.min(1, a * 0.6);
    g.drawImage(this.glowImg('255,200,120'), p.x - rx, p.y - ry, rx * 2, ry * 2);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }

  /** Warm glow (additive) around a light source, plus an optional pool of light on the ground. */
  private glow(g: CanvasRenderingContext2D, x: number, y: number, r: number, a: number, color = '255,214,140') {
    if (a <= 0.01 || r < 1) return;
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = Math.min(1, a);
    g.drawImage(this.glowImg(color), x - r, y - r, r * 2, r * 2);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }
  /** Pre-rendered radial glow, so night scenes don't build gradients per lamp per frame. */
  private glowImg(color: string): HTMLCanvasElement {
    let c = this.glowImgs.get(color);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, `rgba(${color},0.55)`);
    rg.addColorStop(0.35, `rgba(${color},0.18)`);
    rg.addColorStop(1, `rgba(${color},0)`);
    g.fillStyle = rg;
    g.fillRect(0, 0, 64, 64);
    this.glowImgs.set(color, c);
    return c;
  }

  render(g: CanvasRenderingContext2D, fr: Frame) {
    const { W, H } = this;
    this.ctx = g;
    this.t = fr.t;
    this.camH = CAM_H + fr.camLift;
    this.setLight(fr.tod);
    const pl = fr.player;
    const px = (pl.lanePos - 1) * LANE_W;
    this.camX = px * 0.42;
    g.save();
    if (fr.shake > 0) g.translate((Math.random() - 0.5) * fr.shake * 10, (Math.random() - 0.5) * fr.shake * 6);
    this.drawSky(g);
    g.fillStyle = this.tc('#d9b27c');
    g.fillRect(0, this.horizon, W, H - this.horizon + 10);

    // ground first: its far haze band must not cover the shop fronts
    this.drawGround(g, fr);
    this.drawBuildings(g, fr.d, -1);
    this.drawBuildings(g, fr.d, 1);
    this.drawPlatforms(g, fr.d);

    // collect sprites
    const items: { gap: number; fn: () => void }[] = [];
    this.collectScenery(fr.d, items);
    this.collectStations(g, fr.d, items);
    if (fr.showObstacles) {
      for (const o of fr.obstacles) this.collectObstacle(g, o, fr, items);
      this.collectPickups(g, fr, items, px);
    }
    const hop = Math.max(0, pl.y - pl.base);
    items.push({
      // up on a roof she is above the tram, so draw her after it
      gap: pl.y > 0.6 ? -100 : 0.001,
      fn: () => {
        const p0 = this.P(px, pl.y, 0), u0 = p0.s * 1.45;
        this.tinted(g, p0.x - u0 * 1.1, p0.y - u0 * 2.4, u0 * 2.2, u0 * 2.9, (g) => {
        const p = this.P(px, pl.y, 0);
        // shadow on whatever she is above
        const ps = this.P(px, pl.base, 0);
        g.fillStyle = `rgba(50,30,10,${Math.max(0.08, 0.32 - hop * 0.12)})`;
        g.beginPath(); g.ellipse(ps.x, ps.y, ps.s * Math.max(0.12, 0.36 - hop * 0.07), ps.s * 0.08, 0, 0, Math.PI * 2); g.fill();
        // landing dust
        if (pl.landT >= 0 && pl.landT < 0.4) {
          const k = pl.landT / 0.4;
          g.fillStyle = `rgba(235,215,180,${0.7 * (1 - k)})`;
          for (let i = -2; i <= 2; i++) {
            if (i === 0) continue;
            const r = ps.s * (0.06 + k * 0.08);
            g.beginPath(); g.ellipse(ps.x + i * ps.s * (0.16 + k * 0.22), ps.y - ps.s * k * 0.08, r, r * 0.7, 0, 0, Math.PI * 2); g.fill();
          }
        }
        if (pl.crashT >= 0) {
          // bonk: squash, tip over a little, stars circling her head
          const c = Math.min(1, pl.crashT / 0.25);
          g.save();
          g.translate(p.x, p.y);
          g.rotate(Math.sin(pl.crashT * 18) * 0.12 * (1 - c * 0.6));
          g.scale(1 + 0.12 * Math.sin(Math.min(1, pl.crashT / 0.15) * Math.PI), 1 - 0.1 * Math.sin(Math.min(1, pl.crashT / 0.15) * Math.PI));
          drawRosie(g, 0, 0, p.s * 1.45, 0.4, pl.wag, 0, false);
          g.restore();
          const hx = p.x, hy = p.y - p.s * 1.45 * 1.0;
          for (let i = 0; i < 4; i++) {
            const a = pl.crashT * 5 + (i * Math.PI) / 2;
            this.star(g, hx + Math.cos(a) * p.s * 0.32, hy + Math.sin(a) * p.s * 0.08, p.s * 0.07, i % 2 ? '#ffd23f' : '#ffffff');
          }
          if (pl.crashT < 0.7) {
            const k = Math.min(1, pl.crashT / 0.12);
            g.save();
            g.translate(hx, hy - p.s * 0.45);
            g.scale(k, k);
            g.rotate(-0.12);
            g.font = `900 ${Math.round(p.s * 0.42)}px Rubik, system-ui, sans-serif`;
            g.textAlign = 'center';
            g.lineWidth = p.s * 0.08; g.strokeStyle = '#5a2f17'; g.lineJoin = 'round';
            g.strokeText('BONK!', 0, 0);
            g.fillStyle = '#ffd23f'; g.fillText('BONK!', 0, 0);
            g.restore();
          }
        } else {
          // squash on landing, stretch while rising, squash a touch at the top of the fall
          let sx = 1, sy = 1;
          if (pl.crouch > 0) { sx = 1 + 0.16 * pl.crouch; sy = 1 - 0.42 * pl.crouch; }
          else if (pl.landT >= 0 && pl.landT < 0.16) { const k = 1 - pl.landT / 0.16; sx = 1 + 0.2 * k; sy = 1 - 0.18 * k; }
          else if (pl.airborne) { const st = Math.max(-0.08, Math.min(0.16, pl.vy * 0.022)); sy = 1 + st; sx = 1 - st * 0.6; }
          g.save();
          if (pl.ghost) g.globalAlpha = 0.45 + 0.4 * Math.abs(Math.sin(this.t * 22));
          g.translate(p.x, p.y);
          g.scale(sx, sy);
          if (pl.board) {
            // riding: stands on the deck, gentle carving sway, no gallop
            drawBoardUnder(g, 0, 0, p.s * 1.45, Math.sin(this.t * 3) * 0.06 + pl.lean * 0.1);
            drawRosie(g, 0, -p.s * 1.45 * 0.06, p.s * 1.45, 0, pl.wag, pl.lean + Math.sin(this.t * 3) * 0.3, false);
          } else drawRosie(g, 0, 0, p.s * 1.45, pl.phase, pl.wag, pl.lean, pl.airborne);
          g.restore();
        }
        });
      },
    });
    items.sort((a, b) => b.gap - a.gap);
    // wires go over the far scenery but under near trees/trams
    let wiresDrawn = false;
    for (const it of items) {
      if (!wiresDrawn && it.gap < 18) { this.drawWires(g, fr.d); wiresDrawn = true; }
      it.fn();
    }
    if (!wiresDrawn) this.drawWires(g, fr.d);

    // leash + Bentzi's arm (he walks too: his hand bobs, gets tugged sideways and lifted)
    const rp = this.P(px, pl.y, 0);
    const k = Math.min(W / 390, H / 844) * 0.85;
    const step = Math.sin(pl.phase * 0.5);
    const lift = Math.min(1, pl.y / ROOF_H);
    const handX = W * 0.5 + (rp.x - W * 0.5) * 0.55 + 30 * k + pl.lean * 16 * k;
    const handY = H * 0.925 + (pl.crashed ? 10 : 0) + Math.abs(step) * 6 * k - lift * 46 * k - Math.min(1, hop) * 14 * k;
    const ringX = rp.x, ringY = rp.y - 0.74 * rp.s * 1.45;
    const tug = Math.max(-0.4, Math.min(0.4, (ringX - handX) / W)) + lift * -0.25;
    const startX = handX + 8 * k, startY = handY - 28 * k;
    const dist = Math.hypot(ringX - startX, ringY - startY);
    const slack = Math.max(4, 34 - dist * 0.06 - lift * 20) * k;
    const swing = Math.sin(pl.phase) * 7 * k;
    const top = Math.min(ringY, startY) - 12;
    this.tinted(g, 0, top, W, H - top, (g) => {
      g.beginPath();
      g.moveTo(startX, startY);
      g.quadraticCurveTo((startX + ringX) / 2 + swing, (startY + ringY) / 2 + slack, ringX, ringY);
      g.lineWidth = 3.2 * k; g.strokeStyle = '#c63a2c'; g.stroke();
      g.lineWidth = 1 * k; g.strokeStyle = 'rgba(255,190,170,0.6)'; g.stroke();
      drawBentziArm(g, handX, handY, k, tug + step * 0.04);
    });

    this.drawWarnings(g, fr);
    g.restore();
    // warm vignette
    const vg = g.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, H * 0.85);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(60,25,10,0.28)');
    g.fillStyle = vg;
    g.fillRect(0, 0, W, H);
  }

  private star(g: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.45 : r;
      g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath();
    g.fillStyle = fill; g.fill();
    g.lineWidth = Math.max(1, r * 0.18); g.strokeStyle = '#5a2f17'; g.stroke();
  }

  /** A quad drawn without the night tint (something that gives off light). */
  private quadLit(g: CanvasRenderingContext2D, a: Pt, b: Pt, c: Pt, d: Pt, fill: string) {
    g.beginPath();
    g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c.x, c.y); g.lineTo(d.x, d.y);
    g.closePath();
    g.fillStyle = fill;
    g.fill();
  }
  /** Lit colour: between the tinted day colour and a warm glow, by how dark it is. */
  private litCache = new Map<string, string>();
  private textW = new Map<string, number>();
  private litColor(day: string, glowHex: string, k: number): string {
    if (k <= 0.01) return this.tc(day);
    const kq = Math.round(k * 16) / 16;
    const key = day + glowHex + kq;
    const hit = this.litCache.get(key);
    if (hit) return hit;
    const v = this.litColorRaw(day, glowHex, kq);
    if (this.litCache.size > 4000) this.litCache.clear();
    this.litCache.set(key, v);
    return v;
  }
  private litColorRaw(day: string, glowHex: string, k: number): string {
    const t = this.tc(day);
    const m = t[0] === '#' ? null : t.match(/[\d.]+/g);
    let r: number, g: number, b: number;
    if (m) { r = +m[0]; g = +m[1]; b = +m[2]; } else { const n = parseInt(t.slice(1, 7), 16); r = (n >> 16) & 255; g = (n >> 8) & 255; b = n & 255; }
    const n2 = parseInt(glowHex.slice(1), 16);
    const R = (n2 >> 16) & 255, G = (n2 >> 8) & 255, B = n2 & 255;
    return `rgb(${Math.round(r + (R - r) * k)},${Math.round(g + (G - g) * k)},${Math.round(b + (B - b) * k)})`;
  }

  // ---------- ground ----------
  private quad(g: CanvasRenderingContext2D, a: Pt, b: Pt, c: Pt, d: Pt, fill: string) {
    g.beginPath();
    g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c.x, c.y); g.lineTo(d.x, d.y);
    g.closePath();
    g.fillStyle = this.tc(fill);
    g.fill();
  }
  private strip(g: CanvasRenderingContext2D, x1: number, x2: number, g1: number, g2: number, fill: string, y = 0) {
    this.quad(g, this.P(x1, y, g1), this.P(x2, y, g1), this.P(x2, y, g2), this.P(x1, y, g2), fill);
  }

  private drawGround(g: CanvasRenderingContext2D, fr: Frame) {
    const d = fr.d;
    const gN = NEAR_Z - CAM_BACK + 0.01, gF = FAR - CAM_BACK;
    const segs = pieces(d + gN, d + gF);
    // base strips for each stretch of the route (far pieces first)
    for (let i = segs.length - 1; i >= 0; i--) {
      const { seg } = segs[i];
      const a = segs[i].a - d, b = segs[i].b - d;
      const S = (x1: number, x2: number, c: string) => this.strip(g, x1, x2, a, b, c);
      if (seg === 'south' || seg === 'mall' || seg === 'mandate') {
        const outer = seg === 'south' ? '#6f6b66' : seg === 'mall' ? '#b88f72' : '#c7ae8b';
        for (const side of [-1, 1]) {
          S(side * 7.3, side * 12, seg === 'south' ? '#d3c9b6' : outer);        // sidewalk
          S(side * 2.62, side * 5.5, outer);                                     // one-lane road / shared paving
          if (seg === 'south') { S(side * 5.5, side * 5.62, '#cbc4b8'); S(side * 5.62, side * 7.3, '#d3c9b6'); }
          else S(side * 5.5, side * 7.3, seg === 'mall' ? '#c49c80' : '#d2bb98');
          S(side * 1.18, side * 2.62, seg === 'south' ? '#958f86' : seg === 'mall' ? '#a98068' : '#b8a07f'); // track bed
          S(side * 0.85, side * 1.1, '#cdbca2');                                 // planter edge / pavers
        }
        S(-0.85, 0.85, '#a9604c');                                               // two-way bike path
      } else if (seg === 'kaufman') {
        S(-12, 12, '#6a6763');                                                   // street crossing
        for (const side of [-1, 1]) S(side * 9.5, side * 14, '#cfc5b3');
      } else {
        // Charles Clore Park: promenade, paths, lawns; the sea opens up to the west (left)
        S(-1.1, 1.1, '#ddd2bb');
        for (const side of [-1, 1]) S(side * 1.1, side * 2.7, '#e6dcc6');
        S(2.7, 30, '#7fae55');
        S(-5.2, -2.7, '#7fae55');
        S(-6.3, -5.2, '#cfc6b5');                                                // sea-wall promenade
        S(-7.0, -6.3, '#8f8a80');                                                // rock armour
        S(-400, -7.0, '#3f86b8');                                                // the Mediterranean
      }
    }
    // details per row (paving joints, curbs, bike-path lines, zebra crossings, sea glints)
    const t0 = Math.floor(d / 1.2);
    for (let k = t0; k < t0 + 62; k++) {
      const a = k * 1.2 - d, b = a + 1.2;
      if (b + CAM_BACK < NEAR_Z) continue;
      if (a + CAM_BACK > 78) break;
      const fg = this.fog(a);
      const seg = segmentAt(d + a);
      if (seg === 'south' || seg === 'mall' || seg === 'mandate') {
        for (const side of [-1, 1]) {
          if (k % 2 === 0) this.strip(g, side * 0.85, side * 1.04, a, b, fogc('#bfae94', fg));
          this.strip(g, side * 1.04, side * 1.18, a, b, fogc(k % 2 ? '#d8d2c8' : '#9a958c', fg));
          if (seg === 'south') { if (k % 2 === 0) this.strip(g, side * 1.28, side * 2.52, a, a + 0.18, fogc('#857f77', fg)); }
          else if (k % 2 === 0) {
            // brick courses across the paved mall
            this.strip(g, side * 1.18, side * 7.3, a, a + 0.08, fogc(seg === 'mall' ? '#9c7660' : '#a88f70', fg));
          }
          if (seg === 'south' && k % 4 < 2) this.strip(g, side * 2.75, side * 2.8, a, b, fogc('#e9e4da', fg)); // road edge line
        }
        if (k % 3 === 0) this.strip(g, -0.035, 0.035, a, a + 1.4, fogc('#f4efe6', fg));
        for (const side of [-1, 1]) this.strip(g, side * 0.78, side * 0.82, a, b, fogc('#efe8dc', fg));
      } else if (seg === 'kaufman') {
        // zebra crossings across the junction, and lane lines
        const u = lapU(d + a);
        if (Math.floor(u / 1.2) % 40 < 6) for (let x = -8; x < 8; x += 1.0) this.strip(g, x, x + 0.55, a, b, fogc('#ece8e0', fg));
        else if (k % 3 === 0) for (const x of [-3.8, 3.8]) this.strip(g, x - 0.05, x + 0.05, a, a + 1.4, fogc('#e9e4da', fg));
      } else {
        if (k % 2 === 0) this.strip(g, -1.1, 1.1, a, b, fogc('#d2c6ad', fg));
        if (k % 5 === 0) for (let j = 0; j < 3; j++) {
          const x = -8 - hash2(k, j) * 60;
          this.strip(g, x, x + 1.5 + hash2(j, k) * 3, a, a + 0.15, fogc('#9fd0ea', fg)); // glints on the water
        }
      }
    }
    // painted bicycle symbols on the bike path
    const bk0 = Math.floor(d / 14);
    for (let k = bk0; k < bk0 + 6; k++) {
      const gap = k * 14 - d + 7;
      if (gap + CAM_BACK < NEAR_Z + 1 || gap + CAM_BACK > 70) continue;
      const seg = segmentAt(d + gap);
      if (seg === 'kaufman' || seg === 'park') continue;
      const fg = this.fog(gap);
      this.bikeSymbol(g, -0.42, gap, fogc('#f4efe6', fg), 1);
      this.bikeSymbol(g, 0.42, gap + 5, fogc('#f4efe6', fg), -1);
    }
    // rails where there is track (with warning glow when a tram is near)
    for (const pc of segs) {
      const a = pc.a - d;
      const bEnd = Math.min(pc.b, lapOf(pc.a) * LAP + TRACKS_END) - d;
      if (pc.seg === 'kaufman' || pc.seg === 'park' || bEnd <= a) continue;
      const flush = pc.seg !== 'south';
      for (const lane of [0, 2]) {
        const c = (lane - 1) * LANE_W;
        const warn = fr.showObstacles ? this.laneWarn(fr, lane) : 0;
        for (const off of [-0.42, 0.42]) {
          if (!flush) this.strip(g, c + off - 0.05, c + off + 0.05, a, bEnd, '#5b5650');
          this.strip(g, c + off - 0.022, c + off + 0.022, a, bEnd, warn > 0 ? `rgba(255,${Math.round(200 - warn * 120)},${Math.round(160 - warn * 140)},1)` : flush ? '#8d8a86' : '#e8e2d8');
        }
      }
    }
    // far haze over the ground
    const hz = this.horizon;
    const grd = g.createLinearGradient(0, hz, 0, hz + this.H * 0.12);
    grd.addColorStop(0, this.L.haze);
    grd.addColorStop(1, this.L.haze + '00');
    g.fillStyle = grd;
    g.fillRect(0, hz - 1, this.W, this.H * 0.12);
  }

  /** A painted bicycle pictogram lying on the bike path, drawn in perspective (dir: 1 = facing away). */
  private bikeSymbol(g: CanvasRenderingContext2D, x: number, gap: number, color: string, dir: number) {
    // painted markings are stretched along the lane so they read correctly in perspective
    const ring = (cx: number, cz: number) => {
      g.beginPath();
      for (let i = 0; i <= 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const p = this.P(cx + Math.cos(a) * 0.2, 0, cz + Math.sin(a) * 0.48);
        if (i === 0) g.moveTo(p.x, p.y); else g.lineTo(p.x, p.y);
      }
      g.stroke();
    };
    const p0 = this.P(x, 0, gap);
    g.strokeStyle = this.tc(color);
    g.lineWidth = Math.max(1, p0.s * 0.04);
    const w = 0.72 * dir;
    ring(x, gap - w);
    ring(x, gap + w);
    // frame: rear hub -> pedal -> seat, pedal -> front hub, seat -> bars
    const pts: [number, number][] = [[x, gap - w], [x + 0.02, gap - 0.05 * dir], [x - 0.14, gap - 0.25 * dir], [x - 0.14, gap + 0.4 * dir], [x + 0.02, gap - 0.05 * dir], [x, gap + w]];
    g.beginPath();
    pts.forEach(([px, pz], i) => { const q = this.P(px, 0, pz); if (i === 0) g.moveTo(q.x, q.y); else g.lineTo(q.x, q.y); });
    g.stroke();
    const h1 = this.P(x - 0.22, 0, gap + 0.45 * dir), h2 = this.P(x - 0.06, 0, gap + 0.45 * dir);
    g.beginPath(); g.moveTo(h1.x, h1.y); g.lineTo(h2.x, h2.y); g.stroke();
  }

  /** 0..1 pulsing intensity if a tram warning is active on this lane. */
  private laneWarn(fr: Frame, lane: number): number {
    for (const o of fr.obstacles) {
      if (o.lane !== lane || (o.kind !== 'tramIn' && o.kind !== 'tramOut')) continue;
      if (fr.d >= o.warnFrom && fr.d < o.end) return 0.5 + 0.5 * Math.sin(fr.t * 14);
    }
    return 0;
  }

  // ---------- buildings ----------
  /** Real shops at their house numbers: even numbers on the east (right) side, odd on the west (left). */
  private shopsByU = [
    ...SHOPS_EVEN.map((sh) => ({ sh, side: 1, u: numberToU(sh.no) })),
    ...SHOPS_ODD.map((sh) => ({ sh, side: -1, u: numberToU(sh.no) })),
  ].sort((a, b) => a.u - b.u);

  private drawBuildings(g: CanvasRenderingContext2D, d: number, side: number) {
    const BL = 13;
    const k0 = Math.floor((d - CAM_BACK) / BL);
    const kEnd = Math.floor((d + FAR) / BL);
    const X = side * 7.35;
    for (let k = kEnd; k >= k0; k--) {
      const z0 = k * BL;
      const seg = segmentAt(z0 + BL / 2);
      if (seg === 'park' || seg === 'kaufman') continue; // open junction, then the park and the sea
      const u0 = lapU(z0), u1 = u0 + BL;
      const lm = LANDMARKS.find((l) => l.side === side && l.u >= u0 && l.u < u1 && (l.kind === 'hospital' || l.kind === 'cityhall' || l.kind === 'postoffice'));
      const r = hash2(k, side + 5);
      if (!lm && r < 0.1) continue; // side street
      const g0 = z0 - d + (!lm && hash2(k, side) < 0.3 ? 1.2 : 0);
      const g1 = z0 + BL - d;
      if (g1 + CAM_BACK < NEAR_Z) continue;
      // style by stretch: plain post-1948 housing blocks (south), 1950s-60s blocks with shops (mall), older Jaffa stone (mandate)
      let floors = seg === 'mall' ? 4 + Math.floor(hash2(k, side + 11) * 2) : seg === 'south' ? 3 + Math.floor(hash2(k, side + 11) * 2) : 2 + Math.floor(hash2(k, side + 11) * 2);
      const palette = seg === 'mandate' ? STONE_COLORS : seg === 'south' ? PLAIN_COLORS : BUILDING_COLORS;
      let col = palette[Math.floor(hash2(k, side + 21) * palette.length)];
      if (lm?.kind === 'hospital') { col = '#f1f1ee'; floors = 5; }
      if (lm?.kind === 'cityhall') { col = '#ece2c9'; floors = 3; }
      if (lm?.kind === 'postoffice') { col = '#dcc49c'; floors = 2; }
      const stone = seg === 'mandate' || lm?.kind === 'postoffice';
      const h = 3.6 + floors * 3.1;
      const fg = this.fog(Math.max(0, g0)) * 0.65;
      const n0 = Math.max(g0, NEAR_Z - CAM_BACK + 0.05);
      if (g0 + CAM_BACK > NEAR_Z + 0.1) {
        this.quad(g, this.P(X, 0, g0), this.P(X + side * 9, 0, g0), this.P(X + side * 9, h, g0), this.P(X, h, g0), fogc(shade(col, -0.22), fg));
      }
      this.quad(g, this.P(X, 0, n0), this.P(X, h, n0), this.P(X, h, g1), this.P(X, 0, g1), fogc(col, fg));
      this.quad(g, this.P(X, h, n0), this.P(X, h + 0.35, n0), this.P(X, h + 0.35, g1), this.P(X, h, g1), fogc(shade(col, 0.25), fg));
      if (stone) for (const y of [3.4, h - 0.3]) this.quad(g, this.P(X - side * 0.12, y, n0), this.P(X - side * 0.12, y + 0.25, n0), this.P(X - side * 0.12, y + 0.25, g1), this.P(X - side * 0.12, y, g1), fogc(shade(col, -0.12), fg));
      if (g0 + CAM_BACK > 95) continue;
      // ground floor: real shops where a shop's house number falls in this block, else flats / arcades
      const here = this.shopsByU.filter((e) => e.side === side && e.u >= u0 && e.u < u1);
      const used = new Set<number>();
      const slotShop: (Shop | null)[] = [null, null, null];
      for (const e of here) {
        let slot = Math.min(2, Math.floor(((e.u - u0) / BL) * 3));
        while (used.has(slot) && slot < 2) slot++;
        if (!used.has(slot)) { used.add(slot); slotShop[slot] = e.sh; }
      }
      const aw = AWNINGS[Math.floor(hash2(k, side + 31) * AWNINGS.length)];
      for (let s = 0; s < 3; s++) {
        const a = g0 + 0.6 + s * 4.1, b = a + 3.3;
        if (b + CAM_BACK < NEAR_Z) continue;
        const a2 = Math.max(a, NEAR_Z - CAM_BACK + 0.05);
        if (b <= a2) continue;
        const shop = slotShop[s];
        const shopfront = !!shop || (seg === 'mall' && !lm && hash2(k * 3 + s, side) < 0.75);
        if (shopfront) {
          this.quadLit(g, this.P(X, 0.2, a2), this.P(X, 2.2, a2), this.P(X, 2.2, b), this.P(X, 0.2, b), this.litColor(fogc('#3d4650', fg), '#ffd98f', this.L.lamps * 0.9));
          this.quadLit(g, this.P(X, 1.3, a2), this.P(X, 2.1, a2), this.P(X, 2.1, b), this.P(X, 1.3, b), this.litColor(fogc('#6f8193', fg), '#fff0c8', this.L.lamps * 0.9));
          if (shop && a2 === a && a + CAM_BACK < 80) {
            this.shopSign(g, X, side, a - 0.2, b + 0.2, shop, fg);
            if (a + CAM_BACK > NEAR_Z + 1) this.bladeSign(g, X - side * 0.12, X - side * 2.5, a + 0.15, shop, fg);
          }
          this.quad(g, this.P(X, 2.25, a2), this.P(X - side * 0.9, 1.95, a2), this.P(X - side * 0.9, 1.95, b), this.P(X, 2.25, b), fogc(aw, fg));
          this.quad(g, this.P(X - side * 0.9, 1.95, a2), this.P(X - side * 0.9, 1.75, a2), this.P(X - side * 0.9, 1.75, b), this.P(X - side * 0.9, 1.95, b), fogc(shade(aw, -0.25), fg));
        } else if (stone) {
          // arcade of tall arched openings
          for (let j = 0; j < 2; j++) {
            const aa = a + 0.2 + j * 1.6, bb = aa + 1.1;
            if (aa < a2) continue;
            this.quad(g, this.P(X, 0.1, aa), this.P(X, 2.4, aa), this.P(X, 2.4, bb), this.P(X, 0.1, bb), fogc('#5b4b3a', fg));
            this.quad(g, this.P(X, 2.4, aa + 0.15), this.P(X, 2.75, aa + 0.4), this.P(X, 2.75, bb - 0.4), this.P(X, 2.4, bb - 0.15), fogc('#5b4b3a', fg));
          }
        } else {
          // ground-floor flats / entrance: windows with shutters
          const lit = this.L.lamps * (hash2(k * 5 + s, side) < 0.5 ? 1 : 0);
          this.quadLit(g, this.P(X, 0.9, a + 0.6), this.P(X, 2.3, a + 0.6), this.P(X, 2.3, b - 0.6), this.P(X, 0.9, b - 0.6), this.litColor(fogc('#4a4f55', fg), '#ffc867', lit));
        }
      }
      if (lm?.kind === 'postoffice' && a2ok(g0)) this.facadeWord(g, X, side, g0 + 3, g0 + 9, 'דואר', fg);
      if (lm?.kind === 'cityhall' && g0 + CAM_BACK > NEAR_Z + 1) {
        // flagpole on the roof
        const pp = this.P(X + side * 1.5, h + 0.35, g0 + 6), pt = this.P(X + side * 1.5, h + 4, g0 + 6);
        g.strokeStyle = this.tc('#7a7a7a'); g.lineWidth = Math.max(1, pp.s * 0.06);
        g.beginPath(); g.moveTo(pp.x, pp.y); g.lineTo(pt.x, pt.y); g.stroke();
        const wv = Math.sin(this.t * 3) * 0.08;
        this.quad(g, this.P(X + side * 1.5, h + 4, g0 + 6), this.P(X + side * 1.5 - side * 1.5, h + 4 + wv, g0 + 6), this.P(X + side * 1.5 - side * 1.5, h + 3 + wv, g0 + 6), this.P(X + side * 1.5, h + 3, g0 + 6), '#f4f4f4');
        this.quad(g, this.P(X + side * 1.5, h + 3.85, g0 + 6), this.P(X, h + 3.85 + wv, g0 + 6), this.P(X, h + 3.75 + wv, g0 + 6), this.P(X + side * 1.5, h + 3.75, g0 + 6), '#2a5db0');
        this.quad(g, this.P(X + side * 1.5, h + 3.25, g0 + 6), this.P(X, h + 3.25 + wv, g0 + 6), this.P(X, h + 3.15 + wv, g0 + 6), this.P(X + side * 1.5, h + 3.15, g0 + 6), '#2a5db0');
      }
      // upper floors
      const sh = SHUTTERS[Math.floor(hash2(k, side + 41) * SHUTTERS.length)];
      const balc = !stone && lm?.kind !== 'hospital' && hash2(k, side + 51) < (seg === 'south' ? 0.8 : 0.6);
      for (let f = 0; f < floors; f++) {
        const y0 = 3.6 + f * 3.1;
        if (lm?.kind === 'hospital') {
          // long horizontal window bands
          const lit = this.L.lamps * 0.8;
          this.quadLit(g, this.P(X, y0 + 0.9, n0 + 0.4), this.P(X, y0 + 2.2, n0 + 0.4), this.P(X, y0 + 2.2, g1 - 0.4), this.P(X, y0 + 0.9, g1 - 0.4), this.litColor(fogc('#7d9bb3', fg), '#eaf4ff', lit));
          continue;
        }
        for (let c = 0; c < 4; c++) {
          const a = g0 + 0.9 + c * 3.0, b = a + (stone ? 1.2 : 1.7);
          if (a + CAM_BACK < NEAR_Z + 0.2) continue;
          const open = hash2(k * 7 + f, c + side * 3) < 0.55;
          const lit = this.L.lamps * (hash2(k * 13 + f, c + side * 7) < 0.6 ? 1 : 0);
          const top = stone ? 2.7 : 2.5;
          if (lit > 0.02) {
            this.quadLit(g, this.P(X, y0 + 0.7, a), this.P(X, y0 + top, a), this.P(X, y0 + top, b), this.P(X, y0 + 0.7, b), this.litColor(fogc(open ? '#3a4048' : sh, fg), hash2(k, c) < 0.3 ? '#ffe7b0' : '#ffc867', lit * (1 - fg * 0.5)));
          } else this.quad(g, this.P(X, y0 + 0.7, a), this.P(X, y0 + top, a), this.P(X, y0 + top, b), this.P(X, y0 + 0.7, b), fogc(open ? '#3a4048' : sh, fg));
          if (open && !stone) this.quad(g, this.P(X, y0 + 1.6, a), this.P(X, y0 + 2.5, a), this.P(X, y0 + 2.5, b), this.P(X, y0 + 1.6, b), fogc(sh, fg));
          if (stone) this.quad(g, this.P(X - side * 0.1, y0 + 0.55, a - 0.15), this.P(X - side * 0.1, y0 + 0.7, a - 0.15), this.P(X - side * 0.1, y0 + 0.7, b + 0.15), this.P(X - side * 0.1, y0 + 0.55, b + 0.15), fogc(shade(col, -0.18), fg));
          if (balc && c % 2 === 0) {
            const bb = b + 1.3;
            this.quad(g, this.P(X, y0 + 0.15, a - 0.2), this.P(X - side * 0.9, y0 + 0.15, a - 0.2), this.P(X - side * 0.9, y0 + 0.15, bb), this.P(X, y0 + 0.15, bb), fogc(shade(col, -0.3), fg));
            this.quad(g, this.P(X - side * 0.9, y0 + 0.15, a - 0.2), this.P(X - side * 0.9, y0 + 1.1, a - 0.2), this.P(X - side * 0.9, y0 + 1.1, bb), this.P(X - side * 0.9, y0 + 0.15, bb), fogc(shade(col, -0.12), fg));
          }
          if (!stone && hash2(k + f * 13, c) < 0.25) {
            this.quad(g, this.P(X - side * 0.4, y0 + 0.3, b + 0.2), this.P(X - side * 0.4, y0 + 0.9, b + 0.2), this.P(X - side * 0.4, y0 + 0.9, b + 1.0), this.P(X - side * 0.4, y0 + 0.3, b + 1.0), fogc('#eeeeea', fg));
          }
        }
      }
      if (!lm && hash2(k, side + 61) < 0.75) {
        const gp = g0 + 3 + hash2(k, 2) * 6;
        const p = this.P(X + side * 1.5, h + 0.35, gp);
        this.sprite(g, this.sp.solar, p, gp, 0);
      }
    }
    function a2ok(g0: number) { return g0 + CAM_BACK > NEAR_Z + 1 && g0 + CAM_BACK < 80; }
  }

  /** A word in plain lettering on a facade (e.g. the post office), mapped like the shop signs. */
  private facadeWord(g: CanvasRenderingContext2D, X: number, side: number, a: number, b: number, word: string, fg: number) {
    this.shopSign(g, X, side, a, b, { he: word, en: 'Post Office', no: 12 }, fg);
  }

  // ---------- treats and power-ups ----------
  private collectPickups(g: CanvasRenderingContext2D, fr: Frame, items: { gap: number; fn: () => void }[], px: number) {
    for (const p of fr.pickups) {
      let gap = p.d - fr.d;
      if (gap > 70 || gap + CAM_BACK < NEAR_Z + 0.5) continue;
      const takenAt = fr.taken.get(p.id);
      let x = (p.lane - 1) * LANE_W;
      let y = (p.roof ? ROOF_H : 0) + 0.25 + Math.sin(fr.t * 4 + p.id) * 0.08;
      let alpha = 1, grow = 1;
      if (takenAt !== undefined) {
        // pop up toward Rosie and fade out
        const k = (fr.t - takenAt) / 0.3;
        if (k > 1) continue;
        x += (px - x) * k; gap = Math.max(gap, 0.2); y = fr.player.y + 0.8 + k * 0.6; alpha = 1 - k; grow = 1 + k * 0.6;
      } else if (fr.magnet && p.kind === 'treat' && gap < 9 && gap > -1) {
        // the magnet pulls treats in from every lane
        const k = 1 - Math.max(0, gap) / 9;
        x += (px - x) * k * k; y += (fr.player.y + 0.5 - y) * k * k;
      }
      const sp = p.kind === 'treat' ? this.sp.bone : p.kind === 'board' ? this.sp.boardItem : this.sp.magnet;
      const spin = p.kind === 'treat' ? Math.cos(fr.t * 3 + p.id * 0.7) : 1;
      items.push({
        gap,
        fn: () => {
          const pt = this.P(x, y, gap);
          if (pt.s < 1) return;
          g.save();
          g.globalAlpha = alpha;
          // glow ring under power-ups, soft shadow under everything
          const sh = this.P(x, p.roof ? ROOF_H : 0, gap);
          g.fillStyle = 'rgba(50,30,10,0.22)';
          g.beginPath(); g.ellipse(sh.x, sh.y, sh.s * 0.22, sh.s * 0.05, 0, 0, Math.PI * 2); g.fill();
          if (p.kind !== 'treat') {
            const rg = g.createRadialGradient(pt.x, pt.y - pt.s * 0.25, 0, pt.x, pt.y - pt.s * 0.25, pt.s * 0.6);
            rg.addColorStop(0, 'rgba(255,240,170,0.75)');
            rg.addColorStop(1, 'rgba(255,240,170,0)');
            g.fillStyle = rg;
            g.fillRect(pt.x - pt.s * 0.6, pt.y - pt.s * 0.85, pt.s * 1.2, pt.s * 1.2);
          }
          g.translate(pt.x, pt.y);
          g.scale(Math.max(0.25, Math.abs(spin)) * grow * 1.2, grow * 1.2);
          this.sprite(g, sp, { x: 0, y: 0, s: pt.s }, gap, 0);
          g.restore();
        },
      });
    }
  }

  // ---------- shop signs ----------
  private signCache = new Map<string, HTMLCanvasElement>();
  private fontsHooked = false;
  private signCanvas(shop: Shop): HTMLCanvasElement {
    if (!this.fontsHooked && typeof document !== 'undefined' && document.fonts) {
      this.fontsHooked = true;
      // re-letter the signs once Rubik (with Hebrew) has loaded
      void document.fonts.load('800 60px Rubik', 'אבג').then(() => { this.signCache.clear(); this.textW.clear(); this.boards.clear(); }).catch(() => {});
    }
    const key = shop.en;
    let c = this.signCache.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = 512; c.height = 128;
    const g = c.getContext('2d')!;
    const h = Math.floor(hash2(shop.no * 31 + shop.en.length, 3) * SIGN_COLORS.length);
    const [bg, fgc2] = SIGN_COLORS[h];
    g.fillStyle = bg; g.fillRect(0, 0, 512, 128);
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 8; g.strokeRect(4, 4, 504, 120);
    g.fillStyle = fgc2;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.direction = 'rtl';
    let size = 64;
    g.font = `800 ${size}px Rubik, 'Arial Hebrew', Arial, sans-serif`;
    while (g.measureText(shop.he).width > 470 && size > 30) { size -= 4; g.font = `800 ${size}px Rubik, 'Arial Hebrew', Arial, sans-serif`; }
    g.fillText(shop.he, 256, 52);
    g.direction = 'ltr';
    g.font = `600 26px Rubik, Arial, sans-serif`;
    g.fillText(shop.en.toUpperCase(), 256, 104);
    this.signCache.set(key, c);
    return c;
  }
  /** Sign board on the facade above a shop, mapped onto the wall in vertical slices (close to true perspective). */
  private shopSign(g: CanvasRenderingContext2D, X: number, side: number, a: number, b: number, shop: Shop, fg: number) {
    const img = this.signCanvas(shop);
    const yB = 2.3, yT = 3.4;
    const N = 8;
    // left wall reads near -> far, right wall far -> near (both left to right on screen)
    const zAt = (u: number) => (side < 0 ? a + (b - a) * u : b - (b - a) * u);
    const sw = img.width / N;
    for (let i = 0; i < N; i++) {
      const z0 = zAt(i / N), z1 = zAt((i + 1) / N);
      const T0 = this.P(X, yT, z0), T1 = this.P(X, yT, z1), B0 = this.P(X, yB, z0);
      g.save();
      g.transform((T1.x - T0.x) / sw, (T1.y - T0.y) / sw, (B0.x - T0.x) / img.height, (B0.y - T0.y) / img.height, T0.x, T0.y);
      g.drawImage(img, i * sw, 0, sw + 0.6, img.height, 0, 0, sw + 0.6, img.height);
      g.restore();
    }
    if (fg > 0.15) {
      g.globalAlpha = Math.min(0.6, fg - 0.15);
      this.quad(g, this.P(X, yB, a), this.P(X, yT, a), this.P(X, yT, b), this.P(X, yB, b), HAZE);
      g.globalAlpha = 1;
    }
  }

  private bladeSign(g: CanvasRenderingContext2D, x1: number, x2: number, gap: number, shop: Shop, fg: number) {
    const A = this.P(Math.min(x1, x2), 4.2, gap), B = this.P(Math.max(x1, x2), 3.6, gap);
    const w = B.x - A.x, h = B.y - A.y;
    if (w < 4) return;
    const bracket = this.P(x1, 4.3, gap), bracket2 = this.P(x2, 4.3, gap);
    g.strokeStyle = this.tc(fogc('#3a3a3a', fg)); g.lineWidth = Math.max(1, A.s * 0.04);
    g.beginPath(); g.moveTo(bracket.x, bracket.y); g.lineTo(bracket2.x, bracket2.y); g.stroke();
    g.drawImage(this.signCanvas(shop), A.x, A.y, w, h);
    if (fg > 0.15) { g.globalAlpha = Math.min(0.6, fg - 0.15); g.fillStyle = HAZE; g.fillRect(A.x, A.y, w, h); g.globalAlpha = 1; }
  }

  // ---------- light rail stations ----------
  /** Island platforms in the median between the two tracks (the real layout): the bike path runs onto them. */
  private drawPlatforms(g: CanvasRenderingContext2D, d: number) {
    const minGap = NEAR_Z - CAM_BACK + 0.05;
    const ks = stationsIn(d - CAM_BACK, d + FAR);
    for (let i = ks.length - 1; i >= 0; i--) {
      const g0 = platformStart(ks[i]) - d, g1 = g0 + PLATFORM_LEN;
      if (g1 < minGap || g0 + CAM_BACK > FAR) continue;
      const n0 = Math.max(g0, minGap);
      const fg = this.fog(Math.max(0, n0));
      const top = 0.12;
      this.quad(g, this.P(-1.12, top, n0), this.P(1.12, top, n0), this.P(1.12, top, g1), this.P(-1.12, top, g1), fogc('#d6d0c4', fg));
      // paving joints, then the yellow safety strips along both track edges
      for (let z = Math.ceil(n0 / 1.5) * 1.5; z < g1; z += 3) this.quad(g, this.P(-1.12, top, z), this.P(1.12, top, z), this.P(1.12, top, z + 0.1), this.P(-1.12, top, z + 0.1), fogc('#c2bbae', fg));
      for (const side of [-1, 1]) {
        this.quad(g, this.P(side * 1.12, top, n0), this.P(side * 0.95, top, n0), this.P(side * 0.95, top, g1), this.P(side * 1.12, top, g1), fogc('#f0c43a', fg));
        this.quad(g, this.P(side * 1.12, 0, n0), this.P(side * 1.12, top, n0), this.P(side * 1.12, top, g1), this.P(side * 1.12, 0, g1), fogc('#8f8a82', fg));
      }
      if (g0 > minGap) this.quad(g, this.P(-1.12, 0, g0), this.P(1.12, 0, g0), this.P(1.12, top, g0), this.P(-1.12, top, g0), fogc('#a39d93', fg));
    }
  }

  private collectStations(g: CanvasRenderingContext2D, d: number, items: { gap: number; fn: () => void }[]) {
    for (const k of stationsIn(d - CAM_BACK, d + FAR)) {
      const g0 = platformStart(k) - d;
      const name = station(k);
      const c = g0 + PLATFORM_LEN * 0.5;
      items.push({ gap: c + 7, fn: () => this.shelter(g, c) });
      // hanging name signs at both ends of the canopy, and a totem at the platform's near end
      items.push({ gap: c - 7.2, fn: () => this.nameSign(g, -0.75, 0.75, 2.05, 2.55, c - 7.2, name) });
      items.push({ gap: g0 + 1.2, fn: () => this.totem(g, 0.82, g0 + 1.2, name) });
    }
  }

  /** Platform shelter: posts at both edges of the platform, a glass canopy over the middle, a bench. */
  private shelter(g: CanvasRenderingContext2D, c: number) {
    const minGap = NEAR_Z - CAM_BACK + 0.05;
    const a = c - 7, b = c + 7;
    if (b < minGap) return;
    const a2 = Math.max(a, minGap);
    const fg = this.fog(Math.max(0, a2));
    g.strokeStyle = this.tc(fogc('#5c5f66', fg));
    for (let z = b; z >= a; z -= 3.5) {
      if (z < minGap) continue;
      for (const x of [-0.98, 0.98]) {
        const p1 = this.P(x, 0.12, z), p2 = this.P(x, 2.72, z);
        g.lineWidth = Math.max(1, p1.s * 0.06);
        g.beginPath(); g.moveTo(p1.x, p1.y); g.lineTo(p2.x, p2.y); g.stroke();
      }
    }
    // canopy underside (seen from below), red fascia along both edges
    this.quad(g, this.P(-1.05, 2.75, a2), this.P(1.05, 2.75, a2), this.P(1.05, 2.75, b), this.P(-1.05, 2.75, b), fogc('#e8e4dc', fg));
    for (const side of [-1, 1]) this.quad(g, this.P(side * 1.05, 2.55, a2), this.P(side * 1.05, 2.82, a2), this.P(side * 1.05, 2.82, b), this.P(side * 1.05, 2.55, b), fogc('#d22e2e', fg));
    if (a > minGap) this.quad(g, this.P(-1.05, 2.55, a), this.P(1.05, 2.55, a), this.P(1.05, 2.82, a), this.P(-1.05, 2.82, a), fogc('#b82626', fg));
    if (this.L.lamps > 0.02) {
      for (const z of [c - 4, c, c + 4]) {
        if (z < minGap) continue;
        const lp = this.P(0, 2.65, z);
        this.glow(g, lp.x, lp.y, lp.s * 1.6, this.L.lamps, '230,240,255');
        this.groundPool(g, this.P(0, 0.12, z), 1.3, this.L.lamps * 0.8);
      }
    }
  }

  /** A camera-facing sign: white board, red band, station name in Hebrew and English. */
  private nameSign(g: CanvasRenderingContext2D, x1: number, x2: number, y0: number, y1: number, gap: number, name: { en: string; he: string }) {
    if (gap + CAM_BACK < NEAR_Z + 0.3) return;
    const A = this.P(Math.min(x1, x2), y1, gap), B = this.P(Math.max(x1, x2), y0, gap);
    const w = B.x - A.x, h = B.y - A.y;
    if (w < 3) return;
    const fg = this.fog(gap);
    g.drawImage(this.stationBoard(name), A.x, A.y, w, h);
    if (fg > 0.15) { g.globalAlpha = Math.min(0.6, fg - 0.15); g.fillStyle = HAZE; g.fillRect(A.x, A.y, w, h); g.globalAlpha = 1; }
  }

  /** Station name board (white, red band, Hebrew + English), rendered once per station. */
  private boards = new Map<string, HTMLCanvasElement>();
  private stationBoard(name: { en: string; he: string }): HTMLCanvasElement {
    let c = this.boards.get(name.en);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = 360; c.height = 150;
    const g = c.getContext('2d')!;
    g.fillStyle = '#fbfaf6';
    g.beginPath(); g.roundRect(0, 0, 360, 150, 16); g.fill();
    g.fillStyle = '#d22e2e'; g.fillRect(0, 0, 360, 30);
    g.fillStyle = '#23262c'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const fit = (text: string, weight: number, maxFs: number) => {
      g.font = `${weight} 100px Rubik, Arial, sans-serif`;
      const fs = Math.min(maxFs, (324 * 100) / g.measureText(text).width);
      g.font = `${weight} ${fs}px Rubik, Arial, sans-serif`;
    };
    g.direction = 'rtl'; fit(name.he, 800, 56); g.fillText(name.he, 180, 72);
    g.direction = 'ltr'; fit(name.en, 600, 32); g.fillText(name.en, 180, 122);
    this.boards.set(name.en, c);
    return c;
  }

  private totem(g: CanvasRenderingContext2D, x: number, gap: number, name: { en: string; he: string }) {
    if (gap + CAM_BACK < NEAR_Z + 0.3) return;
    const fg = this.fog(gap);
    const p1 = this.P(x, 0.32, gap), p2 = this.P(x, 2.9, gap);
    g.strokeStyle = this.tc(fogc('#4a4c52', fg)); g.lineWidth = Math.max(1, p1.s * 0.08);
    g.beginPath(); g.moveTo(p1.x, p1.y); g.lineTo(p2.x, p2.y); g.stroke();
    this.nameSign(g, x - 0.62, x + 0.62, 2.9, 3.75, gap, name);
  }

  // ---------- scenery ----------
  private sprite(g: CanvasRenderingContext2D, sp: Sprite, p: Pt, gap: number, frame: number, flip = false, sway = 0) {
    const z = gap + CAM_BACK;
    if (z < NEAR_Z + 0.3) return;
    const fg = this.fog(gap);
    const lvl = fg < 0.2 ? 0 : fg < 0.45 ? 1 : 2;
    const img = this.tintImg(sp.frames[frame % sp.frames.length][Math.min(lvl, sp.frames[0].length - 1)]);
    const w = sp.w * p.s, h = sp.h * p.s;
    const fade = Math.max(0, Math.min(1, (FAR - z) / 18));
    if (fade < 1) g.globalAlpha = fade;
    if (flip || sway) {
      // sway = horizontal shear about the base (trees in the breeze)
      g.save(); g.translate(p.x, p.y); g.transform(flip ? -1 : 1, 0, sway, 1, 0, 0);
      g.drawImage(img, -w / 2, -h, w, h);
      g.restore();
    } else g.drawImage(img, p.x - w / 2, p.y - h, w, h);
    g.globalAlpha = 1;
  }

  private collectScenery(d: number, items: { gap: number; fn: () => void }[]) {
    const g = this.ctx!;
    const add = (spacing: number, salt: number, place: (k: number, gap: number, seg: Segment) => void) => {
      const k0 = Math.floor((d - CAM_BACK) / spacing);
      const k1 = Math.ceil((d + FAR) / spacing);
      for (let k = k0; k <= k1; k++) {
        const gap = k * spacing - d + hash2(k, salt) * spacing * 0.3;
        if (gap + CAM_BACK < NEAR_Z + 0.3 || gap + CAM_BACK > FAR) continue;
        place(k, gap, segmentAt(d + gap));
      }
    };
    const tree = (sp: Sprite, x: number, gap: number, k: number, sway = 0.025) =>
      items.push({ gap, fn: () => this.sprite(g, sp, this.P(x, 0, gap), gap, 0, hash2(k, 4) < 0.5, Math.sin(this.t * 1.2 + k * 1.7) * sway) });
    const lamp = (x: number, side: number, gap: number) => items.push({
      gap,
      fn: () => {
        this.sprite(g, this.sp.lamp, this.P(x, 0, gap), gap, 0, side > 0);
        const k = this.L.lamps;
        if (k > 0.02) {
          const head = this.P(x - side * 0.52, 4.8, gap), pool = this.P(x - side * 1.0, 0, gap);
          this.groundPool(g, pool, 1.9, k);
          this.glow(g, head.x, head.y, head.s * 1.6, k);
        }
      },
    });
    for (const side of [-1, 1]) {
      // the central promenade's trees, along both edges of the bike path (ficus; tamarisks on the newer
      // southern stretch; palms mixed in toward the north end), with planters between them
      add(8, side * 3 + 1, (k, gap, seg) => {
        const x = side * 1.13;
        const r = hash2(k, side * 7);
        if (seg === 'mall') { if (r < 0.92) tree(this.sp.medianFicus[Math.abs(k) % 3], x, gap, k); }
        else if (seg === 'south') { if (r < 0.6) tree(this.sp.tamarisk[Math.abs(k) % 2], side * 5.75, gap, k, 0.04); } // tamarisks along the sidewalk edge
        else if (seg === 'mandate') tree(r < 0.5 ? this.sp.palms[Math.abs(k) % 3] : this.sp.medianFicus[Math.abs(k) % 3], x, gap, k);
      });
      add(8, side * 3 + 5, (k, gap, seg) => {
        if (seg === 'kaufman' || seg === 'park') return;
        if (stationsIn(d + gap - 2, d + gap + 2).length) return;
        if (hash2(k, side * 9) < 0.5) items.push({ gap: gap + 4, fn: () => this.sprite(g, this.sp.planter, this.P(side * 1.0, 0, gap + 4), gap + 4, 0) });
      });
      // street lamps on the sidewalks (along the promenade in the park)
      add(16, side * 3 + 4, (_k, gap, seg) => {
        if (seg === 'park') { if (side < 0) lamp(-5.0, side, gap); return; }
        if (seg === 'kaufman') return;
        lamp(side * 6.9, side, gap);
      });
      // Charles Clore Park: palms and tamarisks on the east lawns, benches facing the sea
      add(9, side * 3 + 6, (k, gap, seg) => {
        if (seg !== 'park') return;
        if (side > 0) {
          tree(hash2(k, 3) < 0.7 ? this.sp.palms[Math.abs(k) % 3] : this.sp.tamarisk[Math.abs(k) % 2], 4.5 + hash2(k, 8) * 5, gap, k, 0.03);
          if (hash2(k, 5) < 0.6) tree(this.sp.palms[Math.abs(k + 1) % 3], 10 + hash2(k, 9) * 6, gap + 4, k + 1, 0.03);
        } else if (hash2(k, 6) < 0.6) items.push({ gap, fn: () => this.sprite(g, this.sp.bench, this.P(-4.4, 0, gap), gap, 0) });
      });
      // a few palms at the junction by the north end
      add(10, side * 3 + 7, (k, gap, seg) => { if (seg === 'kaufman' && hash2(k, side) < 0.6) tree(this.sp.palms[Math.abs(k) % 3], side * (10 + hash2(k, 2) * 3), gap, k); });
    }
    // landmarks
    for (const lm of LANDMARKS) {
      const lap0 = Math.max(0, lapOf(d - CAM_BACK)), lap1 = lapOf(d + FAR);
      for (let lap = lap0; lap <= lap1; lap++) {
        const gap = lap * LAP + lm.u - d;
        if (gap + CAM_BACK < NEAR_Z + 0.5 || gap + CAM_BACK > FAR) continue;
        const sp = lm.kind === 'mosque' ? this.sp.minaret : lm.kind === 'stadium' ? this.sp.stadium : lm.kind === 'clocktower' ? this.sp.clockTower : lm.kind === 'beitgidi' ? this.sp.beitGidi : null;
        if (!sp) continue;
        // set back behind the building line (the stadium ~250 m away to the east, the clock tower west down the side streets)
        const x = lm.kind === 'stadium' ? 34 : lm.kind === 'clocktower' ? -13 : lm.kind === 'beitgidi' ? -4.2 : lm.side * 9.8;
        items.push({ gap: gap + (lm.kind === 'stadium' ? 30 : 0), fn: () => this.sprite(g, sp, this.P(x, 0, gap), gap, 0) });
      }
    }
    // catenary poles with cantilever arms over each track (only where there is track)
    const PS = 24;
    const k0 = Math.floor((d - CAM_BACK) / PS), k1 = Math.ceil((d + FAR) / PS);
    for (let k = k0; k <= k1; k++) {
      const gap = k * PS - d;
      if (gap + CAM_BACK < NEAR_Z + 0.3 || gap + CAM_BACK > FAR || !hasTracks(d + gap)) continue;
      items.push({
        gap,
        fn: () => {
          const fg = this.fog(gap);
          for (const side of [-1, 1]) {
            const b = this.P(side * 2.85, 0, gap), t = this.P(side * 2.85, 5.6, gap);
            g.strokeStyle = this.tc(fogc('#55585e', fg));
            g.lineWidth = Math.max(1, b.s * 0.12);
            g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(t.x, t.y); g.stroke();
            const a1 = this.P(side * 2.85, 5.3, gap), a2 = this.P(side * 1.4, 5.3, gap);
            g.lineWidth = Math.max(1, b.s * 0.06);
            g.beginPath(); g.moveTo(a1.x, a1.y); g.lineTo(a2.x, a2.y); g.stroke();
            const w = this.P(side * LANE_W, WIRE_Y, gap);
            g.beginPath(); g.moveTo(a1.x, a1.y + (t.y - a1.y) * 0.5); g.lineTo(w.x, w.y); g.stroke();
            const k = this.L.lamps;
            if (k > 0.02) {
              const lampP = this.P(side * 2.55, 5.45, gap);
              g.fillStyle = '#fff3cf';
              g.beginPath(); g.ellipse(lampP.x, lampP.y, Math.max(1, lampP.s * 0.18), Math.max(0.6, lampP.s * 0.06), 0, 0, Math.PI * 2); g.fill();
              this.groundPool(g, this.P(side * 1.5, 0, gap), 2.2, k * 0.8);
              this.glow(g, lampP.x, lampP.y, lampP.s * 1.3, k * 0.8);
            }
          }
        },
      });
    }
  }

  private drawWires(g: CanvasRenderingContext2D, d: number) {
    const gN = NEAR_Z - CAM_BACK + 0.05;
    // wires run to the end of the track (the line turns off east at the north end of the boulevard)
    let gF = FAR - CAM_BACK;
    if (!hasTracks(d + gN)) {
      const next = (lapOf(d + gN) + 1) * LAP; // track starts again on the next lap
      if (next - d > gF) return;
      this.wireSpan(g, next - d, gF);
      return;
    }
    const end = lapOf(d + gN) * LAP + TRACKS_END - d;
    if (end < gF) { this.wireSpan(g, gN, end); const next = (lapOf(d + gN) + 1) * LAP - d; if (next < gF) this.wireSpan(g, next, gF); }
    else this.wireSpan(g, gN, gF);
  }
  private wireSpan(g: CanvasRenderingContext2D, g0: number, g1: number) {
    for (const lane of [0, 2]) {
      const c = (lane - 1) * LANE_W;
      const a = this.P(c, WIRE_Y, g0), b = this.P(c, WIRE_Y, g1);
      g.strokeStyle = this.tc('rgba(40,40,46,0.85)'); g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
      const a2 = this.P(c, WIRE_Y + 0.6, g0), b2 = this.P(c, WIRE_Y + 0.6, g1);
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(a2.x, a2.y); g.lineTo(b2.x, b2.y); g.stroke();
    }
  }

  // ---------- obstacles ----------
  private collectObstacle(g: CanvasRenderingContext2D, o: Obstacle, fr: Frame, items: { gap: number; fn: () => void }[]) {
    const { near, far } = obstacleGap(o, fr.d);
    if (far + CAM_BACK < NEAR_Z || near + CAM_BACK > FAR) return;
    const x = (o.lane - 1) * LANE_W;
    if (o.tram) {
      items.push({ gap: Math.max(near, NEAR_Z - CAM_BACK) + 0.4, fn: () => this.drawTram(g, o, x, near, far, fr) });
      return;
    }
    const gap = near + (far - near) * 0.5;
    if (gap + CAM_BACK < NEAR_Z + 0.3) return;
    if (o.duck) {
      // overhead things hang at their height (street bars ~0.65-1.9; roof things above the tram roof)
      const seg = segmentAt(o.start);
      let sp: Sprite, y = 0;
      if (o.kind === 'bar') sp = o.variant % 2 === 0 && seg !== 'kaufman' && seg !== 'park' ? this.sp.lowBranch : this.sp.boom;
      else if (o.kind === 'canopy') { sp = this.sp.canopyBeam; y = ROOF_H + 0.55; }
      else if (seg === 'south') { sp = this.sp.gantry; }
      else { sp = seg === 'mandate' && o.variant % 2 ? this.sp.roofFrond : this.sp.roofBranch[o.variant % 2]; y = ROOF_H + 0.6; }
      items.push({ gap: gap + 0.2, fn: () => this.sprite(g, sp, this.P(x, y, gap), gap, 0, o.variant % 4 === 1) });
      return;
    }
    const frame = Math.floor(fr.t * (o.kind === 'bike' ? 12 : 7) + o.id) % 4;
    let sp: Sprite;
    if (o.kind === 'walker') sp = this.sp.walkers[o.variant % this.sp.walkers.length];
    else if (o.kind === 'bike') sp = this.sp.bikers[o.variant % this.sp.bikers.length];
    else sp = this.sp.lows[o.variant % this.sp.lows.length];
    const sway = o.kind === 'walker' ? Math.sin(fr.t * 2 + o.id) * 0.1 : 0;
    items.push({ gap, fn: () => this.sprite(g, sp, this.P(x + sway, 0, gap), gap, frame) });
  }

  private drawTram(g: CanvasRenderingContext2D, o: Obstacle, xc: number, near: number, far: number, fr: Frame) {
    if (!o.ramp) { this.drawTramBody(g, o, xc, near, far, o.len, fr); return; }
    this.drawTramBody(g, o, xc, near + RAMP_LEN, far, o.len - RAMP_LEN, fr);
    this.drawRamp(g, xc, near);
  }

  /** Yellow-and-black ramp hooked onto the back of a tram, up to its roof. */
  private drawRamp(g: CanvasRenderingContext2D, xc: number, near: number) {
    const minGap = NEAR_Z - CAM_BACK + 0.05;
    const top = near + RAMP_LEN;
    if (top <= minGap) return;
    const hw = 0.72, H = ROOF_H;
    const z0 = Math.max(near, minGap);
    const h0 = (H * (z0 - near)) / RAMP_LEN;
    const fg = this.fog(Math.max(0, z0));
    const inner = xc < 0 ? xc + hw : xc - hw;
    // side
    g.beginPath();
    const a = this.P(inner, 0, z0), b = this.P(inner, h0, z0), c = this.P(inner, H, top), d = this.P(inner, 0, top);
    g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c.x, c.y); g.lineTo(d.x, d.y); g.closePath();
    g.fillStyle = fogc('#5b5a57', fg); g.fill();
    // sloped deck, in stripes
    const n = 8;
    for (let i = 0; i < n; i++) {
      const u0 = Math.max(z0, near + (RAMP_LEN * i) / n), u1 = near + (RAMP_LEN * (i + 1)) / n;
      if (u1 <= u0) continue;
      const y0 = (H * (u0 - near)) / RAMP_LEN, y1 = (H * (u1 - near)) / RAMP_LEN;
      this.quad(g, this.P(xc - hw, y0, u0), this.P(xc + hw, y0, u0), this.P(xc + hw, y1, u1), this.P(xc - hw, y1, u1), fogc(i % 2 ? '#2b2b2b' : '#f2c230', fg));
    }
    // rails along the edges
    g.strokeStyle = this.tc(fogc('#9a9a9a', fg));
    for (const sx of [-hw, hw]) {
      const p1 = this.P(xc + sx, h0 + 0.1, z0), p2 = this.P(xc + sx, H + 0.1, top);
      g.lineWidth = Math.max(1, p1.s * 0.05);
      g.beginPath(); g.moveTo(p1.x, p1.y); g.lineTo(p2.x, p2.y); g.stroke();
    }
  }

  private drawTramBody(g: CanvasRenderingContext2D, o: Obstacle, xc: number, near: number, far: number, bodyLen: number, fr: Frame) {
    const minGap = NEAR_Z - CAM_BACK + 0.05;
    const n = Math.max(near, minGap);
    if (far <= n) return;
    const hw = 0.78, y0 = 0.22, y1 = ROOF_H;
    const inner = xc < 0 ? xc + hw : xc - hw; // the side facing the camera
    const fg = this.fog(Math.max(n, 0));
    const BODY = fogc('#f3f1ec', fg), RED = fogc('#d22e2e', fg), GLASS = fogc('#26313c', fg), ROOF = fogc('#b9b6af', fg);
    const sideShade = fogc('#dedad2', fg);
    const fgF = this.fog(far);
    // roof
    const r1 = this.P(xc - hw, y1, n), r2 = this.P(xc + hw, y1, n), r3 = this.P(xc + hw, y1, far), r4 = this.P(xc - hw, y1, far);
    this.quad(g, r1, r2, r3, r4, ROOF);
    // side
    const sA = this.P(inner, y0, n), sB = this.P(inner, y1, n), sC = this.P(inner, y1, far), sD = this.P(inner, y0, far);
    this.quad(g, sA, sB, sC, sD, sideShade);
    // red skirt + stripe along the side
    this.quad(g, this.P(inner, y0, n), this.P(inner, 0.75, n), this.P(inner, 0.75, far), this.P(inner, y0, far), RED);
    this.quad(g, this.P(inner, 2.42, n), this.P(inner, 2.55, n), this.P(inner, 2.55, far), this.P(inner, 2.42, far), RED);
    // windows and doors along the side
    const segLen = 1.55;
    const startIdx = Math.ceil((n - near) / segLen);
    for (let i = Math.max(0, startIdx); i * segLen < bodyLen - 0.6; i++) {
      const a = near + i * segLen + 0.25, b = a + segLen - 0.4;
      if (b < n) continue;
      if (a > FAR - CAM_BACK) break;
      const a2 = Math.max(a, n);
      const door = i % 5 === 2;
      if (door) {
        this.quad(g, this.P(inner, 0.35, a2), this.P(inner, 2.3, a2), this.P(inner, 2.3, b), this.P(inner, 0.35, b), fogc('#3a4552', fg));
        const m = (a2 + b) / 2;
        const p1 = this.P(inner, 0.35, m), p2 = this.P(inner, 2.3, m);
        g.strokeStyle = BODY; g.lineWidth = Math.max(1, p1.s * 0.05);
        g.beginPath(); g.moveTo(p1.x, p1.y); g.lineTo(p2.x, p2.y); g.stroke();
      } else {
        if (this.L.lamps > 0.02) {
          this.quadLit(g, this.P(inner, 1.25, a2), this.P(inner, 2.32, a2), this.P(inner, 2.32, b), this.P(inner, 1.25, b), this.litColor(GLASS, '#fff3c8', this.L.lamps * 0.85));
        } else {
          this.quad(g, this.P(inner, 1.25, a2), this.P(inner, 2.32, a2), this.P(inner, 2.32, b), this.P(inner, 1.25, b), GLASS);
          this.quad(g, this.P(inner, 2.0, a2), this.P(inner, 2.32, a2), this.P(inner, 2.32, b), this.P(inner, 2.0, b), fogc('#4f6b84', fg));
        }
      }
    }
    // articulation joints
    for (let j = 1; j < 3; j++) {
      const z = near + (bodyLen * j) / 3;
      if (z < n || z > far) continue;
      const p1 = this.P(inner, y0, z), p2 = this.P(inner, y1, z);
      g.strokeStyle = this.tc(fogc('#5a5a60', fg)); g.lineWidth = Math.max(1, p1.s * 0.05);
      g.beginPath(); g.moveTo(p1.x, p1.y); g.lineTo(p2.x, p2.y); g.stroke();
    }
    // pantograph up to the wire
    const pz = near + bodyLen * 0.5;
    if (pz > n && pz < far) {
      const b1 = this.P(xc - 0.4, y1, pz), b2 = this.P(xc + 0.4, y1, pz), top = this.P(xc, WIRE_Y, pz), mid = this.P(xc + 0.25, (y1 + WIRE_Y) / 2, pz);
      g.strokeStyle = this.tc(fogc('#2c2c30', fgF)); g.lineWidth = Math.max(1, b1.s * 0.05);
      g.beginPath(); g.moveTo(b1.x, b1.y); g.lineTo(mid.x, mid.y); g.lineTo(top.x, top.y); g.moveTo(b2.x, b2.y); g.lineTo(mid.x, mid.y); g.stroke();
      const t1 = this.P(xc - 0.5, WIRE_Y, pz), t2 = this.P(xc + 0.5, WIRE_Y, pz);
      g.beginPath(); g.moveTo(t1.x, t1.y); g.lineTo(t2.x, t2.y); g.stroke();
    }
    // end face (front of an oncoming tram, rear of one pulling away)
    if (near > minGap) {
      const a = this.P(xc - hw, y0, near), b = this.P(xc + hw, y1, near);
      const w = b.x - a.x, h = a.y - b.y, s = a.s;
      const L = a.x, T = b.y;
      g.save();
      g.beginPath(); g.roundRect(L, T, w, h, [s * 0.35, s * 0.35, s * 0.08, s * 0.08]);
      g.fillStyle = this.tc(BODY); g.fill();
      g.clip();
      // red nose
      g.fillStyle = this.tc(RED);
      g.beginPath(); g.moveTo(L, T + h * 0.62); g.quadraticCurveTo(L + w / 2, T + h * 0.5, L + w, T + h * 0.62); g.lineTo(L + w, T + h); g.lineTo(L, T + h); g.closePath(); g.fill();
      // windscreen
      g.fillStyle = this.tc(GLASS);
      g.beginPath(); g.roundRect(L + w * 0.08, T + h * 0.1, w * 0.84, h * 0.4, [s * 0.3, s * 0.3, s * 0.05, s * 0.05]); g.fill();
      g.fillStyle = this.tc(fogc('#5f7d96', fg));
      g.beginPath(); g.moveTo(L + w * 0.15, T + h * 0.12); g.lineTo(L + w * 0.35, T + h * 0.12); g.lineTo(L + w * 0.2, T + h * 0.48); g.lineTo(L + w * 0.1, T + h * 0.48); g.closePath(); g.fill();
      // destination display
      g.fillStyle = '#1a1a1a';
      g.fillRect(L + w * 0.25, T + h * 0.03, w * 0.5, h * 0.06);
      g.fillStyle = o.lane === 0 ? '#ffb43a' : '#ff6a3a';
      for (let i = 0; i < 6; i++) g.fillRect(L + w * (0.29 + i * 0.07), T + h * 0.045, w * 0.04, h * 0.03);
      // lights
      const lit = o.lane === 0 ? (o.kind === 'tramStop' ? '#f3e7c0' : '#fff6cf') : '#ff3b2f';
      for (const lx of [0.16, 0.84]) {
        g.fillStyle = lit;
        g.beginPath(); g.ellipse(L + w * lx, T + h * 0.72, w * 0.07, h * 0.035, 0, 0, Math.PI * 2); g.fill();
      }
      g.restore();
      const nightLights = this.L.lamps;
      if (nightLights > 0.05) {
        for (const lx of [0.16, 0.84]) this.glow(g, L + w * lx, T + h * 0.72, w * (o.lane === 0 ? 0.9 : 0.5), nightLights, o.lane === 0 ? '255,245,210' : '255,70,50');
      }
      if (o.kind === 'tramIn') {
        // headlight glare
        for (const lx of [0.16, 0.84]) {
          const gx = L + w * lx, gy = T + h * 0.72;
          const rg = g.createRadialGradient(gx, gy, 0, gx, gy, w * 0.35);
          rg.addColorStop(0, 'rgba(255,245,200,0.75)');
          rg.addColorStop(1, 'rgba(255,245,200,0)');
          g.fillStyle = rg;
          g.fillRect(gx - w * 0.35, gy - w * 0.35, w * 0.7, w * 0.7);
        }
      }
    }
    void fr;
  }

  // ---------- telegraphs ----------
  private drawWarnings(g: CanvasRenderingContext2D, fr: Frame) {
    if (!fr.showObstacles) return;
    for (const o of fr.obstacles) {
      if (o.kind !== 'tramIn' && o.kind !== 'tramOut') continue;
      if (fr.d < o.warnFrom || fr.d >= o.D) continue;
      const pulse = 0.55 + 0.45 * Math.sin(fr.t * 16);
      const x = (o.lane - 1) * LANE_W;
      const urgency = 1 - (o.D - fr.d) / (o.D - o.warnFrom);
      if (o.kind === 'tramOut') {
        // a slower tram ahead on the right track: Rosie is catching up with it
        this.badge(g, Math.min(this.W - 34, this.P(x, 0, 6).x + 4), this.horizon + 44, pulse, urgency, 'front');
      } else {
        // oncoming: flashing beacon far down the left track
        const p = this.P(x, 1.2, Math.min(95, (o.D - fr.d) * 1.6 + 10));
        const r = 18 + pulse * 10;
        const rg = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        rg.addColorStop(0, `rgba(255,230,140,${0.9 * pulse})`);
        rg.addColorStop(1, 'rgba(255,120,40,0)');
        g.fillStyle = rg;
        g.fillRect(p.x - r, p.y - r, r * 2, r * 2);
        this.badge(g, Math.max(34, this.P(x, 0, 6).x - 4), this.horizon + 44, pulse, urgency, 'front');
      }
    }
  }

  /** Little round warning sign with a tram pictogram. */
  private badge(g: CanvasRenderingContext2D, x: number, y: number, pulse: number, urgency: number, dir: 'front' | 'back') {
    const r = 17 + urgency * 3;
    g.save();
    g.translate(x, y);
    g.globalAlpha = 0.75 + 0.25 * pulse;
    g.beginPath(); g.arc(0, 0, r + 3, 0, Math.PI * 2); g.fillStyle = '#ffffff'; g.fill();
    g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fillStyle = urgency > 0.6 ? '#e2342a' : '#f08a24'; g.fill();
    // tram icon
    g.fillStyle = '#fff';
    g.beginPath(); g.roundRect(-8, -9, 16, 15, 4); g.fill();
    g.fillStyle = urgency > 0.6 ? '#e2342a' : '#f08a24';
    g.fillRect(-6, -6, 12, 5);
    g.fillStyle = '#fff';
    g.fillRect(-1, -13, 2, 4);
    g.fillRect(-5, 7, 3, 3); g.fillRect(2, 7, 3, 3);
    // arrow showing where it comes from
    g.fillStyle = '#ffffff';
    g.beginPath();
    if (dir === 'back') { g.moveTo(-5, r + 9); g.lineTo(5, r + 9); g.lineTo(0, r + 3); }
    else { g.moveTo(-5, -r - 9); g.lineTo(5, -r - 9); g.lineTo(0, -r - 3); }
    g.closePath(); g.fill();
    g.restore();
  }
}
