import React from 'react';

interface CharacterProps {
  size?: number | string;
  className?: string;
  sleeping?: boolean;
  happy?: boolean;
  growling?: boolean;
}

/**
 * Animated Cartoon Rosie - Black & White Dog (Border Collie / Tuxedo Mix)
 * Based directly on the user's uploaded images of Rosie.
 */
export function CartoonRosie({
  size = 48,
  className = '',
  sleeping = true,
  happy = false,
  growling = false,
}: CharacterProps) {
  const isAlert = growling || (!sleeping && !happy);

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 100 100"
        className={`w-full h-full drop-shadow-md overflow-visible ${
          isAlert ? 'animate-gentle-shake' : sleeping ? 'animate-dog-breathe' : ''
        }`}
      >
        {/* Soft Bed Pillow / Indentation */}
        <ellipse cx="50" cy="56" rx="44" ry="38" fill="#F1F5F9" opacity="0.9" />

        {/* Back Dog Ears (Black Floppy Border Collie Ears with Twitch) */}
        <g className={sleeping ? 'animate-ear-twitch' : ''} style={{ transformOrigin: '25px 25px' }}>
          <path
            d="M 24 38 C 12 36 6 22 14 14 C 22 6 32 18 32 30 Z"
            fill="#0F172A"
            stroke="#1E293B"
            strokeWidth="1.5"
          />
          {/* Inner Ear Tint */}
          <path d="M 22 32 C 16 30 14 22 18 17 C 22 12 28 20 28 28 Z" fill="#FDA4AF" opacity="0.4" />
        </g>

        <g className={sleeping ? 'animate-ear-twitch' : ''} style={{ transformOrigin: '75px 25px' }}>
          <path
            d="M 76 38 C 88 36 94 22 86 14 C 78 6 68 18 68 30 Z"
            fill="#0F172A"
            stroke="#1E293B"
            strokeWidth="1.5"
          />
          <path d="M 78 32 C 84 30 86 22 82 17 C 78 12 72 20 72 28 Z" fill="#FDA4AF" opacity="0.4" />
        </g>

        {/* Dog Head Main Shape (Jet Black Fur) */}
        <circle cx="50" cy="46" r="32" fill="#0F172A" stroke="#1E293B" strokeWidth="1" />

        {/* Rosie's Characteristic White Center Blaze & Snout (Collie Marking) */}
        <path
          d="M 46 16 C 47 28 44 34 38 44 C 34 50 36 62 50 62 C 64 62 66 50 62 44 C 56 34 53 28 54 16 Z"
          fill="#FFFFFF"
        />

        {/* White Muzzle / Cheek Puff */}
        <ellipse cx="50" cy="54" rx="18" ry="12" fill="#FFFFFF" />

        {/* Cute Black Button Nose with Breathing Pulse */}
        <path
          d="M 45 48 C 45 46 48 45 50 45 C 52 45 55 46 55 48 C 55 52 52 55 50 55 C 48 55 45 52 45 48 Z"
          fill="#020617"
        />
        {/* Nose Highlight */}
        <ellipse cx="48.5" cy="47.5" rx="1.5" ry="1" fill="#94A3B8" opacity="0.8" />

        {/* Dog Eyes */}
        {growling ? (
          /* Alert/Growling Angry Eyes */
          <>
            {/* Red alert eyebrows */}
            <path d="M 33 34 L 43 38" stroke="#EF4444" strokeWidth="3" strokeLinecap="round" />
            <path d="M 67 34 L 57 38" stroke="#EF4444" strokeWidth="3" strokeLinecap="round" />
            <circle cx="38" cy="40" r="3.5" fill="#EF4444" />
            <circle cx="62" cy="40" r="3.5" fill="#EF4444" />
            <circle cx="38" cy="40" r="1.5" fill="#020617" />
            <circle cx="62" cy="40" r="1.5" fill="#020617" />
            {/* Growl Mouth with Teeth */}
            <path d="M 42 56 Q 50 53 58 56" stroke="#020617" strokeWidth="2.5" fill="none" />
            <polygon points="44,56 46,60 48,56" fill="#FFFFFF" />
            <polygon points="52,56 54,60 56,56" fill="#FFFFFF" />
          </>
        ) : sleeping && !happy ? (
          /* Sweet Sleeping Curved Lashes */
          <>
            <path
              d="M 32 40 Q 38 45 44 40"
              stroke="#020617"
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M 56 40 Q 62 45 68 40"
              stroke="#020617"
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
            />
            {/* Peaceful Sleeping Smile */}
            <path
              d="M 45 55 Q 50 58 55 55"
              stroke="#020617"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
          </>
        ) : (
          /* Happy Awake Eyes with Tongue */
          <>
            <circle cx="38" cy="40" r="4.5" fill="#020617" />
            <circle cx="62" cy="40" r="4.5" fill="#020617" />
            <circle cx="36.5" cy="38.5" r="1.8" fill="#FFFFFF" />
            <circle cx="60.5" cy="38.5" r="1.8" fill="#FFFFFF" />
            {/* Happy Open Smile & Pink Tongue */}
            <path d="M 44 54 Q 50 61 56 54" stroke="#020617" strokeWidth="2" fill="none" />
            <path d="M 47 57 C 47 64 53 64 53 57 Z" fill="#FB7185" />
          </>
        )}

        {/* Cute Whisker Dots */}
        <circle cx="40" cy="54" r="0.8" fill="#94A3B8" />
        <circle cx="38" cy="56" r="0.8" fill="#94A3B8" />
        <circle cx="60" cy="54" r="0.8" fill="#94A3B8" />
        <circle cx="62" cy="56" r="0.8" fill="#94A3B8" />

        {/* Rosy Sleeping Cheeks */}
        {sleeping && (
          <>
            <circle cx="32" cy="47" r="4" fill="#FDA4AF" opacity="0.45" />
            <circle cx="68" cy="47" r="4" fill="#FDA4AF" opacity="0.45" />
          </>
        )}

        {/* Rosie's Collar & Golden Heart Tag */}
        <path d="M 36 70 Q 50 76 64 70" stroke="#0EA5E9" strokeWidth="5" strokeLinecap="round" />
        <circle cx="50" cy="76" r="5" fill="#F59E0B" stroke="#B45309" strokeWidth="1" />
        <text
          x="50"
          y="78.5"
          textAnchor="middle"
          fontSize="5.5"
          fontWeight="bold"
          fill="#78350F"
        >
          R
        </text>

        {/* Fluffy White Paws Tucked In */}
        <ellipse cx="32" cy="74" rx="7" ry="5" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />
        <ellipse cx="68" cy="74" rx="7" ry="5" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />
        {/* Pink Paw Pads */}
        <circle cx="32" cy="74" r="2" fill="#FDA4AF" opacity="0.7" />
        <circle cx="68" cy="74" r="2" fill="#FDA4AF" opacity="0.7" />
      </svg>
    </div>
  );
}

/**
 * Animated Cartoon Bentzi - Male Character 2
 * Based directly on Benzti_Headshot.jpg:
 * Dark hair, modern dark glasses, handsome face with neat beard & mustache, cozy striped pajamas.
 */
export function CartoonBentzi({
  size = 48,
  className = '',
  sleeping = true,
}: CharacterProps) {
  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 100 100"
        className={`w-full h-full drop-shadow-md overflow-visible ${
          sleeping ? 'animate-human-breathe' : ''
        }`}
      >
        {/* Soft Bed Pillow with piping */}
        <rect x="10" y="8" width="80" height="74" rx="20" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="2" />
        <path d="M 18 16 L 82 16" stroke="#E2E8F0" strokeWidth="1.5" strokeDasharray="3 3" />

        {/* Flannel Pajama Collar Peeking in */}
        <path d="M 28 78 L 50 68 L 72 78 L 78 94 L 22 94 Z" fill="#0284C7" />
        {/* White Pajama Stripes */}
        <line x1="36" y1="74" x2="32" y2="94" stroke="#BAE6FD" strokeWidth="2" />
        <line x1="50" y1="69" x2="50" y2="94" stroke="#BAE6FD" strokeWidth="2" />
        <line x1="64" y1="74" x2="68" y2="94" stroke="#BAE6FD" strokeWidth="2" />

        {/* Neck */}
        <rect x="42" y="58" width="16" height="14" fill="#FDBA74" />

        {/* Face */}
        <ellipse cx="50" cy="42" rx="24" ry="26" fill="#FED7AA" />

        {/* Bentzi's Dark Hair */}
        <path
          d="M 26 40 C 24 24 32 14 50 14 C 68 14 76 24 74 40 C 72 32 68 22 58 20 C 48 18 36 24 26 40 Z"
          fill="#1E293B"
        />

        {/* Neat Dark Beard & Mustache (Bentzi's signature look) */}
        <path
          d="M 32 46 C 30 62 38 68 50 68 C 62 68 70 62 68 46 C 65 52 58 56 50 56 C 42 56 35 52 32 46 Z"
          fill="#0F172A"
        />
        {/* Mustache */}
        <path
          d="M 40 50 Q 50 54 60 50 Q 50 47 40 50 Z"
          fill="#0F172A"
        />

        {/* Bentzi's Stylish Modern Glasses Frames */}
        <g stroke="#0F172A" strokeWidth="2.5" fill="none">
          {/* Left Lens Frame */}
          <rect x="31" y="32" width="16" height="13" rx="3.5" fill="#FFFFFF" fillOpacity="0.3" />
          {/* Right Lens Frame */}
          <rect x="53" y="32" width="16" height="13" rx="3.5" fill="#FFFFFF" fillOpacity="0.3" />
          {/* Bridge */}
          <path d="M 47 37 Q 50 35 53 37" />
          {/* Frame sides */}
          <line x1="31" y1="36" x2="26" y2="34" />
          <line x1="69" y1="36" x2="74" y2="34" />
        </g>

        {/* Sleeping Peaceful Eyes Behind Glasses */}
        {sleeping ? (
          <>
            <path
              d="M 34 38 Q 39 42 44 38"
              stroke="#1E293B"
              strokeWidth="2.2"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M 56 38 Q 61 42 66 38"
              stroke="#1E293B"
              strokeWidth="2.2"
              strokeLinecap="round"
              fill="none"
            />
            {/* Peaceful Smile */}
            <path
              d="M 45 55 Q 50 58 55 55"
              stroke="#78350F"
              strokeWidth="1.8"
              strokeLinecap="round"
              fill="none"
            />
          </>
        ) : (
          <>
            <circle cx="39" cy="38.5" r="3" fill="#0F172A" />
            <circle cx="61" cy="38.5" r="3" fill="#0F172A" />
            <circle cx="38" cy="37.5" r="1" fill="#FFFFFF" />
            <circle cx="60" cy="37.5" r="1" fill="#FFFFFF" />
            <path d="M 45 54 Q 50 59 55 54" stroke="#78350F" strokeWidth="1.8" fill="none" />
          </>
        )}

        {/* Soft Sleeping Blush */}
        {sleeping && (
          <>
            <circle cx="29" cy="44" r="3.5" fill="#FCA5A5" opacity="0.5" />
            <circle cx="71" cy="44" r="3.5" fill="#FCA5A5" opacity="0.5" />
          </>
        )}
      </svg>
    </div>
  );
}

/**
 * Animated Cartoon Shai - Male Character 1
 * Based directly on Shai and Rosie.jpg:
 * Wavy dark brown hair, attractive facial features with neat light stubble, cozy green/teal bedtime pajamas.
 */
export function CartoonShai({
  size = 48,
  className = '',
  sleeping = true,
}: CharacterProps) {
  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 100 100"
        className={`w-full h-full drop-shadow-md overflow-visible ${
          sleeping ? 'animate-human-breathe' : ''
        }`}
      >
        {/* Soft Bed Pillow with ruffled corners */}
        <rect x="10" y="8" width="80" height="74" rx="20" fill="#FDF4FF" stroke="#F0ABFC" strokeWidth="1.8" />
        <path d="M 18 16 L 82 16" stroke="#F5D0FE" strokeWidth="1.5" strokeDasharray="3 3" />

        {/* Cozy Star Pajama Top */}
        <path d="M 28 78 L 50 68 L 72 78 L 78 94 L 22 94 Z" fill="#0D9488" />
        {/* Tiny Star Pajama Accents */}
        <text x="36" y="86" fontSize="7" fill="#99F6E4" opacity="0.8">✦</text>
        <text x="64" y="86" fontSize="7" fill="#99F6E4" opacity="0.8">✦</text>

        {/* Neck */}
        <rect x="42" y="58" width="16" height="14" fill="#FDBA74" />

        {/* Face */}
        <ellipse cx="50" cy="42" rx="23" ry="25" fill="#FED7AA" />

        {/* Shai's Wavy Textured Brown Hair */}
        <path
          d="M 24 38 C 22 22 30 12 50 12 C 70 12 78 22 76 38 C 74 30 70 20 62 18 C 54 16 44 20 36 18 C 28 22 26 28 24 38 Z"
          fill="#3B2516"
        />
        {/* Soft Hair Waves on Top */}
        <path d="M 32 16 Q 42 10 52 14 Q 62 10 70 16" stroke="#25160E" strokeWidth="2.5" fill="none" />

        {/* Shai's Neat Jawline & Stubble */}
        <path
          d="M 34 46 C 33 60 40 66 50 66 C 60 66 67 60 66 46 C 63 51 57 54 50 54 C 43 54 37 51 34 46 Z"
          fill="#451A03"
          opacity="0.25"
        />

        {/* Sleeping Peaceful Eyes with Curved Lashes */}
        {sleeping ? (
          <>
            <path
              d="M 34 38 Q 40 43 45 38"
              stroke="#27170E"
              strokeWidth="2.4"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M 55 38 Q 60 43 66 38"
              stroke="#27170E"
              strokeWidth="2.4"
              strokeLinecap="round"
              fill="none"
            />
            {/* Peaceful Sleeping Smile */}
            <path
              d="M 44 53 Q 50 57 56 53"
              stroke="#831843"
              strokeWidth="1.8"
              strokeLinecap="round"
              fill="none"
            />
          </>
        ) : (
          <>
            <circle cx="39.5" cy="38" r="3.2" fill="#27170E" />
            <circle cx="60.5" cy="38" r="3.2" fill="#27170E" />
            <circle cx="38" cy="37" r="1.2" fill="#FFFFFF" />
            <circle cx="59" cy="37" r="1.2" fill="#FFFFFF" />
            <path d="M 44 52 Q 50 58 56 52" stroke="#831843" strokeWidth="1.8" fill="none" />
          </>
        )}

        {/* Eyebrows */}
        <path d="M 33 32 Q 39 30 45 32" stroke="#27170E" strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M 55 32 Q 61 30 67 32" stroke="#27170E" strokeWidth="2" strokeLinecap="round" fill="none" />

        {/* Rosy Sleeping Cheeks */}
        {sleeping && (
          <>
            <circle cx="30" cy="44" r="3.5" fill="#FDA4AF" opacity="0.6" />
            <circle cx="70" cy="44" r="3.5" fill="#FDA4AF" opacity="0.6" />
          </>
        )}
      </svg>
    </div>
  );
}
