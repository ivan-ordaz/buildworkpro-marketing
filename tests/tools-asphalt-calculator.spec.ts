import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import {
  BASE_DENSITY,
  computeAsphalt,
  DEFAULT_INPUT,
  estimateLines,
  fromParams,
  groupLabel,
  HMA_DENSITY,
  lbPerSyIn,
  looseThickness,
  priceAsphalt,
  toParams,
  tonsPerCuyd,
  TRUCK_TONS,
  type AsphaltInput,
} from '../src/lib/calculators/asphalt';
import { fmt, money } from '../src/lib/calculators/format';

// /tools/asphalt-calculator/. Expected numbers come from the same math module
// the page uses, plus literal checks that pin every figure quoted in the FAQ and
// the method section, so a changed constant fails here before it ships.

const PATH = '/tools/asphalt-calculator/';
const area = (over: Partial<AsphaltInput>): AsphaltInput => ({ ...DEFAULT_INPUT, ...over });

test.describe('asphalt math', () => {
  test('the defaults are the sourced figures', () => {
    expect(HMA_DENSITY).toBe(145);
    expect(BASE_DENSITY).toBe(140);
    expect(TRUCK_TONS).toBe(15);
    expect(DEFAULT_INPUT).toMatchObject({ width: 12, length: 50, thickness: 3, waste: 5 });
  });

  test('pounds per square yard per inch, as quoted in the FAQ', () => {
    expect(lbPerSyIn(145)).toBe(108.75);
    expect(Number((108.75 / 2000).toFixed(3))).toBe(0.054);
    expect(Number((2000 / lbPerSyIn(145)).toFixed(1))).toBe(18.4);
    // PAPA's typical range, 108 to 120 lb/sy/in, is 144 to 160 lb/cu ft.
    expect(lbPerSyIn(144)).toBe(108);
    expect(lbPerSyIn(160)).toBe(120);
  });

  test('matches PAPA’s worked example: a 150 × 300 ft lot at 3 in and 110 lb/sy/in', () => {
    const r = computeAsphalt(
      area({ width: 150, length: 300, thickness: 3, density: 110 / 0.75, waste: 0 })
    );
    expect(r.sqyd).toBe(5000);
    expect(r.tonsNet).toBeCloseTo(825, 9);
    expect(r.tons).toBe(825);
  });

  test('the 12 × 50 ft driveway at 3 in quoted in the FAQ', () => {
    const r = computeAsphalt(DEFAULT_INPUT);
    expect(r.sqft).toBe(600);
    expect(Number(r.sqyd.toFixed(1))).toBe(66.7);
    expect(r.cuft).toBe(150);
    expect(Number(r.cuyd.toFixed(2))).toBe(5.56);
    expect(r.tonsNet).toBe(10.875);
    expect(r.tons).toBe(11.42);
    expect(r.loads).toBe(1);
    // 6 in of base at 140 lb/cu ft
    expect(r.baseCuft).toBe(300);
    expect(r.baseTonsNet).toBe(21);
    expect(r.baseTons).toBe(22.05);
    expect(r.baseLoads).toBe(2);
    expect(r.looseIn).toBe(3.75);
    expect(groupLabel(DEFAULT_INPUT)).toBe('Asphalt · 12 × 50 ft, 3 in');
  });

  test('roll-down and base density figures quoted on the page', () => {
    expect(looseThickness(2)).toBe(2.5); // NAPA's 2 in lift placed at 2.5 in
    expect(looseThickness(3)).toBe(3.75);
    expect(looseThickness(2, 0.15)).toBeCloseTo(2.3, 9);
    expect(tonsPerCuyd(140)).toBe(1.89);
  });

  test('entering square feet gives the same result as width × length', () => {
    const lw = computeAsphalt(area({ width: 30, length: 60 }));
    const sf = computeAsphalt(area({ mode: 'sf', area: 1800, width: 1, length: 1 }));
    expect(sf).toEqual(lw);
    expect(groupLabel(area({ mode: 'sf', area: 12500, thickness: 2.5 }))).toBe(
      'Asphalt · 12,500 sq ft, 2.5 in'
    );
  });

  test('truckloads round up per material, but an exact load is not rounded up', () => {
    const exact = computeAsphalt(
      area({ width: 10, length: 80, thickness: 3, density: 150, waste: 0, truckTons: 15 })
    );
    expect(exact.tons).toBe(15);
    expect(exact.loads).toBe(1);
    const none = computeAsphalt(area({ baseThickness: 0 }));
    expect(none.baseTons).toBe(0);
    expect(none.baseLoads).toBe(0);
    expect(computeAsphalt(area({ truckTons: 0 })).loads).toBe(0);
  });

  test('prices only what the contractor priced', () => {
    const r = computeAsphalt(DEFAULT_INPUT);
    expect(priceAsphalt(r, {}).total).toBeNull();
    const partial = priceAsphalt(r, { ton: 90 });
    expect(partial.material).toBe(1027.8);
    expect(partial.materialComplete).toBe(false);
    expect(partial.trucking).toBeNull();
    const full = priceAsphalt(r, { ton: 90, base: 30, load: 120, labor: 2, laborUnit: 9 });
    expect(full.material).toBe(1689.3);
    expect(full.materialComplete).toBe(true);
    expect(full.trucking).toBe(360);
    expect(full.labor).toBe(133.34); // 66.67 sq yd × $2
    expect(full.total).toBe(2182.64);
    expect(full.perSqft).toBe(3.64);
    const perSqft = priceAsphalt(r, { labor: 2, laborUnit: 1 });
    expect(perSqft.labor).toBe(1200);
  });

  test('estimate lines carry quantities, and trucking only when it is priced', () => {
    const r = computeAsphalt(DEFAULT_INPUT);
    const plain = estimateLines(DEFAULT_INPUT, r, {});
    expect(plain.map((l) => [l.desc, l.qty, l.unit])).toEqual([
      ['Hot-mix asphalt, 3 in compacted', 11.42, 'tons'],
      ['Aggregate base, 6 in compacted', 22.05, 'tons'],
      ['Labor: paving, 3 in', 600, 'sq ft'],
    ]);
    expect(plain.every((l) => l.price == null)).toBe(true);
    const priced = estimateLines(DEFAULT_INPUT, r, { load: 120, labor: 2, laborUnit: 9 });
    expect(priced.map((l) => l.unit)).toEqual(['tons', 'tons', 'loads', 'sq yd']);
    expect(priced[2]).toMatchObject({ desc: 'Trucking, 15-ton loads', qty: 3, price: 120 });
    expect(priced[3].qty).toBe(66.67);
    const noBase = estimateLines(
      area({ baseThickness: 0 }),
      computeAsphalt(area({ baseThickness: 0 })),
      {}
    );
    expect(noBase.map((l) => l.desc)).not.toContain('Aggregate base, 0 in compacted');
  });

  test('query parameters round-trip, are clamped, and bad values fall back', () => {
    expect(fromParams(toParams(DEFAULT_INPUT))).toEqual(DEFAULT_INPUT);
    const i = fromParams({
      m: 'toString',
      w: '99999',
      l: '-3',
      a: 'abc',
      t: '30',
      d: '900',
      wst: '90',
      bt: '50',
      bd: '',
      tr: '100',
    });
    expect(i.mode).toBe(DEFAULT_INPUT.mode);
    expect(i.width).toBe(10_000);
    expect(i.length).toBe(DEFAULT_INPUT.length);
    expect(i.area).toBe(DEFAULT_INPUT.area);
    expect(i.thickness).toBe(24);
    expect(i.density).toBe(200);
    expect(i.waste).toBe(40);
    expect(i.baseThickness).toBe(36);
    expect(i.baseDensity).toBe(DEFAULT_INPUT.baseDensity);
    expect(i.truckTons).toBe(40);
    expect(fromParams({ m: 'sf' }).mode).toBe('sf');
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
  test('renders the example driveway, is indexable and carries its structured data', async ({
    page,
  }) => {
    await openTool(page);
    const r = computeAsphalt(DEFAULT_INPUT);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Asphalt Calculator');
    await expect(out(page, 'sqft')).toHaveText(fmt(r.sqft));
    await expect(out(page, 'sqft-note')).toHaveText('66.67 sq yd');
    await expect(out(page, 'tons')).toHaveText('11.42');
    await expect(out(page, 'tons-note')).toContainText(
      '5.56 cu yd (150 cu ft) compacted + 5% waste'
    );
    await expect(out(page, 'tons-note')).toContainText('about 3.75 in loose');
    await expect(out(page, 'base')).toHaveText('22.05');
    await expect(out(page, 'loads')).toHaveText('3');
    await expect(out(page, 'loads-note')).toHaveText('1 asphalt + 2 base at 15 tons a load');
    await expect(out(page, 'rate')).toHaveText('108.75 lb');
    await expect(out(page, 'total')).toHaveText('—');
    await expect(page.locator('#as-a')).toBeHidden();

    const robots = page.locator('meta[name="robots"]');
    if ((await robots.count()) > 0) await expect(robots).not.toHaveAttribute('content', /noindex/);
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(blocks.filter((s) => s.includes('"FAQPage"'))).toHaveLength(1);
    expect(blocks.filter((s) => s.includes('"WebApplication"'))).toHaveLength(1);
    const crumbs = blocks.map((b) => JSON.parse(b)).find((d) => d['@type'] === 'BreadcrumbList');
    expect(crumbs.itemListElement.map((c: { name: string }) => c.name)).toEqual([
      'Home',
      'Free Tools',
      'Asphalt Calculator',
    ]);
  });

  test('the FAQ quotes the pinned figures', async ({ page }) => {
    await openTool(page);
    const faq = page.locator('main details');
    await expect(faq).toHaveCount(7);
    const text = (await faq.allTextContents()).join(' ');
    for (const figure of [
      '108.75 lb, or about 0.054 tons',
      'about 18.4 square yards',
      '108 to 120 lb',
      '600 sq ft, or 66.7 square yards',
      '150 cubic feet (5.56 cubic yards)',
      'weighs 10.875 tons',
      'order 11.42 tons, one load',
      'adds 21 tons, or 22.05 with waste',
      '12 to 20 tons',
      '20 to 25 tons',
      'typical 15-ton load',
      'about 2.5 inches',
      'about 3.75',
      '1.89 tons per cubic yard',
    ])
      expect(text).toContain(figure);
  });

  test('a shared link reproduces the area, and edits update the address', async ({ page }) => {
    await openTool(page, `${PATH}?m=sf&a=4500&t=2&d=145&wst=0&bt=0&bd=140&tr=20`);
    await expect(page.locator('#as-a')).toBeVisible();
    await expect(page.locator('#as-w')).toBeHidden();
    const r = computeAsphalt(
      area({ mode: 'sf', area: 4500, thickness: 2, waste: 0, baseThickness: 0, truckTons: 20 })
    );
    expect(r.tons).toBe(54.38);
    await expect(out(page, 'tons')).toHaveText('54.38');
    await expect(out(page, 'loads')).toHaveText('3');
    await expect(out(page, 'base-note')).toHaveText('No base course entered');
    await page.locator('#as-t').fill('3');
    const r3 = computeAsphalt(
      area({ mode: 'sf', area: 4500, thickness: 3, waste: 0, baseThickness: 0, truckTons: 20 })
    );
    await expect(out(page, 'tons')).toHaveText(fmt(r3.tons, 2));
    await expect(page).toHaveURL(/[?&]t=3(&|$)/);
    await page.reload();
    await expect(page.locator('#as-t')).toHaveValue('3');
    await expect(page.locator('#as-m')).toHaveValue('sf');
  });

  test('switching to square feet carries the width × length over', async ({ page }) => {
    await openTool(page);
    await page.locator('#as-w').fill('20');
    await page.locator('#as-m').selectOption('sf');
    await expect(page.locator('#as-a')).toBeVisible();
    await expect(page.locator('#as-a')).toHaveValue('1000');
    await expect(out(page, 'sqft')).toHaveText('1,000');
    await expect(page).toHaveURL(/[?&]m=sf(&|$)/);
    await page.locator('#as-m').selectOption('lw');
    await expect(page.locator('#as-w')).toBeVisible();
    await expect(page.locator('#as-a')).toBeHidden();
  });

  test('remembers the contractor’s prices, including the labor unit', async ({ page }) => {
    await openTool(page);
    await page.locator('#as-p-ton').fill('$92.50');
    await page.locator('#as-p-labor').fill('18');
    await page.locator('#as-p-unit').selectOption('9');
    const r = computeAsphalt(DEFAULT_INPUT);
    const p = priceAsphalt(r, { ton: 92.5, labor: 18, laborUnit: 9 });
    await expect(out(page, 'total')).toHaveText(money(p.total!));
    await expect(out(page, 'labor-label')).toHaveText('Labor, per sq yd');
    await expect(out(page, 'trucking')).toHaveText('—');
    await page.reload();
    await expect(page.locator('[data-calculator][data-ready="true"]')).toBeVisible();
    await expect(page.locator('#as-p-ton')).toHaveValue('92.5');
    await expect(page.locator('#as-p-unit')).toHaveValue('9');
    await expect(out(page, 'total')).toHaveText(money(p.total!));
  });

  test('builds an estimate across areas that survives a reload', async ({ page }) => {
    await openTool(page);
    await page.locator('#as-p-ton').fill('90');
    await page.locator('#as-p-load').fill('150');
    await page.getByRole('button', { name: 'Add to estimate' }).click();
    await expect(page.locator('[data-note]')).toHaveText('Added 4 lines to your estimate below.');
    await page.locator('#as-bt').fill('0');
    await page.locator('#as-l').fill('30');
    await page.getByRole('button', { name: 'Add to estimate' }).click();
    const groups = page.locator('[data-tray-group]');
    await expect(groups).toHaveCount(2);
    await expect(page.locator('[data-tray-count]')).toHaveText('7 lines');
    await expect(groups.nth(1)).toContainText('Asphalt · 12 × 30 ft, 3 in');

    const first = computeAsphalt(DEFAULT_INPUT);
    const second = computeAsphalt(area({ length: 30, baseThickness: 0 }));
    const total =
      Math.round(
        (first.tons * 90 +
          (first.loads + first.baseLoads) * 150 +
          second.tons * 90 +
          second.loads * 150) *
          100
      ) / 100;
    await expect(page.locator('[data-tray-total]')).toHaveText(money(total));

    await page.reload();
    await expect(page.locator('[data-tray-group]')).toHaveCount(2);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download CSV' }).click(),
    ]);
    const csv = await readFile((await download.path())!, 'utf-8');
    expect(csv.split('\n')[0]).toBe('Group,Description,Qty,Unit,Unit price,Amount');
    expect(csv).toContain('"Hot-mix asphalt, 3 in compacted",11.42,tons,90,1027.80');
    expect(csv).toContain('Trucking, 15-ton loads');

    await page.locator('[data-tray-group]').first().getByRole('button', { name: 'Remove' }).click();
    await expect(page.locator('[data-tray-group]')).toHaveCount(1);
  });

  test('refuses to add an empty area', async ({ page }) => {
    await openTool(page);
    await page.locator('#as-t').fill('0');
    await page.getByRole('button', { name: 'Add to estimate' }).click();
    await expect(page.locator('[data-note]')).toHaveText('Enter the area and thickness first.');
    await expect(page.locator('[data-tray-empty]')).toBeVisible();
  });

  test('fits a phone without horizontal page scroll', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openTool(page);
    await page.locator('#as-p-ton').fill('90');
    await page.getByRole('button', { name: 'Add to estimate' }).click();
    await page.locator('#as-m').selectOption('sf');
    const widths = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }));
    expect(widths.page).toBeLessThanOrEqual(widths.viewport);
  });
});
