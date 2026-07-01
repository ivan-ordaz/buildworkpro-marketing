// Demo video: creating a daily site log — the New Log Entry dialog (project,
// date, personnel, tags, notes). Non-destructive: fills the form and ends on
// it without saving.
export const meta = {
  name: 'site-log-create',
  video: true,
  viewport: 'desktop',
  warmup: ['/site-logs'],
};

export default async function scene({ goto, click, moveTo, type, wait }) {
  await goto('/site-logs', 1200);
  await wait(900);
  // Open the create dialog — label varies ("New Log Entry" / "New Log" / "Add").
  let opened = await click('main button:has-text("New Log")')
    .then(() => true)
    .catch(() => false);
  if (!opened) {
    opened = await click('main button:has-text("Log Entry")')
      .then(() => true)
      .catch(() => false);
  }
  if (!opened) await click('main button:has-text("Add")').catch(() => {});
  await wait(1300);
  await moveTo('text=/Project/i').catch(() => {});
  await wait(700);
  await moveTo('text=/Personnel/i').catch(() => {});
  await wait(700);
  // The tag chips (Progress / Issue / Delay / Safety / Delivery / Inspection).
  await moveTo('text=/Progress/i').catch(() => {});
  await wait(700);
  await type('textarea', 'Poured footings on the east elevation; framing inspection passed at 2pm.').catch(
    () => {}
  );
  await wait(1000);
  await moveTo('button:has-text("Create Log Entry")').catch(() => {});
  await wait(1000);
}
