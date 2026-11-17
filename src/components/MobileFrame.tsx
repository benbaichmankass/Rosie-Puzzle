import React from 'react';
import {
  Volume2,
  VolumeX,
  Camera,
  RotateCcw,
  List,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Info,
} from 'lucide-react';
import { AvatarProfiles } from '../types';
import { AvatarDisplay } from './AvatarDisplay';
import { sound } from '../utils/audio';

interface MobileFrameProps {
  children: React.ReactNode;
  levelNumber: number;
  totalLevels: number;
  levelTitle: string;
  storyNote: string;
  isNightLamp: boolean;
  soundEnabled: boolean;
  profiles: AvatarProfiles;
  onToggleNightLamp: () => void;
  onToggleSound: () => void;
  onOpenCustomizer?: () => void;
  onOpenLevelSelect: () => void;
  onRestartLevel: () => void;
  onPrevLevel: () => void;
  onNextLevel: () => void;
}

export function MobileFrame({
  children,
  levelNumber,
  totalLevels,
  levelTitle,
  storyNote,
  isNightLamp,
  soundEnabled,
  profiles,
  onToggleNightLamp,
  onToggleSound,
  onOpenCustomizer,
  onOpenLevelSelect,
  onRestartLevel,
  onPrevLevel,
  onNextLevel,
}: MobileFrameProps) {
  return (
    <div
      className={`min-h-screen w-full flex items-center justify-center p-0 sm:p-4 transition-colors duration-500 select-none ${
        isNightLamp
          ? 'bg-amber-950/40 text-amber-950'
          : 'bg-slate-950 text-slate-100'
      }`}
    >
      {/* Mobile Device Container */}
      <div
        className={`w-full max-w-[420px] min-h-screen sm:min-h-[760px] sm:max-h-[92vh] flex flex-col justify-between rounded-none sm:rounded-[38px] shadow-2xl border-0 sm:border-8 transition-colors duration-500 overflow-y-auto sm:overflow-hidden ${
          isNightLamp
            ? 'bg-amber-50/95 border-amber-800/30'
            : 'bg-stone-900 border-stone-800 text-stone-100'
        }`}
      >
        {/* Mobile Phone Top Notch / Status Bar */}
        <div className="pt-2 px-5 pb-1 flex items-center justify-between text-xs font-semibold opacity-75">
          <span>9:41 PM 🌙</span>
          {/* Subtle phone notch bar */}
          <div className="w-20 h-4 bg-stone-300/40 dark:bg-stone-700/60 rounded-full mx-auto -mt-1 hidden sm:block"></div>
          <div className="flex items-center gap-1.5 text-[11px]">
            <span>Bedtime</span>
            <div className="w-4 h-2 rounded-xs border border-current flex items-center p-0.5">
              <div className="w-2.5 h-1 bg-current rounded-2xs"></div>
            </div>
          </div>
        </div>

        {/* Top Control Bar */}
        <div className="px-4 py-1.5 flex items-center justify-between border-b border-amber-200/50 dark:border-stone-800">
          {/* Level Switcher & Select */}
          <div className="flex items-center gap-1">
            <button
              onClick={onPrevLevel}
              disabled={levelNumber <= 1}
              className="p-1 rounded-lg hover:bg-amber-200/50 dark:hover:bg-stone-800 disabled:opacity-30 active:scale-95 transition-all"
              title="Previous Level"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              onClick={onOpenLevelSelect}
              className="px-2 py-1 rounded-xl bg-amber-200/60 dark:bg-stone-800 hover:bg-amber-200 text-xs font-bold flex items-center gap-1 shadow-2xs active:scale-95 transition-all"
            >
              <List className="w-3.5 h-3.5" />
              <span>Night {levelNumber}/{totalLevels}</span>
            </button>

            <button
              onClick={onNextLevel}
              disabled={levelNumber >= totalLevels}
              className="p-1 rounded-lg hover:bg-amber-200/50 dark:hover:bg-stone-800 disabled:opacity-30 active:scale-95 transition-all"
              title="Next Level"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-1">
            {/* Lamp Toggle */}
            <button
              onClick={onToggleNightLamp}
              className="p-1.5 rounded-xl bg-amber-200/60 dark:bg-stone-800 hover:bg-amber-200 dark:hover:bg-stone-700 shadow-2xs active:scale-95 transition-all"
              title={isNightLamp ? 'Turn Off Night Lamp' : 'Turn On Warm Lamp'}
            >
              {isNightLamp ? (
                <Sun className="w-3.5 h-3.5 text-amber-600" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-indigo-400" />
              )}
            </button>

            {/* Sound Toggle */}
            <button
              onClick={onToggleSound}
              className="p-1.5 rounded-xl bg-amber-200/60 dark:bg-stone-800 hover:bg-amber-200 dark:hover:bg-stone-700 shadow-2xs active:scale-95 transition-all"
              title={soundEnabled ? 'Mute Audio' : 'Enable Audio'}
            >
              {soundEnabled ? (
                <Volume2 className="w-3.5 h-3.5 text-amber-700 dark:text-stone-300" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 text-rose-500" />
              )}
            </button>

            {/* Restart Level */}
            <button
              onClick={() => {
                onRestartLevel();
                sound.playPop();
              }}
              className="p-1.5 rounded-xl bg-amber-200/60 dark:bg-stone-800 hover:bg-amber-200 dark:hover:bg-stone-700 shadow-2xs active:scale-95 transition-all"
              title="Reset Bed"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-700 dark:text-stone-300" />
            </button>

            {/* Trio Photo Avatar Button with Customizer */}
            <button
              onClick={onOpenCustomizer}
              className="flex items-center -space-x-1.5 px-2 py-0.5 rounded-xl bg-amber-200/60 dark:bg-stone-800 border border-amber-300/80 dark:border-stone-700 shadow-2xs hover:scale-105 active:scale-95 transition-all cursor-pointer"
              title="Click to view & select character photos"
            >
              <img
                src={profiles.boyfriendPhoto || '/assets/avatars/bentzi.jpg'}
                alt={profiles.boyfriendName}
                className="w-5.5 h-5.5 rounded-full object-cover border-2 border-sky-400 shadow-xs"
              />
              <img
                src={profiles.dogPhoto || '/assets/avatars/rosie.jpg'}
                alt={profiles.dogName}
                className="w-6 h-6 rounded-full object-cover border-2 border-amber-400 shadow-xs z-10"
              />
              <img
                src={profiles.girlfriendPhoto || '/assets/avatars/shai.jpg'}
                alt={profiles.girlfriendName}
                className="w-5.5 h-5.5 rounded-full object-cover border-2 border-teal-400 shadow-xs"
              />
              <span className="text-[9px] font-black text-amber-950 dark:text-amber-200 pl-2">
                📸
              </span>
            </button>
          </div>
        </div>

        {/* Story Note / Hint Banner */}
        <div className="px-4 pt-2">
          <div className="px-3 py-1.5 rounded-2xl bg-amber-100/90 dark:bg-stone-800/80 border border-amber-200 dark:border-stone-700 text-amber-950 dark:text-amber-100 flex items-start gap-2 shadow-2xs">
            <Info className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] font-medium leading-snug">
              {storyNote}
            </p>
          </div>
        </div>

        {/* Main Content Area (Bed & Tray) */}
        <div className="flex-1 px-3 py-2 flex flex-col justify-between overflow-y-auto">
          {children}
        </div>

        {/* Subtle home bar */}
        <div className="pb-2 pt-1 flex justify-center">
          <div className="w-32 h-1 bg-stone-300 dark:bg-stone-700 rounded-full"></div>
        </div>
      </div>
    </div>
  );
}
