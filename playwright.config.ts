import { defineConfig, devices } from '@playwright/test';

// CI uses GitHub Actions; local runs default to non-CI.
const isCI = !!process.env.CI;

// Astro dev server speaks both prerendered + SSR routes, so smoke tests
// can hit static pages and API endpoints without spinning up wrangler.
const PORT = 4321;
const BASE_URL = `http://localhost:${PORT}`;

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
    },
  ],

  webServer: {
    // `astro dev` is faster to boot than build+preview and covers both
    // prerendered marketing pages and SSR-only API routes.
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
});
