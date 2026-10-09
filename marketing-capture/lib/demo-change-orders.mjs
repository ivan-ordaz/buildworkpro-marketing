// Stage change orders for the change-order demo scenes through the app's API.
//
// Each scene owns one project and one CO title. Re-running a scene first clears
// what its previous run left on that project — drafts are deleted, anything
// further along is voided (the Contract Flow panel hides void COs) — then
// creates a fresh CO, so every take starts from the same screen.

export async function findProject(api, name) {
  const projects = await api.get('/api/projects?limit=200');
  const project = projects.find((p) => p.name === name || p.name.startsWith(name));
  if (!project) throw new Error(`project not found: ${name}`);
  return project;
}

export async function findProducts(api, skus) {
  const products = await api.get('/api/products?limit=500');
  const bySku = Object.fromEntries(products.map((p) => [p.sku, p]));
  for (const sku of skus) if (!bySku[sku]) throw new Error(`product not found: ${sku}`);
  return bySku;
}

/** Delete (draft) or void (anything else) this project's COs that match `titles`. */
export async function clearChangeOrders(api, projectId, titles) {
  const cos = await api.get(`/api/projects/${projectId}/change-orders?limit=200`);
  let cleared = 0;
  for (const co of cos) {
    if (!titles.includes(co.title) || co.status === 'void') continue;
    if (co.status === 'draft') await api.del(`/api/change-orders/${co.id}`);
    else await api.patch(`/api/change-orders/${co.id}/void`, { voidReason: 'Demo reset' });
    cleared++;
  }
  return cleared;
}

/**
 * Create a CO on `projectId` with priced marks, then optionally submit it.
 * `items` use the API body shape (changeType, markName, description, quantity,
 * unitPrice, productId, sublines[]).
 */
export async function createChangeOrder(api, projectId, { title, reason, description, items = [], submit = false }) {
  const co = await api.post(`/api/projects/${projectId}/change-orders`, { title, reason, description });
  for (const [order, item] of items.entries()) {
    await api.post(`/api/change-orders/${co.id}/items`, { order, ...item });
  }
  if (submit) await api.patch(`/api/change-orders/${co.id}/submit`, {});
  return api.get(`/api/change-orders/${co.id}`);
}
