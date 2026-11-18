/**
 * Gas Leak level check (run with `npx tsx scripts/check-gas-leak.ts`).
 * For every handcrafted level, using the game's own simulation:
 *  - the stored solution is legal (fans on free floor, within the level's fan supply) and WINS;
 *  - doing nothing LOSES (no free levels);
 *  - the level map is sane (Bentzi on a sofa, gas source not blocked, ceiling fans on the floor).
 * It also runs the solver to report the fewest fans it can find, as a difficulty readout.
 */
import { LEVELS } from '../src/games/gas-leak/levels';
import { COLS, ROWS, canPlace, dangerCells, simulate, solidGrid, solve, sourceCell } from '../src/games/gas-leak/sim';

const t0 = Date.now();
let failures = 0;
const fail = (id: number, msg: string) => {
  failures++;
  console.error(`  FAIL level ${id}: ${msg}`);
};

const ids = new Set<number>();
for (const l of LEVELS) {
  if (ids.has(l.id)) fail(l.id, 'duplicate id');
  ids.add(l.id);
  const solid = solidGrid(l);
  const src = sourceCell(l);
  if (solid[src.r][src.c]) fail(l.id, 'gas source cell is blocked');
  if (!l.furniture.some((f) => f.kind === 'sofa' && l.bentzi.r >= f.r && l.bentzi.r < f.r + f.h && l.bentzi.c >= f.c && l.bentzi.c < f.c + f.w))
    fail(l.id, 'Bentzi is not on a sofa');
  if (dangerCells(l, solid).length === 0) fail(l.id, 'gas can never reach Bentzi (no danger cells)');
  for (const cf of l.ceilingFans) if (cf.r < 0 || cf.r >= ROWS || cf.c < 0 || cf.c >= COLS || solid[cf.r][cf.c]) fail(l.id, 'ceiling fan on furniture');
  if (!Object.values(l.open).some(Boolean)) fail(l.id, 'no open exit');

  const none = simulate(l, []);
  if (none.outcome === 'win') fail(l.id, 'wins with no fans');

  const sol = l.solution;
  if (sol.length === 0 || sol.length > l.fans) fail(l.id, `solution uses ${sol.length} fans, supply is ${l.fans}`);
  const cells = new Set<number>();
  for (const f of sol) {
    if (!canPlace(l, f.r, f.c, solid)) fail(l.id, `solution fan at ${f.r},${f.c} is not on free floor`);
    if (cells.has(f.r * COLS + f.c)) fail(l.id, `two fans on ${f.r},${f.c}`);
    cells.add(f.r * COLS + f.c);
  }
  const res = simulate(l, sol);
  if (res.outcome !== 'win') fail(l.id, `stored solution ends in ${res.outcome}`);

  const best = solve(l, l.fans, 150000);
  console.log(
    `level ${String(l.id).padStart(2)} ${l.name.padEnd(16)} fans=${l.fans} solution=${sol.length} -> ${res.outcome}${res.exit ? ` (${res.exit})` : ''}` +
      ` | no fans -> ${none.outcome} | solver best=${best ? best.length : '-'}`,
  );
}

console.log(`${LEVELS.length} levels, ${failures} failures, ${Date.now() - t0} ms`);
if (failures > 0) process.exit(1);
