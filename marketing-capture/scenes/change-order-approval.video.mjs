// Demo video: change-order approval — the status stepper, the Approve / Reject
// actions, and the contract-value impact on a submitted change order.
// Non-destructive: hovers the controls without changing state.
const CO_ID = process.env.CAPTURE_SUBMITTED_CO_ID || '31947';

export const meta = {
  name: 'change-order-approval',
  video: true,
  viewport: 'desktop',
  warmup: ['/change-orders', `/change-orders/${CO_ID}`],
};

export default async function scene({ goto, moveTo, scrollTo, wait }) {
  await goto(`/change-orders/${CO_ID}`, 1200);
  await wait(1000);
  // Status stepper: Draft → Submitted → Approved.
  await moveTo('text=/Submitted/i').catch(() => {});
  await wait(800);
  // Header approval actions.
  await moveTo('main button:has-text("Approve")').catch(() => {});
  await wait(800);
  await moveTo('main button:has-text("Reject")').catch(() => {});
  await wait(800);
  // The contract-value impact reviewers weigh.
  await moveTo('text=/Contract/i').catch(() => {});
  await wait(800);
  await scrollTo(260);
  await wait(900);
  await moveTo('main table tbody tr').catch(() => {});
  await wait(800);
  await scrollTo(0);
  await wait(600);
}
