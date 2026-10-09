#!/usr/bin/env node
// Publish a finished video take to the site.
//   node marketing-capture/publish.mjs <scene> [posterAt] [--from <seconds>]
//
// Copies output/<scene>.mp4 to public/videos/<scene>.mp4 and cuts the poster
// (public/videos/<scene>-poster.jpg) from it. `posterAt` is seconds from the
// start, or negative for seconds before the end; the default (-1.5) lands on
// the end state, which is the result of the action — the frame that should
// represent the demo before it plays. `--from` trims the head of the take (the
// white "Loading..." flash and skeletons before the first page paints) and
// re-encodes; the poster is cut from the trimmed file.
import { copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { OUTPUT_DIR } from './config.mjs';

const args = process.argv.slice(2);
const fromIdx = args.indexOf('--from');
const from = fromIdx === -1 ? 0 : Number(args.splice(fromIdx, 2)[1]);
const [scene, posterArg = '-1.5'] = args;
if (!scene) {
  console.error('Usage: node marketing-capture/publish.mjs <scene> [posterAt] [--from <seconds>]');
  process.exit(1);
}

const src = join(OUTPUT_DIR, `${scene}.mp4`);
if (!existsSync(src)) {
  console.error(`No take at ${src} — run the scene first.`);
  process.exit(1);
}

const videosDir = fileURLToPath(new URL('../public/videos/', import.meta.url));
const mp4 = join(videosDir, `${scene}.mp4`);
const poster = join(videosDir, `${scene}-poster.jpg`);
if (from > 0) {
  execFileSync('ffmpeg', [
    '-v', 'error', '-y', '-ss', String(from), '-i', src, '-an',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'medium',
    '-movflags', '+faststart', mp4,
  ]);
} else {
  await copyFile(src, mp4);
}

const at = Number(posterArg);
const seek = at < 0 ? ['-sseof', String(at)] : ['-ss', String(at)];
execFileSync('ffmpeg', ['-v', 'error', '-y', ...seek, '-i', mp4, '-frames:v', '1', '-q:v', '3', poster]);

console.log(`✓ ${mp4}${from > 0 ? ` (from ${from}s)` : ''}\n✓ ${poster} (frame at ${at}s)`);
