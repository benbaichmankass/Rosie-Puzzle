import React from 'react';
import { PlayerPiece, AvatarProfiles, PieceCell } from '../types';
import { RotateCw, FlipHorizontal, ArrowDownToLine, Undo2, Shuffle } from 'lucide-react';
import { sound } from '../utils/audio';
import { FullAnimatedBentzi, FullAnimatedShai } from './FullCharacterAnimation';

interface PieceDrawerProps {
  boyfriend: PlayerPiece;
  girlfriend: PlayerPiece;
  selectedPieceId: 'boyfriend' | 'girlfriend' | null;
  profiles: AvatarProfiles;
  onSelectPiece: (id: 'boyfriend' | 'girlfriend') => void;
  onRotatePiece: (id: 'boyfriend' | 'girlfriend') => void;
  onFlipPiece: (id: 'boyfriend' | 'girlfriend') => void;
  onRecallPiece: (id: 'boyfriend' | 'girlfriend') => void;
  onChangePose: (id: 'boyfriend' | 'girlfriend') => void;
  bfPoseName?: string;
  gfPoseName?: string;
  onAdjustLimb?: (id: 'boyfriend' | 'girlfriend', limbPart: 'leg' | 'arm' | 'feet') => void;
  onStartDragPiece?: (id: 'boyfriend' | 'girlfriend', e: React.PointerEvent) => void;
}

export function PieceDrawer({
  boyfriend,
  girlfriend,
  selectedPieceId,
  profiles,
  onSelectPiece,
  onRotatePiece,
  onFlipPiece,
  onRecallPiece,
  onChangePose,
  bfPoseName = 'L-Shape',
  gfPoseName = 'L-Shape',
  onAdjustLimb,
  onStartDragPiece,
}: PieceDrawerProps) {
  const renderShapePreview = (piece: PlayerPiece) => {
    const isBoyfriend = piece.id === 'boyfriend';
    const maxR = Math.max(...piece.cells.map((c) => c.r));
    const maxC = Math.max(...piece.cells.map((c) => c.c));
    const w = maxC + 1;
    const h = maxR + 1;

    return (
      <div
        className="relative bg-amber-50/70 rounded-xl p-1.5 border border-amber-200/80 shadow-inner flex items-center justify-center touch-none overflow-hidden"
        style={{
          width: `${Math.max(92, w * 38)}px`,
          height: `${Math.max(92, h * 38)}px`,
        }}
      >
        {isBoyfriend ? (
          <FullAnimatedBentzi
            piece={piece}
            profiles={profiles}
          />
        ) : (
          <FullAnimatedShai
            piece={piece}
            profiles={profiles}
          />
        )}
      </div>
    );
  };

  const pieces = [
    { piece: boyfriend, label: profiles.boyfriendName, type: 'boyfriend' as const },
    { piece: girlfriend, label: profiles.girlfriendName, type: 'girlfriend' as const },
  ];

  return (
    <div className="w-full max-w-[360px] mx-auto mt-2 select-none touch-none">
      <div className="text-center mb-1 flex items-center justify-center gap-1.5">
        <span className="text-[10.5px] font-bold text-amber-950 bg-amber-200/90 px-3 py-0.5 rounded-full shadow-xs">
          {selectedPieceId
            ? `Drag onto bed or tap empty squares to place ${
                selectedPieceId === 'boyfriend'
                  ? profiles.boyfriendName
                  : profiles.girlfriendName
              }!`
            : 'Touch & drag onto bed or tap to adjust limbs:'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {pieces.map(({ piece, label, type }) => {
          const isSelected = selectedPieceId === type;
          const isPlaced = piece.placedPos !== null;

          return (
            <div
              key={type}
              onClick={() => onSelectPiece(type)}
              className={`relative rounded-2xl p-2.5 transition-all border-2 flex flex-col justify-between touch-none ${
                isSelected
                  ? type === 'boyfriend'
                    ? 'bg-sky-50 border-sky-500 shadow-md ring-2 ring-sky-300'
                    : 'bg-teal-50 border-teal-500 shadow-md ring-2 ring-teal-300'
                  : isPlaced
                  ? 'bg-stone-100/90 border-stone-300 opacity-90'
                  : 'bg-white/95 border-amber-200 hover:border-amber-300 shadow-xs'
              }`}
            >
              {/* Header with user's actual photo */}
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5 truncate">
                  <div
                    className={`w-8 h-8 rounded-full overflow-hidden border-2 shadow-xs shrink-0 ${
                      type === 'boyfriend' ? 'border-sky-400' : 'border-teal-400'
                    }`}
                  >
                    <img
                      src={
                        type === 'boyfriend'
                          ? profiles.boyfriendPhoto || '/assets/avatars/bentzi.jpg'
                          : profiles.girlfriendPhoto || '/assets/avatars/shai.jpg'
                      }
                      alt={label}
                      className="w-full h-full object-cover object-center"
                    />
                  </div>
                  <div className="flex flex-col truncate">
                    <span
                      className={`text-xs font-bold truncate ${
                        type === 'boyfriend' ? 'text-sky-900' : 'text-teal-900'
                      }`}
                    >
                      {label}
                    </span>
                    <span className="text-[9px] text-stone-500 font-semibold">
                      {piece.cells.length} squares
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {isPlaced && (
                    <span className="text-[9.5px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full border border-emerald-300">
                      In Bed 💤
                    </span>
                  )}
                </div>
              </div>

              {/* Shape preview box - Touch & Drag directly onto the bed! */}
              <div
                onPointerDown={(e) => {
                  if (onStartDragPiece) {
                    onStartDragPiece(type, e);
                  }
                }}
                className="my-auto py-1.5 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing active:scale-98 touch-none"
                title="Touch & drag onto the bed grid!"
              >
                {renderShapePreview(piece)}
                <span className="text-[8px] font-bold text-stone-400 mt-1 uppercase tracking-wider">
                  Drag onto bed 👆
                </span>
              </div>

              {/* Tetris Poses & Placement Controls */}
              <div className="mt-1.5 pt-1.5 border-t border-stone-200/80 flex flex-col gap-1.5">
                {/* Pose Switcher Button (Tetris-style static poses) */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onChangePose(type);
                  }}
                  className="w-full py-1.5 px-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 text-[10.5px] font-black flex items-center justify-between border border-amber-300 shadow-2xs active:scale-95 transition-all"
                  title="Cycle to next static sleeping pose (Tetris style)"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <Shuffle className="w-3 h-3 text-amber-700 shrink-0" />
                    <span className="truncate">
                      Pose: <span className="text-amber-800">{type === 'boyfriend' ? bfPoseName : gfPoseName}</span>
                    </span>
                  </div>
                  <span className="text-[9px] font-bold text-amber-600 bg-amber-200/80 px-1.5 py-0.5 rounded-full shrink-0">
                    Cycle ⚡
                  </span>
                </button>

                {/* Placement / Recall / Rotate Controls */}
                <div className="flex items-center justify-between gap-1">
                  {isPlaced ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRecallPiece(type);
                      }}
                      className="w-full py-1.5 px-2 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-700 text-xs font-bold flex items-center justify-center gap-1 shadow-2xs active:scale-95 transition-all"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                      <span>Recall to Tray</span>
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRotatePiece(type);
                          sound.playRotate();
                        }}
                        className="p-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 flex items-center justify-center shadow-2xs active:scale-95 transition-all"
                        title="Rotate 90°"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onFlipPiece(type);
                          sound.playRotate();
                        }}
                        className="p-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 flex items-center justify-center shadow-2xs active:scale-95 transition-all"
                        title="Flip Horizontally"
                      >
                        <FlipHorizontal className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectPiece(type);
                        }}
                        className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-95 flex items-center justify-center gap-1 ${
                          isSelected
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'bg-amber-500 hover:bg-amber-600 text-white'
                        }`}
                      >
                        <ArrowDownToLine className="w-3.5 h-3.5" />
                        <span>{isSelected ? 'Ready' : 'Select'}</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
