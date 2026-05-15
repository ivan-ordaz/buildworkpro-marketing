import fs from "node:fs/promises";
import path from "node:path";
import { chromium, type BrowserContext, type Page } from "playwright";
import { DemoScript, type Action, type Scene } from "./types.js";
import { humanClick, humanType, injectCursorOverlay, highlightElement } from "./humanize.js";
import { loadEnv, resolveEnvVars } from "./env.js";

const VIEWPORT = {
  width: Number(process.env.DEMO_WIDTH || 1920),
  height: Number(process.env.DEMO_HEIGHT || 1080),
};

async function runAction(page: Page, action: Action) {
  switch (action.type) {
    case "navigate":
      await page.goto(resolveEnvVars(action.url), { waitUntil: "domcontentloaded" });
      break;
    case "login": {
      const email = process.env[action.emailEnv];
      const password = process.env[action.passwordEnv];
      if (!email || !password) {
        process.stderr.write("[capture] login env not set — skipping login " + JSON.stringify({ emailEnv: action.emailEnv, passwordEnv: action.passwordEnv }) + "\n");
        break;
      }
      await humanType(page, "#username, input[autocomplete='username'], input[name='username'], input[type='email']", email, 50);
      await humanType(page, "#password, input[type='password']", password, 50);
      await Promise.all([
        page.waitForURL((url) => !/\/login(\?|$)/.test(url.pathname + url.search), { timeout: 15_000 }).catch(() => null),
        humanClick(page, "[data-testid='login-submit'], button[type='submit']"),
      ]);
      if (/\/login(\?|$)/.test(new URL(page.url()).pathname + new URL(page.url()).search)) {
        throw new Error("login failed — still on /login. Verify BWP_DEMO_EMAIL / BWP_DEMO_PASSWORD against a seeded account (e.g. rmoreno).");
      }
      await page.waitForLoadState("domcontentloaded");
      break;
    }
    case "click":
      await humanClick(page, action.selector);
      break;
    case "hover": {
      const h = await page.waitForSelector(action.selector, { state: "visible" });
      const box = await h.boundingBox();
      if (box) {
        const { humanMove } = await import("./humanize.js");
        await humanMove(page, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
      }
      break;
    }
    case "type":
      await humanType(page, action.selector, action.text, action.delayMs);
      break;
    case "press":
      await page.keyboard.press(action.key);
      break;
    case "wait":
      await page.waitForTimeout(action.ms);
      break;
    case "waitFor":
      await page.waitForSelector(action.selector, { timeout: action.timeoutMs });
      break;
    case "highlight":
      await highlightElement(page, action.selector, action.durationMs);
      break;
  }
  if (action.pauseAfterMs) await page.waitForTimeout(action.pauseAfterMs);
}

async function captureScene(context: BrowserContext, scene: Scene, outDir: string): Promise<string> {
  // Each scene gets its own page so Playwright records one video file per scene.
  const page = await context.newPage();
  await injectCursorOverlay(page);
  await page.setViewportSize(VIEWPORT);

  const sceneStart = Date.now();
  try {
    for (const action of scene.actions) {
      await runAction(page, action);
    }
  } catch (err) {
    process.stderr.write("[capture] Scene failed: " + JSON.stringify({ id: scene.id }) + "\n");
    throw err;
  }
  // Hold the final frame so narration can catch up.
  const elapsed = Date.now() - sceneStart;
  if (elapsed < scene.minDurationMs) {
    await page.waitForTimeout(scene.minDurationMs - elapsed);
  }
  await page.close();

  const videoObj = page.video();
  if (!videoObj) throw new Error("Playwright video missing");
  const dest = path.join(outDir, `${scene.id}.webm`);
  await videoObj.saveAs(dest);
  return dest;
}

export async function captureScript(scriptPath: string): Promise<{ outDir: string; sceneVideos: string[] }> {
  loadEnv();
  const raw = JSON.parse(await fs.readFile(scriptPath, "utf8"));
  const script = DemoScript.parse(raw);

  const outDir = path.resolve("output", script.slug);
  await fs.mkdir(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    recordVideo: { dir: outDir, size: VIEWPORT },
  });

  const sceneVideos: string[] = [];
  try {
    for (const scene of script.scenes) {
      process.stdout.write("[capture] " + JSON.stringify({ id: scene.id, title: scene.title }) + "\n");
      sceneVideos.push(await captureScene(context, scene, outDir));
    }
  } finally {
    await context.close();
    await browser.close();
  }

  return { outDir, sceneVideos };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const scriptArg = process.argv[2];
  if (!scriptArg) {
    console.error("Usage: tsx src/capture.ts <script.json>");
    process.exit(1);
  }
  captureScript(scriptArg).then(({ outDir }) => {
    process.stdout.write("[capture] done " + JSON.stringify({ outDir }) + "\n");
  });
}
