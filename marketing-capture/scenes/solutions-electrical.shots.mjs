// /solutions/electrical-contractors/ screenshots, from Volt Pro Electric (run
// with CAPTURE_USER=tnguyen):
//   public/screenshots/solutions/electrical/bid-detail-overview.png
//   public/screenshots/solutions/electrical/project-phases-tasks.png
// An EV-charging + service-upgrade estimate priced from the tenant's catalog,
// and a project sequenced permits → underground → rough-in → trim & energize.
import { setTaskView, stageSchedule } from '../lib/demo-projects.mjs';
import {
  ELECTRICAL_BID,
  ELECTRICAL_SCHEDULE,
  assertUser,
  frameEstimate,
  framePhases,
  matchProjectCustomer,
  pickContact,
  projectNamed,
  solutionsSnapper,
  stageEstimate,
} from '../lib/demo-trades.mjs';

export const meta = { name: 'solutions-electrical', video: false, viewport: 'hd', scale: 1, strict: true };

export async function setup({ api, log }) {
  await assertUser(api, 'tnguyen');
  const gc = await pickContact(api, /Construction Group$/);
  const bid = await stageEstimate(api, {
    ...ELECTRICAL_BID,
    customer: gc,
    extra: { siteAddress: '8200 NW 41st St', siteCity: 'Doral', siteState: 'FL', siteZipCode: '33166' },
  });

  const project = await projectNamed(api, ELECTRICAL_SCHEDULE.project);
  await matchProjectCustomer(api, project);
  await stageSchedule(api, project.id, { phases: ELECTRICAL_SCHEDULE.phases });
  await setTaskView(api, 'list');
  log(`  ✓ bid ${bid.bidNumber} for ${gc.companyName}; schedule on ${project.name}`);
  return { bidId: bid.id, customer: gc.companyName, projectId: project.id };
}

export default async function scene(ctx) {
  const { page, data, log } = ctx;
  const snap = await solutionsSnapper(page, 'electrical', log);

  await frameEstimate(ctx, data.bidId, { customer: data.customer, expand: 1, ready: '#10 THHN (500ft)' });
  await snap('bid-detail-overview');

  await framePhases(ctx, data.projectId, { open: ['Rough-In & Gear', 'Trim & Energize'] });
  await snap('project-phases-tasks');
}
