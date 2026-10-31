import express, { type Express } from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/error-handler.js';
import { rateLimit } from './middleware/rate-limit.js';
import { authMiddleware } from './middleware/auth.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { decisionRoutes } from './modules/decision/decision.routes.js';
import { verifyRoutes } from './modules/verify/verify.routes.js';
import { journalRoutes } from './modules/journal/journal.routes.js';
import { psychologyRoutes } from './modules/psychology/psychology.routes.js';
import { performanceRoutes } from './modules/performance/performance.routes.js';
import { rulesRoutes } from './modules/rules/rules.routes.js';
import { memoryRoutes } from './modules/memory/memory.routes.js';
import { qualityRoutes } from './modules/quality/quality.routes.js';
import { intelligenceRoutes } from './modules/intelligence/intelligence.routes.js';
import { marketRoutes } from './modules/market/market.routes.js';
import { ledgerRoutes } from './modules/ledger/ledger.routes.js';

export function createApp(): Express {
  const app: Express = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // CORS: same-origin by default. Cross-origin access only for origins listed in CORS_ORIGINS.
  const origins = (process.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (origins.length) app.use(cors({ origin: origins, credentials: true }));

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });
  app.use(express.json({ limit: '12mb' }));
  app.use(rateLimit);

  app.get('/health', (_req, res) => { res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.1.0' }); });
  app.get('/api/healthz', (_req, res) => { res.json({ status: 'ok' }); });

  app.use('/api/auth', authRoutes);

  // Everything below requires a server-side identity.
  app.use('/api', authMiddleware);
  app.use('/api/decision', decisionRoutes);
  app.use('/api/verify', verifyRoutes);
  app.use('/api/journal', journalRoutes);
  app.use('/api/psychology', psychologyRoutes);
  app.use('/api/performance', performanceRoutes);
  app.use('/api/rules', rulesRoutes);
  app.use('/api/memory', memoryRoutes);
  app.use('/api/quality', qualityRoutes);
  app.use('/api/intelligence', intelligenceRoutes);
  app.use('/api/market', marketRoutes);
  app.use('/api/ledger', ledgerRoutes);

  app.use(errorHandler);
  return app;
}
