import { test, expect, type Page } from '@playwright/test';

// Geo-gated consent default (issue #125). US is the target market: visitors
// outside the EEA/UK/CH get measurement on by default with a working opt-out;
// opt-in is preserved for the EEA list, and every failure path stays opt-in.
// The /api/geo/ lookup is stubbed per test so each posture is deterministic.

declare global {
  interface Window {
    fbq?: unknown;
    __bwpPixelLoaded?: boolean;
    __bwpGALoaded?: boolean;
  }
}

function stubGeo(page: Page, body: string, status = 200) {
  return page.route('**/api/geo/', (route) =>
    route.fulfill({ status, contentType: 'application/json', body })
  );
}

test('US visitor with no stored choice: pixel + full analytics load by default', async ({
  page,
}) => {
  await stubGeo(page, JSON.stringify({ country: 'US' }));
  await page.goto('/');
  await page.waitForFunction(() => window.__bwpPixelLoaded === true);
  expect(await page.evaluate(() => window.__bwpGALoaded === true)).toBe(true);
});

test('EEA visitor (DE) with no stored choice: stays opt-in, no pixel', async ({ page }) => {
  await stubGeo(page, JSON.stringify({ country: 'DE' }));
  await page.goto('/');
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => typeof window.fbq)).toBe('undefined');
  expect(await page.evaluate(() => window.__bwpGALoaded === true)).toBe(true);
});

test('geo lookup failure fails closed to opt-in', async ({ page }) => {
  await stubGeo(page, 'oops', 500);
  await page.goto('/');
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => typeof window.fbq)).toBe('undefined');
});

test('stored decline beats the US geo default', async ({ page }) => {
  await stubGeo(page, JSON.stringify({ country: 'US' }));
  await page.addInitScript(() => localStorage.setItem('bwp-cookies-declined', '1'));
  await page.goto('/');
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => typeof window.fbq)).toBe('undefined');
  expect(await page.evaluate(() => (window as never)['ga-disable-G-REK78NBR14'])).toBe(true);
});

test('declining after a US default load is remembered on the next pageview', async ({ page }) => {
  await stubGeo(page, JSON.stringify({ country: 'US' }));
  await page.goto('/');
  await page.waitForFunction(() => window.__bwpPixelLoaded === true);
  await page.getByRole('button', { name: 'Decline' }).click();
  expect(await page.evaluate(() => localStorage.getItem('bwp-cookies-declined'))).toBeTruthy();
  await page.goto('/');
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => window.__bwpPixelLoaded === true)).toBe(false);
});
