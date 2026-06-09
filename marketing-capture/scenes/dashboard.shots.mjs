// Screenshot proof scene: capture the core list/overview screens at retina.
export const meta = { name: 'dashboard-shots', video: false, viewport: 'desktop' };

export default async function scene({ goto, shot }) {
  await goto('/dashboard');
  await shot('dashboard');

  await goto('/bids');
  await shot('bids-list');

  await goto('/projects');
  await shot('projects-list');

  await goto('/contacts');
  await shot('contacts-list');

  await goto('/pay-apps');
  await shot('pay-apps-list');
}
