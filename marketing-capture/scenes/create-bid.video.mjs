// #196 — interactive "create a bid" walkthrough video with the animated cursor.
// Robust to unknown form field ids: each step skips gracefully if not found.
export const meta = {
  name: 'create-bid',
  video: true,
  viewport: 'desktop',
  warmup: ['/bids', '/bids/new'],
};

export default async function scene({ goto, click, type, scrollTo, wait, page }) {
  await goto('/bids', 900);
  await wait(700);

  // Kick off the create flow from the list (falls back to direct nav).
  await click('a[href="/bids/new"], button:has-text("New Bid"), a:has-text("New Bid")');
  await wait(1300);
  if (!page.url().includes('/bids/new')) {
    await goto('/bids/new', 1200);
  }
  await wait(900);

  // "Bid Name" field — its placeholder is "e.g. Marina Bay HVAC Retrofit".
  // type() no-ops gracefully if the form markup changes.
  await type(
    'input[placeholder*="Marina" i], input[placeholder*="Retrofit" i], input[placeholder^="e.g." i]',
    'Downtown Office — HVAC Retrofit'
  );
  await wait(1000);

  // Show the estimate / line-item area by scrolling through the editor.
  await scrollTo(320);
  await wait(900);
  await scrollTo(640);
  await wait(900);
  await scrollTo(0);
  await wait(700);
}
