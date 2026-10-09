// Demo video: from a sent bid to a live project. The GC says yes — Accept Bid
// records who accepted it, the bid locks, and Convert to Project maps every
// line item to a project phase and opens the new project.
//
// The send itself is staged, not filmed: local dev runs a live SendGrid key,
// and the transport only drops undeliverable addresses by FAILING the send
// (500, bid stays Draft) — so a safe on-camera send cannot succeed. Setup
// soft-deletes the previous take's bid and project, then creates a fresh bid
// with priced material + labor cost items and moves it to Sent.
import { contentReady, makeCuts } from '../lib/cuts.mjs';
import { costItems, findContact, freshBid } from '../lib/demo-bids.mjs';

const BID_NAME = 'Brickell Dental Studio — Split System Replacement';
const CUSTOMER = 'Bayside Construction Group';
const ACCEPTED_BY = 'Jose Morales';

const LINES = [
  {
    markName: '01',
    description: 'Demo and haul-off of existing split systems',
    quantity: '1',
    sublines: costItems([
      ['labor', 'Demo crew', 12, 75, 'hour'],
      ['other', 'Dumpster and disposal', 1, 425, 'each'],
    ]),
  },
  {
    markName: '02',
    description: '5-ton split systems — condenser, air handler and line set',
    quantity: '3',
    sublines: costItems([
      ['material', '5-Ton Condensing Unit 15.2 SEER2', 1, 2350, 'each'],
      ['material', '5-Ton Air Handler w/ Heat Kit', 1, 1680, 'each'],
      ['material', '3/8" Line Set (50 ft)', 1, 145, 'each'],
      ['labor', 'Installation Labor', 14, 75, 'hour'],
    ]),
  },
  {
    markName: '03',
    description: 'Ductwork modifications, supply and return grilles',
    quantity: '1',
    sublines: costItems([
      ['material', 'Sheet Metal Ductwork', 120, 18, 'lnft'],
      ['material', 'Supply Grille 10x6', 12, 14, 'each'],
      ['labor', 'Installation Labor', 24, 75, 'hour'],
    ]),
  },
  {
    markName: '04',
    description: 'Controls, startup and commissioning',
    quantity: '1',
    sublines: costItems([
      ['material', 'Smart Wi-Fi Thermostat', 3, 115, 'each'],
      ['labor', 'Startup & Commissioning', 3, 220, 'each'],
    ]),
  },
].map((line, i) => ({ ...line, unitPrice: '0', kind: 'item', order: i }));

export const meta = {
  name: 'bid-send-convert',
  video: true,
  viewport: 'desktop',
  strict: true,
  // Any seeded bid compiles the bid-detail route before the recorded run.
  warmup: ['/bids', '/bids/101174', '/projects'],
};

export async function setup({ api, log }) {
  const customer = await findContact(api, CUSTOMER);
  const bid = await freshBid(api, {
    name: BID_NAME,
    contactId: customer.id,
    lineItems: LINES,
    extra: { siteAddress: '1221 Brickell Ave' },
  });
  await api.patch(`/api/bids/${bid.id}/status`, { status: 'sent' });
  log(`  ✓ bid ${bid.bidNumber} (#${bid.id}) staged as Sent`);
  return { bidId: bid.id };
}

// A Monday two to three weeks out, typed into a date input as MMDDYYYY.
function startDateKeys() {
  const d = new Date();
  d.setDate(d.getDate() + 14 + ((8 - d.getDay()) % 7));
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}${pad(d.getDate())}${d.getFullYear()}`;
}

export default async function scene(ctx) {
  const { goto, click, type, moveTo, waitFor, wait, page, data, meta } = ctx;
  const { cut, clickThrough, save } = makeCuts(meta.name, page);

  // A sent bid, waiting on the customer's decision.
  await cut(async () => {
    await goto(`/bids/${data.bidId}`, 0);
    await waitFor(`main >> text=${CUSTOMER}`, 20000);
    await contentReady(page);
  });
  await wait(700);
  await moveTo('main >> text=awaiting customer');
  await wait(700);

  // The GC says yes: record who accepted it.
  await click('main button:has-text("Mark Accepted")');
  await waitFor('[role="dialog"] >> text=Accept Bid');
  await type('#bid-accepted-by', ACCEPTED_BY, { delay: 50 });
  await wait(300);
  await click('[role="dialog"] button:has-text("Accept Bid")');
  await waitFor(`main >> text=Accepted by ${ACCEPTED_BY}`);
  await wait(400);
  await moveTo('main >> text=This bid is accepted and locked');
  await wait(800);

  // Convert it: every line item becomes a project phase.
  await click('main button:has-text("Convert to Project")');
  await waitFor('[role="dialog"] >> text=Convert Bid to Project');
  await wait(300);
  await moveTo('[role="dialog"] button:has-text("Phases from lines")');
  await wait(500);
  await moveTo('[role="dialog"] >> text=4 phases');
  await wait(800);
  await click(page.locator('[role="dialog"] input[type="date"]').first());
  await page.keyboard.type(startDateKeys(), { delay: 70 });
  await wait(400);
  // The new project: contract value, start date and site carried over...
  await clickThrough(ctx, '[role="dialog"] button:has-text("Convert to Project")', async () => {
    await page.waitForURL(/\/projects\/\d+/, { timeout: 15000 });
    await waitFor(`main h1:has-text("${BID_NAME}")`, 20000);
    await waitFor('main >> text=Site & client');
  });
  await wait(500);
  await moveTo('main >> text=Revised Contract');
  await wait(1000);

  // ...and its phases, one per bid line. The Plan tab opens on the Gantt,
  // which only draws tasks — List view shows the phases themselves.
  await clickThrough(ctx, 'main [role="tab"]:has-text("Plan")', () =>
    waitFor('main button:has-text("List")')
  );
  await click('main button:has-text("List")');
  await click('main button:has-text("Collapse all")');
  await waitFor('main >> text=Controls, startup and commissioning');
  await moveTo('main >> text=Controls, startup and commissioning');
  await wait(2000);
  await save();
}
