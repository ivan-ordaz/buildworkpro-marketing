import { test, expect } from '@playwright/test';

// The NatGlass disclosed case study + founder-letter about page (issue #129).
// The affiliation disclosure is the strategy — it must render, not just exist.

test('the case study leads with the disclosure and the real numbers', async ({ page }) => {
  await page.goto('/customers/national-glass/');
  await expect(page.locator('main h1')).toHaveText(/founder's own crew/i);
  await expect(page.getByText(/Full disclosure, up front/i)).toBeVisible();
  await expect(page.getByText('416').first()).toBeVisible();
  await expect(page.getByText('143').first()).toBeVisible();
});

test('the about page is a signed founder letter, not corporate voice', async ({ page }) => {
  await page.goto('/about/');
  await expect(page.locator('main h1')).toHaveText(/Built by a contractor/i);
  // Signed with first name only, per Ivan's preference (2026-08-11).
  await expect(page.getByText(/— Ivan/).first()).toBeVisible();
  await expect(page.locator('main a[href="/customers/national-glass/"]').first()).toBeVisible();
});

test('the sitewide CTA claim is now backed by the case study link', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('a[href="/customers/national-glass/"]').first()).toBeAttached();
});
