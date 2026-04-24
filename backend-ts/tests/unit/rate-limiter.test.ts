/**
 * Rate-limiter unit tests.
 *
 * Uses a fake clock so we can simulate the 60s sliding window in
 * milliseconds without actually sleeping. The fake clock advances time
 * whenever `sleep(ms)` is called, then resolves the promise on a
 * microtask so awaiters see the updated `now()`.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { HttpError } from '../../src/lib/errors.js';
import {
  type Clock,
  limiters,
  type RateLimitConfig,
  TpmLimiter,
  withRetryOn429,
} from '../../src/services/ai/rate-limiter.js';

function makeFakeClock(): Clock & { advance(ms: number): void; current(): number } {
  let t = 1_000_000;
  return {
    now: () => t,
    sleep: async (ms) => {
      t += ms;
    },
    advance: (ms) => {
      t += ms;
    },
    current: () => t,
  };
}

const cfg = (over: Partial<RateLimitConfig> = {}): Partial<RateLimitConfig> => ({
  tpm: 10_000,
  perRequestMax: 8_000,
  retryMax: 3,
  retryBaseMs: 100,
  ...over,
});

beforeEach(() => {
  limiters._resetAll();
});

describe('TpmLimiter.acquire', () => {
  it('admits a request well under the cap immediately', async () => {
    const clock = makeFakeClock();
    const l = new TpmLimiter('test', cfg(), clock);
    const t0 = clock.current();
    const lease = await l.acquire(1000);
    expect(lease.estimated).toBe(1000);
    // No sleep should have occurred.
    expect(clock.current()).toBe(t0);
    expect(l.stats().usedTokens).toBe(1000);
  });

  it('rejects a single request that exceeds perRequestMax', async () => {
    const l = new TpmLimiter('test', cfg({ perRequestMax: 5_000 }), makeFakeClock());
    await expect(l.acquire(6_000)).rejects.toBeInstanceOf(HttpError);
    await expect(l.acquire(6_000)).rejects.toMatchObject({ status: 413 });
  });

  it('treats <=0 estimates as no-ops', async () => {
    const l = new TpmLimiter('test', cfg(), makeFakeClock());
    const lease = await l.acquire(0);
    expect(lease.estimated).toBe(0);
    expect(l.stats().usedTokens).toBe(0);
    lease.commit(99); // commit on no-op lease must not record anything
    expect(l.stats().usedTokens).toBe(0);
  });

  it('sleeps the second request when the first fills the window', async () => {
    const clock = makeFakeClock();
    const l = new TpmLimiter('test', cfg({ tpm: 10_000, perRequestMax: 8_000 }), clock);
    const t0 = clock.current();
    await l.acquire(8_000);
    // Second request needs 5_000 but only 2_000 are free → must sleep ~60s.
    await l.acquire(5_000);
    expect(clock.current() - t0).toBeGreaterThanOrEqual(60_000);
  });

  it('serialises concurrent acquirers so the cap is respected', async () => {
    const clock = makeFakeClock();
    const l = new TpmLimiter('test', cfg({ tpm: 10_000, perRequestMax: 8_000 }), clock);
    const order: Array<{ idx: number; t: number }> = [];
    const t0 = clock.current();
    const a = l.acquire(6_000).then(() => order.push({ idx: 0, t: clock.current() - t0 }));
    const b = l.acquire(6_000).then(() => order.push({ idx: 1, t: clock.current() - t0 }));
    await Promise.all([a, b]);
    // Acquisition order is preserved (FIFO), and the second one had to wait
    // for the window to free up (~60s).
    expect(order[0]?.idx).toBe(0);
    expect(order[1]?.idx).toBe(1);
    expect(order[1]?.t).toBeGreaterThanOrEqual(60_000);
  });

  it('frees capacity once entries fall outside the 60s window', async () => {
    const clock = makeFakeClock();
    const l = new TpmLimiter('test', cfg(), clock);
    await l.acquire(8_000);
    clock.advance(60_001);
    const t0 = clock.current();
    await l.acquire(8_000); // should be instant
    expect(clock.current()).toBe(t0);
  });

  it('clamps perRequestMax to tpm if misconfigured', () => {
    const l = new TpmLimiter('test', { tpm: 5_000, perRequestMax: 9_000 }, makeFakeClock());
    expect(l.cfg.perRequestMax).toBe(5_000);
  });
});

describe('Lease.commit / release', () => {
  it('reconciles reservation with the actual usage', async () => {
    const l = new TpmLimiter('test', cfg(), makeFakeClock());
    const lease = await l.acquire(8_000);
    expect(l.stats().usedTokens).toBe(8_000);
    lease.commit(3_500);
    expect(l.stats().usedTokens).toBe(3_500);
  });

  it('release() refunds the full reservation', async () => {
    const l = new TpmLimiter('test', cfg(), makeFakeClock());
    const lease = await l.acquire(5_000);
    lease.release();
    expect(l.stats().usedTokens).toBe(0);
  });

  it('commit is idempotent (second call ignored)', async () => {
    const l = new TpmLimiter('test', cfg(), makeFakeClock());
    const lease = await l.acquire(5_000);
    lease.commit(2_000);
    lease.commit(9_000);
    expect(l.stats().usedTokens).toBe(2_000);
  });
});

describe('withRetryOn429', () => {
  it('returns the value when no error', async () => {
    const v = await withRetryOn429(
      async () => 42,
      { retryMax: 3, retryBaseMs: 10 },
      makeFakeClock(),
    );
    expect(v).toBe(42);
  });

  it('retries on 429 then succeeds', async () => {
    let calls = 0;
    const v = await withRetryOn429(
      async () => {
        calls++;
        if (calls < 3) {
          const err = new Error('rate limit') as Error & { status?: number };
          err.status = 429;
          throw err;
        }
        return 'ok';
      },
      { retryMax: 5, retryBaseMs: 10 },
      makeFakeClock(),
    );
    expect(v).toBe('ok');
    expect(calls).toBe(3);
  });

  it('honours Retry-After header (seconds)', async () => {
    const clock = makeFakeClock();
    let calls = 0;
    const t0 = clock.current();
    await withRetryOn429(
      async () => {
        calls++;
        if (calls === 1) {
          const err = new Error('rate limit') as Error & {
            status?: number;
            headers?: Record<string, string>;
          };
          err.status = 429;
          err.headers = { 'retry-after': '4' };
          throw err;
        }
        return 'ok';
      },
      { retryMax: 3, retryBaseMs: 10 },
      clock,
    );
    expect(clock.current() - t0).toBeGreaterThanOrEqual(4_000);
  });

  it('re-throws non-429 errors immediately', async () => {
    let calls = 0;
    await expect(
      withRetryOn429(
        async () => {
          calls++;
          throw new Error('boom');
        },
        { retryMax: 3, retryBaseMs: 10 },
        makeFakeClock(),
      ),
    ).rejects.toThrow('boom');
    expect(calls).toBe(1);
  });

  it('gives up after retryMax 429s and re-throws the last error', async () => {
    let calls = 0;
    await expect(
      withRetryOn429(
        async () => {
          calls++;
          const err = new Error('rate limit') as Error & { status?: number };
          err.status = 429;
          throw err;
        },
        { retryMax: 2, retryBaseMs: 10 },
        makeFakeClock(),
      ),
    ).rejects.toThrow('rate limit');
    // initial + retryMax retries = 3 attempts
    expect(calls).toBe(3);
  });
});

describe('limiters registry', () => {
  it('returns the same instance per (kind, model)', () => {
    const a = limiters.forChat('gpt-5');
    const b = limiters.forChat('gpt-5');
    expect(a).toBe(b);
  });

  it('chat and embedding limiters are independent per model', () => {
    const c = limiters.forChat('gpt-5');
    const e = limiters.forEmbedding('text-embedding-3-small');
    expect(c).not.toBe(e);
  });

  it('different models yield different limiters', () => {
    const a = limiters.forChat('gpt-5');
    const b = limiters.forChat('gpt-4o');
    expect(a).not.toBe(b);
  });
});
