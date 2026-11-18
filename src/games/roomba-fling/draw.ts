/**
 * Roomba Fling art: everything drawn in code on canvas, top-down, soft "cosy illustration" look.
 * All functions draw in world units (the caller sets the world transform).
 */
import { CHARACTERS } from '../../shared/characters';
import {
  W, H, R, mulberry32, type Level, type Piece, type Zone, type Mover, type Rosie, type RectShape, moverPos,
} from './sim';

export const WALL = 16;
type Ctx = CanvasRenderingContext2D;

const C = {
  tile: '#e6e3dd',
  grout: '#d2cdc4',
  wall: '#fbfaf6',
  wallEdge: '#d9d4ca',
  sofa: '#53575f',
  sofaDark: '#43464d',
  sofaLight: '#61656e',
  wood: '#8d5b3a',
  woodDark: '#6e4429',
  woodLight: '#a8714b',
  outline: 'rgba(40,36,32,0.55)',
};

function rrect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const k = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

function shadow(ctx: Ctx, blur = 8, oy = 3, a = 0.22) {
  ctx.shadowColor = `rgba(30,25,20,${a})`;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = oy;
}
function noShadow(ctx: Ctx) {
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}
function circle(ctx: Ctx, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

// ---------------------------------------------------------------- floor and walls

/** The tiled floor and rugs (below the dirt layer). */
export function drawFloor(ctx: Ctx, level: Level) {
  const rng = mulberry32(level.seed ^ 0x51a7);
  const T = 60;
  ctx.fillStyle = C.grout;
  ctx.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += T) {
    for (let x = 0; x < W; x += T) {
      const v = Math.floor(rng() * 10) - 5;
      ctx.fillStyle = `rgb(${230 + v},${227 + v},${221 + v})`;
      ctx.fillRect(x + 0.8, y + 0.8, T - 1.6, T - 1.6);
      // faint stone mottling
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(x + 0.8, y + 0.8, T - 1.6, 2);
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = `rgba(160,150,135,${0.04 + rng() * 0.04})`;
        circle(ctx, x + rng() * T, y + rng() * T, 4 + rng() * 10);
        ctx.fill();
      }
    }
  }
  for (const z of level.zones) if (z.kind === 'rug') drawRug(ctx, z);
}

function drawRug(ctx: Ctx, z: Zone) {
  ctx.save();
  shadow(ctx, 3, 1, 0.15);
  if (z.shape.kind === 'circle') {
    const { x, y, r } = z.shape;
    // round red rug (like the one by the armchair)
    ctx.fillStyle = '#b8323a';
    circle(ctx, x, y, r);
    ctx.fill();
    noShadow(ctx);
    ctx.strokeStyle = '#d65a5a';
    ctx.lineWidth = 3;
    circle(ctx, x, y, r - 6);
    ctx.stroke();
    ctx.strokeStyle = '#8f2430';
    ctx.lineWidth = 1.5;
    circle(ctx, x, y, r - 12);
    ctx.stroke();
    ctx.fillStyle = '#e9b44c';
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      circle(ctx, x + Math.cos(a) * (r - 18), y + Math.sin(a) * (r - 18), 1.8);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    circle(ctx, x, y, r * 0.4);
    ctx.fill();
    // tufted texture
    const rng = mulberry32(Math.floor(z.look * 1e6));
    ctx.fillStyle = 'rgba(80,10,20,0.18)';
    for (let i = 0; i < 90; i++) {
      const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * (r - 2);
      ctx.fillRect(x + Math.cos(a) * d, y + Math.sin(a) * d, 1.2, 1.2);
    }
  } else if (z.shape.kind === 'rect') {
    const { x, y, w, h } = z.shape;
    // woven kilim
    ctx.fillStyle = '#d9c3a0';
    ctx.fillRect(x, y, w, h);
    noShadow(ctx);
    ctx.strokeStyle = '#9c4f3a';
    ctx.lineWidth = 4;
    ctx.strokeRect(x + 6, y + 6, w - 12, h - 12);
    ctx.strokeStyle = '#3f5f6b';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 12, y + 12, w - 24, h - 24);
    ctx.fillStyle = '#9c4f3a';
    const cx = x + w / 2, cy = y + h / 2;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      const dx = i * (w / 4);
      ctx.moveTo(cx + dx, cy - 14);
      ctx.lineTo(cx + dx + 12, cy);
      ctx.lineTo(cx + dx, cy + 14);
      ctx.lineTo(cx + dx - 12, cy);
      ctx.closePath();
      ctx.fill();
    }
    // fringe
    ctx.strokeStyle = '#efe4cf';
    ctx.lineWidth = 1;
    for (let i = 2; i < w; i += 4) {
      ctx.beginPath(); ctx.moveTo(x + i, y); ctx.lineTo(x + i, y - 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + i, y + h); ctx.lineTo(x + i, y + h + 4); ctx.stroke();
    }
  }
  ctx.restore();
}

/** Dirt layer: dust film, crumbs, dog hair and muddy paw prints. Drawn into its own canvas. */
export function drawDirt(ctx: Ctx, level: Level) {
  const rng = mulberry32(level.seed ^ 0xd127);
  ctx.fillStyle = 'rgba(128,104,72,0.20)';
  ctx.fillRect(0, 0, W, H);
  // blotches
  for (let i = 0; i < 70; i++) {
    const x = rng() * W, y = rng() * H, r = 12 + rng() * 40;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(110,85,55,${0.10 + rng() * 0.12})`);
    g.addColorStop(1, 'rgba(110,85,55,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // specks
  for (let i = 0; i < 1600; i++) {
    const s = rng();
    ctx.fillStyle = s < 0.5 ? 'rgba(90,70,50,0.55)' : s < 0.8 ? 'rgba(60,55,50,0.45)' : 'rgba(150,120,80,0.6)';
    const sz = 0.6 + rng() * 1.3;
    ctx.fillRect(rng() * W, rng() * H, sz, sz);
  }
  // crumbs
  for (let i = 0; i < 70; i++) {
    const x = rng() * W, y = rng() * H;
    ctx.fillStyle = rng() < 0.5 ? '#c99b5d' : '#a8783f';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 1.5 + rng() * 2, y + rng() * 1.5);
    ctx.lineTo(x + rng() * 2, y + 1.5 + rng() * 2);
    ctx.closePath();
    ctx.fill();
  }
  // Rosie's hair (white and grey)
  ctx.lineWidth = 0.7;
  ctx.lineCap = 'round';
  for (let i = 0; i < 260; i++) {
    const x = rng() * W, y = rng() * H, a = rng() * Math.PI * 2, l = 3 + rng() * 5;
    ctx.strokeStyle = rng() < 0.7 ? 'rgba(255,255,255,0.85)' : 'rgba(40,40,40,0.6)';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.6, y + Math.sin(a + 0.6) * l * 0.6, x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  // muddy paw print trails from the yard door (left wall)
  for (let t = 0; t < 2; t++) {
    let x = 4, y = 180 + rng() * 300, a = (rng() - 0.5) * 0.8;
    for (let i = 0; i < 18; i++) {
      a += (rng() - 0.5) * 0.5;
      x += Math.cos(a) * 16; y += Math.sin(a) * 16;
      if (x < 0 || x > W || y < 0 || y > H) break;
      const side = i % 2 ? 1 : -1;
      pawPrint(ctx, x - Math.sin(a) * 5 * side, y + Math.cos(a) * 5 * side, a);
    }
  }
}

function pawPrint(ctx: Ctx, x: number, y: number, a: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a + Math.PI / 2);
  ctx.fillStyle = 'rgba(105,75,45,0.55)';
  ctx.beginPath(); ctx.ellipse(0, 1.5, 2.6, 2.1, 0, 0, Math.PI * 2); ctx.fill();
  for (const [dx, dy] of [[-2.6, -1.6], [-0.9, -3.2], [0.9, -3.2], [2.6, -1.6]]) {
    ctx.beginPath(); ctx.ellipse(dx, dy, 0.95, 1.2, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/** Walls with the left-side window, yard door and window with AC (matches the house plan). */
export function drawWalls(ctx: Ctx, level: Level) {
  ctx.save();
  // outer frame
  ctx.fillStyle = C.wall;
  ctx.fillRect(-WALL, -WALL, W + WALL * 2, WALL);
  ctx.fillRect(-WALL, H, W + WALL * 2, WALL);
  ctx.fillRect(-WALL, 0, WALL, H);
  ctx.fillRect(W, 0, WALL, H);
  // inner edge shadow onto the floor
  const g1 = ctx.createLinearGradient(0, 0, 0, 10);
  g1.addColorStop(0, 'rgba(60,50,40,0.22)'); g1.addColorStop(1, 'rgba(60,50,40,0)');
  ctx.fillStyle = g1; ctx.fillRect(0, 0, W, 10);
  const g2 = ctx.createLinearGradient(0, 0, 8, 0);
  g2.addColorStop(0, 'rgba(60,50,40,0.18)'); g2.addColorStop(1, 'rgba(60,50,40,0)');
  ctx.fillStyle = g2; ctx.fillRect(0, 0, 8, H);
  const g3 = ctx.createLinearGradient(W, 0, W - 8, 0);
  g3.addColorStop(0, 'rgba(60,50,40,0.18)'); g3.addColorStop(1, 'rgba(60,50,40,0)');
  ctx.fillStyle = g3; ctx.fillRect(W - 8, 0, 8, H);
  ctx.strokeStyle = C.wallEdge;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-0.75, -0.75, W + 1.5, H + 1.5);
  ctx.strokeStyle = '#c9c3b8';
  ctx.strokeRect(-WALL + 0.75, -WALL + 0.75, W + WALL * 2 - 1.5, H + WALL * 2 - 1.5);

  // skirting tiles line
  ctx.strokeStyle = 'rgba(180,172,160,0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(2, 2, W - 4, H - 4);

  // left wall: window (top), door to the yard (middle), window with the AC (bottom)
  const win = (y0: number, len: number) => {
    ctx.fillStyle = '#bfe3ef';
    ctx.fillRect(-WALL + 4, y0, WALL - 8, len);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(-WALL + 5, y0 + 4, 2, len - 8);
    ctx.strokeStyle = '#8fa9b3';
    ctx.lineWidth = 1;
    ctx.strokeRect(-WALL + 4, y0, WALL - 8, len);
    ctx.beginPath(); ctx.moveTo(-WALL + 4, y0 + len / 2); ctx.lineTo(-4, y0 + len / 2); ctx.stroke();
    // curtains
    ctx.fillStyle = 'rgba(235,232,224,0.95)';
    ctx.fillRect(-3, y0 - 6, 3, 14);
    ctx.fillRect(-3, y0 + len - 8, 3, 14);
  };
  win(70, 70);
  // door gap with an open door swinging in
  const dy = 270;
  ctx.fillStyle = '#e9e1d2';
  ctx.fillRect(-WALL, dy, WALL, 64);
  ctx.strokeStyle = 'rgba(120,100,80,0.25)';
  ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.arc(0, dy, 62, 0, Math.PI / 2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.save();
  shadow(ctx, 4, 1, 0.2);
  ctx.fillStyle = '#f3efe6';
  ctx.fillRect(0, dy - 1, 5, 62);
  ctx.restore();
  ctx.fillStyle = '#b9ae9a';
  circle(ctx, 3, dy + 50, 1.6); ctx.fill();
  win(H - 200, 80);
  // AC unit above that window (drawn on the wall top, sticking into the room a bit)
  ctx.save();
  shadow(ctx, 6, 2, 0.25);
  rrect(ctx, -WALL + 2, H - 205, WALL + 8, 90, 4);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = '#d5d2cb';
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(4 + i * 1.5, H - 198); ctx.lineTo(4 + i * 1.5, H - 122); ctx.stroke(); }
  ctx.fillStyle = '#58c26a';
  circle(ctx, 7, H - 120, 1.2); ctx.fill();

  // right wall: open to the kitchen
  ctx.fillStyle = '#efe9dc';
  ctx.fillRect(W, 120, WALL, 110);
  ctx.fillStyle = 'rgba(0,0,0,0.05)';
  for (let i = 0; i < 4; i++) ctx.fillRect(W + 2, 124 + i * 26, WALL - 4, 22);
  ctx.restore();
  void level;
}

// ---------------------------------------------------------------- furniture

export function drawPiece(ctx: Ctx, p: Piece, level: Level) {
  ctx.save();
  switch (p.type) {
    case 'sofa': drawSofa(ctx, p, level.rosie.where === 'couch' ? level.rosie : null); break;
    case 'coffee': drawCoffee(ctx, p); break;
    case 'armchair': drawArmchair(ctx, p); break;
    case 'desk': drawDesk(ctx, p); break;
    case 'bookcase': drawBookcase(ctx, p); break;
    case 'plant': drawPlant(ctx, p); break;
    case 'lamp': drawLamp(ctx, p); break;
    case 'sidetable': drawSideTable(ctx, p); break;
    case 'backpack': drawBackpack(ctx, p); break;
    case 'dogbed': drawDogBed(ctx, p); break;
    case 'gate': drawGate(ctx, p); break;
    case 'pillow': break; // drawn live (it squashes when hit)
  }
  ctx.restore();
  void level;
}

const PILLOW_COLORS = [
  ['#d4d64a', '#b5b832'],
  ['#f1ece0', '#c9533f'],
  ['#e0b13a', '#42464e'],
  ['#6fb3c7', '#f3efe4'],
];

function cushion(ctx: Ctx, x: number, y: number, w: number, h: number, kind: number, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  const [a, b] = PILLOW_COLORS[kind % PILLOW_COLORS.length];
  shadow(ctx, 4, 2, 0.3);
  ctx.beginPath();
  // puffy square with pinched corners
  ctx.moveTo(-w / 2, -h / 2);
  ctx.quadraticCurveTo(0, -h / 2 + 3, w / 2, -h / 2);
  ctx.quadraticCurveTo(w / 2 - 3, 0, w / 2, h / 2);
  ctx.quadraticCurveTo(0, h / 2 - 3, -w / 2, h / 2);
  ctx.quadraticCurveTo(-w / 2 + 3, 0, -w / 2, -h / 2);
  ctx.closePath();
  ctx.fillStyle = a;
  ctx.fill();
  noShadow(ctx);
  ctx.clip();
  ctx.fillStyle = b;
  if (kind % 4 === 1) {
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { ctx.fillRect(i * w / 5 - 1, j * h / 5 - 1, 2, 2); }
  } else if (kind % 4 === 2) {
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * w / 4, -h / 2); ctx.lineTo(i * w / 4 + w / 8, 0); ctx.lineTo(i * w / 4 - w / 8, 0); ctx.closePath(); ctx.fill(); }
  } else if (kind % 4 === 3) {
    ctx.fillRect(-w / 2, -2, w, 4);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath(); ctx.ellipse(-w / 6, -h / 6, w / 4, h / 6, -0.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawSofa(ctx: Ctx, p: Piece, rosie: Rosie | null) {
  const [long, arm] = p.parts!;
  const back = 15;
  ctx.save();
  shadow(ctx, 12, 5, 0.3);
  ctx.fillStyle = C.sofaDark;
  rrect(ctx, long.x, long.y, long.w, long.h, 8); ctx.fill();
  rrect(ctx, arm.x, arm.y, arm.w, arm.h, 8); ctx.fill();
  ctx.restore();
  // backrests along the walls
  const leftSide = p.side === 'left';
  const topEnd = p.end === 'top';
  // long part: backrest on the wall side
  const lb: RectShape = { kind: 'rect', x: leftSide ? long.x : long.x + long.w - back, y: long.y, w: back, h: long.h };
  // arm: backrest along top or bottom of the arm (wall side = room end)
  const ab: RectShape = { kind: 'rect', x: arm.x, y: topEnd ? arm.y : arm.y + arm.h - back, w: arm.w, h: back };
  // seat cushions
  const seat = (x: number, y: number, w: number, h: number) => {
    ctx.save();
    shadow(ctx, 3, 1, 0.25);
    rrect(ctx, x + 1.5, y + 1.5, w - 3, h - 3, 6);
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, C.sofaLight); g.addColorStop(1, C.sofa);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1;
    rrect(ctx, x + 4, y + 4, w - 8, h - 8, 4); ctx.stroke();
  };
  const sx = leftSide ? long.x + back : long.x;
  const sw = long.w - back;
  const segs = 3;
  const y0 = topEnd ? long.y + back : long.y;
  const y1 = topEnd ? long.y + long.h : long.y + long.h - back;
  for (let i = 0; i < segs; i++) seat(sx, y0 + ((y1 - y0) * i) / segs, sw, (y1 - y0) / segs);
  const ay = topEnd ? arm.y + back : arm.y;
  const ax0 = arm.x, aw = arm.w;
  const n2 = Math.max(1, Math.round(aw / 60));
  for (let i = 0; i < n2; i++) seat(ax0 + (aw * i) / n2, ay, aw / n2, arm.h - back);
  // backrests
  for (const b of [lb, ab]) {
    ctx.save();
    shadow(ctx, 4, 2, 0.25);
    rrect(ctx, b.x, b.y, b.w, b.h, 6);
    ctx.fillStyle = C.sofaDark;
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    rrect(ctx, b.x + 2, b.y + 2, b.w - 4, b.h - 4, 4); ctx.fill();
  }
  // arm rest at the open end of the long part and of the short part
  const armRest = (x: number, y: number, w: number, h: number) => {
    ctx.save(); shadow(ctx, 3, 1, 0.3);
    rrect(ctx, x, y, w, h, 5); ctx.fillStyle = C.sofaDark; ctx.fill(); ctx.restore();
  };
  if (topEnd) armRest(long.x, long.y + long.h - 12, long.w, 12); else armRest(long.x, long.y, long.w, 12);
  if (leftSide) armRest(arm.x + arm.w - 12, arm.y, 12, arm.h); else armRest(arm.x, arm.y, 12, arm.h);
  // throw pillows in the corner and along the back (like the photo)
  const k = Math.floor(p.look * 4);
  const cxp = leftSide ? long.x + back + 12 : long.x + long.w - back - 12;
  const cyp = topEnd ? long.y + back + 12 : long.y + long.h - back - 12;
  const pillows: [number, number, number, number, number, number][] = [
    [cxp, cyp, 22, 20, k + 2, 0.5],
    [cxp + (leftSide ? 26 : -26), cyp + (topEnd ? 4 : -4), 21, 19, k + 1, -0.2],
    [cxp + (leftSide ? 2 : -2), cyp + (topEnd ? 30 : -30), 20, 21, k, 0.15],
    [leftSide ? long.x + back + 9 : long.x + long.w - back - 9, topEnd ? long.y + long.h - 40 : long.y + 40, 18, 22, k + 3, 0.1],
  ];
  // keep the cushions clear of Rosie when she sleeps on the couch
  for (const [x, y, w, h, kind, rot] of pillows) {
    if (rosie && Math.abs(y - rosie.y) < 48 && Math.abs(x - rosie.x) < 40) continue;
    cushion(ctx, x, y, w, h, kind, rot);
  }
}

function drawCoffee(ctx: Ctx, p: Piece) {
  const { x, y, w, h } = p;
  ctx.save();
  shadow(ctx, 10, 6, 0.18);
  ctx.strokeStyle = '#fbfbf8';
  ctx.lineWidth = 6;
  rrect(ctx, x + 3, y + 3, w - 6, h - 6, 3);
  ctx.stroke();
  ctx.restore();
  // glass top (see-through)
  ctx.fillStyle = 'rgba(170,215,225,0.28)';
  ctx.fillRect(x + 6, y + 6, w - 12, h - 12);
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x + 14, y + h - 10); ctx.lineTo(x + 30, y + 10); ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x + 22, y + h - 10); ctx.lineTo(x + 36, y + 12); ctx.stroke();
  ctx.strokeStyle = '#ddd9d0';
  ctx.lineWidth = 1;
  rrect(ctx, x, y, w, h, 4); ctx.stroke();
  // things on the table: wooden tray, water bottle, glass
  const tx = x + w * 0.55, ty = y + h * 0.25;
  ctx.save();
  shadow(ctx, 3, 1, 0.25);
  ctx.fillStyle = '#c99a62';
  rrect(ctx, tx, ty, w * 0.32, h * 0.5, 2); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#d88a3c';
  circle(ctx, tx + 8, ty + 8, 4.5); ctx.fill();
  ctx.fillStyle = '#7b6a4a';
  circle(ctx, tx + w * 0.2, ty + h * 0.3, 5); ctx.fill();
  ctx.fillStyle = 'rgba(210,235,245,0.9)';
  circle(ctx, x + w * 0.3, y + h * 0.62, 4.5); ctx.fill();
  ctx.strokeStyle = 'rgba(120,160,175,0.9)';
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  circle(ctx, x + w * 0.3, y + h * 0.62, 2); ctx.fill();
}

function drawArmchair(ctx: Ctx, p: Piece) {
  const { x, y, w, h } = p;
  // which way does it face? toward the room centre
  const faceUp = y + h / 2 > H / 2;
  ctx.save();
  shadow(ctx, 10, 4, 0.3);
  ctx.fillStyle = '#34405c';
  rrect(ctx, x, y, w, h, 10); ctx.fill();
  ctx.restore();
  const by = faceUp ? y + h - 14 : y;
  ctx.fillStyle = '#2b3550';
  rrect(ctx, x + 2, by + 1, w - 4, 13, 6); ctx.fill();
  ctx.fillStyle = '#2b3550';
  rrect(ctx, x + 1, y + 4, 10, h - 8, 5); ctx.fill();
  rrect(ctx, x + w - 11, y + 4, 10, h - 8, 5); ctx.fill();
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, '#4c5d84'); g.addColorStop(1, '#3d4b6c');
  ctx.fillStyle = g;
  rrect(ctx, x + 12, faceUp ? y + 5 : y + 15, w - 24, h - 20, 6); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.stroke();
}

function drawDesk(ctx: Ctx, p: Piece) {
  const { x, y, w, h } = p;
  ctx.save();
  shadow(ctx, 10, 5, 0.3);
  ctx.fillStyle = C.wood;
  rrect(ctx, x, y, w, h, 3); ctx.fill();
  ctx.restore();
  // wood grain
  ctx.strokeStyle = 'rgba(60,30,15,0.2)';
  ctx.lineWidth = 1;
  const vertical = h > w;
  for (let i = 4; i < (vertical ? w : h); i += 5) {
    ctx.beginPath();
    if (vertical) { ctx.moveTo(x + i, y + 2); ctx.lineTo(x + i + 1, y + h - 2); } else { ctx.moveTo(x + 2, y + i); ctx.lineTo(x + w - 2, y + i + 1); }
    ctx.stroke();
  }
  ctx.strokeStyle = C.woodDark;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  // papers, a lamp and a mug
  ctx.save();
  ctx.translate(x + w * 0.35, y + h * 0.5);
  ctx.rotate(0.15);
  ctx.fillStyle = '#fbfaf5';
  ctx.fillRect(-11, -8, 22, 16);
  ctx.fillStyle = '#e8e4da';
  ctx.fillRect(-9, -6, 22, 16);
  ctx.restore();
  ctx.fillStyle = '#2d2d2d';
  circle(ctx, x + w * 0.75, y + h * 0.4, 6); ctx.fill();
  ctx.fillStyle = '#f2d36b';
  circle(ctx, x + w * 0.75, y + h * 0.4, 3); ctx.fill();
  ctx.fillStyle = '#e6eef0';
  circle(ctx, x + w * 0.15, y + h * 0.7, 3.5); ctx.fill();
  ctx.fillStyle = '#5a3a24';
  circle(ctx, x + w * 0.15, y + h * 0.7, 2.2); ctx.fill();
}

function drawBookcase(ctx: Ctx, p: Piece) {
  const { x, y, w, h } = p;
  ctx.save();
  shadow(ctx, 8, 4, 0.3);
  ctx.fillStyle = '#2c2c2e';
  ctx.fillRect(x, y, w, h);
  ctx.restore();
  const vertical = h > w;
  const len = vertical ? h : w;
  const depth = vertical ? w : h;
  const rng = mulberry32(Math.floor(p.look * 1e6));
  const cols = ['#c0392b', '#e67e22', '#f1c40f', '#27ae60', '#2980b9', '#8e44ad', '#ecf0f1', '#16a085', '#d35400', '#7f8c8d'];
  let at = 3;
  while (at < len - 6) {
    const t = 3 + rng() * 4;
    const d = depth * (0.55 + rng() * 0.3);
    ctx.fillStyle = cols[Math.floor(rng() * cols.length)];
    if (vertical) ctx.fillRect(p.wall === 'left' ? x + 2 : x + w - 2 - d, y + at, d, t - 0.6);
    else ctx.fillRect(x + at, p.wall === 'top' ? y + 2 : y + h - 2 - d, t - 0.6, d);
    at += t;
    if (rng() < 0.08) {
      // a little plant on the shelf
      const px = vertical ? x + w / 2 : x + at + 7, py = vertical ? y + at + 7 : y + h / 2;
      ctx.fillStyle = '#4f8a3f';
      for (let i = 0; i < 5; i++) { circle(ctx, px + Math.cos(i * 1.3) * 3.5, py + Math.sin(i * 1.3) * 3.5, 3); ctx.fill(); }
      at += 15;
    }
  }
}

function drawPlant(ctx: Ctx, p: Piece) {
  const cx = p.x + p.w / 2, cy = p.y + p.h / 2, r = p.w / 2;
  ctx.save();
  shadow(ctx, 8, 4, 0.3);
  // patterned pot (green/white like the one on the shelf)
  ctx.fillStyle = p.look < 0.5 ? '#5f8f7a' : '#c66b3d';
  circle(ctx, cx, cy, r * 0.78); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r * 0.62, cy + Math.sin(a) * r * 0.62, 2, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.fillStyle = '#5b4632';
  circle(ctx, cx, cy, r * 0.55); ctx.fill();
  // leaves
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + p.look * 3;
    const l = r * (0.95 + (i % 3) * 0.12);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    ctx.fillStyle = i % 2 ? '#3f7d3a' : '#58a14a';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(l * 0.5, -l * 0.32, l, 0);
    ctx.quadraticCurveTo(l * 0.5, l * 0.32, 0, 0);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(l * 0.85, 0); ctx.stroke();
    ctx.restore();
  }
}

function drawLamp(ctx: Ctx, p: Piece) {
  const cx = p.x + p.w / 2, cy = p.y + p.h / 2, r = p.w / 2;
  const g = ctx.createRadialGradient(cx, cy, r, cx, cy, r * 4);
  g.addColorStop(0, 'rgba(255,230,170,0.35)'); g.addColorStop(1, 'rgba(255,230,170,0)');
  ctx.fillStyle = g;
  circle(ctx, cx, cy, r * 4); ctx.fill();
  ctx.save();
  shadow(ctx, 6, 3, 0.3);
  ctx.fillStyle = '#f7ecd2';
  circle(ctx, cx, cy, r); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = '#d8c9a5';
  ctx.lineWidth = 1;
  circle(ctx, cx, cy, r - 2); ctx.stroke();
  ctx.fillStyle = '#fff8dc';
  circle(ctx, cx, cy, r * 0.4); ctx.fill();
}

function drawSideTable(ctx: Ctx, p: Piece) {
  const cx = p.x + p.w / 2, cy = p.y + p.h / 2, r = p.w / 2;
  ctx.save();
  shadow(ctx, 8, 4, 0.3);
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 1, cx, cy, r);
  g.addColorStop(0, C.woodLight); g.addColorStop(1, C.wood);
  ctx.fillStyle = g;
  circle(ctx, cx, cy, r); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(60,30,15,0.25)';
  for (let i = 1; i < 4; i++) { circle(ctx, cx, cy, (r * i) / 4); ctx.stroke(); }
  // a mug
  ctx.fillStyle = '#e8e2d5';
  circle(ctx, cx + r * 0.25, cy - r * 0.15, 4); ctx.fill();
  ctx.fillStyle = '#4b2e1d';
  circle(ctx, cx + r * 0.25, cy - r * 0.15, 2.6); ctx.fill();
}

function drawBackpack(ctx: Ctx, p: Piece) {
  const { x, y, w, h } = p;
  ctx.save();
  shadow(ctx, 6, 3, 0.35);
  ctx.fillStyle = '#26282c';
  rrect(ctx, x, y, w, h, 10); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#34373d';
  rrect(ctx, x + 5, y + h * 0.45, w - 10, h * 0.45, 6); ctx.fill();
  ctx.strokeStyle = '#4a4e56';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x + 8, y + 3); ctx.quadraticCurveTo(x + 4, y - 6, x + w * 0.4, y - 4); ctx.stroke();
  ctx.fillStyle = '#9aa0a8';
  ctx.fillRect(x + w / 2 - 4, y + h * 0.45, 8, 1.5);
}

function drawDogBed(ctx: Ctx, p: Piece) {
  const cx = p.x + p.w / 2, cy = p.y + p.h / 2, r = p.w / 2;
  ctx.save();
  shadow(ctx, 8, 4, 0.3);
  ctx.fillStyle = '#8a7b6a';
  circle(ctx, cx, cy, r); ctx.fill();
  ctx.restore();
  // plush rim
  ctx.strokeStyle = '#a5968a';
  ctx.lineWidth = 7;
  circle(ctx, cx, cy, r - 5); ctx.stroke();
  ctx.fillStyle = '#d9cdb8';
  circle(ctx, cx, cy, r - 9); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    circle(ctx, cx + Math.cos(a) * (r - 5), cy + Math.sin(a) * (r - 5), 2); ctx.fill();
  }
}

function drawGate(ctx: Ctx, p: Piece) {
  const { x, y, w, h } = p;
  ctx.save();
  shadow(ctx, 5, 3, 0.3);
  ctx.fillStyle = '#f4f4f2';
  rrect(ctx, x, y, w, h, 2); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = '#c8c8c4';
  ctx.lineWidth = 1;
  for (let i = x + 4; i < x + w - 2; i += 6) { ctx.beginPath(); ctx.moveTo(i, y + 1); ctx.lineTo(i, y + h - 1); ctx.stroke(); }
  ctx.strokeStyle = '#a9a9a4';
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  // posts at the open end
  ctx.fillStyle = '#d9d9d4';
  if (x > 1) { circle(ctx, x + 2, y + h / 2, 5); ctx.fill(); }
  if (x + w < W - 1) { circle(ctx, x + w - 2, y + h / 2, 5); ctx.fill(); }
}

export function drawPuddle(ctx: Ctx, z: Zone, t: number) {
  if (z.shape.kind !== 'circle') return;
  const { x, y, r } = z.shape;
  const rng = mulberry32(Math.floor(z.look * 1e6));
  ctx.save();
  ctx.beginPath();
  const n = 14;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const d = r * (0.75 + rng() * 0.3);
    pts.push([x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8]);
  }
  ctx.moveTo((pts[0][0] + pts[n - 1][0]) / 2, (pts[0][1] + pts[n - 1][1]) / 2);
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(120,185,220,0.45)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(90,150,190,0.5)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // shimmer
  ctx.strokeStyle = `rgba(255,255,255,${0.5 + 0.3 * Math.sin(t * 2 + z.look * 9)})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x - r * 0.2, y - r * 0.15, r * 0.35, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke();
  // the tipped-over water bowl
  const bx = x + r * 0.55, by = y - r * 0.45;
  shadow(ctx, 4, 2, 0.3);
  const g = ctx.createRadialGradient(bx - 3, by - 3, 1, bx, by, 10);
  g.addColorStop(0, '#f5f7f8'); g.addColorStop(1, '#9aa3a8');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(bx, by, 10, 7, 0.6, 0, Math.PI * 2); ctx.fill();
  noShadow(ctx);
  ctx.fillStyle = '#7d878c';
  ctx.beginPath(); ctx.ellipse(bx, by, 6, 3.6, 0.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- live things

export function drawPillow(ctx: Ctx, p: Piece, squash: number) {
  const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
  const s = 1 + squash * 0.25;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, 1 / s);
  cushion(ctx, 0, 0, p.w + 2, p.h + 2, Math.floor(p.look * 4), p.rot ?? 0);
  ctx.restore();
}

export function drawDock(ctx: Ctx, level: Level, t: number, charging: number) {
  const { x } = level.dock;
  // landing glow on the floor
  const pulse = 0.5 + 0.5 * Math.sin(t * 3);
  const g = ctx.createRadialGradient(x, level.dock.y, 2, x, level.dock.y, 34);
  g.addColorStop(0, `rgba(90,220,140,${0.28 + 0.18 * pulse + charging * 0.3})`);
  g.addColorStop(1, 'rgba(90,220,140,0)');
  ctx.fillStyle = g;
  circle(ctx, x, level.dock.y, 34); ctx.fill();
  ctx.strokeStyle = `rgba(60,170,100,${0.35 + 0.25 * pulse})`;
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1.5;
  circle(ctx, x, level.dock.y, R + 3); ctx.stroke();
  ctx.setLineDash([]);
  // the base station against the top wall
  ctx.save();
  shadow(ctx, 6, 3, 0.35);
  ctx.fillStyle = '#2a2c30';
  ctx.beginPath();
  ctx.moveTo(x - 22, 0);
  ctx.lineTo(x + 22, 0);
  ctx.lineTo(x + 18, 11);
  ctx.quadraticCurveTo(x, 14, x - 18, 11);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#c9ccd1';
  ctx.fillRect(x - 10, 9, 5, 3);
  ctx.fillRect(x + 5, 9, 5, 3);
  ctx.fillStyle = charging > 0 ? '#7dffb0' : `rgba(90,230,140,${0.5 + 0.5 * pulse})`;
  circle(ctx, x, 5, 2); ctx.fill();
}

export function drawBall(ctx: Ctx, m: Mover, t: number) {
  const p = moverPos(m, t);
  const roll = (p.x / m.r);
  ctx.save();
  ctx.translate(p.x, p.y);
  shadow(ctx, 4, 2, 0.35);
  ctx.fillStyle = '#cfe33a';
  circle(ctx, 0, 0, m.r); ctx.fill();
  noShadow(ctx);
  ctx.rotate(roll);
  ctx.strokeStyle = '#f7f7ee';
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(-m.r * 1.1, 0, m.r * 0.85, -0.9, 0.9); ctx.stroke();
  ctx.beginPath(); ctx.arc(m.r * 1.1, 0, m.r * 0.85, Math.PI - 0.9, Math.PI + 0.9); ctx.stroke();
  ctx.rotate(-roll);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  circle(ctx, -m.r * 0.35, -m.r * 0.35, m.r * 0.3); ctx.fill();
  ctx.restore();
}

/**
 * Rosie, lying on her side (head toward +x in local space). Black head with a white blaze and
 * muzzle, black ears, white body with grey ticking, a big black spot on her rump, thin legs, long tail.
 */
export function drawRosie(ctx: Ctx, r: Rosie, t: number, wake: number) {
  const col = CHARACTERS.rosie.colors;
  const breathe = 1 + Math.sin(t * 2.2) * 0.035;
  ctx.save();
  ctx.translate(r.x, r.y);
  ctx.rotate(r.angle);
  ctx.scale(r.scale, r.scale);
  // shadow
  ctx.fillStyle = 'rgba(30,25,20,0.18)';
  ctx.beginPath(); ctx.ellipse(4, 4, 40, 16, 0, 0, Math.PI * 2); ctx.fill();
  // tail: long and thin, sweeping (wags when she is bumped)
  const wag = wake > 0 ? Math.sin(t * 22) * 0.5 * wake : Math.sin(t * 0.8) * 0.06;
  ctx.save();
  ctx.translate(-26, 0);
  ctx.rotate(wag);
  ctx.strokeStyle = col.coat;
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-12, -2, -20, 8, -16, 18); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.restore();
  // legs (lying on her side, legs stretched out toward +y)
  const leg = (x0: number, y0: number, dx: number, dy: number) => {
    ctx.strokeStyle = col.coat;
    ctx.lineWidth = 4.2;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(x0 + dx * 0.6, y0 + dy * 0.5, x0 + dx, y0 + dy); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  };
  leg(-16, 6, -6, 17);
  leg(-10, 7, 2, 18);
  leg(12, 6, 6, 17);
  leg(18, 6, 13, 13);
  // body
  ctx.save();
  ctx.scale(1, breathe);
  ctx.fillStyle = col.coat;
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.ellipse(-2, 0, 27, 12.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // ticking
  const rng = mulberry32(7);
  ctx.fillStyle = col.ticking;
  for (let i = 0; i < 34; i++) {
    const a = rng() * Math.PI * 2, d = Math.sqrt(rng());
    ctx.globalAlpha = 0.45 + rng() * 0.4;
    circle(ctx, -2 + Math.cos(a) * 24 * d, Math.sin(a) * 10 * d, 0.7 + rng() * 0.6); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // big black spot on the rump by the tail
  ctx.fillStyle = col.head;
  ctx.beginPath(); ctx.ellipse(-17, -2, 8.5, 7, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // collar
  ctx.fillStyle = col.collar;
  ctx.beginPath(); ctx.ellipse(22, 0, 2.6, 8.5, 0, 0, Math.PI * 2); ctx.fill();
  // head (lifts a little when woken)
  ctx.save();
  ctx.translate(31, 0);
  ctx.rotate(wake * Math.sin(t * 6) * 0.15);
  ctx.fillStyle = col.head;
  ctx.beginPath(); ctx.ellipse(0, 0, 10.5, 8.5, 0, 0, Math.PI * 2); ctx.fill();
  // ears flopped back
  ctx.beginPath(); ctx.ellipse(-5, -7.5, 6, 3.4, -0.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-5, 7.5, 6, 3.4, 0.5, 0, Math.PI * 2); ctx.fill();
  // white blaze down the face and white muzzle
  ctx.fillStyle = col.coat;
  ctx.beginPath(); ctx.moveTo(-4, -1.2); ctx.lineTo(7, -2.5); ctx.lineTo(7, 2.5); ctx.lineTo(-4, 1.2); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.ellipse(10, 0, 6, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1a1a1a';
  circle(ctx, 15.2, 0, 1.9); ctx.fill();
  // eyes: closed when asleep, open when woken
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 0.9;
  if (wake > 0.2) {
    ctx.fillStyle = '#3a2614';
    circle(ctx, 3, -4, 1.4); ctx.fill();
    circle(ctx, 3, 4, 1.4); ctx.fill();
  } else {
    ctx.strokeStyle = '#555';
    ctx.beginPath(); ctx.arc(3, -4, 1.6, 0.2, Math.PI - 0.2); ctx.stroke();
    ctx.beginPath(); ctx.arc(3, 4, 1.6, 0.2, Math.PI - 0.2); ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
}

/** Floating "z z z" above sleeping Rosie (or a "!" when woken), drawn unrotated. */
export function drawRosieZ(ctx: Ctx, r: Rosie, t: number, wake: number) {
  const hx = r.x + Math.cos(r.angle) * 31 * r.scale, hy = r.y + Math.sin(r.angle) * 31 * r.scale;
  ctx.save();
  ctx.textAlign = 'center';
  if (wake > 0.2) {
    ctx.font = 'bold 14px "Pixelify Sans", sans-serif';
    ctx.fillStyle = `rgba(217,58,58,${Math.min(1, wake * 1.5)})`;
    ctx.fillText('!', hx + 6, hy - 14 - (1 - wake) * 6);
  } else {
    for (let i = 0; i < 3; i++) {
      const k = (t * 0.5 + i / 3) % 1;
      ctx.font = `bold ${8 + k * 6}px "Pixelify Sans", sans-serif`;
      ctx.fillStyle = `rgba(70,90,140,${(1 - k) * 0.8})`;
      ctx.fillText('z', hx + 6 + k * 12 + Math.sin(k * 6) * 2, hy - 8 - k * 22);
    }
  }
  ctx.restore();
}

/** The Roomba: charcoal disc, silver ring, glowing button, bumper and a spinning side brush. */
export function drawRoomba(ctx: Ctx, x: number, y: number, heading: number, brush: number, glow: number, happy: number) {
  ctx.save();
  ctx.translate(x, y);
  // shadow
  ctx.fillStyle = 'rgba(20,18,15,0.3)';
  circle(ctx, 1.5, 3, R + 0.5); ctx.fill();
  ctx.rotate(heading);
  // side brush (front right), drawn under the body
  ctx.save();
  ctx.translate(R * 0.62, R * 0.62);
  ctx.rotate(brush);
  ctx.strokeStyle = 'rgba(40,40,40,0.75)';
  ctx.lineWidth = 0.9;
  for (let i = 0; i < 3; i++) {
    ctx.rotate((Math.PI * 2) / 3);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(8, 1.5); ctx.stroke();
  }
  ctx.restore();
  // body
  const g = ctx.createRadialGradient(-4, -5, 2, 0, 0, R);
  g.addColorStop(0, '#4a4d54');
  g.addColorStop(1, '#232428');
  ctx.fillStyle = g;
  circle(ctx, 0, 0, R); ctx.fill();
  // bumper at the front (+x)
  ctx.strokeStyle = '#5c6068';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, R - 1.5, -1.25, 1.25); ctx.stroke();
  // silver ring
  ctx.strokeStyle = '#b9bec6';
  ctx.lineWidth = 1.4;
  circle(ctx, 0, 0, R * 0.62); ctx.stroke();
  // top cover
  ctx.fillStyle = '#2e3035';
  circle(ctx, 0, 0, R * 0.55); ctx.fill();
  // button
  const bg = ctx.createRadialGradient(0, 0, 0, 0, 0, 5);
  const hue = happy > 0 ? '120,255,170' : '80,220,230';
  bg.addColorStop(0, `rgba(${hue},${0.75 + glow * 0.25})`);
  bg.addColorStop(1, `rgba(${hue},0)`);
  ctx.fillStyle = bg;
  circle(ctx, 0, 0, 5.5); ctx.fill();
  ctx.fillStyle = '#e8fbff';
  circle(ctx, 0, 0, 1.8); ctx.fill();
  // sensor window
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.ellipse(R * 0.78, 0, 1.4, 3.6, 0, 0, Math.PI * 2); ctx.fill();
  // highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(0, 0, R - 3, Math.PI * 1.05, Math.PI * 1.45); ctx.stroke();
  ctx.restore();
}
