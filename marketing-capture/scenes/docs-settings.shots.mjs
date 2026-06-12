// Settings docs screenshots (docs-rewrite-plan Batch 5).
// Captures every Settings tab embedded by the docs pages under
// src/content/docs/docs/settings/, writing retina PNGs straight into
// public/docs-screenshots/settings/<name>.png (the path the docs embed from).
//
// Read-only by design: navigation + opening UI-state-only views. Never clicks
// Save / Delete / Enable / Connect.
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const meta = { name: 'docs-settings', video: false, viewport: 'desktop' };

const OUT_DIR = fileURLToPath(new URL('../../public/docs-screenshots/settings/', import.meta.url));

export default async function scene({ page, goto, click, wait, log }) {
  await mkdir(OUT_DIR, { recursive: true });

  // Headless Chromium hard-codes Notification.permission to "denied" (even
  // with grantPermissions), which makes the Notifications tab render a red
  // "blocked" banner. Spoof the fresh-browser "default" state so the tab shows
  // its normal "Enable Desktop Notifications" prompt instead.
  await page.addInitScript(() => {
    if (window.Notification) {
      Object.defineProperty(window.Notification, 'permission', { get: () => 'default' });
    }
  });

  // Screenshot the page (or a specific locator, for crops / panels taller
  // than the viewport — PageBody scrolls internally, so fullPage is useless).
  const cap = async (name, target) => {
    await (target ?? page).screenshot({ path: `${OUT_DIR}${name}.png` });
    log(`  📸 docs-screenshots/settings/${name}.png`);
  };

  // Settings tabs are hash-routed (/settings#<tab>). Anchor each capture on a
  // tab-specific element so Vite's lazy compile and the tab's queries have
  // landed before the shot.
  const openTab = async (hash, anchor) => {
    await goto(`/settings#${hash}`);
    await page.locator(anchor).first().waitFor({ state: 'visible', timeout: 30_000 });
    await wait(700);
  };

  // shadcn Card root = div.rounded-xl.border; CardTitle renders an <h3>.
  const card = (title) => page.locator(`div.rounded-xl.border:has(h3:text-is("${title}"))`).first();

  // 1. Organization tab (organization.mdx)
  await openTab('organization', 'h3:text-is("Organization Details")');
  await cap('organization-settings');

  // 2. User Management card with role badges (team-roles.mdx) — element shot
  //    so the full roster is captured even when it overflows the viewport.
  const userMgmt = card('User Management');
  await userMgmt.scrollIntoViewIfNeeded();
  await wait(400);
  await cap('user-management', userMgmt);

  // 3. Workspace tab sub-tabs (workspace-defaults.mdx)
  await openTab('workspace', '[role="tab"]:has-text("Bid Defaults")');
  await cap('workspace-defaults');

  // 4. Notifications tab (notifications.mdx)
  await openTab('notifications', 'h3:text-is("In-App Notifications")');
  await cap('notifications-settings');

  // 5. Billing tab (billing.mdx) — heading depends on subscription state.
  await openTab('billing', 'h3:text-is("Current Plan"), h3:text-is("Subscribe to BuildWorkPro")');
  await cap('billing-settings');

  // 6. Integrations tab (integrations.mdx)
  await openTab('integrations', 'h3:text-is("Google Workspace")');
  await cap('integrations-settings');

  // 7. Google Workspace (connect-google.mdx) — open the card's detail view
  //    (pure UI state, no mutation). If this org isn't provisioned for Google,
  //    fall back to a crop of the grid card.
  const googleCard = card('Google Workspace');
  await click(googleCard.locator('button'));
  const backBtn = page.locator('button:has-text("Back to Integrations")').first();
  const detailOpen = await backBtn.isVisible().catch(() => false);
  const unavailable = await page
    .locator('text=not available for your organization')
    .first()
    .isVisible()
    .catch(() => false);
  if (detailOpen && !unavailable) {
    await wait(600);
    await cap('google-workspace');
    await click(backBtn);
  } else {
    if (detailOpen) await click(backBtn);
    await googleCard.scrollIntoViewIfNeeded();
    await cap('google-workspace', googleCard);
  }

  // 8. Data Management import + export cards (data-management.mdx) — the two
  //    cards stack taller than the viewport and PageBody clips overflow, so
  //    grow the viewport until the panel fits, shoot it, then restore.
  await openTab('data-management', 'h3:text-is("Import Data")');
  const panel = page.locator('[role="tabpanel"][data-state="active"]').first();
  const panelHeight = await panel.evaluate((el) => el.scrollHeight);
  await page.setViewportSize({ width: 1440, height: Math.min(panelHeight + 300, 2600) });
  await wait(600);
  await cap('data-management', panel);
  await page.setViewportSize({ width: 1440, height: 900 });
  await wait(400);

  // 9. Deleted Records manager (deleted-records.mdx)
  await openTab('deleted-records', 'text=Deleted Records');
  await cap('deleted-records');

  // 10. Security tab with the Two-Factor Authentication card in view
  //     (profile-and-security.mdx). Do NOT click Set Up 2FA — read-only.
  await openTab('security', 'h3:text-is("Two-Factor Authentication")');
  const twoFa = card('Two-Factor Authentication');
  await twoFa.scrollIntoViewIfNeeded();
  await wait(400);
  await cap('security-two-factor');
}
