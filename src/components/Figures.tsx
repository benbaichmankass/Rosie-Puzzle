/**
 * Illustrated sleepers, drawn in "cell units": one grid square = S units.
 *
 * Bodies are built from a pose's cells as a skeleton (head -> torso -> hips
 * -> legs, hands off the torso). Faces are drawn, not photos, with features
 * taken from the real people and Rosie. One animation clock drives every
 * part of a figure, so breathing, head roll, twitches and Zzz stay in sync.
 */
import React, { useEffect, useId, useState } from 'react';
import { DogCellT, Pose, PoseCell } from '../utils/puzzle';

export const S = 100;
export type Who = 'boyfriend' | 'girlfriend';

type Pt = { x: number; y: number };
const center = (r: number, c: number): Pt => ({ x: (c + 0.5) * S, y: (r + 0.5) * S });
const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const add = (a: Pt, b: Pt, k = 1): Pt => ({ x: a.x + b.x * k, y: a.y + b.y * k });
const norm = (a: Pt, b: Pt): Pt => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = Math.hypot(dx, dy) || 1;
  return { x: dx / l, y: dy / l };
};
const perp = (v: Pt): Pt => ({ x: -v.y, y: v.x });
const rot = (p: Pt, o: Pt, deg: number): Pt => {
  const a = (deg * Math.PI) / 180;
  const dx = p.x - o.x;
  const dy = p.y - o.y;
  return { x: o.x + dx * Math.cos(a) - dy * Math.sin(a), y: o.y + dx * Math.sin(a) + dy * Math.cos(a) };
};
const poly = (pts: Pt[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
const angle = (v: Pt) => (Math.atan2(v.y, v.x) * 180) / Math.PI;

// ---------------------------------------------------------------------------
// One shared clock (~30fps) for all figures
// ---------------------------------------------------------------------------
const listeners = new Set<(t: number) => void>();
let rafId = 0;
let last = 0;
const reduceMotion =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
function tick(now: number) {
  if (now - last > 33) {
    last = now;
    listeners.forEach((fn) => fn(now / 1000));
  }
  rafId = requestAnimationFrame(tick);
}
function useClock(active = true) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!active || reduceMotion) return;
    listeners.add(setT);
    if (!rafId) rafId = requestAnimationFrame(tick);
    return () => {
      listeners.delete(setT);
      if (!listeners.size) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    };
  }, [active]);
  return t;
}
/** 0..1 bump that fires for `len` seconds once every `period` seconds. */
const pulse = (t: number, period: number, offset: number, len: number) => {
  const u = (((t + offset) % period) + period) % period;
  return u < len ? Math.sin((u / len) * Math.PI) : 0;
};

// ---------------------------------------------------------------------------
// Looks
// ---------------------------------------------------------------------------
export interface Look {
  skin: string;
  skinShade: string;
  hair: string;
  beard: string;
  brow: string;
  shirt: string;
  shirtShade: string;
  pants: string;
  sock: string;
  ring: string;
  build: number;
  /** Pajama print: stripes or polka dots in `mark` on the `shirt` colour, trimmed with `piping`. */
  pattern: 'stripes' | 'dots';
  mark: string;
  piping: string;
}

export const LOOKS: Record<Who, Look> = {
  // Bentzi: fair skin, short light-brown hair, trimmed brown beard, sunglasses
  // pushed up on his head; navy striped pajamas.
  boyfriend: {
    skin: '#f3c6a6', skinShade: '#e3a985', hair: '#8a6547', beard: '#7a5537', brow: '#6e4c33',
    shirt: '#3b5b92', shirtShade: '#2c4675', pants: '#3b5b92', sock: '#f2c14e', ring: '#4a6fb0', build: 1.12,
    pattern: 'stripes', mark: '#a9c6ee', piping: '#f6efe2',
  },
  // Shai: olive skin, dark buzz cut, thick brows, full dark beard, earring;
  // lavender polka-dot pajamas.
  girlfriend: {
    skin: '#d9a07a', skinShade: '#c3865f', hair: '#2a201b', beard: '#2b211c', brow: '#231a16',
    shirt: '#a48fd8', shirtShade: '#8a73c6', pants: '#a48fd8', sock: '#f08a8a', ring: '#8a73c6', build: 1,
    pattern: 'dots', mark: '#ffffff', piping: '#5f48a6',
  },
};
/** Back-compat for the pose picker chips. */
export const PALETTES = LOOKS;

// ---------------------------------------------------------------------------
// Faces (local coords: centre 0,0; chin points +y)
// ---------------------------------------------------------------------------
function BentziFace({ look, snore }: { look: Look; snore: number }) {
  return (
    <g>
      <circle cx={-31} cy={3} r={8} fill={look.skin} />
      <circle cx={31} cy={3} r={8} fill={look.skin} />
      <circle cx={-31} cy={3} r={4} fill={look.skinShade} />
      <circle cx={31} cy={3} r={4} fill={look.skinShade} />
      <ellipse cx={0} cy={0} rx={30} ry={33} fill={look.skin} />
      {/* messy hair */}
      <path d="M-30 -6 Q-32 -31 -12 -35 Q0 -38 12 -35 Q32 -31 30 -6 Q27 -20 18 -25 Q10 -21 0 -24 Q-10 -21 -18 -25 Q-27 -20 -30 -6 Z" fill={look.hair} />
      {/* sunglasses pushed up */}
      <g transform="translate(0 -28)">
        <path d="M-27 2 L27 2" stroke="#1d1d22" strokeWidth={3} />
        <rect x={-24} y={-6} width={20} height={13} rx={6} fill="#1d1d22" />
        <rect x={4} y={-6} width={20} height={13} rx={6} fill="#1d1d22" />
        <rect x={-20} y={-4} width={7} height={3} rx={1.5} fill="#ffffff" opacity={0.35} />
        <rect x={8} y={-4} width={7} height={3} rx={1.5} fill="#ffffff" opacity={0.35} />
      </g>
      {/* brows + closed eyes */}
      <path d="M-20 -11 Q-12 -15 -5 -11" stroke={look.brow} strokeWidth={3.5} strokeLinecap="round" fill="none" />
      <path d="M5 -11 Q12 -15 20 -11" stroke={look.brow} strokeWidth={3.5} strokeLinecap="round" fill="none" />
      <path d="M-18 -3 Q-12 2 -6 -3" stroke="#5a3a28" strokeWidth={2.6} strokeLinecap="round" fill="none" />
      <path d="M6 -3 Q12 2 18 -3" stroke="#5a3a28" strokeWidth={2.6} strokeLinecap="round" fill="none" />
      <circle cx={-19} cy={7} r={5} fill="#f08f7a" opacity={0.35} />
      <circle cx={19} cy={7} r={5} fill="#f08f7a" opacity={0.35} />
      <path d="M-4 5 Q0 9 4 5" stroke={look.skinShade} strokeWidth={2.5} strokeLinecap="round" fill="none" />
      {/* full beard with grey flecks */}
      <path d="M-29 2 Q-29 28 0 35 Q29 28 29 2 Q24 12 14 13 Q6 10 0 12 Q-6 10 -14 13 Q-24 12 -29 2 Z" fill={look.beard} />
      <path d="M-12 14 Q0 9 12 14 Q6 17 0 15 Q-6 17 -12 14 Z" fill={look.beard} />
      {[[-18, 22], [-8, 30], [10, 28], [20, 19], [2, 34]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={1.6} fill="#c9b8a6" opacity={0.7} />
      ))}
      <ellipse cx={0} cy={20} rx={5} ry={1.5 + snore * 2.5} fill="#7a3b2e" />
    </g>
  );
}

function ShaiFace({ look, snore }: { look: Look; snore: number }) {
  return (
    <g>
      <circle cx={-31} cy={2} r={8.5} fill={look.skin} />
      <circle cx={31} cy={2} r={8.5} fill={look.skin} />
      <circle cx={-31} cy={2} r={4.5} fill={look.skinShade} />
      <circle cx={31} cy={2} r={4.5} fill={look.skinShade} />
      <circle cx={33} cy={11} r={2.4} fill="#e6e8ee" stroke="#9aa0ad" strokeWidth={1} />
      <ellipse cx={0} cy={0} rx={30} ry={33} fill={look.skin} />
      {/* buzz cut: short dark cap */}
      <path d="M-29 -10 Q-30 -34 0 -35 Q30 -34 29 -10 Q22 -24 0 -25 Q-22 -24 -29 -10 Z" fill={look.hair} />
      <path d="M-29 -10 Q-30 -34 0 -35 Q30 -34 29 -10" fill="none" stroke={look.hair} strokeWidth={3} opacity={0.5} />
      {/* thick brows + closed eyes */}
      <path d="M-22 -11 Q-13 -17 -4 -11" stroke={look.brow} strokeWidth={5.5} strokeLinecap="round" fill="none" />
      <path d="M4 -11 Q13 -17 22 -11" stroke={look.brow} strokeWidth={5.5} strokeLinecap="round" fill="none" />
      <path d="M-18 -3 Q-12 2 -6 -3" stroke="#3a2618" strokeWidth={2.8} strokeLinecap="round" fill="none" />
      <path d="M6 -3 Q12 2 18 -3" stroke="#3a2618" strokeWidth={2.8} strokeLinecap="round" fill="none" />
      <path d="M-4 6 Q0 10 4 6" stroke={look.skinShade} strokeWidth={2.5} strokeLinecap="round" fill="none" />
      {/* full dark beard, smile line showing */}
      <path d="M-30 -2 Q-31 32 0 39 Q31 32 30 -2 Q25 10 15 12 Q6 10 0 12 Q-6 10 -15 12 Q-25 10 -30 -2 Z" fill={look.beard} />
      <path d="M-13 13 Q0 8 13 13 Q6 16 0 14 Q-6 16 -13 13 Z" fill={look.beard} />
      <path d="M-9 19 Q0 25 9 19" stroke="#f3ece4" strokeWidth={3.2 - snore} strokeLinecap="round" fill="none" />
    </g>
  );
}

function RosieFace({ ear }: { ear: number }) {
  const black = '#1f1e22';
  return (
    <g>
      {/* folded black ears, one flicks now and then */}
      <path d={`M-16 6 Q-34 ${4 + ear * 6} -32 22 Q-24 22 -12 14 Z`} fill={black} />
      <path d="M16 6 Q34 4 32 22 Q24 22 12 14 Z" fill={black} />
      {/* black skull */}
      <ellipse cx={0} cy={6} rx={24} ry={22} fill={black} />
      {/* muzzle (points away from the body) */}
      <path d="M-14 -4 Q-15 -30 -6 -40 Q0 -44 6 -40 Q15 -30 14 -4 Z" fill="#f4f1ec" />
      {[[-7, -22], [6, -18], [-3, -30], [8, -28], [-9, -12], [3, -10]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={1.8} fill="#8e8a88" opacity={0.75} />
      ))}
      {/* white blaze up the forehead */}
      <path d="M-5 -4 Q0 10 0 18 Q0 10 5 -4 Z" fill="#f4f1ec" />
      <ellipse cx={0} cy={-41} rx={7} ry={5} fill={black} />
      {/* sleepy closed eyes */}
      <path d="M-15 0 Q-11 4 -7 0" stroke="#bdb6b1" strokeWidth={2.4} strokeLinecap="round" fill="none" />
      <path d="M7 0 Q11 4 15 0" stroke="#bdb6b1" strokeWidth={2.4} strokeLinecap="round" fill="none" />
      {/* red collar */}
      <path d="M-20 24 Q0 32 20 24" stroke="#d93a3a" strokeWidth={7} strokeLinecap="round" fill="none" />
      <circle cx={0} cy={31} r={3.5} fill="#e9c46a" />
    </g>
  );
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------
function legChains(cells: PoseCell[], hipsIdx: number): number[][] {
  const kids = (i: number) => cells.map((c, j) => (c.parent === i && c.part === 'leg' ? j : -1)).filter((j) => j >= 0);
  const chains: number[][] = [];
  const walk = (i: number, path: number[]) => {
    const k = kids(i);
    if (!k.length) return chains.push(path);
    k.forEach((j) => walk(j, [...path, j]));
  };
  kids(hipsIdx).forEach((j) => walk(j, [j]));
  return chains;
}

function Zzz({ at, up, side, t, phase }: { at: Pt; up: Pt; side: Pt; t: number; phase: number }) {
  return (
    <g style={{ pointerEvents: 'none' }}>
      {[0, 1, 2].map((k) => {
        const u = (t * 0.33 + k / 3 + phase) % 1;
        const p = add(add(at, up, 34 + 46 * u), side, 22 + 14 * Math.sin(u * 6));
        return (
          <text key={k} x={p.x} y={p.y} fontSize={13 + 11 * u} fontWeight={800} fill="#7c6bb0" opacity={Math.sin(u * Math.PI) * 0.9} textAnchor="middle">
            z
          </text>
        );
      })}
    </g>
  );
}

export function PersonFigure({
  pose,
  col = 0,
  who,
  sleeping = true,
  phase = 0,
}: {
  pose: Pose;
  col?: number;
  who: Who;
  sleeping?: boolean;
  phase?: number;
}) {
  const t = useClock(sleeping);
  const look = LOOKS[who];
  const breath = sleeping ? Math.sin((t / 4.2 + phase) * Math.PI * 2) : 0;
  const roll = sleeping ? Math.sin(t * 0.45 + phase * 7) * 4 : 0;
  const twitch = sleeping ? pulse(t, 9, phase * 9, 0.9) : 0;
  const handTwitch = sleeping ? pulse(t, 11, phase * 5 + 4, 0.7) : 0;

  const cells = pose.cells;
  const pt = (i: number) => center(cells[i].r, cells[i].c + col);
  const torsoIdx = cells.findIndex((c) => c.part === 'torso');
  const hipsIdx = cells.findIndex((c) => c.part === 'hips');
  const H0 = pt(0);
  const T = pt(torsoIdx);
  const hipsC = pt(hipsIdx);
  const axis0 = norm(H0, T);
  // Chest rises a little toward the head on each breath; head rides along.
  const Sh = add(lerp(H0, T, 0.6), axis0, -1.6 * breath);
  const H = add(H0, axis0, -1.0 * breath);
  const P = lerp(T, hipsC, 0.85);
  const axis = norm(Sh, P);
  const side = perp(axis);
  const chestW = 58 * look.build + 3 * breath;

  const hands = cells.map((c, i) => (c.part === 'hand' ? i : -1)).filter((i) => i >= 0);
  const chains = legChains(cells, hipsIdx);

  // Legs (pants), with the last segment twitching during a dream.
  type Leg = { pts: Pt[]; w: number };
  const legs: Leg[] = [];
  if (chains.length === 0) {
    const knee = add(P, side, 26);
    const foot = add(knee, axis, -8);
    legs.push({ pts: [add(P, side, -10), add(knee, side, -14), foot], w: 22 });
    legs.push({ pts: [add(P, side, 10), knee, add(foot, side, 9)], w: 22 });
  } else if (chains.length === 1) {
    const path = [P, ...chains[0].map(pt)];
    for (const off of [-12, 12]) {
      legs.push({
        pts: path.map((p, i) => {
          const dir = i === 0 ? norm(path[0], path[1]) : norm(path[i - 1], path[i]);
          return add(p, perp(dir), off);
        }),
        w: 22,
      });
    }
  } else {
    chains.forEach((ch) => legs.push({ pts: [P, ...ch.map(pt)], w: 25 }));
  }
  if (twitch && legs.length) {
    const L = legs[legs.length - 1];
    const n = L.pts.length;
    L.pts[n - 1] = rot(L.pts[n - 1], L.pts[n - 2], 9 * twitch);
  }

  // Arms: shoulder -> bent elbow -> hand. Free arms rest by the hips.
  type Arm = { sh: Pt; el: Pt; hand: Pt };
  const sideOf = (p: Pt) => ((p.x - Sh.x) * side.x + (p.y - Sh.y) * side.y >= 0 ? 1 : -1);
  const arms: Arm[] = hands.map((h, k) => {
    const s = sideOf(pt(h));
    const sh = add(Sh, side, 24 * look.build * s);
    let hand = lerp(sh, pt(h), 0.95);
    if (k === 0 && handTwitch) hand = rot(hand, sh, 6 * handTwitch * s);
    const el = add(lerp(sh, hand, 0.5), perp(norm(sh, hand)), 9 * s);
    return { sh, el, hand };
  });
  const used: number[] = hands.map((h) => sideOf(pt(h)));
  for (const s of [-1, 1]) {
    if (arms.length >= 2 || used.includes(s)) continue;
    const sh = add(Sh, side, 26 * look.build * s);
    const hand = add(lerp(Sh, P, 0.78), side, 31 * s);
    const el = add(lerp(sh, hand, 0.5), side, 8 * s);
    arms.push({ sh, el, hand });
  }

  // The head lines up with the neck (head -> chest), not the whole body.
  const faceRot = angle(axis0) - 90 + roll;

  const uid = useId().replace(/:/g, '');
  const pj = `url(#pj-${uid})`;
  const bodyAngle = angle(axis0) + 90;
  const chestDir = axis0;
  const hem = lerp(T, P, 0.58);
  const lapel = (s: 1 | -1) =>
    poly([add(Sh, side, 4 * s), add(add(Sh, side, 17 * s), chestDir, -2), add(add(Sh, side, 9 * s), chestDir, 15)]) + ' Z';
  const pocketC = add(add(lerp(Sh, T, 0.45), side, 15), chestDir, 2);

  return (
    <g>
      <defs>
        {look.pattern === 'stripes' ? (
          <pattern id={`pj-${uid}`} width={14} height={14} patternUnits="userSpaceOnUse" patternTransform={`rotate(${bodyAngle})`}>
            <rect width={14} height={14} fill={look.shirt} />
            <rect x={0} width={4} height={14} fill={look.mark} opacity={0.9} />
          </pattern>
        ) : (
          <pattern id={`pj-${uid}`} width={16} height={16} patternUnits="userSpaceOnUse" patternTransform={`rotate(${bodyAngle})`}>
            <rect width={16} height={16} fill={look.shirt} />
            <circle cx={4} cy={4} r={2.4} fill={look.mark} />
            <circle cx={12} cy={12} r={2.4} fill={look.mark} />
          </pattern>
        )}
      </defs>
      <path d={poly([H, Sh, T, P])} stroke="rgba(70,40,20,0.10)" strokeWidth={74} strokeLinecap="round" strokeLinejoin="round" fill="none" transform="translate(4 7)" />

      {/* pajama bottoms with piped ankle cuffs */}
      {legs.map((l, i) => (
        <path key={i} d={poly(l.pts)} stroke={look.shirtShade} strokeWidth={l.w + 3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      ))}
      {legs.map((l, i) => (
        <path key={`pj${i}`} d={poly(l.pts)} stroke={pj} strokeWidth={l.w} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      ))}
      {legs.map((l, i) => {
        const n = l.pts.length;
        const end = l.pts[n - 1];
        const prev = l.pts[n - 2];
        return <path key={`c${i}`} d={poly([lerp(prev, end, 0.8), lerp(prev, end, 0.93)])} stroke={look.piping} strokeWidth={l.w + 1} strokeLinecap="butt" fill="none" />;
      })}
      {legs.map((l, i) => {
        const end = l.pts[l.pts.length - 1];
        const dir = norm(l.pts[l.pts.length - 2], end);
        const foot = add(end, dir, 9);
        return (
          <g key={`f${i}`} transform={`rotate(${angle(dir)} ${foot.x} ${foot.y})`}>
            <ellipse cx={foot.x} cy={foot.y} rx={15} ry={10.5} fill={look.sock} stroke="rgba(0,0,0,0.12)" strokeWidth={2} />
            <path d={`M${foot.x - 7} ${foot.y - 9} L${foot.x - 7} ${foot.y + 9}`} stroke="rgba(255,255,255,0.6)" strokeWidth={3} />
          </g>
        );
      })}

      {/* pajama top: button-up with piped collar, placket, pocket and hem */}
      <path d={poly([Sh, T, P])} stroke={look.shirtShade} strokeWidth={chestW + 3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d={poly([Sh, T, P])} stroke={pj} strokeWidth={chestW} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d={poly([add(hem, side, -chestW / 2 + 2), add(hem, side, chestW / 2 - 2)])} stroke={look.piping} strokeWidth={4} strokeLinecap="round" />
      <path d={poly([add(Sh, chestDir, 12), T, hem])} stroke={look.piping} strokeWidth={3} fill="none" strokeLinejoin="round" />
      {[0.3, 0.6, 0.9].map((u) => {
        const b = lerp(add(Sh, chestDir, 14), hem, u);
        return <circle key={u} cx={b.x} cy={b.y} r={3.2} fill="#ffffff" stroke={look.shirtShade} strokeWidth={1} />;
      })}
      <rect x={pocketC.x - 7} y={pocketC.y - 6} width={14} height={12} rx={2} fill="none" stroke={look.piping} strokeWidth={2.2} transform={`rotate(${bodyAngle - 90} ${pocketC.x} ${pocketC.y})`} />
      {/* V-neck and lapels */}
      <path d={poly([add(Sh, side, -6), add(Sh, chestDir, 12), add(Sh, side, 6)]) + ' Z'} fill={look.skin} />
      <path d={lapel(-1)} fill={look.piping} />
      <path d={lapel(1)} fill={look.piping} />

      {/* long pajama sleeves with piped cuffs */}
      {arms.map((a, i) => (
        <g key={i}>
          <path d={poly([a.sh, a.el, lerp(a.el, a.hand, 0.84)])} stroke={look.shirtShade} strokeWidth={22} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d={poly([a.sh, a.el, lerp(a.el, a.hand, 0.84)])} stroke={pj} strokeWidth={19} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d={poly([lerp(a.el, a.hand, 0.66), lerp(a.el, a.hand, 0.82)])} stroke={look.piping} strokeWidth={20} strokeLinecap="butt" fill="none" />
          <circle cx={a.hand.x} cy={a.hand.y} r={10} fill={look.skin} stroke={look.skinShade} strokeWidth={2} />
        </g>
      ))}

      <path d={poly([H, lerp(H, Sh, 0.85)])} stroke={look.skinShade} strokeWidth={20} strokeLinecap="round" />
      <g transform={`translate(${H.x} ${H.y}) rotate(${faceRot})`}>
        <ellipse cx={3} cy={5} rx={36} ry={38} fill="rgba(60,30,10,0.14)" />
        {who === 'boyfriend' ? <BentziFace look={look} snore={(breath + 1) / 2} /> : <ShaiFace look={look} snore={(breath + 1) / 2} />}
      </g>
      {sleeping && <Zzz at={H} up={{ x: -axis0.x, y: -axis0.y }} side={perp(axis0)} t={t} phase={phase} />}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Rosie: mostly white with grey ticking, black head with a white blaze
// ---------------------------------------------------------------------------
export function DogFigure({ cells, grumpy, growling = false }: { cells: DogCellT[]; grumpy: number; growling?: boolean }) {
  const t = useClock(true);
  const breath = Math.sin((t / 3.1) * Math.PI * 2);
  const ear = pulse(t, 6.5, 2, 0.5);
  const paddle = pulse(t, 8, 5, 1.4);
  const wag = grumpy || growling ? 0 : Math.sin(t * 2.2) * 14;

  const pts = cells.map((c) => center(c.r, c.c));
  const H = pts[0];
  const white = '#f7f4ee';
  const edge = '#d6ccbe';
  const edges = cells
    .map((c, i) => (c.parent >= 0 ? { from: c.parent, to: i, part: c.part } : null))
    .filter(Boolean) as { from: number; to: number; part: string }[];
  const bodyEdges = edges.filter((e) => e.part !== 'paw');
  const legEdges = edges.filter((e) => e.part === 'paw');
  const isTrunk = (i: number) => i !== 0 && cells[i].part !== 'paw';
  // A leg runs from the body out to a paw about two thirds into its square.
  const legs = legEdges.map((e, i) => {
    const dir = norm(pts[e.from], pts[e.to]);
    const n = perp(dir);
    const sway = (i % 2 ? 1 : -1) * 5 * paddle;
    // A leg next to her head is a front paw stretched out beside her chin, not out of her skull.
    const side = e.from === 0 ? 20 : 0;
    const hip = add(add(pts[e.from], dir, e.from === 0 ? 4 : 18), n, side);
    const foot = add(add(add(pts[e.to], dir, 10), n, sway), n, side);
    const knee = add(add(lerp(hip, foot, 0.55), n, (i % 2 ? -1 : 1) * 6), dir, 0);
    return { dir, n, hip, knee, foot };
  });
  const firstChild = edges.find((e) => e.from === 0);
  const neck = firstChild ? norm(H, pts[firstChild.to]) : { x: 0, y: 1 };
  const bodyR = 39 + breath * 1.6;
  const faceRot = angle(neck) - 90;

  // Deterministic grey ticking spots per square
  const spots = cells.flatMap((c, i) =>
    !isTrunk(i)
      ? []
      : [0, 1, 2, 3, 4].map((k) => {
          const h = Math.sin((c.r * 31 + c.c * 17 + k * 7.3) * 12.9898) * 43758.5453;
          const f = h - Math.floor(h);
          const g = Math.sin(f * 999) * 0.5 + 0.5;
          return { x: pts[i].x + (f - 0.5) * 50, y: pts[i].y + (g - 0.5) * 50, r: 2 + f * 2.5 };
        })
  );
  const saddle = firstChild ? lerp(H, pts[firstChild.to], 0.5) : null;

  return (
    <g>
      <g transform="translate(4 7)" opacity={0.13}>
        {bodyEdges.map((e, i) => (
          <path key={i} d={poly([pts[e.from], pts[e.to]])} stroke="#3b1f0f" strokeWidth={78} strokeLinecap="round" fill="none" />
        ))}
        {legs.map((l, i) => (
          <path key={`ls${i}`} d={`M${l.hip.x} ${l.hip.y} Q${l.knee.x} ${l.knee.y} ${l.foot.x} ${l.foot.y}`} stroke="#3b1f0f" strokeWidth={30} strokeLinecap="round" fill="none" />
        ))}
      </g>
      {/* outline then white fur, filling every square she occupies */}
      {/* legs first, so the body covers where they join */}
      {legs.map((l, i) => {
        const d = `M${l.hip.x} ${l.hip.y} Q${l.knee.x} ${l.knee.y} ${l.foot.x} ${l.foot.y}`;
        return (
          <g key={`leg${i}`}>
            <path d={d} stroke={edge} strokeWidth={30} strokeLinecap="round" fill="none" />
            <path d={d} stroke={white} strokeWidth={25} strokeLinecap="round" fill="none" />
            {/* grey ticking down the leg */}
            <circle cx={(l.knee.x + l.foot.x) / 2} cy={(l.knee.y + l.foot.y) / 2} r={2.5} fill="#8f8a86" opacity={0.55} />
          </g>
        );
      })}
      {bodyEdges.map((e, i) => (
        <path key={`o${i}`} d={poly([pts[e.from], pts[e.to]])} stroke={edge} strokeWidth={2 * bodyR + 4} strokeLinecap="round" fill="none" />
      ))}
      {cells.map((c, i) => (!isTrunk(i) ? null : <circle key={`oc${i}`} cx={pts[i].x} cy={pts[i].y} r={bodyR + 2} fill={edge} />))}
      {bodyEdges.map((e, i) => (
        <path key={`w${i}`} d={poly([pts[e.from], pts[e.to]])} stroke={white} strokeWidth={2 * bodyR} strokeLinecap="round" fill="none" />
      ))}
      {cells.map((c, i) => (!isTrunk(i) ? null : <circle key={`wc${i}`} cx={pts[i].x} cy={pts[i].y} r={bodyR} fill={white} />))}
      {spots.map((s, i) => (
        <circle key={`s${i}`} cx={s.x} cy={s.y} r={s.r} fill="#8f8a86" opacity={0.55} />
      ))}
      {/* black saddle where the neck meets the body */}
      {saddle && <ellipse cx={saddle.x} cy={saddle.y} rx={30} ry={22} fill="#1f1e22" transform={`rotate(${angle(neck) + 90} ${saddle.x} ${saddle.y})`} />}

      {/* Rosie's big black spot on her rump, right above the tail */}
      {edges
        .filter((e) => e.part === 'tail')
        .map((e, i) => {
          const dir = norm(pts[e.from], pts[e.to]);
          const c = add(add(pts[e.to], dir, -4), perp(dir), 7);
          return (
            <ellipse
              key={`rump${i}`}
              cx={c.x}
              cy={c.y}
              rx={25}
              ry={21}
              fill="#1f1e22"
              transform={`rotate(${angle(dir)} ${c.x} ${c.y})`}
            />
          );
        })}

      {/* paws at the end of each leg, paddling while she dreams */}
      {legs.map((l, i) => {
        const c = add(l.foot, l.dir, 4);
        return (
          <g key={`p${i}`} transform={`rotate(${angle(l.dir) + 90} ${c.x} ${c.y})`}>
            <ellipse cx={c.x} cy={c.y} rx={15} ry={11} fill="#fffdf9" stroke="#b9ae9f" strokeWidth={2} />
            {[-5, 0, 5].map((o) => (
              <path key={o} d={`M${c.x + o} ${c.y - 10} V${c.y - 4}`} stroke="#b9ae9f" strokeWidth={1.8} strokeLinecap="round" />
            ))}
          </g>
        );
      })}
      {/* tail */}
      {edges
        .filter((e) => e.part === 'tail')
        .map((e, i) => {
          const dir = norm(pts[e.from], pts[e.to]);
          const a = add(pts[e.to], dir, 20);
          const b = rot(add(add(a, dir, 28), perp(dir), 22), a, wag);
          const mid = rot(add(add(a, dir, 26), perp(dir), -6), a, wag * 0.5);
          return (
            <g key={`t${i}`}>
              <path d={`M${a.x} ${a.y} Q${mid.x} ${mid.y} ${b.x} ${b.y}`} stroke={edge} strokeWidth={23} strokeLinecap="round" fill="none" />
              <path d={`M${a.x} ${a.y} Q${mid.x} ${mid.y} ${b.x} ${b.y}`} stroke={white} strokeWidth={19} strokeLinecap="round" fill="none" />
            </g>
          );
        })}

      <g transform={`translate(${H.x} ${H.y}) rotate(${faceRot}) scale(${1 + breath * 0.01})`}>
        <ellipse cx={3} cy={8} rx={28} ry={26} fill="rgba(60,30,10,0.14)" />
        <RosieFace ear={ear} />
      </g>
      {growling ? (
        <g>
          <rect x={H.x + 6} y={H.y - 66} width={78} height={34} rx={14} fill="#fff4e6" stroke="#d9480f" strokeWidth={3} />
          <text x={H.x + 45} y={H.y - 42} fontSize={22} fontWeight={900} fill="#d9480f" textAnchor="middle">GRRR</text>
        </g>
      ) : grumpy === 0 ? (
        <Zzz at={H} up={{ x: -neck.x, y: -neck.y }} side={perp(neck)} t={t} phase={0.4} />
      ) : (
        <text x={H.x + 24} y={H.y - 30} fontSize={26} fontWeight={800} fill="#d9480f">
          {grumpy >= 2 ? 'GRR' : '!'}
        </text>
      )}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Pose card / drag image
// ---------------------------------------------------------------------------
export function PoseShape({ pose, who, showCells = true }: { pose: Pose; who: Who; showCells?: boolean }) {
  return (
    <>
      {showCells &&
        pose.cells.map((c, i) => (
          <rect key={i} x={c.c * S + 4} y={c.r * S + 4} width={S - 8} height={S - 8} rx={14} fill="rgba(255,255,255,0.6)" stroke="rgba(120,80,40,0.28)" strokeDasharray="6 6" strokeWidth={2} />
        ))}
      <PersonFigure pose={pose} who={who} sleeping={false} />
    </>
  );
}

export const POSE_PAD = 12;
export function poseViewBox(pose: Pose) {
  return { x: -POSE_PAD, y: -POSE_PAD, w: pose.width * S + POSE_PAD * 2, h: pose.height * S + POSE_PAD * 2 };
}
