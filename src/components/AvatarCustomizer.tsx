import React, { useRef } from 'react';
import { AvatarProfiles } from '../types';
import { AvatarDisplay } from './AvatarDisplay';
import { Camera, Trash2, X, Sparkles, Check } from 'lucide-react';
import { sound } from '../utils/audio';

interface AvatarCustomizerProps {
  isOpen: boolean;
  profiles: AvatarProfiles;
  onUpdateProfiles: (updated: AvatarProfiles) => void;
  onClose: () => void;
}

const BENTZI_PRESETS = [
  '/assets/avatars/bentzi.jpg',
  '/assets/aistudio/bentzi1_dd19b061.jpeg',
  '/assets/aistudio/bentzi2_74e05a54.jpeg',
  '/assets/aistudio/bentzi3_e15690db.jpeg',
  '/assets/aistudio/bentzi4_fbcf5e57.jpeg',
];

const SHAI_PRESETS = [
  '/assets/avatars/shai.jpg',
  '/assets/aistudio/5_34cfa7c7.jpeg',
  '/assets/aistudio/Shai1_739f9343.jpeg',
  '/assets/aistudio/Shai2_ba5ddb92.jpeg',
  '/assets/aistudio/Shai3_16ce9520.jpeg',
  '/assets/aistudio/Shai4_9aff787a.jpeg',
];

const ROSIE_PRESETS = [
  '/assets/avatars/rosie.jpg',
  '/assets/aistudio/Rosie1_686fbf46.jpeg',
  '/assets/aistudio/Rosie2_739f9343.jpeg',
  '/assets/aistudio/Rosie3_5475fca3.jpeg',
  '/assets/aistudio/Rosie4_0167efc7.jpeg',
  '/assets/aistudio/Rosie5_dde648c3.jpeg',
  '/assets/aistudio/Rosie6_739f9343.jpeg',
  '/assets/aistudio/Rosie7_28a8417a.jpeg',
  '/assets/aistudio/Rosie8_28a8417a.jpeg',
];

export function AvatarCustomizer({
  isOpen,
  profiles,
  onUpdateProfiles,
  onClose,
}: AvatarCustomizerProps) {
  const boyfriendInputRef = useRef<HTMLInputElement>(null);
  const girlfriendInputRef = useRef<HTMLInputElement>(null);
  const dogInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'boyfriendPhoto' | 'girlfriendPhoto' | 'dogPhoto'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        onUpdateProfiles({
          ...profiles,
          [field]: result,
        });
        sound.playPop();
      }
    };
    reader.readAsDataURL(file);
  };

  const clearPhoto = (field: 'boyfriendPhoto' | 'girlfriendPhoto' | 'dogPhoto') => {
    onUpdateProfiles({
      ...profiles,
      [field]: null,
    });
    sound.playPop();
  };

  const selectPreset = (
    field: 'boyfriendPhoto' | 'girlfriendPhoto' | 'dogPhoto',
    url: string
  ) => {
    onUpdateProfiles({
      ...profiles,
      [field]: url,
    });
    sound.playPop();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
      <div className="relative w-full max-w-sm rounded-3xl bg-amber-50 p-5 shadow-2xl border-4 border-amber-300 max-h-[90vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-amber-200 hover:bg-amber-300 text-amber-900 transition-all active:scale-95 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="text-center mb-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-200 text-amber-900 font-bold text-xs mb-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>2 Men & 1 Dog on the Bed</span>
          </div>
          <h3 className="text-xl font-black text-amber-950">Player Characters</h3>
          <p className="text-xs text-amber-800/80">
            Select photos for Bentzi, Shai, and Rosie to appear directly in bed!
          </p>
        </div>

        {/* Preview of all 3 */}
        <div className="p-3 bg-white/80 rounded-2xl border border-amber-200 shadow-xs mb-4 flex items-center justify-around">
          <div className="flex flex-col items-center">
            <AvatarDisplay
              type="boyfriend"
              profiles={profiles}
              size="md"
              sleeping={false}
              happy={true}
            />
            <span className="text-[11px] font-bold text-sky-900 mt-1">
              {profiles.boyfriendName} (Man 1)
            </span>
          </div>

          <div className="flex flex-col items-center">
            <AvatarDisplay
              type="dog"
              profiles={profiles}
              size="md"
              sleeping={false}
              happy={true}
            />
            <span className="text-[11px] font-bold text-amber-900 mt-1">
              {profiles.dogName} (Dog)
            </span>
          </div>

          <div className="flex flex-col items-center">
            <AvatarDisplay
              type="girlfriend"
              profiles={profiles}
              size="md"
              sleeping={false}
              happy={true}
            />
            <span className="text-[11px] font-bold text-teal-900 mt-1">
              {profiles.girlfriendName} (Man 2)
            </span>
          </div>
        </div>

        {/* Character Edit Sections */}
        <div className="flex flex-col gap-3">
          {/* 1. Bentzi (Man 1) */}
          <div className="p-3 bg-sky-50/80 rounded-2xl border border-sky-200 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <AvatarDisplay
                  type="boyfriend"
                  profiles={profiles}
                  size="sm"
                  sleeping={false}
                />
                <div>
                  <span className="text-[10px] font-bold text-sky-600 uppercase tracking-wide">
                    Bentzi (Man 1)
                  </span>
                  <input
                    type="text"
                    value={profiles.boyfriendName}
                    onChange={(e) =>
                      onUpdateProfiles({ ...profiles, boyfriendName: e.target.value })
                    }
                    className="block w-28 text-xs font-bold text-sky-950 bg-white px-2 py-1 rounded-lg border border-sky-300 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    placeholder="Bentzi"
                  />
                </div>
              </div>

              <div className="flex items-center gap-1">
                <input
                  ref={boyfriendInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, 'boyfriendPhoto')}
                />
                <button
                  onClick={() => boyfriendInputRef.current?.click()}
                  className="p-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white shadow-2xs text-[11px] font-bold flex items-center gap-1 active:scale-95 cursor-pointer"
                  title="Upload New Photo"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Upload</span>
                </button>
              </div>
            </div>

            {/* Bentzi Photo Preset Thumbnails */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-1">
              {BENTZI_PRESETS.map((src, i) => {
                const isSelected = profiles.boyfriendPhoto === src;
                return (
                  <button
                    key={i}
                    onClick={() => selectPreset('boyfriendPhoto', src)}
                    className={`relative w-9 h-9 rounded-full overflow-hidden shrink-0 border-2 transition-transform cursor-pointer ${
                      isSelected
                        ? 'border-sky-600 ring-2 ring-sky-400 scale-105'
                        : 'border-white opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={src}
                      alt={`Bentzi ${i + 1}`}
                      className="w-full h-full object-cover object-center"
                    />
                    {isSelected && (
                      <div className="absolute inset-0 bg-sky-900/30 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Shai (Man 2) */}
          <div className="p-3 bg-teal-50/80 rounded-2xl border border-teal-200 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <AvatarDisplay
                  type="girlfriend"
                  profiles={profiles}
                  size="sm"
                  sleeping={false}
                />
                <div>
                  <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wide">
                    Shai (Man 2)
                  </span>
                  <input
                    type="text"
                    value={profiles.girlfriendName}
                    onChange={(e) =>
                      onUpdateProfiles({ ...profiles, girlfriendName: e.target.value })
                    }
                    className="block w-28 text-xs font-bold text-teal-950 bg-white px-2 py-1 rounded-lg border border-teal-300 focus:outline-none focus:ring-1 focus:ring-teal-500"
                    placeholder="Shai"
                  />
                </div>
              </div>

              <div className="flex items-center gap-1">
                <input
                  ref={girlfriendInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, 'girlfriendPhoto')}
                />
                <button
                  onClick={() => girlfriendInputRef.current?.click()}
                  className="p-1.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white shadow-2xs text-[11px] font-bold flex items-center gap-1 active:scale-95 cursor-pointer"
                  title="Upload New Photo"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Upload</span>
                </button>
              </div>
            </div>

            {/* Shai Photo Preset Thumbnails */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-1">
              {SHAI_PRESETS.map((src, i) => {
                const isSelected = profiles.girlfriendPhoto === src;
                return (
                  <button
                    key={i}
                    onClick={() => selectPreset('girlfriendPhoto', src)}
                    className={`relative w-9 h-9 rounded-full overflow-hidden shrink-0 border-2 transition-transform cursor-pointer ${
                      isSelected
                        ? 'border-teal-600 ring-2 ring-teal-400 scale-105'
                        : 'border-white opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={src}
                      alt={`Shai ${i + 1}`}
                      className="w-full h-full object-cover object-center"
                    />
                    {isSelected && (
                      <div className="absolute inset-0 bg-teal-900/30 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Rosie (The Dog) */}
          <div className="p-3 bg-amber-50/80 rounded-2xl border border-amber-200 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <AvatarDisplay
                  type="dog"
                  profiles={profiles}
                  size="sm"
                  sleeping={false}
                />
                <div>
                  <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">
                    Rosie (Our Dog)
                  </span>
                  <input
                    type="text"
                    value={profiles.dogName}
                    onChange={(e) =>
                      onUpdateProfiles({ ...profiles, dogName: e.target.value })
                    }
                    className="block w-28 text-xs font-bold text-amber-950 bg-white px-2 py-1 rounded-lg border border-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    placeholder="Rosie"
                  />
                </div>
              </div>

              <div className="flex items-center gap-1">
                <input
                  ref={dogInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, 'dogPhoto')}
                />
                <button
                  onClick={() => dogInputRef.current?.click()}
                  className="p-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-2xs text-[11px] font-bold flex items-center gap-1 active:scale-95 cursor-pointer"
                  title="Upload Dog Photo"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Upload</span>
                </button>
              </div>
            </div>

            {/* Rosie Photo Preset Thumbnails */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-1">
              {ROSIE_PRESETS.map((src, i) => {
                const isSelected = profiles.dogPhoto === src;
                return (
                  <button
                    key={i}
                    onClick={() => selectPreset('dogPhoto', src)}
                    className={`relative w-9 h-9 rounded-full overflow-hidden shrink-0 border-2 transition-transform cursor-pointer ${
                      isSelected
                        ? 'border-amber-600 ring-2 ring-amber-400 scale-105'
                        : 'border-white opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={src}
                      alt={`Rosie ${i + 1}`}
                      className="w-full h-full object-cover object-center"
                    />
                    {isSelected && (
                      <div className="absolute inset-0 bg-amber-900/30 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Done Button */}
        <button
          onClick={onClose}
          className="w-full mt-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 text-amber-950 font-black text-sm shadow-md border-2 border-amber-400 active:scale-98 transition-all cursor-pointer"
        >
          Save & Return to Bed 🛌
        </button>
      </div>
    </div>
  );
}
