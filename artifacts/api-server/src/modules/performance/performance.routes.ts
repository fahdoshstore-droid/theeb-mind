import { Router, type Router as RouterType, type Request, type Response } from 'express';
import {
  getSummary,
  getEquityCurve,
  getDrawdown,
  getInstrumentBreakdown,
  getPsychCorrelation,
  getTimeAnalysis,
} from './performance.service.js';

const router: RouterType = Router();

/** Verify caller can only access their own data. Returns auth userId or sends 403. */
function resolveUserId(req: Request, res: Response): string | null {
  const authUserId = (req as any).userId as string | undefined;
  const pathUserId = String(req.params.userId);
  if (!authUserId || authUserId !== pathUserId) {
    res.status(403).json({ success: false, error: { message: 'غير مصرح بالوصول لبيانات مستخدم آخر' } });
    return null;
  }
  return authUserId;
}

router.get('/summary/:userId', (req: Request, res: Response) => {
  const userId = resolveUserId(req, res);
  if (!userId) return;
  try {
    res.json({ success: true, data: getSummary(userId) });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { message: err instanceof Error ? err.message : 'خطأ' } });
  }
});

router.get('/equity/:userId', (req: Request, res: Response) => {
  const userId = resolveUserId(req, res);
  if (!userId) return;
  try {
    res.json({ success: true, data: getEquityCurve(userId) });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { message: err instanceof Error ? err.message : 'خطأ' } });
  }
});

router.get('/drawdown/:userId', (req: Request, res: Response) => {
  const userId = resolveUserId(req, res);
  if (!userId) return;
  try {
    res.json({ success: true, data: getDrawdown(userId) });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { message: err instanceof Error ? err.message : 'خطأ' } });
  }
});

router.get('/instruments/:userId', (req: Request, res: Response) => {
  const userId = resolveUserId(req, res);
  if (!userId) return;
  try {
    res.json({ success: true, data: getInstrumentBreakdown(userId) });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { message: err instanceof Error ? err.message : 'خطأ' } });
  }
});

router.get('/psychology-correlation/:userId', (req: Request, res: Response) => {
  const userId = resolveUserId(req, res);
  if (!userId) return;
  try {
    res.json({ success: true, data: getPsychCorrelation(userId) });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { message: err instanceof Error ? err.message : 'خطأ' } });
  }
});

router.get('/time-analysis/:userId', (req: Request, res: Response) => {
  const userId = resolveUserId(req, res);
  if (!userId) return;
  try {
    res.json({ success: true, data: getTimeAnalysis(userId) });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { message: err instanceof Error ? err.message : 'خطأ' } });
  }
});

export const performanceRoutes: RouterType = router;
