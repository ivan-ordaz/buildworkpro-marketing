// Plumbing estimate — the customer-facing estimate for residential remodel and
// replacement work, grouped the way a plumber prices the job (rough-in, fixtures
// and trim, water heater and permits), plus a plumbing takeoff sheet that turns
// fixture counts into rough and trim hours and pipe runs into footage, coils and
// sticks. Rendered by the trade-estimate kit.
import * as X from '../kit/xlsx.mjs';
import { tradeEstimate } from '../kit/trade-estimate.mjs';

export const meta = {
  slug: 'plumbing-estimate',
  name: 'Plumbing Estimate Template',
  basename: 'plumbing-estimate-template',
  docName: 'Plumbing estimate',
};

// A primary-bath remodel in a 1968 house outside Columbus, OH: five fixtures
// roughed in new in PEX and PVC, tied into the existing cast-iron stack, then
// trimmed after tile, plus a like-for-like gas water heater replacement. The
// five fixture counts match the Plumbing Takeoff sheet; per-fixture prices come
// from the Unit Prices sheet (labor hours = the takeoff's labor units).
const SAMPLE = {
  company: {
    name: 'Alder & Stone Plumbing',
    line1: '2280 Alum Creek Dr, Columbus, OH 43207',
    line2: '(614) 555-0148 · estimates@alderstoneplumbing.com · Lic. PL-48217',
  },
  customer: {
    name: 'Tom & Alicia Brennan',
    line1: '418 Birchwood Ln, Westerville, OH 43081',
    line2: '(614) 555-0193',
  },
  job: {
    name: 'Brennan residence — primary bath',
    line1: '418 Birchwood Ln, Westerville, OH 43081',
    line2: '1968 two-story · water heater in basement',
  },
  number: 'EST-2026-0412',
  date: 'September 25, 2026',
  valid: 'October 25, 2026',
  start: 'Rough-in week of Oct 19',
  preparedBy: 'Ben Alder, Owner',
  specs: {
    fixtures: '5 fixtures + water heater',
    supply: 'PEX-A, 3/4" and 1/2"',
    drain: 'PVC DWV to cast-iron stack',
    heater: '50-gal gas, atmospheric',
    permit: 'Included · rough + final',
  },
  description:
    'Rough in and trim the new primary bath (toilet, double vanity, walk-in shower, freestanding tub) and replace the gas water heater.',
  sections: [
    {
      items: [
        {
          desc: 'Disconnect and cap fixtures; remove galvanized supply and old drains',
          qty: 1,
          unit: 'LS',
          price: 450,
        },
        {
          desc: 'Rough-in, water closet — relocated 3" drain, vent, flange, cold supply',
          qty: 1,
          unit: 'EA',
          price: 750,
        },
        {
          desc: 'Rough-in, lavatories — 1-1/2" drains and vents, hot and cold stub-outs',
          qty: 2,
          unit: 'EA',
          price: 605,
        },
        {
          desc: 'Rough-in, walk-in shower — pressure-balance valve body, 2" drain, vent',
          qty: 1,
          unit: 'EA',
          price: 1120,
        },
        {
          desc: 'Rough-in, freestanding tub — floor-mount filler valve, drain, vent',
          qty: 1,
          unit: 'EA',
          price: 1420,
        },
      ],
    },
    {
      items: [
        {
          desc: 'Fixture and faucet allowance — toilet, 2 lav faucets, shower trim, tub filler',
          qty: 1,
          unit: 'AL',
          price: 2400,
        },
        {
          desc: 'Set water closet — seal, bolts, quarter-turn stop, braided supply',
          qty: 1,
          unit: 'EA',
          price: 235,
        },
        {
          desc: 'Trim lavatories — faucets, drains, P-traps, stops and supplies',
          qty: 2,
          unit: 'EA',
          price: 280,
        },
        {
          desc: 'Trim shower — valve trim, arm and head; flush and leak-check',
          qty: 1,
          unit: 'EA',
          price: 130,
        },
        {
          desc: 'Set owner-supplied freestanding tub, connect drain, install filler trim',
          qty: 1,
          unit: 'EA',
          price: 325,
        },
      ],
    },
    {
      items: [
        {
          desc: 'Replace 50-gal gas water heater, atmospheric vent — like for like',
          sub: 'Haul-away, gas connector, sediment trap, T&P discharge line and pan',
          qty: 1,
          unit: 'EA',
          price: 2225,
        },
        {
          desc: 'Thermal expansion tank on the cold inlet, charged to house pressure',
          qty: 1,
          unit: 'EA',
          price: 195,
        },
        {
          desc: 'Supply and DWV tests, rough and final inspections, permits at cost',
          qty: 1,
          unit: 'LS',
          price: 545,
        },
      ],
    },
  ],
  options: [
    {
      n: 'A',
      desc: 'Hot-water recirculation pump at the heater with a thermostatic crossover valve at the vanity',
      amount: 685,
    },
    {
      n: 'B',
      desc: 'Replace the remaining galvanized supply to the kitchen, laundry and hall bath with PEX-A',
      amount: 3280,
    },
  ],
  taxRate: 0,
  taxBasis: 'materials',
  taxLabel: 'Sales tax — included in prices',
  depositPct: 30,
  terms:
    'Deposit 30% on acceptance; balance at completion after final inspection. Fixture allowance $2,400: selections over or under it adjust the total at our cost. Owner supplies the tub, vanity and tops. Excludes finish demo, framing, drywall, tile and patching, and vent or gas-line changes beyond the heater hookup. Workmanship warranty 1 year; manufacturer warranties pass through.',
  sig: {
    customer: 'Alicia Brennan',
    customerDate: '09/28/2026',
    contractor: 'Ben Alder, Owner',
    contractorDate: '09/25/2026',
  },
};

const FINE =
  'Based on a walkthrough before demolition. Hidden conditions and owner changes are priced by written change order first. Work is permitted and inspected under the local plumbing code. Not legal advice.';

const HRS = '0.0;-0.0;""';
const HRS2 = '0.00;-0.00;""';
const LF = '#,##0;-#,##0;""';

/**
 * Plumbing takeoff: fixture schedule (count × labor units → rough and trim
 * hours), other labor (demo, heater, tests, inspections), then pipe runs by
 * size → footage → coils or sticks and material cost, plus a fittings
 * allowance as a % of pipe material.
 */
function takeoff(wb) {
  const ws = X.sheet(wb, 'Plumbing Takeoff', { fitHeight: 1 });
  X.widths(ws, [34, 8, 10, 10, 10, 10, 10, 12]);
  let r = X.titleBlock(ws, {
    title: 'Plumbing Takeoff',
    subtitle:
      'Fixture count × your labor units = rough and trim hours. Pipe runs × average length = footage, then coils or sticks to order.',
    cols: 8,
  });
  X.inputLegend(ws, r, 1);
  r += 2;

  // ---- Fixture schedule ----
  X.label(
    ws,
    r,
    1,
    'Fixture schedule — hours include each fixture’s drain, vent and supply piping. Starting points: replace with your crews’ hours'
  );
  r++;
  X.headerRow(
    ws,
    r,
    [
      'Fixture',
      'Count',
      'Supply outlets each',
      'Rough hrs each',
      'Trim hrs each',
      'Rough hrs',
      'Trim hrs',
      'Total hrs',
    ],
    { aligns: ['left', 'right', 'right', 'right', 'right', 'right', 'right', 'right'] }
  );
  r++;
  const fixtures = [
    ['Water closet', 1, 1, 4, 1.5],
    ['Lavatory', 2, 2, 3, 1.5],
    ['Shower — valve and drain', 1, 2, 5, 1],
    ['Tub/shower — valve and drain', null, 2, 4.5, 1.5],
    ['Freestanding tub — floor-mount filler', 1, 2, 6, 2.5],
    ['Kitchen sink', null, 2, 3, 2],
    ['Dishwasher', null, 1, 1, 1],
    ['Clothes washer box', null, 2, 2.5, 0.5],
    ['Ice maker box', null, 1, 1.5, 0.5],
    ['Hose bibb', null, 1, 2, 0.5],
  ];
  const fixFirst = r;
  for (let i = 0; i < 12; i++) {
    const f = fixtures[i];
    X.bodyRow(ws, r, [
      { input: true, value: f?.[0] ?? null },
      { input: true, value: f?.[1] ?? null, numFmt: '0;-0;""', align: 'right' },
      { input: true, value: f?.[2] ?? null, numFmt: '0;-0;""', align: 'right' },
      { input: true, value: f?.[3] ?? null, numFmt: HRS, align: 'right' },
      { input: true, value: f?.[4] ?? null, numFmt: HRS, align: 'right' },
      { formula: `IF(A${r}="","",N(B${r})*N(D${r}))`, numFmt: HRS },
      { formula: `IF(A${r}="","",N(B${r})*N(E${r}))`, numFmt: HRS },
      { formula: `IF(A${r}="","",N(F${r})+N(G${r}))`, numFmt: HRS },
    ]);
    r++;
  }
  const fixLast = r - 1;
  X.totalRow(ws, r, [
    { value: 'Fixtures · supply outlets · hours' },
    { formula: `SUM(B${fixFirst}:B${fixLast})`, numFmt: '0' },
    { formula: `SUMPRODUCT(B${fixFirst}:B${fixLast},C${fixFirst}:C${fixLast})`, numFmt: '0' },
    {},
    {},
    { formula: `SUM(F${fixFirst}:F${fixLast})`, numFmt: '0.0' },
    { formula: `SUM(G${fixFirst}:G${fixLast})`, numFmt: '0.0' },
    { formula: `SUM(H${fixFirst}:H${fixLast})`, numFmt: '0.0' },
  ]);
  const fixTotal = r;
  r += 2;

  // ---- Other labor: demo, water heater, tests and inspections ----
  X.headerRow(
    ws,
    r,
    ['Other labor — demo, heater, tests', '', '', '', '', 'Qty', 'Hrs each', 'Hours'],
    {
      aligns: ['left', 'left', 'left', 'left', 'left', 'right', 'right', 'right'],
    }
  );
  r++;
  const other = [
    ['Demo — disconnect and cap fixtures, remove old piping', 1, 4],
    ['Water heater — drain, remove, set, connect, start up', 1, 5],
    ['Thermal expansion tank', 1, 0.75],
    ['Supply pressure test (air or water)', 1, 1],
    ['DWV test', 1, 1],
    ['Inspection trips — rough and final', 2, 0.75],
  ];
  const otherFirst = r;
  for (let i = 0; i < 7; i++) {
    const o = other[i];
    X.bodyRow(ws, r, [
      { input: true, value: o?.[0] ?? null },
      {},
      {},
      {},
      {},
      { input: true, value: o?.[1] ?? null, numFmt: '0;-0;""', align: 'right' },
      { input: true, value: o?.[2] ?? null, numFmt: HRS2, align: 'right' },
      { formula: `IF(OR(F${r}="",G${r}=""),"",F${r}*G${r})`, numFmt: HRS2 },
    ]);
    ws.mergeCells(r, 1, r, 5);
    r++;
  }
  const otherLast = r - 1;
  X.totalRow(ws, r, [
    { value: 'Other labor hours' },
    {},
    {},
    {},
    {},
    {},
    {},
    { formula: `SUM(H${otherFirst}:H${otherLast})`, numFmt: '0.00' },
  ]);
  const otherTotal = r;
  r += 2;

  // ---- Labor summary ----
  X.label(ws, r, 1, 'Labor summary');
  r++;
  const sumLine = (lab, formula, fmt, opts = {}) => {
    X.text(ws, r, 1, lab, { size: 9.5, color: X.C.ink2, merge: 7, bold: opts.bold });
    X.calc(ws, r, 8, formula, { numFmt: fmt, bold: opts.bold });
    return `H${r++}`;
  };
  const rough = sumLine('Rough-in hours (fixture schedule)', `F${fixTotal}`, '0.00');
  const trim = sumLine('Trim hours (fixture schedule)', `G${fixTotal}`, '0.00');
  const oth = sumLine('Other labor hours', `H${otherTotal}`, '0.00');
  const hours = sumLine('Total labor hours', `${rough}+${trim}+${oth}`, '0.00', { bold: true });
  X.kv(ws, r, 1, 'Crew size (people on the job)', 2, { labelTo: 7, numFmt: '0', align: 'right' });
  const crew = `H${r++}`;
  X.kv(ws, r, 1, 'Hours per crew day', 8, { labelTo: 7, numFmt: '0.0', align: 'right' });
  const day = `H${r++}`;
  sumLine(
    'Crew days on site (rough-in and trim are separate visits)',
    `IF(N(${crew})*N(${day})=0,"",${hours}/(${crew}*${day}))`,
    '0.0'
  );
  r++;

  // ---- Pipe assumptions ----
  X.label(ws, r, 1, 'Pipe assumptions — check the product and your supplier');
  r++;
  X.kv(ws, r, 1, 'Waste on pipe — cut-offs and offsets', 0.1, {
    labelTo: 7,
    numFmt: X.FMT.pct,
    align: 'right',
  });
  const waste = `$H$${r++}`;
  X.kv(
    ws,
    r,
    1,
    'Fittings, supports and cement — % of pipe material (track it on your own jobs)',
    0.6,
    { labelTo: 7, numFmt: X.FMT.pct, align: 'right' }
  );
  const fitPct = `$H$${r++}`;
  r++;

  /** One pipe table: runs × average length → LF → coils or sticks → material $. */
  const pipeTable = (title, pkgLabel, priceLabel, rows, blanks, totalLabel) => {
    X.headerRow(
      ws,
      r,
      [
        title,
        'Runs',
        'Avg length (ft)',
        'Footage (LF)',
        pkgLabel,
        'Order qty with waste',
        priceLabel,
        'Material $',
      ],
      { aligns: ['left', 'right', 'right', 'right', 'right', 'right', 'right', 'right'] }
    );
    r++;
    const first = r;
    for (let i = 0; i < rows.length + blanks; i++) {
      const p = rows[i];
      const runs =
        p && typeof p[1] === 'string'
          ? { formula: p[1], numFmt: '0' }
          : { input: true, value: p?.[1] ?? null, numFmt: '0;-0;""', align: 'right' };
      X.bodyRow(ws, r, [
        { input: true, value: p?.[0] ?? null },
        runs,
        { input: true, value: p?.[2] ?? null, numFmt: '0;-0;""', align: 'right' },
        { formula: `IF(OR(B${r}="",C${r}=""),"",B${r}*C${r})`, numFmt: LF },
        { input: true, value: p?.[3] ?? null, numFmt: '0;-0;""', align: 'right' },
        {
          formula: `IF(OR(D${r}="",E${r}=""),"",ROUNDUP(D${r}*(1+${waste})/E${r},0))`,
          numFmt: '0;-0;""',
        },
        { input: true, value: p?.[4] ?? null, numFmt: X.FMT.moneyBlank },
        { formula: `IF(OR(F${r}="",G${r}=""),"",F${r}*G${r})`, numFmt: X.FMT.moneyBlank },
      ]);
      r++;
    }
    const last = r - 1;
    X.totalRow(ws, r, [
      { value: totalLabel },
      {},
      {},
      { formula: `SUM(D${first}:D${last})`, numFmt: X.FMT.int },
      {},
      {},
      {},
      { formula: `SUM(H${first}:H${last})`, numFmt: X.FMT.money },
    ]);
    return `H${r++}`;
  };

  const supply = pipeTable(
    'Supply pipe — size and use',
    'Coil or stick (ft)',
    '$ per coil or stick',
    [
      ['PEX 1/2" — branches (runs = outlets)', `C${fixTotal}`, 12, 100, 68],
      ['PEX 3/4" — hot and cold mains to the bath', 2, 34, 100, 135],
    ],
    2,
    'Supply footage and material'
  );
  r++;
  const dwv = pipeTable(
    'DWV pipe — size and use',
    'Stick (ft)',
    '$ per stick',
    [
      ['PVC 3" DWV — toilet drain to the stack', 1, 12, 10, 38],
      ['PVC 2" DWV — shower drain and branch', 2, 10, 10, 22],
      ['PVC 1-1/2" DWV — lav and tub drains, vents', 6, 9, 10, 16],
    ],
    1,
    'DWV footage and material'
  );
  r++;

  // ---- Material summary ----
  X.label(ws, r, 1, 'Pipe and fittings material');
  r++;
  const pipe = sumLine('Pipe material — supply + DWV', `${supply}+${dwv}`, X.FMT.money);
  const fittings = sumLine(
    'Fittings, supports and cement allowance',
    `ROUND(${pipe}*${fitPct},2)`,
    X.FMT.money
  );
  X.totalRow(ws, r, [
    { value: 'Pipe and fittings material — before valves, fixtures and the heater' },
    {},
    {},
    {},
    {},
    {},
    {},
    { formula: `${pipe}+${fittings}`, numFmt: X.FMT.money },
  ]);
  r += 2;
  X.noteRow(
    ws,
    r,
    'Hours = fixture count × your rough and trim hours per fixture. Coils or sticks = ROUNDUP(runs × average length × (1 + waste) ÷ coil or stick length). Pipe sizes shown are the example’s; size drains, vents and supply to the plumbing code adopted where the job is. Log actual rough and trim hours per fixture on every job, and your labor units get better each time.',
    8,
    { height: 58 }
  );
  r += 2;
  X.brandFooter(
    ws,
    r,
    8,
    'Free template by BuildWorkPro — buildworkpro.com/templates. Quantities are estimates; confirm coil and stick lengths with your supplier and sizing with your local code.'
  );
  return ws;
}

export const { html, docx, xlsx } = tradeEstimate({
  meta,
  trade: 'Plumbing',
  specs: [
    { key: 'fixtures', label: 'Fixtures', flex: 1.2 },
    { key: 'supply', label: 'Supply pipe' },
    { key: 'drain', label: 'Drain & vent', flex: 1.3 },
    { key: 'heater', label: 'Water heater', flex: 1.2 },
    { key: 'permit', label: 'Permit', flex: 1.2 },
  ],
  sections: [
    {
      title: 'Rough-in (supply & DWV)',
      hint: 'demo, drains, vents, supply, valve bodies',
      blank: 4,
    },
    { title: 'Fixtures & trim', hint: 'fixture allowance, set and trim each fixture', blank: 3 },
    {
      title: 'Water heater, testing & permits',
      hint: 'heater, expansion tank, tests, inspections, permit',
      blank: 3,
    },
  ],
  descriptionHint:
    'fixtures and systems you will rough in, trim or replace, and what "done" looks like',
  termsHint: 'deposit, payment, fixture allowance, exclusions, warranty',
  termsExample:
    'Example: 30% deposit on acceptance; balance at completion after final inspection. Fixture allowance adjusts to the owner’s selections at cost. Excludes drywall, tile and patching. 1-year workmanship warranty; manufacturer warranties pass through.',
  fine: FINE,
  xlsxSubtitle:
    'Customer-facing estimate by phase — rough-in, fixtures and trim, water heater and permits — with tax, deposit and balance computed. Print fits one page.',
  sample: SAMPLE,
  takeoff,
  pricing: {
    laborRate: 64,
    overhead: 0.3,
    margin: 0.2,
    rows: [
      {
        item: 'Rough-in, water closet — drain, vent, flange, supply',
        unit: 'EA',
        mat: 195,
        hrs: 4,
        other: 10,
      },
      {
        item: 'Rough-in, lavatory — drain, vent, stub-outs',
        unit: 'EA',
        mat: 175,
        hrs: 3,
        other: 5,
      },
      {
        item: 'Rough-in, shower — valve body, drain, vent',
        unit: 'EA',
        mat: 360,
        hrs: 5,
        other: 10,
      },
      {
        item: 'Rough-in, freestanding tub — floor-mount filler, drain',
        unit: 'EA',
        mat: 480,
        hrs: 6,
        other: 10,
      },
      { item: 'Set water closet', unit: 'EA', mat: 43, hrs: 1.5, other: 5 },
      {
        item: 'Trim lavatory — faucet, drain, trap, stops',
        unit: 'EA',
        mat: 71,
        hrs: 1.5,
        other: 5,
      },
      { item: 'Water heater, 50-gal gas — replace', unit: 'EA', mat: 1020, hrs: 5, other: 25 },
      { item: 'Thermal expansion tank', unit: 'EA', mat: 70, hrs: 0.75, other: 0 },
    ],
    note: 'Labor hours per fixture come from your own jobs: divide the rough and trim hours a crew logged by the fixtures it set, and keep them equal to the labor units on the Plumbing Takeoff. Material is delivered cost, including the fixture’s share of pipe and fittings from the takeoff; "other" covers consumables and disposal.',
  },
  howTo: {
    steps: [
      'Count fixtures on the Plumbing Takeoff sheet and set your own rough and trim hours per fixture. Add demo, water heater, test and inspection hours, then enter pipe runs and average lengths by size. Labor hours, footage, coils and sticks compute.',
      'Build your selling prices on the Unit Prices sheet: material, labor hours and other cost per fixture or unit, your loaded labor rate, overhead, and profit as a margin on price.',
      'On the Estimate sheet, fill in your company, the customer and the job specs (fixtures, supply and drain material, water heater, permit), and describe the scope in two or three sentences.',
      'Enter the line items under each phase with quantity, unit and unit price. Mark taxable lines Y and enter your rate, or leave tax at 0% if it is already in your prices. Set the deposit.',
      'List optional items the customer can add (a recirculation pump, a repipe) — they are not in the total — then write your terms, including the fixture allowance, exclusions and warranty.',
      'Print or save as PDF, walk the customer through it, and get the acceptance signature and deposit before you order valves, fixtures or the water heater.',
    ],
    tips: [
      'Get fixture selections before rough-in. Shower valves and tub fillers are brand-specific, so the valve body you rough in has to match the trim the owner buys.',
      'Carry a written fixture allowance that adjusts at cost. Owners change faucets; an allowance turns that into arithmetic instead of an argument.',
      'Price rough-in and trim as separate visits. On a remodel they are weeks apart with drywall and tile in between, and each one costs a truck and a trip.',
      'Write down what you tie into. Old cast iron and galvanized behind the wall are where remodel estimates go wrong, so exclude or price the unknowns.',
    ],
    feature: {
      text: 'In BuildWorkPro every estimate is a bid built from line items priced from your product catalog, with margin and overhead applied as rates. It goes out as a branded PDF for e-signature and converts into a project when the customer accepts.',
      url: 'https://buildworkpro.com/features/construction-bidding/',
    },
  },
});
