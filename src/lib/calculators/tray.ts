// DOM controller for the estimate tray that sits under every calculator. It
// renders whatever is in localStorage, so lines added on the drywall page show
// up on the fence page too, and it re-renders when another tab changes them.
import {
  ESTIMATE_EVENT,
  ESTIMATE_KEY,
  emptyEstimate,
  estimateTotals,
  groups,
  lineAmount,
  loadEstimate,
  saveEstimate,
  toCsv,
  toText,
  unitLabel,
  unitPrice,
  withoutGroup,
} from './estimate';
import { fmtTrim, money } from './format';
import { copyText, downloadText, trackTool } from './browser';

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function mountTray(root: HTMLElement, tool: string): void {
  const list = root.querySelector<HTMLElement>('[data-tray-list]');
  const empty = root.querySelector<HTMLElement>('[data-tray-empty]');
  const body = root.querySelector<HTMLElement>('[data-tray-body]');
  const note = root.querySelector<HTMLElement>('[data-tray-note]');
  const clearBtn = root.querySelector<HTMLButtonElement>('[data-tray-action="clear"]');
  let armedClear: ReturnType<typeof setTimeout> | null = null;

  const set = (sel: string, text: string) => {
    for (const el of root.querySelectorAll<HTMLElement>(sel)) el.textContent = text;
  };

  function render(): void {
    const e = loadEstimate();
    const totals = estimateTotals(e);
    const count = e.lines.length;
    set('[data-tray-count]', count === 1 ? '1 line' : `${count} lines`);
    set('[data-tray-total]', money(totals.total));
    set(
      '[data-tray-unpriced]',
      totals.unpriced
        ? `${totals.unpriced} ${totals.unpriced === 1 ? 'line has' : 'lines have'} no price yet.`
        : ''
    );
    if (empty) empty.hidden = count > 0;
    if (body) body.hidden = count === 0;
    if (!list) return;
    list.innerHTML = groups(e)
      .map((g) => {
        const rows = g.lines
          .map((l) => {
            const amount = lineAmount(l);
            const qty = `${fmtTrim(l.qty)} ${unitLabel(l.qty, l.unit)}`;
            const detail = l.price == null ? `${qty} · no price` : `${qty} × ${unitPrice(l.price)}`;
            return `<li class="flex items-start justify-between gap-3 border-t border-slate-100 py-2">
              <div class="min-w-0">
                <p class="text-sm text-slate-800">${esc(l.desc)}</p>
                <p class="text-xs tabular-nums text-slate-500">${esc(detail)}</p>
              </div>
              <p class="shrink-0 text-sm font-medium tabular-nums text-slate-900">${amount == null ? '—' : esc(money(amount))}</p>
            </li>`;
          })
          .join('');
        return `<div class="rounded-xl border border-slate-200 bg-white p-4" data-tray-group>
          <div class="flex items-center justify-between gap-3">
            <p class="min-w-0 text-sm font-semibold text-slate-900">${esc(g.group)}</p>
            <button type="button" data-remove-group="${esc(g.group)}" class="shrink-0 rounded text-xs font-medium text-slate-500 underline hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-brand-500">Remove</button>
          </div>
          <ul class="mt-2">${rows}</ul>
        </div>`;
      })
      .join('');
  }

  root.addEventListener('click', async (ev) => {
    const target = ev.target as HTMLElement;
    const remove = target.closest<HTMLButtonElement>('[data-remove-group]');
    if (remove) {
      saveEstimate(withoutGroup(loadEstimate(), remove.dataset.removeGroup ?? ''));
      return;
    }
    const btn = target.closest<HTMLButtonElement>('[data-tray-action]');
    if (!btn) return;
    const action = btn.dataset.trayAction;
    const e = loadEstimate();
    if (action === 'copy') {
      const ok = await copyText(toText(e));
      if (note)
        note.textContent = ok ? 'Estimate copied as text.' : 'Your browser blocked copying.';
      trackTool(tool, 'estimate_copy');
    } else if (action === 'csv') {
      downloadText('estimate.csv', toCsv(e));
      trackTool(tool, 'estimate_csv');
    } else if (action === 'clear' && clearBtn) {
      if (armedClear) {
        clearTimeout(armedClear);
        armedClear = null;
        clearBtn.textContent = 'Clear';
        saveEstimate(emptyEstimate());
        if (note) note.textContent = 'Estimate cleared.';
        trackTool(tool, 'estimate_clear');
      } else {
        clearBtn.textContent = 'Click again to clear';
        armedClear = setTimeout(() => {
          clearBtn.textContent = 'Clear';
          armedClear = null;
        }, 4000);
      }
    } else if (action === 'signup') {
      trackTool(tool, 'signup_click', { lines: e.lines.length });
    }
  });

  window.addEventListener(ESTIMATE_EVENT, render);
  window.addEventListener('storage', (ev) => {
    if (ev.key === ESTIMATE_KEY) render();
  });
  render();
  root.dataset.ready = 'true';
}
