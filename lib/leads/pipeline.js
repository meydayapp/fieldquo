// lib/leads/pipeline.js
//
// The board's four columns, and the one rule that governs moving a card into
// the last of them — shared by both PATCH routes and the client board so the
// rule cannot drift into three different answers to "can this lead become
// Won".
//
// ── Why "converted" needs a rule at all ─────────────────────────────────────
//
// lib/leads/convertLead.js's own header says drafting a quote is not winning
// the work, and deliberately does NOT set status "converted" when a quote is
// created. lib/quotes/quoteLifecycle.js agrees from the other side: the ONLY
// writer of "converted" is `onQuoteAccepted`, because "converted" IS "Won" —
// there is no separate `won` value — and a lead is only won once a client has
// actually said yes to a priced quote.
//
// Both PATCH routes below skipped that distinction entirely: `{ status:
// "converted" }` was accepted on a lead that had never been converted to a
// quote at all, enum and all. That was reachable two ways before this file
// existed — the drawer's own status buttons, unconditionally, and (the reason
// this file exists) a drag-to-move board, which turns the same gap into
// something far easier to trigger by accident. A card slid one column too far
// would mark a lead Won with nothing behind it: a false "we got this job" that
// nobody would think to double check, sitting in a win-rate number, forever.
//
// The fix is not "creates the quote for you" — that would silently start a
// side effect (a real database row) from a slide gesture nobody explicitly
// asked for, and it still wouldn't make the lead WON, only quoted. The fix is
// refusing the direct jump and saying why, on both the button and the drag
// path, so whoever is moving the card is told what the real next step is:
// open the lead and convert it.
//
// ── The rule is "a quote exists", NOT "a quote was accepted" ────────────────
//
// Worth stating, because the paragraph above reads like the stricter rule and
// the code is deliberately the looser one. Once a quote exists, a human may
// still move the card to Won by hand — a client says yes on the phone, or in a
// driveway, and the contractor records it. `onQuoteAccepted` is how it happens
// on its own when the client signs; it is not the only way it is allowed to
// happen. What is refused is inventing a win with nothing priced behind it,
// which is the accident a drag board makes easy and which no amount of
// staff judgement can undo later, because a false win sits in the win-rate
// number forever.
export const LEAD_STATUSES = ["new", "contacted", "converted", "lost"];

export function isValidLeadStatus(status) {
  return LEAD_STATUSES.includes(status);
}

// ── Why "lost" needs a rule too (docs/META-ADS-INTEGRATION.md Part 2b) ─────
//
// Before this, "lost" was one bucket — a real lead that shopped around and
// picked a competitor and a wrong-number butt-dial landed in the exact same
// status, with nothing distinguishing them except whatever a staff member
// happened to type into a LeadNote, if anything. That made every "junk lead"
// question downstream (blended cost-per-lead's denominator among them) a
// guess dressed as data.
//
// The fix considered and REJECTED: filter at ingestion — guess which leads
// are junk when they arrive and quietly exclude them from counts. Rejected
// because a scoring model tuned for "which lead to call first"
// (lib/leads/score.js) is not the same claim as "which lead is not real",
// and a slow-to-respond but genuine prospect would be silently dropped from
// every count with no way for the contractor to know it happened. A count
// that's a little inflated is a smaller failure than one that quietly loses
// real leads.
//
// The fix built instead: a closed vocabulary a HUMAN picks when they move a
// card to Lost — "not a real inquiry" becomes something a person recorded,
// not a machine's guess, and it's one click from being reopened if they
// change their mind. Same shape as canSetLeadStatus's "converted" rule
// above: a real fact has to exist before the status can claim it.
export const LOST_REASONS = [
  "lost_to_competitor",
  "price_too_high",
  "timing_not_right",
  "not_real_inquiry",
  "no_response",
  "other",
];

export function isValidLostReason(reason) {
  return LOST_REASONS.includes(reason);
}

/**
 * Would setting `status` on this lead reflect a real change, or invent one?
 *
 * @param {{ quoteId?: string|null, quote?: object|null, lostReason?: string|null }} lead
 *   needs one of quoteId (the raw column, what both PATCH routes have on
 *   hand) or `quote` (the nested include the client's board renders) —
 *   either is proof a quote exists. `lostReason` is the lead's EXISTING
 *   value, read when the caller doesn't pass a new one (e.g. re-dragging an
 *   already-lost card).
 * @param {string} status
 * @param {{ lostReason?: string }} [opts]  the reason being set IN THIS
 *   REQUEST, if any — takes priority over the lead's existing value.
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function canSetLeadStatus(lead, status, { lostReason } = {}) {
  if (!isValidLeadStatus(status)) {
    return { ok: false, reason: "Invalid status" };
  }
  if (status === "converted" && !lead?.quoteId && !lead?.quote) {
    return {
      ok: false,
      reason:
        "This lead has no quote yet. Convert it to a quote first — Won follows the quote's own outcome once the client answers.",
    };
  }
  if (status === "lost") {
    const effective = lostReason !== undefined ? lostReason : lead?.lostReason;
    if (!isValidLostReason(effective)) {
      return {
        ok: false,
        reason:
          "Pick why this lead is lost — that's what tells a real inquiry from a wrong number in your numbers later.",
      };
    }
  }
  return { ok: true };
}
