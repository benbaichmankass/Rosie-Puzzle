/**
 * Cabinet Breaker level data and board geometry. Pure TS (no DOM) so the check script can use it.
 *
 * The board is a fixed 360 units wide; its height adapts to the screen (BOARD_MIN_H..BOARD_MAX_H).
 * The upper cabinet sits at the top: shelf rows of kitchen items ("bricks") that rest on planks.
 */

export const BOARD_W = 360;
export const BOARD_MIN_H = 560;
export const BOARD_MAX_H = 800;

/** Inner play area walls (the cabinet sides and the crown moulding). */
export const WALL_L = 14;
export const WALL_R = BOARD_W - 14;
export const WALL_T = 58;

export const COLS = 8;
export const MAX_ROWS = 8;
export const COL_W = (WALL_R - WALL_L) / COLS; // 41
export const ITEM_H = 26;
export const PLANK_H = 7;
export const ROW_H = ITEM_H + PLANK_H; // 33
/** Top of the first item row (a little air under the crown). */
export const ROWS_TOP = WALL_T + 6;
/** Bottom edge of the upper cabinet (below the last possible shelf). */
export const CABINET_BOTTOM = ROWS_TOP + MAX_ROWS * ROW_H + 8;

/** The items from Ben and Shai's real kitchen. */
export type ItemKind =
  | 'rackPlates'
  | 'glasses'
  | 'steelBowls'
  | 'colander'
  | 'soap'
  | 'frenchPress'
  | 'coffee'
  | 'cereal'
  | 'tea'
  | 'canisters'
  | 'spices'
  | 'oliveOil'
  | 'honey'
  | 'mugs'
  | 'filterJug'
  | 'pickles'
  | 'kettle'
  | 'tomatoes'
  | 'crock'
  | 'sodaStream'
  | 'pot'
  | 'moka'
  | 'clayPot'
  | 'airFryer'
  | 'pan';

export type Material = 'ceramic' | 'glass' | 'metal' | 'tin' | 'iron' | 'plastic' | 'paper' | 'wood' | 'clay';

export interface ItemDef {
  kind: ItemKind;
  /** Hits needed to smash it. */
  hits: number;
  /** Points when it smashes (each non-final hit is worth 10). */
  points: number;
  /** Sound and debris family. */
  material: Material;
}

export const ITEMS: Record<string, ItemDef> = {
  // 1 hit
  P: { kind: 'rackPlates', hits: 1, points: 50, material: 'ceramic' },
  G: { kind: 'glasses', hits: 1, points: 60, material: 'glass' },
  B: { kind: 'steelBowls', hits: 1, points: 50, material: 'metal' },
  L: { kind: 'colander', hits: 1, points: 50, material: 'plastic' },
  S: { kind: 'soap', hits: 1, points: 50, material: 'plastic' },
  F: { kind: 'frenchPress', hits: 1, points: 70, material: 'glass' },
  W: { kind: 'coffee', hits: 1, points: 50, material: 'paper' },
  R: { kind: 'cereal', hits: 1, points: 40, material: 'paper' },
  I: { kind: 'tea', hits: 1, points: 40, material: 'paper' },
  Q: { kind: 'canisters', hits: 1, points: 50, material: 'ceramic' },
  E: { kind: 'spices', hits: 1, points: 50, material: 'glass' },
  V: { kind: 'oliveOil', hits: 1, points: 60, material: 'glass' },
  Y: { kind: 'honey', hits: 1, points: 60, material: 'glass' },
  M: { kind: 'mugs', hits: 1, points: 50, material: 'ceramic' },
  H: { kind: 'filterJug', hits: 1, points: 50, material: 'plastic' },
  J: { kind: 'pickles', hits: 1, points: 60, material: 'glass' },
  // 2 hits
  K: { kind: 'kettle', hits: 2, points: 110, material: 'metal' },
  T: { kind: 'tomatoes', hits: 2, points: 90, material: 'tin' },
  U: { kind: 'crock', hits: 2, points: 90, material: 'wood' },
  D: { kind: 'sodaStream', hits: 2, points: 110, material: 'plastic' },
  O: { kind: 'pot', hits: 2, points: 120, material: 'metal' },
  Z: { kind: 'moka', hits: 2, points: 110, material: 'metal' },
  // 3 hits
  C: { kind: 'clayPot', hits: 3, points: 180, material: 'clay' },
  A: { kind: 'airFryer', hits: 3, points: 200, material: 'plastic' },
  N: { kind: 'pan', hits: 3, points: 180, material: 'iron' },
};

export interface LevelDef {
  name: string;
  /** Up to MAX_ROWS strings of exactly COLS chars. '.' = empty slot. Row 0 is the top shelf. */
  rows: string[];
}

/** Ordered roughly by difficulty: heavier items and trickier shapes come later. */
export const LEVELS: LevelDef[] = [
  { name: 'Clean Dishes', rows: ['PPPPPPPP', 'LLLLLLLL', 'GGGGSSSS', '........', 'EMEMEMEM'] },
  { name: 'Stacked Up', rows: ['...PP...', '..LLLL..', '.MGMEEE.', 'JJJJJJJJ', 'VWTVWTVW'] },
  { name: 'Two Cupboards', rows: ['PPP..BBB', 'FFF..MGM', 'UEU..UMU', 'LLL..JJJ', 'YRY..RYR', 'ZHZ..KHK'] },
  { name: 'Pantry Check', rows: ['Q.Y.Q.Y.', '.K.K.K.K', 'B.B.B.B.', '.R.I.W.Y', 'P.P.P.P.', '.Q.E.V.R'] },
  { name: 'Dinner for Two', rows: ['.BB..BB.', 'LHHLLHHL', 'BPPGSPPB', '.LJSGJL.', '..BPPB..', '...LL...'] },
  { name: 'Soup Night', rows: ['O.O..O.O', 'LLLLLLLL', '.PPPPPP.', 'EE.EV.VE', 'TTTTTTTT', '..LLLL..'] },
  { name: 'Coffee Corner', rows: ['TWTMTWTM', '........', 'WZIZWZIZ', '........', 'MMMMFFFF', 'ZQZQZQZQ'] },
  {
    name: 'Good Morning',
    rows: ['.PP..PP.', 'HFFHHMMH', 'PMGPPSSP', '.JJ..JJ.', '........', 'R......R', '.YUUUUW.', '..LLLL..'],
  },
  { name: 'Diamond Dinnerware', rows: ['...GF...', '..HLLH..', '.PUOOUP.', 'SLZAAKLM', '.PTOOTP.', '..HLLH..', '...GS...'] },
  { name: 'The Valley', rows: ['P......P', 'LH....HL', 'GBP..PBE', 'DVLJJLYD', '.TGBBFT.', '..ZFGK..', '...OO...'] },
  {
    name: 'Zig Zag Shelves',
    rows: ['PPPP....', '.LLLL...', '..MMEE..', '...DDDD.', '....OOOO', '...WIRQ.', '..PPPP..', '.LLLL...'],
  },
  { name: 'Hourglass', rows: ['TTTTTTTT', '.HHHHHH.', '..GMEE..', '...AA...', '..GMFF..', '.LLLLLL.', 'RERERERE'] },
  { name: 'Up the Shelf', rows: ['...AA...', '..ZFGK..', '.OGPPSO.', 'ZSJLLJGK', '...TT...', '...KZ...', '...IV...'] },
  { name: 'Heavy Metal', rows: ['NNCCCCNN', 'Z.Z..K.K', 'GMGMEEEE', 'DLDLDLDL', 'PPPPPPPP', '.K.KZ.Z.'] },
  { name: 'Fortress', rows: ['AAAAAAAA', 'C.FFGM.C', 'N.GPPS.N', 'A.QQGM.A', 'O......O', 'ZKZKZKZK'] },
  {
    name: 'Full Kitchen',
    rows: ['AOOMFOOA', 'ZHHLLHHK', 'RMGUUSSE', 'LLZJJKLL', 'PPPCCPPP', 'FVZYYKVG', 'BBBBBBBB', 'JJJJJJJJ'],
  },
];

export interface Brick {
  id: number;
  row: number;
  col: number;
  x: number;
  y: number;
  w: number;
  h: number;
  def: ItemDef;
  hitsLeft: number;
}

/** Item slot rectangle for a row/col (the item art fills it, resting on the plank below). */
export function slotRect(row: number, col: number) {
  const x = WALL_L + col * COL_W + 2;
  const y = ROWS_TOP + row * ROW_H;
  return { x, y, w: COL_W - 4, h: ITEM_H };
}

/** Top surface y of the plank under a row. */
export function plankY(row: number) {
  return ROWS_TOP + row * ROW_H + ITEM_H;
}

/** Levels loop after the last one; the loop number makes the ball faster. */
export function levelDef(levelIndex: number): LevelDef {
  return LEVELS[levelIndex % LEVELS.length];
}

export function buildBricks(levelIndex: number): Brick[] {
  const def = levelDef(levelIndex);
  const bricks: Brick[] = [];
  def.rows.forEach((line, row) => {
    for (let col = 0; col < line.length; col++) {
      const item = ITEMS[line[col]];
      if (!item) continue;
      const r = slotRect(row, col);
      bricks.push({ id: bricks.length, row, col, ...r, def: item, hitsLeft: item.hits });
    }
  });
  return bricks;
}

/** Validation used by the check script. Returns a list of problems (empty = ok). */
export function validateLevel(def: LevelDef): string[] {
  const errs: string[] = [];
  if (def.rows.length === 0 || def.rows.length > MAX_ROWS) errs.push(`${def.name}: ${def.rows.length} rows (1..${MAX_ROWS})`);
  def.rows.forEach((line, i) => {
    if (line.length !== COLS) errs.push(`${def.name}: row ${i} has ${line.length} cols (need ${COLS})`);
    for (const ch of line) if (ch !== '.' && !ITEMS[ch]) errs.push(`${def.name}: row ${i} unknown item '${ch}'`);
  });
  if (!def.rows.some((l) => [...l].some((ch) => ITEMS[ch]))) errs.push(`${def.name}: no items`);
  return errs;
}
