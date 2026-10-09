import { test, expect, type Page, type Request } from '@playwright/test';

// marketing#227 — PostHog follows the Meta Pixel's consent posture exactly.
// Runs on `astro dev`, where the geo default is off (see Layout.astro), so a
// visitor with no stored choice is in the opt-in posture: nothing loads until
// Accept. The US/EEA geo defaults are covered in api-posthog.spec.ts (preview).
//
// /ingest is stubbed, so no test talks to PostHog.

const POSTHOG_KEY = 'phc_Aprfr56ZmrvJ2T9RA57tj2HRnntB24wtmv6BoEAMfn4x';

async function recordIngest(page: Page): Promise<Request[]> {
  const seen: Request[] = [];
  await page.route('https://connect.facebook.net/**', (r) => r.abort());
  await page.route('https://www.googletagmanager.com/**', (r) => r.abort());
  await page.route('**/ingest/**', (route) => {
    seen.push(route.request());
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  return seen;
}

test('no stored choice (opt-in posture): PostHog is never fetched', async ({ page }) => {
  const ingest = await recordIngest(page);
  await page.goto('/');
  await page.waitForTimeout(1500);
  expect(ingest).toHaveLength(0);
  expect(await page.evaluate(() => document.cookie)).not.toContain(`ph_${POSTHOG_KEY}`);
});

test('stored Accept: PostHog loads through the first-party /ingest proxy', async ({ page }) => {
  const ingest = await recordIngest(page);
  await page.addInitScript(() => localStorage.setItem('bwp-cookies-accepted', '1'));
  await page.goto('/');
  await expect.poll(() => ingest.length, { timeout: 10_000 }).toBeGreaterThan(0);
  // Every call stays on our own origin.
  for (const req of ingest) expect(new URL(req.url()).pathname.startsWith('/ingest/')).toBe(true);
  // The anonymous id lives in the shared cookie the app reads at login.
  await expect
    .poll(() => page.evaluate(() => document.cookie), { timeout: 10_000 })
    .toContain(`ph_${POSTHOG_KEY}_posthog`);
});

test('clicking Accept in the banner starts PostHog on the same pageview', async ({ page }) => {
  const ingest = await recordIngest(page);
  await page.goto('/');
  await page.waitForTimeout(500);
  expect(ingest).toHaveLength(0);
  await page.click('#cookie-accept');
  await expect.poll(() => ingest.length, { timeout: 10_000 }).toBeGreaterThan(0);
});

test('stored Decline: PostHog is never fetched', async ({ page }) => {
  const ingest = await recordIngest(page);
  await page.addInitScript(() => localStorage.setItem('bwp-cookies-declined', '1'));
  await page.goto('/');
  await page.waitForTimeout(1500);
  expect(ingest).toHaveLength(0);
});

test('Decline after Accept opts the running copy out', async ({ page }) => {
  await recordIngest(page);
  await page.addInitScript(() => localStorage.setItem('bwp-cookies-accepted', '1'));
  await page.goto('/');
  await expect
    .poll(() => page.evaluate(() => document.cookie), { timeout: 10_000 })
    .toContain(`ph_${POSTHOG_KEY}_posthog`);
  await page.evaluate(() =>
    (window as unknown as { bwpOpenCookieSettings: () => void }).bwpOpenCookieSettings()
  );
  await page.click('#cookie-decline');
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(`__ph_opt_in_out_${key}`), POSTHOG_KEY))
    .toBe('0');
});
