import { test, expect } from '@playwright/test';
import { checkRateLimit, type RateLimiter } from '../src/lib/rate-limit';

// Unit tests for the form rate limiter. These run under the Playwright test
// runner (Node, no browser) alongside the smoke specs.

const limiterReturning = (...results: boolean[]): RateLimiter => {
  let i = 0;
  return { limit: async () => ({ success: results[i++] ?? true }) };
};

test.describe('checkRateLimit', () => {
  test('allows when no limiter is bound (local dev / unconfigured)', async () => {
    expect(await checkRateLimit(undefined, ['contact:ip:1.2.3.4'])).toBe(true);
  });

  test('allows when every key is under its limit', async () => {
    expect(await checkRateLimit(limiterReturning(true, true), ['ip', 'email'])).toBe(true);
  });

  test('blocks when any key is over its limit', async () => {
    expect(await checkRateLimit(limiterReturning(true, false), ['ip', 'email'])).toBe(false);
  });

  test('stops at the first blocked key (short-circuits)', async () => {
    let calls = 0;
    const limiter: RateLimiter = {
      limit: async () => {
        calls += 1;
        return { success: false };
      },
    };
    expect(await checkRateLimit(limiter, ['ip', 'email'])).toBe(false);
    expect(calls).toBe(1);
  });

  test('fails open when the limiter throws', async () => {
    const limiter: RateLimiter = {
      limit: async () => {
        throw new Error('limiter unavailable');
      },
    };
    expect(await checkRateLimit(limiter, ['ip'])).toBe(true);
  });
});
