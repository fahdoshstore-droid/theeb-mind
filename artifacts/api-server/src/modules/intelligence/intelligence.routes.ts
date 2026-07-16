// ============================================
// THEEB MIND — Trade Intelligence Routes
// ============================================

import { Router, type Router as ExpressRouter } from 'express';
import { getPatternSummary, getTrends, getTradeFingerprint } from './intelligence.service.js';

export const intelligenceRoutes: ExpressRouter = Router();

// GET /api/intelligence/patterns/:userId
// Returns failure signature aggregates, heatmap, danger zones, top patterns
intelligenceRoutes.get('/patterns/:userId', (req, res) => {
  const { userId } = req.params;

  // IDOR guard
  const authUserId = (req as unknown as { userId?: string }).userId;
  if (authUserId && authUserId !== userId) {
    return res.status(403).json({ success: false, error: { message: 'غير مصرح' } });
  }

  try {
    const data = getPatternSummary(userId);
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[intelligence] patterns error:', err);
    return res.status(500).json({ success: false, error: { message: 'فشل تحليل الأنماط' } });
  }
});

// GET /api/intelligence/trends/:userId
// Returns last-30-trade quality trend, grade distribution, best/worst instruments
intelligenceRoutes.get('/trends/:userId', (req, res) => {
  const { userId } = req.params;

  const authUserId = (req as unknown as { userId?: string }).userId;
  if (authUserId && authUserId !== userId) {
    return res.status(403).json({ success: false, error: { message: 'غير مصرح' } });
  }

  try {
    const data = getTrends(userId);
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[intelligence] trends error:', err);
    return res.status(500).json({ success: false, error: { message: 'فشل تحليل الاتجاهات' } });
  }
});

// GET /api/intelligence/fingerprint/:decisionId
// Returns AHA moment analysis for a specific trade
intelligenceRoutes.get('/fingerprint/:decisionId', (req, res) => {
  const { decisionId } = req.params;
  const authUserId = (req as unknown as { userId?: string }).userId;

  if (!authUserId) {
    return res.status(401).json({ success: false, error: { message: 'غير مصادق' } });
  }

  // If caller supplies userId in query, it must match authenticated identity (IDOR guard)
  const queryUserId = req.query.userId as string | undefined;
  if (queryUserId && queryUserId !== authUserId) {
    return res.status(403).json({ success: false, error: { message: 'غير مصرح' } });
  }

  try {
    // Always use the authenticated userId — never the raw query param
    const data = getTradeFingerprint(decisionId, authUserId);
    if (!data) {
      return res.status(404).json({ success: false, error: { message: 'القرار غير موجود' } });
    }
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[intelligence] fingerprint error:', err);
    return res.status(500).json({ success: false, error: { message: 'فشل تحليل البصمة' } });
  }
});
