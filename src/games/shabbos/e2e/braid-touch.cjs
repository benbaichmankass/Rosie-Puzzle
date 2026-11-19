// Getting Ready for Shabbos: braid with REAL touch events on an emulated phone (CDP Input.dispatchTouchEvent).
// Run after `npm run build`:  node src/games/shabbos/e2e/braid-touch.cjs [screenshot-dir]
// Exits non-zero if the braid can't be completed. (Not part of CI: it needs Chromium + Playwright.)
const path = require('node:path');
const { chromium, devices } = require('playwright');
const OUT = process.argv[2] || require('node:os').tmpdir();
const DIST = 'file://' + path.resolve(__dirname, '../../../../dist/index.html');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['Pixel 5'] });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(DIST + '#/play/shabbos');
  await p.waitForTimeout(1200);
  const cdp = await ctx.newCDPSession(p);
  const touch = async (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  const swipe = async (a, c, steps = 12) => {
    await touch('touchStart', a[0], a[1]);
    for (let i = 1; i <= steps; i++) { await touch('touchMove', a[0] + (c[0] - a[0]) * i / steps, a[1] + (c[1] - a[1]) * i / steps); await p.waitForTimeout(16); }
    await touch('touchEnd');
    await p.waitForTimeout(250);
  };
  const tap = async (x, y) => { await touch('touchStart', x, y); await p.waitForTimeout(50); await touch('touchEnd'); await p.waitForTimeout(300); };
  const box = async (sel) => { const r = await p.locator(sel).first().boundingBox(); return [r.x + r.width / 2, r.y + r.height / 2]; };
  await tap(...(await box('text=PLAY')));
  await p.waitForTimeout(500);
  // open the challah station (find the "Challah" label in the scene)
  await tap(...(await box('svg text:has-text("Challah")')));
  await p.waitForTimeout(500);
  await p.screenshot({ path: OUT + '/t-open.png' });
  const handles = () => p.$$eval('[data-strand-handle]', (els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }));
  let h = await handles();
  console.log('handles', h.length);
  if (!h.length) {
    h = await p.$$eval('.sh-sheet svg circle[r="30"]', (els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }));
    console.log('fallback handles', h.length);
  }
  const progress = () => p.evaluate(() => document.querySelector('[data-braid-progress]')?.textContent || [...document.querySelectorAll('.sh-sheet svg text')].map((t) => t.textContent).join('|'));
  console.log('before', await progress());
  // 1) wrong move: drag the middle strand -> should be rejected with feedback
  h = await handles();
  await swipe([h[1][0], h[1][1] + 40], [h[0][0], h[1][1] + 40]);
  console.log('after wrong', await progress(), '|', await p.textContent('.sh-msg'));
  await p.screenshot({ path: OUT + '/t-wrong.png' });
  // wait for the idle hint
  await p.waitForTimeout(3300);
  await p.screenshot({ path: OUT + '/t-hint.png' });
  // 2) sloppy real-person drags: grab the strand body (lower than the knob) and overshoot past the middle
  for (let i = 0; i < 4; i++) {
    h = await handles();
    const n = h.length;
    const grabY = h[0][1] + 30;
    if (i % 2 === 0) await swipe([h[n - 1][0], grabY], [h[0][0] + 10, grabY - 20]);
    else await swipe([h[0][0], grabY], [h[n - 1][0] - 10, grabY + 10]);
    console.log('after move', i + 1, await progress(), '|', await p.textContent('.sh-msg'));
    if (i === 1) await p.screenshot({ path: OUT + '/t-mid.png' });
  }
  await p.screenshot({ path: OUT + '/t-end.png' });
  const final = await progress();
  console.log(errs.join('\n') || 'no errors');
  await b.close();
  if (final !== 'Braided!' || errs.length) {
    console.error('braid-touch: FAILED (' + final + ')');
    process.exit(1);
  }
  console.log('braid-touch: braided with touch');
})();
