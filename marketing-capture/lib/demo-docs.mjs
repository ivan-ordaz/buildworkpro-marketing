// Staging for the docs screenshots (scenes/docs-settings + docs-general).
// Everything here is idempotent and creates only records the video scenes
// never touch.

// Contacts that "were deleted" so the Deleted Records manager shows rows to
// restore instead of "No deleted contacts found". Plausible office clean-up:
// a duplicate customer, a vendor and a sub the shop stopped using. Phone
// numbers are 555-01xx fiction (the API requires one contact method).
const DELETED_CONTACTS = [
  { type: 'vendor', companyName: 'Tri-County Duct Supply', firstName: 'Dana', lastName: 'Ellis', phone: '(305) 555-0147' },
  { type: 'customer', companyName: 'Sunrise Property Mgmt (duplicate)', firstName: 'Mark', lastName: 'Whitfield', phone: '(954) 555-0182' },
  { type: 'subcontractor', companyName: 'Bay Area Insulation Co.', firstName: 'Luis', lastName: 'Ortega', phone: '(786) 555-0119' },
];

/** Ensure the deleted-contact rows exist (create + soft-delete once). */
export async function stageDeletedContacts(api) {
  const deleted = await api.get('/api/deleted-records?type=contacts&limit=100&offset=0');
  const have = new Set((deleted ?? []).map((c) => c.companyName));
  for (const contact of DELETED_CONTACTS) {
    if (have.has(contact.companyName)) continue;
    const created = await api.post('/api/contacts', contact);
    await api.del(`/api/contacts/${created.id}`);
  }
  return DELETED_CONTACTS.length;
}
