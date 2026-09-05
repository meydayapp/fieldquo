// lib/sales/calendar/leadContact.js
//
// The contact snapshot a calendar event is created with, pulled from the rep's
// OWN lead. Scoped by salesRepId in the WHERE, so a leadId naming another rep's
// lead resolves to null rather than leaking their prospect's number — the same
// boundary leadWhere(rep.id) carries for the outreach routes.
//
// website has no column on SalesLead (it lives on the linked Prospect), so it
// is the one field read through the relation. Everything else is on the lead.

import { db } from "@/lib/db";

export async function leadContactSnapshot(leadId, salesRepId) {
  if (!leadId) return null;
  const lead = await db.salesLead.findFirst({
    where: { id: leadId, salesRepId },
    select: {
      businessName: true,
      contactName: true,
      phone: true,
      email: true,
      timeZone: true,
      prospect: { select: { websiteUrl: true } },
    },
  });
  if (!lead) return null;
  return {
    businessName: lead.businessName || null,
    contactName: lead.contactName || null,
    phone: lead.phone || null,
    email: lead.email || null,
    website: lead.prospect?.websiteUrl || null,
    timeZone: lead.timeZone || null,
  };
}
