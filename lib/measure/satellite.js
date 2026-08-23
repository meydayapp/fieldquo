// lib/measure/satellite.js
//
// The imagery half of the paver measuring tool: an address in, a top-down
// aerial still out, plus the one number that makes the picture measurable —
// how many feet of ground each pixel of that image represents.
//
// The polygon half (tracing the patio and turning vertices into an area) is
// lib/measure/lotArea.js, which works in lat/lng and needs nothing from here.
// This file exists for the OTHER way an estimator works: drawing on a flat
// image and counting pixels. Both must agree, so the scale below is derived
// from the same Web Mercator model Google draws the tile with, not fitted.
//
// ── Why the scale is the dangerous part ─────────────────────────────────────
//
// A wrong image is obvious — it's the wrong house. A wrong SCALE is invisible:
// the picture looks right, the traced outline looks right, and every job comes
// out silently 15% short. Pavers are sold by the square foot with a 5% waste
// factor; a scale error smaller than the waste factor gets absorbed on the
// first few jobs and shows up as a mysteriously unprofitable year. So the
// formula below is spelled out term by term, and the constants are derived
// rather than copied.
//
// ── Degrading, never breaking ───────────────────────────────────────────────
//
// Same contract as roofMeasurement.js: every miss returns { ok: false, reason }
// or null, never a throw and never a NaN. A NaN scale is worse than no scale,
// because a NaN propagates into an area, an area into a price, and nothing
// along that path looks wrong until the invoice does.

import { serverMapsKey, geocodeAddress } from "@/lib/measure/roofMeasurement";

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
const METRES_PER_PIXEL_AT_ZOOM_0 =
  (2 * Math.PI * EARTH_EQUATORIAL_RADIUS_M) / TILE_SIZE_PX; // 156543.03392...

// Exact by international definition (1 ft = 0.3048 m), not an approximation.
const FEET_PER_METRE = 1 / 0.3048;
const SQFT_PER_M2 = FEET_PER_METRE * FEET_PER_METRE;

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
function strictNumber(value) {
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
 * non-numeric input.
 *
 * @param {number|string} latitude  degrees, WGS84
 * @param {number|string} zoom      integer, MIN_ZOOM..MAX_ZOOM
 * @param {number|string} [scale]   1 or 2
 * @returns {number|null} metres per pixel of the returned image
 */
export function metresPerPixel(latitude, zoom, scale = 1) {
  const lat = strictNumber(latitude);
  const z = strictNumber(zoom);
  const s = strictNumber(scale);

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
  const lat = strictNumber(input.lat);
  const lng = strictNumber(input.lng);
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

/**
 * The Static Maps URL, WITH THE SERVER KEY IN IT.
 *
 * ⚠ SERVER ONLY. This string must never be returned from an API route, put in
 * an <img src>, logged, or embedded in a PDF. roofMeasurement.satelliteImageUrl
 * deliberately does the opposite — it builds a browser-safe URL with the
 * referrer-restricted NEXT_PUBLIC key — and the two exist side by side because
 * they answer different questions. That key is restricted to fieldquo.com
 * referrers and would be rejected here anyway (server calls send no referrer),
 * which is why the measuring path uses the unrestricted server key and must
 * therefore keep it behind a proxy.
 *
 * @returns {string|null} null when unconfigured or the request is unmeasurable
 */
export function staticSatelliteUrl(input = {}, key = serverMapsKey()) {
  const req = normaliseImageRequest(input);
  if (!key || !req) return null;

  const params = new URLSearchParams({
    center: `${req.lat},${req.lng}`,
    zoom: String(req.zoom),
    size: `${req.width}x${req.height}`,
    scale: String(req.scale),
    maptype: "satellite",
    // PNG, not the default: JPEG artefacts smear the edge between a paver and
    // the lawn, which is the exact edge someone is about to trace.
    format: "png",
    key,
  });

  // No marker. A pin sits over the middle of the property and hides whatever is
  // underneath it, which on a driveway job is the thing being measured.
  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

/**
 * The same-origin, KEYLESS path the browser should load the image from.
 *
 * Lives here rather than in the route so the path that is built and the params
 * that are parsed can't drift apart — they are two halves of one contract, and
 * the half nobody looks at is the half that rots.
 *
 * @returns {string|null}
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
  return `/api/measure/satellite?${params.toString()}`;
}

/**
 * Fetch the image bytes server-side. Returns { ok: false, reason } on a miss.
 *
 * The content-type check is not belt-and-braces: on a key/quota/billing fault
 * Static Maps answers 403 with a PLAIN TEXT body explaining what is wrong with
 * the key. Passing that through to the browser as if it were the image would
 * publish a diagnostic about our credentials to whoever asked. Anything that
 * isn't an image is swallowed and reported as a generic upstream failure.
 *
 * @returns {Promise<{ok:true,bytes:ArrayBuffer,contentType:string}|{ok:false,reason:string,status?:number}>}
 */
export async function fetchSatelliteImage(input = {}, key = serverMapsKey()) {
  if (!key) return { ok: false, reason: "no_key" };
  const url = staticSatelliteUrl(input, key);
  if (!url) return { ok: false, reason: "bad_request" };

  try {
    const res = await fetch(url);
    const contentType = res.headers.get("content-type") || "";
    if (!res.ok || !contentType.startsWith("image/")) {
      console.error(
        `[measure/satellite] Static Maps returned ${res.status} ${contentType || "(no content-type)"}`,
      );
      return { ok: false, reason: "imagery_unavailable", status: res.status };
    }
    return { ok: true, bytes: await res.arrayBuffer(), contentType };
  } catch (err) {
    console.error("[measure/satellite] Static Maps fetch failed:", err);
    return { ok: false, reason: "imagery_unavailable" };
  }
}

/**
 * The one call a caller wants: address in, a measurable aerial out.
 *
 * Returns the SCALE and a keyless proxy path — never the image bytes and never
 * a Google URL. The caller renders <img src={result.image.url}> and holds
 * result.scale to convert whatever gets traced on it.
 *
 * Reuses roofMeasurement's geocoder rather than adding a second way to call
 * Google: one key resolver, one geocode response shape, one place to fix when
 * Google changes something.
 *
 * @param {string} address
 * @param {{zoom?:number,scale?:number,width?:number,height?:number}} [options]
 * @returns {Promise<object>} { ok: true, ... } or { ok: false, reason }
 */
export async function measureFromAddress(address, options = {}) {
  const key = serverMapsKey();
  if (!key) return { ok: false, reason: "no_key" };
  if (typeof address !== "string" || address.trim() === "") {
    return { ok: false, reason: "no_address" };
  }

  const geo = await geocodeAddress(address.trim(), key);
  if (!geo) return { ok: false, reason: "geocode_failed" };

  const request = {
    lat: geo.lat,
    lng: geo.lng,
    zoom: options.zoom ?? DEFAULT_ZOOM,
    scale: options.scale ?? DEFAULT_SCALE,
    width: options.width ?? MAX_TILE_PX,
    height: options.height ?? MAX_TILE_PX,
  };

  const scale = imageScale(request);
  const url = satelliteProxyPath(request);
  // Geocoding succeeded but the point is unmeasurable (a Mercator-excluded
  // latitude, essentially). No image, no invented scale.
  if (!scale || !url) {
    return {
      ok: false,
      reason: "unmeasurable_location",
      formattedAddress: geo.formattedAddress,
      location: { lat: geo.lat, lng: geo.lng },
    };
  }

  return {
    ok: true,
    source: "google_static_maps",
    formattedAddress: geo.formattedAddress,
    location: { lat: geo.lat, lng: geo.lng },
    // A non-ROOFTOP geocode means the pin may be on the street rather than the
    // property. The image is still fine to trace; the caller should say so, and
    // let the estimator pan before drawing.
    precise: geo.precise,
    image: {
      url,
      width: scale.pixelWidth,
      height: scale.pixelHeight,
    },
    scale,
  };
}
