// HVAC estimate — the customer-facing equipment replacement estimate, grouped
// the way an HVAC contractor prices a change-out (equipment, installation and
// ductwork, controls/startup/permits), plus an HVAC takeoff sheet: the load
// calculation results the equipment was sized from, duct runs by size, line-set
// length and the added refrigerant charge, condensate and thermostat wire.
// Rendered by the trade-estimate kit.
import * as X from '../kit/xlsx.mjs';
import { tradeEstimate } from '../kit/trade-estimate.mjs';

export const meta = {
  slug: 'hvac-estimate',
  name: 'HVAC Estimate Template',
  basename: 'hvac-estimate-template',
  docName: 'HVAC estimate',
};

// A furnace + AC change-out in a Columbus-area ranch with a finished basement.
// The Manual J load calc downsized the old 100,000 BTU furnace to 60,000 BTU;
// the new 96% furnace vents in PVC, which orphans the water heater in the
// chimney (option B). Line set 35 ft, 15 ft in the factory charge, 0.6 oz/ft →
// 12 oz = 0.75 lb added, matching the HVAC Takeoff sheet.
const SAMPLE = {
  company: {
    name: 'Kestrel Heating & Air',
    line1: '2861 Westbelt Dr, Columbus, OH 43228',
    line2: '(614) 555-0119 · estimates@kestrelheatingair.com · Lic. 48213',
  },
  customer: {
    name: 'Marcus & Elena Brandt',
    line1: '5412 Hollow Oak Dr, Westerville, OH 43081',
    line2: '(614) 555-0142',
  },
  job: {
    name: 'Brandt residence — furnace & AC replacement',
    line1: '5412 Hollow Oak Dr, Westerville, OH 43081',
    line2: 'Ranch with finished basement · equipment in basement',
  },
  number: 'EST-2026-0412',
  date: 'September 25, 2026',
  valid: 'October 25, 2026',
  start: 'Week of October 5',
  preparedBy: 'Luis Romero, Owner',
  specs: {
    system: 'Split AC + gas furnace',
    capacity: '3 ton · 60,000 BTU',
    efficiency: '15.2 SEER2 · 96% AFUE',
    home: '2,050 sq ft · 1 zone',
    thermostat: 'Wi-Fi programmable',
  },
  description:
    'Replace the 100,000 BTU furnace, AC and coil with a matched system sized by Manual J load calculation (attached); add two supply runs and a bedroom return.',
  sections: [
    {
      items: [
        {
          desc: '3-ton split air conditioner, 15.2 SEER2, R-454B; new pad, disconnect and whip',
          qty: 1,
          unit: 'EA',
          price: 4150,
        },
        {
          desc: '60,000 BTU 96% AFUE two-stage gas furnace, variable-speed blower',
          qty: 1,
          unit: 'EA',
          price: 3495,
        },
        {
          desc: 'Matched 3-ton cased evaporator coil (AHRI-rated combination)',
          qty: 1,
          unit: 'EA',
          price: 1210,
        },
      ],
    },
    {
      items: [
        {
          desc: 'Remove and dispose of old furnace, AC and coil; recover refrigerant',
          qty: 1,
          unit: 'LS',
          price: 450,
        },
        {
          desc: 'New supply plenum, return drop and 4" media filter cabinet, sealed with mastic',
          qty: 1,
          unit: 'LS',
          price: 1180,
        },
        {
          desc: 'New line set, 3/8" × 3/4" insulated copper; pressure test and evacuate',
          qty: 35,
          unit: 'LF',
          price: 17.5,
        },
        {
          desc: 'Added refrigerant charge beyond the factory charge, weighed in',
          qty: 0.75,
          unit: 'LB',
          price: 78,
        },
        {
          desc: '2" PVC intake and exhaust, sidewall termination; 18 LF condensate drain',
          qty: 1,
          unit: 'LS',
          price: 780,
        },
        {
          desc: 'Add 6" insulated supply runs to the basement office, with boots and registers',
          qty: 2,
          unit: 'EA',
          price: 345,
        },
        {
          desc: 'Add 14" return from the primary bedroom, with grille',
          sub: 'Existing return undersized: static measured at 0.86 in. w.c.',
          qty: 1,
          unit: 'EA',
          price: 565,
        },
      ],
    },
    {
      items: [
        {
          desc: 'Wi-Fi programmable thermostat with new 18/8 wire (80 LF)',
          qty: 1,
          unit: 'EA',
          price: 335,
        },
        {
          desc: 'Startup and commissioning: charge, static, temperature split, gas pressure',
          qty: 1,
          unit: 'LS',
          price: 295,
        },
        { desc: 'Mechanical permit and inspection', qty: 1, unit: 'LS', price: 195 },
      ],
    },
  ],
  options: [
    {
      n: 'A',
      desc: 'Dual fuel: 3-ton heat pump in place of the AC, 15.2 SEER2 / 7.8 HSPF2',
      amount: 1850,
    },
    {
      n: 'B',
      desc: 'Chimney liner for the water heater, if the venting check after furnace removal requires one',
      amount: 1150,
    },
  ],
  taxRate: 0,
  taxBasis: 'materials',
  taxLabel: 'Sales tax — included in prices',
  depositPct: 40,
  terms:
    'Deposit 40% on acceptance to order equipment; balance due at completion after startup and walkthrough. Refrigerant beyond the estimated 0.75 lb billed at $78/lb, weighed and recorded. Excludes electrical panel or circuit changes, asbestos testing or removal, and drywall repair. 2-year labor warranty; the manufacturer’s parts warranty passes through, and we register it for you.',
  sig: {
    customer: 'Elena Brandt',
    customerDate: '09/27/2026',
    contractor: 'Luis Romero, Owner',
    contractorDate: '09/25/2026',
  },
};

const FINE =
  'Sized from the attached load calculation. Hidden conditions and owner changes are priced by written change order first. Check your state’s home-improvement contract rules. Not legal advice.';

/** HVAC takeoff: load calc results, duct runs by size, line set and charge, drain, wire. */
function takeoff(wb) {
  const ws = X.sheet(wb, 'HVAC Takeoff', { fitHeight: 1 });
  X.widths(ws, [30, 11, 10, 12, 12, 13]);
  let r = X.titleBlock(ws, {
    title: 'HVAC Takeoff',
    subtitle:
      'Size equipment from a room-by-room load calculation (ACCA Manual J for homes), not square feet per ton. Then take off duct, line set, refrigerant, drain and wire.',
    cols: 6,
  });
  ws.getCell(r - 2, 1).alignment = { wrapText: true, vertical: 'top' };
  ws.mergeCells(r - 2, 1, r - 2, 6);
  ws.getRow(r - 2).height = 26;
  X.inputLegend(ws, r, 1);
  r += 2;

  // ---- Load calculation (entered, not calculated here) ----
  X.label(ws, r, 1, 'Load calculation — enter from your Manual J report and the equipment data');
  r++;
  const kv = (lab, value, fmt) => {
    X.kv(ws, r, 1, lab, value, { labelTo: 5, numFmt: fmt, align: 'right' });
    return `F${r++}`;
  };
  const coolLoad = kv('Design cooling load, total (BTU/h)', 31800, X.FMT.int);
  const coolCap = kv(
    'Selected cooling capacity, nominal (BTU/h — 12,000 per ton)',
    36000,
    X.FMT.int
  );
  const heatLoad = kv('Design heating load (BTU/h)', 51200, X.FMT.int);
  const heatCap = kv('Furnace heating output (BTU/h — from the spec sheet)', 57600, X.FMT.int);
  const pct = (lab, formula) => {
    X.text(ws, r, 1, lab, { size: 9.5, merge: 5, color: X.C.ink2 });
    X.calc(ws, r, 6, formula, { numFmt: '0%;-0%;""' });
    r++;
  };
  pct(
    'Cooling capacity as % of load — check it against ACCA Manual S',
    `IF(N(${coolLoad})=0,"",${coolCap}/${coolLoad})`
  );
  pct(
    'Heating output as % of load — check it against ACCA Manual S',
    `IF(N(${heatLoad})=0,"",${heatCap}/${heatLoad})`
  );
  r++;

  // ---- Duct runs by size ----
  const ductTable = (title, rows, n) => {
    X.headerRow(
      ws,
      r,
      [title, 'Size (in.)', 'Runs', 'Avg length (ft)', 'Elbows per run', 'Duct (LF)'],
      { aligns: ['left', 'right', 'right', 'right', 'right', 'right'] }
    );
    r++;
    const first = r;
    for (let i = 0; i < n; i++) {
      const d = rows[i];
      X.bodyRow(ws, r, [
        { input: true, value: d?.[0] ?? null },
        { input: true, value: d?.[1] ?? null, numFmt: '0;-0;""', align: 'right' },
        { input: true, value: d?.[2] ?? null, numFmt: '0;-0;""', align: 'right' },
        { input: true, value: d?.[3] ?? null, numFmt: '#,##0;-#,##0;""', align: 'right' },
        { input: true, value: d?.[4] ?? null, numFmt: '0;-0;""', align: 'right' },
        { formula: `IF(OR(C${r}="",D${r}=""),"",C${r}*D${r})`, numFmt: '#,##0;-#,##0;""' },
      ]);
      r++;
    }
    return [first, r - 1];
  };
  const [s1, s2] = ductTable(
    'Supply runs (new or replaced)',
    [['Basement office', 6, 2, 22, 2]],
    4
  );
  const [r1, r2] = ductTable(
    'Return runs (new or replaced)',
    [['Primary bedroom', 14, 1, 26, 3]],
    3
  );
  r++;

  // ---- Line set, refrigerant, drain, wire ----
  X.label(ws, r, 1, 'Line set and charge — check the manufacturer’s installation instructions');
  r++;
  const lineLen = kv('Line-set length, actual (ft) — measured along the route', 35, X.FMT.int);
  const factoryLen = kv('Line length included in the factory charge (ft)', 15, X.FMT.int);
  const ozPerFt = kv(
    'Charge adjustment per foot beyond that (oz/ft, for your liquid-line size)',
    0.6,
    '0.00'
  );
  const extraLine = kv('Extra line set to order for routing and flares (ft)', 5, X.FMT.int);
  r++;
  X.label(ws, r, 1, 'Drain and control wire (ft)');
  r++;
  const drain = kv('Condensate drain, furnace and coil to the drain', 18, X.FMT.int);
  const stick = kv('Drain pipe stick length', 10, X.FMT.int);
  const tstatRun = kv('Thermostat to equipment', 45, X.FMT.int);
  const outdoorRun = kv('Equipment to outdoor unit (usually the line-set route)', 35, X.FMT.int);
  const wireWaste = kv('Wire allowance for terminations and routing', 0.1, X.FMT.pct);
  r++;

  X.headerRow(ws, r, ['Order quantities', '', '', '', 'Unit', 'Quantity'], {
    aligns: ['left', 'left', 'left', 'left', 'center', 'right'],
  });
  r++;
  const out = (lab, unit, formula, fmt = X.FMT.int) => {
    X.text(ws, r, 1, lab, { size: 9.5, merge: 4 });
    X.text(ws, r, 5, unit, { size: 9.5, align: 'center', color: X.C.ink2 });
    X.calc(ws, r, 6, formula, { numFmt: fmt });
    return `F${r++}`;
  };
  out('Supply duct — order by size from the table', 'LF', `SUM(F${s1}:F${s2})`);
  out('Return duct — order by size from the table', 'LF', `SUM(F${r1}:F${r2})`);
  out(
    'Elbows, supply and return',
    'EA',
    `SUMPRODUCT(C${s1}:C${s2},E${s1}:E${s2})+SUMPRODUCT(C${r1}:C${r2},E${r1}:E${r2})`
  );
  out('Takeoffs / starting collars (one per run)', 'EA', `SUM(C${s1}:C${s2})+SUM(C${r1}:C${r2})`);
  out('Supply boots and registers', 'EA', `SUM(C${s1}:C${s2})`);
  out('Return grilles', 'EA', `SUM(C${r1}:C${r2})`);
  out('Line set to order (actual length + extra)', 'FT', `${lineLen}+${extraLine}`);
  const addedOz = out(
    'Added refrigerant charge — weigh in, then verify as the instructions direct',
    'OZ',
    `MAX(0,${lineLen}-${factoryLen})*${ozPerFt}`,
    '0.0'
  );
  out(
    'Added refrigerant charge, in pounds (enter on the estimate)',
    'LB',
    `ROUND(${addedOz}/16,2)`,
    '0.00'
  );
  out('Condensate drain', 'LF', `${drain}`);
  out('Condensate pipe sticks', 'PC', `ROUNDUP(${drain}/${stick},0)`);
  out(
    'Thermostat wire, thermostat + outdoor runs with allowance',
    'LF',
    `ROUNDUP(ROUND((${tstatRun}+${outdoorRun})*(1+${wireWaste}),2),0)`
  );
  r++;
  X.noteRow(
    ws,
    r,
    'Added charge = MAX(0, actual line length − length in the factory charge) × oz per foot, both from the manufacturer’s installation instructions: 35 ft − 15 ft = 20 ft × 0.6 oz = 12 oz (0.75 lb). Pro tip: measure total external static pressure before you quote. A high reading means the duct fix goes on this estimate, not on a callback.',
    6,
    { height: 56 }
  );
  r += 2;
  X.brandFooter(
    ws,
    r,
    6,
    'Free template by BuildWorkPro — buildworkpro.com/templates. Quantities are estimates; confirm charge and line length with the manufacturer.'
  );
  return ws;
}

export const { html, docx, xlsx } = tradeEstimate({
  meta,
  trade: 'HVAC',
  specs: [
    { key: 'system', label: 'System type', flex: 1.25 },
    { key: 'capacity', label: 'Capacity', flex: 1.1 },
    { key: 'efficiency', label: 'Efficiency', flex: 1.25 },
    { key: 'home', label: 'Home / zones', flex: 1.05 },
    { key: 'thermostat', label: 'Thermostat', flex: 1.05 },
  ],
  sections: [
    { title: 'Equipment', hint: 'outdoor unit, furnace or air handler, coil', blank: 3 },
    {
      title: 'Installation & ductwork',
      hint: 'removal, sheet metal, line set, refrigerant, venting, duct',
      blank: 4,
    },
    {
      title: 'Controls, startup & permits',
      hint: 'thermostat, startup and commissioning, permit',
      blank: 3,
    },
  ],
  descriptionHint: 'what you will remove and install, how it was sized, and what "done" looks like',
  termsHint: 'deposit, payment, refrigerant, exclusions, warranty',
  termsExample:
    'Example: 40% deposit on acceptance; balance at completion after startup. Refrigerant beyond the estimate billed per pound. Excludes electrical panel work, asbestos and drywall repair. 2-year labor warranty; manufacturer’s parts warranty passes through.',
  fine: FINE,
  xlsxSubtitle:
    'Customer-facing estimate by phase — equipment, installation and ductwork, controls and permits — with tax, deposit and balance computed. Print fits one page.',
  sample: SAMPLE,
  takeoff,
  pricing: {
    laborRate: 58,
    overhead: 0.3,
    margin: 0.15,
    rows: [
      {
        item: '3-ton split AC, 15.2 SEER2, incl. pad, disconnect, whip',
        unit: 'EA',
        mat: 2450,
        hrs: 3,
        other: 85,
      },
      {
        item: '60,000 BTU 96% two-stage furnace, set and connected',
        unit: 'EA',
        mat: 2050,
        hrs: 3.5,
        other: 30,
      },
      { item: 'Matched 3-ton cased coil', unit: 'EA', mat: 690, hrs: 1.5, other: 15 },
      { item: 'Line set, 3/8" × 3/4" insulated', unit: 'LF', mat: 6.25, hrs: 0.08, other: 0.6 },
      { item: 'Refrigerant, added charge (R-454B)', unit: 'LB', mat: 36, hrs: 0.25, other: 0 },
      {
        item: 'Supply run, 6" insulated, boot and register',
        unit: 'EA',
        mat: 70,
        hrs: 2.5,
        other: 8,
      },
      { item: 'Return run, 14", with grille', unit: 'EA', mat: 125, hrs: 4, other: 12 },
      { item: 'Wi-Fi thermostat with new wire', unit: 'EA', mat: 135, hrs: 1.25, other: 10 },
    ],
    note: 'Labor hours per unit come from your own crews: track install hours by task on your last few change-outs. Material is your distributor cost; "other" covers pads, fittings, fasteners, recovery and consumables per unit. Overhead runs higher on residential replacement work than on new construction — sales time, trucks, callbacks.',
  },
  howTo: {
    steps: [
      'Run the load calculation first (ACCA Manual J for homes) and enter the cooling and heating loads and the equipment you selected at the top of the HVAC Takeoff sheet.',
      'On the same sheet, enter the new or replaced supply and return runs by size, then the line-set length, the factory-charge length and oz/ft from the manufacturer’s instructions, the drain and the wire runs. Duct, fittings, line set, added refrigerant and wire compute.',
      'Build your selling prices on the Unit Prices sheet: material, labor hours and other cost per unit, your loaded labor rate, overhead, and profit as a margin on price.',
      'On the Estimate sheet, fill in your company, the customer and the job specs (system, capacity, efficiency, home size, thermostat), and describe the scope in two or three sentences.',
      'Enter the line items under equipment, installation and controls with quantity, unit and unit price. Mark taxable lines Y and enter your rate, or leave tax at 0% if it is in your prices. List optional items (heat pump, chimney liner) outside the total, and write your terms.',
      'Print or save as PDF, walk the customer through it with the load calculation, and get the signature and deposit before you order equipment.',
    ],
    tips: [
      'Measure total external static pressure on the existing system before you quote. New equipment on undersized duct is a comfort complaint waiting to happen.',
      'When a 90%+ furnace replaces an 80% furnace, check the water heater left alone in the chimney. Price the liner as an option up front.',
      'Put the added refrigerant on its own line at a per-pound price. Weigh it in and record it on the startup sheet.',
      'Show the capacity and efficiency as a matched system. Customers compare tonnage and SEER2 between bids, and a mismatched coil can miss the rating.',
    ],
    feature: {
      text: 'In BuildWorkPro every estimate is a bid built from line items priced from your product catalog, with margin and overhead applied as rates. It goes out as a branded PDF for e-signature and converts into a project when the customer accepts.',
      url: 'https://buildworkpro.com/features/construction-bidding/',
    },
  },
});
