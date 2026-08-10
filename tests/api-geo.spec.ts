import { test, expect } from '@playwright/test';

// /api/geo/ under the real Workers runtime (issue #125). Locally no Cloudflare
// edge sits in front of the preview server, so the header is client-supplied;
// in production Cloudflare overwrites CF-IPCountry at the edge.

test('returns null country when CF-IPCountry is absent', async ({ request }) => {
  const res = await request.get('/api/geo/');
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ country: null });
  expect(res.headers()['cache-control']).toContain('no-store');
});

test('reflects CF-IPCountry when present', async ({ request }) => {
  const res = await request.get('/api/geo/', { headers: { 'CF-IPCountry': 'us' } });
  expect((await res.json()).country).toBe('US');
});

test('maps the unknown sentinel to null', async ({ request }) => {
  const res = await request.get('/api/geo/', { headers: { 'CF-IPCountry': 'XX' } });
  expect((await res.json()).country).toBeNull();
});
