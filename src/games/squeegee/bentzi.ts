/**
 * Bentzi at realistic full height (~300 scene px = ~1.75 m), side view facing left, pushing a
 * long-handled squeegee. Ink-and-wash, keeping his traits: stocky, light skin, short dark-brown
 * hair, full brown beard, sunglasses pushed up on his head, black t-shirt, big grin.
 */
import { INK, type Ctx, type Pt, ellipsePts, hatchPoly, inkLine, rng, wash } from './ink';

export interface Pose { swing: number; walk: number; lean: number; zap: boolean }

const B = { skin: '#e8b48f', skinBack: '#d69f7b', hair: '#4a3222', beard: '#5a3b26', shirt: '#1b1b1f', shorts: '#6b6f4a' };

function limb(c: Ctx, pts: Pt[], w: number, col: string, seed: number): void {
  inkLine(c, pts, seed, 0.3, w + 2.6, INK);
  inkLine(c, pts, seed + 1, 0.2, w, col);
}

/** Two-bone IK: elbow/knee position for a limb from s to h; elbow bends downward. */
function joint(sx: number, sy: number, hx: number, hy: number, a: number, b: number): [number, number, number, number] {
  let dx = hx - sx, dy = hy - sy;
  let d = Math.hypot(dx, dy);
  const max = a + b - 0.5;
  if (d > max) { dx *= max / d; dy *= max / d; d = max; hx = sx + dx; hy = sy + dy; }
  const cosA = Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d)));
  const ang = Math.atan2(dy, dx);
  const off = Math.acos(cosA);
  const e1: [number, number] = [sx + Math.cos(ang + off) * a, sy + Math.sin(ang + off) * a];
  const e2: [number, number] = [sx + Math.cos(ang - off) * a, sy + Math.sin(ang - off) * a];
  const e = e1[1] > e2[1] ? e1 : e2; // elbows bend downward
  return [e[0], e[1], hx, hy];
}

function leg(c: Ctx, hipX: number, ang: number, col: string, seed: number): void {
  const hipY = -138;
  const kx = hipX - Math.sin(ang) * 62, ky = hipY + Math.cos(ang) * 62;
  const a2 = ang * 0.3;
  const ax = kx - Math.sin(a2) * 60, ay = ky + Math.cos(a2) * 60;
  limb(c, [[hipX, hipY], [kx, ky], [ax, ay]], 19, col, seed);
  const foot = ellipsePts(ax - 9, ay + 6, 16, 6.5, 14);
  wash(c, foot, col, seed + 4, 0.95, 0.3, 2);
  inkLine(c, foot, seed + 5, 0.3, 1.2);
  for (let k = 0; k < 3; k++) inkLine(c, [[ax - 20 + k * 3, ay + 2], [ax - 21 + k * 3, ay + 6]], seed + 6 + k, 0.1, 0.5);
}

function arm(c: Ctx, sx: number, sy: number, hx: number, hy: number, col: string, seed: number): void {
  const [ex, ey, hx2, hy2] = joint(sx, sy, hx, hy, 52, 50);
  // short black sleeve over the top of the upper arm
  const mx = sx + (ex - sx) * 0.45, my = sy + (ey - sy) * 0.45;
  limb(c, [[sx, sy], [ex, ey], [hx2, hy2]], 13, col, seed);
  limb(c, [[sx, sy], [mx, my]], 19, B.shirt, seed + 2);
  const hand = ellipsePts(hx2, hy2, 6.5, 6, 12);
  wash(c, hand, col, seed + 4, 0.95, 0.2, 2);
  inkLine(c, hand, seed + 5, 0.3, 1.1);
}

export function drawBentzi(c: Ctx, fx: number, fy: number, bladeX: number, bladeY: number, p: Pose, t: number): void {
  c.save();
  c.translate(fx, fy);
  c.rotate(p.lean);
  if (p.zap) {
    const g = c.createRadialGradient(0, -150, 10, 0, -150, 170);
    g.addColorStop(0, 'rgba(255,236,120,0.55)');
    g.addColorStop(1, 'rgba(255,236,120,0)');
    c.fillStyle = g;
    c.fillRect(-170, -320, 340, 330);
  }
  const sw = p.swing;
  const ph = Math.sin(p.walk) * 0.28;
  // squeegee geometry (relative to the feet)
  const cl = Math.cos(-p.lean), sl = Math.sin(-p.lean);
  const rbx = bladeX - fx, rby = bladeY - fy;
  const bx = rbx * cl - rby * sl, by = rbx * sl + rby * cl;
  const tx = -30 - sw * 16, ty = -204 + sw * 12;
  const along = (f: number): [number, number] => [tx + (bx - tx) * f, ty + (by - 6 - ty) * f];
  const [uhx, uhy] = along(0.05);
  const [lhx, lhy] = along(0.32);

  // far side first
  leg(c, 8, -ph, B.skinBack, 500);
  leg(c, -6, ph, B.skin, 540);

  // shorts
  const shorts: Pt[] = [[-38, -158], [34, -158], [37, -112], [8, -106], [0, -118], [-6, -106], [-40, -112]];
  wash(c, shorts, B.shorts, 560, 0.9, 0.5, 3);
  hatchPoly(c, shorts, 1, 3, 561, 0.6, 0.45);
  inkLine(c, shorts, 562, 0.5, 1.3, INK, true);
  inkLine(c, [[-36, -150], [34, -150]], 563, 0.4, 0.7);

  // torso: a round, stocky middle in a black tee
  const torso: Pt[] = [
    [10, -244], [26, -236], [34, -205], [33, -168], [36, -150], [-42, -150], [-49, -172], [-46, -200],
    [-36, -228], [-22, -240], [-10, -245],
  ];
  wash(c, torso, B.shirt, 570, 0.88, 0.4, 3);
  hatchPoly(c, torso, 1, 3.2, 571, 1.2, 0.3, 0.6);
  c.save();
  c.strokeStyle = 'rgba(243,233,210,0.35)';
  c.lineWidth = 1;
  c.beginPath(); c.arc(-14, -195, 28, -2.6, -1.6); c.stroke();
  c.beginPath(); c.moveTo(-40, -168); c.quadraticCurveTo(-20, -158, 20, -162); c.stroke();
  c.restore();
  inkLine(c, torso, 572, 0.6, 1.5, INK, true);

  // the squeegee: handle and blade
  inkLine(c, [[tx, ty], [bx, by - 8]], 580, 0.3, 4.5, '#c0502f');
  inkLine(c, [[tx, ty], [bx, by - 8]], 581, 0.3, 1);
  const blade: Pt[] = [[bx - 4, by - 14], [bx + 5, by - 14], [bx + 5, by - 3], [bx - 4, by - 3]];
  wash(c, blade, '#c0502f', 582, 0.95, 0.2, 2);
  inkLine(c, blade, 583, 0.2, 1, INK, true);
  inkLine(c, [[bx - 4, by - 2.5], [bx + 5, by - 2.5]], 584, 0.1, 3, '#222');

  // both arms over the handle (far arm a shade darker)
  arm(c, 10, -228, uhx, uhy, B.skinBack, 520);
  arm(c, -14, -228, lhx, lhy, B.skin, 590);

  // head
  const hx = -8, hy = -270;
  const bob = Math.sin(p.walk * 2) * 1.2;
  c.translate(0, bob);
  // neck
  limb(c, [[0, -244], [-4, -252]], 16, B.skin, 600);
  const ear = ellipsePts(hx + 17, hy + 2, 5, 7, 10);
  wash(c, ear, B.skin, 602, 0.9, 0.2, 1);
  inkLine(c, ear, 603, 0.3, 1.1);
  const head = ellipsePts(hx, hy, 22, 25, 28);
  wash(c, head, B.skin, 604, 0.92, 0.4, 3);
  hatchPoly(c, ellipsePts(hx + 9, hy + 4, 13, 20, 16), 1, 2.6, 605, 0.9, 0.22);
  inkLine(c, head, 606, 0.5, 1.5, INK, true);
  if (p.zap) {
    const r = rng(Math.floor(t * 20));
    const spikes: Pt[] = [];
    for (let k = 0; k <= 14; k++) {
      const a = Math.PI + (k / 14) * Math.PI;
      const rr = k % 2 ? 40 + r() * 10 : 23;
      spikes.push([hx + Math.cos(a) * rr, hy - 4 + Math.sin(a) * rr]);
    }
    wash(c, spikes, B.hair, 607, 0.9, 0.3, 2);
    inkLine(c, spikes, 608, 0.6, 1.2, INK, true);
  } else {
    const hair: Pt[] = [...ellipsePts(hx + 1, hy - 3, 23, 24, 18, Math.PI * 1.06, Math.PI * 2.06), [hx + 19, hy - 2], [hx + 7, hy - 14], [hx - 16, hy - 14]];
    wash(c, hair, B.hair, 609, 0.92, 0.3, 3);
    hatchPoly(c, hair, 2, 2.2, 610, -0.4, 0.45);
    inkLine(c, hair, 611, 0.4, 1.2, INK, true);
    // sunglasses pushed up on the head
    const g1 = ellipsePts(hx - 11, hy - 21, 7.5, 4.5, 12), g2 = ellipsePts(hx + 5, hy - 23, 6.5, 4.5, 12);
    for (const [g, sd] of [[g1, 612], [g2, 614]] as [Pt[], number][]) {
      wash(c, g, '#1e1e22', sd, 0.95, 0.1, 2);
      inkLine(c, g, sd + 1, 0.2, 1.1);
    }
    inkLine(c, [[hx - 3.5, hy - 22], [hx - 1.5, hy - 22.5]], 616, 0.1, 1.4);
    inkLine(c, [[hx + 11.5, hy - 23], [hx + 18, hy - 16]], 617, 0.2, 1.2);
  }
  // full beard wrapping the jaw
  const beard: Pt[] = [
    [hx + 16, hy - 4], [hx + 15, hy + 12], [hx + 6, hy + 26], [hx - 10, hy + 30], [hx - 24, hy + 22],
    [hx - 26, hy + 8], [hx - 18, hy + 7], [hx - 9, hy + 4], [hx + 2, hy + 7], [hx + 10, hy + 2],
  ];
  wash(c, beard, B.beard, 618, 0.92, 0.5, 3);
  hatchPoly(c, beard, 2, 2.2, 619, 1.1, 0.5);
  inkLine(c, beard, 620, 0.7, 1.2, INK, true);
  // big grin
  const open = p.zap ? 9 : 5 + sw * 2.5;
  const mouth: Pt[] = [[hx - 22, hy + 10], [hx - 6, hy + 11], [hx - 9, hy + 11 + open], [hx - 19, hy + 10 + open * 0.8]];
  wash(c, mouth, '#7a2a22', 621, 0.95, 0.1, 1);
  wash(c, [[hx - 21, hy + 10.3], [hx - 6.5, hy + 11.3], [hx - 7, hy + 13.4], [hx - 20.5, hy + 12.4]], '#fffaf0', 622, 0.95, 0.1, 1);
  inkLine(c, mouth, 623, 0.3, 1.1, INK, true);
  // nose and cheek
  const nose: Pt[] = [[hx - 17, hy - 6], [hx - 28, hy + 4], [hx - 24, hy + 7], [hx - 16, hy + 5]];
  wash(c, nose, '#dc9c7a', 624, 0.9, 0.2, 1);
  inkLine(c, nose, 625, 0.3, 1.2);
  c.fillStyle = 'rgba(214,110,90,0.32)';
  c.beginPath(); c.arc(hx - 5, hy + 2, 5, 0, Math.PI * 2); c.fill();
  // eye and brow
  if (p.zap) {
    inkLine(c, ellipsePts(hx - 12, hy - 8, 4.5, 5, 10), 626, 0.2, 1.2);
    c.fillStyle = INK; c.fillRect(hx - 13, hy - 9, 2.4, 2.4);
  } else {
    c.fillStyle = INK;
    c.beginPath(); c.ellipse(hx - 13, hy - 7, 2, 2.7, 0, 0, Math.PI * 2); c.fill();
    inkLine(c, [[hx - 18, hy - 14], [hx - 7, hy - 16]], 627, 0.2, 1.8);
    inkLine(c, [[hx - 15, hy - 2], [hx - 9, hy - 1.5]], 628, 0.2, 0.7);
  }
  c.restore();
}
