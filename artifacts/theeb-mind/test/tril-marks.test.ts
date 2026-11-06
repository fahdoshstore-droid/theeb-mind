// Device-local TRIL marks: create, edit, delete, validation, corrupted storage.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createMarkStore, validateMark, MARKS_STORAGE_KEY, type StorageLike, type MarkInput } from '../src/lib/tril-marks.ts';

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = v; } };
}
const base: MarkInput = {
  instrument: 'NQ', date: '2026-11-05', time: '09:45', timeframe: '15m', type: 'raid',
  priceLow: 21557.25, priceHigh: null, note: 'prior high taken',
};
let n = 0;
const store = (s: StorageLike | null = memoryStorage()) =>
  createMarkStore(s, { now: () => new Date('2026-11-05T15:00:00Z'), newId: () => `id${++n}` });

describe('validation', () => {
  test('accepts a single price', () => assert.deepEqual(validateMark(base), []));
  test('accepts a zone', () => assert.deepEqual(validateMark({ ...base, priceLow: 21500, priceHigh: 21520 }), []));
  test('rejects a reversed zone', () => assert.ok(validateMark({ ...base, priceLow: 21520, priceHigh: 21500 }).includes('zoneOrder')));
  test('rejects missing price', () => assert.ok(validateMark({ ...base, priceLow: NaN }).includes('price')));
  test('rejects bad time and date', () => {
    const e = validateMark({ ...base, time: '24:00', date: '05/11/2026' });
    assert.ok(e.includes('time') && e.includes('date'));
  });
  test('rejects unknown type and timeframe', () => {
    const e = validateMark({ ...base, type: 'trend' as never, timeframe: '2m' as never });
    assert.ok(e.includes('type') && e.includes('timeframe'));
  });
});

describe('CRUD', () => {
  test('add persists all required fields to device storage', () => {
    const s = memoryStorage();
    const st = store(s);
    const r = st.add(base);
    assert.equal(r.ok, true);
    const saved = JSON.parse(s.data[MARKS_STORAGE_KEY]);
    assert.equal(saved.length, 1);
    for (const k of ['instrument', 'date', 'time', 'timeframe', 'type', 'priceLow', 'priceHigh', 'note']) assert.ok(k in saved[0], k);
  });
  test('edit updates fields and keeps id and createdAt', () => {
    const st = store();
    const r = st.add(base);
    assert.ok(r.ok);
    const u = st.update(r.value.id, { priceLow: 21550, priceHigh: 21560, note: 'zone' });
    assert.ok(u.ok);
    assert.equal(u.value.id, r.value.id);
    assert.equal(u.value.createdAt, r.value.createdAt);
    assert.equal(u.value.priceHigh, 21560);
    assert.equal(st.list().length, 1);
  });
  test('edit is rejected when the result is invalid', () => {
    const st = store();
    const r = st.add(base);
    assert.ok(r.ok);
    const u = st.update(r.value.id, { priceHigh: 1 });
    assert.equal(u.ok, false);
    assert.equal(st.list()[0].priceHigh, null);
  });
  test('delete removes only that mark', () => {
    const st = store();
    const a = st.add(base); const b = st.add({ ...base, type: 'inversion' });
    assert.ok(a.ok && b.ok);
    assert.equal(st.remove(a.value.id), true);
    assert.equal(st.remove('missing'), false);
    assert.deepEqual(st.list().map((m) => m.type), ['inversion']);
  });
  test('list filters by instrument, date and type, newest first', () => {
    const st = store();
    st.add(base);
    st.add({ ...base, time: '10:15', type: 'liquidity' });
    st.add({ ...base, date: '2026-11-03' });
    st.add({ ...base, instrument: 'ES' });
    assert.deepEqual(st.list({ instrument: 'NQ', date: '2026-11-05' }).map((m) => m.time), ['10:15', '09:45']);
    assert.equal(st.list({ type: 'liquidity' }).length, 1);
  });
});

describe('storage robustness', () => {
  test('corrupted JSON reads as empty and does not throw', () => {
    const st = store(memoryStorage({ [MARKS_STORAGE_KEY]: '{not json' }));
    assert.deepEqual(st.list(), []);
    assert.equal(st.storageError(), true);
  });
  test('invalid records in storage are ignored', () => {
    const st = store(memoryStorage({ [MARKS_STORAGE_KEY]: JSON.stringify([{ id: 'x', type: 'trend' }]) }));
    assert.deepEqual(st.list(), []);
  });
  test('works in memory when device storage is unavailable', () => {
    const st = store(null);
    assert.ok(st.add(base).ok);
    assert.equal(st.list().length, 1);
  });
  test('a throwing storage is reported, not fatal', () => {
    const throwing: StorageLike = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
    const st = store(throwing);
    assert.ok(st.add(base).ok);
    assert.equal(st.storageError(), true);
  });
});
