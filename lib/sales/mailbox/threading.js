// lib/sales/mailbox/threading.js
//
// Which conversation a synced message belongs to, and which lead.
//
// ══ Headers first, then the subject, then a new thread ════════════════════
//
// A reply names what it answers: In-Reply-To carries the parent's
// Message-ID and References carries the chain. When any id in that chain is
// a message we already hold, the thread is that message's — this is how
// Gmail and Zero thread (docs/sales-intel/ZERO-STUDY.md §2), and it is the
// only rule that survives a prospect replying from a second address.
//
// Some clients send no References (a phone app answering a forwarded
// message, a web form). For those, the fallback is the SAME counterpart and
// the SAME normalised subject on a thread that moved within a window — the
// rule Apple Mail falls back to. Two conversations with one plumber about
// "quote" a month apart are two threads; a reply an hour later is one.
//
// Neither rule reads the body. Both are pure, and
// scripts/check-sales-mailbox.mjs runs them against a reply with a foreign
// References chain, a subject-only match outside the window, and a message
// with nothing at all.

export const SUBJECT_MATCH_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * @param message     normaliseParsedMail's output
 * @param byMessageId Map<messageId, threadId> for every id in the chain we hold
 * @param bySubject   [{ threadId, lastMessageAt }] threads with this
 *                    counterpart and normalised subject, newest first
 * @returns { threadId, how } — how: "references" | "subject" | null (new)
 */
export function chooseThread(message, { byMessageId, bySubject = [] } = {}) {
  const chain = [message?.inReplyTo, ...(message?.references || [])].filter(Boolean);
  for (const id of chain) {
    const hit = byMessageId?.get?.(id);
    if (hit) return { threadId: hit, how: "references" };
  }
  const at = message?.sentAt ? new Date(message.sentAt).getTime() : Date.now();
  for (const t of bySubject) {
    const last = t?.lastMessageAt ? new Date(t.lastMessageAt).getTime() : null;
    if (last !== null && Math.abs(at - last) <= SUBJECT_MATCH_WINDOW_MS) {
      return { threadId: t.threadId, how: "subject" };
    }
  }
  return { threadId: null, how: null };
}

/**
 * Every address a lead can be reached at, lowercase and deduplicated: the
 * lead's own, the prospect row's, and every SalesContactEmail the rep added on
 * the card. One list, so the sync and the backfill cannot disagree about what
 * "this lead's address" means.
 *
 * The third source is why this exists. A rep who finds the owner's address on
 * the website and adds it on the card, then writes to it, had her sent mail
 * filed under "Everything else" — matchLead read SalesLead.email and
 * prospect.email and nothing else, so the address she had just recorded on
 * the lead was, to the sync, a stranger's. Favor's four emails to Alliance
 * Appliance on 2026-09-18 were exactly that.
 *
 * @param lead { email, prospect: { email }, contactEmails: [{ email }] }
 * @returns string[]
 */
export function leadAddresses(lead) {
  const out = [];
  const add = (v) => {
    const a = String(v || "").trim().toLowerCase();
    if (a && !out.includes(a)) out.push(a);
  };
  add(lead?.email);
  add(lead?.prospect?.email);
  for (const row of Array.isArray(lead?.contactEmails) ? lead.contactEmails : []) add(row?.email);
  return out;
}

/**
 * address → leadId for a rep's leads, with an address two leads share mapped
 * to null: that is a duplicate the review folder handles, not a guess for the
 * sync to make. Built once per sync and read for every message.
 *
 * @returns Map<string, string|null>
 */
export function leadAddressIndex(leads = []) {
  const index = new Map();
  for (const lead of Array.isArray(leads) ? leads : []) {
    if (!lead?.id) continue;
    for (const a of leadAddresses(lead)) {
      index.set(a, index.has(a) && index.get(a) !== lead.id ? null : lead.id);
    }
  }
  return index;
}

/**
 * Which of the rep's leads a counterpart address is — by any address on the
 * lead (leadAddresses). Exactly one, or none.
 *
 * `leads` may be the array or a leadAddressIndex() already built from it.
 *
 * @param counterpart lowercase address
 * @param leads       [{ id, email, prospect: { email }, contactEmails }] or Map
 * @returns leadId | null
 */
export function matchLead(counterpart, leads = []) {
  const a = String(counterpart || "").trim().toLowerCase();
  if (!a) return null;
  const index = leads instanceof Map ? leads : leadAddressIndex(leads);
  return index.get(a) || null;
}
