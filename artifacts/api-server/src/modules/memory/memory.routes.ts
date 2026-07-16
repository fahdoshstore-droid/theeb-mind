import { Router, type Router as RouterType, type Request, type Response } from 'express';
import {
  getMemoryContext,
  getFailurePatterns,
  backfillFingerprints,
} from './memory.service.js';

const router: RouterType = Router();

// ── Authorization helper ───────────────────────────────

function resolveUser(req: Request, res: Response): string | null {
  const authUserId = (req as any).userId as string;
  const pathUserId = String(req.params.userId);
  if (authUserId !== pathUserId) {
    res.status(403).json({ success: false, error: { message: 'غير مصرح' } });
    return null;
  }
  return authUserId;
}

// ── Routes ──────────────────────────────────────────────

// GET /api/memory/context/:userId?instrument=NQ&timeframe=15m&killzone=nyAM&grade=B
router.get('/context/:userId', (req: Request, res: Response) => {
  const userId = resolveUser(req, res);
  if (!userId) return;
  try {
    const { instrument, timeframe, killzone, grade } = req.query as Record<string, string | undefined>;
    if (!instrument || !timeframe) {
      res.status(400).json({ success: false, error: { message: 'instrument وتimeframe مطلوبان' } });
      return;
    }
    const data = getMemoryContext(userId, instrument, timeframe, killzone ?? null, grade ?? 'C');
    res.json({ success: true, data });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { message: err instanceof Error ? err.message : 'خطأ' } });
  }
});

// GET /api/memory/patterns/:userId?limit=10
router.get('/patterns/:userId', (req: Request, res: Response) => {
  const userId = resolveUser(req, res);
  if (!userId) return;
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? '10'), 10) || 10, 50);
    const data = getFailurePatterns(userId, limit);
    res.json({ success: true, data });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { message: err instanceof Error ? err.message : 'خطأ' } });
  }
});

// POST /api/memory/backfill/:userId
router.post('/backfill/:userId', (req: Request, res: Response) => {
  const userId = resolveUser(req, res);
  if (!userId) return;
  try {
    const inserted = backfillFingerprints(userId);
    res.json({ success: true, data: { inserted } });
  } catch (err: unknown) {
    res.status(500).json({ success: false, error: { message: err instanceof Error ? err.message : 'خطأ' } });
  }
});

export const memoryRoutes: RouterType = router;
