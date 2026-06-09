// Video proof scene: a smooth product tour with the animated cursor.
// Navigates by URL (robust) and moves/scrolls to make it feel interactive.
export const meta = {
  name: 'product-tour',
  video: true,
  viewport: 'desktop',
  warmup: ['/dashboard', '/bids', '/projects', '/pipeline'],
};

export default async function scene({ goto, moveTo, scrollTo, wait }) {
  await goto('/dashboard', 1000);
  await wait(700);
  await scrollTo(380);
  await wait(700);
  await scrollTo(0);
  await wait(500);

  await goto('/bids', 1000);
  await moveTo('table tbody tr, [role="row"], a[href^="/bids/"]');
  await wait(700);
  await scrollTo(320);
  await wait(800);

  await goto('/projects', 1000);
  await moveTo('button:has-text("New Project"), table tbody tr, [role="row"]');
  await wait(900);

  await goto('/pipeline', 1200);
  await wait(800);
  await scrollTo(220);
  await wait(900);
}
