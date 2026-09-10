// lib/measure/roofMeasurement.js
//
// Turn a street address into a roof: total surface area, predominant pitch,
// and a satellite image — the raw inputs a roofing estimate needs, without a
// truck rolling to the site.
//
// ── Why Google Solar, and what it actually returns ──────────────────────────
//
// The buildingInsights endpoint exists to size solar arrays, but the geometry
// it computes is exactly what a roofer needs. Two area figures come back per
// roof (and per segment):
//
//   areaMeters2        — the ACTUAL SLOPED surface of the roof
//   groundAreaMeters2  — the horizontal footprint (the shadow on the ground)
//
// Verified empirically: areaMeters2 / groundAreaMeters2 == 1/cos(pitch) to
// full precision. That matters. Roofing material is bought per sloped square,
// not per footprint square, so we use areaMeters2 DIRECTLY and never apply a
// pitch multiplier to the area — Solar has already done it. The classic
// footprint-times-pitch-multiplier formula is what you reach for when all you
// have is a footprint; here we have the real thing.
//
// Pitch therefore does NOT scale the area in this file. It drives a steepness
// surcharge downstream (a 12/12 roof is slow and dangerous to walk), and it's
// shown to the homeowner because "11/12 predominant pitch" is the line that
// makes an instant estimate read as a real measurement rather than a guess.
//
// ── Degrading, never breaking ───────────────────────────────────────────────
//
// Coverage is wide but not universal, and a key can be missing in local dev.
// Every failure returns { ok: false, reason } rather than throwing, so the
// caller can fall back to manual entry — the same principle as
// lib/site/generateSite.js: the feature gets plainer, it does not 500.

import { roofLinears } from "@/lib/measure/roofGeometry";

const SQFT_PER_M2 = 10.7639104;
const SQFT_PER_SQUARE = 100; // a roofing "square" is 100 sqft, by definition

/**
 * The key used for SERVER-SIDE Google calls.
 *
 * Prefers a dedicated, unrestricted server key. Falls back to the public
 * Maps key only because that's what exists today — but a NEXT_PUBLIC key is
 * meant to be HTTP-referrer restricted, and a referrer-restricted key rejects
 * server calls (no referrer header). If roof lookups start failing in
 * production while the browser map still works, this fallback is the first
 * suspect: add GOOGLE_MAPS_SERVER_KEY (unrestricted, or IP-restricted to
 * Vercel) with Geocoding + Solar + Static Maps enabled.
 */
export function serverMapsKey() {
  return (
    process.env.GOOGLE_MAPS_SERVER_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    null
  );
}

/** Geocode a free-text address. Returns null on any failure. */
export async function geocodeAddress(address, key = serverMapsKey()) {
  if (!key || !address) return null;
  try {
    const url =
      "https://maps.googleapis.com/maps/api/geocode/json?address=" +
      encodeURIComponent(address) +
      "&key=" +
      key;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== "OK" || !data.results?.length) return null;
    const top = data.results[0];
    const loc = top.geometry?.location;
    if (!loc) return null;
    return {
      lat: loc.lat,
      lng: loc.lng,
      formattedAddress: top.formatted_address || address,
      // partial_match / a non-rooftop location_type means the pin may be on a
      // street, not a building — worth surfacing so the estimate can warn.
      precise: top.geometry?.location_type === "ROOFTOP",
    };
  } catch {
    return null;
  }
}

/** Raw buildingInsights for a point. Returns null on any failure. */
export async function fetchBuildingInsights(lat, lng, key = serverMapsKey()) {
  if (!key || lat == null || lng == null) return null;
  try {
    const url =
      "https://solar.googleapis.com/v1/buildingInsights:findClosest" +
      `?location.latitude=${lat}&location.longitude=${lng}` +
      // LOW still returns full roof geometry; it just widens coverage to
      // imagery we wouldn't get at HIGH. Accuracy of the area figure is the
      // same — quality gates imagery recency, not geometry precision.
      "&requiredQuality=LOW&key=" +
      key;
    const res = await fetch(url);
    if (!res.ok) return null; // 404 == "no building here", a normal miss
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Convert Solar pitch in degrees to the rise-over-12 a roofer reads.
 * 42.5° → 11/12. Pure.
 */
export function degreesToPitch(degrees) {
  const d = Number(degrees) || 0;
  const rise = Math.round(12 * Math.tan((d * Math.PI) / 180));
  return { rise, run: 12, degrees: Math.round(d * 10) / 10 };
}

/**
 * Steepness tier from a pitch, for the labour surcharge downstream. Standard
 * roofing practice: walkable up to ~7/12, then progressively slower and
 * requiring fall protection / staging. The percentages live with the pricing
 * recipe, not here — this only names the tier.
 */
export function steepnessTier(riseOver12) {
  const rise = Number(riseOver12) || 0;
  if (rise <= 6) return "standard";
  if (rise <= 9) return "moderate";
  if (rise <= 12) return "steep";
  return "very_steep";
}

/**
 * Reduce raw buildingInsights to the numbers an estimate uses. PURE — takes
 * the parsed API object, returns plain data, no I/O. Unit-tested against
 * hostile input in scripts, per AGENTS.md.
 *
 * Predominant pitch is AREA-WEIGHTED by segment: the pitch the largest share
 * of the roof actually is, not a mean that a few tiny dormers can drag. A flat
 * porch segment shouldn't pull a steep main roof's number down.
 */
export function summariseRoof(insights) {
  const sp = insights?.solarPotential;
  const whole = sp?.wholeRoofStats;
  const areaM2 = Number(whole?.areaMeters2);
  if (!areaM2 || areaM2 <= 0) return null;

  const areaSqft = areaM2 * SQFT_PER_M2;

  const segments = Array.isArray(sp.roofSegmentStats) ? sp.roofSegmentStats : [];

  // Bucket segment area by rounded rise/12, pick the heaviest bucket.
  //
  // The degrees reported MUST come from the same bucket as the rise. They used
  // to be glued together from two different calculations — rise from the
  // heaviest bucket, degrees from the mean across the whole roof — so a
  // cut-up roof reported contradictory numbers: 24 Sussex Dr came out as
  // "1/12 (39.1°)", and 350 5th Ave as "0/12 (10.1°)". Neither pair can both
  // be true, and the rise is the one that matters: steepnessTier() reads it,
  // so a genuinely steep roof was being tiered "standard" and losing its
  // labour surcharge.
  const byPitch = new Map();
  let weightTotal = 0;
  for (const seg of segments) {
    const segM2 = Number(seg?.stats?.areaMeters2) || 0;
    if (segM2 <= 0) continue;
    const deg = Number(seg?.pitchDegrees) || 0;
    const { rise } = degreesToPitch(deg);
    const bucket = byPitch.get(rise) || { m2: 0, degSum: 0 };
    bucket.m2 += segM2;
    bucket.degSum += deg * segM2;
    byPitch.set(rise, bucket);
    weightTotal += segM2;
  }

  let predominantRise = null;
  let heaviest = null;
  for (const [rise, bucket] of byPitch) {
    if (!heaviest || bucket.m2 > heaviest.m2) {
      heaviest = bucket;
      predominantRise = rise;
    }
  }

  const predominant =
    predominantRise != null
      ? {
          rise: predominantRise,
          run: 12,
          // The mean angle WITHIN the winning bucket, so the two halves of the
          // reading describe the same roof.
          degrees: Math.round((heaviest.degSum / heaviest.m2) * 10) / 10,
          // How much of the roof this pitch actually represents. A 35% share
          // on a 24-segment roof is a very different claim from 95% on a
          // simple gable, and the estimate should be able to say so.
          shareOfRoof:
            weightTotal > 0 ? Math.round((heaviest.m2 / weightTotal) * 100) : null,
        }
      : { ...degreesToPitch(0), shareOfRoof: null };

  return {
    areaSqft: Math.round(areaSqft * 10) / 10,
    squares: Math.round((areaSqft / SQFT_PER_SQUARE) * 10) / 10,
    predominantPitch: predominant,
    steepness: steepnessTier(predominant.rise),
    segmentCount: segments.length,
    // Ground footprint too, for sanity display ("footprint 1,620 sqft").
    footprintSqft: whole?.groundAreaMeters2
      ? Math.round(Number(whole.groundAreaMeters2) * SQFT_PER_M2 * 10) / 10
      : null,
    // The linear feet — eave, rake, ridge, hip, valley — from the same facet
    // geometry. Null where the response carries an area but no usable boxes,
    // which is a real coverage case: the takeoff then fills area and pitch and
    // leaves the seven detail fields for the estimator, exactly as before.
    linear: roofLinears(insights),
  };
}

/**
 * A satellite still of the property, for the estimate. Static Maps, not a live
 * embed — an <img> costs nothing to render on a phone in a driveway and can't
 * leak the API key into an interactive session.
 *
 * The key here IS sent to the browser (it's in the <img> src), so this uses
 * the public key deliberately, and that key should be referrer-restricted to
 * fieldquo.com. Kept separate from serverMapsKey() for exactly that reason.
 */
export function satelliteImageUrl(lat, lng, { zoom = 20, size = "640x400", scale = 2 } = {}) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key || lat == null || lng == null) return null;
  return (
    "https://maps.googleapis.com/maps/api/staticmap" +
    `?center=${lat},${lng}&zoom=${zoom}&size=${size}&scale=${scale}` +
    `&maptype=satellite&markers=color:0xffffff00%7C${lat},${lng}&key=${key}`
  );
}

// ── Finding the RIGHT building ─────────────────────────────────────────────
//
// findClosest returns the building closest to a point. At 917 Littlerock St,
// Ottawa that is an 11 m² shed, and the house — 2,163 sqft, six facets — sits
// 36 m away, unreached. A competitor quoting the same address returned 2,197.5
// sqft, so the data was there the whole time; we were asking from the wrong
// spot.
//
// The pin is the problem, not the model. Google geocodes that address 30 m off
// the house: it is a 2018-imagery subdivision where the address point looks
// interpolated down the street. Testing bounding-box containment does not
// help — the pin is inside NO building's box there.
//
// What does work, verified against that address and its neighbours: throw away
// candidates too small to be a house, then take the nearest of what is left.
// The shed is discarded on size, the house wins on distance over the larger
// building further away, and the answer lands within 1.6% of the competitor's.
//
// ══ It only runs when the first answer is bad ═════════════════════════════
//
// One call at the pin, exactly as before. An address whose pin lands on a real
// roof — the overwhelming majority — costs one Solar request and never widens.
// 24 Sussex Dr resolves in one call and is untouched by any of this. Only an
// implausible first answer pays for the ring, and the eight ring calls go out
// together rather than in sequence so the estimator waits once, not eight times.

/** The ring searched when the pin's own building is not believable. */
export const SEARCH_RING_M = 20;
const SEARCH_BEARINGS = [0, 45, 90, 135, 180, 225, 270, 315];

/** A point `metres` away from another along a compass bearing. */
export function offsetPoint(lat, lng, metres, bearingDeg) {
  const rad = (bearingDeg * Math.PI) / 180;
  const per = 111132.0;
  const perLng = 111412.84 * Math.cos((lat * Math.PI) / 180);
  return {
    lat: lat + (metres * Math.cos(rad)) / per,
    lng: lng + (metres * Math.sin(rad)) / (perLng || 1),
  };
}

/**
 * Pick the building an address most likely means, from candidates already
 * fetched. Pure, so the choice is testable without a network.
 *
 * @param candidates [{ insights, areaSqft, distanceM }]
 * @returns the winning candidate, or null when none is plausible.
 */
export function pickBuilding(candidates = []) {
  const plausible = candidates.filter(
    (c) =>
      c &&
      Number(c.areaSqft) >= MIN_PLAUSIBLE_ROOF_SQFT &&
      // `Number(null)` is 0, and 0 is finite — a candidate with no distance
      // would have been treated as sitting exactly on the pin and won every
      // comparison. The null check is the whole guard.
      c.distanceM != null &&
      Number.isFinite(Number(c.distanceM)),
  );
  if (!plausible.length) return null;
  // Nearest, not largest. Largest picks the neighbour's bigger house; nearest
  // alone picks the shed. It takes both halves.
  return plausible.reduce((best, c) => (c.distanceM < best.distanceM ? c : best));
}

/**
 * buildingInsights for an address, widening the search when the closest
 * building cannot be the one asked about.
 *
 * Returns { insights, distanceM, widened, considered } — `widened` so the
 * screen can say the pin was off rather than leaving an estimator wondering
 * why the roof it drew is not the one under the marker.
 */
async function findBuildingFor(geo, key) {
  const at = async (lat, lng) => {
    const insights = await fetchBuildingInsights(lat, lng, key);
    if (!insights) return null;
    const areaSqft = summariseRoof(insights)?.areaSqft || 0;
    return { insights, areaSqft, distanceM: metresBetween(geo, insights.center) ?? Infinity };
  };

  const first = await at(geo.lat, geo.lng);
  if (first && first.areaSqft >= MIN_PLAUSIBLE_ROOF_SQFT) {
    return { insights: first.insights, distanceM: first.distanceM, widened: false, considered: 1 };
  }

  const ring = await Promise.all(
    SEARCH_BEARINGS.map((b) => {
      const p = offsetPoint(geo.lat, geo.lng, SEARCH_RING_M, b);
      return at(p.lat, p.lng);
    }),
  );

  // De-duplicate on the model's own centre: eight probes around one house all
  // come back as that house, and counting it eight times would not change the
  // answer but would make "considered" a lie.
  const byCentre = new Map();
  for (const c of [first, ...ring]) {
    if (!c) continue;
    const key2 = `${c.insights.center?.latitude?.toFixed?.(6)},${c.insights.center?.longitude?.toFixed?.(6)}`;
    if (!byCentre.has(key2)) byCentre.set(key2, c);
  }
  const candidates = [...byCentre.values()];
  const won = pickBuilding(candidates);
  if (!won) {
    // Nothing plausible anywhere near. Hand back the pin's own answer so the
    // caller still gets an image and a warning rather than a bare failure.
    return first
      ? { insights: first.insights, distanceM: first.distanceM, widened: true, considered: candidates.length }
      : null;
  }
  return {
    insights: won.insights,
    distanceM: won.distanceM,
    widened: true,
    considered: candidates.length,
  };
}

/**
 * The one call a caller wants: address in, roof measurement out.
 *
 * Returns { ok: false, reason } on every miss so the estimate flow can fall
 * back to "tell us your roof size" rather than showing an error.
 */
export async function measureRoof(address) {
  const key = serverMapsKey();
  if (!key) {
    return { ok: false, reason: "no_key" };
  }

  const geo = await geocodeAddress(address, key);
  if (!geo) return { ok: false, reason: "geocode_failed" };

  const found = await findBuildingFor(geo, key);
  const insights = found?.insights || null;
  if (!insights) {
    // Address resolved but no roof model — outside Solar coverage, or the pin
    // isn't on a building. Give the caller enough to show a map and ask for
    // the size manually.
    return {
      ok: false,
      reason: "no_roof_coverage",
      location: { lat: geo.lat, lng: geo.lng },
      formattedAddress: geo.formattedAddress,
      satelliteImageUrl: satelliteImageUrl(geo.lat, geo.lng),
    };
  }

  const summary = summariseRoof(insights);
  if (!summary) return { ok: false, reason: "unparseable", formattedAddress: geo.formattedAddress };

  // How far the building Google found sits from the address we asked about.
  // findClosest never says, and until this line nothing checked — see
  // measurementWarnings() above for the address that made that visible.
  const pinDistanceM = found.distanceM ?? metresBetween(geo, insights.center);

  return {
    ok: true,
    source: "google_solar",
    ...summary,
    pinDistanceM,
    searchWidened: found.widened,
    buildingsConsidered: found.considered,
    imageryQuality: insights.imageryQuality || null,
    ...measurementWarnings({
      areaSqft: summary.areaSqft,
      pinDistanceM: found.widened ? null : pinDistanceM,
      imageryQuality: insights.imageryQuality,
      imageryDate: insights.imageryDate,
      segmentCount: summary.segmentCount,
      precise: geo.precise,
    }),
    location: { lat: geo.lat, lng: geo.lng },
    formattedAddress: geo.formattedAddress,
    precise: geo.precise,
    satelliteImageUrl: satelliteImageUrl(geo.lat, geo.lng),
    // The imagery date matters for trust and for warning on stale data
    // (a roof measured before an addition is wrong). Surface it when present.
    imageryDate: insights.imageryDate || null,
  };
}

// ── Is this actually the building? ─────────────────────────────────────────
//
// buildingInsights:findClosest does what it says: it returns the closest
// building it has a model for, and says nothing about how close that was.
//
// The owner measured 917 Littlerock St, Ottawa — a normal suburban house, a
// ROOFTOP-precision geocode, no partial match — and the takeoff filled in
// "Measured 119 sqft of roof surface across 2 facets". Google's model for that
// point is 11 m² of roof, sitting 23 m from the pin, built from 2018 MEDIUM
// imagery, with no HIGH model available at all. It is a shed in somebody's
// yard, reported with the same confidence as a real answer.
//
// That is the failure this codebase keeps finding: a true-sounding sentence
// about the wrong question. Verified before writing this — HIGH returns 404
// there while MEDIUM and LOW return the identical 11 m² fragment, so asking
// for better quality does not fix it and the existing LOW request is right.
// What was missing is the part that says the answer is not believable.

/** Metres between two { lat, lng } points. Equirectangular; exact enough at 30 m. */
export function metresBetween(a, b) {
  if (!a || !b) return null;
  const lat1 = Number(a.lat ?? a.latitude);
  const lng1 = Number(a.lng ?? a.longitude);
  const lat2 = Number(b.lat ?? b.latitude);
  const lng2 = Number(b.lng ?? b.longitude);
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return null;
  const mid = ((lat1 + lat2) / 2) * (Math.PI / 180);
  const x = (lng2 - lng1) * (Math.PI / 180) * Math.cos(mid) * 6371000;
  const y = (lat2 - lat1) * (Math.PI / 180) * 6371000;
  return Math.round(Math.sqrt(x * x + y * y) * 10) / 10;
}

/**
 * The smallest roof that can be a house.
 *
 * A one-storey bungalow with a 1930s footprint is around 900 sqft of roof; a
 * detached garage is around 400. Below 400 there is nothing residential left —
 * it is a shed, a porch, or a fragment of a model. Deliberately generous: the
 * point is to catch 119, not to argue about 850.
 */
export const MIN_PLAUSIBLE_ROOF_SQFT = 400;

/**
 * How far the model's centre may sit from the geocoded pin.
 *
 * A large house's centroid is legitimately 15 m from its front door. Two lots
 * over is not. 30 m keeps the first and refuses the second.
 */
export const MAX_PIN_DISTANCE_M = 30;

/**
 * Whether a measurement should be believed, and what to say when it should not.
 *
 * Returns `{ trustworthy, warnings }` — never throws, never refuses on its own
 * authority. The decision of what to do about an untrustworthy reading belongs
 * to the screen, which can show the satellite image beside the warning and let
 * an estimator who can see the roof use it anyway. Refusing here would take
 * that away from the one person who can actually judge.
 */
export function measurementWarnings({
  areaSqft = 0,
  pinDistanceM = null,
  imageryQuality = null,
  imageryDate = null,
  segmentCount = 0,
  precise = true,
} = {}) {
  const warnings = [];
  const area = Number(areaSqft) || 0;

  if (area > 0 && area < MIN_PLAUSIBLE_ROOF_SQFT) {
    warnings.push({
      code: "too_small",
      severe: true,
      text:
        `Google's roof model here is only ${Math.round(area)} sqft across ` +
        `${segmentCount} facet${segmentCount === 1 ? "" : "s"}. That is a shed or a garage, ` +
        "not a house — the model has found the wrong building, or only part of the right one.",
    });
  }

  if (pinDistanceM != null && pinDistanceM > MAX_PIN_DISTANCE_M) {
    warnings.push({
      code: "far_from_pin",
      severe: true,
      text:
        `The roof it measured sits ${Math.round(pinDistanceM)} m from the address. ` +
        "That is far enough to be a neighbour's building.",
    });
  }

  if (!precise) {
    warnings.push({
      code: "imprecise_geocode",
      severe: false,
      text:
        "The address resolved to a street, not a rooftop, so the measurement is of whatever " +
        "building was nearest that point.",
    });
  }

  // Not severe on its own — plenty of correct models come off older imagery —
  // but it is the fact that explains a bad one, so it is worth saying beside it.
  const year = Number(imageryDate?.year) || null;
  const age = year ? new Date().getFullYear() - year : null;
  if (age != null && age >= 4) {
    warnings.push({
      code: "stale_imagery",
      severe: false,
      text:
        `The imagery is from ${year}${imageryQuality ? ` (${String(imageryQuality).toLowerCase()} quality)` : ""}. ` +
        "Anything built or re-roofed since is not in it.",
    });
  }

  return { trustworthy: !warnings.some((w) => w.severe), warnings };
}
