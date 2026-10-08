import { test, expect } from '@playwright/test';
import {
  templateFileHeaderRules,
  trailingSlashRedirectRules,
} from '../src/integrations/seoEdgeRules';
import { pickDate } from '../src/integrations/sitemapLastmod';

// Structural SEO guards from the 2026-10-07 review: charset placement,
// breadcrumb structured data, and the docs sidebar no longer fanning out to
// the 247 noindexed API operation pages.

test.describe('charset', () => {
  for (const path of [
    '/',
    '/templates/aia-g702-g703/',
    '/blog/retainage-construction-guide/',
    '/docs/getting-started/introduction/',
  ]) {
    test(`${path} declares utf-8 within the first 1024 bytes`, async ({ request }) => {
      const html = await (await request.get(path)).text();
      const head = Buffer.from(html, 'utf-8').subarray(0, 1024).toString('utf-8');
      expect(head).toMatch(/<meta charset="utf-8"/i);
    });
  }
});

test.describe('BreadcrumbList', () => {
  type Crumb = { name: string; item: string };

  async function crumbs(page: import('@playwright/test').Page, path: string): Promise<Crumb[]> {
    await page.goto(path);
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    for (const block of blocks) {
      const data = JSON.parse(block);
      if (data['@type'] === 'BreadcrumbList') return data.itemListElement;
    }
    throw new Error(`no BreadcrumbList on ${path}`);
  }

  for (const path of [
    '/tools/pay-app/',
    '/customers/national-glass/',
    '/templates/tm-ticket/',
    '/blog/construction-crm-tips/',
    '/features/construction-crm/',
  ]) {
    test(`${path}: every crumb resolves and keeps acronyms`, async ({ page, request }) => {
      const list = await crumbs(page, path);
      expect(new URL(list.at(-1)!.item).pathname).toBe(path);
      for (const crumb of list) {
        const response = await request.get(new URL(crumb.item).pathname);
        expect(response.status(), crumb.item).toBe(200);
        expect(crumb.name, crumb.item).not.toMatch(/\b(Rfi|Aia|Hvac|Crm|Tm|Api)\b/);
      }
    });
  }

  test('template crumbs use the registry title', async ({ page }) => {
    const list = await crumbs(page, '/templates/tm-ticket/');
    expect(list.map((c) => c.name)).toEqual(['Home', 'Templates', 'T&M Ticket Template']);
  });
});

test.describe('docs sidebar', () => {
  const OPERATIONS = 'a[href^="/api/reference/operations/"]';

  test('product docs and developer guides link to the reference, not its operations', async ({
    page,
  }) => {
    for (const path of ['/docs/getting-started/introduction/', '/api/quickstart/']) {
      await page.goto(path);
      await expect(page.locator(OPERATIONS), path).toHaveCount(0);
      await expect(page.locator('nav a[href="/api/reference/"]').first(), path).toBeAttached();
    }
  });

  test('the API reference keeps its full operation tree', async ({ page }) => {
    await page.goto('/api/reference/');
    expect(await page.locator(OPERATIONS).count()).toBeGreaterThan(100);
  });
});

test.describe('edge-rule generators', () => {
  test('one canonical rule per template, refusing basename prefix collisions', () => {
    const rules = templateFileHeaderRules('https://buildworkpro.com', [
      { slug: 'rfi', basename: 'rfi-template' },
    ]);
    expect(rules).toBe(
      '/templates-files/rfi-template*\n  Link: <https://buildworkpro.com/templates/rfi/>; rel="canonical"\n'
    );
    expect(() =>
      templateFileHeaderRules('https://buildworkpro.com', [
        { slug: 'a', basename: 'lien-waiver' },
        { slug: 'b', basename: 'lien-waiver-conditional' },
      ])
    ).toThrow(/prefixes/);
  });

  test('a 301 for every slashed page except the root', () => {
    expect(trailingSlashRedirectRules(['/', '/pricing/', '/docs/bids/rates/'])).toBe(
      '/pricing /pricing/ 301\n/docs/bids/rates /docs/bids/rates/ 301\n'
    );
  });

  test('pickDate prefers dateModified, ignores non-ISO values', () => {
    const src = 'datePublished="2026-06-16"\n dateModified="2026-09-25"';
    expect(pickDate(src, ['dateModified', 'datePublished'])).toBe('2026-09-25');
    expect(pickDate('datePublished="2026-06-16"', ['dateModified', 'datePublished'])).toBe(
      '2026-06-16'
    );
    expect(pickDate('dateModified="{date}"', ['dateModified'])).toBeUndefined();
  });
});
