import { test, expect } from '@playwright/test';
import { resourceLink } from '../src/data/resource-links';
import { MATERIALS } from '../src/data/prices/materials';
import { TEMPLATE_LIST } from '../src/data/templates';
import { TOOLS } from '../src/data/tools';

// The free resource sections link to each other: every calculator to its
// siblings and its material's price page, every relevant template to its
// calculators and price trends, and the three hubs to one another. Without
// these, a new calculator is reachable only from the hub.

const CALCULATORS = TOOLS.filter((t) => t.group === 'Calculators');
const isTool = (href: string) => TOOLS.some((t) => t.href === href);

test.describe('resource link data', () => {
  test('every tool and template link resolves to a real page', () => {
    for (const t of TOOLS)
      for (const href of t.related ?? []) expect(resourceLink(href).href).toBe(href);
    for (const t of TEMPLATE_LIST)
      for (const href of t.resources ?? []) expect(resourceLink(href).href).toBe(href);
    expect(() => resourceLink('/tools/no-such-calculator/')).toThrow();
  });

  test('every calculator links at least two other tools and never itself', () => {
    for (const t of CALCULATORS) {
      const tools = (t.related ?? []).filter(isTool);
      expect(tools, t.href).not.toContain(t.href);
      expect(tools.length, t.href).toBeGreaterThanOrEqual(2);
    }
  });

  test('every material price page is linked from a calculator or a template', () => {
    const linked = new Set([
      ...TOOLS.flatMap((t) => t.related ?? []),
      ...TEMPLATE_LIST.flatMap((t) => t.resources ?? []),
    ]);
    const unlinked = MATERIALS.filter(
      (m) => !linked.has(`/prices/${m.slug}/`) && !['glass'].includes(m.slug)
    );
    // Glass has no calculator or trade template; the glazing contractors page links it.
    expect(unlinked.map((m) => m.slug)).toEqual([]);
  });

  test('price pages link tools and templates that exist', () => {
    for (const m of MATERIALS)
      for (const r of m.related)
        if (/^\/(tools|templates|prices)\//.test(r.href) && r.href !== '/tools/')
          expect(resourceLink(r.href).href, `${m.slug} → ${r.href}`).toBe(r.href);
  });
});

test.describe('resource links on the page', () => {
  for (const t of TOOLS.filter((x) => x.related?.length)) {
    test(`${t.href} links its related tools and price data`, async ({ page }) => {
      await page.goto(t.href);
      for (const href of t.related ?? [])
        await expect(page.locator(`main a[href="${href}"]`).first()).toBeVisible();
    });
  }

  test('templates link their calculators and price trends', async ({ page }) => {
    for (const t of TEMPLATE_LIST.filter((x) => x.resources?.length)) {
      await page.goto(`/templates/${t.slug}/`);
      for (const href of t.resources ?? [])
        await expect(page.locator(`main a[href="${href}"]`).first(), t.slug).toBeVisible();
    }
  });

  test('the tools, templates and prices hubs link to each other', async ({ page }) => {
    const hubs = ['/tools/', '/templates/', '/prices/'];
    for (const hub of hubs) {
      await page.goto(hub);
      for (const other of hubs.filter((h) => h !== hub))
        await expect(
          page.locator(`main a[href="${other}"]`).first(),
          `${hub} → ${other}`
        ).toBeVisible();
    }
  });
});
