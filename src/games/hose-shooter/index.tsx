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
/** Length of the gunslinger nozzle spin (seconds). */
const TWIRL = 0.55;

type Phase = 'start' | 'play' | 'over';
type Beat = 'ready' | 'steady' | 'draw' | null;

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

const WOOD =
  'repeating-linear-gradient(0deg, rgba(0,0,0,0) 0 7px, rgba(60,30,10,.18) 7px 8px), linear-gradient(180deg, #a8743f, #8a5a2e)';

const CSS = `
.g-hose-shooter { font-family: "Rye", Georgia, serif; letter-spacing: .02em; }
.g-hose-shooter .hs-type { font-family: "Special Elite", "Courier New", monospace; letter-spacing: 0; }
.g-hose-shooter .hs-poster { position: relative; color: #3a2210;
  background: radial-gradient(ellipse at 50% 40%, #f6e3b4 0%, #ecd29a 60%, #d9b475 100%);
  clip-path: polygon(0 2%, 4% 0, 12% 1.5%, 22% 0, 34% 1%, 47% 0, 60% 1.2%, 72% 0, 85% 1.5%, 96% 0, 100% 3%,
    99% 15%, 100% 30%, 98.5% 47%, 100% 63%, 99% 80%, 100% 97%, 95% 100%, 82% 98.5%, 68% 100%, 55% 98.8%, 41% 100%,
    27% 98.5%, 14% 100%, 3% 98.8%, 0 96%, 1% 80%, 0 64%, 1.4% 47%, 0 30%, 1% 15%);
}
.g-hose-shooter .hs-poster-inner { border: 3px double #6a4022; }
.g-hose-shooter .hs-nail { position: absolute; width: 9px; height: 9px; border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #c8b8a0, #4a3a2c); }
.g-hose-shooter .hs-wood { background: ${WOOD}; color: #fff1d0; text-shadow: 0 2px 0 #3a2210;
  border-radius: 4px; box-shadow: inset 0 0 0 2px rgba(40,20,5,.35), 3px 4px 0 rgba(40,20,5,.5); }
.g-hose-shooter .hs-btn { font-size: 22px; padding: 12px 26px 9px; transform: rotate(-1.5deg); }
.g-hose-shooter .hs-btn:active { transform: translate(2px,3px) rotate(-1.5deg); box-shadow: inset 0 0 0 2px rgba(40,20,5,.35), 1px 1px 0 rgba(40,20,5,.5); }
.g-hose-shooter .hs-btn.alt { transform: rotate(1.5deg); filter: hue-rotate(-12deg) brightness(.92); }
.g-hose-shooter .hs-btn.alt:active { transform: translate(2px,3px) rotate(1.5deg); }
.g-hose-shooter .hs-exit { font-family: "Rye", Georgia, serif; font-size: 12px; border: 0; padding: 7px 10px 5px;
  background: ${WOOD}; color: #fff1d0; text-shadow: 0 1px 0 #3a2210; border-radius: 4px;
  box-shadow: inset 0 0 0 2px rgba(40,20,5,.35), 2px 3px 0 rgba(40,20,5,.5); }
.g-hose-shooter .hs-sign { position: relative; padding: 6px 14px 4px; font-size: 22px; transform: rotate(-2deg); }
.g-hose-shooter .hs-sign::before, .g-hose-shooter .hs-sign::after { content: ""; position: absolute; top: 50%; width: 6px; height: 6px;
  margin-top: -3px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #d8c8b0, #4a3a2c); }
.g-hose-shooter .hs-sign::before { left: 5px; } .g-hose-shooter .hs-sign::after { right: 5px; }
.g-hose-shooter .hs-vignette { background: radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 55%, rgba(70,35,10,.38) 100%); }
@keyframes hs-pop { 0% { transform: scale(.6) rotate(-6deg); opacity: 0 } 70% { transform: scale(1.06) rotate(1deg) } 100% { transform: scale(1) rotate(0); opacity: 1 } }
.g-hose-shooter .hs-pop { animation: hs-pop .35s ease-out both; }
@keyframes hs-beat { 0% { transform: scale(2.2); opacity: 0 } 25% { transform: scale(1); opacity: 1 } 80% { opacity: 1 } 100% { transform: scale(.9); opacity: 0 } }
.g-hose-shooter .hs-beat { animation: hs-beat .8s ease-out both; text-shadow: 0 4px 0 #3a2210, 0 0 18px rgba(255,220,150,.6); }
@keyframes hs-swing { 0%,100% { transform: rotate(-3deg) } 50% { transform: rotate(3deg) } }
.g-hose-shooter .hs-swing { animation: hs-swing 2.4s ease-in-out infinite; transform-origin: 50% 0; }
`;

/** Original drawing for the start poster: a yard cat in a bandit mask and bandana. */
function OutlawCat() {
  return (
    <svg viewBox="0 0 120 100" width="132" height="110" aria-hidden="true" style={{ filter: 'sepia(.55) contrast(1.05)' }}>
      <rect x="2" y="2" width="116" height="96" fill="#e9cf98" stroke="#6a4022" strokeWidth="2" />
      <path d="M30 40 L36 12 L52 30 Z M90 40 L84 12 L68 30 Z" fill="#e2852e" />
      <path d="M35 34 L38 19 L47 30 Z M85 34 L82 19 L73 30 Z" fill="#f0a3ae" />
      <ellipse cx="60" cy="50" rx="33" ry="28" fill="#e98a30" />
      <path d="M50 26 L54 36 L58 26 Z M62 26 L66 36 L70 26 Z" fill="#b85e18" />
      <path d="M28 46 Q60 36 92 46 L90 58 Q60 50 30 58 Z" fill="#1d1a1f" />
      <path d="M28 49 L14 44 M28 52 L16 58" stroke="#1d1a1f" strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="48" cy="51" rx="7" ry="6" fill="#fff" /><ellipse cx="72" cy="51" rx="7" ry="6" fill="#fff" />
      <circle cx="50" cy="52" r="2.6" fill="#111" /><circle cx="70" cy="52" r="2.6" fill="#111" />
      <path d="M44 44 L54 47 M76 44 L66 47" stroke="#111" strokeWidth="2.4" strokeLinecap="round" />
      <ellipse cx="60" cy="64" rx="12" ry="8" fill="#f8d2a0" />
      <path d="M57 61 L63 61 L60 65 Z" fill="#d86a7c" />
      <path d="M56 69 Q60 72 64 69" stroke="#3a2210" strokeWidth="1.6" fill="none" />
      <path d="M58 64 L40 60 M58 66 L40 68 M62 64 L80 60 M62 66 L80 68" stroke="#3a2210" strokeWidth="1" />
      <path d="M32 74 L88 74 L62 98 Z" fill="#b8322a" />
      <circle cx="48" cy="79" r="1.6" fill="#f6e6c8" /><circle cx="60" cy="83" r="1.6" fill="#f6e6c8" /><circle cx="72" cy="79" r="1.6" fill="#f6e6c8" />
    </svg>
  );
}

/** Six-point sheriff star with the seconds left in the middle. */
function SheriffStar({ children }: { children: React.ReactNode }) {
  const pts: string[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 ? 15 : 27;
    pts.push(`${30 + Math.cos(a) * r},${30 + Math.sin(a) * r}`);
  }
  return (
    <div className="relative w-[60px] h-[60px] rotate-[6deg]" style={{ filter: 'drop-shadow(2px 3px 0 rgba(40,20,5,.5))' }}>
      <svg viewBox="0 0 60 60" className="absolute inset-0">
        <polygon points={pts.join(' ')} fill="#e2b445" stroke="#8a6420" strokeWidth="2" strokeLinejoin="round" />
        {pts.filter((_, i) => i % 2 === 0).map((p, i) => {
          const [x, y] = p.split(',').map(Number);
          return <circle key={i} cx={x} cy={y} r="3" fill="#f2d27a" stroke="#8a6420" strokeWidth="1.2" />;
        })}
        <circle cx="30" cy="30" r="12.5" fill="#f2d27a" stroke="#8a6420" strokeWidth="1.5" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[16px] text-[#3a2210] pt-[2px]">{children}</div>
    </div>
  );
}

function Poster({ children, tilt }: { children: React.ReactNode; tilt: number }) {
  return (
    <div className="hs-pop w-full max-w-[332px]" style={{ filter: 'drop-shadow(4px 6px 0 rgba(40,20,5,.45))' }}>
      <div className="hs-poster p-3" style={{ transform: `rotate(${tilt}deg)` }}>
        <span className="hs-nail" style={{ left: 10, top: 10 }} />
        <span className="hs-nail" style={{ right: 10, top: 10 }} />
        <div className="hs-poster-inner px-4 py-4 text-center">{children}</div>
      </div>
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
  const [beat, setBeat] = useState<Beat>(null);
  const twirlRef = useRef(-10);
  const kickRef = useRef(-10);

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
          if (ev.kind === 'cat' || ev.kind === 'chicken') kickRef.current = now / 1000;
          else sfx.oops();
          if (playing && !sfx.muted) buzz(ev.kind === 'cat' ? 15 : ev.kind === 'chicken' ? [25, 40, 25] : 70);
        } else if (ev.type === 'chicken-up' && playing) sfx.chickenUp();
        else if (ev.type === 'tick') sfx.tick();
        else if (ev.type === 'count' && playing) {
          sfx.count(ev.beat);
          setBeat(ev.beat);
          if (ev.beat === 'draw') {
            twirlRef.current = now / 1000;
            window.setTimeout(() => setBeat(null), 800);
          }
        }
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
      drawFrame(ctx, g, lay, now / 1000, playing && g.countdown <= 0 && (inp.pointer >= 0 || inp.hover), (now / 1000 - twirlRef.current) / TWIRL, (now / 1000 - kickRef.current) / 0.22);
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
    setBeat(null);
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
    <div className="g-hose-shooter fixed inset-0 bg-[#2e1c10] flex justify-center select-none" style={{ height: '100dvh' }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Rye&family=Special+Elite&display=swap" />
      <style>{CSS}</style>
      <div ref={wrapRef} className="relative w-full max-w-[480px] h-full overflow-hidden" style={{ touchAction: 'none' }}>
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full block"
          style={{ touchAction: 'none', filter: 'sepia(0.08) saturate(1.1) contrast(1.04)' }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onPointerLeave={(e) => {
            if (e.pointerType === 'mouse') inputRef.current.hover = false;
          }}
          onContextMenu={(e) => e.preventDefault()}
        />
        <div className="hs-vignette absolute inset-0 pointer-events-none" />

        {/* HUD */}
        <div className="absolute top-0 left-0 right-0 flex items-start justify-between gap-2 p-2 pointer-events-none" style={{ paddingTop: 'max(8px, env(safe-area-inset-top))' }}>
          <div className="pointer-events-auto">
            <ExitButton onExit={onExit} className="hs-exit" />
          </div>
          {phase === 'play' && (
            <div className="flex gap-2 items-start">
              <div className="hs-swing flex flex-col items-center">
                <div className="flex gap-[34px] h-[8px]">
                  <span className="block w-[2px] h-full bg-[#4a3020]" />
                  <span className="block w-[2px] h-full bg-[#4a3020]" />
                </div>
                <div className="hs-wood hs-sign">
                  $<span ref={scoreRef}>0</span>
                </div>
              </div>
              <SheriffStar>
                <span ref={timeRef}>60</span>
              </SheriffStar>
            </div>
          )}
          <button
            onClick={toggleMute}
            aria-label={muted ? 'Sound on' : 'Mute'}
            className="pointer-events-auto hs-exit text-[15px] w-[40px] h-[32px] flex items-center justify-center"
          >
            {muted ? '🔇' : '🔊'}
          </button>
        </div>

        {phase === 'play' && beat && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div key={beat} className="hs-beat text-[54px]" style={{ color: beat === 'draw' ? '#e8483a' : '#fff1d0' }}>
              {beat === 'ready' ? 'READY…' : beat === 'steady' ? 'STEADY…' : 'DRAW!'}
            </div>
          </div>
        )}

        {phase === 'start' && (
          <div className="absolute inset-0 flex items-center justify-center p-5 bg-[rgba(46,24,8,0.32)]">
            <Poster tilt={-1.5}>
              <div className="text-[46px] leading-none tracking-wider">WANTED</div>
              <div className="hs-type text-[13px] mt-1">DEAD OR SOAKING WET</div>
              <div className="flex justify-center mt-2">
                <OutlawCat />
              </div>
              <div className="text-[20px] mt-2 leading-tight">THE YARD CAT GANG</div>
              <p className="hs-type text-[14px] leading-snug mt-2">
                Drag to aim, hold to spray. Soak the outlaw cats and the hen that peeks over the wall. Leave the bunnies and turtles dry!
              </p>
              <div className="hs-type text-[13px] mt-2 leading-snug">
                <div>
                  REWARD: <b>$100–200</b> a cat · <b>$500</b> the outlaw hen
                </div>
                <div>FINE: $150 per wet bunny or turtle</div>
              </div>
              <div className="text-[14px] mt-2">BEST BOUNTY: ${best}</div>
              <button onClick={start} className="hs-wood hs-btn mt-3">
                PLAY
              </button>
            </Poster>
          </div>
        )}

        {phase === 'over' && result && (
          <div className="absolute inset-0 flex items-center justify-center p-5 bg-[rgba(46,24,8,0.4)]">
            <Poster tilt={1.5}>
              <div className="text-[42px] leading-none tracking-wider">WANTED</div>
              <div className="hs-type text-[13px] mt-1">FOR HOSING DOWN THE YARD</div>
              <div className="hs-type text-[14px] mt-3">BOUNTY COLLECTED</div>
              <div className="text-[54px] leading-none mt-1">${result.score}</div>
              <div className="text-[16px] mt-2">{result.isBest && result.score > 0 ? '★ NEW BEST! ★' : `BEST: $${result.best}`}</div>
              <div className="hs-type text-[14px] mt-3 flex justify-center gap-3">
                <span>CATS {result.stats.cats}</span>
                <span>HENS {result.stats.chickens}</span>
                <span>OOPS {oops}</span>
              </div>
              <div className="mt-4 flex justify-center gap-3">
                <button onClick={start} className="hs-wood hs-btn">
                  RETRY
                </button>
                <button onClick={onExit} className="hs-wood hs-btn alt">
                  MAP
                </button>
              </div>
            </Poster>
          </div>
        )}

        {paused && phase === 'play' && (
          <button onClick={resume} className="absolute inset-0 flex items-center justify-center bg-[rgba(46,24,8,0.5)]">
            <div className="hs-wood px-6 py-4 text-center">
              <div className="text-[28px]">PAUSED</div>
              <div className="hs-type text-[15px] mt-1">tap to get back in the saddle</div>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
