# buildworkpro-marketing

Marketing + docs site for [BuildWorkPro](https://buildworkpro.com). Astro 6 + Starlight, deployed to Cloudflare (Workers/Pages) via `@astrojs/cloudflare`.

> Separate repo from the main SaaS app at `/Users/ivan/buildworkpro/`. Each has its own `package.json`, git remote, and deploy.

## Requirements

- Node.js **>= 22.12.0** (Astro 6 requirement)
- npm

## Commands

| Command                | Action                                            |
| :--------------------- | :------------------------------------------------ |
| `npm install`          | Install dependencies                              |
| `npm run dev`          | Start local dev server at <http://localhost:4321> |
| `npm run build`        | Build production site to `./dist/`                |
| `npm run preview`      | Preview the built site locally                    |
| `npm run check`        | `astro check` — type-check Astro + TypeScript     |
| `npm run lint`         | ESLint                                            |
| `npm run lint:fix`     | ESLint with `--fix`                               |
| `npm run format`       | Prettier write                                    |
| `npm run format:check` | Prettier check (this is what CI runs)             |
| `npm run test:e2e`     | Playwright smoke tests against the dev server     |
| `npm run test:e2e:ui`  | Playwright interactive UI mode                    |

Run the full CI suite locally before opening a PR:

```sh
npm run check && npm run lint && npm run format:check && npm run build && npm run test:e2e
```

## Branch policy

`main` is **PR-only and protected**. Direct pushes are rejected by GitHub. Open a feature branch and a pull request — the required `CI` status check must pass before you can merge.

See [`CLAUDE.md`](./CLAUDE.md) for the full architecture overview, tooling configs, and CI policy.

## Deployment

Production deploys are handled by **Cloudflare's git integration** on push to `main`. GitHub Actions only verifies code quality; it does not deploy.

## Project tracking

Work for this repo lives in **GitHub Projects**, not in Obsidian or the codebase:

- [BuildWorkPro Backlog (Project #2)](https://github.com/users/ivan-ordaz/projects/2) — tactical work. Marketing-site items are real issues in this repo (`ivan-ordaz/buildworkpro-marketing`) and rolled up under Project #2 alongside main-app and mobile work.
- [BuildWorkPro Roadmap (Project #3)](https://github.com/users/ivan-ordaz/projects/3) — strategic features. Marketing work is rarely a roadmap item by itself; it usually rolls up under a strategic theme owned by the main app.

To open a new ticket for marketing work, create the issue in this repo and add it to Project #2. The full recipe (gh commands, field IDs, classification rules for marketing vs main-app vs mobile) is in [`CLAUDE.md`](./CLAUDE.md#project-tracking--github-projects-canonical).
