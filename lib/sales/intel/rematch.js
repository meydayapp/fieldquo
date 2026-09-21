// lib/sales/intel/rematch.js
//
// The matcher, re-run over listings it already refused.
//
// ══ Why a rematch exists ══════════════════════════════════════════════════
//
// lib/sales/intel/listings.js applyListing runs the rule ONCE, the night
// the Mac reads the listing, and files the refusal on the ExternalListing
// row with the top candidate and the reason. The rule then changed
// (2026-09-21: initialisms and trade words in the name comparison; the
// matched_verify verdict for a listing that answers the record's phone or
// website under another name), and 1,725 rows sat refused under the old
// reading. Nothing would look at them again — a re-sweep dedupes by place
// id and skips a place it already opened — so this walks them once, builds
// the raw record back out of the row, and puts it through the SAME
// applyListing. No second matcher: whatever the sweep would decide tonight
// is what the rematch decides.
//
// ══ Idempotent, and honest about time ═════════════════════════════════════
//
// applyListing upserts on (source, externalId), so a row rematched twice
// is the same row. The sighting stamps are NOT moved: `now` is the row's
// own lastSeenAt, so fetchedAt / lastSeenAt / placesCheckedAt / the
// evidence's observedAt all say when Google was actually read, not when
// the rule was re-run. A row without a runId keeps none; a row with one
// keeps it (listingRow writes runId only when given one).
//
// `--dry` counts and writes nothing — the count the owner is given before
// anything is applied.
import { db as defaultDb } from "@/lib/db";
import { MAPS_SOURCE, applyListing } from "./listings";

/** How many refused rows one page reads. */
export const REMATCH_PAGE = 200;

/** The columns the rematch needs to rebuild a record. */
export const REMATCH_SELECT = Object.freeze({
  id: true,
  externalId: true,
  name: true,
  phoneE164: true,
  websiteUrl: true,
  addressLine: true,
  city: true,
  province: true,
  postalCode: true,
  country: true,
  latitude: true,
  longitude: true,
  category: true,
  rating: true,
  reviewCount: true,
  payload: true,
  keyword: true,
  location: true,
  businessStatus: true,
  claimed: true,
  matchVerdict: true,
  matchResult: true,
  lastSeenAt: true,
  fetchedAt: true,
});

/**
 * An ExternalListing row → the raw record applyListing normalises. Pure.
 * The formatted address is the payload's when it kept one, else rebuilt
 * from the parts in Google's own order so parseFormattedAddress reads it
 * back the same way.
 */
export function rawFromListingRow(row = {}) {
  const payload = row?.payload && typeof row.payload === "object" ? row.payload : {};
  const ext = String(row?.externalId ?? "");
  const placeId = /^ChIJ/.test(ext) ? ext : null;
  const cid = payload.cid || (ext.startsWith("cid:") ? ext.slice(4) : null);
  const region = [row.province, row.postalCode].filter(Boolean).join(" ");
  const countryWord = { US: "United States", CA: "Canada" }[String(row.country || "").toUpperCase()] || row.country || null;
  const address = payload.address || [row.addressLine, row.city, region, countryWord].filter(Boolean).join(", ") || null;
  return {
    placeId,
    cid,
    name: row.name === "(unnamed)" ? "" : row.name,
    category: row.category || null,
    address,
    latitude: row.latitude === null || row.latitude === undefined ? null : Number(row.latitude),
    longitude: row.longitude === null || row.longitude === undefined ? null : Number(row.longitude),
    plusCode: payload.plusCode || null,
    phone: payload.phone || row.phoneE164 || null,
    websiteUrl: row.websiteUrl || null,
    rating: row.rating === null || row.rating === undefined ? null : Number(row.rating),
    reviewCount: row.reviewCount ?? null,
    starHistogram: Array.isArray(payload.starHistogram) ? payload.starHistogram : null,
    hours: Array.isArray(payload.hours) ? payload.hours : null,
    businessStatus: row.businessStatus || null,
    claimed: typeof row.claimed === "boolean" ? row.claimed : null,
    priceBracket: payload.priceBracket || null,
    listingUrl: payload.listingUrl || null,
    searchTerm: row.keyword || payload.searchTerm || null,
    searchLocation: row.location || payload.searchLocation || null,
    tile: payload.tile || null,
    country: row.country || null,
  };
}

/** The where for "refused, still unattached, never promoted into its own row". */
export function rematchWhere({ regions = null } = {}) {
  const where = { source: MAPS_SOURCE, matchedProspectId: null, matchResult: { not: null } };
  if (Array.isArray(regions) && regions.length) where.province = { in: regions };
  return where;
}

/**
 * Walk every refused Maps listing through applyListing again.
 *
 * @param dry      count only; applyListing writes nothing
 * @param regions  two-letter states/provinces, or null for all
 * @param limit    stop after this many rows (0 = all)
 * @param onRow    (row, result) per listing, for the terminal
 * @returns { considered, byBefore: { reason: n }, byAfter: { verdict: n },
 *            flipped: { matched, matched_verify }, flips: [{ id, name, before, after, prospect }] }
 */
export async function rematchUnmatched({ db = defaultDb, dry = true, regions = null, limit = 0, onRow = null } = {}) {
  const out = { dry, considered: 0, byBefore: {}, byAfter: {}, flipped: { matched: 0, matched_verify: 0 }, flips: [], errors: 0 };
  let cursor = null;
  for (;;) {
    const page = await db.externalListing.findMany({
      where: rematchWhere({ regions }),
      select: REMATCH_SELECT,
      orderBy: { id: "asc" },
      take: REMATCH_PAGE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!page.length) break;
    for (const row of page) {
      if (limit && out.considered >= limit) return out;
      out.considered += 1;
      const before = row.matchResult?.candidate?.reason || row.matchVerdict || "unknown";
      out.byBefore[before] = (out.byBefore[before] || 0) + 1;
      const seenAt = row.lastSeenAt || row.fetchedAt || new Date();
      let result;
      try {
        result = await applyListing({ db, raw: rawFromListingRow(row), now: new Date(seenAt), runId: null, dry });
      } catch (err) {
        out.errors += 1;
        result = { verdict: "error", error: err?.message || String(err) };
      }
      const after = result.verdict || "unknown";
      out.byAfter[after] = (out.byAfter[after] || 0) + 1;
      if (after === "matched" || after === "matched_verify") {
        out.flipped[after] += 1;
        if (out.flips.length < 2000) out.flips.push({ id: row.id, name: row.name, before, after, prospect: result.score?.prospectName || null, prospectId: result.prospectId || null, identity: result.score?.identity || [] });
      }
      if (onRow) onRow(row, result, { before, after });
    }
    cursor = page[page.length - 1].id;
    if (page.length < REMATCH_PAGE) break;
  }
  return out;
}
