/**
 * The "What's included" checklist shared by every solutions trade page.
 *
 * These six pages used to carry six byte-identical hand-copied arrays, which is
 * how e-signatures shipped GA without appearing on any of them (issue #127).
 * One list, imported everywhere, so a new differentiator lands on every trade
 * page at once.
 */
export const solutionsIncluded: readonly string[] = [
  'Unlimited users',
  'Unlimited projects',
  'Bids & estimates',
  'Pay applications',
  'Change orders',
  'E-signatures (bids & change orders)',
  'Site logs & daily reports',
  'Gantt charts & scheduling',
  'Sales pipeline & CRM',
  'Time tracking',
  'QuickBooks sync',
  'Role-based permissions',
  'Reports & analytics',
  'Document management',
];
