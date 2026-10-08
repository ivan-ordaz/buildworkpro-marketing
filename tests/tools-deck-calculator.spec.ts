import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import {
  bagsFor,
  computeDeck,
  deckingRows,
  DEFAULT_INPUT,
  estimateLines,
  footingCuft,
  fromParams,
  groupLabel,
  joistCount,
  joistStockLength,
  priceDeck,
  TREX_GAP_IN,
  type DeckInput,
} from '../src/lib/calculators/deck';
import { fmt, money } from '../src/lib/calculators/format';

// /tools/deck-calculator/. Expected numbers come from the same math module the
// page uses, plus literal checks that pin every figure quoted in the page's FAQ.

const PATH = '/tools/deck-calculator/';
const deck = (over: Partial<DeckInput>): DeckInput => ({ ...DEFAULT_INPUT, ...over });

test.describe('deck math', () => {
  test('the example deck is 16 ft along the house and 12 ft out', () => {
    expect(groupLabel(DEFAULT_INPUT)).toBe('Deck · 16 × 12 ft');
    expect(DEFAULT_INPUT.gap).toBe(TREX_GAP_IN);
    expect(TREX_GAP_IN).toBe(3 / 16);
    const r = computeDeck(DEFAULT_INPUT);
    expect(r.area).toBe(192);
    expect([r.ledgerFt, r.rimFt, r.beamFt, r.framingFt]).toEqual([16, 16, 32, 64]);
    expect(r.posts).toBe(3);
    expect(r.bags).toBe(14); // 3 footings × 2.75 cu ft ÷ 0.60
  });

  test('matches the 12 × 16 deck quoted in the FAQ', () => {
    const r = computeDeck(deck({ length: 16, projection: 12, boardLength: 16, waste: 10 }));
    expect([r.rows, r.deckingFt, r.boards]).toEqual([26, 416, 29]);
    const turned = computeDeck(deck({ length: 12, projection: 16, boardLength: 12, waste: 10 }));
    expect([turned.rows, turned.boards]).toEqual([34, 38]);
  });

  test('rows count n boards and n − 1 gaps across the projection', () => {
    expect(deckingRows(12, 5.5, 0.1875)).toBe(26);
    // 10 boards of 5.5" with 9 gaps of 0.5" cover exactly 59.5"
    expect(deckingRows(59.5 / 12, 5.5, 0.5)).toBe(10);
    expect(deckingRows(0, 5.5, 0.1875)).toBe(0);
  });

  test('rows longer than a board get butt joints and the short pieces are shared', () => {
    // 24-ft rows from 16-ft boards: one whole board plus an 8-ft piece, two pieces per board
    const r = computeDeck(deck({ length: 24, waste: 0 }));
    expect(r.piecesPerRow).toBe(2);
    expect(r.boards).toBe(26 + 13);
    // each row crosses 19 joists plus one butt joint
    expect(r.joists).toBe(19);
    expect(r.screws).toBe(2 * 26 * 20);
    // a row shorter than half a board gets two rows from each board
    expect(computeDeck(deck({ length: 8, waste: 0 })).boards).toBe(13);
  });

  test('joist counts quoted in the FAQ', () => {
    expect(joistCount(16, 16)).toBe(13);
    expect(joistCount(16, 12)).toBe(17);
    expect(joistCount(16, 24)).toBe(9);
    const r = computeDeck(deck({ length: 16, spacing: 16 }));
    expect(r.hangers).toBe(r.joists);
  });

  test('joist stock is the next even length, never under 8 ft, flagged over 20 ft', () => {
    expect(joistStockLength(12)).toBe(12);
    expect(joistStockLength(11)).toBe(12);
    expect(joistStockLength(12.5)).toBe(14);
    expect(joistStockLength(5)).toBe(8);
    expect(computeDeck(deck({ projection: 20 })).joistOverStock).toBe(false);
    const long = computeDeck(deck({ projection: 21 }));
    expect([long.joistLength, long.joistOverStock]).toEqual([22, true]);
  });

  test('concrete for a 12 × 42 inch footing matches the FAQ and the Quikrete yields', () => {
    const cuft = footingCuft(12, 42);
    expect(cuft).toBeCloseTo(2.75, 2);
    expect([bagsFor(cuft, 80), bagsFor(cuft, 60), bagsFor(cuft, 40)]).toEqual([5, 7, 10]);
    expect(bagsFor(0, 80)).toBe(0);
  });

  test('posts are one per spacing plus one, each with a footing', () => {
    expect(computeDeck(deck({ length: 16, postSpacing: 8 })).posts).toBe(3);
    expect(computeDeck(deck({ length: 17, postSpacing: 8 })).posts).toBe(4);
    expect(computeDeck(deck({ length: 6, postSpacing: 8 })).posts).toBe(2);
  });

  test('screws per square foot quoted in the FAQ', () => {
    const r = computeDeck(DEFAULT_INPUT);
    expect(r.screws).toBe(676);
    expect(r.screws / r.area).toBeCloseTo(3.5, 1);
    const tight = computeDeck(deck({ spacing: 12 }));
    expect(tight.screws / tight.area).toBeCloseTo(4.6, 1);
    expect(computeDeck(deck({ fastener: 'hidden' })).screws).toBe(0);
  });

  test('an empty size counts nothing', () => {
    const r = computeDeck(deck({ length: 0 }));
    expect([r.boards, r.joists, r.hangers, r.posts, r.bags, r.screws, r.framingFt]).toEqual([
      0, 0, 0, 0, 0, 0, 0,
    ]);
    expect(estimateLines(deck({ length: 0 }), r, {})).toHaveLength(0);
  });

  test('prices only what the contractor priced', () => {
    const r = computeDeck(DEFAULT_INPUT);
    expect(priceDeck(r, {}).total).toBeNull();
    const partial = priceDeck(r, { decking: 30 });
    expect(partial.material).toBe(r.boards * 30);
    expect(partial.materialComplete).toBe(false);
    const full = priceDeck(r, {
      decking: 30,
      joist: 25,
      lumber: 2.5,
      post: 40,
      bag: 7,
      hanger: 2,
      screws: 9,
      labor: 12,
    });
    expect(full.materialComplete).toBe(true);
    const material = r.boards * 30 + r.joists * 25 + 64 * 2.5 + 3 * 40 + 14 * 7 + 13 * 2 + 6.76 * 9;
    expect(full.material).toBe(Math.round(material * 100) / 100);
    expect(full.labor).toBe(192 * 12);
    expect(full.total).toBe(Math.round((full.material! + full.labor!) * 100) / 100);
  });

  test('estimate lines carry quantities and only the prices given', () => {
    const r = computeDeck(DEFAULT_INPUT);
    const lines = estimateLines(DEFAULT_INPUT, r, { labor: 12, screws: 9 });
    expect(lines.map((l) => l.unit)).toEqual([
      'boards',
      'joists',
      'lin ft',
      'posts',
      'bags',
      'ea',
      'ea',
      'sq ft',
    ]);
    expect(lines.filter((l) => l.price != null)).toHaveLength(2);
    expect(lines.find((l) => l.desc === 'Deck screws')!.price).toBeCloseTo(0.09, 10);
    expect(lines[0].desc).toBe('Decking, 5.5" boards, 16 ft');
    expect(lines[1].desc).toBe('Joists, 12 ft, 16" o.c.');
    const hidden = deck({ fastener: 'hidden' });
    expect(
      estimateLines(hidden, computeDeck(hidden), {}).some((l) => l.desc === 'Deck screws')
    ).toBe(false);
  });

  test('query parameters are clamped and bad values fall back to defaults', () => {
    const i = fromParams({
      l: '9999',
      p: '-3',
      js: '18',
      bw: '0',
      gap: '5',
      bl: '14',
      wst: '90',
      ps: '0',
      ply: '7',
      fd: 'abc',
      bag: '50',
      fx: 'nails',
    });
    expect(i.length).toBe(100);
    expect(i.projection).toBe(DEFAULT_INPUT.projection);
    expect(i.spacing).toBe(DEFAULT_INPUT.spacing);
    expect(i.face).toBe(1);
    expect(i.gap).toBe(1);
    expect(i.boardLength).toBe(DEFAULT_INPUT.boardLength);
    expect(i.waste).toBe(40);
    expect(i.postSpacing).toBe(1);
    expect(i.plies).toBe(DEFAULT_INPUT.plies);
    expect(i.footingDia).toBe(DEFAULT_INPUT.footingDia);
    expect(i.bag).toBe(DEFAULT_INPUT.bag);
    expect(i.fastener).toBe(DEFAULT_INPUT.fastener);
    expect(fromParams({ js: '24', bl: '20', ply: '3', bag: '60', fx: 'hidden' })).toMatchObject({
      spacing: 24,
      boardLength: 20,
      plies: 3,
      bag: 60,
      fastener: 'hidden',
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
  test('renders the example deck, is indexable and carries its structured data', async ({
    page,
  }) => {
    await openTool(page);
    const r = computeDeck(DEFAULT_INPUT);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Deck Calculator');
    await expect(out(page, 'area')).toHaveText(fmt(r.area));
    await expect(out(page, 'boards')).toHaveText(fmt(r.boards));
    await expect(out(page, 'joists')).toHaveText(fmt(r.joists));
    await expect(out(page, 'hangers')).toHaveText(fmt(r.hangers));
    await expect(out(page, 'framing')).toHaveText(fmt(r.framingFt));
    await expect(out(page, 'posts')).toHaveText(fmt(r.posts));
    await expect(out(page, 'bags')).toHaveText(fmt(r.bags));
    await expect(out(page, 'screws')).toHaveText(fmt(r.screws));
    await expect(out(page, 'total')).toHaveText('—');
    await expect(page.locator('#dk-gap')).toHaveValue('0.1875');

    const robots = page.locator('meta[name="robots"]');
    if ((await robots.count()) > 0) await expect(robots).not.toHaveAttribute('content', /noindex/);
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(blocks.filter((s) => s.includes('"FAQPage"'))).toHaveLength(1);
    expect(blocks.filter((s) => s.includes('"WebApplication"'))).toHaveLength(1);
    const crumbs = blocks.map((b) => JSON.parse(b)).find((d) => d['@type'] === 'BreadcrumbList');
    expect(crumbs.itemListElement.map((c: { name: string }) => c.name)).toEqual([
      'Home',
      'Free Tools',
      'Deck Calculator',
    ]);
  });

  test('a shared link reproduces the deck, and edits update the address', async ({ page }) => {
    await openTool(page, `${PATH}?l=12&p=16&js=16&bw=5.5&gap=0.1875&bl=12&wst=10`);
    await expect(out(page, 'boards')).toHaveText('38');
    await page.locator('#dk-js').selectOption('12');
    const r = computeDeck(deck({ length: 12, projection: 16, boardLength: 12, spacing: 12 }));
    await expect(out(page, 'joists')).toHaveText(fmt(r.joists));
    await expect(page).toHaveURL(/[?&]js=12(&|$)/);
    await page.locator('#dk-proj').fill('10');
    await expect(page).toHaveURL(/[?&]p=10(&|$)/);
    await page.reload();
    await expect(page.locator('#dk-proj')).toHaveValue('10');
    await expect(page.locator('#dk-js')).toHaveValue('12');
  });

  test('hidden fasteners drop the screw count', async ({ page }) => {
    await openTool(page);
    await page.locator('#dk-fx').selectOption('hidden');
    await expect(out(page, 'screws')).toHaveText('—');
    await expect(out(page, 'screws-note')).toContainText('coverage chart');
  });

  test('remembers the contractor’s prices and prices the deck', async ({ page }) => {
    await openTool(page);
    await page.locator('#dk-p-decking').fill('32.50');
    await page.locator('#dk-p-labor').fill('14');
    const r = computeDeck(DEFAULT_INPUT);
    const p = priceDeck(r, { decking: 32.5, labor: 14 });
    await expect(out(page, 'total')).toHaveText(money(p.total!));
    await page.reload();
    await expect(page.locator('[data-calculator][data-ready="true"]')).toBeVisible();
    await expect(page.locator('#dk-p-decking')).toHaveValue('32.5');
    await expect(out(page, 'total')).toHaveText(money(p.total!));
  });

  test('builds an estimate across decks that survives a reload', async ({ page }) => {
    await openTool(page);
    await page.locator('#dk-p-labor').fill('12');
    await page.getByRole('button', { name: 'Add to estimate' }).click();
    await page.locator('#dk-l').fill('20');
    await page.getByRole('button', { name: 'Add to estimate' }).click();
    const groups = page.locator('[data-tray-group]');
    await expect(groups).toHaveCount(2);
    await expect(groups.first()).toContainText('Deck · 16 × 12 ft');
    await expect(page.locator('[data-tray-count]')).toHaveText('16 lines');

    const first = computeDeck(DEFAULT_INPUT);
    const second = computeDeck(deck({ length: 20 }));
    const total = Math.round((first.area + second.area) * 12 * 100) / 100;
    await expect(page.locator('[data-tray-total]')).toHaveText(money(total));

    await page.reload();
    await expect(page.locator('[data-tray-group]')).toHaveCount(2);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download CSV' }).click(),
    ]);
    const csv = await readFile((await download.path())!, 'utf-8');
    expect(csv.split('\n')[0]).toBe('Group,Description,Qty,Unit,Unit price,Amount');
    expect(csv).toContain('Joist hangers at the ledger');
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
