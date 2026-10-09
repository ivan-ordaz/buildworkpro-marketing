import { test, expect, type Page } from '@playwright/test';
import {
  allowedPct,
  bareStrandedOd,
  checkFill,
  circularMils,
  computeFill,
  conductorArea,
  DEFAULT_INPUT,
  estimateLines,
  fromParams,
  groupLabel,
  jamCheck,
  maxSameSize,
  priceFill,
  racewayArea,
  racewayKey,
  RACEWAYS,
  roundNote7,
  smallestPassing,
  toParams,
  TRADE_SIZES,
  wireKey,
  type FillInput,
  type Row,
  type WireSize,
} from '../src/lib/calculators/conduit';
import { fmt, money } from '../src/lib/calculators/format';

// /tools/conduit-fill-calculator/. Expected numbers come from the same math
// module the page uses, plus literal checks that pin every figure quoted in the
// page's FAQ and the manufacturer dimensions the module is built on.

const PATH = '/tools/conduit-fill-calculator/';
const fill = (over: Partial<FillInput>): FillInput => ({
  ...DEFAULT_INPUT,
  rows: DEFAULT_INPUT.rows.map((r) => ({ ...r })),
  ...over,
});
const thhn = (qty: number, size: WireSize): Row => ({ qty, type: 'thhn', size });
const t12 = conductorArea('thhn', '12');
const fit40 = (area: number, cond: number) => (area * 0.4) / cond;

test.describe('conduit fill math', () => {
  test('raceway areas come from the published inside diameters', () => {
    expect(RACEWAYS.emt.id['3/4']).toBe(0.824);
    expect(racewayArea('emt', '3/4')).toBeCloseTo(0.5333, 4);
    expect(racewayArea('emt', '1')).toBeCloseTo(0.8643, 4);
    expect(racewayArea('pvc40', '1')).toBeCloseTo(0.8316, 4);
    expect(racewayArea('pvc80', '1')).toBeCloseTo(0.6881, 4);
    expect(racewayArea('rmc', '2')).toBeCloseTo(3.4078, 4);
    expect(racewayArea('imc', '4')).toBeCloseTo(13.631, 3);
    for (const rw of Object.values(RACEWAYS)) {
      const ids = TRADE_SIZES.map((t) => rw.id[t]);
      expect(ids).toEqual([...ids].sort((a, b) => a - b));
    }
    // Same outside diameter, thicker wall: Schedule 80 is always the smaller bore.
    for (const t of TRADE_SIZES) expect(RACEWAYS.pvc80.id[t]).toBeLessThan(RACEWAYS.pvc40.id[t]);
  });

  test('bare stranded diameters match Southwire SPEC 80150 Class B to the mil', () => {
    const southwire: [WireSize, number][] = [
      ['8', 146],
      ['6', 184],
      ['4', 232],
      ['3', 260],
      ['2', 292],
      ['2/0', 418],
      ['4/0', 528],
      ['250', 575],
      ['300', 630],
      ['350', 681],
      ['500', 814],
    ];
    for (const [size, mils] of southwire)
      expect(Math.abs(bareStrandedOd(size) * 1000 - mils), size).toBeLessThanOrEqual(1);
    const cmils: [WireSize, number][] = [
      ['14', 4110],
      ['12', 6530],
      ['10', 10380],
      ['8', 16510],
      ['6', 26240],
      ['4', 41740],
      ['1', 83690],
    ];
    for (const [size, cm] of cmils)
      expect(Math.abs(circularMils(size) / cm - 1), size).toBeLessThan(0.001);
  });

  test('fill limits by conductor count, and Note 7 rounding', () => {
    expect([1, 2, 3, 40].map((n) => allowedPct(n, false))).toEqual([53, 31, 40, 40]);
    expect(allowedPct(2, true)).toBe(60);
    expect([16.07, 9.877, 2.8, 2.79, 0.8, 0.79].map(roundNote7)).toEqual([16, 10, 3, 2, 1, 0]);
    // One 500 kcmil in 2 in EMT only fits under the single-conductor limit.
    expect(maxSameSize(racewayArea('emt', '2'), conductorArea('thhn', '500'))).toBe(1);
    expect(maxSameSize(0, t12)).toBe(0);
  });

  test('matches the 12 AWG THHN counts quoted in the FAQ', () => {
    const emt34 = racewayArea('emt', '3/4');
    expect(fit40(emt34, t12).toFixed(2)).toBe('16.07');
    expect(maxSameSize(emt34, t12)).toBe(16);
    expect(maxSameSize(racewayArea('emt', '1/2'), t12)).toBe(9);
    expect(maxSameSize(racewayArea('emt', '1'), t12)).toBe(26);
    expect(fit40(racewayArea('pvc40', '1'), t12).toFixed(2)).toBe('25.06');
    expect(maxSameSize(racewayArea('pvc40', '1'), t12)).toBe(25);
    expect(fit40(racewayArea('pvc80', '1'), t12).toFixed(2)).toBe('20.74');
    expect(maxSameSize(racewayArea('pvc80', '1'), t12)).toBe(20);
    expect(maxSameSize(emt34, t12, true)).toBe(24);
    // Note 7: 4 AWG THHN in 1½ in EMT is 9.88, so 10 are allowed.
    const emt112 = racewayArea('emt', '1-1/2');
    const t4 = conductorArea('thhn', '4');
    expect(fit40(emt112, t4).toFixed(2)).toBe('9.88');
    expect(maxSameSize(emt112, t4)).toBe(10);
    const ten = checkFill('emt', '1-1/2', [thhn(10, '4')], false);
    expect([ten.pass, ten.byNote7, fmt(ten.fillPct, 1)]).toEqual([true, true, '40.5']);
    expect(checkFill('emt', '1-1/2', [thhn(11, '4')], false).pass).toBe(false);
  });

  test('the ground counts: the FAQ’s ¾ in EMT example', () => {
    const sixteen = checkFill('emt', '3/4', [thhn(16, '12')], false);
    expect([fmt(sixteen.fillPct, 1), sixteen.pass, sixteen.close]).toEqual(['39.8', true, true]);
    const insulated = checkFill('emt', '3/4', [thhn(16, '12'), thhn(1, '12')], false);
    expect([insulated.count, fmt(insulated.fillPct, 1), insulated.pass]).toEqual([
      17,
      '42.3',
      false,
    ]);
    expect(insulated.sameSize).toBe(true);
    const bare = checkFill(
      'emt',
      '3/4',
      [thhn(16, '12'), { qty: 1, type: 'bare', size: '12' }],
      false
    );
    expect([bare.sameSize, fmt(bare.fillPct, 1), bare.pass]).toEqual([false, '41.1', false]);
    expect(bareStrandedOd('12').toFixed(3)).toBe('0.092');
  });

  test('flags the jam ratio for three conductors of one size', () => {
    const three = [thhn(3, '1/0')];
    const j114 = jamCheck('emt', '1-1/4', three);
    expect([j114.ratio!.toFixed(2), j114.risk]).toEqual(['2.84', true]);
    expect(fmt(checkFill('emt', '1-1/4', three, false).fillPct, 1)).toBe('37.2');
    expect(checkFill('emt', '1-1/4', three, false).pass).toBe(true);
    const j112 = jamCheck('emt', '1-1/2', three);
    expect([j112.ratio!.toFixed(2), j112.risk]).toEqual(['3.31', false]);
    expect(fmt(checkFill('emt', '1-1/2', three, false).fillPct, 1)).toBe('27.3');
    expect(jamCheck('emt', '1', [thhn(2, '4'), thhn(1, '8')])).toEqual({
      applies: true,
      same: false,
      ratio: null,
      risk: false,
    });
    expect(jamCheck('emt', '1', [thhn(4, '4')]).applies).toBe(false);
  });

  test('the example fill and the smallest size that passes', () => {
    const r = computeFill(DEFAULT_INPUT);
    expect([r.count, fmt(r.fillPct, 1), r.pass, r.allowedPct, r.smallest]).toEqual([
      4,
      '38.0',
      true,
      40,
      '1',
    ]);
    expect(r.wire.map((w) => w.feet)).toEqual([330, 110]);
    expect(checkFill('emt', '3/4', DEFAULT_INPUT.rows, false).pass).toBe(false);
    expect(smallestPassing('pvc80', DEFAULT_INPUT.rows, false)).toBe('1-1/4');
    expect(smallestPassing('emt', [thhn(50, '500')], false)).toBeNull();
    expect(smallestPassing('emt', [thhn(0, '12')], false)).toBeNull();
    expect(computeFill(fill({ rows: [thhn(0, '12')] })).pass).toBe(false);
  });

  test('prices only what the contractor priced', () => {
    const r = computeFill(DEFAULT_INPUT);
    expect(priceFill(DEFAULT_INPUT, r, {}).total).toBeNull();
    const raceOnly = priceFill(DEFAULT_INPUT, r, { [racewayKey('emt', '1')]: 1.25 });
    expect([raceOnly.raceway, raceOnly.wire, raceOnly.wireComplete]).toEqual([125, null, false]);
    const p = {
      [racewayKey('emt', '1')]: 1.25,
      [wireKey('thhn', '3')]: 0.95,
      [wireKey('thhn', '8')]: 0.4,
    };
    const full = priceFill(DEFAULT_INPUT, r, p);
    expect(full.wire).toBe(Math.round((330 * 0.95 + 110 * 0.4) * 100) / 100);
    expect(full.wireComplete).toBe(true);
    expect(full.total).toBe(Math.round((125 + full.wire!) * 100) / 100);
    expect(full.perFt).toBe(Math.round((full.total! / 100) * 100) / 100);
    // A price for another trade size does not price this one.
    expect(priceFill(DEFAULT_INPUT, r, { [racewayKey('emt', '3/4')]: 1 }).raceway).toBeNull();
  });

  test('estimate lines merge repeated wire sizes and carry only the prices given', () => {
    const input = fill({ rows: [thhn(2, '12'), thhn(1, '10'), thhn(1, '12')], run: 50, extra: 0 });
    const r = computeFill(input);
    const lines = estimateLines(input, r, { [wireKey('thhn', '12')]: 0.3 });
    expect(lines.map((l) => [l.desc, l.qty, l.unit, l.price])).toEqual([
      ['1 in EMT', 50, 'ft', null],
      ['12 AWG THHN/THWN-2 copper, 3 × 50 ft', 150, 'ft', 0.3],
      ['10 AWG THHN/THWN-2 copper, 1 × 50 ft', 50, 'ft', null],
    ]);
    const example = estimateLines(DEFAULT_INPUT, computeFill(DEFAULT_INPUT), {});
    expect(example[1].desc).toBe('3 AWG THHN/THWN-2 copper, 3 × 100 ft + 10% makeup');
    expect(groupLabel(DEFAULT_INPUT)).toBe('Conduit and wire · 1 in EMT, 100 ft run');
    expect(groupLabel(fill({ nipple: true, trade: '3/4', run: 2 }))).toBe(
      'Conduit and wire · ¾ in EMT nipple, 2 ft run'
    );
    expect(estimateLines(fill({ run: 0 }), computeFill(fill({ run: 0 })), {})).toEqual([]);
  });

  test('query parameters are clamped and bad values fall back to defaults', () => {
    const i = fromParams({
      rw: 'gold',
      ts: '5',
      nip: '1',
      run: '99999',
      x: '500',
      c1: '3.thhn.1/0',
      c2: 'bad',
      c3: '2000.bare.12',
      c4: 'x.thhn.12',
      c5: '2.xhhw.12',
    });
    expect(i.raceway).toBe(DEFAULT_INPUT.raceway);
    expect(i.trade).toBe(DEFAULT_INPUT.trade);
    expect(i.nipple).toBe(true);
    expect(i.run).toBe(10000);
    expect(i.extra).toBe(100);
    expect(i.rows).toEqual([
      { qty: 3, type: 'thhn', size: '1/0' },
      { qty: 999, type: 'bare', size: '12' },
      { qty: 0, type: 'thhn', size: '12' },
    ]);
    expect(fromParams({}).rows).toEqual(DEFAULT_INPUT.rows);
    expect(fromParams(toParams(DEFAULT_INPUT))).toEqual(DEFAULT_INPUT);
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
const status = (page: Page) => page.locator('[data-status]');
const rows = (page: Page) => page.locator('[data-row]:visible');

test.describe(PATH, () => {
  test('renders the example fill, is indexable and carries its structured data', async ({
    page,
  }) => {
    await openTool(page);
    const r = computeFill(DEFAULT_INPUT);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Conduit Fill Calculator');
    await expect(page).toHaveTitle(/\| BuildWorkPro$/);
    expect((await page.title()).length).toBeLessThanOrEqual(70);
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description!.length).toBeLessThanOrEqual(160);

    await expect(status(page)).toHaveText('Passes');
    await expect(page.locator('[data-calculator]')).toHaveAttribute('data-fill', 'pass');
    await expect(out(page, 'fill')).toHaveText(`${fmt(r.fillPct, 1)}%`);
    await expect(out(page, 'limit')).toHaveText('40%');
    await expect(out(page, 'smallest')).toHaveText('1 in');
    await expect(page.locator('[data-action="use-smallest"]')).toBeHidden();
    await expect(out(page, 'cond-area')).toHaveText(r.conductorArea.toFixed(4));
    await expect(out(page, 'race-area')).toHaveText('0.864');
    await expect(out(page, 'jam')).toHaveText('—');
    await expect(out(page, 'wire-label')).toHaveText('Wire, 440 ft');
    await expect(out(page, 'total')).toHaveText('—');
    await expect(rows(page)).toHaveCount(2);

    // Every FAQ figure on the page is the module's number.
    const text = (await page.locator('main').textContent()) ?? '';
    for (const s of [
      '16 of them',
      '16.07 fit',
      '½ in EMT takes 9 and 1 in EMT takes 26',
      '9.88, so 10 are allowed',
      '25 in 1 in PVC Schedule 40 and 20 in Schedule 80',
      '25.06 and 20.74',
      'takes 24 12 AWG THHN',
      '39.8%',
      '42.3%',
      '0.092 in across',
      '41.1%',
      '1.380 ÷ 0.486 = 2.84',
      '37.2%',
      'ratio is 3.31',
      '27.3%',
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
      'Conduit Fill Calculator',
    ]);
  });

  test('every input has a label', async ({ page }) => {
    await openTool(page);
    const ids = await page
      .locator('[data-calculator] input, [data-calculator] select')
      .evaluateAll((els) => els.map((e) => e.id));
    expect(ids.length).toBeGreaterThan(20);
    for (const id of ids) {
      expect(id, 'input without an id').not.toBe('');
      await expect(page.locator(`label[for="${id}"]`)).toHaveCount(1);
    }
  });

  test('a shared link reproduces a failing fill, and one click picks the size that passes', async ({
    page,
  }) => {
    await openTool(page, `${PATH}?rw=emt&ts=3/4&nip=0&run=100&x=10&c1=17.thhn.12`);
    await expect(status(page)).toHaveText('Fails');
    await expect(out(page, 'fill')).toHaveText('42.3%');
    await expect(out(page, 'smallest')).toHaveText('1 in');
    await page.getByRole('button', { name: 'Add to estimate' }).click();
    await expect(page.locator('[data-note]')).toContainText('fails in ¾ in EMT');
    await expect(page.locator('[data-tray-group]')).toHaveCount(0);

    await page.getByRole('button', { name: 'Use 1 in' }).click();
    await expect(status(page)).toHaveText('Passes');
    await expect(page.locator('#cf-ts')).toHaveValue('1');
    await expect(page).toHaveURL(/[?&]ts=1(&|$)/);

    await page.locator('#cf-q-0').fill('16');
    await page.locator('#cf-ts').selectOption('3/4');
    await expect(status(page)).toHaveText('Passes');
    await expect(out(page, 'code-note')).toContainText('takes up to 16 × 12 AWG');
    await expect(out(page, 'code-note')).toContainText('Within 1% of the limit');
    await page.reload();
    await expect(page.locator('#cf-q-0')).toHaveValue('16');
    await expect(page.locator('#cf-ts')).toHaveValue('3/4');
  });

  test('warns about jamming and applies the nipple limit', async ({ page }) => {
    await openTool(page, `${PATH}?rw=emt&ts=1-1/4&c1=3.thhn.1/0`);
    await expect(out(page, 'jam')).toHaveText('2.84');
    await expect(page.locator('[data-jam-cell]')).toHaveAttribute('data-risk', 'true');
    await expect(out(page, 'jam-note')).toContainText('can jam');
    await page.locator('#cf-ts').selectOption('1-1/2');
    await expect(out(page, 'jam')).toHaveText('3.31');
    await expect(page.locator('[data-jam-cell]')).toHaveAttribute('data-risk', 'false');

    await page.locator('#cf-ts').selectOption('3/4');
    await page.locator('#cf-q-0').fill('24');
    await page.locator('#cf-s-0').selectOption('12');
    await expect(status(page)).toHaveText('Fails');
    await page.locator('#cf-nip').check();
    await expect(out(page, 'limit')).toHaveText('60%');
    await expect(status(page)).toHaveText('Passes');
    await expect(page).toHaveURL(/[?&]nip=1(&|$)/);
  });

  test('adds and removes wire rows, and the link keeps them', async ({ page }) => {
    await openTool(page);
    await page.getByRole('button', { name: 'Add a wire size' }).click();
    await expect(rows(page)).toHaveCount(3);
    await expect(page.locator('#cf-q-2')).toHaveValue('1');
    await page.locator('#cf-t-2').selectOption('bare');
    await page.locator('#cf-s-2').selectOption('8');
    const withBare = computeFill(
      fill({ rows: [...DEFAULT_INPUT.rows, { qty: 1, type: 'bare', size: '8' }] })
    );
    await expect(out(page, 'fill')).toHaveText(`${fmt(withBare.fillPct, 1)}%`);
    await expect(page).toHaveURL(/[?&]c3=1\.bare\.8(&|$)/);

    await page.getByRole('button', { name: 'Remove wire row 1' }).click();
    await expect(rows(page)).toHaveCount(2);
    await expect(page.locator('#cf-s-0')).toHaveValue('8');
    await expect(page.locator('#cf-t-1')).toHaveValue('bare');
    await expect(page).not.toHaveURL(/[?&]c3=/);
    await page.reload();
    await expect(rows(page)).toHaveCount(2);
    await expect(page.locator('#cf-t-1')).toHaveValue('bare');
  });

  test('remembers prices by raceway size and wire size, and prices the run', async ({ page }) => {
    await openTool(page);
    await page.locator('#cf-p-race').fill('1.25');
    await page.locator('#cf-p-0').fill('0.95');
    await page.locator('#cf-p-1').fill('0.40');
    const r = computeFill(DEFAULT_INPUT);
    const p = priceFill(DEFAULT_INPUT, r, {
      [racewayKey('emt', '1')]: 1.25,
      [wireKey('thhn', '3')]: 0.95,
      [wireKey('thhn', '8')]: 0.4,
    });
    await expect(out(page, 'total')).toHaveText(money(p.total!));

    await page.locator('#cf-ts').selectOption('1-1/4');
    await expect(page.locator('#cf-p-race')).toHaveValue('');
    await page.locator('#cf-ts').selectOption('1');
    await expect(page.locator('#cf-p-race')).toHaveValue('1.25');

    await page.reload();
    await expect(page.locator('[data-calculator][data-ready="true"]')).toBeVisible();
    await expect(page.locator('#cf-p-0')).toHaveValue('0.95');
    await expect(out(page, 'total')).toHaveText(money(p.total!));
  });

  test('adds the raceway and wire to the estimate', async ({ page }) => {
    await openTool(page);
    await page.locator('#cf-p-race').fill('2');
    await page.getByRole('button', { name: 'Add to estimate' }).click();
    await expect(page.locator('[data-tray-group]')).toHaveCount(1);
    await expect(page.locator('[data-tray-count]')).toHaveText('3 lines');
    await expect(page.locator('[data-tray-group]')).toContainText(groupLabel(DEFAULT_INPUT));
    await expect(page.locator('[data-tray-total]')).toHaveText(money(200));

    await page.locator('#cf-run').fill('0');
    await page.getByRole('button', { name: 'Add to estimate' }).click();
    await expect(page.locator('[data-note]')).toHaveText('Enter the run length first.');
    await expect(page.locator('[data-tray-group]')).toHaveCount(1);
  });

  test('fits a phone without horizontal page scroll', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openTool(page);
    await page.getByRole('button', { name: 'Add a wire size' }).click();
    await page.getByRole('button', { name: 'Add to estimate' }).click();
    const widths = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }));
    expect(widths.page).toBeLessThanOrEqual(widths.viewport);
  });
});
