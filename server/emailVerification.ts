import crypto from 'node:crypto';
import type { Db } from './db';

/**
 * One-time codes emailed to prove someone owns an address: at sign-up ('signup'), and when a
 * signed-in person moves their account to a new address ('email_change', which also remembers that
 * address). Each account has at most one live code per purpose: issuing a new one replaces (and so
 * invalidates) the previous one. Only a hash is stored.
 */
export type CodePurpose = 'signup' | 'email_change';

export const CODE_LENGTH = 6;
export const CODE_TTL_MS = 10 * 60 * 1000;
export const MAX_CODE_ATTEMPTS = 5;
/** Minimum gap between two codes for the same account and purpose. */
export const RESEND_COOLDOWN_MS = 60 * 1000;

export function migrateEmailCodes(db: Db) {
  // Codes live for minutes, so an older layout of this table is simply replaced.
  const cols = (db.prepare('PRAGMA table_info(email_codes)').all() as Array<{ name: string }>).map((c) => c.name);
  if (cols.length && !cols.includes('purpose')) db.exec('DROP TABLE email_codes');
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_codes (
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      purpose    TEXT NOT NULL,
      code_hash  TEXT NOT NULL,
      new_email  TEXT,
      expires_at INTEGER NOT NULL,
      sent_at    INTEGER NOT NULL,
      attempts   INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, purpose)
    );
  `);
}

// Salted with the account id and purpose, so equal codes never share a hash.
const hashCode = (userId: string, purpose: CodePurpose, code: string) =>
  crypto.createHash('sha256').update(`${userId}:${purpose}:${code}`).digest('hex');

export const isCodeFormat = (code: string) => new RegExp(`^\\d{${CODE_LENGTH}}$`).test(code);

/** Seconds until another code may be sent (0 = now). */
export function resendWaitSec(db: Db, userId: string, purpose: CodePurpose = 'signup', now = Date.now()): number {
  const row = db.prepare('SELECT sent_at FROM email_codes WHERE user_id = ? AND purpose = ?').get(userId, purpose) as
    | { sent_at: number }
    | undefined;
  if (!row) return 0;
  return Math.max(0, Math.ceil((row.sent_at + RESEND_COOLDOWN_MS - now) / 1000));
}

/** Creates a fresh code (replacing any earlier one for this purpose) and returns it in plain text. */
export function issueCode(
  db: Db,
  userId: string,
  opts: { purpose?: CodePurpose; newEmail?: string; now?: number } = {}
): string {
  const { purpose = 'signup', newEmail = null, now = Date.now() } = opts;
  const code = String(crypto.randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, '0');
  db.prepare(
    `INSERT INTO email_codes (user_id, purpose, code_hash, new_email, expires_at, sent_at, attempts) VALUES (?, ?, ?, ?, ?, ?, 0)
     ON CONFLICT(user_id, purpose) DO UPDATE SET code_hash = excluded.code_hash, new_email = excluded.new_email,
       expires_at = excluded.expires_at, sent_at = excluded.sent_at, attempts = 0`
  ).run(userId, purpose, hashCode(userId, purpose, code), newEmail, now + CODE_TTL_MS, now);
  return code;
}

export function discardCode(db: Db, userId: string, purpose: CodePurpose = 'signup') {
  db.prepare('DELETE FROM email_codes WHERE user_id = ? AND purpose = ?').run(userId, purpose);
}

export type CheckResult =
  | { ok: true; newEmail: string | null }
  | { ok: false; reason: 'none' | 'expired' | 'too_many' }
  | { ok: false; reason: 'wrong'; attemptsLeft: number };

/** Checks a code. A correct code is used up; each wrong one counts towards the attempt limit. */
export function checkCode(db: Db, userId: string, code: string, purpose: CodePurpose = 'signup', now = Date.now()): CheckResult {
  const row = db
    .prepare('SELECT code_hash, new_email, expires_at, attempts FROM email_codes WHERE user_id = ? AND purpose = ?')
    .get(userId, purpose) as { code_hash: string; new_email: string | null; expires_at: number; attempts: number } | undefined;
  if (!row) return { ok: false, reason: 'none' };
  if (row.expires_at < now) return { ok: false, reason: 'expired' };
  if (row.attempts >= MAX_CODE_ATTEMPTS) return { ok: false, reason: 'too_many' };

  const expected = Buffer.from(row.code_hash, 'hex');
  const given = Buffer.from(hashCode(userId, purpose, code), 'hex');
  if (crypto.timingSafeEqual(expected, given)) {
    discardCode(db, userId, purpose);
    return { ok: true, newEmail: row.new_email };
  }
  // Synchronous from read to write, so parallel guesses can't all slip past the limit.
  db.prepare('UPDATE email_codes SET attempts = attempts + 1 WHERE user_id = ? AND purpose = ?').run(userId, purpose);
  const attemptsLeft = MAX_CODE_ATTEMPTS - row.attempts - 1;
  return attemptsLeft > 0 ? { ok: false, reason: 'wrong', attemptsLeft } : { ok: false, reason: 'too_many' };
}
