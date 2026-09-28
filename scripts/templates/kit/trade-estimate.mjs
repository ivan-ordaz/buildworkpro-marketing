// Trade estimate factory — the customer-facing estimate a trade contractor
// hands a homeowner, property manager or GC: job specs for the trade, line
// items grouped by the trade's own phases, optional items, tax, deposit,
// terms and an acceptance signature. One module per trade supplies the data
// (specs, sections, sample job, takeoff calculator, how-to copy); this file
// renders the same three formats for every trade so they stay consistent.
//
//   import { tradeEstimate } from '../kit/trade-estimate.mjs';
//   export const meta = { slug, name, basename, docName };
//   export const { html, docx, xlsx } = tradeEstimate({ meta, ...config });
//
// Config:
//   trade        'Roofing' — used in sheet titles and copy
//   specs        [{ key, label, flex? }] — 3–5 job-spec fields under the header
//   sections     [{ title, hint?, blank }] — trade phases; `blank` = empty rows in the blank PDF
//   descriptionHint, termsHint, fine — form copy
//   sample       { company, customer, job, number, date, valid, start, preparedBy,
//                  specs: { key: value }, description,
//                  sections: [{ items: [{ desc, sub?, qty, unit, price, taxable? }] }],
//                  options: [{ n, desc, amount }], taxRate, taxBasis, taxLabel?, depositPct, terms,
//                  sig: { customer, customerDate, contractor, contractorDate } }
//   takeoff      (wb) => void — adds the trade's quantity calculator sheet
//   pricing      { rows: [{ item, unit, mat, hrs, other }], laborRate, overhead, margin, note }
//   howTo        { steps, tips, feature } for the How to Use sheet
import * as H from './html.mjs';
import * as X from './xlsx.mjs';
import * as D from './docx.mjs';

const round2 = (n) => Math.round(n * 100) / 100;

const CSS = `
.hdr-rule{margin:10px 0 12px}
table.t.compact td{padding:2.5px 6px}
table.t tr.sec td{padding:5px 6px 2px;border-bottom:1px solid var(--ink);font-size:8px;letter-spacing:.9px;text-transform:uppercase;font-weight:700}
.sig{margin-top:12px;padding-top:8px}
.sig .parties{margin-top:10px}
.sig .party .who{margin-bottom:8px}
.sig .under{margin-top:10px}
table.t tr.sec .hint{font-weight:400;letter-spacing:0;text-transform:none;font-size:7.5px;color:var(--ink3)}
`;

export function compute(s) {
  const items = s.sections.flatMap((sec) => sec.items);
  const subtotal = round2(items.reduce((t, i) => t + i.qty * i.price, 0));
  const taxable = round2(items.filter((i) => i.taxable).reduce((t, i) => t + i.qty * i.price, 0));
  const tax = round2(taxable * (s.taxRate / 100));
  const total = round2(subtotal + tax);
  const deposit = round2(total * (s.depositPct / 100));
  return { subtotal, taxable, tax, total, deposit, balance: round2(total - deposit) };
}

export function tradeEstimate(cfg) {
  const { meta, trade, specs, sections, sample: SAMPLE } = cfg;
  const numberBlank = 'EST-____';
  if (SAMPLE.sections.length !== sections.length)
    throw new Error(`${meta.slug}: sample.sections must match sections (${sections.length})`);

  /** Line items grouped under the trade's section bands. Blank mode = fillable rows. */
  function itemTable(sample) {
    const cols = [
      { key: 'n', label: '#', width: 24, cls: 'center mono' },
      { key: 'desc', label: 'Description' },
      { key: 'qty', label: 'Qty', width: 50, cls: 'right' },
      { key: 'unit', label: 'Unit', width: 40, cls: 'center' },
      { key: 'price', label: 'Unit price', width: 74, cls: 'right' },
      { key: 'amount', label: 'Amount', width: 84, cls: 'right' },
    ];
    const th = cols
      .map(
        (c) =>
          `<th class="${c.cls ?? ''}"${c.width ? ` style="width:${c.width}px"` : ''}>${H.esc(c.label)}</th>`
      )
      .join('');
    let n = 0;
    const body = sections
      .map((sec, si) => {
        const head = `<tr class="sec"><td colspan="${cols.length}"><div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px"><span>${H.esc(sec.title)}</span>${sec.hint ? `<span class="hint">${H.esc(sec.hint)}</span>` : ''}</div></td></tr>`;
        let rows = '';
        if (sample) {
          for (const i of SAMPLE.sections[si].items) {
            n++;
            const sub = i.sub ? `<span class="sub">${H.esc(i.sub)}</span>` : '';
            rows += `<tr><td class="center mono">${n}</td><td>${H.esc(i.desc)}${sub}</td><td class="right">${i.qty.toLocaleString('en-US')}</td><td class="center">${H.esc(i.unit)}</td><td class="right">${H.money(i.price)}</td><td class="right">${H.money(i.qty * i.price)}</td></tr>`;
          }
        } else {
          for (let k = 1; k <= sec.blank; k++) {
            n++;
            rows += `<tr class="blank" style="height:18px"><td class="center mono ink3">${n}</td>${cols
              .slice(1)
              .map((c) => `<td class="${c.cls ?? ''}" data-field="s${si + 1}.${k}.${c.key}"></td>`)
              .join('')}</tr>`;
          }
        }
        return head + rows;
      })
      .join('');
    return `<table class="t compact" style="margin-top:8px"><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>`;
  }

  function html({ sample }) {
    const s = sample ? SAMPLE : null;
    const company = s ? s.company : { name: '', line1: '', line2: '' };
    const t = s ? compute(s) : null;
    const optCols = [
      { key: 'n', label: 'Opt.', width: 40, align: 'center', mono: true },
      { key: 'desc', label: 'Optional items — priced separately, not included in the total' },
      { key: 'amount', label: 'Add', width: 84, align: 'right' },
    ];
    const optRows = s
      ? s.options.map((o) => ({ cells: { n: o.n, desc: o.desc, amount: H.money(o.amount) } }))
      : [];

    const body = `
${H.header({ company, title: 'Estimate', number: s ? s.number : numberBlank, date: s ? s.date : undefined, fillable: !sample })}
${H.metaRow([
  {
    label: 'Prepared for',
    lines: [
      { text: s ? s.customer.name : '', strong: true, field: 'customer.name' },
      { text: s ? s.customer.line1 : '', field: 'customer.line1' },
      { text: s ? s.customer.line2 : '', field: 'customer.line2' },
    ],
  },
  {
    label: 'Job address',
    lines: [
      { text: s ? s.job.name : '', strong: true, field: 'job.name' },
      { text: s ? s.job.line1 : '', field: 'job.line1' },
      { text: s ? s.job.line2 : '', field: 'job.line2' },
    ],
  },
  {
    label: 'Estimate',
    kv: [
      { k: 'Date', v: s ? s.date : '', field: 'est.date' },
      { k: 'Valid until', v: s ? s.valid : '', field: 'est.valid', strong: true },
      { k: 'Estimated start', v: s ? s.start : '', field: 'est.start' },
      { k: 'Prepared by', v: s ? s.preparedBy : '', field: 'est.prepared_by' },
    ],
  },
])}
${H.fieldRow(
  specs.map((f) =>
    H.field({
      name: `spec.${f.key}`,
      label: f.label,
      value: s ? s.specs[f.key] : '',
      flex: f.flex ?? 1,
    })
  ),
  14
)}
${H.textarea({ name: 'description', label: 'Scope of work', hint: cfg.descriptionHint, value: s ? s.description : '', height: 30 })}
${itemTable(sample)}
${H.table({ columns: optCols, rows: optRows, blankRows: sample ? 0 : 2, fieldPrefix: 'opt', rowHeight: 19, variant: 'compact' })}
${H.split(
  H.textarea({
    name: 'terms',
    label: 'Terms',
    hint: cfg.termsHint,
    value: s ? s.terms : '',
    height: 88,
  }),
  H.totals([
    { label: 'Subtotal', value: s ? H.money(t.subtotal) : '', field: 'tot.subtotal' },
    {
      label: s
        ? (s.taxLabel ?? `Sales tax — ${s.taxRate}% on ${s.taxBasis} (${H.money(t.taxable)})`)
        : 'Sales tax (___% on $________)',
      value: s ? H.money(t.tax) : '',
      field: 'tot.tax',
    },
    {
      label: 'Estimate total',
      value: s ? H.money(t.total) : '',
      total: true,
      field: 'tot.total',
    },
    {
      label: s
        ? `Deposit due on acceptance (${s.depositPct}%)`
        : 'Deposit due on acceptance (___%)',
      value: s ? H.money(t.deposit) : '',
      field: 'tot.deposit',
    },
    {
      label: 'Balance due on completion',
      value: s ? H.money(t.balance) : '',
      field: 'tot.balance',
    },
  ]),
  [1.25, 1]
)}
${H.signatures({
  title: 'Acceptance',
  copy: 'By signing, the customer accepts this estimate, the optional items marked above and these terms.',
  parties: [
    {
      name: 'Accepted by',
      sub: s ? s.customer.name : 'customer',
      fields: [
        { label: 'Signature', name: 'sig.customer' },
        { label: 'Printed name', name: 'sig.customer_name', value: s ? s.sig.customer : '' },
        { label: 'Date', name: 'sig.customer_date', value: s ? s.sig.customerDate : '' },
      ],
    },
    {
      name: 'Estimated by',
      sub: s ? s.company.name : 'your company',
      fields: [
        { label: 'Signature', name: 'sig.contractor' },
        {
          label: 'Printed name and title',
          name: 'sig.contractor_name',
          value: s ? s.sig.contractor : '',
        },
        { label: 'Date', name: 'sig.contractor_date', value: s ? s.sig.contractorDate : '' },
      ],
    },
  ],
})}
${H.finePrint(cfg.fine)}`;

    const doc = H.document({
      title: meta.name,
      pages: [body],
      css: CSS,
      footer: H.footerText(`${meta.docName} · ${s ? s.number : numberBlank}`),
    });
    return { sections: [{ html: doc, mode: 'pages', landscape: false }] };
  }

  async function docx() {
    const W = D.CONTENT_W;
    const specW = Math.floor(W / specs.length);
    const cols = [
      { label: '#', width: 500, align: 'center' },
      { label: 'Description', width: 5300 },
      { label: 'Qty', width: 900, align: 'right' },
      { label: 'Unit', width: 800, align: 'center' },
      { label: 'Unit price', width: 1280, align: 'right' },
      { label: 'Amount', width: W - 500 - 5300 - 900 - 800 - 1280, align: 'right' },
    ];
    let n = 0;
    const rows = sections.flatMap((sec) => [
      { section: sec.title },
      ...Array.from({ length: Math.max(sec.blank - 1, 2) }, () => ({
        cells: [String(++n), '', '', '', '', ''],
        input: [false, true, true, true, true, true],
      })),
    ]);
    const children = [
      ...D.companyHeader({
        title: 'Estimate',
        number: 'Estimate No. ________',
        date: 'Date ____________',
      }),
      D.metaRow([
        {
          label: 'Prepared for',
          lines: [
            { text: '', bold: true, input: true },
            { text: '', input: true },
            { text: '', input: true },
          ],
        },
        {
          label: 'Job address',
          lines: [
            { text: '', bold: true, input: true },
            { text: '', input: true },
            { text: '', input: true },
          ],
        },
      ]),
      D.spacer(4),
      D.fieldGrid([
        [
          { label: 'Valid until', width: Math.round(W * 0.34) },
          { label: 'Estimated start', width: Math.round(W * 0.33) },
          { label: 'Prepared by', width: W - Math.round(W * 0.34) - Math.round(W * 0.33) },
        ],
      ]),
      D.fieldGrid([
        specs.map((f, i) => ({
          label: f.label,
          width: i === specs.length - 1 ? W - specW * (specs.length - 1) : specW,
        })),
      ]),
      ...D.textBox('Scope of work', { lines: 2, hint: cfg.descriptionHint }),
      D.heading('Price', `${trade.toLowerCase()} work by phase`),
      D.table({ columns: cols, rows }),
      D.spacer(2),
      D.ladder(
        [
          { k: 'Subtotal', v: '$', input: true },
          { k: 'Sales tax (____ % on $________)', v: '$', input: true },
          { k: 'Estimate total', v: '$', total: true, input: true },
          { k: 'Deposit due on acceptance (____ %)', v: '$', input: true },
          { k: 'Balance due on completion', v: '$', input: true },
        ],
        { kWidth: 7400 }
      ),
      D.heading('Optional items', 'priced separately — not included in the total'),
      D.table({
        columns: [
          { label: 'Opt.', width: 800, align: 'center' },
          { label: 'Description', width: W - 800 - 1700 },
          { label: 'Add', width: 1700, align: 'right' },
        ],
        blankRows: 3,
        blankHeight: 280,
      }),
      D.heading('Terms'),
      ...D.textBox(cfg.termsHint.charAt(0).toUpperCase() + cfg.termsHint.slice(1), {
        lines: 5,
        hint: cfg.termsExample,
      }),
      ...D.signatures({
        title: 'Acceptance',
        copy: 'By signing, the customer accepts this estimate, any optional items marked above and the terms stated, and authorizes the work to be scheduled.',
        parties: [
          { name: 'Accepted by', sub: 'customer' },
          { name: 'Estimated by', sub: 'your company' },
        ],
      }),
      D.fine(cfg.fine),
    ];
    return D.document({ title: meta.name, children, footerCenter: meta.docName });
  }

  async function xlsx() {
    const wb = X.workbook({ title: meta.name });

    // ---- Sheet 1: the estimate the customer sees ----
    const ws = X.sheet(wb, 'Estimate', { fitHeight: 1 });
    X.widths(ws, [5, 44, 9, 8, 13, 7, 15]);
    let r = X.titleBlock(ws, {
      title: `${trade} Estimate`,
      subtitle: cfg.xlsxSubtitle,
      cols: 7,
      right: 'Amber = your inputs',
      rightFrom: 5,
    });
    X.inputLegend(ws, r, 1);
    r += 2;
    X.label(ws, r, 1, 'Your company');
    X.label(ws, r, 3, 'Estimate');
    r++;
    X.kv(ws, r, 1, 'Company', null, { to: 2 });
    X.kv(ws, r, 3, 'Estimate no.', null, { labelTo: 4, to: 7 });
    r++;
    X.kv(ws, r, 1, 'Address', null, { to: 2 });
    X.kv(ws, r, 3, 'Date', null, { labelTo: 4, to: 7, numFmt: X.FMT.date });
    r++;
    X.kv(ws, r, 1, 'Phone / email / license', null, { to: 2 });
    X.kv(ws, r, 3, 'Valid until', null, { labelTo: 4, to: 7, numFmt: X.FMT.date });
    r += 2;
    X.label(ws, r, 1, 'Prepared for');
    X.label(ws, r, 3, 'Job');
    r++;
    X.kv(ws, r, 1, 'Customer', null, { to: 2 });
    X.kv(ws, r, 3, 'Job address', null, { labelTo: 4, to: 7 });
    r++;
    X.kv(ws, r, 1, 'Address', null, { to: 2 });
    X.kv(ws, r, 3, 'Estimated start', null, { labelTo: 4, to: 7 });
    r++;
    X.kv(ws, r, 1, 'Phone / email', null, { to: 2 });
    X.kv(ws, r, 3, 'Prepared by', null, { labelTo: 4, to: 7 });
    r += 2;
    X.label(ws, r, 1, 'Job specs');
    r++;
    for (let i = 0; i < specs.length; i += 2) {
      X.kv(ws, r, 1, specs[i].label, null, { to: 2 });
      if (specs[i + 1]) X.kv(ws, r, 3, specs[i + 1].label, null, { labelTo: 4, to: 7 });
      r++;
    }
    r++;
    X.label(ws, r, 1, 'Scope of work');
    r++;
    ws.mergeCells(r, 1, r + 1, 7);
    X.input(ws, r, 1, null, { wrap: true });
    ws.getRow(r).height = 20;
    ws.getRow(r + 1).height = 20;
    r += 3;

    X.headerRow(ws, r, ['#', 'Description', 'Qty', 'Unit', 'Unit price', 'Tax?', 'Amount'], {
      aligns: ['center', 'left', 'right', 'center', 'right', 'center', 'right'],
    });
    r++;
    const subtotalRows = [];
    const itemRanges = [];
    let lineNo = 1;
    for (const sec of sections) {
      X.sectionRow(ws, r, sec.title, 7);
      r++;
      const first = r;
      const count = Math.max(sec.blank + 3, 6);
      for (let i = 0; i < count; i++) {
        X.bodyRow(ws, r, [
          { value: lineNo++, align: 'center', color: X.C.ink3 },
          { input: true, wrap: true },
          { input: true, numFmt: X.FMT.num, align: 'right' },
          { input: true, align: 'center' },
          { input: true, numFmt: X.FMT.moneyBlank },
          { input: true, align: 'center' },
          { formula: `IF(OR(C${r}="",E${r}=""),"",C${r}*E${r})`, numFmt: X.FMT.moneyBlank },
        ]);
        r++;
      }
      const last = r - 1;
      X.dropdown(ws, `F${first}:F${last}`, ['Y', 'N']);
      itemRanges.push([first, last]);
      X.bodyRow(ws, r, [
        { value: '' },
        { value: `${sec.title} subtotal`, bold: true, size: 9 },
        {},
        {},
        {},
        {},
        { formula: `SUM(G${first}:G${last})`, numFmt: X.FMT.money, bold: true },
      ]);
      ws.getCell(r, 7).border = {
        top: { style: 'thin', color: { argb: X.C.ink2 } },
        bottom: { style: 'thin', color: { argb: X.C.rule } },
      };
      subtotalRows.push(r);
      r += 2;
    }
    X.totalRow(ws, r, [
      { value: '' },
      { value: 'Subtotal' },
      {},
      {},
      {},
      {},
      { formula: subtotalRows.map((x) => `G${x}`).join('+'), numFmt: X.FMT.money },
    ]);
    const subtotalRow = r;
    r++;
    X.text(ws, r, 2, 'Taxable amount (lines marked Y)', { color: X.C.ink2, size: 9 });
    X.calc(ws, r, 7, itemRanges.map(([a, b]) => `SUMIF(F${a}:F${b},"Y",G${a}:G${b})`).join('+'), {
      numFmt: X.FMT.money,
    });
    ws.getCell(r, 7).font = { name: X.FONT, size: 10, color: { argb: X.C.ink2 } };
    const taxableRow = r;
    r++;
    X.text(ws, r, 2, 'Sales tax — enter your rate (0% if tax is in your prices) →', {
      color: X.C.ink2,
      size: 9,
    });
    X.input(ws, r, 5, 0, { numFmt: '0.00%', align: 'right' });
    X.calc(ws, r, 7, `ROUND(G${taxableRow}*E${r},2)`, { numFmt: X.FMT.money });
    const taxRow = r;
    r++;
    X.totalRow(ws, r, [
      { value: '' },
      { value: 'ESTIMATE TOTAL' },
      {},
      {},
      {},
      {},
      { formula: `G${subtotalRow}+G${taxRow}`, numFmt: X.FMT.money },
    ]);
    ws.getCell(r, 7).font = { name: X.FONT, size: 12, bold: true };
    const totalRow = r;
    r++;
    X.text(ws, r, 2, 'Deposit due on acceptance — enter % →', { color: X.C.ink2, size: 9 });
    X.input(ws, r, 5, SAMPLE.depositPct / 100, { numFmt: X.FMT.pct, align: 'right' });
    X.calc(ws, r, 7, `ROUND(G${totalRow}*E${r},2)`, { numFmt: X.FMT.money });
    const depositRow = r;
    r++;
    X.text(ws, r, 2, 'Balance due on completion', { color: X.C.ink2, size: 9 });
    X.calc(ws, r, 7, `G${totalRow}-G${depositRow}`, { numFmt: X.FMT.money });
    r += 2;

    X.headerRow(
      ws,
      r,
      ['Opt.', 'Optional items — priced separately, not in the total', '', '', '', '', 'Add'],
      { aligns: ['center', 'left', 'left', 'left', 'left', 'left', 'right'] }
    );
    r++;
    for (const o of ['A', 'B', 'C']) {
      X.bodyRow(ws, r, [
        { value: o, align: 'center', color: X.C.ink3 },
        { input: true, wrap: true },
        {},
        {},
        {},
        {},
        { input: true, numFmt: X.FMT.moneyBlank },
      ]);
      ws.mergeCells(r, 2, r, 6);
      r++;
    }
    r++;
    X.label(ws, r, 1, `Terms — ${cfg.termsHint}`);
    r++;
    ws.mergeCells(r, 1, r + 2, 7);
    X.input(ws, r, 1, null, { wrap: true });
    for (let i = 0; i < 3; i++) ws.getRow(r + i).height = 18;
    r += 4;
    r = X.signatureBlock(ws, r, ['Accepted by (customer)', 'Estimated by'], {
      cols: [1, 5],
      width: 3,
    });
    r++;
    X.noteRow(ws, r, cfg.fine, 7, { height: 30 });
    r += 2;
    X.brandFooter(ws, r, 7, 'Free template by BuildWorkPro — buildworkpro.com/templates.');
    ws.pageSetup.printArea = `A1:G${r}`;

    // ---- Sheet 2: the trade's quantity takeoff ----
    cfg.takeoff(wb);

    // ---- Sheet 3: unit-price builder (internal) ----
    pricingSheet(wb, cfg.pricing);

    X.howToSheet(wb, { title: meta.name, ...cfg.howTo });
    return wb;
  }

  return { html, docx, xlsx };
}

/**
 * Internal sheet that turns cost into a selling unit price: material + labor
 * hours × loaded rate + other, then overhead, then profit as a margin on
 * price. Never shown to the customer — the Unit price column feeds the
 * Estimate sheet by hand.
 */
function pricingSheet(wb, { rows, laborRate, overhead, margin, note }) {
  const ws = X.sheet(wb, 'Unit Prices', { landscape: true, fitHeight: 1 });
  X.widths(ws, [40, 7, 12, 10, 12, 12, 13, 14]);
  let r = X.titleBlock(ws, {
    title: 'Unit Price Builder',
    subtitle:
      'Internal — do not send. Builds each selling price from cost: material + labor + other, then overhead, then profit as a margin on price.',
    cols: 8,
  });
  X.inputLegend(ws, r, 1);
  r += 2;
  X.kv(ws, r, 1, 'Loaded labor rate ($/hr — wage + taxes + insurance + benefits)', laborRate, {
    labelTo: 3,
    numFmt: X.FMT.money,
    align: 'right',
  });
  const rate = `$D$${r}`;
  r++;
  X.kv(ws, r, 1, 'Overhead (% of cost — office, trucks, insurance, estimating)', overhead, {
    labelTo: 3,
    numFmt: X.FMT.pct,
    align: 'right',
  });
  const oh = `$D$${r}`;
  r++;
  X.kv(ws, r, 1, 'Profit margin (% of PRICE, not markup on cost)', margin, {
    labelTo: 3,
    numFmt: X.FMT.pct,
    align: 'right',
  });
  const m = `$D$${r}`;
  r += 2;
  X.headerRow(
    ws,
    r,
    [
      'Item',
      'Unit',
      'Material $/unit',
      'Labor hrs/unit',
      'Other $/unit',
      'Cost $/unit',
      'Price $/unit',
      'Profit $/unit',
    ],
    { aligns: ['left', 'center', 'right', 'right', 'right', 'right', 'right', 'right'] }
  );
  r++;
  const first = r;
  const count = Math.max(rows.length + 6, 14);
  for (let i = 0; i < count; i++) {
    const row = rows[i];
    X.bodyRow(ws, r, [
      { input: true, value: row?.item ?? null, wrap: true },
      { input: true, value: row?.unit ?? null, align: 'center' },
      { input: true, value: row?.mat ?? null, numFmt: X.FMT.moneyBlank },
      { input: true, value: row?.hrs ?? null, numFmt: '0.0##;-0.0##;""', align: 'right' },
      { input: true, value: row?.other ?? null, numFmt: X.FMT.moneyBlank },
      {
        formula: `IF(A${r}="","",N(C${r})+N(D${r})*${rate}+N(E${r}))`,
        numFmt: X.FMT.moneyBlank,
      },
      {
        formula: `IF(OR(F${r}="",${m}>=1),"",ROUND(F${r}*(1+${oh})/(1-${m}),2))`,
        numFmt: X.FMT.moneyBlank,
      },
      {
        formula: `IF(G${r}="","",G${r}-F${r}*(1+${oh}))`,
        numFmt: X.FMT.moneyBlank,
      },
    ]);
    r++;
  }
  ws.views = [{ state: 'frozen', ySplit: first - 1, showGridLines: false }];
  r++;
  X.noteRow(ws, r, note, 8, { height: 44 });
  r += 2;
  X.noteRow(
    ws,
    r,
    'Price = cost × (1 + overhead) ÷ (1 − margin). A 15% markup on cost is only a 13% margin on price — the Markup vs Margin explanation is at buildworkpro.com/blog/construction-markup-vs-margin/.',
    8,
    { height: 32 }
  );
  r += 2;
  X.brandFooter(
    ws,
    r,
    8,
    'Free template by BuildWorkPro — buildworkpro.com/templates. Internal pricing sheet; copy the Price $/unit into the Estimate sheet.'
  );
  return ws;
}
