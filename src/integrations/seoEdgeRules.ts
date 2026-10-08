// Build-time Cloudflare edge rules for crawl hygiene. Appends to the `_headers`
// and `_redirects` files in the static output; the Cloudflare adapter writes
// to the same files in its own build:done hook (Cache-Control for /_astro/*
// and the `redirects` from astro.config.mjs), so this hook only ever appends
// to whatever is already there.
//
// 1. Template downloads → canonical landing page. The 144 files under
//    /templates-files/ are linked from every template page and Google indexes
//    PDF, DOCX and XLSX as standalone documents. Without a hint they compete
//    with their own landing page and land searchers on a file with no
//    navigation. A `Link: rel="canonical"` header (the documented way to
//    canonicalize a non-HTML file) folds them into the template page. One rule
//    per template covers its PDF/DOCX/XLSX and the -example.pdf.
//
// 2. Un-slashed URLs → 301. Workers static assets redirect /pricing to
//    /pricing/ with a 307 (temporary). With `trailingSlash: 'always'` the
//    slashed URL is the only canonical, so every built page gets an explicit
//    301 for its un-slashed form. _redirects rules run before asset matching.
//
// Guarded by tests/api-seo-edge-rules.spec.ts (against the built Worker).
import type { AstroIntegration } from 'astro';
import { appendFile, readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { TEMPLATE_LIST } from '../data/templates';

/** Cloudflare caps _headers at 100 rules; the adapter uses one. */
const MAX_HEADER_RULES = 99;
/** Cloudflare caps static _redirects rules at 2,000. */
const MAX_STATIC_REDIRECTS = 2000;

export function templateFileHeaderRules(
  site: string,
  templates: ReadonlyArray<{ slug: string; basename: string }> = TEMPLATE_LIST
): string {
  // A basename that prefixes another would give the longer one's files two
  // conflicting canonicals, so refuse to build rather than ship that.
  for (const a of templates) {
    for (const b of templates) {
      if (a !== b && b.basename.startsWith(a.basename)) {
        throw new Error(`seoEdgeRules: template basename "${a.basename}" prefixes "${b.basename}"`);
      }
    }
  }
  if (templates.length > MAX_HEADER_RULES) {
    throw new Error(`seoEdgeRules: ${templates.length} header rules exceeds the Cloudflare cap`);
  }
  return templates
    .map((t) => {
      const canonical = new URL(`/templates/${t.slug}/`, site).href;
      return `/templates-files/${t.basename}*\n  Link: <${canonical}>; rel="canonical"\n`;
    })
    .join('');
}

export function trailingSlashRedirectRules(pagePaths: readonly string[]): string {
  const rules = pagePaths
    .filter((p) => p !== '/' && p.endsWith('/'))
    .map((p) => `${p.slice(0, -1)} ${p} 301\n`);
  if (rules.length > MAX_STATIC_REDIRECTS) {
    throw new Error(`seoEdgeRules: ${rules.length} redirects exceeds the Cloudflare cap`);
  }
  return rules.join('');
}

/** Every `<dir>/index.html` in the build output, as its slashed URL path. */
async function builtPagePaths(clientDir: string): Promise<string[]> {
  const entries = await readdir(clientDir, { recursive: true, withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name === 'index.html')
    .map((e) => path.relative(clientDir, e.parentPath).split(path.sep).join('/'))
    .map((rel) => (rel ? `/${rel}/` : '/'))
    .sort();
}

async function appendBlock(file: string, block: string): Promise<void> {
  let existing = '';
  try {
    existing = await readFile(file, 'utf-8');
  } catch {
    // No file yet — the adapter may run after this hook.
  }
  const sep = existing && !existing.endsWith('\n') ? '\n' : '';
  await appendFile(file, sep + block);
}

export default function seoEdgeRules(): AstroIntegration {
  let clientDir = '';
  let site = '';
  return {
    name: 'seo-edge-rules',
    hooks: {
      'astro:config:done': ({ config }) => {
        clientDir = fileURLToPath(config.build.client);
        site = config.site ?? 'https://buildworkpro.com';
      },
      'astro:build:done': async ({ logger }) => {
        const headers = templateFileHeaderRules(site);
        await appendBlock(path.join(clientDir, '_headers'), headers);

        const pages = await builtPagePaths(clientDir);
        const redirects = trailingSlashRedirectRules(pages);
        await appendBlock(path.join(clientDir, '_redirects'), redirects);

        logger.info(
          `${TEMPLATE_LIST.length} template-file canonical headers, ` +
            `${redirects.split('\n').filter(Boolean).length} un-slashed → slashed 301s`
        );
      },
    },
  };
}
