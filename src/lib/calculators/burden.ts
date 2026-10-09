// Labor burden for one employee (or one crew rate): annual wages, the employer's
// payroll taxes, workers' comp, payroll-rated liability and benefits, then the
// fully burdened cost per paid hour and per billable hour, and a billing rate at
// the contractor's target margin. Pure functions only; the page controller and
// the Playwright spec both import them, so the numbers on the page and in the
// tests come from one place.
//
// Federal payroll taxes (employer share), 2026:
//   Social Security 6.2% of wages up to the $184,500 wage base. IRS Publication 15
//     (2026), "What's New" and section 9 (https://www.irs.gov/publications/p15);
//     SSA 2026 COLA fact sheet, maximum taxable earnings $184,500, up from
//     $176,100 in 2025 (https://www.ssa.gov/cola/factsheets/2026.html).
//   Medicare 1.45% of all wages, no wage base. Pub 15 (2026). The 0.9% Additional
//     Medicare Tax over $200,000 is withheld from the employee only; Pub 15 says
//     "There is no employer share of Additional Medicare Tax."
//   FUTA 6.0% of the first $7,000 of each employee's wages, less a credit of up to
//     5.4% for state unemployment tax paid on time: 0.6% net. IRS Topic 759
//     (https://www.irs.gov/taxtopics/tc759) and Pub 15 (2026) section 14. The credit
//     is smaller in credit reduction states (for 2025: California, 1.2% reduction,
//     1.8% net; U.S. Virgin Islands, 4.5% reduction), so the net rate is an input.
// Everything else is the contractor's own number: the state unemployment (SUTA)
// rate and wage base are assigned by each state, workers' comp is a rate per $100
// of payroll set by class code, state and experience mod (NCCI; e.g. Tennessee's
// "How Rates for Insurance Premiums are Set"), and general liability on a payroll
// basis is a rate per $1,000 of payroll (ISO premium bases; IRMI "exposure base").
// No defaults are invented for any of them.
import { fmt, fmtTrim, money, nonNeg, parseNum } from './format';
import { round2, type NewLine } from './estimate';

export const TOOL = 'labor-burden-calculator';

/** The year the federal figures below are for. Wage bases change every January. */
export const TAX_YEAR = 2026;
export const SS_RATE = 6.2; // %, employer share
export const SS_WAGE_BASE = 184_500; // 2026, SSA / Pub 15 (2026)
export const MEDICARE_RATE = 1.45; // %, employer share, no wage base
export const FUTA_GROSS_RATE = 6.0; // %
export const FUTA_MAX_CREDIT = 5.4; // %
export const FUTA_NET_RATE = 0.6; // %, after the full state credit
export const FUTA_WAGE_BASE = 7_000;
/** A full-time year: 40 hours × 52 weeks. */
export const FULL_TIME_HOURS = 2_080;

export const BASES = {
  bill: 'Billing rate',
  cost: 'Burdened cost',
} as const;
export type Basis = keyof typeof BASES;

/** The employee and the job: kept in the page address so a link reproduces it. */
export type BurdenInput = {
  wage: number | null; // base wage, $ per hour
  hours: number; // paid hours per year
  holiday: number; // paid holiday hours per year
  pto: number; // paid time off and sick hours per year
  training: number; // paid training and safety meeting hours per year
  shop: number; // paid shop, yard and drive hours per year
  jobHours: number | null; // hours to add to the estimate
  basis: Basis; // price those hours at the billing rate or the burdened cost
};

export const DEFAULT_INPUT: BurdenInput = {
  wage: null,
  hours: FULL_TIME_HOURS,
  holiday: 0,
  pto: 0,
  training: 0,
  shop: 0,
  jobHours: null,
  basis: 'bill',
};

/** The contractor's own rates, remembered in this browser. Blank means not entered. */
export type BurdenRates = {
  futa?: number; // net FUTA rate, %; blank means the standard 0.6%
  sutaRate?: number; // %
  sutaBase?: number; // $ of wages per employee per year
  wc?: number; // $ per $100 of payroll
  gl?: number; // $ per $1,000 of payroll
  health?: number; // employer share, $ per month
  retire?: number; // retirement match, % of wages
  other?: number; // $ per year
  margin?: number; // target margin, %
};

export const RATE_KEYS = [
  'futa',
  'sutaRate',
  'sutaBase',
  'wc',
  'gl',
  'health',
  'retire',
  'other',
  'margin',
] as const satisfies readonly (keyof BurdenRates)[];

/**
 * The worked example quoted in the FAQ and the method section. The wage, hours
 * and every rate past the federal taxes are illustrations, labeled as examples
 * on the page; they are not defaults and are never filled into the calculator.
 */
export const EXAMPLE_INPUT: BurdenInput = {
  wage: 30,
  hours: FULL_TIME_HOURS,
  holiday: 48, // 6 paid holidays
  pto: 80, // 10 days
  training: 16,
  shop: 104, // 2 hours a week
  jobHours: null,
  basis: 'bill',
};
export const EXAMPLE_RATES: BurdenRates = {
  sutaRate: 3,
  sutaBase: 10_000,
  wc: 8,
  gl: 10,
  health: 600,
  retire: 3,
  other: 0,
  margin: 25,
};

export type ItemId =
  'ss' | 'medicare' | 'futa' | 'suta' | 'wc' | 'gl' | 'health' | 'retire' | 'other';

export const ITEMS: { id: ItemId; label: string }[] = [
  { id: 'ss', label: 'Social Security' },
  { id: 'medicare', label: 'Medicare' },
  { id: 'futa', label: 'Federal unemployment (FUTA)' },
  { id: 'suta', label: 'State unemployment (SUTA)' },
  { id: 'wc', label: 'Workers’ comp' },
  { id: 'gl', label: 'General liability' },
  { id: 'health', label: 'Health insurance' },
  { id: 'retire', label: 'Retirement match' },
  { id: 'other', label: 'Other' },
];

export type BurdenItem = {
  id: ItemId;
  /** $ per year, rounded to the cent; null when the contractor has not entered the rate. */
  amount: number | null;
  /** How the amount was worked out, or what to enter. */
  note: string;
};

export type BurdenResult = {
  wages: number;
  nonBillable: number;
  billableHours: number;
  items: BurdenItem[];
  missing: ItemId[];
  burden: number;
  /** Burden as a percentage of wages. */
  burdenPct: number;
  /** Federal payroll taxes alone (Social Security, Medicare, FUTA). */
  federal: number;
  annualCost: number;
  /** Wages + burden ÷ paid hours, to the cent. */
  perPaidHour: number | null;
  /** Wages + burden ÷ billable hours, to the cent. */
  perBillableHour: number | null;
  /** Cost per billable hour ÷ (1 − margin), to the cent. */
  billingRate: number | null;
  /** The markup on cost that gives the same price. */
  markupPct: number | null;
};

const pctOf = (rate: number, base: number) => round2((base * rate) / 100);

/** Dollars without cents when there are none: 184500 → "$184,500", 62400.5 → "$62,400.50". */
export function usd(n: number): string {
  return Number.isInteger(round2(n)) ? `$${fmt(n)}` : money(n);
}

/** Price = cost ÷ (1 − margin), the same margin math as the markup vs margin calculator. */
export function priceAtMargin(cost: number, marginPct: number): number | null {
  if (!(marginPct >= 0 && marginPct < 100)) return null;
  return round2(cost / (1 - marginPct / 100));
}

/** Markup that gives the same price as a margin: margin ÷ (1 − margin). */
export function markupFor(marginPct: number): number | null {
  return marginPct >= 0 && marginPct < 100 ? (marginPct / (100 - marginPct)) * 100 : null;
}

export function computeBurden(input: BurdenInput, rates: BurdenRates): BurdenResult {
  const wage = input.wage ?? 0;
  const wages = round2(wage * input.hours);
  const nonBillable = input.holiday + input.pto + input.training + input.shop;
  const billableHours = Math.max(0, input.hours - nonBillable);
  const futaRate = rates.futa ?? FUTA_NET_RATE;
  const ssBase = Math.min(wages, SS_WAGE_BASE);
  const futaBase = Math.min(wages, FUTA_WAGE_BASE);
  const sutaCap = rates.sutaBase != null && rates.sutaBase > 0 ? rates.sutaBase : null;
  const sutaBase = sutaCap == null ? wages : Math.min(wages, sutaCap);
  /** "of $62,400", or "of wages" before a wage is entered. */
  const of = (base: number) => (wages > 0 ? `of ${usd(base)}` : 'of wages');

  const items: BurdenItem[] = [
    {
      id: 'ss',
      amount: pctOf(SS_RATE, ssBase),
      note:
        wages > SS_WAGE_BASE
          ? `${SS_RATE}% of the first ${usd(SS_WAGE_BASE)} (${TAX_YEAR} wage base)`
          : `${SS_RATE}% ${of(wages)}, up to the ${TAX_YEAR} wage base of ${usd(SS_WAGE_BASE)}`,
    },
    {
      id: 'medicare',
      amount: pctOf(MEDICARE_RATE, wages),
      note: `${MEDICARE_RATE}% ${of(wages)}, no wage base`,
    },
    {
      id: 'futa',
      amount: pctOf(futaRate, futaBase),
      note: `${fmtTrim(futaRate, 3)}% of the first ${usd(FUTA_WAGE_BASE)}`,
    },
    {
      id: 'suta',
      amount: rates.sutaRate == null ? null : pctOf(rates.sutaRate, sutaBase),
      note:
        rates.sutaRate == null
          ? 'Enter your state rate and wage base'
          : sutaCap != null
            ? `${fmtTrim(rates.sutaRate, 3)}% of the first ${usd(sutaCap)}`
            : `${fmtTrim(rates.sutaRate, 3)}% of all wages. Enter your state wage base.`,
    },
    {
      id: 'wc',
      amount: rates.wc == null ? null : round2((wages * rates.wc) / 100),
      note:
        rates.wc == null
          ? 'Enter your rate per $100 of payroll'
          : `${money(rates.wc)} per $100 of payroll`,
    },
    {
      id: 'gl',
      amount: rates.gl == null ? null : round2((wages * rates.gl) / 1000),
      note:
        rates.gl == null
          ? 'Enter your rate per $1,000 of payroll'
          : `${money(rates.gl)} per $1,000 of payroll`,
    },
    {
      id: 'health',
      amount: rates.health == null ? null : round2(rates.health * 12),
      note:
        rates.health == null ? 'Enter your share per month' : `${usd(rates.health)} a month × 12`,
    },
    {
      id: 'retire',
      amount: rates.retire == null ? null : pctOf(rates.retire, wages),
      note: rates.retire == null ? 'Enter your match' : `${fmtTrim(rates.retire, 3)}% of wages`,
    },
    {
      id: 'other',
      amount: rates.other == null ? null : round2(rates.other),
      note: rates.other == null ? 'Enter 0 if none' : `${usd(rates.other)} a year`,
    },
  ];

  const burden = round2(items.reduce((s, i) => s + (i.amount ?? 0), 0));
  const federal = round2(items.slice(0, 3).reduce((s, i) => s + (i.amount ?? 0), 0));
  const annualCost = round2(wages + burden);
  const has = wages > 0;
  const perPaidHour = has && input.hours > 0 ? round2(annualCost / input.hours) : null;
  const perBillableHour = has && billableHours > 0 ? round2(annualCost / billableHours) : null;
  const margin = rates.margin;
  return {
    wages,
    nonBillable,
    billableHours,
    items,
    missing: items.filter((i) => i.amount == null).map((i) => i.id),
    burden,
    burdenPct: has ? (burden / wages) * 100 : 0,
    federal,
    annualCost,
    perPaidHour,
    perBillableHour,
    billingRate:
      perBillableHour != null && margin != null ? priceAtMargin(perBillableHour, margin) : null,
    markupPct: margin != null ? markupFor(margin) : null,
  };
}

export function groupLabel(input: BurdenInput, r: BurdenResult): string {
  const wage = money(input.wage ?? 0);
  return `Labor · ${wage}/hr base wage, ${fmtTrim(r.burdenPct, 1)}% burden`;
}

/** Why the hours cannot be added yet, or null when they can. */
export function estimateBlocker(
  input: BurdenInput,
  r: BurdenResult,
  rates: BurdenRates
): string | null {
  if (r.wages <= 0) return 'Enter a base wage first.';
  if (r.perBillableHour == null) return 'Billable hours are zero. Check the hours not billed.';
  if (!input.jobHours) return 'Enter the hours for this job first.';
  if (input.basis === 'bill' && r.billingRate == null)
    return rates.margin != null && rates.margin >= 100
      ? 'A margin has to be under 100%.'
      : 'Enter a target margin, or price the hours at burdened cost.';
  return null;
}

/** One labor line for the tray: the job's hours at the billing rate or the burdened cost. */
export function estimateLines(input: BurdenInput, r: BurdenResult, rates: BurdenRates): NewLine[] {
  if (estimateBlocker(input, r, rates) != null) return [];
  const bill = input.basis === 'bill';
  const desc = bill
    ? `Labor, billed at ${fmtTrim(rates.margin ?? 0, 2)}% margin on burdened cost`
    : 'Labor at fully burdened cost';
  return [
    {
      tool: TOOL,
      desc,
      qty: input.jobHours ?? 0,
      unit: 'hrs',
      price: bill ? r.billingRate : r.perBillableHour,
    },
  ];
}

/** Inputs ↔ query string, so a result can be shared or reloaded. Rates stay out of it. */
export const PARAM_KEYS = ['w', 'h', 'hol', 'pto', 'trn', 'shop', 'jh', 'jb'] as const;

const opt = (n: number | null) => (n == null ? '' : String(n));

export function toParams(i: BurdenInput): Record<string, string> {
  return {
    w: opt(i.wage),
    h: String(i.hours),
    hol: String(i.holiday),
    pto: String(i.pto),
    trn: String(i.training),
    shop: String(i.shop),
    jh: opt(i.jobHours),
    jb: i.basis,
  };
}

/** The query string to put in the address bar: empty fields left out. */
export function urlParams(i: BurdenInput): Record<string, string> {
  return Object.fromEntries(Object.entries(toParams(i)).filter(([, v]) => v !== ''));
}

/** A positive number up to `max`, or null when blank, zero or invalid. */
function positiveOrNull(raw: string | undefined, max: number): number | null {
  const n = parseNum(raw);
  return n == null || n <= 0 ? null : Math.min(n, max);
}

export function fromParams(q: Record<string, string>): BurdenInput {
  const d = DEFAULT_INPUT;
  const hrs = (v: string | undefined, fallback: number) => Math.min(nonNeg(v, fallback), 8_760);
  return {
    wage: positiveOrNull(q.w, 1_000),
    hours: Math.max(1, Math.min(nonNeg(q.h, d.hours) || d.hours, 8_760)),
    holiday: hrs(q.hol, d.holiday),
    pto: hrs(q.pto, d.pto),
    training: hrs(q.trn, d.training),
    shop: hrs(q.shop, d.shop),
    jobHours: positiveOrNull(q.jh, 100_000),
    basis: q.jb && q.jb in BASES ? (q.jb as Basis) : d.basis,
  };
}
