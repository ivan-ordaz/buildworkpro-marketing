# Missing Documentation Topics

Inventory of BuildWorkPro app workflows (inferred from `client/src/pages`, `client/src/App.tsx`
routes, settings tabs, and the main app `CLAUDE.md` feature list) compared against the current
docs TOC. Lists topics that are documented **nowhere** in `src/content/docs/docs/`.

## Method

- App routes from `client/src/App.tsx`.
- App pages from `client/src/pages/`.
- Settings tabs from `client/src/pages/Settings.tsx` (11 tabs) and `client/src/components/settings/`.
- Feature list cross-checked against `/Users/ivan/buildworkpro/CLAUDE.md`.

## Modules with no documentation at all

These have dedicated app routes/pages but zero coverage in the docs sidebar:

| App area                            | Route(s)                     | Notes                                                                                                                                                                                                                         |
| ----------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Documents**                       | `/documents`                 | Document library with module / linked-to / category / size / uploaded-by columns, search, upload. Entirely undocumented.                                                                                                      |
| **Reports**                         | `/reports`                   | Reports page with Pipeline, Bids, Projects, and Activity tabs plus KPI cards (pipeline value, conversion rate, won deals, etc.). Undocumented.                                                                                |
| **Calendar**                        | `/calendar`                  | Full-app calendar view aggregating project, phase, task, lead, and bid dates. Undocumented.                                                                                                                                   |
| **Products / Catalog**              | `/products`, `/products/:id` | Product catalog with categories and product kits. Referenced obliquely in `bids/line-items.md` ("Settings > Products") but has no page of its own — and the catalog is now its own top-level module, not a settings sub-page. |
| **Notifications**                   | `/notifications`             | In-app notification center. Undocumented.                                                                                                                                                                                     |
| **Activity History**                | `/activity`                  | Org-wide activity feed. Undocumented.                                                                                                                                                                                         |
| **Dashboard**                       | `/dashboard`, `/`            | The landing dashboard (KPIs, recent activity, quick actions). No "your home screen" doc.                                                                                                                                      |
| **Onboarding**                      | `/onboarding`                | Post-signup wizard (trade selection: HVAC, Plumbing, Electrical, etc.). Quick Start doc skips it.                                                                                                                             |
| **Global search / Command palette** | Cmd+K                        | Issue #21 explicitly calls for documenting keyboard shortcuts; the Cmd+K command palette is undocumented.                                                                                                                     |

## Workflows missing within otherwise-covered modules

### Bids

- **Distributed Costs tab** — a full BidDetail tab (`overview / estimate / distributed / settings / ...`) with no docs.
- **Bid templates** — `Settings > Bid Templates` lets you save and load reusable bid structures; not documented.
- **Bid duplication** — duplicating an existing bid as a starting point.
- **Bid PDF render / preview** — generating the client-facing PDF.
- **Bid email templates** — `BidEmailTemplatesSettings`; customizing the email sent with a bid.
- **Comments / Documents / Activity tabs** on a bid — present in BidDetail, undocumented.

### Projects

- **Project templates** — `Settings > Workspace` has Project Templates (`ProjectTemplatesSettings`, `ProjectTemplateForm`); creating a project from a template is undocumented.
- **Project comments and activity** — ProjectDetail has Comments and Activity tabs.
- **Project documents** — per-project document tab.
- **Task dependencies management UI** — mentioned in `gantt.md` but no standalone how-to.

### Pay Apps & Change Orders

- **Pay app email templates** — `PayAppEmailTemplatesSettings`.
- **Change order email templates** — `ChangeOrderEmailTemplatesSettings`.
- **Pay app / change order PDF render** — client-facing document generation.
- **Standalone list pages** — `/pay-apps` and `/change-orders` top-level lists (docs only describe the in-project tabs).

### CRM

- **CSV Import Templates wizard** — `/settings/csv-import-templates/new` and `/edit`; saved, reusable column-mapping templates for contact/lead import. The current `crm/contacts.md` describes a generic one-off importer that no longer matches.
- **Lead detail page** — `/leads/:id` (`LeadDetail.tsx`); pipeline doc only covers the Kanban board.
- **Configurable pipeline stages** — `Settings > Workspace > Pipeline` (`PipelineSettings`); stages are editable, not fixed.
- **Lead-to-project conversion** — mentioned in one sentence; deserves its own steps.

## Settings tabs with no dedicated docs page

Settings has **11 tabs**; the docs cover roughly 2 (Organization, Billing) plus Integrations
(Google only) and Team. Undocumented or thinly documented tabs:

| Settings tab    | Component                                                                                                           | Doc coverage                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Profile         | `ProfileSettings`                                                                                                   | none                                                                                     |
| Security        | `SecuritySettings`, `TwoFactorSetup`, `PasskeySettings`                                                             | none — 2FA and passkeys undocumented                                                     |
| Notifications   | `NotificationSettings`                                                                                              | none — notification preferences undocumented                                             |
| Organization    | `OrgSettings`, `BrandingSettingsPanel`                                                                              | partial (`settings/organization.md`)                                                     |
| Billing         | `BillingSettings`                                                                                                   | covered (`settings/billing.mdx`)                                                         |
| Workspace       | numbering, payment terms, tax defaults, bid rates, pipeline, product categories, project templates, terms templates | none — large gap                                                                         |
| Bid Templates   | `ProjectTemplatesSettings` / bid template settings                                                                  | none                                                                                     |
| Developer       | `DeveloperSettings`, `ApiKeysSettings`, `WebhookEndpointsSettings`                                                  | covered by the `/api/*` developer docs (cross-link only)                                 |
| Integrations    | `IntegrationsSettings`, `GoogleWorkspaceCard`, `ConnectedAppsSettings`                                              | partial — only Google (`settings/connect-google.mdx`); connected OAuth apps undocumented |
| Data Management | `DataManagementSettings`                                                                                            | none — data export/import undocumented                                                   |
| Deleted Records | `DeletedRecordsManager`                                                                                             | none — soft-delete recovery (company_admin only) undocumented                            |

## Cross-cutting topics with no coverage

- **Roles & permissions reference** — `team-roles.md` exists but is stale and incomplete; needs a full, accurate matrix from `shared/permissions.ts` (company_admin / manager / member / field_crew / viewer).
- **Keyboard shortcuts** — issue #21 calls this out explicitly (Cmd+K and any others).
- **Mobile app** — a React Native app exists (`buildworkpro-mobile`); no docs mention it. (Scope decision needed — may belong in a separate section.)
- **Audit log** — `createAuditLog` / activity feed is a compliance feature with no end-user doc.
- **Multi-org / org switching** — `/select-org`; users in more than one org can switch. Undocumented.

## Priority gaps (biggest)

1. **Settings > Workspace** — an entire tab of org-wide defaults (numbering, terms, tax, rates, templates, pipeline stages) with zero docs.
2. **Documents, Reports, Calendar, Products** — four top-level modules completely absent from the docs.
3. **CSV Import Templates** — the documented contact-import flow is wrong; the real wizard is undocumented.
4. **Field Operations routing** — site logs and time tracking are top-level modules, but docs describe them as in-project tabs.
5. **Bid Distributed Costs + templates** — substantial bid functionality with no docs.
