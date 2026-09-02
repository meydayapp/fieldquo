// lib/sales/discovery/normalise.js
//
// One row from a discovery provider, turned into the columns a Prospect has.
//
// ══ Pure, and executed rather than read ════════════════════════════════════
//
// Every bug this layer can contain is a normalisation bug, and a normalisation
// bug is invisible by reading. "6137956277" and "+16137956277" are one phone;
// "https://www.acme.com/contact" and "acme.com" are one domain. A pipeline that
// stores one spelling and deduplicates on another has no deduplication at all.
// So this file takes already-loaded rows and returns plain objects, and
// scripts/check-sales-discovery.mjs runs it against the ways each rule can be
// wrong — the shape lib/marketing/jobPhotoContext.js uses for the same reason.
//
// ══ ONE phone normaliser ═══════════════════════════════════════════════════
//
// `normalisePhone` comes from lib/sales/suppressionRules.js, which itself
// wraps `toE164` from lib/voice/numbers.js. Not a copy. If discovery stored
// "+16135550142" and the suppression list normalised "16135550142", a business
// that told FieldQuo to stop would be dialled again — AGENTS.md's failure
// class 4 with the most expensive possible version of the consequence.
//
// ══ Three things this file refuses to invent ═══════════════════════════════
//
//  1. **Opening status.** Overture's `operating_status` is only ever `open` or
//     NULL — measured, 7,328 against 14,194 in the sample, and no `closed`
//     value exists at all. So a NULL is recorded as null and never read as
//     "open". Some of these businesses have shut and the source does not know.
//  2. **Website absence.** A row with no `websites` entry sets `hasWebsite` to
//     NULL, not false. The schema's own comment makes hasWebsite three-valued
//     for exactly this: "no website" is a strong sales signal (spec §5) and
//     claiming it on the strength of an empty column would be the padding
//     failure AGENTS.md lists fifth. The crawler stage is what turns null into
//     a real false. The campaign funnel therefore counts "no website LISTED BY
//     THE SOURCE", which is a true sentence about the data we have.
//  3. **Freshness.** `sourceUpdatedAt` is carried through exactly as the source
//     gave it, and a row with no update time gets null rather than "now".
//     11.6% of the measured sample is pre-2020; a rep needs to see that.
//
// ══ Confidence is stored and never gated on ════════════════════════════════
//
// The measurement is unambiguous: phone fill is 98.9% in Overture's LOWEST
// confidence bucket and 100.0% in the highest, and for Foursquare rows the
// field takes three distinct values across 2,279 records — it is a per-source
// constant, not a per-record score. Filtering on it would discard ~23% of the
// records to improve phone fill by one point. So it is a column, and nothing
// in this codebase may put it in a WHERE clause.
import { normaliseDomain, normalisePhone } from "@/lib/sales/suppressionRules";

/** Postgres will not hold more than this in a name column we control. */
const MAX_NAME = 200;
const MAX_ADDRESS = 300;
const MAX_URL = 500;

/**
 * A business name as it should be stored.
 *
 * Markup is stripped, entities are decoded, whitespace collapses. This is not
 * cosmetic: names arrive from page scrapes carrying `<b>`, `&amp;` and
 * non-breaking spaces, and a stored `<b>Acme Painting</b>` is what a rep reads
 * off the screen before dialling.
 *
 * Returns null for a name that is nothing but markup — an empty string in
 * `businessName` would be a required column holding a lie.
 */
export function cleanBusinessName(value) {
  const text = String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    // Control characters, including the ones that would break a CSV export a
    // rep opens in a spreadsheet.
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;
  return text.length > MAX_NAME ? text.slice(0, MAX_NAME).trim() : text;
}

/** Trim, collapse, cap. Null for nothing. */
function cleanText(value, max) {
  const text = String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;
  return text.length > max ? text.slice(0, max).trim() : text;
}

/**
 * A website URL as it should be stored, with a scheme.
 *
 * Kept alongside `domain` rather than instead of it: the domain is the
 * deduplication key and the URL is the thing a human clicks. A source value
 * that does not yield a registrable domain is refused outright — a stored
 * "http://localhost" or an IP is a link nobody can use and a key nothing
 * matches.
 */
export function cleanWebsite(value) {
  const raw = cleanText(value, MAX_URL);
  if (!raw) return null;
  const domain = normaliseDomain(raw);
  if (!domain) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    // Only http(s). A `javascript:` or `data:` value reaching an anchor tag on
    // an admin screen is a stored XSS, and no directory legitimately carries
    // one.
    if (!/^https?:\/\//i.test(raw)) return null;
    return raw;
  }
  return `https://${raw}`;
}

/** The newest ISO timestamp in a list, or null. Never "now". */
export function newestUpdateTime(sources = []) {
  let best = null;
  for (const source of Array.isArray(sources) ? sources : []) {
    const raw = source?.updateTime ?? source?.update_time ?? null;
    if (!raw) continue;
    const at = new Date(raw);
    if (Number.isNaN(at.getTime())) continue;
    if (!best || at > best) best = at;
  }
  return best;
}

/**
 * How old the source says this record is, in whole days. Null when unknown.
 *
 * Null is NOT zero. A record with no update time is a record whose age nobody
 * knows, and showing it as "updated today" is the lie this returns null to
 * avoid.
 */
export function sourceAgeDays(updatedAt, now = new Date()) {
  if (!updatedAt) return null;
  const at = updatedAt instanceof Date ? updatedAt : new Date(updatedAt);
  if (Number.isNaN(at.getTime())) return null;
  return Math.floor((now.getTime() - at.getTime()) / 86_400_000);
}

/** Two years, the boundary the measurement found 79.2% of rows inside. */
export const STALE_AFTER_DAYS = 730;

/**
 * Should a rep be warned that this record may be out of date?
 *
 * Three-valued on purpose. `null` — "the source did not say when it last
 * looked" — is a DIFFERENT warning from "the source last looked in 2015", and
 * a screen that renders both as "fresh" is the one that gets a rep dialling a
 * disconnected number with no idea why.
 */
export function stalenessOf(updatedAt, now = new Date()) {
  const days = sourceAgeDays(updatedAt, now);
  if (days === null) return { level: "unknown", days: null };
  return { level: days > STALE_AFTER_DAYS ? "stale" : "fresh", days };
}

/**
 * A provider row, shaped into the Prospect columns.
 *
 * @param {object} business  a DiscoveredBusiness — see lib/sales/discovery/
 *        provider.js for the shape every provider must emit.
 * @param {{ provider: string, release: string|null, tradeKey: string|null,
 *           classification: string|null, classificationReason: string|null }} context
 * @returns {{ ok: boolean, problems: string[], prospect: object|null,
 *             facts: Array<{field:string, raw:string, normalized:string|null}> }}
 *          `facts` is what evidence.js turns into ProspectEvidence rows: one
 *          per ingested value, carrying both spellings, because a provenance
 *          argument that shows only the normalised form is unreviewable.
 */
export function normaliseBusiness(business = {}, context = {}) {
  const problems = [];

  const rawName = typeof business?.name === "string" ? business.name : "";
  const businessName = cleanBusinessName(rawName);
  if (!businessName) problems.push("no_name");

  const sourceRecordId = cleanText(business?.sourceRecordId, 200);
  if (!sourceRecordId) problems.push("no_source_record_id");

  const facts = [];
  const note = (field, raw, normalized) => {
    if (raw === null || raw === undefined || raw === "") return;
    facts.push({ field, raw: String(raw).slice(0, 500), normalized: normalized ?? null });
  };

  // ── Phone ───────────────────────────────────────────────────────────────
  //
  // The FIRST value that normalises wins, and the rest are still recorded as
  // evidence. 45% of the measured sample is bare ten digits and 54% is E.164,
  // so a raw-string comparison would treat one business's two spellings as two
  // businesses.
  let phoneE164 = null;
  for (const phone of asList(business?.phones)) {
    const normalized = normalisePhone(phone);
    if (!phoneE164 && normalized) phoneE164 = normalized;
    note("phone", phone, normalized);
  }

  // ── Website ─────────────────────────────────────────────────────────────
  let websiteUrl = null;
  let domain = null;
  for (const website of asList(business?.websites)) {
    const url = cleanWebsite(website);
    const host = normaliseDomain(website);
    if (!websiteUrl && url) {
      websiteUrl = url;
      domain = host;
    }
    note("website", website, host);
  }

  for (const email of asList(business?.emails)) note("email", email, null);

  // ── Address ─────────────────────────────────────────────────────────────
  const address = business?.address || {};
  const addressLine = cleanText(address.line, MAX_ADDRESS);
  const city = cleanText(address.city, 120);
  const province = cleanText(address.province, 120);
  const postalCode = cleanText(address.postalCode, 40);
  const country = cleanText(address.country, 8);
  note("address", [addressLine, city, province, postalCode].filter(Boolean).join(", "), null);

  const latitude = finiteOrNull(business?.latitude);
  const longitude = finiteOrNull(business?.longitude);

  const sourceUpdatedAt =
    business?.sourceUpdatedAt instanceof Date
      ? business.sourceUpdatedAt
      : business?.sourceUpdatedAt
        ? new Date(business.sourceUpdatedAt)
        : null;

  const categories = business?.categories || {};
  const sourceCategories = [
    ...(typeof categories.primary === "string" && categories.primary ? [categories.primary] : []),
    ...asList(categories.alternate),
  ].map((c) => String(c).slice(0, 120));
  if (sourceCategories.length) note("category", sourceCategories.join(", "), null);

  if (problems.length) return { ok: false, problems, prospect: null, facts };

  return {
    ok: true,
    problems,
    facts,
    prospect: {
      businessName,
      // The source's own string, kept because a deduplication argument is
      // unreadable without the original spellings.
      rawName: rawName.slice(0, MAX_NAME) || null,
      phoneE164,
      domain,
      websiteUrl,
      // See point 2 in the header: true or null, never a false invented from
      // an empty column.
      hasWebsite: websiteUrl ? true : null,
      addressLine,
      city,
      province,
      postalCode,
      country,
      latitude,
      longitude,
      sourceCategories,
      tradeKey: context.tradeKey ?? null,
      classification: context.classification ?? null,
      classificationReason: context.classificationReason ?? null,
      // Verbatim. Null means the source said nothing, and nothing may read that
      // as "open".
      businessStatus: cleanText(business?.operatingStatus, 40),
      sourceProvider: context.provider ?? null,
      sourceRecordId,
      sourceRelease: context.release ?? null,
      sourceDataset: cleanText(business?.sourceDataset, 80),
      sourceConfidence: finiteOrNull(business?.sourceConfidence),
      sourceUpdatedAt: sourceUpdatedAt && !Number.isNaN(sourceUpdatedAt.getTime()) ? sourceUpdatedAt : null,
    },
  };
}

/**
 * Is this record worth putting in a rep's queue today?
 *
 * The measurement's own definition of a cold-callable record: a phone AND a
 * full street address. Not confidence, not freshness — a stale record with a
 * number is still a call worth making, and the screen shows its age so the rep
 * knows what they are dialling.
 */
export function isCallReady(prospect) {
  return Boolean(prospect?.phoneE164 && prospect?.addressLine);
}

function asList(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((v) => typeof v === "string" && v.trim());
}

function finiteOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
