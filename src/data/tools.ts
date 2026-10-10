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
  /**
   * Sibling tools and price pages linked under the page's "Keep going" cards,
   * so every tool is reachable from related tools, not only from the hub.
   * Hrefs resolve through src/data/resource-links.ts.
   */
  related?: string[];
};

export const TOOLS: ToolEntry[] = [
  {
    href: '/tools/asphalt-calculator/',
    name: 'Asphalt Calculator',
    tag: 'Paving',
    blurb:
      'Tons of hot mix, stone base and truckloads for any area and thickness, priced with your own rates.',
    group: 'Calculators',
    related: [
      '/tools/concrete-block-calculator/',
      '/tools/rebar-calculator/',
      '/tools/markup-vs-margin-calculator/',
      '/prices/asphalt/',
    ],
  },
  {
    href: '/tools/box-fill-calculator/',
    name: 'Box Fill Calculator',
    tag: 'Electrical',
    blurb:
      'Required box volume under NEC 314.16, itemized by rule, checked against your box with the smallest box that fits.',
    group: 'Calculators',
    related: [
      '/tools/conduit-fill-calculator/',
      '/tools/voltage-drop-calculator/',
      '/tools/labor-burden-calculator/',
      '/prices/copper-wire/',
    ],
  },
  {
    href: '/tools/concrete-block-calculator/',
    name: 'Concrete Block Calculator',
    tag: 'Masonry',
    blurb:
      'Blocks, mortar, grout, rebar and joint reinforcement for a CMU wall, priced with your own rates.',
    group: 'Calculators',
    related: [
      '/tools/rebar-calculator/',
      '/tools/asphalt-calculator/',
      '/tools/markup-vs-margin-calculator/',
      '/prices/concrete/',
    ],
  },
  {
    href: '/tools/conduit-fill-calculator/',
    name: 'Conduit Fill Calculator',
    tag: 'Electrical',
    blurb:
      'Fill for THHN and bare grounds in EMT, IMC, rigid and PVC against NEC Chapter 9 limits, with the smallest size that passes.',
    group: 'Calculators',
    related: [
      '/tools/voltage-drop-calculator/',
      '/tools/box-fill-calculator/',
      '/tools/labor-burden-calculator/',
      '/prices/copper-wire/',
    ],
  },
  {
    href: '/tools/deck-calculator/',
    name: 'Deck Calculator',
    tag: 'Decks',
    blurb:
      'Decking boards, joists, hangers, posts, footing concrete and screws for a ledger deck, priced with your own rates.',
    group: 'Calculators',
    related: [
      '/tools/stair-stringer-calculator/',
      '/tools/fence-calculator/',
      '/tools/markup-vs-margin-calculator/',
      '/prices/lumber/',
    ],
  },
  {
    href: '/tools/drywall-calculator/',
    name: 'Drywall Calculator',
    tag: 'Drywall',
    blurb:
      'Sheets by size, joint compound, tape and screws for a room, priced with your own rates.',
    group: 'Calculators',
    related: [
      '/tools/labor-burden-calculator/',
      '/tools/markup-vs-margin-calculator/',
      '/prices/drywall/',
    ],
  },
  {
    href: '/tools/fence-calculator/',
    name: 'Fence Calculator',
    tag: 'Fence',
    blurb:
      'Posts, rails, pickets and concrete bags for a run of wood fence, priced with your own rates.',
    group: 'Calculators',
    related: [
      '/tools/deck-calculator/',
      '/tools/stair-stringer-calculator/',
      '/tools/markup-vs-margin-calculator/',
      '/prices/lumber/',
    ],
  },
  {
    href: '/tools/labor-burden-calculator/',
    name: 'Labor Burden Calculator',
    tag: 'Labor',
    blurb:
      'True cost of an employee per paid and billable hour, with payroll taxes, workers’ comp and benefits, and a billing rate at your margin.',
    group: 'Calculators',
    related: ['/tools/markup-vs-margin-calculator/', '/tools/pay-app/'],
  },
  {
    href: '/tools/markup-vs-margin-calculator/',
    name: 'Markup vs Margin Calculator',
    tag: 'Pricing',
    blurb:
      'Convert markup, margin and selling price both ways, and price a job to cover overhead and net profit.',
    group: 'Calculators',
    related: ['/tools/labor-burden-calculator/', '/tools/pay-app/', '/prices/'],
  },
  {
    href: '/tools/rebar-calculator/',
    name: 'Rebar Calculator',
    tag: 'Concrete',
    blurb:
      'Bars each way, laps, sticks to buy, weight and chairs for a slab or mat, priced with your own rates.',
    group: 'Calculators',
    related: [
      '/tools/concrete-block-calculator/',
      '/tools/asphalt-calculator/',
      '/tools/markup-vs-margin-calculator/',
      '/prices/steel/',
    ],
  },
  {
    href: '/tools/stair-stringer-calculator/',
    name: 'Stair Stringer Calculator',
    tag: 'Stairs',
    blurb:
      'Risers, treads, total run, stringer length and the board to buy, checked against IRC rise and run limits.',
    group: 'Calculators',
    related: [
      '/tools/deck-calculator/',
      '/tools/fence-calculator/',
      '/tools/markup-vs-margin-calculator/',
      '/prices/lumber/',
    ],
  },
  {
    href: '/tools/voltage-drop-calculator/',
    name: 'Voltage Drop Calculator',
    tag: 'Electrical',
    blurb:
      'Voltage drop in volts and percent and the smallest copper or aluminum wire that meets your target, single or three phase.',
    group: 'Calculators',
    related: [
      '/tools/conduit-fill-calculator/',
      '/tools/box-fill-calculator/',
      '/tools/labor-burden-calculator/',
      '/prices/copper-wire/',
    ],
  },
  {
    href: '/tools/pay-app/',
    name: 'Pay Application Builder',
    tag: 'Billing',
    blurb:
      'A G702/G703-style pay application with retainage math that rolls forward each month and fills a PDF.',
    group: 'Billing and paperwork',
    related: ['/tools/markup-vs-margin-calculator/', '/tools/labor-burden-calculator/'],
  },
];

export const TOOL_GROUPS: ToolEntry['group'][] = ['Calculators', 'Billing and paperwork'];
