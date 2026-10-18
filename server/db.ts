import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { hashPassword, verifyPassword } from './passwords';
import { migrateData } from './data';

export type Role = 'patient' | 'dietitian';

export interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  password_hash: string;
  created_at: string;
}

export type Db = DatabaseSync;

export function openDb(file: string): Db {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
      phone         TEXT NOT NULL,
      role          TEXT NOT NULL CHECK (role IN ('patient', 'dietitian')),
      password_hash TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
  `);
  // Sessions remember their length so they can be extended while in use.
  const sessionCols = (db.prepare('PRAGMA table_info(sessions)').all() as Array<{ name: string }>).map((c) => c.name);
  if (!sessionCols.includes('ttl')) db.exec('ALTER TABLE sessions ADD COLUMN ttl INTEGER NOT NULL DEFAULT 86400000');
  migrateData(db);
  return db;
}

export const users = {
  byEmail(db: Db, email: string): UserRow | undefined {
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined;
  },
  byId(db: Db, id: string): UserRow | undefined {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
  },
  setPassword(db: Db, id: string, passwordHash: string) {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, id);
  },
  insert(db: Db, u: Omit<UserRow, 'created_at'>): UserRow {
    db.prepare(
      'INSERT INTO users (id, name, email, phone, role, password_hash) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(u.id, u.name, u.email, u.phone, u.role, u.password_hash);
    return users.byId(db, u.id)!;
  },
};

// Ids match the sample records in src/data/mockData.ts so the seeded accounts
// open with their existing diet charts, appointments and progress history.
const DEMO_USERS: Array<{ id: string; name: string; email: string; phone: string; role: Role }> = [
  { id: 'dietitian-anchal', name: 'Dt. Anchal Dewan', email: 'anchaldewan380@gmail.com', phone: '+919872154320', role: 'dietitian' },
  { id: 'patient-priya', name: 'Priya Sharma', email: 'priya.sharma@example.com', phone: '+919876543210', role: 'patient' },
  { id: 'patient-rohan', name: 'Rohan Verma', email: 'rohan.verma@example.com', phone: '+919812345678', role: 'patient' },
  { id: 'patient-kavita', name: 'Kavita Mehta', email: 'kavita.mehta@example.com', phone: '+919988776655', role: 'patient' },
];

export const DEMO_PASSWORD = 'Demo@1234';

/** Creates the sample accounts (development only) and/or the real admin account from env. */
export async function seed(db: Db, opts: { demoUsers: boolean; adminEmail?: string; adminPassword?: string }) {
  if (opts.demoUsers) {
    const demoHash = await hashPassword(DEMO_PASSWORD);
    for (const u of DEMO_USERS) {
      if (!users.byId(db, u.id) && !users.byEmail(db, u.email)) {
        users.insert(db, { ...u, password_hash: demoHash });
      }
    }
  }

  if (opts.adminEmail && opts.adminPassword) {
    const hash = await hashPassword(opts.adminPassword);
    const existing = users.byId(db, 'dietitian-anchal');
    if (existing) {
      if (!(await verifyPassword(opts.adminPassword, existing.password_hash)) || existing.email !== opts.adminEmail.toLowerCase()) {
        db.prepare('UPDATE users SET email = ?, password_hash = ? WHERE id = ?')
          .run(opts.adminEmail.toLowerCase(), hash, existing.id);
        // A changed admin password signs out every existing admin session.
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(existing.id);
      }
    } else {
      users.insert(db, {
        id: 'dietitian-anchal',
        name: 'Dt. Anchal Dewan',
        email: opts.adminEmail.toLowerCase(),
        phone: '+919872154320',
        role: 'dietitian',
        password_hash: hash,
      });
    }
  }
}
