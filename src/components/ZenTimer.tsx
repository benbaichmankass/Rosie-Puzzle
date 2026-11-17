import React from 'react';
import { Timer, Zap, Eye, EyeOff, AlertCircle } from 'lucide-react';

interface ZenTimerProps {
  seconds: number;
  speedBonus: number;
  currentScore: number;
  penaltyPoints: number;
  isEnabled: boolean;
  onToggleEnabled: () => void;
}

export function ZenTimer({
  seconds,
  speedBonus,
  currentScore,
  penaltyPoints,
  isEnabled,
  onToggleEnabled,
}: ZenTimerProps) {
  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full flex items-center justify-between px-2.5 py-1.5 bg-amber-100/90 dark:bg-stone-800/90 rounded-xl border border-amber-200/80 dark:border-stone-700 shadow-2xs mb-2 text-xs select-none">
      {/* Timer & Live Score */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 font-mono font-bold text-amber-950 dark:text-amber-100">
          <Timer className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span>{isEnabled ? formatTime(seconds) : '--:--'}</span>
        </div>

        {/* Live Total Score */}
        <div className="flex items-center gap-1 font-mono font-black text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded-lg border border-amber-300">
          <span className="text-[10px] text-amber-800 font-bold">SCORE</span>
          <span>{currentScore.toLocaleString()}</span>
        </div>

        {isEnabled && (
          <div className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-200/70 text-[10px] font-bold text-amber-900 border border-amber-300/60">
            <Zap className="w-3 h-3 text-amber-600 fill-amber-500" />
            <span>+{speedBonus}</span>
          </div>
        )}

        {penaltyPoints > 0 && (
          <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-rose-200/80 text-[10px] font-bold text-rose-900 border border-rose-300 animate-soft-pulse">
            <AlertCircle className="w-3 h-3 text-rose-600" />
            <span>-{penaltyPoints}</span>
          </div>
        )}
      </div>

      {/* Optional Zen Mode Toggle */}
      <button
        onClick={onToggleEnabled}
        className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg bg-white/80 dark:bg-stone-700 hover:bg-white text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-stone-600 shadow-2xs transition-all active:scale-95"
        title={isEnabled ? 'Hide Zen Timer' : 'Show Zen Timer'}
      >
        {isEnabled ? (
          <>
            <EyeOff className="w-3 h-3 text-amber-700 dark:text-stone-300" />
            <span>Timer On</span>
          </>
        ) : (
          <>
            <Eye className="w-3 h-3 text-amber-700 dark:text-stone-300" />
            <span>Hidden</span>
          </>
        )}
      </button>
    </div>
  );
}
