// Demo video: billing a period on a pay application, start to finish. Opens a
// draft pay app, enters this period's progress straight into the
// schedule of values grid (bill a line to 100%, a dollar amount, a percent, and
// materials stored on site), saves, and lands on the payment summary — retainage
// and Current Payment Due recalculated.
//
// Setup builds a fresh job with a real HVAC schedule of values (see
// lib/demo-pay-apps.mjs), so every take starts from the same draft.
import { makeCuts } from '../lib/cuts.mjs';
import { stagePayApp } from '../lib/demo-pay-apps.mjs';

const PROJECT = 'Bayside Medical Office — HVAC Install';

export const meta = {
  name: 'pay-app-demo',
  video: true,
  viewport: 'desktop',
  strict: true,
  warmup: ['/pay-apps'],
};

export async function setup({ api, log }) {
  const staged = await stagePayApp(api, {
    jobName: PROJECT,
    customer: 'Bayside Medical Office Properties',
    siteAddress: '2150 Bayshore Dr, Miami, FL 33137',
    periodStart: '2026-09-01',
    periodEnd: '2026-09-30',
    lines: [
      { description: 'Mobilization & submittals', scheduledValue: 2500, previous: 2500 },
      { description: 'Rooftop units & condensers', scheduledValue: 21850, previous: 10925 },
      { description: 'Ductwork fabrication & installation', scheduledValue: 14275, previous: 4282.5 },
      { description: 'Refrigerant piping & insulation', scheduledValue: 6420, previous: 0 },
      { description: 'Controls, thermostats & zoning', scheduledValue: 5890, previous: 0 },
      { description: 'Electrical connections', scheduledValue: 2950, previous: 0 },
      { description: 'Startup, testing & balancing', scheduledValue: 3165, previous: 0 },
      { description: 'Closeout & O&M manuals', scheduledValue: 1400, previous: 0 },
    ],
  });
  log(`  ✓ staged ${staged.payAppNumber} (#${staged.payAppId}) on project #${staged.projectId}`);
  return staged;
}

export default async function scene({ goto, click, moveTo, waitFor, wait, page, data, meta }) {
  const { cut, save } = makeCuts(meta.name, page);

  // The SOV grid is wide; give it the room the collapsed sidebar (⌘B) leaves.
  await page.addInitScript(() => {
    try {
      localStorage.setItem('nav-collapsed', 'true');
    } catch {}
  });

  // Overwrite a grid cell the way a user does: click, select all, type.
  const enter = async (label, value) => {
    await click(`[aria-label="${label}"]`);
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type(value, { delay: 110 });
    await wait(450);
  };

  // Start on the list — the staged draft is the newest pay app.
  // Open the staged pay app. (Not via the pay-apps list: approved certificates
  // from earlier takes can't be deleted and would show up there.)
  await cut(async () => {
    await goto(`/pay-apps/${data.payAppId}`, 300);
    await waitFor('main >> text=Schedule of Values');
  });
  await wait(1100);

  // Bring the schedule of values and the payment summary into view together.
  await moveTo('main >> text=Schedule of Values');
  for (let i = 0; i < 7; i++) {
    await page.mouse.wheel(0, 60);
    await wait(45);
  }
  await wait(700);

  // This period's progress, straight into the grid.
  await enter('Percent complete for 2', '100'); // equipment set: bill the rest
  await enter('This period for 3', '5710'); // ductwork, by dollar amount
  await enter('Percent complete for 4', '50'); // piping, by percent
  await enter('Materials stored for 5', '1850'); // thermostats stored on site
  await wait(500);

  await click('main button:has-text("Save 4 changes")');
  await waitFor('main button:has-text("Saved")');
  await wait(900);

  // The summary recalculates as the lines save. Then back up to the headline
  // numbers: total completed & stored, retainage held, and Current Payment Due.
  await moveTo(page.locator('main').getByText('Total Completed & Stored', { exact: true }).nth(1));
  await wait(1400);
  await page.mouse.move(900, 400, { steps: 12 });
  for (let i = 0; i < 8; i++) {
    await page.mouse.wheel(0, -60);
    await wait(45);
  }
  await wait(700);
  await moveTo(page.locator('main').getByText('Current Payment Due', { exact: true }).first());
  await wait(2600);
  await save();
}
