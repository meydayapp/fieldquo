// lib/measure/imageScale.js
//
// The maths that turns pixels on a satellite still into feet on the ground,
// with NO imports from the server side of the measuring tool.
//
// ── Why this is its own file ────────────────────────────────────────────────
//
// lib/measure/satellite.js is where these formulas were born, and it still
// re-exports every one of them so its callers see no change. But that file
// also geocodes, which drags in roofMeasurement.js and the server-side maps
// key, and the DRAWING surface — a "use client" component an estimator traces
// on with a finger — cannot import any of that. Until this split the canvas
// asked the estimator to draw a reference line along a garage door and type
// its length, on an image whose ground resolution was already known to the
// route that served it. The scale existed; it was just on the wrong side of
// the bundle boundary.
//
// Everything here is PURE, takes hostile input, and returns null rather than
// NaN or Infinity. scripts/check-polygon-scale.mjs executes it under plain
// node with a square of known side, and asserts the area comes back within
// 1 %. The comments on each formula say why the obvious version is wrong;
// the check says whether this one is right.

import { polygonAreaSqFt, polygonPerimeterFt } from "@/lib/pricing/paverTakeoff";

// ── Web Mercator, from first principles ─────────────────────────────────────
//
// Google's tile pyramid is 256×256 px tiles. At zoom 0 the ENTIRE world is one
// tile, so 256 px spans the earth's equatorial circumference. Every zoom level
// doubles the pixel width of the world, so ground-per-pixel halves.
//
//   circumference = 2π · a,  a = 6378137 m (WGS84 equatorial radius — the same
//                                radius lotArea.js uses, deliberately, so the
//                                two measuring paths can't disagree)
//                 = 40075016.6856 m
//   at zoom 0     = 40075016.6856 / 256 = 156543.03392 m per pixel
//
// That is the famous constant. It is only correct AT THE EQUATOR, because
// Mercator stretches the map east-west as you move poleward: a pixel at 45°N
// covers cos(45°) ≈ 0.707 of the ground a pixel at the equator covers. Skip
// that term and Ottawa measures 41% too big.
const EARTH_EQUATORIAL_RADIUS_M = 6378137;
const TILE_SIZE_PX = 256;
export const METRES_PER_PIXEL_AT_ZOOM_0 =
  (2 * Math.PI * EARTH_EQUATORIAL_RADIUS_M) / TILE_SIZE_PX; // 156543.03392...

// Exact by international definition (1 ft = 0.3048 m), not an approximation.
export const METRES_PER_FOOT = 0.3048;
export const FEET_PER_METRE = 1 / METRES_PER_FOOT;
export const SQFT_PER_M2 = FEET_PER_METRE * FEET_PER_METRE;

/**
 * The latitude beyond which Web Mercator stops existing.
 *
 * The projection sends the poles to infinity; Google squares the world off at
 * ±85.05112878° so the map is a square. Past that there is no tile to fetch
 * and no meaningful metres-per-pixel, so this file refuses rather than
 * returning a number for an image that will come back blank.
 */
export const MAX_MERCATOR_LAT = 85.05112878;

/**
 * The zoom band in which a satellite still is actually a measuring instrument.
 *
 * Below 15 a residential lot is a smudge tens of pixels wide and any traced
 * area is fiction — the honest answer there is "no measurement", not a number
 * with two decimal places on it. Above 21 Google has no satellite tiles for
 * most of the world and serves an upscaled blur or a grey "no imagery" panel,
 * which looks sharp enough to trace and isn't. Requests outside the band are
 * clamped by normaliseImageRequest() and the clamped value is reported back,
 * so a caller is never told it got the zoom it asked for when it didn't.
 */
export const MIN_ZOOM = 15;
export const MAX_ZOOM = 21;

/**
 * Default zoom for a residential LOT still: 18.
 *
 * This was 20 until 2026-09-18. The owner's complaint, verbatim: "zoom out a
 * bit so we can see all the property — I cannot see the edge of the
 * property, more important for paving and landscaping." Worked through at
 * 45°N (roughly Ottawa/Minneapolis — the middle of this product's market)
 * with the default 640×640 @ scale 2:
 *
 *   zoom 20:  0.0528 m/px (≈2 in)   frame ≈  68 m ≈ 222 ft across
 *   zoom 19:  0.1056 m/px (≈4 in)   frame ≈ 135 m ≈ 443 ft across
 *   zoom 18:  0.2111 m/px (≈8 in)   frame ≈ 270 m ≈ 886 ft across
 *
 * 222 ft contains a small suburban lot and nothing else: a half-acre lot is
 * 150 ft deep and the frame's visible band on the canvas (1000×640 viewBox,
 * "slice" fit, so the middle 64 % of the square) is ~140 ft tall — the back
 * fence was off the picture, which is the edge a landscaper prices to. 886 ft
 * shows an acre with the neighbours around it for orientation. The cost is
 * resolution — 8 in/px makes a 3 ft path four pixels wide — and that is what
 * the − / + buttons on the measure panels are for: zoom in to trace the
 * path, zoom out to see the lot, with the drawing re-projected through
 * lat/lng on every step (reprojectDrawing below) so nothing is lost either
 * way. The default is the FRAMING choice; the estimator picks the tracing
 * zoom.
 */
export const DEFAULT_ZOOM = 18;

/**
 * Default zoom for a ROOF still: 19.
 *
 * A roof is measured by Google's 3-D model, not traced, so the still is
 * evidence rather than an instrument: it has to show the WHOLE roof with its
 * edges, and it needs to be sharp enough for an estimator to recognise the
 * building. Zoom 20 at the old 640×400 clipped the eaves of anything over
 * ~50 ft deep (the 400-px side covered 42 m ≈ 138 ft, and the roof sits
 * wherever the geocoder's pin put it, not centred). 640×640 at 19 covers
 * 443 ft square — a large house with its lot around it — and zoomToFitBox()
 * steps out further when Solar's bounding box says even that clips.
 */
export const DEFAULT_ROOF_ZOOM = 19;

/**
 * Google Static Maps' standard ceilings. `size` is the LOGICAL size; `scale`
 * multiplies the pixels returned WITHOUT changing the ground covered — which
 * is precisely why metresPerPixel() divides by it. 640 @ scale 2 = a 1280×1280
 * image, the largest the non-premium plan will serve.
 */
export const MAX_TILE_PX = 640;
export const MIN_TILE_PX = 64;
export const ALLOWED_SCALES = [1, 2];
export const DEFAULT_SCALE = 2;

/**
 * Strict numeric coercion.
 *
 * Deliberately NOT `Number(x) || 0`, the idiom used elsewhere in this
 * directory for polygon vertices. Here it would be a live bug: Number(null) is
 * 0, and 0 is a perfectly valid latitude, so a missing latitude would silently
 * measure the Gulf of Guinea and return a confident 0.149 m/px. Strings pass
 * because query parameters arrive as strings; null, undefined, "", booleans,
 * arrays and objects do not.
 */
export function strictNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Ground metres represented by one pixel of a Google satellite image. PURE.
 *
 *   156543.03392        metres per pixel at zoom 0, at the equator
 *   · cos(latitude)     Mercator's east-west stretch; 1 at the equator,
 *                       0.707 at 45°, 0.5 at 60°. Omitting this is the single
 *                       most common way this calculation is got wrong.
 *   / 2^zoom            each zoom level doubles the world's pixel width
 *   / scale             a scale=2 (retina) request returns twice as many
 *                       pixels covering THE SAME GROUND, so each of those
 *                       pixels is half as wide. The estimator traces on the
 *                       pixels that came back, so this must divide.
 *
 * Returns null — never NaN, never Infinity — for a latitude outside Mercator,
 * a zoom outside the measurable band, a scale Google doesn't serve, or any
 * non-numeric input. `scale` defaults to 1: a Static Maps URL with no scale
 * parameter IS a scale-1 image, so that default is Google's, not a guess.
 *
 * @param {number|string} latitude  degrees, WGS84
 * @param {number|string} zoom      integer, MIN_ZOOM..MAX_ZOOM
 * @param {number|string} [scale]   1 or 2
 * @returns {number|null} metres per pixel of the returned image
 */
export function metresPerPixel(latitude, zoom, scale = 1) {
  const lat = strictNumber(latitude);
  const z = strictNumber(zoom);
  const s = scale === undefined || scale === null ? 1 : strictNumber(scale);

  if (lat === null || z === null || s === null) return null;
  if (Math.abs(lat) > MAX_MERCATOR_LAT) return null;
  // Non-integer zooms are rejected rather than rounded: Static Maps rounds them
  // itself, so a 20.5 would return a zoom-20 or zoom-21 image measured with a
  // scale for neither.
  if (!Number.isInteger(z) || z < MIN_ZOOM || z > MAX_ZOOM) return null;
  if (!ALLOWED_SCALES.includes(s)) return null;

  return (
    (METRES_PER_PIXEL_AT_ZOOM_0 * Math.cos((lat * Math.PI) / 180)) /
    Math.pow(2, z) /
    s
  );
}

/**
 * The same figure in feet, because the estimator, the price book and the
 * client all work in feet. PURE. Null propagates.
 *
 * @returns {number|null} feet of ground per pixel of the returned image
 */
export function feetPerPixel(latitude, zoom, scale = 1) {
  const mpp = metresPerPixel(latitude, zoom, scale);
  return mpp === null ? null : mpp * FEET_PER_METRE;
}

/**
 * Clamp a caller's image request into what Google will actually serve and this
 * file will actually vouch for. PURE.
 *
 * Clamps rather than rejects on zoom/size/scale so a slightly-off request still
 * produces a usable image — but the clamped values are what gets returned, and
 * every caller reports them back to the client. Nothing is allowed to believe
 * it got zoom 23. Latitude/longitude are NOT clamped: a bad coordinate is a bad
 * address, and quietly measuring the nearest valid point is exactly the class
 * of "control that appears to work" this codebase keeps having to delete.
 *
 * @returns {{lat:number,lng:number,zoom:number,scale:number,width:number,height:number}|null}
 */
export function normaliseImageRequest(input = {}) {
  const lat = strictNumber(input?.lat);
  const lng = strictNumber(input?.lng);
  if (lat === null || lng === null) return null;
  if (Math.abs(lat) > MAX_MERCATOR_LAT) return null;
  if (Math.abs(lng) > 180) return null;

  const rawZoom = strictNumber(input.zoom);
  const zoom =
    rawZoom === null
      ? DEFAULT_ZOOM
      : Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(rawZoom)));

  const rawScale = strictNumber(input.scale);
  const scale = ALLOWED_SCALES.includes(rawScale) ? rawScale : DEFAULT_SCALE;

  const clampPx = (value, fallback) => {
    const n = strictNumber(value);
    if (n === null) return fallback;
    return Math.min(MAX_TILE_PX, Math.max(MIN_TILE_PX, Math.round(n)));
  };

  return {
    lat,
    lng,
    zoom,
    scale,
    width: clampPx(input.width, MAX_TILE_PX),
    height: clampPx(input.height, MAX_TILE_PX),
  };
}

/**
 * Everything needed to turn pixels on the returned image into feet on the
 * ground. PURE — this is the object the drawing surface should hold onto.
 *
 * `width`/`height` are the LOGICAL size sent to Google; `pixelWidth`/
 * `pixelHeight` are the pixels that actually come back (logical × scale) and
 * are what a canvas will report. They differ at scale 2, and confusing the two
 * is a clean 2× error, so both are named explicitly rather than left to the
 * caller to multiply.
 *
 * @returns {object|null}
 */
export function imageScale(input = {}) {
  const req = normaliseImageRequest(input);
  if (!req) return null;

  const mpp = metresPerPixel(req.lat, req.zoom, req.scale);
  if (mpp === null) return null;

  const fpp = mpp * FEET_PER_METRE;
  const pixelWidth = req.width * req.scale;
  const pixelHeight = req.height * req.scale;

  return {
    latitude: req.lat,
    zoom: req.zoom,
    scale: req.scale,
    width: req.width,
    height: req.height,
    pixelWidth,
    pixelHeight,
    metresPerPixel: mpp,
    feetPerPixel: fpp,
    // What the frame actually covers, so a UI can say "222 ft across" and an
    // estimator can tell at a glance whether the driveway is cropped.
    groundWidthFeet: pixelWidth * fpp,
    groundHeightFeet: pixelHeight * fpp,
  };
}

/**
 * Pixel distance on the returned image → feet on the ground. PURE.
 *
 * @param {number} pixels
 * @param {object} scaleInfo  the object from imageScale()
 * @returns {number|null}
 */
export function pixelsToFeet(pixels, scaleInfo) {
  const px = strictNumber(pixels);
  const fpp = strictNumber(scaleInfo?.feetPerPixel);
  if (px === null || fpp === null || fpp <= 0) return null;
  return px * fpp;
}

/**
 * Pixel area → square feet. PURE.
 *
 * Squares the linear scale, which is only valid because a Mercator tile is
 * conformal — locally, a pixel is square on the ground. Over a 222 ft frame the
 * north-south stretch across the image is a few parts in ten thousand, far
 * below the accuracy of a finger-traced outline. Over a whole city it would not
 * be, which is another reason MIN_ZOOM exists.
 *
 * @returns {number|null}
 */
export function pixelAreaToSqft(pixelArea, scaleInfo) {
  const area = strictNumber(pixelArea);
  const mpp = strictNumber(scaleInfo?.metresPerPixel);
  if (area === null || area < 0 || mpp === null || mpp <= 0) return null;
  return area * mpp * mpp * SQFT_PER_M2;
}

// ── Reading the parameters back off an image URL ────────────────────────────

/**
 * The centre/zoom/scale/size a satellite still was requested with, read back
 * off its URL. PURE. Two shapes are understood:
 *
 *   /api/measure/satellite?format=png&lat=45.4&lng=-75.7&zoom=20&scale=2
 *                          &width=640&height=640            (our proxy)
 *   https://maps.googleapis.com/maps/api/staticmap?center=45.4,-75.7
 *                          &zoom=20&scale=2&size=640x640    (Google direct)
 *
 * This is the FALLBACK, for a screen that was handed a URL and nothing else.
 * The route that serves the image also returns the scale as JSON, and that is
 * what a caller should carry; parsing it back out of a query string is one
 * regex away from a silent 2× error if Google ever renames `scale`. It exists
 * because a URL is what older code passed around, and a photograph the
 * estimator uploaded themselves has no parameters at all — the null here is
 * what puts the manual reference line back on screen for those.
 *
 * A Cloudinary URL (the permanent copy satelliteCapture.js makes) carries no
 * parameters and returns null: the request that produced it is kept under
 * `satelliteSourceUrl` on the measurement, and THAT can be parsed.
 *
 * @returns {{lat:number,lng:number,zoom:number|null,scale:number|null,
 *            width:number|null,height:number|null}|null}
 */
export function parseStaticMapUrl(url) {
  if (typeof url !== "string" || url.trim() === "") return null;
  let params;
  try {
    // A relative proxy path has no origin; any base makes URL() accept it and
    // the base is never read back.
    params = new URL(url, "https://fieldquo.invalid").searchParams;
  } catch {
    return null;
  }

  let lat = strictNumber(params.get("lat"));
  let lng = strictNumber(params.get("lng"));
  if (lat === null || lng === null) {
    const centre = (params.get("center") || "").split(",");
    lat = strictNumber(centre[0]);
    lng = strictNumber(centre[1]);
  }
  if (lat === null || lng === null) return null;

  let width = strictNumber(params.get("width"));
  let height = strictNumber(params.get("height"));
  if (width === null || height === null) {
    const size = (params.get("size") || "").toLowerCase().split("x");
    width = strictNumber(size[0]);
    height = strictNumber(size[1]);
  }

  return {
    lat,
    lng,
    zoom: strictNumber(params.get("zoom")),
    // Absent means 1 — Google's default, not ours. normaliseImageRequest()
    // would default it to 2 because that is what WE request; for a URL somebody
    // else built, absent has to mean what Google means by it.
    scale: params.has("scale") ? strictNumber(params.get("scale")) : 1,
    width,
    height,
    marker: params.get("marker") === "1",
  };
}

/**
 * imageScale() for a URL. PURE. Null for anything that is not a satellite
 * request with a usable zoom — see parseStaticMapUrl for why null is the
 * right answer for an uploaded site photo.
 *
 * The zoom is NOT defaulted here the way normaliseImageRequest() defaults it:
 * a URL with no zoom is not a zoom-20 image, and measuring it as one would be
 * a confident number from nothing. Size defaults to Google's ceiling only when
 * the URL carries none, because the canvas corrects for the real pixel size
 * once the image loads (see canvasFeetPerUnit).
 */
export function imageScaleFromUrl(url) {
  const parsed = parseStaticMapUrl(url);
  if (!parsed || parsed.zoom === null) return null;
  return imageScale({
    lat: parsed.lat,
    lng: parsed.lng,
    zoom: parsed.zoom,
    scale: parsed.scale ?? 1,
    width: parsed.width ?? MAX_TILE_PX,
    height: parsed.height ?? MAX_TILE_PX,
  });
}

// ── From image pixels to the canvas an estimator draws on ───────────────────

/**
 * Feet per CANVAS unit, for an image painted into an SVG viewBox. PURE.
 *
 * The drawing surface does not work in image pixels. It has a fixed viewBox
 * (1000×640) and paints the image into it with preserveAspectRatio, so a
 * traced vertex is in viewBox units, and the scale that applies to it is the
 * image's feet-per-pixel divided by however many viewBox units one image
 * pixel was stretched to. Under "slice" (cover — the fit the canvas has
 * always used) the image is scaled by the LARGER of the two ratios and
 * cropped; under "meet" (contain) by the smaller and letterboxed. Either way
 * the scale is uniform, so the offset is irrelevant to a measurement.
 *
 * ── What the decoded size is for, and what it is NOT for ──
 *
 * The stretch depends on the image's ASPECT RATIO, not its pixel count: a
 * uniform resize (a Cloudinary `w_640` variant of the 1280 px tile) changes
 * both the pixel count and the feet each pixel covers by the same factor,
 * and the canvas result is the same. Worked through — result = fpp·D/M where
 * D is the declared width and M = max(viewW, viewH·w/h) — the decoded width
 * cancels out. So `naturalWidth`/`naturalHeight` are NOT a resize correction.
 *
 * They are an aspect correction. The declared size is exact when it came
 * from the route's JSON, but a GUESS (640×640) when it was parsed off a URL
 * that carried no size — and a 1280×800 image painted under slice is scaled
 * by 0.8, not by the 0.78125 a square guess implies, a 2.4 % error in every
 * length. When the decoded aspect disagrees with the declared one, the
 * decoded one is the truth and is used; when they agree, the declared size
 * is kept, which is the same answer. Feet per decoded pixel is `feetPerPixel`
 * in both cases, because that figure comes from zoom and scale, and those
 * were read correctly even when the size was not.
 *
 * Returns null on any missing or non-positive input — the caller then shows
 * "scale not set" and the manual reference line, never a guess.
 *
 * @returns {number|null} feet per viewBox unit
 */
export function canvasFeetPerUnit({
  feetPerPixel: fpp,
  pixelWidth,
  pixelHeight,
  naturalWidth,
  naturalHeight,
  viewWidth,
  viewHeight,
  fit = "slice",
} = {}) {
  const feetPerPx = strictNumber(fpp);
  const declaredW = strictNumber(pixelWidth);
  const declaredH = strictNumber(pixelHeight);
  const vw = strictNumber(viewWidth);
  const vh = strictNumber(viewHeight);
  if (feetPerPx === null || feetPerPx <= 0) return null;
  if (declaredW === null || declaredW <= 0 || declaredH === null || declaredH <= 0) return null;
  if (vw === null || vw <= 0 || vh === null || vh <= 0) return null;

  const natW = strictNumber(naturalWidth);
  const natH = strictNumber(naturalHeight);
  let w = declaredW;
  let h = declaredH;
  if (natW !== null && natW > 0 && natH !== null && natH > 0) {
    // 1 % of aspect: wide enough to absorb a one-pixel rounding difference
    // in a resize, far narrower than the gap between a square guess and any
    // non-square tile Google serves.
    const declaredAspect = declaredW / declaredH;
    const naturalAspect = natW / natH;
    if (Math.abs(naturalAspect - declaredAspect) > declaredAspect * 0.01) {
      w = natW;
      h = natH;
    }
  }

  const ratioW = vw / w;
  const ratioH = vh / h;
  const unitsPerPx = fit === "meet" ? Math.min(ratioW, ratioH) : Math.max(ratioW, ratioH);
  const result = feetPerPx / unitsPerPx;
  return Number.isFinite(result) && result > 0 ? result : null;
}

// ── The manual reference line, for images that are not satellite tiles ──────

const numOf = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export const isPoint = (p) =>
  Boolean(p) &&
  typeof p === "object" &&
  Number.isFinite(Number(p.x)) &&
  Number.isFinite(Number(p.y));

/**
 * Feet per canvas unit, from a reference line the user drew and a length they
 * typed. PURE.
 *
 * Returns null — never 0, never Infinity — when the line is degenerate or no
 * length has been typed yet. Callers branch on null and print "scale not set";
 * a 0 would silently measure every shape as nothing, and an Infinity would
 * measure a 12 ft patio as the county.
 *
 * @param {{a:{x,y}, b:{x,y}, lengthFt:number}|null} scale
 */
export function referenceFeetPerPixel(scale) {
  if (!scale || !isPoint(scale.a) || !isPoint(scale.b)) return null;
  const px = Math.hypot(
    numOf(scale.b.x) - numOf(scale.a.x),
    numOf(scale.b.y) - numOf(scale.a.y),
  );
  const ft = numOf(scale.lengthFt);
  if (!(px > 0) || !(ft > 0)) return null;
  const ratio = ft / px;
  return Number.isFinite(ratio) && ratio > 0 ? ratio : null;
}

/**
 * Which scale applies: a reference line the estimator drew beats the image's
 * own, because drawing one is a deliberate act and the automatic one is a
 * default. PURE.
 *
 * @returns {{feetPerUnit:number|null, source:"manual"|"auto"|null}}
 */
export function resolveScale({ reference = null, autoFeetPerUnit = null } = {}) {
  const manual = referenceFeetPerPixel(reference);
  if (manual !== null) return { feetPerUnit: manual, source: "manual" };
  const auto = strictNumber(autoFeetPerUnit);
  if (auto !== null && auto > 0) return { feetPerUnit: auto, source: "auto" };
  return { feetPerUnit: null, source: null };
}

// ── Measuring a traced polygon ──────────────────────────────────────────────

/**
 * Measure one traced polygon whose vertices are in pixels (or canvas units),
 * given metres per pixel. PURE.
 *
 * The shoelace and the perimeter are lib/pricing/paverTakeoff.js's — the
 * engine that already prices pavers off them and has been executed against
 * hostile input. A second shoelace here would be the copy that rots, so this
 * converts the vertices to feet and hands them over, then reports both unit
 * systems from one answer.
 *
 * `reason` carries WHY there is no measurement, because "add another point"
 * and "set the scale" are different problems and a single blank cell tells
 * the estimator neither.
 *
 * @param {Array<{x:number,y:number}>} points
 * @param {number} mpp  metres per pixel (or per canvas unit)
 * @returns {{ok:boolean, reason:"too_few"|"no_scale"|null, points:number,
 *            areaM2:number, areaSqFt:number, perimeterM:number,
 *            perimeterFt:number, feet:Array<{x:number,y:number}>}}
 */
export function measurePolygonPixels(points, mpp) {
  const pts = Array.isArray(points) ? points.filter(isPoint) : [];
  const none = (reason) => ({
    ok: false,
    reason,
    points: pts.length,
    areaM2: 0,
    areaSqFt: 0,
    perimeterM: 0,
    perimeterFt: 0,
    feet: [],
  });
  if (pts.length < 3) return none("too_few");
  const scale = strictNumber(mpp);
  if (scale === null || scale <= 0) return none("no_scale");

  const feetPerUnit = scale * FEET_PER_METRE;
  const feet = pts.map((p) => ({
    x: numOf(p.x) * feetPerUnit,
    y: numOf(p.y) * feetPerUnit,
  }));
  const areaSqFt = polygonAreaSqFt(feet);
  const perimeterFt = polygonPerimeterFt(feet);
  return {
    ok: true,
    reason: null,
    points: pts.length,
    areaM2: areaSqFt / SQFT_PER_M2,
    areaSqFt,
    perimeterM: perimeterFt * METRES_PER_FOOT,
    perimeterFt,
    feet,
  };
}

/**
 * The same, with the scale in feet per unit — the number the canvas holds.
 * PURE. Null/0/NaN scale → no_scale, same as above.
 */
export function measureShape(points, feetPerUnit) {
  const fpu = strictNumber(feetPerUnit);
  return measurePolygonPixels(points, fpu === null ? null : fpu * METRES_PER_FOOT);
}

// ── From the canvas back to the ground ──────────────────────────────────────
//
// The lawn tracer draws in viewBox units over a satellite still whose centre,
// zoom and scale are known (measureFromAddress). For the document the client
// receives, the outline has to be drawn on a FRESH still by Static Maps — a
// `path` of lat/lng vertices — and the takeoff has to carry vertices that
// lib/measure/lotArea.js can recompute an area from, the way the public
// polygon does. So the viewBox point goes back through the same "slice"
// placement canvasFeetPerUnit() describes, to an image pixel, and through the
// Web Mercator projection the still was rendered with, to a coordinate.
//
// Exact, not approximate: the still IS a Mercator tile at an integer zoom, so
// the inverse is the tile arithmetic itself. Verified round-trip in
// scripts/check-lawn-care.mjs — a rectangle 50 ft wide on the canvas comes
// back as vertices whose spherical area matches the canvas area to 1%.

const TILE_PX = 256;

/**
 * A viewBox point → { lat, lng }. PURE. Null when any input is missing.
 *
 * @param {{x:number,y:number}} point         viewBox units
 * @param {object} p
 * @param {{lat:number,lng:number}} p.center  the still's centre
 * @param {object} p.scaleInfo                the object from imageScale()
 * @param {number} [p.naturalWidth]           decoded size, for the aspect
 * @param {number} [p.naturalHeight]          correction canvasFeetPerUnit makes
 * @param {number} p.viewWidth
 * @param {number} p.viewHeight
 * @param {"slice"|"meet"} [p.fit]
 */
export function canvasPointToLatLng(
  point,
  { center, scaleInfo, naturalWidth, naturalHeight, viewWidth, viewHeight, fit = "slice" } = {},
) {
  const x = strictNumber(point?.x);
  const y = strictNumber(point?.y);
  const lat0 = strictNumber(center?.lat);
  const lng0 = strictNumber(center?.lng);
  const zoom = strictNumber(scaleInfo?.zoom);
  const scale = strictNumber(scaleInfo?.scale) ?? 1;
  let w = strictNumber(scaleInfo?.pixelWidth);
  let h = strictNumber(scaleInfo?.pixelHeight);
  const vw = strictNumber(viewWidth);
  const vh = strictNumber(viewHeight);
  if ([x, y, lat0, lng0, zoom, w, h, vw, vh].some((v) => v === null)) return null;
  if (w <= 0 || h <= 0 || vw <= 0 || vh <= 0 || !Number.isInteger(zoom)) return null;
  if (Math.abs(lat0) > MAX_MERCATOR_LAT) return null;

  // Same aspect correction as canvasFeetPerUnit, so a still whose declared
  // size was a guess is placed the way the canvas actually painted it.
  const natW = strictNumber(naturalWidth);
  const natH = strictNumber(naturalHeight);
  if (natW !== null && natW > 0 && natH !== null && natH > 0) {
    if (Math.abs(natW / natH - w / h) > (w / h) * 0.01) {
      w = natW;
      h = natH;
    }
  }

  // Where the image sits in the viewBox under the chosen fit.
  const k = fit === "meet" ? Math.min(vw / w, vh / h) : Math.max(vw / w, vh / h);
  const offX = (vw - w * k) / 2;
  const offY = (vh - h * k) / 2;
  // Image pixel, in the RETURNED image's pixels (scale already applied), then
  // the offset from the centre pixel. Divided by `scale` to get logical
  // Static Maps pixels, which is what the world size below is in.
  const px = (x - offX) / k;
  const py = (y - offY) / k;
  const dx = (px - w / 2) / scale;
  const dy = (py - h / 2) / scale;

  const world = TILE_PX * Math.pow(2, zoom);
  const lng = lng0 + (dx * 360) / world;
  const merc0 = Math.log(Math.tan(Math.PI / 4 + (lat0 * Math.PI) / 360));
  const cy0 = ((1 - merc0 / Math.PI) / 2) * world;
  const cy = cy0 + dy;
  const lat = ((2 * Math.atan(Math.exp(Math.PI * (1 - (2 * cy) / world))) - Math.PI / 2) * 180) / Math.PI;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/**
 * Every point of a traced shape → lat/lng vertices, or null if any point
 * fails to convert (a half-converted outline is not an outline).
 */
export function canvasShapeToLatLng(points, placement) {
  if (!Array.isArray(points) || points.length < 3) return null;
  const out = [];
  for (const p of points) {
    const ll = canvasPointToLatLng(p, placement);
    if (!ll) return null;
    out.push(ll);
  }
  return out;
}

// ── The keyless path the browser loads a still from ─────────────────────────
//
// Moved here from lib/measure/satellite.js (which still re-exports it) so the
// measure panels can build the path for a zoom the estimator just tapped
// WITHOUT a round trip: a zoom change is arithmetic on a request the browser
// already holds, and the only thing that should cost anything is the image
// itself. satellite.js's staticSatelliteUrl() reads the same fields, so the
// path that is built and the params the route parses stay one contract.

/**
 * The same-origin, keyless path for a still. PURE. Null when the request is
 * not one this file will vouch for (see normaliseImageRequest).
 *
 * `marker` is the one field outside the scale contract: a pin on the address,
 * which the roof still carries (the client sees which house was measured) and
 * the paving still deliberately does not (the pin sits on the driveway being
 * traced). It changes nothing about what a pixel measures.
 */
export function satelliteProxyPath(input = {}) {
  const req = normaliseImageRequest(input);
  if (!req) return null;
  const params = new URLSearchParams({
    format: "png",
    lat: String(req.lat),
    lng: String(req.lng),
    zoom: String(req.zoom),
    scale: String(req.scale),
    width: String(req.width),
    height: String(req.height),
  });
  if (input?.marker) params.set("marker", "1");
  return `/api/measure/satellite?${params.toString()}`;
}

/**
 * The request a still was made with, as the takeoff stores it — the six
 * numbers normaliseImageRequest() vouches for plus the marker flag — so a
 * reopened quote can rebuild the exact still its drawing was traced on from
 * arithmetic alone, with no geocode and no guess at the zoom. PURE. Null when
 * the input is not a measurable request.
 */
export function stillFrame(input = {}) {
  const req = normaliseImageRequest(input);
  if (!req) return null;
  return { ...req, marker: Boolean(input?.marker) };
}

// ── Ground → image → canvas (the inverse of canvasPointToLatLng) ────────────

/** Web Mercator y, in world pixels at `world` px across, for a latitude. */
function mercatorY(latDeg, world) {
  const merc = Math.log(Math.tan(Math.PI / 4 + (latDeg * Math.PI) / 360));
  return ((1 - merc / Math.PI) / 2) * world;
}

/**
 * Where a coordinate lands on a still, as an offset from the still's centre
 * in LOGICAL (scale-1) pixels — the units the frame's `width`/`height` are
 * in. PURE. Null for a missing input or a latitude outside Mercator.
 *
 * Exact for the same reason canvasPointToLatLng is: the still is a Mercator
 * tile at an integer zoom, so this is the tile arithmetic, not a
 * metres-per-degree approximation. The two share mercatorY() so they cannot
 * disagree by a rounding.
 */
export function latLngToFrameOffset(point, { center, zoom } = {}) {
  const lat = strictNumber(point?.lat ?? point?.latitude);
  const lng = strictNumber(point?.lng ?? point?.longitude);
  const lat0 = strictNumber(center?.lat ?? center?.latitude);
  const lng0 = strictNumber(center?.lng ?? center?.longitude);
  const z = strictNumber(zoom);
  if ([lat, lng, lat0, lng0, z].some((v) => v === null)) return null;
  if (!Number.isInteger(z)) return null;
  if (Math.abs(lat) > MAX_MERCATOR_LAT || Math.abs(lat0) > MAX_MERCATOR_LAT) return null;
  const world = TILE_PX * Math.pow(2, z);
  const dx = ((lng - lng0) * world) / 360;
  const dy = mercatorY(lat, world) - mercatorY(lat0, world);
  return Number.isFinite(dx) && Number.isFinite(dy) ? { dx, dy } : null;
}

/**
 * A { lat, lng } → viewBox point, through the same placement
 * canvasPointToLatLng() reads. PURE. Null when any input is missing.
 *
 * NOT clamped to the viewBox. A vertex traced at zoom 18 and re-projected to
 * zoom 20 can legitimately land outside the frame — the shape is bigger than
 * the picture now — and clamping it would move the corner of a driveway to
 * the edge of the screen and change its area. The canvas simply does not
 * draw the part that is off the picture; the measurement is unchanged.
 */
export function latLngToCanvasPoint(
  point,
  { center, scaleInfo, naturalWidth, naturalHeight, viewWidth, viewHeight, fit = "slice" } = {},
) {
  const zoom = strictNumber(scaleInfo?.zoom);
  const scale = strictNumber(scaleInfo?.scale) ?? 1;
  let w = strictNumber(scaleInfo?.pixelWidth);
  let h = strictNumber(scaleInfo?.pixelHeight);
  const vw = strictNumber(viewWidth);
  const vh = strictNumber(viewHeight);
  if ([zoom, w, h, vw, vh].some((v) => v === null)) return null;
  if (w <= 0 || h <= 0 || vw <= 0 || vh <= 0) return null;
  const off = latLngToFrameOffset(point, { center, zoom });
  if (!off) return null;

  const natW = strictNumber(naturalWidth);
  const natH = strictNumber(naturalHeight);
  if (natW !== null && natW > 0 && natH !== null && natH > 0) {
    if (Math.abs(natW / natH - w / h) > (w / h) * 0.01) {
      w = natW;
      h = natH;
    }
  }

  const k = fit === "meet" ? Math.min(vw / w, vh / h) : Math.max(vw / w, vh / h);
  const offX = (vw - w * k) / 2;
  const offY = (vh - h * k) / 2;
  // Logical offset → returned-image pixel (× scale) → viewBox unit (× k).
  const px = w / 2 + off.dx * scale;
  const py = h / 2 + off.dy * scale;
  const x = offX + px * k;
  const y = offY + py * k;
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

/**
 * The same drawing on a different still. PURE.
 *
 * Every traced vertex — and both ends of the manual reference line, if one
 * was drawn — goes canvas → lat/lng on the OLD placement and lat/lng →
 * canvas on the NEW one. The ground does not move when the estimator taps
 * "+", so the outline must not either: a driveway traced at zoom 18 is the
 * same driveway at zoom 19, drawn twice as large. The reference line's typed
 * length is kept as-is, because it is a fact about the ground (the garage
 * door is still 16 ft) and its pixel length changes with the zoom exactly as
 * the ground under it does, so the manual scale stays right too.
 *
 * Returns null — and the caller keeps the old drawing and the old still —
 * if any point fails to convert. A half-moved outline is not an outline.
 * Everything on the document and on each shape that is not a point
 * (surface, id, pattern, opacity) passes through untouched.
 *
 * @param {{scale?:object|null, shapes?:Array}} doc  a PolygonMeasure drawing
 * @param {object} from  placement the drawing was traced on (see canvasPointToLatLng)
 * @param {object} to    placement of the new still
 */
export function reprojectDrawing(doc, from, to) {
  if (!doc || typeof doc !== "object") return null;
  const move = (p) => {
    const ll = canvasPointToLatLng(p, from);
    return ll ? latLngToCanvasPoint(ll, to) : null;
  };
  const shapes = [];
  for (const shape of Array.isArray(doc.shapes) ? doc.shapes : []) {
    if (!shape || typeof shape !== "object") continue;
    const pts = Array.isArray(shape.points) ? shape.points.filter(isPoint) : [];
    const moved = [];
    for (const p of pts) {
      const m = move(p);
      if (!m) return null;
      moved.push(m);
    }
    shapes.push({ ...shape, points: moved });
  }
  let scale = doc.scale ?? null;
  if (scale && isPoint(scale.a) && isPoint(scale.b)) {
    const a = move(scale.a);
    const b = move(scale.b);
    if (!a || !b) return null;
    scale = { ...scale, a, b };
  }
  return { ...doc, shapes, scale };
}

// ── Framing a roof ──────────────────────────────────────────────────────────

/**
 * The zoom at which a bounding box fits inside a still, stepping OUT from
 * the requested zoom one level at a time and no further than `minZoom`.
 * PURE. Never steps in: a roof that fits at 19 is shown at 19 even if it
 * would also fit at 20, because the requested zoom is the framing the
 * caller chose and this only overrides it when the picture would clip.
 *
 * `margin` is the fraction of each half-side kept clear, so an eave does not
 * sit on the very last pixel: 0.08 leaves ~4 % of the frame on each side.
 *
 * Returns the requested zoom, unchanged, when the box is missing or
 * unreadable — no box is not a reason to zoom out — and `fits: false` with
 * `zoom: minZoom` when even the widest allowed frame clips (a farm shed row,
 * or a bounding box that is not one building), so the panel can say so.
 *
 * @param {object} p
 * @param {{sw:object, ne:object}} p.box  Solar's boundingBox, or { sw:{lat,lng}, ne:{lat,lng} }
 * @param {{lat:number,lng:number}} p.center  the still's centre (the pin)
 * @param {number} p.zoom  requested zoom
 * @param {number} [p.width]   logical px, default MAX_TILE_PX
 * @param {number} [p.height]  logical px, default MAX_TILE_PX
 * @param {number} [p.margin]
 * @param {number} [p.minZoom]
 * @returns {{zoom:number, requestedZoom:number, steppedOut:boolean, fits:boolean}}
 */
export function zoomToFitBox({
  box,
  center,
  zoom,
  width = MAX_TILE_PX,
  height = MAX_TILE_PX,
  margin = 0.08,
  minZoom = MIN_ZOOM,
} = {}) {
  const requested = strictNumber(zoom);
  const z0 = requested === null ? DEFAULT_ROOF_ZOOM : Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(requested)));
  const lo = Math.max(MIN_ZOOM, Math.min(z0, strictNumber(minZoom) ?? MIN_ZOOM));
  const unchanged = { zoom: z0, requestedZoom: z0, steppedOut: false, fits: true };

  const sw = box?.sw;
  const ne = box?.ne;
  if (!sw || !ne) return unchanged;
  const w = strictNumber(width) ?? MAX_TILE_PX;
  const h = strictNumber(height) ?? MAX_TILE_PX;
  const m = Math.min(0.5, Math.max(0, strictNumber(margin) ?? 0));
  const halfW = (w / 2) * (1 - m);
  const halfH = (h / 2) * (1 - m);

  for (let z = z0; z >= lo; z--) {
    const a = latLngToFrameOffset(sw, { center, zoom: z });
    const b = latLngToFrameOffset(ne, { center, zoom: z });
    if (!a || !b) return unchanged;
    const fits =
      Math.max(Math.abs(a.dx), Math.abs(b.dx)) <= halfW &&
      Math.max(Math.abs(a.dy), Math.abs(b.dy)) <= halfH;
    if (fits) return { zoom: z, requestedZoom: z0, steppedOut: z !== z0, fits: true };
  }
  return { zoom: lo, requestedZoom: z0, steppedOut: lo !== z0, fits: false };
}
