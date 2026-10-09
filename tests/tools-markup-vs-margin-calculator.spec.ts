import { test, expect, type Page } from '@playwright/test';
import {
  addedToCost,
  CFMA_2024,
  DEFAULT_INPUT,
  estimateCost,
  fromParams,
  marginFromMarkup,
  marginTable,
  markupFromMargin,
  markupTable,
  overheadRate,
  pct,
  priceForOverhead,
  solve,
  toParams,
} from '../src/lib/calculators/markup';
import { emptyEstimate, ESTIMATE_KEY, withLines } from '../src/lib/calculators/estimate';
import { fmt, money } from '../src/lib/calculators/format';

// /tools/markup-vs-margin-calculator/. Expected numbers come from the same math
// module the page uses, plus literal checks that pin every figure quoted in the
// page's FAQ and the ones the construction markup vs. margin blog post states.

const PATH = '/tools/markup-vs-margin-calculator/';

test.describe('markup and margin math', () => {
  test('converts both ways with the blog post’s numbers', () => {
    // FAQ: 20% markup → 16.67% margin; 25% margin → 33.33% markup.
    expect(pct(marginFromMarkup(20))).toBe('16.67%');
    expect(pct(markupFromMargin(25)!)).toBe('33.33%');
    expect(pct(marginFromMarkup(25))).toBe('20%');
    // FAQ and blog: 30% markup ≈ 23% margin; a 30% margin takes a 42.9% markup.
    expect(pct(marginFromMarkup(30))).toBe('23.08%');
    expect(pct(markupFromMargin(30)!)).toBe('42.86%');
    expect(fmt(markupFromMargin(30)!, 1)).toBe('42.9');
    // Blog list: 15 → 13.0, 25 → 20.0, 33 → 24.8, 50 → 33.3, 100 → 50.0.
    expect([15, 25, 33, 50, 100].map((m) => fmt(marginFromMarkup(m), 1))).toEqual([
      '13.0',
      '20.0',
      '24.8',
      '33.3',
      '50.0',
    ]);
    // Blog intro: $100,000 of cost at a 30% margin bills $142,857.
    expect(Math.round(solve(100000, 'margin', 30).price!)).toBe(142857);
    expect(markupFromMargin(100)).toBeNull();
  });

  test('solves from any one of markup, margin or price', () => {
    const byMarkup = solve(100, 'markup', 20);
    expect(byMarkup.price).toBeCloseTo(120, 10);
    expect(byMarkup.profit).toBeCloseTo(20, 10);
    expect(money(byMarkup.price!)).toBe('$120.00');

    const byMargin = solve(100, 'margin', 25);
    expect(money(byMargin.price!)).toBe('$133.33');
    expect(money(byMargin.profit!)).toBe('$33.33');
    expect(byMargin.markup).toBeCloseTo(33.3333, 4);

    const byPrice = solve(10000, 'price', 12500);
    expect(byPrice.markup).toBeCloseTo(25, 10);
    expect(byPrice.margin).toBeCloseTo(20, 10);
    expect(byPrice.profit).toBe(2500);

    const loss = solve(1000, 'price', 800);
    expect(loss.markup).toBeCloseTo(-20, 10);
    expect(loss.margin).toBeCloseTo(-25, 10);

    // Without a cost: percentages still convert, dollars stay blank.
    const noCost = solve(null, 'markup', 20);
    expect(noCost.margin).toBeCloseTo(16.6667, 4);
    expect(noCost.price).toBeNull();
    expect(solve(null, 'price', 500).error).toMatch(/job cost/);
    expect(solve(100, 'margin', 100).error).toMatch(/under 100%/);
    expect(solve(100, 'markup', null).markup).toBeNull();
  });

  test('prices overhead and net profit on either basis', () => {
    // FAQ: 10% overhead of revenue + 10% net → cost ÷ 0.80, 25% markup, 20% margin.
    const rev = priceForOverhead(10000, 10, 'r', 10);
    expect(rev.factor).toBeCloseTo(1.25, 10);
    expect(pct(rev.markup!)).toBe('25%');
    expect(pct(rev.margin!)).toBe('20%');
    expect(rev.price).toBeCloseTo(12500, 6);
    expect(rev.overheadAmt).toBeCloseTo(1250, 6);
    expect(rev.netAmt).toBeCloseTo(1250, 6);
    // Overhead + net + cost add back up to the price.
    expect(rev.overheadAmt! + rev.netAmt! + 10000).toBeCloseTo(rev.price!, 6);

    // FAQ: 10% overhead of job cost + 10% net → cost × 1.1 ÷ 0.9, 22.22% markup.
    const cost = priceForOverhead(10000, 10, 'c', 10);
    expect(pct(cost.markup!)).toBe('22.22%');
    expect(pct(cost.margin!)).toBe('18.18%');
    expect(cost.overheadAmt).toBeCloseTo(1000, 6);
    expect(cost.netAmt! / cost.price!).toBeCloseTo(0.1, 10);
    // Same as the template's (cost + overhead) ÷ (1 − margin).
    expect(cost.price).toBeCloseTo((10000 + 1000) / 0.9, 6);

    expect(priceForOverhead(100, 60, 'r', 40).error).toMatch(/under 100%/);
    expect(priceForOverhead(100, 60, 'c', 40).error).toBeNull();
    expect(priceForOverhead(100, 0, 'c', 100).error).toMatch(/under 100%/);
  });

  test('“10 and 10” added to cost is a 16.67% margin and 6.67% net', () => {
    const r = addedToCost(10000, 10, 'r', 10);
    expect(r.markup).toBe(20);
    expect(pct(r.margin)).toBe('16.67%');
    expect(pct(r.overheadShare)).toBe('10%');
    expect(pct(r.net)).toBe('6.67%');
    expect(r.price).toBeCloseTo(12000, 6);
    // The price that covers both is 12,500, so 10 and 10 lands 500 (5% of cost) short.
    expect(r.shortBy).toBeCloseTo(500, 6);
    expect(r.shortPctOfCost).toBeCloseTo(5, 10);

    const c = addedToCost(null, 10, 'c', 10);
    expect(pct(c.overheadShare)).toBe('8.33%');
    expect(pct(c.net)).toBe('8.33%');
    expect(c.shortBy).toBeNull();
    expect(c.shortPctOfCost).toBeCloseTo(2.2222, 4);
  });

  test('the CFMA example in the FAQ: 11.8% + 6.9% → 18.7% margin, 23% markup', () => {
    expect(CFMA_2024).toEqual({ sgaPct: 11.8, specialtyNetPct: 6.9 });
    const r = priceForOverhead(null, CFMA_2024.sgaPct, 'r', CFMA_2024.specialtyNetPct);
    expect(pct(r.margin!)).toBe('18.7%');
    expect(pct(r.markup!)).toBe('23%');
  });

  test('the conversion tables are generated, in order, from the formulas', () => {
    const mk = markupTable();
    expect(mk.map((r) => r.markup)).toEqual([
      10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 75, 80, 90, 100,
    ]);
    expect(mk.map((r) => fmt(r.margin, 1))).toEqual([
      '9.1',
      '13.0',
      '16.7',
      '20.0',
      '23.1',
      '25.9',
      '28.6',
      '31.0',
      '33.3',
      '37.5',
      '41.2',
      '42.9',
      '44.4',
      '47.4',
      '50.0',
    ]);
    const mg = marginTable();
    expect(mg.map((r) => [r.margin, fmt(r.markup, 1)])).toEqual([
      [5, '5.3'],
      [10, '11.1'],
      [15, '17.6'],
      [20, '25.0'],
      [25, '33.3'],
      [30, '42.9'],
      [35, '53.8'],
      [40, '66.7'],
      [45, '81.8'],
      [50, '100.0'],
    ]);
  });

  test('overhead rate from the books, and the estimate total as cost', () => {
    expect(overheadRate(120000, 1000000)).toBeCloseTo(12, 10);
    expect(overheadRate(120000, 0)).toBeNull();
    expect(overheadRate(null, 1000000)).toBeNull();

    expect(estimateCost(emptyEstimate())).toBeNull();
    const line = { tool: 't', desc: 'Board', qty: 10, unit: 'sheets', price: 21.5 };
    const unpricedOnly = withLines(emptyEstimate(), 'Room', [{ ...line, price: null }]);
    expect(estimateCost(unpricedOnly)).toBeNull();
    const e = withLines(unpricedOnly, 'Room', [line]);
    expect(estimateCost(e)).toEqual({ total: 215, priced: 1, unpriced: 1 });
  });

  test('query parameters round-trip, are clamped, and keep no annual figures', () => {
    expect(fromParams({})).toEqual(DEFAULT_INPUT);
    const i = {
      ...DEFAULT_INPUT,
      cost: 18450.5,
      by: 'margin' as const,
      value: 22.5,
      basis: 'c' as const,
    };
    expect(fromParams(toParams(i))).toEqual(i);
    expect(Object.keys(toParams(i)).sort()).toEqual(['by', 'c', 'np', 'ob', 'oh', 'v']);
    expect(toParams(DEFAULT_INPUT)).not.toHaveProperty('c');

    const bad = fromParams({ c: '-5', by: 'gold', v: '99999', oh: 'abc', ob: 'x', np: '500' });
    expect(bad.cost).toBeNull();
    expect(bad.by).toBe('markup');
    expect(bad.value).toBe(1000);
    expect(bad.overhead).toBe(DEFAULT_INPUT.overhead);
    expect(bad.basis).toBe(DEFAULT_INPUT.basis);
    expect(bad.profit).toBe(100);
    // A cleared field stays cleared rather than snapping back to the example.
    expect(fromParams({ by: 'margin', v: '' }).value).toBeNull();
  });
});

async function openTool(page: Page, path = PATH) {
  await page.goto(path);
  await expect(page.locator('[data-calculator][data-ready="true"]')).toBeVisible({
    timeout: 30_000,
  });
}
const out = (page: Page, key: string) => page.locator(`[data-out="${key}"]`).first();

test.describe(PATH, () => {
  test('renders the example, is indexable and carries its structured data', async ({ page }) => {
    await openTool(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Markup vs Margin Calculator');
    await expect(page.locator('#mm-markup')).toHaveValue('20');
    await expect(page.locator('#mm-margin')).toHaveValue('16.67');
    await expect(page.locator('#mm-cost')).toHaveValue('');
    await expect(page.locator('#mm-price')).toHaveValue('');
    await expect(out(page, 'solve-margin')).toHaveText('16.67%');
    await expect(out(page, 'solve-price')).toHaveText('—');
    await expect(out(page, 'oh-markup')).toHaveText('25%');
    await expect(out(page, 'oh-margin')).toHaveText('20%');
    await expect(out(page, 'add-margin')).toHaveText('16.67%');
    await expect(out(page, 'add-net')).toHaveText('6.67%');
    await expect(out(page, 'add-short')).toHaveText('5% of cost');
    // No estimate tray on this page, and no estimate box without priced lines.
    await expect(page.locator('[data-estimate-tray]')).toHaveCount(0);
    await expect(page.locator('[data-estimate-box]')).toBeHidden();
    // The tables come from the module.
    await expect(page.locator('[data-table="markup"] tbody tr')).toHaveCount(markupTable().length);
    await expect(page.locator('[data-table="margin"] tbody tr').nth(4)).toHaveText(/25%\s*33\.3%/);
    // It links to the blog post it agrees with.
    await expect(
      page.locator('main a[href="/blog/construction-markup-vs-margin/"]').first()
    ).toBeAttached();
    // The FAQ quotes the figures the math tests above pin.
    const faq = (q: string) =>
      page.locator('details', { has: page.locator('summary', { hasText: q }) });
    await expect(faq('20% markup as a margin')).toContainText(
      '16.67%. Margin = markup ÷ (1 + markup)'
    );
    await expect(faq('25% margin')).toContainText(
      '33.33%. Markup = margin ÷ (1 − margin), so 0.25 ÷ 0.75 = 0.3333. On $100 of cost that is a $133.33 price with $33.33 of gross profit'
    );
    await expect(faq('difference between markup and margin')).toContainText(
      'a 30% markup is a 23.08% margin, and a 30% margin takes a 42.86% markup'
    );
    await expect(faq('include overhead')).toContainText(
      'cost ÷ 0.80, a 25% markup and a 20% gross margin'
    );
    await expect(faq('include overhead')).toContainText('At 10% and 10% that is a 22.22% markup');
    await expect(faq('10 and 10')).toContainText(
      'That is a 20% markup, and a 20% markup is a 16.67% margin'
    );
    await expect(faq('10 and 10')).toContainText('leaving 6.67% net profit instead of 10%');
    await expect(faq('10 and 10')).toContainText('only 8.33% of the price');
    await expect(faq('profit margin do contractors use')).toContainText(
      'would need a gross margin of 18.7%, which is a markup of 23%'
    );
    await expect(page.locator('main details')).toHaveCount(7); // 6 FAQs + the overhead helper

    const robots = page.locator('meta[name="robots"]');
    if ((await robots.count()) > 0) await expect(robots).not.toHaveAttribute('content', /noindex/);
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(blocks.filter((s) => s.includes('"FAQPage"'))).toHaveLength(1);
    expect(blocks.filter((s) => s.includes('"WebApplication"'))).toHaveLength(1);
    const crumbs = blocks.map((b) => JSON.parse(b)).find((d) => d['@type'] === 'BreadcrumbList');
    const names = crumbs.itemListElement.map((c: { name: string }) => c.name);
    expect(names.slice(0, 2)).toEqual(['Home', 'Free Tools']);
    expect(names[2]).toMatch(/^markup vs margin calculator$/i);
  });

  test('the three linked fields solve from whichever one was typed', async ({ page }) => {
    await openTool(page);
    await page.locator('#mm-cost').fill('10000');
    await expect(page.locator('#mm-price')).toHaveValue('12,000.00');
    await expect(out(page, 'solve-profit')).toHaveText('$2,000.00');

    await page.locator('#mm-margin').fill('25');
    await expect(page.locator('#mm-markup')).toHaveValue('33.33');
    await expect(page.locator('#mm-price')).toHaveValue('13,333.33');
    await expect(page.locator('#mm-margin')).not.toHaveAttribute('data-computed', '');
    await expect(page.locator('#mm-markup')).toHaveAttribute('data-computed', '');

    await page.locator('#mm-price').fill('12500');
    await expect(page.locator('#mm-markup')).toHaveValue('25');
    await expect(page.locator('#mm-margin')).toHaveValue('20');
    await expect(out(page, 'solve-note')).toHaveText(
      'Selling at $12,500.00 on $10,000.00 of cost is a markup of 25% and a margin of 20%.'
    );

    // A new cost keeps the typed price and re-solves the percentages.
    await page.locator('#mm-cost').fill('11000');
    await expect(page.locator('#mm-price')).toHaveValue('12500');
    await expect(out(page, 'solve-margin')).toHaveText(pct((1500 / 12500) * 100));

    await page.locator('#mm-margin').fill('100');
    await expect(out(page, 'solve-note')).toHaveText('A margin has to be under 100%.');
    await expect(page.locator('#mm-price')).toHaveValue('');
  });

  test('a shared link reproduces the result, and edits update the address', async ({ page }) => {
    await openTool(page, `${PATH}?c=8000&by=margin&v=30&oh=12&ob=c&np=8`);
    await expect(page.locator('#mm-margin')).toHaveValue('30');
    await expect(page.locator('#mm-markup')).toHaveValue('42.86');
    await expect(page.locator('#mm-ob')).toHaveValue('c');
    const s = solve(8000, 'margin', 30);
    await expect(out(page, 'solve-price')).toHaveText(money(s.price!));
    const o = priceForOverhead(8000, 12, 'c', 8);
    await expect(out(page, 'oh-price')).toHaveText(money(o.price!));
    await expect(out(page, 'oh-markup')).toHaveText(pct(o.markup!));

    await page.locator('#mm-np').fill('10');
    await expect(page).toHaveURL(/[?&]np=10(&|$)/);
    await page.locator('#mm-markup').fill('50');
    await expect(page).toHaveURL(/[?&]by=markup(&|$)/);
    await expect(page).toHaveURL(/[?&]v=50(&|$)/);
    await page.reload();
    await expect(page.locator('[data-calculator][data-ready="true"]')).toBeVisible();
    await expect(page.locator('#mm-markup')).toHaveValue('50');
    await expect(page.locator('#mm-margin')).toHaveValue('33.33');
    await expect(page.locator('#mm-np')).toHaveValue('10');

    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(page.locator('#mm-cost')).toHaveValue('');
    await expect(page.locator('#mm-markup')).toHaveValue('20');
    await expect(page).not.toHaveURL(/[?&]c=/);
  });

  test('works out the overhead rate from the books and keeps it out of the URL', async ({
    page,
  }) => {
    await openTool(page);
    await page.locator('#mm-cost').fill('10000');
    await page.getByText('Work out your overhead rate from last year').click();
    await expect(page.getByRole('button', { name: 'Use this rate' })).toBeDisabled();
    await page.locator('#mm-a-oh').fill('$150,000');
    await page.locator('#mm-a-base').fill('1,200,000');
    await expect(out(page, 'rate')).toHaveText('Overhead is 12.5% of revenue.');
    await page.getByRole('button', { name: 'Use 12.5%' }).click();
    await expect(page.locator('#mm-oh')).toHaveValue('12.5');
    const o = priceForOverhead(10000, 12.5, 'r', 10);
    await expect(out(page, 'oh-price')).toHaveText(money(o.price!));
    await expect(page).toHaveURL(/[?&]oh=12\.5(&|$)/);
    expect(page.url()).not.toContain('150000');
    expect(page.url()).not.toContain('1200000');

    // Remembered in this browser, per basis.
    await page.reload();
    await expect(page.locator('[data-calculator][data-ready="true"]')).toBeVisible();
    await expect(page.locator('#mm-a-oh')).toHaveValue('150000');
    await expect(page.locator('#mm-a-base')).toHaveValue('1200000');
    await page.locator('#mm-ob').selectOption('c');
    await expect(page.locator('label[for="mm-a-base"]')).toHaveText('Annual direct job cost ($)');
    await expect(page.locator('#mm-a-base')).toHaveValue('');
  });

  test('uses the estimate total as cost without changing the estimate', async ({ page }) => {
    const line = { tool: 'drywall-calculator', desc: 'Board', qty: 40, unit: 'sheets' };
    const estimate = withLines(emptyEstimate(), 'Drywall · room', [
      { ...line, price: 25 },
      { ...line, desc: 'Labor', price: null },
    ]);
    const stored = JSON.stringify(estimate);
    await page.addInitScript(
      ([key, value]) => {
        if (!sessionStorage.getItem('seeded')) {
          localStorage.setItem(key, value);
          sessionStorage.setItem('seeded', '1');
        }
      },
      [ESTIMATE_KEY, stored]
    );
    await openTool(page, `${PATH}?by=margin&v=25`);
    const box = page.locator('[data-estimate-box]');
    await expect(box).toBeVisible();
    await expect(out(page, 'est-total')).toHaveText('$1,000.00');
    await expect(out(page, 'est-note')).toHaveText('1 priced line, 1 without a price left out');
    await page.getByRole('button', { name: 'Use my estimate total as cost' }).click();
    await expect(page.locator('#mm-cost')).toHaveValue('1000');
    await expect(out(page, 'solve-price')).toHaveText('$1,333.33');
    expect(await page.evaluate((k) => localStorage.getItem(k), ESTIMATE_KEY)).toBe(stored);
  });

  test('fits a phone without horizontal page scroll', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openTool(page, `${PATH}?c=1250000&by=price&v=1562500`);
    await page.getByText('Work out your overhead rate from last year').click();
    const widths = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }));
    expect(widths.page).toBeLessThanOrEqual(widths.viewport);
  });
});
