// TRIL Time: Mon/Tue/Thu, 09:30–12:10 America/New_York, DST-aware.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateTrilTime, nyParts, TRIL_TIME } from '../src/lib/tril-time.ts';

const at = (iso: string) => evaluateTrilTime(Date.parse(iso));

describe('window boundaries (EST, UTC−5)', () => {
  // Thursday 5 Nov 2026 — after the 1 Nov DST change, New York is UTC−5.
  test('09:29:59 is before the window', () => assert.equal(at('2026-11-05T14:29:59Z').status, 'BEFORE_WINDOW'));
  test('09:30:00 is inside', () => assert.equal(at('2026-11-05T14:30:00Z').status, 'IN_WINDOW'));
  test('12:09:59 is inside', () => assert.equal(at('2026-11-05T17:09:59Z').status, 'IN_WINDOW'));
  test('12:10:00 is outside (end is exclusive)', () => assert.equal(at('2026-11-05T17:10:00Z').status, 'AFTER_WINDOW'));
  test('reports EST offset', () => assert.equal(at('2026-11-05T15:00:00Z').utcOffsetMinutes, -300));
});

describe('window boundaries (EDT, UTC−4)', () => {
  // Thursday 15 Oct 2026 — New York is UTC−4.
  test('09:30 EDT = 13:30 UTC is inside', () => assert.equal(at('2026-10-15T13:30:00Z').status, 'IN_WINDOW'));
  test('09:30 EST clock time in UTC (14:30Z) is 10:30 EDT, still inside', () => assert.equal(at('2026-10-15T14:30:00Z').time, '10:30'));
  test('13:29 UTC is 09:29 EDT, before', () => assert.equal(at('2026-10-15T13:29:00Z').status, 'BEFORE_WINDOW'));
  test('16:10 UTC is 12:10 EDT, after', () => assert.equal(at('2026-10-15T16:10:00Z').status, 'AFTER_WINDOW'));
  test('reports EDT offset', () => assert.equal(at('2026-10-15T15:00:00Z').utcOffsetMinutes, -240));
});

describe('allowed days', () => {
  // 10:00 New York (EST) on each day of the week of 2 Nov 2026.
  const day = (d: string) => at(`2026-11-${d}T15:00:00Z`);
  test('Monday is allowed', () => assert.equal(day('02').status, 'IN_WINDOW'));
  test('Tuesday is allowed', () => assert.equal(day('03').status, 'IN_WINDOW'));
  test('Wednesday is not', () => assert.equal(day('04').status, 'DAY_NOT_ALLOWED'));
  test('Thursday is allowed', () => assert.equal(day('05').status, 'IN_WINDOW'));
  test('Friday is not', () => assert.equal(day('06').status, 'DAY_NOT_ALLOWED'));
  test('Saturday is not', () => assert.equal(day('07').status, 'DAY_NOT_ALLOWED'));
  test('Sunday is not', () => assert.equal(day('08').status, 'DAY_NOT_ALLOWED'));
  test('the weekday is New York’s, not UTC’s: Thu 23:30 NY = Fri 04:30 UTC', () => {
    const r = at('2026-11-06T04:30:00Z');
    assert.equal(r.weekday, 4);
    assert.equal(r.date, '2026-11-05');
  });
});

describe('DST transitions', () => {
  // Spring forward: Sunday 8 Mar 2026. Monday 9 Mar is the first EDT trading day.
  test('Fri 6 Mar 2026 10:00 EST = 15:00Z (Friday, not allowed)', () => assert.equal(at('2026-03-06T15:00:00Z').status, 'DAY_NOT_ALLOWED'));
  test('Thu 5 Mar 2026 09:30 EST = 14:30Z inside', () => assert.equal(at('2026-03-05T14:30:00Z').status, 'IN_WINDOW'));
  test('Mon 9 Mar 2026 09:30 EDT = 13:30Z inside', () => assert.equal(at('2026-03-09T13:30:00Z').status, 'IN_WINDOW'));
  test('Mon 9 Mar 2026 13:29Z = 09:29 EDT before', () => assert.equal(at('2026-03-09T13:29:00Z').status, 'BEFORE_WINDOW'));
  test('Mon 9 Mar 2026 offset is −240', () => assert.equal(at('2026-03-09T14:00:00Z').utcOffsetMinutes, -240));
  // Fall back: Sunday 1 Nov 2026. Monday 2 Nov is the first EST trading day.
  test('Thu 29 Oct 2026 12:09 EDT = 16:09Z inside', () => assert.equal(at('2026-10-29T16:09:00Z').status, 'IN_WINDOW'));
  test('Mon 2 Nov 2026 16:09Z = 11:09 EST inside', () => assert.equal(at('2026-11-02T16:09:00Z').time, '11:09'));
  test('Mon 2 Nov 2026 17:10Z = 12:10 EST after', () => assert.equal(at('2026-11-02T17:10:00Z').status, 'AFTER_WINDOW'));
  // 2027 transitions: 14 Mar and 7 Nov.
  test('Tue 16 Mar 2027 09:30 EDT = 13:30Z inside', () => assert.equal(at('2027-03-16T13:30:00Z').status, 'IN_WINDOW'));
  test('Tue 9 Nov 2027 09:30 EST = 14:30Z inside', () => assert.equal(at('2027-11-09T14:30:00Z').status, 'IN_WINDOW'));
  test('Tue 9 Nov 2027 13:30Z = 08:30 EST before', () => assert.equal(at('2027-11-09T13:30:00Z').status, 'BEFORE_WINDOW'));
});

describe('host time zone independence', () => {
  // The whole suite is also run under several host zones (see the test:tz script).
  test(`same answer under host TZ=${process.env.TZ ?? '(unset)'}`, () => {
    const a = nyParts(Date.parse('2026-07-14T14:05:00Z'));
    assert.equal(a.time, '10:05');
    assert.equal(a.weekday, 2);
    assert.equal(a.date, '2026-07-14');
  });
});

describe('countdowns and constants', () => {
  test('minutes remaining inside the window', () => assert.equal(at('2026-11-05T16:52:00Z').minutesRemaining, 18));
  test('minutes until start before the window', () => assert.equal(at('2026-11-05T14:00:00Z').minutesUntilStart, 30));
  test('no countdown on a disallowed day', () => {
    const r = at('2026-11-04T14:00:00Z');
    assert.equal(r.minutesUntilStart, null);
    assert.equal(r.minutesRemaining, null);
  });
  test('London hours are never inside: Thu 03:00 NY', () => assert.equal(at('2026-11-05T08:00:00Z').status, 'BEFORE_WINDOW'));
  test('constants match the approved methodology', () => {
    assert.equal(TRIL_TIME.timeZone, 'America/New_York');
    assert.equal(TRIL_TIME.startMinute, 570);
    assert.equal(TRIL_TIME.endMinute, 730);
    assert.deepEqual([...TRIL_TIME.allowedWeekdays], [1, 2, 4]);
  });
});
