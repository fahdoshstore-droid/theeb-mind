import type { Request, Response, NextFunction } from 'express';
import { createError } from './error-handler.js';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const store = new Map<string, RateLimitEntry>();

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 60; // 60 requests per minute

export function rateLimit(req: Request, _res: Response, next: NextFunction): void {
  const key = req.ip || 'unknown';
  const now = Date.now();

  const entry = store.get(key);

  if (!entry || now > entry.resetTime) {
    store.set(key, { count: 1, resetTime: now + WINDOW_MS });
    next();
    return;
  }

  if (entry.count >= MAX_REQUESTS) {
    next(createError('تجاوزت حد الطلبات — حاول مرة أخرى بعد دقيقة', 429, 'RATE_LIMIT_EXCEEDED'));
    return;
  }

  entry.count++;
  next();
}

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetTime) {
      store.delete(key);
    }
  }
}, WINDOW_MS);