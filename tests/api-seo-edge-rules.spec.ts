import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { TEMPLATE_LIST } from '../src/data/templates';
import { contentLastmod } from '../src/integrations/sitemapLastmod';

/**
 * The crawl-hygiene rules src/integrations/seoEdgeRules.ts writes into
 * _headers/_redirects, and the sitemap lastmod from src/integrations/sitemapLastmod.ts.
 *
 * Runs under the `api` project (astro preview → wrangler → workerd) because
 * both edge files are applied by the Workers asset server, which the dev
 * server does not emulate, and the sitemap only exists in the build.
 */

type ManifestFiles = Record<string, { file: string }>;

function manifestFiles(slug: string): string[] {
  const manifest = JSON.parse(
    readFileSync(new URL(`../src/data/templates-manifest/${slug}.json`, import.meta.url), 'utf-8')
  ) as { files: ManifestFiles };
  return Object.values(manifest.files).map((f) => f.file);
}

test.describe('un-slashed URLs', () => {
  for (const path of [
    '/pricing/',
    '/templates/aia-g702-g703/',
    '/blog/retainage-construction-guide/',
    '/docs/bids/rates/',
    '/tools/pay-app/',
  ]) {
    test(`${path.slice(0, -1)} is a permanent redirect to ${path}`, async ({ request }) => {
      const response = await request.get(path.slice(0, -1), { maxRedirects: 0 });
      expect(response.status()).toBe(301);
      expect(new URL(response.headers()['location'], 'http://x').pathname).toBe(path);

      const page = await request.get(path, { maxRedirects: 0 });
      expect(page.status()).toBe(200);
    });
  }

  test('the edge rule files are not served', async ({ request }) => {
    for (const path of ['/_redirects', '/_headers']) {
      const response = await request.get(path, { maxRedirects: 0, failOnStatusCode: false });
      expect(response.status(), path).toBe(404);
    }
  });
});

test.describe('dead URLs Google still crawls', () => {
  const cases: [string, string][] = [
    ['/api/recipes/01-import-contacts-from-csv/', '/api/'],
    ['/api/jobs/', '/api/'],
    ['/api/webhooks/', '/api/webhooks/overview/'],
    ['/blog/prevail-wage-certified-payroll/', '/blog/prevailing-wage-certified-payroll/'],
    ['/blog/bid-bond-vs-performance-bond-a-subs-guide/', '/blog/bid-bonds-vs-performance-bonds/'],
  ];
  for (const [from, to] of cases) {
    test(`${from} → ${to}`, async ({ request }) => {
      const response = await request.get(from, { maxRedirects: 0 });
      expect(response.status()).toBe(301);
      expect(new URL(response.headers()['location'], 'http://x').pathname).toBe(to);
    });
  }
});

test.describe('template downloads canonicalize to their landing page', () => {
  for (const t of TEMPLATE_LIST) {
    test(t.slug, async ({ request }) => {
      for (const file of manifestFiles(t.slug)) {
        const response = await request.head(`/templates-files/${file}`);
        expect(response.status(), file).toBe(200);
        expect(response.headers()['link'], file).toBe(
          `<https://buildworkpro.com/templates/${t.slug}/>; rel="canonical"`
        );
      }
    });
  }
});

test.describe('sitemap lastmod', () => {
  test('blog posts and templates carry their published content date; other pages none', async ({
    request,
  }) => {
    const xml = await (await request.get('/sitemap-0.xml')).text();
    const entries = new Map(
      [...xml.matchAll(/<url><loc>([^<]+)<\/loc>(?:<lastmod>([^<]+)<\/lastmod>)?/g)].map((m) => [
        new URL(m[1]).pathname,
        m[2],
      ])
    );
    const expected = contentLastmod();
    expect(expected.size).toBeGreaterThan(50);
    for (const [path, date] of expected) {
      expect(entries.get(path), path).toBe(`${date}T00:00:00.000Z`);
    }
    expect(entries.get('/features/')).toBeUndefined();
    expect(entries.get('/')).toBeUndefined();
  });
});
