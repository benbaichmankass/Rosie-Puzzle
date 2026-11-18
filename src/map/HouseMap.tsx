import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GAMES, ROOMS, gamesIn } from '../games/registry';
import type { GameMeta, RoomId, SpotId } from '../shared/types';
import { load, save } from '../shared/storage';
import {
  COLS, ROWS, TILE, DIRS, SPOTS, START, ROOM_AT, findPath, spotAt, tapTarget, walkable,
  type Dir, type Pt,
} from './layout';
import {
  Painter, renderStatic, drawCanopy, drawPool, drawBunnies, drawArrow, bentziSprite, rosieSprite, shadow,
} from './art';
import { DPad, ABButton } from './Controls';

interface Props {
  room: RoomId | null;
  onSelectRoom: (room: RoomId | null) => void;
  onPlay: (gameId: string) => void;
}

const STEP_MS = 190; // time to walk one tile
const SCALE = 2; // CSS pixels per art pixel (integer keeps the pixels crisp)
const STORE = 'map';

interface Walker { x: number; y: number; dir: Dir; from: Pt | null; steps: number }
interface Dialog { spot: SpotId; games: GameMeta[]; sel: number }

const roomName = (id: RoomId | null) => ROOMS.find((r) => r.id === id)?.name ?? '';
const gamesAt = (spot: SpotId) => GAMES.filter((g) => g.spot === spot);
const SPOT_IDS = (Object.keys(SPOTS) as SpotId[]).filter((s) => gamesAt(s).length > 0);

function loadStart(): { x: number; y: number; dir: Dir } {
  const s = load<{ x: number; y: number; dir: Dir } | null>(STORE, 'pos', null);
  if (s && Number.isInteger(s.x) && Number.isInteger(s.y) && walkable(s.x, s.y) && s.dir in DIRS) return s;
  return START;
}
function behind(x: number, y: number, dir: Dir): Pt {
  const d = DIRS[dir];
  if (walkable(x - d.x, y - d.y)) return { x: x - d.x, y: y - d.y };
  for (const n of Object.values(DIRS)) if (walkable(x + n.x, y + n.y)) return { x: x + n.x, y: y + n.y };
  return { x, y };
}
const dirTo = (a: Pt, b: Pt): Dir => (b.x > a.x ? 'right' : b.x < a.x ? 'left' : b.y > a.y ? 'down' : 'up');

/**
 * Game Boy style house map: Bentzi walks the plan with Rosie one tile behind. D-pad or tap to walk;
 * stepping onto a game spot opens a dialog. The room list below keeps every game two taps away.
 */
export function HouseMap({ room, onSelectRoom, onPlay }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [dialog, setDialogState] = useState<Dialog | null>(null);
  const dialogRef = useRef<Dialog | null>(null);
  const setDialog = useCallback((d: Dialog | null) => {
    dialogRef.current = d;
    setDialogState(d);
  }, []);
  const [banner, setBanner] = useState<string>('');
  const [view, setView] = useState({ w: 180, h: 200 });

  // mutable game state, read by the animation loop
  const st = useRef<{
    b: Walker; r: Walker; t: number; path: Pt[]; held: Dir | null; armed: boolean; room: RoomId | null;
    target: Pt | null;
  } | null>(null);
  if (!st.current) {
    const s = loadStart();
    const r = behind(s.x, s.y, s.dir);
    st.current = {
      b: { x: s.x, y: s.y, dir: s.dir, from: null, steps: 0 },
      r: { x: r.x, y: r.y, dir: dirTo(r, s), from: null, steps: 0 },
      t: 0, path: [], held: null, armed: false, room: ROOM_AT[s.y][s.x], target: null,
    };
  }

  const bannerTimer = useRef<number>(0);
  const showBanner = useCallback((text: string) => {
    setBanner(text);
    window.clearTimeout(bannerTimer.current);
    bannerTimer.current = window.setTimeout(() => setBanner(''), 1800);
  }, []);
  useEffect(() => {
    showBanner(roomName(st.current!.room).toUpperCase());
    return () => window.clearTimeout(bannerTimer.current);
  }, [showBanner]);

  const openSpot = useCallback((spot: SpotId) => {
    const games = gamesAt(spot);
    if (!games.length) return;
    const s = st.current!;
    s.b.dir = SPOTS[spot].face;
    s.path = [];
    s.target = null;
    setDialog({ spot, games, sel: 0 });
  }, [setDialog]);

  const savePos = () => {
    const b = st.current!.b;
    save(STORE, 'pos', { x: b.x, y: b.y, dir: b.dir });
  };

  // ---------------------------------------------------------------- movement

  const startStep = (to: Pt) => {
    const s = st.current!;
    const b = s.b, r = s.r;
    const from = { x: b.x, y: b.y };
    b.dir = dirTo(from, to);
    b.from = from;
    b.x = to.x; b.y = to.y;
    b.steps++;
    s.t = 0;
    if (r.x !== from.x || r.y !== from.y) {
      r.from = { x: r.x, y: r.y };
      r.dir = dirTo(r, from);
      r.x = from.x; r.y = from.y;
      r.steps++;
    }
  };

  /** Try to walk one tile in a direction; bumping into a spot's object opens it. */
  const tryDir = (d: Dir): boolean => {
    const s = st.current!;
    s.b.dir = d;
    const nx = s.b.x + DIRS[d].x, ny = s.b.y + DIRS[d].y;
    if (walkable(nx, ny)) { startStep({ x: nx, y: ny }); return true; }
    const spot = spotAt(nx, ny, 'object');
    if (spot && s.armed && gamesAt(spot).length) {
      s.armed = false;
      openSpot(spot);
    }
    return false;
  };

  const arrive = () => {
    const s = st.current!;
    savePos();
    const rm = ROOM_AT[s.b.y][s.b.x];
    if (rm && rm !== s.room) { s.room = rm; showBanner(roomName(rm).toUpperCase()); }
    const spot = spotAt(s.b.x, s.b.y, 'trigger');
    if (spot && gamesAt(spot).length) {
      openSpot(spot);
      s.held = null;
    }
  };

  const tick = (dt: number) => {
    const s = st.current!;
    if (dialogRef.current) return;
    if (s.b.from) {
      s.t += dt / STEP_MS;
      if (s.t < 1) return;
      s.t = 0;
      s.b.from = null;
      s.r.from = null;
      arrive();
      if (dialogRef.current) return;
    }
    if (s.held) {
      s.path = [];
      s.target = null;
      tryDir(s.held);
    } else if (s.path.length) {
      const next = s.path.shift()!;
      if (walkable(next.x, next.y) && Math.abs(next.x - s.b.x) + Math.abs(next.y - s.b.y) === 1) startStep(next);
      else { s.path = []; s.target = null; }
      if (!s.path.length && s.target && s.b.x === s.target.x && s.b.y === s.target.y) s.target = null;
    } else s.target = null;
  };

  // ---------------------------------------------------------------- render loop

  const staticMap = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    staticMap.current = renderStatic();
    let raf = 0, last = performance.now(), running = true;
    const ctx = canvasRef.current!.getContext('2d')!;
    const p = new Painter(ctx);
    const frame = (now: number) => {
      if (!running) return;
      const dt = Math.min(64, now - last);
      last = now;
      tick(dt);
      draw(ctx, p, now);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const onVis = () => {
      if (document.hidden) { running = false; cancelAnimationFrame(raf); }
      else if (!running) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => { running = false; cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', onVis); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const camera = (vw: number, vh: number) => {
    const s = st.current!;
    const [bx, by] = walkerPx(s.b, s.t);
    const mw = COLS * TILE, mh = ROWS * TILE;
    const cx = mw <= vw ? (mw - vw) / 2 : Math.max(0, Math.min(mw - vw, bx + 8 - vw / 2));
    const cy = mh <= vh ? (mh - vh) / 2 : Math.max(0, Math.min(mh - vh, by + 8 - vh / 2));
    return [Math.round(cx), Math.round(cy)];
  };

  const draw = (ctx: CanvasRenderingContext2D, p: Painter, now: number) => {
    const s = st.current!;
    const vw = ctx.canvas.width, vh = ctx.canvas.height;
    const [cx, cy] = camera(vw, vh);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(staticMap.current!, cx, cy, vw, vh, 0, 0, vw, vh);
    drawPool(p, cx, cy, now);
    drawBunnies(p, cx, cy, now);
    // tap target marker
    if (s.target) {
      const x = s.target.x * TILE - cx, y = s.target.y * TILE - cy;
      const k = Math.floor(now / 200) % 2;
      p.rect(x + 2 + k, y + 2 + k, 3, 1, 0); p.rect(x + 2 + k, y + 2 + k, 1, 3, 0);
      p.rect(x + 11 - k, y + 2 + k, 3, 1, 0); p.rect(x + 13 - k, y + 2 + k, 1, 3, 0);
      p.rect(x + 2 + k, y + 13 - k, 3, 1, 0); p.rect(x + 2 + k, y + 11 - k, 1, 3, 0);
      p.rect(x + 11 - k, y + 13 - k, 3, 1, 0); p.rect(x + 13 - k, y + 11 - k, 1, 3, 0);
    }
    // characters, back to front
    const [bx, by] = walkerPx(s.b, s.t);
    const [rx, ry] = walkerPx(s.r, s.t);
    const bFrame = s.b.from ? (s.b.steps % 2 ? 'a' : 'b') : 'stand';
    const rFrame = s.r.from ? (s.r.steps % 2 ? 'a' : 'b') : (Math.floor(now / 420) % 6 === 0 ? 'b' : 'a');
    const drawB = () => { shadow(p, bx - cx, by - cy - 1); ctx.drawImage(bentziSprite(s.b.dir, bFrame), bx - cx, by - cy - 3); };
    const drawR = () => { shadow(p, rx - cx, ry - cy - 1); ctx.drawImage(rosieSprite(s.r.dir, rFrame), rx - cx, ry - cy - 1); };
    if (ry <= by) { drawR(); drawB(); } else { drawB(); drawR(); }
    drawCanopy(p, cx, cy, now);
    // spot arrows bob over every game spot
    const bob = Math.floor(now / 350) % 2;
    for (const id of SPOT_IDS) {
      const sp = SPOTS[id];
      const d = DIRS[sp.face];
      const ox = sp.trigger.x + d.x, oy = sp.trigger.y + d.y;
      const ready = gamesAt(id).some((g) => g.status === 'ready');
      drawArrow(p, ox * TILE - cx + 4, oy * TILE - cy - 9 + bob, ready);
    }
  };

  // ---------------------------------------------------------------- sizing

  useEffect(() => {
    const el = wrapRef.current!;
    const fit = () => {
      const r = el.getBoundingClientRect();
      setView({ w: Math.max(80, Math.floor(r.width / SCALE)), h: Math.max(80, Math.floor(r.height / SCALE)) });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---------------------------------------------------------------- input

  const confirm = useCallback(() => {
    const d = dialogRef.current;
    const s = st.current!;
    if (d) {
      const single = d.games.length === 1;
      const ready = d.games.filter((g) => g.status === 'ready');
      if (single) {
        if (ready.length && d.sel === 0) { savePos(); onPlay(d.games[0].id); }
        else setDialog(null);
      } else if (d.sel < d.games.length) {
        const g = d.games[d.sel];
        if (g.status === 'ready') { savePos(); onPlay(g.id); }
      } else setDialog(null);
      return;
    }
    // A with no dialog: look at whatever Bentzi faces, or the spot he stands on
    const here = spotAt(s.b.x, s.b.y, 'trigger');
    const ahead = spotAt(s.b.x + DIRS[s.b.dir].x, s.b.y + DIRS[s.b.dir].y, 'object');
    if (ahead && gamesAt(ahead).length) openSpot(ahead);
    else if (here && gamesAt(here).length) openSpot(here);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onPlay, openSpot, setDialog]);

  const cancel = useCallback(() => {
    if (dialogRef.current) setDialog(null);
  }, [setDialog]);

  const options = (d: Dialog) => (d.games.length === 1 ? (d.games[0].status === 'ready' ? 2 : 1) : d.games.length + 1);

  const press = useCallback((d: Dir | null) => {
    const s = st.current!;
    const dlg = dialogRef.current;
    if (dlg) {
      if (d) {
        const n = options(dlg);
        const delta = d === 'left' || d === 'up' ? -1 : 1;
        setDialog({ ...dlg, sel: (dlg.sel + delta + n) % n });
      }
      s.held = null;
      return;
    }
    if (d && d !== s.held) s.armed = true;
    s.held = d;
  }, [setDialog]);

  useEffect(() => {
    const keyDir: Record<string, Dir> = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right',
    };
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const d = keyDir[e.key];
      if (d) { e.preventDefault(); if (!e.repeat) press(d); }
      else if (e.key === 'Enter' || e.key === ' ' || e.key === 'z') { e.preventDefault(); if (!e.repeat) confirm(); }
      else if (e.key === 'Escape' || e.key === 'x' || e.key === 'Backspace') cancel();
    };
    const up = (e: KeyboardEvent) => {
      const d = keyDir[e.key];
      if (d && st.current!.held === d) st.current!.held = null;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [press, confirm, cancel]);

  const onMapTap = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dialogRef.current) return;
    const s = st.current!;
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    const [cx, cy] = camera(c.width, c.height);
    const tx = Math.floor(((e.clientX - rect.left) * (c.width / rect.width) + cx) / TILE);
    const ty = Math.floor(((e.clientY - rect.top) * (c.height / rect.height) + cy) / TILE);
    // tapping the spot you're standing on (or its object) opens it right away
    const here = { x: s.b.x, y: s.b.y };
    const tappedSpot = spotAt(tx, ty, 'object') ?? spotAt(tx, ty, 'trigger');
    if (tappedSpot && SPOTS[tappedSpot].trigger.x === here.x && SPOTS[tappedSpot].trigger.y === here.y && !s.b.from) {
      openSpot(tappedSpot);
      return;
    }
    const goal = tapTarget(here, tx, ty);
    if (!goal) return;
    // plan from where Bentzi will be once the current step ends
    const path = findPath(here, goal);
    if (!path) return;
    s.held = null;
    s.path = path;
    s.target = path.length ? goal : null;
  };

  // ---------------------------------------------------------------- UI

  const selected = room ? ROOMS.find((r) => r.id === room) ?? null : null;

  return (
    <div className="gb-screen h-[100dvh] w-full flex justify-center overflow-hidden select-none" style={{ touchAction: 'manipulation' }}>
      <div className="w-full max-w-[460px] h-full flex flex-col px-3 pt-2 pb-3 gap-2">
        <header className="text-center shrink-0">
          <h1 className="font-arcade text-[13px] leading-relaxed tracking-wide">ROSIE'S GAME HOUSE</h1>
        </header>

        <div className="gb-bezel p-1.5 flex-1 min-h-[220px] flex flex-col">
          <div ref={wrapRef} className="relative flex-1 overflow-hidden bg-[#0f380f]">
            <canvas
              ref={canvasRef}
              width={view.w}
              height={view.h}
              onPointerDown={onMapTap}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-pointer"
              style={{ width: view.w * SCALE, height: view.h * SCALE, imageRendering: 'pixelated', touchAction: 'none' }}
              aria-label="House map. Walk Bentzi to a glowing arrow to play a game."
            />
            {banner && !dialog && (
              <div className="absolute left-2 top-2 gb-dialog px-2 py-1 font-arcade text-[8px] pointer-events-none">{banner}</div>
            )}
            {dialog && <DialogBox d={dialog} onPick={(i) => { setDialog({ ...dialog, sel: i }); dialogRef.current = { ...dialog, sel: i }; confirm(); }} />}
          </div>
        </div>

        <RoomBar selected={selected?.id ?? null} onSelectRoom={onSelectRoom} onPlay={(id) => { savePos(); onPlay(id); }} />

        <div className="shrink-0 flex items-center justify-between px-2 pt-1">
          <DPad onDir={press} />
          <div className="flex gap-3 items-end -rotate-[20deg] mr-1">
            <ABButton label="B" onPress={cancel} className="mt-6" />
            <ABButton label="A" onPress={confirm} />
          </div>
        </div>
      </div>
      <style>{`
        .gb-dialog { background: #9bbc0f; color: #0f380f; border: 3px double #0f380f; box-shadow: 0 0 0 2px #9bbc0f, 0 0 0 4px #0f380f; }
      `}</style>
    </div>
  );
}

function walkerPx(w: Walker, t: number): [number, number] {
  if (!w.from) return [w.x * TILE, w.y * TILE];
  return [Math.round((w.from.x + (w.x - w.from.x) * t) * TILE), Math.round((w.from.y + (w.y - w.from.y) * t) * TILE)];
}

function DialogBox({ d, onPick }: { d: Dialog; onPick: (i: number) => void }) {
  const single = d.games.length === 1;
  const g = d.games[0];
  const opt = (label: string, i: number) => (
    <button
      key={label}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={() => onPick(i)}
      className="font-arcade text-[10px] px-1 py-2 flex items-center gap-1"
    >
      <span className="w-[10px] inline-block">{d.sel === i ? '▶' : ''}</span>
      {label}
    </button>
  );
  return (
    <div className="absolute left-2 right-2 bottom-2 gb-dialog px-3 pt-2 pb-1" role="dialog" aria-label={single ? g.title : 'Games here'}>
      {single ? (
        <>
          <div className="font-arcade text-[10px] leading-relaxed">{g.title.toUpperCase()}</div>
          <div className="font-pixel text-[13px] leading-tight mt-1 opacity-90">{g.blurb}</div>
          <div className="flex items-center gap-4 mt-1">
            {g.status === 'ready' ? (
              <>{opt('PLAY', 0)}{opt('BACK', 1)}</>
            ) : (
              <>
                <span className="font-arcade text-[9px] animate-pulse">COMING SOON</span>
                {opt('BACK', 0)}
              </>
            )}
          </div>
        </>
      ) : (
        <div className="flex flex-col">
          {d.games.map((x, i) => opt(x.status === 'ready' ? x.title.toUpperCase() : `${x.title.toUpperCase()} - SOON`, i))}
          {opt('BACK', d.games.length)}
        </div>
      )}
    </div>
  );
}

function RoomBar({ selected, onSelectRoom, onPlay }: { selected: RoomId | null; onSelectRoom: (r: RoomId | null) => void; onPlay: (id: string) => void }) {
  const short: Record<RoomId, string> = { 'living-room': 'LIVING', bedroom: 'BED', kitchen: 'KITCHEN', bathroom: 'BATH', yard: 'YARD' };
  return (
    <section className="gb-panel shrink-0 p-1.5">
      <div className="grid grid-cols-5 gap-1">
        {ROOMS.map((r) => (
          <button
            key={r.id}
            onClick={() => onSelectRoom(selected === r.id ? null : r.id)}
            aria-pressed={selected === r.id}
            className={`font-arcade text-[7px] py-2 border-2 border-[#0f380f] ${selected === r.id ? 'bg-[#0f380f] text-[#9bbc0f]' : 'bg-[#9bbc0f]'}`}
          >
            {short[r.id]}
          </button>
        ))}
      </div>
      {selected && (
        <ul className="flex flex-col gap-1 mt-1.5">
          {gamesIn(selected).map((g) => (
            <li key={g.id}>
              <button onClick={() => onPlay(g.id)} className="gb-btn w-full text-left px-2 py-1.5 font-arcade text-[9px] flex justify-between gap-2">
                <span>▶ {g.title.toUpperCase()}</span>
                {g.status !== 'ready' && <span className="opacity-70">SOON</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
