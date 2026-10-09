// Marketing screenshots for the site-logs feature page and homepage showcase:
// public/screenshots/10-site-logs-list.png and 11-site-log-detail.png.
// Shoots the polished demo logs (lib/demo-data.mjs), and a detail page with
// every section filled in — work performed, materials, visitors, issues.
import { polishSiteLogs } from '../lib/demo-data.mjs';

const DETAIL_TITLE = 'Rooftop units set by crane';

export const meta = { name: 'site-log-screens', video: false, viewport: 'hd', scale: 1, strict: true };

export async function setup({ api }) {
  // Drop the entry the site-log-create video files, so the list is the seed.
  await polishSiteLogs(api, { skipTitles: ['Duct rough-in — level 3'] });
  const logs = await api.get('/api/site-logs?limit=200&offset=0');
  const detail = logs.find((l) => l.title === DETAIL_TITLE);
  if (!detail) throw new Error(`no site log titled "${DETAIL_TITLE}"`);
  return { detailId: detail.id };
}

export default async function scene({ goto, waitFor, wait, shot, data }) {
  await goto('/site-logs', 1200);
  await waitFor('main >> text=Punch list complete');
  await wait(800);
  await shot('10-site-logs-list');

  await goto(`/site-logs/${data.detailId}`, 1200);
  await waitFor('main >> text=RTU-2 curb');
  await wait(800);
  await shot('11-site-log-detail');
}
