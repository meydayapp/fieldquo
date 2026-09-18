// lib/measure/satellite.js
//
// The imagery half of the paver measuring tool: an address in, a top-down
// aerial still out, plus the one number that makes the picture measurable —
// how many feet of ground each pixel of that image represents.
//
// The polygon half (tracing the patio and turning vertices into an area) is
// lib/measure/lotArea.js, which works in lat/lng and needs nothing from here.
// This file exists for the OTHER way an estimator works: drawing on a flat
// image and counting pixels. Both must agree, so the scale is derived from
// the same Web Mercator model Google draws the tile with, not fitted — in
// lib/measure/imageScale.js, which this file re-exports.
//
// ── Why the scale is the dangerous part ─────────────────────────────────────
//
// A wrong image is obvious — it's the wrong house. A wrong SCALE is invisible:
// the picture looks right, the traced outline looks right, and every job comes
// out silently 15% short. Pavers are sold by the square foot with a 5% waste
// factor; a scale error smaller than the waste factor gets absorbed on the
// first few jobs and shows up as a mysteriously unprofitable year. So the
// formula in imageScale.js is spelled out term by term, and the constants are
// derived rather than copied.
//
// ── Degrading, never breaking ───────────────────────────────────────────────
//
// Same contract as roofMeasurement.js: every miss returns { ok: false, reason }
// or null, never a throw and never a NaN. A NaN scale is worse than no scale,
// because a NaN propagates into an area, an area into a price, and nothing
// along that path looks wrong until the invoice does.

import { serverMapsKey, geocodeAddress } from "@/lib/measure/roofMeasurement";
import {
  MAX_MERCATOR_LAT,
  MIN_ZOOM,
  MAX_ZOOM,
  DEFAULT_ZOOM,
  MAX_TILE_PX,
  MIN_TILE_PX,
  ALLOWED_SCALES,
  DEFAULT_SCALE,
  metresPerPixel,
  feetPerPixel,
  normaliseImageRequest,
  imageScale,
  pixelsToFeet,
  pixelAreaToSqft,
} from "@/lib/measure/imageScale";

// ── The maths lives in imageScale.js now ────────────────────────────────────
//
// Web Mercator, the zoom band, the request clamp and the pixel→feet
// conversions moved to lib/measure/imageScale.js, which imports nothing from
// the server side, so the drawing canvas can compute the scale of the image
// it was handed instead of asking the estimator to draw a reference line on
// a tile whose resolution was already known. They are re-exported here
// unchanged: this file is the server's entry point and its callers — the
// route, roofMeasurement's neighbours, the check scripts — keep importing
// what they always did. The derivations and the worked examples are over
// there with the code, where a reader of the formula will find them.
export {
  MAX_MERCATOR_LAT,
  MIN_ZOOM,
  MAX_ZOOM,
  DEFAULT_ZOOM,
  MAX_TILE_PX,
  MIN_TILE_PX,
  ALLOWED_SCALES,
  DEFAULT_SCALE,
  metresPerPixel,
  feetPerPixel,
  normaliseImageRequest,
  imageScale,
  pixelsToFeet,
  pixelAreaToSqft,
};

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
