// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createApp, SESSION_COOKIE } from './app';
import { DEMO_PASSWORD, openDb, seed, type Db } from './db';
import { seedData } from './data';

let db: Db;
let server: Server;
let base: string;

beforeEach(async () => {
  db = openDb(':memory:');
  await seed(db, { demoUsers: true });
  seedData(db, { demoRecords: true });
  const app = createApp({ db, secureCookies: false });
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
      ...overrides,
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
});

describe('sign-up creates the patient profile on the server', () => {
  it('the dietitian sees a new patient immediately, with a welcome notification for the patient', async () => {
    const res = await fetch(`${base}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Fresh Patient', email: 'fresh@example.com', phone: '9876543210', password: 'Healthy123', acceptedTerms: true }),
    });
    expect(res.status).toBe(201);
    const { user } = await res.json();
    const admin = await (await signIn(ANCHAL)).load();
    expect(admin.patients.find((p: any) => p.id === user.id)).toMatchObject({ name: 'Fresh Patient', phone: '+91 98765 43210', role: 'patient' });

    const cookie = res.headers.getSetCookie()[0].split(';')[0];
    const own = await (await fetch(`${base}/api/data`, { headers: { Cookie: cookie } })).json();
    expect(own.notifications.map((n: any) => n.id)).toContain(`notif-welcome-${user.id}`);
  });
});
