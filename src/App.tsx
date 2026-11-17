import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  LevelConfig,
  PlayerPiece,
  DogState,
  Obstacle,
  CellCoord,
  AvatarProfiles,
  LevelScore,
} from './types';
import { LEVELS, generateRandomBedItems } from './utils/levels';
import {
  rotateCells,
  flipCells,
  canPlace,
  coordKey,
  areAdjacent,
} from './utils/gridUtils';
import { BOYFRIEND_POSES, GIRLFRIEND_POSES, bendPieceLimb } from './utils/poses';
import { MobileFrame } from './components/MobileFrame';
import { BedGrid } from './components/BedGrid';
import { PieceDrawer } from './components/PieceDrawer';
import { DogWarningModal } from './components/DogWarningModal';
import { WinModal } from './components/WinModal';
import { LevelSelectModal } from './components/LevelSelectModal';
import { AvatarCustomizer } from './components/AvatarCustomizer';
import { sound } from './utils/audio';

const STORAGE_PROFILES_KEY = 'bedtime_puzzle_profiles_v2';
const STORAGE_COMPLETED_KEY = 'bedtime_puzzle_completed_v1';
const STORAGE_CUDDLE_KEY = 'bedtime_puzzle_cuddle_v1';
const STORAGE_SCORES_KEY = 'bedtime_puzzle_highscores_v1';
const STORAGE_ZENTIMER_KEY = 'bedtime_puzzle_zentimer_v1';

const DEFAULT_PROFILES: AvatarProfiles = {
  boyfriendName: 'Bentzi',
  girlfriendName: 'Shai',
  dogName: 'Rosie',
  boyfriendPhoto: '/assets/avatars/bentzi.jpg',
  girlfriendPhoto: '/assets/avatars/shai.jpg',
  dogPhoto: '/assets/avatars/rosie.jpg',
  dogBreed: 'border_collie' as any,
};

export default function App() {
  // Profiles with Bentzi, Shai, and Rosie (black and white dog)
  const [profiles, setProfiles] = useState<AvatarProfiles>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_PROFILES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          boyfriendName:
            !parsed.boyfriendName || parsed.boyfriendName === 'Boyfriend'
              ? 'Bentzi'
              : parsed.boyfriendName,
          girlfriendName:
            !parsed.girlfriendName ||
            parsed.girlfriendName === 'Girlfriend' ||
            parsed.girlfriendName === 'Me'
              ? 'Shai'
              : parsed.girlfriendName,
          dogName: 'Rosie',
          boyfriendPhoto: '/assets/avatars/boyfriend.jpg',
          girlfriendPhoto: '/assets/avatars/girlfriend.jpg',
          dogPhoto: '/assets/avatars/rosie.jpg',
        };
      }
    } catch {}
    return DEFAULT_PROFILES;
  });

  // Level Progression
  const [currentLevelIndex, setCurrentLevelIndex] = useState(0);
  const currentLevel = LEVELS[currentLevelIndex] || LEVELS[0];

  const [completedLevelIds, setCompletedLevelIds] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_COMPLETED_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [cuddleBonusLevelIds, setCuddleBonusLevelIds] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_CUDDLE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [highScores, setHighScores] = useState<Record<number, number>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SCORES_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  // Zen Timer, Penalties, & Real-time Live Score
  const [zenTimerSeconds, setZenTimerSeconds] = useState(0);
  const [penaltyPoints, setPenaltyPoints] = useState(0);

  const [isZenTimerEnabled, setIsZenTimerEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_ZENTIMER_KEY);
      if (saved !== null) return JSON.parse(saved);
    } catch {}
    return true;
  });

  const [lastWinScore, setLastWinScore] = useState<LevelScore>({
    basePoints: 1000,
    speedBonus: 500,
    cuddleBonus: 0,
    penaltyPoints: 0,
    totalPoints: 1500,
    timeSeconds: 0,
  });
  const [isNewHighScore, setIsNewHighScore] = useState(false);

  // Active Level State
  const [dog, setDog] = useState<DogState>({
    cells: currentLevel.dogCells,
    grumpiness: currentLevel.startingGrumpiness || 0,
    maxGrumpiness: 3,
  });

  const [obstacles, setObstacles] = useState<Obstacle[]>(currentLevel.obstacles);

  // Pose indices
  const [bfPoseIndex, setBfPoseIndex] = useState(0);
  const [gfPoseIndex, setGfPoseIndex] = useState(0);

  const [boyfriend, setBoyfriend] = useState<PlayerPiece>({
    id: 'boyfriend',
    name: profiles.boyfriendName,
    cells: currentLevel.boyfriendDefaultCells,
    color: 'bg-sky-200',
    avatarColor: 'text-sky-800',
    rotation: 0,
    isFlipped: false,
    placedPos: null,
  });

  const [girlfriend, setGirlfriend] = useState<PlayerPiece>({
    id: 'girlfriend',
    name: profiles.girlfriendName,
    cells: currentLevel.girlfriendDefaultCells,
    color: 'bg-teal-200',
    avatarColor: 'text-teal-800',
    rotation: 0,
    isFlipped: false,
    placedPos: null,
  });

  const [selectedPieceId, setSelectedPieceId] = useState<
    'boyfriend' | 'girlfriend' | null
  >('boyfriend');

  const [hoverCoord, setHoverCoord] = useState<CellCoord | null>(null);

  // Modals & Atmosphere
  const [warningModal, setWarningModal] = useState<{
    type: 'grumble' | 'growl' | 'bite' | 'pee';
  } | null>(null);
  const [peePuddles, setPeePuddles] = useState<CellCoord[]>([]);
  const [isWinModalOpen, setIsWinModalOpen] = useState(false);
  const [isCuddleBonus, setIsCuddleBonus] = useState(false);
  const [isLevelSelectOpen, setIsLevelSelectOpen] = useState(false);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [isNightLamp, setIsNightLamp] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Direct touch drag connection from Drawer to Bed
  const startDragFromDrawerRef = useRef<
    ((id: 'boyfriend' | 'girlfriend', e: React.PointerEvent) => void) | null
  >(null);

  // Live speed bonus calculation
  const targetSeconds = currentLevel.targetZenSeconds || 30;
  const currentSpeedBonus = Math.max(
    100,
    Math.round(1500 * Math.max(0.1, 1 - zenTimerSeconds / (targetSeconds * 2.5)))
  );

  // Real-time live score
  const currentLiveScore = Math.max(0, 1000 + currentSpeedBonus - penaltyPoints);

  // Zen Timer ticker
  useEffect(() => {
    if (isWinModalOpen) return;
    const interval = setInterval(() => {
      setZenTimerSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isWinModalOpen, currentLevelIndex]);

  const handleToggleZenTimer = () => {
    setIsZenTimerEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_ZENTIMER_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Reset or Load Level (dynamically generates 1-3 items moving each round)
  const loadLevel = useCallback(
    (index: number) => {
      const lvl = LEVELS[index] || LEVELS[0];
      setCurrentLevelIndex(index);
      setZenTimerSeconds(0);
      setPenaltyPoints(0);
      setDog({
        cells: [...lvl.dogCells],
        grumpiness: lvl.startingGrumpiness || 0,
        maxGrumpiness: 3,
      });

      // User pointer 1: Move toys/treats each round with 1-3 items on bed
      const roundItems = generateRandomBedItems(lvl.rows, lvl.cols, lvl.dogCells);
      setObstacles(roundItems);
      setPeePuddles([]);

      setBfPoseIndex(0);
      setGfPoseIndex(0);
      setBoyfriend({
        id: 'boyfriend',
        name: profiles.boyfriendName,
        cells: [...lvl.boyfriendDefaultCells],
        color: 'bg-sky-200',
        avatarColor: 'text-sky-800',
        rotation: 0,
        isFlipped: false,
        placedPos: null,
        poseId: BOYFRIEND_POSES[0]?.id || 'bf-l-pose',
      });
      setGirlfriend({
        id: 'girlfriend',
        name: profiles.girlfriendName,
        cells: [...lvl.girlfriendDefaultCells],
        color: 'bg-teal-200',
        avatarColor: 'text-teal-800',
        rotation: 0,
        isFlipped: false,
        placedPos: null,
        poseId: GIRLFRIEND_POSES[0]?.id || 'gf-l-pose',
      });
      setSelectedPieceId('boyfriend');
      setHoverCoord(null);
      setIsWinModalOpen(false);
      setIsCuddleBonus(false);
      setWarningModal(null);
      setIsNewHighScore(false);
    },
    [profiles.boyfriendName, profiles.girlfriendName]
  );

  useEffect(() => {
    loadLevel(currentLevelIndex);
  }, [currentLevelIndex, loadLevel]);

  // Rotate piece
  const handleRotatePiece = (id: 'boyfriend' | 'girlfriend') => {
    if (id === 'boyfriend') {
      const rotated = rotateCells(boyfriend.cells);
      setBoyfriend((prev) => ({
        ...prev,
        cells: rotated,
        rotation: (prev.rotation + 90) % 360,
        placedPos: null,
      }));
      setSelectedPieceId('boyfriend');
    } else {
      const rotated = rotateCells(girlfriend.cells);
      setGirlfriend((prev) => ({
        ...prev,
        cells: rotated,
        rotation: (prev.rotation + 90) % 360,
        placedPos: null,
      }));
      setSelectedPieceId('girlfriend');
    }
  };

  // Flip piece
  const handleFlipPiece = (id: 'boyfriend' | 'girlfriend') => {
    if (id === 'boyfriend') {
      const flipped = flipCells(boyfriend.cells);
      setBoyfriend((prev) => ({
        ...prev,
        cells: flipped,
        isFlipped: !prev.isFlipped,
        placedPos: null,
      }));
      setSelectedPieceId('boyfriend');
    } else {
      const flipped = flipCells(girlfriend.cells);
      setGirlfriend((prev) => ({
        ...prev,
        cells: flipped,
        isFlipped: !prev.isFlipped,
        placedPos: null,
      }));
      setSelectedPieceId('girlfriend');
    }
  };

  // Change Pose (cycles through static poses)
  const handleChangePose = (id: 'boyfriend' | 'girlfriend') => {
    sound.playRotate();
    if (id === 'boyfriend') {
      const nextIdx = (bfPoseIndex + 1) % BOYFRIEND_POSES.length;
      setBfPoseIndex(nextIdx);
      const newPose = BOYFRIEND_POSES[nextIdx];
      setBoyfriend((prev) => {
        let placedPos = prev.placedPos;
        if (placedPos) {
          const blockedSet = new Set<string>();
          dog.cells.forEach((c) => blockedSet.add(coordKey(c.r, c.c)));
          obstacles.forEach((o) => blockedSet.add(coordKey(o.r, o.c)));
          peePuddles.forEach((p) => blockedSet.add(coordKey(p.r, p.c)));
          if (girlfriend.placedPos) {
            girlfriend.cells.forEach((c) =>
              blockedSet.add(coordKey(girlfriend.placedPos!.r + c.r, girlfriend.placedPos!.c + c.c))
            );
          }
          if (!canPlace(newPose.cells, placedPos, currentLevel.rows, currentLevel.cols, blockedSet)) {
            // Cannot stay in bed with new pose because it would overlap! Recall to tray
            placedPos = null;
          }
        }
        return {
          ...prev,
          cells: [...newPose.cells],
          poseId: newPose.id,
          rotation: 0,
          isFlipped: false,
          placedPos,
        };
      });
      setSelectedPieceId('boyfriend');
    } else {
      const nextIdx = (gfPoseIndex + 1) % GIRLFRIEND_POSES.length;
      setGfPoseIndex(nextIdx);
      const newPose = GIRLFRIEND_POSES[nextIdx];
      setGirlfriend((prev) => {
        let placedPos = prev.placedPos;
        if (placedPos) {
          const blockedSet = new Set<string>();
          dog.cells.forEach((c) => blockedSet.add(coordKey(c.r, c.c)));
          obstacles.forEach((o) => blockedSet.add(coordKey(o.r, o.c)));
          peePuddles.forEach((p) => blockedSet.add(coordKey(p.r, p.c)));
          if (boyfriend.placedPos) {
            boyfriend.cells.forEach((c) =>
              blockedSet.add(coordKey(boyfriend.placedPos!.r + c.r, boyfriend.placedPos!.c + c.c))
            );
          }
          if (!canPlace(newPose.cells, placedPos, currentLevel.rows, currentLevel.cols, blockedSet)) {
            placedPos = null;
          }
        }
        return {
          ...prev,
          cells: [...newPose.cells],
          poseId: newPose.id,
          rotation: 0,
          isFlipped: false,
          placedPos,
        };
      });
      setSelectedPieceId('girlfriend');
    }
  };

  // Adjust limb (falls back to cycling pose)
  const handleAdjustLimb = (
    id: 'boyfriend' | 'girlfriend',
    _limbPart?: 'leg' | 'arm' | 'feet'
  ) => {
    handleChangePose(id);
  };

  // Recall piece to drawer
  const handleRecallPiece = (id: 'boyfriend' | 'girlfriend') => {
    if (id === 'boyfriend') {
      setBoyfriend((prev) => ({ ...prev, placedPos: null }));
      setSelectedPieceId('boyfriend');
    } else {
      setGirlfriend((prev) => ({ ...prev, placedPos: null }));
      setSelectedPieceId('girlfriend');
    }
    sound.playPop();
  };

  // Collision Penalty Handler
  const handlePenalize = (points: number, reason: string) => {
    setPenaltyPoints((prev) => prev + points);
    if (reason.includes('Rosie')) {
      // Increase dog grumpiness warning
      setDog((prev) => ({
        ...prev,
        grumpiness: Math.min(2, prev.grumpiness + 1),
      }));
    }
  };

  // Check Win Condition
  const checkWinCondition = (
    bfPos: CellCoord | null,
    gfPos: CellCoord | null,
    bfCells: CellCoord[],
    gfCells: CellCoord[]
  ) => {
    if (bfPos && gfPos) {
      // Both in bed!
      const cuddle = areAdjacent(bfCells, bfPos, gfCells, gfPos);
      setIsCuddleBonus(cuddle);

      // Score calculation
      const basePoints = 1000;
      const speedBonus = currentSpeedBonus;
      const cuddleBonus = cuddle ? 500 : 0;
      const totalPoints = Math.max(100, basePoints + speedBonus + cuddleBonus - penaltyPoints);

      const scoreObj: LevelScore = {
        basePoints,
        speedBonus,
        cuddleBonus,
        penaltyPoints,
        totalPoints,
        timeSeconds: zenTimerSeconds,
      };
      setLastWinScore(scoreObj);

      const previousHigh = highScores[currentLevel.id] || 0;
      const isNewRecord = totalPoints > previousHigh;
      setIsNewHighScore(isNewRecord);

      if (isNewRecord) {
        const updatedScores = {
          ...highScores,
          [currentLevel.id]: totalPoints,
        };
        setHighScores(updatedScores);
        try {
          localStorage.setItem(STORAGE_SCORES_KEY, JSON.stringify(updatedScores));
        } catch {}
      }

      // Save progression
      const newCompleted = Array.from(
        new Set([...completedLevelIds, currentLevel.id])
      );
      setCompletedLevelIds(newCompleted);
      localStorage.setItem(STORAGE_COMPLETED_KEY, JSON.stringify(newCompleted));

      if (cuddle) {
        const newCuddles = Array.from(
          new Set([...cuddleBonusLevelIds, currentLevel.id])
        );
        setCuddleBonusLevelIds(newCuddles);
        localStorage.setItem(STORAGE_CUDDLE_KEY, JSON.stringify(newCuddles));
      }

      setTimeout(() => {
        setIsWinModalOpen(true);
      }, 350);
    }
  };

  // Place piece with strict authoritative collision check:
  // Bentzi and Shai CANNOT share any squares, overlap with Rosie, or hit obstacles!
  const handlePlacePiece = (
    pieceId: 'boyfriend' | 'girlfriend',
    origin: CellCoord
  ) => {
    // 1. Authoritative check: build blocked set
    const blockedSet = new Set<string>();
    dog.cells.forEach((c) => blockedSet.add(coordKey(c.r, c.c)));
    obstacles.forEach((o) => blockedSet.add(coordKey(o.r, o.c)));
    peePuddles.forEach((p) => blockedSet.add(coordKey(p.r, p.c)));

    const otherPiece = pieceId === 'boyfriend' ? girlfriend : boyfriend;
    if (otherPiece.placedPos) {
      otherPiece.cells.forEach((c) => {
        blockedSet.add(coordKey(otherPiece.placedPos!.r + c.r, otherPiece.placedPos!.c + c.c));
      });
    }

    const currentPiece = pieceId === 'boyfriend' ? boyfriend : girlfriend;
    if (!canPlace(currentPiece.cells, origin, currentLevel.rows, currentLevel.cols, blockedSet)) {
      // Reject placement! Cannot overlap!
      sound.playRotate();
      return;
    }

    sound.playPop();
    if (pieceId === 'boyfriend') {
      setBoyfriend((prev) => ({ ...prev, placedPos: origin }));
      if (!girlfriend.placedPos) {
        setSelectedPieceId('girlfriend');
      } else {
        setSelectedPieceId(null);
      }
      checkWinCondition(origin, girlfriend.placedPos, boyfriend.cells, girlfriend.cells);
    } else {
      setGirlfriend((prev) => ({ ...prev, placedPos: origin }));
      if (!boyfriend.placedPos) {
        setSelectedPieceId('boyfriend');
      } else {
        setSelectedPieceId(null);
      }
      checkWinCondition(boyfriend.placedPos, origin, boyfriend.cells, girlfriend.cells);
    }
  };

  // Drag-and-drop Nudge for Rosie
  const handleNudgeDog = (dr: number, dc: number) => {
    if (dog.grumpiness >= 2) {
      // BITE & PEE! Rosie refuses to move, snaps, and pees on the sheets!
      sound.playDogChomp();
      sound.playPeeSplash();
      const peeSpot = dog.cells[0] || { r: 1, c: 1 };
      setPeePuddles((prev) => [...prev, peeSpot]);
      setObstacles((prev) => [
        ...prev,
        { id: `pee-${Date.now()}`, type: 'pee_puddle', r: peeSpot.r, c: peeSpot.c },
      ]);
      setPenaltyPoints((prev) => prev + 250);
      setWarningModal({ type: 'pee' });
      return;
    }

    // Check bounds
    const nextDogCells = dog.cells.map((c) => ({
      r: c.r + dr,
      c: c.c + dc,
    }));

    const isWithinBounds = nextDogCells.every(
      (c) => c.r >= 0 && c.r < currentLevel.rows && c.c >= 0 && c.c < currentLevel.cols
    );

    if (!isWithinBounds) {
      sound.playDogGrumble();
      return;
    }

    // Check if dog is dragged onto a treat
    const targetTreat = obstacles.find(
      (o) =>
        (o.type === 'treat_bone' || o.type === 'treat_bacon') &&
        nextDogCells.some((c) => c.r === o.r && c.c === o.c)
    );

    if (targetTreat) {
      handleConsumeTreat(targetTreat);
      setDog((prev) => ({
        ...prev,
        cells: nextDogCells,
        grumpiness: 0,
      }));
      return;
    }

    // Check conflicts with solid toy obstacles or pee puddles
    const obsSet = new Set(obstacles.map((o) => coordKey(o.r, o.c)));
    if (nextDogCells.some((c) => obsSet.has(coordKey(c.r, c.c)))) {
      sound.playDogGrumble();
      return;
    }

    // Check conflicts with placed humans
    const bfCells = boyfriend.placedPos
      ? boyfriend.cells.map((c) => coordKey(c.r + boyfriend.placedPos!.r, c.c + boyfriend.placedPos!.c))
      : [];
    const gfCells = girlfriend.placedPos
      ? girlfriend.cells.map((c) => coordKey(c.r + girlfriend.placedPos!.r, c.c + girlfriend.placedPos!.c))
      : [];
    const humanSet = new Set([...bfCells, ...gfCells]);

    if (nextDogCells.some((c) => humanSet.has(coordKey(c.r, c.c)))) {
      sound.playDogGrumble();
      return;
    }

    // Increase grumpiness
    const nextGrumpiness = dog.grumpiness + 1;

    // Penalty pointer 2: Rosie sometimes pees on the bed if upset!
    const peeChance = nextGrumpiness >= 2 ? 0.65 : 0.4;
    const doesPee = Math.random() < peeChance;

    if (doesPee) {
      sound.playPeeSplash();
      // Leave pee puddle at the dog's vacated spot
      const peeSpot = { ...dog.cells[0] };
      setPeePuddles((prev) => [...prev, peeSpot]);
      setObstacles((prev) => [
        ...prev,
        { id: `pee-${Date.now()}`, type: 'pee_puddle', r: peeSpot.r, c: peeSpot.c },
      ]);
      setPenaltyPoints((prev) => prev + 200);
      setDog((prev) => ({
        ...prev,
        cells: nextDogCells,
        grumpiness: nextGrumpiness,
      }));
      setWarningModal({ type: 'pee' });
      return;
    }

    setDog((prev) => ({
      ...prev,
      cells: nextDogCells,
      grumpiness: nextGrumpiness,
    }));

    if (nextGrumpiness === 1) {
      sound.playDogGrumble();
      setWarningModal({ type: 'grumble' });
    } else if (nextGrumpiness === 2) {
      sound.playDogGrowl();
      setWarningModal({ type: 'growl' });
    }
  };

  // Give treat to soothe dog
  const handleConsumeTreat = (treat: Obstacle) => {
    sound.playCrunch();
    setObstacles((prev) => prev.filter((o) => o.id !== treat.id));
    setPenaltyPoints((prev) => Math.max(0, prev - 100)); // treat reward
    setDog((prev) => ({
      ...prev,
      grumpiness: 0,
    }));
  };

  // Clean up Rosie's pee accident with towel
  const handleCleanPee = () => {
    sound.playPop();
    setObstacles((prev) => prev.filter((o) => o.type !== 'pee_puddle'));
    setPeePuddles([]);
    setPenaltyPoints((prev) => prev + 50); // small 50 pt cleaning fee
    setWarningModal(null);
  };

  // Re-roll dynamic 1-3 toys & treats each round
  const handleRerollToys = () => {
    sound.playPop();
    const roundItems = generateRandomBedItems(currentLevel.rows, currentLevel.cols, dog.cells);
    setObstacles(roundItems);
  };

  // Apologize to soothe dog if bitten
  const handleApologize = () => {
    sound.playSnore();
    setDog((prev) => ({
      ...prev,
      grumpiness: 1,
    }));
    setWarningModal(null);
  };

  return (
    <MobileFrame
      levelNumber={currentLevel.id}
      totalLevels={LEVELS.length}
      levelTitle={currentLevel.title}
      storyNote={currentLevel.storyNote}
      isNightLamp={isNightLamp}
      soundEnabled={soundEnabled}
      profiles={profiles}
      onToggleNightLamp={() => setIsNightLamp((prev) => !prev)}
      onToggleSound={() => {
        const next = !soundEnabled;
        setSoundEnabled(next);
        sound.enabled = next;
      }}
      onOpenLevelSelect={() => setIsLevelSelectOpen(true)}
      onRestartLevel={() => loadLevel(currentLevelIndex)}
      onOpenCustomizer={() => setIsCustomizerOpen(true)}
      onPrevLevel={() => {
        if (currentLevelIndex > 0) {
          loadLevel(currentLevelIndex - 1);
        }
      }}
      onNextLevel={() => {
        if (currentLevelIndex < LEVELS.length - 1) {
          loadLevel(currentLevelIndex + 1);
        }
      }}
    >
      {/* Bed Mattress Grid with Drag & Drop, Live Penalties, & Limb rendering */}
      <BedGrid
        rows={currentLevel.rows}
        cols={currentLevel.cols}
        dog={dog}
        obstacles={obstacles}
        boyfriend={boyfriend}
        girlfriend={girlfriend}
        selectedPieceId={selectedPieceId}
        profiles={profiles}
        allowDogNudge={currentLevel.allowDogNudge}
        peePuddles={peePuddles}
        onPlacePiece={handlePlacePiece}
        onRecallPiece={handleRecallPiece}
        onNudgeDog={handleNudgeDog}
        onConsumeTreat={handleConsumeTreat}
        onPenalize={handlePenalize}
        onRerollToys={handleRerollToys}
        onAdjustLimb={handleAdjustLimb}
        onSelectPiece={(id) => setSelectedPieceId(id)}
        hoverCoord={hoverCoord}
        setHoverCoord={setHoverCoord}
        zenTimer={{
          seconds: zenTimerSeconds,
          speedBonus: currentSpeedBonus,
          currentScore: currentLiveScore,
          penaltyPoints: penaltyPoints,
          isEnabled: isZenTimerEnabled,
          onToggleEnabled: handleToggleZenTimer,
        }}
        onRegisterStartDrag={(fn) => {
          startDragFromDrawerRef.current = fn;
        }}
      />

      {/* Piece Drawer / Tray with Limbs and Pose Switcher */}
      <PieceDrawer
        boyfriend={boyfriend}
        girlfriend={girlfriend}
        selectedPieceId={selectedPieceId}
        profiles={profiles}
        onSelectPiece={(id) => setSelectedPieceId(id)}
        onRotatePiece={handleRotatePiece}
        onFlipPiece={handleFlipPiece}
        onRecallPiece={handleRecallPiece}
        onChangePose={handleChangePose}
        bfPoseName={BOYFRIEND_POSES[bfPoseIndex]?.name || 'L-Shape'}
        gfPoseName={GIRLFRIEND_POSES[gfPoseIndex]?.name || 'L-Shape'}
        onAdjustLimb={handleAdjustLimb}
        onStartDragPiece={(id, e) => {
          if (startDragFromDrawerRef.current) {
            startDragFromDrawerRef.current(id, e);
          }
        }}
      />

      {/* Dog Warning / Bite / Pee Modal */}
      <DogWarningModal
        isOpen={warningModal !== null}
        type={warningModal?.type || 'growl'}
        profiles={profiles}
        onClose={() => setWarningModal(null)}
        onApologize={handleApologize}
        onCleanPee={handleCleanPee}
      />

      {/* Character Photo Customizer Modal */}
      <AvatarCustomizer
        isOpen={isCustomizerOpen}
        profiles={profiles}
        onUpdateProfiles={(updated) => {
          setProfiles(updated);
          try {
            localStorage.setItem(STORAGE_PROFILES_KEY, JSON.stringify(updated));
          } catch {}
        }}
        onClose={() => setIsCustomizerOpen(false)}
      />

      {/* Win Modal with Zen Timer Speed Score Breakdown */}
      <WinModal
        isOpen={isWinModalOpen}
        levelId={currentLevel.id}
        levelTitle={currentLevel.title}
        isCuddleBonus={isCuddleBonus}
        profiles={profiles}
        timeSeconds={lastWinScore.timeSeconds}
        score={lastWinScore}
        isNewHighScore={isNewHighScore}
        hasNextLevel={currentLevelIndex < LEVELS.length - 1}
        onNextLevel={() => {
          setIsWinModalOpen(false);
          loadLevel(currentLevelIndex + 1);
        }}
        onReplayLevel={() => {
          setIsWinModalOpen(false);
          loadLevel(currentLevelIndex);
        }}
        onOpenLevelSelect={() => {
          setIsWinModalOpen(false);
          setIsLevelSelectOpen(true);
        }}
      />

      {/* Level Select Modal */}
      <LevelSelectModal
        isOpen={isLevelSelectOpen}
        levels={LEVELS}
        currentLevelId={currentLevel.id}
        completedLevelIds={completedLevelIds}
        cuddleBonusLevelIds={cuddleBonusLevelIds}
        onSelectLevel={(id) => {
          const idx = LEVELS.findIndex((l) => l.id === id);
          if (idx !== -1) loadLevel(idx);
        }}
        onClose={() => setIsLevelSelectOpen(false)}
      />
    </MobileFrame>
  );
}
