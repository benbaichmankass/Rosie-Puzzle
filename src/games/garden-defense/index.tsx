import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { GameProps } from '../../shared/types';
import { ExitButton } from '../../shared/ExitButton';
import { load, save } from '../../shared/storage';
import { meta } from './meta';
import { createGame, step, TUNING, type GameState } from './sim';
import {
  BUNNY_KINDS,
  bunnyPose,
  bunnyScale,
  depthY,
  drawBunny,
  drawCan,
  drawParticles,
  drawPlant,
  drawPairMeter,
  drawPlantTag,
  drawTargetLine,
  leafPos,
  makeBunnyPuppet,
  makeCanPuppet,
  makeLayout,
  makePlantShape,
  paintBackground,
  paintFence,
  plantTop,
  stepParticles,
  type Layout,
  type Particle,
} from './art';
import { Sfx } from './audio';

const ID = meta.id;
const HINT = 'Tap & hold a hedge to water it';
const HUNGRIER = ['The bunnies are getting hungrier…', 'The bunnies are hopping faster!', 'Greedier and greedier!', 'The bunnies are ravenous!'];
const STEP = 1 / 60;
const FONT = '"Shippori Mincho B1", "Shippori Mincho", "Hiragino Mincho ProN", "Yu Mincho", Georgia, serif';

const fmt = (sec: number) => {
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

type Phase = 'start' | 'play' | 'over';

/** Best result = fastest win (seconds), 0 if never won. */
const BEST_KEY = 'bestWin';

function useFont() {
  useEffect(() => {
    const id = 'gd-font';
    if (document.getElementById(id)) return;
    const l = document.createElement('link');
    l.id = id;
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@500;800&display=swap';
    document.head.appendChild(l);
  }, []);
}

/** Everything the canvas loop needs, kept out of React state. */
interface Engine {
  game: GameState;
  phase: Phase;
  paused: boolean;
  acc: number;
  now: number;
  L: Layout | null;
  dpr: number;
  bg: HTMLCanvasElement | null;
  fence: HTMLCanvasElement | null;
  pointer: { down: boolean; x: number; y: number };
  biteAt: number[];
  bloomAt: number[][];
  particles: Particle[];
  can: { x: number; y: number; tilt: number; init: boolean };
  dropAcc: number;
  overAt: number;
  msg: string;
  msgAt: number;
  milestone: number;
  pouring: boolean;
}

const shapes = [0, 1, 2, 3, 4].map(makePlantShape);
const puppets = BUNNY_KINDS.map((k, i) => makeBunnyPuppet(k, 31 + i * 17));
const canPuppet = makeCanPuppet();

function newEngine(): Engine {
  return {
    game: createGame((Math.random() * 1e9) | 0),
    phase: 'start',
    paused: false,
    acc: 0,
    now: 0,
    L: null,
    dpr: 1,
    bg: null,
    fence: null,
    pointer: { down: false, x: 0, y: 0 },
    biteAt: Array(TUNING.maxBunnies + 1).fill(-9),
    bloomAt: shapes.map(() => []),
    particles: [],
    can: { x: 0, y: 0, tilt: 0, init: false },
    dropAcc: 0,
    overAt: 0,
    msg: '',
    msgAt: -99,
    milestone: 0,
    pouring: false,
  };
}

export default function Game({ onExit }: GameProps) {
  useFont();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const tallRef = useRef<HTMLDivElement>(null);
  const eng = useRef<Engine>(newEngine());
  const sfx = useRef<Sfx>(new Sfx());
  const [phase, setPhase] = useState<Phase>('start');
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState<boolean>(() => load(ID, 'muted', false));
  const [best, setBest] = useState<number>(() => load<number>(ID, BEST_KEY, 0));
  const [result, setResult] = useState({ won: false, time: 0, bunnies: 3, newBest: false });

  useEffect(() => {
    sfx.current.setMuted(muted);
    save(ID, 'muted', muted);
  }, [muted]);

  const startGame = useCallback(() => {
    const e = eng.current;
    sfx.current.unlock();
    sfx.current.start();
    e.game = createGame((Math.random() * 1e9) | 0);
    e.particles = [];
    e.acc = 0;
    e.phase = 'play';
    e.paused = false;
    e.overAt = 0;
    e.msg = HINT;
    e.msgAt = 0;
    e.milestone = 0;
    setPaused(false);
    setPhase('play');
  }, []);

  // Pause when the tab is hidden.
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        sfx.current.suspend();
        if (eng.current.phase === 'play') {
          eng.current.paused = true;
          eng.current.pointer.down = false;
          setPaused(true);
        }
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Canvas loop.
  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const ctx = canvas.getContext('2d')!;
    const e = eng.current;
    // On localhost only: let automated playtests read the game state.
    if (/^(localhost|127\.)/.test(window.location.hostname)) (window as unknown as { __gd?: Engine }).__gd = e;
    let raf = 0;
    let last = performance.now();

    const resize = () => {
      const r = wrap.getBoundingClientRect();
      const W = Math.max(200, Math.round(r.width));
      const H = Math.max(300, Math.round(r.height));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      const L = makeLayout(W, H);
      e.L = L;
      e.dpr = dpr;
      const mk = () => {
        const c = document.createElement('canvas');
        c.width = canvas.width;
        c.height = canvas.height;
        const g = c.getContext('2d')!;
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        return { c, g };
      };
      const bg = mk();
      paintBackground(bg.g, L);
      e.bg = bg.c;
      const fence = mk();
      paintFence(fence.g, L);
      e.fence = fence.c;
      e.can.init = false;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const say = (m: string) => {
      e.msg = m;
      e.msgAt = e.game.t;
    };

    const handleEvents = () => {
      const g = e.game;
      const L = e.L!;
      for (const ev of g.events) {
        if (ev.type === 'grow') {
          if (e.pouring) sfx.current.grow();
        } else if (ev.type === 'tall') {
          sfx.current.tall();
          const tall = g.plants.filter((p) => p.height >= 1).length;
          say(`A hedge reached the line! (${tall} of 5)`);
        } else if (ev.type === 'bloom') {
          e.bloomAt[ev.plant][ev.flower] = e.now;
          sfx.current.grow();
        } else if (ev.type === 'frisky') {
          sfx.current.frisky();
          say('Frisky bunnies! Spray them before the heart fills!');
        } else if (ev.type === 'splash') {
          sfx.current.splash();
          say('Splash! Romance cancelled.');
          for (const b of g.bunnies.filter((q) => q.wetAt === g.t))
            for (let i = 0; i < 14; i++) {
              const ang = Math.random() * Math.PI * 2;
              e.particles.push({
                kind: 'drop',
                x: b.x * L.W,
                y: depthY(L, b.d) - 18 * L.s,
                vx: Math.cos(ang) * 140,
                vy: -120 - Math.random() * 120,
                rot: 0,
                vr: 0,
                life: 0.9,
                max: 0.9,
                color: '',
                floor: depthY(L, b.d) + 4 * L.s,
              });
            }
        } else if (ev.type === 'baby') {
          sfx.current.pop();
          say(`A baby bunny! Now there are ${g.bunnies.length}.`);
          const b = g.bunnies[ev.bunny];
          for (let i = 0; i < 8; i++)
            e.particles.push({
              kind: 'dust',
              x: b.x * L.W + (Math.random() - 0.5) * 30 * L.s,
              y: depthY(L, b.d) - Math.random() * 14 * L.s,
              vx: (Math.random() - 0.5) * 70,
              vy: -30 - Math.random() * 30,
              rot: 0,
              vr: 0,
              life: 0.8,
              max: 0.8,
              color: '',
              floor: 0,
            });
        } else if (ev.type === 'bite') {
          const p = g.plants[ev.plant];
          const [x, y] = leafPos(L, p, shapes[ev.plant], p.leaves);
          e.biteAt[ev.bunny] = e.now;
          e.particles.push({
            kind: 'leaf',
            x,
            y,
            vx: (Math.random() - 0.5) * 120,
            vy: -40 - Math.random() * 40,
            rot: Math.random() * 6,
            vr: (Math.random() - 0.5) * 12,
            life: 1.6,
            max: 1.6,
            color:
              ev.flower >= 0
                ? `rgba(${shapes[ev.plant].flowerSlots[ev.flower].color},0.9)`
                : `rgba(${110 + Math.random() * 30},${140 + Math.random() * 20},100,0.85)`,
            floor: L.plantBaseY + Math.random() * 20 * L.s,
          });
          sfx.current.bite();
        } else if (ev.type === 'die') {
          const p = g.plants[ev.plant];
          for (let i = 0; i < 10; i++) {
            e.particles.push({
              kind: 'dust',
              x: p.x * L.W + (Math.random() - 0.5) * 30 * L.s,
              y: L.plantBaseY - Math.random() * 10 * L.s,
              vx: (Math.random() - 0.5) * 60,
              vy: -20 - Math.random() * 30,
              rot: 0,
              vr: 0,
              life: 0.9,
              max: 0.9,
              color: '',
              floor: 0,
            });
          }
          sfx.current.die();
        } else if (ev.type === 'over') {
          e.overAt = e.now;
          sfx.current.water(false);
          if (ev.won) sfx.current.win();
          else sfx.current.over();
        }
      }
      g.events.length = 0;
    };

    const frame = (ts: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (ts - last) / 1000);
      last = ts;
      const L = e.L;
      if (!L || !e.bg || !e.fence) return;
      const g = e.game;
      const running = e.phase === 'play' && !e.paused && !g.over;
      if (!e.paused || e.phase !== 'play') e.now += dt;

      // What is under the finger: a frisky pair (spray it) or a hedge column (water it).
      let col = -1;
      let sprayPair = -1;
      let pairPos: { x: number; y: number } | null = null;
      if (e.pointer.down && running) {
        for (const pr of g.pairs) {
          const px = pr.x * L.W;
          const py = depthY(L, pr.d) - 14 * L.s;
          if (Math.hypot(e.pointer.x - px, e.pointer.y - py) < 62 * L.s) {
            sprayPair = pr.id;
            pairPos = { x: px, y: py };
          }
        }
        if (sprayPair < 0) col = Math.max(0, Math.min(g.plants.length - 1, Math.floor((e.pointer.x / L.W) * g.plants.length)));
      }
      const watering = col >= 0 && g.plants[col].alive ? col : -1;
      const pouringNow = watering >= 0 || sprayPair >= 0;
      if (pouringNow !== e.pouring) {
        e.pouring = pouringNow;
        sfx.current.water(e.pouring);
      }

      if (running) {
        e.acc += dt;
        while (e.acc >= STEP && !g.over) {
          step(g, STEP, watering, sprayPair);
          e.acc -= STEP;
          handleEvents();
        }
        if (timeRef.current) timeRef.current.textContent = fmt(g.t);
        if (tallRef.current) {
          const tall = g.plants.filter((p) => p.alive && p.height >= 1).length;
          const txt = `${tall} OF 5 TALL · ${g.bunnies.length} BUNNIES`;
          if (tallRef.current.textContent !== txt) tallRef.current.textContent = txt;
        }
        // Every 40 s the bunnies step up a gear: say so.
        const ms = Math.floor(g.t / 40);
        if (ms > e.milestone) {
          e.milestone = ms;
          say(HUNGRIER[Math.min(HUNGRIER.length - 1, ms - 1)]);
        }
        const hint = hintRef.current;
        if (hint) {
          if (hint.textContent !== e.msg) hint.textContent = e.msg;
          const age = g.t - e.msgAt;
          const dur = e.msg === HINT ? 5 : 2.6;
          hint.style.opacity = String(Math.max(0, Math.min(1, dur - age, age * 4)));
        }
      }
      if (e.phase === 'play' && g.over && e.overAt > 0 && e.now - e.overAt > 1.8) {
        e.phase = 'over';
        const time = Math.floor(g.t);
        const prev = load<number>(ID, BEST_KEY, 0);
        const nb = g.won && (prev === 0 || time < prev);
        if (nb) save(ID, BEST_KEY, time);
        setBest(nb ? time : prev);
        setResult({ won: g.won, time: g.t, bunnies: g.bunnies.length, newBest: nb });
        setPhase('over');
      }
      if (!e.paused || e.phase !== 'play') stepParticles(e.particles, dt);

      // ---- draw
      const { W, H, s } = L;
      ctx.setTransform(e.dpr, 0, 0, e.dpr, 0, 0);
      ctx.drawImage(e.bg, 0, 0, W, H);
      const now = e.now;

      g.plants.forEach((p, i) => {
        let wob = 0;
        for (const b of g.bunnies) if (b.mode === 'eat' && b.target === i) wob += Math.sin(now * 40) * 0.03 * Math.exp(-(now - e.biteAt[b.id]) * 6);
        const eaten = g.bunnies.some((b) => b.mode === 'eat' && b.target === i);
        drawPlant(ctx, L, p, shapes[i], now, wob, eaten && p.leaves <= 3 ? 1 : 0, e.bloomAt[i]);
      });
      drawTargetLine(ctx, L, now, FONT);

      const hopH = 16 * s;
      const drawB = (onBed: boolean) => {
        const list = g.bunnies.filter((b) => b.d < 0 === onBed).sort((a, b) => a.d - b.d);
        for (const b of list) {
          const pose = bunnyPose(b, now, now - (e.biteAt[b.id] ?? -9), hopH * b.size, g.t - b.wetAt);
          drawBunny(ctx, puppets[b.kind], b.x * W, depthY(L, b.d), bunnyScale(L, b.d) * b.size, b.face, pose, now);
        }
      };
      drawB(true);
      ctx.drawImage(e.fence, 0, 0, W, H);
      g.plants.forEach((p, i) => {
        const eaten = g.bunnies.some((b) => b.mode === 'eat' && b.target === i);
        drawPlantTag(ctx, L, p, i, now, eaten && p.leaves <= 3 ? 1 : 0);
      });
      drawB(false);
      // Hearts and the countdown over each frisky pair.
      for (const pr of g.pairs) {
        if (!pr.started) continue;
        drawPairMeter(ctx, pr.x * W, depthY(L, pr.d) - 62 * s, s, 1 - pr.timer / TUNING.breedTime, pr.timer, pr.wet, now, FONT);
      }

      drawParticles(ctx, e.particles, s);

      // Watering can: hovers and tips over the plant being watered, otherwise rests in the corner.
      let tx = W - 44 * s;
      let ty = H - 46 * s;
      let tilt = 0.05;
      if (pairPos) {
        tx = pairPos.x + 44 * s;
        ty = pairPos.y - 62 * s;
        tilt = -0.62;
      } else if (col >= 0) {
        const top = plantTop(L, g.plants[col], shapes[col]);
        tx = top.x + 40 * s;
        ty = Math.max(L.plantBaseY - 210 * s, Math.min(top.y - 22 * s, L.plantBaseY - 140 * s));
        tilt = -0.62;
      }
      if (!e.can.init) {
        e.can = { x: tx, y: ty, tilt, init: true };
      }
      const k = Math.min(1, dt * 14);
      e.can.x += (tx - e.can.x) * k;
      e.can.y += (ty - e.can.y) * k;
      e.can.tilt += (tilt - e.can.tilt) * Math.min(1, dt * 10);
      const aiming = col >= 0 || pairPos !== null;
      const wig = aiming ? Math.sin(now * 9) * 0.07 : 0;
      const bob = aiming ? 0 : Math.sin(now * 1.5) * 1.2 * s;
      const rose = drawCan(ctx, canPuppet, e.can.x, e.can.y + bob, 1.25 * s, e.can.tilt, wig);
      if (aiming && e.can.tilt < -0.4 && running) {
        e.dropAcc += dt * 70;
        while (e.dropAcc >= 1) {
          e.dropAcc -= 1;
          e.particles.push({
            kind: 'drop',
            x: rose[0] + (Math.random() - 0.5) * 6 * s,
            y: rose[1] + (Math.random() - 0.5) * 4 * s,
            vx: -50 + Math.random() * 60,
            vy: 30 + Math.random() * 60,
            rot: 0,
            vr: 0,
            life: 1.2,
            max: 1.2,
            color: '',
            floor: pairPos ? pairPos.y + 14 * s + (Math.random() - 0.5) * 8 * s : L.plantBaseY + (Math.random() - 0.3) * 10 * s,
          });
        }
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      sfx.current.suspend();
    };
  }, []);

  // Pointer input: touch/hold a plant to water it, slide to move the can.
  const onDown = (ev: React.PointerEvent) => {
    const e = eng.current;
    if (e.phase !== 'play' || e.paused) return;
    sfx.current.unlock();
    (ev.target as Element).setPointerCapture?.(ev.pointerId);
    const r = wrapRef.current!.getBoundingClientRect();
    e.pointer = { down: true, x: ev.clientX - r.left, y: ev.clientY - r.top };
  };
  const onMove = (ev: React.PointerEvent) => {
    const e = eng.current;
    if (!e.pointer.down) return;
    const r = wrapRef.current!.getBoundingClientRect();
    e.pointer.x = ev.clientX - r.left;
    e.pointer.y = ev.clientY - r.top;
  };
  const onUp = () => {
    eng.current.pointer.down = false;
  };

  const resume = () => {
    sfx.current.unlock();
    eng.current.paused = false;
    setPaused(false);
  };

  const ink = '#2b2420';
  return (
    <div
      className="g-garden-defense fixed inset-0 overflow-hidden select-none"
      style={{ background: '#d8cab0', fontFamily: FONT, color: ink, touchAction: 'none' }}
    >
      <style>{`
        .g-garden-defense .gd-card { background: rgba(248,242,228,0.94); box-shadow: 2px 3px 0 rgba(60,40,20,0.18), 0 10px 30px rgba(60,40,20,0.18); }
        .g-garden-defense .gd-btn { font-family: ${FONT}; font-weight: 800; letter-spacing: 0.08em; border: 2px solid ${ink}; padding: 10px 22px; border-radius: 3px; background: #f7f0df; box-shadow: 2px 3px 0 rgba(43,36,32,0.35); }
        .g-garden-defense .gd-btn:active { transform: translate(1px,2px); box-shadow: 1px 1px 0 rgba(43,36,32,0.35); }
        .g-garden-defense .gd-btn.primary { background: #b73a2e; color: #fbf3e4; border-color: #7d2219; }
        .g-garden-defense .gd-seal { background: #b73a2e; color: #fbefe0; border-radius: 4px; transform: rotate(-4deg); box-shadow: inset 0 0 0 2px rgba(251,239,224,0.5); }
      `}</style>
      <div
        className="relative h-full w-full max-w-[520px] mx-auto overflow-hidden"
        style={{ background: '#f2ead9', boxShadow: '0 0 40px rgba(60,40,20,0.25)' }}
      >
        <div
          ref={wrapRef}
          className="absolute inset-0"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onLostPointerCapture={onUp}
        >
          <canvas ref={canvasRef} className="block" />
        </div>

        {/* HUD */}
        <div
          className="absolute top-0 left-0 right-0 flex items-start justify-between px-3 pointer-events-none"
          style={{ paddingTop: 'max(10px, env(safe-area-inset-top))' }}
        >
          <div className="pointer-events-auto">
            <ExitButton onExit={onExit} className="!bg-[#f7f0df] !text-[#2b2420] !border-[#2b2420] shadow-[2px_2px_0_rgba(43,36,32,0.3)]" />
          </div>
          <div className="text-center" style={{ visibility: phase === 'play' ? 'visible' : 'hidden' }}>
            <div ref={timeRef} className="text-[34px] leading-none font-extrabold" style={{ textShadow: '0 1px 0 rgba(255,255,255,0.5)' }}>
              0:00
            </div>
            <div ref={tallRef} className="text-[11px] tracking-[0.18em] opacity-80 mt-1 font-extrabold" />
          </div>
          <button
            className="pointer-events-auto w-9 h-9 rounded-full border-2 flex items-center justify-center text-[16px] bg-[#f7f0df]"
            style={{ borderColor: ink, boxShadow: '2px 2px 0 rgba(43,36,32,0.3)' }}
            aria-label={muted ? 'Unmute' : 'Mute'}
            onClick={() => {
              sfx.current.unlock();
              setMuted((m) => !m);
            }}
          >
            {muted ? '🔇' : '🔊'}
          </button>
        </div>

        {phase === 'play' && (
          <div
            ref={hintRef}
            className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-center pointer-events-none text-[15px] font-extrabold px-3 py-1 rounded"
            style={{ top: '44%', transition: 'opacity 0.3s', background: 'rgba(248,242,228,0.88)', boxShadow: '1px 2px 0 rgba(60,40,20,0.15)' }}
          >
            {HINT}
          </div>
        )}

        {phase === 'start' && (
          <div className="absolute inset-x-0 flex justify-center px-4" style={{ top: '12%' }}>
            <div className="gd-card relative w-full max-w-[340px] px-6 pt-6 pb-5 text-center">
              <div className="gd-seal absolute -top-3 -right-2 w-12 h-12 flex items-center justify-center text-[26px] font-extrabold">庭</div>
              <div className="text-[13px] tracking-[0.3em] opacity-60">THE YARD</div>
              <h1 className="text-[34px] font-extrabold leading-tight mt-1">Garden Defense</h1>
              <p className="text-[15px] mt-3 leading-snug">Grow all five hedges up to the red line to hide the nosy neighbours, before the bunnies eat one.</p>
              <p className="text-[13px] mt-2 opacity-75 leading-snug">
                Tap or hold a hedge to water it. If two bunnies get frisky, spray them before the heart fills, or there will be more bunnies!
              </p>
              {best > 0 && <p className="text-[13px] mt-3 tracking-[0.12em]">BEST {fmt(best)}</p>}
              <button className="gd-btn primary mt-4 text-[18px]" onClick={startGame}>
                PLAY
              </button>
            </div>
          </div>
        )}

        {phase === 'over' && (
          <div className="absolute inset-x-0 flex justify-center px-4" style={{ top: '14%' }}>
            <div className="gd-card relative w-full max-w-[340px] px-6 pt-6 pb-5 text-center">
              <div className="gd-seal absolute -top-3 -right-2 w-12 h-12 flex items-center justify-center text-[26px] font-extrabold">
                {result.won ? '勝' : '兎'}
              </div>
              <h2 className="text-[28px] font-extrabold leading-tight">{result.won ? 'The view is hidden!' : 'They can see in!'}</h2>
              <p className="text-[14px] mt-2 opacity-75 leading-snug">
                {result.won ? 'All five hedges reached the line in' : 'The bunnies ate a hedge and the neighbours are peeking through the gap. You lasted'}
              </p>
              <div className="text-[46px] font-extrabold leading-none mt-1">{fmt(result.time)}</div>
              <p className="text-[13px] mt-2 opacity-75">
                {result.bunnies > 3 ? `The bunnies multiplied to ${result.bunnies}.` : result.won ? 'No baby bunnies. Well sprayed!' : ''}
              </p>
              <p className="text-[13px] mt-2 tracking-[0.12em]">{result.newBest ? 'NEW BEST!' : best > 0 ? `BEST ${fmt(best)}` : 'Win to set a best.'}</p>
              <div className="flex justify-center gap-3 mt-4">
                <button className="gd-btn primary text-[16px]" onClick={startGame}>
                  RETRY
                </button>
                <button className="gd-btn text-[16px]" onClick={onExit}>
                  MAP
                </button>
              </div>
            </div>
          </div>
        )}

        {paused && phase === 'play' && (
          <button className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(242,234,217,0.6)' }} onClick={resume}>
            <div className="gd-card px-8 py-6 text-center">
              <div className="text-[26px] font-extrabold">Paused</div>
              <div className="text-[14px] mt-1 opacity-75">Tap to continue</div>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
