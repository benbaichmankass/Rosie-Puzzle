import React, { useState, useEffect } from 'react';
import { BodyPartType, AvatarProfiles } from '../types';
import { AvatarDisplay } from './AvatarDisplay';

interface AnimatedCharacterCellProps {
  type: 'dog' | 'boyfriend' | 'girlfriend';
  part: BodyPartType | 'body';
  profiles: AvatarProfiles;
  sleeping?: boolean;
  grumpiness?: number;
  isCuddling?: boolean;
  hasTop?: boolean;
  hasBottom?: boolean;
  hasLeft?: boolean;
  hasRight?: boolean;
  isShiftedGhost?: boolean;
  isAdjustable?: boolean;
  onLimbClick?: (e: React.MouseEvent) => void;
}

export function AnimatedCharacterCell({
  type,
  part,
  profiles,
  sleeping = true,
  grumpiness = 0,
  isCuddling = false,
  hasTop = false,
  hasBottom = false,
  hasLeft = false,
  hasRight = false,
  isShiftedGhost = false,
  isAdjustable = false,
  onLimbClick,
}: AnimatedCharacterCellProps) {
  // Occasional dream thoughts ticker
  const [dreamItem, setDreamItem] = useState<string | null>(null);

  useEffect(() => {
    // Only head cells dream periodically
    if (part !== 'head') return;
    const dreams =
      type === 'dog'
        ? ['🦴', '🎾', '🥓', '🐾', '✨']
        : type === 'girlfriend'
        ? ['☕', '⭐', '🌸', '🥐', '✨']
        : ['🌙', '⭐', '☕', '💤', '🛌'];

    const interval = setInterval(() => {
      if (Math.random() > 0.4) {
        const item = dreams[Math.floor(Math.random() * dreams.length)];
        setDreamItem(item);
        setTimeout(() => setDreamItem(null), 3000);
      }
    }, 6000 + Math.random() * 4000);

    return () => clearInterval(interval);
  }, [type, part]);

  // Dynamic corner rounding so connected cells form a single smooth body
  const roundedClasses = [
    !hasTop && !hasLeft ? 'rounded-tl-2xl' : 'rounded-tl-none',
    !hasTop && !hasRight ? 'rounded-tr-2xl' : 'rounded-tr-none',
    !hasBottom && !hasLeft ? 'rounded-bl-2xl' : 'rounded-bl-none',
    !hasBottom && !hasRight ? 'rounded-br-2xl' : 'rounded-br-none',
  ].join(' ');

  // Internal borders are removed so the body looks seamlessly unified!
  const borderClasses = [
    !hasTop ? 'border-t-2' : 'border-t-0',
    !hasBottom ? 'border-b-2' : 'border-b-0',
    !hasLeft ? 'border-l-2' : 'border-l-0',
    !hasRight ? 'border-r-2' : 'border-r-0',
  ].join(' ');

  const isLimbPart =
    part === 'arm' || part === 'leg' || part === 'feet' || part === 'paw' || part === 'tail';

  // 1. ROSIE (BLACK AND WHITE DOG)
  if (type === 'dog') {
    const isAlert = grumpiness > 0;

    return (
      <div
        onClick={(e) => {
          if (isAdjustable && onLimbClick && isLimbPart) {
            e.stopPropagation();
            onLimbClick(e);
          }
        }}
        className={`w-full h-full relative flex items-center justify-center overflow-visible select-none transition-all duration-200 ${roundedClasses} ${borderClasses} ${
          isShiftedGhost
            ? 'bg-slate-800/80 border-dashed border-amber-400 ring-2 ring-amber-300'
            : 'bg-slate-900 border-slate-700 shadow-sm'
        } ${isAdjustable && isLimbPart ? 'cursor-pointer hover:brightness-110' : ''}`}
        style={{
          boxShadow: isShiftedGhost
            ? undefined
            : 'inset 0 1px 3px rgba(255,255,255,0.12), 0 2px 5px rgba(0,0,0,0.25)',
        }}
      >
        {/* Soft duvet indentation shadow */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/30 pointer-events-none" />

        {/* Limb adjustment handle */}
        {isAdjustable && onLimbClick && isLimbPart && (
          <div
            className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-amber-400 text-slate-950 shadow-xs flex items-center justify-center text-[8px] font-black z-30 pointer-events-none border border-white"
            title="Adjust limb"
          >
            ↻
          </div>
        )}

        {/* Head Cell */}
        {part === 'head' && (
          <div className="relative w-full h-full flex flex-col items-center justify-center p-1 z-20">
            {/* Soft Pillow under Rosie's head */}
            <div className="absolute inset-1 bg-stone-100 rounded-xl border border-stone-300/80 shadow-2xs -z-10" />

            {/* Floating Dream Thought Bubble */}
            {dreamItem && !isAlert && (
              <div className="absolute -top-6 -right-2 z-40 bg-white/95 text-slate-800 text-xs px-2 py-0.5 rounded-full shadow-md border border-stone-300 flex items-center gap-1 animate-dream-bubble pointer-events-none">
                <span>💭</span>
                <span className="font-bold">{dreamItem}</span>
              </div>
            )}

            {/* Drifting Zzz Particles */}
            {sleeping && !isAlert && (
              <div className="absolute -top-3.5 -right-1 z-30 pointer-events-none flex flex-col items-start animate-zzz-float">
                <span className="text-[11px] font-black text-amber-400 drop-shadow-xs">Z</span>
                <span className="text-[8px] font-bold text-amber-300 -mt-1 ml-1.5 opacity-80">z</span>
                <span className="text-[6px] font-semibold text-amber-200 -mt-1 ml-3 opacity-60">z</span>
              </div>
            )}

            {/* Rosie's Head Avatar using the uploaded photo! */}
            <div
              className={`w-9 h-9 relative ${
                sleeping && !isAlert ? 'animate-dog-breathe' : 'animate-gentle-shake'
              }`}
            >
              <AvatarDisplay
                type="dog"
                profiles={profiles}
                size="cell"
                sleeping={sleeping && !isAlert}
                growling={isAlert}
                showZzz={false}
              />
            </div>

            {/* Cute Rosie Name Banner */}
            <div className="absolute -bottom-1.5 px-1.5 py-0.2 bg-amber-400 text-slate-950 text-[8px] font-black rounded-full shadow-xs border border-white tracking-wider pointer-events-none">
              ROSIE
            </div>
          </div>
        )}

        {/* Body / Tummy Cell - Tuxedo chest pattern */}
        {(part === 'torso' || part === 'body') && (
          <div className="relative w-full h-full flex flex-col items-center justify-center p-1">
            <div
              className={`relative w-9 h-7 rounded-2xl bg-slate-900 border border-slate-700/60 flex items-center justify-center shadow-inner ${
                sleeping ? 'animate-dog-breathe' : ''
              }`}
            >
              <div className="w-5 h-5 rounded-full bg-white shadow-2xs flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-stone-100" />
              </div>
              {isCuddling && (
                <div className="absolute -top-1 -right-1 text-[10px] animate-pulse">💕</div>
              )}
            </div>
            <span className="text-[8px] font-bold text-stone-300 mt-0.5 tracking-wide">
              {sleeping ? 'snoozing' : 'grumble'}
            </span>
          </div>
        )}

        {/* Paw Cell */}
        {part === 'paw' && (
          <div className="relative w-full h-full flex flex-col items-center justify-center p-1">
            <div
              className={`w-7 h-7 rounded-xl bg-white border border-stone-300 shadow-xs flex flex-col items-center justify-center ${
                sleeping ? 'animate-paw-twitch' : ''
              }`}
            >
              <span className="text-sm leading-none text-slate-900">🐾</span>
              <div className="flex gap-0.5 mt-0.5">
                <div className="w-1 h-1 rounded-full bg-rose-300" />
                <div className="w-1 h-1 rounded-full bg-rose-300" />
                <div className="w-1 h-1 rounded-full bg-rose-300" />
              </div>
            </div>
            <span className="text-[7.5px] font-bold text-stone-300 mt-0.5">white paw</span>
          </div>
        )}

        {/* Tail Cell */}
        {part === 'tail' && (
          <div className="relative w-full h-full flex flex-col items-center justify-center p-1">
            <div
              className={`relative w-8 h-8 flex items-center justify-center ${
                sleeping ? 'animate-tail-swish' : 'animate-bounce'
              }`}
            >
              <svg viewBox="0 0 32 32" className="w-7 h-7 drop-shadow-xs">
                <path
                  d="M6 24 C10 18 16 10 24 10 C27 10 28 13 26 16 C20 18 14 24 8 26 Z"
                  fill="#0F172A"
                  stroke="#334155"
                  strokeWidth="1"
                />
                <path d="M22 10 C25 10 28 12 26 15 C24 15 23 12 22 10 Z" fill="#FFFFFF" />
              </svg>
            </div>
            <span className="text-[7.5px] font-bold text-stone-300 -mt-0.5">tail wag</span>
          </div>
        )}
      </div>
    );
  }

  // 2. SHAI (MAN 2)
  if (type === 'girlfriend') {
    return (
      <div
        onClick={(e) => {
          if (isAdjustable && onLimbClick && isLimbPart) {
            e.stopPropagation();
            onLimbClick(e);
          }
        }}
        className={`w-full h-full relative flex items-center justify-center overflow-visible select-none transition-all duration-200 ${roundedClasses} ${borderClasses} bg-teal-100/95 border-teal-400 text-teal-950 shadow-xs ${
          isAdjustable && isLimbPart ? 'cursor-pointer hover:bg-teal-200' : ''
        }`}
        style={{
          boxShadow: 'inset 0 1px 3px rgba(255,255,255,0.4), 0 2px 5px rgba(13,148,136,0.15)',
        }}
      >
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#0d9488_1px,transparent_1px)] [background-size:6px_6px] pointer-events-none" />

        {/* Limb adjustment handle */}
        {isAdjustable && onLimbClick && isLimbPart && (
          <div
            className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-teal-500 text-white shadow-xs flex items-center justify-center text-[8px] font-black z-30 pointer-events-none border border-white animate-pulse"
            title="Adjust limb"
          >
            ↻
          </div>
        )}

        {/* Head Cell */}
        {part === 'head' && (
          <div className="relative w-full h-full flex flex-col items-center justify-center p-1 z-20">
            <div className="absolute inset-1 bg-white rounded-xl border border-teal-200 shadow-2xs -z-10" />

            {dreamItem && (
              <div className="absolute -top-6 -right-2 z-40 bg-white/95 text-teal-900 text-xs px-2 py-0.5 rounded-full shadow-md border border-teal-200 flex items-center gap-1 animate-dream-bubble pointer-events-none">
                <span>💭</span>
                <span className="font-bold">{dreamItem}</span>
              </div>
            )}

            {sleeping && (
              <div className="absolute -top-3.5 -right-1 z-30 pointer-events-none flex flex-col items-start animate-zzz-float">
                <span className="text-[11px] font-black text-teal-500 drop-shadow-xs">Z</span>
                <span className="text-[8px] font-bold text-teal-400 -mt-1 ml-1.5 opacity-80">z</span>
                <span className="text-[6px] font-semibold text-teal-300 -mt-1 ml-3 opacity-60">z</span>
              </div>
            )}

            {/* Shai's Head Avatar using the uploaded photo! */}
            <div className={`w-9 h-9 relative ${sleeping ? 'animate-human-breathe' : ''}`}>
              <AvatarDisplay
                type="girlfriend"
                profiles={profiles}
                size="cell"
                sleeping={sleeping}
                showZzz={false}
              />
            </div>

            <div className="absolute -bottom-1.5 px-1.5 py-0.2 bg-teal-600 text-white text-[8px] font-black rounded-full shadow-xs border border-white tracking-wider pointer-events-none">
              SHAI
            </div>
          </div>
        )}

        {/* Torso Cell */}
        {part === 'torso' && (
          <div className="relative w-full h-full flex flex-col items-center justify-center p-1">
            <div
              className={`relative w-9 h-7 rounded-xl bg-teal-200/95 border border-teal-300 flex items-center justify-center shadow-inner ${
                sleeping ? 'animate-human-breathe' : ''
              }`}
            >
              <span className="text-xs text-teal-700">✦</span>
              <div className="absolute right-1 flex flex-col gap-1">
                <div className="w-1 h-1 rounded-full bg-teal-500" />
                <div className="w-1 h-1 rounded-full bg-teal-500" />
              </div>
              {isCuddling && (
                <div className="absolute -top-2 -right-1 text-xs animate-cuddle-heart pointer-events-none">
                  💕
                </div>
              )}
            </div>
            <span className="text-[7.5px] font-bold text-teal-800 mt-0.5">pajamas</span>
          </div>
        )}

        {/* Arm Cell */}
        {part === 'arm' && (
          <div className="relative w-full h-full flex flex-col items-center justify-center p-1">
            <div
              className={`w-7 h-7 rounded-xl bg-teal-200/80 border border-teal-300 flex items-center justify-center shadow-xs ${
                sleeping ? 'animate-human-breathe' : ''
              }`}
            >
              <span className="text-sm leading-none" title="Arm">
                ✋
              </span>
            </div>
            <span className="text-[7.5px] font-bold text-teal-800 mt-0.5">arm</span>
          </div>
        )}

        {/* Leg Cell */}
        {part === 'leg' && (
          <div className="relative w-full h-full flex flex-col items-center justify-center p-1">
            <div className="w-7 h-6 rounded-lg bg-teal-200 border border-teal-300 shadow-2xs flex items-center justify-center">
              <div className="w-3.5 h-1 bg-teal-400 rounded-full" />
            </div>
            <span className="text-[7.5px] font-bold text-teal-800 mt-0.5">leg</span>
          </div>
        )}

        {/* Feet Cell */}
        {part === 'feet' && (
          <div className="relative w-full h-full flex flex-col items-center justify-center p-1">
            <div className="w-7 h-6 rounded-xl bg-emerald-200/90 border border-emerald-300 shadow-xs flex items-center justify-center">
              <span className="text-sm leading-none" title="Warm Sock">
                🧦
              </span>
            </div>
            <span className="text-[7.5px] font-bold text-teal-800 mt-0.5">socks</span>
          </div>
        )}
      </div>
    );
  }

  // 3. BENTZI (MAN 1)
  return (
    <div
      onClick={(e) => {
        if (isAdjustable && onLimbClick && isLimbPart) {
          e.stopPropagation();
          onLimbClick(e);
        }
      }}
      className={`w-full h-full relative flex items-center justify-center overflow-visible select-none transition-all duration-200 ${roundedClasses} ${borderClasses} bg-sky-100/95 border-sky-400 text-sky-950 shadow-xs ${
        isAdjustable && isLimbPart ? 'cursor-pointer hover:bg-sky-200' : ''
      }`}
      style={{
        boxShadow: 'inset 0 1px 3px rgba(255,255,255,0.4), 0 2px 5px rgba(56,189,248,0.15)',
      }}
    >
      <div className="absolute inset-0 opacity-15 bg-[repeating-linear-gradient(45deg,#0284c7,#0284c7_2px,transparent_2px,transparent_6px)] pointer-events-none" />

      {/* Limb adjustment handle */}
      {isAdjustable && onLimbClick && isLimbPart && (
        <div
          className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-sky-500 text-white shadow-xs flex items-center justify-center text-[8px] font-black z-30 pointer-events-none border border-white animate-pulse"
          title="Adjust limb"
        >
          ↻
        </div>
      )}

      {/* Head Cell */}
      {part === 'head' && (
        <div className="relative w-full h-full flex flex-col items-center justify-center p-1 z-20">
          <div className="absolute inset-1 bg-white rounded-xl border border-sky-200 shadow-2xs -z-10" />

          {dreamItem && (
            <div className="absolute -top-6 -right-2 z-40 bg-white/95 text-sky-900 text-xs px-2 py-0.5 rounded-full shadow-md border border-sky-200 flex items-center gap-1 animate-dream-bubble pointer-events-none">
              <span>💭</span>
              <span className="font-bold">{dreamItem}</span>
            </div>
          )}

          {sleeping && (
            <div className="absolute -top-3.5 -right-1 z-30 pointer-events-none flex flex-col items-start animate-zzz-float">
              <span className="text-[11px] font-black text-sky-500 drop-shadow-xs">Z</span>
              <span className="text-[8px] font-bold text-sky-400 -mt-1 ml-1.5 opacity-80">z</span>
              <span className="text-[6px] font-semibold text-sky-300 -mt-1 ml-3 opacity-60">z</span>
            </div>
          )}

          {/* Bentzi's Head Avatar using the uploaded photo! */}
          <div className={`w-9 h-9 relative ${sleeping ? 'animate-human-breathe' : ''}`}>
            <AvatarDisplay
              type="boyfriend"
              profiles={profiles}
              size="cell"
              sleeping={sleeping}
              showZzz={false}
            />
          </div>

          <div className="absolute -bottom-1.5 px-1.5 py-0.2 bg-sky-600 text-white text-[8px] font-black rounded-full shadow-xs border border-white tracking-wider pointer-events-none">
            BENTZI
          </div>
        </div>
      )}

      {/* Torso Cell */}
      {part === 'torso' && (
        <div className="relative w-full h-full flex flex-col items-center justify-center p-1">
          <div
            className={`relative w-9 h-7 rounded-xl bg-sky-200/95 border border-sky-300 flex items-center justify-center shadow-inner ${
              sleeping ? 'animate-human-breathe' : ''
            }`}
          >
            <div className="flex gap-1 items-center">
              <div className="w-1.5 h-1.5 rounded-full bg-white shadow-2xs" />
              <div className="w-1.5 h-1.5 rounded-full bg-white shadow-2xs" />
            </div>
            {isCuddling && (
              <div className="absolute -top-2 -right-1 text-xs animate-cuddle-heart pointer-events-none">
                💕
              </div>
            )}
          </div>
          <span className="text-[7.5px] font-bold text-sky-800 mt-0.5">pajamas</span>
        </div>
      )}

      {/* Arm Cell */}
      {part === 'arm' && (
        <div className="relative w-full h-full flex flex-col items-center justify-center p-1">
          <div
            className={`w-7 h-7 rounded-xl bg-sky-200/80 border border-sky-300 flex items-center justify-center shadow-xs ${
              sleeping ? 'animate-human-breathe' : ''
            }`}
          >
            <span className="text-sm leading-none" title="Arm">
              ✋
            </span>
          </div>
          <span className="text-[7.5px] font-bold text-sky-800 mt-0.5">arm</span>
        </div>
      )}

      {/* Leg Cell */}
      {part === 'leg' && (
        <div className="relative w-full h-full flex flex-col items-center justify-center p-1">
          <div className="w-7 h-6 rounded-lg bg-sky-200 border border-sky-300 shadow-2xs flex items-center justify-center">
            <div className="w-3.5 h-1 bg-sky-400 rounded-full" />
          </div>
          <span className="text-[7.5px] font-bold text-sky-800 mt-0.5">leg</span>
        </div>
      )}

      {/* Feet Cell */}
      {part === 'feet' && (
        <div className="relative w-full h-full flex flex-col items-center justify-center p-1">
          <div className="w-7 h-6 rounded-xl bg-sky-300/90 border border-sky-400 shadow-xs flex items-center justify-center">
            <span className="text-sm leading-none" title="Warm Sock">
              🧦
            </span>
          </div>
          <span className="text-[7.5px] font-bold text-sky-800 mt-0.5">socks</span>
        </div>
      )}
    </div>
  );
}
