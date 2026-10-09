// Demo video: pricing a bid's estimate for real. On a named draft bid's
// Estimate tab (Detailed): add zone dampers from the catalog with Add Line;
// expand the rooftop-unit change-out and Import Kit to pull in its material +
// labor cost items; cost the dampers with Add Cost; watch Materials / Labor /
// Total roll up. Finish on the Pricing tab: raise the margin, save, and read
// the new price in the Live Preview.
//
// Setup (un-recorded) makes sure the catalog has the change-out kit, resets
// the bid with standard rates and stages the kit line unpriced.
//
// The order is forced by two app bugs (a line added with Add Line has no
// `product` in client state until the bid reloads): such a line never shows
// Import Kit or "Create material cost from product", and adding a line AFTER
// importing a kit makes the kit line's cost items vanish from view (they are
// still saved). So the kit line is staged, the on-camera Add Line happens
// before any costing, and the new line is priced with Add Cost.
import { contentReady, makeCuts } from '../lib/cuts.mjs';
import { ensureKit, findContact, resetDraftBid } from '../lib/demo-bids.mjs';

const BID_NAME = 'Harbor Point Medical Office — RTU Change-Out';
const CUSTOMER = 'Palm Construction Group';
const KIT = {
  sku: 'SYS-RTU10',
  name: '10-Ton RTU Change-Out',
  description:
    'Remove the existing unit, set a new 10-ton rooftop unit on the existing curb, reconnect and start up',
  type: 'material',
  unit: 'each',
  costPrice: '0',
  sellPrice: '0',
};
const KIT_COMPONENTS = [
  { sku: 'PKG-10T', quantity: 1 },
  { sku: 'CRANE-SET', quantity: 0.5 },
  { sku: 'DISC-WHIP', quantity: 1 },
  { sku: 'LAB-INSTALL', quantity: 16 },
  { sku: 'LAB-ELEC', quantity: 4 },
  { sku: 'LAB-STARTUP', quantity: 1 },
];

export const meta = {
  name: 'create-bid',
  video: true,
  viewport: 'desktop',
  strict: true,
  // Any seeded bid compiles the bid-detail route before the recorded run.
  warmup: ['/bids', '/bids/101174'],
};

export async function setup({ api, log }) {
  const kit = await ensureKit(api, KIT, KIT_COMPONENTS);
  const customer = await findContact(api, CUSTOMER);
  const bid = await resetDraftBid(api, { name: BID_NAME, contactId: customer.id });
  await api.post(`/api/bids/${bid.id}/line-items`, {
    markName: '01',
    productId: kit.id,
    description: 'Change out RTU-1 and RTU-2 with new 10-ton packaged rooftop units',
    quantity: '2',
    unitPrice: '0',
    kind: 'item',
    order: 0,
  });
  log(`  ✓ bid ${bid.bidNumber} (#${bid.id}) reset with one unpriced kit line`);
  return { bidId: bid.id };
}

export default async function scene(ctx) {
  const { goto, click, choose, moveTo, waitFor, wait, page, data, meta } = ctx;
  const { cut, save } = makeCuts(meta.name, page);
  // The estimate coach strip is first-bid onboarding; a working estimator has
  // long since dismissed it.
  await page.addInitScript(() => localStorage.setItem('bid-estimate-coach-dismissed', 'true'));
  // The estimate also renders a hidden mobile copy of every row — hence :visible.
  const showCosts = 'main button[title="Show cost items"]:visible';
  const qtyInput = page.locator('xpath=(//div[normalize-space(text())="Qty"])[1]/following-sibling::*[1]');

  await cut(async () => {
    await goto(`/bids/${data.bidId}`, 0);
    await waitFor(`main >> text=${CUSTOMER}`, 20000);
    await contentReady(page);
  });
  await wait(700);

  await click('[role="tab"]:has-text("Estimate")');
  await click('[role="tab"][aria-label="Detailed"]');
  await waitFor(showCosts);
  await wait(300);

  // Add Line: six zone dampers straight from the catalog.
  await choose('[role="combobox"][aria-label="Product"]', 'Zone Damper 8"', { search: 'Zone Damper' });
  await wait(250);
  await click(qtyInput);
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('6', { delay: 80 });
  await wait(200);
  await click('main button:has-text("Add Line")');
  await waitFor('main >> text=2 line items');
  await wait(300);

  // The change-out line is unpriced: expand it and import its kit.
  await click(showCosts);
  await click('main button:has-text("Import Kit"):visible');
  await waitFor('main >> text=6 cost items');
  await wait(500);
  // Cost items are editable rows (inputs), so point at them by their type.
  await moveTo(page.locator('main [role="combobox"]:has-text("Labor"):visible').last());
  await wait(900);
  await moveTo('main >> text=Direct labor cost');
  await wait(700);

  // Price the dampers with a material cost item.
  await click(showCosts);
  await click(page.locator('main button:has-text("Add Cost"):visible').last());
  await click('main input[placeholder="Description"]:visible');
  await page.keyboard.type('Motorized zone damper', { delay: 40 });
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.type('145', { delay: 90 });
  await wait(300);
  await click('main button[title="Add cost item"]:visible');
  await waitFor('main >> text=1 cost item');
  await wait(400);
  await moveTo('main >> text=Direct material cost');
  await wait(900);

  // Pricing: raise the margin, save, and read the new price in Live Preview.
  await click('[role="tab"]:has-text("Pricing")');
  await waitFor('main >> text=Live Preview');
  await wait(300);
  const margin = page.locator('xpath=//label[normalize-space(.)="Margin"]/following::input[1]');
  await click(margin);
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('22', { delay: 120 });
  await wait(400);
  await click('main button:has-text("Save")');
  await moveTo('main >> text=Margin (22%)', { timeout: 8000 });
  await wait(2000);
  await save();
}
