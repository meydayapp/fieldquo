// scripts/check-production-rates.mjs
//
//   npm run check:production-rates
//
// Service production rates (lib/services/productionRates.js) and the quote
// builder's Services tab (lib/quotes/servicesTab.js), executed:
//
//   A. The sanitiser against hostile input — what a Product row may store.
//   B. The hours maths: units per hour, per day, hours per unit; zero, none,
//      negative; rounding; exact multiplication for "h per unit".
//   C. A group's services: which quantity a rate is applied to (the run's own
//      line, else the group's measurement, else nothing), material lines
//      skipped, unrated services listed with no hours.
//   D. Precedence over the trade's own hours — the book's takeoff hours and a
//      recipe's labour — on the saved costing (quoteCostSummary), the
//      builder's estimate (estimateQuoteCost) and the job plan (planFromQuote),
//      with materials and the plan's dependency edges untouched.
//   E. The server path: resolveCostingGroups against the db stub — this
//      company's rows only, no query without a template run.
//   F. Nothing changes without a rate: md5 of the cost summary, the builder's
//      estimate, the plan and the save payload, pinned to their values taken
//      on origin/main (ef759bb1) BEFORE any of this existed.
//   G. The Services tab's redaction: no cost keys without jobCosting, no price
//      without showPricing — absent, not null.
//   H. Wiring, read from source: the tab is in DocumentBuilder's TABS, the
//      rates route returns no price column, every string is in 9 languages.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fixtureGroups, costingGroups, fixtureQuote } from "./productionRateFixtures.mjs";
import {
  sanitiseProduction,
  unitsPerHour,
  hoursFor,
  defaultProductionKey,
  productionKeysFor,
  suggestedProduction,
  SUGGESTED_PRODUCTION,
  productionMapFrom,
  productIdsInGroups,
  groupProduction,
  groupProductionHours,
  tradeOfSeedKey,
  CREW_DAY_HOURS,
} from "@/lib/services/productionRates";
import { MEASUREMENT_KEYS } from "@/lib/services/measurementKeys";
import { quoteCostSummary } from "@/lib/costing/quoteCosting";
import { estimateQuoteCost } from "@/lib/costing/estimateJobCost";
import { tradeLabourHours } from "@/lib/pricing/tradeScope";
import { planFromQuote } from "@/lib/jobs/plan";
import { scopeGroupPayload } from "@/lib/quotes/builderPayload";
import { servicesTabModel } from "@/lib/quotes/servicesTab";
import { resolveCostingGroups } from "@/app/api/quotes/costingWrite";
import { rows as dbRows, reads as dbReads, resetDbStub } from "./fixtures/dbStub.mjs";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

let passed = 0;
const failures = [];
function ok(name, cond, detail) {
  if (!cond) {
    failures.push(name);
    console.error(`  FAIL ${name}${detail !== undefined ? `\n       ${detail}` : ""}`);
    return;
  }
  passed += 1;
  console.log(`  ok   ${name}`);
}
const eq = (name, actual, expected) => ok(name, JSON.stringify(actual) === JSON.stringify(expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
const section = (t) => console.log(`\n${t}\n`);
const md5 = (o) => createHash("md5").update(JSON.stringify(o)).digest("hex");
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// ═══════════════════════════════════════════════════════════════════════════
section("A. What a Product row may store — sanitiseProduction");

eq("a clean per-hour rate", sanitiseProduction({ key: "wallSqft", amount: 250, basis: "per_hour" }), { key: "wallSqft", amount: 250, basis: "per_hour" });
eq("a string amount is read as a number", sanitiseProduction({ key: "doorCount", amount: "12", basis: "per_day" }), { key: "doorCount", amount: 12, basis: "per_day" });
eq("an unknown basis falls to per_hour", sanitiseProduction({ key: "treads", amount: 1.5, basis: "per_fortnight" }), { key: "treads", amount: 1.5, basis: "per_hour" });
eq("amount rounded to three places", sanitiseProduction({ key: "gutterFt", amount: 15.12345 }).amount, 15.123);
eq("a Prisma Decimal-like amount", sanitiseProduction({ key: "gutterFt", amount: { toNumber: () => 15 } }).amount, 15);
for (const [label, input] of [
  ["null", null],
  ["an array", [{ key: "wallSqft", amount: 250 }]],
  ["a string", "250"],
  ["no key", { amount: 250 }],
  ["an unregistered key", { key: "doorsPainted", amount: 12 }],
  ["a prototype key", { key: "constructor", amount: 12 }],
  ["an hour-unit key (hours per hour is not a rate)", { key: "hours", amount: 8 }],
  ["rewire hours", { key: "totalHours", amount: 8 }],
  ["zero", { key: "wallSqft", amount: 0 }],
  ["negative", { key: "wallSqft", amount: -250 }],
  ["NaN", { key: "wallSqft", amount: "abc" }],
  ["Infinity", { key: "wallSqft", amount: Infinity }],
  ["absurd", { key: "wallSqft", amount: 1e9 }],
  ["rounds to zero", { key: "wallSqft", amount: 0.0001 }],
  ["a boolean amount", { key: "wallSqft", amount: true }],
]) {
  eq(`refused: ${label}`, sanitiseProduction(input), null);
}
eq("the default key is the template's first labour line's", defaultProductionKey({ templateLines: [{ kind: "material", measurementKey: "drywallSheets" }, { kind: "labour", measurementKey: "wallSqft" }] }), "wallSqft");
eq("else any line's allowed key", defaultProductionKey({ templateLines: [{ kind: "material", measurementKey: "drywallSheets" }] }), "drywallSheets");
eq("an hour-unit key is never the default", defaultProductionKey({ templateLines: [{ kind: "labour", measurementKey: "hours" }] }), null);
eq("no template, no default", defaultProductionKey({}), null);
ok("the picker never offers an hour-unit key", productionKeysFor("roofing_service").every((k) => MEASUREMENT_KEYS[k].unit !== "hour"));
eq("the picker lists the trade's own keys first", productionKeysFor("stairs").slice(0, 3), ["steps", "treads", "risers"]);
eq("a seeded row's trade", tradeOfSeedKey("fq.cabinet_refinishing.kitchen.full_refinish"), "cabinet_refinishing");
eq("no trade off junk", tradeOfSeedKey("../../etc"), null);

// Suggestions: shown, never applied.
eq("suggested: painting walls", suggestedProduction("interior_painting", "wallSqft"), { key: "wallSqft", amount: 250, basis: "per_hour" });
eq("suggested: cabinet doors", suggestedProduction(["cabinet_refinishing"], "doorCount"), { key: "doorCount", amount: 12, basis: "per_day" });
eq("suggested: stair treads", suggestedProduction("stairs", "treads"), { key: "treads", amount: 1.5, basis: "hours_per_unit" });
eq("no suggestion for an untracked pair", suggestedProduction("plumbing", "each"), null);
eq("the first linked trade with a suggestion wins", suggestedProduction(["plumbing", "fence_services"], "edgingFt").amount, 5);
for (const [trade, byKey] of Object.entries(SUGGESTED_PRODUCTION)) {
  for (const [key, s] of Object.entries(byKey)) ok(`every suggestion sanitises: ${trade}.${key}`, sanitiseProduction({ key, ...s }) !== null);
}
// Every place a suggestion could leak into a stored value: the sanitiser
// never invents one, and the product map ignores a row without a rate.
eq("an empty rate stays empty (no suggestion filled in)", sanitiseProduction({ key: "wallSqft", amount: "" }), null);
eq("a row without a rate is not in the map", [...productionMapFrom([{ id: "p1", name: "Walls", production: null }, { id: "p2", production: { key: "wallSqft", amount: 250 } }]).keys()], ["p2"]);

// ═══════════════════════════════════════════════════════════════════════════
section("B. The hours maths");

const walls = { key: "wallSqft", amount: 250, basis: "per_hour" };
const doors = { key: "doorCount", amount: 12, basis: "per_day" };
const treads = { key: "treads", amount: 1.5, basis: "hours_per_unit" };
eq("250 sq ft/hr × 1,000 sq ft = 4 h", hoursFor(walls, 1000), 4);
eq("12 doors/day × 24 doors = 2 days = 16 h", hoursFor(doors, 24), 16);
eq(`a crew-day is ${CREW_DAY_HOURS} h`, CREW_DAY_HOURS, 8);
eq("1.5 h/tread × 14 treads = 21 h exactly", hoursFor(treads, 14), 21);
eq("1.1 h/tread × 3 = 3.3 (multiplied, not divided by a reciprocal)", hoursFor({ key: "treads", amount: 1.1, basis: "hours_per_unit" }, 3), 3.3);
eq("units per hour: per_hour", unitsPerHour(walls), 250);
eq("units per hour: per_day", unitsPerHour(doors), 1.5);
ok("units per hour: hours per unit", Math.abs(unitsPerHour(treads) - 1 / 1.5) < 1e-12);
eq("rounded to the hundredth: 100 sq ft at 300/hr", hoursFor({ key: "wallSqft", amount: 300 }, 100), 0.33);
eq("rounded: 1 door at 12/day = 0.67 h", hoursFor(doors, 1), 0.67);
eq("rounded: 1,000 at 3/hr = 333.33", hoursFor({ key: "wallSqft", amount: 3 }, 1000), 333.33);
eq("zero units is zero hours (a measured none)", hoursFor(walls, 0), 0);
eq("no quantity is no hours", hoursFor(walls, null), null);
eq("an empty-string quantity is no hours", hoursFor(walls, ""), null);
eq("a negative quantity is no hours", hoursFor(walls, -5), null);
eq("a NaN quantity is no hours", hoursFor(walls, "lots"), null);
eq("no rate is no hours", hoursFor(null, 1000), null);
eq("a refused rate is no hours", hoursFor({ key: "hours", amount: 8 }, 1000), null);
eq("a string quantity from a stored line", hoursFor(walls, "500"), 2);

// ═══════════════════════════════════════════════════════════════════════════
section("C. A group's services and the quantity each rate is applied to");

const RATES = [
  { id: "prod-siding", name: "Vinyl siding", production: { key: "wallSqft", amount: 40, basis: "per_hour" } },
  { id: "prod-fence", name: "Cedar privacy fence", production: { key: "edgingFt", amount: 5, basis: "per_hour" } },
  // prod-wh (the water heater) has no rate, on purpose.
];
const rateMap = productionMapFrom(RATES);
const G = () => Object.fromEntries(fixtureGroups().map((g) => [g.tempId, g]));

const siding = groupProduction(G()["g-siding"], rateMap);
eq("siding: one service, rated", siding.services.length, 1);
eq("siding: quantity from the run's own labour line", [siding.services[0].quantity, siding.services[0].quantitySource], [1000, "line"]);
eq("siding: 1,000 sq ft ÷ 40/hr = 25 h", siding.hours, 25);
eq("the unit is the key's unit", siding.services[0].unit, "sqft");
eq("siding: hours pinned to the labour line (index 2)", siding.services[0].anchorIndex, 2);

const fence = groupProduction(G()["g-fence"], rateMap);
eq("fence: 120 ft ÷ 5/hr = 24 h", fence.hours, 24);
{
  const g = G()["g-fence"];
  g.lineItems[1] = { ...g.lineItems[1], quantity: 0 };
  const r = groupProduction(g, rateMap);
  eq("a 0 line falls to the group's measured figure (the intake's 120 ft)", [r.services[0].quantity, r.services[0].quantitySource, r.hours], [120, "measured", 24]);
  g.intakeValues = {};
  const none = groupProduction(g, rateMap);
  eq("no line quantity and no measurement: listed, no hours", [none.services[0].quantity, none.services[0].hours, none.hours, none.rated], [null, null, null, true]);
}
{
  const g = G()["g-fence"];
  g.lineItems[1] = { ...g.lineItems[1], quantity: 150 };
  eq("a quantity the estimator typed over the takeoff is the one used", groupProduction(g, rateMap).hours, 30);
}
{
  // A material line keyed to the rate's key carries waste and coverage —
  // 13 sheets is not 416 sq ft of work — so it is never the quantity.
  const g = G()["g-siding"];
  g.lineItems = g.lineItems.filter((l) => l.meta?.template?.lineKind !== "labour");
  g.lineItems.push({ description: "Siding panels", quantity: 1100, meta: { template: { runId: "run-siding", productId: "prod-siding", lineKind: "material", measurementKey: "wallSqft" } } });
  const r = groupProduction(g, rateMap);
  eq("a material line is skipped; the siding takeoff's 1,000 sq ft is used", [r.services[0].quantity, r.services[0].quantitySource, r.hours], [1000, "measured", 25]);
}
const plumb = groupProduction(G()["g-plumb"], rateMap);
eq("an unrated service is listed with no rate and no hours", [plumb.services.length, plumb.services[0].production, plumb.services[0].hours, plumb.rated, plumb.hours], [1, null, null, false, null]);
eq("a group with no template run has no services", groupProduction(G()["g-paint"], rateMap), { services: [], hours: null, rated: false });
{
  const g = G()["g-fence"];
  const second = g.lineItems.map((l) => ({ ...l, meta: { template: { ...l.meta.template, runId: "run-fence-2" } } }));
  g.lineItems = [...g.lineItems, ...second];
  eq("two runs of a rated service: hours summed", groupProduction(g, rateMap).hours, 48);
}
eq("the product ids a server has to look up", productIdsInGroups(fixtureGroups()).sort(), ["prod-fence", "prod-siding", "prod-wh"]);
eq("hostile groups: nothing", [groupProduction(null, rateMap).hours, groupProduction({ lineItems: "x" }, rateMap).hours, groupProduction({ lineItems: [null, 7, { meta: { template: "x" } }] }, rateMap).hours], [null, null, null]);
eq("no map: nothing rated", groupProduction(G()["g-siding"], null).rated, false);

// ═══════════════════════════════════════════════════════════════════════════
section("D. Precedence over the trade's own hours");

// As resolveCostingGroups hands them to quoteCostSummary.
const ratedCosting = () => {
  const groups = fixtureGroups();
  return costingGroups(groups).map((cg, i) => {
    const h = groupProductionHours(groups[i], rateMap);
    return h === null ? cg : { ...cg, productionHours: h };
  });
};
const base = quoteCostSummary({ scopeGroups: costingGroups(), crew: [], labourRate: 35, overheadPct: 10, price: 25000, addedLabourHours: 3 });
const rated = quoteCostSummary({ scopeGroups: ratedCosting(), crew: [], labourRate: 35, overheadPct: 10, price: 25000, addedLabourHours: 3 });
const byId = (s) => Object.fromEntries(s.groups.map((g) => [g.tempId, g]));
eq("without rates: siding is the book's 1,000 × 0.032 = 32 h", byId(base)["g-siding"].labourHours, 32);
eq("with a rate: siding is the service's 25 h, not 32 and not 57", byId(rated)["g-siding"].labourHours, 25);
eq("fence (no book hours) gains its service's 24 h", byId(rated)["g-fence"].labourHours, 24);
eq("paint (no rated service) keeps the takeoff's hours", byId(rated)["g-paint"].labourHours, byId(base)["g-paint"].labourHours);
eq("cabinets (no rated service) keep the recipe's hours", byId(rated)["g-cab"].labourHours, byId(base)["g-cab"].labourHours);
eq("headline hours = base − 32 + 25 + 24", rated.labourHours, Math.round((base.labourHours - 32 + 25 + 24) * 100) / 100);
eq("the takeoff pool no longer carries siding's book hours", rated.takeoffHours, Math.round((base.takeoffHours - 32) * 100) / 100);
eq("labour cost follows at the fallback $35/h", Math.round((rated.labourCost - base.labourCost) * 100) / 100, Math.round((25 - 32 + 24) * 35 * 100) / 100);
eq("materials are untouched by a rate", rated.materialTotal, base.materialTotal);
{
  // A crew: the rated hours join the pool the crew's blended rate prices.
  const crew = [{ id: "u1", name: "A", rate: 30 }, { id: "u2", name: "B", rate: 42 }];
  const c0 = quoteCostSummary({ scopeGroups: costingGroups(), crew, labourRate: 35, price: 25000 });
  const c1 = quoteCostSummary({ scopeGroups: ratedCosting(), crew, labourRate: 35, price: 25000 });
  eq("with a crew, the pool moves by the same hours", Math.round((c1.labourHours - c0.labourHours) * 100) / 100, 17);
  eq("… priced at the crew's blended rate ($36/h)", Math.round((c1.labourCost - c0.labourCost) * 100) / 100, 17 * 36);
}
{
  // A recipe trade: a cabinet refinisher's 12 doors/day replaces the
  // recipe's labour, keeps the recipe's materials.
  const groups = fixtureGroups();
  const cab = groups.find((g) => g.tempId === "g-cab");
  cab.lineItems.push({ description: "Refinish doors (template)", quantity: 24, meta: { template: { runId: "run-cab", productId: "prod-cab", lineKind: "labour", measurementKey: "doorCount" } } });
  const cabMap = productionMapFrom([{ id: "prod-cab", production: { key: "doorCount", amount: 12, basis: "per_day" } }]);
  const h = groupProductionHours(cab, cabMap);
  eq("24 doors at 12/day = 16 h", h, 16);
  const cg = costingGroups(groups).map((g) => (g.tempId === "g-cab" ? { ...g, productionHours: h } : g));
  const s = quoteCostSummary({ scopeGroups: cg, crew: [], labourRate: 35, price: 25000 });
  const s0 = quoteCostSummary({ scopeGroups: costingGroups(), crew: [], labourRate: 35, price: 25000 });
  eq("the recipe's 33.69 h are replaced by 16", [byId(s0)["g-cab"].labourHours, byId(s)["g-cab"].labourHours], [33.69, 16]);
  eq("the recipe's materials stay", byId(s)["g-cab"].materialTotal, byId(s0)["g-cab"].materialTotal);
  const est = estimateQuoteCost({ scopeGroups: cg, labourRatePerHour: 35, price: 25000 });
  const cabEst = est.groups.find((g) => g.tempId === "g-cab");
  eq("builder estimate: one labour row, marked production", cabEst.labourBreakdown.map((l) => [l.source, l.hours, l.cost]), [["production", 16, 560]]);
}
{
  // The builder's own path: estimateQuoteCost with productionHours on the
  // group and that group's book hours left out of manualLabourHours.
  const groups = fixtureGroups();
  const hours = new Map(groups.map((g) => [g.tempId, groupProductionHours(g, rateMap)]));
  const tl = groups.reduce((s, g) => s + (g.takeoff && hours.get(g.tempId) === null ? tradeLabourHours(g.categoryKey, g.takeoff, null) : 0), 0);
  const est = estimateQuoteCost({
    scopeGroups: groups.map((g) => ({ ...g, rateOverrides: null, ...(hours.get(g.tempId) !== null ? { productionHours: hours.get(g.tempId) } : {}) })),
    labourRatePerHour: 35,
    manualLabourHours: tl + 3,
    price: 25000,
    overheadPctOfPrice: 10,
  });
  eq("builder and saved costing agree on the hours", est.labourHours, rated.labourHours);
  eq("builder and saved costing agree on labour cost", est.labourCost, rated.labourCost);
  eq("a zero-hour rated group is still rated (a measured none)", estimateQuoteCost({ scopeGroups: [{ tempId: "z", categoryKey: "plumbing", productionHours: 0 }] }).groups.map((g) => g.labourHours), [0]);
  for (const junk of [null, undefined, "", -4, "x", true, NaN]) {
    eq(`productionHours ${String(junk)} is no rate`, estimateQuoteCost({ scopeGroups: [{ tempId: "z", categoryKey: "plumbing", productionHours: junk }] }).groups.length, 0);
  }
}
{
  // The job plan: the service's hours on its own line, the book's per-line
  // hours withheld for that group, every other group as before, and the
  // painting dependency edges untouched.
  const plain = planFromQuote(fixtureQuote());
  const withRates = planFromQuote(fixtureQuote(), { productionById: rateMap });
  const byTitle = (p) => Object.fromEntries(p.specs.map((s) => [s.title, s.estimatedHours]));
  eq("plan: the siding service's line carries 25 h", byTitle(withRates)["Hang vinyl siding"], 25);
  eq("plan: the fence service's line carries 24 h", byTitle(withRates)["Build fence"], 24);
  eq("plan: the rest of the siding group carries none", [byTitle(withRates)["Vinyl siding — supply and install"], byTitle(withRates)["Siding install"]], [null, null]);
  eq("plan: the painting group is exactly as before", withRates.specs.filter((s) => s.categoryKey === "interior_painting"), plain.specs.filter((s) => s.categoryKey === "interior_painting"));
  eq("plan: the dependency edges are unchanged", withRates.edges, plain.edges);
  eq("plan: the unrated water heater carries none", byTitle(withRates)["Remove and install tank"], null);
  const planHours = withRates.specs.filter((s) => ["Hang vinyl siding", "Build fence"].includes(s.title)).reduce((a, s) => a + s.estimatedHours, 0);
  eq("plan hours for the rated groups = the costing's", planHours, byId(rated)["g-siding"].labourHours + byId(rated)["g-fence"].labourHours);
  // A painting group WITH a rated service: its hours are the service's, and
  // its lines keep their substrate keys (so the order a painter works in
  // survives whoever supplied the hours).
  const q = fixtureQuote();
  const paint = q.scopeGroups[0];
  paint.lineItems.push({ description: "Walls — house rate", quantity: 0, meta: { template: { runId: "run-paint", productId: "prod-paint", lineKind: "labour", measurementKey: "wallSqft" } } });
  const paintMap = productionMapFrom([{ id: "prod-paint", production: { key: "wallSqft", amount: 250, basis: "per_hour" } }]);
  const p = planFromQuote(q, { productionById: paintMap });
  const paintSpecs = p.specs.filter((s) => s.categoryKey === "interior_painting");
  const wallsMeasured = groupProduction({ ...paint, categoryKey: "interior_painting" }, paintMap).services[0];
  eq("painting + rated service: the group's hours are the service's (walls ÷ 250)", paintSpecs.reduce((a, s) => a + (s.estimatedHours || 0), 0), wallsMeasured.hours);
  ok("… measured off the takeoff's wall area", wallsMeasured.quantitySource === "measured" && wallsMeasured.quantity > 0, JSON.stringify(wallsMeasured));
  eq("… and the substrate keys and edges survive", [paintSpecs.map((s) => s.takeoffKey).slice(0, 7), p.edges], [plain.specs.filter((s) => s.categoryKey === "interior_painting").map((s) => s.takeoffKey).slice(0, 7), plain.edges]);
}

{
  // ensurePlanForJob end to end over a small fake Prisma: the rows it writes
  // carry the service's hours, it reads only this company's products, and a
  // failed product read still builds the plan (with the book's hours).
  const makeDb = ({ products = [], productThrows = false } = {}) => {
    const created = [];
    const productWheres = [];
    const quote = fixtureQuote();
    const prisma = {
      job: { findUnique: async () => ({ id: "j1", companyId: "co1", clientId: "c1", quoteId: quote.id, historicalImportedAt: null, quote: { ...quote, companyId: "co1", clientId: "c1" } }) },
      companyServiceCategory: { findMany: async () => [] },
      product: {
        findMany: async ({ where }) => {
          productWheres.push(where);
          if (productThrows) throw new Error("boom");
          return products.filter((p) => p.companyId === where.companyId && where.id.in.includes(p.id));
        },
      },
      task: {
        findMany: async () => [],
        create: async ({ data }) => {
          created.push(data);
          return { id: `t${created.length}`, sourceKey: data.sourceKey, sortOrder: data.sortOrder };
        },
      },
      taskDependency: { createMany: async ({ data }) => ({ count: data.length }) },
    };
    return { prisma, created, productWheres };
  };
  const { ensurePlanForJob } = await import("@/lib/jobs/buildPlan");
  const a = makeDb({ products: [{ id: "prod-siding", companyId: "co1", name: "Vinyl siding", production: { key: "wallSqft", amount: 40 } }, { id: "prod-fence", companyId: "co-other", production: { key: "edgingFt", amount: 1 } }] });
  const res = await ensurePlanForJob("j1", { byUserId: "u1", db: a.prisma });
  const hoursByTitle = Object.fromEntries(a.created.map((d) => [d.title, d.estimatedHours]));
  eq("buildPlan: the plan is built", res.ok, true);
  eq("buildPlan: the siding step carries the service's 25 h", hoursByTitle["Hang vinyl siding"], 25);
  eq("buildPlan: another tenant's fence rate is not read", hoursByTitle["Build fence"], null);
  eq("buildPlan: products read for this company only", a.productWheres.map((w) => w.companyId), ["co1"]);
  const b = makeDb({ productThrows: true });
  const res2 = await ensurePlanForJob("j1", { byUserId: "u1", db: b.prisma });
  eq("buildPlan: a failed rate read still builds the plan", [res2.ok, b.created.length > 0], [true, true]);
  eq("buildPlan: … with the book's hours (none on the siding line)", Object.fromEntries(b.created.map((d) => [d.title, d.estimatedHours]))["Hang vinyl siding"], null);
}

// ═══════════════════════════════════════════════════════════════════════════
section("E. The server path — resolveCostingGroups against the db stub");

{
  resetDbStub();
  dbRows.serviceCategory = fixtureGroups().map((g) => ({ id: g.categoryId, key: g.categoryKey }));
  dbRows.companyServiceCategory = [];
  dbRows.product = [
    { id: "prod-siding", companyId: "co1", name: "Vinyl siding", production: { key: "wallSqft", amount: 40, basis: "per_hour" } },
    // Another tenant's row with the SAME id as a line on this quote names
    // must not price it — the where carries companyId.
    { id: "prod-fence", companyId: "co-other", name: "Their fence", production: { key: "edgingFt", amount: 1, basis: "per_hour" } },
  ];
  const stored = fixtureGroups().map(({ tempId, categoryKey, category, ...g }) => g);
  const resolved = await resolveCostingGroups("co1", stored);
  const r = Object.fromEntries(resolved.map((g) => [g.tempId, g]));
  eq("siding resolved with its 25 h", r["g-siding"].productionHours, 25);
  ok("another tenant's rate never prices this quote", !("productionHours" in r["g-fence"]), JSON.stringify(r["g-fence"]));
  ok("an unrated group is the object it always was (no key at all)", !("productionHours" in r["g-paint"]) && !("productionHours" in r["g-plumb"]));
  const productReads = dbReads.filter((x) => x.model === "product");
  eq("one product read, scoped to the company", productReads.map((x) => x.args.where.companyId), ["co1"]);
  ok("… selecting no price column", productReads.every((x) => !("unitPrice" in (x.args.select || {})) && !("costPrice" in (x.args.select || {}))));

  resetDbStub();
  dbRows.serviceCategory = fixtureGroups().map((g) => ({ id: g.categoryId, key: g.categoryKey }));
  dbRows.companyServiceCategory = [];
  const noRuns = stored.map((g) => ({ ...g, lineItems: (g.lineItems || []).filter((l) => !l.meta) }));
  await resolveCostingGroups("co1", noRuns);
  eq("no template run, no product query", dbReads.filter((x) => x.model === "product").length, 0);
}

// ═══════════════════════════════════════════════════════════════════════════
section("F. Nothing changes without a rate — md5 pinned on origin/main (ef759bb1)");

// Taken by running these exact fixtures through the same calls on ef759bb1,
// before lib/services/productionRates.js existed.
const PINNED = {
  summary: "e30e0cc4d3781d985d7bf0c0ce4d2fac",
  crewSummary: "6065c44c72bca726de855b0bb961ac34",
  builder: "86af96ab4825b0d37833a517b1ef5e1d",
  plan: "5a7e06e6c2aa5ae96c36abd1d2f5b244",
  payloads: "9ae33337e53495d61fed208ae3152f90",
};
const crewFix = [{ id: "u1", name: "A", rate: 30 }, { id: "u2", name: "B", rate: 42, hours: 10 }];
const builderEstimate = (groups, hoursOf = () => null) => {
  const tl = groups.reduce((s, g) => s + (g.takeoff && hoursOf(g) === null ? tradeLabourHours(g.categoryKey, g.takeoff, null) : 0), 0);
  return estimateQuoteCost({
    scopeGroups: groups.map((g) => ({ ...g, rateOverrides: null, ...(hoursOf(g) !== null ? { productionHours: hoursOf(g) } : {}) })),
    labourRatePerHour: 35, crew: [], manualLabourHours: tl + 2, manualMaterialCost: 0, price: 25000, overheadPerJob: null,
    overheadPctOfPrice: 10, purchasedMaterialCost: 0, marginTargetPct: 30, recipeOverridesByCategory: {}, lineItemCost: 0,
  });
};
// Three ways of having "no rate": no map at all, an empty map, and a map
// whose rates belong to services this quote does not carry.
const unrelated = productionMapFrom([{ id: "prod-elsewhere", production: { key: "wallSqft", amount: 250 } }]);
for (const [label, map] of [["no map", null], ["an empty map", new Map()], ["rates for other services only", unrelated]]) {
  const groups = fixtureGroups();
  const hoursOf = (g) => (map ? groupProductionHours(g, map) : null);
  const cg = costingGroups(groups).map((c, i) => (hoursOf(groups[i]) === null ? c : { ...c, productionHours: hoursOf(groups[i]) }));
  eq(`${label}: cost summary md5`, md5(quoteCostSummary({ scopeGroups: cg, crew: [], labourRate: 35, overheadPct: 10, price: 25000, addedLabourHours: 3 })), PINNED.summary);
  eq(`${label}: cost summary with a crew md5`, md5(quoteCostSummary({ scopeGroups: cg, crew: crewFix, labourRate: 35, overheadPct: 10, price: 25000 })), PINNED.crewSummary);
  eq(`${label}: builder estimate md5`, md5(builderEstimate(groups, hoursOf)), PINNED.builder);
  eq(`${label}: job plan md5`, md5(map ? planFromQuote(fixtureQuote(), { productionById: map }) : planFromQuote(fixtureQuote())), PINNED.plan);
}
// A rate never touches what the quote SAVES — the lines, their quantities
// and amounts are the estimator's; only hours and cost are derived.
eq("the save payload md5 (rates or none)", md5(fixtureGroups().map((g) => scopeGroupPayload(g, null, "en"))), PINNED.payloads);

// ═══════════════════════════════════════════════════════════════════════════
section("G. The Services tab — figures and redaction");

{
  const groups = fixtureGroups();
  const productionByGroup = new Map(groups.map((g) => [g.tempId, groupProduction(g, rateMap)]));
  const hoursOf = (g) => productionByGroup.get(g.tempId)?.hours ?? null;
  const estimate = builderEstimate(groups, hoursOf);
  const args = {
    groups,
    productionByGroup,
    estimate,
    tradeHoursOf: (g) => (g.takeoff ? tradeLabourHours(g.categoryKey, g.takeoff, null) : 0),
    priceOf: (g) => g.lineItems.reduce((s, l) => s + (Number(l.amount) || 0), 0),
    lineCostOf: (g) => g.lineItems.reduce((s, l) => s + (Number(l.unitCost) || 0) * (Number(l.quantity) || 0), 0),
  };
  const full = servicesTabModel({ ...args, showPricing: true, mayCost: true });
  const row = (m, id) => m.rows.find((r) => r.tempId === id);
  eq("siding row: 25 h from services, the book's 32 h named", [row(full, "g-siding").hours, row(full, "g-siding").hoursSource, row(full, "g-siding").replacedBookHours], [25, "services", 32]);
  eq("paint row: the takeoff's hours, from the trade", [row(full, "g-paint").hoursSource, row(full, "g-paint").hours], ["trade", Math.round(tradeLabourHours("interior_painting", groups[0].takeoff, null) * 100) / 100]);
  eq("cabinet row: the recipe's hours", row(full, "g-cab").hours, 33.69);
  eq("plumbing row: no hours", [row(full, "g-plumb").hours, row(full, "g-plumb").hoursSource], [0, "none"]);
  eq("labour cost = hours × the estimate's rate", row(full, "g-fence").labourCost, 24 * 35);
  eq("materials = bill + the lines' own cost (16 posts × $22)", row(full, "g-fence").materials, 352);
  eq("fence price", row(full, "g-fence").price, 5280);
  eq("fence margin before overhead", row(full, "g-fence").margin, Math.round(((5280 - 840 - 352) / 5280) * 10000) / 100);
  eq("measured quantities listed by key", row(full, "g-fence").measurements.map((m) => [m.key, m.value]), [["edgingFt", 120], ["perimeterLf", 120], ["fencePosts", 16]]);
  eq("totals: hours add up", full.totals.hours, Math.round(full.rows.reduce((s, r) => s + r.hours, 0) * 100) / 100);
  eq("a zero-price group has a null margin, not 0", servicesTabModel({ ...args, priceOf: () => 0, showPricing: true, mayCost: true }).rows[0].margin, null);
  ok("services carry no money at any level", full.rows.every((r) => r.services.every((s) => !("price" in s) && !("labourCost" in s) && !("unitPrice" in s))));

  const noCost = servicesTabModel({ ...args, showPricing: true, mayCost: false });
  ok("no jobCosting: no labourCost / materials / margin key on any row", noCost.rows.every((r) => !("labourCost" in r) && !("materials" in r) && !("margin" in r)));
  ok("no jobCosting: none on the totals", !("labourCost" in noCost.totals) && !("materials" in noCost.totals) && !("margin" in noCost.totals));
  ok("no jobCosting: price and hours stay", noCost.rows.every((r) => "price" in r && "hours" in r));

  const noPrice = servicesTabModel({ ...args, showPricing: false, mayCost: true });
  ok("no showPricing: no price or margin key on any row", noPrice.rows.every((r) => !("price" in r) && !("margin" in r)));
  ok("no showPricing: none on the totals", !("price" in noPrice.totals) && !("margin" in noPrice.totals));
  ok("no showPricing: cost and hours stay", noPrice.rows.every((r) => "labourCost" in r && "hours" in r));

  const neither = servicesTabModel({ ...args });
  ok("the default is the most redacted", neither.rows.every((r) => ["labourCost", "materials", "margin", "price"].every((k) => !(k in r))));
  ok("… and its JSON carries no money figure at all", !/"(labourCost|materials|margin|price)"/.test(JSON.stringify(neither)));
  eq("hostile input: no rows", servicesTabModel({ groups: [null, 4, "x"], mayCost: true, showPricing: true }).rows.length, 0);
}

// ═══════════════════════════════════════════════════════════════════════════
section("H. Wiring");

{
  const doc = src("app/components/quotes/builder/DocumentBuilder.js");
  ok("the Services tab is in DocumentBuilder's TABS, beside Estimate", /const TABS = \["estimate", "services", "presentation", "workorder", "notes"\]/.test(doc));
  ok("an invoice still has one tab", /const tabs = isInvoice \? \["estimate"\] : TABS/.test(doc));
  ok("the tab's actions open the Estimate tab's editors", /onOpenTakeoff=\{[\s\S]*?setTab\("estimate"\)[\s\S]*?setCalcFocus/.test(doc) && /onAddTemplate=\{[\s\S]*?setTab\("estimate"\)[\s\S]*?setLibraryFocus/.test(doc));
  const tab = src("app/components/quotes/builder/ServicesTab.js");
  ok("the tab draws money only when the model carries it", /"labourCost" in row/.test(tab) && /"price" in row/.test(tab) && /"margin" in row/.test(tab));
  ok("the tab has no input box (no second editor)", !/<input|<textarea|<select/.test(tab));
  const route = src("app/api/products/production/route.js");
  ok("the rates route selects no price column", /select: \{ id: true, name: true, production: true \}/.test(route) && !/unitPrice|costPrice|templateLines: true/.test(route.replace(/\/\/.*$/gm, "")));
  ok("the rates route is gated on quotes:view_create_edit", /requireLevel\(full, "quotes", "view_create_edit"/.test(route));
  const builder = src("app/components/quotes/builder/QuoteBuilder.js");
  ok("the builder reads the rates route", builder.includes('fetch("/api/products/production")'));
  ok("the builder leaves a rated group's book hours out of the pool", /g\.takeoff && productionHoursOf\(g\) === null/.test(builder));
  const patch = src("app/api/products/[id]/route.js");
  ok("PATCH sanitises the rate", /production: sanitiseProduction\(production\) \?\? Prisma\.DbNull/.test(patch));
  const post = src("app/api/products/route.js");
  ok("POST sanitises the rate", /sanitiseProduction\(production\)/.test(post));
  const plan = src("lib/jobs/buildPlan.js");
  ok("the job plan reads this company's rates", /prisma\.product\.findMany\(\{\s*where: \{ companyId: job\.companyId, id: \{ in: productIds \} \}/.test(plan) && /planFromQuote\(job\.quote, \{ productionById \}\)/.test(plan));
  const schema = src("prisma/schema.prisma");
  ok("Product.production is in the schema", /\n  production Json\?\n/.test(schema));
  for (const f of ["app/app/settings/services/ServiceTemplatesCard.js", "app/app/settings/products/ProductFormModal.js"]) {
    ok(`${f} edits the rate through the shared field`, src(f).includes("<ProductionRateField"));
  }
  const modal = src("app/app/settings/products/ProductFormModal.js");
  ok("the item form sends `production` only when it changed", /if \(JSON\.stringify\(production\) !== startProduction\) payload\.production = production;/.test(modal));

  // Every key the new UI asks for, in every app language.
  const used = new Set();
  for (const f of ["app/components/pricing/ProductionRateField.js", "app/components/quotes/builder/ServicesTab.js", "app/components/quotes/builder/DocumentBuilder.js", "app/components/quotes/builder/CostMarginPanel.js", "app/app/settings/services/ServiceTemplatesCard.js"]) {
    for (const m of src(f).matchAll(/t\("(app\.(?:production|servicesTab)\.[A-Za-z_]+|app\.docBuilder\.tab\.services|app\.cost\.productionRates)"/g)) used.add(m[1]);
  }
  for (const b of ["per_hour", "per_day", "hours_per_unit"]) used.add(`app.production.basis_${b}`);
  ok("the new strings were found", used.size >= 40, `${used.size}`);
  const langs = Object.keys(APP_MESSAGES);
  eq("nine app languages", langs.length, 9);
  const missing = [];
  for (const k of used) for (const l of langs) if (typeof APP_MESSAGES[l][k] !== "string" || !APP_MESSAGES[l][k]) missing.push(`${l}:${k}`);
  eq("every new string in every language", missing, []);
  const placeholders = [];
  for (const k of used) {
    const want = (APP_MESSAGES.en[k].match(/\{\w+\}/g) || []).sort().join();
    for (const l of langs) if ((APP_MESSAGES[l][k].match(/\{\w+\}/g) || []).sort().join() !== want) placeholders.push(`${l}:${k}`);
  }
  eq("every translation keeps the English placeholders", placeholders, []);
}

console.log(`\n${failures.length ? "FAILED" : "PASSED"} — ${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
