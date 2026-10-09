// /solutions/glazing-contractors/ and /lp/glazing/ screenshots, from the seeded
// ClearLine Glass & Glazing tenant (run with CAPTURE_USER=gvaldez):
//   public/screenshots/solutions/glazing/bid-estimate-marks.png
//   public/screenshots/solutions/glazing/pay-app-detail.png
// A storefront + impact-window bid priced by mark from the tenant's catalog
// (framing, IGUs, laminated impact glass, door hardware, glazier labor), and a
// submitted pay app whose schedule of values came from an accepted bid.
import { apiAs, markNotificationsRead, stagePayApp } from '../lib/demo-pay-apps.mjs';
import {
  GLAZING_BID,
  GLAZING_PAY_APP,
  assertUser,
  frameEstimate,
  pickContact,
  solutionsSnapper,
  stageEstimate,
} from '../lib/demo-trades.mjs';

export const meta = { name: 'solutions-glazing', video: false, viewport: 'hd', scale: 1, strict: true };

export async function setup({ api, log }) {
  await assertUser(api, 'gvaldez');
  const gc = await pickContact(api, /^Crystal Construction Group$/);
  const bid = await stageEstimate(api, {
    ...GLAZING_BID,
    customer: gc,
    extra: { siteAddress: '2600 Ponce de Leon Blvd', siteCity: 'Coral Gables', siteState: 'FL', siteZipCode: '33134' },
  });

  const pa = await stagePayApp(api, {
    ...GLAZING_PAY_APP,
    customer: 'Grand Construction Group',
    siteAddress: '1100 Brickell Ave',
  });
  // The project manager submits; the admin's view shows it awaiting approval.
  const pm = await apiAs('npike');
  await pm.api.patch(`/api/pay-apps/${pa.payAppId}/submit`, {});
  await pm.dispose();
  await markNotificationsRead(api, [{ type: 'pay_app', id: pa.payAppId }]);
  log(`  ✓ bid ${bid.bidNumber} (#${bid.id}); ${pa.payAppNumber} (#${pa.payAppId}) submitted`);
  return { bidId: bid.id, payAppId: pa.payAppId };
}

export default async function scene(ctx) {
  const { page, goto, waitFor, wait, data, log } = ctx;
  const snap = await solutionsSnapper(page, 'glazing', log);

  // The bid, priced by mark: the entrance pair opened to its cost items.
  await frameEstimate(ctx, data.bidId, { customer: 'Crystal Construction Group', expand: 1, ready: 'Panic Exit Device' });
  await snap('bid-estimate-marks');

  await goto(`/pay-apps/${data.payAppId}`, 800);
  await waitFor('main >> text=Payment Application Summary', 20000);
  await wait(600);
  await snap('pay-app-detail');
}
