import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { GameProps } from '../../shared/types';
import { ExitButton } from '../../shared/ExitButton';
import { getHighScore, load, save, submitScore } from '../../shared/storage';
import * as S from './sim';
import { createView, draw, splash, X, Y, type View } from './render';
import { Sfx } from './audio';
import { meta } from './meta';

type Phase = 'start' | 'play' | 'over';

const FONT_HREF = 'https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=IM+Fell+English+SC&display=swap';

const CSS = `
.g-squeegee { font-family: 'IM Fell English', Georgia, serif; color: #2b2016; background: #efe3c8;
  touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
.g-squeegee .sc { font-family: 'IM Fell English SC', 'IM Fell English', Georgia, serif; }
.g-squeegee .ink-btn { border: 2px solid #2b2016; border-radius: 14px 18px 12px 16px / 16px 12px 18px 14px;
  background: #f6edd8; box-shadow: 2px 3px 0 #2b2016; }
.g-squeegee .ink-btn:active, .g-squeegee .ink-btn.down { transform: translate(2px, 3px); box-shadow: 0 0 0 #2b2016; background: #e9dcbc; }
.g-squeegee .card { background: rgba(246,237,216,0.96); border: 2px solid #2b2016; box-shadow: 4px 5px 0 rgba(43,32,22,0.85);
  border-radius: 18px 12px 20px 14px / 12px 20px 14px 18px; }
.g-squeegee .hatch { background-image: repeating-linear-gradient(-45deg, rgba(43,32,22,0.18) 0 1px, transparent 1px 5px); }
`;

function fmt(t: number): string {
  return t.toFixed(1);
}

export default function Game({ onExit }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const simRef = useRef<S.State>(S.createState());
  const viewRef = useRef<View>(createView());
  const inputRef = useRef({ up: false, down: false, swings: 0 });
  const sfxRef = useRef<Sfx>(new Sfx());
  const phaseRef = useRef<Phase>('start');
  const pausedRef = useRef(false);
  const walkRef = useRef(0);
  const [phase, setPhase] = useState<Phase>('start');
  const [paused, setPaused] = useState(false);
  const [best, setBest] = useState(() => getHighScore(meta.id));
  const [result, setResult] = useState({ time: 0, newBest: false });
  const [muted, setMuted] = useState(() => load<boolean>(meta.id, 'muted', false));
  const [held, setHeld] = useState({ up: false, down: false, swing: false });
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!document.querySelector(`link[href="${FONT_HREF}"]`)) {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = FONT_HREF;
      document.head.appendChild(l);
    }
  }, []);

  useEffect(() => {
    sfxRef.current.setMuted(muted);
    save(meta.id, 'muted', muted);
  }, [muted]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((m) => (m === msg ? '' : m)), 2600);
  }, []);

  // main loop
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let overAt = -1;
    const resize = () => {
      const cv = canvasRef.current, wrap = wrapRef.current;
      if (!cv || !wrap) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = wrap.getBoundingClientRect();
      cv.width = Math.max(1, Math.round(r.width * dpr));
      cv.height = Math.max(1, Math.round(r.height * dpr));
      cv.style.width = `${r.width}px`;
      cv.style.height = `${r.height}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    if (wrapRef.current) ro.observe(wrapRef.current);

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const cv = canvasRef.current;
      if (!cv) return;
      const s = simRef.current, v = viewRef.current, inp = inputRef.current, sfx = sfxRef.current;
      const playing = phaseRef.current === 'play' && !pausedRef.current;
      if (playing && !s.over) {
        const move = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
        const wantSwing = inp.swings > 0 && s.swingT >= S.SWING_COOLDOWN;
        S.step(s, { move, swing: wantSwing }, dt);
        if (wantSwing) inp.swings = Math.max(0, inp.swings - 1);
        if (inp.swings > 1) inp.swings = 1; // buffer at most one extra tap
        walkRef.current += Math.abs(s.pv) * dt * 0.9;
        for (const e of s.events) {
          if (e === 'swing') sfx.swish(Math.min(1, s.lastSwingVol / 2));
          if (e === 'suds') { sfx.bubbles(); showToast('The cleaning stuff is soaked! Soap suds everywhere: slippery floor!'); v.shake = 0.3; }
          if (e === 'paper') { sfx.plop(); showToast('The toilet paper fell in! It will clog the drain.'); }
          if (e === 'clog') { sfx.gurgle(); showToast('Glug... paper in the drain. It drains slower now.'); }
          if (e === 'zap') { sfx.zap(); v.zapT = 0; v.flash = 1; v.shake = 1; }
        }
        s.events.length = 0;
        // gurgle + splash when a wave lands in the drain
        for (const g of s.slugs) {
          if (g.x < S.DRAIN_CELLS[2] + 2.5 && g.vol > 0.2 && Math.random() < 0.15) {
            splash(v, X(S.DRAIN_CELLS[1]), Y(s.bed[2]) - 2, 4);
          }
        }
        if (timeRef.current) timeRef.current.textContent = fmt(s.t);
      }
      if (s.over) {
        v.zapT += dt;
        if (Math.floor(v.zapT * 6) % 2 === 0 && v.zapT < 1.2) v.flash = Math.max(v.flash, 0.35);
        if (overAt < 0) overAt = now;
        if (phaseRef.current === 'play' && now - overAt > 1700) {
          const time = Math.round(s.t * 10) / 10;
          const nb = submitScore(meta.id, time);
          setBest(getHighScore(meta.id));
          setResult({ time, newBest: nb });
          phaseRef.current = 'over';
          setPhase('over');
          sfx.setShower(false);
        }
      } else overAt = -1;
      draw(cv, s, v, playing || s.over ? dt : 0, { walk: walkRef.current });
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [showToast]);

  // pause when the tab is hidden
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        if (phaseRef.current === 'play') { pausedRef.current = true; setPaused(true); }
        sfxRef.current.suspend();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const start = useCallback(() => {
    simRef.current = S.createState();
    viewRef.current = createView();
    inputRef.current = { up: false, down: false, swings: 0 };
    phaseRef.current = 'play';
    pausedRef.current = false;
    setPaused(false);
    setPhase('play');
    setToast('');
    const sfx = sfxRef.current;
    sfx.start();
    sfx.setMuted(muted);
    sfx.setShower(true);
  }, [muted]);

  const resume = useCallback(() => {
    pausedRef.current = false;
    setPaused(false);
    sfxRef.current.resume();
  }, []);

  const swing = useCallback(() => {
    if (phaseRef.current !== 'play' || pausedRef.current) return;
    inputRef.current.swings += 1;
  }, []);

  // keyboard
  useEffect(() => {
    const set = (e: KeyboardEvent, down: boolean) => {
      const k = e.key;
      if (k === 'ArrowUp' || k === 'w' || k === 'W' || k === 'ArrowLeft' || k === 'a' || k === 'A') {
        inputRef.current.up = down; setHeld((h) => ({ ...h, up: down })); e.preventDefault();
      } else if (k === 'ArrowDown' || k === 's' || k === 'S' || k === 'ArrowRight' || k === 'd' || k === 'D') {
        inputRef.current.down = down; setHeld((h) => ({ ...h, down: down })); e.preventDefault();
      } else if (k === ' ' || k === 'Enter') {
        e.preventDefault();
        if (down && !e.repeat) {
          if (phaseRef.current === 'play') swing();
          else start();
        }
        setHeld((h) => ({ ...h, swing: down }));
      }
    };
    const kd = (e: KeyboardEvent) => set(e, true);
    const ku = (e: KeyboardEvent) => set(e, false);
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, [swing, start]);

  const holdProps = (dir: 'up' | 'down') => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      inputRef.current[dir] = true;
      setHeld((h) => ({ ...h, [dir]: true }));
    },
    onPointerUp: () => { inputRef.current[dir] = false; setHeld((h) => ({ ...h, [dir]: false })); },
    onPointerCancel: () => { inputRef.current[dir] = false; setHeld((h) => ({ ...h, [dir]: false })); },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  return (
    <div className="g-squeegee fixed inset-0 flex flex-col overflow-hidden" style={{ height: '100dvh' }}>
      <style>{CSS}</style>
      {/* top bar */}
      <div className="relative z-10 flex items-center justify-between px-3 pt-2 pb-1.5 border-b-2 border-[#2b2016] bg-[#f6edd8]">
        <ExitButton onExit={onExit} className="!bg-[#2b2016] !text-[#f6edd8] !border-[#2b2016] rounded-md" />
        <div className="flex flex-col items-center leading-none">
          <span className="sc text-[12px] opacity-70">time</span>
          <span ref={timeRef} className="text-[26px] tabular-nums">0.0</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-end leading-none">
            <span className="sc text-[12px] opacity-70">best</span>
            <span className="text-[18px] tabular-nums">{fmt(best)}</span>
          </div>
          <button
            aria-label={muted ? 'Unmute' : 'Mute'}
            onClick={() => setMuted((m) => !m)}
            className="ink-btn w-9 h-9 flex items-center justify-center text-[18px]"
          >
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
      </div>

      {/* scene */}
      <div ref={wrapRef} className="relative flex-1 min-h-0">
        <canvas ref={canvasRef} className="absolute inset-0 block" />
        {toast && (
          <div className="absolute left-3 right-3 top-3 card px-3 py-2 text-[16px] text-center italic pointer-events-none">
            {toast}
          </div>
        )}

        {phase === 'start' && (
          <div className="absolute inset-0 flex items-center justify-center p-5 bg-[rgba(243,233,210,0.45)]">
            <div className="card max-w-[340px] w-full px-5 py-5 text-center">
              <h1 className="sc text-[34px] leading-none">Squeegee</h1>
              <h1 className="sc text-[34px] leading-none mb-3">Survival</h1>
              <p className="text-[17px] leading-snug mb-2">
                The shower is on and the floor slopes the wrong way! Hold <b>▲ / ▼</b> to move Bentzi, tap <b>SWING</b> to fling the water back up into the drain.
              </p>
              <p className="text-[15px] italic leading-snug mb-4 opacity-80">
                Keep the shelves under the sink dry. If the water reaches the toothbrush and trimmer… zap!
              </p>
              <button onClick={start} className="ink-btn sc text-[26px] px-8 py-2">Play</button>
              <div className="mt-3 text-[15px]">Best: {fmt(best)} s</div>
            </div>
          </div>
        )}

        {phase === 'over' && (
          <div className="absolute inset-0 flex items-center justify-center p-5 bg-[rgba(43,32,22,0.25)]">
            <div className="card max-w-[330px] w-full px-5 py-5 text-center">
              <h2 className="sc text-[38px] leading-none mb-1">Zap!</h2>
              <p className="italic text-[16px] mb-3">The water reached the toothbrush and the trimmer.</p>
              <div className="text-[18px]">You lasted</div>
              <div className="text-[44px] leading-tight tabular-nums">{fmt(result.time)} s</div>
              {result.newBest ? (
                <div className="sc text-[20px] mb-2">A new best!</div>
              ) : (
                <div className="text-[16px] mb-2">Best: {fmt(best)} s</div>
              )}
              <p className="italic text-[14px] opacity-75 mb-1">Tip: from a few steps below the shower, your waves land right in the drain.</p>
              <div className="flex gap-3 justify-center mt-2">
                <button onClick={start} className="ink-btn sc text-[22px] px-5 py-1.5">Retry</button>
                <button onClick={onExit} className="ink-btn sc text-[22px] px-5 py-1.5">Map</button>
              </div>
            </div>
          </div>
        )}

        {paused && phase === 'play' && (
          <div className="absolute inset-0 flex items-center justify-center bg-[rgba(43,32,22,0.3)]">
            <button onClick={resume} className="ink-btn sc text-[26px] px-8 py-3">Resume</button>
          </div>
        )}
      </div>

      {/* controls */}
      <div
        className="relative z-10 flex items-stretch gap-3 px-3 pt-2.5 border-t-2 border-[#2b2016] bg-[#f6edd8] hatch"
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))', height: 168 }}
      >
        <div className="flex flex-col gap-2 w-[42%]">
          <button aria-label="Move up toward the shower" className={`ink-btn flex-1 sc text-[20px] flex items-center justify-center gap-2 ${held.up ? 'down' : ''}`} {...holdProps('up')}>
            <span className="text-[22px]">▲</span> up
          </button>
          <button aria-label="Move down toward the sink" className={`ink-btn flex-1 sc text-[20px] flex items-center justify-center gap-2 ${held.down ? 'down' : ''}`} {...holdProps('down')}>
            <span className="text-[22px]">▼</span> down
          </button>
        </div>
        <button
          aria-label="Swing the squeegee"
          className={`ink-btn flex-1 sc text-[30px] flex flex-col items-center justify-center leading-none ${held.swing ? 'down' : ''}`}
          style={{ borderRadius: '48% 52% 46% 54% / 52% 46% 54% 48%' }}
          onPointerDown={(e) => { e.preventDefault(); swing(); setHeld((h) => ({ ...h, swing: true })); }}
          onPointerUp={() => setHeld((h) => ({ ...h, swing: false }))}
          onPointerCancel={() => setHeld((h) => ({ ...h, swing: false }))}
          onContextMenu={(e) => e.preventDefault()}
        >
          swing!
          <span className="text-[14px] italic normal-case mt-1 opacity-75">tap, tap, tap</span>
        </button>
      </div>
    </div>
  );
}
