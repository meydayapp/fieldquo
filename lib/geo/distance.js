// lib/geo/distance.js
//
// How far apart two points are, and what that distance is allowed to mean.
//
// ── Haversine, not the equirectangular shortcut ────────────────────────────
//
// lib/measure/roofMeasurement.js has `metresBetween`, equirectangular and
// "exact enough at 30 m" — which it is, for deciding whether a roof model sits
// on the pin it was asked about. A timesheet stamp is a different question:
// the crew member may be 40 km away, and at that range the flat-earth
// approximation drifts. Haversine costs two more trig calls and is right at
// every distance this product will ever print.
//
// ── The verdict is deliberately three-valued ───────────────────────────────
//
// "On site" and "away" are claims about where a person was. "Unknown" is the
// refusal to make one, and it is the correct answer more often than either:
// the job was never geocoded, the phone said nothing, or the phone said
// something with an accuracy circle so wide that the point inside it could be
// on site or two streets over. A 1,500 m accuracy reading is not evidence of
// being 1,200 m away — it is evidence of being indoors. Collapsing unknown
// into away would flag every crew member whose phone had a bad fix, and a
// manager who has learned the flag is noise stops reading it.

/** Mean Earth radius, metres. */
const EARTH_RADIUS_M = 6371008.8;

/**
 * How far from the geocoded site a tap may land and still count as on site.
 *
 * 250 m, and a constant rather than a company setting on purpose — this brief
 * did not include one, and a setting nobody has asked for is a control that
 * exists to be misunderstood. The number itself: a consumer phone outdoors is
 * good to 5–20 m, a geocoded street address lands on the parcel rather than
 * the front door, a crew parks up the street on a residential job, and a
 * commercial site can be a 150 m lot. 250 m absorbs all of that and still
 * separates "here" from "the coffee shop two blocks over" on anything but the
 * densest downtown street. A company running 10-acre estate work will want it
 * larger; that is the day it becomes a setting.
 */
export const ON_SITE_THRESHOLD_M = 250;

/**
 * Great-circle distance in metres between two { latitude, longitude } points.
 * Accepts `lat`/`lng` too, matching lib/measure/roofMeasurement.js's shape.
 * Returns null when either end is not a finite pair — never 0 for "unknown".
 */
export function haversineM(a, b) {
  if (!a || !b) return null;
  const lat1 = Number(a.latitude ?? a.lat);
  const lng1 = Number(a.longitude ?? a.lng);
  const lat2 = Number(b.latitude ?? b.lat);
  const lng2 = Number(b.longitude ?? b.lng);
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return null;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * What a stamp's distance is allowed to say.
 *
 * @returns {"on_site"|"away"|"unknown"}
 *   `unknown` whenever the claim cannot honestly be made: no distance (the job
 *   had no coordinates, or there was no stamp), a non-finite one, or an
 *   accuracy circle wider than the threshold itself — inside a 1,500 m circle
 *   the phone could be anywhere relative to a 250 m fence.
 */
export function stampVerdict({ distanceToSiteM, accuracyM, thresholdM = ON_SITE_THRESHOLD_M } = {}) {
  const d = distanceToSiteM == null ? null : Number(distanceToSiteM);
  if (d === null || !Number.isFinite(d) || d < 0) return "unknown";
  if (accuracyM != null) {
    const acc = Number(accuracyM);
    if (Number.isFinite(acc) && acc > thresholdM) return "unknown";
  }
  return d <= thresholdM ? "on_site" : "away";
}

/**
 * "12 m" / "2.1 km" — SI symbols, which read the same in every language the
 * app ships. Under a kilometre the metre figure is rounded to the nearest
 * whole; beyond it, one decimal. Null in, null out.
 */
export function formatDistanceM(m) {
  const d = m == null ? null : Number(m);
  if (d === null || !Number.isFinite(d) || d < 0) return null;
  const whole = Math.round(d);
  // Rounded BEFORE the comparison: 999.6 is "1.0 km", not "1000 m".
  if (whole < 1000) return `${whole} m`;
  return `${(d / 1000).toFixed(1)} km`;
}
