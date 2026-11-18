import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { GameProps } from '../../shared/types';
import { ExitButton } from '../../shared/ExitButton';
import { getHighScore, submitScore, load, save } from '../../shared/storage';
import { meta } from './meta';
import { Engine, type HudState, type ClearInfo } from './engine';
import { ROSIE_PENALTY } from './sim';

const ID = meta.id;

type Screen = 'start' | 'play' | 'clear' | 'over';

const CSS = `
.g-roomba-fling { font-family: 'Fredoka', 'Pixelify Sans', system-ui, sans-serif; }
.g-roomba-fling .rf-btn { font-family: inherit; font-weight: 600; border-radius: 14px; padding: 12px 22px; font-size: 18px;
  box-shadow: 0 4px 0 rgba(0,0,0,0.25); transition: transform .06s; touch-action: manipulation; }
.g-roomba-fling .rf-btn:active { transform: translateY(3px); box-shadow: 0 1px 0 rgba(0,0,0,0.25); }
.g-roomba-fling .rf-card { background: #fbf7ef; color: #3a332c; border-radius: 22px; box-shadow: 0 10px 40px rgba(0,0,0,0.35); }
@keyframes rf-pop { 0% { transform: scale(.85); opacity: 0 } 100% { transform: scale(1); opacity: 1 } }
.g-roomba-fling .rf-pop { animation: rf-pop .25s ease-out; }
`;

function Battery({ left, total }: { left: number; total: number }) {
  return (
    <div className="flex items-center gap-[3px]" aria-label={`${left} flings left`}>
      <div className="flex gap-[2px] p-[2px] rounded-[4px] border-2 border-[#e9e3d8]">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className="w-[4px] h-[12px] rounded-[1px]"
            style={{ background: i < left ? (left <= 2 ? '#f0644a' : '#6ee08f') : 'rgba(255,255,255,0.12)' }}
          />
        ))}
      </div>
      <div className="w-[3px] h-[6px] rounded-r-[1px] bg-[#e9e3d8]" />
    </div>
  );
}

export default function Game({ onExit }: GameProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [screen, setScreen] = useState<Screen>('start');
  const [hud, setHud] = useState<HudState>({ level: 1, flings: 0, budget: 8, pct: 0, run: 0, bumps: 0 });
  const [clear, setClear] = useState<ClearInfo | null>(null);
  const [best, setBest] = useState(() => getHighScore(ID));
  const [muted, setMuted] = useState(() => load<boolean>(ID, 'muted', false));
  const [newBest, setNewBest] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const eng = new Engine(canvas, {
      onHud: setHud,
      onClear: (info) => {
        const nb = submitScore(ID, info.run);
        setNewBest(nb);
        setBest(getHighScore(ID));
        setClear(info);
        setScreen('clear');
      },
      onOver: (info) => {
        const nb = submitScore(ID, info.run);
        setNewBest(nb);
        setBest(getHighScore(ID));
        setClear(info);
        setScreen('over');
      },
    });
    eng.sfx.setMuted(load<boolean>(ID, 'muted', false));
    engineRef.current = eng;
    const ro = new ResizeObserver(() => eng.resize(wrap.clientWidth, wrap.clientHeight));
    ro.observe(wrap);
    eng.resize(wrap.clientWidth, wrap.clientHeight);
    eng.newRun();
    eng.start();
    const vis = () => eng.setPaused(document.hidden);
    document.addEventListener('visibilitychange', vis);
    return () => {
      document.removeEventListener('visibilitychange', vis);
      ro.disconnect();
      eng.destroy();
    };
  }, []);

  const play = useCallback(() => {
    const e = engineRef.current!;
    e.sfx.unlock();
    e.sfx.click();
    setNewBest(false);
    if (screen === 'over') e.newRun();
    e.setActive(true);
    setScreen('play');
  }, [screen]);

  const next = useCallback(() => {
    const e = engineRef.current!;
    e.sfx.unlock();
    e.sfx.click();
    e.nextLevel();
    setScreen('play');
  }, []);

  const retry = useCallback(() => {
    const e = engineRef.current!;
    e.sfx.unlock();
    e.sfx.click();
    if (screen === 'clear') e.retryLevel();
    else e.newRun();
    e.setActive(true);
    setScreen('play');
  }, [screen]);

  const toggleMute = useCallback(() => {
    const m = !muted;
    setMuted(m);
    save(ID, 'muted', m);
    engineRef.current?.sfx.unlock();
    engineRef.current?.sfx.setMuted(m);
  }, [muted]);

  return (
    <div className="g-roomba-fling fixed inset-0 h-[100dvh] w-full flex flex-col bg-[#2e2925] text-[#f4efe6] select-none overflow-hidden" style={{ touchAction: 'none' }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600;700&display=swap" rel="stylesheet" />
      <style>{CSS}</style>

      {/* HUD */}
      <div className="flex items-center gap-2 px-3 pt-[max(8px,env(safe-area-inset-top))] pb-2 shrink-0">
        <ExitButton onExit={onExit} className="!bg-[#4a423a] !text-[#f4efe6] !border-[#f4efe6]/70 rounded-md" />
        <div className="flex-1 flex items-center justify-center gap-3 text-[14px] font-semibold">
          <span className="text-[#ffd479]">LV {hud.level}</span>
          <Battery left={Math.max(0, hud.budget - hud.flings)} total={hud.budget} />
          <span className="tabular-nums">🧹 {Math.round(hud.pct * 100)}%</span>
          {hud.bumps > 0 && <span className="tabular-nums text-[#ff8a75]" aria-label={`Rosie woken ${hud.bumps} times`}>💢{hud.bumps}</span>}
        </div>
        <div className="text-right leading-tight">
          <div className="text-[10px] opacity-70">SCORE</div>
          <div className="text-[15px] font-bold tabular-nums">{hud.run}</div>
        </div>
        <button
          onClick={toggleMute}
          aria-label={muted ? 'Sound on' : 'Mute'}
          className="w-9 h-9 rounded-full bg-[#4a423a] text-[16px] flex items-center justify-center active:translate-y-[1px]"
        >
          {muted ? '🔇' : '🔊'}
        </button>
      </div>

      <div ref={wrapRef} className="relative flex-1 min-h-0">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ touchAction: 'none' }} />

        {screen === 'start' && (
          <div className="absolute inset-0 flex items-center justify-center p-5 bg-black/35">
            <div className="rf-card rf-pop w-full max-w-[330px] p-6 text-center">
              <div className="text-[34px] font-bold leading-none text-[#2e3035]">Roomba Fling</div>
              <div className="mt-1 text-[13px] text-[#8a7f72]">Living room</div>
              <div className="mt-4 text-[16px] leading-snug">
                Drag back from the Roomba and let go to fling it. Clean as much floor as you can and reach the dock in as few flings as possible.
              </div>
              <div className="mt-2 text-[14px] font-semibold text-[#c0453a]">Don’t bump Rosie, she’s napping! Each bump costs {ROSIE_PENALTY}.</div>
              <button onClick={play} className="rf-btn mt-5 w-full bg-[#3fbf74] text-white">PLAY</button>
              <div className="mt-3 text-[13px] text-[#8a7f72]">Best: <b className="text-[#3a332c]">{best}</b></div>
            </div>
          </div>
        )}

        {(screen === 'clear' || screen === 'over') && clear && (
          <div className="absolute inset-0 flex items-center justify-center p-5 bg-black/40">
            <div className="rf-card rf-pop w-full max-w-[330px] p-6 text-center">
              <div className="text-[30px] font-bold leading-none" style={{ color: screen === 'clear' ? '#2f9e5e' : '#d0503a' }}>
                {screen === 'clear' ? 'Docked!' : 'Battery dead'}
              </div>
              <div className="mt-1 text-[13px] text-[#8a7f72]">Level {clear.level}</div>
              <div className="mt-4 space-y-1 text-[16px]">
                <div className="flex justify-between"><span>Floor cleaned {clear.score.pct}%</span><b>+{clear.score.cleanPts}</b></div>
                {screen === 'clear' && (
                  <div className="flex justify-between"><span>{clear.flings} fling{clear.flings === 1 ? '' : 's'} · battery left</span><b>+{clear.score.flingPts}</b></div>
                )}
                {clear.score.bumps > 0 && (
                  <div className="flex justify-between text-[#c0453a]"><span>Woke Rosie ×{clear.score.bumps}</span><b>−{clear.score.rosiePts}</b></div>
                )}
                {screen === 'clear' && clear.score.bumps === 0 && (
                  <div className="flex justify-between text-[#2f9e5e]"><span>Rosie slept through it</span><b>+0</b></div>
                )}
                {screen === 'clear' && (
                  <div className="flex justify-between border-t border-[#e5ddd0] pt-1"><span>Level score</span><b>{clear.score.total}</b></div>
                )}
                <div className="flex justify-between text-[18px] pt-1"><span>Total</span><b>{clear.run}</b></div>
                <div className="flex justify-between text-[14px] text-[#8a7f72]"><span>Best</span><span>{best}{newBest ? ' · NEW!' : ''}</span></div>
              </div>
              {screen === 'clear' ? (
                <>
                  <button onClick={next} className="rf-btn mt-5 w-full bg-[#3fbf74] text-white">NEXT LEVEL</button>
                  <div className="mt-3 flex gap-3">
                    <button onClick={retry} className="rf-btn flex-1 bg-[#e8dfd0] text-[#3a332c] !text-[15px]">RETRY</button>
                    <button onClick={onExit} className="rf-btn flex-1 bg-[#e8dfd0] text-[#3a332c] !text-[15px]">MAP</button>
                  </div>
                </>
              ) : (
                <div className="mt-5 flex gap-3">
                  <button onClick={retry} className="rf-btn flex-1 bg-[#3fbf74] text-white">RETRY</button>
                  <button onClick={onExit} className="rf-btn flex-1 bg-[#e8dfd0] text-[#3a332c]">MAP</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
