import { motion } from 'motion/react';
import { AvatarProfiles } from '../types';

interface DogWarningModalProps {
  isOpen: boolean;
  type: 'grumble' | 'growl' | 'bite' | 'pee';
  profiles: AvatarProfiles;
  onClose: () => void;
  onApologize?: () => void;
  onCleanPee?: () => void;
}

export function DogWarningModal({ isOpen, type, profiles, onClose, onApologize }: DogWarningModalProps) {
  if (!isOpen) return null;
  const dog = profiles.dogName;
  const lost = type === 'bite';
  const accent = lost ? 'var(--neon-red)' : type === 'growl' ? 'var(--neon-orange)' : 'var(--neon-cyan)';

  const badge = lost ? 'NIGHT LOST' : type === 'growl' ? 'WARNING!' : type === 'pee' ? 'OH NO!' : 'GRUMBLE';
  const heading = lost
    ? `${dog} woke up barking!`
    : type === 'growl'
    ? `${dog} is growling!`
    : type === 'pee'
    ? `${dog} had an accident!`
    : `${dog} shifted and sighed...`;
  const text = lost
    ? `That was one shove too many. ${dog} is wide awake, and ${profiles.boyfriendName} & ${profiles.girlfriendName} got kicked out of bed.`
    : type === 'growl'
    ? `Half asleep, she warns ${profiles.boyfriendName} & ${profiles.girlfriendName}: "Grrrr... one more shove and I'm getting up." One more mistake and the night is lost.`
    : type === 'pee'
    ? `Work around the wet spot.`
    : `"Hey, I'm trying to sleep here!" Her patience is wearing thin.`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#05030f]/80">
      <motion.div
        initial={{ scale: 1.6, opacity: 0 }}
        animate={lost ? { scale: 1, opacity: 1, x: [0, -10, 10, -6, 6, 0] } : { scale: 1, opacity: 1 }}
        transition={lost ? { duration: 0.45 } : { type: 'spring', damping: 18, stiffness: 380 }}
        className="relative w-full max-w-sm pixel-panel p-5 text-center"
        style={{ borderColor: accent, boxShadow: `0 0 0 3px #05030f, 0 0 26px ${accent}, 0 8px 0 3px #05030f` }}
      >
        <div className={`font-arcade ${lost ? 'text-[22px] neon-red' : 'text-[16px] neon-yellow blink'} leading-tight`} style={!lost && type !== 'growl' ? { color: accent } : undefined}>
          {badge}
        </div>

        <div className="relative mx-auto mt-4 mb-3 w-20 h-20">
          <motion.img
            src={profiles.dogPhoto || 'assets/avatars/rosie.jpg'}
            alt={dog}
            className="w-20 h-20 object-cover rounded-sm border-[3px]"
            style={{ borderColor: accent }}
            animate={lost ? { rotate: [-6, 6, -6, 6, 0], scale: [1, 1.12, 1, 1.08, 1] } : { rotate: [0, -3, 3, 0] }}
            transition={{ duration: lost ? 0.6 : 1.2, repeat: lost ? 2 : Infinity }}
          />
          <span
            className="absolute -bottom-2 -right-6 font-arcade text-[9px] px-1.5 py-1 border-2 border-[#05030f] rotate-12"
            style={{ background: accent, color: lost ? '#fff' : '#05030f' }}
          >
            {lost ? 'WOOF!' : type === 'growl' ? 'GRRR' : 'hmph'}
          </span>
        </div>

        <h3 className="font-arcade text-[11px] leading-snug text-[#f4f1ff] mt-3">{heading}</h3>
        <p className="font-pixel text-[14px] leading-snug text-[#cfc8ff] mt-2 mb-4">{text}</p>

        {lost && onApologize ? (
          <>
            <div className="font-arcade text-[10px] neon-yellow mb-2">CONTINUE?</div>
            <button
              onClick={() => {
                onApologize();
                onClose();
              }}
              className="arcade-btn btn-yellow w-full py-3 font-arcade text-[11px]"
            >
              ▶ TRY AGAIN
            </button>
          </>
        ) : (
          <button onClick={onClose} className={`arcade-btn ${type === 'growl' ? 'btn-pink' : 'btn-cyan'} w-full py-3 font-arcade text-[10px]`}>
            I'LL BE GENTLE
          </button>
        )}
      </motion.div>
    </div>
  );
}
