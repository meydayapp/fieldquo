// scripts/check-instant-scope.mjs
//
//   npm run check:instant-scope
//   node --import ./scripts/alias-loader.mjs --import ./scripts/db-stub-loader.mjs scripts/check-instant-scope.mjs
//
// Two owner items, executed rather than read:
//
//   8. Painting's interior/exterior is decided by the SERVICES the company
//      sells. Both → the form asks; one → the server fixes the scope and the
//      form doesn't ask; neither → painting is not offered publicly.
//
//   9. The instant seed inherits Services & Pricing. Painting derives its base
//      rate and surcharges from the company's interior/exterior price books;
//      cabinet refinishing from its own; a saved row that has drifted from
//      that derivation gets a notice and ONE button, never a silent rewrite.
//
// The public payload is built by the real loadCompanyInstantTrades over the
// db stub, then serialised and searched for anything rate-shaped — the
// cheapest proof that "scopes" crossed and "scopeSurcharge" did not.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  applyDerivedSeed,
  applyOfferedScope,
  defaultDerivedSeed,
  deriveInstantSeed,
  paintingScopesOffered,
  resolvePaintingScope,
  seedDrift,
  seedFields,
  seedInputsFor,
  DERIVED_SEED_TRADES,
} from "@/lib/estimate/instantSeed";
import {
  INSTANT_ESTIMATE_DEFAULTS,
  computeInstantEstimate,
} from "@/lib/estimate/instantEstimate";
import {
  loadCompanyInstantTrades,
  priceAllMaterials,
  priceOneMaterial,
} from "@/lib/estimate/instantQuoteServer";
import { TRADE_PRICE_BOOKS, getPriceBook } from "@/app/data/tradePriceBooks";
import { APP_MESSAGES } from "@/app/i18n/appMessages";
import { rows, resetDbStub } from "@/lib/db";

const ROOT = join(import.meta.dirname, "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

let pass = 0;
let fail = 0;
const ok = (name, cond, got) => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`);
  }
};
const near = (a, b) => Math.abs(Number(a) - Number(b)) < 1e-9;

// ── 1. Derivation against a fixture price book ──────────────────────────────
console.log("\nPainting seed derives from the company's own books");
{
  // A company that patched its interior walls to 3.00 / 3.60 / 4.50 and its
  // exterior siding to 3.60 — the sparse `rates` patch Settings › Services
  // & Pricing stores, over the code book.
  const enabledRows = [
    {
      key: "interior_painting",
      rates: {
        complexity: {
          standard: { wallPricePerSqft: 3 },
          moderate: { wallPricePerSqft: 3.6 },
          high: { wallPricePerSqft: 4.5 },
        },
      },
    },
    { key: "exterior_painting", rates: { complexity: { standard: { siding: 3.6 } } } },
  ];
  const inputs = seedInputsFor("painting", enabledRows);
  ok("both scopes read as offered", inputs.offered.join(",") === "interior,exterior", inputs.offered);
  const d = deriveInstantSeed("painting", inputs);
  ok("base rate is the company's standard-tier wall rate", d?.materials?.[0]?.ratePerSqft === 3, d);
  ok("one grade only — the book has no paint grade to derive a second from", d.materials.length === 1 && d.materials[0].key === "standard", d.materials);
  ok("exterior surcharge is siding over walls (3.60 / 3.00 − 1 = 20%)", near(d.scopeSurcharge.exterior, 0.2), d.scopeSurcharge);
  ok("interior surcharge is 0 by definition", d.scopeSurcharge.interior === 0);
  ok("fair condition is the moderate tier over standard (20%)", near(d.conditionSurcharge.fair, 0.2), d.conditionSurcharge);
  ok("poor condition is the high tier over standard (50%)", near(d.conditionSurcharge.poor, 0.5), d.conditionSurcharge);
  ok("nothing the book cannot state is invented (no minCharge, no rangeBandPct)", !("minCharge" in d) && !("rangeBandPct" in d), Object.keys(d));

  // Exterior only: the base IS the siding rate, and the exterior surcharge is
  // 0 — otherwise the one scope they sell would be priced 20% over their book.
  const extOnly = deriveInstantSeed("painting", seedInputsFor("painting", [enabledRows[1]]));
  ok("exterior-only: base rate is the siding rate", extOnly?.materials?.[0]?.ratePerSqft === 3.6, extOnly);
  ok("exterior-only: exterior surcharge is 0, not stacked on itself", extOnly.scopeSurcharge.exterior === 0, extOnly.scopeSurcharge);
  ok("exterior-only: condition tiers come from the siding tiers", near(extOnly.conditionSurcharge.fair, 4 / 3.6 - 1 > 0 ? Math.round((4 / 3.6 - 1) * 100) / 100 : 0), extOnly.conditionSurcharge);

  // A cheaper upper tier is 0%, never negative — clampPct could not store it.
  const inverted = deriveInstantSeed("painting", seedInputsFor("painting", [
    { key: "interior_painting", rates: { complexity: { standard: { wallPricePerSqft: 5 } } } },
  ]));
  ok("a tier cheaper than standard derives as 0%, not a negative", inverted.conditionSurcharge.fair === 0 && inverted.conditionSurcharge.poor === 0, inverted.conditionSurcharge);

  ok("no painting service enabled → nothing to derive", deriveInstantSeed("painting", seedInputsFor("painting", [])) === null);
  ok("a zeroed wall rate is 'no rate', not a free base", deriveInstantSeed("painting", seedInputsFor("painting", [
    { key: "interior_painting", rates: { complexity: { standard: { wallPricePerSqft: 0 } } } },
  ])) === null);
  ok("a trade with no derivation → null", deriveInstantSeed("roofing", {}) === null);

  // The literal seed IS the derivation over the code books.
  const base = defaultDerivedSeed("painting");
  const book = TRADE_PRICE_BOOKS.interior_painting.complexity;
  ok("INSTANT_ESTIMATE_DEFAULTS.painting carries the derived materials",
    JSON.stringify(INSTANT_ESTIMATE_DEFAULTS.painting.materials) === JSON.stringify(base.materials)
      && base.materials[0].ratePerSqft === book.standard.wallPricePerSqft);
  ok("...and the derived surcharges", JSON.stringify(INSTANT_ESTIMATE_DEFAULTS.painting.scopeSurcharge) === JSON.stringify(base.scopeSurcharge)
    && JSON.stringify(INSTANT_ESTIMATE_DEFAULTS.painting.conditionSurcharge) === JSON.stringify(base.conditionSurcharge));
  ok("...plus the two instant-only literals", INSTANT_ESTIMATE_DEFAULTS.painting.rangeBandPct === 0.15 && INSTANT_ESTIMATE_DEFAULTS.painting.minCharge === 400);
  ok("both scope keys survive in the seed (the funnel reads them as options)", Object.keys(INSTANT_ESTIMATE_DEFAULTS.painting.scopeSurcharge).join(",") === "interior,exterior");

  // And the derived numbers are the numbers a homeowner is quoted.
  const cfg = { ...INSTANT_ESTIMATE_DEFAULTS.painting, ...d, enabled: true };
  const int = computeInstantEstimate({ trade: "painting", measurements: { areaSqft: 1000, scope: "interior", surfaceCondition: "good" }, materialKey: "standard", config: cfg });
  const ext = computeInstantEstimate({ trade: "painting", measurements: { areaSqft: 1000, scope: "exterior", surfaceCondition: "good" }, materialKey: "standard", config: cfg });
  ok("1000 sqft interior prices at the company's wall rate", int.ok && near(int.point, 3000), int.point);
  ok("1000 sqft exterior prices at the company's siding rate", ext.ok && near(ext.point, 3600), ext.point);
}

console.log("\nCabinet refinishing derives from the company's own book too");
{
  const d = deriveInstantSeed("cabinet_refinishing", seedInputsFor("cabinet_refinishing", [
    { key: "cabinet_refinishing", rates: { perDoor: 175, minimumTotal: 4200 } },
  ]));
  ok("per door is the company's 175, not the code book's", d.perDoor === 175, d);
  ok("per drawer falls through to the book where the company said nothing", d.perDrawer === TRADE_PRICE_BOOKS.cabinet_refinishing.perDrawer, d.perDrawer);
  ok("the book's minimumTotal arrives as minCharge", d.minCharge === 4200, d.minCharge);
  ok("INSTANT_ESTIMATE_DEFAULTS.cabinet_refinishing still equals the code book",
    INSTANT_ESTIMATE_DEFAULTS.cabinet_refinishing.perDoor === TRADE_PRICE_BOOKS.cabinet_refinishing.perDoor
      && INSTANT_ESTIMATE_DEFAULTS.cabinet_refinishing.minCharge === TRADE_PRICE_BOOKS.cabinet_refinishing.minimumTotal);
  ok("the derivable trades are exactly the two", DERIVED_SEED_TRADES.sort().join(",") === "cabinet_refinishing,painting", DERIVED_SEED_TRADES);
  ok("the category with the service OFF contributes no book", deriveInstantSeed("cabinet_refinishing", seedInputsFor("cabinet_refinishing", [])) === null);
}

// ── 2. Drift: reported, applied on one press, never automatically ───────────
console.log("\nDrift between a saved row and the derivation");
{
  const derived = deriveInstantSeed("painting", seedInputsFor("painting", [
    { key: "interior_painting", rates: { complexity: { standard: { wallPricePerSqft: 3 } } } },
    { key: "exterior_painting", rates: null },
  ]));
  // The company saved the old literal seed: standard at 2.75, exterior 30%.
  const saved = {
    materials: [
      { key: "economy", label: "Economy", ratePerSqft: 2 },
      { key: "standard", label: "Standard", ratePerSqft: 2.75 },
    ],
    scopeSurcharge: { interior: 0, exterior: 0.3 },
    // Already at the derivation's values, so these two must NOT be reported.
    conditionSurcharge: { ...derived.conditionSurcharge },
    estimateVisibility: "range",
    budgetThresholds: [500, 2000, 6000],
    rangeBandPct: 0.1,
    minCharge: 400,
  };
  const drift = seedDrift("painting", saved, derived);
  const paths = drift.map((d) => d.path);
  ok("the base rate drift is reported", paths.includes("materials.standard.ratePerSqft"), paths);
  ok("the exterior surcharge drift is reported", paths.includes("scopeSurcharge.exterior"), paths);
  ok("condition tiers that agree are NOT reported", !paths.some((p) => p.startsWith("conditionSurcharge.")), paths);
  const baseLine = drift.find((d) => d.path === "materials.standard.ratePerSqft");
  ok("each line carries both sides and a kind", baseLine.saved === 2.75 && baseLine.derived === 3 && baseLine.kind === "money", baseLine);
  ok("every drift field has a label the screen can name", drift.every((d) => typeof d.label === "string" && d.label), drift);
  ok("identical row → no drift", seedDrift("painting", applyDerivedSeed("painting", saved, derived), derived).length === 0);
  ok("no derivation → no drift", seedDrift("painting", saved, null).length === 0);
  ok("a rate the row never set is a difference, not a match", seedDrift("painting", { materials: [] }, derived).some((d) => d.path === "materials.standard.ratePerSqft" && d.saved === undefined));

  const adopted = applyDerivedSeed("painting", saved, derived);
  ok("adopting updates the standard row in place", adopted.materials.find((m) => m.key === "standard").ratePerSqft === 3, adopted.materials);
  ok("...keeps the grade the company added", adopted.materials.some((m) => m.key === "economy" && m.ratePerSqft === 2), adopted.materials);
  ok("...keeps their visibility, bands, range and minimum",
    adopted.estimateVisibility === "range" && adopted.budgetThresholds.length === 3 && adopted.rangeBandPct === 0.1 && adopted.minCharge === 400, adopted);
  ok("...does not mutate the saved config", saved.materials[1].ratePerSqft === 2.75 && saved.scopeSurcharge.exterior === 0.3);
  ok("a row with no standard grade gains one", applyDerivedSeed("painting", { materials: [] }, derived).materials.some((m) => m.key === "standard" && m.label === "Standard" && m.ratePerSqft === 3));

  const cab = deriveInstantSeed("cabinet_refinishing", seedInputsFor("cabinet_refinishing", [{ key: "cabinet_refinishing", rates: { perDoor: 175 } }]));
  const cabSaved = { ...INSTANT_ESTIMATE_DEFAULTS.cabinet_refinishing, addOns: { ...INSTANT_ESTIMATE_DEFAULTS.cabinet_refinishing.addOns, softCloseHingesPerDoor: 99 } };
  const cabDrift = seedDrift("cabinet_refinishing", cabSaved, cab);
  ok("cabinet drift names per door and the one add-on that moved", cabDrift.map((d) => d.path).sort().join(",") === "addOns.softCloseHingesPerDoor,perDoor", cabDrift.map((d) => d.path));
  const cabAdopted = applyDerivedSeed("cabinet_refinishing", cabSaved, cab);
  ok("adopting a nested add-on keeps its six siblings", Object.keys(cabAdopted.addOns).length === Object.keys(cab.addOns).length && cabAdopted.addOns.softCloseHingesPerDoor === cab.addOns.softCloseHingesPerDoor, cabAdopted.addOns);
  ok("seedFields covers every derived cabinet rate", seedFields("cabinet_refinishing").map((f) => f.path).includes("addOns.twoTonePerUnit"));
}

// ── 3. Scope: both / one / none ─────────────────────────────────────────────
console.log("\nScope follows the services sold");
{
  ok("enabled keys → scopes", paintingScopesOffered(["roofing_service", "exterior_painting"]).join(",") === "exterior");
  ok("prototype names are not scopes", paintingScopesOffered(["__proto__", "constructor"]).length === 0);

  const both = resolvePaintingScope("exterior", ["interior", "exterior"]);
  ok("both sold: the homeowner's pick stands", both.ok && both.scope === "exterior" && both.fixed === false, both);
  const bothUnsaid = resolvePaintingScope(undefined, ["interior", "exterior"]);
  ok("both sold, nothing picked: left absent (the estimator's own default), not padded", bothUnsaid.ok && bothUnsaid.scope === undefined, bothUnsaid);
  ok("both sold, nonsense picked: dropped rather than priced", resolvePaintingScope("sideways", ["interior", "exterior"]).scope === undefined);

  const one = resolvePaintingScope("interior", ["exterior"]);
  ok("one sold: fixed to it whatever the browser said", one.ok && one.scope === "exterior" && one.fixed === true, one);
  const none = resolvePaintingScope("interior", []);
  ok("none sold: not offered", none.ok === false && none.reason === "scope_not_offered", none);

  const m = { areaSqft: 800, scope: "interior", surfaceCondition: "good" };
  const fixed = applyOfferedScope("painting", m, ["exterior"]);
  ok("applyOfferedScope rewrites the measurement's scope", fixed.ok && fixed.measurement.scope === "exterior" && fixed.measurement.areaSqft === 800, fixed);
  ok("...without mutating the input", m.scope === "interior");
  ok("...and leaves other trades alone", applyOfferedScope("epoxy", m, []).measurement === m);
}

// ── 4. The server: public payload and pricing, through the db stub ──────────
console.log("\nThe public payload and the pricer, executed");
{
  const company = {
    id: "c1", slug: "acme", name: "Acme Painting", logoUrl: null, brandColor: "#123456",
    defaultLanguage: "en", currency: "CAD", bookingModes: [], bookingSlug: null, eventTypes: [],
    financing: null,
  };
  const paintingRow = {
    companyId: "c1", trade: "painting", enabled: true,
    config: { ...INSTANT_ESTIMATE_DEFAULTS.painting, estimateVisibility: "range" },
  };
  const service = (key) => ({ companyId: "c1", enabled: true, rates: null, category: { key } });

  async function withServices(keys, fn) {
    resetDbStub();
    rows.company = [company];
    rows.instantQuoteConfig = [paintingRow];
    rows.companyServiceCategory = keys.map(service);
    return fn();
  }

  const RATE_SHAPED = /ratePerSqft|scopeSurcharge|conditionSurcharge|minCharge|rangeBandPct|budgetThresholds/;

  await withServices(["interior_painting", "exterior_painting"], async () => {
    const data = await loadCompanyInstantTrades("acme");
    const painting = data.trades.find((t) => t.trade === "painting");
    ok("both sold: painting is offered with both scopes", painting && painting.scopes.join(",") === "interior,exterior", painting?.scopes);
    ok("...and the payload carries no rate", !RATE_SHAPED.test(JSON.stringify(data.trades)), JSON.stringify(data.trades).slice(0, 200));
  });

  await withServices(["exterior_painting"], async () => {
    const data = await loadCompanyInstantTrades("acme");
    const painting = data.trades.find((t) => t.trade === "painting");
    ok("one sold: painting is offered with that one scope", painting && painting.scopes.join(",") === "exterior", painting?.scopes);
    ok("...still no rate", !RATE_SHAPED.test(JSON.stringify(data.trades)));

    const m = { areaSqft: 1000, scope: "interior", surfaceCondition: "good" };
    const all = await priceAllMaterials({ companyId: "c1", trade: "painting", measurement: m });
    const asExt = computeInstantEstimate({ trade: "painting", measurements: { ...m, scope: "exterior" }, materialKey: "standard", config: { ...paintingRow.config, enabled: true } });
    ok("priceAllMaterials prices the browser's 'interior' as exterior", all.ok && near(all.options[0].point, asExt.point), { got: all.options?.[0]?.point, exterior: asExt.point });
    const one = await priceOneMaterial({ companyId: "c1", trade: "painting", materialKey: "standard", measurement: m });
    ok("priceOneMaterial does the same", one.ok && near(one.estimate.point, asExt.point), one.estimate?.point);
    ok("...and hands back the measurement as priced, scope settled", one.measurement?.scope === "exterior", one.measurement);
    ok("...the estimate's breakdown names the scope it priced", one.estimate.breakdown.some((b) => /exterior/i.test(b.label)), one.estimate.breakdown);
  });

  await withServices([], async () => {
    const data = await loadCompanyInstantTrades("acme");
    ok("none sold: painting is not on the public page, however ready its row", !data.trades.some((t) => t.trade === "painting"), data.trades.map((t) => t.trade));
    const all = await priceAllMaterials({ companyId: "c1", trade: "painting", measurement: { areaSqft: 1000 } });
    ok("...and the pricer refuses rather than defaulting to interior", all.ok === false && all.reason === "scope_not_offered", all);
    const one = await priceOneMaterial({ companyId: "c1", trade: "painting", materialKey: "standard", measurement: { areaSqft: 1000 } });
    ok("...on both entry points", one.ok === false && one.reason === "scope_not_offered", one);
  });

  // Another trade is untouched by any of this.
  resetDbStub();
  rows.company = [company];
  rows.instantQuoteConfig = [{ companyId: "c1", trade: "epoxy", enabled: true, config: { ...INSTANT_ESTIMATE_DEFAULTS.epoxy } }];
  rows.companyServiceCategory = [];
  const epoxy = await priceAllMaterials({ companyId: "c1", trade: "epoxy", measurement: { areaSqft: 500, surfaceCondition: "good" } });
  ok("a non-painting trade prices with no services lookup at all", epoxy.ok && !("scopes" in ((await loadCompanyInstantTrades("acme")).trades[0] || {})), epoxy);
  resetDbStub();
}

// ── 5. The screens: pinned in source ────────────────────────────────────────
console.log("\nThe settings screen, the route and the form");
{
  const page = stripComments(read("app/app/settings/instant-quotes/page.js"));
  const route = stripComments(read("app/api/settings/instant-quote/route.js"));
  const flow = stripComments(read("app/instant-quote/[companySlug]/InstantQuoteFlow.js"));
  const server = stripComments(read("lib/estimate/instantQuoteServer.js"));

  ok("the route derives the seed from the company's enabled books", /deriveInstantSeed\(trade, seedInputs\)/.test(route) && /rates: true/.test(route));
  ok("...opens an unsaved card on the derived seed", /applyDerivedSeed\(trade, seed, derived\)/.test(route));
  ok("...reports drift only for a saved row", /seedDrift: row \? seedDrift\(trade, row\.config, derived\) : \[\]/.test(route));
  ok("...and hands painting its offered scopes", /scopesOffered: seedInputs\.offered/.test(route));
  ok("...and the live count excludes painting with no scope sold", /scopesOffered\.length === 0/.test(route));

  ok("the page shows the drift notice", /app\.setInstantQuotes\.seedDriftTitle/.test(page) && /app\.setInstantQuotes\.seedDriftLine/.test(page));
  ok("...with the one button", /app\.setInstantQuotes\.useServicesPricing/.test(page));
  ok("...which applies the derivation and saves through the existing PUT", /applyDerivedSeed\(trade\.trade, config, trade\.derivedSeed\)/.test(page) && /save\(next\)/.test(page) && /method: "PUT"/.test(page));
  ok("...and never adopts on its own (no effect calls it)", !/useEffect\([^)]*adoptServicesPricing/.test(page));
  ok("the surcharge block is retitled as a surcharge on the base rate", /app\.setInstantQuotes\.scopeSurchargeTitle/.test(page) && /app\.setInstantQuotes\.scopeSurchargeHelp/.test(page) && !/interiorExterior/.test(page));
  ok("...greys the scope not sold and says why", /disabled=\{!sold\}/.test(page) && /app\.setInstantQuotes\.scopeNotSold/.test(page));
  ok("...and says when painting is not offered at all", /app\.setInstantQuotes\.paintingNotOffered/.test(page));
  ok("an unsaved derived card is not called 'typical figures'", /app\.setInstantQuotes\.derivedDefaultsNote/.test(page) && /trade\.derivedFromServices/.test(page));

  ok("the public form hides the scope question for one scope", /askedWhen/.test(flow) && /trade\.scopes\.length > 1/.test(flow));
  ok("the server settles scope in BOTH pricing functions", (server.match(/withOfferedScope\(companyId, trade, requested\)/g) || []).length === 2);
  ok("...and reads the services fresh, never off the instant row", /companyEnabledCategoryKeys/.test(server));

  const KEYS = [
    "scopeSurchargeTitle", "scopeSurchargeHelp", "scopeNotSold", "scopeFixedNote", "scope.interior", "scope.exterior",
    "paintingNotOffered", "derivedDefaultsNote", "seedDriftTitle", "seedDriftLine", "seedDriftUnset", "useServicesPricing",
    "materials.standard.ratePerSqft", "scopeSurcharge.exterior", "conditionSurcharge.fair", "conditionSurcharge.poor", "minCharge",
  ].map((k) => `app.setInstantQuotes.${k}`);
  const langs = Object.keys(APP_MESSAGES);
  ok("nine catalogues", langs.length === 9, langs);
  const missing = langs.flatMap((l) => KEYS.filter((k) => !(k in APP_MESSAGES[l])).map((k) => `${l}:${k}`));
  ok("every new key exists in all nine", missing.length === 0, missing);
  ok("the retired key is gone from all nine", langs.every((l) => !("app.setInstantQuotes.interiorExterior" in APP_MESSAGES[l])));
  ok("no catalogue hand-writes a currency symbol in the new copy", langs.every((l) => KEYS.every((k) => !/\$/.test(APP_MESSAGES[l][k]))));
  ok("the drift line keeps its three placeholders everywhere", langs.every((l) => ["{field}", "{there}", "{here}"].every((p) => APP_MESSAGES[l]["app.setInstantQuotes.seedDriftLine"].includes(p))));
  ok("getPriceBook is what the derivation reads (company patch over the book)", getPriceBook("interior_painting", { complexity: { standard: { wallPricePerSqft: 9 } } }).complexity.standard.wallPricePerSqft === 9);
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
