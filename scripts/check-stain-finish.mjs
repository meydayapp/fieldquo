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
  strippingLine,
  withStripLabourRate,
} from "@/lib/pricing/stainFinish";
import { cabinetAddOnLines, buildTradeLineItems, newStairSection, tradeLabourHours } from "@/lib/pricing/tradeScope";
import { cabinetRunLabour } from "@/lib/pricing/cabinetLabour";
import { getPriceBook, PRICE_BOOK_FIELDS } from "@/app/data/tradePriceBooks";
import { addOnsForCategory } from "@/lib/pricing/offerings";
import { newScopeGroup, scopeGroupPayload, cabinetAddOnLinesFor, withCabinetAnswers } from "@/lib/quotes/builderPayload";
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
  ok("the cabinet add-on row renders the two stain buttons", /data-stain-type/.test(upf) && /setStain\(\{ stainType: type \}\)/.test(upf));
  ok("…and prices the row with the group's type", /stainType: group\.stainType/.test(upf));
  const tt = src("app/components/quotes/builder/TradeTakeoff.js");
  ok("each staircase has the stain select", /data-stair-stain-type/.test(tt) && /set\(\{ stainType:/.test(tt));
  const keys = ["app.stain.typeLabel", "app.stain.liquid", "app.stain.gel", "app.stain.notSaid", "app.stain.liquidHint", "app.stain.gelHint"];
  for (const lang of Object.keys(APP_MESSAGES)) {
    ok(`${lang}: every stain string`, keys.every((k) => typeof APP_MESSAGES[lang][k] === "string" && APP_MESSAGES[lang][k].length > 0), keys.filter((k) => !APP_MESSAGES[lang][k]));
  }
}

/* ══ F ══ */
section("F. Stripping to bare wood — its own labour line");
{
  const kitchen = { doors: 20, drawers: 8, stainFinish: true };
  ok("cabinets: liquid needs stripping", cabinetNeedsStripping(kitchen) && cabinetNeedsStripping({ ...kitchen, stainType: "liquid" }));
  ok("cabinets: gel over the existing finish does not", !cabinetNeedsStripping({ ...kitchen, stainType: "gel" }));
  ok("cabinets: gel going dark → light does", cabinetNeedsStripping({ ...kitchen, stainType: "gel", stainDarkToLight: true }));
  ok("cabinets: no stain tick, no stripping", !cabinetNeedsStripping({ doors: 20, drawers: 8, stainDarkToLight: true }));
  ok("the cabinet book carries the researched defaults", JSON.stringify(book.stripping) === JSON.stringify({ chemical: { hoursPerDoor: 0.75, hoursPerDrawer: 0.25 }, sanding: { hoursPerDoor: 0.4, hoursPerDrawer: 0.15 } }));
  ok("chemical: 20 × 0.75 + 8 × 0.25 = 17 h", cabinetStrippingHours(kitchen, book) === 17);
  ok("sanding: 20 × 0.4 + 8 × 0.15 = 9.2 h", cabinetStrippingHours({ ...kitchen, stripMethod: "sanding" }, book) === 9.2);
  ok("junk method is chemical", cabinetStrippingHours({ ...kitchen, stripMethod: "laser" }, book) === 17 && normaliseStripMethod("") === "chemical");
  ok("an island-only stain count scales the hours: 6 of 28 pieces → 3.64 h", cabinetStrippingHours({ ...kitchen, addOnUnits: { stainFinish: 6 } }, book) === 3.64);
  ok("a count above the pieces is capped at the pieces", cabinetStrippingHours({ ...kitchen, addOnUnits: { stainFinish: 999 } }, book) === 17);
  for (const [d, dr] of [[0, 0], [-5, -3], [NaN, "x"], [null, undefined]]) {
    ok(`doors ${JSON.stringify(d)} drawers ${JSON.stringify(dr)}: 0 h`, cabinetStrippingHours({ stainFinish: true, doors: d, drawers: dr }, book) === 0);
  }
  ok("a million doors: finite", Number.isFinite(cabinetStrippingHours({ stainFinish: true, doors: 1e6, drawers: 0 }, book)) && cabinetStrippingHours({ stainFinish: true, doors: 1e6, drawers: 0 }, book) === 750000);
  for (const [label, b] of [["no book", null], ["no stripping rows", { addOns: {} }], ["junk rows", { stripping: { chemical: { hoursPerDoor: "x", hoursPerDrawer: -2 } } }], ["only sanding rows", { stripping: { sanding: { hoursPerDoor: 1 } } }]]) {
    ok(`${label}: 0 h, no NaN`, cabinetStrippingHours(kitchen, b) === 0);
  }
  ok("a company's own hours win, key by key", cabinetStrippingHours(kitchen, getPriceBook("cabinet_refinishing", { stripping: { chemical: { hoursPerDoor: 1 } } })) === 22);
  ok("…and survive the sanitiser", sanitiseRates("cabinet_refinishing", { stripping: { chemical: { hoursPerDoor: 1 } } })?.stripping?.chemical?.hoursPerDoor === 1);

  // The line.
  const line = strippingLine({ hours: 17, labourRate: 85, method: "chemical" });
  ok("17 h × $85 = $1,445, unit hour, says what it is", line.quantity === 17 && line.rate === 85 && line.amount === 1445 && line.unit === "hour" && /chemical stripper/.test(line.description) && /bare wood/.test(line.detail));
  ok("French on a French quote", /Décapage/.test(strippingLine({ hours: 2, labourRate: 85, method: "sanding", language: "fr" }).description));
  for (const r of [null, undefined, 0, -85, "abc", NaN]) {
    ok(`labour rate ${JSON.stringify(r)}: no line (never a $0 line)`, strippingLine({ hours: 17, labourRate: r }) === null);
  }
  for (const h of [0, -3, NaN, "x", null]) {
    ok(`hours ${JSON.stringify(h)}: no line`, strippingLine({ hours: h, labourRate: 85 }) === null);
  }

  // Through the cabinet lines.
  const withRate = cabinetAddOnLines({ ...kitchen, stripLabourRate: 85 }, book);
  ok("liquid + rate: the stain line ($10 × 28) and the stripping line ($1,445)", withRate.length === 2 && withRate[0].amount === 280 && withRate[1].amount === 1445, withRate);
  ok("the liquid line no longer promises the stripping it does not bill", !/Strip/.test(withRate[0].detail));
  ok("gel + rate: no stripping line", !cabinetAddOnLines({ ...kitchen, stainType: "gel", stripLabourRate: 85 }, book).some((l) => /Stripping/.test(l.description)));
  ok("gel dark → light + rate: stripping line", cabinetAddOnLines({ ...kitchen, stainType: "gel", stainDarkToLight: true, stripLabourRate: 85 }, book).some((l) => /Stripping/.test(l.description)));
  ok("no rate: no stripping line", !cabinetAddOnLines(kitchen, book).some((l) => /Stripping/.test(l.description)));
  ok("every cabinet line finite under hostile input", finite(cabinetAddOnLines({ doors: 1e6, drawers: -1, stainFinish: true, stripLabourRate: "1e3", stripMethod: {} }, book)));

  // The cost estimate counts the same hours (owed since the stain shipped).
  const plainHours = cabinetRunLabour({ doors: 20, drawers: 8 }, book).hours;
  const stainHours = cabinetRunLabour({ ...kitchen }, book);
  ok("cabinetLabour adds a stripping step of exactly the billed hours", stainHours.steps.some((s) => s.key === "stripping" && s.hours === 17) && Math.abs(stainHours.hours - plainHours - 17) < 0.011, stainHours.steps);
  ok("…none for gel", cabinetRunLabour({ ...kitchen, stainType: "gel" }, book).hours === plainHours);

  // Stairs.
  const sbook = getPriceBook("stairs");
  const sec = { ...newStairSection("Main"), treads: 13, risers: 14, handrailFt: 14, paintRisers: true };
  ok("stairs: a clear-finished staircase never needs stripping (the treads are sanded already)", !stairNeedsStripping({ ...sec, stainType: "liquid" }) && !stairNeedsStripping(sec));
  ok("stairs: painted + liquid does", stairNeedsStripping({ ...sec, existingFinish: "painted" }));
  ok("stairs: painted + gel does not", !stairNeedsStripping({ ...sec, existingFinish: "painted", stainType: "gel" }));
  ok("stairs: painted + gel + dark → light does", stairNeedsStripping({ ...sec, existingFinish: "painted", stainType: "gel", stainDarkToLight: true }));
  const painted = { ...sec, existingFinish: "painted" };
  ok("chemical: 13 × 0.5 + 14 × 0.35 + 14 × 0.15 = 13.5 h", stairStrippingHours(painted, sbook) === 13.5);
  ok("sanding: 13 × 0.3 + 14 × 0.2 + 14 × 0.1 = 8.1 h", stairStrippingHours({ ...painted, stripMethod: "sanding" }, sbook) === 8.1);
  ok("risers not ticked are not stripped: 6.5 + 2.1 = 8.6 h", stairStrippingHours({ ...painted, paintRisers: false }, sbook) === 8.6);
  ok("hostile counts: 0 h", stairStrippingHours({ ...painted, treads: -3, risers: "x", handrailFt: NaN }, sbook) === 0);
  const lines = buildTradeLineItems("stairs", { sections: [painted], stripLabourRate: 70 }, null, { language: "en" });
  const strip = lines.find((l) => /Stripping/.test(l.description));
  ok("the staircase carries its own stripping line, named for it: 13.5 h × $70 = $945", strip && strip.description.startsWith("Main — ") && strip.amount === 945, lines);
  ok("no rate on the takeoff: no stripping line", !buildTradeLineItems("stairs", { sections: [painted] }, null, {}).some((l) => /Stripping/.test(l.description)));
  ok("clear finish with a rate: no stripping line", !buildTradeLineItems("stairs", { sections: [sec], stripLabourRate: 70 }, null, {}).some((l) => /Stripping/.test(l.description)));
  ok("the stair cost hours are the stripping hours", tradeLabourHours("stairs", { sections: [painted, painted] }, null) === 27 && tradeLabourHours("stairs", { sections: [sec] }, null) === 0);
  ok("the stair book carries the researched defaults", sbook.stripping.chemical.hoursPerTread === 0.5 && sbook.stripping.sanding.hoursPerRailFt === 0.1);
  // The add-on's label is what the call-to-quote model is shown (offerings.js
  // labelForPath): it may say "researched default", never the figure.
  ok("the stain add-on's label carries no money", addOnsForCategory("cabinet_refinishing").filter((a) => a.key === "stainFinish").every((a) => !/[$€£]|\d/.test(a.label)));
  ok("…nor do the stain rate-card labels", PRICE_BOOK_FIELDS.cabinet_refinishing.filter((f) => /Stain/i.test(f.path)).every((f) => !/[$€£]|\d/.test(f.label)));
  for (const trade of ["cabinet_refinishing", "stairs"]) {
    const fields = PRICE_BOOK_FIELDS[trade].filter((f) => f.path.startsWith("stripping."));
    ok(`${trade}: every stripping row is on the rate card, labelled as a researched default`, fields.length >= 4 && fields.every((f) => /researched default/.test(f.label) && f.group === "stripping"), fields.map((f) => f.label));
  }
}

/* ══ G ══ */
section("G. Wiring the labour rate");
{
  const cats = [{ id: "s", key: "stairs", label: "Stair Refinishing" }, { id: "c", key: "cabinet_refinishing", label: "Cabinet Refinishing" }];
  const cab = routedGroup(routeEstimateKind("staining", cats, "cabinets"), newScopeGroup(cats[1], "x", null, { tempId: "c", addOns: ["stainFinish"] }), { labourSellRate: 85 });
  ok("Staining → Cabinets snapshots the labour rate onto the group", cab.stripLabourRate === 85);
  const st = routedGroup(routeEstimateKind("staining", cats, "stairs"), newScopeGroup(cats[0], "x", null, { tempId: "s" }), { labourSellRate: 85 });
  ok("Staining → Stairs snapshots it onto the takeoff", st.takeoff.stripLabourRate === 85);
  ok("no rate: nothing written", !("stripLabourRate" in routedGroup(routeEstimateKind("staining", cats, "cabinets"), newScopeGroup(cats[1], "x", null, { tempId: "c" }), { labourSellRate: 0 })));
  // A group that arrived without the snapshot (a phone-call draft) takes it.
  const draft = { categoryKey: "cabinet_refinishing", stainFinish: true, intakeValues: {} };
  ok("withStripLabourRate: a stain group without a rate takes the company's", withStripLabourRate(draft, 90).stripLabourRate === 90);
  ok("…one that has a rate keeps it (the snapshot holds)", withStripLabourRate({ ...draft, stripLabourRate: 70 }, 90).stripLabourRate === 70);
  ok("…gel (no stripping) is returned untouched, same object", withStripLabourRate({ ...draft, stainType: "gel" }, 90).stripLabourRate === undefined);
  const same = { ...draft };
  ok("…no rate, no change (same object)", withStripLabourRate(same, null) === same && withStripLabourRate(same, -5) === same);
  ok("…a saved group is never touched", withStripLabourRate({ ...draft, persisted: true }, 90).stripLabourRate === undefined);
  const paintedStair = { categoryKey: "stairs", takeoff: { sections: [{ ...newStairSection("A"), treads: 3, existingFinish: "painted" }] } };
  ok("…a painted stair takeoff takes it on the takeoff", withStripLabourRate(paintedStair, 90).takeoff.stripLabourRate === 90);
  const clearStair = { categoryKey: "stairs", takeoff: { sections: [newStairSection("A")] } };
  ok("…a clear-finished stair is untouched", withStripLabourRate(clearStair, 90) === clearStair);
  ok("the builder runs it over every open group", /withStripLabourRate\(g, labourSellRate\)/.test(src("app/components/quotes/builder/QuoteBuilder.js")));
  const answers = withCabinetAnswers({ categoryKey: "cabinet_refinishing", intakeValues: {}, stainFinish: true, stripMethod: "sanding", stainDarkToLight: true });
  ok("the method and the dark → light answer are saved for the cost estimate", answers.stripMethod === "sanding" && answers.stainDarkToLight === true);
  const route = src("app/api/settings/business-info/route.js");
  ok("business-info sends labourSellRate only to a member who may see money", /canSeeMoney\(full\)/.test(route) && /labourSellRate: true/.test(route));
  const qb = src("app/components/quotes/builder/QuoteBuilder.js");
  ok("the builder reads it and hands it to both calculators", /labourSellRate: businessInfo\?\.labourSellRate/.test(qb) && (qb.match(/labourSellRate=\{labourSellRate\}/g) || []).length >= 2);
  ok("the live cost panel reads the cabinet answers", /intakeValues: withCabinetAnswers\(g\)/.test(qb));
  const upf = src("app/components/quotes/builder/UnitPricingFields.js");
  ok("cabinets: the stripping panel, the unpriced warning and the link to set the rate", /data-stripping\b/.test(upf) && /data-stripping-unpriced/.test(upf) && /\/app\/settings\/field-work/.test(upf));
  const tt = src("app/components/quotes/builder/TradeTakeoff.js");
  ok("stairs: the existing-finish select, the stripping panel and the warning", /data-stair-existing-finish/.test(tt) && /data-stair-stripping/.test(tt) && /data-stripping-unpriced/.test(tt));
  const keys = ["app.stain.darkToLight", "app.stain.stripTitle", "app.stain.stripChemical", "app.stain.stripSanding", "app.stain.hours", "app.stain.stripLine", "app.stain.stripNoRate", "app.stain.stripSetRate", "app.stain.stripDefaults", "app.stain.stripDefaultsStairs", "app.stain.noStrip", "app.stain.existingFinish", "app.stain.existingClear", "app.stain.existingPainted"];
  for (const lang of Object.keys(APP_MESSAGES)) {
    ok(`${lang}: every stripping string`, keys.every((k) => typeof APP_MESSAGES[lang][k] === "string" && APP_MESSAGES[lang][k].length > 0), keys.filter((k) => !APP_MESSAGES[lang][k]));
    ok(`${lang}: placeholders kept`, ["{hours}", "{rate}", "{amount}"].every((p) => APP_MESSAGES[lang]["app.stain.stripLine"].includes(p)));
  }
}

console.log(`\ncheck-stain-finish: ${pass} passed, ${fails.length} failed`);
if (fails.length) {
  console.error(fails.map((f) => `  ✗ ${f}`).join("\n"));
  process.exit(1);
}
