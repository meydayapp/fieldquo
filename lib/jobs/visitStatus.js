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

// ── Keys, not words ────────────────────────────────────────────────────────
//
// This map held English strings, so a visit badge said "On the way" in a
// French office — English in lib/ is English everywhere. It carries
// `[translation key, English fallback]` pairs now, the same shape
// lib/jobs/statusLabels.js uses for a job's status, and the same keys
// lib/appointments/statusLabels.js reads for the SAME visit on the calendar.
// Two screens, one visit, one vocabulary.
//
// Keys are written out in full rather than built from the status value:
// `app.status.${status}` is invisible to check:translations, which cannot see
// a key that only exists at runtime — that is how a missing translation
// reaches a customer.

/** The badge styling is elsewhere; this is the wording. */
export const VISIT_STATUS_LABELS = {
  scheduled: ["app.status.scheduled", "Scheduled"],
  on_the_way: ["app.status.onTheWay", "On the way"],
  in_progress: ["app.status.inProgress", "In progress"],
  completed: ["app.status.completed", "Completed"],
  cancelled: ["app.status.cancelled", "Cancelled"],
  // Both spellings appear in the schedule filter, so both resolve here rather
  // than falling through to a raw string on someone's screen.
  canceled: ["app.status.cancelled", "Cancelled"],
};

/**
 * The human label, given the caller's `t`.
 *
 * ── Two fallbacks, and they are different on purpose ───────────────────────
 *
 * A MISSING status — null, "", a row written before the column existed —
 * really is scheduled: `JobVisit.status` is `String @default("scheduled")`, so
 * absence means the default. Saying "Scheduled" there is the truth, and it is
 * what this function has always done.
 *
 * An UNKNOWN status is not the same thing. This used to return "Scheduled" for
 * it too, which is the invoices bug in miniature: borrowing another status's
 * word states something false about somebody's day, and it made this file
 * disagree with lib/appointments/statusLabels.js, which tidies the raw value
 * for the same row. So an unrecognised value now falls back to the tidied raw
 * text — ugly, and honest, and the same choice jobStatusLabel makes with the
 * same reasoning.
 */
export function visitStatusLabel(status, t) {
  const key = String(status ?? "").trim() || "scheduled";
  const entry = VISIT_STATUS_LABELS[key];
  if (!entry) return key.replace(/_/g, " ");
  return t ? t(entry[0], entry[1]) : entry[1];
}

// ── The badge colour, beside the words ─────────────────────────────────────
//
// "The badge styling is elsewhere" was true and was the problem: elsewhere was
// the job page's own STATUS_STYLES, which held JOB statuses and VISIT statuses
// in one object. Two vocabularies in one map is what
// lib/appointments/statusLabels.js was written about, and it had already cost
// this page a bug — `unscheduled` (a job status) was missing from a map that
// looked complete because it had six keys.
//
// `on_the_way` is purple rather than amber on purpose, and the reason is
// positional: `in_progress` is an amber JOB status and the two chips sit
// inches apart on the job page. Same fact the old map recorded; kept.
export const VISIT_STATUS_TONE = {
  scheduled: "booked",
  on_the_way: "moving",
  in_progress: "active",
  completed: "done",
  cancelled: "off",
  canceled: "off",
};

export const VISIT_TONE_CLASSES = {
  booked:
    "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900",
  moving:
    "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-900",
  active:
    "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900",
  done: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900",
  off: "bg-muted text-muted-foreground border-border",
};

/**
 * The chip classes for a visit status. Never undefined.
 *
 * A missing status really is `scheduled` — `JobVisit.status` is
 * `String @default("scheduled")` — so it resolves the same way visitStatusLabel
 * resolves it, rather than falling to the grey a cancelled visit gets.
 */
export function visitStatusClasses(status) {
  const key = String(status ?? "").trim() || "scheduled";
  return VISIT_TONE_CLASSES[VISIT_STATUS_TONE[key]] || VISIT_TONE_CLASSES.off;
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
