import { motion, AnimatePresence } from 'motion/react';
import { AvatarProfiles } from '../types';
import { AvatarDisplay } from './AvatarDisplay';

interface DogWarningModalProps {
  isOpen: boolean;
  type: 'grumble' | 'growl' | 'bite' | 'pee';
  profiles: AvatarProfiles;
  onClose: () => void;
  onApologize?: () => void;
  onCleanPee?: () => void;
}

export function DogWarningModal({
  isOpen,
  type,
  profiles,
  onClose,
  onApologize,
  onCleanPee,
}: DogWarningModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className={`relative w-full max-w-sm rounded-3xl p-6 text-center shadow-2xl border-4 ${
            type === 'pee'
              ? 'bg-amber-50 border-amber-500 text-amber-950'
              : type === 'bite'
              ? 'bg-rose-50 border-rose-400 text-rose-950'
              : type === 'growl'
              ? 'bg-amber-50 border-amber-400 text-amber-950'
              : 'bg-sky-50 border-sky-300 text-slate-900'
          }`}
        >
          {/* Top badge */}
          <div className="flex justify-center mb-3">
            <div
              className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                type === 'pee'
                  ? 'bg-amber-500 text-amber-950 border border-amber-400 animate-bounce'
                  : type === 'bite'
                  ? 'bg-rose-500 text-white animate-pulse'
                  : type === 'growl'
                  ? 'bg-amber-500 text-white'
                  : 'bg-sky-500 text-white'
              }`}
            >
              {type === 'pee'
                ? '💦 OH NO! PEE ACCIDENT! -200 PTS'
                : type === 'bite'
                ? '💥 CHOMP! Playful Bite!'
                : type === 'growl'
                ? '⚠️ Growl Warning!'
                : '💤 Mild Grumble'}
            </div>
          </div>

          {/* Character illustration with animation */}
          <div className="relative mx-auto w-24 h-24 mb-4 flex items-center justify-center">
            {type === 'pee' ? (
              <motion.div
                animate={{
                  scale: [1, 1.1, 0.95, 1],
                  rotate: [-3, 3, -3, 0],
                }}
                transition={{ duration: 0.6 }}
                className="relative"
              >
                <AvatarDisplay
                  type="dog"
                  profiles={profiles}
                  size="lg"
                  growling={false}
                  sleeping={false}
                />
                <div className="absolute -bottom-2 -right-4 bg-amber-400 text-amber-950 text-xs font-black px-2 py-0.5 rounded-full shadow-lg border border-amber-600 animate-pulse">
                  💦 Oops!
                </div>
              </motion.div>
            ) : type === 'bite' ? (
              <motion.div
                animate={{
                  rotate: [-6, 6, -6, 6, 0],
                  scale: [1, 1.15, 0.95, 1.1, 1],
                }}
                transition={{ duration: 0.5 }}
                className="relative"
              >
                <AvatarDisplay
                  type="dog"
                  profiles={profiles}
                  size="lg"
                  growling={true}
                  sleeping={false}
                />
                <div className="absolute -bottom-2 -right-4 bg-rose-600 text-white text-xs font-black px-2 py-0.5 rounded-full shadow-lg rotate-12">
                  *NIP!*
                </div>
              </motion.div>
            ) : (
              <AvatarDisplay
                type="dog"
                profiles={profiles}
                size="lg"
                growling={type === 'growl'}
                sleeping={type === 'grumble'}
              />
            )}
          </div>

          {/* Heading */}
          <h3 className="text-2xl font-bold mb-2">
            {type === 'pee'
              ? `💦 ${profiles.dogName} peed on the bed!`
              : type === 'bite'
              ? `YOWCH! ${profiles.dogName} bit you!`
              : type === 'growl'
              ? `${profiles.dogName} is growling!`
              : `${profiles.dogName} shifted and sighed...`}
          </h3>

          {/* Description */}
          <p className="text-sm font-medium leading-relaxed mb-5 opacity-90">
            {type === 'pee'
              ? `You upset ${profiles.dogName} too much and she had an accident on the sheets! You got a -200 pts laundry penalty. Neither ${profiles.boyfriendName} nor ${profiles.girlfriendName} will sleep on the wet spot!`
              : type === 'bite'
              ? `You pushed her too far! ${profiles.dogName} playfully chomped ${profiles.boyfriendName} & ${profiles.girlfriendName}'s toes to defend her bed spot. Give her space or lure her with treats!`
              : type === 'growl'
              ? `She is warning ${profiles.boyfriendName} & ${profiles.girlfriendName}: "Grrrrr... one more nudge and I might nip!" Try nudging another way or use a treat.`
              : `She grumbled: "Hey, I'm trying to sleep here!" Her patience is wearing thin.`}
          </p>

          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            {type === 'pee' ? (
              <>
                {onCleanPee && (
                  <button
                    onClick={() => {
                      onCleanPee();
                      onClose();
                    }}
                    className="w-full py-2.5 px-4 rounded-2xl bg-amber-600 hover:bg-amber-700 active:scale-98 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    <span>🧻 Clean Up Spot with Towel (-50 pts)</span>
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="w-full py-2.5 px-4 rounded-2xl bg-amber-200 hover:bg-amber-300 text-amber-950 font-bold text-sm shadow-xs active:scale-98 transition-all"
                >
                  <span>Work around it (OK)</span>
                </button>
              </>
            ) : type === 'bite' && onApologize ? (
              <button
                onClick={() => {
                  onApologize();
                  onClose();
                }}
                className="w-full py-3 px-4 rounded-2xl bg-rose-500 hover:bg-rose-600 active:scale-98 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
              >
                <span>🐾 Apologize & Rub Belly</span>
              </button>
            ) : (
              <button
                onClick={onClose}
                className={`w-full py-3 px-4 rounded-2xl font-bold text-sm text-white shadow-md active:scale-98 transition-all ${
                  type === 'growl'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-sky-600 hover:bg-sky-700'
                }`}
              >
                <span>I'll be gentle! (OK)</span>
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
