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
      'There is no higher tier. Bids, pay applications, change orders, time tracking, QuickBooks sync, and the API are all included in the one price.',
  },
];
