// lib/shiftRequests/eligibility.js
//
// Who may take a shift somebody is giving away. Pure.
//
// ── Same title first, then everyone ─────────────────────────────────────────
//
// An open cover on a foreman's shift goes to the other foremen; if the
// company has none, to everyone active. Worker.title is free text typed by
// the company ("Foreman", "foreman", "Lead installer"), so the match is
// case- and whitespace-insensitive and nothing more clever — a title is a
// word the company chose, not a taxonomy.
//
// An OPEN shift (workerId null) has no title to match — it is hours to be
// covered, and its `label` is a caption for the board, not a gate. Everyone
// active may claim it; the manager decides.

const norm = (v) => String(v || "").trim().toLowerCase();

/** Active workers other than `fromWorker` who share their title, else all. */
export function coverAudience(fromWorker, workers) {
  const list = (Array.isArray(workers) ? workers : []).filter(
    (w) => w && w.active !== false && w.id && w.id !== fromWorker?.id,
  );
  const title = norm(fromWorker?.title);
  if (!title) return list;
  const same = list.filter((w) => norm(w.title) === title);
  return same.length ? same : list;
}

/** May this worker accept this request? */
export function mayAccept(request, worker, workers) {
  if (!request || !worker || worker.active === false) return false;
  if (request.fromWorkerId && request.fromWorkerId === worker.id) return false;
  if (request.toWorkerId) return request.toWorkerId === worker.id;
  const from = (workers || []).find((w) => w.id === request.fromWorkerId) || null;
  return coverAudience(from, workers).some((w) => w.id === worker.id);
}

/** May this worker claim this open shift? One rule, one home. */
export function openShiftEligible(shift, worker) {
  if (!shift || shift.workerId) return false;
  if (!worker || worker.active === false) return false;
  return true;
}

/**
 * The colleagues a worker may name on a trade: anyone active with a login
 * (a person with no login cannot accept), excluding themselves.
 */
export function tradePartners(worker, workers) {
  return (Array.isArray(workers) ? workers : []).filter(
    (w) => w && w.active !== false && w.id !== worker?.id && w.userId,
  );
}
