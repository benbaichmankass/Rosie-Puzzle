import { COLS, E, N, ROWS, S, W, type Cell, type Furniture, type FurnitureKind, type Level } from './sim';

const KINDS: Record<string, FurnitureKind> = {
  s: 'sofa',
  B: 'sofa',
  t: 'table',
  p: 'plant',
  a: 'armchair',
  v: 'tv',
  d: 'dogbed',
  k: 'cabinet',
};

/**
 * Levels are drawn as 7x9 ASCII maps:
 *  . floor   s sofa   B Bentzi on the sofa   t glass coffee table   p plant   a armchair
 *  v TV stand   d Rosie's dog bed   k cabinet / bookcase   @ ceiling fan (gas passes under it)
 * Blocks of the same letter become rectangles of furniture.
 */
function parse(map: string[]): Pick<Level, 'furniture' | 'ceilingFans' | 'bentzi'> {
  if (map.length !== ROWS || map.some((row) => row.length !== COLS)) throw new Error('bad level map size');
  const norm = map.map((row) => row.replace(/B/g, 's'));
  const used = map.map((row) => Array<boolean>(row.length).fill(false));
  const furniture: Furniture[] = [];
  const ceilingFans: Cell[] = [];
  let bentzi: Cell | null = null;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const ch = map[r][c];
      if (ch === 'B') bentzi = { r, c };
      if (ch === '@') ceilingFans.push({ r, c });
      const k = norm[r][c];
      if (!KINDS[k] || used[r][c]) continue;
      let w = 1;
      while (c + w < COLS && norm[r][c + w] === k && !used[r][c + w]) w++;
      let h = 1;
      const rowOk = (rr: number) => {
        for (let cc = c; cc < c + w; cc++) if (norm[rr][cc] !== k || used[rr][cc]) return false;
        return true;
      };
      while (r + h < ROWS && rowOk(r + h)) h++;
      for (let rr = r; rr < r + h; rr++) for (let cc = c; cc < c + w; cc++) used[rr][cc] = true;
      furniture.push({ kind: KINDS[k], r, c, w, h });
    }
  if (!bentzi) throw new Error('level has no Bentzi');
  return { furniture, ceilingFans, bentzi };
}

const ALL = { window: true, door: true, acWindow: true };
const DOOR = { window: false, door: true, acWindow: false };
const TOP = { window: true, door: false, acWindow: false };
const ACW = { window: false, door: false, acWindow: true };

interface Draft extends Omit<Level, 'furniture' | 'ceilingFans' | 'bentzi' | 'source'> {
  map: string[];
}

/** The gas source is marked with '<' at the end of its row. */
function level(d: Draft): Level {
  const source = d.map.findIndex((row) => row.endsWith('<'));
  if (source < 0) throw new Error(`level ${d.id} has no gas source`);
  const map = d.map.map((row) => row.replace('<', ''));
  const { map: _m, ...rest } = d;
  return { ...rest, source, ...parse(map) };
}

export const LEVELS: Level[] = [
  level({
    id: 1,
    name: 'First Whiff',
    tip: 'Gas keeps going straight. Blow it up, then left out of the window.',
    open: ALL,
    fans: 2,
    ac: null,
    // prettier-ignore
    map: [
      '.......',
      '.......',
      '.......<',
      '..sBs..',
      '.......',
      '..tt...',
      '.......',
      '.......',
      '......p',
    ],
    solution: [{ r: 3, c: 6, dir: N, s: 1 }, { r: 1, c: 6, dir: W, s: 1 }],
  }),
  level({
    id: 2,
    name: 'Down Low',
    tip: 'Any open window or door will do.',
    open: ALL,
    fans: 2,
    ac: null,
    // prettier-ignore
    map: [
      'p......',
      '.......<',
      '.sBs..k',
      '...s..k',
      'kk.s...',
      '.tt....',
      'kk.....',
      '.......',
      '..vvv..',
    ],
    solution: [{ r: 1, c: 5, dir: S, s: 1 }, { r: 7, c: 5, dir: W, s: 1 }],
  }),
  level({
    id: 3,
    name: 'Window Stuck',
    tip: 'The top window is jammed. Weave the gas through the room.',
    open: { window: false, door: true, acWindow: true },
    fans: 3,
    ac: null,
    // prettier-ignore
    map: [
      '..p....',
      '.......<',
      '.......',
      'kkkk.sB',
      '.....s.',
      '.tt.k..',
      '....k..',
      'aa.....',
      'dd....v',
    ],
    solution: [{ r: 1, c: 4, dir: S, s: 1 }, { r: 4, c: 4, dir: W, s: 1 }],
  }),
  level({
    id: 4,
    name: 'Back Door',
    tip: 'Only the door is open.',
    open: DOOR,
    fans: 4,
    ac: null,
    // prettier-ignore
    map: [
      '..kk.a.',
      '.sBs..k',
      '.s....k',
      '..ttv..',
      '....v..<',
      '.......',
      '.....p.',
      '...a...',
      '..p....',
    ],
    solution: [{ r: 3, c: 6, dir: S, s: 1 }, { r: 5, c: 6, dir: W, s: 1 }, { r: 5, c: 3, dir: N, s: 1 }, { r: 4, c: 3, dir: W, s: 2 }],
  }),
  level({
    id: 5,
    name: 'AC On',
    tip: 'The AC is blowing air out of its window. Get the gas into its breeze.',
    open: ACW,
    fans: 3,
    ac: { dir: W, s: 3 },
    // prettier-ignore
    map: [
      '.......',
      '..sBs..',
      'p.k....',
      '..k....<',
      '.......',
      '...v...',
      '...vp..',
      '.....p.',
      'a.tt...',
    ],
    solution: [{ r: 2, c: 6, dir: S, s: 1 }, { r: 4, c: 6, dir: W, s: 1 }, { r: 4, c: 0, dir: S, s: 1 }],
  }),
  level({
    id: 6,
    name: 'Ceiling Fan',
    tip: 'The ceiling fan swirls air clockwise. Use it, or beat it with a strong fan.',
    open: DOOR,
    fans: 3,
    ac: null,
    // prettier-ignore
    map: [
      '...p...',
      '....@..<',
      '..kktt.',
      '.......',
      '....a..',
      '.sBs...',
      '.....p.',
      '..a....',
      '.......',
    ],
    solution: [{ r: 1, c: 5, dir: W, s: 2 }, { r: 1, c: 1, dir: S, s: 1 }, { r: 4, c: 1, dir: W, s: 1 }],
  }),
  level({
    id: 7,
    name: 'Cold Front',
    tip: 'Now the AC blows INTO the room and its window is shut.',
    open: TOP,
    fans: 4,
    ac: { dir: E, s: 3 },
    // prettier-ignore
    map: [
      '...a...',
      '....k..',
      '....k..',
      '.......',
      'kk..tt.',
      '.sBs...',
      '.s.....<',
      '.......',
      '.....pp',
    ],
    solution: [{ r: 7, c: 6, dir: N, s: 1 }, { r: 3, c: 6, dir: W, s: 1 }, { r: 3, c: 3, dir: N, s: 1 }, { r: 1, c: 3, dir: W, s: 1 }],
  }),
  level({
    id: 8,
    name: 'Furniture Maze',
    tip: 'Squeeze the gas between the furniture.',
    open: DOOR,
    fans: 5,
    ac: null,
    // prettier-ignore
    map: [
      '..p....',
      '..vv...',
      '.k..tt.',
      '.k..p..',
      '.p.....<',
      '....k..',
      '....kp.',
      'sBs....',
      '...kk..',
    ],
    solution: [{ r: 4, c: 3, dir: S, s: 1 }, { r: 7, c: 3, dir: N, s: 1 }, { r: 5, c: 3, dir: W, s: 1 }, { r: 5, c: 0, dir: N, s: 1 }, { r: 4, c: 0, dir: W, s: 2 }],
  }),
  level({
    id: 9,
    name: 'Double Swirl',
    tip: 'Two ceiling fans. Go around them, or punch straight through.',
    open: ACW,
    fans: 4,
    ac: null,
    // prettier-ignore
    map: [
      '.......',
      '....@.p',
      '.....a.',
      'sBs.p..',
      '.......<',
      '.......',
      '.k.....',
      '.k.p@..',
      '.....tt',
    ],
    solution: [{ r: 3, c: 6, dir: S, s: 1 }, { r: 5, c: 6, dir: W, s: 1 }, { r: 5, c: 0, dir: S, s: 1 }, { r: 7, c: 0, dir: W, s: 1 }],
  }),
  level({
    id: 10,
    name: 'Hot Box',
    tip: 'AC blowing in, a ceiling fan, and only the door.',
    open: DOOR,
    fans: 5,
    ac: { dir: E, s: 2 },
    // prettier-ignore
    map: [
      '.p.....',
      '..k..vv',
      '..k..a.',
      '..sBs..',
      '.......<',
      '....k..',
      '..vvk..',
      '...@...',
      '.....tt',
    ],
    solution: [{ r: 3, c: 6, dir: S, s: 1 }, { r: 7, c: 6, dir: W, s: 1 }, { r: 8, c: 4, dir: W, s: 2 }, { r: 8, c: 0, dir: N, s: 2 }, { r: 4, c: 0, dir: W, s: 1 }],
  }),
  level({
    id: 11,
    name: 'Rush Hour',
    tip: 'AC, ceiling fan and furniture. Only the top window is open.',
    open: TOP,
    fans: 5,
    ac: { dir: N, s: 2 },
    // prettier-ignore
    map: [
      '..a....',
      '.......',
      '.....@.',
      '.p.vvkk',
      '..sBs..<',
      '.......',
      '.p.....',
      'p..tt..',
      '.......',
    ],
    solution: [{ r: 4, c: 5, dir: S, s: 1 }, { r: 6, c: 5, dir: W, s: 1 }, { r: 6, c: 2, dir: N, s: 1 }, { r: 5, c: 4, dir: W, s: 2 }, { r: 1, c: 0, dir: W, s: 1 }],
  }),
  level({
    id: 12,
    name: 'Last Joint',
    tip: 'The big one. Every fan counts.',
    open: ACW,
    fans: 6,
    ac: { dir: E, s: 1 },
    // prettier-ignore
    map: [
      'p......',
      '....a..',
      '.k.....',
      '.k.....<',
      '..sBstt',
      '..s....',
      '.......',
      '.p@v@a.',
      '...v...',
    ],
    solution: [{ r: 3, c: 5, dir: N, s: 1 }, { r: 0, c: 5, dir: W, s: 1 }, { r: 0, c: 3, dir: S, s: 1 }, { r: 1, c: 3, dir: W, s: 2 }, { r: 1, c: 0, dir: S, s: 3 }, { r: 7, c: 0, dir: W, s: 2 }],
  }),
];
