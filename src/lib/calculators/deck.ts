// Deck takeoff for one rectangular deck hung off the house on a ledger: joists
// run out from the house, one beam carries the outer end on posts, and the
// decking runs parallel to the house. Counts decking, joists, hangers, ledger,
// rim and beam lumber, posts, footing concrete and screws, then prices them
// with the contractor's own unit prices. Pure functions only; the page
// controller and the Playwright spec both import them, so the numbers on the
// page and in the tests come from one place.
//
// This counts material. It does not size anything: joist, beam, post and
// footing sizes, spans and plies come from IRC R507 (Tables R507.3.1, R507.5
// and R507.6) or the local code, and the contractor enters the layout.
//
// Sources:
//   Concrete bag yields: Quikrete Concrete Mix (No. 1101) data sheet, 40 lb ≈
//     0.30 cu ft, 60 lb ≈ 0.45 cu ft, 80 lb ≈ 0.60 cu ft. Sakrete High Strength
//     Concrete Mix lists the same 60 lb yield (0.45 cu ft).
//   Two fasteners per board at every joist: IRC R507.7 (wood decking attached
//     to each supporting member with two 8d threaded nails or two No. 8 screws);
//     composite makers specify their own pattern.
//   Default board gap 3/16": Trex width-to-width gapping for composite boards.
//     Editable, because every decking maker sets its own.
//   Joist stock in even 2-ft lengths; 20 ft is the longest length most yards
//     stock (typical, not a rule), so longer joists are flagged.
//   Waste 10%, post spacing 8 ft and a 12" footing are typical defaults, not
//     rules, and are inputs.
import { nonNeg } from './format';
import { round2, type NewLine } from './estimate';

export const TOOL = 'deck-calculator';

export const JOIST_SPACINGS = [12, 16, 24] as const;
export type JoistSpacing = (typeof JOIST_SPACINGS)[number];

export const BOARD_LENGTHS = [12, 16, 20] as const;
export type BoardLength = (typeof BOARD_LENGTHS)[number];

export const BEAM_PLIES = [1, 2, 3] as const;
export type BeamPlies = (typeof BEAM_PLIES)[number];

/** Yield per bag of concrete mix, cu ft (Quikrete Concrete Mix No. 1101 data sheet). */
export const BAGS = {
  40: { label: '40 lb', cuft: 0.3 },
  60: { label: '60 lb', cuft: 0.45 },
  80: { label: '80 lb', cuft: 0.6 },
} as const;
export type BagSize = keyof typeof BAGS;
const BAG_SIZES = [40, 60, 80] as const;

export const FASTENERS = {
  screws: 'Face screws',
  hidden: 'Hidden fasteners',
} as const;
export type Fastener = keyof typeof FASTENERS;

/** Face screws per board at each joist it crosses (IRC R507.7 for wood decking). */
export const SCREWS_PER_CROSSING = 2;
/** Trex width-to-width gap for composite boards: 3/16". */
export const TREX_GAP_IN = 0.1875;
/** Shortest joist stock most yards sell, ft. */
export const MIN_STOCK_FT = 8;
/** Longest joist stock most yards keep on hand, ft (typical). */
export const MAX_STOCK_FT = 20;

export type DeckInput = {
  length: number; // along the house, ft
  projection: number; // out from the house, ft
  spacing: JoistSpacing; // joists, in o.c.
  face: number; // decking board face width, in
  gap: number; // between boards, in
  boardLength: BoardLength; // ft
  waste: number; // percent, decking only
  postSpacing: number; // max along the beam, ft
  plies: BeamPlies;
  footingDia: number; // in
  footingDepth: number; // in
  bag: BagSize;
  fastener: Fastener;
};

export const DEFAULT_INPUT: DeckInput = {
  length: 16,
  projection: 12,
  spacing: 16,
  face: 5.5,
  gap: TREX_GAP_IN,
  boardLength: 16,
  waste: 10,
  postSpacing: 8,
  plies: 2,
  footingDia: 12,
  footingDepth: 42,
  bag: 80,
  fastener: 'screws',
};

export type DeckPrices = {
  decking?: number; // per board
  joist?: number; // per joist
  lumber?: number; // ledger, rim and beam, per linear ft
  post?: number; // per post
  bag?: number; // per bag of concrete
  hanger?: number; // per joist hanger
  screws?: number; // per 100 screws
  labor?: number; // per sq ft of deck
};

export type DeckResult = {
  area: number;
  rows: number;
  deckingFt: number; // installed
  piecesPerRow: number;
  boards: number;
  joists: number;
  joistLength: number;
  joistOverStock: boolean;
  hangers: number;
  ledgerFt: number;
  rimFt: number;
  beamFt: number;
  framingFt: number;
  posts: number;
  footingCuft: number; // one footing
  concreteCuft: number; // all footings
  bags: number;
  screws: number;
};

const EPS = 1e-9;

/** Rows of decking across the projection: n boards and n − 1 gaps cover it. */
export function deckingRows(projectionFt: number, faceIn: number, gapIn: number): number {
  if (projectionFt <= 0 || faceIn <= 0) return 0;
  return Math.ceil((projectionFt * 12 + gapIn) / (faceIn + gapIn) - EPS);
}

/** Joists along the ledger, both end joists included. */
export function joistCount(lengthFt: number, spacingIn: number): number {
  if (lengthFt <= 0) return 0;
  return Math.floor((lengthFt * 12) / spacingIn + EPS) + 1;
}

/** The next even stock length at or over the projection, never under 8 ft. */
export function joistStockLength(projectionFt: number): number {
  if (projectionFt <= 0) return 0;
  return Math.max(MIN_STOCK_FT, 2 * Math.ceil(projectionFt / 2 - EPS));
}

/** Cylindrical footing volume, cu ft. */
export function footingCuft(diaIn: number, depthIn: number): number {
  return Math.PI * (diaIn / 24) ** 2 * (depthIn / 12);
}

export function bagsFor(cuft: number, bag: BagSize): number {
  return cuft > 0 ? Math.ceil(cuft / BAGS[bag].cuft - EPS) : 0;
}

/**
 * Boards for the decking. Each row runs the deck length. Whole boards go in
 * first; the short piece left at the end of a row is cut from boards that
 * yield as many of those pieces as fit. Waste goes on top.
 */
function boardTakeoff(
  rows: number,
  lengthFt: number,
  boardFt: number,
  waste: number
): { boards: number; piecesPerRow: number } {
  if (rows <= 0 || lengthFt <= 0) return { boards: 0, piecesPerRow: 0 };
  const whole = Math.floor(lengthFt / boardFt + EPS);
  const rest = lengthFt - whole * boardFt;
  const hasRest = rest > 1e-6;
  const restPerBoard = hasRest ? Math.max(1, Math.floor(boardFt / rest + EPS)) : 0;
  const base = rows * whole + (hasRest ? Math.ceil(rows / restPerBoard - EPS) : 0);
  return {
    boards: Math.ceil(base * (1 + waste / 100) - EPS),
    piecesPerRow: whole + (hasRest ? 1 : 0),
  };
}

export function computeDeck(input: DeckInput): DeckResult {
  const { length, projection } = input;
  const area = length * projection;
  const rows = length > 0 ? deckingRows(projection, input.face, input.gap) : 0;
  const { boards, piecesPerRow } = boardTakeoff(
    rows,
    length,
    input.boardLength,
    Math.max(0, input.waste)
  );
  const joists = joistCount(length, input.spacing);
  const joistLength = joistStockLength(projection);
  const ledgerFt = length > 0 && projection > 0 ? length : 0;
  const rimFt = ledgerFt;
  const beamFt = ledgerFt * input.plies;
  const posts = ledgerFt > 0 ? Math.ceil(length / input.postSpacing - EPS) + 1 : 0;
  const perFooting = footingCuft(input.footingDia, input.footingDepth);
  const concreteCuft = posts * perFooting;
  // A butt joint puts two board ends on one joist, so each joint adds a crossing.
  const crossingsPerRow = joists + Math.max(0, piecesPerRow - 1);
  return {
    area,
    rows,
    deckingFt: rows * length,
    piecesPerRow,
    boards,
    joists: projection > 0 ? joists : 0,
    joistLength,
    joistOverStock: joistLength > MAX_STOCK_FT,
    hangers: projection > 0 ? joists : 0,
    ledgerFt,
    rimFt,
    beamFt,
    framingFt: ledgerFt + rimFt + beamFt,
    posts,
    footingCuft: perFooting,
    concreteCuft,
    bags: bagsFor(concreteCuft, input.bag),
    screws: input.fastener === 'screws' ? SCREWS_PER_CROSSING * rows * crossingsPerRow : 0,
  };
}

export type PricedDeck = {
  material: number | null;
  materialComplete: boolean;
  labor: number | null;
  total: number | null;
  perSqft: number | null;
};

export function priceDeck(r: DeckResult, p: DeckPrices): PricedDeck {
  const parts: [number, number | undefined][] = [
    [r.boards, p.decking],
    [r.joists, p.joist],
    [r.framingFt, p.lumber],
    [r.posts, p.post],
    [r.bags, p.bag],
    [r.hangers, p.hanger],
    [r.screws / 100, p.screws],
  ];
  const priced = parts.filter(([qty, price]) => qty > 0 && price != null);
  const needed = parts.filter(([qty]) => qty > 0);
  const material = priced.length
    ? round2(priced.reduce((s, [q, pr]) => s + q * (pr ?? 0), 0))
    : null;
  const labor = p.labor != null && r.area > 0 ? round2(r.area * p.labor) : null;
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

export function groupLabel(input: DeckInput): string {
  return `Deck · ${ft(input.length)} × ${ft(input.projection)} ft`;
}

/** Estimate lines for the tray, priced only where the contractor gave a price. */
export function estimateLines(input: DeckInput, r: DeckResult, p: DeckPrices): NewLine[] {
  const lines: NewLine[] = [];
  const add = (desc: string, qty: number, unit: string, price: number | null) => {
    if (qty > 0) lines.push({ tool: TOOL, desc, qty, unit, price });
  };
  add(
    `Decking, ${ft(input.face)}" boards, ${input.boardLength} ft`,
    r.boards,
    'boards',
    p.decking ?? null
  );
  add(`Joists, ${r.joistLength} ft, ${input.spacing}" o.c.`, r.joists, 'joists', p.joist ?? null);
  add(
    `Ledger, rim and ${input.plies}-ply beam lumber`,
    round2(r.framingFt),
    'lin ft',
    p.lumber ?? null
  );
  add('Posts', r.posts, 'posts', p.post ?? null);
  add(`Concrete mix, ${BAGS[input.bag].label} bags`, r.bags, 'bags', p.bag ?? null);
  add('Joist hangers at the ledger', r.hangers, 'ea', p.hanger ?? null);
  add('Deck screws', r.screws, 'ea', p.screws != null ? p.screws / 100 : null);
  add('Labor: frame and deck', round2(r.area), 'sq ft', p.labor ?? null);
  return lines;
}

/** Inputs ↔ query string, so a result can be shared or reloaded. */
export const PARAM_KEYS = [
  'l',
  'p',
  'js',
  'bw',
  'gap',
  'bl',
  'wst',
  'ps',
  'ply',
  'fd',
  'fdp',
  'bag',
  'fx',
] as const;

export function toParams(i: DeckInput): Record<string, string> {
  return {
    l: String(i.length),
    p: String(i.projection),
    js: String(i.spacing),
    bw: String(i.face),
    gap: String(i.gap),
    bl: String(i.boardLength),
    wst: String(i.waste),
    ps: String(i.postSpacing),
    ply: String(i.plies),
    fd: String(i.footingDia),
    fdp: String(i.footingDepth),
    bag: String(i.bag),
    fx: i.fastener,
  };
}

function pick<T extends number>(raw: string | undefined, list: readonly T[], fallback: T): T {
  const n = Number(raw);
  return (list as readonly number[]).includes(n) ? (n as T) : fallback;
}

export function fromParams(q: Record<string, string>): DeckInput {
  const d = DEFAULT_INPUT;
  const clamp = (v: string | undefined, fallback: number, min: number, max: number) =>
    Math.min(Math.max(nonNeg(v, fallback), min), max);
  return {
    length: clamp(q.l, d.length, 0, 100),
    projection: clamp(q.p, d.projection, 0, 100),
    spacing: pick(q.js, JOIST_SPACINGS, d.spacing),
    face: clamp(q.bw, d.face, 1, 12),
    gap: clamp(q.gap, d.gap, 0, 1),
    boardLength: pick(q.bl, BOARD_LENGTHS, d.boardLength),
    waste: clamp(q.wst, d.waste, 0, 40),
    postSpacing: clamp(q.ps, d.postSpacing, 1, 20),
    plies: pick(q.ply, BEAM_PLIES, d.plies),
    footingDia: clamp(q.fd, d.footingDia, 0, 48),
    footingDepth: clamp(q.fdp, d.footingDepth, 0, 120),
    bag: pick(q.bag, BAG_SIZES, d.bag),
    fastener: q.fx && q.fx in FASTENERS ? (q.fx as Fastener) : d.fastener,
  };
}
