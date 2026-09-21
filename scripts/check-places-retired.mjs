// scripts/check-places-retired.mjs
//
//   npm run check:places-retired
//
// The Google Places API is retired from the sales pipeline, and stays
// retired.
//
// ══ Why this exists ═══════════════════════════════════════════════════════
//
// The owner's rule of 2026-09-18: Google data is scraped from his Mac
// (scripts/scrape/maps.mjs → ExternalListing rows, source "google_maps" →
// lib/sales/intel/listings.js matches them to prospects). "API keys never
// involved." The Places sweep built before that rule — a Text Search per
// held prospect from the sales cron every minute, a claim-time after() in
// the queue route, a "Check Google" button per prospect — had been refused
// on every request since 2026-09-18T11:48Z: 9,181 PlatformErrorLog rows,
// area "places", code PERMISSION_DENIED. It was removed on 2026-09-20, and
// this script is what keeps a later change from putting a Google call back
// under lib/sales, the sales routes or the cron without noticing.
//
// ══ Executed, not read ════════════════════════════════════════════════════
//
// The one-off that marks the refusal rows reviewed runs here against a
// fake client: the first call stamps every unresolved row that matches the
// exact WHERE and writes one audit row; the second call matches nothing
// and writes nothing. The Maps status fold runs over fixtures, including
// the null-runId bucket the first two nights left behind. listingRow is
// executed to prove it now writes the run id it always took.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

import { PLACES_RETIRED_NOTE, PLACES_RETIRED_REVIEWER, PLACES_RETIRED_WHERE, REVIEW_NOTE_MAX, retirePlacesRefusals } from "@/lib/platform/errorLog";
import { NEXT_SWEEP_SENTENCE, foldRuns, mapsScrapeStatus, matchedMapsListings } from "@/lib/sales/intel/mapsScrapeStatus";
import { listingRow } from "@/lib/sales/intel/listings";
import { enrichmentSweepStatus } from "@/lib/sales/intel/enrichmentSweep";
import { buildSections } from "@/lib/platform/costs/sections";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) { pass += 1; console.log(`  ok   ${name}`); }
  else { failures.push(name); console.log(`  FAIL ${name}${got !== undefined ? `  — got: ${JSON.stringify(got)}` : ""}`); }
}
const section = (t) => console.log(`\n${t}\n`);

/** Every .js/.mjs file under a directory, recursively. */
function walk(dir, out = []) {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return out;
  for (const name of readdirSync(abs)) {
    const p = join(abs, name);
    if (statSync(p).isDirectory()) walk(join(dir, name), out);
    else if (/\.(js|mjs)$/.test(name)) out.push(relative(ROOT, p));
  }
  return out;
}

/** The file with its comment lines removed: `//` lines, and the lines of a
 *  block comment. A URL in a comment is a URL in prose; a URL in code is a
 *  call. */
function codeOnly(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*)/.test(line))
    .join("\n");
}

// ═══════════════════════════════════════════════════════════════════════════
section("1. No Google API call under the sales pipeline");
// ═══════════════════════════════════════════════════════════════════════════
{
  const dirs = ["lib/sales", "app/api/sales", "app/api/cron", "app/api/platform/sales"];
  const files = dirs.flatMap((d) => walk(d));
  ok("the four trees exist and hold code", files.length > 100, files.length);
  const hits = files.filter((f) => /places\.googleapis\.com|maps\.googleapis\.com\/maps\/api\/place/.test(codeOnly(read(f))));
  ok("no file under lib/sales, app/api/sales, app/api/cron or app/api/platform/sales names the Places endpoint outside a comment", hits.length === 0, hits);
  const sweepImports = [...walk("lib"), ...walk("app"), ...walk("scripts")].filter((f) => /placesSweep/.test(codeOnly(read(f))) && f !== "scripts/check-places-retired.mjs");
  ok("nothing imports placesSweep", sweepImports.length === 0, sweepImports);
  ok("the sweep file is gone", !existsSync(join(ROOT, "lib/sales/intel/placesSweep.js")));
  ok("the enrich route is gone", !existsSync(join(ROOT, "app/api/platform/sales/prospects/enrich/route.js")));
  ok("the Places panel is gone", !existsSync(join(ROOT, "app/components/platform/GooglePlacesPanel.js")));
  const places = read("lib/sales/intel/places.js");
  ok("places.js keeps the rule and the write plan and nothing that fetches", /export function matchPlaces/.test(places) && /export function planPlacesWrite/.test(places) && !/searchPlaces|checkPlaces|enrichProspects|meterPlacesRequest|heldProspectIds|enableInstructions|fetchImpl|serverMapsKey/.test(codeOnly(places)));
  ok("…and its header says what happened and why", /retired/.test(places) && /owner's Mac/.test(places) && /PERMISSION_DENIED/.test(places) && /scripts\/scrape\/maps\.mjs/.test(places));
  const listings = read("lib/sales/intel/listings.js");
  const listingMatch = read("lib/sales/intel/listingMatch.js");
  ok("listings.js and listingMatch.js still import the rule from places.js", /from "\.\/places"/.test(listings) && /from "\.\/places"/.test(listingMatch));
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. The cron: no sweep, one resolver");
// ═══════════════════════════════════════════════════════════════════════════
{
  const cron = read("app/api/cron/sales-pipeline/route.js");
  const code = codeOnly(cron);
  ok("the cron result has no `places` sweep key", !/result\.places\s*=/.test(code) && !/sweepQueuedPlaces/.test(code));
  ok("the cron calls the resolver in its own try/catch and reports its count", /placesRetired = await retirePlacesRefusals\(\{ db, now \}\)/.test(cron) && /result\.placesRetired = placesRetired/.test(cron) && /catch \(err\) \{\s*placesRetired = \{ error/.test(cron));
  ok("the register sweep still runs, from enrichmentSweep.js", /sweepRegisterPeople\(\{ db, now \}\)/.test(cron) && /from "@\/lib\/sales\/intel\/enrichmentSweep"/.test(cron));
  ok("…and the cron says why the sweep is gone", /owner's rule/.test(cron) && /9,181/.test(cron));

  const errorLog = read("lib/platform/errorLog.js");
  ok("the resolver's WHERE is exactly area = places, code = PERMISSION_DENIED, resolvedAt IS NULL",
    JSON.stringify(PLACES_RETIRED_WHERE) === JSON.stringify({ area: "places", code: "PERMISSION_DENIED", resolvedAt: null }) && /where: \{ \.\.\.PLACES_RETIRED_WHERE \}/.test(errorLog), PLACES_RETIRED_WHERE);
  ok("…which the (area, createdAt) index serves by its prefix", /@@index\(\[area, createdAt\]\)/.test(read("prisma/schema.prisma")));
  ok("the note fits the review helper's limit and names the date, the Mac and the refusals", PLACES_RETIRED_NOTE.length <= REVIEW_NOTE_MAX && /2026-09-20/.test(PLACES_RETIRED_NOTE) && /scripts\/scrape\/maps\.mjs/.test(PLACES_RETIRED_NOTE) && /refused, every minute, from 2026-09-18/.test(PLACES_RETIRED_NOTE), PLACES_RETIRED_NOTE.length);
  ok("the reviewer is a system name the errors screen prints as written", PLACES_RETIRED_REVIEWER === "system:places-retired" && /reviewerById\.get\(e\.resolvedBy\) \|\| e\.resolvedBy/.test(read("app/api/platform/errors/route.js")));

  // Executed: a fake client with three rows — two the WHERE matches, one
  // reviewed already, one under another code.
  const rows = [
    { id: "a", area: "places", code: "PERMISSION_DENIED", resolvedAt: null },
    { id: "b", area: "places", code: "PERMISSION_DENIED", resolvedAt: null },
    { id: "c", area: "places", code: "PERMISSION_DENIED", resolvedAt: new Date("2026-09-19T00:00:00Z"), resolvedBy: "admin_1" },
    { id: "d", area: "places", code: "research_not_queued", resolvedAt: null },
  ];
  const audits = [];
  const matches = (row, where) => Object.entries(where).every(([k, v]) => row[k] === v);
  const fake = {
    platformErrorLog: {
      async updateMany({ where, data }) {
        const hit = rows.filter((r) => matches(r, where));
        for (const r of hit) Object.assign(r, data);
        return { count: hit.length };
      },
    },
    platformAuditLog: { async create({ data }) { audits.push(data); return data; } },
    async $transaction(fn) { return fn(fake); },
  };
  const now = new Date("2026-09-20T02:00:00Z");
  const first = await retirePlacesRefusals({ db: fake, now });
  ok("the first run stamps exactly the unresolved PERMISSION_DENIED rows", first.count === 2 && rows[0].resolvedBy === "system:places-retired" && rows[1].resolvedNote === PLACES_RETIRED_NOTE && rows[0].resolvedAt === now, rows);
  ok("…a row a person reviewed keeps their review", rows[2].resolvedBy === "admin_1");
  ok("…a 'places' row under another code is left for a person", rows[3].resolvedAt === null);
  ok("…and ONE audit row names the system actor and the count, with no admin id", audits.length === 1 && audits[0].platformAdminId === null && audits[0].action === "error_reviewed" && audits[0].details.count === 2 && audits[0].details.by === "system:places-retired", audits);
  const second = await retirePlacesRefusals({ db: fake, now: new Date("2026-09-20T02:01:00Z") });
  ok("the second run is a no-op: count 0, no audit row", second.count === 0 && audits.length === 1, second);
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. The claim route asks Google nothing");
// ═══════════════════════════════════════════════════════════════════════════
{
  const queue = read("app/api/sales/queue/route.js");
  const code = codeOnly(queue);
  ok("no Places after(): no enrichProspects, no placesCheckedAt filter, no places import", !/enrichProspects|placesCheckedAt|from "@\/lib\/sales\/intel\/places"/.test(code));
  ok("the register lookup still rides after() and reports its own errors under area people", /after\(async \(\) => \{/.test(code) && /lookupRegisterPeopleFor\(\{ db, ids: held/.test(code) && /area: "people"/.test(code) && !/area: "places"/.test(code));
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. The panel reads the Mac scrape's rows and offers no button");
// ═══════════════════════════════════════════════════════════════════════════
{
  const panel = read("app/components/platform/MapsScrapePanel.js");
  ok("the panel carries the sentence, identical to the status module's", panel.includes(NEXT_SWEEP_SENTENCE) && /runs from the owner's Mac/.test(NEXT_SWEEP_SENTENCE) && /nothing here calls Google/.test(NEXT_SWEEP_SENTENCE));
  ok("…and says in its comment that it can only show what is in the database", /Only what is IN the database/.test(panel) && /production cannot read a laptop/.test(panel));
  ok("it fetches the maps-scrape route and nothing else", /fetchJson\("\/api\/platform\/sales\/prospects\/maps-scrape"\)/.test(panel) && !/prospects\/enrich["'`]/.test(panel) && !/method: "POST"/.test(panel));
  const panelCode = codeOnly(panel);
  ok("the only button is Refresh — no Check Google, no scope: held", (panelCode.match(/<button/g) || []).length === 1 && /Refresh/.test(panelCode) && !/Check Google/.test(panelCode) && !/scope: "held"/.test(panelCode));
  ok("the per-prospect card is read-only and says when a match happens", /export function MapsListingCard/.test(panel) && /No Maps listing matched yet — matched when the owner(&apos;|')s Mac runs the scrape/.test(panel) && !/onClick/.test(panel.slice(panel.indexOf("export function MapsListingCard"))));
  const page = read("app/platform/sales/prospects/page.js");
  ok("the prospects page mounts both behind the superadmin gate", /isSuperadmin \? <MapsScrapePanel \/> : null/.test(page) && /<MapsListingCard prospect=\{p\} \/>/.test(page) && !/GooglePlaces/.test(page));
  const route = read("app/api/platform/sales/prospects/maps-scrape/route.js");
  ok("the route is GET-only and superadmin-gated", /export async function GET/.test(route) && !/export async function POST/.test(route) && /superadminOrRefusal/.test(route));
  const detail = read("app/api/platform/sales/prospects/[id]/route.js");
  ok("the detail route sends the prospect's matched listings", /matchedMapsListings\(\{ db, prospectId: prospect\.id \}\)/.test(detail) && /mapsListings,/.test(detail));
  const enrichment = read("app/api/platform/sales/prospects/enrichment/route.js");
  const enrichmentPanel = read("app/components/platform/EnrichmentPanel.js");
  ok("the enrichment console lost the Places cap — no placesAhead setting, no input", !/placesAhead|PLACES_AHEAD/.test(codeOnly(enrichment)) && !/placesAhead|Google ahead per hour/.test(codeOnly(enrichmentPanel)) && /from "@\/lib\/sales\/intel\/enrichmentSweep"/.test(enrichment));
  ok("…and reads the Maps column the status now reports", /sources\.maps\?\.ahead/.test(enrichmentPanel) && /claimed\.maps/.test(enrichmentPanel));
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The status fold, executed — and the run id the scrape now writes");
// ═══════════════════════════════════════════════════════════════════════════
{
  const all = [
    { runId: null, _count: { _all: 4239 }, _min: { createdAt: new Date("2026-09-18T04:05:47Z") }, _max: { updatedAt: new Date("2026-09-19T23:25:19Z"), lastSeenAt: new Date("2026-09-19T23:25:19Z") } },
    { runId: "20260920-020000Z", _count: { _all: 120 }, _min: { createdAt: new Date("2026-09-20T02:01:00Z") }, _max: { updatedAt: new Date("2026-09-20T03:00:00Z"), lastSeenAt: new Date("2026-09-20T03:00:00Z") } },
    { runId: "20260920-010000Z", _count: { _all: 80 }, _min: { createdAt: new Date("2026-09-20T01:01:00Z") }, _max: { updatedAt: new Date("2026-09-20T01:50:00Z"), lastSeenAt: new Date("2026-09-20T01:50:00Z") } },
  ];
  const matched = [
    { runId: null, _count: { _all: 1551 }, _max: { matchedAt: new Date("2026-09-19T23:00:00Z") } },
    { runId: "20260920-020000Z", _count: { _all: 45 }, _max: { matchedAt: new Date("2026-09-20T02:59:00Z") } },
  ];
  const f = foldRuns(all, matched);
  ok("the latest run is the newest run id, with rows, matched and unmatched", f.runs[0].runId === "20260920-020000Z" && f.runs[0].rows === 120 && f.runs[0].matched === 45 && f.runs[0].unmatched === 75 && f.runs[0].firstAt === "2026-09-20T02:01:00.000Z" && f.runs[0].lastAt === "2026-09-20T03:00:00.000Z", f.runs[0]);
  ok("a run with no matches reads 0 matched, all unmatched", f.runs[1].runId === "20260920-010000Z" && f.runs[1].matched === 0 && f.runs[1].unmatched === 80);
  ok("the null-runId rows are their own bucket, never a run", f.untagged && f.untagged.rows === 4239 && f.untagged.matched === 1551 && f.untagged.unmatched === 2688 && f.runs.every((r) => r.runId !== null), f.untagged);
  ok("the total spans every bucket", f.total.rows === 4439 && f.total.matched === 1596 && f.total.firstAt === "2026-09-18T04:05:47.000Z" && f.total.lastAt === "2026-09-20T03:00:00.000Z", f.total);
  ok("nothing at all is an empty, honest shape", JSON.stringify(foldRuns([], [])) === JSON.stringify({ runs: [], untagged: null, total: { rows: 0, matched: 0, unmatched: 0, firstAt: null, lastAt: null } }));

  // Through the reader, against a fake client: the meter rides along.
  const calls = [];
  const fake = {
    externalListing: {
      async groupBy(args) { calls.push(args); return args.where.matchedProspectId ? matched : all; },
      async findMany({ where, select, orderBy }) {
        calls.push({ where, select, orderBy });
        return where.matchedProspectId === "p1" ? [{ id: "l1", externalId: "ChIJx", name: "AMS Plumbing", addressLine: "1 Main", city: "Lakeside", province: "CA", postalCode: "92040", phoneE164: "+16198478330", websiteUrl: "https://ams.example", rating: "4.8", reviewCount: 12, businessStatus: "OPERATIONAL", matchVerdict: "matched", matchedAt: new Date("2026-09-19T20:00:00Z"), lastSeenAt: new Date("2026-09-19T20:00:00Z"), runId: null }] : [];
      },
    },
    platformCostDaily: { async aggregate() { return { _sum: { count: 6348 }, _count: { _all: 2 }, _max: { fetchedAt: new Date("2026-09-19T23:25:25Z") } }; } },
  };
  const status = await mapsScrapeStatus({ db: fake, now: new Date("2026-09-20T04:00:00Z") });
  ok("the status groups google_maps rows by runId, twice, and sums the $0 meter", calls[0].where.source === "google_maps" && calls[0].by[0] === "runId" && calls[1].where.matchedProspectId.not === null && status.metered.places === 6348 && status.metered.days === 2 && status.latestRun.runId === "20260920-020000Z" && status.nextSweep === NEXT_SWEEP_SENTENCE, status.metered);
  const listings = await matchedMapsListings({ db: fake, prospectId: "p1" });
  ok("a prospect's matched listings come back with name, address, phone, rating, when and the run", listings.length === 1 && listings[0].name === "AMS Plumbing" && listings[0].phoneE164 === "+16198478330" && listings[0].rating === "4.8" && listings[0].matchedAt === "2026-09-19T20:00:00.000Z" && listings[0].runId === null && /place_id:ChIJx/.test(listings[0].mapsUrl), listings[0]);
  ok("…scoped to google_maps rows matched to that id, and payload is not sent", calls.at(-1).where.source === "google_maps" && calls.at(-1).where.matchedProspectId === "p1" && !calls.at(-1).select.payload);
  ok("nobody's listings is an empty list, no read", (await matchedMapsListings({ db: fake, prospectId: null })).length === 0);

  // listingRow writes the run id — on create and on a later sighting.
  const listing = { placeId: "ChIJx", name: "AMS Plumbing", phoneE164: "+16198478330", hours: [], starHistogram: null };
  const row = listingRow(listing, { now: new Date("2026-09-20T02:30:00Z"), runId: "20260920-020000Z", verdict: "matched", matchedProspectId: "p1" });
  ok("listingRow writes the run id on create AND update — the column the first two nights left null", row.create.runId === "20260920-020000Z" && row.update.runId === "20260920-020000Z" && row.create.matchedProspectId === "p1", { create: row.create.runId, update: row.update.runId });
  ok("…and with no run id it writes nothing, rather than null over an earlier run", !("runId" in listingRow(listing, { now: new Date() }).update));

  // The enrichment status reports Maps as a stamp, not a pass.
  const orders = [];
  const orderDb = { prospect: { async findMany() { return []; } }, salesQueueClaim: { async findMany() { return []; } }, salesClaimLog: { async findMany() { return []; } } };
  const es = await enrichmentSweepStatus({ db: new Proxy(orderDb, { get: (t, k) => (k in t ? t[k] : { findMany: async () => [], count: async () => 0, groupBy: async () => [] }) }) }).catch((err) => ({ error: err.message }));
  ok("enrichmentSweepStatus answers with maps / people / bbb and no Places cap", !es.error && "maps" in es.claimed && "people" in es.claimed && "bbb" in es.claimed && !("placesAheadPerHour" in es) && !("placesAheadSettingKey" in es), es);
  void orders;
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. Costs: the Places line is history, not a live provider");
// ═══════════════════════════════════════════════════════════════════════════
{
  const summary = read("lib/platform/costs/summary.js");
  ok("the summary passes the Places line only for a period that holds the retired rows", /const placesLine = placesRows\.length \? places : null/.test(summary) && /places: placesLine/.test(summary));
  const withRows = buildSections({ places: { cents: 416.5, requests: 119, source: "s", asOf: new Date() }, localScrape: { cents: 0, places: 6348, source: "s", asOf: new Date() }, charged: { byKind: {} }, fixed: { byProvider: [] } });
  const line = withRows.sections.sales.lines.find((l) => l.key === "google_places");
  ok("a period with the September rows prints them as retired, at their cost", line && /retired 2026-09-20/.test(line.label) && line.cents === 416.5 && /nothing calls it now/.test(line.note), line);
  const without = buildSections({ places: null, localScrape: { cents: 0, places: 6348, source: "s", asOf: new Date() }, charged: { byKind: {} }, fixed: { byProvider: [] } });
  ok("a period without them prints no Places line, and the Mac's $0 line stays", !without.sections.sales.lines.some((l) => l.key === "google_places") && without.sections.sales.lines.some((l) => l.key === "local_scrape" && l.count === 6348));
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. Registered");
// ═══════════════════════════════════════════════════════════════════════════
{
  const pkg = JSON.parse(read("package.json"));
  ok("check:places-retired is a script and check:all runs it", typeof pkg.scripts?.["check:places-retired"] === "string" && (pkg.scripts?.["check:all"] || "").includes("check:places-retired"));
  ok("the roadmap says the sweep was retired and why", /Places[\s\S]{0,200}retired/i.test(read("docs/ROADMAP.md")) && /owner's Mac/.test(read("docs/ROADMAP.md")));
}

console.log(`\n${failures.length === 0 ? "PASS" : "FAIL"} — ${pass} checks passed, ${failures.length} failed.`);
if (failures.length) process.exit(1);
