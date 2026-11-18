import React from 'react';

/**
 * Standard "back to the map" button. Every game renders one somewhere always reachable
 * (usually top-left). Restyle via className to fit the game's look, but keep the label.
 */
export function ExitButton({ onExit, className = '', label = 'MAP' }: { onExit: () => void; className?: string; label?: string }) {
  return (
    <button
      onClick={onExit}
      aria-label="Back to the map"
      className={`font-arcade text-[9px] px-2 py-1.5 bg-[#2a3570] text-[#faf6e6] border-2 border-[#faf6e6] active:translate-y-[1px] ${className}`}
    >
      ◀ {label}
    </button>
  );
}
