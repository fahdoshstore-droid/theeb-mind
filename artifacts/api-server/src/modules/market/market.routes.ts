import { Router, type Router as ExpressRouter } from 'express';
import {
  seedMarketDataIfEmpty,
  getLatestSnapshots,
  insertSnapshot,
  getEconomicEvents,
  insertEconomicEvent,
  getWeeklyBias,
  setWeeklyBias,
  getMacroNarrative,
  setMacroNarrative,
  currentWeekKey,
} from './market.service.js';

export const marketRoutes: ExpressRouter = Router();

// Seed on first request
let initDone = false;
function ensureSeeded() {
  if (!initDone) { seedMarketDataIfEmpty(); initDone = true; }
}

// ── Mappers (DB snake_case → camelCase) ──────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSnap(r: any) {
  return { id: r.id, instrument: r.instrument, metric: r.metric, value: r.value, direction: r.direction, note: r.note ?? undefined, createdAt: r.created_at };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapEvent(r: any) {
  return { id: r.id, title: r.title, titleAr: r.title_ar ?? undefined, impact: r.impact, eventDate: r.event_date, currency: r.currency, actual: r.actual ?? undefined, forecast: r.forecast ?? undefined, previous: r.previous ?? undefined };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapBias(r: any) {
  return { id: r.id, userId: r.user_id, instrument: r.instrument, bias: r.bias, weekKey: r.week_key, notes: r.notes ?? undefined };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapNarrative(r: any) {
  return r ? { id: r.id, userId: r.user_id, narrativeText: r.narrative_text, weekKey: r.week_key, createdAt: r.created_at } : null;
}

// ── GET /api/market/snapshots ─────────────────
marketRoutes.get('/snapshots', (_req, res) => {
  ensureSeeded();
  try {
    const data = getLatestSnapshots().map(mapSnap);
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[market] snapshots error:', err);
    return res.status(500).json({ success: false, error: { message: 'فشل جلب اللقطات' } });
  }
});

// ── POST /api/market/snapshots ────────────────
// Body: { instrument, metric, value, direction, note? }
marketRoutes.post('/snapshots', (req, res) => {
  ensureSeeded();
  const { instrument, metric, value, direction, note } = req.body ?? {};
  if (!instrument || !metric || value === undefined || !direction) {
    return res.status(400).json({ success: false, error: { message: 'بيانات ناقصة' } });
  }
  if (!['bullish','bearish','neutral'].includes(direction)) {
    return res.status(400).json({ success: false, error: { message: 'اتجاه غير صالح' } });
  }
  try {
    const row = insertSnapshot(instrument, metric, Number(value), direction, note);
    return res.json({ success: true, data: row });
  } catch (err) {
    console.error('[market] insert snapshot error:', err);
    return res.status(500).json({ success: false, error: { message: 'فشل حفظ اللقطة' } });
  }
});

// ── GET /api/market/events ────────────────────
marketRoutes.get('/events', (_req, res) => {
  ensureSeeded();
  try {
    const data = getEconomicEvents().map(mapEvent);
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[market] events error:', err);
    return res.status(500).json({ success: false, error: { message: 'فشل جلب الأحداث' } });
  }
});

// ── POST /api/market/events ───────────────────
marketRoutes.post('/events', (req, res) => {
  const { title, titleAr, impact, eventDate, currency, actual, forecast, previous } = req.body ?? {};
  if (!title || !impact || !eventDate || !currency) {
    return res.status(400).json({ success: false, error: { message: 'بيانات ناقصة' } });
  }
  try {
    const row = insertEconomicEvent({ title, titleAr, impact, eventDate, currency, actual, forecast, previous });
    return res.json({ success: true, data: row });
  } catch (err) {
    console.error('[market] insert event error:', err);
    return res.status(500).json({ success: false, error: { message: 'فشل حفظ الحدث' } });
  }
});

// ── GET /api/market/bias/:userId ──────────────
marketRoutes.get('/bias/:userId', (req, res) => {
  ensureSeeded();
  const { userId } = req.params;
  const authUserId = (req as unknown as { userId?: string }).userId;
  if (authUserId !== userId) {
    return res.status(403).json({ success: false, error: { message: 'غير مصرح' } });
  }
  try {
    const data = getWeeklyBias(userId).map(mapBias);
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[market] bias get error:', err);
    return res.status(500).json({ success: false, error: { message: 'فشل جلب التحيز' } });
  }
});

// ── POST /api/market/bias/:userId ─────────────
// Body: { instrument, bias, notes? }
marketRoutes.post('/bias/:userId', (req, res) => {
  const { userId } = req.params;
  const authUserId = (req as unknown as { userId?: string }).userId;
  if (authUserId !== userId) {
    return res.status(403).json({ success: false, error: { message: 'غير مصرح' } });
  }
  const { instrument, bias, notes } = req.body ?? {};
  if (!instrument || !bias || !['bullish','bearish','neutral'].includes(bias)) {
    return res.status(400).json({ success: false, error: { message: 'بيانات ناقصة أو تحيز غير صالح' } });
  }
  try {
    setWeeklyBias(userId, instrument, bias, notes);
    return res.json({ success: true });
  } catch (err) {
    console.error('[market] bias set error:', err);
    return res.status(500).json({ success: false, error: { message: 'فشل حفظ التحيز' } });
  }
});

// ── GET /api/market/narrative/:userId ─────────
marketRoutes.get('/narrative/:userId', (req, res) => {
  const { userId } = req.params;
  const authUserId = (req as unknown as { userId?: string }).userId;
  if (authUserId !== userId) {
    return res.status(403).json({ success: false, error: { message: 'غير مصرح' } });
  }
  try {
    const data = mapNarrative(getMacroNarrative(userId));
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[market] narrative get error:', err);
    return res.status(500).json({ success: false, error: { message: 'فشل جلب السردية' } });
  }
});

// ── POST /api/market/narrative/:userId ────────
// Body: { narrativeText }
marketRoutes.post('/narrative/:userId', (req, res) => {
  const { userId } = req.params;
  const authUserId = (req as unknown as { userId?: string }).userId;
  if (authUserId !== userId) {
    return res.status(403).json({ success: false, error: { message: 'غير مصرح' } });
  }
  const { narrativeText } = req.body ?? {};
  if (!narrativeText || typeof narrativeText !== 'string') {
    return res.status(400).json({ success: false, error: { message: 'نص السردية مطلوب' } });
  }
  try {
    const data = mapNarrative(setMacroNarrative(userId, narrativeText.trim()));
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[market] narrative set error:', err);
    return res.status(500).json({ success: false, error: { message: 'فشل حفظ السردية' } });
  }
});
