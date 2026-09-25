// scripts/check-service-templates.mjs
//
// Run: node --import ./scripts/alias-loader.mjs --import ./scripts/db-stub-loader.mjs scripts/check-service-templates.mjs
//
// The estimate template inside a service (lib/services/templates.js), the
// seed LOADER that copies a seed row's template onto a Product
// (lib/services/seeds.js, lib/products/seedServices.js) and the capture
// importer (lib/services/templateImport.js), executed rather than read.
// The seed CONTENT is another pass's; this check runs the loader against
// fixtures in the contract seeds.js documents, so a seed written to that
// contract lands as these fixtures do.
//
// ── What is asserted ───────────────────────────────────────────────────────
//
//   A. The sanitiser is the boundary: a line with no name is dropped, a
//      negative cost becomes null, a NaN qty becomes 1, an unknown kind
//      becomes "other", an unknown measurement key is not stored, a 300 %
//      discount is clamped, a non-https image is refused, an emptied
//      template is null (never []), the line cap holds.
//   B. expandTemplate against hostile input: no template → []; missing
//      measurements → typed qty and a named warning; zero qty → zero amount,
//      never null; a measured line takes the figure (× waste) from the shape
//      summariseRoof returns; a seed's USD converts by the given fx and is
//      rounded; a needed-but-missing fx → null rate and a warning, never the
//      USD number; the document's language picks the line's translation and
//      flags a missing one.
//   C. The loader on a fixture seed row in the documented contract: an
//      English company gets English lines with fr/es/it/de/uk/tl beside
//      them; a French company gets French lines with the other six beside
//      them; USD converts for CAD and not for USD; a percent discount is not
//      converted and a fixed one is; the discount name follows the language;
//      imageUrl is copied when https and dropped otherwise; a plain service
//      gets no template keys at all; a translations block that is shorter
//      than the lines, or missing a language, degrades to the source text
//      rather than throwing.
//   D. The capture importer: the eleven captured electrical templates load
//      through the same loader and their totals after discount equal the
//      capture's; no captured description is copied into a line.
//   E. No client-facing route imports lib/services/templates.js.
//   G. The measurement registry (lib/services/measurementKeys.js): every key
//      is a name a takeoff module really produces — executed against the
//      paint geometry and the stairs derivation — plus the roof shape; an
//      unknown key is rejected by validateTemplateLines and ignored by the
//      sanitiser; a measured line takes its qty from a flat object or from
//      summariseRoof's nested shape and is flagged needsMeasurement when the
//      figure is missing; waste applies to material lines only.
//   H. Where a template is offered (the owner's quote-type rule): templatesFor
//      offers only enabled, templated rows linked to the quote's type, and
//      narrowed by estimate type when the row names any; the seed's
//      `categories` keys resolve to extra category links and its
//      `estimateTypes` to known keys only; a switched-off row is never offered.
//   F. The preset library (lib/services/presetLibrary.js): the rounding step
//      follows the median's magnitude, every figure of a row shares it, a
//      point stays a point (no Min/Max padded), an unconvertible currency
//      gives no range, the company's enabled trades come first, "Your price"
//      is the company's own row by seed key (services) or by name (add-ons),
//      and the position rule (below / in / above) is exact at the edges.

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import {
  LINE_KINDS,
  MEASUREMENT_KEYS,
  MAX_TEMPLATE_LINES,
  sanitiseTemplateLine,
  sanitiseTemplateLines,
  sanitiseDefaultDiscount,
  sanitiseImageUrl,
  expandTemplate,
  templateTotals,
  groupLinesByKind,
  measurementValue,
  validateTemplateLines,
  templatesFor,
  sanitiseEstimateTypes,
  ESTIMATE_TYPE_KEYS,
} from "@/lib/services/templates";
import { MEASUREMENT_KEYS as REGISTRY, MEASUREMENT_KEY_LIST, isMeasurementKey, TRADE_MEASUREMENTS, measurementKeysForTrade } from "@/lib/services/measurementKeys";
import { roofLabour } from "@/lib/pricing/roofLabour";
import { deriveGutters } from "@/lib/measure/gutterMeasurement";
import { baseMaterials } from "@/lib/pricing/paverTakeoff";
import { LOT_AREA_FIELD, LOT_EDGE_FIELD } from "@/lib/measure/lotTakeoff";
import { estimateOpenings, estimateCircuits, estimateWire, estimateLabourHours } from "@/lib/estimate/rewireTakeoff";
import { measureTracedArea } from "@/lib/estimate/tracedArea";
import { derivedGeometry } from "@/lib/pricing/paintTakeoff";
import { stairsFromSteps } from "@/lib/estimate/stairsFromSteps";
import { CAPTURE } from "../docs/screens/app-guide/harness/fixtures/estimate-templates-electrical.js";
import { seedText, seedTemplateFor, seedCategoryKeys, planServiceSeeds, TEMPLATE_LANGUAGES } from "@/lib/services/seeds";
import { productDataForSeed } from "@/lib/products/seedServices";
import { templatesFromCapture } from "@/lib/services/templateImport";
import { presetStep, roundToStep, presetRange, libraryTrades, libraryForTrade, positionInRange } from "@/lib/services/presetLibrary";

let passed = 0;
let fail = 0;
const ok = (cond, label, detail) => {
  if (cond) passed += 1;
  else {
    fail += 1;
    console.log(`  FAIL ${label}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ""}`);
  }
};
const section = (t) => console.log(`\n${t}`);
const root = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const read = (p) => readFileSync(path.join(root, p), "utf8");

section("A — the sanitiser");
{
  ok(sanitiseTemplateLine(null) === null, "null line → null");
  ok(sanitiseTemplateLine("x") === null, "string line → null");
  ok(sanitiseTemplateLine({ name: "   " }) === null, "blank name → dropped");
  const l = sanitiseTemplateLine({ kind: "bogus", name: " Fit ", qty: "abc", unitPrice: "12.345", unitCost: -5, taxable: "yes", measurementKey: "stepFlashingFt" });
  ok(l.kind === "other", "unknown kind → other", l.kind);
  ok(l.name === "Fit", "name trimmed", l.name);
  ok(l.qty === 1, "NaN qty → 1", l.qty);
  ok(l.unitPrice === 12.35, "price rounded to cents", l.unitPrice);
  ok(l.unitCost === null, "negative cost → null", l.unitCost);
  ok(l.taxable === true, "non-boolean taxable → true", l.taxable);
  ok(!("measurementKey" in l), "unknown measurement key not stored", l);
  const m = sanitiseTemplateLine({ kind: "material", name: "Shingles", measurementKey: "squares", wastePct: 999, qty: 0 });
  ok(m.measurementKey === "squares" && m.wastePct === 50, "known key kept, waste clamped to 50", m);
  ok(m.qty === 0, "zero qty is kept as zero", m.qty);
  ok(m.unit === "each", "material default unit each", m.unit);
  ok(sanitiseTemplateLine({ kind: "labour", name: "x" }).unit === "flat", "labour default unit flat");
  const tr = sanitiseTemplateLine({ name: "x", translations: { fr: { name: "y" }, FR: { name: "z" }, es: { name: "" }, de: "nope", it: { name: "i", description: "d" } } });
  ok(JSON.stringify(Object.keys(tr.translations)) === JSON.stringify(["fr", "it"]), "translations: only 2-letter keys with a name", tr.translations);
  ok(sanitiseTemplateLines(null) === null && sanitiseTemplateLines("x") === null, "non-array → null");
  ok(sanitiseTemplateLines([]) === null && sanitiseTemplateLines([{}, null]) === null, "emptied template → null, never []");
  const many = sanitiseTemplateLines(Array.from({ length: MAX_TEMPLATE_LINES + 20 }, (_, i) => ({ name: `l${i}` })));
  ok(many.length === MAX_TEMPLATE_LINES, "line cap holds", many.length);
  ok(sanitiseDefaultDiscount(null) === null && sanitiseDefaultDiscount({ amount: 0 }) === null && sanitiseDefaultDiscount({ amount: -5 }) === null, "no/zero/negative discount → null");
  const d = sanitiseDefaultDiscount({ kind: "percent", amount: 300, name: "" });
  ok(d.amount === 100 && d.name === "Discount", "percent clamped to 100, name defaulted", d);
  ok(sanitiseDefaultDiscount({ kind: "weird", amount: 5 }).kind === "fixed", "unknown discount kind → fixed");
  ok(sanitiseImageUrl("http://x/y.png") === null && sanitiseImageUrl("javascript:alert(1)") === null && sanitiseImageUrl("") === null, "non-https image refused");
  ok(sanitiseImageUrl("https://res.cloudinary.com/a/b.jpg") === "https://res.cloudinary.com/a/b.jpg", "https image kept");
}

section("B — expandTemplate against hostile input");
{
  ok(JSON.stringify(expandTemplate(null)) === "[]" && JSON.stringify(expandTemplate({ templateLines: "x" })) === "[]", "no template → []");
  const product = {
    templateLines: [
      { kind: "labour", name: "Tear-off", qty: 2, unit: "hour", unitPrice: 100, unitCost: 50, translations: { fr: { name: "Arrachage", description: "Retirer" } } },
      { kind: "material", name: "Shingles", qty: 5, unit: "square", unitPrice: 120, unitCost: 90, measurementKey: "squares", wastePct: 10 },
      { kind: "material", name: "Ridge cap", qty: 1, unit: "linear_ft", unitPrice: 4, unitCost: 3, measurementKey: "ridgeFt" },
      { kind: "other", name: "Zero", qty: 0, unit: "flat", unitPrice: 50, unitCost: 0 },
      { kind: "other", name: "Unpriced", qty: 1, unit: "flat" },
    ],
  };
  const plain = expandTemplate(product, { currency: "CAD" });
  ok(plain.length === 5, "one line per template line", plain.length);
  ok(plain[0].quantity === 2 && plain[0].amount === 200 && plain[0].cost === 100, "typed qty × rate, cost", plain[0]);
  ok(plain[1].quantity === 5 && plain[1].measured === false && plain[1].warnings.includes("measurement:squares"), "missing measurement → typed qty + warning", plain[1]);
  ok(plain[3].amount === 0 && plain[3].quantity === 0, "zero qty → amount 0, not null", plain[3]);
  ok(plain[4].rate === null && plain[4].amount === null, "unpriced line → null rate and amount", plain[4]);
  const t = templateTotals(plain, { kind: "percent", amount: 10 });
  ok(t.subtotal === 804 && t.unpriced === 1 && t.discountAmount === 80.4 && t.total === 723.6, "totals: subtotal 200+600+4+0, one unpriced, 10 %", t);
  const tf = templateTotals(plain, { kind: "fixed", amount: 5000 });
  ok(tf.discountAmount === 804 && tf.total === 0, "fixed discount capped at the subtotal", tf);
  ok(templateTotals([]).total === 0 && templateTotals(null).margin === null, "empty totals → 0, margin null");

  // The shape summariseRoof returns: squares at the top, linear feet nested.
  const roof = { areaSqft: 2140, squares: 21.4, linear: { eaveFt: 120, ridgeFt: 44, hipFt: 0, valleyFt: 18, rakeFt: 60, perimeterFt: 180 } };
  const measured = expandTemplate(product, { measurements: roof, currency: "CAD" });
  ok(measured[1].quantity === 23.54 && measured[1].measured && measured[1].amount === 2824.8, "squares × 1.10 waste from the top level", measured[1]);
  ok(measured[2].quantity === 44 && measured[2].measured && measured[2].amount === 176, "ridgeFt read from linear", measured[2]);
  ok(measurementValue(roof, "hipFt") === 0 && measurementValue(roof, "wastePct") === null && measurementValue(null, "squares") === null, "measurementValue: 0 is a value, unknown key null, no report null");
  ok(measurementValue({ squares: -3 }, "squares") === null && measurementValue({ squares: "abc" }, "squares") === null, "negative / NaN measurement → null");

  const usd = { templateLines: [{ kind: "labour", name: "x", qty: 1, unit: "flat", unitPrice: 200, unitCost: 100 }] };
  const cad = expandTemplate(usd, { currency: "CAD", fromCurrency: "USD", fx: 1.37 });
  ok(cad[0].rate === 275 && cad[0].cost === 135 && cad[0].currency === "CAD", "USD → CAD by fx, rounded to $5", cad[0]);
  const same = expandTemplate(usd, { currency: "USD", fromCurrency: "USD", fx: 999 });
  ok(same[0].rate === 200, "same currency ignores fx", same[0]);
  const noFx = expandTemplate(usd, { currency: "CAD", fromCurrency: "USD" });
  ok(noFx[0].rate === null && noFx[0].warnings.includes("fx"), "needed fx missing → null rate + warning, never the USD figure", noFx[0]);
  const badFx = expandTemplate(usd, { currency: "CAD", fromCurrency: "USD", fx: -1 });
  ok(badFx[0].rate === null, "negative fx → null rate", badFx[0]);

  const fr = expandTemplate(product, { language: "fr" });
  ok(fr[0].description === "Arrachage" && fr[0].detail === "Retirer" && fr[0].missing === false, "French line text picked", fr[0]);
  ok(fr[1].description === "Shingles" && fr[1].missing === true && fr[1].warnings.includes("translation:fr"), "missing translation → source text, flagged", fr[1]);
  const g = groupLinesByKind(plain);
  ok(g.labour.length === 1 && g.material.length === 2 && g.other.length === 2, "grouped by kind", Object.fromEntries(Object.entries(g).map(([k, v]) => [k, v.length])));
}

section("C — the loader on a fixture seed row in the documented contract");
{
  const T = (name, description) => ({ name, description });
  const fixture = {
    seedKey: "fq.electrical.specialty.ev_charger",
    category: "specialty",
    unit: "each",
    benchmark: { low: 350, median: 650, high: 1125, currency: "USD", source: "benchmark", asOf: "2026-09-21" },
    durationMinutes: null,
    bookable: false,
    name: { en: "EV charger installation", fr: "Installation de borne de recharge", es: "Instalación de cargador de VE" },
    description: { en: "A dedicated 240 V circuit and the charger mounted.", fr: "Un circuit dédié de 240 V et la borne posée.", es: "Un circuito dedicado de 240 V y el cargador montado." },
    templateLines: [
      { kind: "labour", name: "EV charger installation labour", description: "Installed on its own dedicated circuit.", qty: 1, unit: "flat", unitPrice: 300, unitCost: 150, taxable: true },
      { kind: "material", name: "Level 2 EV charger — 48 A", description: "240 V / 48 A on a NEMA 14-50.", qty: 1, unit: "each", unitPrice: 400, unitCost: 250, taxable: false },
    ],
    defaultDiscount: { name: "New customer discount", kind: "fixed", amount: 35 },
    imageUrl: "https://res.cloudinary.com/x/ev.jpg",
    translations: {
      fr: { name: "Installation de borne de recharge", description: "Un circuit dédié de 240 V et la borne posée.", templateLines: [T("Main-d'œuvre — installation de la borne", "Installée sur son circuit dédié."), T("Borne niveau 2 — 48 A", "240 V / 48 A sur NEMA 14-50.")], defaultDiscountName: "Rabais nouveau client" },
      es: { name: "Instalación de cargador de VE", description: "Un circuito dedicado de 240 V y el cargador montado.", templateLines: [T("Mano de obra — instalación del cargador", "Instalado en su circuito dedicado."), T("Cargador nivel 2 — 48 A", "240 V / 48 A en NEMA 14-50.")] },
      it: { name: "Installazione di stazione di ricarica", description: "Un circuito dedicato a 240 V e il caricatore montato.", templateLines: [T("Manodopera — installazione del caricatore", "Installato su un circuito dedicato."), T("Caricatore livello 2 — 48 A", "240 V / 48 A su NEMA 14-50.")] },
      de: { name: "Installation einer Ladestation", description: "Ein eigener 240-V-Stromkreis und die Wallbox montiert.", templateLines: [T("Arbeitsleistung — Wallbox-Montage", "Auf eigenem Stromkreis installiert."), T("Level-2-Wallbox — 48 A", "240 V / 48 A an NEMA 14-50.")] },
      uk: { name: "Встановлення зарядної станції", description: "Окрема лінія 240 В і зарядний пристрій змонтовано.", templateLines: [T("Робота — монтаж зарядної станції", "На окремій лінії."), T("Зарядний пристрій 2-го рівня — 48 А", "240 В / 48 А, NEMA 14-50.")] },
      tl: { name: "Pag-install ng EV charger", description: "Dedikadong 240 V na circuit at naka-mount ang charger.", templateLines: [T("Trabaho — pag-install ng EV charger", "Naka-install sa sariling circuit."), T("Level 2 EV charger — 48 A", "240 V / 48 A sa NEMA 14-50.")] },
    },
    templateCategory: "installation",
  };
  const opts = (language, currency) => ({ companyId: "c", categoryId: "k", language, currency });

  const en = productDataForSeed(fixture, opts("en", "USD"));
  ok(en.name === "EV charger installation" && Object.keys(en.translations).sort().join(",") === "de,es,fr,it,tl,uk", "English company: source English, six service translations", Object.keys(en.translations));
  ok(en.translations.it.name === "Installazione di stazione di ricarica" && en.translations.fr.description === "Un circuit dédié de 240 V et la borne posée.", "service translations read from name/description maps AND the translations block");
  ok(Array.isArray(en.templateLines) && en.templateLines.length === 2, "templateLines written", en.templateLines?.length);
  ok(en.templateLines[0].name === "EV charger installation labour" && en.templateLines[0].unitPrice === 300 && en.templateLines[1].unitCost === 250, "USD untouched, English line text", en.templateLines);
  ok(Object.keys(en.templateLines[0].translations).sort().join(",") === "de,es,fr,it,tl,uk" && en.templateLines[0].translations.uk.name === "Робота — монтаж зарядної станції", "each line carries the six other languages, same order as the lines", en.templateLines[0].translations);
  ok(en.templateLines[1].taxable === false && en.templateLines[0].taxable === true, "tax flags kept");
  ok(en.defaultDiscount?.amount === 35 && en.defaultDiscount.kind === "fixed" && en.defaultDiscount.name === "New customer discount", "USD discount, English name", en.defaultDiscount);
  ok(en.imageUrl === "https://res.cloudinary.com/x/ev.jpg", "imageUrl copied", en.imageUrl);
  ok(en.unitPrice === 650, "headline price is still the benchmark median", en.unitPrice);

  const fr = productDataForSeed(fixture, opts("fr", "CAD"));
  ok(fr.name === "Installation de borne de recharge" && !fr.translations.fr && fr.translations.en?.name === "EV charger installation", "French company: source French, English among the translations", Object.keys(fr.translations));
  ok(fr.templateLines[0].name === "Main-d'œuvre — installation de la borne" && fr.templateLines[0].description === "Installée sur son circuit dédié.", "French company: line text in French", fr.templateLines[0]);
  ok(fr.templateLines[0].translations.en?.name === "EV charger installation labour" && fr.templateLines[0].translations.tl && !fr.templateLines[0].translations.fr && Object.keys(fr.templateLines[0].translations).length === 6, "French company: line translations hold English and the other five", Object.keys(fr.templateLines[0].translations));
  ok(fr.templateLines[0].unitPrice === 410 && fr.templateLines[1].unitPrice === 550 && fr.templateLines[1].unitCost === 345, "CAD: line money converted and rounded to $5", fr.templateLines.map((l) => [l.unitPrice, l.unitCost]));
  ok(fr.defaultDiscount.amount === 50 && fr.defaultDiscount.name === "Rabais nouveau client", "CAD: fixed discount converted, name in French", fr.defaultDiscount);
  ok(fr.unitPrice === 890, "CAD headline price converted", fr.unitPrice);

  const pct = productDataForSeed({ ...fixture, defaultDiscount: { name: "Regular", kind: "percent", amount: 3 } }, opts("en", "CAD"));
  ok(pct.defaultDiscount.amount === 3 && pct.defaultDiscount.kind === "percent", "percent discount not converted", pct.defaultDiscount);
  const es = productDataForSeed(fixture, opts("es", "USD"));
  ok(es.defaultDiscount.name === "New customer discount", "no discount name in a language → the English name", es.defaultDiscount);
  const it = productDataForSeed(fixture, opts("it", "USD"));
  ok(it.name === "Installazione di stazione di ricarica" && it.templateLines[1].name === "Caricatore livello 2 — 48 A", "Italian company: service and line text from the translations block");
  const pa = productDataForSeed(fixture, opts("pa", "USD"));
  ok(pa.name === "EV charger installation" && pa.templateLines[0].name === "EV charger installation labour" && Object.keys(pa.translations).length === 6, "a language the seed does not carry → English source, six translations");

  const bad = productDataForSeed({ ...fixture, imageUrl: "http://plain/x.png" }, opts("en", "USD"));
  ok(!("imageUrl" in bad), "non-https image not written", bad.imageUrl);
  const plain = productDataForSeed({ seedKey: "fq.x.y.z", category: "y", unit: "flat", benchmark: null, name: { en: "Plain", fr: "Simple", es: "Sencillo" }, description: { en: "d", fr: "d", es: "d" } }, opts("en", "USD"));
  ok(!("templateLines" in plain) && !("defaultDiscount" in plain) && !("imageUrl" in plain), "plain service: no template keys at all (Prisma refuses a bare null)", Object.keys(plain));
  ok(Object.keys(seedText(plain === null ? {} : { name: { en: "Plain", fr: "Simple", es: "Sencillo" }, description: {} }, "en").translations).sort().join(",") === "es,fr", "plain service: two translations");

  const short = productDataForSeed({ ...fixture, translations: { fr: { name: "Installation", templateLines: [T("Main-d'œuvre", "")] } } }, opts("fr", "USD"));
  ok(short.templateLines[0].name === "Main-d'œuvre" && short.templateLines[1].name === "Level 2 EV charger — 48 A" && Object.keys(short.templateLines[1].translations).join(",") === "en", "a translations block shorter than the lines degrades to the source text on the missing line (English kept beside it)", short.templateLines.map((l) => [l.name, Object.keys(l.translations || {})]));
  const noTr = productDataForSeed({ ...fixture, translations: undefined }, opts("fr", "CAD"));
  ok(noTr.name === "Installation de borne de recharge" && noTr.templateLines[0].name === "EV charger installation labour" && !noTr.templateLines[0].translations, "no translations block: French service name from the name map, English lines, no line translations");
  const hostile = productDataForSeed({ ...fixture, translations: { fr: "nope", es: { templateLines: "x" } }, templateLines: [{ kind: "labour", name: "", qty: -1 }, null, { kind: "material", name: "Only", unitPrice: -5 }] }, opts("fr", "USD"));
  ok(hostile.templateLines.length === 1 && hostile.templateLines[0].name === "Only" && hostile.templateLines[0].unitPrice === null, "hostile lines and translations: bad lines dropped, negative price null, nothing thrown", hostile.templateLines);
  const t = seedTemplateFor(fixture, { language: "en", currency: "GBP" });
  ok(t.templateLines[0].unitPrice === null && t.defaultDiscount === null, "unsupported currency: null prices, no fixed discount (never the USD figure)", t);
  const plan = planServiceSeeds({ seed: { services: [fixture, { seedKey: "fq.a.b.c", pricedBy: "takeoff" }] }, existingSeedKeys: [] });
  ok(plan.toCreate.length === 1 && plan.referenceOnly === 1, "a templated takeoff service is still never written as a flat price", plan);
}

section("D — the capture importer through the same loader");
{
  const capture = JSON.parse(read("docs/research/hcp-estimate-templates-electrical.json"));
  const rows = templatesFromCapture(capture);
  ok(rows.length === 11, "eleven captured templates", rows.length);
  ok(new Set(rows.map((r) => r.seedKey)).size === 11, "eleven distinct seed keys", rows.map((r) => r.seedKey));
  ok(rows.every((r) => TEMPLATE_LANGUAGES.includes("en") && ["installation", "repair", "inspection", "maintenance"].includes(r.templateCategory)), "each under one of the four headings", rows.map((r) => r.templateCategory));
  const captured = capture.categories.flatMap((c) => c.templates.map((t) => Math.round(t.total * 100) / 100)).sort((a, b) => a - b);
  const ours = rows
    .map((r) => {
      const row = seedTemplateFor(r, { language: "en", currency: "USD" });
      return templateTotals(expandTemplate(row, { currency: "USD" }), row.defaultDiscount).total;
    })
    .sort((a, b) => a - b);
  ok(JSON.stringify(captured) === JSON.stringify(ours), "totals after discount equal the capture's", { captured, ours });
  const capturedText = capture.categories.flatMap((c) => c.templates.flatMap((t) => [...(t.labor || []), ...(t.materials || [])].map((l) => l.description).filter(Boolean)));
  const ourText = rows.flatMap((r) => r.templateLines.map((l) => l.description)).filter(Boolean);
  ok(ourText.length === 0 && capturedText.length > 0, "no captured description copied into a line", ourText.slice(0, 3));
  const panel = rows.find((r) => r.name.en === "Panel Upgrade");
  ok(panel && panel.templateLines.length === 3 && panel.templateLines[2].kind === "material" && panel.templateLines[2].taxable === false && panel.defaultDiscount.amount === 75, "panel upgrade: two labour lines, one untaxed material, $75 off", panel?.templateLines);
  const gfci = rows.find((r) => r.name.en === "Damaged GFCI Outlet Repair");
  ok(gfci?.defaultDiscount.kind === "percent" && gfci.defaultDiscount.amount === 3, "percent discount kind mapped", gfci?.defaultDiscount);
  const cad = productDataForSeed(panel, { companyId: "c", categoryId: "k", language: "en", currency: "CAD" });
  ok(cad.templateLines[2].unitPrice === 1165 && cad.unitPrice === 2125, "a CAD demo gets the capture converted like a seed", [cad.templateLines[2].unitPrice, cad.unitPrice]);
  ok(JSON.stringify(templatesFromCapture(null)) === "[]" && JSON.stringify(templatesFromCapture({ categories: [{ templates: [{}] }] })[0].templateLines) === "[]", "hostile capture: empty, never thrown");
}

section("E — nothing client-facing imports the templates");
{
  const clientDirs = ["app/quote", "app/book", "app/q", "app/portal", "app/site", "app/embed", "app/api/self-quote", "app/api/public"];
  const walk = (dir) => {
    let out = [];
    let entries = [];
    try {
      entries = readdirSync(path.join(root, dir), { withFileTypes: true });
    } catch {
      return out;
    }
    for (const e of entries) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) out = out.concat(walk(p));
      else if (/\.(js|jsx|ts|tsx)$/.test(e.name)) out.push(p);
    }
    return out;
  };
  for (const dir of clientDirs) {
    for (const f of walk(dir)) {
      const src = read(f);
      ok(!/lib\/services\/templates|lib\/services\/templateImport/.test(src), `${f}: does not import the templates`);
    }
  }
}

section("F — the preset library");
{
  ok(presetStep(12) === 5 && presetStep(49.99) === 5 && presetStep(50) === 10 && presetStep(499) === 10 && presetStep(500) === 25 && presetStep(1999) === 25 && presetStep(2000) === 50 && presetStep(-1) === 1 && presetStep("x") === 1, "rounding step by median magnitude");
  ok(roundToStep(1090, 25) === 1100 && roundToStep(1112, 25) === 1100 && roundToStep(2, 5) === 5 && roundToStep(0, 5) === null && roundToStep(null, 5) === null, "roundToStep: nearest step, a positive figure never rounds to zero, null stays null");
  const bm = { low: 200, median: 400, high: 1090, currency: "USD", source: "benchmark", asOf: "2026-09-21" };
  const usd = presetRange(bm, "USD");
  ok(usd.min === 200 && usd.median === 400 && usd.max === 1090 && usd.step === 10, "USD: rounded to the row's $10 step", usd);
  const cad = presetRange(bm, "CAD");
  ok(cad.min === 275 && cad.median === 550 && cad.max === 1500 && cad.step === 25 && cad.currency === "CAD", "CAD: converted by benchmarkFx ($274 · $548 · $1,493) then rounded to the $25 step a $550 median takes", cad);
  ok(presetRange(bm, "GBP") === null && presetRange(null, "CAD") === null && presetRange({ median: 0 }, "CAD") === null, "unconvertible currency or no median → no range");
  const point = presetRange({ low: null, median: 1130, high: null, currency: "USD", source: "benchmark" }, "USD");
  ok(point.min === null && point.max === null && point.median === 1125, "a point stays a point — no Min/Max padded", point);
  const trades = libraryTrades(["plumbing", "not_a_trade", "electrical"]);
  ok(trades[0].key === "plumbing" && trades[1].key === "electrical" && trades[0].enabled && !trades[2].enabled, "enabled seeded trades first, unknown keys ignored", trades.slice(0, 3));
  ok(libraryTrades().length === trades.length && libraryTrades("x").length === trades.length, "no enabled list → every seeded trade");
  const products = [
    { id: "p1", seedKey: "fq.electrical.specialty.ev_charger", unitPrice: "890", unit: "each", name: "EV charger installation" },
    { id: "p2", name: "  soft-close hinges ", unitPrice: 35, unit: "door" },
  ];
  const lib = libraryForTrade("electrical", { products, currency: "CAD", language: "fr" });
  const ev = lib.services.find((s) => s.seedKey === "fq.electrical.specialty.ev_charger");
  ok(ev && ev.product?.id === "p1" && ev.product.unitPrice === 890 && ev.name.startsWith("Installation de borne"), "service row: the company's row by seed key, price as a number, name in the reader's language", ev);
  ok(lib.services.every((s) => s.product === null || s.product.id === "p1"), "no other service claims a product");
  ok(lib.services.some((s) => s.range && s.range.currency === "CAD"), "ranges in the company's currency");
  const cab = libraryForTrade("cabinet_refinishing", { products, currency: "CAD" });
  ok(cab === null, "a trade without a seed → null (the page shows only seeded trades)");
  ok(libraryForTrade("nope") === null && libraryForTrade("constructor") === null, "unknown trade → null, not Object's");
  const plumbing = libraryForTrade("plumbing", { products: "nope", currency: "CAD" });
  ok(plumbing.services.length > 0 && plumbing.services.every((s) => s.product === null), "hostile products → every row unmatched, nothing thrown");
  ok(positionInRange(150, { min: 200, median: 400, max: 1090 }) === "below" && positionInRange(200, { min: 200, median: 400, max: 1090 }) === "in" && positionInRange(1090, { min: 200, median: 400, max: 1090 }) === "in" && positionInRange(1091, { min: 200, median: 400, max: 1090 }) === "above", "position: edges are inside");
  ok(positionInRange(500, { min: null, median: 400, max: null }) === "above" && positionInRange(null, { min: 1, median: 2, max: 3 }) === null && positionInRange(5, null) === null && positionInRange(0, { min: 1, median: 2, max: 3 }) === null, "position: a point compares against itself; missing price or range → null");
}

section("G — the measurement registry, against the takeoffs that produce the keys");
{
  ok(MEASUREMENT_KEY_LIST.length >= 20 && MEASUREMENT_KEYS === MEASUREMENT_KEY_LIST, "templates.js re-exports the registry's key list", MEASUREMENT_KEY_LIST.length);
  ok(MEASUREMENT_KEY_LIST.every((k) => REGISTRY[k].label && REGISTRY[k].unit && REGISTRY[k].kind && REGISTRY[k].source), "every key carries label, unit, kind, source");
  ok(!isMeasurementKey("constructor") && !isMeasurementKey("stepFlashingFt") && !isMeasurementKey("wastePct") && !isMeasurementKey(null), "unregistered names are not keys (constructor, stepFlashingFt, wastePct)");
  // Paint: the geometry the takeoff derives for a 12 × 10 × 8 room.
  const room = derivedGeometry({ lengthFt: 12, widthFt: 10, heightFt: 8 });
  for (const k of ["wallSqft", "ceilingSqft", "floorSqft", "linearFt"]) ok(isMeasurementKey(k) && Number.isFinite(room[k]), `paint key "${k}" is produced by derivedGeometry`, room[k]);
  ok(measurementValue(room, "wallSqft") === 352 && measurementValue(room, "linearFt") === 44, "wallSqft 352 and linearFt 44 read off the geometry", room);
  // Stairs: the derivation for a 14-step straight flight.
  const stairs = stairsFromSteps({ steps: 14, shape: "straight" });
  for (const k of ["steps", "treads", "risers", "balusters", "posts", "handrailFt"]) ok(isMeasurementKey(k) && stairs && k in stairs, `stairs key "${k}" is produced by stairsFromSteps`, stairs?.[k]);
  ok(measurementValue(stairs, "balusters") === 28 && measurementValue(stairs, "treads") === 14, "balusters 28 and treads 14 read off the derivation", stairs);
  // Roofing: summariseRoof's shape, linear feet nested.
  const roof = { areaSqft: 2140, squares: 21.4, footprintSqft: 1620, linear: { eaveFt: 120, ridgeFt: 44, hipFt: 0, valleyFt: 18, rakeFt: 60, perimeterFt: 180 } };
  for (const k of ["squares", "areaSqft", "footprintSqft", "eaveFt", "rakeFt", "ridgeFt", "hipFt", "valleyFt", "perimeterFt"]) ok(isMeasurementKey(k) && measurementValue(roof, k) !== null, `roof key "${k}" reads off summariseRoof's shape`, measurementValue(roof, k));
  // Cabinets: the intake the instant estimate reads.
  for (const k of ["doorCount", "drawerCount", "boxLinearFt"]) ok(isMeasurementKey(k), `cabinet key "${k}" registered`);
  ok(measurementValue({ doorCount: "12" }, "doorCount") === 12 && measurementValue({ doorCount: "twelve" }, "doorCount") === null && measurementValue({ doorCount: true }, "doorCount") === null, "a numeric string reads, a word or a boolean does not");
  // Seed validation rejects; the sanitiser ignores.
  const bad = [{ kind: "material", name: "Shingles", measurementKey: "stepFlashingFt" }, { kind: "labour", name: "Tear-off", measurementKey: "squares", wastePct: 10 }, { kind: "material", name: "Cap", measurementKey: "ridgeFt", wastePct: 99 }];
  const problems = validateTemplateLines(bad);
  ok(problems.length === 3 && /stepFlashingFt/.test(problems[0]) && /material modifier/.test(problems[1]) && /outside/.test(problems[2]), "validateTemplateLines names the unknown key, waste on labour, and waste out of range", problems);
  ok(validateTemplateLines(null).length === 0 && validateTemplateLines("x").length === 1 && validateTemplateLines([{ kind: "material", name: "ok", measurementKey: "squares", wastePct: 10 }]).length === 0, "null is clean, a non-array is one problem, a good line is clean");
  const san = sanitiseTemplateLines(bad);
  ok(!("measurementKey" in san[0]) && san[1].measurementKey === "squares" && !("wastePct" in san[1]) && san[2].wastePct === 50, "sanitiser: unknown key dropped, labour waste dropped, material waste clamped", san);
  // Expansion: every trade's figure fills qty; missing → needsMeasurement.
  const product = { templateLines: [
    { kind: "labour", name: "Walls — two coats", qty: 1, unit: "sqft", unitPrice: 1.2, unitCost: 0.6, measurementKey: "wallSqft" },
    { kind: "material", name: "Balusters", qty: 1, unit: "each", unitPrice: 18, unitCost: 12, measurementKey: "balusters", wastePct: 10 },
    { kind: "labour", name: "Hinge fitting", qty: 1, unit: "each", unitPrice: 6.5, unitCost: 3, measurementKey: "doorCount", wastePct: 10 },
    { kind: "material", name: "Shingles", qty: 5, unit: "square", unitPrice: 120, unitCost: 90, measurementKey: "squares", wastePct: 10 },
  ] };
  const ex = expandTemplate(product, { measurements: { ...room, ...stairs, doorCount: 12 }, currency: "CAD" });
  ok(ex[0].quantity === 352 && ex[0].measured && !ex[0].needsMeasurement && ex[0].amount === 422.4, "painter: wall sq ft fills the qty", ex[0]);
  ok(ex[1].quantity === 30.8 && ex[1].measured, "stairs: 28 balusters × 1.10 waste on a material line", ex[1]);
  ok(ex[2].quantity === 12 && ex[2].wastePct === 0, "cabinets: 12 doors, waste ignored on a labour line", ex[2]);
  ok(ex[3].quantity === 5 && ex[3].needsMeasurement && !ex[3].measured && ex[3].warnings.includes("measurement:squares"), "no roof report: seed qty kept, needsMeasurement flagged", ex[3]);
  const none = expandTemplate(product, { currency: "CAD" });
  ok(none.every((l) => l.needsMeasurement) && none[1].quantity === 1, "no measurements at all: every measured line asks, seed qty kept", none.map((l) => l.quantity));
  const hostile = expandTemplate(product, { measurements: { wallSqft: "abc", balusters: -3, doorCount: Infinity, squares: null }, currency: "CAD" });
  ok(hostile.every((l) => l.needsMeasurement), "non-numeric, negative, infinite and null figures all ask rather than fill", hostile.map((l) => l.quantity));
  ok(JSON.stringify(CAPTURE) === JSON.stringify(JSON.parse(read("docs/research/hcp-estimate-templates-electrical.json"))), "the harness's JS copy of the capture equals the research JSON");
}

section("I — every calculator's keys are real output names; trades that reuse a takeoff; coverage");
{
  const roof = { areaSqft: 2140, squares: 21.4, footprintSqft: 1620, lowSlopeShare: 0, linear: { eaveFt: 120, ridgeFt: 44, hipFt: 0, valleyFt: 18, rakeFt: 60, perimeterFt: 180 } };
  const lab = roofLabour({ squares: 21.4, pitchRise: 6, footprintSqft: 1620 });
  for (const k of ["hours", "onRoofHours", "fixedHours"]) ok(isMeasurementKey(k) && Number.isFinite(lab?.[k]), `roofLabour produces "${k}"`, lab?.[k]);
  const g = deriveGutters(roof);
  for (const k of ["gutterFt", "downspouts"]) ok(isMeasurementKey(k) && Number.isFinite(g?.[k]), `deriveGutters produces "${k}"`, g?.[k]);
  const base = baseMaterials({ areaSqFt: 400 });
  for (const k of ["gravelCuYd", "sandCuYd"]) ok(isMeasurementKey(k) && base && k in base, `baseMaterials produces "${k}"`, base?.[k]);
  ok(isMeasurementKey(LOT_AREA_FIELD) && isMeasurementKey(LOT_EDGE_FIELD), "the lot takeoff's two intake fields are keys", [LOT_AREA_FIELD, LOT_EDGE_FIELD]);
  const house = { sqft: 1800, bedrooms: 3, baths: 2, codeJurisdiction: "NEC" };
  const op = estimateOpenings(house);
  for (const k of ["openings", "receptaclesPractical", "switches", "lighting", "smokeCo", "dedicated", "counterReceptacles", "exteriorReceptacles", "garageReceptacles"]) ok(isMeasurementKey(k) && op && k in op, `estimateOpenings produces "${k}"`, op?.[k]);
  const ci = estimateCircuits({ ...house, dedicated: op.dedicated, counterReceptacles: op.counterReceptacles });
  ok(isMeasurementKey("circuits") && Number.isFinite(ci?.circuits), "estimateCircuits produces \"circuits\"", ci?.circuits);
  const wi = estimateWire({ openings: op, circuits: ci, sqft: 1800 });
  ok(isMeasurementKey("totalFt") && Number.isFinite(wi?.totalFt), "estimateWire produces \"totalFt\"", wi?.totalFt);
  const lh = estimateLabourHours({ openings: op, circuits: ci, accessClass: "open_walls" });
  for (const k of ["roughInHours", "trimOutHours", "panelHours", "totalHours"]) ok(isMeasurementKey(k) && lh && k in lh, `estimateLabourHours produces "${k}"`, lh?.[k]);
  const tr = measureTracedArea([[45.4, -75.7], [45.4001, -75.7], [45.4001, -75.6999], [45.4, -75.6999]]);
  ok(tr.ok === false || (isMeasurementKey("areaSqft") && tr.measurement.areaSqft > 0), "measureTracedArea's figure is areaSqft", tr);
  for (const [trade, keys] of Object.entries(TRADE_MEASUREMENTS)) ok(keys.every(isMeasurementKey), `TRADE_MEASUREMENTS.${trade}: every key registered`, keys.filter((k) => !isMeasurementKey(k)));
  ok(JSON.stringify(TRADE_MEASUREMENTS.flooring) === JSON.stringify(["floorSqft", "linearFt"]) && TRADE_MEASUREMENTS.tiling.includes("wallSqft") && TRADE_MEASUREMENTS.drywall.includes("ceilingSqft") && TRADE_MEASUREMENTS.siding[0] === "wallSqft" && TRADE_MEASUREMENTS.fence_services[0] === "edgingFt" && TRADE_MEASUREMENTS.concrete[0] === "areaSqft", "flooring, tile, drywall, siding, fencing, concrete reuse the existing takeoffs");
  const fk = measurementKeysForTrade("flooring");
  ok(fk[0] === "floorSqft" && fk[1] === "linearFt" && fk.length === MEASUREMENT_KEY_LIST.length && new Set(fk).size === fk.length, "a trade's picker: its own figures first, then every key once", fk.slice(0, 3));
  ok(measurementKeysForTrade("constructor").length === MEASUREMENT_KEY_LIST.length, "unknown trade: every key, no crash");
  // Coverage: drywall sheets, fence posts, concrete yards, flooring waste.
  const room = derivedGeometry({ lengthFt: 12, widthFt: 10, heightFt: 8 });
  const cov = expandTemplate({ templateLines: [
    { kind: "material", name: "Drywall sheet 4×8", qty: 1, unit: "each", unitPrice: 18, unitCost: 13, measurementKey: "wallSqft", coverage: 32, wastePct: 10 },
    { kind: "material", name: "Fence post", qty: 1, unit: "each", unitPrice: 40, unitCost: 30, measurementKey: "edgingFt", coverage: 8 },
    { kind: "material", name: "Concrete — 4 in", qty: 1, unit: "each", unitPrice: 180, unitCost: 140, measurementKey: "areaSqft", coverage: 81 },
    { kind: "material", name: "Laminate", qty: 1, unit: "sqft", unitPrice: 3, unitCost: 2.2, measurementKey: "floorSqft", wastePct: 10 },
    { kind: "labour", name: "Baseboard", qty: 1, unit: "linear_ft", unitPrice: 4, unitCost: 2, measurementKey: "linearFt" },
  ] }, { measurements: { ...room, edgingFt: 160, areaSqft: 810 }, currency: "CAD" });
  ok(cov[0].quantity === 12.1 && cov[1].quantity === 20 && cov[2].quantity === 10, "coverage: 352 ÷ 32 × 1.10 = 12.1 sheets; 160 ÷ 8 = 20 posts; 810 ÷ 81 = 10 yd", cov.slice(0, 3).map((l) => l.quantity));
  ok(cov[3].quantity === 132 && cov[4].quantity === 44, "flooring: 120 sq ft × 1.10 waste; baseboard = the room perimeter linearFt 44", [cov[3].quantity, cov[4].quantity]);
  const bad = sanitiseTemplateLine({ kind: "material", name: "x", measurementKey: "wallSqft", coverage: -3 });
  ok(!("coverage" in bad) && !("coverage" in sanitiseTemplateLine({ kind: "material", name: "x", measurementKey: "wallSqft", coverage: 1 })) && !("coverage" in sanitiseTemplateLine({ kind: "material", name: "x", coverage: 32 })), "coverage: negative, 1, or without a key → not stored");
  ok(validateTemplateLines([{ kind: "material", name: "x", measurementKey: "wallSqft", coverage: 0 }, { kind: "material", name: "y", coverage: 32 }]).length === 2, "validate: zero coverage and coverage without a key are both problems");
}

section("H — where a template is offered: templatesFor and the seed's quote-type links");
{
  ok(JSON.stringify(ESTIMATE_TYPE_KEYS) === JSON.stringify(["interior", "exterior", "cabinets", "staining", "commercial"]), "estimate types are painting's five, by their exact keys", ESTIMATE_TYPE_KEYS);
  ok(JSON.stringify(sanitiseEstimateTypes(["cabinets", "bogus", "interior", "cabinets", 5, "constructor"])) === JSON.stringify(["interior", "cabinets"]), "sanitiseEstimateTypes: known keys only, deduplicated, registry order", sanitiseEstimateTypes(["cabinets", "bogus", "interior", "cabinets", 5, "constructor"]));
  ok(sanitiseEstimateTypes("interior").length === 0 && sanitiseEstimateTypes(null).length === 0, "non-array → []");
  const lines = [{ kind: "labour", name: "x", qty: 1, unit: "flat", unitPrice: 10, unitCost: 5 }];
  const cat = (key) => ({ id: `id_${key}`, key, label: key });
  const products = [
    { id: "a", name: "Cabinet doors — paint", templateLines: lines, categories: [cat("cabinet_refinishing"), cat("interior_painting")], estimateTypes: ["cabinets"] },
    { id: "b", name: "Walls — two coats", templateLines: lines, categories: [cat("interior_painting")], estimateTypes: [] },
    { id: "c", name: "Off", templateLines: lines, categories: [cat("interior_painting")], estimateTypes: [], templateEnabled: false },
    { id: "d", name: "No template", templateLines: null, categories: [cat("interior_painting")] },
    { id: "e", name: "Stairs — refinish", templateLines: lines, categories: [{ id: "id_stairs", label: "Stairs" }], estimateTypes: [] },
    { id: "f", name: "Exterior only", templateLines: lines, categories: [cat("interior_painting")], estimateTypes: ["exterior"] },
    null,
    "junk",
  ];
  const ids = (r) => r.map((p) => p.id).join(",");
  ok(ids(templatesFor({ products, categoryKey: "interior_painting", estimateType: "cabinets" })) === "a,b", "interior painting, cabinets estimate: the cabinets-only row and the any-type row; not the exterior-only, the switched-off, the untemplated", ids(templatesFor({ products, categoryKey: "interior_painting", estimateType: "cabinets" })));
  ok(ids(templatesFor({ products, categoryKey: "interior_painting", estimateType: "interior" })) === "b", "interior estimate: only the any-type row");
  ok(ids(templatesFor({ products, categoryKey: "interior_painting" })) === "b", "no estimate type given: rows that name one are not offered, the any-type row is");
  ok(ids(templatesFor({ products, categoryKey: "cabinet_refinishing", estimateType: "cabinets" })) === "a", "cabinet refinishing: the row linked to that quote type");
  ok(ids(templatesFor({ products, categoryId: "id_stairs" })) === "e", "a row whose category carries an id but no key is found by categoryId");
  ok(templatesFor({ products, categoryKey: "roofing_service" }).length === 0 && templatesFor({ products }).length === 0 && templatesFor({ products: "x", categoryKey: "interior_painting" }).length === 0 && templatesFor().length === 0, "unlinked type, no type, hostile products → []");
  ok(JSON.stringify(seedCategoryKeys({ categories: ["stairs", "cabinet_refinishing", "stairs", 7, "Bad Key", "interior_painting"] }, "interior_painting")) === JSON.stringify(["stairs", "cabinet_refinishing"]), "seedCategoryKeys: strings only, deduplicated, the seeding trade excluded", seedCategoryKeys({ categories: ["stairs", "cabinet_refinishing", "stairs", 7, "Bad Key", "interior_painting"] }, "interior_painting"));
  ok(seedCategoryKeys({}).length === 0 && seedCategoryKeys(null).length === 0, "no categories → []");
  const row = { seedKey: "fq.interior_painting.core.x", category: "core", unit: "flat", benchmark: null, name: { en: "X", fr: "X fr", es: "X es" }, description: { en: "d", fr: "d", es: "d" }, templateLines: lines, categories: ["cabinet_refinishing", "stairs", "unknown_type"], estimateTypes: ["cabinets", "nope"] };
  const data = productDataForSeed(row, { companyId: "c", categoryId: "id_ip", language: "en", currency: "CAD", categoryIdsByKey: { cabinet_refinishing: "id_cr", stairs: "id_st" } });
  ok(JSON.stringify(data.categories.connect) === JSON.stringify([{ id: "id_ip" }, { id: "id_cr" }, { id: "id_st" }]), "the seeder links the seeding trade plus every resolved key; the unknown key links nothing", data.categories);
  ok(JSON.stringify(data.estimateTypes) === JSON.stringify(["cabinets"]), "estimateTypes copied, unknown key dropped", data.estimateTypes);
  const none = productDataForSeed({ ...row, categories: undefined, estimateTypes: undefined }, { companyId: "c", categoryId: "id_ip", language: "en", currency: "CAD" });
  ok(JSON.stringify(none.categories.connect) === JSON.stringify({ id: "id_ip" }) && !("estimateTypes" in none), "no keys: the single connect the seeder always wrote, no estimateTypes key", none.categories);
  const same = productDataForSeed({ ...row, categories: ["interior_painting"] }, { companyId: "c", categoryId: "id_ip", language: "en", currency: "CAD", categoryIdsByKey: { interior_painting: "id_ip" } });
  ok(JSON.stringify(same.categories.connect) === JSON.stringify({ id: "id_ip" }), "a key resolving to the seeding category is not connected twice");
}

console.log(`\n${passed} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
