/** Cut-paper actors: cats, the chicken, the three bunnies and the two turtles. */
import type { Ent, Layout } from './logic';
import { blob, ellipsePath, eyes, limb, mix, noShadow, paperShadow, poly, FONT, type Ctx } from './paper';
import { CHARACTERS } from '../../shared/characters';

interface CatColors {
  body: string;
  dark: string;
  belly: string;
  patch?: string;
  stripes?: boolean;
}

const CATS: CatColors[] = [
  { body: '#ee8a2c', dark: '#bf5e16', belly: '#f8c891', stripes: true },
  { body: '#2d2b31', dark: '#151418', belly: '#4b4852' },
  { body: '#8f939b', dark: '#666a72', belly: '#d3d5d9', stripes: true },
  { body: '#f6efe1', dark: '#e1882d', belly: '#fffaf0', patch: '#2b2727' },
  { body: '#f2e2c4', dark: '#d79b55', belly: '#fff6e6' },
];

const WET = '#5d7f9e';

function wetten(c: string, k: number) {
  return k > 0 ? mix(c, WET, 0.35 * k) : c;
}

/** Blue drips falling off a soaked actor. */
function drips(ctx: Ctx, w: number, h: number, t: number, seed: number) {
  for (let i = 0; i < 5; i++) {
    const ph = (t * 1.6 + i * 0.23 + seed) % 1;
    const x = (i / 4 - 0.5) * w;
    const y = -h * 0.6 + ph * h * 0.75;
    ctx.globalAlpha = 1 - ph;
    blob(ctx, x, y, 2.2, 3.2, '#7ec8f2', i + seed, 0.05);
  }
  ctx.globalAlpha = 1;
}

/** Spiky speech bubble with a shout. Drawn unscaled-ish so it stays readable. */
export function shout(ctx: Ctx, x: number, y: number, text: string, t: number, px: number) {
  const pop = Math.min(1, t / 0.12);
  const size = 15 * (0.7 + 0.3 * pop);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.08);
  ctx.font = `${size}px ${FONT}`;
  const w = Math.max(34, ctx.measureText(text).width + 18);
  const h = size + 14;
  paperShadow(ctx, px, 0.8);
  ctx.beginPath();
  const n = 16;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = i % 2 === 0 ? 1.18 : 0.95;
    const xx = Math.cos(a) * (w / 2) * k;
    const yy = Math.sin(a) * (h / 2) * k;
    if (i === 0) ctx.moveTo(xx, yy);
    else ctx.lineTo(xx, yy);
  }
  ctx.closePath();
  ctx.fillStyle = '#fffdf4';
  ctx.fill();
  noShadow(ctx);
  ctx.fillStyle = '#1b1b1b';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 2);
  ctx.restore();
}

function groundShadow(ctx: Ctx, e: Ent, rx: number) {
  if (e.zone !== 'ground') return;
  const k = Math.max(0.4, 1 - e.lift / (60 * e.s));
  ctx.globalAlpha = 0.25 * k;
  blob(ctx, e.x, e.y, rx * e.s * k, rx * 0.22 * e.s * k, '#2a1608', 7, 0.02);
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------------ cat

function catSide(ctx: Ctx, c: CatColors, frame: number, seed: number, wet: number, stretch = false) {
  const body = wetten(c.body, wet);
  const dark = wetten(c.dark, wet);
  const belly = wetten(c.belly, wet);
  const legSwing = stretch ? 10 : frame === 0 ? 6 : -6;
  const slim = wet > 0 ? 0.82 : 1;
  // tail
  if (wet > 0) limb(ctx, [-26, -26, -44, -24, -54, -14], 6, dark);
  else limb(ctx, [-26, -30, -48, -38, -46, -60 + frame * 3], 7, dark);
  // far legs
  limb(ctx, [-16, -18, -16 - legSwing, -1], 8, dark);
  limb(ctx, [16, -18, 16 + legSwing, -1], 8, dark);
  // body
  blob(ctx, 0, -26, 31, 16 * slim, body, seed, 0.04);
  if (c.patch) {
    blob(ctx, -12, -32, 11, 8, c.patch, seed + 5, 0.08);
    blob(ctx, 10, -22, 9, 7, c.dark, seed + 6, 0.08);
  }
  blob(ctx, 4, -18, 20, 7 * slim, belly, seed + 9, 0.06);
  if (c.stripes) {
    for (let i = 0; i < 3; i++) poly(ctx, [-14 + i * 10, -41, -8 + i * 10, -41, -11 + i * 10, -29], dark, seed + i, 0.6);
  }
  // near legs
  limb(ctx, [-12, -16, -12 + legSwing, 0], 9, body);
  limb(ctx, [20, -16, 20 - legSwing, 0], 9, body);
  // head
  const hx = 28;
  const hy = -42;
  poly(ctx, [hx - 13, hy - 8, hx - 9, hy - 27, hx - 1, hy - 12], body, seed + 11);
  poly(ctx, [hx + 2, hy - 13, hx + 11, hy - 27, hx + 14, hy - 6], body, seed + 12);
  poly(ctx, [hx - 10, hy - 11, hx - 8, hy - 21, hx - 4, hy - 13], '#f3a7b3', seed + 13);
  blob(ctx, hx, hy, 17, 15 * (wet > 0 ? 0.92 : 1), body, seed + 14, 0.04);
  if (c.patch) blob(ctx, hx - 7, hy - 6, 8, 7, c.patch, seed + 15, 0.1);
  blob(ctx, hx + 8, hy + 6, 9, 6, belly, seed + 16, 0.06);
  if (wet > 0) {
    eyes(ctx, hx + 5, hy - 3, 6, seed + 20, 0.2, -0.2, '#111', 0.18);
    // angry brows
    limb(ctx, [hx - 3, hy - 12, hx + 4, hy - 9], 2.2, '#111');
    limb(ctx, [hx + 7, hy - 9, hx + 14, hy - 12], 2.2, '#111');
    blob(ctx, hx + 9, hy + 8, 5, 4, '#7a1f2a', seed + 21, 0.1);
    poly(ctx, [hx + 5, hy + 5, hx + 7, hy + 8, hx + 9, hy + 5], '#fff', seed + 22, 0.2);
  } else {
    eyes(ctx, hx + 5, hy - 3, 5.5, seed + 20, 0.55, 0.1);
    poly(ctx, [hx + 13, hy + 3, hx + 17, hy + 3, hx + 15, hy + 6], '#e77b8f', seed + 23, 0.2);
  }
  ctx.globalAlpha = 0.7;
  limb(ctx, [hx + 12, hy + 6, hx + 26, hy + 3], 1, '#222');
  limb(ctx, [hx + 12, hy + 8, hx + 25, hy + 10], 1, '#222');
  ctx.globalAlpha = 1;
}

function catSit(ctx: Ctx, c: CatColors, t: number, seed: number) {
  const tailWave = Math.sin(t * 3) * 6;
  limb(ctx, [12, -6, 30, -6 + tailWave * 0.2, 30, -26 + tailWave], 7, c.dark);
  blob(ctx, 0, -24, 19, 23, c.body, seed, 0.04);
  if (c.patch) blob(ctx, 8, -30, 9, 10, c.patch, seed + 5, 0.08);
  blob(ctx, 0, -18, 11, 15, c.belly, seed + 9, 0.06);
  limb(ctx, [-6, -10, -6, -1], 7, c.body);
  limb(ctx, [6, -10, 6, -1], 7, c.body);
  const hy = -52;
  poly(ctx, [-15, hy - 2, -12, hy - 24, -2, hy - 10], c.body, seed + 11);
  poly(ctx, [2, hy - 10, 12, hy - 24, 15, hy - 2], c.body, seed + 12);
  poly(ctx, [-12, hy - 6, -11, hy - 18, -5, hy - 10], '#f3a7b3', seed + 13);
  poly(ctx, [5, hy - 10, 11, hy - 18, 12, hy - 6], '#f3a7b3', seed + 17);
  blob(ctx, 0, hy, 18, 15, c.body, seed + 14, 0.04);
  if (c.patch) blob(ctx, -8, hy - 5, 8, 7, c.patch, seed + 15, 0.1);
  if (c.stripes) {
    poly(ctx, [-4, hy - 15, 4, hy - 15, 0, hy - 7], c.dark, seed + 18, 0.4);
  }
  blob(ctx, 0, hy + 6, 9, 6, c.belly, seed + 16, 0.06);
  const blink = (t * 0.7 + seed) % 3 < 0.12;
  if (blink) {
    limb(ctx, [-9, hy - 3, -2, hy - 3], 2, '#111');
    limb(ctx, [2, hy - 3, 9, hy - 3], 2, '#111');
  } else eyes(ctx, 0, hy - 3, 5.5, seed + 20, 0, 0.2);
  poly(ctx, [-2, hy + 3, 2, hy + 3, 0, hy + 6], '#e77b8f', seed + 23, 0.2);
  ctx.globalAlpha = 0.7;
  limb(ctx, [-5, hy + 6, -20, hy + 3], 1, '#222');
  limb(ctx, [5, hy + 6, 20, hy + 3], 1, '#222');
  ctx.globalAlpha = 1;
}

/** Soaked: stiff, fur flattened, wide-eyed and furious. */
function catSoaked(ctx: Ctx, c: CatColors, t: number, seed: number) {
  const body = wetten(c.body, 1);
  const dark = wetten(c.dark, 1);
  const shake = Math.sin(t * 60) * 1.5;
  ctx.translate(shake, 0);
  limb(ctx, [10, -8, 22, -14, 20, -2], 5, dark);
  blob(ctx, 0, -24, 15, 22, body, seed, 0.07);
  // flattened wet fur clumps
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i - 2.5) * 0.45;
    poly(ctx, [Math.cos(a) * 12, -24 + Math.sin(a) * 18, Math.cos(a) * 19, -24 + Math.sin(a) * 25 + 6, Math.cos(a + 0.2) * 12, -24 + Math.sin(a + 0.2) * 18], body, seed + i, 0.5);
  }
  limb(ctx, [-5, -10, -6, -1], 6, body);
  limb(ctx, [5, -10, 6, -1], 6, body);
  const hy = -50;
  poly(ctx, [-15, hy + 2, -17, hy - 14, -5, hy - 9], body, seed + 11);
  poly(ctx, [5, hy - 9, 17, hy - 14, 15, hy + 2], body, seed + 12);
  blob(ctx, 0, hy, 16, 14, body, seed + 14, 0.06);
  eyes(ctx, 0, hy - 3, 6.5, seed + 20, 0, 0, '#111', 0.16);
  limb(ctx, [-12, hy - 13, -3, hy - 9], 2.4, '#111');
  limb(ctx, [3, hy - 9, 12, hy - 13], 2.4, '#111');
  blob(ctx, 0, hy + 8, 6, 4.5, '#7a1f2a', seed + 21, 0.1);
  poly(ctx, [-4, hy + 5, -2, hy + 8, 0, hy + 5, 2, hy + 8, 4, hy + 5], '#fff', seed + 22, 0.2);
  drips(ctx, 34, 60, t, seed);
}

export function drawCat(ctx: Ctx, e: Ent, t: number, px: number) {
  const c = CATS[e.variant % CATS.length];
  const boil = Math.floor(t * 8);
  const seed = e.id * 7 + (boil % 3) * 0.37;
  groundShadow(ctx, e, 34);
  ctx.save();
  ctx.translate(e.x, e.y - e.lift);
  ctx.scale(e.s, e.s);
  paperShadow(ctx, px, e.s);
  const wet = e.state === 'flee' ? 1 : 0;
  if (e.state === 'soaked') {
    catSoaked(ctx, c, e.stateT, seed);
  } else if (e.pose === 'sit') {
    catSit(ctx, c, t + e.id, seed);
  } else if (e.pose === 'climb' || e.pose === 'down') {
    ctx.translate(0, -26);
    ctx.rotate(e.pose === 'climb' ? -Math.PI / 2 : Math.PI / 2);
    ctx.translate(0, 26);
    if (e.pose === 'down') ctx.scale(1, -1);
    catSide(ctx, c, Math.floor(e.dist / 12) % 2, seed, wet);
  } else {
    if (e.dir < 0) ctx.scale(-1, 1);
    if (e.pose === 'jump') ctx.rotate(e.lift > 0 ? -0.15 : 0);
    catSide(ctx, c, Math.floor(e.dist / 14) % 2, seed, wet, e.pose === 'jump');
    if (wet) drips(ctx, 50, 50, e.stateT, seed);
  }
  noShadow(ctx);
  ctx.restore();
  if (e.state === 'soaked' || (e.state === 'flee' && e.stateT < 0.35)) {
    const age = e.state === 'soaked' ? e.stateT : 1;
    shout(ctx, e.x + 22, e.y - e.lift - 78 * e.s - 6, e.shout, age, px);
  }
}

// ------------------------------------------------------------------ chicken

export function drawChicken(ctx: Ctx, e: Ent, t: number, px: number, L: Layout) {
  if (e.lift <= 0.01) return;
  const s = e.s;
  const hiddenDrop = (1 - e.lift) * 70;
  const hit = e.state === 'soaked' || (e.state === 'flee' && e.stateT < 0.2 && e.wet >= 3);
  const seed = e.id * 5 + (Math.floor(t * 8) % 3) * 0.41;
  ctx.save();
  ctx.beginPath();
  ctx.rect(-50, -200, 600, L.wallTop + 200 + 1);
  ctx.clip();
  ctx.translate(e.x, L.wallTop + hiddenDrop * s);
  ctx.scale(s * e.dir, s);
  const bob = hit ? Math.sin(t * 50) * 2 : Math.sin(t * 9) * 2;
  ctx.translate(0, bob);
  paperShadow(ctx, px, s);
  const body = hit ? mix('#b4532a', WET, 0.3) : '#b4532a';
  const breast = hit ? mix('#e59a52', WET, 0.3) : '#e59a52';
  // tail feathers
  poly(ctx, [-18, -30, -36, -62, -26, -32], '#3c2a20', seed + 1);
  poly(ctx, [-16, -26, -40, -50, -22, -24], '#5a3a26', seed + 2);
  blob(ctx, 0, -24, 24, 22, body, seed, 0.05);
  blob(ctx, 8, -18, 13, 15, breast, seed + 3, 0.06);
  // wing (flaps when hit)
  ctx.save();
  ctx.translate(-4, -26);
  ctx.rotate(hit ? Math.sin(t * 40) * 0.8 - 0.4 : 0);
  blob(ctx, -6, 4, 15, 9, '#8c3c1c', seed + 4, 0.08, -0.3);
  ctx.restore();
  // head
  const hy = -54;
  blob(ctx, 6, hy - 14, 4, 5, '#e0262e', seed + 5);
  blob(ctx, 11, hy - 15, 4, 6, '#e0262e', seed + 6);
  blob(ctx, 16, hy - 13, 4, 5, '#e0262e', seed + 7);
  blob(ctx, 8, hy, 14, 14, body, seed + 8, 0.05);
  poly(ctx, [19, hy - 2, 30, hy + 2, 19, hy + 5], '#f2c230', seed + 9, 0.3);
  blob(ctx, 18, hy + 9, 3.5, 5, '#e0262e', seed + 10);
  if (hit) {
    eyes(ctx, 11, hy - 3, 5, seed + 11, 0, 0, '#111', 0.15);
  } else {
    eyes(ctx, 11, hy - 3, 4.5, seed + 11, 0.6, 0);
  }
  noShadow(ctx);
  ctx.restore();
  if (hit) shout(ctx, e.x + 30, L.wallTop - 92 * s, 'BAWK!', e.stateT, px);
}

// ------------------------------------------------------------------ bunnies

export function drawBunny(ctx: Ctx, e: Ent, t: number, px: number) {
  const B = CHARACTERS.bunnies;
  const v = e.variant % 3;
  const fur = B[v].colors.fur;
  const patch = v === 1 ? B[1].colors.patch : v === 2 ? B[2].colors.patch : fur;
  const earIn = v === 0 ? B[0].colors.ear : '#e9a8b2';
  const eye = v === 0 ? B[0].colors.eye : '#111';
  const soaked = e.state === 'soaked';
  const wet = e.state !== 'move';
  const boil = Math.floor(t * 8);
  const seed = e.id * 3 + (boil % 3) * 0.29;
  groundShadow(ctx, e, 30);
  ctx.save();
  ctx.translate(e.x, e.y - e.lift);
  ctx.scale(e.s * e.dir, e.s);
  paperShadow(ctx, px, e.s);
  const tone = (c: string) => (wet ? mix(c, WET, 0.25) : c);
  const nibble = e.pose === 'nibble' && e.state === 'move';
  const airborne = e.lift > 3 * e.s;
  const hx = nibble ? 24 : 21;
  const hy = nibble ? -24 : -34;
  // ears (droop when wet)
  const earRot = soaked || wet ? 1.15 : nibble ? 0.35 : 0.08;
  for (const [ox, k] of [[-2, 0], [4, 1]] as const) {
    ctx.save();
    ctx.translate(hx + ox - 6, hy - 8);
    ctx.rotate(-earRot + k * 0.18);
    blob(ctx, 0, -15, 5.5, 16, tone(v === 0 ? fur : patch), seed + 20 + k, 0.05);
    blob(ctx, 0, -14, 2.6, 11, tone(earIn), seed + 22 + k, 0.05);
    ctx.restore();
  }
  // back leg
  if (airborne) limb(ctx, [-16, -12, -30, -4], 8, tone(fur));
  else blob(ctx, -10, -4, 13, 5, tone(fur), seed + 1, 0.05);
  // body
  blob(ctx, 0, -20, 26, 18, tone(fur), seed, 0.04);
  if (v === 1) {
    blob(ctx, -13, -21, 15, 16, tone(patch), seed + 2, 0.06);
  } else if (v === 2) {
    blob(ctx, -6, -30, 16, 8, tone(patch), seed + 2, 0.08);
    blob(ctx, -16, -16, 8, 7, tone(patch), seed + 3, 0.08);
  }
  // white collar band for the Dutch bunny
  blob(ctx, -20, -18, 12, 14, tone(v === 1 ? patch : fur), seed + 4, 0.05);
  blob(ctx, -27, -22, 7, 7, tone('#ffffff'), seed + 5, 0.08);
  // front leg
  limb(ctx, [12, -10, airborne ? 22 : 14, -1], 6, tone(fur));
  // head
  blob(ctx, hx, hy, 14, 12.5, tone(v === 0 ? fur : patch), seed + 6, 0.04);
  if (v !== 0) {
    poly(ctx, [hx + 2, hy - 13, hx + 7, hy - 13, hx + 12, hy + 6, hx + 3, hy + 6], tone(fur), seed + 7, 0.4);
    if (v === 2) blob(ctx, 10, -12, 11, 8, tone(fur), seed + 8, 0.06);
  }
  blob(ctx, hx + 9, hy + 5, 6, 5, tone('#ffffff'), seed + 9, 0.06);
  const chew = nibble ? Math.sin(t * 22) * 1 : 0;
  blob(ctx, hx + 13, hy + 2 + chew, 2, 1.6, '#e98a9a', seed + 10, 0.05);
  if (soaked) eyes(ctx, hx + 4, hy - 3, 4.5, seed + 11, 0, 0, eye, 0.16);
  else eyes(ctx, hx + 4, hy - 3, 4.2, seed + 11, 0.6, nibble ? 0.5 : 0, eye, 0.38);
  if (wet) drips(ctx, 40, 44, e.stateT, seed);
  noShadow(ctx);
  ctx.restore();
  if (soaked || (e.state === 'flee' && e.stateT < 0.3)) {
    shout(ctx, e.x + 20, e.y - 70 * e.s - 6, e.shout, soaked ? e.stateT : 1, px);
  }
}

// ------------------------------------------------------------------ turtles

export function drawTurtle(ctx: Ctx, e: Ent, t: number, px: number) {
  const T = CHARACTERS.turtles.colors;
  const shell = e.variant === 1 ? '#4c5a2a' : T.shell;
  const inShell = e.state === 'shell';
  const seed = e.id * 11 + (Math.floor(t * 6) % 3) * 0.31;
  groundShadow(ctx, e, 36);
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.scale(e.s * e.dir, e.s);
  if (inShell) ctx.rotate(Math.sin(e.stateT * 30) * 0.05 * Math.max(0, 1 - e.stateT));
  paperShadow(ctx, px, e.s);
  const step = Math.floor(e.dist / 6) % 2;
  if (!inShell) {
    limb(ctx, [-18, -6, -20 + step * 4, 0], 7, T.skin);
    limb(ctx, [16, -6, 18 - step * 4, 0], 7, T.skin);
    limb(ctx, [-30, -8, -38, -6], 4, T.skin);
    // head with yellow stripes and the red ear patch
    const hx = 37;
    const hy = -13 + Math.sin(t * 2 + e.id) * 1.2;
    limb(ctx, [24, -10, hx - 4, hy], 9, T.skin);
    blob(ctx, hx, hy, 9.5, 7.5, T.skin, seed + 1, 0.05);
    limb(ctx, [hx - 9, hy + 1, hx + 4, hy + 2], 1.6, T.stripe);
    limb(ctx, [hx - 8, hy + 4, hx + 3, hy + 5], 1.6, T.stripe);
    blob(ctx, hx - 3, hy - 2, 3, 2, T.ear, seed + 2, 0.05);
    blob(ctx, hx + 3, hy - 3, 2.6, 2.6, '#fff', seed + 3, 0.05);
    blob(ctx, hx + 3.8, hy - 3, 1.2, 1.2, '#111', seed + 4, 0.05);
  }
  // shell dome
  ctx.beginPath();
  ellipsePath(ctx, 0, -8, 32, 21, seed, 0.03);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = shell;
  ctx.fillRect(-40, -40, 80, 33);
  noShadow(ctx);
  const lite = mix(shell, '#c9c26a', 0.35);
  blob(ctx, 0, -18, 9, 6, lite, seed + 5, 0.1);
  blob(ctx, -16, -12, 7, 5, lite, seed + 6, 0.1);
  blob(ctx, 16, -12, 7, 5, lite, seed + 7, 0.1);
  blob(ctx, -8, -24, 5, 3, lite, seed + 8, 0.1);
  blob(ctx, 8, -24, 5, 3, lite, seed + 9, 0.1);
  ctx.restore();
  paperShadow(ctx, px, e.s * 0.6);
  blob(ctx, 0, -7, 33, 3.5, mix(shell, '#e3cf4a', 0.35), seed + 10, 0.03);
  noShadow(ctx);
  ctx.restore();
  if (inShell && e.stateT < 1.1) shout(ctx, e.x + 20, e.y - 50 * e.s - 6, e.shout === '!' ? 'OUCH!' : e.shout, e.stateT, px);
}
