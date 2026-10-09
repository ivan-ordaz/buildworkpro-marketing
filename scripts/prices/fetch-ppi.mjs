#!/usr/bin/env node
// Pulls the Producer Price Index series behind /prices/ from the U.S. Bureau of
// Labor Statistics and writes src/data/prices/ppi.json. Pages build from that
// file, so a data refresh is a reviewed commit, never a runtime fetch.
//
//   node scripts/prices/fetch-ppi.mjs          # fetch and write when anything changed
//   node scripts/prices/fetch-ppi.mjs --check  # fetch and report, write nothing
//
// BLS data is public domain. Without a key the public API (v1) allows 25
// series and 10 years per request and 25 requests a day per IP; with
// BLS_API_KEY set it uses v2 (50 series, 20 years). Either way this script makes
// two or three requests. It exits non-zero, and writes nothing, when BLS errors,
// a series is missing, or a series has too little history, so a broken month
// can never reach the site.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SERIES_FILE = join(ROOT, 'src/data/prices/series.json');
const OUT_FILE = join(ROOT, 'src/data/prices/ppi.json');
const MIN_POINTS = 60; // five years, so every chart range has data
const checkOnly = process.argv.includes('--check');

const key = process.env.BLS_API_KEY?.trim();
const endpoint = key
  ? 'https://api.bls.gov/publicAPI/v2/timeseries/data/'
  : 'https://api.bls.gov/publicAPI/v1/timeseries/data/';
const perRequest = key ? 50 : 25;
const years = key ? 20 : 10;

const defs = JSON.parse(readFileSync(SERIES_FILE, 'utf8'));
const ids = defs.map((d) => d.id);
if (new Set(ids).size !== ids.length) throw new Error('series.json has duplicate ids');

const endYear = new Date().getUTCFullYear();
const startYear = endYear - years + 1;

async function request(seriesid) {
  const body = { seriesid, startyear: String(startYear), endyear: String(endYear) };
  if (key) body.registrationkey = key;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'BuildWorkPro price report (https://buildworkpro.com/prices/methodology/)',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`BLS HTTP ${res.status}`);
  const json = await res.json();
  if (json.status !== 'REQUEST_SUCCEEDED') {
    throw new Error(`BLS ${json.status}: ${(json.message ?? []).join(' | ')}`);
  }
  return json.Results?.series ?? [];
}

const fetched = new Map();
for (let i = 0; i < ids.length; i += perRequest) {
  for (const s of await request(ids.slice(i, i + perRequest))) fetched.set(s.seriesID, s);
}

const problems = [];
const series = {};
for (const def of defs) {
  const raw = fetched.get(def.id);
  if (!raw) {
    problems.push(`${def.id}: not returned by BLS`);
    continue;
  }
  const points = raw.data
    .filter((d) => /^M(0[1-9]|1[0-2])$/.test(d.period)) // M13 is an annual average
    .map((d) => {
      const value = Number(d.value);
      const prelim = (d.footnotes ?? []).some((f) => f && f.code === 'P');
      return [`${d.year}-${d.period.slice(1)}`, value, prelim];
    })
    .filter(([, v]) => Number.isFinite(v))
    .sort((a, b) => (a[0] < b[0] ? -1 : 1));
  if (points.length < MIN_POINTS) {
    problems.push(`${def.id}: only ${points.length} months of data`);
    continue;
  }
  series[def.id] = { points };
}

if (problems.length) {
  console.error(`fetch-ppi: refusing to write.\n  ${problems.join('\n  ')}`);
  process.exit(1);
}

// The report month is the latest month most series have reached. Series that
// lag it are listed so the pages can say so instead of mislabeling them.
const latestBySeries = Object.fromEntries(
  Object.entries(series).map(([id, s]) => [id, s.points.at(-1)[0]])
);
const counts = {};
for (const p of Object.values(latestBySeries)) counts[p] = (counts[p] ?? 0) + 1;
const latest = Object.entries(counts).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? 1 : -1))[0][0];
const lagging = Object.entries(latestBySeries)
  .filter(([, p]) => p < latest)
  .map(([id]) => id);

const previous = existsSync(OUT_FILE) ? JSON.parse(readFileSync(OUT_FILE, 'utf8')) : null;
const unchanged =
  previous &&
  JSON.stringify(previous.series) === JSON.stringify(series) &&
  previous.latest === latest;

console.log(
  `fetch-ppi: ${Object.keys(series).length} series, latest month ${latest}` +
    (lagging.length ? `, lagging: ${lagging.join(', ')}` : '') +
    (unchanged ? ' (no change)' : '')
);

if (checkOnly || unchanged) process.exit(0);

const out = {
  source:
    'U.S. Bureau of Labor Statistics, Producer Price Index by commodity, not seasonally adjusted',
  fetchedAt: new Date().toISOString(),
  latest,
  lagging,
  series,
};
writeFileSync(OUT_FILE, `${JSON.stringify(out)}\n`);
console.log(`fetch-ppi: wrote ${OUT_FILE}`);
