// Builds VERIFIED and MISMATCH API payloads by running the real evaluator on the
// synthetic fixtures. Used only to mock /api/market/cot/legacy in browser checks.
// Run from artifacts/api-server:  node --import tsx ../../docs/market-desk/verify/mkpayloads.mts <outDir>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const api = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../artifacts/api-server');
const { parseMarketBullsLegacyCot } = await import(path.join(api, 'src/modules/market/marketbulls-cot.ts'));
const { parseCftcLegacy } = await import(path.join(api, 'src/modules/market/cftc-legacy.ts'));
const { evaluateLegacyCot } = await import(path.join(api, 'src/modules/market/cot-legacy.service.ts'));
const fx = path.join(api, 'test/fixtures/');
const out = process.argv[2]; mkdirSync(out, { recursive: true });
const mb = parseMarketBullsLegacyCot(readFileSync(fx + 'marketbulls-legacy-synthetic.html', 'utf8'));
const cf = parseCftcLegacy(JSON.parse(readFileSync(fx + 'cftc-legacy-synthetic.json', 'utf8')));
const T = '2026-11-06T15:00:00.000Z', now = new Date(T);
const bad = JSON.parse(JSON.stringify(cf)); bad[0].groups.nonCommercial.long = 41010; bad[0].groups.nonCommercial.net = 11510;
writeFileSync(path.join(out, 'verified.json'), JSON.stringify({ success: true, data: evaluateLegacyCot({ ok: true, weeks: mb, fetchedAt: T }, { ok: true, weeks: cf, fetchedAt: T }, now) }));
writeFileSync(path.join(out, 'mismatch.json'), JSON.stringify({ success: true, data: evaluateLegacyCot({ ok: true, weeks: mb, fetchedAt: T }, { ok: true, weeks: bad, fetchedAt: T }, now) }));
