// Voltage drop on one run of copper or aluminum conductors: drop in volts and
// percent, the voltage left at the load, a pass or fail against the contractor's
// target, the smallest size of the same material that meets it, the longest run
// the entered size can make, and the wire footage to put on an estimate. Pure
// functions only; the page controller and the Playwright spec both import them,
// so the numbers on the page and in the tests come from one place.
//
// Method: the K (circular-mil) method.
//   single phase: VD = 2 × K × I × L ÷ CM
//   three phase:  VD = √3 × K × I × L ÷ CM
// with L the one-way length in feet, I the load current, CM the circular mils of
// one conductor times the parallel sets. K is DC resistance per circular-mil foot
// at 75 °C: 12.9 Ω for copper and 21.2 Ω for aluminum (Mike Holt, "Code
// Calculations", EC&M, Feb. 2000). Cross-check: annealed copper at 100% IACS is
// 10.371 Ω·cmil/ft at 20 °C with a 0.00393/°C coefficient (ASTM B233), which is
// 12.61 at 75 °C for solid wire; stranding adds a little more, hence 12.9. The K
// method ignores reactance and power factor, which matters most on 2/0 and
// larger. It does not check ampacity.
//
// Circular mils come from the AWG definition (ASTM B258): diameter
// d = 0.005 in × 92^((36 − n) ÷ 39), with n = 0 for 1/0, −1 for 2/0 and so on,
// and area in circular mils = (d in mils)². kcmil sizes are their stated area.
//
// NEC references are 2023 edition section numbers, cited by number only:
//   210.19 Informational Note (branch circuits) and 215.2(A)(2) Informational
//   Note No. 2 (feeders): 3% branch, 5% feeder plus branch combined. Earlier
//   editions numbered these 210.19(A) and 215.2(A)(1). Informational notes are
//   not enforceable (90.5(C)). Numbering checked against NFPA's Second
//   Correlating Revision No. 124 for the 2023 NEC.
//   310.3(A): smallest aluminum conductor is 12 AWG.
//   310.10(G): conductors in parallel are 1/0 AWG and larger (with exceptions).
//   250.122(B): upsizing the ungrounded conductors means upsizing a wire-type
//   equipment grounding conductor in proportion.
import { fmtTrim, nonNeg } from './format';
import { round2, type NewLine } from './estimate';

export const TOOL = 'voltage-drop-calculator';

/** Ω per circular-mil foot at 75 °C (Mike Holt, EC&M "Code Calculations"). */
export const K = { cu: 12.9, al: 21.2 } as const;

export const MATERIALS = { cu: 'copper', al: 'aluminum' } as const;
export type Material = keyof typeof MATERIALS;

export const VOLTAGES = ['120', '208', '240', '277', '480'] as const;
export type VoltKey = (typeof VOLTAGES)[number] | 'custom';

export const PHASES = { '1': 'Single phase', '3': 'Three phase' } as const;
export type Phase = keyof typeof PHASES;

/** The NEC informational-note recommendations, in percent. */
export const NEC_BRANCH_PCT = 3;
export const NEC_COMBINED_PCT = 5;

/** Circular mils of AWG size n from the ASTM B258 definition (n = 0 for 1/0, −3 for 4/0). */
export function awgCmil(n: number): number {
  const dMils = 5 * Math.pow(92, (36 - n) / 39);
  return dMils * dMils;
}

export const SIZE_IDS = [
  '14',
  '12',
  '10',
  '8',
  '6',
  '4',
  '3',
  '2',
  '1',
  '1-0',
  '2-0',
  '3-0',
  '4-0',
  '250',
  '300',
  '350',
  '400',
  '500',
] as const;
export type SizeId = (typeof SIZE_IDS)[number];

function sizeOf(id: SizeId): { label: string; cmil: number } {
  if (id.endsWith('-0')) {
    const aughts = Number(id[0]);
    return { label: `${aughts}/0 AWG`, cmil: awgCmil(1 - aughts) };
  }
  const n = Number(id);
  return n >= 250
    ? { label: `${n} kcmil`, cmil: n * 1000 }
    : { label: `${n} AWG`, cmil: awgCmil(n) };
}

export const SIZES = Object.fromEntries(SIZE_IDS.map((id) => [id, sizeOf(id)])) as Record<
  SizeId,
  { label: string; cmil: number }
>;

/** Smallest aluminum conductor (NEC 310.3(A)). */
export const MIN_ALUMINUM: SizeId = '12';
/** Smallest conductor run in parallel (NEC 310.10(G)). */
export const MIN_PARALLEL: SizeId = '1-0';
/** From here up the K method's neglect of reactance starts to matter. */
export const REACTANCE_FROM: SizeId = '2-0';

const rank = (id: SizeId) => SIZE_IDS.indexOf(id);
const larger = (a: SizeId, b: SizeId): SizeId => (rank(a) >= rank(b) ? a : b);

/** The smallest size the code lets you use for this material and number of parallel sets. */
export function minAllowed(material: Material, sets: number): SizeId {
  const base: SizeId = material === 'al' ? MIN_ALUMINUM : '14';
  return sets > 1 ? larger(base, MIN_PARALLEL) : base;
}

export type VdropInput = {
  volts: VoltKey;
  customVolts: number;
  phase: Phase;
  material: Material;
  size: SizeId;
  length: number; // one-way, ft
  amps: number; // load current, A
  sets: number; // parallel sets
  target: number; // max drop, %
  conductors: number; // conductors of this size per set, for the estimate
  extra: number; // makeup allowance, %
  pick: WirePick; // which size goes on the estimate
};

export const PICKS = {
  rec: 'Meets the target',
  sel: 'Size you entered',
} as const;
export type WirePick = keyof typeof PICKS;

/** Typical makeup allowance; the electrical estimate template starts at the same 10%. */
export const TYPICAL_EXTRA = 10;

/** Conductors of one size per set: two for a single-phase load, three for three phase. */
export const DEFAULT_CONDUCTORS: Record<Phase, number> = { '1': 2, '3': 3 };

export const DEFAULT_INPUT: VdropInput = {
  volts: '240',
  customVolts: 240,
  phase: '1',
  material: 'cu',
  size: '10',
  length: 150,
  amps: 30,
  sets: 1,
  target: NEC_BRANCH_PCT,
  conductors: DEFAULT_CONDUCTORS['1'],
  extra: TYPICAL_EXTRA,
  pick: 'rec',
};

export function systemVolts(input: Pick<VdropInput, 'volts' | 'customVolts'>): number {
  return input.volts === 'custom' ? input.customVolts : Number(input.volts);
}

/** Drop in volts for one run; L is the one-way length. */
export function voltageDrop(
  phase: Phase,
  material: Material,
  cmil: number,
  amps: number,
  length: number,
  sets = 1
): number {
  if (cmil <= 0 || sets <= 0) return 0;
  const mult = phase === '3' ? Math.sqrt(3) : 2;
  return (mult * K[material] * amps * length) / (cmil * sets);
}

export type SizeCheck = { size: SizeId; drop: number; pct: number };

export type VdropResult = {
  volts: number;
  drop: number;
  pct: number;
  loadVolts: number;
  passes: boolean;
  allowedDrop: number;
  /** Smallest size of the same material (and sets) that meets the target; null if none up to 500 kcmil. */
  min: SizeCheck | null;
  /** Larger of the entered size and `min`: what to install if the entered size is your ampacity size. */
  install: SizeId | null;
  /** Longest one-way run the entered size can make at the target; null when there is no load. */
  maxLength: number | null;
};

const EPS = 1e-9;

export function checkSize(input: VdropInput, size: SizeId): SizeCheck {
  const volts = systemVolts(input);
  const drop = voltageDrop(
    input.phase,
    input.material,
    SIZES[size].cmil,
    input.amps,
    input.length,
    input.sets
  );
  return { size, drop, pct: volts > 0 ? (drop / volts) * 100 : 0 };
}

export function computeVdrop(input: VdropInput): VdropResult {
  const volts = systemVolts(input);
  const entered = checkSize(input, input.size);
  const passes = entered.pct <= input.target + EPS;
  const start = rank(minAllowed(input.material, input.sets));
  let min: SizeCheck | null = null;
  for (const id of SIZE_IDS.slice(start)) {
    const c = checkSize(input, id);
    if (c.pct <= input.target + EPS) {
      min = c;
      break;
    }
  }
  const perFoot = voltageDrop(
    input.phase,
    input.material,
    SIZES[input.size].cmil,
    input.amps,
    1,
    input.sets
  );
  return {
    volts,
    drop: entered.drop,
    pct: entered.pct,
    loadVolts: volts - entered.drop,
    passes,
    allowedDrop: (volts * input.target) / 100,
    min,
    install: passes ? input.size : min ? larger(input.size, min.size) : null,
    maxLength: perFoot > 0 ? (volts * input.target) / 100 / perFoot : null,
  };
}

/** The size that goes on the estimate, or null when the target cannot be met up to 500 kcmil. */
export function wireSize(input: VdropInput, r: VdropResult): SizeId | null {
  return input.pick === 'sel' ? input.size : r.install;
}

/** Conductors × one-way length × sets, plus the makeup allowance, rounded up to the foot. */
export function wireFeet(input: VdropInput): number {
  const raw = input.conductors * input.length * input.sets * (1 + Math.max(0, input.extra) / 100);
  return raw > 0 ? Math.ceil(raw - EPS) : 0;
}

/** Remembered prices are per foot, keyed by material and size: "cu-8", "al-4-0". */
export function priceKey(material: Material, size: SizeId): string {
  return `${material}-${size}`;
}

export function wireCost(feet: number, perFoot: number | undefined): number | null {
  return perFoot == null || feet <= 0 ? null : round2(feet * perFoot);
}

export function wireLabel(material: Material, size: SizeId): string {
  return `${SIZES[size].label} ${MATERIALS[material]}`;
}

/** "2 conductors × 150 ft, +10% makeup" (sets shown only when parallel). */
export function footageNote(input: VdropInput): string {
  const sets = input.sets > 1 ? ` × ${input.sets} sets` : '';
  const each = input.conductors === 1 ? 'conductor' : 'conductors';
  const extra = input.extra > 0 ? `, +${fmtTrim(input.extra)}% makeup` : '';
  return `${input.conductors} ${each} × ${fmtTrim(input.length)} ft${sets}${extra}`;
}

export function groupLabel(input: VdropInput): string {
  return `Wire · ${fmtTrim(input.amps)} A at ${fmtTrim(systemVolts(input))} V ${
    input.phase === '3' ? 'three' : 'single'
  } phase, ${fmtTrim(input.length)} ft`;
}

/** Estimate lines for the tray, priced only where the contractor gave a price. */
export function estimateLines(
  input: VdropInput,
  r: VdropResult,
  prices: Record<string, number>
): NewLine[] {
  const size = wireSize(input, r);
  const feet = wireFeet(input);
  if (size == null || feet <= 0) return [];
  return [
    {
      tool: TOOL,
      desc: `${wireLabel(input.material, size)} wire, ${footageNote(input)}`,
      qty: feet,
      unit: 'ft',
      price: prices[priceKey(input.material, size)] ?? null,
    },
  ];
}

/** Code and method notes that apply to these inputs. */
export function notes(input: VdropInput, r: VdropResult): string[] {
  const out: string[] = [];
  const v = systemVolts(input);
  if (input.material === 'al' && rank(input.size) < rank(MIN_ALUMINUM))
    out.push('14 AWG aluminum is below the NEC minimum for aluminum, 12 AWG (310.3(A)).');
  if (input.sets > 1 && rank(input.size) < rank(MIN_PARALLEL))
    out.push(
      'Parallel sets must be 1/0 AWG or larger (NEC 310.10(G)), apart from a few exceptions.'
    );
  if (input.phase === '3' && (v === 120 || v === 277))
    out.push(
      `${v} V is a line-to-neutral voltage. A three-phase load is fed at the line-to-line voltage, such as 208 or 480 V.`
    );
  if (r.install != null && r.install !== input.size)
    out.push(
      `If ${SIZES[input.size].label} is your ampacity size, going up to ${SIZES[r.install].label} for voltage drop means increasing a wire-type equipment grounding conductor in proportion to the circular mils (NEC 250.122(B)).`
    );
  const biggest = r.install != null ? larger(input.size, r.install) : input.size;
  if (rank(biggest) >= rank(REACTANCE_FROM))
    out.push(
      'At 2/0 and larger, reactance matters and the K method can understate the drop, most in steel conduit. Check big feeders with AC impedance and the load’s power factor.'
    );
  if (r.min == null)
    out.push(
      `No single ${MATERIALS[input.material]} size up to 500 kcmil meets ${fmtTrim(input.target)}%. Add a parallel set, shorten the run or raise the voltage.`
    );
  return out;
}

/** Inputs ↔ query string, so a result can be shared or reloaded. */
export const PARAM_KEYS = ['v', 'vc', 'ph', 'm', 's', 'l', 'a', 'p', 't', 'n', 'x', 'w'] as const;

export function toParams(i: VdropInput): Record<string, string> {
  return {
    v: i.volts,
    vc: String(i.customVolts),
    ph: i.phase,
    m: i.material,
    s: i.size,
    l: String(i.length),
    a: String(i.amps),
    p: String(i.sets),
    t: String(i.target),
    n: String(i.conductors),
    x: String(i.extra),
    w: i.pick,
  };
}

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);

export function fromParams(q: Record<string, string>): VdropInput {
  const d = DEFAULT_INPUT;
  // Zero or blank on a divisor or count falls back to the default instead of breaking the math.
  const positive = (v: string | undefined, fallback: number, lo: number, hi: number) =>
    clamp(nonNeg(v, fallback) || fallback, lo, hi);
  const volts: VoltKey =
    q.v === 'custom' || (VOLTAGES as readonly string[]).includes(q.v ?? '')
      ? (q.v as VoltKey)
      : d.volts;
  return {
    volts,
    customVolts: positive(q.vc, d.customVolts, 1, 1000),
    phase: q.ph && q.ph in PHASES ? (q.ph as Phase) : d.phase,
    material: q.m && q.m in MATERIALS ? (q.m as Material) : d.material,
    size: (SIZE_IDS as readonly string[]).includes(q.s ?? '') ? (q.s as SizeId) : d.size,
    length: Math.min(nonNeg(q.l, d.length), 10000),
    amps: Math.min(nonNeg(q.a, d.amps), 5000),
    sets: Math.round(positive(q.p, d.sets, 1, 10)),
    target: positive(q.t, d.target, 0.1, 20),
    conductors: Math.round(positive(q.n, d.conductors, 1, 6)),
    extra: Math.min(nonNeg(q.x, d.extra), 50),
    pick: q.w && q.w in PICKS ? (q.w as WirePick) : d.pick,
  };
}
