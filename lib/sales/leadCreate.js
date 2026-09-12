// lib/sales/leadCreate.js
//
// The one place a SalesLead row is created from the rep's side.
//
// It was inline in app/api/sales/leads/route.js until the texts screen
// needed to create a lead from a bare phone number — "they should be able
// to choose a new text and enter a phone number" — and the copy of a create
// is the one that drifts: one route learns a column, the other keeps writing
// the old shape. Both routes call this now. The FIELDS are the same set the
// leads route always wrote, plus the three optional ones the paragraph after
// next explains.
//
// Attribution is untouched by this file. A lead is the rep's by
// `salesRepId`; who gets paid for a company is lib/sales/attribution.js's
// business, and it reads leads, never the other way round.
//
// `convertedCompanyId` is the one field that arrived later, for the third
// caller: lib/sales/checkin/materialise.js, which creates a lead FOR a company
// that signed up through the rep's link with no lead in front of it. It is an
// optional column on the same insert rather than a create-then-update, because
// the column is @unique across every rep's leads and the insert is where the
// index can say no atomically — a second step would leave an orphan lead when
// it lost the race. Attribution is still not written here: the company is
// already attributed, which is the only reason the caller knows about it.

/**
 * @param client   the Prisma client (or a transaction)
 * @param salesRepId  the gate's fresh read of the session — never the body's
 * @param source   the claimed Prospect row the lead is carried from, or null
 */
export async function createSalesLead(
  client,
  {
    salesRepId,
    businessName = "",
    contactName = null,
    email = null,
    phone = null,
    country = null,
    province = null,
    notes = null,
    status = "new",
    source = null,
    timeZone = null,
    convertedCompanyId = null,
    convertedAt = null,
  } = {},
) {
  if (!salesRepId) throw new Error("A lead has to belong to a rep.");
  return client.salesLead.create({
    data: {
      salesRepId,
      businessName: businessName || source?.businessName || "",
      contactName: contactName || null,
      email: email || source?.email || null,
      phone: phone || source?.phoneE164 || null,
      country: country || source?.country || null,
      province: province || source?.province || null,
      notes: typeof notes === "string" ? notes.slice(0, 5000) : null,
      status,
      prospectId: source?.id || null,
      // Only ever a STATED zone — never a default. See SalesLead.timeZone.
      ...(timeZone ? { timeZone } : {}),
      ...(convertedCompanyId ? { convertedCompanyId, convertedAt: convertedAt || new Date() } : {}),
    },
    select: { id: true, businessName: true, status: true, phone: true, convertedCompanyId: true },
  });
}
