// Docs screenshots for Getting Started, Products, Documents, Calendar and
// Reports, written as retina PNGs straight into
// public/docs-screenshots/<area>/<name>.png (the paths the docs embed from).
//
// Together with docs-settings and docs-areas2 this covers every docs
// screenshot; the old docs-screenshots / -tail / docs-media-tail scenes (icon-
// rail selectors) were removed so they can't overwrite these.
//
// Read-only: dialogs and editors are opened and shot without saving, and the
// CSV wizard parses its sample client-side and is never saved. Records owned by
// the video scenes (the Pelican schedule, the SYS-RTU10 kit) are displayed,
// never changed.
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findProject } from '../lib/demo-change-orders.mjs';

export const meta = { name: 'docs-general', video: false, viewport: 'desktop', strict: true };

const PUBLIC_DIR = fileURLToPath(new URL('../../public/docs-screenshots/', import.meta.url));
const VIEWPORT = { width: 1440, height: 900 };
const PROJECT = 'Pelican Restaurant — Rooftop Replacement';

// A supplier price sheet, as an estimator would get it — what the CSV import
// template wizard is for.
const SAMPLE_CSV = [
  'Item,Description,Model,Qty,Unit Cost',
  'RTU-1,10-Ton Packaged Rooftop Unit,48FC-12,2,11400.00',
  'CA-1,Curb Adapter 10-Ton,CRBADPT-10,2,1185.00',
  'DSC-1,AC Disconnect 60A w/ Whip,DS60-W,2,38.00',
  'TS-1,Programmable Thermostat,T6-PRO,2,189.00',
  'CP-1,Condensate Pump,CP-115,2,52.00',
].join('\n');

export async function setup({ api }) {
  const project = await findProject(api, PROJECT);
  return { projectId: project.id };
}

export default async function scene({ page, goto, wait, log, data }) {
  const cap = async (area, name, opts = {}) => {
    const dir = `${PUBLIC_DIR}${area}`;
    await mkdir(dir, { recursive: true });
    await page.screenshot({ path: `${dir}/${name}.png`, ...opts });
    log(`  📸 docs-screenshots/${area}/${name}.png`);
  };

  // Screenshot an element plus `pad` px of page context, kept inside the viewport.
  const capAround = async (area, name, target, pad = 60) => {
    const box = await page.locator(target).first().boundingBox();
    if (!box) throw new Error(`no boundingBox for ${target}`);
    const x = Math.max(0, box.x - pad);
    const y = Math.max(0, box.y - pad);
    await cap(area, name, {
      clip: {
        x,
        y,
        width: Math.min(VIEWPORT.width - x, box.width + pad * 2),
        height: Math.min(VIEWPORT.height - y, box.height + pad * 2),
      },
    });
  };

  // Wait past skeletons and the "Loading…" placeholder.
  const ready = async (anchor, timeout = 30_000) => {
    await page.locator(anchor).first().waitFor({ state: 'visible', timeout });
    await page
      .waitForFunction(
        () => {
          const main = document.querySelector('main');
          return (
            main &&
            !main.querySelector('[class*="animate-pulse"]') &&
            !/^\s*Loading/m.test(main.innerText)
          );
        },
        null,
        { timeout: 15_000 }
      )
      .catch(() => {});
    await wait(800);
  };

  // ── Getting started: dashboard ──────────────────────────────────────────
  await goto('/dashboard', 600);
  await ready('main >> text=Needs you today');
  await ready('main >> text=Overdue AR');
  await cap('getting-started', 'dashboard');

  // ── Getting started: command palette ────────────────────────────────────
  await page.keyboard.press('Meta+k');
  const search = page.locator('[role="dialog"] input').first();
  await search.waitFor({ state: 'visible', timeout: 8000 });
  await search.fill('chiller');
  await page.locator('[role="dialog"] >> text=Top matches').first().waitFor({ state: 'visible', timeout: 10_000 });
  await wait(1200);
  await cap('getting-started', 'command-palette-search');
  await page.keyboard.press('Escape');
  await wait(400);

  // ── Getting started: New Project dialog (closed, never saved) ───────────
  await goto('/projects', 600);
  await ready('main button:has-text("New Project")');
  await page.locator('main button:has-text("New Project")').first().click();
  const newProject = '[role="dialog"]:has-text("New Project")';
  await page.locator(newProject).first().waitFor({ state: 'visible', timeout: 8000 });
  await wait(700);
  await capAround('getting-started', 'new-project-dialog', newProject, 40);
  await page.keyboard.press('Escape');
  await wait(400);

  // ── Getting started: a project's detail page and its tabs ───────────────
  await goto(`/projects/${data.projectId}`, 600);
  await ready('main [role="tab"]:has-text("Plan")');
  await ready('main >> text=Contract & billing');
  await cap('getting-started', 'project-detail-tabs');

  // ── Products: catalog list ──────────────────────────────────────────────
  await goto('/products', 600);
  await ready('main table tbody tr:has-text("SYS-RTU10")');
  await cap('products', 'products-list');

  // ── Products: kit components editor (Add Component form open, unsaved) ──
  await page.locator('main table tbody tr:has-text("SYS-RTU10")').first().click();
  await ready('main h3:text-is("Kit Components")');
  const kitCard = page.locator('div.rounded-xl.border:has(h3:text-is("Kit Components"))').last();
  await kitCard.scrollIntoViewIfNeeded();
  await wait(500);
  const addComponent = kitCard.locator('button:has-text("Add Component")').first();
  if (await addComponent.isVisible().catch(() => false)) {
    await addComponent.click();
    await wait(700);
  }
  await kitCard.evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await wait(600);
  await cap('products', 'kit-components-editor');

  // ── Documents: library ──────────────────────────────────────────────────
  await goto('/documents', 600);
  await ready('main >> text=Recent files');
  await cap('documents', 'documents-list');

  // ── Documents: CSV import template wizard, Map columns step ─────────────
  const csvPath = join(tmpdir(), 'bwp-rtu-supplier-sheet.csv');
  await writeFile(csvPath, SAMPLE_CSV, 'utf8');
  await goto('/settings/csv-import-templates/new', 600);
  const fileInput = page.locator('input[type="file"]');
  await fileInput.waitFor({ state: 'attached', timeout: 15_000 });
  await fileInput.setInputFiles(csvPath);
  await ready('main >> text=Map columns');
  await cap('documents', 'csv-import-template-wizard');

  // ── Calendar: month view. Project bars span whole weeks and crowd out
  //    everything else, so hide the Projects and Activities types via the
  //    legend (component state only) to show tasks, phases, leads and bids.
  await goto('/calendar', 600);
  await ready('main button:has-text("Month")');
  for (const type of ['Projects', 'Activities']) {
    await page.locator(`main button:text-is("${type}")`).last().click();
    await wait(500);
  }
  await wait(900);
  await cap('calendar', 'calendar-month');

  // ── Reports: Business review, year to date. (The default This Week, and a
  //    quarter only a week old, read Collected $0 for most of the period.) ──
  await goto('/reports?preset=ytd&compare=0', 600);
  await ready('main >> text=Billed vs collected');
  await wait(800);
  await cap('reports', 'reports');
}
