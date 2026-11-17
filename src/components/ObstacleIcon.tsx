import { ObstacleType } from '../types';

interface ObstacleIconProps {
  type: ObstacleType;
  className?: string;
}

export function ObstacleIcon({ type, className = 'w-7 h-7' }: ObstacleIconProps) {
  switch (type) {
    case 'toy_duck':
      return (
        <div className={`relative flex items-center justify-center ${className}`} title="Squeaky Duck Toy">
          <svg viewBox="0 0 36 36" className="w-full h-full drop-shadow-sm filter">
            {/* Duck Body */}
            <path
              d="M10 20 C10 14 16 10 24 10 C29 10 32 14 32 18 C32 24 26 28 18 28 C12 28 10 25 10 20 Z"
              fill="#FACC15"
            />
            {/* Duck Tail */}
            <path d="M10 20 C8 17 5 19 6 22 C8 24 10 23 10 20 Z" fill="#EAB308" />
            {/* Duck Head */}
            <circle cx="25" cy="13" r="6.5" fill="#FDE047" />
            {/* Beak */}
            <path d="M30 14 Q35 15 31 18 Z" fill="#FB923C" />
            {/* Eye */}
            <circle cx="26" cy="12" r="1.2" fill="#1E293B" />
            <circle cx="26.3" cy="11.7" r="0.4" fill="#FFFFFF" />
            {/* Wing */}
            <path d="M17 20 C18 16 23 17 21 22 C19 24 16 23 17 20 Z" fill="#EAB308" />
          </svg>
          <span className="absolute -top-1 -right-1 text-[9px] bg-yellow-200 text-yellow-800 rounded-full px-1 font-bold shadow-xs">
            squeak
          </span>
        </div>
      );

    case 'toy_ball':
      return (
        <div className={`relative flex items-center justify-center ${className}`} title="Tennis Ball Toy">
          <svg viewBox="0 0 36 36" className="w-full h-full drop-shadow-sm">
            <circle cx="18" cy="18" r="14" fill="#84CC16" />
            {/* Seams */}
            <path
              d="M8 10 C14 14 14 22 8 26"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M28 10 C22 14 22 22 28 26"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
      );

    case 'toy_bone':
      return (
        <div className={`relative flex items-center justify-center ${className}`} title="Chew Bone Toy">
          <svg viewBox="0 0 36 36" className="w-full h-full drop-shadow-sm">
            <g transform="rotate(-20 18 18)">
              <rect x="10" y="15" width="16" height="6" rx="2" fill="#E2E8F0" />
              <circle cx="10" cy="14" r="3.5" fill="#E2E8F0" />
              <circle cx="10" cy="22" r="3.5" fill="#E2E8F0" />
              <circle cx="26" cy="14" r="3.5" fill="#E2E8F0" />
              <circle cx="26" cy="22" r="3.5" fill="#E2E8F0" />
              <path d="M14 18 Q18 16 22 18" stroke="#CBD5E1" strokeWidth="1" fill="none" />
            </g>
          </svg>
        </div>
      );

    case 'treat_bone':
      return (
        <div className={`relative flex items-center justify-center animate-bounce ${className}`} title="Tasty Dog Biscuit (Tap to lure!)">
          <svg viewBox="0 0 36 36" className="w-full h-full drop-shadow-md">
            <g transform="rotate(15 18 18)">
              <rect x="9" y="14.5" width="18" height="7" rx="3" fill="#D97706" />
              <circle cx="9" cy="13.5" r="4.2" fill="#F59E0B" />
              <circle cx="9" cy="22.5" r="4.2" fill="#F59E0B" />
              <circle cx="27" cy="13.5" r="4.2" fill="#F59E0B" />
              <circle cx="27" cy="22.5" r="4.2" fill="#F59E0B" />
              <circle cx="15" cy="18" r="1" fill="#B45309" />
              <circle cx="18" cy="18" r="1" fill="#B45309" />
              <circle cx="21" cy="18" r="1" fill="#B45309" />
            </g>
          </svg>
          <span className="absolute -bottom-1 text-[8px] bg-amber-600 text-amber-50 px-1 rounded-full font-bold shadow-xs">
            TREAT!
          </span>
        </div>
      );

    case 'treat_bacon':
      return (
        <div className={`relative flex items-center justify-center animate-bounce ${className}`} title="Bacon Chew Treat (Tap to lure!)">
          <svg viewBox="0 0 36 36" className="w-full h-full drop-shadow-md">
            <path
              d="M7 14 Q14 20 20 13 T31 19 L29 24 Q22 17 16 24 T5 18 Z"
              fill="#DC2626"
            />
            <path
              d="M7 16 Q14 22 20 15 T30 21"
              fill="none"
              stroke="#FEF08A"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute -bottom-1 text-[8px] bg-red-600 text-white px-1 rounded-full font-bold shadow-xs">
            BACON!
          </span>
        </div>
      );

    case 'pee_puddle':
      return (
        <div className={`relative flex items-center justify-center ${className}`} title="Pee Puddle on the bed!">
          <svg viewBox="0 0 40 40" className="w-full h-full drop-shadow-md overflow-visible animate-pulse">
            {/* Yellow Pee Stain Puddle */}
            <path
              d="M 10 20 C 8 12 18 8 26 12 C 34 16 36 24 30 30 C 24 36 12 34 8 28 C 6 24 10 24 10 20 Z"
              fill="#FACC15"
              fillOpacity="0.85"
              stroke="#EAB308"
              strokeWidth="1.5"
            />
            {/* Ripple rings */}
            <ellipse cx="20" cy="22" rx="10" ry="6" fill="#FEF08A" fillOpacity="0.9" />
            <ellipse cx="20" cy="22" rx="5" ry="3" fill="#FFFFFF" fillOpacity="0.8" />
            {/* Droplets */}
            <circle cx="32" cy="14" r="2" fill="#FACC15" />
            <circle cx="9" cy="14" r="1.5" fill="#FACC15" />
          </svg>
          <span className="absolute -bottom-1 text-[8px] bg-amber-500 text-amber-950 font-black px-1 rounded-full shadow-xs border border-amber-300">
            PEE! 💦
          </span>
        </div>
      );

    default:
      return null;
  }
}
