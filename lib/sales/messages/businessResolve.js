// lib/sales/messages/businessResolve.js
//
// The business behind a number, for one rep, and every number of theirs.
// The database half of business.js; that file's header says why the two
// are apart and what "the same business" means.

import { normalisePhone } from "../suppressionRules";
import { leadForThread } from "../checkin/store";
import { loadContactNumbers } from "../contact/resolve";
import { BUSINESS_LEAD_SELECT, businessKeyOf } from "./business";

/**
 * The business behind a number, for one rep, and every number of theirs.
 *
 * @returns {{
 *   lead, key, leadIds: string[], companyId, prospectId,
 *   numbers: string[]   // E.164, `withE164` first, no duplicates
 * }}
 *
 * The lead is leadForThread()'s answer when the number sits on one of the
 * rep's leads. When it does not — the engine texted the company's shop line
 * and the rep's lead carries the owner's cell — the rows that DO name the
 * number are asked: this rep's messages to or from it, this rep's check-in
 * rows aimed at it, and a stored contact number for it. The first of those
 * that points at a lead of this rep's is the business.
 *
 * The number set is then everything that points back at that business:
 * the phones on its leads, its stored contact numbers, the other side of
 * every message row on its leads, and every check-in row's number for its
 * leads or its company. Scoped to the rep throughout — another rep's texts
 * to the same business are not this rep's to read.
 */
export async function resolveBusiness({ salesRepId, withE164, client }) {
  const other = normalisePhone(withE164);
  const empty = { lead: null, key: null, leadIds: [], companyId: null, prospectId: null, numbers: other ? [other] : [] };
  if (!other || !salesRepId || !client) return empty;

  let lead = await leadForThread({ salesRepId, toE164: other, client });

  if (!lead) {
    // The number is on none of the rep's leads. Ask the rows that name it.
    const [viaMessage, viaCheckIn, viaContact] = await Promise.all([
      client.salesSmsMessage
        .findFirst({
          where: { salesRepId, leadId: { not: null }, OR: [{ toE164: other }, { fromE164: other }] },
          orderBy: { sentAt: "desc" },
          select: { leadId: true },
        })
        .catch(() => null),
      client.salesCheckIn
        .findFirst({
          where: { salesRepId, toE164: other, OR: [{ leadId: { not: null } }, { companyId: { not: null } }] },
          orderBy: { createdAt: "desc" },
          select: { leadId: true, companyId: true },
        })
        .catch(() => null),
      client.salesContactNumber
        ? client.salesContactNumber
            .findFirst({ where: { e164: other }, select: { salesLeadId: true, prospectId: true } })
            .catch(() => null)
        : Promise.resolve(null),
    ]);
    const leadId = viaMessage?.leadId || viaCheckIn?.leadId || viaContact?.salesLeadId || null;
    const where = leadId
      ? { id: leadId, salesRepId }
      : viaCheckIn?.companyId
        ? { convertedCompanyId: viaCheckIn.companyId, salesRepId }
        : viaContact?.prospectId
          ? { prospectId: viaContact.prospectId, salesRepId }
          : null;
    if (where) {
      lead = await client.salesLead
        .findFirst({
          where,
          select: {
            ...BUSINESS_LEAD_SELECT,
            phone: true,
            timeZone: true,
            status: true,
            salesRepId: true,
            email: true,
            province: true,
            country: true,
            prospect: { select: { country: true, province: true } },
          },
        })
        .catch(() => null);
    }
  }

  const key = businessKeyOf(lead);
  if (!lead || !key) return { ...empty, lead };

  // Every lead of this rep's that is the same business, so a converted lead
  // and the older lead it grew from both contribute their numbers.
  const siblingWhere = lead.convertedCompanyId
    ? { convertedCompanyId: lead.convertedCompanyId }
    : lead.prospectId
      ? { prospectId: lead.prospectId }
      : { id: lead.id };
  const siblings = await client.salesLead
    .findMany({ where: { salesRepId, ...siblingWhere }, select: { id: true, phone: true } })
    .catch(() => []);
  const leadIds = [...new Set([lead.id, ...siblings.map((s) => s.id)])];
  const companyId = lead.convertedCompanyId || null;
  const prospectId = lead.prospectId || null;

  const [contactRows, messageRows, checkInRows] = await Promise.all([
    Promise.all(leadIds.map((id) => loadContactNumbers({ prospectId, salesLeadId: id, client }))).then((lists) => lists.flat()),
    client.salesSmsMessage
      .findMany({
        where: { salesRepId, leadId: { in: leadIds } },
        select: { direction: true, toE164: true, fromE164: true },
        take: 500,
      })
      .catch(() => []),
    client.salesCheckIn
      .findMany({
        where: {
          salesRepId,
          toE164: { not: null },
          OR: [{ leadId: { in: leadIds } }, ...(companyId ? [{ companyId }] : [])],
        },
        select: { toE164: true },
      })
      .catch(() => []),
  ]);

  const numbers = [];
  const add = (n) => {
    const e = normalisePhone(n);
    if (e && !numbers.includes(e)) numbers.push(e);
  };
  add(other);
  add(lead.phone);
  for (const s of siblings) add(s.phone);
  for (const r of contactRows) add(r.e164);
  for (const m of messageRows) add(m.direction === "in" ? m.fromE164 : m.toE164);
  for (const c of checkInRows) add(c.toE164);

  return { lead, key, leadIds, companyId, prospectId, numbers };
}
