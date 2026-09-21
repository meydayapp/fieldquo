// lib/sales/intel/bbbProfile.js
//
// What a BBB business profile says, read out of the page a browser
// rendered — and what a BBB search page lists.
//
// ══ Fetchability, measured 2026-09-17 ═════════════════════════════════════
//
// bbb.org's robots.txt ALLOWS /us/*/*/profile/*/*, and its Cloudflare edge
// answers 403 with `cf-mitigated: challenge` to every non-browser request —
// a plain fetch, a fetch with a full Chrome header set, both. The page is
// readable only by a real browser that passes the challenge. So nothing in
// lib/ fetches bbb.org. The HTML reaches this parser from:
//
//   - scripts/bbb-principal.mjs, a visible browser on the owner's own
//     machine at a human pace (docs/sales/BBB-LOCAL-RUN.md);
//   - the Apify actor (bbbApify.js), which returns fields, not HTML, and
//     is mapped to the same profile shape below;
//   - a superadmin uploading rows the script produced elsewhere.
//
// ══ JSON-LD first, the <dl> second ════════════════════════════════════════
//
// The profile page embeds a schema.org LocalBusiness block with `employee`
// [{ givenName, familyName, jobTitle, honorificPrefix }], `foundingDate`,
// `telephone`, `address` and `additionalProperty` for the accreditation and
// the rating. That is the business's own structured statement and is read
// first. The "Business Details" <dl> (Principal Contacts, Business Started,
// Type of Entity, Years in Business) is read as the fallback and as the
// source of what JSON-LD does not carry (entity type). Both are pure
// string work; no DOM library, because the two shapes are regular and a
// dependency here would be a dependency in the local script too.
import { tidyPersonName } from "./people";

export const BBB_PROFILE_PARSER_VERSION = "1";

const decode = (s) =>
  String(s ?? "")
    .replace(/<!--.*?-->/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Every JSON-LD block on a page, parsed, flattened; bad JSON skipped. */
export function jsonLdBlocks(html) {
  const out = [];
  const re = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(String(html ?? "")))) {
    try {
      const parsed = JSON.parse(m[1]);
      for (const node of Array.isArray(parsed) ? parsed : [parsed]) if (node && typeof node === "object") out.push(node);
    } catch {
      // A malformed block is not a profile; the <dl> path still runs.
    }
  }
  return out;
}

/** "Mr. Alexander Singer, Owner" → { name, givenName, role }. */
export function parseContactLine(line) {
  const s = decode(line);
  if (!s) return null;
  const [namePart, ...roleParts] = s.split(",");
  const person = tidyPersonName(namePart);
  if (!person?.name) return null;
  const role = roleParts.join(",").replace(/\s+/g, " ").trim() || null;
  return { name: person.name, givenName: person.givenName, role };
}

/** The <dd> values under a <dt> whose text matches. */
function dlValues(html, dtPattern) {
  const out = [];
  const re = new RegExp(`<dt[^>]*>\\s*(?:${dtPattern})\\s*:?\\s*</dt>([\\s\\S]*?)(?=<dt|</dl>)`, "i");
  const m = re.exec(html);
  if (!m) return out;
  const ddRe = /<dd[^>]*>([\s\S]*?)<\/dd>/gi;
  let d;
  while ((d = ddRe.exec(m[1]))) {
    const v = decode(d[1]);
    if (v) out.push(v);
  }
  return out;
}

/** schema.org numberOfEmployees → the band as text, or null. */
function employeesFromJsonLd(node) {
  if (node === null || node === undefined) return null;
  if (typeof node === "number" || typeof node === "string") {
    const v = String(node).trim();
    return /^\d{1,6}(\s*[-–]\s*\d{1,6}|\+)?$/.test(v) ? v : null;
  }
  if (typeof node !== "object") return null;
  const min = node.minValue ?? null;
  const max = node.maxValue ?? null;
  if (min !== null && max !== null && /^\d+$/.test(String(min)) && /^\d+$/.test(String(max))) return `${min}-${max}`;
  if (min !== null && max === null && /^\d+$/.test(String(min))) return `${min}+`;
  return employeesFromJsonLd(node.value ?? null);
}

function yearOf(value) {
  const m = String(value ?? "").match(/(\d{4})/);
  const y = m ? Number(m[1]) : NaN;
  return Number.isInteger(y) && y >= 1800 && y <= 2100 ? y : null;
}

/**
 * The profile, or null when the HTML is not a BBB business profile.
 *
 * @returns { url, name, phone, website, address: { line, city, province,
 *            postalCode, country }, rating, accredited, businessStartedYear,
 *            businessIncorporated, businessIncorporatedYear,
 *            yearsInBusiness, entityType, employeeRange, people: [{ name,
 *            givenName, role, kind }], categories, parser }
 *
 * `people` carries BOTH Principal Contacts (kind "principal") and Business
 * Management (kind "management"); the JSON-LD `employee` list is the
 * management list. A name in Principal Contacts is preferred by the card
 * through its role, not its position, so the two are merged by name.
 */
export function parseBbbProfile(html, { url = null } = {}) {
  const page = String(html ?? "");
  const blocks = jsonLdBlocks(page);
  const business = blocks.find((b) => /LocalBusiness|Organization/i.test(String(b["@type"] || "")));
  const nameFromHtml = decode((page.match(/id="businessName"[^>]*>([\s\S]*?)<\/span>/i) || [])[1] || "");
  const name = decode(business?.name || nameFromHtml);
  if (!name && !/bpr-details|Principal Contacts/i.test(page)) return null;

  const people = new Map();
  const put = (person, kind) => {
    if (!person?.name) return;
    const key = person.name.toLowerCase();
    const prev = people.get(key);
    if (prev) {
      if (!prev.role && person.role) prev.role = person.role;
      if (kind === "principal") prev.kind = "principal";
      return;
    }
    people.set(key, { ...person, kind });
  };
  for (const line of dlValues(page, "Principal Contacts?")) put(parseContactLine(line), "principal");
  for (const e of Array.isArray(business?.employee) ? business.employee : []) {
    const full = [e.givenName, e.familyName].filter(Boolean).join(" ") || e.name;
    const person = tidyPersonName(full);
    if (person?.name) put({ name: person.name, givenName: e.givenName ? String(e.givenName).trim() : person.givenName, role: e.jobTitle ? String(e.jobTitle).trim() : null }, "management");
  }
  for (const line of dlValues(page, "Business Management")) put(parseContactLine(line), "management");

  const props = new Map((Array.isArray(business?.additionalProperty) ? business.additionalProperty : []).map((p) => [String(p?.name || "").toLowerCase(), String(p?.value ?? "")]));
  const ratingRaw = props.get("bbb rating") || decode((page.match(/class="bpr-letter-grade"[^>]*>([\s\S]*?)<\/span>/i) || [])[1] || "");
  const rating = /^(A\+|A|A-|B\+|B|B-|C\+|C|C-|D\+|D|D-|F|NR)$/i.test(ratingRaw) ? ratingRaw.toUpperCase() : null;
  const accRaw = props.get("bbb accreditation") || "";
  let accredited = null;
  if (/not bbb accredited/i.test(accRaw) || /is NOT a BBB Accredited Business|NOT <a[^>]*>BBB Accredited/i.test(page)) accredited = false;
  else if (/accredited/i.test(accRaw) || /BBB Accredited Since/i.test(page)) accredited = true;

  const started = dlValues(page, "Business Started")[0] || business?.foundingDate || null;
  const yearsRaw = decode((page.match(/Years in Business:?<\/strong>([\s\S]*?)<\/p>/i) || [])[1] || "");
  const yearsInBusiness = /^\d{1,3}$/.test(yearsRaw) ? Number(yearsRaw) : null;
  const entityType = dlValues(page, "Type of Entity")[0] || null;
  // "Number of Employees" is on a MINORITY of profiles — measured
  // 2026-09-21: one of the 54 profiles matched in production carried it,
  // and two of three opened by hand that day had no such row at all. When
  // it is there it is in the Business Details <dl> AND in the JSON-LD as
  // schema.org numberOfEmployees ({ value } or { minValue, maxValue }); the
  // <dl> is read first, the JSON-LD covers a page whose <dl> was cut. A
  // band is kept as BBB wrote it ("2", "6-10", "51+"): planFit.js parses
  // those shapes and nothing here rounds or invents.
  const employees = dlValues(page, "Number of Employees")[0] || employeesFromJsonLd(business?.numberOfEmployees) || null;
  const employeeRange = employees ? employees.replace(/\s+/g, "") : null;
  // The incorporation date, when BBB lists one, is a fact about the
  // entity, not about when the trade started: a plumber incorporated in
  // 2020 may have run the same vans as a sole proprietor since 2011. It is
  // carried beside businessStartedYear, never folded into it.
  const incorporated = dlValues(page, "Business Incorporated")[0] || null;

  const address = business?.address || {};
  const phone = decode(business?.telephone || (page.match(/href="tel:([^"]+)"/i) || [])[1] || "") || null;
  const website = (page.match(/<a href="(https?:\/\/[^"]+)"[^>]*rel="nofollow noreferrer"[^>]*>\s*(?:<svg[\s\S]*?<\/svg>)?\s*Visit Website/i) || [])[1] || null;
  const categories = dlValues(page, "Business Categories")[0]?.split(",").map((c) => c.trim()).filter(Boolean) || [];

  return {
    url: business?.url || business?.["@id"] || url || null,
    name,
    phone,
    website,
    address: {
      line: decode(address.streetAddress || "") || null,
      city: decode(address.addressLocality || "") || null,
      province: decode(address.addressRegion || "") || null,
      postalCode: decode(address.postalCode || "") || null,
      country: decode(address.addressCountry || "") || null,
    },
    location: business?.geo && Number.isFinite(Number(business.geo.latitude)) ? { latitude: Number(business.geo.latitude), longitude: Number(business.geo.longitude) } : null,
    rating,
    accredited,
    businessStartedYear: yearOf(started),
    businessStarted: started ? decode(started) : null,
    businessIncorporated: incorporated ? decode(incorporated) : null,
    businessIncorporatedYear: yearOf(incorporated),
    yearsInBusiness,
    entityType,
    employeeRange,
    people: [...people.values()],
    categories,
    parser: BBB_PROFILE_PARSER_VERSION,
  };
}

/**
 * The businesses a BBB search page lists, from its JSON-LD ItemList — the
 * only reliable part of that page, since the cards are interleaved with
 * advertisements whose links go through doubleclick. Names carry <em>
 * highlight tags around the query words; stripped here.
 *
 * @returns [{ name, url, phone, city, province, postalCode, addressLine }]
 */
export function parseBbbSearch(html) {
  const out = [];
  for (const block of jsonLdBlocks(html)) {
    const list = block?.mainEntity?.itemListElement || (block?.["@type"] === "ItemList" ? block.itemListElement : null);
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      const item = entry?.item || entry;
      if (!item?.name || !item?.url) continue;
      if (!/\/profile\//.test(String(item.url))) continue;
      out.push({
        name: decode(item.name),
        url: String(item.url).replace(/\/addressId\/\d+$/, ""),
        phone: decode(item.telephone || "") || null,
        addressLine: decode(item.address?.streetAddress || "") || null,
        city: decode(item.address?.addressLocality || "") || null,
        province: decode(item.address?.addressRegion || "") || null,
        postalCode: decode(item.address?.postalCode || "") || null,
        country: decode(item.address?.addressCountry || "") || null,
      });
    }
  }
  return out;
}

/** A search result → the neutral listing shape listingMatch.js reads. */
export function searchResultAsListing(result = {}) {
  return {
    source: "bbb",
    externalId: result.url,
    name: result.name,
    phone: result.phone,
    addressLine: result.addressLine,
    city: result.city,
    province: result.province,
    postalCode: result.postalCode,
    country: result.country,
  };
}

/** The search URL the rep or the script opens. */
export function bbbSearchUrlFor({ businessName, city, province } = {}) {
  const params = new URLSearchParams({ find_text: String(businessName || "").trim() });
  const loc = [city, province].filter(Boolean).join(", ");
  if (loc) params.set("find_loc", loc);
  return `https://www.bbb.org/search?${params.toString()}`;
}
