// lib/sales/calls/providerStatus.js
//
// What one Twilio call-progress event says about when the far end picked up.
// Pure, so scripts/check-sales-recording.mjs can run every event shape
// through it; app/api/rep-dial/status is the only caller.

/** Twilio's statuses that mean somebody answered. */
export const ANSWERED_STATUSES = new Set(["completed", "in-progress"]);

/**
 * When the far end picked up, from what this event carries — or null when
 * the event is not an answer.
 *
 * `in-progress` (Twilio's "answered" event) is stamped at the pickup, so its
 * Timestamp is the answer. `completed` is stamped at the HANG-UP, and the
 * first version of the status route wrote that as `answeredAt` too: every
 * row from the first day of browser dialling has answeredAt equal to endedAt,
 * and a ring-to-answer figure read from them is zero. The completed event
 * does carry the answer, though — its CallDuration is the connected seconds,
 * so the pickup is the end minus the duration, to the second. Still written
 * on `completed`, not only on `in-progress`, so an answered event that never
 * arrived (the slow path the route's header describes) leaves the fact
 * present rather than absent.
 *
 * A completed call of zero seconds is stamped at its end: it connected and
 * lasted no time, and there is nothing to subtract.
 *
 * @param {{ status: string|null, at: Date|null, seconds: number }} event
 */
export function answeredAtFrom({ status, at, seconds } = {}) {
  if (!status || !ANSWERED_STATUSES.has(status) || !(at instanceof Date)) return null;
  if (status === "completed" && Number.isFinite(seconds) && seconds > 0) {
    return new Date(at.getTime() - seconds * 1000);
  }
  return at;
}
