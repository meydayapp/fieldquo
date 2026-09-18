// scripts/scrape/lib/geo.mjs
//
// Where to point the map: a location as a bounding box, and the box as a
// grid of viewports.
//
// ══ The 120-place boundary and why the box is tiled ════════════════════════
//
// Google Maps shows at most about 120 places for one search in one map
// view, however far the list is scrolled — the compass/crawler-google-places
// actor's readme calls it the limit of "a single map screen with a finite
// scroll", and its answer to "an entire county or state" is to cover the
// area viewport by viewport and dedupe by place id. This module does that:
// a location becomes a bounding box (Google's geocoder, the browser's own
// answer, or the static table below), the box becomes tiles at a zoom where
// one viewport is a few kilometres across, and a tile whose feed reaches
// the boundary is SATURATED — it is split into four at the next zoom and
// read again, because 120 in a 7 km square means there were more.
//
// A small place ("Lakeside, CA") is one tile and one "<term> in <location>"
// search, exactly as a person would type it.
import { serverMapsKey } from "@/lib/measure/roofMeasurement";

/** Viewport width, in pixels, of the MAP beside Maps' results panel at the
 *  window size browser.mjs opens. The panel is ~408 px wide. */
export const MAP_VIEW_PX = { width: 870, height: 900 };
export const DEFAULT_TILE_ZOOM = 14;
export const MAX_TILE_ZOOM = 17;
/** Below this diagonal a location is one search, not a grid. */
export const SINGLE_TILE_DIAGONAL_KM = 12;
/** A feed that reaches this many places is at the boundary. */
export const FEED_BOUNDARY = 120;
/** Neighbouring tiles overlap by this fraction so nothing on a seam is
 *  missed; the place id dedupes what both see. */
export const TILE_OVERLAP = 0.15;

/** Static boxes for whole states and provinces — the cases a geocoder
 *  answers with a viewport too, but which should not need a request. */
export const REGION_BOUNDS = Object.freeze({
  "california": { south: 32.53, west: -124.48, north: 42.01, east: -114.13 },
  "new york": { south: 40.49, west: -79.76, north: 45.02, east: -71.85 },
  "texas": { south: 25.84, west: -106.65, north: 36.5, east: -93.51 },
  "florida": { south: 24.4, west: -87.63, north: 31.0, east: -80.03 },
  "washington": { south: 45.54, west: -124.85, north: 49.0, east: -116.92 },
  "arizona": { south: 31.33, west: -114.82, north: 37.0, east: -109.04 },
  "nevada": { south: 35.0, west: -120.01, north: 42.0, east: -114.04 },
  "oregon": { south: 41.99, west: -124.57, north: 46.29, east: -116.46 },
  "quebec": { south: 44.99, west: -79.76, north: 62.59, east: -57.1 },
  "québec": { south: 44.99, west: -79.76, north: 62.59, east: -57.1 },
  "ontario": { south: 41.68, west: -95.16, north: 56.86, east: -74.34 },
  "british columbia": { south: 48.3, west: -139.06, north: 60.0, east: -114.03 },
  "alberta": { south: 49.0, west: -120.0, north: 60.0, east: -110.0 },
  "san diego county": { south: 32.53, west: -117.6, north: 33.51, east: -116.08 },
});

export function distanceKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function diagonalKm(bounds) {
  return distanceKm({ lat: bounds.south, lng: bounds.west }, { lat: bounds.north, lng: bounds.east });
}

/** Metres per pixel of a Web Mercator map at this zoom and latitude. */
export function metresPerPixel(zoom, lat) {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
}

/** A viewport's footprint in kilometres at this zoom and latitude. */
export function viewportKm(zoom, lat, view = MAP_VIEW_PX) {
  const mpp = metresPerPixel(zoom, lat);
  return { width: (mpp * view.width) / 1000, height: (mpp * view.height) / 1000 };
}

/** The box a viewport centred here covers. */
export function tileBounds(lat, lng, zoom, view = MAP_VIEW_PX) {
  const km = viewportKm(zoom, lat, view);
  const dLat = km.height / 2 / 111;
  const dLng = km.width / 2 / (111 * Math.max(0.05, Math.cos((lat * Math.PI) / 180)));
  return { south: lat - dLat, west: lng - dLng, north: lat + dLat, east: lng + dLng };
}

/**
 * Cover a box with viewports at `zoom`. Pure. Tiles are row-major from the
 * south-west; each carries its own bounds and a key for the log.
 */
export function tilesFor(bounds, { zoom = DEFAULT_TILE_ZOOM, view = MAP_VIEW_PX, overlap = TILE_OVERLAP } = {}) {
  const midLat = (bounds.south + bounds.north) / 2;
  const km = viewportKm(zoom, midLat, view);
  const stepLat = (km.height * (1 - overlap)) / 111;
  const stepLng = (km.width * (1 - overlap)) / (111 * Math.max(0.05, Math.cos((midLat * Math.PI) / 180)));
  const tiles = [];
  const rows = Math.max(1, Math.ceil((bounds.north - bounds.south) / stepLat));
  const cols = Math.max(1, Math.ceil((bounds.east - bounds.west) / stepLng));
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const lat = Math.min(bounds.north, bounds.south + stepLat * (r + 0.5));
      const lng = Math.min(bounds.east, bounds.west + stepLng * (c + 0.5));
      tiles.push({ lat: round6(lat), lng: round6(lng), zoom, row: r, col: c, depth: 0, key: tileKey(lat, lng, zoom), bounds: tileBounds(lat, lng, zoom, view) });
    }
  }
  return tiles;
}

/** Four children at the next zoom for a tile that hit the boundary. */
export function subdivide(tile, { view = MAP_VIEW_PX } = {}) {
  if (tile.zoom >= MAX_TILE_ZOOM) return [];
  const zoom = tile.zoom + 1;
  const b = tile.bounds;
  const midLat = (b.south + b.north) / 2;
  const midLng = (b.west + b.east) / 2;
  const q = [
    { lat: (b.south + midLat) / 2, lng: (b.west + midLng) / 2 },
    { lat: (b.south + midLat) / 2, lng: (midLng + b.east) / 2 },
    { lat: (midLat + b.north) / 2, lng: (b.west + midLng) / 2 },
    { lat: (midLat + b.north) / 2, lng: (midLng + b.east) / 2 },
  ];
  return q.map((p, i) => ({
    lat: round6(p.lat),
    lng: round6(p.lng),
    zoom,
    row: tile.row,
    col: tile.col,
    depth: (tile.depth || 0) + 1,
    quadrant: i,
    parent: tile.key,
    key: tileKey(p.lat, p.lng, zoom),
    bounds: tileBounds(p.lat, p.lng, zoom, view),
  }));
}

export function tileKey(lat, lng, zoom) {
  return `${round6(lat)},${round6(lng)},${zoom}z`;
}

function round6(n) {
  return Math.round(Number(n) * 1e6) / 1e6;
}

/** The Maps URL for one search in one viewport. */
export function tileSearchUrl(term, tile, { lang = "en" } = {}) {
  return `https://www.google.com/maps/search/${encodeURIComponent(term).replace(/%20/g, "+")}/@${tile.lat},${tile.lng},${tile.zoom}z?hl=${lang}`;
}

/** The Maps URL for "<term> in <location>" — the single-tile case. */
export function textSearchUrl(term, location, { lang = "en" } = {}) {
  const q = `${term} in ${location}`;
  return `https://www.google.com/maps/search/${encodeURIComponent(q).replace(/%20/g, "+")}?hl=${lang}`;
}

/** A static box for a region name, if the table knows it. */
export function regionBounds(location) {
  const key = String(location ?? "").toLowerCase().replace(/,?\s*(usa|united states|canada|us|ca)\s*$/i, "").trim();
  return REGION_BOUNDS[key] || null;
}

/**
 * Google's geocoder, for the viewport of a place name. Returns null on any
 * failure — the caller then asks the browser. One request per location per
 * run, at the geocoder's list price of $5/1,000 (0.5¢), on the same key
 * lib/measure/roofMeasurement.js uses.
 */
export async function geocodeBounds(location, { key = serverMapsKey(), fetchImpl = fetch, region = null } = {}) {
  if (!key || !location) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}${region ? `&region=${region.toLowerCase()}` : ""}&key=${key}`;
    const res = await fetchImpl(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== "OK" || !data.results?.length) return null;
    const top = data.results[0];
    const g = top.geometry || {};
    const box = g.bounds || g.viewport;
    if (!box?.southwest || !box?.northeast) return null;
    return {
      bounds: { south: box.southwest.lat, west: box.southwest.lng, north: box.northeast.lat, east: box.northeast.lng },
      center: g.location ? { lat: g.location.lat, lng: g.location.lng } : null,
      formatted: top.formatted_address || location,
      via: "geocoder",
    };
  } catch {
    return null;
  }
}

/**
 * The bounds Maps itself frames a place in: open /maps/place/<location>,
 * read "@lat,lng,Nz" from the URL it settles on, and turn the zoom into a
 * box. No key and no request beyond the page the run was going to open
 * anyway.
 */
export function boundsFromMapsUrl(url, view = MAP_VIEW_PX) {
  const m = String(url).match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(\d+(?:\.\d+)?)z/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  const zoom = Number(m[3]);
  if (![lat, lng, zoom].every(Number.isFinite)) return null;
  return { bounds: tileBounds(lat, lng, zoom, view), center: { lat, lng }, zoom, via: "maps_url" };
}

/**
 * Plan the viewports for one (term, location): a single text search, or a
 * grid. Pure given the bounds.
 */
export function planViewports({ location, bounds = null, zoom = DEFAULT_TILE_ZOOM, force = null }) {
  const single = force === "single" || (force !== "tiles" && (!bounds || diagonalKm(bounds) <= SINGLE_TILE_DIAGONAL_KM));
  if (single) return { mode: "single", location, tiles: [], diagonalKm: bounds ? Number(diagonalKm(bounds).toFixed(1)) : null };
  return { mode: "tiles", location, tiles: tilesFor(bounds, { zoom }), diagonalKm: Number(diagonalKm(bounds).toFixed(1)) };
}
