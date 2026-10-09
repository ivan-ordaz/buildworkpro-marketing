// Records the docs screenshots for bids / projects / pay apps / change orders /
// CRM / field shoot (scenes/docs-areas2.shots.mjs).
//
// The docs need records in specific states — a draft bid priced with cost
// items, a submitted pay app and change order waiting on approval, a lead with
// every field filled in, a project with a real schedule — and the seeded ones
// can't be shown (unnamed bids with "Legacy pricing" rows, schedules of values
// that repeat one description, leads named for the wrong company). These are
// staged through the app's API under their own names, apart from the records
// the demo videos own, and REUSED when a previous run already left them in the
// right state: re-staging an approval record means voiding or rejecting the
// old one, which would litter the very lists the docs photograph.
import { costItems, findContact, freshBid } from './demo-bids.mjs';
import { findProject, findProducts, createChangeOrder } from './demo-change-orders.mjs';
import { stagePayApp, apiAs, markNotificationsRead } from './demo-pay-apps.mjs';
import { stageLead } from './demo-crm.mjs';
import { stageSchedule } from './demo-projects.mjs';

const list = async (api, path) => {
  const rows = await api.get(path);
  return Array.isArray(rows) ? rows : (rows?.items ?? []);
};

/** A contact by company name, created from `spec` when missing. */
export async function ensureContact(api, spec) {
  const found = (await list(api, `/api/contacts?search=${encodeURIComponent(spec.companyName)}&limit=20`)).find(
    (c) => c.companyName === spec.companyName && !c.deletedAt
  );
  return found ?? api.post('/api/contacts', spec);
}

// The GC the docs bid goes to. Its address is on a seeded demo domain, which
// the app's mail transport drops — the Send Bid dialog is only ever opened for
// a screenshot, but the To line it prefills must never be a deliverable inbox.
export const DOCS_GC = {
  companyName: 'Keystone Builders Group',
  firstName: 'Dana',
  lastName: 'Whitfield',
  email: 'dana.whitfield@keystonebuildersgroup.com',
  phone: '(305) 555-0144',
  position: 'Senior Project Manager',
  type: 'general_contractor',
};

export const DOCS_BID = 'Coral Gables Library — HVAC Retrofit';

const BID_LINES = [
  {
    markName: '01',
    description: 'Demo and haul-off of existing rooftop units',
    quantity: '1',
    sublines: costItems([
      ['labor', 'Demo crew', 16, 75, 'hour'],
      ['other', 'Dumpster and disposal', 1, 525, 'each'],
    ]),
  },
  {
    markName: '02',
    description: '7.5-ton packaged rooftop units, curbs and connections',
    quantity: '2',
    sublines: costItems([
      ['material', '7.5-Ton Packaged Rooftop Unit', 1, 8950, 'each'],
      ['material', 'Curb adapter, insulated', 1, 685, 'each'],
      ['labor', 'Installation Labor', 18, 75, 'hour'],
      ['labor', 'Electrical Labor', 4, 95, 'hour'],
    ]),
  },
  {
    markName: '03',
    description: 'Ductwork transitions, supply and return grilles',
    quantity: '1',
    sublines: costItems([
      ['material', 'Sheet Metal Ductwork', 160, 18, 'lnft'],
      ['material', 'Supply Grille 12x8', 18, 16, 'each'],
      ['labor', 'Installation Labor', 32, 75, 'hour'],
    ]),
  },
  {
    markName: '04',
    description: 'Controls, startup, test and balance',
    quantity: '1',
    sublines: costItems([
      ['material', 'Smart Wi-Fi Thermostat', 4, 115, 'each'],
      ['labor', 'Startup & Commissioning', 2, 220, 'each'],
      ['other', 'Test & balance (subcontract)', 1, 1450, 'each'],
    ]),
  },
].map((line, i) => ({ ...line, unitPrice: '0', kind: 'item', order: i }));

/**
 * A draft bid to Keystone Builders Group with four lines priced from material,
 * labor and other cost items, plus two project costs. Reused while it is still
 * a draft with its four lines; otherwise rebuilt.
 */
export async function stageDocsBid(api) {
  const gc = await ensureContact(api, DOCS_GC);
  const existing = (await list(api, `/api/bids?search=${encodeURIComponent(DOCS_BID)}&limit=20`)).find(
    (b) => b.name === DOCS_BID && !b.deletedAt
  );
  if (existing && existing.status === 'draft') {
    const lines = await list(api, `/api/bids/${existing.id}/line-items`);
    const costs = await list(api, `/api/bids/${existing.id}/distributed-costs`);
    if (lines.length === BID_LINES.length && costs.length === 2) return existing;
  }
  const bid = await freshBid(api, {
    name: DOCS_BID,
    contactId: gc.id,
    lineItems: BID_LINES,
    extra: {
      siteAddress: '2701 Ponce de Leon Blvd',
      siteCity: 'Coral Gables',
      siteZipCode: '33134',
      terms:
        'Net 30. 50% deposit required prior to ordering equipment. Price valid for 30 days; equipment pricing subject to manufacturer increases after that date.',
    },
  });
  const products = await findProducts(api, ['PERMIT-MECH', 'CRANE-SET']);
  await api.post(`/api/bids/${bid.id}/distributed-costs`, {
    productId: products['PERMIT-MECH'].id,
    name: 'Mechanical Permit',
    description: 'City of Coral Gables mechanical permit and inspections',
    rate: '850.00',
  });
  await api.post(`/api/bids/${bid.id}/distributed-costs`, {
    productId: products['CRANE-SET'].id,
    name: 'Crane / Rigging',
    description: 'Crane day to set both rooftop units',
    rate: '1900.00',
  });
  return api.get(`/api/bids/${bid.id}`);
}

export const DOCS_PAY_APP_JOB = 'Pinnacle Office Tower — VAV Retrofit';

/**
 * A pay app submitted by the project manager and waiting on approval, on its
 * own small job. Reused while it is still submitted.
 */
export async function stageDocsPayApp(api) {
  const project = (await list(api, `/api/projects?search=${encodeURIComponent(DOCS_PAY_APP_JOB)}&limit=20`)).find(
    (p) => p.name === DOCS_PAY_APP_JOB && !p.deletedAt
  );
  if (project) {
    const submitted = (await list(api, `/api/projects/${project.id}/pay-apps`)).find((pa) => pa.status === 'submitted');
    if (submitted) return { projectId: project.id, payAppId: submitted.id };
  }
  const staged = await stagePayApp(api, {
    jobName: DOCS_PAY_APP_JOB,
    customer: 'Pinnacle Office Tower Enterprises',
    siteAddress: '1001 Brickell Bay Dr, Miami, FL',
    periodStart: '2026-09-01',
    periodEnd: '2026-09-30',
    lines: [
      { description: 'Mobilization, submittals and permits', scheduledValue: 3200, previous: 3200, thisPeriod: 0 },
      { description: 'Demo existing VAV boxes and controls', scheduledValue: 6800, previous: 6800, thisPeriod: 0 },
      { description: 'VAV boxes with reheat — furnish and set', scheduledValue: 28400, previous: 11360, thisPeriod: 9940 },
      { description: 'Branch duct and flex connections', scheduledValue: 9600, previous: 2880, thisPeriod: 3840 },
      { description: 'DDC controls and thermostats', scheduledValue: 12400, previous: 0, thisPeriod: 4960 },
      { description: 'Test and balance', scheduledValue: 3800, previous: 0, thisPeriod: 0 },
      { description: 'Startup, training and closeout', scheduledValue: 2600, previous: 0, thisPeriod: 0 },
    ],
  });
  const manager = await apiAs('mmurphy');
  try {
    await manager.api.patch(`/api/pay-apps/${staged.payAppId}/submit`);
  } finally {
    await manager.dispose();
  }
  return staged;
}

export const DOCS_CO_PROJECT = 'Orchid Condo Building — HVAC Install';
export const DOCS_CO_TITLE = 'Condensate reroute';

/**
 * A submitted change order with two priced marks, on a project with no other
 * change orders so its Contract Flow reads cleanly. Reused while still
 * submitted. The seed leaves `originalContractValue` empty (Contract Flow
 * would open on "Original Contract $0.00"), so anchor it on the contract value.
 */
export async function stageDocsChangeOrder(api) {
  const project = await findProject(api, DOCS_CO_PROJECT);
  if (!project.originalContractValue || project.status !== 'in_progress') {
    await api.put(`/api/projects/${project.id}`, {
      status: 'in_progress',
      ...(project.originalContractValue ? {} : { originalContractValue: project.contractValue }),
    });
  }
  const cos = await list(api, `/api/projects/${project.id}/change-orders?limit=200`);
  const live = cos.find((co) => co.title === DOCS_CO_TITLE && co.status === 'submitted');
  if (live) return live;
  const products = await findProducts(api, ['LAB-INSTALL']);
  return createChangeOrder(api, project.id, {
    title: DOCS_CO_TITLE,
    reason: 'field_conditions',
    description:
      'The existing condensate risers are undersized for the new fan coils. Reroute the drains on floors 3-8 to the new riser and firestop the added penetrations.',
    submit: true,
    items: [
      {
        changeType: 'add',
        markName: 'CD-1',
        description: 'Reroute fan coil condensate drains to new riser',
        quantity: '12',
        sublines: [
          { type: 'material', description: '3/4" PVC drain line, fittings and trap', quantity: '1', unitCost: '48.00', unitOfMeasure: 'each' },
          { type: 'labor', productId: products['LAB-INSTALL'].id, description: 'Installation Labor', quantity: '1.5', unitCost: '75.00', unitOfMeasure: 'hour' },
        ],
      },
      {
        changeType: 'add',
        markName: 'CD-2',
        description: 'Core drill and firestop floor penetrations',
        quantity: '6',
        sublines: [
          { type: 'other', description: 'Core drilling, 2" through slab', quantity: '1', unitCost: '165.00', unitOfMeasure: 'each' },
          { type: 'material', description: 'Firestop sealant and collar', quantity: '1', unitCost: '42.00', unitOfMeasure: 'each' },
        ],
      },
    ],
  });
}

export const DOCS_LEAD = 'Heron Medical Office — VRF Upgrade';

/** A lead with every Overview field filled in. Reused when it already exists. */
export async function stageDocsLead(api) {
  const existing = (await list(api, `/api/leads?search=${encodeURIComponent(DOCS_LEAD)}&limit=20`)).find(
    (l) => l.name === DOCS_LEAD && !l.deletedAt
  );
  if (existing) return existing;
  return stageLead(api, {
    name: DOCS_LEAD,
    stage: 'Site Visit Scheduled',
    company: 'Heron Medical Office Enterprises',
    closeInDays: 45,
    estimatedValue: '96500',
    probability: 40,
    source: 'referral',
    projectType: 'commercial',
    description:
      'Replace four aging split systems serving the second-floor exam rooms with a VRF system. Owner wants work phased around clinic hours; site walk with the facilities manager is booked.',
    siteAddress: '8950 SW 74th Ct',
    siteCity: 'Miami',
    siteState: 'FL',
    siteZipCode: '33156',
  });
}

export const DOCS_SCHEDULE_PROJECT = 'Tropical Office Tower — HVAC Install';

const SCHEDULE = [
  {
    name: 'Submittals & Permits',
    status: 'completed',
    tasks: [
      { name: 'Equipment submittals approved', who: 'rmoreno', from: -38, to: -33, status: 'done' },
      { name: 'Mechanical permit issued', who: 'mmurphy', from: -32, to: -27, status: 'done' },
    ],
  },
  {
    name: 'Rough-In',
    status: 'in_progress',
    tasks: [
      { name: 'Hang main supply trunk, floors 2–4', who: 'jrodriguez', from: -14, to: -6, status: 'done' },
      { name: 'Refrigerant line sets to fan coils', who: 'freyes', from: -5, to: 2, status: 'in_progress', priority: 'high' },
      { name: 'Condensate drains and traps', who: 'freyes', from: 3, to: 6, status: 'todo' },
    ],
  },
  {
    name: 'Equipment Set',
    status: 'pending',
    tasks: [
      { name: 'Set condensing units on roof', who: 'jrodriguez', from: 7, to: 9, status: 'todo', priority: 'high' },
      { name: 'Electrical tie-in with the electrician', who: 'mmurphy', from: 10, to: 11, status: 'todo' },
    ],
  },
  {
    name: 'Startup & Closeout',
    status: 'pending',
    tasks: [
      { name: 'Startup and commissioning', who: 'mmurphy', from: 14, to: 16, status: 'todo' },
      { name: 'Owner walkthrough and O&M manuals', who: 'rmoreno', from: 18, to: 19, status: 'todo' },
    ],
  },
];

/** A dated, assigned schedule on Tropical Office Tower. Rebuilt only if it drifted. */
export async function stageDocsSchedule(api) {
  const project = await findProject(api, DOCS_SCHEDULE_PROJECT);
  const full = await api.get(`/api/projects/${project.id}`);
  const have = (full.phases ?? []).map((p) => p.name).join('|');
  const want = SCHEDULE.map((p) => p.name).join('|');
  const taskCount = SCHEDULE.reduce((n, p) => n + p.tasks.length, 0);
  if (have !== want || (full.tasks ?? []).length !== taskCount) {
    await stageSchedule(api, project.id, { phases: SCHEDULE });
  }
  return project;
}

export { findContact, markNotificationsRead };
