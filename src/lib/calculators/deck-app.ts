// DOM controller for /tools/deck-calculator/. Reads the deck inputs (seeded
// from the query string so a shared link reproduces the result), renders the
// takeoff, prices it with the contractor's own remembered unit prices, and adds
// lines to the estimate tray. Math lives in ./deck.
import {
  BAGS,
  computeDeck,
  DEFAULT_INPUT,
  estimateLines,
  fromParams,
  groupLabel,
  MAX_STOCK_FT,
  PARAM_KEYS,
  priceDeck,
  toParams,
  TOOL,
  type DeckInput,
  type DeckPrices,
} from './deck';
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

  function writeInputs(input: DeckInput): void {
    const params = toParams(input);
    for (const el of fields) {
      const key = el.dataset.in ?? '';
      if (key in params) el.value = params[key as keyof typeof params];
    }
  }

  function readInputs(): DeckInput {
    const values: Record<string, string> = {};
    for (const el of fields) values[el.dataset.in ?? ''] = el.value;
    return fromParams(values);
  }

  function readPrices(): DeckPrices {
    const out: DeckPrices = {};
    for (const el of priceFields) {
      const key = el.dataset.price as keyof DeckPrices;
      const n = parseNum(el.value);
      if (n != null && n >= 0) out[key] = n;
    }
    return out;
  }

  let prices: DeckPrices = loadPrices(TOOL);
  for (const el of priceFields) {
    const v = prices[el.dataset.price as keyof DeckPrices];
    el.value = v != null ? String(v) : '';
  }
  writeInputs(fromParams(readParams(PARAM_KEYS)));

  function render(): { input: DeckInput; result: ReturnType<typeof computeDeck> } {
    const input = readInputs();
    const r = computeDeck(input);
    const p = priceDeck(r, prices);

    setOut('area', fmt(Math.round(r.area)));
    setOut(
      'area-note',
      `${fmtTrim(input.length)} ft along the house × ${fmtTrim(input.projection)} ft out`
    );
    setOut('boards', fmt(r.boards));
    setOut(
      'boards-note',
      `${input.boardLength}-ft boards: ${fmt(r.rows)} rows, ${fmt(Math.round(r.deckingFt))} ft installed, incl. ${fmtTrim(input.waste)}% waste`
    );
    setOut('joists', fmt(r.joists));
    setOut(
      'joists-note',
      r.joistOverStock
        ? `${r.joistLength} ft long, over ${MAX_STOCK_FT} ft: check stock with your yard or add a beam`
        : r.joists > 0
          ? `${r.joistLength}-ft stock, ${input.spacing}" o.c., both end joists included`
          : 'Enter the deck size'
    );
    setOut('hangers', fmt(r.hangers));
    setOut('framing', fmt(Math.round(r.framingFt)));
    setOut(
      'framing-note',
      `${fmtTrim(r.ledgerFt)} ledger + ${fmtTrim(r.rimFt)} rim + ${fmtTrim(r.beamFt)} beam (${input.plies} ${input.plies === 1 ? 'ply' : 'plies'})`
    );
    setOut('posts', fmt(r.posts));
    setOut(
      'posts-note',
      `One beam, posts no more than ${fmtTrim(input.postSpacing)} ft apart, one footing each`
    );
    setOut('bags', fmt(r.bags));
    setOut(
      'bags-note',
      `${BAGS[input.bag].label} bags for ${fmtTrim(r.concreteCuft, 1)} cu ft, ${fmtTrim(r.footingCuft, 2)} per footing`
    );
    setOut('screws', input.fastener === 'screws' ? fmt(r.screws) : '—');
    setOut(
      'screws-note',
      input.fastener === 'screws'
        ? '2 per board at every joist it crosses'
        : 'Hidden fasteners: count clips from the maker’s coverage chart, plus face screws for the first and last boards.'
    );

    setOut('material', p.material == null ? '—' : money(p.material));
    setOut('labor', p.labor == null ? '—' : money(p.labor));
    setOut('total', p.total == null ? '—' : money(p.total));
    setOut('per-sqft', p.perSqft == null ? '—' : `${money(p.perSqft)} per sq ft of deck`);
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
        setNote('Enter the deck size first.');
        return;
      }
      saveEstimate(withLines(loadEstimate(), groupLabel(input), lines));
      setNote(`Added ${lines.length} lines to your estimate below.`);
      trackTool(TOOL, 'add_to_estimate', { lines: lines.length });
    } else if (action === 'copy-link') {
      const ok = await copyText(resultUrl(toParams(input)));
      setNote(
        ok
          ? 'Link copied. Anyone who opens it sees this deck.'
          : 'Copy the address bar to share this result.'
      );
      trackTool(TOOL, 'copy_link');
    } else if (action === 'reset') {
      writeInputs(DEFAULT_INPUT);
      const next = render();
      syncUrl(toParams(next.input));
      setNote('Back to the example deck.');
    }
  });

  render();
  root.dataset.ready = 'true';
}
