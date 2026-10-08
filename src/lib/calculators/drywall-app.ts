// DOM controller for /tools/drywall-calculator/. Reads the room inputs (seeded
// from the query string so a shared link reproduces the result), renders the
// takeoff, prices it with the contractor's own remembered unit prices, and adds
// lines to the estimate tray. Math lives in ./drywall.
import {
  BOARDS,
  computeDrywall,
  DEFAULT_INPUT,
  estimateLines,
  fromParams,
  groupLabel,
  PARAM_KEYS,
  priceDrywall,
  SHEETS,
  toParams,
  TOOL,
  type DrywallInput,
  type DrywallPrices,
} from './drywall';
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

export function mount(root: HTMLElement): void {
  const fields = Array.from(
    root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-in]')
  );
  const priceFields = Array.from(root.querySelectorAll<HTMLInputElement>('[data-price]'));
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

  function writeInputs(input: DrywallInput): void {
    const params = toParams(input);
    for (const el of fields) {
      const key = el.dataset.in ?? '';
      if (el instanceof HTMLInputElement && el.type === 'checkbox')
        el.checked = params[key] === '1';
      else if (key in params) el.value = params[key as keyof typeof params];
    }
  }

  function readInputs(): DrywallInput {
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

  function readPrices(): DrywallPrices {
    const out: DrywallPrices = {};
    for (const el of priceFields) {
      const key = el.dataset.price as keyof DrywallPrices;
      const n = parseNum(el.value);
      if (n != null && n >= 0) out[key] = n;
    }
    return out;
  }

  let prices: DrywallPrices = loadPrices(TOOL);
  for (const el of priceFields) {
    const v = prices[el.dataset.price as keyof DrywallPrices];
    el.value = v != null ? String(v) : '';
  }
  writeInputs(fromParams(readParams(PARAM_KEYS)));

  function render(): { input: DrywallInput; result: ReturnType<typeof computeDrywall> } {
    const input = readInputs();
    const r = computeDrywall(input);
    const p = priceDrywall(r, prices);
    const size = SHEETS[input.sheet].label;

    setOut('board', fmt(Math.round(r.boardArea)));
    setOut(
      'board-note',
      input.ceiling
        ? `${fmt(Math.round(r.wallArea))} walls + ${fmt(Math.round(r.ceilingArea))} ceiling`
        : `walls only, ${fmt(Math.round(r.openings))} sq ft of openings deducted`
    );
    setOut('sheets', fmt(r.sheets));
    setOut(
      'sheets-note',
      `${size}: ${r.wallSheets} walls${input.ceiling ? `, ${r.ceilingSheets} ceiling` : ''}, incl. ${fmtTrim(input.waste)}% waste`
    );
    setOut('pails', fmt(r.pails));
    setOut('pails-note', `${fmtTrim(r.compoundGal, 1)} gal of ready-mixed compound`);
    setOut('rolls', fmt(r.rolls));
    setOut('rolls-note', `${fmt(Math.round(r.tapeFt))} ft of paper tape`);
    setOut('screws', fmt(r.screws));

    setOut('material', p.material == null ? '—' : money(p.material));
    setOut('labor', p.labor == null ? '—' : money(p.labor));
    setOut('total', p.total == null ? '—' : money(p.total));
    setOut('per-sqft', p.perSqft == null ? '—' : `${money(p.perSqft)} per sq ft of board`);
    setOut('labor-label', `Labor, hang and finish to Level ${input.level}`);
    setOut(
      'price-hint',
      p.total == null
        ? 'Enter your own prices to turn the takeoff into a price. They are saved in this browser for next time.'
        : p.materialComplete
          ? `Priced with your saved prices for ${BOARDS[input.board]} board.`
          : 'Some materials have no price yet, so the material total is partial.'
    );
    return { input, result: r };
  }

  root.addEventListener('input', (ev) => {
    const t = ev.target as HTMLElement;
    if (t.matches('[data-price]')) {
      prices = readPrices();
      savePrices(TOOL, prices as Record<string, number>);
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
    }
  });

  root.addEventListener('click', async (ev) => {
    const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const { input, result } = render();
    if (action === 'add') {
      const lines = estimateLines(input, result, prices);
      if (!lines.length) {
        setNote('Enter the room size first.');
        return;
      }
      saveEstimate(withLines(loadEstimate(), groupLabel(input), lines));
      setNote(`Added ${lines.length} lines to your estimate below.`);
      trackTool(TOOL, 'add_to_estimate', { lines: lines.length });
    } else if (action === 'copy-link') {
      const ok = await copyText(resultUrl(toParams(input)));
      setNote(
        ok
          ? 'Link copied. Anyone who opens it sees this room.'
          : 'Copy the address bar to share this result.'
      );
      trackTool(TOOL, 'copy_link');
    } else if (action === 'reset') {
      writeInputs(DEFAULT_INPUT);
      const next = render();
      syncUrl(toParams(next.input));
      setNote('Back to the example room.');
    }
  });

  render();
  root.dataset.ready = 'true';
}
