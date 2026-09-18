// lib/sales/intel/places.js
//
// Google Places as a CORROBORATING source for a prospect the registers
// described thinly.
//
// ══ Why this exists ════════════════════════════════════════════════════════
//
// DRAIN KINGS, Chatsworth CA, from the California CSLB C-36 register. The
// register publishes no website column, so the rep's card said "Website:
// none on record — nothing has crawled this business", and the whole
// research chain below the directory record was "unknown rather than
// absent". drainkingslosangeles.com was the first Google result. The owner
// asked for Places to be used to corroborate and enrich leads, starting with
// the ones already in reps' hands. Measured before this was written: 138
// prospects held, 27 of them with no domain, 0 of 321,668 with a
// googlePlaceId — Places had never been used for enrichment at all.
//
// ══ The match rule, executed and checked ═══════════════════════════════════
//
// A Text Search for "DRAIN KINGS 9842 Owensmouth Ave Chatsworth CA" returns
// whatever Google thinks is closest, and "closest" for a two-word plumbing
// name in Los Angeles is a list. Attaching the wrong business is worse than
// attaching nothing: the rep opens with "I see your site is X" to somebody
// who has never owned X, and the crawl then reads a stranger's pages into
// this row's capabilities. So a candidate is accepted ONLY when
//
//   1. the NAME agrees — after stripping legal suffixes and light plural
//      stemming, at least NAME_OVERLAP_MIN of the register's name tokens
//      appear in the candidate's; and
//   2. the PLACE agrees — a strong signal (postal code, street number and
//      street, or a pin within NEAR_STRONG_KM of the register's geocode), or
//      a weak one (the city named in the candidate's address, or a pin
//      within NEAR_WEAK_KM) when the name carries at least one DISTINCTIVE
//      token. "Plumbing Services Inc" has no distinctive token — every city
//      has one — so for it only a strong place signal will do.
//
// Anything weaker is stored as `no_confident_match` with the top candidate's
// name, address and the reason it was refused, for a human on
// /platform/sales/prospects to confirm. scripts/check-places-enrich.mjs
// drives the rule over the hostile shapes: same name in a different city, a
// similar name next door, a chain with many locations, a permanently closed
// listing, no results at all.
//
// ══ What a match is allowed to write ═══════════════════════════════════════
//
// Blanks only. `domain`, `websiteUrl`, `hasWebsite`, `googleRating`,
// `googleReviewCount`, `businessStatus`, `latitude`/`longitude` and
// `phoneE164` are filled when null and left alone otherwise — the register's
// value, or one a human typed, is never replaced. Google's own values go in
// `placesResult` beside the row, and the console prints the two side by side
// where they disagree. A Places phone that differs from the record's becomes
// a SalesContactNumber (the second-number table reps already use), never an
// overwrite of the dedupe key. Every field written is also a ProspectEvidence
// row the brief can cite: "Google lists a website: …".
//
// `hasWebsite: true` from a directory listing follows the ingest's own
// precedent (lib/sales/discovery/normalise.js sets it from a source's
// `websites`); `false` is still only ever a crawl's to say.
//
// ══ Cost ═══════════════════════════════════════════════════════════════════
//
// The field mask asks for websiteUri, the phone numbers, rating,
// userRatingCount and regularOpeningHours, which puts every request on the
// Text Search ENTERPRISE SKU: US$35.00 per 1,000 requests at the 0–100k
// tier, with 1,000 requests a month free (developers.google.com/maps/
// billing-and-pricing/pricing, read 2026-09-17; the Pro SKU without those
// fields is $32.00 and would tell us nothing we came for). Each request is
// metered into PlatformCostDaily at list price the moment it is made —
// including a request that returned nothing, because Google bills those too
// — so the platform console can show what this has cost before the invoice
// does. PLACES_RECHECK_DAYS is the idempotency window: a row checked inside
// it is skipped, which is what bounds "check the held leads" pressed twice.
import { db as defaultDb } from "@/lib/db";
import { serverMapsKey } from "@/lib/measure/roofMeasurement";
import { normaliseDomain, normalisePhone } from "@/lib/sales/suppressionRules";
import { cleanWebsite } from "@/lib/sales/discovery/normalise";
import { enqueuePipelineTask } from "@/lib/sales/pipeline/tasks";
import { notBeforeFor } from "@/lib/sales/pipeline/priority";
import { recordError, errorDetail } from "@/lib/platform/errorLog";

export const PLACES_ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

/** Exactly what is read, and nothing else — every field named here is on
 *  the Enterprise SKU or below, and an unlisted field is not billed. */
export const PLACES_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.rating",
  "places.userRatingCount",
  "places.businessStatus",
  "places.regularOpeningHours",
  "places.location",
  "places.types",
].join(",");

/** Text Search Enterprise, list price, 0–100k tier: US$35 / 1,000. */
export const PLACES_SKU = "text-search-enterprise";
export const PLACES_COST_MICROS = 35_000;
export const PLACES_FREE_PER_MONTH = 1_000;
export const PLACES_PROVIDER = "google_places";
export const PLACES_COST_SOURCE = "list_price_metered";

export const PLACES_RECHECK_DAYS = 90;
export const PLACES_MAX_RESULTS = 5;

/** The evidence vocabulary this writes in. `google` and `google_field` are
 *  the source and type ProspectEvidence's schema comment already lists. */
export const PLACES_EVIDENCE_SOURCE = "google";
export const PLACES_EVIDENCE_TYPE = "google_field";
export const PLACES_DETECTOR = "places.textSearch";
export const PLACES_DETECTOR_VERSION = "1";

export const PLACES_VERDICTS = Object.freeze({
  MATCHED: "matched",
  NO_CONFIDENT_MATCH: "no_confident_match",
  NO_RESULTS: "no_results",
  DUPLICATE_PLACE: "duplicate_place",
  ERROR: "error",
});

export const NAME_OVERLAP_MIN = 0.6;
export const NEAR_STRONG_KM = 1;
export const NEAR_WEAK_KM = 5;

/** What Google says when a listing has shut. Flagged, never suppressed:
 *  Google is sometimes wrong about this, and a human decides. */
export const CLOSED_PERMANENTLY = "CLOSED_PERMANENTLY";

// ── Name tokens ──────────────────────────────────────────────────────────

/** Words that say what KIND of entity a business is, not which one. */
const LEGAL_SUFFIXES = new Set([
  "inc", "incorporated", "llc", "l.l.c", "ltd", "limited", "ltee", "ltée", "corp", "corporation",
  "co", "company", "enterprise", "enterprises", "group", "holdings", "dba", "the", "and", "of",
  "a", "an", "&", "de", "du", "des", "la", "le", "les", "et", "senc", "s.e.n.c", "cie",
]);

/** Words that say what TRADE a business is in. Common to thousands of
 *  names, so a match resting on them alone is a match on the Yellow Pages
 *  heading, not the business. */
const GENERIC_TRADE_WORDS = new Set([
  "plumbing", "plumber", "plumbers", "drain", "drains", "sewer", "rooter", "roofing", "roofer",
  "roofers", "roof", "roofs", "painting", "painter", "painters", "paint", "electric", "electrical",
  "electrician", "electricians", "hvac", "heating", "cooling", "air", "conditioning", "ac",
  "landscaping", "landscape", "landscapes", "lawn", "garden", "gardens", "tree", "trees",
  "flooring", "floor", "floors", "carpet", "tile", "cabinet", "cabinets", "cabinetry", "kitchen",
  "kitchens", "bath", "bathroom", "remodeling", "remodel", "renovation", "renovations", "construction",
  "contractor", "contractors", "contracting", "builder", "builders", "building", "home", "homes",
  "house", "services", "service", "solutions", "systems", "repair", "repairs", "maintenance",
  "installation", "installations", "design", "designs", "pro", "pros", "professional", "professionals",
  "quality", "general", "custom", "residential", "commercial", "handyman", "concrete", "masonry",
  "fence", "fencing", "deck", "decks", "window", "windows", "door", "doors", "gutter", "gutters",
  "siding", "insulation", "pool", "pools", "spa", "septic", "water", "solar", "energy", "mechanical",
  "us", "usa", "america", "american", "canada", "canadian", "california", "quebec", "québec",
  "toiture", "toitures", "plomberie", "peinture", "construction", "rénovation", "renovation",
  "électrique", "electrique", "excavation", "paysagement", "entreprises", "entreprise",
]);

function stripDiacritics(value) {
  return String(value ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** A name as a set of comparable tokens. Lowercased, de-accented,
 *  punctuation dropped, legal suffixes removed, a trailing s stemmed so
 *  "Kings" and "King" agree. */
export function nameTokens(name) {
  const out = new Set();
  for (const raw of stripDiacritics(name).toLowerCase().replace(/[^a-z0-9&' ]+/g, " ").split(/\s+/)) {
    const bare = raw.replace(/'s$/, "").replace(/'/g, "");
    if (!bare || LEGAL_SUFFIXES.has(bare)) continue;
    const stem = bare.length > 3 && bare.endsWith("s") && !bare.endsWith("ss") ? bare.slice(0, -1) : bare;
    out.add(stem);
  }
  return out;
}

/** True when the token is not a trade heading or a place word. Exported
 *  for the Maps-scrape matcher, which needs the same judgement to decide
 *  which words of a listing's name are worth a database lookup. */
export function distinctive(token) {
  if (GENERIC_TRADE_WORDS.has(token)) return false;
  if (GENERIC_TRADE_WORDS.has(`${token}s`)) return false;
  if (/^\d+$/.test(token)) return false;
  return token.length >= 3;
}

/**
 * How much of the register's name the candidate carries, in [0, 1], plus
 * whether any shared token is distinctive.
 *
 * Measured against the REGISTER's tokens rather than the union: "Drain
 * Kings" against "Drain Kings Los Angeles" is a whole match, not half of
 * one. The candidate's extra tokens cost nothing — Google's display names
 * carry the city routinely.
 */
export function nameOverlap(registerName, candidateName) {
  const a = nameTokens(registerName);
  const b = nameTokens(candidateName);
  if (!a.size || !b.size) return { overlap: 0, shared: [], distinctive: false };
  const shared = [...a].filter((t) => b.has(t));
  return {
    overlap: shared.length / a.size,
    shared,
    distinctive: shared.some(distinctive),
  };
}

// ── Place agreement ───────────────────────────────────────────────────────

export function distanceKm(a, b) {
  const lat1 = Number(a?.latitude ?? a?.lat);
  const lon1 = Number(a?.longitude ?? a?.lng);
  const lat2 = Number(b?.latitude ?? b?.lat);
  const lon2 = Number(b?.longitude ?? b?.lng);
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return null;
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function normPostal(value) {
  const v = stripDiacritics(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!v) return null;
  // US ZIP+4 → ZIP; Canadian FSA+LDU compared whole.
  return /^\d{9}$/.test(v) ? v.slice(0, 5) : v;
}

function normText(value) {
  return stripDiacritics(value).toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

/** The street number and the first street word of an address line —
 *  "9842 Owensmouth Ave" → { number: "9842", street: "owensmouth" }. */
export function streetKey(addressLine) {
  const m = normText(addressLine).match(/^(\d+[a-z]?)\s+([a-z0-9]+)/);
  if (!m) return null;
  const street = ["n", "s", "e", "w", "north", "south", "east", "west", "rue", "boul", "boulevard", "ave", "avenue", "st", "street", "ch", "chemin"].includes(m[2])
    ? (normText(addressLine).split(" ")[2] || null)
    : m[2];
  if (!street) return null;
  return { number: m[1], street };
}

/**
 * Does the candidate's formatted address agree with the register's row?
 *
 * @returns { strong: boolean, weak: boolean, signals: string[], distanceKm }
 */
export function placeAgreement(prospect, place) {
  const signals = [];
  const formatted = normText(place?.formattedAddress);

  // Whole postal tokens only — a five-digit street number must not pass
  // as a ZIP. US ZIP (with or without +4) and Canadian FSA LDU.
  const postal = normPostal(prospect?.postalCode);
  const formattedPostals = (String(place?.formattedAddress ?? "").match(/\b(\d{5}(?:-\d{4})?|[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d)\b/g) || []).map(normPostal);
  if (postal && formattedPostals.includes(postal)) signals.push("postal_code");

  const key = streetKey(prospect?.addressLine);
  if (key && formatted.includes(`${key.number} `) && formatted.includes(key.street)) signals.push("street");

  const km = distanceKm(
    { latitude: prospect?.latitude, longitude: prospect?.longitude },
    place?.location || null,
  );
  if (km !== null && km <= NEAR_STRONG_KM) signals.push("within_1km");
  else if (km !== null && km <= NEAR_WEAK_KM) signals.push("within_5km");

  const city = normText(prospect?.city);
  if (city && formatted.includes(city)) signals.push("city");

  const strong = signals.some((s) => s === "postal_code" || s === "street" || s === "within_1km");
  const weak = signals.some((s) => s === "within_5km" || s === "city");
  return { strong, weak, signals, distanceKm: km };
}

// ── The rule ─────────────────────────────────────────────────────────────

/** One candidate scored against the row. Pure. */
export function scoreCandidate(prospect, place) {
  const name = nameOverlap(prospect?.businessName, place?.displayName?.text ?? place?.displayName);
  const where = placeAgreement(prospect, place);
  const nameOk = name.overlap >= NAME_OVERLAP_MIN;
  const placeOk = where.strong || (where.weak && name.distinctive);
  let reason = null;
  if (!nameOk) reason = "name_disagrees";
  else if (!where.strong && !where.weak) reason = "place_disagrees";
  else if (!placeOk) reason = "generic_name_needs_strong_place";
  return {
    placeId: place?.id || null,
    name: place?.displayName?.text ?? place?.displayName ?? null,
    address: place?.formattedAddress || null,
    nameOverlap: Number(name.overlap.toFixed(2)),
    sharedTokens: name.shared,
    distinctive: name.distinctive,
    placeSignals: where.signals,
    distanceKm: where.distanceKm === null ? null : Number(where.distanceKm.toFixed(2)),
    accept: nameOk && placeOk,
    reason,
  };
}

/**
 * Pick the one candidate to attach, or say why none was.
 *
 * @returns { verdict, place|null, score, candidates }
 *   verdict is PLACES_VERDICTS.MATCHED / NO_CONFIDENT_MATCH / NO_RESULTS.
 *   `score` is the accepted candidate's, or the top refused one's — the
 *   thing a human reads to confirm or dismiss it.
 */
export function matchPlaces(prospect, candidates = []) {
  const list = Array.isArray(candidates) ? candidates.filter((c) => c && c.id) : [];
  if (!list.length) return { verdict: PLACES_VERDICTS.NO_RESULTS, place: null, score: null, candidates: [] };

  const scored = list.map((place) => ({ place, score: scoreCandidate(prospect, place) }));
  // Best first: accepted before refused; then by name overlap; then by
  // how many place signals; then nearer.
  scored.sort((a, b) => {
    if (a.score.accept !== b.score.accept) return a.score.accept ? -1 : 1;
    if (a.score.nameOverlap !== b.score.nameOverlap) return b.score.nameOverlap - a.score.nameOverlap;
    if (a.score.placeSignals.length !== b.score.placeSignals.length) return b.score.placeSignals.length - a.score.placeSignals.length;
    const da = a.score.distanceKm ?? Infinity;
    const dbb = b.score.distanceKm ?? Infinity;
    return da - dbb;
  });
  const top = scored[0];
  return {
    verdict: top.score.accept ? PLACES_VERDICTS.MATCHED : PLACES_VERDICTS.NO_CONFIDENT_MATCH,
    place: top.score.accept ? top.place : null,
    score: top.score,
    candidates: scored.map((s) => s.score),
  };
}

// ── The request ──────────────────────────────────────────────────────────

/** The one string sent to Google: name, then whatever address parts the
 *  register gave, in the order a person would type them. */
export function placesQuery(prospect) {
  return [prospect?.businessName, prospect?.addressLine, prospect?.city, prospect?.province, prospect?.postalCode]
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean)
    .join(" ")
    .slice(0, 300);
}

/**
 * One Text Search call.
 *
 * @returns { ok: true, places } | { ok: false, status, code, message, fatal }
 *   `fatal` is true for the errors a retry cannot fix in this run — no key,
 *   the API not enabled on the project, a denied key — so a batch stops on
 *   the first one instead of paying for a hundred refusals.
 */
export async function searchPlaces({ prospect, key = serverMapsKey(), fetchImpl = fetch, languageCode = "en" } = {}) {
  if (!key) return { ok: false, status: 0, code: "no_key", message: "GOOGLE_MAPS_SERVER_KEY is not set", fatal: true };
  const textQuery = placesQuery(prospect);
  if (!textQuery) return { ok: false, status: 0, code: "no_query", message: "nothing to search for", fatal: false };
  let res;
  try {
    res = await fetchImpl(PLACES_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": PLACES_FIELD_MASK,
      },
      body: JSON.stringify({ textQuery, maxResultCount: PLACES_MAX_RESULTS, languageCode }),
    });
  } catch (err) {
    return { ok: false, status: 0, code: "network", message: err?.message || String(err), fatal: false };
  }
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const status = body?.error?.status || null;
    const fatal = res.status === 403 || res.status === 401 || status === "PERMISSION_DENIED";
    return {
      ok: false,
      status: res.status,
      code: status || `http_${res.status}`,
      message: body?.error?.message || `Places returned HTTP ${res.status}`,
      fatal,
      billed: res.status !== 403 && res.status !== 401,
    };
  }
  return { ok: true, places: Array.isArray(body?.places) ? body.places : [], billed: true };
}

// ── The write plan ───────────────────────────────────────────────────────

const MAPS_URL = (placeId) => `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}`;

/** What Google said, trimmed to what is worth keeping beside the row. */
export function placeSnapshot(place, score = null, { now = new Date() } = {}) {
  if (!place) return null;
  return {
    placeId: place.id || null,
    name: place.displayName?.text ?? place.displayName ?? null,
    address: place.formattedAddress || null,
    websiteUri: place.websiteUri || null,
    phone: place.internationalPhoneNumber || place.nationalPhoneNumber || null,
    rating: Number.isFinite(Number(place.rating)) ? Number(place.rating) : null,
    userRatingCount: Number.isFinite(Number(place.userRatingCount)) ? Number(place.userRatingCount) : null,
    businessStatus: place.businessStatus || null,
    hours: Array.isArray(place.regularOpeningHours?.weekdayDescriptions)
      ? place.regularOpeningHours.weekdayDescriptions.slice(0, 7)
      : null,
    location:
      Number.isFinite(Number(place.location?.latitude)) && Number.isFinite(Number(place.location?.longitude))
        ? { latitude: Number(place.location.latitude), longitude: Number(place.location.longitude) }
        : null,
    types: Array.isArray(place.types) ? place.types.slice(0, 10) : [],
    mapsUrl: place.id ? MAPS_URL(place.id) : null,
    score,
    at: now.toISOString(),
  };
}

/**
 * What Google CONFIRMED and what it CONTRADICTED, one entry per field, in
 * the vocabulary the rep card translates clause by clause
 * (app.salesIntel.places.* in app/i18n/appMessages.js). Stored on
 * `placesResult.confirmations` at check time so the card reads a recorded
 * finding, not a re-derivation against a row that may since have changed.
 *
 *   phone    confirmed | differs | added | google_silent
 *   website  confirmed | differs | added | google_silent
 *   status   open | closed | google_silent
 */
export const CONFIRMATION_KEYS = Object.freeze({
  "phone:confirmed": "app.salesIntel.places.phone.confirmed",
  "phone:differs": "app.salesIntel.places.phone.differs",
  "phone:added": "app.salesIntel.places.phone.added",
  "phone:google_silent": "app.salesIntel.places.phone.silent",
  "website:confirmed": "app.salesIntel.places.website.confirmed",
  "website:differs": "app.salesIntel.places.website.differs",
  "website:added": "app.salesIntel.places.website.added",
  "website:google_silent": "app.salesIntel.places.website.silent",
  "status:open": "app.salesIntel.places.status.open",
  "status:closed": "app.salesIntel.places.status.closed",
  "status:google_silent": "app.salesIntel.places.status.silent",
});

/** The English for each clause — the fallback t() prints, and what the
 *  platform console and the check read. {phone}/{site}/{status} are data. */
export const CONFIRMATION_TEXT = Object.freeze({
  "phone:confirmed": "Google confirms the phone",
  "phone:differs": "Google lists a different phone ({phone}) — added as a second number, the register's kept",
  "phone:added": "Google lists a phone the register did not ({phone})",
  "phone:google_silent": "Google lists no phone",
  "website:confirmed": "Google confirms the website",
  "website:differs": "Google lists a different website ({site}) — the record's was kept",
  "website:added": "Google lists a website the register did not ({site})",
  "website:google_silent": "Google lists no website either",
  "status:open": "Google lists the business as operating ({status})",
  "status:closed": "Google lists the business as PERMANENTLY CLOSED — confirm before dialling",
  "status:google_silent": "Google does not say whether it is still trading",
});

export function confirmation(field, state, params = {}) {
  const code = `${field}:${state}`;
  const text = (CONFIRMATION_TEXT[code] || code).replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ""));
  return { field, state, code, key: CONFIRMATION_KEYS[code] || null, params, text };
}

/**
 * Everything a MATCH writes, decided without a database.
 *
 * @param prospect          the row as read — every column this may fill
 * @param place             the accepted Places result
 * @param score             scoreCandidate() for it
 * @param placeIdTakenBy    another prospect's id already carrying this
 *                          place id, or null
 * @param existingNumbers   this prospect's SalesContactNumber e164s
 * @param provenance        which reader saw the listing. The Places API is
 *                          the default; the Google Maps scrape
 *                          (lib/sales/intel/listings.js) passes its own
 *                          detector and label so an evidence row says which
 *                          of the two produced it — same lines on the rep
 *                          card, different `detector`, and a number's note
 *                          names the surface it was read from.
 *
 * @returns { verdict, data, contactNumber, evidence, gained, conflicts,
 *            confirmations }
 *   `data` is the Prospect update; `gained` names the columns it fills;
 *   `conflicts` names the columns where Google disagreed with what was
 *   already on the row and was therefore NOT written; `confirmations` is
 *   the per-field confirmed/contradicted record (CONFIRMATION_KEYS).
 */
export function planPlacesWrite({ prospect, place, score = null, placeIdTakenBy = null, existingNumbers = [], now = new Date(), provenance = null } = {}) {
  const detector = provenance?.detector || PLACES_DETECTOR;
  const detectorVersion = provenance?.detectorVersion || PLACES_DETECTOR_VERSION;
  const surface = provenance?.surface || "Google Places";
  const numberLabel = provenance?.numberLabel || "Google listing";
  const snapshot = placeSnapshot(place, score, { now });
  if (provenance?.via) snapshot.via = provenance.via;
  const data = { placesCheckedAt: now, placesResult: snapshot };
  const gained = [];
  const conflicts = [];
  const confirmations = [];
  const evidence = [];
  const cite = (field, rawValue, normalizedValue = null) =>
    evidence.push({
      prospectId: prospect.id,
      type: PLACES_EVIDENCE_TYPE,
      source: PLACES_EVIDENCE_SOURCE,
      sourceUrl: snapshot.mapsUrl,
      rawValue: String(rawValue).slice(0, 2000),
      normalizedValue: normalizedValue === null ? null : String(normalizedValue).slice(0, 500),
      observedAt: now,
      confidence: 1.0,
      detector: `${detector}:${field}`,
      detectorVersion,
    });

  if (placeIdTakenBy && placeIdTakenBy !== prospect.id) {
    // Another row already IS this listing. Two prospects, one business —
    // the dedupe question, recorded as a verdict for the Review folder and
    // never resolved here by a write. Nothing else is filled: the values
    // would be the other row's, and the merge is a human's call.
    data.placesVerdict = PLACES_VERDICTS.DUPLICATE_PLACE;
    data.placesResult = { ...snapshot, duplicateOfProspectId: placeIdTakenBy };
    return { verdict: data.placesVerdict, data, contactNumber: null, evidence: [], gained, conflicts, confirmations };
  }

  data.placesVerdict = PLACES_VERDICTS.MATCHED;
  if (!prospect.googlePlaceId) {
    data.googlePlaceId = snapshot.placeId;
    gained.push("googlePlaceId");
  } else if (prospect.googlePlaceId !== snapshot.placeId) {
    conflicts.push("googlePlaceId");
  }

  cite("name", `Google lists this business as "${snapshot.name}"`, snapshot.name);
  if (snapshot.address) cite("address", `Google lists the address: ${snapshot.address}`, snapshot.address);

  // ── Website ──────────────────────────────────────────────────────────
  const recordDomain = prospect.domain || normaliseDomain(prospect.websiteUrl) || null;
  if (snapshot.websiteUri) {
    const domain = normaliseDomain(snapshot.websiteUri);
    const url = cleanWebsite(snapshot.websiteUri);
    if (domain && !recordDomain) {
      cite("website", `Google lists a website the register did not: ${snapshot.websiteUri}`, domain);
      confirmations.push(confirmation("website", "added", { site: domain }));
    } else if (domain && recordDomain === domain) {
      cite("website", `Google confirms the website: ${snapshot.websiteUri}`, domain);
      confirmations.push(confirmation("website", "confirmed", { site: domain }));
    } else if (domain) {
      cite("website", `Google lists a different website from the record's (${recordDomain}): ${snapshot.websiteUri}`, domain);
      confirmations.push(confirmation("website", "differs", { site: domain }));
    }
    if (domain && !prospect.domain) {
      data.domain = domain;
      gained.push("domain");
    } else if (domain && prospect.domain && prospect.domain !== domain) {
      conflicts.push("domain");
    }
    // The URL is filled only when it agrees with the domain the row will
    // carry — a websiteUrl on one domain beside a `domain` on another is the
    // conflict the crawler would then resolve by fetching the wrong one.
    const rowDomain = data.domain || prospect.domain || null;
    if (url && !prospect.websiteUrl && rowDomain === domain) {
      data.websiteUrl = url;
      gained.push("websiteUrl");
      if (prospect.hasWebsite === null || prospect.hasWebsite === undefined) {
        data.hasWebsite = true;
        gained.push("hasWebsite");
      }
    } else if (url && prospect.websiteUrl && normaliseDomain(prospect.websiteUrl) !== domain) {
      conflicts.push("websiteUrl");
    }
  } else {
    confirmations.push(confirmation("website", "google_silent"));
  }

  // ── Phone ────────────────────────────────────────────────────────────
  let contactNumber = null;
  const e164 = snapshot.phone ? normalisePhone(snapshot.phone) : null;
  if (!e164) {
    confirmations.push(confirmation("phone", "google_silent"));
  }
  if (snapshot.phone) {
    if (e164) {
      if (!prospect.phoneE164) {
        cite("phone", `Google lists a phone number the register did not: ${snapshot.phone}`, e164);
        confirmations.push(confirmation("phone", "added", { phone: snapshot.phone }));
        data.phoneE164 = e164;
        gained.push("phoneE164");
      } else if (prospect.phoneE164 === e164) {
        cite("phone", `Google confirms the phone number: ${snapshot.phone}`, e164);
        confirmations.push(confirmation("phone", "confirmed", { phone: snapshot.phone }));
      } else {
        cite("phone", `Google lists a different phone number from the register's (${prospect.phoneE164}): ${snapshot.phone}`, e164);
        confirmations.push(confirmation("phone", "differs", { phone: snapshot.phone }));
        conflicts.push("phoneE164");
        if (!existingNumbers.includes(e164)) {
          contactNumber = {
            prospectId: prospect.id,
            e164,
            kind: "unknown",
            label: numberLabel,
            canCall: null,
            canText: null,
            preferred: false,
            addedBySalesRepId: null,
            note: `Listed on ${surface} as ${snapshot.phone}, checked ${now.toISOString().slice(0, 10)}. The register's number is the one on the record.`,
          };
          gained.push("contactNumber");
        }
      }
    }
  }

  // ── Rating, count, status, pin ───────────────────────────────────────
  if (snapshot.rating !== null) {
    cite("rating", `Google rating ${snapshot.rating.toFixed(1)} from ${snapshot.userRatingCount ?? "an unknown number of"} reviews`, String(snapshot.rating));
    if (prospect.googleRating === null || prospect.googleRating === undefined) {
      data.googleRating = snapshot.rating;
      gained.push("googleRating");
    } else if (Number(prospect.googleRating) !== snapshot.rating) {
      conflicts.push("googleRating");
    }
  }
  if (snapshot.userRatingCount !== null) {
    if (prospect.googleReviewCount === null || prospect.googleReviewCount === undefined) {
      data.googleReviewCount = snapshot.userRatingCount;
      gained.push("googleReviewCount");
    } else if (Number(prospect.googleReviewCount) !== snapshot.userRatingCount) {
      conflicts.push("googleReviewCount");
    }
  }
  if (snapshot.businessStatus) {
    cite("business_status", `Google lists the business as ${snapshot.businessStatus}`, snapshot.businessStatus);
    confirmations.push(
      snapshot.businessStatus === CLOSED_PERMANENTLY
        ? confirmation("status", "closed", { status: snapshot.businessStatus })
        : confirmation("status", "open", { status: snapshot.businessStatus }),
    );
    if (!prospect.businessStatus) {
      data.businessStatus = snapshot.businessStatus;
      gained.push("businessStatus");
    } else if (prospect.businessStatus !== snapshot.businessStatus) {
      conflicts.push("businessStatus");
    }
  }
  if (!snapshot.businessStatus) confirmations.push(confirmation("status", "google_silent"));
  if (snapshot.hours?.length) cite("hours", `Google lists opening hours: ${snapshot.hours.join("; ")}`, null);
  if (snapshot.location && (prospect.latitude === null || prospect.latitude === undefined) && (prospect.longitude === null || prospect.longitude === undefined)) {
    data.latitude = snapshot.location.latitude;
    data.longitude = snapshot.location.longitude;
    gained.push("location");
  }

  data.placesResult = { ...snapshot, confirmations };
  return { verdict: data.placesVerdict, data, contactNumber, evidence, gained, conflicts, confirmations };
}

// ── Metering ─────────────────────────────────────────────────────────────

function utcDay(now) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** One request, at list price, onto today's PlatformCostDaily row. Never
 *  throws: metering must not take down the thing it measures. */
export async function meterPlacesRequest({ db = defaultDb, now = new Date(), requests = 1 } = {}) {
  const cents = (PLACES_COST_MICROS / 10_000) * requests;
  try {
    if (typeof db.platformCostDaily?.upsert !== "function") return null;
    return await db.platformCostDaily.upsert({
      where: { day_provider_category: { day: utcDay(now), provider: PLACES_PROVIDER, category: PLACES_SKU } },
      create: {
        day: utcDay(now),
        provider: PLACES_PROVIDER,
        category: PLACES_SKU,
        cents,
        currency: "USD",
        units: requests,
        unit: "requests",
        count: requests,
        source: PLACES_COST_SOURCE,
        fetchedAt: now,
      },
      update: {
        cents: { increment: cents },
        units: { increment: requests },
        count: { increment: requests },
        fetchedAt: now,
      },
    });
  } catch (err) {
    console.error("[places] request not metered:", err?.message);
    return null;
  }
}

/** This month's Places spend and request count, from the ledger. */
export async function placesSpendThisMonth({ db = defaultDb, now = new Date() } = {}) {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  try {
    if (typeof db.platformCostDaily?.aggregate !== "function") return { requests: 0, cents: 0 };
    const agg = await db.platformCostDaily.aggregate({
      where: { provider: PLACES_PROVIDER, category: PLACES_SKU, day: { gte: from } },
      _sum: { cents: true, count: true },
    });
    return { requests: Number(agg._sum.count || 0), cents: Number(agg._sum.cents || 0) };
  } catch {
    return { requests: 0, cents: 0 };
  }
}

// ── One prospect, end to end ─────────────────────────────────────────────

export const PLACES_PROSPECT_SELECT = {
  id: true,
  businessName: true,
  addressLine: true,
  city: true,
  province: true,
  country: true,
  postalCode: true,
  latitude: true,
  longitude: true,
  domain: true,
  websiteUrl: true,
  hasWebsite: true,
  phoneE164: true,
  googlePlaceId: true,
  googleRating: true,
  googleReviewCount: true,
  businessStatus: true,
  placesCheckedAt: true,
  doNotContactAt: true,
  mergedIntoId: true,
  assignedRepId: true,
  campaignId: true,
};

/** Checked inside the window → skip. Pure, so the check drives it. */
export function checkedRecently(placesCheckedAt, { now = new Date(), days = PLACES_RECHECK_DAYS } = {}) {
  if (!placesCheckedAt) return false;
  const at = placesCheckedAt instanceof Date ? placesCheckedAt : new Date(placesCheckedAt);
  if (Number.isNaN(at.getTime())) return false;
  return now.getTime() - at.getTime() < days * 24 * 60 * 60 * 1000;
}

/**
 * Ask Places about one prospect and write what the rule allows.
 *
 * @returns { outcome: "checked" | "skipped" | "error", verdict?, reason?,
 *            gained?, conflicts?, fatal?, billed }
 *
 * `research` is what happens after a website was gained: the WHOLE chain is
 * re-run from the crawl — see rerunChainForNewWebsite below — so the rep
 * card and the script describe the real site, not just the domain field.
 */
export async function checkPlaces({
  db = defaultDb,
  prospectId,
  force = false,
  now = new Date(),
  deps = {},
} = {}) {
  const search = deps.searchPlaces || searchPlaces;
  const rerun = deps.rerunChainForNewWebsite || rerunChainForNewWebsite;
  const meter = deps.meterPlacesRequest || meterPlacesRequest;

  const prospect = await db.prospect.findUnique({ where: { id: prospectId }, select: PLACES_PROSPECT_SELECT });
  if (!prospect) return { outcome: "skipped", reason: "prospect_not_found", billed: false };
  if (prospect.mergedIntoId) return { outcome: "skipped", reason: "retired_into_survivor", billed: false };
  if (prospect.doNotContactAt) return { outcome: "skipped", reason: "do_not_contact", billed: false };
  if (!force && checkedRecently(prospect.placesCheckedAt, { now })) {
    return { outcome: "skipped", reason: "checked_recently", billed: false };
  }

  const result = await search({ prospect });
  if (result.billed) await meter({ db, now });
  if (!result.ok) {
    // Not stamped: an error is not a check, and a row that could not be
    // asked about today must be askable tomorrow. Fatal errors stop the
    // batch above this; the row itself just stays unchecked.
    await recordError({
      area: "places",
      code: result.code,
      message: `Places search failed for prospect ${prospect.id}: ${result.message}`,
      detail: { prospectId: prospect.id, status: result.status },
    });
    return { outcome: "error", reason: result.code, message: result.message, fatal: Boolean(result.fatal), billed: Boolean(result.billed) };
  }

  const match = matchPlaces(prospect, result.places);

  if (match.verdict !== PLACES_VERDICTS.MATCHED) {
    await db.prospect.update({
      where: { id: prospect.id },
      data: {
        placesCheckedAt: now,
        placesVerdict: match.verdict,
        placesResult: match.score
          ? { candidate: match.score, candidates: match.candidates.slice(0, PLACES_MAX_RESULTS), query: placesQuery(prospect), at: now.toISOString() }
          : { query: placesQuery(prospect), at: now.toISOString() },
      },
    });
    return { outcome: "checked", verdict: match.verdict, candidate: match.score, gained: [], conflicts: [], billed: true };
  }

  const [taken, numbers] = await Promise.all([
    db.prospect.findFirst({ where: { googlePlaceId: match.place.id, NOT: { id: prospect.id } }, select: { id: true } }),
    typeof db.salesContactNumber?.findMany === "function"
      ? db.salesContactNumber.findMany({ where: { prospectId: prospect.id }, select: { e164: true } })
      : Promise.resolve([]),
  ]);

  const plan = planPlacesWrite({
    prospect,
    place: match.place,
    score: match.score,
    placeIdTakenBy: taken?.id || null,
    existingNumbers: numbers.map((n) => n.e164),
    now,
  });

  await db.$transaction(async (tx) => {
    await tx.prospect.update({ where: { id: prospect.id }, data: plan.data });
    if (plan.evidence.length) await tx.prospectEvidence.createMany({ data: plan.evidence });
    if (plan.contactNumber && typeof tx.salesContactNumber?.create === "function") {
      await tx.salesContactNumber.create({ data: plan.contactNumber });
    }
  });

  let research = null;
  if (plan.gained.includes("websiteUrl")) {
    try {
      research = await rerun({ db, prospect, now });
    } catch (err) {
      await recordError({
        area: "places",
        code: "research_not_queued",
        message: `Places gained a website for ${prospect.id} but research could not be queued: ${err?.message || err}`,
        detail: errorDetail(err, { prospectId: prospect.id }),
      });
    }
  }

  return {
    outcome: "checked",
    verdict: plan.verdict,
    gained: plan.gained,
    conflicts: plan.conflicts,
    closed: plan.data.placesResult?.businessStatus === CLOSED_PERMANENTLY,
    confirmations: plan.confirmations,
    research,
    billed: true,
  };
}

// ── The chain, re-run from the crawl ─────────────────────────────────────

/** The dedupe key for the crawl a Places match queues. One per prospect
 *  per day: a second match the same day is the same site. */
export function placesCrawlKey(prospectId, now = new Date()) {
  return `places:CRAWL_WEBSITE:${prospectId}:${now.toISOString().slice(0, 10)}`;
}

/**
 * A row that just gained a website gets the whole research chain again,
 * starting at the crawl: CRAWL_WEBSITE → DETECT_TECHNOLOGY →
 * ANALYZE_CAPABILITIES → DETECT_OPPORTUNITIES → CALCULATE_LEAD_SCORE →
 * (claimed lane) INFER_FROM_SITE → GENERATE_RESEARCH_BRIEF →
 * GENERATE_CALL_SCRIPT. chain.js queues each successor when its
 * predecessor settles, so ONE enqueue here is the entire re-run.
 *
 * Queued DIRECTLY rather than through ensureResearchQueued(), on purpose.
 * That planner stops at the first live task for the prospect — and at claim
 * time there usually is one, queued seconds earlier for the directory-only
 * chain. It would have promoted that task and queued no crawl, and the row
 * would have kept its "nothing has crawled this business" card beside a
 * website Google had just named. The crawl is queued with `force: true`
 * because the re-crawl interval is about politeness to a site already read,
 * and this site has never been read: any earlier crawl was of a DERIVED
 * guess, not this listed address.
 *
 * The old script is not deleted and not edited. It goes stale the way every
 * script does — lib/sales/scriptOnDemand.js scriptRowStale(): the crawl
 * stamps lastCrawledAt, the stored row's crawledAt is older, and the chain's
 * GENERATE_CALL_SCRIPT (and the playbook on open) regenerates it from the
 * crawled brief. The hash gate there means nothing is spent twice.
 */
export async function rerunChainForNewWebsite({ db = defaultDb, prospect, now = new Date() } = {}) {
  const priority = prospect?.assignedRepId ? "claimed" : "backlog";
  const task = await enqueuePipelineTask(
    {
      kind: "CRAWL_WEBSITE",
      prospectId: prospect.id,
      campaignId: prospect.campaignId ?? null,
      payload: { prospectId: prospect.id, priority, force: true, reason: "places_website" },
      notBefore: notBeforeFor(priority),
      idempotencyKey: placesCrawlKey(prospect.id, now),
    },
    { deps: { db } },
  );
  return { queued: task && Object.hasOwn(task, "createdAt") ? 1 : 0, taskId: task?.id || null, priority, kind: "CRAWL_WEBSITE" };
}

// ── Many prospects, bounded ──────────────────────────────────────────────

export const ENRICH_CONCURRENCY = 4;
export const ENRICH_MAX_PER_CALL = 500;

export function emptyEnrichReport() {
  return {
    asked: 0,
    checked: 0,
    skipped: 0,
    errors: 0,
    requests: 0,
    costMicros: 0,
    matched: 0,
    noConfidentMatch: 0,
    noResults: 0,
    duplicatePlace: 0,
    closedPermanently: 0,
    websitesGained: 0,
    phonesGained: 0,
    ratingsGained: 0,
    conflicts: 0,
    phoneConfirmed: 0,
    phoneContradicted: 0,
    websiteConfirmed: 0,
    websiteContradicted: 0,
    stopped: null,
    rows: [],
  };
}

/**
 * Check a list of prospects, a few at a time, and tally what happened.
 *
 * Stops on the first FATAL error (no key, API not enabled, key denied): the
 * hundred rows after it would each cost a refused request, and the report's
 * `stopped` says which Google Cloud page to open.
 */
export async function enrichProspects({ db = defaultDb, ids = [], force = false, now = new Date(), concurrency = ENRICH_CONCURRENCY, deps = {} } = {}) {
  const report = emptyEnrichReport();
  const queue = [...new Set((Array.isArray(ids) ? ids : []).filter((id) => typeof id === "string" && id))].slice(0, ENRICH_MAX_PER_CALL);
  report.asked = queue.length;
  let stopped = false;

  const worker = async () => {
    while (queue.length && !stopped) {
      const id = queue.shift();
      let r;
      try {
        r = await checkPlaces({ db, prospectId: id, force, now, deps });
      } catch (err) {
        r = { outcome: "error", reason: "threw", message: err?.message || String(err), billed: false };
        await recordError({ area: "places", code: "check_threw", message: `checkPlaces threw for ${id}: ${r.message}`, detail: errorDetail(err, { prospectId: id }) });
      }
      if (r.billed) {
        report.requests += 1;
        report.costMicros += PLACES_COST_MICROS;
      }
      if (r.outcome === "skipped") report.skipped += 1;
      else if (r.outcome === "error") {
        report.errors += 1;
        if (r.fatal) {
          stopped = true;
          report.stopped = { code: r.reason, message: r.message, prospectId: id };
        }
      } else {
        report.checked += 1;
        if (r.verdict === PLACES_VERDICTS.MATCHED) report.matched += 1;
        else if (r.verdict === PLACES_VERDICTS.NO_CONFIDENT_MATCH) report.noConfidentMatch += 1;
        else if (r.verdict === PLACES_VERDICTS.NO_RESULTS) report.noResults += 1;
        else if (r.verdict === PLACES_VERDICTS.DUPLICATE_PLACE) report.duplicatePlace += 1;
        if (r.closed) report.closedPermanently += 1;
        if (r.gained?.includes("websiteUrl")) report.websitesGained += 1;
        if (r.gained?.includes("phoneE164") || r.gained?.includes("contactNumber")) report.phonesGained += 1;
        if (r.gained?.includes("googleRating")) report.ratingsGained += 1;
        if (r.conflicts?.length) report.conflicts += 1;
        for (const c of r.confirmations || []) {
          if (c.code === "phone:confirmed") report.phoneConfirmed += 1;
          if (c.code === "phone:differs") report.phoneContradicted += 1;
          if (c.code === "website:confirmed") report.websiteConfirmed += 1;
          if (c.code === "website:differs" || c.code === "website:added") report.websiteContradicted += 1;
        }
      }
      report.rows.push({ prospectId: id, ...r });
    }
  };

  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, queue.length || 1)) }, worker));
  return report;
}

/** The sentence the console prints under a fatal stop. */
export function enableInstructions() {
  return "Enable \"Places API (New)\" for the project that owns GOOGLE_MAPS_SERVER_KEY at https://console.cloud.google.com/apis/library/places-backend.googleapis.com and make sure the key's API restrictions include it.";
}

// ── Where the held rows are ──────────────────────────────────────────────

/** Prospects reps currently hold: an open SalesQueueClaim. */
export async function heldProspectIds({ db = defaultDb, onlyUnchecked = false, now = new Date() } = {}) {
  const claims = await db.salesQueueClaim.findMany({
    where: { releasedAt: null },
    select: { prospectId: true },
    distinct: ["prospectId"],
  });
  const ids = claims.map((c) => c.prospectId);
  if (!onlyUnchecked || !ids.length) return ids;
  const since = new Date(now.getTime() - PLACES_RECHECK_DAYS * 24 * 60 * 60 * 1000);
  const rows = await db.prospect.findMany({
    where: { id: { in: ids }, OR: [{ placesCheckedAt: null }, { placesCheckedAt: { lt: since } }] },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/** Money for N requests at list price, in cents. */
export function projectedCents(requests) {
  return Math.round(((Number(requests) || 0) * PLACES_COST_MICROS) / 10_000 * 100) / 100;
}
