// lib/sales/intel/apifyRuns.js
//
// The bulk vendor runs: which (trade, city, country) pair to send next,
// starting it, collecting what came back, matching every row against the
// prospects, and keeping what did not match for later.
//
// ══ Two actors, one driver ════════════════════════════════════════════════
//
//   bbb          jungle_synthesizer/bbb-scraper   principal contacts, years,
//                                                 employees, rating, accreditation
//   google_maps  compass/crawler-google-places    what a Places lookup gives,
//                                                 in bulk per trade × city
//
// Everything that differs between them is DATA in ACTORS below — the input
// shape, the row reader, the price, the setting key for the daily cap — and
// everything else is one code path, for AGENTS.md's fourth reason: the copy
// is the one that rots.
//
// ══ Order, dedupe, cap ════════════════════════════════════════════════════
//
// Pairs come from lib/sales/intel/enrichmentOrder.js — the claimed leads'
// (trade, city) first, then the trades being worked in dispatch order —
// so a bulk run lands on the cities reps are dialling this week. A pair
// already run inside PAIR_REPEAT_DAYS is skipped (ApifyRun is the record),
// and at most `pairsPerDay` (a PlatformSetting per source, default 20)
// start in a UTC day. The cap is the budget: at 50 records a pair and the
// list prices, twenty pairs is about $2.10 a day for BBB and about $1.50
// for Maps; both are printed on the console beside the setting.
//
// ══ A run is three cron ticks ═════════════════════════════════════════════
//
// Start on one tick, poll on the next, ingest on the one after — each tick
// of /api/cron/sales-pipeline calls runApifyTick(), which first collects
// every finished run and then starts what the cap allows. No tick waits on
// Apify, so a slow actor cannot hold the pipeline's invocation.
import { db as defaultDb } from "@/lib/db";
import { normaliseDomain, normalisePhone } from "@/lib/sales/suppressionRules";
import { DISCOVERY_TRADES } from "@/lib/sales/discovery/trades";
import { APIFY_FINISHED, apifyConfigured, apifyEnableInstructions, fetchDatasetItems, getActorRun, meterApifyRun, startActorRun } from "./apify";
import { loadEnrichmentOrder, pairsFromRows } from "./enrichmentOrder";
import { applyBbbProfile, applyMapsListing, candidateProspectsFor, matchListings } from "./listingMatch";
import { PLACES_VERDICTS } from "./places";
import { recordError, errorDetail } from "@/lib/platform/errorLog";

export const PAIR_REPEAT_DAYS = 90;
export const DEFAULT_PAIRS_PER_DAY = 20;
export const DEFAULT_MAX_ITEMS = 50;
/** Runs in flight at once per source. Two: enough to keep ahead of the
 *  reps, few enough that a bad day's cap is reached slowly. */
export const MAX_RUNNING = 2;

/** What to type into the vendor's search box for a trade. The label is a
 *  fine default ("Plumbing"); the overrides are the words a directory
 *  files the business under. */
const SEARCH_KEYWORDS = Object.freeze({
  plumbing: "plumber",
  electrical: "electrician",
  hvac: "hvac contractor",
  painting: "painting contractor",
  roofing: "roofing contractor",
  landscaping: "landscaper",
  flooring: "flooring contractor",
  cabinets: "cabinet maker",
  remodeling: "remodeling contractor",
  general_contracting: "general contractor",
  masonry_concrete: "concrete contractor",
  tree_care: "tree service",
  pest_control: "pest control",
  garage_door: "garage door service",
  pool_spa: "pool contractor",
  house_cleaning: "house cleaning service",
});

export function searchKeywordFor(tradeKey) {
  return SEARCH_KEYWORDS[tradeKey] || String(DISCOVERY_TRADES[tradeKey]?.label || tradeKey || "").toLowerCase();
}

export const ACTORS = Object.freeze({
  bbb: {
    source: "bbb",
    actor: "jungle_synthesizer~bbb-scraper",
    category: "bbb-scraper",
    label: "BBB (Apify)",
    settingKey: "sales.apify.bbb.pairsPerDay",
    /** Per record, plus one start event, per the actor's pricing on 2026-09-17. */
    listPriceUsdPerRow: 0.002,
    listPriceUsdPerStart: 0.1,
    input({ keyword, city, province, country, maxItems }) {
      return {
        searchQuery: keyword,
        location: [city, province].filter(Boolean).join(", "),
        country: country === "CA" ? "CAN" : "USA",
        maxItems,
        enrichWithDetails: true,
      };
    },
    /** One actor row → the neutral listing + the BBB profile shape. */
    row(item = {}) {
      const url = String(item.profile_url || "").trim();
      if (!url) return null;
      const phone = item.phone ? String(item.phone) : null;
      const people = item.principal_name
        ? [{ name: String(item.principal_name).replace(/^(mr|mrs|ms|dr)\.?\s+/i, "").trim(), role: item.principal_title ? String(item.principal_title).trim() : null }]
        : [];
      const years = Number(item.years_in_business);
      return {
        listing: {
          source: "bbb",
          externalId: url.replace(/\/addressId\/\d+$/, ""),
          name: String(item.name || "").trim(),
          phone,
          phoneE164: normalisePhone(phone || ""),
          websiteUrl: item.website ? String(item.website).trim() : null,
          domain: item.website ? normaliseDomain(item.website) : null,
          addressLine: item.street_address ? String(item.street_address).trim() : null,
          city: item.city ? String(item.city).trim() : null,
          province: item.state ? String(item.state).trim() : null,
          postalCode: item.zip ? String(item.zip).trim() : null,
          country: item.country ? (/can|canada/i.test(String(item.country)) ? "CA" : "US") : null,
          category: item.categories ? String(item.categories).split(",")[0].trim() : null,
          rating: item.bbb_rating ? String(item.bbb_rating).trim() : null,
          reviewCount: null,
        },
        profile: {
          url: url.replace(/\/addressId\/\d+$/, ""),
          name: String(item.name || "").trim(),
          phone,
          website: item.website ? String(item.website).trim() : null,
          rating: item.bbb_rating ? String(item.bbb_rating).trim().toUpperCase() : null,
          accredited: typeof item.is_accredited === "boolean" ? item.is_accredited : null,
          // years_in_business is a count, not a founding year; the year is
          // derived only when the count is a plain integer, and stated as
          // such on the evidence row.
          businessStartedYear: Number.isInteger(years) && years > 0 && years < 200 ? new Date().getUTCFullYear() - years : null,
          yearsInBusiness: Number.isInteger(years) ? years : null,
          employeeRange: item.num_employees ? String(item.num_employees).replace(/\s+/g, "") : null,
          entityType: null,
          people,
          email: item.email ? String(item.email).trim() : null,
        },
      };
    },
  },
  google_maps: {
    source: "google_maps",
    actor: "compass~crawler-google-places",
    category: "google-maps-scraper",
    label: "Google Maps (Apify)",
    settingKey: "sales.apify.maps.pairsPerDay",
    /** "from $1.50 / 1,000 scraped places" on the actor's page, 2026-09-17;
     *  the tiered real charge comes back on the run and is what is metered. */
    listPriceUsdPerRow: 0.0015,
    listPriceUsdPerStart: 0.00005,
    input({ keyword, city, province, country, maxItems }) {
      return {
        searchStringsArray: [keyword],
        locationQuery: [city, province, country === "CA" ? "Canada" : "USA"].filter(Boolean).join(", "),
        maxCrawledPlacesPerSearch: maxItems,
        language: "en",
        skipClosedPlaces: false,
        scrapeContacts: false,
        scrapePlaceDetailPage: false,
        maximumLeadsEnrichmentRecords: 0,
        maxReviews: 0,
        maxImages: 0,
      };
    },
    row(item = {}) {
      const placeId = String(item.placeId || "").trim();
      if (!placeId) return null;
      const phone = item.phone || item.phoneUnformatted || null;
      const hours = Array.isArray(item.openingHours) ? item.openingHours.map((h) => (h?.day && h?.hours ? `${h.day}: ${h.hours}` : null)).filter(Boolean) : [];
      return {
        listing: {
          source: "google_maps",
          externalId: placeId,
          name: String(item.title || "").trim(),
          phone: phone ? String(phone) : null,
          phoneE164: normalisePhone(phone || ""),
          websiteUrl: item.website ? String(item.website).trim() : null,
          domain: item.website ? normaliseDomain(item.website) : null,
          addressLine: item.street ? String(item.street).trim() : null,
          city: item.city ? String(item.city).trim() : null,
          province: item.state ? String(item.state).trim() : null,
          postalCode: item.postalCode ? String(item.postalCode).trim() : null,
          country: item.countryCode ? String(item.countryCode).toUpperCase() : null,
          latitude: Number.isFinite(Number(item.location?.lat)) ? Number(item.location.lat) : null,
          longitude: Number.isFinite(Number(item.location?.lng)) ? Number(item.location.lng) : null,
          category: item.categoryName ? String(item.categoryName) : null,
          categories: Array.isArray(item.categories) ? item.categories : [],
          rating: Number.isFinite(Number(item.totalScore)) ? String(item.totalScore) : null,
          reviewCount: Number.isFinite(Number(item.reviewsCount)) ? Number(item.reviewsCount) : null,
          businessStatus: item.permanentlyClosed ? "CLOSED_PERMANENTLY" : item.temporarilyClosed ? "CLOSED_TEMPORARILY" : "OPERATIONAL",
          hours,
        },
        profile: null,
      };
    },
  },
});

export function pairKeyFor({ source, keyword, city, province, country }) {
  return [source, keyword, city, province || "", country].map((s) => String(s || "").trim().toLowerCase()).join("|");
}

export async function pairsPerDay({ db = defaultDb, source } = {}) {
  const def = ACTORS[source];
  if (!def) return 0;
  try {
    const row = await db.platformSetting.findUnique({ where: { key: def.settingKey } });
    const n = Number(row?.value?.pairsPerDay ?? row?.value);
    return Number.isInteger(n) && n >= 0 ? n : DEFAULT_PAIRS_PER_DAY;
  } catch {
    return DEFAULT_PAIRS_PER_DAY;
  }
}

export async function setPairsPerDay({ db = defaultDb, source, pairsPerDay: n } = {}) {
  const def = ACTORS[source];
  if (!def) throw new Error(`unknown source ${source}`);
  const value = { pairsPerDay: Math.max(0, Math.min(500, Math.floor(Number(n) || 0))) };
  await db.platformSetting.upsert({ where: { key: def.settingKey }, update: { value }, create: { key: def.settingKey, value } });
  return value.pairsPerDay;
}

function utcDayStart(now) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Estimated list-price cost of one pair, in cents. Pure. */
export function projectedPairCents(source, maxItems = DEFAULT_MAX_ITEMS) {
  const def = ACTORS[source];
  if (!def) return 0;
  return Math.round((def.listPriceUsdPerStart + def.listPriceUsdPerRow * maxItems) * 100 * 100) / 100;
}

/**
 * The pairs to send next, in enrichment order, minus those run recently
 * and bounded by what is left of today's cap.
 *
 * @returns { pairs, cap, startedToday, skippedRecent, source }
 */
export async function nextPairs({ db = defaultDb, source, now = new Date(), limit = null } = {}) {
  const def = ACTORS[source];
  if (!def) throw new Error(`unknown source ${source}`);
  const [cap, startedToday, order] = await Promise.all([
    pairsPerDay({ db, source }),
    db.apifyRun.count({ where: { source, startedAt: { gte: utcDayStart(now) } } }),
    loadEnrichmentOrder({ db, now }),
  ]);
  const ids = order.rows.map((r) => r.id);
  const prospects = ids.length
    ? await db.prospect.findMany({ where: { id: { in: ids } }, select: { id: true, tradeKey: true, city: true, province: true, country: true } })
    : [];
  const byId = new Map(prospects.map((p) => [p.id, p]));
  const candidates = pairsFromRows(order.rows, byId).map((p) => ({ ...p, keyword: searchKeywordFor(p.tradeKey) }));
  const since = new Date(now.getTime() - PAIR_REPEAT_DAYS * 24 * 60 * 60 * 1000);
  const keys = candidates.map((p) => pairKeyFor({ source, ...p }));
  const recent = keys.length
    ? await db.apifyRun.findMany({ where: { source, pairKey: { in: keys }, startedAt: { gte: since }, status: { not: "failed" } }, select: { pairKey: true } })
    : [];
  const recentKeys = new Set(recent.map((r) => r.pairKey));
  const fresh = candidates.filter((p) => !recentKeys.has(pairKeyFor({ source, ...p })));
  const room = Math.max(0, cap - startedToday);
  const take = limit === null ? room : Math.min(room, limit);
  return { source, pairs: fresh.slice(0, take), all: fresh.length, cap, startedToday, skippedRecent: candidates.length - fresh.length };
}

/** Start one pair. Records the ApifyRun row first, so a start that fails
 *  is a row with an error and never a run nobody knows about. */
export async function startPairRun({ db = defaultDb, source, pair, trigger = "cron", maxItems = DEFAULT_MAX_ITEMS, now = new Date(), deps = {} } = {}) {
  const def = ACTORS[source];
  if (!def) throw new Error(`unknown source ${source}`);
  const keyword = pair.keyword || searchKeywordFor(pair.tradeKey);
  const row = await db.apifyRun.create({
    data: {
      actor: def.actor.replace("~", "/"),
      source,
      tradeKey: pair.tradeKey || null,
      keyword,
      location: [pair.city, pair.province].filter(Boolean).join(", "),
      country: pair.country,
      pairKey: pairKeyFor({ source, keyword, city: pair.city, province: pair.province, country: pair.country }),
      status: "queued",
      maxItems,
      trigger,
      startedAt: now,
    },
  });
  const started = await startActorRun({ actor: def.actor, input: def.input({ keyword, city: pair.city, province: pair.province, country: pair.country, maxItems }), deps });
  if (!started.ok) {
    await db.apifyRun.update({ where: { id: row.id }, data: { status: "failed", error: `${started.code}: ${started.message}`.slice(0, 500), finishedAt: now } });
    return { ok: false, runId: row.id, code: started.code, message: started.message, fatal: started.fatal };
  }
  await db.apifyRun.update({ where: { id: row.id }, data: { apifyRunId: started.run.id, datasetId: started.run.datasetId, status: "running" } });
  return { ok: true, runId: row.id, apifyRunId: started.run.id };
}

/**
 * Every listing of a finished run: kept in ExternalListing (one row per
 * vendor id), matched against the prospects by the Places rule, and
 * applied through the never-overwrite path when the rule accepts.
 *
 * @returns { rows, kept, matched, refused, peopleAdded }
 */
export async function ingestListings({ db = defaultDb, source, items = [], runId = null, keyword = null, location = null, now = new Date() } = {}) {
  const def = ACTORS[source];
  const parsed = (Array.isArray(items) ? items : []).map((it) => def.row(it)).filter(Boolean);
  const report = { rows: parsed.length, kept: 0, matched: 0, refused: 0, peopleAdded: 0, gained: {} };
  if (!parsed.length) return report;

  // Keep every row first, so a match failure later never loses the listing.
  for (const { listing, profile } of parsed) {
    const data = {
      name: listing.name || "(unnamed)",
      phoneE164: listing.phoneE164 || null,
      domain: listing.domain || null,
      websiteUrl: listing.websiteUrl || null,
      addressLine: listing.addressLine || null,
      city: listing.city || null,
      province: listing.province || null,
      postalCode: listing.postalCode || null,
      country: listing.country || null,
      latitude: listing.latitude ?? null,
      longitude: listing.longitude ?? null,
      category: listing.category || null,
      rating: listing.rating || null,
      reviewCount: listing.reviewCount ?? null,
      payload: { listing, profile },
      keyword,
      location,
      runId,
      fetchedAt: now,
    };
    await db.externalListing.upsert({
      where: { source_externalId: { source, externalId: listing.externalId } },
      create: { source, externalId: listing.externalId, ...data },
      // A row seen again keeps its match; the vendor's newer fields replace
      // the older copy of the vendor's own fields — that is a refresh of a
      // cache, not an overwrite of anything a human typed.
      update: data,
    });
    report.kept += 1;
  }

  const listings = parsed.map((p) => p.listing);
  const prospects = await candidateProspectsFor({ db, listings });
  const claimedListing = new Set();
  for (const prospect of prospects) {
    const m = matchListings(prospect, listings.filter((l) => !claimedListing.has(l.externalId)));
    if (m.verdict !== PLACES_VERDICTS.MATCHED || !m.listing) continue;
    claimedListing.add(m.listing.externalId);
    const entry = parsed.find((p) => p.listing.externalId === m.listing.externalId);
    try {
      let r;
      if (source === "bbb") r = await applyBbbProfile({ db, prospectId: prospect.id, profile: entry.profile, now });
      else r = await applyMapsListing({ db, prospectId: prospect.id, listing: m.listing, score: m.score, now });
      report.matched += 1;
      report.peopleAdded += r.peopleAdded || 0;
      for (const g of r.gained || []) report.gained[g] = (report.gained[g] || 0) + 1;
      await db.externalListing.update({
        where: { source_externalId: { source, externalId: m.listing.externalId } },
        data: { matchedProspectId: prospect.id, matchVerdict: "matched", matchedAt: now },
      });
    } catch (err) {
      await recordError({ area: "apify", code: "apply_failed", message: `Could not apply a ${source} listing to ${prospect.id}: ${err?.message || err}`, detail: errorDetail(err, { prospectId: prospect.id, externalId: m.listing.externalId }) });
    }
  }
  for (const l of listings) {
    if (claimedListing.has(l.externalId)) continue;
    report.refused += 1;
    await db.externalListing.updateMany({
      where: { source, externalId: l.externalId, matchedProspectId: null },
      data: { matchVerdict: prospects.length ? "no_confident_match" : "no_candidate" },
    });
  }
  return report;
}

/** Poll every run in flight; ingest the finished ones; meter their cost. */
export async function collectFinishedRuns({ db = defaultDb, source, now = new Date(), deps = {} } = {}) {
  const def = ACTORS[source];
  const inFlight = await db.apifyRun.findMany({ where: { source, status: { in: ["queued", "running"] }, apifyRunId: { not: null } } });
  const out = { polled: inFlight.length, ingested: 0, failed: 0, stillRunning: 0, reports: [] };
  for (const run of inFlight) {
    const r = await getActorRun({ runId: run.apifyRunId, deps });
    if (!r.ok) {
      if (r.fatal) {
        out.stopped = { code: r.code, message: r.message };
        break;
      }
      continue;
    }
    if (!APIFY_FINISHED.includes(r.run.status)) {
      out.stillRunning += 1;
      continue;
    }
    if (r.run.status !== "SUCCEEDED") {
      out.failed += 1;
      await db.apifyRun.update({ where: { id: run.id }, data: { status: "failed", error: `${r.run.status}${r.run.statusMessage ? `: ${r.run.statusMessage}` : ""}`.slice(0, 500), finishedAt: new Date(r.run.finishedAt || now) } });
      continue;
    }
    const items = await fetchDatasetItems({ datasetId: r.run.datasetId || run.datasetId, deps });
    if (!items.ok) continue;
    const report = await ingestListings({ db, source, items: items.items, runId: run.id, keyword: run.keyword, location: run.location, now });
    const usd = r.run.usageTotalUsd;
    const costCents = usd !== null ? Math.round(usd * 100 * 100) / 100 : Math.round((def.listPriceUsdPerStart + def.listPriceUsdPerRow * report.rows) * 100 * 100) / 100;
    const costSource = usd !== null ? "apify_run_usage" : "list_price_estimate";
    await meterApifyRun({ db, now, category: def.category, cents: costCents, rows: report.rows, source: costSource });
    await db.apifyRun.update({
      where: { id: run.id },
      data: { status: "ingested", finishedAt: new Date(r.run.finishedAt || now), ingestedAt: now, rowsFetched: report.rows, matched: report.matched, refused: report.refused, kept: report.kept, peopleAdded: report.peopleAdded, costCents, costSource },
    });
    out.ingested += 1;
    out.reports.push({ runId: run.id, keyword: run.keyword, location: run.location, ...report, costCents, costSource });
  }
  return out;
}

/**
 * One tick for one source: collect, then start what the cap allows.
 * Returns at once with { skipped: "no_token" } when APIFY_TOKEN is unset.
 */
export async function runApifyTick({ db = defaultDb, source, now = new Date(), trigger = "cron", maxItems = DEFAULT_MAX_ITEMS, startLimit = null, deps = {} } = {}) {
  if (!ACTORS[source]) throw new Error(`unknown source ${source}`);
  if (!apifyConfigured() && !deps.token) return { source, skipped: "no_token", message: apifyEnableInstructions() };
  const collected = await collectFinishedRuns({ db, source, now, deps });
  if (collected.stopped) return { source, collected, started: [], stopped: collected.stopped };
  const running = await db.apifyRun.count({ where: { source, status: { in: ["queued", "running"] } } });
  const slots = Math.max(0, MAX_RUNNING - running);
  const started = [];
  let stopped = null;
  if (slots > 0) {
    const next = await nextPairs({ db, source, now, limit: startLimit === null ? slots : Math.min(slots, startLimit) });
    for (const pair of next.pairs) {
      const r = await startPairRun({ db, source, pair, trigger, maxItems, now, deps });
      started.push({ pair, ...r });
      if (!r.ok && r.fatal) {
        stopped = { code: r.code, message: r.message };
        break;
      }
    }
    return { source, collected, started, cap: next.cap, startedToday: next.startedToday + started.filter((s) => s.ok).length, pending: next.all - started.length, skippedRecent: next.skippedRecent, stopped };
  }
  return { source, collected, started, running, stopped };
}

/** What the console shows per source. */
export async function apifyStatus({ db = defaultDb, source, now = new Date() } = {}) {
  const def = ACTORS[source];
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [cap, startedToday, running, recent, totals] = await Promise.all([
    pairsPerDay({ db, source }),
    db.apifyRun.count({ where: { source, startedAt: { gte: utcDayStart(now) } } }),
    db.apifyRun.count({ where: { source, status: { in: ["queued", "running"] } } }),
    db.apifyRun.findMany({ where: { source }, orderBy: { startedAt: "desc" }, take: 12 }),
    db.apifyRun.aggregate({ where: { source, startedAt: { gte: since } }, _sum: { rowsFetched: true, matched: true, refused: true, kept: true, peopleAdded: true, costCents: true }, _count: { _all: true } }),
  ]);
  const kept = await db.externalListing.count({ where: { source, matchedProspectId: null } });
  return {
    source,
    label: def.label,
    actor: def.actor.replace("~", "/"),
    configured: apifyConfigured(),
    enable: apifyConfigured() ? null : apifyEnableInstructions(),
    cap,
    settingKey: def.settingKey,
    startedToday,
    running,
    projectedPairCents: projectedPairCents(source),
    last30Days: {
      runs: totals._count._all,
      rows: Number(totals._sum.rowsFetched || 0),
      matched: Number(totals._sum.matched || 0),
      refused: Number(totals._sum.refused || 0),
      kept: Number(totals._sum.kept || 0),
      peopleAdded: Number(totals._sum.peopleAdded || 0),
      cents: Number(totals._sum.costCents || 0),
    },
    unmatchedListings: kept,
    recent: recent.map((r) => ({ id: r.id, keyword: r.keyword, location: r.location, country: r.country, status: r.status, startedAt: r.startedAt, rowsFetched: r.rowsFetched, matched: r.matched, refused: r.refused, peopleAdded: r.peopleAdded, costCents: r.costCents === null ? null : Number(r.costCents), error: r.error, trigger: r.trigger })),
  };
}
