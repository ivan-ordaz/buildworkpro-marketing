// DOM controller for /tools/labor-burden-calculator/. Reads the wage and hours
// (seeded from the query string so a shared link reproduces the result), the
// contractor's own rates (remembered in this browser, never put in the link),
// renders the burden and the hourly cost, and adds the job's labor hours to the
// estimate tray. Math lives in ./burden.
import {
  computeBurden,
  DEFAULT_INPUT,
  estimateBlocker,
  estimateLines,
  fromParams,
  groupLabel,
  ITEMS,
  PARAM_KEYS,
  RATE_KEYS,
  toParams,
  TOOL,
  urlParams,
  type BurdenInput,
  type BurdenRates,
  type BurdenResult,
} from './burden';
import { fmt, fmtTrim, money, parseNum } from './format';
import { loadEstimate, round2, saveEstimate, withLines } from './estimate';
import {
  copyText,
  loadPrices,
  readParams,
  resultUrl,
  savePrices,
  syncUrl,
  trackTool,
} from './browser';

type RateKey = (typeof RATE_KEYS)[number];
const isRateKey = (k: string): k is RateKey => (RATE_KEYS as readonly string[]).includes(k);

export function mount(root: HTMLElement): void {
  const fields = Array.from(
    root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-in]')
  );
  const rateFields = Array.from(root.querySelectorAll<HTMLInputElement>('[data-price]'));
  const note = root.querySelector<HTMLElement>('[data-note]');
  const tracked = new Set<string>();
  const trackOnce = (action: string) => {
    if (tracked.has(action)) return;
    tracked.add(action);
    trackTool(TOOL, action);
  };

  const setOut = (key: string, text: string) => {
    for (const el of root.querySelectorAll<HTMLElement>(`[data-out="${key}"]`))
      el.textContent = text;
  };
  const setNote = (text: string) => {
    if (note) note.textContent = text;
  };

  function writeInputs(input: BurdenInput): void {
    const params = toParams(input);
    for (const el of fields) {
      const key = el.dataset.in ?? '';
      if (key in params) el.value = params[key as keyof typeof params];
    }
  }

  function readInputs(): BurdenInput {
    const values: Record<string, string> = {};
    for (const el of fields) values[el.dataset.in ?? ''] = el.value;
    return fromParams(values);
  }

  function readRates(): BurdenRates {
    const out: BurdenRates = {};
    for (const el of rateFields) {
      const key = el.dataset.price ?? '';
      const n = parseNum(el.value);
      if (isRateKey(key) && n != null && n >= 0) out[key] = n;
    }
    return out;
  }

  let rates: BurdenRates = {};
  const saved = loadPrices(TOOL);
  for (const key of RATE_KEYS) if (saved[key] != null) rates[key] = saved[key];
  for (const el of rateFields) {
    const key = el.dataset.price ?? '';
    const v = isRateKey(key) ? rates[key] : undefined;
    el.value = v != null ? String(v) : '';
  }
  writeInputs(fromParams(readParams(PARAM_KEYS)));

  function render(): { input: BurdenInput; result: BurdenResult } {
    const input = readInputs();
    const r = computeBurden(input, rates);
    const has = r.wages > 0;
    const dash = (n: number | null, text: (v: number) => string) =>
      n == null || !has ? '—' : text(n);

    setOut('per-billable', dash(r.perBillableHour, money));
    setOut(
      'per-billable-note',
      !has
        ? 'Enter a base wage to start.'
        : r.billableHours <= 0
          ? 'The hours not billed use up every paid hour.'
          : r.nonBillable > 0
            ? `${fmt(r.billableHours)} billable hours a year, ${fmt(r.nonBillable)} paid but not billed`
            : `All ${fmt(r.billableHours)} paid hours counted as billable. Enter the hours not billed.`
    );
    setOut('per-paid', dash(r.perPaidHour, money));
    setOut('per-paid-note', `${fmt(input.hours)} paid hours a year`);
    setOut('burden-pct', has ? `${fmtTrim(r.burdenPct, 1)}%` : '—');
    setOut(
      'burden-pct-note',
      has && r.perPaidHour != null
        ? `${money(r.burden)} a year, ${money(round2(r.burden / input.hours))} per paid hour`
        : 'Of wages'
    );
    setOut('wages', has ? money(r.wages) : '—');
    setOut(
      'wages-note',
      has ? `${money(input.wage ?? 0)} × ${fmt(input.hours)} paid hours` : 'Base wage × paid hours'
    );
    setOut('annual-cost', has ? money(r.annualCost) : '—');

    for (const item of r.items) {
      setOut(`item-${item.id}`, has && item.amount != null ? money(item.amount) : '—');
      setOut(`item-${item.id}-note`, item.note);
    }
    setOut('burden-total', has ? money(r.burden) : '—');
    const missing = ITEMS.filter((i) => r.missing.includes(i.id)).map((i) => i.label);
    setOut(
      'burden-hint',
      !has
        ? 'Federal payroll taxes are filled in. Add your own rates below the wage.'
        : missing.length
          ? `Not counted yet: ${missing.join(', ')}. Enter 0 for anything you do not pay.`
          : 'Every burden item is counted.'
    );

    const margin = rates.margin;
    setOut('billing', has ? dash(r.billingRate, money) : '—');
    setOut(
      'billing-note',
      !has || r.perBillableHour == null
        ? 'Cost per billable hour ÷ (1 − margin)'
        : margin == null
          ? 'Enter a target margin to get the rate to bill.'
          : r.billingRate == null
            ? 'A margin has to be under 100%.'
            : `${fmtTrim(margin, 2)}% margin on ${money(r.perBillableHour)}, a ${fmtTrim(r.markupPct ?? 0, 1)}% markup on cost`
    );

    const [line] = estimateLines(input, r, rates);
    setOut(
      'line-preview',
      line && line.price != null
        ? `${fmtTrim(line.qty)} hrs × ${money(line.price)} = ${money(round2(line.qty * line.price))}`
        : ''
    );
    return { input, result: r };
  }

  const onInputChange = () => {
    const { input } = render();
    syncUrl(urlParams(input));
    trackOnce('calculate');
  };

  root.addEventListener('input', (ev) => {
    const t = ev.target as HTMLElement;
    if (t.matches('[data-price]')) {
      rates = readRates();
      savePrices(TOOL, rates as Record<string, number>);
      render();
      trackOnce('price_entered');
      return;
    }
    if (t.matches('input[data-in]')) onInputChange();
  });
  root.addEventListener('change', (ev) => {
    if ((ev.target as HTMLElement).matches('select[data-in]')) onInputChange();
  });

  root.addEventListener('click', async (ev) => {
    const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const { input, result } = render();
    if (action === 'add') {
      const blocker = estimateBlocker(input, result, rates);
      const lines = estimateLines(input, result, rates);
      if (blocker || !lines.length) {
        setNote(blocker ?? 'Enter a base wage first.');
        return;
      }
      saveEstimate(withLines(loadEstimate(), groupLabel(input, result), lines));
      setNote('Added the labor line to your estimate below.');
      trackTool(TOOL, 'add_to_estimate', { lines: lines.length });
    } else if (action === 'copy-link') {
      const ok = await copyText(resultUrl(urlParams(input)));
      setNote(
        ok
          ? 'Link copied. It carries the wage and hours, not your rates.'
          : 'Copy the address bar to share this result.'
      );
      trackTool(TOOL, 'copy_link');
    } else if (action === 'reset') {
      writeInputs(DEFAULT_INPUT);
      const next = render();
      syncUrl(urlParams(next.input));
      setNote('Wage and hours cleared. Your saved rates are kept.');
    }
  });

  render();
  root.dataset.ready = 'true';
}
