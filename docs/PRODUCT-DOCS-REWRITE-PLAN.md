# Product Docs Rewrite Plan (#21)

Tracking the rewrite of the BuildWorkPro product docs under
`src/content/docs/docs/` so they reflect the current state of the app.

This document has three parts:

1. **Audit** — every existing page rated, with notes on what is wrong.
2. **Content style guide** — the writing conventions the rewrite follows.
3. **Remaining work** — the categories not yet rewritten + the screenshot
   shot-list (#196).

---

## 1. Audit

Pages live in `src/content/docs/docs/` across 8 sidebar groups. Rating scale:

- **accurate** — matches the current app; only minor polish needed.
- **partial** — broadly correct but has stale facts or missing detail.
- **placeholder** — thin / stub-level; correct as far as it goes but underbuilt.
- **stale** — contains facts that are now wrong and will mislead users.

Audited 2026-05-16 against `/Users/ivan/buildworkpro` (`shared/permissions.ts`,
`shared/types.ts`, `CLAUDE.md`).

| Group              | Page                    | File                               | Rating    | Notes                                                                                                                                                                                                     |
| ------------------ | ----------------------- | ---------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Getting Started    | What is BuildWorkPro?   | `getting-started/introduction.md`  | partial   | Feature list broadly right. No mention of Cmd+K command palette, roles, or manual-save model. Plain Markdown — no Starlight components.                                                                   |
| Getting Started    | Quick Start             | `getting-started/quick-start.md`   | **stale** | Lists role **"Admin"** — the app role is **Company Admin** (`company_admin`). No callout that team invites are role-gated (company_admin only). Plain Markdown.                                           |
| Getting Started    | Your First Project      | `getting-started/first-project.md` | partial   | Phases/tasks flow is roughly right but unverified against current Projects UI. Project statuses not stated; app uses Planning / In Progress / On Hold / Closeout / Completed / Cancelled. Plain Markdown. |
| Bids & Estimates   | Creating a Bid          | `bids/creating-a-bid.md`           | partial   | Save behavior described correctly. Missing: Cmd+K, role gating (viewer/field_crew cannot create bids), draft status wording is fine. Plain Markdown.                                                      |
| Bids & Estimates   | Line Items              | `bids/line-items.md`               | partial   | "Marks" and catalog flow plausible; product catalog is at **Products** (top-level), not only "Settings > Products". Needs verification of the Line Items tab UI. Plain Markdown.                          |
| Bids & Estimates   | Rates and Markup        | `bids/rates.md`                    | partial   | Margin/overhead/labor/tax structure plausible but unverified. Does not mention the sales-rounding toggle. Plain Markdown.                                                                                 |
| Bids & Estimates   | Sending a Bid           | `bids/sending.md`                  | **stale** | Lists a **"Viewed"** bid status — the app has **no `viewed` status**. Bid statuses are Draft / Sent / Accepted / Rejected / Expired only. Convert-to-project flow is otherwise right. Plain Markdown.     |
| Project Management | Projects Overview       | `projects/overview.md`             | **stale** | Project statuses listed as Planning / **Active** / On Hold / Completed / Cancelled. App uses **In Progress** (not "Active") and is missing **Closeout**. Plain Markdown.                                  |
| Project Management | Phases and Tasks        | `projects/phases-tasks.md`         | partial   | Task statuses listed as To Do / In Progress / Complete — app uses `todo` / `in_progress` / `done` ("Done", not "Complete"). Phase statuses (Pending/In Progress/Completed) not mentioned. Plain Markdown. |
| Project Management | Gantt Chart             | `projects/gantt.md`                | partial   | Drag-to-reschedule and zoom described; unverified against current Gantt component. Plain Markdown.                                                                                                        |
| Pay Apps           | Creating a Pay App      | `pay-apps/creating.md`             | partial   | AIA-style flow plausible; unverified. Plain Markdown.                                                                                                                                                     |
| Pay Apps           | Schedule of Values      | `pay-apps/schedule-of-values.md`   | partial   | SOV column model plausible; unverified. Plain Markdown.                                                                                                                                                   |
| Pay Apps           | Approval Workflow       | `pay-apps/approval-workflow.md`    | partial   | Draft/Submitted/Approved/Paid/Rejected lifecycle plausible; "Submit" / "Mark as Paid" actions plausible. Edit-toggle save model (workflow entity) not mentioned. Plain Markdown.                          |
| Change Orders      | Creating a Change Order | `change-orders/creating.md`        | partial   | CO line-item model plausible; unverified. Plain Markdown.                                                                                                                                                 |
| Change Orders      | Change Order Approval   | `change-orders/approval.md`        | partial   | Draft/Pending/Approved/Rejected lifecycle and contract-value impact plausible; unverified. Plain Markdown.                                                                                                |
| Field Operations   | Site Logs               | `field/site-logs.md`               | partial   | Daily-log fields plausible; "Field" tab naming unverified. Plain Markdown.                                                                                                                                |
| Field Operations   | Time Tracking           | `field/time-tracking.md`           | partial   | Hours/labor-rate/burden model plausible; unverified. Plain Markdown.                                                                                                                                      |
| CRM & Pipeline     | Contacts                | `crm/contacts.md`                  | partial   | Contact types listed (GC/Owner/Architect/Supplier/Subcontractor/Other) but the app also has a **Customer** type — list is incomplete. Import flow plausible. Plain Markdown.                              |
| CRM & Pipeline     | Sales Pipeline          | `crm/pipeline.md`                  | partial   | Default lead stages plausible; Kanban flow plausible; unverified against current Leads UI. Plain Markdown.                                                                                                |
| Account & Settings | Team and Roles          | `settings/team-roles.md`           | **stale** | Role named **"Admin"** — app role is **Company Admin**. Otherwise the 5-role model and per-role descriptions are accurate and well-written. Plain Markdown.                                               |
| Account & Settings | Organization Settings   | `settings/organization.md`         | partial   | Company profile / branding / defaults plausible; "Only Admins" should read "Company Admins". Plain Markdown.                                                                                              |
| Account & Settings | Billing and Plans       | `settings/billing.mdx`             | accurate  | Pricing ($79/mo, $790/yr, free trial, all features) matches `CLAUDE.md`. Already `.mdx`, uses an env-injected support email. Minor polish only.                                                           |
| Account & Settings | Connect Google          | `settings/connect-google.mdx`      | accurate  | Detailed, current, well-structured `.mdx` with Gmail/Calendar scopes and troubleshooting. No change needed.                                                                                               |
| (index)            | Documentation home      | `docs/index.md`                    | accurate  | Landing page; links are valid. Minor polish only.                                                                                                                                                         |

### Audit summary

- **5 pages are stale** (actively wrong): `getting-started/quick-start.md`,
  `bids/sending.md`, `projects/overview.md`, `settings/team-roles.md`, plus
  `phases-tasks.md` borderline (wrong status label "Complete" vs "Done").
- **2 pages are accurate** as-is: `settings/billing.mdx`, `settings/connect-google.mdx`.
- **The rest are "partial"** — broadly correct but thin, unverified against the
  current UI, and written in plain Markdown with **no Starlight components**
  (`<Steps>`, `<Tabs>`, `<Aside>`).
- **Systemic issues across the whole tree:**
  - Role name **"Admin"** used everywhere — must become **Company Admin**.
  - No page uses Starlight components; numbered lists are plain `1. 2. 3.`.
  - No page mentions the **Cmd+K command palette** or the **manual-save**
    (`useDirtyForm` / Save button) vs **edit-toggle** distinction.
  - No `lastUpdated` / app-version frontmatter.

---

## 2. Content style guide

Apply this to every rewritten or new product-docs page.

### Voice & tense

- **Second person, present tense.** "Click **Save**." not "You will click Save"
  or "The user clicks Save".
- **Concise.** One idea per sentence. Cut hedging ("simply", "just", "easily").
- **No emoji.** Anywhere.
- **Bold** for UI labels and button names: **New Bid**, **Settings > Team**.
- Use `code` for field values, statuses, and API-ish identifiers when literal.

### Structure

- Start each page with a one- or two-sentence intro: what the feature is and
  why it matters.
- Use `##` for sections, `###` only when a section genuinely needs sub-parts.
- Every page is `.md` unless it needs components — then `.mdx`.

### Starlight components (`.mdx` only)

Import what you use at the top of the file:

```mdx
import { Steps, Tabs, TabItem, Aside, Badge } from '@astrojs/starlight/components';
```

- **`<Steps>`** — wrap any ordered, do-this-then-that procedure. The child must
  be a single ordered list.
- **`<Tabs>` / `<TabItem>`** — for parallel paths (e.g. desktop vs mobile, or
  two ways to reach the same screen).
- **`<Aside>`** — callouts. Use `type="note"` for context, `type="tip"` for
  shortcuts, `type="caution"` for things that can go wrong, `type="danger"`
  for destructive/irreversible actions.

### MDX comments

In `.mdx` files, comments must be JSX comments — `{/* ... */}` — not HTML
comments (`<!-- ... -->`). HTML comments break the MDX compiler. Note that
`.prettierignore` already excludes `**/*.mdx` because Prettier mangles JSX
comments; format MDX by hand.

### Role gating

When a step or feature is restricted by role, mark it with an `<Aside>`:

```mdx
<Aside type="note" title="Role required">
  Only **Company Admin** and **Manager** can send bids. **Member**, **Field Crew**, and **Viewer**
  cannot.
</Aside>
```

Canonical role names (never use "Admin" alone):

- **Company Admin** — full access, billing, team, hard-delete.
- **Manager** — elevated; delete, send quotes, approve pay apps, manage products.
- **Member** — create/edit on assigned entities; export reports.
- **Field Crew** — site logs + time tracking only; no bids/pay-apps/leads/settings.
- **Viewer** — read-only; no roster, no exports.

### App conventions to reflect

- **Cmd+K command palette** — mention it as the fast way to jump to any record
  or page. (`Ctrl+K` on Windows.)
- **Manual save** for primary entities (Contact, Lead, Project, Bid, Product):
  a **Save** button appears when there are unsaved edits; users are warned
  before leaving with unsaved work.
- **Edit-toggle** for workflow entities (Change Order, Site Log, Pay App):
  the record is read-only until you click **Edit**.
- **Statuses** — use the real values:
  - Bid: Draft, Sent, Accepted, Rejected, Expired. (**No "Viewed".**)
  - Project: Planning, In Progress, On Hold, Closeout, Completed, Cancelled.
    (**"In Progress", not "Active".**)
  - Task: To Do, In Progress, Done. (**"Done", not "Complete".**)

### Frontmatter

Every rewritten page gets a `lastUpdated` note recording the app version it was
checked against:

```yaml
---
title: Quick Start
description: ...
sidebar:
  order: 2
lastUpdated: 2026-05-16
# Reviewed against BuildWorkPro app v1.0.0 (REST API v1).
---
```

(Starlight's `lastUpdated` frontmatter is honored by the docs theme; the
app-version note is a YAML comment so it survives in source without needing a
schema change.)

---

## 3. Remaining work

### Categories rewritten in this pass (#21, partial scope)

- **Getting Started** — `introduction.md`, `quick-start.md`, `first-project.md`
  → fully rewritten as `.mdx` with Steps/Aside, corrected roles, version note,
  screenshot placeholders.
- **Bids & Estimates** — `creating-a-bid.md`, `line-items.md`, `rates.md`,
  `sending.md` → fully rewritten as `.mdx`, corrected bid statuses (no
  "Viewed"), version note, screenshot placeholders.

### Categories NOT yet rewritten — remaining work for #21

These 6 groups still need the full rewrite treatment (convert to `.mdx`, add
Starlight components, fix the stale facts noted in the audit, add version
frontmatter, embed screenshot placeholders):

1. **Project Management** — `projects/overview.md` (stale: "Active" → "In
   Progress", add "Closeout"), `projects/phases-tasks.md` (stale: "Complete" →
   "Done"), `projects/gantt.md`.
2. **Pay Apps** — `pay-apps/creating.md`, `pay-apps/schedule-of-values.md`,
   `pay-apps/approval-workflow.md` (add edit-toggle save model).
3. **Change Orders** — `change-orders/creating.md`, `change-orders/approval.md`.
4. **Field Operations** — `field/site-logs.md`, `field/time-tracking.md`.
5. **CRM & Pipeline** — `crm/contacts.md` (add missing "Customer" contact
   type), `crm/pipeline.md`.
6. **Account & Settings** — `settings/team-roles.md` (stale: "Admin" → "Company
   Admin"), `settings/organization.md` ("Only Admins" → "Company Admins").
   `billing.mdx` and `connect-google.mdx` are already accurate — leave them.

### Screenshot capture — remaining work (#196)

Image directory structure and naming convention are created (see below).
Placeholders are embedded in the Getting Started + Bids pages. **Actual capture
of live screenshots against `app.buildworkpro.com` is a follow-up that requires
an authenticated browser session — it was intentionally NOT done in this pass.**

---

## 4. Screenshots (#196) — directory, naming, and shot-list

### Directory structure

Screenshots live under `public/docs-screenshots/<area>/`. The `<area>` matches
the docs sidebar group:

```
public/docs-screenshots/
  getting-started/
  bids/
  projects/
  pay-apps/
  change-orders/
  field/
  crm/
  settings/
```

A page references an image with an absolute path from `public/`:

```md
![Descriptive caption](/docs-screenshots/bids/bid-create-form.png)
```

### Naming convention

`<area>/<page-or-feature>-<what>.png`, all lowercase, hyphen-separated.

- `<page-or-feature>` — short slug for the page or screen, e.g. `bid`, `org-setup`.
- `<what>` — the specific UI element, e.g. `create-form`, `line-items-tab`,
  `status-badge`.

Examples: `getting-started/org-setup-form.png`,
`bids/bid-line-items-tab.png`, `bids/bid-send-dialog.png`.

Every embed in a rewritten page is paired with a source comment so the capture
pass knows exactly what to shoot. In `.mdx` files use a JSX comment (HTML
comments do not compile in MDX); in plain `.md` files an HTML comment is fine:

```mdx
{/* SCREENSHOT NEEDED: <precise description of the UI state to capture> */}
```

```md
<!-- SCREENSHOT NEEDED: <precise description of the UI state to capture> -->
```

### Shot-list (Getting Started + Bids)

| Page                                | Screenshot file                           | What to capture                                                                                                                         |
| ----------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `getting-started/quick-start.mdx`   | `getting-started/signup-form.png`         | The sign-up page with name / email / password fields.                                                                                   |
| `getting-started/quick-start.mdx`   | `getting-started/org-setup-form.png`      | The "Create your organization" form (company name, phone, address, trade, logo upload).                                                 |
| `getting-started/quick-start.mdx`   | `getting-started/team-invite-dialog.png`  | Settings > Team with the Invite Member dialog open, showing the role dropdown (Company Admin / Manager / Member / Field Crew / Viewer). |
| `getting-started/introduction.mdx`  | `getting-started/command-palette.png`     | The Cmd+K command palette open over the dashboard.                                                                                      |
| `getting-started/first-project.mdx` | `getting-started/project-create-form.png` | The New Project form (name, client, address, dates, contract value).                                                                    |
| `getting-started/first-project.mdx` | `getting-started/project-phases-tab.png`  | A project's Phases tab with two or three phases and the Add Phase control.                                                              |
| `getting-started/first-project.mdx` | `getting-started/project-dashboard.png`   | A project dashboard showing completion %, upcoming tasks, contract value.                                                               |
| `bids/creating-a-bid.mdx`           | `bids/bid-create-form.png`                | The New Bid form: name field, contact selector, terms (bid date, expiration, scope, exclusions, payment terms).                         |
| `bids/creating-a-bid.mdx`           | `bids/bid-save-button.png`                | A bid detail page with unsaved edits, showing the Save button in the appeared state.                                                    |
| `bids/line-items.mdx`               | `bids/bid-line-items-tab.png`             | The Line Items tab of a bid with several line items, quantities, units, and extended prices.                                            |
| `bids/line-items.mdx`               | `bids/bid-add-from-catalog.png`           | The "Add from Catalog" product picker open over a bid.                                                                                  |
| `bids/rates.mdx`                    | `bids/bid-rates-panel.png`                | The bid rates/markup configuration: markup %, overhead %, labor rates, tax.                                                             |
| `bids/rates.mdx`                    | `bids/bid-summary.png`                    | The bid summary block: subtotal, markup, overhead, tax, grand total.                                                                    |
| `bids/sending.mdx`                  | `bids/bid-send-dialog.png`                | The Send Bid dialog: recipient email, CC, personal message.                                                                             |
| `bids/sending.mdx`                  | `bids/bid-status-list.png`                | The Bids list page showing a mix of Draft / Sent / Accepted / Rejected / Expired status badges.                                         |
| `bids/sending.mdx`                  | `bids/bid-convert-to-project.png`         | The Convert to Project confirmation showing carried-over name, client, contract value.                                                  |

### Shot-list — remaining categories (capture later, alongside their rewrites)

Not yet embedded; produce these when the 6 remaining categories are rewritten:
Projects (overview views, Gantt), Pay Apps (creation, SOV grid, approval),
Change Orders (creation, approval), Field (site log form, time entry form),
CRM (contact form, pipeline Kanban), Settings (team roster, org settings).
