#!/usr/bin/env node
//
// scripts/find-probe-fallback-crawls.mjs
//
//   node --import ./scripts/alias-loader.mjs scripts/find-probe-fallback-crawls.mjs
//
// READ-ONLY. Counts the prospects whose LATEST crawl guessed its way around
// the site instead of reading the menu, and prices what re-crawling them
// would cost. It queues nothing and writes nothing.
//
// ══ Why a count and not a requeue ═════════════════════════════════════════
//
// Before 2026-09-13 the crawler fell back to three blind probes (`/contact`,
// `/services`, `/about`) whenever fewer than TWO of a site's links matched a
// twelve-word slug list, and the capability detector then counted the pages
// that rendered — probes included — as "looked beyond the front page". A
// gutter company whose contact page was `/contact_us` was told it had no
// enquiry form, no portal, no booking and no way to pay (lib/sales/crawl/
// url.js and lib/sales/intel/capabilityDetect.js record the fix).
//
// Every prospect crawled that way is a candidate for a re-crawl. A re-crawl
// whose content changes re-runs the whole chain, and the chain ends in
// GENERATE_RESEARCH_BRIEF. What that costs depends on the LANE
// (lib/sales/pipeline/priority.js): the backlog lane carries `phrase: false`
// and composes the brief from rows with no model call — free by construction
// — while a CLAIMED prospect's chain phrases the brief, infers from the site
// and writes a call script, three OpenAI calls at about $0.00061 each by the
// owner's own measurement (lib/sales/pipeline/limits.js). Bumping
// CONTENT_HASH_VERSION would re-analyse EVERY crawled prospect, not only
// these, on whatever lane each is in. Spending that is the owner's decision,
// so this script reports the numbers and both bills and stops.
//
// ══ How "used probe fallback" is read off the rows ═════════════════════════
//
// Two spellings, because two generations of rows exist:
//
//   · a page_fetch envelope carrying `"via":"probe"` — written by crawls
//     since detectorVersion 2. Exact.
//   · a 404 on exactly `/contact`, `/services` or `/about` in a crawl with no
//     `via` at all — the only visible trace an older crawl leaves. A 404 on
//     one of those three paths is a guess that missed; a 200 on them cannot
//     be told from a real link and is NOT counted, so the older figure is a
//     floor, not a total.
//
// "Latest crawl" is the newest page_fetch observedAt per prospect, not
// Prospect.lastCrawledAt: an unchanged re-crawl bumps lastCrawledAt and writes
// no rows, so the two differ and the rows are what was actually seen.
import "dotenv/config";
import { db } from "@/lib/db";

/** The owner's measured cost of one research brief: 37,638 briefs for $23. */
const BRIEF_COST_USD = 0.00061;

// The count itself can take a while over a million evidence rows; the
// default statement timeout on this database is shorter than that.
await db.$executeRawUnsafe(`SET statement_timeout = '600s'`);

const [totals] = await db.$queryRawUnsafe(`
  SELECT
    COUNT(*)::int AS crawled_prospects
  FROM "Prospect"
  WHERE "lastCrawledAt" IS NOT NULL
`);

const [counts] = await db.$queryRawUnsafe(`
  WITH latest AS (
    SELECT "prospectId", MAX("observedAt") AS at
    FROM "ProspectEvidence"
    WHERE type = 'page_fetch' AND source = 'website'
    GROUP BY "prospectId"
  ),
  fetches AS (
    SELECT e."prospectId", e."sourceUrl", e."normalizedValue", e."rawValue"
    FROM "ProspectEvidence" e
    JOIN latest l ON l."prospectId" = e."prospectId" AND l.at = e."observedAt"
    WHERE e.type = 'page_fetch' AND e.source = 'website'
  ),
  per_prospect AS (
    SELECT
      "prospectId",
      BOOL_OR("rawValue" LIKE '%"via":"probe"%') AS stamped_probe,
      BOOL_OR("rawValue" LIKE '%"via":"%') AS stamped_at_all,
      BOOL_OR(
        "normalizedValue" = 'http_404'
        AND "sourceUrl" ~* '^https?://[^/]+/(contact|services|about)/?$'
      ) AS probe_404
    FROM fetches
    GROUP BY "prospectId"
  )
  SELECT
    COUNT(*)::int AS prospects_with_a_crawl,
    COUNT(*) FILTER (WHERE stamped_probe)::int AS stamped_probe,
    COUNT(*) FILTER (WHERE NOT stamped_at_all AND probe_404)::int AS unstamped_probe_404,
    COUNT(*) FILTER (WHERE stamped_probe OR (NOT stamped_at_all AND probe_404))::int AS affected,
    COUNT(*) FILTER (
      WHERE (stamped_probe OR (NOT stamped_at_all AND probe_404))
        AND EXISTS (
          SELECT 1 FROM "Prospect" p
          WHERE p.id = per_prospect."prospectId"
            AND p."assignedRepId" IS NOT NULL
            AND (p."claimExpiresAt" IS NULL OR p."claimExpiresAt" > NOW())
        )
    )::int AS affected_claimed
  FROM per_prospect
`);

const affected = Number(counts.affected);
const claimed = Number(counts.affected_claimed);
/** Three model calls on the claimed lane: the phrased brief, INFER_FROM_SITE
 *  and the call script. Priced at the brief's rate each; the other two are
 *  the same order of magnitude (lib/sales/intel/siteInference.js: "about a
 *  tenth of a cent a prospect"). */
const claimedCost = claimed * 3 * BRIEF_COST_USD;
const ifAllPhrased = affected * BRIEF_COST_USD;

console.log(`prospects with lastCrawledAt:           ${totals.crawled_prospects}`);
console.log(`prospects with page_fetch rows:         ${counts.prospects_with_a_crawl}`);
console.log(`latest crawl stamped via=probe (v2):    ${counts.stamped_probe}`);
console.log(`latest crawl unstamped, 404 on a probe: ${counts.unstamped_probe_404}  (a floor — a probe that 200'd is invisible)`);
console.log(`\naffected prospects:                     ${affected}`);
console.log(`…of which currently claimed by a rep:   ${claimed}`);
console.log(`\nre-crawl on the backlog lane (phrase: false — the cron's own lane):`);
console.log(`  model calls:                          0 for the ${affected - claimed} unclaimed; the brief composes from rows`);
console.log(`  claimed-lane chains (3 calls each):   ${claimed} × 3 × $${BRIEF_COST_USD} ≈ $${claimedCost.toFixed(2)}`);
console.log(`if every brief were phrased instead:    ${affected} × $${BRIEF_COST_USD} ≈ $${ifAllPhrased.toFixed(2)}`);
console.log(`\nNothing was queued. The crawl requests themselves cost nothing but politeness (CrawlHostPolicy).`);

process.exit(0);
