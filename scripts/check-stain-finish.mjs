// scripts/check-stain-finish.mjs
//
//   npm run check:stain-finish
//   node --import ./scripts/alias-loader.mjs scripts/check-stain-finish.mjs
//
// Stained cabinets and stairs (owner, 2026-10-03 / 2026-10-04), executed
// against hostile input:
//
//   A. The stain type — absent and junk read as liquid.
//   B. Cabinets are priced ALL-IN per stained piece: the painting rate plus
//      the stain difference (bare wood $45 → $195; gel $0 → $150), on the
//      unit line — never an add-on line, never an hourly stripping line.
//   C. Stairs: a chosen type is said under the treads; painted-to-stain is
//      the High tier; no stripping line anywhere.
//   D. Stripping is COST only: the hours reach Cost & margin and nothing else.
//   E. Routing, offering, saving, the instant estimate.
//   F. Wiring and words.
//   G. Every path without a stain is byte-identical to origin/main (md5).
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  normaliseStainType,
  stainTypeChosen,
  stairStainText,
  STAIN_TYPES,
  normaliseStripMethod,
  cabinetNeedsStripping,
  cabinetStrippingHours,
  stairNeedsStripping,
  stairStrippingHours,
  stainPremiumPerUnit,
  stainedPieceCount,
  stainedUnitRate,
  stainedLineText,
} from "@/lib/pricing/stainFinish";
import { cabinetAddOnLines, buildTradeLineItems, newStairSection, tradeLabourHours } from "@/lib/pricing/tradeScope";
import { cabinetRunLabour } from "@/lib/pricing/cabinetLabour";
import { unitPricingSubtotal } from "@/app/data/cabinetPricing";
import { getPriceBook, PRICE_BOOK_FIELDS } from "@/app/data/tradePriceBooks";
import { addOnsForCategory } from "@/lib/pricing/offerings";
import { newScopeGroup, scopeGroupPayload, groupSubtotal, cabinetAddOnLinesFor, withCabinetAnswers } from "@/lib/quotes/builderPayload";
import { routeEstimateKind, routedGroup } from "@/lib/quotes/estimateKindRouting";
import { sanitiseRates } from "@/lib/pricing/sanitiseRates";
import { estimateCabinetRefinishing, INSTANT_ESTIMATE_DEFAULTS } from "@/lib/estimate/instantEstimate";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond ? pass++ : fails.push(`${label}${detail !== undefined ? ` — got ${JSON.stringify(detail)?.slice(0, 300)}` : ""}`);
const section = (s) => console.log(`\n${s}`);
const md5 = (o) => createHash("md5").update(JSON.stringify(o)).digest("hex");
const src = (p) => readFileSync(p, "utf8");
const finite = (lines) => lines.every((l) => Number.isFinite(l.amount) && Number.isFinite(l.rate) && Number.isFinite(l.quantity));

const book = getPriceBook("cabinet_refinishing");
const REF = { id: "r", key: "cabinet_refinishing", label: "Cabinet Refinishing" };
const kitchen = (extra = {}, addOns = ["stainFinish"]) => ({
  ...newScopeGroup(REF, "Cabinet Refinishing", null, { tempId: "k", intakeValues: { doorCount: 20, drawerCount: 8 }, addOns }),
  ...extra,
});

/* ══ A ══ */
section("A. The stain type");
ok("two types, liquid first", JSON.stringify(STAIN_TYPES) === '["liquid","gel"]');
for (const v of [undefined, null, "", "LIQUID", " liquid ", "oil", 7, {}, [], "__proto__"]) {
  ok(`${JSON.stringify(v)} reads as liquid`, normaliseStainType(v) === "liquid");
}
ok("' GEL ' reads as gel", normaliseStainType(" GEL ") === "gel");
ok("absent is not a CHOICE", !stainTypeChosen(undefined) && !stainTypeChosen("") && !stainTypeChosen("oil"));

/* ══ B ══ */
section("B. Cabinets — all-in per stained piece");
{
  ok("painting today: $150 a door and a drawer front (the all-in default)", book.perDoor === 150 && book.perDrawer === 150);
  ok("bare-wood stain difference stays the shipped $45 (no $10)", book.addOns.stainFinishPerUnit === 45);
  ok("gel difference $0 — the painting rate", book.addOns.gelStainPerUnit === 0);
  ok("bare wood: $150 + $45 = $195 a piece", stainedUnitRate(150, stainPremiumPerUnit({ stainFinish: true }, book)) === 195);
  ok("gel: $150 a piece", stainedUnitRate(150, stainPremiumPerUnit({ stainFinish: true, stainType: "gel" }, book)) === 150);
  ok("gel going dark → light is a bare-wood job: $195", stainedUnitRate(150, stainPremiumPerUnit({ stainFinish: true, stainType: "gel", stainDarkToLight: true }, book)) === 195);

  // The example kitchen: 20 doors + 8 drawer fronts.
  const painted = kitchen({}, []);
  const liquid = kitchen();
  const gel = kitchen({ stainType: "gel" });
  ok("painted kitchen: 28 × $150 = $4,200", groupSubtotal(painted) === 4200, groupSubtotal(painted));
  ok("liquid (to bare wood): 28 × $195 = $5,460", groupSubtotal(liquid) === 5460, groupSubtotal(liquid));
  ok("gel: 28 × $150 = $4,200", groupSubtotal(gel) === 4200, groupSubtotal(gel));
  const saved = scopeGroupPayload(liquid, null, "en");
  ok("one all-in line, no add-on line, no stripping line", saved.lineItems.length === 1 && saved.lineItems[0].quantity === 28 && saved.lineItems[0].rate === 195 && saved.lineItems[0].amount === 5460, saved.lineItems);
  ok("…it says it is stained to bare wood, all-in", /stained finish \(to bare wood\)/.test(saved.lineItems[0].description) && /^All-in/.test(saved.lineItems[0].detail));
  ok("…no line anywhere mentions stripping by the hour", !saved.lineItems.some((l) => l.unit === "hour" || /Stripping/.test(l.description)));
  ok("…and the payload total is the builder's total", saved.lineItems.reduce((s, l) => s + l.amount, 0) === groupSubtotal(liquid));
  const fr = scopeGroupPayload(gel, null, "fr");
  ok("gel, French quote: the French all-in sentence", /fini teint au gel/.test(fr.lineItems[0].description) && /Sans décapage/.test(fr.lineItems[0].detail));
  // An island stained, the rest painted.
  const island = kitchen({ addOnUnits: { stainFinish: 6 } });
  const isl = scopeGroupPayload(island, null, "en");
  ok("island-only: 22 painted at $150 + 6 stained at $195 = $4,470", isl.lineItems.length === 2 && isl.lineItems[0].quantity === 22 && isl.lineItems[0].rate === 150 && isl.lineItems[1].quantity === 6 && isl.lineItems[1].rate === 195 && groupSubtotal(island) === 4470, isl.lineItems);
  ok("…a stain count above the pieces is all of them", stainedPieceCount({ stainFinish: true, addOnUnits: { stainFinish: 999 } }, 28) === 28);
  ok("…a stain count of 0 stains nothing", groupSubtotal(kitchen({ addOnUnits: { stainFinish: 0 } })) === 4200);
  // The complexity uplift carries through: Moderate +$20.
  ok("Moderate complexity: (150 + 20) + 45 = $215 a piece", scopeGroupPayload(kitchen({ complexityLevel: "moderate" }), null, "en").lineItems[0].rate === 215);
  // A company's own figures are kept.
  const own = { perDoor: 180, perDrawer: 180, addOns: { stainFinishPerUnit: 60, gelStainPerUnit: -20 } };
  const ownLiquid = newScopeGroup(REF, "Cabinets", own, { tempId: "o", intakeValues: { doorCount: 10 }, addOns: ["stainFinish"] });
  ok("a company's own painting rate and difference: 180 + 60 = $240", scopeGroupPayload(ownLiquid, own, "en").lineItems[0].rate === 240);
  ok("…a negative gel difference prices under painting: 180 − 20 = $160", scopeGroupPayload({ ...ownLiquid, stainType: "gel" }, own, "en").lineItems[0].rate === 160);
  ok("…never below $0", stainedUnitRate(10, -500) === 0);
  // Hostile input.
  for (const [d, dr] of [[0, 0], [-5, -3], ["x", null]]) {
    const g = { ...newScopeGroup(REF, "C", null, { tempId: "h", intakeValues: { doorCount: d, drawerCount: dr }, addOns: ["stainFinish"] }) };
    const p = scopeGroupPayload(g, null, "en");
    ok(`doors ${JSON.stringify(d)} drawers ${JSON.stringify(dr)}: finite, no stained line`, finite(p.lineItems) && !p.lineItems.some((l) => /stained/.test(l.description)));
  }
  ok("a million pieces stays finite", Number.isFinite(unitPricingSubtotal({ ...kitchen(), intakeValues: { doorCount: 1e6, drawerCount: 1e6 } }, book)));
  for (const [label, b] of [["no book", null], ["no addOns", {}], ["junk difference", { addOns: { stainFinishPerUnit: "x" } }]]) {
    ok(`${label}: the difference is 0, the rate is the painting rate`, stainPremiumPerUnit({ stainFinish: true }, b) === 0);
  }
  ok("cabinetAddOnLines never writes a stain line any more", !cabinetAddOnLines({ doors: 20, drawers: 8, stainFinish: true, stainType: "gel" }, book).length);
  const other = cabinetAddOnLinesFor(kitchen({}, ["stainFinish", "softCloseHinges"]));
  ok("…other upgrades still write theirs (hinges 20 × $35)", other.length === 1 && other[0].amount === 700, other);
  ok("the takeoff-path builder prices stained doors all-in too", buildTradeLineItems("cabinet_refinishing", { doors: 2, drawers: 1, stainFinish: true }, null, {}).filter((l) => !/minimum/i.test(l.description)).every((l) => l.rate === 195));
}

/* ══ C ══ */
section("C. Stairs");
{
  const sbook = getPriceBook("stairs");
  const sec = { ...newStairSection("Main"), treads: 13, risers: 14, handrailFt: 14, paintRisers: true };
  const plain = buildTradeLineItems("stairs", { sections: [sec] }, null, { language: "en" });
  const liquid = buildTradeLineItems("stairs", { sections: [{ ...sec, stainType: "liquid" }] }, null, { language: "en" });
  const treads = (ls) => ls.find((l) => /treads/.test(l.description));
  ok("no choice: no stain sentence", !("detail" in treads(plain)));
  ok("liquid: said under the treads", treads(liquid).detail === stairStainText("liquid", "en"));
  ok("the tread rate never moves with the type", treads(plain).rate === treads(liquid).rate);
  const painted = { ...sec, existingFinish: "painted", stainType: "liquid" };
  ok("painted + liquid needs stripping", stairNeedsStripping(painted) && !stairNeedsStripping({ ...painted, stainType: "gel" }));
  const lines = buildTradeLineItems("stairs", { sections: [painted], stripLabourRate: 70 }, null, {});
  ok("…but writes no stripping line, even with a stray labour rate on the takeoff", !lines.some((l) => /Stripping|bare wood —/.test(l.description) || l.unit === "hour"), lines);
  const high = buildTradeLineItems("stairs", { sections: [{ ...painted, complexityLevel: "high" }] }, null, {});
  ok("painted-to-stain on the High tier: 13 × $275 + 14 × $40 + 14 × $28 = $4,527", high.reduce((s, l) => s + l.amount, 0) === 4527, high.map((l) => [l.description, l.amount]));
  ok("clear finish, Standard: 13 × $150 + 14 × $25 + 14 × $15 = $2,510", plain.reduce((s, l) => s + l.amount, 0) === 2510);
  ok("the High tier says it includes stripping", /painted-over surfaces to strip/.test(sbook.complexity.high.desc));
}

/* ══ D ══ */
section("D. Stripping is cost only");
{
  const k = { doors: 20, drawers: 8, stainFinish: true };
  ok("chemical 20 × 0.75 + 8 × 0.25 = 17 h", cabinetStrippingHours(k, book) === 17);
  ok("sanding 20 × 0.4 + 8 × 0.15 = 9.2 h", cabinetStrippingHours({ ...k, stripMethod: "sanding" }, book) === 9.2);
  ok("gel: 0 h", cabinetStrippingHours({ ...k, stainType: "gel" }, book) === 0);
  ok("junk method is chemical", normaliseStripMethod("laser") === "chemical");
  const plainHours = cabinetRunLabour({ doors: 20, drawers: 8 }, book).hours;
  ok("cabinetLabour adds exactly the stripping hours", Math.abs(cabinetRunLabour(k, book).hours - plainHours - 17) < 0.011);
  ok("…and the method moves them", Math.abs(cabinetRunLabour({ ...k, stripMethod: "sanding" }, book).hours - plainHours - 9.2) < 0.011);
  ok("…and the PRICE does not move with the method", groupSubtotal(kitchen({ stripMethod: "sanding" })) === groupSubtotal(kitchen({ stripMethod: "chemical" })));
  const sbook = getPriceBook("stairs");
  const painted = { ...newStairSection("A"), treads: 13, risers: 14, handrailFt: 14, paintRisers: true, existingFinish: "painted" };
  ok("stairs: 13 × 0.5 + 14 × 0.35 + 14 × 0.15 = 13.5 h of cost", stairStrippingHours(painted, sbook) === 13.5 && tradeLabourHours("stairs", { sections: [painted] }, null) === 13.5);
  ok("every stripping row on the rate card is internal and labelled a researched default", ["cabinet_refinishing", "stairs"].every((tr) => PRICE_BOOK_FIELDS[tr].filter((f) => f.path.startsWith("stripping.")).every((f) => f.internal === true && /researched default/.test(f.label))));
  ok("hostile stripping books: 0 h", cabinetStrippingHours(k, { stripping: { chemical: { hoursPerDoor: "x", hoursPerDrawer: -2 } } }) === 0 && cabinetStrippingHours(k, null) === 0);
}

/* ══ E ══ */
section("E. Routing, offering, saving, instant");
{
  const cats = [{ id: "s", key: "stairs", label: "Stair Refinishing" }, REF];
  const g = routedGroup(routeEstimateKind("staining", cats, "stairs"), newScopeGroup(cats[0], "x", null, { tempId: "t" }));
  ok("Staining → Stairs opens on liquid, with nothing else written", g.takeoff.sections.every((s) => s.stainType === "liquid") && !("stripLabourRate" in g.takeoff));
  const cg = newScopeGroup(REF, "x", null, { tempId: "c" });
  ok("a cabinet route is untouched", routedGroup(routeEstimateKind("staining", cats, "cabinets"), cg) === cg);
  ok("stain is offered while the bare-wood difference is priced", addOnsForCategory("cabinet_refinishing").some((a) => a.key === "stainFinish"));
  ok("…not when it is zeroed", !addOnsForCategory("cabinet_refinishing", { addOns: { stainFinishPerUnit: 0 } }).some((a) => a.key === "stainFinish"));
  ok("the stain add-on's label carries no money (the call-draft model reads it)", addOnsForCategory("cabinet_refinishing").filter((a) => a.key === "stainFinish").every((a) => !/[$€£]|\d/.test(a.label)));
  ok("the stain and gel rate-card labels carry no money", PRICE_BOOK_FIELDS.cabinet_refinishing.filter((f) => /tain/.test(f.path)).every((f) => !/[$€£]|\d/.test(f.label)));
  ok("…both are on the rate card and survive the sanitiser", sanitiseRates("cabinet_refinishing", { addOns: { stainFinishPerUnit: 60, gelStainPerUnit: -20 } })?.addOns?.gelStainPerUnit === -20);
  const answers = withCabinetAnswers({ categoryKey: "cabinet_refinishing", intakeValues: {}, stainFinish: true, stainType: "gel", stripMethod: "sanding", stainDarkToLight: true });
  ok("the stain answers are saved with the cabinet answers", answers.stainFinish === true && answers.stainType === "gel" && answers.stripMethod === "sanding" && answers.stainDarkToLight === true);
  const cfg = INSTANT_ESTIMATE_DEFAULTS.cabinet_refinishing;
  const plainEst = estimateCabinetRefinishing({ doorCount: 20, drawerCount: 8 }, { ...cfg, enabled: true });
  const stainEst = estimateCabinetRefinishing({ doorCount: 20, drawerCount: 8, addOns: ["stainFinish"] }, { ...cfg, enabled: true });
  const point = (e) => e.breakdown.reduce((s, b) => s + (Number(b.amount) || 0), 0);
  ok("instant / call estimate: a stain asked for prices the pieces all-in (+$45 × 28 = +$1,260)", Math.round(point(stainEst) - point(plainEst)) === 1260, [point(plainEst), point(stainEst)]);
  ok("…and says so to the reviewer", stainEst.assumptions.some((a) => /all-in at the stained rate/.test(a)));
}

/* ══ F ══ */
section("F. Wiring and words");
{
  const upf = src("app/components/quotes/builder/UnitPricingFields.js");
  ok("the stain buttons show the all-in rate", /stainedUnitRate\(finalPrice, stainPremiumPerUnit\(\{ \.\.\.group, stainType: type \}, book\)\)/.test(upf));
  ok("the base total is unitPricingSubtotal (stained pieces included)", /const baseTotal = unitPricingSubtotal\(group, book\)/.test(upf) && /money\(baseTotal \+ addOnTotal\)/.test(upf));
  ok("the stripping panel says it is included, and sets hours only", /data-stripping-included/.test(upf) && !/stripLabourRate|labourSellRate/.test(upf));
  const tt = src("app/components/quotes/builder/TradeTakeoff.js");
  ok("stairs: painted points at the High tier; no hourly stripping", /data-use-high-tier/.test(tt) && !/stripLabourRate|labourSellRate/.test(tt));
  ok("no labour rate leaves the server for stain any more", !/labourSellRate/.test(src("app/api/settings/business-info/route.js")) && !/labourSellRate/.test(src("app/components/quotes/builder/QuoteBuilder.js")));
  const keys = ["app.stain.stripIncluded", "app.stain.perPieceAllIn", "app.stain.stainedAllIn", "app.stain.stripInHighTier", "app.stain.stripUseHighTier", "app.stain.useHighTier", "app.stain.typeLabel", "app.stain.liquid", "app.stain.gel", "app.stain.darkToLight"];
  for (const lang of Object.keys(APP_MESSAGES)) {
    ok(`${lang}: every stain string`, keys.every((k) => typeof APP_MESSAGES[lang][k] === "string" && APP_MESSAGES[lang][k]), keys.filter((k) => !APP_MESSAGES[lang][k]));
    ok(`${lang}: no hourly-stripping strings left`, !["app.stain.stripLine", "app.stain.stripNoRate", "app.stain.stripSetRate"].some((k) => k in APP_MESSAGES[lang]));
  }
  ok("stainedLineText: bare and gel words differ", stainedLineText({ stainFinish: true }, "en").name !== stainedLineText({ stainFinish: true, stainType: "gel" }, "en").name);
  ok("cabinetNeedsStripping needs the tick", !cabinetNeedsStripping({ stainType: "liquid" }));
}

/* ══ G ══ */
section("G. Without a stain: identical to origin/main");
{
  // md5 of the cabinet and stair payloads with no stain, taken by running
  // this same block against origin/main's files (2026-10-04, b75c8639 + main).
  const pins = {};
  for (const addOns of [[], ["softCloseHinges", "handleHoles", "twoTone"]]) {
    for (const lang of ["en", "fr"]) {
      const g = newScopeGroup(REF, "Cabinets", null, { tempId: "c", intakeValues: { doorCount: 20, drawerCount: 8 }, addOns, language: lang });
      pins[`cab ${addOns.join("+") || "-"} ${lang}`] = md5([cabinetAddOnLinesFor(g, null, lang), groupSubtotal(g), scopeGroupPayload(g, null, lang)]);
    }
  }
  const sec = { ...newStairSection("Main"), treads: 13, risers: 14, balusters: 30, posts: 2, handrailFt: 14, landingSqft: 9, paintRisers: true, paintBalusters: true, paintPosts: true, twoTone: true };
  for (const lang of ["en", "fr"]) pins[`stairs ${lang}`] = md5(buildTradeLineItems("stairs", { sections: [sec], basement: true, basementTreads: 12 }, null, { language: lang }));
  pins["cab hours"] = cabinetRunLabour({ doors: 20, drawers: 8 }, book).hours;
  pins["instant"] = md5(estimateCabinetRefinishing({ doorCount: 20, drawerCount: 8, addOns: ["softCloseHinges"] }, { ...INSTANT_ESTIMATE_DEFAULTS.cabinet_refinishing, enabled: true }));
  if (process.env.PRINT_PINS) console.log(JSON.stringify(pins, null, 1));
  const EXPECTED = {
    "cab - en": "b414bbd31278ceca5f446f5be3345a0f",
    "cab - fr": "b414bbd31278ceca5f446f5be3345a0f",
    "cab softCloseHinges+handleHoles+twoTone en": "11bfe60f91f6dfac68400416058d4f54",
    "cab softCloseHinges+handleHoles+twoTone fr": "8329a4fc8603e082688f3f30094125d5",
    "stairs en": "859e70d0d0ec1cfb9810ed668bf55d85",
    "stairs fr": "859e70d0d0ec1cfb9810ed668bf55d85",
    "cab hours": 27.23,
    "instant": "092f038f6954828d776c18f96e55cf3e"
  };
  for (const [k, v] of Object.entries(EXPECTED)) ok(`${k} unchanged`, pins[k] === v, pins[k]);
}

console.log(`\ncheck-stain-finish: ${pass} passed, ${fails.length} failed`);
if (fails.length) {
  console.error(fails.map((f) => `  ✗ ${f}`).join("\n"));
  process.exit(1);
}
