/**
 * Challah braiding rules. Strands are joined at the bottom; the player braids upward by dragging
 * an OUTER strand over its neighbours toward the middle, alternating sides:
 *   - 3 strands: outside strand over 1 (right over middle, then left over middle, ...)
 *   - 4 strands: outside strand over 2
 *   - 5 strands: outside strand over 2
 *   - n strands: outside strand over floor(n / 2)
 * The first cross may start from either side; after that sides must alternate.
 */

export type Side = 'L' | 'R';

export interface Cross {
  strand: number;
  from: number;
  to: number;
  side: Side;
}

export interface BraidState {
  n: number;
  /** order[pos] = strand id currently at that position (left to right). */
  order: number[];
  /** Side the next cross must come from; null before the first cross. */
  next: Side | null;
  crosses: Cross[];
  target: number;
  mistakes: number;
}

export const span = (n: number) => Math.floor(n / 2);

export function newBraid(n: number, target: number): BraidState {
  if (n < 3) throw new Error('a braid needs at least 3 strands');
  return { n, order: Array.from({ length: n }, (_, i) => i), next: null, crosses: [], target, mistakes: 0 };
}

export interface Move {
  from: number;
  to: number;
  side: Side;
}

export function moveFor(n: number, side: Side): Move {
  const k = span(n);
  return side === 'R' ? { from: n - 1, to: n - 1 - k, side } : { from: 0, to: k, side };
}

/** The moves allowed right now (two before the first cross, one afterwards, none when finished). */
export function legalMoves(s: BraidState): Move[] {
  if (isComplete(s)) return [];
  if (s.next === null) return [moveFor(s.n, 'R'), moveFor(s.n, 'L')];
  return [moveFor(s.n, s.next)];
}

export function isComplete(s: BraidState): boolean {
  return s.crosses.length >= s.target;
}

export type MoveResult =
  | { ok: true; state: BraidState }
  | { ok: false; state: BraidState; reason: 'done' | 'not-outer' | 'wrong-side' | 'wrong-distance' | 'no-op' };

/** Drag the strand at position `from` so it lands at position `to`. */
export function tryMove(s: BraidState, from: number, to: number): MoveResult {
  const fail = (reason: 'done' | 'not-outer' | 'wrong-side' | 'wrong-distance' | 'no-op'): MoveResult => ({
    ok: false,
    state: reason === 'no-op' || reason === 'done' ? s : { ...s, mistakes: s.mistakes + 1 },
    reason,
  });
  if (isComplete(s)) return fail('done');
  if (from === to || to < 0 || to >= s.n || from < 0 || from >= s.n) return fail('no-op');
  const side: Side | null = from === 0 ? 'L' : from === s.n - 1 ? 'R' : null;
  if (!side) return fail('not-outer');
  if (s.next !== null && side !== s.next) return fail('wrong-side');
  const m = moveFor(s.n, side);
  if (to !== m.to) return fail('wrong-distance');
  const order = s.order.slice();
  const [strand] = order.splice(from, 1);
  order.splice(to, 0, strand);
  return {
    ok: true,
    state: {
      ...s,
      order,
      next: side === 'R' ? 'L' : 'R',
      crosses: [...s.crosses, { strand, from, to, side }],
    },
  };
}

/** Strand order after each cross: rows[0] is the knot, rows[k] after k crosses. */
export function braidRows(s: BraidState): number[][] {
  const rows: number[][] = [Array.from({ length: s.n }, (_, i) => i)];
  let cur = rows[0];
  for (const c of s.crosses) {
    const next = cur.slice();
    const [strand] = next.splice(c.from, 1);
    next.splice(c.to, 0, strand);
    rows.push(next);
    cur = next;
  }
  return rows;
}

/** Plain-language rule for the on-screen hint. */
export function ruleText(n: number): string {
  const k = span(n);
  return k === 1
    ? 'Outside strand over the middle one. Alternate sides.'
    : `Outside strand over ${k} strands toward the middle. Alternate sides.`;
}
