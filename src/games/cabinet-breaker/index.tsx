import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { GameProps } from '../../shared/types';
import { ExitButton } from '../../shared/ExitButton';
import { getHighScore, load, save, submitScore } from '../../shared/storage';
import { Engine, type Hud } from './engine';
import { levelDef } from './levels';
import { meta } from './meta';

type Screen = 'start' | 'play' | 'clear' | 'over';

const CSS = `
.g-cabinet-breaker { -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; font-family: "Fredoka", "Baloo 2", system-ui, sans-serif; }
.g-cabinet-breaker .cb-card {
  background: #fff8ea;
  border: 3px solid #2b1d14;
  border-radius: 18px;
  box-shadow: 0 6px 0 #2b1d14, 0 18px 40px rgba(0,0,0,.35);
  color: #2b1d14;
}
.g-cabinet-breaker .cb-btn {
  border: 3px solid #2b1d14; border-radius: 14px; font-weight: 700;
  box-shadow: 0 4px 0 #2b1d14; transition: transform .06s, box-shadow .06s;
}
.g-cabinet-breaker .cb-btn:active { transform: translateY(3px); box-shadow: 0 1px 0 #2b1d14; }
.g-cabinet-breaker .cb-hud { text-shadow: 0 2px 0 rgba(0,0,0,.35); }
@keyframes cb-pop { 0% { transform: scale(.7); opacity: 0 } 70% { transform: scale(1.04) } 100% { transform: scale(1); opacity: 1 } }
.g-cabinet-breaker .cb-pop { animation: cb-pop .28s ease-out both; }
`;

function Lemon({ dim = false }: { dim?: boolean; key?: React.Key }) {
  return (
    <svg width="18" height="15" viewBox="0 0 18 15" style={{ opacity: dim ? 0.25 : 1 }} aria-hidden>
      <ellipse cx="9" cy="8" rx="7.6" ry="6" fill="#ffd92e" stroke="#7a4f00" strokeWidth="1.2" />
      <ellipse cx="16.6" cy="8" rx="1.3" ry="1" fill="#e0a300" />
      <ellipse cx="14" cy="2.6" rx="2.8" ry="1.3" fill="#4c9a3a" transform="rotate(-30 14 2.6)" />
      <ellipse cx="6.5" cy="5.5" rx="2" ry="1.1" fill="#fff" opacity=".7" />
    </svg>
  );
}

export default function Game({ onExit }: GameProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [screen, setScreen] = useState<Screen>('start');
  const screenRef = useRef<Screen>('start');
  const [hud, setHud] = useState<Hud>({ score: 0, lives: 3, level: 0 });
  const [best, setBest] = useState(() => getHighScore(meta.id));
  const [newBest, setNewBest] = useState(false);
  const [bonus, setBonus] = useState(0);
  const [muted, setMuted] = useState(() => load<boolean>(meta.id, 'muted', false));
  const [paused, setPaused] = useState(false);
  const [board, setBoard] = useState({ w: 360, h: 700, scale: 1 });

  const go = (s: Screen) => {
    screenRef.current = s;
    setScreen(s);
  };

  // Fonts for the cartoon UI.
  useEffect(() => {
    const id = 'cb-font-fredoka';
    if (!document.getElementById(id)) {
      const l = document.createElement('link');
      l.id = id;
      l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&display=swap';
      document.head.appendChild(l);
    }
  }, []);

  useLayoutEffect(() => {
    const canvas = canvasRef.current!;
    const eng = new Engine(canvas, {
      onHud: (h) => setHud(h),
      onClear: (b) => {
        setBonus(b);
        const nb = submitScore(meta.id, eng.sim.score);
        setNewBest(nb);
        setBest(getHighScore(meta.id));
        window.setTimeout(() => go('clear'), 700);
      },
      onOver: () => {
        const nb = submitScore(meta.id, eng.sim.score);
        setNewBest(nb);
        setBest(getHighScore(meta.id));
        window.setTimeout(() => go('over'), 900);
      },
    });
    eng.sfx.muted = muted;
    engineRef.current = eng;
    // Test hook for automated playtests only.
    if (window.location.search.includes('cbdebug')) (window as unknown as { __cb: Engine }).__cb = eng;
    const fit = () => {
      const w = wrapRef.current!;
      setBoard(eng.layout(w.clientWidth, w.clientHeight));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrapRef.current!);
    // Draw the idle scene behind the start card.
    eng.render();
    return () => {
      ro.disconnect();
      eng.stop();
      eng.sfx.suspend();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pause when the tab is hidden.
  useEffect(() => {
    const onVis = () => {
      if (document.hidden && screenRef.current === 'play') {
        engineRef.current?.pause();
        setPaused(true);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const play = useCallback(() => {
    const eng = engineRef.current!;
    eng.sfx.unlock();
    setNewBest(false);
    eng.newGame();
    go('play');
  }, []);

  const next = useCallback(() => {
    const eng = engineRef.current!;
    eng.sfx.unlock();
    setNewBest(false);
    eng.nextLevel();
    go('play');
  }, []);

  const toggleMute = () => {
    const m = !muted;
    setMuted(m);
    save(meta.id, 'muted', m);
    if (engineRef.current) engineRef.current.sfx.muted = m;
  };

  const onDown = (e: React.PointerEvent) => {
    if (screenRef.current !== 'play') return;
    const eng = engineRef.current!;
    if (paused) {
      eng.resume();
      setPaused(false);
      return;
    }
    eng.sfx.unlock();
    eng.pointer(e.clientX);
  };
  const onMove = (e: React.PointerEvent) => {
    if (screenRef.current !== 'play' || paused) return;
    if (e.pointerType === 'mouse' || e.buttons || e.pressure > 0) engineRef.current!.pointer(e.clientX);
  };
  const onUp = () => {
    if (screenRef.current !== 'play' || paused) return;
    engineRef.current!.release();
  };

  const hudH = Math.round(58 * board.scale);
  const level = levelDef(hud.level);

  return (
    <div
      className="g-cabinet-breaker fixed inset-0 select-none overflow-hidden"
      style={{
        background: 'repeating-linear-gradient(0deg,#e9dcc2 0 14px,#dccbab 14px 15px), #e9dcc2',
        touchAction: 'none',
      }}
    >
      <style>{CSS}</style>
      <div
        ref={wrapRef}
        className="absolute inset-0 flex items-center justify-center"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="relative" style={{ width: board.w, height: board.h }}>
          <canvas ref={canvasRef} className="block" />
          {/* HUD on the crown moulding */}
          <div className="cb-hud absolute left-0 right-0 top-0 flex items-center justify-between px-2 text-white" style={{ height: hudH }}>
            <div className="flex items-center gap-2" onPointerDown={(e) => e.stopPropagation()}>
              <ExitButton
                onExit={onExit}
                className="!font-sans !text-[12px] !font-bold !rounded-lg !bg-[#fff8ea] !text-[#2b1d14] !border-[#2b1d14] shadow-[0_3px_0_#1d1410]"
              />
            </div>
            <div className="flex flex-col items-center leading-none">
              <div className="text-[22px] font-bold tabular-nums">{hud.score}</div>
              <div className="text-[11px] opacity-85 mt-0.5">
                BEST {Math.max(best, hud.score)} · LV {hud.level + 1}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5" aria-label={`${hud.lives} lives`}>
                {[0, 1, 2].map((i) => (
                  <Lemon key={i} dim={i >= hud.lives} />
                ))}
              </div>
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={toggleMute}
                aria-label={muted ? 'Sound on' : 'Mute'}
                className="w-8 h-8 rounded-lg bg-[#fff8ea] text-[#2b1d14] border-2 border-[#2b1d14] flex items-center justify-center text-[15px] shadow-[0_3px_0_#1d1410]"
              >
                {muted ? '🔇' : '🔊'}
              </button>
            </div>
          </div>

          {paused && screen === 'play' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/35">
              <div className="cb-card cb-pop px-8 py-6 text-center">
                <div className="text-[26px] font-bold">Paused</div>
                <div className="text-[15px] mt-1">Tap anywhere to keep smashing</div>
              </div>
            </div>
          )}

          {screen === 'start' && (
            <Overlay>
              <div className="text-[13px] font-semibold tracking-wide text-[#2c7c78]">ROSIE'S KITCHEN</div>
              <h1 className="text-[34px] font-bold leading-none mt-1">Cabinet Breaker</h1>
              <p className="text-[16px] mt-3 leading-snug">
                Drag the cutting board, bounce the lemon and smash every dish, can, pot and pan off the shelves.
                Squish a slug or a speedy cockroach for a bonus!
              </p>
              <div className="text-[15px] mt-3">
                Best: <b>{best}</b>
              </div>
              <button className="cb-btn mt-4 w-full py-3 text-[22px] bg-[#ffd23f]" onClick={play}>
                PLAY
              </button>
              <button className="cb-btn mt-3 w-full py-2 text-[16px] bg-[#fff8ea]" onClick={onExit}>
                MAP
              </button>
            </Overlay>
          )}

          {screen === 'clear' && (
            <Overlay>
              <div className="text-[13px] font-semibold tracking-wide text-[#2c7c78]">LEVEL {hud.level + 1} CLEARED</div>
              <h2 className="text-[30px] font-bold leading-none mt-1">Shelves empty!</h2>
              <div className="text-[15px] mt-2 opacity-80">“{level.name}” is in pieces.</div>
              <Stats score={hud.score} best={best} newBest={newBest} extra={`Clear bonus +${bonus}`} />
              <button className="cb-btn mt-4 w-full py-3 text-[20px] bg-[#ffd23f]" onClick={next}>
                NEXT LEVEL
              </button>
              <button className="cb-btn mt-3 w-full py-2 text-[16px] bg-[#fff8ea]" onClick={onExit}>
                MAP
              </button>
            </Overlay>
          )}

          {screen === 'over' && (
            <Overlay>
              <div className="text-[13px] font-semibold tracking-wide text-[#c0463a]">OUT OF LEMONS</div>
              <h2 className="text-[30px] font-bold leading-none mt-1">Game over</h2>
              <div className="text-[15px] mt-2 opacity-80">You reached level {hud.level + 1}.</div>
              <Stats score={hud.score} best={best} newBest={newBest} />
              <button className="cb-btn mt-4 w-full py-3 text-[20px] bg-[#ffd23f]" onClick={play}>
                RETRY
              </button>
              <button className="cb-btn mt-3 w-full py-2 text-[16px] bg-[#fff8ea]" onClick={onExit}>
                MAP
              </button>
            </Overlay>
          )}
        </div>
      </div>
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[rgba(30,20,10,0.35)] px-5" onPointerDown={(e) => e.stopPropagation()}>
      <div className="cb-card cb-pop w-full max-w-[330px] px-6 py-6 text-center">{children}</div>
    </div>
  );
}

function Stats({ score, best, newBest, extra }: { score: number; best: number; newBest: boolean; extra?: string }) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-2">
      <div className="rounded-xl bg-[#f3e2c4] py-2">
        <div className="text-[12px] font-semibold opacity-70">SCORE</div>
        <div className="text-[26px] font-bold tabular-nums leading-tight">{score}</div>
      </div>
      <div className="rounded-xl bg-[#f3e2c4] py-2">
        <div className="text-[12px] font-semibold opacity-70">{newBest ? 'NEW BEST!' : 'BEST'}</div>
        <div className={`text-[26px] font-bold tabular-nums leading-tight ${newBest ? 'text-[#c0463a]' : ''}`}>{best}</div>
      </div>
      {extra && <div className="col-span-2 text-[14px] font-semibold text-[#2c7c78]">{extra}</div>}
    </div>
  );
}
