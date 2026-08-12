import { test, expect } from '@playwright/test';

/**
 * Server-side coverage for POST /api/template-pack/ (issue #601).
 *
 * Runs under the `api` project (astro preview → wrangler → workerd) for the same
 * reason as api-contact.spec.ts: the route statically imports `cloudflare:workers`,
 * which the dev server cannot execute. See that spec for the full explanation.
 *
 * Assertions are exact — a 404 from a missing trailing slash must never read as
 * "the gate fired".
 */

const PACK = '/api/template-pack/';

test.describe('POST /api/template-pack/', () => {
  test('rejects an empty payload at the Turnstile gate, with a human-readable error', async ({
    request,
  }) => {
    const response = await request.post(PACK, { data: {}, failOnStatusCode: false });

    expect(response.status()).toBe(400);
    expect(await response.json()).toEqual({ error: 'Verification required.' });
  });

  test('rejects a populated payload that carries no Turnstile token', async ({ request }) => {
    const response = await request.post(PACK, {
      data: { email: 'test@example.com' },
      failOnStatusCode: false,
    });

    expect(response.status()).toBe(400);
    expect(await response.json()).toEqual({ error: 'Verification required.' });
  });

  test('rejects malformed JSON without leaking a stack trace', async ({ request }) => {
    const response = await request.post(PACK, {
      headers: { 'content-type': 'application/json' },
      data: '{"email": "unterminated',
      failOnStatusCode: false,
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(Object.keys(body)).toEqual(['error']);
    expect(body.error).not.toMatch(/JSON\.parse|SyntaxError|at \w+ \(/);
  });

  test('never answers a 5xx — a crashed route must not read as a rejection', async ({
    request,
  }) => {
    const response = await request.post(PACK, { data: {}, failOnStatusCode: false });
    expect(response.status()).toBeLessThan(500);
    expect(response.status()).not.toBe(404);
  });
});
