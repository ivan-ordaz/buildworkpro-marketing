import { test, expect } from '@playwright/test';

/**
 * Server-side coverage for POST /api/contact/.
 *
 * Runs under the `api` project, which is pointed at `astro preview` (wrangler →
 * workerd) rather than `astro dev`. That is not a preference — `src/pages/api/
 * contact.ts` statically imports `cloudflare:workers`, and the dev server resolves
 * SSR modules in Astro's Node environment because the adapter is pinned to
 * `prerenderEnvironment: 'node'` (which the build requires: under workerd, `satteri`
 * resolves to its browser entry and fails on `@bruits/satteri-wasm32-wasi`). In dev
 * the route therefore 500s with FailedToLoadModuleSSR. Only the real Workers runtime
 * can execute it, so only the real Workers runtime can test it.
 *
 * Every assertion here is exact. The previous version of this test asserted
 * `400 <= status < 500` against `/api/contact` — no trailing slash — and passed on
 * the resulting 404 for months without ever reaching the endpoint.
 */

// `trailingSlash: 'always'`: the un-slashed form is a redirect in production and a
// 404 in dev. Address the canonical form directly so a redirect can never be what
// the assertions actually measure.
const CONTACT = '/api/contact/';

test.describe('POST /api/contact/', () => {
  test('rejects an empty payload at the Turnstile gate, with a human-readable error', async ({
    request,
  }) => {
    const response = await request.post(CONTACT, { data: {}, failOnStatusCode: false });

    // Exactly 400 — not "some 4xx". A 404 here means the route did not resolve.
    expect(response.status()).toBe(400);
    expect(await response.json()).toEqual({ error: 'Verification required.' });
  });

  test('rejects a fully-populated payload that carries no Turnstile token', async ({ request }) => {
    // Proves the gate fires on the shape a real form submits, not just on `{}`
    // failing an early field check.
    const response = await request.post(CONTACT, {
      data: {
        name: 'Test Person',
        email: 'test@example.com',
        company: 'Test Co',
        message: 'Hello from the E2E suite.',
      },
      failOnStatusCode: false,
    });

    expect(response.status()).toBe(400);
    expect(await response.json()).toEqual({ error: 'Verification required.' });
  });

  test('rejects malformed JSON without leaking a stack trace', async ({ request }) => {
    const response = await request.post(CONTACT, {
      headers: { 'content-type': 'application/json' },
      data: '{"name": "unterminated',
      failOnStatusCode: false,
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    // The contract is `{ error: <human message> }` — never a driver/parser dump.
    expect(Object.keys(body)).toEqual(['error']);
    expect(body.error).not.toMatch(/JSON\.parse|SyntaxError|at \w+ \(/);
  });

  test('never answers a 5xx — a crashed route must not read as a rejection', async ({
    request,
  }) => {
    // The regression guard. FailedToLoadModuleSSR (the dev-server behaviour) is a
    // 500; if this suite ever gets pointed back at a runtime that cannot execute
    // the route, this fails loudly instead of passing on a 404.
    const response = await request.post(CONTACT, { data: {}, failOnStatusCode: false });
    expect(response.status()).toBeLessThan(500);
    expect(response.status()).not.toBe(404);
  });
});
