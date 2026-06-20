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
};

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
  const unreviewed = [...ids].filter((id) => !ALLOWLIST[id]);
  if (unreviewed.length > 0) {
    offenders.push({ name, severity: vuln.severity, ids: unreviewed });
  }
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
  process.exit(1);
}

console.log(
  `No unreviewed high/critical production advisories ` +
    `(${Object.keys(ALLOWLIST).length} build-tooling advisory IDs allowlisted).`
);
