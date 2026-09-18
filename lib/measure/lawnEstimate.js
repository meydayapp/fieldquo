// lib/measure/lawnEstimate.js
//
// An estimated lawn size from an ADDRESS, with no tracing — and the trace as
// the correction when the homeowner (or the estimator) knows better.
//
// ══ Google has no lawn endpoint ═══════════════════════════════════════════
//
// Solar models roofs; nothing models grass. What CAN be had for free is the
// lot: a municipal parcel polygon, where a city publishes one. From there:
//
//     lawn ≈ parcel area − roof footprint − a driveway allowance
//
// The roof footprint is Solar's `groundAreaMeters2` — the shadow the house
// throws, which lib/measure/roofMeasurement.js already fetches for the
// roofing and gutter estimates, so this costs no second Solar request when a
// roof was already measured. The driveway is a stated constant
// (DRIVEWAY_ALLOWANCE_SQFT), because no free source draws driveways and a
// number that is the same for every house is at least honest about being a
// guess. Sheds, decks, pools and flower beds are not subtracted — they are
// exactly what the trace is for.
//
// ══ Which cities have a parcel layer ══════════════════════════════════════
//
// Researched 2026-09-17 against the live services:
//
//   · GATINEAU — yes. The city's own production GIS, the back end of its
//     public "Géoportail urbanisme", serves lot polygons with no token:
//     portailgis.gatineau.ca/arcgis/rest/services/Matrice/MatricModernFeatur/
//     MapServer/4 ("Lot de la matrice", Cadastre du Québec lot number,
//     matricule, Shape.STArea() in m²). Verified with a point-in-polygon
//     query at 35 Rue de Villebois: one feature, 5 vertices, 2,935.75 m².
//   · OTTAWA — no. geoOttawa draws parcels, but the layer is Teranet-
//     licensed to the City and served through a referer-checked proxy;
//     maps.ottawa.ca's Property_Parcels service answers "Token Required" and
//     the open-data hub (services.arcgis.com/G6F8XLCl5KtAlZ2G) carries no
//     parcel, property or PIN layer at all. Only address POINTS are open.
//     The provider below says so rather than pretending — a company that
//     licenses Teranet/MPAC data adds a fetch here and nothing else changes.
//   · QUÉBEC (province) — no. The MERN cadastre is behind Infolot (captcha
//     and licence), Données Québec has no lot dataset, and the MSP WFS
//     carries no cadastral feature type.
//
// Everywhere else — and in Ottawa — the estimate falls back to the company's
// MINIMUM PRICING BAND (1,500 sq ft by default; see lib/estimate/lawnCare.js
// on why that figure is a band and not a measurement) and SAYS SO: the panel
// reads "estimated — trace your lawn to correct it", never "1,500 sq ft
// measured". `source` records which of the three produced the figure, and it
// travels onto the draft, the lead and the takeoff.
//
// ══ Verdicts, like gutters ════════════════════════════════════════════════
//
// A figure can be produced for a strip mall. lawnFlags() refuses the ones
// that cannot be a house — a roof over MAX_PLAUSIBLE_HOUSE_ROOF_SQFT, a lot
// over MAX_PLAUSIBLE_LOT_SQFT, a lawn over MAX_INSTANT_LAWN_SQFT — with
// `trustworthy: false`, and the estimator refuses with needs_site_visit
// exactly as estimateGutters does. 35 Rue de Villebois, Gatineau sits in an
// industrial park: the lot is real, the building is not a house, and the
// honest output is a visit.
//
// Pure except estimateLawn() and the provider fetches.

import { measureRoof, satelliteImageUrl } from "@/lib/measure/roofMeasurement";
import { MAX_PLAUSIBLE_HOUSE_ROOF_SQFT } from "@/lib/measure/gutterMeasurement";
import { sphericalPolygonAreaSqft } from "@/lib/measure/lotArea";
import { LAWN_MIN_SQFT_DEFAULT, MAX_INSTANT_LAWN_SQFT } from "@/lib/estimate/lawnCare";

const SQFT_PER_M2 = 10.7639104;

/**
 * A two-car driveway is 20 × 30 ft (600 sq ft); a front walk adds about
 * 100. Stated once, subtracted from every parcel-derived figure, never from
 * a trace.
 */
export const DRIVEWAY_ALLOWANCE_SQFT = 700;

/** A lot over two acres is not a suburban lawn-care property. */
export const MAX_PLAUSIBLE_LOT_SQFT = 2 * 43560;

/** A traced polygon under this is a mis-click, not a lawn. */
export const MIN_TRACED_LAWN_SQFT = 200;

export const LAWN_SOURCE = {
  PARCEL_GATINEAU: "parcel_gatineau",
  TRACED: "traced",
  MINIMUM: "minimum",
};

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/* ── Parcel providers ──────────────────────────────────────────────────────── */

const GATINEAU_LOT_LAYER =
  "https://portailgis.gatineau.ca/arcgis/rest/services/Matrice/MatricModernFeatur/MapServer/4/query";

// The two cities face each other across the Ottawa River, and their bounding
// boxes overlap: 204 Avro Cir (Ottawa, north of the Queensway) sits inside
// any box drawn around Gatineau, and the first run of this file sent it to
// the Gatineau layer, which correctly found nothing. The river IS the
// provincial border, so the province in the geocoded address decides, and
// the box only keeps a Sherbrooke address from asking Gatineau.
function province(formattedAddress) {
  const m = /,\s*(ON|QC)\b/.exec(String(formattedAddress || ""));
  return m ? m[1] : null;
}

/** Rough extent of the Ville de Gatineau (Aylmer to Masson-Angers), Québec side. */
function inGatineau({ lat, lng, formattedAddress }) {
  return province(formattedAddress) === "QC" && lat >= 45.38 && lat <= 45.65 && lng >= -76.06 && lng <= -75.42;
}

/** Rough extent of the City of Ottawa's urban area, Ontario side. */
function inOttawa({ lat, lng, formattedAddress }) {
  return province(formattedAddress) === "ON" && lat >= 45.15 && lat <= 45.55 && lng >= -76.35 && lng <= -75.25;
}

/** An ArcGIS ring ([[lng,lat],...]) → [{lat,lng}], closing duplicate dropped. */
export function ringToVertices(ring) {
  if (!Array.isArray(ring)) return [];
  const pts = ring
    .map((p) => (Array.isArray(p) ? { lat: Number(p[1]), lng: Number(p[0]) } : null))
    .filter((p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (pts.length > 1) {
    const a = pts[0];
    const z = pts[pts.length - 1];
    if (a.lat === z.lat && a.lng === z.lng) pts.pop();
  }
  return pts;
}

async function fetchGatineauParcel({ lat, lng }) {
  const url =
    `${GATINEAU_LOT_LAYER}?geometry=${encodeURIComponent(`${lng},${lat}`)}` +
    "&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects" +
    "&outFields=*&returnGeometry=true&outSR=4326&f=json";
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { ok: false, reason: "provider_error" };
    const data = await res.json();
    const feature = Array.isArray(data?.features) ? data.features[0] : null;
    // The largest ring is the lot; a lot with a hole carries the hole as a
    // second ring and subtracting it is not worth a wrong answer on a
    // suburban lot that has none.
    const rings = Array.isArray(feature?.geometry?.rings) ? feature.geometry.rings : [];
    const vertices = rings.map(ringToVertices).sort((a, b) => sphericalPolygonAreaSqft(b) - sphericalPolygonAreaSqft(a))[0] || [];
    const areaSqft = sphericalPolygonAreaSqft(vertices);
    if (!(areaSqft > 0)) return { ok: false, reason: "no_parcel" };
    const attrs = feature.attributes || {};
    return {
      ok: true,
      provider: "gatineau",
      source: LAWN_SOURCE.PARCEL_GATINEAU,
      vertices,
      areaSqft,
      // The city's own figure, kept beside ours as a cross-check.
      reportedSqft: attrs["Shape.STArea()"] ? Math.round(num(attrs["Shape.STArea()"]) * SQFT_PER_M2) : null,
      lotNumber: attrs.SI0424J ? String(attrs.SI0424J) : null,
      matricule: attrs.SI0317C ? String(attrs.SI0317C) : null,
    };
  } catch {
    return { ok: false, reason: "provider_error" };
  }
}

/**
 * The providers, in the order they are tried. `covers` is a cheap extent
 * test so an address in Ottawa never pays for a Gatineau request; `fetch`
 * returns { ok, vertices, areaSqft, ... } or { ok: false, reason }.
 *
 * Ottawa is listed with no fetch on purpose — see the header. A provider
 * that exists and says "licensed" is a different fact from one nobody wrote,
 * and the estimate-review screen can print it.
 */
export const PARCEL_PROVIDERS = [
  {
    key: "gatineau",
    label: "Ville de Gatineau — Géoportail (lot de la matrice)",
    covers: inGatineau,
    fetch: fetchGatineauParcel,
  },
  {
    key: "ottawa",
    label: "City of Ottawa — parcels are Teranet-licensed, not open",
    covers: inOttawa,
    fetch: async () => ({ ok: false, reason: "licensed" }),
  },
  {
    key: "none",
    label: "No parcel source for this location",
    covers: () => true,
    fetch: async () => ({ ok: false, reason: "no_provider" }),
  },
];

/** The first provider whose extent covers the point. Never null. */
export function parcelProviderFor(location, formattedAddress = "") {
  const lat = num(location?.lat);
  const lng = num(location?.lng);
  return (
    PARCEL_PROVIDERS.find((p) => p.covers({ lat, lng, formattedAddress })) ||
    PARCEL_PROVIDERS[PARCEL_PROVIDERS.length - 1]
  );
}

/* ── The arithmetic ────────────────────────────────────────────────────────── */

/**
 * parcel − roof footprint − driveway, floored at zero. PURE.
 *
 * Returns null when either the parcel or the footprint is missing: a parcel
 * with no house on it is an empty lot or a model that missed the house, and
 * "lawn = the whole lot" would be the padded-absence trap.
 */
export function lawnFromParcel({ parcelSqft, roofFootprintSqft, driveway = DRIVEWAY_ALLOWANCE_SQFT } = {}) {
  const parcel = num(parcelSqft);
  const roof = num(roofFootprintSqft);
  if (!(parcel > 0) || !(roof > 0)) return null;
  return Math.max(0, Math.round(parcel - roof - num(driveway)));
}

/**
 * Everything that makes a lawn figure not believable, in words. PURE.
 * `trustworthy` is false when any flag is severe.
 */
export function lawnFlags(input) {
  const { areaSqft = 0, parcelSqft = null, roofAreaSqft = null, roofWarnings = [], source = null } =
    input && typeof input === "object" ? input : {};
  const flags = [];
  const roof = num(roofAreaSqft);
  if (roof > MAX_PLAUSIBLE_HOUSE_ROOF_SQFT) {
    flags.push({
      code: "not_a_house",
      severe: true,
      text: `${Math.round(roof).toLocaleString()} sqft of roof is a commercial building, not a house — book an on-site measure.`,
    });
  }
  for (const w of Array.isArray(roofWarnings) ? roofWarnings : []) {
    if (w?.severe && w.code === "far_from_pin") flags.push({ code: w.code, severe: true, text: w.text });
  }
  const parcel = num(parcelSqft);
  if (parcel > MAX_PLAUSIBLE_LOT_SQFT) {
    flags.push({
      code: "lot_too_large",
      severe: true,
      text: `A ${Math.round(parcel).toLocaleString()} sqft lot is more than two acres — not a lawn program priced sight-unseen. Book an on-site measure.`,
    });
  }
  const area = num(areaSqft);
  if (area > MAX_INSTANT_LAWN_SQFT) {
    flags.push({
      code: "lawn_too_large",
      severe: true,
      text: `${Math.round(area).toLocaleString()} sqft of lawn is over the instant ceiling (${MAX_INSTANT_LAWN_SQFT.toLocaleString()}) — book an on-site measure.`,
    });
  }
  if (source === LAWN_SOURCE.MINIMUM) {
    flags.push({
      code: "minimum_band",
      severe: false,
      text: "No parcel data here, so this is the minimum pricing band, not a measurement. Trace the lawn to correct it.",
    });
  }
  return { trustworthy: !flags.some((f) => f.severe), flags };
}

/* ── The still with the outline ────────────────────────────────────────────── */

/**
 * A Static Maps satellite still with the lawn outline drawn on it. The same
 * public key and the same shape as roofMeasurement's satelliteImageUrl, plus
 * a `path`; captured to Cloudinary at save time like every other still
 * (lib/measure/satelliteCapture.js), so the quote keeps the picture it was
 * priced from. Null with no key or under three vertices.
 *
 * No center/zoom: Static Maps fits the frame to the path, so the whole lawn
 * is in shot whatever its size. Vertices are rounded to 6 decimals (11 cm)
 * to keep the URL short — Static Maps caps it at 16 KB.
 */
export function lawnOutlineImageUrl(vertices, { size = "640x400", scale = 2 } = {}) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const pts = (Array.isArray(vertices) ? vertices : [])
    .map((p) => ({ lat: Number(p?.lat), lng: Number(p?.lng) }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .slice(0, 120);
  if (!key || pts.length < 3) return null;
  const ring = [...pts, pts[0]].map((p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`).join("%7C");
  return (
    "https://maps.googleapis.com/maps/api/staticmap" +
    `?size=${size}&scale=${scale}&maptype=satellite` +
    `&path=fillcolor:0x22c55e55%7Ccolor:0x15803dff%7Cweight:3%7C${ring}` +
    `&key=${key}`
  );
}

/* ── The one call ──────────────────────────────────────────────────────────── */

// A short in-process cache keyed by address. The public form previews on a
// debounce, and a homeowner ticking add-ons must not cost a Solar request
// per tick: the offer is re-priced from the cached measurement. Per instance
// on Vercel, which is where a debounce burst lands anyway.
const CACHE_TTL_MS = 15 * 60 * 1000;
const CACHE_MAX = 200;
const cache = new Map();
function cacheKey(address) {
  return String(address || "").trim().toLowerCase().replace(/\s+/g, " ");
}
function readCache(address) {
  const hit = cache.get(cacheKey(address));
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(cacheKey(address));
    return null;
  }
  return hit.value;
}
function writeCache(address, value) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(cacheKey(address), { at: Date.now(), value });
}
/** Exported for the check script. */
export function _clearLawnCache() {
  cache.clear();
}

/**
 * A lawn from a traced polygon. PURE apart from the image URL's key. The
 * server recomputes the area from the vertices (lib/measure/lotArea.js) —
 * the browser's readout is never the priced number.
 */
export function lawnFromPolygon(polygon, { minSqft = LAWN_MIN_SQFT_DEFAULT } = {}) {
  const vertices = (Array.isArray(polygon) ? polygon : [])
    .map((p) => (Array.isArray(p) ? { lat: Number(p[0]), lng: Number(p[1]) } : { lat: Number(p?.lat), lng: Number(p?.lng) }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .slice(0, 200);
  if (vertices.length < 3) return { ok: false, reason: "no_polygon" };
  const areaSqft = sphericalPolygonAreaSqft(vertices);
  if (areaSqft < MIN_TRACED_LAWN_SQFT) return { ok: false, reason: "polygon_too_small" };
  const { trustworthy, flags } = lawnFlags({ areaSqft, source: LAWN_SOURCE.TRACED });
  return {
    ok: true,
    source: LAWN_SOURCE.TRACED,
    basis: "traced",
    estimated: false,
    areaSqft,
    minSqft,
    vertices,
    outlineImageUrl: lawnOutlineImageUrl(vertices),
    satelliteImageUrl: lawnOutlineImageUrl(vertices),
    trustworthy,
    flags,
  };
}

/**
 * Address in, estimated lawn out.
 *
 *   { ok, source, basis, estimated, areaSqft, minSqft, parcel, roof,
 *     driveway, formattedAddress, location, satelliteImageUrl,
 *     trustworthy, flags, provider }
 *
 * `polygon` (optional) is the correction: when it carries three or more
 * vertices the address is only used for the pin and nothing is fetched.
 *
 * Every miss returns { ok: false, reason } as measureRoof does, so the
 * route and the panel branch the same way for every measured trade.
 */
export async function estimateLawn(address, { polygon = null, minSqft = LAWN_MIN_SQFT_DEFAULT } = {}) {
  if (Array.isArray(polygon) && polygon.length >= 3) {
    const traced = lawnFromPolygon(polygon, { minSqft });
    return traced.ok ? { ...traced, formattedAddress: address || null } : traced;
  }
  if (!address || typeof address !== "string" || !address.trim()) return { ok: false, reason: "no_address" };

  const cached = readCache(address);
  if (cached) return { ...cached, minSqft, cached: true };

  // measureRoof geocodes and, where Solar has the house, gives the footprint.
  // A miss on the roof is not a miss on the address: no_roof_coverage still
  // carries the location, and the estimate degrades to the minimum band.
  const roof = await measureRoof(address);
  if (!roof || roof.reason === "no_key" || roof.reason === "geocode_failed") {
    return { ok: false, reason: roof?.reason || "geocode_failed" };
  }
  const location = roof.location || null;
  if (!location) return { ok: false, reason: "geocode_failed" };

  const provider = parcelProviderFor(location, roof.formattedAddress || address);
  const parcel = await provider.fetch(location);

  const roofFootprintSqft = roof.ok ? num(roof.footprintSqft) : 0;
  const derived = parcel.ok ? lawnFromParcel({ parcelSqft: parcel.areaSqft, roofFootprintSqft }) : null;

  let source;
  let areaSqft;
  let basis;
  if (derived != null && derived > 0) {
    source = parcel.source;
    areaSqft = derived;
    basis = "parcel";
  } else {
    source = LAWN_SOURCE.MINIMUM;
    areaSqft = minSqft;
    basis = "minimum";
  }

  const { trustworthy, flags } = lawnFlags({
    areaSqft,
    parcelSqft: parcel.ok ? parcel.areaSqft : null,
    roofAreaSqft: roof.ok ? roof.areaSqft : null,
    roofWarnings: roof.ok ? roof.warnings : [],
    source,
  });

  const result = {
    ok: true,
    source,
    basis,
    // Every address figure is an estimate — even the parcel arithmetic
    // assumes a driveway it has not seen. Only a trace is not.
    estimated: true,
    areaSqft,
    minSqft,
    provider: { key: provider.key, label: provider.label, reason: parcel.ok ? null : parcel.reason },
    parcel: parcel.ok
      ? {
          areaSqft: parcel.areaSqft,
          reportedSqft: parcel.reportedSqft,
          lotNumber: parcel.lotNumber,
          matricule: parcel.matricule,
          vertices: parcel.vertices,
        }
      : null,
    roof: roof.ok
      ? {
          footprintSqft: roofFootprintSqft || null,
          areaSqft: roof.areaSqft,
          imageryDate: roof.imageryDate || null,
          imageryQuality: roof.imageryQuality || null,
        }
      : null,
    driveway: basis === "parcel" ? DRIVEWAY_ALLOWANCE_SQFT : null,
    formattedAddress: roof.formattedAddress || address,
    location,
    // The parcel outline on the still when there is one; the plain pin
    // otherwise. A lawn OUTLINE is only ever drawn from a trace.
    satelliteImageUrl:
      (parcel.ok && lawnOutlineImageUrl(parcel.vertices)) || roof.satelliteImageUrl || satelliteImageUrl(location.lat, location.lng),
    precise: roof.precise ?? null,
    trustworthy,
    flags,
  };
  writeCache(address, result);
  return result;
}

/**
 * The takeoff a lawn measurement writes onto a lawn_care scope group — the
 * evidence the document prints (lib/measure/measureImages.js): the outline,
 * the area, where it came from. PURE. Vertices only when there is an
 * outline (a trace or a parcel); the minimum band has none.
 */
export function lawnTakeoffPatch(m, address = "") {
  if (!m || !(num(m.areaSqft) > 0)) return null;
  const vertices = Array.isArray(m.vertices) ? m.vertices : Array.isArray(m.parcel?.vertices) ? m.parcel.vertices : null;
  return {
    lawn: {
      areaSqft: Math.round(num(m.areaSqft)),
      source: m.source || null,
      basis: m.basis || null,
      estimated: m.estimated !== false,
      minSqft: num(m.minSqft) || null,
      ...(vertices && vertices.length >= 3 ? { vertices } : {}),
      ...(m.parcel ? { parcelSqft: m.parcel.areaSqft, lotNumber: m.parcel.lotNumber || null } : {}),
      ...(m.roof ? { roofFootprintSqft: m.roof.footprintSqft || null } : {}),
      ...(m.driveway ? { drivewaySqft: m.driveway } : {}),
      address: address || m.formattedAddress || "",
      flags: (m.flags || []).map((f) => ({ code: f.code, severe: Boolean(f.severe), text: f.text })),
    },
  };
}
