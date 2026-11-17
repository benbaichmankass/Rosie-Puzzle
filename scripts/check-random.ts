// Generates each night many times with random seeds: checks speed, variety and solvability.
import { generateLevel, layoutKey, pairSolutions, key, LEVEL_COUNT } from '../src/utils/puzzle';
const N = 200;
for (let id = 1; id <= LEVEL_COUNT; id++) {
  const keys = new Set<string>();
  let worst = 0, bad = 0;
  for (let i = 0; i < N; i++) {
    const t = performance.now();
    const l = generateLevel(id);
    worst = Math.max(worst, performance.now() - t);
    keys.add(layoutKey(l));
    const blocked = new Set([...l.dogCells.map((c) => key(c.r, c.c)), ...l.obstacles.map((o) => key(o.r, o.c))]);
    let n = 0;
    l.boyfriendPoses.forEach((a) => l.girlfriendPoses.forEach((b) => { if (pairSolutions(a, b, l.rows, l.cols, blocked).length) n++; }));
    if (n === 0 || n === l.boyfriendPoses.length * l.girlfriendPoses.length) bad++;
  }
  console.log(`night ${id}: ${keys.size}/${N} distinct layouts, slowest ${worst.toFixed(1)}ms, unsolvable-or-trivial ${bad}`);
}
