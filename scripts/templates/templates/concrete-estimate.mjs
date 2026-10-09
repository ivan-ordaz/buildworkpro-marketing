// Concrete estimate — the customer-facing flatwork estimate, grouped the way a
// concrete contractor prices a tear-out and replace (demo and site prep,
// forming and reinforcement, pour/finish/cure), plus a slab takeoff sheet that
// turns slab dimensions into cubic yards to order, base stone, rebar, forms,
// joints and sealer. Rendered by the trade-estimate kit.
import * as X from '../kit/xlsx.mjs';
import { tradeEstimate } from '../kit/trade-estimate.mjs';

export const meta = {
  slug: 'concrete-estimate',
  name: 'Concrete Estimate Template',
  basename: 'concrete-estimate-template',
  docName: 'Concrete estimate',
};

// Driveway replacement in a freeze-thaw suburb of Indianapolis: three slabs
// (driveway 44 × 20 × 5", street approach 20 × 8 × 6", front walk 28 × 4 × 4")
// = 1,152 sq ft and 17.93 CY in place, ordered at 19.5 CY with 8% waste. Every
// quantity below matches the Slab Takeoff sheet's sample inputs.
const SAMPLE = {
  company: {
    name: 'Alder Creek Concrete & Flatwork',
    line1: '5620 W 86th St, Indianapolis, IN 46278',
    line2: '(317) 555-0142 · bids@aldercreekconcrete.com',
  },
  customer: {
    name: 'Tom & Rachel Adeyemi',
    line1: '11482 Brookstone Dr, Fishers, IN 46038',
    line2: '(317) 555-0193',
  },
  job: {
    name: 'Adeyemi residence — driveway replacement',
    line1: '11482 Brookstone Dr, Fishers, IN 46038',
    line2: 'Driveway, street approach and front walk',
  },
  number: 'EST-2026-0214',
  date: 'September 29, 2026',
  valid: 'October 29, 2026',
  start: 'Week of October 19',
  preparedBy: 'Mike Duran, Owner',
  specs: {
    area: '1,152 sq ft, 3 slabs',
    thickness: '5" drive, 6" apron, 4" walk',
    mix: '4,000 PSI air-entrained',
    reinforcement: '#4 rebar, 24" O.C. e.w.',
    finish: 'Broom, tooled edges',
  },
  description:
    'Remove the old driveway, approach and front walk; pour new reinforced, air-entrained slabs on a compacted stone base, broom finished, jointed and sealed.',
  sections: [
    {
      items: [
        {
          desc: 'Break out old 4" driveway, approach and walk; haul 28 tons to recycler',
          qty: 1152,
          unit: 'SF',
          price: 3.25,
        },
        {
          desc: 'Saw-cut clean break lines at the public walk and curb',
          qty: 60,
          unit: 'LF',
          price: 5.5,
        },
        {
          desc: 'Excavate for new base, fine grade and compact subgrade; haul spoils',
          qty: 1152,
          unit: 'SF',
          price: 0.95,
        },
        {
          desc: '4" crushed-limestone base, placed and compacted',
          qty: 28,
          unit: 'TON',
          price: 58,
        },
        {
          desc: 'Soft-subgrade repair allowance — undercut and replace with stone',
          sub: 'Billed per ton actually used, with photos',
          qty: 4,
          unit: 'TON',
          price: 85,
        },
      ],
    },
    {
      items: [
        {
          desc: 'Set and strip edge forms, staked and pitched to drain',
          qty: 164,
          unit: 'LF',
          price: 3.5,
        },
        {
          desc: '#4 rebar at 24" on center each way, tied on chairs — drive and apron',
          qty: 1151,
          unit: 'LF',
          price: 1.9,
        },
        {
          desc: 'Isolation joint at garage slab, public walk, curb and porch',
          qty: 84,
          unit: 'LF',
          price: 2.5,
        },
      ],
    },
    {
      items: [
        {
          desc: '4,000 PSI air-entrained ready-mix: 17.9 CY in place + 8% waste',
          qty: 19.5,
          unit: 'CY',
          price: 245,
        },
        {
          desc: 'Place, screed and broom finish; tooled edges; curing compound',
          qty: 1152,
          unit: 'SF',
          price: 3.25,
        },
        {
          desc: 'Control joints — saw-cut in drive and apron, tooled in the walk',
          qty: 156,
          unit: 'LF',
          price: 1.6,
        },
        {
          desc: 'Penetrating silane-siloxane sealer, one coat after the 28-day cure',
          qty: 1152,
          unit: 'SF',
          price: 0.55,
        },
        {
          desc: 'Right-of-way permit and inspection for the approach — City of Fishers',
          qty: 1,
          unit: 'LS',
          price: 235,
        },
      ],
    },
  ],
  options: [
    {
      n: 'A',
      desc: 'Side parking pad beside the garage, 10 × 20 ft, same 5" reinforced spec',
      amount: 2780,
    },
    {
      n: 'B',
      desc: 'Replace the public-walk section across the driveway (5 × 20 ft) if the city inspector requires it',
      amount: 1640,
    },
  ],
  taxRate: 0,
  taxBasis: 'materials',
  taxLabel: 'Sales tax — included in material prices',
  depositPct: 30,
  terms:
    'Deposit 30% on acceptance; balance due at completion. Subgrade repair beyond the 4-ton allowance billed at $85/ton with photos, approved before we pour. If the city requires a thicker approach, extra concrete billed at $245/CY. Cold-weather blankets, if needed, at cost. Excludes irrigation and landscape repair. 2-year workmanship warranty; hairline shrinkage cracks are normal and not covered.',
  sig: {
    customer: 'Rachel Adeyemi',
    customerDate: '10/01/2026',
    contractor: 'Mike Duran, Owner',
    contractorDate: '09/29/2026',
  },
};

const FINE =
  'Measured before removal. Subgrade repair beyond the allowance and owner changes are priced by written change order first. Call 811 before digging. Check your state’s contract rules. Not legal advice.';

/**
 * Slab takeoff: one row per slab → area, cubic yards, perimeter, rebar grid,
 * rebar sticks and control joints; then the order quantities. Flatwork only — structural
 * concrete follows the engineer's drawings.
 */
function takeoff(wb) {
  const ws = X.sheet(wb, 'Slab Takeoff', { fitHeight: 1 });
  X.widths(ws, [21, 7.5, 7.5, 7, 7, 7.5, 8, 8.5, 8.5, 9.5, 9.5, 8.5, 9.5]);
  let r = X.titleBlock(ws, {
    title: 'Slab Takeoff',
    subtitle:
      'Flatwork only — driveways, walks, patios, pads. One row per slab; thickness in inches, everything else in feet. Structural slabs and footings follow the engineer’s drawings.',
    cols: 13,
  });
  X.inputLegend(ws, r, 1);
  r += 2;

  // Row layout is fixed so the slab formulas can point at the assumption
  // cells written further down the sheet.
  const ROWS = 8;
  const head = r;
  const first = head + 1;
  const last = first + ROWS - 1;
  const totRow = last + 1;
  const assumeHead = totRow + 2;
  const a0 = assumeHead + 1; // first assumption row (left value in F, right in M)
  const A = (i) => `$F$${a0 + i}`;
  const B = (i) => `$M$${a0 + i}`;

  // Right-column assumptions used by the slab rows.
  const SP = B(0); // rebar spacing, in
  const CV = B(1); // clearance from slab edges, in
  const ST = B(2); // stock bar length, ft
  const LP = B(3); // lap splice, in

  X.headerRow(
    ws,
    head,
    [
      'Slab / pour',
      'Length (ft)',
      'Width (ft)',
      'Thick. (in)',
      'Rebar grid? Y/N',
      'Joint spacing (ft)',
      'Area (sq ft)',
      'Concrete (CY)',
      'Perimeter (LF)',
      'Bars along L / W',
      'Rebar LF incl. laps',
      'Rebar sticks',
      'Control joints (LF)',
    ],
    {
      height: 32,
      aligns: [
        'left',
        'right',
        'right',
        'right',
        'center',
        'right',
        'right',
        'right',
        'right',
        'center',
        'right',
        'right',
        'right',
      ],
    }
  );
  const slabs = [
    ['Driveway', 44, 20, 5, 'Y', 10],
    ['Street approach (apron)', 20, 8, 6, 'Y', 10],
    ['Front walk', 28, 4, 4, 'N', 4],
  ];
  const ft = '#,##0.0;-#,##0.0;""';
  for (let i = 0; i < ROWS; i++) {
    const s = slabs[i];
    const row = first + i;
    const spanL = `(B${row}-2*${CV}/12)`;
    const spanW = `(C${row}-2*${CV}/12)`;
    // Bars that run the length are spaced across the width, and vice versa.
    const nL = `(ROUNDUP(${spanW}*12/${SP},0)+1)`;
    const nW = `(ROUNDUP(${spanL}*12/${SP},0)+1)`;
    // A run longer than one stick needs n sticks with (n − 1) laps.
    const pieces = (span) => `MAX(1,ROUNDUP((${span}-${LP}/12)/(${ST}-${LP}/12),0))`;
    const lapped = (span) => `(${span}+(${pieces(span)}-1)*${LP}/12)`;
    // Sticks come from the cut list, not LF ÷ stick length: every piece of a
    // run but the last is a full stick, and the last pieces are cut as many to
    // a stick as fit. Offcuts are not reused across directions or slabs.
    const endPiece = (span) => `(${span}-(${pieces(span)}-1)*(${ST}-${LP}/12))`;
    const sticks = (n, span) =>
      `${n}*(${pieces(span)}-1)+ROUNDUP(${n}/INT(${ST}/${endPiece(span)}+1E-9),0)`;
    const hasGrid = `AND(G${row}<>"",UPPER(E${row})="Y")`;
    X.bodyRow(ws, row, [
      { input: true, value: s?.[0] ?? null },
      { input: true, value: s?.[1] ?? null, numFmt: ft, align: 'right' },
      { input: true, value: s?.[2] ?? null, numFmt: ft, align: 'right' },
      { input: true, value: s?.[3] ?? null, numFmt: '0.0;-0.0;""', align: 'right' },
      { input: true, value: s?.[4] ?? null, align: 'center' },
      { input: true, value: s?.[5] ?? null, numFmt: ft, align: 'right' },
      { formula: `IF(OR(B${row}="",C${row}=""),"",B${row}*C${row})`, numFmt: '#,##0;-#,##0;""' },
      {
        formula: `IF(OR(G${row}="",D${row}=""),"",G${row}*D${row}/12/27)`,
        numFmt: '0.00;-0.00;""',
      },
      { formula: `IF(G${row}="","",2*(B${row}+C${row}))`, numFmt: '#,##0;-#,##0;""' },
      { formula: `IF(${hasGrid},${nL}&" / "&${nW},"")`, align: 'center' },
      {
        formula: `IF(${hasGrid},${nL}*${lapped(spanL)}+${nW}*${lapped(spanW)},"")`,
        numFmt: '#,##0;-#,##0;""',
      },
      {
        formula: `IF(${hasGrid},${sticks(nL, spanL)}+${sticks(nW, spanW)},"")`,
        numFmt: '#,##0;-#,##0;""',
      },
      {
        formula: `IF(OR(G${row}="",N(F${row})<=0),"",(ROUNDUP(B${row}/F${row},0)-1)*C${row}+(ROUNDUP(C${row}/F${row},0)-1)*B${row})`,
        numFmt: '#,##0;-#,##0;""',
      },
    ]);
  }
  X.dropdown(ws, `E${first}:E${last}`, ['Y', 'N']);
  const sum = (col, fmt) => ({ formula: `SUM(${col}${first}:${col}${last})`, numFmt: fmt });
  X.totalRow(ws, totRow, [
    { value: 'Totals' },
    {},
    {},
    {},
    {},
    {},
    sum('G', X.FMT.int),
    sum('H', '0.00'),
    sum('I', X.FMT.int),
    {},
    sum('K', X.FMT.int),
    sum('L', X.FMT.int),
    sum('M', X.FMT.int),
  ]);
  const area = `G${totRow}`;
  const cyInPlace = `H${totRow}`;
  const perim = `I${totRow}`;
  const rebarLf = `K${totRow}`;
  const rebarSticks = `L${totRow}`;
  const joints = `M${totRow}`;

  r = assumeHead;
  X.label(ws, r, 1, 'Assumptions — check the supplier, the product label and your plans');
  r++;
  const left = [
    ['Concrete waste — about 5–10% on flatwork', 0.08, X.FMT.pct],
    ['Ready-mix truck capacity, CY (ask the supplier)', 10, '0.0'],
    ['Base depth under the slab, inches', 4, '0.0'],
    ['Base — tons per compacted CY (ask the supplier)', 1.9, '0.00'],
    ['Existing slab to remove, sq ft (0 if none)', 1152, X.FMT.int],
    ['Existing slab thickness, inches', 4, '0.0'],
    ['Concrete weight, lb per cu ft (about 145)', 145, X.FMT.int],
    ['Sealer coverage, sq ft/gal per coat (product label)', 150, X.FMT.int],
  ];
  const right = [
    ['Rebar spacing, inches on center each way', 24, '0'],
    ['Bar clearance from slab edges, inches', 3, '0.0'],
    ['Stock bar length, ft', 20, '0'],
    ['Lap splice, inches (drawings or spec)', 24, '0'],
    ['Chair spacing, sq ft per chair (3 × 3 ft = 9)', 9, '0'],
    ['Form stake spacing, ft', 4, '0.0'],
    ['Isolation joint strip length, ft', 10, '0'],
    ['Sealer coats', 1, '0'],
  ];
  for (let i = 0; i < left.length; i++) {
    X.kv(ws, r, 1, left[i][0], left[i][1], { labelTo: 5, numFmt: left[i][2], align: 'right' });
    X.kv(ws, r, 7, right[i][0], right[i][1], { labelTo: 12, numFmt: right[i][2], align: 'right' });
    r++;
  }
  const waste = A(0);
  const truck = A(1);
  const baseDepth = A(2);
  const baseDensity = A(3);
  const demoArea = A(4);
  const demoThick = A(5);
  const weight = A(6);
  const coverage = A(7);
  const chair = B(4);
  const stake = B(5);
  const strip = B(6);
  const coats = B(7);
  r++;

  X.label(ws, r, 1, 'Linear measurements (ft)');
  r++;
  const lin = (lab, value) => {
    X.kv(ws, r, 1, lab, value, { labelTo: 12, numFmt: X.FMT.int, align: 'right' });
    return `M${r++}`;
  };
  const butt = lin(
    'Edges against existing concrete, the curb or the house — isolation joint, no form',
    84
  );
  lin('Saw-cut lines where removal meets concrete that stays', 60);
  r++;

  X.headerRow(
    ws,
    r,
    ['Order quantities', '', '', '', '', '', '', '', '', '', '', 'Unit', 'Quantity'],
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
        'left',
        'left',
        'left',
        'center',
        'right',
      ],
    }
  );
  r++;
  const out = (lab, unit, formula, fmt = X.FMT.int) => {
    X.text(ws, r, 1, lab, { size: 9.5, merge: 11 });
    X.text(ws, r, 12, unit, { size: 9.5, align: 'center', color: X.C.ink2 });
    X.calc(ws, r, 13, formula, { numFmt: fmt });
    return `M${r++}`;
  };
  out('Concrete in place', 'CY', cyInPlace, '0.00');
  const order = out(
    'Concrete to order — with waste, rounded up to the ¼ yard',
    'CY',
    `ROUNDUP(${cyInPlace}*(1+${waste})*4,0)/4`,
    '0.00'
  );
  const loads = out('Ready-mix loads', 'LOAD', `ROUNDUP(${order}/${truck},0)`);
  out(
    'Last load — check it against the supplier’s short-load minimum',
    'CY',
    `IF(${loads}=0,0,${order}-(${loads}-1)*${truck})`,
    '0.00'
  );
  const baseCy = out('Base stone — compacted volume', 'CY', `${area}*${baseDepth}/12/27`, '0.00');
  out('Base stone to order', 'TON', `ROUNDUP(${baseCy}*${baseDensity},0)`);
  out(
    'Demo debris — size the trucks or roll-off',
    'TON',
    `ROUND(${demoArea}*${demoThick}/12*${weight}/2000,1)`,
    '0.0'
  );
  out('Rebar, including laps', 'LF', rebarLf);
  out('Rebar sticks at the stock length — from the cut list', 'PC', rebarSticks);
  out(
    'Rebar chairs (slabs marked Y)',
    'EA',
    `ROUNDUP(SUMIF(E${first}:E${last},"Y",G${first}:G${last})/${chair},0)`
  );
  const forms = out(
    'Edge forms — perimeter less edges against existing',
    'LF',
    `MAX(0,${perim}-${butt})`
  );
  out('Form stakes', 'EA', `ROUNDUP(${forms}/${stake},0)`);
  out('Isolation joint strips', 'PC', `ROUNDUP(${butt}/${strip},0)`);
  out('Control joints', 'LF', joints);
  out('Sealer', 'GAL', `ROUNDUP(${area}*${coats}/${coverage},0)`);
  r++;
  X.noteRow(
    ws,
    r,
    'CY = length × width × (thickness in inches ÷ 12) ÷ 27. Bars each way = ROUNDUP(clear span ÷ spacing) + 1, plus a lap at every splice. Sticks count each run’s full sticks plus its end pieces, cut as many to a stick as fit — more than LF ÷ stick length, because a 19½ ft bar takes a whole 20 ft stick. Joint spacing in feet of 2–3 × the slab thickness in inches is a common rule of thumb for plain flatwork, not a code value; keep panels close to square.',
    13,
    { height: 56 }
  );
  r += 2;
  X.noteRow(
    ws,
    r,
    'Pro tip: check the grade before you trust the depth. A slab that runs ½" thick over 1,000 sq ft uses about 1.5 CY more than you priced. Footings, walls, structural slabs and anything load-bearing follow the engineer’s drawings and local code.',
    13,
    { height: 32 }
  );
  r += 2;
  X.brandFooter(
    ws,
    r,
    13,
    'Free template by BuildWorkPro — buildworkpro.com/templates. Quantities are estimates; confirm mix, reinforcement and joint layout with your plans, supplier and local code.'
  );
  return ws;
}

export const { html, docx, xlsx } = tradeEstimate({
  meta,
  trade: 'Concrete',
  specs: [
    { key: 'area', label: 'Slab area' },
    { key: 'thickness', label: 'Thickness', flex: 1.4 },
    { key: 'mix', label: 'Mix', flex: 1.2 },
    { key: 'reinforcement', label: 'Reinforcement', flex: 1.1 },
    { key: 'finish', label: 'Finish' },
  ],
  sections: [
    { title: 'Demo & site prep', hint: 'saw-cut, remove, haul, grade, base', blank: 3 },
    {
      title: 'Forming & reinforcement',
      hint: 'forms, rebar or mesh, isolation joints',
      blank: 3,
    },
    {
      title: 'Pour, finish & cure',
      hint: 'concrete, place and finish, joints, sealer, permit',
      blank: 4,
    },
  ],
  descriptionHint: 'what you will remove and pour, and what "done" looks like',
  termsHint: 'deposit, payment, subgrade allowance, exclusions, warranty',
  termsExample:
    'Example: 30% deposit on acceptance; balance at completion. Subgrade repair beyond the allowance billed per ton with photos. Excludes irrigation and landscape repair. 2-year workmanship warranty; hairline shrinkage cracks are not covered.',
  fine: FINE,
  xlsxSubtitle:
    'Customer-facing estimate by phase — demo and base, forming and rebar, pour and finish — with tax, deposit and balance computed. Print fits one page.',
  sample: SAMPLE,
  takeoff,
  pricing: {
    laborRate: 52,
    overhead: 0.12,
    margin: 0.15,
    rows: [
      { item: 'Break out and haul 4" concrete', unit: 'SF', mat: 0, hrs: 0.03, other: 0.85 },
      { item: 'Excavate, fine grade, compact subgrade', unit: 'SF', mat: 0, hrs: 0.01, other: 0.2 },
      {
        item: 'Crushed-limestone base, placed and compacted',
        unit: 'TON',
        mat: 30,
        hrs: 0.2,
        other: 3,
      },
      { item: 'Edge forms, set and strip', unit: 'LF', mat: 0.6, hrs: 0.03, other: 0.5 },
      { item: '#4 rebar grid, tied on chairs', unit: 'LF', mat: 0.8, hrs: 0.01, other: 0.12 },
      { item: 'Ready-mix, 4,000 PSI air-entrained', unit: 'CY', mat: 178, hrs: 0, other: 8 },
      {
        item: 'Place and broom finish, incl. curing compound',
        unit: 'SF',
        mat: 0.08,
        hrs: 0.04,
        other: 0.3,
      },
      { item: 'Saw-cut or tooled control joints', unit: 'LF', mat: 0, hrs: 0.02, other: 0.18 },
    ],
    note: 'Labor hours per unit come from your own crews: divide the crew hours on your last few pours by the square feet placed and finished. Material is delivered cost, including the supplier’s fuel and environmental fees on ready-mix; "other" covers equipment, saw blades, stakes and consumables per unit.',
  },
  howTo: {
    steps: [
      'Measure the job on the Slab Takeoff sheet: one row per slab with length, width, thickness, rebar Y/N and joint spacing, then the edges against existing concrete. Cubic yards to order, base tons, rebar, forms, joints and sealer compute.',
      'Build your selling prices on the Unit Prices sheet: material, labor hours and other cost per unit, your loaded labor rate, overhead, and profit as a margin on price.',
      'On the Estimate sheet, fill in your company, the customer and the job specs (area, thickness, mix, reinforcement, finish), and describe the scope in two or three sentences.',
      'Enter the line items under each phase with quantity, unit and unit price. Mark taxable lines Y and enter your rate, or leave tax at 0% if it is already in your prices. Set the deposit.',
      'List optional items the customer can add (a parking pad, a public-walk section) — they are not in the total — then write your terms, including the subgrade allowance and warranty.',
      'Print or save as PDF, walk the customer through it, and collect the signature and deposit before you book the pour. Call 811 for a utility locate before you dig.',
    ],
    tips: [
      'Carry a subgrade allowance with a per-ton price. Soft spots show up only after the old slab comes out, and a written allowance settles them before the trucks are booked.',
      'Show cubic yards in place and cubic yards ordered. Concrete you order is concrete you pay for, and the customer can see why the two numbers differ.',
      'Check the grade before you trust the depth. Half an inch of extra thickness over 1,000 sq ft is about 1.5 CY you did not price.',
      'Price the city approach separately. Right-of-way work usually needs its own permit and inspection, and the city’s standard can call for a thicker slab than the driveway.',
    ],
    feature: {
      text: 'In BuildWorkPro every estimate is a bid built from line items priced from your product catalog, with margin and overhead applied as rates. It goes out as a branded PDF for e-signature and converts into a project when the customer accepts.',
      url: 'https://buildworkpro.com/features/construction-bidding/',
    },
  },
});
