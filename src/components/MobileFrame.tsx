import React from 'react';
import { Volume2, VolumeX, RotateCcw, ChevronLeft, ChevronRight, Maximize, Minimize } from 'lucide-react';
import { AvatarProfiles } from '../types';
import { sound } from '../utils/audio';

interface MobileFrameProps {
  children: React.ReactNode;
  levelNumber: number;
  totalLevels: number;
  levelTitle: string;
  storyNote: string;
  isNightLamp?: boolean;
  soundEnabled: boolean;
  profiles: AvatarProfiles;
  onToggleNightLamp?: () => void;
  onToggleSound: () => void;
  onOpenCustomizer?: () => void;
  onOpenLevelSelect: () => void;
  onRestartLevel: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onPrevLevel: () => void;
  onNextLevel: () => void;
}

function IconBtn({ onClick, label, children, className = 'btn-dark' }: { onClick?: () => void; label: string; children: React.ReactNode; className?: string }) {
  return (
    <button onClick={onClick} title={label} aria-label={label} className={`arcade-btn ${className} w-8 h-8 flex items-center justify-center`}>
      {children}
    </button>
  );
}

/** Arcade cabinet shell: marquee title, stage switcher, quick buttons, then the game. */
export function MobileFrame({
  children,
  levelNumber,
  totalLevels,
  levelTitle,
  storyNote,
  soundEnabled,
  profiles,
  onToggleSound,
  onOpenCustomizer,
  onOpenLevelSelect,
  onRestartLevel,
  isFullscreen = false,
  onToggleFullscreen,
  onPrevLevel,
  onNextLevel,
}: MobileFrameProps) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <div className="arcade-sky min-h-screen w-full flex justify-center text-[#f4f1ff] select-none">
      <div className="w-full max-w-[420px] min-h-screen flex flex-col">
        {/* Marquee */}
        <div className="px-3 pt-3 pb-2 flex items-center justify-between gap-2">
          <h1 className="font-arcade text-[13px] leading-none marquee-title whitespace-nowrap">BEDTIME PUZZLE</h1>
          <div className="flex items-center gap-1.5">
            <IconBtn onClick={onToggleSound} label={soundEnabled ? 'Mute' : 'Sound on'}>
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-[var(--neon-red)]" />}
            </IconBtn>
            <IconBtn
              onClick={() => {
                onRestartLevel();
                sound.playPop();
              }}
              label="Restart this night"
            >
              <RotateCcw className="w-4 h-4" />
            </IconBtn>
            {onToggleFullscreen && (
              <IconBtn onClick={onToggleFullscreen} label={isFullscreen ? 'Exit full screen' : 'Full screen'}>
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </IconBtn>
            )}
            <button
              onClick={onOpenCustomizer}
              title="Character photos"
              aria-label="Character photos"
              className="arcade-btn btn-dark h-8 px-1 flex items-center -space-x-1.5"
            >
              {[profiles.boyfriendPhoto || 'assets/avatars/bentzi.jpg', profiles.dogPhoto || 'assets/avatars/rosie.jpg', profiles.girlfriendPhoto || 'assets/avatars/shai.jpg'].map((src, i) => (
                <img key={i} src={src} alt="" className="w-5 h-5 rounded-sm object-cover border-2 border-[#05030f]" />
              ))}
            </button>
          </div>
        </div>

        {/* Stage switcher */}
        <div className="px-3 flex items-center gap-2">
          <IconBtn onClick={onPrevLevel} label="Previous night" className="btn-cyan">
            <ChevronLeft className="w-5 h-5" />
          </IconBtn>
          <button onClick={onOpenLevelSelect} className="flex-1 min-w-0 pixel-panel px-2 py-1.5 text-left active:translate-y-[2px]">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-arcade text-[11px] neon-yellow whitespace-nowrap">
                NIGHT {pad(levelNumber)}<span className="text-[#8f86d6] [text-shadow:none]">/{pad(totalLevels)}</span>
              </span>
              <span className="font-arcade text-[8px] text-[#8f86d6]">SELECT ▾</span>
            </div>
            <div className="font-pixel text-[13px] font-semibold leading-tight truncate text-[#e9e5ff]">{levelTitle.replace(/^Night \d+:\s*/, '')}</div>
          </button>
          <IconBtn onClick={onNextLevel} label="Next night" className="btn-cyan">
            <ChevronRight className="w-5 h-5" />
          </IconBtn>
        </div>

        <div className="flex-1 flex flex-col">{children}</div>
      </div>
      <div className="crt-overlay" aria-hidden />
    </div>
  );
}
