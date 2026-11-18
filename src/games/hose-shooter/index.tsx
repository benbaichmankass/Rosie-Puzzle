import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { GameProps } from '../../shared/types';
import { ExitButton } from '../../shared/ExitButton';
import { getHighScore, load, save, submitScore } from '../../shared/storage';
import { createGame, makeLayout, secondsLeft, step, W, type GameState, type Stats } from './logic';
import { drawFrame, makeLayers, type Layers } from './render';
import { Sfx } from './audio';
import { meta } from './meta';

const ID = meta.id;
/** On touch, aim a little above the finger so it doesn't hide the target. */
const TOUCH_OFFSET = 64;

type Phase = 'start' | 'play' | 'over';

/** Short vibration where supported (Android Chrome). */
function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* not supported */
  }
}

interface Result {
  score: number;
  best: number;
  isBest: boolean;
  stats: Stats;
}

const CSS = `
.g-hose-shooter { font-family: "Luckiest Guy", "Pixelify Sans", system-ui, sans-serif; letter-spacing: .02em; }
.g-hose-shooter .hs-paper { background: #fffaf0; color: #2a1608; border-radius: 6px;
  box-shadow: 3px 4px 0 rgba(45,25,5,.35); }
.g-hose-shooter .hs-chip { background: #fffaf0; color: #2a1608; border-radius: 999px; padding: 4px 12px 2px;
  box-shadow: 2px 3px 0 rgba(45,25,5,.35); line-height: 1.1; }
.g-hose-shooter .hs-btn { background: #ffd23f; color: #2a1608; border-radius: 10px; padding: 12px 22px 8px;
  font-size: 22px; box-shadow: 3px 4px 0 #2a1608; transform: rotate(-1.5deg); }
.g-hose-shooter .hs-btn:active { transform: translate(2px,3px) rotate(-1.5deg); box-shadow: 1px 1px 0 #2a1608; }
.g-hose-shooter .hs-btn.alt { background: #7fd9df; transform: rotate(1.5deg); }
.g-hose-shooter .hs-btn.alt:active { transform: translate(2px,3px) rotate(1.5deg); }
.g-hose-shooter .hs-title span { display: inline-block; padding: 2px 6px 0; margin: 0 1px; border-radius: 4px;
  box-shadow: 2px 3px 0 rgba(45,25,5,.4); }
.g-hose-shooter .hs-exit { font-family: "Luckiest Guy", system-ui, sans-serif; font-size: 13px; background: #fffaf0;
  color: #2a1608; border: 0; border-radius: 8px; box-shadow: 2px 3px 0 rgba(45,25,5,.4); padding: 6px 10px 3px; }
@keyframes hs-pop { 0% { transform: scale(.6) rotate(-6deg); opacity: 0 } 70% { transform: scale(1.06) rotate(1deg) } 100% { transform: scale(1) rotate(0); opacity: 1 } }
.g-hose-shooter .hs-pop { animation: hs-pop .35s ease-out both; }
`;

const TITLE_COLORS = ['#ee8a2c', '#7fd9df', '#ffd23f', '#f3a7b3', '#8fd36a', '#fffaf0'];

function Title({ text, size = 34 }: { text: string; size?: number }) {
  let n = 0;
  return (
    <div className="hs-title leading-none text-[#2a1608]" style={{ fontSize: size }}>
      {text.split(' ').map((word, wi) => (
        <div key={wi} className="whitespace-nowrap my-1">
          {word.split('').map((ch, i) => {
            const k = n++;
            return (
              <span key={i} style={{ background: TITLE_COLORS[k % TITLE_COLORS.length], transform: `rotate(${((k * 37) % 9) - 4}deg)` }}>
                {ch}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default function Game({ onExit }: GameProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameState | null>(null);
  const layersRef = useRef<Layers | null>(null);
  const inputRef = useRef({ aimX: W / 2, aimY: 400, spraying: false, pointer: -1, hover: false });
  const sfxRef = useRef<Sfx | null>(null);
  const scoreRef = useRef<HTMLSpanElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const phaseRef = useRef<Phase>('start');
  const pausedRef = useRef(false);
  const sizeRef = useRef({ H: 800, px: 2 });

  const [phase, setPhase] = useState<Phase>('start');
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(() => load<boolean>(ID, 'muted', false));
  const [best, setBest] = useState(() => getHighScore(ID));
  const [result, setResult] = useState<Result | null>(null);

  if (!sfxRef.current) {
    sfxRef.current = new Sfx();
    sfxRef.current.muted = muted;
  }

  const setPhaseBoth = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  // ---- canvas sizing
  const resize = useCallback(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const r = wrap.getBoundingClientRect();
    if (r.width < 10 || r.height < 10) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    const px = canvas.width / W;
    const H = canvas.height / px;
    sizeRef.current = { H, px };
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const g = gameRef.current;
    if (!g) gameRef.current = createGame(H, Date.now() & 0xffff, true);
    else if (Math.abs(g.L.H - H) > 0.5) g.L = makeLayout(H);
    layersRef.current = makeLayers(gameRef.current.L, px);
  }, []);

  useEffect(() => {
    resize();
    const ro = new ResizeObserver(() => resize());
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [resize]);

  // ---- main loop
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let hudT = 0;
    let wasSpraying = false;
    const sfx = sfxRef.current;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const g = gameRef.current;
      const canvas = canvasRef.current;
      const lay = layersRef.current;
      if (!g || !canvas || !lay) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const inp = inputRef.current;
      const playing = phaseRef.current === 'play';
      if (!pausedRef.current) {
        step(g, dt, { aimX: inp.aimX, aimY: inp.aimY, spraying: playing && inp.spraying });
      }
      // sound + phase events
      const spraying = g.spraying && !pausedRef.current;
      if (spraying !== wasSpraying) {
        sfx?.spray(spraying);
        wasSpraying = spraying;
      }
      for (const ev of g.events) {
        if (!sfx) break;
        if (ev.type === 'hit') {
          if (ev.kind === 'cat') sfx.cat();
          else if (ev.kind === 'chicken') sfx.chicken();
          else sfx.oops();
          if (playing && !sfx.muted) buzz(ev.kind === 'cat' ? 15 : ev.kind === 'chicken' ? [25, 40, 25] : 70);
        } else if (ev.type === 'chicken-up' && playing) sfx.chickenUp();
        else if (ev.type === 'tick') sfx.tick();
        else if (ev.type === 'end') sfx.whistle();
      }
      const ended = g.events.some((e) => e.type === 'end');
      g.events.length = 0;
      if (ended && playing) {
        inp.spraying = false;
        const isBest = submitScore(ID, g.score);
        const b = getHighScore(ID);
        setBest(b);
        setResult({ score: g.score, best: b, isBest, stats: { ...g.stats } });
        setPhaseBoth('over');
      }
      drawFrame(ctx, g, lay, now / 1000, playing && (inp.pointer >= 0 || inp.hover));
      hudT += dt;
      if (hudT > 0.08) {
        hudT = 0;
        if (scoreRef.current) scoreRef.current.textContent = String(g.score);
        if (timeRef.current) timeRef.current.textContent = String(Math.ceil(secondsLeft(g)));
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ---- pause when hidden
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        inputRef.current.spraying = false;
        inputRef.current.pointer = -1;
        sfxRef.current?.suspend();
        if (phaseRef.current === 'play') {
          pausedRef.current = true;
          setPaused(true);
        }
      } else if (!pausedRef.current) sfxRef.current?.resume();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => () => sfxRef.current?.close(), []);


  // ---- input
  const toWorld = (e: React.PointerEvent) => {
    const r = canvasRef.current?.getBoundingClientRect();
    if (!r) return { x: W / 2, y: 400 };
    const k = W / r.width;
    return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k - (e.pointerType === 'mouse' ? 0 : TOUCH_OFFSET) };
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (phaseRef.current !== 'play' || pausedRef.current) return;
    e.preventDefault();
    const inp = inputRef.current;
    if (inp.pointer >= 0 && inp.pointer !== e.pointerId) return;
    canvasRef.current?.setPointerCapture(e.pointerId);
    const p = toWorld(e);
    inp.pointer = e.pointerId;
    inp.aimX = p.x;
    inp.aimY = p.y;
    inp.spraying = true;
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const inp = inputRef.current;
    if (inp.pointer >= 0 && e.pointerId !== inp.pointer) return;
    if (inp.pointer < 0 && e.pointerType !== 'mouse') return;
    const p = toWorld(e);
    inp.aimX = p.x;
    inp.aimY = p.y;
    inp.hover = e.pointerType === 'mouse';
  };
  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const inp = inputRef.current;
    if (e.pointerId !== inp.pointer) return;
    inp.pointer = -1;
    inp.spraying = false;
  };

  const start = () => {
    const sfx = sfxRef.current;
    sfx?.unlock();
    const { H } = sizeRef.current;
    gameRef.current = createGame(H, (Math.random() * 1e9) | 0);
    const L = gameRef.current.L;
    inputRef.current = { aimX: W / 2, aimY: L.wallBase, spraying: false, pointer: -1, hover: false };
    pausedRef.current = false;
    setPaused(false);
    setResult(null);
    setPhaseBoth('play');
  };

  const resume = () => {
    pausedRef.current = false;
    setPaused(false);
    sfxRef.current?.resume();
  };

  const toggleMute = () => {
    const m = !muted;
    setMuted(m);
    save(ID, 'muted', m);
    sfxRef.current?.setMuted(m);
  };

  const oops = result ? result.stats.bunnies + result.stats.turtles : 0;

  return (
    <div className="g-hose-shooter fixed inset-0 bg-[#3b2a1c] flex justify-center select-none" style={{ height: '100dvh' }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Luckiest+Guy&display=swap" />
      <style>{CSS}</style>
      <div ref={wrapRef} className="relative w-full max-w-[480px] h-full overflow-hidden" style={{ touchAction: 'none' }}>
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full block"
          style={{ touchAction: 'none' }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onPointerLeave={(e) => {
            if (e.pointerType === 'mouse') inputRef.current.hover = false;
          }}
          onContextMenu={(e) => e.preventDefault()}
        />

        {/* HUD */}
        <div className="absolute top-0 left-0 right-0 flex items-start justify-between gap-2 p-2 pointer-events-none" style={{ paddingTop: 'max(8px, env(safe-area-inset-top))' }}>
          <div className="pointer-events-auto">
            <ExitButton onExit={onExit} className="hs-exit" />
          </div>
          {phase === 'play' && (
            <div className="flex gap-2 items-center">
              <div className="hs-chip text-[20px] rotate-[-2deg]">
                <span ref={scoreRef}>0</span>
              </div>
              <div className="hs-chip text-[20px] rotate-[2deg] bg-[#ffd23f]" style={{ background: '#ffd23f' }}>
                ⏱ <span ref={timeRef}>60</span>
              </div>
            </div>
          )}
          <button
            onClick={toggleMute}
            aria-label={muted ? 'Sound on' : 'Mute'}
            className="pointer-events-auto hs-chip text-[16px] w-[42px] h-[34px] flex items-center justify-center"
          >
            {muted ? '🔇' : '🔊'}
          </button>
        </div>

        {phase === 'start' && (
          <div className="absolute inset-0 flex items-center justify-center p-5 bg-[rgba(42,22,8,0.28)]">
            <div className="hs-paper hs-pop w-full max-w-[330px] px-5 py-6 text-center rotate-[-1deg]">
              <Title text="HOSE SHOOTER" />
              <p className="mt-4 text-[16px] leading-snug" style={{ fontFamily: '"Pixelify Sans", system-ui, sans-serif' }}>
                Drag to aim, hold to spray. Soak the cats, splash the chicken for a big bonus, and leave the bunnies and turtles dry!
              </p>
              <div className="mt-3 grid grid-cols-3 gap-1 text-[13px]">
                <div className="hs-chip">CAT +100</div>
                <div className="hs-chip" style={{ background: '#ffd23f' }}>
                  HEN +500
                </div>
                <div className="hs-chip" style={{ background: '#f3a7b3' }}>
                  BUNNY −150
                </div>
              </div>
              <div className="mt-3 text-[15px]">BEST: {best}</div>
              <button onClick={start} className="hs-btn mt-4">
                PLAY
              </button>
            </div>
          </div>
        )}

        {phase === 'over' && result && (
          <div className="absolute inset-0 flex items-center justify-center p-5 bg-[rgba(42,22,8,0.35)]">
            <div className="hs-paper hs-pop w-full max-w-[330px] px-5 py-6 text-center rotate-[1deg]">
              <Title text="TIME'S UP!" size={30} />
              <div className="mt-3 text-[52px] leading-none">{result.score}</div>
              <div className="mt-1 text-[17px]">{result.isBest && result.score > 0 ? '★ NEW BEST! ★' : `BEST: ${result.best}`}</div>
              <div className="mt-3 flex justify-center gap-2 text-[14px]">
                <div className="hs-chip">🐱 {result.stats.cats}</div>
                <div className="hs-chip" style={{ background: '#ffd23f' }}>
                  🐔 {result.stats.chickens}
                </div>
                <div className="hs-chip" style={{ background: '#f3a7b3' }}>
                  OOPS {oops}
                </div>
              </div>
              <div className="mt-5 flex justify-center gap-3">
                <button onClick={start} className="hs-btn">
                  RETRY
                </button>
                <button onClick={onExit} className="hs-btn alt">
                  MAP
                </button>
              </div>
            </div>
          </div>
        )}

        {paused && phase === 'play' && (
          <button onClick={resume} className="absolute inset-0 flex items-center justify-center bg-[rgba(42,22,8,0.45)]">
            <div className="hs-paper px-6 py-5 text-center">
              <div className="text-[28px]">PAUSED</div>
              <div className="text-[15px] mt-1">tap to keep spraying</div>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
