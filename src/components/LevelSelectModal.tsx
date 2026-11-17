import React from 'react';
import { PuzzleLevel as LevelConfig } from '../utils/puzzle';
import { X, Star, CheckCircle, Lock } from 'lucide-react';
import { sound } from '../utils/audio';

interface LevelSelectModalProps {
  isOpen: boolean;
  levels: LevelConfig[];
  currentLevelId: number;
  completedLevelIds: number[];
  cuddleBonusLevelIds: number[];
  onSelectLevel: (levelId: number) => void;
  onClose: () => void;
}

export function LevelSelectModal({
  isOpen,
  levels,
  currentLevelId,
  completedLevelIds,
  cuddleBonusLevelIds,
  onSelectLevel,
  onClose,
}: LevelSelectModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
      <div className="relative w-full max-w-sm rounded-3xl bg-amber-50 p-5 shadow-2xl border-4 border-amber-300 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-amber-200 hover:bg-amber-300 text-amber-900 transition-all active:scale-95"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-4">
          <span className="text-xs font-bold text-amber-700 bg-amber-200/70 px-3 py-1 rounded-full uppercase tracking-wider">
            Bedtime Nights
          </span>
          <h3 className="text-xl font-bold text-amber-950 mt-1">Select a Level</h3>
          <p className="text-xs text-amber-800/80">
            {completedLevelIds.length} of {levels.length} nights completed
          </p>
        </div>

        {/* Level Grid */}
        <div className="grid grid-cols-3 gap-2.5">
          {levels.map((lvl) => {
            const isCompleted = completedLevelIds.includes(lvl.id);
            const hasCuddle = cuddleBonusLevelIds.includes(lvl.id);
            const isCurrent = lvl.id === currentLevelId;

            return (
              <button
                key={lvl.id}
                onClick={() => {
                  onSelectLevel(lvl.id);
                  sound.playPop();
                  onClose();
                }}
                className={`relative p-3 rounded-2xl flex flex-col items-center justify-center transition-all border-2 text-center active:scale-95 ${
                  isCurrent
                    ? 'bg-amber-400 border-amber-600 text-amber-950 shadow-md ring-2 ring-amber-300'
                    : isCompleted
                    ? 'bg-white border-amber-300 text-amber-950 hover:bg-amber-100/60 shadow-xs'
                    : 'bg-stone-100 border-stone-200 text-stone-700 hover:bg-stone-200/70'
                }`}
              >
                {/* Completed badge */}
                {isCompleted && (
                  <div className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white rounded-full p-0.5 shadow-xs">
                    <CheckCircle className="w-3.5 h-3.5" />
                  </div>
                )}

                <span className="text-sm font-black mb-0.5">Night {lvl.id}</span>
                <span className="text-[9px] text-amber-900/80 font-bold truncate max-w-full">
                  {lvl.dogPose === 'starfish'
                    ? '⭐ Starfish'
                    : lvl.dogPose === 'loaf'
                    ? '🍞 Loaf'
                    : '🐾 Sleepy'}
                </span>

                {/* Stars / Cuddle */}
                <div className="flex items-center gap-0.5 mt-1">
                  <Star
                    className={`w-3 h-3 ${
                      isCompleted
                        ? 'text-amber-500 fill-amber-500'
                        : 'text-stone-300'
                    }`}
                  />
                  {hasCuddle && (
                    <span className="text-[10px]" title="Cuddle bonus!">
                      ❤️
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
