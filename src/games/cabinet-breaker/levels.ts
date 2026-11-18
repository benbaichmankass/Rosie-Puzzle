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

export type ItemKind = 'plates' | 'bowls' | 'glasses' | 'box' | 'cans' | 'pot' | 'pan';

export interface ItemDef {
  kind: ItemKind;
  /** Hits needed to smash it. */
  hits: number;
  /** Points when it smashes (each non-final hit is worth 10). */
  points: number;
  /** Sound family. */
  material: 'ceramic' | 'glass' | 'cardboard' | 'tin' | 'metal' | 'iron';
}

export const ITEMS: Record<string, ItemDef> = {
  P: { kind: 'plates', hits: 1, points: 50, material: 'ceramic' },
  B: { kind: 'bowls', hits: 1, points: 50, material: 'ceramic' },
  G: { kind: 'glasses', hits: 1, points: 60, material: 'glass' },
  C: { kind: 'box', hits: 1, points: 40, material: 'cardboard' },
  T: { kind: 'cans', hits: 2, points: 90, material: 'tin' },
  O: { kind: 'pot', hits: 2, points: 120, material: 'metal' },
  N: { kind: 'pan', hits: 3, points: 180, material: 'iron' },
};

export interface LevelDef {
  name: string;
  /** Up to MAX_ROWS strings of exactly COLS chars. '.' = empty slot. Row 0 is the top shelf. */
  rows: string[];
}

/** Ordered roughly by difficulty: heavier items and trickier shapes come later. */
export const LEVELS: LevelDef[] = [
  { name: 'Clean Dishes', rows: ['PPPPPPPP', 'BBBBBBBB', 'GGGGGGGG', '........', 'CCCCCCCC'] },
  { name: 'Stacked Up', rows: ['...PP...', '..BBBB..', '.GGGGGG.', 'PPPPPPPP', 'CCTCCTCC'] },
  { name: 'Two Cupboards', rows: ['PPP..BBB', 'GGG..GGG', 'TCT..TCT', 'BBB..PPP', 'CCC..CCC', 'OPO..OPO'] },
  { name: 'Pantry Check', rows: ['C.C.C.C.', '.T.T.T.T', 'B.B.B.B.', '.G.G.G.G', 'P.P.P.P.', '.C.C.C.C'] },
  { name: 'Dinner for Two', rows: ['.BB..BB.', 'BPPBBPPB', 'BPPGGPPB', '.BPGGPB.', '..BPPB..', '...BB...'] },
  { name: 'Soup Night', rows: ['O.O..O.O', 'BBBBBBBB', '.PPPPPP.', 'GG.GG.GG', 'TTTTTTTT', '..BBBB..'] },
  { name: 'Spice Rack', rows: ['TCTCTCTC', '........', 'CTCTCTCT', '........', 'GGGGGGGG', 'OBOBOBOB'] },
  {
    name: 'Good Morning',
    rows: ['.PP..PP.', 'PGGPPGGP', 'PGGPPGGP', '.PP..PP.', '........', 'C......C', '.CTTTTC.', '..BBBB..'],
  },
  { name: 'Diamond Dinnerware', rows: ['...GG...', '..PBBP..', '.PTOOTP.', 'GBONNOBG', '.PTOOTP.', '..PBBP..', '...GG...'] },
  { name: 'The Valley', rows: ['P......P', 'BP....PB', 'GBP..PBG', 'TGBPPBGT', '.TGBBGT.', '..TGGT..', '...OO...'] },
  {
    name: 'Zig Zag Shelves',
    rows: ['PPPP....', '.BBBB...', '..GGGG..', '...TTTT.', '....OOOO', '...CCCC.', '..PPPP..', '.BBBB...'],
  },
  { name: 'Hourglass', rows: ['TTTTTTTT', '.PPPPPP.', '..GGGG..', '...NN...', '..GGGG..', '.BBBBBB.', 'CCCCCCCC'] },
  { name: 'Up the Shelf', rows: ['...NN...', '..OGGO..', '.OGPPGO.', 'OGPBBPGO', '...TT...', '...TT...', '...CC...'] },
  { name: 'Heavy Metal', rows: ['NNNNNNNN', 'O.O..O.O', 'GGGGGGGG', 'TBTBTBTB', 'PPPPPPPP', '.O.OO.O.'] },
  { name: 'Fortress', rows: ['NNNNNNNN', 'N.GGGG.N', 'N.GPPG.N', 'N.GGGG.N', 'O......O', 'OTTTTTTO'] },
  {
    name: 'Full Kitchen',
    rows: ['NOOGGOON', 'TPPBBPPT', 'CGGTTGGC', 'BBOPPOBB', 'PPPNNPPP', 'GCTCCTCG', 'BBBBBBBB', 'PPPPPPPP'],
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
