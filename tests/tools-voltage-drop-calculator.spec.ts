import { test, expect, type Page } from '@playwright/test';
import {
  awgCmil,
  checkSize,
  computeVdrop,
  DEFAULT_INPUT,
  estimateLines,
  fromParams,
  K,
  minAllowed,
  notes,
  SIZES,
  voltageDrop,
  wireFeet,
  wireSize,
  type VdropInput,
} from '../src/lib/calculators/vdrop';
import { fmt, fmtTrim, money } from '../src/lib/calculators/format';

// /tools/voltage-drop-calculator/. Expected numbers come from the same math
// module the page uses, plus literal checks that pin every figure quoted in the
// page's FAQ.

const PATH = '/tools/voltage-drop-calculator/';
const run = (over: Partial<VdropInput>): VdropInput => ({ ...DEFAULT_INPUT, ...over });
const r2 = (n: number) => Math.round(n * 100) / 100;

test.describe('voltage drop math', () => {
  test('circular mils follow the AWG definition', () => {
    expect(awgCmil(36)).toBeCloseTo(25, 9);
    expect(SIZES['4-0'].cmil).toBeCloseTo(211600, 6);
    expect(Math.round(SIZES['14'].cmil)).toBe(4107);
    expect(Math.round(SIZES['12'].cmil)).toBe(6530);
    expect(Math.round(SIZES['10'].cmil)).toBe(10383);
    expect(Math.round(SIZES['1-0'].cmil)).toBe(105535);
    expect(SIZES['250'].cmil).toBe(250000);
    expect(SIZES['500'].label).toBe('500 kcmil');
    expect(SIZES['2-0'].label).toBe('2/0 AWG');
  });

  test('K and the single and three phase formulas', () => {
    expect(K).toEqual({ cu: 12.9, al: 21.2 });
    expect(voltageDrop('1', 'cu', 10000, 10, 100)).toBeCloseTo(2.58, 9);
    expect(voltageDrop('3', 'cu', 10000, 10, 100)).toBeCloseTo((Math.sqrt(3) * 12.9) / 10, 9);
    // Two parallel sets halve the drop.
    expect(voltageDrop('1', 'al', 10000, 10, 100, 2)).toBeCloseTo(2.12, 9);
  });

  test('FAQ: 100 ft of 12 AWG copper at 16 A on 120 V', () => {
    const q = run({ volts: '120', size: '12', length: 100, amps: 16 });
    const r = computeVdrop(q);
    expect(r2(r.drop)).toBe(6.32);
    expect(r2(r.pct)).toBe(5.27);
    expect(fmtTrim(r.loadVolts, 1)).toBe('113.7');
    expect(r.passes).toBe(false);
    expect(r2(checkSize(q, '10').pct)).toBe(3.31);
    expect(r.min?.size).toBe('8');
    expect(r2(r.min!.pct)).toBe(2.08);
    expect(Math.floor(r.maxLength!)).toBe(56);
  });

  test('FAQ: 150 ft at 30 A on 240 V single phase (the example circuit)', () => {
    const r = computeVdrop(DEFAULT_INPUT);
    expect(r2(r.drop)).toBe(11.18);
    expect(r2(r.pct)).toBe(4.66);
    expect(r.min?.size).toBe('8');
    expect(r2(r.min!.drop)).toBe(7.03);
    expect(r2(r.min!.pct)).toBe(2.93);
    expect(r.install).toBe('8');
    const al = run({ material: 'al' });
    const ra = computeVdrop(al);
    expect(r2(checkSize(al, '6').pct)).toBe(3.03);
    expect(ra.min?.size).toBe('4');
    expect(r2(ra.min!.pct)).toBe(1.9);
  });

  test('FAQ: aluminum drops 64% more, three phase 13% less', () => {
    expect(Math.round((K.al / K.cu - 1) * 100)).toBe(64);
    expect(Math.round((1 - Math.sqrt(3) / 2) * 100)).toBe(13);
  });

  test('FAQ: 100 A at 208 V three phase over 200 ft of 1/0 copper', () => {
    const q = run({ volts: '208', phase: '3', size: '1-0', length: 200, amps: 100 });
    const r = computeVdrop(q);
    expect(r2(r.drop)).toBe(4.23);
    expect(r2(r.pct)).toBe(2.04);
    expect(r2(computeVdrop({ ...q, phase: '1' }).pct)).toBe(2.35);
  });

  test('the smallest size respects the aluminum and parallel minimums', () => {
    expect(minAllowed('cu', 1)).toBe('14');
    expect(minAllowed('al', 1)).toBe('12');
    expect(minAllowed('cu', 2)).toBe('1-0');
    // A tiny load meets the target on anything, so the minimum is the smallest allowed size.
    expect(computeVdrop(run({ amps: 1, length: 10, material: 'al' })).min?.size).toBe('12');
    expect(computeVdrop(run({ amps: 1, length: 10, sets: 2 })).min?.size).toBe('1-0');
    const alNote = notes(run({ material: 'al', size: '14' }), computeVdrop(run({})));
    expect(alNote.some((n) => n.includes('310.3(A)'))).toBe(true);
  });

  test('a passing size is kept; the smallest size can be smaller than the entered one', () => {
    const q = run({ size: '4-0', amps: 30, length: 50 });
    const r = computeVdrop(q);
    expect(r.passes).toBe(true);
    expect(r.install).toBe('4-0');
    // 14 AWG would drop 3.93%; 12 AWG drops 2.47%.
    expect(r2(checkSize(q, '14').pct)).toBe(3.93);
    expect(r.min?.size).toBe('12');
    expect(wireSize(q, r)).toBe('4-0');
  });

  test('no size up to 500 kcmil: nothing to price unless the entered size is picked', () => {
    const q = run({ amps: 800, length: 2000 });
    const r = computeVdrop(q);
    expect(r.min).toBeNull();
    expect(r.install).toBeNull();
    expect(estimateLines(q, r, {})).toEqual([]);
    expect(estimateLines({ ...q, pick: 'sel' }, r, {})).toHaveLength(1);
    expect(notes(q, r).some((n) => n.includes('No single copper size'))).toBe(true);
  });

  test('wire footage and the estimate line', () => {
    expect(wireFeet(DEFAULT_INPUT)).toBe(330);
    expect(wireFeet(run({ conductors: 3, length: 100, sets: 2, extra: 0 }))).toBe(600);
    expect(wireFeet(run({ length: 0 }))).toBe(0);
    const r = computeVdrop(DEFAULT_INPUT);
    const [line] = estimateLines(DEFAULT_INPUT, r, { 'cu-8': 0.85, 'cu-10': 0.55 });
    expect(line).toMatchObject({
      tool: 'voltage-drop-calculator',
      desc: '8 AWG copper wire, 2 conductors × 150 ft, +10% makeup',
      qty: 330,
      unit: 'ft',
      price: 0.85,
    });
    const [entered] = estimateLines({ ...DEFAULT_INPUT, pick: 'sel' }, r, {});
    expect(entered.desc.startsWith('10 AWG copper wire')).toBe(true);
    expect(entered.price).toBeNull();
  });

  test('query parameters are clamped and bad values fall back to defaults', () => {
    const i = fromParams({
      v: '600',
      vc: '0',
      ph: '2',
      m: 'gold',
      s: '13',
      l: '99999',
      a: '-5',
      p: '0',
      t: '90',
      n: '9',
      x: '80',
      w: 'max',
    });
    expect(i.volts).toBe(DEFAULT_INPUT.volts);
    expect(i.customVolts).toBe(DEFAULT_INPUT.customVolts);
    expect(i.phase).toBe(DEFAULT_INPUT.phase);
    expect(i.material).toBe(DEFAULT_INPUT.material);
    expect(i.size).toBe(DEFAULT_INPUT.size);
    expect(i.length).toBe(10000);
    expect(i.amps).toBe(DEFAULT_INPUT.amps);
    expect(i.sets).toBe(1);
    expect(i.target).toBe(20);
    expect(i.conductors).toBe(6);
    expect(i.extra).toBe(50);
    expect(i.pick).toBe(DEFAULT_INPUT.pick);
    expect(fromParams({ v: 'custom', vc: '600' })).toMatchObject({
      volts: 'custom',
      customVolts: 600,
    });
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
  test('renders the example circuit, is indexable and carries its structured data', async ({
    page,
  }) => {
    await openTool(page);
    const r = computeVdrop(DEFAULT_INPUT);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Voltage Drop Calculator');
    await expect(out(page, 'drop')).toHaveText(`${fmtTrim(r.drop, 2)} V`);
    await expect(out(page, 'drop-note')).toContainText('4.66% of 240 V');
    await expect(out(page, 'load')).toHaveText('228.8 V');
    await expect(out(page, 'status')).toHaveText('Over 3%');
    await expect(out(page, 'status')).toHaveAttribute('data-status', 'fail');
    await expect(out(page, 'min')).toHaveText('8 AWG');
    await expect(out(page, 'max')).toHaveText(`${fmt(Math.floor(r.maxLength!))} ft`);
    await expect(out(page, 'feet')).toHaveText('330 ft');
    await expect(out(page, 'cost')).toHaveText('—');
    await expect(page.locator('[data-ampacity-note]')).toBeVisible();
    await expect(page.locator('[data-ampacity-note]')).toContainText('310.16');
    await expect(page.locator('[data-notes]')).toContainText('250.122(B)');

    const robots = page.locator('meta[name="robots"]');
    if ((await robots.count()) > 0) await expect(robots).not.toHaveAttribute('content', /noindex/);
    const title = await page.title();
    expect(title.length).toBeLessThanOrEqual(70);
    expect(title.endsWith('| BuildWorkPro')).toBe(true);
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description!.length).toBeLessThanOrEqual(160);
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(blocks.filter((s) => s.includes('"FAQPage"'))).toHaveLength(1);
    expect(blocks.filter((s) => s.includes('"WebApplication"'))).toHaveLength(1);
    const crumbs = blocks.map((b) => JSON.parse(b)).find((d) => d['@type'] === 'BreadcrumbList');
    expect(crumbs.itemListElement.map((c: { name: string }) => c.name)).toEqual([
      'Home',
      'Free Tools',
      'Voltage Drop Calculator',
    ]);
    const faq = blocks.map((b) => JSON.parse(b)).find((d) => d['@type'] === 'FAQPage');
    const answers = JSON.stringify(faq);
    for (const pinned of ['6.32 V', '5.27%', '113.7 V', '11.18 V', '2.93%', '3.03%', '4.23 V'])
      expect(answers).toContain(pinned);
  });

  test('a shared link reproduces the circuit, and edits update the address', async ({ page }) => {
    await openTool(page, `${PATH}?v=120&ph=1&m=cu&s=12&l=100&a=16&p=1&t=3`);
    await expect(out(page, 'drop')).toHaveText('6.32 V');
    await expect(out(page, 'min')).toHaveText('8 AWG');
    await page.locator('#vd-s').selectOption('8');
    await expect(out(page, 'status')).toHaveText('Within 3%');
    await expect(out(page, 'status')).toHaveAttribute('data-status', 'pass');
    await expect(page).toHaveURL(/[?&]s=8(&|$)/);
    await page.locator('#vd-l').fill('200');
    const r = computeVdrop(run({ volts: '120', size: '8', length: 200, amps: 16 }));
    await expect(out(page, 'drop')).toHaveText(`${fmtTrim(r.drop, 2)} V`);
    await expect(page).toHaveURL(/[?&]l=200(&|$)/);
    await page.reload();
    await expect(page.locator('#vd-l')).toHaveValue('200');
  });

  test('custom voltage and three phase', async ({ page }) => {
    await openTool(page);
    await expect(page.locator('#vd-vc')).toBeHidden();
    await page.locator('#vd-v').selectOption('custom');
    await expect(page.locator('#vd-vc')).toBeVisible();
    await page.locator('#vd-vc').fill('600');
    await page.locator('#vd-ph').selectOption('3');
    // The conductor count follows the phase while it is still the default.
    await expect(page.locator('#vd-n')).toHaveValue('3');
    const q = run({ volts: 'custom', customVolts: 600, phase: '3', conductors: 3 });
    const r = computeVdrop(q);
    await expect(out(page, 'drop-note')).toContainText(`${fmtTrim(r.pct, 2)}% of 600 V`);
    await expect(out(page, 'feet')).toHaveText(`${fmt(wireFeet(q))} ft`);
  });

  test('remembers a price per size and prices the wire', async ({ page }) => {
    await openTool(page);
    await expect(page.locator('label[for="vd-price"]')).toHaveText('8 AWG copper, per ft ($)');
    await page.locator('#vd-price').fill('0.85');
    await expect(out(page, 'cost')).toHaveText(money(330 * 0.85));
    // A different size has its own price.
    await page.locator('#vd-w').selectOption('sel');
    await expect(page.locator('label[for="vd-price"]')).toHaveText('10 AWG copper, per ft ($)');
    await expect(page.locator('#vd-price')).toHaveValue('');
    await expect(out(page, 'cost')).toHaveText('—');
    await page.locator('#vd-w').selectOption('rec');
    await page.reload();
    await expect(page.locator('[data-calculator][data-ready="true"]')).toBeVisible();
    await expect(page.locator('#vd-price')).toHaveValue('0.85');
    await expect(out(page, 'cost')).toHaveText(money(330 * 0.85));
  });

  test('adds the wire to an estimate that survives a reload', async ({ page }) => {
    await openTool(page);
    await page.locator('#vd-price').fill('0.85');
    await page.getByRole('button', { name: 'Add to estimate' }).click();
    await expect(page.locator('[data-note]')).toHaveText(
      'Added 330 ft of 8 AWG copper to your estimate below.'
    );
    await page.locator('#vd-a').fill('20');
    await page.getByRole('button', { name: 'Add to estimate' }).click();
    const groups = page.locator('[data-tray-group]');
    await expect(groups).toHaveCount(2);
    await expect(page.locator('[data-tray-count]')).toHaveText('2 lines');
    // 20 A on 10 AWG is still over 3% (3.11%), so the second run is 8 AWG too.
    expect(computeVdrop(run({ amps: 20 })).install).toBe('8');
    await expect(page.locator('[data-tray-total]')).toHaveText(money(2 * r2(330 * 0.85)));
    await expect(page.locator('[data-tray-list]')).toContainText(
      '8 AWG copper wire, 2 conductors × 150 ft, +10% makeup'
    );
    await page.reload();
    await expect(page.locator('[data-tray-group]')).toHaveCount(2);
  });

  test('fits a phone without horizontal page scroll', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openTool(page);
    await page.locator('#vd-v').selectOption('custom');
    await page.getByRole('button', { name: 'Add to estimate' }).click();
    const widths = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }));
    expect(widths.page).toBeLessThanOrEqual(widths.viewport);
  });
});
