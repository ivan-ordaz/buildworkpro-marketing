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

export function makeHelpers(page, { log = console.log, video = false } = {}) {
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
  const moveTo = async (target) => {
    const box = await timed(`box ${typeof target === 'string' ? target.slice(0, 30) : 'loc'}`, () =>
      boxOf(page, target)
    );
    if (!box) return null;
    const x = Math.round(box.x + box.width / 2);
    const y = Math.round(box.y + box.height / 2);
    await page.mouse.move(x, y, { steps: video ? 28 : 6 });
    await page.waitForTimeout(video ? 180 : 30);
    return { x, y };
  };

  const click = async (target) => {
    const p = await moveTo(target);
    if (!p) {
      log(`  ! click target not found: ${typeof target === 'string' ? target : '[locator]'}`);
      return false;
    }
    if (video) await page.evaluate(([x, y]) => window.__mktRipple?.(x, y), [p.x, p.y]);
    await page.mouse.down();
    await page.waitForTimeout(70);
    await page.mouse.up();
    await settle(450);
    return true;
  };

  const type = async (target, text, { delay = 55 } = {}) => {
    const ok = await click(target);
    if (!ok) return false;
    await page.keyboard.type(text, { delay: video ? delay : 0 });
    await page.waitForTimeout(200);
    return true;
  };

  const scrollTo = async (y, smooth = video) => {
    await page.evaluate(
      ([top, behavior]) => window.scrollTo({ top, behavior }),
      [y, smooth ? 'smooth' : 'auto']
    );
    await page.waitForTimeout(smooth ? 900 : 200);
  };

  const wait = (ms) => page.waitForTimeout(ms);

  return { page, settle, goto, moveTo, hover: moveTo, click, type, scrollTo, wait, log };
}
