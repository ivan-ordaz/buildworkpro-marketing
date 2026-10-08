import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import {
  computeFence,
  concretePerPost,
  DEFAULT_INPUT,
  estimateLines,
  fromParams,
  groupLabel,
  picketsFor,
  POSTS,
  postsFor,
  postStockFt,
  priceFence,
  typicalRails,
  type FenceInput,
} from '../src/lib/calculators/fence';
import { fmt, money } from '../src/lib/calculators/format';

// /tools/fence-calculator/. Expected numbers come from the same math module the
// page uses, plus literal checks that pin every figure quoted in the page's FAQ
// and agree with the fence estimate template (/templates/fence-estimate/).

const PATH = '/tools/fence-calculator/';
const run = (over: Partial<FenceInput>): FenceInput => ({ ...DEFAULT_INPUT, ...over });

test.describe('fence math', () => {
  test('the example run: 120 ft, one 4 ft gate, 6 ft privacy on 8 ft spacing', () => {
    const r = computeFence(DEFAULT_INPUT);
    expect(r.fenced).toBe(116);
    expect(r.sections).toBe(15);
    expect(r.lastSection).toBe(4);
    expect(r.posts).toBe(17);
    expect(r.postLengthFt).toBe(8);
    expect([r.railsPerSection, r.railFt, r.rails]).toEqual([3, 8, 45]);
    expect([r.picketsNet, r.pickets]).toEqual([254, 280]);
    expect(r.bags).toBe(27);
    expect(groupLabel(DEFAULT_INPUT)).toBe('Fence · 120 ft run, 6 ft privacy');
    expect(groupLabel(run({ height: '4', gap: 2 }))).toBe('Fence · 120 ft run, 4 ft spaced picket');
  });

  test('matches the Outdoor Essentials worked example (120 ft, 8 ft spacing, one gate)', () => {
    expect(postsFor(120, 8, 1)).toBe(17);
    expect(picketsFor(120, 5.5, 0)).toBe(262);
    expect(picketsFor(120, 5.5, 2)).toBe(192);
  });

  test('FAQ: pickets per 8 ft section', () => {
    expect(picketsFor(8, 5.5, 0)).toBe(18);
    expect(picketsFor(8, 5.5, 2)).toBe(13);
    expect(computeFence(run({ run: 8, gates: 0 })).pickets).toBe(20);
    expect(computeFence(run({ run: 8, gates: 0, gap: 2 })).pickets).toBe(15);
  });

  test('FAQ: posts for a 100 ft fence, with and without a gate', () => {
    const plain = computeFence(run({ run: 100, gates: 0 }));
    expect([plain.sections, plain.posts]).toEqual([13, 14]);
    const gate = computeFence(run({ run: 100, gates: 1, gateWidth: 4 }));
    expect([gate.fenced, gate.sections, gate.posts]).toEqual([96, 12, 14]);
  });

  test('FAQ: concrete per post agrees with the fence estimate template table', () => {
    const four = POSTS['4x4'].actualIn;
    const c24 = concretePerPost(10, 24, four);
    expect(fmt(c24, 2)).toBe('0.92');
    expect(fmt(c24 / 0.6, 1)).toBe('1.5');
    expect(fmt(c24 / 0.45, 1)).toBe('2.0');
    const c30 = concretePerPost(10, 30, four);
    expect(fmt(c30, 2)).toBe('1.15');
    expect(fmt(c30 / 0.6, 1)).toBe('1.9');
    // Remaining rows of the template's table.
    expect(fmt(concretePerPost(8, 24, four), 2)).toBe('0.53');
    expect(fmt(concretePerPost(10, 36, four), 2)).toBe('1.38');
    expect(fmt(concretePerPost(12, 36, four), 2)).toBe('2.10');
    const six = concretePerPost(12, 36, POSTS['6x6'].actualIn);
    expect(fmt(six, 2)).toBe('1.73');
    expect(fmt(six / 0.6, 1)).toBe('2.9');
  });

  test('FAQ: 6 ft vs 8 ft spacing on a 100 ft run', () => {
    const at8 = computeFence(run({ run: 100, gates: 0 }));
    const at6 = computeFence(run({ run: 100, gates: 0, spacing: '6' }));
    expect([at8.posts, at8.bags, at8.rails, at8.railFt]).toEqual([14, 22, 39, 8]);
    expect([at6.sections, at6.posts, at6.bags, at6.rails, at6.railFt]).toEqual([
      17, 18, 28, 26, 12,
    ]);
  });

  test('FAQ: post depth sets the post length', () => {
    expect(postStockFt(6 + 24 / 12)).toBe(8);
    expect(postStockFt(6 + 30 / 12)).toBe(10);
    expect(postStockFt(4 + 24 / 12)).toBe(6);
    expect(postStockFt(8 + 36 / 12)).toBe(12);
    expect(computeFence(run({ holeDepth: 30 })).postLengthFt).toBe(10);
  });

  test('FAQ: privacy vs spaced pickets on the example run', () => {
    expect(computeFence(DEFAULT_INPUT).pickets).toBe(280);
    expect(computeFence(run({ gap: 2 })).pickets).toBe(205);
  });

  test('typical rails by height, and an explicit count overrides it', () => {
    expect([4, 5, 6, 8].map(typicalRails)).toEqual([2, 3, 3, 4]);
    expect(computeFence(run({ height: '8' })).rails).toBe(15 * 4);
    expect(computeFence(run({ height: '8', rails: '3' })).rails).toBe(15 * 3);
  });

  test('gates wider than the run and an empty run stay sane', () => {
    const allGate = computeFence(run({ run: 10, gates: 1, gateWidth: 12 }));
    expect([allGate.fenced, allGate.sections, allGate.posts]).toEqual([0, 0, 2]);
    expect([allGate.rails, allGate.pickets]).toEqual([0, 0]);
    const empty = computeFence(run({ run: 0 }));
    expect([empty.posts, empty.bags, empty.gates, empty.postLengthFt]).toEqual([0, 0, 0, 0]);
    expect(estimateLines(run({ run: 0 }), empty, { labor: 10 })).toHaveLength(0);
    expect(concretePerPost(3, 24, 3.5)).toBe(0);
  });

  test('prices only what the contractor priced', () => {
    const r = computeFence(DEFAULT_INPUT);
    expect(priceFence(DEFAULT_INPUT, r, {}).total).toBeNull();
    const partial = priceFence(DEFAULT_INPUT, r, { picket: 3 });
    expect(partial.material).toBe(r.pickets * 3);
    expect(partial.complete).toBe(false);
    const full = priceFence(DEFAULT_INPUT, r, {
      post: 18,
      rail: 6,
      picket: 3,
      bag: 7,
      gate: 250,
      labor: 12,
    });
    expect(full.complete).toBe(true);
    expect(full.material).toBe(17 * 18 + 45 * 6 + 280 * 3 + 27 * 7);
    expect(full.gates).toBe(250);
    expect(full.labor).toBe(116 * 12);
    expect(full.total).toBe(full.material! + 250 + 116 * 12);
    expect(full.perFoot).toBe(Math.round((full.total! / 120) * 100) / 100);
  });

  test('estimate lines carry quantities and only the prices given', () => {
    const r = computeFence(DEFAULT_INPUT);
    const lines = estimateLines(DEFAULT_INPUT, r, { labor: 12 });
    expect(lines.map((l) => [l.desc, l.qty, l.unit])).toEqual([
      ['4×4 posts, 8 ft', 17, 'ea'],
      ['2×4 rails, 8 ft', 45, 'ea'],
      ['Pickets, 5.5 in × 6 ft', 280, 'ea'],
      ['Concrete mix, 80 lb bags', 27, 'bags'],
      ['Gate, 4 ft (complete or kit)', 1, 'ea'],
      ['Labor: build 6 ft fence', 116, 'LF'],
    ]);
    expect(lines.filter((l) => l.price != null)).toHaveLength(1);
  });

  test('query parameters are clamped and bad values fall back to defaults', () => {
    const i = fromParams({
      len: '99999',
      h: '7',
      sp: '10',
      g: '-1',
      gw: '50',
      pw: '0',
      gap: '30',
      r: '9',
      post: '8x8',
      hd: 'abc',
      dp: '500',
      bag: '90',
      wst: '90',
    });
    expect(i.run).toBe(2000);
    expect(i.height).toBe(DEFAULT_INPUT.height);
    expect(i.spacing).toBe(DEFAULT_INPUT.spacing);
    expect(i.gates).toBe(DEFAULT_INPUT.gates);
    expect(i.gateWidth).toBe(20);
    expect(i.picketWidth).toBe(DEFAULT_INPUT.picketWidth);
    expect(i.gap).toBe(12);
    expect(i.rails).toBe('auto');
    expect(i.post).toBe('4x4');
    expect(i.holeDia).toBe(DEFAULT_INPUT.holeDia);
    expect(i.holeDepth).toBe(72);
    expect(i.bag).toBe('80');
    expect(i.waste).toBe(40);
    expect(fromParams({ pw: '0.5' }).picketWidth).toBe(1);
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
  test('renders the example run, is indexable and carries its structured data', async ({
    page,
  }) => {
    await openTool(page);
    const r = computeFence(DEFAULT_INPUT);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Fence Calculator');
    await expect(out(page, 'fenced')).toHaveText(fmt(r.fenced));
    await expect(out(page, 'sections')).toHaveText(fmt(r.sections));
    await expect(out(page, 'posts')).toHaveText(fmt(r.posts));
    await expect(out(page, 'posts-note')).toHaveText('15 sections + 1 gate + 1 to end the run');
    await expect(out(page, 'post-length')).toHaveText('8 ft');
    await expect(out(page, 'rails')).toHaveText(fmt(r.rails));
    await expect(out(page, 'pickets')).toHaveText(fmt(r.pickets));
    await expect(out(page, 'bags')).toHaveText(fmt(r.bags));
    await expect(out(page, 'total')).toHaveText('—');
    await expect(page.locator('#fc-r option[value="auto"]')).toHaveText('Typical for 6 ft (3)');

    const robots = page.locator('meta[name="robots"]');
    if ((await robots.count()) > 0) await expect(robots).not.toHaveAttribute('content', /noindex/);
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    const faq = blocks.filter((s) => s.includes('"FAQPage"'));
    expect(faq).toHaveLength(1);
    for (const quoted of ['so 18 pickets', '14 posts', '0.92 cubic feet', 'take 280 with 10%'])
      expect(faq[0]).toContain(quoted);
    expect(blocks.filter((s) => s.includes('"WebApplication"'))).toHaveLength(1);
    const crumbs = blocks.map((b) => JSON.parse(b)).find((d) => d['@type'] === 'BreadcrumbList');
    expect(crumbs.itemListElement.map((c: { name: string }) => c.name)).toEqual([
      'Home',
      'Free Tools',
      'Fence Calculator',
    ]);
  });

  test('a shared link reproduces the run, and edits update the address', async ({ page }) => {
    await openTool(page, `${PATH}?len=100&h=6&sp=8&g=0&gw=4&pw=5.5&gap=0&r=auto&dp=24&bag=80`);
    await expect(out(page, 'posts')).toHaveText('14');
    await page.locator('#fc-sp').selectOption('6');
    await expect(out(page, 'posts')).toHaveText('18');
    await expect(out(page, 'rails-note')).toContainText('12 ft 2×4s');
    await expect(page).toHaveURL(/[?&]sp=6(&|$)/);
    await page.locator('#fc-h').selectOption('8');
    await expect(page.locator('#fc-r option[value="auto"]')).toHaveText('Typical for 8 ft (4)');
    const r = computeFence(run({ run: 100, gates: 0, spacing: '6', height: '8' }));
    await expect(out(page, 'rails')).toHaveText(fmt(r.rails));
    await page.reload();
    await expect(page.locator('[data-calculator][data-ready="true"]')).toBeVisible();
    await expect(page.locator('#fc-sp')).toHaveValue('6');
    await expect(page.locator('#fc-h')).toHaveValue('8');
  });

  test('remembers the contractor’s prices and prices the run', async ({ page }) => {
    await openTool(page);
    await page.locator('#fc-p-picket').fill('3.25');
    await page.locator('#fc-p-labor').fill('14');
    const r = computeFence(DEFAULT_INPUT);
    const p = priceFence(DEFAULT_INPUT, r, { picket: 3.25, labor: 14 });
    await expect(out(page, 'total')).toHaveText(money(p.total!));
    await page.reload();
    await expect(page.locator('[data-calculator][data-ready="true"]')).toBeVisible();
    await expect(page.locator('#fc-p-picket')).toHaveValue('3.25');
    await expect(out(page, 'total')).toHaveText(money(p.total!));
  });

  test('builds an estimate across runs that survives a reload', async ({ page }) => {
    await openTool(page);
    await page.locator('#fc-p-labor').fill('2');
    await page.getByRole('button', { name: 'Add to estimate' }).click();
    await page.locator('#fc-len').fill('80');
    await page.getByRole('button', { name: 'Add to estimate' }).click();
    const groups = page.locator('[data-tray-group]');
    await expect(groups).toHaveCount(2);
    await expect(page.locator('[data-tray-count]')).toHaveText('12 lines');

    const first = computeFence(DEFAULT_INPUT);
    const second = computeFence(run({ run: 80 }));
    const total = Math.round((first.fenced + second.fenced) * 2 * 100) / 100;
    await expect(page.locator('[data-tray-total]')).toHaveText(money(total));

    await page.reload();
    await expect(page.locator('[data-tray-group]')).toHaveCount(2);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download CSV' }).click(),
    ]);
    const csv = await readFile((await download.path())!, 'utf-8');
    expect(csv).toContain('Fence · 120 ft run, 6 ft privacy');
    expect(csv).toContain('Labor: build 6 ft fence');
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
