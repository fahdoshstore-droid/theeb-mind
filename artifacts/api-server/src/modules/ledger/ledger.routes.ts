// /api/ledger — journal, imports, TRIL, rules profile, analytics, planner.
// Every handler takes the user from the authenticated session (currentUserId); IDs in paths are
// always looked up together with that user, so another user's records resolve to 404.
import { Router, type Request, type Response, type NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { currentUserId } from '../../middleware/auth.js';
import { createError } from '../../middleware/error-handler.js';
import { PRESETS, TRADE_FIELDS, FILL_FIELDS } from '../../domain/import-normalize.js';
import { INSTRUMENTS } from '../../domain/instruments.js';
import { SOURCE_KILLZONES, MACRO_WINDOWS, TRIL_METHODOLOGY_VERSION } from '../../domain/tril.js';
import * as acc from './accounts.service.js';
import * as imp from './import.service.js';
import * as tr from './trades.service.js';
import * as prof from './profile.service.js';
import * as tril from './tril.service.js';
import * as ins from './insights.service.js';

const r = Router();
type H = (req: Request, res: Response) => unknown;
const h = (fn: H) => (req: Request, res: Response, next: NextFunction) => {
  try {
    const out = fn(req, res);
    if (out !== undefined && !res.headersSent) res.json({ success: true, data: out });
  } catch (e) {
    if (e instanceof ZodError) next(createError(e.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; '), 400, 'VALIDATION_ERROR'));
    else next(e);
  }
};
const uid = currentUserId;
const P = (req: Request, k: string) => String(req.params[k]);

const iso = z.string().refine((s) => Number.isFinite(Date.parse(s)), 'invalid timestamp');
const num = z.number().finite();
const filterSchema = z.object({
  accountIds: z.union([z.string(), z.array(z.string())]).optional().transform((v) => (v == null ? undefined : [v].flat().flatMap((s) => s.split(',')).filter(Boolean))),
  from: z.string().optional(), to: z.string().optional(), symbol: z.string().max(20).optional(), side: z.enum(['long', 'short']).optional(),
  status: z.enum(['open', 'closed']).optional(), tag: z.string().max(64).optional(), setup: z.string().max(120).optional(), q: z.string().max(100).optional(),
  includeDemo: z.enum(['true', 'false']).optional().transform((v) => v === 'true'), outcome: z.enum(['win', 'loss', 'breakeven']).optional(),
  ids: z.string().optional().transform((v) => v?.split(',').filter(Boolean)), limit: z.coerce.number().int().optional(), offset: z.coerce.number().int().optional(),
  minSample: z.coerce.number().int().min(1).max(1000).optional(),
});

// ── Reference ──
r.get('/meta', h(() => ({
  presets: PRESETS, tradeFields: TRADE_FIELDS, fillFields: FILL_FIELDS, instruments: INSTRUMENTS,
  tril: { methodologyVersion: TRIL_METHODOLOGY_VERSION, sourceKillzones: SOURCE_KILLZONES, macroWindows: Object.fromEntries(Object.entries(MACRO_WINDOWS).map(([k, v]) => [k, v.label])),
    notInterpreted: ['OD 30–40 (meaning not documented in the available source summary)'], timezone: 'America/New_York (DST-aware)' },
  limits: { maxImportBytes: imp.MAX_IMPORT_BYTES, maxImportRows: imp.MAX_IMPORT_ROWS, maxAttachmentBytes: tr.MAX_ATTACHMENT_BYTES },
  demoAccountName: ins.DEMO_ACCOUNT,
})));

// ── Accounts & firms ──
const phase = z.enum(['challenge', 'funded_pre_payout', 'funded_post_payout', 'personal', 'demo']);
r.get('/accounts', h((req) => acc.listAccounts(uid(req))));
r.post('/accounts', h((req, res) => { res.status(201); return acc.createAccount(uid(req), z.object({ name: z.string().trim().min(1).max(100), broker: z.string().max(100).nullish(), firmProfileId: z.string().nullish(),
  phase: phase.exclude(['demo']).optional(), startingBalance: num.nullish(), currency: z.string().length(3).optional() }).parse(req.body)); }));
r.patch('/accounts/:id', h((req) => acc.updateAccount(uid(req), P(req, 'id'), z.object({ name: z.string().trim().min(1).max(100).optional(), broker: z.string().max(100).nullish(),
  firmProfileId: z.string().nullish(), phase: phase.exclude(['demo']).optional(), startingBalance: num.nullish(), archived: z.boolean().optional() }).parse(req.body))));
const firmRules = z.object({
  accountSize: num.nullish(), drawdownModel: z.enum(['static', 'trailing_eod', 'trailing_intraday', 'unknown']).nullish(), maxDrawdownUsd: num.nonnegative().nullish(),
  trailingStopsAtStart: z.boolean().nullish(), dailyLossLimitUsd: num.nonnegative().nullish(), profitTargetUsd: num.nonnegative().nullish(),
  consistencyMaxDayPct: num.min(0).max(100).nullish(), minProfitableDays: z.number().int().nonnegative().nullish(), minProfitPerDayUsd: num.nonnegative().nullish(),
  minPayoutUsd: num.nonnegative().nullish(), maxPayoutPctOfProfit: num.min(0).max(100).nullish(), minBufferAboveFloorUsd: num.nonnegative().nullish(),
}).strict();
const firmBody = z.object({ name: z.string().trim().min(1).max(100), sourceUrl: z.string().url().max(500).nullish(), sourceCheckedAt: z.string().max(40).nullish(), rules: firmRules, notes: z.string().max(5000).nullish() });
r.get('/firms', h((req) => acc.listFirmProfiles(uid(req))));
r.post('/firms', h((req, res) => { res.status(201); return acc.upsertFirmProfile(uid(req), null, firmBody.parse(req.body)); }));
r.put('/firms/:id', h((req) => acc.upsertFirmProfile(uid(req), P(req, 'id'), firmBody.parse(req.body))));

// ── Imports ──
const importBody = z.object({
  content: z.string().min(1), filename: z.string().max(255).nullish(), kind: z.enum(['trades', 'fills']), preset: z.string().max(64).nullish(),
  mapping: z.record(z.union([z.string().max(200), z.array(z.string().max(200)).max(4)])).nullish(),
  timezone: z.string().min(1).max(64), dateOrder: z.enum(['MDY', 'DMY']).optional(), accountId: z.string().nullish(), accountName: z.string().trim().max(100).nullish(),
});
r.post('/imports/preview', h((req) => imp.previewImport(uid(req), importBody.parse(req.body) as imp.ImportRequest)));
r.post('/imports/commit', h((req, res) => { res.status(201); return imp.commitImport(uid(req), importBody.extend({ duplicatePolicy: z.enum(['skip', 'update', 'distinct']), expectedSha256: z.string().length(64) }).parse(req.body) as never); }));
r.get('/imports', h((req) => imp.listBatches(uid(req))));
r.get('/imports/:id', h((req) => { const b = imp.getBatch(uid(req), P(req, 'id')); if (!b) throw createError('import batch not found', 404, 'NOT_FOUND'); return b; }));
r.get('/imports/:id/source', (req, res, next) => {
  try {
    const s = imp.getBatchSource(uid(req), P(req, 'id'));
    if (!s) throw createError('import batch not found', 404, 'NOT_FOUND');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${(s.filename ?? 'import.csv').replace(/[^A-Za-z0-9._-]/g, '_')}"`);
    res.setHeader('X-Content-SHA256', s.sha256);
    res.send(s.text);
  } catch (e) { next(e); }
});

// ── Trades ──
r.get('/trades', h((req) => { const f = filterSchema.parse(req.query); return tr.queryTrades(uid(req), f).map(tr.tradeOut); }));
r.get('/trades/calendar', h((req) => tr.calendar(uid(req), filterSchema.parse(req.query))));
r.post('/trades', h((req, res) => { res.status(201); return tr.createManualTrade(uid(req), z.object({ accountId: z.string(), symbol: z.string().trim().min(1).max(20), side: z.enum(['long', 'short']),
  quantity: z.number().positive(), entryTime: iso, exitTime: iso.nullish(), entryPrice: num, exitPrice: num.nullish(), fees: num.nonnegative().nullish(), netPnl: num.nullish(),
  stopPrice: num.nullish(), targetPrice: num.nullish(), setup: z.string().max(120).nullish(), notes: z.string().max(20000).nullish(), tickSize: num.positive().nullish(), tickValue: num.positive().nullish() }).parse(req.body)); }));
r.get('/trades/:id', h((req) => tr.getTradeDetail(uid(req), P(req, 'id'))));
r.patch('/trades/:id', h((req) => tr.annotateTrade(uid(req), P(req, 'id'), z.object({ setup: z.string().max(120).nullish(), executionGrade: z.enum(['A', 'B', 'C', 'D', 'F']).nullish(),
  emotionBefore: z.string().max(200).nullish(), emotionAfter: z.string().max(200).nullish(), userNotes: z.string().max(20000).nullish(), stopPrice: num.nullish(), targetPrice: num.nullish() }).strict().parse(req.body))));
r.put('/trades/:id/tags', h((req) => tr.setTags(uid(req), P(req, 'id'), z.object({ tags: z.array(z.string().max(64)).max(50) }).parse(req.body).tags)));
r.delete('/trades/:id', h((req) => { tr.deleteManualTrade(uid(req), P(req, 'id')); return { deleted: true }; }));
r.post('/trades/:id/attachments', h((req, res) => { res.status(201); return tr.addAttachment(uid(req), P(req, 'id'), z.object({ mime: z.string(), dataBase64: z.string().max(5_000_000), caption: z.string().max(300).nullish() }).parse(req.body)); }));
r.get('/attachments/:id', (req, res, next) => {
  try {
    const a = tr.getAttachment(uid(req), P(req, 'id'));
    if (!a) throw createError('attachment not found', 404, 'NOT_FOUND');
    res.setHeader('Content-Type', a.mime);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    res.send(a.data);
  } catch (e) { next(e); }
});
r.delete('/attachments/:id', h((req) => { tr.deleteAttachment(uid(req), P(req, 'id')); return { deleted: true }; }));

// ── Notes / sessions ──
r.get('/notes', h((req) => ins.listSessionNotes(uid(req), req.query.from as string | undefined, req.query.to as string | undefined)));
r.post('/notes', h((req, res) => { res.status(201); return ins.addNote(uid(req), z.object({ kind: z.enum(['session_pre', 'session_post', 'trade']), sessionDate: z.string().nullish(), tradeId: z.string().nullish(),
  body: z.string().min(1).max(20000), mood: z.number().int().min(1).max(5).nullish(), readiness: z.number().int().min(1).max(5).nullish() }).parse(req.body)); }));
r.patch('/notes/:id', h((req) => ins.updateNote(uid(req), P(req, 'id'), z.object({ body: z.string().min(1).max(20000) }).parse(req.body).body)));

// ── Rules profile ──
r.get('/rules', h((req) => prof.listRules(uid(req))));
r.get('/rules/history', h((req) => prof.ruleHistory(uid(req))));
r.get('/rules/active', h((req) => prof.activeRules(uid(req))));
r.put('/rules/:key', h((req) => { const b = z.object({ value: z.unknown(), reason: z.string().max(500).nullish(), status: z.enum(['active', 'observation']).optional() }).parse(req.body);
  return prof.setRule(uid(req), P(req, 'key'), b.value, b.reason ?? null, b.status); }));
r.post('/rules/version/:id/confirm', h((req) => prof.confirmRule(uid(req), P(req, 'id'))));
r.post('/rules/version/:id/status', h((req) => { const b = z.object({ status: z.enum(['active', 'observation', 'historical', 'disabled']), reason: z.string().max(500).nullish() }).parse(req.body);
  return prof.changeStatus(uid(req), P(req, 'id'), b.status, b.reason ?? null); }));
r.post('/risk/check', h((req) => ins.riskCheck(uid(req), z.object({ accountId: z.string().nullish(), symbol: z.string().min(1).max(20), side: z.enum(['long', 'short']), entryPrice: num, stopPrice: num,
  targetPrice: num.nullish(), quantity: z.number().int().positive(), tickSize: num.positive().nullish(), tickValue: num.positive().nullish(),
  feesPerContractRoundTrip: num.nonnegative().nullish(), slippageTicks: num.nonnegative().nullish(), at: iso.nullish() }).parse(req.body))));

// ── TRIL ──
const state = z.enum(['yes', 'no', 'unclear', 'na']).nullish();
const source = z.enum(['manual', 'screenshot', 'market_data', 'ai_assisted']).nullish();
const item = z.object({ state, source, note: z.string().max(2000).nullish(), ref: z.string().max(500).nullish(), confirmedByUser: z.boolean().nullish() });
const trilBody = z.object({
  phase: z.enum(['pre_trade', 'post_trade']), tradeId: z.string().nullish(), instrument: z.string().max(20).nullish(), direction: z.enum(['long', 'short']).nullish(),
  decisionTime: iso.nullish(), analysisText: z.string().max(20000).nullish(), readiness: z.number().int().min(1).max(5).nullish(), emotion: z.string().max(200).nullish(),
  evidence: z.object({
    time: z.object({ macroExceptionRaidToPdArray: item.optional() }).optional(),
    raid: z.object({ liquiditySwept: item.extend({ level: z.string().max(200).nullish() }).optional(), smtVsEs: item.optional() }).optional(),
    inversion: z.object({ type: z.enum(['ifvg', 'breaker']).nullish(), state: z.enum(['none', 'formed', 'confirmed', 'retest_seen', 'invalidated']).nullish(), source,
      confirmedByUser: z.boolean().nullish(), note: z.string().max(2000).nullish(), directPdArrayAfterRaid: item.optional() }).optional(),
    liquidity: z.object({ drawOnLiquidity: z.string().max(300).nullish(), dolType: z.enum(['ERL', 'IRL']).nullish(), target: z.string().max(300).nullish(),
      invalidation: z.string().max(300).nullish(), erlIrlStoryClear: item.optional(), source }).optional(),
    topDown: z.object({ htfBias: z.enum(['bullish', 'bearish', 'neutral', 'unclear']).nullish(), mtf: z.enum(['aligned', 'conflict', 'unclear']).nullish(), ltfModel: item.optional() }).optional(),
  }),
});
r.get('/tril', h((req) => tril.listEvaluations(uid(req), { tradeId: req.query.tradeId as string | undefined })));
r.post('/tril/evaluate', h((req) => tril.previewEvaluation(uid(req), trilBody.parse(req.body) as never)));
r.post('/tril', h((req, res) => { res.status(201); return tril.createEvaluation(uid(req), trilBody.parse(req.body) as never); }));
r.get('/tril/:id', h((req) => tril.getEvaluation(uid(req), P(req, 'id'))));
r.put('/tril/:id', h((req) => tril.updateEvaluation(uid(req), P(req, 'id'), trilBody.parse(req.body) as never)));
r.post('/tril/:id/lock', h((req) => tril.lockEvaluation(uid(req), P(req, 'id'), z.object({ tradeId: z.string().nullish() }).parse(req.body ?? {}).tradeId ?? null)));

// ── Analytics, behavior, reconciliation ──
r.get('/analytics', h((req) => { const f = filterSchema.parse(req.query); return ins.analytics(uid(req), f, f.minSample); }));
r.get('/behavior', h((req) => ins.behavior(uid(req), filterSchema.parse(req.query))));
r.post('/behavior/feedback', h((req) => ins.behaviorFeedback(uid(req), z.object({ pattern: z.string().min(1).max(64), tradeId: z.string(), verdict: z.enum(['confirmed', 'rejected']), note: z.string().max(1000).nullish() }).parse(req.body))));
r.get('/snapshots/templates', h(() => ins.snapshotTemplates()));
r.get('/snapshots', h((req) => ins.listSnapshots(uid(req))));
r.post('/snapshots', h((req, res) => { res.status(201); return ins.addSnapshot(uid(req), z.object({ template: z.enum(['tradezella_515', 'alpha_futures_103']).optional(), dataset: z.string().max(64).optional(),
  sourceName: z.string().max(200).optional(), periodStart: z.string().nullish(), periodEnd: z.string().nullish(), accountIds: z.array(z.string()).optional(),
  metrics: z.record(z.unknown()).optional(), notes: z.string().max(5000).nullish() }).parse(req.body) as never); }));
r.get('/snapshots/:id', h((req) => ins.getSnapshot(uid(req), P(req, 'id'))));
r.put('/snapshots/:id/accounts', h((req) => ins.setSnapshotAccounts(uid(req), P(req, 'id'), z.object({ accountIds: z.array(z.string()) }).parse(req.body).accountIds)));

// ── Funded planner ──
r.get('/planner/:accountId', h((req) => ins.planner(uid(req), P(req, 'accountId'))));
r.post('/planner/:accountId/payouts', h((req, res) => { res.status(201); return ins.addPayout(uid(req), P(req, 'accountId'), z.object({ kind: z.enum(['submitted', 'approved', 'received', 'rejected']),
  amount: num.positive(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), reference: z.string().max(200).nullish(), note: z.string().max(1000).nullish() }).parse(req.body)); }));
r.post('/planner/:accountId/equity', h((req, res) => { res.status(201); return ins.addEquity(uid(req), P(req, 'accountId'), z.object({ equity: num, asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}/) }).parse(req.body)); }));

// ── Export / demo ──
r.get('/export', (req, res, next) => {
  try {
    const userId = uid(req);
    if (req.query.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="theeb-mind-trades.csv"');
      res.send(ins.exportTradesCsv(userId, filterSchema.parse({ ...req.query, includeDemo: req.query.includeDemo ?? 'false' })));
    } else {
      res.setHeader('Content-Disposition', 'attachment; filename="theeb-mind-ledger-export.json"');
      res.json(ins.exportAll(userId));
    }
  } catch (e) { next(e); }
});
r.post('/demo/seed', h((req) => ins.seedDemo(uid(req))));
r.delete('/demo', h((req) => ins.deleteDemo(uid(req))));

export const ledgerRoutes: Router = r;
