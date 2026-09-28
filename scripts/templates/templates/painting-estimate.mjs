// Painting estimate — the customer-facing interior repaint estimate, grouped
// the way a painter prices the job (prep and protection, walls and ceilings,
// trim and doors), plus a paint takeoff sheet that turns room dimensions into
// wall, ceiling and baseboard quantities, gallons by product and by wall
// color, and prep and paint labor hours. Rendered by the trade-estimate kit.
import * as X from '../kit/xlsx.mjs';
import { tradeEstimate } from '../kit/trade-estimate.mjs';

export const meta = {
  slug: 'painting-estimate',
  name: 'Painting Estimate Template',
  basename: 'painting-estimate-template',
  docName: 'Painting estimate',
};

// Main-floor interior repaint of an occupied 1998 two-story in Henrico County,
// VA. Six rooms measured on the Paint Takeoff sheet: 2,547 sq ft of walls net
// of openings, 877 sq ft of ceilings, 251 LF of baseboard, 7 doors, 10
// windows. Unit prices are installed prices; the painter pays tax on paint.
const SAMPLE = {
  company: {
    name: 'Hollis & Reed Painting Co.',
    line1: '1714 Arlington Rd, Richmond, VA 23230',
    line2: '(804) 555-0164 · estimates@hollisreedpainting.com · Licensed & insured',
  },
  customer: {
    name: 'Priya & Daniel Mercer',
    line1: '2917 Linden Glen Ct, Henrico, VA 23233',
    line2: '(804) 555-0187',
  },
  job: {
    name: 'Mercer residence — interior repaint',
    line1: '2917 Linden Glen Ct, Henrico, VA 23233',
    line2: 'Occupied two-story, built 1998 · main floor',
  },
  number: 'EST-2026-0231',
  date: 'September 24, 2026',
  valid: 'October 24, 2026',
  start: 'Week of October 12',
  preparedBy: 'Dana Hollis, Owner',
  specs: {
    area: '3,424 sq ft',
    surfaces: 'Walls, ceilings, trim, doors',
    coats: 'Walls 2 · ceilings 1 · trim 2',
    product: 'Premium acrylic · eggshell',
    colors: '3 wall colors · white trim',
  },
  description:
    'Repaint the main floor: living, dining and family rooms, two-story foyer, front hall and powder room. Walls, ceilings, baseboard, 7 doors and 10 window casings, with furniture moved and covered.',
  sections: [
    {
      items: [
        {
          desc: 'Move and cover furniture, mask floors and fixtures; daily cleanup',
          qty: 6,
          unit: 'RM',
          price: 100,
        },
        {
          desc: 'Wall prep: fill nail holes and hairline cracks, sand, spot-prime',
          qty: 2547,
          unit: 'SF',
          price: 0.25,
        },
        {
          desc: 'Caulk baseboard and casing joints; fill and sand trim',
          qty: 251,
          unit: 'LF',
          price: 1.15,
        },
        {
          desc: 'Drywall repair allowance — cracks and dents beyond normal patching',
          sub: 'Billed at $75/hr for hours actually used, with photos',
          qty: 4,
          unit: 'HR',
          price: 75,
        },
      ],
    },
    {
      items: [
        {
          desc: 'Walls — two coats premium acrylic, eggshell (three colors)',
          qty: 2547,
          unit: 'SF',
          price: 1.45,
        },
        { desc: 'Ceilings — one coat flat ceiling white', qty: 877, unit: 'SF', price: 0.9 },
        {
          desc: 'Two-story foyer — plank and ladder setup for 18-ft walls and ceiling',
          qty: 1,
          unit: 'LS',
          price: 360,
        },
      ],
    },
    {
      items: [
        { desc: 'Baseboard — two coats semi-gloss enamel', qty: 251, unit: 'LF', price: 2.5 },
        {
          desc: 'Interior doors — slab, jamb and casing, both sides, two coats semi-gloss',
          qty: 7,
          unit: 'EA',
          price: 140,
        },
        {
          desc: 'Window casing, sill and apron — two coats semi-gloss',
          qty: 10,
          unit: 'EA',
          price: 70,
        },
        {
          desc: 'Final walkthrough and touch-up; remove masking; leave labeled leftover paint',
          qty: 1,
          unit: 'LS',
          price: 150,
        },
      ],
    },
  ],
  options: [
    {
      n: 'A',
      desc: 'Stair handrail and 24 balusters — sand, spot-prime and two coats semi-gloss',
      amount: 985,
    },
    {
      n: 'B',
      desc: 'Crown molding in the living and dining rooms, 110 LF — caulk and two coats semi-gloss',
      amount: 495,
    },
  ],
  taxRate: 0,
  taxBasis: 'materials',
  taxLabel: 'Sales tax — included in prices',
  depositPct: 25,
  terms:
    'Deposit 25% on acceptance to book the crew and buy paint; balance due at completion after the final walkthrough. Includes 4 hours of drywall repair; more is billed at $75/hr with photos. Colors are final before we start: a color change after paint goes on, or a deep color needing a third coat, is priced by change order. Excludes kitchen, closet interiors and wallpaper removal. Workmanship warranty 2 years.',
  sig: {
    customer: 'Priya Mercer',
    customerDate: '09/26/2026',
    contractor: 'Dana Hollis, Owner',
    contractorDate: '09/24/2026',
  },
};

const FINE =
  'Measured on a walkthrough before work. Hidden damage, color changes after paint is applied and added work are priced by written change order first. Homes built before 1978 may require lead-safe (EPA RRP) work practices. Check your state’s contract and deposit rules. Not legal advice.';

const ROOMS = 12;
const DIM = '0.0;-0.0;""';
const CNT = '0;-0;""';
const AREA = '#,##0;-#,##0;""';
const GAL = '0.0;-0.0;""';

/**
 * Paint takeoff: rooms (L × W × H, openings) → wall, ceiling and baseboard
 * quantities; then gallons by product and by wall color, and prep and paint
 * hours from the crew's production rates. Inputs further down the sheet feed
 * the room formulas, so those rows are reserved first and written afterwards.
 */
function takeoff(wb) {
  const ws = X.sheet(wb, 'Paint Takeoff', { fitHeight: 1 });
  // A Room · B Wall color · C L · D W · E H · F Doors · G Windows · H Ceiling? · I Walls · J Ceiling · K Baseboard
  X.widths(ws, [21, 14, 7.5, 7.5, 7.5, 8.5, 8.5, 8.5, 11.5, 10, 10]);
  let r = X.titleBlock(ws, {
    title: 'Paint Takeoff',
    subtitle:
      'Room dimensions → paintable area, gallons and labor hours. Walls = 2 × (L + W) × H, less door and window openings.',
    cols: 11,
  });
  X.inputLegend(ws, r, 1);
  r += 2;
  X.headerRow(
    ws,
    r,
    [
      'Room',
      'Wall color',
      'Length (ft)',
      'Width (ft)',
      'Wall height (ft)',
      'Doors & openings',
      'Windows',
      'Paint ceiling? (Y/N)',
      'Net walls (sq ft)',
      'Ceiling (sq ft)',
      'Baseboard (LF)',
    ],
    {
      aligns: [
        'left',
        'left',
        'right',
        'right',
        'right',
        'right',
        'right',
        'center',
        'right',
        'right',
        'right',
      ],
      height: 34,
    }
  );
  r++;
  const first = r;
  const last = first + ROOMS - 1;
  r = last + 1;
  const totRow = r++;
  const areaRow = r;
  r += 2;

  // ---- Openings, counts and crew ----
  X.label(ws, r, 1, 'Openings, counts and crew');
  r++;
  const kvIn = (lab, value, fmt) => {
    X.kv(ws, r, 1, lab, value, { labelTo: 10, numFmt: fmt, align: 'right' });
    return `$K$${r++}`;
  };
  const doorDed = kvIn(
    'Wall area deducted per door or cased opening (sq ft; a 3 × 7 ft door = 21)',
    21,
    X.FMT.int
  );
  const winDed = kvIn(
    'Wall area deducted per window (sq ft; a 3 × 5 ft window = 15)',
    15,
    X.FMT.int
  );
  const doorW = kvIn('Door width — no baseboard across the opening (ft)', 3, '0.0');
  const doorsToPaint = kvIn(
    'Doors to paint — count each door once, even where two rooms share it',
    7,
    '0'
  );
  const windowsToPaint = kvIn('Windows to paint — casing, sill and apron', 10, '0');
  const crew = kvIn('Crew size (painters on site)', 2, '0');
  const hoursPerDay = kvIn('Hours per working day', 8, '0.0');
  r++;

  // ---- Wall colors (rows reserved; filled once the Walls task row is known) ----
  X.headerRow(
    ws,
    r,
    [
      'Wall colors — name each once, then pick it per room above',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      'Walls (sq ft)',
      'Gallons needed',
      'Gallons to order',
    ],
    {
      aligns: [
        'left',
        'left',
        'left',
        'left',
        'left',
        'left',
        'left',
        'left',
        'right',
        'right',
        'right',
      ],
    }
  );
  ws.mergeCells(r, 1, r, 8);
  r++;
  const colorFirst = r;
  const colorLast = colorFirst + 3;
  r = colorLast + 1;
  const unmatchedRow = r;
  r += 2;

  // ---- Coverage and production by task ----
  X.headerRow(
    ws,
    r,
    [
      'Task — coverage from the can, rates from your own crews',
      '',
      '',
      'Qty',
      'Unit',
      'Coats / passes',
      'Paint sq ft per unit',
      'Spread (sq ft per gal)',
      'Gallons',
      'Rate per hour, per coat',
      'Hours',
    ],
    {
      aligns: [
        'left',
        'left',
        'left',
        'right',
        'center',
        'right',
        'right',
        'right',
        'right',
        'right',
        'right',
      ],
      height: 34,
    }
  );
  ws.mergeCells(r, 1, r, 3);
  r++;
  const rooms = `COUNT(C${first}:C${last})`;
  const walls = `$I$${totRow}`;
  const ceilings = `$J$${totRow}`;
  const baseboard = `$K$${totRow}`;
  const taskFirst = r;
  const task = (lab, qty, unit, coats, perUnit, spread, rate) => {
    X.bodyRow(ws, r, [
      { value: lab, size: 9.5 },
      {},
      {},
      { formula: qty, numFmt: AREA },
      { value: unit, align: 'center', color: X.C.ink2 },
      { input: true, value: coats, numFmt: CNT, align: 'right' },
      { input: perUnit != null, value: perUnit, align: 'right' },
      { input: spread != null, value: spread, numFmt: CNT, align: 'right' },
      {
        formula: `IF(OR(D${r}="",G${r}="",H${r}=""),"",D${r}*N(F${r})*G${r}/H${r})`,
        numFmt: GAL,
      },
      { input: true, value: rate, align: 'right' },
      { formula: `IF(OR(D${r}="",N(J${r})=0),"",D${r}*N(F${r})/J${r})`, numFmt: GAL },
    ]);
    ws.mergeCells(r, 1, r, 3);
    return r++;
  };
  task('Setup, masking, cleanup (rate = rooms/hr)', rooms, 'RM', 1, null, null, 0.8);
  const prep = task('Wall prep & spot-prime (G = share primed)', walls, 'SF', 1, 0.1, 300, 350);
  task('Trim prep — caulk and fill', baseboard, 'LF', 1, null, null, 80);
  const wallTask = task('Walls — cut in and roll', walls, 'SF', 2, 1, 350, 140);
  const ceilTask = task('Ceilings — cut in and roll', ceilings, 'SF', 1, 1, 350, 100);
  const baseTask = task(
    'Baseboard (G: 5-in face = 0.42 sq ft/LF)',
    baseboard,
    'LF',
    2,
    0.42,
    350,
    60
  );
  const doorTask = task(
    'Doors — slab, jamb, casing, both sides',
    doorsToPaint,
    'EA',
    2,
    50,
    350,
    1.25
  );
  const winTask = task('Windows — casing, sill and apron', windowsToPaint, 'EA', 2, 8, 350, 2.2);
  const taskLast = r - 1;
  X.totalRow(ws, r, [
    { value: 'Total labor hours — prep and paint' },
    {},
    {},
    {},
    {},
    {},
    {},
    {},
    {},
    {},
    { formula: `SUM(K${taskFirst}:K${taskLast})`, numFmt: '0.0' },
  ]);
  const hoursRow = r;
  r += 2;

  // ---- Rooms (now that the opening sizes are placed) ----
  const sample = [
    ['Living room', 'Warm greige', 16, 14, 9, 1, 3, 'Y'],
    ['Dining room', 'Sage green', 13, 12, 9, 2, 2, 'Y'],
    ['Family room', 'Warm greige', 18, 16, 9, 2, 4, 'Y'],
    ['Foyer — two-story', 'Warm greige', 12, 8, 18, 3, 1, 'Y'],
    ['Front hall', 'Warm greige', 22, 4, 9, 4, 0, 'Y'],
    ['Powder room', 'Soft blue', 5, 5, 9, 1, 0, 'Y'],
  ];
  for (let i = 0; i < ROOMS; i++) {
    const p = sample[i];
    const row = first + i;
    X.bodyRow(ws, row, [
      { input: true, value: p?.[0] ?? null },
      { input: true, value: p?.[1] ?? null },
      { input: true, value: p?.[2] ?? null, numFmt: DIM, align: 'right' },
      { input: true, value: p?.[3] ?? null, numFmt: DIM, align: 'right' },
      { input: true, value: p?.[4] ?? null, numFmt: DIM, align: 'right' },
      { input: true, value: p?.[5] ?? null, numFmt: CNT, align: 'right' },
      { input: true, value: p?.[6] ?? null, numFmt: CNT, align: 'right' },
      { input: true, value: p?.[7] ?? null, align: 'center' },
      {
        formula: `IF(OR(C${row}="",D${row}="",E${row}=""),"",MAX(0,2*(C${row}+D${row})*E${row}-N(F${row})*${doorDed}-N(G${row})*${winDed}))`,
        numFmt: AREA,
      },
      {
        formula: `IF(OR(C${row}="",D${row}=""),"",IF(H${row}="N",0,C${row}*D${row}))`,
        numFmt: AREA,
      },
      {
        formula: `IF(OR(C${row}="",D${row}=""),"",MAX(0,2*(C${row}+D${row})-N(F${row})*${doorW}))`,
        numFmt: AREA,
      },
    ]);
  }
  X.dropdown(ws, `H${first}:H${last}`, ['Y', 'N']);
  ws.dataValidations.add(`B${first}:B${last}`, {
    type: 'list',
    allowBlank: true,
    formulae: [`$A$${colorFirst}:$A$${colorLast}`],
    showErrorMessage: true,
    errorTitle: 'Pick a wall color',
    error: 'Add the color to the Wall colors list below first, then pick it here.',
  });
  X.totalRow(ws, totRow, [
    { value: 'Totals' },
    {},
    {},
    {},
    {},
    {},
    { formula: `SUM(G${first}:G${last})`, numFmt: X.FMT.int },
    {},
    { formula: `SUM(I${first}:I${last})`, numFmt: X.FMT.int },
    { formula: `SUM(J${first}:J${last})`, numFmt: X.FMT.int },
    { formula: `SUM(K${first}:K${last})`, numFmt: X.FMT.int },
  ]);
  X.text(ws, areaRow, 1, 'Paintable area — walls + ceilings (sq ft)', {
    size: 9.5,
    color: X.C.ink2,
    merge: 10,
  });
  X.calc(ws, areaRow, 11, `I${totRow}+J${totRow}`, { numFmt: X.FMT.int, bold: true });

  // ---- Wall colors: paint is bought by color, so each one rounds up on its own ----
  const colors = ['Warm greige', 'Sage green', 'Soft blue'];
  const wallCoats = `$F$${wallTask}`;
  const wallSpread = `$H$${wallTask}`;
  for (let i = 0; i < 4; i++) {
    const row = colorFirst + i;
    X.bodyRow(ws, row, [
      { input: true, value: colors[i] ?? null },
      { input: true },
      {},
      {},
      {},
      {},
      {},
      {},
      {
        formula: `IF(A${row}="","",SUMIF($B$${first}:$B$${last},A${row},$I$${first}:$I$${last}))`,
        numFmt: AREA,
      },
      { formula: `IF(A${row}="","",I${row}*${wallCoats}/${wallSpread})`, numFmt: GAL },
      { formula: `IF(A${row}="","",ROUNDUP(J${row},0))`, numFmt: CNT },
    ]);
    ws.mergeCells(row, 1, row, 2);
  }
  X.text(ws, unmatchedRow, 1, 'Wall area with no color from this list (should be 0)', {
    size: 9,
    color: X.C.ink2,
    merge: 8,
  });
  X.calc(ws, unmatchedRow, 9, `${walls}-SUM(I${colorFirst}:I${colorLast})`, {
    numFmt: X.FMT.int,
  });

  // ---- Order quantities and schedule ----
  X.headerRow(ws, r, ['Order and schedule', '', '', '', '', '', '', '', '', 'Unit', 'Quantity'], {
    aligns: [
      'left',
      'left',
      'left',
      'left',
      'left',
      'left',
      'left',
      'left',
      'left',
      'center',
      'right',
    ],
  });
  ws.mergeCells(r, 1, r, 9);
  r++;
  const out = (lab, unit, formula, fmt = X.FMT.int) => {
    X.text(ws, r, 1, lab, { size: 9.5, merge: 9 });
    X.text(ws, r, 10, unit, { size: 9.5, align: 'center', color: X.C.ink2 });
    X.calc(ws, r, 11, formula, { numFmt: fmt });
    r++;
  };
  out('Primer for spot-priming patches', 'GAL', `ROUNDUP(N(I${prep}),0)`);
  out(
    'Wall paint — all colors, each rounded up on its own (Wall colors above)',
    'GAL',
    `SUM(K${colorFirst}:K${colorLast})`
  );
  out('Ceiling paint', 'GAL', `ROUNDUP(N(I${ceilTask}),0)`);
  out(
    'Trim enamel — baseboard, doors and windows',
    'GAL',
    `ROUNDUP(N(I${baseTask})+N(I${doorTask})+N(I${winTask}),0)`
  );
  out('Labor hours — prep and paint', 'HR', `K${hoursRow}`, '0.0');
  out(
    'Working days on site (hours ÷ crew size ÷ hours per day)',
    'DAY',
    `ROUNDUP(K${hoursRow}/(${crew}*${hoursPerDay}),1)`,
    '0.0'
  );
  r++;
  X.noteRow(
    ws,
    r,
    'Walls = 2 × (L + W) × H − openings; ceilings = L × W; baseboard = perimeter − door widths. Gallons = area × coats ÷ spread; hours = quantity × coats ÷ your rate. Spread rates on the can assume a smooth, sealed surface, so use less for rough or porous walls. Buy wall paint by color: rounding each color up is why the sample orders 16 gallons, not 15.',
    11,
    { height: 44 }
  );
  r += 2;
  X.brandFooter(
    ws,
    r,
    11,
    'Free template by BuildWorkPro — buildworkpro.com/templates. Quantities are estimates; confirm coverage and recoat times on the product label.'
  );
  return ws;
}

const T = tradeEstimate({
  meta,
  trade: 'Painting',
  specs: [
    { key: 'area', label: 'Paintable area', flex: 0.9 },
    { key: 'surfaces', label: 'Surfaces', flex: 1.35 },
    { key: 'coats', label: 'Coats', flex: 1.4 },
    { key: 'product', label: 'Paint & sheen', flex: 1.3 },
    { key: 'colors', label: 'Colors', flex: 1.3 },
  ],
  sections: [
    { title: 'Prep & protection', hint: 'cover, mask, patch, caulk, spot-prime', blank: 3 },
    { title: 'Walls & ceilings', hint: 'coats and sheen by surface, high-wall access', blank: 4 },
    { title: 'Trim, doors & other', hint: 'baseboard, doors, windows, touch-up', blank: 3 },
  ],
  descriptionHint:
    'rooms and surfaces you will paint, the prep included, and what "done" looks like',
  termsHint: 'deposit, payment, drywall allowance, color changes, exclusions, warranty',
  termsExample:
    'Example: 25% deposit on acceptance; balance at completion. 4 hours of drywall repair included, more billed hourly with photos. Color changes after paint is applied are a change order. Excludes closets and wallpaper removal. 2-year workmanship warranty.',
  fine: FINE,
  xlsxSubtitle:
    'Customer-facing estimate by phase — prep, walls and ceilings, trim and doors — with tax, deposit and balance computed. Print fits one page.',
  sample: SAMPLE,
  takeoff,
  pricing: {
    laborRate: 46,
    overhead: 0.18,
    margin: 0.2,
    rows: [
      {
        item: 'Setup, masking, floor protection, cleanup',
        unit: 'RM',
        mat: 14,
        hrs: 1.25,
        other: 0,
      },
      { item: 'Wall prep — fill, sand, spot-prime', unit: 'SF', mat: 0.03, hrs: 0.003, other: 0 },
      { item: 'Trim prep — caulk and fill', unit: 'LF', mat: 0.18, hrs: 0.013, other: 0 },
      { item: 'Walls — two coats premium acrylic', unit: 'SF', mat: 0.32, hrs: 0.014, other: 0.03 },
      { item: 'Ceilings — one coat flat', unit: 'SF', mat: 0.11, hrs: 0.01, other: 0.02 },
      { item: 'Baseboard — two coats semi-gloss', unit: 'LF', mat: 0.15, hrs: 0.033, other: 0.02 },
      { item: 'Interior door, both sides, two coats', unit: 'EA', mat: 18, hrs: 1.6, other: 4 },
      { item: 'Window casing, sill and apron, two coats', unit: 'EA', mat: 3, hrs: 0.91, other: 2 },
    ],
    note: 'Labor hours per unit = coats ÷ your crew’s rate from the Paint Takeoff sheet: two wall coats at 140 sq ft/hr is 2 ÷ 140 = 0.014 hr per sq ft. Material is paint per unit (coats × sq ft per unit ÷ spread × $/gal); "other" covers tape, plastic, roller covers and caulk.',
  },
  howTo: {
    steps: [
      'Measure each room on the Paint Takeoff sheet: length, width, wall height, the doors and windows in its walls, whether the ceiling gets painted, and its wall color. Wall, ceiling and baseboard quantities compute.',
      'Set the assumptions: opening deductions, doors and windows to paint, coats, the spread rate from the can for each product, and your crew’s production rates. Gallons by product and by color, labor hours and days on site compute.',
      'Build your selling prices on the Unit Prices sheet: material, labor hours and other cost per unit, your loaded labor rate, overhead, and profit as a margin on price.',
      'On the Estimate sheet, fill in your company, the customer and the job specs (paintable area, surfaces, coats, paint and sheen, colors), and describe the scope in two or three sentences.',
      'Enter the line items under prep, walls and ceilings, and trim with quantity, unit and unit price. Mark taxable lines Y and enter your rate, or leave tax at 0% if it is in your prices. Set the deposit, list optional items, and write your terms, including the drywall allowance and the color-change rule.',
      'Print or save as PDF, walk the customer through it room by room, and get the acceptance signature, the deposit and final color choices before you buy paint.',
    ],
    tips: [
      'Carry a drywall repair allowance in hours with an hourly rate. Prep is where repaints run over, and a written allowance settles it before the first patch.',
      'Put the color rule in writing: colors are final before you start, and a change after paint goes on, or a deep color that needs a third coat, is a change order.',
      'Buy wall paint by color, not by the job total. Rounding each color up on its own is why the sample orders 16 gallons, not 15.',
      'Price high walls and stairwells separately. Planks, extension ladders and slower rolling on an 18-ft foyer are real hours that a flat per-square-foot price hides.',
    ],
    feature: {
      text: 'In BuildWorkPro every estimate is a bid built from line items priced from your product catalog, with margin and overhead applied as rates. It goes out as a branded PDF for e-signature and converts into a project when the customer accepts.',
      url: 'https://buildworkpro.com/features/construction-bidding/',
    },
  },
});

export const { html, docx, xlsx } = T;
