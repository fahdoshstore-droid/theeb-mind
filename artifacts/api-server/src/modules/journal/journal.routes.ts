import { Router, type Request, type Response } from 'express';
import { getDecisionsByUser, recordOutcome, getAnalytics } from './journal.service.js';
import { detectBehavioralPatterns } from './patterns.js';
import { outcomeRequestSchema, analyticsRequestSchema } from '../../shared/validators.js';
import { validate } from '../../middleware/validate.js';

const router = Router();

// GET /api/journal/:userId — journal entries for authenticated user
router.get('/:userId', (req: Request, res: Response) => {
  try {
    const authUserId = (req as any).userId as string;
    const pathUserId = String(req.params.userId);

    if (authUserId !== pathUserId) {
      res.status(403).json({ success: false, error: { message: 'غير مصرح بالوصول لبيانات مستخدم آخر' } });
      return;
    }

    const decisions = getDecisionsByUser(authUserId);
    const patterns = detectBehavioralPatterns(decisions as any);
    res.json({ success: true, data: { decisions, patterns } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'فشل جلب السجلات';
    res.status(500).json({ success: false, error: { message } });
  }
});

// POST /api/journal/:decisionId/outcome — record trade outcome
router.post('/:decisionId/outcome', validate(outcomeRequestSchema), (req: Request, res: Response) => {
  try {
    const decisionId = String(req.params.decisionId);
    const authUserId = (req as any).userId as string;
    const { outcome, pnl, notes } = req.body;
    recordOutcome({ decisionId, userId: authUserId, outcome, pnl, notes });
    res.json({ success: true, data: { decisionId, outcome } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'فشل تسجيل النتيجة';
    res.status(500).json({ success: false, error: { message } });
  }
});

// GET /api/journal/:userId/analytics — aggregated analytics for authenticated user
router.get('/:userId/analytics', validate(analyticsRequestSchema, 'query'), (req: Request, res: Response) => {
  try {
    const authUserId = (req as any).userId as string;
    const pathUserId = String(req.params.userId);

    if (authUserId !== pathUserId) {
      res.status(403).json({ success: false, error: { message: 'غير مصرح بالوصول لبيانات مستخدم آخر' } });
      return;
    }

    const period = (req.query.period as string) || '30d';
    const analytics = getAnalytics(authUserId, period);
    res.json({ success: true, data: analytics });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'فشل جلب التحليلات';
    res.status(500).json({ success: false, error: { message } });
  }
});

export const journalRoutes: import('express').Router = router;
