// lib/company/serviceArea.js
//
// The company's service area — where they will drive to — and the one
// question the two public flows ask of it: is this address inside it?
//
// The minimum that answers that question honestly: the company's own base
// address (already on Company as latitude/longitude, backfilled by
// app/api/settings/business-info/route.js) plus a radius in km, and
// optionally a list of postal-code prefixes for a company whose area is a
// list of towns rather than a circle. This is deliberately NOT SalesTerritory
// — that is the reps' map of who prospects where, and a contractor's
// service area is the contractor's own statement.
//
// ── The rule ───────────────────────────────────────────────────────────────
//
// Inside if ANY configured test that can be evaluated passes. A postal
// prefix match is inside even when the pin lands 2 km past the circle,
// because the owner listed that prefix on purpose. With no test evaluable —
// the address did not geocode and carried no postal code — the answer is
// `null`, and the flows say NOTHING: "we don't know" must never render as
// "outside". A company with no area set is `configured: false`, no check,
// no sentence.
//
// Never a block. An address outside the area still submits; the flow says
// so in one honest line, and the lead carries `outsideServiceArea: true` so
// the company sees it before they ring back.
//
// Pure: no db, no Next. The browser renders sentences from it, the public
// routes evaluate it, and the check script executes it.

const EARTH_RADIUS_KM = 6371;

// A coordinate that was never given, as a number — or NaN. Number(null) is 0
// and Number("") is 0, both finite, so a null pin used to be measured as
// (0, 0) in the Gulf of Guinea and come back "outside": the exact "we don't
// know rendered as outside" this module exists to refuse. The type is checked
// BEFORE Number(), the same trap the settings route guards against.
function coord(v) {
  if (v === null || v === undefined || v === "" || typeof v === "boolean") return NaN;
  return Number(v);
}

/** Great-circle km between two { lat, lng } (or { latitude, longitude }). */
export function distanceKm(a, b) {
  if (!a || !b) return null;
  const lat1 = coord(a.latitude ?? a.lat);
  const lng1 = coord(a.longitude ?? a.lng);
  const lat2 = coord(b.latitude ?? b.lat);
  const lng2 = coord(b.longitude ?? b.lng);
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return null;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(s));
}

/** A radius the owner typed, or null. Whole km, 1–2000. */
export function cleanRadiusKm(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(n, 2000);
}

/**
 * Postal prefixes as stored: upper-case, no spaces, 2–7 characters, unique,
 * at most 50. "k1a", "K1A 0B1" and " k1a " all become "K1A" / "K1A0B1".
 */
export function normalisePostalPrefixes(list) {
  const src = Array.isArray(list) ? list : typeof list === "string" ? list.split(/[,\n;]/) : [];
  const out = [];
  for (const raw of src) {
    const p = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (p.length < 2 || p.length > 7) continue;
    if (!out.includes(p)) out.push(p);
    if (out.length >= 50) break;
  }
  return out;
}

/**
 * The postal code inside a formatted address, or null. Canadian "K1A 0B1"
 * and US "90210" / "90210-1234" shapes; a bare 5-digit house number is
 * refused by requiring the US code to sit at the end of its segment.
 */
export function postalCodeFromAddress(text) {
  const s = String(text || "");
  const ca = s.match(/\b([ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z])\s?(\d[ABCEGHJ-NPRSTV-Z]\d)\b/i);
  if (ca) return `${ca[1]}${ca[2]}`.toUpperCase();
  const us = s.match(/\b(\d{5})(?:-\d{4})?\s*(?:,|$|\bUSA?\b|\bUnited States\b)/i);
  if (us) return us[1];
  return null;
}

/** Has the company said anything about where they go? */
export function serviceAreaConfigured(company) {
  if (!company) return false;
  const radius = cleanRadiusKm(company.serviceRadiusKm);
  const hasBase = Number.isFinite(coord(company.latitude)) && Number.isFinite(coord(company.longitude));
  const prefixes = normalisePostalPrefixes(company.servicePostalPrefixes);
  return Boolean((radius && hasBase) || prefixes.length);
}

/**
 * Is this address inside the company's area?
 *
 * @param company  { latitude, longitude, serviceRadiusKm, servicePostalPrefixes }
 * @param where    { lat, lng, postalCode } — whichever parts are known
 * @returns {{ configured: boolean, inside: boolean|null, distanceKm: number|null, byPostal: boolean|null }}
 */
export function checkServiceArea(company, where = {}) {
  if (!serviceAreaConfigured(company)) {
    return { configured: false, inside: null, distanceKm: null, byPostal: null };
  }
  const radius = cleanRadiusKm(company.serviceRadiusKm);
  const prefixes = normalisePostalPrefixes(company.servicePostalPrefixes);

  const d = radius ? distanceKm(company, where) : null;
  const byRadius = d === null ? null : d <= radius;

  const postal = where.postalCode ? String(where.postalCode).toUpperCase().replace(/[^A-Z0-9]/g, "") : "";
  const byPostal = prefixes.length && postal ? prefixes.some((p) => postal.startsWith(p)) : null;

  const verdicts = [byRadius, byPostal].filter((v) => v !== null);
  const inside = verdicts.length ? verdicts.some(Boolean) : null;
  return { configured: true, inside, distanceKm: d === null ? null : Math.round(d * 10) / 10, byPostal };
}

// ── The sentences ──────────────────────────────────────────────────────────

const COPY = {
  en: {
    serves: (n, city) => (city ? `We serve within ${n} km of ${city}.` : `We serve within ${n} km of our base.`),
    servesPostal: (list) => `We serve postal codes starting with ${list}.`,
    outside: (company, n, city) =>
      `This address is outside ${company}'s usual service area${
        n ? ` (${n} km around ${city || "their base"})` : ""
      }. You can still send the request; they'll confirm whether they can come.`,
    outsideBadge: "Outside usual service area",
  },
  fr: {
    serves: (n, city) =>
      city ? `Nous desservons un rayon de ${n} km autour de ${city}.` : `Nous desservons un rayon de ${n} km autour de notre base.`,
    servesPostal: (list) => `Nous desservons les codes postaux commençant par ${list}.`,
    outside: (company, n, city) =>
      `Cette adresse est en dehors de la zone habituelle de ${company}${
        n ? ` (${n} km autour de ${city || "sa base"})` : ""
      }. Vous pouvez quand même envoyer la demande ; ils confirmeront s'ils peuvent se déplacer.`,
    outsideBadge: "Hors de la zone habituelle",
  },
  es: {
    serves: (n, city) =>
      city ? `Atendemos en un radio de ${n} km alrededor de ${city}.` : `Atendemos en un radio de ${n} km alrededor de nuestra base.`,
    servesPostal: (list) => `Atendemos los códigos postales que empiezan por ${list}.`,
    outside: (company, n, city) =>
      `Esta dirección está fuera de la zona habitual de ${company}${
        n ? ` (${n} km alrededor de ${city || "su base"})` : ""
      }. Aún puede enviar la solicitud; ellos confirmarán si pueden acudir.`,
    outsideBadge: "Fuera de la zona habitual",
  },
};

export function serviceAreaCopy(language = "en") {
  const code = String(language || "en").toLowerCase().slice(0, 2);
  return Object.prototype.hasOwnProperty.call(COPY, code) ? COPY[code] : COPY.en;
}

/**
 * "We serve within 25 km of Ottawa." — the line Settings › Business previews
 * and a public page may print. Null when nothing is configured: no invented
 * area.
 */
export function serviceAreaSentence(company, language = "en") {
  if (!serviceAreaConfigured(company)) return null;
  const t = serviceAreaCopy(language);
  const radius = cleanRadiusKm(company.serviceRadiusKm);
  const hasBase = Number.isFinite(coord(company.latitude)) && Number.isFinite(coord(company.longitude));
  if (radius && hasBase) return t.serves(radius, company.city || "");
  const prefixes = normalisePostalPrefixes(company.servicePostalPrefixes);
  return prefixes.length ? t.servesPostal(prefixes.join(", ")) : null;
}

/** The honest line shown under an address that is outside the area. */
export function outsideServiceAreaSentence(company, language = "en") {
  const t = serviceAreaCopy(language);
  const radius = cleanRadiusKm(company.serviceRadiusKm);
  const hasBase = Number.isFinite(coord(company.latitude)) && Number.isFinite(coord(company.longitude));
  return t.outside(company.name || "", radius && hasBase ? radius : null, company.city || "");
}

/** Exported for the language-completeness check. */
export const SERVICE_AREA_COPY = COPY;
