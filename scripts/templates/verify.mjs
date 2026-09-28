#!/usr/bin/env node
// Visual + formula verification helper for generated templates.
//
//   node scripts/templates/verify.mjs <slug>                      # render xlsx/docx/pdf to PNGs in tmp/template-check/<slug>/
//   node scripts/templates/verify.mjs <slug> --fill "Sheet!B5=100" "Sheet!C5=4"   # fill inputs first, then render (formulas recalc in LibreOffice)
//
// Requires LibreOffice (soffice) and poppler (pdftoppm, pdftotext) on PATH or
// at the macOS app path. Prints the extracted text of the rendered workbook so
// computed totals can be checked with grep.
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FILES = path.join(ROOT, 'public/templates-files');
const manifest = {};
for (const f of await fs.readdir(path.join(ROOT, 'src/data/templates-manifest'))) {
  if (f.endsWith('.json'))
    manifest[f.replace(/\.json$/, '')] = JSON.parse(
      await fs.readFile(path.join(ROOT, 'src/data/templates-manifest', f), 'utf8')
    );
}

const SOFFICE = ['/Applications/LibreOffice.app/Contents/MacOS/soffice', 'soffice', 'libreoffice'];
function soffice() {
  for (const s of SOFFICE) {
    try {
      execFileSync(s, ['--version'], { stdio: 'ignore' });
      return s;
    } catch {
      /* try next */
    }
  }
  throw new Error('LibreOffice not found (brew install --cask libreoffice)');
}

const args = process.argv.slice(2);
const slug = args[0];
if (!slug || !manifest[slug]) {
  console.error('usage: verify.mjs <slug> [--fill "Sheet!A1=value" ...]');
  process.exit(1);
}
const fillIdx = args.indexOf('--fill');
const fills = fillIdx >= 0 ? args.slice(fillIdx + 1) : [];

const out = path.join(ROOT, 'tmp/template-check', slug);
await fs.rm(out, { recursive: true, force: true });
await fs.mkdir(out, { recursive: true });
const entry = manifest[slug];
const bin = soffice();

// A private LibreOffice profile per slug, so several verify runs can convert at
// once without fighting over the shared user profile lock.
const profile = `file://${path.join(ROOT, 'tmp/template-check/.lo-profile', slug)}`;

async function toPdfAndPng(src, base) {
  execFileSync(
    bin,
    [`-env:UserInstallation=${profile}`, '--headless', '--convert-to', 'pdf', '--outdir', out, src],
    { stdio: 'ignore' }
  );
  const pdf = path.join(out, path.basename(src).replace(/\.[^.]+$/, '.pdf'));
  const target = path.join(out, base + '.pdf');
  await fs.rename(pdf, target);
  execFileSync('pdftoppm', ['-png', '-r', '70', target, path.join(out, base)]);
  return target;
}

for (const [kind, f] of Object.entries(entry.files)) {
  const src = path.join(FILES, f.file);
  if (kind === 'xlsx') {
    let toRender = src;
    if (fills.length) {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(src);
      for (const spec of fills) {
        const m = spec.match(/^(.+?)!([A-Z]+\d+)=(.*)$/);
        if (!m) throw new Error(`bad --fill spec: ${spec}`);
        const ws = wb.getWorksheet(m[1]);
        if (!ws) throw new Error(`no sheet ${m[1]}`);
        const v = m[3];
        ws.getCell(m[2]).value = v === '' ? null : Number.isNaN(Number(v)) ? v : Number(v);
      }
      toRender = path.join(out, 'filled.xlsx');
      await wb.xlsx.writeFile(toRender);
    }
    const pdf = await toPdfAndPng(toRender, 'xlsx');
    const text = execFileSync('pdftotext', ['-layout', pdf, '-']).toString();
    await fs.writeFile(path.join(out, 'xlsx.txt'), text);
    console.log(`--- ${f.file} (rendered text) ---\n${text}`);
  } else if (kind === 'docx') {
    await toPdfAndPng(src, 'docx');
  } else {
    execFileSync('pdftoppm', ['-png', '-r', '70', src, path.join(out, kind)]);
  }
}
const pngs = (await fs.readdir(out)).filter((n) => n.endsWith('.png')).sort();
console.log(`\nPNGs in ${path.relative(ROOT, out)}:\n  ${pngs.join('\n  ')}`);
