/** Level tuning. Each level is 60 real seconds = the 3 hours before candle lighting. */

export const LEVEL_SECONDS = 60;
export const GAME_MINUTES = 180;
export const BOIL_SECONDS = 10;

export interface LevelParams {
  level: number;
  strands: number;
  crosses: number;
  calls: number;
  /** Wrap-up replies needed to end each call. */
  wrapsPerCall: number;
  /** Plata width in plate units. */
  plateW: number;
  /** Support-span margin for stability (negative = forgiving). */
  margin: number;
  /** Real seconds (from level start) when each call rings. */
  ringAt: number[];
}

const TABLE: Omit<LevelParams, 'level' | 'ringAt'>[] = [
  { strands: 3, crosses: 4, calls: 1, wrapsPerCall: 2, plateW: 330, margin: -8 },
  { strands: 3, crosses: 6, calls: 2, wrapsPerCall: 2, plateW: 300, margin: -3 },
  { strands: 4, crosses: 6, calls: 2, wrapsPerCall: 2, plateW: 280, margin: 0 },
  { strands: 4, crosses: 8, calls: 2, wrapsPerCall: 3, plateW: 260, margin: 3 },
  { strands: 5, crosses: 8, calls: 3, wrapsPerCall: 2, plateW: 250, margin: 5 },
  { strands: 5, crosses: 10, calls: 3, wrapsPerCall: 3, plateW: 240, margin: 7 },
];

export function levelParams(level: number): LevelParams {
  const base = TABLE[Math.min(level, TABLE.length) - 1];
  const extra = Math.max(0, level - TABLE.length);
  const p = { ...base, crosses: base.crosses + extra * 2, margin: base.margin + Math.min(extra, 3) };
  // Calls ring spread through the first two thirds of the level.
  const ringAt = Array.from({ length: p.calls }, (_, i) => Math.round(6 + (i * 34) / Math.max(1, p.calls - 1 || 1)));
  return { level, ...p, ringAt: p.calls === 1 ? [10] : ringAt };
}

/** Points for clearing a level with `secondsLeft` real seconds to spare. */
export const levelScore = (level: number, secondsLeft: number) => 100 * level + Math.round(secondsLeft * 10);
