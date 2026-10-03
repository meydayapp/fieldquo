// lib/quotes/servicePicker.js
//
// What the "Add service" control at the foot of a quote (and of an invoice)
// offers, and in what order. The owner (2026-09-25), on the grid of trade
// cards it replaces: "This seems very busy. Maybe it should be a button 'Add
// service' and then a popup … using what they have selected, with a list" —
// and then: "if there are more than 4 it makes a pop-up with the list so it's
// easier to read."
//
// Pure — no React, no database — so scripts/check-service-picker.mjs executes
// every rule here against hostile input. The screen is app/components/quotes/
// builder/AddServicePicker.js; the adds themselves are the builders' own
// functions (QuoteBuilder addScopeGroup / addScopeGroupWithTemplate, the
// invoice's addProductTemplate / addProductLine), never a copy.
//
// ── What is offered ────────────────────────────────────────────────────────
//
// On a quote, one group per QUOTE TYPE the company has enabled (the
// categories the builder already filtered to `enabled`), each holding:
//
//   - the quote type itself — the scope group with its own calculator
//     (cabinet takeoff, room takeoff, stairs, roof…), added by the SAME
//     addScopeGroup(category, label) call the old tiles made. Those were
//     "finessed and perfected" (owner); this file only lists them.
//   - the company's own SERVICES linked to that quote type: Product rows of
//     type service (or untyped), not archived (`active: false` is how a row
//     is archived) — what "Confirm what you quote" and Settings › Services
//     kept. A product (a hinge, a drawer box) is a line, not a service; it
//     stays in each service's "Add line item" library where it always was.
//
// A service linked to no enabled quote type is not offered here: a new scope
// group needs a quote type, and guessing one is the invented statement
// AGENTS.md failure class 5 warns about. It is still one press away inside any
// service ("Add line item" → Products & Services).
//
// On an invoice — which has no quote types — the company's services grouped by
// the quote type they are linked to (its label), and the unlinked ones under
// "Other services"; each listed once, because on an invoice every add goes
// into the same lines.
//
// ── Order ──────────────────────────────────────────────────────────────────
//
// The quote's own trades first, in the order they sit on the quote, then the
// rest in the company's own order. Services by name within a group.

import { newScopeGroup } from "@/lib/quotes/builderPayload";
import { templatesFor } from "@/lib/services/templates";
import { expandServiceTemplate, measurementsFromGroups, keysPricedByGroup, calculatorOfTrade } from "@/lib/quotes/serviceTemplateLines";
import { resolveServiceContent } from "@/lib/documents/serviceContent";
import { isUnitPriced } from "@/app/data/cabinetPricing";
import { getPriceBook, defaultTradeRate } from "@/app/data/tradePriceBooks";

/** "if there are more than 4 it makes a pop-up with the list so it's easier
 *  to read" — the owner, 2026-09-25. Up to this many offerings (quote types
 *  plus services) are drawn inline as buttons; more open the dialog. */
export const INLINE_PICKER_MAX = 4;

const list = (v) => (Array.isArray(v) ? v : []);

/** A row the picker may offer as a service: a service (or untyped) and not archived. */
export function isPickableService(p) {
  return Boolean(p) && typeof p === "object" && p.id != null && p.active !== false && (p.type == null || p.type === "service");
}

function linkedIds(p) {
  return list(p?.categories).map((c) => (c && c.id != null ? String(c.id) : null)).filter(Boolean);
}

const byName = (a, b) => String(a?.name || "").localeCompare(String(b?.name || ""));

/**
 * @param categories         the quote types the builder offers (already enabled-only)
 * @param products           the company's Product rows (/api/products)
 * @param onQuoteCategoryIds the categoryId of every group on the document, in order
 * @param invoice            an invoice's grouping (no quote types)
 * @returns [{ id, label, category|null, onQuote, services: Product[] }]
 */
export function pickerGroups({ categories = [], products = [], onQuoteCategoryIds = [], invoice = false } = {}) {
  const services = list(products).filter(isPickableService);
  if (invoice) {
    const groups = new Map();
    const other = { id: "__other__", label: null, category: null, onQuote: false, services: [] };
    for (const p of services) {
      const first = list(p.categories).find((c) => c && c.id != null);
      if (!first) {
        other.services.push(p);
        continue;
      }
      const id = String(first.id);
      if (!groups.has(id)) groups.set(id, { id, label: String(first.label || ""), category: null, onQuote: false, services: [] });
      groups.get(id).services.push(p);
    }
    const out = [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
    if (other.services.length) out.push(other);
    for (const g of out) g.services.sort(byName);
    return out;
  }
  const seen = new Set();
  const groups = [];
  for (const c of list(categories)) {
    if (!c || c.id == null) continue;
    const id = String(c.id);
    if (seen.has(id)) continue;
    seen.add(id);
    groups.push({
      id,
      label: String(c.label || ""),
      category: c,
      onQuote: false,
      services: services.filter((p) => linkedIds(p).includes(id)).sort(byName),
    });
  }
  const order = [];
  for (const raw of list(onQuoteCategoryIds)) {
    const id = raw == null ? null : String(raw);
    if (id && !order.includes(id)) order.push(id);
  }
  const onQuote = order.map((id) => groups.find((g) => g.id === id)).filter(Boolean);
  for (const g of onQuote) g.onQuote = true;
  return [...onQuote, ...groups.filter((g) => !g.onQuote)];
}

/** How many different services the groups hold — one tagged with two quote types is one service. */
export function uniqueServiceCount(groups) {
  return new Set(list(groups).flatMap((g) => list(g?.services).map((p) => String(p?.id)))).size;
}

/** How many things the control offers: every quote type plus every service row. */
export function pickerCount(groups, { invoice = false } = {}) {
  return list(groups).reduce((n, g) => n + (invoice || !g.category ? 0 : 1) + list(g.services).length, 0);
}

/** Inline buttons, or the dialog. */
export function pickerShape(count) {
  const n = Number(count) || 0;
  if (n <= 0) return "empty";
  return n <= INLINE_PICKER_MAX ? "inline" : "dialog";
}

/** Lower-case, accents folded — "Rénovation" is found by "renovation". */
export function foldText(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * The groups that match `query` — a word matched against the service's name
 * and description (in every language `textsOf` hands back) and against the
 * quote type's label. A quote type whose label matches keeps all its
 * services; otherwise only the services that match stay, and a group with
 * none is dropped. Every word must match (so "water heater" does not match
 * every "water" row).
 *
 * @param textsOf(product) → string[] — the texts a service is searched by
 */
export function filterPicker(groups, query, textsOf = (p) => [p?.name, p?.description]) {
  const words = foldText(query).split(/\s+/).filter(Boolean);
  if (!words.length) return list(groups).map((g) => ({ ...g, typeMatch: true }));
  const hits = (texts) => {
    const hay = foldText(list(texts).filter((x) => typeof x === "string").join(" \u0000 "));
    return words.every((w) => hay.includes(w));
  };
  const out = [];
  for (const g of list(groups)) {
    const typeMatch = hits([g.label]);
    const services = typeMatch ? list(g.services) : list(g.services).filter((p) => hits([...list(textsOf(p)), g.label]));
    if (typeMatch || services.length) out.push({ ...g, typeMatch, services });
  }
  return out;
}

/**
 * What a press on a service would put on the quote — whether it is the
 * template add at all (the dialog's tile and the inline pill ask this at the
 * press), and the lines, which the inline pill counts.
 *
 * Built the way QuoteBuilder addScopeGroupWithTemplate builds the real add:
 * the same new group (newScopeGroup, same arguments), the quote's figures
 * with that group first (measurementsFromGroups), the units that group's own
 * calculator bills held back (keysPricedByGroup) — so the count on the row
 * is the count the press adds, never "3 lines" for a press that adds 1.
 *
 * @returns null                   — the service has no enabled template
 *          { offered: false }     — it has one, but not for a NEW group of
 *                                   this quote type (a painting template tied
 *                                   to an estimate type is offered inside the
 *                                   group once the type is picked, as before)
 *          { offered, count, lines, skipped, groups }
 */
export function templatePreview({
  category,
  product,
  groups = [],
  rateOverrides = null,
  language = "en",
  companyLanguage = "en",
  currency = null,
} = {}) {
  if (!category || !product || typeof product !== "object") return null;
  const hasTemplate = product.templateEnabled !== false && Array.isArray(product.templateLines) && product.templateLines.length > 0;
  if (!hasTemplate) return null;
  if (!templatesFor({ products: [product], categoryId: category.id, categoryKey: category.key }).length) return { offered: false };
  const group = newScopeGroup(category, category.label, rateOverrides, { tempId: "__service-picker__" });
  const all = [...list(groups), group];
  const { lines, summary } = expandServiceTemplate(product, {
    measurements: measurementsFromGroups(all, { targetTempId: group.tempId }),
    language,
    companyLanguage,
    currency,
    runId: "preview",
    heading: false,
    pricedKeys: keysPricedByGroup(group),
  });
  return {
    offered: summary.lines > 0,
    count: summary.lines,
    lines,
    skipped: list(summary.skipped),
    summary,
    groups: all,
  };
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * The quote type's own row: one sentence of the wording the client reads
 * under it (Settings › Services, else the catalogue's), and a price — the
 * cheapest of the company's own services on that quote type ("from"), else
 * the trade's rate, else a cabinet trade's per-door figure a new group opens
 * at. Never a benchmark of ours. Moved here from the 2026-09-22 card
 * (QuoteBuilder serviceCardDetails) unchanged, so the check can execute it.
 *
 * @returns { description, price: { amount, unit, from?, perDoor? } | null, calc }
 */
export function quoteTypeSummary({ category, products = [], wordingOverride = null, rateOverrides = null, language = "en" } = {}) {
  if (!category) return { description: "", price: null, calc: null };
  const own = list(products).filter(
    (p) => isPickableService(p) && list(p.categories).some((c) => c?.id === category.id),
  );
  const para = resolveServiceContent(category.key, wordingOverride, null, language).description || "";
  const description = (para.match(/^[^.!?。]*[.!?。]?/)?.[0] || para).trim();
  const priced = own.map((p) => ({ p, v: num(p.unitPrice) })).filter((x) => x.v > 0).sort((a, b) => a.v - b.v)[0];
  // A drywall_install company's old single rate is not what a new group bills
  // since its price book went live (2026-10-03) — the book's hang and finish
  // lines are — and Settings no longer shows the box that set it. Quoting it
  // on the card would be a price nothing charges.
  const bookDrywall = category.key === "drywall_install" && Boolean(getPriceBook(category.key));
  const rate = bookDrywall
    ? 0
    : category.defaultRate != null ? num(category.defaultRate) : num(defaultTradeRate(category.key)?.rate);
  const perDoor = isUnitPriced(category.key) ? num(getPriceBook(category.key, rateOverrides)?.perDoor) : 0;
  const price = priced
    ? { amount: priced.v, unit: priced.p.unit || null, from: true }
    : rate > 0
      ? { amount: rate, unit: category.unit || null }
      : perDoor > 0
        ? { amount: perDoor, unit: null, perDoor: true }
        : null;
  return { description, price, calc: calculatorOfTrade(category.key) };
}

// ── Sections inside a trade: the seed's own categories (2026-09-28) ───────
//
// The owner: services grouped "the way Housecall Pro groups them" — a
// plumber's list under "Drain cleaning", "Faucets and fixtures", "Water
// heaters"… Those headings already exist: every seed file carries them
// (app/data/serviceSeeds/<trade>.js `categories`, in every seed language),
// and a seeded Product row points at its seed through `seedKey`
// ("fq.<trade>.<category>.<slug>"). So the heading is READ from the seed the
// row came from, never guessed from its name: a row the company wrote itself
// (no seedKey), or one whose seed is gone, has no category and goes under
// "Other" — or, when nothing in the trade has one, under no heading at all
// (a lone "Other" says nothing).
//
// The seed data is ~6 MB minified, so the browser never loads it for this:
// GET /api/products attaches each seeded row's heading (productSeedCategory,
// run on the server, where the seeds already are) and the picker reads it
// off the row (seedCategoryOf). The seeds are handed in (`deps`), never
// imported here, because this file is in the quote builder's bundle.

/**
 * SERVER: the heading a seeded Product row sits under, as the payload
 * carries it — `{ key: "<trade>.<category>", index, name: { <lang>: text } }`
 * with every language the seed names it in (the document's language is
 * the browser's to pick; a quote in French and one in English are open in
 * the same company). Null for a row with no seedKey, a seed that is gone,
 * or a category its file does not declare — the key itself
 * ("water_heaters") is not a heading.
 *
 * @param deps { seedServiceByKey, seedCategoryName, SERVICE_SEEDS }
 */
export function productSeedCategory(product, { seedServiceByKey, seedCategoryName, SERVICE_SEEDS } = {}) {
  const key = product?.seedKey;
  if (typeof key !== "string" || !key || typeof seedServiceByKey !== "function" || typeof seedCategoryName !== "function") return null;
  const seed = seedServiceByKey(key);
  if (!seed || typeof seed.category !== "string" || typeof seed.trade !== "string") return null;
  const cats = list(SERVICE_SEEDS?.[seed.trade]?.categories);
  const index = cats.findIndex((c) => c?.key === seed.category);
  if (index < 0) return null;
  const langs = Object.keys(cats[index]?.name && typeof cats[index].name === "object" ? cats[index].name : {});
  const name = {};
  for (const lang of langs) {
    const text = String(seedCategoryName(seed.trade, seed.category, lang) || "").trim();
    if (text) name[lang] = text;
  }
  return Object.keys(name).length ? { key: `${seed.trade}.${seed.category}`, index, name } : null;
}

/**
 * BROWSER: the heading a row is drawn under, in the document's language
 * (English where the seed has no such language — the seed's own fallback,
 * lib/services/confirmServices.js seedCategoryName), read from the
 * `seedCategory` GET /api/products attached. Anything malformed → null, and
 * the row goes under "Other" rather than under a heading nobody wrote.
 *
 * @returns { key, name, trade, index } | null — `index` is the heading's
 *          place in its seed file, the order the trade's list was written in
 */
export function seedCategoryOf(product, language) {
  const c = product?.seedCategory;
  if (!c || typeof c !== "object" || typeof c.key !== "string" || !c.name || typeof c.name !== "object") return null;
  const trade = c.key.split(".")[0];
  const pick = typeof c.name[language] === "string" && c.name[language].trim() ? c.name[language] : c.name.en;
  const name = typeof pick === "string" ? pick.trim() : "";
  if (!trade || !name) return null;
  return { key: c.key, name, trade, index: Number.isFinite(c.index) ? c.index : Number.MAX_SAFE_INTEGER };
}

/**
 * One group's services, split under their category headings: the trade's
 * own file's headings first (on an invoice, the file most of the group's
 * services came from), in the order that file lists them, then any
 * other file's (a shared row — caulking lives in handyman's file), then the
 * uncategorised as `other`. Same-named headings are one section. Order
 * inside a section is the order the services came in.
 *
 * @param categoryOf(product) → { name, trade, index } | null (seedCategoryOf).
 *        Not a function → ONE unlabelled section, the list as it was
 * @returns [{ key, label: string|null, other?: true, services }]
 */
export function pickerSections(group, categoryOf = null) {
  const services = list(group?.services);
  if (!services.length) return [];
  if (typeof categoryOf !== "function") return [{ key: "__all__", label: null, services }];
  const found = services.map((p) => [p, categoryOf(p)]);
  // The trade whose headings lead: the quote type's own; on an invoice,
  // whose groups carry no quote type, the file most of its services came from.
  let own = group?.category?.key || null;
  if (!own) {
    const n = new Map();
    for (const [, c] of found) if (c?.trade) n.set(c.trade, (n.get(c.trade) || 0) + 1);
    own = [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || null;
  }
  const named = new Map();
  const other = [];
  for (const [p, c] of found) {
    const name = typeof c?.name === "string" ? c.name.trim() : "";
    if (!name) {
      other.push(p);
      continue;
    }
    const k = foldText(name);
    if (!named.has(k)) {
      named.set(k, {
        key: k,
        label: name,
        own: own != null && c.trade === own ? 0 : 1,
        trade: String(c.trade || ""),
        index: Number.isFinite(c.index) ? c.index : Number.MAX_SAFE_INTEGER,
        services: [],
      });
    }
    named.get(k).services.push(p);
  }
  const out = [...named.values()]
    .sort((a, b) => a.own - b.own || a.trade.localeCompare(b.trade) || a.index - b.index || a.label.localeCompare(b.label))
    .map(({ key, label, services: s }) => ({ key, label, services: s }));
  if (other.length) {
    out.push(out.length ? { key: "__other__", label: null, other: true, services: other } : { key: "__all__", label: null, services: other });
  }
  return out;
}
