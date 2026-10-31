import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { createError } from '../../middleware/error-handler.js';
import {
  authenticate, createSession, createUser, registrationOpen, hasAnyCredentials, parseCookies, revokeSession,
  sessionCookie, SESSION_COOKIE, SESSION_TTL_MS, userForSession,
} from './auth.service.js';

const router = Router();

const credsSchema = z.object({
  username: z.string().trim().min(3).max(64).regex(/^[A-Za-z0-9_.\-@]+$/, 'letters, digits, _ . - @ only'),
  password: z.string().min(10, 'at least 10 characters').max(200),
  claimLegacyData: z.boolean().optional(),
});

// Login throttling: 5 failures per username+IP per 15 minutes.
const failures = new Map<string, { n: number; until: number }>();
const WINDOW = 15 * 60 * 1000;
function throttled(key: string): boolean { const f = failures.get(key); return Boolean(f && f.n >= 5 && Date.now() < f.until); }
function fail(key: string) { const f = failures.get(key); if (!f || Date.now() > f.until) failures.set(key, { n: 1, until: Date.now() + WINDOW }); else f.n++; }

function requireHeader(req: Request, _res: Response, next: NextFunction) {
  if (req.headers['x-requested-with'] !== 'theeb-mind') { next(createError('Missing X-Requested-With header', 403, 'CSRF_HEADER_REQUIRED')); return; }
  next();
}

router.get('/status', (req, res) => {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  const user = token ? userForSession(token) : null;
  res.json({ success: true, data: { authenticated: Boolean(user), user, bootstrapRequired: !hasAnyCredentials(), registrationOpen: registrationOpen() } });
});

router.post('/register', requireHeader, (req, res, next) => {
  try {
    if (!registrationOpen()) throw createError('Registration is closed', 403, 'REGISTRATION_CLOSED');
    const body = credsSchema.parse(req.body);
    const bootstrap = !hasAnyCredentials();
    // Only the very first account on a server may adopt the legacy single-tenant data ("user-1").
    const user = createUser(body.username, body.password, { claimLegacyUserId: bootstrap && body.claimLegacyData ? 'user-1' : null });
    const s = createSession(user.id);
    res.setHeader('Set-Cookie', sessionCookie(s.token, SESSION_TTL_MS));
    res.status(201).json({ success: true, data: { user } });
  } catch (e) { next(e instanceof z.ZodError ? createError(e.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '), 400, 'VALIDATION_ERROR') : e); }
});

router.post('/login', requireHeader, (req, res, next) => {
  const parsed = z.object({ username: z.string().max(64), password: z.string().max(200) }).safeParse(req.body);
  if (!parsed.success) { next(createError('username and password required', 400, 'VALIDATION_ERROR')); return; }
  const key = `${parsed.data.username}|${req.ip}`;
  if (throttled(key)) { next(createError('Too many failed attempts — try again later', 429, 'LOGIN_THROTTLED')); return; }
  const user = authenticate(parsed.data.username, parsed.data.password);
  if (!user) { fail(key); next(createError('Invalid username or password', 401, 'INVALID_CREDENTIALS')); return; }
  failures.delete(key);
  const s = createSession(user.id);
  res.setHeader('Set-Cookie', sessionCookie(s.token, SESSION_TTL_MS));
  res.json({ success: true, data: { user } });
});

router.post('/logout', requireHeader, (req, res) => {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (token) revokeSession(token);
  res.setHeader('Set-Cookie', sessionCookie('', 0));
  res.json({ success: true, data: { loggedOut: true } });
});

export const authRoutes: Router = router;
