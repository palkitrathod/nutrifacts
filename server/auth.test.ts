// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import http, { type Server } from 'node:http';
import { createApp, SESSION_COOKIE } from './app';
import { DEMO_PASSWORD, openDb, seed, type Db } from './db';
import { RateLimiter } from './rateLimiter';

let db: Db;
let server: Server;
let base: string;

const validSignUp = {
  name: 'Meera Iyer',
  email: 'Meera.Iyer@Example.com',
  phone: '98765 43210',
  password: 'healthy123',
  acceptedTerms: true,
};

async function start(opts: Partial<Parameters<typeof createApp>[0]> = {}) {
  db = openDb(':memory:');
  await seed(db, { demoUsers: true });
  const app = createApp({ db, secureCookies: false, ...opts });
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return fetch(`${base}/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function sessionCookie(res: Response): string | undefined {
  const raw = res.headers.getSetCookie().find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  return raw?.split(';')[0];
}

const me = (cookie?: string) => fetch(`${base}/api/auth/me`, { headers: cookie ? { Cookie: cookie } : {} });

beforeEach(() => start());
afterEach(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe('POST /api/auth/signup', () => {
  it('creates a patient, normalises the data and signs them in', async () => {
    const res = await post('/auth/signup', validSignUp);
    expect(res.status).toBe(201);
    const { user } = await res.json();
    expect(user).toMatchObject({ name: 'Meera Iyer', email: 'meera.iyer@example.com', phone: '+919876543210', role: 'patient' });
    expect(user).not.toHaveProperty('password_hash');

    const raw = res.headers.getSetCookie().join(';');
    expect(raw).toMatch(/HttpOnly/i);
    expect(raw).toMatch(/SameSite=Lax/i);

    const meRes = await me(sessionCookie(res));
    expect(meRes.status).toBe(200);
    expect((await meRes.json()).user.id).toBe(user.id);
  });

  it('never lets a sign-up choose its role', async () => {
    const res = await post('/auth/signup', { ...validSignUp, role: 'dietitian' });
    expect((await res.json()).user.role).toBe('patient');
  });

  it('stores a salted hash, not the password', async () => {
    await post('/auth/signup', validSignUp);
    const row = db.prepare('SELECT password_hash FROM users WHERE email = ?').get('meera.iyer@example.com') as { password_hash: string };
    expect(row.password_hash).not.toContain(validSignUp.password);
    expect(row.password_hash).toMatch(/^scrypt\$/);
  });

  it.each([
    ['name', { name: '' }],
    ['name', { name: 'R2D2' }],
    ['email', { email: 'not-an-email' }],
    ['phone', { phone: '12345' }],
    ['phone', { phone: '' }],
    ['password', { password: 'short1' }],
    ['password', { password: 'onlyletters' }],
    ['password', { password: '1234567890' }],
  ])('rejects an invalid %s (%o)', async (field, override) => {
    const res = await post('/auth/signup', { ...validSignUp, ...override });
    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe('validation_failed');
    expect(error.fields[field]).toBeTruthy();
  });

  it('requires the consent checkbox', async () => {
    const res = await post('/auth/signup', { ...validSignUp, acceptedTerms: false });
    expect(res.status).toBe(400);
    expect((await res.json()).error.fields.acceptedTerms).toBeTruthy();
  });

  it('rejects a duplicate email regardless of case', async () => {
    await post('/auth/signup', validSignUp);
    const res = await post('/auth/signup', { ...validSignUp, email: 'MEERA.IYER@EXAMPLE.COM' });
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe('email_taken');
  });

  it('rejects an email already used by a seeded account', async () => {
    const res = await post('/auth/signup', { ...validSignUp, email: 'priya.sharma@example.com' });
    expect(res.status).toBe(409);
  });

  it('limits sign-ups per network', async () => {
    server.close();
    await start({ signUpLimiter: new RateLimiter({ max: 2, windowMs: 60_000 }) });
    expect((await post('/auth/signup', { ...validSignUp, email: 'a@example.com' })).status).toBe(201);
    expect((await post('/auth/signup', { ...validSignUp, email: 'b@example.com' })).status).toBe(201);
    const res = await post('/auth/signup', { ...validSignUp, email: 'c@example.com' });
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBeTruthy();
  });
});

describe('POST /api/auth/signin', () => {
  it('signs in a seeded account with the right password', async () => {
    const res = await post('/auth/signin', { email: 'Priya.Sharma@example.com ', password: DEMO_PASSWORD });
    expect(res.status).toBe(200);
    expect((await res.json()).user).toMatchObject({ id: 'patient-priya', role: 'patient' });
  });

  it('signs in the dietitian as an admin', async () => {
    const res = await post('/auth/signin', { email: 'anchaldewan380@gmail.com', password: DEMO_PASSWORD });
    expect((await res.json()).user.role).toBe('dietitian');
  });

  it('gives the same answer for a wrong password and an unknown email', async () => {
    const wrong = await post('/auth/signin', { email: 'priya.sharma@example.com', password: 'Wrong@1234' });
    const unknown = await post('/auth/signin', { email: 'nobody@example.com', password: 'Wrong@1234' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(await wrong.json()).toEqual(await unknown.json());
    expect(sessionCookie(wrong)).toBeUndefined();
  });

  it('works for an account created through sign-up', async () => {
    await post('/auth/signup', validSignUp);
    const res = await post('/auth/signin', { email: validSignUp.email, password: validSignUp.password });
    expect(res.status).toBe(200);
  });

  it('"remember me" sets a 30-day cookie; otherwise a browser-session cookie', async () => {
    const remembered = await post('/auth/signin', { email: 'priya.sharma@example.com', password: DEMO_PASSWORD, remember: true });
    expect(remembered.headers.getSetCookie().join(';')).toMatch(/Max-Age=2592000/);

    const sessionOnly = await post('/auth/signin', { email: 'priya.sharma@example.com', password: DEMO_PASSWORD, remember: false });
    expect(sessionOnly.headers.getSetCookie().join(';')).not.toMatch(/Max-Age|Expires/i);
  });

  it('requires email and password', async () => {
    const res = await post('/auth/signin', { email: '', password: '' });
    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(Object.keys(error.fields).sort()).toEqual(['email', 'password']);
  });

  it('locks out after repeated failures, even with the right password, and resets after success', async () => {
    server.close();
    await start({ signInLimiter: new RateLimiter({ max: 3, windowMs: 60_000 }) });
    for (let i = 0; i < 3; i++) {
      expect((await post('/auth/signin', { email: 'priya.sharma@example.com', password: 'Wrong@1234' })).status).toBe(401);
    }
    const locked = await post('/auth/signin', { email: 'priya.sharma@example.com', password: DEMO_PASSWORD });
    expect(locked.status).toBe(429);
    expect((await locked.json()).error.code).toBe('rate_limited');

    // A different account from the same network is not affected.
    expect((await post('/auth/signin', { email: 'rohan.verma@example.com', password: DEMO_PASSWORD })).status).toBe(200);
  });
});

describe('sessions', () => {
  it('/me is 401 without a cookie or with a forged one', async () => {
    expect((await me()).status).toBe(401);
    expect((await me(`${SESSION_COOKIE}=forged-token`)).status).toBe(401);
  });

  it('sign-out destroys the session on the server, not just the cookie', async () => {
    const res = await post('/auth/signin', { email: 'priya.sharma@example.com', password: DEMO_PASSWORD });
    const cookie = sessionCookie(res)!;
    const out = await post('/auth/signout', {}, { Cookie: cookie });
    expect(out.status).toBe(204);
    expect(out.headers.getSetCookie().join(';')).toMatch(new RegExp(`${SESSION_COOKIE}=;`));
    expect((await me(cookie)).status).toBe(401);
  });

  it('expired sessions are rejected', async () => {
    const res = await post('/auth/signin', { email: 'priya.sharma@example.com', password: DEMO_PASSWORD });
    db.prepare('UPDATE sessions SET expires_at = ?').run(Date.now() - 1);
    expect((await me(sessionCookie(res))).status).toBe(401);
  });

  it('stores only a hash of the session token', async () => {
    const res = await post('/auth/signin', { email: 'priya.sharma@example.com', password: DEMO_PASSWORD });
    const token = sessionCookie(res)!.split('=')[1];
    const rows = db.prepare('SELECT token_hash FROM sessions').all() as { token_hash: string }[];
    expect(rows.some((r) => r.token_hash === token)).toBe(false);
  });
});

describe('request hardening', () => {
  it('rejects non-JSON POSTs (blocks cross-site form CSRF)', async () => {
    const res = await fetch(`${base}/api/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'email=priya.sharma%40example.com&password=Demo%401234',
    });
    expect(res.status).toBe(415);
  });

  it('rejects requests from another origin', async () => {
    const res = await post('/auth/signin', { email: 'priya.sharma@example.com', password: DEMO_PASSWORD }, { Origin: 'https://evil.example' });
    expect(res.status).toBe(403);
  });

  it('accepts requests from its own origin', async () => {
    const res = await post('/auth/signin', { email: 'priya.sharma@example.com', password: DEMO_PASSWORD }, { Origin: base });
    expect(res.status).toBe(200);
  });

  it('answers malformed JSON with a 400, not a crash', async () => {
    const res = await post('/auth/signin', '{"email":');
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('bad_json');
  });

  it('handles non-string field values safely', async () => {
    const res = await post('/auth/signin', { email: { $ne: '' }, password: ['x'] });
    expect(res.status).toBe(400);
  });

  it('returns JSON 404s for unknown API routes and sends security headers', async () => {
    const res = await fetch(`${base}/api/nope`);
    expect(res.status).toBe(404);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-powered-by')).toBeNull();
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});

describe('brute-force protection', () => {
  it('a burst of parallel guesses cannot exceed the limit', async () => {
    server.close();
    await start({ signInLimiter: new RateLimiter({ max: 5, windowMs: 60_000 }) });
    const results = await Promise.all(
      Array.from({ length: 20 }, () => post('/auth/signin', { email: 'priya.sharma@example.com', password: 'Wrong@1234' }))
    );
    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 401)).toHaveLength(5);
    expect(statuses.filter((s) => s === 429)).toHaveLength(15);
  });

  it('caps failures per network across many emails (password spraying)', async () => {
    server.close();
    await start({ signInIpLimiter: new RateLimiter({ max: 3, windowMs: 60_000 }) });
    for (let i = 0; i < 3; i++) {
      expect((await post('/auth/signin', { email: `nobody${i}@example.com`, password: 'Wrong@1234' })).status).toBe(401);
    }
    expect((await post('/auth/signin', { email: 'other@example.com', password: 'Wrong@1234' })).status).toBe(429);
  });

  it('ignores X-Forwarded-For unless a proxy is trusted (cannot dodge the limit by faking IPs)', async () => {
    server.close();
    await start({ signInIpLimiter: new RateLimiter({ max: 2, windowMs: 60_000 }) });
    const tries = [];
    for (let i = 0; i < 4; i++) {
      tries.push((await post('/auth/signin', { email: `x${i}@example.com`, password: 'Wrong@1234' }, { 'X-Forwarded-For': `10.0.0.${i}` })).status);
    }
    expect(tries).toEqual([401, 401, 429, 429]);
  });
});

describe('sessions slide while in use', () => {
  it('extends a session that is past half its life', async () => {
    const res = await post('/auth/signin', { email: 'priya.sharma@example.com', password: DEMO_PASSWORD });
    const cookie = sessionCookie(res)!;
    const soon = Date.now() + 60_000;
    db.prepare('UPDATE sessions SET expires_at = ?').run(soon);
    expect((await me(cookie)).status).toBe(200);
    const { expires_at } = db.prepare('SELECT expires_at FROM sessions').get() as { expires_at: number };
    expect(expires_at).toBeGreaterThan(soon + 60 * 60 * 1000);
  });
});

describe('POST /api/auth/password', () => {
  async function signedIn(email = 'priya.sharma@example.com') {
    const res = await post('/auth/signin', { email, password: DEMO_PASSWORD });
    return sessionCookie(res)!;
  }
  const change = (cookie: string, body: object) => post('/auth/password', body, { Cookie: cookie });

  it('requires the current password and a valid, different new one', async () => {
    const cookie = await signedIn();
    expect((await change(cookie, { currentPassword: 'nope', newPassword: 'Fresh12345' })).status).toBe(400);
    expect((await (await change(cookie, { currentPassword: DEMO_PASSWORD, newPassword: 'short' })).json()).error.fields.newPassword).toBeTruthy();
    expect((await change(cookie, { currentPassword: DEMO_PASSWORD, newPassword: DEMO_PASSWORD })).status).toBe(400);
    expect((await post('/auth/password', { currentPassword: DEMO_PASSWORD, newPassword: 'Fresh12345' })).status).toBe(401);
  });

  it('changes the password, keeps this device signed in and signs out the others', async () => {
    const thisDevice = await signedIn();
    const otherDevice = await signedIn();
    expect((await change(thisDevice, { currentPassword: DEMO_PASSWORD, newPassword: 'Fresh12345' })).status).toBe(204);
    expect((await me(thisDevice)).status).toBe(200);
    expect((await me(otherDevice)).status).toBe(401);
    expect((await post('/auth/signin', { email: 'priya.sharma@example.com', password: DEMO_PASSWORD })).status).toBe(401);
    expect((await post('/auth/signin', { email: 'priya.sharma@example.com', password: 'Fresh12345' })).status).toBe(200);
  });
});

describe('POST /api/admin/patients/:id/reset-password', () => {
  const reset = (cookie: string, id: string) => post(`/admin/patients/${id}/reset-password`, {}, { Cookie: cookie });

  it('only the dietitian can reset, only for patients', async () => {
    const patient = sessionCookie(await post('/auth/signin', { email: 'rohan.verma@example.com', password: DEMO_PASSWORD }))!;
    expect((await reset(patient, 'patient-priya')).status).toBe(403);
    const admin = sessionCookie(await post('/auth/signin', { email: 'anchaldewan380@gmail.com', password: DEMO_PASSWORD }))!;
    expect((await reset(admin, 'dietitian-anchal')).status).toBe(404);
    expect((await reset(admin, 'nope')).status).toBe(404);
  });

  it('gives a working temporary password and signs the patient out everywhere', async () => {
    const priyaSession = sessionCookie(await post('/auth/signin', { email: 'priya.sharma@example.com', password: DEMO_PASSWORD }))!;
    const admin = sessionCookie(await post('/auth/signin', { email: 'anchaldewan380@gmail.com', password: DEMO_PASSWORD }))!;
    const res = await reset(admin, 'patient-priya');
    expect(res.status).toBe(200);
    const { temporaryPassword } = await res.json();
    expect(temporaryPassword).toMatch(/^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/);
    expect((await me(priyaSession)).status).toBe(401);
    expect((await post('/auth/signin', { email: 'priya.sharma@example.com', password: DEMO_PASSWORD })).status).toBe(401);
    expect((await post('/auth/signin', { email: 'priya.sharma@example.com', password: temporaryPassword })).status).toBe(200);
  });
});

describe('deployment safety', () => {
  function rawPost(path: string, headers: Record<string, string>, body: object) {
    return new Promise<{ status: number; body: any }>((resolve, reject) => {
      const data = JSON.stringify(body);
      const url = new URL(base);
      const req = http.request(
        { host: url.hostname, port: url.port, path: `/api${path}`, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers } },
        (res) => {
          let text = '';
          res.on('data', (c) => (text += c));
          res.on('end', () => resolve({ status: res.statusCode!, body: JSON.parse(text || '{}') }));
        }
      );
      req.on('error', reject);
      req.end(data);
    });
  }

  it('behind a trusted proxy, the public host (X-Forwarded-Host) is accepted as the origin', async () => {
    server.close();
    await start({ trustProxy: true });
    const res = await rawPost(
      '/auth/signin',
      { Host: '127.0.0.1:9999', Origin: 'https://app.nutrifacts.in', 'X-Forwarded-Host': 'app.nutrifacts.in', 'X-Forwarded-Proto': 'https' },
      { email: 'priya.sharma@example.com', password: DEMO_PASSWORD }
    );
    expect(res.status).toBe(200);
  });

  it('a configured public origin is accepted even if the proxy rewrites Host', async () => {
    server.close();
    await start({ publicOrigins: ['https://app.nutrifacts.in'] });
    const ok = await rawPost('/auth/signin', { Host: '127.0.0.1:9999', Origin: 'https://app.nutrifacts.in' }, { email: 'priya.sharma@example.com', password: DEMO_PASSWORD });
    expect(ok.status).toBe(200);
    const bad = await rawPost('/auth/signin', { Host: '127.0.0.1:9999', Origin: 'https://evil.example' }, { email: 'priya.sharma@example.com', password: DEMO_PASSWORD });
    expect(bad.status).toBe(403);
  });

  it('refuses sign-in over plain http when secure cookies are on (instead of a silent failure)', async () => {
    server.close();
    await start({ secureCookies: true });
    const res = await rawPost('/auth/signin', { Host: 'app.nutrifacts.in' }, { email: 'priya.sharma@example.com', password: DEMO_PASSWORD });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('insecure_connection');
  });

  it('sends a Content-Security-Policy in production mode', async () => {
    server.close();
    await start({ strictHeaders: true });
    const res = await fetch(`${base}/api/auth/me`);
    expect(res.headers.get('content-security-policy')).toContain("default-src 'self'");
  });
});
