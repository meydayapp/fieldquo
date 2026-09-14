// lib/sales/messages/business.js
//
// One conversation per BUSINESS, with every number of theirs inside it.
//
// ══ The rule, in the owner's words ═══════════════════════════════════════
//
// "Any texts sent to a company should also end up in SMS" — every text a rep
// or the engine sends to a prospect has to show in that rep's Texts screen,
// in the conversation for that business. Not "for that number": a contractor
// is one business with a shop line, an owner's cell and whatever a rep was
// given on a call, and the rep texting the signup link to the cell and the
// engine texting the day-1 check-in to the shop line is ONE conversation
// with them. Keyed by number, as the list was, it was two rows with two
// names — or one name and one bare number — and the rep reading the second
// could not see the first.
//
// ══ What is keyed on the number, and stays that way ═══════════════════════
//
// The rows. SalesSmsMessage, SalesCheckIn and SalesSmsThreadRead all carry
// the other party's E.164, and nothing here changes that: a text goes to a
// number, a STOP arrives from a number, and the do-not-contact list is keyed
// on the number it came from. What changes is the READ — threads are built
// per number as before and then folded together when their rows point at
// the same business.
//
// ══ What "the same business" means ════════════════════════════════════════
//
// The strongest identity the rows offer, in order: the company a lead
// converted into, the discovered prospect a lead hangs off, the lead itself.
// Two leads for one contractor that share neither a company nor a prospect
// stay two conversations — folding them on a name would merge "Loop Inc" in
// two cities, and leadForThread() already prefers the converted lead when a
// number sits on more than one row.
//
// Pure functions, executed by scripts/check-sales-messages.mjs against
// hostile shapes, plus one lookup that takes its client. The resolver that
// walks the database for a business's numbers is businessResolve.js — its
// own file because it imports the check-in store, which imports salesSms.js,
// which imports this; a cycle nobody would notice until the day a top-level
// read of an undefined binding took the send path down.

import { normalisePhone } from "../suppressionRules";

/** The lead columns the identity needs. Read by every query that feeds a merge. */
export const BUSINESS_LEAD_SELECT = Object.freeze({
  id: true,
  businessName: true,
  contactName: true,
  convertedCompanyId: true,
  prospectId: true,
});

/**
 * The identity a thread is folded on, or null when the rows name nobody.
 *
 * Null rather than the number: a thread with no lead is a stranger's number
 * (an inbound text nobody has answered, a wrong number) and the caller keys
 * it on the number itself. Two stranger threads are two strangers.
 */
export function businessKeyOf(lead) {
  if (!lead) return null;
  if (lead.convertedCompanyId) return `company:${lead.convertedCompanyId}`;
  if (lead.prospectId) return `prospect:${lead.prospectId}`;
  if (lead.id) return `lead:${lead.id}`;
  return null;
}

const at = (v) => {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d.getTime() : 0;
};

/**
 * The read state of a folded conversation, from the states of its numbers.
 *
 * The LATEST read and the LATEST filing. rooms.js's isThreadDone() compares
 * `doneAt` with the last inbound instant across the whole conversation, so
 * a rep who filed the shop-line thread as done and then gets a reply on the
 * owner's cell sees the conversation come back — the reply is later than the
 * filing. Null when no number has a state: "never opened" stays sayable.
 */
export function mergeReadStates(states) {
  let readAt = null;
  let doneAt = null;
  for (const s of states || []) {
    if (!s) continue;
    if (s.readAt && at(s.readAt) > at(readAt)) readAt = s.readAt;
    if (s.doneAt && at(s.doneAt) > at(doneAt)) doneAt = s.doneAt;
  }
  return readAt || doneAt ? { readAt, doneAt } : null;
}

/**
 * Fold per-number threads into per-business conversations.
 *
 * @param threads  salesConversations()'s per-number entries, each with a
 *   `businessKey` (businessKeyOf over the thread's lead, or null).
 * @returns the folded list, newest activity first. Each conversation keeps
 *   the shape the screen already reads and adds:
 *     e164     the number of the LATEST row — where a reply goes by default
 *              and what the URL carries;
 *     numbers  every number in the conversation, latest first, with the
 *              count and last instant of each, so the context bar can list
 *              them and the read route can mark all of them.
 *
 * Sums, maxima and "latest wins" throughout: counts and unread add up,
 * lastInboundAt is the latest of any number, the triage chip is the kind of
 * the latest inbound across every number, and the name is the first one any
 * number can offer.
 */
export function mergeThreadsByBusiness(threads) {
  const list = (Array.isArray(threads) ? threads : []).filter(Boolean);
  const byKey = new Map();
  for (const t of list) {
    const key = t.businessKey || `number:${t.e164}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(t);
  }

  const out = [];
  for (const [key, parts] of byKey) {
    parts.sort((a, b) => at(b.lastAt) - at(a.lastAt));
    const head = parts[0];
    const merged = {
      ...head,
      businessKey: head.businessKey || null,
      numbers: parts.map((p) => ({ e164: p.e164, lastAt: p.lastAt || null, count: p.count || 0 })),
      count: parts.reduce((n, p) => n + (p.count || 0), 0),
      unread: parts.some((p) => p.unread === null) ? null : parts.reduce((n, p) => n + (p.unread || 0), 0),
      readState: mergeReadStates(parts.map((p) => p.readState)),
      lastInboundAt: parts.reduce((latest, p) => (at(p.lastInboundAt) > at(latest) ? p.lastInboundAt : latest), null),
      leadId: parts.find((p) => p.leadId)?.leadId || null,
      name: parts.find((p) => p.name)?.name || null,
      // Any number nobody owns makes the conversation a stranger's until a
      // rep answers; a number with a rep's own rows on it is theirs.
      unowned: parts.every((p) => p.unowned === true),
    };
    // The chip belongs to the LATEST reply across every number, and "open"
    // means the conversation as a whole ends on their words.
    const latestIn = parts
      .filter((p) => p.lastInboundAt)
      .sort((a, b) => at(b.lastInboundAt) - at(a.lastInboundAt))[0];
    merged.triage = latestIn?.triage ? { ...latestIn.triage, open: merged.lastDirection === "in" } : null;
    merged.unanswered = merged.lastDirection === "in";
    void key;
    out.push(merged);
  }
  out.sort((a, b) => at(b.lastAt) - at(a.lastAt));
  return out;
}

/**
 * How many trailing digits narrow the SQL. Four, as startThread.js's
 * resolveNumberHolder() uses: a number stored as typed — "(514) 555-0134" —
 * has punctuation inside any longer run of digits, so seven would miss the
 * very rows this exists to find. The last four are always contiguous.
 */
const PHONE_TAIL_DIGITS = 4;

/**
 * The leads, of any rep, whose phone is this number — matched on the
 * NORMALISED value, the way leadForThread() matches, because `phone` is
 * stored as the rep typed it. The SQL narrows on the last four digits so a
 * scan of every lead in the book is never issued; the comparison that
 * decides is normalisePhone's.
 */
export async function leadsOnNumber(client, e164, { salesRepId = null, select = BUSINESS_LEAD_SELECT } = {}) {
  const other = normalisePhone(e164);
  if (!other) return [];
  const tail = other.replace(/\D/g, "").slice(-PHONE_TAIL_DIGITS);
  if (!tail) return [];
  const rows = await client.salesLead
    .findMany({
      where: { phone: { contains: tail }, ...(salesRepId ? { salesRepId } : {}) },
      select: { ...select, phone: true, salesRepId: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 200,
    })
    .catch(() => []);
  return rows.filter((l) => normalisePhone(l.phone) === other);
}
