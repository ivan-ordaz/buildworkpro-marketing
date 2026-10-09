// Staging for the per-trade screenshots on /solutions/* (solutions-*.shots.mjs).
//
// Each seeded trade tenant has the problems the HVAC tenant had: site logs
// assembled from random pools (a "Pour day" with someone else's notes and tags
// the app no longer accepts), unnamed bids priced as flat legacy lines, lead
// names stitched from two scope words ("Re-Roof Repair"), customers that don't
// match their projects. These helpers stage what each screenshot shows through
// the app's own API, with content written for that trade. Every helper is
// idempotent — re-running a scene rebuilds the same records.
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { contentReady } from './cuts.mjs';
import { freshBid, costItems } from './demo-bids.mjs';

/**
 * A `snap(name)` that writes a 1920x1080 still straight to
 * public/screenshots/solutions/<trade>/<name>.png once `main` has painted.
 */
export async function solutionsSnapper(page, trade, log) {
  const dir = fileURLToPath(new URL(`../../public/screenshots/solutions/${trade}/`, import.meta.url));
  await mkdir(dir, { recursive: true });
  return async (name) => {
    await contentReady(page);
    await page.mouse.move(5, 5);
    await page.screenshot({ path: `${dir}${name}.png` });
    log(`  📸 screenshots/solutions/${trade}/${name}.png`);
  };
}

/**
 * Scroll `locator`'s own scrolling ancestor so its top lands at viewport y
 * `y` (instant). Walking up from the element avoids guessing which pane
 * scrolls — the sidebar and the page body both can.
 */
export async function scrollIntoFrame(page, locator, y) {
  await locator.first().evaluate((el, targetY) => {
    let pane = el.parentElement;
    while (pane && !(/(auto|scroll)/.test(getComputedStyle(pane).overflowY) && pane.scrollHeight > pane.clientHeight)) {
      pane = pane.parentElement;
    }
    pane ??= document.scrollingElement;
    pane.scrollTo({ top: pane.scrollTop + el.getBoundingClientRect().top - targetY, behavior: 'instant' });
  }, y);
  await page.waitForTimeout(500);
}

/** Bottom edge (viewport y) of the sticky record header above `main h1`. */
async function stickyHeaderBottom(page) {
  return page.locator('main h1').first()
    .evaluate((el) => el.closest('[class*="sticky"]')?.getBoundingClientRect().bottom ?? 200);
}

/**
 * Open a bid's Estimate tab in the Detailed view with line `expand` (0-based)
 * opened to its cost items, scrolled so the rollup cards sit under the sticky
 * bid header. `ready` is a cost-item description to wait for.
 */
export async function frameEstimate({ page, goto, click, waitFor, wait }, bidId, { customer, expand, ready }) {
  await goto(`/bids/${bidId}`, 800);
  await waitFor(`main >> text=${customer}`, 20000);
  await click('[role="tab"]:has-text("Estimate")');
  await click('[role="tab"][aria-label="Detailed"]');
  await waitFor('main button[title="Show cost items"]:visible');
  await page.locator('main button[title="Show cost items"]:visible').nth(expand).click();
  await waitFor(`main input[value=${JSON.stringify(ready)}]:visible`);
  // The rollup cards just under the sticky header (their label sits ~64px
  // below the card top).
  await scrollIntoFrame(page, page.locator('main >> text=Direct material cost'), (await stickyHeaderBottom(page)) + 12 + 64);
  await wait(300);
}

/**
 * Open a project's Plan tab (List view) with every phase collapsed except
 * `open`, scrolled so the Phases & Tasks card starts under the sticky header —
 * all the phase progress bars plus the tasks of the phases in flight.
 */
export async function framePhases({ page, goto, click, waitFor, wait }, projectId, { open }) {
  await goto(`/projects/${projectId}#plan`, 800);
  await waitFor(`[data-phase-header]:has-text(${JSON.stringify(open[0])})`, 20000);
  await click('main button:has-text("Collapse all")');
  await wait(500);
  for (const name of open) {
    await click(`[data-phase-header]:has-text(${JSON.stringify(name)}) span.font-medium`);
    await wait(400);
  }
  // Let the opened phases render their task rows (the pane only becomes
  // scrollable once they have).
  await page.locator('[data-task-row]').first().waitFor({ state: 'visible', timeout: 10000 });
  await wait(600);
  await scrollIntoFrame(page, page.locator('main >> text=Phases & Tasks'), (await stickyHeaderBottom(page)) + 40);
}

/** Fail fast when the scene is run as the wrong demo user (CAPTURE_USER). */
export async function assertUser(api, username) {
  const me = await api.get('/api/auth/me');
  if (me.username !== username) {
    throw new Error(`logged in as "${me.username}" — run this scene with CAPTURE_USER=${username}`);
  }
}

/** A tenant contact whose company name matches `pattern`, picked deterministically. */
export async function pickContact(api, pattern) {
  const contacts = await api.get('/api/contacts?limit=500');
  const match = contacts
    .filter((c) => c.companyName && pattern.test(c.companyName) && !c.deletedAt)
    .sort((a, b) => a.companyName.localeCompare(b.companyName))[0];
  if (!match) throw new Error(`no contact matching ${pattern}`);
  return match;
}

/** A project by exact name. */
export async function projectNamed(api, name) {
  const projects = await api.get(`/api/projects?search=${encodeURIComponent(name)}&limit=50`);
  const project = projects.find((p) => p.name === name && !p.deletedAt);
  if (!project) throw new Error(`project not found: ${name}`);
  return project;
}

/**
 * Point a seeded project at a customer that matches its name — "Grand School —
 * EV Charging" billed to "Grand School …", not to an unrelated car wash. Leaves
 * the project alone when the tenant has no such contact.
 */
export async function matchProjectCustomer(api, project) {
  const place = project.name.split(' — ')[0];
  const contacts = await api.get(`/api/contacts?search=${encodeURIComponent(place)}&limit=20`);
  const match = contacts.find((c) => c.companyName?.startsWith(place) && !c.deletedAt);
  if (match && match.id !== project.contactId) {
    await api.put(`/api/projects/${project.id}`, { contactId: match.id });
  }
  return match ?? null;
}

function requireSku(bySku, sku) {
  if (!bySku[sku]) throw new Error(`catalog product ${sku} not found in this tenant`);
  return bySku[sku];
}

const EMPTY_DETAIL = { workPerformed: '', materialsReceived: '', issues: '', visitorsOnSite: '' };

/**
 * Rewrite every site log in the tenant from `entries` (written oldest-first):
 * the newest logs get the last entries, so the top of the timeline reads in
 * order with no repeats; older logs beyond the list cycle back through it.
 * Returns { [title]: id } of each title's newest log.
 */
export async function polishTradeSiteLogs(api, entries) {
  const logs = await api.get('/api/site-logs?limit=200&offset=0');
  logs.sort((a, b) => new Date(b.logDate) - new Date(a.logDate) || b.id - a.id);
  const ids = {};
  for (const [i, log] of logs.entries()) {
    const entry = entries[entries.length - 1 - (i % entries.length)];
    await api.put(`/api/site-logs/${log.id}`, { ...EMPTY_DETAIL, ...entry });
    ids[entry.title] ??= log.id;
  }
  return ids;
}

/**
 * Rename every lead in the tenant from `names` (by id, so re-runs map the same
 * lead to the same name). Only the name changes — stage, value and dates stay.
 */
export async function renameLeads(api, names) {
  const leads = (await api.get('/api/leads?limit=500')).sort((a, b) => a.id - b.id);
  for (const [i, lead] of leads.entries()) {
    const name = names[i % names.length];
    if (lead.name !== name) await api.put(`/api/leads/${lead.id}`, { name });
  }
  return leads.length;
}

/**
 * The seed marks bids Expired while their Valid Until is still weeks away.
 * Move each such date to 30 days after the bid was created (and never later
 * than yesterday), which is when it would actually have lapsed.
 */
export async function fixExpiredBidDates(api) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let fixed = 0;
  for (const bid of await api.get('/api/bids?limit=500')) {
    if (bid.status !== 'expired' || !bid.validUntil || new Date(bid.validUntil) < today) continue;
    const lapsed = new Date(new Date(bid.createdAt).getTime() + 30 * 86400000);
    const yesterday = new Date(today.getTime() - 86400000);
    await api.put(`/api/bids/${bid.id}`, { validUntil: (lapsed < yesterday ? lapsed : yesterday).toISOString() });
    fixed++;
  }
  return fixed;
}

/**
 * A fresh named bid with priced cost items (earlier bids of the name removed).
 * A line's optional `sku` links it to that catalog product (the Product /
 * System column), so rows don't read as an empty "Select…".
 */
export async function stageEstimate(api, { name, customer, lines, extra }) {
  const products = await api.get('/api/products?limit=500');
  const bySku = Object.fromEntries(products.map((p) => [p.sku, p]));
  return freshBid(api, {
    name,
    contactId: customer.id,
    extra,
    lineItems: lines.map((line, i) => ({
      ...(line.sku ? { productId: requireSku(bySku, line.sku).id } : {}),
      markName: line.mark,
      description: line.description,
      quantity: String(line.quantity ?? 1),
      unitPrice: '0',
      kind: 'item',
      order: i,
      sublines: costItems(line.costs),
    })),
  });
}

// ─── Site logs ────────────────────────────────────────────────────────────

export const CONCRETE_SITE_LOGS = [
  {
    title: 'Layout & footing excavation',
    tags: ['progress'],
    personnelCount: 4,
    notes: "Laid out the building pad from the surveyor's control points and excavated footings on grid lines A–C.",
    workPerformed: 'Footing layout and excavation, grid A–C.',
  },
  {
    title: 'Subgrade compaction test',
    tags: ['inspection'],
    personnelCount: 3,
    notes: 'Geotech tested the subgrade at six locations — 96–98% Proctor, all passing. Report filed to the project.',
    visitorsOnSite: 'Geotechnical technician',
  },
  {
    title: 'Footing forms set',
    tags: ['progress'],
    personnelCount: 5,
    notes: 'Set forms for 220 lf of continuous footing and 14 pad footings. Form release applied.',
    materialsReceived: '2x12 form lumber, form release',
  },
  {
    title: 'Rebar delivery',
    tags: ['delivery'],
    personnelCount: 3,
    notes: 'Rebar delivered and staged by grid line — #5 bars, dowel baskets and chairs. Checked against the placing drawings.',
    materialsReceived: '#5 rebar (180 bars), dowel baskets, chairs & tie wire',
  },
  {
    title: 'Footing steel placed',
    tags: ['progress'],
    personnelCount: 6,
    notes: 'Placed and tied footing steel and dowels. Checked 3" bottom cover throughout.',
  },
  {
    title: 'Pre-pour inspection passed',
    tags: ['inspection'],
    personnelCount: 2,
    notes: 'City inspector and the engineer of record signed off on footing steel and forms. Cleared to pour Thursday.',
    visitorsOnSite: 'City building inspector, structural engineer',
  },
  {
    title: 'Footing pour — 42 CY',
    tags: ['progress', 'delivery'],
    personnelCount: 7,
    notes: 'Placed 42 CY of 4000 PSI with the pump truck, 7:00–11:30 AM. Cylinders cast for 7- and 28-day breaks.',
    materialsReceived: '42 CY 4000 PSI ready-mix (6 trucks)',
  },
  {
    title: 'Rain delay — slab pour moved',
    tags: ['delay'],
    personnelCount: 3,
    notes: 'Rain in the forecast pushed the slab pour to Monday. Crew covered the vapor barrier and finished the edge forms.',
    issues: 'Slab pour moved two days; pump truck and ready-mix rebooked.',
  },
  {
    title: 'Vapor barrier & mesh',
    tags: ['progress'],
    personnelCount: 5,
    notes: 'Rolled out 10-mil vapor barrier with taped seams and set 6x6 mesh on chairs across the slab area.',
  },
  {
    title: 'Slab pour — area A',
    tags: ['progress', 'delivery'],
    personnelCount: 8,
    notes: 'Pumped and finished 68 CY of slab on grade in area A. Steel trowel inside, broom finish at the loading door.',
    materialsReceived: '68 CY 4000 PSI ready-mix (9 trucks)',
  },
  {
    title: 'Control joints saw-cut',
    tags: ['progress'],
    personnelCount: 3,
    notes: 'Saw-cut control joints at 12 ft on center within 12 hours of the pour. Cure & seal applied.',
  },
  {
    title: 'Silica safety stand-down',
    tags: ['safety'],
    personnelCount: 7,
    notes: 'Morning stand-down on silica exposure before saw-cutting. Wet cutting and N95s required; sign-in sheet filed.',
  },
  {
    title: '7-day cylinder breaks',
    tags: ['inspection'],
    personnelCount: 1,
    notes: '7-day breaks averaged 3,180 PSI — on track for 4,000 at 28 days. Results sent to the GC.',
  },
  {
    title: 'Forms stripped & backfilled',
    tags: ['progress'],
    personnelCount: 4,
    notes: 'Stripped the footing forms and backfilled the perimeter in 8" lifts. Area handed to the framing crew.',
  },
];

export const PLUMBING_DETAIL_LOG = 'Rough-in inspection — level 2 restrooms';

export const PLUMBING_SITE_LOGS = [
  {
    title: 'Underground rough-in',
    tags: ['progress'],
    personnelCount: 4,
    notes: 'Laid 4" cast-iron and PVC underground for the restroom cores. Sleeves set at every slab penetration.',
  },
  {
    title: 'Underground test & inspection',
    tags: ['inspection'],
    personnelCount: 3,
    notes: '10-ft head test held 15 minutes with no drop. Inspector approved the underground before backfill.',
    visitorsOnSite: 'City plumbing inspector',
  },
  {
    title: 'Water service tie-in',
    tags: ['progress'],
    personnelCount: 3,
    notes: 'Tied the new 2" copper service into the meter and set the 3/4" backflow preventer.',
  },
  {
    title: 'Fixture delivery — level 1',
    tags: ['delivery'],
    personnelCount: 2,
    notes: 'Lavatories, toilets and urinals delivered for level 1 and counted against the submittal. Two cracked lav bowls sent back.',
    materialsReceived: '8 lavatories, 6 ADA toilets, 4 wall-hung urinals',
    issues: 'Two lavatory bowls cracked in shipping — replacements due Friday.',
  },
  {
    title: 'Water heater set',
    tags: ['progress'],
    personnelCount: 3,
    notes: 'Set the 100-gal commercial water heater with expansion tank and mixing valve. Venting and gas by others.',
  },
  {
    title: 'Domestic water pressure test',
    tags: ['inspection'],
    personnelCount: 2,
    notes: 'Domestic water lines held 150 PSI for two hours with no loss. Pipe insulation can start.',
  },
  {
    title: PLUMBING_DETAIL_LOG,
    tags: ['inspection', 'delivery', 'issue'],
    personnelCount: 4,
    notes:
      'Rough-in inspection on the level 2 restroom groups. The level 2 fixture order arrived the same morning and is staged in the storage room.',
    workPerformed:
      'Roughed in waste, vent and supply for 8 lavatories, 6 water closets and 4 urinals on level 2; set the fixture carriers.',
    materialsReceived: '8 lavatories, 6 ADA toilets, 4 wall-hung urinals, fixture carriers (flush valves back-ordered)',
    visitorsOnSite: 'City plumbing inspector, GC superintendent',
    issues: 'Inspector flagged a missing cleanout at the north restroom group — added the same afternoon, re-inspection Thursday.',
  },
  {
    title: 'Trim-out — level 1',
    tags: ['progress'],
    personnelCount: 5,
    notes: 'Hung lavatories and toilets, set flush valves and sensor faucets on level 1.',
  },
  {
    title: 'Grease interceptor set',
    tags: ['progress', 'delivery'],
    personnelCount: 4,
    notes: 'Set the 50-GPM grease interceptor at the kitchen and tied in the waste line.',
    materialsReceived: 'Grease interceptor, 50 GPM',
  },
  {
    title: 'Weekly safety walk',
    tags: ['safety'],
    personnelCount: 5,
    notes: 'Safety walk with the GC. Two open floor penetrations covered and labeled.',
  },
  {
    title: 'Backflow certification',
    tags: ['inspection'],
    personnelCount: 1,
    notes: 'Certified tester passed the 3/4" backflow preventer. Tag and report sent to the utility.',
  },
  {
    title: 'Punch list',
    tags: ['progress'],
    personnelCount: 2,
    notes: 'Closed 9 of 11 punch items — caulked fixtures, adjusted flush valves. Two access panels wait on drywall.',
  },
];

// ─── Roofing leads ────────────────────────────────────────────────────────

const ROOF_PLACES = [
  'Doral Logistics Center', 'Kendall Medical Plaza', 'Hialeah Self-Storage', 'Coral Gables Office Park',
  'Miami Lakes Elementary', 'Brickell Bay Hotel', 'Aventura Retail Plaza', 'Pembroke Pines Warehouse',
  'Homestead Distribution Hub', 'Sunrise Corporate Center', 'Plantation Fitness Club', 'Westchester Shopping Center',
  'Miramar Business Park', 'Cutler Bay Library', 'Sweetwater Auto Mall', 'Palmetto Bay Church',
  'Opa-locka Industrial Center', 'Davie Retail Commons', 'North Miami Senior Center', 'Weston Medical Arts',
  'Miami Gardens Warehouse', 'Key Biscayne Condominium', 'Little Havana Retail Block', 'Fort Lauderdale Marina Office',
  'Hollywood Beach Hotel', 'Coconut Grove Marina Office', 'Wynwood Arts Building', 'Medley Truck Terminal',
  'Kendall Lakes Plaza', 'Coral Springs Medical Center', 'Boca Raton Office Park', 'Hallandale Senior Living',
  'Florida City Packing House', 'Miami Springs Golf Club', 'South Beach Parking Garage', 'Tamarac Shopping Plaza',
  'Cooper City Charter School', 'Sunny Isles Beach Resort', 'Lauderhill Distribution Center', 'Hialeah Gardens Warehouse',
  'Bal Harbour Retail Center', 'Palm Springs North Clinic', 'Virginia Gardens Hangar', 'El Portal Community Center',
  'Pinecrest Office Commons', 'Bay Harbor Islands Condominium', 'Golden Beach Clubhouse', 'Biscayne Park Library',
  'Doral Data Center', 'West Kendall Self-Storage',
];
const ROOF_SCOPES = [
  'TPO Re-Roof', 'Silicone Coating Restoration', 'Mod-Bit Recover', 'Leak Repair & Flashing',
  'Tear-Off & Replace', 'Tapered Insulation Upgrade',
];
export const ROOFING_LEAD_NAMES = ROOF_PLACES.map((place, i) => `${place} — ${ROOF_SCOPES[(i * 7) % ROOF_SCOPES.length]}`);

// ─── Estimates ────────────────────────────────────────────────────────────

export const ELECTRICAL_BID = {
  name: 'Doral Corporate Park — EV Charging & Service Upgrade',
  lines: [
    {
      mark: '01',
      sku: 'EVSE-L2',
      description: 'Level 2 EV chargers on pedestals — furnish and install',
      quantity: 8,
      costs: [
        ['material', 'Level 2 EV Charger', 1, 650, 'each'],
        ['material', 'Pedestal & mounting kit', 1, 210, 'each'],
        ['labor', 'Journeyman Electrician', 5, 62, 'hour'],
        ['labor', 'Apprentice Electrician', 5, 38, 'hour'],
      ],
    },
    {
      mark: '02',
      sku: 'EMT-34',
      description: 'Branch circuits — 3/4" EMT and #10 THHN to each charger',
      costs: [
        ['material', '3/4" EMT (10ft)', 64, 9, 'each'],
        ['material', '#10 THHN (500ft)', 6, 122, 'each'],
        ['material', '50A 2-Pole Breaker', 8, 28, 'each'],
        ['labor', 'Journeyman Electrician', 40, 62, 'hour'],
        ['labor', 'Apprentice Electrician', 40, 38, 'hour'],
      ],
    },
    {
      mark: '03',
      sku: 'TRENCH-LF',
      description: 'Trenching and 2" PVC feeder to the parking area',
      costs: [
        ['other', 'Trenching', 180, 9, 'lnft'],
        ['material', '2" PVC Sch40 (10ft)', 20, 14, 'each'],
        ['material', '4/0 SER Feeder Cable', 380, 6, 'lnft'],
        ['labor', 'Journeyman Electrician', 24, 62, 'hour'],
      ],
    },
    {
      mark: '04',
      sku: 'PNL-400A',
      description: '400A service panel and load management',
      costs: [
        ['material', '400A Service Panel', 1, 1450, 'each'],
        ['material', '100A Disconnect', 2, 145, 'each'],
        ['labor', 'Foreman', 16, 78, 'hour'],
        ['labor', 'Journeyman Electrician', 16, 62, 'hour'],
      ],
    },
    {
      mark: '05',
      description: 'Permits, utility coordination and commissioning',
      costs: [
        ['other', 'Electrical permit & inspection fees', 1, 650, 'each'],
        ['labor', 'Foreman', 8, 78, 'hour'],
      ],
    },
  ],
};

export const FRAMING_BID = {
  name: 'Kendall Townhomes Bldg C — Wood Framing Package',
  lines: [
    {
      mark: '01',
      sku: 'LBR-PT-2X4',
      description: 'Layout, anchors and PT sill plates',
      costs: [
        ['material', '2x4x8 PT Bottom Plate', 140, 5, 'each'],
        ['material', 'Anchor Bolts', 121, 2, 'each'],
        ['material', 'Sill Seal', 6, 14, 'roll'],
        ['labor', 'Carpenter', 24, 48, 'hour'],
      ],
    },
    {
      mark: '02',
      sku: 'LBR-2X6X8',
      description: 'Exterior walls — 2x6 studs @ 16" o.c., 1/2" plywood sheathing',
      costs: [
        ['material', '2x6x8 Stud', 628, 5, 'each'],
        ['material', '1/2" Plywood', 96, 32, 'sheet'],
        ['material', '16d Framing Nails', 8, 38, 'box'],
        ['material', 'Simpson Hold-Down', 24, 18, 'each'],
        ['labor', 'Carpenter', 120, 48, 'hour'],
        ['labor', 'Foreman', 24, 78, 'hour'],
      ],
    },
    {
      mark: '03',
      sku: 'ENG-IJOIST',
      description: 'Floor system — 11-7/8" I-joists, 3/4" OSB subfloor',
      costs: [
        ['material', 'I-Joist 11-7/8', 1450, 4, 'lnft'],
        ['material', 'Simpson Joist Hanger', 98, 2, 'each'],
        ['material', '3/4" OSB Sheathing', 88, 28, 'sheet'],
        ['material', 'Construction Adhesive', 6, 95, 'case'],
        ['labor', 'Carpenter', 80, 48, 'hour'],
      ],
    },
    {
      mark: '04',
      sku: 'ENG-TRUSS-ROOF',
      description: 'Roof trusses — set, brace and tie down',
      costs: [
        ['material', 'Roof Truss', 42, 85, 'each'],
        ['material', 'Hurricane Tie', 180, 1, 'each'],
        ['material', 'Temporary Bracing Package', 1, 240, 'each'],
        ['other', 'Crane — Truss Set', 1, 1650, 'day'],
        ['labor', 'Carpenter', 64, 48, 'hour'],
      ],
    },
  ],
};

export const GLAZING_BID = {
  name: 'Coral Gables Medical Office — Storefront & Impact Windows',
  lines: [
    {
      mark: 'SF-1',
      sku: 'SF-FRM',
      description: 'Storefront elevation A — 24\'-0" x 10\'-0", 2" x 4-1/2" framing, 1" IGU',
      costs: [
        ['material', 'Storefront Framing 2" x 4-1/2"', 104, 16, 'lnft'],
        ['material', '1" Insulated Glass Unit', 220, 22, 'sqft'],
        ['material', 'Storefront Subsill', 24, 9, 'lnft'],
        ['material', 'Structural Glazing Silicone', 8, 19, 'tube'],
        ['labor', 'Lead Glazier', 24, 55, 'hour'],
        ['labor', 'Glazier Helper', 24, 34, 'hour'],
      ],
    },
    {
      mark: 'D-1',
      sku: 'SF-DR-3070',
      description: 'Entrance door pair 3070 — offset pivots, closers, panic devices',
      costs: [
        ['material', 'Aluminum Entrance Door 3070', 2, 1650, 'each'],
        ['material', 'Offset Pivot Set', 2, 95, 'each'],
        ['material', 'Door Closer', 2, 185, 'each'],
        ['material', 'Panic Exit Device', 2, 425, 'each'],
        ['labor', 'Lead Glazier', 10, 55, 'hour'],
        ['labor', 'Glazier Helper', 10, 34, 'hour'],
      ],
    },
    {
      mark: 'W-1',
      sku: 'GL-IMP-916',
      description: 'Impact fixed windows 4\'-0" x 6\'-0", 9/16" laminated',
      quantity: 8,
      costs: [
        ['material', '9/16" Laminated Impact Glass', 24, 26, 'sqft'],
        ['material', 'Storefront Framing 2" x 4-1/2"', 20, 16, 'lnft'],
        ['material', 'Silicone Sealant', 2, 14, 'tube'],
        ['labor', 'Lead Glazier', 3, 55, 'hour'],
        ['labor', 'Glazier Helper', 3, 34, 'hour'],
      ],
    },
    {
      mark: 'W-2',
      sku: 'GL-IMP-916',
      description: 'Impact transoms 4\'-0" x 2\'-0", 9/16" laminated',
      quantity: 8,
      costs: [
        ['material', '9/16" Laminated Impact Glass', 8, 26, 'sqft'],
        ['material', 'Storefront Framing 2" x 4-1/2"', 12, 16, 'lnft'],
        ['material', 'Silicone Sealant', 1, 14, 'tube'],
        ['labor', 'Lead Glazier', 1.5, 55, 'hour'],
        ['labor', 'Glazier Helper', 1.5, 34, 'hour'],
      ],
    },
    {
      mark: 'FM-1',
      sku: 'LAB-MEASURE',
      description: 'Field measure, shop drawings and NOA package',
      costs: [
        ['labor', 'Field Measure & Survey', 8, 85, 'hour'],
        ['other', 'Engineering & NOA submittal package', 1, 1850, 'each'],
      ],
    },
  ],
};

// ─── Pay application (glazing) ────────────────────────────────────────────

export const GLAZING_PAY_APP = {
  jobName: 'Brickell Retail Center — Storefront Replacement',
  periodStart: '2026-09-01',
  periodEnd: '2026-09-30',
  lines: [
    { description: 'Shop drawings, engineering & NOA', scheduledValue: 4850, previous: 4850 },
    { description: 'Storefront framing — furnish', scheduledValue: 18600, previous: 11160, thisPeriod: 7440 },
    { description: 'Entrance doors & hardware — furnish', scheduledValue: 9450, previous: 0, thisPeriod: 9450 },
    { description: 'Glass & IGUs — furnish', scheduledValue: 22300, previous: 8920, thisPeriod: 8920, materialsStored: 4460 },
    { description: 'Storefront installation', scheduledValue: 16800, previous: 3360, thisPeriod: 6720 },
    { description: 'Impact window installation', scheduledValue: 12600, previous: 0, thisPeriod: 3780 },
    { description: 'Sealants, caulking & water testing', scheduledValue: 3950, previous: 0 },
    { description: 'Punch list & closeout', scheduledValue: 2450, previous: 0 },
  ],
};

// ─── Change order (roofing) ───────────────────────────────────────────────

export const ROOFING_CO = {
  project: 'Gulfstream Self-Storage — Tear-Off & Replace',
  title: 'Replace rotted roof deck found at tear-off',
  description:
    "Tear-off exposed water-damaged plywood deck along the north parapet and at two drain sumps. Replace the damaged decking, add nailers, and rebuild the sumps; verified on site with the owner's rep.",
  items: [
    {
      changeType: 'add',
      markName: 'DK-1',
      description: 'Replace rotted 1/2" plywood roof deck',
      quantity: '46',
      sublines: [
        { type: 'material', description: '1/2" Plywood deck sheet', quantity: '1', unitCost: '32.00', unitOfMeasure: 'sheet' },
        { type: 'labor', description: 'Roofing Labor', quantity: '0.75', unitCost: '48.00', unitOfMeasure: 'hour' },
      ],
    },
    {
      changeType: 'add',
      markName: 'NL-1',
      description: 'Wood nailers & blocking at north parapet',
      quantity: '120',
      sublines: [
        { type: 'material', description: 'Wood Nailers & Blocking', quantity: '1', unitCost: '3.50', unitOfMeasure: 'lnft' },
        { type: 'labor', description: 'Roofing Labor', quantity: '0.1', unitCost: '48.00', unitOfMeasure: 'hour' },
      ],
    },
    {
      changeType: 'add',
      markName: 'DS-1',
      description: 'Rebuild drain sumps with new roof drains',
      quantity: '2',
      sublines: [
        { type: 'material', description: 'Roof Drain', quantity: '1', unitCost: '145.00', unitOfMeasure: 'each' },
        { type: 'material', description: 'Sealant/Mastic', quantity: '2', unitCost: '6.00', unitOfMeasure: 'tube' },
        { type: 'labor', description: 'Roofing Labor', quantity: '4', unitCost: '48.00', unitOfMeasure: 'hour' },
      ],
    },
  ],
};

// ─── Schedules ────────────────────────────────────────────────────────────

export const ELECTRICAL_SCHEDULE = {
  project: 'Grand School — EV Charging',
  phases: [
    {
      name: 'Permits & Submittals',
      status: 'completed',
      tasks: [
        { name: 'Permit application & load calc', who: 'dprice', from: -30, to: -27, status: 'done' },
        { name: 'Utility service request', who: 'tnguyen', from: -28, to: -22, status: 'done' },
        { name: 'Charger submittals approved', who: 'dprice', from: -26, to: -20, status: 'done' },
      ],
    },
    {
      name: 'Underground',
      status: 'completed',
      tasks: [
        { name: 'Trench & set 2" PVC feeder', who: 'bsantos', from: -19, to: -14, status: 'done' },
        { name: 'Underground inspection', who: 'rkhan', from: -13, to: -13, status: 'done', after: ['Trench & set 2" PVC feeder'] },
      ],
    },
    {
      name: 'Rough-In & Gear',
      status: 'in_progress',
      tasks: [
        { name: 'Set 400A service panel', who: 'bsantos', from: -10, to: -7, status: 'done', after: ['Underground inspection'] },
        { name: 'Pull branch circuits to pedestals', who: 'bsantos', from: -6, to: 2, status: 'in_progress', priority: 'high', after: ['Set 400A service panel'] },
        { name: 'Rough-in inspection', who: 'rkhan', from: 3, to: 3, status: 'todo', after: ['Pull branch circuits to pedestals'] },
      ],
    },
    {
      name: 'Trim & Energize',
      status: 'pending',
      tasks: [
        { name: 'Set chargers on pedestals', who: 'bsantos', from: 4, to: 8, status: 'todo', after: ['Rough-in inspection'] },
        { name: 'Utility energization', who: 'tnguyen', from: 9, to: 9, status: 'todo', after: ['Set chargers on pedestals'] },
        { name: 'Commission & network chargers', who: 'rkhan', from: 10, to: 12, status: 'todo', after: ['Utility energization'] },
      ],
    },
  ],
};

export const CONCRETE_SCHEDULE = {
  project: 'Elite Medical Office — Slab on Grade',
  phases: [
    {
      name: 'Layout & Excavation',
      status: 'completed',
      tasks: [
        { name: 'Survey layout', who: 'jpena', from: -24, to: -23, status: 'done' },
        { name: 'Excavate footings', who: 'ttorres', from: -22, to: -19, status: 'done', after: ['Survey layout'] },
      ],
    },
    {
      name: 'Forming',
      status: 'completed',
      tasks: [
        { name: 'Set footing forms', who: 'ttorres', from: -18, to: -16, status: 'done', after: ['Excavate footings'] },
        { name: 'Set slab edge forms & screeds', who: 'ttorres', from: -15, to: -14, status: 'done', after: ['Set footing forms'] },
      ],
    },
    {
      name: 'Rebar',
      status: 'completed',
      tasks: [
        { name: 'Place & tie footing steel', who: 'ttorres', from: -13, to: -11, status: 'done', after: ['Set footing forms'] },
        { name: 'Set dowels & slab mesh', who: 'ttorres', from: -10, to: -9, status: 'done', after: ['Place & tie footing steel'] },
      ],
    },
    {
      name: 'Inspection',
      status: 'completed',
      tasks: [
        { name: 'Pre-pour inspection', who: 'kday', from: -8, to: -8, status: 'done', after: ['Set dowels & slab mesh'] },
      ],
    },
    {
      name: 'Placement & Finish',
      status: 'in_progress',
      tasks: [
        { name: 'Pour footings', who: 'ttorres', from: -7, to: -7, status: 'done', after: ['Pre-pour inspection'] },
        { name: 'Vapor barrier & slab prep', who: 'ttorres', from: -5, to: -2, status: 'done', after: ['Pour footings'] },
        { name: 'Pour slab — area A', who: 'ttorres', from: -1, to: 0, status: 'in_progress', priority: 'high', after: ['Vapor barrier & slab prep'] },
        { name: 'Pour slab — area B', who: 'ttorres', from: 3, to: 4, status: 'todo', after: ['Pour slab — area A'] },
      ],
    },
    {
      name: 'Cure & Close Out',
      status: 'pending',
      tasks: [
        { name: 'Saw-cut joints & cure', who: 'jpena', from: 5, to: 6, status: 'todo', after: ['Pour slab — area B'] },
        { name: 'Strip forms & backfill', who: 'jpena', from: 7, to: 9, status: 'todo', after: ['Saw-cut joints & cure'] },
      ],
    },
  ],
};

export const FRAMING_SCHEDULE = {
  project: 'Atlantic Community Center — Wood Framing',
  phases: [
    {
      name: 'Layout & Sill Plates',
      status: 'completed',
      tasks: [
        { name: 'Snap layout & set anchors', who: 'fsalas', from: -20, to: -18, status: 'done' },
        { name: 'Install PT sill plates', who: 'fsalas', from: -17, to: -15, status: 'done', after: ['Snap layout & set anchors'] },
      ],
    },
    {
      name: 'Walls — Level 1',
      status: 'in_progress',
      tasks: [
        { name: 'Frame exterior walls — L1', who: 'fsalas', from: -14, to: -8, status: 'done', after: ['Install PT sill plates'] },
        { name: 'Frame interior partitions — L1', who: 'fsalas', from: -7, to: -3, status: 'done', after: ['Frame exterior walls — L1'] },
        { name: 'Sheathing & hold-downs — L1', who: 'dobrien', from: -4, to: 1, status: 'in_progress', priority: 'high', after: ['Frame exterior walls — L1'] },
      ],
    },
    {
      name: 'Floor System',
      status: 'in_progress',
      tasks: [
        { name: 'Set I-joists & hangers — L2', who: 'fsalas', from: 0, to: 4, status: 'in_progress', after: ['Frame exterior walls — L1'] },
        { name: 'Glue & nail subfloor — L2', who: 'fsalas', from: 5, to: 7, status: 'todo', after: ['Set I-joists & hangers — L2'] },
      ],
    },
    {
      name: 'Walls — Level 2',
      status: 'pending',
      tasks: [
        { name: 'Frame walls — L2', who: 'fsalas', from: 8, to: 14, status: 'todo', after: ['Glue & nail subfloor — L2'] },
      ],
    },
    {
      name: 'Roof',
      status: 'pending',
      tasks: [
        { name: 'Truss delivery', who: 'cmunoz', from: 15, to: 15, status: 'todo' },
        { name: 'Set & brace trusses', who: 'fsalas', from: 16, to: 19, status: 'todo', after: ['Frame walls — L2', 'Truss delivery'] },
        { name: 'Roof sheathing & hurricane ties', who: 'fsalas', from: 20, to: 23, status: 'todo', after: ['Set & brace trusses'] },
        { name: 'Framing inspection', who: 'cmunoz', from: 24, to: 24, status: 'todo', after: ['Roof sheathing & hurricane ties'] },
      ],
    },
  ],
};
