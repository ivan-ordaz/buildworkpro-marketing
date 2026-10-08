// Registry of the free tools under /tools/. The hub page renders from this list
// and the tools spec checks every entry resolves, so a new calculator ships by
// adding its page and one entry here.

export type ToolEntry = {
  href: string;
  name: string;
  /** Short trade or job label shown on the card. */
  tag: string;
  blurb: string;
  group: 'Calculators' | 'Billing and paperwork';
};

export const TOOLS: ToolEntry[] = [
  {
    href: '/tools/drywall-calculator/',
    name: 'Drywall Calculator',
    tag: 'Drywall',
    blurb:
      'Sheets by size, joint compound, tape and screws for a room, priced with your own rates.',
    group: 'Calculators',
  },
  {
    href: '/tools/pay-app/',
    name: 'Pay Application Builder',
    tag: 'Billing',
    blurb:
      'A G702/G703-style pay application with retainage math that rolls forward each month and fills a PDF.',
    group: 'Billing and paperwork',
  },
];

export const TOOL_GROUPS: ToolEntry['group'][] = ['Calculators', 'Billing and paperwork'];
