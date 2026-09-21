// lib/sales/intel/promoteListings.js
//
// An unmatched Google Maps listing becomes a Prospect.
//
// ══ The owner's ask, 2026-09-21 ═══════════════════════════════════════════
//
// "The ~2,568 unmatched open businesses with phone numbers — can we
// determine their trades? Send them to the place in the platform where the
// AI identifies them and I put them in a trade, and then have the web
// crawler and the other analytics run so they can be used as leads."
//
// Until now an ExternalListing the matcher could not attach to a register
// row was a prospect-in-waiting that nothing waited for: listings.js's own
// header said "nothing here creates a Prospect: that is the discovery
// ingest's job", and the ingest never read the table. This file is that
// job, done the way the ingest does it — the same status a freshly
// discovered business gets, the same review folder, the same research
// chain — so a listing the Mac read is a lead by the time the owner opens
// /platform/sales/review, and not a second kind of row.
//
// ══ What is promoted, and what is refused ═════════════════════════════════
//
//   promoted   source google_maps, matchedProspectId null, promotedProspectId
//              null, a phone (E.164 — the dedupe key every discovery run
//              reads, and the thing a rep needs), not CLOSED_*, and a name.
//   refused    no phone; closed; already promoted; a Prospect already carries
//              the same phone OR the same website domain (a duplicate, whatever
//              its name says); the phone or domain is on the do-not-contact
//              list (SalesSuppression, live); the name or the category says
//              supply / wholesale / store (a retailer — the discovery
//              classifier's own reading of the name, and
//              tradeKeyForListingCategory's of the category); outside the
//              --state filter when one is given; two listings in one batch
//              with the same phone or domain — the first wins.
//
// ══ Status, classification, trade ═════════════════════════════════════════
//
// lib/sales/discovery/ingest.js writes `discovered` for a contractor and
// `needs_review` when the classifier could not say — and those two statuses
// are what put a row in the review folder (reviewFolder.js: no_trade =
// contractor + tradeKey null + claimable; unclear = needs_review). So:
//
//   category → a trade     tradeKey set, classification contractor, status
//   (MAPS_CATEGORY_WORDS)  discovered — a lead in that trade's queue at once,
//                          crawl queued, no human step needed.
//   category → no trade    tradeKey null. The NAME decides between
//   (or none)              contractor (a trade word in it, per classify.js
//                          TRADE_NAME_PATTERNS) → discovered, in the folder
//                          as "no trade", and needs_review → in the folder
//                          as "unclear". Either way the folder's own trade
//                          suggestions (tradeSuggest.js, suggestTradesAi.js)
//                          and its bulk assign are what put the trade on;
//                          nothing is invented here from a search term — a
//                          "plumber" search returns the water-heater store
//                          next door too.
//
// No campaign: a campaign is a discovery run with a target and counters,
// and the Mac's sweep is not one. Every review write already tolerates a
// null campaignId (countersByCampaign skips it).
//
// ══ Idempotent ════════════════════════════════════════════════════════════
//
// `promotedProspectId` is written on the listing in the same transaction as
// the Prospect insert, and the where re-checks it is still null at write
// time, so two sweeps ending at once cannot promote one listing twice. The
// (sourceProvider, sourceRecordId) unique on Prospect — "google_maps" and
// the listing's externalId — is the second lock. Research is queued once,
// after the transaction, through ensureResearchQueued, which is itself
// idempotent per prospect.
import { db as defaultDb } from "@/lib/db";
import { classifyBusiness } from "@/lib/sales/discovery/classify";
import { CLOSED_PERMANENTLY } from "./places";
import { MAPS_SOURCE, tradeKeyForListingCategory } from "./listings";
import { inRegions } from "./enrichmentOrder";
import { ensureResearchQueued } from "@/lib/sales/pipeline/research";

/** Prospect.sourceProvider for a promoted listing — the same string the
 *  listing carries as ExternalListing.source, so the two join by eye. */
export const PROMOTED_SOURCE_PROVIDER = MAPS_SOURCE;

/** How many listings one page reads. */
export const PROMOTE_PAGE = 500;

export const PROMOTE_SELECT = Object.freeze({
  id: true,
  externalId: true,
  name: true,
  phoneE164: true,
  domain: true,
  websiteUrl: true,
  addressLine: true,
  city: true,
  province: true,
  postalCode: true,
  country: true,
  latitude: true,
  longitude: true,
  category: true,
  tradeKey: true,
  rating: true,
  reviewCount: true,
  businessStatus: true,
  runId: true,
  lastSeenAt: true,
  matchedProspectId: true,
  promotedProspectId: true,
});

/** The Prisma where for "could be promoted now". Pure. */
export function promotableWhere({ regions = null, runId = null, ids = null } = {}) {
  const where = {
    source: MAPS_SOURCE,
    matchedProspectId: null,
    promotedProspectId: null,
    phoneE164: { not: null },
    NOT: [{ businessStatus: CLOSED_PERMANENTLY }, { businessStatus: "CLOSED_TEMPORARILY" }],
  };
  if (Array.isArray(regions) && regions.length) where.province = { in: regions };
  if (runId) where.runId = runId;
  if (Array.isArray(ids) && ids.length) where.id = { in: ids };
  return where;
}

/** A Google category that names a shop, not a trade — the same line
 *  tradeKeyForListingCategory draws, exported so the check can read it. */
export function retailCategory(category) {
  const c = String(category ?? "").toLowerCase();
  return /\b(supply|supplier|store|shop|warehouse|wholesaler|manufacturer|showroom|school|association|rental)\b/.test(c) && !/garage door supplier/.test(c);
}

/**
 * The one decision, per listing, given what the database said about its
 * neighbours. Pure.
 *
 * @param listing   an ExternalListing row (PROMOTE_SELECT)
 * @param ctx       { regions, existingPhones: Set, existingDomains: Set,
 *                    existingPlaceIds: Set, dncPhones: Set, dncDomains: Set,
 *                    batchPhones: Set, batchDomains: Set }
 * @returns { ok: true, prospect, verdict, tradeKey } | { ok: false, reason }
 */
export function planPromotion(listing = {}, ctx = {}) {
  const name = String(listing?.name ?? "").trim();
  if (!name || name === "(unnamed)") return { ok: false, reason: "no_name" };
  if (!listing.phoneE164) return { ok: false, reason: "no_phone" };
  if (listing.matchedProspectId) return { ok: false, reason: "matched" };
  if (listing.promotedProspectId) return { ok: false, reason: "already_promoted" };
  if (listing.businessStatus === CLOSED_PERMANENTLY || listing.businessStatus === "CLOSED_TEMPORARILY") return { ok: false, reason: "closed" };
  if (!inRegions(listing.province, ctx.regions || null)) return { ok: false, reason: "outside_regions" };
  if (ctx.dncPhones?.has(listing.phoneE164)) return { ok: false, reason: "do_not_contact" };
  if (listing.domain && ctx.dncDomains?.has(listing.domain)) return { ok: false, reason: "do_not_contact" };
  if (/^ChIJ/.test(String(listing.externalId || "")) && ctx.existingPlaceIds?.has(listing.externalId)) return { ok: false, reason: "duplicate_place_id" };
  if (ctx.existingPhones?.has(listing.phoneE164)) return { ok: false, reason: "duplicate_phone" };
  if (listing.domain && ctx.existingDomains?.has(listing.domain)) return { ok: false, reason: "duplicate_domain" };
  if (ctx.batchPhones?.has(listing.phoneE164)) return { ok: false, reason: "duplicate_phone_in_batch" };
  if (listing.domain && ctx.batchDomains?.has(listing.domain)) return { ok: false, reason: "duplicate_domain_in_batch" };
  if (retailCategory(listing.category)) return { ok: false, reason: "retail_category" };

  const byName = classifyBusiness({ name, categories: {} });
  if (byName.classification === "retailer") return { ok: false, reason: "retail_name" };

  // The trade: the category's, when the category names one. Re-derived
  // rather than trusted from the row so a listing written before a word
  // was added to MAPS_CATEGORY_WORDS gets today's reading.
  const tradeKey = tradeKeyForListingCategory(listing.category) || listing.tradeKey || null;
  let classification;
  let classificationReason;
  let status;
  if (tradeKey) {
    classification = "contractor";
    classificationReason = `Google Maps files this business under "${listing.category}", which is the ${tradeKey} trade.`;
    status = "discovered";
  } else if (byName.classification === "contractor") {
    classification = "contractor";
    classificationReason = listing.category
      ? `Google Maps files this business under "${listing.category}", which names no trade FieldQuo sells to; the name reads as a trade.`
      : "Google Maps lists no category; the name reads as a trade.";
    status = "discovered";
  } else {
    classification = "needs_review";
    classificationReason = listing.category
      ? `Google Maps files this business under "${listing.category}", which names no trade FieldQuo sells to, and the name does not say.`
      : "Google Maps lists no category and the name does not say what trade this is.";
    status = "needs_review";
  }

  const prospect = {
    businessName: name.slice(0, 200),
    rawName: name.slice(0, 200),
    phoneE164: listing.phoneE164,
    domain: listing.domain || null,
    websiteUrl: listing.websiteUrl || null,
    // True or null, never a false invented from a listing with no link —
    // lib/sales/discovery/normalise.js's second point.
    hasWebsite: listing.websiteUrl ? true : null,
    addressLine: listing.addressLine || null,
    city: listing.city || null,
    province: listing.province || null,
    postalCode: listing.postalCode || null,
    country: listing.country || null,
    latitude: listing.latitude === null || listing.latitude === undefined ? null : Number(listing.latitude),
    longitude: listing.longitude === null || listing.longitude === undefined ? null : Number(listing.longitude),
    sourceCategories: listing.category ? [String(listing.category).slice(0, 120)] : [],
    tradeKey,
    classification,
    classificationReason,
    businessStatus: listing.businessStatus || null,
    googlePlaceId: /^ChIJ/.test(String(listing.externalId || "")) ? listing.externalId : null,
    googleRating: listing.rating === null || listing.rating === undefined || listing.rating === "" ? null : Number(listing.rating),
    googleReviewCount: Number.isInteger(listing.reviewCount) ? listing.reviewCount : null,
    sourceProvider: PROMOTED_SOURCE_PROVIDER,
    sourceRecordId: String(listing.externalId).slice(0, 200),
    sourceRelease: listing.runId || null,
    sourceUpdatedAt: listing.lastSeenAt ? new Date(listing.lastSeenAt) : null,
    status,
    campaignId: null,
  };
  if (!Number.isFinite(prospect.googleRating)) prospect.googleRating = null;
  return { ok: true, prospect, tradeKey, verdict: byName };
}

/** The evidence rows a promoted prospect carries: where each fact came from. */
export function promotionEvidence(prospectId, listing, { now = new Date() } = {}) {
  const mapsUrl = /^ChIJ/.test(String(listing.externalId || "")) ? `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(listing.externalId)}` : null;
  const cite = (field, rawValue, normalizedValue = null) => ({
    prospectId,
    type: "google_field",
    source: "google",
    sourceUrl: mapsUrl,
    rawValue: String(rawValue).slice(0, 2000),
    normalizedValue: normalizedValue === null ? null : String(normalizedValue).slice(0, 500),
    observedAt: listing.lastSeenAt ? new Date(listing.lastSeenAt) : now,
    confidence: 1.0,
    detector: `maps.scrape:${field}`,
    detectorVersion: "1",
  });
  const out = [cite("name", `Google lists this business as "${listing.name}"`, listing.name)];
  if (listing.phoneE164) out.push(cite("phone", `Google lists the phone number ${listing.phoneE164}`, listing.phoneE164));
  if (listing.websiteUrl) out.push(cite("website", `Google lists the website ${listing.websiteUrl}`, listing.domain || null));
  if (listing.category) out.push(cite("category", `Google files this business under "${listing.category}"`, listing.category));
  const address = [listing.addressLine, listing.city, listing.province, listing.postalCode].filter(Boolean).join(", ");
  if (address) out.push(cite("address", `Google lists the address: ${address}`, address));
  if (listing.rating !== null && listing.rating !== undefined && listing.rating !== "") out.push(cite("rating", `Google rating ${listing.rating} from ${listing.reviewCount ?? "an unknown number of"} reviews`, String(listing.rating)));
  return out;
}

/** The empty report every run fills. */
export function emptyPromotionReport({ dry = true, regions = null } = {}) {
  return {
    dry,
    regions,
    considered: 0,
    promoted: 0,
    researchQueued: 0,
    skipped: {},
    byState: {},
    byTrade: { known: 0, unknown: 0 },
    byTradeKey: {},
    byStatus: {},
    rows: [],
    errors: 0,
  };
}

/**
 * Promote every promotable listing (or a run's, or a list of ids).
 *
 * @param dry       count and plan; write nothing
 * @param regions   two-letter states/provinces, or null for all
 * @param runId     only this run's listings (the end-of-sweep call)
 * @param ids       only these listing ids
 * @param limit     stop after this many promotions (0 = all)
 * @param onRow     (listing, plan) per listing considered
 */
export async function promoteListings({ db = defaultDb, dry = true, regions = null, runId = null, ids = null, limit = 0, now = new Date(), onRow = null, queueResearch = ensureResearchQueued } = {}) {
  const report = emptyPromotionReport({ dry, regions });
  const batchPhones = new Set();
  const batchDomains = new Set();
  const promotedIds = [];
  let cursor = null;
  for (;;) {
    const page = await db.externalListing.findMany({
      where: promotableWhere({ regions, runId, ids }),
      select: PROMOTE_SELECT,
      orderBy: { id: "asc" },
      take: PROMOTE_PAGE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!page.length) break;

    // One read per page for the neighbours: prospects on the same phone or
    // domain (any row, retired ones included — a retired row's survivor
    // carries its phone), and the live do-not-contact entries.
    const phones = [...new Set(page.map((l) => l.phoneE164).filter(Boolean))];
    const domains = [...new Set(page.map((l) => l.domain).filter(Boolean))];
    const placeIds = [...new Set(page.map((l) => l.externalId).filter((e) => /^ChIJ/.test(String(e || ""))))];
    const [byPhone, byDomain, byPlace, dnc] = await Promise.all([
      phones.length ? db.prospect.findMany({ where: { phoneE164: { in: phones } }, select: { phoneE164: true } }) : [],
      domains.length ? db.prospect.findMany({ where: { domain: { in: domains } }, select: { domain: true } }) : [],
      // Prospect.googlePlaceId is unique: a row already carrying this place
      // id (a duplicate_place refusal) would refuse the insert, so it is a
      // named skip here rather than a constraint error there.
      placeIds.length ? db.prospect.findMany({ where: { googlePlaceId: { in: placeIds } }, select: { googlePlaceId: true } }) : [],
      typeof db.salesSuppression?.findMany === "function"
        ? db.salesSuppression.findMany({
            where: { removedAt: null, OR: [...(phones.length ? [{ kind: "phone", value: { in: phones } }] : []), ...(domains.length ? [{ kind: "domain", value: { in: domains } }] : [])] },
            select: { kind: true, value: true },
          })
        : [],
    ]);
    const ctx = {
      regions,
      existingPhones: new Set(byPhone.map((p) => p.phoneE164)),
      existingDomains: new Set(byDomain.map((p) => p.domain)),
      existingPlaceIds: new Set(byPlace.map((p) => p.googlePlaceId)),
      dncPhones: new Set(dnc.filter((s) => s.kind === "phone").map((s) => s.value)),
      dncDomains: new Set(dnc.filter((s) => s.kind === "domain").map((s) => s.value)),
      batchPhones,
      batchDomains,
    };

    for (const listing of page) {
      if (limit && report.promoted >= limit) return finish(report, promotedIds, { db, dry, now, queueResearch });
      report.considered += 1;
      const plan = planPromotion(listing, ctx);
      if (onRow) onRow(listing, plan);
      if (!plan.ok) {
        report.skipped[plan.reason] = (report.skipped[plan.reason] || 0) + 1;
        continue;
      }
      batchPhones.add(listing.phoneE164);
      if (listing.domain) batchDomains.add(listing.domain);

      const state = listing.province || "—";
      report.byState[state] = (report.byState[state] || 0) + 1;
      report.byTrade[plan.tradeKey ? "known" : "unknown"] += 1;
      if (plan.tradeKey) report.byTradeKey[plan.tradeKey] = (report.byTradeKey[plan.tradeKey] || 0) + 1;
      report.byStatus[plan.prospect.status] = (report.byStatus[plan.prospect.status] || 0) + 1;
      if (report.rows.length < 5000) report.rows.push({ listingId: listing.id, name: listing.name, state, tradeKey: plan.tradeKey, status: plan.prospect.status });
      if (dry) {
        report.promoted += 1;
        continue;
      }

      try {
        const prospectId = await db.$transaction(async (tx) => {
          // Re-check at write time: another sweep may have promoted or
          // matched this listing since the page was read.
          const claimed = await tx.externalListing.updateMany({
            where: { id: listing.id, promotedProspectId: null, matchedProspectId: null },
            data: { promotedAt: now },
          });
          if (claimed.count !== 1) return null;
          const created = await tx.prospect.create({ data: plan.prospect, select: { id: true } });
          await tx.externalListing.update({ where: { id: listing.id }, data: { promotedProspectId: created.id, promotedAt: now } });
          const evidence = promotionEvidence(created.id, listing, { now });
          if (evidence.length) await tx.prospectEvidence.createMany({ data: evidence });
          return created.id;
        });
        if (!prospectId) {
          report.skipped.raced = (report.skipped.raced || 0) + 1;
          continue;
        }
        report.promoted += 1;
        promotedIds.push(prospectId);
        report.rows[report.rows.length - 1].prospectId = prospectId;
      } catch (err) {
        // The (sourceProvider, sourceRecordId) unique refusing a second
        // insert is the same listing promoted by another run: not an error
        // to alarm on, counted as raced. Anything else is.
        if (/Unique constraint/i.test(err?.message || "")) report.skipped.raced = (report.skipped.raced || 0) + 1;
        else {
          report.errors += 1;
          report.skipped.error = (report.skipped.error || 0) + 1;
          console.error("[promote] listing", listing.id, "not promoted:", err?.message || err);
        }
      }
    }
    cursor = page[page.length - 1].id;
    if (page.length < PROMOTE_PAGE) break;
  }
  return finish(report, promotedIds, { db, dry, now, queueResearch });
}

/** Queue the research chain for what was promoted — once, after the writes. */
async function finish(report, promotedIds, { db, dry, now, queueResearch }) {
  if (dry || !promotedIds.length) return report;
  // The backlog lane: nobody is waiting on these rows yet; the claim path
  // promotes the chain the moment a rep takes one (research.js). In pages,
  // so one bad row's throw is reported and the rest still queue.
  for (let i = 0; i < promotedIds.length; i += 100) {
    const slice = promotedIds.slice(i, i + 100);
    try {
      const r = await queueResearch({ db, prospectIds: slice, priority: "backlog", now });
      report.researchQueued += Number(r?.queued || 0);
    } catch (err) {
      report.errors += 1;
      console.error("[promote] research did not queue for", slice.length, "rows:", err?.message || err);
    }
  }
  return report;
}

/**
 * The two numbers the Maps panel prints: how many listings could be
 * promoted right now (before the per-row dedupe, which needs the page) and
 * how many have been.
 */
export async function promotionCounts({ db = defaultDb } = {}) {
  const [promotable, promoted] = await Promise.all([
    db.externalListing.count({ where: promotableWhere() }),
    db.externalListing.count({ where: { source: MAPS_SOURCE, promotedProspectId: { not: null } } }),
  ]);
  return { promotable, promoted };
}
