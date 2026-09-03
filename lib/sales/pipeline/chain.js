// lib/sales/pipeline/chain.js
//
// What runs after what, and the one function that queues it.
//
// ══ Why the chain is here and not in the runner ════════════════════════════
//
// The runner claims, runs and settles. It deliberately knows nothing about
// what a stage MEANS — that is why it can be read end to end without knowing
// what a prospect is. Putting "and then crawl" inside it would make the queue
// mechanism depend on the product, and the next queue this repo grows would
// inherit a sales pipeline it does not want.
//
// So each stage queues its successor, exactly as DISCOVER_BUSINESSES already
// queues its own next page. What this file adds is that the ORDER lives in one
// place: eight stages each naming their own successor in eight files is seven
// opportunities for the chain to disagree with itself, and the disagreement
// would look like a prospect that quietly stopped being researched.
//
// ══ A stage that FAILS must not strand the prospect ════════════════════════
//
// This is the property that took the most care, and the naive version gets it
// wrong. "Advance on success" means a contractor whose web server times out
// gets no lead score and no research brief — the two things a rep actually
// reads — because a stage four steps upstream could not open a socket. The
// brief for this work says it plainly: a stage that fails does not stop the
// prospect's other stages.
//
// So the chain advances on every outcome that will NOT be tried again:
//
//   done: true            the stage worked.
//   retry: false          the stage refused, permanently. robots.txt says no,
//                         the site does not resolve, there are no signatures.
//                         Nothing downstream gets better by waiting, and
//                         everything downstream can still say something true
//                         about what we do and do not know.
//   attempts exhausted    the LAST retryable attempt. Without this branch a
//                         five-times-timing-out crawl ends the chain in
//                         silence, which is the same outcome as the naive
//                         version for the commonest failure there is.
//
// It does NOT advance on a retryable failure with attempts left: that attempt
// is coming back, and queueing the successor now would analyse a prospect
// whose crawl is about to succeed.
//
// ══ Why the successor's key names the task that queued it ══════════════════
//
// `crawl:${prospectId}` alone would dedupe against the crawl task from LAST
// month's run and silently never re-crawl. Including the predecessor's task id
// makes the key unique per run and identical across that task's retries —
// which is exactly the dedupe wanted: one successor per predecessor, however
// many times the predecessor is attempted.
import { MAX_ATTEMPTS } from "./schedule";
import { enqueuePipelineTask } from "./tasks";

/**
 * The linear part of the pipeline.
 *
 * Two stages are deliberately absent from the left-hand side:
 *
 *   DISCOVER_BUSINESSES — it fans OUT (one campaign page becomes many
 *     prospects) rather than handing one prospect on, so its successor is
 *     queued per prospect inside its own handler.
 *   ENRICH_BUSINESS — it BRANCHES: a prospect with a website goes to the
 *     crawler, one without goes straight to the opportunity analysis, because
 *     crawling nothing and fingerprinting nothing are three stages that can
 *     only write "we did not look" more slowly.
 *
 * Both are listed here as `null` rather than omitted, so `nextStageFor` can
 * tell "this stage ends the chain" from "somebody forgot this stage".
 */
export const NEXT_STAGE = Object.freeze({
  DISCOVER_BUSINESSES: null,
  ENRICH_BUSINESS: null,
  CRAWL_WEBSITE: "DETECT_TECHNOLOGY",
  DETECT_TECHNOLOGY: "ANALYZE_CAPABILITIES",
  ANALYZE_CAPABILITIES: "DETECT_OPPORTUNITIES",
  DETECT_OPPORTUNITIES: "CALCULATE_LEAD_SCORE",
  CALCULATE_LEAD_SCORE: "GENERATE_RESEARCH_BRIEF",
  GENERATE_RESEARCH_BRIEF: null,
});

/** The successor, or null when this stage ends the chain. Throws for a kind
 *  nobody has placed in the order — a stage with no declared successor would
 *  otherwise end the pipeline by accident and look like a working one. */
export function nextStageFor(kind) {
  if (!Object.hasOwn(NEXT_STAGE, kind)) {
    throw new Error(`sales pipeline: ${kind} has no place in NEXT_STAGE — add it to chain.js`);
  }
  return NEXT_STAGE[kind];
}

/**
 * Will this attempt be tried again?
 *
 * The successor is queued when the answer is no, whatever the reason. See the
 * header — this is the whole "a failure does not strand the prospect" property
 * and it is pure so the check can drive every branch of it.
 */
export function shouldAdvance({ result, task, maxAttempts = MAX_ATTEMPTS } = {}) {
  if (result?.done === true) return true;
  if (result?.retry !== true) return true;
  return (Number(task?.attempts) || 0) >= maxAttempts;
}

/** The idempotency key for a successor. Exported because the discovery fan-out
 *  builds its own (a campaign key rather than a task key) and the two shapes
 *  should be readable side by side. */
export function successorKey({ kind, prospectId, taskId }) {
  return `${kind}:${prospectId}:${taskId}`;
}

/**
 * Queue one prospect's next stage.
 *
 * @returns { queued: string|null, reason: string|null }
 *
 * Never guesses at a prospect id. A task with no prospect (a discovery page,
 * a malformed enqueue) has no successor to queue, and inventing one would put
 * a task on the queue that can only fail.
 */
export async function advanceChain({ kind, task, db, next = undefined, notBefore = null } = {}) {
  const successor = next === undefined ? nextStageFor(kind) : next;
  if (!successor) return { queued: null, reason: "end_of_chain" };

  const prospectId = task?.prospectId || task?.payload?.prospectId || null;
  if (!prospectId) return { queued: null, reason: "no_prospect" };

  await enqueuePipelineTask(
    {
      kind: successor,
      prospectId,
      campaignId: task?.campaignId ?? null,
      payload: { prospectId },
      idempotencyKey: successorKey({ kind: successor, prospectId, taskId: task?.id }),
      notBefore,
    },
    { deps: { db } },
  );

  return { queued: successor, reason: null };
}

/**
 * Wrap a handler so its successor is queued when it will not run again.
 *
 * Applied at the registration line rather than inside each handler, so a
 * handler with six return statements cannot grow a seventh that forgets.
 *
 * ── An enqueue failure is deliberately NOT swallowed ───────────────────────
 *
 * If the insert throws, this throws, and the runner treats the task as a
 * retryable failure — so the stage runs again and the successor is queued on
 * the next attempt. That costs a repeat of work that has already been written,
 * which every stage here tolerates by construction: the crawler skips a site
 * it fetched recently, the detectors delete-and-rewrite their own rows, the
 * capability writer upserts. The alternative — catching and logging — is a
 * pipeline that reports success and quietly stops, which is the failure this
 * whole file exists to prevent.
 */
export function withChain(kind, handler) {
  return async function chained(ctx) {
    const result = await handler(ctx);
    if (shouldAdvance({ result, task: ctx?.task })) {
      await advanceChain({ kind, task: ctx?.task, db: ctx?.db });
    }
    return result;
  };
}
