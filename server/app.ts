import crypto from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import { users, type Db, type UserRow } from './db';
import { hashPassword, verifyPassword, getDummyHash, ServerBusyError } from './passwords';
import { RateLimiter } from './rateLimiter';
import { createPatientProfile, registerDataRoutes } from './data';
import {
  normalizeEmail,
  normalizeName,
  normalizePhone,
  validatePassword,
  validateSignIn,
  validateSignUp,
} from '../src/shared/authValidation';

export const SESSION_COOKIE = 'nf_session';
const DAY = 24 * 60 * 60 * 1000;
const REMEMBER_ME_TTL = 30 * DAY;
const DEFAULT_TTL = 1 * DAY;

export interface AppOptions {
  db: Db;
  secureCookies: boolean;
  /**
   * Express "trust proxy" setting. Leave unset when browsers connect directly (then
   * X-Forwarded-* headers are ignored and can't be spoofed); set it to the number of proxies
   * (e.g. 1) when the site is behind a load balancer / reverse proxy.
   */
  trustProxy?: boolean | number | string;
  /** Extra origins allowed to POST, e.g. "https://app.nutrifacts.in" when a proxy rewrites Host. */
  publicOrigins?: string[];
  /** Send Content-Security-Policy / HSTS (production). */
  strictHeaders?: boolean;
  /** Overridable so tests can exercise lockout without waiting. */
  signInLimiter?: RateLimiter;
  signInIpLimiter?: RateLimiter;
  signUpLimiter?: RateLimiter;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/** Readable temporary password, e.g. "Kp7m-Rw2x-Tq9d" (always has letters and digits). */
function temporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const group = () =>
    [alphabet, digits, alphabet, alphabet].map((set) => set[crypto.randomInt(set.length)]).join('');
  return `${group()}-${group()}-${group()}`;
}

export type PublicUser = Pick<UserRow, 'id' | 'name' | 'email' | 'phone' | 'role'> & { createdAt: string };

const toPublic = (u: UserRow): PublicUser => ({
  id: u.id,
  name: u.name,
  email: u.email,
  phone: u.phone,
  role: u.role,
  createdAt: u.created_at,
});

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

function sendError(res: Response, status: number, code: string, message: string, fields?: Record<string, string>) {
  res.status(status).json({ error: { code, message, ...(fields && { fields }) } });
}

export function createApp(opts: AppOptions) {
  const { db } = opts;
  // Per account (+ network): 10 password checks per 15 minutes.
  const signInLimiter = opts.signInLimiter ?? new RateLimiter({ max: 10, windowMs: 15 * 60 * 1000 });
  // Per network, across all accounts (stops password spraying): 50 failures per 15 minutes.
  const signInIpLimiter = opts.signInIpLimiter ?? new RateLimiter({ max: 50, windowMs: 15 * 60 * 1000 });
  // Generous enough for a clinic registering patients at reception over one shared Wi-Fi.
  const signUpLimiter = opts.signUpLimiter ?? new RateLimiter({ max: 20, windowMs: 60 * 60 * 1000 });

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', opts.trustProxy ?? false);

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    if (opts.strictHeaders) {
      res.setHeader(
        'Content-Security-Policy',
        [
          "default-src 'self'",
          "script-src 'self'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob: https://images.unsplash.com",
          "font-src 'self'",
          "connect-src 'self'",
          "frame-src 'self' data: blob:",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
          "frame-ancestors 'none'",
        ].join('; ')
      );
      if (opts.secureCookies) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  const api = express.Router();
  api.use(cookieParser());
  // Auth bodies are tiny; data saves can include an uploaded diet-chart PDF.
  const smallJson = express.json({ limit: '10kb' });
  const largeJson = express.json({ limit: '25mb' });
  api.use((req, res, next) => (req.path === '/data/batch' ? largeJson : smallJson)(req, res, next));
  api.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  // CSRF defence: state-changing requests must be JSON (which a cross-site <form> cannot send)
  // and, when the browser reports an Origin, it must be this site.
  api.use((req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD') return next();
    if (!req.is('application/json')) return sendError(res, 415, 'unsupported_media_type', 'Requests must be sent as JSON.');
    const origin = req.get('origin');
    if (origin) {
      let host: string | undefined;
      try { host = new URL(origin).host; } catch { /* malformed origin */ }
      const allowedHosts = [
        req.get('host'),
        // Behind a trusted proxy that rewrites Host, the public host arrives as X-Forwarded-Host.
        opts.trustProxy ? req.get('x-forwarded-host')?.split(',')[0].trim() : undefined,
      ];
      const ok = (host && allowedHosts.includes(host)) || opts.publicOrigins?.includes(origin);
      if (!ok) return sendError(res, 403, 'bad_origin', 'Cross-site request blocked.');
    }
    next();
  });

  // A Secure cookie sent over plain http is silently dropped by browsers, which would make every
  // sign-in look successful and then fail. Refuse clearly instead (localhost is exempt).
  let warnedInsecure = false;
  const insecureForCookies = (req: Request) => {
    if (!opts.secureCookies || req.secure || LOCAL_HOSTS.has(req.hostname)) return false;
    if (!warnedInsecure) {
      warnedInsecure = true;
      console.warn('Sign-in refused over http while COOKIE_SECURE is on. Serve over HTTPS (and set TRUST_PROXY behind a proxy).');
    }
    return true;
  };

  const setSessionCookie = (res: Response, token: string, ttl: number) =>
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: opts.secureCookies,
      sameSite: 'lax',
      path: '/',
      // Without "remember me" the cookie ends with the browser session (and the server caps it).
      ...(ttl === REMEMBER_ME_TTL && { maxAge: ttl }),
    });

  function startSession(res: Response, userId: string, remember: boolean) {
    const token = crypto.randomBytes(32).toString('base64url');
    const now = Date.now();
    const ttl = remember ? REMEMBER_ME_TTL : DEFAULT_TTL;
    db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at, ttl) VALUES (?, ?, ?, ?, ?)')
      .run(sha256(token), userId, now, now + ttl, ttl);
    setSessionCookie(res, token, ttl);
  }

  /**
   * The signed-in user, or undefined. Sessions slide: once half their time has passed, use extends
   * them (and refreshes a "remember me" cookie), so nobody is cut off mid-use.
   */
  function currentUser(req: Request, res?: Response): UserRow | undefined {
    const token = req.cookies?.[SESSION_COOKIE];
    if (typeof token !== 'string' || !token) return undefined;
    const hash = sha256(token);
    const row = db.prepare('SELECT user_id, expires_at, ttl FROM sessions WHERE token_hash = ?').get(hash) as
      | { user_id: string; expires_at: number; ttl: number }
      | undefined;
    if (!row) return undefined;
    const now = Date.now();
    if (row.expires_at < now) {
      db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hash);
      return undefined;
    }
    if (res && row.expires_at - now < row.ttl / 2) {
      db.prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?').run(now + row.ttl, hash);
      setSessionCookie(res, token, row.ttl);
    }
    return users.byId(db, row.user_id);
  }

  const revokeSessions = (userId: string, exceptToken?: string) =>
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').run(userId, exceptToken ? sha256(exceptToken) : '');

  const busy = (res: Response) => {
    res.setHeader('Retry-After', '5');
    sendError(res, 503, 'busy', 'We are busy right now. Please try again in a few seconds.');
  };

  const clientKey = (req: Request) => req.ip ?? 'unknown';

  api.post('/auth/signup', async (req, res, next) => {
    try {
      const body = req.body ?? {};
      const input = {
        name: String(body.name ?? ''),
        email: String(body.email ?? ''),
        phone: String(body.phone ?? ''),
        password: String(body.password ?? ''),
      };

      const fields = validateSignUp(input);
      if (Object.keys(fields).length) {
        return sendError(res, 400, 'validation_failed', 'Please correct the highlighted fields.', fields as Record<string, string>);
      }
      if (body.acceptedTerms !== true) {
        return sendError(res, 400, 'validation_failed', 'Please accept the terms to continue.', {
          acceptedTerms: 'Please accept the terms to continue.',
        });
      }

      if (insecureForCookies(req)) {
        return sendError(res, 400, 'insecure_connection', 'Please open this site over a secure (https) connection to sign up.');
      }

      const limit = signUpLimiter.hit(clientKey(req));
      if (!limit.allowed) {
        res.setHeader('Retry-After', String(limit.retryAfterSec));
        return sendError(res, 429, 'rate_limited', 'Too many accounts created from this network. Please try again later.');
      }

      const email = normalizeEmail(input.email);
      if (users.byEmail(db, email)) {
        return sendError(res, 409, 'email_taken', 'An account with this email already exists.', {
          email: 'An account with this email already exists. Sign in instead?',
        });
      }

      const user = users.insert(db, {
        id: `patient-${crypto.randomUUID()}`,
        name: normalizeName(input.name),
        email,
        phone: normalizePhone(input.phone)!,
        role: 'patient', // self sign-up can only ever create patients
        password_hash: await hashPassword(input.password),
      });

      createPatientProfile(db, user);
      startSession(res, user.id, body.remember !== false);
      res.status(201).json({ user: toPublic(user) });
    } catch (err) {
      if (err instanceof ServerBusyError) return busy(res);
      // Two simultaneous sign-ups with the same email: the UNIQUE constraint is the final word.
      if (err instanceof Error && /UNIQUE constraint failed: users\.email/.test(err.message)) {
        return sendError(res, 409, 'email_taken', 'An account with this email already exists.', {
          email: 'An account with this email already exists. Sign in instead?',
        });
      }
      next(err);
    }
  });

  api.post('/auth/signin', async (req, res, next) => {
    try {
      const body = req.body ?? {};
      const input = { email: String(body.email ?? ''), password: String(body.password ?? '') };
      const fields = validateSignIn(input);
      if (Object.keys(fields).length) {
        return sendError(res, 400, 'validation_failed', 'Please correct the highlighted fields.', fields as Record<string, string>);
      }

      if (insecureForCookies(req)) {
        return sendError(res, 400, 'insecure_connection', 'Please open this site over a secure (https) connection to sign in.');
      }

      const email = normalizeEmail(input.email);
      const key = `${clientKey(req)}|${email}`;
      const tooMany = (retryAfterSec: number) => {
        res.setHeader('Retry-After', String(retryAfterSec));
        return sendError(res, 429, 'rate_limited', `Too many failed attempts. Try again in ${Math.ceil(retryAfterSec / 60)} minute(s).`);
      };
      const ipBlocked = signInIpLimiter.check(clientKey(req));
      if (!ipBlocked.allowed) return tooMany(ipBlocked.retryAfterSec);
      // Counted *before* the password is checked, so parallel requests can't all slip through.
      const attempt = signInLimiter.hit(key);
      if (!attempt.allowed) return tooMany(attempt.retryAfterSec);

      const user = users.byEmail(db, email);
      const ok = await verifyPassword(input.password, user?.password_hash ?? (await getDummyHash()));
      if (!user || !ok) {
        signInIpLimiter.hit(clientKey(req));
        return sendError(res, 401, 'invalid_credentials', 'Incorrect email or password.');
      }

      signInLimiter.reset(key);
      startSession(res, user.id, body.remember === true);
      res.json({ user: toPublic(user) });
    } catch (err) {
      if (err instanceof ServerBusyError) return busy(res);
      next(err);
    }
  });

  // Signed-in user changes their own password; their other devices are signed out.
  api.post('/auth/password', async (req, res, next) => {
    try {
      const user = currentUser(req);
      if (!user) return sendError(res, 401, 'unauthenticated', 'You are not signed in.');
      const current = String(req.body?.currentPassword ?? '');
      const next_ = String(req.body?.newPassword ?? '');

      const attempt = signInLimiter.hit(`password|${user.id}`);
      if (!attempt.allowed) {
        res.setHeader('Retry-After', String(attempt.retryAfterSec));
        return sendError(res, 429, 'rate_limited', `Too many attempts. Try again in ${Math.ceil(attempt.retryAfterSec / 60)} minute(s).`);
      }
      if (!(await verifyPassword(current, user.password_hash))) {
        return sendError(res, 400, 'validation_failed', 'Your current password is incorrect.', {
          currentPassword: 'Your current password is incorrect.',
        });
      }
      const problem = validatePassword(next_);
      if (problem) return sendError(res, 400, 'validation_failed', problem, { newPassword: problem });
      if (next_ === current) {
        return sendError(res, 400, 'validation_failed', 'Choose a password different from your current one.', {
          newPassword: 'Choose a password different from your current one.',
        });
      }

      users.setPassword(db, user.id, await hashPassword(next_));
      revokeSessions(user.id, req.cookies?.[SESSION_COOKIE]);
      signInLimiter.reset(`password|${user.id}`);
      res.status(204).end();
    } catch (err) {
      if (err instanceof ServerBusyError) return busy(res);
      next(err);
    }
  });

  // The dietitian resets a patient's forgotten password: a temporary one is returned to share with
  // the patient (e.g. on WhatsApp), and all the patient's existing sessions are ended.
  api.post('/admin/patients/:id/reset-password', async (req, res, next) => {
    try {
      const admin = currentUser(req);
      if (!admin) return sendError(res, 401, 'unauthenticated', 'You are not signed in.');
      if (admin.role !== 'dietitian') return sendError(res, 403, 'forbidden', 'Only the clinic can reset passwords.');
      const patient = users.byId(db, req.params.id);
      if (!patient || patient.role !== 'patient') return sendError(res, 404, 'not_found', 'Patient not found.');

      const temporary = temporaryPassword();
      users.setPassword(db, patient.id, await hashPassword(temporary));
      revokeSessions(patient.id);
      res.json({ temporaryPassword: temporary, email: patient.email });
    } catch (err) {
      if (err instanceof ServerBusyError) return busy(res);
      next(err);
    }
  });

  api.post('/auth/signout', (req, res) => {
    const token = req.cookies?.[SESSION_COOKIE];
    if (typeof token === 'string' && token) {
      db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
    }
    res.clearCookie(SESSION_COOKIE, { httpOnly: true, secure: opts.secureCookies, sameSite: 'lax', path: '/' });
    res.status(204).end();
  });

  api.get('/auth/me', (req, res) => {
    const user = currentUser(req, res);
    if (!user) return sendError(res, 401, 'unauthenticated', 'You are not signed in.');
    res.json({ user: toPublic(user) });
  });

  registerDataRoutes(api, { db, currentUser, sendError });

  api.use((_req, res) => sendError(res, 404, 'not_found', 'Not found.'));

  // Malformed JSON, oversized bodies and unexpected failures all end here.
  api.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const e = err as { type?: string; status?: number };
    if (e?.type === 'entity.parse.failed') return sendError(res, 400, 'bad_json', 'The request body is not valid JSON.');
    if (e?.type === 'entity.too.large') return sendError(res, 413, 'too_large', 'The request is too large.');
    console.error(err);
    sendError(res, 500, 'server_error', 'Something went wrong on our side. Please try again.');
  });

  app.use('/api', api);

  // Housekeeping: drop expired sessions once an hour.
  const sweep = setInterval(() => db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now()), 60 * 60 * 1000);
  sweep.unref();

  return app;
}
