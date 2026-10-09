// Demo video: a won lead becomes a project. Find the lead from the pipeline
// search, open it, choose Convert to Project from its actions (⋯) menu,
// confirm, and land on the new project — customer, site address and contract
// value carried over.
//
// Setup recreates the lead each run and soft-deletes the project the previous
// take converted it into (lib/demo-crm.mjs). Load waits are marked as jump
// cuts; run `node marketing-capture/apply-cuts.mjs lead-convert` after.
import { stageLead } from '../lib/demo-crm.mjs';
import { makeCuts, contentReady } from '../lib/cuts.mjs';

const LEAD = 'Coral Warehouse — Chiller Replacement';

export const meta = {
  name: 'lead-convert',
  video: true,
  viewport: 'desktop',
  strict: true,
  // Any seeded lead/project compiles the detail-page chunks off camera.
  warmup: ['/leads', '/leads/112792', '/projects'],
};

export async function setup({ api }) {
  await stageLead(api, {
    name: LEAD,
    stage: 'Negotiation',
    company: 'Coral Warehouse Development',
    estimatedValue: '186400',
    probability: 80,
    source: 'referral',
    projectType: 'commercial',
    closeInDays: 12,
    description: 'Replace the 60-ton air-cooled chiller serving the warehouse office wing.',
    siteAddress: '8800 NW 36th St',
    siteCity: 'Doral',
    siteState: 'FL',
    siteZipCode: '33178',
  });
}

export default async function scene(ctx) {
  const { goto, click, type, moveTo, waitFor, wait, page, meta } = ctx;
  const { cut, clickThrough, save } = makeCuts(meta.name, page);

  await cut(async () => {
    await goto('/leads', 0);
    await waitFor('main >> text=Negotiation');
    await contentReady(page);
  });
  await wait(600);
  await type('main input[placeholder="Search leads..."]', 'Coral Warehouse', { delay: 70 });
  // The filter empties the other columns; land on the column the lead is in.
  await cut(async () => {
    await waitFor(`main h4:has-text("${LEAD}")`);
    await page.locator(`main h4:has-text("${LEAD}")`).scrollIntoViewIfNeeded();
    await contentReady(page);
  });
  await wait(900);
  await clickThrough(ctx, `main h4:has-text("${LEAD}")`, async () => {
    await waitFor('main >> text=Weighted Value');
    await waitFor('main >> text=Coral Warehouse Development');
  });
  await wait(700);
  await moveTo('main >> text=Weighted Value');
  await wait(900);

  // Actions (⋯) menu in the header → Convert to Project.
  await click(page.locator('main button[aria-haspopup="menu"]').last());
  await waitFor('[role="menuitem"]:has-text("Convert to Project")');
  await wait(500);
  await click('[role="menuitem"]:has-text("Convert to Project")');
  await waitFor('[role="dialog"] >> text=Convert to Project');
  await wait(1000);

  // Lands on the new project.
  await clickThrough(ctx, '[role="dialog"] button:has-text("Convert")', async () => {
    await page.waitForURL(/\/projects\/\d+/, { timeout: 15000 });
    await waitFor('main >> text=Contract & billing');
  });
  await wait(500);
  await moveTo('main >> text=Contract & billing');
  await wait(1200);
  await moveTo('main >> text=Site & client');
  await wait(2000);
  await save();
}
