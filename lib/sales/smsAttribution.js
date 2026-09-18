// lib/sales/smsAttribution.js
//
// Whose text is this? A message arrives on one of FieldQuo's sales lines and
// somebody has to answer it. This module decides WHO — a rep, and where it
// can, a lead or a prospect — and writes down which rule decided.
//
// ══ The text that went to everybody ═══════════════════════════════════════
//
// 2026-09-18, 12:25 UTC: Favor dials Advance Appliance (+1 888 420 9806) from
// +1 438 609 9615 and leaves a voicemail. 12:27: "Hi, this is Charlotte at
// Advance Appliance and I received your Voicemail…" arrives on that line —
// from +1 914 935 7510, the office's cell, a number on no record anywhere.
// handleSalesInboundSms looked for the last text WE sent to 914… (none), a
// lead carrying 914… (none; Advance Appliance is a Prospect, and the number
// is not the prospect's anyway), a stored contact number (none) — and filed
// the row to nobody. "Nobody" was then LISTED TO EVERYBODY: the conversation
// list showed every unowned inbound text to every rep as "Needs a reply",
// so Daniel's Texts screen carried a message meant for Favor, and Favor's
// carried it too with no sign it was hers.
//
// Two mistakes, and this file closes both:
//
//   1. The ladder stopped one rung short. The line the text arrived on had
//      been used two minutes earlier, by one rep, to ring one business, and
//      the body NAMES that business. That is not a coincidence a filing
//      system should refuse to read.
//   2. "Unowned" was rendered as "everyone's". A text nobody can file goes to
//      the superadmin's conversations page marked nobody's — assign; it never
//      appears in a rep's list, because a list every rep sees is a list every
//      rep ignores.
//
// ══ The ladder, in the order of how sure each rung is ═════════════════════
//
//   (a) THE NUMBER ITSELF. The last text we sent to it (the rep who asked
//       owns the answer, and the lead that text was about is the lead this
//       reply is about); a lead whose phone is this number; a prospect whose
//       phone is this number; a stored contact number (the owner's cell a rep
//       was given on a call). What handleSalesInboundSms did before, kept as
//       it was, plus the prospect — matchInboundCaller in
//       lib/sales/calls/inboundMatch.js already reads prospects for a call
//       and a text is not a weaker fact than a call.
//
//   (b) THE LINE IT ARRIVED ON. The rep who most recently placed a call or a
//       text FROM this sales number, within the last 24 hours, to anybody.
//       That rep is the rep. The business is that rep's recent call or text
//       from the line whose name the body contains (token overlap, normalised
//       — "Charlotte at Advance Appliance" names Advance Appliance), or,
//       failing a name, the most recent one within two hours to a number in
//       the SENDER's area code (an office texting back from its cell in the
//       same city as its shop line). No name and no area code: the rep alone,
//       and the business left null rather than guessed — inventing a lead to
//       hang a message on puts a business in a rep's pipeline because
//       somebody dialled a wrong number.
//
//   (c) THE LINE'S OWNER. PlatformSmsNumber.assignedRepId — the same column
//       /platform/crew-lines prints as the number's holder and
//       lib/sales/numbers.js's callerIdForRep dials from. A line nobody has
//       used today still belongs to somebody.
//
//   (d) NOBODY. salesRepId null, matchedBy null. Listed to superadmins on
//       /platform/sales/conversations with an Assign control, which files the
//       row through the same function as every rung above (attributeSmsMessage)
//       with matchedBy "manual" and an audit row naming who.
//
// ══ Pure decision, one writer ═════════════════════════════════════════════
//
// attributeInboundSms() takes rows and returns facts — the shape
// matchInboundCaller() returns, and for the same reason: every hostile case
// (two reps dialled from one line today; a text with no business name in it;
// an area code that matches a call from six hours ago) is EXECUTED by
// scripts/check-sales-sms.mjs rather than reasoned about. The reads are in
// resolveInboundSmsAttribution(); the one write, on the row and in the audit
// log, is attributeSmsMessage(), which the webhook, the repair script and the
// superadmin's Assign button all go through. There is no second writer.

import { db } from "@/lib/db";
import { areaCodeOf } from "@/lib/voice/numberSearch";
import { appSentence, pushToReps } from "@/lib/notify/push";
import { normalisePhone } from "./suppressionRules";
import { AGENCY_KIND, AGENCY_ENGAGEMENT } from "./agencyLabel";

// ── Which rung fired. Stored on SalesSmsMessage.matchedBy ─────────────────
/** (a) The last text we sent to this number. */
export const SMS_MATCHED_BY_LAST_TEXT = "last_text";
/** (a) A lead whose phone is this number. */
export const SMS_MATCHED_BY_LEAD_PHONE = "lead_phone";
/** (a) A prospect whose phone is this number. */
export const SMS_MATCHED_BY_PROSPECT_PHONE = "prospect_phone";
/** (a) A stored contact number — the owner's cell a rep was given. */
export const SMS_MATCHED_BY_CONTACT_NUMBER = "contact_number";
/** (b) The line's recent user, and the body names the business they rang. */
export const SMS_MATCHED_BY_LINE_BUSINESS_NAME = "line_business_name";
/** (b) The line's recent user, and the sender shares an area code with a call under two hours old. */
export const SMS_MATCHED_BY_LINE_AREA_CODE = "line_area_code";
/** (b) The line's recent user alone; no business could be named. */
export const SMS_MATCHED_BY_LINE_RECENT_REP = "line_recent_rep";
/** (c) The rep the line is assigned to. */
export const SMS_MATCHED_BY_LINE_OWNER = "line_owner";
/** A rep's reply claimed an unowned row on the number (deliverReplySms). */
export const SMS_MATCHED_BY_REPLY_CLAIM = "reply_claim";
/** A superadmin filed it by hand. */
export const SMS_MATCHED_BY_MANUAL = "manual";

export const SMS_MATCHED_BY = Object.freeze([
  SMS_MATCHED_BY_LAST_TEXT,
  SMS_MATCHED_BY_LEAD_PHONE,
  SMS_MATCHED_BY_PROSPECT_PHONE,
  SMS_MATCHED_BY_CONTACT_NUMBER,
  SMS_MATCHED_BY_LINE_BUSINESS_NAME,
  SMS_MATCHED_BY_LINE_AREA_CODE,
  SMS_MATCHED_BY_LINE_RECENT_REP,
  SMS_MATCHED_BY_LINE_OWNER,
  SMS_MATCHED_BY_REPLY_CLAIM,
  SMS_MATCHED_BY_MANUAL,
]);

/** How far back rung (b) looks for a use of the line. */
export const LINE_USE_WINDOW_MS = 24 * 60 * 60 * 1000;
/** How fresh a call has to be for an area-code match to count. */
export const AREA_CODE_WINDOW_MS = 2 * 60 * 60 * 1000;

/** The audit-log action every attribution writes. */
export const SMS_ATTRIBUTED_ACTION = "sales_sms_attributed";

// ── Business names in a body ───────────────────────────────────────────────
//
// Tokens that carry no identity: a body containing "the" does not name "The
// Roofing Company". Trade words are NOT on this list on purpose — "appliance"
// is most of what makes "Advance Appliance" recognisable, and a list long
// enough to strip every trade word would strip every name.
const NAME_NOISE = new Set([
  "the", "a", "an", "and", "of", "at", "in", "on", "for", "to", "by", "with", "&",
  "inc", "inc.", "llc", "ltd", "ltd.", "ltee", "ltée", "co", "co.", "corp", "corp.",
  "company", "group", "enterprises", "enterprise", "services", "service", "solutions",
  "les", "le", "la", "des", "de", "du", "et",
]);

/** Lower-case word tokens with accents and punctuation removed. Exported for the check. */
export function nameTokens(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !NAME_NOISE.has(t));
}

/**
 * Does this body name this business?
 *
 * All of the name's significant tokens must appear in the body when the name
 * is one or two tokens long; at least two, and at least sixty percent, when
 * it is longer. "Best" alone does not name "Best Plumbing" — a body saying
 * "the best time to call is 3" is not from them — and a one-token name has
 * to be at least four characters, so "ABC" in "abc123" does not either.
 *
 * Pure; exported for the check.
 */
export function bodyNamesBusiness(body, names) {
  const have = new Set(nameTokens(body));
  if (!have.size) return false;
  const list = (Array.isArray(names) ? names : [names]).filter(Boolean);
  for (const name of list) {
    const want = [...new Set(nameTokens(name))];
    if (!want.length) continue;
    if (want.length === 1) {
      if (want[0].length >= 4 && have.has(want[0])) return true;
      continue;
    }
    const hits = want.filter((t) => have.has(t)).length;
    if (want.length === 2 ? hits === 2 : hits >= 2 && hits / want.length >= 0.6) return true;
  }
  return false;
}

function businessOf(use) {
  return use?.prospect
    ? { prospectId: use.prospect.id, leadId: use.leadId || null, name: use.prospect.businessName || null }
    : use?.lead
      ? { prospectId: use.lead.prospectId || null, leadId: use.lead.id, name: use.lead.businessName || use.lead.contactName || null }
      : { prospectId: use.prospectId || null, leadId: use.leadId || null, name: null };
}

function namesOf(use) {
  return [
    use?.prospect?.businessName,
    ...(Array.isArray(use?.prospect?.tradingNames) ? use.prospect.tradingNames : []),
    use?.lead?.businessName,
    use?.lead?.contactName,
  ].filter(Boolean);
}

const NONE = Object.freeze({ salesRepId: null, leadId: null, prospectId: null, matchedBy: null });

/**
 * Decide, from rows the caller has already read.
 *
 * @param fromE164    the sender.
 * @param body        the text.
 * @param now         when it arrived.
 * @param lastOut     the last OUTBOUND SalesSmsMessage to the sender, with
 *                    `salesRepId`, `leadId`, `prospectId`; or null.
 * @param leads       SalesLead rows whose phone is the sender.
 * @param prospects   Prospect rows whose phoneE164 is the sender.
 * @param contactLead the lead behind a SalesContactNumber on the sender.
 * @param lineUses    every outbound call and text FROM the line the text
 *                    arrived on, newest first, each
 *                    `{ salesRepId, at, toE164, leadId, prospectId, lead?, prospect? }`.
 *                    The caller bounds them to LINE_USE_WINDOW_MS; this
 *                    function bounds them again, so a caller that forgot the
 *                    window cannot widen it.
 * @param lineOwnerRepId PlatformSmsNumber.assignedRepId of the line.
 * @returns `{ salesRepId, leadId, prospectId, matchedBy, text }` — every id
 *          null and matchedBy null when nobody can be named.
 */
export function attributeInboundSms({
  fromE164 = null,
  body = "",
  now = new Date(),
  lastOut = null,
  leads = [],
  prospects = [],
  contactLead = null,
  lineUses = [],
  lineOwnerRepId = null,
} = {}) {
  const at = now instanceof Date ? now : new Date(now);

  // ── (a) The number itself ────────────────────────────────────────────
  if (lastOut?.salesRepId) {
    return {
      salesRepId: lastOut.salesRepId,
      leadId: lastOut.leadId || null,
      prospectId: lastOut.prospectId || null,
      matchedBy: SMS_MATCHED_BY_LAST_TEXT,
      text: "The rep who last texted this number owns the answer.",
    };
  }
  const leadRows = (Array.isArray(leads) ? leads : []).filter((l) => l && l.id);
  // A converted lead first — a customer texting is worth more than a cold
  // row on the same number — then the most recently updated, which is the
  // order leadsOnNumber() already returns.
  const lead = leadRows.find((l) => l.convertedCompanyId) || leadRows[0] || null;
  if (lead?.salesRepId) {
    return {
      salesRepId: lead.salesRepId,
      leadId: lead.id,
      prospectId: lead.prospectId || null,
      matchedBy: SMS_MATCHED_BY_LEAD_PHONE,
      text: "A lead carries this number.",
    };
  }
  const prospectRows = (Array.isArray(prospects) ? prospects : []).filter((p) => p && p.id);
  // One prospect, not two: duplicates are flagged rather than merged
  // (inboundMatch.js says why picking one is wrong), so two rows on the
  // number fall through to the line rungs, which can still name the rep.
  if (prospectRows.length === 1 && prospectRows[0].assignedRepId) {
    return {
      salesRepId: prospectRows[0].assignedRepId,
      leadId: lead?.id || null,
      prospectId: prospectRows[0].id,
      matchedBy: SMS_MATCHED_BY_PROSPECT_PHONE,
      text: "A discovered business carries this number, and it is claimed.",
    };
  }
  if (contactLead?.salesRepId) {
    return {
      salesRepId: contactLead.salesRepId,
      leadId: contactLead.id,
      prospectId: contactLead.prospectId || null,
      matchedBy: SMS_MATCHED_BY_CONTACT_NUMBER,
      text: "A rep was given this number on a call and stored it on their lead.",
    };
  }

  // ── (b) The line it arrived on ───────────────────────────────────────
  const uses = (Array.isArray(lineUses) ? lineUses : [])
    .filter((u) => u && u.salesRepId && u.at)
    .map((u) => ({ ...u, atMs: new Date(u.at).getTime() }))
    .filter((u) => Number.isFinite(u.atMs) && u.atMs <= at.getTime() && at.getTime() - u.atMs <= LINE_USE_WINDOW_MS)
    .sort((x, y) => y.atMs - x.atMs);
  if (uses.length) {
    const rep = uses[0].salesRepId;
    // Only THAT rep's uses of the line name the business. Two reps dialling
    // from one line today is exactly the case the shared pool produced, and
    // the second rep's prospect must not be filed to the first.
    const own = uses.filter((u) => u.salesRepId === rep);
    const named = own.find((u) => bodyNamesBusiness(body, namesOf(u)));
    if (named) {
      const b = businessOf(named);
      return {
        salesRepId: rep,
        leadId: b.leadId,
        prospectId: b.prospectId,
        matchedBy: SMS_MATCHED_BY_LINE_BUSINESS_NAME,
        text: `${rep === uses[0].salesRepId ? "The rep who last used this line" : "A rep"} rang ${b.name || "a business"} from it, and the text names them.`,
      };
    }
    const area = areaCodeOf(fromE164);
    const local = area
      ? own.find((u) => at.getTime() - u.atMs <= AREA_CODE_WINDOW_MS && areaCodeOf(u.toE164) === area && (u.prospectId || u.leadId || u.prospect || u.lead))
      : null;
    if (local) {
      const b = businessOf(local);
      return {
        salesRepId: rep,
        leadId: b.leadId,
        prospectId: b.prospectId,
        matchedBy: SMS_MATCHED_BY_LINE_AREA_CODE,
        text: `The rep who last used this line rang ${b.name || "a business"} in the sender's area code under two hours ago.`,
      };
    }
    return {
      salesRepId: rep,
      leadId: null,
      prospectId: null,
      matchedBy: SMS_MATCHED_BY_LINE_RECENT_REP,
      text: "The rep who last used this line. The text names no business they rang, so none is attached.",
    };
  }

  // ── (c) The line's owner ─────────────────────────────────────────────
  if (lineOwnerRepId) {
    return {
      salesRepId: lineOwnerRepId,
      leadId: null,
      prospectId: null,
      matchedBy: SMS_MATCHED_BY_LINE_OWNER,
      text: "Nobody used this line today; it is assigned to this rep.",
    };
  }

  // ── (d) Nobody ───────────────────────────────────────────────────────
  return { ...NONE, text: "No rule could name a rep. It is nobody's until a superadmin assigns it." };
}

/**
 * The reads behind attributeInboundSms(), for a text that just arrived.
 *
 * Every read fails soft to "nothing found" and is guarded on the model
 * existing on the client, because scripts drive the inbound handler over a
 * fake database that knows only the tables it was written for — and because
 * a text must be STORED whether or not it can be filed; the store is the
 * point and the filing is the commentary.
 */
export async function resolveInboundSmsAttribution({ client = db, fromE164, toE164, body = "", now = new Date() } = {}) {
  const sender = normalisePhone(fromE164);
  const line = normalisePhone(toE164);
  const since = new Date(now.getTime() - LINE_USE_WINDOW_MS);
  const soft = (p) => (p && typeof p.catch === "function" ? p.catch(() => null) : Promise.resolve(p ?? null));

  const [lastOut, leads, prospects, contact, calls, texts, lineRow] = await Promise.all([
    sender
      ? soft(client.salesSmsMessage.findFirst({
          where: { toE164: sender, direction: "out" },
          orderBy: { sentAt: "desc" },
          select: { salesRepId: true, leadId: true, prospectId: true },
        }))
      : null,
    sender ? soft(leadsOnPhone(client, sender)) : [],
    sender && client.prospect
      ? soft(client.prospect.findMany({
          where: { phoneE164: sender, mergedIntoId: null },
          select: { id: true, businessName: true, assignedRepId: true },
          take: 3,
        }))
      : [],
    sender && client.salesContactNumber
      ? soft(client.salesContactNumber.findFirst({ where: { e164: sender }, select: { salesLeadId: true, prospectId: true } }))
      : null,
    line && client.salesCallAttempt
      ? soft(client.salesCallAttempt.findMany({
          where: { direction: "out", fromE164: line, dialledAt: { gte: since, lte: now }, salesRepId: { not: null } },
          orderBy: { dialledAt: "desc" },
          take: 60,
          select: {
            salesRepId: true, dialledAt: true, toE164: true, leadId: true, prospectId: true,
            prospect: { select: { id: true, businessName: true, tradingNames: true } },
            lead: { select: { id: true, businessName: true, contactName: true, prospectId: true } },
          },
        }))
      : [],
    line
      ? soft(client.salesSmsMessage.findMany({
          where: { direction: "out", fromE164: line, sentAt: { gte: since, lte: now } },
          orderBy: { sentAt: "desc" },
          take: 60,
          select: {
            salesRepId: true, sentAt: true, toE164: true, leadId: true, prospectId: true,
            lead: { select: { id: true, businessName: true, contactName: true, prospectId: true } },
          },
        }))
      : [],
    line
      ? soft(client.platformSmsNumber.findFirst({ where: { e164: line, active: true }, select: { assignedRepId: true } }))
      : null,
  ]);

  let contactLead = null;
  if (contact?.salesLeadId || contact?.prospectId) {
    contactLead = await soft(client.salesLead.findFirst({
      where: contact.salesLeadId ? { id: contact.salesLeadId } : { prospectId: contact.prospectId },
      orderBy: { updatedAt: "desc" },
      select: { id: true, salesRepId: true, prospectId: true, businessName: true, contactName: true },
    }));
  }

  const lineUses = [
    ...(Array.isArray(calls) ? calls : []).map((c) => ({ ...c, at: c.dialledAt })),
    ...(Array.isArray(texts) ? texts : []).map((t) => ({ ...t, at: t.sentAt })),
  ];

  return attributeInboundSms({
    fromE164: sender,
    body,
    now,
    lastOut,
    leads: Array.isArray(leads) ? leads : [],
    prospects: Array.isArray(prospects) ? prospects : [],
    contactLead,
    lineUses,
    lineOwnerRepId: lineRow?.assignedRepId || null,
  });
}

/**
 * Leads whose phone is this number, compared normalised — the same read
 * lib/sales/messages/business.js's leadsOnNumber makes (kept out of the
 * import graph here because that module pulls the whole thread fold in).
 */
async function leadsOnPhone(client, e164) {
  const tail = String(e164).slice(-4);
  const rows = await client.salesLead.findMany({
    where: { phone: { contains: tail } },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { id: true, salesRepId: true, prospectId: true, businessName: true, contactName: true, phone: true, convertedCompanyId: true },
  });
  return rows.filter((l) => normalisePhone(l.phone) === e164);
}

/**
 * THE write. Files one inbound row to a rep (and a lead / prospect where
 * known), records how, and tells the rep.
 *
 * ── Only an unowned row, unless told otherwise ───────────────────────────
 *
 * A row already filed to somebody is left alone by default — the same null
 * guard SalesCallAttempt.answeredByRepId keeps: an attribution that stands
 * is not silently replaced by a later, weaker one. A superadmin's Assign
 * passes `replace: true` and the audit row carries the previous owner.
 *
 * @returns `{ ok, before, after, audited }` — `ok: false` with `reason`
 *          when nothing was changed.
 */
export async function attributeSmsMessage({
  client = db,
  messageId,
  salesRepId,
  leadId = null,
  prospectId = null,
  matchedBy,
  replace = false,
  by = null, // { platformAdminId } for a manual filing; null for the ladder
  notify = true,
  now = new Date(),
} = {}) {
  if (!messageId) return { ok: false, reason: "No message." };
  if (!salesRepId) return { ok: false, reason: "An attribution names a rep." };
  if (!SMS_MATCHED_BY.includes(matchedBy)) return { ok: false, reason: `Unknown rule "${matchedBy}".` };

  const row = await client.salesSmsMessage.findUnique({
    where: { id: messageId },
    select: { id: true, direction: true, salesRepId: true, leadId: true, prospectId: true, matchedBy: true, fromE164: true, body: true },
  });
  if (!row) return { ok: false, reason: "No such message." };
  if (row.direction !== "in") return { ok: false, reason: "Only an inbound text is filed; an outbound one already has its sender." };
  if (row.salesRepId && !replace) {
    return { ok: false, reason: "Already filed to a rep. Pass replace to re-file it.", before: pick(row) };
  }

  const before = pick(row);
  const after = { salesRepId, leadId: leadId || null, prospectId: prospectId || null, matchedBy };

  // The row and its audit line in one transaction: an attribution with no
  // record of who made it is the thing a commission dispute cannot settle.
  const audited = await client.$transaction(async (tx) => {
    await tx.salesSmsMessage.update({ where: { id: messageId }, data: after });
    if (!tx.platformAuditLog) return null;
    return tx.platformAuditLog.create({
      data: {
        platformAdminId: by?.platformAdminId || null,
        action: SMS_ATTRIBUTED_ACTION,
        details: { messageId, fromE164: row.fromE164, before, after, at: now.toISOString() },
      },
      select: { id: true, createdAt: true },
    });
  });

  // The push, to the ONE rep the row now belongs to — the same copy the
  // webhook sends for a reply that matched on arrival. Fire-and-forget; the
  // record is the update above.
  if (notify) {
    let who = row.fromE164;
    try {
      if (prospectId && client.prospect) {
        who = (await client.prospect.findUnique({ where: { id: prospectId }, select: { businessName: true } }))?.businessName || who;
      } else if (leadId) {
        const l = await client.salesLead.findUnique({ where: { id: leadId }, select: { businessName: true, contactName: true } });
        who = l?.businessName || l?.contactName || who;
      }
    } catch {
      /* the number is a fine fallback */
    }
    void pushToReps({
      salesRepIds: [salesRepId],
      payload: async (language) => ({
        title: await appSentence(language, "app.notify.newText.title", { from: who }),
        body: String(row.body ?? "").replace(/\s+/g, " ").trim().slice(0, 90),
        tag: `sales-sms:${row.fromE164 || "unknown"}`,
        url: row.fromE164 ? `/sales/messages?with=${encodeURIComponent(row.fromE164)}` : "/sales/messages",
      }),
    });
  }

  return { ok: true, before, after, audited: audited ? { id: audited.id, at: audited.createdAt } : null };
}

function pick(row) {
  return { salesRepId: row.salesRepId || null, leadId: row.leadId || null, prospectId: row.prospectId || null, matchedBy: row.matchedBy || null };
}

/**
 * Whose rows a rep's Texts screen may list: their own, and — for an AGENCY
 * account — its employees', because the owner's brief for agencies is "their
 * version of the sales floor, only for their team" (lib/sales/agency.js).
 * An employee sees only their own; a team lead who is not an agency sees
 * only their own (lib/sales/team.js's TEAM_LEAD_CANNOT_SEE is silent on
 * texts, and silence is not permission).
 *
 * Read fresh per request, never carried from a screen. Fails to the rep
 * alone: a team that could not be read is not a team that vanished, but a
 * list that widens on an error is worse than one that narrows.
 */
export async function smsVisibleRepIds(salesRepId, client = db) {
  if (!salesRepId) return [];
  try {
    const rep = await client.salesRep.findUnique({ where: { id: salesRepId }, select: { kind: true } });
    if (rep?.kind !== AGENCY_KIND) return [salesRepId];
    const team = await client.salesRep.findMany({
      where: { managerId: salesRepId, engagement: AGENCY_ENGAGEMENT },
      select: { id: true },
    });
    return [salesRepId, ...team.map((r) => r.id).filter((id) => id !== salesRepId)];
  } catch {
    return [salesRepId];
  }
}

/**
 * The floor's unfiled texts, newest first, for the superadmin's page.
 * Rung (d)'s rows and nothing else: inbound, no rep.
 */
export async function unownedInboundTexts({ client = db, limit = 100 } = {}) {
  const rows = await client.salesSmsMessage.findMany({
    where: { direction: "in", salesRepId: null },
    orderBy: { sentAt: "desc" },
    take: limit,
    select: { id: true, fromE164: true, toE164: true, body: true, sentAt: true, triage: true },
  });
  // The line each arrived on, named by its holder, so the screen can say
  // "on Rachel's line" beside a text nobody could file to Rachel.
  const lines = [...new Set(rows.map((r) => r.toE164).filter(Boolean))];
  const holders = new Map();
  if (lines.length) {
    const numbers = await client.platformSmsNumber
      .findMany({ where: { e164: { in: lines } }, select: { e164: true, assignedRep: { select: { id: true, name: true } } } })
      .catch(() => []);
    for (const n of numbers) holders.set(n.e164, n.assignedRep || null);
  }
  return rows.map((r) => ({ ...r, lineHolder: holders.get(r.toE164) || null }));
}
