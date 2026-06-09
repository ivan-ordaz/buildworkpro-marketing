# Product Docs Content Style Guide

The standard for rewriting `src/content/docs/docs/*`. It aligns the product docs with the
quality bar set by the Phase 5A developer docs at `src/content/docs/api/*`. Follow it for
every page so the two doc trees read as one product.

## Voice and tone

- **Concise.** Short sentences. One idea per sentence. Cut filler ("simply", "just", "easily", "powerful", "seamless").
- **Present tense.** "The bid moves to Sent status." Not "will move" or "has moved".
- **Second person.** Address the reader as "you". "You create a bid from the Bids list."
- **No emoji.** Anywhere — body, headings, callouts.
- **Active voice.** "Click Save." Not "The bid can be saved by clicking Save."
- **Imperative for instructions.** Numbered steps start with a verb: "Open the project.", "Enter a name."
- **No marketing language.** This is a reference, not a sales page. State what the feature does and how to use it.

## Page structure

Every page follows this skeleton:

```
---
title: <Title Case, matches sidebar>
description: <one sentence, used for SEO + Pagefind>
sidebar:
  order: <n>
lastUpdated: <YYYY-MM-DD>      # date the page was verified against the app
appVersion: vX.Y               # app version the page was verified against
---

import { Steps, Tabs, TabItem, Aside, Card, CardGrid } from '@astrojs/starlight/components';

<one- or two-sentence intro: what this is and when you use it>

## <First task or concept>

...

## What's next  (optional)

- [Related page](/docs/...)
```

- Use `.mdx` for any page that imports Starlight components (`<Steps>`, `<Tabs>`, `<Aside>`). Plain `.md` only for pure prose with no components. **Prefer `.mdx`** so components are always available.
- `##` for top-level sections, `###` for sub-sections. Never skip a level. No `#` in the body (the title frontmatter is the H1).
- Keep pages focused. One workflow per page. If a page exceeds ~150 lines, split it.

## Frontmatter freshness note

Issue #21 requires a drift marker. Add to every rewritten page:

```yaml
lastUpdated: 2026-05-21
appVersion: v1.0
```

`lastUpdated` is the date a human last verified the page against the live app. `appVersion`
is the app version checked. Future editors compare these against the current app to spot
drift mechanically.

## Starlight components

Use the built-in components — do not hand-roll HTML or use bare lists for procedures.

### `<Steps>` — for any multi-step procedure

Wrap an ordered list. Each step starts with a bold action.

```mdx
<Steps>

1. **Open the Bids list.** Click **Bids** in the sidebar.

2. **Start a new bid.** Click **New Bid**. The app navigates to the bid create page.

3. **Name the bid.** Enter a descriptive name, for example "Oak Valley Office - HVAC Install".

</Steps>
```

### `<Tabs>` / `<TabItem>` — for branching by context

Use when a flow differs by entry point, role, or platform.

```mdx
<Tabs>
  <TabItem label="From the project">...</TabItem>
  <TabItem label="From the Pay Apps list">...</TabItem>
</Tabs>
```

### `<Aside>` — for callouts

Four types, used consistently:

- `type="note"` — helpful context, not critical.
- `type="tip"` — a shortcut or best practice.
- `type="caution"` — something that can cause confusion or rework.
- `type="danger"` — destructive or irreversible actions (hard delete, cancellation).

```mdx
<Aside type="caution">
  Submitting a pay app locks it for editing. Review every line before you submit.
</Aside>
```

### `<Card>` / `<CardGrid>` — for overview / landing pages

Use on `docs/index.md` and module landing pages to link related topics.

## Role-gating callout convention

Issue #21 requires role-gated steps to be scannable. **Convention:** whenever a page, section,
or step is limited to certain roles, lead with a `<Aside type="note">` using a fixed prefix
**"Role required:"**. Place it directly under the heading it applies to.

The five tenant roles, written exactly as in `shared/permissions.ts`:

`company_admin` · `manager` · `member` · `field_crew` · `viewer`

Render them in the doc with friendly capitalization but keep the mapping unambiguous:

- `company_admin` → **Company Admin**
- `manager` → **Manager**
- `member` → **Member**
- `field_crew` → **Field Crew**
- `viewer` → **Viewer**

Page-level gate (whole page is admin-only):

```mdx
<Aside type="note">
  **Role required:** Company Admin. Other roles cannot change organization settings.
</Aside>
```

Step-level gate (one step needs elevation):

```mdx
3. **Approve the pay app.**
   <Aside type="note">
     **Role required:** Manager or Company Admin. Members and Field Crew cannot approve pay apps.
   </Aside>
   Click **Approve**.
```

Rules:

- Always name the roles that **can** do the thing, not the ones that can't (positive framing), then optionally note who's excluded.
- Never write "Admin" — it is **Company Admin**. Platform admin is a separate system and never appears in product docs.
- If a whole module is hidden from a role (e.g. Field Crew cannot see Bids), state it once at the top of the module landing page.

## Screenshot conventions

Issue #21 requires a screenshot on every page that references a UI element.

- **Format:** `.png`.
- **Theme:** light theme only.
- **Viewport:** 1440px wide browser window.
- **Data:** demo-tenant data only. No real customer names, addresses, emails, or dollar figures that could identify a real company.
- **Storage:** `public/docs-images/` mirroring the doc's URL slug. A doc at
  `/docs/bids/creating-a-bid/` stores images under `public/docs-images/bids/creating-a-bid/`.
- **Naming:** `NN-short-description.png`, zero-padded, in the order they appear on the page.
  Example: `public/docs-images/bids/creating-a-bid/01-new-bid-button.png`,
  `02-bid-name-field.png`, `03-saved-draft.png`.
- **Reference in MDX** with an absolute path and meaningful alt text:

  ```mdx
  ![The New Bid button at the top right of the Bids list](/docs-images/bids/creating-a-bid/01-new-bid-button.png)
  ```

- Crop tight to the relevant UI. Don't ship full-page screenshots when a panel will do.
- Re-use the existing marketing screenshot style in `public/screenshots/` so the look is unified, but keep doc images in `public/docs-images/` (separate folder, mirrors slugs).

## GIF conventions

Issue #21 calls for GIFs on multi-step flows that benefit from motion.

- **Format:** animated `.gif`, looping.
- **Width:** 1280px.
- **Length:** 10 seconds or less.
- **Size:** 2 MB or less each (Pagefind/Cloudflare build budget — oversized assets slow the index).
- **Capture:** QuickTime screen recording, converted with Gifski or LICEcap.
- **Storage + naming:** same as screenshots — `public/docs-images/<slug>/`, named `NN-flow-name.gif`.
- Use a GIF only when motion adds clarity (dragging, reordering, a multi-dialog sequence). For
  a static "this is what the screen looks like" use a screenshot.

## Linking

- Internal links are root-relative and **end with a trailing slash** (`trailingSlash: 'always'`):
  `[create a bid](/docs/bids/creating-a-bid/)`.
- Cross-link product docs and developer docs where relevant. Example: the
  `/api/recipes/` CSV-import recipe links back to the product docs CSV Import Templates page,
  and vice versa.
- Use descriptive link text, never "click here".

## Terminology

- Use the exact label shown in the app. Verify every menu path, button label, tab name,
  dialog title, and field name against the live UI before publishing.
- Render UI labels in **bold**: "Click **New Bid**.", "Open the **Estimate** tab."
- Menu paths use `->` between segments: "Go to **Settings -> Developer -> API Keys**."
- Product is **BuildWorkPro** (one word, camel caps). Never "Build Work Pro" or "BWP" in prose.
- Keyboard shortcuts in `<kbd>`: press <kbd>Cmd</kbd>+<kbd>K</kbd> to open the command palette.

## Checklist before publishing a page

- [ ] Every menu path, button, tab, and field name verified against the live app.
- [ ] Role-gating callouts added wherever a step needs elevation.
- [ ] `lastUpdated` and `appVersion` set in frontmatter.
- [ ] Screenshot on every section that references a UI element; GIFs on multi-step flows.
- [ ] All images under `public/docs-images/<slug>/` with `NN-` naming.
- [ ] Internal links root-relative with trailing slash.
- [ ] No emoji, no marketing language, present tense, second person.
- [ ] `npm run build` passes and Pagefind index time is unaffected.
