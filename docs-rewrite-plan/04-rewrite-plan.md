# Product Docs Rewrite Plan

Prioritized, batched plan to bring `src/content/docs/docs/*` to the quality bar of the
`/api/*` developer docs. Part of GitHub issue #21.

## Principles

- **Ship incrementally.** Each batch is a standalone PR that can merge and deploy on its own.
  Do not hold the whole rewrite for a big-bang launch (per issue #21 notes).
- **Most-trafficked first.** Getting Started and Bids before everything else; Field and CRM last.
- **Verify against the live app** before publishing any page (see `03-style-guide.md` checklist).
- **New pages are added in the same batch** as the related rewrites, and the
  `astro.config.mjs` sidebar uses `autogenerate` per directory — new files appear automatically,
  but set `sidebar.order` in frontmatter so ordering is deterministic.
- Each batch ends by running `npm run build` and confirming Cloudflare/Pagefind is unaffected.

## Effort key

- **Page** = a rewrite of an existing page or a brand-new page.
- **GIF** = needs at least one animated GIF (multi-step flow with motion value).
- **Shots** = needs screenshots only.

---

## Batch 1 — Getting Started (foundation, highest traffic)

5 pages. Establishes the conventions every later batch follows.

| Page                                        | Type    | Media | Notes                                                                                                      |
| ------------------------------------------- | ------- | ----- | ---------------------------------------------------------------------------------------------------------- |
| `getting-started/introduction.md`           | rewrite | Shots | Accurate; add screenshots + freshness frontmatter.                                                         |
| `getting-started/quick-start.mdx`           | rewrite | GIF   | Fix role names; cover `/onboarding` trade-selection wizard and `/select-org`. GIF of signup -> onboarding. |
| `getting-started/first-project.mdx`         | rewrite | Shots | Add project type/stage fields; mention project-from-template.                                              |
| `getting-started/dashboard.mdx`             | **new** | Shots | The home dashboard — KPIs, recent activity, quick actions.                                                 |
| `getting-started/navigation-and-search.mdx` | **new** | GIF   | Sidebar tour + Cmd+K command palette + keyboard shortcuts. GIF of a Cmd+K search.                          |
| `docs/index.md`                             | rewrite | —     | Update landing TOC to include all modules (Documents, Reports, Calendar, Products).                        |

**Batch 1 total: 6 pages (2 GIF, 3 Shots, 1 no-media).**

---

## Batch 2 — Bids & Estimates (highest-value workflow)

Existing 4 pages plus the bid gaps from `02-missing-topics.md`.

| Page                           | Type    | Media | Notes                                                                                                                     |
| ------------------------------ | ------- | ----- | ------------------------------------------------------------------------------------------------------------------------- |
| `bids/creating-a-bid.mdx`      | rewrite | GIF   | Fix `/bids/new` flow; introduce the BidDetail tab layout. GIF of creating a bid end to end.                               |
| `bids/line-items.mdx`          | rewrite | GIF   | Verify "marks" vs current label; line items under the Estimate tab; sublines; Add from Catalog. GIF of adding line items. |
| `bids/rates.mdx`               | rewrite | Shots | Rates/markup on the Settings tab; verify labels.                                                                          |
| `bids/distributed-costs.mdx`   | **new** | Shots | The Distributed Costs tab — currently undocumented.                                                                       |
| `bids/sending.mdx`             | rewrite | GIF   | Send flow, status lifecycle, Convert to Project. GIF of send + status change.                                             |
| `bids/templates.mdx`           | **new** | Shots | Saving and loading bid templates (Settings > Bid Templates).                                                              |
| `bids/pdf-and-duplication.mdx` | **new** | Shots | PDF render/preview and duplicating a bid.                                                                                 |

**Batch 2 total: 7 pages (3 GIF, 4 Shots).**

---

## Batch 3 — Project Management

3 existing pages plus project-template and per-project-tab gaps.

| Page                                       | Type    | Media | Notes                                                                                |
| ------------------------------------------ | ------- | ----- | ------------------------------------------------------------------------------------ |
| `projects/overview.mdx`                    | rewrite | Shots | Verify Board/List/Grid views; document the full ProjectDetail tab set and filters.   |
| `projects/phases-tasks.mdx`                | rewrite | Shots | Verify task status/priority enums; add task filtering.                               |
| `projects/gantt.mdx`                       | rewrite | GIF   | Drag-to-reschedule; verify zoom levels + today marker. GIF of dragging a Gantt task. |
| `projects/templates.mdx`                   | **new** | Shots | Project templates (Settings > Workspace); creating a project from a template.        |
| `projects/documents-comments-activity.mdx` | **new** | Shots | The per-project Documents, Comments, and Activity tabs.                              |

**Batch 3 total: 5 pages (1 GIF, 4 Shots).**

---

## Batch 4 — Pay Apps & Change Orders

5 existing pages plus list-page and email-template gaps. Grouped because the workflows mirror each other.

| Page                                                   | Type    | Media | Notes                                                                                     |
| ------------------------------------------------------ | ------- | ----- | ----------------------------------------------------------------------------------------- |
| `pay-apps/creating.mdx`                                | rewrite | Shots | Add the standalone `/pay-apps` list entry point.                                          |
| `pay-apps/schedule-of-values.mdx`                      | rewrite | GIF   | Verify SOV labels; SOV-from-bid import. GIF of filling in SOV progress.                   |
| `pay-apps/approval-workflow.mdx`                       | rewrite | GIF   | Verify Mark as Paid + rejection flow; add approver role gating. GIF of submit -> approve. |
| `change-orders/creating.mdx`                           | rewrite | Shots | Add the standalone `/change-orders` list entry point and CO numbering.                    |
| `change-orders/approval.mdx`                           | rewrite | Shots | Verify Submit for Approval label and approver role gating.                                |
| `pay-apps/pdf-and-email.mdx` _(or fold into existing)_ | **new** | Shots | Pay app + change order PDF render and email templates.                                    |

**Batch 4 total: 6 pages (2 GIF, 4 Shots).**

---

## Batch 5 — Account & Settings

The biggest gap: Settings has 11 tabs, docs cover ~2.

| Page                                | Type    | Media | Notes                                                                                                                           |
| ----------------------------------- | ------- | ----- | ------------------------------------------------------------------------------------------------------------------------------- |
| `settings/team-roles.mdx`           | rewrite | Shots | Full accurate role matrix from `shared/permissions.ts`; fix "Admin" -> Company Admin.                                           |
| `settings/organization.mdx`         | rewrite | Shots | Org profile + the dedicated branding panel; fix role wording.                                                                   |
| `settings/billing.mdx`              | rewrite | Shots | Accurate; screenshots + freshness note only.                                                                                    |
| `settings/connect-google.mdx`       | rewrite | Shots | Accurate; screenshots only. Quality benchmark.                                                                                  |
| `settings/profile-and-security.mdx` | **new** | GIF   | Profile, password, 2FA, passkeys. GIF of 2FA setup.                                                                             |
| `settings/notifications.mdx`        | **new** | Shots | Notification preferences.                                                                                                       |
| `settings/workspace-defaults.mdx`   | **new** | Shots | Numbering, payment terms, tax defaults, bid rates, pipeline stages, product categories, terms templates. May split if too long. |
| `settings/data-management.mdx`      | **new** | Shots | Data export/import.                                                                                                             |
| `settings/deleted-records.mdx`      | **new** | Shots | Soft-delete recovery (Company Admin only).                                                                                      |
| `settings/integrations.mdx`         | **new** | Shots | Integrations overview + connected OAuth apps (Google has its own page).                                                         |

**Batch 5 total: 10 pages (1 GIF, 9 Shots).**

---

## Batch 6 — Standalone Modules (Documents, Reports, Calendar, Products)

Four top-level modules currently absent from the docs. New sidebar group(s) needed in
`astro.config.mjs`.

| Page                                 | Type    | Media | Notes                                                                                                   |
| ------------------------------------ | ------- | ----- | ------------------------------------------------------------------------------------------------------- |
| `documents/library.mdx`              | **new** | Shots | Document library, upload, search, columns, linking to entities.                                         |
| `documents/csv-import-templates.mdx` | **new** | GIF   | The CSV Import Templates wizard. Cross-link the `/api/recipes/` CSV recipe. GIF of building a template. |
| `reports/overview.mdx`               | **new** | Shots | Reports page — Pipeline, Bids, Projects, Activity tabs and KPI cards.                                   |
| `calendar/overview.mdx`              | **new** | Shots | The app-wide calendar aggregating project/phase/task/lead/bid dates.                                    |
| `products/catalog.mdx`               | **new** | Shots | Product catalog and categories.                                                                         |
| `products/kits.mdx`                  | **new** | Shots | Product kits.                                                                                           |

New sidebar group: add **Documents & Reports** (or split Documents / Reports / Calendar /
Products) to `astro.config.mjs`. Decide grouping before this batch.

**Batch 6 total: 6 pages (1 GIF, 5 Shots).**

---

## Batch 7 — Field Operations & CRM (lowest traffic, last)

Per issue #21: Field and CRM ship last.

| Page                      | Type    | Media | Notes                                                                                                                         |
| ------------------------- | ------- | ----- | ----------------------------------------------------------------------------------------------------------------------------- |
| `field/site-logs.mdx`     | rewrite | Shots | Fix routing — site logs are a top-level `/site-logs` module, not a project "Field" tab.                                       |
| `field/time-tracking.mdx` | rewrite | GIF   | Fix routing — top-level `/time-tracking` page; verify rate wording. GIF of logging hours.                                     |
| `crm/contacts.mdx`        | rewrite | Shots | Rewrite the import section to point at CSV Import Templates; verify contact types.                                            |
| `crm/pipeline.mdx`        | rewrite | GIF   | Fix routing (`/pipeline`, `/leads`); configurable stages via Settings > Workspace. GIF of dragging a lead through the Kanban. |
| `crm/leads.mdx`           | **new** | Shots | The lead detail page (`/leads/:id`) and lead-to-bid / lead-to-project conversion.                                             |

**Batch 7 total: 5 pages (2 GIF, 3 Shots).**

---

## Roll-up

| Batch                        | Pages  | GIF pages | Shots-only pages |
| ---------------------------- | ------ | --------- | ---------------- |
| 1 — Getting Started          | 6      | 2         | 3                |
| 2 — Bids                     | 7      | 3         | 4                |
| 3 — Projects                 | 5      | 1         | 4                |
| 4 — Pay Apps & Change Orders | 6      | 2         | 4                |
| 5 — Settings                 | 10     | 1         | 9                |
| 6 — Standalone Modules       | 6      | 1         | 5                |
| 7 — Field & CRM              | 5      | 2         | 3                |
| **Total**                    | **45** | **12**    | **32**           |

- 24 existing pages rewritten + ~21 new pages = ~45 pages.
- ~12 pages need GIFs; the rest need screenshots only.
- Suggested cadence: one batch per PR. Batches 1–2 are the priority (most-trafficked, and
  Batch 1 sets conventions). Batches 6–7 can slip without much user impact.

## Wrap-up tasks (after the last content batch)

- Update `astro.config.mjs` sidebar for any new groups (Batch 6).
- Update `support.astro` Developer Docs / product-doc card link targets if any routes changed.
- Confirm Cloudflare Pages build passes and image/GIF assets don't tank Pagefind index time.
- Cross-link `/api/*` recipes back to the relevant product-doc pages.
- Set `lastUpdated` / `appVersion` frontmatter on every page so future drift is mechanical to spot.
