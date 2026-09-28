// Electrical estimate — the customer-facing estimate an electrical contractor
// hands a homeowner or GC, grouped the way electricians price the job (service
// and distribution, branch circuits and devices, lighting / testing / permits),
// plus a device takeoff sheet that turns opening counts into labor hours,
// boxes, breakers and cable by type. Rendered by the trade-estimate kit.
import * as X from '../kit/xlsx.mjs';
import { tradeEstimate } from '../kit/trade-estimate.mjs';

export const meta = {
  slug: 'electrical-estimate',
  name: 'Electrical Estimate Template',
  basename: 'electrical-estimate-template',
  docName: 'Electrical estimate',
};

// A 100A-to-200A overhead service upgrade plus the electrical for a 1,050 sq ft
// basement finish in Columbus, OH. Device and circuit counts match the Device
// Takeoff sheet (74 openings, 12 circuits); branch unit prices come from the
// Unit Prices sheet. Tax is paid on materials and carried in the prices.
const SAMPLE = {
  company: {
    name: 'Tallwood Electric Co.',
    line1: '2475 Westbelt Dr, Columbus, OH 43228',
    line2: '(614) 555-0148 · estimates@tallwoodelectric.com · Lic. EL-48213',
  },
  customer: {
    name: 'Marcus & Jenna Lindqvist',
    line1: '6182 Brookhaven Dr, Columbus, OH 43229',
    line2: '(614) 555-0173',
  },
  job: {
    name: 'Lindqvist residence — basement finish',
    line1: '6182 Brookhaven Dr, Columbus, OH 43229',
    line2: '1958 ranch · 100A overhead service',
  },
  number: 'EST-2026-0214',
  date: 'September 24, 2026',
  valid: 'October 24, 2026',
  start: 'Week of October 12',
  preparedBy: 'Ray Castillo, Owner',
  specs: {
    service: '100A to 200A, overhead',
    scope: 'Service + basement finish',
    area: '1,050 sq ft basement',
    circuits: '12 circuits · 74 openings',
    permit: 'City of Columbus',
  },
  description:
    'Upgrade the overhead service from 100A to 200A with a new panel and grounding, then wire the basement finish: 12 new circuits, lights, bath fan and alarms.',
  sections: [
    {
      items: [
        {
          desc: '200A overhead service: new mast, weatherhead, meter base, entrance conductors',
          qty: 1,
          unit: 'LS',
          price: 2150,
        },
        {
          desc: '200A main-breaker panel, 40-space; remove old panel, re-terminate 18 circuits',
          qty: 1,
          unit: 'LS',
          price: 2380,
        },
        {
          desc: 'Grounding and bonding: two ground rods, water and gas piping bonds',
          qty: 1,
          unit: 'LS',
          price: 395,
        },
        {
          desc: 'Corrections to existing wiring found at changeover — allowance',
          sub: 'Billed at actual hours with photos; unused hours credited',
          qty: 4,
          unit: 'HR',
          price: 115,
        },
      ],
    },
    {
      items: [
        {
          desc: 'New branch circuits: breaker (AFCI/GFCI as required) and home run to panel',
          qty: 12,
          unit: 'EA',
          price: 250,
        },
        {
          desc: 'Receptacle openings: tamper-resistant duplex, incl. box, cable and trim',
          qty: 22,
          unit: 'EA',
          price: 98,
        },
        {
          desc: 'GFCI receptacle openings — bathroom, wet bar, storage room',
          qty: 4,
          unit: 'EA',
          price: 140,
        },
        { desc: 'Switch openings: single-pole, 3-way and dimmer', qty: 15, unit: 'EA', price: 85 },
      ],
    },
    {
      items: [
        {
          desc: '6" LED recessed wafer lights, contractor-supplied, incl. cable',
          qty: 24,
          unit: 'EA',
          price: 86,
        },
        {
          desc: 'Hang owner-supplied fixtures: vanity, three bar pendants, storage light',
          qty: 5,
          unit: 'EA',
          price: 102,
        },
        { desc: 'Bath exhaust fan, ducted to exterior', qty: 1, unit: 'EA', price: 465 },
        {
          desc: 'Hardwired smoke/CO combination alarms, interconnected',
          qty: 3,
          unit: 'EA',
          price: 130,
        },
        {
          desc: 'Permit, rough-in and final inspections — City of Columbus; test and label panel',
          qty: 1,
          unit: 'LS',
          price: 385,
        },
      ],
    },
  ],
  options: [
    {
      n: 'A',
      desc: 'Low-voltage: four Cat6 data and two coax drops home-run to a media panel',
      amount: 1180,
    },
    {
      n: 'B',
      desc: '50A 240V circuit and NEMA 14-50 receptacle in the garage for an EV charger (after load calculation)',
      amount: 1240,
    },
  ],
  taxRate: 0,
  taxBasis: 'materials',
  taxLabel: 'Sales tax — included in prices',
  depositPct: 30,
  terms:
    'Deposit 30% on acceptance to order the panel and service equipment; balance due when the final inspection passes. Existing-wiring corrections beyond the 4-hour allowance billed at $115/hr with photos. Owner supplies decorative fixtures. Excludes framing, drywall, patching, painting and utility-side work or fees. Workmanship warranty 2 years; manufacturer warranties pass through.',
  sig: {
    customer: 'Jenna Lindqvist',
    customerDate: '09/26/2026',
    contractor: 'Ray Castillo, Owner',
    contractorDate: '09/24/2026',
  },
};

const FINE =
  'Based on the finish plan and a service walk-through. Licensed work under permit, to the code your AHJ enforces. Hidden conditions and changes are priced by written change order first. Not legal advice.';

/**
 * Device takeoff: opening counts × labor units → labor hours and boxes; circuits
 * × home-run length plus cable between openings → cable feet and coils by type.
 */
function takeoff(wb) {
  const ws = X.sheet(wb, 'Device Takeoff', { fitHeight: 1 });
  X.widths(ws, [36, 11, 11, 11, 11, 11, 11]);
  let r = X.titleBlock(ws, {
    title: 'Device Takeoff',
    subtitle:
      'Count openings from the plan, apply your own labor units, then run circuits × home-run length to get cable by type.',
    cols: 7,
  });
  X.inputLegend(ws, r, 1);
  r += 2;

  // ---- Openings × labor units ----
  X.label(ws, r, 1, 'Devices & openings — labor units are examples; use your own crews’ hours');
  r++;
  // Device name spans A:B so the table runs the full sheet width.
  X.headerRow(
    ws,
    r,
    ['Device / opening', '', 'Count', 'Labor hrs each', 'Labor hours', 'Boxes each', 'Boxes'],
    { aligns: ['left', 'left', 'right', 'right', 'right', 'right', 'right'] }
  );
  ws.mergeCells(r, 1, r, 2);
  r++;
  const devices = [
    ['Receptacles — tamper-resistant duplex', 22, 0.7, 1],
    ['GFCI receptacles', 4, 0.85, 1],
    ['Switches — single-pole, 3-way, dimmer', 15, 0.6, 1],
    ['Recessed LED wafer lights (no box needed)', 24, 0.5, 0],
    ['Fixtures — hang owner-supplied', 5, 0.9, 1],
    ['Bath exhaust fan, ducted', 1, 2.5, 0],
    ['Smoke/CO alarms, hardwired, interconnected', 3, 0.6, 1],
  ];
  const devFirst = r;
  for (let i = 0; i < 10; i++) {
    const d = devices[i];
    X.bodyRow(ws, r, [
      { input: true, value: d?.[0] ?? null },
      { input: true },
      { input: true, value: d?.[1] ?? null, numFmt: '#,##0;-#,##0;""', align: 'right' },
      { input: true, value: d?.[2] ?? null, numFmt: '0.00;-0.00;""', align: 'right' },
      { formula: `IF(C${r}="","",C${r}*N(D${r}))`, numFmt: '#,##0.0;-#,##0.0;""' },
      { input: true, value: d?.[3] ?? null, numFmt: '0;-0;""', align: 'right' },
      { formula: `IF(C${r}="","",C${r}*N(F${r}))`, numFmt: '#,##0;-#,##0;""' },
    ]);
    ws.mergeCells(r, 1, r, 2);
    r++;
  }
  const devLast = r - 1;
  X.totalRow(ws, r, [
    { value: 'Openings' },
    {},
    { formula: `SUM(C${devFirst}:C${devLast})`, numFmt: X.FMT.int },
    {},
    { formula: `SUM(E${devFirst}:E${devLast})`, numFmt: '#,##0.0' },
    {},
    { formula: `SUM(G${devFirst}:G${devLast})`, numFmt: X.FMT.int },
  ]);
  const devTot = r;
  r += 2;

  // ---- Assumptions ----
  X.label(ws, r, 1, 'Assumptions — check your supplier and your own job records');
  r++;
  const assume = (lab, value, fmt) => {
    X.kv(ws, r, 1, lab, value, { labelTo: 6, numFmt: fmt, align: 'right' });
    return `$G$${r++}`;
  };
  const makeup = assume(
    'Cable makeup & waste — loops at boxes, drops, panel makeup',
    0.1,
    X.FMT.pct
  );
  const coil = assume('NM-B coil length (ft) — check your supplier', 250, X.FMT.int);
  const hrsPerRun = assume(
    'Labor hrs per home run — set breaker, pull, terminate (your crews)',
    1.2,
    '0.00'
  );
  const serviceHrs = assume(
    'Service & panel changeover labor hrs — from your own history',
    22,
    '0.0'
  );
  const crew = assume('Crew size (people)', 2, '0');
  const dayHrs = assume('Productive hours per person per day', 7, '0.0');
  r++;

  // ---- Circuits × home runs → cable ----
  X.label(ws, r, 1, 'Circuits & cable — circuits × home run, plus cable between openings');
  r++;
  X.headerRow(
    ws,
    r,
    [
      'Circuit group',
      'Cable',
      'Circuits',
      'Avg home run (ft)',
      'Openings served',
      'Ft between openings',
      'Cable LF',
    ],
    { aligns: ['left', 'center', 'right', 'right', 'right', 'right', 'right'] }
  );
  r++;
  const groups = [
    ['Lighting, fan & alarms (15A)', '14/2 NM-B', 3, 40, 48, 8],
    ['General receptacles (20A)', '12/2 NM-B', 4, 45, 20, 12],
    ['Bath, wet bar & dedicated (20A)', '12/2 NM-B', 5, 50, 6, 15],
    ['3-way travelers & alarm interconnect', '14/3 NM-B', null, null, 7, 15],
  ];
  const cirFirst = r;
  for (let i = 0; i < 8; i++) {
    const g = groups[i];
    X.bodyRow(ws, r, [
      { input: true, value: g?.[0] ?? null },
      { input: true, value: g?.[1] ?? null, align: 'center' },
      { input: true, value: g?.[2] ?? null, numFmt: '0;-0;""', align: 'right' },
      { input: true, value: g?.[3] ?? null, numFmt: '#,##0;-#,##0;""', align: 'right' },
      { input: true, value: g?.[4] ?? null, numFmt: '#,##0;-#,##0;""', align: 'right' },
      { input: true, value: g?.[5] ?? null, numFmt: '#,##0;-#,##0;""', align: 'right' },
      {
        formula: `IF(AND(C${r}="",E${r}=""),"",ROUND((N(C${r})*N(D${r})+N(E${r})*N(F${r}))*(1+${makeup}),0))`,
        numFmt: '#,##0;-#,##0;""',
      },
    ]);
    r++;
  }
  const cirLast = r - 1;
  X.totalRow(ws, r, [
    { value: 'Branch circuits' },
    {},
    { formula: `SUM(C${cirFirst}:C${cirLast})`, numFmt: X.FMT.int },
    {},
    {},
    {},
    { formula: `SUM(G${cirFirst}:G${cirLast})`, numFmt: X.FMT.int },
  ]);
  const cirTot = r;
  r += 2;

  // ---- Order quantities and labor ----
  X.headerRow(ws, r, ['Order quantities & labor', '', '', '', '', 'Unit', 'Quantity'], {
    aligns: ['left', 'left', 'left', 'left', 'left', 'center', 'right'],
  });
  r++;
  const out = (lab, unit, formula, fmt = X.FMT.int) => {
    X.text(ws, r, 1, lab, { size: 9.5, merge: 5 });
    X.text(ws, r, 6, unit, { size: 9.5, align: 'center', color: X.C.ink2 });
    X.calc(ws, r, 7, formula, { numFmt: fmt });
    return `G${r++}`;
  };
  out('Openings — devices, lights and fixtures', 'EA', `C${devTot}`);
  out(
    'Branch breakers — one per circuit; AFCI / GFCI / dual-function type per your AHJ',
    'EA',
    `C${cirTot}`
  );
  out('Device boxes — box positions; order multi-gang boxes to suit', 'EA', `G${devTot}`);
  const devHrs = out('Device labor — openings × labor units', 'HR', `E${devTot}`, '0.0');
  const runHrs = out(
    'Home-run labor — circuits × hrs per home run',
    'HR',
    `C${cirTot}*${hrsPerRun}`,
    '0.0'
  );
  const svcHrs = out('Service & panel changeover labor', 'HR', `${serviceHrs}`, '0.0');
  const totHrs = out('Total labor hours', 'HR', `${devHrs}+${runHrs}+${svcHrs}`, '0.0');
  out(
    'Crew-days at your crew size, rounded up to the half day',
    'DAY',
    `IF(${crew}*${dayHrs}=0,0,ROUNDUP(${totHrs}/(${crew}*${dayHrs})*2,0)/2)`,
    '0.0'
  );
  r++;

  // Cable by type: the amber type cell is the SUMIF criterion, so it must match
  // the Cable column above exactly.
  X.headerRow(
    ws,
    r,
    ['Cable to order — type exactly as in the Cable column', '', '', '', '', 'Feet', 'Coils'],
    { aligns: ['left', 'left', 'left', 'left', 'left', 'right', 'right'] }
  );
  r++;
  for (const type of ['14/2 NM-B', '12/2 NM-B', '14/3 NM-B', null]) {
    X.input(ws, r, 1, type);
    X.calc(
      ws,
      r,
      6,
      `IF(A${r}="","",SUMIF(B${cirFirst}:B${cirLast},A${r},G${cirFirst}:G${cirLast}))`,
      { numFmt: '#,##0;-#,##0;""' }
    );
    X.calc(ws, r, 7, `IF(OR(F${r}="",${coil}=0),"",ROUNDUP(F${r}/${coil},0))`, {
      numFmt: '#,##0;-#,##0;""',
    });
    r++;
  }
  r++;
  X.noteRow(
    ws,
    r,
    'Cable LF = (circuits × average home run + openings × feet between openings) × (1 + makeup). Labor units shown are examples: divide your crews’ hours by the openings they installed on your last few jobs. Count the existing circuits at the walk-through — that number drives the changeover hours.',
    7,
    { height: 44 }
  );
  r += 2;
  X.brandFooter(
    ws,
    r,
    7,
    'Free template by BuildWorkPro — buildworkpro.com/templates. Quantities are estimates; circuit design, load calculations and protection follow the code your AHJ enforces.'
  );
  return ws;
}

export const { html, docx, xlsx } = tradeEstimate({
  meta,
  trade: 'Electrical',
  specs: [
    { key: 'service', label: 'Service', flex: 1.2 },
    { key: 'scope', label: 'Scope', flex: 1.2 },
    { key: 'area', label: 'Finished area', flex: 1.1 },
    { key: 'circuits', label: 'New circuits', flex: 1.25 },
    { key: 'permit', label: 'Permit / AHJ' },
  ],
  sections: [
    {
      title: 'Service & distribution',
      hint: 'meter base, panel, grounding, changeover',
      blank: 3,
    },
    {
      title: 'Branch circuits & devices',
      hint: 'home runs, receptacles, GFCIs, switches',
      blank: 4,
    },
    {
      title: 'Lighting, testing & permits',
      hint: 'fixtures, fans, alarms, permit, inspections',
      blank: 3,
    },
  ],
  descriptionHint: 'service work, what you will wire, and what "done" looks like',
  termsHint: 'deposit, payment, wiring allowance, fixtures, exclusions, warranty',
  termsExample:
    'Example: 30% deposit on acceptance; balance when the final inspection passes. Existing-wiring corrections beyond the allowance billed hourly with photos. Owner supplies decorative fixtures. Excludes drywall, patching and utility-side work. 2-year workmanship warranty.',
  fine: FINE,
  xlsxSubtitle:
    'Customer-facing estimate by phase — service, circuits and devices, lighting and permits — with tax, deposit and balance computed. Print fits one page.',
  sample: SAMPLE,
  takeoff,
  pricing: {
    laborRate: 72,
    overhead: 0.2,
    margin: 0.15,
    rows: [
      {
        item: 'Branch circuit: breaker and home run to panel',
        unit: 'EA',
        mat: 88,
        hrs: 1.2,
        other: 2,
      },
      {
        item: 'Receptacle opening, TR duplex, incl. box and cable',
        unit: 'EA',
        mat: 17,
        hrs: 0.7,
        other: 1.5,
      },
      { item: 'GFCI receptacle opening', unit: 'EA', mat: 36, hrs: 0.85, other: 1.5 },
      {
        item: 'Switch opening (single-pole, 3-way, dimmer average)',
        unit: 'EA',
        mat: 16,
        hrs: 0.6,
        other: 1,
      },
      { item: '6" LED recessed wafer light', unit: 'EA', mat: 24, hrs: 0.5, other: 1 },
      { item: 'Hang owner-supplied fixture', unit: 'EA', mat: 6, hrs: 0.9, other: 1 },
      { item: 'Bath exhaust fan, ducted to exterior', unit: 'EA', mat: 145, hrs: 2.5, other: 5 },
      {
        item: 'Smoke/CO alarm, hardwired, interconnected',
        unit: 'EA',
        mat: 48,
        hrs: 0.6,
        other: 1,
      },
    ],
    note: 'Labor hours per unit come from your own crews: divide the hours a crew spent by the openings or circuits it installed on your last few jobs. Material is delivered cost per unit (device, box, plate and its share of cable); "other" covers connectors, staples and consumables.',
  },
  howTo: {
    steps: [
      'Count the job on the Device Takeoff sheet: receptacles, GFCIs, switches, lights, fixtures, fans and alarms from the plan, then the circuits by group with their average home-run length. Labor hours, boxes, breakers and cable by type compute.',
      'Build your selling prices on the Unit Prices sheet: material, labor hours and other cost per opening or circuit, your loaded labor rate, overhead, and profit as a margin on price.',
      'On the Estimate sheet, fill in your company and license number, the customer and the job specs (service, scope, area, circuits, permit/AHJ), and describe the scope in two or three sentences.',
      'Enter the line items under each phase with quantity, unit and unit price. Mark taxable lines Y and enter your rate, or leave tax at 0% if it is already in your prices. Set the deposit.',
      'List optional items the customer can add (low-voltage, an EV circuit) — they are not in the total — then write your terms, including the existing-wiring allowance, who supplies fixtures, and the warranty.',
      'Print or save as PDF, walk the customer through it, and get the acceptance signature and deposit before you order the panel and pull the permit.',
    ],
    tips: [
      'Look inside the old panel before you price the changeover. Double taps, damaged cable and ungrounded circuits turn up on changeover day, and a written allowance settles who pays before the inspector finds them.',
      'Say who supplies fixtures. "Owner-supplied, installed by us" and "contractor-supplied" are different prices, and a vague line turns into an argument at trim.',
      'Keep labor units by opening type from your own time records. Hours per opening price a wet bar, a bathroom or a ceiling full of recessed lights better than a square-foot number does.',
      'Plan around inspections. Rough-in has to pass before insulation and drywall, so tell the customer and their drywall crew when it is booked.',
    ],
    feature: {
      text: 'In BuildWorkPro every estimate is a bid built from line items priced from your product catalog, with margin and overhead applied as rates. It goes out as a branded PDF for e-signature and converts into a project when the customer accepts.',
      url: 'https://buildworkpro.com/features/construction-bidding/',
    },
  },
});
