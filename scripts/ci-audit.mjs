#!/usr/bin/env node
/**
 * CI audit gate for production dependencies.
 *
 * `npm audit --omit=dev` flags advisories in our build/dev toolchain (esbuild,
 * vite, wrangler, @cloudflare/vite-plugin, ws, …) because those packages live in
 * `dependencies`. None of them run inside the deployed Cloudflare Worker, so an
 * unfixable advisory there must not block merges (the project's documented intent).
 *
 * This gate fails only on high/critical production advisories that are NOT in the
 * reviewed allowlist below — so a brand-new, unreviewed advisory still blocks CI
 * and forces a human decision.
 */
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Reviewed advisories that are build/dev tooling only (never shipped to the
// deployed Worker) and currently have no non-breaking fix. Revisit when fixes land.
const ALLOWLIST = {
  'GHSA-gv7w-rqvm-qjhr':
    'esbuild Deno-install integrity RCE — build-time only, installed via npm, never in the deployed Worker. No fix available.',
  'GHSA-g7r4-m6w7-qqqr':
    'esbuild dev-server arbitrary file read (Windows) — dev-only; we build on Linux/macOS and deploy to Cloudflare. No fix available.',
  'GHSA-96hv-2xvq-fx4p':
    'ws DoS via wrangler/@cloudflare/vite-plugin build tooling — not used by the deployed Worker (Cloudflare native WebSocket). Fix only via a breaking @astrojs/cloudflare bump.',
  // undici (high) — pulled in only by miniflare (local Workers simulator) via
  // @astrojs/cloudflare → @cloudflare/vite-plugin → miniflare. Used at dev/build
  // time only; the deployed Worker uses Cloudflare's native fetch, never undici.
  // Fix only via a breaking @astrojs/cloudflare bump. `npm ls undici` confirms the
  // single path. Revisit when @astrojs/cloudflare ships a miniflare with patched undici.
  'GHSA-vmh5-mc38-953g': 'undici via miniflare (dev/build only) — not in the deployed Worker.',
  'GHSA-pr7r-676h-xcf6': 'undici via miniflare (dev/build only) — not in the deployed Worker.',
  'GHSA-p88m-4jfj-68fv': 'undici via miniflare (dev/build only) — not in the deployed Worker.',
  'GHSA-vxpw-j846-p89q': 'undici via miniflare (dev/build only) — not in the deployed Worker.',
  'GHSA-hm92-r4w5-c3mj': 'undici via miniflare (dev/build only) — not in the deployed Worker.',
  'GHSA-35p6-xmwp-9g52': 'undici via miniflare (dev/build only) — not in the deployed Worker.',
  'GHSA-g8m3-5g58-fq7m': 'undici via miniflare (dev/build only) — not in the deployed Worker.',
  // Second undici batch (2026-08). Same single path — `npm ls undici` still shows
  // only @astrojs/cloudflare → @cloudflare/vite-plugin → miniflare → undici — so the
  // reviewed rationale above applies unchanged.
  'GHSA-8xcm-r25x-g524': 'undici via miniflare (dev/build only) — not in the deployed Worker.',
  'GHSA-4cwx-7wf7-3272': 'undici via miniflare (dev/build only) — not in the deployed Worker.',
  'GHSA-m8rv-5g2x-5cg5': 'undici via miniflare (dev/build only) — not in the deployed Worker.',
  'GHSA-jr45-8vmc-qm54': 'undici via miniflare (dev/build only) — not in the deployed Worker.',
  'GHSA-v3r7-h72x-cjcm': 'undici via miniflare (dev/build only) — not in the deployed Worker.',
  // sharp → libvips CVEs. Two paths, both build-time: astro's image optimization
  // (runs under Node during prerender, per prerenderEnvironment: 'node') and
  // miniflare. Cloudflare's runtime has no libvips and we ship no sharp binary.
  // npm's only offered fix is a semver-major astro bump — see ASTRO_XSS below.
  'GHSA-f88m-g3jw-g9cj':
    'sharp/libvips via astro image optimization + miniflare — build-time only, never in the deployed Worker.',
};

/**
 * Astro XSS advisories — CONDITIONAL exemptions, reviewed 2026-08-10.
 *
 * Unlike everything in ALLOWLIST, astro DOES run inside the deployed Worker, so
 * "it's only build tooling" is not available as a reason. These are exempt only
 * because none of the vulnerable code paths exist in this site, which was verified
 * against `src/` — and that is a property of our source, not of astro, so it can
 * silently stop being true the moment someone adds a view transition or an island.
 *
 * Each entry therefore carries a precondition. If `src/` starts matching, the
 * exemption is revoked automatically and CI fails again with a pointed message.
 * The real fix is astro >= 7.2.0 (semver-major across astro, @astrojs/cloudflare,
 * starlight, mdx and expressive-code) — tracked separately.
 */
const ASTRO_XSS = {
  'GHSA-4g3v-8h47-v7g6': 'Reflected XSS via unescaped View Transition animation properties',
  'GHSA-f48w-9m4c-m7f5': 'XSS via unescaped spread attribute names in renderHTMLElement',
  'GHSA-7pw4-f3q4-r2p2': 'XSS via unescaped transition:* directive values on hydrated islands',
};

/**
 * Source patterns that would make the ASTRO_XSS advisories reachable. Verified
 * absent on 2026-08-10; `SPREAD_BASELINE` pins the one spread attribute that does
 * exist (`src/pages/developers.astro` — a hardcoded `download` attribute name, not
 * attacker-controlled, so GHSA-f48w cannot fire on it).
 */
const REACHABILITY = [
  { re: /transition:(name|animate|persist)\b/, why: 'a transition:* directive' },
  { re: /<(ClientRouter|ViewTransitions)\b/, why: 'the view-transitions router' },
  { re: /\bclient:(load|idle|visible|only|media)\b/, why: 'a hydrated island' },
];
const SPREAD_RE = /\{\s*\.\.\./g;
const SPREAD_BASELINE = 1;

const BLOCKING = new Set(['high', 'critical']);

function getAuditJson() {
  try {
    return execSync('npm audit --omit=dev --json', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    // npm audit exits non-zero when advisories exist; the JSON is still on stdout.
    return err.stdout ? err.stdout.toString() : '';
  }
}

/** Every source file the site is built from (.astro/.ts/.tsx/.js/.jsx/.md/.mdx). */
function sourceFiles(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(path, acc);
    else if (/\.(astro|[jt]sx?|mdx?)$/.test(entry.name)) acc.push(path);
  }
  return acc;
}

/**
 * Re-verify the ASTRO_XSS preconditions. Returns [] while the vulnerable features
 * stay unused; otherwise returns human-readable reasons the exemption is revoked.
 */
function astroExemptionBreaks() {
  const breaks = [];
  let spreads = 0;
  for (const file of sourceFiles('src')) {
    const text = readFileSync(file, 'utf8');
    for (const { re, why } of REACHABILITY) {
      if (re.test(text)) breaks.push(`${file} now uses ${why}`);
    }
    spreads += (text.match(SPREAD_RE) || []).length;
  }
  if (spreads !== SPREAD_BASELINE) {
    breaks.push(
      `spread-attribute count changed (${SPREAD_BASELINE} reviewed, ${spreads} found) — ` +
        're-check that no spread supplies an attacker-controlled attribute NAME, then update SPREAD_BASELINE'
    );
  }
  return breaks;
}

const astroBreaks = astroExemptionBreaks();
const astroExempt = astroBreaks.length === 0;

const raw = getAuditJson();
if (!raw.trim()) {
  console.error('npm audit produced no output — failing closed.');
  process.exit(2);
}

const report = JSON.parse(raw);
const offenders = [];

for (const [name, vuln] of Object.entries(report.vulnerabilities || {})) {
  if (!BLOCKING.has(vuln.severity)) continue;
  const ids = new Set();
  for (const via of vuln.via || []) {
    if (via && typeof via === 'object' && typeof via.url === 'string') {
      const match = via.url.match(/GHSA-[0-9a-z-]+/i);
      if (match) ids.add(match[0]);
    }
  }
  // Transitive packages carry no direct GHSA (their `via` lists source package
  // names); they are covered when we evaluate the source package itself.
  if (ids.size === 0) continue;
  const unreviewed = [...ids].filter((id) => !ALLOWLIST[id] && !(astroExempt && ASTRO_XSS[id]));
  if (unreviewed.length > 0) {
    offenders.push({ name, severity: vuln.severity, ids: unreviewed });
  }
}

if (!astroExempt) {
  console.error(
    'The conditional Astro XSS exemption has been REVOKED — this site now reaches the\n' +
      'vulnerable code paths:'
  );
  for (const b of astroBreaks) console.error(`  - ${b}`);
  console.error(
    '\nThese are real XSS advisories in a package that runs in the deployed Worker.\n' +
      'Upgrade to astro >= 7.2.0, or remove the usage above. Do NOT move these IDs into\n' +
      'ALLOWLIST — that list is for build tooling that never ships.'
  );
}

if (offenders.length > 0) {
  console.error('Unreviewed high/critical production advisories:');
  for (const o of offenders) {
    console.error(`  - ${o.name} (${o.severity}): ${o.ids.join(', ')}`);
  }
  console.error(
    '\nReview each advisory. If it affects the deployed Cloudflare Worker, fix it. ' +
      'If it is build/dev tooling with no shippable fix, add its GHSA id to ALLOWLIST ' +
      'in scripts/ci-audit.mjs with a justification.'
  );
}

if (!astroExempt || offenders.length > 0) process.exit(1);

console.log(
  `No unreviewed high/critical production advisories ` +
    `(${Object.keys(ALLOWLIST).length} build-tooling advisory IDs allowlisted, ` +
    `${Object.keys(ASTRO_XSS).length} astro XSS advisories conditionally exempt — ` +
    `preconditions re-verified against src/).`
);
