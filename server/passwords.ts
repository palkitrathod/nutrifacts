import crypto from 'node:crypto';
import { promisify } from 'node:util';

const rawScrypt = promisify(crypto.scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: crypto.ScryptOptions
) => Promise<Buffer>;

/**
 * Each hash uses ~32 MB and ~60 ms of a worker thread. Run at most a few at once and queue the rest,
 * so a flood of sign-in attempts can't exhaust memory or starve everyone else; beyond the queue
 * limit callers get ServerBusyError (answered with 503).
 */
export class ServerBusyError extends Error {}
const MAX_PARALLEL = Number(process.env.PASSWORD_HASH_CONCURRENCY ?? 4);
const MAX_QUEUED = 200;
let running = 0;
const waiting: Array<() => void> = [];

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (running >= MAX_PARALLEL) {
    if (waiting.length >= MAX_QUEUED) throw new ServerBusyError('Too many sign-in attempts right now.');
    // The finishing task hands its slot straight to us, so nobody can jump the queue.
    await new Promise<void>((resolve) => waiting.push(resolve));
  } else {
    running++;
  }
  try {
    return await fn();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else running--;
  }
}

const scrypt = (password: string, salt: Buffer, keylen: number, options: crypto.ScryptOptions) =>
  withSlot(() => rawScrypt(password, salt, keylen, options));

// N=2^15 is OWASP's recommended scrypt cost; maxmem must be raised to fit it.
const PARAMS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEY_LEN = 64;

/** Returns "scrypt$N$r$p$salt$hash" so parameters can be raised later without breaking old hashes. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, KEY_LEN, PARAMS);
  return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, n, r, p, saltB64, keyB64] = stored.split('$');
  if (algo !== 'scrypt' || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, 'base64');
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: PARAMS.maxmem,
  });
  return crypto.timingSafeEqual(actual, expected);
}

// Compared against when the email is unknown, so a miss takes as long as a wrong password
// and response timing does not reveal which emails are registered.
let dummyHash: Promise<string> | undefined;
export function getDummyHash() {
  dummyHash ??= hashPassword(crypto.randomBytes(16).toString('hex'));
  return dummyHash;
}
