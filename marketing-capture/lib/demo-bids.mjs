// Staging helpers for the bid demo scenes (create-bid, bid-send-convert).
//
// The seeded bids are unnamed, priced with flat "legacy" unit prices and no
// cost items, so filming one shows "Legacy pricing" rows and amber "Create
// material cost from product" prompts. These helpers stage named bids with
// real material + labor cost items through the app's own API, and reset them
// on every run so a re-take films the same thing.

const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString();
};

/** First non-deleted row of a list endpoint whose `key` equals `value`. */
async function findExact(api, path, key, value) {
  const rows = await api.get(path);
  return (rows ?? []).find((r) => r[key] === value && !r.deletedAt) ?? null;
}

/** A catalog product by SKU, created from `spec` when the tenant lacks it. */
export async function ensureProduct(api, spec) {
  const found = await findExact(api, `/api/products?search=${encodeURIComponent(spec.sku)}`, 'sku', spec.sku);
  return found ?? api.post('/api/products', spec);
}

/**
 * A kit (assembly) product whose components import as a line's cost items.
 * `components` is [{ sku, quantity }] against existing catalog SKUs; the kit's
 * component list is rewritten whenever it drifts from that spec.
 */
export async function ensureKit(api, spec, components) {
  const kit = await ensureProduct(api, { ...spec, isKit: true });
  const wanted = [];
  for (const c of components) {
    const product = await findExact(api, `/api/products?search=${encodeURIComponent(c.sku)}`, 'sku', c.sku);
    if (!product) throw new Error(`kit component ${c.sku} is missing from the catalog`);
    wanted.push({ componentProductId: product.id, defaultQuantity: String(c.quantity) });
  }
  const current = await api.get(`/api/products/${kit.id}/kit-items`);
  const same =
    current.length === wanted.length &&
    wanted.every((w, i) => current[i]?.componentProductId === w.componentProductId &&
      Number(current[i]?.defaultQuantity) === Number(w.defaultQuantity));
  if (!same) {
    for (const item of current) await api.del(`/api/products/${kit.id}/kit-items/${item.id}`);
    for (const w of wanted) await api.post(`/api/products/${kit.id}/kit-items`, w);
  }
  return kit;
}

/** A contact by company name (customers and GCs are both contacts). */
export async function findContact(api, companyName) {
  const contact = await findExact(api, `/api/contacts?search=${encodeURIComponent(companyName)}`, 'companyName', companyName);
  if (!contact) throw new Error(`contact "${companyName}" not found in the demo tenant`);
  return contact;
}

const bidFields = (name, contactId, extra = {}) => ({
  name,
  contactId,
  siteAddress: '1450 Brickell Bay Dr',
  siteCity: 'Miami',
  siteState: 'FL',
  siteZipCode: '33131',
  dueDate: day(9),
  validUntil: day(30),
  marginPercent: '18',
  companyOhPercent: '10',
  commissionPercent: '0',
  taxRate: '7',
  terms: 'Net 30. 50% deposit required prior to ordering equipment.',
  ...extra,
});

/**
 * An empty draft bid called `name`, reused across runs so the bid number stays
 * put: line items and project costs from the previous take are removed and
 * the header fields and rates reset.
 */
export async function resetDraftBid(api, { name, contactId, extra }) {
  const fields = bidFields(name, contactId, extra);
  const bid = await findExact(api, `/api/bids?search=${encodeURIComponent(name)}`, 'name', name);
  if (!bid || bid.status !== 'draft') {
    if (bid) await api.del(`/api/bids/${bid.id}`);
    return api.post('/api/bids', fields);
  }
  for (const line of await api.get(`/api/bids/${bid.id}/line-items`)) {
    await api.del(`/api/bids/${bid.id}/line-items/${line.id}`);
  }
  for (const cost of await api.get(`/api/bids/${bid.id}/distributed-costs`)) {
    await api.del(`/api/bids/${bid.id}/distributed-costs/${cost.id}`);
  }
  await api.put(`/api/bids/${bid.id}`, fields);
  return api.get(`/api/bids/${bid.id}`);
}

/**
 * A brand-new bid called `name` with priced lines, after soft-deleting every
 * earlier bid of that name and the project each one was converted into — for
 * scenes that accept and convert, which a bid can only do once.
 */
export async function freshBid(api, { name, contactId, lineItems, extra }) {
  const old = (await api.get(`/api/bids?search=${encodeURIComponent(name)}`)).filter(
    (b) => b.name === name && !b.deletedAt
  );
  for (const b of old) {
    if (b.projectId) await api.del(`/api/projects/${b.projectId}`).catch(() => {});
    if (b.status === 'accepted') await api.post(`/api/bids/${b.id}/revert-acceptance`).catch(() => {});
    await api.del(`/api/bids/${b.id}`);
  }
  return api.post('/api/bids', { ...bidFields(name, contactId, extra), lineItems });
}

/** Cost-item rows for a line, from [type, description, qty, unitCost, uom]. */
export const costItems = (rows) =>
  rows.map(([type, description, quantity, unitCost, unitOfMeasure], i) => ({
    type,
    description,
    quantity: String(quantity),
    unitCost: String(unitCost),
    unitOfMeasure,
    sortOrder: i,
  }));
