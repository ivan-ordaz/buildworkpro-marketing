import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import {
  BARS,
  computeRebar,
  DEFAULT_INPUT,
  estimateLines,
  feetPerTon,
  fmtFtIn,
  fromParams,
  groupLabel,
  lapInches,
  lappedRun,
  nestPieces,
  priceRebar,
  stickWeight,
  toParams,
  type RebarInput,
} from '../src/lib/calculators/rebar';
import { fmt, money } from '../src/lib/calculators/format';

// /tools/rebar-calculator/. Expected numbers come from the same math module the
// page uses, plus literal checks that pin every figure quoted in the page's FAQ
// and the concrete estimate template's slab takeoff, so the site gives one answer.

const PATH = '/tools/rebar-calculator/';
const slab = (over: Partial<RebarInput>): RebarInput => ({ ...DEFAULT_INPUT, ...over });

test.describe('rebar math', () => {
  test('bar weights and diameters are the ASTM A615 nominal values', () => {
    expect(Object.fromEntries(Object.entries(BARS).map(([k, b]) => [k, b.lbPerFt]))).toEqual({
      '3': 0.376,
      '4': 0.668,
      '5': 1.043,
      '6': 1.502,
      '7': 2.044,
      '8': 2.67,
    });
    expect(Object.values(BARS).map((b) => b.diaIn)).toEqual([0.375, 0.5, 0.625, 0.75, 0.875, 1]);
    // FAQ: a 20 ft stick of #4 is 13.36 lb, of #5 20.86 lb; a ton of #4 is 2,994 ft, 149.7 sticks.
    expect(stickWeight('4', '20')).toBeCloseTo(13.36, 9);
    expect(stickWeight('5', '20')).toBeCloseTo(20.86, 9);
    expect(Math.round(feetPerTon('4'))).toBe(2994);
    expect(feetPerTon('4') / 20).toBeCloseTo(149.7, 1);
  });

  test('matches the concrete estimate template: 44 × 20 driveway and 20 × 8 apron', () => {
    const drive = computeRebar(slab({ length: 44, width: 20, spacingL: 24, spacingW: 24 }));
    expect([drive.barsL, drive.barsW]).toEqual([11, 23]);
    expect(drive.lf).toBeCloseTo(971, 9);
    expect(drive.chairs).toBe(98);
    const apron = computeRebar(slab({ length: 20, width: 8, spacingL: 24, spacingW: 24 }));
    expect([apron.barsL, apron.barsW]).toEqual([5, 11]);
    expect(apron.lf).toBeCloseTo(180, 9);
    expect(apron.chairs).toBe(18);
    // The template sample's rebar line is 1,151 LF for both slabs, and its
    // Rebar sticks column is 51 + 11 = 62.
    expect(drive.lf + apron.lf).toBeCloseTo(1151, 9);
    expect([drive.sticks, apron.sticks]).toEqual([51, 11]);
  });

  test('the 20 × 20 FAQ slab: 21 bars each way, 819 LF, 42 sticks, 547 lb, 45 chairs', () => {
    const r = computeRebar(slab({ length: 20, width: 20 }));
    expect([r.barsL, r.barsW, r.bars]).toEqual([21, 21, 42]);
    expect(fmtFtIn(r.spanLIn)).toBe('19 ft 6 in');
    expect(r.laps).toBe(0);
    expect(r.lf).toBeCloseTo(819, 9);
    expect(r.sticksOfSteel).toBeCloseTo(40.95, 9);
    expect(r.sticks).toBe(42);
    expect(Math.round(r.lbPlaced)).toBe(547);
    expect(fmt(r.tonsPlaced, 2)).toBe('0.27');
    expect(r.chairs).toBe(45);
    expect(computeRebar(slab({ length: 20, width: 20, stock: '40' })).sticks).toBe(21);
  });

  test('the 40 × 30 example: splices, laps and a cut list of 144 sticks against 132', () => {
    const r = computeRebar(DEFAULT_INPUT);
    expect([r.barsL, r.barsW]).toEqual([31, 41]);
    // 39 ft 6 in runs take 3 pieces with 2 laps; 29 ft 6 in runs 2 pieces with 1 lap.
    expect(r.runL).toEqual({ pieces: 3, laps: 2, steelIn: 522, endIn: 42 });
    expect(r.runW).toEqual({ pieces: 2, laps: 1, steelIn: 378, endIn: 138 });
    expect(r.lapIn).toBe(24);
    expect(r.laps).toBe(103);
    expect(r.lapLf).toBe(206);
    expect(r.barLf).toBe(2434);
    expect(r.lf).toBe(2640);
    expect(r.fullSticks).toBe(103);
    expect(r.sticks).toBe(144);
    expect(r.sticksOfSteel).toBe(132);
    expect(Math.round(r.lbPlaced)).toBe(1764);
    expect(r.chairs).toBe(134);
  });

  test('a top mat doubles bars, steel, laps and chairs', () => {
    const one = computeRebar(DEFAULT_INPUT);
    const two = computeRebar(slab({ topMat: true }));
    expect(two.bars).toBe(one.bars * 2);
    expect(two.lf).toBe(one.lf * 2);
    expect(two.laps).toBe(one.laps * 2);
    expect(two.sticks).toBe(one.sticks * 2);
    expect(two.chairs).toBe(one.chairs * 2);
  });

  test('spacing can differ each way', () => {
    const r = computeRebar(slab({ length: 20, width: 10, spacingL: 12, spacingW: 18 }));
    // Bars along the length are spaced across the 114 in clear width; the others along 234 in.
    expect(r.barsL).toBe(Math.ceil(114 / 12) + 1);
    expect(r.barsW).toBe(Math.ceil(234 / 18) + 1);
    expect([r.barsL, r.barsW]).toEqual([11, 14]);
  });

  test('lap splices: the template rule, and laps in bar diameters', () => {
    expect(lappedRun(234, 240, 24)).toEqual({ pieces: 1, laps: 0, steelIn: 234, endIn: 234 });
    expect(lappedRun(240, 240, 24).pieces).toBe(1);
    expect(lappedRun(241, 240, 24)).toEqual({ pieces: 2, laps: 1, steelIn: 265, endIn: 25 });
    expect(lappedRun(522, 240, 24)).toEqual({ pieces: 3, laps: 2, steelIn: 570, endIn: 90 });
    expect(lappedRun(0, 240, 24).pieces).toBe(0);
    // FAQ: at 48 diameters #3 laps 18 in, #4 24, #5 30, #6 36.
    expect((['3', '4', '5', '6'] as const).map((b) => lapInches(b, 48))).toEqual([18, 24, 30, 36]);
  });

  test('the cut list nests short pieces into long offcuts, longest first', () => {
    expect(nestPieces([{ lenIn: 234, qty: 42 }], 240)).toBe(42);
    expect(nestPieces([{ lenIn: 117, qty: 4 }], 240)).toBe(2);
    expect(nestPieces([{ lenIn: 90, qty: 11 }], 240)).toBe(6);
    // 41 × 138 in leave 102 in offcuts; two 42 in pieces fit in each, so no new sticks.
    expect(
      nestPieces(
        [
          { lenIn: 42, qty: 31 },
          { lenIn: 138, qty: 41 },
        ],
        240
      )
    ).toBe(41);
    expect(nestPieces([], 240)).toBe(0);
    // The template's driveway: 22 full sticks + 23 bars of 19 ft 6 in + 11 ends of 7 ft 6 in.
    expect(computeRebar(slab({ length: 44, width: 20, spacingL: 24, spacingW: 24 })).sticks).toBe(
      51
    );
  });

  test('waste goes on top of the cut list, rounded up', () => {
    const r = computeRebar(slab({ waste: 5 }));
    expect(r.sticksNet).toBe(144);
    expect(r.sticks).toBe(Math.ceil(144 * 1.05));
    expect(r.lbBought).toBeCloseTo(r.sticks * 20 * 0.668, 9);
  });

  test('a slab smaller than the clearance is empty', () => {
    const r = computeRebar(slab({ length: 0.5, width: 10 }));
    expect([r.bars, r.lf, r.sticks, r.chairs]).toEqual([0, 0, 0, 0]);
    expect(priceRebar(r, { steel: 10, chair: 1, labor: 900 }).total).toBeNull();
  });

  test('prices only what the contractor priced: steel per stick or ton, labor per ton or sq ft', () => {
    const r = computeRebar(DEFAULT_INPUT);
    expect(priceRebar(r, {}).total).toBeNull();
    const partial = priceRebar(r, { steel: 12.5 });
    expect(partial.material).toBe(144 * 12.5);
    expect(partial.materialComplete).toBe(false);

    const byStick = priceRebar(r, { steel: 12.5, chair: 0.6, labor: 900 });
    expect(byStick.materialComplete).toBe(true);
    expect(byStick.material).toBe(Math.round((144 * 12.5 + 134 * 0.6) * 100) / 100);
    expect(byStick.labor).toBe(Math.round(1763.52 * (900 / 2000) * 100) / 100);

    const byTon = priceRebar(r, { steel: 1200, steelPerTon: true, labor: 1.1, laborPerSqft: true });
    expect(byTon.material).toBe(Math.round(1923.84 * 0.6 * 100) / 100);
    expect(byTon.labor).toBe(1320);
    expect(byTon.perSqft).toBe(Math.round((byTon.total! / 1200) * 100) / 100);
  });

  test('estimate lines carry quantities, units and only the prices given', () => {
    const r = computeRebar(DEFAULT_INPUT);
    const lines = estimateLines(DEFAULT_INPUT, r, { labor: 900 });
    expect(lines.map((l) => l.unit)).toEqual(['sticks', 'ea', 'lb']);
    expect(lines[0].desc).toBe('#4 rebar, 20 ft sticks, 2,640 LF incl. laps');
    expect(lines[0].qty).toBe(144);
    expect(lines[2].desc).toBe('Labor: place and tie #4 rebar, by weight placed');
    expect(lines[2].price).toBe(0.45);
    expect(lines.filter((l) => l.price != null)).toHaveLength(1);

    const top = slab({ topMat: true });
    const byTon = estimateLines(top, computeRebar(top), {
      steel: 1000,
      steelPerTon: true,
      laborPerSqft: true,
    });
    expect(byTon.map((l) => l.unit)).toEqual(['lb', 'ea', 'sq ft']);
    expect(byTon[0].desc).toBe('#4 rebar, 288 sticks of 20 ft, 5,280 LF incl. laps, by weight');
    expect(byTon[0].price).toBe(0.5);
    expect(byTon[1].desc).toBe('Chairs, 3 ft o.c. each way, both mats');
    expect(byTon[2].qty).toBe(1200);

    expect(groupLabel(DEFAULT_INPUT)).toBe('Rebar · 40 × 30 ft slab, #4 @ 12 in');
    expect(groupLabel(slab({ spacingW: 16, topMat: true }))).toBe(
      'Rebar · 40 × 30 ft slab, #4 @ 12 / 16 in, top and bottom'
    );
  });

  test('query parameters round-trip, are clamped, and bad values fall back to defaults', () => {
    const custom = slab({ length: 22.5, spacingW: 16, bar: '5', stock: '40', topMat: true });
    expect(fromParams(toParams(custom))).toEqual(custom);
    const i = fromParams({
      l: '9999',
      w: '-3',
      sl: '0',
      sw: '1',
      cv: '40',
      bar: '11',
      st: '30',
      lap: '500',
      wst: '90',
      ch: 'abc',
      top: '1',
    });
    expect(i.length).toBe(500);
    expect(i.width).toBe(DEFAULT_INPUT.width);
    expect(i.spacingL).toBe(DEFAULT_INPUT.spacingL);
    expect(i.spacingW).toBe(3);
    expect(i.cover).toBe(12);
    expect(i.bar).toBe(DEFAULT_INPUT.bar);
    expect(i.stock).toBe(DEFAULT_INPUT.stock);
    expect(i.lapDb).toBe(100);
    expect(i.waste).toBe(40);
    expect(i.chairFt).toBe(DEFAULT_INPUT.chairFt);
    expect(i.topMat).toBe(true);
    // The longest lap the clamps allow (100 diameters of #8) is still shorter than a stick.
    expect(lapInches('8', 100)).toBeLessThan(20 * 12);
  });

  test('feet-and-inches to the nearest inch', () => {
    expect(fmtFtIn(474)).toBe('39 ft 6 in');
    expect(fmtFtIn(240)).toBe('20 ft');
    expect(fmtFtIn(8)).toBe('8 in');
    expect(fmtFtIn(239.6)).toBe('20 ft');
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
  test('renders the example slab, is indexable and carries its structured data', async ({
    page,
  }) => {
    await openTool(page);
    const r = computeRebar(DEFAULT_INPUT);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Rebar Calculator');
    await expect(page).toHaveTitle(/\| BuildWorkPro$/);
    expect((await page.title()).length).toBeLessThanOrEqual(70);
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description!.length).toBeLessThanOrEqual(160);

    await expect(out(page, 'bars-l')).toHaveText(fmt(r.barsL));
    await expect(out(page, 'bars-l-note')).toHaveText(
      '39 ft 6 in each, 3 pieces with 2 laps (43 ft 6 in of steel)'
    );
    await expect(out(page, 'bars-w')).toHaveText(fmt(r.barsW));
    await expect(out(page, 'lf')).toHaveText('2,640');
    await expect(out(page, 'laps')).toHaveText('103');
    await expect(out(page, 'laps-note')).toContainText('24 in each (48 bar diameters)');
    await expect(out(page, 'sticks')).toHaveText('144');
    await expect(out(page, 'sticks-note')).toContainText('12 more than LF ÷ 20');
    await expect(out(page, 'weight')).toHaveText('1,764');
    await expect(out(page, 'weight-note')).toContainText('0.88 tons placed');
    await expect(out(page, 'chairs')).toHaveText('134');
    await expect(out(page, 'total')).toHaveText('—');

    // Every FAQ figure on the page is the module's number.
    const text = (await page.locator('main').textContent()) ?? '';
    for (const s of [
      '21 bars each way, 42 bars of 19 ft 6 in',
      '819 linear feet, 547 lb (0.27 tons) of steel and 42 sticks, plus 45 chairs',
      'Buy 40 ft sticks and it is 21',
      '#3 is 0.376 lb per foot, #4 0.668, #5 1.043, #6 1.502, #7 2.044 and #8 2.670',
      '13.36 lb and one of #5 20.86 lb',
      'about 2,994 feet, or 149.7 sticks',
      'which is 40.95 sticks of steel',
      '144 sticks against 132 by straight division',
      '24 in on #4 bar',
      'a #3 laps 18 in, a #5 30 in and a #6 36 in',
      'a 20 × 20 slab takes 45 and the 40 × 30 example takes 134',
    ])
      expect(text).toContain(s);

    const robots = page.locator('meta[name="robots"]');
    if ((await robots.count()) > 0) await expect(robots).not.toHaveAttribute('content', /noindex/);
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(blocks.filter((s) => s.includes('"FAQPage"'))).toHaveLength(1);
    expect(blocks.filter((s) => s.includes('"WebApplication"'))).toHaveLength(1);
    const crumbs = blocks.map((b) => JSON.parse(b)).find((d) => d['@type'] === 'BreadcrumbList');
    expect(crumbs.itemListElement.map((c: { name: string }) => c.name)).toEqual([
      'Home',
      'Free Tools',
      'Rebar Calculator',
    ]);
  });

  test('every input has a label', async ({ page }) => {
    await openTool(page);
    const ids = await page
      .locator('[data-calculator] input, [data-calculator] select')
      .evaluateAll((els) => els.map((e) => e.id));
    expect(ids.length).toBeGreaterThan(14);
    for (const id of ids) {
      expect(id, 'input without an id').not.toBe('');
      await expect(page.locator(`label[for="${id}"]`)).toHaveCount(1);
    }
  });

  test('a shared link reproduces the slab, and edits update the address', async ({ page }) => {
    await openTool(page, `${PATH}?l=20&w=20&sl=12&sw=12&cv=3&bar=4&st=20&lap=48&wst=0&ch=3&top=0`);
    await expect(out(page, 'sticks')).toHaveText('42');
    await expect(out(page, 'laps')).toHaveText('0');
    await page.locator('#rb-st').selectOption('40');
    await expect(out(page, 'sticks')).toHaveText('21');
    await expect(page).toHaveURL(/[?&]st=40(&|$)/);
    await page.locator('#rb-top').check();
    const two = computeRebar(slab({ length: 20, width: 20, stock: '40', topMat: true }));
    await expect(out(page, 'bars-l')).toHaveText(fmt(two.barsL * 2));
    await expect(out(page, 'chairs')).toHaveText(fmt(two.chairs));
    await expect(page).toHaveURL(/[?&]top=1(&|$)/);
    await page.reload();
    await expect(page.locator('#rb-st')).toHaveValue('40');
    await expect(page.locator('#rb-top')).toBeChecked();
    await expect(out(page, 'sticks')).toHaveText(fmt(two.sticks));
  });

  test('remembers the contractor’s prices and price bases, and prices the slab', async ({
    page,
  }) => {
    await openTool(page);
    const r = computeRebar(DEFAULT_INPUT);
    await page.locator('#rb-p-steel').fill('12.50');
    await page.locator('#rb-p-chair').fill('0.60');
    await page.locator('#rb-p-labor').fill('900');
    const byStick = priceRebar(r, { steel: 12.5, chair: 0.6, labor: 900 });
    await expect(out(page, 'total')).toHaveText(money(byStick.total!));
    await expect(out(page, 'labor-label')).toHaveText('Labor, 0.88 tons placed');

    await page.locator('#rb-p-steel-basis').selectOption('ton');
    await page.locator('#rb-p-steel').fill('1200');
    await page.locator('#rb-p-labor-basis').selectOption('sqft');
    await page.locator('#rb-p-labor').fill('1.10');
    const byTon = priceRebar(r, {
      steel: 1200,
      steelPerTon: true,
      chair: 0.6,
      labor: 1.1,
      laborPerSqft: true,
    });
    await expect(out(page, 'total')).toHaveText(money(byTon.total!));
    await expect(page.locator('label[for="rb-p-steel"]')).toHaveText('Rebar, per ton ($)');
    await expect(page.locator('label[for="rb-p-labor"]')).toHaveText(
      'Labor, per sq ft of slab ($)'
    );

    await page.reload();
    await expect(page.locator('[data-calculator][data-ready="true"]')).toBeVisible();
    await expect(page.locator('#rb-p-chair')).toHaveValue('0.6');
    await expect(page.locator('#rb-p-steel-basis')).toHaveValue('ton');
    await expect(page.locator('#rb-p-labor-basis')).toHaveValue('sqft');
    await expect(out(page, 'total')).toHaveText(money(byTon.total!));
  });

  test('adds the slab to the estimate tray', async ({ page }) => {
    await openTool(page);
    await page.locator('#rb-p-steel').fill('12.50');
    await page.getByRole('button', { name: 'Add to estimate' }).click();
    const group = page.locator('[data-tray-group]');
    await expect(group).toHaveCount(1);
    await expect(group).toContainText('Rebar · 40 × 30 ft slab, #4 @ 12 in');
    await expect(page.locator('[data-tray-count]')).toHaveText('3 lines');
    await expect(page.locator('[data-tray-total]')).toHaveText(money(144 * 12.5));

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download CSV' }).click(),
    ]);
    const csv = await readFile((await download.path())!, 'utf-8');
    expect(csv).toContain('"#4 rebar, 20 ft sticks, 2,640 LF incl. laps",144,sticks,12.5,1800.00');
    expect(csv).toContain('Labor: place and tie #4 rebar, by weight placed');
  });

  test('fits a phone without horizontal page scroll', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openTool(page);
    await page.getByRole('button', { name: 'Add to estimate' }).click();
    await expect(page.locator('[data-tray-group]')).toHaveCount(1);
    const widths = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }));
    expect(widths.page).toBeLessThanOrEqual(widths.viewport);
  });
});
