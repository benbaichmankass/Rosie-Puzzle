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
  onSelect: (id: PersonId) => void;
  onCyclePose: (id: PersonId, dir: 1 | -1) => void;
  onStartDrag: (id: PersonId, grab: { r: number; c: number }, e: React.PointerEvent) => void;
  onGetOut: (id: PersonId) => void;
}

const IDS: PersonId[] = ['boyfriend', 'girlfriend'];

export function PoseControls(p: Props) {
  const id = p.selected;

  const startDrag = (e: React.PointerEvent) => {
    if (!id || p.isPlaced[id]) return;
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
    p.onStartDrag(id, grab, e);
  };

  return (
    <div className="px-3 pb-4 pt-3 flex flex-col gap-2.5">
      <div className="grid grid-cols-2 gap-2">
        {IDS.map((pid, n) => {
          const active = pid === id;
          const ring = LOOKS[pid].ring;
          return (
            <button
              key={pid}
              onClick={() => p.onSelect(pid)}
              className={`relative flex items-center gap-2 px-2 py-1.5 text-left pixel-panel transition-transform active:translate-y-[2px] ${active ? '' : 'opacity-70'}`}
              style={active ? { borderColor: ring, boxShadow: `0 0 0 3px #05030f, 0 0 14px ${ring}, 0 6px 0 3px #05030f` } : undefined}
            >
              <span
                className="absolute -top-2 left-1.5 font-arcade text-[8px] px-1 py-0.5 border-2 border-[#05030f]"
                style={{ background: ring, color: '#fff' }}
              >
                P{n + 1}
              </span>
              <img src={p.photos[pid]} alt="" className="w-9 h-9 rounded-sm object-cover border-2" style={{ borderColor: ring }} />
              <span className="min-w-0">
                <span className="block font-arcade text-[10px] leading-tight truncate uppercase">{p.names[pid]}</span>
                <span className="block font-pixel text-[12px] leading-tight mt-0.5 text-[#b9b0f5]">
                  {p.isPlaced[pid] ? (
                    <span className="inline-flex items-center gap-0.5 neon-green font-semibold">
                      <Check className="w-3 h-3" /> IN BED
                    </span>
                  ) : (
                    `POSE ${p.poseIdx[pid] + 1}/${p.poses[pid].length}`
                  )}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {id && !p.isPlaced[id] ? (
        <div className="pixel-panel p-2.5 flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => p.onCyclePose(id, -1)}
              className="arcade-btn btn-pink w-12 h-12 shrink-0 flex items-center justify-center"
              aria-label="Previous pose"
            >
              <ChevronLeft className="w-7 h-7" strokeWidth={3} />
            </button>
            <div
              className={`relative flex-1 min-w-0 h-[118px] flex items-center justify-center rounded-md transition-opacity ${p.isDragging ? 'opacity-25' : ''}`}
              style={{
                touchAction: 'none',
                cursor: 'grab',
                background: 'radial-gradient(ellipse at center, rgba(63,243,255,0.16), transparent 70%)',
              }}
              onPointerDown={startDrag}
            >
              <AnimatePresence mode="popLayout" initial={false}>
                {(() => {
                  const pose = p.poses[id][p.poseIdx[id]];
                  const vb = poseViewBox(pose);
                  const h = 112;
                  return (
                    <motion.svg
                      key={`${id}-${p.poseIdx[id]}`}
                      data-pose={p.poseIdx[id]}
                      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
                      style={{ height: h, width: (h * vb.w) / vb.h, maxWidth: '100%', filter: 'drop-shadow(0 0 6px rgba(63,243,255,0.35))' }}
                      initial={{ opacity: 0, scale: 0.6, x: 30 }}
                      animate={{ opacity: 1, scale: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.6, x: -30 }}
                      transition={{ type: 'spring', stiffness: 520, damping: 24 }}
                      aria-label={`${p.names[id]}: ${pose.name}`}
                    >
                      <PoseShape pose={pose} who={id} />
                    </motion.svg>
                  );
                })()}
              </AnimatePresence>
            </div>
            <button
              onClick={() => p.onCyclePose(id, 1)}
              className="arcade-btn btn-pink w-12 h-12 shrink-0 flex items-center justify-center"
              aria-label="Next pose"
            >
              <ChevronRight className="w-7 h-7" strokeWidth={3} />
            </button>
          </div>
          <div className="text-center">
            <span className="font-arcade text-[10px] neon-cyan uppercase">{p.poses[id][p.poseIdx[id]].name}</span>
            <span className="font-arcade text-[8px] text-[#8f86d6]"> {p.poseIdx[id] + 1}/{p.poses[id].length}</span>
          </div>
          <p className="font-pixel text-[12px] text-center text-[#b9b0f5] leading-snug inline-flex items-center justify-center gap-1">
            <Hand className="w-3.5 h-3.5" /> <span className="blink">DRAG</span> {p.names[id]} onto the bed. Heads on pillows!
          </p>
        </div>
      ) : id && p.isPlaced[id] ? (
        <button onClick={() => p.onGetOut(id)} className="arcade-btn btn-yellow h-12 font-arcade text-[10px] flex items-center justify-center gap-2">
          <LogOut className="w-4 h-4" /> GET {p.names[id].toUpperCase()} OUT
        </button>
      ) : (
        <div className="pixel-panel p-3 text-center font-pixel text-[13px] text-[#cfc8ff]">
          Both of you are in bed. Tap someone to get them out and try another pose.
        </div>
      )}
    </div>
  );
}
