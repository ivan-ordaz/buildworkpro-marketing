// #196 — capture the core product screens for the docs site.
// Writes retina PNGs straight into public/docs-screenshots/<area>/<name>.png
// (the path the docs pages embed from), grouped by docs sidebar area.
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const meta = { name: 'docs-screenshots', video: false, viewport: 'desktop' };

const PUBLIC_DIR = fileURLToPath(new URL('../../public/docs-screenshots/', import.meta.url));

export default async function scene({ page, goto, click, wait, log }) {
  const cap = async (area, name) => {
    const dir = `${PUBLIC_DIR}${area}`;
    await mkdir(dir, { recursive: true });
    await page.screenshot({ path: `${dir}/${name}.png` });
    log(`  📸 docs-screenshots/${area}/${name}.png`);
  };

  // Click the first row/card of a list to reach a detail page; return success.
  const openFirst = async (selector) => {
    const loc = page.locator(selector).first();
    if ((await loc.count()) === 0) return false;
    await loc.click().catch(() => {});
    await wait(1100);
    return true;
  };

  // Getting started / home
  await goto('/dashboard');
  await cap('getting-started', 'dashboard');

  // Bids: list + detail (Estimate tab is the default detail view)
  await goto('/bids');
  await cap('bids', 'bids-list');
  if (await openFirst('table tbody tr')) {
    await cap('bids', 'bid-detail');
    if (await click('button:has-text("Estimate"), [role="tab"]:has-text("Estimate")')) {
      await wait(500);
      await cap('bids', 'bid-estimate');
    }
  }

  // Projects: board + detail
  await goto('/projects');
  await cap('projects', 'projects-board');
  if (await openFirst('a[href^="/projects/"], table tbody tr, [data-testid*="project"]')) {
    await cap('projects', 'project-detail');
  }

  // CRM
  await goto('/contacts');
  await cap('crm', 'contacts-list');
  await goto('/pipeline');
  await cap('crm', 'pipeline');

  // Pay apps / change orders
  await goto('/pay-apps');
  await cap('pay-apps', 'pay-apps-list');
  await goto('/change-orders');
  await cap('change-orders', 'change-orders-list');

  // Field operations
  await goto('/site-logs');
  await cap('field', 'site-logs-list');
  await goto('/time-tracking');
  await cap('field', 'time-tracking');

  // Modules that need brand-new docs pages (#30 D1)
  await goto('/products');
  await cap('products', 'products-list');
  await goto('/reports');
  await cap('reports', 'reports');
  await goto('/documents');
  await cap('documents', 'documents-list');

  // Settings hub
  await goto('/settings');
  await cap('settings', 'settings');
}
