/**
 * Flat 2D cartoon art (bold dark outlines, flat colour fills, mid-century kitchen palette).
 * Everything is original SVG drawn in code.
 */
import React from 'react';
import { CHARACTERS } from '../../shared/characters';
import { itemById, type ItemKind, type Placed } from './logic/plata';

export const INK = '#231c2b';
export const P = {
  wall: '#6fb3ad',
  wallDark: '#5a9c96',
  tile: '#f3e6c8',
  tileLine: '#d9c79f',
  cabinet: '#e7a339',
  cabinetDark: '#c9862a',
  coral: '#e2674f',
  coralDark: '#bf4f3b',
  counter: '#f6efe0',
  counterEdge: '#d8ccb3',
  wood: '#b9783f',
  woodDark: '#8f5a2c',
  dough: '#f4dca6',
  doughHi: '#fff3d3',
  baked: '#d48a3a',
  bakedHi: '#eeb469',
  steel: '#cfd5dd',
  steelDark: '#9aa3ae',
  black: '#2b2733',
  cream: '#fdf6e7',
  pink: '#f08aa3',
  green: '#58b368',
  red: '#e0473a',
  purple: '#6c4f8f',
} as const;

const sw = 3;

export type Mood = 'calm' | 'worried' | 'happy';

/** Upper body of a person (head centre at 0,0). Bentzi is stocky, Shai slimmer. */
export function Person({ who, mood = 'calm', x = 0, y = 0, s = 1, flip = false }: { who: 'bentzi' | 'shai'; mood?: Mood; x?: number; y?: number; s?: number; flip?: boolean }) {
  const c = CHARACTERS[who].colors;
  const bentzi = who === 'bentzi';
  const hw = bentzi ? 40 : 33; // head half-width
  const hh = bentzi ? 45 : 47;
  const shoulders = bentzi ? 66 : 52;
  const browY = mood === 'worried' ? -20 : -22;
  const mouth =
    mood === 'worried'
      ? <path d={`M -12 ${bentzi ? 28 : 30} Q 0 ${bentzi ? 22 : 24} 12 ${bentzi ? 28 : 30}`} fill="none" stroke={INK} strokeWidth={sw} strokeLinecap="round" />
      : <path d={`M -15 ${bentzi ? 22 : 24} Q 0 ${bentzi ? 40 : 42} 15 ${bentzi ? 22 : 24} Z`} fill="#fff" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />;
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      {/* torso */}
      <path
        d={`M ${-shoulders} 170 L ${-shoulders + 4} 78 Q ${-shoulders + 10} 50 -18 44 L 18 44 Q ${shoulders - 10} 50 ${shoulders - 4} 78 L ${shoulders} 170 Z`}
        fill={c.shirt}
        stroke={INK}
        strokeWidth={sw}
        strokeLinejoin="round"
      />
      {/* sleeve seams */}
      <path d={`M ${-shoulders + 6} 104 Q ${-shoulders + 18} 96 ${-shoulders + 26} 82`} fill="none" stroke={bentzi ? '#46424f' : '#a99a76'} strokeWidth={2.5} />
      <path d={`M ${shoulders - 6} 104 Q ${shoulders - 18} 96 ${shoulders - 26} 82`} fill="none" stroke={bentzi ? '#46424f' : '#a99a76'} strokeWidth={2.5} />
      {!bentzi && <path d="M -6 88 l 5 -6 l 7 4 l -2 8 z" fill="#8a7b58" stroke={INK} strokeWidth={1.5} />}
      {/* neck */}
      <path d={`M -13 26 L -13 50 Q 0 58 13 50 L 13 26 Z`} fill={c.skin} stroke={INK} strokeWidth={sw} />
      {/* ears */}
      <ellipse cx={-hw} cy={-2} rx={8} ry={11} fill={c.skin} stroke={INK} strokeWidth={sw} />
      <ellipse cx={hw} cy={-2} rx={8} ry={11} fill={c.skin} stroke={INK} strokeWidth={sw} />
      {/* head */}
      <ellipse cx={0} cy={0} rx={hw} ry={hh} fill={c.skin} stroke={INK} strokeWidth={sw} />
      {/* beard */}
      {bentzi ? (
        <path
          d={`M ${-hw + 1} -4 Q ${-hw - 2} 34 -18 48 Q 0 60 18 48 Q ${hw + 2} 34 ${hw - 1} -4 Q ${hw - 8} 14 18 16 Q 0 10 -18 16 Q ${-hw + 8} 14 ${-hw + 1} -4 Z`}
          fill={c.beard}
          stroke={INK}
          strokeWidth={sw}
          strokeLinejoin="round"
        />
      ) : (
        <path
          d={`M ${-hw + 1} 0 Q ${-hw + 2} 34 -14 46 Q 0 52 14 46 Q ${hw - 2} 34 ${hw - 1} 0 Q ${hw - 5} 26 12 30 Q 0 20 -12 30 Q ${-hw + 5} 26 ${-hw + 1} 0 Z`}
          fill={c.beard}
          stroke={INK}
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
      )}
      {mouth}
      {/* moustache */}
      <path d={`M -16 ${bentzi ? 19 : 21} Q -8 ${bentzi ? 11 : 15} 0 ${bentzi ? 16 : 18} Q 8 ${bentzi ? 11 : 15} 16 ${bentzi ? 19 : 21}`} fill={c.beard} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
      {/* nose: long cartoon nose */}
      <path d={`M 2 -14 Q 6 2 12 8 Q 6 13 -3 11`} fill={c.skin} stroke={INK} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {/* eyes */}
      <ellipse cx={-14} cy={-10} rx={4} ry={mood === 'happy' ? 2.5 : 5} fill={INK} />
      <ellipse cx={14} cy={-10} rx={4} ry={mood === 'happy' ? 2.5 : 5} fill={INK} />
      {mood === 'worried' && (
        <>
          <path d="M -21 -13 L -7 -13" stroke={c.skin} strokeWidth={4} />
          <path d="M 7 -13 L 21 -13" stroke={c.skin} strokeWidth={4} />
          <path d="M -22 -13 L -7 -13 M 7 -13 L 22 -13" stroke={INK} strokeWidth={2} />
        </>
      )}
      {/* brows */}
      <path d={mood === 'worried' ? `M -22 ${browY} L -7 ${browY - 6}` : `M -22 ${browY} Q -14 ${browY - 5} -7 ${browY}`} stroke={c.hair} strokeWidth={4.5} strokeLinecap="round" fill="none" />
      <path d={mood === 'worried' ? `M 22 ${browY} L 7 ${browY - 6}` : `M 22 ${browY} Q 14 ${browY - 5} 7 ${browY}`} stroke={c.hair} strokeWidth={4.5} strokeLinecap="round" fill="none" />
      {/* hair */}
      {bentzi ? (
        <path
          d={`M ${-hw + 2} -16 Q ${-hw - 2} -52 0 -${hh + 2} Q ${hw + 2} -52 ${hw - 2} -16 Q ${hw - 6} -32 ${hw - 14} -34 Q 0 -30 ${-hw + 14} -34 Q ${-hw + 6} -32 ${-hw + 2} -16 Z`}
          fill={c.hair}
          stroke={INK}
          strokeWidth={sw}
          strokeLinejoin="round"
        />
      ) : (
        <path d={`M ${-hw + 2} -18 Q ${-hw} -48 0 -${hh + 1} Q ${hw} -48 ${hw - 2} -18 Q 0 -36 ${-hw + 2} -18 Z`} fill={c.hair} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
      )}
      {/* sunglasses pushed up on the head */}
      <g transform={`translate(0 ${-hh + 6})`}>
        <path d="M -8 0 Q 0 -5 8 0" stroke={INK} strokeWidth={3} fill="none" />
        <rect x={-27} y={-6} width={20} height={13} rx={5} fill={c.shades} stroke={INK} strokeWidth={2.5} />
        <rect x={7} y={-6} width={20} height={13} rx={5} fill={c.shades} stroke={INK} strokeWidth={2.5} />
        <path d="M -23 -3 l 6 0 M 11 -3 l 6 0" stroke="#7b7b88" strokeWidth={2} strokeLinecap="round" />
      </g>
    </g>
  );
}

/** Mom, for the phone screen. */
export function MomFace({ s = 1 }: { s?: number }) {
  return (
    <g transform={`scale(${s})`}>
      <circle cx={0} cy={-8} r={44} fill="#9a5b8c" stroke={INK} strokeWidth={sw} />
      {[-36, -22, 22, 36, -30, 30].map((x, i) => (
        <circle key={i} cx={x} cy={i < 4 ? -30 + (i % 2) * 22 : 6} r={14} fill="#9a5b8c" stroke={INK} strokeWidth={sw} />
      ))}
      <ellipse cx={0} cy={4} rx={30} ry={36} fill="#efc29d" stroke={INK} strokeWidth={sw} />
      <path d="M -30 -10 Q -20 -40 0 -36 Q 20 -40 30 -10 Q 14 -26 0 -24 Q -14 -26 -30 -10 Z" fill="#9a5b8c" stroke={INK} strokeWidth={sw} strokeLinejoin="round" />
      <circle cx={-12} cy={0} r={9} fill="#fff" stroke={INK} strokeWidth={2.5} />
      <circle cx={12} cy={0} r={9} fill="#fff" stroke={INK} strokeWidth={2.5} />
      <path d="M -3 0 L 3 0" stroke={INK} strokeWidth={2.5} />
      <circle cx={-12} cy={1} r={3} fill={INK} />
      <circle cx={12} cy={1} r={3} fill={INK} />
      <path d="M 1 6 Q 5 15 9 18 Q 4 21 -2 19" fill="#efc29d" stroke={INK} strokeWidth={2.2} strokeLinejoin="round" />
      <path d="M -11 25 Q 0 32 11 25" fill="none" stroke="#b5304a" strokeWidth={4} strokeLinecap="round" />
      <circle cx={-26} cy={20} r={4} fill="#f2d24c" stroke={INK} strokeWidth={1.5} />
      <circle cx={26} cy={20} r={4} fill="#f2d24c" stroke={INK} strokeWidth={1.5} />
    </g>
  );
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function mix(c1: string, c2: string, t: number) {
  const p = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const a = p(c1);
  const b = p(c2);
  return `#${a.map((v, i) => Math.round(lerp(v, b[i], t)).toString(16).padStart(2, '0')).join('')}`;
}
/** Sky colours from mid-afternoon (t=0) to candle-lighting dusk (t=1). */
function skyAt(t: number): [string, string, string] {
  const stops: [number, [string, string, string]][] = [
    [0, ['#8fd3f0', '#b8e4f2', '#e8f4ea']],
    [0.55, ['#7cb8e0', '#f6c67a', '#f7a86a']],
    [0.85, ['#5f6fb0', '#e8848a', '#f6a35f']],
    [1, ['#2f3270', '#7a4e8c', '#e1786a']],
  ];
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const k = (t - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
      return [0, 1, 2].map((j) => mix(stops[i - 1][1][j], stops[i][1][j], k)) as [string, string, string];
    }
  }
  return stops[stops.length - 1][1];
}

/** Kitchen window with a Tel Aviv view; `t` (0..1) is how far the afternoon has gone. */
export function Window({ x, y, w, h, t }: { x: number; y: number; w: number; h: number; t: number }) {
  const [top, mid, low] = skyAt(t);
  const sunY = y + lerp(h * 0.18, h * 0.86, t);
  const night = Math.max(0, (t - 0.8) / 0.2);
  return (
    <g>
      <rect x={x - 8} y={y - 8} width={w + 16} height={h + 16} rx={6} fill={P.cream} stroke={INK} strokeWidth={sw} />
      <clipPath id="sh-win">
        <rect x={x} y={y} width={w} height={h} />
      </clipPath>
      <g clipPath="url(#sh-win)">
        <rect x={x} y={y} width={w} height={h * 0.45} fill={top} />
        <rect x={x} y={y + h * 0.45} width={w} height={h * 0.3} fill={mid} />
        <rect x={x} y={y + h * 0.75} width={w} height={h * 0.25} fill={low} />
        <circle cx={x + w * 0.62} cy={sunY} r={18} fill={mix('#fff4c2', '#ff9a5a', t)} />
        {night > 0 &&
          [
            [0.15, 0.12],
            [0.4, 0.22],
            [0.8, 0.1],
            [0.62, 0.3],
          ].map(([sx, sy], i) => <circle key={i} cx={x + w * sx} cy={y + h * sy} r={1.8} fill="#fff" opacity={night} />)}
        {/* Tel Aviv rooftops: white Bauhaus blocks, a water tank, a palm */}
        <g fill={mix('#f4efe4', '#8c7ea8', t)} stroke={INK} strokeWidth={2.5}>
          <rect x={x - 4} y={y + h * 0.62} width={w * 0.34} height={h} />
          <rect x={x + w * 0.3} y={y + h * 0.72} width={w * 0.3} height={h} />
          <rect x={x + w * 0.58} y={y + h * 0.56} width={w * 0.46} height={h} />
        </g>
        <g stroke={INK} strokeWidth={2} fill={mix('#3e5f8a', '#ffd66b', Math.max(0, (t - 0.7) / 0.3))}>
          {[0, 1, 2].map((i) => (
            <rect key={i} x={x + 6 + i * 16} y={y + h * 0.7} width={9} height={11} />
          ))}
          {[0, 1, 2].map((i) => (
            <rect key={`b${i}`} x={x + w * 0.64 + i * 17} y={y + h * 0.65} width={10} height={12} />
          ))}
        </g>
        <rect x={x + w * 0.66} y={y + h * 0.47} width={20} height={14} rx={6} fill={mix('#e9e4d8', '#7b6f96', t)} stroke={INK} strokeWidth={2} />
        <path d={`M ${x + w * 0.42} ${y + h} Q ${x + w * 0.44} ${y + h * 0.7} ${x + w * 0.47} ${y + h * 0.42}`} stroke="#6b4a2b" strokeWidth={6} fill="none" />
        <g fill={mix('#3f8f4f', '#2d3e4f', t)} stroke={INK} strokeWidth={2}>
          {[-150, -115, -70, -30, 10, 45].map((deg, i) => {
            const cx = x + w * 0.47;
            const cy = y + h * 0.42;
            const r = (deg * Math.PI) / 180;
            const tx = cx + Math.cos(r) * 34;
            const ty = cy + Math.sin(r) * 22 + 12;
            const mx = (cx + tx) / 2;
            const my = (cy + ty) / 2 - 8;
            return <path key={i} d={`M ${cx} ${cy} Q ${mx} ${my - 6} ${tx} ${ty} Q ${mx} ${my + 6} ${cx} ${cy} Z`} />;
          })}
        </g>
      </g>
      <rect x={x} y={y} width={w} height={h} fill="none" stroke={INK} strokeWidth={sw} />
      <path d={`M ${x + w / 2} ${y} L ${x + w / 2} ${y + h} M ${x} ${y + h * 0.45} L ${x + w} ${y + h * 0.45}`} stroke={P.cream} strokeWidth={6} />
      <path d={`M ${x + w / 2} ${y} L ${x + w / 2} ${y + h} M ${x} ${y + h * 0.45} L ${x + w} ${y + h * 0.45}`} stroke={INK} strokeWidth={1.5} opacity={0.4} />
      {/* sill */}
      <rect x={x - 14} y={y + h + 6} width={w + 28} height={10} rx={3} fill={P.cream} stroke={INK} strokeWidth={sw} />
    </g>
  );
}

/** Shabbat candlesticks on the sill; lit when Shabbat comes in. */
export function Candles({ x, y, lit }: { x: number; y: number; lit: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {[-12, 12].map((dx) => (
        <g key={dx} transform={`translate(${dx} 0)`}>
          <path d="M -9 0 L 9 0 L 5 -6 L 3 -26 L 7 -30 L -7 -30 L -3 -26 L -5 -6 Z" fill="#e8c35a" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
          <rect x={-3.5} y={-52} width={7} height={22} fill="#fffaf0" stroke={INK} strokeWidth={2} />
          <path d="M 0 -52 L 0 -56" stroke={INK} strokeWidth={1.5} />
          {lit && (
            <g className="sh-flame">
              <path d="M 0 -72 Q 7 -62 0 -55 Q -7 -62 0 -72 Z" fill="#ffcf4d" stroke={INK} strokeWidth={1.5} />
              <path d="M 0 -66 Q 3 -61 0 -58 Q -3 -61 0 -66 Z" fill="#fff6c9" />
            </g>
          )}
        </g>
      ))}
    </g>
  );
}

/** Round wall clock; `minutes` is the time of day. */
export function WallClock({ x, y, r, minutes, alarm }: { x: number; y: number; r: number; minutes: number; alarm: boolean }) {
  const h = ((minutes / 60) % 12) * 30;
  const m = (minutes % 60) * 6;
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={r + 6} fill={alarm ? P.red : P.coral} stroke={INK} strokeWidth={sw} />
      <circle r={r} fill={P.cream} stroke={INK} strokeWidth={sw} />
      {Array.from({ length: 12 }, (_, i) => (
        <line key={i} x1={0} y1={-r + 4} x2={0} y2={-r + (i % 3 === 0 ? 12 : 8)} stroke={INK} strokeWidth={i % 3 === 0 ? 3 : 2} transform={`rotate(${i * 30})`} />
      ))}
      <line x1={0} y1={4} x2={0} y2={-r * 0.5} stroke={INK} strokeWidth={5} strokeLinecap="round" transform={`rotate(${h})`} />
      <line x1={0} y1={6} x2={0} y2={-r * 0.78} stroke={INK} strokeWidth={3} strokeLinecap="round" transform={`rotate(${m})`} />
      <circle r={4} fill={P.coral} stroke={INK} strokeWidth={2} />
    </g>
  );
}

/** A wall socket on the backsplash. */
export function Socket({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-14} y={-14} width={28} height={28} rx={5} fill="#fbf7ee" stroke={INK} strokeWidth={2.5} />
      <circle r={8} fill="#e9e2d2" stroke={INK} strokeWidth={1.5} />
      <circle cx={-3.5} cy={0} r={1.8} fill={INK} />
      <circle cx={3.5} cy={0} r={1.8} fill={INK} />
    </g>
  );
}

/** A plug (prongs pointing up when rotate=0). */
export function Plug({ x, y, rotate = 0, s = 1 }: { x: number; y: number; rotate?: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${s})`}>
      <rect x={-2.5} y={-18} width={2} height={7} fill="#c9c9c9" stroke={INK} strokeWidth={1} />
      <rect x={1.5} y={-18} width={2} height={7} fill="#c9c9c9" stroke={INK} strokeWidth={1} />
      <path d="M -9 -11 L 9 -11 L 7 6 L -7 6 Z" fill={P.black} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
    </g>
  );
}

/** Coffee urn (front view). Base at y=0, ~h tall. */
export function Urn({ x, y, s = 1, on, boiled, progress }: { x: number; y: number; s?: number; on: boolean; boiled: boolean; progress: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {on && !boiled && (
        <g className="sh-steam" fill="#ffffff" opacity={0.85} stroke={INK} strokeWidth={1.5}>
          <circle cx={-6} cy={-132} r={7 + progress * 5} />
          <circle cx={6} cy={-146} r={6 + progress * 4} />
          <circle cx={-2} cy={-160} r={5 + progress * 3} />
        </g>
      )}
      <path d="M -30 0 L 30 0 L 26 -14 L -26 -14 Z" fill={P.black} stroke={INK} strokeWidth={sw} strokeLinejoin="round" />
      <rect x={-28} y={-112} width={56} height={98} rx={6} fill={P.steel} stroke={INK} strokeWidth={sw} />
      <rect x={-18} y={-108} width={8} height={90} rx={3} fill="#eef1f5" />
      <rect x={14} y={-108} width={6} height={90} rx={3} fill={P.steelDark} opacity={0.5} />
      <path d="M -24 -112 Q 0 -128 24 -112 Z" fill={P.steelDark} stroke={INK} strokeWidth={sw} strokeLinejoin="round" />
      <rect x={-7} y={-132} width={14} height={8} rx={3} fill={P.black} stroke={INK} strokeWidth={2.5} />
      <path d="M -36 -88 Q -42 -70 -30 -56" fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round" />
      <path d="M 36 -88 Q 42 -70 30 -56" fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round" />
      {/* tap */}
      <rect x={-6} y={-34} width={12} height={10} fill={P.black} stroke={INK} strokeWidth={2} />
      <path d="M -10 -38 L 10 -38" stroke={INK} strokeWidth={4} strokeLinecap="round" />
      <path d="M -3 -24 L 3 -24 L 2 -18 L -2 -18 Z" fill={P.black} stroke={INK} strokeWidth={1.5} />
      {/* light */}
      <circle cx={0} cy={-62} r={6} fill={boiled ? P.green : on ? '#ff5a3c' : '#5a5260'} stroke={INK} strokeWidth={2} />
      {on && !boiled && <circle cx={0} cy={-62} r={10} fill="#ff5a3c" opacity={0.3} />}
    </g>
  );
}

/** Braided loaf (side view, domed). Centre bottom at 0,0. */
export function Loaf({ w, h, baked = true, seeds = true }: { w: number; h: number; baked?: boolean; seeds?: boolean }) {
  const body = baked ? P.baked : P.dough;
  const hi = baked ? P.bakedHi : P.doughHi;
  const n = 4;
  return (
    <g>
      <path d={`M ${-w / 2} 0 Q ${-w / 2} ${-h} 0 ${-h} Q ${w / 2} ${-h} ${w / 2} 0 Z`} fill={body} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
      {Array.from({ length: n }, (_, i) => {
        const cx = -w / 2 + (w / n) * (i + 0.5);
        const top = -h * (1 - Math.pow((cx / (w / 2)) * 0.92, 2));
        return <path key={i} d={`M ${cx - w / n / 2 + 3} ${top * 0.25} Q ${cx} ${top * 1.05} ${cx + w / n / 2 - 3} ${top * 0.25}`} fill={hi} stroke={INK} strokeWidth={2} opacity={0.95} />;
      })}
      {seeds &&
        [-0.3, -0.1, 0.12, 0.3, 0.02].map((k, i) => (
          <ellipse key={i} cx={k * w} cy={-h * (0.75 - (i % 2) * 0.12)} rx={1.8} ry={1} fill="#fff7dc" />
        ))}
    </g>
  );
}

/** One plata item drawn in plate units (centre bottom at 0,0). */
export function PlataItem({ kind, w, h }: { kind: ItemKind; w: number; h: number }) {
  switch (kind) {
    case 'pot':
      return (
        <g>
          <rect x={-w / 2 - 7} y={-h * 0.75} width={10} height={7} rx={3} fill={P.black} stroke={INK} strokeWidth={2} />
          <rect x={w / 2 - 3} y={-h * 0.75} width={10} height={7} rx={3} fill={P.black} stroke={INK} strokeWidth={2} />
          <rect x={-w / 2} y={-h + 10} width={w} height={h - 10} rx={6} fill={P.coral} stroke={INK} strokeWidth={2.5} />
          <rect x={-w / 2 + 8} y={-h + 18} width={8} height={h - 34} rx={3} fill="#f08c74" />
          <path d={`M ${-w / 2 - 3} ${-h + 11} L ${w / 2 + 3} ${-h + 11} L ${w / 2 - 4} ${-h + 4} L ${-w / 2 + 4} ${-h + 4} Z`} fill={P.coralDark} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
          <rect x={-8} y={-h} width={16} height={5} rx={2} fill={P.black} stroke={INK} strokeWidth={2} />
          <path d={`M ${-w / 2 + 4} -14 L ${w / 2 - 4} -14`} stroke="#fff2df" strokeWidth={3} strokeDasharray="6 6" />
        </g>
      );
    case 'tray':
      return (
        <g>
          <path d={`M ${-w / 2 + 6} -10 Q -20 ${-h - 4} 0 -12 Q 18 ${-h - 6} ${w / 2 - 8} -10 Z`} fill="#e9a23b" stroke={INK} strokeWidth={2} />
          <circle cx={-w / 4} cy={-h + 6} r={6} fill="#6aa84f" stroke={INK} strokeWidth={1.8} />
          <circle cx={w / 5} cy={-h + 5} r={5} fill="#d9583b" stroke={INK} strokeWidth={1.8} />
          <path d={`M ${-w / 2} ${-h + 10} L ${w / 2} ${-h + 10} L ${w / 2 - 7} 0 L ${-w / 2 + 7} 0 Z`} fill={P.steel} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
          <path d={`M ${-w / 2 + 12} -6 L ${w / 2 - 12} -6`} stroke="#eef1f5" strokeWidth={2} />
          <path d={`M ${-w / 2 - 2} ${-h + 10} L ${w / 2 + 2} ${-h + 10}`} stroke={INK} strokeWidth={3} strokeLinecap="round" />
        </g>
      );
    case 'challah':
      return <Loaf w={w} h={h} />;
    case 'cake':
      return (
        <g>
          <path d={`M ${-w / 2} 0 L ${-w / 2} ${-h * 0.55} Q ${-w / 2} ${-h} 0 ${-h} Q ${w / 2} ${-h} ${w / 2} ${-h * 0.55} L ${w / 2} 0 Z`} fill="#8a5232" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
          <path
            d={`M ${-w / 2} ${-h * 0.55} Q ${-w / 2} ${-h} 0 ${-h} Q ${w / 2} ${-h} ${w / 2} ${-h * 0.55} L ${w / 2 - 6} ${-h * 0.42} L ${w / 2 - 14} ${-h * 0.56} L ${w / 4} ${-h * 0.36} L ${w / 8} ${-h * 0.55} L -6 ${-h * 0.3} L ${-w / 6} ${-h * 0.55} L ${-w / 3} ${-h * 0.4} L ${-w / 2 + 6} ${-h * 0.55} Z`}
            fill={P.pink}
            stroke={INK}
            strokeWidth={2.2}
            strokeLinejoin="round"
          />
          {[-0.25, 0, 0.22].map((k, i) => (
            <rect key={i} x={k * w - 2} y={-h * 0.86 + (i % 2) * 4} width={5} height={2.5} rx={1} fill={['#f6d64a', '#5bc0eb', '#fff'][i]} transform={`rotate(${i * 40 - 30} ${k * w} ${-h * 0.85})`} />
          ))}
          <path d={`M ${-w / 2} -4 L ${w / 2} -4`} stroke={INK} strokeWidth={2} />
        </g>
      );
  }
}

/** The plata (hotplate) with what's on it, in plate units. Plate top at y=0. */
export function PlataSurface({ w, on, placed, unit = 1 }: { w: number; on: boolean; placed: Placed[]; unit?: number }) {
  return (
    <g>
      <rect x={(-w / 2) * unit - 4} y={0} width={w * unit + 8} height={16 * unit} rx={4} fill={P.black} stroke={INK} strokeWidth={2.5} />
      <rect x={(-w / 2) * unit + 6} y={4 * unit} width={10 * unit} height={5 * unit} rx={2} fill={on ? '#ff5a3c' : '#5a5260'} />
      <rect x={(-w / 2) * unit} y={-4 * unit} width={w * unit} height={6 * unit} rx={2} fill={on ? '#5a2a2e' : '#3b3644'} stroke={INK} strokeWidth={2} />
      {on && <rect x={(-w / 2) * unit + 6} y={-3 * unit} width={w * unit - 12} height={2 * unit} rx={1} fill="#ff7a4a" opacity={0.6} />}
      <g transform={`translate(0 ${-4 * unit}) scale(${unit})`}>
        {placed.map((p) => {
          const d = itemById(p.id);
          return (
            <g key={p.id} transform={`translate(${p.x} ${-p.y})`}>
              <PlataItem kind={d.kind} w={d.w} h={d.h} />
            </g>
          );
        })}
      </g>
    </g>
  );
}

/** Smartphone lying on the counter (or standing up and ringing). */
export function Phone({ x, y, s = 1, ringing }: { x: number; y: number; s?: number; ringing: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className={ringing ? 'sh-ring' : undefined}>
        {ringing ? (
          <g>
            <rect x={-17} y={-66} width={34} height={64} rx={6} fill={P.black} stroke={INK} strokeWidth={sw} />
            <rect x={-13} y={-60} width={26} height={50} rx={3} fill="#7fd1a8" />
            <circle cx={0} cy={-40} r={8} fill="#9a5b8c" stroke={INK} strokeWidth={1.5} />
            <rect x={-9} y={-24} width={18} height={6} rx={3} fill={P.green} stroke={INK} strokeWidth={1.2} />
          </g>
        ) : (
          <path d="M -26 0 L 22 0 L 30 -10 L -18 -10 Z" fill={P.black} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
        )}
      </g>
      {ringing && (
        <g stroke={INK} strokeWidth={2.5} fill="none" strokeLinecap="round" className="sh-waves">
          <path d="M 24 -56 Q 32 -44 24 -32" />
          <path d="M 32 -62 Q 44 -44 32 -26" />
          <path d="M -24 -56 Q -32 -44 -24 -32" />
          <path d="M -32 -62 Q -44 -44 -32 -26" />
        </g>
      )}
    </g>
  );
}

/** Kitchen backdrop (no stations); 390 x 760 viewBox space. */
export const KitchenBackdrop = React.memo(function KitchenBackdrop({ t, lit }: { t: number; lit: boolean }) {
  return (
    <g>
      <rect x={0} y={0} width={390} height={760} fill={P.wall} />
      {/* subtle wallpaper diamonds */}
      <g fill={P.wallDark} opacity={0.5}>
        {Array.from({ length: 6 }, (_, r) =>
          Array.from({ length: 8 }, (_, c) => <path key={`${r}-${c}`} d={`M ${c * 52 + (r % 2) * 26} ${150 + r * 46} l 5 -8 l 5 8 l -5 8 z`} />),
        )}
      </g>
      {/* upper cabinets */}
      <rect x={-4} y={-4} width={398} height={118} fill={P.cabinet} stroke={INK} strokeWidth={sw} />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect x={10 + i * 95} y={10} width={84} height={92} rx={4} fill={P.cabinet} stroke={INK} strokeWidth={sw} />
          <rect x={18 + i * 95} y={18} width={68} height={76} rx={3} fill="none" stroke={P.cabinetDark} strokeWidth={3} />
          <rect x={i % 2 ? 22 + i * 95 : 76 + i * 95} y={66} width={6} height={22} rx={3} fill={P.cream} stroke={INK} strokeWidth={2} />
        </g>
      ))}
      <rect x={-4} y={112} width={398} height={10} fill={P.cabinetDark} stroke={INK} strokeWidth={sw} />
      <Window x={26} y={160} w={150} h={150} t={t} />
      <Candles x={100} y={331} lit={lit} />
      {/* backsplash tiles */}
      <rect x={-4} y={392} width={398} height={86} fill={P.tile} stroke={INK} strokeWidth={sw} />
      <g stroke={P.tileLine} strokeWidth={2}>
        {Array.from({ length: 4 }, (_, r) => (
          <line key={r} x1={0} y1={392 + r * 22} x2={390} y2={392 + r * 22} />
        ))}
        {Array.from({ length: 14 }, (_, c) => (
          <line key={c} x1={c * 30} y1={392} x2={c * 30} y2={478} />
        ))}
      </g>
    </g>
  );
});

/** The kitchen island (top slab and cabinets), drawn over people standing behind it. */
export function CounterTop() {
  return (
    <g>
      {/* lower cabinets */}
      <rect x={-4} y={500} width={398} height={264} fill={P.coral} stroke={INK} strokeWidth={sw} />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect x={8 + i * 95} y={600} width={88} height={150} rx={4} fill={P.coral} stroke={INK} strokeWidth={sw} />
          <rect x={30 + i * 95} y={610} width={44} height={6} rx={3} fill={P.cream} stroke={INK} strokeWidth={2} />
        </g>
      ))}
      <rect x={-4} y={750} width={398} height={14} fill={P.black} />
      <rect x={-4} y={476} width={398} height={16} fill={P.counter} stroke={INK} strokeWidth={sw} />
      <rect x={-4} y={490} width={398} height={12} fill={P.counterEdge} stroke={INK} strokeWidth={sw} />
    </g>
  );
}
