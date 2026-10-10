import { test, expect } from '@playwright/test';
import { TEMPLATE_LIST } from '../src/data/templates';
import { TOOLS } from '../src/data/tools';
import { reportMonths } from '../src/lib/prices/ppi';

// The header's Resources menu puts the free templates, tools and material price
// pages on every page. At 1024px the header had no spare width before the menu
// replaced the Templates link, so the layout check guards against overlap.

const HUBS = ['/templates/', '/tools/', '/prices/'];
const menu = (page: import('@playwright/test').Page) =>
  page.locator('header nav[aria-label="Primary"] [data-resources-menu]');

test.describe('header Resources menu', () => {
  test('opens on hover with the three hubs and links that all resolve', async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await menu(page).locator('button').hover();
    for (const hub of HUBS) await expect(menu(page).locator(`a[href="${hub}"]`)).toBeVisible();
    await expect(menu(page)).toContainText(`All ${TEMPLATE_LIST.length} templates`);
    await expect(menu(page)).toContainText(`All ${TOOLS.length} tools`);
    await expect(
      menu(page).locator(`a[href="/prices/reports/${reportMonths()[0]}/"]`)
    ).toBeVisible();
    const hrefs = await menu(page)
      .locator('a')
      .evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    expect(hrefs.length).toBe(18);
    for (const href of hrefs) expect((await request.get(href!)).status(), href!).toBe(200);
  });

  test('every header dropdown opens from the keyboard', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const dropdowns = page.locator('header nav[aria-label="Primary"] [class~="group/menu"]');
    expect(await dropdowns.count()).toBe(4); // Features, Solutions, Compare, Resources
    for (const dd of await dropdowns.all()) {
      await dd.locator('button').focus();
      await expect(dd.locator('a').first()).toBeVisible();
    }
  });

  for (const width of [1024, 1280, 1440]) {
    test(`fits at ${width}px: nothing overlaps and the open panel stays on screen`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      const box = async (sel: string) => (await page.locator(sel).first().boundingBox())!;
      const logo = await box('header img');
      const nav = await box('header nav[aria-label="Primary"]');
      const login = await box('header a:text-is("Log in")');
      // At least 12px of air on each side of the nav, and nothing wraps: one line
      // of "Log in" is about 20px tall, the trial button about 40px.
      expect(nav.x - (logo.x + logo.width)).toBeGreaterThanOrEqual(12);
      expect(login.x - (nav.x + nav.width)).toBeGreaterThanOrEqual(12);
      expect(login.height).toBeLessThan(28);
      expect((await box('header a:text-is("Start free trial")')).height).toBeLessThan(48);
      await menu(page).locator('button').hover();
      const panel = await menu(page).locator('a[href="/templates/aia-g702-g703/"]').boundingBox();
      expect(panel!.x).toBeGreaterThanOrEqual(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    });
  }

  test('the phone menu has a Resources section with every hub', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/');
    await page.locator('#mobile-menu-btn').click();
    const section = page.locator('#mobile-menu [data-resources-mobile]');
    await section.locator('summary').click();
    for (const hub of HUBS) await expect(section.locator(`a[href="${hub}"]`)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
  });
});
