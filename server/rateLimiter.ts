/** Fixed-window, in-memory limiter. Fine for a single server process. */
export class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();

  constructor(private opts: { max: number; windowMs: number; now?: () => number }) {}

  private now() {
    return this.opts.now ? this.opts.now() : Date.now();
  }

  private entry(key: string) {
    const e = this.hits.get(key);
    if (e && e.resetAt > this.now()) return e;
    this.hits.delete(key);
    return undefined;
  }

  /** Looks without counting. */
  check(key: string) {
    const e = this.entry(key);
    if (e && e.count >= this.opts.max) {
      return { allowed: false, retryAfterSec: Math.ceil((e.resetAt - this.now()) / 1000) };
    }
    return { allowed: true, retryAfterSec: 0 };
  }

  /** Counts one attempt; returns whether it was within the limit. */
  hit(key: string) {
    const blocked = this.check(key);
    if (!blocked.allowed) return blocked;
    const e = this.entry(key) ?? { count: 0, resetAt: this.now() + this.opts.windowMs };
    e.count++;
    this.hits.set(key, e);
    if (this.hits.size > 10_000) this.prune();
    return { allowed: true, retryAfterSec: 0 };
  }

  reset(key: string) {
    this.hits.delete(key);
  }

  private prune() {
    const now = this.now();
    for (const [k, e] of this.hits) if (e.resetAt <= now) this.hits.delete(k);
  }
}
