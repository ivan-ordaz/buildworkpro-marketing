// Demo video: the project schedule as a Gantt. Open a job mid-flight and
// switch the Plan tab to Gantt — phase roll-ups, task bars coloured by status,
// finish-to-start arrows and the red today line. Then reschedule for real:
// punch fixes slip two days, so drag that bar later and drop it; the toast
// confirms and the bar's tooltip shows the new dates, still clear of the
// re-inspection it feeds.
//
// Setup rebuilds the project into a dated ductwork job with a punch-list and
// closeout phase and dependency links (see lib/demo-projects.mjs), which also
// undoes the previous run's drag. The page load is marked as a jump cut; run
// `node marketing-capture/apply-cuts.mjs gantt-demo` after.
import { scrollPage, setTaskView, stageSchedule } from '../lib/demo-projects.mjs';
import { findProject } from '../lib/demo-change-orders.mjs';
import { makeCuts } from '../lib/cuts.mjs';

const PROJECT = 'Gulfstream Bank Branch — Ductwork Upgrade';

// A week-long bar on purpose: at week zoom a bar is drawn (end − start) days
// wide, so a 1- or 2-day task is one 18px day, and the hover edit button plus
// the resize handle cover all of it — such a bar cannot be grabbed to move.
const MOVED = 'Fix punch items';

export const meta = {
  name: 'gantt-demo',
  video: true,
  viewport: 'desktop',
  strict: true,
  warmup: ['/projects'],
};

export async function setup({ api }) {
  await setTaskView(api, 'list');
  const { id: projectId } = await findProject(api, PROJECT);
  const { tasks, dates } = await stageSchedule(api, projectId, {
    phases: [
      {
        name: 'Demo & Rough-In',
        status: 'completed',
        tasks: [
          { name: 'Demo existing ductwork', who: 'jrodriguez', from: -16, to: -13, status: 'done' },
          { name: 'Hang main trunk lines', who: 'jrodriguez', from: -12, to: -7, status: 'done', after: ['Demo existing ductwork'] },
        ],
      },
      {
        name: 'Ductwork Install',
        status: 'in_progress',
        tasks: [
          { name: 'Branch ducts & diffusers', who: 'freyes', from: -6, to: -1, status: 'done', after: ['Hang main trunk lines'] },
          { name: 'VAV boxes & controls', who: 'jrodriguez', from: -4, to: 2, status: 'in_progress', priority: 'high', after: ['Hang main trunk lines'] },
        ],
      },
      {
        name: 'Startup & Balance',
        status: 'pending',
        tasks: [
          { name: 'Duct leakage test', who: 'mmurphy', from: 3, to: 3, status: 'todo', after: ['Branch ducts & diffusers'] },
          { name: 'Test & balance', who: 'freyes', from: 4, to: 8, status: 'todo', after: ['Duct leakage test', 'VAV boxes & controls'] },
        ],
      },
      {
        name: 'Punch List & Closeout',
        status: 'pending',
        tasks: [
          { name: 'Punch list walk with GC', who: 'rmoreno', from: 9, to: 9, status: 'todo', after: ['Test & balance'] },
          { name: MOVED, who: 'jrodriguez', from: 10, to: 15, status: 'todo', after: ['Punch list walk with GC'] },
          { name: 'Re-inspection', who: 'mmurphy', from: 20, to: 20, status: 'todo', after: [MOVED] },
          { name: 'O&M manuals & warranties', who: 'rmoreno', from: 10, to: 16, status: 'todo' },
          { name: 'Conditional lien waivers', who: 'rmoreno', from: 16, to: 18, status: 'todo' },
          { name: 'Final pay application', who: 'rmoreno', from: 22, to: 23, status: 'todo', after: ['Re-inspection', 'Conditional lien waivers'] },
        ],
      },
    ],
  });
  // Slip the punch fixes at least 2 days, landing on a weekday.
  const from = dates[MOVED].start;
  let shiftDays = 2;
  while ([0, 6].includes(new Date(from.getTime() + shiftDays * 86400000).getDay())) shiftDays++;
  return { projectId, movedId: tasks[MOVED], vavId: tasks['VAV boxes & controls'], shiftDays };
}

// Week zoom (the default) draws 18px per day.
const WEEK_DAY_PX = 18;

export default async function scene({ goto, click, moveTo, waitFor, wait, page, data, meta }) {
  const { cut, save } = makeCuts(meta.name, page);

  await cut(async () => {
    await goto(`/projects/${data.projectId}#plan`, 300);
    await waitFor('[data-phase-header]:has-text("Punch List & Closeout")');
    await wait(300);
  });
  await wait(700);

  await click('main button:has-text("Gantt")');
  const bar = page.locator(`[data-task-bar="${data.movedId}"]`);
  await waitFor(bar);
  // Bring the chart into view, its toolbar just below the sticky project
  // header (the page pane starts ~223px down).
  const toolbarTop = await page
    .locator('main button:has-text("Today")')
    .evaluate((el) => el.getBoundingClientRect().top);
  await scrollPage(page, toolbarTop - 232, { settle: 1800 });

  // Work in flight crosses the red today line…
  const vav = page.locator(`[data-task-bar="${data.vavId}"]`);
  const vb = await vav.boundingBox();
  await page.mouse.move(vb.x + vb.width * 0.7, vb.y + vb.height / 2, { steps: 30 });
  await wait(2000);

  // …and the arrows chain it into closeout: walk → fixes → re-inspection.
  await moveTo('main >> text=Punch list walk with GC');
  await wait(700);
  await moveTo(`main >> text=${MOVED}`);
  await wait(700);

  // Hover the bar (tooltip shows its dates), then drag it later and drop it.
  const box = await bar.boundingBox();
  const y = box.y + box.height / 2;
  const x0 = box.x + box.width / 2;
  await page.mouse.move(x0, y, { steps: 28 });
  await wait(1600);
  await page.mouse.down();
  await page.mouse.move(x0 + data.shiftDays * WEEK_DAY_PX, y, { steps: 45 });
  await wait(250);
  await page.mouse.up();
  await waitFor('text=Task rescheduled');
  await wait(600);

  // Step off and back onto the moved bar so its tooltip reads the new dates.
  const x1 = x0 + data.shiftDays * WEEK_DAY_PX;
  await page.mouse.move(x1, y + 70, { steps: 12 });
  await wait(400);
  await page.mouse.move(x1 + 8, y + 2, { steps: 14 });
  await wait(3400);
  await save();
}
