#!/usr/bin/env node
// Internal-link graph check over the built site (dist/client). Run after
// `npm run build`.
//
//   node scripts/check-internal-links.mjs            # report
//   node scripts/check-internal-links.mjs --page /blog/foo/   # who links to one page
//
// Fails (exit 1) on internal links to pages that don't exist. Warns on
// marketing pages with fewer than MIN_INBOUND contextual inbound links —
// "contextual" means from body content, not the header/footer/nav/aside
// chrome that every page shares. Pages nothing links to from content rarely
// rank, and a new post only links *out* until something links back to it.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = 'dist/client';
const MIN_INBOUND = 3;
// Sections whose pages are meant to rank and should be linked from content.
const CHECKED_SECTIONS = [
  'blog',
  'templates',
  'features',
  'solutions',
  'compare',
  'tools',
  'prices',
];
const CHROME_TAGS = new Set(['header', 'footer', 'nav', 'aside']);
const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name === 'index.html') out.push(p);
  }
  return out;
}

function normalize(href) {
  let h = href.trim();
  if (h.startsWith('https://buildworkpro.com'))
    h = h.slice('https://buildworkpro.com'.length) || '/';
  if (!h.startsWith('/') || h.startsWith('//')) return null;
  h = h.split('#')[0].split('?')[0];
  if (!h || /\.[a-z0-9]+$/i.test(h)) return null; // files, not pages
  return h.endsWith('/') ? h : `${h}/`;
}

function parse(html) {
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');
  const noindex = /<meta[^>]+name=["']robots["'][^>]+noindex/i.test(html);
  const all = new Set();
  const content = new Set();
  const stack = [];
  let chromeDepth = 0;
  for (const m of body.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)([^>]*?)(\/?)>/g)) {
    const [, closing, rawTag, attrs, selfClosing] = m;
    const tag = rawTag.toLowerCase();
    if (closing) {
      const i = stack.lastIndexOf(tag);
      if (i !== -1) {
        for (const t of stack.splice(i)) if (CHROME_TAGS.has(t)) chromeDepth--;
      }
      continue;
    }
    if (tag === 'a') {
      const href = attrs.match(/\shref=["']([^"']*)["']/i)?.[1];
      const url = href && normalize(href.replace(/&amp;/g, '&'));
      if (url) {
        all.add(url);
        if (chromeDepth === 0) content.add(url);
      }
    }
    if (selfClosing || VOID_TAGS.has(tag)) continue;
    stack.push(tag);
    if (CHROME_TAGS.has(tag)) chromeDepth++;
  }
  return { all, content, noindex };
}

const pages = new Map();
for (const file of walk(ROOT)) {
  const rel = relative(ROOT, file).replace(/index\.html$/, '');
  pages.set(`/${rel}`.replace(/\/+$/, '/') || '/', parse(readFileSync(file, 'utf8')));
}

const inbound = new Map([...pages.keys()].map((u) => [u, new Set()]));
const broken = new Map();
for (const [url, page] of pages) {
  for (const target of page.all) {
    if (!pages.has(target)) {
      if (!broken.has(target)) broken.set(target, new Set());
      broken.get(target).add(url);
    }
  }
  for (const target of page.content) {
    if (target !== url && inbound.has(target)) inbound.get(target).add(url);
  }
}

const pageArg = process.argv.indexOf('--page');
if (pageArg !== -1) {
  const target = normalize(process.argv[pageArg + 1] ?? '');
  const from = target && inbound.get(target);
  if (!from) {
    console.error(`No built page at ${process.argv[pageArg + 1]}`);
    process.exit(1);
  }
  console.log(`${target} — ${from.size} contextual inbound link(s):`);
  for (const u of [...from].sort()) console.log(`  ${u}`);
  process.exit(0);
}

const weak = [...pages]
  .filter(([url, page]) => {
    const section = url.split('/')[1];
    return !page.noindex && CHECKED_SECTIONS.includes(section) && url !== `/${section}/`;
  })
  .map(([url]) => [url, inbound.get(url).size])
  .filter(([, n]) => n < MIN_INBOUND)
  .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));

console.log(`Checked ${pages.size} pages.`);
if (weak.length) {
  console.log(
    `\n⚠ ${weak.length} page(s) with fewer than ${MIN_INBOUND} contextual inbound links:`
  );
  for (const [url, n] of weak) console.log(`  ${String(n).padStart(2)}  ${url}`);
} else {
  console.log(`✓ Every checked page has at least ${MIN_INBOUND} contextual inbound links.`);
}

if (broken.size) {
  console.error(`\n✗ ${broken.size} broken internal link target(s):`);
  for (const [target, from] of broken)
    console.error(`  ${target}  ← ${[...from].slice(0, 3).join(', ')}`);
  process.exit(1);
}
console.log('✓ No broken internal links.');
