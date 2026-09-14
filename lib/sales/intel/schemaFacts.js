// lib/sales/intel/schemaFacts.js
//
// What a site's own schema.org markup states, read out of the JSON-LD blocks
// the crawler stores as `schema_org` evidence. Pure, browser-safe, and
// bounded: a block is parsed once, walked to a fixed depth, and anything
// that is not JSON yields nothing.
//
// ══ Why structured data is read at all ════════════════════════════════════
//
// The crawler stored 85,593 `schema_org` rows and the only reader was a
// regex for "openingHours" and one for "AggregateRating". A contractor's
// JSON-LD is the business describing ITSELF in a form built to be read by
// software: `@type: RoofingContractor`, `telephone`, `email`,
// `openingHoursSpecification`, `aggregateRating`, `hasOfferCatalog` with the
// services by name, `potentialAction: ReserveAction` for a booking flow.
// Every one of those is a fact the owner asked the crawler not to miss.
//
// ══ Presence only, never absence ═══════════════════════════════════════════
//
// A block that names no email says nothing about whether the site publishes
// one; most blocks are a breadcrumb list. So nothing here returns "false" —
// a fact is either found, with the block it came from, or not mentioned.
// capabilityDetect.js turns a found fact into a TRUE signal citing the row,
// and its absence rules never look here.
//
// ══ Bounded ═══════════════════════════════════════════════════════════════
//
// Blocks are capped by the crawler at 20 KB each and ten per page; the walk
// below stops at depth 8 and at 400 nodes, and keeps at most 40 service
// names per page. Hostile JSON — a hundred-thousand-element array, a
// self-referential graph (impossible in JSON, but a deep one is not) — costs
// a bounded walk and nothing else.

const MAX_DEPTH = 8;
const MAX_NODES = 400;
const MAX_SERVICES = 40;
const MAX_NAME = 120;

/** schema.org types under LocalBusiness that name a home-service trade or a
 *  business of that shape. Lower-cased. tradeDetect.js owns the trade
 *  MAPPING; this list only says "this block describes a business". */
export const BUSINESS_TYPES = Object.freeze([
  "localbusiness",
  "homeandconstructionbusiness",
  "generalcontractor",
  "plumber",
  "electrician",
  "roofingcontractor",
  "housepainter",
  "hvacbusiness",
  "locksmith",
  "movingcompany",
  "professionalservice",
  "organization",
]);

/** Action types that mean "book / schedule from this page". */
const BOOKING_ACTIONS = new Set(["reserveaction", "scheduleaction", "bookaction"]);

const empty = () => ({
  blocks: 0,
  parsed: 0,
  types: new Set(),
  business: null,
  telephone: [],
  email: [],
  hours: false,
  aggregateRating: false,
  reviews: 0,
  bookingAction: null,
  acceptsReservations: false,
  paymentAccepted: null,
  services: [],
});

function typesOf(node) {
  const t = node?.["@type"];
  if (typeof t === "string") return [t.toLowerCase()];
  if (Array.isArray(t)) return t.filter((x) => typeof x === "string").map((x) => x.toLowerCase());
  return [];
}

function nameOf(node) {
  const n = typeof node?.name === "string" ? node.name : typeof node?.["@id"] === "string" && !/^https?:/.test(node["@id"]) ? node["@id"] : "";
  return n.replace(/\s+/g, " ").trim().slice(0, MAX_NAME);
}

function pushName(list, name) {
  if (!name || list.length >= MAX_SERVICES) return;
  if (list.some((s) => s.name === name)) return;
  list.push({ name });
}

/**
 * The facts in one JSON-LD block. Never throws; a block that is not JSON
 * returns the empty shape with `parsed: 0`.
 */
export function schemaFactsOfBlock(block, facts = empty()) {
  facts.blocks += 1;
  const src = String(block ?? "").trim();
  if (!src.startsWith("{") && !src.startsWith("[")) return facts;
  let root;
  try {
    root = JSON.parse(src);
  } catch {
    return facts;
  }
  facts.parsed += 1;

  let nodes = 0;
  const visit = (node, depth, context) => {
    if (!node || typeof node !== "object" || depth > MAX_DEPTH || nodes++ > MAX_NODES) return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item, depth + 1, context);
      return;
    }
    const types = typesOf(node);
    for (const t of types) facts.types.add(t);
    const isBusiness = types.some((t) => BUSINESS_TYPES.includes(t) || /business|contractor|service$/.test(t));
    const isService = types.includes("service");
    const isOffer = types.includes("offer");
    const isReview = types.includes("review");

    if (isBusiness && !facts.business) facts.business = { type: types[0], name: nameOf(node) || null };
    if (isReview) facts.reviews += 1;
    if (types.includes("aggregaterating") || (node.aggregateRating && typeof node.aggregateRating === "object")) facts.aggregateRating = true;
    if (node.openingHours || node.openingHoursSpecification) facts.hours = true;
    if (node.acceptsReservations === true || node.acceptsReservations === "True" || node.acceptsReservations === "true") facts.acceptsReservations = true;
    if (typeof node.paymentAccepted === "string" && !facts.paymentAccepted) facts.paymentAccepted = node.paymentAccepted.slice(0, 120);

    if (typeof node.telephone === "string" && node.telephone.trim() && facts.telephone.length < 5 && !facts.telephone.includes(node.telephone.trim())) {
      facts.telephone.push(node.telephone.trim().slice(0, 40));
    }
    if (typeof node.email === "string" && /@/.test(node.email) && facts.email.length < 5) {
      const e = node.email.replace(/^mailto:/i, "").trim().toLowerCase().slice(0, 120);
      if (!facts.email.includes(e)) facts.email.push(e);
    }

    // Services, by name: a Service node, an Offer's itemOffered, and the
    // items of an OfferCatalog (`hasOfferCatalog.itemListElement[]`, which
    // is how Google's own example marks a contractor's service list).
    if (isService && context !== "itemOffered") pushName(facts.services, nameOf(node));
    if (isOffer) {
      const item = node.itemOffered;
      if (item && typeof item === "object") pushName(facts.services, nameOf(item));
      else if (typeof item === "string") pushName(facts.services, item.slice(0, MAX_NAME));
    }
    // Catalogue items in the order they are listed: a bare string is a
    // name, an object is visited here so its Offer lands before the next
    // item rather than after every other key.
    const catalogue = (types.includes("offercatalog") || types.includes("itemlist")) && Array.isArray(node.itemListElement);
    if (catalogue) {
      for (const el of node.itemListElement) {
        if (typeof el === "string") pushName(facts.services, el.slice(0, MAX_NAME));
        else if (el && typeof el === "object") visit(el, depth + 1, "itemListElement");
      }
    }

    const actions = Array.isArray(node.potentialAction) ? node.potentialAction : node.potentialAction ? [node.potentialAction] : [];
    for (const a of actions) {
      const at = typesOf(a);
      const hit = at.find((t) => BOOKING_ACTIONS.has(t));
      if (hit && !facts.bookingAction) facts.bookingAction = hit;
    }

    for (const [key, value] of Object.entries(node)) {
      if (key === "@context" || key === "@type") continue;
      if (catalogue && key === "itemListElement") continue;
      if (value && typeof value === "object") visit(value, depth + 1, key);
    }
  };
  visit(root, 0, null);
  return facts;
}

/**
 * The facts across every block on one page snapshot — `page.schema` as
 * technology.js normalises it, which holds each block's JSON AND its
 * lower-cased type list (pagesFromEvidence pushes both). Non-JSON entries
 * are counted as blocks and skipped.
 *
 * Memoised per page object, because capabilityDetect asks several times.
 */
const cache = new WeakMap();
export function schemaFacts(page) {
  if (!page || typeof page !== "object") return empty();
  if (cache.has(page)) return cache.get(page);
  const facts = empty();
  for (const block of page.schema || []) schemaFactsOfBlock(block, facts);
  // Microdata itemtype URLs land in `schema` too, as bare strings —
  // "https://schema.org/LocalBusiness". A type is a type.
  for (const block of page.schema || []) {
    const m = /schema\.org\/([a-z]+)$/i.exec(String(block).trim());
    if (m) facts.types.add(m[1].toLowerCase());
  }
  cache.set(page, facts);
  return facts;
}

/** Service names from raw `schema_org` evidence rows (rawValue = the
 *  block), each with the row it came from, for servicesOffered.js. */
export function schemaServicesFromRows(rows = []) {
  const out = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    if (row?.type !== "schema_org" || typeof row.rawValue !== "string") continue;
    const facts = schemaFactsOfBlock(row.rawValue);
    for (const s of facts.services) out.push({ name: s.name, row });
  }
  return out;
}
