// #196 follow-up — media tail for the docs site: Bids (rates, project costs,
// PDF preview, templates, send dialog), Products (kit editor), Documents (CSV
// import template wizard), Getting Started (new-project dialog, project detail,
// command palette). Writes retina PNGs straight into
// public/docs-screenshots/<area>/<name>.png, same as docs-screenshots.shots.mjs.
//
// READ-ONLY by design: dialogs are opened, screenshotted, and closed without
// saving/sending. The only "input" is typing into dialog fields and uploading a
// sample CSV to the template wizard (client-side parse; nothing persists until
// the wizard's final Save, which is never clicked).
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const meta = { name: 'docs-media-tail', video: false, viewport: 'desktop' };

const PUBLIC_DIR = fileURLToPath(new URL('../../public/docs-screenshots/', import.meta.url));
const VIEWPORT = { width: 1440, height: 900 };

const SAMPLE_CSV = [
  'Mark,Description,Model,Qty,Unit Cost',
  'AC-1,3-Ton Condenser 14 SEER,XR14-036,2,1845.00',
  'AC-2,4-Ton Condenser 14 SEER,XR14-048,1,2150.00',
  'AH-1,3-Ton Air Handler w/ Heat Kit,TEM4-036,2,1150.00',
  'TS-1,Smart Thermostat,XL824,3,265.00',
  'LS-1,Line Set 3/8 x 7/8 x 50ft,LS-3878-50,3,189.00',
].join('\n');

export default async function scene({ page, goto, click, type, wait, log }) {
  const capFull = async (area, name) => {
    const dir = `${PUBLIC_DIR}${area}`;
    await mkdir(dir, { recursive: true });
    await page.screenshot({ path: `${dir}/${name}.png` });
    log(`  📸 docs-screenshots/${area}/${name}.png`);
  };

  // Screenshot a dialog (or any element) plus `pad` px of page context.
  const capClip = async (area, name, target, pad = 90) => {
    const loc = page.locator(target).first();
    await loc.waitFor({ state: 'visible', timeout: 8000 });
    const box = await loc.boundingBox();
    if (!box) throw new Error(`no boundingBox for ${target}`);
    const x = Math.max(0, box.x - pad);
    const y = Math.max(0, box.y - pad);
    const clip = {
      x,
      y,
      width: Math.min(VIEWPORT.width - x, box.width + pad * 2),
      height: Math.min(VIEWPORT.height - y, box.height + pad * 2),
    };
    const dir = `${PUBLIC_DIR}${area}`;
    await mkdir(dir, { recursive: true });
    await page.screenshot({ path: `${dir}/${name}.png`, clip });
    log(`  📸 docs-screenshots/${area}/${name}.png (clipped)`);
  };

  const step = async (label, fn) => {
    try {
      await fn();
      log(`  ✓ ${label}`);
    } catch (err) {
      log(`  ✗ ${label}: ${err.message}`);
    }
  };

  // ───────────────────────── Bids (a DRAFT bid, picked from the list) ─────
  await goto('/bids', 1400);
  await page.locator('table tbody tr').first().waitFor({ state: 'visible', timeout: 15000 });
  await click('table tbody tr:has-text("Draft")');
  await wait(1400);
  await page.locator('[role="tab"]').first().waitFor({ state: 'visible', timeout: 15000 });

  await step('bids/rates tab', async () => {
    await click('[role="tab"]:has-text("Rates")');
    await wait(900);
    await page.locator('text=Rate Settings').first().waitFor({ state: 'visible', timeout: 8000 });
    await capFull('bids', 'bid-rates-tab');
  });

  await step('bids/project costs tab (Add Cost form open, never saved)', async () => {
    await click('[role="tab"]:has-text("Project Costs")');
    await wait(700);
    await click('button:has-text("Add Cost")');
    const addRow = 'tr:has(textarea[placeholder="Description..."])';
    await page.locator(addRow).waitFor({ state: 'visible', timeout: 6000 });
    // Pick a product in the row's combobox (read-only search; selecting is local)
    await click(`${addRow} button[role="combobox"]`);
    const item = page.locator('[cmdk-item]').first();
    await item.waitFor({ state: 'visible', timeout: 6000 });
    const input = page.locator('[cmdk-input]').first();
    await input.fill('installation');
    await wait(900);
    if ((await page.locator('[cmdk-item]').count()) === 0) {
      await input.fill('');
      await wait(900);
    }
    await click(page.locator('[cmdk-item]').first());
    // fill() replaces the values the product selection prefilled
    await page.locator(`${addRow} textarea`).fill('Job-site mobilization & equipment staging');
    await page.locator(`${addRow} input[type="number"]`).fill('850');
    await wait(400);
    await capFull('bids', 'bid-project-costs-tab');
    await click(`${addRow} button[title="Cancel"]`); // discard the draft row
  });

  await step('bids/save-as-template dialog (cancelled)', async () => {
    await click('[role="tab"]:has-text("Estimate")');
    await wait(700);
    await click('button:has-text("Save Template")');
    const dialog = '[role="dialog"]:has-text("Save as Template")';
    await page.locator(dialog).waitFor({ state: 'visible', timeout: 6000 });
    await type(`${dialog} input`, 'Standard 3-Ton System Replacement');
    await type(`${dialog} textarea`, 'Condenser, air handler, line set, and standard install labor.');
    await wait(300);
    await capClip('bids', 'bid-save-template-dialog', dialog);
    await click(`${dialog} button:has-text("Cancel")`);
    await wait(400);
  });

  await step('bids/pdf preview dialog', async () => {
    // NOTE: run with CAPTURE_HEADFUL=1 — headless Chromium has no built-in PDF
    // viewer, so the preview iframe renders blank when headless.
    await click('button:has-text("Preview")');
    await page
      .locator('iframe[data-testid="pdf-preview-iframe"]')
      .waitFor({ state: 'visible', timeout: 20000 });
    await wait(2600); // let the PDF render inside the iframe
    await capClip('bids', 'bid-pdf-preview', '[role="dialog"]', 60);
    await page.keyboard.press('Escape');
    await wait(500);
  });

  await step('bids/send dialog (closed, never sent)', async () => {
    await click('button:has-text("Send Bid")'); // action-bar button
    const dialog = '[role="dialog"]:has-text("Send Bid")';
    await page.locator(dialog).waitFor({ state: 'visible', timeout: 8000 });
    await wait(1400); // recipient/template prefill
    await capClip('bids', 'bid-send-dialog', dialog, 70);
    await page.keyboard.press('Escape');
    await wait(500);
  });

  // ─────────────────────── Getting started: projects ──────────────────────
  await goto('/projects', 1400);

  await step('getting-started/new project dialog (cancelled)', async () => {
    await click('button:has-text("New Project")');
    const dialog = '[role="dialog"]:has-text("New Project")';
    await page.locator(dialog).waitFor({ state: 'visible', timeout: 8000 });
    await wait(700);
    await capClip('getting-started', 'new-project-dialog', dialog, 60);
    await page.keyboard.press('Escape');
    await wait(500);
  });

  await step('getting-started/project detail tabs', async () => {
    // Project cards render as buttons titled "Name — Type" (em dash).
    const row = page.locator('button:has-text("—")').first();
    await row.waitFor({ state: 'visible', timeout: 8000 });
    await row.click();
    await wait(1400);
    await page.locator('[role="tab"]').first().waitFor({ state: 'visible', timeout: 10000 });
    await capFull('getting-started', 'project-detail-tabs');
  });

  // ─────────────────── Getting started: command palette ───────────────────
  await step('getting-started/command palette with results', async () => {
    await goto('/dashboard', 1200);
    await page.keyboard.press('Meta+k');
    const input = page.locator('input[placeholder="Search everything..."]');
    await input.waitFor({ state: 'visible', timeout: 6000 });
    await input.fill('bid');
    await wait(1600); // debounce + search results
    await capFull('getting-started', 'command-palette-search');
    await page.keyboard.press('Escape');
  });

  // ──────────────── Documents: CSV import template wizard ─────────────────
  await step('documents/csv import template wizard (step 2, never saved)', async () => {
    const csvPath = join(tmpdir(), 'bwp-sample-vendor.csv');
    await writeFile(csvPath, SAMPLE_CSV, 'utf8');
    await goto('/settings/csv-import-templates/new', 1600);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.waitFor({ state: 'attached', timeout: 10000 });
    await fileInput.setInputFiles(csvPath);
    await wait(1600);
    await page.locator('text=Map columns').first().waitFor({ state: 'visible', timeout: 8000 });
    await capFull('documents', 'csv-import-template-wizard');
  });

  // ───────── Products: kit components editor (LAST — leaves a dirty, ──────
  // ───────── unsaved form; the scene ends without saving anything) ────────
  await step('products/kit components editor (unsaved)', async () => {
    await goto('/products', 1400);
    const row = page.locator('table tbody tr:has-text("Heat Kit")').first();
    await row.waitFor({ state: 'visible', timeout: 8000 });
    await row.click();
    await wait(1400);
    // Toggle the (unsaved) kit checkbox to reveal the components editor.
    await click('#isKit');
    await page.locator('text=Kit Components').first().waitFor({ state: 'visible', timeout: 6000 });
    await click('button:has-text("Add First Component")');
    const form = 'div:has(> h4:has-text("Add Component"))';
    await page.locator(form).first().waitFor({ state: 'visible', timeout: 6000 });
    await click(`${form} button[role="combobox"]`);
    const input = page.locator('[cmdk-input]').first();
    await input.waitFor({ state: 'visible', timeout: 6000 });
    await input.fill('condenser');
    await wait(900);
    if ((await page.locator('[cmdk-item]').count()) === 0) {
      await input.fill('');
      await wait(900);
    }
    await click(page.locator('[cmdk-item]').first());
    await wait(500);
    await page
      .locator('text=Kit Components')
      .first()
      .scrollIntoViewIfNeeded()
      .catch(() => {});
    await wait(400);
    await capFull('products', 'kit-components-editor');
  });
}
