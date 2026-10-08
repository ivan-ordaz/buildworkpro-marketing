// DOM controller for /tools/fence-calculator/. Reads the run inputs (seeded
// from the query string so a shared link reproduces the result), renders the
// takeoff, prices it with the contractor's own remembered unit prices, and adds
// lines to the estimate tray. Math lives in ./fence.
import {
  BAGS,
  computeFence,
  DEFAULT_INPUT,
  DEPTH_MAX_FRACTION,
  DEPTH_MIN_FRACTION,
  estimateLines,
  fromParams,
  groupLabel,
  HOLE_DIA_PER_POST_WIDTH,
  PARAM_KEYS,
  POSTS,
  priceFence,
  SPACINGS,
  toParams,
  TOOL,
  typicalRails,
  type FenceInput,
  type FencePrices,
} from './fence';
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

const plural = (n: number, one: string, many: string) => `${fmt(n)} ${n === 1 ? one : many}`;

export function mount(root: HTMLElement): void {
  const fields = Array.from(
    root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-in]')
  );
  const priceFields = Array.from(root.querySelectorAll<HTMLInputElement>('[data-price]'));
  const note = root.querySelector<HTMLElement>('[data-note]');
  const railsAuto = root.querySelector<HTMLOptionElement>('[data-rails-auto]');
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

  function writeInputs(input: FenceInput): void {
    const params = toParams(input);
    for (const el of fields) {
      const key = el.dataset.in ?? '';
      if (key in params) el.value = params[key as keyof typeof params];
    }
  }

  function readInputs(): FenceInput {
    const values: Record<string, string> = {};
    for (const el of fields) values[el.dataset.in ?? ''] = el.value;
    return fromParams(values);
  }

  function readPrices(): FencePrices {
    const out: FencePrices = {};
    for (const el of priceFields) {
      const key = el.dataset.price as keyof FencePrices;
      const n = parseNum(el.value);
      if (n != null && n >= 0) out[key] = n;
    }
    return out;
  }

  let prices: FencePrices = loadPrices(TOOL);
  for (const el of priceFields) {
    const v = prices[el.dataset.price as keyof FencePrices];
    el.value = v != null ? String(v) : '';
  }
  writeInputs(fromParams(readParams(PARAM_KEYS)));

  function render(): { input: FenceInput; result: ReturnType<typeof computeFence> } {
    const input = readInputs();
    const r = computeFence(input);
    const p = priceFence(input, r, prices);
    const height = Number(input.height);
    const spacing = SPACINGS[input.spacing];
    const post = POSTS[input.post];
    const bag = BAGS[input.bag];

    if (railsAuto) railsAuto.textContent = `Typical for ${height} ft (${typicalRails(height)})`;
    setOut(
      'dia-hint',
      `About 3 × the post width: ${fmtTrim(HOLE_DIA_PER_POST_WIDTH * post.actualIn, 1)} in for a ${post.label}.`
    );
    setOut(
      'depth-hint',
      `Typical ${fmtTrim(height * 12 * DEPTH_MIN_FRACTION)}–${fmtTrim(height * 12 * DEPTH_MAX_FRACTION)} in for ${height} ft. Below the frost line where it freezes; check local code.`
    );

    setOut('fenced', fmtTrim(r.fenced));
    setOut(
      'fenced-note',
      r.gates > 0
        ? `${fmtTrim(input.run)} ft run less ${plural(r.gates, 'gate', 'gates')} × ${fmtTrim(input.gateWidth)} ft`
        : 'no gates'
    );
    setOut('sections', fmt(r.sections));
    setOut(
      'sections-note',
      r.sections > 0 && r.lastSection < spacing.ft - 1e-9
        ? `${spacing.ft} ft on center, last one ${fmtTrim(r.lastSection)} ft`
        : `${spacing.ft} ft on center`
    );
    setOut('posts', fmt(r.posts));
    setOut(
      'posts-note',
      r.posts > 0
        ? `${plural(r.sections, 'section', 'sections')} + ${r.gates > 0 ? `${plural(r.gates, 'gate', 'gates')} + ` : ''}1 to end the run`
        : ''
    );
    setOut('post-length', r.postLengthFt > 0 ? `${r.postLengthFt} ft` : '—');
    const shallow = input.holeDepth < height * 12 * DEPTH_MIN_FRACTION - 1e-9;
    setOut(
      'post-length-note',
      r.posts > 0
        ? `${post.label}: ${height} ft above grade + ${fmtTrim(input.holeDepth)} in deep${shallow ? '. Shallower than 1/3 of the height' : ''}`
        : ''
    );
    setOut('rails', fmt(r.rails));
    setOut(
      'rails-note',
      `${r.railFt} ft 2×4s, ${r.railsPerSection} per section${r.railFt > spacing.ft ? `, each spans ${r.railFt / spacing.ft} sections` : ''}`
    );
    setOut('pickets', fmt(r.pickets));
    setOut(
      'pickets-note',
      `${fmt(r.picketsNet)} + ${fmtTrim(input.waste)}% waste, ${fmtTrim(input.picketWidth)} in × ${height} ft`
    );
    setOut('bags', fmt(r.bags));
    setOut(
      'bags-note',
      r.posts > 0
        ? `${bag.label} bags: ${fmt(r.bagsPerPost, 2)} per post (${fmt(r.concretePerPost, 2)} cu ft)`
        : `${bag.label} bags`
    );

    setOut('material', p.material == null ? '—' : money(p.material));
    setOut('gates-price', p.gates == null ? '—' : money(p.gates));
    setOut('labor', p.labor == null ? '—' : money(p.labor));
    setOut('labor-label', `Labor, ${fmtTrim(r.fenced)} LF`);
    setOut('total', p.total == null ? '—' : money(p.total));
    setOut('per-foot', p.perFoot == null ? '—' : `${money(p.perFoot)} per foot of run`);
    setOut(
      'price-hint',
      p.total == null
        ? 'Enter your own prices to turn the takeoff into a price. They are saved in this browser for next time.'
        : p.complete
          ? 'Priced with your saved prices.'
          : 'Some items have no price yet, so the total is partial.'
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
          ? 'Link copied. Anyone who opens it sees this run.'
          : 'Copy the address bar to share this result.'
      );
      trackTool(TOOL, 'copy_link');
    } else if (action === 'reset') {
      writeInputs(DEFAULT_INPUT);
      const next = render();
      syncUrl(toParams(next.input));
      setNote('Back to the example run.');
    }
  });

  render();
  root.dataset.ready = 'true';
}
