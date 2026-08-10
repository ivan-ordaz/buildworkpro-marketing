# BuildWorkPro Demo Video Scripts

_Repo-root reference doc (like GROWTH-PLAN.md / META-ADS-PLAN.md), not published. Created 2026-08-10 from the marketing sweep. Owner: Ivan._

Five scripts, ordered by leverage. Each is written for **you filming a screen recording with voiceover** — talking-head is optional everywhere (a 5-second face intro boosts trust but nothing requires it). Any of these can later be converted to the automated `demos/` pipeline (JSON scenes) if you'd rather regenerate them robotically.

**Why these five (from the sweep data):**

| #   | Video                                  | Why it wins                                                                                                                                       | Where it goes                                                                                        |
| --- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1   | AIA-style pay app in under 10 minutes  | The **unclaimed ad angle** — no competitor advertises pay apps as the hook; targets the ~7,100/mo KD≤3 G702/G703 cluster with how-to video intent | YouTube + `/features/pay-applications/` embed + future `/templates/aia-g702-g703/` + 45s Meta ad cut |
| 2   | The $79 math (price positioning)       | Pure ad creative for the angle that's already running; giants gate pricing — arithmetic is the weapon                                             | Meta ads (3 hook variants) + `/pricing/` embed                                                       |
| 3   | Bid → signed contract (e-signatures)   | The differentiator competitors charge $10–40/user/mo extra for; currently invisible on money pages                                                | YouTube + `/features/construction-bidding/` + compare pages                                          |
| 4   | Schedule of values explained           | 1,900/mo KD0 head term; existing SOV guide post needs the video; feeds the template page                                                          | YouTube + `/blog/schedule-of-values-guide/` + `/templates/schedule-of-values/`                       |
| 5   | Change order that protects your margin | 1,000/mo KD0 template cluster; "a verbal OK is not a change order" is your best copy line already                                                 | YouTube + `/features/change-orders/` + `/templates/change-order/`                                    |

**Filming order for limited hours:**

- **Session 1 (one afternoon):** Upload the two ALREADY-PRODUCED videos (`demos/output/02-create-bid/final.mp4`, `03-manage-project/final.mp4` — metadata is pre-written in `demos/youtube-metadata.md`, paste IDs into `src/data/productVideos.ts`). Then film Script 1. That single session activates the dead embeds, starts the channel, and produces the flagship.
- **Session 2:** Scripts 2 + 3 (short).
- **Session 3:** Scripts 4 + 5.

---

## One-time prep (~45 min, do before Session 1)

1. **Demo tenant:** film in the seeded demo org (Comfort Climate HVAC / rmoreno on local dev, or Volt Pro Electric for trade variety). Local dev: `npm run dev:services && npm run dev`, log in as `rmoreno` with the Doppler `DEV_SEED_PASSWORD`.
2. **Fix the seed-data tells first** (the visual audit found these in the current marketing screenshots — don't re-capture them into video): dashboard KPI cards showing three "+100%" and a "+642%" pipeline delta; "Submit permit application" appearing 3× across phases in the electrical Gantt; floating blue "?" help buttons visible. Hide the help widget while recording.
3. **Recording setup:** 1440×900 browser window (matches existing videos), 100% zoom, clean profile (no extensions/bookmarks bar), OS notifications off. QuickTime or Screen Studio. Record voice separately if easier — the existing videos' pace is ~140 wpm, casual.
4. **Rhythm:** record scene-by-scene (each scene below is one take). Cut on scene boundaries. Don't chase perfection — competitors' videos are polished and corporate; yours being a real contractor's voice IS the differentiator.
5. **Every video ends the same:** "Try it free for 14 days at buildworkpro dot com. No credit card, no demo call, every feature." (consistent CTA = consistent ad cuts).

---

## Script 1 — FLAGSHIP: "Build an AIA-Style Pay Application in Under 10 Minutes"

**Runtime:** 6–7 min · **Also produces:** 45s ad cut (scenes 1, 5, 7, 9) · **Prereq:** demo project with an accepted bid and 1–2 approved change orders, plus one prior pay app on a _different_ project so the list isn't empty.

**The hook logic:** every sub knows the end-of-month G702 scramble. No competitor leads with this. Say the pain in trade vocabulary and show the whole thing happening faster than they believe possible.

| #   | Scene           | You say (narration)                                                                                                                                                                                                                                                                                                                                               | You do (on screen)                                                                                                                                                                 |
| --- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Cold open       | "If you bill GCs, you know the end-of-month scramble: dig out the schedule of values, figure out what you billed last period, hand-fill a G702, do the retainage math, hope nothing's off. In BuildWorkPro that whole thing takes about ten minutes. Watch."                                                                                                      | Dashboard visible, then click **Pay Apps** in the sidebar.                                                                                                                         |
| 2   | The list        | "This is Pay Apps. Every application across every project — the number, the status, the billing period, what's due, and what you've completed to date. Drafts, submitted, approved, paid — all in one place."                                                                                                                                                     | Sweep cursor down the pay apps list; hover the status filter.                                                                                                                      |
| 3   | Create          | "New pay app. Pick the project — a pay app always bills against one project. Set the billing period. And here's the first thing you never have to look up again: the original contract sum and the change-orders total prefill from the accepted bid and the approved change orders. Retainage defaults to ten percent — set whatever your contract says."        | Click **New Pay App** → pick project → set **Period Start/End** → point cursor at prefilled **Original Contract Sum** and **Change Orders Total** → **Retainage %**. Click create. |
| 4   | Auto-numbering  | "It numbers itself — project number, PA-oh-oh-one, incrementing per project. Your GC's accounting team will love you."                                                                                                                                                                                                                                            | Point at the generated pay app number on the detail page.                                                                                                                          |
| 5   | The SOV         | "Here's the schedule of values. On the first pay app it seeds from your approved change orders, and every one after carries forward from the last — scheduled value, what you billed in previous apps, and that previous column is locked, so history never silently changes."                                                                                    | Scroll the **Schedule of Values** card; point at **Scheduled Value**, **Previous Apps** columns.                                                                                   |
| 6   | Bill the period | "Billing this period is just: how much of each line did we finish. Rough-in's at sixty percent, so I'll bill this much... and we've got material on site that's not installed yet — that goes in Materials Stored, so you get paid for it without calling it complete."                                                                                           | Enter **This Period** on 2–3 lines; enter **Materials Stored** on one line.                                                                                                        |
| 7   | The rollup      | "And the math is just... done. Total to date, per line. Grand total. Retainage held at ten percent. Amount due this period. No spreadsheet, no calculator, no 2 a.m. reconciliation."                                                                                                                                                                             | Point down the **Total to Date** column → **Grand Total** row → payment summary (retainage, amount due).                                                                           |
| 8   | Approval + PDF  | "Submit it for approval — draft, submitted, approved, paid, the whole trail is tracked. And the PDF is the document your GC actually expects: continuation sheet, retainage, signatures."                                                                                                                                                                         | Click through submit; open the PDF preview and scroll it slowly.                                                                                                                   |
| 9   | Close           | "That's a full AIA-style pay application in under ten minutes — and next month, it carries everything forward and you only enter what you finished. BuildWorkPro is seventy-nine dollars a month flat, unlimited users, and pay apps are included — not an add-on. Try it free for 14 days at buildworkpro dot com. No credit card, no demo call, every feature." | Back on the pay app; end card (reuse the demos/ outro style).                                                                                                                      |

**YouTube metadata** (follow `demos/youtube-metadata.md` conventions):

- Title options (≤70ch): "How to Build an AIA-Style Pay Application in 10 Minutes" / "AIA Pay Application (G702-Style) Walkthrough for Subcontractors"
- Description: lead with the pain + what's shown; chapters per scene; links to `/features/pay-applications/`, `/blog/aia-pay-application-guide/`, trial CTA. Note: use "AIA-style" wording (AIA is trademarked — same care the feature page already takes).
- Tags: aia pay application, g702, g703, schedule of values, pay application software, aia billing, progress billing, retainage, construction billing, subcontractor software, BuildWorkPro

**45s ad cut:** scene 1 (hook, tightened) → scene 6 (10s) → scene 7 (10s) → scene 9 close. Caption-first edit (85% of FB video is watched muted — burn in subtitles).

---

## Script 2 — AD CREATIVE: "The $79 Math" (60–90s, three hook variants)

**Runtime:** 60–90s · **Format:** talking head preferred for this one (it's a trust pitch), screen b-roll behind the math. If no face: screen + bold text cards.

**Film the body ONCE, film three 8-second hooks, ship three ads:**

- **Hook A (Procore):** "Procore quoted you how much? Their own reviewers call it overkill under five million in revenue."
- **Hook B (per-user math):** "Every 'affordable' construction software has an asterisk: per user, per month. Do the math for your crew."
- **Hook C (no demo call):** "You shouldn't need a demo call, a sales rep, and a custom quote to try software."

**Body (same for all three):**

> "Here's the honest math for a five-person crew. JobTread: about two-eighty a month — and there's no free trial, you pay before you touch it. Knowify: two-fifteen, and real job costing costs more. Contractor Foreman: one-sixty-six, on the annual plan, with user caps and feature gates. Buildertrend and Procore? They won't even publish a price.
>
> BuildWorkPro is seventy-nine dollars a month. Flat. Unlimited users. Bids, AIA-style pay apps, change orders, daily logs, time tracking, e-signatures — all of it, one price.
>
> [CLOSE] Fourteen-day free trial. No credit card. No demo call. buildworkpro.com."

**On screen during the body:** the 5-user comparison table (build it as a simple slide from the numbers above — same table is going on /pricing/), then a fast 4-shot product montage (bid → pay app → gantt → mobile), then the end card.

**Compliance note:** competitor prices as of 2026-08-10 (JobTread $199 base + $20/user; Knowify $99–149 + $29/user, job costing at $329 tier; CF Plus $166/mo annual). Re-verify before each new flight; keep the "verify pricing" footnote culture from the compare pages.

---

## Script 3 — "From Bid to Signed Contract — E-Signatures Are Built In" (3–4 min)

**Prereq:** a finished demo bid ready to send; second browser window (incognito) to play the customer. Verify the current send-for-signature flow in-app while filming — steps below follow the feature page's numbered e-sign flow.

| #   | Scene         | You say                                                                                                                                                                                                                          | You do                                                                       |
| --- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1   | Hook          | "Getting a bid signed usually means: export a PDF, email it, print-sign-scan — or pay for DocuSign on top of your construction software. In BuildWorkPro, signatures are built in. Watch a bid go from draft to legally signed." | Open the finished bid.                                                       |
| 2   | The bid       | "This is a real estimate — line items, materials and labor broken out, margin dialed in. The client-ready PDF is one click."                                                                                                     | Scroll the bid; flash the PDF preview.                                       |
| 3   | Send          | "Send for signature. Add your customer, and off it goes — they get an email with a secure signing link. No account needed on their end."                                                                                         | Click send-for-signature; fill recipient; send.                              |
| 4   | Customer side | "Here's what your customer sees. The full proposal, and a signature box. They sign right on their phone or computer..."                                                                                                          | Incognito window: open the signing link, sign as the customer.               |
| 5   | Status        | "...and the second they do, the bid flips to accepted, the signed document is stored on the bid, and there's a full audit trail. From here — one click converts it to a project."                                                | Back in app: show updated status + signed doc; hover **Convert to Project**. |
| 6   | Close         | "Competitors either don't have this or charge extra per user for it. In BuildWorkPro it's included in the seventy-nine dollars. Try it free for 14 days at buildworkpro dot com. No credit card, no demo call, every feature."   | End card.                                                                    |

**YouTube:** "Send & E-Sign Construction Bids — Built-In (No DocuSign Needed)" · tags: construction bid, e-signature, construction proposal, bid proposal software, contract signing, subcontractor software. Embed on `/features/construction-bidding/` (its e-sign section) + cite on all three compare pages.

---

## Script 4 — "Schedule of Values, Explained in 4 Minutes" (educational)

**The play:** "schedule of values" is 1,900/mo at KD0 with video intent, and your written guide already exists. This is the video for people who _don't know the product yet_ — teach first, demo second. It embeds in the guide post and the future template page.

| #   | Scene            | You say                                                                                                                                                                                                                                            | You do                                                          |
| --- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 1   | Hook             | "If a GC just asked you for a schedule of values and you're not 100% sure what goes in it — this is everything, in four minutes."                                                                                                                  | Title card / face.                                              |
| 2   | Concept          | "An SOV breaks your contract price into line items — mobilization, rough-in, trim, closeout — each with a dollar value. It's the backbone of progress billing: every month you bill a percentage of each line, and the SOV keeps score."           | Simple diagram or the written guide on screen.                  |
| 3   | What goes in     | "Three rules from doing this for real: line items should match how the work actually phases. Front-load carefully — GCs notice. And keep line values defensible, because you'll bill against them for the life of the job."                        | Guide post sections on screen (it already covers these).        |
| 4   | In the app       | "Here's one in BuildWorkPro. Scheduled value per line... what's been billed in previous applications — locked, so history can't drift... this period... materials stored... and the totals roll up automatically."                                 | Pay app SOV card walkthrough (abbreviated Script-1 scenes 5–7). |
| 5   | Template + close | "There's a free downloadable SOV template linked below — and if you'd rather never touch the spreadsheet again, BuildWorkPro builds the SOV from your bid and carries it forward every billing period. Free 14-day trial at buildworkpro dot com." | End card.                                                       |

**YouTube:** "Schedule of Values Explained (Construction) — With Free Template" · tags: schedule of values, sov construction, schedule of values template, progress billing, aia billing, pay application. Embed: `/blog/schedule-of-values-guide/` + `/templates/schedule-of-values/` when built. **Note:** the "free template" line assumes the template page ships (Phase 2 #3) — film this one after that exists, or drop the template mention.

---

## Script 5 — "A Verbal OK Is Not a Change Order" (2–3 min)

**The play:** the change-order feature page's best line becomes the hook. Targets the change-order template cluster (1,000/mo KD0) + the margin-protection story.

| #   | Scene          | You say                                                                                                                                                                                                          | You do                                                        |
| --- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 1   | Hook           | "The GC says 'yeah, go ahead, we'll square up later.' Six weeks later you're arguing about money you already spent. A verbal OK is not a change order. Here's the two-minute version that protects your margin." | Open a demo project.                                          |
| 2   | Create         | "New change order, right from the project. Describe the extra work, price it with real line items — materials and labor, same as a bid, so the number is defensible."                                            | Create CO; add 2 line items.                                  |
| 3   | Send + approve | "Send it for approval before the work starts. Signed digitally, stored on the project. Now it's a paper trail, not a memory."                                                                                    | Send; show approval status flip.                              |
| 4   | The payoff     | "And here's the part nobody else connects: the approved change order flows into your contract sum and shows up in your next pay application automatically. The extra work actually gets billed."                 | Open/point at the next pay app's Change Orders Total prefill. |
| 5   | Close          | "Free change-order template below if you're doing this on paper — or try BuildWorkPro free for 14 days at buildworkpro dot com. No credit card, no demo call."                                                   | End card.                                                     |

**YouTube:** "Construction Change Orders: Stop Losing Money on Extra Work" · tags: change order, construction change order, change order template, scope creep, t&m, subcontractor. Embed: `/features/change-orders/` + `/templates/change-order/` when built.

---

## After each upload (5 min, don't skip)

1. Paste the video ID into `src/data/productVideos.ts` (new entries follow the `createBid`/`manageProject` shape) so the on-page embed + VideoObject schema activate.
2. Add the video to the matching feature/blog page if it isn't wired yet.
3. Add a card/link on the YouTube channel page description back to buildworkpro.com (channel link = another verified citation for the entity graph).
4. Cut the ad version (where marked) and park it in Meta as a paused ad until the conversion tracking is verified (gameplan M2/M3).
