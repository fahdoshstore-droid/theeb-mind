import { Router, type Router as RouterType, type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { computeUnifiedQuality, type UnifiedQualityInput } from './quality.engine.js';
import { db } from '../../db/db.js';

const router: RouterType = Router();

// ── POST /api/quality/evaluate ─────────────────────────
router.post('/evaluate', (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  try {
    const body = req.body as UnifiedQualityInput & { instrument?: string; timeframe?: string };
    const result = computeUnifiedQuality(body);

    // Persist to quality_evaluations
    const evalId = uuidv4();
    db.raw
      .prepare(
        `INSERT INTO quality_evaluations
         (id, user_id, decision_id, composite_score, grade, confidence, breakdown_json, flags_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        evalId,
        userId,
        null,
        result.composite_score,
        result.grade,
        result.confidence,
        JSON.stringify(result.breakdown),
        JSON.stringify(result.flags),
      );

    res.json({ success: true, data: result });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { message: err instanceof Error ? err.message : 'خطأ' } });
  }
});

// ── GET /api/quality/history/:userId ──────────────────
router.get('/history/:userId', (req: Request, res: Response) => {
  const authUserId = (req as any).userId as string;
  const pathUserId = String(req.params.userId);
  if (authUserId !== pathUserId) {
    res.status(403).json({ success: false, error: { message: 'غير مصرح' } });
    return;
  }
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? '100'), 10) || 100, 500);
    const rows = db.raw
      .prepare(
        `SELECT id, user_id, decision_id, composite_score, grade, confidence,
                breakdown_json, flags_json, created_at
         FROM quality_evaluations
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .all(authUserId, limit);
    res.json({ success: true, data: rows });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { message: err instanceof Error ? err.message : 'خطأ' } });
  }
});

export const qualityRoutes: RouterType = router;
