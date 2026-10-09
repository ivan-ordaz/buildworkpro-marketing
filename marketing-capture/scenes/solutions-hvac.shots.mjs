// /solutions/hvac-contractors/ screenshots, from Comfort Climate HVAC (run as
// the default CAPTURE_USER, rmoreno):
//   public/screenshots/solutions/hvac/pay-app-detail.png
//   public/screenshots/solutions/hvac/project-gantt.png
// Read-only: it films records the video scenes stage and own — the approved
// PA-002 on Biscayne Retail Plaza (pay-app-approval) and the Gulfstream Bank
// Branch schedule (gantt-demo) — so run those scenes first after a reseed.
// The List/Gantt choice is a per-user server setting; the scene puts it back.
import { scrollPage } from '../lib/demo-projects.mjs';
import { assertUser, projectNamed, solutionsSnapper } from '../lib/demo-trades.mjs';

export const meta = { name: 'solutions-hvac', video: false, viewport: 'hd', scale: 1, strict: true };

export async function setup({ api }) {
  await assertUser(api, 'rmoreno');
  const plaza = await projectNamed(api, 'Biscayne Retail Plaza — Rooftop Replacement');
  const payApp = (await api.get(`/api/projects/${plaza.id}/pay-apps`)).find((pa) => pa.status === 'approved');
  if (!payApp) throw new Error('no approved pay app on Biscayne Retail Plaza — run pay-app-approval first');
  const gulfstream = await projectNamed(api, 'Gulfstream Bank Branch — Ductwork Upgrade');
  const prefs = await api.get('/api/users/me/preferences');
  return { payAppId: payApp.id, ganttProjectId: gulfstream.id, viewMode: prefs.projectTaskViewMode ?? 'list' };
}

export default async function scene({ page, goto, click, waitFor, wait, data, log }) {
  const snap = await solutionsSnapper(page, 'hvac', log);

  await goto(`/pay-apps/${data.payAppId}`, 800);
  await waitFor('main >> text=Payment Application Summary', 20000);
  await wait(600);
  await snap('pay-app-detail');

  await goto(`/projects/${data.ganttProjectId}#plan`, 800);
  await waitFor('main button:has-text("Gantt")', 20000);
  await click('main button:has-text("Gantt")');
  await waitFor('main button:has-text("Today")');
  const toolbarTop = await page
    .locator('main button:has-text("Today")')
    .evaluate((el) => el.getBoundingClientRect().top);
  await scrollPage(page, toolbarTop - 232, { settle: 1200 });
  await snap('project-gantt');

  if (data.viewMode !== 'gantt') {
    await click('main button:has-text("List")');
    await wait(800);
  }
}
