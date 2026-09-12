// lib/sales/scriptOnDemand.js
//
// The rules /api/sales/playbook applies when a rep asks for the call script
// in a language other than the prospect's default — pure, so the route
// reads them and scripts/check-call-script.mjs executes them. The route's
// header carries the argument; this file carries the numbers and the one
// predicate.
import { CALL_SCRIPT_VERSION } from "@/lib/sales/intel/callScript";

/** How many on-demand scripts one rep may have written in an hour. Sixty is
 *  one a minute — more than a rep flipping languages on real calls, well
 *  under a loop. */
export const ON_DEMAND_PER_HOUR = 60;

/** The ledger ref prefix every on-demand generation carries, and what the
 *  hourly count is taken over. */
export const ON_DEMAND_REF_PREFIX = "on_demand:";

/** Why an asked-for language was not delivered. A closed list; the screen
 *  keys a sentence on it. */
export const LANGUAGE_FALLBACK_REASONS = Object.freeze(["rate_limited", "generation_failed"]);

/**
 * Stale three ways — the rule research.js applies to the default row,
 * applied here to the row the rep asked for: none, older than the crawl,
 * or written by an earlier prompt.
 */
export function scriptRowStale(row, { lastCrawledAt = null } = {}) {
  return (
    !row ||
    (lastCrawledAt && row.crawledAt && new Date(row.crawledAt) < new Date(lastCrawledAt)) ||
    (row.promptVersion != null && row.promptVersion !== CALL_SCRIPT_VERSION)
  );
}
