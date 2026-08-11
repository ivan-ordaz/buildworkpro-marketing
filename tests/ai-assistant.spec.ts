import { test, expect } from '@playwright/test';

// The AI assistant page (issue #153/#604) — the site's most differentiated
// claim, so the page, its nav entries, and the layman's framing must render.

test('the AI assistant page renders with the founder quote and how-it-works', async ({ page }) => {
  await page.goto('/features/ai-assistant/');
  await expect(page.locator('main h1')).toHaveText(/describing it/i);
  await expect(page.getByText(/chatting with Claude/i).first()).toBeVisible();
  await expect(page.getByText(/How it works/i).first()).toBeVisible();
  // The one allowed technical mention lives inside a collapsed FAQ accordion.
  await expect(page.getByText(/Model Context Protocol/i)).toBeAttached();
});

test('the assistant is reachable from the features nav and index', async ({ page }) => {
  await page.goto('/features/');
  await expect(page.locator('main a[href="/features/ai-assistant/"]').first()).toBeVisible();
});
