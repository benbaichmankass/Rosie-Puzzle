import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GameProps } from '../../shared/types';
import { ExitButton } from '../../shared/ExitButton';
import { getHighScore, load, save, submitScore } from '../../shared/storage';
import { meta } from './meta';
import { CSS } from './styles';
import { CounterTop, INK, KitchenBackdrop, Loaf, P, Person, Phone, PlataSurface, Urn, WallClock, type Mood } from './art';
import { useCandle } from './useCandle';
import { dateLabel, hhmm } from './logic/hebcal';
import { isComplete, newBraid, type BraidState } from './logic/challah';
import { isLoaded } from './logic/plata';
import { newCall, rng, usedLines, type CallState } from './logic/calls';
import { GAME_MINUTES, LEVEL_SECONDS, levelParams, levelScore, type LevelParams } from './logic/levels';
import { ChallahTask } from './ChallahTask';
import { UrnTask, boilProgress, newUrn, type UrnState } from './UrnTask';
import { PlataTask, newPlata, type PlataState } from './PlataTask';
import { PhoneCall } from './PhoneCall';
import { setMuted, sfx, startBoil, stopBoil } from './sfx';

type Screen = 'start' | 'play' | 'clear' | 'over';
type TaskId = 'challah' | 'urn' | 'plata' | 'mom';
const TASKS: { id: TaskId; name: string }[] = [
  { id: 'challah', name: 'Challah' },
  { id: 'urn', name: 'Urn' },
  { id: 'plata', name: 'Plata' },
  { id: 'mom', name: 'Mom' },
];

interface Calls {
  done: number;
  active: CallState | null;
  ringing: boolean;
  nextRing: number;
  /** Earliest time Mom may call again (used to call early once everything else is done). */
  earliest: number;
  used: number[];
}

interface LevelState {
  p: LevelParams;
  braid: BraidState;
  urn: UrnState;
  plata: PlataState;
  calls: Calls;
}

function newLevel(level: number): LevelState {
  const p = levelParams(level);
  return {
    p,
    braid: newBraid(p.strands, p.crosses),
    urn: newUrn(),
    plata: newPlata(),
    calls: { done: 0, active: null, ringing: false, nextRing: p.ringAt[0], earliest: 2, used: [] },
  };
}

function doneMap(lv: LevelState): Record<TaskId, boolean> {
  return {
    challah: isComplete(lv.braid),
    urn: lv.urn.boiled,
    plata: lv.plata.plugged && isLoaded(lv.plata.placed),
    mom: lv.calls.done >= lv.p.calls,
  };
}

const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Bowlby+One&family=Fredoka:wght@500;600;700&display=swap';

export default function Game({ onExit }: GameProps) {
  const candle = useCandle();
  const [screen, setScreen] = useState<Screen>('start');
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => getHighScore(meta.id));
  const [muted, setMutedState] = useState(() => load<boolean>(meta.id, 'muted', false));
  const [lv, setLv] = useState<LevelState>(() => newLevel(1));
  const [t, setT] = useState(0);
  const tRef = useRef(0);
  const [open, setOpen] = useState<TaskId | null>(null);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<{ pts: number; secondsLeft: number; newBest: boolean; total: number } | null>(null);
  const randRef = useRef(rng(Date.now() & 0xffffffff));
  const lastRing = useRef(-10);
  const lastTick = useRef(0);

  useEffect(() => setMuted(muted), [muted]);
  useEffect(() => () => stopBoil(), []);

  // Clock: requestAnimationFrame while playing.
  useEffect(() => {
    if (screen !== 'play' || paused) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      tRef.current += dt;
      setT(tRef.current);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [screen, paused]);

  // Pause when the tab is hidden.
  useEffect(() => {
    const onVis = () => {
      if (document.hidden && screen === 'play') {
        setPaused(true);
        stopBoil();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [screen]);

  const done = doneMap(lv);
  const doneCount = Object.values(done).filter(Boolean).length;

  // Game logic tick.
  useEffect(() => {
    if (screen !== 'play' || paused) return;
    // Urn finishes boiling.
    if (lv.urn.on && !lv.urn.boiled && boilProgress(lv.urn, t) >= 1) {
      stopBoil();
      sfx.done();
      setLv((s) => ({ ...s, urn: { ...s.urn, boiled: true } }));
      return;
    }
    // Mom calls.
    const c = lv.calls;
    if (!c.ringing && !c.active && c.done < lv.p.calls) {
      const othersDone = done.challah && done.urn && done.plata;
      if (t >= c.nextRing || (othersDone && t >= c.earliest)) {
        setLv((s) => ({ ...s, calls: { ...s.calls, ringing: true } }));
        return;
      }
    }
    if (c.ringing && t - lastRing.current > 1.4) {
      lastRing.current = t;
      sfx.ring();
    }
    // Level complete.
    if (doneCount === 4) {
      const secondsLeft = Math.max(0, LEVEL_SECONDS - t);
      const pts = levelScore(level, secondsLeft);
      const total = score + pts;
      const newBest = submitScore(meta.id, total);
      if (newBest) setBest(total);
      setScore(total);
      setResult({ pts, secondsLeft, newBest, total });
      setOpen(null);
      stopBoil();
      sfx.fanfare();
      setScreen('clear');
      return;
    }
    // Out of time.
    if (t >= LEVEL_SECONDS) {
      const newBest = submitScore(meta.id, score);
      if (newBest) setBest(score);
      setResult({ pts: 0, secondsLeft: 0, newBest, total: score });
      setOpen(null);
      stopBoil();
      sfx.lose();
      setScreen('over');
      return;
    }
    // Last-10-seconds tick.
    const sec = Math.floor(t);
    if (LEVEL_SECONDS - t <= 10 && sec !== lastTick.current) {
      lastTick.current = sec;
      sfx.tick();
    }
  }, [t, screen, paused, lv, done.challah, done.urn, done.plata, doneCount, level, score]);

  const startLevel = useCallback((n: number) => {
    setLevel(n);
    setLv(newLevel(n));
    tRef.current = 0;
    setT(0);
    lastRing.current = -10;
    lastTick.current = 0;
    setOpen(null);
    setPaused(false);
    setResult(null);
    setScreen('play');
  }, []);

  const startGame = () => {
    sfx.tap();
    setScore(0);
    startLevel(1);
  };

  const answerPhone = () => {
    if (!lv.calls.ringing) return;
    sfx.blip();
    setLv((s) => ({ ...s, calls: { ...s.calls, ringing: false, active: newCall(s.p.wrapsPerCall, randRef.current, s.calls.used) } }));
    setOpen('mom');
  };

  const hangUp = () => {
    setLv((s) => {
      const doneN = s.calls.done + 1;
      const used = s.calls.active ? [...s.calls.used, ...usedLines(s.calls.active)] : s.calls.used;
      const next = doneN < s.p.calls ? Math.max(s.p.ringAt[doneN], tRef.current + 4) : Infinity;
      return { ...s, calls: { done: doneN, active: null, ringing: false, nextRing: next, earliest: tRef.current + 1.5, used } };
    });
    setOpen(null);
  };

  const toggleMute = () => {
    const m = !muted;
    setMutedState(m);
    save(meta.id, 'muted', m);
    if (!m && lv.urn.on && !lv.urn.boiled && screen === 'play') startBoil();
  };

  const startMinutes = candle.info.minutes - GAME_MINUTES;
  const gameMinutes = startMinutes + (Math.min(t, LEVEL_SECONDS) / LEVEL_SECONDS) * GAME_MINUTES;
  const timeLeft = LEVEL_SECONDS - t;
  const alarm = screen === 'play' && timeLeft <= 10;
  const skyT = screen === 'start' ? 0.55 : screen === 'clear' || screen === 'over' ? 1 : Math.round((t / LEVEL_SECONDS) * 60) / 60;
  const mood: Mood = screen === 'clear' ? 'happy' : alarm || screen === 'over' ? 'worried' : 'calm';
  const showHint = level === 1;

  const tapStation = (id: TaskId) => {
    if (screen !== 'play') return;
    if (id === 'mom' && lv.calls.ringing) return answerPhone();
    sfx.tap();
    setOpen(id);
  };

  const statusText = (id: TaskId): string => {
    if (done[id]) return 'Done!';
    switch (id) {
      case 'challah':
        return `${lv.braid.crosses.length}/${lv.braid.target} crosses`;
      case 'urn':
        return lv.urn.on ? `Boiling ${Math.ceil(10 * (1 - boilProgress(lv.urn, t)))}s` : lv.urn.plugged ? 'Switch on' : 'Plug in';
      case 'plata':
        return lv.plata.plugged ? `${lv.plata.placed.length}/6 on` : 'Plug in';
      case 'mom':
        return lv.calls.ringing ? 'RINGING!' : lv.calls.active ? 'On a call' : `${lv.calls.done}/${lv.p.calls} calls`;
    }
  };

  const scene = useMemo(
    () => (
      <>
        <KitchenBackdrop t={skyT} lit={screen === 'clear'} />
      </>
    ),
    [skyT, screen],
  );

  return (
    <div className="g-shabbos relative w-full h-[100dvh] overflow-hidden select-none">
      <link rel="stylesheet" href={FONT_HREF} />
      <style>{CSS}</style>

      {/* Kitchen scene */}
      <svg viewBox="0 0 390 760" preserveAspectRatio="xMidYMax meet" className="absolute inset-x-0 bottom-0 w-full h-full">
        {scene}
        <WallClock x={318} y={196} r={40} minutes={screen === 'start' ? candle.info.minutes - 60 : gameMinutes} alarm={alarm} />
        <Person who="bentzi" x={248} y={352} s={0.9} mood={mood} />
        <Person who="shai" x={352} y={364} s={0.82} mood={mood} flip />
        <CounterTop />
        {/* stations on the counter */}
        <g transform="translate(52 478)">
          <rect x={-42} y={-6} width={84} height={10} rx={4} fill={P.wood} stroke={INK} strokeWidth={3} />
          <g transform="translate(0 -6)">
            {done.challah ? (
              <Loaf w={70} h={30} />
            ) : (
              <g>
                {[-10, 0, 10].map((dy, i) => (
                  <path key={i} d={`M -32 ${-4 - i * 5} Q 0 ${-12 - i * 5 + dy * 0.2} 32 ${-4 - i * 5}`} stroke={INK} strokeWidth={9} fill="none" strokeLinecap="round" />
                ))}
                {[-10, 0, 10].map((dy, i) => (
                  <path key={i} d={`M -32 ${-4 - i * 5} Q 0 ${-12 - i * 5 + dy * 0.2} 32 ${-4 - i * 5}`} stroke={P.dough} strokeWidth={5} fill="none" strokeLinecap="round" />
                ))}
              </g>
            )}
          </g>
        </g>
        <Urn x={147} y={480} s={0.6} on={lv.urn.on} boiled={lv.urn.boiled} progress={boilProgress(lv.urn, t)} />
        <g transform="translate(242 466)">
          <PlataSurface w={lv.p.plateW} on={lv.plata.plugged} placed={lv.plata.placed} unit={0.3} />
        </g>
        <Phone x={337} y={478} s={1} ringing={screen === 'play' && lv.calls.ringing} />
        {/* task cards on the island doors */}
        {TASKS.map((task, i) => {
          const x = 8 + i * 95;
          const ok = done[task.id];
          const ringing = task.id === 'mom' && lv.calls.ringing;
          return (
            <g key={task.id} onPointerDown={() => tapStation(task.id)} style={{ cursor: screen === 'play' ? 'pointer' : 'default' }}>
              <rect x={x + 4} y={518} width={80} height={66} rx={10} fill={ok ? '#bfe6c2' : ringing ? '#fff1a8' : P.cream} stroke={INK} strokeWidth={3} />
              <text x={x + 44} y={543} textAnchor="middle" className="sh-small" fill={INK} style={{ fontSize: 16 }}>
                {task.name}
              </text>
              <text x={x + 44} y={564} textAnchor="middle" className="sh-tiny" fill={ringing ? P.red : INK} style={{ fontSize: 11 }}>
                {statusText(task.id)}
              </text>
              {ok && (
                <g transform={`translate(${x + 78} 520)`}>
                  <circle r={12} fill={P.green} stroke={INK} strokeWidth={2.5} />
                  <path d="M -5 0 L -1 4 L 6 -4" stroke="#fff" strokeWidth={3} fill="none" strokeLinecap="round" />
                </g>
              )}
              {/* big tap area: the station above and the card */}
              <rect x={x} y={392} width={95} height={200} fill="transparent" />
            </g>
          );
        })}
      </svg>

      {/* HUD */}
      <div className="sh-hud absolute inset-x-0 top-0 z-20 flex items-center gap-2 px-2 pt-2 pb-1.5">
        <ExitButton
          onExit={() => {
            stopBoil();
            onExit();
          }}
          className="!bg-[#e2674f] !text-[#fdf6e7] !border-[#fdf6e7] rounded-lg"
        />
        <div className="flex-1 flex flex-col items-center leading-none">
          <div className={`sh-clock ${alarm ? 'alarm' : ''}`}>{hhmm(screen === 'start' ? startMinutes : gameMinutes)}</div>
          <div className="sh-tiny opacity-90 mt-0.5">
            🕯 {candle.info.time} · {screen === 'play' || screen === 'clear' ? `Level ${level}` : 'Tel Aviv'}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button className="sh-icon" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
      </div>
      {screen === 'play' && (
        <div className="absolute inset-x-0 top-[62px] z-20 h-[6px] bg-[#231c2b]">
          <div className="h-full" style={{ width: `${Math.max(0, (timeLeft / LEVEL_SECONDS) * 100)}%`, background: alarm ? '#ff6b5a' : '#f2d24c' }} />
        </div>
      )}

      {/* Ringing banner when a task panel is open */}
      {screen === 'play' && lv.calls.ringing && open && open !== 'mom' && (
        <button className="sh-banner absolute left-3 right-3 bottom-4 z-40 py-2 px-3 flex items-center justify-between font-bold" onClick={answerPhone}>
          <span>📱 Mom is calling!</span>
          <span className="bg-[#231c2b] text-[#fdf6e7] rounded-lg px-3 py-1">Answer</span>
        </button>
      )}

      {/* Task sheet */}
      {screen === 'play' && open && (
        <div className="sh-sheet absolute inset-x-0 bottom-0 top-[74px] z-30 flex flex-col">
          <div className="flex items-center justify-between px-3 pt-2 pb-1">
            <div className="sh-title text-[20px]">{sheetTitle(open)}</div>
            {!(open === 'mom' && lv.calls.active) && (
              <button className="sh-icon !w-auto px-3 font-bold text-[14px]" onClick={() => setOpen(null)}>
                ✕ Counter
              </button>
            )}
          </div>
          <div className="flex-1 min-h-0 px-1 pb-2">
            {open === 'challah' && <ChallahTask braid={lv.braid} showHint={showHint} onChange={(b) => setLv((s) => ({ ...s, braid: b }))} />}
            {open === 'urn' && (
              <UrnTask
                urn={lv.urn}
                t={t}
                showHint={showHint}
                onChange={(u) => {
                  if (u.on && !lv.urn.on) startBoil();
                  setLv((s) => ({ ...s, urn: u }));
                }}
              />
            )}
            {open === 'plata' && (
              <PlataTask plata={lv.plata} plateW={lv.p.plateW} margin={lv.p.margin} showHint={showHint} onChange={(pl) => setLv((s) => ({ ...s, plata: pl }))} />
            )}
            {open === 'mom' &&
              (lv.calls.active ? (
                <PhoneCall
                  call={lv.calls.active}
                  index={lv.calls.done}
                  total={lv.p.calls}
                  rand={randRef.current}
                  onUpdate={(c) => setLv((s) => ({ ...s, calls: { ...s.calls, active: c } }))}
                  onHangUp={hangUp}
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center gap-3 px-6 text-center">
                  <div className="sh-small">{done.mom ? 'All caught up with Mom.' : 'No calls right now.'}</div>
                  <div className="sh-tiny opacity-80">
                    {done.mom ? 'She will see you tomorrow at lunch.' : `Mom will call ${lv.p.calls - lv.calls.done} more time${lv.p.calls - lv.calls.done === 1 ? '' : 's'} before Shabbat. Answer when it rings!`}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Start screen */}
      {screen === 'start' && (
        <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-[#231c2b]/40">
          <div className="sh-card w-full max-w-[360px] p-5 flex flex-col items-center gap-3 text-center">
            <div className="sh-title text-[30px] text-[#f2d24c]">
              Getting Ready
              <br />
              for Shabbos
            </div>
            <div className="text-[15px] font-semibold leading-snug">
              Braid the challah, boil the urn, load the plata and get Mom off the phone before candle lighting!
            </div>
            <div className="w-full rounded-2xl bg-[#231c2b] px-3 py-2.5">
              <div className="sh-tiny opacity-80">This week in Tel Aviv · {dateLabel(candle.info.date)}</div>
              <div className="sh-title text-[24px] text-[#f2d24c]">🕯 Candles {candle.info.time}</div>
              {candle.info.parasha && <div className="sh-tiny opacity-90">{candle.info.parasha}</div>}
              <div className={`sh-tiny mt-1 ${candle.info.source === 'hebcal' ? 'text-[#9fe0a8]' : 'text-[#ffb4a6]'}`}>{candle.note}</div>
            </div>
            <div className="sh-tiny opacity-90">The clock runs the 3 hours before candles ({hhmm(startMinutes)} → {candle.info.time}) in 60 seconds.</div>
            <div className="sh-small text-[#9fd6cf]">Best: {best}</div>
            <button className="sh-btn" onClick={startGame}>
              PLAY
            </button>
          </div>
        </div>
      )}

      {/* Level clear */}
      {screen === 'clear' && result && (
        <div className="absolute inset-x-0 top-[70px] z-40 flex justify-center p-4">
          <div className="sh-card w-full max-w-[360px] p-5 flex flex-col items-center gap-2 text-center">
            <div className="sh-title text-[30px] text-[#f2d24c]">Shabbat Shalom!</div>
            <div className="text-[15px] font-semibold">
              Level {level} done with {Math.round((result.secondsLeft / LEVEL_SECONDS) * GAME_MINUTES)} minutes to spare.
            </div>
            <div className="sh-small">+{result.pts} · Score {result.total}</div>
            <div className="sh-tiny text-[#9fd6cf]">{result.newBest ? 'New best!' : `Best: ${best}`}</div>
            <div className="flex gap-3 mt-2">
              <button className="sh-btn" onClick={() => startLevel(level + 1)}>
                NEXT
              </button>
              <button className="sh-btn alt" onClick={onExit}>
                MAP
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game over */}
      {screen === 'over' && result && (
        <div className="absolute inset-x-0 top-[70px] z-40 flex justify-center p-4">
          <div className="sh-card w-full max-w-[360px] p-5 flex flex-col items-center gap-2 text-center">
            <div className="sh-title text-[28px] text-[#ff8a7a]">Shabbat came in!</div>
            <div className="text-[15px] font-semibold">
              Still to do: {TASKS.filter((x) => !done[x.id]).map((x) => x.name).join(', ')}
            </div>
            <div className="sh-small">Score {result.total}</div>
            <div className="sh-tiny text-[#9fd6cf]">{result.newBest ? 'New best!' : `Best: ${best}`}</div>
            <div className="flex gap-3 mt-2">
              <button className="sh-btn" onClick={startGame}>
                RETRY
              </button>
              <button className="sh-btn alt" onClick={onExit}>
                MAP
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Paused */}
      {paused && screen === 'play' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#231c2b]/70">
          <div className="sh-card p-6 flex flex-col items-center gap-4">
            <div className="sh-title text-[28px]">Paused</div>
            <button
              className="sh-btn"
              onClick={() => {
                setPaused(false);
                if (lv.urn.on && !lv.urn.boiled) startBoil();
              }}
            >
              RESUME
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function sheetTitle(id: TaskId) {
  return id === 'challah' ? 'Braid the challah' : id === 'urn' ? 'Coffee urn' : id === 'plata' ? 'Load the plata' : 'Mom is on the phone';
}
