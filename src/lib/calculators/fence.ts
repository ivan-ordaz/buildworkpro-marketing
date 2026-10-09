// Wood picket fence takeoff for one straight run: fenced length, sections,
// posts, post length, rails, pickets and bags of concrete, then an optional
// price from the contractor's own unit prices. Pure functions only; the page
// controller and the Playwright spec both import them, so the numbers on the
// page and in the tests come from one place.
//
// Counting rules follow the Outdoor Essentials (UFP Industries) fence
// calculator info sheet, 10713_1/19
// (https://pdf.lowes.com/productdocuments/d27b01be-ea65-4de6-aa9c-7a485c4bab31/43237730.pdf):
//   sections = fence length ÷ post spacing (6 or 8 ft), rounded up
//   posts    = 1 per section + 1 to end the run + 1 per gate
//   pickets  = fence length in inches ÷ (actual picket width + spacing),
//              "increasing this number by 10% is recommended"
//   backer rails = 2 per section for a 4 ft fence, 3 for a 6 ft fence
// Lumber sizes are the standard dressed sizes in AWC's NDS Supplement (2018),
// Table 1B: 1×6 = ¾ × 5½ in, 4×4 = 3½ × 3½ in, 6×6 = 5½ × 5½ in
// (https://awc.org/wp-content/uploads/2021/10/AWC_NDS2018-Supplement_20200827_AWCWebsite_Chapter03.pdf).
import { nonNeg } from './format';
import { round2, type NewLine } from './estimate';

export const TOOL = 'fence-calculator';

export const HEIGHTS = ['4', '5', '6', '8'] as const;
export type Height = (typeof HEIGHTS)[number];

// Rail stock per spacing. 8 ft on center takes one 8 ft rail per section. At
// 6 ft on center a 12 ft rail spans two sections; lumber comes in 2 ft
// multiples (Natural Resources Canada, "Dimension lumber":
// https://natural-resources.canada.ca/forests-forestry/forest-industry-trade/dimension-lumber).
export const SPACINGS = {
  '6': { label: '6 ft on center', ft: 6, railFt: 12 },
  '8': { label: '8 ft on center', ft: 8, railFt: 8 },
} as const;
export type Spacing = keyof typeof SPACINGS;

/** Actual (dressed) post width in inches, AWC NDS Supplement Table 1B. */
export const POSTS = {
  '4x4': { label: '4×4', actualIn: 3.5 },
  '6x6': { label: '6×6', actualIn: 5.5 },
} as const;
export type PostSize = keyof typeof POSTS;

// Approximate yield per bag, QUIKRETE Concrete Mix (No. 1101) data sheet:
// 40 lb ≈ 0.30 ft³, 60 lb ≈ 0.45 ft³, 80 lb ≈ 0.60 ft³
// (https://www.quikrete.com/PDFs/DATA_SHEET-Concrete%20Mix%201101.pdf).
export const BAGS = {
  '40': { label: '40 lb', cuFt: 0.3 },
  '60': { label: '60 lb', cuFt: 0.45 },
  '80': { label: '80 lb', cuFt: 0.6 },
} as const;
export type BagSize = keyof typeof BAGS;

export const RAILS = ['auto', '2', '3', '4'] as const;
export type RailsChoice = (typeof RAILS)[number];

/** Outdoor Essentials' recommended picket overage, used as the default waste. */
export const PICKET_WASTE_PCT = 10;
/** 1×6 picket, actual width (AWC NDS Supplement Table 1B). */
export const PICKET_1X6_IN = 5.5;
// QUIKRETE "Setting Posts" guidance
// (https://www.quikrete.com/AtHome/Video-Setting-Posts.asp): hole diameter
// 3 times the width of the post; depth 1/3 to 1/2 the post height above ground.
export const HOLE_DIA_PER_POST_WIDTH = 3;
export const DEPTH_MIN_FRACTION = 1 / 3;
export const DEPTH_MAX_FRACTION = 1 / 2;
const CU_IN_PER_CU_FT = 1728;
const MIN_POST_FT = 6;

/**
 * Rails per section by fence height. 2 at 4 ft and 3 at 6 ft are from the
 * Outdoor Essentials sheet; 3 at 5 ft and 4 at 8 ft extend the same spacing
 * and are shown as "typical" on the page, with the count editable.
 */
export function typicalRails(heightFt: number): number {
  if (heightFt <= 4) return 2;
  if (heightFt <= 6) return 3;
  return 4;
}

export type FenceInput = {
  run: number; // ft
  height: Height;
  spacing: Spacing;
  gates: number;
  gateWidth: number; // ft
  picketWidth: number; // in
  gap: number; // in
  rails: RailsChoice;
  post: PostSize;
  holeDia: number; // in
  holeDepth: number; // in
  bag: BagSize;
  waste: number; // percent, pickets
};

export const DEFAULT_INPUT: FenceInput = {
  run: 120,
  height: '6',
  spacing: '8',
  gates: 1,
  gateWidth: 4,
  picketWidth: PICKET_1X6_IN,
  gap: 0,
  rails: 'auto',
  post: '4x4',
  holeDia: 10,
  holeDepth: 24,
  bag: '80',
  waste: PICKET_WASTE_PCT,
};

export type FencePrices = {
  post?: number; // each
  rail?: number; // each
  picket?: number; // each
  bag?: number; // per bag of concrete
  gate?: number; // each, complete gate or kit
  labor?: number; // per linear foot of fence
};

export type FenceResult = {
  gates: number;
  openings: number;
  fenced: number;
  sections: number;
  lastSection: number;
  posts: number;
  postNeedFt: number;
  postLengthFt: number;
  railsPerSection: number;
  railFt: number;
  rails: number;
  picketsNet: number;
  pickets: number;
  concretePerPost: number; // cu ft
  bagsPerPost: number;
  concrete: number; // cu ft
  bags: number;
};

const up = (n: number) => Math.ceil(n - 1e-9);

export function sectionsFor(lengthFt: number, spacingFt: number): number {
  return lengthFt > 0 && spacingFt > 0 ? up(lengthFt / spacingFt) : 0;
}

/** One post per section, one to end the run, one per gate. */
export function postsFor(fencedFt: number, spacingFt: number, gates: number): number {
  const sections = sectionsFor(fencedFt, spacingFt);
  return sections === 0 && gates === 0 ? 0 : sections + gates + 1;
}

/** Pickets for a length of fence, before waste. */
export function picketsFor(lengthFt: number, widthIn: number, gapIn: number): number {
  const module = widthIn + gapIn;
  return lengthFt > 0 && module > 0 ? up((lengthFt * 12) / module) : 0;
}

/** Concrete around one post, cu ft: the hole's cylinder less the post. */
export function concretePerPost(diaIn: number, depthIn: number, postIn: number): number {
  const hole = Math.PI * (diaIn / 2) ** 2 * depthIn;
  const post = postIn * postIn * depthIn;
  return Math.max(0, hole - post) / CU_IN_PER_CU_FT;
}

/** Post to buy: height above grade + depth in the ground, up to the next even foot. */
export function postStockFt(needFt: number): number {
  return needFt > 0 ? Math.max(MIN_POST_FT, 2 * up(needFt / 2)) : 0;
}

export function railsPerSection(input: FenceInput): number {
  return input.rails === 'auto' ? typicalRails(Number(input.height)) : Number(input.rails);
}

export function computeFence(input: FenceInput): FenceResult {
  const spacing = SPACINGS[input.spacing];
  const height = Number(input.height);
  const run = Math.max(0, input.run);
  const gates = run > 0 ? Math.max(0, Math.round(input.gates)) : 0;
  const openings = Math.min(run, gates * Math.max(0, input.gateWidth));
  const fenced = run - openings;
  const sections = sectionsFor(fenced, spacing.ft);
  const posts = postsFor(fenced, spacing.ft, gates);
  const perRail = railsPerSection(input);
  const sectionsPerRail = spacing.railFt / spacing.ft;
  const picketsNet = picketsFor(fenced, input.picketWidth, input.gap);
  const postNeedFt = posts > 0 ? height + input.holeDepth / 12 : 0;
  const perPost = concretePerPost(input.holeDia, input.holeDepth, POSTS[input.post].actualIn);
  const concrete = posts * perPost;
  const bagFt = BAGS[input.bag].cuFt;
  return {
    gates,
    openings,
    fenced,
    sections,
    lastSection: sections > 0 ? fenced - (sections - 1) * spacing.ft : 0,
    posts,
    postNeedFt,
    postLengthFt: postStockFt(postNeedFt),
    railsPerSection: perRail,
    railFt: spacing.railFt,
    rails: sections > 0 ? up((sections * perRail) / sectionsPerRail) : 0,
    picketsNet,
    pickets: picketsNet > 0 ? up(picketsNet * (1 + Math.max(0, input.waste) / 100)) : 0,
    concretePerPost: perPost,
    bagsPerPost: perPost / bagFt,
    concrete,
    bags: concrete > 0 ? up(concrete / bagFt) : 0,
  };
}

export type PricedFence = {
  material: number | null;
  gates: number | null;
  complete: boolean;
  labor: number | null;
  total: number | null;
  perFoot: number | null;
};

export function priceFence(input: FenceInput, r: FenceResult, p: FencePrices): PricedFence {
  const parts: [number, number | undefined][] = [
    [r.posts, p.post],
    [r.rails, p.rail],
    [r.pickets, p.picket],
    [r.bags, p.bag],
  ];
  const priced = parts.filter(([qty, price]) => qty > 0 && price != null);
  const needed = parts.filter(([qty]) => qty > 0);
  const material = priced.length
    ? round2(priced.reduce((s, [q, pr]) => s + q * (pr ?? 0), 0))
    : null;
  const gates = r.gates > 0 && p.gate != null ? round2(r.gates * p.gate) : null;
  const labor = p.labor != null && r.fenced > 0 ? round2(r.fenced * p.labor) : null;
  const total =
    material == null && gates == null && labor == null
      ? null
      : round2((material ?? 0) + (gates ?? 0) + (labor ?? 0));
  return {
    material,
    gates,
    complete: priced.length === needed.length && (r.gates === 0 || p.gate != null),
    labor,
    total,
    perFoot: total != null && input.run > 0 ? round2(total / input.run) : null,
  };
}

const num = (n: number) => Number(n.toFixed(2)).toString();

export function groupLabel(input: FenceInput): string {
  const style = input.gap > 0 ? 'spaced picket' : 'privacy';
  return `Fence · ${num(input.run)} ft run, ${input.height} ft ${style}`;
}

/** Estimate lines for the tray, priced only where the contractor gave a price. */
export function estimateLines(input: FenceInput, r: FenceResult, p: FencePrices): NewLine[] {
  const lines: NewLine[] = [];
  const add = (desc: string, qty: number, unit: string, price: number | undefined) => {
    if (qty > 0) lines.push({ tool: TOOL, desc, qty, unit, price: price ?? null });
  };
  add(`${POSTS[input.post].label} posts, ${r.postLengthFt} ft`, r.posts, 'ea', p.post);
  add(`2×4 rails, ${r.railFt} ft`, r.rails, 'ea', p.rail);
  add(`Pickets, ${num(input.picketWidth)} in × ${input.height} ft`, r.pickets, 'ea', p.picket);
  add(`Concrete mix, ${BAGS[input.bag].label} bags`, r.bags, 'bags', p.bag);
  add(`Gate, ${num(input.gateWidth)} ft (complete or kit)`, r.gates, 'ea', p.gate);
  add(`Labor: build ${input.height} ft fence`, round2(r.fenced), 'LF', p.labor);
  return lines;
}

/** Inputs ↔ query string, so a result can be shared or reloaded. */
export const PARAM_KEYS = [
  'len',
  'h',
  'sp',
  'g',
  'gw',
  'pw',
  'gap',
  'r',
  'post',
  'hd',
  'dp',
  'bag',
  'wst',
] as const;

export function toParams(i: FenceInput): Record<string, string> {
  return {
    len: String(i.run),
    h: i.height,
    sp: i.spacing,
    g: String(i.gates),
    gw: String(i.gateWidth),
    pw: String(i.picketWidth),
    gap: String(i.gap),
    r: i.rails,
    post: i.post,
    hd: String(i.holeDia),
    dp: String(i.holeDepth),
    bag: i.bag,
    wst: String(i.waste),
  };
}

const pick = <T extends string>(options: readonly T[], v: string | undefined, d: T): T =>
  (options as readonly string[]).includes(v ?? '') ? (v as T) : d;

export function fromParams(q: Record<string, string>): FenceInput {
  const d = DEFAULT_INPUT;
  const cap = (v: string | undefined, fallback: number, max: number) =>
    Math.min(nonNeg(v, fallback), max);
  const pw = nonNeg(q.pw, d.picketWidth);
  return {
    run: cap(q.len, d.run, 2000),
    height: pick(HEIGHTS, q.h, d.height),
    spacing: pick(Object.keys(SPACINGS) as Spacing[], q.sp, d.spacing),
    gates: Math.round(cap(q.g, d.gates, 20)),
    gateWidth: cap(q.gw, d.gateWidth, 20),
    picketWidth: pw > 0 ? Math.min(Math.max(pw, 1), 12) : d.picketWidth,
    gap: cap(q.gap, d.gap, 12),
    rails: pick(RAILS, q.r, d.rails),
    post: pick(Object.keys(POSTS) as PostSize[], q.post, d.post),
    holeDia: cap(q.hd, d.holeDia, 36),
    holeDepth: cap(q.dp, d.holeDepth, 72),
    bag: pick(Object.keys(BAGS) as BagSize[], q.bag, d.bag),
    waste: cap(q.wst, d.waste, 40),
  };
}
