// Demo video: the pay-application approval workflow — the status stepper and
// the Approve / Reject actions on a submitted pay app, plus the rollup an
// approver reviews. Non-destructive: hovers the controls without changing state.
const PAYAPP_ID = process.env.CAPTURE_SUBMITTED_PAYAPP_ID || '47362';

export const meta = {
  name: 'pay-app-approval',
  video: true,
  viewport: 'desktop',
  warmup: ['/pay-apps', `/pay-apps/${PAYAPP_ID}`],
};

export default async function scene({ goto, moveTo, scrollTo, wait }) {
  await goto(`/pay-apps/${PAYAPP_ID}`, 1200);
  await wait(1000);
  // Status stepper: Draft → Submitted → Approved → Paid.
  await moveTo('text=/Submitted/i').catch(() => {});
  await wait(800);
  // Header approval actions.
  await moveTo('main button:has-text("Approve")').catch(() => {});
  await wait(800);
  await moveTo('main button:has-text("Reject")').catch(() => {});
  await wait(800);
  // The rollup the approver reviews before deciding.
  await moveTo('text=/Current Payment Due/i').catch(() => {});
  await wait(800);
  await scrollTo(280);
  await wait(900);
  await moveTo('text=/Payment Application Summary/i').catch(() => {});
  await wait(900);
  await moveTo('text=/Retainage/i').catch(() => {});
  await wait(800);
  await scrollTo(0);
  await wait(600);
}
