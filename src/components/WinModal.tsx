import React, { useEffect } from 'react';
import { AvatarProfiles, LevelScore } from '../types';
import { AvatarDisplay } from './AvatarDisplay';
import { Heart, Sparkles, RotateCcw, ChevronRight, List, Timer, Zap, Trophy } from 'lucide-react';
import confetti from 'canvas-confetti';
import { sound } from '../utils/audio';

interface WinModalProps {
  isOpen: boolean;
  levelId: number;
  levelTitle: string;
  isCuddleBonus: boolean;
  profiles: AvatarProfiles;
  timeSeconds: number;
  score: LevelScore;
  isNewHighScore?: boolean;
  hasNextLevel: boolean;
  onNextLevel: () => void;
  onReplayLevel: () => void;
  onOpenLevelSelect: () => void;
}

export function WinModal({
  isOpen,
  levelId,
  levelTitle,
  isCuddleBonus,
  profiles,
  timeSeconds,
  score,
  isNewHighScore,
  hasNextLevel,
  onNextLevel,
  onReplayLevel,
  onOpenLevelSelect,
}: WinModalProps) {
  useEffect(() => {
    if (isOpen) {
      sound.playWinFanfare();
      if (isCuddleBonus) {
        setTimeout(() => sound.playCuddleChime(), 600);
      }
      // Confetti burst
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#38bdf8', '#f472b6', '#fbbf24', '#a855f7'],
        });
      } catch {}
    }
  }, [isOpen, isCuddleBonus]);

  if (!isOpen) return null;

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs select-none">
      <div className="relative w-full max-w-sm rounded-3xl bg-gradient-to-b from-indigo-950 via-slate-900 to-indigo-950 p-6 text-center text-white shadow-2xl border-4 border-amber-400 overflow-hidden">
        {/* Night stars background decor */}
        <div className="absolute top-2 left-4 text-xs opacity-40 animate-pulse">✨</div>
        <div className="absolute top-6 right-8 text-xs opacity-50 animate-pulse">⭐</div>
        <div className="absolute bottom-10 left-6 text-xs opacity-30 animate-pulse">✨</div>

        {/* Top Moon & Badge */}
        <div className="flex justify-center mb-2">
          <div className="px-3 py-1 rounded-full bg-amber-400 text-amber-950 font-black text-xs uppercase tracking-wider shadow-md flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-900" />
            <span>Goodnight! Everyone Fits!</span>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-black text-amber-200 mb-0.5">
          Sweet Dreams! 🌙
        </h2>
        <p className="text-xs text-indigo-200/80 mb-3">{levelTitle}</p>

        {/* Score & Zen Timer Breakdown Card */}
        <div className="mx-auto w-full max-w-[280px] bg-amber-500/10 rounded-2xl p-3 border border-amber-400/30 mb-3 shadow-inner text-left">
          <div className="flex items-center justify-between pb-2 border-b border-indigo-400/20 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-amber-200">
              <Timer className="w-3.5 h-3.5 text-amber-400" />
              <span>Time to Sleep:</span>
            </div>
            <span className="font-mono font-black text-white">{formatTime(timeSeconds)}</span>
          </div>

          <div className="py-2 space-y-1 text-[11px] border-b border-indigo-400/20">
            <div className="flex justify-between text-indigo-200">
              <span>Level Completion:</span>
              <span className="font-mono font-bold text-white">+{score.basePoints} pts</span>
            </div>
            <div className="flex justify-between text-amber-300">
              <span className="flex items-center gap-1">
                <Zap className="w-3 h-3 fill-amber-400 text-amber-400" />
                Zen Speed Bonus:
              </span>
              <span className="font-mono font-bold">+{score.speedBonus} pts</span>
            </div>
            {score.cuddleBonus > 0 && (
              <div className="flex justify-between text-rose-300">
                <span className="flex items-center gap-1">
                  <Heart className="w-3 h-3 fill-rose-400 text-rose-400" />
                  Cuddle Partner Bonus:
                </span>
                <span className="font-mono font-bold">+{score.cuddleBonus} pts</span>
              </div>
            )}
            {score.penaltyPoints > 0 && (
              <div className="flex justify-between text-rose-300">
                <span>Collision Penalties:</span>
                <span className="font-mono font-bold">-{score.penaltyPoints} pts</span>
              </div>
            )}
          </div>

          <div className="pt-2 flex items-center justify-between text-xs font-black">
            <span className="text-amber-200">Total Score:</span>
            <div className="flex items-center gap-1 font-mono text-amber-300 text-sm">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>{score.totalPoints.toLocaleString()} pts</span>
            </div>
          </div>
          {isNewHighScore && (
            <div className="mt-1 text-center text-[10px] font-bold text-amber-400 tracking-wider">
              ⭐ NEW PERSONAL RECORD! ⭐
            </div>
          )}
        </div>

        {/* Cozy Bedtime Illustration in Win Screen */}
        <div className="relative mx-auto w-full max-w-[270px] bg-amber-100/15 rounded-2xl p-3 border border-indigo-400/30 mb-3 shadow-inner">
          <div className="flex items-center justify-center gap-3">
            <div className="flex flex-col items-center">
              <div className="w-13 h-13 rounded-2xl overflow-hidden border-2 border-sky-400/80 shadow-md relative animate-human-breathe">
                <img
                  src={profiles.boyfriendPhoto || '/assets/avatars/bentzi.jpg'}
                  alt={profiles.boyfriendName}
                  className="w-full h-full object-cover object-center"
                />
                <span className="absolute bottom-0 right-0 text-[9px] bg-sky-600 text-white px-1 rounded-tl-md font-bold">
                  💤
                </span>
              </div>
              <span className="text-[10px] text-sky-300 font-bold mt-1 truncate max-w-[70px]">
                {profiles.boyfriendName}
              </span>
            </div>

            <div className="flex flex-col items-center">
              <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-amber-400/80 shadow-md relative animate-dog-breathe">
                <img
                  src={profiles.dogPhoto || '/assets/avatars/rosie.jpg'}
                  alt={profiles.dogName}
                  className="w-full h-full object-cover object-center"
                />
                <span className="absolute bottom-0 right-0 text-[9px] bg-amber-500 text-amber-950 px-1 rounded-tl-md font-bold">
                  🐾
                </span>
              </div>
              <span className="text-[10px] text-amber-300 font-bold mt-1 truncate max-w-[70px]">
                {profiles.dogName}
              </span>
            </div>

            <div className="flex flex-col items-center">
              <div className="w-13 h-13 rounded-2xl overflow-hidden border-2 border-teal-400/80 shadow-md relative animate-human-breathe">
                <img
                  src={profiles.girlfriendPhoto || '/assets/avatars/shai.jpg'}
                  alt={profiles.girlfriendName}
                  className="w-full h-full object-cover object-center"
                />
                <span className="absolute bottom-0 right-0 text-[9px] bg-teal-600 text-white px-1 rounded-tl-md font-bold">
                  💤
                </span>
              </div>
              <span className="text-[10px] text-teal-300 font-bold mt-1 truncate max-w-[70px]">
                {profiles.girlfriendName}
              </span>
            </div>
          </div>

          {/* Duvet blanket covering bottom */}
          <div className="mt-2 pt-1.5 border-t border-indigo-400/30 flex items-center justify-center gap-1 text-[11px] text-amber-200/90 font-medium">
            <span>Tucked in warm & cozy under the duvet</span>
            <span>🛏️</span>
          </div>
        </div>

        {/* Cuddle Bonus Banner */}
        {isCuddleBonus && (
          <div className="mb-3 p-2 rounded-2xl bg-rose-500/30 border border-rose-400/60 flex items-center justify-center gap-2">
            <Heart className="w-4 h-4 text-rose-400 fill-rose-400 animate-bounce" />
            <div className="text-left">
              <span className="text-xs font-black text-rose-200 block leading-tight">
                CUDDLE BONUS! ❤️
              </span>
              <span className="text-[10px] text-rose-100">
                You two are sleeping right next to each other!
              </span>
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="flex flex-col gap-2">
          {hasNextLevel ? (
            <button
              onClick={onNextLevel}
              className="w-full py-3 px-4 rounded-2xl bg-amber-400 hover:bg-amber-300 text-amber-950 font-black text-sm shadow-lg active:scale-98 transition-all flex items-center justify-center gap-2"
            >
              <span>Next Night (Level {levelId + 1})</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={onOpenLevelSelect}
              className="w-full py-3 px-4 rounded-2xl bg-amber-400 hover:bg-amber-300 text-amber-950 font-black text-sm shadow-lg active:scale-98 transition-all flex items-center justify-center gap-2"
            >
              <span>All 12 Nights Mastered! Pick a Level</span>
            </button>
          )}

          <div className="grid grid-cols-2 gap-2 mt-0.5">
            <button
              onClick={onReplayLevel}
              className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Play Again</span>
            </button>

            <button
              onClick={onOpenLevelSelect}
              className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
            >
              <List className="w-3.5 h-3.5" />
              <span>All Levels</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
