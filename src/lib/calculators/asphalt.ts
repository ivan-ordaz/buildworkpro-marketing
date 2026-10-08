// Asphalt paving takeoff for one area: square feet and yards, compacted volume,
// tons of hot mix, an optional aggregate base course and truckloads, then an
// optional price from the contractor's own unit prices. Pure functions only; the
// page controller and the Playwright spec both import them, so the numbers on
// the page and in the tests come from one place.
//
// Every density and the truck load are editable inputs. The defaults:
//   compacted hot-mix asphalt 145 lb/cu ft: Iowa DOT Design Manual 1B-4,
//     "Densities for Use in Estimating Quantities", Table 1 (HMA).
//     The Pennsylvania Asphalt Pavement Association's "Constructing Quality
//     Asphalt Pavements in Pennsylvania Check List" (4th ed., 2025) puts a
//     typical compacted mix at 108 to 120 lb per sq yd per inch (144 to 160
//     lb/cu ft) and tells you to take the real figure from the mix design (JMF).
//   compacted aggregate base 140 lb/cu ft: Iowa DOT Design Manual 1B-4, Table 2
//     (Rolled Stone Base, Modified Subbase and Class "A" Crushed Stone).
//   roll-down about 25% for dense-graded mix, about 15% for open- and
//     gap-graded mix: NAPA / AAPTP Asphalt Paving Handbook, section 7.5.
//   truck load 15 tons, typical only: the same handbook, section 6.3.1, puts
//     end-dump trucks with three to six axles at 12 to 20 tons ("more axles mean
//     more capacity") and semitrailer end dumps at 20 to 25 tons.
import { nonNeg } from './format';
import { round2, type NewLine } from './estimate';

export const TOOL = 'asphalt-calculator';

export const LB_PER_TON = 2000;
export const SQFT_PER_SQYD = 9;
export const CUFT_PER_CUYD = 27;
export const HMA_DENSITY = 145;
export const BASE_DENSITY = 140;
export const HMA_TYPICAL_LB_SY_IN = [108, 120] as const;
export const ROLLDOWN = 0.25;
export const ROLLDOWN_OPEN_GRADED = 0.15;
export const TRUCK_TONS = 15;
export const END_DUMP_TONS = [12, 20] as const;
export const SEMI_END_DUMP_TONS = [20, 25] as const;

export const MODES = {
  lw: 'Width × length',
  sf: 'Square feet',
} as const;
export type AreaMode = keyof typeof MODES;

/** Labor is priced per sq ft or per sq yd; the value is sq ft per pricing unit. */
export const LABOR_UNITS = { 1: 'sq ft', 9: 'sq yd' } as const;
export type LaborUnit = keyof typeof LABOR_UNITS;

export type AsphaltInput = {
  mode: AreaMode;
  width: number; // ft
  length: number; // ft
  area: number; // sq ft, used when mode is 'sf'
  thickness: number; // in, compacted
  density: number; // lb/cu ft, compacted
  waste: number; // percent
  baseThickness: number; // in, compacted; 0 = no base course
  baseDensity: number; // lb/cu ft, compacted
  truckTons: number;
};

export const DEFAULT_INPUT: AsphaltInput = {
  mode: 'lw',
  width: 12,
  length: 50,
  area: 600,
  thickness: 3,
  density: HMA_DENSITY,
  waste: 5,
  baseThickness: 6,
  baseDensity: BASE_DENSITY,
  truckTons: TRUCK_TONS,
};

export type AsphaltPrices = {
  ton?: number; // hot mix, per ton
  base?: number; // aggregate base, per ton
  load?: number; // trucking, per load
  labor?: number; // paving labor, per laborUnit
  laborUnit?: number; // 1 = per sq ft, 9 = per sq yd
};

export type AsphaltResult = {
  sqft: number;
  sqyd: number;
  /** Compacted, in place, before waste. */
  cuft: number;
  cuyd: number;
  tonsNet: number;
  /** Tons to order, waste included, to the hundredth as on a scale ticket. */
  tons: number;
  /** Roll-down: about how thick to lay the mat for the compacted thickness. */
  looseIn: number;
  lbPerSyIn: number;
  baseCuft: number;
  baseCuyd: number;
  baseTonsNet: number;
  baseTons: number;
  baseTonsPerCuyd: number;
  loads: number;
  baseLoads: number;
};

/** Pounds of compacted mix covering one square yard one inch thick. */
export function lbPerSyIn(densityPcf: number): number {
  return (densityPcf * SQFT_PER_SQYD) / 12;
}

/** Tons per cubic yard for a density in lb/cu ft. */
export function tonsPerCuyd(densityPcf: number): number {
  return (densityPcf * CUFT_PER_CUYD) / LB_PER_TON;
}

/** Loose thickness behind the screed for a compacted thickness. */
export function looseThickness(compactedIn: number, rolldown = ROLLDOWN): number {
  return compactedIn * (1 + rolldown);
}

export function areaSqft(input: AsphaltInput): number {
  return input.mode === 'sf' ? input.area : input.width * input.length;
}

export function computeAsphalt(input: AsphaltInput): AsphaltResult {
  const sqft = areaSqft(input);
  const waste = 1 + Math.max(0, input.waste) / 100;
  const cuft = (sqft * input.thickness) / 12;
  const tonsNet = (cuft * input.density) / LB_PER_TON;
  const tons = round2(tonsNet * waste);
  const baseCuft = (sqft * input.baseThickness) / 12;
  const baseTonsNet = (baseCuft * input.baseDensity) / LB_PER_TON;
  const baseTons = round2(baseTonsNet * waste);
  const loadsFor = (t: number) =>
    t > 0 && input.truckTons > 0 ? Math.ceil(t / input.truckTons - 1e-9) : 0;
  return {
    sqft,
    sqyd: sqft / SQFT_PER_SQYD,
    cuft,
    cuyd: cuft / CUFT_PER_CUYD,
    tonsNet,
    tons,
    looseIn: looseThickness(input.thickness),
    lbPerSyIn: lbPerSyIn(input.density),
    baseCuft,
    baseCuyd: baseCuft / CUFT_PER_CUYD,
    baseTonsNet,
    baseTons,
    baseTonsPerCuyd: tonsPerCuyd(input.baseDensity),
    loads: loadsFor(tons),
    baseLoads: loadsFor(baseTons),
  };
}

export function laborUnit(p: AsphaltPrices): LaborUnit {
  return p.laborUnit === 9 ? 9 : 1;
}

/** Area in the unit the contractor prices labor by, rounded as it goes on the estimate. */
export function laborQty(r: AsphaltResult, p: AsphaltPrices): number {
  return round2(r.sqft / laborUnit(p));
}

export type PricedAsphalt = {
  material: number | null;
  materialComplete: boolean;
  trucking: number | null;
  labor: number | null;
  total: number | null;
  perSqft: number | null;
  perSqyd: number | null;
};

export function priceAsphalt(r: AsphaltResult, p: AsphaltPrices): PricedAsphalt {
  const parts: [number, number | undefined][] = [
    [r.tons, p.ton],
    [r.baseTons, p.base],
  ];
  const priced = parts.filter(([qty, price]) => qty > 0 && price != null);
  const needed = parts.filter(([qty]) => qty > 0);
  const material = priced.length
    ? round2(priced.reduce((s, [q, pr]) => s + q * (pr ?? 0), 0))
    : null;
  const loads = r.loads + r.baseLoads;
  const trucking = p.load != null && loads > 0 ? round2(loads * p.load) : null;
  const labor = p.labor != null && r.sqft > 0 ? round2(laborQty(r, p) * p.labor) : null;
  const total =
    material == null && trucking == null && labor == null
      ? null
      : round2((material ?? 0) + (trucking ?? 0) + (labor ?? 0));
  return {
    material,
    materialComplete: priced.length === needed.length,
    trucking,
    labor,
    total,
    perSqft: total != null && r.sqft > 0 ? round2(total / r.sqft) : null,
    perSqyd: total != null && r.sqft > 0 ? round2(total / r.sqyd) : null,
  };
}

const num = (n: number) => Number(n.toFixed(2)).toLocaleString('en-US');

export function groupLabel(input: AsphaltInput): string {
  const area =
    input.mode === 'sf'
      ? `${num(input.area)} sq ft`
      : `${num(input.width)} × ${num(input.length)} ft`;
  return `Asphalt · ${area}, ${num(input.thickness)} in`;
}

/** Estimate lines for the tray, priced only where the contractor gave a price. */
export function estimateLines(input: AsphaltInput, r: AsphaltResult, p: AsphaltPrices): NewLine[] {
  const lines: NewLine[] = [];
  const add = (desc: string, qty: number, unit: string, price: number | null) => {
    if (qty > 0) lines.push({ tool: TOOL, desc, qty, unit, price });
  };
  add(`Hot-mix asphalt, ${num(input.thickness)} in compacted`, r.tons, 'tons', p.ton ?? null);
  add(
    `Aggregate base, ${num(input.baseThickness)} in compacted`,
    r.baseTons,
    'tons',
    p.base ?? null
  );
  // Plants often quote mix delivered, so trucking is a line only when it is priced.
  if (p.load != null)
    add(`Trucking, ${num(input.truckTons)}-ton loads`, r.loads + r.baseLoads, 'loads', p.load);
  const unit = LABOR_UNITS[laborUnit(p)];
  add(`Labor: paving, ${num(input.thickness)} in`, laborQty(r, p), unit, p.labor ?? null);
  return lines;
}

/** Inputs ↔ query string, so a result can be shared or reloaded. */
export const PARAM_KEYS = ['m', 'w', 'l', 'a', 't', 'd', 'wst', 'bt', 'bd', 'tr'] as const;

export function toParams(i: AsphaltInput): Record<string, string> {
  return {
    m: i.mode,
    w: String(i.width),
    l: String(i.length),
    a: String(i.area),
    t: String(i.thickness),
    d: String(i.density),
    wst: String(i.waste),
    bt: String(i.baseThickness),
    bd: String(i.baseDensity),
    tr: String(i.truckTons),
  };
}

export function fromParams(q: Record<string, string>): AsphaltInput {
  const d = DEFAULT_INPUT;
  const clamp = (v: string | undefined, fallback: number, max: number) =>
    Math.min(nonNeg(v, fallback), max);
  return {
    mode: Object.keys(MODES).includes(q.m ?? '') ? (q.m as AreaMode) : d.mode,
    width: clamp(q.w, d.width, 10_000),
    length: clamp(q.l, d.length, 10_000),
    area: clamp(q.a, d.area, 5_000_000),
    thickness: clamp(q.t, d.thickness, 24),
    density: clamp(q.d, d.density, 200),
    waste: clamp(q.wst, d.waste, 40),
    baseThickness: clamp(q.bt, d.baseThickness, 36),
    baseDensity: clamp(q.bd, d.baseDensity, 200),
    truckTons: clamp(q.tr, d.truckTons, 40),
  };
}
