// Demo video: pay applications — list, open a detail, walk the schedule of
// values and approval status. Selectors degrade gracefully (helpers no-op).
export const meta = {
  name: 'pay-app-demo',
  video: true,
  viewport: 'desktop',
  warmup: ['/pay-apps'],
};

export default async function scene({ goto, click, moveTo, scrollTo, wait, page }) {
  await goto('/pay-apps', 1000);
  await wait(800);

  // Hover a row, then open the first pay app detail.
  await moveTo('table tbody tr, [role="row"], a[href^="/pay-apps/"]');
  await wait(600);
  await click('table tbody tr');
  await wait(1400);

  // If the click didn't navigate (markup drift), bail back to the list view
  // so the video still shows something coherent.
  if (!/\/pay-apps\/.+/.test(page.url())) {
    await scrollTo(300);
    await wait(900);
    await scrollTo(0);
    await wait(600);
    return;
  }

  // Walk the detail: status/stepper area, then the schedule of values.
  await moveTo('h1, [data-testid="status"], .stepper, nav[aria-label*="progress" i]');
  await wait(700);
  await scrollTo(360);
  await wait(900);
  await scrollTo(760);
  await wait(1000);
  await scrollTo(1100);
  await wait(900);
  await scrollTo(0);
  await wait(700);
}
