import { test, expect } from '@playwright/test';

// The /templates/ hub and its first page (issue #134). The download must stay
// ungated — the file being freely fetchable is the whole link-magnet strategy
// (Q5 decision: open file, optional email only for the future bundle).

test.describe('templates hub', () => {
  test('the hub lists the pay application template', async ({ page }) => {
    await page.goto('/templates/');
    await expect(page.locator('main h1')).toHaveText(/Free construction templates/i);
    await expect(
      page.getByRole('link', { name: /Pay Application Template/i }).first()
    ).toBeVisible();
  });
});

test.describe('/templates/subcontractor-agreement/', () => {
  test('renders with the download CTA and the not-legal-advice disclaimer', async ({ page }) => {
    await page.goto('/templates/subcontractor-agreement/');
    await expect(page.locator('main h1')).toHaveText(/Subcontractor Agreement Template/i);
    await expect(page.locator('a.template-download').first()).toBeVisible();
    await expect(page.getByText(/Not legal advice/i).first()).toBeVisible();
  });

  test('the document downloads ungated and is a real docx', async ({ page, request }) => {
    await page.goto('/templates/subcontractor-agreement/');
    const href = await page.locator('a.template-download').first().getAttribute('href');
    const res = await request.get(href!);
    expect(res.status()).toBe(200);
    const body = await res.body();
    expect(body.length).toBeGreaterThan(5000);
    expect(body.subarray(0, 2).toString()).toBe('PK');
  });

  test('cross-links to the pay application template', async ({ page }) => {
    await page.goto('/templates/subcontractor-agreement/');
    await expect(page.locator('main a[href="/templates/aia-g702-g703/"]').first()).toBeVisible();
  });
});

test.describe('/templates/aia-g702-g703/', () => {
  test('renders with the download CTA and the trademark disclaimer', async ({ page }) => {
    await page.goto('/templates/aia-g702-g703/');
    await expect(page.locator('main h1')).toHaveText(/Pay Application Template/i);
    await expect(page.locator('a.template-download').first()).toBeVisible();
    await expect(page.getByText(/Not an official AIA document/i).first()).toBeVisible();
  });

  test('the workbook downloads ungated and is a real xlsx', async ({ page, request }) => {
    await page.goto('/templates/aia-g702-g703/');
    const href = await page.locator('a.template-download').first().getAttribute('href');
    expect(href).toBeTruthy();

    const res = await request.get(href!);
    expect(res.status()).toBe(200);
    // xlsx files are zip containers — the PK magic bytes are the cheapest
    // "this is actually a spreadsheet, not an error page" assertion.
    const body = await res.body();
    expect(body.length).toBeGreaterThan(5000);
    expect(body.subarray(0, 2).toString()).toBe('PK');
  });

  test('carries FAQPage structured data', async ({ page }) => {
    await page.goto('/templates/aia-g702-g703/');
    const jsonld = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(jsonld.some((s) => s.includes('FAQPage'))).toBe(true);
  });

  test('links down the funnel to the pay applications feature', async ({ page }) => {
    await page.goto('/templates/aia-g702-g703/');
    // Scoped to main: the header Features dropdown contains the same href in a
    // hidden menu item, which .first() would otherwise match.
    await expect(page.locator('main a[href="/features/pay-applications/"]').first()).toBeVisible();
  });
});
