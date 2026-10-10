import { test, expect, type Page } from '@playwright/test';
import {
  addMonths,
  change,
  chartGeometry,
  csvFor,
  dollars,
  escalate,
  FIRST_REPORT,
  LATEST,
  monthLabel,
  moved,
  pct,
  points,
  PPI,
  rebased,
  reportMonths,
  SERIES_DEFS,
  snapshot,
} from '../src/lib/prices/ppi';
import { COMPOSITE, MATERIALS, REPORT_EXTRAS } from '../src/data/prices/materials';

// /prices/: the BLS Producer Price Index pages. Expected numbers come from the
// same module the pages use; the data checks guard the file the monthly
// refresh writes, so a bad pull fails CI instead of reaching the site.

test.describe('price data file', () => {
  test('every series the pages use exists, with the last five years complete', () => {
    const used = new Set([
      COMPOSITE,
      ...REPORT_EXTRAS,
      ...MATERIALS.flatMap((m) => [...m.series, ...(m.regions ?? []).map((r) => r.id)]),
    ]);
    const defined = new Set(SERIES_DEFS.map((s) => s.id));
    for (const id of used) {
      expect(defined.has(id), `${id} in series.json`).toBe(true);
      const pts = points(id);
      expect(pts.length, id).toBeGreaterThanOrEqual(60);
      // BLS skips the odd month in old history (copper wire July 2020, gypsum
      // 2017-18); the five years every page compares across must be complete.
      for (let i = pts.length - 60; i < pts.length; i++) {
        expect(pts[i][0], `${id} gap after ${pts[i - 1][0]}`).toBe(addMonths(pts[i - 1][0], 1));
        expect(Number.isFinite(pts[i][1]), id).toBe(true);
      }
    }
    for (const m of MATERIALS) expect(points(m.headline).at(-1)![0], m.slug).toBe(LATEST);
    expect(PPI.lagging).toEqual([]);
  });

  test('month helpers', () => {
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2025-12', 1)).toBe('2026-01');
    expect(addMonths('2026-08', -60)).toBe('2021-08');
    expect(monthLabel('2026-08')).toBe('August 2026');
    expect(monthLabel('2026-08', true)).toBe('Aug 2026');
    expect(reportMonths().at(-1)).toBe(FIRST_REPORT);
    expect(reportMonths()[0]).toBe(LATEST);
  });

  test('changes, escalation and rebasing are ratios of the same series', () => {
    const id = MATERIALS[0].headline;
    const now = points(id).at(-1)![1];
    const yearAgo = points(id).find(([p]) => p === addMonths(LATEST, -12))![1];
    expect(change(id, 12)).toBeCloseTo((now / yearAgo - 1) * 100, 10);
    expect(escalate(id, 10000, addMonths(LATEST, -12))).toBeCloseTo((10000 * now) / yearAgo, 6);
    const r = rebased(id, 24);
    expect(r).toHaveLength(24);
    expect(r[0][1]).toBe(100);
    expect(r.at(-1)![1]).toBeCloseTo((now / points(id).at(-24)![1]) * 100, 8);
  });

  test('percent and wording helpers', () => {
    expect(pct(4.123)).toBe('+4.1%');
    expect(pct(-0.86)).toBe('−0.9%');
    expect(pct(0.01)).toBe('0.0%');
    expect(pct(null)).toBe('n/a');
    expect(moved(-4.12)).toBe('fell 4.1%');
    expect(moved(0.02)).toBe('was unchanged');
    expect(dollars(9590.4)).toBe('$9,590');
  });

  test('chart ticks cover the data and the line ends on the last point', () => {
    const pts = rebased(COMPOSITE, 60);
    const g = chartGeometry(pts);
    const values = pts.map(([, v]) => v);
    expect(g.ticks[0].value).toBeLessThanOrEqual(Math.min(...values));
    expect(g.ticks.at(-1)!.value).toBeGreaterThanOrEqual(Math.max(...values));
    expect(g.end.value).toBe(values.at(-1));
    for (let i = 1; i < g.coords.length; i++)
      expect(g.coords[i].x).toBeGreaterThan(g.coords[i - 1].x);
  });

  test('a month BLS skipped breaks the line instead of being bridged', () => {
    // Gypsum building materials has no data from June 2017 to August 2018.
    const g = chartGeometry(rebased('WPU13710102', 120));
    expect(g.path.match(/M/g)!.length).toBeGreaterThan(1);
    expect(g.area).toBe('');
    expect(rebased('WPU13710102', 24)).toHaveLength(24);
  });

  test('CSV has one row per month per series', () => {
    const csv = csvFor([COMPOSITE]).split('\n');
    expect(csv[0]).toBe('month,series_id,series,index_value,preliminary');
    expect(csv).toHaveLength(points(COMPOSITE).length + 1);
  });
});

async function crumbs(page: Page): Promise<string[]> {
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  const list = blocks.map((b) => JSON.parse(b)).find((d) => d['@type'] === 'BreadcrumbList');
  return list.itemListElement.map((c: { name: string }) => c.name);
}

test.describe('/prices/ pages', () => {
  test('hub shows the composite and one card per material', async ({ page }) => {
    await page.goto('/prices/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Construction material prices'
    );
    await expect(page.locator('[data-composite]')).toContainText(pct(snapshot(COMPOSITE).year));
    for (const m of MATERIALS) {
      const card = page.locator(`[data-material-card="${m.slug}"]`);
      await expect(card).toContainText(pct(snapshot(m.headline).year));
    }
    await expect(page.locator(`main a[href="/prices/reports/${LATEST}/"]`).first()).toBeVisible();
  });

  for (const m of MATERIALS) {
    test(`${m.slug} page shows the computed figures`, async ({ page }) => {
      await page.goto(`/prices/${m.slug}/`);
      const s = snapshot(m.headline);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(m.h1);
      await expect(page.locator('[data-kpi="year"]')).toHaveText(pct(s.year));
      await expect(page.locator('[data-kpi="month"]')).toHaveText(pct(s.month));
      const tenK = escalate(m.headline, 10000, addMonths(LATEST, -12))!;
      await expect(page.locator('[data-escalation]')).toContainText(dollars(tenK));
      await expect(page.locator('[data-series-row]')).toHaveCount(m.series.length);
      const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
      expect(blocks.filter((b) => b.includes('"FAQPage"'))).toHaveLength(1);
      expect((await crumbs(page)).slice(0, 2)).toEqual(['Home', 'Material Prices']);
    });
  }

  test('concrete page breaks ready-mix out by region; the chart range switches', async ({
    page,
  }) => {
    await page.goto('/prices/concrete/');
    await expect(page.locator('[data-region-table] tbody tr')).toHaveCount(4);
    await expect(page.locator('[data-range-panel="24"]')).toBeVisible();
    await page.getByRole('button', { name: '5 years' }).click();
    await expect(page.locator('[data-range-panel="60"]')).toBeVisible();
    await expect(page.locator('[data-range-panel="24"]')).toBeHidden();
  });

  test('monthly report: lede, every series, breadcrumb and archive', async ({ page }) => {
    await page.goto(`/prices/reports/${LATEST}/`);
    const c = snapshot(COMPOSITE);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(monthLabel(LATEST));
    await expect(page.locator('[data-lede]')).toContainText(moved(c.year));
    const ids = new Set([...MATERIALS.flatMap((m) => m.series), ...REPORT_EXTRAS]);
    await expect(page.locator('[data-report-row]')).toHaveCount(ids.size);
    expect(await crumbs(page)).toEqual(['Home', 'Material Prices', 'Reports', monthLabel(LATEST)]);
    await page.goto('/prices/reports/');
    await expect(page.locator(`main a[href="/prices/reports/${LATEST}/"]`)).toBeVisible();
  });

  test('CSV files carry the series behind each page', async ({ request }) => {
    const lumber = await request.get('/prices/data/lumber.csv');
    expect(lumber.status()).toBe(200);
    const text = await lumber.text();
    expect(text.split('\n')[0]).toBe('month,series_id,series,index_value,preliminary');
    expect(text).toContain(`${LATEST},${MATERIALS[0].headline},`);
    const all = await (await request.get('/prices/data/all.csv')).text();
    for (const s of SERIES_DEFS) expect(all, s.id).toContain(`,${s.id},`);
  });

  test('methodology lists every series and publishes Dataset data', async ({ page }) => {
    await page.goto('/prices/methodology/');
    for (const s of SERIES_DEFS)
      await expect(page.locator('[data-methodology-series]')).toContainText(s.id);
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(blocks.filter((b) => b.includes('"Dataset"'))).toHaveLength(1);
  });

  test('material page and report fit a phone without sideways scroll', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    for (const path of ['/prices/concrete/', `/prices/reports/${LATEST}/`, '/prices/']) {
      await page.goto(path);
      const fits = await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
      );
      expect(fits, path).toBe(true);
    }
  });
});
