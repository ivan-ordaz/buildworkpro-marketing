// Docs screenshots for Bids, Projects, Pay Apps, Change Orders, CRM and Field
// (public/docs-screenshots/{bids,projects,pay-apps,change-orders,crm,field}/).
// Retina PNGs at 1440x900 (2880x1800), written straight to the paths the docs
// pages embed; dialogs are clipped with a margin of page context.
//
// Setup stages the records the docs need through the API (lib/demo-docs2.mjs):
// a draft bid priced from cost items, a submitted pay app and change order, a
// fully filled-in lead, a dated project schedule. Nothing is sent, approved or
// saved on camera — dialogs are opened, photographed and dismissed.
//
// SHOTS=name,name limits the run to some shots. The two PDF previews need a
// real browser (headless Chromium has no PDF viewer — the pane stays blank):
//   CAPTURE_HEADFUL=1 SHOTS=bid-pdf-preview,pay-app-pdf-preview node marketing-capture/run.mjs docs-areas2
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { contentReady } from '../lib/cuts.mjs';
import { setTaskView, scrollPage } from '../lib/demo-projects.mjs';
import {
  stageDocsBid,
  stageDocsPayApp,
  stageDocsChangeOrder,
  stageDocsLead,
  stageDocsSchedule,
  findContact,
} from '../lib/demo-docs2.mjs';

export const meta = { name: 'docs-areas2', video: false, viewport: 'desktop', strict: true };

const PUBLIC_DIR = fileURLToPath(new URL('../../public/docs-screenshots/', import.meta.url));
const VIEWPORT = { width: 1440, height: 900 };
const ONLY = process.env.SHOTS ? new Set(process.env.SHOTS.split(',')) : null;
const want = (name) => !ONLY || ONLY.has(name);
const PDF_SHOTS = new Set(['bid-pdf-preview', 'pay-app-pdf-preview']);

export async function setup({ api, log }) {
  const bid = await stageDocsBid(api);
  const payApp = await stageDocsPayApp(api);
  const co = await stageDocsChangeOrder(api);
  const lead = await stageDocsLead(api);
  const schedule = await stageDocsSchedule(api);
  // The Plan tab's List/Gantt choice is a per-user server preference.
  await setTaskView(api, 'list');
  const gc = await findContact(api, 'Keystone Builders Group');
  log(`  ✓ bid ${bid.bidNumber} #${bid.id}, pay app #${payApp.payAppId}, CO ${co.changeOrderNumber} #${co.id}, lead #${lead.id}, schedule on #${schedule.id}`);
  return { bidId: bid.id, payAppId: payApp.payAppId, coId: co.id, leadId: lead.id, projectId: schedule.id, gcEmail: gc.email };
}

export default async function scene({ page, goto, click, type, choose, wait, waitFor, log, data }) {
  const failures = [];
  const ready = async (sel, timeout = 20000) => {
    await waitFor(sel, timeout);
    await contentReady(page);
    await wait(500);
  };
  const noToasts = async () => {
    await page
      .waitForFunction(() => !document.querySelector('[data-sonner-toast], [role="status"] li, li[role="status"]'), null, { timeout: 8000 })
      .catch(() => {});
  };
  const out = async (area, name) => {
    const dir = `${PUBLIC_DIR}${area}`;
    await mkdir(dir, { recursive: true });
    return `${dir}/${name}.png`;
  };
  const capFull = async (area, name) => {
    await noToasts();
    const vp = page.viewportSize();
    await page.mouse.move(vp.width - 2, vp.height - 2);
    await page.screenshot({ path: await out(area, name) });
    log(`  📸 docs-screenshots/${area}/${name}.png`);
  };
  // A dialog (or any element) plus `pad` px of the page around it.
  const capClip = async (area, name, target, pad = 60) => {
    const loc = page.locator(target).first();
    await loc.waitFor({ state: 'visible', timeout: 8000 });
    const box = await loc.boundingBox();
    const vp = page.viewportSize();
    const x = Math.max(0, box.x - pad);
    const y = Math.max(0, box.y - pad);
    const clip = {
      x,
      y,
      width: Math.min(vp.width - x, box.width + pad * 2),
      height: Math.min(vp.height - y, box.height + pad * 2),
    };
    await page.screenshot({ path: await out(area, name), clip });
    log(`  📸 docs-screenshots/${area}/${name}.png (clipped)`);
  };
  // Some screens don't fit 1440x900; shoot them in a taller window.
  const tall = async (height, fn) => {
    await page.setViewportSize({ width: VIEWPORT.width, height });
    try {
      await fn();
    } finally {
      await page.setViewportSize(VIEWPORT);
    }
  };
  const shot = async (name, fn) => {
    if (!want(name)) return;
    if (PDF_SHOTS.has(name) && !process.env.CAPTURE_HEADFUL) {
      log(`  · ${name} skipped (needs CAPTURE_HEADFUL=1)`);
      return;
    }
    try {
      await fn();
    } catch (err) {
      failures.push(name);
      log(`  ✗ ${name}: ${err.message.split('\n')[0]}`);
      await page.keyboard.press('Escape').catch(() => {});
    }
  };

  // ── Bids ─────────────────────────────────────────────────────────────────
  const openBid = async (tab) => {
    await goto(`/bids/${data.bidId}`, 300);
    await ready('main [role="tab"]:has-text("Overview")');
    if (tab) {
      await click(`main [role="tab"]:has-text("${tab}")`);
      await contentReady(page);
      await wait(600);
    }
  };

  await shot('bid-detail', async () => {
    await openBid();
    await ready('main >> text=Bid Details');
    await capFull('bids', 'bid-detail');
  });

  await shot('bid-estimate', () => tall(1500, async () => {
    await openBid('Estimate');
    await click('main button:has-text("Detailed")');
    await wait(600);
    // Expand line 01 to show the cost items under it (the grid also renders a
    // hidden mobile copy of every row, so pick the visible chevron), then put
    // the estimate back at the top so the roll-up cards stay in frame.
    const row = page.locator('main tr:visible', { hasText: 'Demo and haul-off of existing rooftop units' }).first();
    await row.locator('button:has(svg.lucide-chevron-right):visible').first().click();
    // Cost-item descriptions live in inputs, so wait on their values.
    await page.waitForFunction(
      () => [...document.querySelectorAll('main input')].some((i) => i.value === 'Dumpster and disposal' && i.offsetParent),
      null,
      { timeout: 10000 }
    );
    await contentReady(page);
    await scrollPage(page, 0, { settle: 700 });
    await capFull('bids', 'bid-estimate');
  }));

  await shot('bid-rates-tab', async () => {
    await openBid('Pricing');
    await ready('main >> text=Rate Settings');
    await capFull('bids', 'bid-rates-tab');
  });

  await shot('bid-project-costs-tab', async () => {
    await openBid('Project Costs');
    await ready('main >> text=Crane day to set both rooftop units');
    await click('main button:has-text("Add Cost")');
    const addRow = 'main tr:has(textarea[placeholder="Description..."])';
    await waitFor(addRow, 6000);
    await click(`${addRow} button[role="combobox"]`);
    await page.locator('[cmdk-input]').first().fill('Service');
    await wait(900);
    await click('[cmdk-item]:has-text("Service Technician Labor")');
    await page.locator(`${addRow} textarea`).fill('Site supervision, 3 weeks');
    await page.locator(`${addRow} input[type="number"]`).fill('1650');
    await wait(400);
    await capFull('bids', 'bid-project-costs-tab');
    await click(`${addRow} button[title="Cancel"]`);
  });

  await shot('bid-save-template-dialog', async () => {
    await openBid('Estimate');
    await click('main button:has-text("Templates")');
    await click('[role="menuitem"]:has-text("Save as template")');
    const dialog = '[role="dialog"]:has-text("Save as Template")';
    await waitFor(dialog, 6000);
    await type(`${dialog} input`, 'Rooftop unit change-out (2 units)');
    await type(`${dialog} textarea`, 'Demo, two packaged RTUs with curbs, ductwork transitions, controls and startup.');
    await wait(300);
    await capClip('bids', 'bid-save-template-dialog', dialog, 90);
    await click(`${dialog} button:has-text("Cancel")`);
  });

  await shot('bid-pdf-preview', async () => {
    await openBid();
    await click('main button:has-text("Preview")');
    await waitFor('iframe[data-testid="pdf-preview-iframe"]', 30000);
    await wait(3500); // let the PDF render inside the iframe
    await page.evaluate(() => document.activeElement?.blur());
    await capClip('bids', 'bid-pdf-preview', '[role="dialog"]', 60);
    await page.keyboard.press('Escape');
  });

  await shot('bid-send-dialog', () => tall(1180, async () => {
    await openBid();
    await click('main button:has-text("Send Bid")');
    const dialog = '[role="dialog"]:has-text("Send Bid")';
    await waitFor(dialog, 8000);
    // The To line prefills from the customer contact — a seeded demo domain.
    await page.waitForFunction(
      (email) => [...document.querySelectorAll('[role="dialog"] input')].some((i) => i.value.includes(email)),
      data.gcEmail,
      { timeout: 8000 }
    );
    await wait(900);
    // Never sent: the screenshot is taken and the dialog dismissed.
    await capClip('bids', 'bid-send-dialog', dialog, 70);
    await page.keyboard.press('Escape');
  }));

  // ── Projects ─────────────────────────────────────────────────────────────
  await shot('projects-board', async () => {
    await goto('/projects', 300);
    await ready('main h1:has-text("Projects")');
    await click('main button[aria-label="Kanban view"]');
    await ready('main >> text=In Progress');
    await wait(800);
    await capFull('projects', 'projects-board');
    // The view choice is remembered per user; put it back.
    await click('main button[aria-label="Table view"]');
    await wait(600);
  });

  // Taller window: the project header, the Plan tab and the phases in one frame.
  await shot('phases-tasks', () => tall(1250, async () => {
    await goto(`/projects/${data.projectId}#plan`, 300);
    await ready('main >> text=Refrigerant line sets to fan coils');
    await waitFor('main button:has-text("Add Phase")');
    await capFull('projects', 'phases-tasks');
  }));

  await shot('project-documents', async () => {
    await goto(`/projects/${data.projectId}`, 300);
    await ready('main [role="tab"]:has-text("Files")');
    await click('main [role="tab"]:has-text("Files")');
    await ready('main >> text=Signed Contract');
    await capFull('projects', 'project-documents');
  });

  await shot('project-templates', async () => {
    await goto('/settings#workspace.project-templates', 300);
    await ready('main button:has-text("Create Template")');
    await capFull('projects', 'project-templates');
  });

  // ── CRM ──────────────────────────────────────────────────────────────────
  await shot('contacts-list', async () => {
    await goto('/contacts', 300);
    await ready('main >> text=Bayside Construction Group >> visible=true');
    await capFull('crm', 'contacts-list');
  });

  await shot('lead-detail', async () => {
    await goto(`/leads/${data.leadId}`, 300);
    await ready('main >> text=Lead Information');
    await capFull('crm', 'lead-detail');
  });

  await shot('pipeline', async () => {
    await goto('/leads', 300);
    await ready('main >> text=New Lead');
    await capFull('crm', 'pipeline');
  });

  // ── Pay apps ─────────────────────────────────────────────────────────────
  await shot('pay-apps-list', async () => {
    await goto('/pay-apps', 300);
    await ready('main table tbody tr');
    await capFull('pay-apps', 'pay-apps-list');
  });

  await shot('pay-app-approval', async () => {
    await goto(`/pay-apps/${data.payAppId}`, 300);
    await ready('main button:has-text("Approve")');
    await ready('main >> text=Payment Application Summary');
    await capFull('pay-apps', 'pay-app-approval');
  });

  await shot('pay-app-pdf-preview', async () => {
    await goto(`/pay-apps/${data.payAppId}`, 300);
    await ready('main button:has-text("Preview")');
    await click('main button:has-text("Preview")');
    await waitFor('iframe[data-testid="pdf-preview-iframe"]', 30000);
    await wait(3500);
    await page.evaluate(() => document.activeElement?.blur());
    await capClip('pay-apps', 'pay-app-pdf-preview', '[role="dialog"]', 60);
    await page.keyboard.press('Escape');
  });

  // ── Change orders ────────────────────────────────────────────────────────
  await shot('change-orders-list', async () => {
    await goto('/change-orders', 300);
    await ready('main table tbody tr');
    // Void change orders (left by re-taken demo videos) would crowd the top
    // of the list; show the live ones.
    await click('main button:has-text("All Statuses")');
    for (const s of ['Draft', 'Sent', 'Submitted', 'Approved', 'Rejected']) {
      await click(`[data-radix-popper-content-wrapper] label:text-is("${s}")`);
    }
    await page.keyboard.press('Escape');
    await contentReady(page);
    await wait(800);
    await capFull('change-orders', 'change-orders-list');
  });

  await shot('change-order-approval', async () => {
    await goto(`/change-orders/${data.coId}`, 300);
    await ready('main >> text=Contract Flow');
    await capFull('change-orders', 'change-order-approval');
  });

  // ── Field ────────────────────────────────────────────────────────────────
  await shot('site-logs-list', async () => {
    await goto('/site-logs', 300);
    await ready('main >> text=Punch list complete');
    await capFull('field', 'site-logs-list');
  });

  await shot('time-tracking', async () => {
    await goto('/time-tracking', 300);
    await ready('main >> text=Gulfstream Bank Branch');
    await capFull('field', 'time-tracking');
  });

  await shot('log-time-dialog', async () => {
    await goto('/time-tracking', 300);
    await ready('main h1:has-text("Time Tracking")');
    await click('main button:has-text("Log Time")');
    const dialog = '[role="dialog"]';
    await waitFor(dialog, 8000);
    await wait(600);
    // Filled in the way a foreman would, then dismissed — never saved.
    const pickers = page.locator(`${dialog} button[role="combobox"]`);
    await choose(pickers.nth(0), 'Jorge Rodriguez');
    // The project list scrolls as the pointer nears its edge, so a moved-mouse
    // click can land a row high; let Playwright scroll and click the option.
    await click(pickers.nth(1));
    await page.locator('[role="option"]', { hasText: 'Tropical Office Tower' }).click();
    await waitFor(`${dialog} button[role="combobox"]:has-text("Tropical Office Tower")`, 4000);
    const hours = page.locator(`${dialog} input[type="number"]`).first();
    await hours.fill('8');
    await page.locator(`${dialog} textarea`).fill('Refrigerant line sets to the floor 3 fan coils');
    await waitFor(`${dialog} >> text=$576.00`, 6000);
    await page.evaluate(() => document.activeElement?.blur());
    await page.mouse.move(VIEWPORT.width - 2, VIEWPORT.height - 2);
    await wait(400);
    await capClip('field', 'log-time-dialog', dialog, 60);
    await page.keyboard.press('Escape');
  });

  if (failures.length) throw new Error(`failed shots: ${failures.join(', ')}`);
}
