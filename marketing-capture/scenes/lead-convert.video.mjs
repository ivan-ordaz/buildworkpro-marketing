// Demo video: where "Create Bid" and "Convert to Project" live on a lead — the
// actions (⋯) menu in the lead header. Non-destructive: opens the menu to
// reveal the items, then dismisses it.
const LEAD_ID = process.env.CAPTURE_LEAD_ID || '140310';

export const meta = {
  name: 'lead-convert',
  video: true,
  viewport: 'desktop',
  warmup: ['/leads', `/leads/${LEAD_ID}`],
};

export default async function scene({ goto, click, moveTo, wait, page }) {
  await goto(`/leads/${LEAD_ID}`, 1200);
  await wait(1000);
  await moveTo('text=/Lead Information/i').catch(() => {});
  await wait(700);
  // Open the actions (⋯) menu in the header. Prefer the last menu trigger,
  // which is the header overflow rather than an inline field menu.
  const triggers = page.locator('main button[aria-haspopup="menu"]');
  const n = await triggers.count().catch(() => 0);
  if (n > 0) {
    await triggers.nth(n - 1).click({ timeout: 3000 }).catch(() => {});
  }
  await wait(1100);
  await moveTo('[role="menuitem"]:has-text("Create Bid")').catch(() => {});
  await wait(1000);
  await moveTo('[role="menuitem"]:has-text("Convert to Project")').catch(() => {});
  await wait(1100);
  await page.keyboard.press('Escape').catch(() => {});
  await wait(600);
}
