import React from 'react';
import { ChevronLeft, ChevronRight, ArrowLeft, ArrowRight, BedDouble, LogOut, Check } from 'lucide-react';
import { Pose } from '../utils/puzzle';
import { PALETTES, PosePreview } from './Figures';
import type { PersonId } from './Bed';

interface Props {
  selected: PersonId | null;
  names: Record<PersonId, string>;
  photos: Record<PersonId, string>;
  poses: Record<PersonId, Pose[]>;
  poseIdx: Record<PersonId, number>;
  isPlaced: Record<PersonId, boolean>;
  canTuck: boolean;
  onSelect: (id: PersonId) => void;
  onCyclePose: (id: PersonId, dir: 1 | -1) => void;
  onMove: (id: PersonId, dir: 1 | -1) => void;
  onTuckIn: (id: PersonId) => void;
  onGetOut: (id: PersonId) => void;
}

const IDS: PersonId[] = ['boyfriend', 'girlfriend'];

export function PoseControls(p: Props) {
  const id = p.selected;
  return (
    <div className="px-3 pb-4 pt-2 flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        {IDS.map((pid) => {
          const active = pid === id;
          const pal = PALETTES[pid];
          return (
            <button
              key={pid}
              onClick={() => p.onSelect(pid)}
              className={`flex items-center gap-2 rounded-2xl px-2 py-1.5 border-2 text-left transition-all active:scale-[0.98] ${
                active ? 'bg-white shadow-sm' : 'bg-amber-100/60 border-transparent'
              }`}
              style={{ borderColor: active ? pal.ring : 'transparent' }}
            >
              <img src={p.photos[pid]} alt="" className="w-9 h-9 rounded-full object-cover border-2" style={{ borderColor: pal.ring }} />
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

      {id ? (
        <div className="rounded-3xl bg-white/80 border border-amber-200 shadow-sm p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => p.onCyclePose(id, -1)}
              disabled={p.isPlaced[id]}
              className="w-11 h-11 shrink-0 rounded-full bg-amber-100 hover:bg-amber-200 disabled:opacity-30 flex items-center justify-center active:scale-95"
              aria-label="Previous pose"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div className="flex-1 min-w-0 flex flex-col items-center">
              <div className="h-[118px] flex items-center justify-center">
                <PosePreview pose={p.poses[id][p.poseIdx[id]]} photo={p.photos[id]} palette={PALETTES[id]} height={112} />
              </div>
              <div className="text-xs font-bold text-amber-950 text-center">
                {p.poses[id][p.poseIdx[id]].name}
                <span className="font-medium text-amber-900/60">
                  {' '}
                  · {p.poseIdx[id] + 1}/{p.poses[id].length}
                </span>
              </div>
            </div>
            <button
              onClick={() => p.onCyclePose(id, 1)}
              disabled={p.isPlaced[id]}
              className="w-11 h-11 shrink-0 rounded-full bg-amber-100 hover:bg-amber-200 disabled:opacity-30 flex items-center justify-center active:scale-95"
              aria-label="Next pose"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          {p.isPlaced[id] ? (
            <button
              onClick={() => p.onGetOut(id)}
              className="h-11 rounded-2xl bg-amber-200 hover:bg-amber-300 font-bold text-amber-950 flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <LogOut className="w-4 h-4" /> Get {p.names[id]} out of bed
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => p.onMove(id, -1)}
                className="w-11 h-11 shrink-0 rounded-2xl bg-amber-100 hover:bg-amber-200 flex items-center justify-center active:scale-95"
                aria-label="Move left"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => p.onTuckIn(id)}
                className={`flex-1 h-11 rounded-2xl font-bold text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-colors ${
                  p.canTuck ? '' : 'opacity-80'
                }`}
                style={{ background: p.canTuck ? PALETTES[id].ring : '#b4776a' }}
              >
                <BedDouble className="w-5 h-5" /> Tuck {p.names[id]} in
              </button>
              <button
                onClick={() => p.onMove(id, 1)}
                className="w-11 h-11 shrink-0 rounded-2xl bg-amber-100 hover:bg-amber-200 flex items-center justify-center active:scale-95"
                aria-label="Move right"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}
          <p className="text-[11px] text-center text-amber-900/70 leading-snug">
            Flip through poses, then tap a pillow column on the bed to move. Tap the same spot again to tuck in.
          </p>
        </div>
      ) : (
        <div className="rounded-3xl bg-white/70 border border-amber-200 p-3 text-center text-sm text-amber-900">
          Both of you are in bed. Tap someone to get them out and try another pose.
        </div>
      )}
    </div>
  );
}
