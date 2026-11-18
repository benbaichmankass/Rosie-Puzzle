import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { GameProps } from '../../shared/types';
import { ExitButton } from '../../shared/ExitButton';
import { getHighScore, submitScore, load, save } from '../../shared/storage';
import { meta } from './meta';
import { Run } from './sim';
import { Scene } from './scene';
import { Sfx } from './audio';
import type { Obstacle } from './spawner';

type Screen = 'start' | 'play' | 'paused' | 'over';

const CSS = `
.g-boulevard-runner { font-family: 'Rubik', system-ui, sans-serif; }
.g-boulevard-runner .br-card { background: rgba(255,248,236,0.93); border-radius: 22px; box-shadow: 0 10px 40px rgba(80,35,10,0.35); }
.g-boulevard-runner .br-btn { background: #1f9aa6; color: #fff; border-radius: 999px; font-weight: 800; letter-spacing: 0.04em;
  box-shadow: 0 5px 0 #136c75; transition: transform .06s; }
.g-boulevard-runner .br-btn:active { transform: translateY(3px); box-shadow: 0 2px 0 #136c75; }
.g-boulevard-runner .br-btn.alt { background: #fff; color: #136c75; box-shadow: 0 5px 0 #c9b79a; }
.g-boulevard-runner .br-hud { text-shadow: 0 2px 0 rgba(90,40,10,0.45), 0 0 12px rgba(90,40,10,0.35); }
.g-boulevard-runner .br-round { width: 40px; height: 40px; border-radius: 999px; background: rgba(255,248,236,0.85); color: #6b3a1f;
  display: flex; align-items: center; justify-content: center; font-weight: 800; box-shadow: 0 3px 10px rgba(80,35,10,0.25); }
.g-boulevard-runner .br-exit { background: rgba(255,248,236,0.88); color: #6b3a1f; border: none; border-radius: 999px; padding: 10px 14px;
  box-shadow: 0 3px 10px rgba(80,35,10,0.25); }
@keyframes br-swipe { 0%,15% { transform: translateX(-46px); opacity: 0 } 30% { opacity: 1 } 60% { transform: translateX(46px); opacity: 1 } 75%,100% { transform: translateX(46px); opacity: 0 } }
.g-boulevard-runner .br-hand { animation: br-swipe 1.4s ease-in-out infinite; }
@keyframes br-pop { 0% { transform: scale(.7); opacity: 0 } 100% { transform: scale(1); opacity: 1 } }
.g-boulevard-runner .br-pop { animation: br-pop .25s ease-out; }
`;

function hitLine(o: Obstacle | null): string {
  if (!o) return 'Oops!';
  switch (o.kind) {
    case 'tramIn': return 'The light rail! Watch the far end of the left track.';
    case 'tramOut': return 'A tram from behind! Watch for the warning sign.';
    case 'bike': return 'Bonk! A bike rider on the promenade.';
    case 'walker': return 'Bumped into someone out for a walk.';
    default: return 'Tripped! Swipe up to jump the low stuff.';
  }
}

export default function Game({ onExit }: GameProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scoreRef = useRef<HTMLDivElement>(null);
  const [screen, setScreen] = useState<Screen>('start');
  const screenRef = useRef<Screen>('start');
  const [best, setBest] = useState(() => getHighScore(meta.id));
  const [last, setLast] = useState({ score: 0, newBest: false, why: '' });
  const [hint, setHint] = useState(false);
  const [muted, setMuted] = useState(() => load<boolean>(meta.id, 'muted', false));

  const sfx = useRef(new Sfx());
  const runRef = useRef<Run | null>(null);
  const anim = useRef({ phase: 0, wag: 0, idleD: 0, crashT: 0, shake: 0 });

  const go = useCallback((s: Screen) => { screenRef.current = s; setScreen(s); }, []);

  useEffect(() => { sfx.current.muted = muted; save(meta.id, 'muted', muted); }, [muted]);

  const start = useCallback(() => {
    sfx.current.unlock();
    runRef.current = new Run((Date.now() ^ (Math.random() * 1e9)) >>> 0);
    anim.current.crashT = 0;
    anim.current.shake = 0;
    if (!load<boolean>(meta.id, 'hinted', false)) {
      setHint(true);
      window.setTimeout(() => { setHint(false); save(meta.id, 'hinted', true); }, 4200);
    }
    go('play');
  }, [go]);

  // input
  const act = useCallback((a: 'left' | 'right' | 'jump') => {
    const r = runRef.current;
    if (screenRef.current !== 'play' || !r) return;
    if (a === 'jump') { if (r.jump()) sfx.current.jump(); }
    else if (r.move(a === 'left' ? -1 : 1)) sfx.current.swish();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') { act('left'); e.preventDefault(); }
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') { act('right'); e.preventDefault(); }
      else if (k === 'ArrowUp' || k === 'w' || k === 'W' || k === ' ') {
        e.preventDefault();
        if (screenRef.current === 'play') act('jump');
        else if (screenRef.current === 'start' || screenRef.current === 'over') { if (k === ' ') start(); }
      } else if (k === 'Escape' || k === 'p' || k === 'P') {
        if (screenRef.current === 'play') go('paused');
        else if (screenRef.current === 'paused') go('play');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [act, go, start]);

  // swipes
  const swipe = useRef<{ x: number; y: number; id: number; done: boolean } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    swipe.current = { x: e.clientX, y: e.clientY, id: e.pointerId, done: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = swipe.current;
    if (!s || s.done || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    const th = 22;
    if (Math.abs(dx) < th && Math.abs(dy) < th) return;
    s.done = true;
    if (Math.abs(dx) > Math.abs(dy)) act(dx < 0 ? 'left' : 'right');
    else if (dy < 0) act('jump');
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (swipe.current?.id === e.pointerId) swipe.current = null;
  };

  // pause when hidden
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        if (screenRef.current === 'play') go('paused');
        sfx.current.suspend();
      } else sfx.current.resume();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [go]);

  // main loop
  useEffect(() => {
    const canvas = canvasRef.current!, wrap = wrapRef.current!;
    const g = canvas.getContext('2d')!;
    const scene = new Scene();
    let W = 0, H = 0, dpr = 1;
    const resize = () => {
      const r = wrap.getBoundingClientRect();
      W = Math.max(1, Math.round(r.width));
      H = Math.max(1, Math.round(r.height));
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      scene.resize(W, H, dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    let raf = 0;
    let prev = performance.now();
    let hudTimer = 0;
    const idleObstacles: Obstacle[] = [];
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(1 / 30, (now - prev) / 1000);
      prev = now;
      const a = anim.current;
      const s = screenRef.current;
      const run = runRef.current;
      let speed = 3.2;
      if (s === 'play' && run) {
        const ev = run.update(dt);
        // Local playtest aid only: window.__brGod = true makes Rosie pass through everything.
        if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
          const w = window as unknown as { __brGod?: boolean; __brRun?: Run };
          w.__brRun = run;
          if (w.__brGod && run.crashed) { run.crashed = false; run.hit = null; ev.length = 0; }
        }
        speed = run.speed;
        for (const e of ev) {
          if (e === 'tramWarn') sfx.current.tramBell();
          else if (e === 'bike') sfx.current.bikeBell();
          else if (e === 'crash') { sfx.current.bonk(); a.shake = 1; a.crashT = 0; }
        }
        if (run.crashed) {
          a.crashT += dt;
          if (a.crashT > 0.9) {
            const nb = submitScore(meta.id, run.score);
            setBest(getHighScore(meta.id));
            setLast({ score: run.score, newBest: nb, why: hitLine(run.hit) });
            go('over');
          }
        }
        hudTimer += dt;
        if (hudTimer > 0.08 && scoreRef.current) { hudTimer = 0; scoreRef.current.textContent = `${run.score} m`; }
      } else if (s === 'start') {
        a.idleD += dt * speed;
      }
      if (s === 'play' || s === 'start') {
        const gait = run && !run.crashed && s === 'play' ? 2.1 + speed * 0.11 : s === 'start' ? 1.6 : 0;
        a.phase += dt * Math.PI * 2 * gait;
        a.wag += dt * (run?.crashed ? 4 : 13);
      }
      a.shake = Math.max(0, a.shake - dt * 2.5);
      const useRun = s !== 'start' && run;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      scene.render(g, {
        d: useRun ? run.d : a.idleD,
        t: useRun ? run.t : now / 1000,
        obstacles: useRun ? run.spawner.obstacles : idleObstacles,
        showObstacles: !!useRun,
        shake: a.shake,
        player: {
          lanePos: useRun ? run.lanePos : 1,
          jumpY: useRun ? run.jumpY : 0,
          phase: a.phase,
          wag: Math.sin(a.wag),
          lean: useRun ? (run.lane - run.lanePos) * 1.2 : 0,
          airborne: useRun ? run.jumpY > 0.05 : false,
          crashed: !!(useRun && run.crashed),
          crashT: useRun && run.crashed ? a.crashT : -1,
          landT: useRun ? run.t - run.landedAt : -1,
        },
      });
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [go]);

  return (
    <div
      ref={wrapRef}
      className="g-boulevard-runner relative w-full h-[100dvh] overflow-hidden select-none bg-[#d9b27c]"
      style={{ touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Rubik:wght@500;700;800;900&display=swap" />
      <style>{CSS}</style>
      <canvas ref={canvasRef} className="absolute inset-0 block" />

      {/* HUD */}
      <div className="absolute top-0 left-0 right-0 flex items-start justify-between p-3 pointer-events-none" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <div className="pointer-events-auto" onPointerDown={(e) => e.stopPropagation()}>
          <ExitButton onExit={onExit} className="br-exit" />
        </div>
        {screen !== 'start' && (
          <div className="text-center text-white br-hud">
            <div ref={scoreRef} className="font-black text-[30px] leading-none">0 m</div>
            <div className="font-bold text-[12px] opacity-90 mt-1">BEST {best} m</div>
          </div>
        )}
        <div className="flex gap-2 pointer-events-auto" onPointerDown={(e) => e.stopPropagation()}>
          {screen === 'play' && (
            <button className="br-round" aria-label="Pause" onClick={() => go('paused')}>❚❚</button>
          )}
          <button className="br-round" aria-label={muted ? 'Unmute' : 'Mute'} onClick={() => setMuted((m) => !m)}>
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
      </div>

      {screen === 'start' && (
        <div className="absolute inset-x-0 bottom-0 flex justify-center p-4" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }} onPointerDown={(e) => e.stopPropagation()}>
          <div className="br-card br-pop w-full max-w-[360px] p-5 text-center text-[#5a2f17]">
            <div className="text-[13px] font-bold tracking-[0.2em] text-[#c0602e]">YAFO · JAFFA</div>
            <div className="text-[28px] font-black leading-[1.05] mt-1">Jerusalem Boulevard Runner</div>
            <div className="text-[15px] font-medium mt-3 leading-snug">
              Walk Rosie down the boulevard. <b>Swipe ← →</b> to change lanes, <b>swipe ↑</b> to jump. Dodge walkers, bikes and the light rail.
            </div>
            <button className="br-btn w-full mt-4 py-3 text-[20px]" onClick={start}>PLAY</button>
            <div className="text-[13px] font-bold mt-3 opacity-80">BEST {best} m</div>
          </div>
        </div>
      )}

      {screen === 'play' && hint && (
        <div className="absolute inset-x-0 top-[30%] flex flex-col items-center pointer-events-none br-pop">
          <div className="br-hand text-[44px] leading-none" aria-hidden>👆</div>
          <div className="mt-2 px-4 py-2 rounded-full bg-[rgba(255,248,236,0.9)] text-[#5a2f17] text-[15px] font-bold shadow">
            Swipe ← → to dodge · swipe ↑ to jump
          </div>
        </div>
      )}

      {screen === 'paused' && (
        <div className="absolute inset-0 flex items-center justify-center bg-[rgba(60,25,10,0.35)] p-4" onPointerDown={(e) => e.stopPropagation()}>
          <div className="br-card br-pop w-full max-w-[320px] p-6 text-center text-[#5a2f17]">
            <div className="text-[28px] font-black">Paused</div>
            <div className="text-[15px] mt-1 opacity-80">Rosie is sniffing a ficus.</div>
            <button className="br-btn w-full mt-5 py-3 text-[19px]" onClick={() => go('play')}>RESUME</button>
            <button className="br-btn alt w-full mt-3 py-3 text-[17px]" onClick={onExit}>MAP</button>
          </div>
        </div>
      )}

      {screen === 'over' && (
        <div className="absolute inset-0 flex items-center justify-center bg-[rgba(60,25,10,0.35)] p-4" onPointerDown={(e) => e.stopPropagation()}>
          <div className="br-card br-pop w-full max-w-[340px] p-6 text-center text-[#5a2f17]">
            <div className="text-[15px] font-medium leading-snug">{last.why}</div>
            <div className="text-[56px] font-black leading-none mt-3">{last.score}<span className="text-[26px]"> m</span></div>
            {last.newBest ? (
              <div className="inline-block mt-2 px-3 py-1 rounded-full bg-[#f2c14e] text-[#5a2f17] text-[13px] font-black">NEW BEST!</div>
            ) : (
              <div className="text-[15px] font-bold mt-2 opacity-80">BEST {best} m</div>
            )}
            <button className="br-btn w-full mt-5 py-3 text-[20px]" onClick={start}>RETRY</button>
            <button className="br-btn alt w-full mt-3 py-3 text-[17px]" onClick={onExit}>MAP</button>
          </div>
        </div>
      )}
    </div>
  );
}
