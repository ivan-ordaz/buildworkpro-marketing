import { test, expect, type Page } from '@playwright/test';

// Verifies the Consent Mode v2 analytics posture wired into Layout.astro:
//  • GA4 loads on every page by default and sends events cookielessly (no
//    consent action required) — visible in window.dataLayer.
//  • The Meta Pixel has no cookieless mode, so it loads only after Accept —
//    visible in window.fbq.queue.
//  • Decline fully disables GA (ga-disable flag) and never loads the Pixel.
//
// We block the real fbevents.js / gtag.js network so the trackers stay as their
// local queue stubs, making assertions deterministic without hitting
// Meta/Google servers in CI.

declare global {
  interface Window {
    dataLayer: unknown[][];
    fbq?: { queue?: unknown[][] } & ((...args: unknown[]) => void);
    __bwpGALoaded?: boolean;
    __bwpPixelLoaded?: boolean;
  }
}

test.beforeEach(async ({ page }) => {
  await page.route('https://connect.facebook.net/**', (r) => r.abort());
  await page.route('https://www.googletagmanager.com/**', (r) => r.abort());
});

function gaEvents(page: Page, name: string) {
  return page.evaluate(
    (n) => (window.dataLayer || []).filter((d) => d[0] === 'event' && d[1] === n),
    name
  );
}

function metaEvents(page: Page, name: string) {
  return page.evaluate((n) => {
    const q = (window.fbq && window.fbq.queue) || [];
    return q.filter((a) => a[0] === 'track' && a[1] === n);
  }, name);
}

// Cancel real navigation so the page (and its tracker state) survive a CTA
// click. preventDefault in a capture listener stops navigation but still lets
// the bubble-phase analytics listener run.
async function cancelNavigation(page: Page) {
  await page.evaluate(() => {
    document.addEventListener('click', (e) => e.preventDefault(), true);
  });
}

test.describe('consent posture', () => {
  test('new visitor: GA4 loads cookieless by default, Meta Pixel does not', async ({ page }) => {
    await page.goto('/');
    expect(await page.evaluate(() => window.__bwpGALoaded === true)).toBe(true);
    expect(await page.evaluate(() => typeof window.fbq)).toBe('undefined');
    // GA is NOT disabled — the visitor hasn't declined.
    expect(
      await page.evaluate(
        () => (window as unknown as Record<string, unknown>)['ga-disable-G-REK78NBR14']
      )
    ).not.toBe(true);
  });

  test('decline disables GA entirely and never loads the Pixel', async ({ page }) => {
    await page.goto('/');
    await page.click('#cookie-decline');
    expect(
      await page.evaluate(
        () => (window as unknown as Record<string, unknown>)['ga-disable-G-REK78NBR14'] === true
      )
    ).toBe(true);
    expect(await page.evaluate(() => typeof window.fbq)).toBe('undefined');
  });
});

test.describe('conversion-event tracking', () => {
  test('CTA click before consent sends start_trial to GA (cookieless), nothing to Meta', async ({
    page,
  }) => {
    await page.goto('/');
    await cancelNavigation(page);
    await page
      .getByRole('link', { name: /start free trial/i })
      .first()
      .click();
    expect((await gaEvents(page, 'start_trial')).length).toBeGreaterThan(0);
    expect(await page.evaluate(() => typeof window.fbq)).toBe('undefined');
  });

  test('feature page sends view_feature to GA cookielessly on load', async ({ page }) => {
    await page.goto('/features/construction-bidding/');
    const ga = await gaEvents(page, 'view_feature');
    expect(ga.length).toBeGreaterThan(0);
    expect((ga[0] as unknown[])[2]).toMatchObject({ feature: 'construction-bidding' });
  });

  test('pricing scroll sends view_pricing to GA cookielessly', async ({ page }) => {
    await page.goto('/');
    await page.locator('#pricing').scrollIntoViewIfNeeded();
    await page.waitForFunction(() =>
      (window.dataLayer || []).some((d) => d[0] === 'event' && d[1] === 'view_pricing')
    );
    expect((await gaEvents(page, 'view_pricing')).length).toBeGreaterThan(0);
  });

  test('after accept, the Pixel loads and a CTA click fires both GA + Meta', async ({ page }) => {
    await page.goto('/');
    await page.click('#cookie-accept');
    await page.waitForFunction(() => window.__bwpPixelLoaded === true);
    await cancelNavigation(page);
    await page
      .getByRole('link', { name: /start free trial/i })
      .first()
      .click();
    expect((await gaEvents(page, 'start_trial')).length).toBeGreaterThan(0);
    expect((await metaEvents(page, 'InitiateCheckout')).length).toBeGreaterThan(0);
  });

  test('returning accepter: feature view reaches BOTH GA and Meta on load', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('bwp-cookies-accepted', '1');
      } catch {
        /* ignore */
      }
    });
    await page.goto('/features/construction-bidding/');
    await page.waitForFunction(() => window.__bwpPixelLoaded === true);
    expect((await gaEvents(page, 'view_feature')).length).toBeGreaterThan(0);
    expect((await metaEvents(page, 'ViewContent')).length).toBeGreaterThan(0);
  });
});
