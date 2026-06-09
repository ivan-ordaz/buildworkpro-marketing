# Product Docs Page Audit

Audit of every page under `src/content/docs/docs/` against the current BuildWorkPro app
(`/Users/ivan/buildworkpro/client/src/`). Part of GitHub issue #21 ("#72 — Rewrite product
docs to current app state").

## Rating scale

- **accurate** — content matches the current app; only needs screenshots/GIFs and a frontmatter freshness note.
- **partial** — mostly correct but missing or wrong on some menu paths, labels, tabs, or fields.
- **stale** — written for an older version of the app; describes UI/workflows that no longer match.
- **placeholder** — stub-level; too thin to be useful.

## Summary

24 product-doc pages across 8 sidebar groups. None are pure placeholders, but most predate
the current app. **3 accurate, 9 partial, 12 stale.** No page has screenshots. No page has a
"last updated against app version" frontmatter note.

| Rating      | Count |
| ----------- | ----- |
| accurate    | 3     |
| partial     | 9     |
| stale       | 12    |
| placeholder | 0     |

## Getting Started (4 pages)

| Path                                    | Rating   | What's wrong                                                                                                                                                                                |
| --------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/index.md`                         | partial  | Landing page TOC omits Documents, Reports, Calendar, Products, Notifications, Activity History — links only the 6 original modules.                                                         |
| `docs/getting-started/introduction.md`  | accurate | Feature overview still matches; needs screenshots + freshness note only.                                                                                                                    |
| `docs/getting-started/quick-start.md`   | stale    | Role names wrong ("Admin" should be **Company Admin**); says signup needs email verification link without covering the actual `/onboarding` wizard (trade selection step) or `/select-org`. |
| `docs/getting-started/first-project.md` | partial  | Project create flow roughly right, but omits project type/stage fields and the templated project-from-template path; phases/tasks tabs match.                                               |

## Bids & Estimates (4 pages)

| Path                          | Rating  | What's wrong                                                                                                                                                                                        |
| ----------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/bids/creating-a-bid.md` | partial | "New Bid" navigates to `/bids/new` (a create page, not a modal); doesn't mention the BidDetail tab layout (Overview / Estimate / Distributed / Settings / Comments / Documents / Activity).         |
| `docs/bids/line-items.md`     | partial | Calls the catalog tag system "marks" — verify against current UI label; line items now live under the **Estimate** tab, not a "Line Items" tab; sublines and Add from Catalog need re-verification. |
| `docs/bids/rates.md`          | partial | Rates/markup live on the **Settings** tab of a bid; missing the **Distributed Costs** tab entirely (a whole bid feature with no docs).                                                              |
| `docs/bids/sending.md`        | partial | Send flow plausible; status list and Convert to Project roughly correct, but doesn't mention bid duplication, PDF render/preview, or bid templates.                                                 |

## Project Management (3 pages)

| Path                            | Rating  | What's wrong                                                                                                                                                                                                                                   |
| ------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/projects/overview.md`     | stale   | Describes "Board / List / Grid" views — verify these still exist; omits the full ProjectDetail tab set (Overview, Phases, Tasks, Change Orders, Pay Apps, Site Logs, Time, Documents, Comments, Activity) and project category/status filters. |
| `docs/projects/phases-tasks.md` | partial | Phases/tasks/subtasks/dependencies mostly match; task status/priority enums need verification against the live UI; no mention of task filtering by status/priority/assignee.                                                                   |
| `docs/projects/gantt.md`        | partial | Gantt drag-to-reschedule described; needs verification that zoom levels and the today marker still render as written.                                                                                                                          |

## Pay Applications (3 pages)

| Path                                  | Rating  | What's wrong                                                                                                                                                                                   |
| ------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/pay-apps/creating.md`           | partial | Create-from-project-tab flow plausible; doesn't mention creating a pay app from the standalone `/pay-apps` list or the PDF render.                                                             |
| `docs/pay-apps/schedule-of-values.md` | partial | SOV column set is detailed and largely right; needs field-label verification and a note on importing SOV lines from a converted bid.                                                           |
| `docs/pay-apps/approval-workflow.md`  | partial | Status lifecycle (Draft/Submitted/Approved/Paid/Rejected) plausible; "Mark as Paid" and rejection-reason flow need verification; doesn't cover who can approve (manager/company_admin gating). |

## Change Orders (2 pages)

| Path                             | Rating  | What's wrong                                                                                                            |
| -------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------- |
| `docs/change-orders/creating.md` | partial | Create flow plausible; doesn't mention the standalone `/change-orders` list page or CO numbering.                       |
| `docs/change-orders/approval.md` | partial | Status flow and contract-impact math plausible; "Submit for Approval" label and approver role gating need verification. |

## Field Operations (2 pages)

| Path                          | Rating | What's wrong                                                                                                                                                                                                                                 |
| ----------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/field/site-logs.md`     | stale  | Says site logs live under a project "Field" tab and are created with "New Daily Log" — the app has a dedicated top-level `/site-logs` list + `/site-logs/:id` detail; the project tab is "Site Logs". Menu path and button label both wrong. |
| `docs/field/time-tracking.md` | stale  | Says time tracking is a "section" inside a project — the app has a dedicated top-level `/time-tracking` page; burden/overtime rate wording needs verification against current settings.                                                      |

## CRM & Pipeline (2 pages)

| Path                   | Rating | What's wrong                                                                                                                                                                                                                                                                 |
| ---------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/crm/contacts.md` | stale  | Import section describes a generic CSV importer; the app now has a **CSV Import Templates** wizard (`/settings/csv-import-templates/*`) with saved column mappings — the documented flow no longer matches. Contact types need verification.                                 |
| `docs/crm/pipeline.md` | stale  | Says pipeline is at "CRM > Pipeline"; the app has top-level `/pipeline` and `/leads` + `/leads/:id` routes. Lead stages are configurable via **Settings > Workspace > Pipeline** — the doc presents them as fixed defaults. "Create Bid" from a won lead needs verification. |

## Account & Settings (4 pages)

| Path                               | Rating   | What's wrong                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/settings/organization.md`    | stale    | Settings is now an 11-tab page (Profile, Security, Notifications, Organization, Billing, Workspace, Bid Templates, Developer, Integrations, Data Management, Deleted Records). This page covers only the Organization tab and says "Only Admins" — should be **Company Admin**. Branding now lives in a dedicated branding panel. |
| `docs/settings/team-roles.md`      | stale    | Role names wrong throughout: "Admin" must be **Company Admin**; descriptions are close but predate `shared/permissions.ts`. Team management lives under **Settings > Team** — verify it isn't now a separate tab.                                                                                                                 |
| `docs/settings/billing.mdx`        | accurate | Pricing ($79/mo, $790/yr, 14-day trial) and billing-portal flow match the app's current Stripe single-plan model. Needs screenshots + freshness note only.                                                                                                                                                                        |
| `docs/settings/connect-google.mdx` | accurate | Detailed and current — matches the Integrations > Google Workspace card, scopes, toggles, and troubleshooting. The strongest existing page; use it as the quality bar. Needs screenshots only.                                                                                                                                    |
