// Settings docs screenshots: every Settings section embedded by the pages under
// src/content/docs/docs/settings/, written as retina PNGs straight into
// public/docs-screenshots/settings/<name>.png (the path the docs embed from).
//
// Settings is a two-column page: a section nav on the left (My Account /
// Company / Sales & Documents / Data & Developer) and the section content on
// the right, routed by hash (/settings#<section>). Read-only apart from the
// setup step, which keeps a few soft-deleted contacts around so the Deleted
// Records manager has rows to show. Never clicks Save / Delete / Enable /
// Connect.
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { stageDeletedContacts } from '../lib/demo-docs.mjs';

export const meta = { name: 'docs-settings', video: false, viewport: 'desktop', strict: true };

const OUT_DIR = fileURLToPath(new URL('../../public/docs-screenshots/settings/', import.meta.url));
const VIEWPORT = { width: 1440, height: 900 };

export async function setup({ api }) {
  await stageDeletedContacts(api);
}

export default async function scene({ page, goto, wait, log }) {
  await mkdir(OUT_DIR, { recursive: true });

  // Headless Chromium hard-codes Notification.permission to "denied" (even
  // with grantPermissions), which makes the Notifications section render a red
  // "blocked" banner. Spoof the fresh-browser "default" state so it shows its
  // normal "Enable Desktop Notifications" prompt instead.
  await page.addInitScript(() => {
    if (window.Notification) {
      Object.defineProperty(window.Notification, 'permission', { get: () => 'default' });
    }
  });

  const cap = async (name, target, opts = {}) => {
    await (target ?? page).screenshot({ path: `${OUT_DIR}${name}.png`, ...opts });
    log(`  📸 docs-screenshots/settings/${name}.png`);
  };

  // Anchor each capture on a section-specific element so lazy compile and the
  // section's queries have landed before the shot.
  const openSection = async (hash, anchor) => {
    await goto(`/settings#${hash}`, 600);
    await page.locator(anchor).first().waitFor({ state: 'visible', timeout: 30_000 });
    await page
      .waitForFunction(() => !document.querySelector('main [class*="animate-pulse"]'), null, {
        timeout: 10_000,
      })
      .catch(() => {});
    await wait(700);
  };

  // shadcn Card root = div.rounded-xl.border; CardTitle renders an <h3>.
  const card = (title) =>
    page.locator(`div.rounded-xl.border:has(h3:text-is("${title}"))`).last();

  // 1. Company profile (organization.mdx)
  await openSection('organization', 'h3:text-is("Company Profile")');
  await cap('organization-settings');

  // 2. Members & roles — the User Management card with every role badge
  //    (team-roles.mdx). Element shot so the whole roster is captured.
  await openSection('members', 'h3:text-is("User Management")');
  await page.locator('text=Vanessa Baker').first().waitFor({ state: 'visible', timeout: 10_000 });
  await cap('user-management', card('User Management'));

  // 3. Document Setup — styling with the live preview (workspace-defaults.mdx,
  //    which now covers the Sales & Documents group).
  await openSection('document-setup', 'h3:text-is("Document Styling")');
  await cap('workspace-defaults');

  // 4. Notifications & Email (notifications.mdx)
  await openSection('notifications', 'h3:text-is("In-App Notifications")');
  await cap('notifications-settings');

  // 5. Billing (billing.mdx). The seeded demo org is on an admin-managed plan
  //    with no payment account, which adds a "managed by your administrator"
  //    line a paying customer never sees — hide that one line for the shot.
  await openSection('billing', 'h3:text-is("Current Plan")');
  await page.evaluate(() => {
    for (const p of document.querySelectorAll('main p')) {
      if (p.textContent?.includes('managed by your administrator')) p.style.display = 'none';
    }
  });
  await wait(300);
  await cap('billing-settings');

  // 6. Integrations grid (integrations.mdx)
  await openSection('integrations', 'h3:text-is("Google Workspace")');
  await cap('integrations-settings');

  // 7. Google Workspace detail view (connect-google.mdx) — hash-routed, pure
  //    UI state; the Connect with Google button is never clicked.
  await openSection('integrations.google', 'button:has-text("Back to Integrations")');
  await page.locator('text=Connect with Google').first().waitFor({ state: 'visible', timeout: 15_000 });
  // The footnote under the card names the email provider the platform sends
  // through — internal infrastructure that public docs must not show.
  await page.evaluate(() => {
    for (const p of document.querySelectorAll('main p')) {
      if (p.textContent?.includes('SendGrid')) p.style.display = 'none';
    }
  });
  await wait(400);
  await cap('google-workspace');

  // 8. Import & Export (data-management.mdx) — the Import Data and Export Data
  //    cards stack taller than the viewport and the page scrolls an inner pane,
  //    so grow the viewport until both fit and clip to the two cards.
  await openSection('data-management', 'h3:text-is("Import Data")');
  await page.setViewportSize({ width: VIEWPORT.width, height: 2200 });
  await wait(700);
  const importBox = await card('Import Data').boundingBox();
  const exportBox = await card('Export Data').boundingBox();
  if (!importBox || !exportBox) throw new Error('Import/Export cards not laid out');
  const pad = 24;
  const top = Math.max(0, importBox.y - pad);
  await cap('data-management', null, {
    clip: {
      x: Math.max(0, importBox.x - pad),
      y: top,
      width: importBox.width + pad * 2,
      height: exportBox.y + exportBox.height + pad - top,
    },
  });
  await page.setViewportSize(VIEWPORT);
  await wait(400);

  // 9. Deleted Records (deleted-records.mdx) — Contacts, with the staged rows.
  await openSection('deleted-records', 'text=Tri-County Duct Supply');
  await cap('deleted-records');

  // 10. Security & Sign-in with the Two-Factor Authentication card in view
  //     (profile-and-security.mdx). Set Up 2FA is never clicked.
  await openSection('security', 'h3:text-is("Two-Factor Authentication")');
  await cap('security-two-factor');
}
