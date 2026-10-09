// Marketing-site screenshots: public/screenshots/NN-*.png (1920x1080, the
// size Screenshot.astro assumes). Shoots into output/marketing-screens__NN-*.png;
// copy the ones you accept over the files in public/screenshots/.
//
// Setup stages the records each shot shows (lib/demo-marketing.mjs): an
// accepted bid, a sent bid with the lead it came from, one project's schedule
// with an approved and a submitted change order, and an approved pay app.
// 10/11 (site logs) come from site-log-screens.shots.mjs.
import { contentReady } from '../lib/cuts.mjs';
import { setTaskView } from '../lib/demo-projects.mjs';
import {
  ensureApprovedPayApp,
  stageAcceptedBid,
  stageProjectChangeOrders,
  stageProjectSchedule,
  stageSentBidWithLead,
} from '../lib/demo-marketing.mjs';

export const meta = { name: 'marketing-screens', video: false, viewport: 'hd', scale: 1, strict: true };

export async function setup({ api, log }) {
  await setTaskView(api, 'list');
  const accepted = await stageAcceptedBid(api);
  const { lead, bid: sent } = await stageSentBidWithLead(api);
  const projectId = await stageProjectSchedule(api);
  const cos = await stageProjectChangeOrders(api, projectId);
  const payAppId = await ensureApprovedPayApp(api);
  // Staging raises "bid accepted" / "change order approved" alerts; clear the
  // bell so the header doesn't read 9+ in every shot.
  await api.patch('/api/notifications/mark-all-read', {});
  log(`  ✓ bids ${accepted.bidNumber}/${sent.bidNumber}, lead #${lead.id}, project #${projectId}, COs ${cos.approvedId}/${cos.submittedId}, pay app #${payAppId}`);
  return { acceptedBidId: accepted.id, sentBidId: sent.id, leadId: lead.id, projectId, ...cos, payAppId };
}

export default async function scene({ goto, click, waitFor, wait, shot, page, data }) {
  // Navigate, wait for `marker` and for main to finish painting, then shoot.
  const capture = async (name, path, marker, before) => {
    if (path) await goto(path, 300);
    if (marker) await waitFor(marker, 30000);
    if (before) await before();
    await contentReady(page, { timeout: 15000, quietMs: 600 });
    await wait(700);
    await shot(name);
  };

  // 00-hero (the homepage's schema.org screenshot) is a copy of this one.
  await capture('01-dashboard', '/', 'main >> text=Needs you today');
  await capture('02-pipeline-kanban', '/leads', 'main >> text=Negotiation');

  await capture('05-bid-detail-overview', `/bids/${data.acceptedBidId}`, 'main >> text=Cost Breakdown');
  await capture('06-bid-detail-marks', `/bids/${data.sentBidId}`, 'main >> text=Cost Breakdown', async () => {
    await click('main [role="tab"]:has-text("Estimate")');
    await waitFor('main >> text=Add Line');
    await click('main button:has-text("Detailed"):visible');
    await wait(600);
    // Open line 01 to show its material, crane and labor cost items, with the
    // rollup cards at the top of the pane.
    await page.locator('main table:visible tbody tr button:has(svg.lucide-chevron-right)').first().click();
    await waitFor('main button:has-text("Add Cost"):visible');
    await page
      .locator('main >> text=Direct material cost')
      .first()
      .evaluate((el) => el.closest('[class*="grid"]')?.scrollIntoView({ block: 'start' }));
    await wait(500);
    await page.mouse.move(5, 1070);
  });
  await capture('07-bid-detail-rates', null, null, async () => {
    await click('main [role="tab"]:has-text("Pricing")');
    await waitFor('main >> text=Live Preview');
    await page.mouse.move(5, 1070);
  });

  await capture('09-change-order-detail', `/change-orders/${data.submittedId}`, 'main >> text=Contract Flow');
  await capture('25-change-order-approved', `/change-orders/${data.approvedId}`, 'main >> text=Contract Flow');

  await capture('12-pay-apps-list', '/pay-apps', 'main table tbody tr');
  await capture('13-pay-app-detail', `/pay-apps/${data.payAppId}`, 'main >> text=Payment Application Summary');

  // Plan tab: completed phases collapsed to their 100% bars, the in-progress
  // phase and closeout open, the card scrolled to the top of the pane.
  const planToTop = () =>
    page.locator('main >> text=Phases & Tasks').first().evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await capture('16-project-phases-tasks', `/projects/${data.projectId}#plan`, '[data-phase-header]:has-text("Equipment Set")', async () => {
    await click('main button:has-text("Collapse all")');
    await click('[data-phase-header]:has-text("Equipment Set") span.font-medium');
    await waitFor('[data-task-row]:has-text("Air handlers & VAV boxes")');
    await click('[data-phase-header]:has-text("Startup & Closeout") span.font-medium');
    await waitFor('[data-task-row]:has-text("Startup & commissioning")');
    await planToTop();
    await page.mouse.move(5, 1070);
  });
  await capture('17-project-gantt', null, null, async () => {
    await click('main button:has-text("Gantt")');
    await waitFor('main >> text=Today');
    await planToTop();
    await page.mouse.move(5, 1070);
  });
  // The List/Gantt choice is a per-user server preference; put it back so the
  // next capture that opens a Plan tab starts on the list.
  await click('main button:has-text("List")');

  await capture('19-reports', '/reports?preset=ytd&compare=1', 'main >> text=Billed vs collected');
  await capture('27-lead-detail', `/leads/${data.leadId}`, 'main >> text=Lead Summary');
  await capture('28-time-tracking', '/time-tracking', 'main >> text=Export for payroll');
}
