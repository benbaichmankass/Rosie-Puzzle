/**
 * Puzzle engine: sleeping-pose library, seeded level generator and solver.
 *
 * Rules of a night:
 *  - Rosie and the toys/treats are already on the bed when the level starts.
 *  - Each person has a preset list of sleeping poses to cycle through (like
 *    rotating a Tetris piece). Their head always goes on the pillow row.
 *  - The night is won when both people are in bed and no square is left
 *    empty (otherwise Rosie sprawls into the gap).
 *  - Every level is generated so that at least one, but not every, pose
 *    combination can solve it.
 */
import { ObstacleType } from '../types';

export type BodyPart = 'head' | 'torso' | 'hips' | 'leg' | 'hand';

export interface PoseCell {
  r: number;
  c: number;
  part: BodyPart;
  parent: number; // index into cells; -1 for the head
}

export interface Pose {
  id: string;
  name: string;
  cells: PoseCell[];
  width: number;
  height: number;
  headCol: number;
}

export type DogPart = 'head' | 'body' | 'paw' | 'tail';
export interface DogCellT {
  r: number;
  c: number;
  part: DogPart;
  parent: number;
}

export interface PuzzleObstacle {
  id: string;
  type: ObstacleType;
  r: number;
  c: number;
}

export interface PuzzleLevel {
  id: number;
  title: string;
  subtitle: string;
  storyNote: string;
  rows: number;
  cols: number;
  dogCells: DogCellT[];
  dogPose: string;
  obstacles: PuzzleObstacle[];
  boyfriendPoses: Pose[];
  girlfriendPoses: Pose[];
  /** pose index pairs [bf, gf] that can solve the night */
  solvablePairs: [number, number][];
  targetZenSeconds: number;
}

// ---------------------------------------------------------------------------
// Pose library. Written as [part, r, c, parentIndex].
// ---------------------------------------------------------------------------
type Raw = [BodyPart, number, number, number][];

const BASE_POSES: { id: string; name: string; cells: Raw }[] = [
  {
    id: 'plank',
    name: 'Straight as a Plank',
    cells: [['head', 0, 0, -1], ['torso', 1, 0, 0], ['hips', 2, 0, 1], ['leg', 3, 0, 2]],
  },
  {
    id: 'bent-knee',
    name: 'Bent Knee',
    cells: [['head', 0, 0, -1], ['torso', 1, 0, 0], ['hips', 2, 0, 1], ['leg', 2, 1, 2]],
  },
  {
    id: 'reach',
    name: 'Reaching Over',
    cells: [['head', 0, 0, -1], ['torso', 1, 0, 0], ['hand', 1, 1, 1], ['hips', 2, 0, 1], ['leg', 3, 0, 3]],
  },
  {
    id: 'wave',
    name: 'Arm Over the Pillow',
    cells: [['head', 0, 0, -1], ['hand', 0, 1, 2], ['torso', 1, 0, 0], ['hips', 2, 0, 2], ['leg', 3, 0, 3]],
  },
  {
    id: 'starfish',
    name: 'Starfish',
    cells: [
      ['head', 0, 1, -1], ['torso', 1, 1, 0], ['hand', 1, 0, 1], ['hand', 1, 2, 1],
      ['hips', 2, 1, 1], ['leg', 3, 1, 4],
    ],
  },
  {
    id: 'curled',
    name: 'Curled Up',
    cells: [['head', 0, 0, -1], ['torso', 1, 0, 0], ['hips', 2, 0, 1], ['leg', 2, 1, 2], ['leg', 1, 1, 3]],
  },
  {
    id: 'runner',
    name: 'Dream Runner',
    cells: [['head', 0, 0, -1], ['torso', 1, 0, 0], ['hips', 2, 0, 1], ['leg', 3, 0, 2], ['leg', 2, 1, 2]],
  },
  {
    id: 'diagonal',
    name: 'Diagonal Drift',
    cells: [['head', 0, 0, -1], ['torso', 1, 0, 0], ['hips', 1, 1, 1], ['leg', 2, 1, 2]],
  },
  {
    id: 'frog',
    name: 'Frog Legs',
    cells: [['head', 0, 1, -1], ['torso', 1, 1, 0], ['hips', 2, 1, 1], ['leg', 2, 0, 2], ['leg', 2, 2, 2]],
  },
  {
    id: 'pillow-hug',
    name: 'Pillow Hugger',
    cells: [
      ['head', 0, 0, -1], ['hand', 0, 1, 2], ['torso', 1, 0, 0], ['hand', 1, 1, 2],
      ['hips', 2, 0, 2], ['leg', 2, 1, 4],
    ],
  },
  {
    id: 'slump',
    name: 'Sideways Slump',
    cells: [['head', 0, 0, -1], ['torso', 1, 0, 0], ['hips', 1, 1, 1], ['leg', 1, 2, 2]],
  },
  {
    id: 'kick',
    name: 'Sideways Kick',
    cells: [['head', 0, 0, -1], ['torso', 1, 0, 0], ['hips', 2, 0, 1], ['leg', 3, 0, 2], ['leg', 3, 1, 3]],
  },
  {
    id: 'twisty',
    name: 'Twisty Sleeper',
    cells: [['head', 0, 0, -1], ['torso', 1, 0, 0], ['hips', 1, 1, 1], ['leg', 2, 1, 2], ['leg', 3, 1, 3]],
  },
  {
    id: 'short',
    name: 'Knees to Chest',
    cells: [['head', 0, 0, -1], ['torso', 1, 0, 0], ['hips', 2, 0, 1]],
  },
];

function finishPose(id: string, name: string, cells: PoseCell[]): Pose {
  const width = Math.max(...cells.map((c) => c.c)) + 1;
  const height = Math.max(...cells.map((c) => c.r)) + 1;
  return { id, name, cells, width, height, headCol: cells[0].c };
}

function buildLibrary(): Pose[] {
  const out: Pose[] = [];
  const seen = new Set<string>();
  for (const p of BASE_POSES) {
    const cells: PoseCell[] = p.cells.map(([part, r, c, parent]) => ({ part, r, c, parent }));
    const pose = finishPose(p.id, p.name, cells);
    const variants: Pose[] = [pose];
    if (pose.width > 1) {
      const mirrored = cells.map((c) => ({ ...c, c: pose.width - 1 - c.c }));
      variants.push(finishPose(`${p.id}-m`, p.name, mirrored));
    }
    for (const v of variants) {
      const key = shapeKey(v.cells);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(v);
    }
  }
  return out;
}

function shapeKey(cells: { r: number; c: number }[]) {
  return cells
    .map((c) => `${c.r},${c.c}`)
    .sort()
    .join('|');
}

export const POSE_LIBRARY: Pose[] = buildLibrary();

// ---------------------------------------------------------------------------
// Grid helpers
// ---------------------------------------------------------------------------
export const key = (r: number, c: number) => `${r},${c}`;

export function poseCellsAt(pose: Pose, col: number) {
  return pose.cells.map((cell) => ({ r: cell.r, c: cell.c + col }));
}

export function fits(pose: Pose, col: number, rows: number, cols: number, blocked: Set<string>) {
  if (col < 0 || col + pose.width > cols || pose.height > rows) return false;
  return pose.cells.every((cell) => !blocked.has(key(cell.r, cell.c + col)));
}

/** All columns where pose a and pose b together fill every free square. */
export function pairSolutions(
  a: Pose,
  b: Pose,
  rows: number,
  cols: number,
  blocked: Set<string>
): { colA: number; colB: number }[] {
  const freeCount = rows * cols - blocked.size;
  if (a.cells.length + b.cells.length !== freeCount) return [];
  const sols: { colA: number; colB: number }[] = [];
  for (let ca = 0; ca + a.width <= cols; ca++) {
    if (!fits(a, ca, rows, cols, blocked)) continue;
    const withA = new Set(blocked);
    poseCellsAt(a, ca).forEach((p) => withA.add(key(p.r, p.c)));
    for (let cb = 0; cb + b.width <= cols; cb++) {
      if (fits(b, cb, rows, cols, withA)) sols.push({ colA: ca, colB: cb });
    }
  }
  return sols;
}

// ---------------------------------------------------------------------------
// Seeded generator
// ---------------------------------------------------------------------------
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TOY_TYPES: ObstacleType[] = ['toy_duck', 'toy_ball', 'toy_bone', 'treat_bone', 'treat_bacon'];

interface Difficulty {
  rows: number;
  cols: number;
  posesEach: number;
  maxSolvablePairs: number;
  dogMin: number;
  dogMax: number;
  maxToys: number;
}

// Every bed is 4 rows tall (one row shorter than the original 5x5 board).
const DIFFICULTY: Difficulty[] = [
  { rows: 4, cols: 3, posesEach: 3, maxSolvablePairs: 2, dogMin: 2, dogMax: 3, maxToys: 2 },
  { rows: 4, cols: 4, posesEach: 3, maxSolvablePairs: 2, dogMin: 2, dogMax: 5, maxToys: 2 },
  { rows: 4, cols: 4, posesEach: 4, maxSolvablePairs: 2, dogMin: 2, dogMax: 5, maxToys: 3 },
  { rows: 4, cols: 4, posesEach: 4, maxSolvablePairs: 1, dogMin: 3, dogMax: 6, maxToys: 3 },
  { rows: 4, cols: 5, posesEach: 4, maxSolvablePairs: 2, dogMin: 4, dogMax: 8, maxToys: 3 },
  { rows: 4, cols: 5, posesEach: 5, maxSolvablePairs: 1, dogMin: 4, dogMax: 8, maxToys: 4 },
  { rows: 4, cols: 5, posesEach: 5, maxSolvablePairs: 2, dogMin: 4, dogMax: 8, maxToys: 4 },
  { rows: 4, cols: 5, posesEach: 6, maxSolvablePairs: 1, dogMin: 4, dogMax: 8, maxToys: 4 },
  { rows: 4, cols: 6, posesEach: 6, maxSolvablePairs: 2, dogMin: 6, dogMax: 8, maxToys: 5 },
  { rows: 4, cols: 6, posesEach: 6, maxSolvablePairs: 1, dogMin: 6, dogMax: 8, maxToys: 5 },
  { rows: 4, cols: 6, posesEach: 7, maxSolvablePairs: 1, dogMin: 6, dogMax: 8, maxToys: 5 },
  { rows: 4, cols: 6, posesEach: 7, maxSolvablePairs: 1, dogMin: 6, dogMax: 8, maxToys: 5 },
];

const TITLES: [string, string, string][] = [
  ['Rosie’s Cozy Ball', 'A narrow bed and a small sleepy dog', 'Rosie is already curled up. Flip through each sleeping pose and tuck both of you in so not one square is left empty.'],
  ['First Night In', 'Two pillows, one dog', 'Only some pose combinations fill the bed exactly. Try a pose, tuck in, and lift someone back out if it doesn’t work.'],
  ['Squeaky Surprise', 'Toys left on the duvet', 'Nobody wants to lie on a squeaky toy. Find poses that wrap around them.'],
  ['The Croissant', 'Rosie curls a little wider', 'Rosie has taken a bigger slice of the bed. Every square still needs to be covered.'],
  ['King-Size Dreams', 'The bed gets wider', 'A wider bed means more ways to go wrong. Plan where each head goes on the pillow.'],
  ['Biscuit Crumbs', 'Treats everywhere', 'Treats and toys pin you in. Only one pair of poses works tonight.'],
  ['Foot of the Bed', 'Rosie guards the bottom', 'Rosie owns the foot of the bed, so your legs have to find a way around her.'],
  ['The Long Haul', 'Tricky fit', 'Only one pair of poses fills this bed. Look at where the toys are before you pick.'],
  ['Pose Party', 'Six poses each', 'More poses to choose from, and still only one combination that works.'],
  ['Bed Hog', 'Rosie spreads out', 'Rosie is sprawled across half the bed. Squeeze in around her.'],
  ['Queen of the Bed', 'Big dog, big bed', 'Rosie and her toys took over. Find the one fit that gets you both under the covers.'],
  ['The Ultimate Sprawl', 'The final night', 'Seven poses each and one way to fit. Good luck, and sweet dreams.'],
];

function shuffle<T>(arr: T[], rnd: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function components(cells: string[]): string[][] {
  const set = new Set(cells);
  const seen = new Set<string>();
  const out: string[][] = [];
  for (const start of cells) {
    if (seen.has(start)) continue;
    const comp: string[] = [];
    const q = [start];
    seen.add(start);
    while (q.length) {
      const k = q.shift()!;
      comp.push(k);
      const [r, c] = k.split(',').map(Number);
      for (const n of [key(r - 1, c), key(r + 1, c), key(r, c - 1), key(r, c + 1)]) {
        if (set.has(n) && !seen.has(n)) {
          seen.add(n);
          q.push(n);
        }
      }
    }
    out.push(comp);
  }
  return out;
}

/** Grow Rosie inside a component; returns her cells as a BFS tree. */
function growDog(comp: string[], size: number, rnd: () => number): DogCellT[] | null {
  if (comp.length < size) return null;
  const compSet = new Set(comp);
  const start = comp[Math.floor(rnd() * comp.length)];
  const cells: DogCellT[] = [];
  const idx = new Map<string, number>();
  const frontier: { k: string; parent: number }[] = [{ k: start, parent: -1 }];
  while (cells.length < size && frontier.length) {
    const pick = Math.floor(rnd() * frontier.length);
    const { k, parent } = frontier.splice(pick, 1)[0];
    if (idx.has(k)) continue;
    const [r, c] = k.split(',').map(Number);
    idx.set(k, cells.length);
    cells.push({ r, c, part: parent === -1 ? 'head' : 'body', parent });
    const me = cells.length - 1;
    for (const n of shuffle([key(r - 1, c), key(r + 1, c), key(r, c - 1), key(r, c + 1)], rnd)) {
      if (compSet.has(n) && !idx.has(n)) frontier.push({ k: n, parent: me });
    }
  }
  if (cells.length < size) return null;
  // Leaves become paws, the leaf farthest from the head becomes the tail.
  const childCount = cells.map(() => 0);
  cells.forEach((c) => c.parent >= 0 && childCount[c.parent]++);
  const depth = (i: number): number => (cells[i].parent < 0 ? 0 : 1 + depth(cells[i].parent));
  let tail = -1;
  cells.forEach((c, i) => {
    if (i > 0 && childCount[i] === 0) {
      c.part = 'paw';
      if (tail < 0 || depth(i) > depth(tail)) tail = i;
    }
  });
  if (tail > 0) cells[tail].part = 'tail';
  return cells;
}

function dogPoseName(n: number) {
  if (n <= 2) return 'ball';
  if (n <= 3) return 'curled';
  if (n <= 4) return 'loaf';
  if (n <= 6) return 'sprawl';
  return 'starfish';
}

function tryGenerate(id: number, d: Difficulty, rnd: () => number): PuzzleLevel | null {
  const { rows, cols } = d;
  const usable = POSE_LIBRARY.filter((p) => p.height <= rows && p.width <= cols);
  const a = usable[Math.floor(rnd() * usable.length)];
  const b = usable[Math.floor(rnd() * usable.length)];
  if (a.id === b.id) return null;

  const colA = Math.floor(rnd() * (cols - a.width + 1));
  const taken = new Set(poseCellsAt(a, colA).map((p) => key(p.r, p.c)));
  const colBOptions = [];
  for (let cb = 0; cb + b.width <= cols; cb++) {
    if (fits(b, cb, rows, cols, taken)) colBOptions.push(cb);
  }
  if (!colBOptions.length) return null;
  const colB = colBOptions[Math.floor(rnd() * colBOptions.length)];
  poseCellsAt(b, colB).forEach((p) => taken.add(key(p.r, p.c)));

  // Heads should be side by side on the pillow row, at least 1 apart is fine.
  const left: string[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (!taken.has(key(r, c))) left.push(key(r, c));

  const comps = components(left).sort((x, y) => y.length - x.length);
  if (!comps.length) return null;
  const dogSize = Math.min(comps[0].length, d.dogMin + Math.floor(rnd() * (d.dogMax - d.dogMin + 1)));
  if (dogSize < d.dogMin) return null;
  const dog = growDog(comps[0], dogSize, rnd);
  if (!dog) return null;
  const dogSet = new Set(dog.map((c) => key(c.r, c.c)));
  const toyCells = left.filter((k) => !dogSet.has(k));
  if (toyCells.length > d.maxToys) return null;
  if (id > 2 && toyCells.length === 0 && rnd() < 0.7) return null;

  const obstacles: PuzzleObstacle[] = toyCells.map((k, i) => {
    const [r, c] = k.split(',').map(Number);
    return { id: `toy-${id}-${i}`, type: TOY_TYPES[Math.floor(rnd() * TOY_TYPES.length)], r, c };
  });

  const blocked = new Set<string>([...dogSet, ...toyCells]);

  // Build each person's pose list: the solution pose plus decoys.
  const pickList = (sol: Pose) => {
    const decoys = shuffle(usable.filter((p) => p.id !== sol.id), rnd).slice(0, d.posesEach - 1);
    const list = shuffle([sol, ...decoys], rnd);
    // Never start on the solving pose.
    if (list[0].id === sol.id) list.push(list.shift()!);
    return list;
  };
  const bfPoses = pickList(a);
  const gfPoses = pickList(b);

  const solvablePairs: [number, number][] = [];
  bfPoses.forEach((p, i) =>
    gfPoses.forEach((q, j) => {
      if (pairSolutions(p, q, rows, cols, blocked).length) solvablePairs.push([i, j]);
    })
  );
  if (!solvablePairs.length || solvablePairs.length > d.maxSolvablePairs) return null;
  if (solvablePairs.length >= bfPoses.length * gfPoses.length) return null;
  // The starting poses must not already solve it.
  if (solvablePairs.some(([i, j]) => i === 0 && j === 0)) return null;

  const [title, subtitle, storyNote] = TITLES[id - 1] || [`Night ${id}`, '', ''];
  return {
    id,
    title: `Night ${id}: ${title}`,
    subtitle,
    storyNote,
    rows,
    cols,
    dogCells: dog,
    dogPose: dogPoseName(dog.length),
    obstacles,
    boyfriendPoses: bfPoses,
    girlfriendPoses: gfPoses,
    solvablePairs,
    targetZenSeconds: 20 + id * 8,
  };
}

/** Same picture of a night, for comparing two layouts. */
export function layoutKey(l: PuzzleLevel) {
  return [
    l.dogCells.map((c) => key(c.r, c.c)).sort().join(';'),
    l.obstacles.map((o) => key(o.r, o.c)).sort().join(';'),
    l.boyfriendPoses.map((p) => p.id).join(','),
    l.girlfriendPoses.map((p) => p.id).join(','),
  ].join('|');
}

/**
 * Build a night. Pass a seed to get a repeatable layout; leave it out to get a
 * fresh random one. `avoid` skips a layout key (e.g. the one just played).
 */
export function generateLevel(id: number, seed?: number, avoid?: string): PuzzleLevel {
  const d = DIFFICULTY[Math.min(id, DIFFICULTY.length) - 1];
  const base = seed ?? Math.floor(Math.random() * 2 ** 31);
  for (let attempt = 0; attempt < 20000; attempt++) {
    const rnd = mulberry32(base + id * 100003 + attempt * 7919);
    const lvl = tryGenerate(id, d, rnd);
    if (lvl && (!avoid || layoutKey(lvl) !== avoid)) return lvl;
  }
  throw new Error(`Could not generate level ${id}`);
}

export const LEVEL_COUNT = DIFFICULTY.length;

/** Fixed layouts, used only for the level list (titles, Rosie's pose). */
export const PUZZLE_LEVELS: PuzzleLevel[] = DIFFICULTY.map((_, i) => generateLevel(i + 1, 0));
