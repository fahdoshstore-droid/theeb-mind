// Regression tests for the Verify module.
// Pure helpers (checkClaims, checkManipulationPatterns, generateVerdict) are
// tested directly; the orchestrator verifyContent is tested against an
// in-memory DB with the global fetch stubbed so no network is touched.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const dir = mkdtempSync(path.join(tmpdir(), 'theeb-verify-'));
process.env.DB_PATH = path.join(dir, 'verify.db');

const { db } = await import('../src/db/db.js');
const { checkClaims } = await import('../src/modules/verify/check.js');
const { checkManipulationPatterns } = await import('../src/modules/verify/patterns.js');
const { generateVerdict } = await import('../src/modules/verify/verdict.js');
const { verifyContent } = await import('../src/modules/verify/verify.service.js');

const ORIGINAL_FETCH = globalThis.fetch;

before(() => db.init());
after(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

function seedUser(id: string) {
  db.raw.prepare('INSERT OR IGNORE INTO users (id, username) VALUES (?, ?)').run(id, `${id}-name`);
}

const claim = (text: string, category: string, confidence: number) => ({
  text,
  category: category as any,
  confidence,
});

describe('checkClaims (pure)', () => {
  test('empty input → empty result', () => {
    assert.deepEqual(checkClaims([]), []);
  });

  test('suspicious word demotes a high-confidence claim to unverified', () => {
    const [r] = checkClaims([claim('مضمون بنسبة 100%', 'price_action', 90)]);
    assert.equal(r.verified, false);
    assert.equal(r.claim.text, 'مضمون بنسبة 100%');
    assert.equal(typeof r.reason, 'string');
  });

  test('credible indicator promotes a mid-confidence claim to verified', () => {
    const [r] = checkClaims([claim('قد يكون السعر في تصحيح', 'price_action', 70)]);
    assert.equal(r.verified, true);
  });

  test('manipulation category is penalized', () => {
    const [r] = checkClaims([claim('تلاعب محتمل في السوق', 'manipulation', 90)]);
    assert.equal(r.verified, false);
  });

  test('fundamental category is boosted', () => {
    const [r] = checkClaims([claim('بيانات اقتصادية إيجابية', 'fundamental', 70)]);
    assert.equal(r.verified, true);
  });

  test('returns one CheckResult per input claim, in order', () => {
    const results = checkClaims([
      claim('قد يرتفع السعر', 'price_action', 70),
      claim('مضمون الربح', 'price_action', 90),
    ]);
    assert.equal(results.length, 2);
    assert.equal(results[0].verified, true);
    assert.equal(results[1].verified, false);
  });
});

describe('checkManipulationPatterns (pure)', () => {
  test('no matches → empty matches and zero count', () => {
    const r = checkManipulationPatterns('نص عادي بدون أنماط تلاعب');
    assert.deepEqual(r.matches, []);
    assert.equal(r.count, 0);
    assert.equal(r.text, 'نص عادي بدون أنماط تلاعب');
  });

  test('detects a known manipulation pattern', () => {
    const r = checkManipulationPatterns('يوجد ضخ وتفريغ واضح في السوق');
    assert.ok(r.matches.includes('ضخ وتفريغ'));
    assert.equal(r.count, 1);
  });

  test('empty string is safe', () => {
    assert.deepEqual(checkManipulationPatterns('').matches, []);
  });
});

describe('generateVerdict (pure)', () => {
  const input = (totalScore: number) => ({
    totalScore,
    verifiedClaims: 3,
    rejectedClaims: 1,
    manipulationFlags: [] as string[],
    claimsCount: 4,
  });

  test('high score → credible with full contract shape', () => {
    const v = generateVerdict(input(100));
    assert.equal(v.credibility, 'credible');
    assert.equal(v.credibilityScore, 100);
    assert.equal(v.claimsCount, 4);
    assert.equal(v.verifiedClaims, 3);
    assert.equal(v.rejectedClaims, 1);
    assert.ok(Array.isArray(v.manipulationFlags));
    assert.equal(typeof v.verdict, 'string');
    assert.equal(typeof v.explanation, 'string');
  });

  test('mid score → suspicious', () => {
    assert.equal(generateVerdict(input(50)).credibility, 'suspicious');
  });

  test('low score → rejected', () => {
    assert.equal(generateVerdict(input(10)).credibility, 'rejected');
  });
});

describe('verifyContent (DB-backed, fetch stubbed)', () => {
  test('Claude unavailable → pattern-only analysis, rejected, persisted', async () => {
    seedUser('u1');
    globalThis.fetch = async () => new Response('unauthorized', { status: 401 });

    const r = await verifyContent({ userId: 'u1', content: 'ضخ وتفريغ واضح' });
    assert.equal(r.credibility, 'rejected');
    assert.equal(r.claimsCount, 0);
    assert.equal(r.verifiedClaims, 0);
    assert.equal(r.rejectedClaims, 0);
    assert.deepEqual(r.claims, []);

    const stored = db.raw.prepare('SELECT * FROM verifications WHERE user_id = ?').get('u1') as any;
    assert.ok(stored, 'verification must be persisted');
    assert.equal(stored.credibility, 'rejected');
  });

  test('valid claims → full pipeline, credible, persisted', async () => {
    seedUser('u2');
    const claimsPayload = JSON.stringify({
      claims: [{ text: 'السعر في اتجاه صاعد', category: 'fundamental', confidence: 80 }],
    });
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({ content: [{ type: 'text', text: claimsPayload }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );

    const r = await verifyContent({ userId: 'u2', content: 'السعر في اتجاه صاعد', source: 'test-src' });
    assert.equal(r.credibility, 'credible');
    assert.equal(r.claimsCount, 1);
    assert.equal(r.verifiedClaims, 1);
    assert.equal(r.rejectedClaims, 0);
    assert.equal(r.claims?.length, 1);

    const stored = db.raw.prepare('SELECT * FROM verifications WHERE user_id = ?').get('u2') as any;
    assert.ok(stored);
    assert.equal(stored.credibility, 'credible');
    assert.equal(stored.source, 'test-src');
  });
});
