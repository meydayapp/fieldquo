// lib/sales/pipeline/registry.js
//
// Which function runs a stage, and — until somebody writes it — the honest
// admission that none does.
//
// ══ Why every kind is pre-registered with a placeholder ════════════════════
//
// The tempting shape is an empty registry that fills up as handlers land. It
// fails in the one way AGENTS.md forbids above all others: a stage with no
// handler would either throw (and look like a transient outage, retried five
// times, backed off for hours, and eventually reported as "provider failed")
// or, worse, be skipped and counted as nothing at all. Both make an unbuilt
// stage indistinguishable from a working one.
//
// So every kind has a handler from the first commit, and the ones nobody has
// written yet say exactly that, in the row, in a terminal state, with the file
// that must supply them named in lastError. A campaign that runs today
// finishes with rows reading "not implemented: CRAWL_WEBSITE has no handler",
// which is a true statement about the product. A `done` with nothing behind it
// would not be.
//
// ══ Why replacing a placeholder is allowed and replacing a real one is not ══
//
// Handlers are registered by whichever module imports itself into the run —
// see handlers/index.js. Letting a second registration silently overwrite a
// working handler would make behaviour depend on import order, which is the
// kind of thing that changes when an unrelated file gains an import. So a
// placeholder may be replaced (that is the whole point) and a real handler may
// not be replaced by anything.
import { TASK_KINDS, isKnownKind } from "./kinds";

/** Prefix on every placeholder's reason, so a caller can recognise one
 *  without string-matching a sentence. */
export const NOT_IMPLEMENTED = "not_implemented";

const handlers = new Map();
const placeholders = new Set();

/**
 * The stand-in for a stage nobody has built.
 *
 * `retry: false` on purpose. Nothing about tomorrow makes an unwritten
 * function exist, so retrying would burn five attempts and six hours of
 * backoff to arrive at the same sentence. The task goes straight to
 * `abandoned`, which is the state that means "deliberately not tried" — see
 * failureOutcome in schedule.js.
 */
function placeholderFor(kind) {
  return async function notImplemented() {
    return {
      done: false,
      retry: false,
      reason: `${NOT_IMPLEMENTED}: ${kind} has no handler yet — register one from lib/sales/pipeline/handlers/`,
    };
  };
}

for (const kind of TASK_KINDS) {
  handlers.set(kind, placeholderFor(kind));
  placeholders.add(kind);
}

/**
 * Register the real implementation of a stage.
 *
 * @param kind One of TASK_KINDS. An unknown name throws rather than being
 *             stored: a handler registered under a typo would never run, and a
 *             silent no-op at registration time is discovered months later by
 *             whoever wonders why the stage does nothing.
 * @param fn   async ({ task, payload, idempotencyKey, now, db, logger }) =>
 *               { done: true,  note?: string }
 *             | { done: false, retry: boolean, reason: string }
 *             A throw is treated as a retryable failure — see runner.js.
 */
export function registerHandler(kind, fn) {
  if (!isKnownKind(kind)) {
    throw new Error(`sales pipeline: unknown task kind "${kind}" — add it to TASK_KINDS first`);
  }
  if (typeof fn !== "function") {
    throw new Error(`sales pipeline: handler for ${kind} is not a function`);
  }
  if (!placeholders.has(kind)) {
    throw new Error(
      `sales pipeline: ${kind} already has a real handler — two registrations make behaviour depend on import order`,
    );
  }
  handlers.set(kind, fn);
  placeholders.delete(kind);
  return fn;
}

/** The handler for a kind, or null when the kind itself is not a stage. */
export function getHandler(kind) {
  return handlers.get(kind) || null;
}

/** True when the kind is still served by the "not implemented" stand-in. */
export function isPlaceholder(kind) {
  return placeholders.has(kind);
}

/** Every kind with whether it is real yet — for the cron's response body, so
 *  the state of the pipeline is visible without reading the source. */
export function handlerStatus() {
  return TASK_KINDS.map((kind) => ({ kind, implemented: !placeholders.has(kind) }));
}

/** Test seam ONLY: forget a registration so a check can install its own.
 *  Never called by product code — the registry is process-wide and a reset in
 *  a running lambda would race with a drain already in flight. */
export function __resetHandlerForTests(kind) {
  if (!isKnownKind(kind)) return;
  handlers.set(kind, placeholderFor(kind));
  placeholders.add(kind);
}
