// lib/maps/streetView.js
//
// "See the property" — a Street View look at the front of a house, loaded only
// when somebody taps for it — and the crew's Directions links. The pure half:
// no database, no environment, no network except the one fetch the caller
// hands a key to, so every rule here can be executed against hostile input in
// a check script.
//
// ══ Why an Embed iframe and not a Street View Static image ═════════════════
//
// The owner approved a billed Street View Static photo first ($7 per 1,000
// after 10,000 free a month) and then asked the obvious follow-up: five people
// opening the same job is five billed photos. The Maps Embed API draws the
// same panorama in an iframe and Google publishes it as "free to use with
// unlimited requests" (developers.google.com/maps/documentation/embed/
// usage-and-billing). So the picture is an Embed iframe and nothing here
// meters it — there is no bill to meter. The Static image route, its meter
// and its /platform line were never shipped.
//
// ══ Which key goes where ═══════════════════════════════════════════════════
//
//   metadata  server-side, with serverMapsKey() (lib/measure/roofMeasurement.js
//             — GOOGLE_MAPS_SERVER_KEY, else the public key). The metadata
//             request is free (developers.google.com/maps/documentation/
//             streetview/metadata) and answers the only question the button
//             needs: is there outdoor imagery here at all. The browser never
//             sends an address and never sees this key.
//   embed     NEXT_PUBLIC_GOOGLE_MAPS_API_KEY and nothing else. An iframe src
//             is public by construction, so it must carry the key that is
//             already public — the referrer-restricted browser key MiniMap and
//             the address autocomplete ship in the bundle today. Putting the
//             server key in an iframe would publish an unrestricted, billable
//             key (the reason app/api/measure/satellite proxies its bytes).
//
// ══ Why nothing is cached ══════════════════════════════════════════════════
//
// Google's terms forbid storing Street View imagery, and the metadata answer
// (a pano id, the panorama's coordinates) is Google Maps Content too. The only
// reason to cache it would be money, and it costs none — so the route answers
// `Cache-Control: private, no-store` and no table, no Cloudinary folder and no
// in-memory map holds any of it. Absent a saving, "we keep nothing" is the
// only position that needs no argument about what the terms allow.
//
// ══ Why the heading is sometimes missing ═══════════════════════════════════
//
// A panorama faces wherever Google's car was driving. To face the HOUSE the
// camera needs the house's own coordinate, and the only free source of one is
// a geocode FieldQuo already paid for and stored: Job.latitude/longitude
// (lib/geo/geocodeJob.js), and only while it is inside Google's 30-day
// caching window (the same window Job.geocodedAt exists to enforce). A lead,
// a client or a quote with no geocoded job at that address opens facing the
// panorama's own default. A fresh geocode per tap would fix that and would be
// a billed Geocoding call the owner did not approve, so it is not made.

/** The record kinds the route resolves an address for. Closed list. */
export const STREET_VIEW_KINDS = Object.freeze(["lead", "client", "job", "quote"]);

/**
 * Query parameters the route refuses outright. The route resolves the address
 * from a record; a caller who sends one of these is trying to use it as a
 * proxy for an arbitrary place, and gets a 400 rather than a silent ignore so
 * the refusal is visible in a test.
 */
export const REFUSED_PARAMS = Object.freeze([
  "address",
  "location",
  "lat",
  "lng",
  "latitude",
  "longitude",
  "pano",
  "key",
  "q",
]);

/** Google caches: a geocoded coordinate may be kept 30 consecutive days. */
export const GEOCODE_CACHE_DAYS = 30;

// The camera. fov 80 rather than Google's 90: a little tighter frames a house
// front from the kerb instead of the neighbours on either side. Pitch 0 is
// level — a raised camera loses the door on a bungalow.
export const EMBED_FOV = 80;
export const EMBED_PITCH = 0;

/** Longest address the route will send to Google. A real one is < 150. */
const MAX_ADDRESS = 300;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

const squash = (v) => String(v ?? "").replace(/\s+/g, " ").trim();

/**
 * Validate the route's query. Pure. Returns `{ ok: true, kind, id }` for a
 * staff record, `{ ok: true, token }` for the client-facing quote, or
 * `{ ok: false, reason }` — never a guess.
 */
export function parseStreetViewQuery(searchParams) {
  const get = (k) => (typeof searchParams?.get === "function" ? searchParams.get(k) : searchParams?.[k]);
  for (const p of REFUSED_PARAMS) {
    if (get(p) != null) return { ok: false, reason: "address_not_accepted" };
  }
  const token = get("token");
  const kind = get("kind");
  const id = get("id");
  if (token != null) {
    if (kind != null || id != null) return { ok: false, reason: "bad_request" };
    const t = String(token);
    // Share tokens are url-safe random strings; anything else cannot match
    // one and is refused before it reaches the database.
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(t)) return { ok: false, reason: "not_found" };
    return { ok: true, token: t };
  }
  if (!STREET_VIEW_KINDS.includes(kind)) return { ok: false, reason: "bad_request" };
  if (typeof id !== "string" || !ID_RE.test(id)) return { ok: false, reason: "bad_request" };
  return { ok: true, kind, id };
}

/**
 * The address a record points at, by the rules each surface already prints.
 * Pure; `formatAddress` and `leadAddressLine` are passed in by the caller
 * (both are pure and live in lib/format/address.js and lib/leads/intakeShape.js)
 * so this file stays importable with no aliases in a check script.
 *
 *   lead    the intake's address line — what the lead panel prints
 *   client  the client's formatted address — what the client page prints
 *   job     Job.siteAddress; else the client's own address ONLY for an
 *           individual. A company client's address is an office, and
 *           Job.siteAddress's own comment says null means "not asked", not
 *           "same as the client".
 *   quote   Quote.siteAddress; the same individual-only fallback
 *           (lib/quotes/jobAddress.js — every reader applies it)
 */
export function addressForRecord(kind, row, { formatAddress, leadAddressLine } = {}) {
  if (!row) return null;
  let out = "";
  if (kind === "lead") out = leadAddressLine ? leadAddressLine(row.intake) : "";
  else if (kind === "client") out = formatAddress ? formatAddress(row) : squash(row.address);
  else if (kind === "job" || kind === "quote") {
    out = squash(row.siteAddress);
    if (!out && row.client && row.client.type !== "company") {
      out = formatAddress ? formatAddress(row.client) : squash(row.client.address);
    }
  }
  out = squash(out);
  if (!out || out.length > MAX_ADDRESS) return null;
  return out;
}

/**
 * A stored coordinate we may still use, or null. Google lets a geocode be
 * cached for 30 days; older than that, or undated, it is not ours to use.
 */
export function freshPoint(lat, lng, geocodedAt, now = new Date()) {
  const la = Number(lat);
  const ln = Number(lng);
  if (lat == null || lng == null || !Number.isFinite(la) || !Number.isFinite(ln)) return null;
  if (Math.abs(la) > 90 || Math.abs(ln) > 180) return null;
  const at = geocodedAt ? new Date(geocodedAt) : null;
  if (!at || Number.isNaN(at.getTime())) return null;
  if (now.getTime() - at.getTime() > GEOCODE_CACHE_DAYS * 86400000) return null;
  return { lat: la, lng: ln };
}

/** The first fresh point a job row carries (latitude/longitude, then site*). */
export function jobPoint(job, now = new Date()) {
  if (!job) return null;
  return (
    freshPoint(job.latitude, job.longitude, job.geocodedAt, now) ||
    freshPoint(job.siteLatitude, job.siteLongitude, job.siteGeocodedAt, now)
  );
}

/**
 * Initial compass bearing from `from` to `to`, degrees clockwise from north,
 * rounded, in [0, 360). Null when either end is missing or they coincide
 * (a camera cannot face the point it is standing on).
 */
export function bearingDegrees(from, to) {
  if (!from || !to) return null;
  const vals = [from.lat, from.lng, to.lat, to.lng].map(Number);
  if (!vals.every(Number.isFinite)) return null;
  const [lat1, lng1, lat2, lng2] = vals.map((d) => (d * Math.PI) / 180);
  if (lat1 === lat2 && lng1 === lng2) return null;
  const y = Math.sin(lng2 - lng1) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lng2 - lng1);
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  return Math.round((deg + 360) % 360);
}

/**
 * Google's metadata answer, reduced to what the button needs. Anything other
 * than status OK with a pano id and a location is "no button" — ZERO_RESULTS
 * and NOT_FOUND are an honest absence; REQUEST_DENIED means the API is not
 * enabled on the key, which is also no button (never a grey box).
 */
export function parseMetadata(json) {
  const status = json && typeof json.status === "string" ? json.status : "INVALID";
  if (status !== "OK") return { ok: false, status };
  const lat = Number(json.location?.lat);
  const lng = Number(json.location?.lng);
  const panoId = typeof json.pano_id === "string" ? json.pano_id : "";
  if (!panoId || !/^[A-Za-z0-9_-]{1,200}$/.test(panoId) || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, status: "INVALID" };
  }
  return { ok: true, status, panoId, location: { lat, lng } };
}

/**
 * One free metadata request. `source=outdoor` so an address with an indoor
 * business panorama (a showroom, a café) never answers with its interior.
 * `target` is a fresh point when we have one — the panorama nearest the
 * house — else the address string, which Google geocodes on its side for free.
 */
export async function fetchStreetViewMetadata(target, { key, fetchImpl = fetch, timeoutMs = 5000 } = {}) {
  if (!key || !target) return { ok: false, status: "NO_KEY" };
  const location =
    typeof target === "string" ? target : `${Number(target.lat).toFixed(6)},${Number(target.lng).toFixed(6)}`;
  const params = new URLSearchParams({ location, source: "outdoor", key });
  try {
    const res = await fetchImpl(`https://maps.googleapis.com/maps/api/streetview/metadata?${params.toString()}`, {
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, status: `HTTP_${res.status}` };
    return parseMetadata(await res.json());
  } catch {
    return { ok: false, status: "UNREACHABLE" };
  }
}

/**
 * The Maps Embed API Street View URL — free, unlimited — for the tap-to-load
 * iframe. `key` must be the PUBLIC browser key; see the header.
 */
export function streetViewEmbedUrl({ key, panoId, heading = null, language = null }) {
  if (!key || !panoId) return null;
  const params = new URLSearchParams({ key, pano: panoId, pitch: String(EMBED_PITCH), fov: String(EMBED_FOV) });
  if (Number.isFinite(heading)) params.set("heading", String(heading));
  // Google's own chrome inside the frame (the "View on Google Maps" link, the
  // copyright) in the document's language on the client's quote.
  if (language && /^[a-z]{2}$/.test(language)) params.set("language", language);
  return `https://www.google.com/maps/embed/v1/streetview?${params.toString()}`;
}

/**
 * The same panorama in Google Maps itself (Maps URLs — keyless, free). Built
 * from the pano, not from the address, so the client-facing quote never hands
 * the browser an address string the page did not already print.
 */
export function mapsPanoUrl({ panoId, location, heading = null }) {
  if (!panoId || !location) return null;
  const params = new URLSearchParams({
    api: "1",
    map_action: "pano",
    pano: panoId,
    viewpoint: `${Number(location.lat).toFixed(6)},${Number(location.lng).toFixed(6)}`,
  });
  if (Number.isFinite(heading)) params.set("heading", String(heading));
  return `https://www.google.com/maps/@?${params.toString()}`;
}

/**
 * Turn-by-turn links for the crew. Both are keyless and free: Google's
 * documented Maps URLs directions form, and Apple's maps.apple.com `daddr`,
 * which an iPhone hands to Apple Maps. Null when there is no address.
 */
export function directionsLinks(address) {
  const a = squash(address);
  if (!a) return null;
  const dest = encodeURIComponent(a);
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${dest}`,
    apple: `https://maps.apple.com/?daddr=${dest}`,
  };
}

/**
 * Whether this browser is an Apple device — the only place the Apple Maps
 * link is worth offering. iPadOS reports itself as a Mac, so a Mac with a
 * touch screen counts as an iPad. Pure over its inputs.
 */
export function isAppleDevice({ userAgent = "", platform = "", maxTouchPoints = 0 } = {}) {
  if (/iPhone|iPad|iPod/i.test(userAgent) || /iPhone|iPad|iPod/i.test(platform)) return true;
  if (/Macintosh|MacIntel/i.test(userAgent + " " + platform)) return true;
  return maxTouchPoints > 1 && /Mac/i.test(platform);
}
