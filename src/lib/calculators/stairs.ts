// Stair stringer layout for one straight flight of residential stairs: risers,
// treads, total run, stringer length and the board to buy, the stair angle, how
// many stringers the width takes, the drop at the bottom of the stringer and an
// IRC rise-and-run check. Pure functions only; the page controller and the
// Playwright spec both import them, so the numbers on the page and in the tests
// come from one place.
//
// Code limits are from the 2021 IRC (Section R311.7). The 2024 IRC moved all of
// R311 to R318 and the handrail rules to R320 without changing these values
// (ICC 2024 IRC relocation table; NAHB "2024 Significant Code Changes for the IRC").
// Stringer spacing and throat depth are from the American Wood Council's DCA 6
// Prescriptive Residential Wood Deck Construction Guide (2015), Figures 28 and 29.
// The IRC itself sets no stringer size or spacing.
import { nonNeg } from './format';
import { round2, type NewLine } from './estimate';

export const TOOL = 'stair-stringer-calculator';

/** IRC stair limits, in inches. */
export const IRC = {
  maxRiser: 7.75, // R311.7.5.1 (2024 IRC R318.7.5.1)
  minTread: 10, // R311.7.5.2 (2024 IRC R318.7.5.2)
  maxVariation: 0.375, // R311.7.5.1 and R311.7.5.2: greatest minus smallest in a flight
  minWidth: 36, // R311.7.1 (2024 IRC R318.7.1)
  headroom: 80, // R311.7.2 (2024 IRC R318.7.2): 6 ft 8 in
  maxFlightRise: 151, // R311.7.3 (2024 IRC R318.7.3): 12 ft 7 in between floors or landings
  handrailRisers: 4, // R311.7.8 (2024 IRC R320): handrail on one side at 4 or more risers
  openRiserRise: 30, // R311.7.5.1: open-riser openings limited above 30 in
  openRiserSphere: 4, // R311.7.5.1: 4 in sphere
} as const;

/** AWC DCA 6 (2015) deck-stair figures, in inches. */
export const DCA6 = {
  maxSpacing: 18, // Figure 29: cut stringers 18" max under 2x or 5/4 treads
  minThroat: 5, // Figure 28: 5" min wood left below the notches of a cut stringer
  maxCutSpan: 72, // Figure 28: cut stringer max horizontal span 6'-0" between supports
} as const;

/** Dressed sizes of 2x lumber (American Softwood Lumber Standard PS 20). */
export const STOCK = {
  '2x10': { label: '2 × 10', depth: 9.25 },
  '2x12': { label: '2 × 12', depth: 11.25 },
} as const;
export type Stock = keyof typeof STOCK;
export const STOCK_THICKNESS = 1.5;

/** Standard dimension lumber lengths, 8 to 20 ft in 2 ft steps (SFPA specification guidelines). */
export const BOARD_LENGTHS_FT = [8, 10, 12, 14, 16, 18, 20] as const;

export type StairInput = {
  rise: number; // total rise, in, finished floor to finished floor
  maxRiser: number; // in
  tread: number; // tread depth (unit run), in
  thickness: number; // tread thickness, in
  width: number; // stair width, in, outside to outside of the outer stringers
  stock: Stock;
  spacing: number; // max stringer spacing on center, in
  extra: number; // extra board length for trimming, in
  closed: boolean; // riser boards on every step
};

export const DEFAULT_INPUT: StairInput = {
  rise: 108,
  maxRiser: IRC.maxRiser,
  tread: IRC.minTread,
  thickness: 1.5,
  width: 36,
  stock: '2x12',
  spacing: DCA6.maxSpacing,
  extra: 12,
  closed: true,
};

export type StairPrices = {
  stringer?: number; // per stringer board
  tread?: number; // per tread
  riser?: number; // per riser board
  labor?: number; // per step, or for the whole stair when laborLump is set
  laborLump?: boolean;
};

export type StairResult = {
  risers: number;
  riserHeight: number;
  treads: number;
  totalRun: number;
  /** Hypotenuse of total run and total rise, in. */
  stringerLength: number;
  /** Stringer length plus the extra allowance, in. */
  boardNeeded: number;
  /** Next standard length in feet; null when no stringer or longer than 20 ft. */
  boardFt: number | null;
  tooLong: boolean;
  angle: number; // degrees
  stringers: number;
  drop: number;
  /** Wood left between the notches and the bottom edge of a cut stringer, in. */
  throat: number;
  /** First and top step heights if the stringer is not dropped, in. */
  firstStepUndropped: number;
  topStepUndropped: number;
};

const EPS = 1e-9;

/** Stringers spread across the width, outer two at the edges, no gap wider than `spacing` on center. */
export function stringerCount(width: number, spacing: number): number {
  if (width <= 0 || spacing <= 0) return 0;
  const span = Math.max(0, width - STOCK_THICKNESS);
  return Math.max(2, Math.ceil(span / spacing - EPS) + 1);
}

/** Wood left below the notches: board depth less the rise × run triangle's height. */
export function throatDepth(depth: number, riser: number, tread: number): number {
  if (riser <= 0 || tread <= 0) return depth;
  return depth - (riser * tread) / Math.hypot(riser, tread);
}

export function stairAngle(riser: number, tread: number): number {
  return riser > 0 && tread > 0 ? (Math.atan(riser / tread) * 180) / Math.PI : 0;
}

export function computeStairs(input: StairInput): StairResult {
  const risers = input.rise > 0 ? Math.ceil(input.rise / input.maxRiser - EPS) : 0;
  const riserHeight = risers ? input.rise / risers : 0;
  const treads = Math.max(0, risers - 1);
  const totalRun = treads * input.tread;
  const stringerLength = treads > 0 ? Math.hypot(totalRun, input.rise) : 0;
  const boardNeeded = stringerLength > 0 ? stringerLength + input.extra : 0;
  const fit = BOARD_LENGTHS_FT.find((ft) => ft * 12 >= boardNeeded - EPS);
  const tooLong = boardNeeded > 0 && fit == null;
  return {
    risers,
    riserHeight,
    treads,
    totalRun,
    stringerLength,
    boardNeeded,
    boardFt: boardNeeded > 0 && fit != null ? fit : null,
    tooLong,
    angle: stairAngle(riserHeight, input.tread),
    stringers: treads > 0 ? stringerCount(input.width, input.spacing) : 0,
    drop: input.thickness,
    throat: throatDepth(STOCK[input.stock].depth, riserHeight, input.tread),
    firstStepUndropped: riserHeight + input.thickness,
    topStepUndropped: Math.max(0, riserHeight - input.thickness),
  };
}

// Feet-inches with fractions to the nearest 1/16 in, the way a tape reads.
function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a;
}

/** 7.714 → "7 11/16 in", 0.5 → "1/2 in", 36 → "36 in". */
export function fmtIn(inches: number): string {
  const sixteenths = Math.round(Math.abs(inches) * 16);
  const whole = Math.floor(sixteenths / 16);
  const rem = sixteenths % 16;
  const g = gcd(rem, 16);
  const frac = rem ? `${rem / g}/${16 / g}` : '';
  const body = whole && frac ? `${whole} ${frac}` : frac || String(whole);
  return `${inches < 0 && sixteenths ? '-' : ''}${body} in`;
}

/** 169.01 → "14 ft 1 in", 130 → "10 ft 10 in", 192 → "16 ft", 9.2 → "9 3/16 in". */
export function fmtFtIn(inches: number): string {
  const sixteenths = Math.round(Math.abs(inches) * 16);
  const feet = Math.floor(sixteenths / 192);
  if (!feet) return fmtIn(inches);
  const rest = sixteenths - feet * 192;
  const sign = inches < 0 ? '-' : '';
  return rest ? `${sign}${feet} ft ${fmtIn(rest / 16)}` : `${sign}${feet} ft`;
}

export function fmtDeg(deg: number): string {
  return `${deg.toFixed(1)}°`;
}

export type CheckStatus = 'pass' | 'fail' | 'info';
export type CheckId =
  | 'riser'
  | 'tread'
  | 'variation'
  | 'width'
  | 'flight'
  | 'headroom'
  | 'handrail'
  | 'open'
  | 'throat';
export type Check = { id: CheckId; status: CheckStatus; detail: string; hidden?: boolean };

/** Each check's label and source: 2021 IRC section, with the 2024 IRC number where it moved. */
export const CHECK_ROWS: { id: CheckId; label: string; source: string }[] = [
  { id: 'riser', label: 'Riser height', source: 'IRC R311.7.5.1 (2024: R318.7.5.1)' },
  { id: 'tread', label: 'Tread depth', source: 'IRC R311.7.5.2 (2024: R318.7.5.2)' },
  { id: 'variation', label: 'Riser and tread variation', source: 'IRC R311.7.5.1, R311.7.5.2' },
  { id: 'width', label: 'Stair width', source: 'IRC R311.7.1 (2024: R318.7.1)' },
  { id: 'flight', label: 'Rise of one flight', source: 'IRC R311.7.3 (2024: R318.7.3)' },
  { id: 'headroom', label: 'Headroom', source: 'IRC R311.7.2 (2024: R318.7.2)' },
  { id: 'handrail', label: 'Handrail', source: 'IRC R311.7.8 (2024: R320)' },
  { id: 'open', label: 'Open risers', source: 'IRC R311.7.5.1 (2024: R318.7.5.1)' },
  { id: 'throat', label: 'Stringer throat', source: 'AWC DCA 6, Figure 28 (deck stairs)' },
];

/** IRC check of the layout, plus the DCA 6 throat depth. */
export function codeChecks(input: StairInput, r: StairResult): Check[] {
  const has = r.risers > 0;
  const flightOk = input.rise <= IRC.maxFlightRise + EPS;
  return [
    {
      id: 'riser',
      status: !has ? 'info' : r.riserHeight <= IRC.maxRiser + EPS ? 'pass' : 'fail',
      detail: has
        ? `${fmtIn(r.riserHeight)} risers, ${fmtIn(IRC.maxRiser)} max.`
        : `${fmtIn(IRC.maxRiser)} max.`,
    },
    {
      id: 'tread',
      status: input.tread >= IRC.minTread - EPS ? 'pass' : 'fail',
      detail: `${fmtIn(input.tread)} treads, ${fmtIn(IRC.minTread)} min, nosing to nosing.`,
    },
    {
      id: 'variation',
      status: has ? 'pass' : 'info',
      detail: `Every rise and run is laid out the same, so the variation is 0 in (${fmtIn(IRC.maxVariation)} max). Cut the drop, and check floor finishes at the bottom and top step.`,
    },
    {
      id: 'width',
      status: input.width >= IRC.minWidth - EPS ? 'pass' : 'fail',
      detail: `${fmtIn(input.width)} wide, ${fmtIn(IRC.minWidth)} min clear above handrail height.`,
    },
    {
      id: 'flight',
      status: flightOk ? 'pass' : 'fail',
      detail: flightOk
        ? `${fmtIn(input.rise)} rise, ${fmtIn(IRC.maxFlightRise)} max between floors or landings.`
        : `${fmtIn(input.rise)} rise is over ${fmtIn(IRC.maxFlightRise)}. Add a landing and split the flight.`,
    },
    {
      id: 'headroom',
      status: 'info',
      detail: `Keep ${fmtFtIn(IRC.headroom)} clear above the nosing line along the whole run.`,
    },
    {
      id: 'handrail',
      status: 'info',
      detail:
        r.risers >= IRC.handrailRisers
          ? `${r.risers} risers: a handrail is required on at least one side (${IRC.handrailRisers} or more risers).`
          : `Under ${IRC.handrailRisers} risers, no handrail is required.`,
    },
    {
      id: 'open',
      status: 'info',
      hidden: input.closed,
      detail:
        input.rise > IRC.openRiserRise
          ? `Openings more than ${IRC.openRiserRise} in above the floor must not pass a ${IRC.openRiserSphere} in sphere.`
          : `With ${IRC.openRiserRise} in of rise or less, the openings are not limited.`,
    },
    {
      id: 'throat',
      status: !has ? 'info' : r.throat >= DCA6.minThroat - EPS ? 'pass' : 'fail',
      detail: `${STOCK[input.stock].label} leaves ${fmtIn(Math.max(0, r.throat))} below the notches, ${fmtIn(DCA6.minThroat)} min for deck stairs.`,
    },
  ];
}

export type PricedStairs = {
  material: number | null;
  materialComplete: boolean;
  labor: number | null;
  total: number | null;
  perStep: number | null;
};

export function priceStairs(input: StairInput, r: StairResult, p: StairPrices): PricedStairs {
  const parts: [number, number | undefined][] = [
    [r.stringers, p.stringer],
    [r.treads, p.tread],
    [input.closed ? r.risers : 0, p.riser],
  ];
  const priced = parts.filter(([qty, price]) => qty > 0 && price != null);
  const needed = parts.filter(([qty]) => qty > 0);
  const material = priced.length
    ? round2(priced.reduce((s, [q, pr]) => s + q * (pr ?? 0), 0))
    : null;
  const labor =
    p.labor != null && r.risers > 0 ? round2(p.laborLump ? p.labor : r.risers * p.labor) : null;
  const total = material == null && labor == null ? null : round2((material ?? 0) + (labor ?? 0));
  return {
    material,
    materialComplete: priced.length === needed.length,
    labor,
    total,
    perStep: total != null && r.risers > 0 ? round2(total / r.risers) : null,
  };
}

const num = (n: number) => Number(n.toFixed(2)).toString();

export function groupLabel(input: StairInput): string {
  return `Stairs · ${num(input.rise)} in rise, ${num(input.width)} in wide`;
}

export function stringerDesc(input: StairInput, r: StairResult): string {
  const stock = STOCK[input.stock].label;
  return r.boardFt != null
    ? `Stringers, ${stock} × ${r.boardFt} ft, cut to ${fmtFtIn(r.stringerLength)}`
    : `Stringers, ${stock} over 20 ft long, cut to ${fmtFtIn(r.stringerLength)}`;
}

/** Estimate lines for the tray, priced only where the contractor gave a price. */
export function estimateLines(input: StairInput, r: StairResult, p: StairPrices): NewLine[] {
  const lines: NewLine[] = [];
  const add = (desc: string, qty: number, unit: string, price: number | null) => {
    if (qty > 0) lines.push({ tool: TOOL, desc, qty, unit, price });
  };
  const wide = fmtIn(input.width);
  add(stringerDesc(input, r), r.stringers, 'boards', p.stringer ?? null);
  add(`Treads, ${fmtIn(input.tread)} deep, ${wide} stair`, r.treads, 'treads', p.tread ?? null);
  if (input.closed)
    add(
      `Riser boards, ${fmtIn(r.riserHeight)} high, ${wide} stair`,
      r.risers,
      'risers',
      p.riser ?? null
    );
  if (p.laborLump)
    add('Labor: build and install the stair, lump sum', 1, 'lump sum', p.labor ?? null);
  else add('Labor: build and install, per step', r.risers, 'steps', p.labor ?? null);
  return lines;
}

/** Inputs ↔ query string, so a result can be shared or reloaded. */
export const PARAM_KEYS = ['r', 'mr', 't', 'th', 'w', 's', 'sp', 'x', 'cr'] as const;

export function toParams(i: StairInput): Record<string, string> {
  return {
    r: String(i.rise),
    mr: String(i.maxRiser),
    t: String(i.tread),
    th: String(i.thickness),
    w: String(i.width),
    s: i.stock,
    sp: String(i.spacing),
    x: String(i.extra),
    cr: i.closed ? '1' : '0',
  };
}

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);

export function fromParams(q: Record<string, string>): StairInput {
  const d = DEFAULT_INPUT;
  // Zero or blank on a divisor field falls back to the default instead of dividing by zero.
  const positive = (v: string | undefined, fallback: number, lo: number, hi: number) =>
    clamp(nonNeg(v, fallback) || fallback, lo, hi);
  return {
    rise: Math.min(nonNeg(q.r, d.rise), 300),
    maxRiser: positive(q.mr, d.maxRiser, 4, 12),
    tread: positive(q.t, d.tread, 4, 24),
    thickness: Math.min(nonNeg(q.th, d.thickness), 3),
    width: Math.min(nonNeg(q.w, d.width), 120),
    stock: q.s && q.s in STOCK ? (q.s as Stock) : d.stock,
    spacing: positive(q.sp, d.spacing, 8, 48),
    extra: Math.min(nonNeg(q.x, d.extra), 60),
    closed: q.cr == null ? d.closed : q.cr !== '0',
  };
}
