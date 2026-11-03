// Renders every direction to PNG. Run from repo root:
//   node deliverables/ada2ai-visual-redesign/render.js [d1-broadsheet ...]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ROOT = __dirname;
const all = fs.readdirSync(path.join(ROOT, 'directions')).filter(d => !d.startsWith('.')).sort();
const only = process.argv.slice(2);
const dirs = only.length ? all.filter(d => only.includes(d)) : all;

(async () => {
  const browser = await chromium.launch();
  for (const d of dirs) {
    const out = path.join(ROOT, 'png', d);
    fs.mkdirSync(out, { recursive: true });
    const url = 'file://' + path.join(ROOT, 'directions', d, 'index.html');
    for (const scale of [2, 1]) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: scale });
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(300);
      const home = await page.$('#home');
      const box = await home.boundingBox();
      if (scale === 2) {
        // Hero at 2x (first 900px of the homepage)
        await page.screenshot({ path: path.join(out, '01-hero.png'), clip: { x: box.x, y: box.y, width: 1440, height: 900 } });
      } else {
        const shots = [['#home', '02-homepage.png'], ['#coach', '03-coach-dashboard.png'], ['#player', '04-player-profile.png'], ['#video', '05-video-workspace.png']];
        for (const [sel, name] of shots) {
          const el = await page.$(sel);
          await el.screenshot({ path: path.join(out, name) });
        }
      }
      await page.close();
    }
    console.log('rendered', d);
  }
  await browser.close();
})();
