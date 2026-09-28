// Fence estimate — the customer-facing estimate for a residential fence job,
// grouped the way a fence contractor prices it (removal & layout, posts &
// framing, pickets/panels & gates), plus a fence takeoff sheet that turns run
// lengths, gates and hole sizes into posts, rails, pickets and concrete bags.
// Rendered by the trade-estimate kit.
import * as X from '../kit/xlsx.mjs';
import { tradeEstimate } from '../kit/trade-estimate.mjs';

export const meta = {
  slug: 'fence-estimate',
  name: 'Fence Estimate Template',
  basename: 'fence-estimate-template',
  docName: 'Fence estimate',
};

// Tear-out and replacement of a backyard fence in suburban Columbus, Ohio:
// 180 LF of fence line, three sides, tying into the house at both ends, with a
// 4-ft walk gate and a 10-ft double drive gate. 166 LF of fence runs + 14 LF of
// gate openings. The Fence Takeoff sheet's sample inputs reproduce every
// quantity below: 23 sections, 22 4×4 posts, 4 gate posts, 69 rails, 55 bags.
const SAMPLE = {
  company: {
    name: 'Cardinal Post Fence Co.',
    line1: '3150 Valleyview Dr, Columbus, OH 43204',
    line2: '(614) 555-0158 · estimates@cardinalpostfence.com · Insured',
  },
  customer: {
    name: 'Brian & Tasha Monroe',
    line1: '6127 Sandy Ridge Ct, Westerville, OH 43081',
    line2: '(614) 555-0193',
  },
  job: {
    name: 'Monroe residence — backyard fence',
    line1: '6127 Sandy Ridge Ct, Westerville, OH 43081',
    line2: 'Rear yard, three sides · ties into the house',
  },
  number: 'EST-2026-0214',
  date: 'September 23, 2026',
  valid: 'October 23, 2026',
  start: 'Week of October 19',
  preparedBy: 'Dan Kessler, Owner',
  specs: {
    length: '180 LF incl. gates',
    style: '6 ft privacy, dog-ear',
    material: 'Cedar on PT frame',
    gates: '4 ft walk + 10 ft double',
    posts: 'Set 36–42" in concrete',
  },
  description:
    'Tear out the old wood fence and build 180 LF of 6-ft cedar privacy fence on the same line: pressure-treated posts set in concrete, three rails, a kickboard, a 4-ft walk gate and a 10-ft double drive gate.',
  sections: [
    {
      items: [
        {
          desc: 'Tear out existing wood fence, posts and concrete footings',
          qty: 180,
          unit: 'LF',
          price: 5.5,
        },
        {
          desc: 'Haul-off: dump trailer and landfill fees for old fence and footings',
          qty: 1,
          unit: 'LS',
          price: 295,
        },
        {
          desc: 'Layout from survey pins, string line, mark posts; 811 locate requested',
          qty: 1,
          unit: 'LS',
          price: 185,
        },
      ],
    },
    {
      items: [
        {
          desc: '4×4 PT ground-contact posts — line, corner and end — set 36" deep',
          qty: 22,
          unit: 'EA',
          price: 68,
        },
        { desc: '6×6 PT gate posts, set 42" deep', qty: 4, unit: 'EA', price: 155 },
        {
          desc: 'Concrete for post footings, 80-lb bags',
          sub: 'About 2 bags per 4×4 hole and 3 per gate-post hole',
          qty: 55,
          unit: 'BAG',
          price: 12,
        },
        { desc: '2×4 PT rails, three per section (23 sections)', qty: 69, unit: 'EA', price: 17 },
        { desc: '2×6 PT kickboard along the bottom', qty: 166, unit: 'LF', price: 3.6 },
      ],
    },
    {
      items: [
        {
          desc: '1×6 × 6 ft dog-ear cedar pickets, butted tight, ring-shank nails',
          sub: '364 pickets on 166 LF of fence runs',
          qty: 166,
          unit: 'LF',
          price: 18,
        },
        {
          desc: '4-ft walk gate: steel frame, cedar face, heavy-duty hinges, gravity latch',
          qty: 1,
          unit: 'EA',
          price: 435,
        },
        {
          desc: '10-ft double drive gate (two 5-ft leaves), drop rod and cane bolt',
          qty: 1,
          unit: 'EA',
          price: 1085,
        },
        {
          desc: 'Fence permit and HOA submittal (site plan, drawing); final cleanup',
          qty: 1,
          unit: 'LS',
          price: 225,
        },
      ],
    },
  ],
  options: [
    {
      n: 'A',
      desc: '2×6 cedar cap board with 1×4 trim along the top of the fence (166 LF)',
      amount: 1245,
    },
    {
      n: 'B',
      desc: 'Semi-transparent oil stain, both sides of fence and gates — return visit once the wood dries',
      amount: 1690,
    },
  ],
  taxRate: 0,
  taxBasis: 'materials',
  taxLabel: 'Sales tax — included in prices',
  depositPct: 35,
  terms:
    'Deposit 35% on acceptance to order materials; balance due at completion after the walkthrough. Owner confirms the property line and pins; fence set 2" inside the line. 811 marks public lines only: owner marks sprinkler, pet-fence and lighting lines. Rock or old concrete that stops the auger: $65 per hole, with photos. Workmanship warranty 2 years. Price firm through the valid-until date.',
  sig: {
    customer: 'Tasha Monroe',
    customerDate: '09/26/2026',
    contractor: 'Dan Kessler, Owner',
    contractorDate: '09/23/2026',
  },
};

const FINE =
  'Priced for normal digging on the line walked with the owner. Rock, old footings and changes go on a written change order first. Check permit, HOA and state contract rules. Not legal advice.';

/**
 * Fence takeoff: runs between terminal posts → sections, line posts, rails and
 * pickets; gates → gate posts, leaves and hardware; hole size → concrete bags.
 */
function takeoff(wb) {
  const ws = X.sheet(wb, 'Fence Takeoff', { fitHeight: 1 });
  X.widths(ws, [36, 12, 12, 12, 13, 13]);
  let r = X.titleBlock(ws, {
    title: 'Fence Takeoff',
    subtitle:
      'Split the fence line at every corner, end and gate, and enter each straight run. Enter gate openings in the gate table, not in the runs.',
    cols: 6,
  });
  X.inputLegend(ws, r, 1);
  r += 2;

  // Assumptions first: the run and gate tables below reference them.
  X.label(ws, r, 1, 'Assumptions — check the product, your local code and the bag');
  r++;
  const assume = (lab, value, fmt) => {
    X.kv(ws, r, 1, lab, value, { labelTo: 5, numFmt: fmt, align: 'right' });
    return `$F$${r++}`;
  };
  const spacing = assume('Maximum post spacing, on center (ft) — no wider than the rail', 8, '0.0');
  const railsPer = assume('Rails per section (3 is typical at 6 ft tall, 2 at 4 ft)', 3, '0');
  const picketW = assume('Picket width, actual (in) — a 1×6 is 5.5', 5.5, '0.00');
  const gap = assume('Gap between pickets (in) — 0 for butted privacy', 0, '0.00');
  const culls = assume('Picket waste and culls (split, warped, cut)', 0.05, X.FMT.pct);
  const yieldCf = assume('Concrete yield per 80-lb bag (cu ft) — check the bag', 0.6, '0.00');
  const subPost = assume('Subtract the post from the hole volume? (1 = yes, 0 = no)', 1, '0');
  const hingesPer = assume('Hinges per gate leaf (3 is common on 6-ft gates)', 3, '0');
  const removal = assume('Old fence to tear out (LF)', 180, X.FMT.int);
  r++;

  // ---- Runs ----
  X.headerRow(
    ws,
    r,
    [
      'Fence run (terminal post to terminal post)',
      'Length (LF)',
      'Sections',
      'Line posts',
      'Rails',
      'Pickets',
    ],
    { aligns: ['left', 'right', 'right', 'right', 'right', 'right'] }
  );
  r++;
  const runs = [
    ['Left side — house to drive gate', 4],
    ['Left side — drive gate to back corner', 44],
    ['Back line — corner to corner', 74],
    ['Right side — back corner to walk gate', 40],
    ['Right side — walk gate to house', 4],
  ];
  const runFirst = r;
  for (let i = 0; i < 10; i++) {
    const p = runs[i];
    X.bodyRow(ws, r, [
      { input: true, value: p?.[0] ?? null },
      { input: true, value: p?.[1] ?? null, numFmt: '#,##0.0;-#,##0.0;""', align: 'right' },
      { formula: `IF(B${r}="","",ROUNDUP(B${r}/${spacing},0))`, numFmt: '0;-0;""' },
      { formula: `IF(B${r}="","",MAX(C${r}-1,0))`, numFmt: '0;-0;0' },
      { formula: `IF(B${r}="","",C${r}*${railsPer})`, numFmt: '0;-0;""' },
      {
        formula: `IF(B${r}="","",ROUNDUP(B${r}*12/(${picketW}+${gap}),0))`,
        numFmt: '#,##0;-#,##0;""',
      },
    ]);
    r++;
  }
  const runLast = r - 1;
  X.totalRow(ws, r, [
    { value: 'Fence runs, net of gate openings' },
    { formula: `SUM(B${runFirst}:B${runLast})`, numFmt: '#,##0.0' },
    { formula: `SUM(C${runFirst}:C${runLast})`, numFmt: X.FMT.int },
    { formula: `SUM(D${runFirst}:D${runLast})`, numFmt: X.FMT.int },
    { formula: `SUM(E${runFirst}:E${runLast})`, numFmt: X.FMT.int },
    { formula: `SUM(F${runFirst}:F${runLast})`, numFmt: X.FMT.int },
  ]);
  const runTot = r;
  r += 2;

  // ---- Terminal posts and gates ----
  X.label(ws, r, 1, 'End and corner posts — each counted once, not once per run');
  r++;
  const endPosts = assume(
    'End posts (fence stops at the house, a garage or another fence)',
    2,
    '0'
  );
  const cornerPosts = assume('Corner posts', 2, '0');
  r++;
  X.headerRow(ws, r, ['Gate', 'Qty', 'Opening (ft)', 'Leaves each', 'Gate posts', 'Gate pickets'], {
    aligns: ['left', 'right', 'right', 'right', 'right', 'right'],
  });
  r++;
  const gates = [
    ['Walk gate', 1, 4, 1],
    ['Double drive gate', 1, 10, 2],
  ];
  const gateFirst = r;
  for (let i = 0; i < 4; i++) {
    const g = gates[i];
    X.bodyRow(ws, r, [
      { input: true, value: g?.[0] ?? null },
      { input: true, value: g?.[1] ?? null, numFmt: '0;-0;""', align: 'right' },
      { input: true, value: g?.[2] ?? null, numFmt: '0.0;-0.0;""', align: 'right' },
      { input: true, value: g?.[3] ?? null, numFmt: '0;-0;""', align: 'right' },
      { formula: `IF(B${r}="","",B${r}*2)`, numFmt: '0;-0;""' },
      {
        formula: `IF(OR(B${r}="",C${r}=""),"",B${r}*ROUNDUP(C${r}*12/(${picketW}+${gap}),0))`,
        numFmt: '0;-0;""',
      },
    ]);
    r++;
  }
  const gateLast = r - 1;
  const gRange = (col) => `${col}${gateFirst}:${col}${gateLast}`;
  X.totalRow(ws, r, [
    { value: 'Gates — openings (LF) and total leaves' },
    { formula: `SUM(${gRange('B')})`, numFmt: X.FMT.int },
    { formula: `SUMPRODUCT(${gRange('B')},${gRange('C')})`, numFmt: '#,##0.0' },
    { formula: `SUMPRODUCT(${gRange('B')},${gRange('D')})`, numFmt: X.FMT.int },
    { formula: `SUM(${gRange('E')})`, numFmt: X.FMT.int },
    { formula: `SUM(${gRange('F')})`, numFmt: X.FMT.int },
  ]);
  const gateTot = r;
  r += 2;

  // ---- Holes and concrete: one column per hole size ----
  X.headerRow(ws, r, ['Post holes and concrete', '', '', '', 'Line/end/corner', 'Gate posts'], {
    aligns: ['left', 'left', 'left', 'left', 'right', 'right'],
  });
  r++;
  const holeRow = (lab, a, b, fmt, isInput) => {
    X.text(ws, r, 1, lab, { size: 9.5, merge: 4 });
    if (isInput) {
      X.input(ws, r, 5, a, { numFmt: fmt, align: 'right' });
      X.input(ws, r, 6, b, { numFmt: fmt, align: 'right' });
    } else {
      X.calc(ws, r, 5, a, { numFmt: fmt });
      X.calc(ws, r, 6, b, { numFmt: fmt });
    }
    return r++;
  };
  const holes = holeRow(
    'Holes (from the post counts above)',
    `D${runTot}+${endPosts}+${cornerPosts}`,
    `E${gateTot}`,
    X.FMT.int
  );
  const dia = holeRow('Hole diameter (in)', 10, 12, '0.0', true);
  const depth = holeRow(
    'Hole depth (in) — frost depth and code set this; check locally',
    36,
    42,
    '0',
    true
  );
  const gravel = holeRow('Gravel in the bottom of the hole (in)', 6, 6, '0', true);
  const post = holeRow(
    'Post size, actual (in) — 4×4 = 3.5, 6×6 = 5.5; round post: 0.89 × diameter',
    3.5,
    5.5,
    '0.00',
    true
  );
  const perHole = (c) =>
    `MAX(0,(PI()*(${c}${dia}/2)^2-${subPost}*${c}${post}^2)*(${c}${depth}-${c}${gravel})/1728)`;
  const cf = holeRow('Concrete per hole (cu ft)', perHole('E'), perHole('F'), '0.00');
  holeRow('Bags per hole', `E${cf}/${yieldCf}`, `F${cf}/${yieldCf}`, '0.0');
  const bags = holeRow(
    'Bags for these holes',
    `ROUNDUP(E${holes}*E${cf}/${yieldCf},0)`,
    `ROUNDUP(F${holes}*F${cf}/${yieldCf},0)`,
    X.FMT.int
  );
  const grav = holeRow(
    'Gravel for these holes (cu ft)',
    `E${holes}*PI()*(E${dia}/2)^2*E${gravel}/1728`,
    `F${holes}*PI()*(F${dia}/2)^2*F${gravel}/1728`,
    '0.0'
  );
  r++;

  // ---- Order quantities ----
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
  out('Old fence to tear out', 'LF', removal);
  out('Fence line — runs plus gate openings', 'LF', `B${runTot}+C${gateTot}`, '#,##0.0');
  out('Fence to build, net of gate openings (pickets, kickboard)', 'LF', `B${runTot}`, '#,##0.0');
  out('Sections', 'EA', `C${runTot}`);
  out('Line, end and corner posts', 'EA', `E${holes}`);
  out('Gate posts (upsize these)', 'EA', `F${holes}`);
  out('Rails — one board per rail per section', 'EA', `E${runTot}`);
  out('Kickboards — one per section', 'EA', `C${runTot}`);
  out('Pickets — fence runs, before waste', 'EA', `F${runTot}`);
  out(
    'Pickets to order — runs + gates + waste',
    'EA',
    `ROUNDUP((F${runTot}+F${gateTot})*(1+${culls}),0)`
  );
  out('Concrete, 80-lb bags', 'BAG', `E${bags}+F${bags}`);
  out('Gravel for hole bottoms', 'CF', `E${grav}+F${grav}`, '0.0');
  out('Gate hinges', 'EA', `D${gateTot}*${hingesPer}`);
  out('Gate latches — one per gate', 'EA', `B${gateTot}`);
  out('Drop rods / cane bolts — one per extra leaf', 'EA', `D${gateTot}-B${gateTot}`);
  r++;
  X.noteRow(
    ws,
    r,
    'Sections = ROUNDUP(run ÷ post spacing); line posts = sections − 1 per run; end, corner and gate posts are counted once. Concrete per hole = (π × (diameter ÷ 2)² − post area) × (depth − gravel) ÷ 1,728. Call 811 before you dig: it marks public lines only, so ask the owner about sprinkler, pet-fence and lighting lines.',
    6,
    { height: 58 }
  );
  r += 2;
  X.brandFooter(
    ws,
    r,
    6,
    'Free template by BuildWorkPro — buildworkpro.com/templates. Quantities are estimates; confirm hole depth with local code and yield on the bag.'
  );
  return ws;
}

export const { html, docx, xlsx } = tradeEstimate({
  meta,
  trade: 'Fence',
  specs: [
    { key: 'length', label: 'Fence length' },
    { key: 'style', label: 'Height & style', flex: 1.1 },
    { key: 'material', label: 'Material' },
    { key: 'gates', label: 'Gates', flex: 1.2 },
    { key: 'posts', label: 'Post setting', flex: 1.1 },
  ],
  sections: [
    { title: 'Removal & layout', hint: 'tear-out, haul-off, survey pins, 811 locate', blank: 3 },
    { title: 'Posts & framing', hint: 'line and gate posts, concrete, rails, kickboard', blank: 4 },
    {
      title: 'Pickets, panels & gates',
      hint: 'pickets or panels, gates, hardware, permit, cleanup',
      blank: 3,
    },
  ],
  descriptionHint: 'what you will remove and build, where, and what "done" looks like',
  termsHint: 'deposit, payment, property line, rock and utilities, warranty',
  termsExample:
    'Example: 35% deposit on acceptance; balance at completion. Owner confirms the property line. Rock or old footings that stop the auger billed per hole with photos. Owner marks private utility lines. 2-year workmanship warranty.',
  fine: FINE,
  xlsxSubtitle:
    'Customer-facing estimate by phase — removal, posts and framing, pickets and gates — with tax, deposit and balance computed. Print fits one page.',
  sample: SAMPLE,
  takeoff,
  pricing: {
    laborRate: 42,
    overhead: 0.14,
    margin: 0.15,
    rows: [
      { item: 'Tear out wood fence incl. footings', unit: 'LF', mat: 0, hrs: 0.08, other: 0.6 },
      {
        item: '4×4 PT post, dug and set (concrete separate)',
        unit: 'EA',
        mat: 23,
        hrs: 0.6,
        other: 3,
      },
      { item: '6×6 PT gate post, dug and set', unit: 'EA', mat: 62, hrs: 1.2, other: 4 },
      { item: 'Concrete, 80-lb bag', unit: 'BAG', mat: 6.75, hrs: 0.05, other: 0 },
      { item: '2×4 × 8 ft PT rail, installed', unit: 'EA', mat: 7.25, hrs: 0.12, other: 0.35 },
      {
        item: '1×6 dog-ear cedar pickets, installed',
        unit: 'LF',
        mat: 8.95,
        hrs: 0.1,
        other: 0.35,
      },
      { item: '4-ft walk gate, steel frame, hardware', unit: 'EA', mat: 145, hrs: 4, other: 10 },
      { item: '10-ft double drive gate, hardware', unit: 'EA', mat: 400, hrs: 9, other: 20 },
    ],
    note: 'Labor hours per unit come from your own crews: divide the hours a crew spent by the posts set or feet built on your last few jobs. Picket material per LF = pickets per foot (with culls) × price per picket. "Other" covers auger rental, fuel, fasteners and disposal per unit.',
  },
  howTo: {
    steps: [
      'Walk the line with the owner, then fill in the Fence Takeoff sheet: each straight run between end, corner and gate posts, the gates, and the hole size. Sections, posts, rails, pickets, concrete bags and gate hardware compute.',
      'Build your selling prices on the Unit Prices sheet: material, labor hours and other cost per unit, your loaded labor rate, overhead, and profit as a margin on price.',
      'On the Estimate sheet, fill in your company, the customer and the job specs (length, height and style, material, gates, post setting), and describe the scope in two or three sentences.',
      'Enter the line items under each phase with quantity, unit and unit price. Mark taxable lines Y and enter your rate, or leave tax at 0% if it is already in your prices. Set the deposit.',
      'List optional items the customer can add (cap and trim, stain) — they are not in the total — then write your terms, including the property line, rock and private utility lines, and the warranty.',
      'Print or save as PDF, walk the customer through it, and get the acceptance signature and deposit before you order material or request the locate.',
    ],
    tips: [
      'Put the property line in writing. The owner identifies the line and pins; if nobody can find the pins, the answer is a survey, not a guess.',
      'Price rock and old footings per hole before you dig. It is the one cost you cannot see, and a written per-hole price settles it with photos.',
      'Upsize gate posts and set them deeper. Sagging gates are a common callback on wood fences, and the post is usually why.',
      'Count end and corner posts once. Adding one post per run double-counts every corner.',
    ],
    feature: {
      text: 'In BuildWorkPro every estimate is a bid built from line items priced from your product catalog, with margin and overhead applied as rates. It goes out as a branded PDF for e-signature and converts into a project when the customer accepts.',
      url: 'https://buildworkpro.com/features/construction-bidding/',
    },
  },
});
