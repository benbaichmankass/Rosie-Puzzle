/**
 * Plata (Shabbat hotplate) loading: a side view of a flat hotplate. Items drop straight down and
 * rest on the plate or on the highest item under them. Simple static stability:
 *  - an item resting on a domed top (challah, cake) slides off;
 *  - an item (plus the load it carries) whose centre of mass sits outside the span of its
 *    supports, shrunk by the level's margin, topples. Everything resting on it falls with it.
 * Units are abstract "plate units"; the plate is centred on x = 0.
 */

export type ItemKind = 'pot' | 'tray' | 'challah' | 'cake';

export interface ItemDef {
  id: string;
  kind: ItemKind;
  w: number;
  h: number;
  mass: number;
  flatTop: boolean;
  label: string;
}

export interface Placed {
  id: string;
  /** Centre x. */
  x: number;
  /** Bottom height above the plate. */
  y: number;
}

export const ITEMS: ItemDef[] = [
  { id: 'pot', kind: 'pot', w: 84, h: 74, mass: 6, flatTop: true, label: 'Soup pot' },
  { id: 'tray1', kind: 'tray', w: 132, h: 24, mass: 3, flatTop: true, label: 'Tray' },
  { id: 'tray2', kind: 'tray', w: 132, h: 24, mass: 3, flatTop: true, label: 'Tray' },
  { id: 'challah1', kind: 'challah', w: 96, h: 36, mass: 1, flatTop: false, label: 'Challah' },
  { id: 'challah2', kind: 'challah', w: 96, h: 36, mass: 1, flatTop: false, label: 'Challah' },
  { id: 'cake', kind: 'cake', w: 78, h: 44, mass: 2, flatTop: false, label: 'Cake' },
];

export const itemById = (id: string): ItemDef => {
  const d = ITEMS.find((i) => i.id === id);
  if (!d) throw new Error(`unknown item ${id}`);
  return d;
};

const EPS = 0.5;

const left = (p: Placed) => p.x - itemById(p.id).w / 2;
const right = (p: Placed) => p.x + itemById(p.id).w / 2;
const top = (p: Placed) => p.y + itemById(p.id).h;

function overlap(a0: number, a1: number, b0: number, b1: number): number {
  return Math.min(a1, b1) - Math.max(a0, b0);
}

/** Height at which an item dropped with centre x would come to rest. */
export function landingY(placed: Placed[], id: string, x: number): number {
  const w = itemById(id).w;
  let y = 0;
  for (const p of placed) {
    if (overlap(x - w / 2, x + w / 2, left(p), right(p)) > EPS) y = Math.max(y, top(p));
  }
  return y;
}

/** Items directly supporting `p` (touching its bottom and overlapping horizontally). */
export function supportsOf(placed: Placed[], p: Placed): Placed[] {
  return placed.filter(
    (q) => q.id !== p.id && Math.abs(top(q) - p.y) < EPS && overlap(left(p), right(p), left(q), right(q)) > EPS,
  );
}

/** Total mass and mass-weighted x of `p` plus everything resting on it (shared loads split evenly). */
function loadOf(placed: Placed[], p: Placed, memo: Map<string, { m: number; mx: number }>): { m: number; mx: number } {
  const hit = memo.get(p.id);
  if (hit) return hit;
  const d = itemById(p.id);
  let m = d.mass;
  let mx = d.mass * p.x;
  for (const q of placed) {
    if (q.id === p.id) continue;
    const sup = supportsOf(placed, q);
    if (!sup.some((s) => s.id === p.id)) continue;
    const l = loadOf(placed, q, memo);
    // The share of q's load carried by p is applied at q's centre of mass, clamped to p's footprint.
    const share = 1 / sup.length;
    const qcx = l.mx / l.m;
    const cx = Math.max(left(p), Math.min(right(p), qcx));
    m += l.m * share;
    mx += l.m * share * cx;
  }
  const r = { m, mx };
  memo.set(p.id, r);
  return r;
}

export interface StabilityReport {
  /** Ids that fall, lowest first (an unstable item plus everything resting on it). */
  falling: string[];
  /** Why the lowest falling item went. */
  reason?: 'dome' | 'tip' | 'off-plate';
}

/** Checks the stack. `plateW` is the plate width; `margin` shrinks support spans (negative = forgiving). */
export function checkStability(placed: Placed[], plateW: number, margin: number): StabilityReport {
  const memo = new Map<string, { m: number; mx: number }>();
  const sorted = placed.slice().sort((a, b) => a.y - b.y);
  for (const p of sorted) {
    let s0: number;
    let s1: number;
    let reason: StabilityReport['reason'] = 'tip';
    if (p.y < EPS) {
      s0 = -plateW / 2;
      s1 = plateW / 2;
      reason = 'off-plate';
    } else {
      const sup = supportsOf(placed, p);
      if (sup.length === 0) return { falling: withAbove(placed, p.id), reason: 'tip' };
      if (sup.some((q) => !itemById(q.id).flatTop)) return { falling: withAbove(placed, p.id), reason: 'dome' };
      s0 = Math.min(...sup.map((q) => Math.max(left(q), left(p))));
      s1 = Math.max(...sup.map((q) => Math.min(right(q), right(p))));
    }
    const l = loadOf(placed, p, memo);
    const cx = l.mx / l.m;
    const m = Math.min(margin, (s1 - s0) / 2 - 1);
    if (cx < s0 + m || cx > s1 - m) return { falling: withAbove(placed, p.id), reason };
  }
  return { falling: [] };
}

/** `id` plus every item resting on it, transitively. */
export function withAbove(placed: Placed[], id: string): string[] {
  const out = [id];
  for (let i = 0; i < out.length; i++) {
    const p = placed.find((q) => q.id === out[i]);
    if (!p) continue;
    for (const q of placed) {
      if (out.includes(q.id)) continue;
      if (supportsOf(placed, q).some((s) => s.id === p.id)) out.push(q.id);
    }
  }
  return out;
}

export interface DropResult {
  placed: Placed[];
  /** Items that toppled (removed from `placed`). */
  fell: string[];
  reason?: StabilityReport['reason'];
  landed: Placed;
}

/** Drop item `id` with centre x; resolves topples (repeatedly, until the stack is stable). */
export function drop(placed: Placed[], id: string, x: number, plateW: number, margin: number): DropResult {
  const landed: Placed = { id, x, y: landingY(placed, id, x) };
  let next = [...placed.filter((p) => p.id !== id), landed];
  const fell: string[] = [];
  let reason: StabilityReport['reason'];
  for (let guard = 0; guard < 10; guard++) {
    const r = checkStability(next, plateW, margin);
    if (!r.falling.length) break;
    reason ??= r.reason;
    fell.push(...r.falling);
    next = next.filter((p) => !r.falling.includes(p.id));
    // Items that lost support settle down onto what remains.
    next = settle(next);
  }
  return { placed: next, fell, reason, landed };
}

/** Re-drops everything bottom-up so nothing floats. */
export function settle(placed: Placed[]): Placed[] {
  const out: Placed[] = [];
  for (const p of placed.slice().sort((a, b) => a.y - b.y)) out.push({ ...p, y: landingY(out, p.id, p.x) });
  return out;
}

export const isLoaded = (placed: Placed[]) => ITEMS.every((d) => placed.some((p) => p.id === d.id));
