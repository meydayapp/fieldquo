// lib/jobs/visitStatus.js
//
// What a visit's status can be, and which move is offered from where.
//
// ── Why this is a file and not four strings in a component ─────────────────
//
// `JobVisit.status` is a plain `String @default("scheduled")` — no Prisma enum
// backs it, so the set of legal values lived nowhere except in whichever route
// happened to compare against one. The API acts on "on_the_way" and
// "completed"; the job page styles "scheduled", "in_progress", "completed" and
// "cancelled"; the schedule helper filters "cancelled" and "canceled" because
// it could not be sure which spelling was in the table. Four opinions, no
// source. This is the source.
//
// ── The gap this exists to close ───────────────────────────────────────────
//
// Nothing in the product could set a visit's status. Grep found "on_the_way"
// in exactly one file — the route that reacts to it — and the only client that
// ever PATCHed a visit was the checklist, which sends `checklistItems` and
// nothing else. So:
//
//   - the "on my way" text to the client could never be sent, while
//     /app/settings/messages offered an editor for its wording under a heading
//     saying it is the one message that does send;
//   - `ensureUpcomingVisit` on completion never fired from a human action;
//   - the job page's "0 of 3 complete" counter could never move.
//
// Three features and a counter, all correct in source, all unreachable.
//
// ── "in_progress" is deliberately not offered ──────────────────────────────
//
// The job page styles it, so it is kept in the badge map to render anything
// already in the table. But nothing in the product creates it and no route
// reacts to it, so offering it as a button would add a fourth state that means
// nothing to any code downstream. A crew is either coming or done.

/** The badge styling is elsewhere; this is the wording. */
export const VISIT_STATUS_LABELS = {
  scheduled: "Scheduled",
  on_the_way: "On the way",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
  // Both spellings appear in the schedule filter, so both resolve here rather
  // than falling through to a raw string on someone's screen.
  canceled: "Cancelled",
};

export function visitStatusLabel(status) {
  return VISIT_STATUS_LABELS[status] || "Scheduled";
}

/**
 * The moves offered from a given status.
 *
 * `texts: true` marks the one transition with an outward-facing side effect —
 * the route fires an SMS to the homeowner on the way into `on_the_way`. The
 * button label has to say so, because a crew member tapping a status pill does
 * not expect a stranger's phone to buzz.
 *
 * Reopening a completed visit is allowed and goes back to `scheduled`. The
 * alternative — no way back — means one mis-tap on a phone permanently records
 * work as finished that wasn't, and `ensureUpcomingVisit` is idempotent, so
 * completing twice cannot double-book the next visit.
 */
export function visitActions(status) {
  switch (status) {
    case "on_the_way":
      return [
        { to: "completed", label: "Mark complete", tone: "primary" },
        { to: "cancelled", label: "Cancel visit", tone: "quiet" },
      ];
    case "completed":
      return [{ to: "scheduled", label: "Reopen", tone: "quiet" }];
    case "cancelled":
    case "canceled":
      return [{ to: "scheduled", label: "Put it back on", tone: "quiet" }];
    default:
      // scheduled, in_progress, and anything an older row holds.
      return [
        { to: "on_the_way", label: "On my way", tone: "primary", texts: true },
        { to: "completed", label: "Mark complete", tone: "quiet" },
        { to: "cancelled", label: "Cancel visit", tone: "quiet" },
      ];
  }
}

/**
 * May this caller move this visit?
 *
 * Mirrors app/api/jobs/[id]/visits/[visitId]/route.js exactly — the assignee,
 * anyone at all on an unassigned visit, or a member with schedule:edit_all.
 * Deliberately the same three clauses in the same order rather than a
 * paraphrase, because a UI rule that drifts from its server rule either hides
 * work people may do or offers work they may not.
 *
 * `hasEditAll` is passed in already resolved so this stays pure and testable;
 * the caller does the hasLevel() lookup.
 */
export function mayMoveVisit({ assignedToId, userId, hasEditAll }) {
  if (assignedToId === null || assignedToId === undefined) return true;
  if (userId && assignedToId === userId) return true;
  return !!hasEditAll;
}
