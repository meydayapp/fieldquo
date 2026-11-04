// lib/dashboard/requests.js
//
// Which enquiries belong on the dashboard's Requests list.
//
// ── Why this is a module and not two lines in workPanel.js ────────────────
//
// Because exactly one thing in the product is allowed to know about
// dismissal, and this is it.
//
// `LeadRequest.dismissedAt` means "not on my dashboard list". It is triage —
// a person clearing a row they have dealt with in a way FieldQuo cannot see.
// It is emphatically NOT a verdict on the lead, and the schema comment on the
// column spells out, with the live numbers, why it is not `status: "lost"`.
//
// The boundaries, each of which would be a real defect to cross:
//
//   · it does NOT stop the follow-up chase. That is `reachedAt`'s job.
//     A lead dismissed from a list is not a lead somebody spoke to, and
//     lib/followUps/stopConditions.js has no notion of dismissal at all —
//     scripts/check-dashboard-requests.mjs asserts it cannot grow one.
//   · it does NOT feed the funnel, the agency metrics or any conversion
//     figure. The moment a triage action reaches a report it has become a
//     shadow `lost`, with none of the evidence a real `lost` carries.
//   · the Leads board still shows the lead, with the dismissal visible and
//     undoable there. Dismissing is not hiding.
//
// And it is the FALLBACK, not the mechanism. The list drops a row whose person
// already has a quote, an appointment or a job — by contact match, which is
// what the old `quoteId: null` guard could not do. This button is for what
// that rule cannot see. If the rule is working the button is rarely needed.
//
// Pure, and deliberately so: the dashboard's work panel is reached from a
// client component, so everything this file imports a browser downloads.
// lib/followUps/stopConditions.js is pure for the same reason.

import { leadChaseBlocker, leadStillNeedsChasing } from "@/lib/followUps/stopConditions";

/** This module's own reason, which is not one of leadChaseBlocker's. */
export const DISMISSED_REASON = "dismissed";

/**
 * Should this enquiry appear on the dashboard's Requests list?
 *
 * @param lead   needs status, createdAt, quoteId, dismissedAt, reachedAt
 * @param facts  the same facts the cron gathers
 *               (lib/followUps/leadChaseFacts.js) — appointment, quote, job,
 *               reply. Absent facts mean "nothing is known", which SHOWS the
 *               row: a failed lookup must not silently empty the list, which
 *               would read as "no work waiting" and be the worst possible
 *               wrong answer on this panel.
 */
export function requestNeedsAction({ lead, facts = {}, now = new Date() } = {}) {
  if (!lead) return false;
  // The one line that is this module's whole reason for existing.
  if (lead.dismissedAt) return false;
  return leadStillNeedsChasing({ lead, facts, now });
}

/**
 * Why a row is NOT on the list, for a screen that would rather explain itself
 * than quietly show fewer rows than it used to.
 *
 * `null` means it IS on the list. "dismissed" is this module's own; every
 * other reason is leadChaseBlocker's own word, so the dashboard and the cron
 * give the same account of the same lead.
 */
export function requestHiddenReason({ lead, facts = {}, now = new Date() } = {}) {
  if (!lead) return "answered";
  if (lead.dismissedAt) return DISMISSED_REASON;
  return leadChaseBlocker({ lead, rule: null, facts, now });
}
