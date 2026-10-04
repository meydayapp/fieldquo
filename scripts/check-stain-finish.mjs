// scripts/check-stain-finish.mjs
//
//   npm run check:stain-finish
//   node --import ./scripts/alias-loader.mjs scripts/check-stain-finish.mjs
//
// Gel vs liquid stain on the cabinet and stair calculators (owner,
// 2026-10-03), executed against hostile input:
//
//   A. The stain type itself — absent and junk read as liquid.
//   B. Cabinets: one tick, the group's stainType picks the line and the rate;
//      absent is the liquid line byte for byte; counts and books that are
//      zero, negative, huge, NaN or missing produce no NaN and no $0 line.
//   C. Stairs: a chosen type is said under the treads; none chosen prints as
//      before; the tread rate never moves with the type.
//   D. Routing, offering and the saved answers.
//   E. Wiring: the builder renders the choice, the catalogue has the words.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { normaliseStainType, stainTypeChosen, stairStainText, STAIN_TYPES } from "@/lib/pricing/stainFinish";
import { cabinetAddOnLines, buildTradeLineItems, newStairSection } from "@/lib/pricing/tradeScope";
import { getPriceBook, PRICE_BOOK_FIELDS } from "@/app/data/tradePriceBooks";
import { addOnsForCategory } from "@/lib/pricing/offerings";
import { newScopeGroup, scopeGroupPayload, cabinetAddOnLinesFor } from "@/lib/quotes/builderPayload";
import { routeEstimateKind, routedGroup } from "@/lib/quotes/estimateKindRouting";
import { sanitiseRates } from "@/lib/pricing/sanitiseRates";
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

/* ══ A ══ */
section("A. The stain type");
ok("two types, liquid first", JSON.stringify(STAIN_TYPES) === '["liquid","gel"]');
for (const v of [undefined, null, "", "LIQUID", " liquid ", "oil", 7, {}, [], "__proto__"]) {
  ok(`${JSON.stringify(v)} reads as liquid`, normaliseStainType(v) === "liquid");
}
ok("' GEL ' reads as gel", normaliseStainType(" GEL ") === "gel");
ok("absent is not a CHOICE", !stainTypeChosen(undefined) && !stainTypeChosen("") && !stainTypeChosen("oil"));
ok("liquid and gel are choices", stainTypeChosen("liquid") && stainTypeChosen("gel"));

/* ══ B ══ */
section("B. Cabinets");
ok("the book prices gel at the researched $20 default", book.addOns.gelStainPerUnit === 20);
ok("…and liquid at its own rate", book.addOns.stainFinishPerUnit > 0);
ok("gel is on the rate card, labelled as a default", PRICE_BOOK_FIELDS.cabinet_refinishing.some((f) => f.path === "addOns.gelStainPerUnit" && /default/i.test(f.label)));
ok("…and a company's gel rate survives the sanitiser", sanitiseRates("cabinet_refinishing", { addOns: { gelStainPerUnit: 18 } })?.addOns?.gelStainPerUnit === 18);
{
  const base = { doors: 20, drawers: 8, stainFinish: true };
  const absent = cabinetAddOnLines(base, book);
  const liquid = cabinetAddOnLines({ ...base, stainType: "liquid" }, book);
  const gel = cabinetAddOnLines({ ...base, stainType: "gel" }, book);
  ok("absent and liquid write the same line", md5(absent) === md5(liquid));
  ok("gel: 28 × $20 = $560, its own sentence, no stripping promised", gel.length === 1 && gel[0].quantity === 28 && gel[0].rate === 20 && gel[0].amount === 560 && /No stripping/.test(gel[0].detail) && /Gel stain/.test(gel[0].description), gel);
  ok("liquid keeps its name", /Stain finish instead of paint/.test(liquid[0].description));
  const fr = cabinetAddOnLines({ ...base, stainType: "gel", language: "fr" }, book);
  ok("gel in French on a French quote", /Teinture en gel/.test(fr[0].description) && /Sans décapage/.test(fr[0].detail));
  ok("junk type prices as liquid", md5(cabinetAddOnLines({ ...base, stainType: "walnut" }, book)) === md5(absent));
  ok("no tick, no line, whatever the type", cabinetAddOnLines({ doors: 20, drawers: 8, stainType: "gel" }, book).length === 0);
  // Hostile counts.
  for (const [d, dr] of [[0, 0], [-5, -3], [NaN, "x"], ["", null], [undefined, undefined]]) {
    const l = cabinetAddOnLines({ doors: d, drawers: dr, stainFinish: true, stainType: "gel" }, book);
    ok(`doors ${JSON.stringify(d)} drawers ${JSON.stringify(dr)}: no line, no NaN`, l.length === 0 && finite(l), l);
  }
  const huge = cabinetAddOnLines({ doors: 1e6, drawers: 1e6, stainFinish: true, stainType: "gel" }, book);
  ok("a million doors and drawers is a finite line", finite(huge) && huge[0].amount === 40000000, huge);
  const over = cabinetAddOnLines({ ...base, stainType: "gel", addOnUnits: { stainFinish: 6 } }, book);
  ok("the island-only count override applies to gel too: 6 × $20", over[0]?.amount === 120);
  const zeroCount = cabinetAddOnLines({ ...base, stainType: "gel", addOnUnits: { stainFinish: 0 } }, book);
  ok("an override of 0 drops the line", zeroCount.length === 0);
  // Missing book rows.
  for (const [label, b] of [["no book", {}], ["no addOns", { addOns: undefined }], ["gel row missing", { addOns: { stainFinishPerUnit: 45 } }], ["gel row zeroed", { addOns: { gelStainPerUnit: 0 } }], ["gel row junk", { addOns: { gelStainPerUnit: "abc" } }], ["gel row negative", { addOns: { gelStainPerUnit: -20 } }]]) {
    const l = cabinetAddOnLines({ ...base, stainType: "gel" }, b);
    ok(`${label}: no gel line, no NaN`, l.length === 0 && finite(l), l);
  }
}

/* ══ C ══ */
section("C. Stairs");
{
  const sec = { ...newStairSection("Main"), treads: 13, risers: 14, handrailFt: 14, paintRisers: true };
  const plain = buildTradeLineItems("stairs", { sections: [sec] }, null, { language: "en" });
  const liquid = buildTradeLineItems("stairs", { sections: [{ ...sec, stainType: "liquid" }] }, null, { language: "en" });
  const gel = buildTradeLineItems("stairs", { sections: [{ ...sec, stainType: "gel" }] }, null, { language: "fr" });
  const treads = (ls) => ls.find((l) => /treads/.test(l.description));
  ok("no choice: the treads line carries no stain sentence", !("detail" in treads(plain)));
  ok("liquid: said under the treads", treads(liquid).detail === stairStainText("liquid", "en"));
  ok("gel, French quote: said in French", treads(gel).detail === stairStainText("gel", "fr") && /gel/.test(treads(gel).detail));
  ok("the tread rate never moves with the type", treads(plain).rate === treads(liquid).rate && treads(liquid).rate === treads(gel).rate);
  ok("only the treads line changes", md5(plain.filter((l) => !/treads/.test(l.description))) === md5(liquid.filter((l) => !/treads/.test(l.description))));
  ok("a junk type is no choice", !("detail" in treads(buildTradeLineItems("stairs", { sections: [{ ...sec, stainType: "oak" }] }, null, {}))));
  ok("no treads, no treads line, no throw", buildTradeLineItems("stairs", { sections: [{ ...sec, treads: -4, stainType: "gel" }] }, null, {}).every((l) => !/treads/.test(l.description)));
}

/* ══ D ══ */
section("D. Routing, offering, saving");
{
  const cats = [{ id: "s", key: "stairs", label: "Stair Refinishing" }, { id: "c", key: "cabinet_refinishing", label: "Cabinet Refinishing" }];
  const route = routeEstimateKind("staining", cats, "stairs");
  const g = routedGroup(route, newScopeGroup(cats[0], "Staining — stairs", null, { tempId: "t" }));
  ok("Staining → Stairs opens its staircase on liquid", g.takeoff.sections.every((s) => s.stainType === "liquid"));
  const cabRoute = routeEstimateKind("staining", cats, "cabinets");
  const cg = newScopeGroup(cats[1], "x", null, { tempId: "c" });
  ok("routedGroup leaves a cabinet route untouched", routedGroup(cabRoute, cg) === cg);
  ok("…and a null route", routedGroup(null, cg) === cg);
  ok("stain is offered while gel alone is priced", addOnsForCategory("cabinet_refinishing", { addOns: { stainFinishPerUnit: 0 } }).some((a) => a.key === "stainFinish"));
  ok("…and not when both are zeroed", !addOnsForCategory("cabinet_refinishing", { addOns: { stainFinishPerUnit: 0, gelStainPerUnit: 0 } }).some((a) => a.key === "stainFinish"));
  const stained = { ...newScopeGroup(cats[1], "Cabinets", null, { tempId: "c", intakeValues: { doorCount: 4, drawerCount: 2 }, addOns: ["stainFinish"] }), stainType: "gel" };
  const saved = scopeGroupPayload(stained, null, "en");
  ok("the tick and the stain type are saved with the cabinet answers", saved.intakeValues?.stainFinish === true && saved.intakeValues?.stainType === "gel", saved.intakeValues);
  ok("…and the saved gel line is the one priced", saved.lineItems.some((l) => /Gel stain/.test(l.description) && l.amount === 120));
  ok("cabinetAddOnLinesFor reads the group's stainType", cabinetAddOnLinesFor(stained).some((l) => /Gel stain/.test(l.description)));
}

/* ══ E ══ */
section("E. Wiring");
{
  const upf = src("app/components/quotes/builder/UnitPricingFields.js");
  ok("the cabinet add-on row renders the two stain buttons", /data-stain-type/.test(upf) && /onPricingChange\(\{ stainType: type \}\)/.test(upf));
  ok("…and prices the row with the group's type", /stainType: group\.stainType/.test(upf));
  const tt = src("app/components/quotes/builder/TradeTakeoff.js");
  ok("each staircase has the stain select", /data-stair-stain-type/.test(tt) && /set\(\{ stainType:/.test(tt));
  const keys = ["app.stain.typeLabel", "app.stain.liquid", "app.stain.gel", "app.stain.notSaid", "app.stain.liquidHint", "app.stain.gelHint"];
  for (const lang of Object.keys(APP_MESSAGES)) {
    ok(`${lang}: every stain string`, keys.every((k) => typeof APP_MESSAGES[lang][k] === "string" && APP_MESSAGES[lang][k].length > 0), keys.filter((k) => !APP_MESSAGES[lang][k]));
  }
}

console.log(`\ncheck-stain-finish: ${pass} passed, ${fails.length} failed`);
if (fails.length) {
  console.error(fails.map((f) => `  ✗ ${f}`).join("\n"));
  process.exit(1);
}
