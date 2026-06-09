#!/usr/bin/env node
// Marketing capture runner.
//   node marketing-capture/run.mjs <scene>     run a scene
//   node marketing-capture/run.mjs --list      list available scenes
//
// A scene is a file in ./scenes/ that exports:
//   export const meta = { name, video?, viewport? }
//   export default async function scene(ctx) { ... }
// where ctx = { page, shot, log, meta, ...uiHelpers }.
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

import {
  BASE_URL,
  VIEWPORTS,
  DEFAULT_VIEWPORT,
  DEVICE_SCALE_FACTOR,
  HEADLESS,
  OUTPUT_DIR,
} from './config.mjs';
import { authenticate } from './lib/auth.mjs';
import { makeHelpers } from './lib/ui.mjs';
import { makeShot, finalizeVideo, ensureOut } from './lib/capture.mjs';
import { CURSOR_INIT, FREEZE_MOTION } from './lib/cursor.mjs';

const SCENES_DIR = fileURLToPath(new URL('./scenes/', import.meta.url));

async function loadScenes() {
  const files = (await readdir(SCENES_DIR)).filter((f) => f.endsWith('.mjs'));
  const scenes = [];
  for (const file of files) {
    const mod = await import(join(SCENES_DIR, file));
    const meta = mod.meta ?? {};
    const keys = [meta.name, file.replace(/\.mjs$/, ''), file.split('.')[0]].filter(Boolean);
    scenes.push({ file, meta, keys, run: mod.default });
  }
  return scenes;
}

async function main() {
  const arg = process.argv[2];
  const scenes = await loadScenes();

  if (!arg || arg === '--list' || arg === '-l') {
    console.log('Available scenes:');
    for (const s of scenes) {
      console.log(
        `  ${(s.meta.name ?? s.file).padEnd(20)} ${s.meta.video ? '🎬 video' : '📸 shots'}  (${s.file})`
      );
    }
    console.log('\nUsage: node marketing-capture/run.mjs <scene>');
    return;
  }

  const scene = scenes.find((s) => s.keys.includes(arg));
  if (!scene || typeof scene.run !== 'function') {
    console.error(`Scene "${arg}" not found. Run with --list to see options.`);
    process.exit(1);
  }

  const meta = scene.meta;
  const viewport = VIEWPORTS[meta.viewport] ?? VIEWPORTS[DEFAULT_VIEWPORT];
  const isVideo = !!meta.video;
  await ensureOut();

  console.log(`\n▶ scene "${meta.name ?? scene.file}" (${isVideo ? 'video' : 'shots'}) @ ${viewport.width}x${viewport.height}`);

  const browser = await chromium.launch({ headless: HEADLESS });

  // Warm-up pass (video only): the dev server compiles routes on first visit
  // (Vite), which would stall the recording. Hit them once in a throwaway,
  // non-recorded context so Vite caches them and the recorded run stays tight.
  if (isVideo && Array.isArray(meta.warmup) && meta.warmup.length) {
    const warm = await browser.newContext({ viewport });
    try {
      await authenticate(warm, { log: () => {} });
      const wp = await warm.newPage();
      for (const route of meta.warmup) {
        await wp.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
        await wp.waitForTimeout(1200);
      }
      console.log(`  ✓ warmed ${meta.warmup.length} routes`);
    } catch (err) {
      console.log(`  ! warm-up skipped: ${err.message}`);
    }
    await warm.close();
  }

  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
    ...(isVideo
      ? { recordVideo: { dir: join(OUTPUT_DIR, '.video-raw'), size: viewport } }
      : {}),
  });

  // Inject the on-screen cursor for videos, or freeze motion for crisp stills.
  await context.addInitScript(isVideo ? CURSOR_INIT : FREEZE_MOTION);

  try {
    await authenticate(context);
  } catch (err) {
    await context.close();
    await browser.close();
    console.error(`\n✗ ${err.message}`);
    process.exit(1);
  }

  const page = await context.newPage();
  const helpers = makeHelpers(page, { video: isVideo });
  const shot = makeShot(page, meta.name ?? 'scene');
  const video = isVideo ? page.video() : null;

  let failed = null;
  try {
    await scene.run({ ...helpers, page, shot, meta, log: helpers.log });
  } catch (err) {
    failed = err;
    console.error(`  ✗ scene error: ${err.message}`);
  }

  await context.close();
  if (video) await finalizeVideo(await video.path().catch(() => null), meta.name ?? 'scene');
  await browser.close();

  console.log(failed ? `\n✗ scene finished with errors` : `\n✓ done → ${OUTPUT_DIR}`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
