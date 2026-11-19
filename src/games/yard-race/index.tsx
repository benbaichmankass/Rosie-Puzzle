import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GameProps } from '../../shared/types';
import { ExitButton } from '../../shared/ExitButton';
import { load, save } from '../../shared/storage';
import { meta } from './meta';
import { BUNNY_COST, TUNING, brakeDistance, createRace, step, type Input, type Race } from './sim';
import { FOOD, LAP, WORLD, nextFood, pointAt } from './track';
import { CPU_BUNNY, CPU_TURTLE, bunnyBrain, mulberry, turtleBrain, type Brain } from './ai';
import { C, drawBunny, drawFood, drawParticles, drawTurtle, paintYard, stepParticles, type Particle } from './art';
import { Sfx } from './audio';

const ID = meta.id;
const FONT = '"Fredoka", "Baloo 2", "Trebuchet MS", system-ui, sans-serif';
const STEP = 1 / 120;
const PANEL_MIN = 196;
const LANE = 9; // sideways offset of each racer from the centre line
const HOP = 26; // world units per bunny hop
const AFTER_MAX = 12; // seconds the second racer gets to finish after the winner
const T = 0;
const B = 1;

type Mode = '2p' | 'turtle' | 'bunny';
type Phase = 'menu' | 'count' | 'race' | 'photo' | 'after' | 'result';
interface Best {
  turtle: number;
  bunny: number;
}
interface Result {
  winner: number;
  times: [number | null, number | null];
  newBest: [boolean, boolean];
  margin: number | null;
}

const fmt = (t: number) => `${t.toFixed(2)}s`;
const names = ['Turtle', 'Bunny'];

function useFont() {
  useEffect(() => {
    const id = 'yr-font';
    if (document.getElementById(id)) return;
    const l = document.createElement('link');
    l.id = id;
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&display=swap';
    document.head.appendChild(l);
  }, []);
}

/** Small portrait icons of the racers, drawn once with the game's own art. */
function useIcons() {
  return useMemo(() => {
    const mk = (fn: (g: CanvasRenderingContext2D) => void) => {
      if (typeof document === 'undefined') return '';
      const c = document.createElement('canvas');
      c.width = 96;
      c.height = 96;
      const g = c.getContext('2d');
      if (!g) return '';
      g.scale(3, 3);
      fn(g);
      return c.toDataURL();
    };
    return {
      turtle: mk((g) => drawTurtle(g, 15, 17, -Math.PI / 2, { scale: 1.05, steps: 0, t: 0, tired: false, stepPhase: 0.5 })),
      bunny: mk((g) => drawBunny(g, 16, 18, -Math.PI / 2, { scale: 1.05, hop: 0, running: false, eating: false, flop: false, t: 0 })),
    };
  }, []);
}

interface View {
  W: number;
  H: number;
  dpr: number;
  scale: number;
  ox: number;
}

interface Engine {
  race: Race;
  mode: Mode;
  phase: Phase;
  paused: boolean;
  brains: (Brain | null)[];
  taps: number;
  holds: Set<number>;
  keyHold: boolean;
  acc: number;
  now: number;
  countT: number;
  photoT: number;
  afterT: number;
  view: View | null;
  bg: HTMLCanvasElement | null;
  particles: Particle[];
  hopIdx: number;
  munchT: number;
  photo: HTMLCanvasElement | null;
  photoBg: HTMLCanvasElement | null;
  photoCaption: string;
  slow: number;
  lastBeep: number;
  rng: () => number;
}

function newEngine(): Engine {
  return {
    race: createRace(['turtle', 'bunny']),
    mode: '2p',
    phase: 'menu',
    paused: false,
    brains: [null, null],
    taps: 0,
    holds: new Set(),
    keyHold: false,
    acc: 0,
    now: 0,
    countT: 0,
    photoT: 0,
    afterT: 0,
    view: null,
    bg: null,
    particles: [],
    hopIdx: 0,
    munchT: 0,
    photo: null,
    photoBg: null,
    photoCaption: '',
    slow: 1,
    lastBeep: 99,
    rng: mulberry(1),
  };
}

const human = (mode: Mode, who: number) => mode === '2p' || (mode === 'turtle' ? who === T : who === B);

const PHOTO_ZOOM = 3.2;
const PHOTO_W = 300;
const PHOTO_H = 210;
const photoCenter = () => {
  const fl = pointAt(0);
  return { cx: fl.x + 6, cy: fl.y + 8 };
};
let photoBgCache: HTMLCanvasElement | null = null;
/** A sharp, zoomed-in paint of the yard around the finish line for the photo-finish snapshot (cropped to the photo). */
function makePhotoBg(): HTMLCanvasElement {
  if (photoBgCache) return photoBgCache;
  const { cx, cy } = photoCenter();
  const k = PHOTO_ZOOM * 2;
  const w = PHOTO_W / PHOTO_ZOOM;
  const h = PHOTO_H / PHOTO_ZOOM;
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * k);
  c.height = Math.ceil(h * k);
  const g = c.getContext('2d')!;
  g.scale(k, k);
  g.translate(-(cx - w / 2), -(cy - h / 2));
  paintYard(g);
  photoBgCache = c;
  return c;
}

/** Draws racers (and food) for the live view and the photo-finish snapshot. */
function drawRacers(g: CanvasRenderingContext2D, e: Engine) {
  const [tu, bu] = e.race.racers;
  const items: { y: number; draw: () => void }[] = [];
  const tp = pointAt(tu.s, -LANE);
  const since = e.race.t - tu.lastStep;
  items.push({
    y: tp.y,
    draw: () =>
      drawTurtle(g, tp.x, tp.y, tp.angle, {
        scale: 1.2,
        steps: tu.steps,
        t: e.now,
        tired: false,
        stepPhase: Math.min(1, since * TUNING.turtlePace),
      }),
  });
  const bp = pointAt(bu.s, LANE);
  const running = bu.v > 4 && bu.state === 'run';
  items.push({
    y: bp.y,
    draw: () =>
      drawBunny(g, bp.x, bp.y, bp.angle, {
        scale: 1.2,
        hop: running ? (bu.s % HOP) / HOP : 0,
        running,
        eating: bu.state === 'eat' || bu.state === 'sit',
        flop: bu.state === 'flop',
        t: e.now,
      }),
  });
  items.sort((a, b) => a.y - b.y).forEach((i) => i.draw());
}

export default function Game({ onExit }: GameProps) {
  useFont();
  const icons = useIcons();
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const eng = useRef<Engine>(newEngine());
  const sfx = useRef<Sfx>(new Sfx());
  const ui = useRef<{ fill: (HTMLDivElement | null)[]; mark: (HTMLDivElement | null)[]; status: (HTMLDivElement | null)[]; btn: (HTMLButtonElement | null)[] }>({
    fill: [null, null],
    mark: [null, null],
    status: [null, null],
    btn: [null, null],
  });
  const [phase, setPhase] = useState<Phase>('menu');
  const [mode, setMode] = useState<Mode>('2p');
  const [trackH, setTrackH] = useState(500);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState<boolean>(() => load(ID, 'muted', false));
  const [best, setBest] = useState<Best>(() => load<Best>(ID, 'best', { turtle: 0, bunny: 0 }));
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    sfx.current.setMuted(muted);
    save(ID, 'muted', muted);
  }, [muted]);

  const startRace = useCallback((m: Mode) => {
    const e = eng.current;
    sfx.current.unlock();
    e.mode = m;
    e.race = createRace(['turtle', 'bunny']);
    e.rng = mulberry((Math.random() * 1e9) | 0);
    e.brains = [
      human(m, T) ? null : turtleBrain(CPU_TURTLE, e.rng),
      human(m, B) ? null : bunnyBrain(CPU_BUNNY, e.rng),
    ];
    e.taps = 0;
    e.holds.clear();
    e.keyHold = false;
    e.acc = 0;
    e.countT = 3;
    e.lastBeep = 99;
    e.particles = [];
    e.hopIdx = 0;
    e.photo = null;
    e.afterT = 0;
    e.slow = 1;
    e.phase = 'count';
    e.paused = false;
    window.setTimeout(() => (e.photoBg = makePhotoBg()), 300);
    setPaused(false);
    setMode(m);
    setResult(null);
    setPhase('count');
  }, []);

  const finishRace = useCallback(() => {
    const e = eng.current;
    if (e.phase === 'result') return;
    e.phase = 'result';
    const r = e.race;
    const times: [number | null, number | null] = [r.racers[T].finished ? r.racers[T].finishT : null, r.racers[B].finished ? r.racers[B].finishT : null];
    const prev = load<Best>(ID, 'best', { turtle: 0, bunny: 0 });
    const nb: [boolean, boolean] = [false, false];
    const next = { ...prev };
    (['turtle', 'bunny'] as const).forEach((k, i) => {
      const t = times[i];
      if (t !== null && human(e.mode, i) && (!prev[k] || t < prev[k])) {
        next[k] = t;
        nb[i] = true;
      }
    });
    if (nb[0] || nb[1]) save(ID, 'best', next);
    setBest(next);
    const margin = times[0] !== null && times[1] !== null ? Math.abs(times[0] - times[1]) : null;
    setResult({ winner: r.winner, times, newBest: nb, margin });
    setPhase('result');
  }, []);

  // Pause when the tab is hidden.
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        sfx.current.suspend();
        const e = eng.current;
        if (e.phase === 'count' || e.phase === 'race' || e.phase === 'after') {
          e.paused = true;
          e.holds.clear();
          setPaused(true);
        }
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Keyboard (desktop): A = turtle step, L = bunny run; Space drives your racer in 1-player mode.
  useEffect(() => {
    const down = (ev: KeyboardEvent) => {
      const e = eng.current;
      if (ev.repeat) {
        if (ev.code === 'Space') ev.preventDefault();
        return;
      }
      const k = ev.key.toLowerCase();
      const turtleKey = k === 'a' || (ev.code === 'Space' && e.mode === 'turtle');
      const bunnyKey = k === 'l' || (ev.code === 'Space' && e.mode === 'bunny');
      if (ev.code === 'Space') ev.preventDefault();
      if (turtleKey && human(e.mode, T)) tapTurtle();
      if (bunnyKey && human(e.mode, B)) e.keyHold = true;
    };
    const up = (ev: KeyboardEvent) => {
      const k = ev.key.toLowerCase();
      if (k === 'l' || ev.code === 'Space') eng.current.keyHold = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Canvas loop.
  useEffect(() => {
    const canvas = canvasRef.current!;
    const root = rootRef.current!;
    const ctx = canvas.getContext('2d')!;
    const e = eng.current;
    let raf = 0;
    let last = performance.now();

    const resize = () => {
      const r = root.getBoundingClientRect();
      const W = Math.max(280, Math.round(r.width));
      const H = Math.max(480, Math.round(r.height));
      const scale = Math.min(W / WORLD.w, (H - PANEL_MIN) / WORLD.h);
      const th = Math.round(WORLD.h * scale);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(th * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${th}px`;
      e.view = { W, H: th, dpr, scale, ox: (W - WORLD.w * scale) / 2 };
      const bg = document.createElement('canvas');
      bg.width = Math.round(WORLD.w * scale * dpr);
      bg.height = Math.round(WORLD.h * scale * dpr);
      const g = bg.getContext('2d')!;
      g.scale(scale * dpr, scale * dpr);
      paintYard(g);
      e.bg = bg;
      setTrackH(th);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(root);

    const dust = (x: number, y: number, n: number, spread: number) => {
      for (let i = 0; i < n; i++)
        e.particles.push({
          kind: 'dust',
          x: x + (Math.random() - 0.5) * spread,
          y: y + (Math.random() - 0.5) * spread,
          vx: (Math.random() - 0.5) * 30,
          vy: (Math.random() - 0.5) * 30,
          life: 0.5,
          max: 0.5,
          r: 1.5 + Math.random() * 1.5,
          color: '',
          rot: 0,
        });
    };

    const takePhoto = (winner: number) => {
      const r = e.race;
      const pw = PHOTO_W;
      const ph = PHOTO_H;
      const c = document.createElement('canvas');
      c.width = pw * 2;
      c.height = ph * 2;
      const g = c.getContext('2d')!;
      g.scale(2, 2);
      const { cx, cy } = photoCenter();
      g.save();
      g.translate(pw / 2, ph / 2);
      g.scale(PHOTO_ZOOM, PHOTO_ZOOM);
      g.translate(-cx, -cy);
      const hi = e.photoBg ?? makePhotoBg();
      g.drawImage(hi, cx - pw / 2 / PHOTO_ZOOM, cy - ph / 2 / PHOTO_ZOOM, pw / PHOTO_ZOOM, ph / PHOTO_ZOOM);
      drawRacers(g, e);
      g.restore();
      // photo-finish tint + timestamp
      g.fillStyle = 'rgba(255,214,150,0.16)';
      g.fillRect(0, 0, pw, ph);
      const vg = g.createRadialGradient(pw / 2, ph / 2, ph * 0.3, pw / 2, ph / 2, pw * 0.7);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(40,20,0,0.35)');
      g.fillStyle = vg;
      g.fillRect(0, 0, pw, ph);
      g.font = `700 15px ${FONT}`;
      g.fillStyle = '#ffdf6a';
      g.textAlign = 'right';
      g.fillText(fmt(r.racers[winner].finishT), pw - 10, ph - 10);
      e.photo = c;
      const loser = r.racers[1 - winner];
      const eta = (LAP - loser.s) / (loser.kind === 'turtle' ? 28 : TUNING.bunnySpeed);
      e.photoCaption = eta < 1.2 ? 'PHOTO FINISH!' : `${names[winner].toUpperCase()} WINS!`;
    };

    const handleEvents = () => {
      const r = e.race;
      for (const ev of r.events) {
        if (ev.type === 'step') {
          sfx.current.step();
          const p = pointAt(r.racers[T].s, -LANE);
          dust(p.x - p.tx * 8, p.y - p.ty * 8, 2, 8);
        } else if (ev.type === 'eat-start') sfx.current.munch();
        else if (ev.type === 'flop') {
          sfx.current.flop();
          const p = pointAt(r.racers[B].s, LANE);
          dust(p.x, p.y, 10, 14);
        } else if (ev.type === 'up') sfx.current.up();
        else if (ev.type === 'finish') {
          if (ev.first) {
            takePhoto(ev.who);
            sfx.current.shutter();
            e.phase = 'photo';
            e.photoT = 0;
            // keep held fingers: the second racer carries straight on after the photo
          } else if (e.phase === 'after') {
            sfx.current.click();
          }
        }
      }
      r.events.length = 0;
    };

    const inputs = (dt: number): Input[] => {
      const r = e.race;
      return r.racers.map((rc, i) => {
        const b = e.brains[i];
        if (b) return b.input(rc, r.t, dt);
        if (i === T) {
          const taps = e.taps;
          e.taps = 0;
          return { hold: false, taps };
        }
        return { hold: e.holds.size > 0 || e.keyHold, taps: 0 };
      });
    };

    const confetti = (x: number, y: number) => {
      const cols = ['#f2b0bb', '#ffd43a', '#79b84a', '#1f9aa6', '#e8792a'];
      for (let i = 0; i < 40; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 30 + Math.random() * 70;
        e.particles.push({ kind: 'confetti', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: 1.6, max: 1.6, r: 1.6, color: cols[i % cols.length], rot: Math.random() * 6 });
      }
    };

    const updatePanels = () => {
      const r = e.race;
      const U = ui.current;
      r.racers.forEach((rc, i) => {
        const fill = U.fill[i];
        if (fill) {
          fill.style.width = `${Math.max(0, rc.energy) * 100}%`;
          const low = rc.energy < 0.2;
          fill.style.background = i === T ? '#7fb24a' : rc.state === 'flop' ? '#c9a0a0' : low ? '#e86a5a' : '#f2a0b0';
        }
        const mark = U.mark[i];
        let status = '';
        let tone = '';
        if (i === T) {
          // the turtle's bar is a lap gauge (always exactly enough): coach the tapping speed instead
          if (mark) mark.style.opacity = '0';
          const pace = rc.v / TUNING.turtleMax;
          if (rc.finished) status = 'Finished!';
          else if (e.phase === 'count') status = 'Get ready to tap fast!';
          else if (rc.v < 4) status = 'Tap to walk!';
          else if (pace < 0.72) {
            status = 'Faster! Tap tap tap!';
            tone = 'warn';
          } else if (pace < 0.88) {
            status = 'Good pace, keep it up';
            tone = 'good';
          } else {
            status = 'Top speed! ✓';
            tone = 'good';
          }
        } else {
          // marker: energy needed to reach the next food spot
          const nf = nextFood(rc.s + 1);
          const target = nf >= 0 && rc.state !== 'eat' ? (FOOD[nf].s0 + FOOD[nf].s1) / 2 : LAP;
          const need = (target - rc.s) * BUNNY_COST;
          if (mark) {
            mark.style.left = `${Math.min(1, Math.max(0, need)) * 100}%`;
            mark.style.opacity = rc.finished || need > 1 || e.phase === 'menu' ? '0' : '1';
          }
          if (rc.finished) status = 'Finished!';
          else if (e.phase === 'count') status = 'Hold to run, let go on food';
          else if (rc.state === 'flop') {
            status = 'Flopped! Recovering…';
            tone = 'bad';
          } else if (rc.state === 'eat') {
            status = `Munching… ${Math.round(rc.energy * 100)}%`;
            tone = 'good';
          } else if (rc.state === 'sit') status = 'Sitting down to eat…';
          else if (rc.state === 'wait') status = rc.energy < 0.99 ? 'No food here: hold to run' : 'Hold to run';
          else if (rc.energy < need && nf >= 0) {
            status = "Won't reach the food!";
            tone = 'bad';
          } else if (rc.energy < 0.25) {
            status = 'Hungry! Stop on food';
            tone = 'warn';
          } else status = 'Zoom!';
        }
        const st = U.status[i];
        if (st && st.textContent !== status) {
          st.textContent = status;
          st.dataset.tone = tone;
        }
        const btn = U.btn[i];
        if (btn) {
          const on = i === B ? e.holds.size > 0 || e.keyHold : e.now - rc.lastStep < 0.08 && e.phase !== 'menu';
          if (btn.dataset.on !== String(on)) btn.dataset.on = String(on);
        }
      });
    };

    const frame = (ts: number) => {
      raf = requestAnimationFrame(frame);
      const rdt = Math.min(0.05, (ts - last) / 1000);
      last = ts;
      const v = e.view;
      if (!v || !e.bg) return;
      if (!e.paused) e.now += rdt;
      const r = e.race;

      if (!e.paused) {
        if (e.phase === 'count') {
          const before = Math.ceil(e.countT);
          e.countT -= rdt;
          const after = Math.ceil(e.countT);
          if (after !== before || e.lastBeep === 99) {
            if (after > 0) sfx.current.beep(false);
            e.lastBeep = after;
          }
          if (e.countT <= 0) {
            sfx.current.beep(true);
            e.phase = 'race';
            e.taps = 0;
            setPhase('race');
          }
        } else if (e.phase === 'race' || e.phase === 'after') {
          // slow motion when the finish is going to be close
          let slow = 1;
          if (e.phase === 'race') {
            const etas = r.racers.map((rc) => (LAP - rc.s) / Math.max(rc.v, 12));
            if (Math.min(...etas) < 0.9 && Math.abs(etas[0] - etas[1]) < 0.7) slow = 0.35;
          }
          e.slow += (slow - e.slow) * Math.min(1, rdt * 8);
          e.acc += rdt * e.slow;
          while (e.acc >= STEP) {
            e.acc -= STEP;
            const before = e.phase;
            step(r, STEP, inputs(STEP));
            handleEvents();
            if (e.phase !== before) {
              e.acc = 0;
              break;
            }
          }
          if (e.phase === 'after') {
            e.afterT += rdt;
            if (r.over || e.afterT > AFTER_MAX) finishRace();
          }
          // bunny hop dust + sound
          const bu = r.racers[B];
          const hi = Math.floor(bu.s / HOP);
          if (hi !== e.hopIdx) {
            e.hopIdx = hi;
            if (bu.v > 20) {
              sfx.current.hop();
              const p = pointAt(bu.s, LANE);
              dust(p.x - p.tx * 6, p.y - p.ty * 6, 3, 6);
            }
          }
          if (bu.state === 'eat') {
            e.munchT -= rdt;
            if (e.munchT <= 0) {
              e.munchT = 0.32;
              sfx.current.munch();
              const p = pointAt(bu.s, LANE);
              const f = FOOD[bu.food] ?? FOOD[0];
              const col = f.kind === 'carrot' ? '#e8792a' : f.kind === 'dandelion' ? '#ffd43a' : '#8cc45a';
              for (let i = 0; i < 3; i++)
                e.particles.push({
                  kind: 'crumb',
                  x: p.x + p.tx * 10,
                  y: p.y + p.ty * 10,
                  vx: (Math.random() - 0.5) * 40,
                  vy: (Math.random() - 0.5) * 40,
                  life: 0.6,
                  max: 0.6,
                  r: 1.1,
                  color: col,
                  rot: Math.random() * 6,
                });
            }
          }
        } else if (e.phase === 'photo') {
          e.photoT += rdt;
          if (e.photoT > 2.4) {
            if (e.photoT - rdt <= 2.4) {
              const p = pointAt(0);
              confetti(p.x, p.y);
            }
            if (r.over) finishRace();
            else {
              e.phase = 'after';
              e.afterT = 0;
              setPhase('after');
            }
          }
          if (e.photoT - rdt <= 0.5 && e.photoT > 0.5) sfx.current.fanfare();
        }
        stepParticles(e.particles, rdt);
      }

      // ---- draw
      const { dpr, scale, ox } = v;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#7a4f33';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, 0);
      ctx.drawImage(e.bg, 0, 0, WORLD.w, WORLD.h);
      const bu = r.racers[B];
      const active = FOOD.map((_, i) => bu.state === 'eat' && bu.food === i);
      const hl = human(e.mode, B) && !bu.finished && e.phase !== 'menu' ? nextFood(bu.s) : -1;
      // "let go now" cue: releasing here would stop the human bunny inside the next food patch
      let cue = -1;
      if (hl >= 0 && bu.state === 'run' && bu.v > 20) {
        const stop = bu.s + brakeDistance(bu.v);
        if (stop >= FOOD[hl].s0 + 3 && stop <= FOOD[hl].s1 - 3) cue = hl;
      }
      drawFood(ctx, e.now, active, hl, cue);
      drawParticles(ctx, e.particles.filter((p) => p.kind !== 'confetti'));
      drawRacers(ctx, e);
      drawParticles(ctx, e.particles.filter((p) => p.kind === 'confetti'));
      drawRoof(ctx, e);

      // screen-space overlays
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const W = v.W;
      const H = v.H;
      if (e.phase === 'count') {
        const n = Math.ceil(e.countT);
        const k = e.countT - Math.floor(e.countT);
        ctx.save();
        ctx.translate(W * 0.26, H * 0.42);
        ctx.scale(1 + k * 0.4, 1 + k * 0.4);
        ctx.font = `700 74px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 8;
        ctx.strokeStyle = '#3a2618';
        ctx.strokeText(String(n), 0, 0);
        ctx.fillStyle = '#fff3d6';
        ctx.fillText(String(n), 0, 0);
        ctx.restore();
      } else if (e.phase === 'race' && r.t < 0.8) {
        ctx.save();
        ctx.globalAlpha = 1 - r.t / 0.8;
        ctx.translate(W * 0.26, H * 0.42);
        ctx.scale(1 + r.t, 1 + r.t);
        ctx.font = `700 64px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 8;
        ctx.strokeStyle = '#3a2618';
        ctx.strokeText('GO!', 0, 0);
        ctx.fillStyle = '#ffd43a';
        ctx.fillText('GO!', 0, 0);
        ctx.restore();
      }
      if (e.slow < 0.9 && e.phase === 'race') {
        ctx.fillStyle = `rgba(40,20,5,${(1 - e.slow) * 0.35})`;
        ctx.fillRect(0, 0, W, 6);
        ctx.fillRect(0, H - 6, W, 6);
      }
      if (e.phase === 'photo' && e.photo) {
        const t = e.photoT;
        // flash
        if (t < 0.45) {
          ctx.fillStyle = `rgba(255,255,255,${1 - t / 0.45})`;
          ctx.fillRect(0, 0, W, H);
        }
        const pw = Math.min(W - 40, 300);
        const ph = pw * 0.7;
        const k = Math.min(1, t / 0.35);
        const ease = 1 - (1 - k) ** 3;
        ctx.save();
        ctx.translate(W / 2, H * 0.45 + (1 - ease) * 60);
        ctx.rotate(-0.05 + (1 - ease) * 0.2);
        ctx.globalAlpha = ease;
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(-pw / 2 - 10 + 4, -ph / 2 - 10 + 6, pw + 20, ph + 56);
        ctx.fillStyle = '#fbf7ee';
        ctx.fillRect(-pw / 2 - 10, -ph / 2 - 10, pw + 20, ph + 56);
        ctx.drawImage(e.photo, -pw / 2, -ph / 2, pw, ph);
        ctx.font = `700 22px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#3a2618';
        ctx.fillText(e.photoCaption, 0, ph / 2 + 32);
        ctx.restore();
      }
      updatePanels();
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      sfx.current.suspend();
    };
  }, [finishRace]);

  const tapTurtle = () => {
    const e = eng.current;
    if (e.phase === 'race' || e.phase === 'after') e.taps++;
  };

  const onTurtleDown = (ev: React.PointerEvent) => {
    ev.preventDefault();
    sfx.current.unlock();
    tapTurtle();
  };
  const onBunnyDown = (ev: React.PointerEvent) => {
    ev.preventDefault();
    sfx.current.unlock();
    eng.current.holds.add(ev.pointerId);
    try {
      (ev.currentTarget as Element).setPointerCapture?.(ev.pointerId);
    } catch {
      /* synthetic or already-released pointer */
    }
  };
  const onBunnyUp = (ev: React.PointerEvent) => {
    eng.current.holds.delete(ev.pointerId);
  };

  const resume = () => {
    sfx.current.unlock();
    eng.current.paused = false;
    setPaused(false);
  };

  const skipAfter = () => {
    finishRace();
  };

  const racing = phase === 'count' || phase === 'race' || phase === 'photo' || phase === 'after';
  const panelFor = (who: number) => {
    const isHuman = human(mode, who);
    const turtle = who === T;
    const wide = mode === '2p' || isHuman;
    return (
      <div
        key={who}
        className={`yr-panel ${turtle ? 'turtle' : 'bunny'} flex flex-col min-w-0`}
        style={{ flex: wide ? (mode === '2p' ? 1 : 2.2) : 1 }}
      >
        <div className="flex items-center gap-1.5 px-2 pt-1.5">
          <img src={turtle ? icons.turtle : icons.bunny} alt="" className="w-7 h-7 -my-1" />
          <div className="font-bold text-[15px] leading-none">{turtle ? 'TURTLE' : 'BUNNY'}</div>
          <div className="ml-auto text-[11px] font-bold opacity-70 tracking-wider">{mode === '2p' ? (turtle ? 'P1' : 'P2') : isHuman ? 'YOU' : 'CPU'}</div>
        </div>
        <div className="px-2 pt-1">
          <div className="yr-bar">
            <div ref={(el) => void (ui.current.fill[who] = el)} className="yr-fill" />
            <div ref={(el) => void (ui.current.mark[who] = el)} className="yr-mark" />
          </div>
          <div ref={(el) => void (ui.current.status[who] = el)} className="yr-status" />
        </div>
        {isHuman ? (
          <button
            ref={(el) => void (ui.current.btn[who] = el)}
            className={`yr-big ${turtle ? 'turtle' : 'bunny'}`}
            onPointerDown={turtle ? onTurtleDown : onBunnyDown}
            onPointerUp={turtle ? undefined : onBunnyUp}
            onPointerCancel={turtle ? undefined : onBunnyUp}
            onLostPointerCapture={turtle ? undefined : onBunnyUp}
            onContextMenu={(ev) => ev.preventDefault()}
            aria-label={turtle ? 'Turtle: tap to step' : 'Bunny: hold to run'}
          >
            <span className="yr-big-label">{turtle ? 'TAP' : 'HOLD'}</span>
            <span className="yr-big-sub">{turtle ? 'tap fast & keep going' : 'let go on food to eat'}</span>
          </button>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[13px] font-bold opacity-60 px-2 text-center">Computer</div>
        )}
      </div>
    );
  };

  const winnerName = result ? names[result.winner] : '';
  const ink = C.ink;
  return (
    <div className="g-yard-race fixed inset-0 overflow-hidden select-none" style={{ background: '#5a3a26', fontFamily: FONT, color: ink, touchAction: 'none' }}>
      <style>{`
        .g-yard-race .yr-card { background: #fbf3e2; border: 3px solid ${ink}; border-radius: 16px; box-shadow: 0 6px 0 rgba(58,38,24,0.45), 0 18px 40px rgba(0,0,0,0.35); }
        .g-yard-race .yr-btn { font-family: ${FONT}; font-weight: 700; border: 3px solid ${ink}; border-radius: 12px; padding: 10px 14px; background: #fff8ea; box-shadow: 0 4px 0 ${ink}; }
        .g-yard-race .yr-btn:active { transform: translateY(3px); box-shadow: 0 1px 0 ${ink}; }
        .g-yard-race .yr-btn.green { background: #8fc35a; }
        .g-yard-race .yr-btn.pink { background: #f6b8c4; }
        .g-yard-race .yr-btn.gold { background: #ffd45a; }
        .g-yard-race .yr-panel { border-top: 3px solid ${ink}; }
        .g-yard-race .yr-panel.turtle { background: linear-gradient(#cfe0a8, #b4cf84); }
        .g-yard-race .yr-panel.bunny { background: linear-gradient(#fbe3e6, #f3c6ce); border-left: 3px solid ${ink}; }
        .g-yard-race .yr-bar { position: relative; height: 14px; border: 2px solid ${ink}; border-radius: 8px; background: rgba(255,255,255,0.6); overflow: hidden; }
        .g-yard-race .yr-fill { position: absolute; left: 0; top: 0; bottom: 0; width: 100%; border-radius: 5px; transition: background 0.2s; }
        .g-yard-race .yr-mark { position: absolute; top: -2px; bottom: -2px; width: 3px; margin-left: -1.5px; background: ${ink}; opacity: 0; }
        .g-yard-race .yr-status { font-size: 13px; font-weight: 600; height: 18px; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .g-yard-race .yr-status[data-tone="bad"] { color: #b3261e; }
        .g-yard-race .yr-status[data-tone="warn"] { color: #8a5a00; }
        .g-yard-race .yr-status[data-tone="good"] { color: #2f6a1f; }
        .g-yard-race .yr-big { position: relative; flex: 1; margin: 6px 8px calc(8px + env(safe-area-inset-bottom)); border: 3px solid ${ink}; border-radius: 22px; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 6px 0 ${ink}; touch-action: none; -webkit-tap-highlight-color: transparent; overflow: hidden; min-height: 80px; }
        .g-yard-race .yr-big.turtle { background: radial-gradient(circle at 50% 40%, #a8d46a, #6f9e3a); }
        .g-yard-race .yr-big.bunny { background: radial-gradient(circle at 50% 40%, #fff, #f3b3c0); }
        .g-yard-race .yr-big[data-on="true"] { transform: translateY(4px); box-shadow: 0 2px 0 ${ink}; filter: brightness(1.06); }
        .g-yard-race .yr-big-label { font-size: 30px; font-weight: 700; letter-spacing: 0.06em; pointer-events: none; }
        .g-yard-race .yr-big-sub { font-size: 12px; font-weight: 600; opacity: 0.7; pointer-events: none; }
      `}</style>
      <div ref={rootRef} className="relative h-full w-full max-w-[520px] mx-auto flex flex-col overflow-hidden" style={{ background: '#7a4f33' }}>
        <div className="relative shrink-0" style={{ height: trackH }}>
          <canvas ref={canvasRef} className="block" />
          <div className="absolute flex gap-2 items-center" style={{ top: 'max(8px, env(safe-area-inset-top))', right: 10 }}>
            <button
              className="w-9 h-9 rounded-full border-[3px] flex items-center justify-center text-[15px] bg-[#fbf3e2]"
              style={{ borderColor: ink, boxShadow: `0 3px 0 ${ink}` }}
              aria-label={muted ? 'Unmute' : 'Mute'}
              onClick={() => {
                sfx.current.unlock();
                setMuted((m) => !m);
              }}
            >
              {muted ? '🔇' : '🔊'}
            </button>
            <ExitButton onExit={onExit} className="!bg-[#fbf3e2] !text-[#3a2618] !border-[#3a2618] !border-[3px] rounded-lg shadow-[0_3px_0_#3a2618]" />
          </div>
          {phase === 'after' && (
            <button className="yr-btn gold absolute left-1/2 -translate-x-1/2 text-[14px] !py-1.5" style={{ bottom: 10 }} onClick={skipAfter}>
              SKIP TO RESULTS ▸
            </button>
          )}
        </div>
        <div className="flex flex-1 min-h-0">{[T, B].map(panelFor)}</div>

        {phase === 'menu' && (
          <div className="absolute inset-0 flex items-center justify-center px-4" style={{ background: 'rgba(40,24,12,0.35)' }}>
            <div className="yr-card w-full max-w-[350px] px-5 pt-4 pb-5 text-center">
              <div className="flex justify-center items-end gap-1">
                <img src={icons.turtle} alt="" className="w-14 h-14" />
                <div className="text-[13px] font-bold tracking-[0.2em] opacity-60 pb-4">VS</div>
                <img src={icons.bunny} alt="" className="w-14 h-14" />
              </div>
              <h1 className="text-[30px] font-bold leading-none">Turtle vs Bunny</h1>
              <div className="text-[13px] font-semibold tracking-[0.25em] opacity-60 mt-1">ONE LAP OF THE YARD</div>
              <p className="text-[14px] leading-snug mt-3 text-left">
                <b>Turtle:</b> tap tap tap! The faster you keep tapping, the faster it walks, and it never runs out of energy.
              </p>
              <p className="text-[14px] leading-snug mt-1.5 text-left">
                <b>Bunny:</b> hold to zoom. Let go on a food patch to stop and eat. Run dry and you flop!
              </p>
              <div className="flex flex-col gap-2 mt-4">
                <button className="yr-btn gold text-[18px]" onClick={() => startRace('2p')}>
                  2 PLAYERS · ONE PHONE
                </button>
                <div className="text-[12px] font-bold tracking-[0.15em] opacity-60 mt-1">OR VS THE COMPUTER, AS…</div>
                <div className="flex gap-2">
                  <button className="yr-btn green flex-1 text-[16px]" onClick={() => startRace('turtle')}>
                    TURTLE
                  </button>
                  <button className="yr-btn pink flex-1 text-[16px]" onClick={() => startRace('bunny')}>
                    BUNNY
                  </button>
                </div>
              </div>
              {(best.turtle > 0 || best.bunny > 0) && (
                <div className="text-[13px] font-semibold mt-3 opacity-80">
                  Best lap: Turtle {best.turtle ? fmt(best.turtle) : '–'} · Bunny {best.bunny ? fmt(best.bunny) : '–'}
                </div>
              )}
            </div>
          </div>
        )}

        {phase === 'result' && result && (
          <div className="absolute inset-0 flex items-center justify-center px-4" style={{ background: 'rgba(40,24,12,0.45)' }}>
            <div className="yr-card w-full max-w-[340px] px-5 pt-4 pb-5 text-center">
              <img src={result.winner === T ? icons.turtle : icons.bunny} alt="" className="w-16 h-16 mx-auto" />
              <h2 className="text-[30px] font-bold leading-none">{winnerName} wins!</h2>
              <div className="text-[14px] font-semibold mt-1 opacity-75">
                {result.margin !== null ? (result.margin < 0.3 ? `By a whisker: ${fmt(result.margin)}` : `By ${fmt(result.margin)}`) : 'The other one never made it home'}
              </div>
              <div className="mt-3 flex flex-col gap-1 text-[16px]">
                {[T, B].map((i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-1 rounded-lg" style={{ background: i === T ? '#dcebc0' : '#fbe0e4' }}>
                    <img src={i === T ? icons.turtle : icons.bunny} alt="" className="w-7 h-7" />
                    <span className="font-bold">{names[i]}</span>
                    {!human(mode, i) && <span className="text-[11px] font-bold opacity-60">CPU</span>}
                    <span className="ml-auto font-bold tabular-nums">{result.times[i] !== null ? fmt(result.times[i]!) : 'DNF'}</span>
                    {result.newBest[i] && <span className="text-[11px] font-bold text-[#b3261e]">BEST!</span>}
                  </div>
                ))}
              </div>
              <div className="text-[13px] font-semibold mt-2 opacity-75">
                Best lap: Turtle {best.turtle ? fmt(best.turtle) : '–'} · Bunny {best.bunny ? fmt(best.bunny) : '–'}
              </div>
              <div className="flex gap-2 mt-4">
                <button className="yr-btn gold flex-1 text-[16px]" onClick={() => startRace(mode)}>
                  REMATCH
                </button>
                <button
                  className="yr-btn flex-1 text-[16px]"
                  onClick={() => {
                    eng.current.phase = 'menu';
                    eng.current.race = createRace(['turtle', 'bunny']);
                    setPhase('menu');
                  }}
                >
                  MODES
                </button>
              </div>
            </div>
          </div>
        )}

        {paused && racing && (
          <button className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(40,24,12,0.45)' }} onClick={resume}>
            <div className="yr-card px-8 py-5 text-center">
              <div className="text-[28px] font-bold">Paused</div>
              <div className="text-[14px] mt-1 opacity-75">Tap to continue</div>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}

/** The house roof doubles as the scoreboard: race clock and a progress strip for both racers. */
function drawRoof(g: CanvasRenderingContext2D, e: Engine) {
  const r = e.race;
  const x0 = 214;
  const w = 172;
  // chalkboard sign
  const y0 = 60;
  g.fillStyle = 'rgba(0,0,0,0.2)';
  g.fillRect(x0 + 3, y0 + 4, w, 96);
  g.fillStyle = '#7a5233';
  g.fillRect(x0, y0, w, 96);
  g.fillStyle = '#2f3b33';
  g.fillRect(x0 + 5, y0 + 5, w - 10, 86);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = 'rgba(255,255,240,0.7)';
  g.font = `600 11px ${FONT}`;
  g.fillText('RACE CLOCK', x0 + w / 2, y0 + 19);
  const t = r.t;
  g.fillStyle = '#fffbe8';
  g.font = `700 34px ${FONT}`;
  g.fillText(t.toFixed(1), x0 + w / 2, y0 + 52);
  g.fillStyle = 'rgba(255,255,240,0.55)';
  g.font = `600 10px ${FONT}`;
  const lead = r.winner >= 0 ? `${names[r.winner]} won!` : r.racers[T].s === r.racers[B].s ? 'One lap · first home wins' : `${r.racers[T].s > r.racers[B].s ? 'Turtle' : 'Bunny'} leads`;
  g.fillText(lead, x0 + w / 2, y0 + 78);
  // progress strip
  const py = 180;
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.fillRect(x0 + 3, py + 4, w, 70);
  g.fillStyle = '#f4ecdc';
  g.fillRect(x0, py, w, 70);
  g.strokeStyle = C.ink;
  g.lineWidth = 2;
  g.strokeRect(x0, py, w, 70);
  g.fillStyle = C.ink;
  g.font = `600 10px ${FONT}`;
  g.fillText('LAP PROGRESS', x0 + w / 2, py + 12);
  const bars: [number, string, string][] = [
    [r.racers[T].s / LAP, '#7fb24a', 'T'],
    [r.racers[B].s / LAP, '#f2a0b0', 'B'],
  ];
  bars.forEach(([p, col], i) => {
    const by = py + 24 + i * 22;
    const bx = x0 + 12;
    const bw = w - 24;
    g.fillStyle = '#e2d6bf';
    g.fillRect(bx, by, bw, 12);
    // food ticks
    g.fillStyle = 'rgba(80,140,50,0.6)';
    FOOD.forEach((f) => g.fillRect(bx + ((f.s0 + f.s1) / 2 / LAP) * bw - 1, by, 2, 12));
    g.fillStyle = col;
    g.fillRect(bx, by, bw * Math.min(1, p), 12);
    g.strokeStyle = C.ink;
    g.lineWidth = 1.2;
    g.strokeRect(bx, by, bw, 12);
    const ix = bx + bw * Math.min(1, p);
    if (i === 0) drawTurtle(g, ix, by + 6, 0, { scale: 0.55, steps: r.racers[T].steps, t: e.now, tired: false, stepPhase: 0.5 });
    else drawBunny(g, ix, by + 6, 0, { scale: 0.55, hop: 0, running: false, eating: false, flop: false, t: e.now });
  });
  // checkered flag at the end
  const fx = x0 + w - 12;
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 2; j++) {
      g.fillStyle = (i + j) % 2 ? C.ink : '#fff';
      g.fillRect(fx - 2 + j * 2, py + 22 + i * 11, 2, 11);
    }
}
