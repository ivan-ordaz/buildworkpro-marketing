import { test, expect } from '@playwright/test';

// Pricing lives as a section on the home page (#pricing), reachable from the nav
// as /#pricing. There has never been a /pricing/ route — so every visitor who
// typed the obvious URL, clicked a search result, or followed an ad pointing at
// it got a 404. Nothing on the site links there, which is exactly why it went
// unnoticed: the only people hitting it were arriving from outside.
//
// A standalone pricing page is a separate, design-approved piece of work. This
// just stops the bleeding.

test.describe('/pricing/ resolves instead of 404ing', () => {
  test('lands the visitor on the pricing section rather than a 404', async ({ page }) => {
    const response = await page.goto('/pricing/');

    expect(response?.status()).toBe(200);
    await expect(page.locator('#pricing')).toBeVisible();
  });

  // The bare /pricing (no trailing slash) — the form a human actually types — is
  // NOT covered here, and is not something this config can fix: the site is
  // trailingSlash:'always', so Astro folds a '/pricing' redirect key into
  // '/pricing/'. Whether the no-slash URL 301s to the slashed one is Cloudflare's
  // trailing-slash normalization, which `astro dev` does not reproduce (it 404s
  // locally). Must be checked against the deployed site, not asserted here.
});
