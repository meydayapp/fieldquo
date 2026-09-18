// lib/sales/intel/listingMatch.js
//
// One matcher for every listing that arrives from outside — a BBB profile
// a rep's browser read, a row a bulk scraper returned, a Google Place —
// and one write path for what a match is allowed to fill.
//
// ══ Why the Places rule, and not a second one ═════════════════════════════
//
// lib/sales/intel/places.js already decides "is this listing this
// business" with a rule that was measured against the shapes that attach
// the wrong contractor: the same name in another city, a chain with many
// locations, a generic name with only the city in common. A BBB profile or
// a Maps-scraper row is the same question with the same failure modes, so
// it is shaped into the Place object the rule reads (displayName,
// formattedAddress, location, nationalPhoneNumber) and put through
// `matchPlaces` unchanged. A second rule would be AGENTS.md's fourth
// failure class with the worst possible symptom — the copy nobody
// measured attaching the wrong owner's name to a lead.
//
// ══ What a match writes ═══════════════════════════════════════════════════
//
//   google_maps  exactly what a Places lookup writes — planPlacesWrite,
//                with the evidence detector naming the scraper — so a lead
//                the bulk run reached looks the same as one the API reached
//                and the per-claim Places call skips it (placesCheckedAt).
//   bbb          the BBB facts (people, rating, accreditation, started
//                year, employees, entity) through people.js and
//                planBbbWrite below, blank-only; phone and website through
//                the same never-overwrite rule as Places: a differing phone
//                becomes a SalesContactNumber, never the record's.
import { db as defaultDb } from "@/lib/db";
import { normaliseDomain, normalisePhone } from "@/lib/sales/suppressionRules";
import { cleanWebsite } from "@/lib/sales/discovery/normalise";
import { PLACES_VERDICTS, matchPlaces, planPlacesWrite, rerunChainForNewWebsite } from "./places";
import { recordPeople } from "./people";
import { recordError, errorDetail } from "@/lib/platform/errorLog";

export const LISTING_SOURCES = Object.freeze(["bbb", "google_maps"]);
export const BBB_DETECTOR = "bbb.profile";
export const BBB_DETECTOR_VERSION = "1";
export const MAPS_SCRAPER_DETECTOR = "maps.apify";
export const MAPS_SCRAPER_DETECTOR_VERSION = "1";
/** Re-ask BBB about a prospect after this long. */
export const BBB_RECHECK_DAYS = 180;

const text = (v) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");

/**
 * A listing in the neutral shape (ExternalListing's columns) → the Place
 * object places.js's rule reads. Pure.
 */
export function listingAsPlace(listing = {}) {
  const address = [listing.addressLine, listing.city, [listing.province, listing.postalCode].filter(Boolean).join(" "), listing.country]
    .map(text)
    .filter(Boolean)
    .join(", ");
  const lat = Number(listing.latitude);
  const lng = Number(listing.longitude);
  return {
    id: listing.externalId || listing.id || null,
    displayName: { text: text(listing.name) },
    formattedAddress: address || null,
    location: Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0) ? { latitude: lat, longitude: lng } : null,
    nationalPhoneNumber: text(listing.phone || listing.phoneE164) || null,
    websiteUri: text(listing.websiteUrl) || null,
    rating: listing.source === "google_maps" && Number.isFinite(Number(listing.rating)) ? Number(listing.rating) : null,
    userRatingCount: Number.isFinite(Number(listing.reviewCount)) ? Number(listing.reviewCount) : null,
    businessStatus: listing.businessStatus || null,
    regularOpeningHours: Array.isArray(listing.hours) && listing.hours.length ? { weekdayDescriptions: listing.hours } : undefined,
    types: Array.isArray(listing.categories) ? listing.categories : listing.category ? [listing.category] : [],
  };
}

/**
 * Pick the one listing that is this prospect, or say why none was.
 * The same verdicts and the same score object as a Places match.
 */
export function matchListings(prospect, listings = []) {
  const places = (Array.isArray(listings) ? listings : []).map((l) => ({ ...listingAsPlace(l), listing: l }));
  const m = matchPlaces(prospect, places);
  return { ...m, listing: m.place?.listing || null };
}

/**
 * Which prospects a batch of listings could be — by phone first, then by
 * domain, then by (name tokens, city) — so a bulk run's rows find their
 * prospects without a query per row per prospect. Returns candidate
 * prospect ids per listing; the RULE still decides.
 */
export async function candidateProspectsFor({ db = defaultDb, listings = [] } = {}) {
  const phones = [...new Set(listings.map((l) => l.phoneE164).filter(Boolean))];
  const domains = [...new Set(listings.map((l) => l.domain).filter(Boolean))];
  const cities = [...new Set(listings.map((l) => text(l.city)).filter(Boolean))];
  const select = { id: true, businessName: true, addressLine: true, city: true, province: true, country: true, postalCode: true, latitude: true, longitude: true, phoneE164: true, domain: true, mergedIntoId: true };
  const [byPhone, byDomain, byCity] = await Promise.all([
    phones.length ? db.prospect.findMany({ where: { phoneE164: { in: phones }, mergedIntoId: null }, select }) : [],
    domains.length ? db.prospect.findMany({ where: { domain: { in: domains }, mergedIntoId: null }, select }) : [],
    cities.length ? db.prospect.findMany({ where: { city: { in: cities, mode: "insensitive" }, mergedIntoId: null }, select, take: 5000 }) : [],
  ]);
  const all = new Map();
  for (const p of [...byPhone, ...byDomain, ...byCity]) all.set(p.id, p);
  return [...all.values()];
}

/**
 * Everything a BBB match writes on the Prospect, blank-only. Pure.
 *
 * @param prospect  the row as read
 * @param profile   parseBbbProfile() output (bbbProfile.js)
 * @returns { data, evidence, gained, conflicts, contactNumber }
 */
export function planBbbWrite({ prospect, profile, existingNumbers = [], now = new Date() } = {}) {
  const data = { bbbCheckedAt: now };
  const gained = [];
  const conflicts = [];
  const evidence = [];
  const url = profile?.url || null;
  const cite = (field, rawValue, normalizedValue = null) =>
    evidence.push({
      prospectId: prospect.id,
      type: "bbb_field",
      source: "bbb",
      sourceUrl: url,
      rawValue: String(rawValue).slice(0, 2000),
      normalizedValue: normalizedValue === null ? null : String(normalizedValue).slice(0, 500),
      observedAt: now,
      confidence: 1.0,
      detector: `${BBB_DETECTOR}:${field}`,
      detectorVersion: BBB_DETECTOR_VERSION,
    });
  const fill = (field, value, citeText) => {
    if (value === null || value === undefined || value === "") return;
    if (prospect[field] === null || prospect[field] === undefined) {
      data[field] = value;
      gained.push(field);
    } else if (String(prospect[field]) !== String(value)) conflicts.push(field);
    if (citeText) cite(field, citeText, String(value));
  };
  if (url) fill("bbbProfileUrl", url, `BBB profile: ${url}`);
  if (profile?.rating) fill("bbbRating", profile.rating, `BBB rates this business ${profile.rating}`);
  if (typeof profile?.accredited === "boolean") fill("bbbAccredited", profile.accredited, profile.accredited ? "BBB lists the business as accredited" : "BBB lists the business as not accredited");
  if (profile?.businessStartedYear) fill("businessStartedYear", profile.businessStartedYear, `BBB lists the business as started in ${profile.businessStartedYear}`);
  if (profile?.employeeRange) fill("employeeRange", profile.employeeRange, `BBB lists ${profile.employeeRange} employees`);
  if (profile?.entityType) fill("entityType", profile.entityType, `BBB lists the entity type as ${profile.entityType}`);

  // Website and phone: the Places never-overwrite rule, restated for BBB.
  const domain = profile?.website ? normaliseDomain(profile.website) : null;
  if (domain) {
    const recordDomain = prospect.domain || normaliseDomain(prospect.websiteUrl) || null;
    if (!recordDomain) {
      data.domain = domain;
      gained.push("domain");
      const clean = cleanWebsite(profile.website);
      if (clean && !prospect.websiteUrl) {
        data.websiteUrl = clean;
        gained.push("websiteUrl");
        if (prospect.hasWebsite === null || prospect.hasWebsite === undefined) {
          data.hasWebsite = true;
          gained.push("hasWebsite");
        }
      }
      cite("website", `BBB lists a website the register did not: ${profile.website}`, domain);
    } else if (recordDomain === domain) cite("website", `BBB confirms the website: ${profile.website}`, domain);
    else {
      conflicts.push("domain");
      cite("website", `BBB lists a different website from the record's (${recordDomain}): ${profile.website}`, domain);
    }
  }
  let contactNumber = null;
  const e164 = profile?.phone ? normalisePhone(profile.phone) : null;
  if (e164) {
    if (!prospect.phoneE164) {
      data.phoneE164 = e164;
      gained.push("phoneE164");
      cite("phone", `BBB lists a phone number the register did not: ${profile.phone}`, e164);
    } else if (prospect.phoneE164 === e164) cite("phone", `BBB confirms the phone number: ${profile.phone}`, e164);
    else {
      conflicts.push("phoneE164");
      cite("phone", `BBB lists a different phone number from the register's (${prospect.phoneE164}): ${profile.phone}`, e164);
      if (!existingNumbers.includes(e164)) {
        contactNumber = {
          prospectId: prospect.id,
          e164,
          kind: "unknown",
          label: "BBB profile",
          canCall: null,
          canText: null,
          preferred: false,
          addedBySalesRepId: null,
          note: `Listed on the BBB profile as ${profile.phone}, read ${now.toISOString().slice(0, 10)}. The register's number is the one on the record.`,
        };
        gained.push("contactNumber");
      }
    }
  }
  return { data, evidence, gained, conflicts, contactNumber };
}

export const LISTING_PROSPECT_SELECT = {
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
  bbbCheckedAt: true,
  bbbProfileUrl: true,
  bbbRating: true,
  bbbAccredited: true,
  businessStartedYear: true,
  employeeRange: true,
  entityType: true,
  doNotContactAt: true,
  mergedIntoId: true,
  assignedRepId: true,
  campaignId: true,
};

/**
 * Attach a BBB profile that the RULE accepted to a prospect: people, facts,
 * phone, website, evidence — one transaction, never an overwrite.
 *
 * @returns { gained, conflicts, peopleAdded }
 */
export async function applyBbbProfile({ db = defaultDb, prospectId, profile, now = new Date() } = {}) {
  const prospect = await db.prospect.findUnique({ where: { id: prospectId }, select: LISTING_PROSPECT_SELECT });
  if (!prospect) return { gained: [], conflicts: [], peopleAdded: 0, reason: "prospect_not_found" };
  const numbers = typeof db.salesContactNumber?.findMany === "function"
    ? await db.salesContactNumber.findMany({ where: { prospectId }, select: { e164: true } })
    : [];
  const plan = planBbbWrite({ prospect, profile, existingNumbers: numbers.map((n) => n.e164), now });
  await db.$transaction(async (tx) => {
    await tx.prospect.update({ where: { id: prospectId }, data: plan.data });
    if (plan.evidence.length) await tx.prospectEvidence.createMany({ data: plan.evidence });
    if (plan.contactNumber && typeof tx.salesContactNumber?.create === "function") await tx.salesContactNumber.create({ data: plan.contactNumber });
  });
  const people = await recordPeople({
    db,
    prospectId,
    people: (profile?.people || []).map((p) => ({ name: p.name, givenName: p.givenName || null, role: p.role || null })),
    source: "bbb",
    sourceUrl: profile?.url || null,
    seenAt: now,
    detector: BBB_DETECTOR,
    detectorVersion: BBB_DETECTOR_VERSION,
  });
  // A website BBB named that the register did not: the same chain re-run a
  // Places match gets, so the card describes the real site, not a domain.
  let research = null;
  if (plan.gained.includes("websiteUrl")) {
    try {
      research = await rerunChainForNewWebsite({ db, prospect, now });
    } catch (err) {
      await recordError({ area: "bbb", code: "research_not_queued", message: `BBB gained a website for ${prospectId} but research could not be queued: ${err?.message || err}`, detail: errorDetail(err, { prospectId }) });
    }
  }
  return { gained: plan.gained, conflicts: plan.conflicts, peopleAdded: people.added, research };
}

/**
 * Attach a Maps-scraper row the RULE accepted, through the Places write
 * plan, so the prospect gains exactly what a Places lookup gives.
 */
export async function applyMapsListing({ db = defaultDb, prospectId, listing, score = null, now = new Date() } = {}) {
  const prospect = await db.prospect.findUnique({ where: { id: prospectId }, select: LISTING_PROSPECT_SELECT });
  if (!prospect) return { gained: [], conflicts: [], reason: "prospect_not_found" };
  const place = listingAsPlace(listing);
  const [taken, numbers] = await Promise.all([
    place.id ? db.prospect.findFirst({ where: { googlePlaceId: place.id, NOT: { id: prospectId } }, select: { id: true } }) : null,
    typeof db.salesContactNumber?.findMany === "function" ? db.salesContactNumber.findMany({ where: { prospectId }, select: { e164: true } }) : [],
  ]);
  const plan = planPlacesWrite({
    prospect,
    place,
    score,
    placeIdTakenBy: taken?.id || null,
    existingNumbers: numbers.map((n) => n.e164),
    now,
    origin: { detector: MAPS_SCRAPER_DETECTOR, detectorVersion: MAPS_SCRAPER_DETECTOR_VERSION, label: "Google Maps (bulk)" },
  });
  await db.$transaction(async (tx) => {
    await tx.prospect.update({ where: { id: prospectId }, data: plan.data });
    if (plan.evidence.length) await tx.prospectEvidence.createMany({ data: plan.evidence });
    if (plan.contactNumber && typeof tx.salesContactNumber?.create === "function") await tx.salesContactNumber.create({ data: plan.contactNumber });
  });
  if (plan.gained.includes("websiteUrl")) {
    try {
      await rerunChainForNewWebsite({ db, prospect, now });
    } catch (err) {
      await recordError({ area: "places", code: "research_not_queued", message: `Maps listing gained a website for ${prospectId} but research could not be queued: ${err?.message || err}`, detail: errorDetail(err, { prospectId }) });
    }
  }
  return { verdict: plan.verdict, gained: plan.gained, conflicts: plan.conflicts };
}

export { PLACES_VERDICTS };
