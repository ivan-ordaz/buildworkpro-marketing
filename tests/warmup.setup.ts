import { test, expect, type Frame } from '@playwright/test';

/**
 * Absorbs Vite's cold-start reload before any real test runs.
 *
 * On a cold `astro dev`, the first browser page load triggers dependency
 * optimization ("Re-optimizing dependencies because vite config has changed" —
 * CI has no optimizer cache, so this happens every run). When it completes, Vite
 * pushes a full-page reload to the connected client. `page.goto()` has usually
 * already resolved on the first document by then, so the reload destroys the
 * execution context the next `page.evaluate()` targets, and that test dies with
 * "Execution context was destroyed, most likely because of a navigation".
 *
 * It is a race, so it surfaced as a flake in whichever test happened to load a
 * page first — in practice `analytics.spec.ts`'s first consent-posture test.
 *
 * `optimizeDeps.holdUntilCrawlEnd` already defaults to true, so this is not
 * late-dep discovery mid-crawl and cannot be configured away. What we can do is
 * make sure the load that eats the reload is this one, and not a test's.
 *
 * Measured: only the very first load reloads. `/`, a feature page, a docs page
 * and the API reference are all stable on every subsequent load.
 */
test('warm the dev server so no test races the vite cold-start reload', async ({ page }) => {
  // First load — this is the one allowed to reload.
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Second load, instrumented: by now the optimizer is warm, so exactly one
  // navigation should occur. If Vite ever starts reloading beyond the first load,
  // this fails here — in setup, naming the cause — instead of resurfacing as a
  // mystery flake in an unrelated spec.
  let navigations = 0;
  const countNav = (frame: Frame) => {
    if (frame === page.mainFrame()) navigations += 1;
  };
  page.on('framenavigated', countNav);

  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500); // window for a late reload to land, if any

  page.off('framenavigated', countNav);
  expect(navigations, 'the dev server is still reloading after warm-up — a test will race it').toBe(
    1
  );
});
