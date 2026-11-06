// Browser checks for the Market Desk and the /analyze TRIL panel (branch stack).
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = process.env.BRANCH_URL || 'http://127.0.0.1:42002', S = process.argv[2]; fs.mkdirSync(S + '/shots', { recursive: true });
const results = []; const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); };
const THU = new Date('2026-11-05T15:20:00Z'), WED = new Date('2026-11-04T15:20:00Z');
async function open(b, path, { at = THU, cot = null, w = 1600 } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: 1100 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(at);
  await page.route('**/*tradingview.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body style="background:#131722;color:#787b86;font:14px sans-serif;display:grid;place-items:center;height:100vh;margin:0">TradingView widget (blocked in test environment)</body></html>' }));
  if (cot) await page.route('**/api/market/cot/legacy', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: fs.readFileSync(`${S}/${cot}.json`, 'utf8') }));
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  return { ctx, page };
}
const FORBIDDEN = /\b(SAFE TO TRADE|SAFE|CAUTION|DO NOT TRADE|CONFIDENCE|SCORE|WEIGHT)\b/i;
(async () => {
  const b = await chromium.launch();

  // 1. Desk with the real (offline) server: COT DATA_UNAVAILABLE
  let { ctx, page } = await open(b, '/market');
  const desk = page.getByTestId('market-desk');
  check('desk renders', await desk.isVisible());
  const deskText = await desk.innerText();
  check('IPDA shows only METHODOLOGY PENDING', (await page.getByTestId('ipda').innerText()).includes('IPDA — METHODOLOGY PENDING'));
  check('no SAFE/CAUTION/score/confidence/weight text on the desk', !FORBIDDEN.test(deskText), (deskText.match(FORBIDDEN) || [''])[0]);
  check('COT is DATA_UNAVAILABLE when sources fail', (await page.getByTestId('cot-legacy').getAttribute('data-status')) === 'DATA_UNAVAILABLE');
  check('COT shows no position table when unavailable', (await page.locator('[data-testid=cot-legacy] table').count()) === 0);
  const cotTxt = await page.getByTestId('cot-legacy').innerText();
  check('COT unavailable text has no position numbers', !/\d{1,3},\d{3}/.test(cotTxt), cotTxt.match(/\d{1,3},\d{3}/)?.[0]);
  check('US30Y NOT APPROVED with no value', (await page.getByTestId('bonds').innerText()).includes('NOT APPROVED'));
  check('US02Y / US10Y UNAVAILABLE', (await page.getByTestId('bonds').innerText()).match(/UNAVAILABLE/g)?.length >= 2);
  check('DXY / VIX NO SOURCE', (await page.getByTestId('context').innerText()).match(/NO SOURCE/g)?.length === 2);
  check('no seed values shown (104.62 / 13.4 / 4.23)', !/104\.62|\b13\.4\b|\b4\.23\b/.test(deskText));
  check('seasonality UNAVAILABLE', (await page.getByTestId('seasonality').innerText()).includes('UNAVAILABLE'));
  check('chart labelled DISPLAY ONLY', deskText.includes('DISPLAY ONLY'));
  check('TRIL Time IN_WINDOW on Thu 10:20 NY', (await page.getByTestId('tril-time').getAttribute('data-status')) === 'IN_WINDOW');
  check('device-local notice present', deskText.includes('DEVICE-LOCAL'));
  await page.screenshot({ path: `${S}/shots/desk-unavailable.png`, fullPage: true });

  // 2. Manual marks: add, persist across reload, edit, delete
  await page.getByTestId('tril-raid').getByRole('button', { name: '+ أضف علامة' }).click();
  await page.fill('#tm-lo-raid', '21557.25');
  await page.fill('#tm-note-raid', 'prior high swept');
  await page.getByTestId('tril-raid').getByRole('button', { name: 'احفظ العلامة' }).click();
  check('raid mark saved', (await page.getByTestId('tril-raid').innerText()).includes('21,557.25'));
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('theeb-tril-marks-v1') || '[]'));
  check('mark stored with all fields', stored.length === 1 && ['instrument','date','time','timeframe','type','priceLow','priceHigh','note'].every((k) => k in stored[0]), JSON.stringify(stored[0]));
  check('mark date/time are New York', stored[0]?.date === '2026-11-05' && stored[0]?.time === '10:20', `${stored[0]?.date} ${stored[0]?.time}`);
  await page.reload({ waitUntil: 'networkidle' });
  check('mark persists after reload', (await page.getByTestId('tril-raid').innerText()).includes('21,557.25'));
  await page.getByTestId('tril-raid').getByRole('button', { name: 'تعديل' }).click();
  await page.fill('#tm-hi-raid', '21560');
  await page.getByTestId('tril-raid').getByRole('button', { name: 'احفظ التعديل' }).click();
  check('mark edited into a zone', (await page.getByTestId('tril-raid').innerText()).includes('21,557.25–21,560'));
  await page.getByTestId('tril-inversion').getByRole('button', { name: '+ أضف علامة' }).click();
  await page.fill('#tm-lo-inversion', '21600');
  await page.fill('#tm-hi-inversion', '21500');
  await page.getByTestId('tril-inversion').getByRole('button', { name: 'احفظ العلامة' }).click();
  check('reversed zone rejected with a message', (await page.getByTestId('tril-inversion').innerText()).includes('الحد الأعلى أقل من الأدنى'));
  await page.getByTestId('tril-raid').getByRole('button', { name: 'حذف' }).click();
  check('mark deleted', (await page.getByTestId('tril-raid').innerText()).includes('NOT MARKED'));
  check('storage empty after delete', (await page.evaluate(() => JSON.parse(localStorage.getItem('theeb-tril-marks-v1') || '[]'))).length === 0);
  await ctx.close();

  // 3. Wednesday is not an allowed day
  ({ ctx, page } = await open(b, '/market', { at: WED }));
  check('TRIL Time DAY_NOT_ALLOWED on Wednesday', (await page.getByTestId('tril-time').getAttribute('data-status')) === 'DAY_NOT_ALLOWED');
  await ctx.close();

  // 4. COT VERIFIED (mocked API response built by the real evaluator from synthetic fixtures)
  ({ ctx, page } = await open(b, '/market', { cot: 'verified' }));
  const v = await page.getByTestId('cot-legacy').innerText();
  check('VERIFIED state shows values', (await page.getByTestId('cot-legacy').getAttribute('data-status')) === 'VERIFIED' && v.includes('11,500') && v.includes('VERIFIED'));
  await page.getByTestId('cot-legacy').screenshot({ path: `${S}/shots/cot-verified.png` });
  await ctx.close();

  // 5. COT MISMATCH
  ({ ctx, page } = await open(b, '/market', { cot: 'mismatch' }));
  const m = await page.getByTestId('cot-legacy').innerText();
  check('MISMATCH state is unverified and shows both sources', m.includes('MISMATCH') && m.includes('غير متحقق') && m.includes('11,500') && m.includes('11,510') && !m.includes('VERIFIED'));
  await page.getByTestId('cot-legacy').screenshot({ path: `${S}/shots/cot-mismatch.png` });
  await ctx.close();

  // 6. /analyze
  ({ ctx, page } = await open(b, '/analyze', { w: 1440 }));
  const a = await page.locator('body').innerText();
  check('/analyze shows the four-factor TRIL panel', await page.getByTestId('tril-panel').isVisible());
  check('/analyze has no SAFE TO TRADE / CAUTION / DO NOT TRADE', !/SAFE TO TRADE|CAUTION|DO NOT TRADE|TRIL VALIDATION/.test(a));
  check('/analyze has no six-factor rows', !/ORDER BLOCK|IMM\. REBALANCE|IMBALANCE/.test(await page.getByTestId('tril-panel').innerText()));
  check('/analyze legacy score labelled NOT TRIL', a.includes('LEGACY QUALITY SCORE · NOT TRIL'));
  check('/analyze hard-coded NQ price removed', !a.includes('18,642.25'));
  await page.screenshot({ path: `${S}/shots/analyze.png` });
  await ctx.close();

  // 7. Narrow screen: no horizontal page scroll on the desk
  ({ ctx, page } = await open(b, '/market', { w: 1024 }));
  check('desk has no horizontal overflow at 1024px', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await ctx.close();

  await b.close();
  const failed = results.filter((r) => !r.ok);
  for (const r of results) console.log((r.ok ? 'PASS ' : 'FAIL ') + r.name + (r.ok || !r.info ? '' : '  → ' + r.info));
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})();
