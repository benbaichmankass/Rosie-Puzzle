import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  CellCoord,
  Obstacle,
  PlayerPiece,
  DogState,
  AvatarProfiles,
  BodyPartType,
  PieceCell,
} from '../types';
import { coordKey, canPlace, areAdjacent } from '../utils/gridUtils';
import { ObstacleIcon } from './ObstacleIcon';
import { ZenTimer } from './ZenTimer';
import { FullAnimatedRosie, FullAnimatedBentzi, FullAnimatedShai } from './FullCharacterAnimation';
import { Move, Heart, RefreshCw, Undo2 } from 'lucide-react';
import { sound } from '../utils/audio';

export interface FloatingBadge {
  id: number;
  text: string;
  type: 'rosie' | 'toy' | 'bonus' | 'pee';
  x: number;
  y: number;
}

interface BedGridProps {
  rows: number;
  cols: number;
  dog: DogState;
  obstacles: Obstacle[];
  boyfriend: PlayerPiece;
  girlfriend: PlayerPiece;
  selectedPieceId: 'boyfriend' | 'girlfriend' | null;
  profiles: AvatarProfiles;
  allowDogNudge: boolean;
  peePuddles?: CellCoord[];
  onPlacePiece: (pieceId: 'boyfriend' | 'girlfriend', origin: CellCoord) => void;
  onRecallPiece: (pieceId: 'boyfriend' | 'girlfriend') => void;
  onNudgeDog: (dr: number, dc: number) => void;
  onConsumeTreat: (treat: Obstacle) => void;
  onPenalize: (points: number, reason: string, x?: number, y?: number) => void;
  onRerollToys?: () => void;
  onAdjustLimb?: (pieceId: 'boyfriend' | 'girlfriend', limbPart: 'leg' | 'arm' | 'feet') => void;
  onSelectPiece?: (pieceId: 'boyfriend' | 'girlfriend') => void;
  hoverCoord: CellCoord | null;
  setHoverCoord: (c: CellCoord | null) => void;
  zenTimer?: {
    seconds: number;
    speedBonus: number;
    currentScore: number;
    penaltyPoints: number;
    isEnabled: boolean;
    onToggleEnabled: () => void;
  };
  onRegisterStartDrag?: (fn: (id: 'boyfriend' | 'girlfriend', e: React.PointerEvent) => void) => void;
}

export function BedGrid({
  rows,
  cols,
  dog,
  obstacles,
  boyfriend,
  girlfriend,
  selectedPieceId,
  profiles,
  allowDogNudge,
  peePuddles = [],
  onPlacePiece,
  onRecallPiece,
  onNudgeDog,
  onConsumeTreat,
  onPenalize,
  onRerollToys,
  onAdjustLimb,
  onSelectPiece,
  hoverCoord,
  setHoverCoord,
  zenTimer,
  onRegisterStartDrag,
}: BedGridProps) {
  const bedGridRef = useRef<HTMLDivElement>(null);

  // Floating badges for instant visual score feedback
  const [floatingBadges, setFloatingBadges] = useState<FloatingBadge[]>([]);

  // Drag state optimized for mobile touch screens
  const [dragPiece, setDragPiece] = useState<{
    id: 'boyfriend' | 'girlfriend';
    anchor: CellCoord; // cell offset within piece
    currentOrigin: CellCoord | null;
    isValid: boolean;
  } | null>(null);

  const [dragDog, setDragDog] = useState<{
    startCoord: CellCoord;
    currentDelta: CellCoord;
  } | null>(null);

  // Collision cooldown timers to prevent audio spamming
  const lastRosieCollisionRef = useRef<number>(0);
  const lastToyCollisionRef = useRef<number>(0);

  // Active piece for placement
  const activePiece =
    selectedPieceId === 'boyfriend'
      ? boyfriend
      : selectedPieceId === 'girlfriend'
      ? girlfriend
      : null;

  // Build sets of occupied cells
  const dogSet = new Set(dog.cells.map((c) => coordKey(c.r, c.c)));
  const obstacleMap = new Map<string, Obstacle>();
  obstacles.forEach((obs) => obstacleMap.set(coordKey(obs.r, obs.c), obs));
  const peeSet = new Set((peePuddles || []).map((p) => coordKey(p.r, p.c)));

  const boyfriendPlacedCells: CellCoord[] = boyfriend.placedPos
    ? boyfriend.cells.map((c) => ({
        r: boyfriend.placedPos!.r + c.r,
        c: boyfriend.placedPos!.c + c.c,
      }))
    : [];
  const boyfriendSet = new Set(
    boyfriendPlacedCells.map((c) => coordKey(c.r, c.c))
  );

  const girlfriendPlacedCells: CellCoord[] = girlfriend.placedPos
    ? girlfriend.cells.map((c) => ({
        r: girlfriend.placedPos!.r + c.r,
        c: girlfriend.placedPos!.c + c.c,
      }))
    : [];
  const girlfriendSet = new Set(
    girlfriendPlacedCells.map((c) => coordKey(c.r, c.c))
  );

  // Check if Bentzi and Shai are cuddled up together
  const isCuddlingHumans = Boolean(
    boyfriend.placedPos &&
      girlfriend.placedPos &&
      areAdjacent(
        boyfriend.cells,
        boyfriend.placedPos,
        girlfriend.cells,
        girlfriend.placedPos
      )
  );

  // Check if Rosie is snuggled against either human
  const isCuddlingDog = Boolean(
    (boyfriend.placedPos &&
      areAdjacent(
        dog.cells,
        { r: 0, c: 0 },
        boyfriend.cells,
        boyfriend.placedPos
      )) ||
      (girlfriend.placedPos &&
        areAdjacent(
          dog.cells,
          { r: 0, c: 0 },
          girlfriend.cells,
          girlfriend.placedPos
        ))
  );

  // Helper to spawn floating points badges on the bed
  const spawnBadge = useCallback(
    (text: string, type: 'rosie' | 'toy' | 'bonus' | 'pee', cellR: number, cellC: number) => {
      if (!bedGridRef.current) return;
      const rect = bedGridRef.current.getBoundingClientRect();
      const cellW = rect.width / cols;
      const cellH = rect.height / rows;
      const x = (cellC + 0.5) * cellW;
      const y = (cellR + 0.5) * cellH;

      const badgeId = Date.now() + Math.random();
      setFloatingBadges((prev) => [...prev, { id: badgeId, text, type, x, y }]);
      setTimeout(() => {
        setFloatingBadges((prev) => prev.filter((b) => b.id !== badgeId));
      }, 1200);
    },
    [cols, rows]
  );

  // Convert pointer (clientX, clientY) to bed grid (r, c)
  const getGridCoordFromClient = useCallback(
    (clientX: number, clientY: number): CellCoord | null => {
      if (!bedGridRef.current) return null;
      const rect = bedGridRef.current.getBoundingClientRect();
      if (
        clientX < rect.left - 20 ||
        clientX > rect.right + 20 ||
        clientY < rect.top - 20 ||
        clientY > rect.bottom + 20
      ) {
        return null;
      }
      const relX = Math.max(0, Math.min(rect.width - 1, clientX - rect.left));
      const relY = Math.max(0, Math.min(rect.height - 1, clientY - rect.top));
      const c = Math.floor((relX / rect.width) * cols);
      const r = Math.floor((relY / rect.height) * rows);
      return { r, c };
    },
    [cols, rows]
  );

  // Start dragging a human piece (mobile touch friendly)
  const startDragPiece = (
    id: 'boyfriend' | 'girlfriend',
    anchor: CellCoord,
    e: React.PointerEvent
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (onSelectPiece) onSelectPiece(id);

    const piece = id === 'boyfriend' ? boyfriend : girlfriend;
    const origin = piece.placedPos;

    // Check validity at current origin
    let initialValid = false;
    if (origin) {
      const blockedSet = new Set<string>();
      dogSet.forEach((k) => blockedSet.add(k));
      obstacleMap.forEach((_, k) => blockedSet.add(k));
      peeSet.forEach((k) => blockedSet.add(k));
      if (id === 'boyfriend') {
        girlfriendSet.forEach((k) => blockedSet.add(k));
      } else {
        boyfriendSet.forEach((k) => blockedSet.add(k));
      }
      initialValid = canPlace(piece.cells, origin, rows, cols, blockedSet);
    }

    setDragPiece({
      id,
      anchor,
      currentOrigin: origin,
      isValid: initialValid,
    });
    sound.playPop();
  };

  useEffect(() => {
    if (onRegisterStartDrag) {
      onRegisterStartDrag((id, e) => {
        startDragPiece(id, { r: 0, c: 0 }, e);
      });
    }
  }, [onRegisterStartDrag, startDragPiece]);

  // Start dragging Rosie the dog (mobile touch friendly)
  const startDragDog = (coord: CellCoord, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!allowDogNudge) return;

    setDragDog({
      startCoord: coord,
      currentDelta: { r: 0, c: 0 },
    });
    sound.playDogGrumble();
  };

  // Global window pointermove and pointerup listeners for mobile touch screen dragging
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const gridCoord = getGridCoordFromClient(e.clientX, e.clientY);

      // Handle Piece Dragging
      if (dragPiece) {
        if (!gridCoord) {
          setDragPiece((prev) => (prev ? { ...prev, currentOrigin: null, isValid: false } : null));
          return;
        }

        const originR = gridCoord.r - dragPiece.anchor.r;
        const originC = gridCoord.c - dragPiece.anchor.c;
        const candidateOrigin: CellCoord = { r: originR, c: originC };

        const piece = dragPiece.id === 'boyfriend' ? boyfriend : girlfriend;

        // Blocked set includes dog, obstacles, pee, and other player's placed cells
        const blockedSet = new Set<string>();
        dogSet.forEach((k) => blockedSet.add(k));
        obstacleMap.forEach((_, k) => blockedSet.add(k));
        peeSet.forEach((k) => blockedSet.add(k));

        if (dragPiece.id === 'boyfriend') {
          girlfriendSet.forEach((k) => blockedSet.add(k));
        } else {
          boyfriendSet.forEach((k) => blockedSet.add(k));
        }

        const isValid = canPlace(piece.cells, candidateOrigin, rows, cols, blockedSet);

        // Real-time collision penalties
        const projected = piece.cells.map((cell) => ({
          r: originR + cell.r,
          c: originC + cell.c,
        }));

        const now = Date.now();

        // 1. Collision with Rosie: penalty -50 pts
        const hitRosieCell = projected.find((p) => dogSet.has(coordKey(p.r, p.c)));
        if (hitRosieCell && now - lastRosieCollisionRef.current > 750) {
          lastRosieCollisionRef.current = now;
          sound.playDogGrumble();
          onPenalize(50, `Watch out for ${profiles.dogName}! 🐾`, e.clientX, e.clientY);
          spawnBadge(`-50 pts! Watch out for ${profiles.dogName}! 🐾`, 'rosie', hitRosieCell.r, hitRosieCell.c);
        }

        // 2. Collision with Toy Obstacle: penalty -25 pts
        const hitToyCell = projected.find((p) => {
          const obs = obstacleMap.get(coordKey(p.r, p.c));
          return obs && (obs.type === 'toy_duck' || obs.type === 'toy_ball' || obs.type === 'toy_bone');
        });
        if (hitToyCell && now - lastToyCollisionRef.current > 750) {
          lastToyCollisionRef.current = now;
          sound.playSqueak();
          onPenalize(25, 'Squeaked a toy! 🧸', e.clientX, e.clientY);
          spawnBadge('-25 pts! Squeaked a toy! 🧸', 'toy', hitToyCell.r, hitToyCell.c);
        }

        setDragPiece((prev) =>
          prev
            ? {
                ...prev,
                currentOrigin: candidateOrigin,
                isValid,
              }
            : null
        );
      }

      // Handle Dog Dragging (Nudging)
      if (dragDog) {
        if (!gridCoord) return;
        const dr = gridCoord.r - dragDog.startCoord.r;
        const dc = gridCoord.c - dragDog.startCoord.c;

        const clampedDr = Math.max(-1, Math.min(1, dr));
        const clampedDc = Math.max(-1, Math.min(1, dc));

        setDragDog((prev) =>
          prev ? { ...prev, currentDelta: { r: clampedDr, c: clampedDc } } : null
        );
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      // Release Piece Drag
      if (dragPiece) {
        if (dragPiece.currentOrigin && dragPiece.isValid) {
          const piece = dragPiece.id === 'boyfriend' ? boyfriend : girlfriend;
          const blockedSet = new Set<string>();
          dogSet.forEach((k) => blockedSet.add(k));
          obstacleMap.forEach((_, k) => blockedSet.add(k));
          peeSet.forEach((k) => blockedSet.add(k));
          if (dragPiece.id === 'boyfriend') {
            girlfriendSet.forEach((k) => blockedSet.add(k));
          } else {
            boyfriendSet.forEach((k) => blockedSet.add(k));
          }

          if (canPlace(piece.cells, dragPiece.currentOrigin, rows, cols, blockedSet)) {
            onPlacePiece(dragPiece.id, dragPiece.currentOrigin);
          } else {
            sound.playRotate();
          }
        } else {
          sound.playRotate();
        }
        setDragPiece(null);
      }

      // Release Dog Drag
      if (dragDog) {
        const { r: dr, c: dc } = dragDog.currentDelta;
        if (dr !== 0 || dc !== 0) {
          onNudgeDog(dr, dc);
        }
        setDragDog(null);
      }
    };

    if (dragPiece || dragDog) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('pointercancel', handlePointerUp);
    }

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [
    dragPiece,
    dragDog,
    getGridCoordFromClient,
    boyfriend,
    girlfriend,
    dogSet,
    obstacleMap,
    girlfriendSet,
    boyfriendSet,
    rows,
    cols,
    onPenalize,
    profiles.dogName,
    spawnBadge,
    onPlacePiece,
    onNudgeDog,
  ]);

  // Determine active projected ghost cells for placement preview (Tetris style)
  let activeProjectedCells: { r: number; c: number; part: BodyPartType; valid: boolean }[] = [];

  if (dragPiece && dragPiece.currentOrigin) {
    const piece = dragPiece.id === 'boyfriend' ? boyfriend : girlfriend;
    activeProjectedCells = piece.cells.map((cell) => ({
      r: dragPiece.currentOrigin!.r + cell.r,
      c: dragPiece.currentOrigin!.c + cell.c,
      part: cell.part || 'torso',
      valid: dragPiece.isValid,
    }));
  } else if (activePiece && hoverCoord && !dragPiece) {
    const otherBlockedSet = new Set<string>();
    dogSet.forEach((k) => otherBlockedSet.add(k));
    obstacleMap.forEach((_, k) => otherBlockedSet.add(k));
    if (selectedPieceId === 'boyfriend') {
      girlfriendSet.forEach((k) => otherBlockedSet.add(k));
    } else {
      boyfriendSet.forEach((k) => otherBlockedSet.add(k));
    }
    const isValid = canPlace(activePiece.cells, hoverCoord, rows, cols, otherBlockedSet);
    activeProjectedCells = activePiece.cells.map((c) => ({
      r: hoverCoord.r + c.r,
      c: hoverCoord.c + c.c,
      part: c.part || 'torso',
      valid: isValid,
    }));
  }

  // Handle cell tap / click
  const handleCellClick = (r: number, c: number) => {
    const key = coordKey(r, c);

    // If clicking an existing placed piece on the bed, select them
    if (boyfriendSet.has(key)) {
      if (onSelectPiece) onSelectPiece('boyfriend');
      return;
    }
    if (girlfriendSet.has(key)) {
      if (onSelectPiece) onSelectPiece('girlfriend');
      return;
    }

    // 1. If active piece selected and tap empty square, attempt placement
    if (activePiece && !dragPiece && !dragDog) {
      const otherBlockedSet = new Set<string>();
      dogSet.forEach((k) => otherBlockedSet.add(k));
      obstacleMap.forEach((_, k) => otherBlockedSet.add(k));
      peeSet.forEach((k) => otherBlockedSet.add(k));
      if (selectedPieceId === 'boyfriend') {
        girlfriendSet.forEach((k) => otherBlockedSet.add(k));
      } else {
        boyfriendSet.forEach((k) => otherBlockedSet.add(k));
      }
      if (canPlace(activePiece.cells, { r, c }, rows, cols, otherBlockedSet)) {
        onPlacePiece(activePiece.id, { r, c });
        return;
      } else {
        sound.playRotate();
        return;
      }
    }

    // 2. If clicking an obstacle treat, consume it
    const obs = obstacleMap.get(key);
    if (obs && (obs.type === 'treat_bone' || obs.type === 'treat_bacon')) {
      onConsumeTreat(obs);
    }
  };

  return (
    <div className="w-full max-w-[360px] mx-auto select-none touch-none">
      {/* Zen Score Bar */}
      {zenTimer && (
        <ZenTimer
          seconds={zenTimer.seconds}
          speedBonus={zenTimer.speedBonus}
          currentScore={zenTimer.currentScore}
          penaltyPoints={zenTimer.penaltyPoints}
          isEnabled={zenTimer.isEnabled}
          onToggleEnabled={zenTimer.onToggleEnabled}
        />
      )}

      {/* Headboard */}
      <div className="w-full bg-gradient-to-r from-amber-800 via-amber-700 to-amber-800 rounded-t-2xl py-2 px-4 shadow-md border-b-4 border-amber-900 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-400 shadow-sm animate-pulse" />
          <span className="text-xs font-bold text-amber-100 tracking-wider">
            COZY BED
          </span>
        </div>
        <div className="flex gap-3 text-[9px] text-amber-200 font-bold">
          <span>{cols}x{rows} Grid</span>
        </div>
      </div>

      {/* Mattress / Bed Frame Container */}
      <div
        ref={bedGridRef}
        className="relative bg-amber-100/70 p-2.5 rounded-b-3xl border-4 border-amber-800 shadow-xl overflow-hidden backdrop-blur-xs touch-none"
      >
        {/* Floating animated points badges on bed */}
        {floatingBadges.map((b) => (
          <div
            key={b.id}
            className={`absolute pointer-events-none z-50 text-[11px] font-black px-2.5 py-1 rounded-full shadow-lg border animate-float-fade ${
              b.type === 'pee'
                ? 'bg-amber-400 text-amber-950 border-2 border-amber-600 animate-bounce'
                : b.type === 'rosie'
                ? 'bg-rose-600 text-white border-rose-400'
                : b.type === 'toy'
                ? 'bg-amber-600 text-white border-amber-400'
                : 'bg-emerald-600 text-white border-emerald-400'
            }`}
            style={{
              left: b.x,
              top: b.y,
              transform: 'translate(-50%, -50%)',
            }}
          >
            {b.text}
          </div>
        ))}

        {/* Dog Patience & Drag hint bar */}
        <div className="mb-2 flex items-center justify-between px-1 gap-2 flex-wrap">
          {allowDogNudge && (
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-950">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-slate-900 border border-white" />
                {profiles.dogName}:
              </span>
              <div className="flex gap-1">
                {[0, 1, 2].map((lvl) => (
                  <span
                    key={lvl}
                    className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-black shadow-xs ${
                      dog.grumpiness > lvl
                        ? 'bg-rose-500 text-white animate-bounce'
                        : 'bg-emerald-400 text-emerald-950'
                    }`}
                  >
                    {dog.grumpiness > lvl ? '!' : '💤'}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Cuddle Harmony Status */}
          {isCuddlingHumans && (
            <div className="flex items-center gap-1 text-[10px] font-black text-pink-700 bg-pink-100/90 border border-pink-300 px-2 py-0.5 rounded-full shadow-2xs animate-pulse">
              <Heart className="w-3 h-3 text-pink-500 fill-pink-400" />
              <span>Cuddle Harmony! (+250)</span>
            </div>
          )}

          {/* Move Toys Button */}
          {onRerollToys && (
            <button
              onClick={onRerollToys}
              className="text-[10px] font-bold bg-amber-200/90 hover:bg-amber-300 text-amber-950 px-2 py-0.5 rounded-lg border border-amber-300/80 shadow-2xs active:scale-95 transition-all flex items-center gap-1"
              title="Move toys & treats on the bed"
            >
              <RefreshCw className="w-2.5 h-2.5" />
              <span>Move Toys ({obstacles.filter((o) => o.type !== 'pee_puddle').length})</span>
            </button>
          )}

          {allowDogNudge && (
            <div className="flex items-center gap-1 text-[10px] font-bold text-amber-900/80 bg-amber-200/80 px-2 py-0.5 rounded-full shadow-2xs ml-auto">
              <Move className="w-3 h-3 text-amber-700" />
              <span>Drag to move</span>
            </div>
          )}
        </div>

        {/* =================================================================== */}
        {/* BED GRID: CLEAN BED SQUARES + 3 ANIMATED CHARACTERS OVERLAID ON TOP */}
        {/* =================================================================== */}
        <div className="relative touch-none">
          {/* Layer 1: Pure Bed Squares */}
          <div
            className="grid gap-1.5 p-1 bg-white/95 rounded-2xl shadow-inner border border-amber-200 touch-none"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
            }}
          >
            {Array.from({ length: rows }).map((_, r) =>
              Array.from({ length: cols }).map((_, c) => {
                const key = coordKey(r, c);
                const isDog = dogSet.has(key);
                const obstacle = obstacleMap.get(key);
                const isBoyfriend = boyfriendSet.has(key);
                const isGirlfriend = girlfriendSet.has(key);
                const isPee = peeSet.has(key);

                // Projected preview cell (from drag or hover)
                const proj = activeProjectedCells.find((pc) => pc.r === r && pc.c === c);

                return (
                  <div
                    key={key}
                    onClick={() => handleCellClick(r, c)}
                    onPointerDown={(e) => {
                      if (
                        activePiece &&
                        !activePiece.placedPos &&
                        !dragPiece &&
                        !isDog &&
                        !obstacle &&
                        !isPee &&
                        !isBoyfriend &&
                        !isGirlfriend
                      ) {
                        startDragPiece(activePiece.id, { r: 0, c: 0 }, e);
                      }
                    }}
                    onPointerEnter={() => {
                      if (activePiece && !dragPiece) {
                        setHoverCoord({ r, c });
                      }
                    }}
                    className={`relative aspect-square rounded-xl border flex items-center justify-center transition-all cursor-pointer touch-none select-none ${
                      isPee
                        ? 'bg-amber-300/80 border-2 border-amber-500 shadow-inner'
                        : r === 0 && !obstacle
                        ? 'bg-stone-50/90 border-stone-200 shadow-2xs'
                        : 'bg-amber-50/70 border-amber-200/60 shadow-2xs'
                    } ${
                      proj
                        ? proj.valid
                          ? 'bg-emerald-300/85 border-2 border-emerald-500 ring-2 ring-emerald-300 shadow-md z-10'
                          : 'bg-rose-400/80 border-2 border-rose-600 ring-2 ring-rose-300 animate-gentle-shake shadow-md z-10'
                        : ''
                    } hover:scale-[1.01] active:scale-95`}
                  >
                    {/* Pillow visual hint for top row empty cells */}
                    {r === 0 && !obstacle && !proj && !isPee && (
                      <div className="absolute top-1 left-1.5 right-1.5 bottom-1 rounded-lg border border-dashed border-stone-300/80 pointer-events-none flex items-center justify-center">
                        <span className="text-[8.5px] text-stone-300 font-bold uppercase tracking-wider">
                          pillow
                        </span>
                      </div>
                    )}

                    {/* Pee Puddle Wet Stain on the Bed */}
                    {isPee && (
                      <div className="flex flex-col items-center justify-center pointer-events-none animate-pulse">
                        <span className="text-base leading-none">💦</span>
                        <span className="text-[7.5px] font-black text-amber-950 bg-amber-200/90 px-1 rounded-full -mt-0.5 border border-amber-400">
                          Pee!
                        </span>
                      </div>
                    )}

                    {/* Obstacle / Squeaky Toy / Treat */}
                    {obstacle && !isDog && !isPee && (
                      <div className="w-full h-full flex items-center justify-center relative pointer-events-none">
                        <ObstacleIcon type={obstacle.type} className="w-6 h-6 drop-shadow-xs" />
                        {obstacle.type.startsWith('treat') && (
                          <div className="absolute -top-1 -right-1 text-[9px] animate-pulse">
                            ✨
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Layer 2: THE 3 CHARACTERS (1 DOG & 2 MEN) ON TOP OF THE SQUARES! */}
          <div
            className="absolute inset-0 p-1 grid gap-1.5 pointer-events-none z-20"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
            }}
          >
            {/* 1. ROSIE (DOG) OVERLAID ON HER OCCUPIED SQUARES */}
            {dog.cells.length > 0 && (() => {
              const dMinC = Math.min(...dog.cells.map((c) => c.c));
              const dMaxC = Math.max(...dog.cells.map((c) => c.c));
              const dMinR = Math.min(...dog.cells.map((c) => c.r));
              const dMaxR = Math.max(...dog.cells.map((c) => c.r));

              return (
                <div
                  className="pointer-events-auto"
                  style={{
                    gridColumn: `${dMinC + 1} / ${dMaxC + 2}`,
                    gridRow: `${dMinR + 1} / ${dMaxR + 2}`,
                  }}
                >
                  <FullAnimatedRosie
                    dog={dog}
                    profiles={profiles}
                    isCuddling={isCuddlingDog}
                    onPointerDown={(e) => {
                      const head = dog.cells[0] || { r: 0, c: 0 };
                      startDragDog(head, e);
                    }}
                  />
                </div>
              );
            })()}

            {/* 2. BENTZI (MAN 1) OVERLAID ON HIS OCCUPIED SQUARES WHEN PLACED */}
            {boyfriend.placedPos && (() => {
              const origin = boyfriend.placedPos;
              const bfMinC = Math.min(...boyfriend.cells.map((c) => c.c + origin.c));
              const bfMaxC = Math.max(...boyfriend.cells.map((c) => c.c + origin.c));
              const bfMinR = Math.min(...boyfriend.cells.map((c) => c.r + origin.r));
              const bfMaxR = Math.max(...boyfriend.cells.map((c) => c.r + origin.r));

              return (
                <div
                  className="pointer-events-auto"
                  style={{
                    gridColumn: `${bfMinC + 1} / ${bfMaxC + 2}`,
                    gridRow: `${bfMinR + 1} / ${bfMaxR + 2}`,
                  }}
                >
                  <FullAnimatedBentzi
                    piece={boyfriend}
                    profiles={profiles}
                    isCuddling={isCuddlingHumans}
                    onPointerDown={(e, cellOffset) => {
                      startDragPiece('boyfriend', cellOffset, e);
                    }}
                  />
                </div>
              );
            })()}

            {/* 3. SHAI (MAN 2) OVERLAID ON HIS OCCUPIED SQUARES WHEN PLACED */}
            {girlfriend.placedPos && (() => {
              const origin = girlfriend.placedPos;
              const gfMinC = Math.min(...girlfriend.cells.map((c) => c.c + origin.c));
              const gfMaxC = Math.max(...girlfriend.cells.map((c) => c.c + origin.c));
              const gfMinR = Math.min(...girlfriend.cells.map((c) => c.r + origin.r));
              const gfMaxR = Math.max(...girlfriend.cells.map((c) => c.r + origin.r));

              return (
                <div
                  className="pointer-events-auto"
                  style={{
                    gridColumn: `${gfMinC + 1} / ${gfMaxC + 2}`,
                    gridRow: `${gfMinR + 1} / ${gfMaxR + 2}`,
                  }}
                >
                  <FullAnimatedShai
                    piece={girlfriend}
                    profiles={profiles}
                    isCuddling={isCuddlingHumans}
                    onPointerDown={(e, cellOffset) => {
                      startDragPiece('girlfriend', cellOffset, e);
                    }}
                  />
                </div>
              );
            })()}

            {/* PIECE BEING DRAGGED: Floating Character Preview following Touch/Pointer */}
            {dragPiece && dragPiece.currentOrigin && (() => {
              const origin = dragPiece.currentOrigin;
              const p = dragPiece.id === 'boyfriend' ? boyfriend : girlfriend;
              const pMinC = Math.min(...p.cells.map((c) => c.c + origin.c));
              const pMaxC = Math.max(...p.cells.map((c) => c.c + origin.c));
              const pMinR = Math.min(...p.cells.map((c) => c.r + origin.r));
              const pMaxR = Math.max(...p.cells.map((c) => c.r + origin.r));

              return (
                <div
                  className="pointer-events-none opacity-95 drop-shadow-2xl z-30"
                  style={{
                    gridColumn: `${Math.max(1, pMinC + 1)} / ${Math.min(cols + 1, pMaxC + 2)}`,
                    gridRow: `${Math.max(1, pMinR + 1)} / ${Math.min(rows + 1, pMaxR + 2)}`,
                  }}
                >
                  {dragPiece.id === 'boyfriend' ? (
                    <FullAnimatedBentzi
                      piece={boyfriend}
                      profiles={profiles}
                      isCuddling={false}
                      isDragging={true}
                    />
                  ) : (
                    <FullAnimatedShai
                      piece={girlfriend}
                      profiles={profiles}
                      isCuddling={false}
                      isDragging={true}
                    />
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
