/**
 * Shabbat candle-lighting time for Tel Aviv.
 * Primary source: Hebcal's Shabbat API (no key, CORS enabled). Fallback: an astronomical estimate
 * (sunset minus 18 minutes, the Tel Aviv custom Hebcal uses). Pure TS, no DOM, so it can be tested.
 */

export const HEBCAL_URL = 'https://www.hebcal.com/shabbat?cfg=json&geonameid=293397&M=on';
export const TEL_AVIV = { lat: 32.08088, lng: 34.78057, tz: 'Asia/Jerusalem' } as const;
/** Tel Aviv lights candles 18 minutes before sunset. */
export const CANDLE_OFFSET_MIN = 18;

export type CandleSource = 'hebcal' | 'cache' | 'estimate';

export interface CandleInfo {
  /** Local (Tel Aviv) date, YYYY-MM-DD. */
  date: string;
  /** Local (Tel Aviv) wall time, HH:MM. */
  time: string;
  /** Minutes after local midnight. */
  minutes: number;
  /** Absolute instant (ms since epoch). */
  at: number;
  /** Weekly Torah portion, when known. */
  parasha?: string;
  source: CandleSource;
}

const pad = (n: number) => String(n).padStart(2, '0');

interface HebcalItem {
  category?: unknown;
  date?: unknown;
  title?: unknown;
  memo?: unknown;
}

/** Reads the Hebcal JSON and returns the candle-lighting entry, or null if it is missing or malformed. */
export function parseHebcal(json: unknown): CandleInfo | null {
  if (!json || typeof json !== 'object') return null;
  const items = (json as { items?: unknown }).items;
  if (!Array.isArray(items)) return null;
  const candle = (items as HebcalItem[]).find((it) => it && it.category === 'candles' && typeof it.date === 'string');
  if (!candle) return null;
  // e.g. "2026-11-20T16:18:00+02:00": keep the wall time exactly as Hebcal states it.
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::\d{2})?([+-]\d{2}:\d{2}|Z)$/.exec(candle.date as string);
  if (!m) return null;
  const at = Date.parse(candle.date as string);
  if (!Number.isFinite(at)) return null;
  const hh = Number(m[2]);
  const mm = Number(m[3]);
  if (hh > 23 || mm > 59) return null;
  const parashaItem = (items as HebcalItem[]).find((it) => it && it.category === 'parashat' && typeof it.title === 'string');
  const parasha =
    (parashaItem?.title as string | undefined) ?? (typeof candle.memo === 'string' ? (candle.memo as string) : undefined);
  return { date: m[1], time: `${pad(hh)}:${pad(mm)}`, minutes: hh * 60 + mm, at, parasha, source: 'hebcal' };
}

/** Y/M/D/weekday/hour/minute of an instant as seen in Tel Aviv. */
export function telAvivParts(at: number) {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: TEL_AVIV.tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  });
  const p: Record<string, string> = {};
  for (const part of f.formatToParts(new Date(at))) p[part.type] = part.value;
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
  return { y: +p.year, m: +p.month, d: +p.day, weekday: wd, hour: +p.hour % 24, minute: +p.minute };
}

const rad = Math.PI / 180;

/**
 * Sunset (UTC ms) for a civil date at a location, using the classic Almanac for Computers
 * algorithm (accurate to a minute or two, plenty for a fallback).
 */
export function sunsetUtc(y: number, mo: number, d: number, lat: number, lng: number): number {
  const startOfYear = Date.UTC(y, 0, 1);
  const n = Math.round((Date.UTC(y, mo - 1, d) - startOfYear) / 86400000) + 1;
  const lngHour = lng / 15;
  const t = n + (18 - lngHour) / 24;
  const M = 0.9856 * t - 3.289;
  let L = M + 1.916 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 282.634;
  L = ((L % 360) + 360) % 360;
  let RA = Math.atan(0.91764 * Math.tan(L * rad)) / rad;
  RA = ((RA % 360) + 360) % 360;
  RA += Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90;
  RA /= 15;
  const sinDec = 0.39782 * Math.sin(L * rad);
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosH = (Math.cos(90.833 * rad) - sinDec * Math.sin(lat * rad)) / (cosDec * Math.cos(lat * rad));
  const H = Math.acos(Math.max(-1, Math.min(1, cosH))) / rad / 15;
  const T = H + RA - 0.06571 * t - 6.622;
  const UT = (((T - lngHour) % 24) + 24) % 24;
  return Date.UTC(y, mo - 1, d) + UT * 3600000;
}

/** Estimated candle lighting for the coming Friday in Tel Aviv (today if it is Friday before candles). */
export function estimateCandleLighting(now: number): CandleInfo {
  const today = telAvivParts(now);
  const add = (5 - today.weekday + 7) % 7;
  const build = (offset: number): CandleInfo => {
    const base = new Date(Date.UTC(today.y, today.m - 1, today.d + offset));
    const y = base.getUTCFullYear();
    const mo = base.getUTCMonth() + 1;
    const d = base.getUTCDate();
    const at = Math.round((sunsetUtc(y, mo, d, TEL_AVIV.lat, TEL_AVIV.lng) - CANDLE_OFFSET_MIN * 60000) / 60000) * 60000;
    const lp = telAvivParts(at);
    return {
      date: `${y}-${pad(mo)}-${pad(d)}`,
      time: `${pad(lp.hour)}:${pad(lp.minute)}`,
      minutes: lp.hour * 60 + lp.minute,
      at,
      source: 'estimate',
    };
  };
  let info = build(add);
  // Shabbat has started (or it's Saturday): show next week's.
  if (add === 0 && now > info.at) info = build(7);
  return info;
}

/** Is a cached time still for this week's (or a future) Shabbat? Valid until Shabbat ends (~25 h after candles). */
export function isCurrent(info: CandleInfo | null | undefined, now: number): info is CandleInfo {
  return !!info && typeof info.at === 'number' && now < info.at + 25 * 3600000;
}

/** "Fri 20 Nov" style label for a YYYY-MM-DD date. */
export function dateLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dt.getUTCDay()];
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1];
  return `${wd} ${d} ${mon}`;
}

/** Formats minutes-after-midnight as HH:MM. */
export function hhmm(minutes: number): string {
  const m = ((Math.floor(minutes) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}
