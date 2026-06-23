import { test, expect, type Page } from '@playwright/test';

// Verifies the conversion-event instrumentation wired into Layout.astro:
// events reach GA4 (window.dataLayer) and the Meta Pixel (window.fbq.queue)
// only after cookie consent, and the right event fires for each funnel step.
//
// We block the real fbevents.js / gtag.js network requests so the trackers
// stay as their local queue stubs — fbq calls accumulate in `fbq.queue` and
// gtag calls in `dataLayer`, making assertions deterministic without depending
// on Meta/Google servers loading in CI.

declare global {
  interface Window {
    dataLayer: unknown[][];
    fbq?: { queue?: unknown[][] } & ((...args: unknown[]) => void);
    __bwpGALoaded?: boolean;
  }
}

test.beforeEach(async ({ page }) => {
  await page.route('https://connect.facebook.net/**', (r) => r.abort());
  await page.route('https://www.googletagmanager.com/**', (r) => r.abort());
});

async function acceptCookies(page: Page) {
  await page.click('#cookie-accept');
  await page.waitForFunction(() => window.__bwpGALoaded === true);
}

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
// click. preventDefault in a capture listener stops the navigation but still
// lets the bubble-phase analytics listener run.
async function cancelNavigation(page: Page) {
  await page.evaluate(() => {
    document.addEventListener('click', (e) => e.preventDefault(), true);
  });
}

test.describe('conversion-event tracking', () => {
  test('signup CTA click fires InitiateCheckout (Meta) + start_trial (GA4)', async ({ page }) => {
    await page.goto('/');
    await acceptCookies(page);
    await cancelNavigation(page);

    await page
      .getByRole('link', { name: /start free trial/i })
      .first()
      .click();

    expect((await gaEvents(page, 'start_trial')).length).toBeGreaterThan(0);
    expect((await metaEvents(page, 'InitiateCheckout')).length).toBeGreaterThan(0);
  });

  test('pricing section scroll fires ViewContent (Meta) + view_pricing (GA4)', async ({ page }) => {
    await page.goto('/');
    await acceptCookies(page);

    await page.locator('#pricing').scrollIntoViewIfNeeded();
    await page.waitForFunction(() =>
      (window.dataLayer || []).some((d) => d[0] === 'event' && d[1] === 'view_pricing')
    );

    expect((await metaEvents(page, 'ViewContent')).length).toBeGreaterThan(0);
  });

  test('feature page fires ViewContent (Meta) + view_feature (GA4) on consent', async ({
    page,
  }) => {
    await page.goto('/features/construction-bidding/');
    await acceptCookies(page);

    const ga = await gaEvents(page, 'view_feature');
    expect(ga.length).toBeGreaterThan(0);
    expect((ga[0] as unknown[])[2]).toMatchObject({ feature: 'construction-bidding' });
    expect((await metaEvents(page, 'ViewContent')).length).toBeGreaterThan(0);
  });

  test('no conversion events fire before consent', async ({ page }) => {
    await page.goto('/features/construction-bidding/');

    // The page-load feature view must NOT have fired without consent.
    expect((await gaEvents(page, 'view_feature')).length).toBe(0);
    // The Meta Pixel must not even be loaded.
    expect(await page.evaluate(() => typeof window.fbq)).toBe('undefined');

    // A CTA click is also a no-op while consent is withheld.
    await cancelNavigation(page);
    await page
      .getByRole('link', { name: /start free trial/i })
      .first()
      .click();
    expect((await gaEvents(page, 'start_trial')).length).toBe(0);
  });
});
