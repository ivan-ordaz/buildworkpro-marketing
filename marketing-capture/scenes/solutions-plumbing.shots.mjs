// /solutions/plumbing-contractors/ screenshots, from Reliant Plumbing (run
// with CAPTURE_USER=gmedina):
//   public/screenshots/solutions/plumbing/bids-list.png
//   public/screenshots/solutions/plumbing/site-log-detail.png
// The bids list (expired bids re-dated so they read expired), and the tenant's site logs rewritten as a plumbing
// crew's record — the detail shot is a rough-in inspection day with the fixture
// delivery and the inspector's cleanout callout.
import {
  PLUMBING_DETAIL_LOG,
  PLUMBING_SITE_LOGS,
  assertUser,
  fixExpiredBidDates,
  polishTradeSiteLogs,
  solutionsSnapper,
} from '../lib/demo-trades.mjs';

export const meta = { name: 'solutions-plumbing', video: false, viewport: 'hd', scale: 1, strict: true };

export async function setup({ api, log }) {
  await assertUser(api, 'gmedina');
  const logs = await polishTradeSiteLogs(api, PLUMBING_SITE_LOGS);
  if (!logs[PLUMBING_DETAIL_LOG]) throw new Error('the tenant has too few site logs for the detail entry');
  const fixed = await fixExpiredBidDates(api);
  log(`  ✓ ${Object.keys(logs).length} site-log titles written; ${fixed} expired bids re-dated`);
  return { detailId: logs[PLUMBING_DETAIL_LOG] };
}

export default async function scene(ctx) {
  const { page, goto, waitFor, wait, data, log } = ctx;
  const snap = await solutionsSnapper(page, 'plumbing', log);

  await goto('/bids', 800);
  await waitFor('main table tbody tr', 20000);
  await wait(800);
  await snap('bids-list');

  await goto(`/site-logs/${data.detailId}`, 800);
  await waitFor('main >> text=missing cleanout', 20000);
  await wait(600);
  await snap('site-log-detail');
}
