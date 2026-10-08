// Concrete block (CMU) takeoff for one wall: blocks, mortar, grout, vertical
// bars and joint reinforcement, then an optional price from the contractor's
// own unit prices. Pure functions only; the page controller and the Playwright
// spec both import them, so the numbers on the page and in the tests come from
// one place.
//
// Sources (every figure below is one of these, or derived from one in a comment):
//   CMHA TEK 04-02A, Estimating Concrete Masonry Materials (formerly NCMA TEK 4-2A):
//     an 8 × 16 in nominal face is 8/9 sq ft, 119 units per 100 sq ft with 5% waste;
//     Table 3 grout volumes for hollow two-core units, 3% waste included; 4 in
//     conventional units are not grouted.
//   CMHA TEK 02-02B: standard units are two-core, 8 in high, 16 in long, 4 to 12 in wide.
//   SPEC MIX Masonry Cement & Sand data sheet: 8 in block per 80 lb bag of preblended
//     mortar by unit width, typical waste included. SPEC MIX mortar selection guide:
//     one 80 lb bag yields 0.7 cu ft of wet mortar. Quikrete Mason Mix (up to 13) and
//     Sakrete Type S (12) rate their 80 lb bags in the same range for 8 × 8 × 16 block;
//     CMHA uses 16 assuming face-shell bedding, so the rate is an editable input.
//   Quikrete Core-Fill Grout (Coarse) data sheet: an 80 lb bag yields about 0.65 cu ft.
import { nonNeg, parseNum } from './format';
import { round2, type NewLine } from './estimate';

export const TOOL = 'concrete-block-calculator';

/** CMHA TEK 04-02A: an 8 × 16 in nominal face is 8/9 sq ft, so 1.125 blocks per sq ft. */
export const FACE_SQFT = 8 / 9;
export const BLOCKS_PER_SQFT = 1.125;
/**
 * Nominal course height (CMHA TEK 02-02B: 8 in high, 16 in long). The block itself is
 * typically ⅜ in smaller (7⅝ × 15⅝ in) so the module holds with ⅜ in bed and head
 * joints, the TMS 602 default joint.
 */
export const COURSE_IN = 8;
export const CUFT_PER_CUYD = 27;

export const WIDTHS = ['4', '6', '8', '10', '12'] as const;
export type Width = (typeof WIDTHS)[number];

/**
 * Typical blocks laid per 80 lb bag of preblended mortar: the midpoint of the
 * SPEC MIX Masonry Cement & Sand ranges (4 in 15–17, 6 in 12–14, 8 in 11–13,
 * 10 in 11–13, 12 in 10–12). Editable on the page.
 */
export const MORTAR_BLOCKS_PER_80LB: Record<Width, number> = {
  '4': 16,
  '6': 13,
  '8': 12,
  '10': 12,
  '12': 11,
};
/** SPEC MIX: one 80 lb bag yields about 0.7 cu ft of wet mortar. */
export const MORTAR_CUFT_PER_80LB = 0.7;

export const MORTAR_BAGS = {
  '80': { label: '80 lb bags', lb: 80 },
  '60': { label: '60 lb bags', lb: 60 },
  '3000': { label: '3,000 lb bulk bags', lb: 3000 },
} as const;
export type MortarBag = keyof typeof MORTAR_BAGS;

/**
 * CMHA TEK 04-02A Table 3, the 8 in grout-spacing row (every cell filled):
 * cu ft of grout per 100 sq ft of wall, two-core hollow units, 3% waste included.
 * There is no 4 in value because conventional 4 in units are not grouted.
 */
export const GROUT_FULL_CUFT_PER_100SQFT: Record<Exclude<Width, '4'>, number> = {
  '6': 25.6,
  '8': 36.1,
  '10': 47.0,
  '12': 58.9,
};
/** Cells at 8 in o.c. in 8 in courses: 14,400 sq in ÷ 64 sq in = 225 cells per 100 sq ft. */
export const CELLS_PER_100SQFT = 225;
/** Quikrete Core-Fill Grout (Coarse): an 80 lb bag yields about 0.65 cu ft. */
export const GROUT_BAG_CUFT = 0.65;

export const GROUTS = {
  none: 'No grout',
  cells: 'Cells with bars',
  full: 'Fully grouted',
} as const;
export type Grout = keyof typeof GROUTS;

/** Bar spacings in 8 in steps, matching the cell layout and CMHA Table 3. */
export const SPACINGS = [16, 24, 32, 40, 48, 56, 64, 72, 80, 88, 96, 104, 112, 120] as const;
export const BARS = ['4', '5'] as const;
export type Bar = (typeof BARS)[number];
export const STICKS = ['20', '10'] as const;
export type Stick = (typeof STICKS)[number];

export const JOINT_EVERY = {
  '0': 'None',
  '1': 'Every course (8" o.c.)',
  '2': 'Every other course (16" o.c.)',
  '3': 'Every third course (24" o.c.)',
} as const;
export type JointEvery = keyof typeof JOINT_EVERY;

export const GROUT_BY = {
  yd: 'Cu yd (ready-mix)',
  bag: '80 lb bags',
} as const;
export type GroutBy = keyof typeof GROUT_BY;

export type BlockInput = {
  length: number; // ft
  height: number; // ft
  openings: number; // sq ft to deduct
  width: Width;
  waste: number; // percent, on blocks
  grout: Grout;
  spacing: number; // vertical bar spacing, in o.c.
  bar: Bar;
  stick: Stick;
  joint: JointEvery;
  bag: MortarBag;
  /** Blocks laid per 80 lb bag; null uses the typical rate for the width. */
  mortarRate: number | null;
  groutBy: GroutBy;
};

export const DEFAULT_INPUT: BlockInput = {
  length: 40,
  height: 8,
  openings: 0,
  width: '8',
  waste: 5,
  grout: 'cells',
  spacing: 48,
  bar: '5',
  stick: '20',
  joint: '2',
  bag: '80',
  mortarRate: null,
  groutBy: 'yd',
};

export type BlockPrices = {
  block?: number; // per block
  mortar?: number; // per bag of the chosen size
  groutYd?: number; // per cu yd
  groutBag?: number; // per 80 lb bag
  rebar?: number; // per stick
  joint?: number; // per linear foot
  labor?: number; // per block laid
};

export type BlockResult = {
  gross: number;
  openings: number;
  area: number;
  courses: number;
  wholeCourses: number;
  blocksLaid: number;
  blocks: number;
  mortarRate: number;
  mortarTypical: boolean;
  mortarCuft: number;
  mortarBags: number;
  /** The grout actually applied: 4 in block is never grouted. */
  grout: Grout;
  groutedCells: number;
  groutCuft: number;
  groutCuyd: number;
  groutOrderCuyd: number;
  groutBags: number;
  bars: number;
  barLf: number;
  sticks: number;
  spliced: boolean;
  jointRows: number;
  jointLf: number;
};

const up = (n: number) => Math.ceil(n - 1e-9);

/** Bags of mortar for a number of blocks laid at a rate per 80 lb bag. */
export function mortarFor(
  blocksLaid: number,
  ratePer80: number,
  bagLb = 80
): { cuft: number; bags: number } {
  if (blocksLaid <= 0 || ratePer80 <= 0) return { cuft: 0, bags: 0 };
  return {
    cuft: (blocksLaid / ratePer80) * MORTAR_CUFT_PER_80LB,
    bags: up(blocksLaid / (ratePer80 * (bagLb / 80))),
  };
}

/** Grout per grouted cell, one course high: the fully grouted Table 3 volume ÷ 225 cells. */
export function groutPerCell(width: Width): number {
  return width === '4' ? 0 : GROUT_FULL_CUFT_PER_100SQFT[width] / CELLS_PER_100SQFT;
}

export function computeBlock(input: BlockInput): BlockResult {
  const { length, height } = input;
  const gross = length * height;
  const openings = Math.min(gross, input.openings);
  const area = gross - openings;
  const courses = (height * 12) / COURSE_IN;
  const wholeCourses = height > 0 ? up(courses) : 0;
  const blocksLaid = area > 0 ? up(area * BLOCKS_PER_SQFT) : 0;
  const blocks = area > 0 ? up(area * BLOCKS_PER_SQFT * (1 + Math.max(0, input.waste) / 100)) : 0;

  const mortarRate = input.mortarRate ?? MORTAR_BLOCKS_PER_80LB[input.width];
  const mortar = mortarFor(blocksLaid, mortarRate, MORTAR_BAGS[input.bag].lb);

  const grout: Grout = input.width === '4' || area <= 0 ? 'none' : input.grout;
  const bars = grout !== 'none' && length > 0 ? up((length * 12) / input.spacing) + 1 : 0;
  const groutedCells = grout === 'cells' ? bars * wholeCourses : 0;
  const fullRate = input.width === '4' ? 0 : GROUT_FULL_CUFT_PER_100SQFT[input.width];
  // Grouting cells never takes more than filling every cell of the gross wall.
  const groutCuft =
    grout === 'full'
      ? (area * fullRate) / 100
      : grout === 'cells'
        ? Math.min(groutedCells * groutPerCell(input.width), (gross * fullRate) / 100)
        : 0;
  const groutCuyd = groutCuft / CUFT_PER_CUYD;

  const stickFt = Number(input.stick);
  const barLf = bars * height;
  const spliced = height > stickFt;
  const perStick = spliced || height <= 0 ? 0 : Math.floor(stickFt / height + 1e-9);
  const sticks = bars === 0 ? 0 : spliced ? up(barLf / stickFt) : up(bars / perStick);

  const every = Number(input.joint);
  const jointRows = every > 0 && wholeCourses > 1 ? up((wholeCourses - 1) / every) : 0;

  return {
    gross,
    openings,
    area,
    courses,
    wholeCourses,
    blocksLaid,
    blocks,
    mortarRate,
    mortarTypical: input.mortarRate == null,
    mortarCuft: mortar.cuft,
    mortarBags: mortar.bags,
    grout,
    groutedCells,
    groutCuft,
    groutCuyd,
    groutOrderCuyd: up(groutCuyd * 4) / 4,
    groutBags: groutCuft > 0 ? up(groutCuft / GROUT_BAG_CUFT) : 0,
    bars,
    barLf,
    sticks,
    spliced,
    jointRows,
    jointLf: jointRows * length,
  };
}

export type PricedBlock = {
  material: number | null;
  materialComplete: boolean;
  labor: number | null;
  total: number | null;
  perSqft: number | null;
};

/** The grout quantity and price that go on the estimate, by how the grout is bought. */
function groutLine(
  input: BlockInput,
  r: BlockResult,
  p: BlockPrices
): [number, number | undefined] {
  return input.groutBy === 'bag' ? [r.groutBags, p.groutBag] : [r.groutOrderCuyd, p.groutYd];
}

export function priceBlock(input: BlockInput, r: BlockResult, p: BlockPrices): PricedBlock {
  const parts: [number, number | undefined][] = [
    [r.blocks, p.block],
    [r.mortarBags, p.mortar],
    groutLine(input, r, p),
    [r.sticks, p.rebar],
    [r.jointLf, p.joint],
  ];
  const priced = parts.filter(([qty, price]) => qty > 0 && price != null);
  const needed = parts.filter(([qty]) => qty > 0);
  const material = priced.length
    ? round2(priced.reduce((s, [q, pr]) => s + q * (pr ?? 0), 0))
    : null;
  const labor = p.labor != null && r.blocksLaid > 0 ? round2(r.blocksLaid * p.labor) : null;
  const total = material == null && labor == null ? null : round2((material ?? 0) + (labor ?? 0));
  return {
    material,
    materialComplete: priced.length === needed.length,
    labor,
    total,
    perSqft: total != null && r.area > 0 ? round2(total / r.area) : null,
  };
}

const ft = (n: number) => Number(n.toFixed(2)).toString();

export function groupLabel(input: BlockInput): string {
  return `Block wall · ${ft(input.length)} × ${ft(input.height)} ft, ${input.width} in CMU`;
}

export function groutDesc(input: BlockInput, r: BlockResult): string {
  return r.grout === 'full' ? 'fully grouted' : `cells at ${input.spacing} in o.c.`;
}

const ORDINAL: Record<JointEvery, string> = {
  '0': '',
  '1': 'every course',
  '2': 'every other course',
  '3': 'every third course',
};

export function jointDesc(input: BlockInput): string {
  return ORDINAL[input.joint];
}

/** Estimate lines for the tray, priced only where the contractor gave a price. */
export function estimateLines(input: BlockInput, r: BlockResult, p: BlockPrices): NewLine[] {
  const lines: NewLine[] = [];
  const add = (desc: string, qty: number, unit: string, price: number | null) => {
    if (qty > 0) lines.push({ tool: TOOL, desc, qty, unit, price });
  };
  add(`${input.width} in CMU, 8 × 16 face`, r.blocks, 'blocks', p.block ?? null);
  add(`Mortar, ${MORTAR_BAGS[input.bag].label}`, r.mortarBags, 'bags', p.mortar ?? null);
  if (input.groutBy === 'bag')
    add(`Grout, 80 lb bags, ${groutDesc(input, r)}`, r.groutBags, 'bags', p.groutBag ?? null);
  else add(`Grout, ${groutDesc(input, r)}`, r.groutOrderCuyd, 'cu yd', p.groutYd ?? null);
  add(
    `#${input.bar} rebar, ${input.stick} ft sticks: ${r.bars} bars × ${ft(input.height)} ft`,
    r.sticks,
    'sticks',
    p.rebar ?? null
  );
  add(`Joint reinforcement, ${jointDesc(input)}`, r.jointLf, 'LF', p.joint ?? null);
  add(`Labor: lay ${input.width} in block`, r.blocksLaid, 'blocks', p.labor ?? null);
  return lines;
}

/** Inputs ↔ query string, so a result can be shared or reloaded. */
export const PARAM_KEYS = [
  'l',
  'h',
  'o',
  'w',
  'wst',
  'g',
  'sp',
  'bar',
  'st',
  'jr',
  'bag',
  'mb',
  'gb',
] as const;

export function toParams(i: BlockInput): Record<string, string> {
  const out: Record<string, string> = {
    l: String(i.length),
    h: String(i.height),
    o: String(i.openings),
    w: i.width,
    wst: String(i.waste),
    g: i.grout,
    sp: String(i.spacing),
    bar: i.bar,
    st: i.stick,
    jr: i.joint,
    bag: i.bag,
    gb: i.groutBy,
  };
  if (i.mortarRate != null) out.mb = String(i.mortarRate);
  return out;
}

const pick = <T extends string>(v: string | undefined, options: readonly T[], fallback: T): T =>
  v != null && (options as readonly string[]).includes(v) ? (v as T) : fallback;

export function fromParams(q: Record<string, string>): BlockInput {
  const d = DEFAULT_INPUT;
  const clampDim = (v: string | undefined, fallback: number) => Math.min(nonNeg(v, fallback), 500);
  const spacing = Number(q.sp);
  const rate = parseNum(q.mb);
  return {
    length: clampDim(q.l, d.length),
    height: Math.min(nonNeg(q.h, d.height), 60),
    openings: Math.min(nonNeg(q.o, d.openings), 30000),
    width: pick(q.w, WIDTHS, d.width),
    waste: Math.min(nonNeg(q.wst, d.waste), 40),
    grout: pick(q.g, Object.keys(GROUTS) as Grout[], d.grout),
    spacing: (SPACINGS as readonly number[]).includes(spacing) ? spacing : d.spacing,
    bar: pick(q.bar, BARS, d.bar),
    stick: pick(q.st, STICKS, d.stick),
    joint: pick(q.jr, Object.keys(JOINT_EVERY) as JointEvery[], d.joint),
    bag: pick(q.bag, Object.keys(MORTAR_BAGS) as MortarBag[], d.bag),
    mortarRate: rate != null && rate > 0 ? Math.min(rate, 200) : null,
    groutBy: pick(q.gb, Object.keys(GROUT_BY) as GroutBy[], d.groutBy),
  };
}
