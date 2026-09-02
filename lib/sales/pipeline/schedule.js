// lib/sales/pipeline/schedule.js
//
// Everything the runner decides that does not need a database: whether a row
// is claimable, how long a failure waits, and when to stop trying.
//
// ══ Why these are pure ═════════════════════════════════════════════════════
//
// autoTopupDecision is pure for the same reason and says so: the caps are the
// part nobody exercises by hand, because by definition nobody runs a runaway
// deliberately. A retry ladder is identical — the fifth attempt of a task that
// has been failing for six hours is not something you reproduce by clicking.
// Pure means scripts/check-sales-pipeline.mjs can run the whole ladder, and it
// does, against the real functions rather than a description of them.
//
// ══ No jitter, deliberately ════════════════════════════════════════════════
//
// The usual argument for jitter is a thundering herd of retries landing
// together. That cannot happen here: retries are not timers, they are rows
// picked up by a cron that fires six times an hour, and the batch is drained
// serially inside one invocation. Adding jitter would buy nothing and would
// make the ladder untestable without seeding a PRNG.

/**
 * How many times a task is attempted before it is given up on.
 *
 * Five, not "until it works". Every stage here talks to something outside —
 * a directory API, a contractor's web server, a model vendor — and the
 * failures that actually happen are either transient (retried away inside the
 * first two attempts) or permanent (a domain that no longer resolves, which no
 * number of retries will fix). Retrying for ever would spend real money on the
 * second kind for ever, and the pipeline would never tell anyone it was stuck.
 */
export const MAX_ATTEMPTS = 5;

/**
 * How long a claim is believed before it is treated as abandoned.
 *
 * Same reasoning as AUTO_TOPUP_STALE_CLAIM_MINUTES, and the same number: a
 * serverless invocation that dies between claiming and settling would
 * otherwise wedge the task for ever. Reclaiming is safe rather than merely
 * tolerable, because the reclaim reuses the SAME idempotencyKey — see
 * idempotencyKeyFor below.
 *
 * It has to exceed the longest a single handler can plausibly run. Ten minutes
 * is far longer than a page fetch or a model call, and comfortably longer than
 * any function timeout this project could be configured with.
 */
export const STALE_CLAIM_MINUTES = 10;

/** First retry waits this long; each subsequent one doubles. */
export const BACKOFF_BASE_MS = 60_000;

/**
 * Ceiling on the wait.
 *
 * Six hours, so the last rung of the ladder is still short enough that a
 * campaign started in the morning has finished retrying by the evening. A
 * bigger cap would only postpone the moment somebody finds out.
 */
export const BACKOFF_MAX_MS = 6 * 60 * 60 * 1000;

/**
 * Wait before the next attempt, after `attempts` have been made.
 *
 * attempts=1 → 1m, 2 → 2m, 3 → 4m, 4 → 8m, capped at BACKOFF_MAX_MS.
 * Strictly increasing until the cap, which is the property the check asserts —
 * a constant delay dressed up as backoff is the mistake this shape prevents.
 */
export function backoffMs(attempts) {
  const n = Math.max(1, Math.floor(Number(attempts) || 1));
  // Math.min BEFORE the shift, so a wild attempts value cannot overflow into
  // Infinity and produce an Invalid Date on notBefore.
  const exponent = Math.min(n - 1, 40);
  return Math.min(BACKOFF_BASE_MS * 2 ** exponent, BACKOFF_MAX_MS);
}

/**
 * The stable idempotency key for a task.
 *
 * REUSED, never reissued — this is the single line that stops a reclaim
 * producing a second charge, a second call, or a second row at a provider. The
 * key the first attempt handed the vendor is the key the reclaim hands it, so
 * the vendor returns the original result instead of doing the work twice.
 *
 * Derived from the task id rather than minted with randomUUID, which is where
 * this differs from lib/voice/autoTopup.js. A minted token has a window: an
 * invocation that mints one, calls the provider, and dies before the write
 * leaves nothing behind, so the reclaim mints a DIFFERENT key and the side
 * effect happens twice — the exact failure the reuse exists to prevent. A
 * value derived from an immutable column has no such window. An explicit key
 * supplied at enqueue (which is also the dedupe key — see tasks.js) always
 * wins, because the caller may need it to match something outside.
 */
export function idempotencyKeyFor(task) {
  if (task?.idempotencyKey) return task.idempotencyKey;
  return `sales_pipeline:${task?.kind || "unknown"}:${task?.id}`;
}

/**
 * What to do with a candidate row, before touching the database.
 *
 * @returns { act: "claim" | "retire" | "skip", reason }
 *
 * "retire" is the one that matters. A task can reach the attempt ceiling
 * without ever running its failure path: attempts is incremented by the CLAIM,
 * so an invocation that dies mid-handler still burns one, and after enough
 * crashes the row would sit `queued` at the ceiling for ever — claimed by
 * nobody, finished by nobody, and counted as outstanding by everybody. Naming
 * it here means the ceiling terminates the task on the very next pass instead
 * of silently dropping it.
 */
export function claimDecision({ task, now = new Date(), maxAttempts = MAX_ATTEMPTS } = {}) {
  if (!task) return { act: "skip", reason: "no_task" };

  const at = now instanceof Date ? now : new Date(now);

  if (task.status === "done" || task.status === "failed" || task.status === "abandoned") {
    return { act: "skip", reason: "terminal" };
  }

  // Held by a live claim. Not ours to take until it expires.
  if (task.status === "claimed") {
    const expires = task.claimExpires ? new Date(task.claimExpires) : null;
    // A null claimExpires on a claimed row is a bug elsewhere, not permission
    // to steal the claim — treat it as live and let the attempt ceiling be the
    // thing that eventually frees it. Stealing would double the side effect.
    if (!expires || expires.getTime() > at.getTime()) {
      return { act: "skip", reason: "claim_live" };
    }
  }

  if (task.notBefore && new Date(task.notBefore).getTime() > at.getTime()) {
    return { act: "skip", reason: "not_yet" };
  }

  if ((task.attempts || 0) >= maxAttempts) {
    return { act: "retire", reason: "attempts_exhausted" };
  }

  return { act: "claim", reason: task.status === "claimed" ? "stale_claim" : "queued" };
}

/**
 * Where a failed attempt leaves the row.
 *
 * Three outcomes, and the difference between the last two is deliberate:
 *
 *   queued    — try again, after backoffMs.
 *   failed    — tried and gave up. The ceiling was reached.
 *   abandoned — will NEVER be tried, on purpose: no handler exists for the
 *               kind, the handler is a placeholder, or the handler said the
 *               work is impossible rather than unlucky.
 *
 * Two terminal states rather than one because they need different answers from
 * a human. `failed` asks "is the provider down?"; `abandoned` asks "why did
 * anyone queue this?". Collapsing them would hide the second question inside
 * the noise of the first.
 */
export function failureOutcome({ attempts, maxAttempts = MAX_ATTEMPTS, permanent = false } = {}) {
  if (permanent) return { status: "abandoned", delayMs: 0 };
  const made = Math.max(1, Math.floor(Number(attempts) || 1));
  if (made >= maxAttempts) return { status: "failed", delayMs: 0 };
  return { status: "queued", delayMs: backoffMs(made) };
}
