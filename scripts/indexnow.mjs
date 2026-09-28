#!/usr/bin/env node
// Tells Bing (and the other IndexNow engines) that pages changed, so new and
// updated pages get recrawled in hours instead of weeks. ChatGPT search reads
// Bing's index, so this is also how new templates reach AI-assistant answers.
//
//   node scripts/indexnow.mjs /templates/timesheet/ /solutions/  # explicit paths or URLs
//   node scripts/indexnow.mjs --changed HEAD~1 HEAD               # pages touched by a commit range
//   node scripts/indexnow.mjs --all                               # every URL in the live sitemap
//
// Options: --wait <seconds> polls each URL until it answers 200 (use after a
// merge, while Cloudflare is still deploying); --dry-run prints without
// submitting. Only live, indexable URLs are submitted: anything that is not
// 200 or carries a noindex robots meta is dropped.
//
// The key is public by design — IndexNow proves ownership by fetching the
// same key from public/<key>.txt on the site.

import { execFileSync } from 'node:child_process';

const SITE = 'https://buildworkpro.com';
const KEY = '2732c7635404a520026bcf2e72d29bca';
const ENDPOINT = 'https://api.indexnow.org/indexnow';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const dryRun = flag('--dry-run');
const waitSeconds = Number(option('--wait') ?? 0);

function toUrl(pathOrUrl) {
  const u = new URL(pathOrUrl, SITE);
  if (!/\.[a-z0-9]+$/i.test(u.pathname) && !u.pathname.endsWith('/')) u.pathname += '/';
  return u.href;
}

/** Map a changed source file to the page URL it builds, or null. */
function fileToPath(file) {
  let m = file.match(/^src\/pages\/(.+)\.(astro|md|mdx)$/);
  if (m) {
    if (m[1].includes('[')) return null; // dynamic route: no single URL
    const p = m[1].replace(/(^|\/)index$/, '');
    return p ? `/${p}/` : '/';
  }
  m = file.match(/^src\/content\/docs\/(.+)\.(md|mdx)$/);
  if (m) {
    const p = m[1].replace(/(^|\/)index$/, '');
    return p ? `/${p}/` : '/';
  }
  return null;
}

function changedPaths(base, head) {
  const out = execFileSync('git', ['diff', '--name-only', '--diff-filter=AMR', base, head], {
    encoding: 'utf8',
  });
  return [...new Set(out.split('\n').filter(Boolean).map(fileToPath).filter(Boolean))];
}

async function sitemapUrls() {
  const index = await (await fetch(`${SITE}/sitemap-index.xml`)).text();
  const maps = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const urls = [];
  for (const map of maps) {
    const xml = await (await fetch(map)).text();
    urls.push(...[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
  }
  return urls;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 'ok' for a live, indexable page; otherwise the reason it is skipped. */
async function check(url) {
  try {
    const res = await fetch(url, { redirect: 'manual' });
    if (res.status !== 200) return `HTTP ${res.status}`;
    const html = await res.text();
    if (/<meta[^>]+name=["']robots["'][^>]+noindex/i.test(html)) return 'noindex';
    return 'ok';
  } catch (e) {
    return `fetch failed (${e.message})`;
  }
}

async function main() {
  let urls;
  if (flag('--all')) urls = await sitemapUrls();
  else if (flag('--changed')) {
    const base = option('--changed');
    const i = args.indexOf('--changed');
    const head = args[i + 2] && !args[i + 2].startsWith('--') ? args[i + 2] : 'HEAD';
    urls = changedPaths(base, head).map(toUrl);
  } else {
    urls = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--wait').map(toUrl);
  }
  urls = [...new Set(urls)];
  if (!urls.length) {
    console.log('indexnow: no page URLs to submit.');
    return;
  }

  // A sitemap URL is already known to be live; anything else is checked (and
  // waited on, after a merge) so Bing never gets pointed at a 404.
  const live = [];
  if (flag('--all')) live.push(...urls);
  else {
    const deadline = Date.now() + waitSeconds * 1000;
    let pending = urls;
    for (;;) {
      const results = await Promise.all(pending.map(async (u) => [u, await check(u)]));
      live.push(...results.filter(([, r]) => r === 'ok').map(([u]) => u));
      pending = results.filter(([, r]) => r !== 'ok' && r !== 'noindex').map(([u]) => u);
      for (const [u, r] of results) if (r === 'noindex') console.log(`skip ${u} (noindex)`);
      if (!pending.length || Date.now() >= deadline) {
        for (const u of pending) console.log(`skip ${u} (not live)`);
        break;
      }
      await sleep(15000);
    }
  }

  if (!live.length) {
    console.log('indexnow: nothing live to submit.');
    return;
  }
  console.log(`indexnow: ${live.length} URL(s)${dryRun ? ' (dry run)' : ''}`);
  for (const u of live) console.log(`  ${u}`);
  if (dryRun) return;

  const host = new URL(SITE).host;
  for (let i = 0; i < live.length; i += 10000) {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host,
        key: KEY,
        keyLocation: `${SITE}/${KEY}.txt`,
        urlList: live.slice(i, i + 10000),
      }),
    });
    // 200 = accepted, 202 = accepted while the key is still being verified.
    if (res.status !== 200 && res.status !== 202) {
      console.error(`indexnow: HTTP ${res.status} ${await res.text()}`);
      process.exit(1);
    }
    console.log(`indexnow: submitted, HTTP ${res.status}`);
  }
}

main();
