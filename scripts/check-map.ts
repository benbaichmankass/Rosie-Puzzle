// Checks the house map: every game spot is reachable from the start tile by the map's own pathfinding,
// every game in the registry points at a known spot, and every room is walkable.
import { SPOTS, START, findPath, walkable, spotAt, ROOM_AT, COLS, ROWS, DIRS } from '../src/map/layout';
import { GAMES, ROOMS } from '../src/games/registry';
import type { SpotId } from '../src/shared/types';

let fail = 0;
const bad = (msg: string) => { console.error('FAIL ' + msg); fail++; };

if (!walkable(START.x, START.y)) bad(`start tile ${START.x},${START.y} is not walkable`);
for (const id of Object.keys(SPOTS) as SpotId[]) {
  const s = SPOTS[id];
  const path = findPath(START, s.trigger);
  if (!path) bad(`spot ${id}: trigger ${s.trigger.x},${s.trigger.y} unreachable`);
  else console.log(`ok   ${id.padEnd(17)} ${String(path.length).padStart(3)} steps`);
  if (spotAt(s.trigger.x, s.trigger.y, 'trigger') !== id) bad(`spot ${id}: trigger shared with another spot`);
  const d = DIRS[s.face];
  if (!s.objects.some((o) => o.x === s.trigger.x + d.x && o.y === s.trigger.y + d.y) && id !== 'bathroom-floor')
    bad(`spot ${id}: does not face one of its objects`);
}
for (const g of GAMES) if (!SPOTS[g.spot]) bad(`game ${g.id} uses unknown spot ${g.spot}`);
for (const r of ROOMS) {
  let n = 0, reach = 0;
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++)
    if (ROOM_AT[y][x] === r.id && walkable(x, y)) { n++; if (findPath(START, { x, y })) reach++; }
  if (n === 0 || reach !== n) bad(`room ${r.id}: ${reach}/${n} floor tiles reachable`);
  else console.log(`ok   room ${r.id}: ${n} tiles, all reachable`);
}
if (fail) { console.error(`${fail} map check(s) failed`); process.exit(1); }
console.log('map OK');
