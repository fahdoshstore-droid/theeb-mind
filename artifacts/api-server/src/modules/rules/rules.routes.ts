import { Router, type Router as RouterType, type Request, type Response } from 'express';
import { evaluateRules, getViolations, getRuleConfig } from './rules.service.js';
import type { RuleContext } from './rule-registry.js';
import { z } from 'zod';

const router: RouterType = Router();

const ruleContextSchema = z.object({
  tradesTaken:  z.number().int().min(0).default(0),
  riskAmount:   z.number().min(0).default(0),
  rrr:          z.number().min(0).default(0),
  dailyPnl:     z.number().default(0),
  consecLosses: z.number().int().min(0).default(0),
  dayOfWeek:    z.number().int().min(0).max(6).default(new Date().getDay()),
});

// POST /api/rules/evaluate
router.post('/evaluate', (req: Request, res: Response) => {
  try {
    const authUserId = (req as any).userId as string;
    const parsed = ruleContextSchema.safeParse(req.body.context ?? req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: { message: 'بيانات السياق غير صالحة' } });
      return;
    }
    const result = evaluateRules(authUserId, parsed.data as RuleContext);
    res.json({ success: true, data: result });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { message: err instanceof Error ? err.message : 'خطأ' } });
  }
});

// GET /api/rules/violations/:userId
router.get('/violations/:userId', (req: Request, res: Response) => {
  try {
    const authUserId = (req as any).userId as string;
    const pathUserId = String(req.params.userId);
    if (authUserId !== pathUserId) {
      res.status(403).json({ success: false, error: { message: 'غير مصرح' } });
      return;
    }
    const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 200);
    const data = getViolations(authUserId, limit);
    res.json({ success: true, data });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { message: err instanceof Error ? err.message : 'خطأ' } });
  }
});

// GET /api/rules/config
router.get('/config', (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: getRuleConfig() });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { message: err instanceof Error ? err.message : 'خطأ' } });
  }
});

export const rulesRoutes: RouterType = router;
