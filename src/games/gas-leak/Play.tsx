import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ExitButton } from '../../shared/ExitButton';
import { LEVELS } from './levels';
import {
  COLS,
  COUNTDOWN_S,
  DC,
  DR,
  PRESSURE_LIMIT,
  ROWS,
  acCell,
  canPlace,
  dangerCells,
  parSeconds,
  solidGrid,
  startLive,
  stepLive,
  tickMs,
  windField,
  type Cell,
  type Dir,
  type Fan,
  type LiveState,
  type Strength,
} from './sim';
import { Bentzi, Boom, CELL, CeilingFan, Defs, DirIcon, ExitWhoosh, FanSprite, FurniturePiece, GasPuff, Room, VB_H, VB_W, WindArrow, X0, Y0, cx, cy } from './art';
import { sfx, startHiss, stopHiss } from './sound';

type Phase = 'countdown' | 'flowing' | 'pooling' | 'won' | 'boom';
const POOL_MS = 85;
/** How many recent trail cells stay visible as lingering gas. */
const TRAIL_SHOWN = 40;

/** 3 stars at par (+1.5 s), 2 stars within +5 s, otherwise 1. */
export function starsFor(seconds: number, par: number): number {
  if (seconds <= par + 1.5) return 3;
  if (seconds <= par + 5) return 2;
  return 1;
}

export interface PlayProps {
  levelIdx: number;
  best: number;
  bestTime: number | null;
  muted: boolean;
  toggleMute: () => void;
  onExit: () => void;
  onCleared: (levelId: number, seconds: number, stars: number) => void;
  onNext: () => void;
  onMenu: () => void;
}

export function Play({ levelIdx, best, bestTime, muted, toggleMute, onExit, onCleared, onNext, onMenu }: PlayProps) {
  const level = LEVELS[levelIdx];
  const solid = useMemo(() => solidGrid(level), [level]);
  const danger = useMemo(() => dangerCells(level, solid), [level, solid]);
  const par = useMemo(() => parSeconds(level), [level]);
  const [fans, setFans] = useState<Fan[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>('countdown');
  const [live, setLive] = useState<LiveState>(() => startLive(level));
  const [count, setCount] = useState(COUNTDOWN_S);
  const [elapsed, setElapsed] = useState(0);
  const [pool, setPool] = useState<Cell[][]>([]);
  const [poolStep, setPoolStep] = useState(0);
  const [result, setResult] = useState<{ seconds: number; stars: number; newBest: boolean } | null>(null);
  const [run, setRun] = useState(0); // bumps on retry
  const svgRef = useRef<SVGSVGElement>(null);
  const cb = useRef({ onCleared, bestTime });
  cb.current = { onCleared, bestTime };

  // The game loop reads these refs so fan edits affect the very next tick.
  const fansRef = useRef(fans);
  fansRef.current = fans;
  const liveRef = useRef(live);
  const clock = useRef({ last: 0, cd: COUNTDOWN_S * 1000, acc: 0, elapsed: 0, pool: 0, shown: -1 });

  const wind = useMemo(() => windField(level, fans, solid), [level, fans, solid]);

  useEffect(() => () => stopHiss(), []);
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) stopHiss();
      else if (phase === 'flowing') startHiss();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'countdown' && phase !== 'flowing' && phase !== 'pooling') return;
    let raf = 0;
    const loop = (now: number) => {
      const k = clock.current;
      const dt = k.last ? Math.min(100, now - k.last) : 0;
      k.last = now;
      if (!document.hidden && dt > 0) {
        if (phase === 'countdown') {
          k.cd -= dt;
          const n = Math.max(0, Math.ceil(k.cd / 1000));
          setCount(n);
          if (k.cd <= 0) {
            setPhase('flowing');
            startHiss();
            sfx.leak();
            return;
          }
        } else if (phase === 'flowing') {
          k.elapsed += dt;
          k.acc += dt;
          const tenth = Math.floor(k.elapsed / 100);
          if (tenth !== k.shown) {
            k.shown = tenth;
            setElapsed(k.elapsed / 1000);
          }
          const need = tickMs(level, liveRef.current.ticks);
          if (k.acc >= need) {
            k.acc -= need;
            const ns = stepLive(level, fansRef.current, liveRef.current, solid);
            liveRef.current = ns;
            setLive(ns);
            if (ns.pressure > 0 && ns.outcome === 'flowing') sfx.pressure(ns.pressure);
            if (ns.outcome === 'win') {
              stopHiss();
              sfx.win();
              const seconds = Math.round(k.elapsed / 100) / 10;
              const stars = starsFor(seconds, par);
              const prev = cb.current.bestTime;
              setResult({ seconds, stars, newBest: prev === null || seconds < prev });
              cb.current.onCleared(level.id, seconds, stars);
              setPhase('won');
              return;
            }
            if (ns.outcome === 'boom') {
              stopHiss();
              sfx.boom();
              buzz();
              setPhase('boom');
              return;
            }
            if (ns.outcome === 'burst') {
              setPool(poolRings(ns.trail, solid, danger));
              setPoolStep(0);
              setPhase('pooling');
              return;
            }
          }
        } else {
          k.pool += dt;
          if (k.pool >= POOL_MS) {
            k.pool -= POOL_MS;
            setPoolStep((s) => s + 1);
          }
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      clock.current.last = 0;
    };
    // run: restart the loop after a retry
  }, [phase, run, level, solid, danger, par]);

  useEffect(() => {
    if (phase === 'pooling' && poolStep >= pool.length) {
      stopHiss();
      sfx.boom();
      buzz();
      setPhase('boom');
    }
  }, [phase, poolStep, pool.length]);

  const canEdit = phase === 'countdown' || phase === 'flowing';
  const fansLeft = level.fans - fans.length;

  const onBoardTap = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!canEdit) return;
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
    const idx = fans.findIndex((f) => f.r === r && f.c === c);
    if (idx >= 0) {
      if (sel === idx) rotate(idx);
      else {
        setSel(idx);
        sfx.turn();
      }
      return;
    }
    if (!canPlace(level, r, c, solid) || fansLeft <= 0) {
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

  const rotate = (idx: number) => {
    setFans((fs) => fs.map((f, i) => (i === idx ? { ...f, dir: ((f.dir + 1) % 4) as Dir } : f)));
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

  const retry = () => {
    stopHiss();
    const st = startLive(level);
    liveRef.current = st;
    clock.current = { last: 0, cd: COUNTDOWN_S * 1000, acc: 0, elapsed: 0, pool: 0, shown: -1 };
    setLive(st);
    setFans([]);
    setSel(null);
    setCount(COUNTDOWN_S);
    setElapsed(0);
    setPool([]);
    setPoolStep(0);
    setResult(null);
    setPhase('countdown');
    setRun((n) => n + 1);
  };

  const selFan = canEdit && sel !== null ? fans[sel] : null;
  const head = live.head;
  const pressure = live.outcome === 'flowing' ? live.pressure : 0;
  // Lingering gas: the most recent trail cells, each drawn once.
  const trail = useMemo(() => {
    const seen = new Set<number>();
    const out: { p: Cell; i: number }[] = [];
    for (let i = live.trail.length - 2; i >= 0 && out.length < TRAIL_SHOWN; i--) {
      const p = live.trail[i];
      const key = p.r * COLS + p.c;
      if (seen.has(key) || (p.r === head.r && p.c === head.c)) continue;
      seen.add(key);
      out.push({ p, i });
    }
    return out.reverse();
  }, [live.trail, head.r, head.c]);
  const poolShown = pool.slice(0, poolStep).flat();
  const nearBentzi = Math.abs(head.r - level.bentzi.r) + Math.abs(head.c - level.bentzi.c) <= 3;
  const mood = phase === 'boom' ? 'boom' : phase === 'won' ? 'relieved' : phase === 'pooling' || (phase === 'flowing' && (nearBentzi || pressure >= 3)) ? 'worried' : 'chill';
  const leaking = phase !== 'countdown';
  const headMs = Math.min(900, tickMs(level, live.ticks));
  const seeping = leaking && live.ticks < 3 && live.trail.length === 1;

  // Rosie naps on the sofa cell furthest from Bentzi.
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
      <div className="gl-top">
        <ExitButton onExit={onExit} className="gl-exit" />
        <div className="gl-top-title">
          <span className="gl-lvl">LEVEL {level.id}</span> {level.name}
        </div>
        <button className="gl-mute" onClick={toggleMute} aria-label={muted ? 'Sound on' : 'Mute'}>
          {muted ? '🔇' : '🔊'}
        </button>
      </div>
      <div className="gl-board-wrap">
        <svg ref={svgRef} viewBox={`0 0 ${VB_W} ${VB_H}`} className="gl-board" style={{ aspectRatio: `${VB_W} / ${VB_H}` }} onPointerDown={onBoardTap}>
          <Defs />
          <Room open={level.open} source={level.source} acOn={!!level.ac} />
          {danger.map((d) => (
            <circle key={`${d.r},${d.c}`} cx={cx(d.c)} cy={cy(d.r)} r={CELL * 0.62} fill="url(#gl-danger)" />
          ))}
          {canEdit &&
            wind.map((row, r) =>
              row.map((w, c) =>
                solid[r][c] ? null : (
                  <g key={`${r},${c}`} opacity={phase === 'flowing' ? 0.6 : 1}>
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
          {level.ac && <FanSprite r={acCell().r} c={acCell().c} dir={level.ac.dir} s={level.ac.s} fixed spinning />}
          {trail.map(({ p, i }, n) => (
            <g key={`t${p.r},${p.c}`} opacity={0.45 + (0.5 * (n + 1)) / trail.length}>
              <GasPuff r={p.r} c={p.c} k={i} />
            </g>
          ))}
          {poolShown.map((p, i) => (
            <g key={`p${i}`}>
              <GasPuff r={p.r} c={p.c} k={i} />
            </g>
          ))}
          {fans.map((f, i) => (
            <g key={i}>
              <FanSprite {...f} selected={i === sel && canEdit} spinning />
            </g>
          ))}
          {leaking && phase !== 'won' && (
            <g className="gl-head" style={{ transform: `translate(${cx(head.c) - cx(0)}px, ${cy(head.r) - cy(0)}px)`, transition: `transform ${headMs}ms linear` }}>
              <g className={pressure > 0 ? 'gl-pressure' : ''} style={{ transformOrigin: `${cx(0)}px ${cy(0)}px`, transform: seeping ? `scale(${0.5 + live.ticks * 0.25})` : undefined }}>
                <GasPuff r={0} c={0} k={0} big />
              </g>
            </g>
          )}
          {phase === 'won' && live.exit && <ExitWhoosh r={head.r} />}
          {level.ceilingFans.map((f, i) => (
            <g key={i}>
              <CeilingFan r={f.r} c={f.c} />
            </g>
          ))}
          {phase === 'boom' && <Boom r={level.bentzi.r} c={level.bentzi.c} />}
        </svg>
        {phase === 'countdown' && (
          <div className="gl-countdown" key={count}>
            <div className="gl-count">{count > 0 ? count : 'GAS!'}</div>
            <div className="gl-count-tip">{level.tip}</div>
          </div>
        )}
        {phase === 'won' && result && (
          <div className="gl-card gl-card-low gl-card-win">
            <div className="gl-card-title gl-good">AIRED OUT!</div>
            <div className="gl-stars" aria-label={`${result.stars} stars`}>
              {[1, 2, 3].map((n) => (
                <span key={n} className={n <= result.stars ? 'on' : ''}>
                  ★
                </span>
              ))}
            </div>
            <div className="gl-text">
              Time <b>{result.seconds.toFixed(1)}s</b> {result.newBest ? '· new best!' : bestTime !== null ? `· best ${bestTime.toFixed(1)}s` : ''}
            </div>
            <div className="gl-text gl-small">
              Levels cleared: <b>{Math.max(best, level.id)}</b> · 3★ under {(par + 1.5).toFixed(1)}s
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
              {live.outcome === 'boom' ? 'The gas reached Bentzi and his joint.' : 'The gas got stuck, filled the room and found his joint.'}
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
        {selFan ? (
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
          <div className={`gl-hint ${pressure > 0 ? 'gl-warn' : ''}`}>
            {phase === 'countdown'
              ? 'Get ready! Fans can go down already.'
              : phase === 'flowing'
                ? pressure > 0
                  ? `Gas is building up! Redirect it! ${'●'.repeat(pressure)}${'○'.repeat(PRESSURE_LIMIT - pressure)}`
                  : fansLeft > 0
                    ? 'Tap the floor to place a fan. Tap a fan to aim it.'
                    : 'No fans left. Tap a fan to re-aim it.'
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
          <div className="gl-timer" aria-label="Time">
            ⏱ {elapsed.toFixed(1)}s
          </div>
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

/** Rings of cells the pooled gas spreads over (breadth-first from its trail) until it reaches Bentzi. */
function poolRings(trail: Cell[], solid: boolean[][], danger: Cell[]): Cell[][] {
  const seen = new Set(trail.map((p) => p.r * COLS + p.c));
  let frontier = [trail[trail.length - 1]];
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
