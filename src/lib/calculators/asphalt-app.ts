// DOM controller for /tools/asphalt-calculator/. Reads the area inputs (seeded
// from the query string so a shared link reproduces the result), renders the
// tonnage takeoff, prices it with the contractor's own remembered unit prices,
// and adds lines to the estimate tray. Math lives in ./asphalt.
import {
  computeAsphalt,
  DEFAULT_INPUT,
  estimateLines,
  fromParams,
  groupLabel,
  LABOR_UNITS,
  laborUnit,
  PARAM_KEYS,
  priceAsphalt,
  toParams,
  TOOL,
  type AsphaltInput,
  type AsphaltPrices,
} from './asphalt';
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

export function mount(root: HTMLElement): void {
  const fields = Array.from(
    root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-in]')
  );
  const priceFields = Array.from(
    root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-price]')
  );
  const modeBlocks = Array.from(root.querySelectorAll<HTMLElement>('[data-mode]'));
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
  const field = (key: string) => fields.find((el) => el.dataset.in === key);

  function writeInputs(input: AsphaltInput): void {
    const params = toParams(input);
    for (const el of fields) {
      const key = el.dataset.in ?? '';
      if (key in params) el.value = params[key as keyof typeof params];
    }
  }

  function readInputs(): AsphaltInput {
    const values: Record<string, string> = {};
    for (const el of fields) values[el.dataset.in ?? ''] = el.value;
    return fromParams(values);
  }

  function readPrices(): AsphaltPrices {
    const out: AsphaltPrices = {};
    for (const el of priceFields) {
      const key = el.dataset.price as keyof AsphaltPrices;
      const n = parseNum(el.value);
      if (n != null && n >= 0) out[key] = n;
    }
    return out;
  }

  let prices: AsphaltPrices = loadPrices(TOOL);
  for (const el of priceFields) {
    const v = prices[el.dataset.price as keyof AsphaltPrices];
    if (el instanceof HTMLSelectElement) {
      if (v != null && Array.from(el.options).some((o) => o.value === String(v)))
        el.value = String(v);
    } else el.value = v != null ? String(v) : '';
  }
  writeInputs(fromParams(readParams(PARAM_KEYS)));

  function render(): { input: AsphaltInput; result: ReturnType<typeof computeAsphalt> } {
    const input = readInputs();
    const r = computeAsphalt(input);
    const p = priceAsphalt(r, prices);
    const unit = LABOR_UNITS[laborUnit(prices)];
    const wastePart = input.waste > 0 ? ` + ${fmtTrim(input.waste)}% waste` : '';

    for (const el of modeBlocks) el.hidden = el.dataset.mode !== input.mode;

    setOut('sqft', fmt(Math.round(r.sqft)));
    setOut('sqft-note', `${fmtTrim(r.sqyd)} sq yd`);
    setOut('tons', fmt(r.tons, 2));
    setOut(
      'tons-note',
      `${fmtTrim(r.cuyd)} cu yd (${fmtTrim(r.cuft, 1)} cu ft) compacted${wastePart}. Lay about ${fmtTrim(r.looseIn)} in loose.`
    );
    setOut('base', fmt(r.baseTons, 2));
    setOut(
      'base-note',
      input.baseThickness > 0
        ? `${fmtTrim(r.baseCuyd)} cu yd at ${fmtTrim(input.baseThickness)} in compacted${wastePart}`
        : 'No base course entered'
    );
    setOut('loads', fmt(r.loads + r.baseLoads));
    setOut(
      'loads-note',
      input.truckTons > 0
        ? `${r.loads} asphalt + ${r.baseLoads} base at ${fmtTrim(input.truckTons)} tons a load`
        : 'Enter a truck load in tons'
    );
    setOut('rate', `${fmtTrim(r.lbPerSyIn)} lb`);
    setOut(
      'rate-note',
      r.lbPerSyIn > 0
        ? `${fmtTrim(r.lbPerSyIn / 2000, 4)} tons. One ton covers about ${fmtTrim(2000 / r.lbPerSyIn, 1)} sq yd at 1 in.`
        : 'Enter the asphalt density'
    );

    setOut('material', p.material == null ? '—' : money(p.material));
    setOut('trucking', p.trucking == null ? '—' : money(p.trucking));
    setOut('labor', p.labor == null ? '—' : money(p.labor));
    setOut('total', p.total == null ? '—' : money(p.total));
    setOut(
      'per-unit',
      p.perSqft == null || p.perSqyd == null
        ? '—'
        : `${money(p.perSqft)} per sq ft · ${money(p.perSqyd)} per sq yd`
    );
    setOut('labor-label', `Labor, per ${unit}`);
    setOut(
      'price-hint',
      p.total == null
        ? 'Enter your own prices to turn the takeoff into a price. They are saved in this browser for next time.'
        : p.materialComplete
          ? 'Priced with your saved prices.'
          : 'Some materials have no price yet, so the material total is partial.'
    );
    return { input, result: r };
  }

  const recalc = () => {
    const { input } = render();
    syncUrl(toParams(input));
    trackOnce('calculate');
  };

  root.addEventListener('input', (ev) => {
    const t = ev.target as HTMLElement;
    if (t.matches('[data-price]')) {
      prices = readPrices();
      savePrices(TOOL, prices as Record<string, number>);
      render();
      trackOnce('price_entered');
      return;
    }
    if (t.matches('[data-in]')) recalc();
  });
  root.addEventListener('change', (ev) => {
    const t = ev.target as HTMLElement;
    if (!t.matches('select[data-in]')) return;
    // Switching to square feet carries the width × length over, so the result holds.
    if (t.dataset.in === 'm' && (t as HTMLSelectElement).value === 'sf') {
      const w = parseNum(field('w')?.value) ?? 0;
      const l = parseNum(field('l')?.value) ?? 0;
      const area = field('a');
      if (area && w > 0 && l > 0) area.value = String(round2(w * l));
    }
    recalc();
  });

  root.addEventListener('click', async (ev) => {
    const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const { input, result } = render();
    if (action === 'add') {
      const lines = result.tons > 0 ? estimateLines(input, result, prices) : [];
      if (!lines.length) {
        setNote('Enter the area and thickness first.');
        return;
      }
      saveEstimate(withLines(loadEstimate(), groupLabel(input), lines));
      setNote(`Added ${lines.length} lines to your estimate below.`);
      trackTool(TOOL, 'add_to_estimate', { lines: lines.length });
    } else if (action === 'copy-link') {
      const ok = await copyText(resultUrl(toParams(input)));
      setNote(
        ok
          ? 'Link copied. Anyone who opens it sees this area.'
          : 'Copy the address bar to share this result.'
      );
      trackTool(TOOL, 'copy_link');
    } else if (action === 'reset') {
      writeInputs(DEFAULT_INPUT);
      const next = render();
      syncUrl(toParams(next.input));
      setNote('Back to the example driveway.');
    }
  });

  render();
  root.dataset.ready = 'true';
}
