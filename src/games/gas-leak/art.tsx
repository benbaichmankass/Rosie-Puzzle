import React from 'react';
import { CHARACTERS } from '../../shared/characters';
import { COLS, DC, DR, EXIT_ROW, ROWS, type Dir, type ExitId, type Furniture } from './sim';

/** SVG geometry (viewBox units). */
export const CELL = 40;
export const WALL = 12;
export const OUT_L = 18; // outside strip on the left (yard)
export const OUT_R = 18; // kitchen strip on the right
export const X0 = OUT_L + WALL;
export const Y0 = WALL;
export const VB_W = X0 + COLS * CELL + WALL + OUT_R;
export const VB_H = Y0 + ROWS * CELL + WALL;
export const cx = (c: number) => X0 + c * CELL + CELL / 2;
export const cy = (r: number) => Y0 + r * CELL + CELL / 2;

const B = CHARACTERS.bentzi.colors;
const R = CHARACTERS.rosie.colors;

export const ROT = [0, 90, 180, 270]; // rotation (deg) for N E S W when the shape points up

/** Static shared <defs>. */
export function Defs() {
  return (
    <defs>
      <radialGradient id="gl-gas" cx="40%" cy="35%" r="70%">
        <stop offset="0%" stopColor="#e6ff9c" stopOpacity="0.95" />
        <stop offset="55%" stopColor="#9fdc4a" stopOpacity="0.85" />
        <stop offset="100%" stopColor="#5fa82c" stopOpacity="0.55" />
      </radialGradient>
      <radialGradient id="gl-danger" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#ff8a3d" stopOpacity="0.35" />
        <stop offset="100%" stopColor="#ff8a3d" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="gl-glass" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#dff6fb" stopOpacity="0.9" />
        <stop offset="100%" stopColor="#a6d8e6" stopOpacity="0.75" />
      </linearGradient>
      <linearGradient id="gl-sky" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#8fcf6a" />
        <stop offset="100%" stopColor="#c9e8a8" />
      </linearGradient>
      <pattern id="gl-tiles" width={CELL} height={CELL} patternUnits="userSpaceOnUse" x={X0} y={Y0}>
        <rect width={CELL} height={CELL} fill="#ece4d6" />
        <rect x="1" y="1" width={CELL - 2} height={CELL - 2} rx="2" fill="#f3ece0" />
        <path d="M6 30 q8 -4 14 2 t14 -3" stroke="#e4d9c6" strokeWidth="1.2" fill="none" />
      </pattern>
      <pattern id="gl-kitchen" width="12" height="12" patternUnits="userSpaceOnUse">
        <rect width="12" height="12" fill="#f5f5f5" />
        <rect width="6" height="6" fill="#cfd8dc" />
        <rect x="6" y="6" width="6" height="6" fill="#cfd8dc" />
      </pattern>
      <filter id="gl-shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="1.5" dy="2.5" stdDeviation="1.2" floodColor="#3b2f22" floodOpacity="0.28" />
      </filter>
    </defs>
  );
}

/** Floor, walls, openings, the kitchen doorway and wall decor. */
export function Room({ open, source, acOn }: { open: Record<ExitId, boolean>; source: number; acOn: boolean }) {
  const x1 = X0 + COLS * CELL;
  const y1 = Y0 + ROWS * CELL;
  const exitY = (e: ExitId) => Y0 + EXIT_ROW[e] * CELL;
  return (
    <g>
      {/* yard outside on the left */}
      <rect x="0" y="0" width={X0} height={VB_H} fill="url(#gl-sky)" />
      {[30, 95, 170, 250, 330].map((y, i) => (
        <circle key={i} cx={6 + (i % 2) * 5} cy={y} r={7} fill="#6fae4c" opacity="0.8" />
      ))}
      {/* kitchen on the right */}
      <rect x={x1} y="0" width={WALL + OUT_R} height={VB_H} fill="#d9d4cc" />
      {/* floor */}
      <rect x={X0} y={Y0} width={COLS * CELL} height={ROWS * CELL} fill="url(#gl-tiles)" />
      {/* walls */}
      <g fill="#fbfaf6" stroke="#b9b1a4" strokeWidth="1">
        <rect x={OUT_L} y="0" width={COLS * CELL + 2 * WALL} height={WALL} />
        <rect x={OUT_L} y={y1} width={COLS * CELL + 2 * WALL} height={WALL} />
        <rect x={OUT_L} y="0" width={WALL} height={VB_H} />
        <rect x={x1} y="0" width={WALL} height={VB_H} />
      </g>
      {/* bookshelf + lamp on the top wall */}
      <g>
        <rect x={X0 + 60} y="2" width="92" height="8" rx="1" fill="#7a5233" />
        {Array.from({ length: 15 }, (_, i) => (
          <rect
            key={i}
            x={X0 + 62 + i * 6}
            y={3 + (i % 3)}
            width="4.5"
            height={6 - (i % 3)}
            fill={['#e2574c', '#f2c14e', '#3d7ea6', '#5aa469', '#efe9dc', '#b56576'][i % 6]}
          />
        ))}
        <circle cx={X0 + 190} cy="7" r="4.5" fill="#ffe7a3" stroke="#2b2b2b" strokeWidth="1.2" />
        <circle cx={X0 + 190} cy="7" r="9" fill="#fff3c4" opacity="0.35" />
      </g>
      {/* kitchen doorway (gas source) */}
      <g>
        <rect x={x1 - 1} y={Y0 + source * CELL + 2} width={WALL + OUT_R + 1} height={CELL - 4} fill="url(#gl-kitchen)" />
        <rect x={x1 + 8} y={Y0 + source * CELL + 6} width="20" height={CELL - 12} rx="2" fill="#3a3f45" />
        {[0, 1].map((i) => (
          <circle key={i} cx={x1 + 18} cy={Y0 + source * CELL + 13 + i * 14} r="4" fill="none" stroke="#9aa3ab" strokeWidth="1.6" />
        ))}
        <circle className="gl-hiss" cx={x1 + 6} cy={Y0 + source * CELL + CELL / 2} r="5" fill="url(#gl-gas)" />
      </g>
      {/* left wall openings */}
      <Window y={exitY('window')} open={open.window} />
      <Door y={exitY('door')} open={open.door} />
      <Window y={exitY('acWindow')} open={open.acWindow} />
      <AcUnit y={exitY('acWindow')} on={acOn} />
    </g>
  );
}

function ExitMark({ y, open }: { y: number; open: boolean }) {
  return open ? (
    <g className="gl-exit-open">
      <path d={`M${OUT_L - 3} ${y + CELL / 2 - 6} l-8 6 l8 6`} fill="none" stroke="#2f7d32" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  ) : (
    <g stroke="#c0392b" strokeWidth="2.6" strokeLinecap="round">
      <path d={`M${3} ${y + CELL / 2 - 5} l10 10 M${13} ${y + CELL / 2 - 5} l-10 10`} />
    </g>
  );
}

function Window({ y, open }: { y: number; open: boolean }) {
  const x = OUT_L;
  return (
    <g>
      <rect x={x} y={y + 2} width={WALL} height={CELL - 4} fill={open ? '#bfe9ff' : '#8d99a3'} stroke="#5c6670" strokeWidth="1.2" />
      {open ? (
        <>
          {/* sashes swung inward */}
          <path d={`M${x + WALL} ${y + 3} l9 6 v10 l-9 -6z`} fill="url(#gl-glass)" stroke="#5c6670" strokeWidth="1" />
          <path d={`M${x + WALL} ${y + CELL - 3} l9 -6 v-10 l-9 6z`} fill="url(#gl-glass)" stroke="#5c6670" strokeWidth="1" />
        </>
      ) : (
        Array.from({ length: 6 }, (_, i) => (
          <line key={i} x1={x + 1} x2={x + WALL - 1} y1={y + 6 + i * 5.5} y2={y + 6 + i * 5.5} stroke="#646f78" strokeWidth="1.2" />
        ))
      )}
      <ExitMark y={y} open={open} />
    </g>
  );
}

function Door({ y, open }: { y: number; open: boolean }) {
  const x = OUT_L;
  return (
    <g>
      <rect x={x} y={y + 1} width={WALL} height={CELL - 2} fill={open ? '#a3d977' : '#8a5a36'} stroke="#5b3a22" strokeWidth="1.2" />
      {open ? (
        <>
          <path d={`M${x + WALL} ${y + 1} A ${CELL - 4} ${CELL - 4} 0 0 1 ${x + WALL + CELL - 4} ${y + CELL - 3}`} fill="none" stroke="#b9a58c" strokeDasharray="2 3" strokeWidth="1" />
          <rect x={x + WALL} y={y + 1} width="5" height={CELL - 6} fill="#a8724a" stroke="#5b3a22" strokeWidth="1" transform={`rotate(-62 ${x + WALL} ${y + 1})`} />
        </>
      ) : (
        <circle cx={x + WALL - 3} cy={y + CELL / 2 + 6} r="1.8" fill="#f2c14e" />
      )}
      <ExitMark y={y} open={open} />
    </g>
  );
}

function AcUnit({ y, on }: { y: number; on: boolean }) {
  const x = OUT_L + WALL;
  return (
    <g>
      <rect x={x - 2} y={y - 14} width="9" height="22" rx="2" fill="#ffffff" stroke="#9aa3ab" strokeWidth="1.2" filter="url(#gl-shadow)" />
      <line x1={x + 5} x2={x + 5} y1={y - 11} y2={y + 5} stroke="#c9d1d6" strokeWidth="1.5" />
      <circle cx={x + 1} cy={y - 10} r="1.3" fill={on ? '#36d16a' : '#b0b6ba'} />
    </g>
  );
}

/** A cell of light wind arrows (preview of the airflow). */
export function WindArrow({ r, c, x, y }: { r: number; c: number; x: number; y: number }) {
  const mag = Math.hypot(x, y);
  if (mag < 0.01) return null;
  const ang = (Math.atan2(y, x) * 180) / Math.PI + 90;
  const op = Math.min(0.75, 0.25 + mag * 0.12);
  return (
    <g transform={`translate(${cx(c)} ${cy(r)}) rotate(${ang})`} opacity={op}>
      <path className="gl-wind" d="M-6 6 L0 0 L6 6 M-6 14 L0 8 L6 14" transform="translate(0 -10)" fill="none" stroke="#3a8fd1" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

/** Floor fan seen from above: base, spinning blades, and an arrow with one chevron per strength. */
export function FanSprite({ r, c, dir, s, selected, spinning, fixed }: { r: number; c: number; dir: Dir; s: number; selected?: boolean; spinning?: boolean; fixed?: boolean }) {
  const speed = [0, 1.1, 0.6, 0.3][s];
  return (
    <g transform={`translate(${cx(c)} ${cy(r)})`}>
      {selected && <circle r="19" fill="none" stroke="#ffcc33" strokeWidth="3" className="gl-pulse" />}
      <g transform={`rotate(${ROT[dir]})`} filter="url(#gl-shadow)">
        <rect x="-11" y="2" width="22" height="12" rx="4" fill={fixed ? '#9aa3ab' : '#2f8f9d'} />
        <circle r="12.5" cy="-2" fill="#f7fbfc" stroke={fixed ? '#6b7680' : '#1f6f7a'} strokeWidth="2" />
        <g transform="translate(0 -2)">
          <g className={spinning ? 'gl-spin' : 'gl-spin-slow'} style={{ animationDuration: `${spinning ? speed : speed * 4}s` }}>
            {[0, 120, 240].map((a) => (
              <ellipse key={a} rx="3.6" ry="8" cy="-5" fill="#7fc8d6" transform={`rotate(${a})`} />
            ))}
          </g>
          <circle r="2.6" fill="#1f6f7a" />
          <circle r="12.5" fill="none" stroke="#9fb7bd" strokeWidth="0.8" strokeDasharray="1.5 2" />
        </g>
        {Array.from({ length: s }, (_, i) => (
          <path key={i} d={`M-5 ${-17 - i * 4.5} l5 -4 l5 4`} fill="none" stroke={fixed ? '#55606a' : '#e2574c'} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </g>
    </g>
  );
}

export function CeilingFan({ r, c }: { r: number; c: number }) {
  return (
    <g transform={`translate(${cx(c)} ${cy(r)})`} opacity="0.92">
      <circle r={CELL * 1.45} fill="none" stroke="#7bb6e0" strokeWidth="1.4" strokeDasharray="5 6" className="gl-swirl" />
      <g className="gl-spin" style={{ animationDuration: '1.4s' }}>
        {[0, 90, 180, 270].map((a) => (
          <g key={a} transform={`rotate(${a})`}>
            <rect x="-4" y="-26" width="8" height="22" rx="4" fill="#9a6b45" stroke="#6b4428" strokeWidth="1" />
          </g>
        ))}
      </g>
      <circle r="6" fill="#e9e3d8" stroke="#6b4428" strokeWidth="1.5" />
      <circle r="2" fill="#f2c14e" />
    </g>
  );
}

/** Top-down furniture. */
export function FurniturePiece({ f, rosie }: { f: Furniture; rosie?: { r: number; c: number } | null }) {
  const x = X0 + f.c * CELL;
  const y = Y0 + f.r * CELL;
  const w = f.w * CELL;
  const h = f.h * CELL;
  const pad = 3;
  switch (f.kind) {
    case 'sofa': {
      const horiz = f.w >= f.h;
      return (
        <g filter="url(#gl-shadow)">
          <rect x={x + 1} y={y + 1} width={w - 2} height={h - 2} rx="7" fill="#3f4348" />
          {horiz ? <rect x={x + 1} y={y + 1} width={w - 2} height="10" rx="5" fill="#33363a" /> : <rect x={x + w - 11} y={y + 1} width="10" height={h - 2} rx="5" fill="#33363a" />}
          {Array.from({ length: Math.max(f.w, f.h) }, (_, i) =>
            horiz ? (
              <rect key={i} x={x + 4 + i * CELL} y={y + 12} width={CELL - 8} height={h - 16} rx="5" fill="#575c62" />
            ) : (
              <rect key={i} x={x + 4} y={y + 4 + i * CELL} width={w - 16} height={CELL - 8} rx="5" fill="#575c62" />
            ),
          )}
          {horiz && <rect x={x + 5} y={y + 13} width="10" height="9" rx="3" fill="#e9d9a6" transform={`rotate(-12 ${x + 10} ${y + 17})`} />}
          {rosie && rosie.r >= f.r && rosie.r < f.r + f.h && rosie.c >= f.c && rosie.c < f.c + f.w && <RosieSleeping x={cx(rosie.c)} y={cy(rosie.r) + 2} />}
        </g>
      );
    }
    case 'table':
      return (
        <g filter="url(#gl-shadow)">
          <rect x={x + pad} y={y + pad + 4} width={w - pad * 2} height={h - pad * 2 - 8} rx="3" fill="url(#gl-glass)" stroke="#8a9aa3" strokeWidth="1.6" />
          <path d={`M${x + 12} ${y + h - 10} l18 -${h - 22}`} stroke="#ffffff" strokeWidth="2.5" opacity="0.8" />
          <circle cx={x + w - 18} cy={y + h / 2} r="4.5" fill="#d9534f" stroke="#7a2a27" strokeWidth="1" />
          <circle cx={x + w - 18} cy={y + h / 2} r="2.2" fill="#5a3b26" />
          <rect x={x + w / 2 - 6} y={y + h / 2 - 3} width="12" height="7" rx="1" fill="#2b2b2b" />
        </g>
      );
    case 'plant':
      return (
        <g filter="url(#gl-shadow)">
          <circle cx={x + w / 2} cy={y + h / 2} r="11" fill="#c96f45" stroke="#8a4526" strokeWidth="1.5" />
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <ellipse key={a} cx={x + w / 2} cy={y + h / 2 - 9} rx="5" ry="10" fill={a % 120 ? '#4f9a46' : '#6bbf5a'} transform={`rotate(${a} ${x + w / 2} ${y + h / 2})`} />
          ))}
          <circle cx={x + w / 2} cy={y + h / 2} r="4" fill="#3c7a35" />
        </g>
      );
    case 'armchair':
      return (
        <g filter="url(#gl-shadow)">
          <rect x={x + 3} y={y + 3} width={w - 6} height={h - 6} rx="9" fill="#d99a3b" />
          <rect x={x + 3} y={y + 3} width={w - 6} height="10" rx="5" fill="#b87a22" />
          <rect x={x + 9} y={y + 14} width={w - 18} height={h - 20} rx="5" fill="#eab25a" />
        </g>
      );
    case 'tv':
      return (
        <g filter="url(#gl-shadow)">
          <rect x={x + pad} y={y + 8} width={w - pad * 2} height={h - 16} rx="2" fill="#9b6a43" stroke="#6b4428" strokeWidth="1.2" />
          <rect x={x + 10} y={y + h / 2 - 3} width={w - 20} height="6" rx="1.5" fill="#1b1b1f" />
          <rect x={x + w / 2 - 6} y={y + h / 2 + 3} width="12" height="3" fill="#333" />
        </g>
      );
    case 'dogbed':
      return (
        <g filter="url(#gl-shadow)">
          <rect x={x + 3} y={y + 4} width={w - 6} height={h - 8} rx={Math.min(w, h) / 2 - 4} fill="#1f9aa6" />
          <rect x={x + 9} y={y + 10} width={w - 18} height={h - 20} rx={Math.min(w, h) / 2 - 10} fill="#7fd0d6" />
          <path d={`M${x + w / 2 - 7} ${y + h / 2} h14`} stroke="#fff" strokeWidth="3" strokeLinecap="round" />
          {[-7, 7].map((d) => (
            <circle key={d} cx={x + w / 2 + d} cy={y + h / 2} r="2.6" fill="#fff" />
          ))}
        </g>
      );
    case 'cabinet':
    default:
      return (
        <g filter="url(#gl-shadow)">
          <rect x={x + 2} y={y + 2} width={w - 4} height={h - 4} rx="2" fill="#a8774d" stroke="#6b4428" strokeWidth="1.2" />
          {f.w >= f.h
            ? Array.from({ length: Math.floor((w - 10) / 6) }, (_, i) => (
                <rect key={i} x={x + 5 + i * 6} y={y + 6} width="4.5" height={h - 12} fill={['#e2574c', '#f2c14e', '#3d7ea6', '#5aa469', '#efe9dc'][i % 5]} />
              ))
            : Array.from({ length: Math.floor((h - 10) / 6) }, (_, i) => (
                <rect key={i} x={x + 6} y={y + 5 + i * 6} width={w - 12} height="4.5" fill={['#e2574c', '#f2c14e', '#3d7ea6', '#5aa469', '#efe9dc'][i % 5]} />
              ))}
        </g>
      );
  }
}

function RosieSleeping({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {/* curled body */}
      <ellipse rx="14" ry="10" fill={R.coat} stroke="#c9c6bf" strokeWidth="0.8" />
      {[
        [-6, -3],
        [3, 4],
        [7, -4],
        [-2, 5],
        [-9, 3],
      ].map(([a, b], i) => (
        <circle key={i} cx={a} cy={b} r="0.9" fill={R.ticking} />
      ))}
      <circle cx="7" cy="2" r="4" fill={R.head} />
      <path d="M10 -6 q8 2 3 10" fill="none" stroke={R.coat} strokeWidth="2.4" strokeLinecap="round" />
      {/* head tucked */}
      <ellipse cx="-7" cy="-1" rx="6" ry="5" fill={R.head} />
      <path d="M-7 -6 v8" stroke="#f4f2ee" strokeWidth="1.6" />
      <ellipse cx="-11" cy="1" rx="2.6" ry="2" fill={R.coat} />
      <ellipse cx="-4" cy="-6" rx="2.2" ry="3.2" fill={R.head} transform="rotate(30 -4 -6)" />
      <path d="M-9 -2 q1 1 2 0" stroke="#fff" strokeWidth="0.8" fill="none" />
      <text x="2" y="-12" fontSize="7" fill="#7c8a99" fontFamily="sans-serif" className="gl-zzz">
        z
      </text>
    </g>
  );
}

/** Bentzi on the couch, cartoon, facing the viewer. mood: chill | worried | boom | relieved */
export function Bentzi({ r, c, mood }: { r: number; c: number; mood: 'chill' | 'worried' | 'boom' | 'relieved' }) {
  const soot = mood === 'boom';
  const skin = soot ? '#5a5048' : B.skin;
  return (
    <g transform={`translate(${cx(c)} ${cy(r) + 2})`}>
      {/* arms + shirt */}
      <ellipse cx="0" cy="12" rx="15" ry="10" fill={B.shirt} />
      <ellipse cx="-14" cy="10" rx="4.5" ry="7" fill={skin} transform="rotate(25 -14 10)" />
      <ellipse cx="14" cy="8" rx="4.5" ry="7" fill={skin} transform="rotate(-35 14 8)" />
      {/* head */}
      {soot && (
        <g fill="#2b2622">
          {Array.from({ length: 9 }, (_, i) => (
            <path key={i} d={`M0 -10 l${Math.cos((i / 8) * Math.PI) * -18} ${-Math.sin((i / 8) * Math.PI) * 16 - 2} l4 3z`} />
          ))}
        </g>
      )}
      <ellipse cx="0" cy="-6" rx="11.5" ry="12.5" fill={skin} />
      {!soot && <path d="M-11.5 -9 q0 -11 11.5 -11 q11.5 0 11.5 11 q-4 -6 -11.5 -6 q-7.5 0 -11.5 6z" fill={B.hair} />}
      {/* sunglasses pushed up */}
      <g transform="translate(0 -14)">
        <rect x="-9.5" y="-2.5" width="8" height="5" rx="2.2" fill={B.shades} />
        <rect x="1.5" y="-2.5" width="8" height="5" rx="2.2" fill={B.shades} />
        <path d="M-1.5 -1 h3" stroke={B.shades} strokeWidth="1.5" />
        <rect x="-8" y="-1.6" width="3" height="1.4" rx="0.7" fill="#7a8a99" opacity="0.8" />
      </g>
      {/* beard */}
      <path d="M-11 -5 q0 16 11 16 q11 0 11 -16 q-3 5 -11 5 q-8 0 -11 -5z" fill={soot ? '#2b2622' : B.beard} />
      {/* eyes */}
      {mood === 'chill' && (
        <g stroke="#2b1d14" strokeWidth="1.5" fill="none" strokeLinecap="round">
          <path d="M-7 -6 q2.5 -2 5 0" />
          <path d="M2 -6 q2.5 -2 5 0" />
        </g>
      )}
      {mood === 'relieved' && (
        <g stroke="#2b1d14" strokeWidth="1.5" fill="none" strokeLinecap="round">
          <path d="M-7 -7 q2.5 2 5 0" />
          <path d="M2 -7 q2.5 2 5 0" />
        </g>
      )}
      {mood === 'worried' && (
        <g>
          <circle cx="-4.5" cy="-6" r="2.6" fill="#fff" />
          <circle cx="4.5" cy="-6" r="2.6" fill="#fff" />
          <circle cx="-4.5" cy="-5.6" r="1.2" fill="#2b1d14" />
          <circle cx="4.5" cy="-5.6" r="1.2" fill="#2b1d14" />
        </g>
      )}
      {soot && (
        <g>
          <circle cx="-4.5" cy="-6" r="2.4" fill="#fff" />
          <circle cx="4.5" cy="-6" r="2.4" fill="#fff" />
          <circle cx="-4.5" cy="-6" r="0.9" fill="#111" />
          <circle cx="4.5" cy="-6" r="0.9" fill="#111" />
        </g>
      )}
      {/* mouth */}
      {mood === 'worried' ? (
        <ellipse cx="0" cy="2.5" rx="3" ry="3.5" fill="#5a1f1a" />
      ) : soot ? (
        <path d="M-4 3 h8" stroke="#fff" strokeWidth="1.6" />
      ) : (
        <path d="M-6 0.5 q6 7 12 0z" fill="#fff" stroke="#5a1f1a" strokeWidth="1" />
      )}
      {/* joint */}
      {!soot && (
        <g transform="translate(15 1) rotate(-25)">
          <rect x="-1" y="-9" width="3" height="10" rx="1" fill="#f6f1e4" stroke="#c9bfa6" strokeWidth="0.5" />
          <circle cx="0.5" cy="-9.5" r="1.8" fill="#ff6a2b" className="gl-ember" />
        </g>
      )}
      {!soot && (
        <g className="gl-smoke" fill="none" stroke="#cfd6dc" strokeWidth="1.6" strokeLinecap="round" opacity="0.8">
          <path d="M20 -12 q-4 -5 1 -9 q4 -4 -1 -9" />
        </g>
      )}
      {mood === 'relieved' && (
        <text x="-15" y="-24" fontSize="9" fontFamily="'Bangers', sans-serif" fill="#2f7d32">
          PHEW!
        </text>
      )}
    </g>
  );
}

/** Puffy cartoon gas cloud for one cell. */
export function GasPuff({ r, c, k, big }: { r: number; c: number; k: number; big?: boolean }) {
  const s = big ? 1.2 : 1;
  const j = ((r * 7 + c * 13) % 5) - 2;
  return (
    <g transform={`translate(${cx(c) + j} ${cy(r) - j}) scale(${s})`} className="gl-puff" opacity="0.82">
      <g style={{ animationDelay: `${(k % 6) * -0.3}s` }}>
        <path
          d="M-15 8 a8 8 0 0 1 1 -14 a10 10 0 0 1 16 -6 a9 9 0 0 1 14 6 a8 8 0 0 1 0 14 a9 9 0 0 1 -12 4 a9 9 0 0 1 -19 -4z"
          fill="url(#gl-gas)"
          stroke="#6aa83a"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path d="M-8 -6 a6 6 0 0 1 8 -4" fill="none" stroke="#f4ffd6" strokeWidth="2.4" strokeLinecap="round" opacity="0.8" />
        <circle cx="9" cy="4" r="1.6" fill="#6aa83a" opacity="0.6" />
      </g>
    </g>
  );
}

/** Cartoon explosion over Bentzi. */
export function Boom({ r, c }: { r: number; c: number }) {
  const pts = (n: number, ro: number, ri: number) =>
    Array.from({ length: n * 2 }, (_, i) => {
      const a = (i / (n * 2)) * Math.PI * 2;
      const rad = i % 2 ? ri : ro * (0.85 + ((i * 37) % 10) / 50);
      return `${Math.cos(a) * rad},${Math.sin(a) * rad}`;
    }).join(' ');
  return (
    <g transform={`translate(${Math.min(Math.max(cx(c), X0 + 110), X0 + COLS * CELL - 110)} ${Math.min(Math.max(cy(r), Y0 + 110), Y0 + ROWS * CELL - 110)})`} className="gl-boom">
      <polygon points={pts(14, 120, 70)} fill="#d7261e" />
      <polygon points={pts(12, 95, 55)} fill="#ff8a1f" />
      <polygon points={pts(10, 68, 42)} fill="#ffe14a" />
      <text textAnchor="middle" y="14" fontSize="44" fontFamily="'Bangers', 'Impact', sans-serif" fill="#fff" stroke="#7a1410" strokeWidth="3" paintOrder="stroke" transform="rotate(-8)">
        BOOM!
      </text>
    </g>
  );
}

/** Small arrow icon for the direction buttons. */
export function DirIcon({ dir }: { dir: Dir }) {
  return (
    <svg viewBox="-12 -12 24 24" width="22" height="22">
      <path transform={`rotate(${ROT[dir]})`} d="M0 -9 L8 1 H3 V9 H-3 V1 H-8 Z" fill="currentColor" />
    </svg>
  );
}

export { DR, DC };
