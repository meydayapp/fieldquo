// lib/sales/messages/startThread.js
//
// A rep types a phone number and wants to text it. Every reason they may
// not, decided BEFORE a row is written — and the one row written when they
// may.
//
// ══ The owner's words ═════════════════════════════════════════════════════
//
//   "they should be able to choose a new text and enter a phone number
//    restricted to Canada and USA"
//
// ══ Canada and the United States, not "+1" ════════════════════════════════
//
// +1 is the whole North American Numbering Plan, which includes twenty-odd
// Caribbean countries whose texting law is neither CASL nor the TCPA.
// lib/voice/nanp.js keeps the list; nanpRegionForAreaCode() answers CA, US
// or other, and other is refused with a plain sentence. Puerto Rico and the
// other US territories count as US — see the table's own note.
//
// ══ Whose number is it ════════════════════════════════════════════════════
//
// A number already on a lead, a prospect or a stored contact number held by
// ANOTHER rep is refused, with that rep's name: the claim is the whole
// mechanism that stops two reps working one contractor, and a text from a
// second rep would route around it. The rep's own record opens its thread.
// A number nobody holds gets a lead with only the number on it, created
// through lib/sales/leadCreate.js — the same create the leads screen uses —
// so the business name is empty until the rep learns it, and a second
// attempt at the same number finds that lead rather than making another.
//
// ══ The do-not-contact list is asked first, and no lead is made for a STOP ═
//
// A number that opted out is refused with the suppression's own wording
// before anything else is looked up, and nothing is created: a lead row for
// somebody who said STOP is a row that invites the next rep to try.
//
// ══ Nothing here sends ════════════════════════════════════════════════════
//
// This opens a conversation. The first text still goes through
// app/api/sales/sms (the signup-link introduction, with every refusal that
// route has), because the reply route in app/api/sales/messages refuses a
// first contact by design — see its POST.
import { normalisePhone } from "@/lib/sales/suppressionRules";
import { nanpRegionForAreaCode } from "@/lib/voice/nanp";
import { checkSuppression } from "@/lib/sales/suppression";
import { createSalesLead } from "@/lib/sales/leadCreate";

/** The refusal codes, so the screen and the check can name them. */
export const START_REFUSALS = Object.freeze({
  unreadable: "That is not a phone number we can read.",
  outside_nanp: "Texting is available for Canadian and US numbers only.",
  outside_us_ca: "Texting is available for Canadian and US numbers only.",
  suppressed: "This number asked not to be contacted. Nothing can be sent to it.",
  held_by_other: "This number belongs to a contractor another rep is working.",
});

/**
 * Pure: is this a number FieldQuo may open a text conversation with?
 *
 * @returns { ok: true, e164, country: "CA"|"US" }
 *        | { ok: false, code, error }
 */
export function judgeNewTextNumber(raw) {
  const e164 = normalisePhone(raw);
  if (!e164) return { ok: false, code: "unreadable", error: START_REFUSALS.unreadable };
  if (!/^\+1\d{10}$/.test(e164)) {
    return { ok: false, code: "outside_nanp", error: START_REFUSALS.outside_nanp };
  }
  const region = nanpRegionForAreaCode(e164.slice(2, 5));
  if (region !== "CA" && region !== "US") {
    return { ok: false, code: "outside_us_ca", error: START_REFUSALS.outside_us_ca };
  }
  return { ok: true, e164, country: region };
}

/**
 * Who, if anybody, already holds this number.
 *
 * Three tables, in the order a rep would expect: their leads, the prospect
 * pool, the stored contact numbers. `SalesLead.phone` is stored as typed,
 * so candidates are narrowed on the last four digits and compared
 * normalised — the same comparison leadForThread() makes.
 *
 * @returns { kind: "own", lead } | { kind: "other", holderName } | { kind: "none" }
 */
export async function resolveNumberHolder(client, { e164, salesRepId }) {
  const tail = e164.slice(-4);

  const leads = await client.salesLead.findMany({
    where: { phone: { contains: tail } },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: {
      id: true,
      phone: true,
      salesRepId: true,
      businessName: true,
      salesRep: { select: { name: true } },
    },
  });
  const matching = leads.filter((l) => normalisePhone(l.phone) === e164);
  const own = matching.find((l) => l.salesRepId === salesRepId);
  if (own) return { kind: "own", lead: own };
  if (matching.length) return { kind: "other", holderName: matching[0].salesRep?.name || null };

  // Prospect.assignedRepId is a loose pointer (no relation), so the holder's
  // name is a second read.
  const repName = async (id) =>
    id ? (await client.salesRep.findUnique({ where: { id }, select: { name: true } }))?.name || null : null;

  const prospect = await client.prospect.findFirst({
    where: { phoneE164: e164 },
    select: { id: true, businessName: true, assignedRepId: true },
  });
  if (prospect?.assignedRepId && prospect.assignedRepId !== salesRepId) {
    return { kind: "other", holderName: await repName(prospect.assignedRepId) };
  }

  const numbers = await client.salesContactNumber.findMany({
    where: { e164 },
    select: {
      salesLead: { select: { id: true, phone: true, salesRepId: true, businessName: true, salesRep: { select: { name: true } } } },
      prospect: { select: { id: true, assignedRepId: true } },
    },
  });
  for (const n of numbers) {
    if (n.salesLead?.salesRepId === salesRepId) return { kind: "own", lead: n.salesLead };
    if (n.salesLead && n.salesLead.salesRepId !== salesRepId) {
      return { kind: "other", holderName: n.salesLead.salesRep?.name || null };
    }
    if (n.prospect?.assignedRepId && n.prospect.assignedRepId !== salesRepId) {
      return { kind: "other", holderName: await repName(n.prospect.assignedRepId) };
    }
  }

  // An unclaimed prospect with this number is nobody's yet; the lead made
  // below carries the prospect so the two records stay one business.
  return { kind: "none", prospect: prospect && !prospect.assignedRepId ? prospect : null };
}

/**
 * Open a conversation with a typed number.
 *
 * @returns { ok: true, e164, leadId, created }
 *        | { ok: false, status, code, error }
 */
export async function startTextThread(client, { rep, raw }) {
  const judged = judgeNewTextNumber(raw);
  if (!judged.ok) return { ok: false, status: 400, code: judged.code, error: judged.error };
  const { e164, country } = judged;

  // The list first, and nothing written on a refusal.
  const verdict = await checkSuppression(client, { phone: e164, channel: "sms" });
  if (verdict?.suppressed) {
    return { ok: false, status: 409, code: "suppressed", error: verdict.reason || START_REFUSALS.suppressed };
  }

  const holder = await resolveNumberHolder(client, { e164, salesRepId: rep.id });
  if (holder.kind === "other") {
    const who = holder.holderName ? ` It is held by ${holder.holderName}.` : "";
    return { ok: false, status: 409, code: "held_by_other", error: `${START_REFUSALS.held_by_other}${who}` };
  }
  if (holder.kind === "own") {
    return { ok: true, e164, leadId: holder.lead.id, created: false };
  }

  const lead = await createSalesLead(client, {
    salesRepId: rep.id,
    businessName: "",
    phone: e164,
    country,
    source: holder.prospect
      ? { id: holder.prospect.id, businessName: holder.prospect.businessName, phoneE164: e164 }
      : null,
  });
  return { ok: true, e164, leadId: lead.id, created: true };
}
