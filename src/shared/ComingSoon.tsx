import React from 'react';
import { ExitButton } from './ExitButton';
import type { GameMeta } from './types';

/** Placeholder screen for a game slot that has not been built yet. */
export function ComingSoon({ meta, onExit }: { meta: GameMeta; onExit: () => void }) {
  return (
    <div className="gb-screen min-h-[100dvh] flex flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="font-arcade text-[14px] leading-relaxed">{meta.title.toUpperCase()}</div>
      <div className="font-pixel text-[16px] max-w-[300px]">{meta.blurb}</div>
      <div className="font-arcade text-[10px] animate-pulse">COMING SOON</div>
      <ExitButton onExit={onExit} />
    </div>
  );
}
