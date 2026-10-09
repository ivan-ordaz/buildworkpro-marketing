// Flagship tour of the real app, driven through the sidebar the way a user
// moves: dashboard → Pipeline → Bids (filtered to accepted work) → a live
// project's contract & billing → Time, where this week's crew hours roll up
// for payroll. Setup stages receivables (so the dashboard money strip isn't
// $0.00) and this week's hours (so Time opens populated) — both idempotent, in
// lib/demo-crm.mjs. Every load wait is a jump cut; run
// `node marketing-capture/apply-cuts.mjs product-tour` after capturing.
import { makeCuts, contentReady } from '../lib/cuts.mjs';
import { stageReceivables, stageWeekTimeEntries } from '../lib/demo-crm.mjs';

const PROJECT = 'Pelican Restaurant — Rooftop Replacement';
const NAV = 'nav[aria-label="Primary"]';

export const meta = {
  name: 'product-tour',
  video: true,
  viewport: 'desktop',
  strict: true,
  warmup: ['/dashboard', '/leads', '/bids', '/projects', '/projects/95521', '/time-tracking'],
};

export async function setup({ api, log }) {
  log(`  ✓ receivables: ${(await stageReceivables(api)).join(', ')}`);
  log(`  ✓ ${await stageWeekTimeEntries(api)} time entries this week`);
}

export default async function scene(ctx) {
  const { goto, click, moveTo, waitFor, wait, page, meta } = ctx;
  const { cut, clickThrough, save } = makeCuts(meta.name, page);
  const go = (target, ready) => clickThrough(ctx, target, ready);

  await cut(async () => {
    await goto('/dashboard', 0);
    await waitFor('main >> text=Needs you today');
    await waitFor('main >> text=Collected 30d');
    await contentReady(page, { quietMs: 900 }); // late dashboard widgets
  });
  await wait(500);
  await moveTo('main >> text=Needs you today');
  await wait(1100);

  await go(`${NAV} a[href="/leads"]`, () => waitFor('main >> text=Negotiation'));
  await wait(700);
  await moveTo(page.locator('main h4').first());
  await wait(1200);

  // Bids, narrowed to accepted work with one click on the status strip.
  await go(`${NAV} a[href="/bids"]`, () => waitFor('main button:has-text("Accepted")'));
  await wait(600);
  await click('main button:has-text("Accepted")');
  await wait(1300);

  // A live project: contract, billed, retainage and balance at a glance.
  await go(`${NAV} a[href="/projects"]`, () => waitFor(`main >> text=${PROJECT}`));
  await wait(500);
  await go(`main >> text=${PROJECT}`, () => waitFor('main >> text=Contract & billing'));
  await wait(400);
  await moveTo('main >> text=Contract & billing');
  await wait(1300);

  // Time: this week's crew hours by day and project, ready to export for payroll.
  await go(`${NAV} a[href="/time-tracking"]`, () => waitFor('main >> text=RTU curb adapters'));
  await wait(900);
  await moveTo(page.locator('main >> text=RTU curb adapters').first());
  await wait(1000);
  await moveTo('main button:has-text("Export for payroll")');
  await wait(2000);
  await save();
}
