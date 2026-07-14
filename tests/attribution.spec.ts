import { test, expect, type Page } from '@playwright/test';

// UTM passthrough to app signup.
//
// The app's signup page (Signup.tsx) reads acquisition attribution off its own
// query string — utm_source/medium/campaign/content/term, fbclid, gclid,
// landing_page — and forwards it to the server, which persists it on the
// tenant. That whole chain is dead unless the marketing CTAs actually carry
// those params across the buildworkpro.com -> app.buildworkpro.com hop.
//
// Every "Start free trial" CTA renders config.signupUrl, a build-time constant
// with no query string, so the params must be attached client-side: captured on
// the landing page, persisted for the visit (the visitor usually browses before
// converting), and appended to the signup links.

const SIGNUP_ORIGIN = 'https://app.buildworkpro.com/signup';

// Read the decorated href off the first signup CTA on the page.
async function signupHref(page: Page): Promise<string> {
  const href = await page.locator(`a[href^="${SIGNUP_ORIGIN}"]`).first().getAttribute('href');
  return href ?? '';
}

// The signup link's query params, as a plain object.
async function signupParams(page: Page): Promise<Record<string, string>> {
  return Object.fromEntries(new URL(await signupHref(page)).searchParams);
}

test.describe('signup CTA attribution passthrough', () => {
  test('forwards utm params from the landing URL to the signup link', async ({ page }) => {
    await page.goto(
      '/?utm_source=facebook&utm_medium=paid_social&utm_campaign=subs_q3&utm_content=procore_alt_ad&utm_term=bidding_software'
    );

    expect(await signupParams(page)).toMatchObject({
      utm_source: 'facebook',
      utm_medium: 'paid_social',
      utm_campaign: 'subs_q3',
      utm_content: 'procore_alt_ad',
      utm_term: 'bidding_software',
    });
  });

  test('forwards ad-platform click ids (fbclid, gclid)', async ({ page }) => {
    // Meta and Google append these automatically on ad clicks even when the
    // ad has no UTMs configured — so this is the floor of what we must carry.
    await page.goto('/?fbclid=IwAR_test_click_id&gclid=Cj0KCQ_test');

    expect(await signupParams(page)).toMatchObject({
      fbclid: 'IwAR_test_click_id',
      gclid: 'Cj0KCQ_test',
    });
  });

  test('records the landing page the attributed visit arrived on', async ({ page }) => {
    await page.goto('/solutions/roofing-contractors/?utm_source=facebook');

    expect(await signupParams(page)).toMatchObject({
      utm_source: 'facebook',
      landing_page: '/solutions/roofing-contractors/',
    });
  });

  test('attribution survives browsing to another page before converting', async ({ page }) => {
    // The real funnel: land from the ad, read a feature page, THEN click the
    // CTA. The second page load carries no params of its own.
    await page.goto('/?utm_source=facebook&utm_campaign=subs_q3');
    await page.goto('/features/construction-bidding/');

    expect(await signupParams(page)).toMatchObject({
      utm_source: 'facebook',
      utm_campaign: 'subs_q3',
      // landing_page stays the page the ad actually pointed at, not the page
      // the visitor happened to convert from.
      landing_page: '/',
    });
  });

  test('a later attributed visit overwrites the stored attribution (last touch)', async ({
    page,
  }) => {
    await page.goto('/?utm_source=facebook&utm_campaign=old');
    await page.goto('/?utm_source=google&utm_campaign=new');

    expect(await signupParams(page)).toMatchObject({
      utm_source: 'google',
      utm_campaign: 'new',
    });
  });

  test('leaves the signup link untouched for organic visits', async ({ page }) => {
    await page.goto('/');

    // No attribution to forward — no stray query string on the CTA.
    expect(await signupHref(page)).toBe(SIGNUP_ORIGIN);
  });

  test('decorates every signup CTA on the page, not just the first', async ({ page }) => {
    await page.goto('/?utm_source=facebook');

    const hrefs = await page
      .locator(`a[href^="${SIGNUP_ORIGIN}"]`)
      .evaluateAll((links) =>
        links.map((l) => (l as HTMLAnchorElement).getAttribute('href') ?? '')
      );

    expect(hrefs.length).toBeGreaterThan(1);
    for (const href of hrefs) {
      expect(new URL(href).searchParams.get('utm_source')).toBe('facebook');
    }
  });

  test('ignores unknown params and encodes hostile values', async ({ page }) => {
    await page.goto('/?utm_source=fb%20ads%26x%3D1&sneaky=should_not_forward');

    const params = await signupParams(page);
    // Round-trips through URL parsing intact — no query-string injection.
    expect(params.utm_source).toBe('fb ads&x=1');
    expect(params.sneaky).toBeUndefined();
  });

  test('conversion tracking still fires when the CTA href carries attribution', async ({
    page,
  }) => {
    // Regression guard: the analytics listener in Layout.astro identifies CTAs
    // with `a.href.indexOf(signupUrl) !== 0`. Appending a query string must
    // keep signupUrl a prefix, or decorating the links silently kills the
    // InitiateCheckout / start_trial conversion events.
    await page.route('https://connect.facebook.net/**', (r) => r.abort());
    await page.route('https://www.googletagmanager.com/**', (r) => r.abort());

    await page.goto('/?utm_source=facebook');
    await page.click('#cookie-accept');
    await page.waitForFunction(
      () => (window as { __bwpGALoaded?: boolean }).__bwpGALoaded === true
    );
    await page.evaluate(() => document.addEventListener('click', (e) => e.preventDefault(), true));

    await page
      .getByRole('link', { name: /start free trial/i })
      .first()
      .click();

    const events = await page.evaluate(() =>
      ((window as { dataLayer?: unknown[][] }).dataLayer || []).filter(
        (d) => d[0] === 'event' && d[1] === 'start_trial'
      )
    );
    expect(events.length).toBeGreaterThan(0);
  });
});
