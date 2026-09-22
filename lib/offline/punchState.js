// lib/offline/punchState.js
//
// What the time clock shows while a punch is still on the phone.
//
// The server's answer to GET /api/time-clock is the truth when there is
// signal. Without it, the answer comes from the worker's cache — the state
// as of the last load — and the person may have tapped Clock in since. The
// last queued punch wins over that: an "in" (or a "switch") means on the
// clock since the moment it was tapped; an "out" means off it. Pure, so the
// check can run it against an empty queue, a synced queue, a failed punch
// and an out-of-order pair.

/**
 * @param {Array} items   the offline queue (lib/offline/queue.js items)
 * @param {object|null} serverOpen   data.open from the (possibly cached) route
 * @returns {{ open: object|null, pending: boolean }}
 *   `pending` is true when the shown state comes from a queued punch.
 */
export function queuedPunchState(items, serverOpen) {
  const punches = (Array.isArray(items) ? items : [])
    .filter((it) => it && it.kind === "timesheet" && it.status === "queued" && it.payload)
    .sort((a, b) => a.createdAt - b.createdAt);
  if (!punches.length) return { open: serverOpen || null, pending: false };
  const last = punches[punches.length - 1].payload;
  if (last.action === "out") return { open: null, pending: true };
  if (last.action === "in" || last.action === "switch") {
    return {
      open: {
        id: null,
        queued: true,
        clockIn: last.at,
        jobId: last.jobId || null,
        job: last.jobTitle ? { id: last.jobId, title: last.jobTitle } : null,
        breaks: [],
      },
      pending: true,
    };
  }
  // A queued break — not something this page queues, but the shape is open.
  return { open: serverOpen || null, pending: false };
}
