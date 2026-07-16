import { Router, type Request, type Response } from 'express';
import { evaluateGate } from './psychology.service.js';
import { gateAnswersSchema } from '../../shared/validators.js';
import { validate } from '../../middleware/validate.js';
import { db } from '../../db/db.js';

const router = Router();

// GET /api/psychology/state/:userId — latest psychology snapshot
// :userId in path is validated against auth context to prevent cross-user reads
router.get('/state/:userId', (req: Request, res: Response) => {
  try {
    const authUserId = (req as any).userId as string;
    const pathUserId = String(req.params.userId);

    if (authUserId !== pathUserId) {
      res.status(403).json({ success: false, error: { message: 'غير مصرح بالوصول لبيانات مستخدم آخر' } });
      return;
    }

    const row = db.stmt('getPsychologyState').get(authUserId) as any;

    if (!row) {
      res.json({
        success: true,
        data: {
          userId: authUserId,
          phase: 'unknown',
          score: 0,
          maxScore: 100,
          verdict: 'pending',
          behavioralLock: false,
          lockReason: null,
          createdAt: new Date().toISOString(),
        },
      });
      return;
    }

    res.json({ success: true, data: row });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'فشل جلب الحالة النفسية';
    res.status(500).json({ success: false, error: { message } });
  }
});

// POST /api/psychology/checkin — evaluate gate answers
router.post('/checkin', validate(gateAnswersSchema), (req: Request, res: Response) => {
  try {
    // Enforce identity from auth context — ignore client-supplied userId
    const authUserId = (req as any).userId as string;
    const { answers } = req.body;
    const result = evaluateGate(authUserId, answers);
    res.json({ success: true, data: result.snapshot });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'فشل تقييم البوابة النفسية';
    res.status(500).json({ success: false, error: { message } });
  }
});

export const psychologyRoutes: import('express').Router = router;
