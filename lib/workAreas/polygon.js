// lib/workAreas/polygon.js
//
// The drawn zone, as the browser sent it, made safe to store and to draw.
//
// A polygon arrives from the Maps drawing tool as a ring of vertices. This
// is the boundary between "what a browser sent" and "what is written to
// WorkArea.polygon": every vertex must be a finite latitude and longitude in
// range, there must be at least three (two points are a line, one is a pin),
// and there is a ceiling so a hostile client cannot store a megabyte of
// vertices under a Json column. Coordinates are rounded to six decimals —
// about 11 cm, the precision every other coordinate column in the schema
// keeps.
//
// Nothing else reads the polygon yet. Settings → Work areas draws it and
// that is all; no dispatch, filter or price is derived from it. When
// something does, it should read `normalisePolygon` output, never the raw
// column.

/** More vertices than this is not a zone somebody drew by hand. */
export const MAX_VERTICES = 500;

const round6 = (n) => Math.round(n * 1e6) / 1e6;

/**
 * @param input  anything the browser sent as `polygon`.
 * @returns {{ ok:true, polygon:Array<{lat:number,lng:number}>|null } | { ok:false, error:string }}
 *   `polygon: null` means "clear it" — the one non-array value accepted.
 */
export function normalisePolygon(input) {
  if (input === null) return { ok: true, polygon: null };
  if (!Array.isArray(input)) return { ok: false, error: "polygon must be a list of points, or null to clear it." };
  if (input.length > MAX_VERTICES) return { ok: false, error: `polygon may have at most ${MAX_VERTICES} points.` };
  const out = [];
  for (const p of input) {
    const lat = Number(p?.lat);
    const lng = Number(p?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return { ok: false, error: "every point needs a numeric lat and lng." };
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return { ok: false, error: "a point is outside the world." };
    }
    out.push({ lat: round6(lat), lng: round6(lng) });
  }
  // A closing vertex equal to the first is how some tools emit a ring; it
  // is dropped so the count below means distinct corners.
  if (out.length > 1) {
    const a = out[0];
    const z = out[out.length - 1];
    if (a.lat === z.lat && a.lng === z.lng) out.pop();
  }
  if (out.length < 3) return { ok: false, error: "a zone needs at least three points." };
  return { ok: true, polygon: out };
}

/**
 * A stored polygon as the map can draw it, or null. Tolerates whatever an
 * old row holds: anything that does not normalise is treated as not drawn
 * rather than crashing the settings page.
 */
export function readPolygon(stored) {
  const r = normalisePolygon(stored ?? null);
  return r.ok ? r.polygon : null;
}
