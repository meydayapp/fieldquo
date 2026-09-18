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
 * Which of the rep's leads a counterpart address is — by the lead's own
 * address first, then the prospect row's. Exactly one, or none: two leads at
 * one address is a duplicate the review folder handles, not a guess for
 * the sync to make.
 *
 * @param counterpart lowercase address
 * @param leads       [{ id, email, prospect: { email } }] — the rep's own
 * @returns leadId | null
 */
export function matchLead(counterpart, leads = []) {
  const a = String(counterpart || "").trim().toLowerCase();
  if (!a) return null;
  const direct = leads.filter((l) => String(l?.email || "").trim().toLowerCase() === a);
  if (direct.length === 1) return direct[0].id;
  if (direct.length > 1) return null;
  const viaProspect = leads.filter((l) => String(l?.prospect?.email || "").trim().toLowerCase() === a);
  return viaProspect.length === 1 ? viaProspect[0].id : null;
}
