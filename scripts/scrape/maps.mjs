// scripts/scrape/maps.mjs
//
// Google Maps, read from the owner's Mac, into the prospect tables.
//
//   npm run scrape:maps -- --term "plumber" --location "Lakeside, CA" --country US --max-per-term 20
//   npm run scrape:maps -- --from-order --pairs 20
//   npm run scrape:maps -- --plan --from-order --pairs 20
//   npm run scrape:maps -- --resume
//
// docs/sales/SCRAPE-LOCAL-RUN.md has the whole of it. In short: one real
// Chrome, visible, a human pause between every action, one search per
// (term, location), the results feed scrolled to Google's own "end of the
// list" sentence or the ~120-place boundary, each place opened once, the
// record handed to lib/sales/intel/listings.js — which matches it to a
// Prospect with the Places rule and fills BLANKS ONLY, or keeps it as an
// ExternalListing prospect-in-waiting — and the count metered at $0 onto
// /platform/costs. A challenge page stops the run; --resume carries on.
//
// Modelled on apify.com/compass/crawler-google-places (its readme, read
// 2026-09-17): the same inputs (terms × a location, a per-term cap, an
// output language), the same technique (drive the Maps UI, scroll the
// feed, open the detail page, dedupe by place id across terms), and the
// same answer to a broad area — tile it into viewports and merge (see
// scripts/scrape/lib/geo.mjs). Reviews, reviewer names and images are
// deliberately not read: nothing the sales pipeline uses, and personal
// data we would then hold.
import fs from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
import { applyListing, enrichmentPairs, meterLocalScrape, searchTermForTrade } from "@/lib/sales/intel/listings";
import { ChallengeError, guardPage, launchBrowser, visit, wander, wheelIn } from "./lib/browser.mjs";
import { FEED_BOUNDARY, boundsFromMapsUrl, geocodeBounds, planViewports, regionBounds, subdivide, textSearchUrl, tileSearchUrl, DEFAULT_TILE_ZOOM } from "./lib/geo.mjs";
import { RunLog, emptySummary, latestRunId, newRunId, progressFrom } from "./lib/log.mjs";
import { assembleRecord, dedupeFeed, extractDetailInPage, markersFor, readFeedInPage } from "./lib/mapsParse.mjs";
import { humanPause } from "./lib/pace.mjs";

// ── Arguments ────────────────────────────────────────────────────────────

export function parseArgs(argv) {
  const args = {
    terms: [],
    locations: [],
    countries: [],
    fromOrder: false,
    pairs: 20,
    maxPerTerm: 120,
    headless: false,
    plan: false,
    resume: null,
    lang: "en",
    zoom: DEFAULT_TILE_ZOOM,
    mode: null,
    dry: false,
    saveHtml: null,
    maxTiles: 400,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === "--term") args.terms.push(next());
    else if (a === "--location") args.locations.push(next());
    else if (a === "--country") args.countries.push(String(next() || "").toUpperCase());
    else if (a === "--from-order") args.fromOrder = true;
    else if (a === "--pairs") args.pairs = Math.max(1, Number(next()) || 20);
    else if (a === "--max-per-term") args.maxPerTerm = Math.max(1, Number(next()) || 120);
    else if (a === "--headless") args.headless = true;
    else if (a === "--plan") args.plan = true;
    else if (a === "--resume") args.resume = argv[i + 1] && !argv[i + 1].startsWith("--") ? next() : "latest";
    else if (a === "--lang") args.lang = ["en", "fr", "es"].includes(argv[i + 1]) ? next() : "en";
    else if (a === "--zoom") args.zoom = Math.min(17, Math.max(10, Number(next()) || DEFAULT_TILE_ZOOM));
    else if (a === "--single") args.mode = "single";
    else if (a === "--tiles") args.mode = "tiles";
    else if (a === "--dry") args.dry = true;
    else if (a === "--save-html") args.saveHtml = next();
    else if (a === "--max-tiles") args.maxTiles = Math.max(1, Number(next()) || 400);
    else if (a === "--help" || a === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  return args;
}

/** (term, location, country) triples from the repeatable flags. A single
 *  --country applies to every pair; otherwise they zip. */
export function pairsFromArgs(args) {
  if (!args.terms.length || !args.locations.length) return [];
  const n = Math.max(args.terms.length, args.locations.length);
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const term = args.terms[Math.min(i, args.terms.length - 1)];
    const location = args.locations[Math.min(i, args.locations.length - 1)];
    const country = args.countries.length === 1 ? args.countries[0] : args.countries[i] || "US";
    if (args.terms.length > 1 && args.locations.length > 1 && args.terms.length !== args.locations.length) {
      // Unequal lists: every term in every location.
      for (const t of args.terms) for (const l of args.locations) out.push({ term: t, location: l, country, reason: "args" });
      return dedupePairs(out);
    }
    out.push({ term, location, country, reason: "args" });
  }
  return dedupePairs(out);
}

function dedupePairs(pairs) {
  const seen = new Set();
  return pairs.filter((p) => {
    const k = pairKeyOf(p);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function pairKeyOf(p) {
  return `${String(p.term).toLowerCase()}|${String(p.location).toLowerCase()}|${p.country || ""}`;
}

function usage() {
  return `Google Maps scrape — runs on this Mac, feeds the prospect tables.

  --term "plumber" --location "Lakeside, CA" --country US   (repeatable)
  --from-order --pairs 20        pairs from the enrichment order (held leads' trade × city)
  --max-per-term 120             places opened per (term, location)
  --headless                     no window (visible by default)
  --plan                         print the pairs and viewport plan, open no browser
  --resume [runId]               carry on from a stopped run (latest by default)
  --lang en|fr|es                Maps' language (hours and categories come back in it)
  --zoom 14                      tile zoom for a broad location (14 ≈ 7 km viewports)
  --single | --tiles             force one search / a grid (auto: grid above 12 km)
  --dry                          parse and match, write nothing
  --save-html DIR                keep each detail panel's HTML (fixtures)
`;
}

// ── One tile's feed ──────────────────────────────────────────────────────

/** Scroll the results feed until Google says it ended, the cap is reached,
 *  or nothing new appears after four scrolls. */
async function collectFeed(page, { markers, max, log }) {
  let last = -1;
  let stalls = 0;
  let passes = 0;
  let result = await page.evaluate(readFeedInPage, markers);
  while (!result.ended && result.count < max && passes < 60) {
    if (result.count === last) {
      stalls += 1;
      if (stalls >= 4) break;
    } else {
      stalls = 0;
    }
    last = result.count;
    const feed = page.locator('div[role="feed"]').first();
    if (!(await feed.count())) break;
    await wheelIn(page, feed);
    await humanPause(2000, 4500);
    await wander(page);
    await guardPage(page, { log });
    passes += 1;
    result = await page.evaluate(readFeedInPage, markers);
  }
  return { ...result, links: dedupeFeed(result.links), passes };
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return 0;
  }

  // Pairs.
  let pairs = pairsFromArgs(args);
  if (args.fromOrder) {
    const ordered = await enrichmentPairs({ db, limit: args.pairs });
    pairs = dedupePairs([...pairs, ...ordered]);
  }
  if (!pairs.length) {
    console.log(usage());
    console.error("Nothing to search: give --term/--location or --from-order.");
    return 1;
  }

  if (args.plan) {
    console.log(`${pairs.length} pair(s):`);
    for (const p of pairs) {
      const region = regionBounds(p.location);
      const geo = region ? { bounds: region, via: "table" } : await geocodeBounds(p.location, { region: p.country });
      const plan = planViewports({ location: p.location, bounds: geo?.bounds || null, zoom: args.zoom, force: args.mode });
      const held = p.held ? ` · ${p.held} held` : "";
      const how = plan.mode === "single" ? `one search "${p.term} in ${p.location}"` : `${plan.tiles.length} viewports at ${args.zoom}z over ${plan.diagonalKm} km`;
      console.log(`  ${p.term.padEnd(28)} ${p.location.padEnd(28)} ${p.country}${held} — ${how}${geo ? ` (bounds via ${geo.via})` : " (no bounds yet — the browser will frame it)"}`);
    }
    return 0;
  }

  // Run identity and resume.
  const runId = args.resume ? (args.resume === "latest" ? latestRunId() : args.resume) : newRunId();
  if (args.resume && !runId) {
    console.error("Nothing to resume.");
    return 1;
  }
  const log = new RunLog(runId);
  const progress = progressFrom(log.replay());
  const summary = emptySummary(runId, args);
  if (args.resume) {
    summary.notes.push(`resumed: ${progress.places.size} places and ${progress.tilesDone.size} tiles already done`);
  }
  log.event("run_start", { args, pairs: pairs.map(pairKeyOf), resumed: Boolean(args.resume) });
  console.log(`Run ${runId} — ${pairs.length} pair(s), max ${args.maxPerTerm} per term, ${args.headless ? "headless" : "visible"}${args.dry ? ", DRY (no writes)" : ""}`);
  console.log(`Log: ${log.file}`);

  const markers = markersFor(args.lang);
  const seen = new Set(progress.places.keys());
  let parsedThisSession = 0;
  const { context, page } = await launchBrowser({ headless: args.headless, lang: args.lang });
  const checkpoint = () => log.writeSummary({ ...summary, placesSeenTotal: seen.size });

  try {
    for (const pair of pairs) {
      const pairKey = pairKeyOf(pair);
      if (progress.pairsDone.has(pairKey)) continue;
      summary.pairs += 1;
      log.event("pair_start", { pairKey, ...pair });
      console.log(`\n▶ ${pair.term} — ${pair.location} (${pair.country})`);

      // Bounds: the table, the geocoder, or the map itself.
      let geo = regionBounds(pair.location) ? { bounds: regionBounds(pair.location), via: "table" } : null;
      if (!geo && args.mode !== "single") geo = await geocodeBounds(pair.location, { region: pair.country });
      if (!geo && args.mode !== "single") {
        await visit(page, `https://www.google.com/maps/place/${encodeURIComponent(pair.location).replace(/%20/g, "+")}?hl=${args.lang}`, { log });
        geo = boundsFromMapsUrl(page.url());
      }
      const plan = planViewports({ location: pair.location, bounds: geo?.bounds || null, zoom: args.zoom, force: args.mode });
      log.event("plan", { pairKey, mode: plan.mode, tiles: plan.tiles.length, diagonalKm: plan.diagonalKm, boundsVia: geo?.via || null });
      console.log(plan.mode === "single" ? `  one search, "${pair.term} in ${pair.location}"` : `  ${plan.tiles.length} viewports at ${args.zoom}z (${plan.diagonalKm} km across, bounds via ${geo.via})`);

      const queue = plan.mode === "single" ? [null] : [...plan.tiles];
      let openedForPair = [...progress.places.values()].filter((e) => e.pairKey === pairKey).length;
      let tilesVisited = 0;

      while (queue.length && openedForPair < args.maxPerTerm && tilesVisited < args.maxTiles) {
        const tile = queue.shift();
        const tileKey = `${pairKey}|${tile ? tile.key : "single"}`;
        if (progress.tilesDone.has(tileKey)) continue;
        tilesVisited += 1;
        summary.tiles += 1;

        const url = tile ? tileSearchUrl(pair.term, tile, { lang: args.lang }) : textSearchUrl(pair.term, pair.location, { lang: args.lang });
        await visit(page, url, { log });
        // A search that names one business lands on its detail page with
        // no feed at all — that page is the one result.
        const feed = /\/maps\/place\//.test(page.url())
          ? { links: dedupeFeed([{ href: page.url(), label: "" }]), ended: true, noResults: false, hasFeed: false, passes: 0, count: 1 }
          : await collectFeed(page, { markers, max: Math.max(args.maxPerTerm, FEED_BOUNDARY), log });
        summary.feedLinks += feed.links.length;
        const saturated = !feed.ended && feed.links.length >= FEED_BOUNDARY;
        if (!feed.links.length) summary.tilesEmpty += 1;
        log.event("feed", { tileKey, url: page.url(), count: feed.links.length, ended: feed.ended, noResults: feed.noResults, saturated, passes: feed.passes, hasFeed: feed.hasFeed, listed: feed.links.map((l) => ({ id: l.placeId || l.cid, name: l.label })) });
        console.log(`  ${tile ? `tile ${tile.key}` : "feed"}: ${feed.links.length} places${feed.ended ? " (end of list)" : saturated ? " (at the boundary — will subdivide)" : ""}`);

        for (const link of feed.links) {
          if (openedForPair >= args.maxPerTerm) break;
          const key = link.placeId || link.cid;
          if (!key) continue;
          if (seen.has(key)) {
            summary.placesSkippedSeen += 1;
            if (!progress.places.has(key)) summary.dedupedAcrossTerms += 1;
            continue;
          }
          openedForPair += 1;
          summary.placesOpened += 1;

          await visit(page, link.href, { log });
          const html = await page.content();
          const detail = await page.evaluate(extractDetailInPage, markers);
          const record = assembleRecord({ detail, link, finalUrl: page.url(), html, term: pair.term, location: pair.location, tile });
          const placeKey = record.placeId || key;
          seen.add(placeKey);
          seen.add(key);
          if (args.saveHtml) {
            fs.mkdirSync(args.saveHtml, { recursive: true });
            const main = await page.evaluate(() => document.querySelector('div[role="main"]')?.outerHTML || "");
            fs.writeFileSync(path.join(args.saveHtml, `${placeKey.replace(/[^A-Za-z0-9_-]/g, "_")}.html`), `<!-- ${page.url()} -->\n${main}`);
          }
          if (!record.loaded) {
            summary.parseFailures += 1;
            log.event("place", { placeId: placeKey, pairKey, tileKey, loaded: false, url: page.url(), name: record.name });
            console.log(`    ? ${record.name || link.label || placeKey} — panel did not load a detail page`);
            await humanPause();
            continue;
          }
          summary.placesParsed += 1;
          parsedThisSession += 1;
          log.event("place", { placeId: placeKey, pairKey, tileKey, loaded: true, ...record });

          let write;
          try {
            write = await applyListing({ db, raw: { ...record, country: pair.country }, runId, dry: args.dry });
          } catch (err) {
            write = { verdict: "error", error: err?.message || String(err) };
            summary.written.errors += 1;
          }
          tally(summary, write);
          log.event("write", { placeId: placeKey, verdict: write.verdict, prospectId: write.prospectId || null, gained: write.gained || [], conflicts: write.conflicts || [], newLeadLike: write.newLeadLike || false, error: write.error || null });
          console.log(`    ${verdictMark(write.verdict)} ${record.name}${record.category ? ` · ${record.category}` : ""}${record.phone ? ` · ${record.phone}` : ""}${record.websiteUrl ? ` · ${hostOf(record.websiteUrl)}` : ""}${record.businessStatus && record.businessStatus !== "OPERATIONAL" ? ` · ${record.businessStatus}` : ""} → ${describeWrite(write)}`);
          checkpoint();
          await humanPause();
          await wander(page);
        }

        if (saturated && tile && openedForPair < args.maxPerTerm) {
          const children = subdivide(tile);
          if (children.length) {
            summary.tilesSaturated += 1;
            queue.unshift(...children);
          }
        }
        log.event("tile_done", { tileKey, saturated, count: feed.links.length });
        checkpoint();
      }
      if (openedForPair >= args.maxPerTerm) summary.notes.push(`${pairKey}: stopped at --max-per-term ${args.maxPerTerm}`);
      log.event("pair_done", { pairKey, opened: openedForPair });
      checkpoint();
    }
  } catch (err) {
    if (err instanceof ChallengeError) {
      summary.stopped = { kind: err.kind, url: err.url, message: err.message };
      console.error(`\n■ ${err.message}`);
    } else {
      summary.stopped = { kind: "error", message: err?.message || String(err) };
      console.error("\n■ Stopped:", err?.stack || err);
    }
  } finally {
    await context.close().catch(() => {});
    if (parsedThisSession && !args.dry) {
      const m = await meterLocalScrape({ db, places: parsedThisSession });
      summary.metered = m ? parsedThisSession : 0;
    }
    summary.finishedAt = new Date().toISOString();
    log.event("run_end", { stopped: summary.stopped, placesParsed: summary.placesParsed });
    checkpoint();
    await db.$disconnect().catch(() => {});
  }

  printSummary(summary);
  return summary.stopped ? (summary.stopped.kind === "error" ? 1 : 2) : 0;
}

function tally(summary, write) {
  const w = summary.written;
  switch (write.verdict) {
    case "matched": w.matched += 1; break;
    case "already_attached": w.alreadyAttached += 1; break;
    case "no_confident_match": w.noConfidentMatch += 1; break;
    case "no_candidates": w.noCandidates += 1; break;
    case "place_id_conflict": w.placeIdConflict += 1; break;
    case "duplicate_place": w.duplicatePlace += 1; break;
    case "unnamed": w.unnamed += 1; break;
    default: break;
  }
  for (const g of write.gained || []) if (g in summary.gained) summary.gained[g] += 1;
  if (write.conflicts?.length) summary.conflicts += 1;
  if (write.closed) summary.closed += 1;
  if (write.newLeadLike) {
    summary.unmatchedNewLeadLike += 1;
    const t = write.listing?.tradeKey || "unknown";
    summary.unmatchedByTrade[t] = (summary.unmatchedByTrade[t] || 0) + 1;
  }
}

function verdictMark(v) {
  return { matched: "✓", already_attached: "=", no_confident_match: "~", no_candidates: "+", place_id_conflict: "!", duplicate_place: "!", error: "✗" }[v] || "·";
}

function describeWrite(w) {
  if (w.verdict === "matched") return `matched ${w.score?.prospectName || w.prospectId}${w.gained?.length ? `, gained ${w.gained.join(", ")}` : ", nothing new"}${w.conflicts?.length ? `, kept the record's ${w.conflicts.join(", ")}` : ""}`;
  if (w.verdict === "already_attached") return "already attached on an earlier run";
  if (w.verdict === "no_candidates") return `no prospect row${w.newLeadLike ? " — looks like a new lead" : ""}`;
  if (w.verdict === "no_confident_match") return `refused: ${w.score?.reason} (top: ${w.score?.prospectName})${w.newLeadLike ? " — looks like a new lead" : ""}`;
  if (w.verdict === "place_id_conflict") return `row already carries another place id`;
  if (w.verdict === "duplicate_place") return `another row already carries this place id`;
  if (w.verdict === "error") return `error: ${w.error}`;
  return w.verdict || "?";
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function printSummary(s) {
  console.log(`\n═══ Run ${s.runId} ═══`);
  if (s.stopped) console.log(`STOPPED: ${s.stopped.message}`);
  console.log(`pairs ${s.pairs} · tiles ${s.tiles} (${s.tilesSaturated} saturated → subdivided, ${s.tilesEmpty} empty) · feed links ${s.feedLinks}`);
  console.log(`places opened ${s.placesOpened} · parsed ${s.placesParsed} · unreadable ${s.parseFailures} · skipped as seen ${s.placesSkippedSeen} (${s.dedupedAcrossTerms} across terms)`);
  const w = s.written;
  console.log(`matched ${w.matched} · already attached ${w.alreadyAttached} · refused ${w.noConfidentMatch} · no row ${w.noCandidates} · conflicts ${w.placeIdConflict + w.duplicatePlace} · errors ${w.errors}`);
  console.log(`gained: ${Object.entries(s.gained).filter(([, n]) => n).map(([k, n]) => `${k} ${n}`).join(", ") || "nothing"} · kept the record's value over Google's on ${s.conflicts} row(s) · closed ${s.closed}`);
  console.log(`unmatched that look like new leads: ${s.unmatchedNewLeadLike}${Object.keys(s.unmatchedByTrade).length ? ` (${Object.entries(s.unmatchedByTrade).map(([k, n]) => `${k} ${n}`).join(", ")})` : ""}`);
  console.log(`metered onto /platform/costs as local_scrape/google-maps: ${s.metered} places at $0`);
  for (const n of s.notes) console.log(`note: ${n}`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname;
if (isMain) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      console.error(err?.stack || err);
      process.exit(1);
    },
  );
}
