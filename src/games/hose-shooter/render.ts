/** Draws one frame of Hose Shooter from the simulation state. */
import { dropPos, groundAt, nozzleTip, type Ent, type Fx, type GameState, type Layout } from './logic';
import { drawBunny, drawCat, drawChicken, drawTurtle } from './actors';
import { renderBackground, renderForeground, renderTree, type Sprite } from './scene';
import { blob, ellipsePath, FONT, hn, limb, noShadow, paperShadow, poly, type Ctx } from './paper';
import { CHARACTERS } from '../../shared/characters';

export interface Layers {
  px: number;
  H: number;
  bg: Sprite | null;
  tree: Sprite | null;
  fg: Sprite | null;
}

export function makeLayers(L: Layout, px: number): Layers {
  return {
    px,
    H: L.H,
    bg: renderBackground(L, px),
    tree: renderTree(L, px),
    fg: renderForeground(L, px),
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
      ctx.globalAlpha = 0.3 * Math.min(1, k * 1.6);
      blob(ctx, f.x, f.y, 11, 8, '#9c9a8c', f.seed * 100, 0.3);
      // a drip running down the render
      const run = Math.min(1, f.t / 1.2) * (14 + f.seed * 18);
      limb(ctx, [f.x + (f.seed - 0.5) * 6, f.y, f.x + (f.seed - 0.5) * 6, f.y + run], 2.2, '#9c9a8c');
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
      const txt = f.value > 0 ? `+$${f.value}` : `-$${-f.value}`;
      ctx.lineWidth = 5;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#2a1608';
      ctx.strokeText(txt, f.x, y);
      ctx.fillStyle = f.value > 0 ? (f.value >= 500 ? '#ffd23f' : '#fff3d2') : '#ff5a4f';
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

/** Bentzi's hand holding the hose nozzle like a six-shooter, from the bottom of the screen. */
function drawNozzle(ctx: Ctx, g: GameState, px: number, t: number, twirl: number, kick: number) {
  const { L } = g;
  const B = CHARACTERS.bentzi.colors;
  const recoil = (g.spraying ? Math.sin(t * 70) * 1.2 : 0) + (kick > 0 && kick < 1 ? Math.sin(kick * Math.PI) * 9 : 0);
  ctx.save();
  ctx.translate(L.pivotX, L.pivotY + recoil);
  ctx.rotate(g.angle);
  const K = 1.25;
  ctx.scale(K, K);
  if (twirl > 0 && twirl < 1) {
    // gunslinger spin around the cylinder
    const e = 1 - (1 - twirl) ** 3;
    ctx.translate(0, -80);
    ctx.rotate(e * Math.PI * 2);
    ctx.translate(0, 80);
  }
  paperShadow(ctx, px, 1.6);
  // hose into the butt of the grip
  limb(ctx, [0, -26, 10, 26, 50, 90], 16, '#1f9aa6');
  // walnut grip poking out under the fist
  poly(ctx, [-12, -30, 12, -34, 10, -4, -10, 0], '#6b3f22', 20, 0.6);
  // barrel: teal hose-nozzle barrel with brass bands and muzzle
  const len = L.nozzleLen / K;
  poly(ctx, [-8, -90, 8, -90, 7, -len + 10, -7, -len + 10], '#22a3ae', 1, 0.4);
  noShadow(ctx);
  poly(ctx, [-4.5, -94, -1.5, -94, -1.5, -len + 14, -4, -len + 14], '#8fe0e4', 2, 0.3);
  paperShadow(ctx, px, 0.8);
  for (const y of [-104, -118]) poly(ctx, [-9, y, 9, y, 9, y - 4, -9, y - 4], '#c9a04a', 3 - y, 0.2);
  poly(ctx, [-10, -len + 12, 10, -len + 12, 8, -len - 2, -8, -len - 2], '#d8b25a', 4, 0.3);
  noShadow(ctx);
  blob(ctx, 0, -len - 2, 5, 1.6, '#3a2a1a', 5, 0.05);
  paperShadow(ctx, px, 1);
  // brass frame and revolving cylinder
  poly(ctx, [-14, -58, 14, -58, 13, -94, -13, -94], '#9c7a3a', 6, 0.5);
  blob(ctx, 0, -78, 17, 13, '#d4ad55', 7, 0.04);
  noShadow(ctx);
  for (let i = -2; i <= 2; i++) limb(ctx, [i * 6, -88, i * 6.6, -68], 1.6, '#9c7a3a');
  blob(ctx, -5, -82, 4, 3, '#f2d88a', 8, 0.1);
  paperShadow(ctx, px, 0.8);
  // hammer and trigger lever
  poly(ctx, [-4, -56, 4, -56, 6, -46, -3, -44], '#3e3a36', 9, 0.4);
  poly(ctx, [12, -66, 28, -58, 26, -40, 14, -46], '#8a6a34', 10, 0.6);
  // fist
  paperShadow(ctx, px, 1);
  blob(ctx, 2, -36, 26, 22, B.skin, 11, 0.05);
  for (let i = 0; i < 4; i++) blob(ctx, 18, -52 + i * 9, 9, 6, B.skin, 12 + i, 0.08);
  noShadow(ctx);
  for (let i = 0; i < 3; i++) limb(ctx, [12, -47 + i * 9, 22, -47 + i * 9], 1, '#b98463');
  paperShadow(ctx, px, 1);
  blob(ctx, -14, -46, 9, 14, B.skin, 16, 0.06, -0.4);
  // tooled leather cowboy cuff with fringe, black tee sleeve below
  poly(ctx, [-42, 40, 42, 40, 36, 2, -32, -2], B.shirt, 17, 1);
  poly(ctx, [-34, 4, 36, 6, 32, -18, -28, -22], '#8a5430', 18, 0.8);
  noShadow(ctx);
  ctx.globalAlpha = 0.8;
  ctx.setLineDash([2.5, 2.5]);
  limb(ctx, [-28, -17, 31, -13], 1, '#f0d6a0');
  limb(ctx, [-32, 0, 34, 2], 1, '#f0d6a0');
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  blob(ctx, 2, -7, 6, 4, '#d4ad55', 19, 0.05);
  for (let i = 0; i < 9; i++) limb(ctx, [-30 + i * 8, 4, -31 + i * 8 + Math.sin(t * 3 + i) * 1.5, 13], 2, '#7a4626');
  ctx.restore();
  // a little mist at the tip while spraying
  if (g.spraying) {
    const tip = nozzleTip(g);
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < 4; i++) blob(ctx, tip.x + hn(t * 30, i) * 8, tip.y + hn(i, t * 30) * 6, 2, 2, '#f4fbff', i, 0.05);
    ctx.globalAlpha = 1;
  }
}

function drawReticle(ctx: Ctx, g: GameState, t: number) {
  const { aimX: x, aimY: y } = g;
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ellipsePath(ctx, 0, 0, 13, 13, 3, 0.02);
  ctx.strokeStyle = '#3a2210';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.strokeStyle = '#f2c94c';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.rotate(Math.sin(t * 2) * 0.1);
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 2);
    limb(ctx, [0, -19, 0, -8], 4, '#3a2210');
    limb(ctx, [0, -18.5, 0, -8.5], 2, '#f2c94c');
  }
  blob(ctx, 0, 0, 1.6, 1.6, '#3a2210', 1, 0);
  ctx.restore();
}

/** Tumbleweeds bouncing across the dirt. */
function drawWeeds(ctx: Ctx, g: GameState) {
  for (const w of g.weeds) {
    const { y, s } = groundAt(g.L, w.depth);
    const r = w.r * s;
    const hop = Math.abs(Math.sin(w.hopT * Math.PI)) * 12 * s;
    ctx.globalAlpha = 0.22;
    blob(ctx, w.x, y, r * 0.9, r * 0.22, '#3a1e08', 3, 0.02);
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(w.x, y - r - hop);
    ctx.rotate(w.spin);
    ctx.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      const a0 = hn(w.seed, i) * Math.PI;
      const a1 = a0 + 1.6 + hn(i, w.seed) * 1.2;
      const rr = r * (0.55 + 0.45 * Math.abs(hn(w.seed + 1, i)));
      ctx.beginPath();
      ctx.arc(hn(w.seed, i + 30) * r * 0.25, hn(w.seed, i + 40) * r * 0.25, rr, a0, a1);
      ctx.strokeStyle = i % 3 === 0 ? '#7a5428' : i % 3 === 1 ? '#a87a40' : '#c9a060';
      ctx.lineWidth = 1.4 * s;
      ctx.stroke();
    }
    ctx.restore();
  }
}

/** Drifting dust motes and the colander's glint. */
function drawAtmosphere(ctx: Ctx, g: GameState, t: number) {
  const { L } = g;
  for (let i = 0; i < 18; i++) {
    const sp = 12 + Math.abs(hn(i, 2)) * 22;
    const x = (((hn(i, 1) * 0.5 + 0.5) * 440 + t * sp) % 440) - 20;
    const y = L.wallTop * 0.6 + (hn(i, 3) * 0.5 + 0.5) * (L.H * 0.75 - L.wallTop * 0.6) + Math.sin(t * 0.8 + i) * 8;
    ctx.globalAlpha = 0.25 + 0.2 * Math.sin(t * 1.5 + i);
    blob(ctx, x, y, 1.4, 1.4, '#fff1cf', i, 0);
  }
  ctx.globalAlpha = 1;
  const ph = (t * 0.33) % 1;
  const k = Math.max(0, Math.sin(ph * Math.PI * 2)) ** 10;
  if (k > 0.02) {
    const cx = L.colanderX + 7;
    const cy = L.branchY + 22;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t);
    ctx.globalAlpha = k;
    poly(ctx, [0, -10 * k, 2, -2, 10 * k, 0, 2, 2, 0, 10 * k, -2, 2, -10 * k, 0, -2, -2], '#fffbe6', 1, 0);
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

export function drawFrame(ctx: Ctx, g: GameState, lay: Layers, t: number, showReticle: boolean, twirl = -1, kick = -1) {
  const { L } = g;
  const px = lay.px;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (lay.bg) ctx.drawImage(lay.bg.c, Math.round(lay.bg.x * px), Math.round(lay.bg.y * px));
  ctx.setTransform(px, 0, 0, px, 0, 0);
  drawMarks(ctx, g);

  // behind the tree: the chicken and anything on the wall
  for (const e of g.ents) if (e.kind === 'chicken') drawEnt(ctx, e, t, px, L);
  for (const e of g.ents) if (e.kind !== 'chicken' && e.zone === 'wall') drawEnt(ctx, e, t, px, L);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (lay.tree) ctx.drawImage(lay.tree.c, Math.round(lay.tree.x * px), Math.round(lay.tree.y * px));
  ctx.setTransform(px, 0, 0, px, 0, 0);

  drawWeeds(ctx, g);
  const front = g.ents.filter((e) => e.kind !== 'chicken' && e.zone !== 'wall');
  front.sort((a, b) => (a.zone === 'tree' ? -1 : 0) - (b.zone === 'tree' ? -1 : 0) || a.y - b.y);
  for (const e of front) drawEnt(ctx, e, t, px, L);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (lay.fg) ctx.drawImage(lay.fg.c, Math.round(lay.fg.x * px), Math.round(lay.fg.y * px));
  ctx.setTransform(px, 0, 0, px, 0, 0);

  drawAtmosphere(ctx, g, t);
  drawStream(ctx, g);
  drawTopFx(ctx, g);
  drawNozzle(ctx, g, px, t, twirl, kick);
  if (showReticle) drawReticle(ctx, g, t);
}

export type { Fx };
