import { Router, type Request, type Response } from 'express';
import { analyze, analyzeFallback } from './decision.service.js';
import { analyzeRequestSchema, fallbackRequestSchema } from '../../shared/validators.js';
import { validate } from '../../middleware/validate.js';

const router = Router();

router.post('/analyze', validate(analyzeRequestSchema), async (req: Request, res: Response) => {
  try {
    // Enforce identity from auth context — never trust client-supplied userId
    const authUserId = (req as any).userId as string;
    const result = await analyze({ ...req.body, userId: authUserId });
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message || 'فشل تحليل الشارت' },
    });
  }
});

router.post('/fallback', validate(fallbackRequestSchema), (req: Request, res: Response) => {
  try {
    const authUserId = (req as any).userId as string;
    const result = analyzeFallback({ ...req.body, userId: authUserId });
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message || 'فشل التحليل اليدوي' },
    });
  }
});

export const decisionRoutes: import('express').Router = router;
