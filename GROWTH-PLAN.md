# BuildWorkPro Marketing — Aggressive Growth Plan

_Owner: Ivan · Started 2026-06-10 · Not published (repo-root reference doc)_

## Situation

- Domain ranks for ~zero keywords (GSC: every query on page 4+, 1–19 impressions, ~0 clicks). Pure greenfield.
- Strong bottom-funnel pages now exist (features, solutions, compare) — fact-checked, FAQ schema, demo videos (PRs #58–60).
- What's missing: **topical authority and links**. Bottom-funnel pages can't rank without an informational content base pointing at them, and the domain has no backlink profile.

## Strategy

Build topical authority fast with two content tracks, amplify with video, funnel everything to the money pages, and run a small paid-social test for immediate traffic while SEO compounds.

### Track 1 — Authority / how-to posts (2/week)

Higher-volume informational queries subs actually search. Each post: fact-checked against the app docs, embeds a demo video, carries FAQ schema, and links down to the relevant feature page.

Backlog (net-new, no overlap with the existing 6 posts):

1. How to Create a Schedule of Values (+ what to include) → pay-applications _(week 1)_
2. Construction Markup vs. Margin: How to Price a Job → construction-bidding _(week 1)_
3. Retainage in Construction: How It Works & How to Track It → pay-applications
4. Construction Lien Waivers Explained (conditional vs. unconditional) → pay-applications
5. How to Read Construction Plans & Do a Takeoff → construction-bidding
6. Construction Daily Report: What to Include (+ template) → site-logs
7. Bid Bonds vs. Performance Bonds: A Sub's Guide → construction-bidding
8. Prevailing Wage & Certified Payroll Basics → time-tracking
9. Punch List Management for Subcontractors → project-management
10. Construction Project Closeout Checklist → project-management

### Track 2 — Free tools / templates (link magnets, ~1 per 2 weeks)

Rank for "[x] template" and earn links. Each embeds a video + links to the matching feature.

- Schedule of Values template · Change Order template · Daily Log template · Bid Proposal template · Markup calculator

### Target keywords (verified vol / KD, US)

| Keyword                                   | Vol                  | KD  | Target page                        |
| ----------------------------------------- | -------------------- | --- | ---------------------------------- |
| construction crm                          | 880                  | 12  | /features/construction-crm/        |
| electrical estimating software            | 1,300                | 19  | /solutions/electrical-contractors/ |
| aia pay application                       | 880                  | 0   | /blog/aia-pay-application-guide/   |
| construction bidding software             | 2,900                | 42  | /features/construction-bidding/    |
| construction time tracking software       | 720                  | 20  | /features/time-tracking/           |
| aia billing software                      | 320                  | 0   | /features/pay-applications/        |
| construction software for small business  | 260                  | 0   | /                                  |
| subcontractor project management software | 210                  | 12  | /features/project-management/      |
| procore alternative                       | 210                  | 0   | /compare/procore-alternative/      |
| construction daily log software           | 90                   | 0   | /features/site-logs/               |
| schedule of values (+ template)           | low vol, high intent | —   | /blog SOV post → pay-applications  |

Priority = KD 0–20 first (winnable), high-KD head terms earned over time via the authority base.

## Automation (scheduled Claude Code routines)

1. **Content generation — 2×/week.** Drafts the next calendar item (fact-checked, with a demo video), runs the full CI suite, opens a PR. **Publishing model: draft → PR for human review** (merge = deploy). Protects against AI-slop regressions.
2. **Weekly SEO review.** Pulls GSC (clicks/impressions/position deltas), indexing health, ranked-keyword movement → short report + reprioritized "write next" list. _Caveat: depends on the local seo-tools MCP, which a headless cloud cron can't reach; runs in a local/triggered context (see routine notes)._

## Paid social — Meta (test)

- **Budget:** $10/day (~$300/mo) to start.
- **Setup:** repurpose the defunct Meta business profile → clean Facebook Page → ad account → Meta Pixel on the marketing site (consent-gated like GA4) → drafted campaign (retargeting + cold traffic to best-converting pages).
- **Guardrails:** I set everything up but **stop before spend**; billing entry, CAPTCHAs, and final launch are the user's. Pixel respects Consent Mode v2 (loads only after analytics consent).

## KPIs (review weekly)

- Indexed pages (GSC) — climbing from 44.
- Impressions & clicks (GSC) — first real clicks are the leading signal.
- Keywords ranked in top 20, then top 10 (DataForSEO).
- Contact-form leads (now SendGrid-tracked) + Meta Pixel Lead events.
- Paid: CPC, landing-page CTR, cost per lead.

## Status log

- 2026-06-10: Plan approved (draft→PR, $10/day, Meta setup-no-spend, 2 posts/wk). Week-1 posts + routines + Meta setup in progress.
- 2026-06-16: Drafted Track 1 post #3 — "Retainage in Construction: How It Works & How to Track It" (`/blog/retainage-construction-guide/`). All checks pass (format, lint 0 errors, typecheck 0 errors, build). PR opened on branch `content/retainage-construction-guide`.
- 2026-06-23: Drafted Track 1 post #4 — "Construction Lien Waivers Explained: Conditional vs. Unconditional" (`/blog/construction-lien-waivers-explained/`). All checks pass (format, lint 0 errors, typecheck 0 errors, build; E2E skipped — Chromium download blocked in remote environment). PR opened on branch `content/construction-lien-waivers-explained`.
- 2026-06-30: Drafted Track 1 post #5 — "How to Read Construction Plans & Do a Takeoff" (`/blog/how-to-read-construction-plans-takeoff/`). All checks pass (format, lint 0 errors, typecheck 0 errors, build; E2E skipped — Chromium browser version mismatch in remote environment, pre-existing). PR opened on branch `content/how-to-read-construction-plans-takeoff`.
- 2026-07-24: Drafted Track 1 post #6 — "Construction Daily Report: What to Include (+ Template)" (`/blog/construction-daily-report-guide/`). All checks pass (format, lint 0 errors, typecheck 0 errors, build; E2E skipped — Chromium headless-shell version mismatch in remote environment, pre-existing). PR opened on branch `content/construction-daily-report-guide`.
