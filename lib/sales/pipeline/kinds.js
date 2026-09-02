// lib/sales/pipeline/kinds.js
//
// The names of the stages, and which outside service each one spends.
//
// ══ Why the kind list is a closed set ══════════════════════════════════════
//
// enqueueOutbound refuses an unknown purpose at enqueue time, on the grounds
// that "a task that can never run is worse than no task". The same argument
// holds here and harder: a misspelled kind would sit `queued` for ever,
// counted in nobody's total, and the campaign would look like it was still
// working. So the set is closed, enqueue rejects anything outside it, and the
// runner treats a row whose kind is not here as terminal rather than
// retryable — see runner.js.
//
// ══ Why the provider mapping lives with the kinds ══════════════════════════
//
// Every rate limit and concurrency ceiling in limits.js is expressed per
// PROVIDER, not per kind, because that is what actually gets throttled: three
// stages that all call OpenAI share one budget with the vendor, and splitting
// the budget by stage would let the pipeline exceed it three times over. The
// mapping is here rather than in limits.js so that adding a kind forces the
// author to answer "what does it spend?" in the same edit.

/** Stage names. Order is the order the pipeline runs them, for readability
 *  only — sequencing is done by whoever enqueues the next stage, not here. */
export const TASK_KINDS = [
  "DISCOVER_BUSINESSES",
  "ENRICH_BUSINESS",
  "CRAWL_WEBSITE",
  "DETECT_TECHNOLOGY",
  "ANALYZE_CAPABILITIES",
  "DETECT_OPPORTUNITIES",
  "CALCULATE_LEAD_SCORE",
  "GENERATE_RESEARCH_BRIEF",
];

const KIND_SET = new Set(TASK_KINDS);

export function isKnownKind(kind) {
  return typeof kind === "string" && KIND_SET.has(kind);
}

/**
 * Which outside service a stage spends.
 *
 * "local" means nothing outside this process is touched — CALCULATE_LEAD_SCORE
 * is deterministic rules over rows we already hold (spec §18), so throttling it
 * would only slow the pipeline down to protect nothing.
 *
 * DISCOVER_BUSINESSES is deliberately NOT hard-wired to Google here. The
 * campaign names its own `discoveryProvider` and a null means nobody has
 * chosen — see ProspectCampaign's schema comment on why a default would have
 * pointed the first campaign at the one source whose terms forbid it. So the
 * static mapping says "discovery", and resolveProvider() below lets the task's
 * payload name the actual vendor whose budget it draws from.
 */
export const PROVIDER_BY_KIND = {
  DISCOVER_BUSINESSES: "discovery",
  ENRICH_BUSINESS: "discovery",
  CRAWL_WEBSITE: "http_crawl",
  DETECT_TECHNOLOGY: "local",
  // Corrected when the stage was actually built. It calls no model: capability
  // detection is URLs, forms, schema.org blocks and already-detected
  // technologies, which is what §58 means by "deterministic software for what
  // software can determine". Leaving it on `openai` would have charged every
  // analysis against the tightest budget in the pipeline — the lane STATUS.md's
  // arithmetic identifies as the one that makes a 1,000-prospect campaign take
  // two days — to protect a vendor this stage never talks to.
  ANALYZE_CAPABILITIES: "local",
  DETECT_OPPORTUNITIES: "openai",
  CALCULATE_LEAD_SCORE: "local",
  GENERATE_RESEARCH_BRIEF: "openai",
};

/**
 * The provider budget this particular task draws on.
 *
 * `payload.provider` wins when present, so two campaigns discovering through
 * two different vendors do not share one ceiling — a limit that lumps them
 * together is either too tight for one or too loose for the other.
 */
export function resolveProvider(task) {
  const named = task?.payload?.provider;
  if (typeof named === "string" && named.trim()) return named.trim();
  return PROVIDER_BY_KIND[task?.kind] || "unknown";
}
