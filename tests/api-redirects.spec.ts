import { test, expect } from '@playwright/test';

// Permanent redirects from the `redirects` block in astro.config.mjs. The build
// writes them to dist/client/_redirects, which only the Workers runtime honours,
// so this lives in the `api-` project (astro preview → wrangler), where the
// status code is the real one Google sees rather than the dev server's.

for (const [from, to] of [
  // Merged into the daily report guide (2026-10 topic-owner pass).
  ['/blog/construction-site-log-best-practices/', '/blog/construction-daily-report-template/'],
  ['/features/ai-assistant/', '/agents/'],
] as const) {
  test(`${from} is a 301 to ${to}`, async ({ request }) => {
    const res = await request.get(from, { maxRedirects: 0 });
    expect(res.status()).toBe(301);
    expect(new URL(res.headers()['location'], 'http://x').pathname).toBe(to);
  });
}
