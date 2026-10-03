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

  // Folded in tap order rather than read off the last punch, because an
  // activity tile's meaning depends on what was running when it was tapped:
  // Lunch adds a break to the entry before it, and tapping the same work
  // tile again ends that break rather than starting anything. For the
  // in / out / switch punches the fold lands exactly where "the last one
  // wins" did — each of them replaces the state outright.
  let open = serverOpen || null;
  let pending = false;
  for (const { payload: p } of punches) {
    if (p.action === "out") {
      open = null;
      pending = true;
    } else if (p.action === "in" || p.action === "switch") {
      open = queuedEntry(p);
      pending = true;
    } else if (p.action === "activity" && BREAK_KINDS.has(p.activity)) {
      // A break is taken FROM the clock; with nothing open the server will
      // refuse it, so it changes nothing shown here either.
      if (!open) continue;
      open = { ...open, breaks: [...endRunning(open.breaks, p.at), { start: p.at, end: null, kind: p.activity }] };
      pending = true;
    } else if (p.action === "activity") {
      const running = (open?.breaks || []).find((b) => b && b.end == null);
      open = open && running && sameWork(open, p) ? { ...open, breaks: endRunning(open.breaks, p.at) } : queuedEntry(p);
      pending = true;
    }
    // A queued legacy break_start / break_end — not something the clock
    // queues — leaves the state as it was.
  }
  return { open, pending };
}

const BREAK_KINDS = new Set(["break", "lunch"]);

function queuedEntry(p) {
  return {
    id: null,
    queued: true,
    clockIn: p.at,
    jobId: p.jobId || null,
    job: p.jobTitle ? { id: p.jobId, title: p.jobTitle } : null,
    ...(p.action === "activity" ? { activity: p.activity, taskId: p.taskId || null, paid: p.paid !== false } : {}),
    breaks: [],
  };
}

function endRunning(breaks, at) {
  return (Array.isArray(breaks) ? breaks : []).map((b) => (b && b.end == null ? { ...b, end: at } : b));
}

// The same "is this the thing already running?" the route asks
// (lib/timeclock/activities.js effectiveActivity), restated for a queued
// entry that may carry no activity at all.
function sameWork(open, p) {
  const current = open.activity || (open.jobId ? "visit" : "general");
  return current === p.activity && (open.jobId || null) === (p.jobId || null) && (open.taskId || null) === (p.taskId || null);
}
