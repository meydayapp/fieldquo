// lib/estimate/report/mapOverlay.js
//
// The outline drawn over the satellite still on the report's property map.
//
// ── What is projected onto what ─────────────────────────────────────────────
//
// The still a homeowner was shown is a Static Maps image centred on the
// property at a known zoom, captured to Cloudinary by
// lib/measure/satelliteCapture.js. The capture keeps the Google request under
// `satelliteSourceUrl`, and that URL carries everything needed to place a
// lat/lng on the picture: `center`, `zoom`, `size` and `scale`. This module
// parses those with imageScale.js's own parser and runs the FORWARD Web
// Mercator projection — the inverse of canvasPointToLatLng() in the same file
// — so a traced polygon lands on the pixels it was traced over.
//
// The polygon's vertices are read from `measurement.polygon` (the traced
// trades — paving, lawn) or `measurement.vertices` (lawn care's outline),
// whichever the draft carries, as [{ lat, lng }].
//
// A lawn still built by lawnOutlineImageUrl() has no centre or zoom (Static
// Maps fitted the frame to the path itself) and already has the outline drawn
// in by Google, so this module answers null and the page shows the still
// alone. Same for a still whose URL cannot be parsed, or a polygon under three
// points: null, never a guess of where the outline goes.
//
// Pure. scripts/check-estimate-report.mjs round-trips a projected point back
// through canvasPointToLatLng and asserts it lands within a pixel.

import { parseStaticMapUrl, MAX_MERCATOR_LAT } from "@/lib/measure/imageScale";

const TILE_PX = 256;

function num(v) {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** The vertices the draft carries for an outline, or an empty list. */
export function outlineVertices(measurement) {
  const raw = Array.isArray(measurement?.polygon)
    ? measurement.polygon
    : Array.isArray(measurement?.vertices)
      ? measurement.vertices
      : [];
  const out = [];
  for (const p of raw) {
    const lat = num(p?.lat);
    const lng = num(p?.lng);
    if (lat === null || lng === null || Math.abs(lat) > MAX_MERCATOR_LAT) continue;
    out.push({ lat, lng });
  }
  return out;
}

/** World pixel of a lat/lng at a zoom (logical Static Maps pixels). */
function worldPixel(lat, lng, zoom) {
  const world = TILE_PX * Math.pow(2, zoom);
  const x = ((lng + 180) / 360) * world;
  const merc = Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  const y = ((1 - merc / Math.PI) / 2) * world;
  return { x, y };
}

/**
 * The outline in image pixels, or null.
 *
 * @param measurement  the draft's estimateData.measurement
 * @returns {{ width, height, points: {x,y}[] }|null}
 *          width/height are the RETURNED image's pixel size (scale applied),
 *          so the SVG viewBox is the picture and the points sit inside it.
 */
export function satelliteOutline(measurement) {
  if (!measurement || typeof measurement !== "object") return null;
  const still = measurement.satelliteSourceUrl || measurement.satelliteImageUrl;
  const parsed = parseStaticMapUrl(still);
  if (!parsed || parsed.zoom === null || !Number.isInteger(parsed.zoom)) return null;
  if (!(parsed.width > 0) || !(parsed.height > 0)) return null;
  const scale = parsed.scale === 2 ? 2 : 1;

  const vertices = outlineVertices(measurement);
  if (vertices.length < 3) return null;

  const centre = worldPixel(parsed.lat, parsed.lng, parsed.zoom);
  const width = parsed.width * scale;
  const height = parsed.height * scale;
  const points = vertices.map(({ lat, lng }) => {
    const p = worldPixel(lat, lng, parsed.zoom);
    return {
      x: Math.round(((p.x - centre.x) + parsed.width / 2) * scale * 100) / 100,
      y: Math.round(((p.y - centre.y) + parsed.height / 2) * scale * 100) / 100,
    };
  });

  // An outline entirely off the picture is one the still was not framed for
  // — the wrong image for this polygon. Null rather than a shape drawn in the
  // margin the viewer cannot see.
  const inside = points.some((p) => p.x >= 0 && p.x <= width && p.y >= 0 && p.y <= height);
  if (!inside) return null;

  return { width, height, points };
}

/** SVG points attribute for a polygon, e.g. "12.5,40 80,40 80,90". */
export function outlinePointsAttr(outline) {
  if (!outline) return "";
  return outline.points.map((p) => `${p.x},${p.y}`).join(" ");
}
