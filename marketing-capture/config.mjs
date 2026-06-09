// Central config for the marketing capture kit.
// All values are overridable via env vars so scenes stay declarative.
import { fileURLToPath } from 'node:url';

// The kit drives the MAIN BuildWorkPro app dev server, NOT the marketing site.
// Default is the main app's local dev port (see /Users/ivan/buildworkpro/CLAUDE.md).
export const BASE_URL = process.env.CAPTURE_BASE_URL || 'http://localhost:7782';

// Named viewports. Video records at the CSS viewport size; screenshots are
// multiplied by DEVICE_SCALE_FACTOR for retina crispness.
export const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  laptop: { width: 1280, height: 800 },
  mobile: { width: 390, height: 844 },
};
export const DEFAULT_VIEWPORT = 'desktop';
export const DEVICE_SCALE_FACTOR = 2;

// Where PNG/WEBM/MP4 land. Gitignored by default.
export const OUTPUT_DIR =
  process.env.CAPTURE_OUT || fileURLToPath(new URL('./output/', import.meta.url));

// Seed demo identity. NEVER point this at a prod-clone tenant — marketing
// assets must only ever show the seeded Comfort Climate HVAC demo data.
export const SEED_USER = process.env.CAPTURE_USER || 'rmoreno';
export const SEED_TENANT_HINT = process.env.CAPTURE_TENANT || 'Comfort Climate';

// Headless by default (records video fine). Set CAPTURE_HEADFUL=1 to watch.
export const HEADLESS = !process.env.CAPTURE_HEADFUL;

// Cloudflare Turnstile test secret is wired into local dev, so any token
// validates. We send a dummy so the always-pass test secret accepts it.
export const DUMMY_TURNSTILE = 'XXXX.DUMMY.TOKEN.XXXX';
