import type { TemplateSlug } from './templates';

// The one sentence shown under the download buttons after a visitor downloads
// a template: what BuildWorkPro does with this exact document. Every claim here
// is lifted from that template page's own `feature` block, which is checked
// against src/content/docs — keep it that way when editing.
//
// Typed as a full Record so adding a template to the registry fails the
// typecheck until it has a next step too.
export const NEXT_STEPS: Record<TemplateSlug, string> = {
  'aia-g702-g703':
    'Next month, skip retyping it. BuildWorkPro prefills the schedule of values from your bid and approved change orders, locks previous applications and tracks retainage for you.',
  'schedule-of-values':
    'BuildWorkPro seeds the schedule of values from your accepted bid and bills against it every period on a G702/G703-style pay application.',
  'construction-invoice':
    'BuildWorkPro generates invoices from your projects and approved pay applications, numbers them automatically, emails the PDF and syncs them to QuickBooks Online.',
  'lien-waiver':
    'BuildWorkPro keeps the record every waiver draws from: the pay application’s schedule of values, retainage and previous payments for each period.',
  'conditional-lien-waiver':
    'BuildWorkPro keeps the pay application each waiver travels with: its through date, amount and retainage, with the signed waiver attached to that pay app.',
  'unconditional-lien-waiver':
    'In BuildWorkPro each unconditional waiver files on the pay application whose payment it releases, so the amount and through date come from the billing record.',
  'notice-to-owner':
    'BuildWorkPro tracks the schedule of values, retainage and approval history on every pay application, with each served notice attached to the project it protects.',
  'notice-of-commencement':
    'In BuildWorkPro the recorded notice, the permit and the bond live on the project’s Documents tab, so the addresses for notices and waivers stay with the job.',
  'equipment-rental-agreement':
    'In BuildWorkPro a rented lift or other job-wide cost goes on the bid’s Project Costs tab and is spread into your line-item sell prices before the bid goes out.',
  'letter-of-intent':
    'In BuildWorkPro you mark the bid accepted when the award comes in and convert it into a project, with its line items mapped to phases or tasks.',
  'construction-estimate':
    'BuildWorkPro builds the estimate from your product catalog with margin and overhead applied as rates, then sends it as a branded PDF proposal for e-signature.',
  'construction-bid-proposal':
    'BuildWorkPro turns your estimate into a branded PDF proposal, sends it for legally binding e-signature and converts the accepted bid into a project.',
  'construction-quote':
    'In BuildWorkPro a quote is priced from your catalog, sent as a branded PDF for e-signature and converted into a project in one click.',
  'bid-tabulation':
    'BuildWorkPro puts the winning number into a line-item bid priced from your catalog and converts the won bid into a project with its contract value in place.',
  'subcontractor-agreement':
    'In BuildWorkPro a won bid converts into a project, the signed subcontract lives on its Documents tab, and the estimate seeds the schedule of values.',
  'construction-contract':
    'In BuildWorkPro your estimate becomes a proposal the customer e-signs, and the accepted bid converts into a project with the contract value carried in.',
  'scope-of-work':
    'In BuildWorkPro bid templates carry your standard inclusions and exclusions, and the scope you price is the proposal your customer e-signs.',
  'change-order':
    'In BuildWorkPro a change order is priced against the original bid, e-signed from an emailed link and applied to the next pay application once approved.',
  'notice-to-proceed':
    'In BuildWorkPro the start date on this notice becomes the first bar on the project’s Gantt chart, next to its change orders and pay applications.',
  'certificate-of-completion':
    'In BuildWorkPro closeout is a project phase: punch items, lien waivers and the final pay application are tasks with owners and due dates.',
  'daily-report':
    'In BuildWorkPro the crew files this report from a phone with photos, tagged by type, so every delay on the job is one filter away.',
  'work-order':
    'In BuildWorkPro extra work becomes a change order the customer signs online, and crew hours log against the project at per-person labor rates.',
  'tm-ticket':
    'In BuildWorkPro crews log hours against the project in quarter-hour steps, and labor rates turn them into cost automatically for a manager to review.',
  rfi: 'In BuildWorkPro the RFI, the drawing revision it produced and the change order that priced it all sit on the same project record.',
  timesheet:
    'In BuildWorkPro crews log hours by project, labor rates turn them into cost, and a manager reviews entries before payroll.',
  'construction-schedule':
    'In BuildWorkPro tasks link as dependencies with the critical path highlighted, and you reschedule by dragging bars on the Gantt chart.',
  'punch-list':
    'In BuildWorkPro punch items are project tasks with a status, assignee and checklist that the office and the field both see.',
  'submittal-log':
    'In BuildWorkPro submittals, drawings and product data sit on the project’s Documents tab, next to its schedule, change orders and pay applications.',
  'construction-budget':
    'In BuildWorkPro the accepted bid becomes the contract value, approved change orders adjust it, and Reports export the numbers to CSV or PDF.',
  'meeting-minutes':
    'In BuildWorkPro every project has a threaded Comments tab where mentioning a teammate notifies them, plus a full activity history.',
  'job-safety-analysis':
    'In BuildWorkPro safety entries are site logs tagged Safety, with photos, so they come up in seconds when the GC or your insurer asks.',
  'toolbox-talk':
    'In BuildWorkPro the toolbox talk is a site log tagged Safety, with the crew on site and photos, on the same dated record as the day’s work.',
  'roofing-estimate':
    'In BuildWorkPro your roofing estimate is a bid priced from your catalog with margin and overhead applied as rates, sent as a branded PDF for e-signature and converted into a project when the customer accepts.',
  'landscaping-estimate':
    'In BuildWorkPro your landscaping estimate is a bid priced from your catalog with margin and overhead applied as rates, sent as a branded PDF for e-signature and converted into a project when the customer accepts.',
  'painting-estimate':
    'In BuildWorkPro your painting estimate is a bid priced from your catalog with margin and overhead applied as rates, sent as a branded PDF for e-signature and converted into a project when the customer accepts.',
  'hvac-estimate':
    'In BuildWorkPro your HVAC estimate is a bid priced from your catalog with margin and overhead applied as rates, sent as a branded PDF for e-signature and converted into a project when the customer accepts.',
  'electrical-estimate':
    'In BuildWorkPro your electrical estimate is a bid priced from your catalog with margin and overhead applied as rates, sent as a branded PDF for e-signature and converted into a project when the customer accepts.',
  'plumbing-estimate':
    'In BuildWorkPro your plumbing estimate is a bid priced from your catalog with margin and overhead applied as rates, sent as a branded PDF for e-signature and converted into a project when the customer accepts.',
  'fence-estimate':
    'In BuildWorkPro your fence estimate is a bid priced from your catalog with margin and overhead applied as rates, sent as a branded PDF for e-signature and converted into a project when the customer accepts.',
  'concrete-estimate':
    'In BuildWorkPro your concrete estimate is a bid priced from your catalog with margin and overhead applied as rates, sent as a branded PDF for e-signature and converted into a project when the customer accepts.',
  'drywall-estimate':
    'In BuildWorkPro your drywall estimate is a bid priced from your catalog with margin and overhead applied as rates, sent as a branded PDF for e-signature and converted into a project when the customer accepts.',
  'flooring-estimate':
    'In BuildWorkPro your flooring estimate is a bid priced from your catalog with margin and overhead applied as rates, sent as a branded PDF for e-signature and converted into a project when the customer accepts.',
};
