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
//   A. The list's rules, executed against hostile input: what is offered
//      (enabled quote types, active services linked to them; never an
//      archived row, a product, a service linked to nothing), the order (the
//      quote's own trades first), the threshold (4 inline, 5 a dialog), the
//      search (accents folded, every word, a trade name keeps its services).
//   B. The preview under a row IS the add: templatePreview builds the lines
//      the same way QuoteBuilder addScopeGroupWithTemplate does — same group,
//      same measurements, same held-back units — and their md5 is compared
//      with that expansion done by hand.
//   C. The quote type's row: the price rule moved out of the old card
//      unchanged (from the cheapest own service, else the rate, else per
//      door; never a benchmark).
//   D. The list, rendered: groups, the quote-type row, a service row with
//      its price, its template count, the preview's words, the held-back
//      explanation, "Add as one line", the invoice's shape, search.
//   E. The control's three shapes (empty / inline / dialog).
//   F. The words: every key in nine languages, the placeholders equal.
//   G. The wiring, read from source: a quote type is still
//      b.addScopeGroup(category, label) — the call the old tiles made.
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
  initiallyOpen,
  templatePreview,
  quoteTypeSummary,
} from "../lib/quotes/servicePicker.js";
import { newScopeGroup } from "../lib/quotes/builderPayload.js";
import { expandServiceTemplate, measurementsFromGroups, keysPricedByGroup } from "../lib/quotes/serviceTemplateLines.js";
import AddServicePicker, { ServicePickerList } from "../app/components/quotes/builder/AddServicePicker.js";
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
eq("they open unfolded", initiallyOpen(onQuote), ["cat4", "cat2"]);
eq("nothing on the quote → the first group open", initiallyOpen(groups), ["cat1"]);
eq("no groups → nothing open", initiallyOpen([]), []);
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
console.log("B. the preview under a row is the add");
// ───────────────────────────────────────────────────────────────────────────
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
console.log("D. the list, rendered");
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
{
  const html = renderList(quotePicker({ onQuoteCategoryIds: ["cat1", "cat4"] }), { initialLinesOpen: "cat1:p2" });
  ok("a search box", html.includes("data-service-picker-search") && html.includes("Search by name, description or trade"));
  ok("every quote type is a group", ["stairs", "cabinet_refinishing", "interior_painting", "electrical"].every((k) => html.includes(`data-service-picker-group="${k}"`)));
  ok("the quote's trades are open and say so", (html.match(/On this quote/g) || []).length === 2);
  ok("an open group leads with its quote type — the scope group and its calculator", html.includes('data-service-picker-type="stairs"') && html.includes("Quote type") && html.includes("Priced by the stair takeoff"));
  ok("…with its price", html.includes("from $95.00 / tread"));
  ok("a closed group draws no rows", !html.includes('data-service-picker-type="interior_painting"'));
  ok("a service row: name, description, own price", html.includes("Stair refinish") && html.includes("Sand and stain.") && /data-service-picker-price[^>]*>\$95\.00/.test(html));
  ok("its template count is the count the Add adds", html.includes("Template lines (1)"));
  ok("the preview says how the line is found and priced", html.includes("Dust containment") && html.includes("1 × $120.00"));
  ok("…and why the tread line is held back", html.includes("data-service-picker-held") && html.includes("Treads — already priced by the stair takeoff"));
  ok("a templated service offers Add and Add as one line", html.includes('data-service-picker-add="p2"') && html.includes('data-service-picker-add-line="p2"') && html.includes("Add as one line"));
  ok("a service with no template offers Add only", html.includes('data-service-picker-add="p8"') && !html.includes('data-service-picker-add-line="p8"'));
  ok("the description's first line only", html.includes("Replace the service panel.") && !html.includes("Permit included."));
  ok("the archived service never appears", !html.includes("Old service"));
  ok("the product never appears", !html.includes("Soft-close hinge"));
  ok("every row's tick box is labelled", (html.match(/aria-label="Select /g) || []).length >= 3);
  ok("44px targets on Add", /data-service-picker-add="p2"/.test(html) && html.includes("min-h-11"));
  ok("no NaN, no undefined", !/NaN|undefined/.test(html));

  const withPreset = renderList(quotePicker({ onQuoteCategoryIds: ["cat1"] }));
  ok("a quote type with section presets opens them, as the tile did", /data-service-picker-type-add="stairs"[^>]*>|aria-expanded/.test(withPreset));

  const searched = renderList(quotePicker(), { initialQuery: "outlet" });
  ok("a search opens every matching group and keeps only matches", searched.includes("Outlet install") && !searched.includes("Panel upgrade"));
  ok("…and hides a quote type whose name did not match", !searched.includes('data-service-picker-type="electrical"'));
  const none = renderList(quotePicker(), { initialQuery: "zzzz" });
  ok("no match says so, with the query", none.includes("data-service-picker-nomatch") && none.includes("zzzz"));

  const priceless = renderList(quotePicker({ showPricing: false, onQuoteCategoryIds: ["cat1"] }), { initialLinesOpen: "cat1:p2" });
  ok("showPricing off: no price on any row or preview line", !priceless.includes("$95.00") && !priceless.includes("$120.00"));

  const fr = renderList(quotePicker({ language: "fr", onQuoteCategoryIds: ["cat4"] }), { lang: "fr" });
  ok("the service name is the document's language", fr.includes("Remplacement de panneau — 200 A"));
  ok("the interface is the reader's language", fr.includes("Rechercher par nom, description ou métier") && fr.includes("Type de soumission"));

  const invoicePicker = quotePicker({ kind: "invoice", preview: (_c, p) => (p.templateLines?.length ? { offered: true, count: p.templateLines.length, lines: [], groups: null } : null) });
  const invHtml = renderList(invoicePicker);
  ok("invoice: no quote-type rows", !invHtml.includes("data-service-picker-type="));
  ok("invoice: the unlinked service under Other services", invHtml.includes("Other services") && invHtml.includes("Rush fee") === false /* closed group */);
  const invOpen = renderList(invoicePicker, { initialQuery: "rush" });
  ok("invoice: …found by search", invOpen.includes("Rush fee"));
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
  const big = render(quotePicker());
  ok("more than 4 → one Add service button", big.includes('data-service-picker="dialog"') && big.includes("data-add-service-open") && big.includes(">Add service<"));
  ok("…saying how much is behind it", big.includes("4 quote types · 4 services"));
  ok("…and no grid of cards", !big.includes("data-service-tile=") && !big.includes("data-service-card"));
  ok("…the dialog is not drawn until pressed", !big.includes("data-service-picker-list"));
  ok("an empty quote gets the filled button", /data-add-service-open[^>]*class="[^"]*bg-primary/.test(big) || /class="[^"]*bg-primary[^"]*"[^>]*data-add-service-open/.test(big));

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
  const keys = [...new Set([...picker.matchAll(/t\(\s*"(app\.servicePicker\.[a-zA-Z]+)"/g)].map((m) => m[1]))];
  ok("the picker has keys of its own", keys.length >= 20, String(keys.length));
  const holes = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
  for (const lang of Object.keys(APP_MESSAGES)) {
    const missing = keys.filter((k) => !(k in APP_MESSAGES[lang]));
    ok(`every picker key exists in ${lang}`, missing.length === 0, missing.join(", "));
    const bad = keys.filter((k) => k in APP_MESSAGES[lang] && holes(APP_MESSAGES[lang][k]) !== holes(APP_MESSAGES.en[k]));
    ok(`${lang}: the placeholders match English`, bad.length === 0, bad.join(", "));
  }
  ok("nine languages", Object.keys(APP_MESSAGES).length === 9, Object.keys(APP_MESSAGES).join(","));
}

// ───────────────────────────────────────────────────────────────────────────
console.log("G. the wiring — the quote types are the old call");
// ───────────────────────────────────────────────────────────────────────────
{
  const doc = src("app/components/quotes/builder/DocumentBuilder.js");
  const qb = src("app/components/quotes/builder/QuoteBuilder.js");
  const inv = src("app/components/invoices/builder/InvoiceBuilder.js");
  ok("the document's foot adds a quote type with b.addScopeGroup(category, label), as the tiles did", doc.includes("addType: addAndOpen((category, label) => b.addScopeGroup(category, label))"));
  ok("…and a templated service with the builder's own template add", doc.includes("addTemplate: addAndOpen(b.servicePicker.addTemplate)"));
  ok("the quote's picker is handed addScopeGroup itself", /addType: addScopeGroup,/.test(qb) && /addTemplate: addScopeGroupWithTemplate,/.test(qb));
  ok("the classic layout draws the same control", qb.includes("<AddServicePicker picker={servicePicker}"));
  ok("the foot no longer draws the card grid", !doc.includes("<ServiceTiles"));
  ok("the invoice hands its own two adds", inv.includes("addTemplate: (_category, product) => addProductTemplate(product)") && inv.includes("addLine: (_category, product) => addProductLine(product)"));
  ok("the invoice draws the control", doc.includes("data-invoice-add-service"));
  ok("the dialog is the set-up dialogs' frame, and the phone's sheet", /from "@\/app\/components\/dashboard\/StepDialog"/.test(src("app/components/quotes/builder/AddServicePicker.js")) && /from "@\/app\/components\/mobile\/BottomSheet"/.test(src("app/components/quotes/builder/AddServicePicker.js")));
}

if (fails.length) {
  console.error(`\n✗ service picker: ${fails.length} failed, ${pass} passed`);
  for (const f of fails) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`\n✓ service picker: ${pass} checks`);
