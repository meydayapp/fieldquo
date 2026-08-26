// lib/pricing/offerings.js
//
// Everything one company can actually put a price on, in one place.
//
// ── Why this file exists ────────────────────────────────────────────────────
//
// A caller rang a cabinet painter and asked for new hinges and handles. The
// call-to-quote draft told the owner, in the company's own back office:
//
//     "They also asked about new hinges and handles for cabinets, which you
//      don't offer — nothing was added for it."
//
// That was false. `TRADE_PRICE_BOOKS.cabinet_refinishing.addOns` prices
// soft-close hinges at $35 a door and handle holes at $12, the company's own
// Products list carries "Soft-Close Hinges" and "New Handles — supply &
// install", and on a thirty-door kitchen the hinges alone are $1,050. The
// draft said no to a live sale because it was reading ONE table — the enabled
// ServiceCategory rows and their intake fields — and calling everything else
// absent.
//
// The bug was not that a table was wrong. It was that "the catalogue" had no
// definition, so whoever wrote the reader picked the slice they knew about.
// This file is that definition, and anything that wants to answer "do we sell
// this?" reads it rather than picking a slice of its own.
//
// ── An offering takes SIX shapes, and they are not interchangeable ─────────
//
//   1. The trade itself      an enabled CompanyServiceCategory. "Cabinet
//                            refinishing" is a thing you can buy.
//   2. Its intake questions  app/data/quoteIntakeFields.js, or the category's
//                            own customFields. A question the estimator is
//                            asked ("Cabinet Doors", "New Hardware") names
//                            something the job can contain.
//   3. Priced add-ons        TRADE_PRICE_BOOKS[key].addOns — upgrades the
//                            quote builder sells beside the base scope, priced
//                            per door/drawer/flat. THIS is the slice the draft
//                            was blind to.
//   4. Priced extras         TRADE_PRICE_BOOKS[key].extras — the same idea for
//                            trades quoted from a takeoff (gutter guard, crack
//                            filling, air sealing). Reachable from the takeoff
//                            form rather than a checkbox, so a caller asking
//                            for one is a "check this", not a line we can set.
//   5. Materials             InstantQuoteConfig materials for instant trades,
//                            and doorMaterials on a refacing book.
//   6. The company's own     Product rows, category-linked, seeded from
//      products & services   app/data/standardAddOns.js and then edited freely.
//                            "Glass Inserts" exists for exactly one company.
//
// Tiered packages (junk removal loads, detailing tiers) are a seventh, carried
// here too because a caller naming one is naming something sellable.
//
// ── No prices leave this file ───────────────────────────────────────────────
//
// Every function returns LABELS and KEYS. A rate is used only as a predicate —
// "is this add-on switched on for this company" — and never travels. The
// consumer that made this necessary is a model prompt (lib/ai/callQuoteDraft.js)
// and non-negotiable #4 is that a rate card is not published; a rate in the
// context is a rate that can end up in the output.
//
// ── Zero is not an offering ─────────────────────────────────────────────────
//
// cabinetAddOnLines() filters out any line whose amount is not above zero, so a
// company that zeroed `softCloseHingesPerDoor` cannot put soft-close hinges on
// a quote no matter what is ticked. Claiming it as an offering here would be
// the dead control AGENTS.md is about, one indirection further out. So an
// add-on counts as offered only when the company's OWN merged book prices it.

import {
  TRADE_PRICE_BOOKS,
  PRICE_BOOK_FIELDS,
  getPriceBook,
  readField,
} from "@/app/data/tradePriceBooks";
import { fieldsForCategory } from "@/app/data/quoteIntakeFields";
import { getTieredPackage } from "@/app/data/tieredPackages";

/* ── 3. Priced add-ons the builder can actually tick ───────────────────────── */

/**
 * The add-ons a scope group can carry as a boolean, and the book paths that
 * price them.
 *
 * The KEY is the flag `cabinetAddOnLines` reads off the group; the PATHS are
 * what `getPriceBook` has to price before the flag means anything. Labels are
 * NOT here — they are read from PRICE_BOOK_FIELDS, which already declares one
 * per path for the settings screen. A second list of names is the copy that
 * rots, and it would rot in the direction of telling a caller the wrong thing.
 *
 * `needs` names the count the add-on multiplies. A caller who asked for drawer
 * slides on a job with no drawer count gets the flag and no line, which is the
 * honest outcome: the request survives, the quantity stays absent.
 */
export const ADD_ON_FLAGS = {
  cabinet_refinishing: [
    { key: "handleHoles", paths: ["addOns.handleHolesPerDoor"], needs: "doors" },
    { key: "softCloseHinges", paths: ["addOns.softCloseHingesPerDoor"], needs: "doors" },
    { key: "drawerSlides", paths: ["addOns.drawerSlidesPerDrawer"], needs: "drawers" },
    { key: "twoTone", paths: ["addOns.twoToneFlat", "addOns.twoTonePerUnit"], needs: null },
    { key: "threeTone", paths: ["addOns.threeToneFlat", "addOns.threeTonePerUnit"], needs: null },
  ],
  // Refacing prices the same upgrades off its own book. Listed rather than
  // aliased so a shop that stops fitting slides on refacing jobs can zero one
  // book without silently changing the other.
  cabinet_refacing: [
    { key: "handleHoles", paths: ["addOns.handleHolesPerDoor"], needs: "doors" },
    { key: "softCloseHinges", paths: ["addOns.softCloseHingesPerDoor"], needs: "doors" },
    { key: "drawerSlides", paths: ["addOns.drawerSlidesPerDrawer"], needs: "drawers" },
    { key: "twoTone", paths: ["addOns.twoToneFlat", "addOns.twoTonePerUnit"], needs: null },
    { key: "threeTone", paths: ["addOns.threeToneFlat", "addOns.threeTonePerUnit"], needs: null },
  ],
};

/** The settings-screen label for a book path, or null. Never model-written. */
function labelForPath(categoryKey, path) {
  const fields = Object.prototype.hasOwnProperty.call(PRICE_BOOK_FIELDS, categoryKey)
    ? PRICE_BOOK_FIELDS[categoryKey]
    : null;
  const hit = (fields || []).find((f) => f.path === path);
  return hit?.label || null;
}

const priced = (book, path) => Number(readField(book, path)) > 0;

/**
 * The add-ons THIS company can sell on this trade — key and label, no rate.
 *
 * @param categoryKey  a ServiceCategory key
 * @param overrides    CompanyServiceCategory.rates, the sparse patch over the
 *                     code defaults. Null for a company that never edited them.
 */
export function addOnsForCategory(categoryKey, overrides = null) {
  const flags = Object.prototype.hasOwnProperty.call(ADD_ON_FLAGS, categoryKey)
    ? ADD_ON_FLAGS[categoryKey]
    : null;
  if (!flags) return [];
  const book = getPriceBook(categoryKey, overrides);
  if (!book) return [];

  return flags
    // At least one of the paths has to carry a real rate. Two-tone is a flat
    // fee PLUS a per-unit fee and a company may legitimately charge only one.
    .filter((f) => f.paths.some((p) => priced(book, p)))
    .map((f) => ({
      key: f.key,
      label: f.paths.map((p) => labelForPath(categoryKey, p)).find(Boolean) || f.key,
      needs: f.needs,
    }));
}

/** Every book path a tickable add-on prices from, for one trade. */
function flagPaths(categoryKey) {
  const flags = Object.prototype.hasOwnProperty.call(ADD_ON_FLAGS, categoryKey)
    ? ADD_ON_FLAGS[categoryKey]
    : null;
  return new Set((flags || []).flatMap((f) => f.paths));
}

/** Is `key` a real, priced add-on on this trade for this company? */
export function isOfferedAddOn(categoryKey, key, overrides = null) {
  return addOnsForCategory(categoryKey, overrides).some((a) => a.key === key);
}

/* ── 4. Priced extras on takeoff trades ────────────────────────────────────── */

// Path prefixes that price something ALONGSIDE the main scope. Deliberately the
// same two prefixes lib/../tradePriceBooks.js excludes from priceBookBasis: a
// gutter guard is priced per foot, but "per foot of guard" is not what a gutter
// job is quoted by. What that file excludes as "not the basis" is precisely
// what this one collects as "also sold".
const EXTRA_PREFIXES = ["addOns.", "extras."];

/**
 * Everything a trade sells beside its base scope, as labels.
 *
 * Includes the flag add-ons above AND the takeoff extras that no checkbox can
 * set. Both belong in "do we sell this?", and they differ only in what can be
 * DONE about a match — see lib/ai/callQuoteDraft.js, where a flag add-on lands
 * on the draft and an extra becomes something for the estimator to check.
 *
 * `internal: true` fields are excluded: a supplier cost is not an offering, and
 * putting one in a prompt is putting a margin in a prompt.
 */
export function pricedExtrasForCategory(categoryKey, overrides = null) {
  const fields = Object.prototype.hasOwnProperty.call(PRICE_BOOK_FIELDS, categoryKey)
    ? PRICE_BOOK_FIELDS[categoryKey]
    : null;
  if (!fields) return [];
  const book = getPriceBook(categoryKey, overrides);
  if (!book) return [];

  const seen = new Set();
  const out = [];
  for (const field of fields) {
    if (field.internal) continue;
    if (!EXTRA_PREFIXES.some((p) => field.path.startsWith(p))) continue;
    if (!priced(book, field.path)) continue;
    if (seen.has(field.label)) continue;
    seen.add(field.label);
    out.push({ path: field.path, label: field.label });
  }
  return out;
}

/* ── 5. Materials ──────────────────────────────────────────────────────────── */

/**
 * Door materials a refacing book offers. The instant-quote materials come from
 * the company's InstantQuoteConfig instead (lib/estimate/callEstimate.js) —
 * both are materials, they just live in different places for different trades,
 * and a caller naming either has named something real.
 */
export function bookMaterialsForCategory(categoryKey, overrides = null) {
  const book = getPriceBook(categoryKey, overrides);
  const materials = book?.doorMaterials;
  if (!materials) return [];
  return Object.entries(materials).map(([key, m]) => ({
    key,
    label: m?.label || key,
  }));
}

/* ── 7. Tiered packages ────────────────────────────────────────────────────── */

/** Package tiers and named items, for the three trades priced from a menu. */
export function tiersForCategory(categoryKey) {
  const pack = getTieredPackage(categoryKey);
  if (!pack) return [];
  return [
    ...(pack.tiers || []),
    ...(pack.singleItems || []),
    ...(pack.addOns || []),
  ]
    .filter((t) => t && t.label)
    .map((t) => ({ key: t.key, label: t.label }));
}

/* ── The whole catalogue, for one company ──────────────────────────────────── */

/**
 * One company's sellable surface, assembled from every shape above.
 *
 * Pure: it takes rows that were already loaded rather than loading them, so a
 * check script can execute it against a fixture company and a route can hand it
 * what it queried. Nothing here touches the database.
 *
 * @param categories [{ id, key, label, customFields, rates }]  ENABLED rows only.
 *                   Filtering is the caller's job because "enabled" lives on
 *                   CompanyServiceCategory and this function is given the
 *                   joined shape.
 * @param materials  { [categoryKey]: [{ key, label }] } instant-quote materials
 * @param products   [{ id, name, categoryKeys: [] }] the company's own Products
 *                   & Services. A product with no categories is offered on every
 *                   quote type — see the Product.categories comment in schema.
 */
export function companyOfferings({
  categories = [],
  materials = {},
  products = [],
} = {}) {
  const rows = (Array.isArray(categories) ? categories : []).filter(
    (c) => c && c.key && c.id,
  );

  return rows.map((c) => {
    const overrides = c.rates || null;
    const productsHere = (Array.isArray(products) ? products : []).filter(
      (p) =>
        p &&
        p.name &&
        (!Array.isArray(p.categoryKeys) ||
          p.categoryKeys.length === 0 ||
          p.categoryKeys.includes(c.key)),
    );

    return {
      id: c.id,
      key: c.key,
      label: c.label || c.key,
      fields: (fieldsForCategory(c) || [])
        .filter((f) => f && f.key)
        .map((f) => ({
          key: f.key,
          label: f.label || f.key,
          type: f.type || "text",
          ...(Array.isArray(f.options) ? { options: f.options } : {}),
        })),
      // What a checkbox on the builder can turn on, priced from this company's
      // own merged book.
      addOns: addOnsForCategory(c.key, overrides),
      // Sold, but only reachable through a takeoff form. A match here is a
      // "check whether this belongs", never a line this draft can set.
      //
      // Minus the ones already listed above. pricedExtrasForCategory collects
      // both `addOns.` and `extras.`, because "what else does this trade sell"
      // is one question; here they are two answers, and listing a tickable
      // upgrade twice would tell the model it has two ways to ask for one
      // thing — and, worse, halve its weight in matchOfferings, which is how
      // "Soft-close hinges" lost a tie to "Cabinet Doors" on a call about
      // hinges.
      extras: pricedExtrasForCategory(c.key, overrides).filter(
        (e) => !flagPaths(c.key).has(e.path),
      ),
      materials: [
        ...(Array.isArray(materials[c.key]) ? materials[c.key] : []),
        ...bookMaterialsForCategory(c.key, overrides),
      ].filter((m) => m && m.key),
      tiers: tiersForCategory(c.key),
      products: productsHere.map((p) => ({ id: p.id, name: p.name })),
    };
  });
}

/* ── Was it really absent from the catalogue? ───────────────────────────────── */
//
// "You don't offer that" is a claim about somebody's business, made to them,
// about their own customer. It has to be earned, and the way it was being
// earned — the model failed to place it, therefore it does not exist — is not
// earning it. So every phrase the model could not place is checked AGAIN here,
// against every shape above, before anyone is told no.
//
// Deliberately blunt and deliberately generous. A false positive says "they
// asked for hinges, check whether that belongs on this quote", which costs a
// glance. A false negative tells a contractor they don't sell something they
// sell, which costs the job. Those are not the same mistake and this errs
// towards the cheap one.

// Words that carry no trade meaning. Kept short: a long stopword list is
// another table to maintain, and the length floor below already removes most
// noise.
const STOPWORDS = new Set([
  "and", "the", "for", "with", "some", "also", "new", "your", "their", "that",
  "this", "have", "need", "want", "would", "like", "about", "them", "they",
  "just", "maybe", "please", "could", "into", "from", "onto", "over", "per",
  "each", "any", "all", "more", "other", "another", "one", "two", "three",
  "get", "got", "put", "add", "make", "does", "doing", "done", "job", "work",
  "quote", "price", "cost", "thing", "things", "stuff", "kind", "sort",
  // Verbs of doing. A trade catalogue is full of them — "New Handles — supply
  // & install", "Cabinet Box Skinning" — and matching on one made "install a
  // hot tub" look like a handle. What a caller wants is a NOUN; the verb in
  // front of it identifies nothing. "removal" is deliberately absent: a caller
  // asking to have something removed and a line called "Removal & Disposal"
  // are talking about the same job.
  "install", "installed", "installing", "installation", "supply", "supplied",
  "fit", "fitted", "fitting", "provide", "included", "including",
]);

/**
 * A word reduced to something two spellings of it share.
 *
 * Two steps, both deliberately crude: drop a plural "s", then drop a trailing
 * "e". The second step exists because the first is not enough on its own —
 * "handles" loses its "s" and becomes "handle", which is right, while a rule
 * that strips "es" instead turns it into "handl" and stops matching the
 * singular. Dropping the "e" from both ends the argument: "handles" → "handl"
 * and "handle" → "handl", "hinges" → "hing" and "hinge" → "hing".
 *
 * Not a real stemmer and not trying to be. An aggressive one would collapse
 * words that have nothing to do with each other, and the cost of a miss here is
 * one extra line on a review panel.
 */
export function stem(word) {
  let w = String(word || "").toLowerCase();
  if (w.endsWith("ies") && w.length > 4) w = `${w.slice(0, -3)}y`;
  // "glass" and "gutters" both end in s; only one of them is a plural.
  else if (w.endsWith("s") && !w.endsWith("ss") && w.length > 3) w = w.slice(0, -1);
  if (w.endsWith("e") && w.length > 4) w = w.slice(0, -1);
  return w;
}

/** The words in a phrase that could identify a trade offering. */
export function offeringTokens(text) {
  const out = new Set();
  for (const raw of String(text ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)) {
    if (!raw) continue;
    if (STOPWORDS.has(raw)) continue;
    const s = stem(raw);
    // Four characters is the floor. Below it a shared token is a coincidence
    // ("per", "ft", "in") rather than a subject.
    if (s.length < 4 || STOPWORDS.has(s)) continue;
    out.add(s);
  }
  return out;
}

/**
 * Everything one offering entry can be recognised by — its own label plus the
 * labels of everything inside it, each as its own candidate so a match can say
 * WHICH part matched.
 */
function candidatesFor(offering) {
  const out = [{ kind: "service", key: offering.key, label: offering.label }];
  for (const f of offering.fields || [])
    out.push({ kind: "field", key: f.key, label: f.label, service: offering.key });
  for (const a of offering.addOns || [])
    out.push({ kind: "addOn", key: a.key, label: a.label, service: offering.key });
  for (const e of offering.extras || [])
    out.push({ kind: "extra", key: e.path, label: e.label, service: offering.key });
  for (const m of offering.materials || [])
    out.push({ kind: "material", key: m.key, label: m.label, service: offering.key });
  for (const t of offering.tiers || [])
    out.push({ kind: "tier", key: t.key, label: t.label, service: offering.key });
  for (const p of offering.products || [])
    out.push({ kind: "product", key: p.id, label: p.name, service: offering.key });
  return out;
}

/**
 * What in this company's catalogue a phrase might be asking for.
 *
 * Returns [] when nothing shares a meaningful word — the only case in which
 * anyone is entitled to say "you don't offer that". Otherwise the matches are
 * returned in descending order of how many words they share, capped, and the
 * caller reports them as something to CHECK rather than something it decided.
 *
 * @param phrase     what the caller asked for, in the model's plain words
 * @param offerings  companyOfferings() output
 */
export function matchOfferings(phrase, offerings, { limit = 3 } = {}) {
  const wanted = offeringTokens(phrase);
  if (!wanted.size) return [];

  const candidates = [];
  for (const offering of Array.isArray(offerings) ? offerings : []) {
    for (const candidate of candidatesFor(offering)) {
      candidates.push({ ...candidate, tokens: offeringTokens(candidate.label) });
    }
  }

  // How many things in this catalogue use each word. "cabinet" is in the trade
  // name, in two intake fields and in half the Products of a cabinet shop;
  // "hinge" is in one add-on. Without this, a caller asking for hinges on
  // cabinets got back three labels that shared the word "cabinet" and none that
  // shared the word they actually rang about, because every match scored 1 and
  // ties broke alphabetically. A word that describes everything describes
  // nothing, so it is worth proportionally less.
  const frequency = new Map();
  for (const c of candidates)
    for (const t of c.tokens) frequency.set(t, (frequency.get(t) || 0) + 1);

  const scored = [];
  for (const candidate of candidates) {
    let score = 0;
    for (const t of candidate.tokens)
      if (wanted.has(t)) score += 1 / (frequency.get(t) || 1);
    if (score > 0) scored.push({ ...candidate, score });
  }

  scored.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
  // One entry per label: the same upgrade sold as a price-book add-on AND as a
  // Product row is one thing to check, not two.
  const seen = new Set();
  const out = [];
  for (const hit of scored) {
    const dedupe = hit.label.toLowerCase();
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push(hit);
    if (out.length >= limit) break;
  }
  return out;
}
