import { test, expect } from '@playwright/test';

// A real /pricing/ page, replacing the 301-to-#pricing stop-gap.
//
// Pricing had only ever existed as a section on the home page, so everyone who
// arrived from outside — typing the URL, following a search result, clicking an
// ad — hit a 404. This page is the thing ads and search can actually land on.
//
// Design: docs/superpowers/specs/2026-07-14-pricing-page-design.md

const SIGNUP_ORIGIN = 'https://app.buildworkpro.com/signup';

test.describe('/pricing/ page', () => {
  test('renders the plan instead of redirecting away', async ({ page }) => {
    const response = await page.goto('/pricing/');

    expect(response?.status()).toBe(200);
    // The redirect must be gone: a 301 to /#pricing would land us on the home
    // page, not here. A redirect and a real page cannot both own this URL.
    expect(new URL(page.url()).pathname).toBe('/pricing/');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('shows the monthly price and the trial terms', async ({ page }) => {
    await page.goto('/pricing/');

    await expect(page.getByText('$79', { exact: false }).first()).toBeVisible();
    await expect(page.getByText(/14-day free trial/i).first()).toBeVisible();
    await expect(page.getByText(/no credit card/i).first()).toBeVisible();
  });

  test('the annual toggle switches the headline figure to the yearly price', async ({ page }) => {
    await page.goto('/pricing/');

    const amount = page.locator('[data-testid="plan-amount"]');
    await expect(amount).toHaveText('$79');

    await page.getByRole('button', { name: /annual/i }).click();
    await expect(amount).toHaveText('$790');

    await page.getByRole('button', { name: /monthly/i }).click();
    await expect(amount).toHaveText('$79');
  });

  test('the CTA points at the app signup URL', async ({ page }) => {
    await page.goto('/pricing/');

    // Must be config.signupUrl, not a hand-written /signup href — the marketing
    // attribution passthrough only decorates links prefixed with signupUrl, so a
    // hard-coded href would silently drop the ad click id on the one page most
    // likely to BE an ad landing page.
    const cta = page.locator(`a[href^="${SIGNUP_ORIGIN}"]`).first();
    await expect(cta).toBeVisible();
  });

  test('an ad-attributed visitor keeps their click id through the pricing CTA', async ({ page }) => {
    await page.goto('/pricing/?utm_source=facebook&fbclid=IwAR_pricing_click');

    const href = await page.locator(`a[href^="${SIGNUP_ORIGIN}"]`).first().getAttribute('href');
    const params = new URL(href ?? '').searchParams;

    expect(params.get('fbclid')).toBe('IwAR_pricing_click');
    expect(params.get('utm_source')).toBe('facebook');
  });

  test('answers the questions people leave over', async ({ page }) => {
    await page.goto('/pricing/');

    const faq = page.locator('[data-testid="pricing-faq"]');
    await expect(faq).toContainText(/14 days are up/i);
    await expect(faq).toContainText(/per user/i);
    await expect(faq).toContainText(/cancel/i);
  });

  test('the header nav links to the page, so it is not an orphan', async ({ page }) => {
    await page.goto('/');

    // Internal links are what let the page rank at all.
    await expect(page.locator('header a[href="/pricing/"]').first()).toBeVisible();
  });
});
