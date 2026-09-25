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
// ── The rule is "the quote WON", not "a quote exists" (2026-09-25) ─────────
//
// This used to be the looser rule — any linked quote, even a $0 draft, let a
// human move the card to Won — on the reasoning that a client says yes on the
// phone and the contractor records it. Two things were wrong with that:
//
//   1. convertLead.js creates a $0 DRAFT the moment someone taps "Create
//      quote". "A quote exists" was therefore one tap from "no work at all",
//      which is exactly the false win this file was written to refuse.
//   2. The phone-yes path already has a real home: recording the approval on
//      the quote (PATCH /api/quotes/[id] { status: "accepted" } — the "They
//      approved" screen). That runs onQuoteAccepted, which creates the job
//      and the draft invoice AND moves this lead to Won through
//      syncLeadForQuoteStatus. A Won set by hand on the lead instead left a
//      "Won" card whose quote still said "Sent" and had no job to schedule —
//      a win the rest of the product did not know about.
//
// So Won (`converted`) needs EVIDENCE on the linked quote, one of:
//
//   * the quote is accepted (approved), or
//   * work exists on it: a job that is neither cancelled nor archived, or an
//     invoice — the office already started the work, whatever the quote's
//     status column says.
//
// And refuses, each with its own code and sentence (wonCheck below):
//
//   no_quote            nothing linked. The owner's report (2026-09-24): a
//                       lead moved from Won back to Contacted could not
//                       return, because the win lived on a quote that was
//                       never LINKED to the lead. The status control now
//                       offers "Link the quote that won it" (POST
//                       /api/leads/[id]/quote-link) instead of a dead end.
//   quote_declined      the linked quote is declined. A declined quote is
//                       evidence of the OPPOSITE of a win, and a hand-set
//                       status does not overrule it.
//   quote_not_approved  a draft or sent quote with no work on it. The answer
//                       is to record the approval on the quote, which moves
//                       the lead on its own.
//   quote_unverified    the caller passed a quoteId but not the quote's
//                       evidence — the rule cannot tell, so it refuses rather
//                       than guess. Every route loads LEAD_QUOTE_EVIDENCE_SELECT,
//                       so this is a programming error, never a user state.
//
// Moving BACK to Won — the owner's exact case — is the same rule: a lead won
// through an approved quote and dragged to Contacted by mistake goes straight
// back, because the evidence is still there. Leads already sitting in Won are
// untouched; the rule is asked only when something tries to SET Won.
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

// ── What the rule reads off the linked quote ──────────────────────────────
//
// One Prisma select fragment, used as the `quote` select of every query that
// feeds canSetLeadStatus (both PATCH routes, the board's GET, the drawer's
// GET, the link route), so no caller can hand the rule a quote without the
// fields it decides on. `_count` with a `where` counts only work that is
// still real: a cancelled or archived job is not evidence of a win.
export const LEAD_QUOTE_EVIDENCE_SELECT = {
  id: true,
  quoteNumber: true,
  status: true,
  _count: {
    select: {
      jobs: { where: { status: { not: "cancelled" }, archivedAt: null } },
      invoices: true,
    },
  },
};

/**
 * The linked quote as the browser gets it: `_count` folded into one boolean,
 * which is all the rule needs, so the board and the routes read one shape.
 * Idempotent (a quote already carrying `hasWork` keeps it) and null-safe.
 */
export function quoteEvidence(quote) {
  if (!quote || typeof quote !== "object" || !quote.id) return null;
  const { _count, ...rest } = quote;
  const hasWork =
    quote.hasWork === true ||
    Boolean(
      _count &&
        typeof _count === "object" &&
        ((Number(_count.jobs) || 0) > 0 || (Number(_count.invoices) || 0) > 0),
    );
  return { ...rest, hasWork };
}

// English fallbacks. The board translates by `code` (app.leads.won.<code>);
// these are what an API refusal carries, for a caller with no catalogue.
const WON_REASONS = {
  no_quote:
    "No quote is linked to this lead. Link the quote that won it, or create one from this lead — Won needs an approved quote or a job behind it.",
  quote_declined:
    "Quote {number} was declined, so it can't make this lead Won. If the client approved a different quote, link that one instead.",
  quote_not_approved:
    "Quote {number} hasn't been approved yet. Record the client's approval on the quote — the lead moves to Won on its own — or link the quote that won it.",
  quote_unverified:
    "Couldn't confirm the linked quote's outcome. Reopen the lead and try again.",
};

/**
 * Is there a real win behind this lead? The whole of the Won rule — see the
 * header for why each branch exists.
 *
 * @param {{ quote?: object|null, quoteId?: string|null }} lead
 *   `quote` in LEAD_QUOTE_EVIDENCE_SELECT's shape or quoteEvidence()'s.
 * @returns {{ ok: true, basis: "accepted"|"work" }
 *          | { ok: false, code: string, reason: string, quoteNumber: string|null }}
 */
export function wonCheck(lead) {
  const quote = quoteEvidence(lead?.quote);
  const refuse = (code) => ({
    ok: false,
    code,
    quoteNumber: quote?.quoteNumber || null,
    reason: WON_REASONS[code].replace("{number}", quote?.quoteNumber || ""),
  });
  if (!quote) {
    // A bare quoteId with no quote object is a caller that skipped the
    // evidence select, not a lead with nothing linked. "No quote is linked"
    // would be false there, and allowing it would be a guess.
    return refuse(lead?.quoteId ? "quote_unverified" : "no_quote");
  }
  if (quote.status === "declined") return refuse("quote_declined");
  if (quote.status === "accepted") return { ok: true, basis: "accepted" };
  if (quote.hasWork) return { ok: true, basis: "work" };
  return refuse("quote_not_approved");
}

/**
 * Would setting `status` on this lead reflect a real change, or invent one?
 *
 * @param {{ quote?: object|null, quoteId?: string|null, lostReason?: string|null }} lead
 *   `quote` carries the evidence wonCheck reads — LEAD_QUOTE_EVIDENCE_SELECT
 *   on the server, quoteEvidence()'s shape on the board. `lostReason` is the
 *   lead's EXISTING value, read when the caller doesn't pass a new one (e.g.
 *   re-dragging an already-lost card).
 * @param {string} status
 * @param {{ lostReason?: string }} [opts]  the reason being set IN THIS
 *   REQUEST, if any — takes priority over the lead's existing value.
 * @returns {{ ok: true } | { ok: false, reason: string, code?: string }}
 */
export function canSetLeadStatus(lead, status, { lostReason } = {}) {
  if (!isValidLeadStatus(status)) {
    return { ok: false, reason: "Invalid status" };
  }
  if (status === "converted") {
    const won = wonCheck(lead);
    if (!won.ok) return won;
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
