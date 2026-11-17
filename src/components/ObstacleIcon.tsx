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

    case 'phone':
      return (
        <div className={`relative flex items-center justify-center ${className}`} title="Phone left in bed">
          <svg viewBox="0 0 36 36" className="w-full h-full drop-shadow-sm" style={{ transform: 'rotate(-14deg)' }}>
            <rect x="10" y="3" width="16" height="30" rx="4" fill="#1F2430" />
            <rect x="11.5" y="6" width="13" height="23" rx="1.5" fill="#5B8DEF" />
            <rect x="11.5" y="6" width="13" height="7" rx="1.5" fill="#7FA8F5" />
            <rect x="13" y="16" width="4" height="4" rx="1" fill="#F7C948" />
            <rect x="19" y="16" width="4" height="4" rx="1" fill="#6FD08C" />
            <rect x="13" y="22" width="4" height="4" rx="1" fill="#F28B82" />
            <rect x="19" y="22" width="4" height="4" rx="1" fill="#C9A7F5" />
            <rect x="15" y="4.2" width="6" height="1" rx="0.5" fill="#444B5C" />
            {/* buzz marks */}
            <path d="M6 12 L4 14 L6 16 M30 20 L32 22 L30 24" stroke="#8B93A7" strokeWidth="1.4" fill="none" strokeLinecap="round" />
          </svg>
          <span className="absolute -top-1 -right-1 text-[9px] bg-slate-200 text-slate-700 rounded-full px-1 font-bold shadow-xs">bzz</span>
        </div>
      );

    case 'squeaky_dildo':
      return (
        <div className={`relative flex items-center justify-center ${className}`} title="Squeaky novelty toy">
          <svg viewBox="0 0 36 36" className="w-full h-full drop-shadow-sm" style={{ transform: 'rotate(28deg)' }}>
            {/* suction-cup base */}
            <ellipse cx="18" cy="31" rx="9" ry="3.2" fill="#C2185B" />
            {/* rounded shaft */}
            <rect x="12.5" y="9" width="11" height="22" rx="5.5" fill="#F06292" />
            <ellipse cx="18" cy="10" rx="6.5" ry="5.5" fill="#F48FB1" />
            <path d="M14.5 15 Q18 17 21.5 15" stroke="#EC407A" strokeWidth="1.3" fill="none" strokeLinecap="round" />
            <rect x="14.5" y="18" width="2.2" height="9" rx="1.1" fill="#FFFFFF" opacity="0.45" />
          </svg>
          <span className="absolute -top-1 -right-1 text-[9px] bg-pink-200 text-pink-800 rounded-full px-1 font-bold shadow-xs">squeak</span>
        </div>
      );

    case 'tissues':
      return (
        <div className={`relative flex items-center justify-center ${className}`} title="Box of tissues">
          <svg viewBox="0 0 36 36" className="w-full h-full drop-shadow-sm">
            {/* tissue poking out */}
            <path d="M13 13 Q14 4 18 7 Q22 3 23 13 Z" fill="#FFFFFF" stroke="#D9D4CC" strokeWidth="1" />
            {/* box */}
            <path d="M5 14 L31 14 L31 30 L5 30 Z" fill="#7EC8C0" />
            <path d="M5 14 L31 14 L31 18 L5 18 Z" fill="#9ED8D1" />
            <ellipse cx="18" cy="15.5" rx="6.5" ry="1.8" fill="#4E9C94" />
            <path d="M8 22 Q12 20 16 22 T24 22 T30 22" stroke="#FFFFFF" strokeWidth="1.4" fill="none" opacity="0.8" />
            <path d="M8 26 Q12 24 16 26 T24 26 T30 26" stroke="#FFFFFF" strokeWidth="1.4" fill="none" opacity="0.6" />
          </svg>
          <span className="absolute -top-1 -right-1 text-[9px] bg-teal-100 text-teal-800 rounded-full px-1 font-bold shadow-xs">crinkle</span>
        </div>
      );

    default:
      return null;
  }
}
