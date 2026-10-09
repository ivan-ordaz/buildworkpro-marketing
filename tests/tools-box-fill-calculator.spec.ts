import { test, expect, type Page } from '@playwright/test';
import {
  BOXES,
  computeBoxFill,
  DEFAULT_INPUT,
  fromParams,
  groundAllowances,
  maxConductors,
  SIZES,
  smallestBox,
  toParams,
  VOLUME_PER_CONDUCTOR,
  type BoxFillInput,
  type Counts,
  type ItemId,
  type ListedBox,
} from '../src/lib/calculators/boxfill';

// /tools/box-fill-calculator/. Expected numbers come from the same math module
// the page uses, plus literal checks that pin every figure quoted in the page's
// FAQ (the single-gang receptacle box is the calculator's default).

const PATH = '/tools/box-fill-calculator/';
const none = (): Counts => ({ '18': 0, '16': 0, '14': 0, '12': 0, '10': 0, '8': 0, '6': 0 });
const box = (over: Partial<BoxFillInput>): BoxFillInput => ({
  ...DEFAULT_INPUT,
  conductors: none(),
  devices: none(),
  grounds: 0,
  clamps: false,
  ...over,
});
const vol = (r: ReturnType<typeof computeBoxFill>, id: ItemId) =>
  r.items.find((i) => i.id === id)!.volume;

test.describe('box fill math', () => {
  test('volume per conductor follows 314.16(B)', () => {
    expect(SIZES.map((s) => VOLUME_PER_CONDUCTOR[s])).toEqual([1.5, 1.75, 2, 2.25, 2.5, 3, 5]);
  });

  test('box volumes reproduce the 314.16(A) table’s conductor counts', () => {
    // Maximum conductors per box, 18 through 6 AWG, as printed in the table
    // (Steel City catalog reprint). The table prints 5 for 8 AWG in a 4 × 1¼ in
    // round box, which 12.5 ÷ 3.00 does not support; Indiana amended that cell to 4
    // (675 IAC 17-1.8-14). The calculator works from volume, so it says 4.
    const printed: Record<ListedBox, number[]> = {
      'r4-125': [8, 7, 6, 5, 5, 4, 2],
      'r4-15': [10, 8, 7, 6, 6, 5, 3],
      'r4-218': [14, 12, 10, 9, 8, 7, 4],
      's4-125': [12, 10, 9, 8, 7, 6, 3],
      's4-15': [14, 12, 10, 9, 8, 7, 4],
      's4-218': [20, 17, 15, 13, 12, 10, 6],
      's411-125': [17, 14, 12, 11, 10, 8, 5],
      's411-15': [19, 16, 14, 13, 11, 9, 5],
      's411-218': [28, 24, 21, 18, 16, 14, 8],
      'd3-15': [5, 4, 3, 3, 3, 2, 1],
      'd3-2': [6, 5, 5, 4, 4, 3, 2],
      'd3-225': [7, 6, 5, 4, 4, 3, 2],
      'd3-25': [8, 7, 6, 5, 5, 4, 2],
      'd3-275': [9, 8, 7, 6, 5, 4, 2],
      'd3-35': [12, 10, 9, 8, 7, 6, 3],
      'd4-15': [6, 5, 5, 4, 4, 3, 2],
      'd4-178': [8, 7, 6, 5, 5, 4, 2],
      'd4-218': [9, 8, 7, 6, 5, 4, 2],
      'm-25': [9, 8, 7, 6, 5, 4, 2],
      'm-35': [14, 12, 10, 9, 8, 7, 4],
      fs1: [9, 7, 6, 6, 5, 4, 2],
      fd1: [12, 10, 9, 8, 7, 6, 3],
      fsm: [12, 10, 9, 8, 7, 6, 3],
      fdm: [16, 13, 12, 10, 9, 8, 4],
    };
    for (const [k, counts] of Object.entries(printed) as [ListedBox, number[]][])
      expect(
        SIZES.map((s) => maxConductors(BOXES[k].volume, s)),
        k
      ).toEqual(counts);
  });

  test('matches the 4 in square, 1½ in deep box quoted in the FAQ', () => {
    const sq = BOXES['s4-15'].volume;
    expect(sq).toBe(21);
    expect(maxConductors(sq, '12')).toBe(9);
    expect(maxConductors(sq, '12', VOLUME_PER_CONDUCTOR['12'])).toBe(8);
    expect(maxConductors(sq, '12', 2 * VOLUME_PER_CONDUCTOR['12'])).toBe(7);
    expect(maxConductors(sq, '14')).toBe(10);
    // The same answers from the full calculation.
    const nine = computeBoxFill(box({ box: 's4-15', conductors: { ...none(), '12': 9 } }));
    expect(nine.verdict).toBe('pass');
    const ten = computeBoxFill(box({ box: 's4-15', conductors: { ...none(), '12': 10 } }));
    expect(ten.verdict).toBe('fail');
    const withGrounds = (n: number) =>
      computeBoxFill(
        box({ box: 's4-15', conductors: { ...none(), '12': n }, grounds: 4, clamps: true })
      );
    expect(withGrounds(7).verdict).toBe('pass');
    expect(withGrounds(8).verdict).toBe('fail');
  });

  test('grounds: up to four count as one, then a quarter each, since the 2020 NEC', () => {
    expect(groundAllowances('2023', 6, 0)).toEqual({ main: 1.5, iso: 0 });
    expect(groundAllowances('2020', 6, 0)).toEqual({ main: 1.5, iso: 0 });
    expect(groundAllowances('2023', 4, 0)).toEqual({ main: 1, iso: 0 });
    expect(groundAllowances('2023', 0, 0)).toEqual({ main: 0, iso: 0 });
    expect(groundAllowances('2017', 6, 0)).toEqual({ main: 1, iso: 0 });
    // 2017: an isolated ground set takes its own allowance; 2020 on, it counts with the rest.
    expect(groundAllowances('2017', 2, 2)).toEqual({ main: 1, iso: 1 });
    expect(groundAllowances('2023', 3, 3)).toEqual({ main: 1.5, iso: 0 });

    const six = (edition: BoxFillInput['edition']) =>
      vol(computeBoxFill(box({ edition, grounds: 6, groundSize: '14' })), 'grounds');
    expect(six('2023')).toBe(3);
    expect(six('2017')).toBe(2);
    const iso = computeBoxFill(
      box({ edition: '2017', grounds: 2, groundSize: '12', isoGrounds: 1, isoSize: '10' })
    );
    // Main allowance at the largest of all grounds (10), plus the isolated set at 10.
    expect(vol(iso, 'grounds')).toBe(5);
  });

  test('devices count two per gang at the largest conductor connected', () => {
    const r = (devices: Partial<Counts>) =>
      vol(computeBoxFill(box({ devices: { ...none(), ...devices } })), 'devices');
    expect(r({ '14': 1 })).toBe(4);
    expect(r({ '12': 1 })).toBe(4.5);
    expect(r({ '6': 2 })).toBe(20);
    expect(r({ '12': 2, '14': 1 })).toBe(13);
  });

  test('clamps and support fittings take the largest conductor present', () => {
    const r = computeBoxFill(
      box({
        conductors: { ...none(), '14': 2, '12': 2 },
        grounds: 2,
        groundSize: '10',
        clamps: true,
        stud: true,
        hickey: true,
      })
    );
    expect(r.largest).toBe('10');
    expect(vol(r, 'clamps')).toBe(2.5);
    expect(vol(r, 'fittings')).toBe(5);
    expect(vol(r, 'conductors')).toBe(2 * 2 + 2 * 2.25);
    // Nothing in the box: clamps add nothing.
    expect(computeBoxFill(box({ clamps: true })).required).toBe(0);
  });

  test('terminal blocks count under the 2023 NEC only', () => {
    const input = box({ conductors: { ...none(), '12': 4 }, blocks: 2, blockSize: '12' });
    expect(vol(computeBoxFill(input), 'blocks')).toBe(4.5);
    const r2020 = computeBoxFill({ ...input, edition: '2020' });
    expect(vol(r2020, 'blocks')).toBe(0);
    expect(r2020.items.find((i) => i.id === 'blocks')!.detail).toBe(
      'Not counted under the 2020 NEC'
    );
  });

  test('the single-gang receptacle box in the FAQ fits with nothing to spare', () => {
    const r = computeBoxFill(DEFAULT_INPUT);
    expect([vol(r, 'conductors'), vol(r, 'clamps'), vol(r, 'devices'), vol(r, 'grounds')]).toEqual([
      9, 2.25, 4.5, 2.25,
    ]);
    expect(r.required).toBe(18);
    expect(r.boxVolume).toBe(18);
    expect(r.verdict).toBe('pass');
    expect(r.roomFor).toBe(0);
    expect(r.smallest).toBe('d3-35');
    expect(computeBoxFill({ ...DEFAULT_INPUT, box: 'd3-275' }).verdict).toBe('fail');
    const r14 = computeBoxFill({
      ...DEFAULT_INPUT,
      conductors: { ...none(), '14': 4 },
      devices: { ...none(), '14': 1 },
      groundSize: '14',
    });
    expect(r14.required).toBe(16);
    expect(r14.smallest).toBe('d3-35');
  });

  test('rings add to the box, and the smallest box counts them', () => {
    const r = computeBoxFill({ ...DEFAULT_INPUT, box: 's4-15', rings: BOXES['s4-15'].volume });
    expect(r.boxVolume).toBe(42);
    const crowded = box({ box: 'd3-25', conductors: { ...none(), '12': 6 }, rings: 3.5 });
    // 13.5 cu in needed: a 12.5 box with a 3.5 ring works, and so does a 10.0 box with it.
    expect(computeBoxFill(crowded).verdict).toBe('pass');
    expect(computeBoxFill(crowded).smallest).toBe('d3-2');
    expect(smallestBox(13.5, 0, 'device')).toBe('d3-275');
    expect(smallestBox(43, 0, 'square')).toBeNull();
    // An other box: the common round, square and device boxes only.
    expect(smallestBox(22, 0, null)).toBe('s411-125');
  });

  test('an other box uses the entered volume, and no volume reads as no verdict', () => {
    const other = { ...DEFAULT_INPUT, box: 'other' as const };
    expect(computeBoxFill({ ...other, otherVolume: 0 }).verdict).toBe('info');
    const r = computeBoxFill({ ...other, otherVolume: 20.3 });
    expect(r.verdict).toBe('pass');
    expect(r.roomFor).toBe(1);
    expect(r.smallest).toBe('s4-125');
  });

  test('query parameters round-trip, are clamped, and bad values fall back', () => {
    expect(fromParams(toParams(DEFAULT_INPUT))).toEqual(DEFAULT_INPUT);
    expect(fromParams({})).toEqual(DEFAULT_INPUT);
    const i = fromParams({
      ed: '2008',
      b: 'toString',
      v: '-5',
      rv: '5000',
      c12: '250',
      c14: '2.6',
      d12: 'abc',
      g: '',
      gs: '4',
      cl: '0',
      tbs: '6',
    });
    expect(i.edition).toBe(DEFAULT_INPUT.edition);
    expect(i.box).toBe(DEFAULT_INPUT.box);
    expect(i.otherVolume).toBe(0);
    expect(i.rings).toBe(1000);
    expect(i.conductors['12']).toBe(99);
    expect(i.conductors['14']).toBe(3);
    expect(i.devices['12']).toBe(0);
    expect(i.grounds).toBe(0);
    expect(i.groundSize).toBe(DEFAULT_INPUT.groundSize);
    expect(i.clamps).toBe(false);
    expect(i.blockSize).toBe('6');
    expect(fromParams({ b: 'other', v: '22.5' })).toMatchObject({
      box: 'other',
      otherVolume: 22.5,
    });
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
  test('renders the example box, is indexable and carries its structured data', async ({
    page,
  }) => {
    await openTool(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Box Fill Calculator');
    await expect(page).toHaveTitle(/\| BuildWorkPro$/);
    expect((await page.title()).length).toBeLessThanOrEqual(70);
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description!.length).toBeLessThanOrEqual(160);

    await expect(out(page, 'required')).toHaveText('18.00');
    await expect(out(page, 'box')).toHaveText('18.0');
    await expect(page.locator('[data-verdict]')).toHaveText('Fits');
    await expect(out(page, 'verdict-note')).toHaveText(
      '0.00 cu in to spare. Room for 0 more 12 AWG conductors.'
    );
    await expect(out(page, 'smallest')).toHaveText('3 × 2 × 3½ in device');
    await expect(out(page, 'v-conductors')).toHaveText('9.00');
    await expect(out(page, 'd-grounds')).toHaveText('2 grounds count as 1, at 12 AWG');
    await expect(out(page, 'v-devices')).toHaveText('4.50');
    await expect(out(page, 'total')).toHaveText('18.00');
    // No prices, so no estimate tray, and the edition-only and other-box fields are hidden.
    await expect(page.locator('[data-estimate-tray]')).toHaveCount(0);
    await expect(page.locator('#bf-v')).toBeHidden();
    await expect(page.locator('#bf-tb')).toBeVisible();

    // Every FAQ figure on the page is the module's number.
    const faq = (await page.locator('main').textContent()) ?? '';
    for (const s of [
      '9, if nothing else is in the box',
      'rounds down to 9',
      'leaves room for 8',
      'which leaves 7',
      'the same box holds 10',
      'count as 1.5, or 3.00 cu in',
      '2.00 cu in for the same six',
      'takes 4.00 cu in',
      '12 AWG takes 4.50',
      'two gangs is 20.00 cu in',
      'take 9.00 cu in, the clamps 2.25, the receptacle 4.50 and the two grounds 2.25',
      'That is 18.00 cu in, exactly the box’s 18.0',
      'at 14.0 cu in is too small',
      'needs 16.00 cu in',
      'adds 21.0 cu in',
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
      'Box Fill Calculator',
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

  test('a shared link reproduces the box, flags overfill, and edits update the address', async ({
    page,
  }) => {
    await openTool(page, `${PATH}?ed=2023&b=s4-15&c12=8&d12=1&g=6&gs=12&cl=1`);
    const input = fromParams({ ed: '2023', b: 's4-15', c12: '8', d12: '1', g: '6', gs: '12' });
    const r = computeBoxFill(input);
    expect(r.verdict).toBe('fail');
    await expect(out(page, 'required')).toHaveText(r.required.toFixed(2));
    await expect(page.locator('[data-verdict]')).toHaveText('Overfilled');
    await expect(out(page, 'verdict-note')).toContainText(`Over by ${(-r.spare).toFixed(2)} cu in`);
    await expect(out(page, 'smallest')).toHaveText(BOXES[r.smallest!].label);
    await expect(out(page, 'd-grounds')).toHaveText(
      '6 grounds: 1 for the first 4 + 2 × ¼ = 1.5, at 12 AWG'
    );

    // The 2017 NEC counts all six grounds as one; terminal blocks drop out of view.
    await page.locator('#bf-ed').selectOption('2017');
    const r2017 = computeBoxFill({ ...input, edition: '2017' });
    await expect(out(page, 'required')).toHaveText(r2017.required.toFixed(2));
    await expect(out(page, 'd-grounds')).toHaveText('6 grounds: 1 at 12 AWG');
    await expect(page.locator('#bf-tb')).toBeHidden();
    await expect(page).toHaveURL(/[?&]ed=2017(&|$)/);

    // An extension ring gets it to fit.
    await page.locator('#bf-rv').fill('21');
    await expect(page.locator('[data-verdict]')).toHaveText('Fits');
    await expect(out(page, 'box')).toHaveText('42.0');

    // A nonmetallic box by its stamped volume.
    await page.locator('#bf-b').selectOption('other');
    await expect(page.locator('#bf-v')).toBeVisible();
    await page.locator('#bf-rv').fill('0');
    await page.locator('#bf-v').fill('22.5');
    await expect(page.locator('[data-verdict]')).toHaveText('Overfilled');
    await expect(page).toHaveURL(/[?&]b=other(&|$)/);
    await page.reload();
    await expect(page.locator('[data-calculator][data-ready="true"]')).toBeVisible();
    await expect(page.locator('#bf-v')).toHaveValue('22.5');
    await expect(page.locator('#bf-ed')).toHaveValue('2017');
    await expect(page.locator('#bf-cl')).toBeChecked();
  });

  test('fits a phone without horizontal page scroll', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openTool(page);
    const widths = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }));
    expect(widths.page).toBeLessThanOrEqual(widths.viewport);
  });
});
