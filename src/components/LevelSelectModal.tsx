import React from 'react';
import { PuzzleLevel as LevelConfig } from '../utils/puzzle';
import { X, Star } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#05030f]/80 select-none">
      <div className="relative w-full max-w-sm pixel-panel p-4 max-h-[90vh] overflow-y-auto" style={{ borderColor: 'var(--neon-cyan)' }}>
        <button onClick={onClose} aria-label="Close" className="arcade-btn btn-dark absolute top-3 right-3 w-8 h-8 flex items-center justify-center">
          <X className="w-4 h-4" />
        </button>

        <div className="text-center mb-4 mt-1">
          <h3 className="font-arcade text-[15px] neon-cyan">SELECT NIGHT</h3>
          <p className="font-arcade text-[8px] text-[#8f86d6] mt-2">
            CLEARED {completedLevelIds.length}/{levels.length}
          </p>
        </div>

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
                className={`arcade-btn ${isCurrent ? 'btn-yellow' : isCompleted ? 'btn-cyan' : 'btn-dark'} relative py-3 flex flex-col items-center justify-center`}
              >
                <span className="font-arcade text-[14px]">{String(lvl.id).padStart(2, '0')}</span>
                <span className="flex items-center gap-0.5 mt-1.5 h-3">
                  <Star className={`w-3 h-3 ${isCompleted ? 'fill-current' : 'opacity-40'}`} />
                  {hasCuddle && <span className="text-[10px] leading-none">♥</span>}
                </span>
                {isCurrent && <span className="absolute -top-2 font-arcade text-[7px] bg-[#05030f] text-[var(--neon-yellow)] px-1">NOW</span>}
              </button>
            );
          })}
        </div>
        <p className="mt-4 font-pixel text-[11px] leading-snug text-[#8f86d6] text-center">
          Sounds from SoundBible.com by Mike Koenig, John Stracke, Popup Pixels, Sound Explorer and Daniel Simon
          (CC BY 3.0), Lisa Redfern (public domain), and dog growls by congusbongus on OpenGameArt.org (CC BY 3.0).
        </p>
      </div>
    </div>
  );
}
