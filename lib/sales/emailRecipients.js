// lib/sales/emailRecipients.js
//
// Who a rep may address from the portal — and the rule that it is a closed
// set, computed from rows, never from the request.
//
// ══ Why the To field is not free text ═════════════════════════════════════
//
// The compose box takes a subject and a body. It does NOT take an arbitrary
// address, for the reason lib/sales/outreachGate.js gives for keeping the
// list of writable tables short: a portal that can email anyone is a portal
// that can be used to email anyone — a prospect off the do-not-contact list
// under a different address, a competitor, the rep's own Gmail with a
// customer list attached. Every address a message may go to is one already
// on the lead's record: the lead's own address, the prospect row's, anyone
// who wrote in on the thread, anyone they copied, and the rep's own work
// mailbox (forwarding a thread to yourself is the one legitimate reason to
// send outside the conversation). The browser picks from that set; the send
// route recomputes the set from the database and refuses anything else.
//
// The check script (scripts/check-sales-email.mjs) runs allowedRecipients
// against a thread with a forged Cc, an inbound From at a stranger's domain,
// and an empty lead — the stranger who wrote in IS allowed (they joined the
// conversation) and the empty lead allows exactly the rep's own mailbox.

import { bareAddress, isPlausibleEmail } from "./outreach";

/** Split a stored comma-separated address list into bare, lowercase addresses. */
export function splitAddresses(value) {
  return String(value || "")
    .split(/[,;]+/)
    .map((a) => bareAddress(a))
    .filter((a) => a && isPlausibleEmail(a));
}

/** Join addresses for the column, deduplicated and in the order given. */
export function joinAddresses(list) {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(list) ? list : splitAddresses(list)) {
    const a = bareAddress(raw);
    if (!a || !isPlausibleEmail(a) || seen.has(a)) continue;
    seen.add(a);
    out.push(a);
  }
  return out.length ? out.join(", ") : null;
}

/**
 * The closed set of addresses a message on this lead may go to.
 *
 * @param lead      { email, prospect?: { email }, contactEmails?: [{ email }] }
 *                  — the last is SalesContactEmail, an address a rep was
 *                  given and saved on the lead (lib/sales/contact/record.js).
 * @param messages  the thread's messages, any order — [{ direction,
 *                  fromAddress, toAddress, ccAddresses }]
 * @param rep       { workEmail }
 * @returns an Array of [address, { label }] in a stable order: the lead's
 *          own address first, then the prospect's, then the saved extra
 *          addresses, then people who wrote in, then people who were copied,
 *          then the rep. `label` names the source so the picker can say
 *          "wrote in on this thread".
 */
export function allowedRecipients({ lead, messages = [], rep, counterpart = null } = {}) {
  const out = new Map();
  const add = (raw, label) => {
    const a = bareAddress(raw);
    if (!a || !isPlausibleEmail(a) || out.has(a)) return;
    out.set(a, { label });
  };
  add(lead?.email, "lead");
  add(lead?.prospect?.email, "prospect");
  for (const row of Array.isArray(lead?.contactEmails) ? lead.contactEmails : []) add(row?.email, "contact");
  // A synced thread with nobody's lead: the person it is with.
  add(counterpart, "counterpart");
  for (const m of messages) {
    if (m?.direction === "in") add(m.fromAddress, "wroteIn");
  }
  for (const m of messages) {
    for (const a of splitAddresses(m?.ccAddresses)) add(a, "copied");
    // Somebody an earlier outbound went to — a forward's recipient, say.
    if (m?.direction === "out") add(m.toAddress, "sentTo");
  }
  add(rep?.workEmail, "self");
  // The rep's own mailbox is never a "To" for a reply — a reply that goes only
  // to yourself is not a reply — but it is allowed as a forward target and a
  // Cc, and the check below is a set membership, not a role.
  return [...out.entries()].map(([address, meta]) => [address, meta]);
}

/**
 * Validate the addresses a rep chose against the closed set.
 *
 * @returns { ok: true, to: [..], cc: [..] } | { ok: false, refused: [..] }
 *          `to` non-empty on success. Duplicates and Cc-that-is-also-To are
 *          folded; an address the set does not hold is refused BY NAME so
 *          the rep sees which one, not "invalid recipients".
 */
export function chooseRecipients({ to, cc = [], allowed }) {
  const set = new Set((allowed || []).map(([a]) => a));
  const refused = [];
  const pick = (list) => {
    const chosen = [];
    for (const raw of Array.isArray(list) ? list : splitAddresses(list)) {
      const a = bareAddress(raw);
      if (!a) continue;
      if (!set.has(a)) refused.push(a);
      else if (!chosen.includes(a)) chosen.push(a);
    }
    return chosen;
  };
  const toList = pick(to);
  const ccList = pick(cc).filter((a) => !toList.includes(a));
  if (refused.length) return { ok: false, refused };
  if (!toList.length) return { ok: false, refused: [], empty: true };
  return { ok: true, to: toList, cc: ccList };
}

/**
 * The recipients a reply-all to `message` would address, before the rep
 * edits them: the sender (or, for our own outbound, its To) plus every Cc,
 * minus the rep's own mailbox. Filtered to the allowed set by the caller.
 */
export function replyAllTargets({ message, rep }) {
  const self = bareAddress(rep?.workEmail);
  const to = message?.direction === "in" ? [bareAddress(message.fromAddress)] : splitAddresses(message?.toAddress);
  const cc = splitAddresses(message?.ccAddresses);
  const seen = new Set();
  const keep = (a) => a && a !== self && !seen.has(a) && seen.add(a);
  return { to: to.filter(keep), cc: cc.filter(keep) };
}
