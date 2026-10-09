# Marketing Capture Kit

Prompt-driven screenshots and videos of the **BuildWorkPro app**, for marketing
and docs. You describe a scene; I (Claude) write or extend a scene file; the kit
auto-logs into your local app, drives the UI, and drops `.png` / `.mp4` into
`output/`.

It uses Playwright in library mode (no extra deps — `@playwright/test` and
Chromium are already installed for the site's e2e tests). It drives the **main
app** dev server, not the marketing site.

## Prerequisites

1. The main app running locally: in `/Users/ivan/buildworkpro/` run
   `npm run dev:services` then `npm run dev` (serves `http://localhost:7782`).
2. The local DB seeded with demo data (`npm run db:seed` in the main app).
   Marketing assets must only ever show the seeded **Comfort Climate HVAC**
   tenant — never a prod clone.
3. `doppler` authenticated for `buildworkpro`/`dev` (used to read the seed
   password), or set `DEV_SEED_PASSWORD` in your environment.
4. `ffmpeg` on PATH for `.webm → .mp4` (optional; `.webm` is kept regardless).

## Usage

```bash
# from the marketing repo root
node marketing-capture/run.mjs --list           # list scenes
node marketing-capture/run.mjs dashboard-shots  # retina screenshots
node marketing-capture/run.mjs product-tour     # animated-cursor video
```

Output lands in `marketing-capture/output/` (gitignored). Copy the assets you
want into `public/` (e.g. `public/docs-screenshots/...`) deliberately.

### Env overrides

| Var | Default | Purpose |
| --- | --- | --- |
| `CAPTURE_BASE_URL` | `http://localhost:7782` | main app URL |
| `CAPTURE_USER` | `rmoreno` | seed login (company_admin) |
| `CAPTURE_TENANT` | `Comfort Climate` | tenant name hint |
| `CAPTURE_OUT` | `./output/` | output directory |
| `CAPTURE_HEADFUL` | _(unset)_ | set to watch the browser run |
| `DEV_SEED_PASSWORD` | _(via Doppler)_ | seed password override |

## Writing a scene

Create `scenes/<name>.<shots|video>.mjs`:

```js
export const meta = { name: 'create-bid', video: true, viewport: 'desktop' };

export default async function scene({ goto, click, type, moveTo, scrollTo, shot, wait }) {
  await goto('/bids/new');
  await type('#title', 'Downtown Office HVAC Retrofit');
  await click('button:has-text("Add line item")');
  await shot('bid-editor'); // only meaningful in shots scenes
}
```

Helpers passed to every scene: `goto(path)`, `click(target)`, `type(target, text)`,
`moveTo(target)` / `hover`, `scrollTo(y)`, `wait(ms)`, `shot(name, {fullPage})`,
`page` (raw Playwright Page), `log`. `target` is a CSS selector string or a
Playwright locator.

- `video: true` → records an `.mp4` with the on-screen animated cursor and keeps
  page animations.
- `video: false` (shots) → freezes animations for crisp stills; use `shot()`.
  `viewport: 'hd', scale: 1` shoots the 1920x1080 marketing screenshots in
  `public/screenshots/`.

Also passed: `choose(trigger, optionText, { search })` for shadcn selects and
cmdk pickers, `waitFor(target, timeout)`, and `data` (see setup below).

### Demo videos must finish the action

A demo that opens a dialog, hovers the Save button and stops reads as a blank
form — that is how the 2026-06 takes shipped. Every video scene should:

1. **Set `meta.strict: true`.** `click`/`moveTo`/`type` then throw on a missing
   target instead of logging and carrying on, so a renamed button fails the run
   instead of producing a video of the cursor hovering nothing.
2. **Stage its own records in `setup`.** `export async function setup({ api, log })`
   runs after login and before the recorded page opens; `api` is an
   authenticated JSON client (`get/post/put/patch/del` against the app's
   `/api/...` routes, CSRF handled). Create the draft change order, submitted
   pay app, etc. that the scene acts on, and clean up what earlier runs left,
   so every take is reproducible. Whatever `setup` returns is `ctx.data`.
3. **End on the result** — the saved record, the new status, the updated
   totals — not on the form.
4. **Keep the data coherent.** `lib/demo-data.mjs` rewrites the seed's
   randomly-paired site logs into real entries; the `lib/demo-*.mjs` helpers
   do the same for their areas.

Never let a scene email a real address: dev runs with a live SendGrid key. Use
`example.com` or a seeded demo domain (`server/lib/email/undeliverable.ts` in
the main app), which the transport drops.

### Publishing a take

```bash
node marketing-capture/publish.mjs site-log-create        # poster from the end state
node marketing-capture/publish.mjs pipeline-demo 6.5      # poster from 6.5s in
node marketing-capture/publish.mjs lead-convert --from 1  # drop the 1s page-load flash
```

Copies `output/<scene>.mp4` to `public/videos/` and cuts
`public/videos/<scene>-poster.jpg`.

## How auth works

Login goes through the JSON API with a dummy Turnstile token (local dev wires the
Cloudflare *test* secret, which always passes), so we never depend on the widget.
`rmoreno` has a single tenant, so it's auto-selected on login. See `lib/auth.mjs`.
