// Existing /api/market/cot service: contract kept, hard-coded fallback removed.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { getCotData, __setCotExtractorForTests } from '../src/modules/market/cot.service.js';

after(() => __setCotExtractorForTests(null));

test('a failed CFTC download returns an empty list, not hard-coded rows', async () => {
  __setCotExtractorForTests(() => { throw new Error('network down'); });
  const rows = await getCotData();
  assert.deepEqual(rows, []);
});

test('the module no longer contains any fallback dataset', () => {
  const src = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/modules/market/cot.service.ts'), 'utf8');
  assert.ok(!/FALLBACK_COT/.test(src));
  assert.ok(!/reportDate:\s*'fallback'/.test(src));
});
