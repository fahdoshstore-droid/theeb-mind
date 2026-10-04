// Timeframe / edge validation on REAL NQ OHLC history.
//
//   node scripts/validate-timeframes.mjs --csv path/to/nq_1m.csv [--tz America/Chicago] [--out data/timeframe-validation.json]
//   DATABENTO_API_KEY=... node scripts/validate-timeframes.mjs --databento --days 120
//
// Writes the report the dashboard server reads (THEEB_TF_VALIDATION_PATH, default ./data/timeframe-validation.json).
// With no data, or insufficient evidence, the selection is "NO TIMEFRAME SELECTED — INSUFFICIENT EVIDENCE".
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadCSVBars, fetchDatabentoBars } from '../lib/nq-data.mjs';
import { validateTimeframes } from '../lib/edge-stats.mjs';
import { DEFAULT_VALIDATION_PATH } from '../lib/timeframe-config.mjs';

const args = process.argv.slice(2);
const arg = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const out = arg('--out') || process.env.THEEB_TF_VALIDATION_PATH || DEFAULT_VALIDATION_PATH;

let data, sourceInfo;
try {
    if (arg('--csv')) {
        data = await loadCSVBars({ path: arg('--csv'), tz: arg('--tz') || undefined });
    } else if (args.includes('--databento')) {
        const days = Number(arg('--days')) || 90;
        data = await fetchDatabentoBars({ start: Date.now() - days * 86400000, end: Date.now() });
    } else {
        console.error('usage: --csv <file> [--tz <IANA>] | --databento [--days N]   [--out <file>]');
        process.exit(2);
    }
    sourceInfo = { provider: data.provider, symbol: data.symbol, baseTf: data.baseTf, dropped: data.dropped || 0 };
} catch (e) {
    console.error('DATA UNAVAILABLE — ' + e.message);
    console.error('No validation written: NO TIMEFRAME SELECTED — INSUFFICIENT EVIDENCE');
    process.exit(1);
}

const t0 = Date.now();
const report = validateTimeframes(data.bars, data.baseTf);
report.source = sourceInfo;
report.durationMs = Date.now() - t0;
await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, JSON.stringify(report, null, 2));

const pad = (v, n) => String(v ?? '—').padEnd(n);
console.log(`\nSource: ${sourceInfo.provider} · ${sourceInfo.symbol} · base ${sourceInfo.baseTf} · ${report.data ? report.data.bars + ' bars ' + report.data.from + ' → ' + report.data.to : 'no data'} · rolls ${report.rolls}`);
console.log(pad('config', 12) + pad('n', 6) + pad('evidence', 14) + pad('win%', 8) + pad('wilson95', 16) + pad('E[R]', 8) + pad('LB95', 8) + pad('PF', 7) + pad('stab', 6) + 'status');
for (const r of report.results) {
    if (!r.supported) { console.log(pad(r.structure + '/' + r.execution, 12) + r.reason); continue; }
    const s = r.stats;
    console.log(pad(r.structure + '/' + r.execution, 12) + pad(s.n, 6) + pad(s.evidence, 14) + pad(s.winRate === null ? null : (s.winRate * 100).toFixed(1), 8) +
        pad(s.wilson95 ? s.wilson95.map((x) => (x * 100).toFixed(0)).join('–') + '%' : null, 16) + pad(s.expectancy, 8) + pad(s.expectancyLB95, 8) + pad(s.profitFactor, 7) + pad(s.stability, 6) +
        (r.eligible ? 'ELIGIBLE' : 'rejected: ' + r.rejectedBecause.join('; ')));
}
console.log('\nSELECTION: ' + (report.selection.status === 'VALIDATED' ? report.selection.structure + ' → ' + report.selection.execution + ' — ' + report.selection.detail : report.selection.detail));
console.log('Report written to ' + out);
