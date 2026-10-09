// Producer Price Index helpers for /prices/. Pure functions over the data file
// written by scripts/prices/fetch-ppi.mjs, shared by the pages and the tests so
// every number on the site and in the specs comes from one place.
//
// A PPI value is an index, not a dollar price. Everything here is a ratio
// between two months of the same series: percent changes, a window rebased to
// 100, and "what a purchase from then costs at today's prices".
import data from '../../data/prices/ppi.json' with { type: 'json' };
import defs from '../../data/prices/series.json' with { type: 'json' };

export type Point = [period: string, value: number, preliminary: boolean];
export type SeriesDef = { id: string; name: string; blsTitle: string };

type PpiFile = {
  source: string;
  fetchedAt: string;
  latest: string;
  lagging: string[];
  series: Record<string, { points: Point[] }>;
};

export const PPI = data as unknown as PpiFile;
export const SERIES_DEFS = defs as SeriesDef[];
export const LATEST = PPI.latest;
/** The first month a published report covers. Earlier months exist only as chart history. */
export const FIRST_REPORT = '2026-08';

export function def(id: string): SeriesDef {
  const d = SERIES_DEFS.find((s) => s.id === id);
  if (!d) throw new Error(`unknown PPI series ${id}`);
  return d;
}

export function points(id: string): Point[] {
  const s = PPI.series[id];
  if (!s) throw new Error(`no data for PPI series ${id}`);
  return s.points;
}

/** Points up to and including `asOf` (YYYY-MM). */
export function pointsAsOf(id: string, asOf: string = LATEST): Point[] {
  return points(id).filter(([p]) => p <= asOf);
}

export function valueAt(id: string, period: string): number | null {
  return points(id).find(([p]) => p === period)?.[1] ?? null;
}

/** Months since year 0, so two periods can be subtracted. */
export function monthIndex(period: string): number {
  const [y, m] = period.split('-').map(Number);
  return y * 12 + (m - 1);
}

/** Shift a YYYY-MM period by whole months. */
export function addMonths(period: string, months: number): string {
  const [y, m] = period.split('-').map(Number);
  const idx = y * 12 + (m - 1) + months;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** "2026-08" → "August 2026" (or "Aug 2026" when short). */
export function monthLabel(period: string, short = false): string {
  const [y, m] = period.split('-').map(Number);
  const name = MONTHS[m - 1];
  return `${short ? name.slice(0, 3) : name} ${y}`;
}

/** Percent change from `months` earlier to `asOf`, or null when either month is missing. */
export function change(id: string, months: number, asOf: string = LATEST): number | null {
  const now = valueAt(id, asOf);
  const then = valueAt(id, addMonths(asOf, -months));
  if (now == null || then == null || then === 0) return null;
  return (now / then - 1) * 100;
}

export type Snapshot = {
  id: string;
  name: string;
  period: string;
  value: number;
  preliminary: boolean;
  month: number | null;
  year: number | null;
  fiveYear: number | null;
};

/** Latest value and changes for one series as of a month. */
export function snapshot(id: string, asOf: string = LATEST): Snapshot {
  const pts = pointsAsOf(id, asOf);
  const last = pts.at(-1);
  if (!last) throw new Error(`no data for ${id} as of ${asOf}`);
  const [period, value, preliminary] = last;
  return {
    id,
    name: def(id).name,
    period,
    value,
    preliminary,
    month: change(id, 1, period),
    year: change(id, 12, period),
    fiveYear: change(id, 60, period),
  };
}

/** What `amount` spent in `from` costs at `to` prices, by the ratio of the index. */
export function escalate(
  id: string,
  amount: number,
  from: string,
  to: string = LATEST
): number | null {
  const a = valueAt(id, from);
  const b = valueAt(id, to);
  if (a == null || b == null || a === 0) return null;
  return (amount * b) / a;
}

/** The last `months` points rebased so the first one is 100. */
// The window is by calendar month ending at `asOf`. BLS occasionally skips a
// month for a series, so a gap shortens the window instead of stretching it back.
export function rebased(id: string, months: number, asOf: string = LATEST): Point[] {
  const start = addMonths(asOf, -(months - 1));
  const pts = pointsAsOf(id, asOf).filter(([p]) => p >= start);
  if (!pts.length) return [];
  const base = pts[0][1];
  return pts.map(([p, v, pre]) => [p, (v / base) * 100, pre]);
}

export function pct(n: number | null, digits = 1): string {
  if (n == null) return 'n/a';
  const fixed = Math.abs(n).toFixed(digits);
  if (Number(fixed) === 0) return `0.${'0'.repeat(digits)}%`;
  return `${n > 0 ? '+' : '−'}${fixed}%`;
}

/** "rose 4.1%", "fell 0.8%", "was unchanged". */
export function moved(n: number | null, digits = 1): string {
  if (n == null) return 'had no comparable figure';
  const fixed = Math.abs(n).toFixed(digits);
  if (Number(fixed) === 0) return 'was unchanged';
  return `${n > 0 ? 'rose' : 'fell'} ${fixed}%`;
}

export function dollars(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

/** Tick values that cover [min, max] in round steps. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  const span = max - min || 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  const step = (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let t = lo; t <= hi + step / 2; t += step) ticks.push(Number(t.toFixed(6)));
  return ticks;
}

export type ChartGeometry = {
  width: number;
  height: number;
  path: string;
  area: string;
  ticks: { value: number; y: number }[];
  xLabels: { label: string; x: number }[];
  end: { x: number; y: number; value: number };
  coords: { period: string; x: number; y: number; value: number }[];
};

/** SVG geometry for a rebased line chart; the page draws it, the tests check its scale. */
export function chartGeometry(
  pts: Point[],
  opts: {
    width?: number;
    height?: number;
    padL?: number;
    padR?: number;
    padT?: number;
    padB?: number;
  } = {}
): ChartGeometry {
  const { width = 720, height = 260, padL = 44, padR = 56, padT = 12, padB = 26 } = opts;
  const values = pts.map(([, v]) => v);
  const ticksRaw = niceTicks(Math.min(...values), Math.max(...values));
  const lo = ticksRaw[0];
  const hi = ticksRaw.at(-1)!;
  // Points sit at their month, not their array position, so a month BLS skipped
  // shows as a break in the line instead of squeezing the months around it.
  const first = monthIndex(pts[0][0]);
  const span = Math.max(1, monthIndex(pts.at(-1)![0]) - first);
  const xAt = (period: string) =>
    padL + ((monthIndex(period) - first) * (width - padL - padR)) / span;
  const y = (v: number) => padT + ((hi - v) / (hi - lo || 1)) * (height - padT - padB);
  const coords = pts.map(([p, v]) => ({ period: p, x: xAt(p), y: y(v), value: v }));
  let gaps = false;
  const path = coords
    .map((c, i) => {
      const jump = i > 0 && monthIndex(c.period) - monthIndex(coords[i - 1].period) > 1;
      if (jump) gaps = true;
      return `${i === 0 || jump ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`;
    })
    .join(' ');
  const baseY = y(lo).toFixed(1);
  // A filled area only makes sense under an unbroken line.
  const area = gaps
    ? ''
    : `${path} L${coords.at(-1)!.x.toFixed(1)},${baseY} L${coords[0].x.toFixed(1)},${baseY} Z`;
  const every = Math.max(1, Math.round(pts.length / 5));
  const xLabels = coords
    .filter((_, i) => i % every === 0 || i === coords.length - 1)
    .filter((c, i, arr) => i === arr.length - 1 || coords.at(-1)!.x - c.x > 60)
    .map((c) => ({ label: monthLabel(c.period, true), x: c.x }));
  const last = coords.at(-1)!;
  return {
    width,
    height,
    path,
    area,
    ticks: ticksRaw.map((t) => ({ value: t, y: y(t) })),
    xLabels,
    end: { x: last.x, y: last.y, value: last.value },
    coords,
  };
}

/** Months with a published report, newest first. */
export function reportMonths(): string[] {
  const months: string[] = [];
  for (let p = LATEST; p >= FIRST_REPORT; p = addMonths(p, -1)) months.push(p);
  return months;
}

export function csvFor(ids: string[]): string {
  const rows = [['month', 'series_id', 'series', 'index_value', 'preliminary']];
  for (const id of ids) {
    for (const [p, v, pre] of points(id))
      rows.push([p, id, def(id).name, String(v), pre ? 'yes' : 'no']);
  }
  return rows
    .map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(','))
    .join('\n');
}
