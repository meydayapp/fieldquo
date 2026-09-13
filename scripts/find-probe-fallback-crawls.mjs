#!/usr/bin/env node
//
// scripts/find-probe-fallback-crawls.mjs
//
//   node --import ./scripts/alias-loader.mjs scripts/find-probe-fallback-crawls.mjs
//   node --import ./scripts/alias-loader.mjs scripts/find-probe-fallback-crawls.mjs --queue [--hours 12] [--snapshot file]
//   node --import ./scripts/alias-loader.mjs scripts/find-probe-fallback-crawls.mjs --check --snapshot file
//
// Counts the prospects whose LATEST crawl guessed its way around the site
// instead of reading the menu, prices what re-crawling them would cost, and
// — only with `--queue`, which the owner approved on 2026-09-13 — puts them
// on the pipeline queue. The default is a dry run and writes nothing.
//
// ══ Why a count first ═════════════════════════════════════════════════════
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
// so the dry run reports the numbers and both bills and stops.
//
// ══ How "used probe fallback" is read off the rows ═════════════════════════
//
// Two spellings, because two generations of rows exist:
//
//   · a page_fetch envelope carrying `"via":"probe"` — written by crawls
//     since detectorVersion 2. Exact. NOT re-queued: the new ranking already
//     found nothing to follow on that site, and crawling it again gains
//     nothing.
//   · a 404 on exactly `/contact`, `/services` or `/about` in a crawl with no
//     `via` at all — the only visible trace an older crawl leaves. A 404 on
//     one of those three paths is a guess that missed; a 200 on them cannot
//     be told from a real link and is NOT counted, so the older figure is a
//     floor, not a total. These are the ones `--queue` queues.
//
// "Latest crawl" is the newest page_fetch observedAt per prospect, not
// Prospect.lastCrawledAt: an unchanged re-crawl bumps lastCrawledAt and writes
// no rows, so the two differ and the rows are what was actually seen.
//
// ══ What --queue writes, and why it is shaped this way ═════════════════════
//
//   · One CRAWL_WEBSITE task per prospect, `force: true` (the monthly
//     re-crawl interval would otherwise skip every one of them — they were
//     crawled days ago), on the BACKLOG lane with `phrase: false` so the
//     chain it starts phrases nothing. A prospect a rep currently holds goes
//     on the CLAIMED lane instead, unphrased-nothing: the rep is waiting and
//     the brief they read should be the real one.
//   · idempotencyKey `recrawl:menu-fix:<prospectId>` — stable, so running
//     this twice queues nothing twice, and a prospect whose task already ran
//     (any status) is not queued again. createMany with skipDuplicates does
//     the whole insert in a handful of statements instead of ten thousand.
//   · A prospect with a CRAWL_WEBSITE task already queued or claimed is left
//     alone; one with `doNotContactAt` set is left alone (the crawler would
//     refuse it anyway — gate 2 in crawlSite.js — but a refused task is a row
//     for nothing).
//   · notBefore is STAGGERED evenly over `--hours` (default 12). The cron
//     considers 100 tasks a minute and spends at most 40 of them on crawls
//     (lib/sales/pipeline/limits.js); ten thousand tasks all due now would
//     hold that slice for hours and starve every other prospect's stages.
//     Per-HOST politeness is not this script's job — CrawlHostPolicy spaces
//     requests to any one server whatever the queue holds.
//   · A snapshot of every affected prospect's capability rows is written
//     BEFORE queueing, so `--check` can say what flipped.
import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { db } from "@/lib/db";
import { CLAIMED_NOT_BEFORE } from "@/lib/sales/pipeline/priority";

/** The owner's measured cost of one research brief: 37,638 briefs for $23. */
const BRIEF_COST_USD = 0.00061;

/** The cron's slice (app/api/cron/sales-pipeline/route.js BATCH) and the
 *  share of it crawls may take (limits.js http_crawl.maxPerRun), per minute. */
const CRON_BATCH_PER_MINUTE = 100;
const CRAWLS_PER_MINUTE = 40;
/** Stages one re-crawled prospect goes through after the crawl itself. */
const CHAIN_STAGES_AFTER_CRAWL = 5;

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name, fallback) => {
  const at = args.indexOf(name);
  return at !== -1 && args[at + 1] ? args[at + 1] : fallback;
};
const QUEUE = flag("--queue");
const CHECK = flag("--check");
const HOURS = Math.max(1, Number(option("--hours", "12")) || 12);
const SNAPSHOT = option("--snapshot", "./probe-fallback-snapshot.json");
const KEY_PREFIX = "recrawl:menu-fix:";

// The count itself can take a while over a million evidence rows; the
// default statement timeout on this database is shorter than that.
await db.$executeRawUnsafe(`SET statement_timeout = '600s'`);

// ══ --check: what has happened since the snapshot ══════════════════════════
if (CHECK) {
  const snap = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
  const ids = snap.ids || [];
  const tasks = await db.salesPipelineTask.groupBy({
    by: ["status"],
    where: { idempotencyKey: { startsWith: snap.keyPrefix || KEY_PREFIX } },
    _count: true,
  });
  console.log(`snapshot taken ${snap.takenAt}; ${ids.length} prospects`);
  console.log(`crawl tasks by status: ${tasks.map((t) => `${t.status}=${t._count}`).join("  ") || "none"}`);

  // Re-crawled = the latest page_fetch now carries a `via` stamp.
  let recrawled = 0;
  const flips = {};
  const bump = (k) => (flips[k] = (flips[k] || 0) + 1);
  for (let i = 0; i < ids.length; i += 2000) {
    const chunk = ids.slice(i, i + 2000);
    const [{ n }] = await db.$queryRawUnsafe(
      `WITH latest AS (
         SELECT "prospectId", MAX("observedAt") AS at FROM "ProspectEvidence"
         WHERE type = 'page_fetch' AND source = 'website' AND "prospectId" = ANY($1::text[])
         GROUP BY "prospectId")
       SELECT COUNT(DISTINCT e."prospectId")::int AS n
       FROM "ProspectEvidence" e JOIN latest l ON l."prospectId" = e."prospectId" AND l.at = e."observedAt"
       WHERE e.type = 'page_fetch' AND e."rawValue" LIKE '%"via":"%'`,
      chunk,
    );
    recrawled += Number(n);
    const caps = await db.prospectCapability.findMany({
      where: { prospectId: { in: chunk }, detectedAt: { gt: new Date(snap.takenAt) } },
      select: { prospectId: true, code: true, value: true },
    });
    for (const c of caps) {
      const before = snap.capabilities?.[c.prospectId]?.[c.code];
      if (before === undefined) { bump(`new:${c.value}`); continue; }
      if (before === c.value) continue;
      bump(`${before}→${c.value}`);
    }
  }
  console.log(`re-crawled so far (latest crawl stamped): ${recrawled} / ${ids.length}`);
  console.log(`capability rows re-decided since the snapshot: ${Object.entries(flips).map(([k, v]) => `${k}=${v}`).join("  ") || "none yet"}`);
  process.exit(0);
}

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
const queueable = Number(counts.unstamped_probe_404);

console.log(`prospects with lastCrawledAt:           ${totals.crawled_prospects}`);
console.log(`prospects with page_fetch rows:         ${counts.prospects_with_a_crawl}`);
console.log(`latest crawl stamped via=probe (v2):    ${counts.stamped_probe}  (not re-queued — the new ranking found nothing to follow)`);
console.log(`latest crawl unstamped, 404 on a probe: ${counts.unstamped_probe_404}  (a floor — a probe that 200'd is invisible)`);
console.log(`\naffected prospects:                     ${affected}`);
console.log(`…of which currently claimed by a rep:   ${claimed}`);
console.log(`\nre-crawl on the backlog lane (phrase: false — the cron's own lane):`);
console.log(`  model calls:                          0 for the ${affected - claimed} unclaimed; the brief composes from rows`);
console.log(`  claimed-lane chains (3 calls each):   ${claimed} × 3 × $${BRIEF_COST_USD} ≈ $${claimedCost.toFixed(2)}`);
console.log(`if every brief were phrased instead:    ${affected} × $${BRIEF_COST_USD} ≈ $${ifAllPhrased.toFixed(2)}`);

// ── Expected drain time ───────────────────────────────────────────────────
//
// Two bounds, and the larger wins. The stagger spreads the crawls over
// HOURS; the cron's slice then has to carry the crawl AND its five
// successors for each prospect, on top of whatever is already queued ahead
// of them (everything with an earlier notBefore is considered first).
const [{ queued_ahead }] = await db.$queryRawUnsafe(
  `SELECT COUNT(*)::int AS queued_ahead FROM "SalesPipelineTask" WHERE status = 'queued' AND "notBefore" <= NOW()`,
);
const chainTasks = queueable * (1 + CHAIN_STAGES_AFTER_CRAWL);
const sliceHours = (Number(queued_ahead) + chainTasks) / CRON_BATCH_PER_MINUTE / 60;
const crawlHours = queueable / CRAWLS_PER_MINUTE / 60;
const drainHours = Math.max(HOURS, sliceHours, crawlHours);
console.log(`\ndrain estimate for ${queueable} re-crawls:`);
console.log(`  tasks already queued and due ahead:   ${queued_ahead}`);
console.log(`  crawl budget alone (${CRAWLS_PER_MINUTE}/min):           ${crawlHours.toFixed(1)} h`);
console.log(`  cron slice, chain included (${CRON_BATCH_PER_MINUTE}/min): ${sliceHours.toFixed(1)} h`);
console.log(`  notBefore stagger (--hours):          ${HOURS} h`);
console.log(`  expected:                             ≈ ${drainHours.toFixed(1)} h`);

if (!QUEUE) {
  console.log(`\nNothing was queued (dry run). Pass --queue to queue the ${queueable}; --check --snapshot <file> to measure progress.`);
  process.exit(0);
}

// ══ --queue ════════════════════════════════════════════════════════════════
const rows = await db.$queryRawUnsafe(`
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
      BOOL_OR("rawValue" LIKE '%"via":"%') AS stamped_at_all,
      BOOL_OR(
        "normalizedValue" = 'http_404'
        AND "sourceUrl" ~* '^https?://[^/]+/(contact|services|about)/?$'
      ) AS probe_404
    FROM fetches
    GROUP BY "prospectId"
  )
  SELECT
    pp."prospectId" AS id,
    (p."assignedRepId" IS NOT NULL AND (p."claimExpiresAt" IS NULL OR p."claimExpiresAt" > NOW())) AS claimed
  FROM per_prospect pp
  JOIN "Prospect" p ON p.id = pp."prospectId"
  WHERE NOT pp.stamped_at_all AND pp.probe_404
    AND p."doNotContactAt" IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM "SalesPipelineTask" t
      WHERE t."prospectId" = pp."prospectId" AND t.kind = 'CRAWL_WEBSITE' AND t.status IN ('queued', 'claimed')
    )
  ORDER BY pp."prospectId"
`);
console.log(`\nqueueing ${rows.length} (after excluding do-not-contact and prospects with a crawl already queued)`);

// The before-picture, so --check can say what flipped. Written BEFORE the
// insert, so a crash between the two leaves a snapshot and no tasks rather
// than tasks and no snapshot.
const ids = rows.map((r) => r.id);
const snapshot = { takenAt: new Date().toISOString(), keyPrefix: KEY_PREFIX, ids, capabilities: {} };
for (let i = 0; i < ids.length; i += 2000) {
  const chunk = ids.slice(i, i + 2000);
  const caps = await db.prospectCapability.findMany({
    where: { prospectId: { in: chunk } },
    select: { prospectId: true, code: true, value: true },
  });
  for (const c of caps) {
    (snapshot.capabilities[c.prospectId] ||= {})[c.code] = c.value;
  }
}
writeFileSync(SNAPSHOT, JSON.stringify(snapshot));
console.log(`snapshot of ${Object.keys(snapshot.capabilities).length} prospects' capability rows → ${SNAPSHOT}`);

const now = Date.now();
const backlogRows = rows.filter((r) => !r.claimed);
const step = backlogRows.length > 1 ? (HOURS * 3600 * 1000) / (backlogRows.length - 1) : 0;
let backlogIndex = 0;
const data = rows.map((r) => {
  const claimedLane = r.claimed === true;
  const notBefore = claimedLane ? CLAIMED_NOT_BEFORE : new Date(now + Math.round(step * backlogIndex++));
  return {
    kind: "CRAWL_WEBSITE",
    prospectId: r.id,
    payload: claimedLane
      ? { prospectId: r.id, force: true, priority: "claimed" }
      : { prospectId: r.id, force: true, priority: "backlog", phrase: false },
    notBefore,
    idempotencyKey: `${KEY_PREFIX}${r.id}`,
  };
});

let created = 0;
for (let i = 0; i < data.length; i += 1000) {
  const res = await db.salesPipelineTask.createMany({ data: data.slice(i, i + 1000), skipDuplicates: true });
  created += res.count;
}
console.log(`tasks created: ${created} (${data.length - created} already existed under their key)`);
console.log(`  claimed lane, due now:  ${rows.length - backlogRows.length}`);
console.log(`  backlog lane, staggered over ${HOURS} h: ${backlogRows.length}`);
console.log(`\nRe-run with --check --snapshot ${SNAPSHOT} to measure progress.`);
process.exit(0);
