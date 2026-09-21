// lib/sales/intel/mapsScrapeStatus.js
//
// What the Google Maps scrape has landed in the database, for the platform
// console — read only, from ExternalListing and the $0 meter.
//
// ══ Why this reads the database and not the run ═══════════════════════════
//
// The scrape runs on the owner's Mac (scripts/scrape/maps.mjs). Its run log
// — events, the summary, the tiles it walked — lives under
// ~/Library/Application Support/fieldquo-scrape/runs/<runId>/ on that
// machine (scripts/scrape/lib/log.mjs RunLog), and production cannot read
// a file on a laptop. What production CAN see is what the run wrote through
// lib/sales/intel/listings.js applyListing: one ExternalListing row per
// place (source "google_maps", the runId, matchedProspectId when the rule
// accepted it) and one PlatformCostDaily row per day under provider
// "local_scrape" (meterLocalScrape — places read, at $0). So this file
// answers "what did the last run put in the database", never "what did
// the last run do": placesOpened, tilesSaturated and parseFailures are in
// the summary on the Mac and are not claimed here.
//
// ══ The runId bucket nobody meant ═════════════════════════════════════════
//
// listingRow() took a `runId` and did not write it until 2026-09-20, so the
// 4,239 rows from the first two nights carry null. They are reported as
// their own bucket — "rows with no run id" with their first and last
// createdAt — not folded into a run they did not record.
//
// ══ Why this exists at all ════════════════════════════════════════════════
//
// It replaced the Google Places panel. That panel counted API lookups the
// sales cron made per rep per hour and had a "Check Google" button per
// prospect; the API was retired on 2026-09-20 (lib/sales/intel/places.js's
// header), so the panel now says what the scrape landed, and there is no
// button, because nothing in production can start a scrape.
import { db as defaultDb } from "@/lib/db";
import { MAPS_SOURCE } from "./listings";

/** How many runs the panel lists, newest first. */
export const RUNS_SHOWN = 10;

/** The sentence every reader of this status prints. In one place so the
 *  panel and the check cannot say two different things. */
export const NEXT_SWEEP_SENTENCE = "The next sweep runs from the owner's Mac (scripts/scrape/maps.mjs); nothing here calls Google.";

function iso(d) {
  if (!d) return null;
  const at = d instanceof Date ? d : new Date(d);
  return Number.isNaN(at.getTime()) ? null : at.toISOString();
}

/**
 * Pure: fold the two groupBy reads into runs.
 *
 * @param all      groupBy runId over every google_maps row —
 *                 [{ runId, _count: { _all }, _min: { createdAt }, _max: { updatedAt, lastSeenAt } }]
 * @param matched  the same over rows with matchedProspectId set —
 *                 [{ runId, _count: { _all }, _max: { matchedAt } }]
 * @returns { runs: [...newest first, null bucket excluded], untagged | null, total }
 */
export function foldRuns(all = [], matched = []) {
  const matchedBy = new Map(matched.map((m) => [m.runId ?? null, m]));
  const rows = (Array.isArray(all) ? all : []).map((g) => {
    const m = matchedBy.get(g.runId ?? null);
    const count = Number(g._count?._all || 0);
    const matchedCount = Number(m?._count?._all || 0);
    return {
      runId: g.runId ?? null,
      rows: count,
      matched: matchedCount,
      unmatched: Math.max(0, count - matchedCount),
      firstAt: iso(g._min?.createdAt),
      lastAt: iso(g._max?.updatedAt),
      lastSeenAt: iso(g._max?.lastSeenAt),
      lastMatchedAt: iso(m?._max?.matchedAt),
    };
  });
  const untagged = rows.find((r) => r.runId === null) || null;
  const runs = rows
    .filter((r) => r.runId !== null)
    // Run ids are the start time (scripts/scrape/lib/log.mjs newRunId:
    // "20260920-013000Z"), so the newest sorts last; lastAt breaks a tie.
    .sort((a, b) => (a.runId < b.runId ? 1 : a.runId > b.runId ? -1 : (b.lastAt || "").localeCompare(a.lastAt || "")));
  const total = rows.reduce(
    (t, r) => ({
      rows: t.rows + r.rows,
      matched: t.matched + r.matched,
      unmatched: t.unmatched + r.unmatched,
      firstAt: !t.firstAt || (r.firstAt && r.firstAt < t.firstAt) ? r.firstAt : t.firstAt,
      lastAt: !t.lastAt || (r.lastAt && r.lastAt > t.lastAt) ? r.lastAt : t.lastAt,
    }),
    { rows: 0, matched: 0, unmatched: 0, firstAt: null, lastAt: null },
  );
  return { runs, untagged, total };
}

/**
 * @returns { latestRun, runs, untagged, total, metered: { places, days, lastAt }, nextSweep, asOf }
 */
export async function mapsScrapeStatus({ db = defaultDb, now = new Date(), runsShown = RUNS_SHOWN } = {}) {
  const [all, matched, meter] = await Promise.all([
    db.externalListing.groupBy({
      by: ["runId"],
      where: { source: MAPS_SOURCE },
      _count: { _all: true },
      _min: { createdAt: true },
      _max: { updatedAt: true, lastSeenAt: true },
    }),
    db.externalListing.groupBy({
      by: ["runId"],
      where: { source: MAPS_SOURCE, matchedProspectId: { not: null } },
      _count: { _all: true },
      _max: { matchedAt: true },
    }),
    db.platformCostDaily.aggregate({
      where: { provider: "local_scrape" },
      _sum: { count: true },
      _count: { _all: true },
      _max: { fetchedAt: true },
    }),
  ]);
  const folded = foldRuns(all, matched);
  return {
    latestRun: folded.runs[0] || null,
    runs: folded.runs.slice(0, runsShown),
    runCount: folded.runs.length,
    untagged: folded.untagged,
    total: folded.total,
    metered: { places: Number(meter?._sum?.count || 0), days: Number(meter?._count?._all || 0), lastAt: iso(meter?._max?.fetchedAt) },
    nextSweep: NEXT_SWEEP_SENTENCE,
    asOf: now.toISOString(),
  };
}

/** The column list the per-prospect card prints. `payload` is not sent:
 *  the card states the listing, it does not re-run the matcher. */
export const MATCHED_LISTING_SELECT = Object.freeze({
  id: true,
  externalId: true,
  name: true,
  addressLine: true,
  city: true,
  province: true,
  postalCode: true,
  phoneE164: true,
  websiteUrl: true,
  rating: true,
  reviewCount: true,
  businessStatus: true,
  matchVerdict: true,
  matchedAt: true,
  lastSeenAt: true,
  runId: true,
});

/** Every Maps listing the rule attached to one prospect, newest match first. */
export async function matchedMapsListings({ db = defaultDb, prospectId } = {}) {
  if (!prospectId) return [];
  const rows = await db.externalListing.findMany({
    where: { source: MAPS_SOURCE, matchedProspectId: prospectId },
    select: { ...MATCHED_LISTING_SELECT },
    orderBy: [{ matchedAt: "desc" }],
  });
  return rows.map((r) => ({
    ...r,
    matchedAt: iso(r.matchedAt),
    lastSeenAt: iso(r.lastSeenAt),
    mapsUrl: r.externalId && !r.externalId.startsWith("cid:") ? `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(r.externalId)}` : null,
  }));
}
