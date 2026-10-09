// Jump cuts for video scenes. The dev server is slow: a cold page shows white
// then skeletons for a second or two, and every detail page skeletons again
// after a click. Real users on production don't wait that long, and a looping
// demo shouldn't either. A scene wraps those waits in `cut()` (or navigates
// with `clickThrough()`), and `applyCuts()` removes them after the take —
// run.mjs calls it automatically.
//
// Two ways to mark a cut:
//  - Frame-exact (pass `page` to makeCuts — prefer this). While a cut is open
//    the page shows a 16px pure-green square in its top-left corner, over the
//    sidebar logo, and applyCuts drops every frame where ffmpeg sees it.
//  - By time (no `page`). Spans are measured on the scene clock. Playwright's
//    recording starts a variable few hundred ms after that clock, so the end
//    of a span lands early and a skeleton frame or two can survive.
// A cut that opens the take is always recorded by time as well: before the
// first document loads there is no page to draw the marker on. Video lags the
// scene clock, so that span over-cuts slightly rather than leaving white.
import { readFile, rename, writeFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { OUTPUT_DIR } from '../config.mjs';

const MARKER_ID = '__mktCutMarker';

// Show or hide the marker. Self-contained so it works on any page without an
// init script; appended to <html> so it needs no <body> and survives the SPA
// re-rendering #root.
function toggleMarker([id, on]) {
  let el = document.getElementById(id);
  if (!on) return el?.remove();
  if (el) return;
  el = document.createElement('div');
  el.id = id;
  el.style.cssText =
    'position:fixed;left:0;top:0;width:16px;height:16px;background:#00ff00;' +
    'z-index:2147483647;pointer-events:none';
  document.documentElement.appendChild(el);
}

// Init script: every new document starts with the marker up, so the first
// paint of a page loaded inside a cut is already marked.
const MARKER_ON_LOAD = `(${toggleMarker.toString()})(['${MARKER_ID}', true]);`;

const setMarker = (page, on) => page.evaluate(toggleMarker, [MARKER_ID, on]).catch(() => {});

/**
 * Resolve once `main` has finished painting: no skeleton (`animate-pulse`), no
 * "Loading…" title, and every image (map tiles, logos) decoded — then a short
 * quiet beat so late layout shifts land inside the cut too.
 */
export async function contentReady(page, { timeout = 8000, quietMs = 300 } = {}) {
  await page
    .waitForFunction(
      () => {
        const main = document.querySelector('main');
        if (!main) return false;
        if (main.querySelector('[class*="animate-pulse"]')) return false;
        if (/^\s*Loading/m.test(main.innerText)) return false;
        return [...main.querySelectorAll('img')].every((img) => img.complete);
      },
      null,
      { timeout, polling: 100 }
    )
    .catch(() => {});
  await page.waitForTimeout(quietMs);
}

/**
 * Create a scene's cutter. Pass the scene's `page` for frame-exact cuts, and
 * call this before the scene's first `goto`.
 */
export function makeCuts(name, page = null) {
  const t0 = Date.now();
  const now = () => (Date.now() - t0) / 1000;
  const spans = [];
  let usedMarker = false;
  const installed = page ? page.addInitScript(MARKER_ON_LOAD) : Promise.resolve();

  /** Run `fn` (a load wait) and drop every frame it spent on camera. */
  async function cut(fn, { keepTail = 0.05, via = page } = {}) {
    await installed;
    const start = now();
    if (via) {
      usedMarker = true;
      await setMarker(via, true);
    }
    const result = await fn();
    if (via) await setMarker(via, false);
    const end = now() - (via ? 0 : keepTail);
    if ((!via || start < 0.05) && end > start) {
      spans.push([via ? 0 : +start.toFixed(2), +end.toFixed(2)]);
    }
    return result;
  }

  return {
    cut,

    /**
     * Click something that navigates or loads. The cursor press stays on
     * camera; from the release until `ready` resolves and `main` has painted,
     * nothing does. Always frame-exact (it has the page from the scene ctx).
     */
    async clickThrough({ page: ctxPage, moveTo }, target, ready) {
      const p = await moveTo(target);
      if (!p) throw new Error(`clickThrough target not found: ${target}`);
      const via = page ?? ctxPage;
      // The ripple starts on camera; the marker goes up before the press,
      // because some controls (Radix tabs) switch on mouse-down and a route
      // change can paint its skeleton in the very next frame.
      await via.evaluate(([x, y]) => window.__mktRipple?.(x, y), [p.x, p.y]);
      await via.waitForTimeout(80);
      return cut(
        async () => {
          await via.mouse.down();
          await via.waitForTimeout(90);
          await via.mouse.up();
          if (ready) await ready();
          await contentReady(via);
        },
        { via }
      );
    },

    async save() {
      await writeFile(
        join(OUTPUT_DIR, `${name}.cuts.json`),
        JSON.stringify({ marker: usedMarker, spans })
      );
      return spans;
    },
  };
}

/** Times (s) of the frames whose top-left corner shows the cut marker. */
function markerFrames(video) {
  const out = execFileSync(
    'ffmpeg',
    ['-v', 'error', '-i', video, '-vf', 'crop=8:8:4:4,signalstats,metadata=print:file=-', '-f', 'null', '-'],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  );
  const frames = [];
  let t = null;
  let u = null;
  for (const line of out.split('\n')) {
    const pts = line.match(/pts_time:([\d.]+)/);
    if (pts) {
      t = parseFloat(pts[1]);
      u = null;
      continue;
    }
    const uavg = line.match(/signalstats\.UAVG=([\d.]+)/);
    if (uavg) u = parseFloat(uavg[1]);
    const vavg = line.match(/signalstats\.VAVG=([\d.]+)/);
    // Pure green is the only thing up there with both chroma planes this low;
    // the navy sidebar and the white page both sit near 128.
    if (vavg && t !== null && u !== null && u < 90 && parseFloat(vavg[1]) < 80) frames.push(t);
  }
  return frames;
}

/** Collapse frame times into [start, end) spans, one frame wide each. */
function toSpans(times, frame) {
  const spans = [];
  for (const t of times) {
    const last = spans.at(-1);
    if (last && t - last[1] < frame * 0.5) last[1] = +(t + frame).toFixed(3);
    else spans.push([t, +(t + frame).toFixed(3)]);
  }
  return spans;
}

function duration(file) {
  return parseFloat(
    execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], {
      encoding: 'utf8',
    })
  );
}

/**
 * Remove a scene's cuts from its recording. Keeps the raw take as
 * <name>.uncut.mp4 and writes the cut version to <name>.mp4. Idempotent: it
 * always cuts from the raw take, and the cuts file (written mid-recording)
 * tells a fresh .mp4 from one this function already cut.
 */
export async function applyCuts(name) {
  const video = join(OUTPUT_DIR, `${name}.mp4`);
  const uncut = join(OUTPUT_DIR, `${name}.uncut.mp4`);
  const cutsFile = join(OUTPUT_DIR, `${name}.cuts.json`);
  const saved = JSON.parse(await readFile(cutsFile, 'utf8'));

  const stale = !existsSync(uncut) || statSync(uncut).mtimeMs < statSync(cutsFile).mtimeMs;
  if (stale) await rename(video, uncut);

  // Older cuts files are a bare array of time spans.
  const spans = [...(Array.isArray(saved) ? saved : saved.spans)];
  if (saved.marker) {
    const fps = 25; // Playwright records at 25fps
    spans.push(...toSpans(markerFrames(uncut), 1 / fps));
  }
  if (!spans.length) {
    execFileSync('cp', [uncut, video]);
    console.log(`  no cuts for ${name}`);
    return;
  }

  const drop = spans.map(([a, b]) => `between(t,${a},${b - 0.001})`).join('+');
  execFileSync('ffmpeg', [
    '-y', '-v', 'error', '-i', uncut,
    '-vf', `select='not(${drop})',setpts=N/FRAME_RATE/TB`,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'medium',
    '-movflags', '+faststart',
    video,
  ]);
  console.log(`  ✂ ${name}: ${spans.length} cut(s), ${duration(uncut).toFixed(2)}s → ${duration(video).toFixed(2)}s`);
}
