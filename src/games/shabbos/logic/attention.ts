/**
 * Which counter stations should flash for attention right now. Pure, so the urgency rules
 * can be tested: the phone while it rings, the urn if it isn't on by the time the boil would
 * get tight, and anything unfinished in the last stretch of the level.
 */
import { BOIL_SECONDS, LEVEL_SECONDS } from './levels';

export type StationId = 'challah' | 'urn' | 'plata' | 'mom';

export interface AttentionInput {
  t: number;
  ringing: boolean;
  urnOn: boolean;
  done: Record<StationId, boolean>;
  /** Level time of the last topple on the plata, if any. */
  toppledAt?: number | null;
}

/** Seconds left below which every unfinished station flashes. */
export const CRUNCH_SECONDS = 15;

export function attention(a: AttentionInput): StationId[] {
  const left = LEVEL_SECONDS - a.t;
  const out = new Set<StationId>();
  if (a.ringing) out.add('mom');
  // The urn needs 10 s: nag once less than boil time + 15 s remains and it isn't on.
  if (!a.urnOn && !a.done.urn && left <= BOIL_SECONDS + 15) out.add('urn');
  if (a.toppledAt != null && a.t - a.toppledAt < 1.5) out.add('plata');
  if (left <= CRUNCH_SECONDS) {
    for (const id of ['challah', 'urn', 'plata'] as StationId[]) if (!a.done[id]) out.add(id);
  }
  return [...out];
}
