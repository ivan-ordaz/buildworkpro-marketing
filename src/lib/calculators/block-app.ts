// DOM controller for /tools/concrete-block-calculator/. Reads the wall inputs
// (seeded from the query string so a shared link reproduces the result), renders
// the takeoff, prices it with the contractor's own remembered unit prices, and
// adds lines to the estimate tray. Math lives in ./block.
import {
  computeBlock,
  DEFAULT_INPUT,
  estimateLines,
  fromParams,
  GROUT_BAG_CUFT,
  groupLabel,
  jointDesc,
  MORTAR_BAGS,
  MORTAR_BLOCKS_PER_80LB,
  PARAM_KEYS,
  priceBlock,
  toParams,
  TOOL,
  type BlockInput,
  type BlockPrices,
  type BlockResult,
} from './block';
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
  const groutSelect = root.querySelector<HTMLSelectElement>('[data-in="g"]');
  const rateField = root.querySelector<HTMLInputElement>('[data-in="mb"]');
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

  function writeInputs(input: BlockInput): void {
    const params = toParams(input);
    for (const el of fields) el.value = params[el.dataset.in ?? ''] ?? '';
  }

  function readInputs(): BlockInput {
    const values: Record<string, string> = {};
    for (const el of fields) values[el.dataset.in ?? ''] = el.value;
    return fromParams(values);
  }

  function readPrices(): BlockPrices {
    const out: BlockPrices = {};
    for (const el of priceFields) {
      const key = el.dataset.price as keyof BlockPrices;
      const n = parseNum(el.value);
      if (n != null && n >= 0) out[key] = n;
    }
    return out;
  }

  let prices: BlockPrices = loadPrices(TOOL);
  for (const el of priceFields) {
    const v = prices[el.dataset.price as keyof BlockPrices];
    el.value = v != null ? String(v) : '';
  }
  writeInputs(fromParams(readParams(PARAM_KEYS)));

  function groutNote(input: BlockInput, r: BlockResult): string {
    if (input.width === '4') return '4 in block is not grouted';
    if (r.grout === 'none') return 'No grout selected';
    const where = r.grout === 'full' ? 'every cell' : `${fmt(r.groutedCells)} cells grouted`;
    const buy =
      input.groutBy === 'bag'
        ? `${fmt(r.groutBags)} bags of 80 lb at ${GROUT_BAG_CUFT} cu ft`
        : `order ${fmtTrim(r.groutOrderCuyd)} cu yd`;
    return `${fmtTrim(r.groutCuft, 1)} cu ft, ${where}; ${buy}`;
  }

  function render(): { input: BlockInput; result: BlockResult } {
    const input = readInputs();
    const r = computeBlock(input);
    const p = priceBlock(input, r, prices);
    const typical = MORTAR_BLOCKS_PER_80LB[input.width];

    if (groutSelect) groutSelect.disabled = input.width === '4';
    if (rateField) rateField.placeholder = `typical ${typical}`;

    setOut('area', fmt(Math.round(r.area)));
    setOut(
      'area-note',
      r.openings > 0
        ? `sq ft: ${fmt(Math.round(r.gross))} gross less ${fmt(Math.round(r.openings))} of openings`
        : 'sq ft, no openings deducted'
    );
    setOut('courses', fmtTrim(r.courses));
    setOut(
      'courses-note',
      Math.abs(r.courses - Math.round(r.courses)) < 1e-6
        ? '8 in courses'
        : 'not a whole number of 8 in courses: cut or half-high top course'
    );
    setOut('blocks', fmt(r.blocks));
    setOut(
      'blocks-note',
      `${fmt(r.blocksLaid)} laid + ${fmtTrim(input.waste)}% waste, ${input.width} in × 8 × 16`
    );
    setOut('mortar', fmt(r.mortarBags));
    setOut(
      'mortar-note',
      `${MORTAR_BAGS[input.bag].label}, ${fmtTrim(r.mortarCuft, 1)} cu ft wet, at ${fmtTrim(r.mortarRate)} blocks per 80 lb${r.mortarTypical ? ' (typical)' : ''}`
    );
    setOut('grout', r.groutCuyd > 0 ? fmt(r.groutCuyd, 2) : '0');
    setOut('grout-note', groutNote(input, r));
    setOut('bars', fmt(r.bars));
    setOut(
      'bars-note',
      r.bars === 0
        ? 'No grouted cells, so no vertical bars'
        : `#${input.bar} × ${fmtTrim(input.height)} ft = ${fmt(Math.round(r.barLf))} LF, ${fmt(r.sticks)} sticks of ${input.stick} ft${r.spliced ? ', spliced' : ''}; laps extra`
    );
    setOut('joint', fmt(Math.round(r.jointLf)));
    setOut(
      'joint-note',
      r.jointRows === 0 ? 'None selected' : `${r.jointRows} rows, ${jointDesc(input)}; laps extra`
    );

    setOut('material', p.material == null ? '—' : money(p.material));
    setOut('labor', p.labor == null ? '—' : money(p.labor));
    setOut('total', p.total == null ? '—' : money(p.total));
    setOut('per-sqft', p.perSqft == null ? '—' : `${money(p.perSqft)} per sq ft of wall`);
    setOut('labor-label', `Labor, lay ${input.width} in block`);
    setOut(
      'price-hint',
      p.total == null
        ? 'Enter your own prices to turn the takeoff into a price. They are saved in this browser for next time.'
        : p.materialComplete
          ? `Priced with your saved prices for ${input.width} in block.`
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
      const lines = estimateLines(input, result, prices);
      if (!lines.length) {
        setNote('Enter the wall size first.');
        return;
      }
      saveEstimate(withLines(loadEstimate(), groupLabel(input), lines));
      setNote(`Added ${lines.length} lines to your estimate below.`);
      trackTool(TOOL, 'add_to_estimate', { lines: lines.length });
    } else if (action === 'copy-link') {
      const ok = await copyText(resultUrl(toParams(input)));
      setNote(
        ok
          ? 'Link copied. Anyone who opens it sees this wall.'
          : 'Copy the address bar to share this result.'
      );
      trackTool(TOOL, 'copy_link');
    } else if (action === 'reset') {
      writeInputs(DEFAULT_INPUT);
      const next = render();
      syncUrl(toParams(next.input));
      setNote('Back to the example wall.');
    }
  });

  render();
  root.dataset.ready = 'true';
}
