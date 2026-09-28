// Roofing estimate — the customer-facing re-roof estimate, grouped the way a
// roofer prices the job (tear-off, roof system, flashing & ventilation,
// permits), plus a roof takeoff sheet that turns plan dimensions and pitch
// into squares, bundles and linear footage. Rendered by the trade-estimate kit.
import * as X from '../kit/xlsx.mjs';
import { tradeEstimate } from '../kit/trade-estimate.mjs';

export const meta = {
  slug: 'roofing-estimate',
  name: 'Roofing Estimate Template',
  basename: 'roofing-estimate-template',
  docName: 'Roofing estimate',
};

// A two-layer tear-off and Class 4 re-roof in the Denver hail belt. 28.4
// squares measured; unit prices are installed prices per unit of roof area,
// with waste carried in the shingle price.
const SAMPLE = {
  company: {
    name: 'Front Range Roofing & Exteriors',
    line1: '7801 E 40th Ave, Denver, CO 80207',
    line2: '(720) 555-0136 · estimates@frontrangeroofing.com · Lic. RC-4471',
  },
  customer: {
    name: 'David & Karen Liu',
    line1: '14820 E Radcliff Ave, Aurora, CO 80015',
    line2: '(303) 555-0187',
  },
  job: {
    name: 'Liu residence — full re-roof',
    line1: '14820 E Radcliff Ave, Aurora, CO 80015',
    line2: 'Two-story home + attached garage · one chimney',
  },
  number: 'EST-2026-0187',
  date: 'September 22, 2026',
  valid: 'October 22, 2026',
  start: 'Week of October 12',
  preparedBy: 'Sam Ortega, Owner',
  specs: {
    area: '28.4 SQ measured',
    pitch: '6/12 main · 8/12 garage',
    layers: '2 layers asphalt',
    system: 'Class 4 impact-resistant shingle',
    color: 'Weathered Wood',
  },
  description:
    'Tear off both shingle layers to the deck, replace damaged decking, and install a complete Class 4 roof system with new underlayment, flashing and ridge venting.',
  sections: [
    {
      items: [
        {
          desc: 'Tear off two layers of shingles and felt; haul away',
          qty: 28.4,
          unit: 'SQ',
          price: 95,
        },
        {
          desc: 'Dumpster and landfill fees (about 7 tons), daily cleanup, magnet sweep',
          qty: 1,
          unit: 'LS',
          price: 785,
        },
        {
          desc: 'Replace damaged 7/16" OSB decking — allowance',
          sub: 'Billed per sheet actually replaced, with photos',
          qty: 6,
          unit: 'SHT',
          price: 78,
        },
      ],
    },
    {
      items: [
        {
          desc: 'Class 4 impact-resistant architectural shingles, installed, incl. waste',
          qty: 28.4,
          unit: 'SQ',
          price: 385,
        },
        { desc: 'Synthetic underlayment, full deck', qty: 28.4, unit: 'SQ', price: 38 },
        {
          desc: 'Ice & water shield — eaves (two courses) and all valleys',
          qty: 6,
          unit: 'RL',
          price: 165,
        },
        { desc: 'Starter strip at eaves and rakes', qty: 276, unit: 'LF', price: 2.4 },
        { desc: 'Hip & ridge cap shingles', qty: 96, unit: 'LF', price: 9.5 },
      ],
    },
    {
      items: [
        {
          desc: 'Drip edge, prefinished aluminum — eaves and rakes',
          qty: 276,
          unit: 'LF',
          price: 3.25,
        },
        { desc: 'Chimney step & counter flashing, reglet-cut', qty: 1, unit: 'LS', price: 645 },
        { desc: 'Replace plumbing vent pipe boots', qty: 4, unit: 'EA', price: 65 },
        {
          desc: 'Cut in ridge vent; remove and patch six box vents',
          qty: 48,
          unit: 'LF',
          price: 11,
        },
        { desc: 'Re-roof permit and inspections — City of Aurora', qty: 1, unit: 'LS', price: 385 },
      ],
    },
  ],
  options: [
    { n: 'A', desc: 'Replace gutters and downspouts with 6" seamless aluminum', amount: 2340 },
    {
      n: 'B',
      desc: 'Full redeck in 7/16" OSB if the deck fails inspection after tear-off (replaces the allowance)',
      amount: 5480,
    },
  ],
  taxRate: 0,
  taxBasis: 'materials',
  taxLabel: 'Sales tax — included in prices',
  depositPct: 30,
  terms:
    'Deposit 30% on acceptance to order materials; balance due at completion after the final walkthrough. Decking beyond the 6-sheet allowance is billed at $78/sheet with photos. Excludes gutters, skylights, fascia and soffit repair, and interior damage from existing leaks. Workmanship warranty 5 years; the shingle manufacturer’s warranty passes through to the owner. Price firm through the valid-until date.',
  sig: {
    customer: 'David Liu',
    customerDate: '09/24/2026',
    contractor: 'Sam Ortega, Owner',
    contractorDate: '09/22/2026',
  },
};

const FINE =
  'Based on measurements taken before tear-off. Hidden damage and owner-requested changes are priced by written change order first. Check your state’s home-improvement contract and deposit rules. Not legal advice.';

/** Roof takeoff: plan dimensions × pitch factor → squares, then materials by count. */
function takeoff(wb) {
  const ws = X.sheet(wb, 'Roof Takeoff', { fitHeight: 1 });
  X.widths(ws, [30, 13, 13, 12, 12, 15]);
  let r = X.titleBlock(ws, {
    title: 'Roof Takeoff',
    subtitle:
      'Plan (footprint) dimensions × pitch factor = true roof area. Measured along the slope already? Enter the pitch as 0.',
    cols: 6,
  });
  X.inputLegend(ws, r, 1);
  r += 2;
  X.headerRow(
    ws,
    r,
    [
      'Roof plane',
      'Plan length (ft)',
      'Plan width (ft)',
      'Pitch (rise/12)',
      'Pitch factor',
      'Roof area (sq ft)',
    ],
    { aligns: ['left', 'right', 'right', 'right', 'right', 'right'] }
  );
  r++;
  const planes = [
    ['Main — front', 52, 18, 6],
    ['Main — back', 52, 18, 6],
    ['Garage — left', 26, 12, 8],
    ['Garage — right', 26, 12, 8],
  ];
  const first = r;
  for (let i = 0; i < 10; i++) {
    const p = planes[i];
    X.bodyRow(ws, r, [
      { input: true, value: p?.[0] ?? null },
      { input: true, value: p?.[1] ?? null, numFmt: '#,##0.0;-#,##0.0;""', align: 'right' },
      { input: true, value: p?.[2] ?? null, numFmt: '#,##0.0;-#,##0.0;""', align: 'right' },
      { input: true, value: p?.[3] ?? null, numFmt: '0.0;-0.0;""', align: 'right' },
      { formula: `IF(B${r}="","",SQRT(1+(N(D${r})/12)^2))`, numFmt: '0.000;-0.000;""' },
      { formula: `IF(OR(B${r}="",C${r}=""),"",B${r}*C${r}*E${r})`, numFmt: '#,##0;-#,##0;""' },
    ]);
    r++;
  }
  const last = r - 1;
  X.totalRow(ws, r, [
    { value: 'Total roof area (sq ft)' },
    {},
    {},
    {},
    {},
    { formula: `SUM(F${first}:F${last})`, numFmt: X.FMT.int },
  ]);
  const areaRow = r;
  const area = `F${areaRow}`;
  r++;
  X.text(ws, r, 1, 'Squares (1 SQ = 100 sq ft of roof)', { size: 9.5, color: X.C.ink2 });
  X.calc(ws, r, 6, `${area}/100`, { numFmt: '0.0' });
  const sq = `F${r}`;
  r += 2;

  X.label(ws, r, 1, 'Assumptions — check the wrapper and the manufacturer’s instructions');
  r++;
  const assume = (lab, value, fmt) => {
    X.kv(ws, r, 1, lab, value, { labelTo: 5, numFmt: fmt, align: 'right' });
    return `F${r++}`;
  };
  const waste = assume(
    'Waste — about 10% on simple gables, 15%+ on hip and cut-up roofs',
    0.12,
    X.FMT.pct
  );
  const bundlesPerSq = assume('Shingle bundles per square', 3, '0');
  const layers = assume('Existing layers to tear off', 2, '0');
  const debris = assume(
    'Tear-off debris — lb per square per layer (weigh a load to calibrate)',
    250,
    X.FMT.int
  );
  const capLfPerBundle = assume('Hip & ridge cap — linear feet per bundle', 25, '0');
  const iwsRoll = assume('Ice & water shield — sq ft per roll', 200, X.FMT.int);
  const iwsCourses = assume('Ice & water at eaves — courses (3 ft each)', 2, '0');
  const underRoll = assume(
    'Synthetic underlayment — sq ft per roll (net of laps)',
    1000,
    X.FMT.int
  );
  const exposure = assume(
    'Shingle exposure (inches) — one step flashing per course',
    5.625,
    '0.000'
  );
  r++;

  X.label(ws, r, 1, 'Linear measurements (ft)');
  r++;
  const lin = (lab, value) => {
    X.kv(ws, r, 1, lab, value, { labelTo: 5, numFmt: '#,##0', align: 'right' });
    return `F${r++}`;
  };
  const eaves = lin('Eaves', 156);
  const rakes = lin('Rakes', 120);
  const ridges = lin('Ridges', 78);
  const hips = lin('Hips', 18);
  const valleys = lin('Valleys', 36);
  const walls = lin('Roof-to-wall intersections (step flashing)', 22);
  r++;

  X.headerRow(ws, r, ['Order quantities', '', '', '', 'Unit', 'Quantity'], {
    aligns: ['left', 'left', 'left', 'left', 'center', 'right'],
  });
  r++;
  const out = (lab, unit, formula, fmt = X.FMT.int) => {
    X.text(ws, r, 1, lab, { size: 9.5, merge: 4 });
    X.text(ws, r, 5, unit, { size: 9.5, align: 'center', color: X.C.ink2 });
    X.calc(ws, r, 6, formula, { numFmt: fmt });
    r++;
  };
  out('Tear-off — roof squares (price for the layer count above)', 'SQ', `${sq}`, '0.0');
  out(
    'Tear-off debris — size the dumpster',
    'TON',
    `ROUND(${sq}*${layers}*${debris}/2000,1)`,
    '0.0'
  );
  out('Shingles to order, with waste', 'SQ', `ROUNDUP(${sq}*(1+${waste}),1)`, '0.0');
  out('Shingle bundles', 'BDL', `ROUNDUP(${sq}*(1+${waste})*${bundlesPerSq},0)`);
  out('Synthetic underlayment', 'RL', `ROUNDUP(${area}/${underRoll},0)`);
  out(
    'Ice & water shield (eaves courses + a 3-ft strip in each valley)',
    'RL',
    `ROUNDUP((${eaves}*3*${iwsCourses}+${valleys}*3)/${iwsRoll},0)`
  );
  out('Starter strip (eaves + rakes)', 'LF', `${eaves}+${rakes}`);
  out('Drip edge (eaves + rakes), 10-ft pieces', 'PC', `ROUNDUP((${eaves}+${rakes})/10,0)`);
  out('Hip & ridge cap', 'LF', `${ridges}+${hips}`);
  out('Hip & ridge cap bundles', 'BDL', `ROUNDUP((${ridges}+${hips})/${capLfPerBundle},0)`);
  out('Ridge vent — up to the full ridge length', 'LF', `${ridges}`);
  out('Step flashing pieces', 'PC', `ROUNDUP(${walls}*12/${exposure},0)`);
  out('Full redeck — 4×8 OSB sheets incl. 5% cutting', 'SHT', `ROUNDUP(${area}/32*1.05,0)`);
  r++;
  X.noteRow(
    ws,
    r,
    'Pitch factor = √(1 + (rise ÷ 12)²): a 6/12 roof is 1.118 × its footprint, an 8/12 roof 1.202 ×. Every extra layer adds tear-off labor and dumpster weight — price it. Keep waste in your unit price, not in the square count the customer sees.',
    6,
    { height: 44 }
  );
  r += 2;
  X.brandFooter(
    ws,
    r,
    6,
    'Free template by BuildWorkPro — buildworkpro.com/templates. Quantities are estimates; confirm coverage and nailing with the manufacturer.'
  );
  return ws;
}

export const { html, docx, xlsx } = tradeEstimate({
  meta,
  trade: 'Roofing',
  specs: [
    { key: 'area', label: 'Roof area' },
    { key: 'pitch', label: 'Pitch', flex: 1.1 },
    { key: 'layers', label: 'Tear-off' },
    { key: 'system', label: 'Roof system', flex: 1.5 },
    { key: 'color', label: 'Color' },
  ],
  sections: [
    { title: 'Tear-off & deck prep', hint: 'remove, dispose, repair deck', blank: 3 },
    { title: 'Roof system', hint: 'shingles, underlayment, ice & water, starter, cap', blank: 4 },
    {
      title: 'Flashing, ventilation & permits',
      hint: 'drip edge, chimney, boots, vents, permit',
      blank: 3,
    },
  ],
  descriptionHint: 'what you will tear off and install, and what "done" looks like',
  termsHint: 'deposit, payment, decking allowance, exclusions, warranty',
  termsExample:
    'Example: 30% deposit on acceptance; balance at completion. Decking beyond the allowance billed per sheet with photos. Excludes gutters, skylights and fascia repair. 5-year workmanship warranty; manufacturer’s warranty passes through.',
  fine: FINE,
  xlsxSubtitle:
    'Customer-facing estimate by phase — tear-off, roof system, flashing, permits — with tax, deposit and balance computed. Print fits one page.',
  sample: SAMPLE,
  takeoff,
  pricing: {
    laborRate: 48,
    overhead: 0.12,
    margin: 0.15,
    rows: [
      { item: 'Tear-off, two layers, incl. disposal', unit: 'SQ', mat: 0, hrs: 1.1, other: 18 },
      { item: 'Class 4 architectural shingles, installed', unit: 'SQ', mat: 190, hrs: 2, other: 6 },
      { item: 'Synthetic underlayment', unit: 'SQ', mat: 14, hrs: 0.3, other: 1 },
      { item: 'Ice & water shield', unit: 'RL', mat: 95, hrs: 0.8, other: 0 },
      { item: 'Drip edge, prefinished aluminum', unit: 'LF', mat: 1.35, hrs: 0.03, other: 0 },
      { item: 'Hip & ridge cap', unit: 'LF', mat: 3.2, hrs: 0.06, other: 0 },
      { item: 'Pipe boot replacement', unit: 'EA', mat: 18, hrs: 0.5, other: 0 },
      { item: '7/16" OSB decking replacement', unit: 'SHT', mat: 24, hrs: 0.5, other: 2 },
    ],
    note: 'Labor hours per unit come from your own crews: divide the hours a crew spent by the squares it installed on your last few jobs. Material is delivered cost; "other" covers disposal, fasteners and consumables per unit.',
  },
  howTo: {
    steps: [
      'Measure the roof on the Roof Takeoff sheet: enter each plane’s plan dimensions and pitch, then the eaves, rakes, ridges, hips, valleys and wall lengths. Squares, bundles, rolls and linear footage compute.',
      'Build your selling prices on the Unit Prices sheet: material, labor hours and other cost per unit, your loaded labor rate, overhead, and profit as a margin on price.',
      'On the Estimate sheet, fill in your company, the customer and the job specs (area, pitch, layers, system, color), and describe the scope in two or three sentences.',
      'Enter the line items under each phase with quantity, unit and unit price. Mark taxable lines Y and enter your rate, or leave tax at 0% if it is already in your prices. Set the deposit.',
      'List optional items the customer can add (gutters, full redeck) — they are not in the total — then write your terms, including the decking allowance and warranty.',
      'Print or save as PDF, walk the customer through it, and get the acceptance signature and deposit before you order material.',
    ],
    tips: [
      'Carry an explicit decking allowance with a per-sheet price. It is the most common argument on a re-roof, and the one a written allowance settles before tear-off.',
      'Price tear-off by the number of layers. A second or third layer is more labor and more dumpster weight, and the takeoff sheet estimates the tonnage.',
      'Show the customer measured squares, not ordered squares. Waste belongs in your unit price, not in their quantity.',
      'Photograph the deck after tear-off. Photos make the allowance and any change order easy to approve.',
    ],
    feature: {
      text: 'In BuildWorkPro every estimate is a bid built from line items priced from your product catalog, with margin and overhead applied as rates. It goes out as a branded PDF for e-signature and converts into a project when the customer accepts.',
      url: 'https://buildworkpro.com/features/construction-bidding/',
    },
  },
});
