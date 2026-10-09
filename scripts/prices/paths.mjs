// Every public URL the BLS price data drives, and the date the data last
// changed. Shared by scripts/indexnow.mjs (submit the pages after a data
// update) and src/integrations/sitemapLastmod.ts (lastmod for those pages), so
// both always agree with what the site builds.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (root, file) => readFileSync(join(root, file), 'utf8');

function addMonths(period, months) {
  const [y, m] = period.split('-').map(Number);
  const idx = y * 12 + (m - 1) + months;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
}

/** Slashed paths: hub, material pages, report archive, every report, methodology. */
export function pricePaths(root = process.cwd()) {
  const data = JSON.parse(read(root, 'src/data/prices/ppi.json'));
  const slugs = [
    ...read(root, 'src/data/prices/materials.ts').matchAll(/slug: '([a-z0-9-]+)'/g),
  ].map((m) => m[1]);
  const first = read(root, 'src/lib/prices/ppi.ts').match(/FIRST_REPORT = '(\d{4}-\d{2})'/)?.[1];
  if (!first || !slugs.length)
    throw new Error('pricePaths: could not read materials or FIRST_REPORT');
  const months = [];
  for (let p = data.latest; p >= first; p = addMonths(p, -1)) months.push(p);
  return [
    '/prices/',
    ...slugs.map((s) => `/prices/${s}/`),
    '/prices/reports/',
    ...months.map((p) => `/prices/reports/${p}/`),
    '/prices/methodology/',
  ];
}

/** YYYY-MM-DD the data file was last written (fetch-ppi only writes on a change). */
export function priceDataDate(root = process.cwd()) {
  return JSON.parse(read(root, 'src/data/prices/ppi.json')).fetchedAt.slice(0, 10);
}

/** Source files whose change should re-submit every price page. */
export const PRICE_SOURCES = [
  'src/data/prices/ppi.json',
  'src/data/prices/series.json',
  'src/data/prices/materials.ts',
  'src/data/prices/commentary.ts',
  'src/lib/prices/ppi.ts',
];
