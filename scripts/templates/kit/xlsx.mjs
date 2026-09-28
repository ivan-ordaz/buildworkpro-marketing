// Excel kit (exceljs). Same visual grammar as the PDF kit: ink text, band table
// heads, rule borders, amber input cells, one ruled total row, print-ready.
import ExcelJS from 'exceljs';
import { INK, INPUT_FILL, BRAND } from './tokens.mjs';

const hex = (c) => 'FF' + c.replace('#', '').toUpperCase();
export const C = {
  ink: hex(INK.ink),
  ink2: hex(INK.ink2),
  ink3: hex(INK.ink3),
  rule: hex(INK.rule),
  band: hex(INK.band),
  band2: hex(INK.band2),
  input: 'FF' + INPUT_FILL,
  accent: 'FF2563EB',
  white: 'FFFFFFFF',
  add: hex(INK.add),
  deduct: hex(INK.deduct),
};

export const FONT = 'Calibri';
export const FMT = {
  money: '"$"#,##0.00;[Red]-"$"#,##0.00',
  moneyBlank: '"$"#,##0.00;[Red]-"$"#,##0.00;""',
  money0: '"$"#,##0;[Red]-"$"#,##0',
  pct: '0.0%',
  pctBlank: '0.0%;-0.0%;""',
  int: '#,##0',
  num: '#,##0.00',
  date: 'mmm d, yyyy',
  hours: '0.00',
};

const thin = (color = C.rule) => ({ style: 'thin', color: { argb: color } });
const medium = (color = C.ink) => ({ style: 'medium', color: { argb: color } });

export function workbook({ title, subject }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = BRAND.name;
  wb.company = BRAND.name;
  wb.lastModifiedBy = BRAND.name;
  wb.created = new Date('2026-09-17T12:00:00Z');
  wb.modified = new Date('2026-09-17T12:00:00Z');
  wb.title = title;
  wb.subject = subject ?? title;
  wb.keywords = 'construction template, subcontractor, buildworkpro';
  wb.calcProperties.fullCalcOnLoad = true;
  return wb;
}

export function sheet(
  wb,
  name,
  { landscape = false, fitWidth = 1, fitHeight = 0, printTitles, tabColor } = {}
) {
  const ws = wb.addWorksheet(name, {
    views: [{ showGridLines: false }],
    pageSetup: {
      paperSize: 1, // Letter
      orientation: landscape ? 'landscape' : 'portrait',
      fitToPage: true,
      fitToWidth: fitWidth,
      fitToHeight: fitHeight,
      margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
      horizontalCentered: true,
      ...(printTitles ? { printTitlesRow: printTitles } : {}),
    },
    headerFooter: {
      oddFooter: `&L&8&K8B93A1Free template by ${BRAND.name} · ${BRAND.domain}/templates&C&8&K8B93A1${name.replace(/&/g, '&&')}&R&8&K8B93A1Page &P of &N`,
    },
  });
  if (tabColor) ws.properties.tabColor = { argb: tabColor };
  ws.properties.defaultRowHeight = 15;
  return ws;
}

export function widths(ws, list) {
  list.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
}

function base(cell, extra = {}) {
  cell.font = { name: FONT, size: 10, color: { argb: C.ink }, ...(extra.font ?? {}) };
  if (extra.alignment) cell.alignment = extra.alignment;
  if (extra.fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: extra.fill } };
  if (extra.numFmt) cell.numFmt = extra.numFmt;
  if (extra.border) cell.border = extra.border;
}

/** Document title block: title, subtitle, and the accent rule under it. Returns the next free row. */
export function titleBlock(ws, { title, subtitle, row = 1, cols = 6, right, rightFrom }) {
  ws.getRow(row).height = 30;
  const t = ws.getCell(row, 1);
  t.value = title;
  base(t, { font: { size: 20, bold: true }, alignment: { vertical: 'middle' } });
  if (right) {
    const from = rightFrom ?? Math.max(2, cols - 1);
    if (from < cols) ws.mergeCells(row, from, row, cols);
    const r = ws.getCell(row, from);
    r.value = right;
    base(r, {
      font: { size: 10, color: { argb: C.ink2 } },
      alignment: { horizontal: 'right', vertical: 'middle' },
    });
  }
  let next = row + 1;
  if (subtitle) {
    const s = ws.getCell(next, 1);
    s.value = subtitle;
    base(s, { font: { size: 9, italic: true, color: { argb: C.ink2 } } });
    next++;
  }
  // accent rule
  for (let c = 1; c <= cols; c++) ws.getCell(next, c).border = { bottom: medium(C.accent) };
  ws.getRow(next).height = 6;
  return next + 1;
}

/** Small uppercase label above an input row / group. */
export function label(ws, row, col, text) {
  const c = ws.getCell(row, col);
  c.value = text.toUpperCase();
  base(c, { font: { size: 7.5, bold: true, color: { argb: C.ink3 } } });
  return c;
}

/** An input cell: amber fill, bottom rule. */
export function input(ws, row, col, value = null, { numFmt, align, bold, wrap, merge } = {}) {
  const c = ws.getCell(row, col);
  if (merge) ws.mergeCells(row, col, row, merge);
  c.value = value;
  base(c, {
    fill: C.input,
    numFmt,
    font: { size: 10, bold: !!bold },
    alignment: { horizontal: align ?? 'left', vertical: 'middle', wrapText: !!wrap },
    border: { bottom: thin(C.ink3) },
  });
  return c;
}

/** A computed (formula) cell: no fill, ink text. */
export function calc(ws, row, col, formula, { numFmt, align = 'right', bold, result } = {}) {
  const c = ws.getCell(row, col);
  c.value = { formula, result };
  base(c, {
    numFmt,
    font: { size: 10, bold: !!bold },
    alignment: { horizontal: align, vertical: 'middle' },
  });
  return c;
}

/** Plain text cell. */
export function text(
  ws,
  row,
  col,
  value,
  { size = 10, bold, italic, color, align, wrap, merge, numFmt } = {}
) {
  const c = ws.getCell(row, col);
  if (merge) ws.mergeCells(row, col, row, merge);
  c.value = value;
  base(c, {
    font: { size, bold: !!bold, italic: !!italic, color: { argb: color ?? C.ink } },
    alignment: { horizontal: align ?? 'left', vertical: 'top', wrapText: !!wrap },
    numFmt,
  });
  return c;
}

/** Label/value pair on one row: label in col, input in col+1 (optionally merged to `to`). */
export function kv(ws, row, col, lab, value = null, { to, numFmt, align, labelTo } = {}) {
  if (labelTo && labelTo > col) ws.mergeCells(row, col, row, labelTo);
  const l = ws.getCell(row, col);
  l.value = lab;
  base(l, { font: { size: 9, color: { argb: C.ink2 } }, alignment: { vertical: 'middle' } });
  const vcol = (labelTo ?? col) + 1;
  return input(ws, row, vcol, value, { merge: to && to > vcol ? to : undefined, numFmt, align });
}

/** Table header row: band fill, small caps labels, rule underneath. */
export function headerRow(
  ws,
  row,
  labels,
  { height = 22, startCol = 1, aligns = [], wrap = true } = {}
) {
  ws.getRow(row).height = height;
  labels.forEach((lab, i) => {
    const c = ws.getCell(row, startCol + i);
    c.value = lab.toUpperCase();
    base(c, {
      fill: C.band,
      font: { size: 7.5, bold: true, color: { argb: C.ink2 } },
      alignment: { horizontal: aligns[i] ?? 'left', vertical: 'bottom', wrapText: wrap },
      border: { bottom: thin(C.ink2), top: thin(C.rule) },
    });
  });
}

/**
 * Style a body row. spec = [{ input, numFmt, align, formula, value, bold, fill }] per column.
 * Cells with `input: true` get the amber fill; formulas get plain ink.
 */
export function bodyRow(ws, row, spec, { startCol = 1, height } = {}) {
  if (height) ws.getRow(row).height = height;
  spec.forEach((s, i) => {
    const c = ws.getCell(row, startCol + i);
    if (s.formula) c.value = { formula: s.formula, result: s.result };
    else if (s.value !== undefined) c.value = s.value;
    base(c, {
      numFmt: s.numFmt,
      fill: s.input ? C.input : s.fill,
      font: { size: s.size ?? 10, bold: !!s.bold, color: { argb: s.color ?? C.ink } },
      alignment: {
        horizontal: s.align ?? (s.numFmt ? 'right' : 'left'),
        vertical: 'middle',
        wrapText: !!s.wrap,
      },
      border: { bottom: thin(C.rule) },
    });
  });
}

/** The single ruled total row. */
export function totalRow(ws, row, spec, { startCol = 1, height = 22 } = {}) {
  ws.getRow(row).height = height;
  spec.forEach((s, i) => {
    const c = ws.getCell(row, startCol + i);
    if (s.formula) c.value = { formula: s.formula, result: s.result };
    else if (s.value !== undefined) c.value = s.value;
    base(c, {
      numFmt: s.numFmt,
      font: { size: 10, bold: true },
      alignment: { horizontal: s.align ?? (s.numFmt ? 'right' : 'left'), vertical: 'middle' },
      border: { top: medium(C.ink), bottom: thin(C.rule) },
    });
  });
}

/** Section band row spanning cols (like ItemTable's section row). */
export function sectionRow(ws, row, title, cols, { startCol = 1 } = {}) {
  ws.getRow(row).height = 20;
  for (let c = startCol; c < startCol + cols; c++) {
    const cell = ws.getCell(row, c);
    base(cell, {
      font: { size: 8, bold: true },
      alignment: { vertical: 'bottom' },
      border: { bottom: thin(C.ink) },
    });
  }
  ws.getCell(row, startCol).value = title.toUpperCase();
}

/** Boxed key figure (hero). */
export function heroCell(ws, row, col, lab, formula, { numFmt = FMT.money, merge } = {}) {
  label(ws, row, col, lab);
  const c = ws.getCell(row + 1, col);
  if (merge) ws.mergeCells(row + 1, col, row + 1, merge);
  c.value = { formula };
  base(c, {
    numFmt,
    font: { size: 16, bold: true },
    alignment: { horizontal: 'right', vertical: 'middle' },
    border: { top: thin(C.rule), bottom: medium(C.ink), left: thin(C.rule), right: thin(C.rule) },
  });
  ws.getRow(row + 1).height = 28;
  return c;
}

/** Signature lines: two parties side by side. */
export function signatureBlock(ws, row, parties, { cols = [1, 4], width = 2 } = {}) {
  parties.forEach((p, i) => {
    const col = cols[i];
    const who = ws.getCell(row, col);
    who.value = p.toUpperCase();
    base(who, { font: { size: 8, bold: true, color: { argb: C.ink2 } } });
    ['Signature', 'Printed name / title', 'Date'].forEach((lab, j) => {
      const r = row + 2 + j * 2;
      ws.getRow(r).height = 22;
      ws.mergeCells(r, col, r, col + width - 1);
      const c = ws.getCell(r, col);
      base(c, { border: { bottom: thin(C.ink) } });
      const l = ws.getCell(r + 1, col);
      l.value = lab.toUpperCase();
      base(l, { font: { size: 7, color: { argb: C.ink3 } } });
    });
  });
  return row + 8;
}

/** Callout note (light band, accent left border). */
export function noteRow(ws, row, textValue, cols, { startCol = 1, height } = {}) {
  ws.mergeCells(row, startCol, row, startCol + cols - 1);
  const c = ws.getCell(row, startCol);
  c.value = textValue;
  base(c, {
    fill: C.band,
    font: { size: 9, color: { argb: C.ink2 } },
    alignment: { vertical: 'middle', wrapText: true, indent: 1 },
    border: { left: medium(C.accent) },
  });
  ws.getRow(row).height = height ?? Math.max(18, Math.ceil(textValue.length / (cols * 14)) * 14);
}

/** Legend for input cells; put it near the top of any data sheet. */
export function inputLegend(
  ws,
  row,
  col,
  textValue = 'Amber cells are yours to fill in. Everything else calculates.'
) {
  const sw = ws.getCell(row, col);
  base(sw, { fill: C.input, border: { bottom: thin(C.ink3) } });
  const c = ws.getCell(row, col + 1);
  c.value = textValue;
  base(c, {
    font: { size: 8.5, italic: true, color: { argb: C.ink2 } },
    alignment: { vertical: 'middle' },
  });
}

/** Brand footer line at the bottom of a sheet (with hyperlink). */
export function brandFooter(ws, row, cols, textValue, url = BRAND.templatesUrl) {
  ws.mergeCells(row, 1, row, cols);
  const c = ws.getCell(row, 1);
  c.value = { text: textValue, hyperlink: url };
  base(c, {
    font: { size: 8, color: { argb: C.ink3 }, underline: false },
    alignment: { wrapText: true, vertical: 'top' },
  });
  ws.getRow(row).height = Math.max(16, Math.ceil(textValue.length / (cols * 14)) * 13);
}

/** Dropdown validation on a range. */
export function dropdown(ws, range, options) {
  ws.dataValidations.add(range, {
    type: 'list',
    allowBlank: true,
    formulae: [`"${options.join(',')}"`],
    showErrorMessage: true,
    errorTitle: 'Pick from the list',
    error: `Choose one of: ${options.join(', ')}`,
  });
}

/** Conditional fill for status-style text values. map = { Open: 'FFFFF7E6', Complete: 'FFE6F4EA' } */
export function statusColors(ws, range, map) {
  const rules = Object.entries(map).map(([val, fill], i) => ({
    type: 'containsText',
    operator: 'containsText',
    text: val,
    style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: fill } } },
    priority: i + 1,
  }));
  ws.addConditionalFormatting({ ref: range, rules });
}

/** The standard "How to use" sheet every workbook carries. */
export function howToSheet(wb, { title, steps, tips = [], feature }) {
  const ws = sheet(wb, 'How to Use', { tabColor: C.accent });
  widths(ws, [4, 100]);
  let r = titleBlock(ws, { title: `How to use the ${title}`, cols: 2 });
  r++;
  steps.forEach((s, i) => {
    text(ws, r, 1, `${i + 1}.`, { bold: true, color: C.ink2, align: 'right' });
    text(ws, r, 2, s, { wrap: true });
    ws.getRow(r).height = Math.max(18, Math.ceil(s.length / 95) * 15);
    r++;
  });
  if (tips.length) {
    r++;
    label(ws, r, 2, 'Tips from the field');
    r++;
    tips.forEach((t) => {
      text(ws, r, 1, '•', { color: C.ink2, align: 'right' });
      text(ws, r, 2, t, { wrap: true, color: C.ink2 });
      ws.getRow(r).height = Math.max(18, Math.ceil(t.length / 95) * 15);
      r++;
    });
  }
  r++;
  noteRow(ws, r, feature.text, 2, { startCol: 1, height: 44 });
  r++;
  const link = ws.getCell(r, 2);
  link.value = { text: feature.url, hyperlink: feature.url };
  base(link, { font: { size: 9, color: { argb: C.accent }, underline: true } });
  r += 2;
  brandFooter(
    ws,
    r,
    2,
    `Free template by ${BRAND.name} — ${BRAND.templatesUrl}. Free to use and share for your own business. Not legal, accounting or engineering advice.`
  );
  return ws;
}

export async function write(wb, file) {
  await wb.xlsx.writeFile(file);
}

/** Column letter helper. */
export const col = (n) => {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

export { ExcelJS };
