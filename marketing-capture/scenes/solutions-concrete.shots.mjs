// /solutions/concrete-contractors/ screenshots, from Solid Ground Concrete
// (run with CAPTURE_USER=mherrera):
//   public/screenshots/solutions/concrete/project-phases-tasks.png
//   public/screenshots/solutions/concrete/site-logs-list.png
// A slab-on-grade job sequenced layout → forming → rebar → inspection →
// placement → cure, and the tenant's site logs rewritten as a concrete crew's
// daily record (pours, mix deliveries, compaction tests, cylinder breaks).
import { setTaskView, stageSchedule } from '../lib/demo-projects.mjs';
import {
  CONCRETE_SCHEDULE,
  CONCRETE_SITE_LOGS,
  assertUser,
  framePhases,
  matchProjectCustomer,
  polishTradeSiteLogs,
  projectNamed,
  solutionsSnapper,
} from '../lib/demo-trades.mjs';

export const meta = { name: 'solutions-concrete', video: false, viewport: 'hd', scale: 1, strict: true };

export async function setup({ api, log }) {
  await assertUser(api, 'mherrera');
  const project = await projectNamed(api, CONCRETE_SCHEDULE.project);
  await matchProjectCustomer(api, project);
  await stageSchedule(api, project.id, { phases: CONCRETE_SCHEDULE.phases });
  await setTaskView(api, 'list');
  const logs = await polishTradeSiteLogs(api, CONCRETE_SITE_LOGS);
  log(`  ✓ schedule on ${project.name}; ${Object.keys(logs).length} site-log titles written`);
  return { projectId: project.id, newestLog: CONCRETE_SITE_LOGS.at(-1).title };
}

export default async function scene(ctx) {
  const { page, goto, waitFor, wait, data, log } = ctx;
  const snap = await solutionsSnapper(page, 'concrete', log);

  await framePhases(ctx, data.projectId, { open: ['Placement & Finish', 'Cure & Close Out'] });
  await snap('project-phases-tasks');

  await goto('/site-logs', 800);
  await waitFor(`main >> text=${data.newestLog}`, 20000);
  await page.locator('main').getByText(data.newestLog).first().waitFor();
  await wait(600);
  await snap('site-logs-list');
}
