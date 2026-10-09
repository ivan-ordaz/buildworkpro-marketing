#!/usr/bin/env node
// The gate between a BLS data refresh and the live site. The weekly workflow
// lets a refresh merge itself only when this passes; anything odd stays an
// open pull request for a person to look at.
//
//   node scripts/prices/check-update.mjs <previous.json> <next.json> [--summary out.md]
//
// Exit 0: safe to publish. Exit 2: needs review (the reasons are in the summary).
// Checks: the latest month never goes backwards, no series disappears, no new
// month moves a series by more than 30%, and no month older than six months is
// revised by more than 5% (BLS only revises the last four; a bigger change
// usually means a series was rebased or redefined). CI's prices spec then
// re-checks the file's shape before the merge.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const LIMITS = { monthlyMovePct: 30, oldRevisionPct: 5, oldRevisionMonths: 6 };

function addMonths(period, months) {
  const [y, m] = period.split('-').map(Number);
  const idx = y * 12 + (m - 1) + months;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
}

const pct = (a, b) => (a / b - 1) * 100;
const fmt = (n) => `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;

/** Compare two ppi.json payloads. Pure, so the spec can feed it fixtures. */
export function checkUpdate(prev, next, limits = LIMITS) {
  const issues = [];
  const notes = [];
  if (!prev) return { ok: true, newMonth: next.latest, issues, notes: ['First data file.'] };

  if (next.latest < prev.latest) {
    issues.push(`The latest month went backwards: ${prev.latest} → ${next.latest}.`);
  }
  for (const id of Object.keys(prev.series)) {
    if (!next.series[id]) issues.push(`Series ${id} disappeared.`);
  }

  const cutoff = addMonths(next.latest, -limits.oldRevisionMonths);
  let revised = 0;
  for (const [id, s] of Object.entries(next.series)) {
    const before = new Map((prev.series[id]?.points ?? []).map(([p, v]) => [p, v]));
    const points = s.points;
    const byPeriod = new Map(points.map(([p, v]) => [p, v]));
    let changed = false;
    for (const [p, v] of points) {
      const old = before.get(p);
      if (old == null || old === v) continue;
      changed = true;
      if (p < cutoff && Math.abs(pct(v, old)) > limits.oldRevisionPct) {
        issues.push(`${id} ${p} was revised ${fmt(pct(v, old))} (older than six months).`);
      }
    }
    if (changed) revised += 1;
    const [last, value] = points.at(-1);
    const prior = byPeriod.get(addMonths(last, -1));
    if (
      last > prev.latest &&
      prior != null &&
      Math.abs(pct(value, prior)) > limits.monthlyMovePct
    ) {
      issues.push(
        `${id} moved ${fmt(pct(value, prior))} in ${last}, more than ${limits.monthlyMovePct}% in one month.`
      );
    }
  }

  const newMonth = next.latest > prev.latest ? next.latest : null;
  notes.push(newMonth ? `New month: ${newMonth}.` : `No new month (still ${next.latest}).`);
  notes.push(`${revised} series revised or extended.`);
  return { ok: issues.length === 0, newMonth, issues, notes };
}

function summaryMarkdown(result) {
  const lines = ['### Price data check', '', ...result.notes.map((n) => `- ${n}`), ''];
  if (result.ok)
    lines.push('All checks passed, so this pull request merges itself once CI is green.');
  else {
    lines.push('**Needs review before merging:**', '', ...result.issues.map((i) => `- ${i}`));
    lines.push(
      '',
      'Auto-merge is off for this one. Merge it by hand if the numbers check out against BLS.'
    );
  }
  return `${lines.join('\n')}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [prevFile, nextFile] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const out = process.argv.includes('--summary')
    ? process.argv[process.argv.indexOf('--summary') + 1]
    : null;
  if (!nextFile) {
    console.error('usage: check-update.mjs <previous.json> <next.json> [--summary out.md]');
    process.exit(1);
  }
  // No previous file (the first refresh) is fine: there is nothing to compare.
  const readPrev = () => {
    try {
      return JSON.parse(readFileSync(prevFile, 'utf8'));
    } catch {
      return null;
    }
  };
  const prev = readPrev();
  const result = checkUpdate(prev, JSON.parse(readFileSync(nextFile, 'utf8')));
  const md = summaryMarkdown(result);
  if (out) writeFileSync(out, md);
  console.log(md);
  process.exit(result.ok ? 0 : 2);
}
