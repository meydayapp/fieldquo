// lib/sales/messages/attachThread.js
//
// A text conversation that names a business but hangs on no lead — attached
// to the lead it belongs to, so the header, the time zone and the send path
// all know who it is with.
//
// ══ The thread that was named in the list and nameless in the header ══════
//
// 2026-09-19, the owner's screenshot. Favor rang Advance Appliance (a
// claimed PROSPECT, Yonkers NY) and the office's cell texted back two
// minutes later. lib/sales/smsAttribution.js filed the row to her and to
// the prospect — rung (b), the body names the business she had just rung —
// and to no lead, because none existed: a prospect becomes a lead only when
// the rep carries it across. The list read `prospect.businessName` and said
// "Advance Appliance". The thread read leads only (businessResolve.js) and
// said "+1 914 935 7510", "Time zone unknown", and refused the reply for
// want of a clock — for a business whose address is on the prospect row.
// The owner: "we should know the timezone because it is Advance Appliance,
// one of her leads."
//
// ══ What "attached" means ═════════════════════════════════════════════════
//
// Three writes, each through the function that already owns that write:
//
//   1. The LEAD. The rep's existing lead for the business when there is one;
//      when the business is a prospect the rep holds and no lead carries it
//      yet, the same carry-across app/api/sales/leads POST makes
//      (lib/sales/leadCreate.js, with the prospect as `source`, so the
//      address, the country and the province come with it — which is what
//      the time zone is derived from, lib/sales/leadTimeZone.js).
//   2. The NUMBER, on the lead — lib/sales/contact/record.js, the same write
//      the dial pad's typed number and the "Text them" press go through,
//      with the rep's name and a label saying where it came from. So the
//      next text from this cell matches on the number itself (rung (a)) and
//      the rep sees the cell on the card. A test line or a test account's
//      number is never written onto a business's record; the thread still
//      attaches.
//   3. The ROWS. Every message of THIS rep's on the number with no lead gets
//      the lead's id. Not attributeSmsMessage(): that function decides WHOSE
//      a row is and audits it because commission hangs off the rep; this
//      never moves a row between reps — `salesRepId` is in the WHERE and not
//      in the data — it says which of the rep's own leads the rep's own rows
//      are about.
//
// ══ Exactly one lead, or nothing ══════════════════════════════════════════
//
// The candidates, in the order the number is more surely theirs: a lead of
// the rep's whose phone is the number; a lead whose linked prospect's phone
// is the number; a stored contact number pointing at the rep's lead or
// prospect; the prospect the rows were filed to. Two different leads at
// the end of that is a thread this function leaves alone — a wrong attach
// puts a stranger's words on a customer's record, and "we could not tell"
// is what the screen already says.
//
// ══ Where it runs ═════════════════════════════════════════════════════════
//
// After an inbound text is stored (handleSalesInboundSms), when the thread
// is opened (app/api/sales/messages GET — the backfill for rows filed
// before this existed), and from the rep's own "Link to a lead" press
// (app/api/sales/messages/start, which names the lead outright). Every call
// is idempotent: nothing to attach, nothing written.
//
// Executed by scripts/check-sales-messages.mjs over an in-memory client.
import { db } from "@/lib/db";
import { normalisePhone } from "@/lib/sales/suppressionRules";
import { leadForThread } from "@/lib/sales/checkin/store";
import { createSalesLead } from "@/lib/sales/leadCreate";
import { recordContactNumber } from "@/lib/sales/contact/record";
import { loadContactNumbers } from "@/lib/sales/contact/resolve";
import { numberIsOnLead } from "@/lib/sales/messages/startThread";

/** What the number on the lead's card says about where it came from. */
export const ATTACHED_NUMBER_LABEL = "Texted from this number";

const LEAD_SELECT = {
  id: true,
  salesRepId: true,
  prospectId: true,
  businessName: true,
  contactName: true,
  phone: true,
  prospect: { select: { id: true, phoneE164: true, doNotContactAt: true } },
};

/**
 * The rep's rows on this number that hang on no lead.
 * Exported for the route, which asks before it decides whether to look.
 */
export async function unattachedRows({ salesRepId, e164, client = db } = {}) {
  const other = normalisePhone(e164);
  if (!other || !salesRepId) return [];
  return client.salesSmsMessage.findMany({
    where: { salesRepId, leadId: null, OR: [{ fromE164: other }, { toE164: other }] },
    select: { id: true, prospectId: true },
  });
}

/**
 * Pure: the one lead these facts name, or null.
 *
 * @param byPhone         the rep's lead carrying the number (leadForThread), or null
 * @param byProspectPhone the rep's leads whose linked prospect's phone is the number
 * @param contact         a stored SalesContactNumber on the number: `{ salesLeadId, prospectId }` or null
 * @param leadsOnContact  the rep's leads that contact row points at
 * @param prospectIds     the distinct prospect ids the rows were filed to
 * @param leadsOnProspect the rep's leads on those prospects
 * @returns `{ leadId }` | `{ prospectId }` (a claimed prospect with no lead yet) | null
 */
export function decideAttachment({
  byPhone = null,
  byProspectPhone = [],
  contact = null,
  leadsOnContact = [],
  prospectIds = [],
  leadsOnProspect = [],
} = {}) {
  if (byPhone?.id) return { leadId: byPhone.id, via: "lead_phone" };
  const ids = (list) => [...new Set((list || []).filter((l) => l && l.id).map((l) => l.id))];
  const viaProspectPhone = ids(byProspectPhone);
  if (viaProspectPhone.length === 1) return { leadId: viaProspectPhone[0], via: "prospect_phone" };
  if (viaProspectPhone.length > 1) return null;
  if (contact && (contact.salesLeadId || contact.prospectId)) {
    const viaContact = ids(leadsOnContact);
    if (viaContact.length === 1) return { leadId: viaContact[0], via: "contact_number" };
    if (viaContact.length > 1) return null;
  }
  const distinct = [...new Set((prospectIds || []).filter(Boolean))];
  if (distinct.length !== 1) return null;
  const viaProspect = ids(leadsOnProspect);
  if (viaProspect.length === 1) return { leadId: viaProspect[0], via: "prospect" };
  if (viaProspect.length > 1) return null;
  return { prospectId: distinct[0], via: "prospect" };
}

/**
 * Attach the rep's conversation on `e164` to the one lead it belongs to.
 *
 * @param leadId  optional: the lead the rep NAMED ("Link to a lead"). Re-read
 *                against the rep here, never trusted; the candidates above
 *                are not consulted.
 * @returns `{ attached: true, leadId, created, recorded, rows }`
 *        | `{ attached: false, reason }`
 */
export async function attachThreadToLead({ salesRepId, rep = null, e164, leadId = null, client = db } = {}) {
  const other = normalisePhone(e164);
  if (!other || !salesRepId) return { attached: false, reason: "no_number" };

  const rows = await unattachedRows({ salesRepId, e164: other, client });
  if (!rows.length) return { attached: false, reason: "nothing_to_attach" };

  let lead = null;
  let created = false;

  if (leadId) {
    lead = await client.salesLead.findFirst({ where: { id: leadId, salesRepId }, select: LEAD_SELECT });
    if (!lead) return { attached: false, reason: "not_your_lead" };
  } else {
    const prospectIds = [...new Set(rows.map((r) => r.prospectId).filter(Boolean))];
    const soft = (p) => (p && typeof p.catch === "function" ? p.catch(() => null) : Promise.resolve(p ?? null));
    const [byPhone, byProspectPhone, contact, leadsOnProspect] = await Promise.all([
      soft(leadForThread({ salesRepId, toE164: other, client })),
      soft(client.salesLead.findMany({ where: { salesRepId, prospect: { is: { phoneE164: other } } }, select: LEAD_SELECT, take: 5 })),
      client.salesContactNumber
        ? soft(client.salesContactNumber.findFirst({ where: { e164: other }, select: { salesLeadId: true, prospectId: true } }))
        : Promise.resolve(null),
      prospectIds.length
        ? soft(client.salesLead.findMany({ where: { salesRepId, prospectId: { in: prospectIds } }, select: LEAD_SELECT, take: 5 }))
        : Promise.resolve([]),
    ]);
    const leadsOnContact =
      contact && (contact.salesLeadId || contact.prospectId)
        ? (await soft(
            client.salesLead.findMany({
              where: { salesRepId, ...(contact.salesLeadId ? { id: contact.salesLeadId } : { prospectId: contact.prospectId }) },
              select: LEAD_SELECT,
              take: 5,
            }),
          )) || []
        : [];

    const decision = decideAttachment({
      byPhone,
      byProspectPhone: byProspectPhone || [],
      contact,
      leadsOnContact,
      prospectIds,
      leadsOnProspect: leadsOnProspect || [],
    });
    if (!decision) return { attached: false, reason: "no_single_lead" };

    if (decision.leadId) {
      lead =
        [byPhone, ...(byProspectPhone || []), ...leadsOnContact, ...(leadsOnProspect || [])].find((l) => l?.id === decision.leadId) ||
        (await client.salesLead.findFirst({ where: { id: decision.leadId, salesRepId }, select: LEAD_SELECT }));
    } else if (decision.prospectId) {
      // The business is a prospect the rep holds and no lead carries it:
      // carried across the way the leads route carries it — the same
      // create, the prospect as source — and only when it is THEIR claim
      // and the business has not asked to be left alone.
      const prospect = await soft(
        client.prospect.findUnique({
          where: { id: decision.prospectId },
          select: {
            id: true,
            businessName: true,
            phoneE164: true,
            email: true,
            country: true,
            province: true,
            assignedRepId: true,
            doNotContactAt: true,
            mergedIntoId: true,
          },
        }),
      );
      if (!prospect || prospect.assignedRepId !== salesRepId) return { attached: false, reason: "prospect_not_held" };
      if (prospect.doNotContactAt) return { attached: false, reason: "do_not_contact" };
      if (prospect.mergedIntoId) return { attached: false, reason: "prospect_merged" };
      const made = await createSalesLead(client, {
        salesRepId,
        businessName: "",
        // The lead's own phone is the business's line the prospect carries;
        // the cell that texted goes on the card below as a contact number.
        phone: prospect.phoneE164 || null,
        status: "contacted",
        source: prospect,
      });
      created = true;
      lead = await client.salesLead.findFirst({ where: { id: made.id, salesRepId }, select: LEAD_SELECT });
    }
  }
  if (!lead) return { attached: false, reason: "no_single_lead" };

  // The number onto the card, unless it is there already or it is ours.
  // The rep row is read when the caller had none (the inbound handler):
  // record.js refuses a test account's number, and that needs the flag.
  let recorded = false;
  let unsaved = null;
  const who =
    rep ||
    (await client.salesRep
      .findUnique({ where: { id: salesRepId }, select: { id: true, name: true, testAccount: true } })
      .catch(() => null)) ||
    { id: salesRepId };
  const onCard = await loadContactNumbers({ prospectId: lead.prospectId || null, salesLeadId: lead.id, client }).catch(() => []);
  if (!numberIsOnLead(lead, onCard, other)) {
    const written = await recordContactNumber({
      owner: { prospectId: lead.prospect?.id || lead.prospectId || null, salesLeadId: lead.id, doNotContactAt: lead.prospect?.doNotContactAt || null },
      rep: who,
      e164: other,
      kind: "mobile",
      label: ATTACHED_NUMBER_LABEL,
      canText: true,
      client,
    }).catch((err) => ({ ok: false, code: "error", error: err?.message }));
    if (written.ok) recorded = true;
    else if (written.code === "test_line" || written.code === "test_account") unsaved = written.code;
    else if (written.code === "do_not_contact") return { attached: false, reason: "do_not_contact" };
  }

  // The rows: this rep's, on this number, with no lead — and nothing else.
  const stamped = await client.salesSmsMessage.updateMany({
    where: { salesRepId, leadId: null, OR: [{ fromE164: other }, { toE164: other }] },
    data: { leadId: lead.id },
  });

  return {
    attached: true,
    leadId: lead.id,
    created,
    recorded,
    unsaved,
    rows: typeof stamped?.count === "number" ? stamped.count : rows.length,
  };
}
