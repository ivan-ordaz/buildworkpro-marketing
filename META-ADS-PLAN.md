# Meta Ads — Launch Plan (BuildWorkPro)

_Not published (repo-root reference). Created 2026-06-10. Status: infra built, awaiting billing + launch._

## Assets created (Meta Business Suite)

- **Business portfolio:** Buildworkpro — ID `997660364713364` (repurposed from the old Eikon Solutions profile; legal name kept as Eikon Solutions LLC per decision)
- **Facebook Page:** Buildworkpro — asset ID `61590378945993`, category Software Company
- **Ad account:** BuildWorkPro Ads — ID `1941878143198061` (USD, America/New_York — both locked)
- **Pixel / dataset:** "First FB Ad" — ID `689268612776537` (reused; now installed on the marketing site, consent-gated)

## What's left before ads can run (user actions — I can't do these)

1. **Add a payment method** to the ad account (Billing). Entering payment details is the user's action.
2. **Verify the business** (optional now, needed later for scale / special categories).
3. Approve and launch the campaign below.

## Pixel status

Installed on buildworkpro.com via `Layout.astro`, loaded only after the visitor accepts analytics/advertising cookies (same Consent Mode gate as GA4). Fires **PageView** on every page and **Lead** on a successful contact-form submit. Once the pixel receives traffic, build a **Custom Audience** = all site visitors (180 days) for retargeting, and a **Lookalike** from Lead events once there are enough.

## Campaign structure (start: $10/day)

Start lean — one campaign, two ad sets, to learn which audience converts before scaling.

- **Objective:** Traffic or Leads (start with **Traffic → landing page views** to drive cheap qualified clicks to the site; switch to **Leads/Conversions** optimized for the Pixel `Lead` event once it has ~15–30 events/week).
- **Campaign budget (CBO):** $10/day total.
- **Ad set A — Cold interest (60%, ~$6/day):**
  - Geo: United States. Age 28–60. Gender: all.
  - Detailed targeting: interests/job titles — _subcontractor, general contractor, construction management, Procore, electrician, plumber, HVAC contractor, roofing contractor, construction estimating_. Narrow to small-business owners where possible.
  - Placements: Advantage+ (let Meta optimize) for the test.
- **Ad set B — Retargeting (40%, ~$4/day):** site visitors (Custom Audience, 180 days) — turn on once the Pixel has audience size ≥ ~300. Until then, put the full $10 on Ad set A.
- **Landing pages:** rotate the best-converting money pages — `/compare/procore-alternative/`, `/features/pay-applications/`, and the homepage `/`. Use UTM tags (e.g. `?utm_source=meta&utm_medium=paid&utm_campaign=launch&utm_content=adA1`).

## Ad creative (3 variations to test)

All link to the relevant landing page; primary image/video = the product demo (`/videos/product-tour.mp4`) or a clean dashboard screenshot. CTA button: **Learn More** (or **Sign Up** for the trial angle).

**Ad 1 — Price/positioning (→ /compare/procore-alternative/)**

- Primary text: "Procore quotes you thousands a year. BuildWorkPro is $79/month flat — bids, AIA-style pay apps, change orders, and crews, built for subcontractors. Unlimited users. 14-day free trial, no credit card."
- Headline: "Construction software for subs — $79/mo flat"
- Description: "The Procore alternative built for subcontractors."

**Ad 2 — Pain/billing (→ /features/pay-applications/)**

- Primary text: "Still building pay applications in Excel? BuildWorkPro turns your schedule of values into a monthly pay app with retainage in minutes — prefilled from your bid and approved change orders. Get paid on time, every period."
- Headline: "Pay apps without the end-of-month scramble"
- Description: "AIA-style progress billing for subcontractors."

**Ad 3 — All-in-one (→ / )**

- Primary text: "Bid it, build it, bill it. BuildWorkPro runs the whole subcontractor workflow — estimating, scheduling, daily logs, time tracking, and AIA-style billing — in one place for $79/month. Try it free for 14 days."
- Headline: "One app to run your subcontracting business"
- Description: "Bids, projects, pay apps & crews. No per-user fees."

## First-week playbook

1. Launch Ad set A with all 3 ads at $10/day.
2. After ~3–4 days, pause the weakest ad (lowest landing-page-view rate / highest CPC).
3. Once the Pixel has audience size, enable Ad set B (retargeting) and rebalance budget.
4. Watch: CPC, landing-page CTR, cost per Lead (Pixel), and GA4 paid sessions. Target a cost-per-trial-signup you can sustain against $79/mo (and annual LTV).
5. Scale the winner before adding new angles.
