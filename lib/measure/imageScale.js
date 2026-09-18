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
 * Default zoom for a residential lot: 20.
 *
 * Worked through at 45°N (roughly Ottawa/Minneapolis — the middle of this
 * product's market) with the default 640×640 @ scale 2:
 *
 *   metres per pixel  = 156543.03392 · cos(45°) / 2^20 / 2  = 0.0528 m/px
 *   feet per pixel                                          = 0.173 ft/px  (≈2 in)
 *   ground covered    = 640 logical px · 0.1056 m           = 67.6 m ≈ 222 ft
 *
 * 222 ft square comfortably contains a typical 50–80 ft × 100–150 ft suburban
 * lot with the neighbours' driveways for context, and 2 inches per pixel means
 * a 3 ft garden path is 18 px wide — thick enough to trace accurately with a
 * finger on a phone. Zoom 21 doubles the resolution but halves the frame to
 * ~111 ft, which crops a normal driveway, and is unavailable outside major
 * cities. Zoom 19 fits an acre but drops to 4 in/px, where the edge of a paver
 * course is a judgement call.
 */
export const DEFAULT_ZOOM = 20;

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
