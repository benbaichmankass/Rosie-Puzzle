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

/**
 * Landmarks along the route (lap position, side: -1 west/left, +1 east/right walking north).
 * House numbers: even on the WEST side, odd on the EAST (OpenStreetMap address points), No. 2 at the north end.
 * 'facade' landmarks replace a block of the street wall; the others are drawn standing behind or beside it.
 */
export type LandmarkKind =
  | 'davidoff' | 'tower139' | 'hospital' | 'mosque' | 'cityhall' | 'alhambra' | 'ruthdaniel' | 'stadium'
  | 'junction' | 'siksik' | 'policehq' | 'postoffice' | 'sheqem' | 'gesher' | 'carriage'
  | 'clocktower' | 'mahmoudiya' | 'market' | 'kishle' | 'beitgidi' | 'hassanbek' | 'skyline';
export interface Landmark { kind: LandmarkKind; u: number; side: -1 | 1; facade?: boolean }
export const LANDMARKS: Landmark[] = [
  { kind: 'davidoff', u: ROUTE_STATIONS[0].at + 30, side: 1, facade: true },   // Davidoff Garden + Jaffa Tennis Center, east of HaBesht
  { kind: 'tower139', u: numberToU(139), side: 1, facade: true },             // new "Yafo BaShdera" residential tower at No. 139, by Isakov
  { kind: 'hospital', u: numberToU(100) + 8, side: -1, facade: true },        // Tzahalon (Dajani) Hospital, No. 100 (1933, white International Style)
  { kind: 'mosque', u: numberToU(82), side: -1 },                             // Al-Nuzha Mosque, No. 82 (1933)
  { kind: 'ruthdaniel', u: numberToU(47), side: 1, facade: true },            // Mishkenot Ruth Daniel, No. 47 (old-Jaffa style arches)
  { kind: 'cityhall', u: numberToU(45), side: 1, facade: true },              // historic Jaffa City Hall, No. 45 (1935), with its square and fountain
  { kind: 'alhambra', u: numberToU(39), side: 1, facade: true },              // Alhambra cinema, No. 39 (Art Deco, 1937, "ALHAMBRA" sign)
  { kind: 'stadium', u: ROUTE_STATIONS[3].at + m(240), side: 1 },            // Bloomfield Stadium, ~230 m east: white angular cladding, two big trusses
  { kind: 'junction', u: SHALMA + 14, side: -1, facade: true },              // Shalma (Salame) Road junction: side streets both ways
  { kind: 'junction', u: SHALMA + 14, side: 1, facade: true },
  { kind: 'siksik', u: SHALMA + 30, side: -1 },                               // Siksik Mosque, ~130 m west
  { kind: 'policehq', u: SHALMA + 20, side: 1 },                              // Tel Aviv District Police HQ, 7 storeys, ~280 m east
  { kind: 'postoffice', u: numberToU(12), side: -1, facade: true },           // Central Post Office, No. 12 (1931, striped "ablaq" stone)
  { kind: 'sheqem', u: numberToU(8), side: -1, facade: true },                // Sheqem building, No. 8 (1920s)
  { kind: 'carriage', u: numberToU(11), side: 1, facade: true },              // old carriage station, No. 11 (colonnade, small tower)
  { kind: 'gesher', u: numberToU(5), side: 1, facade: true },                 // Gesher Theatre (former Nabil/Noga cinema)
  { kind: 'clocktower', u: PARK_START - 30, side: -1 },                       // Jaffa Clock Tower (1903), west down the side streets
  { kind: 'mahmoudiya', u: PARK_START - 52, side: -1 },                       // Mahmoudiya Mosque beside it: hexagonal minaret, domes
  { kind: 'market', u: NORTH_END + 25, side: -1 },                            // the flea market lanes off to the west
  { kind: 'kishle', u: NORTH_END + 70, side: 1 },                             // the old Kishle police station (now The Setai), 4 storeys of stone
  { kind: 'beitgidi', u: PARK_START + 18, side: -1 },                         // Etzel Museum (Beit Gidi): stone house with a dark glass box on top
  { kind: 'hassanbek', u: PARK_START + 120, side: 1 },                        // Hassan Bek Mosque: very tall slender minaret, NE of the park
  { kind: 'skyline', u: PARK_START + 60, side: 1 },                           // the towers behind the park (Textile House, City Palace, hotels)
];

/** Easter egg: Shai waiting on the Isakov platform with his grey backpack. */
export const SHAI_U = ROUTE_STATIONS[1].at - 8;

/** Soccer fans in red along the Bloomfield Stadium stretch (tap one to make Rosie nip them). */
export interface Fan { id: number; d: number; x: number; variant: number }
const FAN_FROM = ROUTE_STATIONS[3].at - 70, FAN_TO = SHALMA - 40;
export function fansNear(d0: number, d1: number): Fan[] {
  const out: Fan[] = [];
  const lap0 = Math.max(0, lapOf(d0)), lap1 = lapOf(d1);
  for (let lap = lap0; lap <= lap1; lap++) {
    for (let g = 0, u = FAN_FROM; u < FAN_TO; g++, u += 26) {
      const side = g % 2 ? 1 : -1;
      for (let j = 0; j < 3; j++) {
        const d = lap * LAP + u + j * 0.9;
        if (d < d0 || d > d1) continue;
        out.push({ id: lap * 10000 + g * 10 + j, d, x: side * (0.98 + (j % 2) * 0.12), variant: (g * 3 + j) % 6 });
      }
    }
  }
  return out;
}

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
