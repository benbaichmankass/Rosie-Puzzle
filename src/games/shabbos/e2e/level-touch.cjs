// Getting Ready for Shabbos: play a whole level on the shared counter with REAL touch events.
// Run after `npm run build`:  node src/games/shabbos/e2e/level-touch.cjs [screenshot-dir]
// Exits non-zero unless level 1 is cleared. (Not part of CI: it needs Chromium + Playwright.)
const path = require('node:path');
const { chromium, devices } = require('playwright');
const OUT = process.argv[2] || require('node:os').tmpdir();
const DIST = 'file://' + path.resolve(__dirname, '../../../../dist/index.html');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['Pixel 5'], viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(DIST + '#/play/shabbos');
  await p.waitForTimeout(1200);
  const cdp = await ctx.newCDPSession(p);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  const swipe = async (a, c, steps = 10) => {
    await touch('touchStart', a[0], a[1]);
    for (let i = 1; i <= steps; i++) { await touch('touchMove', a[0] + (c[0] - a[0]) * i / steps, a[1] + (c[1] - a[1]) * i / steps); await p.waitForTimeout(16); }
    await touch('touchEnd'); await p.waitForTimeout(200);
  };
  const tap = async (x, y) => { await touch('touchStart', x, y); await p.waitForTimeout(40); await touch('touchEnd'); await p.waitForTimeout(250); };
  const center = async (loc) => { const r = await loc.boundingBox(); return [r.x + r.width / 2, r.y + r.height / 2]; };
  const svgPt = (idx, x, y) => p.evaluate(([idx, x, y]) => {
    const svg = document.querySelectorAll('.sh-station svg')[idx];
    const pt = svg.createSVGPoint(); pt.x = x; pt.y = y;
    const r = pt.matrixTransform(svg.getScreenCTM()); return [r.x, r.y];
  }, [idx, x, y]);
  await tap(...(await center(p.locator('text=PLAY'))));
  await p.waitForTimeout(400);
  await p.screenshot({ path: OUT + '/b0.png' });
  // URN first (station svg index 1): plug + switch
  await swipe(await svgPt(1, 26, 296), await svgPt(1, 34, 56));
  await tap(...(await svgPt(1, 100, 300)));
  // CHALLAH: 4 sloppy crosses
  const handles = () => p.$$eval('[data-strand-handle]', (els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }));
  for (let i = 0; i < 4; i++) {
    const h = await handles(); const n = h.length;
    if (i % 2 === 0) await swipe(h[n - 1], [h[0][0] + 5, h[0][1]]); else await swipe(h[0], [h[n - 1][0] - 5, h[0][1]]);
  }
  await p.screenshot({ path: OUT + '/b1.png' });
  // PLATA (index 2): plug, then items
  await swipe(await svgPt(2, 342, 194), await svgPt(2, 334, 36));
  // shelf order: pot, tray1, tray2, challah1, challah2, cake. Trays stacked, challahs on the trays, cake on the pot.
  const plan = [-100, 40, 40, 0, 100, -100];
  for (const ux of plan) {
    const shelf = await p.$$eval('.sh-station g[style*="grab"]', (els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }));
    if (!shelf.length) break;
    await swipe(shelf[0], await svgPt(2, 180 + ux * 0.85, 90));
    await p.waitForTimeout(900);
  }
  await p.screenshot({ path: OUT + '/b2.png' });
  // Answer every call Mom makes (random replies; the right ones end it sooner).
  for (let k = 0; k < 60; k++) {
    if (await p.$('text=Shabbat Shalom!')) break;
    if (await p.$('.sh-phonestrip.ringing')) { await tap(...(await center(p.locator('.sh-phonestrip')))); await p.screenshot({ path: OUT + '/b4.png' }); }
    const btns = await p.$$('.sh-reply:not([disabled])');
    if (btns.length) await tap(...(await center(p.locator('.sh-reply:not([disabled])').nth(Math.floor(Math.random() * btns.length)))));
    await p.waitForTimeout(700);
  }
  await p.waitForTimeout(800);
  await p.screenshot({ path: OUT + '/b5.png' });
  const cleared = !!(await p.$('text=Shabbat Shalom!'));
  console.log(await p.evaluate(() => [...document.querySelectorAll('.sh-station header')].map((h) => h.textContent).join(' | ')));
  console.log(errs.join('\n') || 'no errors');
  await b.close();
  if (!cleared || errs.length) {
    console.error('level-touch: FAILED');
    process.exit(1);
  }
  console.log('level-touch: level 1 cleared with touch');
})();
