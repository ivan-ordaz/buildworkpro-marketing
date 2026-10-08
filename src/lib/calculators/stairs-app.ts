// DOM controller for /tools/stair-stringer-calculator/. Reads the stair inputs
// (seeded from the query string so a shared link reproduces the result), renders
// the layout and the code check, prices it with the contractor's own remembered
// prices, and adds lines to the estimate tray. Math lives in ./stairs.
import {
  codeChecks,
  computeStairs,
  DEFAULT_INPUT,
  estimateLines,
  fmtDeg,
  fmtFtIn,
  fmtIn,
  fromParams,
  groupLabel,
  PARAM_KEYS,
  priceStairs,
  STOCK,
  toParams,
  TOOL,
  type CheckStatus,
  type StairInput,
  type StairPrices,
  type StairResult,
} from './stairs';
import { fmt, fmtTrim, money, parseNum } from './format';
import { loadEstimate, saveEstimate, withLines } from './estimate';
import {
  copyText,
  loadPrices,
  readParams,
  resultUrl,
  savePrices,
  syncUrl,
  trackTool,
} from './browser';

const NUMERIC_PRICES = ['stringer', 'tread', 'riser', 'labor'] as const;

const STATUS: Record<CheckStatus, { text: string; cls: string }> = {
  pass: { text: 'Pass', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  fail: { text: 'Fails', cls: 'bg-red-50 text-red-700 border-red-200' },
  info: { text: 'Note', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

export function mount(root: HTMLElement): void {
  const fields = Array.from(
    root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-in]')
  );
  const priceFields = Array.from(root.querySelectorAll<HTMLInputElement>('[data-price]'));
  const basis = root.querySelector<HTMLSelectElement>('[data-price-basis]');
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

  function writeInputs(input: StairInput): void {
    const params = toParams(input);
    for (const el of fields) {
      const key = el.dataset.in ?? '';
      if (el instanceof HTMLInputElement && el.type === 'checkbox')
        el.checked = params[key] === '1';
      else if (key in params) el.value = params[key as keyof typeof params];
    }
  }

  function readInputs(): StairInput {
    const values: Record<string, string> = {};
    for (const el of fields) {
      const key = el.dataset.in ?? '';
      values[key] =
        el instanceof HTMLInputElement && el.type === 'checkbox'
          ? el.checked
            ? '1'
            : '0'
          : el.value;
    }
    return fromParams(values);
  }

  function readPrices(): StairPrices {
    const out: StairPrices = {};
    for (const el of priceFields) {
      const key = el.dataset.price as (typeof NUMERIC_PRICES)[number];
      const n = parseNum(el.value);
      if (n != null && n >= 0) out[key] = n;
    }
    out.laborLump = basis?.value === 'lump';
    return out;
  }

  /** The price book stores numbers only, so the labor basis is kept as lump: 1 or 0. */
  function storePrices(p: StairPrices): void {
    const book: Record<string, number> = {};
    for (const key of NUMERIC_PRICES) {
      const v = p[key];
      if (v != null) book[key] = v;
    }
    book.lump = p.laborLump ? 1 : 0;
    savePrices(TOOL, book);
  }

  const saved = loadPrices(TOOL);
  let prices: StairPrices = { laborLump: saved.lump === 1 };
  for (const key of NUMERIC_PRICES) {
    const v = saved[key];
    if (v != null) prices[key] = v;
  }
  for (const el of priceFields) {
    const v = prices[el.dataset.price as (typeof NUMERIC_PRICES)[number]];
    el.value = v != null ? String(v) : '';
  }
  if (basis) basis.value = prices.laborLump ? 'lump' : 'step';
  writeInputs(fromParams(readParams(PARAM_KEYS)));

  function renderChecks(input: StairInput, r: StairResult): void {
    for (const c of codeChecks(input, r)) {
      const row = root.querySelector<HTMLElement>(`[data-check="${c.id}"]`);
      if (!row) continue;
      row.hidden = c.hidden === true;
      row.dataset.status = c.status;
      const pill = row.querySelector<HTMLElement>('[data-check-status]');
      if (pill) {
        pill.textContent = STATUS[c.status].text;
        pill.className = `shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS[c.status].cls}`;
      }
      const detail = row.querySelector<HTMLElement>('[data-check-detail]');
      if (detail) detail.textContent = c.detail;
    }
  }

  function render(): { input: StairInput; result: StairResult } {
    const input = readInputs();
    const r = computeStairs(input);
    const p = priceStairs(input, r, prices);
    const stock = STOCK[input.stock].label;
    const has = r.risers > 0;

    setOut('risers', fmt(r.risers));
    setOut(
      'risers-note',
      has
        ? `${fmtIn(r.riserHeight)} each (${fmtTrim(r.riserHeight, 3)} in exact)`
        : 'Enter the rise'
    );
    setOut('treads', fmt(r.treads));
    setOut('treads-note', `${fmtIn(input.tread)} deep. The top tread is the upper floor.`);
    setOut('run', has ? fmtFtIn(r.totalRun) : '—');
    setOut('run-note', `${r.treads} treads × ${fmtIn(input.tread)}`);
    setOut('stringer', r.stringerLength > 0 ? fmtFtIn(r.stringerLength) : '—');
    setOut(
      'stringer-note',
      r.boardFt != null
        ? `Buy ${r.boardFt} ft ${stock}, with ${fmtIn(input.extra)} extra for trimming`
        : r.tooLong
          ? `Over 20 ft with the extra. Add a landing or order long stock.`
          : 'No stringer for a single step'
    );
    setOut('stringers', fmt(r.stringers));
    setOut('stringers-note', `${fmtIn(input.spacing)} max on center across ${fmtIn(input.width)}`);
    setOut('angle', has ? fmtDeg(r.angle) : '—');
    setOut('angle-note', `${fmtIn(r.riserHeight)} rise on a ${fmtIn(input.tread)} run`);
    setOut('drop', fmtIn(r.drop));
    setOut(
      'drop-note',
      r.drop > 0
        ? `Undropped, the first step would be ${fmtIn(r.firstStepUndropped)}`
        : 'No drop with no tread thickness'
    );
    renderChecks(input, r);

    setOut('material', p.material == null ? '—' : money(p.material));
    setOut('labor', p.labor == null ? '—' : money(p.labor));
    setOut('total', p.total == null ? '—' : money(p.total));
    setOut('per-step', p.perStep == null ? '—' : `${money(p.perStep)} per step`);
    setOut('labor-label', prices.laborLump ? 'Labor, lump sum' : `Labor, ${r.risers} steps`);
    setOut(
      'labor-input-label',
      prices.laborLump ? 'Labor, lump sum for the stair ($)' : 'Labor, per step ($)'
    );
    setOut(
      'price-hint',
      p.total == null
        ? 'Enter your own prices to turn the layout into a price. They are saved in this browser for next time.'
        : p.materialComplete
          ? 'Priced with your saved prices.'
          : 'Some materials have no price yet, so the material total is partial.'
    );
    return { input, result: r };
  }

  root.addEventListener('input', (ev) => {
    const t = ev.target as HTMLElement;
    if (t.matches('[data-price], [data-price-basis]')) {
      prices = readPrices();
      storePrices(prices);
      render();
      trackOnce('price_entered');
      return;
    }
    if (!t.matches('[data-in]')) return;
    const { input } = render();
    syncUrl(toParams(input));
    trackOnce('calculate');
  });
  root.addEventListener('change', (ev) => {
    const t = ev.target as HTMLElement;
    if (t.matches('select[data-in], input[type="checkbox"][data-in]')) {
      const { input } = render();
      syncUrl(toParams(input));
      trackOnce('calculate');
    } else if (t.matches('[data-price-basis]')) {
      prices = readPrices();
      storePrices(prices);
      render();
    }
  });

  root.addEventListener('click', async (ev) => {
    const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const { input, result } = render();
    if (action === 'add') {
      const lines = estimateLines(input, result, prices);
      if (!result.risers || !lines.length) {
        setNote('Enter the total rise first.');
        return;
      }
      saveEstimate(withLines(loadEstimate(), groupLabel(input), lines));
      setNote(`Added ${lines.length} lines to your estimate below.`);
      trackTool(TOOL, 'add_to_estimate', { lines: lines.length });
    } else if (action === 'copy-link') {
      const ok = await copyText(resultUrl(toParams(input)));
      setNote(
        ok
          ? 'Link copied. Anyone who opens it sees this stair.'
          : 'Copy the address bar to share this result.'
      );
      trackTool(TOOL, 'copy_link');
    } else if (action === 'reset') {
      writeInputs(DEFAULT_INPUT);
      const next = render();
      syncUrl(toParams(next.input));
      setNote('Back to the example stair.');
    }
  });

  render();
  root.dataset.ready = 'true';
}
