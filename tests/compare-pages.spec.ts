import { test, expect } from '@playwright/test';

// JobTread + Knowify alternative pages (issue #147/#602). Pattern-inherited
// from the three existing compare pages, so a render + table + pricing
// disclaimer check per page suffices.
for (const [slug, name] of [
  ['jobtread-alternative', 'JobTread'],
  ['knowify-alternative', 'Knowify'],
] as const) {
  test(`/compare/${slug}/ renders with table and pricing disclaimer`, async ({ page }) => {
    await page.goto(`/compare/${slug}/`);
    await expect(page.locator('main h1')).toContainText(new RegExp(name, 'i'));
    await expect(page.getByText(/at a glance/i)).toBeVisible();
    await expect(page.getByText(/Verify current pricing/i).first()).toBeVisible();
  });
}

// Competitor cost-guide posts (issue #148/#603).
for (const [slug, h1] of [
  ['buildertrend-pricing', /Buildertrend Pricing/i],
  ['procore-pricing-for-subcontractors', /Procore Pricing/i],
] as const) {
  test(`/blog/${slug}/ renders with sources and verify disclaimer`, async ({ page }) => {
    await page.goto(`/blog/${slug}/`);
    await expect(page.locator('main h1')).toHaveText(h1);
    await expect(page.getByText(/verify current pricing/i).first()).toBeVisible();
    await expect(page.getByText(/Key takeaways/i)).toBeVisible();
  });
}
