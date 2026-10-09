// DOM controller for /tools/voltage-drop-calculator/. Reads the circuit inputs
// (seeded from the query string so a shared link reproduces the result), renders
// the drop, the pass or fail, the smallest size that meets the target and the
// code notes, prices the wire with the contractor's own remembered per-foot
// price for that size and material, and adds it to the estimate tray. Math lives
// in ./vdrop.
import {
  computeVdrop,
  DEFAULT_CONDUCTORS,
  DEFAULT_INPUT,
  estimateLines,
  footageNote,
  fromParams,
  groupLabel,
  MATERIALS,
  notes,
  PARAM_KEYS,
  PHASES,
  priceKey,
  SIZE_IDS,
  SIZES,
  toParams,
  TOOL,
  wireCost,
  wireFeet,
  wireLabel,
  wireSize,
  type Phase,
  type VdropInput,
  type VdropResult,
} from './vdrop';
import { fmt, fmtTrim, money, parseNum } from './format';
import { loadEstimate, saveEstimate, unitPrice, withLines } from './estimate';
import {
  copyText,
  loadPrices,
  readParams,
  resultUrl,
  savePrices,
  syncUrl,
  trackTool,
} from './browser';

const STATUS_BASE = 'mt-1 block text-2xl font-bold tabular-nums';

export function mount(root: HTMLElement): void {
  const fields = Array.from(
    root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-in]')
  );
  const priceInput = root.querySelector<HTMLInputElement>('[data-wire-price]');
  const customWrap = root.querySelector<HTMLElement>('[data-custom-volts]');
  const phaseEl = root.querySelector<HTMLSelectElement>('[data-in="ph"]');
  const conductorsEl = root.querySelector<HTMLInputElement>('[data-in="n"]');
  const statusEl = root.querySelector<HTMLElement>('[data-out="status"]');
  const notesEl = root.querySelector<HTMLElement>('[data-notes]');
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

  function writeInputs(input: VdropInput): void {
    const params = toParams(input);
    for (const el of fields) {
      const key = el.dataset.in ?? '';
      if (key in params) el.value = params[key as keyof typeof params];
    }
  }

  function readInputs(): VdropInput {
    const values: Record<string, string> = {};
    for (const el of fields) values[el.dataset.in ?? ''] = el.value;
    return fromParams(values);
  }

  // Per-foot prices, one per material and size, remembered in this browser.
  const prices: Record<string, number> = loadPrices(TOOL);
  let shownPriceKey = '';

  writeInputs(fromParams(readParams(PARAM_KEYS)));
  let lastPhase = (phaseEl?.value ?? DEFAULT_INPUT.phase) as Phase;

  /** Switching phase moves the conductor count with it, unless the contractor changed it. */
  function followPhase(): void {
    const phase = phaseEl?.value as Phase | undefined;
    if (!phase || !(phase in PHASES) || phase === lastPhase) return;
    if (conductorsEl && Number(conductorsEl.value) === DEFAULT_CONDUCTORS[lastPhase])
      conductorsEl.value = String(DEFAULT_CONDUCTORS[phase]);
    lastPhase = phase;
  }

  function currentPriceKey(input: VdropInput, r: VdropResult): string {
    return priceKey(input.material, wireSize(input, r) ?? input.size);
  }

  function renderNotes(list: string[]): void {
    if (!notesEl) return;
    notesEl.replaceChildren(
      ...list.map((text) => {
        const li = document.createElement('li');
        li.className = 'rounded-lg border border-slate-200 bg-white px-3 py-2';
        li.textContent = text;
        return li;
      })
    );
    notesEl.hidden = list.length === 0;
  }

  function render(): { input: VdropInput; result: VdropResult } {
    followPhase();
    const input = readInputs();
    const r = computeVdrop(input);
    const metal = MATERIALS[input.material];
    const entered = SIZES[input.size].label;
    const t = `${fmtTrim(input.target)}%`;

    if (customWrap) customWrap.hidden = input.volts !== 'custom';

    setOut('drop', `${fmtTrim(r.drop, 2)} V`);
    setOut(
      'drop-note',
      `${fmtTrim(r.pct, 2)}% of ${fmtTrim(r.volts)} V. ${t} allows ${fmtTrim(r.allowedDrop, 2)} V.`
    );
    setOut('load', `${fmtTrim(r.loadVolts, 1)} V`);
    setOut('load-note', `at the end of ${fmtTrim(input.length)} ft`);
    setOut('status', r.passes ? `Within ${t}` : `Over ${t}`);
    if (statusEl) {
      statusEl.dataset.status = r.passes ? 'pass' : 'fail';
      statusEl.className = `${STATUS_BASE} ${r.passes ? 'text-emerald-700' : 'text-red-700'}`;
    }
    setOut('status-note', `${entered} ${metal}`);
    setOut('min-label', `Smallest ${metal} for ${t}`);
    if (r.min) {
      const smaller = SIZE_IDS.indexOf(r.min.size) < SIZE_IDS.indexOf(input.size);
      setOut('min', SIZES[r.min.size].label);
      setOut(
        'min-note',
        `${fmtTrim(r.min.drop, 2)} V, ${fmtTrim(r.min.pct, 2)}%${
          smaller ? `. Smaller than your ${entered}, but never go below your ampacity size.` : ''
        }`
      );
    } else {
      setOut('min', 'None');
      setOut('min-note', `No single size up to 500 kcmil. Add a parallel set.`);
    }
    setOut('max-label', `Longest run at ${t}`);
    setOut('max', r.maxLength == null ? '—' : `${fmt(Math.floor(r.maxLength))} ft`);
    setOut('max-note', `${entered} ${metal} at ${fmtTrim(input.amps)} A, one way`);
    renderNotes(notes(input, r));

    const size = wireSize(input, r);
    const feet = wireFeet(input);
    const key = currentPriceKey(input, r);
    const perFoot = prices[key];
    if (priceInput && key !== shownPriceKey) {
      priceInput.value = perFoot != null ? String(perFoot) : '';
      shownPriceKey = key;
    }
    const label = wireLabel(input.material, size ?? input.size);
    setOut('price-label', `${label}, per ft ($)`);
    setOut('feet', size == null ? '—' : `${fmt(feet)} ft`);
    setOut(
      'feet-note',
      size == null
        ? 'No size meets the target. Price the size you entered, or add a parallel set.'
        : `${label}: ${footageNote(input)}`
    );
    setOut('per-ft', perFoot == null ? '—' : unitPrice(perFoot));
    const cost = size == null ? null : wireCost(feet, perFoot);
    setOut('cost', cost == null ? '—' : money(cost));
    setOut(
      'price-hint',
      cost == null
        ? `Enter your price per foot for ${label} to price the wire. It is saved in this browser for that size.`
        : `Priced with your saved price for ${label}.`
    );
    return { input, result: r };
  }

  root.addEventListener('input', (ev) => {
    const t = ev.target as HTMLElement;
    if (t.matches('[data-wire-price]') && priceInput) {
      const input = readInputs();
      const key = currentPriceKey(input, computeVdrop(input));
      const n = parseNum(priceInput.value);
      if (n != null && n >= 0) prices[key] = n;
      else delete prices[key];
      savePrices(TOOL, prices);
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
    if (t.matches('select[data-in]')) {
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
      const size = wireSize(input, result);
      if (size == null) {
        setNote(
          `No ${MATERIALS[input.material]} size up to 500 kcmil meets ${fmtTrim(input.target)}%. Add a parallel set, or price the size you entered.`
        );
        return;
      }
      const lines = estimateLines(input, result, prices);
      if (!lines.length) {
        setNote('Enter the run length first.');
        return;
      }
      saveEstimate(withLines(loadEstimate(), groupLabel(input), lines));
      setNote(
        `Added ${fmt(lines[0].qty)} ft of ${wireLabel(input.material, size)} to your estimate below.`
      );
      trackTool(TOOL, 'add_to_estimate', { lines: lines.length });
    } else if (action === 'copy-link') {
      const ok = await copyText(resultUrl(toParams(input)));
      setNote(
        ok
          ? 'Link copied. Anyone who opens it sees this circuit.'
          : 'Copy the address bar to share this result.'
      );
      trackTool(TOOL, 'copy_link');
    } else if (action === 'reset') {
      writeInputs(DEFAULT_INPUT);
      lastPhase = DEFAULT_INPUT.phase;
      const next = render();
      syncUrl(toParams(next.input));
      setNote('Back to the example circuit.');
    }
  });

  render();
  root.dataset.ready = 'true';
}
