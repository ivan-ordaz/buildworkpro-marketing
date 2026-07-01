// Demo video: send a bid, then convert an accepted bid into a project.
// Reveals the Send Bid dialog (email template, recipients, auto-attached PDF)
// and the Convert-to-Project strategy cards (Map to Phases / Map to Tasks /
// Use Template). Non-destructive: dialogs are opened and dismissed — nothing is
// actually emailed or converted.
//
// Data prerequisites (seeded Comfort Climate HVAC demo tenant):
//   - DRAFT_BID: a draft bid with a customer.
//   - ACCEPTED_BID: an accepted bid whose project_id is NULL (not yet
//     converted), so the "Convert to Project" action renders.
//   - A default bid email template exists, so the Send dialog shows the
//     compose form rather than the empty-state prompt.
const DRAFT_BID = process.env.CAPTURE_DRAFT_BID_ID || '89906';
const ACCEPTED_BID = process.env.CAPTURE_ACCEPTED_BID_ID || '89921';

export const meta = {
  name: 'bid-send-convert',
  video: true,
  viewport: 'desktop',
  warmup: ['/bids', `/bids/${DRAFT_BID}`, `/bids/${ACCEPTED_BID}`],
};

export default async function scene({ goto, click, moveTo, wait, page }) {
  // --- Send a draft bid ---
  await goto(`/bids/${DRAFT_BID}`, 1500);
  await page
    .locator('main button:has-text("Send Bid")')
    .first()
    .waitFor({ timeout: 10000 })
    .catch(() => {});
  await wait(700);
  await moveTo('text=/Bid Details/i').catch(() => {});
  await wait(600);
  await click('main button:has-text("Send Bid")').catch(() => {});
  await page
    .getByRole('dialog')
    .filter({ hasText: /Send Bid/i })
    .first()
    .waitFor({ timeout: 8000 })
    .catch(() => {});
  await wait(1200);
  await moveTo('text=/Subject/i').catch(() => {});
  await wait(800);
  await moveTo('text=/Message/i').catch(() => {});
  await wait(800);
  await moveTo('text=/\\.pdf/i').catch(() => {});
  await wait(1000);
  await page.keyboard.press('Escape').catch(() => {});
  await wait(1000);

  // --- Convert an accepted bid to a project ---
  await goto(`/bids/${ACCEPTED_BID}`, 2000);
  const convertBtn = page.locator('main button:has-text("Convert to Project")').first();
  await convertBtn.waitFor({ timeout: 12000 }).catch(() => {});
  await wait(700);
  await moveTo(convertBtn).catch(() => {});
  await wait(500);
  await convertBtn.click({ timeout: 4000 }).catch(() => {});
  await page
    .getByRole('dialog')
    .filter({ hasText: /Convert Bid to Project/i })
    .first()
    .waitFor({ timeout: 8000 })
    .catch(() => {});
  await wait(1100);
  await moveTo('text="Map to Phases"').catch(() => {});
  await wait(800);
  await moveTo('text="Map to Tasks"').catch(() => {});
  await wait(800);
  await moveTo('text="Use Template"').catch(() => {});
  await wait(1100);
  await page.keyboard.press('Escape').catch(() => {});
  await wait(600);
}
