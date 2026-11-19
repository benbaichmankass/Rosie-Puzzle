/**
 * Real places on Sderot Yerushalayim (Jerusalem Boulevard), Yafo. Pure data, no DOM.
 * Every name here was confirmed from a published source (Time Out Tel Aviv 2019 and 2024, Maariv 2024,
 * OpenStreetMap shop points); listed in the PRs that added them. Signs are drawn in plain lettering, no logos;
 * where we could not confirm the Hebrew spelling the sign shows the English name only. Chains are left out.
 */

/**
 * Businesses with storefronts on the boulevard (Time Out Tel Aviv, "Sderot Yerushalayim food guide",
 * Dec 2024; Maariv, Mar 2024). Even street numbers are on one side, odd on the other; the game puts each
 * shop at its house number along the route (see route.ts numberToU), so they come up in real order.
 * Station names and positions live in route.ts.
 */
export interface Shop { he?: string; en: string; no: number }
/** Even house numbers: the WEST side (on Rosie's left walking north). */
export const SHOPS_EVEN: Shop[] = [
  { he: 'שווארמה איציק הגדול', en: 'Shawarma Itzik HaGadol', no: 2 },
  { he: 'גואטה', en: 'Guetta', no: 8 },
  { he: 'הבשרים של זלמן', en: "Zalman's Meats", no: 20 },
  { en: 'Miko Bicycles', no: 24 },
  { en: 'Zikgar', no: 26 },
  { he: 'דלי אלהמברה', en: 'Deli Alhambra', no: 30 },
  { en: 'Asher Toys', no: 32 },
  { en: "Rami's Bikes", no: 40 },
  { en: 'Kolbo Crystal', no: 50 },
  { he: 'הרשלה', en: 'Hershele', no: 62 },
  { he: 'מאיר פיצוחים', en: 'Meir Nuts', no: 62 },
  { he: 'מחסן גבינות', en: 'Machsan Gvinot', no: 64 },
  { he: 'מעדני אבנר', en: 'Avner Deli', no: 70 },
  { he: 'פלאפל איציק', en: 'Falafel Itzik', no: 90 },
  { he: "מלבי דג'אני", en: 'Malabi Dajani', no: 94 },
];
/** Odd house numbers: the EAST side (on Rosie's right walking north). */
export const SHOPS_ODD: Shop[] = [
  { en: 'Barbara', no: 3 },
  { en: "Teva'onela", no: 5 },
  { en: 'Alba', no: 11 },
  { en: 'Tanus Jewellery', no: 15 },
  { he: 'חומוס ביירות', en: 'Hummus Beirut', no: 17 },
  { he: "בורקס ז'ק", en: 'Burekas Zhak', no: 35 },
  { he: 'גודיק קפה', en: 'Godik Café', no: 41 },
  { he: 'שם טוב פירות וירקות', en: 'Shem Tov Fruit & Veg', no: 57 },
  { he: 'ינסון', en: 'Yanson', no: 57 },
  { he: 'פונדק הרצל', en: 'Pundak Herzl', no: 67 },
  { en: 'Perach Bar', no: 67 },
  { he: 'זעתר מרקט', en: 'Zaatar Market', no: 75 },
  { en: 'Nabil Khoury Spices', no: 77 },
  { he: 'קפה חוני', en: 'Cafe Chouni', no: 77 },
  { he: 'דאבל אספרסו', en: 'Double Espresso', no: 77 },
  { he: 'קווין קפה', en: 'Queen Caffé', no: 79 },
  { he: 'בא לי שווארמה', en: 'Ba Li Shawarma', no: 83 },
  { he: 'אטליז אבו חילווה', en: 'Abu Hilwa Butcher', no: 95 },
  { he: 'שניצל ופלאפל חמידו', en: 'Hamido', no: 127 },
  { he: 'צמיגי קריסטו', en: 'Christo Tyres', no: 129 },
];
