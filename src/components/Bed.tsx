import React from 'react';
import { motion } from 'motion/react';
import { PuzzleLevel, Pose, poseCellsAt } from '../utils/puzzle';
import { ObstacleIcon } from './ObstacleIcon';
import { DogFigure, PersonFigure, S } from './Figures';

export type PersonId = 'boyfriend' | 'girlfriend';

export interface PlacedPerson {
  pose: Pose;
  col: number;
}

interface BedProps {
  level: PuzzleLevel;
  placed: Partial<Record<PersonId, PlacedPerson>>;
  grumpiness: number;
  onPersonTap: (id: PersonId) => void;
  shakeKey: number;
  /** Rect covering the grid, used to work out where a dragged person lands. */
  gridRef: React.Ref<SVGRectElement>;
  dropCol: { id: PersonId; col: number; width: number } | null;
  /** Green cloud over the squares where two people overlapped. */
  fart: { key: number; cells: { r: number; c: number }[] } | null;
  growling: boolean;
}

const FRAME = 22; // side posts
const HEAD = 66; // headboard above the pillows
const FOOT = 38; // footboard

const INK = '#1b0f3d';
// Bright retro quilt: [face, highlight, shadow]
const QUILT: [string, string, string][] = [
  ['#ff5fa8', '#ffa3cf', '#c62f78'],
  ['#36d6c6', '#9af5ea', '#1b958a'],
  ['#ffd23f', '#fff09a', '#d39a12'],
  ['#9b6bff', '#c9b0ff', '#6a3fd0'],
];

/** A chunky pixel block: notched corners, dark outline, bevel light and shade, and a glint. */
function Pix({ x, y, w, h, fill, hi, lo, p = 6, line = INK, glint = true }: { x: number; y: number; w: number; h: number; fill: string; hi?: string; lo?: string; p?: number; line?: string; glint?: boolean; key?: React.Key }) {
  return (
    <g shapeRendering="crispEdges">
      <rect x={x + p} y={y} width={w - 2 * p} height={h} fill={line} />
      <rect x={x} y={y + p} width={w} height={h - 2 * p} fill={line} />
      <rect x={x + 2 * p} y={y + p} width={w - 4 * p} height={h - 2 * p} fill={fill} />
      <rect x={x + p} y={y + 2 * p} width={w - 2 * p} height={h - 4 * p} fill={fill} />
      {hi && <rect x={x + 2 * p} y={y + p} width={w - 4 * p} height={p} fill={hi} />}
      {hi && <rect x={x + p} y={y + 2 * p} width={p} height={h - 4 * p} fill={hi} />}
      {lo && <rect x={x + 2 * p} y={y + h - 2 * p} width={w - 4 * p} height={p} fill={lo} />}
      {lo && <rect x={x + w - 2 * p} y={y + 2 * p} width={p} height={h - 4 * p} fill={lo} />}
      {glint && <rect x={x + 2 * p} y={y + 2 * p} width={p} height={p} fill="#ffffff" opacity={0.9} />}
    </g>
  );
}

/** Little four-point pixel star. */
function PixStar({ x, y, c = '#ffe04a', s = 4, delay = 0 }: { x: number; y: number; c?: string; s?: number; delay?: number; key?: React.Key }) {
  return (
    <g shapeRendering="crispEdges" className="pix-twinkle" style={{ animationDelay: `${delay}s` }}>
      <rect x={x - s / 2} y={y - s * 1.5} width={s} height={s * 3} fill={c} />
      <rect x={x - s * 1.5} y={y - s / 2} width={s * 3} height={s} fill={c} />
      <rect x={x - s / 2} y={y - s / 2} width={s} height={s} fill="#fff" />
    </g>
  );
}

export function Bed({ level, placed, grumpiness, onPersonTap, shakeKey, gridRef, dropCol, fart, growling }: BedProps) {
  const { rows, cols } = level;
  const innerW = cols * S;
  const innerH = rows * S;
  const W = innerW + FRAME * 2;
  const H = HEAD + innerH + FOOT;
  const pillowCount = Math.max(1, Math.round(cols / 2));
  const pillowW = innerW / pillowCount;

  // Which squares are taken (Rosie, items, anyone in bed) and which are still free.
  const taken = new Set<string>();
  level.dogCells.forEach((c) => taken.add(`${c.r},${c.c}`));
  level.obstacles.forEach((o) => taken.add(`${o.r},${o.c}`));
  (['boyfriend', 'girlfriend'] as PersonId[]).forEach((id) => {
    const p = placed[id];
    if (p) poseCellsAt(p.pose, p.col).forEach((c) => taken.add(`${c.r},${c.c}`));
  });
  const allCells = Array.from({ length: rows * cols }, (_, i) => ({ r: Math.floor(i / cols), c: i % cols }));
  const freeCells = allCells.filter((c) => !taken.has(`${c.r},${c.c}`));
  const takenCells = allCells.filter((c) => taken.has(`${c.r},${c.c}`));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block select-none" style={{ maxHeight: 'min(44vh, 430px)', margin: '0 auto', touchAction: 'manipulation' }} role="img" aria-label="The bed">
      {/* Headboard: stepped pixel arch in shiny purple */}
      <g shapeRendering="crispEdges">
        {[
          [0, 30, W, HEAD + 30],
          [12, 18, W - 24, 20],
          [30, 8, W - 60, 20],
          [W * 0.3, 0, W * 0.4, 16],
        ].map(([x, y, w, h], i) => (
          <rect key={`hbo${i}`} x={x} y={y} width={w} height={h} fill={INK} />
        ))}
        {[
          [6, 36, W - 12, HEAD + 20],
          [18, 24, W - 36, 20],
          [36, 14, W - 72, 20],
          [W * 0.3 + 6, 6, W * 0.4 - 12, 16],
        ].map(([x, y, w, h], i) => (
          <rect key={`hb${i}`} x={x} y={y} width={w} height={h} fill="#7b3fe4" />
        ))}
        {/* shine along the top edge */}
        <rect x={W * 0.3 + 6} y={6} width={W * 0.4 - 12} height={6} fill="#c9a6ff" />
        <rect x={36} y={14} width={W * 0.3 - 30} height={6} fill="#b48cff" />
        <rect x={W * 0.7} y={14} width={W * 0.3 - 36} height={6} fill="#b48cff" />
        <rect x={18} y={24} width={18} height={6} fill="#a47cff" />
        <rect x={W - 36} y={24} width={18} height={6} fill="#a47cff" />
        {/* inset night-sky panel */}
        <rect x={FRAME + 8} y={32} width={innerW - 16} height={HEAD - 40} fill={INK} />
        <rect x={FRAME + 14} y={38} width={innerW - 28} height={HEAD - 52} fill="#2b1a6e" />
      </g>
      {/* moon + twinkling stars on the headboard */}
      <g shapeRendering="crispEdges">
        <rect x={FRAME + 30} y={44} width={14} height={14} fill="#fff3b0" />
        <rect x={FRAME + 26} y={48} width={22} height={6} fill="#fff3b0" />
        <rect x={FRAME + 38} y={44} width={10} height={10} fill="#2b1a6e" />
      </g>
      {Array.from({ length: cols + 1 }).map((_, i) => (
        <PixStar key={i} x={FRAME + 80 + (i * (innerW - 110)) / cols} y={i % 2 ? 46 : 56} c={['#ffe04a', '#3ff3ff', '#ff4fd8'][i % 3]} s={3 + (i % 2)} delay={i * 0.37} />
      ))}

      {/* Side posts with gold knobs */}
      {[0, W - FRAME].map((x) => (
        <g key={x}>
          <Pix x={x} y={HEAD - 10} w={FRAME} h={innerH + 30} fill="#7b3fe4" hi="#b48cff" lo="#4e22a8" p={4} glint={false} />
          <Pix x={x - 2} y={HEAD - 26} w={FRAME + 4} h={20} fill="#ffc83a" hi="#fff3a6" lo="#c98a00" p={4} />
        </g>
      ))}

      {/* Mattress */}
      <rect x={FRAME - 4} y={HEAD - 6} width={innerW + 8} height={innerH + 12} fill={INK} shapeRendering="crispEdges" />
      <rect x={FRAME} y={HEAD - 2} width={innerW} height={innerH + 4} fill="#f2ecff" shapeRendering="crispEdges" />

      <g transform={`translate(${FRAME} ${HEAD})`}>
        {/* Pillow row (row 0) */}
        {Array.from({ length: pillowCount }).map((_, i) => (
          <Pix key={i} x={i * pillowW + 6} y={6} w={pillowW - 12} h={S * 0.8} fill="#ffffff" hi="#ffffff" lo="#cfd4ff" p={6} />
        ))}
        {Array.from({ length: pillowCount }).map((_, i) => (
          <rect key={`ps${i}`} x={i * pillowW + 30} y={S * 0.42} width={pillowW - 60} height={4} fill="#dfe3ff" shapeRendering="crispEdges" />
        ))}

        {/* Duvet: shiny pixel patchwork from row 1 down */}
        <rect x={0} y={S - 4} width={innerW} height={innerH - S + 4} fill={INK} shapeRendering="crispEdges" />
        {Array.from({ length: rows - 1 }).map((_, ri) =>
          Array.from({ length: cols }).map((__, c) => {
            const r = ri + 1;
            const [f, hi, lo] = QUILT[(r * 3 + c) % 4];
            return (
              <g key={`${r}-${c}`}>
                <Pix x={c * S + 2} y={r * S + 2} w={S - 4} h={S - 4} fill={f} hi={hi} lo={lo} p={5} />
                {/* pixel stitching */}
                <rect x={c * S + 22} y={r * S + 22} width={S - 44} height={S - 44} fill="none" stroke={lo} strokeWidth={3} strokeDasharray="6 6" opacity={0.7} shapeRendering="crispEdges" />
              </g>
            );
          })
        )}
        {/* Folded duvet cuff */}
        <rect x={-2} y={S - 10} width={innerW + 4} height={18} fill={INK} shapeRendering="crispEdges" />
        <rect x={2} y={S - 7} width={innerW - 4} height={12} fill="#ffffff" shapeRendering="crispEdges" />
        {Array.from({ length: Math.floor(innerW / 24) }).map((_, i) => (
          <rect key={`cf${i}`} x={8 + i * 24} y={S - 3} width={12} height={4} fill={['#ff4fd8', '#3ff3ff', '#ffe04a'][i % 3]} shapeRendering="crispEdges" />
        ))}

        {/* Taken squares sink into shadow, so the free ones stand out */}
        {takenCells.map((c) => (
          <rect key={`tk${c.r}-${c.c}`} x={c.c * S + 2} y={c.r * S + 2} width={S - 4} height={S - 4} fill="#1b0f3d" opacity={0.42} shapeRendering="crispEdges" style={{ pointerEvents: 'none' }} />
        ))}

        {/* Toys and treats */}
        {level.obstacles.map((o) => (
          <foreignObject key={o.id} x={o.c * S + 12} y={o.r * S + 12} width={S - 24} height={S - 24} style={{ pointerEvents: 'none' }}>
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ObstacleIcon type={o.type} className="w-full h-full" />
            </div>
          </foreignObject>
        ))}

        {/* Rosie */}
        <motion.g key={shakeKey} animate={shakeKey ? { x: [0, -6, 6, -4, 4, 0] } : undefined} transition={{ duration: 0.4 }}>
          <DogFigure cells={level.dogCells} grumpy={grumpiness} growling={growling} />
        </motion.g>

        {/* People in bed */}
        {(['boyfriend', 'girlfriend'] as PersonId[]).map((id, k) => {
          const p = placed[id];
          if (!p) return null;
          return (
            <motion.g
              key={`${id}-${p.pose.id}-${p.col}`}
              initial={{ y: -innerH * 0.9, opacity: 0.4 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18 }}
              onClick={() => onPersonTap(id)}
              style={{ cursor: 'pointer' }}
            >
              <PersonFigure pose={p.pose} col={p.col} who={id} phase={k * 0.37} />
            </motion.g>
          );
        })}

        {/* Stink cloud */}
        {fart && (
          <g key={fart.key} style={{ pointerEvents: 'none' }}>
            {fart.cells.map((cell, i) =>
              [0, 1, 2, 3, 4].map((k) => {
                const cx = cell.c * S + S / 2 + (k - 2) * 16;
                const cy = cell.r * S + S / 2 + (k % 2) * 12;
                return (
                  <motion.circle
                    key={`${i}-${k}`}
                    cx={cx}
                    cy={cy}
                    r={18 + (k % 3) * 6}
                    fill={k % 2 ? '#9cc95a' : '#b7d97a'}
                    stroke="#7aa63c"
                    strokeWidth={2}
                    initial={{ opacity: 0, scale: 0.2, y: 0 }}
                    animate={{ opacity: [0, 0.85, 0.7, 0], scale: [0.2, 1.1, 1.4, 1.8], y: [0, -10, -30, -55], x: [0, (k - 2) * 4, (k - 2) * 8, (k - 2) * 12] }}
                    transition={{ duration: 1.8, delay: k * 0.06, ease: 'easeOut' }}
                  />
                );
              })
            )}
            {fart.cells.slice(0, 1).map((cell) => (
              <motion.text
                key="pff"
                x={cell.c * S + S / 2}
                y={cell.r * S + 22}
                textAnchor="middle"
                fontSize={26}
                fontWeight={900}
                fill="#4d7a1f"
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: [0, 1, 1, 0], scale: [0.4, 1.2, 1, 1], y: [0, -12, -24, -36] }}
                transition={{ duration: 1.6 }}
              >
                PFFRT!
              </motion.text>
            ))}
          </g>
        )}

        {/* Free squares: glowing pixel corner brackets */}
        <g className="free-pulse" style={{ pointerEvents: 'none' }} shapeRendering="crispEdges">
          {freeCells.map((c) => {
            const x = c.c * S + 8;
            const y = c.r * S + 8;
            const L = 20;
            const T = 6;
            const w = S - 16;
            return (
              <g key={`fr${c.r}-${c.c}`}>
                <rect x={x} y={y} width={w} height={w} fill="#3ff3ff" opacity={0.1} />
                {[
                  [x, y, L, T], [x, y, T, L],
                  [x + w - L, y, L, T], [x + w - T, y, T, L],
                  [x, y + w - T, L, T], [x, y + w - L, T, L],
                  [x + w - L, y + w - T, L, T], [x + w - T, y + w - L, T, L],
                ].map(([rx, ry, rw, rh], k) => (
                  <rect key={k} x={rx} y={ry} width={rw} height={rh} fill="#3ff3ff" stroke="#1b0f3d" strokeWidth={1.5} />
                ))}
              </g>
            );
          })}
        </g>

        {/* While dragging: only mark which pillow the head is over */}
        {dropCol && (
          <rect x={dropCol.col * S + 4} y={4} width={dropCol.width * S - 8} height={S * 0.8} fill="rgba(63,243,255,0.25)" stroke="#3ff3ff" strokeWidth={4} strokeDasharray="10 8" shapeRendering="crispEdges" style={{ pointerEvents: 'none' }} />
        )}

        <rect ref={gridRef} x={0} y={0} width={innerW} height={innerH} fill="transparent" style={{ pointerEvents: 'none' }} />
        {/* Placed people stay tappable above the tap grid */}
        {(['boyfriend', 'girlfriend'] as PersonId[]).map((id) => {
          const p = placed[id];
          if (!p) return null;
          return poseCellsAt(p.pose, p.col).map((cell, i) => (
            <rect key={`${id}-hit-${i}`} x={cell.c * S} y={cell.r * S} width={S} height={S} fill="transparent" onClick={() => onPersonTap(id)} style={{ cursor: 'pointer' }} />
          ));
        })}
      </g>

      {/* Footboard */}
      <Pix x={0} y={HEAD + innerH + 2} w={W} h={FOOT - 10} fill="#7b3fe4" hi="#b48cff" lo="#4e22a8" p={5} />
      {Array.from({ length: cols }).map((_, i) => (
        <rect key={`fs${i}`} x={FRAME + i * S + S / 2 - 6} y={HEAD + innerH + 12} width={12} height={8} fill="#ffc83a" shapeRendering="crispEdges" />
      ))}
      <rect x={6} y={H - 10} width={16} height={10} fill={INK} shapeRendering="crispEdges" />
      <rect x={W - 22} y={H - 10} width={16} height={10} fill={INK} shapeRendering="crispEdges" />
    </svg>
  );
}
