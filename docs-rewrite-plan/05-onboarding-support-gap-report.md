# Onboarding & Support Gap Report

**Issue:** `buildworkpro-marketing#30` — "Onboarding/support audit — inventory current state vs all shipped features."

**Purpose:** the gap report the other two sub-tickets of #1 build from. It inventories (A) the
in-app onboarding/first-run experience, (B) the marketing support surface, and (C) shipped
features, then (D) lists concrete add/update/delete actions to drive the onboarding refresh and
the support-page refresh (`buildworkpro-marketing#31`) and screenshots (`#196`).

The product-docs page-by-page audit already lives in this folder — see
[`01-page-audit.md`](./01-page-audit.md) (ratings per page) and
[`02-missing-topics.md`](./02-missing-topics.md) (topics documented nowhere). This report does
not duplicate them; it adds the onboarding + marketing-support layers and the consolidated action
list. Inventory captured 2026-06-09 against the live app.

---

## Part A — In-app onboarding (main app)

Source files (main app, `/Users/ivan/buildworkpro/`):

| Piece                | File                                                             | What it does                                                                                                                                                                                                                                     |
| -------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Onboarding wizard    | `client/src/pages/Onboarding.tsx`, `server/routes/onboarding.ts` | 3 steps: **(0)** company info (name, trade from 12 industries, size, phone, address) · **(1)** team invites (emails → `POST /api/team/invitations`, skippable) · **(2)** "You're all set" summary → `POST /api/onboarding/complete` → dashboard. |
| Welcome tour         | `client/src/components/layout/OnboardingTour.tsx`                | 6-step modal on first dashboard load: Welcome, Contacts, Sales Pipeline, Projects, Bids, Reports.                                                                                                                                                |
| Getting-Started card | `client/src/components/dashboard/GettingStartedCard.tsx`         | Permanent dashboard card, 4 entry points: Add Contacts, Create Leads, Generate Bids, Manage Projects.                                                                                                                                            |
| Restart tour         | `client/src/components/settings/WorkspaceSettings.tsx`           | Settings → General → "Restart Tour" → `POST /api/onboarding/reset`.                                                                                                                                                                              |

**Onboarding gaps (features with no onboarding touchpoint):**

1. **Tour covers 5 of ~20 modules.** No tour/checklist mention of Change Orders, Site Logs, Time
   Tracking, Pay Apps, Documents, Invoices, Products/Catalog, Settings/Integrations (QuickBooks,
   Google, CSV import), or global search (Cmd+K).
2. **No empty-state guidance.** Contacts/Leads/Projects/Bids list pages have no first-run tooltips
   or empty-state CTAs beyond the dashboard card.
3. **Binary, not a tracked checklist.** Onboarding is complete/incomplete; no "added 3 contacts,
   0 projects — continue here" progress.
4. **Getting-Started card isn't dismissible** and "Restart Tour" requires admin permission.
5. **Step 0 trade list (12 industries) and the dashboard card's 4 steps** are the only
   personalization; trade choice doesn't yet tailor later guidance.

> Onboarding changes live in the **main app** repo, not here — this report scopes them so a
> `buildworkpro` onboarding ticket can be opened. The marketing-side actions are in Part D.

---

## Part B — Marketing support surface (this repo)

| Surface                 | Path                                                    | State                                                                                   |
| ----------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Help Center landing     | `src/pages/support.astro`                               | 7 categories linking into the docs (see below).                                         |
| Product docs            | `src/content/docs/docs/**` (24 pages, 8 groups)         | Audited in `01-page-audit.md`: **3 accurate / 9 partial / 12 stale**, zero screenshots. |
| Developer docs          | `src/content/docs/api/**`                               | Current; the quality bar (per `03-style-guide.md`).                                     |
| Feature marketing pages | `src/pages/features/*` (9), `src/pages/solutions/*` (7) | Not part of #30's support scope; flag separately if stale.                              |

**`support.astro` is out of sync with the docs it links to:**

- Links 7 categories: Getting Started, Bids & Estimates, Project Management, Pay Applications,
  Change Orders, Account & Billing, Developer Docs.
- **Missing categories whose docs already exist:** **Field Operations** (`docs/field/site-logs`,
  `time-tracking`) and **CRM & Pipeline** (`docs/crm/contacts`, `pipeline`). Both are live doc
  groups in the sidebar but absent from the Help Center page.
- **"Line items & marks"** (line 22) uses the "marks" term flagged as questionable in
  `01-page-audit.md` — verify against the live UI label.
- Nothing for the modules with no docs yet (Products, Documents, Reports, Calendar, Notifications)
  — consistent with the doc gaps in `02-missing-topics.md`.

---

## Part C — Shipped-feature coverage matrix

Legend: ✅ covered · 🟡 partial/stale · ❌ none. "Onboarding" = any tour/card/wizard touchpoint;
"Docs" = a product-docs page; "Support" = a link from `support.astro`.

| Feature / module                                                         | Onboarding     | Docs                                      | Support link  |
| ------------------------------------------------------------------------ | -------------- | ----------------------------------------- | ------------- |
| Contacts                                                                 | ✅ tour + card | 🟡 stale (CSV)                            | ❌ not linked |
| Leads / Pipeline                                                         | ✅ tour + card | 🟡 stale                                  | ❌ not linked |
| Bids (+ sublines, distributed costs, templates)                          | ✅ tour + card | 🟡 partial; distributed/templates missing | ✅            |
| Projects (phases, tasks, gantt, templates)                               | ✅ tour + card | 🟡 partial                                | ✅            |
| Change Orders                                                            | ❌             | 🟡 partial                                | ✅            |
| Pay Apps                                                                 | ❌             | 🟡 partial                                | ✅            |
| Site Logs                                                                | ❌             | 🟡 stale (routing)                        | ❌ not linked |
| Time Tracking                                                            | ❌             | 🟡 stale (routing)                        | ❌ not linked |
| Products / Catalog (kits, categories)                                    | ❌             | ❌                                        | ❌            |
| Documents                                                                | ❌             | ❌                                        | ❌            |
| Reports                                                                  | ✅ tour        | ❌                                        | ❌            |
| Calendar                                                                 | ❌             | ❌                                        | ❌            |
| Notifications                                                            | ❌             | ❌                                        | ❌            |
| Activity history                                                         | ❌             | ❌                                        | ❌            |
| Global search (Cmd+K)                                                    | ❌             | ❌                                        | ❌            |
| Settings › Workspace (numbering, terms, tax, rates, pipeline, templates) | ❌             | ❌                                        | ❌            |
| Settings › Security (2FA, passkeys)                                      | ❌             | ❌                                        | ❌            |
| Settings › Org & Branding                                                | ❌             | 🟡 stale                                  | ✅            |
| Billing (Stripe)                                                         | ❌             | ✅                                        | ✅            |
| Google Workspace integration                                             | ❌             | ✅                                        | ✅ (via docs) |
| QuickBooks (QBO) integration                                             | ❌             | ❌                                        | ❌            |
| CSV import templates                                                     | ❌             | 🟡 wrong flow                             | ❌            |
| Deleted-records recovery                                                 | ❌             | ❌                                        | ❌            |
| REST API v1 + keys + webhooks                                            | n/a            | ✅                                        | ✅            |

---

## Part D — Consolidated actions (drives #31, #196, and a main-app onboarding ticket)

### D1 — Marketing support pages to CREATE (this repo, `#31`)

New product-docs pages for the modules with zero coverage (see `02-missing-topics.md` for the full
list): **Products/Catalog, Documents, Reports, Calendar, Notifications, Global search (Cmd+K),
Settings › Workspace, Settings › Security (2FA/passkeys), QuickBooks integration, CSV Import
Templates.** Add each to the Starlight sidebar (`astro.config.mjs`) and to `support.astro`.

### D2 — Marketing support pages to UPDATE (this repo, `#31`)

- Fix the **12 stale + 9 partial** doc pages per `01-page-audit.md` (biggest: field-ops routing,
  CRM contacts/CSV, settings/org + team-roles role names → "Company Admin", bid distributed costs).
- **`support.astro`:** add the **Field Operations** and **CRM & Pipeline** categories (docs already
  exist); re-label "Line items & marks"; add the new D1 pages as they land.
- Add screenshots to every page that describes a screen — that's **`#196`**, powered by the
  capture kit (`marketing-capture/`).

### D3 — Marketing support pages to DELETE / REDIRECT

- None found dead yet. The project-stages docs were already removed (`#199`). Re-audit after the
  D1/D2 rewrites for any pages superseded by new ones.

### D4 — In-app onboarding (open a `buildworkpro` ticket; out of this repo)

- Extend the tour/checklist to the uncovered modules (Change Orders, Site Logs, Time Tracking, Pay
  Apps, Documents, Products, Settings/Integrations, Cmd+K).
- Add empty-state CTAs on the list pages; make the Getting-Started card dismissible; consider a
  tracked checklist with completion state.

### Suggested sequence

1. **#31** rewrite/refresh the existing 24 docs (fix stale) + wire Field-Ops/CRM into `support.astro`.
2. **#31 (cont.)** add the D1 net-new pages.
3. **#196** capture screenshots for all pages via the kit.
4. Open the main-app onboarding ticket for D4.
