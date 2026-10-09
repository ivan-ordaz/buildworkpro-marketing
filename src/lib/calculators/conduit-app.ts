// DOM controller for /tools/conduit-fill-calculator/. Reads the raceway and the
// conductor rows (seeded from the query string so a shared link reproduces the
// result), renders the fill check, the smallest passing size and the jam ratio,
// prices the run with the contractor's own remembered prices, and adds lines to
// the estimate tray. Math lives in ./conduit.
import {
  computeFill,
  CONDUCTORS,
  DEFAULT_INPUT,
  estimateLines,
  fromParams,
  groupLabel,
  JAM,
  MAX_ROWS,
  NEW_ROW,
  PARAM_KEYS,
  priceFill,
  racewayKey,
  racewayName,
  ROW_KEYS,
  toParams,
  TOOL,
  TRADE_LABEL,
  WIRE_LABEL,
  wireKey,
  type ConductorType,
  type FillInput,
  type FillPrices,
  type FillResult,
  type TradeSize,
  type WireSize,
} from './conduit';
import { fmt, money, parseNum } from './format';
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

type State = 'pass' | 'fail' | 'none';
const STATUS: Record<State, { text: string; cls: string; bar: string }> = {
  pass: {
    text: 'Passes',
    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    bar: 'bg-emerald-500',
  },
  fail: { text: 'Fails', cls: 'bg-red-50 text-red-700 border-red-200', bar: 'bg-red-500' },
  none: {
    text: 'No wires',
    cls: 'bg-slate-100 text-slate-600 border-slate-200',
    bar: 'bg-slate-400',
  },
};
const PILL = 'shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold';
const JAM_CLS = {
  risk: ['border-amber-300', 'bg-amber-50'],
  ok: ['border-slate-200', 'bg-white'],
};

export function mount(root: HTMLElement): void {
  const fields = Array.from(
    root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-in]')
  );
  const slots = Array.from(root.querySelectorAll<HTMLElement>('[data-row]'));
  const racePrice = root.querySelector<HTMLInputElement>('[data-price="raceway"]');
  const addRowBtn = root.querySelector<HTMLButtonElement>('[data-action="add-row"]');
  const useBtn = root.querySelector<HTMLButtonElement>('[data-action="use-smallest"]');
  const statusPill = root.querySelector<HTMLElement>('[data-status]');
  const bar = root.querySelector<HTMLElement>('[data-fill-bar]');
  const mark = root.querySelector<HTMLElement>('[data-limit-mark]');
  const jamCell = root.querySelector<HTMLElement>('[data-jam-cell]');
  const note = root.querySelector<HTMLElement>('[data-note]');
  let rowCount = 0;
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
  const slotEl = <T extends HTMLElement>(slot: HTMLElement, key: string) =>
    slot.querySelector<T>(`[data-row-in="${key}"]`);
  const wirePriceEl = (slot: HTMLElement) =>
    slot.querySelector<HTMLInputElement>('[data-wire-price]');

  function writeInputs(input: FillInput): void {
    const params = toParams(input);
    for (const el of fields) {
      const key = el.dataset.in ?? '';
      if (el instanceof HTMLInputElement && el.type === 'checkbox')
        el.checked = params[key] === '1';
      else if (key in params) el.value = params[key];
    }
    rowCount = Math.min(input.rows.length, MAX_ROWS, slots.length);
    slots.forEach((slot, i) => {
      const row = input.rows[i];
      slot.hidden = i >= rowCount;
      if (!row) return;
      const qty = slotEl<HTMLInputElement>(slot, 'qty');
      const size = slotEl<HTMLSelectElement>(slot, 'size');
      const type = slotEl<HTMLSelectElement>(slot, 'type');
      if (qty) qty.value = String(row.qty);
      if (size) size.value = row.size;
      if (type) type.value = row.type;
    });
  }

  function slotRow(slot: HTMLElement): string {
    return [
      slotEl<HTMLInputElement>(slot, 'qty')?.value ?? '',
      slotEl<HTMLSelectElement>(slot, 'type')?.value ?? '',
      slotEl<HTMLSelectElement>(slot, 'size')?.value ?? '',
    ].join('.');
  }

  function readInputs(): FillInput {
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
    slots.slice(0, rowCount).forEach((slot, i) => {
      values[ROW_KEYS[i]] = slotRow(slot);
    });
    return fromParams(values);
  }

  /** The wire price field of a row is keyed by that row's conductor type and size. */
  function slotKey(slot: HTMLElement): string {
    const type = (slotEl<HTMLSelectElement>(slot, 'type')?.value ?? 'thhn') as ConductorType;
    const size = (slotEl<HTMLSelectElement>(slot, 'size')?.value ?? '12') as WireSize;
    return wireKey(type, size);
  }

  const prices: FillPrices = loadPrices(TOOL);
  const setPrice = (key: string, raw: string) => {
    const n = parseNum(raw);
    if (n != null && n >= 0) prices[key] = n;
    else delete prices[key];
    savePrices(TOOL, prices);
  };

  /** Show the remembered price for whatever raceway and wires are selected now. */
  function showPrices(input: FillInput): void {
    const active = document.activeElement;
    if (racePrice && racePrice !== active) {
      const v = prices[racewayKey(input.raceway, input.trade)];
      racePrice.value = v != null ? String(v) : '';
    }
    for (const slot of slots.slice(0, rowCount)) {
      const el = wirePriceEl(slot);
      if (!el || el === active) continue;
      const v = prices[slotKey(slot)];
      el.value = v != null ? String(v) : '';
    }
  }

  writeInputs(fromParams(readParams(PARAM_KEYS)));

  function renderFill(input: FillInput, r: FillResult): void {
    const state: State = r.count === 0 ? 'none' : r.pass ? 'pass' : 'fail';
    const name = racewayName(input);
    if (statusPill) {
      statusPill.textContent = STATUS[state].text;
      statusPill.className = `${PILL} ${STATUS[state].cls}`;
    }
    root.dataset.fill = state;
    if (bar) {
      bar.style.width = `${Math.min(100, r.fillPct)}%`;
      bar.className = `h-2 rounded-full ${STATUS[state].bar}`;
    }
    if (mark) mark.style.left = `${r.allowedPct}%`;

    setOut('fill', r.count ? `${fmt(r.fillPct, 1)}%` : '—');
    setOut(
      'fill-note',
      r.count
        ? `${fmt(r.count)} conductor${r.count === 1 ? '' : 's'}: ${r.conductorArea.toFixed(4)} of ${r.allowedArea.toFixed(4)} sq in allowed`
        : 'Add at least one conductor.'
    );
    setOut('limit', `${r.allowedPct}%`);
    setOut(
      'limit-note',
      input.nipple
        ? 'Nipple 24 in or shorter (Chapter 9, Note 4)'
        : r.count <= 1
          ? 'One conductor (Chapter 9, Table 1)'
          : r.count === 2
            ? 'Two conductors (Chapter 9, Table 1)'
            : 'Over two conductors (Chapter 9, Table 1)'
    );
    setOut('cond-area', r.conductorArea.toFixed(4));
    setOut(
      'cond-area-note',
      r.wire
        .map((w) => `${w.qty} × ${WIRE_LABEL[w.size]} ${CONDUCTORS[w.type].label}`)
        .join(', ') || 'No conductors'
    );
    setOut('race-area', r.racewayArea.toFixed(3));
    setOut('race-area-note', `${name}, ${r.racewayId.toFixed(3)} in inside`);

    const smallest = r.smallest;
    setOut('smallest', smallest ? `${TRADE_LABEL[smallest]} in` : r.count ? 'Over 4 in' : '—');
    setOut(
      'smallest-note',
      !r.count
        ? 'Add conductors to size the raceway.'
        : !smallest
          ? 'Split the conductors between raceways or use a larger one.'
          : smallest === input.trade
            ? 'The size you picked.'
            : `Smallest ${racewayName({ ...input, trade: smallest })} that passes.`
    );
    if (useBtn) {
      useBtn.hidden = !smallest || smallest === input.trade;
      if (smallest) useBtn.textContent = `Use ${TRADE_LABEL[smallest]} in`;
      useBtn.dataset.trade = smallest ?? '';
    }

    const jam = r.jam;
    setOut('jam', jam.ratio != null ? jam.ratio.toFixed(2) : '—');
    setOut(
      'jam-note',
      !jam.applies
        ? 'Checked when exactly three conductors share the raceway.'
        : !jam.same
          ? 'The ratio check is for three conductors of one size.'
          : jam.risk
            ? `Between ${JAM.low} and ${JAM.high}: three conductors can jam in a pull. Go up a size or pull with care.`
            : `Outside ${JAM.low} to ${JAM.high}, so jamming is unlikely.`
    );
    if (jamCell) {
      jamCell.classList.remove(...JAM_CLS.risk, ...JAM_CLS.ok);
      jamCell.classList.add(...(jam.risk ? JAM_CLS.risk : JAM_CLS.ok));
      jamCell.dataset.risk = jam.risk ? 'true' : 'false';
    }

    const notes: string[] = [];
    if (r.maxSame != null && r.wire[0])
      notes.push(
        `${name} takes up to ${fmt(r.maxSame)} × ${WIRE_LABEL[r.wire[0].size]} ${CONDUCTORS[r.wire[0].type].label}.`
      );
    if (r.byNote7)
      notes.push(
        'Passes under Chapter 9, Note 7: with one wire size, the count rounds up when the decimal is 0.8 or more.'
      );
    if (r.close)
      notes.push(
        'Within 1% of the limit. Check this one against NEC Chapter 9, Tables 4 and 5 before you pull.'
      );
    setOut('code-note', notes.join(' '));
  }

  function render(): { input: FillInput; result: FillResult } {
    const input = readInputs();
    const r = computeFill(input);
    const p = priceFill(input, r, prices);
    renderFill(input, r);
    showPrices(input);

    const feet = r.wire.reduce((s, w) => s + w.feet, 0);
    setOut('race-price-label', racewayName(input));
    setOut('raceway-label', `${racewayName(input)}, ${fmt(input.run)} ft`);
    setOut('wire-label', `Wire, ${fmt(feet)} ft`);
    setOut('raceway-cost', p.raceway == null ? '—' : money(p.raceway));
    setOut('wire-cost', p.wire == null ? '—' : money(p.wire));
    setOut('total', p.total == null ? '—' : money(p.total));
    setOut('per-ft', p.perFt == null ? '—' : `${money(p.perFt)} per ft of run`);
    setOut(
      'price-hint',
      p.total == null
        ? 'Enter your price per foot for the raceway and each wire size to price the run. They are saved in this browser for next time.'
        : p.raceway != null && p.wireComplete
          ? 'Priced with your saved prices.'
          : 'Some items have no price yet, so the total is partial.'
    );
    if (addRowBtn) addRowBtn.disabled = rowCount >= MAX_ROWS;
    for (const slot of slots) {
      const btn = slot.querySelector<HTMLButtonElement>('[data-action="remove-row"]');
      if (btn) btn.disabled = rowCount <= 1;
    }
    return { input, result: r };
  }

  const recalc = () => {
    const { input } = render();
    syncUrl(toParams(input));
    trackOnce('calculate');
  };

  root.addEventListener('input', (ev) => {
    const t = ev.target as HTMLElement;
    if (t.matches('[data-price="raceway"]')) {
      const input = readInputs();
      setPrice(racewayKey(input.raceway, input.trade), (t as HTMLInputElement).value);
      render();
      trackOnce('price_entered');
      return;
    }
    if (t.matches('[data-wire-price]')) {
      const slot = t.closest<HTMLElement>('[data-row]');
      if (slot) setPrice(slotKey(slot), (t as HTMLInputElement).value);
      render();
      trackOnce('price_entered');
      return;
    }
    if (t.matches('[data-in], [data-row-in]')) recalc();
  });
  root.addEventListener('change', (ev) => {
    const t = ev.target as HTMLElement;
    if (t.matches('select[data-in], input[type="checkbox"][data-in], select[data-row-in]'))
      recalc();
  });

  root.addEventListener('click', async (ev) => {
    const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'add-row' || action === 'remove-row') {
      const input = readInputs();
      if (action === 'add-row' && input.rows.length < MAX_ROWS) input.rows.push({ ...NEW_ROW });
      if (action === 'remove-row' && input.rows.length > 1) {
        const at = slots.indexOf(btn.closest<HTMLElement>('[data-row]') as HTMLElement);
        if (at >= 0) input.rows.splice(at, 1);
      }
      writeInputs(input);
      recalc();
      if (action === 'add-row')
        slotEl<HTMLInputElement>(slots[rowCount - 1], 'qty')?.focus({ preventScroll: true });
      return;
    }
    if (action === 'use-smallest') {
      const trade = btn.dataset.trade as TradeSize | undefined;
      const select = fields.find((el) => el.dataset.in === 'ts');
      if (trade && select) {
        select.value = trade;
        recalc();
        setNote(`Switched to ${TRADE_LABEL[trade]} in.`);
      }
      return;
    }
    const { input, result } = render();
    if (action === 'add') {
      if (!result.count) {
        setNote('Add at least one conductor first.');
        return;
      }
      if (!result.pass) {
        setNote(
          result.smallest
            ? `This fill fails in ${racewayName(input)}. Use ${TRADE_LABEL[result.smallest]} in or larger before adding it.`
            : `This fill fails even in 4 in. Split the conductors between raceways before adding it.`
        );
        return;
      }
      const lines = estimateLines(input, result, prices);
      if (input.run <= 0 || !lines.length) {
        setNote('Enter the run length first.');
        return;
      }
      saveEstimate(withLines(loadEstimate(), groupLabel(input), lines));
      setNote(`Added ${lines.length} lines to your estimate below.`);
      trackTool(TOOL, 'add_to_estimate', { lines: lines.length });
    } else if (action === 'copy-link') {
      const ok = await copyText(resultUrl(toParams(input)));
      setNote(
        ok
          ? 'Link copied. Anyone who opens it sees this raceway and these wires.'
          : 'Copy the address bar to share this result.'
      );
      trackTool(TOOL, 'copy_link');
    } else if (action === 'reset') {
      writeInputs({ ...DEFAULT_INPUT, rows: DEFAULT_INPUT.rows.map((r) => ({ ...r })) });
      const next = render();
      syncUrl(toParams(next.input));
      setNote('Back to the example fill.');
    }
  });

  render();
  root.dataset.ready = 'true';
}
