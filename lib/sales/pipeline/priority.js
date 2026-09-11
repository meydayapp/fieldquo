// lib/sales/pipeline/priority.js
//
// Two lanes in one queue: a rep's claimed prospect, and everybody else.
//
// ══ The problem this solves ════════════════════════════════════════════════
//
// The runner drains one FIFO — `orderBy: [{ notBefore: "asc" }, { createdAt:
// "asc" }]` — and every task is queued with `notBefore` defaulting to now().
// So a crawl queued for a business a rep just claimed sorts behind every crawl
// the backlog queued before it, and with five thousand of those pending the
// rep dials before the pipeline has read the website. That is the queue that
// handed out "Richmond Rolloff Container Service" with nothing observed about
// it: hasWebsite true, websiteUrl set, lastCrawledAt null.
//
// ══ Why a notBefore in the past, and not a priority column ═════════════════
//
// The runner already orders by `notBefore`. A task whose notBefore is fixed at
// a moment before any backlog row was created sorts ahead of all of them, and
// among themselves the claimed tasks keep createdAt order. That is the whole
// mechanism — no schema change, no second orderBy, no branch in the runner —
// and it survives every existing guard: `claimTask` re-checks `notBefore <=
// now`, which a date in 2000 trivially satisfies.
//
// The one place the lane is lost, and it is stated rather than hidden: a
// retry. `failTask` writes `notBefore = now + backoff`, which is later than
// every backlog row created before that moment, so a claimed task that fails
// once waits its backoff AND then takes its turn among the rows created since.
// A priority column would keep the lane through a retry. It was not added
// because the retry case is the unlucky one — a timeout — and the rep is
// better served by every other stage arriving first than by a column.
//
// ══ Why the lane rides in the payload ══════════════════════════════════════
//
// Each stage queues its successor (chain.js), and the successor must inherit
// the lane or the priority is one stage deep. `payload` is the only column a
// task carries forward, so the lane is a key in it, and `inheritedPayload`
// below is the ONE list of keys that travel. It is a list rather than a
// spread because the brief stage writes its own output into `payload.brief`
// (see generateResearchBrief.js) and a spread would copy a cached brief onto
// every downstream task.

/** The lanes. `claimed` is a rep waiting; `backlog` is nobody waiting. */
export const RESEARCH_PRIORITIES = Object.freeze(["claimed", "backlog"]);

/**
 * The notBefore that puts a task ahead of the backlog.
 *
 * Fixed, not `now - 1 year`: two claimed tasks must sort by createdAt between
 * themselves, and a moving value would sort them by the moment each was
 * promoted instead. Before the first row this table ever held, so nothing
 * created "normally" can be ahead of it.
 */
export const CLAIMED_NOT_BEFORE = new Date("2000-01-01T00:00:00.000Z");

/** The lane a task is in, or null when it was queued with none. */
export function taskPriority(task) {
  const p = task?.payload?.priority;
  return typeof p === "string" && RESEARCH_PRIORITIES.includes(p) ? p : null;
}

/** notBefore for a lane. Null means "the column's default", which is now(). */
export function notBeforeFor(priority) {
  return priority === "claimed" ? CLAIMED_NOT_BEFORE : null;
}

/**
 * The payload keys a successor inherits from the task that queued it.
 *
 *   priority — the lane. See the header.
 *   phrase   — `false` on the backlog lane, so GENERATE_RESEARCH_BRIEF composes
 *              the card from rows and calls no model. The backlog is free by
 *              construction; a claimed prospect's brief is phrased.
 *
 * Nothing else. Not `brief`, not `provider`, not `force` — each of those is
 * about the task that carries it, not about the prospect's research as a
 * whole.
 */
export function inheritedPayload(task) {
  const out = {};
  const priority = taskPriority(task);
  if (priority) out.priority = priority;
  if (task?.payload?.phrase === false) out.phrase = false;
  return out;
}
