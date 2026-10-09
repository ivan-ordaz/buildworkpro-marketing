import { test, expect, type Page } from '@playwright/test';
import {
  computeBurden,
  DEFAULT_INPUT,
  estimateBlocker,
  estimateLines,
  EXAMPLE_INPUT,
  EXAMPLE_RATES,
  fromParams,
  FULL_TIME_HOURS,
  FUTA_NET_RATE,
  FUTA_WAGE_BASE,
  groupLabel,
  markupFor,
  MEDICARE_RATE,
  priceAtMargin,
  SS_RATE,
  SS_WAGE_BASE,
  TAX_YEAR,
  toParams,
  urlParams,
  type BurdenInput,
} from '../src/lib/calculators/burden';
import { round2 } from '../src/lib/calculators/estimate';
import { money } from '../src/lib/calculators/format';

// /tools/labor-burden-calculator/. Expected numbers come from the same math
// module the page uses, plus literal checks that pin the statutory figures and
// every number the page's FAQ quotes.

const PATH = '/tools/labor-burden-calculator/';
const EXAMPLE_QS = '?w=30&h=2080&hol=48&pto=80&trn=16&shop=104';
const employee = (over: Partial<BurdenInput>): BurdenInput => ({ ...DEFAULT_INPUT, ...over });

test.describe('labor burden math', () => {
  test('federal figures are the 2026 IRS and SSA numbers', () => {
    expect(TAX_YEAR).toBe(2026);
    expect(SS_RATE).toBe(6.2);
    expect(SS_WAGE_BASE).toBe(184_500);
    expect(MEDICARE_RATE).toBe(1.45);
    expect(FUTA_NET_RATE).toBe(0.6);
    expect(FUTA_WAGE_BASE).toBe(7_000);
    expect(FULL_TIME_HOURS).toBe(2_080);
  });

  test('federal taxes on a full-time $30 an hour employee match the FAQ', () => {
    const r = computeBurden(employee({ wage: 30 }), {});
    expect(r.wages).toBe(62_400);
    const amount = (id: string) => r.items.find((i) => i.id === id)!.amount;
    expect(amount('ss')).toBe(3_868.8);
    expect(amount('medicare')).toBe(904.8);
    expect(amount('futa')).toBe(42);
    expect(r.federal).toBe(4_815.6);
    expect(r.burden).toBe(4_815.6);
    expect(r.burdenPct.toFixed(2)).toBe('7.72');
    expect(r.missing).toEqual(['suta', 'wc', 'gl', 'health', 'retire', 'other']);
  });

  test('the worked example matches every number in the FAQ', () => {
    expect(EXAMPLE_INPUT).toMatchObject({
      wage: 30,
      hours: 2_080,
      holiday: 48,
      pto: 80,
      training: 16,
      shop: 104,
    });
    expect(EXAMPLE_RATES).toEqual({
      sutaRate: 3,
      sutaBase: 10_000,
      wc: 8,
      gl: 10,
      health: 600,
      retire: 3,
      other: 0,
      margin: 25,
    });
    const r = computeBurden(EXAMPLE_INPUT, EXAMPLE_RATES);
    expect(r.items.map((i) => i.amount)).toEqual([
      3_868.8, 904.8, 42, 300, 4_992, 624, 7_200, 1_872, 0,
    ]);
    expect(r.missing).toEqual([]);
    expect(r.burden).toBe(19_803.6);
    expect(r.burdenPct.toFixed(1)).toBe('31.7');
    expect(r.annualCost).toBe(82_203.6);
    expect(r.nonBillable).toBe(248);
    expect(r.billableHours).toBe(1_832);
    expect(r.perPaidHour).toBe(39.52);
    expect(r.perBillableHour).toBe(44.87);
    expect(r.billingRate).toBe(59.83);
    expect(r.markupPct!.toFixed(1)).toBe('33.3');
    // Paid-hour vs billable-hour gap, and the markup mistake, as quoted.
    expect(round2(r.perBillableHour! - r.perPaidHour!)).toBe(5.35);
    const markedUp = round2(r.perBillableHour! * 1.25);
    expect(markedUp).toBe(56.09);
    expect((((markedUp - 44.87) / markedUp) * 100).toFixed(1)).toBe('20.0');
  });

  test('wage bases cap Social Security, FUTA and SUTA', () => {
    const high = computeBurden(employee({ wage: 100 }), { sutaRate: 2.7, sutaBase: 9_000 });
    expect(high.wages).toBe(208_000);
    const amount = (id: string) => high.items.find((i) => i.id === id)!.amount;
    expect(amount('ss')).toBe(11_439); // 6.2% of $184,500
    expect(amount('medicare')).toBe(3_016); // 1.45% of all $208,000
    expect(amount('futa')).toBe(42);
    expect(amount('suta')).toBe(243);
    expect(high.items[0].note).toBe('6.2% of the first $184,500 (2026 wage base)');
    expect(computeBurden(employee({ wage: 30 }), {}).items[0].note).toBe(
      '6.2% of $62,400, up to the 2026 wage base of $184,500'
    );

    const part = computeBurden(employee({ wage: 20, hours: 300 }), { sutaRate: 2.7 });
    expect(part.wages).toBe(6_000);
    expect(part.items.find((i) => i.id === 'futa')!.amount).toBe(36);
    // No state wage base entered: the rate goes on all wages, and the note says so.
    const suta = part.items.find((i) => i.id === 'suta')!;
    expect(suta.amount).toBe(162);
    expect(suta.note).toContain('Enter your state wage base');
  });

  test('a credit reduction state enters its own net FUTA rate', () => {
    const r = computeBurden(employee({ wage: 30 }), { futa: 1.8 });
    expect(r.items.find((i) => i.id === 'futa')!.amount).toBe(126);
  });

  test('blank rates are not counted, but an entered zero is', () => {
    const blank = computeBurden(employee({ wage: 25 }), {});
    expect(blank.items.find((i) => i.id === 'health')!.amount).toBeNull();
    const zero = computeBurden(employee({ wage: 25 }), { health: 0, other: 0 });
    expect(zero.items.find((i) => i.id === 'health')!.amount).toBe(0);
    expect(zero.missing).not.toContain('health');
    expect(zero.burden).toBe(blank.burden);
  });

  test('no wage, or no billable hours, gives no hourly cost', () => {
    const none = computeBurden(DEFAULT_INPUT, EXAMPLE_RATES);
    expect(none.wages).toBe(0);
    expect(none.perPaidHour).toBeNull();
    expect(none.billingRate).toBeNull();
    const allShop = computeBurden(employee({ wage: 30, shop: 2_080 }), EXAMPLE_RATES);
    expect(allShop.billableHours).toBe(0);
    expect(allShop.perBillableHour).toBeNull();
    expect(allShop.perPaidHour).not.toBeNull();
  });

  test('margin math matches price = cost ÷ (1 − margin)', () => {
    expect(priceAtMargin(100, 20)).toBe(125);
    expect(priceAtMargin(100, 0)).toBe(100);
    expect(priceAtMargin(100, 100)).toBeNull();
    expect(markupFor(20)).toBeCloseTo(25, 10);
    expect(markupFor(100)).toBeNull();
  });

  test('the estimate line uses the chosen rate, and says why when it cannot', () => {
    const input = { ...EXAMPLE_INPUT, jobHours: 40 };
    const r = computeBurden(input, EXAMPLE_RATES);
    expect(estimateLines(input, r, EXAMPLE_RATES)).toEqual([
      {
        tool: 'labor-burden-calculator',
        desc: 'Labor, billed at 25% margin on burdened cost',
        qty: 40,
        unit: 'hrs',
        price: 59.83,
      },
    ]);
    const atCost = estimateLines({ ...input, basis: 'cost' }, r, EXAMPLE_RATES);
    expect(atCost[0]).toMatchObject({ desc: 'Labor at fully burdened cost', price: 44.87 });
    expect(groupLabel(input, r)).toBe('Labor · $30.00/hr base wage, 31.7% burden');

    const noMargin = { ...EXAMPLE_RATES, margin: undefined };
    const r2 = computeBurden(input, noMargin);
    expect(estimateLines(input, r2, noMargin)).toEqual([]);
    expect(estimateBlocker(input, r2, noMargin)).toBe(
      'Enter a target margin, or price the hours at burdened cost.'
    );
    expect(estimateBlocker(EXAMPLE_INPUT, r, EXAMPLE_RATES)).toBe(
      'Enter the hours for this job first.'
    );
    const empty = computeBurden(DEFAULT_INPUT, {});
    expect(estimateBlocker(DEFAULT_INPUT, empty, {})).toBe('Enter a base wage first.');
  });

  test('query parameters are clamped, blanks stay blank and rates stay out', () => {
    const i = fromParams({
      w: '-5',
      h: '0',
      hol: '99999',
      pto: 'abc',
      trn: '8',
      shop: '',
      jh: '0',
      jb: 'gold',
    });
    expect(i).toEqual({
      wage: null,
      hours: 2_080,
      holiday: 8_760,
      pto: 0,
      training: 8,
      shop: 0,
      jobHours: null,
      basis: 'bill',
    });
    expect(fromParams({ w: '5000' }).wage).toBe(1_000);
    expect(urlParams(DEFAULT_INPUT)).toEqual({
      h: '2080',
      hol: '0',
      pto: '0',
      trn: '0',
      shop: '0',
      jb: 'bill',
    });
    expect(fromParams(toParams(EXAMPLE_INPUT))).toEqual(EXAMPLE_INPUT);
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

async function enterExampleRates(page: Page) {
  await page.locator('#lb-r-sutaRate').fill('3');
  await page.locator('#lb-r-sutaBase').fill('10000');
  await page.locator('#lb-r-wc').fill('8');
  await page.locator('#lb-r-gl').fill('10');
  await page.locator('#lb-r-health').fill('600');
  await page.locator('#lb-r-retire').fill('3');
  await page.locator('#lb-r-other').fill('0');
  await page.locator('#lb-r-margin').fill('25');
}

test.describe(PATH, () => {
  test('renders empty until a wage is entered, is indexable and carries its structured data', async ({
    page,
  }) => {
    await openTool(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Labor Burden Calculator');
    await expect(page.locator('#lb-w')).toHaveValue('');
    await expect(page.locator('#lb-h')).toHaveValue('2080');
    await expect(out(page, 'per-billable')).toHaveText('—');
    await expect(out(page, 'per-billable-note')).toHaveText('Enter a base wage to start.');
    await expect(out(page, 'item-ss-note')).toHaveText(
      '6.2% of wages, up to the 2026 wage base of $184,500'
    );
    await expect(out(page, 'item-medicare-note')).toHaveText('1.45% of wages, no wage base');
    // No invented rates: everything past the federal taxes starts blank.
    for (const id of ['sutaRate', 'sutaBase', 'wc', 'gl', 'health', 'retire', 'other', 'margin'])
      await expect(page.locator(`#lb-r-${id}`)).toHaveValue('');

    await page.locator('#lb-w').fill('30');
    const r = computeBurden(employee({ wage: 30 }), {});
    await expect(out(page, 'wages')).toHaveText(money(r.wages));
    await expect(out(page, 'burden-total')).toHaveText(money(r.federal));
    await expect(out(page, 'per-paid')).toHaveText(money(r.perPaidHour!));
    await expect(out(page, 'burden-hint')).toContainText('Not counted yet: State unemployment');
    await expect(out(page, 'billing-note')).toHaveText(
      'Enter a target margin to get the rate to bill.'
    );

    const robots = page.locator('meta[name="robots"]');
    if ((await robots.count()) > 0) await expect(robots).not.toHaveAttribute('content', /noindex/);
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(blocks.filter((s) => s.includes('"FAQPage"'))).toHaveLength(1);
    expect(blocks.filter((s) => s.includes('"WebApplication"'))).toHaveLength(1);
    const crumbs = blocks.map((b) => JSON.parse(b)).find((d) => d['@type'] === 'BreadcrumbList');
    expect(crumbs.itemListElement.map((c: { name: string }) => c.name)).toEqual([
      'Home',
      'Free Tools',
      'Labor Burden Calculator',
    ]);
  });

  test('a shared link reproduces the wage and hours, and edits update the address', async ({
    page,
  }) => {
    await openTool(page, `${PATH}${EXAMPLE_QS}`);
    const r = computeBurden(EXAMPLE_INPUT, {});
    await expect(out(page, 'wages')).toHaveText('$62,400.00');
    await expect(out(page, 'per-billable')).toHaveText(money(r.perBillableHour!));
    await expect(out(page, 'per-billable-note')).toHaveText(
      '1,832 billable hours a year, 248 paid but not billed'
    );
    await page.locator('#lb-w').fill('35');
    const r35 = computeBurden({ ...EXAMPLE_INPUT, wage: 35 }, {});
    await expect(out(page, 'per-paid')).toHaveText(money(r35.perPaidHour!));
    await expect(page).toHaveURL(/[?&]w=35(&|$)/);
    await page.reload();
    await expect(page.locator('#lb-w')).toHaveValue('35');
    await expect(page.locator('#lb-shop')).toHaveValue('104');
  });

  test('remembers the contractor’s rates, keeps them out of the link, and prices the hour', async ({
    page,
  }) => {
    await openTool(page, `${PATH}${EXAMPLE_QS}`);
    await enterExampleRates(page);
    await expect(out(page, 'per-billable')).toHaveText('$44.87');
    await expect(out(page, 'per-paid')).toHaveText('$39.52');
    await expect(out(page, 'burden-pct')).toHaveText('31.7%');
    await expect(out(page, 'burden-total')).toHaveText('$19,803.60');
    await expect(out(page, 'annual-cost')).toHaveText('$82,203.60');
    await expect(out(page, 'billing')).toHaveText('$59.83');
    await expect(out(page, 'billing-note')).toHaveText(
      '25% margin on $44.87, a 33.3% markup on cost'
    );
    await expect(out(page, 'burden-hint')).toHaveText('Every burden item is counted.');

    await page.locator('#lb-w').fill('30');
    expect(page.url()).not.toMatch(/wc=|margin=|health=/);
    await page.reload();
    await expect(page.locator('[data-calculator][data-ready="true"]')).toBeVisible();
    await expect(page.locator('#lb-r-wc')).toHaveValue('8');
    await expect(page.locator('#lb-r-margin')).toHaveValue('25');
    await expect(out(page, 'billing')).toHaveText('$59.83');
  });

  test('adds the job’s labor hours to the estimate at either rate', async ({ page }) => {
    await openTool(page, `${PATH}${EXAMPLE_QS}`);
    await enterExampleRates(page);
    const add = page.getByRole('button', { name: 'Add to estimate' });
    await add.click();
    await expect(page.locator('[data-note]')).toHaveText('Enter the hours for this job first.');
    await expect(page.locator('[data-tray-empty]')).toBeVisible();

    await page.locator('#lb-jh').fill('40');
    await expect(out(page, 'line-preview')).toHaveText('40 hrs × $59.83 = $2,393.20');
    await add.click();
    await expect(page.locator('[data-tray-group]')).toHaveCount(1);
    await expect(page.locator('[data-tray-group]').first()).toContainText(
      'Labor · $30.00/hr base wage, 31.7% burden'
    );
    await expect(page.locator('[data-tray-total]')).toHaveText('$2,393.20');

    await page.locator('#lb-jb').selectOption('cost');
    await expect(out(page, 'line-preview')).toHaveText('40 hrs × $44.87 = $1,794.80');
    await add.click();
    await expect(page.locator('[data-tray-group]')).toHaveCount(2);
    await expect(page.locator('[data-tray-total]')).toHaveText('$4,188.00');
    await page.reload();
    await expect(page.locator('[data-tray-group]')).toHaveCount(2);
  });

  test('start over clears the wage and hours but keeps the saved rates', async ({ page }) => {
    await openTool(page, `${PATH}${EXAMPLE_QS}`);
    await page.locator('#lb-r-wc').fill('8');
    await page.getByRole('button', { name: 'Start over' }).click();
    await expect(page.locator('#lb-w')).toHaveValue('');
    await expect(page.locator('#lb-shop')).toHaveValue('0');
    await expect(page.locator('#lb-r-wc')).toHaveValue('8');
    await expect(out(page, 'per-billable')).toHaveText('—');
  });

  test('fits a phone without horizontal page scroll', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openTool(page, `${PATH}${EXAMPLE_QS}`);
    await enterExampleRates(page);
    await page.locator('#lb-jh').fill('40');
    await page.getByRole('button', { name: 'Add to estimate' }).click();
    await expect(page.locator('[data-tray-group]')).toHaveCount(1);
    const widths = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }));
    expect(widths.page).toBeLessThanOrEqual(widths.viewport);
  });
});
