/**
 * Fake-3D renderer for the boulevard: a pinhole camera behind Rosie projects world points
 * (x across, y up, gap = distance ahead of Rosie) onto the canvas. Painter's algorithm, far to near.
 */
import { type Obstacle, obstacleGap } from './spawner';
import { type Sprite, type Sprites, buildSprites, drawRosie, drawBentziArm, fogc, shade, HAZE } from './art';

export const LANE_W = 1.6;
const CAM_H = 4.0;
const CAM_BACK = 8.5;
const FAR = 120;
const NEAR_Z = 0.9;
const WIRE_Y = 4.7;

export interface Player {
  lanePos: number; // 0..2 float
  jumpY: number; // world units
  phase: number;
  wag: number;
  lean: number;
  airborne: boolean;
  crashed: boolean;
}

export interface Frame {
  d: number;
  t: number; // seconds, for animation
  obstacles: Obstacle[];
  player: Player;
  showObstacles: boolean;
  shake: number;
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
const AWNINGS = ['#c8462f', '#2f7f8a', '#e0a63a', '#3f6b45', '#b8563a'];

export class Scene {
  W = 390;
  H = 844;
  F = 844;
  horizon = 290;
  camX = 0;
  private sky: HTMLCanvasElement | null = null;
  private sp: Sprites;
  private dpr = 1;
  private ctx: CanvasRenderingContext2D | null = null;

  constructor() {
    this.sp = buildSprites();
  }

  resize(W: number, H: number, dpr: number) {
    this.W = W;
    this.H = H;
    this.dpr = dpr;
    // Focal length from height, but keep all three lanes on narrow screens.
    this.F = Math.min(H * 0.98, W * 2.45);
    this.horizon = H * 0.80 - (CAM_H * this.F) / CAM_BACK;
    this.sky = this.buildSky();
  }

  private P(x: number, y: number, gap: number): Pt {
    const z = Math.max(NEAR_Z, gap + CAM_BACK);
    const s = this.F / z;
    return { x: this.W / 2 + (x - this.camX) * s, y: this.horizon + (CAM_H - y) * s, s };
  }
  private fog(gap: number): number {
    const z = gap + CAM_BACK;
    return Math.max(0, Math.min(1, (z - 18) / 100)) * 0.9;
  }

  private buildSky(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = Math.ceil(this.W * this.dpr);
    c.height = Math.ceil((this.horizon + 4) * this.dpr);
    const g = c.getContext('2d')!;
    g.scale(this.dpr, this.dpr);
    const hz = this.horizon;
    const grd = g.createLinearGradient(0, 0, 0, hz);
    grd.addColorStop(0, '#5b86b8');
    grd.addColorStop(0.45, '#a8bfd2');
    grd.addColorStop(0.75, '#f3c99a');
    grd.addColorStop(1, '#ffdcae');
    g.fillStyle = grd;
    g.fillRect(0, 0, this.W, hz + 4);
    // low sun ahead, down the boulevard (walking toward the sea at sunset)
    const sx = this.W * 0.58, sy = hz - 26;
    const glow = g.createRadialGradient(sx, sy, 4, sx, sy, this.W * 0.75);
    glow.addColorStop(0, 'rgba(255,240,200,0.95)');
    glow.addColorStop(0.08, 'rgba(255,214,150,0.65)');
    glow.addColorStop(0.35, 'rgba(255,190,130,0.18)');
    glow.addColorStop(1, 'rgba(255,190,130,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, this.W, hz + 4);
    g.beginPath(); g.arc(sx, sy, 15, 0, Math.PI * 2); g.fillStyle = '#fff4d6'; g.fill();
    // soft streaky clouds
    const clouds: [number, number, number][] = [[0.15, 0.35, 120], [0.72, 0.22, 150], [0.4, 0.55, 90], [0.9, 0.5, 110]];
    for (const [cx, cy, w] of clouds) {
      g.fillStyle = 'rgba(255,225,205,0.55)';
      g.beginPath(); g.ellipse(this.W * cx, hz * cy, w * 0.6, 7, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(240,170,150,0.35)';
      g.beginPath(); g.ellipse(this.W * cx + 12, hz * cy + 5, w * 0.45, 4, 0, 0, Math.PI * 2); g.fill();
    }
    // distant city haze silhouettes at the end of the boulevard
    g.fillStyle = 'rgba(214,170,140,0.55)';
    for (let i = 0; i < 26; i++) {
      const x = (i / 26) * this.W;
      const h = 6 + hash2(i, 7) * 16;
      g.fillRect(x, hz - h, this.W / 26 + 1, h + 4);
    }
    g.fillStyle = 'rgba(200,160,130,0.55)';
    for (let i = 0; i < 8; i++) {
      const x = hash2(i, 3) * this.W;
      g.fillRect(x, hz - 18 - hash2(i, 9) * 8, 1.4, 20);
      g.beginPath(); g.ellipse(x, hz - 20 - hash2(i, 9) * 8, 6, 3, 0, 0, Math.PI * 2); g.fill();
    }
    return c;
  }

  render(g: CanvasRenderingContext2D, fr: Frame) {
    const { W, H } = this;
    this.ctx = g;
    const pl = fr.player;
    const px = (pl.lanePos - 1) * LANE_W;
    this.camX = px * 0.42;
    g.save();
    if (fr.shake > 0) g.translate((Math.random() - 0.5) * fr.shake * 10, (Math.random() - 0.5) * fr.shake * 6);
    if (this.sky) g.drawImage(this.sky, 0, 0, W, this.horizon + 4);
    g.fillStyle = '#d9b27c';
    g.fillRect(0, this.horizon, W, H - this.horizon + 10);

    this.drawBuildings(g, fr.d, -1);
    this.drawBuildings(g, fr.d, 1);
    this.drawGround(g, fr);

    // collect sprites
    const items: { gap: number; fn: () => void }[] = [];
    this.collectScenery(fr.d, items);
    if (fr.showObstacles) for (const o of fr.obstacles) this.collectObstacle(g, o, fr, items);
    items.push({
      gap: 0.001,
      fn: () => {
        const p = this.P(px, pl.jumpY, 0);
        // shadow stays on the ground
        const ps = this.P(px, 0, 0);
        g.fillStyle = `rgba(50,30,10,${0.32 - pl.jumpY * 0.12})`;
        g.beginPath(); g.ellipse(ps.x, ps.y, ps.s * (0.36 - pl.jumpY * 0.07), ps.s * 0.08, 0, 0, Math.PI * 2); g.fill();
        drawRosie(g, p.x, p.y, p.s * 1.45, pl.phase, pl.wag, pl.lean, pl.airborne);
      },
    });
    items.sort((a, b) => b.gap - a.gap);
    // wires go over the far scenery but under near trees/trams
    let wiresDrawn = false;
    for (const it of items) {
      if (!wiresDrawn && it.gap < 18) { this.drawWires(g); wiresDrawn = true; }
      it.fn();
    }
    if (!wiresDrawn) this.drawWires(g);

    // leash + Bentzi's arm
    const rp = this.P(px, pl.jumpY, 0);
    const k = Math.min(W / 390, H / 844) * 0.85;
    const handX = W * 0.5 + (rp.x - W * 0.5) * 0.55 + 30 * k;
    const handY = H * 0.925 + (pl.crashed ? 10 : 0);
    const ringX = rp.x, ringY = rp.y - 0.74 * rp.s * 1.45;
    g.beginPath();
    g.moveTo(handX + 8 * k, handY - 28 * k);
    g.quadraticCurveTo((handX + ringX) / 2, (handY + ringY) / 2 + 26 * k - pl.jumpY * 20, ringX, ringY);
    g.lineWidth = 3.2 * k; g.strokeStyle = '#c63a2c'; g.stroke();
    g.lineWidth = 1 * k; g.strokeStyle = 'rgba(255,190,170,0.6)'; g.stroke();
    drawBentziArm(g, handX, handY, k);

    this.drawWarnings(g, fr);
    g.restore();
    // warm vignette
    const vg = g.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, H * 0.85);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(60,25,10,0.28)');
    g.fillStyle = vg;
    g.fillRect(0, 0, W, H);
  }

  // ---------- ground ----------
  private quad(g: CanvasRenderingContext2D, a: Pt, b: Pt, c: Pt, d: Pt, fill: string) {
    g.beginPath();
    g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c.x, c.y); g.lineTo(d.x, d.y);
    g.closePath();
    g.fillStyle = fill;
    g.fill();
  }
  private strip(g: CanvasRenderingContext2D, x1: number, x2: number, g1: number, g2: number, fill: string, y = 0) {
    this.quad(g, this.P(x1, y, g1), this.P(x2, y, g1), this.P(x2, y, g2), this.P(x1, y, g2), fill);
  }

  private drawGround(g: CanvasRenderingContext2D, fr: Frame) {
    const d = fr.d;
    const gN = NEAR_Z - CAM_BACK + 0.01, gF = FAR - CAM_BACK;
    // haze gradient on the far ground is painted at the end
    for (const side of [-1, 1]) {
      this.strip(g, side * 8.8, side * 11, gN, gF, '#d6cab5'); // sidewalk
      this.strip(g, side * 2.75, side * 8.8, gN, gF, '#d9b27c'); // sandy park strip
      this.strip(g, side * 2.4, side * 2.75, gN, gF, '#c4b9a6'); // concrete edge
      this.strip(g, side * 0.8, side * 2.4, gN, gF, '#958f86'); // track bed
    }
    this.strip(g, -0.8, 0.8, gN, gF, '#cdbca2'); // promenade
    // sand: lighter worn path near the benches, speckles
    for (const side of [-1, 1]) this.strip(g, side * 4.1, side * 5.6, gN, gF, '#e0bf8d');
    const z0 = Math.floor(d / 1.5);
    for (let k = z0; k < z0 + 34; k++) {
      const gap = k * 1.5 - d;
      if (gap + CAM_BACK < NEAR_Z + 0.2) continue;
      for (let j = 0; j < 6; j++) {
        const side = j % 2 ? 1 : -1;
        const x = side * (2.95 + hash2(k, j) * 5.7);
        const p = this.P(x, 0, gap + hash2(j, k) * 1.4);
        const r = Math.max(0.8, p.s * 0.05);
        g.fillStyle = j % 3 ? 'rgba(150,105,60,0.35)' : 'rgba(255,240,210,0.45)';
        g.fillRect(p.x - r, p.y - r * 0.4, r * 2, r * 0.8);
      }
    }
    // promenade paving rows (alternate shades), red-white curbs, track joints
    const t0 = Math.floor(d / 1.2);
    for (let k = t0; k < t0 + 60; k++) {
      const a = k * 1.2 - d, b = a + 1.2;
      if (b + CAM_BACK < NEAR_Z) continue;
      if (a + CAM_BACK > 75) break;
      const fg = this.fog(a);
      if (k % 2 === 0) this.strip(g, -0.8, 0.8, a, b, fogc('#c2b096', fg));
      this.strip(g, -0.82, -0.68, a, b, fogc(k % 2 ? '#d8d2c8' : '#c94a3c', fg));
      this.strip(g, 0.68, 0.82, a, b, fogc(k % 2 ? '#d8d2c8' : '#c94a3c', fg));
      if (k % 2 === 0) {
        for (const side of [-1, 1]) this.strip(g, side * 0.9, side * 2.3, a, a + 0.18, fogc('#857f77', fg));
      }
    }
    // centre joint on the promenade
    this.strip(g, -0.015, 0.015, gN, gF, 'rgba(120,100,80,0.35)');
    // rails (with warning glow when a tram is near)
    for (const lane of [0, 2]) {
      const c = (lane - 1) * LANE_W;
      const warn = fr.showObstacles ? this.laneWarn(fr, lane) : 0;
      for (const off of [-0.42, 0.42]) {
        this.strip(g, c + off - 0.05, c + off + 0.05, gN, gF, '#5b5650');
        this.strip(g, c + off - 0.022, c + off + 0.022, gN, gF, warn > 0 ? `rgba(255,${Math.round(200 - warn * 120)},${Math.round(160 - warn * 140)},1)` : '#e8e2d8');
      }
    }
    // far haze over the ground
    const hz = this.horizon;
    const grd = g.createLinearGradient(0, hz, 0, hz + this.H * 0.12);
    grd.addColorStop(0, HAZE);
    grd.addColorStop(1, 'rgba(242,210,174,0)');
    g.fillStyle = grd;
    g.fillRect(0, hz - 1, this.W, this.H * 0.12);
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
  private drawBuildings(g: CanvasRenderingContext2D, d: number, side: number) {
    const BL = 13;
    const k0 = Math.floor((d - CAM_BACK) / BL);
    const kEnd = Math.floor((d + FAR) / BL);
    const X = side * 11;
    for (let k = kEnd; k >= k0; k--) {
      const r = hash2(k, side + 5);
      const alley = r < 0.12;
      if (alley) continue;
      const g0 = k * BL - d + (hash2(k, side) < 0.3 ? 1.2 : 0);
      const g1 = (k + 1) * BL - d;
      if (g1 + CAM_BACK < NEAR_Z) continue;
      const floors = 3 + Math.floor(hash2(k, side + 11) * 3);
      const h = 3.6 + floors * 3.1;
      const col = BUILDING_COLORS[Math.floor(hash2(k, side + 21) * BUILDING_COLORS.length)];
      const fg = this.fog(Math.max(0, g0));
      const n0 = Math.max(g0, NEAR_Z - CAM_BACK + 0.05);
      // end wall facing the camera (seen when taller than the next building)
      if (g0 + CAM_BACK > NEAR_Z + 0.1) {
        this.quad(g, this.P(X, 0, g0), this.P(X + side * 9, 0, g0), this.P(X + side * 9, h, g0), this.P(X, h, g0), fogc(shade(col, -0.22), fg));
      }
      // facade
      this.quad(g, this.P(X, 0, n0), this.P(X, h, n0), this.P(X, h, g1), this.P(X, 0, g1), fogc(col, fg));
      // roof edge
      this.quad(g, this.P(X, h, n0), this.P(X, h + 0.35, n0), this.P(X, h + 0.35, g1), this.P(X, h, g1), fogc(shade(col, 0.25), fg));
      if (g0 + CAM_BACK > 95) continue;
      // ground-floor shops: glass + awning
      const aw = AWNINGS[Math.floor(hash2(k, side + 31) * AWNINGS.length)];
      for (let s = 0; s < 3; s++) {
        const a = g0 + 0.6 + s * 4.1, b = a + 3.3;
        if (b + CAM_BACK < NEAR_Z) continue;
        const a2 = Math.max(a, NEAR_Z - CAM_BACK + 0.05);
        if (b <= a2) continue;
        this.quad(g, this.P(X, 0.2, a2), this.P(X, 2.7, a2), this.P(X, 2.7, b), this.P(X, 0.2, b), fogc('#3d4650', fg));
        this.quad(g, this.P(X, 1.6, a2), this.P(X, 2.6, a2), this.P(X, 2.6, b), this.P(X, 1.6, b), fogc('#6f8193', fg));
        // awning sticks out toward the street
        this.quad(g, this.P(X, 3.1, a2), this.P(X - side * 1.1, 2.6, a2), this.P(X - side * 1.1, 2.6, b), this.P(X, 3.1, b), fogc(aw, fg));
        this.quad(g, this.P(X - side * 1.1, 2.6, a2), this.P(X - side * 1.1, 2.35, a2), this.P(X - side * 1.1, 2.35, b), this.P(X - side * 1.1, 2.6, b), fogc(shade(aw, -0.25), fg));
      }
      // upper floors: windows with shutters and balconies
      const sh = SHUTTERS[Math.floor(hash2(k, side + 41) * SHUTTERS.length)];
      const balc = hash2(k, side + 51) < 0.6;
      for (let f = 0; f < floors; f++) {
        const y0 = 3.6 + f * 3.1;
        for (let c = 0; c < 4; c++) {
          const a = g0 + 0.9 + c * 3.0, b = a + 1.7;
          if (a + CAM_BACK < NEAR_Z + 0.2) continue;
          const open = hash2(k * 7 + f, c + side * 3) < 0.55;
          this.quad(g, this.P(X, y0 + 0.7, a), this.P(X, y0 + 2.5, a), this.P(X, y0 + 2.5, b), this.P(X, y0 + 0.7, b), fogc(open ? '#3a4048' : sh, fg));
          if (open) this.quad(g, this.P(X, y0 + 1.6, a), this.P(X, y0 + 2.5, a), this.P(X, y0 + 2.5, b), this.P(X, y0 + 1.6, b), fogc(sh, fg));
          if (balc && c % 2 === 0) {
            const bb = b + 1.3;
            this.quad(g, this.P(X, y0 + 0.15, a - 0.2), this.P(X - side * 0.9, y0 + 0.15, a - 0.2), this.P(X - side * 0.9, y0 + 0.15, bb), this.P(X, y0 + 0.15, bb), fogc(shade(col, -0.3), fg));
            this.quad(g, this.P(X - side * 0.9, y0 + 0.15, a - 0.2), this.P(X - side * 0.9, y0 + 1.1, a - 0.2), this.P(X - side * 0.9, y0 + 1.1, bb), this.P(X - side * 0.9, y0 + 0.15, bb), fogc(shade(col, -0.12), fg));
          }
          // AC unit
          if (hash2(k + f * 13, c) < 0.25) {
            this.quad(g, this.P(X - side * 0.4, y0 + 0.3, b + 0.2), this.P(X - side * 0.4, y0 + 0.9, b + 0.2), this.P(X - side * 0.4, y0 + 0.9, b + 1.0), this.P(X - side * 0.4, y0 + 0.3, b + 1.0), fogc('#eeeeea', fg));
          }
        }
      }
      // rooftop solar water heater
      if (hash2(k, side + 61) < 0.75) {
        const gp = g0 + 3 + hash2(k, 2) * 6;
        const p = this.P(X + side * 1.5, h + 0.35, gp);
        this.sprite(g, this.sp.solar, p, gp, 0);
      }
    }
  }

  // ---------- scenery ----------
  private sprite(g: CanvasRenderingContext2D, sp: Sprite, p: Pt, gap: number, frame: number, flip = false) {
    const z = gap + CAM_BACK;
    if (z < NEAR_Z + 0.3) return;
    const fg = this.fog(gap);
    const lvl = fg < 0.2 ? 0 : fg < 0.45 ? 1 : 2;
    const img = sp.frames[frame % sp.frames.length][Math.min(lvl, sp.frames[0].length - 1)];
    const w = sp.w * p.s, h = sp.h * p.s;
    const fade = Math.max(0, Math.min(1, (FAR - z) / 18));
    if (fade < 1) g.globalAlpha = fade;
    if (flip) {
      g.save(); g.translate(p.x, 0); g.scale(-1, 1);
      g.drawImage(img, -w / 2, p.y - h, w, h);
      g.restore();
    } else g.drawImage(img, p.x - w / 2, p.y - h, w, h);
    g.globalAlpha = 1;
  }

  private collectScenery(d: number, items: { gap: number; fn: () => void }[]) {
    const g = this.ctx!;
    const add = (spacing: number, salt: number, place: (k: number, gap: number) => void) => {
      const k0 = Math.floor((d - CAM_BACK) / spacing);
      const k1 = Math.ceil((d + FAR) / spacing);
      for (let k = k0; k <= k1; k++) {
        const gap = k * spacing - d + hash2(k, salt) * spacing * 0.3;
        if (gap + CAM_BACK < NEAR_Z + 0.3 || gap + CAM_BACK > FAR) continue;
        place(k, gap);
      }
    };
    for (const side of [-1, 1]) {
      // inner row: big ficus and palms right by the track
      add(9, side * 3 + 1, (k, gap) => {
        const r = hash2(k, side * 7);
        if (r > 0.86) return;
        const x = side * (4.0 + hash2(k, 9) * 0.5);
        const sp = r < 0.42 ? this.sp.ficus[Math.abs(k) % 3] : this.sp.palms[Math.abs(k) % 3];
        items.push({ gap, fn: () => this.sprite(g, sp, this.P(x, 0, gap), gap, 0, hash2(k, 4) < 0.5) });
      });
      // outer row: tall palms
      add(12, side * 3 + 2, (k, gap) => {
        if (hash2(k, side * 11) < 0.25) return;
        const x = side * (7.4 + hash2(k, 19) * 0.8);
        const sp = hash2(k, side * 13) < 0.7 ? this.sp.palms[Math.abs(k + 1) % 3] : this.sp.ficus[Math.abs(k) % 3];
        items.push({ gap, fn: () => this.sprite(g, sp, this.P(x, 0, gap), gap, 0, hash2(k, 5) < 0.5) });
      });
      // benches and picnic tables in the park strip
      add(7, side * 3 + 3, (k, gap) => {
        const r = hash2(k, side * 17);
        if (r < 0.45) {
          const x = side * 4.85;
          items.push({ gap, fn: () => this.sprite(g, this.sp.bench, this.P(x, 0, gap), gap, 0) });
        } else if (r < 0.62) {
          const x = side * 6.1;
          items.push({ gap, fn: () => this.sprite(g, this.sp.picnic, this.P(x, 0, gap), gap, 0) });
        }
      });
      // street lamps on the sidewalk
      add(16, side * 3 + 4, (_k, gap) => {
        const x = side * 9.0;
        items.push({ gap, fn: () => this.sprite(g, this.sp.lamp, this.P(x, 0, gap), gap, 0, side > 0) });
      });
    }
    // catenary poles with cantilever arms over each track
    const PS = 24;
    const k0 = Math.floor((d - CAM_BACK) / PS), k1 = Math.ceil((d + FAR) / PS);
    for (let k = k0; k <= k1; k++) {
      const gap = k * PS - d;
      if (gap + CAM_BACK < NEAR_Z + 0.3 || gap + CAM_BACK > FAR) continue;
      items.push({
        gap,
        fn: () => {
          const fg = this.fog(gap);
          for (const side of [-1, 1]) {
            const b = this.P(side * 2.6, 0, gap), t = this.P(side * 2.6, 5.6, gap);
            g.strokeStyle = fogc('#55585e', fg);
            g.lineWidth = Math.max(1, b.s * 0.12);
            g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(t.x, t.y); g.stroke();
            const a1 = this.P(side * 2.6, 5.3, gap), a2 = this.P(side * 1.2, 5.3, gap);
            g.lineWidth = Math.max(1, b.s * 0.06);
            g.beginPath(); g.moveTo(a1.x, a1.y); g.lineTo(a2.x, a2.y); g.stroke();
            const w = this.P(side * 1.6, WIRE_Y, gap);
            g.beginPath(); g.moveTo(a1.x, a1.y + (t.y - a1.y) * 0.5); g.lineTo(w.x, w.y); g.stroke();
          }
        },
      });
    }
  }


  private drawWires(g: CanvasRenderingContext2D) {
    const gN = NEAR_Z - CAM_BACK + 0.05, gF = FAR - CAM_BACK;
    for (const lane of [0, 2]) {
      const c = (lane - 1) * LANE_W;
      const a = this.P(c, WIRE_Y, gN), b = this.P(c, WIRE_Y, gF);
      g.strokeStyle = 'rgba(40,40,46,0.85)'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
      const a2 = this.P(c, WIRE_Y + 0.6, gN), b2 = this.P(c, WIRE_Y + 0.6, gF);
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(a2.x, a2.y); g.lineTo(b2.x, b2.y); g.stroke();
    }
  }

  // ---------- obstacles ----------
  private collectObstacle(g: CanvasRenderingContext2D, o: Obstacle, fr: Frame, items: { gap: number; fn: () => void }[]) {
    const { near, far } = obstacleGap(o, fr.d);
    if (far + CAM_BACK < NEAR_Z || near + CAM_BACK > FAR) return;
    const x = (o.lane - 1) * LANE_W;
    if (o.kind === 'tramIn' || o.kind === 'tramOut') {
      items.push({ gap: Math.max(near, NEAR_Z - CAM_BACK) + 0.4, fn: () => this.drawTram(g, o, x, near, far, fr) });
      return;
    }
    const gap = near + (far - near) * 0.5;
    if (gap + CAM_BACK < NEAR_Z + 0.3) return;
    const frame = Math.floor(fr.t * (o.kind === 'bike' ? 7 : 4) + o.id) % 2;
    let sp: Sprite;
    if (o.kind === 'walker') sp = this.sp.walkers[o.variant % this.sp.walkers.length];
    else if (o.kind === 'bike') sp = this.sp.bikers[o.variant % this.sp.bikers.length];
    else sp = this.sp.lows[o.variant % this.sp.lows.length];
    const sway = o.kind === 'walker' ? Math.sin(fr.t * 2 + o.id) * 0.1 : 0;
    items.push({ gap, fn: () => this.sprite(g, sp, this.P(x + sway, 0, gap), gap, frame) });
  }

  private drawTram(g: CanvasRenderingContext2D, o: Obstacle, xc: number, near: number, far: number, fr: Frame) {
    const minGap = NEAR_Z - CAM_BACK + 0.05;
    const n = Math.max(near, minGap);
    if (far <= n) return;
    const hw = 0.78, y0 = 0.22, y1 = 2.85;
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
    for (let i = Math.max(0, startIdx); i * segLen < o.len - 0.6; i++) {
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
        this.quad(g, this.P(inner, 1.25, a2), this.P(inner, 2.32, a2), this.P(inner, 2.32, b), this.P(inner, 1.25, b), GLASS);
        this.quad(g, this.P(inner, 2.0, a2), this.P(inner, 2.32, a2), this.P(inner, 2.32, b), this.P(inner, 2.0, b), fogc('#4f6b84', fg));
      }
    }
    // articulation joints
    for (let j = 1; j < 3; j++) {
      const z = near + (o.len * j) / 3;
      if (z < n || z > far) continue;
      const p1 = this.P(inner, y0, z), p2 = this.P(inner, y1, z);
      g.strokeStyle = fogc('#5a5a60', fg); g.lineWidth = Math.max(1, p1.s * 0.05);
      g.beginPath(); g.moveTo(p1.x, p1.y); g.lineTo(p2.x, p2.y); g.stroke();
    }
    // pantograph up to the wire
    const pz = near + o.len * 0.5;
    if (pz > n && pz < far) {
      const b1 = this.P(xc - 0.4, y1, pz), b2 = this.P(xc + 0.4, y1, pz), top = this.P(xc, WIRE_Y, pz), mid = this.P(xc + 0.25, (y1 + WIRE_Y) / 2, pz);
      g.strokeStyle = fogc('#2c2c30', fgF); g.lineWidth = Math.max(1, b1.s * 0.05);
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
      g.fillStyle = BODY; g.fill();
      g.clip();
      // red nose
      g.fillStyle = RED;
      g.beginPath(); g.moveTo(L, T + h * 0.62); g.quadraticCurveTo(L + w / 2, T + h * 0.5, L + w, T + h * 0.62); g.lineTo(L + w, T + h); g.lineTo(L, T + h); g.closePath(); g.fill();
      // windscreen
      g.fillStyle = GLASS;
      g.beginPath(); g.roundRect(L + w * 0.08, T + h * 0.1, w * 0.84, h * 0.4, [s * 0.3, s * 0.3, s * 0.05, s * 0.05]); g.fill();
      g.fillStyle = fogc('#5f7d96', fg);
      g.beginPath(); g.moveTo(L + w * 0.15, T + h * 0.12); g.lineTo(L + w * 0.35, T + h * 0.12); g.lineTo(L + w * 0.2, T + h * 0.48); g.lineTo(L + w * 0.1, T + h * 0.48); g.closePath(); g.fill();
      // destination display
      g.fillStyle = '#1a1a1a';
      g.fillRect(L + w * 0.25, T + h * 0.03, w * 0.5, h * 0.06);
      g.fillStyle = o.kind === 'tramIn' ? '#ffb43a' : '#ff6a3a';
      for (let i = 0; i < 6; i++) g.fillRect(L + w * (0.29 + i * 0.07), T + h * 0.045, w * 0.04, h * 0.03);
      // lights
      const lit = o.kind === 'tramIn' ? '#fff6cf' : '#ff3b2f';
      for (const lx of [0.16, 0.84]) {
        g.fillStyle = lit;
        g.beginPath(); g.ellipse(L + w * lx, T + h * 0.72, w * 0.07, h * 0.035, 0, 0, Math.PI * 2); g.fill();
      }
      g.restore();
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
        // coming from behind: chevrons rising from the bottom of the right track
        const base = this.P(x, 0, -2.4);
        for (let i = 0; i < 3; i++) {
          const y = base.y + 40 - i * 22 - ((fr.t * 60) % 22);
          g.globalAlpha = pulse * (0.4 + 0.2 * i);
          g.fillStyle = '#ff5a2a';
          g.beginPath();
          g.moveTo(base.x - 22, y + 10); g.lineTo(base.x, y - 4); g.lineTo(base.x + 22, y + 10);
          g.lineTo(base.x + 22, y + 18); g.lineTo(base.x, y + 4); g.lineTo(base.x - 22, y + 18); g.closePath();
          g.fill();
        }
        g.globalAlpha = 1;
        this.badge(g, Math.min(this.W - 34, base.x + 6), this.H * 0.68, pulse, urgency, 'back');
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
