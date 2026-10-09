// DOM controller for /tools/rebar-calculator/. Reads the slab inputs (seeded
// from the query string so a shared link reproduces the result), renders the
// takeoff, prices it with the contractor's own remembered prices (steel by the
// stick or the ton, labor by the ton or the square foot), and adds lines to the
// estimate tray. Math lives in ./rebar.
import {
  BARS,
  computeRebar,
  DEFAULT_INPUT,
  estimateLines,
  fmtFtIn,
  fromParams,
  groupLabel,
  PARAM_KEYS,
  priceRebar,
  toParams,
  TOOL,
  type RebarInput,
  type RebarPrices,
  type RebarResult,
  type Run,
} from './rebar';
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

const NUMERIC_PRICES = ['steel', 'chair', 'labor'] as const;

export function mount(root: HTMLElement): void {
  const fields = Array.from(
    root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-in]')
  );
  const priceFields = Array.from(root.querySelectorAll<HTMLInputElement>('[data-price]'));
  const steelBasis = root.querySelector<HTMLSelectElement>('[data-price-basis="steel"]');
  const laborBasis = root.querySelector<HTMLSelectElement>('[data-price-basis="labor"]');
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

  function writeInputs(input: RebarInput): void {
    const params = toParams(input);
    for (const el of fields) {
      const key = el.dataset.in ?? '';
      if (el instanceof HTMLInputElement && el.type === 'checkbox')
        el.checked = params[key] === '1';
      else if (key in params) el.value = params[key as keyof typeof params];
    }
  }

  function readInputs(): RebarInput {
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

  function readPrices(): RebarPrices {
    const out: RebarPrices = {};
    for (const el of priceFields) {
      const key = el.dataset.price as (typeof NUMERIC_PRICES)[number];
      const n = parseNum(el.value);
      if (n != null && n >= 0) out[key] = n;
    }
    out.steelPerTon = steelBasis?.value === 'ton';
    out.laborPerSqft = laborBasis?.value === 'sqft';
    return out;
  }

  /** The price book stores numbers only, so each basis is kept as 1 or 0. */
  function storePrices(p: RebarPrices): void {
    const book: Record<string, number> = {};
    for (const key of NUMERIC_PRICES) {
      const v = p[key];
      if (v != null) book[key] = v;
    }
    book.steelTon = p.steelPerTon ? 1 : 0;
    book.laborSqft = p.laborPerSqft ? 1 : 0;
    savePrices(TOOL, book);
  }

  const saved = loadPrices(TOOL);
  let prices: RebarPrices = {
    steelPerTon: saved.steelTon === 1,
    laborPerSqft: saved.laborSqft === 1,
  };
  for (const key of NUMERIC_PRICES) {
    const v = saved[key];
    if (v != null) prices[key] = v;
  }
  for (const el of priceFields) {
    const v = prices[el.dataset.price as (typeof NUMERIC_PRICES)[number]];
    el.value = v != null ? String(v) : '';
  }
  if (steelBasis) steelBasis.value = prices.steelPerTon ? 'ton' : 'stick';
  if (laborBasis) laborBasis.value = prices.laborPerSqft ? 'sqft' : 'ton';
  writeInputs(fromParams(readParams(PARAM_KEYS)));

  function runNote(r: RebarResult, bars: number, span: number, run: Run): string {
    if (bars === 0) return 'Slab is smaller than the edge clearance';
    const each =
      run.pieces <= 1
        ? `${fmtFtIn(span)} each, one piece`
        : `${fmtFtIn(span)} each, ${run.pieces} pieces with ${run.laps} ${run.laps === 1 ? 'lap' : 'laps'} (${fmtFtIn(run.steelIn)} of steel)`;
    return r.mats > 1 ? `${fmt(bars)} per mat; ${each}` : each;
  }

  function render(): { input: RebarInput; result: RebarResult } {
    const input = readInputs();
    const r = computeRebar(input);
    const p = priceRebar(r, prices);
    const bar = BARS[input.bar];

    setOut('bars-l', fmt(r.barsL * r.mats));
    setOut('bars-l-note', runNote(r, r.barsL, r.spanLIn, r.runL));
    setOut('bars-w', fmt(r.barsW * r.mats));
    setOut('bars-w-note', runNote(r, r.barsW, r.spanWIn, r.runW));
    setOut('lf', fmt(Math.round(r.lf)));
    setOut(
      'lf-note',
      `${fmt(Math.round(r.barLf))} LF of bar + ${fmt(Math.round(r.lapLf))} LF of laps${r.mats > 1 ? ', both mats' : ''}`
    );
    setOut('laps', fmt(r.laps));
    setOut(
      'laps-note',
      r.laps === 0
        ? `No splices: every bar fits in one ${input.stock} ft stick`
        : `${fmtTrim(r.lapIn, 2)} in each (${fmtTrim(input.lapDb)} bar diameters), ${fmt(Math.round(r.lapLf))} LF added`
    );
    setOut('sticks', fmt(r.sticks));
    const offcut = r.sticksNet - Math.ceil(r.sticksOfSteel - 1e-9);
    setOut(
      'sticks-note',
      r.sticks === 0
        ? 'Enter the slab size'
        : `${input.stock} ft sticks from the cut list${input.waste > 0 ? `, ${fmt(r.sticksNet)} + ${fmtTrim(input.waste)}% waste` : ''}. ${
            offcut > 0
              ? `${fmt(offcut)} more than LF ÷ ${input.stock}, for offcuts too short to use.`
              : `The same as LF ÷ ${input.stock}, rounded up.`
          }`
    );
    setOut('weight', fmt(Math.round(r.lbPlaced)));
    setOut(
      'weight-note',
      `${fmt(r.tonsPlaced, 2)} tons placed at ${bar.lbPerFt} lb/ft; the sticks you buy weigh ${fmt(Math.round(r.lbBought))} lb (${fmt(r.tonsBought, 2)} tons)`
    );
    setOut('chairs', fmt(r.chairs));
    setOut(
      'chairs-note',
      `One per ${fmtTrim(input.chairFt)} × ${fmtTrim(input.chairFt)} ft of slab${r.mats > 1 ? ', each mat' : ''}`
    );

    setOut('material', p.material == null ? '—' : money(p.material));
    setOut('labor', p.labor == null ? '—' : money(p.labor));
    setOut('total', p.total == null ? '—' : money(p.total));
    setOut('per-sqft', p.perSqft == null ? '—' : `${money(p.perSqft)} per sq ft of slab`);
    setOut(
      'labor-label',
      prices.laborPerSqft
        ? `Labor, ${fmt(Math.round(r.area))} sq ft of slab`
        : `Labor, ${fmt(r.tonsPlaced, 2)} tons placed`
    );
    setOut(
      'steel-input-label',
      prices.steelPerTon ? 'Rebar, per ton ($)' : `Rebar, per ${input.stock} ft stick ($)`
    );
    setOut(
      'labor-input-label',
      prices.laborPerSqft ? 'Labor, per sq ft of slab ($)' : 'Labor, per ton placed ($)'
    );
    setOut(
      'price-hint',
      p.total == null
        ? 'Enter your own prices to turn the takeoff into a price. They are saved in this browser for next time.'
        : p.materialComplete
          ? `Priced with your saved prices for #${input.bar} bar.`
          : 'Some materials have no price yet, so the material total is partial.'
    );
    return { input, result: r };
  }

  const pricesChanged = () => {
    prices = readPrices();
    storePrices(prices);
    render();
    trackOnce('price_entered');
  };

  root.addEventListener('input', (ev) => {
    const t = ev.target as HTMLElement;
    if (t.matches('[data-price], [data-price-basis]')) {
      pricesChanged();
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
    } else if (t.matches('[data-price-basis]')) pricesChanged();
  });

  root.addEventListener('click', async (ev) => {
    const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const { input, result } = render();
    if (action === 'add') {
      const lines = estimateLines(input, result, prices);
      if (!result.bars || !lines.length) {
        setNote('Enter the slab size first.');
        return;
      }
      saveEstimate(withLines(loadEstimate(), groupLabel(input), lines));
      setNote(`Added ${lines.length} lines to your estimate below.`);
      trackTool(TOOL, 'add_to_estimate', { lines: lines.length });
    } else if (action === 'copy-link') {
      const ok = await copyText(resultUrl(toParams(input)));
      setNote(
        ok
          ? 'Link copied. Anyone who opens it sees this slab.'
          : 'Copy the address bar to share this result.'
      );
      trackTool(TOOL, 'copy_link');
    } else if (action === 'reset') {
      writeInputs(DEFAULT_INPUT);
      const next = render();
      syncUrl(toParams(next.input));
      setNote('Back to the example slab.');
    }
  });

  render();
  root.dataset.ready = 'true';
}
