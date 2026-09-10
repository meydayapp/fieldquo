// scripts/check-roof-prefill.mjs
//
//   npm run check:roof-prefill
//
// The roof quote measured a shed, filled two fields out of thirteen, and only
// offered to do it at all when the selected client happened to have an address
// saved.
//
// ══ The three faults ══════════════════════════════════════════════════════
//
// 1. WRONG BUILDING. The owner measured 917 Littlerock St, Ottawa and the
//    takeoff wrote in "Measured 119 sqft of roof surface across 2 facets". A
//    competitor quoting the same address returned 2,197.5 sqft. Google's
//    buildingInsights:findClosest had returned an 11 m² shed sitting 23 m from
//    the geocode pin, and nothing checked. Verified against the live API while
//    fixing it: HIGH quality 404s at that address and MEDIUM and LOW return
//    the identical fragment, so the existing LOW request was never the
//    problem — the pin was, and the house is 36 m away.
//
// 2. TWO FIELDS OUT OF THIRTEEN. Ice & water, drip edge, starter, valleys,
//    ridge & hip cap and ridge vent are a third of the price of a re-roof and
//    were left at zero, which on that screen reads as "this roof needs none of
//    them".
//
// 3. NO WAY TO TYPE AN ADDRESS. The panel rendered only when the selected
//    client had one on file, so quoting a walk-in never saw it — and the roof
//    being re-roofed is often not the address the invoice goes to.
//
// ══ Executed ══════════════════════════════════════════════════════════════
//
// Sections 1-5 run the shipped functions against roofs whose linear feet are
// known by construction — a 40×30 gable and a 40×30 hip, worked out by hand —
// so the assertions are arithmetic, not description. No network: the geometry
// is trigonometry over numbers the API already returned, and a check that
// needed Google would not run in CI.
//
// Sections 6-8 read source, and read it DECOMMENTED. Four checks in this repo
// have been fooled by their own header comments; this file talks about drip
// edge and satellite images at length and would fool itself twice over.
//
// ══ Mutation-tested ═══════════════════════════════════════════════════════
//
// Ten mutations, all caught, each restored from a `cp` backup: the hip
// eave/rake override removed; the plausibility floor dropped to 0;
// pickBuilding switched from nearest to largest; the aspect-ratio scaling
// replaced with raw box spans; internal-edge halving removed; step flashing
// guessed into takeoffPatch; the address input given back its `siteAddress &&`
// guard; the satellite capture dropped from createEstimateQuote; the
// simple_gable row put back to inventing valleys; and the widened search made
// to refuse itself for being far from the pin it already knows is wrong.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  roofLinears,
  takeoffPatch,
  summarise,
  ventilation,
  roofShape,
  facingDirections,
  facetRectangle,
  spanMetres,
  unionBox,
  metresPerDegree,
  EDGE_SPLIT,
  NFA_PER_RIDGE_FT,
  NFA_PER_BOX_VENT,
} from "@/lib/measure/roofGeometry";
import {
  pickBuilding,
  measurementWarnings,
  metresBetween,
  offsetPoint,
  MIN_PLAUSIBLE_ROOF_SQFT,
  MAX_PIN_DISTANCE_M,
  SEARCH_RING_M,
} from "@/lib/measure/roofMeasurement";
import { alreadyCaptured } from "@/lib/measure/satelliteCapture";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name}${got !== undefined ? `  — got: ${JSON.stringify(got)}` : ""}`);
  }
  return Boolean(cond);
}
const section = (t) => console.log(`\n${t}\n`);

/** Strip comments and string bodies so a check cannot match its own prose. */
function decomment(src) {
  let out = "";
  let i = 0;
  let state = "code";
  while (i < src.length) {
    const c = src[i];
    const d = src[i + 1];
    if (state === "code") {
      if (c === "/" && d === "/") { state = "line"; out += "  "; i += 2; continue; }
      if (c === "/" && d === "*") { state = "block"; out += "  "; i += 2; continue; }
      out += c; i++; continue;
    }
    if (state === "line") {
      if (c === "\n") { state = "code"; out += "\n"; i++; continue; }
      out += " "; i++; continue;
    }
    if (c === "*" && d === "/") { state = "code"; out += "  "; i += 2; continue; }
    out += c === "\n" ? "\n" : " ";
    i++;
  }
  return out;
}

// ── Fixture builder ────────────────────────────────────────────────────────
//
// Roofs whose answer is known by construction. Metres in, so a 40×30 house at
// 6/12 has hand-checkable linear feet: 140 ft around, and for the gable 80 ft
// of eave, 60 ft of rake and a 40 ft ridge.
const LAT = 45.42;
const LNG = -75.7;
const PER = metresPerDegree(LAT);
const FT = 0.3048;
const boxAt = (x, y, w, h) => ({
  sw: { latitude: LAT + y / PER.lat, longitude: LNG + x / PER.lng },
  ne: { latitude: LAT + (y + h) / PER.lat, longitude: LNG + (x + w) / PER.lng },
});
const PITCH_DEG = 26.57; // 6/12
const COS = Math.cos((PITCH_DEG * Math.PI) / 180);
const facet = (x, y, w, h, az, groundM2) => ({
  pitchDegrees: PITCH_DEG,
  azimuthDegrees: az,
  boundingBox: boxAt(x, y, w, h),
  stats: { areaMeters2: groundM2 / COS, groundAreaMeters2: groundM2 },
});
const roof = (segments, groundM2) => ({
  solarPotential: {
    wholeRoofStats: { areaMeters2: groundM2 / COS, groundAreaMeters2: groundM2 },
    roofSegmentStats: segments,
  },
});

const W = 40 * FT;
const D = 30 * FT;
const GABLE = roof([facet(0, 0, W, D / 2, 180, (W * D) / 2), facet(0, D / 2, W, D / 2, 0, (W * D) / 2)], W * D);
// A real hip: two trapezoid sides of 375 sqft, two triangle ends of 225 sqft.
const HIP = roof(
  [
    facet(0, 0, W, D / 2, 180, 375 * FT * FT),
    facet(0, D / 2, W, D / 2, 0, 375 * FT * FT),
    facet(0, 0, D / 2, D, 270, 225 * FT * FT),
    facet(W - D / 2, 0, D / 2, D, 90, 225 * FT * FT),
  ],
  W * D,
);

// ═══════════════════════════════════════════════════════════════════════════
section("1. A 40×30 gable, whose linear feet are known by construction");
// ═══════════════════════════════════════════════════════════════════════════

{
  const g = roofLinears(GABLE);
  ok("it measures", Boolean(g));
  ok("140 ft around the building", g.perimeterFt === 140, g.perimeterFt);
  ok("80 ft of eave — the two long sides", g.eaveFt === 80, g.eaveFt);
  ok("60 ft of rake — the two gable ends", g.rakeFt === 60, g.rakeFt);
  ok("a 40 ft ridge", g.ridgeFt === 40, g.ridgeFt);
  ok("no hips on a gable roof", g.hipFt === 0, g.hipFt);
  // The one that names the rule: two facets meeting on one line have nowhere
  // to put a valley, and the first version of this table invented four feet.
  ok("and no valleys — there is nowhere for one to be", g.valleyFt === 0, g.valleyFt);
  ok("read as a simple gable", g.shape === "simple_gable", g.shape);
  ok("eave + rake is the whole outline", g.eaveFt + g.rakeFt === g.perimeterFt);
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. A 40×30 hip, where the whole outline is eave");
// ═══════════════════════════════════════════════════════════════════════════

{
  const h = roofLinears(HIP);
  ok("140 ft around the building", h.perimeterFt === 140, h.perimeterFt);
  // The mutation that broke this filled 34 ft of rake a hip roof cannot have,
  // and took 34 ft of ice & water with it.
  ok("a hip roof is all eave", h.eaveFt === 140, h.eaveFt);
  ok("…and has no rake at all", h.rakeFt === 0, h.rakeFt);
  ok("no valleys on a plain hip", h.valleyFt === 0, h.valleyFt);
  ok("most of the internal length is hip, not ridge", h.hipFt > h.ridgeFt, [h.hipFt, h.ridgeFt]);
  ok("read as a simple hip", h.shape === "simple_hip", h.shape);
  // Hand-worked truth: a 10 ft ridge plus four 21.2 ft hips is 95 ft. Reading
  // triangles as rectangles runs short, so the tolerance is one-sided and
  // named rather than pretended away.
  const internal = h.ridgeFt + h.hipFt;
  ok("ridge + hip is within 20% of the hand-worked 95 ft", internal > 76 && internal <= 95, internal);
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. The split table, and the shapes that select it");
// ═══════════════════════════════════════════════════════════════════════════

{
  for (const [name, row] of Object.entries(EDGE_SPLIT)) {
    const sum = row.ridge + row.hip + row.valley;
    // A row that does not sum to 1 loses or invents linear feet silently.
    ok(`${name} sums to exactly 1`, Math.abs(sum - 1) < 1e-9, sum);
    ok(`${name} has no negative share`, row.ridge >= 0 && row.hip >= 0 && row.valley >= 0);
  }
  ok("only a single roof mass may have zero valleys", EDGE_SPLIT.simple_gable.valley === 0 && EDGE_SPLIT.simple_hip.valley === 0);
  ok("…and every other row has some", EDGE_SPLIT.gable.valley > 0 && EDGE_SPLIT.hip.valley > 0 && EDGE_SPLIT.complex.valley > 0);

  const d2 = [{ degrees: 0 }, { degrees: 180 }];
  const d4 = [{ degrees: 0 }, { degrees: 90 }, { degrees: 180 }, { degrees: 270 }];
  ok("2 facets, 2 directions → simple gable", roofShape(d2, 2) === "simple_gable");
  ok("6 facets, 2 directions → gable with dormers", roofShape(d2, 6) === "gable");
  ok("4 facets, 4 directions → simple hip", roofShape(d4, 4) === "simple_hip");
  ok("9 facets, 4 directions → hip with an ell", roofShape(d4, 9) === "hip");
  ok("more than four directions → intersecting", roofShape([...d4, { degrees: 45 }], 9) === "complex");
  ok("one direction is a shed, handled by the gable row", roofShape([{ degrees: 180 }], 1) === "simple_gable");
  ok("no directions at all still names a shape", typeof roofShape([], 0) === "string");
  ok("every shape roofShape can name has a split row", [d2, d4, [...d4, { degrees: 45 }]].every((d) => [0, 2, 4, 9].every((n) => EDGE_SPLIT[roofShape(d, n)])));

  // Slivers must not turn a gable into an intersecting roof — that is the
  // difference between no valleys and 35% of the internal length in valleys.
  const withSliver = roofLinears(
    roof([...GABLE.solarPotential.roofSegmentStats, facet(0, 0, 1, 1, 45, 0.5)], W * D),
  );
  ok("a 0.5 m² sliver does not become a fifth direction", withSliver.directions.length === 2, withSliver.directions.length);
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. Hostile input returns nothing, never a plausible zero");
// ═══════════════════════════════════════════════════════════════════════════

{
  // A roof reporting 0 ft of drip edge at $3.00/ft is a confident wrong number
  // on a priced line. Null is the only safe answer.
  for (const [name, input] of [
    ["null", null],
    ["undefined", undefined],
    ["a string", "roof"],
    ["an empty object", {}],
    ["no solarPotential", { foo: 1 }],
    ["no segments", { solarPotential: {} }],
    ["an empty segment list", { solarPotential: { roofSegmentStats: [] } }],
    ["segments with no boxes", roof([{ azimuthDegrees: 0, stats: { groundAreaMeters2: 50 } }], 50)],
    ["a zero-area segment", roof([facet(0, 0, W, D, 180, 0)], 0)],
    ["a NaN area", roof([facet(0, 0, W, D, 180, Number.NaN)], Number.NaN)],
    ["a degenerate box", roof([{ azimuthDegrees: 0, boundingBox: boxAt(0, 0, 0, 0), stats: { groundAreaMeters2: 50 } }], 50)],
  ]) {
    ok(`${name} → null`, roofLinears(input) === null, roofLinears(input));
  }
  ok("takeoffPatch(null) is null", takeoffPatch(null) === null);
  ok("summarise(null) is null", summarise(null) === null);
  ok("spanMetres(null) is null", spanMetres(null) === null);
  ok("spanMetres of a zero box is null", spanMetres(boxAt(0, 0, 0, 0)) === null);
  ok("unionBox([]) is null", unionBox([]) === null);
  ok("unionBox(null) is null", unionBox(null) === null);
  ok("facetRectangle with no span is null", facetRectangle({ span: null, areaM2: 10, azimuthDegrees: 0 }) === null);
  ok("facetRectangle with no area is null", facetRectangle({ span: { east: 5, north: 5 }, areaM2: 0, azimuthDegrees: 0 }) === null);
  ok("facingDirections(null) is []", facingDirections(null).length === 0);

  // Every number that reaches a priced field must be finite and non-negative.
  const g = roofLinears(GABLE);
  const patch = takeoffPatch(g);
  ok(
    "every patched quantity is a finite, non-negative number",
    Object.values(patch).every((v) => Number.isFinite(v) && v >= 0),
    patch,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. What the patch fills, and the one field it refuses to");
// ═══════════════════════════════════════════════════════════════════════════

{
  const g = roofLinears(GABLE);
  const p = takeoffPatch(g);
  ok("drip edge runs the whole outline", p.dripEdgeFt === g.perimeterFt, p.dripEdgeFt);
  ok("starter runs the whole outline too", p.starterFt === g.perimeterFt, p.starterFt);
  ok("ice & water covers the eaves and the valleys", p.iceWaterFt === g.eaveFt + g.valleyFt, p.iceWaterFt);
  ok("ridge & hip cap caps both", p.ridgeHipFt === g.ridgeFt + g.hipFt, p.ridgeHipFt);
  ok("ridge vent runs the ridge only — hips are not vented", p.ridgeVentFt === g.ridgeFt, p.ridgeVentFt);
  // The refusal is the point. Step flashing is roof meeting WALL, and a roof
  // model has no walls in it; filling it would put a priced line on the quote
  // for something nobody looked at.
  ok("step flashing is NOT guessed", !("stepFlashingFt" in p), Object.keys(p));
  ok("nor are the penetrations", !["ventBoots", "boxVents", "skylights", "chimneys"].some((k) => k in p));
  ok("nor layers, sheathing or storeys", !["layers", "deckSheets", "storeys"].some((k) => k in p));

  const s = summarise(g);
  ok("the summary says what it could not know", s.cannotKnow.length >= 4, s.cannotKnow.length);
  ok("…naming step flashing among them", s.cannotKnow.some((l) => /step flashing/i.test(l)));
  ok("…and the skylights and chimneys", s.cannotKnow.some((l) => /skylight/i.test(l)));
  ok("…and the layers nobody can see from above", s.cannotKnow.some((l) => /layer/i.test(l)));
  ok("the headline reads as English", /^\d+ facets facing \d+ ways? — read as an? \w+ roof\.$/.test(s.headline), s.headline);
  ok("…with the right article", !/ a intersecting /.test(s.headline) && !/ a intersecting /.test(s.derived[0]));
  ok("the derived line admits it is a convention", /usually splits it/.test(s.derived[0]));

  // Ventilation is calculated from code, not measured — and the arithmetic has
  // to be the arithmetic a roofer would do.
  const v = ventilation(1500, 6);
  ok("1500 sqft at 6/12 uses the 1:300 rule", v.ratio === 300, v.ratio);
  ok("…which is 5 sq ft of net free area", v.nfaSqft === 5, v.nfaSqft);
  ok("…half of it high, in square inches", v.upperSqin === 360, v.upperSqin);
  ok("…delivered by 20 ft of ridge vent", v.ridgeVentFt === Math.ceil(360 / NFA_PER_RIDGE_FT), v.ridgeVentFt);
  ok("…or by 8 box vents", v.boxVents === Math.ceil(360 / NFA_PER_BOX_VENT), v.boxVents);
  ok("low slope doubles the requirement", ventilation(1500, 1).ratio === 150);
  ok("no footprint means no answer, not zero vents", ventilation(0, 6) === null);
  ok("a negative footprint too", ventilation(-100, 6) === null);
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. 917 Littlerock St: the shed, and the house 36 m away");
// ═══════════════════════════════════════════════════════════════════════════

{
  // The three buildings the live API actually returns around that pin,
  // recorded here so the selection rule is testable without a network.
  const SHED = { areaSqft: 119, distanceM: 22.8 };
  const HOUSE = { areaSqft: 2163, distanceM: 36.3 };
  const NEIGHBOUR = { areaSqft: 1721, distanceM: 49.5 };

  const won = pickBuilding([SHED, HOUSE, NEIGHBOUR]);
  ok("the house wins, not the shed", won?.areaSqft === 2163, won?.areaSqft);
  // Both halves of the rule earn their place: nearest alone picks the shed,
  // largest alone picks a neighbour's bigger house.
  ok("nearest alone would have picked the shed", SHED.distanceM < HOUSE.distanceM);
  ok("largest alone would be wrong on a bigger neighbour", pickBuilding([HOUSE, { areaSqft: 3292, distanceM: 54 }])?.areaSqft === 2163);
  ok("order does not change the answer", pickBuilding([NEIGHBOUR, HOUSE, SHED])?.areaSqft === 2163);
  ok("nothing plausible → null, not the least-bad", pickBuilding([SHED, { areaSqft: 200, distanceM: 5 }]) === null);
  ok("an empty list → null", pickBuilding([]) === null);
  ok("no list at all → null", pickBuilding() === null);
  ok("a candidate with no distance is ignored", pickBuilding([{ areaSqft: 5000, distanceM: null }]) === null);

  ok("the plausibility floor is above a shed and below a bungalow", MIN_PLAUSIBLE_ROOF_SQFT > 119 && MIN_PLAUSIBLE_ROOF_SQFT < 900, MIN_PLAUSIBLE_ROOF_SQFT);
  ok("the ring is wide enough to have reached that house", SEARCH_RING_M >= 15, SEARCH_RING_M);

  // The warning that would have stopped "Measured 119 sqft" reading as an answer.
  const bad = measurementWarnings({ areaSqft: 119, pinDistanceM: 22.8, segmentCount: 2, precise: true });
  ok("119 sqft is not trustworthy", bad.trustworthy === false);
  ok("…and says it is a shed, not a house", bad.warnings.some((w) => w.code === "too_small" && /shed or a garage/.test(w.text)));
  const far = measurementWarnings({ areaSqft: 2000, pinDistanceM: 90, segmentCount: 8, precise: true });
  ok("a roof 90 m from the address is not trustworthy", far.trustworthy === false);
  ok("…naming the distance", far.warnings.some((w) => w.code === "far_from_pin"));
  const good = measurementWarnings({ areaSqft: 2163, pinDistanceM: 4, segmentCount: 6, precise: true, imageryDate: { year: new Date().getFullYear() } });
  ok("a real house measured on its own pin is trustworthy", good.trustworthy === true, good.warnings);
  ok("…with nothing to warn about", good.warnings.length === 0, good.warnings);
  // Stale imagery is worth saying and is not a reason to refuse a number.
  const stale = measurementWarnings({ areaSqft: 2163, pinDistanceM: 4, segmentCount: 6, precise: true, imageryDate: { year: 2018 } });
  ok("2018 imagery is mentioned", stale.warnings.some((w) => w.code === "stale_imagery"));
  ok("…but does not make the measurement untrustworthy", stale.trustworthy === true);
  const loose = measurementWarnings({ areaSqft: 2163, pinDistanceM: 4, segmentCount: 6, precise: false });
  ok("a street-level geocode is mentioned", loose.warnings.some((w) => w.code === "imprecise_geocode"));
  ok("…and is not on its own a refusal", loose.trustworthy === true);
  ok("MAX_PIN_DISTANCE_M keeps a large house's own centroid", MAX_PIN_DISTANCE_M >= 20 && MAX_PIN_DISTANCE_M <= 50, MAX_PIN_DISTANCE_M);

  // The geometry helpers the search is built on.
  ok("metresBetween(null) is null", metresBetween(null, {}) === null);
  ok("a point 20 m north is 20 m away", Math.abs(metresBetween({ lat: LAT, lng: LNG }, offsetPoint(LAT, LNG, 20, 0)) - 20) < 0.5);
  ok("…and 20 m east is too", Math.abs(metresBetween({ lat: LAT, lng: LNG }, offsetPoint(LAT, LNG, 20, 90)) - 20) < 0.5);
  ok("a point is zero metres from itself", metresBetween({ lat: LAT, lng: LNG }, { lat: LAT, lng: LNG }) === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. The widened search only runs when the first answer is bad");
// ═══════════════════════════════════════════════════════════════════════════
//
// Eight extra Solar requests on every measurement would be a real cost. The
// guarantee is that an address whose pin lands on a real roof costs exactly one
// request, as it always did.

{
  const src = decomment(read("lib/measure/roofMeasurement.js"));
  const body = src.slice(src.indexOf("async function findBuildingFor"), src.indexOf("export async function measureRoof"));
  ok("the search function was found", body.length > 400, body.length);
  ok("it asks the pin first", body.indexOf("await at(geo.lat, geo.lng)") > -1);
  ok(
    "…and returns immediately when that is plausible",
    /if \(first && first\.areaSqft >= MIN_PLAUSIBLE_ROOF_SQFT\)[\s\S]{0,200}return/.test(body),
  );
  ok("…before the ring is ever built", body.indexOf("SEARCH_BEARINGS.map") > body.indexOf("MIN_PLAUSIBLE_ROOF_SQFT"));
  // Eight sequential fetches is eight round trips an estimator waits through.
  ok("the ring goes out in parallel", /Promise\.all\(\s*SEARCH_BEARINGS\.map/.test(body));
  ok("candidates are de-duplicated on the model's own centre", /center\?\.latitude/.test(body));
  ok("the winner comes from pickBuilding", /pickBuilding\(candidates\)/.test(body));
  ok("a widened search is reported to the caller", /widened: true/.test(body));

  const measure = src.slice(src.indexOf("export async function measureRoof"));
  ok("measureRoof uses the search, not a bare findClosest", /findBuildingFor\(geo, key\)/.test(measure));
  ok(
    "…and does not then refuse the result for being far from a pin it knows is wrong",
    /pinDistanceM: found\.widened \? null : pinDistanceM/.test(measure),
    measure.slice(0, 200),
  );
  ok("the result carries the warnings", /measurementWarnings\(\{/.test(measure));
  ok("…and the linear feet", /linear: roofLinears\(insights\)/.test(src));
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. The panel, and the satellite still that is actually saved");
// ═══════════════════════════════════════════════════════════════════════════

{
  const t = decomment(read("app/components/quotes/builder/TradeTakeoff.js"));
  const panel = t.slice(t.indexOf("function RoofMeasurePanel"), t.indexOf("function RoofingTakeoff"));
  ok("the panel exists", panel.length > 1000, panel.length);
  // Fault 3: it used to render only when the client had an address on file.
  ok("there is an address input", /<input[\s\S]{0,200}value=\{address\}/.test(panel));
  ok("…typed into by the estimator", /onChange=\{\(e\) => setAddress\(e\.target\.value\)\}/.test(panel));
  ok("…seeded from the client's address, not gated on it", /useState\(defaultAddress\)/.test(panel));
  ok("the takeoff renders the panel unconditionally", /<RoofMeasurePanel/.test(t));
  ok(
    "…with no siteAddress guard in front of it",
    !/\{siteAddress && \(\s*<RoofMeasurePanel/.test(t),
  );
  ok("Enter measures, because that is what Enter does in an address field", /e\.key === "Enter"/.test(panel));

  // Fault 1, on the screen: an implausible reading must not be written in.
  ok("an untrustworthy result is not applied", /if \(data\.trustworthy !== false\) apply\(data\)/.test(panel));
  ok("…but is still offered, with the image, to the person who can judge", /Use it anyway/.test(panel));
  ok("the warnings are rendered", /result\.warnings \|\| \[\]/.test(panel));
  ok("a widened search says so", /result\.searchWidened/.test(panel));

  // Fault 2: all six derivable fields, and an undo.
  ok("the patch is applied", /takeoffPatch\(data\.linear\)/.test(panel));
  ok("…alongside area and pitch", /areaSqft: Math\.round\(num\(data\.areaSqft\)\)/.test(panel) && /pitchRise: num\(data\.predominantPitch\?\.rise\)/.test(panel));
  ok("every changed field is listed", /changed\.map/.test(panel));
  ok("…with what it was before", /before\[k\]/.test(panel));
  ok("and there is an Undo", /onApply\(before\)/.test(panel));
  ok("the ventilation calculation is offered", /ventilation\(result\.footprintSqft/.test(panel));
  ok("…as a choice between ridge vent and box vents", /ridgeVentFt: vent\.ridgeVentFt/.test(panel) && /boxVents: vent\.boxVents/.test(panel));
  ok("what it cannot know is shown, not hidden", /report\.cannotKnow\.map/.test(panel));

  // The satellite still.
  const cap = decomment(read("lib/measure/satelliteCapture.js"));
  ok("the capture uploads bytes, not a link", /uploadBuffer\(buffer/.test(cap));
  ok("…refusing anything that is not an image", /type\.startsWith\("image\/"\)/.test(cap));
  ok("…and anything oversized", /buffer\.length > MAX_BYTES/.test(cap));
  ok("it never re-uploads one already ours", /alreadyCaptured\(source\)/.test(cap));
  ok("the original Google URL is kept for provenance", /satelliteSourceUrl: source/.test(cap));
  ok("every failure returns null rather than throwing", /catch \{\s*return null;/.test(cap));
  ok("alreadyCaptured recognises a Cloudinary URL", alreadyCaptured("https://res.cloudinary.com/x/image/upload/y.png") === true);
  ok("…and does not recognise a Google one", alreadyCaptured("https://maps.googleapis.com/maps/api/staticmap?x=1") === false);
  ok("…nor a null", alreadyCaptured(null) === false);

  const q = decomment(read("lib/estimate/createEstimateQuote.js"));
  ok("quote creation captures the still", /withCapturedSatellite\(measurement/.test(q));
  ok("…and stores the captured one in estimateData", /measurement: measurementSaved/.test(q));
  ok(
    "…before the costing reads it",
    q.indexOf("measurementSaved") < q.indexOf("costingInputsForInstantTrade("),
    [q.indexOf("measurementSaved"), q.indexOf("costingInputsForInstantTrade(")],
  );
  ok("…and the costing is handed the captured one", /costingInputsForInstantTrade\(\s*trade,\s*materialKey,\s*measurementSaved,/.test(q));
  // clientPhotos is what the HOMEOWNER sent; completeness.js counts it.
  ok(
    "the aerial is NOT counted as a photo the homeowner sent",
    !/clientPhotos: \[[\s\S]{0,80}satellite/i.test(q) && !/clientMedia\.push/.test(q),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("9. The check is wired in");
// ═══════════════════════════════════════════════════════════════════════════

{
  const pkg = JSON.parse(read("package.json"));
  ok("check:roof-prefill is a script", typeof pkg.scripts?.["check:roof-prefill"] === "string");
  ok("…and check:all runs it", (pkg.scripts?.["check:all"] || "").includes("check:roof-prefill"));
}

console.log(`\n${pass} checks, ${failures.length} failure(s).`);
if (failures.length) {
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
