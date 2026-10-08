// Browser-side helpers shared by the calculator controllers: the contractor's
// own unit prices (remembered per calculator), shareable result links (inputs
// in the query string), clipboard and analytics. Everything degrades quietly
// when storage or the clipboard is unavailable.

export const PRICES_KEY = 'bwp.tools.prices.v1';

type PriceBook = Record<string, Record<string, number>>;

function readBook(): PriceBook {
  try {
    const raw = localStorage.getItem(PRICES_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === 'object' ? (parsed as PriceBook) : {};
  } catch {
    return {};
  }
}

export function loadPrices(tool: string): Record<string, number> {
  const entry = readBook()[tool];
  if (!entry || typeof entry !== 'object') return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(entry)) {
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[k] = v;
  }
  return out;
}

export function savePrices(tool: string, prices: Record<string, number | null>): void {
  try {
    const book = readBook();
    const clean: Record<string, number> = {};
    for (const [k, v] of Object.entries(prices)) {
      if (v != null && Number.isFinite(v) && v >= 0) clean[k] = v;
    }
    book[tool] = clean;
    localStorage.setItem(PRICES_KEY, JSON.stringify(book));
  } catch {
    // Storage blocked (private mode): prices just won't be remembered.
  }
}

/** Query-string values for the given keys, ignoring anything else in the URL. */
export function readParams(keys: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const params = new URLSearchParams(window.location.search);
    for (const k of keys) {
      const v = params.get(k);
      if (v != null) out[k] = v.slice(0, 40);
    }
  } catch {
    // Malformed URL: fall back to defaults.
  }
  return out;
}

export function resultUrl(values: Record<string, string>): string {
  const url = new URL(window.location.href);
  url.search = new URLSearchParams(values).toString();
  url.hash = '';
  return url.toString();
}

/** Keep the address bar in step with the inputs so a reload or a copied URL reproduces the result. */
export function syncUrl(values: Record<string, string>): void {
  try {
    const next = resultUrl(values);
    if (next !== window.location.href) window.history.replaceState(null, '', next);
  } catch {
    // Sandboxed frames can refuse replaceState; the tool still works.
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function downloadText(filename: string, text: string, type = 'text/csv'): void {
  const blob = new Blob([text], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type TrackFn = (
  meta: { name: string; params?: Record<string, unknown> },
  ga: { name: string; params?: Record<string, unknown> }
) => void;

/** Same event shape as the pay app builder: one `tool_use` event, the action as a param. */
export function trackTool(tool: string, action: string, extra: Record<string, unknown> = {}): void {
  const w = window as unknown as { bwpTrack?: TrackFn };
  const params = { tool, action, ...extra };
  w.bwpTrack?.({ name: 'ToolUse', params }, { name: 'tool_use', params });
}
