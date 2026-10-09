// The estimate tray: lines added from any calculator, kept in this browser so a
// contractor can work room by room (or trade by trade) and come back later.
// Pure helpers plus a thin localStorage layer; nothing here touches the DOM, so
// the tests import it directly.

export const ESTIMATE_KEY = 'bwp.tools.estimate.v1';
/** Fired on window after every save so trays on the page re-render. */
export const ESTIMATE_EVENT = 'bwp:estimate-change';

export type EstimateLine = {
  id: string;
  /** Lines added together share a group, e.g. "Drywall · 14 × 12 × 9 ft room". */
  group: string;
  tool: string;
  desc: string;
  qty: number;
  unit: string;
  /** Unit price; null when the contractor has not entered one. */
  price: number | null;
};

export type Estimate = { v: 1; lines: EstimateLine[]; updatedAt: string };

export type NewLine = Omit<EstimateLine, 'id' | 'group'>;

export function emptyEstimate(): Estimate {
  return { v: 1, lines: [], updatedAt: new Date(0).toISOString() };
}

export function lineAmount(line: Pick<EstimateLine, 'qty' | 'price'>): number | null {
  return line.price == null ? null : round2(line.qty * line.price);
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Unit prices under a dollar keep three decimals so a screw at $0.032 reads right. */
export function unitPrice(n: number): string {
  const digits = Math.abs(n) < 1 && Math.abs(n * 100 - Math.round(n * 100)) > 1e-9 ? 3 : 2;
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

/** "1 rolls" → "1 roll". Units are stored plural; area and count units stay as they are. */
export function unitLabel(qty: number, unit: string): string {
  return round2(qty) === 1 && /s$/.test(unit) && !unit.includes(' ') ? unit.slice(0, -1) : unit;
}

export function estimateTotals(e: Estimate): { total: number; priced: number; unpriced: number } {
  let total = 0;
  let priced = 0;
  let unpriced = 0;
  for (const line of e.lines) {
    const amount = lineAmount(line);
    if (amount == null) unpriced += 1;
    else {
      priced += 1;
      total += amount;
    }
  }
  return { total: round2(total), priced, unpriced };
}

/** Groups in the order they were first added. */
export function groups(e: Estimate): { group: string; lines: EstimateLine[] }[] {
  const out: { group: string; lines: EstimateLine[] }[] = [];
  for (const line of e.lines) {
    const existing = out.find((g) => g.group === line.group);
    if (existing) existing.lines.push(line);
    else out.push({ group: line.group, lines: [line] });
  }
  return out;
}

/** "Drywall · room" twice becomes "Drywall · room (2)" so groups stay distinct. */
export function uniqueGroup(e: Estimate, base: string): string {
  const taken = new Set(e.lines.map((l) => l.group));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base} (${n})`)) n += 1;
  return `${base} (${n})`;
}

let seq = 0;
function newId(): string {
  seq += 1;
  return `${Date.now().toString(36)}-${seq.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function withLines(e: Estimate, base: string, lines: NewLine[]): Estimate {
  const group = uniqueGroup(e, base);
  return {
    ...e,
    lines: [...e.lines, ...lines.map((l) => ({ ...l, id: newId(), group }))],
  };
}

export function withoutGroup(e: Estimate, group: string): Estimate {
  return { ...e, lines: e.lines.filter((l) => l.group !== group) };
}

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(e: Estimate): string {
  const rows: (string | number)[][] = [
    ['Group', 'Description', 'Qty', 'Unit', 'Unit price', 'Amount'],
  ];
  for (const line of e.lines) {
    const amount = lineAmount(line);
    rows.push([
      line.group,
      line.desc,
      round2(line.qty),
      line.unit,
      line.price == null ? '' : String(round4(line.price)),
      amount == null ? '' : amount.toFixed(2),
    ]);
  }
  rows.push(['', 'Total', '', '', '', estimateTotals(e).total.toFixed(2)]);
  return rows.map((r) => r.map(csvCell).join(',')).join('\n');
}

export function toText(e: Estimate): string {
  const lines: string[] = [];
  for (const g of groups(e)) {
    lines.push(g.group);
    for (const l of g.lines) {
      const amount = lineAmount(l);
      const qty = `${round2(l.qty).toLocaleString('en-US')} ${unitLabel(l.qty, l.unit)}`;
      lines.push(
        `  ${l.desc}: ${qty}${amount == null ? '' : ` × ${unitPrice(l.price!)} = $${amount.toFixed(2)}`}`
      );
    }
  }
  lines.push(`Total: $${estimateTotals(e).total.toFixed(2)}`);
  return lines.join('\n');
}

function isLine(x: unknown): x is EstimateLine {
  if (!x || typeof x !== 'object') return false;
  const l = x as Record<string, unknown>;
  return (
    typeof l.id === 'string' &&
    typeof l.group === 'string' &&
    typeof l.desc === 'string' &&
    typeof l.qty === 'number' &&
    Number.isFinite(l.qty) &&
    typeof l.unit === 'string' &&
    (l.price === null || (typeof l.price === 'number' && Number.isFinite(l.price)))
  );
}

export function loadEstimate(): Estimate {
  try {
    const raw = localStorage.getItem(ESTIMATE_KEY);
    if (!raw) return emptyEstimate();
    const parsed = JSON.parse(raw) as Partial<Estimate>;
    if (parsed?.v !== 1 || !Array.isArray(parsed.lines)) return emptyEstimate();
    return {
      v: 1,
      lines: parsed.lines.filter(isLine),
      updatedAt: parsed.updatedAt ?? '',
    };
  } catch {
    return emptyEstimate();
  }
}

export function saveEstimate(e: Estimate): boolean {
  let ok = true;
  try {
    localStorage.setItem(
      ESTIMATE_KEY,
      JSON.stringify({ ...e, updatedAt: new Date().toISOString() })
    );
  } catch {
    ok = false;
  }
  window.dispatchEvent(new CustomEvent(ESTIMATE_EVENT));
  return ok;
}
