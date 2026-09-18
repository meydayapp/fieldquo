// lib/estimate/tracedArea.js
//
// The one shape a TRACED measurement takes on the public instant form,
// whatever the trade: the homeowner draws an outline on a live satellite map,
// the browser posts the VERTICES, and the server recomputes the area from
// them (lib/measure/lotArea.js) — the browser's readout is never the priced
// number (non-negotiable #5, applied to square feet).
//
// Lawn mowing has traced since the estimator shipped, under the measure key
// `lawn_polygon`. Paving is the second trade to trace — a driveway, a patio,
// a walkway — and rather than a `paving_polygon` beside it (a third would
// follow), the generic key is `area_polygon`: any trade priced by the square
// foot of ground it can see from above. `lawn_polygon` stays exactly as it
// was for mowing; the two share this module so they cannot drift.
//
// ── Why the still is built here and not in lib/measure ─────────────────────
//
// lib/measure/lawnEstimate.js already builds a Static Maps still with the
// lawn outline drawn on it (lawnOutlineImageUrl), in lawn green. The same
// picture for a driveway needs a different colour — a green fill over a
// driveway reads as "we think this is grass" on the document — and that
// module is a different agent's file this session. So the generic builder
// lives here with a colour argument, and lawnOutlineImageUrl should become a
// one-line call to it when that file is next open. Until then the two agree
// on every parameter but the colour, on purpose.

import { sphericalPolygonAreaSqft } from "@/lib/measure/lotArea";

/** The measure keys that arrive as a drawn outline. */
export const POLYGON_MEASURES = new Set(["lawn_polygon", "area_polygon"]);

/** Does this measure key mean "the homeowner traced it"? */
export function isPolygonMeasure(measure) {
  return POLYGON_MEASURES.has(measure);
}

// Static Maps path colours, 0xRRGGBBAA. Lawn keeps the green the tracer's
// map already draws; a paved surface is outlined in the same amber the roof
// panel uses for its footprint, so nothing on the still claims to be grass.
const OUTLINE_COLOURS = {
  lawn: { fill: "0x22c55e55", stroke: "0x15803dff" },
  area: { fill: "0xf59e0b55", stroke: "0xb45309ff" },
};

/**
 * The vertices the browser posted, as `{ lat, lng }` and nothing else.
 *
 * Accepts `{lat,lng}` objects or `[lat,lng]` pairs, the same two shapes
 * sphericalPolygonAreaM2 reads, and drops anything that is not a finite
 * coordinate. Capped at 200 points: a real outline is a dozen; a thousand is
 * a payload, not a driveway. Returns [] for anything under three points.
 */
export function normalisePolygon(polygon) {
  const pts = (Array.isArray(polygon) ? polygon : [])
    .map((p) =>
      Array.isArray(p)
        ? { lat: Number(p[0]), lng: Number(p[1]) }
        : { lat: Number(p?.lat), lng: Number(p?.lng) },
    )
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180)
    .slice(0, 200)
    // 1e-7 degrees is a centimetre. The draft stores these, the document
    // draws them, the still URL carries them; fifteen decimals of a drag
    // end-point is noise in all three places.
    .map((p) => ({ lat: Math.round(p.lat * 1e7) / 1e7, lng: Math.round(p.lng * 1e7) / 1e7 }));
  return pts.length >= 3 ? pts : [];
}

/**
 * A Static Maps satellite still with the outline drawn on it. Same public
 * key, size and scale as lib/measure/lawnEstimate.js lawnOutlineImageUrl
 * (and roofMeasurement's satelliteImageUrl), captured to Cloudinary at draft
 * time like every other still (lib/measure/satelliteCapture.js). Null with
 * no key or under three vertices.
 *
 * No center/zoom: Static Maps fits the frame to the path, so the whole shape
 * is in shot whatever its size.
 */
export function tracedOutlineImageUrl(vertices, { kind = "area", size = "640x400", scale = 2 } = {}) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const pts = normalisePolygon(vertices).slice(0, 120);
  if (!key || pts.length < 3) return null;
  const colour = OUTLINE_COLOURS[kind] || OUTLINE_COLOURS.area;
  const ring = [...pts, pts[0]].map((p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`).join("%7C");
  return (
    "https://maps.googleapis.com/maps/api/staticmap" +
    `?size=${size}&scale=${scale}&maptype=satellite` +
    `&path=fillcolor:${colour.fill}%7Ccolor:${colour.stroke}%7Cweight:3%7C${ring}` +
    `&key=${key}`
  );
}

/**
 * The measurement a traced outline produces, for any polygon trade. PURE
 * apart from the still URL's key.
 *
 *   { areaSqft, vertices, source, basis, estimated, satelliteImageUrl }
 *
 * `vertices` is the name the rest of the product already uses for a traced
 * outline (lawn care's measurement, the builder's `takeoff.lawn`, the
 * request route's sanitised snapshot), so the outline reaches the draft and
 * the document through the fields that exist rather than a `polygon` key
 * nothing downstream reads — which is exactly how lawn mowing's trace was
 * being dropped on the floor before this module.
 *
 * `kind` picks the outline colour on the still: "lawn" for lawn_polygon,
 * "area" for everything else.
 */
export function measureTracedArea(polygon, { kind = "area" } = {}) {
  const vertices = normalisePolygon(polygon);
  if (vertices.length < 3) return { ok: false, reason: "no_polygon" };
  const areaSqft = sphericalPolygonAreaSqft(vertices);
  if (!(areaSqft > 0)) return { ok: false, reason: "no_polygon" };
  return {
    ok: true,
    measurement: {
      areaSqft,
      vertices,
      source: "traced",
      basis: "traced",
      estimated: false,
      satelliteImageUrl: tracedOutlineImageUrl(vertices, { kind }),
    },
  };
}
