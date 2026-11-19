/**
 * The real route, northbound along Sderot Yerushalayim from HaBesht station to the north end of the
 * boulevard, then across to Charles Clore Park by the sea. Pure data + lookups, no DOM.
 *
 * Distances are measured from OpenStreetMap track geometry (station to station) and scaled by ROUTE_SCALE
 * so a lap fits a game run. After the park the walk loops back to HaBesht one speed tier faster.
 */

export const ROUTE_SCALE = 0.7;
const m = (real: number) => real * ROUTE_SCALE;

/** Real station spacing northbound (metres): HaBesht, Isakov, Ehrlich, Bloomfield Stadium, Shalma. */
const START = 40;
export const ROUTE_STATIONS: { en: string; he: string; at: number }[] = (() => {
  const names = [
    { en: 'HaBesht', he: 'הבעש"ט' },
    { en: 'Isakov', he: 'איסקוב' },
    { en: 'Ehrlich', he: 'ארליך' },
    { en: 'Bloomfield Stadium', he: 'אצטדיון בלומפילד' },
    { en: 'Shalma', he: 'שלמה' },
  ];
  const gaps = [0, 390, 435, 485, 480];
  let at = START;
  return names.map((n, i) => { at += m(gaps[i]); return { ...n, at }; });
})();

const SHALMA = ROUTE_STATIONS[4].at;
const EHRLICH = ROUTE_STATIONS[2].at;
/** North end of the boulevard (Kaufman / Eilat St), 235 m past Shalma. */
export const NORTH_END = SHALMA + m(235);
/** The tracks turn off east toward the Elifelet portal just before the north end. */
export const TRACKS_END = NORTH_END - 25;
/** Charles Clore Park begins (Beit Gidi, the Etzel museum) ~300 m from the north end. */
export const PARK_START = NORTH_END + m(300);
/** Length of one lap (the park lawns run on to the end of the lap). */
export const LAP = PARK_START + 270;

/** Island platform length (real ~85 m) and where it starts relative to the station point. */
export const PLATFORM_LEN = 44;

export type Segment = 'south' | 'mall' | 'mandate' | 'kaufman' | 'park';
/**
 * south   HaBesht to Ehrlich: post-1948 housing blocks, asphalt one-lane roads beside the tracks, tamarisks.
 * mall    Ehrlich to Shalma: pedestrian mall since 2019, brick paving with the rails set flush, shops, ficus.
 * mandate Shalma to the north end: older Jaffa stone buildings (post office, Alhambra), palms in the median.
 * kaufman north end to the park: the tram turns off east; a short street crossing with the clock tower away west.
 * park    Charles Clore Park: lawns, the promenade and the sea on the left (west).
 */
export function segmentAtU(u: number): Segment {
  if (u < EHRLICH - 10) return 'south';
  if (u < SHALMA + 20) return 'mall';
  if (u < NORTH_END) return 'mandate';
  if (u < PARK_START) return 'kaufman';
  return 'park';
}

export function lapOf(d: number): number {
  return Math.floor(Math.max(0, d) / LAP);
}
/** Position within the current lap. */
export function lapU(d: number): number {
  const x = Math.max(0, d) % LAP;
  return x;
}
export function segmentAt(d: number): Segment {
  return segmentAtU(lapU(d));
}
/** Is there light-rail track at distance d? (Trams only run here.) */
export function hasTracks(d: number): boolean {
  return lapU(d) < TRACKS_END;
}

/** Station k overall (5 per lap), with its world distance. */
export function station(k: number): { en: string; he: string; at: number } {
  const lap = Math.floor(k / ROUTE_STATIONS.length);
  const s = ROUTE_STATIONS[((k % ROUTE_STATIONS.length) + ROUTE_STATIONS.length) % ROUTE_STATIONS.length];
  return { en: s.en, he: s.he, at: lap * LAP + s.at };
}
/** Platform start for station k (the platform is centred on the station point). */
export function platformStart(k: number): number {
  return station(k).at - PLATFORM_LEN / 2;
}
/** Indices of stations whose platform overlaps [d0, d1]. */
export function stationsIn(d0: number, d1: number): number[] {
  const out: number[] = [];
  const lap0 = Math.max(0, lapOf(d0) - 1), lap1 = lapOf(d1) + 1;
  for (let lap = lap0; lap <= lap1; lap++) {
    for (let j = 0; j < ROUTE_STATIONS.length; j++) {
      const k = lap * ROUTE_STATIONS.length + j;
      const a = platformStart(k);
      if (a + PLATFORM_LEN >= d0 && a <= d1) out.push(k);
    }
  }
  return out;
}

// ---------- street numbers ----------
/** House numbers run from the north end (No. 1) southward; No. 100 is the corner of Ehrlich St. */
export function numberToU(no: number): number {
  return NORTH_END - ((NORTH_END - EHRLICH) * no) / 100;
}

/** Landmarks along the route (lap position, side: -1 west/left, +1 east/right). */
export interface Landmark { kind: 'hospital' | 'mosque' | 'cityhall' | 'stadium' | 'postoffice' | 'clocktower' | 'beitgidi'; u: number; side: -1 | 1 }
export const LANDMARKS: Landmark[] = [
  { kind: 'hospital', u: numberToU(100) + 8, side: 1 },            // Tzahalon (Dajani) Hospital, No. 100 at Ehrlich
  { kind: 'mosque', u: numberToU(82), side: 1 },                   // Al-Nuzha Mosque, No. 82
  { kind: 'cityhall', u: ROUTE_STATIONS[3].at + 12, side: -1 },    // Jaffa City Hall (1935) by Bloomfield station
  { kind: 'stadium', u: ROUTE_STATIONS[3].at + m(240), side: 1 },  // Bloomfield Stadium, ~250 m east of the boulevard
  { kind: 'postoffice', u: numberToU(12), side: 1 },               // Central Post Office (1931), No. 12 (even side)
  { kind: 'clocktower', u: PARK_START - 30, side: -1 },            // Jaffa Clock Tower, ~400 m west (seen across the junction)
  { kind: 'beitgidi', u: PARK_START + 18, side: -1 },              // Etzel Museum (Beit Gidi) at the south end of Clore Park
];

/** Split world distances [z0, z1] into pieces of constant segment (for drawing). */
export function pieces(z0: number, z1: number): { a: number; b: number; seg: Segment }[] {
  const out: { a: number; b: number; seg: Segment }[] = [];
  const bounds = [0, EHRLICH - 10, SHALMA + 20, NORTH_END, PARK_START];
  let z = Math.max(0, z0);
  if (z0 < 0) out.push({ a: z0, b: 0, seg: 'south' });
  while (z < z1) {
    const lap = lapOf(z), u = z - lap * LAP;
    let next = (lap + 1) * LAP;
    for (const b of bounds) if (b > u + 1e-6) { next = lap * LAP + b; break; }
    const b = Math.min(z1, next);
    out.push({ a: z, b, seg: segmentAtU(u) });
    z = b;
  }
  return out;
}
