#!/usr/bin/env node
// scripts/check-measure-framing.mjs
//
//   npm run check:measure-framing
//
// The satellite still's FRAMING: what zoom it defaults to, what a zoom step
// does to the scale, how a traced drawing survives a zoom change, and when a
// roof forces the frame wider. Executed against lib/measure/imageScale.js
// under plain node, not read — the re-projection is the kind of arithmetic
// that looks right in a diff and is off by the retina scale in the browser.
//
// Four things are proved:
//
//   1. metresPerPixel at zooms 18 / 19 / 20 — each step out doubles the
//      ground a pixel covers, and the defaults are the ones the owner asked
//      for (lot 18, roof 19), so a check fails the day someone puts 20 back.
//   2. A square traced at zoom 19 and re-projected to zoom 18 has the SAME
//      lat/lng vertices and HALF the pixel side; back to 19 it is the original
//      to a millionth of a viewBox unit. The manual reference line moves with
//      it and its typed length does not.
//   3. A Solar bounding box wider than the frame steps the zoom out until it
//      fits; one that fits leaves the requested zoom alone; one that never
//      fits stops at MIN_ZOOM and says so.
//   4. The builder's three measure panels share ONE address field
//      (MeasureAddressField) and RoofMeasurePanel no longer has its own
//      AddressAutocomplete — a static read of the source, because the copy
//      is the one that rots.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_ZOOM,
  DEFAULT_ROOF_ZOOM,
  MIN_ZOOM,
  MAX_ZOOM,
  MAX_TILE_PX,
  metresPerPixel,
  imageScale,
  canvasPointToLatLng,
  latLngToCanvasPoint,
  latLngToFrameOffset,
  reprojectDrawing,
  zoomToFitBox,
  satelliteProxyPath,
  stillFrame,
  parseStaticMapUrl,
  referenceFeetPerPixel,
} from "@/lib/measure/imageScale";
import { satelliteProxyPath as viaSatellite } from "@/lib/measure/satellite";
import { satelliteImageUrl } from "@/lib/measure/roofMeasurement";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

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
const within = (got, want, tol) => Math.abs(got - want) <= tol;

// Ottawa. Same fixture as check-polygon-scale.mjs.
const LAT = 45.42;
const LNG = -75.7;
const CENTER = { lat: LAT, lng: LNG };
const VIEW_W = 1000;
const VIEW_H = 640;
const placement = (zoom) => ({
  center: CENTER,
  scaleInfo: imageScale({ lat: LAT, lng: LNG, zoom, scale: 2, width: 640, height: 640 }),
  viewWidth: VIEW_W,
  viewHeight: VIEW_H,
  fit: "slice",
});

// ── 1. Defaults and the factor per zoom step ───────────────────────────────
section("1. Zoom defaults, and metres per pixel at 18 / 19 / 20");
{
  ok("lot still defaults to zoom 18", DEFAULT_ZOOM === 18, DEFAULT_ZOOM);
  ok("roof still defaults to zoom 19", DEFAULT_ROOF_ZOOM === 19, DEFAULT_ROOF_ZOOM);
  ok("both defaults sit inside MIN..MAX", DEFAULT_ZOOM >= MIN_ZOOM && DEFAULT_ROOF_ZOOM <= MAX_ZOOM);

  const m20 = metresPerPixel(LAT, 20, 2);
  const m19 = metresPerPixel(LAT, 19, 2);
  const m18 = metresPerPixel(LAT, 18, 2);
  ok(`zoom 20 @ scale 2 → ${m20.toFixed(4)} m/px (≈ 0.0524)`, within(m20, 0.0524, 0.0002), m20);
  ok(`zoom 19 @ scale 2 → ${m19.toFixed(4)} m/px, exactly 2× zoom 20`, within(m19 / m20, 2, 1e-12), m19 / m20);
  ok(`zoom 18 @ scale 2 → ${m18.toFixed(4)} m/px, exactly 4× zoom 20`, within(m18 / m20, 4, 1e-12), m18 / m20);

  const frame18 = imageScale({ lat: LAT, lng: LNG, zoom: 18, scale: 2, width: 640, height: 640 });
  const frame19 = imageScale({ lat: LAT, lng: LNG, zoom: 19, scale: 2, width: 640, height: 640 });
  const frame20 = imageScale({ lat: LAT, lng: LNG, zoom: 20, scale: 2, width: 640, height: 640 });
  ok(`zoom 20 frame ≈ 222 ft across (got ${frame20.groundWidthFeet.toFixed(0)})`, within(frame20.groundWidthFeet, 222, 2));
  ok(`zoom 19 frame ≈ 443 ft across (got ${frame19.groundWidthFeet.toFixed(0)})`, within(frame19.groundWidthFeet, 443, 3));
  ok(`zoom 18 frame ≈ 880 ft across at 45.42°N (got ${frame18.groundWidthFeet.toFixed(0)})`, within(frame18.groundWidthFeet, 880, 5));
  ok("pixel size does not change with zoom (1280×1280 at scale 2)", frame18.pixelWidth === 1280 && frame20.pixelWidth === 1280);

  // The route's default request carries the scale object, so measurement is
  // exact at whatever zoom the still came back at.
  const defaulted = imageScale({ lat: LAT, lng: LNG });
  ok("imageScale() with no zoom uses DEFAULT_ZOOM (18)", defaulted.zoom === 18 && within(defaulted.metresPerPixel, m18, 1e-15), defaulted.zoom);
}

// ── 2. Re-projection ───────────────────────────────────────────────────────
section("2. A square traced at zoom 19 re-projected to zoom 18: same ground, half the pixels");
{
  const p19 = placement(19);
  const p18 = placement(18);
  const side = 200; // viewBox units
  const square = [
    { x: 400, y: 200 },
    { x: 400 + side, y: 200 },
    { x: 400 + side, y: 200 + side },
    { x: 400, y: 200 + side },
  ];
  const doc = {
    shapes: [{ id: "s1", surface: "patio", points: square }],
    scale: { a: { x: 100, y: 100 }, b: { x: 300, y: 100 }, lengthFt: 16 },
    imageOpacity: 0.65,
  };

  const moved = reprojectDrawing(doc, p19, p18);
  ok("re-projects", Boolean(moved) && moved.shapes.length === 1 && moved.shapes[0].points.length === 4, moved);

  // Same ground: every vertex has the same lat/lng through its own placement.
  let sameGround = true;
  for (let i = 0; i < 4; i++) {
    const before = canvasPointToLatLng(square[i], p19);
    const after = canvasPointToLatLng(moved.shapes[0].points[i], p18);
    if (!before || !after || Math.abs(before.lat - after.lat) > 1e-9 || Math.abs(before.lng - after.lng) > 1e-9) sameGround = false;
  }
  ok("every vertex keeps its lat/lng to 1e-9°", sameGround);

  const sideAfter = Math.hypot(
    moved.shapes[0].points[1].x - moved.shapes[0].points[0].x,
    moved.shapes[0].points[1].y - moved.shapes[0].points[0].y,
  );
  ok(`the side is half as many pixels (${side} → ${sideAfter.toFixed(3)})`, within(sideAfter, side / 2, 1e-6), sideAfter);
  ok("the centre of the frame stays put", within(moved.shapes[0].points[0].x - 500, (400 - 500) / 2, 1e-6) && within(moved.shapes[0].points[0].y - 320, (200 - 320) / 2, 1e-6));

  // Back again: the original, to a millionth of a unit.
  const back = reprojectDrawing(moved, p18, p19);
  const roundTrip = back.shapes[0].points.every((p, i) => within(p.x, square[i].x, 1e-6) && within(p.y, square[i].y, 1e-6));
  ok("zoom 18 → 19 returns the original drawing to 1e-6 units", roundTrip, back.shapes[0].points);

  // The reference line moved; its typed length did not; the manual scale it
  // implies is therefore the right one at the new zoom.
  const fpuBefore = referenceFeetPerPixel(doc.scale);
  const fpuAfter = referenceFeetPerPixel(moved.scale);
  ok("reference line keeps its 16 ft", moved.scale.lengthFt === 16);
  ok("…and its feet-per-unit doubles with the ground per pixel", within(fpuAfter / fpuBefore, 2, 1e-9), fpuAfter / fpuBefore);
  ok("shape id, surface and opacity pass through", moved.shapes[0].id === "s1" && moved.shapes[0].surface === "patio" && moved.imageOpacity === 0.65);

  // The same, but a zoom IN: the square grows and its far corner leaves the
  // viewBox, unclamped, so the area is still right.
  const p20 = placement(20);
  const bigger = reprojectDrawing(doc, p19, p20);
  const sideBigger = Math.hypot(bigger.shapes[0].points[1].x - bigger.shapes[0].points[0].x, bigger.shapes[0].points[1].y - bigger.shapes[0].points[0].y);
  ok("zoom 19 → 20 doubles the pixel side", within(sideBigger, side * 2, 1e-6), sideBigger);
  const far = reprojectDrawing({ shapes: [{ points: [{ x: 500, y: 320 }, { x: 900, y: 320 }, { x: 900, y: 600 }] }] }, p19, p20);
  ok("a corner past the viewBox edge is NOT clamped (600 → 880 > 640)", within(far.shapes[0].points[2].y, 880, 1e-6) && far.shapes[0].points[2].y > VIEW_H, far.shapes[0].points[2]);

  // Hostile.
  ok("no placement to convert through → null (never a half-moved outline)", reprojectDrawing(doc, {}, p18) === null);
  ok("a placement past Mercator's edge → null", reprojectDrawing(doc, p19, { ...p18, center: { lat: 89, lng: 0 } }) === null);
  ok("not a drawing → null", reprojectDrawing(null, p19, p18) === null);
  ok("no reference line stays null", reprojectDrawing({ shapes: [], scale: null }, p19, p18).scale === null);

  // The inverse is the inverse: latLngToCanvasPoint(canvasPointToLatLng(p)) == p.
  const pt = { x: 123.4, y: 567.8 };
  const ll = canvasPointToLatLng(pt, p19);
  const rt = latLngToCanvasPoint(ll, p19);
  ok("latLngToCanvasPoint inverts canvasPointToLatLng at the same zoom", within(rt.x, pt.x, 1e-6) && within(rt.y, pt.y, 1e-6), rt);
  ok("the still's centre is offset (0,0)", (() => { const o = latLngToFrameOffset(CENTER, { center: CENTER, zoom: 19 }); return o && o.dx === 0 && o.dy === 0; })());
  ok("north is negative dy (screen y grows downward)", latLngToFrameOffset({ lat: LAT + 0.001, lng: LNG }, { center: CENTER, zoom: 19 }).dy < 0);
  ok("east is positive dx", latLngToFrameOffset({ lat: LAT, lng: LNG + 0.001 }, { center: CENTER, zoom: 19 }).dx > 0);
}

// ── 3. Fit to roof ─────────────────────────────────────────────────────────
section("3. zoomToFitBox: a roof wider than the frame steps the zoom out until it fits");
{
  // A box `metres` across, centred on the pin, in Solar's own field names.
  const boxAround = (metresE, metresN, offsetE = 0, offsetN = 0) => {
    const perLat = 111132;
    const perLng = 111412.84 * Math.cos((LAT * Math.PI) / 180);
    const cLat = LAT + offsetN / perLat;
    const cLng = LNG + offsetE / perLng;
    return {
      sw: { latitude: cLat - metresN / 2 / perLat, longitude: cLng - metresE / 2 / perLng },
      ne: { latitude: cLat + metresN / 2 / perLat, longitude: cLng + metresE / 2 / perLng },
    };
  };
  // Frame at zoom 19: 640 logical px × 0.2111 m = 135 m; with the 8 % margin
  // 124 m usable. At 20: 67.6 m → 62 m usable. At 18: 270 m → 249 m.
  const small = zoomToFitBox({ box: boxAround(20, 15), center: CENTER, zoom: 19 });
  ok("a 20×15 m house fits at 19 and is left there", small.zoom === 19 && small.steppedOut === false && small.fits === true, small);

  const wide = zoomToFitBox({ box: boxAround(90, 30), center: CENTER, zoom: 20 });
  ok("a 90 m barn requested at 20 steps out to 19 (67 m frame → 135 m)", wide.zoom === 19 && wide.steppedOut === true && wide.requestedZoom === 20 && wide.fits, wide);

  const huge = zoomToFitBox({ box: boxAround(200, 200), center: CENTER, zoom: 19 });
  ok("a 200 m box at 19 steps out to 18", huge.zoom === 18 && huge.steppedOut, huge);

  const offCentre = zoomToFitBox({ box: boxAround(30, 30, 55, 0), center: CENTER, zoom: 19 });
  ok("a 30 m house 55 m east of the pin (edge at 70 m > 62 m half-frame) steps out to 18", offCentre.zoom === 18 && offCentre.steppedOut, offCentre);

  const never = zoomToFitBox({ box: boxAround(5000, 5000), center: CENTER, zoom: 19 });
  ok(`a 5 km box stops at MIN_ZOOM (${MIN_ZOOM}) and reports fits: false`, never.zoom === MIN_ZOOM && never.fits === false && never.steppedOut, never);

  const floored = zoomToFitBox({ box: boxAround(5000, 5000), center: CENTER, zoom: 19, minZoom: 18 });
  ok("a caller's minZoom floor is honoured", floored.zoom === 18 && floored.fits === false, floored);

  ok("no box → requested zoom, unchanged", (() => { const r = zoomToFitBox({ box: null, center: CENTER, zoom: 19 }); return r.zoom === 19 && !r.steppedOut && r.fits; })());
  ok("an unreadable box → requested zoom, unchanged", (() => { const r = zoomToFitBox({ box: { sw: { latitude: "x" }, ne: {} }, center: CENTER, zoom: 19 }); return r.zoom === 19 && !r.steppedOut; })());
  ok("never steps IN: a tiny box requested at 17 stays at 17", zoomToFitBox({ box: boxAround(5, 5), center: CENTER, zoom: 17 }).zoom === 17);
  ok("zoom 25 is clamped to MAX before fitting", zoomToFitBox({ box: boxAround(5, 5), center: CENTER, zoom: 25 }).zoom === MAX_ZOOM);
  ok("accepts { lat, lng } corners too", zoomToFitBox({ box: { sw: { lat: LAT - 0.0001, lng: LNG - 0.0001 }, ne: { lat: LAT + 0.0001, lng: LNG + 0.0001 } }, center: CENTER, zoom: 19 }).zoom === 19);

  // The roof still itself: 640×640 at 19, with the marker.
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "test-key";
  const url = satelliteImageUrl(LAT, LNG);
  const parsed = parseStaticMapUrl(url);
  ok("the roof still defaults to zoom 19, 640×640, scale 2", parsed && parsed.zoom === 19 && parsed.width === 640 && parsed.height === 640 && parsed.scale === 2, parsed);
  ok("…with the pin on the address", /markers=/.test(url));
  ok("…and without it when asked", !/markers=/.test(satelliteImageUrl(LAT, LNG, { marker: false })));
}

// ── 4. The frame record and the keyless path ──────────────────────────────
section("4. stillFrame / satelliteProxyPath: the request a takeoff stores rebuilds the same still");
{
  const frame = stillFrame({ lat: LAT, lng: LNG, zoom: 19, scale: 2, width: 640, height: 640, marker: true });
  ok("a frame carries the six numbers and the marker", frame && frame.zoom === 19 && frame.width === 640 && frame.marker === true, frame);
  ok("a frame with no zoom takes DEFAULT_ZOOM", stillFrame({ lat: LAT, lng: LNG }).zoom === DEFAULT_ZOOM);
  ok("a frame with no coordinates is null", stillFrame({ zoom: 19 }) === null);
  const path = satelliteProxyPath(frame);
  ok("the proxy path is keyless and same-origin", path.startsWith("/api/measure/satellite?format=png&") && !/key=/.test(path), path);
  ok("…and carries marker=1 for a roof", /marker=1/.test(path));
  ok("…and not for a lot", !/marker/.test(satelliteProxyPath({ ...frame, marker: false })));
  const rt = parseStaticMapUrl(path);
  ok("the path parses back to the same frame", rt.lat === LAT && rt.lng === LNG && rt.zoom === 19 && rt.scale === 2 && rt.width === 640 && rt.marker === true, rt);
  ok("satellite.js re-exports the SAME function", viaSatellite === satelliteProxyPath);
  ok("MAX_TILE_PX is 640 (the largest Google serves without premium)", MAX_TILE_PX === 640);
}

// ── 5. One address field, three panels ─────────────────────────────────────
section("5. MeasureAddressField is the one address input on the three measure panels");
{
  const tradeTakeoff = stripComments(read("app/components/quotes/builder/TradeTakeoff.js"));
  const lot = stripComments(read("app/components/quotes/builder/LotAreaMeasure.js"));
  const field = read("app/components/quotes/builder/MeasureAddressField.js");
  const zoomCtl = read("app/components/quotes/builder/MeasureZoomControls.js");

  ok("MeasureAddressField.js exists and uses AddressAutocomplete", /AddressAutocomplete/.test(field));
  ok("TradeTakeoff.js imports MeasureAddressField", /import MeasureAddressField from "\.\/MeasureAddressField"/.test(tradeTakeoff));
  ok("LotAreaMeasure.js imports MeasureAddressField", /import MeasureAddressField from "\.\/MeasureAddressField"/.test(lot));

  // The three panels render it.
  const roofPanel = tradeTakeoff.slice(tradeTakeoff.indexOf("function RoofMeasurePanel("), tradeTakeoff.indexOf("function RoofingTakeoff("));
  const pavingPanel = tradeTakeoff.slice(tradeTakeoff.indexOf("function PavingTakeoff("), tradeTakeoff.indexOf("function SnowRemovalTakeoff("));
  ok("RoofMeasurePanel renders <MeasureAddressField", /<MeasureAddressField/.test(roofPanel));
  ok("PavingTakeoff renders <MeasureAddressField", /<MeasureAddressField/.test(pavingPanel));
  ok("LotAreaMeasure renders <MeasureAddressField", /<MeasureAddressField/.test(lot));
  ok("no second address input remains in RoofMeasurePanel", !/<AddressAutocomplete/.test(roofPanel) && !/<input/.test(roofPanel));
  ok("PavingTakeoff has no address input of its own", !/<AddressAutocomplete/.test(pavingPanel));

  // The zoom controls, likewise shared.
  ok("MeasureZoomControls.js exists with − / + and re-centre", /onZoomOut|zoomOut/.test(zoomCtl) && /onZoomIn|zoomIn/.test(zoomCtl) && /onRecentre|recentre/i.test(zoomCtl));
  ok("RoofMeasurePanel renders <MeasureZoomControls", /<MeasureZoomControls/.test(roofPanel));
  ok("PavingTakeoff renders <MeasureZoomControls", /<MeasureZoomControls/.test(pavingPanel));
  ok("LotAreaMeasure renders <MeasureZoomControls", /<MeasureZoomControls/.test(lot));

  // The address is stored on the takeoff as measureAddress by all three, and
  // read for the document.
  ok("RoofMeasurePanel writes measureAddress", /measureAddress/.test(roofPanel));
  ok("PavingTakeoff writes measureAddress", /measureAddress/.test(pavingPanel));
  ok("LotAreaMeasure writes measureAddress", /measureAddress/.test(lot));
  const images = stripComments(read("lib/measure/measureImages.js"));
  ok("measureImages.js reads measureAddress for the document", /measureAddress/.test(images));
  ok("the drawing is re-projected on a zoom change (reprojectDrawing) in both tracing panels", /reprojectDrawing/.test(pavingPanel) && /reprojectDrawing/.test(lot));

  // The "Measured at" line, in every language clientDocCopy carries.
  const { CLIENT_DOC_COPY } = await import("@/lib/i18n/clientDocCopy");
  for (const code of Object.keys(CLIENT_DOC_COPY)) {
    const fn = CLIENT_DOC_COPY[code].measuredAt;
    ok(`clientDocCopy.${code}.measuredAt prints the address`, typeof fn === "function" && fn("12 Main St").includes("12 Main St"), typeof fn);
  }
}

// ── 6. The document: frame → still, and "Measured at" ──────────────────────
section("6. measureImages: a stored frame becomes the document's still only when something was measured");
{
  const { measureImageSource, measureEvidence, takeoffMeasureAddress } = await import("@/lib/measure/measureImages");
  const frame = { lat: LAT, lng: LNG, zoom: 19, scale: 2, width: 640, height: 640, marker: true };

  const roof = { measuredFrom: "satellite", areaSqft: 2163, pitchRise: 6, measureAddress: "12 Main St, Ottawa", measureFrame: frame };
  const src = measureImageSource(roof, "roofing_service");
  ok("a measured roof's frame becomes a Google source URL for the save route to capture", Boolean(src?.sourceUrl) && /maps\.googleapis\.com\/maps\/api\/staticmap/.test(src.sourceUrl), src);
  ok("…at the frame's zoom and size, with the pin", /zoom=19/.test(src.sourceUrl) && /size=640x640/.test(src.sourceUrl) && /markers=/.test(src.sourceUrl));
  ok("a roof typed over by hand prints no still from its frame", measureImageSource({ ...roof, measuredFrom: "manual" }, "roofing_service") === null);

  const paving = { patioSqft: 400, measuredAreaSqft: 0, measureAddress: "12 Main St", measureFrame: { ...frame, marker: false } };
  ok("a paving takeoff with typed boxes and nothing traced prints no still", measureImageSource(paving, "paving") === null);
  const traced = measureImageSource({ ...paving, measuredAreaSqft: 400 }, "paving");
  ok("…and one with a traced total does, without the pin", Boolean(traced?.sourceUrl) && !/markers=/.test(traced.sourceUrl), traced);
  ok("a lot trade never prints a bare frame (its still is the outline from vertices)", measureImageSource({ measureFrame: frame, lawn: { areaSqft: 1200 } }, "lawn_care") === null);
  ok("an already-captured copy is kept as is", measureImageSource({ measureImage: { url: "https://res.cloudinary.com/x/y.png" }, measureFrame: frame, measuredFrom: "satellite" }, "roofing_service").url === "https://res.cloudinary.com/x/y.png");

  ok("takeoffMeasureAddress reads the new spelling", takeoffMeasureAddress({ measureAddress: " 12 Main St " }) === "12 Main St");
  ok("…and the older one the gutter and instant-quote paths write", takeoffMeasureAddress({ measuredAddress: "9 Elm Ave" }) === "9 Elm Ave");
  ok("…and nothing → empty string", takeoffMeasureAddress({}) === "" && takeoffMeasureAddress(null) === "");

  const ev = measureEvidence({ ...roof, measureImage: { url: "https://res.cloudinary.com/x/y.png" } }, "roofing_service", "fr");
  ok("the evidence carries the still, the French caption and the French address line", ev && ev.imageUrl && /Toit mesuré/.test(ev.caption) && ev.measuredAt === "Mesuré à l'adresse : 12 Main St, Ottawa", ev);
  const evEn = measureEvidence(roof, "roofing_service", "en");
  ok("a caption alone (still not captured yet) still carries the address line", evEn && evEn.imageUrl === null && evEn.measuredAt === "Measured at 12 Main St, Ottawa", evEn);
  ok("no address → no address line", measureEvidence({ ...roof, measureAddress: "" }, "roofing_service", "en").measuredAt === null);
  ok("nothing measured and no still → no evidence at all, address or not", measureEvidence({ measureAddress: "12 Main St" }, "paving", "en") === null);
  ok("German prints German", measureEvidence(roof, "roofing_service", "de").measuredAt === "Vermessen an: 12 Main St, Ottawa");
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
