// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { RateLimiter } from './rateLimiter';

describe('RateLimiter', () => {
  it('blocks after max hits and unblocks when the window passes', () => {
    let now = 0;
    const rl = new RateLimiter({ max: 2, windowMs: 1000, now: () => now });
    expect(rl.hit('k').allowed).toBe(true);
    expect(rl.hit('k').allowed).toBe(true);
    expect(rl.hit('k')).toEqual({ allowed: false, retryAfterSec: 1 });
    expect(rl.check('other').allowed).toBe(true);
    now = 1000;
    expect(rl.check('k').allowed).toBe(true);
  });

  it('reset clears a key', () => {
    const rl = new RateLimiter({ max: 1, windowMs: 1000 });
    rl.hit('k');
    expect(rl.check('k').allowed).toBe(false);
    rl.reset('k');
    expect(rl.check('k').allowed).toBe(true);
  });
});
