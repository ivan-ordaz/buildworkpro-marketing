// Scene-authoring helpers. Each scene receives an object built by makeHelpers()
// so plain-English directions map onto a few robust primitives.
import { BASE_URL } from '../config.mjs';

async function locator(page, target) {
  return typeof target === 'string' ? page.locator(target).first() : target.first();
}

async function boxOf(page, target, { timeout = 2500 } = {}) {
  try {
    const loc = await locator(page, target);
    // Bound the wait: locator.boundingBox() blocks for the default 30s timeout
    // when the selector matches nothing, so gate on a short waitFor first.
    await loc.waitFor({ state: 'visible', timeout });
    await loc.scrollIntoViewIfNeeded({ timeout: 1500 }).catch(() => {});
    return await loc.boundingBox();
  } catch {
    return null;
  }
}

const DEBUG = !!process.env.CAPTURE_DEBUG;
async function timed(label, fn) {
  if (!DEBUG) return fn();
  const t = Date.now();
  const r = await fn();
  console.log(`    ⏱ ${label}: ${Date.now() - t}ms`);
  return r;
}

export function makeHelpers(page, { log = console.log, video = false, strict = false } = {}) {
  const missing = (target) => {
    const label = typeof target === 'string' ? target : '[locator]';
    if (strict) throw new Error(`target not found: ${label}`);
    log(`  ! target not found: ${label}`);
  };

  // Wait for the page to be visually ready. We avoid waitForLoadState('load'/
  // 'networkidle') entirely: the app holds a Socket.IO connection open, so
  // 'load' can take ~8s to fire and 'networkidle' never settles. goto already
  // awaits domcontentloaded; here we just bound on fonts + a fixed beat.
  const settle = async (ms = 600) => {
    await Promise.race([
      page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {}),
      page.waitForTimeout(1200),
    ]);
    await page.waitForTimeout(ms);
  };

  const goto = async (path, ms = 800) => {
    const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
    await timed(`goto ${path}`, () =>
      page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {})
    );
    await timed(`settle ${path}`, () => settle(ms));
    log(`  → ${path}`);
  };

  // Smoothly move the fake cursor to an element (video scenes). No-op-ish for
  // shot scenes (still moves the real mouse, harmless).
  // `timeout` bounds how long the target may take to appear (slow dev-mode
  // detail pages need more than the 2.5s default).
  const moveTo = async (target, { timeout } = {}) => {
    const box = await timed(`box ${typeof target === 'string' ? target.slice(0, 30) : 'loc'}`, () =>
      boxOf(page, target, timeout ? { timeout } : undefined)
    );
    if (!box) {
      missing(target);
      return null;
    }
    const x = Math.round(box.x + box.width / 2);
    const y = Math.round(box.y + box.height / 2);
    await page.mouse.move(x, y, { steps: video ? 28 : 6 });
    await page.waitForTimeout(video ? 180 : 30);
    return { x, y };
  };

  const click = async (target, opts) => {
    const p = await moveTo(target, opts);
    if (!p) return false;
    if (video) await page.evaluate(([x, y]) => window.__mktRipple?.(x, y), [p.x, p.y]);
    await page.mouse.down();
    await page.waitForTimeout(70);
    await page.mouse.up();
    await settle(450);
    return true;
  };

  const type = async (target, text, { delay = 55, timeout } = {}) => {
    const ok = await click(target, { timeout });
    if (!ok) return false;
    await page.keyboard.type(text, { delay: video ? delay : 0 });
    await page.waitForTimeout(200);
    return true;
  };

  // The app scrolls an inner pane, not the window, so scroll the tallest
  // element that actually scrolls (falling back to the window).
  const scrollTo = async (y, smooth = video) => {
    await page.evaluate(
      ([top, behavior]) => {
        const pane = [...document.querySelectorAll('div, main')]
          .filter((el) => {
            const cs = getComputedStyle(el);
            return /(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1;
          })
          .sort((a, b) => b.clientHeight - a.clientHeight)[0];
        (pane ?? window).scrollTo({ top, behavior });
      },
      [y, smooth ? 'smooth' : 'auto']
    );
    await page.waitForTimeout(smooth ? 900 : 200);
  };

  const wait = (ms) => page.waitForTimeout(ms);

  // Block (off-camera time still records, so keep it short) until a target is
  // visible — e.g. a detail page past its skeletons, or a saved row appearing.
  const waitFor = async (target, timeout = 15000) => {
    try {
      await (await locator(page, target)).waitFor({ state: 'visible', timeout });
      return true;
    } catch {
      missing(target);
      return false;
    }
  };

  // Open a shadcn Select / combobox / cmdk picker and choose an option. When
  // `search` is given it is typed first to filter a searchable picker.
  const choose = async (trigger, option, { search } = {}) => {
    if (!(await click(trigger))) return false;
    await page.waitForTimeout(video ? 450 : 100);
    if (search) {
      await page.keyboard.type(search, { delay: video ? 60 : 0 });
      await page.waitForTimeout(video ? 500 : 150);
    }
    const target =
      typeof option === 'string' ? `[role="option"]:has-text(${JSON.stringify(option)})` : option;
    return click(target);
  };

  return {
    page,
    settle,
    goto,
    moveTo,
    hover: moveTo,
    click,
    type,
    choose,
    scrollTo,
    wait,
    waitFor,
    log,
  };
}
