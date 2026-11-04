// scripts/check-offered-add-ons.mjs
//
// The extras a quote OFFERS the homeowner, executed against the shapes the
// product passes — lib/quotes/offeredAddOns.js, lib/quotes/builderOffers.js,
// lib/ai/quoteSuggestions.js, lib/quotes/suggestedAddOns.js.
//
// ── The two the owner reported (2026-11-02) ────────────────────────────────
//
// "add-ons that are not important for kitchen refinishing like window add-on
// counting ALL the doors and drawers as a window, and the refacing which is
// not even an add-on and even if it is it shows wrong calculation based on
// the company's pricing."
//
// Both were real and both are pinned here:
//
//   A  "Cabinet Refacing, $5,500" on Q-2026-0035/0038/0039/0040 — the same
//      figure on a three-door kitchen and a twenty-nine-door one, offered as
//      an extra on top of the refinishing that is its alternative.
//   B  "Glass Inserts (29 × door) = $2,465" on Q-2026-0039 — a feature
//      upgrade priced across every door in the kitchen.
//
//   1. The catalogue says which per-unit add-ons span the whole job.
//   2. catalogueAddOnsFor honours that, and prices everything else exactly as
//      it did before — pinned against the numbers HEAD 8a9b9772 produced.
//   3. The builder's chips say the same thing the seed writes.
//   4. A trade that is the alternative to one on the quote is not an extra.
//   5. …so the history co-occurrence never suggests it, however often the
//      two really were quoted together.
//   6. A unit-priced trade gets no median, so no offer carries a figure that
//      ignores the job's own size.
//   7. The save route refuses a reference the builder never offered.
//   8. The wiring.
//
// ── And the third, reported the next day ───────────────────────────────────
//
// "the add-ons also seems to have double hinges." Q-2026-0029 offered "New
// Hinges, $540" beside "Soft-Close Hinges (31 × door), $1,085". Two halves,
// and they are not the same KIND of fix:
//
//   9.  the structural half — a catalogue product already offered on this
//       quote covers the category it is linked to, so the same upgrade is not
//       also offered at a median. A rule, checked server-side.
//  10.  the free-text half — "New Hinges" is neither a ServiceCategory nor a
//       Product, so NOTHING in the schema says it means the hinges. That one
//       is a warning the estimator resolves, and the assertions here are
//       mostly about what it must NOT flag.
//
// Run: npm run check:offered-add-ons

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { dirname, join, resolve as resolvePath } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  STANDARD_ADDONS,
  standardAddOnUnitScope,
} from "@/app/data/standardAddOns";
import { catalogueAddOnsFor, catalogueRowName } from "@/lib/quotes/offeredAddOns";
import { builderOfferRows, offeredProductCategories } from "@/lib/quotes/builderOffers";
import { duplicateAddOnPairs, upgradeWords } from "@/lib/quotes/addOnDuplicates";
import { EXCLUSIVE_TRADES, tradeExcludedBy } from "@/lib/trades/catalog";
import {
  getSuggestedAddOns,
  getSuggestionsByCategory,
  typicalPriceByCategory,
} from "@/lib/ai/quoteSuggestions";
import { createOfferedAddOns } from "@/lib/quotes/suggestedAddOns";
import { autoAddFromReview } from "@/lib/quotes/addOnAutoAdd";
import { addOnCandidates } from "@/lib/ai/quoteReview";
import { rows, resetDbStub } from "./fixtures/dbStub.mjs";

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
const read = (p) => readFileSync(p, "utf8");
const md5 = (s) => createHash("md5").update(s).digest("hex");
const ROOT = resolvePath(dirname(new URL(import.meta.url).pathname), "..");

// The units lib/quotes/offeredAddOns.js can count off a scope group's intake.
// Spelled out rather than imported because the point of section 1 is that the
// catalogue and that map agree; importing it would assert the map against
// itself.
const COUNTABLE = ["door", "doors", "per door", "drawer", "drawers", "per drawer"];

const CAB = "cat_cab";
const REFACE = "cat_reface";
const FLOOR = "cat_floor";
const GUTTER = "cat_gutter";
const COUNTER = "cat_counter";

/** TrueFinish's seeded refinishing catalogue, plus one row it wrote itself. */
const PRODUCTS = [
  { id: "p_hinge", name: "Soft-Close Hinges", unit: "door", unitPrice: "35.00", active: true, categories: [{ id: CAB }] },
  { id: "p_slide", name: "Soft-Close Drawer Slides", unit: "drawer", unitPrice: 45, active: true, categories: [{ id: CAB }] },
  { id: "p_glass", name: "Glass Inserts", unit: "door", unitPrice: 85, active: true, categories: [{ id: CAB }] },
  { id: "p_two", name: "Two-Tone Finish", unit: "flat", unitPrice: 600, active: true, categories: [{ id: CAB }] },
  { id: "p_handle", name: "New Handles — supply & install", unit: "each", unitPrice: 12, active: true, categories: [{ id: CAB }] },
  // Typed by the company in Settings > Products & Services. Per door, and
  // FieldQuo has no idea whether it is every door or three of them.
  { id: "p_own", name: "Kitchen deep clean before spray", unit: "door", unitPrice: 20, active: true, categories: [{ id: CAB }] },
];

const kitchen = (doorCount, drawerCount = 0) => [
  { tempId: "t1", categoryId: CAB, intakeValues: { doorCount, drawerCount }, lineItems: [{ description: "Kitchen cabinets", amount: 9800 }] },
];
const priced = (groups) => catalogueAddOnsFor({ groups, products: PRODUCTS, room: 8 }).map((r) => [r.description, r.amount]);

// ───────────────────────────────────────────────────────────────────────────
section("1. The catalogue says how much of the job a per-unit add-on covers");
// ───────────────────────────────────────────────────────────────────────────

{
  const entries = Object.entries(STANDARD_ADDONS).flatMap(([cat, list]) => list.map((a) => ({ cat, ...a })));
  const countable = entries.filter((a) => COUNTABLE.includes(String(a.unit || "").trim().toLowerCase()));
  ok(`${countable.length} seeded add-ons are priced per door or per drawer`, countable.length >= 8);

  const undeclared = countable.filter((a) => a.spans !== "every" && a.spans !== "some").map((a) => `${a.cat}/${a.name}`);
  eq("every one of them declares `spans` — a new per-door add-on cannot skip the decision", undeclared, []);

  const badUnits = countable
    .filter((a) => a.spans === "some" && !(Math.floor(Number(a.typicalUnits)) > 0))
    .map((a) => `${a.cat}/${a.name}`);
  eq("a selective add-on carries a typical count", badUnits, []);

  // The lookup is by name across the whole table and takes the first hit, the
  // way standardAddOnDescription does. Two categories disagreeing about the
  // same name would make the answer depend on key order.
  const byName = new Map();
  const conflicts = [];
  for (const a of countable) {
    const sig = `${a.spans}:${a.typicalUnits ?? ""}`;
    if (byName.has(a.name) && byName.get(a.name) !== sig) conflicts.push(a.name);
    byName.set(a.name, sig);
  }
  eq("no name declares two different answers under two trades", [...new Set(conflicts)], []);

  eq(
    "the ones that go on every door, and the one that does not",
    [
      standardAddOnUnitScope("Soft-Close Hinges"),
      standardAddOnUnitScope("Soft-Close Drawer Slides"),
      standardAddOnUnitScope("New Painted MDF Doors"),
      standardAddOnUnitScope("Glass Inserts"),
    ],
    [{ spans: "every" }, { spans: "every" }, { spans: "every" }, { spans: "some", typicalUnits: 2 }],
  );
  eq(
    "a flat or uncountable add-on declares nothing, and a row the company wrote is not ours to answer for",
    [
      standardAddOnUnitScope("Two-Tone Finish"),
      standardAddOnUnitScope("Crown Moulding"),
      standardAddOnUnitScope("Kitchen deep clean before spray"),
      standardAddOnUnitScope("Glass Door Inserts"), // the seeded row, renamed
      standardAddOnUnitScope(""),
      standardAddOnUnitScope(null),
      standardAddOnUnitScope({ name: "Glass Inserts" }),
    ],
    [null, null, null, null, null, null, null],
  );
  eq("found however it is cased or spaced", standardAddOnUnitScope("  glass INSERTS "), { spans: "some", typicalUnits: 2 });
}

// ───────────────────────────────────────────────────────────────────────────
section("2. Defect B — a feature upgrade is not priced across the whole kitchen");
// ───────────────────────────────────────────────────────────────────────────

// Recorded by running HEAD 8a9b9772's own catalogueAddOnsFor against these
// fixtures, before the `spans` declaration existed. The whole-job rows must
// match it to the cent; the two that changed are the defect.
{
  eq(
    "Q-2026-0039's 29-door kitchen: hinges, slides and the flat extra unchanged",
    priced(kitchen(29, 14)).filter(([d]) => !/Glass|deep clean/.test(d)),
    [["Soft-Close Hinges (29 × door)", 1015], ["Soft-Close Drawer Slides (14 × drawer)", 630], ["Two-Tone Finish", 600]],
  );
  const glass29 = priced(kitchen(29, 14)).find(([d]) => d.startsWith("Glass Inserts"));
  eq("…and the glass inserts are two feature doors, not twenty-nine (was 29 × door = $2,465)", glass29, ["Glass Inserts (2 × door)", 170]);

  eq(
    "Q-2026-0040's 3-door kitchen: the same arithmetic on the whole-job rows",
    priced(kitchen(3, 2)).filter(([d]) => !/Glass|deep clean/.test(d)),
    [["Soft-Close Hinges (3 × door)", 105], ["Soft-Close Drawer Slides (2 × drawer)", 90], ["Two-Tone Finish", 600]],
  );
  eq("…glass inserts still two (was 3 × door = $255)", priced(kitchen(3, 2)).find(([d]) => d.startsWith("Glass Inserts")), ["Glass Inserts (2 × door)", 170]);

  eq("a one-door vanity is never offered two glass doors", priced(kitchen(1, 0)), [["Soft-Close Hinges", 35], ["Glass Inserts", 85], ["Two-Tone Finish", 600]]);

  ok(
    "a per-door product the COMPANY wrote declares nothing, so it is not offered at every door",
    !JSON.stringify(priced(kitchen(29, 14))).includes("deep clean"),
  );
  ok("…nor at any other count", !JSON.stringify([priced(kitchen(3, 2)), priced(kitchen(1, 0))]).includes("deep clean"));
  ok("an uncountable unit is still not offered", !JSON.stringify(priced(kitchen(29, 14))).includes("New Handles"));

  // Hostile intake. Only the flat row survives any of these, exactly as before.
  const FLAT_ONLY = [["Two-Tone Finish", 600]];
  eq("no intake at all", priced([{ tempId: "t1", categoryId: CAB }]), FLAT_ONLY);
  eq("a null intake", priced([{ tempId: "t1", categoryId: CAB, intakeValues: null }]), FLAT_ONLY);
  eq("an intake that is a string", priced([{ tempId: "t1", categoryId: CAB, intakeValues: "29 doors" }]), FLAT_ONLY);
  eq("a negative count", priced(kitchen(-5, -2)), FLAT_ONLY);
  eq("a count that is not a number", priced([{ tempId: "t1", categoryId: CAB, intakeValues: { doorCount: "lots", drawerCount: NaN } }]), FLAT_ONLY);
  eq("a fractional count floors, it does not round up", priced(kitchen(2.9, 0)).find(([d]) => d.startsWith("Soft-Close Hinges")), ["Soft-Close Hinges (2 × door)", 70]);

  const noUnit = [{ id: "p_x", name: "Glass Inserts", unitPrice: 85, active: true, categories: [{ id: CAB }] }];
  eq("a product with no unit at all is flat, as it always was", catalogueAddOnsFor({ groups: kitchen(29, 14), products: noUnit, room: 8 }).map((r) => [r.description, r.amount]), [["Glass Inserts", 85]]);
  eq("junk in, nothing out", catalogueAddOnsFor({ groups: null, products: "nope" }), []);
}

// ───────────────────────────────────────────────────────────────────────────
section("3. The builder's chips say what the seed writes");
// ───────────────────────────────────────────────────────────────────────────

{
  const create = builderOfferRows({ groups: kitchen(29, 14), products: PRODUCTS, history: {}, isEdit: false });
  eq(
    "create: the automatic chips carry the seeded figures, glass inserts included",
    create.byGroup.t1.auto.map((a) => [a.description, a.amount]),
    [["Soft-Close Hinges (29 × door)", 1015], ["Soft-Close Drawer Slides (14 × drawer)", 630], ["Glass Inserts (2 × door)", 170], ["Two-Tone Finish", 600]],
  );
  const edit = builderOfferRows({ groups: kitchen(29, 14), products: PRODUCTS, history: {}, existing: [], isEdit: true });
  eq(
    "edit: the buttons price the same way the seed does — one arithmetic, two screens",
    edit.byGroup.t1.offers.filter((o) => o.ref.kind === "catalog").map((o) => [o.description, o.amount]),
    [["Soft-Close Hinges (29 × door)", 1015], ["Soft-Close Drawer Slides (14 × drawer)", 630], ["Glass Inserts (2 × door)", 170], ["Two-Tone Finish", 600]],
  );
  ok("…and neither screen offers the company's own undeclared per-door row", !JSON.stringify([create, edit]).includes("deep clean"));
}

// ───────────────────────────────────────────────────────────────────────────
section("4. Defect A — a trade that is the alternative is not an extra");
// ───────────────────────────────────────────────────────────────────────────

{
  ok("the cabinet pair is declared", EXCLUSIVE_TRADES.some((p) => p.includes("cabinet_refinishing") && p.includes("cabinet_refacing")));
  ok("the table and its pairs are frozen", Object.isFrozen(EXCLUSIVE_TRADES) && EXCLUSIVE_TRADES.every(Object.isFrozen));
  eq(
    "both directions: neither is an extra on the other",
    [
      tradeExcludedBy("cabinet_refacing", ["cabinet_refinishing"]),
      tradeExcludedBy("cabinet_refinishing", ["cabinet_refacing"]),
    ],
    ["cabinet_refinishing", "cabinet_refacing"],
  );
  eq(
    "a trade that is nobody's alternative is untouched",
    [
      tradeExcludedBy("countertop", ["cabinet_refinishing"]),
      tradeExcludedBy("cabinet_refacing", ["flooring", "countertop"]),
      tradeExcludedBy("cabinet_refacing", ["cabinet_refacing"]),
    ],
    [null, null, null],
  );
  eq("junk", [tradeExcludedBy(null, ["cabinet_refinishing"]), tradeExcludedBy("cabinet_refacing", null), tradeExcludedBy("cabinet_refacing", "cabinet_refinishing"), tradeExcludedBy("", [])], [null, null, null, null]);
}

// ───────────────────────────────────────────────────────────────────────────
section("5. …so the co-occurrence stops concluding it, however true the count");
// ───────────────────────────────────────────────────────────────────────────

// TrueFinish's real history: an estimator priced refinishing AND refacing on
// the same quote, for the same client, so the homeowner could compare
// recoating with replacing. The count is true. The conclusion was not.
const CATEGORIES = [
  { id: COUNTER, key: "countertop", label: "Countertop Installation", labelTranslations: null, companyId: null },
  { id: CAB, key: "cabinet_refinishing", label: "Cabinet Refinishing", labelTranslations: null, companyId: null },
  { id: REFACE, key: "cabinet_refacing", label: "Cabinet Refacing", labelTranslations: null, companyId: null },
  { id: FLOOR, key: "flooring", label: "Flooring", labelTranslations: null, companyId: null },
  { id: GUTTER, key: "gutter_cleaning", label: "Gutter Cleaning", labelTranslations: null, companyId: null },
];
const group = (categoryId) => ({ categoryId, category: CATEGORIES.find((c) => c.id === categoryId) });
// `_count` is how dbStub answers a `{ some: ... }` relation filter — the
// `scopeGroups: { some: { categoryId: { in } } }` this read sends.
const pastQuote = (id, categoryIds) => ({
  id,
  companyId: "co_1",
  status: "accepted",
  scopeGroups: categoryIds.map(group),
  _count: { scopeGroups: categoryIds.length },
});

const seedHistory = () => {
  resetDbStub();
  rows.serviceCategory.push(...CATEGORIES);
  rows.quote.push(
    pastQuote("q_a", [CAB, REFACE]),
    pastQuote("q_b", [CAB, REFACE]),
    pastQuote("q_c", [CAB, REFACE, GUTTER]),
    pastQuote("q_d", [CAB, GUTTER]),
  );
};

{
  seedHistory();
  const suggestions = await getSuggestedAddOns({ companyId: "co_1", currentCategoryIds: [CAB] });
  eq(
    "a refinishing quote is never offered refacing, though it is the commonest pairing in the history",
    suggestions.map((s) => s.label),
    ["Gutter Cleaning"],
  );
  ok("…and the count that survives is the real one", suggestions[0].frequency === 2);
  eq("a suggestion says whether its trade is sold by the unit, so the panel can say why there is no figure", [suggestions[0].label, suggestions[0].pricedByTheUnit], ["Gutter Cleaning", false]);

  const other = await getSuggestedAddOns({ companyId: "co_1", currentCategoryIds: [REFACE] });
  eq("a refacing quote is never offered refinishing either", other.map((s) => s.label), ["Gutter Cleaning"]);
}

{
  seedHistory();
  rows.quoteScopeGroup.push(
    { categoryId: GUTTER, subtotal: 340, quote: { companyId: "co_1", status: "accepted" } },
    { categoryId: GUTTER, subtotal: 300, quote: { companyId: "co_1", status: "accepted" } },
    { categoryId: REFACE, subtotal: 5500, quote: { companyId: "co_1", status: "accepted" } },
  );
  // A refinishing quote that also carries flooring: the suggestion for the
  // flooring service must still not be refacing, which is the alternative to
  // a DIFFERENT service on the same quote.
  const byCategory = await getSuggestionsByCategory({ companyId: "co_1", categoryIds: [CAB, FLOOR], onQuote: [CAB, FLOOR] });
  eq("per service, refacing is offered under neither", Object.values(byCategory).flat().map((s) => s.label).sort(), ["Gutter Cleaning"]);
  eq("the gutter suggestion keeps its median", Object.values(byCategory).flat().map((s) => s.amount), [320]);
}

// ───────────────────────────────────────────────────────────────────────────
section("6. Defect A, the figure — no median for a trade sold by the door");
// ───────────────────────────────────────────────────────────────────────────

{
  seedHistory();
  rows.quoteScopeGroup.push(
    // Four accepted refacing jobs. Their median is $5,500 and it was printed
    // on a three-door kitchen and a twenty-nine-door one alike.
    { categoryId: REFACE, subtotal: 2400, quote: { companyId: "co_1", status: "accepted" } },
    { categoryId: REFACE, subtotal: 5000, quote: { companyId: "co_1", status: "accepted" } },
    { categoryId: REFACE, subtotal: 6000, quote: { companyId: "co_1", status: "accepted" } },
    { categoryId: REFACE, subtotal: 14800, quote: { companyId: "co_1", status: "accepted" } },
    { categoryId: CAB, subtotal: 4200, quote: { companyId: "co_1", status: "accepted" } },
    { categoryId: GUTTER, subtotal: 340, quote: { companyId: "co_1", status: "accepted" } },
    { categoryId: GUTTER, subtotal: 300, quote: { companyId: "co_1", status: "accepted" } },
  );
  const prices = await typicalPriceByCategory("co_1", [REFACE, CAB, GUTTER]);
  eq("a unit-priced trade gets no figure at all — not $5,500, not a scaled guess", [prices[REFACE], prices[CAB]], [undefined, undefined]);
  eq("a trade whose jobs are not sold by the unit keeps the median its history supports", prices[GUTTER], { amount: 320, sampleSize: 2 });
  eq("…and asking for only unit-priced trades reads no scope groups", await typicalPriceByCategory("co_1", [REFACE]), {});
  eq("nothing asked, nothing read", await typicalPriceByCategory("co_1", []), {});

  // The review shows an unpriced suggestion with an Add button and a reason.
  // The reason has to be the true one: this company HAS four accepted
  // refacing jobs, so "no price history yet" would be a false sentence.
  const panel = read("app/components/quotes/SuggestAddOns.js");
  ok("the panel says 'priced by the door' rather than 'no price history'", /s\.pricedByTheUnit[\s\S]{0,120}app\.quoteReview\.pricedByTheDoor/.test(panel));
  // The "needs a number" half moved to lib/quotes/addOnAutoAdd.js with the
  // rest of the auto-add decision (section 11 executes it). The panel keeps
  // the other half: an Add on a suggestion with no history arrives blank
  // rather than guessed.
  ok(
    "…and still refuses to offer it without a number the estimator typed",
    /Number\(s\?\.amount\) > 0/.test(read("lib/quotes/addOnAutoAdd.js")) && /amount: s\.amount \?\? ""/.test(panel),
  );
  const msgs = read("app/i18n/appMessages.js");
  eq("the sentence exists in all nine languages", (msgs.match(/"app\.quoteReview\.pricedByTheDoor"/g) || []).length, 9);
}

// ───────────────────────────────────────────────────────────────────────────
section("7. The save route refuses what the builder never offered");
// ───────────────────────────────────────────────────────────────────────────

/** Just enough of Prisma for createOfferedAddOns, honouring the WHEREs it sends. */
function fakePrisma({ addOns = [], products = [], categories = [] } = {}) {
  const writes = [];
  return {
    writes,
    quoteAddOn: {
      findMany: async ({ where }) => addOns.filter((a) => a.quoteId === where.quoteId),
      createMany: async ({ data }) => {
        writes.push(...data);
        return { count: data.length };
      },
    },
    product: {
      findMany: async ({ where }) =>
        products.filter(
          (p) =>
            p.companyId === where.companyId &&
            p.active === where.active &&
            (where.id ? where.id.in.includes(p.id) : where.name.in.includes(p.name)),
        ),
    },
    serviceCategory: {
      findMany: async ({ where }) =>
        categories.filter((c) => where.id.in.includes(c.id) && where.OR.some((o) => o.companyId === c.companyId)),
    },
  };
}

{
  const prisma = fakePrisma({
    products: PRODUCTS.map((p) => ({ ...p, companyId: "co_1", description: null })),
    categories: CATEGORIES,
  });
  const medians = async (_companyId, ids) =>
    Object.fromEntries(ids.filter((id) => id === GUTTER).map((id) => [id, { amount: 320, sampleSize: 2 }]));
  const result = await createOfferedAddOns(prisma, {
    companyId: "co_1",
    quoteId: "q_1",
    // A browser posting by hand what no chip ever drew.
    refs: [
      { kind: "history", categoryId: REFACE },
      { kind: "history", categoryId: GUTTER },
      { kind: "catalog", productId: "p_glass", categoryId: CAB },
      { kind: "catalog", productId: "p_own", categoryId: CAB },
    ],
    scopeGroups: [{ categoryId: CAB, intakeValues: { doorCount: 29, drawerCount: 14 }, lineItems: [] }],
    priceHistory: medians,
  });
  eq(
    "refacing is refused on a refinishing quote; the glass inserts are written at two doors",
    prisma.writes.map((w) => [w.description, w.amount, w.source]),
    [["Gutter Cleaning", 320, "history"], ["Glass Inserts (2 × door)", 170, "catalog"]],
  );
  eq(
    "with reasons, so a refusal is not silence",
    result.skipped.map((s) => `${s.ref.categoryId === REFACE ? "refacing" : s.ref.productId}:${s.reason}`),
    ["refacing:exclusive", "p_own:unpriced"],
  );
}

// ───────────────────────────────────────────────────────────────────────────
section("8. The wiring");
// ───────────────────────────────────────────────────────────────────────────

{
  const offered = read("lib/quotes/offeredAddOns.js");
  ok("the seed and the builder share ONE arithmetic", /export function catalogueAddOnsFor/.test(offered) && /catalogueAddOnsFor\(\{ groups, products, room: CAP \}\)/.test(offered));
  ok("…which asks the catalogue, by name", /standardAddOnUnitScope\(name\)/.test(offered));
  ok("the builder's chip is the same function", /catalogueAddOnsFor\(\{ groups: \[group\], products: \[product\], room: 1 \}\)/.test(read("lib/quotes/builderOffers.js")));

  const sugg = read("lib/ai/quoteSuggestions.js");
  ok("the suggestion filter is the declared table, not a learned one", /tradeExcludedBy\(group\.category\?\.key, presentKeys\)/.test(sugg));
  ok("the median refuses a unit-priced trade", /isUnitPriced\(c\.key\)/.test(sugg));
  ok("…and still makes no model call", !/provider|complete\(|runToolLoop/.test(sugg));
  ok("the review and the builder share that one median", /export async function typicalPriceByCategory/.test(sugg) && !/async function typicalPriceByCategory/.test(read("lib/ai/quoteReview.js")));
  ok("the save route checks the rule again, server-side", /tradeExcludedBy\(category\.key, onQuoteKeys\)/.test(read("lib/quotes/suggestedAddOns.js")));

  const catalog = read("lib/trades/catalog.js");
  ok("the pair lives with the other trade facts, with a reason", /EXCLUSIVE_TRADES/.test(catalog) && /recoated and replaced/.test(catalog));
  ok("…and the catalogue still imports nothing, so prisma/seed.js runs", !/^import /m.test(catalog));

  // Nothing here rewrites a quote that has already gone out.
  for (const f of ["lib/quotes/offeredAddOns.js", "lib/quotes/suggestedAddOns.js", "lib/ai/quoteSuggestions.js"]) {
    ok(`${f} never updates an existing QuoteAddOn`, !/quoteAddOn\.(update|updateMany|deleteMany|delete)\b/.test(read(f)));
  }
}

// ───────────────────────────────────────────────────────────────────────────
section("9. One upgrade, one row — the structural half");
// ───────────────────────────────────────────────────────────────────────────

// Not the owner's own row — see section 10 for that one. This is the version
// of the same defect that the company's catalogue CAN settle: a product
// linked to two categories, offered on a quote carrying one of them, beside a
// history suggestion naming the other.

{
  eq(
    "a catalogue row's text is parsed back to the product name it was built from",
    ["Soft-Close Hinges (31 × door)", "Glass Inserts (2 × door)", "Two-Tone Finish", "New Handles — supply & install"].map(catalogueRowName),
    ["Soft-Close Hinges", "Glass Inserts", "Two-Tone Finish", "New Handles — supply & install"],
  );
  eq(
    "a row this code did not write is left alone — no suffix invented, no bracket eaten",
    ["Fix the (broken) drawer", "Hinges (many × door)", "Repair (per visit)", "", null, 42].map(catalogueRowName),
    ["Fix the (broken) drawer", "Hinges (many × door)", "Repair (per visit)", "", "", "42"],
  );

  // The structural join: a product the quote already offers, linked to the
  // category being suggested. Not a resemblance between two labels.
  const CROSS = [
    { id: "p_counter", name: "Countertop Supply & Installation", unit: "flat", unitPrice: 2400, active: true, categories: [{ id: CAB }, { id: COUNTER }] },
    ...PRODUCTS,
  ];
  eq(
    "the categories a quote's catalogue extras belong to",
    [...offeredProductCategories({ products: CROSS, descriptions: ["Countertop Supply & Installation", "Soft-Close Hinges (29 × door)"] })].sort(),
    [CAB, COUNTER].sort(),
  );
  eq(
    "nothing claimed for a row that matches no product, or for junk",
    [
      offeredProductCategories({ products: CROSS, descriptions: ["Dust barrier — by hand"] }).size,
      offeredProductCategories({ products: null, descriptions: null }).size,
      offeredProductCategories({ products: CROSS, descriptions: [null, 7, ""] }).size,
    ],
    [0, 0, 0],
  );

  const history = {
    [CAB]: [
      { categoryId: COUNTER, label: "Countertop Installation", share: 50, amount: 2400 },
      { categoryId: GUTTER, label: "Gutter Cleaning", share: 30, amount: 320 },
    ],
  };
  const create = builderOfferRows({ groups: kitchen(29, 14), products: CROSS, history, isEdit: false });
  ok(
    "create: the countertop service is not suggested — a product on this quote is linked to it",
    !JSON.stringify(create.byGroup.t1).includes("Countertop Installation"),
  );
  eq("create: a suggestion the catalogue does NOT cover is still offered", create.byGroup.t1.offers.map((o) => o.description), ["Gutter Cleaning"]);

  const saved = [{ description: "Countertop Supply & Installation", amount: 2400, source: "catalog" }];
  const edit = builderOfferRows({ groups: kitchen(29, 14), products: CROSS, history, existing: saved, isEdit: true });
  ok(
    "edit: a catalogue row ALREADY saved covers it too — which is the shape Q-2026-0029 was in",
    !JSON.stringify(edit.byGroup.t1).includes("Countertop Installation"),
  );
  const pend = builderOfferRows({ groups: kitchen(29, 14), products: CROSS, history, existing: [], pending: [{ kind: "catalog", productId: "p_counter", categoryId: CAB }], isEdit: true });
  ok("edit: so does one clicked this session", !JSON.stringify(pend.byGroup.t1).includes("Countertop Installation"));

  // The thing a substring rule would have broken.
  const TWO_HINGES = [
    { id: "p_soft", name: "Soft-Close Hinges", unit: "door", unitPrice: 35, active: true, categories: [{ id: CAB }] },
    { id: "p_rep", name: "Hinge Repair — per door", unit: "flat", unitPrice: 60, active: true, categories: [{ id: CAB }] },
  ];
  eq(
    "two genuinely different hinge products are both still offered",
    builderOfferRows({ groups: kitchen(29, 14), products: TWO_HINGES, history: {}, existing: [], isEdit: true }).byGroup.t1.offers.map((o) => o.description),
    ["Soft-Close Hinges (29 × door)", "Hinge Repair — per door"],
  );
}


{
  const prisma = fakePrisma({
    products: [
      { id: "p_counter", name: "Countertop Supply & Installation", companyId: "co_1", description: null, unit: "flat", unitPrice: 2400, active: true, categories: [{ id: CAB }, { id: COUNTER }] },
      ...PRODUCTS.map((p) => ({ ...p, companyId: "co_1", description: null })),
    ],
    categories: CATEGORIES,
    // The quote is in Q-2026-0029's state: the catalogue hinges already offered.
    addOns: [{ quoteId: "q_9", description: "Countertop Supply & Installation", source: "catalog" }],
  });
  const medians = async (_c, ids) => Object.fromEntries(ids.map((id) => [id, { amount: id === COUNTER ? 2400 : 320, sampleSize: 4 }]));
  const r = await createOfferedAddOns(prisma, {
    companyId: "co_1",
    quoteId: "q_9",
    refs: [
      { kind: "history", categoryId: COUNTER },
      { kind: "history", categoryId: GUTTER },
    ],
    scopeGroups: [{ categoryId: CAB, intakeValues: { doorCount: 31 }, lineItems: [] }],
    priceHistory: medians,
  });
  eq("only the one the catalogue does not already cover is written", prisma.writes.map((w) => [w.description, w.amount]), [["Gutter Cleaning", 320]]);
  eq(
    "…and the covered one is refused, with the reason named",
    r.skipped.map((x) => `${x.ref.categoryId}:${x.reason}`),
    [`${COUNTER}:alreadyOffered`],
  );
}

{
  // A clicked catalogue reference that prices to nothing covers nothing: the
  // catalogue is offering no row for the history row to duplicate.
  const prisma = fakePrisma({
    products: [{ id: "p_counter_lf", name: "Countertop Supply & Installation", companyId: "co_1", description: null, unit: "linear ft", unitPrice: 120, active: true, categories: [{ id: CAB }, { id: COUNTER }] }],
    categories: CATEGORIES,
  });
  const medians = async (_c, ids) => Object.fromEntries(ids.map((id) => [id, { amount: 2400, sampleSize: 4 }]));
  const r = await createOfferedAddOns(prisma, {
    companyId: "co_1",
    quoteId: "q_10",
    refs: [
      { kind: "history", categoryId: COUNTER },
      { kind: "catalog", productId: "p_counter_lf", categoryId: CAB },
    ],
    scopeGroups: [{ categoryId: CAB, intakeValues: { doorCount: 31 }, lineItems: [] }],
    priceHistory: medians,
  });
  eq("an unpriceable catalogue click does not suppress the history row", prisma.writes.map((w) => w.description), ["Countertop Installation"]);
  eq("…and the click is still reported as unpriced", r.skipped.map((x) => x.reason), ["unpriced"]);

  // The same two references the other way round must decide the same way.
  const other = fakePrisma({
    products: [{ id: "p_counter", name: "Countertop Supply & Installation", companyId: "co_1", description: null, unit: "flat", unitPrice: 2400, active: true, categories: [{ id: CAB }, { id: COUNTER }] }],
    categories: CATEGORIES,
  });
  const r2 = await createOfferedAddOns(other, {
    companyId: "co_1",
    quoteId: "q_11",
    refs: [
      { kind: "history", categoryId: COUNTER },
      { kind: "catalog", productId: "p_counter", categoryId: CAB },
    ],
    scopeGroups: [{ categoryId: CAB, intakeValues: { doorCount: 31 }, lineItems: [] }],
    priceHistory: medians,
  });
  eq("a priceable one suppresses it whichever order the body listed them in", other.writes.map((w) => w.description), ["Countertop Supply & Installation"]);
  eq("…with the history row named as already offered", r2.skipped.map((x) => x.reason), ["alreadyOffered"]);
}

// ───────────────────────────────────────────────────────────────────────────
section("10. …and the free-text half, which is a warning, not a rule");
// ───────────────────────────────────────────────────────────────────────────

// Every distinct `source: "history"` description on this company's live
// quotes, read from the database, plus the seeded catalogue rows that sit
// beside them. "New Hinges" matches no ServiceCategory and no Product row of
// any company, so there is nothing to join on — the words are all there is.
const LIVE_ROWS = [
  "Soft-Close Hinges (31 × door)",
  "New Hinges",
  "New handles",
  "New Handles — supply & install",
  "New Handles holes",
  "Soft-Close Drawer Slides (14 × drawer)",
  "Glass Inserts (2 × door)",
  "Two-Tone Finish",
  "Cabinet Refacing",
  "Interior cabinet  Refinishing",
  "Stairs",
  "Countertop Supply & Installation",
  "Crown Moulding",
];
const flagged = (descriptions, extra = {}) =>
  duplicateAddOnPairs(descriptions.map((description) => ({ description, source: "manual", ...extra }))).map(
    (p) => `${descriptions[p.a]} ~ ${descriptions[p.b]} (${p.shared})`,
  );

{
  eq(
    "an upgrade is named by its LAST word, with the quantity suffix and the how-words gone",
    ["Soft-Close Hinges (31 × door)", "New Hinges", "New Handles — supply & install", "Interior cabinet  Refinishing"].map((d) => upgradeWords(d).head),
    ["hinge", "hinge", "handle", "refinishing"],
  );
  eq(
    "…and a row with nothing but how-words names nothing, so it is never paired",
    [upgradeWords("supply & install").head, upgradeWords("").head, upgradeWords(null).head, upgradeWords("a (1 × each)").head],
    [null, null, null, null],
  );

  eq(
    "the owner's two rows, and the handle rows behind them — every pair in the live data",
    flagged(LIVE_ROWS),
    [
      "Soft-Close Hinges (31 × door) ~ New Hinges (hinge)",
      "New handles ~ New Handles — supply & install (handle)",
      "New handles ~ New Handles holes (handle)",
      "New Handles — supply & install ~ New Handles holes (handle)",
    ],
  );

  // The ones it must leave alone are the whole reason this is a head-noun
  // rule and not "shares a word": hinges and drawer slides share TWO words
  // and sit together on nearly every cabinet quote.
  ok("hinges and drawer slides are not the same upgrade", !flagged(["Soft-Close Hinges (31 × door)", "Soft-Close Drawer Slides (14 × drawer)"]).length);
  ok("nor refacing and refinishing, which share 'cabinet'", !flagged(["Cabinet Refacing", "Interior cabinet  Refinishing"]).length);
  ok("nor glass inserts and a two-tone finish", !flagged(["Glass Inserts (2 × door)", "Two-Tone Finish"]).length);
  ok("nor a countertop and a crown moulding", !flagged(["Countertop Supply & Installation", "Crown Moulding"]).length);
  eq("one row alone is never a pair", flagged(["New Hinges"]), []);
  eq(
    "two rows with the SAME text are flagged — the plainest case of all",
    flagged(["New Hinges", "New Hinges"]).length,
    1,
  );

  // A takeoff row is regenerated from the scope group on every save, so it is
  // not the estimator's to merge with anything.
  eq(
    "a takeoff row is left out",
    duplicateAddOnPairs([
      { description: "Living room — Ceiling", source: "takeoff" },
      { description: "Ceiling refresh", source: "manual" },
    ]),
    [],
  );
  eq(
    "junk in, no pairs out",
    [duplicateAddOnPairs(null).length, duplicateAddOnPairs("nope").length, duplicateAddOnPairs([null, 7, {}, { description: "   " }]).length],
    [0, 0, 0],
  );

  // It is a sentence. Nothing in the module can remove, reprice or refuse.
  const src = read("lib/quotes/addOnDuplicates.js");
  // Comments out first: the JSDoc has to name `amount` to document the shape
  // it is handed, and a check that read a comment as code would be the kind
  // of guard this repo gets swept for.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  eq(
    "the module decides nothing — it never touches an amount, never removes a row, and only reports pairs",
    ["amount", "splice", "setAddOns", "delete ", "save("].filter((w) => code.includes(w)),
    [],
  );
  const panel = read("app/components/quotes/SuggestAddOns.js");
  ok("the panel only says it", /duplicatePairs\.map/.test(panel) && /app\.quoteReview\.sameUpgrade/.test(panel));
  ok("…recomputed from the live list, so removing a row clears the warning", /const duplicatePairs = duplicateAddOnPairs\(addOns\)/.test(panel));
  ok("…and the save path is untouched by it", !/duplicatePairs/.test(panel.slice(panel.indexOf("async function save("), panel.indexOf("function addBlank("))));
  const msgs = read("app/i18n/appMessages.js");
  eq("the sentence exists in all nine languages", (msgs.match(/"app\.quoteReview\.sameUpgrade"/g) || []).length, 9);
  const en = msgs.match(/"app\.quoteReview\.sameUpgrade": "([^"]+)"/)[1];
  ok("…naming both rows", en.includes("{first}") && en.includes("{second}"));
}

// ───────────────────────────────────────────────────────────────────────────
section("11. Offering NOTHING is a decision the estimator is allowed to make");
// ───────────────────────────────────────────────────────────────────────────
//
// Owner, 2026-11-04: "if I delete all addons I cannot save it so then when
// the quote is created or saved they all appear again I would assume that if
// I delete all of the add-ons and save the quote they will not appear. It
// forces me to at least have one."
//
// Two separate faults behind one sentence:
//
//   A  the Save button lived inside the else branch of the row ternary, so
//      deleting the last row unmounted the only control that could persist
//      the deletion. The server has always accepted an empty list.
//   B  the review's priced recommendations filtered against the list ON
//      SCREEN, which after a delete-all was empty — so every one of them
//      passed, was appended, and was SAVED. The removal was reversed and
//      written to the database.
//
// Both are executed here, not read: (a) renders the real component at zero
// rows, (b) runs the real decision function, (c) runs the real candidate
// query against a quote that already offers one of the candidates.

{
  // (a) The control, rendered. The panel it lives in cannot be rendered —
  // it opens in a loading state and fills itself from two GETs — which is
  // precisely how the bar sat in the wrong branch unnoticed, so the list and
  // its Save button are their own component (app/components/quotes/
  // OfferedExtras.js) and the npm script bundles that one file for this.
  const require_ = createRequire(join(ROOT, "scripts", "x.js"));
  const { OfferedExtras } = require_(join(ROOT, ".offered-extras.cjs"));
  const render = (props) =>
    renderToStaticMarkup(
      createElement(OfferedExtras, {
        addOns: [],
        readOnly: false,
        t: (k) => k,
        update: () => {},
        remove: () => {},
        save: () => {},
        saving: false,
        dirty: false,
        savedAt: null,
        ...props,
      }),
    );

  const empty = render({});
  ok(
    "the Save button is on screen with ZERO rows — the one state it was missing from",
    empty.includes("app.quoteReview.saveExtras"),
    empty,
  );
  ok("…beside the empty-state sentence, not instead of it", empty.includes("app.quoteReview.nothingOffered"));
  ok(
    "…and the sentence says what pressing it with an empty list means, so the button is not a mystery",
    /Saving it empty is a choice too/.test(
      read("app/i18n/appMessages.js").match(/"app\.quoteReview\.nothingOffered": "([^"]+)"/)[1],
    ),
  );
  eq("the empty state's markup, pinned", md5(empty), "e9d8c2e696afbacf9d9eb6ad8546325e");

  const oneRow = render({
    addOns: [{ id: "a1", description: "Soft-Close Hinges", detail: "", amount: 875, taxable: true, source: "catalog" }],
  });
  ok("one row: the same button, unmoved", oneRow.includes("app.quoteReview.saveExtras"));
  ok("…with the row's own remove control", oneRow.includes("app.action.remove"));
  eq("one row's markup, pinned", md5(oneRow), "a1783651a1048cc9219efd77ba539d69");

  // Read-only is the one case where there is no Save button, and that is not
  // the bug — the client has decided and the extras are a record.
  const locked = render({ readOnly: true, addOns: [{ id: "a1", description: "Soft-Close Hinges", amount: 875 }] });
  ok("a decided quote still has no Save button", !locked.includes("app.quoteReview.saveExtras"));
  ok("…and no remove control either", !locked.includes("app.action.remove"));

  // The unsaved badge and the saved tick travel WITH the button, so they are
  // reachable at zero rows too — otherwise "Unsaved" could never be shown
  // about a deletion.
  ok("the unsaved badge is reachable at zero rows", render({ dirty: true }).includes("app.quoteReview.unsaved"));
  ok("…so is the saved tick", render({ savedAt: 1 }).includes("app.action.saved"));
}

{
  // (b) The decision, executed. `curatedAt` is Quote.addOnsCuratedAt.
  const review = [
    { description: "Gutter Cleaning", detail: "Often sold with this", amount: 320, source: "history" },
    { description: "Priced by the door", detail: null, amount: null, source: "history" },
  ];

  const fresh = autoAddFromReview({ reviewAddOns: review, addOns: [], curatedAt: null });
  eq(
    "a quote nobody has curated still gets the priced recommendation appended, as designed",
    [fresh.next.map((a) => a.description), fresh.added.length],
    [["Gutter Cleaning"], 1],
  );
  ok("…and never the unpriced one, which has no number to tick", fresh.next.length === 1);

  eq(
    "the SAME review, on a list a human has saved, appends and saves nothing",
    autoAddFromReview({ reviewAddOns: review, addOns: [], curatedAt: "2026-11-04T12:00:00.000Z" }),
    null,
  );
  eq(
    "…including when the curated list is empty, which is the owner's case exactly",
    autoAddFromReview({ reviewAddOns: review, addOns: [], curatedAt: new Date("2026-11-04") }),
    null,
  );
  eq(
    "a curated list with rows on it is equally not topped up",
    autoAddFromReview({
      reviewAddOns: review,
      addOns: [{ description: "Soft-Close Hinges", amount: 875 }],
      curatedAt: new Date("2026-11-04"),
    }),
    null,
  );
  eq("read-only never auto-adds, curated or not", autoAddFromReview({ reviewAddOns: review, addOns: [], readOnly: true }), null);
  eq(
    "an already-offered recommendation is not duplicated, whitespace and case aside",
    autoAddFromReview({ reviewAddOns: review, addOns: [{ description: "  gutter CLEANING " }], curatedAt: null }),
    null,
  );
  eq("junk in, nothing out", [autoAddFromReview({}), autoAddFromReview({ reviewAddOns: null, addOns: null })], [null, null]);
  eq(
    "the editor's cap still holds — eight offered rows, never nine",
    autoAddFromReview({
      reviewAddOns: [1, 2, 3].map((n) => ({ description: `Extra ${n}`, amount: 100 + n })),
      addOns: [1, 2, 3, 4, 5, 6, 7].map((n) => ({ description: `Row ${n}`, amount: n })),
      curatedAt: null,
    }).next.length,
    8,
  );

  // One copy of the rule, and the panel is its only caller.
  const panel = read("app/components/quotes/SuggestAddOns.js");
  ok("the panel calls the helper rather than carrying its own copy", /autoAddFromReview\(\{/.test(panel));
  ok("…and no longer filters the review against the on-screen list itself", !/Number\(s\.amount\) > 0 &&/.test(panel));
  ok("the marker comes down with the list the panel already fetches", /setCuratedAt\(saved\?\.addOnsCuratedAt \|\| null\)/.test(panel));

  // The write, and the one transaction it belongs in.
  const route = read("app/api/quotes/[id]/add-ons/route.js");
  ok("the PUT sets the marker", /addOnsCuratedAt: curatedAt/.test(route));
  ok(
    "…inside the SAME transaction as the rows, not after it",
    /\$transaction\(\[[\s\S]*?db\.quote\.update\(\{[\s\S]*?addOnsCuratedAt: curatedAt[\s\S]*?\]\)/.test(route),
  );
  ok("…and an empty list is still a delete-all with nothing inserted", /rows\.length \? \[db\.quoteAddOn\.createMany\(\{ data: rows \}\)\] : \[\]/.test(route));
  ok("nothing anywhere refuses an empty list", !/addOns.*\.min\(1\)/.test(route) && !/at least one add-on/i.test(route));

  // The hardening: the catalogue seed asked the row count, which cannot tell
  // an empty list from an un-seeded one. Create-only today, so this is the
  // invariant being enforced rather than a live bug.
  const seed = read("lib/quotes/offeredAddOns.js");
  ok("the catalogue seed asks the marker before the row count", seed.indexOf("addOnsCuratedAt: true") < seed.indexOf("quoteAddOn.count"));
  ok("…and still refuses to top up a list that already has rows", /if \(existing > 0\) return 0;/.test(seed));
}

{
  // (c) The candidates themselves. They came off the scope groups' categories
  // and the company's history and never read quote.addOns, so every re-run
  // proposed the identical list — which is why one press of Review could
  // undo a deletion made before it.
  seedHistory();
  rows.quoteScopeGroup.push(
    { categoryId: GUTTER, subtotal: 340, quote: { companyId: "co_1", status: "accepted" } },
    { categoryId: GUTTER, subtotal: 300, quote: { companyId: "co_1", status: "accepted" } },
  );
  const quoteWith = (addOns) => ({ scopeGroups: [{ categoryId: CAB }], addOns });

  const virgin = await addOnCandidates(quoteWith([]), "co_1");
  eq(
    "a quote offering nothing is told about the gutter cleaning it usually sells alongside",
    virgin.map((s) => [s.description, s.amount]),
    [["Gutter Cleaning", 320]],
  );

  eq(
    "a quote that ALREADY offers it is not told about it again",
    await addOnCandidates(quoteWith([{ description: "Gutter Cleaning" }]), "co_1"),
    [],
  );
  eq(
    "…matched the way the panel matches: trimmed and case-insensitive",
    await addOnCandidates(quoteWith([{ description: "  gutter cleaning  " }]), "co_1"),
    [],
  );
  eq(
    "a row that is something else entirely leaves the recommendation standing",
    (await addOnCandidates(quoteWith([{ description: "Soft-Close Hinges" }]), "co_1")).map((s) => s.description),
    ["Gutter Cleaning"],
  );
  eq(
    "a junk row is not read as a match for anything",
    (await addOnCandidates(quoteWith([{ description: null }, {}, null]), "co_1")).map((s) => s.description),
    ["Gutter Cleaning"],
  );
}

console.log(`\n${fail ? "✗" : "✓"} offered add-ons: ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
