// Stage the records the marketing-site screenshots (public/screenshots/NN-*)
// show, in the seeded HVAC demo tenant. Each record is named for the customer
// it belongs to and priced with real material + labor cost items, so a shot
// never shows the seed's unnamed "Legacy pricing" bids, random site-log text,
// or out-of-scale change orders. Every function is safe to re-run.
import { costItems, findContact, freshBid } from './demo-bids.mjs';
import { clearChangeOrders, createChangeOrder, findProducts } from './demo-change-orders.mjs';
import { stageLead } from './demo-crm.mjs';
import { apiAs, stagePayApp } from './demo-pay-apps.mjs';
import { stageSchedule } from './demo-projects.mjs';

const lines = (rows) => rows.map((line, i) => ({ ...line, unitPrice: '0', kind: 'item', order: i }));

// ── 05: an accepted bid ──────────────────────────────────────────────────
export const ACCEPTED_BID = 'Pinnacle Data Center — CRAC Unit Replacement';

export async function stageAcceptedBid(api) {
  const customer = await findContact(api, 'Pinnacle Data Center Enterprises');
  const bid = await freshBid(api, {
    name: ACCEPTED_BID,
    contactId: customer.id,
    extra: { siteAddress: '3900 NW 79th Ave', siteCity: 'Doral', siteZipCode: '33166' },
    lineItems: lines([
      {
        markName: '01',
        description: 'Disconnect, demo and haul-off of two existing CRAC units',
        quantity: '1',
        sublines: costItems([
          ['labor', 'Demo crew', 16, 75, 'hour'],
          ['other', 'Disposal and refrigerant recovery', 1, 650, 'each'],
        ]),
      },
      {
        markName: '02',
        description: '30-ton downflow CRAC units — furnish and set',
        quantity: '2',
        sublines: costItems([
          ['material', '30-Ton Downflow CRAC Unit', 1, 38500, 'each'],
          ['material', 'Floor stand and seismic kit', 1, 1200, 'each'],
          ['labor', 'Installation Labor', 24, 75, 'hour'],
        ]),
      },
      {
        markName: '03',
        description: 'Condenser piping, refrigerant and pressure test',
        quantity: '1',
        sublines: costItems([
          ['material', 'Copper piping and fittings', 1, 2400, 'each'],
          ['material', 'R-410A refrigerant', 1, 1100, 'each'],
          ['labor', 'Installation Labor', 32, 75, 'hour'],
        ]),
      },
      {
        markName: '04',
        description: 'Controls and BMS integration',
        quantity: '1',
        sublines: costItems([
          ['material', 'Unit controller and BMS gateway', 1, 1850, 'each'],
          ['labor', 'Electrical Labor', 16, 95, 'hour'],
        ]),
      },
      {
        markName: '05',
        description: 'Startup, testing and commissioning',
        quantity: '1',
        sublines: costItems([['labor', 'Startup & Commissioning', 4, 220, 'each']]),
      },
    ]),
  });
  await api.patch(`/api/bids/${bid.id}/accept`, { acceptedBy: 'Jose Williams' });
  return bid;
}

// ── 06 / 07 / 27: a sent bid and the lead it came from ───────────────────
export const SENT_JOB = 'Heron Medical Office — VRF Retrofit';

export async function stageSentBidWithLead(api) {
  const lead = await stageLead(api, {
    name: SENT_JOB,
    stage: 'Bid Sent',
    company: 'Heron Medical Office Enterprises',
    closeInDays: 24,
    probability: 60,
    estimatedValue: '180000',
    source: 'referral',
    projectType: 'commercial',
    description:
      'Replace the failing rooftop split systems serving floors 2–4 with a heat-recovery VRF system. Owner wants the work phased around clinic hours.',
    siteAddress: '1200 Alton Rd',
    siteCity: 'Miami Beach',
    siteState: 'FL',
    siteZipCode: '33139',
  });
  const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString();
  for (const a of [
    { type: 'call', subject: 'Intro call with facilities', description: 'Ella walked through the comfort complaints on floors 2–4 and the clinic-hours constraint.', completedAt: day(-19) },
    { type: 'meeting', subject: 'Site walk and roof survey', description: 'Measured the roof openings and confirmed structural for two VRF condensing units.', completedAt: day(-12) },
    { type: 'email', subject: 'Proposal sent', description: 'Sent the VRF retrofit proposal with the phased schedule. Follow up next week.', completedAt: day(-3) },
  ]) {
    await api.post(`/api/leads/${lead.id}/activities`, a);
  }

  const customer = await findContact(api, 'Heron Medical Office Enterprises');
  const bid = await freshBid(api, {
    name: SENT_JOB,
    contactId: customer.id,
    extra: { leadId: lead.id, siteAddress: '1200 Alton Rd', siteCity: 'Miami Beach', siteZipCode: '33139' },
    lineItems: lines([
      {
        markName: '01',
        description: 'VRF heat-recovery condensing units, 16 ton — furnish and set',
        quantity: '2',
        sublines: costItems([
          ['material', '16-Ton VRF Heat Recovery Unit', 1, 26400, 'each'],
          ['other', 'Crane / Rigging', 0.5, 950, 'day'],
          ['labor', 'Installation Labor', 12, 75, 'hour'],
        ]),
      },
      {
        markName: '02',
        description: 'Ducted fan coil units — exam rooms and offices',
        quantity: '14',
        sublines: costItems([
          ['material', 'Ducted Fan Coil, 2-ton', 1, 1450, 'each'],
          ['material', 'Condensate pump and drain kit', 1, 85, 'each'],
          ['labor', 'Installation Labor', 6, 75, 'hour'],
        ]),
      },
      {
        markName: '03',
        description: 'Branch selector boxes and refrigerant piping',
        quantity: '1',
        sublines: costItems([
          ['material', 'Branch selector boxes (4)', 1, 6800, 'each'],
          ['material', 'Copper piping, insulation and hangers', 1, 3900, 'each'],
          ['labor', 'Installation Labor', 120, 75, 'hour'],
        ]),
      },
      {
        markName: '04',
        description: 'Ductwork modifications, supply and return grilles',
        quantity: '1',
        sublines: costItems([
          ['material', 'Sheet Metal Ductwork', 160, 18, 'lnft'],
          ['material', 'Supply Grille 10x6', 28, 14, 'each'],
          ['labor', 'Installation Labor', 40, 75, 'hour'],
        ]),
      },
      {
        markName: '05',
        description: 'Controls, startup and commissioning',
        quantity: '1',
        sublines: costItems([
          ['material', 'VRF central controller', 1, 2600, 'each'],
          ['labor', 'Startup & Commissioning', 2, 220, 'each'],
        ]),
      },
    ]),
  });
  await api.patch(`/api/bids/${bid.id}/status`, { status: 'sent' });
  return { lead, bid };
}

// ── 09 / 16 / 17 / 25: one project's schedule and change orders ──────────
// The project is our own — a bid accepted and converted for a seeded customer —
// so no other scene (or concurrent capture) restages the same seeded project.
export const SCHEDULE_PROJECT = 'Summit Hotel — Rooftop HVAC Replacement';
const CO_APPROVED = 'Add exhaust fan — 3rd floor laundry room';
const CO_SUBMITTED = 'Upsize RTU-2 to 7.5 tons';

async function ensureScheduleProject(api) {
  const found = (await api.get(`/api/projects?search=${encodeURIComponent(SCHEDULE_PROJECT)}&limit=50`)) ?? [];
  const existing = found.find((p) => p.name === SCHEDULE_PROJECT && !p.deletedAt);
  if (existing) return existing.id;

  const customer = await findContact(api, 'Summit Hotel Holdings');
  const bid = await freshBid(api, {
    name: SCHEDULE_PROJECT,
    contactId: customer.id,
    extra: { siteAddress: '6060 Collins Ave', siteCity: 'Miami Beach', siteZipCode: '33140' },
    lineItems: lines([
      {
        markName: '01', description: 'Rooftop units (4), 6 ton — furnish, crane set and curb adapters', quantity: '4',
        sublines: costItems([
          ['material', '6-Ton Packaged Rooftop Unit', 1, 9800, 'each'],
          ['material', 'Curb adapter', 1, 685, 'each'],
          ['other', 'Crane / Rigging', 0.25, 950, 'day'],
          ['labor', 'Installation Labor', 14, 75, 'hour'],
        ]),
      },
      {
        markName: '02', description: 'Air handlers and VAV boxes — guest corridors', quantity: '1',
        sublines: costItems([
          ['material', 'Air handler, 5,000 CFM', 2, 7400, 'each'],
          ['material', 'VAV boxes', 12, 640, 'each'],
          ['labor', 'Installation Labor', 96, 75, 'hour'],
        ]),
      },
      {
        markName: '03', description: 'Supply and return ductwork, floors 1–3', quantity: '1',
        sublines: costItems([
          ['material', 'Sheet Metal Ductwork', 420, 18, 'lnft'],
          ['labor', 'Installation Labor', 160, 75, 'hour'],
        ]),
      },
      {
        markName: '04', description: 'Controls, startup, test and balance', quantity: '1',
        sublines: costItems([
          ['material', 'Building controller and thermostats', 1, 5200, 'each'],
          ['labor', 'Startup & Commissioning', 6, 220, 'each'],
        ]),
      },
    ]),
  });
  await api.patch(`/api/bids/${bid.id}/accept`, { acceptedBy: 'Jose Sanchez' });
  const converted = await api.post(`/api/bids/${bid.id}/convert-to-project`, {
    mappingStrategy: 'blank',
    name: SCHEDULE_PROJECT,
  });
  const projectId = converted.project?.id ?? converted.projectId ?? converted.id;
  if (!projectId) throw new Error(`convert-to-project returned no project id: ${JSON.stringify(converted).slice(0, 200)}`);
  return projectId;
}

export async function stageProjectSchedule(api) {
  const projectId = await ensureScheduleProject(api);
  await stageSchedule(api, projectId, {
    phases: [
      {
        name: 'Submittals & Procurement',
        status: 'completed',
        tasks: [
          { name: 'Equipment submittals approved', who: 'rmoreno', from: -34, to: -31, status: 'done' },
          { name: 'Mechanical permit issued', who: 'mmurphy', from: -33, to: -27, status: 'done' },
          { name: 'Order rooftop units & air handlers', who: 'rmoreno', from: -30, to: -28, status: 'done', after: ['Equipment submittals approved'] },
        ],
      },
      {
        name: 'Rough-In',
        status: 'completed',
        tasks: [
          { name: 'Supply & return trunk lines, floors 1–3', who: 'jrodriguez', from: -24, to: -15, status: 'done', after: ['Mechanical permit issued'] },
          { name: 'Refrigerant piping', who: 'freyes', from: -16, to: -10, status: 'done' },
          { name: 'Mechanical rough-in inspection', who: 'mmurphy', from: -9, to: -9, status: 'done', after: ['Supply & return trunk lines, floors 1–3', 'Refrigerant piping'] },
        ],
      },
      {
        name: 'Equipment Set',
        status: 'in_progress',
        tasks: [
          { name: 'Crane set rooftop units', who: 'jrodriguez', from: -6, to: -6, status: 'done', priority: 'high', after: ['Mechanical rough-in inspection'] },
          { name: 'Air handlers & VAV boxes', who: 'freyes', from: -5, to: 2, status: 'in_progress', priority: 'high', after: ['Mechanical rough-in inspection'] },
          { name: 'Gas & electrical connections', who: 'jrodriguez', from: 1, to: 4, status: 'todo', after: ['Crane set rooftop units'] },
        ],
      },
      {
        name: 'Startup & Closeout',
        status: 'pending',
        tasks: [
          { name: 'Controls & thermostats', who: 'freyes', from: 5, to: 8, status: 'todo', after: ['Air handlers & VAV boxes'] },
          { name: 'Startup & commissioning', who: 'mmurphy', from: 9, to: 10, status: 'todo', priority: 'high', after: ['Gas & electrical connections', 'Controls & thermostats'] },
          { name: 'Test & balance', who: 'freyes', from: 11, to: 14, status: 'todo', after: ['Startup & commissioning'] },
          { name: 'Owner walkthrough & punch list', who: 'rmoreno', from: 15, to: 17, status: 'todo', after: ['Test & balance'] },
          { name: 'Final pay application', who: 'rmoreno', from: 19, to: 19, status: 'todo', after: ['Owner walkthrough & punch list'] },
        ],
      },
    ],
  });
  return projectId;
}

export async function stageProjectChangeOrders(api, projectId) {
  const products = await findProducts(api, ['LAB-INSTALL', 'CRANE-SET']);
  const install = (hours) => ({
    type: 'labor', productId: products['LAB-INSTALL'].id, description: 'Installation Labor',
    quantity: String(hours), unitCost: '75.00', unitOfMeasure: 'hour',
  });
  await clearChangeOrders(api, projectId, [CO_APPROVED, CO_SUBMITTED]);

  const approved = await createChangeOrder(api, projectId, {
    title: CO_APPROVED,
    reason: 'customer_request',
    description: 'Owner is converting a 3rd-floor storage room into the guest laundry. Adds a dedicated exhaust fan with its own roof curb and duct run.',
    submit: true,
    items: [
      {
        changeType: 'add', markName: 'EF-3', description: 'Exhaust fan EF-3, 800 CFM — furnish and install', quantity: '1',
        sublines: [
          { type: 'material', description: 'Roof exhaust fan, 800 CFM', quantity: '1', unitCost: '640.00', unitOfMeasure: 'each' },
          { type: 'material', description: 'Duct, damper and grille', quantity: '1', unitCost: '180.00', unitOfMeasure: 'each' },
          install(6),
        ],
      },
      {
        changeType: 'add', markName: 'RC-3', description: 'Roof curb and flashing for EF-3', quantity: '1',
        sublines: [
          { type: 'material', description: 'Prefabricated roof curb & flashing', quantity: '1', unitCost: '210.00', unitOfMeasure: 'each' },
          install(3),
        ],
      },
    ],
  });
  await api.patch(`/api/change-orders/${approved.id}/approve`, {});

  const submitted = await createChangeOrder(api, projectId, {
    title: CO_SUBMITTED,
    reason: 'design_change',
    description: 'Revised load calc from the engineer puts the 3rd-floor guest zone over capacity. Swaps RTU-2 for a 7.5-ton unit and upsizes its disconnect.',
    submit: true,
    items: [
      {
        changeType: 'modify', markName: 'RTU-2', description: 'RTU-2 upsized from 6 to 7.5 tons — equipment difference', quantity: '1',
        sublines: [
          { type: 'material', description: '7.5-ton RTU, net of 6-ton credit', quantity: '1', unitCost: '2350.00', unitOfMeasure: 'each' },
          { type: 'other', productId: products['CRANE-SET'].id, description: 'Crane / Rigging', quantity: '0.5', unitCost: '950.00', unitOfMeasure: 'day' },
        ],
      },
      {
        changeType: 'add', markName: 'EL-2', description: 'Larger disconnect and whip for RTU-2', quantity: '1',
        sublines: [
          { type: 'material', description: '60A disconnect and whip', quantity: '1', unitCost: '185.00', unitOfMeasure: 'each' },
          install(3),
        ],
      },
    ],
  });
  return {
    approvedId: approved.id,
    submittedId: submitted.id,
  };
}

// ── 13: an approved pay app ──────────────────────────────────────────────
export const PAY_APP_JOB = 'Legacy Restaurant — Kitchen Exhaust & RTU Upgrade';

/**
 * An approved PA-002 on its own job. Approved pay apps cannot be deleted, so
 * a run that finds one already approved reuses it instead of restaging.
 */
export async function ensureApprovedPayApp(api) {
  const projects = await api.get(`/api/projects?search=${encodeURIComponent(PAY_APP_JOB)}&limit=50`);
  for (const project of (projects ?? []).filter((p) => p.name === PAY_APP_JOB)) {
    const payApps = (await api.get(`/api/projects/${project.id}/pay-apps`)) ?? [];
    const approved = payApps.find((pa) => pa.status === 'approved');
    if (approved) return approved.id;
  }
  const staged = await stagePayApp(api, {
    jobName: PAY_APP_JOB,
    customer: 'Legacy Restaurant Real Estate',
    siteAddress: '2140 Coral Way, Miami, FL 33145',
    periodStart: '2026-09-01',
    periodEnd: '2026-09-30',
    lines: [
      { description: 'Mobilization, permits & submittals', scheduledValue: 2400, previous: 2400 },
      { description: 'Demo of existing hood exhaust & RTUs', scheduledValue: 3850, previous: 3850 },
      { description: 'Kitchen exhaust fans & make-up air unit', scheduledValue: 18600, previous: 9300, thisPeriod: 9300 },
      { description: 'Grease duct — welded, wrapped & tested', scheduledValue: 14200, previous: 4260, thisPeriod: 7100 },
      { description: 'Rooftop units (2) — furnish & set', scheduledValue: 26800, previous: 0, thisPeriod: 26800 },
      { description: 'Curbs, roof openings & flashing', scheduledValue: 4300, previous: 0, thisPeriod: 3010 },
      { description: 'Gas piping & electrical tie-in', scheduledValue: 5150, previous: 0, materialsStored: 1840 },
      { description: 'Controls, startup & test and balance', scheduledValue: 3700, previous: 0 },
    ],
  });
  const manager = await apiAs('mmurphy');
  try {
    await manager.api.patch(`/api/pay-apps/${staged.payAppId}/submit`);
  } finally {
    await manager.dispose();
  }
  await api.patch(`/api/pay-apps/${staged.payAppId}/approve`, {});
  return staged.payAppId;
}
