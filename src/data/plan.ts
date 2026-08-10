/**
 * The single BuildWorkPro plan.
 *
 * One source of truth, imported by both the home-page pricing section
 * (`components/Pricing.astro`) and the standalone `/pricing/` page. Two
 * hand-maintained copies of a price is how a site ends up advertising two
 * different numbers on two different URLs.
 */
export const plan = {
  name: 'BuildWorkPro',
  monthly: '$79',
  yearly: '$790',
  /** $790 / 12, i.e. what the annual plan works out to per month. */
  yearlyPerMonth: '$65.83',
  trialDays: 14,
} as const;

export const planFeatures: readonly string[] = [
  'Unlimited users',
  'Unlimited projects',
  'Unlimited contacts',
  'Bids & estimates',
  'Pay applications',
  'Change orders',
  'E-signatures (bids & change orders)',
  'Site logs',
  'Time tracking',
  'Sales pipeline & CRM',
  'Gantt charts & scheduling',
  'Reports & analytics',
  'Role-based permissions',
  'Document management',
  'QuickBooks sync',
  'Custom branding',
  'API access',
];

/**
 * What a 5-person sub crew actually pays elsewhere (issue #128). Figures
 * verified 2026-08-10 from competitor pricing pages and independent trackers —
 * re-verify before each meaningful update; the page renders an as-of footnote.
 * Kept here so the pricing page and any future ad creative quote ONE set of
 * numbers.
 */
export const crewMath: readonly {
  name: string;
  monthly: string;
  trial: string;
  theCatch: string;
  href?: string;
}[] = [
  {
    name: 'Procore',
    monthly: '$375–$835+',
    trial: 'No — demo call',
    theCatch:
      'Quote-only, priced on your construction volume; independent analyses put small-contractor entry at $4,500–$10,000+/year',
    href: '/compare/procore-alternative/',
  },
  {
    name: 'Buildertrend',
    monthly: 'Custom quote',
    trial: 'No — demo call',
    theCatch: 'No published pricing since 2026; last published tiers ran $339–$1,099/month',
    href: '/compare/buildertrend-alternative/',
  },
  {
    name: 'JobTread',
    monthly: '~$279',
    trial: 'None',
    theCatch: '$199 base + $20 per user each month; you pay before you can try it',
  },
  {
    name: 'Knowify',
    monthly: '$215–$329',
    trial: '14 days, feature-gated',
    theCatch: '+$29 per user; real job costing sits in the $329/month tier',
  },
  {
    name: 'Contractor Foreman',
    monthly: '$166 (Plus, annual)',
    trial: '30 days',
    theCatch: 'Five tiers with user caps and feature gates; the $49 headline tier is one user',
    href: '/compare/contractor-foreman-alternative/',
  },
];

/**
 * Billing questions people actually leave over. Deliberately distinct from the
 * home-page FAQ's questions — two pages publishing the same FAQPage markup is
 * duplicate structured data.
 */
export const pricingFaq: readonly { question: string; answer: string }[] = [
  {
    question: 'What happens when the 14 days are up?',
    answer:
      "Nothing disappears. We'll ask for a card to keep going. If you don't add one, your account pauses and your data stays exactly where you left it until you come back.",
  },
  {
    question: 'Do you charge per user?',
    answer:
      'No. Your whole crew is included — office staff, project managers, and field crew — at the same price. Hiring someone never raises your bill.',
  },
  {
    question: 'Can I cancel anytime?',
    answer:
      'Yes, from your billing settings. No phone call, no retention script, and no notice period.',
  },
  {
    question: 'Is anything locked behind a higher tier?',
    answer:
      'There is no higher tier. Bids, pay applications, change orders, legally-binding e-signatures, time tracking, QuickBooks sync, and the API are all included in the one price.',
  },
  {
    question: 'Will my price go up later?',
    answer:
      "We don't do surprise increases. If pricing ever changes, it's announced well in advance, never mid-billing-cycle — and annual plans keep their rate for the full paid year.",
  },
  {
    question: 'Do you charge for onboarding, training, or support?',
    answer:
      'No. Support is included, and there is no implementation fee — the CSV import wizards get contacts, products, and projects in the same day. Compare that with enterprise construction platforms, where implementation alone is quoted in the thousands.',
  },
];
