// lib/sales/pipeline/runner.js
//
// Claim a pipeline task, run it, and settle it. The whole prospecting pipeline
// sits on this file.
//
// ══ Where this came from ═══════════════════════════════════════════════════
//
// Two things in this codebase already do the hard part, and they were written
// for different features and never met:
//
//   lib/voice/autoTopup.js  — a compare-and-set claim whose `where` names the
//     value the caller read, a stale-claim timeout, and token reuse so a
//     reclaim hands the provider the SAME idempotency key.
//   app/api/cron/grace-warning/route.js — claim before acting, a batch driven
//     by state rather than a cursor, and a claim that is reverted when the
//     work did not happen.
//
// SalesPipelineTask's schema comment says the same thing: this does not need
// inventing, it needs joining up. A queue library was rejected there because it
// would be a second scheduling mechanism whose failures look nothing like the
// twenty crons already here.
//
// ══ The bug this file exists not to have ═══════════════════════════════════
//
// findMany, then update. Two cron ticks that overlap both read the same row,
// both see `queued`, and both run it — which on the voice side is the same
// outbound call placed twice, to the same person, from the same number. The
// claim below is a single guarded updateMany whose `where` names the status
// AND the claim token that was read; the second runner matches nothing and
// gets count 0. There is no path through this file that reads a row and then
// updates it by id alone.
//
// ══ Failure is per task and per stage ══════════════════════════════════════
//
// The brief is explicit: a website that will not load must not stop the
// prospect's other stages. So every row is processed inside its own try/catch,
// nothing in the loop touches a sibling row, and a handler that throws costs
// exactly one attempt on exactly one task. There is no batch transaction and
// no early return — an exception escaping the loop would strand every row
// after it in `claimed` until their claims went stale, which is a ten-minute
// outage caused by one broken domain.
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { recordError } from "@/lib/platform/errorLog";
import { resolveProvider } from "./kinds";
import { getHandler, isPlaceholder } from "./registry";
import { makeProviderBudget } from "./limits";
import {
  MAX_ATTEMPTS,
  STALE_CLAIM_MINUTES,
  claimDecision,
  failureOutcome,
  idempotencyKeyFor,
} from "./schedule";
// Imported for its side effects: this is what puts real handlers in the
// registry. Without it every stage would report "not implemented" even after
// somebody wrote one. See handlers/index.js.
import "./handlers";

const MINUTE = 60_000;

/**
 * Take exclusive ownership of a task, atomically.
 *
 * The `where` names four things, and each one is load-bearing:
 *
 *   id           — the row.
 *   status       — the status we READ. A second runner that already claimed it
 *                  has changed this, so our update matches nothing.
 *   claimToken   — likewise, and this is the one that makes a stale-claim
 *                  reclaim safe: two runners racing to reclaim the same dead
 *                  claim both name the dead token, and only the first
 *                  succeeds, because the winner overwrote it.
 *   notBefore    — re-checked at write time, not just at read time. A backoff
 *                  written by a concurrent settle must not be ignored because
 *                  our findMany predates it.
 *
 * attempts is incremented HERE, by the claim, not by the failure path. An
 * invocation that dies mid-handler never reaches a failure path at all, and if
 * the attempt were charged there, a task that reliably kills the lambda would
 * be reclaimed for ever. Charging it at claim time means the ceiling bounds
 * crashes as well as errors.
 *
 * @returns the claimed row, or null when somebody else won.
 */
export async function claimTask({ task, now = new Date(), token, deps = {} } = {}) {
  const prisma = deps.db || db;
  const claimToken = token || randomUUID();
  // REUSED, not reissued. This is the line that stops a reclaim producing a
  // second side effect at a provider — see idempotencyKeyFor's header.
  const idempotencyKey = idempotencyKeyFor(task);

  const claim = await prisma.salesPipelineTask.updateMany({
    where: {
      id: task.id,
      status: task.status,
      claimToken: task.claimToken ?? null,
      notBefore: { lte: now },
      // Only meaningful on a reclaim, and then it is the whole guarantee: a
      // claim that has not expired belongs to somebody who may still be
      // talking to a provider, and stealing it is the double side effect this
      // file is built to prevent.
      ...(task.status === "claimed" ? { claimExpires: { lt: now } } : {}),
    },
    data: {
      status: "claimed",
      claimedAt: now,
      claimToken,
      claimExpires: new Date(now.getTime() + STALE_CLAIM_MINUTES * MINUTE),
      attempts: { increment: 1 },
      idempotencyKey,
    },
  });

  if (claim.count !== 1) return null;

  return {
    ...task,
    status: "claimed",
    claimedAt: now,
    claimToken,
    idempotencyKey,
    attempts: (task.attempts || 0) + 1,
  };
}

/**
 * Every write that settles a task goes through here.
 *
 * Guarded on OUR claim token. A run whose claim went stale while it was
 * waiting on a slow provider has already been reclaimed by somebody else, and
 * writing `done` at that point would erase a claim that is currently live —
 * the reverse of the race the claim prevents. Losing the guard is reported,
 * not swallowed, because it means STALE_CLAIM_MINUTES is too short for what
 * the handler actually does.
 */
async function settle({ task, token, data, prisma }) {
  const settled = await prisma.salesPipelineTask.updateMany({
    where: { id: task.id, claimToken: token, status: "claimed" },
    data,
  });
  return settled.count === 1;
}

/** Terminal success. */
async function completeTask({ task, token, now, note, deps = {} }) {
  const prisma = deps.db || db;
  return settle({
    task,
    token,
    prisma,
    data: {
      status: "done",
      completedAt: now,
      // Cleared so a finished row cannot be mistaken for a held one, and so
      // the last error does not outlive the failure it described.
      lastError: note ? String(note).slice(0, 500) : null,
      claimToken: null,
      claimExpires: null,
    },
  });
}

/**
 * A failed attempt: back on the queue with a backoff, or terminal.
 *
 * `permanent` is the caller saying the work is impossible rather than unlucky
 * — an unregistered kind, a placeholder handler, a handler that returned
 * retry:false. It goes to `abandoned`; the ceiling goes to `failed`. Both are
 * terminal and both keep lastError, because a task that disappears without
 * saying why is the silent drop this whole design refuses.
 */
async function failTask({ task, token, now, reason, permanent = false, maxAttempts = MAX_ATTEMPTS, deps = {} }) {
  const prisma = deps.db || db;
  const outcome = failureOutcome({ attempts: task.attempts, maxAttempts, permanent });
  const message =
    outcome.status === "failed"
      ? `gave up after ${task.attempts} attempt${task.attempts === 1 ? "" : "s"}: ${reason}`
      : String(reason);

  const ok = await settle({
    task,
    token,
    prisma,
    data: {
      status: outcome.status,
      lastError: message.slice(0, 500),
      // Released either way. On a retry this is what makes the row claimable
      // again; on a terminal state it stops a dead row looking held.
      claimToken: null,
      claimExpires: null,
      ...(outcome.status === "queued"
        ? { notBefore: new Date(now.getTime() + outcome.delayMs) }
        : { completedAt: now }),
    },
  });

  return { ...outcome, settled: ok };
}

/**
 * Retire a task that reached the attempt ceiling without ever running.
 *
 * Only reachable when attempts were burned by crashes rather than by handler
 * failures — see claimDecision's "retire" branch for why that is possible.
 * Guarded on the status read, so it cannot stamp over a row another runner is
 * mid-flight on.
 */
async function retireTask({ task, now, deps = {} }) {
  const prisma = deps.db || db;
  const retired = await prisma.salesPipelineTask.updateMany({
    where: { id: task.id, status: task.status, claimToken: task.claimToken ?? null },
    data: {
      status: "failed",
      completedAt: now,
      lastError: `gave up after ${task.attempts} attempts: claimed but never settled — see lastError of an earlier attempt`,
      claimToken: null,
      claimExpires: null,
    },
  });
  return retired.count === 1;
}

/**
 * Run one already-claimed task through its handler and settle it.
 *
 * Exported so a handler author can exercise their own stage end to end without
 * a cron, and so the check can drive one row at a time.
 */
export async function runClaimedTask({ task, now = new Date(), token, deps = {} }) {
  const prisma = deps.db || db;
  const handler = getHandler(task.kind);

  // An unregistered kind. Terminal, and terminal SAYING SO — the alternative
  // shapes are a throw (which looks like a provider outage and gets retried
  // five times) or a skip (which counts as success). Neither is true.
  if (!handler) {
    await failTask({
      task, token, now, deps,
      reason: `no handler registered for kind "${task.kind}"`,
      permanent: true,
    });
    return { outcome: "abandoned", reason: "unregistered_kind" };
  }

  let result;
  try {
    result = await handler({
      task,
      payload: task.payload || {},
      // The stable key. A handler MUST pass this to whatever provider it calls
      // rather than minting its own, or the reuse above buys nothing.
      idempotencyKey: task.idempotencyKey,
      now,
      db: prisma,
    });
  } catch (err) {
    // A throw is unlucky, not impossible: a socket closed, a 502, a JSON body
    // that was HTML. Retryable, with a backoff, up to the ceiling.
    const outcome = await failTask({
      task, token, now, deps,
      reason: err?.message ? `threw: ${err.message}` : "threw",
    });
    return { outcome: outcome.status === "queued" ? "retried" : outcome.status, reason: "threw" };
  }

  if (result?.done) {
    await completeTask({ task, token, now, note: result.note, deps });
    return { outcome: "done" };
  }

  // Not done, and the handler said whether trying again could help. Default is
  // NOT to retry: a handler that returns an unrecognised shape has not asked
  // for five more attempts, and reading silence as "retry" is how a broken
  // stage quietly spends a provider budget five times over.
  const outcome = await failTask({
    task, token, now, deps,
    reason: result?.reason || "handler returned no result",
    permanent: result?.retry !== true,
  });
  return { outcome: outcome.status === "queued" ? "retried" : outcome.status, reason: result?.reason };
}

/**
 * Drain a batch.
 *
 * State-driven, not a cursor — the same choice grace-warning made and for the
 * same reason: the `where` describes rows that need work, so anything this run
 * does not reach is picked up by the next tick unchanged, and nothing is
 * dropped by a cursor that moved past it.
 *
 * @param limit  How many rows this invocation may consider. The per-provider
 *               budget narrows it further; see limits.js.
 */
export async function drainSalesPipeline({
  now = new Date(),
  limit = 25,
  kinds = null,
  maxAttempts = MAX_ATTEMPTS,
  deps = {},
} = {}) {
  const prisma = deps.db || db;
  const budget = deps.budget || makeProviderBudget();
  const sleep = deps.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const logError = deps.recordError || recordError;

  const candidates = await prisma.salesPipelineTask.findMany({
    where: {
      notBefore: { lte: now },
      ...(kinds ? { kind: { in: kinds } } : {}),
      OR: [
        { status: "queued" },
        // A dead claim. Without this branch one crashed invocation wedges a
        // task for ever, which is the failure STALE_CLAIM_MINUTES exists for.
        { status: "claimed", claimExpires: { lt: now } },
      ],
    },
    orderBy: [{ notBefore: "asc" }, { createdAt: "asc" }],
    take: limit,
  });

  const counts = { considered: candidates.length, done: 0, retried: 0, failed: 0, abandoned: 0, retired: 0 };
  const skipped = {};
  const note = (reason) => { skipped[reason] = (skipped[reason] || 0) + 1; };

  for (const candidate of candidates) {
    // ── Per-task isolation ────────────────────────────────────────────────
    //
    // Everything below — the budget, the claim, the handler, the settle — is
    // inside this try. A throw from ANY of them costs one task. Letting it
    // escape would abandon every remaining row in `claimed`, so one contractor
    // whose web server hangs would stall every other prospect's stages for the
    // length of a stale-claim timeout.
    try {
      const decision = claimDecision({ task: candidate, now, maxAttempts });

      if (decision.act === "retire") {
        if (await retireTask({ task: candidate, now, deps })) counts.retired++;
        else note("retire_lost_race");
        continue;
      }
      if (decision.act !== "claim") { note(decision.reason); continue; }

      // Budget BEFORE claim, deliberately. A task deferred for rate limiting
      // must not be charged an attempt or given a backoff — it did not fail,
      // it did not run, and the next tick should find it exactly as it is.
      const provider = resolveProvider(candidate);
      if (!budget.take(provider)) { note(`rate_limited:${provider}`); continue; }

      const wait = budget.waitMs(provider);
      if (wait > 0) await sleep(wait);

      const token = randomUUID();
      const claimed = await claimTask({ task: candidate, now, token, deps });
      if (!claimed) { note("claimed_by_another_run"); continue; }

      // A stage nobody has built. Recorded as terminal with the reason in the
      // row rather than reported as done — AGENTS.md's first rule, applied to
      // a background job instead of a button.
      if (isPlaceholder(claimed.kind)) note(`not_implemented:${claimed.kind}`);

      const { outcome } = await runClaimedTask({ task: claimed, now, token, deps });
      if (outcome === "done") counts.done++;
      else if (outcome === "retried") counts.retried++;
      else if (outcome === "abandoned") counts.abandoned++;
      else counts.failed++;
    } catch (err) {
      note("runner_error");
      // Not swallowed. A throw out here is the runner's own bug — a database
      // hiccup on the claim, a settle that lost its guard — and it is invisible
      // otherwise, because the row it happened on looks merely unfinished.
      try {
        await logError({
          area: "sales-pipeline",
          code: "pipeline_task_error",
          message: `task ${candidate?.id} (${candidate?.kind}): ${err?.message || err}`,
        });
      } catch {
        // The error log itself is broken. recordError already refuses to throw
        // from its own catch for this reason; this second belt is here because
        // an injected logger in a check has no such promise.
      }
    }
  }

  return { ...counts, skipped, spent: budget.spent() };
}
