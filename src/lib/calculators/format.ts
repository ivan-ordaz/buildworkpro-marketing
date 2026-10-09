// Number parsing and formatting shared by every trade calculator. Inputs are
// typed by contractors on phones, so parsing forgives "$1,250.00" and stray
// spaces; anything that is not a finite number reads as null, never NaN.

export function parseNum(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const cleaned = String(raw).replace(/[$,\s]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** A non-negative number, or the fallback when the field is blank or invalid. */
export function nonNeg(raw: string | null | undefined, fallback = 0): number {
  const n = parseNum(raw);
  return n == null || n < 0 ? fallback : n;
}

export function fmt(n: number, digits = 0): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Up to `digits` decimals, trailing zeros dropped: 12.5 → "12.5", 12 → "12". */
export function fmtTrim(n: number, digits = 2): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: digits });
}

export function money(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${fmt(Math.abs(n), 2)}`;
}
