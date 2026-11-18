/** Draws one frame of Hose Shooter from the simulation state. */
import { dropPos, nozzleTip, type Ent, type Fx, type GameState, type Layout } from './logic';
import { drawBunny, drawCat, drawChicken, drawTurtle } from './actors';
import { renderBackground, renderForeground, renderTree } from './scene';
import { blob, ellipsePath, FONT, hn, limb, makeGrain, noShadow, paperShadow, poly, type Ctx } from './paper';
import { CHARACTERS } from '../../shared/characters';

export interface Layers {
  px: number;
  H: number;
  bg: HTMLCanvasElement | null;
  tree: HTMLCanvasElement | null;
  fg: HTMLCanvasElement | null;
  grain: CanvasPattern | null;
}

export function makeLayers(ctx: Ctx, L: Layout, px: number): Layers {
  const g = makeGrain(128);
  return {
    px,
    H: L.H,
    bg: renderBackground(L, px),
    tree: renderTree(L, px),
    fg: renderForeground(L, px),
    grain: ctx.createPattern(g, 'repeat'),
  };
}

function drawEnt(ctx: Ctx, e: Ent, t: number, px: number, L: Layout) {
  if (e.kind === 'cat') drawCat(ctx, e, t, px);
  else if (e.kind === 'bunny') drawBunny(ctx, e, t, px);
  else if (e.kind === 'turtle') drawTurtle(ctx, e, t, px);
  else drawChicken(ctx, e, t, px, L);
}

function drawMarks(ctx: Ctx, g: GameState) {
  for (const f of g.fx) {
    const k = 1 - f.t / f.life;
    if (f.kind === 'wallsplat') {
      ctx.globalAlpha = 0.4 * Math.min(1, k * 1.6);
      blob(ctx, f.x, f.y, 11, 8, '#c4ad84', f.seed * 100, 0.3);
      // a drip running down the render
      const run = Math.min(1, f.t / 1.2) * (14 + f.seed * 18);
      limb(ctx, [f.x + (f.seed - 0.5) * 6, f.y, f.x + (f.seed - 0.5) * 6, f.y + run], 2.2, '#c4ad84');
    } else if (f.kind === 'groundsplat') {
      ctx.globalAlpha = 0.35 * Math.min(1, k * 1.5);
      blob(ctx, f.x, f.y, 11 * f.s, 4 * f.s, '#3e2614', f.seed * 100, 0.2);
    }
  }
  ctx.globalAlpha = 1;
}

function drawTopFx(ctx: Ctx, g: GameState) {
  for (const f of g.fx) {
    const u = f.t / f.life;
    if (f.kind === 'splash') {
      const s = f.s;
      ctx.globalAlpha = 1 - u;
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI * (0.1 + 0.8 * (i / 5)) + hn(f.seed, i) * 0.2;
        const r = (6 + 18 * u) * s;
        const x = f.x + Math.cos(a) * r;
        const y = f.y + Math.sin(a) * r + 30 * u * u * s;
        blob(ctx, x, y, 2.6 * s * (1 - u * 0.5), 3.2 * s * (1 - u * 0.5), i % 2 ? '#e8f7ff' : '#8fd2f5', f.seed + i, 0.05);
      }
      blob(ctx, f.x, f.y, 7 * s * (1 - u), 4 * s * (1 - u), '#ffffff', f.seed, 0.2);
      ctx.globalAlpha = 1;
    } else if (f.kind === 'feathers') {
      for (let i = 0; i < 9; i++) {
        const a = hn(f.seed, i) * Math.PI;
        const x = f.x + Math.cos(a) * 40 * u + Math.sin(f.t * 6 + i) * 6;
        const y = f.y - 20 * Math.sin(Math.PI * Math.min(1, u * 1.5)) + 50 * u * u + hn(i, f.seed) * 10;
        ctx.globalAlpha = 1 - u * u;
        blob(ctx, x, y, 5, 2.2, i % 3 ? '#b4532a' : '#f4e2c8', f.seed + i, 0.1, f.t * 5 + i);
      }
      ctx.globalAlpha = 1;
    } else if (f.kind === 'points' && f.value !== undefined) {
      const y = f.y - 34 * Math.min(1, u * 1.6);
      const pop = Math.min(1, f.t / 0.1);
      ctx.save();
      ctx.globalAlpha = u > 0.7 ? (1 - u) / 0.3 : 1;
      ctx.font = `${Math.round(20 + 6 * pop * (1 - u))}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const txt = f.value > 0 ? `+${f.value}` : `${f.value}`;
      ctx.lineWidth = 5;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#2a1608';
      ctx.strokeText(txt, f.x, y);
      ctx.fillStyle = f.value > 0 ? (f.value >= 500 ? '#ffd23f' : '#fff8e0') : '#ff5a4f';
      ctx.fillText(txt, f.x, y);
      ctx.restore();
    }
  }
}

/** The water stream: consecutive drops are joined into a tapering ribbon. */
function drawStream(ctx: Ctx, g: GameState) {
  const ds = g.drops;
  if (!ds.length && !g.spraying) return;
  const tip = nozzleTip(g);
  const pts: { x: number; y: number; u: number; n: number }[] = [];
  for (const d of ds) {
    const p = dropPos(d);
    pts.push({ x: p.x, y: p.y, u: d.t / d.T, n: d.n });
  }
  pts.sort((a, b) => b.n - a.n); // newest (near the nozzle) first
  const passes: [string, number][] = [
    ['rgba(40,120,190,0.55)', 1.25],
    ['rgba(120,200,245,0.95)', 1],
    ['rgba(235,250,255,0.85)', 0.32],
  ];
  for (const [col, wk] of passes) {
    ctx.strokeStyle = col;
    ctx.lineCap = 'round';
    let prev: { x: number; y: number; u: number; n: number } | null = g.spraying ? { x: tip.x, y: tip.y, u: 0, n: g.dropN } : null;
    for (const p of pts) {
      if (prev && prev.n - p.n <= 2) {
        const w = (11 - 8 * p.u) * wk;
        ctx.lineWidth = Math.max(1, w);
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
      prev = p;
    }
  }
  // spray droplets flying off the ribbon
  for (const p of pts) {
    if (p.n % 2) continue;
    const off = hn(p.n, 1) * 6 * (0.3 + p.u);
    blob(ctx, p.x + off, p.y + hn(p.n, 2) * 5 * p.u, 1.6, 1.6, '#d9f3ff', p.n, 0.05);
  }
}

/** Bentzi's hand holding the teal pistol nozzle, from the bottom of the screen. */
function drawNozzle(ctx: Ctx, g: GameState, px: number, t: number) {
  const { L } = g;
  const B = CHARACTERS.bentzi.colors;
  const recoil = g.spraying ? Math.sin(t * 70) * 1.2 : 0;
  ctx.save();
  ctx.translate(L.pivotX, L.pivotY + recoil);
  ctx.rotate(g.angle);
  const K = 1.25;
  ctx.scale(K, K);
  paperShadow(ctx, px, 1.6);
  // hose into the grip
  limb(ctx, [0, -40, 10, 20, 50, 80], 16, '#1f9aa6');
  // barrel
  const len = L.nozzleLen / K;
  poly(ctx, [-11, -60, 11, -60, 9, -len + 14, -9, -len + 14], '#22a3ae', 1, 0.5);
  noShadow(ctx);
  poly(ctx, [-6, -64, -2, -64, -2, -len + 18, -5, -len + 18], '#7fd9df', 2, 0.3);
  paperShadow(ctx, px, 1);
  // tip cap and grip body
  poly(ctx, [-12, -len + 18, 12, -len + 18, 9, -len + 2, -9, -len + 2], '#13707a', 3, 0.4);
  poly(ctx, [-7, -len + 3, 7, -len + 3, 6, -len - 4, -6, -len - 4], '#d6b04a', 4, 0.3);
  poly(ctx, [-16, -40, 16, -40, 14, -78, -14, -78], '#178a95', 5, 0.6);
  // trigger lever
  poly(ctx, [12, -70, 30, -60, 28, -40, 14, -46], '#13707a', 6, 0.6);
  // fist (Bentzi: black tee sleeve at the bottom)
  blob(ctx, 2, -36, 26, 22, B.skin, 7, 0.05);
  for (let i = 0; i < 4; i++) blob(ctx, 18, -52 + i * 9, 9, 6, B.skin, 8 + i, 0.08);
  noShadow(ctx);
  for (let i = 0; i < 3; i++) limb(ctx, [12, -47 + i * 9, 22, -47 + i * 9], 1, '#b98463');
  paperShadow(ctx, px, 1);
  blob(ctx, -14, -46, 9, 14, B.skin, 12, 0.06, -0.4);
  poly(ctx, [-40, 20, 40, 20, 34, -14, -30, -18], B.shirt, 13, 1);
  noShadow(ctx);
  ctx.restore();
  // a little mist at the tip while spraying
  if (g.spraying) {
    const tip = nozzleTip(g);
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < 4; i++) blob(ctx, tip.x + hn(t * 30, i) * 8, tip.y + hn(i, t * 30) * 6, 2, 2, '#e8f7ff', i, 0.05);
    ctx.globalAlpha = 1;
  }
}

function drawReticle(ctx: Ctx, g: GameState, t: number) {
  const { aimX: x, aimY: y } = g;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(t * 0.8);
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = '#fffaf0';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ellipsePath(ctx, 0, 0, 13, 13, 3, 0.02);
  ctx.stroke();
  ctx.strokeStyle = '#1f6f78';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 2);
    limb(ctx, [0, -17, 0, -9], 2.5, '#fffaf0');
  }
  ctx.restore();
}

export function drawFrame(ctx: Ctx, g: GameState, lay: Layers, t: number, showReticle: boolean) {
  const { L } = g;
  const px = lay.px;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (lay.bg) ctx.drawImage(lay.bg, 0, 0);
  ctx.setTransform(px, 0, 0, px, 0, 0);
  drawMarks(ctx, g);

  // behind the tree: the chicken and anything on the wall
  for (const e of g.ents) if (e.kind === 'chicken') drawEnt(ctx, e, t, px, L);
  for (const e of g.ents) if (e.kind !== 'chicken' && e.zone === 'wall') drawEnt(ctx, e, t, px, L);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (lay.tree) ctx.drawImage(lay.tree, 0, 0);
  ctx.setTransform(px, 0, 0, px, 0, 0);

  const front = g.ents.filter((e) => e.kind !== 'chicken' && e.zone !== 'wall');
  front.sort((a, b) => (a.zone === 'tree' ? -1 : 0) - (b.zone === 'tree' ? -1 : 0) || a.y - b.y);
  for (const e of front) drawEnt(ctx, e, t, px, L);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (lay.fg) ctx.drawImage(lay.fg, 0, 0);
  ctx.setTransform(px, 0, 0, px, 0, 0);

  drawStream(ctx, g);
  drawTopFx(ctx, g);
  drawNozzle(ctx, g, px, t);
  if (showReticle) drawReticle(ctx, g, t);

  // subtle paper grain over the moving cut-outs
  if (lay.grain) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 0.05;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = lay.grain;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

export type { Fx };
