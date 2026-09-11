// lib/geo/geocodeJob.js
//
// Turn Job.siteAddress into Job.latitude / longitude / geocodedAt.
//
// ── One geocoder ───────────────────────────────────────────────────────────
//
// The Google call lives in lib/measure/roofMeasurement.js's `geocodeAddress`
// and nowhere else — the booking flow, the business-info page, the voice
// availability lookup and the roof takeoff all go through it. This file adds
// a job-shaped wrapper, not a second client: which fields to write, when to
// refuse a result, and how not to hang the request that asked.
//
// ── When it runs ───────────────────────────────────────────────────────────
//
// On job create, and on a PATCH that CHANGES siteAddress. Never on a read:
// Google bills per call, and a job page is read a hundred times for every
// edit to it. A PATCH that sends the same address back (the edit form always
// sends every field) is a no-op here, compared on the trimmed string.
//
// ── Absence is not padded ──────────────────────────────────────────────────
//
// A failed geocode — no key, a Google outage, an address Google cannot place,
// or a result so coarse it names a town rather than a parcel — writes NULLS
// and logs. Nothing invents a coordinate. Every distance built on these
// columns says "unknown" for such a job (lib/geo/distance.js), which is the
// truth, rather than measuring every crew member's day against a guess.
//
// Clearing the address clears the coordinates too, for the same reason the
// business-info route does: a map pointing at the previous address is a
// false statement about where the work is.
//
// ── The stamp is a retention hook, not decoration ──────────────────────────
//
// Google's Service Specific Terms let a geocoded lat/lng be cached for 30
// consecutive days (docs/construction/AUDIT-routing-geo.md §2.3). geocodedAt
// is what makes a sweep enforceable. The sweep itself is not in this file —
// it is a cron, and a cron that deletes is a separate decision to take with
// the owner — but every write here dates itself so that decision can be
// implemented without a backfill.

import { geocodeAddress } from "@/lib/measure/roofMeasurement";

/**
 * How long the request will wait for Google before giving up and writing
 * nulls. geocodeAddress has no timeout of its own; a job save that hangs on
 * a slow third party is worse than a job with no pin.
 */
export const GEOCODE_TIMEOUT_MS = 6000;

/**
 * Google's location_type values we are willing to store. APPROXIMATE is a
 * town or postal-area centroid — measuring a timesheet against it would flag
 * every crew member as "2.3 km away" on every job in that town.
 */
const ACCEPTED_LOCATION_TYPES = new Set(["ROOFTOP", "RANGE_INTERPOLATED", "GEOMETRIC_CENTER"]);

/** Normalise what the form sent so equal addresses compare equal. */
export function normaliseSiteAddress(value) {
  if (value == null) return null;
  const s = String(value).replace(/\s+/g, " ").trim();
  return s.length ? s : null;
}

/** Did the address actually change? Both sides normalised. */
export function siteAddressChanged(before, after) {
  return normaliseSiteAddress(before) !== normaliseSiteAddress(after);
}

/**
 * Resolve an address to the columns to write, or nulls. Pure of the
 * database; `geocode` is injectable so the check script can exercise every
 * refusal without a key.
 *
 * @returns {Promise<{ latitude: number|null, longitude: number|null, geocodedAt: Date|null, reason?: string }>}
 */
export async function resolveJobCoordinates(siteAddress, { geocode = geocodeAddress, now = new Date() } = {}) {
  const nulls = (reason) => ({ latitude: null, longitude: null, geocodedAt: null, reason });
  const address = normaliseSiteAddress(siteAddress);
  if (!address) return nulls("no_address");

  let hit = null;
  try {
    hit = await Promise.race([
      geocode(address),
      new Promise((resolve) => setTimeout(() => resolve(null), GEOCODE_TIMEOUT_MS).unref?.()),
    ]);
  } catch (err) {
    console.error("[geo/geocodeJob] geocode threw:", err?.message);
    return nulls("threw");
  }
  if (!hit) return nulls("no_result");
  const lat = Number(hit.lat);
  const lng = Number(hit.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return nulls("no_result");
  // A caller passing an older-shaped hit with no locationType is accepted —
  // absence of the label is not evidence of coarseness — but a labelled
  // APPROXIMATE is refused.
  if (hit.locationType && !ACCEPTED_LOCATION_TYPES.has(hit.locationType)) {
    return nulls("too_coarse");
  }
  return {
    latitude: Math.round(lat * 1e6) / 1e6,
    longitude: Math.round(lng * 1e6) / 1e6,
    geocodedAt: now,
  };
}

/**
 * Geocode a job's siteAddress and write the result. Never throws; a failure
 * writes nulls and logs. Returns what was written.
 *
 * @param {object} db  Prisma client.
 * @param {{ id: string, siteAddress: string|null }} job
 */
export async function geocodeJob(db, job) {
  let coords;
  try {
    coords = await resolveJobCoordinates(job?.siteAddress);
  } catch (err) {
    console.error("[geo/geocodeJob] resolve failed:", err?.message);
    coords = { latitude: null, longitude: null, geocodedAt: null, reason: "threw" };
  }
  if (coords.reason && coords.reason !== "no_address") {
    console.warn(`[geo/geocodeJob] job ${job?.id}: no coordinates (${coords.reason})`);
  }
  try {
    await db.job.update({
      where: { id: job.id },
      data: {
        latitude: coords.latitude,
        longitude: coords.longitude,
        geocodedAt: coords.geocodedAt,
      },
    });
  } catch (err) {
    console.error(`[geo/geocodeJob] job ${job?.id}: coordinate write failed:`, err?.message);
  }
  return coords;
}
