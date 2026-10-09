// Conduit fill for one raceway: the cross-sectional area of the conductors
// against the raceway's inside area, checked against the NEC Chapter 9 fill
// limits, plus the smallest trade size that passes, a jam-ratio check for
// three conductors, and wire and raceway footage for an estimate priced with
// the contractor's own prices. Pure functions only; the page controller and the
// Playwright spec both import them, so the numbers on the page and in the tests
// come from one place.
//
// NFPA 70 tables are copyrighted, so no NEC table is copied here. Raceway inside
// diameters and conductor outside diameters come from manufacturer data sheets
// (sources on each table below); areas are computed as π/4 × diameter². The code
// rules are cited by number only:
//   NEC Chapter 9, Table 1: fill limits for 1, 2 and over 2 conductors.
//   NEC Chapter 9, Note 3: equipment grounding and bonding conductors count.
//   NEC Chapter 9, Note 4: nipples 24 in or shorter may be filled to 60%.
//   NEC Chapter 9, Note 7: same-size conductors, round up at a decimal of 0.8.
//   NEC Chapter 9, Table 1, Informational Note No. 2: jamming with three conductors.
// Inspectors work from Chapter 9 Tables 4, 5 and 8; the published dimensions
// used here match them closely, which the page says in so many words.
import { nonNeg } from './format';
import { round2, type NewLine } from './estimate';

export const TOOL = 'conduit-fill-calculator';

const EPS = 1e-9;

export const TRADE_SIZES = [
  '1/2',
  '3/4',
  '1',
  '1-1/4',
  '1-1/2',
  '2',
  '2-1/2',
  '3',
  '3-1/2',
  '4',
] as const;
export type TradeSize = (typeof TRADE_SIZES)[number];

export const TRADE_LABEL: Record<TradeSize, string> = {
  '1/2': '½',
  '3/4': '¾',
  '1': '1',
  '1-1/4': '1¼',
  '1-1/2': '1½',
  '2': '2',
  '2-1/2': '2½',
  '3': '3',
  '3-1/2': '3½',
  '4': '4',
};

const byTrade = (...v: number[]): Record<TradeSize, number> =>
  Object.fromEntries(TRADE_SIZES.map((t, i) => [t, v[i]])) as Record<TradeSize, number>;

/**
 * Inside diameters in inches, trade sizes ½ through 4.
 *
 * EMT, IMC and RMC: Wheatland Tube, "EMT & Conduit" brochure, inside-diameter
 * columns of the EMT (ANSI C80.3), IMC (ANSI C80.6) and rigid metal conduit
 * (ANSI C80.1) tables.
 * https://www.wheatland.com/wp-content/uploads/2018/03/EMT-and-Conduit-Brochure.pdf
 * Allied Tube & Conduit (Atkore) publishes the same EMT outside diameters and
 * walls (½ in: 0.706 OD, 0.042 wall → 0.622 ID).
 *
 * PVC: average inside diameter of Schedule 40 and Schedule 80 PVC from Spears
 * Manufacturing, "Dimensions & Pressure Ratings".
 * https://www.spearsmfg.com/IP-4/04%20Dimensions%20&%20Pressure%20Ratings.pdf
 * Electrical conduit has the same outside diameter and minimum wall as that pipe:
 * CANTEX "Nonmetallic PVC Schedule 40 & 80 Conduit" cut sheet
 * (https://www.cantexinc.com/Portals/0/CANTEX-Schedule-40-and-80-Conduit-Sell-Sheet_1.pdf)
 * and Prime Conduit "Schedule 40 and Schedule 80" sheet
 * (https://utilitypipesupply.com/cdn/shop/files/Sch_4080_Conduit_50d443e1-b190-496b-94cf-197a7fa0a1b6.pdf).
 */
export const RACEWAYS = {
  emt: {
    label: 'EMT',
    id: byTrade(0.622, 0.824, 1.049, 1.38, 1.61, 2.067, 2.731, 3.356, 3.834, 4.334),
  },
  imc: {
    label: 'IMC',
    id: byTrade(0.66, 0.864, 1.105, 1.448, 1.683, 2.15, 2.557, 3.176, 3.671, 4.166),
  },
  rmc: {
    label: 'RMC (rigid)',
    id: byTrade(0.632, 0.836, 1.063, 1.394, 1.624, 2.083, 2.489, 3.09, 3.57, 4.05),
  },
  pvc40: {
    label: 'PVC Schedule 40',
    id: byTrade(0.602, 0.804, 1.029, 1.36, 1.59, 2.047, 2.445, 3.042, 3.521, 3.998),
  },
  pvc80: {
    label: 'PVC Schedule 80',
    id: byTrade(0.526, 0.722, 0.936, 1.255, 1.476, 1.913, 2.29, 2.864, 3.326, 3.786),
  },
} as const;
export type Raceway = keyof typeof RACEWAYS;

export const WIRE_SIZES = [
  '14',
  '12',
  '10',
  '8',
  '6',
  '4',
  '3',
  '2',
  '1',
  '1/0',
  '2/0',
  '3/0',
  '4/0',
  '250',
  '300',
  '350',
  '400',
  '500',
] as const;
export type WireSize = (typeof WIRE_SIZES)[number];

const isKcmil = (s: WireSize) => Number(s) >= 250;

export const WIRE_LABEL = Object.fromEntries(
  WIRE_SIZES.map((s) => [s, `${s} ${isKcmil(s) ? 'kcmil' : 'AWG'}`])
) as Record<WireSize, string>;

const byWire = (...v: number[]): Record<WireSize, number> =>
  Object.fromEntries(WIRE_SIZES.map((s, i) => [s, v[i]])) as Record<WireSize, number>;

/**
 * THHN/THWN-2 copper, approximate overall diameter in inches, stranded.
 * Cerrowire "THHN / THWN-2" spec sheet, Rev 02/2026:
 * https://www.cerrowire.com/wp-content/uploads/2026/02/Cerrowire_THHNTHWN-2_sheet_260204.pdf
 * Solid 14–10 AWG is smaller (0.104, 0.120, 0.151 in), so using stranded errs on
 * the safe side. Southwire SPEC 10003 lists 14–10 AWG stranded within 0.002 in.
 */
export const THHN_OD = byWire(
  0.111,
  0.13,
  0.164,
  0.216,
  0.254,
  0.324,
  0.352,
  0.384,
  0.446,
  0.486,
  0.532,
  0.584,
  0.642,
  0.711,
  0.766,
  0.817,
  0.864,
  0.949
);

export const CONDUCTORS = {
  thhn: { label: 'THHN/THWN-2', long: 'THHN/THWN-2 copper' },
  bare: { label: 'Bare copper', long: 'bare copper, stranded' },
} as const;
export type ConductorType = keyof typeof CONDUCTORS;

/** AWG number as used in the gauge formula: 1/0 is 0, 2/0 is -1, 3/0 -2, 4/0 -3. */
function gaugeNumber(s: WireSize): number {
  return s.endsWith('/0') ? 1 - Number(s[0]) : Number(s);
}

/** Solid AWG diameter in inches: 0.005 × 92^((36 − n) / 39), the AWG definition (ASTM B258). */
export function awgDiameter(gauge: number): number {
  return 0.005 * Math.pow(92, (36 - gauge) / 39);
}

/** Conductor area in circular mils: kcmil sizes by name, AWG sizes from the gauge formula. */
export function circularMils(s: WireSize): number {
  return isKcmil(s) ? Number(s) * 1000 : (awgDiameter(gaugeNumber(s)) * 1000) ** 2;
}

/** ASTM B8 Class B strand count: 7 for 14–2 AWG, 19 for 1–4/0 AWG, 37 for 250–500 kcmil. */
export function classBStrands(s: WireSize): 7 | 19 | 37 {
  if (isKcmil(s)) return 37;
  return gaugeNumber(s) >= 2 ? 7 : 19;
}

/**
 * Bare concentric-lay stranded copper diameter in inches. A 7-strand conductor
 * is 3 strand diameters across, 19 strands 5 and 37 strands 7; each strand is
 * √(circular mils ÷ strands) mils. Checked against Southwire SPEC 80150, Class B
 * complete-conductor diameters (8 AWG 146 mils … 500 kcmil 814 mils):
 * https://cabletechsupport.southwire.com/tile/32/spec/80150/?country=US
 */
export function bareStrandedOd(s: WireSize): number {
  const strands = classBStrands(s);
  const across = strands === 7 ? 3 : strands === 19 ? 5 : 7;
  return (across * Math.sqrt(circularMils(s) / strands)) / 1000;
}

export function conductorOd(type: ConductorType, size: WireSize): number {
  return type === 'thhn' ? THHN_OD[size] : bareStrandedOd(size);
}

export function circleArea(diameter: number): number {
  return (Math.PI / 4) * diameter * diameter;
}

export function racewayId(raceway: Raceway, trade: TradeSize): number {
  return RACEWAYS[raceway].id[trade];
}

export function racewayArea(raceway: Raceway, trade: TradeSize): number {
  return circleArea(racewayId(raceway, trade));
}

export function conductorArea(type: ConductorType, size: WireSize): number {
  return circleArea(conductorOd(type, size));
}

/** Fill limits in percent: NEC Chapter 9, Table 1, and Note 4 for nipples. */
export const FILL = { one: 53, two: 31, over2: 40, nipple: 60 } as const;
/** Chapter 9, Note 7: round up to the next whole conductor at a decimal of 0.8 or more. */
export const NOTE7_DECIMAL = 0.8;
/** Chapter 9, Table 1, Informational Note No. 2: raceway ID ÷ conductor OD band for three conductors. */
export const JAM = { low: 2.8, high: 3.2 } as const;
/** A result this close to the limit (fraction of the allowed area) gets a "check the code book" note. */
export const CLOSE_CALL = 0.01;

export function allowedPct(count: number, nipple: boolean): number {
  if (nipple) return FILL.nipple;
  return count <= 1 ? FILL.one : count === 2 ? FILL.two : FILL.over2;
}

/** Whole conductors from a fractional count, rounding up when the decimal is 0.8 or more. */
export function roundNote7(x: number): number {
  const whole = Math.floor(x + EPS);
  return x - whole >= NOTE7_DECIMAL - EPS ? whole + 1 : whole;
}

/** Most conductors of one size a raceway takes, with Note 7 rounding at each fill limit. */
export function maxSameSize(raceArea: number, condArea: number, nipple = false): number {
  if (raceArea <= 0 || condArea <= 0) return 0;
  const fits = (pct: number) => roundNote7((raceArea * pct) / 100 / condArea);
  if (nipple) return fits(FILL.nipple);
  const many = fits(FILL.over2);
  if (many >= 3) return many;
  if (fits(FILL.two) >= 2) return 2;
  return fits(FILL.one) >= 1 ? 1 : 0;
}

export const MAX_ROWS = 6;
export const MAX_QTY = 999;

export type Row = { qty: number; type: ConductorType; size: WireSize };

export type FillInput = {
  raceway: Raceway;
  trade: TradeSize;
  nipple: boolean;
  rows: Row[];
  run: number; // ft
  extra: number; // percent makeup on wire
};

export const DEFAULT_ROWS: Row[] = [
  { qty: 3, type: 'thhn', size: '3' },
  { qty: 1, type: 'thhn', size: '8' },
];

export const DEFAULT_INPUT: FillInput = {
  raceway: 'emt',
  trade: '1',
  nipple: false,
  rows: DEFAULT_ROWS,
  run: 100,
  extra: 10,
};

/** A new row on the page starts as one 12 AWG THHN. */
export const NEW_ROW: Row = { qty: 1, type: 'thhn', size: '12' };

export type Bundle = Row & { od: number; area: number };

/** Rows with a quantity, same type and size merged, in the order first listed. */
export function bundles(rows: Row[]): Bundle[] {
  const out: Bundle[] = [];
  for (const row of rows) {
    if (!(row.qty > 0)) continue;
    const hit = out.find((b) => b.type === row.type && b.size === row.size);
    if (hit) hit.qty += row.qty;
    else
      out.push({
        ...row,
        od: conductorOd(row.type, row.size),
        area: conductorArea(row.type, row.size),
      });
  }
  return out;
}

export type FillCheck = {
  count: number;
  conductorArea: number;
  racewayId: number;
  racewayArea: number;
  allowedPct: number;
  allowedArea: number;
  fillPct: number;
  /** Every conductor the same type and size, so Note 7 applies. */
  sameSize: boolean;
  /** Most of that one conductor this raceway takes; null for a mixed fill. */
  maxSame: number | null;
  pass: boolean;
  /** Passes only through Note 7's round-up. */
  byNote7: boolean;
  /** Within 1% of the allowed area, either side. */
  close: boolean;
};

export function checkFill(
  raceway: Raceway,
  trade: TradeSize,
  rows: Row[],
  nipple: boolean
): FillCheck {
  const list = bundles(rows);
  const count = list.reduce((s, b) => s + b.qty, 0);
  const area = list.reduce((s, b) => s + b.qty * b.area, 0);
  const raceArea = racewayArea(raceway, trade);
  const pct = allowedPct(count, nipple);
  const allowedArea = (raceArea * pct) / 100;
  const sameSize = list.length === 1;
  const maxSame = sameSize ? maxSameSize(raceArea, list[0].area, nipple) : null;
  const byArea = area <= allowedArea + EPS;
  const pass = count > 0 && (maxSame != null ? count <= maxSame : byArea);
  return {
    count,
    conductorArea: area,
    racewayId: racewayId(raceway, trade),
    racewayArea: raceArea,
    allowedPct: pct,
    allowedArea,
    fillPct: raceArea > 0 ? (area / raceArea) * 100 : 0,
    sameSize,
    maxSame,
    pass,
    byNote7: pass && !byArea,
    close: count > 0 && Math.abs(area - allowedArea) <= CLOSE_CALL * allowedArea + EPS,
  };
}

/** Smallest trade size of this raceway type that passes; null when 4 in does not. */
export function smallestPassing(raceway: Raceway, rows: Row[], nipple: boolean): TradeSize | null {
  if (!bundles(rows).length) return null;
  return TRADE_SIZES.find((t) => checkFill(raceway, t, rows, nipple).pass) ?? null;
}

export type JamCheck = {
  /** Exactly three conductors in the raceway. */
  applies: boolean;
  /** All three the same size, so one ratio describes the pull. */
  same: boolean;
  ratio: number | null;
  risk: boolean;
};

export function jamCheck(raceway: Raceway, trade: TradeSize, rows: Row[]): JamCheck {
  const list = bundles(rows);
  const count = list.reduce((s, b) => s + b.qty, 0);
  if (count !== 3) return { applies: false, same: false, ratio: null, risk: false };
  if (list.length !== 1) return { applies: true, same: false, ratio: null, risk: false };
  const ratio = racewayId(raceway, trade) / list[0].od;
  return {
    applies: true,
    same: true,
    ratio,
    risk: ratio >= JAM.low - EPS && ratio <= JAM.high + EPS,
  };
}

export type WireRun = Bundle & { feet: number };

export type FillResult = FillCheck & {
  smallest: TradeSize | null;
  jam: JamCheck;
  wire: WireRun[];
};

/** Wire to buy for one bundle: run × conductors × (1 + makeup), rounded up to the foot. */
export function wireFeet(run: number, qty: number, extra: number): number {
  const ft = run * qty * (1 + Math.max(0, extra) / 100);
  return ft > 0 ? Math.ceil(ft - EPS) : 0;
}

export function computeFill(input: FillInput): FillResult {
  return {
    ...checkFill(input.raceway, input.trade, input.rows, input.nipple),
    smallest: smallestPassing(input.raceway, input.rows, input.nipple),
    jam: jamCheck(input.raceway, input.trade, input.rows),
    wire: bundles(input.rows).map((b) => ({ ...b, feet: wireFeet(input.run, b.qty, input.extra) })),
  };
}

/** Price-book keys: raceway per ft by type and trade size, wire per ft by type and size. */
export const racewayKey = (raceway: Raceway, trade: TradeSize) => `r:${raceway}:${trade}`;
export const wireKey = (type: ConductorType, size: WireSize) => `w:${type}:${size}`;

export type FillPrices = Record<string, number>;

export type PricedFill = {
  raceway: number | null;
  wire: number | null;
  wireComplete: boolean;
  total: number | null;
  perFt: number | null;
};

export function priceFill(input: FillInput, r: FillResult, p: FillPrices): PricedFill {
  const rp = p[racewayKey(input.raceway, input.trade)];
  const raceway = rp != null && input.run > 0 ? round2(input.run * rp) : null;
  const needed = r.wire.filter((w) => w.feet > 0);
  const priced = needed.filter((w) => p[wireKey(w.type, w.size)] != null);
  const wire = priced.length
    ? round2(priced.reduce((s, w) => s + w.feet * p[wireKey(w.type, w.size)], 0))
    : null;
  const total = raceway == null && wire == null ? null : round2((raceway ?? 0) + (wire ?? 0));
  return {
    raceway,
    wire,
    wireComplete: priced.length === needed.length,
    total,
    perFt: total != null && input.run > 0 ? round2(total / input.run) : null,
  };
}

const num = (n: number) => Number(n.toFixed(2)).toString();

export function racewayName(input: Pick<FillInput, 'raceway' | 'trade' | 'nipple'>): string {
  const base = `${TRADE_LABEL[input.trade]} in ${RACEWAYS[input.raceway].label}`;
  return input.nipple ? `${base} nipple` : base;
}

export function groupLabel(input: FillInput): string {
  return `Conduit and wire · ${racewayName(input)}, ${num(input.run)} ft run`;
}

export function wireDesc(input: FillInput, w: WireRun): string {
  const makeup = input.extra > 0 ? ` + ${num(input.extra)}% makeup` : '';
  return `${WIRE_LABEL[w.size]} ${CONDUCTORS[w.type].long}, ${w.qty} × ${num(input.run)} ft${makeup}`;
}

/** Estimate lines for the tray, priced only where the contractor gave a price. */
export function estimateLines(input: FillInput, r: FillResult, p: FillPrices): NewLine[] {
  const lines: NewLine[] = [];
  const add = (desc: string, qty: number, price: number | undefined) => {
    if (qty > 0) lines.push({ tool: TOOL, desc, qty, unit: 'ft', price: price ?? null });
  };
  add(racewayName(input), input.run, p[racewayKey(input.raceway, input.trade)]);
  for (const w of r.wire) add(wireDesc(input, w), w.feet, p[wireKey(w.type, w.size)]);
  return lines;
}

/** Inputs ↔ query string, so a result can be shared or reloaded. Rows travel as c1…c6. */
export const ROW_KEYS = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'] as const;
export const PARAM_KEYS = ['rw', 'ts', 'nip', 'run', 'x', ...ROW_KEYS] as const;

export const rowParam = (r: Row) => `${r.qty}.${r.type}.${r.size}`;

export function parseRow(v: string | undefined): Row | null {
  if (!v) return null;
  const [qty, type, size] = v.split('.');
  if (!(type in CONDUCTORS) || !(WIRE_SIZES as readonly string[]).includes(size ?? '')) return null;
  return {
    qty: Math.min(Math.round(nonNeg(qty, 0)), MAX_QTY),
    type: type as ConductorType,
    size: size as WireSize,
  };
}

export function toParams(i: FillInput): Record<string, string> {
  const out: Record<string, string> = {
    rw: i.raceway,
    ts: i.trade,
    nip: i.nipple ? '1' : '0',
    run: String(i.run),
    x: String(i.extra),
  };
  i.rows.slice(0, MAX_ROWS).forEach((r, n) => {
    out[ROW_KEYS[n]] = rowParam(r);
  });
  return out;
}

export function fromParams(q: Record<string, string>): FillInput {
  const d = DEFAULT_INPUT;
  const rows = ROW_KEYS.map((k) => parseRow(q[k])).filter((r): r is Row => r != null);
  return {
    raceway: q.rw && q.rw in RACEWAYS ? (q.rw as Raceway) : d.raceway,
    trade: (TRADE_SIZES as readonly string[]).includes(q.ts ?? '') ? (q.ts as TradeSize) : d.trade,
    nipple: q.nip == null ? d.nipple : q.nip === '1',
    rows: rows.length ? rows : d.rows.map((r) => ({ ...r })),
    run: Math.min(nonNeg(q.run, d.run), 10000),
    extra: Math.min(nonNeg(q.x, d.extra), 100),
  };
}
