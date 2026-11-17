import React, { useState } from 'react';
import { CharacterType, AvatarProfiles } from '../types';

interface AvatarDisplayProps {
  type: CharacterType;
  profiles?: AvatarProfiles;
  size?: 'sm' | 'md' | 'lg' | 'cell';
  sleeping?: boolean;
  happy?: boolean;
  growling?: boolean;
  showZzz?: boolean;
}

/**
 * AvatarDisplay creates the player face / head directly using the uploaded pictures!
 * - Rosie (Dog): /assets/avatars/rosie.jpg
 * - Bentzi (Man 1): /assets/avatars/bentzi.jpg
 * - Shai (Man 2): /assets/avatars/shai.jpg
 */
export function AvatarDisplay({
  type,
  profiles,
  size = 'md',
  sleeping = true,
  happy = false,
  growling = false,
  showZzz = false,
}: AvatarDisplayProps) {
  const [imgError, setImgError] = useState(false);

  // Get image URL directly from profiles or fallback to public assets
  const getImageSrc = () => {
    if (type === 'dog') {
      return profiles?.dogPhoto || '/assets/avatars/rosie.jpg';
    }
    if (type === 'boyfriend') {
      return profiles?.boyfriendPhoto || '/assets/avatars/bentzi.jpg';
    }
    return profiles?.girlfriendPhoto || '/assets/avatars/shai.jpg';
  };

  const photoSrc = getImageSrc();

  const sizeClasses = {
    sm: 'w-7 h-7',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
    cell: 'w-full h-full max-w-[44px] max-h-[44px]',
  }[size];

  return (
    <div className={`relative flex items-center justify-center ${sizeClasses} select-none`}>
      {/* Floating Zzz */}
      {showZzz && sleeping && !growling && (
        <div className="absolute -top-3.5 -right-2 flex flex-col items-start pointer-events-none z-30 animate-zzz-float">
          <span className="text-[10px] font-black text-amber-400 drop-shadow-xs">Z</span>
          <span className="text-[8px] font-bold text-amber-300 -mt-1 ml-1.5 opacity-80">z</span>
          <span className="text-[6px] font-semibold text-amber-200 -mt-1 ml-3 opacity-60">z</span>
        </div>
      )}

      {/* Growl exclamation for Rosie */}
      {growling && (
        <div className="absolute -top-3.5 -right-2 pointer-events-none z-30 animate-bounce">
          <span className="text-[9px] bg-rose-600 text-white font-black px-1.5 py-0.5 rounded-full shadow-md">
            Grrr!
          </span>
        </div>
      )}

      {/* Dog Ear Decorations for Rosie */}
      {type === 'dog' && (
        <>
          <div className="absolute -top-1.5 -left-1 w-3.5 h-4.5 bg-slate-900 rounded-full rotate-[-25deg] shadow-xs z-20 pointer-events-none animate-ear-twitch" />
          <div className="absolute -top-1.5 -right-1 w-3.5 h-4.5 bg-slate-900 rounded-full rotate-[25deg] shadow-xs z-20 pointer-events-none animate-ear-twitch" />
        </>
      )}

      {/* Head Frame containing the user's actual photo */}
      <div
        className={`relative w-full h-full rounded-full overflow-hidden border-2 shadow-sm flex items-center justify-center bg-stone-100 ${
          type === 'dog'
            ? 'border-amber-400 ring-1 ring-amber-300'
            : type === 'boyfriend'
            ? 'border-sky-400 ring-1 ring-sky-300'
            : 'border-teal-400 ring-1 ring-teal-300'
        } ${sleeping && !growling ? (type === 'dog' ? 'animate-dog-breathe' : 'animate-human-breathe') : ''}`}
      >
        {!imgError ? (
          <img
            src={photoSrc}
            alt={type}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover object-center filter contrast-[1.05]"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center font-black text-xs text-stone-600">
            {type === 'dog' ? '🐾' : type === 'boyfriend' ? 'B' : 'S'}
          </div>
        )}

        {/* Sleeping Eyelids Overlay to make the character look peacefully asleep */}
        {sleeping && !growling && !happy && (
          <div className="absolute inset-0 bg-black/20 backdrop-blur-[0.3px] flex items-center justify-center pointer-events-none">
            {/* Sleeping lashes overlay */}
            <div className="flex gap-2 -mt-0.5 opacity-85">
              <span className="text-[10px] leading-none text-white drop-shadow-sm font-black">⌒</span>
              <span className="text-[10px] leading-none text-white drop-shadow-sm font-black">⌒</span>
            </div>
          </div>
        )}

        {/* Happy smile overlay */}
        {happy && (
          <div className="absolute inset-0 bg-amber-400/10 flex items-center justify-center pointer-events-none">
            <span className="text-[9px] leading-none text-amber-900 drop-shadow-xs font-black">‿</span>
          </div>
        )}
      </div>

      {/* Small Collar Tag for Rosie */}
      {type === 'dog' && (
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-amber-400 border border-white shadow-xs z-20 flex items-center justify-center">
          <span className="text-[6px] font-black text-amber-950">R</span>
        </div>
      )}
    </div>
  );
}
