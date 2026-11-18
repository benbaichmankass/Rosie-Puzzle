import React, { useEffect, useState } from 'react';
import type { GameProps } from '../../shared/types';
import { ExitButton } from '../../shared/ExitButton';
import { getHighScore, load, save, submitScore } from '../../shared/storage';
import { meta } from './meta';
import { LEVELS } from './levels';
import { Bentzi, CELL, Defs, FanSprite, FurniturePiece, GasPuff, X0, Y0 } from './art';
import { Play } from './Play';
import { setMuted, stopHiss } from './sound';
import { CSS } from './styles';

/** Per-level records: best time (s) and best stars. */
type Records = Record<string, { t: number; stars: number }>;

export default function Game({ onExit }: GameProps) {
  const [screen, setScreen] = useState<'start' | 'play' | 'done'>('start');
  const [unlocked, setUnlocked] = useState(() => Math.min(LEVELS.length, Math.max(1, load<number>(meta.id, 'unlocked', 1))));
  const [best, setBest] = useState(() => getHighScore(meta.id));
  const [levelIdx, setLevelIdx] = useState(() => Math.min(LEVELS.length, Math.max(1, load<number>(meta.id, 'unlocked', 1))) - 1);
  const [muted, setMutedState] = useState(() => load<boolean>(meta.id, 'muted', false));
  const [records, setRecords] = useState<Records>(() => load<Records>(meta.id, 'records', {}));

  useEffect(() => setMuted(muted), [muted]);
  useEffect(() => () => stopHiss(), []);

  const startLevel = (i: number) => {
    setLevelIdx(i);
    setScreen('play');
  };

  const onCleared = (n: number, seconds: number, stars: number) => {
    if (submitScore(meta.id, n)) setBest(n);
    setRecords((rs) => {
      const old = rs[n];
      const next = { ...rs, [n]: { t: old ? Math.min(old.t, seconds) : seconds, stars: Math.max(old?.stars ?? 0, stars) } };
      save(meta.id, 'records', next);
      return next;
    });
    const next = Math.min(LEVELS.length, n + 1);
    if (next > unlocked) {
      setUnlocked(next);
      save(meta.id, 'unlocked', next);
    }
  };

  const toggleMute = () => {
    const m = !muted;
    setMutedState(m);
    save(meta.id, 'muted', m);
  };

  return (
    <div className="g-gas-leak">
      <style>{CSS}</style>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bangers&family=Fredoka:wght@500;600;700&display=swap" />
      {screen === 'start' && (
        <StartScreen
          onExit={onExit}
          unlocked={unlocked}
          best={best}
          records={records}
          onPlay={startLevel}
          muted={muted}
          toggleMute={toggleMute}
        />
      )}
      {screen === 'play' && (
        <React.Fragment key={levelIdx}>
        <Play
          levelIdx={levelIdx}
          best={best}
          bestTime={records[LEVELS[levelIdx].id]?.t ?? null}
          muted={muted}
          toggleMute={toggleMute}
          onExit={onExit}
          onCleared={onCleared}
          onNext={() => (levelIdx + 1 < LEVELS.length ? startLevel(levelIdx + 1) : setScreen('done'))}
          onMenu={() => setScreen('start')}
        />
        </React.Fragment>
      )}
      {screen === 'done' && (
        <div className="gl-screen">
          <TopBar onExit={onExit} muted={muted} toggleMute={toggleMute} title="" />
          <div className="gl-center">
            <h1 className="gl-title">ALL AIRED OUT!</h1>
            <p className="gl-text">You beat all {LEVELS.length} levels. Bentzi lives to light another one.</p>
            <MiniScene mood="relieved" />
            <p className="gl-text">
              Best: <b>{best}</b> levels
            </p>
            <div className="gl-row">
              <button className="gl-btn gl-btn-go" onClick={() => setScreen('start')}>
                LEVELS
              </button>
              <button className="gl-btn" onClick={onExit}>
                MAP
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TopBar({ onExit, muted, toggleMute, title }: { onExit: () => void; muted: boolean; toggleMute: () => void; title: React.ReactNode }) {
  return (
    <div className="gl-top">
      <ExitButton onExit={onExit} className="gl-exit" />
      <div className="gl-top-title">{title}</div>
      <button className="gl-mute" onClick={toggleMute} aria-label={muted ? 'Sound on' : 'Mute'}>
        {muted ? '🔇' : '🔊'}
      </button>
    </div>
  );
}

function MiniScene({ mood }: { mood: 'chill' | 'relieved' | 'worried' }) {
  return (
    <svg viewBox={`${X0 - 10} ${Y0 + 60} ${CELL * 5 + 20} ${CELL * 2.6}`} className="gl-mini">
      <Defs />
      <rect x={X0 - 10} y={Y0 + 60} width={CELL * 5 + 20} height={CELL * 3} fill="url(#gl-tiles)" rx="8" />
      <FurniturePiece f={{ kind: 'sofa', r: 2, c: 0, w: 3, h: 1 }} rosie={{ r: 2, c: 0 }} />
      <FurniturePiece f={{ kind: 'table', r: 3, c: 1, w: 2, h: 1 }} />
      <Bentzi r={2} c={1} mood={mood} />
      {mood !== 'relieved' &&
        [
          [2, 4],
          [3, 4],
          [2, 3],
        ].map(([r, c], i) => (
          <g key={i}>
            <GasPuff r={r} c={c} k={i} />
          </g>
        ))}
      <FanSprite r={3} c={3} dir={0} s={2} spinning />
    </svg>
  );
}

function StartScreen({ onExit, unlocked, best, records, onPlay, muted, toggleMute }: { onExit: () => void; unlocked: number; best: number; records: Records; onPlay: (i: number) => void; muted: boolean; toggleMute: () => void }) {
  const totalStars = Object.values(records).reduce((a, r) => a + r.stars, 0);
  return (
    <div className="gl-screen">
      <TopBar onExit={onExit} muted={muted} toggleMute={toggleMute} title="" />
      <div className="gl-center">
        <h1 className="gl-title">GAS LEAK!</h1>
        <MiniScene mood="worried" />
        <p className="gl-text">
          Gas is leaking from the kitchen and Bentzi just lit up! The leak starts after a 3-2-1. Tap to place fans, aim them and set their
          power while the gas flows, and blow it out of an open window or door before it reaches him.
        </p>
        <button className="gl-btn gl-btn-go gl-btn-big" onClick={() => onPlay(unlocked - 1)}>
          PLAY · LEVEL {unlocked}
        </button>
        <div className="gl-levels">
          {LEVELS.map((l, i) => (
            <button key={l.id} className="gl-chip" disabled={i >= unlocked} onClick={() => onPlay(i)} aria-label={`Level ${l.id}`}>
              {i >= unlocked ? '🔒' : l.id}
              {records[l.id] && <span className="gl-chip-stars">{'★'.repeat(records[l.id].stars)}</span>}
            </button>
          ))}
        </div>
        <p className="gl-text gl-small">
          Best: <b>{best}</b> {best === 1 ? 'level' : 'levels'} cleared · <b>{totalStars}</b>/{LEVELS.length * 3} ★
        </p>
      </div>
    </div>
  );
}

