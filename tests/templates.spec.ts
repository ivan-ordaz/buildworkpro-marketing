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

  test('the complete-pack email form renders without gating the downloads', async ({ page }) => {
    await page.goto('/templates/');
    const form = page.locator('#template-pack-form');
    await expect(form).toBeVisible();
    await expect(form.locator('input[type="email"]')).toBeVisible();
    // Consent stays explicit — same GDPR pattern as the contact form.
    await expect(form.locator('#template-pack-consent')).toBeAttached();
    // The individual downloads above the form must remain ungated links, not
    // form-triggered — the open-file strategy is the whole point (Q5).
    await expect(
      page.getByRole('link', { name: /Pay Application Template/i }).first()
    ).toBeVisible();
  });
});

// Pages 6–9 share one page template — loop-verify render + real-file download.
for (const [slug, h1] of [
  ['change-order', /Construction Change Order Template/i],
  ['punch-list', /Construction Punch List Template/i],
  ['construction-invoice', /Construction Invoice Template/i],
  ['construction-schedule', /Construction Schedule Template/i],
] as const) {
  test(`/templates/${slug}/ renders and its file downloads`, async ({ page, request }) => {
    await page.goto(`/templates/${slug}/`);
    await expect(page.locator('main h1')).toHaveText(h1);
    const href = await page.locator('a.template-download').first().getAttribute('href');
    const res = await request.get(href!);
    expect(res.status()).toBe(200);
    expect((await res.body()).subarray(0, 2).toString()).toBe('PK');
  });
}

test('the daily-report post finally delivers its promised download', async ({ page, request }) => {
  await page.goto('/blog/construction-daily-report-template/');
  const link = page.locator('main a.template-download').first();
  await expect(link).toBeVisible();
  const res = await request.get((await link.getAttribute('href'))!);
  expect(res.status()).toBe(200);
  expect((await res.body()).subarray(0, 2).toString()).toBe('PK');
});

test.describe('/templates/construction-bid-proposal/', () => {
  test('renders and the document downloads as a real docx', async ({ page, request }) => {
    await page.goto('/templates/construction-bid-proposal/');
    await expect(page.locator('main h1')).toHaveText(/Construction Bid Proposal Template/i);
    const href = await page.locator('a.template-download').first().getAttribute('href');
    const res = await request.get(href!);
    expect(res.status()).toBe(200);
    expect((await res.body()).subarray(0, 2).toString()).toBe('PK');
  });

  test('the bidding guide links to the template', async ({ page }) => {
    await page.goto('/blog/how-to-create-construction-bid/');
    await expect(
      page.locator('main a[href="/templates/construction-bid-proposal/"]').first()
    ).toBeVisible();
  });
});

test.describe('/templates/construction-estimate/', () => {
  test('renders and the workbook downloads as a real xlsx', async ({ page, request }) => {
    await page.goto('/templates/construction-estimate/');
    await expect(page.locator('main h1')).toHaveText(/Construction Estimate Template/i);
    const href = await page.locator('a.template-download').first().getAttribute('href');
    const res = await request.get(href!);
    expect(res.status()).toBe(200);
    expect((await res.body()).subarray(0, 2).toString()).toBe('PK');
  });

  test('the markup-vs-margin post links to the template', async ({ page }) => {
    await page.goto('/blog/construction-markup-vs-margin/');
    await expect(
      page.locator('main a[href="/templates/construction-estimate/"]').first()
    ).toBeVisible();
  });
});

test.describe('/templates/schedule-of-values/', () => {
  test('renders and the workbook downloads as a real xlsx', async ({ page, request }) => {
    await page.goto('/templates/schedule-of-values/');
    await expect(page.locator('main h1')).toHaveText(/Schedule of Values Template/i);
    const href = await page.locator('a.template-download').first().getAttribute('href');
    const res = await request.get(href!);
    expect(res.status()).toBe(200);
    expect((await res.body()).subarray(0, 2).toString()).toBe('PK');
  });

  test('the SOV guide post links to the template download', async ({ page }) => {
    await page.goto('/blog/schedule-of-values-guide/');
    await expect(
      page.locator('main a[href="/templates/schedule-of-values/"]').first()
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
