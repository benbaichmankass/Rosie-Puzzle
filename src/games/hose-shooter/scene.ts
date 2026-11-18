/** The yard's back wall, drawn as layered construction paper. Pre-rendered once per resize. */
import { groundAt, type Layout } from './logic';
import { blob, ellipsePath, hn, limb, makeGrain, mix, noShadow, paperShadow, poly, type Ctx } from './paper';

function layer(L: Layout, px: number): { c: HTMLCanvasElement; ctx: Ctx } | null {
  const c = document.createElement('canvas');
  c.width = Math.ceil(L.W * px);
  c.height = Math.ceil(L.H * px);
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.scale(px, px);
  return { c, ctx };
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

function palm(ctx: Ctx, x: number, base: number, h: number, seed: number) {
  limb(ctx, [x, base, x + h * 0.08, base - h * 0.5, x + h * 0.04, base - h], 6, '#8b6a45');
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.5;
    const len = h * (0.42 + 0.08 * hn(seed, i));
    const ex = x + h * 0.04 + Math.cos(a) * len;
    const ey = base - h + Math.sin(a) * len * 0.6 + len * 0.25;
    limb(ctx, [x + h * 0.04, base - h, (x + ex) / 2, base - h - len * 0.25, ex, ey], 5, i % 2 ? '#3f8a4a' : '#4f9e52');
  }
}

export function renderBackground(L: Layout, px: number): HTMLCanvasElement | null {
  const lay = layer(L, px);
  if (!lay) return null;
  const { ctx } = lay;
  const { H, wallTop, wallBase } = L;

  // ---- sky
  const sky = ctx.createLinearGradient(0, 0, 0, wallTop);
  sky.addColorStop(0, '#6cc4ea');
  sky.addColorStop(1, '#c4ecf6');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, L.W, wallTop + 4);
  paperShadow(ctx, px, 0.6);
  blob(ctx, 330, 48, 26, 26, '#ffd85a', 3, 0.03);
  for (const [cx, cy, s] of [[90, 60, 1], [250, 92, 0.75], [360, 120, 0.6]] as const) {
    blob(ctx, cx, cy, 34 * s, 13 * s, '#fbfdff', cx, 0.06);
    blob(ctx, cx - 16 * s, cy - 8 * s, 16 * s, 12 * s, '#fbfdff', cx + 1, 0.06);
    blob(ctx, cx + 10 * s, cy - 11 * s, 18 * s, 14 * s, '#fbfdff', cx + 2, 0.06);
  }
  // distant roof with a solar water heater, palms peeking over the wall
  poly(ctx, [236, wallTop + 2, 236, wallTop - 34, 312, wallTop - 34, 312, wallTop + 2], '#e9d3b4', 21);
  poly(ctx, [232, wallTop - 34, 316, wallTop - 34, 316, wallTop - 40, 232, wallTop - 40], '#c9b392', 22);
  poly(ctx, [252, wallTop - 40, 262, wallTop - 58, 288, wallTop - 58, 278, wallTop - 40], '#3d5a8a', 23);
  blob(ctx, 293, wallTop - 52, 13, 6, '#f4f4f0', 24, 0.03);
  for (let i = 0; i < 3; i++) poly(ctx, [244 + i * 22, wallTop - 26, 256 + i * 22, wallTop - 26, 256 + i * 22, wallTop - 14, 244 + i * 22, wallTop - 14], '#7aa7c4', 25 + i);
  palm(ctx, 205, wallTop + 4, 92, 1);
  palm(ctx, 372, wallTop + 4, 120, 2);

  // ---- back wall (cream render, dirty lower band)
  noShadow(ctx);
  const wall = ctx.createLinearGradient(0, wallTop, 0, wallBase);
  wall.addColorStop(0, '#efe4cb');
  wall.addColorStop(0.55, '#e8dbbd');
  wall.addColorStop(0.82, '#d6c09a');
  wall.addColorStop(1, '#a98a66');
  ctx.fillStyle = wall;
  ctx.fillRect(0, wallTop, L.W, wallBase - wallTop + 4);
  // render blotches and hairline cracks
  for (let i = 0; i < 26; i++) {
    const x = (hn(i, 1) * 0.5 + 0.5) * L.W;
    const y = wallTop + 12 + (hn(i, 2) * 0.5 + 0.5) * (wallBase - wallTop - 30);
    ctx.globalAlpha = 0.18;
    blob(ctx, x, y, 14 + hn(i, 3) * 8, 8 + hn(i, 4) * 4, i % 2 ? '#fff6e2' : '#d9c8a6', i, 0.12);
  }
  ctx.globalAlpha = 0.45;
  limb(ctx, [118, wallTop + 40, 126, wallTop + 70, 120, wallTop + 96], 0.8, '#9c876a');
  limb(ctx, [340, wallBase - 70, 330, wallBase - 50, 338, wallBase - 34], 0.8, '#9c876a');
  ctx.globalAlpha = 1;
  // the tree's dappled shadow on the wall
  ctx.globalAlpha = 0.12;
  for (let i = 0; i < 14; i++) blob(ctx, 40 + hn(i, 7) * 60 + i * 9, wallTop + 30 + (hn(i, 8) * 0.5 + 0.5) * 120, 16, 10, '#5a4a30', 40 + i, 0.2);
  ctx.globalAlpha = 1;

  // wire mesh fence on top of the right half of the wall
  const fx0 = 228;
  const fTop = wallTop - 38;
  ctx.strokeStyle = '#3c7a46';
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.9;
  for (let x = fx0; x <= L.W + 10; x += 9) {
    ctx.beginPath();
    ctx.moveTo(x, fTop);
    ctx.lineTo(x, wallTop);
    ctx.stroke();
  }
  for (let y = fTop; y <= wallTop; y += 9) {
    ctx.beginPath();
    ctx.moveTo(fx0, y);
    ctx.lineTo(L.W + 10, y + hn(y, 3) * 0.6);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  paperShadow(ctx, px, 0.5);
  for (let x = fx0; x <= L.W + 10; x += 58) poly(ctx, [x - 2, fTop - 4, x + 2, fTop - 4, x + 2, wallTop, x - 2, wallTop], '#2f5f37', x);
  // coping along the top of the wall (the cats' running track)
  poly(ctx, [-6, wallTop - 4, 406, wallTop - 4, 406, wallTop + 8, -6, wallTop + 8], '#d9caa8', 31, 0.8);
  noShadow(ctx);
  ctx.fillStyle = '#f4ead4';
  ctx.fillRect(-6, wallTop - 4, 412, 2.5);

  // garden tap on the wall
  paperShadow(ctx, px, 0.6);
  poly(ctx, [248, wallBase - 64, 262, wallBase - 64, 262, wallBase - 54, 248, wallBase - 54], '#9aa1a6', 41);
  blob(ctx, 255, wallBase - 68, 7, 3, '#c0392b', 42, 0.05);

  // ---- ground (layered torn paper, far darker)
  noShadow(ctx);
  tornBand(ctx, wallBase - 2, H, '#7c5a40', 1, 1.5);
  tornBand(ctx, wallBase + 30, H, '#86603f', 2, 2);
  tornBand(ctx, wallBase + 95, H, '#916843', 3, 2.5);
  tornBand(ctx, wallBase + 190, H, '#9b7048', 4, 3);
  tornBand(ctx, wallBase + 300, H, '#a5784e', 5, 3);
  // wall-base dirt shadow
  const ws = ctx.createLinearGradient(0, wallBase - 4, 0, wallBase + 24);
  ws.addColorStop(0, 'rgba(40,24,10,0.35)');
  ws.addColorStop(1, 'rgba(40,24,10,0)');
  ctx.fillStyle = ws;
  ctx.fillRect(0, wallBase - 4, L.W, 28);

  // gravel and dry leaves, bigger nearer
  for (let i = 0; i < 160; i++) {
    const d = (hn(i, 11) * 0.5 + 0.5) ** 0.8;
    const { y, s } = groundAt(L, d * 1.25);
    if (y > H - 4) continue;
    const x = (hn(i, 12) * 0.5 + 0.5) * L.W;
    if (i % 3 === 0) {
      blob(ctx, x, y, 2.2 * s, 1.5 * s, i % 2 ? '#b9ad9c' : '#6e6258', i, 0.15);
    } else {
      const col = ['#c08a3e', '#8f6a2c', '#a9a24e', '#6f4a2a', '#d0a35a'][i % 5];
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(hn(i, 13) * 3);
      blob(ctx, 0, 0, 5.5 * s, 2.4 * s, col, i, 0.1);
      ctx.globalAlpha = 0.4;
      limb(ctx, [-5 * s, 0, 5 * s, 0], 0.6, '#3a2a14');
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }

  // ---- props along the wall base
  // pallet planter with herbs and low green wire fencing
  paperShadow(ctx, px, 0.7);
  const pb = wallBase + 10;
  for (let i = 0; i < 6; i++) poly(ctx, [118 + i * 16, pb, 132 + i * 16, pb, 132 + i * 16, pb - 46, 118 + i * 16, pb - 46], i % 2 ? '#b89a72' : '#a88a63', 50 + i, 0.8);
  poly(ctx, [114, pb - 34, 216, pb - 34, 216, pb - 28, 114, pb - 28], '#8d7150', 57);
  poly(ctx, [114, pb - 14, 216, pb - 14, 216, pb - 8, 114, pb - 8], '#8d7150', 58);
  for (let i = 0; i < 7; i++) {
    const x = 122 + i * 14;
    for (let k = 0; k < 4; k++) blob(ctx, x + hn(i, k) * 5, pb - 50 - k * 4, 7 - k, 5, k % 2 ? '#5a9a4a' : '#7ab35a', i * 10 + k, 0.2);
  }
  noShadow(ctx);
  ctx.strokeStyle = '#2f7a3e';
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
  // watering can
  paperShadow(ctx, px, 0.7);
  poly(ctx, [228, pb + 4, 250, pb + 4, 248, pb - 18, 230, pb - 18], '#3f9a4c', 60);
  limb(ctx, [248, pb - 6, 264, pb - 22], 3, '#3f9a4c');
  limb(ctx, [232, pb - 18, 239, pb - 30, 246, pb - 18], 2.2, '#2f7a3e');

  // sunken turtle pond in the right corner
  noShadow(ctx);
  const py0 = wallBase + 4;
  const py1 = wallBase + 34;
  poly(ctx, [L.pondX0, py1, L.pondX1 + 12, py1, L.pondX1 + 8, py0, L.pondX0 + 10, py0], '#c7cdd0', 70, 0.5);
  poly(ctx, [L.pondX0 + 6, py1 - 3, L.pondX1 + 6, py1 - 3, L.pondX1 + 3, py0 + 3, L.pondX0 + 13, py0 + 3], '#41543f', 71, 0.5);
  ctx.globalAlpha = 0.35;
  blob(ctx, L.pondX0 + 40, py0 + 12, 14, 3, '#cfe8e0', 72, 0.1);
  blob(ctx, L.pondX0 + 74, py0 + 20, 10, 2, '#cfe8e0', 73, 0.1);
  ctx.globalAlpha = 1;
  paperShadow(ctx, px, 0.5);
  blob(ctx, L.pondX1 - 10, py0 + 9, 13, 5, '#9a958a', 74, 0.1);

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

  grain(ctx, L, 0.09);
  return lay.c;
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

/** The corner tree (in front of the wall): trunk, branch, canopy and the hanging colander. */
export function renderTree(L: Layout, px: number): HTMLCanvasElement | null {
  const lay = layer(L, px);
  if (!lay) return null;
  const { ctx } = lay;
  const { treeX, treeBaseY, branchY, branchEndX, wallTop } = L;
  paperShadow(ctx, px, 1.2);
  const bark = '#6b4a2e';
  const barkLite = '#8a6440';
  // trunk
  poly(
    ctx,
    [treeX - 20, treeBaseY + 4, treeX - 13, branchY + 30, treeX - 16, wallTop - 30, treeX - 30, -10, treeX + 2, -10, treeX + 14, wallTop - 20, treeX + 13, branchY, treeX + 22, treeBaseY + 4],
    bark,
    1,
    1,
  );
  noShadow(ctx);
  limb(ctx, [treeX - 6, treeBaseY - 10, treeX - 2, branchY + 20, treeX - 8, wallTop - 20], 3, barkLite);
  limb(ctx, [treeX + 8, treeBaseY - 30, treeX + 6, branchY + 40], 1.5, '#4f351f');
  // roots
  paperShadow(ctx, px, 0.8);
  poly(ctx, [treeX - 20, treeBaseY + 4, treeX - 38, treeBaseY + 12, treeX - 10, treeBaseY - 2], bark, 2);
  poly(ctx, [treeX + 22, treeBaseY + 4, treeX + 40, treeBaseY + 10, treeX + 12, treeBaseY - 2], bark, 3);
  // branch the cats walk along
  poly(ctx, [treeX + 8, branchY - 6, branchEndX - 20, branchY - 3, branchEndX + 6, branchY - 9, branchEndX - 16, branchY + 3, treeX + 10, branchY + 8], bark, 4, 0.8);
  limb(ctx, [branchEndX - 50, branchY - 4, branchEndX - 34, branchY - 26], 3, bark);
  noShadow(ctx);
  limb(ctx, [treeX + 14, branchY - 3, branchEndX - 30, branchY - 2], 1.2, barkLite);
  // colander hanging on a string
  const cx = L.colanderX;
  const cy = branchY + 30;
  limb(ctx, [cx, branchY + 2, cx - 2, cy - 12], 1, '#3a3a3a');
  paperShadow(ctx, px, 0.9);
  ctx.beginPath();
  ctx.moveTo(cx - 16, cy - 9);
  ctx.quadraticCurveTo(cx, cy + 18, cx + 16, cy - 9);
  ctx.closePath();
  const steel = ctx.createLinearGradient(cx - 16, 0, cx + 16, 0);
  steel.addColorStop(0, '#9aa3aa');
  steel.addColorStop(0.45, '#e4e9ec');
  steel.addColorStop(1, '#8a939a');
  ctx.fillStyle = steel;
  ctx.fill();
  blob(ctx, cx, cy - 9, 17, 3, '#c8d0d5', 5, 0.03);
  noShadow(ctx);
  for (let i = 0; i < 7; i++) blob(ctx, cx - 9 + i * 3, cy - 1 + Math.abs(i - 3) * -1.2, 0.9, 0.9, '#5d666c', i, 0);
  limb(ctx, [cx - 16, cy - 9, cx - 21, cy - 11], 2, '#8a939a');
  // canopy: overlapping leaf blobs, darker at the back
  const greens = ['#2f6b34', '#3b7e3c', '#4b9145', '#5ea54f'];
  paperShadow(ctx, px, 1);
  for (let layerI = 0; layerI < 4; layerI++) {
    for (let i = 0; i < 9; i++) {
      const k = layerI * 9 + i;
      const x = -20 + i * 26 + hn(k, 1) * 12 + layerI * 6;
      if (x > 240 - layerI * 18) continue;
      const y = 8 + layerI * 22 + hn(k, 2) * 14 + Math.max(0, x - 120) * 0.25;
      blob(ctx, x, y, 30 - layerI * 3, 22 - layerI * 2, greens[layerI], k, 0.1);
    }
  }
  noShadow(ctx);
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 18; i++) {
    const x = hn(i, 5) * 100 + 100;
    const y = hn(i, 6) * 30 + 50;
    blob(ctx, x, y, 5, 3, '#8cc46a', i, 0.15, hn(i, 7));
  }
  ctx.globalAlpha = 1;
  // a couple of leaf clumps on the branch tip
  paperShadow(ctx, px, 0.8);
  blob(ctx, branchEndX - 34, branchY - 30, 14, 10, '#4b9145', 90, 0.12);
  blob(ctx, branchEndX - 22, branchY - 36, 11, 8, '#5ea54f', 91, 0.12);
  noShadow(ctx);
  grain(ctx, L, 0.06);
  return lay.c;
}

/** Foreground: the cable-spool table in the near-left corner. */
export function renderForeground(L: Layout, px: number): HTMLCanvasElement | null {
  const lay = layer(L, px);
  if (!lay) return null;
  const { ctx } = lay;
  const y = L.groundNear + 18;
  paperShadow(ctx, px, 1.4);
  // spool: drum and top disc, cut off by the screen edge
  poly(ctx, [-20, y + 34, 36, y + 34, 36, y + 110, -20, y + 110], '#9a7650', 1, 1);
  blob(ctx, 8, y + 112, 62, 14, '#7d5d3c', 2, 0.03);
  blob(ctx, 8, y + 30, 70, 17, '#c9a273', 3, 0.03);
  noShadow(ctx);
  ctx.globalAlpha = 0.35;
  for (let i = 0; i < 5; i++) limb(ctx, [-50 + i * 24, y + 20 + i * 1.5, -40 + i * 24, y + 42 - i * 1.5], 1, '#6b4a2a');
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ellipsePath(ctx, 8, y + 30, 70, 17, 3, 0.03);
  ctx.strokeStyle = mix('#c9a273', '#5a3d22', 0.4);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // a potted herb on the spool
  paperShadow(ctx, px, 1);
  poly(ctx, [10, y + 26, 34, y + 26, 30, y + 6, 14, y + 6], '#c4673a', 4);
  for (let i = 0; i < 6; i++) blob(ctx, 14 + i * 3.4, y + 2 - (i % 2) * 6, 6, 4, i % 2 ? '#5a9a4a' : '#7ab35a', 10 + i, 0.2, (i - 3) * 0.3);
  noShadow(ctx);
  grain(ctx, L, 0.06);
  return lay.c;
}
