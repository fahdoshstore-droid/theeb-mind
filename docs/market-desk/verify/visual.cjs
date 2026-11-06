// Pixel comparison of pages that must not change, main vs branch, with a frozen clock.
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  const out = {};
  const FIXED = new Date('2026-11-05T15:20:00Z'); // Thu 10:20 New York
  for (const p of ['/journal', '/intelligence', '/performance', '/verify']) {
    const shots = [];
    for (const [name, base] of [['main', process.env.MAIN_URL || 'http://127.0.0.1:42001'], ['branch', process.env.BRANCH_URL || 'http://127.0.0.1:42002']]) {
      const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
      const page = await ctx.newPage();
      await page.clock.setFixedTime(FIXED);
      await page.route('**/*tradingview.com/**', (r) => r.abort());
      await page.goto(base + p, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1200);
      const buf = await page.screenshot({ fullPage: true, animations: 'disabled' });
      fs.writeFileSync(`${process.argv[2]}/${name}${p.replace('/', '-')}.png`, buf);
      shots.push(buf);
      await ctx.close();
    }
    out[p] = shots[0].equals(shots[1]) ? 'IDENTICAL' : `DIFFERENT (${shots[0].length} vs ${shots[1].length} bytes)`;
  }
  console.log(JSON.stringify(out, null, 2));
  await b.close();
})();
