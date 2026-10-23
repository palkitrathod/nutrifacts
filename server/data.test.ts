// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createApp, SESSION_COOKIE } from './app';
import { DEMO_PASSWORD, openDb, seed, type Db } from './db';
import { seedData } from './data';
import { newPlanValidUntil, todayIso } from '../src/shared/plans';
import type { MailMessage } from './mailer';

let db: Db;
let server: Server;
let base: string;
let sent: MailMessage[];

beforeEach(async () => {
  db = openDb(':memory:');
  await seed(db, { demoUsers: true });
  seedData(db, { demoRecords: true });
  sent = [];
  const app = createApp({ db, secureCookies: false, mailer: { send: async (m) => void sent.push(m) } });
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterEach(() => new Promise<void>((resolve) => server.close(() => resolve())));

async function signIn(email: string) {
  const res = await fetch(`${base}/api/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: DEMO_PASSWORD }),
  });
  expect(res.status).toBe(200);
  const cookie = res.headers.getSetCookie().find((c) => c.startsWith(SESSION_COOKIE))!.split(';')[0];
  return {
    load: async () => {
      const r = await fetch(`${base}/api/data`, { headers: { Cookie: cookie } });
      expect(r.status).toBe(200);
      return r.json();
    },
    save: (ops: Array<{ collection: string; id: string; data: object }>) =>
      fetch(`${base}/api/data/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ ops }),
      }),
  };
}

const PRIYA = 'priya.sharma@example.com';
const ROHAN = 'rohan.verma@example.com';
const ANCHAL = 'anchaldewan380@gmail.com';

describe('reading data', () => {
  it('requires a session', async () => {
    expect((await fetch(`${base}/api/data`)).status).toBe(401);
  });

  it("a patient receives only their own records — never another patient's", async () => {
    const data = await (await signIn(PRIYA)).load();
    expect(data.patients.map((p: any) => p.id)).toEqual(['patient-priya']);
    for (const c of ['dietCharts', 'weightRecords', 'appointments', 'payments', 'adherenceRecords']) {
      expect(data[c].every((r: any) => r.patientId === 'patient-priya'), c).toBe(true);
    }
    expect(Object.keys(data.dailyTrackers).every((k) => k === 'patient-priya')).toBe(true);
    expect(data.notifications.every((n: any) => n.userId === 'patient-priya' || n.userId === 'all')).toBe(true);
    expect(data.dietCharts.length).toBeGreaterThan(0);
  });

  it('the dietitian receives every patient', async () => {
    const data = await (await signIn(ANCHAL)).load();
    expect(data.patients.length).toBeGreaterThanOrEqual(3);
    expect(new Set(data.dietCharts.map((c: any) => c.patientId)).size).toBeGreaterThan(1);
  });

  it('the price list is public', async () => {
    const res = await fetch(`${base}/api/packages`);
    expect(res.status).toBe(200);
    expect((await res.json()).packages.length).toBeGreaterThan(0);
  });
});

describe('writing data', () => {
  it('a patient can log their own weight, and it persists', async () => {
    const priya = await signIn(PRIYA);
    const rec = { id: 'weight-test-1', patientId: 'patient-priya', date: '2026-10-17', weightKg: 63.2 };
    expect((await priya.save([{ collection: 'weightRecords', id: rec.id, data: rec }])).status).toBe(200);
    expect((await priya.load()).weightRecords).toContainEqual(rec);
    // …and the dietitian sees it, while another patient does not.
    expect((await (await signIn(ANCHAL)).load()).weightRecords).toContainEqual(rec);
    expect((await (await signIn(ROHAN)).load()).weightRecords).not.toContainEqual(rec);
  });

  it("a patient cannot write into another patient's records", async () => {
    const priya = await signIn(PRIYA);
    const res = await priya.save([
      { collection: 'weightRecords', id: 'w-x', data: { id: 'w-x', patientId: 'patient-rohan', weightKg: 1 } },
    ]);
    expect(res.status).toBe(403);
  });

  it('a patient cannot take over an existing record by changing its owner', async () => {
    const rohanData = await (await signIn(ROHAN)).load();
    const rohanAppt = rohanData.appointments[0];
    const priya = await signIn(PRIYA);
    const res = await priya.save([{ collection: 'appointments', id: rohanAppt.id, data: { ...rohanAppt, patientId: 'patient-priya' } }]);
    expect(res.status).toBe(403);
  });

  it('a patient cannot edit diet charts or prices', async () => {
    const priya = await signIn(PRIYA);
    const { dietCharts, packages } = await priya.load();
    expect((await priya.save([{ collection: 'dietCharts', id: dietCharts[0].id, data: { ...dietCharts[0], dailyCalorieTarget: 9999 } }])).status).toBe(403);
    expect((await priya.save([{ collection: 'packages', id: packages[0].id, data: { ...packages[0], priceInr: 1 } }])).status).toBe(403);
  });

  it('the dietitian can update a diet chart and the patient sees it', async () => {
    const anchal = await signIn(ANCHAL);
    const chart = (await anchal.load()).dietCharts.find((c: any) => c.patientId === 'patient-priya');
    expect((await anchal.save([{ collection: 'dietCharts', id: chart.id, data: { ...chart, dailyCalorieTarget: 1450 } }])).status).toBe(200);
    const seen = (await (await signIn(PRIYA)).load()).dietCharts.find((c: any) => c.id === chart.id);
    expect(seen.dailyCalorieTarget).toBe(1450);
  });

  it("a patient cannot change their account email or role through their profile", async () => {
    const priya = await signIn(PRIYA);
    const me = (await priya.load()).patients[0];
    expect((await priya.save([{ collection: 'patients', id: me.id, data: { ...me, email: 'x@evil.com', role: 'dietitian', targetWeightKg: 55 } }])).status).toBe(200);
    const after = (await priya.load()).patients[0];
    expect(after).toMatchObject({ email: PRIYA, role: 'patient', targetWeightKg: 55 });
  });

  describe('payments', () => {
    const payment = (pkg: any, overrides: object = {}) => ({
      id: 'pay-test',
      patientId: 'patient-priya',
      packageId: pkg.id,
      packageTitle: pkg.title,
      amountInr: pkg.priceInr,
      status: 'successful',
      createdAt: todayIso(),
      validUntil: newPlanValidUntil(pkg.validityDays, todayIso()),
      ...overrides,
    });

    it('rejects a plan that would last longer than paid for', async () => {
      const priya = await signIn(PRIYA);
      const pkg = (await priya.load()).packages.find((p: any) => p.isActive);
      const res = await priya.save([{ collection: 'payments', id: 'pay-test', data: payment(pkg, { validUntil: '2030-01-01' }) }]);
      expect(res.status).toBe(400);
      const backdated = await priya.save([{ collection: 'payments', id: 'pay-test', data: payment(pkg, { createdAt: '2020-01-01' }) }]);
      expect(backdated.status).toBe(400);
    });

    it('accepts a purchase at the current price', async () => {
      const priya = await signIn(PRIYA);
      const pkg = (await priya.load()).packages.find((p: any) => p.isActive);
      expect((await priya.save([{ collection: 'payments', id: 'pay-test', data: payment(pkg) }])).status).toBe(200);
    });

    it('rejects a tampered amount', async () => {
      const priya = await signIn(PRIYA);
      const pkg = (await priya.load()).packages.find((p: any) => p.isActive);
      const res = await priya.save([{ collection: 'payments', id: 'pay-test', data: payment(pkg, { amountInr: 1 }) }]);
      expect(res.status).toBe(400);
    });

    it('does not let a patient mark their own payment refunded', async () => {
      const priya = await signIn(PRIYA);
      const pkg = (await priya.load()).packages.find((p: any) => p.isActive);
      await priya.save([{ collection: 'payments', id: 'pay-test', data: payment(pkg) }]);
      const res = await priya.save([{ collection: 'payments', id: 'pay-test', data: payment(pkg, { status: 'refunded' }) }]);
      expect(res.status).toBe(403);
    });

    it('rejects an upgrade credit on an ordinary purchase', async () => {
      const priya = await signIn(PRIYA);
      const pkg = (await priya.load()).packages.find((p: any) => p.isActive);
      const res = await priya.save([{ collection: 'payments', id: 'pay-test', data: payment(pkg, { amountInr: pkg.priceInr - 100, creditInr: 100 }) }]);
      expect(res.status).toBe(400);
    });

    it('accepts Nutrition Care bought for one of its goals (any length), and nothing else as a goal', async () => {
      const priya = await signIn(PRIYA);
      const plans = (await priya.load()).packages;
      const monthly = plans.find((p: any) => p.id === 'pkg-monthly-nutrition-care');
      const quarterly = plans.find((p: any) => p.id === 'pkg-quarterly-nutrition-care');
      const goal = monthly.goals[1].label;
      expect((await priya.save([{ collection: 'payments', id: 'pay-goal', data: payment(monthly, { id: 'pay-goal', goal }) }])).status).toBe(200);
      expect((await priya.save([{ collection: 'payments', id: 'pay-goal3', data: payment(quarterly, { id: 'pay-goal3', goal }) }])).status).toBe(200);
      expect((await priya.save([{ collection: 'payments', id: 'pay-bad', data: payment(monthly, { id: 'pay-bad', goal: 'Free gym' }) }])).status).toBe(400);
      const diet = plans.find((p: any) => p.id === 'pkg-personalized-diet-plan');
      expect((await priya.save([{ collection: 'payments', id: 'pay-bad', data: payment(diet, { id: 'pay-bad', goal }) }])).status).toBe(400);
    });

    it('sells condition programs online at their listed price', async () => {
      const priya = await signIn(PRIYA);
      const program = (await priya.load()).packages.find((p: any) => p.id === 'prog-lifestyle-diseases-3m');
      expect(program).toMatchObject({ serviceId: 'service-lifestyle-diseases', validityDays: 90, isActive: true });
      expect((await priya.save([{ collection: 'payments', id: 'pay-prog', data: payment(program, { id: 'pay-prog', amountInr: program.priceInr - 500 }) }])).status).toBe(400);
      expect((await priya.save([{ collection: 'payments', id: 'pay-prog', data: payment(program, { id: 'pay-prog' }) }])).status).toBe(200);
    });

    describe('upgrades', () => {
      // Priya's seeded plan: Monthly Nutrition Care, ₹2499, 2026-10-10 → 2026-11-10 (32 days).
      // On 2026-10-22, 20 days are left: credit ⌊2499 × 20 / 32⌋ = ₹1561.
      const PREMIUM = { id: 'pkg-premium', title: 'Premium Care', priceInr: 4999, durationLabel: '30 days', validityDays: 30, isActive: true, tagline: '', description: '', inclusions: [], terms: '', category: 'monthly_care' };
      const upgrade = (overrides: object = {}) =>
        payment(PREMIUM, { amountInr: 4999 - 1561, listPriceInr: 4999, creditInr: 1561, upgradeFromPaymentId: 'pay-001', createdAt: '2026-10-22', validUntil: '2026-11-21', ...overrides });

      beforeEach(async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-22T09:00:00Z'));
        const anchal = await signIn(ANCHAL);
        expect((await anchal.save([{ collection: 'packages', id: PREMIUM.id, data: PREMIUM }])).status).toBe(200);
      });
      afterEach(() => vi.useRealTimers());

      it('accepts the price minus the credit for the unused days', async () => {
        const priya = await signIn(PRIYA);
        expect((await priya.save([{ collection: 'payments', id: 'pay-test', data: upgrade() }])).status).toBe(200);
      });

      it.each([
        ['a bigger credit', { amountInr: 4999 - 2000, creditInr: 2000 }],
        ['a missing list price', { listPriceInr: undefined }],
        ['another patient’s plan', { upgradeFromPaymentId: 'pay-002' }],
        ['a plan that does not exist', { upgradeFromPaymentId: 'pay-nope' }],
      ])('rejects %s', async (_label, overrides) => {
        const priya = await signIn(PRIYA);
        expect((await priya.save([{ collection: 'payments', id: 'pay-test', data: upgrade(overrides) }])).status).toBe(400);
      });

      it('credits the same plan only once', async () => {
        const priya = await signIn(PRIYA);
        expect((await priya.save([{ collection: 'payments', id: 'pay-up-1', data: upgrade({ id: 'pay-up-1' }) }])).status).toBe(200);
        // pay-001 is no longer the current plan, so it can't be credited again.
        expect((await priya.save([{ collection: 'payments', id: 'pay-up-2', data: upgrade({ id: 'pay-up-2' }) }])).status).toBe(400);
      });

      it('rejects an "upgrade" to a cheaper plan', async () => {
        const priya = await signIn(PRIYA);
        const cheap = (await priya.load()).packages.find((p: any) => p.isActive && p.priceInr < 2499);
        const res = await priya.save([{ collection: 'payments', id: 'pay-test', data: payment(cheap, { amountInr: 0, listPriceInr: cheap.priceInr, creditInr: cheap.priceInr, upgradeFromPaymentId: 'pay-001' }) }]);
        expect(res.status).toBe(400);
      });

      it('gives no credit once the plan has ended', async () => {
        vi.setSystemTime(new Date('2026-11-11T09:00:00Z'));
        const priya = await signIn(PRIYA);
        expect((await priya.save([{ collection: 'payments', id: 'pay-test', data: upgrade() }])).status).toBe(400);
      });

      it('credits the First Consultation in full towards a bigger plan', async () => {
        const priya = await signIn(PRIYA);
        const plans = (await priya.load()).packages;
        const starter = plans.find((p: any) => p.id === 'pkg-basic-consultation');
        const monthly = plans.find((p: any) => p.id === 'pkg-monthly-nutrition-care');
        expect(starter.creditInFull).toBe(true);
        expect((await priya.save([{ collection: 'payments', id: 'pay-starter', data: payment(starter, { id: 'pay-starter' }) }])).status).toBe(200);
        // A week later, all ₹499 still counts (not just the unused days).
        vi.setSystemTime(new Date('2026-10-29T09:00:00Z'));
        const later = await signIn(PRIYA); // the earlier session has expired by then
        const up = (credit: number) =>
          payment(monthly, { id: 'pay-up', amountInr: 2499 - credit, listPriceInr: 2499, creditInr: credit, upgradeFromPaymentId: 'pay-starter' });
        expect((await later.save([{ collection: 'payments', id: 'pay-up', data: up(250) }])).status).toBe(400);
        expect((await later.save([{ collection: 'payments', id: 'pay-up', data: up(499) }])).status).toBe(200);
      });
    });

    describe('early renewal', () => {
      // Priya's plan (pay-001) ends 2026-11-10; early renewal opens 7 days before, on 2026-11-04.
      const renewal = (overrides: object = {}) => ({
        id: 'pay-renew',
        patientId: 'patient-priya',
        packageId: 'pkg-monthly-nutrition-care',
        packageTitle: 'Monthly Nutrition Care',
        amountInr: 2499,
        status: 'successful',
        createdAt: todayIso(),
        renewalOfPaymentId: 'pay-001',
        bonusDays: 7,
        validUntil: '2026-12-17', // 2026-11-10 + 30 days + 7 bonus days
        ...overrides,
      });
      beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }));
      afterEach(() => vi.useRealTimers());

      it('starts after the current plan, with 7 days free, in the last 7 days', async () => {
        vi.setSystemTime(new Date('2026-11-05T09:00:00Z'));
        const priya = await signIn(PRIYA);
        expect((await priya.save([{ collection: 'payments', id: 'pay-renew', data: renewal() }])).status).toBe(200);
      });

      it.each([
        ['too early', '2026-10-22T09:00:00Z', {}],
        ['more bonus days', '2026-11-05T09:00:00Z', { bonusDays: 14, validUntil: '2026-12-24' }],
        ['a discounted price', '2026-11-05T09:00:00Z', { amountInr: 1999 }],
        ['longer access', '2026-11-05T09:00:00Z', { validUntil: '2027-01-01' }],
      ])('rejects %s', async (_label, now, overrides) => {
        vi.setSystemTime(new Date(now));
        const priya = await signIn(PRIYA);
        expect((await priya.save([{ collection: 'payments', id: 'pay-renew', data: renewal(overrides) }])).status).toBe(400);
      });
    });
  });

  describe('profile photo', () => {
    const tinyJpeg = 'data:image/jpeg;base64,' + 'A'.repeat(4000);
    async function saveAvatar(avatar: unknown) {
      const priya = await signIn(PRIYA);
      const profile = (await priya.load()).patients[0];
      return priya.save([{ collection: 'patients', id: 'patient-priya', data: { ...profile, avatar } }]);
    }

    it('accepts a small uploaded image, and removing it', async () => {
      expect((await saveAvatar(tinyJpeg)).status).toBe(200);
      expect((await saveAvatar(undefined)).status).toBe(200);
    });

    it.each([
      ['a link to another site', 'https://evil.example.com/pixel.png'],
      ['an SVG (can carry scripts)', 'data:image/svg+xml;base64,PHN2Zz4='],
      ['an oversized image', 'data:image/jpeg;base64,' + 'A'.repeat(400_000)],
      ['something that is not text', 42],
    ])('rejects %s', async (_label, avatar) => {
      expect((await saveAvatar(avatar)).status).toBe(400);
    });

    it('keeps an existing photo that is saved unchanged', async () => {
      const priya = await signIn(PRIYA);
      const profile = (await priya.load()).patients[0];
      expect((await priya.save([{ collection: 'patients', id: 'patient-priya', data: { ...profile, heightCm: 164 } }])).status).toBe(200);
    });
  });

  it('a patient may notify the dietitian but not other patients, and may only mark their own as read', async () => {
    const priya = await signIn(PRIYA);
    const n = (userId: string, id: string) => ({ id, userId, title: 't', message: 'm', timestamp: 'now', category: 'diet', read: false });
    expect((await priya.save([{ collection: 'notifications', id: 'n1', data: n('dietitian-anchal', 'n1') }])).status).toBe(200);
    expect((await priya.save([{ collection: 'notifications', id: 'n2', data: n('patient-rohan', 'n2') }])).status).toBe(403);

    const mine = (await priya.load()).notifications.find((x: any) => x.userId === 'patient-priya');
    expect((await priya.save([{ collection: 'notifications', id: mine.id, data: { ...mine, read: true } }])).status).toBe(200);
    expect((await priya.save([{ collection: 'notifications', id: mine.id, data: { ...mine, title: 'edited' } }])).status).toBe(403);
  });

  it('a patient cannot change an appointment after booking', async () => {
    const priya = await signIn(PRIYA);
    const appt = (await priya.load()).appointments[0];
    expect((await priya.save([{ collection: 'appointments', id: appt.id, data: { ...appt, status: 'completed' } }])).status).toBe(403);
  });

  it('a batch is all-or-nothing', async () => {
    const priya = await signIn(PRIYA);
    const ok = { id: 'w-ok', patientId: 'patient-priya', weightKg: 60 };
    const bad = { id: 'w-bad', patientId: 'patient-rohan', weightKg: 60 };
    const res = await priya.save([
      { collection: 'weightRecords', id: ok.id, data: ok },
      { collection: 'weightRecords', id: bad.id, data: bad },
    ]);
    expect(res.status).toBe(403);
    expect((await res.json()).error.index).toBe(1);
    expect((await priya.load()).weightRecords.find((r: any) => r.id === 'w-ok')).toBeUndefined();
  });

  it.each([
    [{ ops: [] }],
    [{ ops: [{ collection: 'users', id: 'x', data: {} }] }],
    [{ ops: [{ collection: 'weightRecords', id: 'x', data: [] }] }],
    [{ ops: 'nope' }],
  ])('rejects malformed batches %#', async (body) => {
    const priya = await signIn(PRIYA);
    const res = await fetch(`${base}/api/data/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    expect([400, 401]).toContain(res.status);
    void priya;
  });

  it('rejects a record whose id does not match', async () => {
    const priya = await signIn(PRIYA);
    const res = await priya.save([{ collection: 'weightRecords', id: 'a', data: { id: 'b', patientId: 'patient-priya' } }]);
    expect(res.status).toBe(400);
  });
});

describe('production seeding', () => {
  it('seeds only the price list when demo records are off', () => {
    const fresh = openDb(':memory:');
    seedData(fresh, { demoRecords: false });
    const counts = fresh.prepare('SELECT collection, COUNT(*) AS n FROM records GROUP BY collection').all() as Array<{ collection: string }>;
    expect(counts.map((c) => c.collection)).toEqual(['packages']);
  });

  it('updates an older price list to the new plans, keeping the clinic’s prices and on/off switches', () => {
    const old = openDb(':memory:');
    const put = (id: string, data: object) =>
      old.prepare('INSERT INTO records (collection, id, owner, data, updated_at) VALUES (?, ?, NULL, ?, 0)').run('packages', id, JSON.stringify(data));
    put('pkg-basic-consultation', { id: 'pkg-basic-consultation', title: 'Basic Nutrition Consultation', priceInr: 549, isActive: false });
    put('pkg-custom', { id: 'pkg-custom', title: 'Clinic’s own plan', priceInr: 1234, isActive: true });
    seedData(old, { demoRecords: false });
    const pkg = (id: string) => JSON.parse((old.prepare("SELECT data FROM records WHERE collection = 'packages' AND id = ?").get(id) as { data: string }).data);
    expect(pkg('pkg-basic-consultation')).toMatchObject({ title: 'First Consultation', priceInr: 549, isActive: false, creditInFull: true });
    expect(pkg('pkg-quarterly-nutrition-care')).toMatchObject({ priceInr: 5999, validityDays: 90 });
    expect(pkg('pkg-custom')).toEqual({ id: 'pkg-custom', title: 'Clinic’s own plan', priceInr: 1234, isActive: true });
    // Running it again changes nothing.
    seedData(old, { demoRecords: false });
    expect(pkg('pkg-basic-consultation').priceInr).toBe(549);
  });
});

describe('sign-up creates the patient profile on the server', () => {
  it('the dietitian sees a new patient once their email is verified, with a welcome notification for the patient', async () => {
    const res = await fetch(`${base}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Fresh Patient', email: 'fresh@example.com', phone: '9876543210', password: 'Healthy123', acceptedTerms: true }),
    });
    expect(res.status).toBe(201);
    const { user } = await res.json();
    const cookie = res.headers.getSetCookie()[0].split(';')[0];
    expect((await (await signIn(ANCHAL)).load()).patients.some((p: any) => p.id === user.id)).toBe(false);

    const code = sent[0].text.match(/email address: (\d{6})/)![1];
    const verified = await fetch(`${base}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ code }),
    });
    expect(verified.status).toBe(200);
    const admin = await (await signIn(ANCHAL)).load();
    expect(admin.patients.find((p: any) => p.id === user.id)).toMatchObject({ name: 'Fresh Patient', phone: '+91 98765 43210', role: 'patient' });

    const own = await (await fetch(`${base}/api/data`, { headers: { Cookie: cookie } })).json();
    expect(own.notifications.map((n: any) => n.id)).toContain(`notif-welcome-${user.id}`);
  });
});
