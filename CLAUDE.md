# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Marketing + docs site for BuildWorkPro. Astro 6 + Starlight, deployed to Cloudflare (Workers/Pages) via `@astrojs/cloudflare`. Separate repo from the main SaaS app at `/Users/ivan/buildworkpro/` — do not assume any shared code, tooling, or env. Same parent folder, but each has its own `package.json` and git remote.

## Commands

```bash
npm run dev              # astro dev — local dev at http://localhost:4321
npm run build            # astro build — outputs to ./dist/ (Cloudflare Workers build)
npm run preview          # preview the built site locally

npm run check            # astro check — type-check Astro + TypeScript
npm run lint             # eslint . — lint .astro, .ts, .tsx, .js
npm run lint:fix         # eslint . --fix
npm run format           # prettier --write .
npm run format:check     # prettier --check . (this is what CI runs)

npm run test:e2e         # playwright test — smoke tests against the dev server
npm run test:e2e:ui      # playwright test --ui — interactive mode
npm run test:e2e:install # one-time: install Chromium for Playwright
```

Run the full suite locally before pushing: `npm run check && npm run lint && npm run format:check && npm run build && npm run test:e2e`.

## Branch & CI policy

- **Main is PR-only.** Direct pushes to `main` are blocked by GitHub branch protection (PR required, the `CI` status check must pass, force pushes and branch deletion disabled). Admins are not enforced — there is no automatic bypass, but the repo owner can temporarily lift protection for emergencies via the GitHub UI.
- Open a PR from a feature branch (`feat/...`, `fix/...`, `docs/...`). Cloudflare's auto-deploy only runs on push to `main`, so the merge is the deploy.
- **CI runs on every PR and every push to `main`** via `.github/workflows/ci.yml`. The aggregate status check is named **`CI`** and is the required check for merging.
- CI runs five parallel jobs: **Lint** (`eslint`), **Format** (`prettier --check`), **Typecheck** (`astro check`), **Build** (`astro build`), **E2E (Playwright)** (smoke tests in `tests/smoke.spec.ts`).
- E2E uses `astro dev` as a webServer, so SSR routes (`/api/contact`, `/api/request-access`) are exercised alongside prerendered pages. Tests intentionally hit empty payloads to verify the endpoints reject without leaking 5xxs.
- **Cloudflare's git auto-deploy still runs the production deploy.** CI verifies code quality; Cloudflare ships it. Don't add a deploy step to GitHub Actions unless we explicitly decide to take over deploys.
- If CI is failing locally and you can't reproduce, check `playwright-report/` (Playwright leaves an HTML report there on failure) and download the `playwright-report` artifact from the failed CI run.

### Tooling configs

- ESLint: `eslint.config.js` (flat config, ESLint 10) using `@eslint/js` + `typescript-eslint` + `eslint-plugin-astro`. Warnings allowed (e.g. `@typescript-eslint/no-explicit-any`); errors break the build. Ignores: `dist/`, `.astro/`, `.wrangler/`, `demos/`, `public/`, `playwright-report/`, `test-results/`.
- Prettier: `.prettierrc.json` (`prettier-plugin-astro`, single quotes, 100-char width). `.prettierignore` excludes `**/*.mdx` — Prettier's MDX parser mangles JSX comments (`{/* */}` → `{/\* \*/}`) and breaks the build. If you need to format a doc page, do it by hand or skip it.
- Playwright: `playwright.config.ts` boots `astro dev --host 127.0.0.1` on port 4321. Chromium-only in CI. Reports + traces upload as artifacts when tests fail.
- Astro check: `tsconfig.json` excludes `dist`, `demos`, `playwright-report`, `test-results`, `.wrangler`. The `cloudflare:workers` virtual module is declared in `src/env.d.ts`.

## Architecture

### Runtime model

- **Static + SSR hybrid** via `@astrojs/cloudflare` (`astro.config.mjs`). Most pages are static; routes that need runtime (`src/pages/api/*.ts`) opt in with `export const prerender = false` and execute on Cloudflare Workers (`compatibility_flags = ["nodejs_compat"]` in `wrangler.toml`).
- `trailingSlash: 'always'` and `build.format: 'directory'` — every internal link must end with `/`.
- Vite SSR is configured to resolve with `workerd`/`worker` conditions first, so server code must be Workers-compatible (no Node-only APIs unless `nodejs_compat` covers them).

### Pages and content

- **Marketing pages** are hand-authored `.astro` files under `src/pages/` (e.g. `features/`, `solutions/`, `compare/`, `blog/`, `contact.astro`, plus legal pages like `privacy.astro`, `terms.astro`, `cookies.astro`). The blog is also `.astro` files, not a content collection.
- **Docs** use [Starlight](https://starlight.astro.build) and live under `src/content/docs/` in two trees: `docs/` (product docs) and `api/` (developer docs). The Starlight sidebar is configured explicitly in `astro.config.mjs` — when adding a new top-level docs section, update both the directory and the `sidebar` array.
- **API reference** is generated by `starlight-openapi` from `public/openapi.json`. Re-export the OpenAPI from the main app and replace this file when the API changes; no manual MDX needed for endpoint pages.
- **Content collections** are wired in `src/content.config.ts` (single `docs` collection via Starlight's loader/schema). Don't add ad-hoc loaders.
- Shared chrome lives in `src/layouts/Layout.astro` and components under `src/components/` (Header, Footer, Hero, Pricing, CookieConsent, RequestAccessModal, …). The Starlight docs theme is customized via `src/styles/docs.css`.

### Server endpoints (`src/pages/api/`)

- `contact.ts` is the POST endpoint used by the marketing contact form. It follows this pattern, and any new form endpoint should match it:
  1. `export const prerender = false;`
  2. Read secrets from `env` imported from `cloudflare:workers` — never from `import.meta.env` for server-only secrets.
  3. Require and verify a Cloudflare Turnstile token (`verifyTurnstile` in `src/lib/brevo.ts`) before doing anything else; pull the visitor IP from the `CF-Connecting-IP` header.
  4. Run every user field through `sanitizeField()` (truncates per the `MAX_LENGTHS` map) and `isValidEmail()` before use.
  5. Rate-limit with `checkRateLimit()` (`src/lib/rate-limit.ts`) keyed by IP and email, returning `429` when over. It fails open (no-op) when the `RATE_LIMITER` binding is absent, so Turnstile + WAF remain the floor — see the `[[unsafe.bindings]]` ratelimit config in `wrangler.toml`.
  6. Send via Brevo using `sendEmail()`; build the body with `buildHtmlTable()` (which `escapeHtml`s every value). Don't hand-build HTML strings with user input.
  7. Return `Response.json({ success: true })` on happy path or `{ error: 'human message' }` with an appropriate status on failure. Log technical details with `console.error` — never leak them to the response.

### Configuration & environment

- **Public config** is read via `import.meta.env.PUBLIC_*` and centralized in `src/config.ts`. `src/env.d.ts` types the `PUBLIC_*` vars — when adding a new public env var, add it to both `src/env.d.ts` and `.env`, and prefer reading it through `src/config.ts` so defaults stay in one place.
- **Server-only secrets** (`BREVO_API_KEY`, `TURNSTILE_SECRET_KEY`) live in Cloudflare Worker env vars (set in the Cloudflare dashboard or via `wrangler`) and are accessed inside API routes only, via `import { env } from 'cloudflare:workers'`. They must never be referenced from `.astro` components, client scripts, or anything under `src/components/`.
- Starlight uses `loadEnv(..., 'PUBLIC_')` at build time to inject `PUBLIC_EMAIL_SUPPORT` into the social links — keep the `PUBLIC_` prefix on anything that needs to be available at config-evaluation time.
- The Cloudflare adapter is configured with `prerenderEnvironment: 'node'`, so the static prerender step runs under Node — but anything that runs at request time must work under Workers.

### Styling

- **Tailwind CSS v4** via `@tailwindcss/vite` (not the legacy `@astrojs/tailwind` integration). Global styles live in `src/styles/`. The Starlight theme is overridden in `src/styles/docs.css`.

## Project Tracking — GitHub Projects (CANONICAL)

> **Source of truth: GitHub Projects, not Obsidian.** As of 2026-05-11, all live tracking moved to GitHub. The Obsidian backlog and roadmap files remain in the vault as historical reference and breakdown notes, but they are **frozen** — do not edit them as part of task work, and do not trust their `pending` / `in-progress` statuses.

### Where things live

- **GitHub Project #2 — [BuildWorkPro Backlog](https://github.com/users/ivan-ordaz/projects/2):** all tactical work
  - 188 items as real GitHub issues across `buildworkpro`, `buildworkpro-mobile`, `buildworkpro-marketing`
  - Marketing-related items are tracked here as issues in the `buildworkpro-marketing` repo
  - Fields: Priority (P0–P3), Status, Order, Type, Completed Date, Repository (auto), **Execution Mode**
  - **Execution Mode** classifies what's blocking each item: `Agent-Ready` (dispatchable now), `Needs Input` (user decision required), `Needs Mockup` (brainstorm + design approval first), `Needs Testing` (requires user validation in real env). Use this to filter "what can I send to agents right now"
  - Title format: `#N — request` where `N` is the original Obsidian backlog row number (preserved for cross-reference)

- **GitHub Project #3 — [BuildWorkPro Roadmap](https://github.com/users/ivan-ordaz/projects/3):** strategic features
  - 26 items as issues in `ivan-ordaz/buildworkpro` (#173–198), labeled `roadmap`
  - Fields: Horizon (Now/Next/Later/Someday/Shipped/Cut), Theme, Status, Target, Owner, Backlog Links, Completed Date
  - Title format: `R#N — feature` where `N` is the original Obsidian roadmap row number
  - Backlog items are linked as **sub-issues** of their roadmap parent (GitHub native; one parent per child)

- **Obsidian (vault, reference only):** `/Users/ivan/obsidian-vault/claude-brain/`
  - `Projects/BuildWorkPro.md` — project overview (still maintained)
  - `Backlogs/BuildWorkPro.md` — **frozen on 2026-05-11**, has banner; useful for full breakdown text
  - `Roadmaps/BuildWorkPro.md` — **frozen on 2026-05-11**, has banner; useful for Feature Details
  - `Sessions/`, `Decisions/`, `Patterns/` — still active for memory & history

### Workflow rules

| Action                                    | Where to do it                                                                              |
| ----------------------------------------- | ------------------------------------------------------------------------------------------- |
| Check what's pending / in-progress / done | GitHub Project #2                                                                           |
| Check the strategic roadmap               | GitHub Project #3                                                                           |
| Update status, priority, horizon          | GitHub Project field (via `gh project item-edit` or GraphQL)                                |
| Add a new backlog ticket (marketing work) | New issue in `buildworkpro-marketing` + add to Project #2; do NOT touch Obsidian            |
| Add a new roadmap item                    | New issue in `buildworkpro` with `roadmap` label + add to Project #3; do NOT touch Obsidian |
| Read full breakdown / Feature Details     | The issue body (migrated from Obsidian); fall back to Obsidian if needed                    |
| Log a session, decision, or pattern       | Obsidian (still the brain)                                                                  |

### Marketing item classification (where does this work belong?)

Before opening any issue, decide which repo it lives in. Repo == "where the code change happens":

- **`buildworkpro-marketing`** (this repo): anything on the public marketing/docs surface — `buildworkpro.com` pages, blog posts, docs site, API reference, marketing-side analytics, the OpenAPI sync from the main app, marketing CTAs, contact / sales / signup-redirect flows that originate here.
- **`buildworkpro`** (main app): app signup/auth flow (`Signup.tsx`, `/api/auth/*`, `/api/config/public`), billing, in-app SEO (`useDocumentTitle`, `client/index.html` meta), public-signup abuse mitigation, anything the user only sees once they're logged in.
- **`buildworkpro-mobile`**: anything that ships in the React Native app.

If an item touches both surfaces (e.g. "marketing CTA points at app signup"), open it in the repo where the **primary code change** lives and link the dependency in the body. The "Marketing site signup flow" item (#191, issue [`buildworkpro-marketing#5`](https://github.com/ivan-ordaz/buildworkpro-marketing/issues/5)) is the canonical example: lives in `buildworkpro-marketing` because the code change is here; references main-app prerequisites (`signupEnabled` flag, `#159` abuse mitigation) in Dependencies.

### Recipe — add a new marketing backlog item

When you need to add tactical work for this repo:

```bash
# 1. Make sure gh is the right user
gh auth status | grep -A1 'ivan-ordaz' | head -1   # must say "Active account: true"

# 2. Find the next backlog number (max across all repos in Project #2, then +1)
gh project item-list 2 --owner ivan-ordaz --limit 200 --format json \
  | jq -r '[.items[].title | capture("^#(?<n>[0-9]+) ") | .n | tonumber] | max'

# 3. Write the issue body to a temp file. Follow the existing format:
#    blockquote with Priority/Status/Type/Execution Mode, then Request,
#    Outcome (optional), Actionable Items (checkboxes), Dependencies, Notes.

# 4. Create the issue in this repo
gh issue create --repo ivan-ordaz/buildworkpro-marketing \
  --title "#<NEXT_N> — <short request>" \
  --body-file /tmp/issue-body.md

# 5. Add to Project #2 and capture the project item ID
ISSUE_NODE_ID=$(gh issue view <ISSUE_NUMBER> --repo ivan-ordaz/buildworkpro-marketing --json id --jq '.id')
ITEM_ID=$(gh api graphql -f query='
  mutation($project: ID!, $issue: ID!) {
    addProjectV2ItemById(input: {projectId: $project, contentId: $issue}) { item { id } }
  }' -f project="PVT_kwHOAfx2oc4BXaGw" -f issue="$ISSUE_NODE_ID" \
  --jq '.data.addProjectV2ItemById.item.id')

# 6. Set the fields. IDs are in ~/.claude/projects/-Users-ivan-buildworkpro/memory/github_project.md
#    Reuse the helper inline (see commit 2c3d71d / the existing CI-setup session for the
#    five updateProjectV2ItemFieldValue calls — Status, Priority, Type, Execution Mode, Order).
```

After creation, link backlog items to a roadmap parent (`addSubIssue` mutation in the github_project memory file) **only** if the work rolls up to a strategic theme. Most marketing items are standalone and stay parent-less.

### Breakdown flow (roadmap → backlog tickets)

When you say "break down R#N":

1. I read the roadmap issue body (Feature Details: problem, outcome, approach, sync matrix, open questions, dependencies, isolation rules)
2. I propose a granular task list — typically 10–20 tickets covering schema, infra, per-object work, UX, tests, rollout
3. After approval, I create each task as a real issue in the appropriate repo (marketing tasks → `buildworkpro-marketing`), add it to Project #2, and set its parent to the roadmap issue
4. The roadmap issue's progress bar + sub-issue list updates automatically

### Field IDs and IDs

See the memory file at `~/.claude/projects/-Users-ivan-buildworkpro/memory/github_project.md` for all project IDs, field IDs, single-select option IDs, and repo node IDs needed for `gh api graphql` updates.

### Auth requirement

`gh` must be active as `ivan-ordaz` (not `merlinx29`) with `project` and `read:project` scopes. Switch with `gh auth switch --user ivan-ordaz` if needed.

See `~/.claude/CLAUDE.md` for the global Claude Brain workflow (which still applies for Sessions/Decisions/Patterns). Note that the global instructions list this repo's backlog under `BuildWorkPro` (Project #2), not a separate `BuildWorkProMarketing` backlog — the per-project override above takes precedence.
