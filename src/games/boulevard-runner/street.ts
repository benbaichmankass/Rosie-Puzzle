/**
 * Real places on Sderot Yerushalayim (Jerusalem Boulevard), Yafo. Pure data, no DOM.
 * Every name here was confirmed from a published source (listed in the PR that added it);
 * signs are drawn in plain lettering, no logos.
 */

/** Red Line light-rail stations on the boulevard, north to south (Hebrew Wikipedia station articles). */
export const STATIONS: { en: string; he: string }[] = [
  { en: 'Shalma', he: 'שלמה' },
  { en: 'Bloomfield Stadium', he: 'אצטדיון בלומפילד' },
  { en: 'Ehrlich', he: 'ארליך' },
  { en: 'Isakov', he: 'איסקוב' },
  { en: 'HaBesht', he: 'הבעש"ט' },
  { en: 'Machrozet', he: 'מחרוזת' },
];

/** Distance of the first station's platform start, the spacing between stations, and platform length. */
export const STATION_FIRST = 260;
export const STATION_SPACING = 430;
export const PLATFORM_LEN = 36;

export function stationStart(k: number): number {
  return STATION_FIRST + k * STATION_SPACING;
}
/** Station k's name (they repeat in order: the walk loops along the boulevard). */
export function stationName(k: number) {
  return STATIONS[((k % STATIONS.length) + STATIONS.length) % STATIONS.length];
}
/** Index of the station whose platform covers distance d, or -1. */
export function stationAt(d: number): number {
  const k = Math.floor((d - STATION_FIRST) / STATION_SPACING);
  if (k < 0) return -1;
  return d - stationStart(k) <= PLATFORM_LEN ? k : -1;
}

/**
 * Businesses with storefronts on the boulevard (Time Out Tel Aviv, "Sderot Yerushalayim food guide",
 * Dec 2024; Maariv, Mar 2024). Even street numbers are on one side, odd on the other.
 */
export interface Shop { he: string; en: string; no: number }
export const SHOPS_EVEN: Shop[] = [
  { he: 'שווארמה איציק הגדול', en: 'Shawarma Itzik HaGadol', no: 2 },
  { he: 'גואטה', en: 'Guata', no: 8 },
  { he: 'הבשרים של זלמן', en: "Zalman's Meats", no: 20 },
  { he: 'דלי אלהמברה', en: 'Deli Alhambra', no: 30 },
  { he: 'מאיר פיצוחים', en: 'Meir Nuts', no: 62 },
  { he: 'הרשלה', en: 'Hershele', no: 62 },
  { he: 'מחסן גבינות', en: 'Machsan Gvinot', no: 64 },
  { he: 'מעדני אבנר', en: 'Avner Deli', no: 70 },
  { he: 'פלאפל איציק', en: 'Falafel Itzik', no: 90 },
  { he: "מלבי דג'אני", en: 'Malabi Dagani', no: 94 },
];
export const SHOPS_ODD: Shop[] = [
  { he: "בורקס ז'ק", en: 'Burekas Zhak', no: 35 },
  { he: 'גודיק קפה', en: 'Godik Café', no: 41 },
  { he: 'שם טוב פירות וירקות', en: 'Shem Tov Fruit & Veg', no: 57 },
  { he: 'ינסון', en: 'Yanson', no: 57 },
  { he: 'פונדק הרצל', en: 'Pundak Herzl', no: 67 },
  { he: 'זעתר מרקט', en: 'Zaatar Market', no: 75 },
  { he: 'קפה חוני', en: 'Cafe Chouni', no: 77 },
  { he: 'דאבל אספרסו', en: 'Double Espresso', no: 77 },
  { he: 'קווין קפה', en: 'Queen Caffé', no: 79 },
  { he: 'אטליז אבו חילווה', en: 'Abu Hilwa Butcher', no: 95 },
  { he: 'שניצל ופלאפל חמידו', en: 'Hamido', no: 127 },
];
