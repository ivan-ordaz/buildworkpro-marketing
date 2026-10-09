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
    href: '/tools/asphalt-calculator/',
    name: 'Asphalt Calculator',
    tag: 'Paving',
    blurb:
      'Tons of hot mix, stone base and truckloads for any area and thickness, priced with your own rates.',
    group: 'Calculators',
  },
  {
    href: '/tools/concrete-block-calculator/',
    name: 'Concrete Block Calculator',
    tag: 'Masonry',
    blurb:
      'Blocks, mortar, grout, rebar and joint reinforcement for a CMU wall, priced with your own rates.',
    group: 'Calculators',
  },
  {
    href: '/tools/deck-calculator/',
    name: 'Deck Calculator',
    tag: 'Decks',
    blurb:
      'Decking boards, joists, hangers, posts, footing concrete and screws for a ledger deck, priced with your own rates.',
    group: 'Calculators',
  },
  {
    href: '/tools/drywall-calculator/',
    name: 'Drywall Calculator',
    tag: 'Drywall',
    blurb:
      'Sheets by size, joint compound, tape and screws for a room, priced with your own rates.',
    group: 'Calculators',
  },
  {
    href: '/tools/fence-calculator/',
    name: 'Fence Calculator',
    tag: 'Fence',
    blurb:
      'Posts, rails, pickets and concrete bags for a run of wood fence, priced with your own rates.',
    group: 'Calculators',
  },
  {
    href: '/tools/stair-stringer-calculator/',
    name: 'Stair Stringer Calculator',
    tag: 'Stairs',
    blurb:
      'Risers, treads, total run, stringer length and the board to buy, checked against IRC rise and run limits.',
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
