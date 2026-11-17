import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AvatarProfiles, LevelScore } from './types';
import { PUZZLE_LEVELS, PuzzleLevel, Pose, generateLevel, key, layoutKey, poseCellsAt } from './utils/puzzle';
import { areAdjacent } from './utils/gridUtils';
import { MobileFrame } from './components/MobileFrame';
import { Bed, PersonId, PlacedPerson } from './components/Bed';
import { PersonFigure, S } from './components/Figures';
import { PoseControls } from './components/PoseControls';
import { ZenTimer } from './components/ZenTimer';
import { DogWarningModal } from './components/DogWarningModal';
import { WinModal } from './components/WinModal';
import { LevelSelectModal } from './components/LevelSelectModal';
import { AvatarCustomizer } from './components/AvatarCustomizer';
import { sound } from './utils/audio';

const STORAGE_PROFILES_KEY = 'bedtime_puzzle_profiles_v2';
const STORAGE_COMPLETED_KEY = 'bedtime_puzzle_completed_v2';
const STORAGE_CUDDLE_KEY = 'bedtime_puzzle_cuddle_v2';
const STORAGE_SCORES_KEY = 'bedtime_puzzle_highscores_v2';
const STORAGE_ZENTIMER_KEY = 'bedtime_puzzle_zentimer_v1';

const DEFAULT_PROFILES: AvatarProfiles = {
  boyfriendName: 'Bentzi',
  girlfriendName: 'Shai',
  dogName: 'Rosie',
  boyfriendPhoto: 'assets/avatars/bentzi.jpg',
  girlfriendPhoto: 'assets/avatars/shai.jpg',
  dogPhoto: 'assets/avatars/rosie.jpg',
  dogBreed: 'border_collie' as any,
};

const IDS: PersonId[] = ['boyfriend', 'girlfriend'];

function load<T>(k: string, fallback: T): T {
  try {
    const s = localStorage.getItem(k);
    if (s !== null) return JSON.parse(s);
  } catch {}
  return fallback;
}
function save(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
}

type Toast = { text: string; tone: 'info' | 'warn' | 'good' } | null;

export default function App() {
  const [profiles, setProfiles] = useState<AvatarProfiles>(() => ({ ...DEFAULT_PROFILES, ...load(STORAGE_PROFILES_KEY, {}) }));
  const [levelIndex, setLevelIndex] = useState(0);
  // Each time a night is opened it gets a freshly generated layout.
  const [level, setLevel] = useState<PuzzleLevel>(() => generateLevel(1));

  const [completedLevelIds, setCompleted] = useState<number[]>(() => load(STORAGE_COMPLETED_KEY, []));
  const [cuddleBonusLevelIds, setCuddles] = useState<number[]>(() => load(STORAGE_CUDDLE_KEY, []));
  const [highScores, setHighScores] = useState<Record<number, number>>(() => load(STORAGE_SCORES_KEY, {}));
  const [isZenTimerEnabled, setIsZenTimerEnabled] = useState<boolean>(() => load(STORAGE_ZENTIMER_KEY, true));

  const [seconds, setSeconds] = useState(0);
  const [penalty, setPenalty] = useState(0);
  const [grumpiness, setGrumpiness] = useState(0);
  const [shakeKey, setShakeKey] = useState(0);

  const [poseIdx, setPoseIdx] = useState<Record<PersonId, number>>({ boyfriend: 0, girlfriend: 0 });
  const [drag, setDrag] = useState<{ id: PersonId; grab: { r: number; c: number }; x: number; y: number } | null>(null);
  const gridRef = useRef<SVGRectElement>(null);
  const [placedCol, setPlacedCol] = useState<Partial<Record<PersonId, number>>>({});
  const [selected, setSelected] = useState<PersonId | null>('boyfriend');

  const [toast, setToast] = useState<Toast>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const [warningModal, setWarningModal] = useState<'grumble' | 'growl' | 'bite' | null>(null);
  const [isWinModalOpen, setIsWinModalOpen] = useState(false);
  const [isCuddleBonus, setIsCuddleBonus] = useState(false);
  const [lastWinScore, setLastWinScore] = useState<LevelScore>({
    basePoints: 1000, speedBonus: 0, cuddleBonus: 0, penaltyPoints: 0, totalPoints: 0, timeSeconds: 0,
  });
  const [isNewHighScore, setIsNewHighScore] = useState(false);
  const [isLevelSelectOpen, setIsLevelSelectOpen] = useState(false);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [isNightLamp, setIsNightLamp] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const poses: Record<PersonId, Pose[]> = { boyfriend: level.boyfriendPoses, girlfriend: level.girlfriendPoses };
  const currentPose = (id: PersonId) => poses[id][poseIdx[id]];
  const names: Record<PersonId, string> = { boyfriend: profiles.boyfriendName, girlfriend: profiles.girlfriendName };
  const photos = {
    boyfriend: profiles.boyfriendPhoto || DEFAULT_PROFILES.boyfriendPhoto!,
    girlfriend: profiles.girlfriendPhoto || DEFAULT_PROFILES.girlfriendPhoto!,
    dog: profiles.dogPhoto || DEFAULT_PROFILES.dogPhoto!,
  };

  const placed: Partial<Record<PersonId, PlacedPerson>> = {};
  IDS.forEach((id) => {
    if (placedCol[id] !== undefined) placed[id] = { pose: currentPose(id), col: placedCol[id]! };
  });

  const showToast = (text: string, tone: 'info' | 'warn' | 'good' = 'info') => {
    setToast({ text, tone });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  };

  // Score
  const targetSeconds = level.targetZenSeconds;
  const speedBonus = Math.max(100, Math.round(1500 * Math.max(0.1, 1 - seconds / (targetSeconds * 2.5))));
  const liveScore = Math.max(0, 1000 + speedBonus - penalty);

  useEffect(() => {
    if (isWinModalOpen) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [isWinModalOpen, levelIndex]);

  /** fresh=false keeps the current layout (Restart); otherwise a new one is generated. */
  const loadLevel = useCallback((index: number, fresh = true) => {
    const safe = Math.max(0, Math.min(PUZZLE_LEVELS.length - 1, index));
    if (fresh) setLevel((prev) => generateLevel(safe + 1, undefined, prev.id === safe + 1 ? layoutKey(prev) : undefined));
    setLevelIndex(safe);
    setSeconds(0);
    setPenalty(0);
    setGrumpiness(0);
    setPoseIdx({ boyfriend: 0, girlfriend: 0 });
    setDrag(null);
    setPlacedCol({});
    setSelected('boyfriend');
    setIsWinModalOpen(false);
    setIsCuddleBonus(false);
    setWarningModal(null);
    setToast(null);
  }, []);


  // What is in the way, for a given person
  const dogSet = useMemo(() => new Set(level.dogCells.map((c) => key(c.r, c.c))), [level]);
  const toySet = useMemo(() => new Set(level.obstacles.map((o) => key(o.r, o.c))), [level]);
  const otherSet = (id: PersonId) => {
    const other = IDS.find((x) => x !== id)!;
    const p = placed[other];
    return new Set(p ? poseCellsAt(p.pose, p.col).map((c) => key(c.r, c.c)) : []);
  };

  const clampCol = (pose: Pose, c: number) => Math.max(0, Math.min(level.cols - pose.width, c));

  const cyclePose = (id: PersonId, dir: 1 | -1) => {
    if (placed[id]) return;
    sound.playRotate();
    const n = poses[id].length;
    const next = (poseIdx[id] + dir + n) % n;
    setPoseIdx((p) => ({ ...p, [id]: next }));
    setSelected(id);
  };

  const finishNight = (newPlaced: Partial<Record<PersonId, number>>) => {
    const bf = poseCellsAt(currentPose('boyfriend'), newPlaced.boyfriend!);
    const gf = poseCellsAt(currentPose('girlfriend'), newPlaced.girlfriend!);
    const filled = dogSet.size + toySet.size + bf.length + gf.length;
    const empty = level.rows * level.cols - filled;
    if (empty > 0) {
      sound.playDogGrumble();
      showToast(
        `${empty} empty square${empty > 1 ? 's' : ''} left, and Rosie will sprawl into ${empty > 1 ? 'them' : 'it'}. Get someone out and try another pose.`,
        'warn'
      );
      return;
    }
    const cuddle = areAdjacent(bf, { r: 0, c: 0 }, gf, { r: 0, c: 0 });
    setIsCuddleBonus(cuddle);
    const cuddleBonus = cuddle ? 500 : 0;
    const totalPoints = Math.max(100, 1000 + speedBonus + cuddleBonus - penalty);
    setLastWinScore({ basePoints: 1000, speedBonus, cuddleBonus, penaltyPoints: penalty, totalPoints, timeSeconds: seconds });
    const isRecord = totalPoints > (highScores[level.id] || 0);
    setIsNewHighScore(isRecord);
    if (isRecord) {
      const hs = { ...highScores, [level.id]: totalPoints };
      setHighScores(hs);
      save(STORAGE_SCORES_KEY, hs);
    }
    const done = Array.from(new Set([...completedLevelIds, level.id]));
    setCompleted(done);
    save(STORAGE_COMPLETED_KEY, done);
    if (cuddle) {
      const c = Array.from(new Set([...cuddleBonusLevelIds, level.id]));
      setCuddles(c);
      save(STORAGE_CUDDLE_KEY, c);
    }
    sound.playWinFanfare();
    setTimeout(() => setIsWinModalOpen(true), 900);
  };

  const tuckIn = (id: PersonId, col: number) => {
    if (placed[id]) return;
    const pose = currentPose(id);
    const cells = poseCellsAt(pose, col).map((c) => key(c.r, c.c));
    const others = otherSet(id);
    if (cells.some((k) => dogSet.has(k))) {
      const g = grumpiness + 1;
      setShakeKey((k) => k + 1);
      if (g >= 3) {
        sound.playDogChomp();
        setPenalty((p) => p + 300);
        setGrumpiness(3);
        setWarningModal('bite');
      } else if (g === 2) {
        sound.playDogGrowl();
        setPenalty((p) => p + 150);
        setGrumpiness(2);
        setWarningModal('growl');
      } else {
        sound.playDogGrumble();
        setPenalty((p) => p + 100);
        setGrumpiness(1);
        showToast(`${profiles.dogName} grumbles. That's her spot!`, 'warn');
      }
      return;
    }
    if (cells.some((k) => toySet.has(k))) {
      sound.playSqueak();
      setPenalty((p) => p + 25);
      showToast('Ouch, there’s a toy there. Try another pose or spot.', 'warn');
      return;
    }
    if (cells.some((k) => others.has(k))) {
      sound.playRotate();
      showToast(`That’s ${names[id === 'boyfriend' ? 'girlfriend' : 'boyfriend']}’s spot.`, 'warn');
      return;
    }
    sound.playPop();
    const next = { ...placedCol, [id]: col };
    setPlacedCol(next);
    const other: PersonId = id === 'boyfriend' ? 'girlfriend' : 'boyfriend';
    setSelected(next[other] === undefined ? other : null);
    if (next.boyfriend !== undefined && next.girlfriend !== undefined) finishNight(next);
  };

  const getOut = (id: PersonId) => {
    sound.playPop();
    setPlacedCol((p) => {
      const n = { ...p };
      delete n[id];
      return n;
    });
    setSelected(id);
  };

  // ---- Dragging a pose from the tray onto the bed ----
  const dropInfo = (x: number, y: number, id: PersonId, grab: { r: number; c: number }) => {
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const cellPx = rect.width / level.cols;
    const pose = currentPose(id);
    // Where the top-left of the pose would be under the finger
    const left = x - (grab.c + 0.5) * cellPx;
    const top = y - (grab.r + 0.5) * cellPx;
    const overBed =
      left + pose.width * cellPx > rect.left - cellPx * 0.5 &&
      left < rect.right + cellPx * 0.5 - cellPx &&
      top < rect.bottom - cellPx * 0.5 &&
      top + pose.height * cellPx > rect.top - cellPx * 0.2;
    const col = clampCol(pose, Math.round((left - rect.left) / cellPx));
    return { cellPx, left, top, overBed, col };
  };

  // Latest handlers, so window listeners added mid-gesture never go stale.
  const latest = useRef({ dropInfo, tuckIn });
  latest.current = { dropInfo, tuckIn };

  const startDrag = (id: PersonId, grab: { r: number; c: number }, e: React.PointerEvent) => {
    sound.playRotate();
    setSelected(id);
    setDrag({ id, grab, x: e.clientX, y: e.clientY });
    const onMove = (ev: PointerEvent) => setDrag((d) => (d ? { ...d, x: ev.clientX, y: ev.clientY } : d));
    const cleanup = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };
    const onUp = (ev: PointerEvent) => {
      cleanup();
      const info = latest.current.dropInfo(ev.clientX, ev.clientY, id, grab);
      setDrag(null);
      if (info?.overBed) latest.current.tuckIn(id, info.col);
    };
    const onCancel = () => {
      cleanup();
      setDrag(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
  };

  const dragInfo = drag ? dropInfo(drag.x, drag.y, drag.id, drag.grab) : null;

  const mood = ['Sound asleep', 'Grumbling', 'Growling', 'Snapping!'][grumpiness];

  return (
    <MobileFrame
      levelNumber={level.id}
      totalLevels={PUZZLE_LEVELS.length}
      levelTitle={level.title}
      storyNote={level.storyNote}
      isNightLamp={isNightLamp}
      soundEnabled={soundEnabled}
      profiles={profiles}
      onToggleNightLamp={() => setIsNightLamp((p) => !p)}
      onToggleSound={() => {
        const next = !soundEnabled;
        setSoundEnabled(next);
        sound.enabled = next;
      }}
      onOpenLevelSelect={() => setIsLevelSelectOpen(true)}
      onRestartLevel={() => loadLevel(levelIndex, false)}
      onOpenCustomizer={() => setIsCustomizerOpen(true)}
      onPrevLevel={() => levelIndex > 0 && loadLevel(levelIndex - 1)}
      onNextLevel={() => levelIndex < PUZZLE_LEVELS.length - 1 && loadLevel(levelIndex + 1)}
    >
      <div className="px-3 pt-2 flex flex-col gap-2">
        {isZenTimerEnabled && (
          <ZenTimer
            seconds={seconds}
            speedBonus={speedBonus}
            currentScore={liveScore}
            penaltyPoints={penalty}
            isEnabled={isZenTimerEnabled}
            onToggleEnabled={() => {
              setIsZenTimerEnabled(false);
              save(STORAGE_ZENTIMER_KEY, false);
            }}
          />
        )}
        <div className="flex items-center justify-between text-xs font-semibold text-amber-950/80 px-1">
          <span>
            {profiles.dogName}: <span className={grumpiness ? 'text-orange-700' : 'text-emerald-700'}>{mood}</span>
          </span>
          <span>Fill every square to sleep</span>
        </div>
        <div className="relative">
          <Bed
            level={level}
            placed={placed}
            grumpiness={grumpiness}
            onPersonTap={getOut}
            shakeKey={shakeKey}
            gridRef={gridRef}
            dropCol={drag && dragInfo?.overBed ? { id: drag.id, col: dragInfo.col, width: currentPose(drag.id).width } : null}
          />
          {toast && (
            <div
              role="status"
              className={`absolute left-3 right-3 top-3 rounded-2xl px-3 py-2 text-sm font-semibold shadow-lg text-center ${
                toast.tone === 'warn' ? 'bg-orange-50 text-orange-900 border border-orange-200' : 'bg-white text-amber-950 border border-amber-200'
              }`}
            >
              {toast.text}
            </div>
          )}
        </div>
      </div>

      <PoseControls
        selected={selected}
        names={names}
        photos={photos}
        poses={poses}
        poseIdx={poseIdx}
        isPlaced={{ boyfriend: !!placed.boyfriend, girlfriend: !!placed.girlfriend }}
        isDragging={!!drag}
        onSelect={(id) => setSelected(id)}
        onCyclePose={cyclePose}
        onStartDrag={startDrag}
        onGetOut={getOut}
      />

      {/* The person being dragged follows the finger, at bed scale */}
      {drag && dragInfo && (
        <svg
          viewBox={`0 0 ${currentPose(drag.id).width * S} ${currentPose(drag.id).height * S}`}
          style={{
            position: 'fixed',
            left: dragInfo.left,
            top: dragInfo.top - 12,
            width: currentPose(drag.id).width * dragInfo.cellPx,
            height: currentPose(drag.id).height * dragInfo.cellPx,
            pointerEvents: 'none',
            zIndex: 60,
            overflow: 'visible',
            filter: 'drop-shadow(0 10px 12px rgba(60,30,10,0.35))',
          }}
        >
          <PersonFigure pose={currentPose(drag.id)} who={drag.id} sleeping={false} />
        </svg>
      )}

      <DogWarningModal
        isOpen={warningModal !== null}
        type={warningModal || 'growl'}
        profiles={profiles}
        onClose={() => setWarningModal(null)}
        onApologize={() => {
          sound.playSnore();
          setGrumpiness(1);
          setWarningModal(null);
        }}
        onCleanPee={() => setWarningModal(null)}
      />

      <AvatarCustomizer
        isOpen={isCustomizerOpen}
        profiles={profiles}
        onUpdateProfiles={(updated) => {
          setProfiles(updated);
          save(STORAGE_PROFILES_KEY, updated);
        }}
        onClose={() => setIsCustomizerOpen(false)}
      />

      <WinModal
        isOpen={isWinModalOpen}
        levelId={level.id}
        levelTitle={level.title}
        isCuddleBonus={isCuddleBonus}
        profiles={profiles}
        timeSeconds={lastWinScore.timeSeconds}
        score={lastWinScore}
        isNewHighScore={isNewHighScore}
        hasNextLevel={levelIndex < PUZZLE_LEVELS.length - 1}
        onNextLevel={() => loadLevel(levelIndex + 1)}
        onReplayLevel={() => loadLevel(levelIndex)}
        onOpenLevelSelect={() => {
          setIsWinModalOpen(false);
          setIsLevelSelectOpen(true);
        }}
      />

      <LevelSelectModal
        isOpen={isLevelSelectOpen}
        levels={PUZZLE_LEVELS}
        currentLevelId={level.id}
        completedLevelIds={completedLevelIds}
        cuddleBonusLevelIds={cuddleBonusLevelIds}
        onSelectLevel={(id) => {
          const idx = PUZZLE_LEVELS.findIndex((l) => l.id === id);
          if (idx !== -1) loadLevel(idx);
        }}
        onClose={() => setIsLevelSelectOpen(false)}
      />
    </MobileFrame>
  );
}
