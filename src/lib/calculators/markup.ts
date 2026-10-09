// Markup vs margin for a contractor's job: a two-way solver (cost plus any one of
// markup, margin or selling price gives the other two and the gross profit), a
// price that covers company overhead and a net profit target, a check of what
// adding those two rates to cost really earns, and a markup → margin table.
// Pure functions only; the page controller and the Playwright spec both import
// them, so the numbers on the page and in the tests come from one place.
//
// Every rate is a percentage the contractor types. There are no constants here
// beyond the definitions themselves:
//   markup = (price − cost) ÷ cost        margin = (price − cost) ÷ price
//   margin = markup ÷ (1 + markup)         markup = margin ÷ (1 − margin)
// The overhead math follows the same definitions: overhead and net profit stated
// as shares of the selling price must fit inside it, so
//   price = cost ÷ (1 − overhead − profit)            (overhead as % of revenue)
//   price = cost × (1 + overhead) ÷ (1 − profit)      (overhead as % of job cost)
// Both are (cost + overhead dollars) ÷ (1 − net profit), the formula the
// construction estimate template on this site uses.
//
// "10 and 10" (10% overhead + 10% profit) on insurance repair estimates is
// charged as 20% on top of the total job estimate (United Policyholders, "What's
// up with overhead and profit", uphelp.org). The added-to-cost check applies the
// contractor's own two rates that way.
//
// Survey figures quoted in the FAQ: CFMA's 2024 Construction Financial
// Benchmarker (fiscal 2023 statements): SG&A 11.8% of revenue across all
// respondents; Specialty Trade net income before taxes 6.9% (Executive Summary,
// cfma.org/benchmarker).
import { nonNeg, parseNum } from './format';
import { estimateTotals, type Estimate } from './estimate';

export const TOOL = 'markup-vs-margin-calculator';

export const SOLVE_BY = ['markup', 'margin', 'price'] as const;
export type SolveBy = (typeof SOLVE_BY)[number];

export const BASES = {
  r: 'Revenue',
  c: 'Job cost',
} as const;
export type Basis = keyof typeof BASES;

/** CFMA 2024 Construction Financial Benchmarker, fiscal 2023 results (Executive Summary). */
export const CFMA_2024 = {
  sgaPct: 11.8, // SG&A as % of revenue, all respondents
  specialtyNetPct: 6.9, // Specialty Trade net income before taxes, % of revenue
} as const;

/** The overhead and profit pair written as "10 and 10" (United Policyholders). */
export const TEN_AND_TEN = { overhead: 10, profit: 10 } as const;

export const LIMITS = {
  cost: 1_000_000_000,
  price: 10_000_000_000,
  markup: 1000,
  rate: 100, // margin, overhead and profit are shares of the price
} as const;

export type MarkupInput = {
  cost: number | null; // job cost, $; null until the contractor enters one
  by: SolveBy; // which of markup, margin or price was entered
  value: number | null; // the entered markup %, margin % or price $
  overhead: number; // company overhead, %
  basis: Basis; // what overhead is a percentage of
  profit: number; // net profit target, % of the selling price
};

export const DEFAULT_INPUT: MarkupInput = {
  cost: null,
  by: 'markup',
  value: 20,
  overhead: TEN_AND_TEN.overhead,
  basis: 'r',
  profit: TEN_AND_TEN.profit,
};

/** Margin % for a markup %: markup ÷ (1 + markup). */
export function marginFromMarkup(markupPct: number): number {
  return (markupPct / (100 + markupPct)) * 100;
}

/** Markup % for a margin %: margin ÷ (1 − margin). Null at 100% and above. */
export function markupFromMargin(marginPct: number): number | null {
  return marginPct < 100 ? (marginPct / (100 - marginPct)) * 100 : null;
}

export type Solved = {
  markup: number | null;
  margin: number | null;
  price: number | null;
  profit: number | null;
  error: string | null;
};

const none = (error: string | null = null): Solved => ({
  markup: null,
  margin: null,
  price: null,
  profit: null,
  error,
});

/** Cost plus any one of markup %, margin % or selling price → the other two and gross profit. */
export function solve(cost: number | null, by: SolveBy, value: number | null): Solved {
  if (value == null) return none();
  if (by === 'markup') {
    const price = cost == null ? null : cost * (1 + value / 100);
    return {
      markup: value,
      margin: marginFromMarkup(value),
      price,
      profit: price == null || cost == null ? null : price - cost,
      error: null,
    };
  }
  if (by === 'margin') {
    const markup = markupFromMargin(value);
    if (markup == null) return none('A margin has to be under 100%.');
    const price = cost == null ? null : cost / (1 - value / 100);
    return {
      markup,
      margin: value,
      price,
      profit: price == null || cost == null ? null : price - cost,
      error: null,
    };
  }
  if (cost == null || cost <= 0) return none('Enter the job cost to work back from a price.');
  const profit = value - cost;
  return {
    markup: (profit / cost) * 100,
    margin: value > 0 ? (profit / value) * 100 : null,
    price: value,
    profit,
    error: null,
  };
}

export type OverheadResult = {
  error: string | null;
  /** Price ÷ cost needed to cover overhead and keep the net profit. */
  factor: number | null;
  markup: number | null;
  margin: number | null;
  price: number | null;
  overheadAmt: number | null;
  netAmt: number | null;
};

/** The selling price that covers company overhead and leaves the net profit target. */
export function priceForOverhead(
  cost: number | null,
  overhead: number,
  basis: Basis,
  profit: number
): OverheadResult {
  const fail = (error: string): OverheadResult => ({
    error,
    factor: null,
    markup: null,
    margin: null,
    price: null,
    overheadAmt: null,
    netAmt: null,
  });
  let factor: number;
  if (basis === 'r') {
    if (overhead + profit >= 100) return fail('Overhead plus profit has to be under 100%.');
    factor = 1 / (1 - (overhead + profit) / 100);
  } else {
    if (profit >= 100) return fail('Net profit has to be under 100%.');
    factor = (1 + overhead / 100) / (1 - profit / 100);
  }
  const price = cost == null ? null : cost * factor;
  return {
    error: null,
    factor,
    markup: (factor - 1) * 100,
    margin: (1 - 1 / factor) * 100,
    price,
    overheadAmt:
      cost == null || price == null
        ? null
        : basis === 'r'
          ? (price * overhead) / 100
          : (cost * overhead) / 100,
    netAmt: price == null ? null : (price * profit) / 100,
  };
}

export type AddedCheck = {
  /** Overhead % + profit %, added to cost as one markup. */
  markup: number;
  /** Gross margin that markup gives. */
  margin: number;
  /** Overhead as a share of that price. */
  overheadShare: number;
  /** What is left as net profit, % of that price. */
  net: number;
  price: number | null;
  /** How far below the price that covers both it lands, $ and % of cost. */
  shortBy: number | null;
  shortPctOfCost: number | null;
};

/** What adding overhead % and profit % to cost ("10 and 10" style) really earns. */
export function addedToCost(
  cost: number | null,
  overhead: number,
  basis: Basis,
  profit: number
): AddedCheck {
  const markup = overhead + profit;
  const factor = 1 + markup / 100;
  const margin = marginFromMarkup(markup);
  const overheadShare = basis === 'r' ? overhead : overhead / factor;
  const needed = priceForOverhead(cost, overhead, basis, profit).factor;
  const shortPctOfCost = needed == null ? null : (needed - factor) * 100;
  return {
    markup,
    margin,
    overheadShare,
    net: margin - overheadShare,
    price: cost == null ? null : cost * factor,
    shortBy: cost == null || shortPctOfCost == null ? null : (cost * shortPctOfCost) / 100,
    shortPctOfCost,
  };
}

/** Overhead rate from last year's books: annual overhead ÷ annual revenue (or job cost). */
export function overheadRate(annualOverhead: number | null, annualBase: number | null) {
  if (annualOverhead == null || annualBase == null || annualBase <= 0) return null;
  return (annualOverhead / annualBase) * 100;
}

export const TABLE_MARKUPS = [10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 75, 80, 90, 100] as const;
export const TABLE_MARGINS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50] as const;

/** Markup → margin rows for the conversion table. */
export function markupTable(markups: readonly number[] = TABLE_MARKUPS) {
  return markups.map((markup) => ({ markup, margin: marginFromMarkup(markup) }));
}

/** Margin → markup-needed rows for the conversion table. */
export function marginTable(margins: readonly number[] = TABLE_MARGINS) {
  return margins.map((margin) => ({ margin, markup: markupFromMargin(margin) ?? 0 }));
}

/** The priced total of the shared estimate, or null when nothing in it is priced. */
export function estimateCost(
  e: Estimate
): { total: number; priced: number; unpriced: number } | null {
  const t = estimateTotals(e);
  return t.priced > 0 && t.total > 0 ? t : null;
}

/** "16.67%": up to two decimals, trailing zeros dropped. */
export function pct(n: number, digits = 2): string {
  const rounded = Number(n.toFixed(digits)) + 0; // + 0 turns -0 into 0
  return `${rounded.toLocaleString('en-US', { maximumFractionDigits: digits })}%`;
}

/** Inputs ↔ query string. The overhead helper's annual figures are never put in the URL. */
export const PARAM_KEYS = ['c', 'by', 'v', 'oh', 'ob', 'np'] as const;

const num = (n: number) => String(Number(n.toFixed(4)));

export function toParams(i: MarkupInput): Record<string, string> {
  const out: Record<string, string> = {};
  if (i.cost != null) out.c = num(i.cost);
  out.by = i.by;
  out.v = i.value == null ? '' : num(i.value);
  out.oh = num(i.overhead);
  out.ob = i.basis;
  out.np = num(i.profit);
  return out;
}

export function fromParams(q: Record<string, string>): MarkupInput {
  const d = DEFAULT_INPUT;
  const cost = parseNum(q.c);
  const by = (SOLVE_BY as readonly string[]).includes(q.by ?? '') ? (q.by as SolveBy) : d.by;
  const max = by === 'markup' ? LIMITS.markup : by === 'margin' ? LIMITS.rate : LIMITS.price;
  // No v and no by means a fresh page: show the example. An empty v means the field was cleared.
  let value: number | null = d.value;
  if (q.v != null || q.by != null) {
    const n = parseNum(q.v);
    value = n == null || n < 0 ? null : Math.min(n, max);
  }
  return {
    cost: cost == null || cost < 0 ? null : Math.min(cost, LIMITS.cost),
    by,
    value,
    overhead: Math.min(nonNeg(q.oh, d.overhead), LIMITS.rate),
    basis: q.ob && q.ob in BASES ? (q.ob as Basis) : d.basis,
    profit: Math.min(nonNeg(q.np, d.profit), LIMITS.rate),
  };
}
