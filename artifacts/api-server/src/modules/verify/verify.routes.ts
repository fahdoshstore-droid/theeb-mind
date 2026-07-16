import { Router, type Request, type Response } from 'express';
import { verifyContent } from './verify.service.js';
import { verifyRequestSchema } from '../../shared/validators.js';
import { validate } from '../../middleware/validate.js';

const router = Router();

router.post('/content', validate(verifyRequestSchema), async (req: Request, res: Response) => {
  try {
    // Enforce identity from auth context — never trust client-supplied userId
    const authUserId = (req as any).userId as string;
    const result = await verifyContent({ ...req.body, userId: authUserId });
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message || 'فشل التحقق من المحتوى' },
    });
  }
});

export const verifyRoutes: import('express').Router = router;
