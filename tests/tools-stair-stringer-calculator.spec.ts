import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import {
  codeChecks,
  computeStairs,
  DCA6,
  DEFAULT_INPUT,
  estimateLines,
  fmtDeg,
  fmtFtIn,
  fmtIn,
  fromParams,
  groupLabel,
  IRC,
  priceStairs,
  stairAngle,
  stringerCount,
  throatDepth,
  type StairInput,
} from '../src/lib/calculators/stairs';
import { fmt, money } from '../src/lib/calculators/format';

// /tools/stair-stringer-calculator/. Expected numbers come from the same math
// module the page uses, plus literal checks that pin every figure quoted in the
// page's FAQ (the 108 in example stair is the calculator's default).

const PATH = '/tools/stair-stringer-calculator/';
const stair = (over: Partial<StairInput>): StairInput => ({ ...DEFAULT_INPUT, ...over });

test.describe('feet-inches formatter', () => {
  test('rounds to the nearest 1/16 in and reduces the fraction', () => {
    expect(fmtIn(7.714)).toBe('7 11/16 in');
    expect(fmtIn(7.75)).toBe('7 3/4 in');
    expect(fmtIn(0.5)).toBe('1/2 in');
    expect(fmtIn(0.04)).toBe('1/16 in');
    expect(fmtIn(0.02)).toBe('0 in');
    expect(fmtIn(36)).toBe('36 in');
    expect(fmtIn(5.97)).toBe('6 in');
    expect(fmtIn(-1.5)).toBe('-1 1/2 in');
  });

  test('switches to feet at 12 in and carries a rounded 12 in into the feet', () => {
    expect(fmtFtIn(130)).toBe('10 ft 10 in');
    expect(fmtFtIn(169.009)).toBe('14 ft 1 in');
    expect(fmtFtIn(192)).toBe('16 ft');
    expect(fmtFtIn(191.99)).toBe('16 ft');
    expect(fmtFtIn(80)).toBe('6 ft 8 in');
    expect(fmtFtIn(181.5)).toBe('15 ft 1 1/2 in');
    expect(fmtFtIn(9.2)).toBe('9 3/16 in');
    expect(fmtFtIn(12)).toBe('1 ft');
  });
});

test.describe('stair math', () => {
  test('a 9-foot rise: the FAQ example', () => {
    const r = computeStairs(DEFAULT_INPUT);
    expect(DEFAULT_INPUT.rise).toBe(108);
    expect(r.risers).toBe(14);
    expect(r.riserHeight).toBeCloseTo(7.714, 3);
    expect(fmtIn(r.riserHeight)).toBe('7 11/16 in');
    expect(fmtIn(108 / 13)).toBe('8 5/16 in'); // 13 risers would break the 7 3/4 in limit
    expect(r.treads).toBe(13);
    expect(r.totalRun).toBe(130);
    expect(fmtFtIn(r.totalRun)).toBe('10 ft 10 in');
  });

  test('stringer length is the hypotenuse, and the board is the next standard length', () => {
    const r = computeStairs(DEFAULT_INPUT);
    expect(r.stringerLength).toBeCloseTo(Math.sqrt(130 ** 2 + 108 ** 2), 9);
    expect(Math.round(r.stringerLength)).toBe(169);
    expect(fmtFtIn(r.stringerLength)).toBe('14 ft 1 in');
    expect(r.boardNeeded).toBeCloseTo(181.009, 3);
    expect(r.boardFt).toBe(16);
    // With no extra, 169 in still needs a 16 ft board (14 ft is 168 in).
    expect(computeStairs(stair({ extra: 0 })).boardFt).toBe(16);
    // Past 20 ft there is no standard length to round to.
    const tall = computeStairs(stair({ rise: 151, extra: 12 }));
    expect(tall.boardFt).toBeNull();
    expect(tall.tooLong).toBe(true);
  });

  test('stair angle: the example and the steepest the IRC allows', () => {
    expect(fmtDeg(computeStairs(DEFAULT_INPUT).angle)).toBe('37.6°');
    expect(fmtDeg(stairAngle(IRC.maxRiser, IRC.minTread))).toBe('37.8°');
  });

  test('stringer count: 18 in max on center, outer stringers at the edges', () => {
    expect(DCA6.maxSpacing).toBe(18);
    expect(stringerCount(36, 18)).toBe(3);
    expect(fmtIn((36 - 1.5) / 2)).toBe('17 1/4 in');
    expect(stringerCount(48, 18)).toBe(4);
    expect(stringerCount(36, 16)).toBe(4);
    expect(stringerCount(12, 18)).toBe(2);
    expect(stringerCount(0, 18)).toBe(0);
    expect(computeStairs(DEFAULT_INPUT).stringers).toBe(3);
  });

  test('dropping the stringer: the FAQ figures', () => {
    const r = computeStairs(DEFAULT_INPUT);
    expect(DEFAULT_INPUT.thickness).toBe(1.5);
    expect(r.drop).toBe(1.5);
    expect(fmtIn(r.firstStepUndropped)).toBe('9 3/16 in');
    expect(fmtIn(r.topStepUndropped)).toBe('6 3/16 in');
  });

  test('throat depth: a 2 × 12 passes the DCA 6 5 in, a 2 × 10 does not', () => {
    const r12 = computeStairs(DEFAULT_INPUT);
    expect(fmtIn(r12.throat)).toBe('5 1/8 in');
    // DCA 6 commentary: a 2x12 cut at 7.75:10 leaves 5.1 in.
    expect(throatDepth(11.25, 7.75, 10)).toBeCloseTo(5.1, 1);
    const r10 = computeStairs(stair({ stock: '2x10' }));
    expect(r10.throat).toBeLessThan(DCA6.minThroat);
    expect(codeChecks(stair({ stock: '2x10' }), r10).find((c) => c.id === 'throat')!.status).toBe(
      'fail'
    );
  });

  test('code check passes the example and flags what breaks the IRC', () => {
    const ok = codeChecks(DEFAULT_INPUT, computeStairs(DEFAULT_INPUT));
    const status = Object.fromEntries(ok.map((c) => [c.id, c.status]));
    expect(status).toMatchObject({
      riser: 'pass',
      tread: 'pass',
      variation: 'pass',
      width: 'pass',
      flight: 'pass',
      headroom: 'info',
      handrail: 'info',
      throat: 'pass',
    });
    expect(ok.find((c) => c.id === 'open')!.hidden).toBe(true);
    expect(ok.find((c) => c.id === 'headroom')!.detail).toContain('6 ft 8 in');
    expect(ok.find((c) => c.id === 'handrail')!.detail).toContain('14 risers');

    const bad = stair({ rise: 160, maxRiser: 8.25, tread: 9, width: 32, closed: false });
    const checks = codeChecks(bad, computeStairs(bad));
    const by = Object.fromEntries(checks.map((c) => [c.id, c]));
    expect(by.riser.status).toBe('fail'); // 160 / 20 = 8 in
    expect(by.tread.status).toBe('fail');
    expect(by.width.status).toBe('fail');
    expect(by.flight.status).toBe('fail');
    expect(by.flight.detail).toContain('Add a landing');
    expect(by.open.hidden).toBe(false);
    expect(by.open.detail).toContain('4 in sphere');
  });

  test('a riser exactly at the limit counts once, and a zero rise is empty', () => {
    const exact = computeStairs(stair({ rise: 7.75 * 12 }));
    expect(exact.risers).toBe(12);
    expect(exact.riserHeight).toBeCloseTo(7.75, 9);
    const none = computeStairs(stair({ rise: 0 }));
    expect([none.risers, none.treads, none.stringers, none.stringerLength]).toEqual([0, 0, 0, 0]);
    expect(none.boardFt).toBeNull();
    expect(none.tooLong).toBe(false);
  });

  test('prices only what the contractor priced, per step or lump sum', () => {
    const r = computeStairs(DEFAULT_INPUT);
    expect(priceStairs(DEFAULT_INPUT, r, {}).total).toBeNull();
    const partial = priceStairs(DEFAULT_INPUT, r, { stringer: 58 });
    expect(partial.material).toBe(3 * 58);
    expect(partial.materialComplete).toBe(false);
    const full = priceStairs(DEFAULT_INPUT, r, { stringer: 58, tread: 22, riser: 9, labor: 45 });
    expect(full.material).toBe(3 * 58 + 13 * 22 + 14 * 9);
    expect(full.materialComplete).toBe(true);
    expect(full.labor).toBe(14 * 45);
    expect(full.total).toBe(full.material! + full.labor!);
    expect(full.perStep).toBe(Math.round((full.total! / 14) * 100) / 100);
    const lump = priceStairs(DEFAULT_INPUT, r, { labor: 900, laborLump: true });
    expect(lump.labor).toBe(900);
    // Open risers: no riser boards to price.
    const open = stair({ closed: false });
    expect(priceStairs(open, r, { riser: 9 }).material).toBeNull();
  });

  test('estimate lines carry quantities and only the prices given', () => {
    const r = computeStairs(DEFAULT_INPUT);
    const lines = estimateLines(DEFAULT_INPUT, r, { labor: 45 });
    expect(lines.map((l) => [l.qty, l.unit])).toEqual([
      [3, 'boards'],
      [13, 'treads'],
      [14, 'risers'],
      [14, 'steps'],
    ]);
    expect(lines[0].desc).toBe('Stringers, 2 × 12 × 16 ft, cut to 14 ft 1 in');
    expect(lines.filter((l) => l.price != null)).toHaveLength(1);
    const lump = estimateLines(stair({ closed: false }), r, { labor: 900, laborLump: true });
    expect(lump.map((l) => l.unit)).toEqual(['boards', 'treads', 'lump sum']);
    expect(lump.at(-1)!.qty).toBe(1);
    expect(groupLabel(DEFAULT_INPUT)).toBe('Stairs · 108 in rise, 36 in wide');
  });

  test('query parameters are clamped and bad values fall back to defaults', () => {
    const i = fromParams({
      r: '9999',
      mr: '0',
      t: 'abc',
      th: '9',
      w: '-3',
      s: '2x4',
      sp: '2',
      x: '500',
      cr: '0',
    });
    expect(i.rise).toBe(300);
    expect(i.maxRiser).toBe(DEFAULT_INPUT.maxRiser);
    expect(i.tread).toBe(DEFAULT_INPUT.tread);
    expect(i.thickness).toBe(3);
    expect(i.width).toBe(DEFAULT_INPUT.width);
    expect(i.stock).toBe(DEFAULT_INPUT.stock);
    expect(i.spacing).toBe(8);
    expect(i.extra).toBe(60);
    expect(i.closed).toBe(false);
    expect(fromParams({ mr: '20' }).maxRiser).toBe(12);
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
const check = (page: Page, id: string) => page.locator(`[data-check="${id}"]`);

test.describe(PATH, () => {
  test('renders the example stair, is indexable and carries its structured data', async ({
    page,
  }) => {
    await openTool(page);
    const r = computeStairs(DEFAULT_INPUT);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Stair Stringer Calculator');
    await expect(page).toHaveTitle(/\| BuildWorkPro$/);
    expect((await page.title()).length).toBeLessThanOrEqual(70);
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description!.length).toBeLessThanOrEqual(160);

    await expect(out(page, 'risers')).toHaveText(fmt(r.risers));
    await expect(out(page, 'risers-note')).toContainText('7 11/16 in');
    await expect(out(page, 'treads')).toHaveText('13');
    await expect(out(page, 'run')).toHaveText('10 ft 10 in');
    await expect(out(page, 'stringer')).toHaveText('14 ft 1 in');
    await expect(out(page, 'stringer-note')).toContainText('Buy 16 ft 2 × 12');
    await expect(out(page, 'stringers')).toHaveText('3');
    await expect(out(page, 'angle')).toHaveText('37.6°');
    await expect(out(page, 'drop')).toHaveText('1 1/2 in');
    await expect(out(page, 'total')).toHaveText('—');

    await expect(check(page, 'riser').locator('[data-check-status]')).toHaveText('Pass');
    await expect(check(page, 'riser')).toContainText('R311.7.5.1');
    await expect(check(page, 'headroom').locator('[data-check-status]')).toHaveText('Note');
    await expect(check(page, 'open')).toBeHidden();

    // Every FAQ figure on the page is the module's number.
    const faq = (await page.locator('main').textContent()) ?? '';
    for (const s of [
      '14 risers of 7 11/16 in',
      '8 5/16 in',
      '13 treads',
      '10 ft 10 in',
      '169 in, or 14 ft 1 in',
      '16 ft 2 × 12',
      '17 1/4 in on center',
      'A 48 in stair takes 4',
      '9 3/16 in at the bottom and 6 3/16 in at the top',
      '37.8°',
      '37.6°',
    ])
      expect(faq).toContain(s);

    const robots = page.locator('meta[name="robots"]');
    if ((await robots.count()) > 0) await expect(robots).not.toHaveAttribute('content', /noindex/);
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(blocks.filter((s) => s.includes('"FAQPage"'))).toHaveLength(1);
    expect(blocks.filter((s) => s.includes('"WebApplication"'))).toHaveLength(1);
    const crumbs = blocks.map((b) => JSON.parse(b)).find((d) => d['@type'] === 'BreadcrumbList');
    expect(crumbs.itemListElement.map((c: { name: string }) => c.name)).toEqual([
      'Home',
      'Free Tools',
      'Stair Stringer Calculator',
    ]);
  });

  test('every input has a label', async ({ page }) => {
    await openTool(page);
    const ids = await page
      .locator('[data-calculator] input, [data-calculator] select')
      .evaluateAll((els) => els.map((e) => e.id));
    expect(ids.length).toBeGreaterThan(10);
    for (const id of ids) {
      expect(id, 'input without an id').not.toBe('');
      await expect(page.locator(`label[for="${id}"]`)).toHaveCount(1);
    }
  });

  test('a shared link reproduces the stair, flags failures, and edits update the address', async ({
    page,
  }) => {
    await openTool(page, `${PATH}?r=160&mr=7.75&t=10&th=1&w=32&s=2x10&sp=18&x=12&cr=0`);
    const input = stair({ rise: 160, thickness: 1, width: 32, stock: '2x10', closed: false });
    const r = computeStairs(input);
    await expect(out(page, 'risers')).toHaveText(fmt(r.risers));
    await expect(check(page, 'width').locator('[data-check-status]')).toHaveText('Fails');
    await expect(check(page, 'flight').locator('[data-check-status]')).toHaveText('Fails');
    await expect(check(page, 'throat').locator('[data-check-status]')).toHaveText('Fails');
    await expect(check(page, 'open')).toBeVisible();

    await page.locator('#st-r').fill('100');
    const next = computeStairs({ ...input, rise: 100 });
    await expect(out(page, 'risers')).toHaveText(fmt(next.risers));
    await expect(out(page, 'run')).toHaveText(fmtFtIn(next.totalRun));
    await expect(check(page, 'flight').locator('[data-check-status]')).toHaveText('Pass');
    await expect(page).toHaveURL(/[?&]r=100(&|$)/);
    await page.reload();
    await expect(page.locator('#st-r')).toHaveValue('100');
    await expect(page.locator('#st-cr')).not.toBeChecked();
  });

  test('remembers the contractor’s prices and labor basis, and prices the stair', async ({
    page,
  }) => {
    await openTool(page);
    await page.locator('#st-p-stringer').fill('58');
    await page.locator('#st-p-tread').fill('22.50');
    await page.locator('#st-p-labor').fill('45');
    const r = computeStairs(DEFAULT_INPUT);
    const perStep = priceStairs(DEFAULT_INPUT, r, { stringer: 58, tread: 22.5, labor: 45 });
    await expect(out(page, 'total')).toHaveText(money(perStep.total!));
    await expect(out(page, 'labor-label')).toHaveText('Labor, 14 steps');

    await page.locator('#st-p-basis').selectOption('lump');
    await page.locator('#st-p-labor').fill('900');
    const lump = priceStairs(DEFAULT_INPUT, r, {
      stringer: 58,
      tread: 22.5,
      labor: 900,
      laborLump: true,
    });
    await expect(out(page, 'total')).toHaveText(money(lump.total!));
    await expect(page.locator('label[for="st-p-labor"]')).toHaveText(
      'Labor, lump sum for the stair ($)'
    );

    await page.reload();
    await expect(page.locator('[data-calculator][data-ready="true"]')).toBeVisible();
    await expect(page.locator('#st-p-tread')).toHaveValue('22.5');
    await expect(page.locator('#st-p-basis')).toHaveValue('lump');
    await expect(out(page, 'total')).toHaveText(money(lump.total!));
  });

  test('adds the stair to the estimate tray', async ({ page }) => {
    await openTool(page);
    await page.locator('#st-p-labor').fill('45');
    await page.getByRole('button', { name: 'Add to estimate' }).click();
    const group = page.locator('[data-tray-group]');
    await expect(group).toHaveCount(1);
    await expect(group).toContainText('Stairs · 108 in rise, 36 in wide');
    await expect(page.locator('[data-tray-count]')).toHaveText('4 lines');
    await expect(page.locator('[data-tray-total]')).toHaveText(money(14 * 45));

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download CSV' }).click(),
    ]);
    const csv = await readFile((await download.path())!, 'utf-8');
    expect(csv).toContain('"Stringers, 2 × 12 × 16 ft, cut to 14 ft 1 in"');
    expect(csv).toContain('Labor: build and install, per step');
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
