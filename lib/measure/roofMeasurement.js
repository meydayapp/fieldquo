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

  const insights = await fetchBuildingInsights(geo.lat, geo.lng, key);
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

  return {
    ok: true,
    source: "google_solar",
    ...summary,
    location: { lat: geo.lat, lng: geo.lng },
    formattedAddress: geo.formattedAddress,
    precise: geo.precise,
    satelliteImageUrl: satelliteImageUrl(geo.lat, geo.lng),
    // The imagery date matters for trust and for warning on stale data
    // (a roof measured before an addition is wrong). Surface it when present.
    imageryDate: insights.imageryDate || null,
  };
}
