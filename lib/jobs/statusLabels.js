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
