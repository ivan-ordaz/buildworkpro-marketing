// Demo video: building the schedule — the Phases & Tasks tab, the Add Phase
// control, and the task editor (dates, duration, checklist, dependencies).
// Non-destructive: opens editors without saving.
const PROJECT_ID = process.env.CAPTURE_PROJECT_ID || '87093';

export const meta = {
  name: 'project-phases-tasks',
  video: true,
  viewport: 'desktop',
  warmup: ['/projects', `/projects/${PROJECT_ID}`],
};

export default async function scene({ goto, click, moveTo, scrollTo, wait, page }) {
  await goto(`/projects/${PROJECT_ID}`, 1200);
  await wait(900);
  await click('[role="tab"]:has-text("Phases")');
  await wait(1400);
  // Phases with their nested tasks.
  await moveTo('main table tbody tr').catch(() => {});
  await wait(800);
  await moveTo('main button:has-text("Add Phase")').catch(() => {});
  await wait(900);
  // Open a task to reveal the editor (dates, duration, checklist, dependencies).
  const task = page.locator('main table tbody tr').first();
  await task.click({ timeout: 2500 }).catch(() => {});
  await wait(1400);
  await moveTo('text=/Start Date/i').catch(() => {});
  await wait(700);
  await moveTo('text=/Duration/i').catch(() => {});
  await wait(700);
  await moveTo('text=/Depend/i').catch(() => {});
  await wait(800);
  await page.keyboard.press('Escape').catch(() => {});
  await wait(600);
}
