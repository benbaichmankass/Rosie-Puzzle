/**
 * The yard's back wall as a dusty old-western showdown street: sun-bleached sky, mesas over the wall,
 * adobe render, a weathered plank fence, a gnarled desert tree. Cut-paper shapes, pre-rendered per resize.
 */
import { groundAt, type Layout } from './logic';
import { blob, ellipsePath, hn, limb, makeGrain, mix, noShadow, paperShadow, poly, type Ctx } from './paper';

/** A pre-rendered layer and where it goes (world units). */
export interface Sprite {
  c: HTMLCanvasElement;
  x: number;
  y: number;
}

function layer(L: Layout, px: number, x = 0, y = 0, w = L.W, h = L.H): { c: HTMLCanvasElement; ctx: Ctx; x: number; y: number } | null {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * px);
  c.height = Math.ceil(h * px);
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.scale(px, px);
  ctx.translate(-x, -y);
  return { c, ctx, x, y };
}

/** Torn-paper band: fills between a wavy top edge and the bottom of the screen. */
function tornBand(ctx: Ctx, y: number, H: number, fill: string, seed: number, amp = 2.5) {
  ctx.beginPath();
  ctx.moveTo(-10, H + 10);
  for (let x = -10; x <= 410; x += 8) ctx.lineTo(x, y + hn(seed, x) * amp + Math.sin(x * 0.03 + seed) * amp);
  ctx.lineTo(410, H + 10);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

/** A weathered plank with grain lines and two nail heads. */
export function plank(ctx: Ctx, x: number, y: number, w: number, h: number, base: string, seed: number) {
  poly(ctx, [x, y, x + w, y + hn(seed, 1) * 1.2, x + w, y + h, x, y + h], base, seed, 0.7);
  const dark = mix(base, '#2a1a0e', 0.35);
  const lite = mix(base, '#fff3d6', 0.25);
  ctx.save();
  noShadow(ctx);
  ctx.globalAlpha = 0.55;
  const vertical = h > w;
  for (let i = 1; i < 4; i++) {
    const k = i / 4 + hn(seed, i) * 0.06;
    if (vertical) limb(ctx, [x + w * k, y + 3, x + w * k + hn(seed, i + 9) * 2, y + h * 0.55, x + w * k, y + h - 3], 0.6, i % 2 ? dark : lite);
    else limb(ctx, [x + 3, y + h * k, x + w * 0.5, y + h * k + hn(seed, i + 9) * 1.5, x + w - 3, y + h * k], 0.6, i % 2 ? dark : lite);
  }
  // a knot
  ctx.globalAlpha = 0.45;
  blob(ctx, x + w * (0.3 + 0.4 * (hn(seed, 5) * 0.5 + 0.5)), y + h * (0.3 + 0.4 * (hn(seed, 6) * 0.5 + 0.5)), Math.min(w, h) * 0.12, Math.min(w, h) * 0.08, dark, seed + 3, 0.2);
  ctx.globalAlpha = 1;
  const nail = '#4a3a2c';
  if (vertical) {
    blob(ctx, x + w / 2, y + 4, 1.1, 1.1, nail, seed + 7, 0);
    blob(ctx, x + w / 2, y + h - 5, 1.1, 1.1, nail, seed + 8, 0);
  } else {
    blob(ctx, x + 4, y + h / 2, 1.1, 1.1, nail, seed + 7, 0);
    blob(ctx, x + w - 4, y + h / 2, 1.1, 1.1, nail, seed + 8, 0);
  }
  ctx.restore();
}

function saguaro(ctx: Ctx, x: number, base: number, h: number, col: string) {
  const w = h * 0.16;
  limb(ctx, [x, base, x, base - h], w, col);
  limb(ctx, [x - w * 0.5, base - h * 0.45, x - w * 1.8, base - h * 0.48, x - w * 1.8, base - h * 0.78], w * 0.75, col);
  limb(ctx, [x + w * 0.5, base - h * 0.6, x + w * 1.6, base - h * 0.62, x + w * 1.6, base - h * 0.9], w * 0.7, col);
}

function windmill(ctx: Ctx, x: number, base: number, h: number, col: string) {
  limb(ctx, [x - h * 0.16, base, x, base - h], 1.6, col);
  limb(ctx, [x + h * 0.16, base, x, base - h], 1.6, col);
  limb(ctx, [x - h * 0.11, base - h * 0.35, x + h * 0.11, base - h * 0.35], 1.2, col);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    limb(ctx, [x, base - h, x + Math.cos(a) * h * 0.3, base - h + Math.sin(a) * h * 0.3], 1.4, col);
  }
  limb(ctx, [x, base - h, x + h * 0.42, base - h + 2], 2, col);
  poly(ctx, [x + h * 0.36, base - h - 4, x + h * 0.5, base - h - 6, x + h * 0.5, base - h + 9, x + h * 0.36, base - h + 6], col, 4);
}

export function renderBackground(L: Layout, px: number): Sprite | null {
  const lay = layer(L, px);
  if (!lay) return null;
  const { ctx } = lay;
  const { H, wallTop, wallBase } = L;

  // ---- sun-bleached sky
  const sky = ctx.createLinearGradient(0, 0, 0, wallTop);
  sky.addColorStop(0, '#de8648');
  sky.addColorStop(0.55, '#f3cd8f');
  sky.addColorStop(1, '#f8e6bd');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, L.W, wallTop + 4);
  // the sun with a hazy halo
  for (let i = 4; i >= 1; i--) {
    ctx.globalAlpha = 0.12;
    blob(ctx, 300, 70, 26 + i * 16, 26 + i * 16, '#fff2c8', 80 + i, 0.02);
  }
  ctx.globalAlpha = 1;
  paperShadow(ctx, px, 0.5);
  blob(ctx, 300, 70, 28, 28, '#fff4d0', 3, 0.02);
  noShadow(ctx);
  // long wispy clouds
  ctx.globalAlpha = 0.75;
  for (const [cx, cy, w] of [[110, 52, 70], [210, 96, 56], [360, 132, 40], [60, 120, 34]] as const) {
    blob(ctx, cx, cy, w, 4.5, '#fbe9cc', cx, 0.08);
    blob(ctx, cx + w * 0.3, cy - 5, w * 0.55, 3.5, '#fdf1dc', cx + 1, 0.08);
  }
  ctx.globalAlpha = 1;
  // mesas and buttes beyond the wall, far ones paler
  poly(ctx, [-10, wallTop + 4, -10, wallTop - 36, 40, wallTop - 40, 58, wallTop - 62, 128, wallTop - 64, 142, wallTop - 42, 220, wallTop - 38, 232, wallTop + 4], '#d9a27c', 11, 1.2);
  poly(ctx, [190, wallTop + 4, 214, wallTop - 52, 236, wallTop - 86, 300, wallTop - 88, 318, wallTop - 56, 352, wallTop - 50, 366, wallTop - 70, 400, wallTop - 72, 410, wallTop + 4], '#c98a66', 12, 1.2);
  ctx.globalAlpha = 0.35;
  for (let i = 0; i < 5; i++) limb(ctx, [240 + i * 12, wallTop - 84 + i * 2, 238 + i * 12, wallTop - 10], 1, '#a86a4e');
  ctx.globalAlpha = 1;
  poly(ctx, [-10, wallTop + 4, -10, wallTop - 14, 90, wallTop - 20, 180, wallTop - 12, 300, wallTop - 22, 410, wallTop - 16, 410, wallTop + 4], '#b97a58', 13, 1.5);
  saguaro(ctx, 330, wallTop + 2, 46, '#7f6a3c');
  saguaro(ctx, 186, wallTop + 2, 30, '#8a7444');
  windmill(ctx, 262, wallTop + 2, 54, '#6a4a34');

  // ---- adobe wall (sandy render, dusty lower band)
  const wall = ctx.createLinearGradient(0, wallTop, 0, wallBase);
  wall.addColorStop(0, '#ecd2a2');
  wall.addColorStop(0.55, '#e4c38f');
  wall.addColorStop(0.82, '#d2a670');
  wall.addColorStop(1, '#a87648');
  ctx.fillStyle = wall;
  ctx.fillRect(0, wallTop, L.W, wallBase - wallTop + 4);
  for (let i = 0; i < 26; i++) {
    const x = (hn(i, 1) * 0.5 + 0.5) * L.W;
    const y = wallTop + 12 + (hn(i, 2) * 0.5 + 0.5) * (wallBase - wallTop - 30);
    ctx.globalAlpha = 0.2;
    blob(ctx, x, y, 14 + hn(i, 3) * 8, 8 + hn(i, 4) * 4, i % 2 ? '#f7e3bd' : '#c99a64', i, 0.12);
  }
  // patches where the render has fallen off, showing adobe bricks
  for (const [bx, by] of [[300, wallTop + 70], [40, wallBase - 70], [200, wallTop + 30]] as const) {
    ctx.globalAlpha = 1;
    blob(ctx, bx + 14, by + 8, 26, 15, '#c08b5c', bx, 0.2);
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++) {
        const ox = bx - 4 + c * 14 + (r % 2) * 7;
        const oy = by - 4 + r * 8;
        if (Math.hypot(ox + 6 - bx - 14, oy + 3 - by - 8) > 20) continue;
        poly(ctx, [ox, oy, ox + 12, oy, ox + 12, oy + 6, ox, oy + 6], r % 2 ? '#a96f45' : '#b57a4d', bx + r * 3 + c, 0.5);
      }
  }
  ctx.globalAlpha = 0.5;
  limb(ctx, [118, wallTop + 40, 126, wallTop + 70, 120, wallTop + 96], 0.8, '#8c6440');
  limb(ctx, [340, wallBase - 70, 330, wallBase - 50, 338, wallBase - 34], 0.8, '#8c6440');
  ctx.globalAlpha = 1;
  // the desert tree's long late-afternoon shadow on the wall
  ctx.globalAlpha = 0.13;
  for (let i = 0; i < 14; i++) blob(ctx, 60 + hn(i, 7) * 50 + i * 10, wallTop + 30 + (hn(i, 8) * 0.5 + 0.5) * 120, 15, 9, '#5a3820', 40 + i, 0.2);
  ctx.globalAlpha = 1;

  // weathered plank fence on top of the right half of the wall
  const fx0 = 226;
  paperShadow(ctx, px, 0.6);
  plank(ctx, fx0 - 4, wallTop - 30, L.W - fx0 + 14, 6, '#9d8466', 101);
  for (let x = fx0, i = 0; x < L.W + 10; x += 15, i++) {
    const h = 36 + hn(i, 1) * 5 + (i % 3 === 1 ? -6 : 0);
    plank(ctx, x, wallTop - h, 13, h, i % 2 ? '#a58c6c' : '#958063', 110 + i);
    poly(ctx, [x, wallTop - h, x + 6.5, wallTop - h - 5, x + 13, wallTop - h], i % 2 ? '#a58c6c' : '#958063', 140 + i, 0.4);
  }
  plank(ctx, fx0 - 4, wallTop - 14, L.W - fx0 + 14, 6, '#8e7559', 102);
  // coping along the top of the wall (the cats' running track)
  poly(ctx, [-6, wallTop - 4, 406, wallTop - 4, 406, wallTop + 8, -6, wallTop + 8], '#cfa877', 31, 0.8);
  noShadow(ctx);
  ctx.fillStyle = '#f2dcb2';
  ctx.fillRect(-6, wallTop - 4, 412, 2.5);

  // brass garden tap
  paperShadow(ctx, px, 0.6);
  poly(ctx, [248, wallBase - 64, 262, wallBase - 64, 262, wallBase - 54, 248, wallBase - 54], '#b8893a', 41);
  blob(ctx, 255, wallBase - 68, 7, 3, '#8a3a22', 42, 0.05);

  // ---- dusty ground (layered torn paper, far darker)
  noShadow(ctx);
  tornBand(ctx, wallBase - 2, H, '#9a5a34', 1, 1.5);
  tornBand(ctx, wallBase + 30, H, '#a6643a', 2, 2);
  tornBand(ctx, wallBase + 95, H, '#b06e42', 3, 2.5);
  tornBand(ctx, wallBase + 190, H, '#ba794a', 4, 3);
  tornBand(ctx, wallBase + 300, H, '#c28452', 5, 3);
  const ws = ctx.createLinearGradient(0, wallBase - 4, 0, wallBase + 24);
  ws.addColorStop(0, 'rgba(70,32,10,0.35)');
  ws.addColorStop(1, 'rgba(70,32,10,0)');
  ctx.fillStyle = ws;
  ctx.fillRect(0, wallBase - 4, L.W, 28);
  // cracked earth
  ctx.globalAlpha = 0.25;
  for (let i = 0; i < 18; i++) {
    const d = hn(i, 21) * 0.5 + 0.5;
    const { y, s } = groundAt(L, d * 1.2);
    const x = (hn(i, 22) * 0.5 + 0.5) * L.W;
    limb(ctx, [x, y, x + 9 * s, y + 2 * s, x + 14 * s, y - 1 * s], 0.8 * s, '#6e4224');
    limb(ctx, [x + 9 * s, y + 2 * s, x + 11 * s, y + 6 * s], 0.8 * s, '#6e4224');
  }
  ctx.globalAlpha = 1;
  // pebbles, dry grass tufts and dry leaves, bigger nearer
  for (let i = 0; i < 150; i++) {
    const d = (hn(i, 11) * 0.5 + 0.5) ** 0.8;
    const { y, s } = groundAt(L, d * 1.25);
    if (y > H - 4) continue;
    const x = (hn(i, 12) * 0.5 + 0.5) * L.W;
    if (i % 4 === 0) {
      blob(ctx, x, y, 2.4 * s, 1.6 * s, i % 8 ? '#e2cba4' : '#8a6a52', i, 0.15);
    } else if (i % 4 === 1) {
      ctx.globalAlpha = 0.85;
      for (let k = -2; k <= 2; k++) limb(ctx, [x, y, x + k * 2.2 * s, y - (6 + Math.abs(hn(i, k)) * 4) * s], 0.9 * s, k % 2 ? '#d9b45e' : '#b8913f');
      ctx.globalAlpha = 1;
    } else {
      const col = ['#c08a3e', '#9a6a2c', '#a98a4e', '#7f5230'][i % 4];
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(hn(i, 13) * 3);
      blob(ctx, 0, 0, 5 * s, 2.2 * s, col, i, 0.1);
      ctx.restore();
    }
  }
  // a lucky horseshoe in the dirt
  ctx.save();
  ctx.translate(300, groundAt(L, 0.62).y);
  ctx.rotate(0.3);
  ctx.beginPath();
  ctx.arc(0, 0, 7, Math.PI * 0.05, Math.PI * 0.95, true);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#6d6a66';
  ctx.stroke();
  ctx.restore();

  // ---- props along the wall base
  // weathered pallet planter with dusty sage, rusty low wire fencing
  paperShadow(ctx, px, 0.7);
  const pb = wallBase + 10;
  for (let i = 0; i < 6; i++) plank(ctx, 118 + i * 16, pb - 46, 14, 46, i % 2 ? '#a99377' : '#9a8468', 50 + i);
  plank(ctx, 114, pb - 34, 102, 6, '#7d6850', 57);
  plank(ctx, 114, pb - 14, 102, 6, '#7d6850', 58);
  for (let i = 0; i < 7; i++) {
    const x = 122 + i * 14;
    for (let k = 0; k < 4; k++) blob(ctx, x + hn(i, k) * 5, pb - 50 - k * 4, 7 - k, 5, k % 2 ? '#8a9a62' : '#a7b27a', i * 10 + k, 0.2);
  }
  noShadow(ctx);
  ctx.strokeStyle = '#8a5a34';
  ctx.lineWidth = 1;
  const fy = pb + 6;
  for (let x = 108; x <= 224; x += 7) {
    ctx.beginPath();
    ctx.moveTo(x, fy);
    ctx.lineTo(x, fy - 18);
    ctx.stroke();
  }
  for (let y = fy - 18; y <= fy; y += 6) {
    ctx.beginPath();
    ctx.moveTo(108, y);
    ctx.lineTo(224, y);
    ctx.stroke();
  }
  // green tin watering can
  paperShadow(ctx, px, 0.7);
  poly(ctx, [228, pb + 4, 250, pb + 4, 248, pb - 18, 230, pb - 18], '#5d8a4c', 60);
  limb(ctx, [248, pb - 6, 264, pb - 22], 3, '#5d8a4c');
  limb(ctx, [232, pb - 18, 239, pb - 30, 246, pb - 18], 2.2, '#3f6a36');

  // the turtles' sunken pond, edged with old trough planks
  noShadow(ctx);
  const py0 = wallBase + 4;
  const py1 = wallBase + 34;
  poly(ctx, [L.pondX0, py1, L.pondX1 + 12, py1, L.pondX1 + 8, py0, L.pondX0 + 10, py0], '#8c6c4c', 70, 0.5);
  poly(ctx, [L.pondX0 + 6, py1 - 4, L.pondX1 + 6, py1 - 4, L.pondX1 + 3, py0 + 4, L.pondX0 + 13, py0 + 4], '#4d5a40', 71, 0.5);
  ctx.globalAlpha = 0.4;
  blob(ctx, L.pondX0 + 40, py0 + 12, 14, 3, '#f4d9a0', 72, 0.1);
  blob(ctx, L.pondX0 + 74, py0 + 20, 10, 2, '#f4d9a0', 73, 0.1);
  ctx.globalAlpha = 1;
  paperShadow(ctx, px, 0.5);
  plank(ctx, L.pondX0 - 2, py1 - 3, L.pondX1 - L.pondX0 + 16, 6, '#7a5c40', 75);
  blob(ctx, L.pondX1 - 10, py0 + 9, 13, 5, '#a58f78', 74, 0.1);

  // teal hose lying across the dirt from the tap
  paperShadow(ctx, px, 0.6);
  limb(ctx, [256, wallBase - 54, 262, wallBase + 20, 210, wallBase + 70], 4, '#1f9aa6');
  limb(ctx, [210, wallBase + 70, 120, wallBase + 120, 180, wallBase + 200], 5, '#1f9aa6');
  limb(ctx, [180, wallBase + 200, 250, wallBase + 280, 300, H + 20], 7, '#1f9aa6');
  noShadow(ctx);
  ctx.globalAlpha = 0.5;
  limb(ctx, [210, wallBase + 69, 120, wallBase + 118, 180, wallBase + 198], 1.2, '#bff0f2');
  limb(ctx, [180, wallBase + 198, 250, wallBase + 278, 300, H + 18], 1.6, '#bff0f2');
  ctx.globalAlpha = 1;

  grain(ctx, L, 0.12);
  return { c: lay.c, x: lay.x, y: lay.y };
}

function grain(ctx: Ctx, L: Layout, alpha: number) {
  const g = makeGrain();
  const pat = ctx.createPattern(g, 'repeat');
  if (!pat) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, L.W, L.H);
  ctx.restore();
}

/** The corner desert tree (in front of the wall): gnarled trunk, crooked branch, sparse canopy, colander. */
export function renderTree(L: Layout, px: number): Sprite | null {
  const lay = layer(L, px, 0, 0, 280, L.treeBaseY + 24);
  if (!lay) return null;
  const { ctx } = lay;
  const { treeX, treeBaseY, branchY, branchEndX, wallTop } = L;
  paperShadow(ctx, px, 1.2);
  const bark = '#6a4e3a';
  const barkLite = '#94735a';
  // gnarled, leaning trunk
  poly(
    ctx,
    [treeX - 22, treeBaseY + 4, treeX - 10, branchY + 40, treeX - 20, branchY - 10, treeX - 8, wallTop - 10, treeX - 34, 20, treeX - 22, 14, treeX + 2, wallTop - 30, treeX + 18, 30, treeX + 28, 34, treeX + 12, wallTop + 4, treeX + 16, branchY - 4, treeX + 6, branchY + 50, treeX + 24, treeBaseY + 4],
    bark,
    1,
    1,
  );
  noShadow(ctx);
  limb(ctx, [treeX - 8, treeBaseY - 10, treeX - 2, branchY + 30, treeX - 10, branchY - 8, treeX - 4, wallTop], 2.5, barkLite);
  limb(ctx, [treeX + 10, treeBaseY - 30, treeX + 4, branchY + 46], 1.4, '#4a3324');
  limb(ctx, [treeX - 14, treeBaseY - 50, treeX - 8, treeBaseY - 80], 1.2, '#4a3324');
  blob(ctx, treeX + 2, branchY + 70, 4, 6, '#4a3324', 9, 0.2);
  // roots
  paperShadow(ctx, px, 0.8);
  poly(ctx, [treeX - 22, treeBaseY + 4, treeX - 44, treeBaseY + 12, treeX - 10, treeBaseY - 4], bark, 2);
  poly(ctx, [treeX + 24, treeBaseY + 4, treeX + 44, treeBaseY + 10, treeX + 12, treeBaseY - 4], bark, 3);
  // crooked branch the cats walk along
  poly(ctx, [treeX + 8, branchY - 6, treeX + 70, branchY - 9, branchEndX - 20, branchY - 3, branchEndX + 8, branchY - 12, branchEndX - 14, branchY + 3, treeX + 70, branchY + 2, treeX + 10, branchY + 8], bark, 4, 0.8);
  limb(ctx, [branchEndX - 50, branchY - 4, branchEndX - 40, branchY - 18, branchEndX - 28, branchY - 30], 3, bark);
  limb(ctx, [treeX + 60, branchY - 6, treeX + 70, branchY - 24], 2.2, bark);
  noShadow(ctx);
  limb(ctx, [treeX + 14, branchY - 3, branchEndX - 30, branchY - 2], 1.2, barkLite);
  // colander hanging on a string, catching the sun
  const cx = L.colanderX;
  const cy = branchY + 30;
  limb(ctx, [cx, branchY + 2, cx - 2, cy - 12], 1, '#3a2a1e');
  paperShadow(ctx, px, 0.9);
  ctx.beginPath();
  ctx.moveTo(cx - 16, cy - 9);
  ctx.quadraticCurveTo(cx, cy + 18, cx + 16, cy - 9);
  ctx.closePath();
  const steel = ctx.createLinearGradient(cx - 16, 0, cx + 16, 0);
  steel.addColorStop(0, '#a89a86');
  steel.addColorStop(0.45, '#fff2d2');
  steel.addColorStop(1, '#9a8a74');
  ctx.fillStyle = steel;
  ctx.fill();
  blob(ctx, cx, cy - 9, 17, 3, '#e0d0b0', 5, 0.03);
  noShadow(ctx);
  for (let i = 0; i < 7; i++) blob(ctx, cx - 9 + i * 3, cy - 1 + Math.abs(i - 3) * -1.2, 0.9, 0.9, '#6d5e4c', i, 0);
  limb(ctx, [cx - 16, cy - 9, cx - 21, cy - 11], 2, '#9a8a74');
  // sparse, dusty desert canopy
  const greens = ['#5f6a38', '#717c42', '#87904e', '#9ea25e'];
  paperShadow(ctx, px, 1);
  const clumps: [number, number, number][] = [
    [-10, 30, 30], [30, 20, 28], [72, 34, 30], [114, 26, 26], [154, 42, 24], [194, 52, 20],
    [8, 64, 24], [52, 70, 26], [98, 64, 22], [138, 76, 20], [-14, 88, 20], [226, 66, 16], [178, 80, 16],
  ];
  for (let layerI = 0; layerI < 3; layerI++) {
    clumps.forEach(([x, y, r], i) => {
      if ((i + layerI) % 3 === 2 && layerI > 0) return;
      blob(ctx, x + layerI * 6, y + layerI * 6, r - layerI * 4, (r - layerI * 4) * 0.62, greens[layerI + (i % 2)], i * 7 + layerI, 0.16);
    });
  }
  noShadow(ctx);
  ctx.globalAlpha = 0.55;
  for (let i = 0; i < 18; i++) blob(ctx, hn(i, 5) * 110 + 100, hn(i, 6) * 30 + 60, 4, 2.2, '#c4c27c', i, 0.15, hn(i, 7));
  ctx.globalAlpha = 1;
  paperShadow(ctx, px, 0.8);
  blob(ctx, branchEndX - 28, branchY - 34, 12, 7, '#87904e', 90, 0.15);
  blob(ctx, branchEndX - 16, branchY - 40, 9, 6, '#9ea25e', 91, 0.15);
  noShadow(ctx);
  grain(ctx, L, 0.07);
  return { c: lay.c, x: lay.x, y: lay.y };
}

/** Foreground: the weathered cable-spool table in the near-left corner with a potted cactus. */
export function renderForeground(L: Layout, px: number): Sprite | null {
  const lay = layer(L, px, 0, L.groundNear - 20, 110, L.H - L.groundNear + 20);
  if (!lay) return null;
  const { ctx } = lay;
  const y = L.groundNear + 18;
  paperShadow(ctx, px, 1.4);
  plank(ctx, -20, y + 34, 56, 76, '#8f6c4a', 1);
  blob(ctx, 8, y + 112, 62, 14, '#6e5136', 2, 0.03);
  blob(ctx, 8, y + 30, 70, 17, '#b8946a', 3, 0.03);
  noShadow(ctx);
  ctx.globalAlpha = 0.4;
  for (let i = 0; i < 5; i++) limb(ctx, [-50 + i * 24, y + 20 + i * 1.5, -40 + i * 24, y + 42 - i * 1.5], 1, '#5e3f24');
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ellipsePath(ctx, 8, y + 30, 70, 17, 3, 0.03);
  ctx.strokeStyle = mix('#b8946a', '#4a2f18', 0.45);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // potted barrel cactus
  paperShadow(ctx, px, 1);
  poly(ctx, [10, y + 26, 34, y + 26, 30, y + 6, 14, y + 6], '#b8603a', 4);
  blob(ctx, 22, y - 2, 11, 12, '#6f8a48', 5, 0.06);
  noShadow(ctx);
  for (let i = -2; i <= 2; i++) limb(ctx, [22 + i * 4, y - 12, 22 + i * 4.6, y + 6], 0.8, '#4f6a34');
  blob(ctx, 22, y - 14, 4, 2.5, '#e86a8a', 6, 0.1);
  grain(ctx, L, 0.07);
  return { c: lay.c, x: lay.x, y: lay.y };
}
