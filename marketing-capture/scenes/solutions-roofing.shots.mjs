// /solutions/roofing-contractors/ screenshots, from Summit Commercial Roofing
// (run with CAPTURE_USER=dburns):
//   public/screenshots/solutions/roofing/pipeline-kanban.png
//   public/screenshots/solutions/roofing/change-order-detail.png
// The pipeline with the seed's stitched lead names ("Re-Roof Repair") replaced
// by real roofing jobs, and an approved change order for deck found rotten at
// tear-off — priced from material and labor sublines.
import { clearChangeOrders, createChangeOrder } from '../lib/demo-change-orders.mjs';
import { markNotificationsRead } from '../lib/demo-pay-apps.mjs';
import {
  ROOFING_CO,
  ROOFING_LEAD_NAMES,
  assertUser,
  matchProjectCustomer,
  projectNamed,
  renameLeads,
  solutionsSnapper,
} from '../lib/demo-trades.mjs';

export const meta = { name: 'solutions-roofing', video: false, viewport: 'hd', scale: 1, strict: true };

export async function setup({ api, log }) {
  await assertUser(api, 'dburns');
  const leads = await renameLeads(api, ROOFING_LEAD_NAMES);

  const project = await projectNamed(api, ROOFING_CO.project);
  await matchProjectCustomer(api, project);
  await clearChangeOrders(api, project.id, [ROOFING_CO.title]);
  const co = await createChangeOrder(api, project.id, {
    title: ROOFING_CO.title,
    reason: 'field_conditions',
    description: ROOFING_CO.description,
    items: ROOFING_CO.items,
    submit: true,
  });
  await api.patch(`/api/change-orders/${co.id}/approve`, {});
  // Staging's submit / approve / void alerts would otherwise pile up on the bell.
  const cos = await api.get(`/api/projects/${project.id}/change-orders?limit=200`);
  await markNotificationsRead(api, cos.map((c) => ({ type: 'change_order', id: c.id })));
  log(`  ✓ ${leads} leads renamed; ${co.changeOrderNumber} approved ($${co.total}) on ${project.name}`);
  return { coId: co.id };
}

export default async function scene(ctx) {
  const { page, goto, waitFor, wait, data, log } = ctx;
  const snap = await solutionsSnapper(page, 'roofing', log);

  await goto('/leads', 800);
  await waitFor('main >> text=Contacted', 20000);
  await wait(1200);
  await snap('pipeline-kanban');

  await goto(`/change-orders/${data.coId}`, 800);
  await waitFor('main >> text=Approved Contract', 20000);
  await wait(600);
  await snap('change-order-detail');
}
