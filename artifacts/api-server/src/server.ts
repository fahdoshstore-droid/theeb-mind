import express, { type Express } from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { db } from './db/db.js';
import { errorHandler } from './middleware/error-handler.js';
import { rateLimit } from './middleware/rate-limit.js';
import { authMiddleware } from './middleware/auth.js';
import { decisionRoutes } from './modules/decision/decision.routes.js';
import { verifyRoutes } from './modules/verify/verify.routes.js';
import { journalRoutes } from './modules/journal/journal.routes.js';
import { psychologyRoutes } from './modules/psychology/psychology.routes.js';
import { performanceRoutes } from './modules/performance/performance.routes.js';
import { rulesRoutes } from './modules/rules/rules.routes.js';
import { memoryRoutes } from './modules/memory/memory.routes.js';
import { backfillFingerprints } from './modules/memory/memory.service.js';

const app: Express = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(rateLimit);

// Health check (no auth required)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// API routes (auth required)
app.use('/api', authMiddleware);
app.use('/api/decision', decisionRoutes);
app.use('/api/verify', verifyRoutes);
app.use('/api/journal', journalRoutes);
app.use('/api/psychology', psychologyRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/rules', rulesRoutes);
app.use('/api/memory', memoryRoutes);

// Error handler
app.use(errorHandler);

// Initialize DB and start server
function start(): void {
  db.init();
  console.log('[THEEB MIND] Database initialized');

  // Backfill memory fingerprints for existing decisions (no-op if already done)
  try {
    const inserted = backfillFingerprints('user-1');
    if (inserted > 0) {
      console.log(`[THEEB MIND] Memory backfill: ${inserted} fingerprints created`);
    }
  } catch (e) {
    console.warn('[THEEB MIND] Memory backfill skipped:', e);
  }

  app.listen(env.PORT, () => {
    console.log(`[THEEB MIND] Server running on port ${env.PORT}`);
    console.log(`[THEEB MIND] Environment: ${env.NODE_ENV}`);
  });
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('[THEEB MIND] Shutting down...');
  db.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('[THEEB MIND] Shutting down...');
  db.close();
  process.exit(0);
});

start();

export { app };