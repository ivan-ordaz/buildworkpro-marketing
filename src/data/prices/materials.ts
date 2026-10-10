// The material pages under /prices/ and the series each one tracks. Series ids
// must exist in series.json (and so in ppi.json); the prices spec enforces it.
// Plan: calculators + price index, 2026-10-08 (phase 2, public data first).

export type Material = {
  slug: string;
  /** Short name used in tables and cards. */
  name: string;
  /** Page H1, also the start of the <title>. */
  h1: string;
  /** Headline series: the one the hub, the report and the page lead with. */
  headline: string;
  /** Everything shown in the page's table, headline first. */
  series: string[];
  /** Optional regional breakdown (chips and a table). */
  regions?: { label: string; id: string }[];
  /** What the series measure, in contractor terms. */
  intro: string;
  /** Noun used in "a $10,000 ___ bought a year ago". */
  purchase: string;
  related: { href: string; label: string; note: string }[];
};

export const COMPOSITE = 'WPUSI012011';
/** Tracked in the monthly report table but without a page of their own. */
export const REPORT_EXTRAS = ['WPU105', 'WPU0621'];

export const MATERIALS: Material[] = [
  {
    slug: 'lumber',
    name: 'Lumber',
    h1: 'Lumber Prices',
    headline: 'WPU081106013',
    series: ['WPU081106013', 'WPU0811', 'WPU083', 'WPU087101', 'WPU08220109'],
    intro:
      'Producer prices for softwood 2-inch dimension lumber, the 2x4s, 2x6s and 2x10s that framing and deck packages are built from, with softwood lumber overall, plywood, treated wood and trusses alongside.',
    purchase: 'framing lumber package',
    related: [
      {
        href: '/tools/deck-calculator/',
        label: 'Deck calculator',
        note: 'Decking, joists, posts and footings for a ledger deck.',
      },
      {
        href: '/tools/stair-stringer-calculator/',
        label: 'Stair stringer calculator',
        note: 'Risers, treads and the stringer stock to buy.',
      },
      {
        href: '/tools/fence-calculator/',
        label: 'Fence calculator',
        note: 'Posts, rails, pickets and post concrete for a wood fence.',
      },
      {
        href: '/templates/fence-estimate/',
        label: 'Fence estimate template',
        note: 'Footage takeoff to posts, panels and gates, priced per foot.',
      },
      {
        href: '/templates/construction-estimate/',
        label: 'Construction estimate template',
        note: 'Line items with the lumber package at your current quote.',
      },
      {
        href: '/solutions/framing-contractors/',
        label: 'For framing contractors',
        note: 'Bids with lumber packages priced at this week’s quotes.',
      },
    ],
  },
  {
    slug: 'concrete',
    name: 'Concrete',
    h1: 'Concrete Prices',
    headline: 'WPU1333',
    series: ['WPU1333', 'WPU1322', 'WPU1321', 'WPU13311135', 'WPU13420101'],
    regions: [
      { label: 'Northeast', id: 'WPU13330101A' },
      { label: 'Midwest', id: 'WPU13330101B' },
      { label: 'South', id: 'WPU13330101C' },
      { label: 'West', id: 'WPU13330101D' },
    ],
    intro:
      'Producer prices for ready-mix concrete nationally and in the four Census regions, which move more with local demand than most materials, plus cement, sand and gravel, concrete block and brick.',
    purchase: 'ready-mix order',
    related: [
      {
        href: '/templates/concrete-estimate/',
        label: 'Concrete estimate template',
        note: 'Slab takeoff to cubic yards, base, rebar and forms.',
      },
      {
        href: '/tools/concrete-block-calculator/',
        label: 'Concrete block calculator',
        note: 'Blocks, mortar, grout and rebar for a CMU wall.',
      },
      {
        href: '/tools/rebar-calculator/',
        label: 'Rebar calculator',
        note: 'Bars each way, laps, sticks to buy and chairs for a slab.',
      },
      {
        href: '/tools/asphalt-calculator/',
        label: 'Asphalt calculator',
        note: 'Pricing the driveway in asphalt instead: tons of mix and base.',
      },
      {
        href: '/tools/markup-vs-margin-calculator/',
        label: 'Markup vs margin calculator',
        note: 'Carry a price increase through to the bid at your margin.',
      },
      {
        href: '/solutions/concrete-contractors/',
        label: 'For concrete contractors',
        note: 'Bids by phase with yardage, pump time and rebar per line.',
      },
    ],
  },
  {
    slug: 'steel',
    name: 'Steel and rebar',
    h1: 'Steel and Rebar Prices',
    headline: 'WPU1017',
    series: ['WPU1017', 'WPU1074051', 'WPU107405'],
    intro:
      'Producer prices for steel mill products, the broad measure for bar, plate, sheet and pipe, with fabricated reinforcing bar and bar joists and fabricated structural metal alongside.',
    purchase: 'steel order',
    related: [
      {
        href: '/tools/rebar-calculator/',
        label: 'Rebar calculator',
        note: 'Sticks to buy from a cut list, and the weight in tons.',
      },
      {
        href: '/tools/concrete-block-calculator/',
        label: 'Concrete block calculator',
        note: 'Vertical bars and joint reinforcement for a block wall.',
      },
      {
        href: '/templates/concrete-estimate/',
        label: 'Concrete estimate template',
        note: 'Rebar grids converted to bars, laps, sticks and chairs.',
      },
      {
        href: '/templates/construction-estimate/',
        label: 'Construction estimate template',
        note: 'Line items with steel priced from your latest quote.',
      },
      {
        href: '/tools/markup-vs-margin-calculator/',
        label: 'Markup vs margin calculator',
        note: 'Carry a price increase through to the bid at your margin.',
      },
      {
        href: '/solutions/concrete-contractors/',
        label: 'For concrete contractors',
        note: 'Rebar, forming and placement as separate bid lines.',
      },
    ],
  },
  {
    slug: 'copper-wire',
    name: 'Copper wire',
    h1: 'Copper Wire Prices',
    headline: 'WPU10260314',
    series: ['WPU10260314', 'WPU1171', 'WPU117522', 'WPU1083'],
    intro:
      'Producer prices for copper wire and cable, the electrical material that swings hardest with the copper market, plus wiring devices, switchgear and lighting fixtures.',
    purchase: 'wire order',
    related: [
      {
        href: '/tools/conduit-fill-calculator/',
        label: 'Conduit fill calculator',
        note: 'Wire and raceway footage, with the smallest conduit that passes.',
      },
      {
        href: '/tools/voltage-drop-calculator/',
        label: 'Voltage drop calculator',
        note: 'The smallest wire that meets your drop target on a long run.',
      },
      {
        href: '/tools/box-fill-calculator/',
        label: 'Box fill calculator',
        note: 'NEC 314.16 box volume, itemized, with the smallest box that fits.',
      },
      {
        href: '/templates/electrical-estimate/',
        label: 'Electrical estimate template',
        note: 'Device counts to labor hours and wire footage.',
      },
      {
        href: '/solutions/electrical-contractors/',
        label: 'For electrical contractors',
        note: 'Bids, change orders and pay apps for electrical subs.',
      },
      {
        href: '/tools/',
        label: 'Free contractor tools',
        note: 'Calculators that add each run to one estimate.',
      },
    ],
  },
  {
    slug: 'drywall',
    name: 'Drywall',
    h1: 'Drywall Prices',
    headline: 'WPU13710102',
    series: ['WPU13710102', 'WPU1392'],
    intro:
      'Producer prices for gypsum building materials, which covers wallboard and the gypsum products hung with it, plus insulation materials.',
    purchase: 'board order',
    related: [
      {
        href: '/tools/drywall-calculator/',
        label: 'Drywall calculator',
        note: 'Sheets, compound, tape and screws for a room.',
      },
      {
        href: '/templates/drywall-estimate/',
        label: 'Drywall estimate template',
        note: 'Hang, finish and texture priced line by line.',
      },
      {
        href: '/templates/painting-estimate/',
        label: 'Painting estimate template',
        note: 'Paintable area, gallons and labor hours.',
      },
    ],
  },
  {
    slug: 'glass',
    name: 'Glass and aluminum',
    h1: 'Glass and Aluminum Prices',
    headline: 'WPU1311',
    series: ['WPU1311', 'WPU10250162'],
    intro:
      'Producer prices for flat glass, the float glass that tempered, laminated and insulating units are made from, and for extruded aluminum shapes, the stock behind storefront and window framing.',
    purchase: 'glass and aluminum order',
    related: [
      {
        href: '/solutions/glazing-contractors/',
        label: 'For glazing contractors',
        note: 'Bids, change orders and pay apps for glazing subs.',
      },
      {
        href: '/templates/construction-estimate/',
        label: 'Construction estimate template',
        note: 'A line-item estimate for any trade.',
      },
      {
        href: '/tools/',
        label: 'Free contractor tools',
        note: 'Calculators and a pay application builder.',
      },
    ],
  },
  {
    slug: 'asphalt',
    name: 'Asphalt',
    h1: 'Asphalt Prices',
    headline: 'WPU13940113C',
    series: ['WPU13940113C', 'WPU058102', 'WPU057303', 'WPU1321'],
    intro:
      'Producer prices for asphalt paving mixtures, with the asphalt binder and diesel fuel that drive them and the sand, gravel and crushed stone that go under them.',
    purchase: 'paving job’s mix',
    related: [
      {
        href: '/tools/asphalt-calculator/',
        label: 'Asphalt calculator',
        note: 'Tons of mix, base and truckloads for any area.',
      },
      {
        href: '/templates/concrete-estimate/',
        label: 'Concrete estimate template',
        note: 'For driveways and flatwork poured instead of paved.',
      },
      {
        href: '/tools/',
        label: 'Free contractor tools',
        note: 'Calculators that add each area to one estimate.',
      },
    ],
  },
  {
    slug: 'roofing',
    name: 'Roofing',
    h1: 'Roofing Material Prices',
    headline: 'WPU13610131',
    series: ['WPU13610131', 'WPU13620121'],
    intro:
      'Producer prices for asphalt shingles and roll roofing, the bulk of residential roofing material, plus roofing asphalts, coatings and cement.',
    purchase: 'shingle order',
    related: [
      {
        href: '/templates/roofing-estimate/',
        label: 'Roofing estimate template',
        note: 'Squares, bundles and pitch from plan dimensions.',
      },
      {
        href: '/solutions/roofing-contractors/',
        label: 'For roofing contractors',
        note: 'Bids, change orders and pay apps for roofing subs.',
      },
      {
        href: '/tools/',
        label: 'Free contractor tools',
        note: 'Calculators and a pay application builder.',
      },
    ],
  },
];

export function material(slug: string): Material {
  const m = MATERIALS.find((x) => x.slug === slug);
  if (!m) throw new Error(`unknown material ${slug}`);
  return m;
}
