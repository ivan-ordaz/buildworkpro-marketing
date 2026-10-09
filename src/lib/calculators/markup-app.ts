// DOM controller for /tools/markup-vs-margin-calculator/. The job cost and the
// three linked fields (markup, margin, selling price: whichever was typed last
// drives the other two) are seeded from the query string so a shared link
// reproduces the result. The overhead section prices the job to cover company
// overhead and a net profit target, and checks what adding both to cost earns.
// The annual figures in the overhead helper stay in this browser and never go in
// the URL. The shared estimate is only read, never changed. Math lives in ./markup.
import {
  addedToCost,
  DEFAULT_INPUT,
  estimateCost,
  fromParams,
  overheadRate,
  PARAM_KEYS,
  pct,
  priceForOverhead,
  solve,
  SOLVE_BY,
  toParams,
  TOOL,
  type Basis,
  type MarkupInput,
  type SolveBy,
} from './markup';
import { fmt, money, parseNum } from './format';
import { ESTIMATE_EVENT, ESTIMATE_KEY, loadEstimate, round2 } from './estimate';
import {
  copyText,
  loadPrices,
  readParams,
  resultUrl,
  savePrices,
  syncUrl,
  trackTool,
} from './browser';

type Annual = { overhead?: number; revenue?: number; cost?: number };

/** Up to four decimals, no grouping: what goes back into a typed field. */
const plain = (n: number) => String(Number(n.toFixed(4)) + 0);
/** A computed percentage written into a field: two decimals, trailing zeros dropped. */
const pctField = (n: number) => String(Number(n.toFixed(2)) + 0);
/** A computed price written into a field: cents, with grouping (parseNum reads it back). */
const moneyField = (n: number) => fmt(n, 2);

export function mount(root: HTMLElement): void {
  const q = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel);
  const costEl = q<HTMLInputElement>('[data-in="c"]');
  const ohEl = q<HTMLInputElement>('[data-in="oh"]');
  const basisEl = q<HTMLSelectElement>('[data-in="ob"]');
  const npEl = q<HTMLInputElement>('[data-in="np"]');
  const solveFields = Array.from(root.querySelectorAll<HTMLInputElement>('[data-solve]'));
  const field = (by: SolveBy) => solveFields.find((el) => el.dataset.solve === by);
  const annualOverheadEl = q<HTMLInputElement>('[data-annual="overhead"]');
  const annualBaseEl = q<HTMLInputElement>('[data-annual="base"]');
  const useRateBtn = q<HTMLButtonElement>('[data-action="use-rate"]');
  const estimateBox = q<HTMLElement>('[data-estimate-box]');
  const note = q<HTMLElement>('[data-note]');
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
  const dash = (n: number | null, f: (n: number) => string) => (n == null ? '—' : f(n));

  let anchor: SolveBy = DEFAULT_INPUT.by;

  function writeInputs(input: MarkupInput): void {
    anchor = input.by;
    if (costEl) costEl.value = input.cost == null ? '' : plain(input.cost);
    const a = field(input.by);
    if (a) a.value = input.value == null ? '' : plain(input.value);
    if (ohEl) ohEl.value = plain(input.overhead);
    if (basisEl) basisEl.value = input.basis;
    if (npEl) npEl.value = plain(input.profit);
  }

  function readInputs(): MarkupInput {
    return fromParams({
      c: costEl?.value ?? '',
      by: anchor,
      v: field(anchor)?.value ?? '',
      oh: ohEl?.value ?? '',
      ob: basisEl?.value ?? '',
      np: npEl?.value ?? '',
    });
  }

  // Annual overhead helper: remembered in this browser like the other tools' prices.
  let annual: Annual = loadPrices(TOOL);
  const basisKey = (b: Basis) => (b === 'r' ? 'revenue' : 'cost');
  function writeAnnual(basis: Basis): void {
    if (annualOverheadEl)
      annualOverheadEl.value = annual.overhead != null ? String(annual.overhead) : '';
    const base = annual[basisKey(basis)];
    if (annualBaseEl) annualBaseEl.value = base != null ? String(base) : '';
  }
  function readAnnual(basis: Basis): void {
    const next: Annual = { ...annual };
    const o = parseNum(annualOverheadEl?.value);
    const b = parseNum(annualBaseEl?.value);
    if (o != null && o >= 0) next.overhead = o;
    else delete next.overhead;
    if (b != null && b >= 0) next[basisKey(basis)] = b;
    else delete next[basisKey(basis)];
    annual = next;
    savePrices(TOOL, annual as Record<string, number>);
  }

  function annualRate(basis: Basis): number | null {
    return overheadRate(annual.overhead ?? null, annual[basisKey(basis)] ?? null);
  }

  function refreshEstimate(): void {
    const t = estimateCost(loadEstimate());
    if (estimateBox) estimateBox.hidden = t == null;
    if (!t) return;
    setOut('est-total', money(t.total));
    setOut(
      'est-note',
      `${t.priced} priced ${t.priced === 1 ? 'line' : 'lines'}` +
        (t.unpriced ? `, ${t.unpriced} without a price left out` : '')
    );
  }

  function render(): MarkupInput {
    const input = readInputs();
    const { cost, by, value } = input;

    // Linked fields: the one typed in stays as typed, the other two are filled in.
    const s = solve(cost, by, value);
    for (const el of solveFields) {
      const key = el.dataset.solve as SolveBy;
      el.toggleAttribute('data-computed', key !== by);
      if (key === by) continue;
      const v = s[key];
      el.value = v == null ? '' : key === 'price' ? moneyField(v) : pctField(v);
    }
    setOut('solve-price', dash(s.price, money));
    setOut('solve-profit', dash(s.profit, money));
    setOut('solve-markup', dash(s.markup, pct));
    setOut('solve-margin', dash(s.margin, pct));
    let sentence: string;
    if (s.error) sentence = s.error;
    else if (value == null) sentence = 'Type a markup, a margin or a selling price.';
    else if (by === 'price')
      sentence =
        `Selling at ${money(value)} on ${money(cost ?? 0)} of cost is a markup of ${pct(s.markup ?? 0)}` +
        (s.margin == null ? '.' : ` and a margin of ${pct(s.margin)}.`) +
        ((s.profit ?? 0) < 0 ? ' That price is below cost.' : '');
    else
      sentence =
        `A markup of ${pct(s.markup ?? 0)} is a margin of ${pct(s.margin ?? 0)}.` +
        (cost == null || s.price == null || s.profit == null
          ? ' Enter the job cost to see the price.'
          : ` On ${money(cost)} of cost the price is ${money(s.price)}, and ${money(s.profit)} of it is gross profit.`);
    setOut('solve-note', sentence);

    // Overhead and net profit.
    const o = priceForOverhead(cost, input.overhead, input.basis, input.profit);
    setOut('oh-price', dash(o.price, money));
    setOut('oh-markup', dash(o.markup, pct));
    setOut('oh-margin', dash(o.margin, pct));
    setOut('oh-overhead', dash(o.overheadAmt, money));
    setOut('oh-net', dash(o.netAmt, money));
    const oh = pct(input.overhead);
    const np = pct(input.profit);
    setOut(
      'oh-note',
      o.error
        ? o.error
        : input.basis === 'r'
          ? `Price = cost ÷ (1 − ${oh} − ${np}) = cost ÷ ${plain(1 - (input.overhead + input.profit) / 100)}.`
          : `Price = cost × (1 + ${oh}) ÷ (1 − ${np}) = cost × ${plain(1 + input.overhead / 100)} ÷ ${plain(1 - input.profit / 100)}.`
    );
    setOut(
      'oh-price-note',
      cost == null ? 'Enter the job cost above to see dollars.' : `On ${money(cost)} of job cost`
    );
    setOut(
      'oh-overhead-label',
      input.basis === 'r' ? `Overhead, ${oh} of price` : `Overhead, ${oh} of cost`
    );
    setOut('oh-net-label', `Net profit, ${np} of price`);

    // The same two rates added to cost.
    const a = addedToCost(cost, input.overhead, input.basis, input.profit);
    setOut('add-title', `Adding ${oh} + ${np} to cost instead`);
    setOut('add-markup', pct(a.markup));
    setOut('add-margin', pct(a.margin));
    setOut('add-overhead', pct(a.overheadShare));
    setOut('add-net', pct(a.net));
    setOut('add-net-label', `Net profit left (target ${np})`);
    setOut(
      'add-short',
      o.error
        ? '—'
        : a.shortBy != null
          ? money(a.shortBy)
          : a.shortPctOfCost != null
            ? `${pct(a.shortPctOfCost)} of cost`
            : '—'
    );

    // Overhead helper.
    const rate = annualRate(input.basis);
    setOut('base-label', input.basis === 'r' ? 'Annual revenue ($)' : 'Annual direct job cost ($)');
    setOut(
      'rate',
      rate == null
        ? `Enter last year’s overhead and ${input.basis === 'r' ? 'revenue' : 'direct job cost'}.`
        : `Overhead is ${pct(rate)} of ${input.basis === 'r' ? 'revenue' : 'job cost'}.`
    );
    if (useRateBtn) {
      useRateBtn.disabled = rate == null;
      useRateBtn.textContent = rate == null ? 'Use this rate' : `Use ${pct(rate)}`;
    }
    return input;
  }

  writeAnnual(fromParams(readParams(PARAM_KEYS)).basis);
  writeInputs(fromParams(readParams(PARAM_KEYS)));

  const update = () => {
    syncUrl(toParams(render()));
    trackOnce('calculate');
  };

  root.addEventListener('input', (ev) => {
    const t = ev.target as HTMLElement;
    if (t.matches('[data-annual]')) {
      readAnnual(readInputs().basis);
      render();
      trackOnce('overhead_helper');
      return;
    }
    if (t.matches('[data-solve]')) {
      const by = (t as HTMLInputElement).dataset.solve as SolveBy;
      if ((SOLVE_BY as readonly string[]).includes(by)) anchor = by;
      update();
      return;
    }
    if (t.matches('input[data-in]')) update();
  });
  root.addEventListener('change', (ev) => {
    const t = ev.target as HTMLElement;
    if (t.matches('select[data-in]')) {
      writeAnnual(readInputs().basis);
      update();
    }
  });

  root.addEventListener('click', async (ev) => {
    const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'use-rate') {
      const rate = annualRate(readInputs().basis);
      if (rate == null || !ohEl) return;
      ohEl.value = pctField(rate);
      update();
      trackTool(TOOL, 'use_overhead_rate');
    } else if (action === 'use-estimate') {
      const t = estimateCost(loadEstimate());
      if (!t || !costEl) return;
      // Price the estimate at the chosen margin: a typed price would no longer fit the new cost.
      if (anchor === 'price') {
        const margin = field('margin')?.value ?? '';
        anchor = parseNum(margin) != null ? 'margin' : 'markup';
        const a = field(anchor);
        if (a && parseNum(a.value) == null) a.value = plain(DEFAULT_INPUT.value ?? 0);
      }
      costEl.value = plain(round2(t.total));
      update();
      setNote(`Job cost set to your estimate total, ${money(t.total)}. The estimate is unchanged.`);
      trackTool(TOOL, 'use_estimate', { lines: t.priced });
    } else if (action === 'copy-link') {
      const ok = await copyText(resultUrl(toParams(render())));
      setNote(
        ok
          ? 'Link copied. Anyone who opens it sees these numbers.'
          : 'Copy the address bar to share this result.'
      );
      trackTool(TOOL, 'copy_link');
    } else if (action === 'reset') {
      for (const el of solveFields) el.value = '';
      writeInputs(DEFAULT_INPUT);
      writeAnnual(DEFAULT_INPUT.basis);
      syncUrl(toParams(render()));
      const d = DEFAULT_INPUT;
      setNote(
        `Back to the example: a ${pct(d.value ?? 0)} markup, ${pct(d.overhead)} overhead and ${pct(d.profit)} net profit.`
      );
    }
  });

  // The estimate lives in this browser and can change in another tab.
  window.addEventListener('storage', (ev) => {
    if (ev.key === ESTIMATE_KEY || ev.key == null) refreshEstimate();
  });
  window.addEventListener(ESTIMATE_EVENT, refreshEstimate);

  refreshEstimate();
  render();
  root.dataset.ready = 'true';
}
