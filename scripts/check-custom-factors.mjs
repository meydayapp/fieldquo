// scripts/check-custom-factors.mjs
//
// The estimator's own complexity factors (lib/pricing/customFactors.js),
// executed rather than read.
//
//   1. Nothing moved. Every fixture group and request that uses NO custom
//      factor hashes exactly as it did on origin/main at 853639c9, before
//      this existed — the md5s below were recorded there, not here.
//   2. The arithmetic: %, fixed, hours, and the documented order — built-in
//      complexity inside the base, then custom %, then custom fixed/hours.
//   3. Hostile input: negative, zero, huge, NaN, strings, junk objects.
//   4. Removal puts the payload back to the byte.
//   5. The round trip: saved as lines, reopened as factors, saved again —
//      the same lines to the cent (the fixed point a persisted group needs).
//   6. The costing side counts the hours a factor sold, on both sides.
//   7. The library row's gate, and the hours rate's gate.
//   8. The words exist in all nine app languages, and the screens use them.
//
// Run: npm run check:custom-factors

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  scopeGroupPayload,
  groupSubtotal,
  groupBaseSubtotal,
  lineItemsFromStored,
} from "@/lib/quotes/builderPayload";
import { quoteRequestBody } from "@/lib/quotes/builderRequest";
import {
  CUSTOM_FACTOR_LIMITS,
  MAX_CUSTOM_FACTORS,
  customFactorHoursOf,
  customFactorLines,
  customFactorProblem,
  factorFromPreset,
  hourlyRateForFactors,
  normalisePresetInput,
  presentPreset,
  priceCustomFactors,
  splitCustomFactorLines,
} from "@/lib/pricing/customFactors";
import { getPriceBook, defaultTradeRate } from "@/app/data/tradePriceBooks";
import { APP_MESSAGES } from "@/app/i18n/appMessages.js";
import { fixtureGroups, fixtureRequests } from "./fixtures/builderPayloadFixtures.mjs";

let fail = 0;
let pass = 0;
const ok = (name, cond, detail = "") => {
  if (cond) pass += 1;
  else fail += 1;
  console.log(`${cond ? "  ok  " : "  FAIL"} ${name}${cond ? "" : `  ${detail}`}`);
};
const eq = (name, got, want) =>
  ok(name, JSON.stringify(got) === JSON.stringify(want), `got=${JSON.stringify(got)} want=${JSON.stringify(want)}`);
const section = (s) => console.log(`\n${s}\n`);
const md5 = (o) => createHash("md5").update(JSON.stringify(o)).digest("hex");
const read = (p) => readFileSync(p, "utf8");

// ───────────────────────────────────────────────────────────────────────────
section("1. Nothing moved — md5s recorded on origin/main 853639c9, before custom factors");
// ───────────────────────────────────────────────────────────────────────────

const BASELINE = {
  "group:cab:en": "196e0b2e79ff5f71bf0ee3cdf37cff93",
  "group:cab:fr": "449918758dbceda6b5a0e9a79d30c983",
  "subtotal:cab": 5990,
  "group:stairs:en": "6e295eafccd377b64213be3dac363ac3",
  "group:stairs:fr": "3947a16dd184cd472793db1a3f64ae9e",
  "subtotal:stairs": 2510,
  "group:plumbing:en": "173492c9e10602f6e9e91ecec3bb1ce7",
  "group:plumbing:fr": "173492c9e10602f6e9e91ecec3bb1ce7",
  "subtotal:plumbing": 370,
  "group:custom:en": "b86bffb57bc45c63f65a920d49a6125c",
  "group:custom:fr": "b86bffb57bc45c63f65a920d49a6125c",
  "subtotal:custom": 240,
  "group:persisted:en": "59c0d5e78d3e2af17069d06258b0babc",
  "group:persisted:fr": "59c0d5e78d3e2af17069d06258b0babc",
  "subtotal:persisted": 2250.37,
  "request:create": "9f94d62e8ed3bd6e63ca50ddea494ef8",
  "request:edit": "c0d0d529d17ca87588fe86bd12829b09",
  "request:decided": "5a03bda4995ae15e5726ec9652d312be",
};

function hashAll(groups) {
  const out = {};
  const payloads = [];
  for (const [k, grp] of Object.entries(groups)) {
    for (const lang of ["en", "fr"]) {
      const p = scopeGroupPayload(grp, null, lang);
      out[`group:${k}:${lang}`] = md5(p);
      if (lang === "en") payloads.push(p);
    }
    out[`subtotal:${k}`] = groupSubtotal(grp, null);
  }
  for (const [k, s] of Object.entries(fixtureRequests(payloads))) out[`request:${k}`] = md5(quoteRequestBody(s));
  return out;
}

const now = hashAll(fixtureGroups());
for (const [k, v] of Object.entries(BASELINE)) eq(`${k} unchanged`, now[k], v);

// An EMPTY factor list is the same statement as none at all.
const emptied = fixtureGroups();
for (const g of Object.values(emptied)) g.customFactors = [];
const nowEmpty = hashAll(emptied);
for (const [k, v] of Object.entries(BASELINE)) eq(`${k} unchanged with customFactors: []`, nowEmpty[k], v);

// ───────────────────────────────────────────────────────────────────────────
section("2. The arithmetic, and the order it composes in");
// ───────────────────────────────────────────────────────────────────────────

const P = (id, label, value) => ({ id, label, mode: "percent", value });
const F = (id, label, value) => ({ id, label, mode: "fixed", value });
const H = (id, label, value, rate) => ({ id, label, mode: "hours", value, rate });

{
  const r = priceCustomFactors({ base: 1000, factors: [P("a", "Tight access", 15)] });
  eq("15% of 1000 is 150", r.total, 150);
  const f = priceCustomFactors({ base: 1000, factors: [F("b", "Crane", 250)] });
  eq("fixed 250 is 250", f.total, 250);
  const h = priceCustomFactors({ base: 1000, factors: [H("c", "Crated dog", 1.5, 85)] });
  eq("1.5 h at 85 is 127.50", h.total, 127.5);
  eq("…and reports 1.5 hours", h.hours, 1.5);
}

{
  // Percentages are of the SAME base, not compounded — so order is irrelevant.
  const factors = [P("a", "Access", 10), F("b", "Crane", 200), P("c", "Deadline", 5), H("d", "Dog", 2, 90)];
  const forward = priceCustomFactors({ base: 2000, factors });
  const reversed = priceCustomFactors({ base: 2000, factors: [...factors].reverse() });
  const shuffled = priceCustomFactors({ base: 2000, factors: [factors[2], factors[0], factors[3], factors[1]] });
  eq("10% + 5% of 2000 = 300 (not 10% then 5% of 2200)", forward.percentTotal, 300);
  eq("fixed total", forward.fixedTotal, 200);
  eq("hours total 2 × 90", forward.hoursTotal, 180);
  eq("grand total 680", forward.total, 680);
  eq("reversed order, same total", reversed.total, forward.total);
  eq("shuffled order, same total", shuffled.total, forward.total);
  ok("a percentage never applies to a fixed amount", forward.percentTotal === 300 && forward.total - forward.percentTotal === 380);
}

{
  // Cents: each percentage rounded on its own, then summed.
  const r = priceCustomFactors({ base: 1840.37, factors: [P("a", "A", 7.5), P("b", "B", 7.5)] });
  eq("7.5% of 1840.37 rounds to 138.03, twice", r.percentTotal, 276.06);
}

{
  // Built-in complexity is INSIDE the base: the stair group's own lines were
  // priced by its factor model (L-shape, one open side, tight access).
  const { stairs } = fixtureGroups();
  const base = groupBaseSubtotal(stairs, null);
  eq("stairs base is its built-in-complexity price", base, BASELINE["subtotal:stairs"]);
  const withF = { ...stairs, customFactors: [P("s1", "Third-floor carry", 10), F("s2", "Dust barrier", 150)] };
  eq("stairs + 10% + 150", groupSubtotal(withF, null), Math.round((base * 1.1 + 150) * 100) / 100);
  const payload = scopeGroupPayload(withF, null, "en");
  const last2 = payload.lineItems.slice(-2);
  eq("the factor lines come LAST, after every stair line", last2.map((l) => l.description), ["Third-floor carry", "Dust barrier"]);
  eq("payload subtotal = sum of its lines", payload.subtotal, Math.round(payload.lineItems.reduce((s, l) => s + l.amount, 0) * 100) / 100);
  const stairLines = scopeGroupPayload(stairs, null, "en").lineItems;
  eq("the stair lines themselves are untouched", payload.lineItems.slice(0, -2), stairLines);
}

{
  // Cabinets: the chip (Moderate) is inside the per-door rate; a factor adds on top.
  const { cab } = fixtureGroups();
  const withF = { ...cab, customFactors: [P("k1", "Island with corbels", 12)] };
  eq("cabinet + 12%", groupSubtotal(withF, null), Math.round((5990 * 1.12) * 100) / 100);
  const line = scopeGroupPayload(withF, null, "fr").lineItems.at(-1);
  eq("the client reads the label exactly as typed — no translation", line.description, "Island with corbels");
  eq("…with its amount, quantity 1", [line.quantity, line.amount], [1, 718.8]);
  ok("…and the percentage stays in meta, never in the words", !/12|%/.test(line.description) && line.meta.customFactor.value === 12);
}

{
  // Any trade: a custom quote type with no factor list and no price book.
  const { custom } = fixtureGroups();
  const withF = { ...custom, customFactors: [F("x", "Oil stain pre-treatment", 60)] };
  eq("custom quote type + fixed 60", groupSubtotal(withF, null), 300);
}

// ───────────────────────────────────────────────────────────────────────────
section("3. Hostile input prices nothing and writes nothing");
// ───────────────────────────────────────────────────────────────────────────

const HOSTILE = [
  ["negative percent", P("n", "Discount in disguise", -10), "value"],
  ["negative fixed", F("n", "Credit", -500), "value"],
  ["zero percent", P("z", "Nothing", 0), "value"],
  ["zero fixed", F("z", "Nothing", 0), "value"],
  ["empty string value", F("e", "Blank", ""), "value"],
  ["NaN", F("e", "NaN", NaN), "value"],
  ["Infinity", F("e", "Inf", Infinity), "value"],
  ["numeric string is a number", F("s", "String", "250"), null],
  ["huge percent", P("h", "Huge", CUSTOM_FACTOR_LIMITS.percent + 1), "tooLarge"],
  ["huge fixed", F("h", "Huge", 1e12), "tooLarge"],
  ["huge hours", H("h", "Huge", 1e6, 80), "tooLarge"],
  ["hours with no rate", H("h", "No rate", 2, null), "rate"],
  ["hours with a negative rate", H("h", "Neg rate", 2, -80), "rate"],
  ["no label", F("l", "   ", 100), "label"],
  ["label too long", F("l", "x".repeat(CUSTOM_FACTOR_LIMITS.label + 1), 100), "labelTooLong"],
  ["unknown mode", { id: "m", label: "Weird", mode: "multiply", value: 2 }, "mode"],
  ["null", null, "invalid"],
  ["a string", "15%", "invalid"],
];
for (const [name, factor, want] of HOSTILE) {
  eq(`${name}: problem is ${want}`, customFactorProblem(factor), want);
}

{
  const { plumbing } = fixtureGroups();
  const junk = HOSTILE.filter(([, , w]) => w).map(([, f]) => f);
  const g = { ...plumbing, customFactors: junk };
  eq("a group of nothing but junk factors prices at its base", groupSubtotal(g, null), BASELINE["subtotal:plumbing"]);
  eq("…and writes no factor line", scopeGroupPayload(g, null, "en").lineItems.filter((l) => l.meta?.customFactor).length, 0);
}

{
  // A percentage of nothing is nothing — and is not written as a $0 line.
  const zeroBase = { tempId: "zb", id: "zb", persisted: true, categoryId: "c", label: "Specialty", lineItems: [{ description: "On-site assessment required", quantity: 1, unit: "flat", rate: 0, amount: 0, kind: "text", priceMode: "none" }], customFactors: [P("p", "Tight access", 20)] };
  eq("% of a zero base is flagged noBase", priceCustomFactors({ base: 0, factors: zeroBase.customFactors }).rows[0].problem, "noBase");
  eq("…and no $0 reason line is written", scopeGroupPayload(zeroBase, null, "en").lineItems.length, 1);
}

{
  // More than the maximum: the extras are ignored, never priced.
  const many = Array.from({ length: MAX_CUSTOM_FACTORS + 3 }, (_, i) => F(`m${i}`, `F${i}`, 10));
  eq(`only the first ${MAX_CUSTOM_FACTORS} factors price`, priceCustomFactors({ base: 100, factors: many }).total, MAX_CUSTOM_FACTORS * 10);
}

// ───────────────────────────────────────────────────────────────────────────
section("4. Removal puts the bytes back");
// ───────────────────────────────────────────────────────────────────────────

{
  const groups = fixtureGroups();
  for (const [k, g] of Object.entries(groups)) {
    const added = { ...g, customFactors: [P("r1", "Access", 10), H("r2", "Extra", 1, 95)] };
    ok(`${k}: adding a factor changes the payload`, md5(scopeGroupPayload(added, null, "en")) !== BASELINE[`group:${k}:en`] || groupBaseSubtotal(g, null) === 0);
    // What updateCustomFactors does on removing the last one: the key goes.
    const { customFactors, ...removed } = added;
    eq(`${k}: removing it restores the baseline md5`, md5(scopeGroupPayload(removed, null, "en")), BASELINE[`group:${k}:en`]);
    eq(`${k}: …and the baseline subtotal`, groupSubtotal(removed, null), BASELINE[`subtotal:${k}`]);
  }
  const qb = read("app/components/quotes/builder/QuoteBuilder.js");
  ok(
    "the builder drops the key (not []) when the last factor goes",
    /if \(!Array\.isArray\(next\) \|\| next\.length === 0\) \{\s*const \{ customFactors, \.\.\.rest \} = g;\s*return rest;/.test(qb),
  );
}

// ───────────────────────────────────────────────────────────────────────────
section("5. Saved as lines, reopened as factors, saved again — a fixed point");
// ───────────────────────────────────────────────────────────────────────────

/** What QuoteBuilder's groupFromStored does with a stored group's lines. */
function reopen(stored) {
  const { lines, factors } = splitCustomFactorLines(lineItemsFromStored(stored.lineItems));
  return {
    tempId: stored.id,
    id: stored.id,
    persisted: true,
    categoryId: stored.categoryId,
    label: stored.label,
    intakeValues: stored.intakeValues || {},
    takeoff: stored.takeoff ?? null,
    lineItems: lines,
    ...(factors.length ? { customFactors: factors } : {}),
  };
}

{
  const groups = fixtureGroups();
  for (const [k, g] of Object.entries(groups)) {
    const withF = { ...g, customFactors: [P("a", "Tight access — 3rd floor walk-up", 15), F("b", "Crane rental", 325.5), H("c", "Crated dog", 1.5, 85)] };
    const first = scopeGroupPayload(withF, null, "en");
    const stored = { ...first, id: first.id || `stored-${k}` };
    const again = scopeGroupPayload(reopen(stored), null, "en");
    eq(`${k}: re-saving an untouched quote writes the same lines`, again.lineItems, first.lineItems);
    eq(`${k}: …and the same subtotal`, again.subtotal, first.subtotal);
    const third = scopeGroupPayload(reopen({ ...again, id: stored.id }), null, "en");
    eq(`${k}: …a third time too`, third.lineItems, first.lineItems);
  }
  const qb = read("app/components/quotes/builder/QuoteBuilder.js");
  ok("groupFromStored splits factor lines back into factors", /splitCustomFactorLines\(lineItemsFromStored\(g\.lineItems\)\)/.test(qb));
}

{
  // A line claiming to be a factor with a mode nobody knows stays a LINE —
  // dropping it would take money off a saved quote.
  const { lines, factors } = splitCustomFactorLines([
    { description: "Odd", quantity: 1, unit: "flat", rate: 99, amount: 99, meta: { customFactor: { mode: "teleport", value: 3 } } },
    { description: "Plain", quantity: 1, unit: "flat", rate: 10, amount: 10 },
  ]);
  eq("an unreadable factor line is kept as a line", [lines.length, factors.length], [2, 0]);
  eq("junk lineItems split to nothing", splitCustomFactorLines("nope"), { lines: [], factors: [] });
}

{
  // Invoices are built from the quote's stored lines, verbatim.
  const inv = read("lib/invoices/createInvoiceFromQuote.js");
  ok("the invoice copies each stored line whole (…li), so the factor line is carried", /items\.map\(\(li\) => \(\{\s*\.\.\.li,/.test(inv));
}

// ───────────────────────────────────────────────────────────────────────────
section("6. Hours sold are hours worked — both sides of the costing count them");
// ───────────────────────────────────────────────────────────────────────────

{
  const { plumbing, stairs } = fixtureGroups();
  const a = scopeGroupPayload({ ...plumbing, customFactors: [H("h1", "Crawlspace", 2.5, 95), P("p1", "Rush", 10)] }, null, "en");
  const b = scopeGroupPayload({ ...stairs, customFactors: [H("h2", "Carry", 1, 85)] }, null, "en");
  eq("customFactorHoursOf reads the hours off the stored lines", customFactorHoursOf([a, b]), 3.5);
  eq("…ignores percentage and fixed factors", customFactorHoursOf([scopeGroupPayload({ ...plumbing, customFactors: [P("p", "Rush", 10)] }, null, "en")]), 0);
  eq("…and junk", customFactorHoursOf([{ lineItems: [{ meta: { customFactor: { mode: "hours", value: 1e9 } } }, null, 5] }, null, "x"]), 0);
  const costing = read("app/api/quotes/costingWrite.js");
  ok("the saved cost row adds them to the labour pool", /addedLabourHours: clean\.addedLabourHours \+ customFactorHoursOf\(scopeGroups\)/.test(costing));
  ok("…but stores only the typed hours as the input", /addedLabourHours: clean\.addedLabourHours,/.test(costing));
  ok("the recompute fallback counts them too", /addedLabourHours: customFactorHoursOf\(quote\.scopeGroups\)/.test(read("lib/costing/quoteCostEstimate.js")));
  ok("the builder's panel counts the same hours", /manualLabourHours: takeoffLabourHours \+ num\(manualLabourHours\) \+ customFactorHours/.test(read("app/components/quotes/builder/QuoteBuilder.js")));
  ok("the cost panel lists the factors", /customFactors\.map\(/.test(read("app/components/quotes/builder/CostMarginPanel.js")));
}

// ───────────────────────────────────────────────────────────────────────────
section("7. The hourly rate, and the library row");
// ───────────────────────────────────────────────────────────────────────────

{
  eq("painting sells hours at its book's hourlySellRate", hourlyRateForFactors({ book: { hourlySellRate: 85 }, category: { unit: "sqft", defaultRate: 3 } }), 85);
  eq("plumbing sells hours at its own rate", hourlyRateForFactors({ book: getPriceBook("plumbing", null), category: { unit: "hour", defaultRate: 110 } }), 110);
  eq("…or at the catalogue's opening rate when none was typed", hourlyRateForFactors({ category: { unit: "hour", defaultRate: null }, fallbackUnitRate: defaultTradeRate("plumbing") }), 95);
  eq("flooring's per-sq-ft rate is NOT an hourly rate", hourlyRateForFactors({ category: { unit: "sqft", defaultRate: 6 } }), null);
  eq("no unit, no hours", hourlyRateForFactors({ category: { unit: null, defaultRate: 500 } }), null);
  eq("junk", hourlyRateForFactors({ book: { hourlySellRate: "abc" }, category: { unit: "hour", defaultRate: -4 } }), null);

  eq("an hours preset on a service not sold by the hour cannot be applied", factorFromPreset({ id: "p", label: "Dog", mode: "hours", value: 1 }, { hourlyRate: null }), null);
  eq("…and on one that is, takes THAT service's rate", factorFromPreset({ id: "p", label: " Dog ", mode: "hours", value: 1.5 }, { id: "f", hourlyRate: 95 }), { id: "f", label: "Dog", mode: "hours", value: 1.5, rate: 95, presetId: "p" });
  eq("a percent preset copies across", factorFromPreset({ id: "q", label: "Access", mode: "percent", value: 15 }, { id: "g" }).value, 15);
  eq("junk preset", factorFromPreset({ mode: "nope" }), null);

  eq("preset input: no label", normalisePresetInput({ mode: "fixed", value: 10 }).error, "Give the factor a label.");
  ok("preset input: negative refused", Boolean(normalisePresetInput({ label: "x", mode: "fixed", value: -1 }).error));
  ok("preset input: huge refused", Boolean(normalisePresetInput({ label: "x", mode: "percent", value: 1e6 }).error));
  ok("preset input: unknown mode refused", Boolean(normalisePresetInput({ label: "x", mode: "x", value: 1 }).error));
  eq("preset input: a good row", normalisePresetInput({ label: "  Tight access ", mode: "percent", value: "15", language: "FR" }, { languages: ["en", "fr"] }).data, { label: "Tight access", mode: "percent", value: 15, language: "fr" });
  eq("preset input: an unsupported language is left to the route's default", normalisePresetInput({ label: "x", mode: "fixed", value: 5, language: "xx" }, { languages: ["en"] }).data.language, undefined);
  eq("a member without showPricing gets no value", presentPreset({ id: "a", label: "L", mode: "fixed", value: 10, language: "en" }, { showPricing: false }).value, undefined);

  const route = read("app/api/complexity-factors/route.js");
  ok("GET is scoped to the company and skips archived rows", /where: \{ companyId: member\.companyId, archivedAt: null \}/.test(route));
  ok("POST needs quotes:view_create_edit", /levelOrRefusal\(member, "quotes", "view_create_edit"/.test(route));
  ok("POST refuses a member who may not see prices", /if \(!hasToggle\(full, "showPricing"\)\)/.test(route));
  const del = read("app/api/complexity-factors/[id]/route.js");
  ok("DELETE archives — the row is kept", /archivedAt: new Date\(\)/.test(del) && !/\.delete\(/.test(del));
  ok("DELETE is scoped to the company", /companyId: member\.companyId/.test(del));
  const schema = read("prisma/schema.prisma");
  ok("the schema declares the library model", /model ComplexityFactorPreset \{/.test(schema));
}

// ───────────────────────────────────────────────────────────────────────────
section("8. Nine languages, and the screens that use them");
// ───────────────────────────────────────────────────────────────────────────

{
  const files = [
    "app/components/pricing/CustomFactorsEditor.js",
    "app/app/settings/services/CustomFactorLibraryCard.js",
    "app/components/quotes/builder/CostMarginPanel.js",
  ];
  const used = new Set();
  for (const f of files) for (const m of read(f).matchAll(/"(app\.customFactors\.[A-Za-z.]+)"/g)) used.add(m[1]);
  ok(`the screens use ${used.size} keys`, used.size >= 35, [...used].join(", "));
  const langs = ["en", "fr", "es", "uk", "pa", "tl", "de", "zh", "it"];
  for (const lang of langs) {
    const missing = [...used].filter((k) => typeof APP_MESSAGES[lang]?.[k] !== "string" || !APP_MESSAGES[lang][k].trim());
    eq(`${lang}: every key present`, missing, []);
    // Placeholders survive translation.
    const broken = [...used].filter((k) => {
      const want = (APP_MESSAGES.en[k].match(/\{\w+\}/g) || []).sort().join();
      const got = (String(APP_MESSAGES[lang]?.[k] || "").match(/\{\w+\}/g) || []).sort().join();
      return want !== got;
    });
    eq(`${lang}: placeholders intact`, broken, []);
  }
  const qb = read("app/components/quotes/builder/QuoteBuilder.js");
  ok("the editor is mounted in the shared group editor (both layouts)", /<CustomFactorsEditor[\s\S]*?onChange=\{\(next\) => updateCustomFactors\(group\.tempId, next\)\}/.test(qb));
  ok("…on every trade — not gated on a factor list", !/complexityFor\([^)]*\)\s*&&\s*\(\s*<CustomFactorsEditor/.test(qb));
  ok("the settings card is mounted beside the text-block library", /<CustomFactorLibraryCard canEdit=\{canEditLibrary\} \/>/.test(read("app/app/settings/services/ServicesEditor.js")));
}

console.log(`\n${fail ? "✗" : "✓"} custom factors: ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
