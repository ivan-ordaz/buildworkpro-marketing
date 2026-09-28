// Landscaping estimate — the customer-facing landscape install estimate,
// grouped the way a landscaper prices the job (site prep and grading;
// planting, sod and mulch; irrigation, edging and cleanup), plus two takeoff
// sheets: one that turns lawn and bed zones into turf removal, sod pallets and
// bulk yards, and one that turns a plant list and zone list into plant counts
// by container size, drip emitters, heads, pipe and tubing. Rendered by the
// trade-estimate kit.
import * as X from '../kit/xlsx.mjs';
import { tradeEstimate } from '../kit/trade-estimate.mjs';

export const meta = {
  slug: 'landscaping-estimate',
  name: 'Landscaping Estimate Template',
  basename: 'landscaping-estimate-template',
  docName: 'Landscaping estimate',
};

// A Fort Collins front-yard renovation on clay soil: 992 sq ft of lawn and
// 922 sq ft of beds (1,914 sq ft measured). Sod is priced on the measured lawn
// with cutting waste carried in the price; bulk materials are priced on the
// yards delivered and placed. Quantities match the two takeoff sheets.
const SAMPLE = {
  company: {
    name: 'Kestrel Ridge Landscape & Irrigation',
    line1: '1925 Blue Spruce Dr, Fort Collins, CO 80524',
    line2: '(970) 555-0162 · bids@kestrelridgelandscape.com',
  },
  customer: {
    name: 'Elena & Mark Soriano',
    line1: '2741 Sandstone Ct, Fort Collins, CO 80526',
    line2: '(970) 555-0119',
  },
  job: {
    name: 'Soriano residence — front yard',
    line1: '2741 Sandstone Ct, Fort Collins, CO 80526',
    line2: 'Clay soil · existing 4-zone sprinkler system',
  },
  number: 'EST-2026-0214',
  date: 'September 25, 2026',
  valid: 'October 25, 2026',
  start: 'Week of October 5',
  preparedBy: 'Mateo Vargas, Owner',
  specs: {
    area: '992 / 922 sq ft',
    soil: '1 in. compost, tilled 6 in.',
    mulch: '3 in. shredded cedar',
    irrigation: '2 drip zones, 2 spray adjusted',
    warranty: '1 year, plants & tree',
  },
  description:
    'Remove the front lawn and the overgrown rock bed, amend the clay soil, and install new sod, three planting beds on drip irrigation, steel edging and cedar mulch.',
  sections: [
    {
      items: [
        {
          desc: 'Strip existing turf with a sod cutter; haul off and dispose',
          qty: 1546,
          unit: 'SF',
          price: 0.95,
        },
        {
          desc: 'Clean out foundation bed: 6 junipers, rock mulch and fabric; haul off',
          qty: 1,
          unit: 'LS',
          price: 1380,
        },
        {
          desc: 'Soil prep: 1 in. compost (6.5 CY) tilled 6 in.; fine grade to drain',
          qty: 1914,
          unit: 'SF',
          price: 0.8,
        },
        {
          desc: 'Garden soil blend, 2 in. over beds; crown the corner bed',
          qty: 6.5,
          unit: 'CY',
          price: 112,
        },
      ],
    },
    {
      items: [
        {
          desc: 'Kentucky bluegrass sod, rolled and watered in',
          sub: 'Priced on the measured lawn; cutting waste is in the price',
          qty: 992,
          unit: 'SF',
          price: 1.6,
        },
        {
          desc: 'Ornamental crabapple, 1.5 in. caliper B&B, staked',
          qty: 1,
          unit: 'EA',
          price: 465,
        },
        {
          desc: 'Shrubs, 5-gal — rabbitbrush, fernbush, blue mist spirea',
          qty: 12,
          unit: 'EA',
          price: 85,
        },
        {
          desc: 'Perennials and grasses, 1-gal — little bluestem, catmint, penstemon',
          qty: 60,
          unit: 'EA',
          price: 27,
        },
        { desc: 'Shredded cedar mulch, 3 in. deep in all beds', qty: 9.5, unit: 'CY', price: 92 },
      ],
    },
    {
      items: [
        {
          desc: 'Convert 2 bed zones to drip: filter, regulator, tubing, 88 emitters',
          qty: 2,
          unit: 'ZN',
          price: 640,
        },
        {
          desc: 'Relocate or add lawn spray heads for head-to-head coverage; new nozzles',
          qty: 7,
          unit: 'EA',
          price: 78,
        },
        {
          desc: 'Steel edging, 1/8 × 4 in., staked — every lawn-to-bed edge',
          qty: 142,
          unit: 'LF',
          price: 8.5,
        },
        {
          desc: 'Final cleanup, walkthrough and a written watering schedule',
          qty: 1,
          unit: 'LS',
          price: 245,
        },
      ],
    },
  ],
  options: [
    {
      n: 'A',
      desc: 'Replace the cracked concrete entry walk with a 4 × 32 ft paver walk on 6 in. compacted base',
      amount: 4380,
    },
    {
      n: 'B',
      desc: 'Weather-based Wi-Fi irrigation controller, installed and programmed',
      amount: 465,
    },
  ],
  taxRate: 0,
  taxBasis: 'materials',
  taxLabel: 'Sales tax — included in prices',
  depositPct: 40,
  terms:
    'Deposit 40% on acceptance to order plants and sod; balance due at completion after the walkthrough. Sprinkler repairs beyond this scope billed at $85/hr plus parts, approved first. We call 811; owner marks private lines. Excludes hardscape. Plants and tree warranted 1 year with drip running; sod not warranted once installed. Price firm through the valid-until date.',
  sig: {
    customer: 'Elena Soriano',
    customerDate: '09/28/2026',
    contractor: 'Mateo Vargas, Owner',
    contractorDate: '09/25/2026',
  },
};

const FINE =
  'Based on site measurements. Buried debris, rock and broken sprinkler lines are priced by written change order first. Check your state’s contract and deposit rules. Not legal advice.';

const QTY = '#,##0.0;-#,##0.0;""';
const QTY0 = '#,##0;-#,##0;""';

/** Site takeoff: lawn and bed zones → turf removal, sod, bulk yards and edging. */
function siteTakeoff(wb) {
  const ws = X.sheet(wb, 'Site Takeoff', { fitHeight: 1 });
  X.widths(ws, [31, 10, 10, 10, 13, 12, 11]);
  let r = X.titleBlock(ws, {
    title: 'Site Takeoff',
    subtitle:
      'Lawn and bed zones → turf removal, sod pallets, compost, soil and mulch yards, and edging. Curved zone? Enter its measured area instead of length × width.',
    cols: 7,
  });
  X.inputLegend(ws, r, 1);
  r += 2;
  X.headerRow(
    ws,
    r,
    [
      'Zone',
      'Lawn or bed',
      'Length (ft)',
      'Width (ft)',
      'Or measured area (sq ft)',
      'Area (sq ft)',
      'Strip turf?',
    ],
    { aligns: ['left', 'center', 'right', 'right', 'right', 'right', 'center'] }
  );
  r++;
  const zones = [
    ['Front lawn', 'Lawn', 32, 23, null, 'Y'],
    ['North side lawn', 'Lawn', 16, 16, null, 'Y'],
    ['Foundation bed (rock bed, cleaned out)', 'Bed', 46, 8, null, 'N'],
    ['Entry bed along the walk', 'Bed', 24, 6, null, 'Y'],
    ['Corner bed — curved, measured', 'Bed', null, null, 410, 'Y'],
  ];
  const first = r;
  for (let i = 0; i < 8; i++) {
    const z = zones[i];
    X.bodyRow(ws, r, [
      { input: true, value: z?.[0] ?? null },
      { input: true, value: z?.[1] ?? null, align: 'center' },
      { input: true, value: z?.[2] ?? null, numFmt: QTY, align: 'right' },
      { input: true, value: z?.[3] ?? null, numFmt: QTY, align: 'right' },
      { input: true, value: z?.[4] ?? null, numFmt: QTY0, align: 'right' },
      {
        formula: `IF(E${r}<>"",E${r},IF(OR(C${r}="",D${r}=""),"",C${r}*D${r}))`,
        numFmt: QTY0,
      },
      { input: true, value: z?.[5] ?? null, align: 'center' },
    ]);
    r++;
  }
  const last = r - 1;
  X.dropdown(ws, `B${first}:B${last}`, ['Lawn', 'Bed']);
  X.dropdown(ws, `G${first}:G${last}`, ['Y', 'N']);
  X.totalRow(ws, r, [
    { value: 'Total work area (sq ft)' },
    {},
    {},
    {},
    {},
    { formula: `SUM(F${first}:F${last})`, numFmt: X.FMT.int },
    {},
  ]);
  const total = `$F$${r}`;
  r++;
  const derived = (lab, formula) => {
    X.text(ws, r, 1, lab, { size: 9.5, color: X.C.ink2, merge: 5 });
    X.calc(ws, r, 6, formula, { numFmt: X.FMT.int });
    return `$F$${r++}`;
  };
  const lawn = derived(
    'Lawn — new sod (sq ft)',
    `SUMIF(B${first}:B${last},"Lawn",F${first}:F${last})`
  );
  const beds = derived('Beds (sq ft)', `SUMIF(B${first}:B${last},"Bed",F${first}:F${last})`);
  const strip = derived(
    'Existing turf to strip — zones marked Y (sq ft)',
    `SUMIF(G${first}:G${last},"Y",F${first}:F${last})`
  );
  r++;

  X.label(ws, r, 1, 'Assumptions — check your grower and supplier');
  r++;
  const assume = (lab, value, fmt) => {
    X.kv(ws, r, 1, lab, value, { labelTo: 6, numFmt: fmt, align: 'right' });
    return `$G$${r++}`;
  };
  const perPallet = assume(
    'Sod — sq ft per pallet (varies by grower and farm; ask when you order)',
    500,
    X.FMT.int
  );
  const sodWaste = assume('Sod waste — cuts at curves, walks and bed lines', 0.05, X.FMT.pct);
  const cutDepth = assume('Sod cutter depth — inches of turf and soil removed', 1.5, '0.0');
  const inc = assume('Round bulk orders up to (cubic yards — ask your yard)', 0.5, '0.0');
  const piece = assume('Steel edging — feet per piece (check your supplier)', 10, '0');
  const edgeWaste = assume('Edging overlap at joints and waste', 0.05, X.FMT.pct);
  r++;

  X.headerRow(
    ws,
    r,
    ['Bulk material', 'Spread over', 'Area (sq ft)', 'Depth (in)', 'Overage', 'Net CY', 'Order CY'],
    { aligns: ['left', 'center', 'right', 'right', 'right', 'right', 'right'] }
  );
  r++;
  const bulk = [
    ['Compost — tilled into lawn and beds', 'All', 1, 0.1],
    ['Garden soil blend — beds', 'Beds', 2, 0.1],
    ['Shredded wood mulch — beds', 'Beds', 3, 0.1],
  ];
  const bFirst = r;
  for (let i = 0; i < 5; i++) {
    const b = bulk[i];
    X.bodyRow(ws, r, [
      { input: true, value: b?.[0] ?? null },
      { input: true, value: b?.[1] ?? null, align: 'center' },
      {
        formula: `IF(B${r}="Lawn",${lawn},IF(B${r}="Beds",${beds},IF(B${r}="All",${total},"")))`,
        numFmt: QTY0,
      },
      { input: true, value: b?.[2] ?? null, numFmt: '0.0;-0.0;""', align: 'right' },
      { input: true, value: b?.[3] ?? null, numFmt: X.FMT.pctBlank, align: 'right' },
      { formula: `IF(OR(C${r}="",D${r}=""),"",C${r}*D${r}/324)`, numFmt: QTY },
      {
        formula: `IF(F${r}="","",ROUNDUP(ROUND(F${r}*(1+N(E${r}))/${inc},4),0)*${inc})`,
        numFmt: QTY,
        bold: true,
      },
    ]);
    r++;
  }
  X.dropdown(ws, `B${bFirst}:B${r - 1}`, ['Lawn', 'Beds', 'All']);
  r++;

  X.label(ws, r, 1, 'Linear measurements (ft)');
  r++;
  X.kv(ws, r, 1, 'Edging — every lawn-to-bed edge', 142, {
    labelTo: 6,
    numFmt: X.FMT.int,
    align: 'right',
  });
  const edge = `$G$${r}`;
  r += 2;

  X.headerRow(ws, r, ['Order quantities', '', '', '', '', 'Unit', 'Quantity'], {
    aligns: ['left', 'left', 'left', 'left', 'left', 'center', 'right'],
  });
  r++;
  const out = (lab, unit, formula, fmt = X.FMT.int) => {
    X.text(ws, r, 1, lab, { size: 9.5, merge: 5 });
    X.text(ws, r, 6, unit, { size: 9.5, align: 'center', color: X.C.ink2 });
    X.calc(ws, r, 7, formula, { numFmt: fmt });
    r++;
  };
  const sodOrder = `ROUND(${lawn}*(1+${sodWaste}),4)`;
  out('Turf to strip and haul off', 'SF', strip);
  out(
    'Stripped sod and soil to haul, before swell — size the trailer or dumpster',
    'CY',
    `ROUNDUP(ROUND(${strip}*${cutDepth}/324,4),1)`,
    '0.0'
  );
  out('Sod — measured lawn (the quantity the customer sees)', 'SF', lawn);
  out('Sod to order, with waste', 'SF', `ROUNDUP(${sodOrder},0)`);
  out(
    'Sod pallets — a partial pallet shows as a decimal',
    'PAL',
    `ROUNDUP(${sodOrder}/${perPallet},1)`,
    '0.0'
  );
  out(
    'Full pallets, if your grower sells only by the pallet',
    'PAL',
    `ROUNDUP(${sodOrder}/${perPallet},0)`
  );
  out('Soil prep and fine grade — lawn plus beds', 'SF', total);
  out('Steel edging, with overlap', 'LF', `ROUNDUP(ROUND(${edge}*(1+${edgeWaste}),4),0)`);
  out('Steel edging pieces', 'PC', `ROUNDUP(ROUND(${edge}*(1+${edgeWaste})/${piece},4),0)`);
  r++;
  X.noteRow(
    ws,
    r,
    'Cubic yards = area (sq ft) × depth (in) ÷ 324. One cubic yard covers 324 sq ft at 1 in. deep, 108 sq ft at 3 in. Price sod on the measured lawn and keep the cutting waste in your unit price. Call 811 before you dig: it marks public utilities, not private sprinkler, lighting or gas lines.',
    7,
    { height: 44 }
  );
  r += 2;
  X.brandFooter(
    ws,
    r,
    7,
    'Free template by BuildWorkPro — buildworkpro.com/templates. Quantities are estimates; confirm pallet size and coverage with your supplier.'
  );
  return ws;
}

/** Plant list and irrigation zones → plants by container size, emitters, heads, pipe, tubing. */
function plantTakeoff(wb) {
  const ws = X.sheet(wb, 'Plants and Irrigation', { fitHeight: 1 });
  X.widths(ws, [34, 10, 9, 11, 11, 10, 11]);
  let r = X.titleBlock(ws, {
    title: 'Plants and Irrigation',
    subtitle:
      'Plant list → counts by container size and drip emitters. Enter a count, or a massed area and spacing. Zone list → heads, pipe and drip tubing.',
    cols: 7,
  });
  X.inputLegend(ws, r, 1);
  r += 2;
  X.headerRow(
    ws,
    r,
    [
      'Plant — bed',
      'Size',
      'Count',
      'Or massed area (sq ft)',
      'Spacing (in. o.c.)',
      'Layout',
      'Plants',
    ],
    { aligns: ['left', 'center', 'right', 'right', 'right', 'center', 'right'] }
  );
  r++;
  const plants = [
    ['Crabapple, 1.5 in. caliper — corner bed', 'Tree B&B', 1],
    ['Dwarf rabbitbrush — corner bed', '5 gal', 4],
    ['Fernbush — foundation bed', '5 gal', 3],
    ['Blue mist spirea — foundation bed', '5 gal', 5],
    ['Little bluestem, massed — corner bed', '1 gal', null, 96, 18, 'Square'],
    ['Catmint — entry bed', '1 gal', 8],
    ['Penstemon — entry and corner beds', '1 gal', 9],
  ];
  const first = r;
  for (let i = 0; i < 10; i++) {
    const p = plants[i];
    X.bodyRow(ws, r, [
      { input: true, value: p?.[0] ?? null },
      { input: true, value: p?.[1] ?? null, align: 'center' },
      { input: true, value: p?.[2] ?? null, numFmt: QTY0, align: 'right' },
      { input: true, value: p?.[3] ?? null, numFmt: QTY0, align: 'right' },
      { input: true, value: p?.[4] ?? null, numFmt: '0;-0;""', align: 'right' },
      { input: true, value: p?.[5] ?? null, align: 'center' },
      {
        formula: `IF(C${r}<>"",C${r},IF(OR(D${r}="",N(E${r})=0),"",ROUNDUP(ROUND(D${r}*144/E${r}^2*IF(F${r}="Offset",1.155,1),4),0)))`,
        numFmt: QTY0,
      },
    ]);
    r++;
  }
  const last = r - 1;
  const sizes = ['1 gal', '2 gal', '5 gal', '15 gal', 'Tree B&B'];
  X.dropdown(ws, `B${first}:B${last}`, sizes);
  X.dropdown(ws, `F${first}:F${last}`, ['Square', 'Offset']);
  r++;

  X.headerRow(
    ws,
    r,
    ['Plants by container size', '', '', '', 'Emitters per plant', 'Plants', 'Drip emitters'],
    { aligns: ['left', 'left', 'left', 'left', 'right', 'right', 'right'] }
  );
  r++;
  const emitters = { '1 gal': 1, '2 gal': 1, '5 gal': 2, '15 gal': 3, 'Tree B&B': 4 };
  const sFirst = r;
  for (const s of sizes) {
    X.bodyRow(ws, r, [
      { value: s },
      {},
      {},
      {},
      { input: true, value: emitters[s], numFmt: '0', align: 'right' },
      {
        formula: `SUMIF($B$${first}:$B$${last},A${r},$G$${first}:$G$${last})`,
        numFmt: X.FMT.int,
      },
      { formula: `F${r}*N(E${r})`, numFmt: X.FMT.int },
    ]);
    r++;
  }
  const sLast = r - 1;
  X.totalRow(ws, r, [
    { value: 'Total plants and emitters' },
    {},
    {},
    {},
    {},
    { formula: `SUM(F${sFirst}:F${sLast})`, numFmt: X.FMT.int },
    { formula: `SUM(G${sFirst}:G${sLast})`, numFmt: X.FMT.int },
  ]);
  const emitTotal = `$G$${r}`;
  r++;
  X.text(
    ws,
    r,
    1,
    'Emitters per plant are a starting point. Size them to your drip design, the emitter maker’s flow rates and the soil.',
    { size: 8.5, italic: true, color: X.C.ink2, merge: 7 }
  );
  r += 2;

  X.label(ws, r, 1, 'Assumptions — check your supplier');
  r++;
  const assume = (lab, value, fmt) => {
    X.kv(ws, r, 1, lab, value, { labelTo: 6, numFmt: fmt, align: 'right' });
    return `$G$${r++}`;
  };
  const pipeOver = assume('Pipe and tubing overage — bends, fittings, tie-ins', 0.1, X.FMT.pct);
  const roll = assume('1/2 in. drip tubing — feet per roll', 250, X.FMT.int);
  r++;

  X.headerRow(
    ws,
    r,
    ['Irrigation zone', 'Type', 'Work', 'Heads to add or move', 'Pipe or tubing (LF)', '', ''],
    { aligns: ['left', 'center', 'center', 'right', 'right', 'left', 'left'] }
  );
  r++;
  const zones = [
    ['Zone 1 — front lawn', 'Spray', 'Modify', 5, 30],
    ['Zone 2 — north side lawn', 'Spray', 'Modify', 2, 14],
    ['Zone 3 — foundation and entry beds', 'Drip', 'Convert', null, 180],
    ['Zone 4 — corner bed', 'Drip', 'Convert', null, 150],
  ];
  const zFirst = r;
  for (let i = 0; i < 6; i++) {
    const z = zones[i];
    X.bodyRow(ws, r, [
      { input: true, value: z?.[0] ?? null },
      { input: true, value: z?.[1] ?? null, align: 'center' },
      { input: true, value: z?.[2] ?? null, align: 'center' },
      { input: true, value: z?.[3] ?? null, numFmt: QTY0, align: 'right' },
      { input: true, value: z?.[4] ?? null, numFmt: QTY0, align: 'right' },
    ]);
    r++;
  }
  const zLast = r - 1;
  X.dropdown(ws, `B${zFirst}:B${zLast}`, ['Spray', 'Rotor', 'Drip']);
  X.dropdown(ws, `C${zFirst}:C${zLast}`, ['Modify', 'Convert', 'New']);
  const B = `B${zFirst}:B${zLast}`;
  const Cw = `C${zFirst}:C${zLast}`;
  r++;

  X.headerRow(ws, r, ['Order quantities', '', '', '', '', 'Unit', 'Quantity'], {
    aligns: ['left', 'left', 'left', 'left', 'left', 'center', 'right'],
  });
  r++;
  const out = (lab, unit, formula, fmt = X.FMT.int) => {
    X.text(ws, r, 1, lab, { size: 9.5, merge: 5 });
    X.text(ws, r, 6, unit, { size: 9.5, align: 'center', color: X.C.ink2 });
    X.calc(ws, r, 7, formula, { numFmt: fmt });
    r++;
  };
  const dripLf = `ROUND(SUMIF(${B},"Drip",E${zFirst}:E${zLast})*(1+${pipeOver}),4)`;
  out(
    'Drip zones to convert or add — filter and pressure-regulator kits',
    'ZN',
    `COUNTIFS(${B},"Drip",${Cw},"<>Modify")`
  );
  out('New valves — zones marked New', 'EA', `COUNTIF(${Cw},"New")`);
  out('Spray or rotor heads to add or move', 'EA', `SUMIF(${B},"<>Drip",D${zFirst}:D${zLast})`);
  out(
    'Lateral pipe for spray and rotor zones, with overage',
    'LF',
    `ROUNDUP(ROUND(SUMIF(${B},"<>Drip",E${zFirst}:E${zLast})*(1+${pipeOver}),4),0)`
  );
  out('Drip tubing, with overage', 'LF', `ROUNDUP(${dripLf},0)`);
  out('Drip tubing rolls', 'RL', `ROUNDUP(ROUND(${dripLf}/${roll},4),0)`);
  out('Drip emitters — from the plant list', 'EA', emitTotal);
  r++;
  X.noteRow(
    ws,
    r,
    'Plants from spacing = area × 144 ÷ spacing² (inches) on a square grid; offset (triangular) rows take about 15% more. Tip: flag every sprinkler head and valve box before the sod cutter runs, and price repairs to the old system as a stated hourly rate in your terms.',
    7,
    { height: 44 }
  );
  r += 2;
  X.brandFooter(
    ws,
    r,
    7,
    'Free template by BuildWorkPro — buildworkpro.com/templates. Quantities are estimates; confirm your drip design and local backflow rules.'
  );
  return ws;
}

function takeoff(wb) {
  siteTakeoff(wb);
  plantTakeoff(wb);
}

export const { html, docx, xlsx } = tradeEstimate({
  meta,
  trade: 'Landscaping',
  specs: [
    { key: 'area', label: 'Lawn / beds' },
    { key: 'soil', label: 'Soil prep', flex: 1.3 },
    { key: 'mulch', label: 'Bed mulch', flex: 1.15 },
    { key: 'irrigation', label: 'Irrigation', flex: 1.45 },
    { key: 'warranty', label: 'Plant warranty', flex: 1.1 },
  ],
  sections: [
    { title: 'Site prep & grading', hint: 'turf removal, clean-out, soil prep, grade', blank: 3 },
    { title: 'Planting, sod & mulch', hint: 'sod, trees, shrubs, perennials, mulch', blank: 4 },
    {
      title: 'Irrigation, edging & cleanup',
      hint: 'drip, spray heads, edging, final cleanup',
      blank: 3,
    },
  ],
  descriptionHint: 'what you will remove and install, and what "done" looks like',
  termsHint: 'deposit, payment, sprinkler repairs, exclusions, plant warranty',
  termsExample:
    'Example: 40% deposit on acceptance; balance at completion. Repairs to the existing sprinkler system beyond the listed work billed at $85/hr plus parts, approved first. Excludes hardscape. Plants warranted 1 year with drip running; sod not warranted after installation.',
  fine: FINE,
  xlsxSubtitle:
    'Customer-facing estimate by phase — site prep, planting, sod, mulch, irrigation — with tax, deposit and balance computed. Print fits one page.',
  sample: SAMPLE,
  takeoff,
  pricing: {
    laborRate: 40,
    overhead: 0.15,
    margin: 0.15,
    rows: [
      {
        item: 'Strip turf with sod cutter, incl. disposal',
        unit: 'SF',
        mat: 0,
        hrs: 0.01,
        other: 0.3,
      },
      {
        item: 'Soil prep: 1 in. compost tilled 6 in., fine grade',
        unit: 'SF',
        mat: 0.16,
        hrs: 0.01,
        other: 0.03,
      },
      {
        item: 'Bluegrass sod, installed, incl. waste',
        unit: 'SF',
        mat: 0.62,
        hrs: 0.01,
        other: 0.15,
      },
      { item: 'Shrub, 5-gal, planted', unit: 'EA', mat: 34, hrs: 0.6, other: 4 },
      { item: 'Perennial or grass, 1-gal, planted', unit: 'EA', mat: 11, hrs: 0.2, other: 1 },
      { item: 'Shredded wood mulch, placed', unit: 'CY', mat: 38, hrs: 0.7, other: 2 },
      { item: 'Steel edging, 1/8 × 4 in., staked', unit: 'LF', mat: 3.6, hrs: 0.06, other: 0.25 },
      { item: 'Spray-to-drip zone conversion', unit: 'ZN', mat: 185, hrs: 7, other: 8 },
    ],
    note: 'Labor hours per unit come from your own crews: divide the hours a crew spent by the square feet, yards or plants it installed on your last few jobs. Material is delivered cost; "other" covers equipment rental, dump fees, delivery and consumables per unit.',
  },
  howTo: {
    steps: [
      'Measure the yard on the Site Takeoff sheet: list each lawn and bed zone with its length and width, or its measured area if it is curved, and mark the zones where turf comes out. Lawn, bed, turf-removal and sod quantities compute.',
      'Set the compost, soil and mulch depths in the bulk table and the sod pallet size from your grower, then enter the edging length. Order yards, pallets and edging pieces calculate.',
      'On the Plants and Irrigation sheet, list the plants with a count, or a massed area and spacing, then each irrigation zone with its type, heads and pipe. Plants by container size, drip emitters, heads, pipe and tubing compute.',
      'Build your selling prices on the Unit Prices sheet: material, labor hours and other cost per unit, your loaded labor rate, overhead, and profit as a margin on price.',
      'On the Estimate sheet, fill in the customer and the job specs, then enter line items under each phase with quantity, unit and unit price. Mark taxable lines Y and enter your rate, or leave tax at 0% if it is in your prices. Set the deposit.',
      'List optional items such as a paver walk or a smart controller outside the total, write your terms with the sprinkler-repair rate and plant warranty, then print or save as PDF and get the signature and deposit before you order plants.',
    ],
    tips: [
      'Price sod on the measured lawn and keep the cutting waste in your unit price. The customer pays for the lawn they get, and the takeoff still orders the extra.',
      'Put an hourly rate for repairs to the existing sprinkler system in your terms. Old systems break when you trench and cut sod, and a stated rate turns the fix into a quick approval instead of an argument.',
      'Flag every sprinkler head and valve box before the sod cutter runs, and call 811 before any digging. 811 does not mark private lines such as sprinklers, landscape lighting or gas to a grill.',
      'Tie the plant warranty to working irrigation and a written watering schedule. First-season plant losses usually come down to watering, so the terms should say who is responsible for it.',
    ],
    feature: {
      text: 'In BuildWorkPro every estimate is a bid built from line items priced from your product catalog, with margin and overhead applied as rates. It goes out as a branded PDF for e-signature and converts into a project when the customer accepts.',
      url: 'https://buildworkpro.com/features/construction-bidding/',
    },
  },
});
