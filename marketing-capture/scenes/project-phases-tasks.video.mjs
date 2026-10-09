// Demo video: running a job's schedule from the Plan tab. Collapse to the
// phase overview, open the in-progress phase, mark a task done and watch the
// phase progress bar move, then add the next phase and its first two tasks.
//
// Setup rebuilds the project's phases and tasks into a coherent rooftop
// replacement dated around today (see lib/demo-projects.mjs), which also
// removes the phase this scene added on its previous run. The page load is
// marked as a jump cut; run `node marketing-capture/apply-cuts.mjs project-phases-tasks` after.
import { scrollPage, setTaskView, stageSchedule } from '../lib/demo-projects.mjs';
import { findProject } from '../lib/demo-change-orders.mjs';
import { makeCuts } from '../lib/cuts.mjs';

const PROJECT = 'Pelican Restaurant — Rooftop Replacement';
const DONE_TASK = 'Gas & electrical connections';
const NEW_PHASE = 'Startup & Closeout';
const NEW_TASKS = ['Startup & commissioning', 'Owner walkthrough & closeout docs'];

export const meta = {
  name: 'project-phases-tasks',
  video: true,
  viewport: 'desktop',
  strict: true,
  warmup: ['/projects'],
};

export async function setup({ api }) {
  await setTaskView(api, 'list');
  const { id: projectId } = await findProject(api, PROJECT);
  await stageSchedule(api, projectId, {
    phases: [
      {
        name: 'Submittals & Procurement',
        status: 'completed',
        tasks: [
          { name: 'Equipment submittals approved', who: 'rmoreno', from: -40, to: -35, status: 'done' },
          { name: 'Mechanical permit issued', who: 'mmurphy', from: -34, to: -28, status: 'done' },
          { name: 'Order rooftop units', who: 'rmoreno', from: -33, to: -31, status: 'done' },
        ],
      },
      {
        name: 'Crane Day & Demo',
        status: 'completed',
        tasks: [
          { name: 'Recover refrigerant from old units', who: 'freyes', from: -12, to: -11, status: 'done' },
          { name: 'Crane pick — remove old units', who: 'jrodriguez', from: -8, to: -8, status: 'done' },
          { name: 'Set curb adapters', who: 'jrodriguez', from: -7, to: -5, status: 'done' },
        ],
      },
      {
        name: 'Installation',
        status: 'in_progress',
        tasks: [
          { name: 'Set new rooftop units', who: 'jrodriguez', from: -4, to: -3, status: 'done' },
          { name: DONE_TASK, who: 'freyes', from: -2, to: 3, status: 'in_progress', priority: 'high' },
          { name: 'Ductwork transitions & roof patch', who: 'jrodriguez', from: 4, to: 10, status: 'todo' },
        ],
      },
    ],
  });
  return { projectId };
}

export default async function scene({ goto, click, type, moveTo, waitFor, wait, page, data, meta }) {
  const { cut, save } = makeCuts(meta.name, page);

  await cut(async () => {
    await goto(`/projects/${data.projectId}#plan`, 300);
    await waitFor('[data-phase-header]:has-text("Installation")');
    await wait(300);
  });
  await wait(1000);

  // Phase overview: every phase with its own progress bar. (No scroll first:
  // collapsing shrinks the page, which would snap a scrolled view back up.)
  await click('button:has-text("Collapse all")');
  await wait(900);

  // Open the phase in progress and finish a task.
  await click('[data-phase-header]:has-text("Installation") span.font-medium');
  await waitFor(`[data-task-row]:has-text("${DONE_TASK}")`);
  await scrollPage(page, 260, { settle: 700 });
  const statusDot = page.locator('[data-task-row]', { hasText: DONE_TASK }).locator('button').nth(1);
  await click(statusDot);
  // 1/3 → 2/3 tasks: the phase bar moves from 33% to 67%.
  await waitFor('[data-phase-header]:has-text("Installation") >> text=67%');
  await moveTo('[data-phase-header]:has-text("Installation") >> text=67%');
  await wait(1300);

  // Add the next phase…
  await type('input[placeholder="Add new phase..."]', NEW_PHASE, { delay: 50 });
  await wait(300);
  await click('button:has-text("Add Phase")');
  await waitFor(`[data-phase-header]:has-text("${NEW_PHASE}")`);
  await wait(500);
  await scrollPage(page, 10000);

  // …and its first tasks.
  const phaseCard = page.locator('div.border.rounded-lg', {
    has: page.locator('[data-phase-header]', { hasText: NEW_PHASE }),
  });
  const addTask = phaseCard.locator('input[placeholder="Add task..."]');
  for (const name of NEW_TASKS) {
    await type(addTask, name, { delay: 40 });
    await page.keyboard.press('Enter');
    await waitFor(phaseCard.locator('[data-task-row]', { hasText: name }));
    await wait(500);
  }
  await moveTo(phaseCard.locator('[data-phase-header]'));
  await wait(2200);
  await save();
}
