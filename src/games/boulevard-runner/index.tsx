import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { GameProps } from '../../shared/types';
import { ExitButton } from '../../shared/ExitButton';
import { getHighScore, submitScore, load, save } from '../../shared/storage';
import { meta } from './meta';
import { Run } from './sim';
import { timeOfDay } from './daynight';
import { Scene } from './scene';
import { Sfx } from './audio';
import type { Obstacle } from './spawner';
import { stationsIn, station, platformStart, PLATFORM_LEN } from './route';

type Screen = 'start' | 'play' | 'paused' | 'over';

/**
 * Review flags (not shown to players): put them in the query string before the hash, e.g.
 * https://…/Rosies-Game-House/?d=1600&tod=0.6#/play/boulevard-runner
 *   d   = start the run at this distance (m) along the route (1600 = just before Charles Clore Park)
 *   tod = pin the time of day, 0..1 (0.1 day, 0.36 sunset, 0.6 night, 0.86 dawn)
 */
const REVIEW = (() => {
  try {
    const q = new URLSearchParams(window.location.search);
    const d = Number(q.get('d'));
    const tod = q.get('tod');
    return { d: Number.isFinite(d) && d > 0 ? Math.min(d, 100000) : 0, tod: tod !== null && Number.isFinite(Number(tod)) ? Number(tod) - Math.floor(Number(tod)) : undefined };
  } catch { return { d: 0, tod: undefined as number | undefined }; }
})();

const POWER_LABEL: Record<string, string> = {
  board: '🛹 Skateboard', magnet: '🧲 Treat magnet', mult: '⭐ x2 score', balloon: '🎈 Balloon', spring: '👟 Spring booties',
};

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
.g-boulevard-runner .br-exit { white-space: nowrap; flex-shrink: 0; background: rgba(255,248,236,0.88); color: #6b3a1f; border: none; border-radius: 999px; padding: 10px 14px;
  box-shadow: 0 3px 10px rgba(80,35,10,0.25); }
@keyframes br-swipe { 0%,15% { transform: translateX(-46px); opacity: 0 } 30% { opacity: 1 } 60% { transform: translateX(46px); opacity: 1 } 75%,100% { transform: translateX(46px); opacity: 0 } }
.g-boulevard-runner .br-hand { animation: br-swipe 1.4s ease-in-out infinite; }
@keyframes br-pop { 0% { transform: scale(.7); opacity: 0 } 100% { transform: scale(1); opacity: 1 } }
.g-boulevard-runner .br-pop { animation: br-pop .25s ease-out; }
`;

function hitLine(o: Obstacle | null): string {
  if (!o) return 'Oops!';
  switch (o.kind) {
    case 'tramIn': return 'Head-on with the light rail! Jump just as it reaches you to land on its roof.';
    case 'tramOut': return 'Ran into the back of a tram! Jump, or take the yellow ramp, to get on the roof.';
    case 'tramStop': return 'Bumped into a tram waiting at the station. Jump up onto its roof!';
    case 'bike': return 'Bonk! A bike rider on the promenade.';
    case 'walker': return 'Bumped into someone out for a walk.';
    case 'bar': return 'Bonk! Swipe down to duck under low branches and barriers.';
    case 'branch': return 'A branch at roof height! Swipe down to duck while riding a tram.';
    case 'canopy': return 'The station canopy! Duck (swipe down) when you ride a tram through a station.';
    default: return 'Tripped! Swipe up to jump the low stuff.';
  }
}

export default function Game({ onExit }: GameProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scoreRef = useRef<HTMLDivElement>(null);
  const stopRef = useRef<HTMLDivElement>(null);
  const subRef = useRef<HTMLDivElement>(null);
  const powerRef = useRef<HTMLDivElement>(null);
  const powerBarRef = useRef<HTMLDivElement>(null);
  const powerLabelRef = useRef<HTMLSpanElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  const bannerTimer = useRef(0);
  const [screen, setScreen] = useState<Screen>('start');
  const screenRef = useRef<Screen>('start');
  const [best, setBest] = useState(() => getHighScore(meta.id));
  const bestRef = useRef(best);
  bestRef.current = best;
  const [last, setLast] = useState({ score: 0, newBest: false, why: '', metres: 0, treats: 0 });
  const [hint, setHint] = useState(false);
  const [muted, setMuted] = useState(() => load<boolean>(meta.id, 'muted', false));

  const sfx = useRef(new Sfx());
  const runRef = useRef<Run | null>(null);
  const anim = useRef({ phase: 0, wag: 0, idleD: 0, crashT: 0, shake: 0, camLift: 0 });

  const go = useCallback((s: Screen) => { screenRef.current = s; setScreen(s); }, []);

  useEffect(() => { sfx.current.muted = muted; save(meta.id, 'muted', muted); }, [muted]);

  const start = useCallback(() => {
    sfx.current.unlock();
    runRef.current = new Run((Date.now() ^ (Math.random() * 1e9)) >>> 0, REVIEW.d);
    anim.current.crashT = 0;
    anim.current.shake = 0;
    if (!load<boolean>(meta.id, 'hinted', false)) {
      setHint(true);
      window.setTimeout(() => { setHint(false); save(meta.id, 'hinted', true); }, 4200);
    }
    go('play');
  }, [go]);

  // input
  const act = useCallback((a: 'left' | 'right' | 'jump' | 'duck') => {
    const r = runRef.current;
    if (screenRef.current !== 'play' || !r) return;
    if (a === 'jump') { if (r.jump()) { if (r.power?.kind === 'spring') sfx.current.boing(); else sfx.current.jump(); } }
    else if (a === 'duck') { if (r.duck()) sfx.current.duck(); }
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
      } else if (k === 'ArrowDown' || k === 's' || k === 'S') {
        e.preventDefault();
        act('duck');
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
    else act(dy < 0 ? 'jump' : 'duck');
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
    const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    const showBanner = (title: string, sub: string) => {
      const el = bannerRef.current;
      if (!el) return;
      el.innerHTML = '';
      const t = document.createElement('div'); t.textContent = title; t.className = 'text-[30px] font-black leading-none';
      const u = document.createElement('div'); u.textContent = sub; u.className = 'text-[15px] font-bold mt-1';
      el.append(t, u);
      el.style.opacity = '1'; el.style.transform = 'translateY(0) scale(1)';
      window.clearTimeout(bannerTimer.current);
      bannerTimer.current = window.setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(-12px) scale(0.96)'; }, 2600);
    };
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
        if (local) {
          const w = window as unknown as { __brGod?: boolean; __brRun?: Run };
          w.__brRun = run;
          if (w.__brGod && run.crashed) { run.crashed = false; run.hit = null; ev.length = 0; }
        }
        speed = run.speed;
        for (const e of ev) {
          if (e === 'tramWarn') sfx.current.tramBell();
          else if (e === 'bike') sfx.current.bikeBell();
          else if (e === 'crash') { sfx.current.bonk(); a.shake = 1; a.crashT = 0; }
          else if (e === 'mount') sfx.current.mount();
          else if (e === 'land') sfx.current.land();
          else if (e === 'treat') sfx.current.treat();
          else if (e === 'power') {
            const k = run.power?.kind;
            if (k === 'balloon') sfx.current.balloon(); else if (k === 'spring') sfx.current.boing(); else if (k === 'mult') sfx.current.chime(); else sfx.current.power();
          }
          else if (e === 'powerEnd') sfx.current.pop();
          else if (e === 'shield') { sfx.current.shield(); a.shake = 0.6; }
          else if (e === 'park') { sfx.current.fanfare(); showBanner('Charles Clore Park!', 'The sea! +500'); }
          else if (e === 'lap') { sfx.current.power(); showBanner('Back to HaBesht', 'Lap ' + (run.lap + 1) + ' · faster!'); }
        }
        if (run.crashed) {
          a.crashT += dt;
          if (a.crashT > 0.9) {
            const nb = submitScore(meta.id, run.score);
            setBest(getHighScore(meta.id));
            setLast({ score: run.score, newBest: nb, why: hitLine(run.hit), metres: Math.floor(run.d), treats: run.treats });
            go('over');
          }
        }
        hudTimer += dt;
        if (hudTimer > 0.08 && scoreRef.current) {
          hudTimer = 0;
          scoreRef.current.textContent = `${run.score}`;
          if (subRef.current) subRef.current.textContent = `🦴 ${run.treats} · ${Math.floor(run.d)} m · BEST ${bestRef.current}`;
          const pw = powerRef.current;
          if (pw) {
            const p = run.power;
            pw.style.display = p ? 'flex' : 'none';
            if (p) {
              if (powerLabelRef.current) powerLabelRef.current.textContent = POWER_LABEL[p.kind];
              if (powerBarRef.current) powerBarRef.current.style.width = `${Math.max(0, (100 * (p.until - run.t)) / p.total)}%`;
            }
          }
          // "next stop" banner as a station comes up and while passing its platform
          const el = stopRef.current;
          if (el) {
            const near = stationsIn(run.d - PLATFORM_LEN, run.d + 70);
            const k = near.length ? near[near.length - 1] : -1;
            const ahead = k >= 0 ? platformStart(k) - run.d : 999;
            const show = k >= 0 && ahead < 70 && ahead > -PLATFORM_LEN;
            if (show) {
              const n = station(k);
              const label = `${ahead > 0 ? 'Next stop' : 'Station'}: ${n.en} · ${n.he}`;
              if (el.textContent !== label) el.textContent = label;
            }
            el.style.opacity = show ? '1' : '0';
          }
        }
      } else if (s === 'start') {
        a.idleD += dt * speed;
      }
      if (s === 'play' || s === 'start') {
        const gait = run && !run.crashed && s === 'play' ? 2.1 + speed * 0.11 : s === 'start' ? 1.6 : 0;
        a.phase += dt * Math.PI * 2 * gait;
        a.wag += dt * (run?.crashed ? 4 : 9 + gait * 2.2);
      }
      a.shake = Math.max(0, a.shake - dt * 2.5);
      const useRun = s !== 'start' && run;
      // local playtest aid: window.__brTod (0..1) pins the time of day
      const todOverride = (local ? (window as unknown as { __brTod?: number }).__brTod : undefined) ?? REVIEW.tod;
      // camera rises with Rosie when she is up on a tram roof
      const liftTarget = useRun ? Math.max(0, (run.floating ? run.y - 1.5 : run.base) - 0.4) * 0.55 : 0;
      a.camLift += (liftTarget - a.camLift) * Math.min(1, dt * 5);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      scene.render(g, {
        d: useRun ? run.d : a.idleD,
        t: useRun ? run.t : now / 1000,
        obstacles: useRun ? run.spawner.obstacles : idleObstacles,
        showObstacles: !!useRun,
        shake: a.shake,
        camLift: a.camLift,
        tod: todOverride ?? timeOfDay(useRun ? run.d : 0),
        pickups: useRun ? run.spawner.pickups : [],
        taken: useRun ? run.taken : new Map(),
        magnet: !!(useRun && run.power?.kind === 'magnet'),
        player: {
          lanePos: useRun ? run.lanePos : 1,
          y: useRun ? run.y : 0,
          base: useRun ? run.base : 0,
          vy: useRun ? run.vy : 0,
          phase: a.phase,
          wag: Math.sin(a.wag),
          lean: useRun ? (run.lane - run.lanePos) * 1.2 : 0,
          airborne: useRun ? run.jumpY > 0.05 : false,
          crashed: !!(useRun && run.crashed),
          crashT: useRun && run.crashed ? a.crashT : -1,
          landT: useRun ? run.t - run.landedAt : -1,
          board: !!(useRun && run.power?.kind === 'board'),
          ghost: !!(useRun && run.ghost),
          crouch: useRun ? run.crouch : 0,
          power: useRun ? run.power?.kind ?? null : null,
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
            <div ref={scoreRef} className="font-black text-[30px] leading-none">0</div>
            <div ref={subRef} className="font-bold text-[12px] opacity-90 mt-1 whitespace-nowrap">🦴 0 · 0 m · BEST {best}</div>
            <div ref={powerRef} className="mt-2 mx-auto w-[150px] flex-col items-stretch gap-1 px-3 py-1.5 rounded-xl bg-[rgba(255,248,236,0.9)] text-[#5a2f17] text-[12px] font-black" style={{ display: 'none', textShadow: 'none' }}>
              <span ref={powerLabelRef} />
              <div className="h-[6px] rounded-full bg-[#e6d7bf] overflow-hidden"><div ref={powerBarRef} className="h-full bg-[#1f9aa6]" style={{ width: '100%' }} /></div>
            </div>
            <div ref={stopRef} className="mt-2 px-3 py-1 rounded-full bg-[#d22e2e] text-white text-[12px] font-bold whitespace-nowrap transition-opacity duration-300" style={{ opacity: 0, textShadow: 'none' }} />
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
              Walk Rosie down the boulevard. <b>Swipe ← →</b> to change lanes, <b>swipe ↑</b> to jump, <b>swipe ↓</b> to duck. Dodge walkers and bikes, hop onto the light rail's roof and grab treats and power-ups (🛹 🧲 ⭐x2 🎈 👟).
            </div>
            <button className="br-btn w-full mt-4 py-3 text-[20px]" onClick={start}>PLAY</button>
            <div className="text-[13px] font-bold mt-3 opacity-80">BEST {best}</div>
          </div>
        </div>
      )}

      <div ref={bannerRef} className="absolute inset-x-0 top-[24%] mx-auto w-fit max-w-[92%] px-6 py-3 rounded-2xl bg-[rgba(31,154,166,0.92)] text-white text-center pointer-events-none shadow-xl transition-all duration-500" style={{ opacity: 0, transform: 'translateY(-12px) scale(0.96)' }} />

      {screen === 'play' && hint && (
        <div className="absolute inset-x-0 top-[30%] flex flex-col items-center pointer-events-none br-pop">
          <div className="br-hand text-[44px] leading-none" aria-hidden>👆</div>
          <div className="mt-2 px-4 py-2 rounded-full bg-[rgba(255,248,236,0.9)] text-[#5a2f17] text-[15px] font-bold shadow">
            Swipe ← → to dodge · ↑ jump · ↓ duck
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
            <div className="text-[56px] font-black leading-none mt-3">{last.score}</div>
            <div className="text-[14px] font-bold opacity-80 mt-1">{last.metres} m walked + 🦴 {last.treats} treats</div>
            {last.newBest ? (
              <div className="inline-block mt-2 px-3 py-1 rounded-full bg-[#f2c14e] text-[#5a2f17] text-[13px] font-black">NEW BEST!</div>
            ) : (
              <div className="text-[15px] font-bold mt-2 opacity-80">BEST {best}</div>
            )}
            <button className="br-btn w-full mt-5 py-3 text-[20px]" onClick={start}>RETRY</button>
            <button className="br-btn alt w-full mt-3 py-3 text-[17px]" onClick={onExit}>MAP</button>
          </div>
        </div>
      )}
    </div>
  );
}
