// Demo video: approving a change order. A submitted CO with priced marks is
// reviewed, Approve is clicked and confirmed, and the stepper reaches Approved
// while the Contract Flow panel rolls the CO into the approved contract value.
//
// Setup voids the CO a previous run approved (void COs drop out of Contract
// Flow and reverse their contract impact) and stages a fresh submitted one, so
// every take starts from the same screen.
import {
  findProject,
  findProducts,
  clearChangeOrders,
  createChangeOrder,
} from '../lib/demo-change-orders.mjs';
import { makeCuts } from '../lib/cuts.mjs';

const PROJECT = 'Pelican Restaurant — Rooftop Replacement';
const TITLE = 'RTU curb adapters';

export const meta = {
  name: 'change-order-approval',
  video: true,
  viewport: 'desktop',
  strict: true,
  // A seeded CO id warms the detail route's chunk; any id works (a 404 after a
  // reseed still compiles the route).
  warmup: ['/change-orders', '/change-orders/32119'],
};

export async function setup({ api, log }) {
  const project = await findProject(api, PROJECT);
  const products = await findProducts(api, ['LAB-INSTALL', 'CRANE-SET']);
  const cleared = await clearChangeOrders(api, project.id, [TITLE]);
  const co = await createChangeOrder(api, project.id, {
    title: TITLE,
    reason: 'field_conditions',
    description:
      "The existing roof curbs don't match the footprint of the new 10-ton units. Adds two curb adapters with flashing and a second crane pick.",
    submit: true,
    items: [
      {
        changeType: 'add',
        markName: 'CA-1',
        description: 'Curb adapter, 10-ton RTU — fabricated, insulated, flashed',
        quantity: '2',
        sublines: [
          { type: 'material', description: 'Fabricated curb adapter, insulated', quantity: '1', unitCost: '685.00', unitOfMeasure: 'each' },
          { type: 'material', description: 'Flashing & sealant kit', quantity: '1', unitCost: '95.00', unitOfMeasure: 'each' },
          { type: 'labor', productId: products['LAB-INSTALL'].id, description: 'Installation Labor', quantity: '6', unitCost: '75.00', unitOfMeasure: 'hour' },
        ],
      },
      {
        changeType: 'add',
        markName: 'CR-1',
        description: 'Second crane pick for the curb adapters',
        quantity: '1',
        sublines: [
          { type: 'other', productId: products['CRANE-SET'].id, description: 'Crane / Rigging', quantity: '1', unitCost: '950.00', unitOfMeasure: 'day' },
        ],
      },
    ],
  });
  log(`  ✓ staged ${co.changeOrderNumber} (${co.status}, $${co.total}) on ${project.name}; cleared ${cleared}`);
  if (co.status !== 'submitted') throw new Error(`expected a submitted CO, got ${co.status}`);
  return { coId: co.id, coNumber: co.changeOrderNumber };
}

export default async function scene({ goto, click, moveTo, waitFor, wait, page, data, meta }) {
  const { cut, save } = makeCuts(meta.name, page);

  await cut(async () => {
    await goto(`/change-orders/${data.coId}`, 300);
    await waitFor('main >> text=Projected Total', 20000);
  });
  await wait(1100);

  // What's being approved: the priced marks and the net change.
  await moveTo('main table tbody tr:has-text("CA-1")');
  await wait(800);
  await moveTo('main >> text=Net Change');
  await wait(700);
  await moveTo('main >> text=Projected Total');
  await wait(900);

  // Approve, and confirm the contract-value impact.
  await click('main button:has-text("Approve")');
  await waitFor(`[role="dialog"] >> text=Approve ${data.coNumber}`);
  await wait(500);
  await moveTo('[role="dialog"] >> text=Approving will increase');
  await wait(1300);
  await click('[role="dialog"] button:has-text("Approve")');
  await page.locator('[role="dialog"]').waitFor({ state: 'hidden', timeout: 10000 });

  // The result: Approved, and the CO is now inside the approved contract.
  await wait(900);
  await moveTo('main >> text=Approved Contract');
  await wait(1400);
  await moveTo('main >> text=/^Approved$/');
  await wait(1600);
  await save();
}
