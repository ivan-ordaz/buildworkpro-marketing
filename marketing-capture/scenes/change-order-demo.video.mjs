// Demo video: pricing a change order. On a fresh draft CO, Add Item opens the
// mark editor; we pick a catalog product, build it up from a material and a
// labor subline (the contract impact prices itself from cost as each lands),
// save the mark, and finish on the CO with the new line and updated totals.
// Marks save as they're added — there is no separate Save step on a draft CO.
//
// Setup deletes the draft a previous run left and stages a fresh, empty one
// with its title and description, so every take starts from the same screen.
import { findProject, clearChangeOrders, createChangeOrder } from '../lib/demo-change-orders.mjs';
import { makeCuts } from '../lib/cuts.mjs';

const PROJECT = 'Royal Office Tower — HVAC Install';
// Short on purpose: a draft CO's header (7 action buttons beside the sidebar)
// truncates titles past ~9 characters at 1440px.
const TITLE = 'IT A/C';

const DIALOG = '[role="dialog"]';
const SUB_PRODUCT = `${DIALOG} button[role="combobox"][aria-label="Product"]`;
const SUB_QTY = `${DIALOG} div:has(> label:text-is("Qty")) > input:not(#co-item-quantity)`;
const SUB_ADD = `${DIALOG} button:text-is("Add")`;

export const meta = {
  name: 'change-order-demo',
  video: true,
  viewport: 'desktop',
  strict: true,
  // A seeded CO id warms the detail route's chunk; any id works (a 404 after a
  // reseed still compiles the route).
  warmup: ['/change-orders', '/change-orders/32119'],
};

export async function setup({ api, log }) {
  const project = await findProject(api, PROJECT);
  const cleared = await clearChangeOrders(api, project.id, [TITLE]);
  const co = await createChangeOrder(api, project.id, {
    title: TITLE,
    reason: 'customer_request',
    description:
      'Owner is converting storage room 214 into an IT closet that needs 24/7 cooling, independent of the building system.',
  });
  log(`  ✓ staged draft ${co.changeOrderNumber} on ${project.name}; cleared ${cleared}`);
  return { coId: co.id };
}

export default async function scene({ goto, click, type, choose, moveTo, waitFor, wait, page, data, meta }) {
  const { cut, save } = makeCuts(meta.name, page);
  // Add one subline from the catalog. Picking a labor product switches the
  // subline's type to Labor on its own.
  const addSubline = async ({ search, option, qty }) => {
    await click(`${DIALOG} button:has-text("Add Subline")`);
    await wait(250);
    await choose(SUB_PRODUCT, option, { search });
    if (qty) {
      await click(SUB_QTY);
      await page.keyboard.press('ControlOrMeta+A');
      await page.keyboard.type(qty, { delay: 90 });
    }
    await wait(200);
    await click(SUB_ADD);
    await wait(500);
  };

  await cut(async () => {
    await goto(`/change-orders/${data.coId}`, 300);
    await waitFor('main button:has-text("Add Item")', 20000);
  });
  await wait(900);
  await moveTo('main >> text=Owner is converting');
  await wait(600);

  // The mark: an added mini-split, picked from the catalog.
  await click('main button:has-text("Add Item")');
  await waitFor(`${DIALOG} >> text=Add Change Order Mark`);
  await wait(300);
  await type('#co-item-mark-name', 'IT-1', { delay: 80 });
  await choose('#co-item-product', 'Mini-Split', { search: 'Mini' });
  await wait(400);

  // Build it from cost: the unit itself and ten hours of install labor.
  await addSubline({ search: 'Mini', option: 'Mini-Split' });
  await addSubline({ search: 'Install', option: 'Installation Labor', qty: '10' });
  await moveTo(`${DIALOG} >> text=Total impact`);
  await wait(1000);

  // Save the mark: the line lands and the CO and contract totals update.
  await click(`${DIALOG} button:has-text("Add Mark")`);
  await page.locator(DIALOG).waitFor({ state: 'hidden', timeout: 10000 });
  await waitFor('main table tbody tr:has-text("IT-1")');
  await wait(500);
  await moveTo('main table tbody tr:has-text("IT-1")');
  await wait(900);
  await moveTo('main >> text=Net Change');
  await wait(800);
  await moveTo('main >> text=(current)');
  await wait(1600);
  await save();
}
