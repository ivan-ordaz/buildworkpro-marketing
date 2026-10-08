// Drywall takeoff for one room: board area, sheets, joint compound, tape and
// screws, then an optional price from the contractor's own unit prices. Pure
// functions only; the page controller and the Playwright spec both import them,
// so the numbers on the page and in the tests come from one place.
//
// Coverage figures (USG product data):
//   ready-mixed joint compound ≈ 9.4 gal per 1,000 sq ft of board finished
//   paper joint tape ≈ 370 ft per 1,000 sq ft of board
// Screw counts follow the ASTM C840 maximum spacing for single-ply board on
// framing 16" o.c.: 16" o.c. on walls, 12" o.c. on ceilings, one row per
// framing member the sheet crosses (sheets hung perpendicular to framing).
import { nonNeg } from './format';
import { round2, type NewLine } from './estimate';

export const TOOL = 'drywall-calculator';

export const SHEETS = {
  '4x8': { label: '4 × 8 ft', sqft: 32, lengthFt: 8 },
  '4x10': { label: '4 × 10 ft', sqft: 40, lengthFt: 10 },
  '4x12': { label: '4 × 12 ft', sqft: 48, lengthFt: 12 },
} as const;
export type SheetSize = keyof typeof SHEETS;

export const BOARDS = {
  half: '½" regular',
  'half-mr': '½" moisture-resistant',
  'five-eighths-x': '⅝" Type X',
} as const;
export type Board = keyof typeof BOARDS;

export const LEVELS = ['3', '4', '5'] as const;
export type Level = (typeof LEVELS)[number];

export const DOOR_SQFT = 20; // 3 ft × 6 ft 8 in
export const WINDOW_SQFT = 15; // 3 ft × 5 ft
export const COMPOUND_GAL_PER_1000 = 9.4;
export const TAPE_FT_PER_1000 = 370;
export const PAIL_GAL = 4.5;
export const TAPE_ROLL_FT = 500;
const FRAMING_OC_IN = 16;
const SHEET_WIDTH_IN = 48;
const WALL_SCREW_OC_IN = 16;
const CEILING_SCREW_OC_IN = 12;

export type DrywallInput = {
  length: number;
  width: number;
  height: number;
  ceiling: boolean;
  doors: number;
  windows: number;
  sheet: SheetSize;
  board: Board;
  level: Level;
  waste: number; // percent
};

export const DEFAULT_INPUT: DrywallInput = {
  length: 14,
  width: 12,
  height: 9,
  ceiling: true,
  doors: 0,
  windows: 0,
  sheet: '4x12',
  board: 'half',
  level: '4',
  waste: 10,
};

export type DrywallPrices = {
  sheet?: number; // per sheet
  pail?: number; // per 4.5 gal pail of compound
  roll?: number; // per 500 ft roll of tape
  screws?: number; // per 1,000 screws
  labor?: number; // hang + finish, per sq ft of board
};

export type DrywallResult = {
  wallGross: number;
  openings: number;
  wallArea: number;
  ceilingArea: number;
  boardArea: number;
  wallSheets: number;
  ceilingSheets: number;
  sheets: number;
  compoundGal: number;
  pails: number;
  tapeFt: number;
  rolls: number;
  screws: number;
};

/** Screws per sheet hung across framing 16" o.c.: one column per member crossed. */
export function screwsPerSheet(lengthFt: number, spacingIn: number): number {
  const columns = Math.floor((lengthFt * 12) / FRAMING_OC_IN) + 1;
  const perColumn = Math.floor(SHEET_WIDTH_IN / spacingIn) + 1;
  return columns * perColumn;
}

export function computeDrywall(input: DrywallInput): DrywallResult {
  const sheet = SHEETS[input.sheet];
  const waste = 1 + Math.max(0, input.waste) / 100;
  const wallGross = 2 * (input.length + input.width) * input.height;
  const openings = Math.min(wallGross, input.doors * DOOR_SQFT + input.windows * WINDOW_SQFT);
  const wallArea = wallGross - openings;
  const ceilingArea = input.ceiling ? input.length * input.width : 0;
  const boardArea = wallArea + ceilingArea;
  const sheetsFor = (area: number) =>
    area > 0 ? Math.ceil((area * waste) / sheet.sqft - 1e-9) : 0;
  const wallSheets = sheetsFor(wallArea);
  const ceilingSheets = sheetsFor(ceilingArea);
  const compoundGal = (boardArea * COMPOUND_GAL_PER_1000) / 1000;
  const tapeFt = (boardArea * TAPE_FT_PER_1000) / 1000;
  return {
    wallGross,
    openings,
    wallArea,
    ceilingArea,
    boardArea,
    wallSheets,
    ceilingSheets,
    sheets: wallSheets + ceilingSheets,
    compoundGal,
    pails: boardArea > 0 ? Math.ceil(compoundGal / PAIL_GAL - 1e-9) : 0,
    tapeFt,
    rolls: boardArea > 0 ? Math.ceil(tapeFt / TAPE_ROLL_FT - 1e-9) : 0,
    screws:
      wallSheets * screwsPerSheet(sheet.lengthFt, WALL_SCREW_OC_IN) +
      ceilingSheets * screwsPerSheet(sheet.lengthFt, CEILING_SCREW_OC_IN),
  };
}

export type PricedDrywall = {
  material: number | null;
  materialComplete: boolean;
  labor: number | null;
  total: number | null;
  perSqft: number | null;
};

export function priceDrywall(r: DrywallResult, p: DrywallPrices): PricedDrywall {
  const parts: [number, number | undefined][] = [
    [r.sheets, p.sheet],
    [r.pails, p.pail],
    [r.rolls, p.roll],
    [r.screws / 1000, p.screws],
  ];
  const priced = parts.filter(([qty, price]) => qty > 0 && price != null);
  const needed = parts.filter(([qty]) => qty > 0);
  const material = priced.length
    ? round2(priced.reduce((s, [q, pr]) => s + q * (pr ?? 0), 0))
    : null;
  const labor = p.labor != null && r.boardArea > 0 ? round2(r.boardArea * p.labor) : null;
  const total = material == null && labor == null ? null : round2((material ?? 0) + (labor ?? 0));
  return {
    material,
    materialComplete: priced.length === needed.length,
    labor,
    total,
    perSqft: total != null && r.boardArea > 0 ? round2(total / r.boardArea) : null,
  };
}

const ft = (n: number) => Number(n.toFixed(2)).toString();

export function groupLabel(input: DrywallInput): string {
  return `Drywall · ${ft(input.length)} × ${ft(input.width)} × ${ft(input.height)} ft room`;
}

/** Estimate lines for the tray, priced only where the contractor gave a price. */
export function estimateLines(input: DrywallInput, r: DrywallResult, p: DrywallPrices): NewLine[] {
  const size = SHEETS[input.sheet].label;
  const board = BOARDS[input.board];
  const lines: NewLine[] = [];
  const add = (desc: string, qty: number, unit: string, price: number | null) => {
    if (qty > 0) lines.push({ tool: TOOL, desc, qty, unit, price });
  };
  add(`${board} board, ${size}, walls`, r.wallSheets, 'sheets', p.sheet ?? null);
  add(`${board} board, ${size}, ceiling`, r.ceilingSheets, 'sheets', p.sheet ?? null);
  add('Joint compound, ready-mixed, 4.5 gal pails', r.pails, 'pails', p.pail ?? null);
  add('Paper joint tape, 500 ft rolls', r.rolls, 'rolls', p.roll ?? null);
  add('Drywall screws', r.screws, 'ea', p.screws != null ? p.screws / 1000 : null);
  add(
    `Labor: hang and finish to Level ${input.level}`,
    round2(r.boardArea),
    'sq ft',
    p.labor ?? null
  );
  return lines;
}

/** Inputs ↔ query string, so a result can be shared or reloaded. */
export const PARAM_KEYS = ['l', 'w', 'h', 'c', 'd', 'win', 's', 'b', 'lvl', 'wst'] as const;

export function toParams(i: DrywallInput): Record<string, string> {
  return {
    l: String(i.length),
    w: String(i.width),
    h: String(i.height),
    c: i.ceiling ? '1' : '0',
    d: String(i.doors),
    win: String(i.windows),
    s: i.sheet,
    b: i.board,
    lvl: i.level,
    wst: String(i.waste),
  };
}

export function fromParams(q: Record<string, string>): DrywallInput {
  const d = DEFAULT_INPUT;
  const clampDim = (v: string | undefined, fallback: number) => Math.min(nonNeg(v, fallback), 500);
  return {
    length: clampDim(q.l, d.length),
    width: clampDim(q.w, d.width),
    height: clampDim(q.h, d.height),
    ceiling: q.c == null ? d.ceiling : q.c !== '0',
    doors: Math.min(Math.round(nonNeg(q.d, d.doors)), 200),
    windows: Math.min(Math.round(nonNeg(q.win, d.windows)), 200),
    sheet: q.s && q.s in SHEETS ? (q.s as SheetSize) : d.sheet,
    board: q.b && q.b in BOARDS ? (q.b as Board) : d.board,
    level: (LEVELS as readonly string[]).includes(q.lvl ?? '') ? (q.lvl as Level) : d.level,
    waste: Math.min(nonNeg(q.wst, d.waste), 40),
  };
}
