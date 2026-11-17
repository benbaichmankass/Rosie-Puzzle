import { PUZZLE_LEVELS } from '../src/utils/puzzle';
const t = Date.now();
for (const l of PUZZLE_LEVELS) {
  const grid = Array.from({ length: l.rows }, () => Array(l.cols).fill('.'));
  l.dogCells.forEach((d) => (grid[d.r][d.c] = d.part === 'head' ? 'R' : 'r'));
  l.obstacles.forEach((o) => (grid[o.r][o.c] = 'x'));
  console.log(`#${l.id} ${l.rows}x${l.cols} dog=${l.dogCells.length} toys=${l.obstacles.length} poses=${l.boyfriendPoses.length} solvable=${JSON.stringify(l.solvablePairs)}`);
  console.log(grid.map((r) => '   ' + r.join('')).join('\n'));
  console.log('   bf:', l.boyfriendPoses.map((p) => p.id).join(', '), '| gf:', l.girlfriendPoses.map((p) => p.id).join(', '));
}
console.log('ms', Date.now() - t);
