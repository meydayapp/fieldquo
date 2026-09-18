// lib/measure/gutterMeasurement.js
//
// Linear feet of eavestrough and a downspout count, from the same Google Solar
// roof model the roofing takeoff already measures from. One address, one
// Solar request — the roof is fetched once and read twice.
//
// ══ Where the gutter is ═══════════════════════════════════════════════════
//
// A gutter hangs on an EAVE: the low edge of a sloping facet, where water
// runs off. It does not hang on a rake (the sloping edge of a gable end),
// so the figure a gutter installer wants is the eave total, not the
// building's perimeter. lib/measure/roofGeometry.js already splits the
// outline into eave and rake for the roofing takeoff — `eaveFt` there is
// what the drip edge runs along on the low sides — and that is REUSED here
// rather than recomputed. On 204 Avro Cir, Ottawa it reads 190 ft; the
// competitor the owner measured against says 184.
//
// ── Except on a flat roof ────────────────────────────────────────────────
//
// A facet at 0.3° has no "down". Solar still reports an azimuth for it, but
// the number is a placeholder, and the eave/rake split that reads off it is
// noise: 250 First Ave, Ottawa — a flat-roofed Glebe house — came back as
// 81 ft of eave and 69 ft of rake for a roof that drains over whichever edge
// the installer pitches it to. So when most of the roof is flat, the whole
// outline is offered as gutter and the panel says so. That address then reads
// 150 ft against the competitor's 144. Flat roofs also frequently drain
// internally and want no eavestrough at all, which is the first line of the
// "still needs you" list.
//
// ══ Downspouts ════════════════════════════════════════════════════════════
//
// The rule, and it is a rule of thumb, not a measurement:
//
//   · one downspout per DOWNSPOUT_SPACING_FT (35 ft) of gutter, rounded up —
//     a 5" K-style trough drains roughly 600–700 sqft of roof per outlet,
//     which on an ordinary eave overhang is 30–40 ft of run;
//   · never fewer than the number of separate eave RUNS, because every run
//     that is not mitred into a neighbour needs its own outlet — the corners
//     are where the outlets go;
//   · never more than one per DOWNSPOUT_MIN_SPACING_FT (20 ft). A competitor
//     quoted 418 Bd Gréber, Gatineau at 79 ft of gutter and 18 downspouts —
//     one every four feet — because it counted outlets off a 543 ft
//     perimeter it had not counted as gutter. The cap makes that arithmetic
//     impossible here, and the flags below refuse the building anyway.
//
// Against the two houses the owner checked: 190 ft → 6 (competitor: 6 on
// 184 ft); 150 ft → 5 (competitor: 5 on 144 ft).
//
// ══ Flags are the product ═════════════════════════════════════════════════
//
// 917 Littlerock St came back from that competitor as 7 ft of gutter and 4
// downspouts, priced at their minimum. Seven feet of gutter is not a house;
// it is the wrong building, and the honest output is a sentence saying so,
// not a price. gutterFlags() is where that sentence comes from. Severe flags
// stop the takeoff being filled (the estimator can still choose to use the
// numbers, beside the image); every flag is stored on the takeoff so the
// quote's completeness review carries it — see lib/quotes/completeness.js.
//
// Pure except for measureGutters(), which is measureRoof() plus this file.

import { measureRoof, MIN_PLAUSIBLE_ROOF_SQFT } from "@/lib/measure/roofMeasurement";
import { FLAT_PITCH_DEGREES, lowSlopeShare } from "@/lib/measure/roofGeometry";

/** One downspout per this many feet of gutter, rounded up. */
export const DOWNSPOUT_SPACING_FT = 35;

/** Never more than one downspout per this many feet — the Gréber cap. */
export const DOWNSPOUT_MIN_SPACING_FT = 20;

/**
 * Below this, it is not a house. A detached garage has ~40 ft of eave; a
 * bungalow ~120. Seven is a shed, or the wrong roof.
 */
export const MIN_PLAUSIBLE_GUTTER_FT = 40;

/**
 * Above this, it is not a house either. A very large house tops out around
 * 400 ft of eave; 600 is a duplex row or a commercial building, and a gutter
 * quote for one is an on-site job.
 */
export const MAX_PLAUSIBLE_GUTTER_FT = 600;

/**
 * A house's roof is under this. 418 Bd Gréber is 15,730 sqft of flat roof —
 * a strip-mall unit that a street-interpolated pin landed on.
 */
export const MAX_PLAUSIBLE_HOUSE_ROOF_SQFT = 8000;

/** Imagery older than this is flagged. Gutters get replaced; 2018 is a guess. */
export const MAX_IMAGERY_AGE_YEARS = 5;

/**
 * When at least this share of the roof is flat (≤ FLAT_PITCH_DEGREES, from
 * roofGeometry), the outline is the gutter — see the header.
 */
export const FLAT_ROOF_SHARE = 0.5;

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export { FLAT_PITCH_DEGREES, lowSlopeShare };

/**
 * The downspout rule, as a function so a check can execute it.
 *
 * @param gutterFt  total gutter length
 * @param eaveRuns  separate eave runs (each needs at least one outlet)
 */
export function downspoutCount(gutterFt, eaveRuns = 1) {
  const ft = num(gutterFt);
  if (ft <= 0) return 0;
  const bySpacing = Math.ceil(ft / DOWNSPOUT_SPACING_FT);
  const runs = Math.max(1, Math.floor(num(eaveRuns)) || 1);
  const cap = Math.max(1, Math.floor(ft / DOWNSPOUT_MIN_SPACING_FT));
  return Math.min(Math.max(bySpacing, runs), cap);
}

/**
 * How many separate eave runs a roof shape has.
 *
 * A gable has two (one each side of the ridge); a hip has four, one per
 * side, mitred at the corners; a flat rectangle has four edges. A complex
 * roof has one per facing direction that carries a real share of the roof —
 * roofGeometry's `directions` list already drops the slivers.
 */
export function eaveRunCount(linear, flat = false) {
  if (flat) return 4;
  const shape = linear?.shape;
  if (shape === "simple_gable" || shape === "gable") return 2;
  if (shape === "simple_hip" || shape === "hip") return 4;
  const n = Array.isArray(linear?.directions) ? linear.directions.length : 0;
  return Math.max(1, n);
}

/** "2024-07-29" from a Solar imageryDate, or null. */
export function imageryDateText(imageryDate) {
  const y = num(imageryDate?.year);
  if (!y) return null;
  const m = num(imageryDate?.month);
  const d = num(imageryDate?.day);
  const pad = (n) => String(n).padStart(2, "0");
  return m && d ? `${y}-${pad(m)}-${pad(d)}` : String(y);
}

/**
 * The sentence the roofing panel already says about the imagery, in the
 * same words: "The imagery is from 2018 (medium quality)."
 */
export function imageryText(imageryDate, imageryQuality) {
  const when = imageryDateText(imageryDate);
  if (!when) return null;
  const q = imageryQuality ? ` (${String(imageryQuality).toLowerCase()} quality)` : "";
  return `The imagery is from ${when}${q}.`;
}

/**
 * Everything that makes this gutter figure not believable, in words.
 *
 * `now` is injectable so the imagery-age flag is testable; the default is
 * the real clock. Returns { trustworthy, flags } — trustworthy is false when
 * any flag is severe. Never throws.
 */
export function gutterFlags(
  {
    gutterFt = 0,
    downspouts = 0,
    roofAreaSqft = 0,
    pinDistanceM = null,
    searchWidened = false,
    precise = true,
    imageryDate = null,
    imageryQuality = null,
    roofWarnings = [],
  } = {},
  now = new Date(),
) {
  const flags = [];
  const ft = Math.round(num(gutterFt));
  const area = num(roofAreaSqft);

  // The roofing measurement's own severe verdicts carry through unchanged —
  // a shed 23 m from the pin is the wrong building for gutters too.
  for (const w of Array.isArray(roofWarnings) ? roofWarnings : []) {
    if (w?.severe && (w.code === "too_small" || w.code === "far_from_pin")) {
      flags.push({ code: w.code, severe: true, text: w.text });
    }
  }

  if (area > MAX_PLAUSIBLE_HOUSE_ROOF_SQFT) {
    flags.push({
      code: "not_a_house",
      severe: true,
      text:
        `${Math.round(area).toLocaleString()} sqft of roof is a commercial building, not a house — ` +
        "the pin has landed on the wrong roof. Book an on-site measure.",
    });
  }

  if (ft > 0 && ft < MIN_PLAUSIBLE_GUTTER_FT) {
    flags.push({
      code: "gutter_too_short",
      severe: true,
      text: `${ft} ft of gutter is not a house — book an on-site measure.`,
    });
  } else if (ft > MAX_PLAUSIBLE_GUTTER_FT) {
    flags.push({
      code: "gutter_too_long",
      severe: true,
      text: `${ft} ft of gutter is more than a house — book an on-site measure.`,
    });
  }

  // Cannot happen through downspoutCount(); can happen to a stored takeoff
  // somebody typed over. Kept here so completeness and the panel share it.
  const ds = Math.floor(num(downspouts));
  if (ft > 0 && ds * DOWNSPOUT_MIN_SPACING_FT > ft) {
    flags.push({
      code: "downspout_ratio",
      severe: true,
      text:
        `${ds} downspouts on ${ft} ft of gutter is one every ${Math.max(1, Math.round(ft / ds))} ft — ` +
        "that is not a house. Book an on-site measure.",
    });
  }

  if (!precise) {
    flags.push({
      code: "imprecise_geocode",
      severe: false,
      text:
        "The address resolved to a point on the street, not a rooftop, so this is whatever " +
        "building was nearest that point. Check the image is the right house.",
    });
  }
  if (searchWidened) {
    flags.push({
      code: "pin_off_building",
      severe: false,
      text:
        "The address pin was not on a building" +
        (pinDistanceM != null ? `; the nearest house-sized roof, ${Math.round(num(pinDistanceM))} m away, was measured` : "") +
        ". Check the image is the right house.",
    });
  }

  const year = num(imageryDate?.year);
  const age = year ? now.getFullYear() - year : null;
  if (age != null && age > MAX_IMAGERY_AGE_YEARS) {
    flags.push({
      code: "stale_imagery",
      severe: false,
      text:
        `${imageryText(imageryDate, imageryQuality) || `The imagery is from ${year}.`} ` +
        `That is ${age} years old — gutters replaced since are not in it. Confirm on site before pricing.`,
    });
  }

  return { trustworthy: !flags.some((f) => f.severe), flags };
}

/**
 * The gutter figures from a roof measurement. PURE — takes what measureRoof()
 * returns (or a shape like it) and derives; no I/O.
 *
 * Returns null when there is no linear geometry to read, so the caller gets
 * nothing rather than a confident zero.
 */
export function deriveGutters(roof, now = new Date()) {
  const linear = roof?.linear;
  if (!linear || !(num(linear.perimeterFt) > 0)) return null;

  const flat = num(roof.lowSlopeShare) >= FLAT_ROOF_SHARE;
  const gutterFt = flat ? Math.round(num(linear.perimeterFt)) : Math.round(num(linear.eaveFt));
  const eaveRuns = eaveRunCount(linear, flat);
  const downspouts = downspoutCount(gutterFt, eaveRuns);

  const { trustworthy, flags } = gutterFlags(
    {
      gutterFt,
      downspouts,
      roofAreaSqft: roof.areaSqft,
      pinDistanceM: roof.pinDistanceM,
      searchWidened: roof.searchWidened,
      precise: roof.precise,
      imageryDate: roof.imageryDate,
      imageryQuality: roof.imageryQuality,
      roofWarnings: roof.warnings,
    },
    now,
  );

  return {
    gutterFt,
    downspouts,
    eaveRuns,
    // "eave" — the low edges of the sloping facets; "perimeter" — a flat
    // roof, where the whole outline was offered. Stored so the panel and the
    // review can say which.
    basis: flat ? "perimeter" : "eave",
    lowSlopeShare: Math.round(num(roof.lowSlopeShare) * 100) / 100,
    perimeterFt: Math.round(num(linear.perimeterFt)),
    eaveFt: Math.round(num(linear.eaveFt)),
    rakeFt: Math.round(num(linear.rakeFt)),
    shape: linear.shape,
    imagery: {
      date: imageryDateText(roof.imageryDate),
      year: num(roof.imageryDate?.year) || null,
      quality: roof.imageryQuality || null,
      text: imageryText(roof.imageryDate, roof.imageryQuality),
    },
    trustworthy,
    flags,
  };
}

/**
 * What the panel tells the estimator. The second list is the point.
 *
 * Storeys are the one thing every gutter price hangs off that no roof model
 * carries, which is why the takeoff's storey picker is never touched here.
 */
export function summariseGutters(g) {
  if (!g) return null;
  const flatNote =
    g.basis === "perimeter"
      ? " Most of this roof is flat, so the whole outline is offered as gutter."
      : "";
  return {
    headline:
      `${g.gutterFt} ft of gutter along the ${g.basis === "perimeter" ? "roof outline" : "eaves"}, ` +
      `${g.downspouts} downspout${g.downspouts === 1 ? "" : "s"}.${flatNote}`,
    measured: [
      `${g.perimeterFt} ft around the building — ${g.eaveFt} ft of eave, ${g.rakeFt} ft of rake`,
      g.imagery.text,
    ].filter(Boolean),
    derived: [
      `${g.downspouts} downspouts is one per ${DOWNSPOUT_SPACING_FT} ft of run, at least one per eave run ` +
        `(${g.eaveRuns} here), never more than one per ${DOWNSPOUT_MIN_SPACING_FT} ft. Move them to where the ` +
        "drains actually are.",
    ],
    cannotKnow: [
      "Storeys — the price and the ladders hang off it, and a roof model has no height in it.",
      g.basis === "perimeter"
        ? "Whether this flat roof drains internally. Many do, and want no eavestrough at all."
        : "Which edges already have gutter, and what condition it is in.",
      "Where the downspouts discharge — a splash block, a drain tile, a rain barrel.",
      "Fascia condition. Rotten fascia will not hold a new run.",
    ],
  };
}

/**
 * Address in, gutter figures out. One Solar request — the roof measurement
 * is measureRoof()'s, and this reads it.
 *
 * Every miss returns { ok: false, reason } exactly as measureRoof does, so
 * the route and the panel branch the same way for both trades.
 */
export async function measureGutters(address) {
  const roof = await measureRoof(address);
  if (!roof?.ok) return roof;
  const gutters = deriveGutters(roof);
  if (!gutters) {
    return {
      ok: false,
      reason: "no_linear_geometry",
      formattedAddress: roof.formattedAddress,
      satelliteImageUrl: roof.satelliteImageUrl,
      location: roof.location,
    };
  }
  return {
    ok: true,
    source: "google_solar",
    ...gutters,
    roofAreaSqft: roof.areaSqft,
    pinDistanceM: roof.pinDistanceM,
    searchWidened: roof.searchWidened,
    buildingsConsidered: roof.buildingsConsidered,
    location: roof.location,
    formattedAddress: roof.formattedAddress,
    precise: roof.precise,
    satelliteImageUrl: roof.satelliteImageUrl,
    imageryDate: roof.imageryDate,
    imageryQuality: roof.imageryQuality,
  };
}

/**
 * The takeoff fields a gutter measurement writes, on the gutter takeoff's
 * own field names (lib/pricing/tradeScope.js buildGutters).
 *
 * The downspout count goes where the work type will price it: an install
 * or replacement sells new downspouts; a cleaning flushes the existing ones.
 * buildGutters prices `downspoutsInstalled` on ANY work type, so writing it
 * onto a cleaning job would add a downspout install nobody sold. A repair or
 * a guard-only job gets the count in the report and nothing in the fields.
 */
export function gutterTakeoffPatch(g, workType = "cleaning", address = "") {
  if (!g) return null;
  const patch = {
    gutterFt: g.gutterFt,
    measuredFrom: "satellite",
    measuredAddress: address || "",
    measuredBasis: g.basis,
    measuredImagery: { date: g.imagery?.date || null, year: g.imagery?.year || null, quality: g.imagery?.quality || null },
    measuredFlags: (g.flags || []).map((f) => ({ code: f.code, severe: Boolean(f.severe), text: f.text })),
  };
  if (workType === "install" || workType === "replacement") patch.downspoutsInstalled = g.downspouts;
  else if (workType === "cleaning") patch.downspoutsFlushed = g.downspouts;
  return patch;
}

export { MIN_PLAUSIBLE_ROOF_SQFT };
