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
    <div className="px-3 pb-4 pt-2 flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        {IDS.map((pid) => {
          const active = pid === id;
          const ring = LOOKS[pid].ring;
          return (
            <button
              key={pid}
              onClick={() => p.onSelect(pid)}
              className={`flex items-center gap-2 rounded-2xl px-2 py-1.5 border-2 text-left transition-all active:scale-[0.98] ${
                active ? 'bg-white shadow-sm' : 'bg-amber-100/60 border-transparent'
              }`}
              style={{ borderColor: active ? ring : 'transparent' }}
            >
              <img src={p.photos[pid]} alt="" className="w-9 h-9 rounded-full object-cover border-2" style={{ borderColor: ring }} />
              <span className="min-w-0">
                <span className="block text-sm font-bold leading-tight truncate">{p.names[pid]}</span>
                <span className="block text-[11px] text-amber-900/70 leading-tight">
                  {p.isPlaced[pid] ? (
                    <span className="inline-flex items-center gap-0.5 text-emerald-700 font-semibold">
                      <Check className="w-3 h-3" /> In bed
                    </span>
                  ) : (
                    `Pose ${p.poseIdx[pid] + 1} of ${p.poses[pid].length}`
                  )}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {id && !p.isPlaced[id] ? (
        <div className="rounded-3xl bg-white/80 border border-amber-200 shadow-sm p-3 flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => p.onCyclePose(id, -1)}
              className="w-11 h-11 shrink-0 rounded-full bg-amber-100 hover:bg-amber-200 flex items-center justify-center active:scale-95"
              aria-label="Previous pose"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div
              className={`flex-1 min-w-0 h-[122px] flex items-center justify-center rounded-2xl transition-opacity ${p.isDragging ? 'opacity-25' : ''}`}
              style={{ touchAction: 'none', cursor: 'grab' }}
              onPointerDown={startDrag}
            >
              <AnimatePresence mode="popLayout" initial={false}>
                {(() => {
                  const pose = p.poses[id][p.poseIdx[id]];
                  const vb = poseViewBox(pose);
                  const h = 116;
                  return (
                    <motion.svg
                      key={`${id}-${p.poseIdx[id]}`}
                      data-pose={p.poseIdx[id]}
                      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
                      style={{ height: h, width: (h * vb.w) / vb.h, maxWidth: '100%' }}
                      initial={{ opacity: 0, scale: 0.85, rotate: -4 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                      exit={{ opacity: 0, scale: 0.85, rotate: 4 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 26 }}
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
              className="w-11 h-11 shrink-0 rounded-full bg-amber-100 hover:bg-amber-200 flex items-center justify-center active:scale-95"
              aria-label="Next pose"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
          <div className="text-xs font-bold text-amber-950 text-center">
            {p.poses[id][p.poseIdx[id]].name}
            <span className="font-medium text-amber-900/60"> · {p.poseIdx[id] + 1}/{p.poses[id].length}</span>
          </div>
          <p className="text-[11px] text-center text-amber-900/70 leading-snug inline-flex items-center justify-center gap-1">
            <Hand className="w-3.5 h-3.5" /> Drag {p.names[id]} onto the bed. Heads go on the pillows.
          </p>
        </div>
      ) : id && p.isPlaced[id] ? (
        <button
          onClick={() => p.onGetOut(id)}
          className="h-12 rounded-2xl bg-amber-200 hover:bg-amber-300 font-bold text-amber-950 flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          <LogOut className="w-4 h-4" /> Get {p.names[id]} out of bed
        </button>
      ) : (
        <div className="rounded-3xl bg-white/70 border border-amber-200 p-3 text-center text-sm text-amber-900">
          Both of you are in bed. Tap someone to get them out and try another pose.
        </div>
      )}
    </div>
  );
}
