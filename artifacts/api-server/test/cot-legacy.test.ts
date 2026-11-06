// Legacy COT: parsers, validation states and the no-fallback guarantee.
// Fixtures are synthetic (see test/fixtures/README.md).
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { parseMarketBullsLegacyCot, groupOfHeader, fieldOfHeader } from '../src/modules/market/marketbulls-cot.js';
import { parseCftcLegacy } from '../src/modules/market/cftc-legacy.js';
import {
  evaluateLegacyCot, compareWeeks, getLegacyCot, clearLegacyCotCache, getLegacyCotObservations,
  type SourceOutcome, type LegacyCotDeps,
} from '../src/modules/market/cot-legacy.service.js';
import type { LegacyWeek } from '../src/modules/market/cot-legacy.types.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fx = (f: string) => readFileSync(path.join(here, 'fixtures', f), 'utf8');

const MB_HTML = fx('marketbulls-legacy-synthetic.html');
const MB_LIVE = fx('marketbulls-live-blob-synthetic.html');
const CFTC_ROWS = JSON.parse(fx('cftc-legacy-synthetic.json'));
const NOW = new Date('2026-11-06T15:00:00Z');
const T = '2026-11-06T15:00:00.000Z';

const ok = (weeks: LegacyWeek[]): SourceOutcome => ({ ok: true, weeks, fetchedAt: T });
const fail = (error: string): SourceOutcome => ({ ok: false, error, fetchedAt: T });
const clone = <X>(x: X): X => JSON.parse(JSON.stringify(x));

/** Asserts that no position value of any kind is present in the payload. */
function assertNoPositionValues(r: ReturnType<typeof evaluateLegacyCot>) {
  assert.equal(r.groups, null);
  assert.equal(r.history, null);
  assert.equal(r.netChange, null);
  assert.equal(r.sources.primary.unverifiedLatest, undefined);
  assert.equal(r.sources.validation.unverifiedLatest, undefined);
  assert.deepEqual(r.validation.differences, []);
}

describe('MarketBulls Legacy parser', () => {
  test('maps the three Legacy groups and sorts newest first', () => {
    const weeks = parseMarketBullsLegacyCot(MB_HTML);
    assert.equal(weeks.length, 3);
    assert.deepEqual(weeks.map((w) => w.reportDate), ['2026-11-03', '2026-10-27', '2026-10-20']);
    assert.deepEqual(weeks[0].groups, {
      nonCommercial: { long: 41000, short: 29500, net: 11500 },
      commercial: { long: 149000, short: 162600, net: -13600 },
      nonReportable: { long: 21400, short: 19300, net: 2100 },
    });
  });

  test('rejects Disaggregated / TFF categories instead of mapping them to Non-commercial', () => {
    assert.throws(() => parseMarketBullsLegacyCot(fx('marketbulls-tff-synthetic.html')), /no recognisable Legacy data/);
  });

  test('throws on an unrecognised page and never guesses', () => {
    assert.throws(() => parseMarketBullsLegacyCot('<html><p>maintenance</p></html>'), /no recognisable Legacy data/);
  });

  test('history weeks are net-only (long/short null) and only the latest week carries long/short', () => {
    const weeks = parseMarketBullsLegacyCot(MB_HTML);
    assert.deepEqual(weeks[1].groups.nonCommercial, { long: null, short: null, net: 10100 });
    assert.deepEqual(weeks[1].groups.commercial, { long: null, short: null, net: -12300 });
    assert.deepEqual(weeks[1].groups.nonReportable, { long: null, short: null, net: 2200 });
  });

  test('parses the live JSON-blob structure with the real key names', () => {
    const weeks = parseMarketBullsLegacyCot(MB_LIVE);
    assert.equal(weeks.length, 2);
    assert.deepEqual(weeks.map((w) => w.reportDate), ['2026-10-27', '2026-10-20']);
    assert.deepEqual(weeks[0].groups, {
      nonCommercial: { long: 84567, short: 35728, net: 48839 },
      commercial: { long: 136338, short: 198430, net: -62092 },
      nonReportable: { long: 41642, short: 28389, net: 13253 },
    });
    assert.deepEqual(weeks[1].groups.nonCommercial, { long: null, short: null, net: 50726 });
    assert.deepEqual(weeks[1].groups.commercial, { long: null, short: null, net: -63576 });
    assert.deepEqual(weeks[1].groups.nonReportable, { long: null, short: null, net: 12850 });
  });

  test('header classification is strict', () => {
    assert.equal(groupOfHeader('Non-Commercial Long'), 'nonCommercial');
    assert.equal(groupOfHeader('Large Speculators Net'), 'nonCommercial');
    assert.equal(groupOfHeader('Commercial Short'), 'commercial');
    assert.equal(groupOfHeader('Non-Reportable Net'), 'nonReportable');
    assert.equal(groupOfHeader('Small Traders Long'), 'nonReportable');
    assert.equal(groupOfHeader('Managed Money Long'), null);
    assert.equal(fieldOfHeader('Net Change'), null);
    assert.equal(fieldOfHeader('COT Index 6M'), null);
    assert.equal(fieldOfHeader('Non-Commercial Net'), 'net');
  });

  test('a missing cell becomes null, never 0', () => {
    const html = MB_HTML.replace('"Noncommercial Positions-Long (All)":"41000"', '"Noncommercial Positions-Long (All)":"n/a"');
    const w = parseMarketBullsLegacyCot(html)[0];
    assert.equal(w.groups.nonCommercial.long, null);
    assert.equal(w.groups.nonCommercial.net, 11500); // the page's own net is kept
  });
});

describe('CFTC Legacy parser', () => {
  test('maps noncomm / comm / nonrept and computes net = long − short', () => {
    const weeks = parseCftcLegacy(CFTC_ROWS);
    assert.equal(weeks.length, 3, 'rows for other contract codes are ignored');
    assert.equal(weeks[0].reportDate, '2026-11-03');
    assert.deepEqual(weeks[0].groups.commercial, { long: 149000, short: 162600, net: -13600 });
  });

  test('throws on an empty or unusable response', () => {
    assert.throws(() => parseCftcLegacy([]), /empty response/);
    assert.throws(() => parseCftcLegacy({}), /empty response/);
    assert.throws(() => parseCftcLegacy([{ report_date_as_yyyy_mm_dd: '2026-11-03', cftc_contract_market_code: '209742' }]), /no usable rows/);
  });
});

describe('Validation states', () => {
  const mb = parseMarketBullsLegacyCot(MB_HTML);
  const cftc = parseCftcLegacy(CFTC_ROWS);

  test('VERIFIED when every shared field matches', () => {
    const r = evaluateLegacyCot(ok(mb), ok(cftc), NOW);
    assert.equal(r.status, 'VERIFIED');
    assert.equal(r.reason, null);
    assert.equal(r.reportDate, '2026-11-03');
    assert.equal(r.validation.fieldsCompared, 9);
    assert.equal(r.validation.rule, 'PROVISIONAL_EXACT_MATCH');
    assert.equal(r.groups?.nonCommercial.net, 11500);
    assert.deepEqual(r.netChange, { nonCommercial: 1400, commercial: -1300, nonReportable: -100 });
    assert.equal(r.history?.length, 3);
  });

  test('MISMATCH when a value differs: reported as unverified with both sides, never as verified', () => {
    const bad = clone(cftc);
    bad[0].groups.nonCommercial.long = 41010;
    bad[0].groups.nonCommercial.net = 11510;
    const r = evaluateLegacyCot(ok(mb), ok(bad), NOW);
    assert.equal(r.status, 'MISMATCH');
    assert.equal(r.reason, 'VALUES_DIFFER');
    assert.equal(r.groups, null, 'no verified groups on a mismatch');
    assert.equal(r.history, null);
    assert.equal(r.validation.differences.length, 2);
    assert.deepEqual(r.validation.differences[0], {
      reportDate: '2026-11-03', group: 'nonCommercial', field: 'long', primary: 41000, validation: 41010, delta: -10,
    });
    assert.ok(r.sources.primary.unverifiedLatest);
    assert.ok(r.sources.validation.unverifiedLatest);
  });

  test('no tolerance is applied: a difference of one contract is still a MISMATCH', () => {
    const bad = clone(cftc);
    bad[0].groups.nonReportable.short = 19301;
    bad[0].groups.nonReportable.net = 2099;
    assert.equal(evaluateLegacyCot(ok(mb), ok(bad), NOW).status, 'MISMATCH');
  });

  test('history only contains weeks that are themselves verified', () => {
    const bad = clone(cftc);
    bad[2].groups.commercial.short = 1; // the oldest week no longer matches
    bad[2].groups.commercial.net = 150999;
    const r = evaluateLegacyCot(ok(mb), ok(bad), NOW);
    assert.equal(r.status, 'VERIFIED');
    assert.deepEqual(r.history?.map((h) => h.reportDate), ['2026-11-03', '2026-10-27']);
  });

  test('DATA_UNAVAILABLE when MarketBulls fails — no CFTC values are substituted', () => {
    const r = evaluateLegacyCot(fail('MarketBulls: HTTP 503'), ok(cftc), NOW);
    assert.equal(r.status, 'DATA_UNAVAILABLE');
    assert.equal(r.reason, 'PRIMARY_UNAVAILABLE');
    assertNoPositionValues(r);
    assert.equal(r.sources.primary.error, 'MarketBulls: HTTP 503');
  });

  test('DATA_UNAVAILABLE when CFTC fails — MarketBulls values are not shown unverified as verified', () => {
    const r = evaluateLegacyCot(ok(mb), fail('CFTC: timeout'), NOW);
    assert.equal(r.status, 'DATA_UNAVAILABLE');
    assert.equal(r.reason, 'VALIDATION_UNAVAILABLE');
    assertNoPositionValues(r);
  });

  test('DATA_UNAVAILABLE when both fail', () => {
    const r = evaluateLegacyCot(fail('a'), fail('b'), NOW);
    assert.equal(r.reason, 'BOTH_UNAVAILABLE');
    assertNoPositionValues(r);
  });

  test('DATA_UNAVAILABLE when CFTC does not have the MarketBulls report week', () => {
    const r = evaluateLegacyCot(ok(mb), ok(cftc.slice(1)), NOW);
    assert.equal(r.reason, 'VALIDATION_WEEK_NOT_FOUND');
    assert.equal(r.validation.comparedWeek, '2026-11-03');
    assertNoPositionValues(r);
  });

  test('DATA_UNAVAILABLE when no field can be compared', () => {
    const sparse = clone(mb);
    for (const g of ['nonCommercial', 'commercial', 'nonReportable'] as const) {
      sparse[0].groups[g] = { long: null, short: null, net: null };
    }
    const cftcSparse = clone(cftc);
    const r = evaluateLegacyCot(ok(sparse), ok(cftcSparse), NOW);
    assert.equal(r.reason, 'NO_COMPARABLE_FIELDS');
    assertNoPositionValues(r);
  });

  test('compareWeeks skips fields a source does not publish', () => {
    const a = clone(mb[0]);
    a.groups.commercial.long = null;
    const c = compareWeeks(a, cftc[0]);
    assert.equal(c.fieldsCompared, 8);
    assert.equal(c.differences.length, 0);
  });
});

describe('getLegacyCot caching and observations', () => {
  beforeEach(() => clearLegacyCotCache());
  const mb = parseMarketBullsLegacyCot(MB_HTML);
  const cftc = parseCftcLegacy(CFTC_ROWS);

  test('DATA_UNAVAILABLE is never cached; a later success is served', async () => {
    let calls = 0;
    let up = false;
    const deps: LegacyCotDeps = {
      fetchPrimary: async () => { calls++; return up ? ok(mb) : fail('down'); },
      fetchValidation: async () => ok(cftc),
      now: () => NOW,
    };
    assert.equal((await getLegacyCot(deps)).status, 'DATA_UNAVAILABLE');
    up = true;
    assert.equal((await getLegacyCot(deps)).status, 'VERIFIED');
    assert.equal((await getLegacyCot(deps)).status, 'VERIFIED');
    assert.equal(calls, 2, 'the verified result is cached');
  });

  test('every comparison is recorded for review, including differences', async () => {
    const bad = clone(cftc);
    bad[0].groups.commercial.long = 149001;
    bad[0].groups.commercial.net = -13599;
    await getLegacyCot({ fetchPrimary: async () => ok(mb), fetchValidation: async () => ok(bad), now: () => NOW });
    const obs = getLegacyCotObservations();
    assert.equal(obs.length, 1);
    assert.equal(obs[0].status, 'MISMATCH');
    assert.equal(obs[0].differences.length, 2);
  });
});
