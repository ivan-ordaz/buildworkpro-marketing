// Demo video: filing a daily site log, start to finish. Opens New Log Entry,
// picks the project, sets crew count, title, tags and notes, saves (the app
// opens the new log), marks it reviewed, and ends on the timeline with the new
// entry on top.
//
// Setup polishes the tenant's seeded logs into coherent entries (see
// lib/demo-data.mjs) and soft-deletes the log a previous run of this scene
// created, so every take starts from the same list.
import { polishSiteLogs } from '../lib/demo-data.mjs';
import { makeCuts } from '../lib/cuts.mjs';

const TITLE = 'Duct rough-in — level 3';
const PROJECT = 'Grand Self-Storage';
const NOTES =
  'Hung 140 ft of supply trunk on level 3. Inspector signed off on the fire-rated penetrations at 2 PM. Ready for the leakage test Friday.';

export const meta = {
  name: 'site-log-create',
  video: true,
  viewport: 'desktop',
  strict: true,
  warmup: ['/site-logs'],
};

export async function setup({ api, log }) {
  const n = await polishSiteLogs(api, { skipTitles: [TITLE] });
  log(`  ✓ polished ${n} seeded site logs`);
}

export default async function scene(ctx) {
  const { goto, click, type, choose, moveTo, waitFor, wait, page, meta } = ctx;
  const { cut, clickThrough, save } = makeCuts(meta.name, page);

  await cut(async () => {
    await goto('/site-logs', 300);
    await waitFor('main >> text=Punch list complete');
  });
  await wait(1100);

  await click('main button:has-text("New Log Entry")');
  await waitFor('[role="dialog"] >> text=New Site Log Entry');
  await wait(500);

  await choose('#sitelog-project', PROJECT);
  await wait(400);
  await type('#sitelog-personnel', '5');
  await wait(300);
  await type('#sitelog-title', TITLE, { delay: 45 });
  await wait(300);
  await click('[role="dialog"] button:has-text("Progress")');
  await click('[role="dialog"] button:has-text("Inspection")');
  await wait(300);
  await type('#sitelog-notes', NOTES, { delay: 18 });
  await wait(700);

  // Saving opens the new log: the full record the office sees.
  await clickThrough(ctx, '[role="dialog"] button:has-text("Create Log Entry")', () =>
    waitFor(`main >> text=${NOTES.slice(0, 30)}`)
  );
  await wait(1200);

  // The office reviews it.
  await click('main button:has-text("Mark Reviewed")');
  await waitFor('main >> text=/^Reviewed/');
  await wait(1200);

  // Back on the timeline, the new entry sits on top, reviewed.
  await clickThrough(ctx, 'nav[aria-label="Breadcrumb"] a:has-text("Site Logs")', async () => {
    await waitFor('main h1:text-is("Site Logs")');
    await waitFor(`main >> text=${TITLE}`);
  });
  await wait(500);
  await moveTo(`main >> text=${TITLE}`);
  await wait(2200);
  await save();
}
