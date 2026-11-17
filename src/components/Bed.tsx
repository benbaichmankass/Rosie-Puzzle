import React from 'react';
import { motion } from 'motion/react';
import { PuzzleLevel, Pose, poseCellsAt } from '../utils/puzzle';
import { ObstacleIcon } from './ObstacleIcon';
import { DogFigure, PALETTES, PersonFigure, S } from './Figures';

export type PersonId = 'boyfriend' | 'girlfriend';

export interface PlacedPerson {
  pose: Pose;
  col: number;
}

export interface Ghost {
  id: PersonId;
  pose: Pose;
  col: number;
  conflicts: Set<string>;
}

interface BedProps {
  level: PuzzleLevel;
  placed: Partial<Record<PersonId, PlacedPerson>>;
  ghost: Ghost | null;
  photos: Record<PersonId | 'dog', string>;
  grumpiness: number;
  onCellTap: (r: number, c: number) => void;
  onPersonTap: (id: PersonId) => void;
  shakeKey: number;
}

const FRAME = 22; // side posts
const HEAD = 92; // headboard above the pillows
const FOOT = 46; // footboard

// Patchwork quilt colours, alternating like a checker.
const QUILT = ['#f4c7a1', '#f9e2c8', '#cfe0c3', '#f9e2c8'];

export function Bed({ level, placed, ghost, photos, grumpiness, onCellTap, onPersonTap, shakeKey }: BedProps) {
  const { rows, cols } = level;
  const innerW = cols * S;
  const innerH = rows * S;
  const W = innerW + FRAME * 2;
  const H = HEAD + innerH + FOOT;
  const pillowCount = Math.max(1, Math.round(cols / 2));
  const pillowW = innerW / pillowCount;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block select-none" style={{ maxHeight: '58vh', touchAction: 'manipulation' }} role="img" aria-label="The bed">
      <defs>
        <linearGradient id="wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9a6845" />
          <stop offset="1" stopColor="#6f4429" />
        </linearGradient>
        <linearGradient id="woodLight" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b98559" />
          <stop offset="1" stopColor="#94623f" />
        </linearGradient>
        <linearGradient id="pillow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#ece6dc" />
        </linearGradient>
      </defs>

      {/* Headboard */}
      <path
        d={`M0 ${HEAD + 40} L0 34 Q0 8 30 6 Q${W / 2} -10 ${W - 30} 6 Q${W} 8 ${W} 34 L${W} ${HEAD + 40} Z`}
        fill="url(#wood)"
      />
      <path
        d={`M${FRAME + 6} ${HEAD + 10} L${FRAME + 6} 40 Q${FRAME + 6} 24 ${FRAME + 28} 22 Q${W / 2} 10 ${W - FRAME - 28} 22 Q${W - FRAME - 6} 24 ${W - FRAME - 6} 40 L${W - FRAME - 6} ${HEAD + 10} Z`}
        fill="url(#woodLight)"
      />
      {Array.from({ length: cols * 2 - 1 }).map((_, i) => (
        <circle key={i} cx={FRAME + ((i + 1) * innerW) / (cols * 2)} cy={52} r={4} fill="#7a4b2d" opacity={0.6} />
      ))}

      {/* Side posts */}
      <rect x={0} y={HEAD - 10} width={FRAME} height={innerH + 30} rx={8} fill="url(#wood)" />
      <rect x={W - FRAME} y={HEAD - 10} width={FRAME} height={innerH + 30} rx={8} fill="url(#wood)" />

      {/* Mattress + sheet */}
      <rect x={FRAME - 4} y={HEAD - 6} width={innerW + 8} height={innerH + 12} rx={16} fill="#fffaf2" stroke="#e8dccb" strokeWidth={3} />

      <g transform={`translate(${FRAME} ${HEAD})`}>
        {/* Pillow row (row 0) */}
        {Array.from({ length: pillowCount }).map((_, i) => (
          <g key={i}>
            <rect x={i * pillowW + 8} y={6} width={pillowW - 16} height={S * 0.8} rx={30} fill="url(#pillow)" stroke="#ddd2c2" strokeWidth={3} />
            <path d={`M${i * pillowW + 26} ${S * 0.45} Q${i * pillowW + pillowW / 2} ${S * 0.38} ${(i + 1) * pillowW - 26} ${S * 0.45}`} stroke="#e1d6c6" strokeWidth={3} fill="none" />
          </g>
        ))}

        {/* Duvet: patchwork squares from row 1 down */}
        <rect x={0} y={S - 4} width={innerW} height={innerH - S + 4} rx={10} fill="#e9b88f" />
        {Array.from({ length: rows - 1 }).map((_, ri) =>
          Array.from({ length: cols }).map((__, c) => {
            const r = ri + 1;
            return (
              <g key={`${r}-${c}`}>
                <rect x={c * S + 3} y={r * S + 3} width={S - 6} height={S - 6} rx={8} fill={QUILT[(r + c) % 2 === 0 ? 0 : 1 + (c % 3 === 0 ? 1 : 0)]} />
                <rect x={c * S + 11} y={r * S + 11} width={S - 22} height={S - 22} rx={5} fill="none" stroke="#c98d63" strokeWidth={2} strokeDasharray="7 6" opacity={0.6} />
              </g>
            );
          })
        )}
        {/* Folded duvet cuff */}
        <rect x={-2} y={S - 10} width={innerW + 4} height={18} rx={9} fill="#fffaf2" stroke="#e5d6c2" strokeWidth={2} />
        <path d={`M8 ${S - 1} H${innerW - 8}`} stroke="#9fc1d9" strokeWidth={3} strokeDasharray="14 8" />
        {/* Pillow-row squares, shown faintly */}
        {Array.from({ length: cols }).map((_, c) => (
          <rect key={c} x={c * S + 4} y={4} width={S - 8} height={S - 18} rx={10} fill="none" stroke="#d8c8b4" strokeWidth={2} strokeDasharray="5 7" />
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
          <DogFigure cells={level.dogCells} photo={photos.dog} grumpy={grumpiness} />
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
              <PersonFigure pose={p.pose} col={p.col} photo={photos[id]} palette={PALETTES[id]} delay={k * 1.3} />
            </motion.g>
          );
        })}

        {/* Ghost preview of where the selected person would go */}
        {ghost && (
          <g style={{ pointerEvents: 'none' }}>
            {poseCellsAt(ghost.pose, ghost.col).map((cell, i) => {
              const bad = ghost.conflicts.has(`${cell.r},${cell.c}`);
              return (
                <rect
                  key={i}
                  x={cell.c * S + 5}
                  y={cell.r * S + 5}
                  width={S - 10}
                  height={S - 10}
                  rx={12}
                  fill={bad ? 'rgba(225,60,60,0.28)' : 'rgba(80,170,120,0.18)'}
                  stroke={bad ? '#d64545' : '#3f9a6c'}
                  strokeWidth={3}
                  strokeDasharray="8 6"
                />
              );
            })}
            <g opacity={0.5}>
              <PersonFigure pose={ghost.pose} col={ghost.col} photo={photos[ghost.id]} palette={PALETTES[ghost.id]} sleeping={false} />
            </g>
          </g>
        )}

        {/* Tap targets for empty squares */}
        {Array.from({ length: rows }).map((_, r) =>
          Array.from({ length: cols }).map((__, c) => (
            <rect key={`t${r}-${c}`} x={c * S} y={r * S} width={S} height={S} fill="transparent" onClick={() => onCellTap(r, c)} style={{ cursor: 'pointer' }} />
          ))
        )}
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
      <rect x={0} y={HEAD + innerH + 4} width={W} height={FOOT - 14} rx={12} fill="url(#wood)" />
      <rect x={10} y={HEAD + innerH + 10} width={W - 20} height={8} rx={4} fill="#b98559" opacity={0.5} />
      <rect x={6} y={H - 14} width={16} height={14} rx={3} fill="#5c3720" />
      <rect x={W - 22} y={H - 14} width={16} height={14} rx={3} fill="#5c3720" />
    </svg>
  );
}
