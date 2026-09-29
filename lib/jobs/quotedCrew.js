// lib/jobs/quotedCrew.js
//
// Who the quote said would do the job — carried onto the job raised from it.
//
// ── The gap ─────────────────────────────────────────────────────────────────
//
// An estimator assigns a crew on the quote's cost panel (the builder, or the
// quote page's "Assign" on an instant estimate), and that crew is what the
// labour was costed at. When the client approved, ensureJobForAcceptedQuote
// raised a job with a title, a client and an address — and not a word about
// who was quoted to do it. The office then scheduled the first visit with
// "Not assigned yet" and re-picked people from memory, on EVERY quote, hand-
// built or instant.
//
// ── Why it is read from the quote, not copied onto the job ──────────────────
//
// A job has no crew column: who goes is a per-VISIT fact (JobVisit.
// assignedToId), and a job waiting for a date has no visit yet. Copying the
// names into a new Job column would be a second record of the same decision,
// and the job already reads its estimate off the quote's QuoteCosting by
// reference (quotedCostFor in lib/costing/quoteCostEstimate.js) — the crew
// rides the same link. So GET /api/jobs/[id] returns `quotedCrew`, the job
// page names them, and the first visit's form opens on the first of them who
// can sign in.
//
// Names and ids only. The costing row also holds each person's pay rate and
// cost, and the job page is read by the crew themselves — payroll data does
// not leave with the names.
//
// Pure: the route does the one tenant-scoped worker read and hands it in.

/**
 * @param {Array} costingCrew  QuoteCosting.crew as stored — [{ id, name, … }]
 * @param {Array} workers      this company's Worker rows for those ids —
 *                             [{ id, name, userId }]; anything not in here is
 *                             another tenant's id or a deleted worker, and
 *                             keeps its stored name with no identity
 * @returns {Array<{ workerId: string|null, name: string, userId: string|null }>}
 */
export function quotedCrewFrom(costingCrew, workers) {
  const byId = new Map(
    (Array.isArray(workers) ? workers : [])
      .filter((w) => w && typeof w.id === "string")
      .map((w) => [w.id, w]),
  );
  const seen = new Set();
  const out = [];
  for (const m of Array.isArray(costingCrew) ? costingCrew : []) {
    if (!m || typeof m !== "object") continue;
    const worker = typeof m.id === "string" ? byId.get(m.id) : null;
    const name = String(worker?.name || m.name || "").trim().slice(0, 120);
    // A row with neither a worker behind it nor a name is an empty line
    // somebody added and never filled — not a person.
    if (!worker && !name) continue;
    const key = worker ? `w:${worker.id}` : `n:${name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      workerId: worker ? worker.id : null,
      name,
      userId: worker && typeof worker.userId === "string" ? worker.userId : null,
    });
  }
  return out;
}

/** The worker ids a stored crew names — what the route looks up. */
export function quotedCrewWorkerIds(costingCrew) {
  return [
    ...new Set(
      (Array.isArray(costingCrew) ? costingCrew : [])
        .map((m) => (m && typeof m.id === "string" ? m.id : null))
        .filter(Boolean),
    ),
  ];
}
