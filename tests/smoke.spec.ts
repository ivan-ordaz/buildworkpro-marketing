import { test, expect } from '@playwright/test';

// Smoke tests verify the site boots and the key public pages render.
// Keep selectors structural (roles, headings, landmarks) — copy changes often.

test.describe('marketing pages', () => {
  test('home renders hero and primary CTAs', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);

    await expect(page).toHaveTitle(/BuildWorkPro/);
    await expect(page.locator('h1').first()).toBeVisible();

    // Pricing and FAQ are anchored sections on the home page.
    await expect(page.locator('#pricing')).toBeAttached();
    await expect(page.locator('#faq')).toBeAttached();
  });

  test('contact page renders the contact form', async ({ page }) => {
    const response = await page.goto('/contact/');
    expect(response?.status()).toBe(200);

    // The layout ships a hidden RequestAccessModal form on every page, so
    // scope to the page's primary contact form by id.
    await expect(page.locator('#contact-form')).toBeVisible();
    await expect(page.locator('#contact-form input[type="email"]')).toBeVisible();
  });

  test('legal pages render', async ({ page }) => {
    for (const path of ['/privacy/', '/terms/', '/cookies/']) {
      const response = await page.goto(path);
      expect(response?.status(), `${path} should return 200`).toBe(200);
      await expect(page.locator('h1').first()).toBeVisible();
    }
  });

  test('about and security pages render', async ({ page }) => {
    for (const path of ['/about/', '/security/']) {
      const response = await page.goto(path);
      expect(response?.status(), `${path} should return 200`).toBe(200);
      await expect(page.locator('h1').first()).toBeVisible();
    }
  });
});

test.describe('docs', () => {
  test('docs landing renders Starlight chrome', async ({ page }) => {
    // Starlight's index lives at the configured root; getting-started is the
    // first sidebar group, so we hit a known concrete page.
    const response = await page.goto('/docs/getting-started/introduction/');
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('developer API reference renders', async ({ page }) => {
    const response = await page.goto('/api/');
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1').first()).toBeVisible();
  });
});

test.describe('error handling', () => {
  test('unknown route returns 404', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist-xyz/');
    expect(response?.status()).toBe(404);
  });
});

test.describe('api endpoints (server-side)', () => {
  test('contact endpoint rejects empty payload', async ({ request }) => {
    const response = await request.post('/api/contact', {
      data: {},
      failOnStatusCode: false,
    });
    // Missing turnstile token / missing required fields → 400.
    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.status()).toBeLessThan(500);
  });
});
