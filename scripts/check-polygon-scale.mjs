// scripts/check-polygon-scale.mjs
//
//   npm run check:polygon-scale
//
// The paver designer asked the estimator to draw a reference line along a
// garage door and type its length before a traced patio could be measured —
// on a Google satellite still whose ground resolution was already known to
// the route that served it (metres per pixel = 156543.03 · cos(lat) / 2^zoom
// / scale). The scale existed; it was on the server side of the bundle. Now
// lib/measure/imageScale.js holds the maths with no server imports, the
// canvas (PolygonMeasure.js) measures automatically and keeps the manual
// line for uploaded photos, and the landscaping trades get the same canvas
// writing Lot Size and Edging.
//
// ══ Executed ══════════════════════════════════════════════════════════════
//
// Sections 1–4 run the shipped functions against shapes whose answer is
// known by construction: a 10 m square at a known latitude and zoom, drawn
// in the pixels that latitude and zoom imply, must come back as 100 m² =
// 1076.4 sq ft and 40 m around, within 1 %. No network, no React: the
// geometry is arithmetic over numbers the route already returns.
//
// Section 5 executes lotTakeoff.js against the real intake field
// definitions, so "Trace the area" can never be offered above a form that
// has no box for its answer.
//
// Sections 6–7 read source, DECOMMENTED, for the wiring a pure function
// cannot prove: that the scale object actually reaches the designer, that
// PaverDesigner no longer carries its own copy of the canvas, and that the
// landscaping canvas is rendered for the trades lotTakeoff lists.
//
// ══ Mutation-tested ═══════════════════════════════════════════════════════
//
// Each restored from a `cp` backup: the cos(lat) term dropped from
// metresPerPixel (area 2× at 45°); the `/ scale` dropped (area 4×); the
// slice fit swapped for meet in canvasFeetPerUnit (canvas area off by the
// aspect ratio); the decoded-size aspect correction removed (a square guess
// at a 1280×800 tile kept); parseStaticMapUrl defaulting scale to 2 for a
// Google URL with none; lotIntakePatch writing edgingFt regardless of the
// field list; `imageScale` dropped from the TradeTakeoff → PaverDesigner
// hand-off; two-point "polygons" accepted; the Mercator latitude bound
// dropped. All caught.
//
// One mutation SURVIVED on the first run and rewrote the code: "ignore the
// decoded size" passed, because the test it was meant to fail asserted a
// uniform half-size copy measures the same — which it does with or without
// the correction, since the decoded width cancels out of the viewBox
// mapping. The correction that was there was a resize correction that did
// nothing; the one that matters is an aspect correction for a guessed size,
// and that is what the function does now and what section 3 asserts.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  METRES_PER_PIXEL_AT_ZOOM_0,
  MAX_MERCATOR_LAT,
  MIN_ZOOM,
  metresPerPixel,
  feetPerPixel,
  measurePolygonPixels,
  measureShape,
  canvasFeetPerUnit,
  parseStaticMapUrl,
  imageScaleFromUrl,
  imageScale,
  referenceFeetPerPixel,
  resolveScale,
} from "@/lib/measure/imageScale";
import {
  metresPerPixel as viaSatellite,
  imageScale as imageScaleViaSatellite,
} from "@/lib/measure/satellite";
import {
  LOT_MEASURE_TRADES,
  LOT_AREA_FIELD,
  LOT_EDGE_FIELD,
  SITE_IMAGE_TRADES,
  lotIntakePatch,
  wantsSiteImage,
} from "@/lib/measure/lotTakeoff";
import { INTAKE_FIELDS } from "@/app/data/quoteIntakeFields";

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
const within = (got, want, pct) => Math.abs(got - want) <= Math.abs(want) * pct;

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

// ── Fixture ────────────────────────────────────────────────────────────────
//
// Ottawa, zoom 20, scale 2 — the product's default request. The pixel side
// of a 10 m square is derived from the formula's own inputs, so the assertion
// is on the round trip: pixels → metres → area, against 100 m² by definition.
const LAT = 45.42;
const ZOOM = 20;
const SCALE = 2;
const SIDE_M = 10;
const SQFT_PER_M2 = 1 / (0.3048 * 0.3048);

const squarePx = (sidePx, x0 = 100, y0 = 100) => [
  { x: x0, y: y0 },
  { x: x0 + sidePx, y: y0 },
  { x: x0 + sidePx, y: y0 + sidePx },
  { x: x0, y: y0 + sidePx },
];

// ── 1. Metres per pixel, from first principles ─────────────────────────────
section("1. metresPerPixel: the Web Mercator formula, term by term");
{
  const expected = (METRES_PER_PIXEL_AT_ZOOM_0 * Math.cos((LAT * Math.PI) / 180)) / 2 ** ZOOM / SCALE;
  const got = metresPerPixel(LAT, ZOOM, SCALE);
  ok("zoom-0 constant is 40075016.69 m / 256 px", within(METRES_PER_PIXEL_AT_ZOOM_0, 156543.03392, 1e-9), METRES_PER_PIXEL_AT_ZOOM_0);
  ok("45.42°N, zoom 20, scale 2 → 0.0524 m/px", got !== null && within(got, expected, 1e-12) && within(got, 0.05239, 0.001), got);
  ok("the cos(lat) term is present: equator is 1/cos(45.42°) wider", within(metresPerPixel(0, ZOOM, SCALE) / got, 1 / Math.cos((LAT * Math.PI) / 180), 1e-9));
  ok("scale 2 halves the pixel (same ground, twice the pixels)", within(metresPerPixel(LAT, ZOOM, 1) / got, 2, 1e-9));
  ok("each zoom level halves the pixel", within(metresPerPixel(LAT, ZOOM - 1, SCALE) / got, 2, 1e-9));
  ok("scale missing defaults to 1 (Google's default, not ours)", metresPerPixel(LAT, ZOOM) === metresPerPixel(LAT, ZOOM, 1));
  ok("scale null also reads as 1", metresPerPixel(LAT, ZOOM, null) === metresPerPixel(LAT, ZOOM, 1));
  ok("strings from a query string are accepted", metresPerPixel("45.42", "20", "2") === got);
  ok("feetPerPixel is metres × 3.2808", within(feetPerPixel(LAT, ZOOM, SCALE), got / 0.3048, 1e-12));

  // Hostile input: null, never NaN, never Infinity.
  ok("zoom 0 → null (a whole-world tile is not a measuring instrument)", metresPerPixel(LAT, 0, SCALE) === null);
  ok(`zoom ${MIN_ZOOM - 1} → null`, metresPerPixel(LAT, MIN_ZOOM - 1, SCALE) === null);
  ok("zoom 22 → null (no imagery there)", metresPerPixel(LAT, 22, SCALE) === null);
  ok("zoom 20.5 → null (Static Maps would round it; we don't guess which way)", metresPerPixel(LAT, 20.5, SCALE) === null);
  ok(`lat 89.9 → null (past ±${MAX_MERCATOR_LAT}° there is no tile)`, metresPerPixel(89.9, ZOOM, SCALE) === null);
  ok("lat -89.9 → null", metresPerPixel(-89.9, ZOOM, SCALE) === null);
  ok("lat NaN → null", metresPerPixel(NaN, ZOOM, SCALE) === null);
  ok("lat undefined → null (NOT the Gulf of Guinea)", metresPerPixel(undefined, ZOOM, SCALE) === null);
  ok("lat '' → null", metresPerPixel("", ZOOM, SCALE) === null);
  ok("scale 3 → null (Google serves 1 and 2)", metresPerPixel(LAT, ZOOM, 3) === null);
  ok("scale 'x' → null", metresPerPixel(LAT, ZOOM, "x") === null);
  ok("lat 85.05 (the edge) still measures", metresPerPixel(85.05, ZOOM, SCALE) !== null);
  ok("satellite.js re-exports the SAME function", viaSatellite === metresPerPixel);
}

// ── 2. A 10 m square, in pixels, comes back as 100 m² ──────────────────────
section("2. measurePolygonPixels: a known square round-trips within 1 %");
{
  const mpp = metresPerPixel(LAT, ZOOM, SCALE);
  const sidePx = SIDE_M / mpp; // ≈ 190.9 px at 45.42°N zoom 20 scale 2
  const m = measurePolygonPixels(squarePx(sidePx), mpp);
  ok("measures", m.ok === true && m.reason === null, m);
  ok(`area ≈ 100 m² (got ${m.areaM2.toFixed(3)})`, within(m.areaM2, 100, 0.01), m.areaM2);
  ok(`area ≈ 1076.4 sq ft (got ${m.areaSqFt.toFixed(2)})`, within(m.areaSqFt, 100 * SQFT_PER_M2, 0.01), m.areaSqFt);
  ok(`perimeter ≈ 40 m (got ${m.perimeterM.toFixed(3)})`, within(m.perimeterM, 40, 0.01), m.perimeterM);
  ok(`perimeter ≈ 131.23 ft (got ${m.perimeterFt.toFixed(2)})`, within(m.perimeterFt, 40 / 0.3048, 0.01), m.perimeterFt);
  ok("four points reported", m.points === 4);

  // Same square, drawn anticlockwise and elsewhere on the image: same answer.
  const rev = measurePolygonPixels([...squarePx(sidePx, 900, 500)].reverse(), mpp);
  ok("anticlockwise, elsewhere: same area", within(rev.areaM2, m.areaM2, 1e-9));

  // A 30×20 m rectangle: 600 m², 100 m around.
  const w = 30 / mpp;
  const h = 20 / mpp;
  const rect = measurePolygonPixels([{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }], mpp);
  ok("30×20 m rectangle → 600 m²", within(rect.areaM2, 600, 0.01), rect.areaM2);
  ok("…and 100 m around", within(rect.perimeterM, 100, 0.01), rect.perimeterM);

  // An L-shape (a 10 m square with a 5 m square bite): 75 m², still 40 m around.
  const s = 10 / mpp;
  const half = s / 2;
  const L = measurePolygonPixels(
    [{ x: 0, y: 0 }, { x: s, y: 0 }, { x: s, y: half }, { x: half, y: half }, { x: half, y: s }, { x: 0, y: s }],
    mpp,
  );
  ok("L-shape → 75 m²", within(L.areaM2, 75, 0.01), L.areaM2);
  ok("L-shape perimeter is still 40 m", within(L.perimeterM, 40, 0.01), L.perimeterM);

  // Hostile input.
  const few = measurePolygonPixels(squarePx(sidePx).slice(0, 2), mpp);
  ok("two points → too_few, zero area, no throw", few.ok === false && few.reason === "too_few" && few.areaSqFt === 0, few);
  const nan = measurePolygonPixels([{ x: NaN, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], mpp);
  ok("a NaN vertex is dropped and the rest is too few", nan.ok === false && nan.reason === "too_few" && nan.points === 2, nan);
  const nanButEnough = measurePolygonPixels([{ x: NaN, y: 0 }, ...squarePx(sidePx)], mpp);
  ok("a NaN vertex among enough good ones is dropped, not propagated", nanButEnough.ok && within(nanButEnough.areaM2, 100, 0.01), nanButEnough.areaM2);
  ok("null scale → no_scale", measurePolygonPixels(squarePx(sidePx), null).reason === "no_scale");
  ok("zero scale → no_scale (never a 0 m² patio)", measurePolygonPixels(squarePx(sidePx), 0).reason === "no_scale");
  ok("NaN scale → no_scale", measurePolygonPixels(squarePx(sidePx), NaN).reason === "no_scale");
  ok("Infinity scale → no_scale", measurePolygonPixels(squarePx(sidePx), Infinity).reason === "no_scale");
  ok("not an array → too_few, no throw", measurePolygonPixels("abc", mpp).reason === "too_few");
  ok("strings for coordinates are accepted", measurePolygonPixels(squarePx(sidePx).map((p) => ({ x: String(p.x), y: String(p.y) })), mpp).ok);

  // measureShape is the same function in feet.
  const fpp = feetPerPixel(LAT, ZOOM, SCALE);
  const viaFeet = measureShape(squarePx(sidePx), fpp);
  ok("measureShape (feet per unit) agrees with measurePolygonPixels (metres)", within(viaFeet.areaSqFt, m.areaSqFt, 1e-9));
  ok("measureShape null scale → no_scale", measureShape(squarePx(sidePx), null).reason === "no_scale");
}

// ── 3. From image pixels to canvas units ───────────────────────────────────
section("3. canvasFeetPerUnit: the viewBox mapping under slice and meet");
{
  const VIEW_W = 1000;
  const VIEW_H = 640;
  const info = imageScale({ lat: LAT, lng: -75.7, zoom: ZOOM, scale: SCALE, width: 640, height: 640 });
  ok("imageScale reports 1280×1280 pixels for 640 @ scale 2", info.pixelWidth === 1280 && info.pixelHeight === 1280, info);
  ok("satellite.js re-exports the SAME imageScale", imageScaleViaSatellite === imageScale);

  // Under slice, a 1280×1280 image in a 1000×640 box is scaled by max(1000/1280,
  // 640/1280) = 0.78125 units per pixel and cropped top and bottom. So a foot
  // of ground is 0.78125 × (1 / fpp) canvas units.
  const base = { feetPerPixel: info.feetPerPixel, pixelWidth: 1280, pixelHeight: 1280, viewWidth: VIEW_W, viewHeight: VIEW_H };
  const slice = canvasFeetPerUnit({ ...base, fit: "slice" });
  ok("slice: feet per canvas unit = fpp / 0.78125", within(slice, info.feetPerPixel / 0.78125, 1e-12), slice);
  const meet = canvasFeetPerUnit({ ...base, fit: "meet" });
  ok("meet: feet per canvas unit = fpp / 0.5", within(meet, info.feetPerPixel / 0.5, 1e-12), meet);
  ok("fit defaults to slice (what the canvas has always painted)", canvasFeetPerUnit(base) === slice);

  // The 10 m square, traced in CANVAS units on that image, still comes back
  // as 100 m² — the whole point of the mapping.
  const sideCanvas = (SIDE_M / 0.3048) / slice;
  const traced = measureShape(squarePx(sideCanvas), slice);
  ok("a 10 m square traced in canvas units → 1076.4 sq ft within 1 %", within(traced.areaSqFt, 100 * SQFT_PER_M2, 0.01), traced.areaSqFt);

  const nonSquare = canvasFeetPerUnit({ feetPerPixel: info.feetPerPixel, pixelWidth: 1280, pixelHeight: 800, viewWidth: VIEW_W, viewHeight: VIEW_H });
  // 1280×800 → max(1000/1280, 640/800) = max(0.78125, 0.8) = 0.8
  ok("a 1280×800 image under slice is scaled by the larger ratio (0.8)", within(nonSquare, info.feetPerPixel / 0.8, 1e-12), nonSquare);

  // The decoded size is an ASPECT correction, not a resize correction. A
  // uniform half-size copy changes nothing (the decoded width cancels out of
  // the mapping — see canvasFeetPerUnit); a square GUESS at the size of a
  // 1280×800 tile, from a URL that carried no size, is 2.4 % wrong in every
  // length until the real pixels say otherwise.
  const resized = canvasFeetPerUnit({ ...base, naturalWidth: 640, naturalHeight: 640 });
  ok("a half-size copy of the image measures the same ground", within(resized, slice, 1e-12), { resized, slice });
  const same = canvasFeetPerUnit({ ...base, naturalWidth: 1280, naturalHeight: 1280 });
  ok("natural size equal to declared changes nothing", within(same, slice, 1e-12));
  const guessed = canvasFeetPerUnit({ ...base, naturalWidth: 1280, naturalHeight: 800 });
  ok("a square guess corrected by decoded 1280×800 pixels → the 0.8 answer, not 0.78125", within(guessed, nonSquare, 1e-12) && !within(guessed, slice, 1e-6), { guessed, nonSquare, slice });
  const offByOne = canvasFeetPerUnit({ ...base, naturalWidth: 1280, naturalHeight: 1279 });
  ok("a one-pixel rounding difference is not treated as a different aspect", within(offByOne, slice, 1e-12));

  // Hostile input.
  ok("no feetPerPixel → null", canvasFeetPerUnit({ ...base, feetPerPixel: undefined }) === null);
  ok("zero feetPerPixel → null", canvasFeetPerUnit({ ...base, feetPerPixel: 0 }) === null);
  ok("NaN feetPerPixel → null", canvasFeetPerUnit({ ...base, feetPerPixel: NaN }) === null);
  ok("zero pixel size → null", canvasFeetPerUnit({ ...base, pixelWidth: 0 }) === null);
  ok("zero view size → null", canvasFeetPerUnit({ ...base, viewHeight: 0 }) === null);
  ok("natural size 0 falls back to declared, not to Infinity", canvasFeetPerUnit({ ...base, naturalWidth: 0, naturalHeight: 0 }) === slice);
  ok("empty input → null, no throw", canvasFeetPerUnit() === null);
}

// ── 4. Parameters read back off a URL, and which scale wins ───────────────
section("4. parseStaticMapUrl / imageScaleFromUrl / resolveScale");
{
  const proxy = "/api/measure/satellite?format=png&lat=45.42&lng=-75.7&zoom=20&scale=2&width=640&height=640";
  const p = parseStaticMapUrl(proxy);
  ok("proxy path parses", p && p.lat === 45.42 && p.lng === -75.7 && p.zoom === 20 && p.scale === 2 && p.width === 640 && p.height === 640, p);
  const fromProxy = imageScaleFromUrl(proxy);
  ok("…to the same scale the route computed", fromProxy && within(fromProxy.feetPerPixel, feetPerPixel(LAT, ZOOM, SCALE), 1e-12) && fromProxy.pixelWidth === 1280, fromProxy);

  const google = "https://maps.googleapis.com/maps/api/staticmap?center=45.42,-75.7&zoom=20&size=640x400&scale=2&maptype=satellite&key=abc";
  const g = parseStaticMapUrl(google);
  ok("Google URL parses center=lat,lng and size=WxH", g && g.lat === 45.42 && g.lng === -75.7 && g.zoom === 20 && g.scale === 2 && g.width === 640 && g.height === 400, g);
  ok("…640x400 @ scale 2 is 1280×800 pixels", imageScaleFromUrl(google).pixelWidth === 1280 && imageScaleFromUrl(google).pixelHeight === 800);

  const noScale = "https://maps.googleapis.com/maps/api/staticmap?center=45.42,-75.7&zoom=20&size=640x640";
  ok("a Google URL with no scale is scale 1 (Google's default), not 2 (ours)", parseStaticMapUrl(noScale).scale === 1 && imageScaleFromUrl(noScale).pixelWidth === 640);
  ok("…and its pixel is twice as wide as the scale-2 one", within(imageScaleFromUrl(noScale).feetPerPixel / imageScaleFromUrl(google).feetPerPixel, 2, 1e-9));

  ok("a URL with no zoom → null (never a confident zoom-20 guess)", imageScaleFromUrl("/api/measure/satellite?lat=45.42&lng=-75.7") === null);
  ok("a Cloudinary URL (no parameters) → null", imageScaleFromUrl("https://res.cloudinary.com/x/image/upload/v1/fieldquo/satellite/c1/abc.png") === null);
  ok("an uploaded site photo → null", imageScaleFromUrl("https://res.cloudinary.com/x/image/upload/site-photo.jpg") === null);
  ok("empty string → null", imageScaleFromUrl("") === null);
  ok("null → null", imageScaleFromUrl(null) === null);
  ok("garbage → null, no throw", imageScaleFromUrl("not a url ::: ?center=x,y") === null);
  ok("lat 89.9 in a URL → null", imageScaleFromUrl("/api/measure/satellite?lat=89.9&lng=0&zoom=20&scale=2") === null);
  ok("zoom 0 in a URL → clamped to the band, not refused (the route clamps too)", imageScaleFromUrl("/api/measure/satellite?lat=45.42&lng=-75.7&zoom=0&scale=2")?.zoom === MIN_ZOOM);

  // Which scale wins.
  const auto = 0.22;
  ok("no line, auto present → auto", resolveScale({ reference: null, autoFeetPerUnit: auto }).source === "auto");
  const line = { a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, lengthFt: 20 };
  const r = resolveScale({ reference: line, autoFeetPerUnit: auto });
  ok("a line with a length beats auto (drawing one is deliberate)", r.source === "manual" && r.feetPerUnit === 0.2, r);
  ok("a line with NO length yet → auto still applies", resolveScale({ reference: { ...line, lengthFt: 0 }, autoFeetPerUnit: auto }).source === "auto");
  ok("a degenerate line (both ends together) → auto", resolveScale({ reference: { ...line, b: { x: 0, y: 0 } }, autoFeetPerUnit: auto }).source === "auto");
  ok("nothing at all → null scale, null source", resolveScale({}).feetPerUnit === null && resolveScale({}).source === null);
  ok("auto NaN, no line → null", resolveScale({ autoFeetPerUnit: NaN }).feetPerUnit === null);
  ok("referenceFeetPerPixel: negative length → null", referenceFeetPerPixel({ ...line, lengthFt: -5 }) === null);
  ok("referenceFeetPerPixel: NaN end → null", referenceFeetPerPixel({ ...line, b: { x: NaN, y: 0 } }) === null);
}

// ── 5. The landscaping trades write fields their forms actually have ───────
section("5. lotTakeoff: every listed trade has a Lot Size box; edging only where it exists");
{
  ok("at least three landscaping trades listed", LOT_MEASURE_TRADES.length >= 3, LOT_MEASURE_TRADES);
  for (const trade of LOT_MEASURE_TRADES) {
    const fields = INTAKE_FIELDS[trade] || [];
    ok(`${trade} has a "${LOT_AREA_FIELD}" intake field to write into`, fields.some((f) => f.key === LOT_AREA_FIELD), fields.map((f) => f.key));
    ok(`${trade} wants the site image`, wantsSiteImage(trade));
  }
  ok("paving still wants the site image", wantsSiteImage("paving") && SITE_IMAGE_TRADES.includes("paving"));
  ok("a trade with no canvas does not", !wantsSiteImage("interior_painting") && !wantsSiteImage("stairs"));

  const edgeTrades = LOT_MEASURE_TRADES.filter((t) => (INTAKE_FIELDS[t] || []).some((f) => f.key === LOT_EDGE_FIELD));
  ok("landscaping_design has an edging field", edgeTrades.includes("landscaping_design"), edgeTrades);
  ok("lawn_care has an edging field", edgeTrades.includes("lawn_care"), edgeTrades);
  ok("lawn_mowing does NOT (a mowing contract has no edging line)", !edgeTrades.includes("lawn_mowing"), edgeTrades);

  const totals = { areaSqFt: 4371.26, perimeterFt: 287.456 };
  const withEdge = lotIntakePatch(totals, INTAKE_FIELDS.landscaping_design);
  ok("landscaping_design patch writes lotSize (whole sq ft) and edgingFt (tenths)", withEdge.lotSize === 4371 && withEdge.edgingFt === 287.5, withEdge);
  const mowing = lotIntakePatch(totals, INTAKE_FIELDS.lawn_mowing);
  ok("lawn_mowing patch writes lotSize only", mowing.lotSize === 4371 && !("edgingFt" in mowing), mowing);
  ok("a form with neither box → empty patch", Object.keys(lotIntakePatch(totals, [{ key: "treeHeight" }])).length === 0);
  ok("fields not an array → empty patch, no throw", Object.keys(lotIntakePatch(totals, null)).length === 0);
  ok("totals missing → zeros, not NaN", lotIntakePatch(undefined, INTAKE_FIELDS.lawn_care).lotSize === 0 && lotIntakePatch(undefined, INTAKE_FIELDS.lawn_care).edgingFt === 0);
  ok("totals NaN → zeros", lotIntakePatch({ areaSqFt: NaN, perimeterFt: "x" }, INTAKE_FIELDS.lawn_care).lotSize === 0);
}

// ── 6. The scale reaches the designer ──────────────────────────────────────
section("6. Wiring (source, decommented): the scale object travels with the URL");
{
  const builder = decomment(read("app/components/quotes/builder/QuoteBuilder.js"));
  const takeoff = decomment(read("app/components/quotes/builder/TradeTakeoff.js"));
  const paver = decomment(read("app/components/quotes/builder/PaverDesigner.js"));
  const canvas = decomment(read("app/components/quotes/builder/PolygonMeasure.js"));

  // Since 2026-09-18 the still is the PANEL's, not the page's: PavingTakeoff
  // holds it through useSatelliteStill (from the takeoff's own address, at the
  // zoom the estimator chose) and hands the designer the scale object the
  // route returned beside the URL — scripts/check-measure-framing.mjs owns
  // the address field and zoom controls; this holds the scale wiring.
  const hook = decomment(read("app/components/quotes/builder/useSatelliteStill.js"));
  ok("QuoteBuilder no longer fetches the still for the page", !/\/api\/measure\/satellite/.test(builder));
  ok("…and hands TradeTakeoff the client's address as the default", /siteAddress=\{selectedClient\?\.address/.test(builder));
  ok("useSatelliteStill keeps the route's scale object beside the URL", /scale:\s*data\.scale/.test(hook) && /image:\s*data\.image/.test(hook));
  ok("PavingTakeoff holds its own still through the hook", /useSatelliteStill\(\{/.test(takeoff));
  ok("PavingTakeoff hands PaverDesigner imageScale from it", /imageScale=\{still\.still\?\.scale/.test(takeoff));
  ok("PaverDesigner accepts imageScale", /imageScale\s*=\s*null/.test(paver));
  ok("…and gives it to the shared hook", /usePolygonMeasure\(\{[\s\S]*?imageScale[\s\S]*?\}\)/.test(paver));
  ok("the hook parses the URL when no scale object came", /imageScaleFromUrl\(imageUrl\)/.test(canvas));
  ok("the hook maps image pixels to canvas units through canvasFeetPerUnit", /canvasFeetPerUnit\(\{/.test(canvas));
  ok("…under slice, the fit the canvas paints with", /fit:\s*"slice"/.test(canvas) && /preserveAspectRatio="xMidYMid slice"/.test(canvas));
  ok("…correcting for the decoded image size", /naturalWidth:\s*natural\?\.width/.test(canvas));
  ok("the manual line can be cleared back to the automatic scale", /update\(\{\s*scale:\s*null\s*\}\)/.test(canvas));
  ok("no scale from either source still prints 'scale not set'", /app\.paver\.scaleNotSet"/.test(canvas));
}

// ── 7. One canvas, not two ─────────────────────────────────────────────────
section("7. Shared component: PaverDesigner and LotAreaMeasure both use PolygonMeasure");
{
  const paver = decomment(read("app/components/quotes/builder/PaverDesigner.js"));
  const lot = decomment(read("app/components/quotes/builder/LotAreaMeasure.js"));
  const builder = decomment(read("app/components/quotes/builder/QuoteBuilder.js"));

  ok("PaverDesigner renders <PolygonMeasure", /<PolygonMeasure/.test(paver));
  ok("PaverDesigner no longer owns an <svg>", !/<svg/.test(paver));
  ok("PaverDesigner no longer owns a ScaleBar", !/function ScaleBar/.test(paver));
  ok("PaverDesigner keeps its paver layer (patterns, materials, the diagonal check)", /PATTERNS/.test(paver) && /MaterialsPanel/.test(paver) && /quadSquareCheck/.test(paver));
  ok("PaverDesigner still emits the three takeoff fields", /patioSqft/.test(paver) && /walkwaySqft/.test(paver) && /drivewaySqft/.test(paver));

  ok("LotAreaMeasure renders <PolygonMeasure", /<PolygonMeasure/.test(lot));
  ok("LotAreaMeasure owns no <svg> of its own", !/<svg/.test(lot));
  ok("LotAreaMeasure writes through lotIntakePatch", /lotIntakePatch\(/.test(lot));
  ok("…and keeps the drawing under intakeValues.lotDrawing", /LOT_DRAWING_KEY\s*=\s*"lotDrawing"/.test(lot));
  // Since 2026-09-25 the same tracer fills a fence's Linear Feet (an edge box
  // and no area box), so "no box for its answer" is now "neither box" — a lot
  // trade always has lotSize, so for the lawn trades nothing changed.
  ok("…and renders nothing when the form has neither box", /if \(!hasAreaField && !hasEdgeField\) return null/.test(lot));

  ok("QuoteBuilder renders LotAreaMeasure for the landscaping trades", /isLotMeasureTrade\(group\.categoryKey\)\s*&&\s*\(\s*<LotAreaMeasure/.test(builder));
  ok("…above the intake form whose boxes it fills", builder.indexOf("<LotAreaMeasure") < builder.indexOf("<IntakeFields"));
  ok("…writing several intake values at once", /updateIntakeValues\(group\.tempId, patch\)/.test(builder));
  ok("LotAreaMeasure holds its own still through the hook, from the takeoff's address", /useSatelliteStill\(\{/.test(lot) && /takeoff\?\.measureAddress \|\| siteAddress/.test(lot));
  ok("…and hands the canvas that still's scale", /imageScale = still\.still\?\.scale/.test(lot));

  const pkg = JSON.parse(read("package.json"));
  ok("check:polygon-scale is a script", typeof pkg.scripts?.["check:polygon-scale"] === "string");
  ok("…and check:all runs it", (pkg.scripts?.["check:all"] || "").includes("check:polygon-scale"));
}

// ── Verdict ────────────────────────────────────────────────────────────────
console.log(`\n${pass} passed, ${failures.length} failed.`);
if (failures.length) {
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
