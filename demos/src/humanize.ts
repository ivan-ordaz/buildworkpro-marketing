import type { Page } from "playwright";

const rand = (min: number, max: number) => min + Math.random() * (max - min);

function cubicBezier(p0: number, p1: number, p2: number, p3: number, t: number) {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

export async function humanMove(page: Page, to: { x: number; y: number }, opts: { steps?: number } = {}) {
  // Read current mouse position from a tracked global; default to viewport center on first move.
  const from = (await page.evaluate(() => (window as any).__demoMouse || { x: window.innerWidth / 2, y: window.innerHeight / 2 })) as { x: number; y: number };
  const steps = opts.steps ?? Math.max(20, Math.min(60, Math.hypot(to.x - from.x, to.y - from.y) / 12));
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  // Control points biased perpendicular to the path for a soft arc + slight overshoot
  const perpX = -dy;
  const perpY = dx;
  const len = Math.hypot(perpX, perpY) || 1;
  const arc = rand(0.08, 0.18) * Math.hypot(dx, dy);
  const cx1 = from.x + dx * 0.33 + (perpX / len) * arc * (Math.random() < 0.5 ? 1 : -1);
  const cy1 = from.y + dy * 0.33 + (perpY / len) * arc;
  const cx2 = from.x + dx * 0.66 + (perpX / len) * arc * 0.5;
  const cy2 = from.y + dy * 0.66 + (perpY / len) * arc * 0.5;

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    // Ease in/out using a smoother step so the cursor decelerates near the target
    const eased = t * t * (3 - 2 * t);
    const x = cubicBezier(from.x, cx1, cx2, to.x, eased) + rand(-0.4, 0.4);
    const y = cubicBezier(from.y, cy1, cy2, to.y, eased) + rand(-0.4, 0.4);
    await page.mouse.move(x, y);
    await page.waitForTimeout(rand(4, 10));
  }
  await page.evaluate((pos) => ((window as any).__demoMouse = pos), { x: to.x, y: to.y });
}

export async function humanClick(page: Page, selector: string) {
  const handle = await page.waitForSelector(selector, { state: "visible" });
  const box = await handle.boundingBox();
  if (!box) throw new Error(`No bounding box for ${selector}`);
  const target = {
    x: box.x + box.width / 2 + rand(-box.width * 0.15, box.width * 0.15),
    y: box.y + box.height / 2 + rand(-box.height * 0.15, box.height * 0.15),
  };
  await humanMove(page, target);
  await page.waitForTimeout(rand(60, 140));
  await page.mouse.down();
  await page.waitForTimeout(rand(40, 90));
  await page.mouse.up();
}

export async function humanType(page: Page, selector: string, text: string, baseDelayMs = 60) {
  await humanClick(page, selector);
  for (const ch of text) {
    // Occasional longer pause to mimic thinking
    const burst = Math.random() < 0.07 ? rand(200, 400) : rand(baseDelayMs * 0.6, baseDelayMs * 1.6);
    await page.keyboard.type(ch);
    await page.waitForTimeout(burst);
  }
}

export async function injectCursorOverlay(page: Page) {
  // Renders a soft dot wherever the synthetic mouse is. Helpful since headless recordings
  // don't show the OS cursor. Safe to call multiple times.
  await page.addInitScript(() => {
    const init = () => {
      if (document.getElementById("__demo-cursor")) return;
      const dot = document.createElement("div");
      dot.id = "__demo-cursor";
      Object.assign(dot.style, {
        position: "fixed",
        width: "22px",
        height: "22px",
        borderRadius: "50%",
        background: "rgba(255,255,255,0.95)",
        border: "2px solid rgba(20,20,20,0.6)",
        boxShadow: "0 2px 10px rgba(0,0,0,0.35)",
        pointerEvents: "none",
        zIndex: "2147483647",
        transform: "translate(-50%, -50%)",
        transition: "transform 30ms linear",
      });
      document.documentElement.appendChild(dot);
      window.addEventListener("mousemove", (e) => {
        dot.style.left = e.clientX + "px";
        dot.style.top = e.clientY + "px";
      });
    };
    if (document.body) init();
    else document.addEventListener("DOMContentLoaded", init);
  });
}

export async function highlightElement(page: Page, selector: string, durationMs: number) {
  await page.evaluate(
    ({ selector, durationMs }) => {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const halo = document.createElement("div");
      Object.assign(halo.style, {
        position: "fixed",
        left: r.left - 6 + "px",
        top: r.top - 6 + "px",
        width: r.width + 12 + "px",
        height: r.height + 12 + "px",
        border: "3px solid #f59e0b",
        borderRadius: "10px",
        boxShadow: "0 0 0 9999px rgba(0,0,0,0.18)",
        pointerEvents: "none",
        zIndex: "2147483646",
        transition: "opacity 250ms ease",
      });
      document.documentElement.appendChild(halo);
      setTimeout(() => (halo.style.opacity = "0"), durationMs - 250);
      setTimeout(() => halo.remove(), durationMs);
    },
    { selector, durationMs }
  );
  await page.waitForTimeout(durationMs);
}
