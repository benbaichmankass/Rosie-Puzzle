import { generateLevel, LEVEL_COUNT } from '../src/utils/puzzle';
for (let id = 1; id <= LEVEL_COUNT; id += 3) {
  const items: number[] = [], dogs: number[] = [];
  for (let i = 0; i < 300; i++) { const l = generateLevel(id); items.push(l.obstacles.length); dogs.push(l.dogCells.length); }
  const avg = (a: number[]) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
  console.log(`night ${id}: items avg ${avg(items)} (min ${Math.min(...items)}, max ${Math.max(...items)}), Rosie avg ${avg(dogs)} squares`);
}
