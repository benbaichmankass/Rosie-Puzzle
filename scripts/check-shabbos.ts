/**
 * Getting Ready for Shabbos: headless checks (no network).
 *  - Hebcal parsing against a saved sample + malformed inputs; the offline estimate is close to Hebcal.
 *  - Challah braid rules for 3-6 strands.
 *  - Plata stacking physics: every level can be fully loaded (random search), and obvious topples topple.
 *  - Mom's calls end after the needed wrap-up replies.
 */
import { readFileSync } from 'node:fs';
import { parseHebcal, estimateCandleLighting, isCurrent, hhmm, dateLabel } from '../src/games/shabbos/logic/hebcal';
import { newBraid, tryMove, legalMoves, isComplete, braidRows, span, resolveDrop } from '../src/games/shabbos/logic/challah';
import { ITEMS, drop, isLoaded, type Placed, checkStability } from '../src/games/shabbos/logic/plata';
import { LINES, newCall, answer, isOver, currentLine, rng } from '../src/games/shabbos/logic/calls';
import { levelParams, LEVEL_SECONDS } from '../src/games/shabbos/logic/levels';
import { attention, CRUNCH_SECONDS } from '../src/games/shabbos/logic/attention';

let failures = 0;
const ok = (cond: unknown, msg: string) => {
  if (!cond) {
    failures++;
    console.error('FAIL', msg);
  }
};

// ---------- Hebcal ----------
const sample = JSON.parse(readFileSync(new URL('../src/games/shabbos/logic/fixtures/hebcal-sample.json', import.meta.url), 'utf8'));
const info = parseHebcal(sample);
ok(info, 'sample parses');
if (info) {
  ok(info.date === '2026-11-20', `date ${info.date}`);
  ok(info.time === '16:18', `time ${info.time}`);
  ok(info.minutes === 16 * 60 + 18, 'minutes');
  ok(info.at === Date.parse('2026-11-20T14:18:00Z'), 'absolute instant');
  ok(info.parasha === 'Parashat Vayetzei', `parasha ${info.parasha}`);
  ok(info.source === 'hebcal', 'source');
  ok(dateLabel(info.date) === 'Fri 20 Nov', dateLabel(info.date));
  ok(isCurrent(info, Date.parse('2026-11-18T10:00:00Z')), 'current before Shabbat');
  ok(!isCurrent(info, Date.parse('2026-11-22T10:00:00Z')), 'stale after Shabbat');
}
ok(parseHebcal(null) === null, 'null');
ok(parseHebcal({}) === null, 'no items');
ok(parseHebcal({ items: [{ category: 'havdalah', date: '2026-11-21T17:17:00+02:00' }] }) === null, 'no candles item');
ok(parseHebcal({ items: [{ category: 'candles', date: 'soon' }] }) === null, 'bad date');
ok(parseHebcal({ items: [{ category: 'candles', date: '2026-11-20T25:18:00+02:00' }] }) === null, 'bad hour');
const summer = parseHebcal({ items: [{ category: 'candles', date: '2026-07-03T19:28:00+03:00' }] });
ok(summer?.time === '19:28' && summer.at === Date.parse('2026-07-03T16:28:00Z'), 'summer time offset');

// Offline estimate vs Hebcal (a few known Tel Aviv candle times).
const known: [string, string, string][] = [
  ['2026-11-18T08:00:00Z', '2026-11-20', '16:18'],
  ['2026-07-01T08:00:00Z', '2026-07-03', '19:31'],
  ['2026-03-25T08:00:00Z', '2026-03-27', '18:37'],
  ['2027-01-06T08:00:00Z', '2027-01-08', '16:32'],
];
for (const [now, date, time] of known) {
  const e = estimateCandleLighting(Date.parse(now));
  const [h, m] = time.split(':').map(Number);
  ok(e.date === date, `estimate date ${e.date} vs ${date}`);
  ok(Math.abs(e.minutes - (h * 60 + m)) <= 4, `estimate ${e.time} vs ${time} on ${date}`);
  ok(e.source === 'estimate', 'estimate source');
}
// Friday after candles and Saturday roll to next week.
ok(estimateCandleLighting(Date.parse('2026-11-20T15:00:00Z')).date === '2026-11-27', 'friday night -> next week');
ok(estimateCandleLighting(Date.parse('2026-11-21T09:00:00Z')).date === '2026-11-27', 'saturday -> next friday');
ok(estimateCandleLighting(Date.parse('2026-11-20T08:00:00Z')).date === '2026-11-20', 'friday morning -> today');
ok(hhmm(16 * 60 + 18 - 180) === '13:18', 'hhmm');

// ---------- Challah ----------
for (let n = 3; n <= 6; n++) {
  let s = newBraid(n, 8);
  ok(legalMoves(s).length === 2, `n=${n} two opening moves`);
  // Middle strand can't go first.
  if (n >= 3) ok(!tryMove(s, 1, 0).ok, `n=${n} inner strand rejected`);
  // Outer, but wrong distance.
  if (span(n) > 1) ok(!tryMove(s, n - 1, n - 2).ok, `n=${n} wrong distance`);
  // Start from the left this time.
  const first = tryMove(s, 0, span(n));
  ok(first.ok, `n=${n} left opener`);
  s = first.state;
  ok(!tryMove(s, 0, span(n)).ok, `n=${n} same side twice rejected`);
  ok(tryMove(s, 0, span(n)).state.mistakes === 1, `n=${n} mistake counted`);
  let guard = 0;
  while (!isComplete(s) && guard++ < 50) {
    const [m] = legalMoves(s);
    const r = tryMove(s, m.from, m.to);
    ok(r.ok, `n=${n} legal move accepted`);
    s = r.state;
  }
  ok(isComplete(s) && s.crosses.length === 8, `n=${n} completes`);
  ok(!tryMove(s, 0, span(n)).ok, `n=${n} no moves after done`);
  ok(braidRows(s).length === 9, `n=${n} rows`);
  ok([...s.order].sort().join() === Array.from({ length: n }, (_, i) => i).join(), `n=${n} strands preserved`);
}
{
  // Classic 3-strand: right over middle -> [0,2,1]; left over middle -> [2,0,1].
  let s = newBraid(3, 4);
  s = tryMove(s, 2, 1).state;
  ok(s.order.join() === '0,2,1', `3-strand R ${s.order}`);
  s = tryMove(s, 0, 1).state;
  ok(s.order.join() === '2,0,1', `3-strand L ${s.order}`);
  ok(!tryMove(s, 0, 1).ok, '3-strand must alternate');
  // The 3-strand braid repeats every 6 crosses.
  let t = newBraid(3, 6);
  for (let i = 0; i < 6; i++) t = tryMove(t, ...((i % 2 === 0 ? [2, 1] : [0, 1]) as [number, number])).state;
  ok(t.order.join() === '0,1,2', `3-strand period 6 ${t.order}`);
}

// Forgiving drops: an inward drag of an outside strand means "cross toward the middle", even overshooting.
for (let n = 3; n <= 5; n++) {
  const s0 = newBraid(n, 6);
  ok(resolveDrop(s0, n - 1, -0.5) === n - 1 - span(n), `n=${n} small inward drag from right`);
  ok(resolveDrop(s0, n - 1, -(n - 1)) === n - 1 - span(n), `n=${n} overshoot from right`);
  ok(resolveDrop(s0, 0, n + 2) === span(n), `n=${n} overshoot from left`);
  ok(resolveDrop(s0, 0, 0.1) === null, `n=${n} tiny drag ignored`);
  ok(resolveDrop(s0, n - 1, 0.8) === n - 1, `n=${n} outward drag is a no-op`);
  const mid = resolveDrop(s0, 1, 0.9);
  ok(mid !== null && !tryMove(s0, 1, mid).ok, `n=${n} inner strand still rejected`);
  // A whole braid done with sloppy overshooting drags.
  let s = s0;
  for (let i = 0; i < 6; i++) {
    const right = i % 2 === 0;
    const to = resolveDrop(s, right ? n - 1 : 0, right ? -2.7 : 2.7)!;
    const r = tryMove(s, right ? n - 1 : 0, to);
    ok(r.ok, `n=${n} sloppy drag ${i} accepted`);
    s = r.state;
  }
  ok(isComplete(s), `n=${n} sloppy braid completes`);
}

// ---------- Plata ----------
// A tray balanced across nothing but a challah dome slides off.
{
  let placed: Placed[] = [];
  placed = drop(placed, 'challah1', 0, 300, 0).placed;
  const r = drop(placed, 'tray1', 0, 300, 0);
  ok(r.fell.includes('tray1') && r.reason === 'dome', 'nothing stays on a challah');
  // Way off the edge of the plate topples.
  const off = drop([], 'pot', 160, 300, 0);
  ok(off.fell.includes('pot'), 'pot off the edge falls');
  // A tray hanging mostly off the pot tips; centred stays.
  let p2 = drop([], 'pot', -100, 300, 0).placed;
  ok(drop(p2, 'tray1', -100 + 70, 300, 0).fell.includes('tray1'), 'overhanging tray tips');
  ok(drop(p2, 'tray1', -100 + 10, 300, 0).fell.length === 0, 'centred tray holds');
  // Stack rests at the right height.
  p2 = drop(p2, 'tray1', -100, 300, 0).placed;
  ok(p2.find((p) => p.id === 'tray1')!.y === ITEMS.find((i) => i.id === 'pot')!.h, 'tray rests on pot top');
  ok(checkStability(p2, 300, 0).falling.length === 0, 'stable stack is stable');
}
// Every level must be loadable: random search for a full stable arrangement.
function solvable(plateW: number, margin: number, seed: number): boolean {
  const r = rng(seed);
  const ids = ITEMS.map((i) => i.id);
  for (let attempt = 0; attempt < 6000; attempt++) {
    // Flat-topped items first in a random order, domed items last.
    const order = ids.slice().sort(() => r() - 0.5).sort((a, b) => Number(a.startsWith('challah') || a === 'cake') - Number(b.startsWith('challah') || b === 'cake'));
    let placed: Placed[] = [];
    let good = true;
    for (const id of order) {
      let done = false;
      for (let k = 0; k < 12 && !done; k++) {
        const x = Math.round((r() - 0.5) * plateW);
        const d = drop(placed, id, x, plateW, margin);
        if (d.fell.length === 0) {
          placed = d.placed;
          done = true;
        }
      }
      if (!done) {
        good = false;
        break;
      }
    }
    if (good && isLoaded(placed)) return true;
  }
  return false;
}
for (let level = 1; level <= 9; level++) {
  const p = levelParams(level);
  ok(solvable(p.plateW, p.margin, 1000 + level), `level ${level} plata loadable (w=${p.plateW}, margin=${p.margin})`);
  ok(p.ringAt.length === p.calls && p.ringAt.every((t) => t > 0 && t < 45), `level ${level} ring times ${p.ringAt}`);
  ok(p.strands >= 3 && p.crosses >= 4, `level ${level} braid params`);
}
// Total width exceeds every plate, so stacking is always required.
const totalW = ITEMS.reduce((a, i) => a + i.w, 0);
ok(totalW > levelParams(1).plateW, 'stacking required');

// ---------- Calls ----------
{
  const r = rng(7);
  ok(LINES.every((l) => l.replies.filter((x) => x.wrap).length === 1 && l.replies.length === 3), 'one wrap-up reply per line');
  let c = newCall(3, r);
  let steps = 0;
  while (!isOver(c) && steps++ < 20) {
    const line = currentLine(c);
    const slot = c.replyOrder.findIndex((i) => line.replies[i].wrap);
    c = answer(c, slot, r).state;
  }
  ok(isOver(c) && steps === 3, `best replies end the call in 3 (${steps})`);
  let d = newCall(2, r);
  const line = currentLine(d);
  const chatty = d.replyOrder.findIndex((i) => !line.replies[i].wrap);
  const res = answer(d, chatty, r);
  ok(!res.wrap && res.state.wraps === 0 && res.state.chats === 1 && !isOver(res.state), 'chatty reply prolongs');
  d = newCall(2, r, [0, 1, 2]);
  ok(![0, 1, 2].includes(d.queue[0]), 'avoids used lines');
}

// ---------- Attention (flashing stations on the shared counter) ----------
{
  const none = { challah: false, urn: false, plata: false, mom: false };
  const all = { challah: true, urn: true, plata: true, mom: true };
  ok(attention({ t: 5, ringing: false, urnOn: false, done: none }).length === 0, 'calm at the start');
  ok(attention({ t: 5, ringing: true, urnOn: false, done: none }).includes('mom'), 'ringing phone flashes');
  ok(attention({ t: 40, ringing: false, urnOn: false, done: none }).includes('urn'), 'urn nags when the boil gets tight');
  ok(!attention({ t: 40, ringing: false, urnOn: true, done: none }).includes('urn'), 'boiling urn does not nag');
  ok(attention({ t: 20, ringing: false, urnOn: false, done: none, toppledAt: 19.5 }).includes('plata'), 'topple flashes the plata');
  ok(!attention({ t: 25, ringing: false, urnOn: false, done: none, toppledAt: 19.5 }).includes('plata'), 'topple flash fades');
  const crunch = attention({ t: LEVEL_SECONDS - CRUNCH_SECONDS + 1, ringing: false, urnOn: true, done: { ...none, challah: true } });
  ok(crunch.includes('plata') && crunch.includes('urn') && !crunch.includes('challah'), `crunch flashes unfinished ${crunch}`);
  ok(attention({ t: 58, ringing: false, urnOn: true, done: all }).length === 0, 'nothing flashes when all done');
}
// Levels get tighter overall.
{
  const a = levelParams(1);
  const z = levelParams(7);
  ok(z.strands > a.strands && z.crosses > a.crosses && z.calls > a.calls && z.plateW < a.plateW && z.margin > a.margin, 'levels tighten');
}

if (failures) {
  console.error(`check-shabbos: ${failures} failure(s)`);
  process.exit(1);
}
console.log('check-shabbos: all good');
