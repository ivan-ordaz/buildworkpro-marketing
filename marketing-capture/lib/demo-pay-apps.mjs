// Stage a believable pay application for the pay-app demo videos.
//
// The seeded pay apps can't be filmed: their schedules of values reuse the same
// description on several lines, split the contract into identical amounts, and
// even rename lines between PA-001 and PA-002. And an approved pay app can't be
// deleted or un-approved through the API, so a scene that approves one can't
// reset itself by touching the same record again.
//
// So each run builds its own small job the way a customer would: a bid with the
// job's scope lines, accepted and converted to a project, whose first pay app
// seeds its schedule of values from that bid (each row badged with its bid
// line). The pay app is numbered PA-002 and its rows carry Previous Apps — the
// app's supported path for a job whose earlier billing predates BuildWorkPro —
// so the columns, retainage and summary all have real numbers to show.
//
// Before building, the previous run's bid and project are soft-deleted (open
// pay apps on it are cancelled first, so the pay-app list doesn't fill with
// stale drafts). An approved certificate can't be removed, so the approval
// scene leaves one approved pay app behind per run, under a deleted project.
import { request } from '@playwright/test';
import { authenticate } from './auth.mjs';
import { makeApi } from './api.mjs';

const money = (n) => n.toFixed(2);

/** Find a contact by company name (the job's customer). */
async function findContact(api, companyName) {
  const contacts = await api.get(`/api/contacts?search=${encodeURIComponent(companyName)}&limit=10`);
  const match = (contacts ?? []).find((c) => c.companyName === companyName);
  if (!match) throw new Error(`demo contact "${companyName}" not found — is the HVAC seed loaded?`);
  return match;
}

/** Remove whatever a previous run of the same scene left behind. */
async function clearPreviousRun(api, jobName) {
  const projects = await api.get(`/api/projects?search=${encodeURIComponent(jobName)}&limit=50`);
  for (const project of (projects ?? []).filter((p) => p.name === jobName)) {
    const payApps = (await api.get(`/api/projects/${project.id}/pay-apps`)) ?? [];
    await markNotificationsRead(
      api,
      payApps.map((pa) => ({ type: 'pay_app', id: pa.id }))
    );
    for (const pa of payApps) {
      if (pa.status === 'submitted') {
        await api.patch(`/api/pay-apps/${pa.id}/reject`, { reason: 'Demo reset' });
        await api.del(`/api/pay-apps/${pa.id}`);
      } else if (pa.status === 'draft') {
        await api.del(`/api/pay-apps/${pa.id}`);
      }
    }
    await api.del(`/api/projects/${project.id}`);
  }
  const bids = await api.get(`/api/bids?search=${encodeURIComponent(jobName)}&limit=50`);
  for (const bid of (bids ?? []).filter((b) => b.name === jobName)) {
    await api.del(`/api/bids/${bid.id}`);
  }
}

/**
 * Build bid → accepted → project → PA-002 draft whose SOV is `lines`.
 * `lines`: [{ description, scheduledValue, previous, thisPeriod?, materialsStored? }]
 * Returns { projectId, bidId, payAppId, payAppNumber }.
 */
export async function stagePayApp(
  api,
  { jobName, customer, siteAddress, periodStart, periodEnd, lines, retainagePercent = '10' }
) {
  await clearPreviousRun(api, jobName);
  const contact = await findContact(api, customer);
  const contractSum = money(lines.reduce((s, l) => s + l.scheduledValue, 0));

  // Flat-priced scope lines, no markup on top, so each line's customer price
  // is exactly its scheduled value and the bid total is the contract sum.
  const bid = await api.post('/api/bids', {
    name: jobName,
    contactId: contact.id,
    siteAddress,
    marginPercent: '0',
    companyOhPercent: '0',
    commissionPercent: '0',
    taxRate: '0',
    lineItems: lines.map((l, i) => ({
      markName: String(i + 1),
      description: l.description,
      quantity: '1',
      unitPrice: money(l.scheduledValue),
      buyTaxPercent: '0',
      sellTaxPercent: '0',
      kind: 'item',
      order: i,
    })),
  });
  await api.patch(`/api/bids/${bid.id}/accept`, {
    acceptedBy: `${contact.firstName} ${contact.lastName}`,
  });
  const converted = await api.post(`/api/bids/${bid.id}/convert-to-project`, {
    mappingStrategy: 'blank',
    name: jobName,
    startDate: '2026-07-06',
    expectedEndDate: '2026-11-20',
  });
  const projectId = converted.project?.id ?? converted.projectId ?? converted.id;
  if (!projectId) throw new Error(`convert-to-project returned no project id: ${JSON.stringify(converted).slice(0, 200)}`);
  await api.put(`/api/projects/${projectId}`, { status: 'in_progress' });

  const payApp = await api.post('/api/pay-apps', {
    projectId,
    payAppNumber: 'PA-002',
    periodStart,
    periodEnd,
    contractSum,
    retainagePercent,
  });

  // The SOV arrived seeded from the bid, one row per bid line, in order. Load
  // the billing that predates this pay app (and anything already entered).
  const seeded = [...(payApp.lineItems ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  if (seeded.length !== lines.length) {
    throw new Error(`expected ${lines.length} SOV rows seeded from the bid, got ${seeded.length}`);
  }
  for (const [i, row] of seeded.entries()) {
    const line = lines[i];
    if (money(Number(row.scheduledValue)) !== money(line.scheduledValue)) {
      throw new Error(`SOV row ${i + 1} seeded at ${row.scheduledValue}, expected ${money(line.scheduledValue)}`);
    }
    await api.put(`/api/pay-apps/${payApp.id}/line-items/${row.id}`, {
      previousApplications: money(line.previous),
      thisPeriod: money(line.thisPeriod ?? 0),
      materialsStored: money(line.materialsStored ?? 0),
    });
  }

  await markNotificationsRead(api, [{ type: 'bid', id: bid.id }]);
  return { projectId, bidId: bid.id, payAppId: payApp.id, payAppNumber: payApp.payAppNumber };
}

/**
 * Mark read the in-app notifications staging generated for these records (the
 * "bid accepted" alert, say), so they don't pile up on the bell in every video.
 * `entities`: [{ type: 'bid' | 'pay_app' | ..., id }]
 */
export async function markNotificationsRead(api, entities) {
  const unread = (await api.get('/api/notifications?unreadOnly=true&limit=100')) ?? [];
  for (const n of unread) {
    if (entities.some((e) => e.type === n.entityType && e.id === n.entityId)) {
      await api.patch(`/api/notifications/${n.id}/read`);
    }
  }
}

/**
 * An API client logged in as a different seeded teammate — e.g. the manager
 * who submits the pay app the admin then approves on camera.
 */
export async function apiAs(user) {
  const req = await request.newContext();
  await authenticate({ request: req }, { user, log: () => {} });
  return { api: makeApi({ request: req }), dispose: () => req.dispose() };
}
