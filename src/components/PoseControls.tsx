import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, ChevronRight, LogOut, Check, Hand } from 'lucide-react';
import { Pose } from '../utils/puzzle';
import { LOOKS, PoseShape, S, poseViewBox } from './Figures';
import type { PersonId } from './Bed';

interface Props {
  selected: PersonId | null;
  names: Record<PersonId, string>;
  photos: Record<PersonId, string>;
  poses: Record<PersonId, Pose[]>;
  poseIdx: Record<PersonId, number>;
  isPlaced: Record<PersonId, boolean>;
  isDragging: boolean;
  draggingId?: PersonId | null;
  onSelect: (id: PersonId) => void;
  onCyclePose: (id: PersonId, dir: 1 | -1) => void;
  onStartDrag: (id: PersonId, grab: { r: number; c: number }, e: React.PointerEvent) => void;
  onGetOut: (id: PersonId) => void;
}

const IDS: PersonId[] = ['boyfriend', 'girlfriend'];

const PREVIEW_H = 112;
const PREVIEW_W = 150;

/** Both people side by side: flip each one's poses and compare which pair will fit. */
export function PoseControls(p: Props) {
  const startDrag = (id: PersonId, e: React.PointerEvent) => {
    if (p.isPlaced[id]) return;
    // Pick the current pose's preview (an outgoing one may still be animating out).
    const svg = (e.currentTarget as HTMLElement).querySelector(`svg[data-pose="${p.poseIdx[id]}"]`);
    if (!svg) return;
    e.preventDefault();
    const pose = p.poses[id][p.poseIdx[id]];
    const rect = svg.getBoundingClientRect();
    const vb = poseViewBox(pose);
    const ux = ((e.clientX - rect.left) / rect.width) * vb.w + vb.x;
    const uy = ((e.clientY - rect.top) / rect.height) * vb.h + vb.y;
    const grab = {
      r: Math.max(0, Math.min(pose.height - 1, Math.floor(uy / S))),
      c: Math.max(0, Math.min(pose.width - 1, Math.floor(ux / S))),
    };
    p.onSelect(id);
    p.onStartDrag(id, grab, e);
  };

  return (
    <div className="px-3 pb-4 pt-3 flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2.5">
        {IDS.map((id, n) => {
          const ring = LOOKS[id].ring;
          const placed = p.isPlaced[id];
          const pose = p.poses[id][p.poseIdx[id]];
          const vb = poseViewBox(pose);
          const k = Math.min(PREVIEW_H / vb.h, PREVIEW_W / vb.w);
          const dragging = p.isDragging && p.draggingId === id;
          return (
            <div
              key={id}
              className="relative pixel-panel px-1.5 pt-3 pb-2 flex flex-col items-center min-w-0"
              style={{ borderColor: ring, boxShadow: `0 0 0 3px #05030f, 0 0 12px ${ring}, 0 6px 0 3px #05030f` }}
            >
              <span className="absolute -top-2.5 left-1.5 font-arcade text-[8px] px-1 py-0.5 border-2 border-[#05030f]" style={{ background: ring, color: '#fff' }}>
                P{n + 1}
              </span>
              {/* name + photo */}
              <div className="w-full flex items-center gap-1.5 px-0.5">
                <img src={p.photos[id]} alt="" className="w-7 h-7 rounded-sm object-cover border-2 shrink-0" style={{ borderColor: ring }} />
                <span className="font-arcade text-[9px] uppercase truncate">{p.names[id]}</span>
                {!placed && (
                  <span className="ml-auto font-arcade text-[7px] text-[#8f86d6] whitespace-nowrap">
                    {p.poseIdx[id] + 1}/{p.poses[id].length}
                  </span>
                )}
                {placed && (
                  <span className="ml-auto inline-flex items-center gap-0.5 font-arcade text-[7px] neon-green whitespace-nowrap">
                    <Check className="w-3 h-3" />
                    BED
                  </span>
                )}
              </div>

              {/* draggable pose preview */}
              <div
                className={`relative w-full mt-1.5 flex items-center justify-center transition-opacity ${dragging ? 'opacity-25' : placed ? 'opacity-35' : ''}`}
                style={{
                  height: PREVIEW_H + 6,
                  touchAction: 'none',
                  cursor: placed ? 'default' : 'grab',
                  background: 'radial-gradient(ellipse at center, rgba(63,243,255,0.16), transparent 70%)',
                }}
                onPointerDown={(e) => startDrag(id, e)}
              >
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.svg
                    key={`${id}-${p.poseIdx[id]}`}
                    data-pose={p.poseIdx[id]}
                    viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
                    style={{ width: vb.w * k, height: vb.h * k, filter: 'drop-shadow(0 0 6px rgba(63,243,255,0.35))' }}
                    initial={{ opacity: 0, scale: 0.6, x: 24 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.6, x: -24 }}
                    transition={{ type: 'spring', stiffness: 520, damping: 24 }}
                    aria-label={`${p.names[id]}: ${pose.name}`}
                  >
                    <PoseShape pose={pose} who={id} />
                  </motion.svg>
                </AnimatePresence>
              </div>

              {/* pose switcher or get-out */}
              {placed ? (
                <button onClick={() => p.onGetOut(id)} className="arcade-btn btn-yellow w-full h-10 mt-1.5 font-arcade text-[8px] flex items-center justify-center gap-1">
                  <LogOut className="w-3.5 h-3.5" /> GET OUT
                </button>
              ) : (
                <div className="w-full flex items-center gap-1 mt-1.5">
                  <button onClick={() => p.onCyclePose(id, -1)} className="arcade-btn btn-pink w-10 h-10 shrink-0 flex items-center justify-center" aria-label={`Previous pose for ${p.names[id]}`}>
                    <ChevronLeft className="w-6 h-6" strokeWidth={3} />
                  </button>
                  <div className="flex-1 min-w-0 text-center leading-tight">
                    <div className="font-arcade text-[7px] neon-cyan uppercase leading-[1.5] break-words">{pose.name}</div>
                  </div>
                  <button onClick={() => p.onCyclePose(id, 1)} className="arcade-btn btn-pink w-10 h-10 shrink-0 flex items-center justify-center" aria-label={`Next pose for ${p.names[id]}`}>
                    <ChevronRight className="w-6 h-6" strokeWidth={3} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="font-pixel text-[12px] text-center text-[#b9b0f5] leading-snug inline-flex items-center justify-center gap-1">
        <Hand className="w-3.5 h-3.5" /> <span className="blink">DRAG</span> each one onto the bed. Heads on pillows!
      </p>
    </div>
  );
}
