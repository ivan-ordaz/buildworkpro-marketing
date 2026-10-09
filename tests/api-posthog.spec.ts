import { test, expect, type Page } from '@playwright/test';
import {
  forwardedRequestHeaders,
  INGEST_MARKER_HEADER,
  POSTHOG_API_ORIGIN,
  POSTHOG_ASSETS_ORIGIN,
  posthogUpstreamUrl,
} from '../src/lib/posthog-proxy';

// marketing#227 — the /ingest proxy and PostHog's geo-default posture.
// Preview project (wrangler/workerd over the built output): the /ingest route is
// on-demand rendered, and the geo default is only enabled in production builds.

test.describe('/ingest routing (built output)', () => {
  // `trailingSlash: 'always'` must not swallow PostHog's paths — some have no
  // trailing slash. The marker header proves our route answered (the upstream
  // status itself depends on PostHog, so it is not asserted).
  for (const [method, path] of [
    ['GET', '/ingest/static/array.js'],
    ['GET', '/ingest/array/phc_test/config'],
    ['POST', '/ingest/e/'],
    ['POST', '/ingest/flags/?v=2&config=true'],
  ] as const) {
    test(`${method} ${path} is handled by the proxy, not redirected`, async ({ request }) => {
      const res =
        method === 'GET'
          ? await request.get(path, { maxRedirects: 0 })
          : await request.post(path, { data: '{}', maxRedirects: 0 });
      expect(res.headers()[INGEST_MARKER_HEADER]).toBe('1');
      expect(res.status()).not.toBe(301);
      expect(res.status()).not.toBe(308);
    });
  }

  test('rejects methods PostHog never needs', async ({ request }) => {
    const res = await request.delete('/ingest/e/');
    expect(res.status()).toBe(405);
    expect(res.headers()[INGEST_MARKER_HEADER]).toBe('1');
  });
});

test.describe('/ingest proxy rules', () => {
  test('static assets go to the assets host, everything else to the API host', () => {
    expect(posthogUpstreamUrl('/static/array.js', '').origin).toBe(POSTHOG_ASSETS_ORIGIN);
    const api = posthogUpstreamUrl('/flags/', '?v=2');
    expect(api.origin).toBe(POSTHOG_API_ORIGIN);
    expect(api.pathname + api.search).toBe('/flags/?v=2');
  });

  test('a path cannot steer it to another host', () => {
    expect(posthogUpstreamUrl('//evil.example.com/x', '').origin).toBe(POSTHOG_API_ORIGIN);
  });

  test('never forwards cookies, the client IP or the Referer', () => {
    const sent = forwardedRequestHeaders(
      new Headers({
        cookie: 'ph_x=1; session=secret',
        'cf-connecting-ip': '203.0.113.9',
        'x-forwarded-for': '203.0.113.9',
        referer: 'https://buildworkpro.com/pricing/',
        'user-agent': 'UA',
        'content-type': 'text/plain',
      })
    );
    expect([...sent.keys()].sort()).toEqual(['content-type', 'user-agent']);
  });
});

function stubGeo(page: Page, country: string) {
  return page.route('**/api/geo/', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ country }),
    })
  );
}

async function countIngest(page: Page): Promise<{ count: () => number }> {
  let n = 0;
  await page.route('https://connect.facebook.net/**', (r) => r.abort());
  await page.route('https://www.googletagmanager.com/**', (r) => r.abort());
  await page.route('**/ingest/**', (route) => {
    n += 1;
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  return { count: () => n };
}

test('US visitor with no stored choice: PostHog loads by default, like the Pixel', async ({
  page,
}) => {
  const ingest = await countIngest(page);
  await stubGeo(page, 'US');
  await page.goto('/');
  await expect.poll(ingest.count, { timeout: 10_000 }).toBeGreaterThan(0);
});

test('EEA visitor (DE) with no stored choice: PostHog stays off', async ({ page }) => {
  const ingest = await countIngest(page);
  await stubGeo(page, 'DE');
  await page.goto('/');
  await page.waitForTimeout(1500);
  expect(ingest.count()).toBe(0);
});
