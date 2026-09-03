// lib/sales/pipeline/handlers/crawlWebsite.js
//
// CRAWL_WEBSITE, the first real pipeline stage.
//
// ══ Why this file is thin ══════════════════════════════════════════════════
//
// It is an adapter and nothing else: it turns a SalesPipelineTask into a call
// to lib/sales/crawl/crawlSite.js, and turns that call's result into the
// { done, retry, reason } shape registry.js documents. Every decision — may we
// fetch this URL, does robots.txt allow it, is the host blocked, has the site
// changed — belongs to a pure function that a check can execute without a
// queue, a database or a network.
//
// ══ The three outcomes, and why two of them are `done: true` ═══════════════
//
//   done: true          — crawled, unchanged, or skipped because the site was
//                         crawled recently. All three are the stage having
//                         finished successfully. "Unchanged" in particular is
//                         a SUCCESS: it is the §20 cache working, and marking
//                         it as a failure would make every re-crawl of a
//                         stable site look like a broken pipeline.
//   retry: false        — refused. robots.txt says no, the host is blocked,
//                         the URL is not fetchable, a human said do-not-
//                         contact, the domain is suppressed, the domain does
//                         not resolve. Nothing about tomorrow changes any of
//                         those, so the row goes to `abandoned` with the
//                         reason in lastError rather than burning five
//                         attempts to arrive at the same sentence.
//   retry: true         — a timeout, a reset, a 5xx, a host slot another
//                         lambda was holding. Unlucky rather than impossible.
//                         Bounded by MAX_ATTEMPTS, so it is five tries and
//                         then `failed` — never endless.
//
// ══ idempotencyKey is deliberately not used ════════════════════════════════
//
// The runner hands every handler a stable key so that a reclaim cannot produce
// a second side effect at a provider. There is no provider here and no side
// effect to duplicate: the crawl is a sequence of GETs, and running it twice
// costs two requests, which the per-host politeness table already spaces. What
// WOULD be duplicated is a set of evidence rows, and that is prevented by
// something better than a key — an unchanged content hash writes nothing at
// all. Saying so here, because a handler that silently ignores an argument the
// runner's header calls load-bearing should explain itself.
import { registerHandler } from "@/lib/sales/pipeline/registry";
import { withChain } from "@/lib/sales/pipeline/chain";
import { crawlProspectSite } from "@/lib/sales/crawl/crawlSite";

/** Bumped when the handler's own contract changes, not when the crawler's
 *  extraction does — that version lives on the evidence rows. */
export const CRAWL_HANDLER_VERSION = "1";

/**
 * @param payload { prospectId?, companyId?, force? }
 *        prospectId falls back to the task's own column, because both
 *        enqueue shapes are legitimate and a handler that read only one of
 *        them would abandon every task queued the other way.
 */
export async function handleCrawlWebsite({ task, payload = {}, db } = {}) {
  const prospectId = payload.prospectId || task?.prospectId || null;
  if (!prospectId) {
    // Terminal on purpose. A crawl task with nothing to crawl is a mistake at
    // enqueue time, and retrying it five times does not supply the missing id.
    return { done: false, retry: false, reason: "no_prospect_id" };
  }

  const result = await crawlProspectSite({
    prospectId,
    companyId: payload.companyId ?? null,
    force: payload.force === true,
    deps: { db },
  });

  if (result.outcome === "crawled" || result.outcome === "unchanged" || result.outcome === "skipped") {
    return {
      done: true,
      note: [result.outcome, result.reason, result.note].filter(Boolean).join(": "),
    };
  }

  return {
    done: false,
    // The crawler already decided this, per failure. Reading `retry` here
    // rather than re-deriving it keeps one answer to "is this worth trying
    // again" instead of two that can drift apart.
    retry: result.retry === true,
    reason: [result.reason, result.note].filter(Boolean).join(" — "),
  };
}

// Wrapped so the next stage is queued when this one will not run again — see
// chain.js. A refusal counts: robots.txt saying no is a permanent answer, and
// the prospect still deserves a lead score and a research brief that say the
// site could not be read. Only a retryable failure with attempts left holds
// the chain, because that attempt is coming back.
registerHandler("CRAWL_WEBSITE", withChain("CRAWL_WEBSITE", handleCrawlWebsite));
