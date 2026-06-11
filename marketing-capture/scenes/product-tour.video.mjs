// Flagship homepage tour: dashboard → Sales flyout (expanded left menu) →
// pipeline kanban → bids list → projects. Animated cursor, ~20s.
export const meta = {
  name: 'product-tour',
  video: true,
  viewport: 'desktop',
  warmup: ['/dashboard', '/pipeline', '/bids', '/projects'],
};

const FLYOUT = 'div[class*="left-14"]';

export default async function scene({ goto, click, moveTo, scrollTo, wait }) {
  await goto('/dashboard', 1000);
  await wait(800);
  await scrollTo(300);
  await wait(700);
  await scrollTo(0);
  await wait(500);

  // Expand the left menu (Sales flyout) and show its contents.
  await click('button[aria-label="Sales"]');
  await wait(900);
  await moveTo(`${FLYOUT} :text("Pipeline")`);
  await wait(550);
  await moveTo(`${FLYOUT} :text("Bids")`);
  await wait(550);
  await moveTo(`${FLYOUT} :text("Add Lead")`);
  await wait(600);

  // Into the pipeline from the flyout.
  await click(`${FLYOUT} :text("Pipeline")`);
  await wait(1200);
  await moveTo('main h4[class*="cursor-pointer"]');
  await wait(800);
  await scrollTo(200);
  await wait(700);

  await goto('/bids', 1000);
  await moveTo('table tbody tr, [role="row"]');
  await wait(700);
  await scrollTo(320);
  await wait(800);

  await goto('/projects', 1000);
  await moveTo('main button[class*="cursor-pointer"]');
  await wait(900);
}
