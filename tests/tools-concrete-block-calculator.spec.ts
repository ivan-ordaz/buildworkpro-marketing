import { test, expect, type Page } from '@playwright/test';
import {
  BLOCKS_PER_SQFT,
  computeBlock,
  CUFT_PER_CUYD,
  DEFAULT_INPUT,
  estimateLines,
  FACE_SQFT,
  fromParams,
  GROUT_FULL_CUFT_PER_100SQFT,
  groupLabel,
  groutPerCell,
  MORTAR_BLOCKS_PER_80LB,
  mortarFor,
  priceBlock,
  toParams,
  WIDTHS,
  type BlockInput,
} from '../src/lib/calculators/block';
import { fmt, money } from '../src/lib/calculators/format';

// /tools/concrete-block-calculator/. Expected numbers come from the same math
// module the page uses, plus literal checks that pin every figure quoted in the
// page's FAQ (blocks per sq ft, the 10 × 8 wall, courses, mortar per 100 blocks,
// fully grouted and cell-grouted 8 in walls).

const PATH = '/tools/concrete-block-calculator/';
const wall = (over: Partial<BlockInput>): BlockInput => ({ ...DEFAULT_INPUT, ...over });

test.describe('concrete block math', () => {
  test('an 8 × 16 face is 8/9 sq ft: 1.125 blocks per sq ft, 119 per 100 with 5% waste', () => {
    expect(BLOCKS_PER_SQFT).toBe(1.125);
    expect(FACE_SQFT * BLOCKS_PER_SQFT).toBeCloseTo(1, 12);
    // 12.5 × 8 = 100 sq ft
    for (const width of WIDTHS) {
      expect(computeBlock(wall({ length: 12.5, height: 8, width, waste: 0 })).blocksLaid).toBe(113);
      expect(computeBlock(wall({ length: 12.5, height: 8, width, waste: 5 })).blocks).toBe(119);
    }
  });

  test('a 10 × 8 wall is 90 blocks in 12 courses, 95 with 5% waste', () => {
    const r = computeBlock(wall({ length: 10, height: 8, openings: 0, waste: 5 }));
    expect(r.area).toBe(80);
    expect(r.blocksLaid).toBe(90);
    expect(r.blocks).toBe(95);
    expect(r.courses).toBe(12);
    expect(r.blocksLaid / r.courses).toBe(7.5);
  });

  test('an 8 ft wall has 12 courses and 6 rows of joint reinforcement every other course', () => {
    const rows = (joint: BlockInput['joint']) =>
      computeBlock(wall({ length: 10, height: 8, joint })).jointRows;
    expect([rows('0'), rows('1'), rows('2'), rows('3')]).toEqual([0, 11, 6, 4]);
    expect(computeBlock(wall({ length: 10, height: 8, joint: '2' })).jointLf).toBe(60);
    const partial = computeBlock(wall({ height: 7 }));
    expect(partial.courses).toBe(10.5);
    expect(partial.wholeCourses).toBe(11);
  });

  test('mortar for 100 blocks: 8⅓ bags of 80 lb at 12 a bag, so 9, about 5.8 cu ft', () => {
    expect(MORTAR_BLOCKS_PER_80LB).toEqual({ '4': 16, '6': 13, '8': 12, '10': 12, '12': 11 });
    const m = mortarFor(100, 12);
    expect((100 / 12).toFixed(2)).toBe('8.33');
    expect(m.bags).toBe(9);
    expect(m.cuft.toFixed(1)).toBe('5.8');
    expect(mortarFor(100, 12, 60).bags).toBe(12); // 9 blocks per 60 lb bag
    expect(mortarFor(100, 12, 3000).bags).toBe(1); // 450 per bulk bag
    expect(mortarFor(0, 12).bags).toBe(0);
  });

  test('mortar uses blocks laid, the typical rate by width, or the contractor’s own rate', () => {
    const typical = computeBlock(wall({ length: 10, height: 8, width: '12' }));
    expect(typical.mortarRate).toBe(11);
    expect(typical.mortarTypical).toBe(true);
    expect(typical.mortarBags).toBe(Math.ceil(90 / 11));
    const own = computeBlock(wall({ length: 10, height: 8, mortarRate: 16 }));
    expect(own.mortarTypical).toBe(false);
    expect(own.mortarBags).toBe(6); // 90 ÷ 16 = 5.6
  });

  test('a fully grouted 8 in wall takes 36.1 cu ft per 100 sq ft; a 10 × 8 wall 28.9 cu ft', () => {
    expect(GROUT_FULL_CUFT_PER_100SQFT).toEqual({ '6': 25.6, '8': 36.1, '10': 47.0, '12': 58.9 });
    expect((36.1 / CUFT_PER_CUYD).toFixed(2)).toBe('1.34');
    const r = computeBlock(wall({ length: 10, height: 8, grout: 'full' }));
    expect(r.groutCuft.toFixed(1)).toBe('28.9');
    expect(r.groutCuyd.toFixed(2)).toBe('1.07');
    expect(r.groutBags).toBe(45);
    expect(r.groutOrderCuyd).toBe(1.25);
  });

  test('a 40 × 8 wall with bars at 48 in: 11 bars, 132 grouted cells, 21.2 cu ft', () => {
    expect(groutPerCell('8').toFixed(2)).toBe('0.16');
    const r = computeBlock(wall({ length: 40, height: 8, grout: 'cells', spacing: 48 }));
    expect(r.bars).toBe(11);
    expect(r.groutedCells).toBe(132);
    expect(r.groutCuft.toFixed(1)).toBe('21.2');
    expect(r.groutCuyd.toFixed(2)).toBe('0.78');
    expect(r.groutOrderCuyd).toBe(1);
    // Grouting cells never exceeds filling every cell.
    const tight = computeBlock(wall({ length: 2, height: 8, grout: 'cells', spacing: 16 }));
    const full = computeBlock(wall({ length: 2, height: 8, grout: 'full' }));
    expect(tight.groutCuft).toBeLessThanOrEqual(full.groutCuft + 1e-9);
  });

  test('4 in block is never grouted or barred', () => {
    const r = computeBlock(wall({ width: '4', grout: 'full' }));
    expect(r.grout).toBe('none');
    expect([r.groutCuft, r.bars, r.sticks]).toEqual([0, 0, 0]);
    expect(groutPerCell('4')).toBe(0);
  });

  test('bars run the wall height and are cut from whole sticks', () => {
    const r20 = computeBlock(wall({ length: 40, height: 8, stick: '20' }));
    expect([r20.bars, r20.barLf, r20.sticks, r20.spliced]).toEqual([11, 88, 6, false]);
    expect(computeBlock(wall({ length: 40, height: 8, stick: '10' })).sticks).toBe(11);
    const tall = computeBlock(wall({ length: 40, height: 24, stick: '20' }));
    expect(tall.spliced).toBe(true);
    expect(tall.sticks).toBe(Math.ceil((11 * 24) / 20));
    expect(computeBlock(wall({ grout: 'none' })).bars).toBe(0);
  });

  test('openings never take the wall area below zero', () => {
    const r = computeBlock(wall({ length: 4, height: 4, openings: 500 }));
    expect(r.area).toBe(0);
    expect([r.blocks, r.mortarBags, r.groutCuft, r.bars]).toEqual([0, 0, 0, 0]);
  });

  test('prices only what the contractor priced, grout by the yard or the bag', () => {
    const r = computeBlock(DEFAULT_INPUT);
    expect(priceBlock(DEFAULT_INPUT, r, {}).total).toBeNull();
    const partial = priceBlock(DEFAULT_INPUT, r, { block: 2.5 });
    expect(partial.material).toBe(r.blocks * 2.5);
    expect(partial.materialComplete).toBe(false);
    const all = { block: 2.5, mortar: 9, groutYd: 220, rebar: 14, joint: 0.4, labor: 3 };
    const full = priceBlock(DEFAULT_INPUT, r, all);
    expect(full.materialComplete).toBe(true);
    expect(full.material).toBe(
      Math.round(
        (r.blocks * 2.5 +
          r.mortarBags * 9 +
          r.groutOrderCuyd * 220 +
          r.sticks * 14 +
          r.jointLf * 0.4) *
          100
      ) / 100
    );
    expect(full.labor).toBe(r.blocksLaid * 3);
    const byBag = { ...DEFAULT_INPUT, groutBy: 'bag' as const };
    expect(priceBlock(byBag, r, { groutYd: 220 }).material).toBeNull();
    expect(priceBlock(byBag, r, { groutBag: 8 }).material).toBe(r.groutBags * 8);
  });

  test('estimate lines carry quantities, units and only the prices given', () => {
    const r = computeBlock(DEFAULT_INPUT);
    const lines = estimateLines(DEFAULT_INPUT, r, { labor: 3 });
    expect(lines.map((l) => l.desc)).toEqual([
      '8 in CMU, 8 × 16 face',
      'Mortar, 80 lb bags',
      'Grout, cells at 48 in o.c.',
      '#5 rebar, 20 ft sticks: 11 bars × 8 ft',
      'Joint reinforcement, every other course',
      'Labor: lay 8 in block',
    ]);
    expect(lines.map((l) => l.unit)).toEqual(['blocks', 'bags', 'cu yd', 'sticks', 'LF', 'blocks']);
    expect(lines.filter((l) => l.price != null)).toHaveLength(1);
    expect(groupLabel(DEFAULT_INPUT)).toBe('Block wall · 40 × 8 ft, 8 in CMU');
    const fullBags = wall({ grout: 'full', groutBy: 'bag' });
    const bagged = estimateLines(fullBags, computeBlock(fullBags), { groutBag: 8 });
    expect(bagged[2]).toMatchObject({
      desc: 'Grout, 80 lb bags, fully grouted',
      unit: 'bags',
      qty: computeBlock(fullBags).groutBags,
      price: 8,
    });
    const plain = wall({ grout: 'none', joint: '0' });
    const units = estimateLines(plain, computeBlock(plain), {}).map((l) => l.unit);
    expect(units).toEqual(['blocks', 'bags', 'blocks']);
  });

  test('query parameters round-trip, are clamped, and bad values fall back to defaults', () => {
    const custom = wall({ length: 22, width: '12', grout: 'full', mortarRate: 14, groutBy: 'bag' });
    expect(fromParams(toParams(custom))).toEqual(custom);
    expect(toParams(DEFAULT_INPUT)).not.toHaveProperty('mb');
    const i = fromParams({
      l: '9999',
      h: '-3',
      o: 'abc',
      w: '7',
      wst: '90',
      g: 'concrete',
      sp: '50',
      bar: '9',
      st: '30',
      jr: '5',
      bag: '50',
      mb: '0',
      gb: 'truck',
    });
    expect(i.length).toBe(500);
    expect(i.height).toBe(DEFAULT_INPUT.height);
    expect(i.openings).toBe(DEFAULT_INPUT.openings);
    expect(i.waste).toBe(40);
    expect({ ...i, length: DEFAULT_INPUT.length, waste: DEFAULT_INPUT.waste }).toEqual(
      DEFAULT_INPUT
    );
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
  test('renders the example wall, is indexable and carries its structured data', async ({
    page,
  }) => {
    await openTool(page);
    const r = computeBlock(DEFAULT_INPUT);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Concrete Block Calculator');
    await expect(out(page, 'area')).toHaveText(fmt(r.area));
    await expect(out(page, 'courses')).toHaveText('12');
    await expect(out(page, 'blocks')).toHaveText(fmt(r.blocks));
    await expect(out(page, 'mortar')).toHaveText(fmt(r.mortarBags));
    await expect(out(page, 'grout')).toHaveText(fmt(r.groutCuyd, 2));
    await expect(out(page, 'bars')).toHaveText('11');
    await expect(out(page, 'joint')).toHaveText(fmt(r.jointLf));
    await expect(out(page, 'total')).toHaveText('—');
    await expect(page.locator('#cb-mb')).toHaveAttribute('placeholder', 'typical 12');

    const robots = page.locator('meta[name="robots"]');
    if ((await robots.count()) > 0) await expect(robots).not.toHaveAttribute('content', /noindex/);
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(blocks.filter((s) => s.includes('"FAQPage"'))).toHaveLength(1);
    expect(blocks.filter((s) => s.includes('"WebApplication"'))).toHaveLength(1);
    const crumbs = blocks.map((b) => JSON.parse(b)).find((d) => d['@type'] === 'BreadcrumbList');
    expect(crumbs.itemListElement.map((c: { name: string }) => c.name)).toEqual([
      'Home',
      'Free Tools',
      'Concrete Block Calculator',
    ]);
  });

  test('a shared link reproduces the wall, and edits update the address', async ({ page }) => {
    await openTool(page, `${PATH}?l=10&h=8&o=0&w=8&wst=5&g=full`);
    await expect(out(page, 'blocks')).toHaveText('95');
    await expect(out(page, 'grout')).toHaveText('1.07');
    await expect(out(page, 'grout-note')).toHaveText('28.9 cu ft, every cell; order 1.25 cu yd');
    await page.locator('#cb-gb').selectOption('bag');
    await expect(out(page, 'grout-note')).toHaveText(
      '28.9 cu ft, every cell; 45 bags of 80 lb at 0.65 cu ft'
    );
    await page.locator('#cb-h').fill('4');
    const r = computeBlock(wall({ length: 10, height: 4, grout: 'full' }));
    await expect(out(page, 'blocks')).toHaveText(fmt(r.blocks));
    await expect(page).toHaveURL(/[?&]h=4(&|$)/);
    await page.reload();
    await expect(page.locator('#cb-h')).toHaveValue('4');
    await expect(page.locator('#cb-g')).toHaveValue('full');
  });

  test('the mortar rate is typical by width until the contractor sets one', async ({ page }) => {
    await openTool(page);
    await page.locator('#cb-w').selectOption('12');
    await expect(page.locator('#cb-mb')).toHaveAttribute('placeholder', 'typical 11');
    await page.locator('#cb-mb').fill('16');
    const r = computeBlock(wall({ width: '12', mortarRate: 16 }));
    await expect(out(page, 'mortar')).toHaveText(fmt(r.mortarBags));
    await expect(page).toHaveURL(/[?&]mb=16(&|$)/);
    await page.getByRole('button', { name: 'Example wall' }).click();
    await expect(page.locator('#cb-mb')).toHaveValue('');
    await expect(page).not.toHaveURL(/[?&]mb=/);
  });

  test('4 in block turns grout off', async ({ page }) => {
    await openTool(page);
    await page.locator('#cb-w').selectOption('4');
    await expect(page.locator('#cb-g')).toBeDisabled();
    await expect(out(page, 'grout')).toHaveText('0');
    await expect(out(page, 'bars')).toHaveText('0');
    await expect(out(page, 'grout-note')).toHaveText('4 in block is not grouted');
  });

  test('remembers the contractor’s prices and prices the wall', async ({ page }) => {
    await openTool(page);
    await page.locator('#cb-p-block').fill('2.85');
    await page.locator('#cb-p-labor').fill('3.25');
    const r = computeBlock(DEFAULT_INPUT);
    const p = priceBlock(DEFAULT_INPUT, r, { block: 2.85, labor: 3.25 });
    await expect(out(page, 'total')).toHaveText(money(p.total!));
    await page.reload();
    await expect(page.locator('[data-calculator][data-ready="true"]')).toBeVisible();
    await expect(page.locator('#cb-p-block')).toHaveValue('2.85');
    await expect(out(page, 'total')).toHaveText(money(p.total!));
  });

  test('builds an estimate across walls', async ({ page }) => {
    await openTool(page);
    await page.locator('#cb-p-labor').fill('3');
    await page.getByRole('button', { name: 'Add to estimate' }).click();
    await page.locator('#cb-l').fill('24');
    await page.getByRole('button', { name: 'Add to estimate' }).click();
    const groups = page.locator('[data-tray-group]');
    await expect(groups).toHaveCount(2);
    await expect(groups.first()).toContainText('Block wall · 40 × 8 ft, 8 in CMU');
    await expect(groups.nth(1)).toContainText('Block wall · 24 × 8 ft, 8 in CMU');
    await expect(page.locator('[data-tray-count]')).toHaveText('12 lines');

    const first = computeBlock(DEFAULT_INPUT);
    const second = computeBlock(wall({ length: 24 }));
    const total = (first.blocksLaid + second.blocksLaid) * 3;
    await expect(page.locator('[data-tray-total]')).toHaveText(money(total));
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
