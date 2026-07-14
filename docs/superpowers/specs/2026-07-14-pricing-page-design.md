# /pricing page — design

**Date:** 2026-07-14
**Status:** approved (Ivan picked direction A; nav points at the new page)

## Problem

Pricing exists only as a section on the home page (`#pricing`). There has never been a `/pricing/` route, so everyone arriving from outside — typing the obvious URL, following a search result, clicking an ad — got a **404**. Nothing on the site linked there, which is why it went unnoticed for so long.

A 301 to `/#pricing` shipped as an immediate stop-gap (marketing PR #104). This spec replaces that stop-gap with a real page.

## Goal

A standalone `/pricing/` page that:

1. can be linked, ranked, and used as an ad landing page;
2. answers the questions people leave over (what happens on day 15, do you charge per user, can I cancel);
3. stays attributable — a visitor landing here from an ad must still reach signup with their click id intact.

## Non-goals

- **No founding-contractor offer.** Ivan explicitly chose the standard $79 plan only; publishing the $49 founding offer would commit him to a scarcity claim he has not approved.
- **No billing or Stripe change.** The annual toggle is presentation only.
- **No new design language.** This page uses the existing components and tokens.

## The plan being presented (real, unchanged)

$79/month, or $790/year (two months free, $65.83/month effective). 14-day trial, no credit card, cancel anytime. One tier; nothing locked behind an upgrade. Unlimited users, projects, and contacts, plus the 16 included features already listed in `Pricing.astro`.

## Design

### Route

`src/pages/pricing.astro` → `/pricing/` (site is `trailingSlash: 'always'`).

**The `/pricing/` 301 in `astro.config.mjs` MUST be removed in the same change.** A redirect and a real page cannot both own the URL; if the redirect survives, the new page is unreachable. This is the one ordering hazard in the whole change.

### Composition (top to bottom)

`<Header>` → eyebrow + headline → monthly/annual toggle → price card (16 features, CTA) → pricing FAQ → `<CTA>` → `<Footer>`.

### Shared plan data

The price and the 16 feature bullets move into one shared module (`src/data/plan.ts`) imported by **both** the home-page `Pricing.astro` section and the new page. Two hand-maintained copies of a price is how a site ends up advertising two different numbers.

The home `#pricing` section stays as it is — it converts on the scroll path.

### Two things inherited for free

- **Attribution.** The CTA renders `config.signupUrl`, so the passthrough from marketing PR #103 decorates it exactly like every other CTA. A visitor who lands on `/pricing/` from an ad reaches signup with their `fbclid`/UTMs intact. Using a hard-coded `/signup` href here would silently break that — the test asserts `config.signupUrl`.
- **Conversion analytics.** `Layout.astro` fires `ViewContent` / `view_pricing` via an IntersectionObserver on `#pricing`. Giving the price card wrapper `id="pricing"` makes the page emit the same event with zero new analytics code.

### FAQ

Billing-specific questions, **deliberately different** from the home FAQ's, so we do not publish duplicate `FAQPage` markup on two URLs:

- What happens when the 14 days are up?
- Do you charge per user?
- Can I cancel anytime?
- Is anything locked behind a higher tier?

`FAQ.astro` already emits `FAQPage` JSON-LD; the page reuses that mechanism.

### Navigation

Header nav "Pricing" (desktop + mobile, both in `Header.astro`) points at `/pricing/` instead of `/#pricing`. Internal links are what let the page rank; without them it is an orphan.

## Testing (red-first)

`tests/pricing-page.spec.ts`:

- `/pricing/` returns 200 and renders the headline and `$79`
- the annual toggle switches the displayed figure to `$790`
- the trial terms render (14-day, no credit card)
- **the CTA points at `config.signupUrl`** — guards the attribution decoration
- the pricing FAQ renders
- the header nav links to `/pricing/`

`tests/pricing-redirect.spec.ts` is **deleted** — the redirect it asserts is being removed, and a passing redirect test alongside a real page would be a lie.

## Risks

- **Redirect vs page collision** — covered above; the page test would fail loudly if the redirect survived.
- **Merge order** — this change is built on top of marketing PR #104 (which introduced the redirect). #104 should land first.
- The bare `/pricing` (no trailing slash) remains Cloudflare's trailing-slash normalization, which `astro dev` does not reproduce. Unchanged by this work; verify on the deployed site.
