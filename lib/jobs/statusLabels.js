// lib/jobs/statusLabels.js
//
// What a job's status is CALLED, in the one place both screens read it from.
//
// The Jobs list said "Needs a date". The job detail badge and its status
// dropdown said "unscheduled" — the raw enum value with the underscores
// swapped for spaces. Same job, same screen session, two different words, and
// only one of them was written for a contractor to read.
//
// The list had a proper label map and the detail page had `replace(/_/g, " ")`,
// which is the shape this always takes: one screen gets the considered version
// and the other gets whatever the database happens to say.

/** status -> [translation key, English fallback] */
export const JOB_STATUS_LABEL_KEYS = {
  unscheduled: ["app.status.unscheduled", "Needs a date"],
  scheduled: ["app.status.scheduled", "Scheduled"],
  in_progress: ["app.status.inProgress", "In progress"],
  completed: ["app.status.completed", "Completed"],
  cancelled: ["app.status.cancelled", "Cancelled"],
};

/** Every status a job may be set to, in the order a job moves through them. */
export const JOB_STATUSES = Object.keys(JOB_STATUS_LABEL_KEYS);

// ── The colour, moved here for the same reason the words were ──────────────
//
// The words were centralised and the COLOURS were left behind, in three
// separate objects that had already drifted:
//
//   app/app/jobs/page.js          5 keys — unscheduled purple, "needs a date"
//   app/app/jobs/[id]/JobDetail   no `unscheduled` key at all, and visit
//                                 statuses mixed into the same map
//   app/app/clients/[id]/page.js  no map — `{j.status}` in plain grey
//
// So the same job read as an attention-purple chip on the list, a grey chip
// indistinguishable from Cancelled on its own page, and the raw word
// "in_progress" on the client it belongs to. Grey is the wrong statement: a
// job fresh off an accepted quote is the one thing on the screen somebody has
// to act on, and Cancelled is the one thing they never have to look at again.
//
// `tone` names what the badge MEANS, never a colour — same rule as
// lib/invoices/statusPresentation.js and lib/appointments/statusLabels.js.
// Deliberately NOT merged with either of those: an invoice's "urgent" is money
// the contractor chases today, and this file's "attention" is a job with no
// date. One shared tone vocabulary across all three would force those two to
// be the same colour.
//
// Keyed by every value of `enum JobStatus`, and ONLY those: a visit's status
// is a different vocabulary and lives in lib/jobs/visitStatus.js. Merging them
// into one object is exactly what the job page had done, and it is how
// `unscheduled` went missing — a six-key map covering two enums looks
// exhaustive without being exhaustive over either.
export const JOB_STATUS_TONE = {
  unscheduled: "attention",
  scheduled: "booked",
  in_progress: "active",
  completed: "done",
  cancelled: "off",
};

/**
 * The chip classes per tone.
 *
 * Every pairing carries its `dark:` half — a `bg-*-50` with no dark
 * counterpart is a bright slab in a dark-mode van. The border-colour half is
 * inert on a badge that doesn't also set `border`, which is why the list and
 * the detail page can share one string.
 */
export const JOB_TONE_CLASSES = {
  attention:
    "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-900",
  booked:
    "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900",
  active:
    "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900",
  done: "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-900",
  off: "bg-muted text-muted-foreground border-border",
};

/**
 * The chip classes for a job status. Never undefined, never a half-built
 * string — an unknown status dropped into a template literal renders the
 * literal word `undefined` in the class list, which is how the invoices list
 * shipped a chargeback badge with no background at all.
 */
export function jobStatusClasses(status) {
  return JOB_TONE_CLASSES[JOB_STATUS_TONE[status]] || JOB_TONE_CLASSES.off;
}

/**
 * The human label, given the caller's `t`.
 *
 * An unknown status falls back to the tidied raw value rather than an empty
 * string — a badge reading "on_hold" is ugly, and a blank badge is a bug
 * report. Neither should happen; one of them is recoverable.
 */
export function jobStatusLabel(status, t) {
  const entry = JOB_STATUS_LABEL_KEYS[status];
  if (!entry) return String(status || "").replace(/_/g, " ");
  return t ? t(entry[0], entry[1]) : entry[1];
}
