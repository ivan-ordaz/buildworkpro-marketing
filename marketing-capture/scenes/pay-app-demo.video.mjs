// Demo video: pay applications — the AIA-style core. Show the schedule of
// values, the per-line "This Period / Materials Stored" billing dialog, and
// the Payment Application Summary that rolls in change orders and retainage.
export const meta = {
  name: 'pay-app-demo',
  video: true,
  viewport: 'desktop',
  warmup: ['/pay-apps', '/pay-apps/45'],
};

export default async function scene({ goto, click, moveTo, scrollTo, wait, page }) {
  await goto('/pay-apps/45', 1200);
  await wait(800);

  // Top stat row: Contract Sum to Date, Total Completed & Stored, Retainage,
  // Current Payment Due.
  await moveTo('text=/Current Payment Due/i');
  await wait(800);

  // The Payment Application Summary panel — the AIA G702-style rollup.
  await moveTo('text=/Payment Application Summary/i');
  await wait(700);
  await scrollTo(260);
  await wait(900);
  await moveTo('text=/Revised Contract Sum/i');
  await wait(700);
  await moveTo('text=/Retainage/i');
  await wait(800);
  await scrollTo(0);
  await wait(500);

  // Enter edit mode and open a schedule-of-values line to bill this period.
  await click('main button:has-text("Edit")');
  await wait(900);
  const pencil = page.locator('main table tbody tr').first().locator('button').first();
  await pencil.click({ timeout: 3000 }).catch(() => {});
  await wait(1100);

  // The Edit Line Item dialog: Scheduled Value, Previous Apps, This Period,
  // Materials Stored — progress billing against the SOV.
  await moveTo('text=/This Period/i');
  await wait(800);
  await moveTo('text=/Materials Stored/i');
  await wait(900);
  await page.keyboard.press('Escape').catch(() => {});
  await wait(700);
}
