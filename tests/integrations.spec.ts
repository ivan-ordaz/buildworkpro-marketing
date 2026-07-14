import { test, expect } from '@playwright/test';

// QuickBooks Online shipped and is live in production — app.buildworkpro.com
// reports `qboConfigured: true`, so a real customer can connect their QB company
// today. The marketing site said otherwise: the integration card and the FAQ were
// both commented out ("Restore at launch"), and the integrations page offered a
// "QuickBooks Waitlist" mailto. Accounting sync is a top buying criterion for
// subcontractors, so hiding a shipped integration — and telling prospects to join
// a waitlist for it — is a straight funnel leak.

test.describe('QuickBooks is presented as the live integration it is', () => {
  test('the integrations page lists QuickBooks as available', async ({ page }) => {
    await page.goto('/integrations/');

    const card = page.locator('a', { hasText: 'QuickBooks' }).first();
    await expect(card).toBeVisible();
    await expect(card).toContainText('Available');
    await expect(card).not.toContainText('Coming Soon');
  });

  test('no waitlist mailto for a shipped integration', async ({ page }) => {
    await page.goto('/integrations/');

    // A waitlist signup for something the visitor could connect right now is
    // worse than no mention at all — it reads as "not built yet".
    await expect(page.locator('a[href*="QuickBooks%20Waitlist"]')).toHaveCount(0);
  });

  test('the QuickBooks card links somewhere useful instead of an email', async ({ page }) => {
    await page.goto('/integrations/');

    const href = await page.locator('a', { hasText: 'QuickBooks' }).first().getAttribute('href');
    expect(href).not.toContain('mailto:');
    expect(href).toBeTruthy();
  });

  test('the home page integrations section includes QuickBooks', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('#integrations')).toContainText('QuickBooks');
  });

  test('the FAQ answers the QuickBooks question', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('#faq')).toContainText('QuickBooks');
  });
});
