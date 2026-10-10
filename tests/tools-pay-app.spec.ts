import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { computeApp, money, rollForward, sampleState } from '../src/lib/pay-app/math';

// /tools/pay-app/ — the browser-side pay application builder. The expected
// numbers come from the same math module the page uses, so a change to the
// certificate math shows up here as a deliberate diff, not a magic constant.

const TOOL_PATH = '/tools/pay-app/';
const sample = sampleState();
const calc = computeApp(sample.rows, sample.app.ratePct, sample.app.prevCertified);

// The first request after a cold `astro dev` start transforms the page's
// module graph, which can take longer than the default expect timeout.
async function openTool(page: Page) {
  await page.goto(TOOL_PATH);
  await expect(page.locator('[data-payapp][data-ready="true"]')).toBeVisible({ timeout: 30_000 });
}

const row = (page: Page, index: number) => page.locator('[data-sov-body] tr').nth(index);
const out = (page: Page, key: string) => page.locator(`[data-out="${key}"]`).first();

test.describe('/tools/pay-app/', () => {
  test('renders the worked example with the certificate math and is indexable', async ({
    page,
  }) => {
    await openTool(page);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Pay Application Builder');
    await expect(page.locator('[data-sov-body] tr')).toHaveCount(sample.rows.length);
    await expect(out(page, 'title')).toContainText('Pay Application #3');
    await expect(out(page, 'base')).toHaveText(money(calc.base));
    await expect(out(page, 'net')).toHaveText(money(calc.net));
    await expect(out(page, 'revised')).toHaveText(money(calc.revised));
    await expect(out(page, 'retainage')).toHaveText(money(calc.retainage));
    await expect(out(page, 'earned')).toHaveText(money(calc.earned));
    await expect(out(page, 'due')).toHaveText(money(calc.due));
    await expect(out(page, 'balance')).toHaveText(money(calc.balance));

    const robots = page.locator('meta[name="robots"]');
    if ((await robots.count()) > 0) {
      await expect(robots).not.toHaveAttribute('content', /noindex/);
    }
    const schemas = await page
      .locator('script[type="application/ld+json"]')
      .evaluateAll((nodes) => nodes.map((n) => n.textContent ?? ''));
    expect(schemas.filter((s) => s.includes('"FAQPage"'))).toHaveLength(1);
  });

  test('recomputes when this period changes and persists across a reload', async ({ page }) => {
    await openTool(page);
    const thisPeriod = row(page, 4).locator('[data-f="e"]'); // line 5, HVAC equipment
    await thisPeriod.fill('30000');
    const rows = sample.rows.map((r, i) => (i === 4 ? { ...r, e: 30000 } : r));
    const edited = computeApp(rows, sample.app.ratePct, sample.app.prevCertified);
    await expect(out(page, 'due')).toHaveText(money(edited.due));
    await expect(page.locator('[data-status]')).toHaveText(/saved in this browser/i);

    await page.reload();
    await expect(page.locator('[data-payapp][data-ready="true"]')).toBeVisible();
    await expect(row(page, 4).locator('[data-f="e"]')).toHaveValue(money(30000));
    await expect(out(page, 'due')).toHaveText(money(edited.due));
  });

  test('rolls the application forward into the next period', async ({ page }) => {
    await openTool(page);
    page.on('dialog', (d) => d.accept());
    await page.getByRole('button', { name: /start next application/i }).click();

    const next = rollForward(sample);
    const nextCalc = computeApp(next.rows, next.app.ratePct, next.app.prevCertified);
    await expect(out(page, 'title')).toContainText('Pay Application #4');
    await expect(page.locator('#pa-number')).toHaveValue('4');
    await expect(page.locator('#pa-period-from')).toHaveValue('2026-09-01');
    await expect(page.locator('#pa-period-to')).toHaveValue('2026-09-30');
    // Line 3 (domestic water): previous 31,680 + this period 15,840 → previous 47,520; this period clears.
    await expect(row(page, 2).locator('[data-f="d"]')).toHaveValue(money(47520));
    await expect(row(page, 2).locator('[data-f="e"]')).toHaveValue('');
    // Line 7 is the closed application's line 6, carried exactly.
    await expect(page.locator('#pa-prev')).toHaveValue(money(calc.earned));
    await expect(out(page, 'prev')).toHaveText(money(calc.earned));
    await expect(out(page, 'due')).toHaveText(money(nextCalc.due));
    await expect(page.locator('[data-history] li')).toHaveCount(1);
    await expect(page.locator('[data-history] li').first()).toContainText('Application #3');
  });

  test('downloads a filled PDF with the certificate and continuation values', async ({ page }) => {
    await openTool(page);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page
        .getByRole('button', { name: /download filled pdf/i })
        .first()
        .click(),
    ]);
    expect(download.suggestedFilename()).toBe(
      'pay-application-3-harbor-point-medical-office-building-b.pdf'
    );
    const path = await download.path();
    expect(path).toBeTruthy();
    const doc = await PDFDocument.load(await readFile(path!));
    const form = doc.getForm();
    expect(doc.getPageCount()).toBe(2);
    expect(form.getTextField('app.number').getText()).toBe('3');
    expect(form.getTextField('pa.3').getText()).toBe(money(calc.revised));
    expect(form.getTextField('pa.6').getText()).toBe(money(calc.earned));
    expect(form.getTextField('pa.8').getText()).toBe(money(calc.due));
    expect(form.getTextField('sov.1.desc').getText()).toBe('Mobilization & submittals');
    expect(form.getTextField('sov.13.n').getText()).toBe('CO-001');
    expect(form.getTextField('sov.total.g').getText()).toBe(money(calc.totals.g));
    expect(form.getTextField('cs.app_number').getText()).toBe('3');
    // Trademark hygiene: the tool must never inject the AIA marks into the file.
    for (const f of form.getFields()) {
      const text = 'getText' in f ? ((f as { getText(): string | undefined }).getText() ?? '') : '';
      expect(text).not.toMatch(/\bAIA\b|G702|G703/);
    }
  });

  test('adds a change order line and reflects it in line 2', async ({ page }) => {
    await openTool(page);
    await page.getByRole('button', { name: /add change order line/i }).click();
    const last = page.locator('[data-sov-body] tr').last();
    await expect(last.locator('[data-f="n"]')).toHaveValue('CO-003');
    await last.locator('[data-f="desc"]').fill('Add condensate drain from AHU-3');
    await last.locator('[data-f="c"]').fill('5784.50');
    await expect(out(page, 'net')).toHaveText(money(calc.net + 5784.5));
    await expect(out(page, 'revised')).toHaveText(money(calc.revised + 5784.5));
  });

  test('fits a phone without horizontal page scroll; the table scrolls inside its card', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openTool(page);
    const widths = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
      tableScroll: document.querySelector('[data-sov-scroll]')!.scrollWidth,
      tableClient: document.querySelector('[data-sov-scroll]')!.clientWidth,
    }));
    expect(widths.page).toBeLessThanOrEqual(widths.viewport);
    expect(widths.tableScroll).toBeGreaterThan(widths.tableClient);
    await expect(page.getByRole('button', { name: /download filled pdf/i }).first()).toBeVisible();
  });
});

test.describe('entry points', () => {
  test('the pay application template page offers the online builder', async ({ page }) => {
    await page.goto('/templates/aia-g702-g703/');
    // `main`: the header's Resources menu links the builder on every page too.
    const link = page.locator('main a[href="/tools/pay-app/"]').first();
    await expect(link).toBeVisible();
  });

  test('the templates hub carries the builder callout', async ({ page }) => {
    await page.goto('/templates/');
    await expect(page.locator('[data-tool-callout="pay-app"]')).toBeVisible();
  });
});
