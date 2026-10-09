import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkUpdate, LIMITS } from '../scripts/prices/check-update.mjs';
import { priceDataDate, pricePaths } from '../scripts/prices/paths.mjs';
import { MATERIALS } from '../src/data/prices/materials';
import { PPI, reportMonths } from '../src/lib/prices/ppi';

// The unattended monthly refresh: the gate that decides whether a BLS update
// may merge itself, and the URL list IndexNow and the sitemap use afterwards.

type Point = [string, number, boolean];
const file = (latest: string, series: Record<string, Point[]>) => ({
  source: 'test',
  fetchedAt: '2026-10-15T14:00:00.000Z',
  latest,
  lagging: [],
  series: Object.fromEntries(Object.entries(series).map(([id, points]) => [id, { points }])),
});
const base: Point[] = [
  ['2025-12', 100, false],
  ['2026-01', 101, false],
  ['2026-06', 104, true],
  ['2026-07', 105, true],
  ['2026-08', 106, true],
];

test.describe('price update gate', () => {
  test('a new month inside the limits passes', () => {
    const prev = file('2026-08', { A: base });
    const next = file('2026-09', { A: [...base, ['2026-09', 108, true]] });
    const r = checkUpdate(prev, next);
    expect(r.ok).toBe(true);
    expect(r.newMonth).toBe('2026-09');
    expect(r.issues).toEqual([]);
    expect(r.notes).toContain('0 series with revised months, 1 with months added.');
  });

  test('longer history counts as months added, not revisions', () => {
    const prev = file('2026-08', { A: base.slice(1) });
    const r = checkUpdate(prev, file('2026-08', { A: base }));
    expect(r.ok).toBe(true);
    expect(r.notes).toContain('0 series with revised months, 1 with months added.');
  });

  test('BLS revising the recent months passes', () => {
    const prev = file('2026-08', { A: base });
    const revised = base.map(([p, v, pre]): Point => [p, p >= '2026-06' ? v * 1.2 : v, pre]);
    const r = checkUpdate(prev, file('2026-08', { A: revised }));
    expect(r.ok).toBe(true);
    expect(r.notes).toContain('1 series with revised months, 0 with months added.');
  });

  test('a jump bigger than the monthly limit needs review', () => {
    const prev = file('2026-08', { A: base });
    const jump = 106 * (1 + (LIMITS.monthlyMovePct + 5) / 100);
    const r = checkUpdate(prev, file('2026-09', { A: [...base, ['2026-09', jump, true]] }));
    expect(r.ok).toBe(false);
    expect(r.issues[0]).toContain('in one month');
  });

  test('rewriting old history needs review (a rebased series)', () => {
    const prev = file('2026-08', { A: base });
    const rebased = base.map(([p, v, pre]): Point => [p, v / 2, pre]);
    const r = checkUpdate(prev, file('2026-08', { A: rebased }));
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.includes('2025-12'))).toBe(true);
  });

  test('a missing series or a month going backwards needs review', () => {
    const prev = file('2026-08', { A: base, B: base });
    expect(checkUpdate(prev, file('2026-08', { A: base })).ok).toBe(false);
    expect(checkUpdate(prev, file('2026-07', { A: base, B: base })).ok).toBe(false);
  });

  test('the command line exits 2 and writes the reasons when a check fails', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ppi-'));
    writeFileSync(join(dir, 'prev.json'), JSON.stringify(file('2026-08', { A: base, B: base })));
    writeFileSync(join(dir, 'next.json'), JSON.stringify(file('2026-08', { A: base })));
    let code = 0;
    try {
      execFileSync('node', [
        'scripts/prices/check-update.mjs',
        join(dir, 'prev.json'),
        join(dir, 'next.json'),
        '--summary',
        join(dir, 'summary.md'),
      ]);
    } catch (e) {
      code = (e as { status: number }).status;
    }
    expect(code).toBe(2);
  });

  test('the real data file passes against itself', () => {
    expect(checkUpdate(PPI, PPI).ok).toBe(true);
  });
});

test.describe('price page URLs', () => {
  test('cover the hub, every material, every report and the methodology', () => {
    const paths = pricePaths();
    expect(paths).toContain('/prices/');
    expect(paths).toContain('/prices/reports/');
    expect(paths).toContain('/prices/methodology/');
    for (const m of MATERIALS) expect(paths).toContain(`/prices/${m.slug}/`);
    for (const p of reportMonths()) expect(paths).toContain(`/prices/reports/${p}/`);
    expect(paths).toHaveLength(3 + MATERIALS.length + reportMonths().length);
  });

  test('carry the date the data last changed', () => {
    expect(priceDataDate()).toBe(PPI.fetchedAt.slice(0, 10));
  });
});
