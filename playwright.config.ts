import { defineConfig, devices } from '@playwright/test';

// CI uses GitHub Actions; local runs default to non-CI.
const isCI = !!process.env.CI;

// Two runtimes, because one cannot cover both halves of the site.
//
// `astro dev` serves the prerendered marketing pages and docs, and boots fast
// enough to keep the page suites cheap to re-run.
//
// It CANNOT serve the SSR API routes. `src/pages/api/contact.ts` statically
// imports `cloudflare:workers`, and dev resolves SSR modules in Astro's Node
// environment because the adapter is pinned to `prerenderEnvironment: 'node'` —
// which the build requires, since under workerd `satteri` resolves to its browser
// entry and dies on `@bruits/satteri-wasm32-wasi`. So the route 500s with
// FailedToLoadModuleSSR in dev, and only `astro preview` (wrangler → workerd) runs
// it the way production does. The `api` project below is pointed there.
const PORT = 4321;
const PREVIEW_PORT = 4322;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const PREVIEW_URL = `http://127.0.0.1:${PREVIEW_PORT}`;

/** Specs that need the real Workers runtime rather than the dev server. */
const API_SPECS = /api-.*\.spec\.ts/;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: API_SPECS,
    },
    {
      name: 'api',
      use: { ...devices['Desktop Chrome'], baseURL: PREVIEW_URL },
      testMatch: API_SPECS,
    },
  ],

  webServer: [
    {
      // Pages and docs — prerendered, so the dev server is the cheap option.
      command: 'npm run dev -- --host 127.0.0.1',
      url: BASE_URL,
      reuseExistingServer: !isCI,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        // Astro 7 detects coding agents (via `am-i-vibing`) and, when it thinks one
        // is driving, daemonizes `astro dev` and switches to JSON logging. The
        // foreground process then exits immediately and Playwright kills the run with
        // "Process from config.webServer exited early." CI is unaffected — a GitHub
        // runner is not an agent — but an E2E run started from inside an agent
        // session dies before the first test. Setting this variable at all (any
        // value) disables the detection; `astro dev` stays in the foreground for
        // Playwright to manage and tear down.
        ASTRO_DEV_BACKGROUND: '0',
      },
    },
    {
      // SSR API routes — the real Workers runtime, via wrangler.
      //
      // The build is part of the command on purpose. `astro preview` serves whatever
      // is in dist/, so without it a stale bundle can silently answer the assertions
      // and a green run would mean nothing. Locally `reuseExistingServer` skips both
      // the build and the boot when a preview server is already up.
      command: `npm run build && npm run preview -- --port ${PREVIEW_PORT} --host 127.0.0.1`,
      url: PREVIEW_URL,
      reuseExistingServer: !isCI,
      timeout: 180_000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        // Same agent-daemonization trap as `astro dev`, different variable.
        ASTRO_PREVIEW_BACKGROUND: '0',
      },
    },
  ],
});
