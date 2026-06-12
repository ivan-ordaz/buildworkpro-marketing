// docs/21-media-tail — screenshots for the remaining docs pages: Projects
// (phases-tasks, documents tab, templates panel), Pay Apps (approval, PDF
// preview), Change Orders (approval), CRM (lead detail), Calendar (month view),
// Field (log-time dialog). Writes retina PNGs straight into
// public/docs-screenshots/<area>/<name>.png, same as docs-screenshots.shots.mjs.
//
// READ-ONLY by design: dialogs are opened, screenshotted, and closed without
// saving. Nothing is submitted, approved, rejected, or persisted.
//
// NOTE: run with CAPTURE_HEADFUL=1 — the pay-app PDF preview embeds the PDF in
// an <iframe>, and headless Chromium has no PDF viewer (the pane stays blank).
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const meta = { name: 'docs-screenshots-tail', video: false, viewport: 'desktop' };

const PUBLIC_DIR = fileURLToPath(new URL('../../public/docs-screenshots/', import.meta.url));
const VIEWPORT = { width: 1440, height: 900 };

export default async function scene({ page, goto, click, wait, log }) {
  const capFull = async (area, name) => {
    const dir = `${PUBLIC_DIR}${area}`;
    await mkdir(dir, { recursive: true });
    await page.screenshot({ path: `${dir}/${name}.png` });
    log(`  📸 docs-screenshots/${area}/${name}.png`);
  };

  // Screenshot a dialog (or any element) plus `pad` px of page context.
  const capClip = async (area, name, target, pad = 60) => {
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

  // Wait for a selector before shooting — never waitForLoadState ('load'/
  // 'networkidle' hang on the app's persistent Socket.IO connection).
  const ready = async (sel, timeout = 20000) => {
    await page.locator(sel).first().waitFor({ state: 'visible', timeout });
    await wait(700);
  };

  // ── Projects: Phases & Tasks tab, then Documents tab ──────────────────────
  await step('projects/phases-tasks + project-documents', async () => {
    await goto('/projects', 1400);
    await ready('main button[class*="cursor-pointer"]');
    await click('main button[class*="cursor-pointer"]'); // board cards navigate via onClick
    await ready('[role="tab"]:has-text("Phases & Tasks")');
    await click('[role="tab"]:has-text("Phases & Tasks")');
    await ready('button:has-text("Add Phase")');
    await capFull('projects', 'phases-tasks');

    await click('[role="tab"]:has-text("Documents")');
    await ready('main h3:has-text("Documents"), main h2:has-text("Documents")');
    await capFull('projects', 'project-documents');
  });

  // ── Projects: Project Templates settings panel ─────────────────────────────
  await step('projects/project-templates panel', async () => {
    await goto('/settings#workspace.project-templates', 1200);
    await ready('main button:has-text("Create Template")');
    await capFull('projects', 'project-templates');
  });

  // ── Pay apps: submitted detail (approval actions), then PDF preview ───────
  await step('pay-apps/approval + pdf preview', async () => {
    await goto('/pay-apps', 1400);
    await ready('table tbody tr');
    await click('table tbody tr:has-text("Submitted")'); // pick an approvable one
    await ready('button:has-text("Approve")'); // present, but NEVER clicked
    await capFull('pay-apps', 'pay-app-approval');

    await click('button:has-text("Preview")');
    await ready('iframe[data-testid="pdf-preview-iframe"]', 20000);
    await wait(3500); // let the PDF viewer paint inside the iframe
    await capClip('pay-apps', 'pay-app-pdf-preview', '[role="dialog"]');
    await page.keyboard.press('Escape');
    await wait(500);
  });

  // ── Change orders: submitted detail (approval actions) ────────────────────
  await step('change-orders/approval', async () => {
    await goto('/change-orders', 1400);
    await ready('table tbody tr');
    await click('table tbody tr:has-text("Submitted")');
    await ready('main h1');
    await wait(800);
    await capFull('change-orders', 'change-order-approval');
  });

  // ── CRM: lead detail ───────────────────────────────────────────────────────
  await step('crm/lead-detail', async () => {
    await goto('/leads', 1400);
    await ready('main h4[class*="cursor-pointer"]');
    // Kanban cards navigate via onClick, but dnd-kit occasionally swallows the
    // first synthetic click as a drag start — retry until the route changes.
    for (let i = 0; i < 3 && page.url().endsWith('/leads'); i++) {
      await click('main h4[class*="cursor-pointer"]');
      await wait(1200);
    }
    await ready('main h3:has-text("Lead Information")'); // CardTitle renders an <h3>
    await capFull('crm', 'lead-detail');
  });

  // ── Calendar: month view with events ──────────────────────────────────────
  await step('calendar/calendar-month', async () => {
    await goto('/calendar', 1400);
    await ready('main h1:has-text("Calendar")');
    await wait(2000); // events populate after the grid renders
    await capFull('calendar', 'calendar-month');
  });

  // ── Field: Log Time dialog (cancelled, never saved) ───────────────────────
  await step('field/log-time-dialog', async () => {
    await goto('/time-tracking', 1400);
    await ready('main h1:has-text("Time Tracking")');
    await click('button:has-text("Log Time")');
    await ready('[role="dialog"]');
    await capClip('field', 'log-time-dialog', '[role="dialog"]');
    await page.keyboard.press('Escape'); // close without saving
  });
}
