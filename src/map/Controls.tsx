import React, { useRef, useState } from 'react';
import type { Dir } from './layout';

const D = '#2a2a34', M = '#4a4a5e', L = '#9a9ab0', W = '#1c1a30';

/** Game Boy cross D-pad. Slide your thumb across it to change direction. */
export function DPad({ onDir }: { onDir: (d: Dir | null) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [cur, setCur] = useState<Dir | null>(null);
  const curRef = useRef<Dir | null>(null);
  const set = (d: Dir | null) => {
    if (d === curRef.current) return;
    curRef.current = d;
    setCur(d);
    onDir(d);
  };
  const dirAt = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
    if (Math.hypot(x, y) < r.width * 0.1) return curRef.current;
    return Math.abs(x) > Math.abs(y) ? (x > 0 ? 'right' : 'left') : y > 0 ? 'down' : 'up';
  };
  const arm = (d: Dir, rot: number) => (
    <g transform={`rotate(${rot} 60 60)`}>
      <path d="M44 6 h32 v38 h-32 z" fill={cur === d ? M : D} />
      <path d="M60 14 l9 11 h-18 z" fill={cur === d ? L : M} />
    </g>
  );
  return (
    <div
      ref={ref}
      role="group"
      aria-label="Direction pad"
      className="w-[128px] h-[128px] touch-none"
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); set(dirAt(e)); }}
      onPointerMove={(e) => { if (curRef.current) set(dirAt(e)); }}
      onPointerUp={() => set(null)}
      onPointerCancel={() => set(null)}
      onLostPointerCapture={() => set(null)}
    >
      <svg viewBox="0 0 120 120" className="w-full h-full">
        <path d="M42 2 h36 v40 h40 v36 h-40 v40 h-36 v-40 h-40 v-36 h40 z" fill={W} transform="translate(0 3)" />
        {arm('up', 0)}
        {arm('right', 90)}
        {arm('down', 180)}
        {arm('left', 270)}
        <rect x="44" y="44" width="32" height="32" fill={D} />
        <circle cx="60" cy="60" r="7" fill={M} />
      </svg>
    </div>
  );
}

export function ABButton({ label, onPress, className = '' }: { label: string; onPress: () => void; className?: string }) {
  return (
    <div className={`flex flex-col items-center gap-1 ${className}`}>
      <button
        onPointerDown={(e) => { e.preventDefault(); onPress(); }}
        aria-label={label === 'A' ? 'A: talk / play' : 'B: back'}
        className="w-[52px] h-[52px] rounded-full bg-[#c0386a] border-[3px] border-[#1c1a30] shadow-[0_4px_0_#2e2462] active:translate-y-[3px] active:shadow-none font-arcade text-[12px] text-[#faf6e6]"
      >
        {label}
      </button>
    </div>
  );
}
