// Seeds identical data into two running stacks and compares every read endpoint.
const [A, B] = [process.argv[2], process.argv[3]];
const H = { 'X-Api-Key': 'user-1_devkey', 'Content-Type': 'application/json' };
const U = 'user-1';
async function call(base, method, path, body) {
  const r = await fetch(base + path, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, body: j };
}
const decisions = [
  { instrument: 'NQ', timeframe: '15m', marketStructure: true, fairValueGap: true, orderBlock: true, liquiditySweep: true, immediateRebalance: false, killzoneActive: true, riskAmount: 300 },
  { instrument: 'MNQ', timeframe: '5m', marketStructure: true, fairValueGap: false, orderBlock: true, liquiditySweep: false, immediateRebalance: false, killzoneActive: false, riskAmount: 450 },
  { instrument: 'NQ', timeframe: '1h', marketStructure: false, fairValueGap: true, orderBlock: false, liquiditySweep: true, immediateRebalance: true, killzoneActive: true, riskAmount: 200 },
  { instrument: 'ES', timeframe: '15m', marketStructure: true, fairValueGap: true, orderBlock: false, liquiditySweep: true, immediateRebalance: true, killzoneActive: false, riskAmount: 600 },
];
const outcomes = [{ outcome: 'win', pnl: 250 }, { outcome: 'loss', pnl: -180 }, { outcome: 'breakeven', pnl: 0 }, { outcome: 'loss', pnl: -90, notes: 'late entry' }];
async function seed(base) {
  const ids = [];
  for (const d of decisions) {
    const r = await call(base, 'POST', '/api/decision/fallback', { userId: U, ...d });
    ids.push(r.body?.data?.id ?? r.body?.data?.decisionId ?? r.body?.data?.decision?.id);
  }
  for (let i = 0; i < ids.length; i++) if (ids[i]) await call(base, 'POST', `/api/journal/${ids[i]}/outcome`, outcomes[i]);
  await call(base, 'POST', '/api/psychology/checkin', { userId: U, answers: [1,2,3,4,5].map((q) => ({ questionId: q, selectedOption: q % 2 })) });
  await call(base, 'POST', '/api/rules/evaluate', { userId: U, tradesTaken: 2, riskAmount: 600, rrr: 1.5, dailyPnl: -700, consecLosses: 2, dayOfWeek: 3 });
  await call(base, 'POST', '/api/market/bias/' + U, { instrument: 'NAS', bias: 'bullish', notes: 'x' });
  await call(base, 'POST', '/api/market/narrative/' + U, { narrativeText: 'regression thesis' });
  return ids;
}
const reads = (ids) => [
  `/api/journal/${U}`, `/api/journal/${U}/analytics?period=all`, `/api/journal/${U}/analytics?period=7d`,
  `/api/intelligence/patterns/${U}`, `/api/intelligence/trends/${U}`, ...(ids[0] ? [`/api/intelligence/fingerprint/${ids[0]}?userId=${U}`] : []),
  `/api/performance/summary/${U}`, `/api/performance/equity/${U}`, `/api/performance/drawdown/${U}`, `/api/performance/instruments/${U}`,
  `/api/performance/psychology-correlation/${U}`, `/api/performance/time-analysis/${U}`, `/api/performance/quality-trend/${U}`,
  `/api/memory/context/${U}?instrument=NQ&timeframe=15m`, `/api/memory/patterns/${U}`,
  `/api/rules/violations/${U}`, `/api/rules/config`, `/api/quality/history/${U}`, `/api/psychology/state/${U}`,
  `/api/market/snapshots`, `/api/market/events`, `/api/market/bias/${U}`, `/api/market/narrative/${U}`, `/api/market/live`, `/api/market/cot`,
];
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const TS = /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?Z?/g;
function norm(x, k = '') {
  if (Array.isArray(x)) return x.map((v) => norm(v));
  if (x && typeof x === 'object') { const o = {}; for (const key of Object.keys(x).sort()) o[key] = /(^id$|Id$|_id$)/.test(key) ? '<id>' : norm(x[key], key); return o; }
  if (typeof x === 'string') return x.replace(UUID, '<uuid>').replace(TS, '<ts>');
  return x;
}
const [idsA, idsB] = [await seed(A), await seed(B)];
let same = 0; const diffs = [];
for (const [pa, pb] of reads(idsA).map((p, i) => [p, reads(idsB)[i]])) {
  const [ra, rb] = [await call(A, 'GET', pa), await call(B, 'GET', pb)];
  const ja = JSON.stringify({ s: ra.status, b: norm(ra.body) }), jb = JSON.stringify({ s: rb.status, b: norm(rb.body) });
  if (ja === jb) same++; else diffs.push({ path: pa.replace(/\/[0-9a-f-]{36}/, '/<id>'), main: ja.slice(0, 400), branch: jb.slice(0, 400) });
}
console.log(JSON.stringify({ seededDecisions: idsA.filter(Boolean).length, endpoints: reads(idsA).length, identical: same, different: diffs.length, diffs }, null, 2));
