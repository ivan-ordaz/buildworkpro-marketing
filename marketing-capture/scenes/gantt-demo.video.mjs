// Demo video: project schedule — expand the Projects flyout, open a project,
// switch Phases & Tasks to the Gantt view, pan the timeline.
export const meta = {
  name: 'gantt-demo',
  video: true,
  viewport: 'desktop',
  warmup: ['/dashboard', '/projects'],
};

const FLYOUT = 'div[class*="left-14"]';

export default async function scene({ goto, click, moveTo, scrollTo, wait, page }) {
  await goto('/dashboard', 1000);
  await wait(600);

  // Expanded left menu: open the Projects flyout, then the projects list.
  await click('button[aria-label="Projects"]');
  await wait(900);
  await moveTo(`${FLYOUT} :text("All Projects")`);
  await wait(500);
  await click(`${FLYOUT} :text("All Projects")`);
  await wait(1300);
  if (!page.url().includes('/projects')) {
    await goto('/projects', 1000);
  }
  await wait(600);

  await moveTo('main button[class*="cursor-pointer"]');
  await wait(600);
  await click('main button[class*="cursor-pointer"]');
  await wait(1400);

  if (!/\/projects\/.+/.test(page.url())) {
    await scrollTo(300);
    await wait(900);
    await scrollTo(0);
    await wait(600);
    return;
  }

  // Phases & Tasks tab, then the Gantt view toggle in the tab header.
  await click('[role="tab"]:has-text("Phases")');
  await wait(1200);
  await click('main button:has-text("Gantt")');
  await wait(1500);

  // Pan around the chart.
  await moveTo('main svg, main canvas, [class*="gantt" i]');
  await wait(800);
  await scrollTo(280);
  await wait(900);
  await scrollTo(0);
  await wait(700);
}
