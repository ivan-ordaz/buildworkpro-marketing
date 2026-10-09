// Stage the CRM records the pipeline / lead demo scenes act on.
//
// The seeded leads pair a building-type name with an unrelated company
// ("Office Tower HVAC Install" for a dental clinic) and many have no contact,
// so the demos film leads of their own: named for the customer they belong to,
// with a value, probability and close date that fit their stage. Each staged
// lead is recreated from scratch on every run (the previous run's copy, and any
// project it was converted into, are soft-deleted first), so a take always
// starts from the same board.
import { createHash } from 'node:crypto';

async function list(api, path) {
  const rows = await api.get(path);
  return Array.isArray(rows) ? rows : (rows?.items ?? []);
}

export async function stageId(api, name) {
  const stages = await list(api, '/api/lead-stages');
  const stage = stages.find((s) => s.name === name);
  if (!stage) throw new Error(`lead stage "${name}" not found`);
  return stage.id;
}

export async function contactId(api, companyName) {
  const contacts = await list(
    api,
    `/api/contacts?search=${encodeURIComponent(companyName)}&limit=50`
  );
  const contact = contacts.find((c) => c.companyName === companyName);
  if (!contact) throw new Error(`contact "${companyName}" not found`);
  return contact.id;
}

/** Soft-delete every live lead named `name`, plus any project converted from it. */
export async function removeLead(api, name) {
  const leads = await list(api, `/api/leads?search=${encodeURIComponent(name)}&limit=50`);
  for (const lead of leads.filter((l) => l.name === name)) {
    await api.del(`/api/leads/${lead.id}`);
  }
  const projects = await list(api, `/api/projects?search=${encodeURIComponent(name)}&limit=50`);
  for (const project of projects.filter((p) => p.name === name)) {
    await api.del(`/api/projects/${project.id}`);
  }
}

/**
 * Recreate a lead from scratch. `stage` and `company` are names; everything
 * else is passed through to POST /api/leads.
 */
export async function stageLead(api, { stage, company, closeInDays = 30, ...fields }) {
  await removeLead(api, fields.name);
  const close = new Date(Date.now() + closeInDays * 86400000);
  return api.post('/api/leads', {
    stageId: await stageId(api, stage),
    contactId: await contactId(api, company),
    expectedCloseDate: close.toISOString(),
    ...fields,
  });
}

// ── This week's crew hours ────────────────────────────────────────────────
// The seed's time entries stop weeks ago, so Time Tracking opens on its
// default "This Week" view to "No time entries yet". Log this week's hours the
// way a foreman would. Each entry carries a clientId derived from its date,
// worker and project, so the API's idempotent create makes re-runs no-ops.
//
// The seed also writes a rate onto each of its entries but creates no labor
// rates, so anything logged afterwards prices at $0.00. Set each crew member's
// default rate (the same rates the seeded entries carry) before logging.

const CREW_DAY = [
  { username: 'jrodriguez', rate: '72.00', project: 'Pelican Restaurant — Rooftop Replacement', hours: 8, notes: 'RTU curb adapters and rigging prep' },
  { username: 'freyes', rate: '55.00', project: 'Gulfstream Bank Branch — Ductwork Upgrade', hours: 7.5, notes: 'Supply duct and branch takeoffs, level 1' },
  { username: 'mmurphy', rate: '85.00', project: 'Heron Car Wash — Rooftop Replacement', hours: 4, notes: 'Startup and commissioning checklist' },
];
// Bump when the entries' content changes: the API matches a clientId even on a
// soft-deleted row, so a deleted entry's id can never be reused.
const TIME_KEY = 'demo-time-v2';

function stableUuid(key) {
  const h = createHash('sha1').update(key).digest('hex');
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Monday of this week through today, local time. */
function thisWeekDays() {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const days = [];
  for (let d = new Date(monday); d <= today; d.setDate(d.getDate() + 1)) days.push(dayKey(d));
  return days;
}

export async function stageWeekTimeEntries(api) {
  const users = await list(api, '/api/users?limit=200');
  const projects = await list(api, '/api/projects?limit=200');
  const userId = (username) => users.find((u) => u.username === username)?.id;
  const projectId = (name) => projects.find((p) => p.name === name)?.id;
  for (const e of CREW_DAY) {
    await api.post('/api/labor-rates', { userId: userId(e.username), projectId: null, hourlyRate: e.rate });
  }
  // Clear unpriced copies an earlier version of this staging left behind.
  const days = thisWeekDays();
  const notes = new Set(CREW_DAY.map((e) => e.notes));
  const existing = await list(api, `/api/time-entries?dateFrom=${days[0]}&dateTo=${days.at(-1)}&limit=500`);
  for (const t of existing) {
    if (notes.has(t.notes) && Number(t.totalCost) === 0) await api.del(`/api/time-entries/${t.id}`);
  }
  let n = 0;
  for (const date of days) {
    for (const e of CREW_DAY) {
      const uid = userId(e.username);
      const pid = projectId(e.project);
      if (!uid || !pid) throw new Error(`time entry staging: missing ${e.username} or "${e.project}"`);
      await api.post('/api/time-entries', {
        userId: uid,
        projectId: pid,
        date,
        hours: e.hours,
        notes: e.notes,
        entryType: 'manual',
        clientId: stableUuid(`${TIME_KEY}|${date}|${e.username}|${e.project}`),
      });
      n++;
    }
  }
  return n;
}

// ── Receivables ───────────────────────────────────────────────────────────
// The seed bills through pay apps but never invoices, so the dashboard's money
// strip (Overdue AR / Outstanding / Collected 30d) reads $0.00 across the board
// on the first frame of every tour. Invoice three seeded pay apps the way an
// office manager would — one paid early, one sent and not yet due, one past due
// — through the app's own invoice API (from-pay-app → backdated issue/due
// dates on the draft → mark-sent, which emails nobody → record payment).
//
// A pay app carries at most one live invoice, so the pay app is the marker. A
// run keeps an invoice that still tells its story today and replaces one that
// has gone stale (a payment drifting out of the 30-day window, an outstanding
// invoice passing its due date): the stale copy's payment is removed first, so
// Collected 30d never counts it, then the invoice is voided.
const RECEIVABLES = [
  // Paid early: Net 30, paid by check 9 days ago.
  { project: 'Grand Self-Storage — Chiller Replacement', payApp: 'PA-001', story: 'paid', issuedDaysAgo: 24, dueDaysFromIssue: 30, paidDaysAgo: 9, method: 'check', reference: 'Check #20417' },
  // Sent last week, due in three weeks.
  { project: 'Pelican Restaurant — Rooftop Replacement', payApp: 'PA-001', story: 'outstanding', issuedDaysAgo: 6, dueDaysFromIssue: 30 },
  // Due two weeks ago and unpaid.
  { project: 'Heritage Office Tower — Chiller Replacement', payApp: 'PA-001', story: 'overdue', issuedDaysAgo: 44, dueDaysFromIssue: 30 },
];

const daysFromToday = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return dayKey(d);
};

async function invoiceStillTellsItsStory(api, inv, spec) {
  const today = dayKey(new Date());
  if (spec.story === 'outstanding') return inv.status === 'sent' && inv.dueDate > today;
  if (spec.story === 'overdue') return inv.status === 'sent' && inv.dueDate < today;
  if (inv.status !== 'paid') return false;
  const payments = await list(api, `/api/invoices/${inv.id}/payments`);
  return payments.some((p) => dayKey(new Date(p.paidAt)) >= daysFromToday(-20));
}

async function retireInvoice(api, inv) {
  if (inv.status === 'draft') return api.del(`/api/invoices/${inv.id}`);
  for (const p of await list(api, `/api/invoices/${inv.id}/payments`)) {
    await api.del(`/api/invoices/${inv.id}/payments/${p.id}`);
  }
  await api.post(`/api/invoices/${inv.id}/void`, { reason: 'Demo data refresh' });
}

export async function stageReceivables(api) {
  const projects = await list(api, '/api/projects?limit=200');
  const invoices = await list(api, '/api/invoices?limit=500');
  const staged = [];
  for (const spec of RECEIVABLES) {
    const project = projects.find((p) => p.name === spec.project);
    if (!project) throw new Error(`receivables: project "${spec.project}" not found`);
    const payApp = (await list(api, `/api/projects/${project.id}/pay-apps`)).find(
      (pa) => pa.payAppNumber === spec.payApp
    );
    if (!payApp) throw new Error(`receivables: ${spec.payApp} on "${spec.project}" not found`);

    const live = invoices.filter((i) => i.sourcePayAppId === payApp.id && i.status !== 'voided');
    let keep = null;
    for (const inv of live) {
      if (!keep && (await invoiceStillTellsItsStory(api, inv, spec))) keep = inv;
      else await retireInvoice(api, inv);
    }
    if (keep) {
      staged.push(`${keep.invoiceNumber} ${spec.story} (kept)`);
      continue;
    }

    const issueDate = daysFromToday(-spec.issuedDaysAgo);
    const dueDate = daysFromToday(spec.dueDaysFromIssue - spec.issuedDaysAgo);
    const draft = await api.post('/api/invoices/from-pay-app', { payAppId: payApp.id, dueDate });
    await api.patch(`/api/invoices/${draft.id}`, { issueDate, dueDate });
    const sent = await api.post(`/api/invoices/${draft.id}/mark-sent`);
    if (spec.story === 'paid') {
      await api.post(`/api/invoices/${draft.id}/payments`, {
        amount: sent.balanceDue,
        paidAt: `${daysFromToday(-spec.paidDaysAgo)}T15:00:00`,
        method: spec.method,
        reference: spec.reference,
      });
    }
    staged.push(`${sent.invoiceNumber} ${spec.story}`);
  }
  return staged;
}
