// Screenshot + video output helpers.
import { mkdir, copyFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { OUTPUT_DIR } from '../config.mjs';

const execFileAsync = promisify(execFile);

export async function ensureOut() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  return OUTPUT_DIR;
}

// Bind a screenshot function to a scene's name so files are namespaced.
export function makeShot(page, sceneName) {
  return async (name, { fullPage = false } = {}) => {
    await ensureOut();
    const file = join(OUTPUT_DIR, `${sceneName}__${name}.png`);
    // Hide the fake cursor for stills if present.
    await page.evaluate(() => window.__mktHide?.(true)).catch(() => {});
    await page.screenshot({ path: file, fullPage });
    await page.evaluate(() => window.__mktHide?.(false)).catch(() => {});
    console.log(`  📸 ${file}`);
    return file;
  };
}

// Transcode the raw Playwright .webm to a web-friendly .mp4 (H.264) if ffmpeg
// is available; always keep a copy of the .webm too.
export async function finalizeVideo(rawWebmPath, sceneName) {
  if (!rawWebmPath || !existsSync(rawWebmPath)) {
    console.log('  ! no video was recorded for this scene');
    return null;
  }
  await ensureOut();
  const webmOut = join(OUTPUT_DIR, `${sceneName}.webm`);
  await copyFile(rawWebmPath, webmOut);
  await rm(rawWebmPath).catch(() => {});

  const mp4Out = join(OUTPUT_DIR, `${sceneName}.mp4`);
  try {
    await execFileAsync('ffmpeg', [
      '-y',
      '-i',
      webmOut,
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-crf',
      '20',
      '-preset',
      'medium',
      '-movflags',
      '+faststart',
      mp4Out,
    ]);
    console.log(`  🎬 ${mp4Out}`);
    return mp4Out;
  } catch {
    console.log(`  🎬 ${webmOut} (ffmpeg not found — skipped mp4 transcode)`);
    return webmOut;
  }
}
