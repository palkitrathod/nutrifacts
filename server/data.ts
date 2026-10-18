import type { Router, Request, Response } from 'express';
import type { Db, UserRow } from './db';
import {
  DIETITIAN_PROFILE,
  INITIAL_ADHERENCE_RECORDS,
  INITIAL_APPOINTMENTS,
  INITIAL_DAILY_TRACKER,
  INITIAL_DIET_CHARTS,
  INITIAL_NOTIFICATIONS,
  INITIAL_PACKAGES,
  INITIAL_PATIENTS,
  INITIAL_PAYMENTS,
  INITIAL_WEIGHT_RECORDS,
} from '../src/data/seedData';
import { formatPhone } from '../src/shared/authValidation';

/**
 * App data (diet charts, appointments, payments…) is stored as JSON records, one row per record,
 * each tagged with the user it belongs to. Every read is filtered and every write is checked
 * against the rules below, so the browser only ever receives — and can only change — what the
 * signed-in person is allowed to.
 */

export const COLLECTIONS = [
  'patients',
  'dietCharts',
  'weightRecords',
  'appointments',
  'notifications',
  'dailyTrackers',
  'packages',
  'payments',
  'adherenceRecords',
] as const;
export type Collection = (typeof COLLECTIONS)[number];

type Rec = Record<string, unknown>;

/** Which field names the record's owner. `null` = shared reference data (the price list). */
const OWNER_FIELD: Record<Collection, string | null> = {
  patients: 'id',
  dietCharts: 'patientId',
  weightRecords: 'patientId',
  appointments: 'patientId',
  notifications: 'userId',
  dailyTrackers: '__key', // stored as a map keyed by patient id
  packages: null,
  payments: 'patientId',
  adherenceRecords: 'patientId',
};

export const DIETITIAN_ID = DIETITIAN_PROFILE.id;
const BROADCAST = 'all';
const MAX_RECORD_BYTES = 20 * 1024 * 1024; // diet charts can carry an uploaded PDF

export function migrateData(db: Db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS records (
      collection TEXT NOT NULL,
      id         TEXT NOT NULL,
      owner      TEXT,
      data       TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (collection, id)
    );
    CREATE INDEX IF NOT EXISTS records_owner_idx ON records(collection, owner);
  `);
}

function ownerOf(collection: Collection, id: string, data: Rec): string | null {
  const field = OWNER_FIELD[collection];
  if (field === null) return null;
  if (field === '__key') return id;
  const v = data[field];
  return typeof v === 'string' ? v : null;
}

function put(db: Db, collection: Collection, id: string, data: Rec) {
  db.prepare(
    `INSERT INTO records (collection, id, owner, data, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (collection, id) DO UPDATE SET owner = excluded.owner, data = excluded.data, updated_at = excluded.updated_at`
  ).run(collection, id, ownerOf(collection, id, data), JSON.stringify(data), Date.now());
}

function get(db: Db, collection: Collection, id: string): Rec | undefined {
  const row = db.prepare('SELECT data FROM records WHERE collection = ? AND id = ?').get(collection, id) as { data: string } | undefined;
  return row ? JSON.parse(row.data) : undefined;
}

/**
 * The price list is always seeded; the sample patients' histories only when demo users are on
 * (their ids match the demo accounts in db.ts).
 */
export function seedData(db: Db, opts: { demoRecords: boolean }) {
  const hasAny = (c: Collection) => !!db.prepare('SELECT 1 FROM records WHERE collection = ? LIMIT 1').get(c);
  db.exec('BEGIN');
  try {
    // Inserted in reverse so that reading newest-first returns each list in its original order.
    if (!hasAny('packages')) for (const p of [...INITIAL_PACKAGES].reverse()) put(db, 'packages', p.id, p as unknown as Rec);

    if (opts.demoRecords && !hasAny('patients')) {
      const lists: Array<[Collection, Array<{ id: string }>]> = [
        ['patients', INITIAL_PATIENTS],
        ['dietCharts', INITIAL_DIET_CHARTS],
        ['weightRecords', INITIAL_WEIGHT_RECORDS],
        ['appointments', INITIAL_APPOINTMENTS],
        ['notifications', INITIAL_NOTIFICATIONS],
        ['payments', INITIAL_PAYMENTS],
        ['adherenceRecords', INITIAL_ADHERENCE_RECORDS as Array<{ id: string }>],
      ];
      for (const [c, items] of lists) for (const item of [...items].reverse()) put(db, c, item.id, item as unknown as Rec);
      for (const [key, tracker] of Object.entries(INITIAL_DAILY_TRACKER)) put(db, 'dailyTrackers', key, tracker as unknown as Rec);
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

/**
 * Creates a new patient's clinical profile and welcome message at sign-up, on the server, so the
 * patient appears in the dietitian's roster immediately — even if they close the tab right away.
 */
export function createPatientProfile(db: Db, user: Pick<UserRow, 'id' | 'name' | 'email' | 'phone'>) {
  const today = new Date().toISOString().split('T')[0];
  const profile = {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: formatPhone(user.phone),
    role: 'patient',
    dietaryPreference: 'Vegetarian',
    healthGoals: ['Sustainable Nutrition & Health'],
    medicalConditions: [],
    allergies: [],
    waterGoalLitres: 3.0,
    joinedDate: today,
    assignedProgram: 'Awaiting initial consultation',
  };
  const welcome = {
    id: `notif-welcome-${user.id}`,
    userId: user.id,
    title: 'Welcome to Nutrifacts!',
    message: 'Welcome to your nutrition journey with Dt. Anchal. Book your initial consultation to receive your diet chart.',
    timestamp: 'Just now',
    category: 'care',
    read: false,
  };
  db.exec('BEGIN');
  try {
    if (!get(db, 'patients', user.id)) put(db, 'patients', user.id, profile);
    if (!get(db, 'notifications', welcome.id)) put(db, 'notifications', welcome.id, welcome);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

// ── Reads ────────────────────────────────────────────────────────────────────

function rows(db: Db, sql: string, ...params: Array<string>) {
  // Newest first — the order the app itself keeps lists in. (rowid = insertion order; updates keep it.)
  return (db.prepare(`${sql} ORDER BY rowid DESC`).all(...params) as Array<{ id: string; data: string }>).map((r) => ({ id: r.id, data: JSON.parse(r.data) as Rec }));
}

export function loadFor(db: Db, user: UserRow) {
  const isAdmin = user.role === 'dietitian';
  const out: Record<string, unknown> = {};
  for (const c of COLLECTIONS) {
    let list;
    if (c === 'packages') list = rows(db, 'SELECT id, data FROM records WHERE collection = ?', c);
    else if (c === 'notifications') {
      // Everyone (admin included) only gets notifications addressed to them or to everyone.
      list = rows(db, 'SELECT id, data FROM records WHERE collection = ? AND owner IN (?, ?)', c, user.id, BROADCAST);
    } else if (isAdmin) list = rows(db, 'SELECT id, data FROM records WHERE collection = ?', c);
    else list = rows(db, 'SELECT id, data FROM records WHERE collection = ? AND owner = ?', c, user.id);

    out[c] = c === 'dailyTrackers' ? Object.fromEntries(list.map((r) => [r.id, r.data])) : list.map((r) => r.data);
  }
  return out;
}

// ── Writes ───────────────────────────────────────────────────────────────────

export interface WriteOp {
  collection: Collection;
  id: string;
  data: Rec;
}

class Forbidden extends Error {}
class Invalid extends Error {}

const sameExcept = (a: Rec, b: Rec, allowed: string[]) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) if (!allowed.includes(k) && JSON.stringify(a[k]) !== JSON.stringify(b[k])) return false;
  return true;
};

/** Throws Forbidden/Invalid if `user` may not write `op`; may return a corrected copy of the data. */
function authorize(db: Db, user: UserRow, op: WriteOp): Rec {
  const { collection, id, data } = op;
  const isAdmin = user.role === 'dietitian';
  const existing = get(db, collection, id);
  const owner = ownerOf(collection, id, data);

  if (OWNER_FIELD[collection] !== '__key' && data.id !== id) throw new Invalid('Record id does not match.');
  if (existing && OWNER_FIELD[collection] && ownerOf(collection, id, existing) !== owner) {
    throw new Forbidden('A record cannot be moved to another person.');
  }

  switch (collection) {
    case 'packages':
    case 'dietCharts':
      if (!isAdmin) throw new Forbidden('Only the dietitian can change this.');
      return data;

    case 'patients': {
      if (!isAdmin && id !== user.id) throw new Forbidden('You can only update your own profile.');
      const account = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
      if (!account || account.role !== 'patient') throw new Invalid('Unknown patient.');
      // Identity is owned by the account, never by the profile record.
      return { ...data, id, role: 'patient', email: account.email };
    }

    case 'notifications': {
      if (isAdmin) {
        if (existing && existing.userId !== user.id && existing.userId !== BROADCAST) {
          throw new Forbidden('You can only change your own notifications.');
        }
        return data;
      }
      if (existing) {
        if (existing.userId !== user.id) throw new Forbidden('You can only change your own notifications.');
        if (!sameExcept(existing, data, ['read'])) throw new Forbidden('Only the read state can change.');
        return data;
      }
      if (owner !== user.id && owner !== DIETITIAN_ID) throw new Forbidden('You can only notify yourself or your dietitian.');
      return data;
    }

    case 'appointments': {
      if (isAdmin) return data;
      if (owner !== user.id) throw new Forbidden('You can only book for yourself.');
      if (existing) throw new Forbidden('Only the clinic can change an appointment.');
      if (data.status !== 'confirmed' && data.status !== 'pending') throw new Invalid('Invalid appointment status.');
      return data;
    }

    case 'payments': {
      if (isAdmin) return data;
      if (owner !== user.id) throw new Forbidden('You can only pay for yourself.');
      if (existing) throw new Forbidden('Only the clinic can change a payment.');
      const pkg = get(db, 'packages', String(data.packageId));
      if (!pkg || pkg.isActive !== true) throw new Invalid('This plan is no longer available.');
      if (data.amountInr !== pkg.priceInr || data.packageTitle !== pkg.title) throw new Invalid('The amount does not match the current price.');
      if (data.status !== 'successful') throw new Invalid('Invalid payment status.');
      return data;
    }

    case 'weightRecords':
    case 'adherenceRecords':
      if (!isAdmin && owner !== user.id) throw new Forbidden('You can only record your own data.');
      return data;

    case 'dailyTrackers':
      // Water and meal ticks are personal; nobody, the dietitian included, ticks them for someone else.
      if (owner !== user.id) throw new Forbidden('You can only update your own tracker.');
      return data;
  }
}

export function applyWrites(db: Db, user: UserRow, ops: WriteOp[]) {
  db.exec('BEGIN');
  try {
    ops.forEach((op, index) => {
      try {
        put(db, op.collection, op.id, authorize(db, user, op));
      } catch (e) {
        (e as Error & { index?: number }).index = index;
        throw e;
      }
    });
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

// ── Routes ───────────────────────────────────────────────────────────────────

const isCollection = (c: unknown): c is Collection => typeof c === 'string' && (COLLECTIONS as readonly string[]).includes(c);

export function registerDataRoutes(
  api: Router,
  { db, currentUser, sendError }: {
    db: Db;
    currentUser: (req: Request, res?: Response) => UserRow | undefined;
    sendError: (res: Response, status: number, code: string, message: string) => void;
  }
) {
  // Public: the price list shown on the home page.
  api.get('/packages', (_req, res) => {
    res.json({ packages: rows(db, 'SELECT id, data FROM records WHERE collection = ?', 'packages').map((r) => r.data) });
  });

  /**
   * The app sends the account it believes is signed in. If another tab has since signed in as
   * someone else, the cookie no longer matches: refuse, so one person's screen can never read or
   * save under another person's session.
   */
  const accountMismatch = (req: Request, res: Response, user: UserRow) => {
    const expected = req.get('x-nutrifacts-account');
    if (expected && expected !== user.id) {
      sendError(res, 409, 'account_changed', 'You signed in with a different account in another tab.');
      return true;
    }
    return false;
  };

  api.get('/data', (req, res) => {
    const user = currentUser(req, res);
    if (!user) return sendError(res, 401, 'unauthenticated', 'You are not signed in.');
    if (accountMismatch(req, res, user)) return;
    res.json(loadFor(db, user));
  });

  api.post('/data/batch', (req, res) => {
    const user = currentUser(req, res);
    if (!user) return sendError(res, 401, 'unauthenticated', 'You are not signed in.');
    if (accountMismatch(req, res, user)) return;

    const ops = req.body?.ops;
    if (!Array.isArray(ops) || ops.length === 0 || ops.length > 500) {
      return sendError(res, 400, 'bad_request', 'Expected 1–500 changes.');
    }
    for (const op of ops) {
      const valid =
        op && isCollection(op.collection) && typeof op.id === 'string' && op.id.length > 0 && op.id.length <= 200 &&
        op.data && typeof op.data === 'object' && !Array.isArray(op.data);
      if (!valid) return sendError(res, 400, 'bad_request', 'Malformed change.');
      if (JSON.stringify(op.data).length > MAX_RECORD_BYTES) return sendError(res, 413, 'too_large', 'A record is too large.');
    }

    try {
      applyWrites(db, user, ops as WriteOp[]);
      res.json({ saved: ops.length });
    } catch (e) {
      const index = (e as { index?: number }).index;
      if (e instanceof Forbidden) return res.status(403).json({ error: { code: 'forbidden', message: e.message, index } });
      if (e instanceof Invalid) return res.status(400).json({ error: { code: 'invalid', message: e.message, index } });
      throw e;
    }
  });
}
