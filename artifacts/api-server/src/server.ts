import { env } from './config/env.js';
import { db } from './db/db.js';
import { backfillFingerprints } from './modules/memory/memory.service.js';
import { createApp } from './app.js';

const app = createApp();

function start(): void {
  db.init();
  console.log('[THEEB MIND] Database initialized');

  // Backfill memory fingerprints for every user's existing decisions (no-op if already done)
  try {
    const users = db.raw.prepare('SELECT id FROM users').all() as { id: string }[];
    for (const u of users) {
      const inserted = backfillFingerprints(u.id);
      if (inserted > 0) console.log(`[THEEB MIND] Memory backfill: ${inserted} fingerprints created`);
    }
  } catch (e) {
    console.warn('[THEEB MIND] Memory backfill skipped:', e instanceof Error ? e.message : 'unknown error');
  }

  if (env.NODE_ENV === 'production' && process.env.ALLOW_REGISTRATION === 'true') {
    console.warn('[THEEB MIND] ALLOW_REGISTRATION=true in production — anyone who can reach the server can create an account');
  }

  app.listen(env.PORT, () => {
    console.log(`[THEEB MIND] Server running on port ${env.PORT}`);
    console.log(`[THEEB MIND] Environment: ${env.NODE_ENV}`);
  });
}

process.on('SIGINT', () => { db.close(); process.exit(0); });
process.on('SIGTERM', () => { db.close(); process.exit(0); });

start();

export { app };
