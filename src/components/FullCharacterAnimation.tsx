import React, { useState, useEffect } from 'react';
import { PlayerPiece, DogState, AvatarProfiles, CellCoord } from '../types';

interface FullRosieProps {
  dog: DogState;
  profiles: AvatarProfiles;
  isCuddling?: boolean;
  className?: string;
  isDragging?: boolean;
  style?: React.CSSProperties;
  onPointerDown?: (e: React.PointerEvent) => void;
}

/**
 * Real animated Rosie (White hound/pointer with black patches, spots, and red collar)
 * Faithful to uploaded photos:
 * - Rosie1_686fbf46.jpeg: Face, floppy ears, and bright red collar
 * - Rosie3_5475fca3.jpeg & Rosie4_0167efc7.jpeg: Sleeping curled body on blanket with black saddle patch and ticking spots
 */
export function FullAnimatedRosie({
  dog,
  profiles,
  isCuddling = false,
  className = '',
  isDragging = false,
  style = {},
  onPointerDown,
}: FullRosieProps) {
  const isAlert = dog.grumpiness > 0;
  const [dream, setDream] = useState<string | null>(null);

  useEffect(() => {
    const dreams = ['🦴', '🎾', '🥓', '🐾', '✨'];
    const interval = setInterval(() => {
      if (Math.random() > 0.35 && !isAlert) {
        const item = dreams[Math.floor(Math.random() * dreams.length)];
        setDream(item);
        setTimeout(() => setDream(null), 3000);
      }
    }, 6500);
    return () => clearInterval(interval);
  }, [isAlert]);

  if (!dog.cells.length) return null;

  const minR = Math.min(...dog.cells.map((c) => c.r));
  const maxR = Math.max(...dog.cells.map((c) => c.r));
  const minC = Math.min(...dog.cells.map((c) => c.c));
  const maxC = Math.max(...dog.cells.map((c) => c.c));

  const w = Math.max(1, maxC - minC + 1);
  const h = Math.max(1, maxR - minR + 1);

  const headCell = dog.cells.find((c) => c.part === 'head') || dog.cells[0];
  const hx = (headCell.c - minC) * 100 + 50;
  const hy = (headCell.r - minR) * 100 + 50;

  // Body centers
  const nonHeadCells = dog.cells.filter((c) => c !== headCell);
  const bodyCell = nonHeadCells[0] || headCell;
  const bx = (bodyCell.c - minC) * 100 + 50;
  const by = (bodyCell.r - minR) * 100 + 50;

  const tailCell = dog.cells[dog.cells.length - 1] || bodyCell;
  const tx = (tailCell.c - minC) * 100 + 50;
  const ty = (tailCell.r - minR) * 100 + 50;

  const photoSrc = profiles?.dogPhoto || '/assets/avatars/rosie.jpg';

  return (
    <div
      onPointerDown={onPointerDown}
      className={`relative select-none cursor-grab active:cursor-grabbing z-20 touch-none ${className}`}
      style={{
        width: '100%',
        height: '100%',
        ...style,
      }}
    >
      {/* Floating Dream Bubble */}
      {dream && !isAlert && (
        <div className="absolute -top-7 left-1/4 z-40 bg-white/95 text-slate-800 text-xs px-2.5 py-0.5 rounded-full shadow-lg border border-amber-300 flex items-center gap-1 animate-dream-bubble pointer-events-none">
          <span>💭</span>
          <span className="font-black text-sm">{dream}</span>
        </div>
      )}

      {/* Floating Zzz */}
      {!isAlert && (
        <div className="absolute -top-5 right-1/4 z-30 flex flex-col items-start animate-zzz-float pointer-events-none">
          <span className="text-xs font-black text-amber-500 drop-shadow-xs">Z</span>
          <span className="text-[9px] font-bold text-amber-400 -mt-1 ml-1.5 opacity-80">z</span>
          <span className="text-[7px] font-semibold text-amber-300 -mt-1 ml-3 opacity-60">z</span>
        </div>
      )}

      {/* Cuddle Hearts */}
      {isCuddling && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-sm animate-cuddle-heart z-40 pointer-events-none">
          💖
        </div>
      )}

      {/* Alert Warning */}
      {isAlert && (
        <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-40 bg-rose-500 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-md border-2 border-white animate-bounce flex items-center gap-1 pointer-events-none whitespace-nowrap">
          <span>⚠️</span>
          <span>{dog.grumpiness >= 2 ? 'GRRR!' : 'Grrr...'}</span>
        </div>
      )}

      {/* REAL SLEEPING CANINE BODY (ORGANIC ANATOMICAL HOUND BODY) */}
      <div
        className={`w-full h-full ${
          isDragging
            ? 'scale-105 rotate-1 drop-shadow-2xl'
            : isAlert
            ? 'animate-gentle-shake'
            : 'animate-dog-breathe'
        }`}
      >
        <svg
          viewBox={`0 0 ${w * 100} ${h * 100}`}
          className="w-full h-full overflow-visible drop-shadow-md"
        >
          <defs>
            <filter id="rosie-body-shadow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feColorMatrix type="matrix" values="0 0 0 0 0.25   0 0 0 0 0.15   0 0 0 0 0.1   0 0 0 0.28 0" />
            </filter>
            <clipPath id="rosie-face-clip">
              <ellipse cx={hx} cy={hy - 4} rx="30" ry="26" />
            </clipPath>
          </defs>

          {/* Realistic Canine Body Shadow on Bed Sheets */}
          <g filter="url(#rosie-body-shadow)">
            <ellipse cx={(hx + bx) / 2} cy={(hy + by) / 2 + 6} rx="48" ry="36" fill="#000000" />
            <ellipse cx={bx} cy={by + 6} rx="42" ry="34" fill="#000000" />
            <ellipse cx={tx} cy={ty + 6} rx="34" ry="28" fill="#000000" />
          </g>

          {/* ORGANIC WHITE FUR CANINE BODY (from Rosie3 & Rosie4 sleeping photos) */}
          <g>
            {/* White Body Contour & Ribcage */}
            <path
              d={`M ${hx} ${hy - 24} Q ${(hx + bx) / 2} ${Math.min(hy, by) - 30} ${bx + 30} ${by - 10} Q ${bx + 40} ${by + 24} ${(bx + tx) / 2} ${Math.max(by, ty) + 26} Q ${tx - 26} ${ty + 26} ${tx - 20} ${ty - 10} Q ${(hx + bx) / 2} ${Math.max(hy, by) + 16} ${hx - 22} ${hy + 16} Z`}
              fill="#faf9f6"
              stroke="#e2e8f0"
              strokeWidth="2.5"
            />

            {/* Main white fur mass bridge between head and body */}
            <line
              x1={hx}
              y1={hy}
              x2={bx}
              y2={by}
              stroke="#faf9f6"
              strokeWidth="68"
              strokeLinecap="round"
            />
            <line
              x1={bx}
              y1={by}
              x2={tx}
              y2={ty}
              stroke="#faf9f6"
              strokeWidth="60"
              strokeLinecap="round"
            />

            {/* ROSIE'S DISTINCTIVE BLACK SADDLE PATCH (from Rosie3/4 sleeping photos) */}
            <path
              d={`M ${bx - 26} ${by - 26} Q ${bx} ${by - 32} ${bx + 26} ${by - 18} Q ${bx + 34} ${by + 8} ${bx + 12} ${by + 22} Q ${bx - 18} ${by + 24} ${bx - 30} ${by + 4} Z`}
              fill="#1e293b"
            />
            {/* Flank shading */}
            <ellipse cx={bx + 6} cy={by - 4} rx="22" ry="16" fill="#0f172a" />

            {/* ROSIE'S SIGNATURE BLACK TICKING SPOTS (hound speckles from uploaded photos) */}
            <circle cx={bx - 20} cy={by + 26} r="3" fill="#1e293b" />
            <circle cx={bx - 12} cy={by + 30} r="2.2" fill="#334155" />
            <circle cx={bx + 22} cy={by + 22} r="2.5" fill="#1e293b" />
            <circle cx={bx + 32} cy={by + 14} r="3" fill="#1e293b" />
            <circle cx={hx - 16} cy={hy + 22} r="2.5" fill="#1e293b" />
            <circle cx={hx + 12} cy={hy + 24} r="2" fill="#334155" />
            <circle cx={tx - 10} cy={ty + 18} r="2.8" fill="#1e293b" />

            {/* Curled Canine Hind Leg & Tucked Paws */}
            <ellipse cx={tx} cy={ty + 10} rx="24" ry="18" fill="#faf9f6" stroke="#e2e8f0" strokeWidth="2" />
            {/* Tucked rear paw with dark paw pads */}
            <circle cx={tx - 8} cy={ty + 20} r="10" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1.5" />
            <circle cx={tx - 11} cy={ty + 18} r="2.5" fill="#334155" />
            <circle cx={tx - 7} cy={ty + 22} r="2.5" fill="#334155" />
            <circle cx={tx - 4} cy={ty + 18} r="2.5" fill="#334155" />

            {/* Front Paws Tucked under Chest */}
            <ellipse cx={hx - 8} cy={hy + 20} rx="12" ry="8" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
            <ellipse cx={hx + 8} cy={hy + 22} rx="11" ry="8" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />

            {/* Curled Hound Tail wrapping around with white tip */}
            <path
              d={`M ${tx + 18} ${ty + 4} Q ${tx + 36} ${ty + 20} ${tx + 22} ${ty + 34} Q ${tx + 6} ${ty + 40} ${tx - 6} ${ty + 32}`}
              stroke="#faf9f6"
              strokeWidth="16"
              strokeLinecap="round"
              fill="none"
              className="animate-tail-swish"
            />
            {/* Black base of tail */}
            <path
              d={`M ${tx + 18} ${ty + 4} Q ${tx + 26} ${ty + 12} ${tx + 28} ${ty + 20}`}
              stroke="#1e293b"
              strokeWidth="16"
              strokeLinecap="round"
              fill="none"
            />
            {/* Fluffy White Tip of Tail */}
            <circle cx={tx - 6} cy={ty + 32} r="9" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />

            {/* ROSIE'S HOUND HEAD & FACE */}
            <g>
              {/* Head Base */}
              <ellipse cx={hx} cy={hy - 4} rx="30" ry="26" fill="#faf9f6" stroke="#e2e8f0" strokeWidth="2" />

              {/* Real photo blended inside head */}
              <image
                href={photoSrc}
                x={hx - 30}
                y={hy - 32}
                width="60"
                height="56"
                clipPath="url(#rosie-face-clip)"
                preserveAspectRatio="xMidYMid slice"
                opacity="0.88"
              />

              {/* Floppy Hound Ears (from Rosie1 photo) */}
              {/* Left Ear (White) */}
              <path
                d={`M ${hx - 22} ${hy - 14} Q ${hx - 36} ${hy} ${hx - 28} ${hy + 16} Q ${hx - 20} ${hy + 22} ${hx - 14} ${hy + 8}`}
                fill="#f1f5f9"
                stroke="#cbd5e1"
                strokeWidth="1.8"
                className="animate-ear-twitch"
              />
              {/* Right Ear (Signature Black Patch Ear from Rosie1 photo!) */}
              <path
                d={`M ${hx + 18} ${hy - 16} Q ${hx + 34} ${hy - 2} ${hx + 28} ${hy + 16} Q ${hx + 20} ${hy + 22} ${hx + 12} ${hy + 8}`}
                fill="#1e293b"
                stroke="#0f172a"
                strokeWidth="1.8"
                className="animate-ear-twitch"
              />

              {/* Cute sleeping muzzle & nose */}
              <ellipse cx={hx} cy={hy + 12} rx="14" ry="10" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5" />
              {/* Black Hound Nose Leather */}
              <path
                d={`M ${hx - 6} ${hy + 8} Q ${hx} ${hy + 6} ${hx + 6} ${hy + 8} Q ${hx + 4} ${hy + 14} ${hx} ${hy + 15} Q ${hx - 4} ${hy + 14} Z`}
                fill="#0f172a"
              />
              {/* Sleeping Eyes (Happy closed curves) */}
              <path
                d={`M ${hx - 14} ${hy - 2} Q ${hx - 9} ${hy + 3} ${hx - 4} ${hy - 1}`}
                stroke="#0f172a"
                strokeWidth="2.4"
                fill="none"
                strokeLinecap="round"
              />
              <path
                d={`M ${hx + 4} ${hy - 1} Q ${hx + 9} ${hy + 3} ${hx + 14} ${hy - 2}`}
                stroke="#0f172a"
                strokeWidth="2.4"
                fill="none"
                strokeLinecap="round"
              />

              {/* ROSIE'S ICONIC RED COLLAR WITH GOLD TAG (from Rosie1 photo) */}
              <g>
                <path
                  d={`M ${hx - 22} ${hy + 18} Q ${hx} ${hy + 24} ${hx + 22} ${hy + 18}`}
                  stroke="#dc2626"
                  strokeWidth="8"
                  strokeLinecap="round"
                  fill="none"
                />
                {/* Collar stitching */}
                <path
                  d={`M ${hx - 20} ${hy + 18} Q ${hx} ${hy + 24} ${hx + 20} ${hy + 18}`}
                  stroke="#ef4444"
                  strokeWidth="3"
                  strokeDasharray="3,2"
                  fill="none"
                />
                {/* Shiny Golden Tag */}
                <circle cx={hx} cy={hy + 26} r="6.5" fill="#f59e0b" stroke="#b45309" strokeWidth="1.5" />
                <circle cx={hx - 1.5} cy={hy + 24.5} r="2" fill="#fef3c7" />
              </g>
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}

interface FullHumanProps {
  piece: PlayerPiece;
  profiles: AvatarProfiles;
  isCuddling?: boolean;
  className?: string;
  isDragging?: boolean;
  style?: React.CSSProperties;
  onPointerDown?: (e: React.PointerEvent, anchor: CellCoord) => void;
}

/**
 * Real animated Bentzi (Man 1)
 * Faithful to uploaded photos:
 * - bentzi2, bentzi3, bentzi4: Signature sunglasses pushed up on curly dark hair
 * - bentzi1 & bentzi2: Signature dark charcoal heather tee & grey athletic shorts
 * - Real bearded face resting on plush bed pillow
 */
export function FullAnimatedBentzi({
  piece,
  profiles,
  isCuddling = false,
  className = '',
  isDragging = false,
  style = {},
  onPointerDown,
}: FullHumanProps) {
  const [dream, setDream] = useState<string | null>(null);

  useEffect(() => {
    const dreams = ['☕', '⭐', '🛌', '🌙', '🎧'];
    const interval = setInterval(() => {
      if (Math.random() > 0.4) {
        const item = dreams[Math.floor(Math.random() * dreams.length)];
        setDream(item);
        setTimeout(() => setDream(null), 3000);
      }
    }, 7500);
    return () => clearInterval(interval);
  }, []);

  const placedCells = piece.cells.map((c) => ({
    r: c.r,
    c: c.c,
    part: c.part || 'torso',
    cellOffset: c,
  }));

  const minR = Math.min(...placedCells.map((c) => c.r));
  const maxR = Math.max(...placedCells.map((c) => c.r));
  const minC = Math.min(...placedCells.map((c) => c.c));
  const maxC = Math.max(...placedCells.map((c) => c.c));

  const w = Math.max(1, maxC - minC + 1);
  const h = Math.max(1, maxR - minR + 1);

  const photoSrc = profiles?.boyfriendPhoto || '/assets/avatars/bentzi.jpg';

  const headCell = placedCells.find((c) => c.part === 'head') || placedCells[0];
  const torsoCell = placedCells.find((c) => c.part === 'torso') || placedCells[1] || placedCells[0];
  const armCell = placedCells.find((c) => c.part === 'arm');
  const legCell = placedCells.find((c) => c.part === 'leg');
  const feetCell = placedCells.find((c) => c.part === 'feet');

  const getCellCenter = (c: { r: number; c: number }) => ({
    x: (c.c - minC) * 100 + 50,
    y: (c.r - minR) * 100 + 50,
  });

  const headCenter = getCellCenter(headCell);
  const torsoCenter = getCellCenter(torsoCell);
  const armCenter = armCell ? getCellCenter(armCell) : null;
  const legCenter = legCell ? getCellCenter(legCell) : null;
  const feetCenter = feetCell ? getCellCenter(feetCell) : null;

  return (
    <div
      className={`relative select-none cursor-grab active:cursor-grabbing z-20 touch-none ${className}`}
      style={{
        width: '100%',
        height: '100%',
        ...style,
      }}
      onPointerDown={(e) => onPointerDown && onPointerDown(e, headCell.cellOffset)}
    >
      {/* Floating Dream Bubble */}
      {dream && (
        <div className="absolute -top-7 left-1/4 z-40 bg-white/95 text-slate-800 text-xs px-2.5 py-0.5 rounded-full shadow-lg border border-sky-300 flex items-center gap-1 animate-dream-bubble pointer-events-none">
          <span>💭</span>
          <span className="font-black text-sm">{dream}</span>
        </div>
      )}

      {/* Floating Zzz */}
      <div className="absolute -top-5 right-1/4 z-30 flex flex-col items-start animate-zzz-float pointer-events-none">
        <span className="text-xs font-black text-sky-500 drop-shadow-xs">Z</span>
        <span className="text-[9px] font-bold text-sky-400 -mt-1 ml-1.5 opacity-80">z</span>
        <span className="text-[7px] font-semibold text-sky-300 -mt-1 ml-3 opacity-60">z</span>
      </div>

      {/* Cuddle Hearts */}
      {isCuddling && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-sm animate-cuddle-heart z-40 pointer-events-none">
          💖
        </div>
      )}

      {/* REAL SLEEPING MAN 1 (BENTZI) */}
      <div
        className={`w-full h-full ${
          isDragging ? 'scale-105 rotate-1 drop-shadow-2xl' : 'animate-human-breathe'
        }`}
      >
        <svg
          viewBox={`0 0 ${w * 100} ${h * 100}`}
          className="w-full h-full overflow-visible drop-shadow-lg"
        >
          <defs>
            {/* Charcoal Heather Tee gradient (from bentzi1 & bentzi2 photos) */}
            <linearGradient id="bentzi-tee-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#384354" />
              <stop offset="60%" stopColor="#252f3e" />
              <stop offset="100%" stopColor="#171e28" />
            </linearGradient>

            {/* Grey Athletic Shorts gradient (from bentzi2 photo) */}
            <linearGradient id="bentzi-shorts-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#64748b" />
              <stop offset="100%" stopColor="#475569" />
            </linearGradient>

            {/* Soft Ambient Body Shadow onto Mattress */}
            <filter id="bentzi-shadow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feColorMatrix type="matrix" values="0 0 0 0 0.1   0 0 0 0 0.15   0 0 0 0 0.25   0 0 0 0.3 0" />
            </filter>

            <clipPath id="bentzi-head-clip">
              <circle cx={headCenter.x} cy={headCenter.y} r="32" />
            </clipPath>
          </defs>

          {/* Realistic Continuous Body Shadow on Sheets */}
          <g filter="url(#bentzi-shadow)">
            <ellipse cx={headCenter.x} cy={headCenter.y + 4} rx="38" ry="34" fill="#000000" />
            <ellipse cx={torsoCenter.x} cy={torsoCenter.y + 4} rx="42" ry="36" fill="#000000" />
            <line x1={headCenter.x} y1={headCenter.y} x2={torsoCenter.x} y2={torsoCenter.y} stroke="#000000" strokeWidth="68" strokeLinecap="round" />
            {armCenter && <line x1={torsoCenter.x} y1={torsoCenter.y} x2={armCenter.x} y2={armCenter.y} stroke="#000000" strokeWidth="48" strokeLinecap="round" />}
            {legCenter && <line x1={torsoCenter.x} y1={torsoCenter.y} x2={legCenter.x} y2={legCenter.y} stroke="#000000" strokeWidth="54" strokeLinecap="round" />}
            {feetCenter && legCenter && <line x1={legCenter.x} y1={legCenter.y} x2={feetCenter.x} y2={feetCenter.y} stroke="#000000" strokeWidth="44" strokeLinecap="round" />}
          </g>

          {/* 1. PLUSH BED PILLOW UNDER HEAD */}
          <g>
            <rect
              x={headCenter.x - 46}
              y={headCenter.y - 46}
              width="92"
              height="92"
              rx="24"
              fill="#ffffff"
              stroke="#e2e8f0"
              strokeWidth="2.5"
            />
            {/* Pillow piping border */}
            <rect
              x={headCenter.x - 41}
              y={headCenter.y - 41}
              width="82"
              height="82"
              rx="20"
              fill="none"
              stroke="#f1f5f9"
              strokeWidth="1.5"
            />
            {/* Soft indentation where head rests */}
            <ellipse cx={headCenter.x} cy={headCenter.y + 6} rx="26" ry="18" fill="#f8fafc" />
          </g>

          {/* 2. REAL HUMAN BODY (TORSO, SHORTS, MUSCULAR LEGS, ARMS, SOCKS) */}
          <g>
            {/* ANATOMICAL TORSO & CHARCOAL HEATHER TEE */}
            {/* Neck connecting head to torso */}
            <line
              x1={headCenter.x}
              y1={headCenter.y}
              x2={torsoCenter.x}
              y2={torsoCenter.y}
              stroke="#fed7aa"
              strokeWidth="38"
              strokeLinecap="round"
            />

            {/* Shoulders & Chest mass in charcoal tee */}
            <path
              d={`M ${torsoCenter.x - 36} ${torsoCenter.y - 28} Q ${torsoCenter.x} ${torsoCenter.y - 34} ${torsoCenter.x + 36} ${torsoCenter.y - 28} L ${torsoCenter.x + 32} ${torsoCenter.y + 24} Q ${torsoCenter.x} ${torsoCenter.y + 28} ${torsoCenter.x - 32} ${torsoCenter.y + 24} Z`}
              fill="url(#bentzi-tee-grad)"
              stroke="#1e293b"
              strokeWidth="1.5"
            />
            <ellipse cx={torsoCenter.x} cy={torsoCenter.y - 4} rx="34" ry="28" fill="url(#bentzi-tee-grad)" />

            {/* T-shirt Crewneck Ribbed Collar */}
            <path
              d={`M ${torsoCenter.x - 16} ${torsoCenter.y - 28} Q ${torsoCenter.x} ${torsoCenter.y - 18} ${torsoCenter.x + 16} ${torsoCenter.y - 28}`}
              stroke="#475569"
              strokeWidth="3.5"
              fill="none"
            />
            {/* Fabric wrinkles across chest/abdomen */}
            <path
              d={`M ${torsoCenter.x - 20} ${torsoCenter.y - 2} Q ${torsoCenter.x} ${torsoCenter.y + 4} ${torsoCenter.x + 18} ${torsoCenter.y - 4}`}
              stroke="#334155"
              strokeWidth="2"
              fill="none"
            />
            <path
              d={`M ${torsoCenter.x - 16} ${torsoCenter.y + 12} Q ${torsoCenter.x} ${torsoCenter.y + 16} ${torsoCenter.x + 14} ${torsoCenter.y + 10}`}
              stroke="#334155"
              strokeWidth="2"
              fill="none"
            />

            {/* ANATOMICAL ARMS & HANDS */}
            {armCenter ? (
              <g>
                {/* Short Sleeve over Bicep */}
                <line
                  x1={torsoCenter.x}
                  y1={torsoCenter.y - 10}
                  x2={(torsoCenter.x + armCenter.x) / 2}
                  y2={(torsoCenter.y + armCenter.y) / 2 - 5}
                  stroke="url(#bentzi-tee-grad)"
                  strokeWidth="38"
                  strokeLinecap="round"
                />
                {/* Sleeve Hem line */}
                <circle cx={(torsoCenter.x + armCenter.x) / 2} cy={(torsoCenter.y + armCenter.y) / 2 - 5} r="18" fill="none" stroke="#475569" strokeWidth="2" />

                {/* Forearm (warm skin tone) */}
                <line
                  x1={(torsoCenter.x + armCenter.x) / 2}
                  y1={(torsoCenter.y + armCenter.y) / 2 - 5}
                  x2={armCenter.x}
                  y2={armCenter.y}
                  stroke="#fed7aa"
                  strokeWidth="30"
                  strokeLinecap="round"
                />
                {/* Wrist & Sleeping Hand with relaxed curled fingers */}
                <circle cx={armCenter.x} cy={armCenter.y} r="15" fill="#fed7aa" stroke="#fba760" strokeWidth="1.5" />
                <path
                  d={`M ${armCenter.x - 8} ${armCenter.y} Q ${armCenter.x} ${armCenter.y + 6} ${armCenter.x + 8} ${armCenter.y}`}
                  stroke="#ea580c"
                  strokeWidth="1.8"
                  fill="none"
                  strokeLinecap="round"
                />
                <circle cx={armCenter.x + 5} cy={armCenter.y - 4} r="4" fill="#fed7aa" />
              </g>
            ) : (
              /* Arm folded comfortably against torso */
              <g>
                <path
                  d={`M ${torsoCenter.x + 24} ${torsoCenter.y - 16} Q ${torsoCenter.x + 36} ${torsoCenter.y} ${torsoCenter.x + 18} ${torsoCenter.y + 12}`}
                  stroke="url(#bentzi-tee-grad)"
                  strokeWidth="24"
                  strokeLinecap="round"
                  fill="none"
                />
                <circle cx={torsoCenter.x + 16} cy={torsoCenter.y + 14} r="11" fill="#fed7aa" stroke="#fba760" strokeWidth="1.5" />
              </g>
            )}

            {/* WAIST & GREY SHORTS (from bentzi2 photo) */}
            {legCenter ? (
              <g>
                {/* Shorts Waistband */}
                <path
                  d={`M ${torsoCenter.x - 28} ${torsoCenter.y + 20} Q ${torsoCenter.x} ${torsoCenter.y + 24} ${torsoCenter.x + 28} ${torsoCenter.y + 20}`}
                  stroke="#475569"
                  strokeWidth="4"
                  fill="none"
                />
                {/* Grey athletic shorts fabric covering pelvis and upper thigh */}
                <line
                  x1={torsoCenter.x}
                  y1={torsoCenter.y + 16}
                  x2={(torsoCenter.x + legCenter.x) / 2}
                  y2={(torsoCenter.y + legCenter.y) / 2}
                  stroke="url(#bentzi-shorts-grad)"
                  strokeWidth="50"
                  strokeLinecap="round"
                />
                {/* Shorts leg opening hem */}
                <line
                  x1={(torsoCenter.x + legCenter.x) / 2 - 16}
                  y1={(torsoCenter.y + legCenter.y) / 2}
                  x2={(torsoCenter.x + legCenter.x) / 2 + 16}
                  y2={(torsoCenter.y + legCenter.y) / 2}
                  stroke="#334155"
                  strokeWidth="2"
                />

                {/* MUSCULAR BARE LEGS & KNEE CAPS */}
                <line
                  x1={(torsoCenter.x + legCenter.x) / 2}
                  y1={(torsoCenter.y + legCenter.y) / 2}
                  x2={legCenter.x}
                  y2={legCenter.y}
                  stroke="#fed7aa"
                  strokeWidth="38"
                  strokeLinecap="round"
                />
                {/* Knee cap contour (patella definition) */}
                <ellipse cx={legCenter.x} cy={legCenter.y} rx="17" ry="15" fill="#fed7aa" stroke="#fba760" strokeWidth="1.5" />
                <path
                  d={`M ${legCenter.x - 6} ${legCenter.y - 2} Q ${legCenter.x} ${legCenter.y + 4} ${legCenter.x + 6} ${legCenter.y - 2}`}
                  stroke="#fb923c"
                  strokeWidth="1.5"
                  fill="none"
                />
              </g>
            ) : (
              <g>
                <ellipse cx={torsoCenter.x} cy={torsoCenter.y + 28} rx="26" ry="18" fill="url(#bentzi-shorts-grad)" />
              </g>
            )}

            {/* LOWER LEGS & COZY BEDTIME SOCKS */}
            {feetCenter && legCenter && (
              <g>
                {/* Calf muscle contour */}
                <line
                  x1={legCenter.x}
                  y1={legCenter.y}
                  x2={feetCenter.x}
                  y2={feetCenter.y}
                  stroke="#fed7aa"
                  strokeWidth="32"
                  strokeLinecap="round"
                />

                {/* Cozy Cotton Bedtime Sock */}
                <ellipse cx={feetCenter.x} cy={feetCenter.y} rx="18" ry="14" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="2" />
                {/* Sock Ribbed Ankle Cuff */}
                <path
                  d={`M ${feetCenter.x - 12} ${feetCenter.y - 8} Q ${feetCenter.x} ${feetCenter.y - 12} ${feetCenter.x + 12} ${feetCenter.y - 8}`}
                  stroke="#64748b"
                  strokeWidth="2"
                  fill="none"
                />
                {/* Sock Toe Cap */}
                <ellipse cx={feetCenter.x + 4} cy={feetCenter.y + 2} rx="8" ry="6" fill="#94a3b8" />
              </g>
            )}
          </g>

          {/* 3. BENTZI'S REAL FACE PHOTO WITH SIGNATURE SUNGLASSES ON CURLY HAIR */}
          <g>
            {/* Face base & skin tone border */}
            <circle cx={headCenter.x} cy={headCenter.y} r="32" fill="#fed7aa" stroke="#38bdf8" strokeWidth="2.5" />

            {/* Real photo crop */}
            <image
              href={photoSrc}
              x={headCenter.x - 34}
              y={headCenter.y - 34}
              width="68"
              height="68"
              clipPath="url(#bentzi-head-clip)"
              preserveAspectRatio="xMidYMid slice"
            />

            {/* Soft sleeping eyelids contour */}
            <path
              d={`M ${headCenter.x - 16} ${headCenter.y + 2} Q ${headCenter.x - 10} ${headCenter.y + 7} ${headCenter.x - 4} ${headCenter.y + 2}`}
              stroke="#0f172a"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d={`M ${headCenter.x + 4} ${headCenter.y + 2} Q ${headCenter.x + 10} ${headCenter.y + 7} ${headCenter.x + 16} ${headCenter.y + 2}`}
              stroke="#0f172a"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />

            {/* SIGNATURE SUNGLASSES PUSHED UP ON CURLY HAIR (from bentzi2, bentzi3, bentzi4) */}
            <g transform={`translate(${headCenter.x - 23}, ${headCenter.y - 34})`}>
              {/* Left Lens */}
              <rect x="0" y="0" width="19" height="11" rx="4" fill="#0f172a" stroke="#334155" strokeWidth="1.8" />
              {/* Right Lens */}
              <rect x="27" y="0" width="19" height="11" rx="4" fill="#0f172a" stroke="#334155" strokeWidth="1.8" />
              {/* Sunglasses Nose Bridge */}
              <line x1="19" y1="5" x2="27" y2="5" stroke="#94a3b8" strokeWidth="2.2" strokeLinecap="round" />
              {/* Cool Lens Reflection Gleams */}
              <line x1="3" y1="3" x2="11" y2="3" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="30" y1="3" x2="38" y2="3" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}

/**
 * Real animated Shai (Man 2)
 * Faithful to uploaded photo Shai2_ba5ddb92.jpeg (Shai sleeping on the couch):
 * - Dark grey/charcoal t-shirt & black boxer shorts (exact outfit from Shai2!)
 * - Curled sleeping posture with arm tucked under head and knee bent
 * - Real photo face with dark trimmed beard resting peacefully on pillow
 */
export function FullAnimatedShai({
  piece,
  profiles,
  isCuddling = false,
  className = '',
  isDragging = false,
  style = {},
  onPointerDown,
}: FullHumanProps) {
  const [dream, setDream] = useState<string | null>(null);

  useEffect(() => {
    const dreams = ['🌟', '🌿', '📖', '☕', '✨'];
    const interval = setInterval(() => {
      if (Math.random() > 0.4) {
        const item = dreams[Math.floor(Math.random() * dreams.length)];
        setDream(item);
        setTimeout(() => setDream(null), 3000);
      }
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const placedCells = piece.cells.map((c) => ({
    r: c.r,
    c: c.c,
    part: c.part || 'torso',
    cellOffset: c,
  }));

  const minR = Math.min(...placedCells.map((c) => c.r));
  const maxR = Math.max(...placedCells.map((c) => c.r));
  const minC = Math.min(...placedCells.map((c) => c.c));
  const maxC = Math.max(...placedCells.map((c) => c.c));

  const w = Math.max(1, maxC - minC + 1);
  const h = Math.max(1, maxR - minR + 1);

  const photoSrc = profiles?.girlfriendPhoto || '/assets/avatars/shai.jpg';

  const headCell = placedCells.find((c) => c.part === 'head') || placedCells[0];
  const torsoCell = placedCells.find((c) => c.part === 'torso') || placedCells[1] || placedCells[0];
  const armCell = placedCells.find((c) => c.part === 'arm');
  const legCell = placedCells.find((c) => c.part === 'leg');
  const feetCell = placedCells.find((c) => c.part === 'feet');

  const getCellCenter = (c: { r: number; c: number }) => ({
    x: (c.c - minC) * 100 + 50,
    y: (c.r - minR) * 100 + 50,
  });

  const headCenter = getCellCenter(headCell);
  const torsoCenter = getCellCenter(torsoCell);
  const armCenter = armCell ? getCellCenter(armCell) : null;
  const legCenter = legCell ? getCellCenter(legCell) : null;
  const feetCenter = feetCell ? getCellCenter(feetCell) : null;

  return (
    <div
      className={`relative select-none cursor-grab active:cursor-grabbing z-20 touch-none ${className}`}
      style={{
        width: '100%',
        height: '100%',
        ...style,
      }}
      onPointerDown={(e) => onPointerDown && onPointerDown(e, headCell.cellOffset)}
    >
      {/* Floating Dream Bubble */}
      {dream && (
        <div className="absolute -top-7 left-1/4 z-40 bg-white/95 text-slate-800 text-xs px-2.5 py-0.5 rounded-full shadow-lg border border-teal-300 flex items-center gap-1 animate-dream-bubble pointer-events-none">
          <span>💭</span>
          <span className="font-black text-sm">{dream}</span>
        </div>
      )}

      {/* Floating Zzz */}
      <div className="absolute -top-5 right-1/4 z-30 flex flex-col items-start animate-zzz-float pointer-events-none">
        <span className="text-xs font-black text-teal-500 drop-shadow-xs">Z</span>
        <span className="text-[9px] font-bold text-teal-400 -mt-1 ml-1.5 opacity-80">z</span>
        <span className="text-[7px] font-semibold text-teal-300 -mt-1 ml-3 opacity-60">z</span>
      </div>

      {/* Cuddle Hearts */}
      {isCuddling && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-sm animate-cuddle-heart z-40 pointer-events-none">
          💖
        </div>
      )}

      {/* REAL SLEEPING MAN 2 (SHAI IN CHARCOAL TEE & BLACK BOXERS FROM SHAI2 PHOTO) */}
      <div
        className={`w-full h-full ${
          isDragging ? 'scale-105 rotate-1 drop-shadow-2xl' : 'animate-human-breathe'
        }`}
      >
        <svg
          viewBox={`0 0 ${w * 100} ${h * 100}`}
          className="w-full h-full overflow-visible drop-shadow-lg"
        >
          <defs>
            {/* Charcoal/Dark Slate Tee gradient (from Shai2 photo) */}
            <linearGradient id="shai-tee-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#475569" />
              <stop offset="60%" stopColor="#334155" />
              <stop offset="100%" stopColor="#1e293b" />
            </linearGradient>

            {/* Black Boxers gradient (from Shai2 photo) */}
            <linearGradient id="shai-boxers-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#0b0f19" />
            </linearGradient>

            {/* Soft Ambient Body Shadow onto Mattress */}
            <filter id="shai-shadow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feColorMatrix type="matrix" values="0 0 0 0 0.1   0 0 0 0 0.2   0 0 0 0 0.2   0 0 0 0.3 0" />
            </filter>

            <clipPath id="shai-head-clip">
              <circle cx={headCenter.x} cy={headCenter.y} r="32" />
            </clipPath>
          </defs>

          {/* Under-body Shadow on Bed Sheets */}
          <g filter="url(#shai-shadow)">
            <ellipse cx={headCenter.x} cy={headCenter.y + 4} rx="38" ry="34" fill="#000000" />
            <ellipse cx={torsoCenter.x} cy={torsoCenter.y + 4} rx="42" ry="36" fill="#000000" />
            <line x1={headCenter.x} y1={headCenter.y} x2={torsoCenter.x} y2={torsoCenter.y} stroke="#000000" strokeWidth="68" strokeLinecap="round" />
            {armCenter && <line x1={torsoCenter.x} y1={torsoCenter.y} x2={armCenter.x} y2={armCenter.y} stroke="#000000" strokeWidth="48" strokeLinecap="round" />}
            {legCenter && <line x1={torsoCenter.x} y1={torsoCenter.y} x2={legCenter.x} y2={legCenter.y} stroke="#000000" strokeWidth="54" strokeLinecap="round" />}
            {feetCenter && legCenter && <line x1={legCenter.x} y1={legCenter.y} x2={feetCenter.x} y2={feetCenter.y} stroke="#000000" strokeWidth="44" strokeLinecap="round" />}
          </g>

          {/* 1. PLUSH BED PILLOW UNDER HEAD */}
          <g>
            <rect
              x={headCenter.x - 46}
              y={headCenter.y - 46}
              width="92"
              height="92"
              rx="24"
              fill="#ffffff"
              stroke="#e2e8f0"
              strokeWidth="2.5"
            />
            <rect
              x={headCenter.x - 41}
              y={headCenter.y - 41}
              width="82"
              height="82"
              rx="20"
              fill="none"
              stroke="#f1f5f9"
              strokeWidth="1.5"
            />
            <ellipse cx={headCenter.x} cy={headCenter.y + 6} rx="26" ry="18" fill="#f8fafc" />
          </g>

          {/* 2. REAL HUMAN TORSO (SHAI IN CHARCOAL TEE & BLACK BOXERS FROM SHAI2 PHOTO) */}
          <g>
            {/* Neck connecting to chest */}
            <line
              x1={headCenter.x}
              y1={headCenter.y}
              x2={torsoCenter.x}
              y2={torsoCenter.y}
              stroke="#fed7aa"
              strokeWidth="38"
              strokeLinecap="round"
            />

            {/* Torso & Charcoal Tee */}
            <path
              d={`M ${torsoCenter.x - 36} ${torsoCenter.y - 28} Q ${torsoCenter.x} ${torsoCenter.y - 34} ${torsoCenter.x + 36} ${torsoCenter.y - 28} L ${torsoCenter.x + 32} ${torsoCenter.y + 24} Q ${torsoCenter.x} ${torsoCenter.y + 28} ${torsoCenter.x - 32} ${torsoCenter.y + 24} Z`}
              fill="url(#shai-tee-grad)"
              stroke="#0f172a"
              strokeWidth="1.5"
            />
            <ellipse cx={torsoCenter.x} cy={torsoCenter.y - 4} rx="34" ry="28" fill="url(#shai-tee-grad)" />

            {/* Crewneck collar */}
            <path
              d={`M ${torsoCenter.x - 16} ${torsoCenter.y - 28} Q ${torsoCenter.x} ${torsoCenter.y - 18} ${torsoCenter.x + 16} ${torsoCenter.y - 28}`}
              stroke="#64748b"
              strokeWidth="3.5"
              fill="none"
            />
            {/* Soft folds in t-shirt */}
            <path
              d={`M ${torsoCenter.x - 20} ${torsoCenter.y - 2} Q ${torsoCenter.x} ${torsoCenter.y + 4} ${torsoCenter.x + 18} ${torsoCenter.y - 4}`}
              stroke="#1e293b"
              strokeWidth="2"
              fill="none"
            />

            {/* ANATOMICAL ARMS & HANDS */}
            {armCenter ? (
              <g>
                <line
                  x1={torsoCenter.x}
                  y1={torsoCenter.y - 10}
                  x2={(torsoCenter.x + armCenter.x) / 2}
                  y2={(torsoCenter.y + armCenter.y) / 2 - 5}
                  stroke="url(#shai-tee-grad)"
                  strokeWidth="38"
                  strokeLinecap="round"
                />
                <circle cx={(torsoCenter.x + armCenter.x) / 2} cy={(torsoCenter.y + armCenter.y) / 2 - 5} r="18" fill="none" stroke="#64748b" strokeWidth="2" />

                <line
                  x1={(torsoCenter.x + armCenter.x) / 2}
                  y1={(torsoCenter.y + armCenter.y) / 2 - 5}
                  x2={armCenter.x}
                  y2={armCenter.y}
                  stroke="#fed7aa"
                  strokeWidth="30"
                  strokeLinecap="round"
                />
                <circle cx={armCenter.x} cy={armCenter.y} r="15" fill="#fed7aa" stroke="#fba760" strokeWidth="1.5" />
                <path
                  d={`M ${armCenter.x - 8} ${armCenter.y} Q ${armCenter.x} ${armCenter.y + 6} ${armCenter.x + 8} ${armCenter.y}`}
                  stroke="#ea580c"
                  strokeWidth="1.8"
                  fill="none"
                  strokeLinecap="round"
                />
              </g>
            ) : (
              <g>
                <path
                  d={`M ${torsoCenter.x + 24} ${torsoCenter.y - 16} Q ${torsoCenter.x + 36} ${torsoCenter.y} ${torsoCenter.x + 18} ${torsoCenter.y + 12}`}
                  stroke="url(#shai-tee-grad)"
                  strokeWidth="24"
                  strokeLinecap="round"
                  fill="none"
                />
                <circle cx={torsoCenter.x + 16} cy={torsoCenter.y + 14} r="11" fill="#fed7aa" stroke="#fba760" strokeWidth="1.5" />
              </g>
            )}

            {/* WAIST & BLACK BOXER SHORTS (exact sleepwear from Shai2 photo) */}
            {legCenter ? (
              <g>
                {/* Black Boxers Waistband */}
                <path
                  d={`M ${torsoCenter.x - 28} ${torsoCenter.y + 20} Q ${torsoCenter.x} ${torsoCenter.y + 24} ${torsoCenter.x + 28} ${torsoCenter.y + 20}`}
                  stroke="#0f172a"
                  strokeWidth="4"
                  fill="none"
                />
                <line
                  x1={torsoCenter.x}
                  y1={torsoCenter.y + 16}
                  x2={(torsoCenter.x + legCenter.x) / 2}
                  y2={(torsoCenter.y + legCenter.y) / 2}
                  stroke="url(#shai-boxers-grad)"
                  strokeWidth="50"
                  strokeLinecap="round"
                />
                <line
                  x1={(torsoCenter.x + legCenter.x) / 2 - 16}
                  y1={(torsoCenter.y + legCenter.y) / 2}
                  x2={(torsoCenter.x + legCenter.x) / 2 + 16}
                  y2={(torsoCenter.y + legCenter.y) / 2}
                  stroke="#0f172a"
                  strokeWidth="2"
                />

                {/* Muscular Bare Legs & Bent Knee (from Shai2 photo) */}
                <line
                  x1={(torsoCenter.x + legCenter.x) / 2}
                  y1={(torsoCenter.y + legCenter.y) / 2}
                  x2={legCenter.x}
                  y2={legCenter.y}
                  stroke="#fed7aa"
                  strokeWidth="38"
                  strokeLinecap="round"
                />
                <ellipse cx={legCenter.x} cy={legCenter.y} rx="17" ry="15" fill="#fed7aa" stroke="#fba760" strokeWidth="1.5" />
                <path
                  d={`M ${legCenter.x - 6} ${legCenter.y - 2} Q ${legCenter.x} ${legCenter.y + 4} ${legCenter.x + 6} ${legCenter.y - 2}`}
                  stroke="#fb923c"
                  strokeWidth="1.5"
                  fill="none"
                />
              </g>
            ) : (
              <g>
                <ellipse cx={torsoCenter.x} cy={torsoCenter.y + 28} rx="26" ry="18" fill="url(#shai-boxers-grad)" />
              </g>
            )}

            {/* LOWER LEG & BEDTIME SOCKS */}
            {feetCenter && legCenter && (
              <g>
                <line
                  x1={legCenter.x}
                  y1={legCenter.y}
                  x2={feetCenter.x}
                  y2={feetCenter.y}
                  stroke="#fed7aa"
                  strokeWidth="32"
                  strokeLinecap="round"
                />
                <ellipse cx={feetCenter.x} cy={feetCenter.y} rx="18" ry="14" fill="#a7f3d0" stroke="#059669" strokeWidth="2" />
                <path
                  d={`M ${feetCenter.x - 12} ${feetCenter.y - 8} Q ${feetCenter.x} ${feetCenter.y - 12} ${feetCenter.x + 12} ${feetCenter.y - 8}`}
                  stroke="#047857"
                  strokeWidth="2"
                  fill="none"
                />
                <ellipse cx={feetCenter.x + 4} cy={feetCenter.y + 2} rx="8" ry="6" fill="#6ee7b7" />
              </g>
            )}
          </g>

          {/* 3. SHAI'S REAL PHOTO FACE WITH TRIMMED DARK BEARD ON PILLOW */}
          <g>
            <circle cx={headCenter.x} cy={headCenter.y} r="32" fill="#fed7aa" stroke="#2dd4bf" strokeWidth="2.5" />
            <image
              href={photoSrc}
              x={headCenter.x - 34}
              y={headCenter.y - 34}
              width="68"
              height="68"
              clipPath="url(#shai-head-clip)"
              preserveAspectRatio="xMidYMid slice"
            />
            {/* Peaceful closed sleeping eyelids */}
            <path
              d={`M ${headCenter.x - 16} ${headCenter.y + 2} Q ${headCenter.x - 10} ${headCenter.y + 7} ${headCenter.x - 4} ${headCenter.y + 2}`}
              stroke="#0f172a"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d={`M ${headCenter.x + 4} ${headCenter.y + 2} Q ${headCenter.x + 10} ${headCenter.y + 7} ${headCenter.x + 16} ${headCenter.y + 2}`}
              stroke="#0f172a"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />
          </g>
        </svg>
      </div>
    </div>
  );
}
