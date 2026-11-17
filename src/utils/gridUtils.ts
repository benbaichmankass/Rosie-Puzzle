import { CellCoord } from '../types';

export function normalizeCells<T extends CellCoord>(cells: T[]): T[] {
  if (cells.length === 0) return [];
  const minR = Math.min(...cells.map((c) => c.r));
  const minC = Math.min(...cells.map((c) => c.c));
  return cells
    .map((c) => ({
      ...c,
      r: c.r - minR,
      c: c.c - minC,
    }))
    .sort((a, b) => (a.r !== b.r ? a.r - b.r : a.c - b.c));
}

export function rotateCells<T extends CellCoord>(cells: T[]): T[] {
  // 90 deg clockwise: (r, c) -> (c, -r)
  const rotated = cells.map((cell) => ({
    ...cell,
    r: cell.c,
    c: -cell.r,
  }));
  return normalizeCells(rotated);
}

export function flipCells<T extends CellCoord>(cells: T[]): T[] {
  // Horizontal flip: (r, c) -> (r, -c)
  const flipped = cells.map((cell) => ({
    ...cell,
    r: cell.r,
    c: -cell.c,
  }));
  return normalizeCells(flipped);
}

export function getPieceBoundingBox(cells: CellCoord[]) {
  if (cells.length === 0) return { width: 0, height: 0, maxR: 0, maxC: 0 };
  const maxR = Math.max(...cells.map((c) => c.r));
  const maxC = Math.max(...cells.map((c) => c.c));
  return { width: maxC + 1, height: maxR + 1, maxR, maxC };
}

export function coordKey(r: number, c: number): string {
  return `${r},${c}`;
}

export function parseCoordKey(key: string): CellCoord {
  const [r, c] = key.split(',').map(Number);
  return { r, c };
}

export function canPlace(
  cells: CellCoord[],
  origin: CellCoord,
  maxRows: number,
  maxCols: number,
  blockedCoords: Set<string>
): boolean {
  for (const cell of cells) {
    const r = origin.r + cell.r;
    const c = origin.c + cell.c;
    if (r < 0 || r >= maxRows || c < 0 || c >= maxCols) {
      return false;
    }
    if (blockedCoords.has(coordKey(r, c))) {
      return false;
    }
  }
  return true;
}

export function areAdjacent(
  cells1: CellCoord[],
  origin1: CellCoord,
  cells2: CellCoord[],
  origin2: CellCoord
): boolean {
  const set1 = new Set(cells1.map((c) => coordKey(origin1.r + c.r, origin1.c + c.c)));
  for (const c2 of cells2) {
    const r = origin2.r + c2.r;
    const c = origin2.c + c2.c;
    const neighbors = [
      coordKey(r - 1, c),
      coordKey(r + 1, c),
      coordKey(r, c - 1),
      coordKey(r, c + 1),
    ];
    if (neighbors.some((n) => set1.has(n))) {
      return true;
    }
  }
  return false;
}
