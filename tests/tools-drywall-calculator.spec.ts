import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import {
  computeDrywall,
  DEFAULT_INPUT,
  estimateLines,
  fromParams,
  priceDrywall,
  screwsPerSheet,
  type DrywallInput,
} from '../src/lib/calculators/drywall';
import {
  emptyEstimate,
  estimateTotals,
  toCsv,
  uniqueGroup,
  withLines,
  withoutGroup,
} from '../src/lib/calculators/estimate';
import { fmt, money, parseNum } from '../src/lib/calculators/format';
import { TOOLS } from '../src/data/tools';

// /tools/drywall-calculator/ and the shared calculator kit (estimate tray,
// remembered prices, shareable links). Expected numbers come from the same
// math module the page uses, plus a few literal checks that pin the figures
// quoted in the page's FAQ.

const PATH = '/tools/drywall-calculator/';
const room = (over: Partial<DrywallInput>): DrywallInput => ({ ...DEFAULT_INPUT, ...over });

test.describe('drywall math', () => {
  test('matches the 12 × 12 room quoted in the FAQ', () => {
    const base = room({ length: 12, width: 12, height: 8, doors: 0, windows: 0, waste: 10 });
    const r8 = computeDrywall({ ...base, sheet: '4x8' });
    expect([r8.wallSheets, r8.ceilingSheets, r8.sheets]).toEqual([14, 5, 19]);
    expect(r8.boardArea).toBe(528);
    const r12 = computeDrywall({ ...base, sheet: '4x12' });
    expect([r12.wallSheets, r12.ceilingSheets]).toEqual([9, 4]);
  });

  test('screw counts follow 16" walls and 12" ceilings on framing 16" o.c.', () => {
    expect(screwsPerSheet(8, 16)).toBe(28);
    expect(screwsPerSheet(8, 12)).toBe(35);
    expect(screwsPerSheet(12, 16)).toBe(40);
    expect(screwsPerSheet(12, 12)).toBe(50);
  });

  test('compound and tape follow the USG coverage figures', () => {
    const r = computeDrywall(room({ length: 25, width: 20, height: 10, ceiling: true }));
    // 2 × 45 × 10 = 900 walls + 500 ceiling = 1,400 sq ft
    expect(r.boardArea).toBe(1400);
    expect(r.compoundGal).toBeCloseTo(13.16, 2);
    expect(r.pails).toBe(3);
    expect(r.tapeFt).toBeCloseTo(518, 5);
    expect(r.rolls).toBe(2);
  });

  test('openings never take the wall area below zero', () => {
    const r = computeDrywall(room({ length: 2, width: 2, height: 2, doors: 5, ceiling: false }));
    expect(r.wallArea).toBe(0);
    expect(r.sheets).toBe(0);
    expect(r.pails).toBe(0);
  });

  test('prices only what the contractor priced', () => {
    const r = computeDrywall(DEFAULT_INPUT);
    expect(priceDrywall(r, {}).total).toBeNull();
    const partial = priceDrywall(r, { sheet: 20 });
    expect(partial.material).toBe(r.sheets * 20);
    expect(partial.materialComplete).toBe(false);
    const full = priceDrywall(r, { sheet: 20, pail: 18, roll: 6, screws: 30, labor: 1.5 });
    expect(full.materialComplete).toBe(true);
    expect(full.labor).toBe(Math.round(r.boardArea * 1.5 * 100) / 100);
    expect(full.total).toBe(Math.round((full.material! + full.labor!) * 100) / 100);
  });

  test('estimate lines carry quantities and only the prices given', () => {
    const r = computeDrywall(DEFAULT_INPUT);
    const lines = estimateLines(DEFAULT_INPUT, r, { labor: 2 });
    expect(lines.map((l) => l.unit)).toEqual(['sheets', 'sheets', 'pails', 'rolls', 'ea', 'sq ft']);
    expect(lines.filter((l) => l.price != null)).toHaveLength(1);
    expect(lines.at(-1)!.desc).toBe('Labor: hang and finish to Level 4');
  });

  test('query parameters are clamped and bad values fall back to defaults', () => {
    const i = fromParams({
      l: '9999',
      w: '-3',
      h: 'abc',
      s: '5x5',
      b: 'gold',
      lvl: '9',
      wst: '90',
      c: '0',
    });
    expect(i.length).toBe(500);
    expect(i.width).toBe(DEFAULT_INPUT.width);
    expect(i.height).toBe(DEFAULT_INPUT.height);
    expect(i.sheet).toBe(DEFAULT_INPUT.sheet);
    expect(i.board).toBe(DEFAULT_INPUT.board);
    expect(i.level).toBe(DEFAULT_INPUT.level);
    expect(i.waste).toBe(40);
    expect(i.ceiling).toBe(false);
  });
});

test.describe('estimate helpers', () => {
  test('repeat groups get a suffix, totals skip unpriced lines, CSV escapes', () => {
    const line = { tool: 't', desc: 'Board, "4x12"', qty: 10, unit: 'sheets', price: 21.5 };
    let e = withLines(emptyEstimate(), 'Room', [line, { ...line, desc: 'Labor', price: null }]);
    expect(uniqueGroup(e, 'Room')).toBe('Room (2)');
    e = withLines(e, 'Room', [line]);
    expect(new Set(e.lines.map((l) => l.group))).toEqual(new Set(['Room', 'Room (2)']));
    expect(estimateTotals(e)).toEqual({ total: 430, priced: 2, unpriced: 1 });
    expect(toCsv(e)).toContain('"Board, ""4x12"""');
    expect(withoutGroup(e, 'Room').lines).toHaveLength(1);
  });

  test('number parsing forgives dollar signs and commas', () => {
    expect(parseNum('$1,250.50')).toBe(1250.5);
    expect(parseNum('')).toBeNull();
    expect(parseNum('abc')).toBeNull();
  });
});

async function openTool(page: Page, path = PATH) {
  await page.goto(path);
  await expect(page.locator('[data-calculator][data-ready="true"]')).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator('[data-estimate-tray][data-ready="true"]')).toBeAttached();
}
const out = (page: Page, key: string) => page.locator(`[data-out="${key}"]`).first();

test.describe(PATH, () => {
  test('renders the example room, is indexable and carries its structured data', async ({
    page,
  }) => {
    await openTool(page);
    const r = computeDrywall(DEFAULT_INPUT);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Drywall Calculator');
    await expect(out(page, 'board')).toHaveText(fmt(r.boardArea));
    await expect(out(page, 'sheets')).toHaveText(fmt(r.sheets));
    await expect(out(page, 'pails')).toHaveText(fmt(r.pails));
    await expect(out(page, 'rolls')).toHaveText(fmt(r.rolls));
    await expect(out(page, 'screws')).toHaveText(fmt(r.screws));
    await expect(out(page, 'total')).toHaveText('—');

    const robots = page.locator('meta[name="robots"]');
    if ((await robots.count()) > 0) await expect(robots).not.toHaveAttribute('content', /noindex/);
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(blocks.filter((s) => s.includes('"FAQPage"'))).toHaveLength(1);
    expect(blocks.filter((s) => s.includes('"WebApplication"'))).toHaveLength(1);
    const crumbs = blocks.map((b) => JSON.parse(b)).find((d) => d['@type'] === 'BreadcrumbList');
    expect(crumbs.itemListElement.map((c: { name: string }) => c.name)).toEqual([
      'Home',
      'Free Tools',
      'Drywall Calculator',
    ]);
  });

  test('a shared link reproduces the room, and edits update the address', async ({ page }) => {
    await openTool(page, `${PATH}?l=12&w=12&h=8&c=1&d=0&win=0&s=4x8&wst=10`);
    await expect(out(page, 'sheets')).toHaveText('19');
    await page.locator('#dw-h').fill('10');
    const r = computeDrywall(
      room({ length: 12, width: 12, height: 10, doors: 0, windows: 0, sheet: '4x8' })
    );
    await expect(out(page, 'sheets')).toHaveText(fmt(r.sheets));
    await expect(page).toHaveURL(/[?&]h=10(&|$)/);
    await page.reload();
    await expect(page.locator('#dw-h')).toHaveValue('10');
  });

  test('remembers the contractor’s prices and prices the room', async ({ page }) => {
    await openTool(page);
    await page.locator('#dw-p-sheet').fill('21.50');
    await page.locator('#dw-p-labor').fill('1.85');
    const r = computeDrywall(DEFAULT_INPUT);
    const p = priceDrywall(r, { sheet: 21.5, labor: 1.85 });
    await expect(out(page, 'total')).toHaveText(money(p.total!));
    await page.reload();
    await expect(page.locator('[data-calculator][data-ready="true"]')).toBeVisible();
    await expect(page.locator('#dw-p-sheet')).toHaveValue('21.5');
    await expect(out(page, 'total')).toHaveText(money(p.total!));
  });

  test('builds an estimate across rooms that survives a reload', async ({ page }) => {
    await openTool(page);
    await page.locator('#dw-p-labor').fill('2');
    await page.getByRole('button', { name: 'Add to estimate' }).click();
    await page.locator('#dw-l').fill('10');
    await page.getByRole('button', { name: 'Add to estimate' }).click();
    const groups = page.locator('[data-tray-group]');
    await expect(groups).toHaveCount(2);
    await expect(page.locator('[data-tray-count]')).toHaveText('12 lines');

    const first = computeDrywall(DEFAULT_INPUT);
    const second = computeDrywall(room({ length: 10 }));
    const total = Math.round((first.boardArea + second.boardArea) * 2 * 100) / 100;
    await expect(page.locator('[data-tray-total]')).toHaveText(money(total));

    await page.reload();
    await expect(page.locator('[data-tray-group]')).toHaveCount(2);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download CSV' }).click(),
    ]);
    const csv = await readFile((await download.path())!, 'utf-8');
    expect(csv.split('\n')[0]).toBe('Group,Description,Qty,Unit,Unit price,Amount');
    expect(csv).toContain('Labor: hang and finish to Level 4');

    await page.locator('[data-tray-group]').first().getByRole('button', { name: 'Remove' }).click();
    await expect(page.locator('[data-tray-group]')).toHaveCount(1);
    const clear = page.getByRole('button', { name: 'Clear', exact: true });
    await clear.click();
    await expect(page.locator('[data-tray-group]')).toHaveCount(1);
    await page.getByRole('button', { name: 'Click again to clear' }).click();
    await expect(page.locator('[data-tray-empty]')).toBeVisible();
  });

  test('fits a phone without horizontal page scroll', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openTool(page);
    await page.getByRole('button', { name: 'Add to estimate' }).click();
    const widths = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }));
    expect(widths.page).toBeLessThanOrEqual(widths.viewport);
  });
});

test.describe('/tools/ hub', () => {
  test('lists every tool and each one resolves', async ({ page, request }) => {
    await page.goto('/tools/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Free tools for subcontractors'
    );
    for (const t of TOOLS) {
      await expect(page.locator(`[data-tool-card][href="${t.href}"]`)).toBeVisible();
      expect((await request.get(t.href)).status(), t.href).toBe(200);
    }
  });

  test('the drywall estimate template links to the calculator', async ({ page }) => {
    await page.goto('/templates/drywall-estimate/');
    await expect(page.locator(`main a[href="${PATH}"]`).first()).toBeAttached();
  });
});
