// Drywall estimate — the customer-facing hang, tape & finish estimate, grouped
// the way a drywall contractor prices the job (hang, tape & finish, then
// texture, specialty items and cleanup), plus a drywall takeoff sheet that
// turns room dimensions into board by type and sheet size, compound, tape,
// screws, corner bead and labor hours. Rendered by the trade-estimate kit.
import * as X from '../kit/xlsx.mjs';
import { tradeEstimate } from '../kit/trade-estimate.mjs';

export const meta = {
  slug: 'drywall-estimate',
  name: 'Drywall Estimate Template',
  basename: 'drywall-estimate-template',
  docName: 'Drywall estimate',
};

// A basement finish in suburban Kansas City, framed by others. 3,350 sq ft of
// board measured on the takeoff: 1,856 walls + 224 soffits in regular board,
// 996 ceilings in ceiling board, 274 in moisture-resistant board at the bath.
// Board is priced per square foot hung; finishing per square foot of all board.
const SAMPLE = {
  company: {
    name: 'Prairie Line Drywall & Finishing',
    line1: '1406 NE Cornerstone Dr, Lee’s Summit, MO 64086',
    line2: '(816) 555-0142 · estimates@prairielinedrywall.com',
  },
  customer: {
    name: 'Mark & Jenna Holloway',
    line1: '3317 SW Windsor Park Dr, Lee’s Summit, MO 64082',
    line2: '(816) 555-0171',
  },
  job: {
    name: 'Holloway basement finish — drywall',
    line1: '3317 SW Windsor Park Dr, Lee’s Summit, MO 64082',
    line2: 'Family room, rec area, bedroom, bath and hall',
  },
  number: 'EST-2026-0214',
  date: 'September 24, 2026',
  valid: 'October 24, 2026',
  start: 'Week of October 12',
  preparedBy: 'Tom Ferris, Owner',
  specs: {
    area: '3,350 sq ft of board',
    board: '½" regular, ceiling & MR',
    finish: 'Level 4 (GA-214)',
    height: '8 ft · soffits at 7 ft',
    texture: 'Knockdown ceilings',
  },
  description:
    'Hang and finish the basement family room, rec area, bedroom, bath and hall on framing by others: Level 4, knockdown ceilings, ready for primer.',
  sections: [
    {
      items: [
        { desc: 'Hang ½" regular board on walls, 4×12 sheets', qty: 1856, unit: 'SF', price: 1.25 },
        {
          desc: 'Hang ½" sag-resistant ceiling board, 4×12 sheets',
          qty: 996,
          unit: 'SF',
          price: 1.45,
        },
        {
          desc: 'Hang ½" moisture-resistant board — bathroom walls and ceiling',
          sub: 'Tub alcove excluded; cement board by the tile setter',
          qty: 274,
          unit: 'SF',
          price: 1.75,
        },
        { desc: 'Wrap duct soffits and beam, 3.5-ft girth', qty: 64, unit: 'LF', price: 10.5 },
        {
          desc: 'Board delivery and hand-stocking to the basement',
          sub: 'Straight-run stair checked on the walkthrough: 12-ft sheets fit',
          qty: 1,
          unit: 'LS',
          price: 325,
        },
      ],
    },
    {
      items: [
        {
          desc: 'Tape, bed and finish all board to Level 4 — three coats, sanded',
          qty: 3350,
          unit: 'SF',
          price: 1.05,
        },
        {
          desc: 'Corner bead at outside corners, soffit edges and window returns',
          qty: 220,
          unit: 'LF',
          price: 2.75,
        },
        {
          desc: 'Egress window returns — wrap three sides and sill, bead and finish',
          qty: 2,
          unit: 'EA',
          price: 185,
        },
      ],
    },
    {
      items: [
        { desc: 'Knockdown texture — ceilings and soffits', qty: 1292, unit: 'SF', price: 0.65 },
        {
          desc: 'Access panels, 14" × 14", supplied and installed (shower valve, main shutoff)',
          qty: 2,
          unit: 'EA',
          price: 110,
        },
        {
          desc: 'Floor protection, daily cleanup and scrap haul-off',
          qty: 1,
          unit: 'LS',
          price: 450,
        },
      ],
    },
  ],
  options: [
    {
      n: 'A',
      desc: 'Level 5 skim coat on the family room walls (640 SF), for a projector wall or raking light',
      amount: 640,
    },
    {
      n: 'B',
      desc: 'Hang and finish the storage room walls and ceiling to Level 4 (about 560 SF of board)',
      amount: 1395,
    },
  ],
  taxRate: 0,
  taxBasis: 'materials',
  taxLabel: 'Sales tax — included in prices',
  depositPct: 30,
  terms:
    'Deposit 30% on acceptance to schedule the crew and order board; balance due on completion after the walkthrough. Rough-in and insulation inspections (where required) must be signed off before we hang. Excludes framing fixes, blocking, painting and tile backer. Board added by owner changes is billed at the unit prices above. Workmanship warranty 1 year. Price firm through the valid-until date.',
  sig: {
    customer: 'Jenna Holloway',
    customerDate: '09/26/2026',
    contractor: 'Tom Ferris, Owner',
    contractorDate: '09/24/2026',
  },
};

const FINE =
  'Measured from the framing before board goes up. Owner changes and framing problems are priced by written change order first. Check your state’s home-improvement contract rules. Not legal advice.';

/** Drywall takeoff: rooms → wall and ceiling area → board by type and sheet size, then finishing materials and labor. */
function takeoff(wb) {
  const ws = X.sheet(wb, 'Drywall Takeoff', { fitHeight: 1 });
  X.widths(ws, [24, 10, 9, 10, 10, 11, 9, 11, 12]);
  let r = X.titleBlock(ws, {
    title: 'Drywall Takeoff',
    subtitle:
      'Wall area = wall length × height − openings; ceiling area = length × width. Mark bath and laundry rooms Y to put them in moisture-resistant board.',
    cols: 9,
  });
  X.inputLegend(ws, r, 1);
  r += 2;
  X.headerRow(
    ws,
    r,
    [
      'Room / area',
      'Wall length (LF)',
      'Wall height (ft)',
      'Ceiling length (ft)',
      'Ceiling width (ft)',
      'Openings to deduct (sq ft)',
      'MR board? (Y/N)',
      'Wall area (sq ft)',
      'Ceiling area (sq ft)',
    ],
    {
      aligns: ['left', 'right', 'right', 'right', 'right', 'right', 'center', 'right', 'right'],
      height: 32,
    }
  );
  r++;
  const rooms = [
    ['Family room', 80, 8, 24, 18, 0, 'N'],
    ['Rec area', 46, 8, 20, 16, 0, 'N'],
    ['Bedroom + closet', 62, 8, 12, 15, 0, 'N'],
    ['Bath, less tub alcove', 34, 8, 8, 9, 70, 'Y'],
    ['Hall + stair', 44, 8, 16, 4, 0, 'N'],
  ];
  const num1 = '#,##0.0;-#,##0.0;""';
  const first = r;
  for (let i = 0; i < 10; i++) {
    const p = rooms[i];
    X.bodyRow(ws, r, [
      { input: true, value: p?.[0] ?? null },
      { input: true, value: p?.[1] ?? null, numFmt: num1, align: 'right' },
      { input: true, value: p?.[2] ?? null, numFmt: num1, align: 'right' },
      { input: true, value: p?.[3] ?? null, numFmt: num1, align: 'right' },
      { input: true, value: p?.[4] ?? null, numFmt: num1, align: 'right' },
      { input: true, value: p?.[5] ?? null, numFmt: '#,##0;-#,##0;""', align: 'right' },
      { input: true, value: p?.[6] ?? null, align: 'center' },
      {
        formula: `IF(OR(B${r}="",C${r}=""),"",MAX(0,B${r}*C${r}-N(F${r})))`,
        numFmt: '#,##0;-#,##0;""',
      },
      { formula: `IF(OR(D${r}="",E${r}=""),"",D${r}*E${r})`, numFmt: '#,##0;-#,##0;""' },
    ]);
    r++;
  }
  const last = r - 1;
  X.dropdown(ws, `G${first}:G${last}`, ['Y', 'N']);
  X.totalRow(ws, r, [
    { value: 'Room totals (sq ft)' },
    {},
    {},
    {},
    {},
    {},
    {},
    { formula: `SUM(H${first}:H${last})`, numFmt: X.FMT.int },
    { formula: `SUM(I${first}:I${last})`, numFmt: X.FMT.int },
  ]);
  const wallTot = `H${r}`;
  const ceilTot = `I${r}`;
  r++;
  X.text(ws, r, 1, 'Of which in moisture-resistant board (rooms marked Y)', {
    size: 9.5,
    color: X.C.ink2,
    merge: 7,
  });
  X.calc(ws, r, 8, `SUMIF(G${first}:G${last},"Y",H${first}:H${last})`, { numFmt: X.FMT.int });
  X.calc(ws, r, 9, `SUMIF(G${first}:G${last},"Y",I${first}:I${last})`, { numFmt: X.FMT.int });
  const wallMr = `H${r}`;
  const ceilMr = `I${r}`;
  r += 2;

  X.label(ws, r, 1, 'Soffits, bulkheads and beam wraps');
  r++;
  const kvRow = (lab, value, fmt) => {
    X.kv(ws, r, 1, lab, value, { labelTo: 8, numFmt: fmt, align: 'right' });
    return `I${r++}`;
  };
  const soffitLf = kvRow('Soffit length (LF)', 64, '#,##0');
  const girth = kvRow('Soffit girth — both sides + bottom (ft)', 3.5, '0.00');
  const bead = kvRow(
    'Corner bead — outside corners, soffit edges and window returns (LF)',
    220,
    '#,##0'
  );
  r++;

  X.headerRow(ws, r, ['Board by type', '', '', '', '', '', '', '', 'Sq ft'], {
    aligns: ['left', 'left', 'left', 'left', 'left', 'left', 'left', 'left', 'right'],
  });
  r++;
  const line = (lab, formula) => {
    X.text(ws, r, 1, lab, { size: 9.5, merge: 8 });
    X.calc(ws, r, 9, formula, { numFmt: X.FMT.int });
    return `I${r++}`;
  };
  const soffitArea = line('Soffit board (length × girth)', `${soffitLf}*${girth}`);
  const regArea = line(
    'Regular wall board — walls not marked Y, plus soffits',
    `${wallTot}-${wallMr}+${soffitArea}`
  );
  const ceilArea = line('Ceiling board — ceilings not marked Y', `${ceilTot}-${ceilMr}`);
  const mrArea = line(
    'Moisture-resistant board — walls and ceilings marked Y',
    `${wallMr}+${ceilMr}`
  );
  X.totalRow(ws, r, [
    { value: 'Total board to hang and finish (sq ft)' },
    {},
    {},
    {},
    {},
    {},
    {},
    {},
    { formula: `${regArea}+${ceilArea}+${mrArea}`, numFmt: X.FMT.int },
  ]);
  const board = `I${r}`;
  r++;
  const texArea = line('Texture area — all ceilings plus soffits', `${ceilTot}+${soffitArea}`);
  r++;

  X.label(ws, r, 1, 'Assumptions — check the board, compound and fastener labels');
  r++;
  const waste = kvRow(
    'Board waste — about 10% on open rooms, more on soffits and cut-up rooms',
    0.1,
    X.FMT.pct
  );
  const sheetW = kvRow('Sheet width (ft) — 4 standard; 4.5 for 54-inch board', 4, '0.0');
  const lenWall = kvRow('Regular wall board — sheet length (ft): 8, 10 or 12', 12, '0');
  const lenCeil = kvRow('Ceiling board — sheet length (ft)', 12, '0');
  const lenMr = kvRow('Moisture-resistant board — sheet length (ft)', 8, '0');
  const mudRate = kvRow(
    'Joint compound, all coats — gallons per 1,000 sq ft (rule of thumb; check the product)',
    10,
    '0.0'
  );
  const mudPkg = kvRow('Joint compound — gallons per box or pail (check the label)', 4.5, '0.0');
  const tapeRate = kvRow(
    'Paper tape — feet per 1,000 sq ft of board (rule of thumb)',
    370,
    '#,##0'
  );
  const tapeRoll = kvRow('Paper tape — feet per roll', 500, '#,##0');
  const screwRate = kvRow(
    'Screws per 1,000 sq ft of board (check the fastening schedule)',
    1000,
    '#,##0'
  );
  const screwBox = kvRow('Screws per box (check the box)', 1000, '#,##0');
  const beadLen = kvRow('Corner bead — stick length (ft)', 10, '0');
  const hangRate = kvRow('Hang — sq ft per labor hour (your crews)', 90, '#,##0');
  const finRate = kvRow('Tape & finish — sq ft per labor hour, all coats and sanding', 75, '#,##0');
  const texRate = kvRow('Texture — sq ft per labor hour, incl. masking', 150, '#,##0');
  r++;

  X.headerRow(ws, r, ['Order quantities', '', '', '', '', '', '', 'Unit', 'Quantity'], {
    aligns: ['left', 'left', 'left', 'left', 'left', 'left', 'left', 'center', 'right'],
  });
  r++;
  const out = (lab, unit, formula, fmt = X.FMT.int) => {
    X.text(ws, r, 1, lab, { size: 9.5, merge: 7 });
    if (unit.formula) X.calc(ws, r, 8, unit.formula, { align: 'center' });
    else X.text(ws, r, 8, unit, { size: 9.5, align: 'center', color: X.C.ink2 });
    X.calc(ws, r, 9, formula, { numFmt: fmt });
    r++;
  };
  const size = (len) => ({ formula: `${sheetW}&"×"&${len}` });
  out(
    'Regular wall board sheets — walls and soffits, with waste',
    size(lenWall),
    `ROUNDUP(${regArea}*(1+${waste})/(${sheetW}*${lenWall}),0)`
  );
  out(
    'Ceiling board sheets, with waste',
    size(lenCeil),
    `ROUNDUP(${ceilArea}*(1+${waste})/(${sheetW}*${lenCeil}),0)`
  );
  out(
    'Moisture-resistant board sheets, with waste',
    size(lenMr),
    `ROUNDUP(${mrArea}*(1+${waste})/(${sheetW}*${lenMr}),0)`
  );
  out('Joint compound — boxes or pails', 'EA', `ROUNDUP(${board}/1000*${mudRate}/${mudPkg},0)`);
  out('Paper tape — rolls', 'RL', `ROUNDUP(${board}/1000*${tapeRate}/${tapeRoll},0)`);
  out('Screws — boxes', 'BOX', `ROUNDUP(${board}/1000*${screwRate}/${screwBox},0)`);
  out('Corner bead — sticks, with waste', 'PC', `ROUNDUP(${bead}*(1+${waste})/${beadLen},0)`);
  out('Hang labor', 'HR', `ROUND(${board}/${hangRate},1)`, '#,##0.0');
  out('Tape & finish labor', 'HR', `ROUND(${board}/${finRate},1)`, '#,##0.0');
  out('Texture labor', 'HR', `ROUND(${texArea}/${texRate},1)`, '#,##0.0');
  out(
    'Total labor hours',
    'HR',
    `ROUND(${board}/${hangRate}+${board}/${finRate}+${texArea}/${texRate},1)`,
    '#,##0.0'
  );
  r++;
  X.noteRow(
    ws,
    r,
    'Sheets = board area × (1 + waste) ÷ sheet area (4×8 = 32, 4×10 = 40, 4×12 = 48 sq ft), rounded up. Many hangers deduct only large openings: a door cutout is mostly scrap anyway. Longer sheets mean fewer butt joints to finish, as long as they fit down the stairs.',
    9,
    { height: 44 }
  );
  r += 2;
  X.brandFooter(
    ws,
    r,
    9,
    'Free template by BuildWorkPro — buildworkpro.com/templates. Quantities are estimates; confirm coverage and fastening with the manufacturer.'
  );
  return ws;
}

export const { html, docx, xlsx } = tradeEstimate({
  meta,
  trade: 'Drywall',
  specs: [
    { key: 'area', label: 'Board area' },
    { key: 'board', label: 'Board type', flex: 1.25 },
    { key: 'finish', label: 'Finish level' },
    { key: 'height', label: 'Ceiling height', flex: 1.1 },
    { key: 'texture', label: 'Texture' },
  ],
  sections: [
    { title: 'Hang', hint: 'board by type, soffits, delivery and stocking', blank: 4 },
    { title: 'Tape & finish', hint: 'finish level, corner bead, window returns', blank: 3 },
    {
      title: 'Texture, specialty & cleanup',
      hint: 'texture, access panels, protection, haul-off',
      blank: 3,
    },
  ],
  descriptionHint: 'rooms, board, finish level and texture, and what "done" looks like',
  termsHint: 'deposit, payment, inspections, exclusions, warranty',
  termsExample:
    'Example: 30% deposit on acceptance; balance on completion. Rough-in inspections signed off before we hang. Excludes framing fixes, painting and tile backer. Changes billed at the unit prices above. 1-year workmanship warranty.',
  fine: FINE,
  xlsxSubtitle:
    'Customer-facing estimate by phase — hang, tape & finish, texture & cleanup — with tax, deposit and balance computed. Print fits one page.',
  sample: SAMPLE,
  takeoff,
  pricing: {
    laborRate: 46,
    overhead: 0.15,
    margin: 0.2,
    rows: [
      { item: 'Hang ½" regular board — walls', unit: 'MSF', mat: 440, hrs: 9, other: 30 },
      { item: 'Hang ½" sag-resistant ceiling board', unit: 'MSF', mat: 480, hrs: 11, other: 30 },
      { item: 'Hang ½" moisture-resistant board', unit: 'MSF', mat: 620, hrs: 12, other: 30 },
      { item: 'Soffit and beam wrap, 3.5-ft girth', unit: 'LF', mat: 1.6, hrs: 0.12, other: 0.15 },
      {
        item: 'Tape, bed and finish to Level 4, sanded',
        unit: 'MSF',
        mat: 70,
        hrs: 13.5,
        other: 25,
      },
      {
        item: 'Corner bead, installed and finished',
        unit: 'LF',
        mat: 0.45,
        hrs: 0.03,
        other: 0.05,
      },
      { item: 'Egress window return, 3 sides + sill', unit: 'EA', mat: 22, hrs: 2.2, other: 8 },
      { item: 'Knockdown texture, incl. masking', unit: 'MSF', mat: 45, hrs: 7, other: 70 },
    ],
    note: 'Board, finish and texture rows are per MSF (1,000 sq ft) so the hours read clearly: divide the price by 1,000 for the per-SF price on the estimate. Material is delivered cost with waste; hours come from your own crews; "other" covers screws, tape, blades and masking.',
  },
  howTo: {
    steps: [
      'Take off the job on the Drywall Takeoff sheet: enter each room’s wall length, height, ceiling dimensions and any large openings, and mark wet rooms Y for moisture-resistant board. Add soffit length and girth and the corner bead footage. Sheets by size, compound, tape, screws and labor hours compute.',
      'Build your selling prices on the Unit Prices sheet: material, labor hours and other cost per unit, your loaded labor rate, overhead, and profit as a margin on price. Board rows are per 1,000 sq ft; divide by 1,000 for the per-SF price.',
      'On the Estimate sheet, fill in your company, the customer and the job specs (board area, board type, finish level, ceiling height, texture), and describe the scope in two or three sentences.',
      'Enter the line items under hang, tape & finish, and texture & cleanup with quantity, unit and unit price. Mark taxable lines Y and enter your rate, or leave tax at 0% if it is already in your prices. Set the deposit.',
      'List optional items the customer can add (a Level 5 skim coat, an extra room) — they are not in the total — then write your terms, including inspections, exclusions and warranty.',
      'Print or save as PDF, walk the customer through it, and get the acceptance signature and deposit before you order board.',
    ],
    tips: [
      'Write the finish level on the estimate by number. "Smooth walls" means different things to a homeowner and a finisher; Level 4 or Level 5 does not.',
      'Price soffits, bead and window returns on their own lines. They are slow work, and burying them in a flat square-foot price is where drywall jobs lose money.',
      'Check the stairs before you order 12-ft sheets for a basement. Longer sheets save butt joints only if they fit down the stairs.',
      'Walk the framing before you hang. Bowed studs, missing blocking and failed inspections are cheaper to fix before board goes up, and a change order settles who pays.',
    ],
    feature: {
      text: 'In BuildWorkPro every estimate is a bid built from line items priced from your product catalog, with margin and overhead applied as rates. It goes out as a branded PDF for e-signature and converts into a project when the customer accepts.',
      url: 'https://buildworkpro.com/features/construction-bidding/',
    },
  },
});
