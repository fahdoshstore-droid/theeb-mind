import type { Request, Response, NextFunction } from 'express';
import { createError } from './error-handler.js';
import { db } from '../db/db.js';

// ── Key registry ────────────────────────────────────────────────────────────
// Maps API key → userId. userId is looked up from this server-side registry;
// it is NEVER derived from the key itself, preventing IDOR via crafted prefixes.
//
// Production: set THEEB_API_KEYS="key1:userId1,key2:userId2" in env.
// Development: the dev key below is always available.

function buildKeyRegistry(): Map<string, string> {
  const registry = new Map<string, string>();

  // Dev key — only active outside production to prevent known-credential exposure
  if (process.env.NODE_ENV !== 'production') {
    registry.set('user-1_devkey', 'user-1');
  }

  // Env-configurable keys (production)
  const envKeys = process.env.THEEB_API_KEYS;
  if (envKeys) {
    for (const pair of envKeys.split(',')) {
      const [key, uid] = pair.split(':');
      if (key && uid) registry.set(key.trim(), uid.trim());
    }
  }

  return registry;
}

const KEY_REGISTRY = buildKeyRegistry();

// ── Middleware ───────────────────────────────────────────────────────────────

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string | undefined;

  if (!apiKey) {
    next(createError('مفتاح API مطلوب — أضف X-API-Key في الرأس', 401, 'MISSING_API_KEY'));
    return;
  }

  // Look up key in the server-side registry — userId is NEVER derived from the key string
  const userId = KEY_REGISTRY.get(apiKey);
  if (!userId) {
    next(createError('مفتاح API غير صالح', 401, 'INVALID_API_KEY'));
    return;
  }

  // Bind immutable auth identity to request
  (req as any).userId = userId;

  // Auto-upsert user row so FK constraints are always satisfied
  db.raw
    .prepare(`INSERT OR IGNORE INTO users (id, username) VALUES (?, ?)`)
    .run(userId, userId);

  next();
}
