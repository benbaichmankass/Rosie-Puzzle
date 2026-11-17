import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { AvatarProfiles, LevelScore } from '../types';
import { RotateCcw, ChevronRight, List } from 'lucide-react';
import confetti from 'canvas-confetti';

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

const fmt = (n: number) => String(Math.max(0, Math.round(n))).padStart(6, '0');

/** Counts up from 0 to `to`, arcade-tally style. */
function useTally(to: number, run: boolean, delay = 0) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!run) return setV(0);
    const start = Date.now() + delay;
    const dur = 900;
    const t = window.setInterval(() => {
      const k = Math.min(1, Math.max(0, (Date.now() - start) / dur));
      setV(to * (1 - Math.pow(1 - k, 3)));
      if (k >= 1) window.clearInterval(t);
    }, 33);
    return () => window.clearInterval(t);
  }, [to, run, delay]);
  return v;
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
  const total = useTally(score.totalPoints, isOpen, 350);

  useEffect(() => {
    if (!isOpen) return;
    try {
      confetti({
        particleCount: 90,
        spread: 75,
        origin: { y: 0.55 },
        shapes: ['square'],
        scalar: 1.1,
        colors: ['#ff4fd8', '#3ff3ff', '#ffe04a', '#5dff8a'],
      });
    } catch {}
  }, [isOpen]);

  if (!isOpen) return null;

  const time = `${Math.floor(timeSeconds / 60)}:${String(timeSeconds % 60).padStart(2, '0')}`;
  const rows: [string, string, string][] = [
    ['NIGHT CLEAR', `+${score.basePoints}`, 'text-[#e9e5ff]'],
    [`SPEED ${time}`, `+${score.speedBonus}`, 'neon-cyan'],
    ...(score.cuddleBonus > 0 ? [['CUDDLE ♥', `+${score.cuddleBonus}`, 'neon-pink'] as [string, string, string]] : []),
    ...(score.penaltyPoints > 0 ? [['OOPSIES', `-${score.penaltyPoints}`, 'neon-red'] as [string, string, string]] : []),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#05030f]/80 select-none">
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 20 }}
        className="relative w-full max-w-sm pixel-panel p-5 text-center"
        style={{ borderColor: 'var(--neon-yellow)', boxShadow: '0 0 0 3px #05030f, 0 0 26px rgba(255,224,74,0.45), 0 8px 0 3px #05030f' }}
      >
        <div className="font-arcade text-[9px] text-[#8f86d6] mb-2">NIGHT {String(levelId).padStart(2, '0')}</div>
        <motion.h2
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="font-arcade text-[22px] leading-tight neon-yellow"
        >
          NIGHT
          <br />
          CLEAR!
        </motion.h2>
        <p className="font-pixel text-[14px] text-[#cfc8ff] mt-2">{levelTitle}</p>

        {/* Everyone asleep */}
        <div className="flex items-end justify-center gap-3 my-3">
          {[
            [profiles.boyfriendPhoto || 'assets/avatars/bentzi.jpg', '#4a6fb0', profiles.boyfriendName],
            [profiles.dogPhoto || 'assets/avatars/rosie.jpg', '#ffe04a', profiles.dogName],
            [profiles.girlfriendPhoto || 'assets/avatars/shai.jpg', '#8a73c6', profiles.girlfriendName],
          ].map(([src, c, name], i) => (
            <motion.div
              key={i}
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 + i * 0.12, type: 'spring', stiffness: 400, damping: 16 }}
              className="flex flex-col items-center"
            >
              <div className="relative">
                <img src={src} alt="" className={`${i === 1 ? 'w-14 h-14' : 'w-12 h-12'} object-cover rounded-sm border-[3px]`} style={{ borderColor: c }} />
                <span className="absolute -top-3 -right-2 font-arcade text-[9px] neon-cyan">z</span>
              </div>
              <span className="font-arcade text-[7px] mt-1 uppercase text-[#b9b0f5] max-w-[64px] truncate">{name}</span>
            </motion.div>
          ))}
        </div>

        {/* Tally */}
        <div className="bg-[#0f0b2a] border-2 border-[#05030f] rounded-sm px-3 py-2 text-left font-arcade text-[9px] space-y-1.5">
          {rows.map(([label, val, cls], i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.12, ease: 'linear', duration: 0.05 }}
              className={`flex justify-between ${cls}`}
            >
              <span>{label}</span>
              <span>{val}</span>
            </motion.div>
          ))}
          <div className="flex justify-between items-baseline pt-1.5 border-t-2 border-dashed border-[#3a2f8f]">
            <span className="text-[#e9e5ff]">SCORE</span>
            <span className="text-[16px] neon-yellow">{fmt(total)}</span>
          </div>
        </div>
        {isNewHighScore && <div className="font-arcade text-[10px] neon-pink mt-2 blink">★ NEW HIGH SCORE ★</div>}
        {isCuddleBonus && <div className="font-pixel text-[13px] neon-pink mt-1">Cuddle bonus! You two fell asleep side by side.</div>}

        <div className="flex flex-col gap-2 mt-4">
          {hasNextLevel ? (
            <button onClick={onNextLevel} className="arcade-btn btn-yellow w-full py-3 font-arcade text-[11px] flex items-center justify-center gap-1">
              NEXT NIGHT <ChevronRight className="w-4 h-4" strokeWidth={3} />
            </button>
          ) : (
            <button onClick={onOpenLevelSelect} className="arcade-btn btn-yellow w-full py-3 font-arcade text-[10px]">
              ALL NIGHTS CLEARED!
            </button>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={onReplayLevel} className="arcade-btn btn-dark py-2.5 font-arcade text-[8px] flex items-center justify-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" /> REPLAY
            </button>
            <button onClick={onOpenLevelSelect} className="arcade-btn btn-dark py-2.5 font-arcade text-[8px] flex items-center justify-center gap-1.5">
              <List className="w-3.5 h-3.5" /> NIGHTS
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
