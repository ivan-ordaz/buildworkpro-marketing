// <lastmod> for the sitemap, taken only from dates the pages already publish:
// a blog post's dateModified (else datePublished) on <BlogPostFooter>, and a
// template page's `updated` on <TemplatePage>. Those are the same dates the
// pages print and put in their JSON-LD, so lastmod changes exactly when the
// content does. Google only trusts lastmod that is consistently accurate, so
// pages without such a date get none — git dates would be wrong on the shallow
// clones CI and Cloudflare build from.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { priceDataDate, pricePaths } from '../../scripts/prices/paths.mjs';

type Section = { dir: string; urlPrefix: string; attrs: string[] };

const SECTIONS: Section[] = [
  { dir: 'src/pages/blog', urlPrefix: '/blog/', attrs: ['dateModified', 'datePublished'] },
  { dir: 'src/pages/templates', urlPrefix: '/templates/', attrs: ['updated'] },
];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** First attribute in `attrs` order that carries an ISO date in `source`. */
export function pickDate(source: string, attrs: readonly string[]): string | undefined {
  for (const attr of attrs) {
    const match = source.match(new RegExp(`\\b${attr}="([^"]+)"`));
    if (match && ISO_DATE.test(match[1])) return match[1];
  }
  return undefined;
}

/** Map of URL pathname (slashed) → YYYY-MM-DD. */
export function contentLastmod(root: string = process.cwd()): Map<string, string> {
  const dates = new Map<string, string>();
  for (const { dir, urlPrefix, attrs } of SECTIONS) {
    for (const file of readdirSync(path.join(root, dir))) {
      if (!file.endsWith('.astro') || file === 'index.astro') continue;
      const date = pickDate(readFileSync(path.join(root, dir, file), 'utf-8'), attrs);
      if (date) dates.set(`${urlPrefix}${file.replace(/\.astro$/, '')}/`, date);
    }
  }
  // The /prices/ pages change when the BLS data does, and the methodology page
  // prints that date ("last pulled on …"); fetch-ppi only rewrites the file when
  // the data changed, so the date is exact.
  const pricesDate = priceDataDate(root);
  for (const p of pricePaths(root)) dates.set(p, pricesDate);
  return dates;
}
