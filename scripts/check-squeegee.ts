// Squeegee Survival: the water sim must be stable and conserve water, an idle player must lose
// in a sensible time, and an active player must survive clearly longer.
import * as S from '../src/games/squeegee/sim';

let fail = 0;
const bad = (msg: string) => { console.error('FAIL: ' + msg); fail++; };
const t0 = performance.now();

type Policy = (s: S.State, r: () => number) => S.Input;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
}

function run(name: string, policy: Policy, seed = 1, maxT = 900, dtFn?: (r: () => number) => number) {
  const s = S.createState();
  const r = rng(seed);
  let steps = 0;
  while (!s.over && s.t < maxT) {
    const dt = dtFn ? dtFn(r) : 1 / 60;
    S.step(s, policy(s, r), dt);
    s.events.length = 0;
    if (++steps % 30 === 0) {
      for (let i = 0; i < S.N; i++) {
        if (!Number.isFinite(s.h[i]) || s.h[i] < -1e-9) { bad(`${name}: bad depth ${s.h[i]} at cell ${i}, t=${s.t.toFixed(1)}`); return s; }
        if (s.h[i] > S.SHELF_LEVELS[2] + S.SLOPE_DROP + 25) { bad(`${name}: runaway depth ${s.h[i].toFixed(1)} at cell ${i}`); return s; }
      }
      const err = Math.abs(s.inflowTotal - s.drained - S.totalWater(s));
      if (err > 1e-6 * Math.max(1, s.inflowTotal)) { bad(`${name}: water not conserved (error ${err})`); return s; }
      if (!Number.isFinite(s.px) || s.px < S.MIN_X - 1e-9 || s.px > S.MAX_X + 1e-9) { bad(`${name}: player out of bounds ${s.px}`); return s; }
    }
  }
  return s;
}

const idle = run('idle', () => ({ move: 0, swing: false }));
console.log(`idle player: zapped at ${idle.t.toFixed(1)} s (shelves flooded at ${idle.floodTime.map((x) => x.toFixed(0)).join(', ')} s)`);
if (!idle.over) bad('idle player never lost');
if (idle.t < 30 || idle.t > 120) bad(`idle player should lose in 30-120 s, took ${idle.t.toFixed(1)} s`);
if (!(idle.floodTime[0] < idle.floodTime[1] && idle.floodTime[1] < idle.floodTime[2])) bad('shelves should flood bottom, middle, top in order');

const bot = run('bot', (s) => S.botInput(s));
console.log(`active bot: survived ${bot.t.toFixed(1)} s, ${bot.swings} swings, drained ${bot.drained.toFixed(0)} of ${bot.inflowTotal.toFixed(0)}, rolls stuck ${bot.rolls.filter((r) => r.stuck).length}`);
if (!bot.over) bad('even the bot should lose eventually (inflow ramps up)');
if (bot.t < idle.t * 1.8) bad(`active play should last much longer than idle (${bot.t.toFixed(1)} vs ${idle.t.toFixed(1)})`);
if (bot.rolls.length && !bot.rolls.some((r) => r.stuck)) bad('paper rolls should end up clogging the drain');

// random button-mashers with jittery frame times: only stability matters here
for (let seed = 1; seed <= 12; seed++) {
  run(`random#${seed}`, (_s, r) => ({ move: r() < 0.33 ? -1 : r() < 0.5 ? 1 : 0, swing: r() < 0.5 }), seed, 400,
    (r) => (r() < 0.05 ? 0.1 : 1 / 30 + r() * (1 / 60)));
}

const ms = performance.now() - t0;
console.log(`checked in ${ms.toFixed(0)} ms`);
if (fail) process.exit(1);
console.log('squeegee: OK');
