import React, { Suspense, useEffect, useState } from 'react';
import { HouseMap } from './map/HouseMap';
import { GAME_COMPONENTS, gameById } from './games/registry';
import type { RoomId } from './shared/types';

/**
 * Rosie's Game House shell. Hash routes:
 *   #/               house map
 *   #/room/<roomId>  map with a room's games open
 *   #/play/<gameId>  a mini-game
 */
type Route = { kind: 'map'; room: RoomId | null } | { kind: 'play'; gameId: string };

function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/');
  if (parts[0] === 'play' && parts[1] && gameById(parts[1])) return { kind: 'play', gameId: parts[1] };
  if (parts[0] === 'room' && parts[1]) return { kind: 'map', room: parts[1] as RoomId };
  return { kind: 'map', room: null };
}

const go = (hash: string) => {
  window.location.hash = hash;
};

export default function App() {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash));
  useEffect(() => {
    const onHash = () => setRoute(parse(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);

  if (route.kind === 'play') {
    const Game = GAME_COMPONENTS[route.gameId];
    const meta = gameById(route.gameId)!;
    return (
      <Suspense fallback={<div className="gb-screen min-h-[100dvh] flex items-center justify-center font-arcade text-[11px]">LOADING…</div>}>
        <Game key={route.gameId} onExit={() => go(`#/room/${meta.room}`)} />
      </Suspense>
    );
  }
  return <HouseMap room={route.room} onSelectRoom={(r) => go(r ? `#/room/${r}` : '#/')} onPlay={(id) => go(`#/play/${id}`)} />;
}
