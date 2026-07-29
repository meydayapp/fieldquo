// lib/measure/lotArea.js
//
// Ground area from a polygon the user drew on a satellite map — for lawn care,
// landscaping, sealcoating, anything priced by the square foot of ground.
//
// ── Why a polygon, not an address lookup ────────────────────────────────────
//
// Google's Solar API models roofs, not yards. There is no "lawn area" endpoint
// anywhere, because a lawn has no crisp machine-detectable boundary — it's the
// grass minus the driveway minus the flower beds, a judgement only a human
// looking at the image can make. So the homeowner traces it on the map and we
// compute the area of what they traced. That also makes the number honest: the
// client agreed to the boundary the price is based on.
//
// ── Why the SERVER recomputes it ────────────────────────────────────────────
//
// The browser can compute this too (Google's geometry.spherical.computeArea),
// and does, for the live readout while dragging. But the price must never trust
// a number the browser sent — same rule as money (non-negotiable #5). The
// browser posts the VERTICES; the server recomputes the area from them with
// this function and prices off its own result. A tampered area is then just a
// tampered polygon, visible on the very map the estimate shows.

const EARTH_RADIUS_M = 6378137; // WGS84 equatorial radius, as Google uses
const SQFT_PER_M2 = 10.7639104;

function toRad(deg) {
  return (Number(deg) || 0) * (Math.PI / 180);
}

/**
 * Area of a simple polygon on the sphere, in square metres. PURE.
 *
 * Same algorithm as Google Maps' spherical.computeArea, so the server's number
 * matches the browser's live readout to the metre. Uses the signed spherical
 * excess of each edge; the absolute value drops winding direction, so a polygon
 * drawn clockwise or counter-clockwise gives the same area.
 *
 * Returns 0 for anything that isn't a closed ring of ≥3 points — a degenerate
 * shape has no area, and that's exactly what a caller wants to reject before
 * pricing off it.
 */
export function sphericalPolygonAreaM2(points) {
  if (!Array.isArray(points) || points.length < 3) return 0;

  // Accept either {lat,lng} objects or [lat,lng] pairs.
  const ring = points
    .map((p) =>
      Array.isArray(p)
        ? { lat: Number(p[0]), lng: Number(p[1]) }
        : { lat: Number(p?.lat), lng: Number(p?.lng) },
    )
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

  if (ring.length < 3) return 0;

  let total = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    total +=
      (toRad(b.lng) - toRad(a.lng)) *
      (2 + Math.sin(toRad(a.lat)) + Math.sin(toRad(b.lat)));
  }
  const area = (total * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2;
  return Math.abs(area);
}

/** Same, in square feet, rounded to a whole foot. */
export function sphericalPolygonAreaSqft(points) {
  return Math.round(sphericalPolygonAreaM2(points) * SQFT_PER_M2);
}
