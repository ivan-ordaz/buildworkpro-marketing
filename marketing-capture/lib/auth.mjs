// Authenticate a Playwright browser context against the local main app.
// Uses the JSON API (not the login UI) so we never depend on the Turnstile
// widget rendering. The context's request shares its cookie jar with pages,
// so once this resolves, every page in the context is logged in + tenant-scoped.
import { BASE_URL, SEED_USER, SEED_TENANT_HINT, DUMMY_TURNSTILE } from '../config.mjs';
import { resolvePassword } from './creds.mjs';

// The app uses csrf-csrf double-submit protection: GET issues a cookie (kept in
// the context jar) and returns a token we must echo in the x-csrf-token header.
async function getCsrfToken(api) {
  const res = await api.get(`${BASE_URL}/api/auth/csrf-token?_=${Date.now()}`);
  if (!res.ok()) throw new Error(`csrf-token fetch failed (${res.status()})`);
  const json = await res.json();
  return (json.data ?? json).csrfToken;
}

export async function authenticate(context, { user = SEED_USER, log = console.log } = {}) {
  const password = resolvePassword();
  const api = context.request;

  let csrf = await getCsrfToken(api);
  const loginRes = await api.post(`${BASE_URL}/api/auth/login`, {
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
    data: { username: user, password, rememberMe: true, turnstileToken: DUMMY_TURNSTILE },
  });

  if (!loginRes.ok()) {
    const body = await loginRes.text();
    throw new Error(
      `Login failed (${loginRes.status()}) for "${user}". ` +
        `Is the app seeded with demo data? Try \`npm run db:seed\` in the main app. ` +
        `Response: ${body.slice(0, 240)}`
    );
  }

  const json = await loginRes.json().catch(() => ({}));
  const data = json.data ?? json;

  if (data.requiresTwoFactor) {
    throw new Error(`User "${user}" has 2FA enabled — disable it or pick a different seed user.`);
  }

  const memberships = data.tenantMemberships ?? [];
  let tenantId = data.currentTenantId ?? null;

  // Auto-select only happens for single-tenant non-admins. If we weren't
  // auto-selected (multi-tenant), pick the hinted tenant and select it.
  if (!tenantId && memberships.length > 0) {
    const match =
      memberships.find((m) =>
        (m.tenantName ?? '').toLowerCase().includes(SEED_TENANT_HINT.toLowerCase())
      ) ?? memberships[0];
    tenantId = match.tenantId;
    csrf = await getCsrfToken(api); // refresh after login regenerated the session
    const sel = await api.post(`${BASE_URL}/api/auth/select-tenant`, {
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
      data: { tenantId },
    });
    if (!sel.ok()) {
      throw new Error(`select-tenant failed (${sel.status()}): ${(await sel.text()).slice(0, 200)}`);
    }
  }

  const tenantName =
    memberships.find((m) => m.tenantId === tenantId)?.tenantName ?? `tenant ${tenantId}`;
  if (!tenantId) {
    throw new Error(
      `Logged in as "${user}" but no tenant was selected (memberships: ${memberships.length}).`
    );
  }
  log(`✓ authenticated as ${user} @ ${tenantName}`);
  return { tenantId, tenantName, memberships };
}
