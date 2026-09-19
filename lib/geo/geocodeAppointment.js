// lib/geo/geocodeAppointment.js
//
// Turn an appointment's address into Appointment.latitude / longitude /
// geocodedAt — the job wrapper's rules, applied to the other table.
//
// ── Why a second wrapper and not a second geocoder ─────────────────────────
//
// The Google call stays in lib/measure/roofMeasurement.js's `geocodeAddress`,
// and the refusal rules stay in lib/geo/geocodeJob.js's `resolveJobCoordinates`
// — the timeout, the APPROXIMATE refusal, the six-decimal rounding, the nulls
// on failure. This file adds only what differs for an appointment: WHICH
// address, and which row to write. Copying the rules would have given the
// day map two definitions of "too coarse to pin", and the copy is the one
// that rots.
//
// ── Which address ──────────────────────────────────────────────────────────
//
// `location` when the office typed one, else the client's address — the same
// fallback appointmentToCalendarEntry uses to print the row, so the pin and
// the printed address never disagree. Neither set means no pin, not the
// company's own address and not the client's last job.
//
// ── When it runs ───────────────────────────────────────────────────────────
//
// On create, and on a PATCH whose `location` CHANGES (compared normalised, as
// the job route compares siteAddress). And lazily, once, from the map route
// for a row that has an address and no coordinates and has never been tried
// (geocodedAt null): the booking flow wrote coordinates for years without a
// stamp, and the office's own bookings were never geocoded at all. That
// backfill is bounded per request (see app/api/schedule/map) because Google
// bills per call.
//
// A row that WAS tried and got nulls keeps geocodedAt set, so the backfill
// does not ask Google the same unplaceable address every time somebody opens
// the map. A later `location` edit tries again, as it should.

import { resolveJobCoordinates, normaliseSiteAddress } from "@/lib/geo/geocodeJob";

/**
 * The address an appointment is at, or null. `location` first, the client's
 * address second — the order the calendar prints them in.
 */
export function appointmentAddress(appointment) {
  return (
    normaliseSiteAddress(appointment?.location) ||
    normaliseSiteAddress(appointment?.client?.address) ||
    null
  );
}

/** Did the typed location actually change? Both sides normalised. */
export function locationChanged(before, after) {
  return normaliseSiteAddress(before) !== normaliseSiteAddress(after);
}

/**
 * Resolve an appointment's address to the columns to write, or nulls. The
 * refusal rules are the job's, by construction — `geocode` is injectable so
 * the check can exercise each one without a key. `geocodedAt` is stamped on
 * a refusal too (see the header: a tried address is not retried by the
 * backfill), which is the one place this differs from the job wrapper, and
 * `tried` says so.
 *
 * @returns {Promise<{ latitude:number|null, longitude:number|null, geocodedAt:Date|null, reason?:string }>}
 */
export async function resolveAppointmentCoordinates(appointment, { geocode, now = new Date() } = {}) {
  const address = appointmentAddress(appointment);
  const coords = await resolveJobCoordinates(address, { ...(geocode && { geocode }), now });
  if (coords.reason === "no_address") return coords;
  // A refusal for a real address is still an answer: stamp it so the lazy
  // backfill does not ask again tomorrow. Nulls stay null.
  return { ...coords, geocodedAt: now };
}

/**
 * Geocode an appointment and write the result. Never throws; a failure
 * writes nulls and logs. Returns what was written.
 *
 * @param {object} db  Prisma client.
 * @param {{ id:string, location?:string|null, client?:{ address?:string|null }|null }} appointment
 */
export async function geocodeAppointment(db, appointment) {
  let coords;
  try {
    coords = await resolveAppointmentCoordinates(appointment);
  } catch (err) {
    console.error("[geo/geocodeAppointment] resolve failed:", err?.message);
    coords = { latitude: null, longitude: null, geocodedAt: new Date(), reason: "threw" };
  }
  if (coords.reason && coords.reason !== "no_address") {
    console.warn(`[geo/geocodeAppointment] appointment ${appointment?.id}: no coordinates (${coords.reason})`);
  }
  try {
    await db.appointment.update({
      where: { id: appointment.id },
      data: {
        latitude: coords.latitude,
        longitude: coords.longitude,
        geocodedAt: coords.geocodedAt,
      },
    });
  } catch (err) {
    console.error(`[geo/geocodeAppointment] appointment ${appointment?.id}: coordinate write failed:`, err?.message);
  }
  return coords;
}

/**
 * Which rows the map's lazy backfill should try: an address, no coordinates,
 * never tried. Pure, so the check can pin the rule and the route can count
 * before it spends.
 */
export function needsGeocode(appointment) {
  if (!appointment) return false;
  if (appointment.latitude != null && appointment.longitude != null) return false;
  if (appointment.geocodedAt) return false;
  return Boolean(appointmentAddress(appointment));
}
