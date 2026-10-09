// Rebar takeoff for one rectangular slab or mat: bars each way, cut lengths,
// lap splices, sticks to buy, weight and chairs, then an optional price from
// the contractor's own unit prices. Pure functions only; the page controller
// and the Playwright spec both import them, so the numbers on the page and in
// the tests come from one place.
//
// The grid math is the same as the Slab Takeoff sheet of the concrete estimate
// template (scripts/templates/templates/concrete-estimate.mjs), with its
// defaults: 3 in edge clearance, 20 ft sticks, a 24 in lap on #4 bar and one
// chair per 3 × 3 ft. Bars each way = ROUNDUP(clear span ÷ spacing) + 1, and a
// run longer than one stick takes MAX(1, ROUNDUP((span − lap) ÷ (stick − lap)))
// pieces with a lap at every splice. So the template's 44 × 20 ft driveway
// (#4 at 24 in each way) is 11 + 23 bars, 971 LF and 51 sticks here too.
//
// Sticks are counted from a cut list instead of LF ÷ stick length: steel comes
// in whole sticks, and a 19 ft 6 in bar takes a whole 20 ft stick. The template
// counts per slab without reusing offcuts across directions, so on some slabs
// it can run a stick above the nesting here.
//
// Sources:
//   ASTM A615/A615M, Table 1: nominal weight (lb/ft) and nominal diameter of
//     deformed bars #3 to #8.
//   CRSI, Lap Splices: under ACI 318 the engineer shows the location and length
//     of every lap splice on the structural drawings, and the length depends on
//     concrete strength, bar grade, size and spacing. ACI 318-19 Table 25.5.2.1
//     sets tension laps at 1.0 or 1.3 × the development length (Class A or B).
//     So the lap is an input in bar diameters; the 48-diameter default is the
//     template's 24 in on #4 bar, not a code value.
//   Chair spacing has no single published figure for slabs on ground (supports
//     only have to hold the steel in place through the pour, 2021 IRC R506.2.4),
//     so it is an input too; the default is the template's 3 × 3 ft.
import { nonNeg, parseNum } from './format';
import { round2, type NewLine } from './estimate';

export const TOOL = 'rebar-calculator';

/** ASTM A615/A615M Table 1 nominal dimensions. */
export const BARS = {
  '3': { label: '#3', diaIn: 0.375, lbPerFt: 0.376 },
  '4': { label: '#4', diaIn: 0.5, lbPerFt: 0.668 },
  '5': { label: '#5', diaIn: 0.625, lbPerFt: 1.043 },
  '6': { label: '#6', diaIn: 0.75, lbPerFt: 1.502 },
  '7': { label: '#7', diaIn: 0.875, lbPerFt: 2.044 },
  '8': { label: '#8', diaIn: 1, lbPerFt: 2.67 },
} as const;
export type BarSize = keyof typeof BARS;
export const BAR_SIZES = Object.keys(BARS) as BarSize[];

export const STOCKS = ['20', '40', '60'] as const;
export type Stock = (typeof STOCKS)[number];

export const LB_PER_TON = 2000;
/** The concrete estimate template's lap: 24 in on #4 bar = 48 bar diameters. */
export const DEFAULT_LAP_DB = 48;
/** The concrete estimate template's chair spacing: 9 sq ft per chair, 3 × 3 ft. */
export const DEFAULT_CHAIR_FT = 3;
/** The concrete estimate template's bar clearance from slab edges. */
export const DEFAULT_COVER_IN = 3;

export type RebarInput = {
  length: number; // ft
  width: number; // ft
  spacingL: number; // in o.c., bars along the length (spaced across the width)
  spacingW: number; // in o.c., bars along the width (spaced along the length)
  cover: number; // in, clearance from the slab edges to the bar ends
  bar: BarSize;
  stock: Stock;
  lapDb: number; // lap splice, in bar diameters
  waste: number; // percent, extra sticks on top of the cut list
  chairFt: number; // chair spacing each way, ft
  topMat: boolean; // a second, identical mat (top and bottom)
};

export const DEFAULT_INPUT: RebarInput = {
  length: 40,
  width: 30,
  spacingL: 12,
  spacingW: 12,
  cover: DEFAULT_COVER_IN,
  bar: '4',
  stock: '20',
  lapDb: DEFAULT_LAP_DB,
  waste: 0,
  chairFt: DEFAULT_CHAIR_FT,
  topMat: false,
};

export type RebarPrices = {
  steel?: number; // per stick, or per ton when steelPerTon
  steelPerTon?: boolean;
  chair?: number; // each
  labor?: number; // per ton placed, or per sq ft of slab when laborPerSqft
  laborPerSqft?: boolean;
};

const EPS = 1e-9;
const up = (n: number) => Math.ceil(n - EPS);

/** One bar line: how many stick pieces it takes, the steel in it and its last piece, in inches. */
export type Run = { pieces: number; laps: number; steelIn: number; endIn: number };

/**
 * A run of clear span `spanIn` cut from `stockIn` sticks with `lapIn` laps: the
 * template's MAX(1, ROUNDUP((span − lap) ÷ (stick − lap))) pieces, every piece but
 * the last a full stick. The last piece is always longer than the lap.
 */
export function lappedRun(spanIn: number, stockIn: number, lapIn: number): Run {
  if (spanIn <= 0) return { pieces: 0, laps: 0, steelIn: 0, endIn: 0 };
  const pieces = Math.max(1, up((spanIn - lapIn) / (stockIn - lapIn)));
  const steelIn = spanIn + (pieces - 1) * lapIn;
  return { pieces, laps: pieces - 1, steelIn, endIn: steelIn - (pieces - 1) * stockIn };
}

/**
 * Sticks needed to cut a set of pieces, each no longer than a stick: first fit,
 * longest pieces first, so short pieces go into the offcuts of long ones where
 * they fit. Bins with the same offcut are kept as one group, so a big slab
 * stays fast.
 */
export function nestPieces(pieces: { lenIn: number; qty: number }[], stockIn: number): number {
  const bins: { rem: number; n: number }[] = [];
  const sorted = pieces.filter((p) => p.qty > 0 && p.lenIn > 0).sort((a, b) => b.lenIn - a.lenIn);
  for (const { lenIn, qty } of sorted) {
    let left = qty;
    for (let i = 0; i < bins.length && left > 0; i++) {
      const bin = bins[i];
      const fit = Math.floor((bin.rem + EPS) / lenIn);
      if (fit <= 0) continue;
      if (left >= fit * bin.n) {
        bin.rem -= fit * lenIn;
        left -= fit * bin.n;
        continue;
      }
      const full = Math.floor(left / fit);
      const extra = left - full * fit;
      const split = [
        { rem: bin.rem - fit * lenIn, n: full },
        { rem: bin.rem - extra * lenIn, n: extra > 0 ? 1 : 0 },
        { rem: bin.rem, n: bin.n - full - (extra > 0 ? 1 : 0) },
      ].filter((b) => b.n > 0);
      bins.splice(i, 1, ...split);
      left = 0;
    }
    if (left > 0) {
      const per = Math.floor((stockIn + EPS) / lenIn);
      const full = Math.floor(left / per);
      const extra = left - full * per;
      if (full > 0) bins.push({ rem: stockIn - per * lenIn, n: full });
      if (extra > 0) bins.push({ rem: stockIn - extra * lenIn, n: 1 });
    }
  }
  return bins.reduce((s, b) => s + b.n, 0);
}

export function lapInches(bar: BarSize, lapDb: number): number {
  return BARS[bar].diaIn * lapDb;
}

export type RebarResult = {
  mats: number;
  area: number; // sq ft of slab
  spanLIn: number; // clear span of the bars along the length
  spanWIn: number;
  barsL: number; // per mat
  barsW: number; // per mat
  runL: Run;
  runW: Run;
  lapIn: number;
  bars: number; // all mats
  barLf: number; // bar length without laps, all mats
  laps: number; // all mats
  lapLf: number;
  lf: number; // steel incl. laps, all mats
  fullSticks: number;
  sticksNet: number; // cut list, before waste
  sticks: number; // to buy, with waste
  sticksOfSteel: number; // lf ÷ stick length, for comparison
  lbPlaced: number;
  tonsPlaced: number;
  lbBought: number;
  tonsBought: number;
  chairs: number;
};

export function computeRebar(input: RebarInput): RebarResult {
  const bar = BARS[input.bar];
  const mats = input.topMat ? 2 : 1;
  const stockIn = Number(input.stock) * 12;
  const lapIn = lapInches(input.bar, input.lapDb);
  const spanLIn = input.length * 12 - 2 * input.cover;
  const spanWIn = input.width * 12 - 2 * input.cover;
  const grid = spanLIn > 0 && spanWIn > 0;
  // Bars along the length are spaced across the width, and vice versa.
  const barsL = grid ? up(spanWIn / input.spacingL) + 1 : 0;
  const barsW = grid ? up(spanLIn / input.spacingW) + 1 : 0;
  const runL = lappedRun(grid ? spanLIn : 0, stockIn, lapIn);
  const runW = lappedRun(grid ? spanWIn : 0, stockIn, lapIn);
  const nL = barsL * mats;
  const nW = barsW * mats;

  const lf = (nL * runL.steelIn + nW * runW.steelIn) / 12;
  const laps = nL * runL.laps + nW * runW.laps;
  const fullSticks = nL * Math.max(0, runL.pieces - 1) + nW * Math.max(0, runW.pieces - 1);
  const sticksNet =
    fullSticks +
    nestPieces(
      [
        { lenIn: runL.endIn, qty: nL },
        { lenIn: runW.endIn, qty: nW },
      ],
      stockIn
    );
  const sticks = sticksNet > 0 ? up(sticksNet * (1 + Math.max(0, input.waste) / 100)) : 0;
  const lbPlaced = lf * bar.lbPerFt;
  const lbBought = sticks * Number(input.stock) * bar.lbPerFt;
  const area = input.length * input.width;
  const chairFt = input.chairFt > 0 ? input.chairFt : DEFAULT_CHAIR_FT;
  return {
    mats,
    area,
    spanLIn,
    spanWIn,
    barsL,
    barsW,
    runL,
    runW,
    lapIn,
    bars: nL + nW,
    barLf: grid ? (nL * spanLIn + nW * spanWIn) / 12 : 0,
    laps,
    lapLf: (laps * lapIn) / 12,
    lf,
    fullSticks,
    sticksNet,
    sticks,
    sticksOfSteel: lf / Number(input.stock),
    lbPlaced,
    tonsPlaced: lbPlaced / LB_PER_TON,
    lbBought,
    tonsBought: lbBought / LB_PER_TON,
    chairs: grid ? up(area / (chairFt * chairFt)) * mats : 0,
  };
}

/** Weight of one stick, lb. */
export function stickWeight(bar: BarSize, stock: Stock): number {
  return BARS[bar].lbPerFt * Number(stock);
}

/** Linear feet of a bar size in one ton. */
export function feetPerTon(bar: BarSize): number {
  return LB_PER_TON / BARS[bar].lbPerFt;
}

export type PricedRebar = {
  material: number | null;
  materialComplete: boolean;
  labor: number | null;
  total: number | null;
  perSqft: number | null;
};

/** The steel line as it goes on the estimate: sticks at a stick price, or pounds at the ton price ÷ 2,000. */
function steelLine(r: RebarResult, p: RebarPrices): [number, number | null] {
  if (p.steelPerTon) return [round2(r.lbBought), p.steel != null ? p.steel / LB_PER_TON : null];
  return [r.sticks, p.steel ?? null];
}

function laborLine(r: RebarResult, p: RebarPrices): [number, number | null] {
  if (p.laborPerSqft) return [round2(r.area), p.labor ?? null];
  return [round2(r.lbPlaced), p.labor != null ? p.labor / LB_PER_TON : null];
}

export function priceRebar(r: RebarResult, p: RebarPrices): PricedRebar {
  const parts: [number, number | null][] = [steelLine(r, p), [r.chairs, p.chair ?? null]];
  const priced = parts.filter(([qty, price]) => qty > 0 && price != null);
  const needed = parts.filter(([qty]) => qty > 0);
  const material = priced.length
    ? round2(priced.reduce((s, [q, pr]) => s + q * (pr ?? 0), 0))
    : null;
  const [laborQty, laborPrice] = laborLine(r, p);
  const labor =
    laborPrice != null && laborQty > 0 && r.bars > 0 ? round2(laborQty * laborPrice) : null;
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

/** Bar lengths to the nearest inch: 474 → "39 ft 6 in", 240 → "20 ft", 8 → "8 in". */
export function fmtFtIn(inches: number): string {
  const total = Math.round(Math.max(0, inches));
  const feet = Math.floor(total / 12);
  const rest = total - feet * 12;
  if (!feet) return `${rest} in`;
  return rest ? `${feet} ft ${rest} in` : `${feet} ft`;
}

export function spacingLabel(input: RebarInput): string {
  return input.spacingL === input.spacingW
    ? `${ft(input.spacingL)} in`
    : `${ft(input.spacingL)} / ${ft(input.spacingW)} in`;
}

export function groupLabel(input: RebarInput): string {
  const mats = input.topMat ? ', top and bottom' : '';
  return `Rebar · ${ft(input.length)} × ${ft(input.width)} ft slab, #${input.bar} @ ${spacingLabel(input)}${mats}`;
}

/** Estimate lines for the tray, priced only where the contractor gave a price. */
export function estimateLines(input: RebarInput, r: RebarResult, p: RebarPrices): NewLine[] {
  const lines: NewLine[] = [];
  const add = (desc: string, qty: number, unit: string, price: number | null) => {
    if (qty > 0) lines.push({ tool: TOOL, desc, qty, unit, price });
  };
  const bar = `#${input.bar} rebar`;
  const lf = Math.round(r.lf).toLocaleString('en-US');
  const [steelQty, steelPrice] = steelLine(r, p);
  if (p.steelPerTon)
    add(
      `${bar}, ${r.sticks} sticks of ${input.stock} ft, ${lf} LF incl. laps, by weight`,
      steelQty,
      'lb',
      steelPrice
    );
  else add(`${bar}, ${input.stock} ft sticks, ${lf} LF incl. laps`, steelQty, 'sticks', steelPrice);
  add(
    `Chairs, ${ft(input.chairFt)} ft o.c. each way${input.topMat ? ', both mats' : ''}`,
    r.chairs,
    'ea',
    p.chair ?? null
  );
  if (r.bars > 0) {
    const [laborQty, laborPrice] = laborLine(r, p);
    add(
      p.laborPerSqft
        ? `Labor: place and tie ${bar}, per sq ft of slab`
        : `Labor: place and tie ${bar}, by weight placed`,
      laborQty,
      p.laborPerSqft ? 'sq ft' : 'lb',
      laborPrice
    );
  }
  return lines;
}

/** Inputs ↔ query string, so a result can be shared or reloaded. */
export const PARAM_KEYS = [
  'l',
  'w',
  'sl',
  'sw',
  'cv',
  'bar',
  'st',
  'lap',
  'wst',
  'ch',
  'top',
] as const;

export function toParams(i: RebarInput): Record<string, string> {
  return {
    l: String(i.length),
    w: String(i.width),
    sl: String(i.spacingL),
    sw: String(i.spacingW),
    cv: String(i.cover),
    bar: i.bar,
    st: i.stock,
    lap: String(i.lapDb),
    wst: String(i.waste),
    ch: String(i.chairFt),
    top: i.topMat ? '1' : '0',
  };
}

const pick = <T extends string>(v: string | undefined, options: readonly T[], fallback: T): T =>
  v != null && (options as readonly string[]).includes(v) ? (v as T) : fallback;

/** A positive number clamped to [min, max], or the fallback when blank, zero or invalid. */
function positive(v: string | undefined, fallback: number, min: number, max: number): number {
  const n = parseNum(v);
  if (n == null || n <= 0) return fallback;
  return Math.min(Math.max(n, min), max);
}

export function fromParams(q: Record<string, string>): RebarInput {
  const d = DEFAULT_INPUT;
  const clampDim = (v: string | undefined, fallback: number) => Math.min(nonNeg(v, fallback), 500);
  return {
    length: clampDim(q.l, d.length),
    width: clampDim(q.w, d.width),
    spacingL: positive(q.sl, d.spacingL, 3, 48),
    spacingW: positive(q.sw, d.spacingW, 3, 48),
    cover: Math.min(nonNeg(q.cv, d.cover), 12),
    bar: pick(q.bar, BAR_SIZES, d.bar),
    stock: pick(q.st, STOCKS, d.stock),
    lapDb: Math.min(nonNeg(q.lap, d.lapDb), 100),
    waste: Math.min(nonNeg(q.wst, d.waste), 40),
    chairFt: positive(q.ch, d.chairFt, 1, 8),
    topMat: q.top == null ? d.topMat : q.top === '1',
  };
}
