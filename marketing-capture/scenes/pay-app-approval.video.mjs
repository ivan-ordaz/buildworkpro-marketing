// Demo video: approving a pay application. A manager has submitted this month's
// billing; the admin opens it, checks the schedule of
// values and the amount due, clicks Approve, and the workflow stepper moves to
// Approved with who approved it and when.
//
// Setup builds a fresh job and pay app (see lib/demo-pay-apps.mjs) and submits
// it as Mike Murphy, so every take approves a genuinely submitted pay app.
import { makeCuts } from '../lib/cuts.mjs';
import { stagePayApp, apiAs } from '../lib/demo-pay-apps.mjs';

const PROJECT = 'Biscayne Retail Plaza — Rooftop Replacement';

export const meta = {
  name: 'pay-app-approval',
  video: true,
  viewport: 'desktop',
  strict: true,
  warmup: ['/pay-apps'],
};

export async function setup({ api, log }) {
  const staged = await stagePayApp(api, {
    jobName: PROJECT,
    customer: 'Biscayne Retail Plaza Associates',
    siteAddress: '8800 Biscayne Blvd, Miami Shores, FL 33138',
    periodStart: '2026-09-01',
    periodEnd: '2026-09-30',
    lines: [
      { description: 'Mobilization & permits', scheduledValue: 1850, previous: 1850 },
      { description: 'Demo & disposal of existing units', scheduledValue: 2900, previous: 2900 },
      { description: 'Crane & rigging', scheduledValue: 4200, previous: 0, thisPeriod: 4200 },
      { description: 'Rooftop units (3) — furnish & set', scheduledValue: 38700, previous: 19350, thisPeriod: 19350 },
      { description: 'Curb adapters & roof openings', scheduledValue: 5640, previous: 2820, thisPeriod: 2820 },
      { description: 'Ductwork connections', scheduledValue: 7480, previous: 0, thisPeriod: 5236 },
      { description: 'Gas piping & electrical tie-in', scheduledValue: 4960, previous: 0, thisPeriod: 2480 },
      { description: 'Startup, testing & balancing', scheduledValue: 3250, previous: 0 },
    ],
  });
  // The project manager submits it; the admin approves it on camera.
  const manager = await apiAs('mmurphy');
  try {
    await manager.api.patch(`/api/pay-apps/${staged.payAppId}/submit`);
  } finally {
    await manager.dispose();
  }
  log(`  ✓ staged ${staged.payAppNumber} (#${staged.payAppId}), submitted by mmurphy`);
  return staged;
}

export default async function scene({ goto, click, moveTo, waitFor, wait, page, data, meta }) {
  const { cut, save } = makeCuts(meta.name, page);

  // Same framing as the pay-app-demo video: the collapsed sidebar (⌘B) gives
  // the schedule of values its full width.
  await page.addInitScript(() => {
    try {
      localStorage.setItem('nav-collapsed', 'true');
    } catch {}
  });

  // Open the staged pay app. (Not via the pay-apps list: approved certificates
  // from earlier takes can't be deleted and would show up there.)
  await cut(async () => {
    await goto(`/pay-apps/${data.payAppId}`, 300);
    await waitFor('main >> text=Schedule of Values');
  });
  await wait(1000);

  // Who submitted it, and what's being asked for.
  await moveTo(page.locator('main').getByText(/by Mike/).first());
  await wait(1000);
  await moveTo(page.locator('main').getByText('Current Payment Due', { exact: true }).first());
  await wait(900);

  // Review the schedule of values and the payment summary.
  await moveTo('main >> text=Schedule of Values');
  for (let i = 0; i < 7; i++) {
    await page.mouse.wheel(0, 60);
    await wait(45);
  }
  await wait(900);
  await moveTo(page.locator('main').getByText('Retainage (10.0%)', { exact: true }).first());
  await wait(1000);
  await page.mouse.move(900, 400, { steps: 12 });
  for (let i = 0; i < 7; i++) {
    await page.mouse.wheel(0, -60);
    await wait(45);
  }
  await wait(600);

  // Approve. The stepper moves to Approved, stamped with the approver.
  await click('main button:has-text("Approve")');
  await waitFor(page.locator('main').getByText(/by Rachel/).first());
  await wait(700);
  await moveTo(page.locator('main').getByText(/by Rachel/).first());
  await wait(2600);
  await save();
}
