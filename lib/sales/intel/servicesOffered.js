// lib/sales/intel/servicesOffered.js
//
// The services a prospect's own website says it offers — each one cited to
// the evidence row it was read from, and never invented.
//
// ══ Why this file exists ═══════════════════════════════════════════════════
//
// The owner, on what the crawler was getting wrong: "not identifying the
// services the company offers or not properly reading the website and
// making false claims which then create a false interpretation of what they
// have or might not have". Before this file the only service list a rep saw
// was the home page's menu (`nav_link` rows, url.js serviceMenu), which a
// JavaScript-drawn menu hides entirely, and the site-inference model was
// free to write "roofing, siding and gutters" from a page that said roofing.
//
// Six sources now, in the order they are trusted, every one a row the crawler
// stored with a URL:
//
//   schema        a `Service` / `Offer.itemOffered` / `hasOfferCatalog` name
//                 in the site's own JSON-LD (schemaFacts.js). The business,
//                 describing itself, for machines.
//   menu          a `nav_link` label off the home page — "Gutter Guard
//                 Installation". What a visitor reads.
//   wp            a WordPress REST page whose PATH or TITLE names a service,
//                 or any item of a `services` post type (structured.js).
//   sitemap       a `sitemap_url` under /services/ or whose last segment
//                 carries a trade word — "/epoxy-flooring". Read from the
//                 path, so "epoxy-flooring" becomes "Epoxy Flooring".
//   page_heading  an h1–h3 that carries a trade word and is short enough to
//                 be a name rather than a sentence.
//   rendered_text a line of a framework payload's recovered copy, under the
//                 same test as a heading. Last, and few: it is prose.
//
// ══ What is refused ═══════════════════════════════════════════════════════
//
// A path or a title is a service only when it LOOKS like one: under a
// services section, or carrying a word from the trade vocabulary
// (lib/sales/discovery/tradeSuggest.js NAME_KEYWORDS — reused, not copied,
// so a word added there is a word known here). "About", "Contact", "Blog",
// "Privacy" and every other chrome label fail url.js's isChromeLabel, the
// same test the menu applies. A heading or a payload line is a service only
// with a trade word AND no sentence shape. Nothing here reads body prose.
//
// The one place prose IS read — the site-inference model — is constrained
// by this list: siteInference.js hands the model these names, tells it not
// to add one, and drops any name that is not a substring of the material.
//
// ══ Stored as an inference, cited to its rows ═════════════════════════════
//
// `ProspectInference` kind `services`, one row per prospect, value a compact
// JSON list of `{ name, source, sourceUrl, tradeKey, confidence }`,
// evidenceIds the rows each name came from. An inference, not a capability:
// "they list roofing" is a reading of their pages, and the queue's
// inference layer is where readings live. The value is JSON rather than a
// bucket, which prospectView.js renders as a FACT ROW ("Services they
// list") rather than through inferenceStatement — for the reason the
// derived_site inference is rendered on the Website fact: the bucket rule
// ("a number is not a bucket") is about counts, and a list of names is not
// one. Nothing renders the raw JSON.
//
// Pure. Rows in, list out; the handler writes it.
import { nameTrades } from "@/lib/sales/discovery/tradeSuggest";
import { isChromeLabel, slugKind, tokeniseSegment } from "@/lib/sales/crawl/url";
import { SERVICES_INFERENCE_KIND } from "@/lib/sales/inferenceKinds";
import { schemaFactsOfBlock } from "./schemaFacts";

export { SERVICES_INFERENCE_KIND };
export const SERVICES_DETECTOR = "services";
/** Bumped when what this file DECIDES changes. */
export const SERVICES_DETECTOR_VERSION = "1";
/** The most names one prospect carries. A menu of forty items is a menu of
 *  forty items; the rep's card shows the first eight and says "…". */
export const MAX_SERVICES = 25;

/** The evidence types read. The handler loads exactly these. */
export const SERVICE_EVIDENCE_TYPES = Object.freeze(["nav_link", "sitemap_url", "schema_org", "wp_page", "heading", "rendered_text"]);

/** Source order = trust order. Ties in confidence break on this. */
export const SERVICE_SOURCES = Object.freeze(["schema", "menu", "wp", "sitemap", "page_heading", "rendered_text"]);

const CONFIDENCE = Object.freeze({ schema: 0.85, menu: 0.8, wp: 0.7, sitemap: 0.6, page_heading: 0.5, rendered_text: 0.45 });

/** A menu label that is a SERVICE by its words — a trade word, or a verb of
 *  the work (install, repair, cleaning, removal, replacement…) — keeps the
 *  menu's full confidence; any other menu label is still their menu and
 *  still listed, one notch down, so the rep's eight-name card leads with
 *  "Gutter Guard Installation" and not "Lido Beach". Measured on 2,000
 *  crawled menus (2026-09-14): town names, "References", "Bookings" and
 *  "Commercial" were outranking the services beside them. */
const WORK_WORDS = /\b(install|installation|installations|repair|repairs|replace|replacement|clean|cleaning|removal|remov|service|services|maintenance|inspection|inspections|restoration|remodel|remodeling|renovation|r[ée]novation|construction|design|refinish|refinishing|staining|sealing|coating|waterproofing|grading|excavation|demolition|framing|finishing|painting|plumbing|heating|cooling|electrical|roofing|siding|flooring|landscaping|paving|fencing|decks?|patios?|kitchens?|bathrooms?|basements?|garages?|windows?|doors?|gutters?|drains?|sewer|septic|furnace|boilers?|water heaters?|heat pumps?|air conditioning|ductwork|insulation|drywall|tile|tiling|cabinets?|countertops?|concrete|masonry|asphalt|sealcoating|snow|lawn|tree|irrigation|sprinklers?|pest|mold|mould|chimney|generators?|lighting|wiring|panels?|pool|spa|hot tub|carpet|upholstery|pressure washing|power washing|junk|hauling|pumps?|fixtures?|faucets?|toilets?|showers?|bathtubs?|gas lines?|detection|leaks?|backflow|purifiers?|thermostats?|ventilation|fireplaces?|stone|brick|stucco|epoxy|hardwood|laminate|vinyl|shingles?|skylights?|soffit|fascia|eavestrough|trim|millwork|additions?|dormers?|porch|porches|sheds?|pergolas?|retaining walls?|sod|mulch|hedge|pruning|stump|aeration|fertiliz|weed|toitures?|plomberie|chauffage|climatisation|[ée]lectricit[ée]|peinture|plancher|clôtures?|pavage|excavation|d[ée]neigement|terrassement|isolation|ma[çc]onnerie|b[ée]ton|armoires?|comptoirs?|c[ée]ramique|goutti[èe]res?|portes?|fen[êe]tres?|cuisines?|salles? de bain|sous-sols?|entretien|nettoyage|r[ée]paration|remplacement)\b/i;

/** Is this label a service by its own words? */
export function looksLikeWork(label) {
  return WORK_WORDS.test(String(label || "")) || Boolean(tradeOf(label));
}

/** First path segments that mean "the pages under here are services". */
const SERVICE_SECTIONS = new Set(["services", "service", "our-services", "ourservices", "what-we-do", "solutions", "specialties", "specialities", "nos-services", "servicios"]);

/** Words that make a heading a sentence about a service rather than a
 *  service: "Why choose our roofing team", "Get a free roofing quote". */
const SENTENCE_WORDS = /\b(why|how|what|when|where|who|we|our|your|you|get|call|free|best|top|welcome|about|contact|quote|estimate|today|now|us|the|and|with|for|from|to|of|in|on|at|is|are)\b/i;

/** Accent-folded, lower-cased, punctuation collapsed — the dedupe key. */
export function foldServiceName(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** "gutter-guard-installation" → "Gutter Guard Installation". Small words
 *  stay small after the first: "Repair of Decks" not "Repair Of Decks". */
export function titleFromSlug(segment) {
  const words = tokeniseSegment(segment);
  const small = new Set(["a", "an", "and", "of", "the", "for", "to", "in", "on", "de", "et", "du", "des", "la", "le", "les"]);
  return words
    .map((w, i) => (i > 0 && small.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

/** The trade the vocabulary names for this label, or null. */
export function tradeOf(name) {
  const hits = nameTrades(name);
  return hits.length ? hits[0].tradeKey : null;
}

/**
 * Does this PATH name a service? Under a services section (one level
 * down), or one or two levels deep with a trade word in its last segment.
 * Never a priority page (contact, about, reviews…), never an asset.
 *
 * @returns { name, tradeKey } or null
 */
export function serviceFromPath(path) {
  const clean = String(path || "").split("?")[0].split("#")[0].replace(/\/+$/, "");
  const segments = clean.split("/").filter(Boolean);
  if (!segments.length || segments.length > 2) return null;
  if (/\.(jpe?g|png|gif|webp|svg|pdf|xml|json|txt|css|js)$/i.test(clean)) return null;
  if (slugKind(clean).rank !== Infinity) return null;
  const last = segments[segments.length - 1];
  const name = titleFromSlug(last);
  if (!name || isChromeLabel(name)) return null;
  const underServices = segments.length === 2 && SERVICE_SECTIONS.has(segments[0].toLowerCase());
  if (segments.length === 1 && SERVICE_SECTIONS.has(last.toLowerCase())) return null;
  const tradeKey = tradeOf(name);
  if (!underServices && !tradeKey) return null;
  return { name, tradeKey };
}

/** A heading or a payload line that is a service NAME: a trade word, short,
 *  no sentence shape. */
export function serviceFromHeading(text) {
  const clean = String(text || "").replace(/\s+/g, " ").trim().replace(/[.:!?]+$/, "");
  if (clean.length < 3 || clean.length > 60) return null;
  if (isChromeLabel(clean)) return null;
  if (clean.split(" ").length > 6) return null;
  if (SENTENCE_WORDS.test(clean)) return null;
  const tradeKey = tradeOf(clean);
  if (!tradeKey) return null;
  return { name: clean, tradeKey };
}

/** A WordPress page: any item of a services post type; a `page` only when
 *  its path or its title names a service. */
export function serviceFromWpPage(record) {
  const title = String(record?.title || "").replace(/\s+/g, " ").trim();
  if (!title || isChromeLabel(title)) return null;
  const type = String(record?.type || "page");
  if (type !== "page") return { name: title.slice(0, 80), tradeKey: tradeOf(title) };
  let path = "";
  try {
    path = new URL(String(record.link)).pathname;
  } catch {
    path = "";
  }
  const byPath = path ? serviceFromPath(path) : null;
  const tradeKey = tradeOf(title);
  if (!byPath && !tradeKey) return null;
  if (SENTENCE_WORDS.test(title) && !byPath) return null;
  return { name: title.slice(0, 80), tradeKey: tradeKey || byPath?.tradeKey || null };
}

/** The rows of one type from the LATEST crawl that wrote any: rows are
 *  appended per crawl and never replaced, and a service dropped from the
 *  menu since last month is not on offer. Rows with no observedAt (a
 *  fixture) are all "latest". */
export function latestRows(rows, type) {
  const ofType = rows.filter((r) => r?.type === type);
  let latest = 0;
  for (const r of ofType) {
    const t = r.observedAt ? new Date(r.observedAt).getTime() : 0;
    if (t > latest) latest = t;
  }
  return ofType.filter((r) => (r.observedAt ? new Date(r.observedAt).getTime() : 0) === latest);
}

/**
 * The services the evidence names.
 *
 * @param evidence  ProspectEvidence rows: { id?, type, rawValue,
 *                  normalizedValue, sourceUrl, observedAt? }
 * @returns { services: [{ name, source, sourceUrl, tradeKey, confidence,
 *            evidenceId }], counts: { [source]: n }, evidenceIds: string[] }
 *
 * Deduplicated on the folded name; the first source in trust order wins the
 * name and the others are counted. Ordered by confidence, then source order,
 * then name, and cut at MAX_SERVICES.
 */
export function servicesFrom({ evidence = [] } = {}) {
  const rows = Array.isArray(evidence) ? evidence.filter((r) => r && typeof r === "object") : [];
  const found = new Map();
  const counts = {};
  const add = (source, item, row) => {
    if (!item?.name) return;
    const key = foldServiceName(item.name);
    if (!key) return;
    counts[source] = (counts[source] || 0) + 1;
    if (found.has(key)) return;
    found.set(key, {
      name: item.name,
      source,
      sourceUrl: row?.sourceUrl || null,
      tradeKey: item.tradeKey ?? tradeOf(item.name),
      confidence: Number.isFinite(item.confidence) ? item.confidence : CONFIDENCE[source],
      evidenceId: row?.id || null,
    });
  };

  for (const row of latestRows(rows, "schema_org")) {
    if (typeof row.rawValue !== "string" || !/^\s*[[{]/.test(row.rawValue)) continue;
    const facts = schemaFactsOfBlock(row.rawValue);
    for (const s of facts.services) {
      if (isChromeLabel(s.name)) continue;
      add("schema", { name: s.name }, row);
    }
  }

  for (const row of latestRows(rows, "nav_link")) {
    const name = String(row.rawValue || "").replace(/\s+/g, " ").trim().replace(/\s*(voir|view|see)$/i, "");
    if (!name || isChromeLabel(name)) continue;
    add("menu", { name: name.slice(0, 80), confidence: looksLikeWork(name) ? CONFIDENCE.menu : CONFIDENCE.menu - 0.25 }, row);
  }

  for (const row of latestRows(rows, "wp_page")) {
    let record = null;
    try {
      record = JSON.parse(String(row.rawValue || ""));
    } catch {
      record = null;
    }
    const item = record ? serviceFromWpPage(record) : null;
    if (item) add("wp", item, { ...row, sourceUrl: record?.link || row.sourceUrl });
  }

  for (const row of latestRows(rows, "sitemap_url")) {
    const item = serviceFromPath(String(row.normalizedValue || ""));
    if (item) add("sitemap", item, { ...row, sourceUrl: row.rawValue || row.sourceUrl });
  }

  for (const row of latestRows(rows, "heading")) {
    const item = serviceFromHeading(String(row.rawValue || ""));
    if (item) add("page_heading", item, row);
  }

  let fromText = 0;
  for (const row of latestRows(rows, "rendered_text")) {
    for (const line of String(row.rawValue || "").split("\n")) {
      if (fromText >= 10) break;
      const item = serviceFromHeading(line);
      if (!item) continue;
      fromText += 1;
      add("rendered_text", item, row);
    }
  }

  const services = [...found.values()]
    .sort((a, b) => b.confidence - a.confidence || SERVICE_SOURCES.indexOf(a.source) - SERVICE_SOURCES.indexOf(b.source) || a.name.localeCompare(b.name))
    .slice(0, MAX_SERVICES);
  const evidenceIds = [...new Set(services.map((s) => s.evidenceId).filter(Boolean))];
  return { services, counts, evidenceIds };
}

/** The list as the inference row stores it. Compact keys are NOT used: the
 *  value is read by the queue's presenter and by a superadmin looking at the
 *  row, and `{"n":…}` saves bytes nobody is short of. */
export function servicesValue(services = []) {
  return JSON.stringify(
    services.map((s) => ({ name: s.name, source: s.source, sourceUrl: s.sourceUrl || null, tradeKey: s.tradeKey || null, confidence: s.confidence })),
  );
}

/** The stored value back as a full list, or [] for anything that is not
 *  one. prospectView.js has its own reader of the same shape rather than
 *  importing this file (which reaches tradeSuggest and, through it, the
 *  discovery catalogue) — see inferenceKinds.js for why; the names-only
 *  reader every layer shares is servicesNamesFromValue there. */
export function parseServicesValue(value) {
  try {
    const parsed = JSON.parse(String(value || ""));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((s) => s && typeof s === "object" && typeof s.name === "string" && s.name.trim())
      .map((s) => ({
        name: s.name.trim().slice(0, 80),
        source: SERVICE_SOURCES.includes(s.source) ? s.source : "menu",
        sourceUrl: typeof s.sourceUrl === "string" ? s.sourceUrl : null,
        tradeKey: typeof s.tradeKey === "string" ? s.tradeKey : null,
        confidence: Number.isFinite(s.confidence) ? s.confidence : 0.5,
      }))
      .slice(0, MAX_SERVICES);
  } catch {
    return [];
  }
}
