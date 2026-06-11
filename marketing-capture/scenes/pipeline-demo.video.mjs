// Demo video: CRM pipeline — expand the Sales flyout from the rail, jump to
// the kanban, sweep cards, open a lead. Selectors degrade gracefully.
export const meta = {
  name: 'pipeline-demo',
  video: true,
  viewport: 'desktop',
  warmup: ['/dashboard', '/pipeline'],
};

const FLYOUT = 'div[class*="left-14"]';

export default async function scene({ goto, click, moveTo, scrollTo, wait, page }) {
  await goto('/dashboard', 1000);
  await wait(600);

  // Expanded left menu: open the Sales flyout, then enter the pipeline.
  await click('button[aria-label="Sales"]');
  await wait(900);
  await moveTo(`${FLYOUT} :text("Pipeline")`);
  await wait(500);
  await click(`${FLYOUT} :text("Pipeline")`);
  await wait(1300);
  if (!page.url().includes('/pipeline') && !page.url().includes('/leads')) {
    await goto('/pipeline', 1200);
  }
  await wait(600);

  // Sweep the cursor across a few kanban cards left → right.
  const cards = page.locator('main h4[class*="cursor-pointer"]');
  const count = await cards.count().catch(() => 0);
  if (count > 0) {
    for (const i of [0, Math.min(2, count - 1), Math.min(5, count - 1)]) {
      await moveTo(cards.nth(i));
      await wait(650);
    }
  } else {
    await scrollTo(200);
    await wait(800);
  }

  // Open a lead detail and give it a beat.
  await click('main h4[class*="cursor-pointer"]');
  await wait(1400);
  if (/\/leads\/.+/.test(page.url())) {
    await scrollTo(320);
    await wait(900);
    await scrollTo(0);
    await wait(600);
  } else {
    await wait(600);
  }
}
