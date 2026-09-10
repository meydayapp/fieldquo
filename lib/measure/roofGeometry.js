// lib/measure/roofGeometry.js
//
// The LINEAR feet of a roof, derived from the same Google Solar response that
// already gives us its area.
//
// ══ Why this exists ═══════════════════════════════════════════════════════
//
// summariseRoof() answers "how big is the roof" and stops there, so the quote
// builder's roofing takeoff filled in exactly two of its thirteen fields —
// area and pitch — and left the estimator to type ice & water, drip edge,
// starter, valleys, ridge & hip, ridge vent and step flashing from memory.
// Those seven lines are a third of a re-roof's price. A measurement that fills
// the two cheapest fields and leaves the expensive ones blank is not really a
// measurement.
//
// Solar's roofSegmentStats carry per-facet geometry — a ground area, a bounding
// box, an azimuth and a pitch — and that is enough to work out how the facets
// meet, which is what every one of those seven numbers is about.
//
// ══ The one trick, and its honest error bound ═════════════════════════════
//
// A bounding box is axis-aligned; a house is not. Reading a facet's width
// straight off its box is exact when the building faces north and off by up to
// 3× when it sits at 45°, which is a very common way for a house to sit.
//
// So the box is used ONLY for its ASPECT RATIO, never for its absolute
// lengths, and the sides are then scaled so their product equals the ground
// area the API actually reported:
//
//     r    = extentAlongSlope / extentAcrossSlope   (from the box)
//     run  = √(area · r)      eave = √(area / r)    (so run · eave == area)
//
// Exact for a cardinally-aligned rectangle. For one rotated 45° the aspect
// collapses to 1 and both sides come back as √area — wrong, but wrong by at
// most √(long/short), never by the 3× the raw box would give. A bounded error
// on every house beats an exact answer on the third of them that face north.
//
// ══ What is measured and what is convention ═══════════════════════════════
//
// Measured, from the API: total sloped area, pitch, ground area per facet,
// facet count, azimuths.
//
// Derived, exactly, from those: the building's footprint perimeter, and the
// total length of INTERNAL edges — the ones where two facets meet. Every edge
// of every facet is either on the outline (counted once) or shared with a
// neighbour (counted twice), so
//
//     internal = (Σ facet perimeters − footprint perimeter) / 2
//
// is arithmetic, not a guess.
//
// CONVENTION, and labelled as such wherever it surfaces: how that internal
// total splits between ridge, hip and valley, and how the outline splits
// between eave and rake. Nothing in the Solar response says which side of a
// shared edge slopes away from it, so the split is read off the azimuth
// pattern using the table below. Every number this module produces lands in a
// field the estimator can overwrite, and the takeoff panel says which numbers
// were measured and which were derived — see the report from summarise().
//
// Pure. No I/O, no imports. scripts/check-roof-prefill.mjs drives every branch.

const FT_PER_M = 3.280839895;

/** A roofing square is 100 sqft, by definition. */
export const SQFT_PER_SQUARE = 100;

/**
 * How the internal edge total splits, by the shape the azimuths describe.
 *
 * These are conventions from ordinary residential framing, not measurements:
 *
 *  - A GABLE roof's facets all meet along one line at the top. Almost every
 *    internal foot is ridge; the only valleys come from a dormer or an ell.
 *  - A HIP roof trades most of that ridge for four hips running down to the
 *    corners, and the ell that meets it makes a valley on each side.
 *  - COMPLEX is anything with more facing directions than a hip has, which in
 *    practice means intersecting roofs — the shape that makes valleys.
 *
 * Exported so the check can assert each row sums to 1: a table that does not
 * would silently lose or invent linear feet.
 */
export const EDGE_SPLIT = {
  // A valley is a re-entrant corner, and a single roof mass has none: it takes
  // two roofs meeting to make one. That shows up in the data as MORE FACETS
  // THAN FACING DIRECTIONS, which is what separates each simple_ row from the
  // one under it — not a tuning knob, a geometric fact.
  //
  // The simple rows earned their place. Against a 40×30 gable the old single
  // gable row invented four feet of valley that cannot exist, and against a
  // 40×30 hip it put a fifth of the internal length into valleys and lost a
  // third of the hip cap. Both are priced lines.
  simple_gable: { ridge: 1.0, hip: 0.0, valley: 0.0 },
  gable: { ridge: 0.85, hip: 0.0, valley: 0.15 },
  simple_hip: { ridge: 0.15, hip: 0.85, valley: 0.0 },
  hip: { ridge: 0.25, hip: 0.55, valley: 0.2 },
  complex: { ridge: 0.3, hip: 0.35, valley: 0.35 },
};

/**
 * A facet is counted as a distinct direction only above this share of the
 * roof. Solar routinely reports slivers — a 2 m² triangle beside a chimney —
 * and counting those as directions turns every simple gable into "complex",
 * which is the difference between 10% valleys and 35% of them.
 */
export const DIRECTION_MIN_SHARE = 0.08;

/** Metres per degree of latitude and longitude at a given latitude. */
export function metresPerDegree(latDeg) {
  const phi = ((Number(latDeg) || 0) * Math.PI) / 180;
  return {
    lat: 111132.92 - 559.82 * Math.cos(2 * phi) + 1.175 * Math.cos(4 * phi),
    lng: 111412.84 * Math.cos(phi) - 93.5 * Math.cos(3 * phi),
  };
}

/**
 * A Solar boundingBox in metres, as { east, north }, or null.
 *
 * Returns null rather than zeros on a malformed box. A zero span would divide
 * into an aspect ratio of zero or Infinity downstream, and Infinity feet of
 * drip edge is worse than no answer.
 */
export function spanMetres(box) {
  const sw = box?.sw;
  const ne = box?.ne;
  if (!sw || !ne) return null;
  const swLat = Number(sw.latitude);
  const swLng = Number(sw.longitude);
  const neLat = Number(ne.latitude);
  const neLng = Number(ne.longitude);
  if (![swLat, swLng, neLat, neLng].every(Number.isFinite)) return null;
  const per = metresPerDegree((swLat + neLat) / 2);
  const north = Math.abs(neLat - swLat) * per.lat;
  const east = Math.abs(neLng - swLng) * per.lng;
  if (!(north > 0) || !(east > 0)) return null;
  return { east, north };
}

/**
 * The rectangle a facet behaves like: how far it runs down the slope, and how
 * wide its eave is. See the header for why the box supplies the ratio only.
 *
 * `azimuthDegrees` is the compass direction the facet FACES, which is the
 * direction water runs down it, so the run is the extent along that heading
 * and the eave is the extent across it.
 */
export function facetRectangle({ span, areaM2, azimuthDegrees }) {
  const area = Number(areaM2);
  if (!span || !(area > 0)) return null;
  const rad = ((Number(azimuthDegrees) || 0) * Math.PI) / 180;
  const along = Math.abs(span.east * Math.sin(rad)) + Math.abs(span.north * Math.cos(rad));
  const across = Math.abs(span.east * Math.cos(rad)) + Math.abs(span.north * Math.sin(rad));
  if (!(along > 0) || !(across > 0)) return null;
  const r = along / across;
  return { run: Math.sqrt(area * r), eave: Math.sqrt(area / r) };
}

/** The bounding box that contains every facet's box. Null if none is usable. */
export function unionBox(segments) {
  let sw = null;
  let ne = null;
  for (const seg of Array.isArray(segments) ? segments : []) {
    const b = seg?.boundingBox;
    const a = b?.sw;
    const c = b?.ne;
    if (!a || !c) continue;
    const lo = { latitude: Number(a.latitude), longitude: Number(a.longitude) };
    const hi = { latitude: Number(c.latitude), longitude: Number(c.longitude) };
    if (![lo.latitude, lo.longitude, hi.latitude, hi.longitude].every(Number.isFinite)) continue;
    sw = sw
      ? { latitude: Math.min(sw.latitude, lo.latitude), longitude: Math.min(sw.longitude, lo.longitude) }
      : lo;
    ne = ne
      ? { latitude: Math.max(ne.latitude, hi.latitude), longitude: Math.max(ne.longitude, hi.longitude) }
      : hi;
  }
  return sw && ne ? { sw, ne } : null;
}

/**
 * The distinct directions the roof faces, largest share first.
 *
 * Bucketed to 45°, because that is the resolution framing actually has: a
 * gable faces two ways, a hip four, and the 3° of scatter Solar reports across
 * one physical plane is noise, not a fifth direction.
 */
export function facingDirections(segments) {
  const buckets = new Map();
  let total = 0;
  for (const seg of Array.isArray(segments) ? segments : []) {
    const a = Number(seg?.stats?.groundAreaMeters2) || 0;
    if (a <= 0) continue;
    const az = ((Number(seg?.azimuthDegrees) || 0) % 360 + 360) % 360;
    const bucket = Math.round(az / 45) % 8;
    buckets.set(bucket, (buckets.get(bucket) || 0) + a);
    total += a;
  }
  if (total <= 0) return [];
  return [...buckets.entries()]
    .map(([bucket, m2]) => ({ degrees: bucket * 45, share: m2 / total }))
    .filter((d) => d.share >= DIRECTION_MIN_SHARE)
    .sort((a, b) => b.share - a.share);
}

/**
 * gable | hip | complex, from those directions.
 *
 * Two directions is a gable however far apart they are — a shed roof reports
 * one and is handled by the same row, since a shed has no hips or valleys
 * either. Four is the hip signature. More than four means two roofs meeting,
 * which is what actually makes valleys.
 */
export function roofShape(directions, facets = 0) {
  const n = (directions || []).length;
  // One facet per direction means one roof mass — see EDGE_SPLIT. A shed roof
  // reports one direction and lands on simple_gable, which is right: a shed
  // has no hips and no valleys either, and its one "ridge" is the high edge.
  const simple = Number(facets) <= n;
  if (n <= 2) return simple ? "simple_gable" : "gable";
  if (n <= 4) return simple ? "simple_hip" : "hip";
  return "complex";
}

/**
 * Everything linear, in FEET, from a parsed buildingInsights object.
 *
 * Returns null when the response carries no usable facet geometry, so a caller
 * gets nothing rather than a plausible zero. Coverage exists where the area is
 * reported but the boxes are not, and a roof with 0 ft of drip edge quoted at
 * $3.00/ft is exactly the kind of confident wrong number this codebase keeps
 * finding.
 */
export function roofLinears(insights) {
  const sp = insights?.solarPotential;
  const segments = Array.isArray(sp?.roofSegmentStats) ? sp.roofSegmentStats : [];
  if (!segments.length) return null;

  let facetPerimeterM = 0;
  let eaveM = 0;
  let measuredFacets = 0;
  for (const seg of segments) {
    const rect = facetRectangle({
      span: spanMetres(seg?.boundingBox),
      areaM2: Number(seg?.stats?.groundAreaMeters2),
      azimuthDegrees: seg?.azimuthDegrees,
    });
    if (!rect) continue;
    facetPerimeterM += 2 * (rect.run + rect.eave);
    eaveM += rect.eave;
    measuredFacets += 1;
  }
  if (!measuredFacets) return null;

  // The building outline, from the union box and the ground area Solar
  // reported for the whole roof — the same aspect-ratio-and-scale trick, one
  // level up. Falling back to the summed facet ground area keeps a response
  // that omits wholeRoofStats usable.
  const outer = spanMetres(unionBox(segments));
  const groundM2 =
    Number(sp?.wholeRoofStats?.groundAreaMeters2) ||
    segments.reduce((t, s) => t + (Number(s?.stats?.groundAreaMeters2) || 0), 0);
  if (!outer || !(groundM2 > 0)) return null;
  const ratio = outer.east / outer.north;
  const side = { a: Math.sqrt(groundM2 * ratio), b: Math.sqrt(groundM2 / ratio) };
  const perimeterM = 2 * (side.a + side.b);

  // Shared edges are counted twice across the facet perimeters and once in the
  // outline. Clamped at zero: a roof whose facets tile the outline exactly has
  // no internal edges, and rounding must not make that negative.
  const internalM = Math.max(0, (facetPerimeterM - perimeterM) / 2);

  const directions = facingDirections(segments);
  const shape = roofShape(directions, measuredFacets);
  const split = EDGE_SPLIT[shape];

  // ── Eave against rake ──────────────────────────────────────────────────
  //
  // A rake is the sloping edge of a GABLE END. A hip roof does not have one:
  // every facet drains over the outline, so the whole outline is eave. That is
  // geometry, not a ratio, so the hip rows say it outright rather than trusting
  // the summed facet widths — which run short on a hip, because its end facets
  // are triangles and this file reads every facet as a rectangle. Left to the
  // sum, the 40×30 hip came out 106 ft of eave and 34 ft of rake it does not
  // have, and 34 ft of ice & water went missing with it.
  //
  // The gable rows keep the sum, which is exact for them: on a plain 40×30
  // gable it returns 80 ft of eave and 60 ft of rake to the foot.
  const hipLike = shape === "simple_hip" || shape === "hip";
  const eaveClampedM = hipLike
    ? perimeterM * (shape === "simple_hip" ? 1 : 0.9)
    : Math.min(eaveM, perimeterM);
  const rakeM = Math.max(0, perimeterM - eaveClampedM);

  const ft = (m) => Math.round(m * FT_PER_M);

  return {
    facets: segments.length,
    measuredFacets,
    shape,
    directions,
    perimeterFt: ft(perimeterM),
    eaveFt: ft(eaveClampedM),
    rakeFt: ft(rakeM),
    ridgeFt: ft(internalM * split.ridge),
    hipFt: ft(internalM * split.hip),
    valleyFt: ft(internalM * split.valley),
    internalFt: ft(internalM),
  };
}

/**
 * The linear feet mapped onto the takeoff's own field names.
 *
 * Kept here rather than in the React component because it is the part with
 * rules in it, and rules in a component are rules no check can execute.
 *
 * Which detail runs where, and why:
 *
 *  - ICE & WATER goes at the eaves and up every valley. Both are code in a
 *    freezing climate and neither is optional, so both are counted.
 *  - DRIP EDGE and STARTER run the whole outline. Starter at the rakes as well
 *    as the eaves is what the wind warranties have required for years now; an
 *    estimator who still runs eaves only can halve the number in the field.
 *  - RIDGE & HIP CAP caps both, which is why they are one field in the book.
 *  - RIDGE VENT runs the ridge only. Hips are not vented.
 *  - STEP FLASHING is deliberately ABSENT. It is the length of roof meeting a
 *    WALL — a dormer cheek, a chimney side, an ell against the storey above —
 *    and nothing in a roof model says where a wall is. Guessing it would put a
 *    priced line on the quote for something nobody looked at.
 */
export function takeoffPatch(linears) {
  if (!linears) return null;
  return {
    iceWaterFt: linears.eaveFt + linears.valleyFt,
    dripEdgeFt: linears.perimeterFt,
    starterFt: linears.perimeterFt,
    valleyFt: linears.valleyFt,
    ridgeHipFt: linears.ridgeFt + linears.hipFt,
    ridgeVentFt: linears.ridgeFt,
  };
}

/**
 * What the panel tells the estimator: what was filled, and what it could not
 * know. The second list is the point of this function.
 *
 * A takeoff that quietly fills six fields and leaves four at zero reads as
 * "the roof needs none of those". Saying out loud that layers, sheathing,
 * skylights and chimneys are not visible in a roof model is the difference
 * between an estimate the estimator finishes and one they ship short.
 */
export function summarise(linears) {
  if (!linears) return null;
  const shapeWord = {
    simple_gable: "gable",
    gable: "gable",
    simple_hip: "hip",
    hip: "hip",
    complex: "intersecting",
  }[linears.shape];
  // "a intersecting roof" is the kind of thing an estimator forwards to a
  // homeowner without re-reading it.
  const article = /^[aeiou]/.test(shapeWord) ? "an" : "a";
  return {
    headline:
      `${linears.facets} facets facing ${linears.directions.length} way` +
      `${linears.directions.length === 1 ? "" : "s"} — read as ${article} ${shapeWord} roof.`,
    measured: [
      `${linears.perimeterFt} ft around the building`,
      `${linears.eaveFt} ft of eave and ${linears.rakeFt} ft of rake`,
      `${linears.internalFt} ft where facets meet`,
    ],
    derived: [
      `Ridge ${linears.ridgeFt} ft, hip ${linears.hipFt} ft and valley ${linears.valleyFt} ft ` +
        `are that ${linears.internalFt} ft split the way ${article} ${shapeWord} roof usually splits it. ` +
        `Nothing in the roof model says which side of a shared edge slopes away from it.`,
    ],
    cannotKnow: [
      "Layers to strip, and how much sheathing is bad — nobody can see either from above.",
      "Vent boots, box vents, skylights and chimneys — count them off the satellite image.",
      "Step flashing, which is roof meeting wall. The roof model has no walls in it.",
      "Storeys, which change the labour but not the materials.",
    ],
  };
}

// ── Attic ventilation ──────────────────────────────────────────────────────
//
// Ridge vent and box vents are the two fields on the takeoff that a roofer
// does not measure — they CALCULATE them, from code, off the ceiling area
// below. So this file can fill them properly rather than guessing.
//
// The rule is the same on both sides of the border in the shape that matters
// here: net free vent area of 1 to 300 of the insulated ceiling, when the
// venting is split roughly half low (soffit) and half high (ridge or box).
// Low slope loses the stack effect that makes that work and goes to 1 to 150.
// NBC 9.19.1 and IRC R806.2 differ in wording and agree in arithmetic.
//
// Only the HIGH half is priced here. The low half is soffit intake, which is
// not a line on a roofing takeoff — it is either already there or it is a
// separate conversation about blocked soffits.

/** Net free area a vent delivers, in square inches. Manufacturer nominals. */
export const NFA_PER_RIDGE_FT = 18;
export const NFA_PER_BOX_VENT = 50;

/** The pitch at or below which a roof is treated as low slope. */
export const LOW_SLOPE_RISE = 2;

/**
 * What this attic needs, and the two ways to give it to it.
 *
 * Returns null without a footprint: an unventilated answer is better than one
 * computed from a zero, which would quietly say "no vents required".
 */
export function ventilation(footprintSqft, pitchRise) {
  const floor = Number(footprintSqft);
  if (!(floor > 0)) return null;
  const lowSlope = (Number(pitchRise) || 0) <= LOW_SLOPE_RISE;
  const ratio = lowSlope ? 150 : 300;
  const nfaSqft = floor / ratio;
  // Half high, half low. The high half is what gets quoted.
  const upperSqin = (nfaSqft * 144) / 2;
  return {
    ratio,
    lowSlope,
    nfaSqft: Math.round(nfaSqft * 100) / 100,
    upperSqin: Math.round(upperSqin),
    ridgeVentFt: Math.ceil(upperSqin / NFA_PER_RIDGE_FT),
    boxVents: Math.ceil(upperSqin / NFA_PER_BOX_VENT),
  };
}
