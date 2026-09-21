// lib/sales/intel/listings.js
//
// A LISTING — one business as a source displayed it — arriving from the
// outside and looking for the Prospect row it describes.
//
// ══ Why this is the inverse of places.js ═══════════════════════════════════
//
// (places.js no longer asks Google anything — its API path was retired on
// 2026-09-20 under the owner's rule that Google data is read from his Mac,
// never fetched by key; this file IS the Google path now. The paragraph
// below describes the shape the rule was built against, which still holds.)
//
// lib/sales/intel/places.js started from a Prospect and asked Google for it:
// one row, five candidates, the match rule picks one or refuses. The Google
// Maps scrape (scripts/scrape/maps.mjs) starts from the other end: it reads
// every plumber Google lists in a map viewport, and for each one has to find
// the register row it corroborates — or say that there is none. Same rule,
// same never-overwrite fill, same evidence vocabulary, opposite direction:
// the candidates here are Prospect rows pulled by phone, domain, place id or
// name-plus-area, and the listing is scored against each of them with the
// very same scoreCandidate() the Places path uses, so the two readers cannot
// drift apart on what counts as a match.
//
// Two identity signals are added on top of that rule, because a scrape sees
// what a Text Search never returns for a different row: the phone and the
// domain. phoneE164 is the dedupe key every discovery run reads, so a
// listing carrying the SAME E.164 as a prospect is that prospect unless the
// names share nothing at all.
//
// ══ Where identity outranks the name: matched_verify ══════════════════════
//
// "Same number, different name" was refused outright for the first three
// nights. Measured on production 2026-09-21, 148 of the 1,725 unmatched
// rows were exactly that — phone_same_name_disagrees 61,
// domain_same_name_disagrees 47, *_only_generic_words_shared 39 — and the
// owner read them: "almost certainly the same business ('BP Plumbing' vs
// 'B P Plumbing'; same phone under a rebranded name)". So a listing whose
// phone or website domain IS the record's, and whose name the rule still
// refuses, is now attached under the verdict `matched_verify`: the
// ExternalListing is linked, Google's fields fill BLANKS ONLY exactly as a
// plain match does, and the prospect carries a fact the rep card and the
// brief print first — "Google lists this number as K2 Plumbing — a rebrand
// or a shared line; confirm on the call". The shared answering service and
// the sold business are still real shapes; they are now a sentence the rep
// reads before dialling rather than a row nobody saw.
//
// Nothing else loosened: a name that disagrees with NO identity signal, a
// place that disagrees, and a listing with no candidate row are refused as
// before, and the check asserts each of those still is.
//
// ══ Where an unmatched listing goes ════════════════════════════════════════
//
// ExternalListing, one row per (source, place id), updated on every
// sighting and never deleted. The scrape's own report counts how many of
// them look like NEW leads — a phone, not closed, a category that maps to a
// trade we sell to — but nothing here creates a Prospect: that is the
// discovery ingest's job, with a source release and a trade a human
// confirms.
//
// ══ Coordination note ══════════════════════════════════════════════════════
//
// The principal-contacts / BBB / Apify work owns ExternalListing's base
// columns (its schema landed 2026-09-18; the maps-scrape block after
// `updatedAt` is this file's) and is building enrichmentOrder.js.
// enrichmentPairs() below is the stand-in for that dispatch order — open
// claims only, trade × city — and should be replaced by the shared
// function the moment it lands on main. Rows here use source
// "google_maps", the same value that path files its Maps rows under.
import { db as defaultDb } from "@/lib/db";
import { normaliseDomain, normalisePhone } from "@/lib/sales/suppressionRules";
import { cleanWebsite } from "@/lib/sales/discovery/normalise";
import { DISCOVERY_TRADES, isDiscoveryTradeKey } from "@/lib/sales/discovery/trades";
import {
  CLOSED_PERMANENTLY,
  MATCHED_VERIFY,
  NAME_OVERLAP_MIN,
  PLACES_PROSPECT_SELECT,
  PLACES_VERDICTS,
  distinctive,
  nameOverlap,
  nameTokens,
  placeWordsFor,
  planPlacesWrite,
  rerunChainForNewWebsite,
  scoreCandidate,
  verifyConfirmation,
} from "./places";

/** ExternalListing.source — shared with the Apify path's Maps rows, so a
 *  place either read lands on one row. */
export const MAPS_SOURCE = "google_maps";
export const MAPS_DETECTOR = "maps.scrape";
export const MAPS_DETECTOR_VERSION = "1";

/** What a match's evidence and second-number rows say they came from. */
export const MAPS_PROVENANCE = Object.freeze({
  detector: MAPS_DETECTOR,
  detectorVersion: MAPS_DETECTOR_VERSION,
  surface: "Google Maps",
  numberLabel: "Google Maps listing",
  via: "maps_scrape",
});

/** The zero-dollar ledger line: volume beside the paid sources on
 *  /platform/costs, so "how many places did the Mac read this week" is
 *  answered where "how much did Places cost" is. */
export const LOCAL_SCRAPE_PROVIDER = "local_scrape";
export const LOCAL_SCRAPE_CATEGORY = "google-maps";
export const LOCAL_SCRAPE_SOURCE = "local_scrape_run";

export const LISTING_VERDICTS = Object.freeze({
  MATCHED: "matched",
  /** Same phone or same website domain, a name the rule refused: attached
   *  and said out loud (see "Where identity outranks the name" below). */
  MATCHED_VERIFY: MATCHED_VERIFY,
  NO_CONFIDENT_MATCH: "no_confident_match",
  NO_CANDIDATES: "no_candidate",
  PLACE_ID_CONFLICT: "place_id_conflict",
  DUPLICATE_PLACE: PLACES_VERDICTS.DUPLICATE_PLACE,
});

/**
 * Domains that are a platform, a directory or a franchise's head office,
 * never one business's own — a listing and a prospect that both point at
 * facebook.com share nothing. Measured on the pool 2026-09-21: instagram
 * 474 prospects, linktr.ee 353, yelp 313, facebook 267, google.com 241,
 * sites.google.com 168, yp.ca 165, maps.app.goo.gl 164, linkedin 141. The
 * franchises (servpro.com 323, rotorooter.com 307, orkin, terminix …) are
 * not listed by name: matchListing refuses a domain identity that two or
 * more candidates in the net carry, which catches every franchise without
 * a list that rots.
 */
export const SHARED_DOMAINS = new Set([
  "facebook.com", "instagram.com", "linktr.ee", "yelp.com", "yelp.ca", "google.com", "sites.google.com", "maps.app.goo.gl", "goo.gl",
  "yp.ca", "yellowpages.com", "yellowpages.ca", "homeadvisor.com", "angi.com", "angieslist.com", "thumbtack.com", "houzz.com",
  "linkedin.com", "business.site", "nextdoor.com", "bbb.org", "cslb.ca.gov", "rbq.gouv.qc.ca", "porch.com", "bark.com",
  "homestars.com", "trustedpros.ca", "411.ca", "canada411.ca", "youtube.com", "tiktok.com", "x.com", "twitter.com",
]);

/** How far a name-and-area candidate may sit from the listing's pin and
 *  still be pulled for scoring. Wider than the rule's NEAR_WEAK_KM on
 *  purpose: this is the net, and the rule is the judge. */
export const CANDIDATE_RADIUS_KM = 12;
export const CANDIDATE_LIMIT = 60;

// ── Trade ↔ search term ──────────────────────────────────────────────────

/**
 * What to type into Maps for each trade we sell to. One term per trade:
 * the compass actor's own guidance is that near-synonyms ("plumber",
 * "plumbing service") return the same places and cost a second pass.
 */
export const MAPS_SEARCH_TERMS = Object.freeze({
  painting: "painter",
  cabinets: "cabinet maker",
  flooring: "flooring contractor",
  countertops: "countertop contractor",
  roofing: "roofing contractor",
  plumbing: "plumber",
  electrical: "electrician",
  hvac: "HVAC contractor",
  landscaping: "landscaper",
  carpentry: "carpenter",
  drywall: "drywall contractor",
  tiling: "tile contractor",
  siding: "siding contractor",
  gutters: "gutter cleaning service",
  fencing: "fence contractor",
  masonry_concrete: "concrete contractor",
  paving: "paving contractor",
  insulation: "insulation contractor",
  restoration: "water damage restoration service",
  chimney: "chimney sweep",
  pressure_washing: "pressure washing service",
  junk_removal: "junk removal service",
  house_cleaning: "house cleaning service",
  carpet_cleaning: "carpet cleaning service",
  window_cleaning: "window cleaning service",
  handyman: "handyman",
  excavation: "excavating contractor",
  demolition: "demolition contractor",
  garage_door: "garage door supplier",
  locksmith: "locksmith",
  appliance_repair: "appliance repair service",
  pest_control: "pest control service",
  tree_care: "tree service",
  pool_spa: "swimming pool contractor",
  irrigation: "lawn sprinkler system contractor",
  snow_removal: "snow removal service",
  home_inspection: "home inspector",
  remodeling: "remodeler",
  general_contracting: "general contractor",
});

/**
 * Google's category strings for each trade — the words that appear in a
 * listing's category line ("Plumber", "Roofing contractor"). Substring
 * match, lowercased, first hit wins in DISCOVERY_TRADES order, so
 * "Kitchen remodeler" reaches cabinets before remodeling only because
 * cabinets lists it and sits earlier. A category that names nothing here
 * maps to null: a "Plumbing supply store" is a supply house, and the
 * word "plumbing" alone must not make it a plumber.
 */
export const MAPS_CATEGORY_WORDS = Object.freeze({
  painting: ["painter", "painting contractor", "painting service"],
  cabinets: ["cabinet maker", "cabinet store", "cabinetry", "kitchen remodeler"],
  flooring: ["flooring contractor", "flooring store", "carpet installer", "wood floor", "floor refinishing"],
  countertops: ["countertop", "granite supplier", "marble contractor"],
  roofing: ["roofing contractor", "roofer", "roofing service"],
  plumbing: ["plumber", "plumbing service", "drainage service", "water heater", "septic"],
  electrical: ["electrician", "electrical installation", "electrical contractor"],
  hvac: ["hvac contractor", "heating contractor", "air conditioning contractor", "air conditioning repair", "furnace", "heating equipment"],
  landscaping: ["landscaper", "landscape designer", "lawn care", "landscaping"],
  carpentry: ["carpenter", "carpentry", "deck builder", "woodworker"],
  drywall: ["drywall", "plasterer"],
  tiling: ["tile contractor", "tiling"],
  siding: ["siding contractor"],
  gutters: ["gutter"],
  fencing: ["fence contractor", "fence"],
  masonry_concrete: ["concrete contractor", "masonry", "mason", "stone"],
  paving: ["paving", "asphalt", "driveway"],
  insulation: ["insulation"],
  restoration: ["restoration", "water damage", "fire damage", "mold"],
  chimney: ["chimney"],
  pressure_washing: ["pressure washing", "power washing"],
  junk_removal: ["junk removal", "debris removal", "hauling"],
  house_cleaning: ["house cleaning", "cleaning service", "maid"],
  carpet_cleaning: ["carpet cleaning", "upholstery cleaning"],
  window_cleaning: ["window cleaning"],
  handyman: ["handyman"],
  excavation: ["excavating", "excavation"],
  demolition: ["demolition"],
  garage_door: ["garage door"],
  locksmith: ["locksmith"],
  appliance_repair: ["appliance repair"],
  pest_control: ["pest control", "exterminator"],
  tree_care: ["tree service", "arborist", "tree removal"],
  pool_spa: ["swimming pool", "pool cleaning", "hot tub"],
  irrigation: ["sprinkler", "irrigation"],
  snow_removal: ["snow removal", "snow plow"],
  home_inspection: ["home inspector", "building inspector"],
  remodeling: ["remodeler", "bathroom remodeler", "kitchen remodeler", "renovation"],
  general_contracting: ["general contractor", "construction company", "contractor"],
});

/** "Plumber" → "plumbing"; "Plumbing supply store" → null. */
export function tradeKeyForListingCategory(category) {
  const c = String(category ?? "").toLowerCase().trim();
  if (!c) return null;
  if (/\b(supply|supplier|store|shop|warehouse|wholesaler|manufacturer|showroom|school|association|rental)\b/.test(c) && !/garage door supplier/.test(c)) {
    // A supply house is a retailer, whatever trade word it carries —
    // lib/sales/discovery/classify.js draws the same line for directory
    // rows. Garage door suppliers are Google's own category for installers.
    return null;
  }
  for (const key of Object.keys(DISCOVERY_TRADES)) {
    const words = MAPS_CATEGORY_WORDS[key] || [];
    if (words.some((w) => c.includes(w))) return key;
  }
  return null;
}

/** The Maps search term for a trade, or the trade's own label as a last
 *  resort so an unlisted trade still produces a search a person could type. */
export function searchTermForTrade(tradeKey) {
  if (!isDiscoveryTradeKey(tradeKey)) return null;
  return MAPS_SEARCH_TERMS[tradeKey] || String(DISCOVERY_TRADES[tradeKey].label).toLowerCase();
}

// ── The listing, normalised ──────────────────────────────────────────────

/**
 * "9648 Prospect Ave, Lakeside, CA 92040, United States" → the parts.
 *
 * Google formats US and Canadian addresses as street, city, "REGION
 * POSTAL", country. A listing with no street ("Lakeside, CA 92040, United
 * States") still parses — the city is whatever precedes the region line.
 * Anything that does not fit is returned as { addressLine: whole } and
 * nothing else is guessed.
 */
export function parseFormattedAddress(formatted, { countryHint = null } = {}) {
  const parts = String(formatted ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const out = { addressLine: null, city: null, province: null, postalCode: null, country: countryHint || null };
  if (!parts.length) return out;
  const countryWords = { "united states": "US", usa: "US", canada: "CA" };
  let rest = parts;
  const last = rest[rest.length - 1].toLowerCase();
  if (countryWords[last]) {
    out.country = countryWords[last];
    rest = rest.slice(0, -1);
  }
  const region = rest[rest.length - 1] || "";
  const m = region.match(/^([A-Z]{2})(?:\s+(\d{5}(?:-\d{4})?|[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d))?$/);
  if (m) {
    out.province = m[1];
    out.postalCode = m[2] ? m[2].toUpperCase().replace(/^([A-Z]\d[A-Z])(\d[A-Z]\d)$/, "$1 $2") : null;
    rest = rest.slice(0, -1);
    if (!out.country && /^\d{5}/.test(out.postalCode || "")) out.country = "US";
    if (!out.country && /^[A-Z]\d[A-Z]/.test(out.postalCode || "")) out.country = "CA";
  }
  if (rest.length >= 2) {
    out.city = rest[rest.length - 1];
    out.addressLine = rest.slice(0, -1).join(", ");
  } else if (rest.length === 1) {
    // One part left: Google puts the locality last, so a short part with
    // no leading number is the city; anything longer is kept whole as the
    // line rather than guessed at.
    if (/^\d/.test(rest[0]) || rest[0].split(/\s+/).length > 3) out.addressLine = rest[0];
    else out.city = rest[0];
  }
  if (!out.city && !out.addressLine && !out.province) out.addressLine = String(formatted).trim() || null;
  return out;
}

/**
 * A scraped record as the matcher and the writer read it. Every field is
 * optional; nothing is invented for a missing one.
 */
export function normaliseListing(raw = {}) {
  const parsed = parseFormattedAddress(raw.address, { countryHint: raw.country || null });
  const websiteUrl = raw.websiteUrl ? cleanWebsite(raw.websiteUrl) : null;
  const rating = Number.isFinite(Number(raw.rating)) && raw.rating !== null && raw.rating !== "" ? Number(raw.rating) : null;
  const reviewCount = Number.isFinite(Number(raw.reviewCount)) && raw.reviewCount !== null && raw.reviewCount !== "" ? Number(raw.reviewCount) : null;
  const lat = Number(raw.latitude);
  const lng = Number(raw.longitude);
  return {
    placeId: typeof raw.placeId === "string" && /^ChIJ[0-9A-Za-z_-]{10,}$/.test(raw.placeId) ? raw.placeId : null,
    cid: raw.cid || null,
    name: String(raw.name ?? "").trim(),
    category: raw.category ? String(raw.category).trim() : null,
    tradeKey: tradeKeyForListingCategory(raw.category),
    address: raw.address ? String(raw.address).trim() : null,
    addressLine: parsed.addressLine,
    city: parsed.city,
    province: parsed.province,
    postalCode: parsed.postalCode,
    country: parsed.country,
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lng) ? lng : null,
    plusCode: raw.plusCode || null,
    phone: raw.phone ? String(raw.phone).trim() : null,
    phoneE164: raw.phone ? normalisePhone(raw.phone) : null,
    websiteUrl,
    domain: websiteUrl ? normaliseDomain(websiteUrl) : null,
    rating,
    reviewCount,
    starHistogram: Array.isArray(raw.starHistogram) ? raw.starHistogram.map((n) => Number(n) || 0).slice(0, 5) : null,
    hours: Array.isArray(raw.hours) && raw.hours.length ? raw.hours.map(String).slice(0, 7) : null,
    businessStatus: raw.businessStatus || null,
    claimed: typeof raw.claimed === "boolean" ? raw.claimed : null,
    priceBracket: raw.priceBracket || null,
    listingUrl: raw.listingUrl || null,
    searchTerm: raw.searchTerm || null,
    searchLocation: raw.searchLocation || null,
    tile: raw.tile || null,
  };
}

/** The listing in the Places API's shape, so places.js's scorer and write
 *  plan read it unchanged. `id` is null for a CID-only listing: the plan
 *  then writes no googlePlaceId, and applyListing strips the blank. */
export function listingToPlace(listing) {
  return {
    id: listing.placeId || null,
    displayName: { text: listing.name },
    formattedAddress: listing.address,
    websiteUri: listing.websiteUrl,
    internationalPhoneNumber: listing.phone,
    rating: listing.rating,
    userRatingCount: listing.reviewCount,
    businessStatus: listing.businessStatus,
    regularOpeningHours: listing.hours ? { weekdayDescriptions: listing.hours } : null,
    location:
      listing.latitude !== null && listing.longitude !== null
        ? { latitude: listing.latitude, longitude: listing.longitude }
        : null,
    types: listing.category ? [listing.category] : [],
  };
}

/** Does this unmatched listing look like a lead worth a register row?
 *  A phone to dial, not closed, and a category that maps to a trade. */
export function looksLikeNewLead(listing) {
  return Boolean(listing.phoneE164) && listing.businessStatus !== CLOSED_PERMANENTLY && listing.businessStatus !== "CLOSED_TEMPORARILY" && Boolean(listing.tradeKey);
}

// ── Candidates ───────────────────────────────────────────────────────────

/** The listing's name words worth a lookup: distinctive ones first, and if
 *  it has none, every token — a generic name then needs the area to agree. */
export function lookupTokens(name) {
  const all = [...nameTokens(name)];
  const strong = all.filter(distinctive);
  return { tokens: (strong.length ? strong : all).slice(0, 3), generic: strong.length === 0 };
}

/** The Prisma where for the candidate net. Pure, so the check can read it. */
export function candidateWhere(listing) {
  const or = [];
  if (listing.placeId) or.push({ googlePlaceId: listing.placeId });
  if (listing.phoneE164) or.push({ phoneE164: listing.phoneE164 });
  if (listing.domain) or.push({ domain: listing.domain });
  const { tokens, generic } = lookupTokens(listing.name);
  if (tokens.length) {
    const area = [];
    if (listing.city) area.push({ city: { equals: listing.city, mode: "insensitive" } });
    if (listing.postalCode) area.push({ postalCode: { startsWith: listing.postalCode.slice(0, 5) } });
    if (listing.latitude !== null && listing.longitude !== null) {
      const dLat = CANDIDATE_RADIUS_KM / 111;
      const dLng = CANDIDATE_RADIUS_KM / (111 * Math.max(0.2, Math.cos((listing.latitude * Math.PI) / 180)));
      area.push({
        latitude: { gte: listing.latitude - dLat, lte: listing.latitude + dLat },
        longitude: { gte: listing.longitude - dLng, lte: listing.longitude + dLng },
      });
    }
    const nameClause = generic
      ? { AND: tokens.map((t) => ({ businessName: { contains: t, mode: "insensitive" } })) }
      : { OR: tokens.map((t) => ({ businessName: { contains: t, mode: "insensitive" } })) };
    if (area.length) or.push({ AND: [nameClause, { OR: area }] });
  }
  return { mergedIntoId: null, ...(or.length ? { OR: or } : { id: "__no_candidates__" }) };
}

export async function candidateProspects({ db = defaultDb, listing } = {}) {
  return db.prospect.findMany({
    where: candidateWhere(listing),
    select: { ...PLACES_PROSPECT_SELECT, tradingNames: true, tradeKey: true },
    take: CANDIDATE_LIMIT,
  });
}

// ── The rule, listing → prospect ─────────────────────────────────────────

/** One prospect scored against the listing. Pure. Extends places.js's
 *  scoreCandidate with the two identity signals a scrape can see. */
export function scoreProspectForListing(listing, prospect) {
  const place = listingToPlace(listing);
  // Both cities are place words for the name reading: the register's and
  // the one Google printed under the listing.
  const placeWords = placeWordsFor(prospect.city, listing.city);
  const base = scoreCandidate(prospect, place, { placeWords });
  const identity = [];
  if (listing.placeId && prospect.googlePlaceId === listing.placeId) identity.push("place_id");
  if (listing.phoneE164 && prospect.phoneE164 === listing.phoneE164) identity.push("phone");
  if (listing.domain && prospect.domain === listing.domain && !SHARED_DOMAINS.has(listing.domain)) identity.push("domain");

  // A trading name counts as the business's name too — 27.8% of Quebec's
  // licences trade under one their registered name does not contain.
  let overlap = base.nameOverlap;
  let shared = base.sharedTokens;
  let hasDistinctive = base.distinctive;
  let placesDisagree = base.placesDisagree;
  for (const alt of prospect.tradingNames || []) {
    const o = nameOverlap(alt, listing.name, { placeWords });
    if (o.overlap > overlap) {
      overlap = Number(o.overlap.toFixed(2));
      shared = o.shared;
      hasDistinctive = o.distinctive;
      placesDisagree = o.placesDisagree;
    }
  }
  const nameAgrees = overlap >= NAME_OVERLAP_MIN;
  // The place half of the rule, re-read from the signals so a trading-name
  // overlap is judged the same way the registered name would be.
  const strong = base.placeSignals.some((sig) => sig === "postal_code" || sig === "street" || sig === "within_1km");
  const weak = base.placeSignals.some((sig) => sig === "within_5km" || sig === "city");
  const placeOk = strong || (weak && hasDistinctive);

  let accept = (nameAgrees && placeOk) || (nameAgrees && identity.length > 0);
  let acceptedVia = accept ? "rule" : null;
  let reason = null;
  if (!accept) {
    if (!nameAgrees) reason = "name_disagrees";
    else if (!strong && !weak) reason = "place_disagrees";
    else reason = "generic_name_needs_strong_place";
  }
  if (!accept && identity.includes("place_id")) {
    accept = true;
    acceptedVia = "place_id";
    reason = null;
  } else if (!accept && identity.length && placesDisagree) {
    // Two towns on the two signs and one domain or number between them:
    // a franchise's branches, not a rebrand — neither an identity accept
    // nor a verify.
    reason = `${identity.join("+")}_same_different_towns`;
  } else if (!accept && identity.length && hasDistinctive) {
    // Same phone or same domain and a DISTINCTIVE word in common: the
    // register's "THOMPSON SCOTT" against Google's "Thompson's Plumbing &
    // Repair" is the sole proprietor's business. A shared trade word alone
    // is not enough — measured on the first live run, "PSI Plumbing
    // Services" and "K2 Plumbing" answer the same number, share only
    // "plumbing", and are two brands; attaching the second to the first's
    // row would have been the overwrite this path exists to refuse.
    accept = true;
    acceptedVia = "identity";
    reason = null;
  }
  // Same phone or same domain, a name that still disagrees: not accepted
  // as a match, but not refused either — `verify` says the listing is
  // attached under matched_verify, with the reason kept beside it so the
  // console can still say what the name rule thought.
  let verify = false;
  if (!accept && identity.length && !placesDisagree) {
    reason = shared.length ? `${identity.join("+")}_same_only_generic_words_shared` : `${identity.join("+")}_same_name_disagrees`;
    verify = true;
  }
  return {
    prospectId: prospect.id,
    prospectName: prospect.businessName,
    prospectCity: prospect.city || null,
    nameOverlap: overlap,
    sharedTokens: shared,
    distinctive: hasDistinctive,
    placeSignals: base.placeSignals,
    distanceKm: base.distanceKm,
    identity,
    accept,
    /** "rule" (name and place agree), "place_id", or "identity" (same phone
     *  or domain plus a distinctive word) — matchListing strikes the last
     *  when the signal is one several candidates share. */
    acceptedVia,
    verify,
    reason: accept ? null : reason,
  };
}

/**
 * Pick the one prospect this listing corroborates, or say why none.
 *
 * @returns { verdict, prospect|null, score, candidates }
 */
export function matchListing(listing, candidates = []) {
  const list = (Array.isArray(candidates) ? candidates : []).filter((p) => p && p.id);
  if (!list.length) return { verdict: LISTING_VERDICTS.NO_CANDIDATES, prospect: null, score: null, candidates: [] };
  const scored = list.map((prospect) => ({ prospect, score: scoreProspectForListing(listing, prospect) }));
  // ── A shared number or domain is not an identity ───────────────────────
  //
  // matched_verify rests on "this phone / this domain is ONE business's".
  // When two or more candidates in the net carry the listing's phone
  // (a shared answering service, a dispatcher) or its domain (a franchise
  // — servpro.com is 323 prospects; a supply chain — ferguson.com), the
  // signal names a network, not a business, and attaching the listing to
  // whichever candidate sorted first would be the wrong owner's name on a
  // card. Such a signal is struck — from a verify, and from an accept that
  // rested on identity plus a shared word ("Servpro of Lakeside" against
  // "SERVPRO OF SANTEE" on servpro.com was accepted that way before
  // 2026-09-21) — and the refusal stands with the reason saying why. An
  // accept on name AND place is untouched.
  const phoneHolders = listing.phoneE164 ? list.filter((p) => p.phoneE164 === listing.phoneE164).length : 0;
  const domainHolders = listing.domain ? list.filter((p) => p.domain === listing.domain).length : 0;
  for (const s of scored) {
    if (!s.score.verify && s.score.acceptedVia !== "identity") continue;
    const unique = s.score.identity.filter((k) => (k === "phone" ? phoneHolders < 2 : k === "domain" ? domainHolders < 2 : true));
    if (unique.length) continue;
    s.score.verify = false;
    s.score.accept = false;
    s.score.acceptedVia = null;
    s.score.reason = `${s.score.identity.join("+")}_shared_by_${Math.max(phoneHolders, domainHolders)}_prospects`;
  }
  // Accepted first, then the verify rows, then the refused: a listing with
  // a plain match somewhere in the net is that match, never a verify.
  scored.sort((a, b) => {
    if (a.score.accept !== b.score.accept) return a.score.accept ? -1 : 1;
    if (a.score.verify !== b.score.verify) return a.score.verify ? -1 : 1;
    if (a.score.identity.length !== b.score.identity.length) return b.score.identity.length - a.score.identity.length;
    if (a.score.nameOverlap !== b.score.nameOverlap) return b.score.nameOverlap - a.score.nameOverlap;
    if (a.score.placeSignals.length !== b.score.placeSignals.length) return b.score.placeSignals.length - a.score.placeSignals.length;
    return (a.score.distanceKm ?? Infinity) - (b.score.distanceKm ?? Infinity);
  });
  const top = scored[0];
  const alsoAccepted = scored.slice(1).filter((s) => s.score.accept).map((s) => s.score.prospectId);
  const alsoVerify = scored.slice(1).filter((s) => s.score.verify && !s.score.accept).map((s) => s.score.prospectId);
  const verdict = top.score.accept ? LISTING_VERDICTS.MATCHED : top.score.verify ? LISTING_VERDICTS.MATCHED_VERIFY : LISTING_VERDICTS.NO_CONFIDENT_MATCH;
  return {
    verdict,
    prospect: verdict === LISTING_VERDICTS.NO_CONFIDENT_MATCH ? null : top.prospect,
    score: { ...top.score, alsoAccepted, alsoVerify },
    candidates: scored.map((s) => s.score).slice(0, 10),
  };
}

// ── Writes ───────────────────────────────────────────────────────────────

/** The ExternalListing row for a sighting. `matched*` is set only on a
 *  match and never cleared by a later sighting that could not match. */
export function listingRow(listing, { now = new Date(), runId = null, verdict = null, matchedProspectId = null, matchResult = null } = {}) {
  const externalId = listing.placeId || (listing.cid ? `cid:${listing.cid}` : null);
  if (!externalId) return null;
  const payload = {
    phone: listing.phone,
    plusCode: listing.plusCode,
    hours: listing.hours,
    starHistogram: listing.starHistogram,
    priceBracket: listing.priceBracket,
    listingUrl: listing.listingUrl,
    address: listing.address,
    cid: listing.cid,
    tile: listing.tile,
    searchTerm: listing.searchTerm,
    searchLocation: listing.searchLocation,
    seenAt: now.toISOString(),
  };
  const shared = {
    name: listing.name || "(unnamed)",
    phoneE164: listing.phoneE164,
    domain: listing.domain,
    websiteUrl: listing.websiteUrl,
    addressLine: listing.addressLine,
    city: listing.city,
    province: listing.province,
    postalCode: listing.postalCode,
    country: listing.country,
    latitude: listing.latitude,
    longitude: listing.longitude,
    category: listing.category,
    rating: listing.rating === null ? null : String(listing.rating),
    reviewCount: listing.reviewCount,
    payload,
    keyword: listing.searchTerm,
    location: listing.searchLocation,
    tradeKey: listing.tradeKey,
    businessStatus: listing.businessStatus,
    claimed: listing.claimed,
    fetchedAt: now,
    lastSeenAt: now,
    matchVerdict: verdict,
    matchResult,
    // The run that LAST saw it, beside lastSeenAt — so "what did the latest
    // run read" (lib/sales/intel/mapsScrapeStatus.js) counts a re-sighting
    // in the run that re-sighted it. Found missing on 2026-09-20: this
    // function took `runId` and wrote it nowhere, so all 4,239 rows of the
    // first two nights carry null; the status page names that bucket
    // rather than pretending they were one run.
    ...(runId ? { runId } : {}),
  };
  return {
    where: { source_externalId: { source: MAPS_SOURCE, externalId } },
    create: {
      source: MAPS_SOURCE,
      externalId,
      ...shared,
      matchedProspectId,
      matchedAt: matchedProspectId ? now : null,
    },
    update: {
      ...shared,
      ...(matchedProspectId ? { matchedProspectId, matchedAt: now } : {}),
    },
  };
}

/**
 * One listing, end to end: find the prospect, write what the rule allows,
 * record the sighting.
 *
 * @returns { verdict, prospectId, gained, conflicts, closed, newLeadLike,
 *            score, listingId }
 */
export async function applyListing({ db = defaultDb, raw, now = new Date(), runId = null, dry = false, deps = {} } = {}) {
  const listing = normaliseListing(raw);
  const rerun = deps.rerunChainForNewWebsite || rerunChainForNewWebsite;
  const result = {
    verdict: null,
    prospectId: null,
    gained: [],
    conflicts: [],
    closed: listing.businessStatus === CLOSED_PERMANENTLY,
    newLeadLike: false,
    score: null,
    listingId: null,
    listing,
  };
  if (!listing.name) {
    result.verdict = "unnamed";
    return result;
  }

  const candidates = await candidateProspects({ db, listing });
  const match = matchListing(listing, candidates);
  result.score = match.score;
  const verify = match.verdict === LISTING_VERDICTS.MATCHED_VERIFY;

  if (match.verdict !== LISTING_VERDICTS.MATCHED && !verify) {
    result.verdict = match.verdict;
    result.newLeadLike = looksLikeNewLead(listing);
    const row = listingRow(listing, { now, runId, verdict: match.verdict, matchResult: match.score ? { candidate: match.score, candidates: match.candidates } : null });
    if (row && !dry) {
      const saved = await db.externalListing.upsert({ ...row, select: { id: true, matchedProspectId: true } });
      result.listingId = saved.id;
      // A listing attached on an earlier run stays attached: this run's
      // candidate net may have missed the row (a retired duplicate, say).
      if (saved.matchedProspectId) result.verdict = "already_attached";
    }
    return result;
  }

  const prospect = match.prospect;
  result.prospectId = prospect.id;

  if (prospect.googlePlaceId && listing.placeId && prospect.googlePlaceId !== listing.placeId) {
    // The row already IS a different listing. Google may list one business
    // twice (an old pin and a new one); attaching the second over the first
    // is exactly the overwrite this path must never make.
    result.verdict = LISTING_VERDICTS.PLACE_ID_CONFLICT;
    const row = listingRow(listing, { now, runId, verdict: result.verdict, matchResult: { candidate: match.score, conflictsWith: prospect.googlePlaceId } });
    if (row && !dry) result.listingId = (await db.externalListing.upsert({ ...row, select: { id: true } })).id;
    return result;
  }

  const [taken, numbers] = await Promise.all([
    listing.placeId
      ? db.prospect.findFirst({ where: { googlePlaceId: listing.placeId, NOT: { id: prospect.id } }, select: { id: true } })
      : Promise.resolve(null),
    db.salesContactNumber.findMany({ where: { prospectId: prospect.id }, select: { e164: true } }),
  ]);

  const plan = planPlacesWrite({
    prospect,
    place: listingToPlace(listing),
    score: match.score,
    placeIdTakenBy: taken?.id || null,
    existingNumbers: numbers.map((n) => n.e164),
    now,
    provenance: MAPS_PROVENANCE,
  });
  if (!listing.placeId) {
    delete plan.data.googlePlaceId;
    plan.gained = plan.gained.filter((g) => g !== "googlePlaceId");
  }
  if (verify && plan.verdict === PLACES_VERDICTS.MATCHED) {
    // The same fill, under the verify verdict, with the fact in front of
    // every other confirmation so the card and the brief lead with it.
    const fact = verifyConfirmation({ identity: match.score.identity, name: listing.name });
    plan.verdict = LISTING_VERDICTS.MATCHED_VERIFY;
    plan.data.placesVerdict = LISTING_VERDICTS.MATCHED_VERIFY;
    plan.confirmations = [fact, ...plan.confirmations];
    plan.data.placesResult = { ...plan.data.placesResult, confirmations: plan.confirmations };
    plan.evidence.push({
      prospectId: prospect.id,
      type: "google_field",
      source: "google",
      sourceUrl: plan.data.placesResult?.mapsUrl || null,
      rawValue: fact.text.slice(0, 2000),
      normalizedValue: String(listing.name).slice(0, 500),
      observedAt: now,
      confidence: 0.7,
      detector: `${MAPS_DETECTOR}:identity_verify`,
      detectorVersion: MAPS_DETECTOR_VERSION,
    });
  }
  const attached = plan.verdict === PLACES_VERDICTS.MATCHED || plan.verdict === LISTING_VERDICTS.MATCHED_VERIFY;
  result.verdict = plan.verdict === PLACES_VERDICTS.MATCHED ? LISTING_VERDICTS.MATCHED : plan.verdict;
  result.gained = plan.gained;
  result.conflicts = plan.conflicts;
  result.confirmations = plan.confirmations;

  const row = listingRow(listing, {
    now,
    runId,
    verdict: result.verdict,
    matchedProspectId: attached ? prospect.id : null,
    matchResult: { candidate: match.score, gained: plan.gained, conflicts: plan.conflicts },
  });
  if (dry) return result;

  await db.$transaction(async (tx) => {
    await tx.prospect.update({ where: { id: prospect.id }, data: plan.data });
    if (plan.evidence.length) await tx.prospectEvidence.createMany({ data: plan.evidence });
    if (plan.contactNumber) await tx.salesContactNumber.create({ data: plan.contactNumber });
    if (row) result.listingId = (await tx.externalListing.upsert({ ...row, select: { id: true } })).id;
  });

  if (plan.gained.includes("websiteUrl")) {
    try {
      result.research = await rerun({ db, prospect, now });
    } catch (err) {
      result.research = { error: err?.message || String(err) };
    }
  }
  return result;
}

// ── Metering ─────────────────────────────────────────────────────────────

function utcDay(now) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** N places read from the Mac today, at zero dollars. Never throws. */
export async function meterLocalScrape({ db = defaultDb, now = new Date(), places = 0 } = {}) {
  const n = Math.max(0, Math.floor(Number(places) || 0));
  if (!n) return null;
  try {
    return await db.platformCostDaily.upsert({
      where: { day_provider_category: { day: utcDay(now), provider: LOCAL_SCRAPE_PROVIDER, category: LOCAL_SCRAPE_CATEGORY } },
      create: {
        day: utcDay(now),
        provider: LOCAL_SCRAPE_PROVIDER,
        category: LOCAL_SCRAPE_CATEGORY,
        cents: 0,
        currency: "USD",
        units: n,
        unit: "places",
        count: n,
        source: LOCAL_SCRAPE_SOURCE,
        fetchedAt: now,
      },
      update: { units: { increment: n }, count: { increment: n }, fetchedAt: now },
    });
  } catch (err) {
    console.error("[listings] scrape volume not metered:", err?.message);
    return null;
  }
}

// ── The order the scrape works in ────────────────────────────────────────

/**
 * (term, location, country) pairs from the leads reps currently hold —
 * trade × city of every open claim, most-held first — so the first scrape
 * corroborates the rows somebody is about to dial.
 *
 * STAND-IN: enrichmentOrder.js (claimed leads, then the trades being
 * worked, then next in dispatch) replaces this when it lands; the shape
 * returned here is what maps.mjs --from-order consumes.
 */
export async function enrichmentPairs({ db = defaultDb, limit = 20 } = {}) {
  const claims = await db.salesQueueClaim.findMany({
    where: { releasedAt: null },
    select: { prospect: { select: { tradeKey: true, city: true, province: true, country: true } } },
    take: 5000,
  });
  const groups = new Map();
  for (const c of claims) {
    const p = c.prospect;
    if (!p?.tradeKey || !p.city) continue;
    const term = searchTermForTrade(p.tradeKey);
    if (!term) continue;
    const city = String(p.city).trim().replace(/\s+/g, " ");
    const cityLabel = city.toUpperCase() === city ? city.toLowerCase().replace(/\b\p{L}/gu, (ch) => ch.toUpperCase()) : city;
    const location = [cityLabel, p.province].filter(Boolean).join(", ");
    const country = p.country || (p.province && /^[A-Z]{2}$/.test(p.province) && ["QC", "ON", "BC", "AB", "MB", "SK", "NS", "NB", "NL", "PE", "YT", "NT", "NU"].includes(p.province) ? "CA" : "US");
    const key = `${p.tradeKey}|${location.toLowerCase()}|${country}`;
    const cur = groups.get(key) || { term, tradeKey: p.tradeKey, location, country, held: 0, reason: "held" };
    cur.held += 1;
    groups.set(key, cur);
  }
  return [...groups.values()].sort((a, b) => b.held - a.held || a.location.localeCompare(b.location)).slice(0, Math.max(1, limit));
}
