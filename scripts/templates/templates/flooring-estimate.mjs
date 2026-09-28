// Flooring estimate — the customer-facing estimate for a floor replacement,
// grouped the way a flooring contractor prices the job (removal and prep,
// installation, trim and transitions), plus a floor takeoff sheet that turns
// room dimensions into measured square feet, boxes with waste, underlayment,
// setting materials, trim and self-leveler bags. Rendered by the
// trade-estimate kit.
import * as X from '../kit/xlsx.mjs';
import { tradeEstimate } from '../kit/trade-estimate.mjs';

export const meta = {
  slug: 'flooring-estimate',
  name: 'Flooring Estimate Template',
  basename: 'flooring-estimate-template',
  docName: 'Flooring estimate',
};

// Carpet and ceramic tile out, rigid-core LVP through a single-story slab home
// and porcelain tile in the primary bath. 1,129 sq ft of LVP and 60 sq ft of
// tile measured on the Floor Takeoff sheet. Material is priced by the box the
// takeoff orders (waste included); labor is priced on measured square feet.
const SAMPLE = {
  company: {
    name: 'Sloan Canyon Floor Co.',
    line1: '3870 E Sunset Rd, Unit 4, Las Vegas, NV 89120',
    line2: '(702) 555-0148 · estimates@sloancanyonfloor.com · NV Lic. 0089417',
  },
  customer: {
    name: 'Tom & Angela Reyes',
    line1: '1186 Coral Mesa Ave, Henderson, NV 89074',
    line2: '(702) 555-0163',
  },
  job: {
    name: 'Reyes residence — new floors',
    line1: '1186 Coral Mesa Ave, Henderson, NV 89074',
    line2: 'Single-story home on slab · 3 bed / 2 bath',
  },
  number: 'EST-2026-0214',
  date: 'September 24, 2026',
  valid: 'October 24, 2026',
  start: 'Week of October 12',
  preparedBy: 'Dana Whitaker, Owner',
  specs: {
    area: '1,189 sq ft measured',
    flooring: '20-mil LVP + porcelain tile',
    rooms: 'Living areas, 3 BR, 1 bath',
    subfloor: 'Concrete slab',
    removal: 'Carpet + ceramic tile',
  },
  description:
    'Remove carpet and ceramic tile, level low spots in the slab, and install rigid-core luxury vinyl plank in the living areas and bedrooms and porcelain tile in the primary bath, with new quarter round.',
  sections: [
    {
      items: [
        {
          desc: 'Remove carpet, pad and tack strip — living, hall, bedrooms; haul away',
          qty: 857,
          unit: 'SF',
          price: 0.75,
        },
        {
          desc: 'Remove ceramic tile — kitchen, dining, primary bath; grind thinset',
          qty: 332,
          unit: 'SF',
          price: 3.5,
        },
        {
          desc: 'Slab leveling — prime and pour self-leveler at low spots — allowance',
          sub: 'Billed per bag actually used, with photos',
          qty: 6,
          unit: 'BAG',
          price: 95,
        },
      ],
    },
    {
      items: [
        {
          desc: 'Luxury vinyl plank, 20-mil, rigid core — 23.64 sq ft/box, incl. 10% waste',
          qty: 53,
          unit: 'BOX',
          price: 82.5,
        },
        {
          desc: 'Underlayment, 2 mm with attached vapor barrier — 100 sq ft rolls',
          qty: 12,
          unit: 'RL',
          price: 46,
        },
        {
          desc: 'Install LVP floating floor over underlayment; undercut door jambs',
          qty: 1129,
          unit: 'SF',
          price: 2.4,
        },
        {
          desc: 'Porcelain tile, 12" × 24" matte — 15.5 sq ft/box, incl. 15% waste',
          qty: 5,
          unit: 'BOX',
          price: 65,
        },
        {
          desc: 'Setting materials — modified thinset, grout, grout sealer',
          qty: 1,
          unit: 'LS',
          price: 135,
        },
        {
          desc: 'Install tile on slab, 1/3 offset, 1/8" joints; grout and seal',
          qty: 60,
          unit: 'SF',
          price: 12.5,
        },
      ],
    },
    {
      items: [
        {
          desc: 'Quarter round, primed MDF, installed; nail holes filled, ready for paint',
          qty: 330,
          unit: 'LF',
          price: 2.75,
        },
        {
          desc: 'Transitions — T-molding, reducers and end caps to match the LVP',
          qty: 4,
          unit: 'EA',
          price: 55,
        },
        {
          desc: 'Pull and reset toilet — new wax ring and supply line',
          qty: 1,
          unit: 'EA',
          price: 195,
        },
      ],
    },
  ],
  options: [
    {
      n: 'A',
      desc: 'New 5¼" primed MDF baseboard in place of the quarter round, 330 LF (net add)',
      amount: 825,
    },
    {
      n: 'B',
      desc: 'Hall bath floor in the same porcelain tile, 38 sq ft, incl. tear-out and toilet reset',
      amount: 1095,
    },
  ],
  taxRate: 0,
  taxBasis: 'materials',
  taxLabel: 'Sales tax — included in prices',
  depositPct: 40,
  terms:
    'Deposit 40% on acceptance to order material; balance due at completion after the final walkthrough. Leveling beyond the 6-bag allowance is billed at $95/bag with photos. Owner clears furniture; we move the range and refrigerator. Excludes painting, plumbing and slab-crack repair. Workmanship warranty 2 years; the manufacturer’s warranty passes through. Leftover boxes stay with the owner.',
  sig: {
    customer: 'Angela Reyes',
    customerDate: '09/26/2026',
    contractor: 'Dana Whitaker, Owner',
    contractorDate: '09/24/2026',
  },
};

const FINE =
  'Based on measurements taken before tear-out. Subfloor damage, moisture and owner changes are priced by written change order first. Check your state’s contract rules. Not legal advice.';

/** Floor takeoff: rooms L × W → measured area by floor type, then boxes, rolls, bags and trim. */
function takeoff(wb) {
  const ws = X.sheet(wb, 'Floor Takeoff', { fitHeight: 1 });
  X.widths(ws, [24, 10, 8, 9, 9, 10, 11, 12, 10]);
  let r = X.titleBlock(ws, {
    title: 'Floor Takeoff',
    subtitle:
      'One row per room or closet. Measure wall to wall (to cabinet faces in kitchens). Floor A and Floor B are the two new products you are installing.',
    cols: 9,
  });
  X.inputLegend(ws, r, 1);
  r += 2;
  X.headerRow(
    ws,
    r,
    [
      'Room or area',
      'Existing floor to remove',
      'New floor (A/B)',
      'Length (ft)',
      'Width (ft)',
      'Area (sq ft)',
      'Perimeter (ft)',
      'Doors & open sides (ft)',
      'Trim (LF)',
    ],
    {
      aligns: ['left', 'center', 'center', 'right', 'right', 'right', 'right', 'right', 'right'],
      height: 32,
    }
  );
  r++;
  const rooms = [
    ['Living room', 'Carpet', 'A', 18, 16, 17],
    ['Dining room', 'Tile', 'A', 12, 11, 17],
    ['Kitchen (to cabinet faces)', 'Tile', 'A', 14, 10, 6],
    ['Hallway', 'Carpet', 'A', 20, 3.5, 19],
    ['Primary bedroom', 'Carpet', 'A', 15, 13, 9],
    ['Primary closet', 'Carpet', 'A', 7, 6, 3],
    ['Bedroom 2', 'Carpet', 'A', 12, 11, 8],
    ['Bedroom 2 closet', 'Carpet', 'A', 5, 2, 5],
    ['Bedroom 3', 'Carpet', 'A', 11, 10, 8],
    ['Bedroom 3 closet', 'Carpet', 'A', 5, 2, 5],
    ['Primary bath (excl. tub)', 'Tile', 'B', 10, 6, 12],
  ];
  const ft = '#,##0.0;-#,##0.0;""';
  const first = r;
  for (let i = 0; i < 15; i++) {
    const p = rooms[i];
    X.bodyRow(ws, r, [
      { input: true, value: p?.[0] ?? null },
      { input: true, value: p?.[1] ?? null, align: 'center' },
      { input: true, value: p?.[2] ?? null, align: 'center' },
      { input: true, value: p?.[3] ?? null, numFmt: ft, align: 'right' },
      { input: true, value: p?.[4] ?? null, numFmt: ft, align: 'right' },
      { formula: `IF(OR(D${r}="",E${r}=""),"",D${r}*E${r})`, numFmt: '#,##0;-#,##0;""' },
      { formula: `IF(OR(D${r}="",E${r}=""),"",2*(D${r}+E${r}))`, numFmt: '#,##0;-#,##0;""' },
      { input: true, value: p?.[5] ?? null, numFmt: '#,##0;-#,##0;""', align: 'right' },
      { formula: `IF(G${r}="","",MAX(0,G${r}-N(H${r})))`, numFmt: '#,##0;-#,##0;""' },
    ]);
    r++;
  }
  const last = r - 1;
  X.dropdown(ws, `B${first}:B${last}`, ['Carpet', 'Tile', 'Vinyl', 'Wood', 'None']);
  X.dropdown(ws, `C${first}:C${last}`, ['A', 'B']);
  const rng = (col) => `${col}${first}:${col}${last}`;
  X.totalRow(ws, r, [
    { value: 'Total measured' },
    {},
    {},
    {},
    {},
    { formula: `SUM(${rng('F')})`, numFmt: X.FMT.int },
    {},
    {},
    { formula: `SUM(${rng('I')})`, numFmt: X.FMT.int },
  ]);
  const trim = `I${r}`;
  r++;
  const sub = (lab, formula) => {
    X.text(ws, r, 1, lab, { size: 9.5, color: X.C.ink2, merge: 5 });
    X.calc(ws, r, 6, formula, { numFmt: X.FMT.int });
    return `F${r++}`;
  };
  const areaA = sub('Floor A — measured area (sq ft)', `SUMIF(${rng('C')},"A",${rng('F')})`);
  const areaB = sub('Floor B — measured area (sq ft)', `SUMIF(${rng('C')},"B",${rng('F')})`);
  r++;

  X.label(ws, r, 1, 'Assumptions — check the carton, the bag and the manufacturer’s instructions');
  r++;
  const assume = (lab, value, fmt, align = 'right') => {
    X.kv(ws, r, 1, lab, value, { labelTo: 7, to: 9, numFmt: fmt, align });
    return `H${r++}`;
  };
  assume('Floor A — product', 'Luxury vinyl plank, 20-mil', undefined, 'left');
  const wasteA = assume(
    'Floor A waste — around 10% straight lay, 15% or more diagonal or herringbone',
    0.1,
    X.FMT.pct
  );
  const boxA = assume('Floor A — sq ft per box (printed on the carton)', 23.64, '0.00');
  const roll = assume(
    'Underlayment — sq ft per roll, net of laps (0 if the plank has an attached pad)',
    100,
    X.FMT.int
  );
  assume('Floor B — product', 'Porcelain tile, 12" × 24"', undefined, 'left');
  const wasteB = assume(
    'Floor B waste — more for small rooms, offsets, diagonal and herringbone',
    0.15,
    X.FMT.pct
  );
  const boxB = assume('Floor B — sq ft per box (printed on the carton)', 15.5, '0.00');
  const thinset = assume(
    'Thinset — sq ft per bag at your trowel notch (check the bag)',
    45,
    X.FMT.int
  );
  const grout = assume(
    'Grout — sq ft per bag for your tile size and joint width (check the chart)',
    150,
    X.FMT.int
  );
  const trimWaste = assume('Trim waste — cuts, miters and short offcuts', 0.1, X.FMT.pct);
  const trimLen = assume('Trim — length per piece (ft)', 8, '0');
  const transitions = assume(
    'Transitions — doorways where the floor type or height changes, plus exterior doors (count)',
    4,
    '0'
  );
  const levelArea = assume('Self-leveler — area to fill (sq ft)', 120, X.FMT.int);
  const levelDepth = assume('Self-leveler — average depth (inches)', 0.25, '0.000');
  const levelYield = assume(
    'Self-leveler — yield per bag in cubic feet (check the bag)',
    0.45,
    '0.00'
  );
  r++;

  X.headerRow(ws, r, ['Order quantities', '', '', '', '', '', '', 'Unit', 'Quantity'], {
    aligns: ['left', 'left', 'left', 'left', 'left', 'left', 'left', 'center', 'right'],
  });
  r++;
  const out = (lab, unit, formula, fmt = X.FMT.int) => {
    X.text(ws, r, 1, lab, { size: 9.5, merge: 7 });
    X.text(ws, r, 8, unit, { size: 9.5, align: 'center', color: X.C.ink2 });
    X.calc(ws, r, 9, formula, { numFmt: fmt });
    r++;
  };
  const removed = (code) => `SUMIF(${rng('B')},"${code}",${rng('F')})`;
  out('Tear-out — carpet and pad', 'SF', removed('Carpet'));
  out('Tear-out — ceramic or stone tile', 'SF', removed('Tile'));
  out('Tear-out — sheet vinyl or VCT', 'SF', removed('Vinyl'));
  out('Tear-out — wood or laminate', 'SF', removed('Wood'));
  out(
    'Self-leveler (area × depth ÷ 12 ÷ yield)',
    'BAG',
    `IF(${levelYield}>0,ROUNDUP(${levelArea}*${levelDepth}/12/${levelYield},0),0)`
  );
  out('Floor A — install area (price labor on measured sq ft)', 'SF', areaA);
  out(
    'Floor A — boxes to order, with waste',
    'BOX',
    `IF(${boxA}>0,ROUNDUP(${areaA}*(1+${wasteA})/${boxA},0),0)`
  );
  out(
    'Floor A — sq ft delivered (full boxes)',
    'SF',
    `IF(${boxA}>0,ROUNDUP(${areaA}*(1+${wasteA})/${boxA},0)*${boxA},0)`
  );
  out('Underlayment', 'RL', `IF(${roll}>0,ROUNDUP(${areaA}/${roll},0),0)`);
  out('Floor B — install area (price labor on measured sq ft)', 'SF', areaB);
  out(
    'Floor B — boxes to order, with waste',
    'BOX',
    `IF(${boxB}>0,ROUNDUP(${areaB}*(1+${wasteB})/${boxB},0),0)`
  );
  out('Thinset', 'BAG', `IF(${thinset}>0,ROUNDUP(${areaB}/${thinset},0),0)`);
  out('Grout', 'BAG', `IF(${grout}>0,ROUNDUP(${areaB}/${grout},0),0)`);
  out('Quarter round or baseboard (perimeter − doors & open sides)', 'LF', trim);
  out(
    'Trim pieces to order, with waste',
    'PC',
    `IF(${trimLen}>0,ROUNDUP(${trim}*(1+${trimWaste})/${trimLen},0),0)`
  );
  out('Transitions', 'EA', transitions);
  r++;
  X.noteRow(
    ws,
    r,
    'Boxes = ROUNDUP(measured sq ft × (1 + waste) ÷ sq ft per box). Price labor on the measured area and material on the full boxes you order. Leave the extra boxes with the owner: a later production run may not match for repairs.',
    9,
    { height: 44 }
  );
  r += 2;
  X.brandFooter(
    ws,
    r,
    9,
    'Free template by BuildWorkPro — buildworkpro.com/templates. Quantities are estimates; confirm coverage, flatness and installation requirements with the manufacturer.'
  );
  return ws;
}

export const { html, docx, xlsx } = tradeEstimate({
  meta,
  trade: 'Flooring',
  specs: [
    { key: 'area', label: 'Floor area' },
    { key: 'flooring', label: 'Flooring', flex: 1.4 },
    { key: 'rooms', label: 'Rooms', flex: 1.3 },
    { key: 'subfloor', label: 'Subfloor', flex: 0.9 },
    { key: 'removal', label: 'Removal' },
  ],
  sections: [
    { title: 'Removal & prep', hint: 'tear-out, disposal, floor leveling', blank: 3 },
    {
      title: 'Installation',
      hint: 'flooring, underlayment, setting materials, labor',
      blank: 4,
    },
    {
      title: 'Trim, transitions & other',
      hint: 'quarter round, baseboard, transitions, toilet reset',
      blank: 3,
    },
  ],
  descriptionHint: 'what comes out, what goes down in which rooms, and what "done" looks like',
  termsHint: 'deposit, payment, leveling allowance, exclusions, warranty',
  termsExample:
    'Example: 40% deposit on acceptance to order material; balance at completion. Leveling beyond the allowance billed per bag with photos. Owner clears furniture. Excludes painting and slab repair. 2-year workmanship warranty; manufacturer’s warranty passes through.',
  fine: FINE,
  xlsxSubtitle:
    'Customer-facing estimate by phase — removal and prep, installation, trim and transitions — with tax, deposit and balance computed. Print fits one page.',
  sample: SAMPLE,
  takeoff,
  pricing: {
    laborRate: 42,
    overhead: 0.12,
    margin: 0.2,
    rows: [
      {
        item: 'Carpet, pad and tack strip removal, incl. disposal',
        unit: 'SF',
        mat: 0,
        hrs: 0.01,
        other: 0.12,
      },
      {
        item: 'Ceramic tile removal on slab, grind thinset',
        unit: 'SF',
        mat: 0,
        hrs: 0.05,
        other: 0.4,
      },
      { item: 'Self-leveler, primed and poured', unit: 'BAG', mat: 42, hrs: 0.6, other: 0 },
      {
        item: 'Luxury vinyl plank, 20-mil (23.64 sq ft box)',
        unit: 'BOX',
        mat: 58.5,
        hrs: 0,
        other: 0.4,
      },
      { item: 'Install LVP floating floor', unit: 'SF', mat: 0, hrs: 0.04, other: 0.04 },
      { item: 'Install porcelain tile on slab', unit: 'SF', mat: 0, hrs: 0.2, other: 0.5 },
      {
        item: 'Quarter round, primed MDF, installed',
        unit: 'LF',
        mat: 0.55,
        hrs: 0.03,
        other: 0.12,
      },
      { item: 'Transition strip, installed', unit: 'EA', mat: 26, hrs: 0.3, other: 0 },
    ],
    note: 'Labor hours per unit come from your own crews: divide the hours a crew spent by the square feet it installed on your last few jobs. Material is delivered cost per box, roll or piece; "other" covers disposal, spacers, adhesive and consumables per unit.',
  },
  howTo: {
    steps: [
      'Measure the job on the Floor Takeoff sheet: one row per room and closet with length, width, the floor being removed, the new floor (A or B) and the doors and open sides that get no trim. Areas, tear-out, boxes, rolls, bags and trim compute.',
      'Build your selling prices on the Unit Prices sheet: material, labor hours and other cost per unit, your loaded labor rate, overhead, and profit as a margin on price.',
      'On the Estimate sheet, fill in your company, the customer and the job specs (area, flooring, rooms, subfloor, removal), and describe the scope in two or three sentences.',
      'Enter the line items under each phase with quantity, unit and unit price: material by the box, labor by measured square foot, trim by the linear foot. Mark taxable lines Y and enter your rate, or leave tax at 0% if it is already in your prices. Set the deposit.',
      'List optional items the customer can add (new baseboard, another room) — they are not in the total — then write your terms, including the leveling allowance and warranty.',
      'Print or save as PDF, walk the customer through it, and get the acceptance signature and deposit before you order material.',
    ],
    tips: [
      'Carry a floor-leveling allowance with a per-bag price. You cannot see the slab or subfloor until the old floor is up, and a written allowance settles the cost before tear-out.',
      'Price removal by what is coming out. Carpet comes up fast; glued tile and its thinset take several times the labor and produce much more debris.',
      'Order every box of a product from one production run and leave the extras with the owner. A later run may not match when a plank or tile needs replacing.',
      'Photograph the floor after tear-out. Photos make the leveling allowance and any change order easy to approve.',
    ],
    feature: {
      text: 'In BuildWorkPro every estimate is a bid built from line items priced from your product catalog, with margin and overhead applied as rates. It goes out as a branded PDF for e-signature and converts into a project when the customer accepts.',
      url: 'https://buildworkpro.com/features/construction-bidding/',
    },
  },
});
