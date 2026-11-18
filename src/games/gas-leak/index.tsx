import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { GameProps } from '../../shared/types';
import { ExitButton } from '../../shared/ExitButton';
import { getHighScore, load, save, submitScore } from '../../shared/storage';
import { meta } from './meta';
import { LEVELS } from './levels';
import {
  COLS,
  DC,
  DR,
  ROWS,
  acCell,
  canPlace,
  dangerCells,
  simulate,
  solidGrid,
  windField,
  type Cell,
  type Dir,
  type Fan,
  type SimResult,
  type Strength,
} from './sim';
import { Bentzi, Boom, ExitWhoosh, CELL, CeilingFan, Defs, DirIcon, FanSprite, FurniturePiece, GasPuff, Room, VB_H, VB_W, WindArrow, X0, Y0, cx, cy } from './art';
import { sfx, setMuted, startHiss, stopHiss } from './sound';
import { CSS } from './styles';

type Phase = 'edit' | 'running' | 'pooling' | 'won' | 'boom';
const STEP_MS = 140;
const POOL_MS = 85;

export default function Game({ onExit }: GameProps) {
  const [screen, setScreen] = useState<'start' | 'play' | 'done'>('start');
  const [unlocked, setUnlocked] = useState(() => Math.min(LEVELS.length, Math.max(1, load<number>(meta.id, 'unlocked', 1))));
  const [best, setBest] = useState(() => getHighScore(meta.id));
  const [levelIdx, setLevelIdx] = useState(() => Math.min(LEVELS.length, Math.max(1, load<number>(meta.id, 'unlocked', 1))) - 1);
  const [muted, setMutedState] = useState(() => load<boolean>(meta.id, 'muted', false));

  useEffect(() => setMuted(muted), [muted]);
  useEffect(() => () => stopHiss(), []);

  const startLevel = (i: number) => {
    setLevelIdx(i);
    setScreen('play');
  };

  const onCleared = (n: number) => {
    if (submitScore(meta.id, n)) setBest(n);
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

function StartScreen({ onExit, unlocked, best, onPlay, muted, toggleMute }: { onExit: () => void; unlocked: number; best: number; onPlay: (i: number) => void; muted: boolean; toggleMute: () => void }) {
  return (
    <div className="gl-screen">
      <TopBar onExit={onExit} muted={muted} toggleMute={toggleMute} title="" />
      <div className="gl-center">
        <h1 className="gl-title">GAS LEAK!</h1>
        <MiniScene mood="worried" />
        <p className="gl-text">
          Gas is leaking from the kitchen and Bentzi just lit up. Place fans, aim them, set their power, then hit <b>RUN</b> to blow the gas
          out of an open window or door.
        </p>
        <button className="gl-btn gl-btn-go gl-btn-big" onClick={() => onPlay(unlocked - 1)}>
          PLAY · LEVEL {unlocked}
        </button>
        <div className="gl-levels">
          {LEVELS.map((l, i) => (
            <button key={l.id} className="gl-chip" disabled={i >= unlocked} onClick={() => onPlay(i)} aria-label={`Level ${l.id}`}>
              {i >= unlocked ? '🔒' : l.id}
            </button>
          ))}
        </div>
        <p className="gl-text gl-small">
          Best: <b>{best}</b> {best === 1 ? 'level' : 'levels'} cleared
        </p>
      </div>
    </div>
  );
}

interface PlayProps {
  levelIdx: number;
  best: number;
  muted: boolean;
  toggleMute: () => void;
  onExit: () => void;
  onCleared: (n: number) => void;
  onNext: () => void;
  onMenu: () => void;
}

function Play({ levelIdx, best, muted, toggleMute, onExit, onCleared, onNext, onMenu }: PlayProps) {
  const level = LEVELS[levelIdx];
  const solid = useMemo(() => solidGrid(level), [level]);
  const danger = useMemo(() => dangerCells(level, solid), [level, solid]);
  const [fans, setFans] = useState<Fan[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>('edit');
  const [result, setResult] = useState<SimResult | null>(null);
  const [step, setStep] = useState(0);
  const [pool, setPool] = useState<Cell[][]>([]);
  const [poolStep, setPoolStep] = useState(0);
  const [showTip, setShowTip] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);
  const hidden = useRef(false);

  const wind = useMemo(() => windField(level, fans, solid), [level, fans, solid]);

  // Pause animation while the tab is hidden.
  useEffect(() => {
    const onVis = () => {
      hidden.current = document.hidden;
      if (document.hidden) stopHiss();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Gas flowing along its path.
  useEffect(() => {
    if (phase !== 'running' || !result) return;
    const id = window.setInterval(() => {
      if (hidden.current) return;
      setStep((s) => s + 1);
    }, STEP_MS);
    return () => window.clearInterval(id);
  }, [phase, result]);

  useEffect(() => {
    if (phase !== 'running' || !result) return;
    const last = result.path.length - 1;
    if (result.outcome === 'win' && step >= last + 2) {
      stopHiss();
      sfx.win();
      setPhase('won');
      onCleared(level.id);
    } else if (result.outcome === 'boom' && step >= last) {
      stopHiss();
      sfx.boom();
      buzz();
      setPhase('boom');
    } else if ((result.outcome === 'stuck' || result.outcome === 'loop') && step >= last + 1) {
      setPool(poolRings(result.path, solid, danger));
      setPoolStep(0);
      setPhase('pooling');
    }
  }, [phase, result, step, level.id, onCleared, solid, danger]);

  // Gas pooling and filling the room.
  useEffect(() => {
    if (phase !== 'pooling') return;
    const id = window.setInterval(() => {
      if (hidden.current) return;
      setPoolStep((s) => s + 1);
    }, POOL_MS);
    return () => window.clearInterval(id);
  }, [phase]);
  useEffect(() => {
    if (phase === 'pooling' && poolStep >= pool.length) {
      stopHiss();
      sfx.boom();
      buzz();
      setPhase('boom');
    }
  }, [phase, poolStep, pool.length]);

  const fansLeft = level.fans - fans.length;

  const onBoardTap = (e: React.PointerEvent<SVGSVGElement>) => {
    if (phase !== 'edit') return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * VB_W;
    const y = ((e.clientY - rect.top) / rect.height) * VB_H;
    const c = Math.floor((x - X0) / CELL);
    const r = Math.floor((y - Y0) / CELL);
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) {
      setSel(null);
      return;
    }
    setShowTip(false);
    const idx = fans.findIndex((f) => f.r === r && f.c === c);
    if (idx >= 0) {
      if (sel === idx) {
        rotate(idx, 1);
      } else {
        setSel(idx);
        sfx.turn();
      }
      return;
    }
    if (!canPlace(level, r, c, solid)) {
      sfx.nope();
      setSel(null);
      return;
    }
    if (fansLeft <= 0) {
      sfx.nope();
      setSel(null);
      return;
    }
    // New fans point up by default, unless that faces a wall.
    const dir: Dir = r > 0 && !solid[r - 1][c] ? 0 : 3;
    setFans((fs) => [...fs, { r, c, dir, s: 1 }]);
    setSel(fans.length);
    sfx.place();
  };

  const rotate = (idx: number, by: number) => {
    setFans((fs) => fs.map((f, i) => (i === idx ? { ...f, dir: (((f.dir + by) % 4) + 4) % 4 as Dir } : f)));
    sfx.turn();
  };
  const setDir = (dir: Dir) => {
    if (sel === null) return;
    setFans((fs) => fs.map((f, i) => (i === sel ? { ...f, dir } : f)));
    sfx.turn();
  };
  const setStrength = (s: Strength) => {
    if (sel === null) return;
    setFans((fs) => fs.map((f, i) => (i === sel ? { ...f, s } : f)));
    sfx.power(s);
  };
  const removeSel = () => {
    if (sel === null) return;
    setFans((fs) => fs.filter((_, i) => i !== sel));
    setSel(null);
    sfx.remove();
  };

  const run = () => {
    if (phase !== 'edit') return;
    const res = simulate(level, fans);
    setResult(res);
    setStep(0);
    setSel(null);
    setPhase('running');
    startHiss();
  };

  const retry = () => {
    stopHiss();
    setPhase('edit');
    setResult(null);
    setStep(0);
    setPool([]);
    setPoolStep(0);
  };

  const clearAll = () => {
    setFans([]);
    setSel(null);
    sfx.remove();
  };

  const selFan = sel !== null ? fans[sel] : null;
  const shownPath = result ? result.path.slice(0, Math.min(step + 1, result.path.length)) : [];
  const head = shownPath[shownPath.length - 1];
  const poolShown = pool.slice(0, poolStep).flat();
  const nearBentzi = phase === 'running' && head && Math.abs(head.r - level.bentzi.r) + Math.abs(head.c - level.bentzi.c) <= 3;
  const mood = phase === 'boom' ? 'boom' : phase === 'won' ? 'relieved' : nearBentzi || phase === 'pooling' ? 'worried' : 'chill';
  const exiting = result?.outcome === 'win' && step > result.path.length - 1;

  // Rosie naps on the sofa cell furthest from Bentzi (when the sofa is big enough).
  const rosie = useMemo(() => {
    let bestCell: Cell | null = null;
    let bestD = 0;
    for (const f of level.furniture)
      if (f.kind === 'sofa')
        for (let r = f.r; r < f.r + f.h; r++)
          for (let c = f.c; c < f.c + f.w; c++) {
            const d = Math.abs(r - level.bentzi.r) + Math.abs(c - level.bentzi.c);
            if (d > bestD) {
              bestD = d;
              bestCell = { r, c };
            }
          }
    return bestCell;
  }, [level]);

  return (
    <div className={`gl-screen ${phase === 'boom' ? 'gl-shake' : ''}`}>
      <TopBar
        onExit={onExit}
        muted={muted}
        toggleMute={toggleMute}
        title={
          <>
            <span className="gl-lvl">LEVEL {level.id}</span> {level.name}
          </>
        }
      />
      <div className="gl-board-wrap">
        <svg ref={svgRef} viewBox={`0 0 ${VB_W} ${VB_H}`} className="gl-board" style={{ aspectRatio: `${VB_W} / ${VB_H}` }} onPointerDown={onBoardTap}>
          <Defs />
          <Room open={level.open} source={level.source} acOn={!!level.ac} />
          {danger.map((d) => (
            <circle key={`${d.r},${d.c}`} cx={cx(d.c)} cy={cy(d.r)} r={CELL * 0.62} fill="url(#gl-danger)" />
          ))}
          {phase === 'edit' &&
            wind.map((row, r) =>
              row.map((w, c) =>
                solid[r][c] ? null : (
                  <g key={`${r},${c}`}>
                    <WindArrow r={r} c={c} x={w.x} y={w.y} />
                  </g>
                ),
              ),
            )}
          {level.furniture.map((f, i) => (
            <g key={i}>
              <FurniturePiece f={f} rosie={rosie} />
            </g>
          ))}
          <Bentzi r={level.bentzi.r} c={level.bentzi.c} mood={mood} />
          {level.ac && <FanSprite r={acCell().r} c={acCell().c} dir={level.ac.dir} s={level.ac.s} fixed spinning={phase === 'running'} />}
          {shownPath.map((p, i) => (
            <g key={`g${i}`}>
              <GasPuff r={p.r} c={p.c} k={i} big={i === shownPath.length - 1} />
            </g>
          ))}
          {poolShown.map((p, i) => (
            <g key={`p${i}`}>
              <GasPuff r={p.r} c={p.c} k={i} />
            </g>
          ))}
          {fans.map((f, i) => (
            <g key={i}>
              <FanSprite {...f} selected={i === sel && phase === 'edit'} spinning={phase === 'running' || phase === 'pooling'} />
            </g>
          ))}
          {exiting && head && <ExitWhoosh r={head.r} />}
          {level.ceilingFans.map((f, i) => (
            <g key={i}>
              <CeilingFan r={f.r} c={f.c} />
            </g>
          ))}
          {phase === 'boom' && <Boom r={level.bentzi.r} c={level.bentzi.c} />}
        </svg>
        {showTip && phase === 'edit' && (
          <div className="gl-tip" onClick={() => setShowTip(false)}>
            {level.tip}
          </div>
        )}
        {phase === 'won' && (
          <div className="gl-card gl-card-low gl-card-win">
            <div className="gl-card-title gl-good">AIRED OUT!</div>
            <div className="gl-text">
              Level {level.id} cleared{fansLeft > 0 ? ` with ${fansLeft} fan${fansLeft > 1 ? 's' : ''} to spare` : ''}.
            </div>
            <div className="gl-text gl-small">
              Score: <b>{level.id}</b> · Best: <b>{Math.max(best, level.id)}</b>
            </div>
            <div className="gl-row">
              <button className="gl-btn gl-btn-go" onClick={onNext}>
                {levelIdx + 1 < LEVELS.length ? 'NEXT ▶' : 'FINISH'}
              </button>
              <button className="gl-btn" onClick={retry}>
                RETRY
              </button>
              <button className="gl-btn" onClick={onExit}>
                MAP
              </button>
            </div>
          </div>
        )}
        {phase === 'boom' && (
          <div className="gl-card gl-card-low">
            <div className="gl-text">
              {result?.outcome === 'boom'
                ? 'The gas reached Bentzi and his joint.'
                : result?.outcome === 'loop'
                  ? 'The gas went round in circles and filled the room.'
                  : 'The gas got stuck and filled the room.'}
            </div>
            <div className="gl-text gl-small">
              Level {level.id} · Best: <b>{best}</b> {best === 1 ? 'level' : 'levels'} cleared
            </div>
            <div className="gl-row">
              <button className="gl-btn gl-btn-go" onClick={retry}>
                RETRY
              </button>
              <button className="gl-btn" onClick={onMenu}>
                LEVELS
              </button>
              <button className="gl-btn" onClick={onExit}>
                MAP
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="gl-panel">
        {phase === 'edit' && selFan ? (
          <div className="gl-controls">
            <div className="gl-group">
              <span className="gl-label">AIM</span>
              {([0, 1, 2, 3] as Dir[]).map((d) => (
                <button key={d} className={`gl-ctl ${selFan.dir === d ? 'on' : ''}`} onClick={() => setDir(d)} aria-label={['Up', 'Right', 'Down', 'Left'][d]}>
                  <DirIcon dir={d} />
                </button>
              ))}
            </div>
            <div className="gl-group">
              <span className="gl-label">POWER</span>
              {([1, 2, 3] as Strength[]).map((s) => (
                <button key={s} className={`gl-ctl gl-pow ${selFan.s === s ? 'on' : ''}`} onClick={() => setStrength(s)}>
                  {s}
                </button>
              ))}
              <button className="gl-ctl gl-del" onClick={removeSel} aria-label="Remove fan">
                ✕
              </button>
            </div>
          </div>
        ) : (
          <div className="gl-hint">
            {phase === 'edit'
              ? fansLeft > 0
                ? 'Tap the floor to place a fan. Tap a fan to aim it.'
                : 'No fans left. Tap a fan to change it, then RUN.'
              : phase === 'running'
                ? 'Here it comes…'
                : phase === 'pooling'
                  ? 'Uh oh…'
                  : ''}
          </div>
        )}
        <div className="gl-bottom">
          <div className="gl-supply" aria-label={`${fansLeft} fans left`}>
            {Array.from({ length: level.fans }, (_, i) => (
              <span key={i} className={`gl-fan-dot ${i < fansLeft ? '' : 'used'}`}>
                <svg viewBox="-14 -14 28 28" width="22" height="22">
                  <circle r="12" fill="#f7fbfc" stroke="#1f6f7a" strokeWidth="2.5" />
                  {[0, 120, 240].map((a) => (
                    <ellipse key={a} rx="3.4" ry="7" cy="-4.5" fill="#7fc8d6" transform={`rotate(${a})`} />
                  ))}
                  <circle r="2.4" fill="#1f6f7a" />
                </svg>
              </span>
            ))}
          </div>
          <button className="gl-btn gl-btn-small" onClick={clearAll} disabled={phase !== 'edit' || fans.length === 0}>
            CLEAR
          </button>
          <button className="gl-btn gl-btn-run" onClick={run} disabled={phase !== 'edit'}>
            RUN ▶
          </button>
        </div>
      </div>
    </div>
  );
}

/** Short rumble on phones that support it. */
function buzz() {
  try {
    navigator.vibrate?.([80, 40, 160]);
  } catch {}
}

/** Rings of cells the pooled gas spreads over (breadth-first from where it got stuck) until it reaches Bentzi. */
function poolRings(path: Cell[], solid: boolean[][], danger: Cell[]): Cell[][] {
  const seen = new Set(path.map((p) => p.r * COLS + p.c));
  let frontier = [path[path.length - 1]];
  const rings: Cell[][] = [];
  const isDanger = (p: Cell) => danger.some((d) => d.r === p.r && d.c === p.c);
  if (danger.length === 0) return rings;
  for (let guard = 0; guard < 40 && frontier.length; guard++) {
    const next: Cell[] = [];
    for (const p of frontier)
      for (let d = 0; d < 4; d++) {
        const r = p.r + DR[d];
        const c = p.c + DC[d];
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS || solid[r][c] || seen.has(r * COLS + c)) continue;
        seen.add(r * COLS + c);
        next.push({ r, c });
      }
    if (!next.length) break;
    rings.push(next);
    if (next.some(isDanger)) break;
    frontier = next;
  }
  return rings;
}

