import type { Request, Response, NextFunction } from 'express';
import { createError } from './error-handler.js';
import { parseCookies, SESSION_COOKIE, userForSession, userForApiKey } from '../modules/auth/auth.service.js';

// Identity is resolved ONLY on the server, from an HttpOnly session cookie (browser) or an
// env-configured API key (scripts). No key is built in, and no userId from the client is trusted.
//
// CSRF: the session cookie is SameSite=Strict, and state-changing cookie requests must carry
// the custom header X-Requested-With (a cross-site form cannot set it without a CORS preflight).

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'];
  if (typeof apiKey === 'string' && apiKey) {
    const user = userForApiKey(apiKey);
    if (!user) { next(createError('Invalid API key', 401, 'INVALID_API_KEY')); return; }
    (req as any).userId = user.id;
    (req as any).authMethod = 'api_key';
    next();
    return;
  }
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  const user = token ? userForSession(token) : null;
  if (!user) { next(createError('Sign in required', 401, 'UNAUTHENTICATED')); return; }
  if (!SAFE.has(req.method) && req.headers['x-requested-with'] !== 'theeb-mind') {
    next(createError('Missing X-Requested-With header', 403, 'CSRF_HEADER_REQUIRED'));
    return;
  }
  (req as any).userId = user.id;
  (req as any).username = user.username;
  (req as any).authMethod = 'session';
  next();
}

export function currentUserId(req: Request): string {
  const id = (req as any).userId;
  if (typeof id !== 'string' || !id) throw createError('Sign in required', 401, 'UNAUTHENTICATED');
  return id;
}
