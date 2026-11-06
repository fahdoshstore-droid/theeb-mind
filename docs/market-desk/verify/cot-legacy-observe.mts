// Fetches MarketBulls and CFTC once, runs the comparison, and writes a JSON report
// of every observed difference. Run where both hosts are reachable:
//   cd artifacts/api-server && node --import tsx ../../docs/market-desk/verify/cot-legacy-observe.mts report.json
// The report is evidence for choosing a permanent validation rule. It changes nothing.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const api = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../artifacts/api-server');
const svc = await import(path.join(api, 'src/modules/market/cot-legacy.service.ts'));
const [p, v] = await Promise.all([svc.defaultDeps.fetchPrimary(), svc.defaultDeps.fetchValidation()]);
const result = svc.evaluateLegacyCot(p, v, new Date());
const weeks = p.ok && v.ok ? p.weeks.map((w: any) => {
  const m = v.weeks.find((x: any) => x.reportDate === w.reportDate);
  return { reportDate: w.reportDate, inCftc: !!m, ...(m ? svc.compareWeeks(w, m) : {}) };
}) : [];
const report = {
  generatedAt: new Date().toISOString(), status: result.status, reason: result.reason,
  primary: { ok: p.ok, error: p.ok ? null : p.error, weeks: p.ok ? p.weeks.length : 0, latest: p.ok ? p.weeks[0]?.reportDate : null },
  validation: { ok: v.ok, error: v.ok ? null : v.error, weeks: v.ok ? v.weeks.length : 0, latest: v.ok ? v.weeks[0]?.reportDate : null },
  perWeek: weeks,
};
writeFileSync(process.argv[2] || 'cot-legacy-report.json', JSON.stringify(report, null, 2));
console.log(`${result.status}${result.reason ? ' (' + result.reason + ')' : ''} — weeks compared: ${weeks.filter((w: any) => w.inCftc).length}`);
