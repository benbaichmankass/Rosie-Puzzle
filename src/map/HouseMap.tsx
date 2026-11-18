import React from 'react';
import { GAMES, ROOMS, gamesIn } from '../games/registry';
import type { RoomId } from '../shared/types';
import { GB } from '../shared/characters';
import { OPENINGS, PLAN, ROOM_LABEL, ROOM_SHAPES, SPOTS, TURTLE_POOL } from './layout';

interface Props {
  room: RoomId | null;
  onSelectRoom: (room: RoomId | null) => void;
  onPlay: (gameId: string) => void;
}

/**
 * Game Boy style house map. Tap a room to see its games, tap a game (or its marker) to play.
 * The map-art lane replaces the plain shapes with tiles and walking sprites, keeping this API.
 */
export function HouseMap({ room, onSelectRoom, onPlay }: Props) {
  const selected = room ? ROOMS.find((r) => r.id === room) : null;
  return (
    <div className="gb-screen min-h-[100dvh] w-full flex justify-center">
      <div className="w-full max-w-[460px] flex flex-col px-3 pt-4 pb-6 gap-3">
        <header className="text-center">
          <h1 className="font-arcade text-[15px] leading-relaxed tracking-wide">ROSIE'S GAME HOUSE</h1>
          <p className="font-pixel text-[13px] opacity-80">Tap a room to explore</p>
        </header>

        <div className="gb-bezel p-2">
          <svg viewBox={`${PLAN.x} ${PLAN.y} ${PLAN.w} ${PLAN.h}`} className="w-full h-auto block" role="img" aria-label="House map">
            <rect x={PLAN.x} y={PLAN.y} width={PLAN.w} height={PLAN.h} fill={GB.lightest} />
            {(Object.keys(ROOM_SHAPES) as RoomId[]).map((id) => {
              const on = id === room;
              return (
                <g key={id} onClick={() => onSelectRoom(on ? null : id)} className="cursor-pointer">
                  {ROOM_SHAPES[id].map((r, i) => (
                    <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={on ? GB.light : id === 'yard' ? '#a9c628' : GB.lightest} stroke={GB.darkest} strokeWidth={6} />
                  ))}
                </g>
              );
            })}
            {/* hide the inner seam of the L-shaped yard */}
            <rect x={754} y={743} width={12} height={47} fill={room === 'yard' ? GB.light : '#a9c628'} pointerEvents="none" />
            <rect x={TURTLE_POOL.x} y={TURTLE_POOL.y} width={TURTLE_POOL.w} height={TURTLE_POOL.h} rx={10} fill={GB.dark} stroke={GB.darkest} strokeWidth={5} pointerEvents="none" />
            <text x={TURTLE_POOL.x + TURTLE_POOL.w / 2} y={TURTLE_POOL.y + 46} textAnchor="middle" fontSize={15} fill={GB.lightest} className="font-arcade" pointerEvents="none">POOL</text>
            {OPENINGS.map((o, i) => (
              <line key={i} x1={o.x1} y1={o.y1} x2={o.x2} y2={o.y2} stroke={o.kind === 'door' ? GB.lightest : GB.light} strokeWidth={o.kind === 'door' ? 10 : 8} strokeDasharray={o.kind === 'window' ? '6 5' : undefined} pointerEvents="none" />
            ))}
            {ROOMS.map((r) => (
              <text key={r.id} x={ROOM_LABEL[r.id].x} y={ROOM_LABEL[r.id].y} textAnchor="middle" fontSize={20} fill={GB.darkest} className="font-arcade" pointerEvents="none">
                {r.name.toUpperCase()}
              </text>
            ))}
            {GAMES.map((g) => {
              const s = SPOTS[g.spot];
              return (
                <g key={g.id} onClick={() => onPlay(g.id)} className="cursor-pointer">
                  <circle cx={s.x} cy={s.y} r={15} fill={g.status === 'ready' ? GB.darkest : GB.dark} stroke={GB.lightest} strokeWidth={4} />
                  <text x={s.x} y={s.y + 7} textAnchor="middle" fontSize={18} fill={GB.lightest} className="font-arcade">{g.status === 'ready' ? '▶' : '?'}</text>
                </g>
              );
            })}
          </svg>
        </div>

        <section className="gb-panel p-3 min-h-[180px]">
          {selected ? (
            <>
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-arcade text-[12px]">{selected.name.toUpperCase()}</h2>
                <button className="font-arcade text-[9px] underline" onClick={() => onSelectRoom(null)}>CLOSE</button>
              </div>
              <ul className="flex flex-col gap-2">
                {gamesIn(selected.id).map((g) => (
                  <li key={g.id}>
                    <button onClick={() => onPlay(g.id)} className="gb-btn w-full text-left px-3 py-2">
                      <div className="font-arcade text-[10px] flex justify-between gap-2">
                        <span>▶ {g.title.toUpperCase()}</span>
                        {g.status !== 'ready' && <span className="opacity-70">SOON</span>}
                      </div>
                      <div className="font-pixel text-[14px] leading-snug mt-1">{g.blurb}</div>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <ul className="grid grid-cols-2 gap-2">
              {ROOMS.map((r) => {
                const list = gamesIn(r.id);
                const ready = list.filter((g) => g.status === 'ready').length;
                return (
                  <li key={r.id}>
                    <button onClick={() => onSelectRoom(r.id)} className="gb-btn w-full px-2 py-2 text-left">
                      <div className="font-arcade text-[9px]">{r.name.toUpperCase()}</div>
                      <div className="font-pixel text-[13px]">{ready}/{list.length} games ready</div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
