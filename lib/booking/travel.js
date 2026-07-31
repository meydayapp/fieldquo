// lib/booking/travel.js
//
// How long it takes to get from the last appointment to the next one.
//
// ══ The rule this file exists to enforce ═══════════════════════════════════
//
// A slot is only offerable if you can actually get there:
//
//     previous appointment ends  +  travel  +  buffer   <=   slot starts
//
// Without it the booking page cheerfully sells 5:00 in the east end and 5:30
// across town, and the person who finds out is the homeowner standing in a
// driveway at 5:45. That's the worst failure the product has, because it isn't
// recoverable by an apology — they've already decided what kind of outfit this
// is.
//
// ══ It refuses to guess ════════════════════════════════════════════════════
//
// `travelMinutes` returns null when it does not know: no coordinates on either
// end, no key, the API down. Null means "don't filter" — NOT "zero minutes"
// and not a padded default. This is AGENTS.md rule 5, and it matters more here
// than almost anywhere else, because an invented travel time doesn't produce a
// visibly wrong number, it produces a SILENTLY MISSING SLOT. The contractor
// then wonders why nobody books them at 2pm and there is nothing on screen to
// explain it.
//
// So: known travel filters slots. Unknown travel never does.
//
// ══ Two sources, and the caller is always told which ═══════════════════════
//
//   "driving"  — Google Distance Matrix. Real roads, real one-way systems.
//   "estimate" — straight line × a road factor. Free, offline, and roughly
//                right in a city; badly wrong across a river with one bridge.
//
// Every result carries its source so nothing downstream can present a straight-
// line guess as a driving time. The UI says "about 25 min" for one and "25 min
// drive" for the other, and that difference is the honesty of the feature.

/** Mean radius, km. */
const EARTH_KM = 6371;

/**
 * Straight-line to road-distance multiplier.
 *
 * Real road networks in North American cities run about 1.25–1.45× the crow
 * flight. 1.35 sits in the middle; it is not tuned, and it is the reason the
 * result is labelled an estimate rather than a time.
 */
const ROAD_FACTOR = 1.35;

/**
 * Average door-to-door speed, km/h, including lights, turns and parking.
 *
 * Deliberately low. A number that's too high produces a slot the contractor
 * can't make; too low costs a bookable slot. Those are not symmetric, and this
 * errs toward the recoverable one.
 */
const URBAN_KMH = 32;

/** Do we have a usable point? */
export function hasPoint(p) {
  return (
    p != null &&
    Number.isFinite(Number(p.lat)) &&
    Number.isFinite(Number(p.lng)) &&
    Math.abs(Number(p.lat)) <= 90 &&
    Math.abs(Number(p.lng)) <= 180 &&
    // (0,0) is in the Gulf of Guinea. Nobody's appointment is there, and it's
    // the classic value for "the geocode failed and something wrote zeroes".
    !(Number(p.lat) === 0 && Number(p.lng) === 0)
  );
}

/** Great-circle distance in km, or null if either end is unusable. */
export function haversineKm(a, b) {
  if (!hasPoint(a) || !hasPoint(b)) return null;
  const toRad = (d) => (Number(d) * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * Offline travel estimate. Pure — no network, no key, no cost.
 *
 * @returns {{ minutes: number, km: number, source: "estimate" }} or null
 */
export function estimateTravel(a, b) {
  const straight = haversineKm(a, b);
  if (straight == null) return null;

  const km = straight * ROAD_FACTOR;

  // ── No upper cut-off, deliberately ──────────────────────────────────────
  //
  // An earlier version returned null past 300 km, reasoning that a trip that
  // long is a different-day problem rather than a travel-time one. That had it
  // exactly backwards. Null means "unknown", and unknown never filters — so
  // the one case we are MOST certain about, Montreal at 5pm and Toronto at
  // 6pm, was the one case that sailed through.
  //
  // A long distance simply produces a long travel time, and `reachable`
  // refuses the slot on its own. The maths doesn't need a special case; it
  // needed to be allowed to speak.

  // Same address, or near enough — two units in one building, a second visit
  // to the same house. Zero, not a minimum, because rounding this up to "at
  // least 5 minutes" would block back-to-back slots at a single site, which is
  // the one case where back-to-back is obviously correct.
  const minutes = Math.round((km / URBAN_KMH) * 60);
  return { minutes, km: Math.round(km * 10) / 10, source: "estimate" };
}

/**
 * Real driving time from Google, falling back to the offline estimate.
 *
 * Never throws and never invents: a missing key, a refused request, a
 * zero-results answer all fall through to `estimateTravel`, and if that can't
 * answer either (no coordinates) the result is null.
 *
 * @returns {Promise<{minutes, km, source} | null>}
 */
export async function travelMinutes(a, b, { key = null, fetchImpl = fetch } = {}) {
  if (!hasPoint(a) || !hasPoint(b)) return null;

  const fallback = estimateTravel(a, b);
  if (!key) return fallback;

  try {
    const url =
      "https://maps.googleapis.com/maps/api/distancematrix/json" +
      `?origins=${a.lat},${a.lng}&destinations=${b.lat},${b.lng}` +
      "&mode=driving&units=metric&key=" +
      encodeURIComponent(key);

    const res = await fetchImpl(url);
    if (!res.ok) return fallback;
    const data = await res.json();
    const cell = data?.rows?.[0]?.elements?.[0];
    if (data?.status !== "OK" || cell?.status !== "OK") return fallback;

    const seconds = cell.duration?.value;
    const metres = cell.distance?.value;
    if (!Number.isFinite(seconds)) return fallback;

    return {
      minutes: Math.round(seconds / 60),
      km: Number.isFinite(metres) ? Math.round(metres / 100) / 10 : null,
      source: "driving",
    };
  } catch {
    // Network trouble is not a reason to block a booking page. The estimate is
    // worse but it is honest about being one.
    return fallback;
  }
}

/**
 * Can this slot be reached from where the previous job ends?
 *
 * @param {Date|number} previousEnd  when the earlier appointment finishes
 * @param {Date|number} slotStart    when the candidate slot begins
 * @param {number|null} travel       minutes, or null if unknown
 * @param {number}      buffer       company padding: parking, loading, a coffee
 * @returns {{ ok: boolean, shortBy: number, known: boolean }}
 *          `shortBy` is minutes missing, so the UI can say "20 minutes short"
 *          rather than just refusing.
 */
export function reachable({ previousEnd, slotStart, travel, buffer = 0 }) {
  // Unknown travel never blocks. See the header — a silently missing slot is
  // worse than a slot that needs a phone call.
  if (travel == null || !Number.isFinite(travel)) {
    return { ok: true, shortBy: 0, known: false };
  }

  const gapMinutes = (new Date(slotStart).getTime() - new Date(previousEnd).getTime()) / 60000;
  const needed = travel + Math.max(0, Number(buffer) || 0);
  const shortBy = Math.ceil(needed - gapMinutes);

  return { ok: shortBy <= 0, shortBy: Math.max(0, shortBy), known: true };
}

/**
 * The drive between each consecutive pair of stops in a day.
 *
 * Pure, and deliberately offline — it uses the straight-line estimate rather
 * than Distance Matrix. This feeds a planning list that re-renders whenever
 * somebody opens their schedule, and paying per element for a rough
 * sanity-check number would be a bill with nothing to show for it. The wording
 * hedges accordingly.
 *
 * Only pairs stops on the SAME DAY. The gap between the last job on Tuesday
 * and the first on Wednesday is not a drive anybody makes in one go, and
 * showing "about 14 h drive" overnight would be absurd.
 *
 * @param {Array} stops  [{ id, at: Date|string, endAt?, latitude, longitude }]
 *                       Must already be in chronological order.
 * @returns {Array} one entry per stop: { id, travel, gapMinutes, tight }
 *                  `travel` is null for the first stop of each day and for any
 *                  stop where either end lacks coordinates.
 */
export function travelLegs(stops = [], { buffer = 0 } = {}) {
  const dayOf = (d) => new Date(d).toISOString().slice(0, 10);

  return stops.map((stop, i) => {
    const prev = i > 0 ? stops[i - 1] : null;
    const base = { id: stop.id, travel: null, gapMinutes: null, tight: false };

    if (!prev) return base;
    if (dayOf(prev.at) !== dayOf(stop.at)) return base;

    const travel = estimateTravel(
      { lat: prev.latitude, lng: prev.longitude },
      { lat: stop.latitude, lng: stop.longitude },
    );

    // The previous stop's END, not its start. Without an explicit endAt we
    // can't know how long it ran, so there is nothing to compare against and
    // the honest answer is a travel time with no verdict attached — better
    // than assuming an hour and calling a fine gap "tight".
    const prevEnd = prev.endAt ? new Date(prev.endAt) : null;
    if (!prevEnd) return { ...base, travel };

    const gapMinutes = Math.round((new Date(stop.at) - prevEnd) / 60000);
    const verdict = reachable({
      previousEnd: prevEnd,
      slotStart: stop.at,
      travel: travel?.minutes ?? null,
      buffer,
    });

    return { id: stop.id, travel, gapMinutes, tight: verdict.known && !verdict.ok, shortBy: verdict.shortBy };
  });
}

/**
 * "25 min drive" / "about 25 min" / "1 h 10 drive".
 *
 * The wording carries the source. An estimate that reads like a measurement is
 * how someone ends up trusting a straight-line guess across a river.
 */
export function describeTravel(travel, language = "en") {
  if (!travel || !Number.isFinite(travel.minutes)) return null;

  const { minutes, source } = travel;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const time = h > 0 ? (m > 0 ? `${h} h ${m}` : `${h} h`) : `${m} min`;

  if (language === "fr") {
    return source === "driving" ? `${time} de route` : `environ ${time} de route`;
  }
  return source === "driving" ? `${time} drive` : `about ${time} drive`;
}
