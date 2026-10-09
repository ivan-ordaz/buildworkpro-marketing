// /solutions/framing-contractors/ screenshots, from Framework Builders (run
// with CAPTURE_USER=rlang):
//   public/screenshots/solutions/framing/project-gantt.png
//   public/screenshots/solutions/framing/bid-detail-overview.png
// A wood-framing schedule (layout → walls → floor system → roof, chained by
// dependencies around the truss delivery) and a framing package estimate with
// lumber, hardware and carpentry priced from the tenant's catalog.
import { scrollPage, setTaskView, stageSchedule } from '../lib/demo-projects.mjs';
import {
  FRAMING_BID,
  FRAMING_SCHEDULE,
  assertUser,
  frameEstimate,
  matchProjectCustomer,
  pickContact,
  projectNamed,
  solutionsSnapper,
  stageEstimate,
} from '../lib/demo-trades.mjs';

export const meta = { name: 'solutions-framing', video: false, viewport: 'hd', scale: 1, strict: true };

export async function setup({ api, log }) {
  await assertUser(api, 'rlang');
  const gc = await pickContact(api, /Construction Group$/);
  const bid = await stageEstimate(api, {
    ...FRAMING_BID,
    customer: gc,
    extra: { siteAddress: '11850 SW 88th St', siteCity: 'Miami', siteState: 'FL', siteZipCode: '33186' },
  });

  const project = await projectNamed(api, FRAMING_SCHEDULE.project);
  await matchProjectCustomer(api, project);
  await stageSchedule(api, project.id, { phases: FRAMING_SCHEDULE.phases });
  await setTaskView(api, 'list');
  log(`  ✓ bid ${bid.bidNumber} for ${gc.companyName}; schedule on ${project.name}`);
  return { bidId: bid.id, customer: gc.companyName, projectId: project.id };
}

export default async function scene(ctx) {
  const { page, goto, click, waitFor, data, log } = ctx;
  const snap = await solutionsSnapper(page, 'framing', log);

  await goto(`/projects/${data.projectId}#plan`, 800);
  await waitFor('[data-phase-header]:has-text("Roof")', 20000);
  await click('main button:has-text("Gantt")');
  await waitFor('main button:has-text("Today")');
  const toolbarTop = await page
    .locator('main button:has-text("Today")')
    .evaluate((el) => el.getBoundingClientRect().top);
  await scrollPage(page, toolbarTop - 232, { settle: 1200 });
  await snap('project-gantt');
  await click('main button:has-text("List")');

  await frameEstimate(ctx, data.bidId, { customer: data.customer, expand: 1, ready: 'Simpson Hold-Down' });
  await snap('bid-detail-overview');
}
