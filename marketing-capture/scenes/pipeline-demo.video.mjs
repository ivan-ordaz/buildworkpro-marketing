// Demo video: the sales pipeline doing its job. From the dashboard into
// Pipeline, drag a lead from New Lead to Contacted (both column totals update),
// then open the lead: its stage reads Contacted and the move is on its
// activity feed.
//
// Setup recreates the lead in New Lead every run, and stages receivables so
// the dashboard money strip isn't $0.00 (both in lib/demo-crm.mjs). Every load
// wait is a jump cut; run `node marketing-capture/apply-cuts.mjs pipeline-demo`
// after capturing.
import { stageLead, stageReceivables } from '../lib/demo-crm.mjs';
import { makeCuts, contentReady } from '../lib/cuts.mjs';

const LEAD = 'Bayside Medical Office — RTU Replacement';

export const meta = {
  name: 'pipeline-demo',
  video: true,
  viewport: 'desktop',
  strict: true,
  // Any seeded lead compiles the lead-detail chunk off camera.
  warmup: ['/dashboard', '/leads', '/leads/112792'],
};

export async function setup({ api, log }) {
  log(`  ✓ receivables: ${(await stageReceivables(api)).join(', ')}`);
  await stageLead(api, {
    name: LEAD,
    stage: 'New Lead',
    company: 'Bayside Medical Office Properties',
    estimatedValue: '128500',
    probability: 15,
    source: 'referral',
    projectType: 'commercial',
    closeInDays: 34,
    description: 'Replace three aging 15-ton rooftop units over the medical office suites.',
    siteAddress: '2450 Bayshore Dr',
    siteCity: 'Miami',
    siteState: 'FL',
    siteZipCode: '33133',
  });
}

// Column header text, e.g. "New Lead | 9 | $721,0…" — read the money figure.
async function columnTotal(page, stage) {
  const header = page
    .locator('main')
    .getByText(stage, { exact: true })
    .first()
    .locator('xpath=../..');
  const text = await header.innerText().catch(() => '');
  return text.match(/\$[\d,]+/)?.[0] ?? '';
}

export default async function scene(ctx) {
  const { goto, click, moveTo, waitFor, wait, page, log, meta } = ctx;
  const { cut, clickThrough, save } = makeCuts(meta.name, page);

  await cut(async () => {
    await goto('/dashboard', 0);
    await waitFor('main >> text=Needs you today');
    await waitFor('main >> text=Collected 30d');
    await contentReady(page, { quietMs: 900 }); // late dashboard widgets
  });
  await wait(900);

  await clickThrough(ctx, 'nav[aria-label="Primary"] a[href="/leads"]', () =>
    waitFor(`main >> text=${LEAD}`)
  );
  await wait(900);

  const card = page.locator('main').getByText(LEAD, { exact: true }).first();
  const target = page.locator('main').getByText('Contacted', { exact: true }).first();
  const before = [await columnTotal(page, 'New Lead'), await columnTotal(page, 'Contacted')];

  // Drag: pick the card up, carry it into the Contacted column, drop it on top.
  const from = await moveTo(card);
  await wait(500);
  const head = await target.boundingBox();
  if (!from || !head) throw new Error('pipeline card or Contacted column not found');
  await page.mouse.down();
  await page.mouse.move(from.x + 12, from.y + 6, { steps: 6 });
  await page.mouse.move(head.x + 120, head.y + 90, { steps: 45 });
  await wait(450);
  await page.mouse.up();
  await wait(1600);

  // The card now sits in Contacted and both column totals moved.
  const after = [await columnTotal(page, 'New Lead'), await columnTotal(page, 'Contacted')];
  log(`  totals New Lead ${before[0]} → ${after[0]}, Contacted ${before[1]} → ${after[1]}`);
  if (before[0] === after[0] || before[1] === after[1]) {
    throw new Error('drag did not move the lead between columns');
  }
  await moveTo(page.locator('main').getByText('Contacted', { exact: true }).first());
  await wait(1100);

  // Open the lead: stage reads Contacted, and the move is in its activity.
  await clickThrough(ctx, page.locator('main h4').filter({ hasText: LEAD }).first(), async () => {
    await waitFor('main >> text=Weighted Value');
    await waitFor('main >> text=Bayside Medical Office Properties');
  });
  await wait(1200);
  await clickThrough(ctx, 'main [role="tab"]:has-text("Activity")', () => waitFor('main >> text=moved'));
  await wait(2600);
  await save();
}
