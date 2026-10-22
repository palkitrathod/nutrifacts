// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import http, { type Server } from 'node:http';
import { createApp, SESSION_COOKIE } from './app';
import { DEMO_PASSWORD, openDb, seed, type Db } from './db';
import { RateLimiter } from './rateLimiter';
import type { MailMessage, Mailer } from './mailer';
import fs from 'node:fs';

let db: Db;
let server: Server;
let base: string;
let sent: MailMessage[];
let mailFails = false;

const testMailer: Mailer = {
  async send(message) {
    if (mailFails) throw new Error('SMTP down');
    sent.push(message);
  },
};

/** The code in the latest email sent to this address. */
function lastCode(email: string): string {
  const mail = sent.filter((m) => m.to === email.toLowerCase()).at(-1);
  if (!mail) throw new Error(`No email sent to ${email}`);
  return mail.text.match(/email address: (\d{6})/)![1];
}

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
  sent = [];
  mailFails = false;
  const app = createApp({ db, secureCookies: false, mailer: testMailer, ...opts });
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
    const body = await res.json();
    const { user } = body;
    expect(user).toMatchObject({ name: 'Meera Iyer', email: 'meera.iyer@example.com', phone: '+919876543210', role: 'patient' });
    expect(user).not.toHaveProperty('password_hash');
    expect(user.emailVerified).toBe(false);
    expect(body.codeSent).toBe(true);

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

  it('rejects a duplicate of a verified email regardless of case', async () => {
    const first = await post('/auth/signup', validSignUp);
    await post('/auth/verify-email', { code: lastCode(validSignUp.email) }, { Cookie: sessionCookie(first)! });
    const res = await post('/auth/signup', { ...validSignUp, email: 'MEERA.IYER@EXAMPLE.COM' });
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe('email_taken');
  });

  it('lets a new sign-up take over an email whose account was never verified', async () => {
    const first = await post('/auth/signup', validSignUp);
    const firstId = (await first.json()).user.id;
    const second = await post('/auth/signup', { ...validSignUp, name: 'Real Meera', password: 'another123' });
    expect(second.status).toBe(201);
    expect((await second.json()).user.id).not.toBe(firstId);
    // The abandoned account and its session are gone.
    expect((await me(sessionCookie(first))).status).toBe(401);
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

describe('email verification', () => {
  async function signUp(override: Partial<typeof validSignUp> = {}) {
    const res = await post('/auth/signup', { ...validSignUp, ...override });
    expect(res.status).toBe(201);
    return sessionCookie(res)!;
  }
  const verify = (cookie: string, code: unknown) => post('/auth/verify-email', { code }, { Cookie: cookie });
  const resend = (cookie: string) => post('/auth/verify-email/resend', {}, { Cookie: cookie });
  const data = (cookie: string) => fetch(`${base}/api/data`, { headers: { Cookie: cookie } });

  it('emails a 6-digit code on sign-up, never in the subject or inbox preview', async () => {
    await signUp();
    expect(sent).toHaveLength(1);
    const [mail] = sent;
    const code = lastCode(validSignUp.email);
    expect(mail.to).toBe('meera.iyer@example.com');
    expect(mail.subject).toBe('Verify your email address');
    expect(mail.html).toContain('Hi Meera,');
    expect(mail.html).toContain(`>${code}</div>`);
    expect(mail.text).toContain(code);
    const preview = mail.html.match(/<div style="display:none[^>]*>([^<]*)</)![1];
    expect(preview).not.toMatch(/\d{6}/);
    // Images are attached inline (no "load images" prompt) and exist on disk.
    expect(mail.attachments?.map((a) => a.cid)).toEqual(['nf-header', 'nf-dietitian']);
    for (const a of mail.attachments!) {
      expect(mail.html).toContain(`cid:${a.cid}`);
      expect(fs.existsSync(a.path)).toBe(true);
    }
  });

  it('escapes the name in the email', async () => {
    await signUp({ name: "D'Souza Meera" });
    expect(sent[0].html).toContain('Hi D&#39;Souza,');
    expect(sent[0].text).toContain("Hi D'Souza,");
  });

  it('keeps app data locked until the email is verified', async () => {
    const cookie = await signUp();
    const locked = await data(cookie);
    expect(locked.status).toBe(403);
    expect((await locked.json()).error.code).toBe('email_unverified');

    const res = await verify(cookie, lastCode(validSignUp.email));
    expect(res.status).toBe(200);
    expect((await res.json()).user.emailVerified).toBe(true);
    expect((await data(cookie)).status).toBe(200);
    expect((await (await me(cookie)).json()).user.emailVerified).toBe(true);
  });

  it('accepts a code typed with spaces', async () => {
    const cookie = await signUp();
    const code = lastCode(validSignUp.email);
    expect((await verify(cookie, `${code.slice(0, 3)} ${code.slice(3)}`)).status).toBe(200);
  });

  it('rejects a wrong code, counting down the tries, then locks the code', async () => {
    const cookie = await signUp();
    const right = lastCode(validSignUp.email);
    const wrong = right === '000000' ? '111111' : '000000';
    for (let left = 4; left >= 1; left--) {
      const res = await verify(cookie, wrong);
      expect(res.status).toBe(400);
      const { error } = await res.json();
      expect(error.code).toBe('invalid_code');
      expect(error.fields.code).toContain(`${left} ${left === 1 ? 'try' : 'tries'} left`);
    }
    expect((await verify(cookie, wrong)).status).toBe(429);
    // Even the right code no longer works: a new one has to be requested.
    const locked = await verify(cookie, right);
    expect(locked.status).toBe(429);
    expect((await locked.json()).error.code).toBe('too_many_attempts');
  });

  it('rejects malformed codes without using up a try', async () => {
    const cookie = await signUp();
    for (const bad of ['', '12345', '1234567', 'abcdef', null]) {
      const res = await verify(cookie, bad);
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe('validation_failed');
    }
    expect((await verify(cookie, lastCode(validSignUp.email))).status).toBe(200);
  });

  it('rejects an expired code', async () => {
    const cookie = await signUp();
    db.prepare('UPDATE email_codes SET expires_at = ?').run(Date.now() - 1);
    const res = await verify(cookie, lastCode(validSignUp.email));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('code_expired');
  });

  it('sends a fresh code on resend, and the old code stops working', async () => {
    const cookie = await signUp();
    const first = lastCode(validSignUp.email);

    const tooSoon = await resend(cookie);
    expect(tooSoon.status).toBe(429);
    expect((await tooSoon.json()).error.code).toBe('resend_too_soon');
    expect(Number(tooSoon.headers.get('retry-after'))).toBeGreaterThan(0);

    db.prepare('UPDATE email_codes SET sent_at = sent_at - 61000').run();
    const res = await resend(cookie);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sentTo: 'meera.iyer@example.com', resendAfterSec: 60 });
    expect(sent).toHaveLength(2);

    let second = lastCode(validSignUp.email);
    // A fresh code is random, so it can (rarely) repeat; resend until it differs to test invalidation.
    while (second === first) {
      db.prepare('UPDATE email_codes SET sent_at = sent_at - 61000').run();
      await resend(cookie);
      second = lastCode(validSignUp.email);
    }
    expect((await verify(cookie, first)).status).toBe(400);
    expect((await verify(cookie, second)).status).toBe(200);
  });

  it('limits how many codes an account can request per hour', async () => {
    server.close();
    await start({ resendCodeLimiter: new RateLimiter({ max: 2, windowMs: 60_000 }) });
    const cookie = await signUp();
    for (let i = 0; i < 2; i++) {
      db.prepare('UPDATE email_codes SET sent_at = sent_at - 61000').run();
      expect((await resend(cookie)).status).toBe(200);
    }
    db.prepare('UPDATE email_codes SET sent_at = sent_at - 61000').run();
    const res = await resend(cookie);
    expect(res.status).toBe(429);
    expect((await res.json()).error.code).toBe('rate_limited');
  });

  it('still creates the account when the email fails, and resend can be retried at once', async () => {
    mailFails = true;
    const res = await post('/auth/signup', validSignUp);
    expect(res.status).toBe(201);
    expect((await res.json()).codeSent).toBe(false);
    const cookie = sessionCookie(res)!;

    const failed = await resend(cookie);
    expect(failed.status).toBe(503);
    expect((await failed.json()).error.code).toBe('email_failed');

    mailFails = false;
    expect((await resend(cookie)).status).toBe(200);
    expect((await verify(cookie, lastCode(validSignUp.email))).status).toBe(200);
  });

  it('signing in to an unverified account sends a new code (unless one was just sent)', async () => {
    await signUp();
    const signIn = () => post('/auth/signin', { email: validSignUp.email, password: validSignUp.password });

    const soon = await signIn();
    expect(soon.status).toBe(200);
    expect((await soon.json()).user.emailVerified).toBe(false);
    expect(sent).toHaveLength(1); // the sign-up code is still fresh

    db.prepare('UPDATE email_codes SET sent_at = sent_at - 61000').run();
    const later = await signIn();
    expect((await later.json()).codeSent).toBe(true);
    expect(sent).toHaveLength(2);
  });

  it('only adds the patient to the clinic list once verified', async () => {
    const cookie = await signUp();
    const count = () => (db.prepare("SELECT COUNT(*) AS n FROM records WHERE collection = 'patients'").get() as { n: number }).n;
    const before = count();
    await verify(cookie, lastCode(validSignUp.email));
    expect(count()).toBe(before + 1);
  });

  it('needs a session, and is a no-op for accounts that are already verified', async () => {
    expect((await post('/auth/verify-email', { code: '123456' })).status).toBe(401);
    expect((await post('/auth/verify-email/resend', {})).status).toBe(401);

    const priya = sessionCookie(await post('/auth/signin', { email: 'priya.sharma@example.com', password: DEMO_PASSWORD }))!;
    expect((await (await me(priya)).json()).user.emailVerified).toBe(true);
    expect((await verify(priya, '000000')).status).toBe(200);
    expect((await resend(priya)).status).toBe(409);
    expect(sent).toHaveLength(0);
  });

  it('stores only a hash of the code', async () => {
    await signUp();
    const row = db.prepare('SELECT code_hash FROM email_codes').get() as { code_hash: string };
    expect(row.code_hash).not.toContain(lastCode(validSignUp.email));
    expect(row.code_hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('database migration', () => {
  it('treats accounts created before email verification existed as verified', async () => {
    const os = await import('node:os');
    const path = await import('node:path');
    const fs = await import('node:fs');
    const { DatabaseSync } = await import('node:sqlite');
    const file = path.join(os.tmpdir(), `nf-migrate-${Date.now()}.db`);
    const old = new DatabaseSync(file);
    old.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      phone TEXT NOT NULL, role TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT 'x');
      INSERT INTO users (id, name, email, phone, role, password_hash) VALUES ('patient-old', 'Old', 'old@example.com', '+91', 'patient', 'h');`);
    old.close();
    const migrated = openDb(file);
    const row = migrated.prepare('SELECT email_verified_at FROM users WHERE id = ?').get('patient-old') as { email_verified_at: string | null };
    expect(row.email_verified_at).toBeTruthy();
    migrated.close();
    fs.rmSync(file, { force: true });
    fs.rmSync(`${file}-wal`, { force: true });
    fs.rmSync(`${file}-shm`, { force: true });
  });
});

describe('my profile: account details', () => {
  /** A signed-up, verified patient (so their profile record exists). Returns the session cookie. */
  async function verifiedPatient() {
    const res = await post('/auth/signup', validSignUp);
    const cookie = sessionCookie(res)!;
    expect((await post('/auth/verify-email', { code: lastCode(validSignUp.email) }, { Cookie: cookie })).status).toBe(200);
    sent = [];
    return cookie;
  }
  const profileRecord = () =>
    JSON.parse((db.prepare("SELECT data FROM records WHERE collection = 'patients' AND id = (SELECT id FROM users WHERE name LIKE 'Meera%' OR email LIKE '%meera%')").get() as { data: string }).data);
  const changeEmailCode = (to: string) => {
    const mail = sent.filter((m) => m.to === to).at(-1)!;
    return mail.text.match(/email address: (\d{6})/)![1];
  };

  it('needs a verified session', async () => {
    expect((await post('/account/profile', { name: 'X', phone: '9876543210' })).status).toBe(401);
    const unverified = sessionCookie(await post('/auth/signup', { ...validSignUp, email: 'new@example.com' }))!;
    const res = await post('/account/profile', { name: 'New Name', phone: '9876543210' }, { Cookie: unverified });
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('email_unverified');
    expect((await post('/account/email', { newEmail: 'x@example.com', currentPassword: 'healthy123' }, { Cookie: unverified })).status).toBe(403);
  });

  it('updates name and mobile, normalised, on the account and the patient record', async () => {
    const cookie = await verifiedPatient();
    const res = await post('/account/profile', { name: '  Meera   Krishnan ', phone: '098765 11111' }, { Cookie: cookie });
    expect(res.status).toBe(200);
    expect((await res.json()).user).toMatchObject({ name: 'Meera Krishnan', phone: '+919876511111' });
    expect((await (await me(cookie)).json()).user.name).toBe('Meera Krishnan');
    expect(profileRecord()).toMatchObject({ name: 'Meera Krishnan', phone: '+91 98765 11111' });
  });

  it('rejects an invalid name or mobile', async () => {
    const cookie = await verifiedPatient();
    const res = await post('/account/profile', { name: 'R2D2', phone: '123' }, { Cookie: cookie });
    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(Object.keys(error.fields).sort()).toEqual(['name', 'phone']);
  });

  it('the profile record cannot change the name or email behind the account’s back', async () => {
    const cookie = await verifiedPatient();
    const record = profileRecord();
    const res = await post('/data/batch', { ops: [{ collection: 'patients', id: record.id, data: { ...record, name: 'Someone Else', email: 'other@example.com', heightCm: 160 } }] }, { Cookie: cookie });
    expect(res.status).toBe(200);
    expect(profileRecord()).toMatchObject({ name: 'Meera Iyer', email: 'meera.iyer@example.com', heightCm: 160 });
  });

  it('changes email only after the password and a code sent to the new address', async () => {
    const cookie = await verifiedPatient();

    const wrongPassword = await post('/account/email', { newEmail: 'meera.new@example.com', currentPassword: 'nope12345' }, { Cookie: cookie });
    expect(wrongPassword.status).toBe(400);
    expect((await wrongPassword.json()).error.fields.currentPassword).toMatch(/incorrect/);
    expect(sent).toHaveLength(0);

    const ok = await post('/account/email', { newEmail: ' Meera.New@Example.com ', currentPassword: validSignUp.password }, { Cookie: cookie });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ sentTo: 'meera.new@example.com', resendAfterSec: 60 });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: 'meera.new@example.com', subject: 'Confirm your new email address' });
    // Nothing has changed yet.
    expect((await (await me(cookie)).json()).user.email).toBe('meera.iyer@example.com');

    const code = changeEmailCode('meera.new@example.com');
    const wrong = code === '000000' ? '111111' : '000000';
    expect((await post('/account/email/confirm', { code: wrong }, { Cookie: cookie })).status).toBe(400);

    const confirmed = await post('/account/email/confirm', { code }, { Cookie: cookie });
    expect(confirmed.status).toBe(200);
    expect((await confirmed.json()).user).toMatchObject({ email: 'meera.new@example.com', emailVerified: true });
    expect(profileRecord().email).toBe('meera.new@example.com');

    // Sign-in follows the new address.
    expect((await post('/auth/signin', { email: 'meera.new@example.com', password: validSignUp.password })).status).toBe(200);
    expect((await post('/auth/signin', { email: 'meera.iyer@example.com', password: validSignUp.password })).status).toBe(401);
  });

  it('will not move to an address another verified account uses, or to the same address', async () => {
    const cookie = await verifiedPatient();
    const taken = await post('/account/email', { newEmail: 'priya.sharma@example.com', currentPassword: validSignUp.password }, { Cookie: cookie });
    expect(taken.status).toBe(409);
    expect((await taken.json()).error.fields.newEmail).toMatch(/another account/i);

    const same = await post('/account/email', { newEmail: 'MEERA.IYER@example.com', currentPassword: validSignUp.password }, { Cookie: cookie });
    expect(same.status).toBe(400);
    expect((await same.json()).error.fields.newEmail).toMatch(/already your email/);
  });

  it('a newer request replaces the earlier code (and its address)', async () => {
    const cookie = await verifiedPatient();
    await post('/account/email', { newEmail: 'first@example.com', currentPassword: validSignUp.password }, { Cookie: cookie });
    const firstCode = changeEmailCode('first@example.com');
    db.prepare("UPDATE email_codes SET sent_at = sent_at - 61000 WHERE purpose = 'email_change'").run();
    await post('/account/email', { newEmail: 'second@example.com', currentPassword: validSignUp.password }, { Cookie: cookie });
    const secondCode = changeEmailCode('second@example.com');
    if (firstCode !== secondCode) expect((await post('/account/email/confirm', { code: firstCode }, { Cookie: cookie })).status).toBe(400);
    const res = await post('/account/email/confirm', { code: secondCode }, { Cookie: cookie });
    expect((await res.json()).user.email).toBe('second@example.com');
  });

  it('confirming without a pending change is refused', async () => {
    const cookie = await verifiedPatient();
    const res = await post('/account/email/confirm', { code: '123456' }, { Cookie: cookie });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('code_expired');
  });
});
