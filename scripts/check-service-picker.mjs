// scripts/check-service-picker.mjs
//
// "Add service" — the control at the foot of a quote and an invoice
// (app/components/quotes/builder/AddServicePicker.js, lib/quotes/
// servicePicker.js). The owner (2026-09-25): "This seems very busy. Maybe it
// should be a button 'Add service' and then a popup … with a list", and "if
// there are more than 4 it makes a pop-up with the list so it's easier to
// read."
//
//   npm run check:service-picker
//
// Since 2026-09-28 the dialog is the owner's reference ("Create Line Item"
// in another field-service app): a search box, then a grid of plain tiles —
// the name only — under small uppercase headings, one tap adds, Cancel.
// The headings inside a trade are the seed's own categories (Housecall Pro's
// grouping, owner), the trade's name above them only when there is more
// than one trade.
//
//   A. The list's rules, executed against hostile input: what is offered
//      (enabled quote types, active services linked to them; never an
//      archived row, a product, a service linked to nothing), the order (the
//      quote's own trades first), the threshold (4 inline, 5 a dialog), the
//      search (accents folded, every word, a trade name keeps its services).
//   A2. The headings: GET /api/products attaches each seeded row's category
//      (productSeedCategory, on the server, every language the seed names it
//      in); the browser reads it in the document's language (seedCategoryOf);
//      pickerSections orders them as the seed file does, merges same names,
//      puts the uncategorised under "Other" (and draws no lone "Other").
//   B. A press on a templated service IS the template add: templatePreview
//      builds the lines the same way QuoteBuilder addScopeGroupWithTemplate
//      does — same group, same measurements, same held-back units — and
//      their md5 is compared with that expansion done by hand; runPickerEntry
//      (what a tile press runs) picks the template exactly when the preview
//      offers it, and the plain line otherwise.
//   C. The quote type's summary (still QuoteBuilder's): the price rule
//      moved out of the old card unchanged.
//   D. The list, rendered: tiles with the name only — no price (whatever
//      showPricing says), no description, no tick box, no "Add as one line",
//      no template preview — the headings, the presets, search, languages,
//      the invoice's shape.
//   E. The control's three shapes (empty / inline / dialog), and the solid
//      Add service button on every quote.
//   F. The words: every key in nine languages, the placeholders equal, the
//      old dialog's strings gone from all of them.
//   G. The wiring, read from source: a quote type is still
//      b.addScopeGroup(category, label) — the call the old tiles made — the
//      products route attaches the headings, and the browser never imports
//      the seeds (not statically, not dynamically).
//
// The saved body of each add through a tile is compared with the old
// dialog's "Add", md5 for md5, by the app-guide harness (picker-md5-* rows,
// docs/screens/app-guide/harness/fixtures/routes-picker.js).
//
// Bundled through esbuild (JSX), like check-doc-builder.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  INLINE_PICKER_MAX,
  isPickableService,
  pickerGroups,
  pickerCount,
  pickerShape,
  filterPicker,
  foldText,
  templatePreview,
  quoteTypeSummary,
  seedCategoryOf,
  productSeedCategory,
  pickerSections,
} from "../lib/quotes/servicePicker.js";
import { newScopeGroup } from "../lib/quotes/builderPayload.js";
import { lineFromProduct } from "../lib/quotes/lineDetail.js";
import { expandServiceTemplate, measurementsFromGroups, keysPricedByGroup } from "../lib/quotes/serviceTemplateLines.js";
import { seedServiceByKey } from "../lib/services/seeds.js";
import { seedCategoryName } from "../lib/services/confirmServices.js";
import { SERVICE_SEEDS } from "../app/data/serviceSeeds/index.js";
import { contrastRatio, deriveBrandTokens } from "../lib/brand/colour.js";
// A namespace import, so a component without runPickerEntry (the 2026-09-25
// dialog) still bundles and FAILS the assertion that asks for it, instead of
// stopping the whole check at the bundler.
import * as PickerModule from "../app/components/quotes/builder/AddServicePicker.js";
const { default: AddServicePicker, ServicePickerList } = PickerModule;
const runPickerEntry = PickerModule["runPickerEntry"];
import { LanguageProvider } from "../app/providers/LanguageProvider.js";
import { APP_MESSAGES } from "../app/i18n/appMessages.js";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) => {
  if (cond) pass += 1;
  else fails.push(`${label}${detail !== undefined ? ` — ${detail}` : ""}`);
};
const eq = (label, got, want) => ok(label, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}`);
const md5 = (o) => createHash("md5").update(JSON.stringify(o)).digest("hex");
const src = (p) => readFileSync(join(process.cwd(), p), "utf8");

// ── Fixtures ────────────────────────────────────────────────────────────────
const STAIRS = { id: "cat1", key: "stairs", label: "Stairs", enabled: true, unit: "flat", defaultRate: 0 };
const CABINETS = { id: "cat2", key: "cabinet_refinishing", label: "Cabinet Refinishing", enabled: true };
const PAINT = { id: "cat3", key: "interior_painting", label: "Interior Painting", enabled: true };
const ELEC = { id: "cat4", key: "electrical", label: "Electrical", enabled: true, defaultRate: 0 };
const link = (c) => ({ id: c.id, label: c.label });
const STAIR_REFINISH = {
  id: "p2", name: "Stair refinish", description: "Sand and stain.", unitPrice: 95, unit: "tread", type: "service", active: true,
  templateEnabled: true, estimateTypes: [], categories: [link(STAIRS)],
  templateLines: [
    { kind: "labour", name: "Treads", qty: 1, unit: "each", unitPrice: 95, measurementKey: "treads" },
    { kind: "other", name: "Dust containment", qty: 1, unit: "flat", unitPrice: 120 },
  ],
};
const PANEL = {
  id: "p3", name: "Panel upgrade — 200 A", description: "Replace the service panel.\nPermit included.", unitPrice: 2400, unit: "flat", type: "service", active: true,
  templateEnabled: true, estimateTypes: [], categories: [link(ELEC)],
  translations: { fr: { name: "Remplacement de panneau — 200 A", description: "Remplacer le panneau électrique." } },
  templateLines: [
    { kind: "labour", name: "Electrician — panel swap", qty: 8, unit: "hour", unitPrice: 110 },
    { kind: "material", name: "200 A panel and breakers", qty: 1, unit: "flat", unitPrice: 650 },
    { kind: "other", name: "Permit and inspection", qty: 1, unit: "flat", unitPrice: 225 },
  ],
};
const PAINT_WALLS = {
  id: "p4", name: "Walls repaint", unitPrice: 0, type: "service", active: true, templateEnabled: true, estimateTypes: ["interior"],
  categories: [link(PAINT)], templateLines: [{ kind: "labour", name: "Walls", qty: 1, unit: "sqft", unitPrice: 1.2, measurementKey: "wallSqft" }],
};
const ARCHIVED = { id: "p5", name: "Old service", type: "service", active: false, categories: [link(ELEC)] };
const HINGE = { id: "p6", name: "Soft-close hinge", type: "product", active: true, unitPrice: 14.5, categories: [link(CABINETS)] };
const UNLINKED = { id: "p7", name: "Rush fee", type: "service", active: true, unitPrice: 200, categories: [] };
const OUTLET = { id: "p8", name: "Outlet install", description: "One new receptacle.", type: "service", active: true, unitPrice: 185, unit: "each", categories: [link(ELEC)] };
const PRODUCTS = [STAIR_REFINISH, PANEL, PAINT_WALLS, ARCHIVED, HINGE, UNLINKED, OUTLET];
const CATS = [STAIRS, CABINETS, PAINT, ELEC];

// A plumber whose list was seeded (Product.seedKey → app/data/serviceSeeds/
// plumbing.js), plus one service the company wrote itself.
const PLUMB = { id: "cat5", key: "plumbing", label: "Plumbing", enabled: true };
const seeded = (id, seedKey, name, extra = {}) => ({ id, seedKey, name, type: "service", active: true, unitPrice: 250, unit: "flat", categories: [link(PLUMB)], ...extra });
const P_HEATER = seeded("s1", "fq.plumbing.water_heaters.repair_visit", "Water heater repair visit");
const P_DRAIN = seeded("s2", "fq.plumbing.drains.drain_cleaning_visit", "Drain cleaning visit");
const P_AERATOR = seeded("s3", "fq.plumbing.faucets.aerator", "Aerator cleaning");
const P_LEAK = seeded("s4", "fq.plumbing.visits.leak_detection_repair", "Leak detection and repair visit");
const P_CUSTOM = { id: "s5", name: "Emergency call-out", type: "service", active: true, unitPrice: 180, categories: [link(PLUMB)] };
const P_GONE = seeded("s6", "fq.plumbing.nothing.like_this", "Seed that no longer exists");
const PLUMBING = [P_HEATER, P_DRAIN, P_AERATOR, P_LEAK, P_CUSTOM, P_GONE];
const DEPS = { seedServiceByKey, seedCategoryName, SERVICE_SEEDS };
// What GET /api/products serves: the row, plus its heading when it has one.
const served = (p) => {
  const seedCategory = productSeedCategory(p, DEPS);
  return seedCategory ? { ...p, seedCategory } : p;
};
const PLUMBING_SERVED = PLUMBING.map(served);
const [S_HEATER, S_DRAIN, , , S_CUSTOM, S_GONE] = PLUMBING_SERVED;
const categoryIn = (lang) => (p) => seedCategoryOf(p, lang);

// ───────────────────────────────────────────────────────────────────────────
console.log("A. what is offered, in what order, and when it is a dialog");
// ───────────────────────────────────────────────────────────────────────────
eq("the owner's threshold is 4", INLINE_PICKER_MAX, 4);
eq("0 → empty", pickerShape(0), "empty");
eq("1 → inline", pickerShape(1), "inline");
eq("4 → inline (the owner: MORE than 4 opens the list)", pickerShape(4), "inline");
eq("5 → dialog", pickerShape(5), "dialog");
eq("junk count → empty", pickerShape("x"), "empty");

ok("a service is pickable", isPickableService(OUTLET));
ok("an untyped row is pickable (older rows carry no type)", isPickableService({ id: "x", name: "x" }));
ok("an archived row is not", !isPickableService(ARCHIVED));
ok("a product is a line, not a service", !isPickableService(HINGE));
ok("junk is not", !isPickableService(null) && !isPickableService("x") && !isPickableService({ name: "no id" }));

const groups = pickerGroups({ categories: CATS, products: PRODUCTS, onQuoteCategoryIds: [] });
eq("one group per enabled quote type, in the company's order", groups.map((g) => g.id), ["cat1", "cat2", "cat3", "cat4"]);
eq("electrical lists its active services by name — not the archived one", groups[3].services.map((p) => p.id), ["p8", "p3"]);
eq("cabinets lists no product (the hinge stays a line)", groups[1].services.length, 0);
ok("a service linked to nothing is not offered on a quote", !groups.some((g) => g.services.some((p) => p.id === "p7")));
eq("count = quote types + services", pickerCount(groups), 4 + 1 + 1 + 2);
const onQuote = pickerGroups({ categories: CATS, products: PRODUCTS, onQuoteCategoryIds: ["cat4", "cat2", "cat4", null] });
eq("the quote's own trades first, in quote order, once each", onQuote.map((g) => g.id), ["cat4", "cat2", "cat1", "cat3"]);
ok("…and marked", onQuote[0].onQuote && onQuote[1].onQuote && !onQuote[2].onQuote);
eq("a duplicated or id-less category is one group or none", pickerGroups({ categories: [STAIRS, STAIRS, { key: "x" }, null], products: [] }).map((g) => g.id), ["cat1"]);
eq("junk input → no groups, count 0", [pickerGroups({ categories: "x", products: 7 }).length, pickerCount(null)], [0, 0]);

const inv = pickerGroups({ products: PRODUCTS, invoice: true });
eq("invoice: grouped by the linked quote type's label, unlinked last", inv.map((g) => g.label), ["Electrical", "Interior Painting", "Stairs", null]);
eq("invoice: the unlinked service is offered (an invoice needs no quote type)", inv[3].services.map((p) => p.id), ["p7"]);
eq("invoice: count is services only", pickerCount(inv, { invoice: true }), 5);

eq("fold: accents and case", foldText("  Rénovation ÉLECTRIQUE "), "renovation electrique");
const f1 = filterPicker(groups, "panel");
eq("search finds a service by name", f1.map((g) => [g.id, g.services.map((p) => p.id)]), [["cat4", ["p3"]]]);
eq("…and says the quote type did not match", f1[0].typeMatch, false);
eq("every word must match", filterPicker(groups, "panel permit").length, 1);
eq("…a word nowhere drops it", filterPicker(groups, "panel zzz").length, 0);
eq("description counts", filterPicker(groups, "receptacle")[0].services.map((p) => p.id), ["p8"]);
eq("the trade's name keeps every service under it", filterPicker(groups, "electr")[0].services.length, 2);
eq("accents folded in the query", filterPicker(groups, "élec")[0].id, "cat4");
eq("another language's text is searched when handed over", filterPicker(groups, "remplacement", (p) => [p.name, p.translations?.fr?.name]).map((g) => g.id), ["cat4"]);
eq("an empty query keeps everything", filterPicker(groups, "   ").length, 4);
eq("junk query", filterPicker(groups, null).length, 4);

// ───────────────────────────────────────────────────────────────────────────
console.log("A2. the headings inside a trade: the seed's own categories");
// ───────────────────────────────────────────────────────────────────────────
{
  // The server half — what the products route attaches.
  const sc = productSeedCategory(P_DRAIN, DEPS);
  eq("the route attaches the seed's category key and its place in the file", [sc?.key, sc?.index], ["plumbing.drains", SERVICE_SEEDS.plumbing.categories.findIndex((c) => c.key === "drains")]);
  eq("…named in every language the seed names it in, and only those", Object.keys(sc?.name || {}).sort(), Object.keys(SERVICE_SEEDS.plumbing.categories.find((c) => c.key === "drains").name).sort());
  ok("…which is the seed's own eight (en fr es it de uk pa tl)", ["en", "fr", "es", "it", "de", "uk", "pa", "tl"].every((l) => typeof sc?.name?.[l] === "string" && sc.name[l].length > 0));
  eq("a row the company wrote itself gets nothing", productSeedCategory(P_CUSTOM, DEPS), null);
  eq("a seedKey whose seed is gone gets nothing", productSeedCategory(P_GONE, DEPS), null);
  eq("…so the route adds no key to either", ["seedCategory" in S_CUSTOM, "seedCategory" in S_GONE], [false, false]);
  eq("no deps → nothing", productSeedCategory(P_HEATER, {}), null);
  eq("junk → nothing", [productSeedCategory(null, DEPS), productSeedCategory({ seedKey: 7 }, DEPS), productSeedCategory("x", DEPS)], [null, null, null]);
  const undeclared = { seedServiceByKey: () => ({ trade: "plumbing", category: "not_declared" }), seedCategoryName, SERVICE_SEEDS };
  eq("a category the seed file does not declare is not sent as its key", productSeedCategory(P_HEATER, undeclared), null);
  const bytes = JSON.stringify(sc).length;
  ok("the payload per seeded row is small (< 600 bytes)", bytes < 600, String(bytes));
  console.log(`  seedCategory on one plumbing row: ${bytes} bytes`);

  // The browser half — read off the row, in the document's language.
  const heater = seedCategoryOf(S_HEATER, "en");
  eq("a seeded row's heading is its seed's category", [heater?.name, heater?.trade, heater?.key], ["Water heaters", "plumbing", "plumbing.water_heaters"]);
  eq("…at its place in the seed file", heater?.index, SERVICE_SEEDS.plumbing.categories.findIndex((c) => c.key === "water_heaters"));
  eq("…in the document's language (French)", seedCategoryOf(S_DRAIN, "fr")?.name, "Débouchage de drains");
  eq("…in a language the seed carries from its i18n file (German)", seedCategoryOf(S_DRAIN, "de")?.name, "Abflussreinigung");
  eq("…English where the seed has no such language (Chinese)", seedCategoryOf(S_DRAIN, "zh")?.name, "Drain cleaning");
  eq("the browser never reads seedKey itself — a row without the attached heading has none", seedCategoryOf(P_HEATER, "en"), null);
  eq("the company's own row has none", seedCategoryOf(S_CUSTOM, "en"), null);
  eq(
    "malformed payloads → none, never a heading nobody wrote",
    [null, "x", {}, { key: 3, name: { en: "A" } }, { key: "t.c" }, { key: "t.c", name: "A" }, { key: "t.c", name: { en: "  " } }, { key: ".c", name: { en: "A" } }].map((c) => seedCategoryOf({ seedCategory: c }, "en")),
    [null, null, null, null, null, null, null, null],
  );
  eq("a missing index sorts last, not first", seedCategoryOf({ seedCategory: { key: "t.c", name: { en: "A" } } }, "en")?.index, Number.MAX_SAFE_INTEGER);

  const g = pickerGroups({ categories: [PLUMB], products: PLUMBING_SERVED })[0];
  const secs = pickerSections(g, categoryIn("en"));
  eq(
    "sections in the seed file's order, the uncategorised last as Other",
    secs.map((s) => s.label || (s.other ? "OTHER" : "—")),
    ["Service visits and diagnostics", "Drain cleaning", "Faucets and fixtures", "Water heaters", "OTHER"],
  );
  eq("…Other holds the company's own row and the orphaned seed", secs.at(-1).services.map((p) => p.id).sort(), ["s5", "s6"]);
  eq("every service is in exactly one section", secs.flatMap((s) => s.services.map((p) => p.id)).sort(), PLUMBING.map((p) => p.id).sort());
  eq("the same rows WITHOUT the attached headings → one unlabelled section, nothing lost", pickerSections(pickerGroups({ categories: [PLUMB], products: PLUMBING })[0], categoryIn("en")).map((s) => [s.label, s.services.length]), [[null, 6]]);
  eq("no resolver → one unlabelled section, nothing lost", pickerSections(g, null).map((s) => [s.label, s.services.length]), [[null, 6]]);
  eq("nothing categorised → no lone Other heading", pickerSections({ services: [P_CUSTOM, UNLINKED] }, categoryIn("en")).map((s) => [s.label, !!s.other]), [[null, false]]);
  eq("an empty group has no sections", pickerSections({ services: [] }, categoryIn("en")), []);
  eq("junk group", pickerSections(null, categoryIn("en")), []);
  const merged = pickerSections({ services: [P_HEATER, P_DRAIN] }, () => ({ name: " Same ", trade: "x", index: 0 }));
  eq("two same-named headings are one section", merged.map((s) => [s.label, s.services.length]), [["Same", 2]]);
  const mixed = pickerSections(
    { category: { key: "handyman" }, services: [P_HEATER, P_DRAIN, P_AERATOR] },
    (p) => (p.id === "s1" ? { name: "Theirs", trade: "plumbing", index: 0 } : p.id === "s2" ? { name: "Ours B", trade: "handyman", index: 5 } : { name: "Ours A", trade: "handyman", index: 2 }),
  );
  eq("the trade's own file's headings first, then another file's", mixed.map((s) => s.label), ["Ours A", "Ours B", "Theirs"]);
  const invoiceMixed = pickerSections(
    { category: null, services: [P_HEATER, P_DRAIN, P_AERATOR] },
    (p) => (p.id === "s1" ? { name: "Aaa from carpets", trade: "carpet_cleaning", index: 0 } : p.id === "s2" ? { name: "Ours B", trade: "handyman", index: 5 } : { name: "Ours A", trade: "handyman", index: 2 }),
  );
  eq("an invoice group (no quote type): the file most of its services came from leads", invoiceMixed.map((s) => s.label), ["Ours A", "Ours B", "Aaa from carpets"]);
}

// ───────────────────────────────────────────────────────────────────────────
console.log("B. a press on a templated service is the template add");
// ───────────────────────────────────────────────────────────────────────────
{
  // runPickerEntry is what every tile press runs. It asks the builder's own
  // preview AT THE PRESS and follows it, as the old row's default Add did.
  const calls = [];
  const press = typeof runPickerEntry === "function" ? runPickerEntry : () => {};
  ok("the tile's press is one exported function the check can execute", typeof runPickerEntry === "function");
  const spy = (pv) => ({
    preview: () => pv,
    addType: (...a) => calls.push(["type", ...a.map((x) => x?.id || x)]),
    addTemplate: (...a) => calls.push(["template", ...a.map((x) => x?.id || x)]),
    addLine: (...a) => calls.push(["line", ...a.map((x) => x?.id || x)]),
  });
  press(spy(null), { kind: "type", category: STAIRS, label: "Main staircase" });
  press(spy({ offered: true, count: 1 }), { kind: "service", category: STAIRS, product: STAIR_REFINISH });
  press(spy(null), { kind: "service", category: ELEC, product: OUTLET });
  press(spy({ offered: false }), { kind: "service", category: PAINT, product: PAINT_WALLS });
  press(spy({ offered: false, count: 0 }), { kind: "service", category: ELEC, product: PANEL });
  eq(
    "type → addType(category, label); offered template → addTemplate; anything else → addLine",
    calls,
    [["type", "cat1", "Main staircase"], ["template", "cat1", "p2"], ["line", "cat4", "p8"], ["line", "cat3", "p4"], ["line", "cat4", "p3"]],
  );
}
{
  const existing = [];
  const pv = templatePreview({ category: STAIRS, product: STAIR_REFINISH, groups: existing, currency: "CAD" });
  eq("stairs: one line offered — the stair takeoff already bills the treads", [pv.offered, pv.count], [true, 1]);
  eq("…and the held-back line is named", pv.skipped.map((s) => s.description), ["Treads"]);
  // The add, by hand, exactly as QuoteBuilder addScopeGroupWithTemplate does it.
  const group = newScopeGroup(STAIRS, STAIRS.label, null, { tempId: "__service-picker__" });
  const byHand = expandServiceTemplate(STAIR_REFINISH, {
    measurements: measurementsFromGroups([...existing, group], { targetTempId: group.tempId }),
    language: "en",
    companyLanguage: "en",
    currency: "CAD",
    runId: "preview",
    heading: false,
    pricedKeys: keysPricedByGroup(group),
  });
  const a = md5(pv.lines);
  const b = md5(byHand.lines);
  ok("the preview's lines md5 = the add's expansion md5", a === b, `${a} vs ${b}`);
  console.log(`  md5  stairs preview lines: ${a}`);
  // The heading the products route now attaches rides on the product object
  // the adds read. It must not reach anything they write: the same service
  // with and without `seedCategory`, expanded and lined, md5 for md5.
  const tagged = { ...STAIR_REFINISH, seedKey: "fq.plumbing.drains.drain_cleaning_visit", seedCategory: productSeedCategory({ seedKey: "fq.plumbing.drains.drain_cleaning_visit" }, DEPS) };
  const untagged = { ...STAIR_REFINISH, seedKey: "fq.plumbing.drains.drain_cleaning_visit" };
  const expandOf = (p) => expandServiceTemplate(p, { measurements: measurementsFromGroups([group], { targetTempId: group.tempId }), language: "fr", companyLanguage: "en", currency: "CAD", runId: "r1", heading: true, pricedKeys: keysPricedByGroup(group) }).lines;
  ok("seedCategory never reaches a template add's lines", Boolean(tagged.seedCategory) && md5(expandOf(tagged)) === md5(expandOf(untagged)));
  ok("…nor the one line an add without a template writes", md5(lineFromProduct(tagged, { language: "fr", defaultLanguage: "en" })) === md5(lineFromProduct(untagged, { language: "fr", defaultLanguage: "en" })));
  eq("the preview's group is the one the add creates, last", pv.groups.at(-1).categoryKey, "stairs");

  const pp = templatePreview({ category: ELEC, product: PANEL, currency: "CAD", language: "fr", companyLanguage: "en" });
  eq("electrical: nothing held back, all three lines", [pp.count, pp.skipped.length], [3, 0]);
  eq("the preview carries each line's kind", pp.lines.map((l) => l.meta.template.lineKind), ["labour", "material", "other"]);
  eq("a painting template tied to an estimate type is not offered on a NEW group", templatePreview({ category: PAINT, product: PAINT_WALLS }), { offered: false });
  eq("no template → null (the row's Add is the one line)", templatePreview({ category: ELEC, product: OUTLET }), null);
  eq("a switched-off template → null", templatePreview({ category: ELEC, product: { ...PANEL, templateEnabled: false } }), null);
  eq("junk → null", [templatePreview({}), templatePreview({ category: ELEC, product: "x" })], [null, null]);
  // A measured line on a group that measures it: filled from the quote.
  const walls = { ...PAINT_WALLS, estimateTypes: [] };
  const paintGroup = { ...newScopeGroup(PAINT, "Living room", null, { tempId: "g-paint" }) };
  const pw = templatePreview({ category: ELEC, product: { ...walls, categories: [link(ELEC)] }, groups: [paintGroup] });
  ok("a measured line with no figure on the quote waits for it", pw.lines[0].meta.template.awaiting === true && pw.lines[0].quantity === 0);
}

// ───────────────────────────────────────────────────────────────────────────
console.log("C. the quote type's own row");
// ───────────────────────────────────────────────────────────────────────────
{
  const s = quoteTypeSummary({ category: STAIRS, products: PRODUCTS });
  eq("from the cheapest of the company's own services", s.price, { amount: 95, unit: "tread", from: true });
  eq("names its calculator", s.calc, "stairs");
  ok("one sentence of the wording", typeof s.description === "string" && s.description.length > 0 && !/\.\s+\S/.test(s.description), s.description);
  const e = quoteTypeSummary({ category: { ...ELEC, defaultRate: 125, unit: "hour" }, products: [ARCHIVED, HINGE] });
  eq("no own priced service → the trade's rate", e.price, { amount: 125, unit: "hour" });
  const c = quoteTypeSummary({ category: CABINETS, products: [HINGE] });
  ok("a cabinet trade → its per-door figure (a product is not a service's price)", c.price?.perDoor === true && c.price.amount > 0, JSON.stringify(c.price));
  eq("no category → nothing invented", quoteTypeSummary({}), { description: "", price: null, calc: null });
}


// ───────────────────────────────────────────────────────────────────────────
console.log("D. the list, rendered — tiles, headings, nothing else");
// ───────────────────────────────────────────────────────────────────────────
const quotePicker = (over = {}) => ({
  kind: "quote",
  categories: CATS,
  products: PRODUCTS,
  onQuoteCategoryIds: [],
  language: "en",
  companyLanguage: "en",
  currency: "CAD",
  showPricing: true,
  typeInfo: (cat) => ({ description: `About ${cat.label}.`, priceHint: cat.key === "stairs" ? "from $95.00 / tread" : null, calc: cat.key === "stairs" ? "stairs" : null }),
  preview: (cat, p) => {
    const pv = templatePreview({ category: cat, product: p, currency: "CAD" });
    return pv && pv.skipped?.length ? { ...pv, note: "Treads — already priced by the stair takeoff, so not added again." } : pv;
  },
  addType: () => {},
  addTemplate: () => {},
  addLine: () => {},
  ...over,
});
const renderList = (picker, props = {}) => {
  const g = pickerGroups({ categories: picker.kind === "invoice" ? [] : picker.categories, products: picker.products, onQuoteCategoryIds: picker.onQuoteCategoryIds, invoice: picker.kind === "invoice" });
  return renderToStaticMarkup(
    <LanguageProvider initialLanguage={props.lang || "en"}>
      <ServicePickerList picker={picker} groups={g} invoice={picker.kind === "invoice"} documentLanguage="en" {...props} />
    </LanguageProvider>,
  );
};
const tilesIn = (html) => [...html.matchAll(/<button[^>]*data-service-picker-tile[^>]*>([\s\S]*?)<\/button>/g)];
const textOf = (s) => s.replace(/<[^>]+>/g, "").trim();
{
  const html = renderList(quotePicker({ onQuoteCategoryIds: ["cat1", "cat4"] }));
  ok("a search box", html.includes("data-service-picker-search") && html.includes("Search by name, description or trade"));
  ok("every quote type is a group, and every group is open — no accordion", ["stairs", "cabinet_refinishing", "interior_painting", "electrical"].every((k) => html.includes(`data-service-picker-group="${k}"`)) && !/<h3[^>]*>\s*<button/.test(html));
  ok("more than one trade → each trade's name above its block", (html.match(/data-service-picker-trade/g) || []).length === 4 && html.includes(">Electrical<"));
  ok("…the quote's own trades first, and said so", html.indexOf('data-service-picker-group="stairs"') < html.indexOf('data-service-picker-group="electrical"') && html.indexOf('data-service-picker-group="electrical"') < html.indexOf('data-service-picker-group="cabinet_refinishing"') && (html.match(/On this quote/g) || []).length === 2);
  ok("every quote type is a tile, tagged Quote type", ["stairs", "cabinet_refinishing", "interior_painting", "electrical"].every((k) => html.includes(`data-service-picker-type-add="${k}"`)) && (html.match(/data-service-picker-type-tag/g) || []).length === 4 && html.includes(">Quote type<"));
  ok("every offered service is a tile", ["p2", "p3", "p4", "p8"].every((id) => html.includes(`data-service-picker-add="${id}"`)));
  const tiles = tilesIn(html);
  eq("8 tiles: 4 quote types + 4 service rows", tiles.length, 8);
  eq(
    "a tile says the name and nothing else (a quote type adds its tag)",
    tiles.map((m) => textOf(m[1])).sort(),
    ["Cabinet RefinishingQuote type", "ElectricalQuote type", "Interior PaintingQuote type", "Outlet install", "Panel upgrade — 200 A", "Stair refinish", "StairsQuote type", "Walls repaint"].sort(),
  );
  ok("the whole tile is the button, 44px and more", tiles.every((m) => /min-h-12/.test(m[0]) && /type="button"/.test(m[0])));
  ok("…with the bar down its left edge", tiles.every((m) => /absolute inset-y-0 left-0 w-1 bg-primary/.test(m[1])));
  ok("two columns from sm up, one on a phone", html.includes("grid grid-cols-1 gap-2 sm:grid-cols-2"));
  ok("no price anywhere, though showPricing is on", !/\$\d/.test(html) && !html.includes("data-service-picker-price"));
  ok("no description", !html.includes("Sand and stain.") && !html.includes("Replace the service panel.") && !html.includes("One new receptacle.") && !html.includes("About Stairs."));
  ok("no tick boxes, no multi-select", !html.includes('type="checkbox"') && !html.includes("Select ") && !html.includes("data-add-service-selected"));
  ok("no per-row Add, no Add as one line", !html.includes(">Add<") && !html.includes("Add as one line") && !html.includes("data-service-picker-add-line"));
  ok("no template preview or count in the dialog", !html.includes("Template lines") && !html.includes("data-service-picker-preview") && !html.includes("data-service-picker-lines-toggle") && !html.includes("Dust containment"));
  ok("no 'Priced by' line", !html.includes("Priced by"));
  ok("the archived service never appears", !html.includes("Old service"));
  ok("the product never appears", !html.includes("Soft-close hinge"));
  ok("the service linked to nothing never appears on a quote", !html.includes("Rush fee"));
  ok("every tile takes the arrow keys", tiles.every((m) => /data-picker-nav/.test(m[0])));
  ok("no NaN, no undefined", !/NaN|undefined/.test(html));

  // A quote type with section presets asks which section, under its tile —
  // the one press that is not immediate, as the tile always did.
  const withPresets = quotePicker({ categories: [PLUMB, ELEC], products: [OUTLET, PANEL] });
  const closed = renderList(withPresets);
  ok("a quote type with section presets (plumbing) says it opens them", /<button[^>]*aria-expanded="false"[^>]*data-service-picker-type-add="plumbing"/.test(closed));
  ok("…and a quote type without presets does not", !/aria-expanded[^>]*data-service-picker-type-add="electrical"/.test(closed));
  ok("…nor draws them before the press", !closed.includes("data-service-presets"));
  const presets = renderList(withPresets, { initialPresetsFor: "cat5" });
  ok("the presets, open under the trade's tile: each section and Something else", presets.includes('data-service-presets="cat5"') && presets.includes(">Groundworks<") && presets.includes("Something else") && /<button[^>]*aria-expanded="true"[^>]*data-service-picker-type-add="plumbing"/.test(presets));
  ok("…each a 44px press", (presets.split('data-service-presets="cat5"')[1] || "").split("</div>")[0].match(/<button[^>]*min-h-11/g)?.length === 11);

  const searched = renderList(quotePicker(), { initialQuery: "outlet" });
  ok("a search keeps only matches", searched.includes("Outlet install") && !searched.includes("Panel upgrade"));
  ok("…and hides a quote type whose name did not match", !searched.includes('data-service-picker-type="electrical"'));
  ok("…and keeps the trade headings the whole list has", searched.includes("data-service-picker-trade"));
  const accent = renderList(quotePicker(), { initialQuery: "ÉLECTRIC" });
  ok("search folds accents and case, and a trade's name keeps its services", accent.includes("Outlet install") && accent.includes("Panel upgrade") && accent.includes('data-service-picker-type-add="electrical"'));
  const byDescription = renderList(quotePicker(), { initialQuery: "receptacle" });
  ok("search reads the description it no longer prints", byDescription.includes("Outlet install") && !byDescription.includes("One new receptacle."));
  const none = renderList(quotePicker(), { initialQuery: "zzzz" });
  ok("no match says so, with the query", none.includes("data-service-picker-nomatch") && none.includes("zzzz"));

  const priceless = renderList(quotePicker({ showPricing: false, onQuoteCategoryIds: ["cat1"] }));
  ok("showPricing off: no price on any tile", !/\$\d/.test(priceless));

  const fr = renderList(quotePicker({ language: "fr", onQuoteCategoryIds: ["cat4"] }), { lang: "fr" });
  ok("the service name is the document's language", fr.includes("Remplacement de panneau — 200 A"));
  ok("the interface is the reader's language", fr.includes("Rechercher par nom, description ou métier") && fr.includes("Type de soumission") && fr.includes("Sur cette soumission"));

  ok("no loading state: the tiles are drawn with the dialog, headings and all", !html.includes("data-service-picker-loading") && !html.includes('role="status"'));

  const invoicePicker = quotePicker({ kind: "invoice", preview: (_c, p) => (p.templateLines?.length ? { offered: true, count: p.templateLines.length, lines: [], groups: null } : null) });
  const invHtml = renderList(invoicePicker);
  ok("invoice: no quote-type tiles", !invHtml.includes("data-service-picker-type="));
  ok("invoice: the unlinked service is a tile under Other services", invHtml.includes("Other services") && invHtml.includes('data-service-picker-add="p7"'));
  ok("invoice: services only, never a product or an archived row", !invHtml.includes("Soft-close hinge") && !invHtml.includes("Old service"));
  const invOpen = renderList(invoicePicker, { initialQuery: "rush" });
  ok("invoice: found by search", invOpen.includes("Rush fee") && !invOpen.includes("Outlet install"));

  // ── The seed's headings, drawn ──────────────────────────────────────────
  const plumber = quotePicker({ categories: [PLUMB], products: PLUMBING_SERVED, preview: () => null });
  const one = renderList(plumber);
  ok("one trade: no trade heading — the categories are the structure", !one.includes("data-service-picker-trade"));
  const labels = [...one.matchAll(/data-service-picker-section-label[^>]*>([^<]+)</g)].map((m) => m[1]);
  eq("…in the seed file's order, Other last", labels, ["Service visits and diagnostics", "Drain cleaning", "Faucets and fixtures", "Water heaters", "Other services"]);
  ok("…each a small uppercase label", /<h3 class="mb-2 text-\[11px\] font-semibold uppercase tracking-wider text-muted-foreground" data-service-picker-section-label/.test(one));
  ok("…the quote type tile first, above them", one.indexOf('data-service-picker-type-add="plumbing"') < one.indexOf("data-service-picker-section-label"));
  const oneFr = renderList({ ...plumber, language: "fr" }, { lang: "fr" });
  ok("the headings in the quote's language", oneFr.includes(">Débouchage de drains<") && oneFr.includes(">Chauffe-eau<") && oneFr.includes(">Autres services<"));
  const two = renderList({ ...plumber, categories: [PLUMB, ELEC], products: [...PLUMBING_SERVED, OUTLET, PANEL] });
  ok("two trades: each trade's name above its own headings", (two.match(/data-service-picker-trade/g) || []).length === 2 && /<h4[^>]*data-service-picker-section-label[^>]*>Drain cleaning</.test(two));
  ok("…a trade with no seeded service draws no lone Other", !(two.split('data-service-picker-group="electrical"')[1] || "").includes("data-service-picker-section-label"));
  const bare = renderList({ ...plumber, products: PLUMBING });
  ok("rows without attached headings → every tile still there, no heading invented", !bare.includes("data-service-picker-section-label") && PLUMBING.every((p) => bare.includes(`data-service-picker-add="${p.id}"`)));
}

// ───────────────────────────────────────────────────────────────────────────
console.log("E. the control's three shapes");
// ───────────────────────────────────────────────────────────────────────────
{
  const render = (picker) =>
    renderToStaticMarkup(
      <LanguageProvider initialLanguage="en">
        <AddServicePicker picker={picker} documentLanguage="en" />
      </LanguageProvider>,
    );
  const buttonOf = (html) => html.match(/<button[^>]*data-add-service-open[^>]*>/)?.[0] || "";
  const big = render(quotePicker());
  ok("more than 4 → one Add service button", big.includes('data-service-picker="dialog"') && big.includes("data-add-service-open") && big.includes(">Add service<"));
  ok("…saying how much is behind it", big.includes("4 quote types · 4 services"));
  ok("…and no grid of cards", !big.includes("data-service-tile=") && !big.includes("data-service-card"));
  ok("…the dialog is not drawn until pressed", !big.includes("data-service-picker-list"));
  ok("the button is solid ink on an empty quote", /bg-foreground/.test(buttonOf(big)) && /text-background/.test(buttonOf(big)));
  const busy = render(quotePicker({ onQuoteCategoryIds: ["cat1"] }));
  ok("…and on a quote that already has a service — never the dashed outline", /bg-foreground/.test(buttonOf(busy)) && !/border-dashed/.test(buttonOf(busy)));
  ok("…48px tall", /min-h-12/.test(buttonOf(busy)));

  const small = render(quotePicker({ categories: [STAIRS, CABINETS], products: [STAIR_REFINISH] }));
  ok("3 offerings → inline buttons", small.includes('data-service-picker="inline"') && !small.includes("data-add-service-open"));
  ok("…the quote types as the old pill row (presets and all)", small.includes('data-service-tile="stairs"') && small.includes('data-service-tile="cabinet_refinishing"'));
  ok("…the service as a pill with its template count", small.includes('data-service-picker-inline="p2"') && small.includes("Template lines (1)"));
  const four = render(quotePicker({ categories: [STAIRS, CABINETS, ELEC], products: [OUTLET] }));
  ok("exactly 4 stays inline", four.includes('data-service-picker="inline"'));

  const noServices = render(quotePicker({ categories: [], products: [] }));
  ok("nothing enabled → the old sentence and a way to Settings", noServices.includes('data-service-picker="empty"') && noServices.includes("No services enabled yet"));
  const invoiceEmpty = render(quotePicker({ kind: "invoice", products: [HINGE] }));
  eq("an invoice with no services draws nothing (its Add line item remains)", invoiceEmpty, "");
  const invoiceBig = render(quotePicker({ kind: "invoice", products: [...PRODUCTS, { ...OUTLET, id: "p9", name: "GFCI" }] }));
  ok("an invoice with 6 services → the button, counted as services", invoiceBig.includes("data-add-service-open") && invoiceBig.includes("6 services to choose from"));
}

// ───────────────────────────────────────────────────────────────────────────
console.log("F. the words, in nine languages");
// ───────────────────────────────────────────────────────────────────────────
{
  const picker = src("app/components/quotes/builder/AddServicePicker.js");
  const keys = [...new Set([...picker.matchAll(/t\(\s*"(app\.[a-zA-Z]+\.[a-zA-Z_]+)"/g)].map((m) => m[1]))];
  ok("the picker's words are catalogue keys", keys.filter((k) => k.startsWith("app.servicePicker.")).length >= 12, String(keys.length));
  ok("…including Cancel", keys.includes("app.action.cancel"));
  const holes = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
  for (const lang of Object.keys(APP_MESSAGES)) {
    const missing = keys.filter((k) => !(k in APP_MESSAGES[lang]));
    ok(`every picker key exists in ${lang}`, missing.length === 0, missing.join(", "));
    const bad = keys.filter((k) => k in APP_MESSAGES[lang] && holes(APP_MESSAGES[lang][k]) !== holes(APP_MESSAGES.en[k]));
    ok(`${lang}: the placeholders match English`, bad.length === 0, bad.join(", "));
  }
  ok("nine languages", Object.keys(APP_MESSAGES).length === 9, Object.keys(APP_MESSAGES).join(","));
  // The old dialog's strings went with it — a string nothing prints is a
  // translation somebody maintains for nobody.
  const dropped = ["intro", "introInvoice", "addSelected", "select", "pricedBy", "templateInside", "addAsLine", "noRate", "ruleFilled", "ruleMeasured", "ruleNotOnQuote", "ruleTyped"].map((k) => `app.servicePicker.${k}`);
  const left = Object.entries(APP_MESSAGES).flatMap(([lang, m]) => dropped.filter((k) => k in m).map((k) => `${lang}:${k}`));
  ok("the old dialog's strings are gone from every language", left.length === 0, left.join(", "));
  const unused = Object.keys(APP_MESSAGES.en).filter((k) => k.startsWith("app.servicePicker.") && !keys.includes(k));
  ok("every app.servicePicker string is one the picker prints", unused.length === 0, unused.join(", "));
}

// ───────────────────────────────────────────────────────────────────────────
console.log("G. the wiring — the quote types are the old call; the headings come from the server");
// ───────────────────────────────────────────────────────────────────────────
{
  const doc = src("app/components/quotes/builder/DocumentBuilder.js");
  const qb = src("app/components/quotes/builder/QuoteBuilder.js");
  const inv = src("app/components/invoices/builder/InvoiceBuilder.js");
  const me = src("app/components/quotes/builder/AddServicePicker.js");
  const lib = src("lib/quotes/servicePicker.js");
  ok("the document's foot adds a quote type with b.addScopeGroup(category, label), as the tiles did", doc.includes("addType: addAndOpen((category, label) => b.addScopeGroup(category, label))"));
  ok("…and a templated service with the builder's own template add", doc.includes("addTemplate: addAndOpen(b.servicePicker.addTemplate)"));
  ok("the quote's picker is handed addScopeGroup itself", /addType: addScopeGroup,/.test(qb) && /addTemplate: addScopeGroupWithTemplate,/.test(qb));
  ok("the classic layout draws the same control", qb.includes("<AddServicePicker picker={servicePicker}"));
  ok("the foot no longer draws the card grid", !doc.includes("<ServiceTiles"));
  ok("the invoice hands its own two adds", inv.includes("addTemplate: (_category, product) => addProductTemplate(product)") && inv.includes("addLine: (_category, product) => addProductLine(product)"));
  ok("the invoice draws the control", doc.includes("data-invoice-add-service"));
  ok("the dialog is the set-up dialogs' frame, and the phone's sheet", /from "@\/app\/components\/dashboard\/StepDialog"/.test(me) && /from "@\/app\/components\/mobile\/BottomSheet"/.test(me));
  ok("the dialog's press is runPickerEntry, then close", /const addNow = \(entry\) => \{\s*runPickerEntry\(picker, entry\);\s*onClose\(\);/.test(me));
  ok("the dialog's footer is Cancel", /footer=\{cancel\}/.test(me) && /data-service-picker-cancel/.test(me) && /onClick=\{onClose\}/.test(me));
  // The seeds are ~1.3 MB gzipped; the browser never downloads them for the
  // picker — not in its bundle, not as a chunk fetched later.
  const seedPath = /(lib\/services\/seeds|lib\/services\/confirmServices|app\/data\/serviceSeeds)/;
  const imports = (code) => [...code.matchAll(/(?:^import[^;]*?from\s*|import\s*\(\s*)["']([^"']+)["']/gm)].map((m) => m[1]);
  ok("the picker imports no seed module — statically or dynamically", !imports(me).some((m) => seedPath.test(m)) && !/import\s*\(/.test(me), imports(me).join(", "));
  ok("…nor does its lib", !imports(lib).some((m) => seedPath.test(m)) && !/import\s*\(/.test(lib), imports(lib).join(", "));
  ok("no idle prefetch or loading state left behind", !/requestIdleCallback|loadSeedDeps|data-service-picker-loading/.test(me));
  const route = src("app/api/products/route.js");
  ok("GET /api/products attaches the heading with the pure helper and the server's seeds", /seedCategory = productSeedCategory\(p, \{ seedServiceByKey, seedCategoryName, SERVICE_SEEDS \}\)/.test(route) && /if \(seedCategory\) out\.seedCategory = seedCategory;/.test(route));
  ok("…inside the showPricing gate the route already had (nothing new served to anyone)", route.indexOf('requireToggle(full, "showPricing"') > 0 && route.indexOf('requireToggle(full, "showPricing"') < route.indexOf("productSeedCategory(p"));
  ok("the picker reads the heading off the row", /seedCategoryOf\(p, lang\)/.test(me));
  ok("no 'Create custom item' without an add behind it", !/custom item/i.test(me.replace(/\/\/.*$/gm, "")));
}

// ───────────────────────────────────────────────────────────────────────────
console.log("H. contrast, measured — the app's tokens, light and dark");
// ───────────────────────────────────────────────────────────────────────────
{
  const css = src("app/globals.css");
  const block = (sel) => {
    const at = css.indexOf(`${sel} {`);
    const body = css.slice(at, css.indexOf("}", at));
    return Object.fromEntries([...body.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2]]));
  };
  const themes = { light: block(":root"), dark: block(".dark") };
  // [what, foreground token, background token, floor]
  const pairs = [
    ["Add service label on the button", "background", "foreground", 4.5],
    ["the button's edge on the page (not text: 3:1)", "foreground", "background", 3],
    ["tile name on the tile", "foreground", "card", 4.5],
    ["section / trade-suffix text on the dialog", "muted-foreground", "card", 4.5],
    ["the Quote type tag", "muted-foreground", "muted", 4.5],
    ["count under the button, on the page", "muted-foreground", "background", 4.5],
    ["search text and placeholder in the box", "muted-foreground", "background", 4.5],
    ["trade heading on the dialog", "foreground", "card", 4.5],
    ["Cancel on the dialog", "foreground", "card", 4.5],
    ["the bar down a tile's edge (not text: 3:1)", "primary", "card", 3],
  ];
  for (const [theme, tok] of Object.entries(themes)) {
    for (const [what, fg, bg, floor] of pairs) {
      const r = contrastRatio(tok[fg], tok[bg]);
      ok(`${theme}: ${what} ≥ ${floor}:1`, r >= floor, `${tok[fg]} on ${tok[bg]} = ${r.toFixed(2)}`);
      console.log(`  ${theme.padEnd(5)} ${what.padEnd(52)} ${tok[fg]} on ${tok[bg]}  ${r.toFixed(2)}:1`);
    }
  }
}
  // In the document layout the button sits inside the company's data-brand
  // region, where every token is derived from the brand (lib/brand/colour.js
  // deriveBrandTokens). Contractors pick yellow, white, black and mid-grey:
  // the button's label and its edge are measured on each, light and dark.
  // (bg-primary failed here — #808080 put the label at 4.43:1 and a white or
  // yellow brand made the button's edge vanish — which is why it is ink.)
  const brands = ["#06356b", "#1f6f43", "#ffd500", "#ffffff", "#000000", "#808080", "#777777", "#ff5a00", "#00ffff", "#f5f5f5", "#7f7f00", "#8a2be2"];
  let worst = { label: Infinity, edge: Infinity, caption: Infinity };
  for (const dark of [false, true]) {
    for (const b of brands) {
      const t = deriveBrandTokens(b, { dark });
      worst = {
        label: Math.min(worst.label, contrastRatio(t.background, t.foreground)),
        edge: Math.min(worst.edge, contrastRatio(t.foreground, t.card), contrastRatio(t.foreground, t.background)),
        caption: Math.min(worst.caption, contrastRatio(t.mutedForeground, t.background), contrastRatio(t.mutedForeground, t.card)),
      };
    }
  }
  ok("any brand, light or dark: the button's label ≥ 4.5:1", worst.label >= 4.5, worst.label.toFixed(2));
  ok("any brand, light or dark: the button's edge ≥ 3:1 on card and page", worst.edge >= 3, worst.edge.toFixed(2));
  ok("any brand, light or dark: the count under it ≥ 4.5:1", worst.caption >= 4.5, worst.caption.toFixed(2));
  console.log(`  brands ×${brands.length} light+dark — worst: label ${worst.label.toFixed(2)}:1, edge ${worst.edge.toFixed(2)}:1, count ${worst.caption.toFixed(2)}:1`);
  ok("the button reads the ink pair, not the brand fill", /data-add-service-open[\s\S]{0,200}className="[^"]*bg-foreground[^"]*text-background/.test(src("app/components/quotes/builder/AddServicePicker.js")));
if (fails.length) {
  console.error(`\n✗ service picker: ${fails.length} failed, ${pass} passed`);
  for (const f of fails) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`\n✓ service picker: ${pass} checks`);
