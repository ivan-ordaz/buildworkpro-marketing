// DOM controller for /tools/box-fill-calculator/. Reads the box and its contents
// (seeded from the query string so a shared link reproduces the result), renders
// the required volume itemized by NEC 314.16(B) rule, the box volume, the verdict
// and the smallest standard box that works. There is nothing to price, so no
// estimate tray. Math lives in ./boxfill.
import {
  BOXES,
  boxCuIn,
  computeBoxFill,
  cuIn,
  DEFAULT_INPUT,
  EDITIONS,
  FAMILIES,
  fmtCount,
  fromParams,
  PARAM_KEYS,
  toParams,
  TOOL,
  type BoxFillInput,
  type BoxFillResult,
  type Verdict,
} from './boxfill';
import { copyText, readParams, resultUrl, syncUrl, trackTool } from './browser';

const STATUS: Record<Verdict, { text: string; cls: string }> = {
  pass: { text: 'Fits', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  fail: { text: 'Overfilled', cls: 'bg-red-50 text-red-700 border-red-200' },
  info: { text: 'No volume', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

export function mount(root: HTMLElement): void {
  const fields = Array.from(
    root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-in]')
  );
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

  function writeInputs(input: BoxFillInput): void {
    const params = toParams(input);
    for (const el of fields) {
      const key = el.dataset.in ?? '';
      if (el instanceof HTMLInputElement && el.type === 'checkbox')
        el.checked = params[key] === '1';
      else if (key in params) el.value = params[key];
    }
  }

  function readInputs(): BoxFillInput {
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

  writeInputs(fromParams(readParams(PARAM_KEYS)));

  function render(): { input: BoxFillInput; result: BoxFillResult } {
    const input = readInputs();
    const r = computeBoxFill(input);
    const other = input.box === 'other';

    // Fields that only apply to one box choice or one code edition.
    for (const el of root.querySelectorAll<HTMLElement>('[data-show-other]')) el.hidden = !other;
    for (const el of root.querySelectorAll<HTMLElement>('[data-show-edition]'))
      el.hidden = el.dataset.showEdition !== input.edition;

    setOut('required', cuIn(r.required));
    setOut(
      'required-note',
      `${fmtCount(r.allowances)} conductor allowances, ${EDITIONS[input.edition]}`
    );
    setOut('box', r.boxVolume > 0 ? boxCuIn(r.boxVolume) : '—');
    const listed = input.box === 'other' ? null : BOXES[input.box];
    const boxName = listed ? listed.label : 'Entered box volume';
    setOut(
      'box-note',
      input.rings > 0
        ? `${boxName}, ${boxCuIn(r.baseVolume)} + ${fmtCount(input.rings)} cu in of rings`
        : other && r.baseVolume <= 0
          ? 'Enter the volume stamped in the box'
          : boxName
    );

    const pill = root.querySelector<HTMLElement>('[data-verdict]');
    if (pill) {
      pill.textContent = STATUS[r.verdict].text;
      pill.className = `inline-flex rounded-full border px-2.5 py-0.5 text-sm font-semibold ${STATUS[r.verdict].cls}`;
      pill.dataset.verdict = r.verdict;
    }
    setOut(
      'verdict-note',
      r.verdict === 'info'
        ? 'Pick a box or enter its volume to check the fill.'
        : r.verdict === 'pass'
          ? `${cuIn(r.spare)} cu in to spare. Room for ${r.roomFor} more ${r.roomSize} AWG ${r.roomFor === 1 ? 'conductor' : 'conductors'}.`
          : `Over by ${cuIn(-r.spare)} cu in. Use a bigger box, add a ring with a marked volume, or take something out.`
    );

    const family = listed ? listed.family : null;
    setOut(
      'smallest-label',
      family
        ? `Smallest ${FAMILIES[family]} box that works`
        : 'Smallest standard metal box that works'
    );
    setOut('smallest', r.smallest ? BOXES[r.smallest].label : 'None listed');
    setOut(
      'smallest-note',
      r.smallest
        ? `${boxCuIn(BOXES[r.smallest].volume)} cu in${input.rings > 0 ? `, plus your ${fmtCount(input.rings)} cu in of rings` : ''}`
        : 'No standard box of this type is big enough. Use a larger type, a ring, or a box marked with a bigger volume.'
    );

    for (const item of r.items) {
      setOut(`v-${item.id}`, cuIn(item.volume));
      setOut(`d-${item.id}`, item.detail);
    }
    setOut('total', cuIn(r.required));
    return { input, result: r };
  }

  const recalc = () => {
    const { input } = render();
    syncUrl(toParams(input));
    trackOnce('calculate');
  };

  root.addEventListener('input', (ev) => {
    if ((ev.target as HTMLElement).matches('[data-in]')) recalc();
  });
  root.addEventListener('change', (ev) => {
    if ((ev.target as HTMLElement).matches('select[data-in], input[type="checkbox"][data-in]'))
      recalc();
  });

  root.addEventListener('click', async (ev) => {
    const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const { input } = render();
    if (action === 'copy-link') {
      const ok = await copyText(resultUrl(toParams(input)));
      setNote(
        ok
          ? 'Link copied. Anyone who opens it sees this box.'
          : 'Copy the address bar to share this result.'
      );
      trackTool(TOOL, 'copy_link');
    } else if (action === 'reset') {
      writeInputs(DEFAULT_INPUT);
      const next = render();
      syncUrl(toParams(next.input));
      setNote('Back to the example box.');
    }
  });

  render();
  root.dataset.ready = 'true';
}
