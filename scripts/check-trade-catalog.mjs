// scripts/check-trade-catalog.mjs
//
//   node --import ./scripts/alias-loader.mjs scripts/check-trade-catalog.mjs
//
// ── What this is guarding ───────────────────────────────────────────────────
//
// A cabinet-refinishing and painting company opened three settings screens and
// got three different answers about what it sells. Settings > Services listed
// seven trades. Settings > Instant Quotes offered roofing, parging, lawn mowing
// and junk removal, and did NOT offer cabinet refinishing. Settings > Products
// filed every add-on under Cabinet Refacing, including the handles a
// refinishing job sells. His words: "somehow the instant quote has roofing,
// which is not displayed in the services, so who does roofing?"
//
// Roofing was not seeded and not defaulted. He turned it on himself, on
// 13/08/2026 at 01:35:18, in a burst of six saves twenty seconds long — one
// card after another down a page that showed him every estimator FieldQuo has
// ever wired, with nothing marking which of them were his trades. He was shown
// a roofing rate card, so he filled it in. That is the bug, and it was true for
// every tenant.
//
// Underneath it sat a real structural fault: SEVENTEEN separate lists each
// answered part of "what is a trade", in two key spaces that did not agree.
// `roofing_service` in the catalogue is `roofing` to the estimator; `stairs` is
// `stair`; one `painting` estimator serves interior and exterior painting both.
//
// So this file EXECUTES the single definition against every one of those lists
// and against a real company's real rows. It reads no database.
//
// ── Why the fixture, and why it is a JSON file ─────────────────────────────
//
// scripts/fixtures/trade-catalogue-before.json is the catalogue and the
// industry presets exactly as they stood before lib/trades/catalog.js existed,
// lifted out of prisma/seed.js and app/data/industryCategories.js at that
// commit. 29 companies have CompanyServiceCategory rows keyed to those entries.
// Asserting against a JSON snapshot rather than against the new code proves the
// unification MOVED the lists rather than editing them — a check written from
// the new source would agree with itself.

import fs from "node:fs";

import {
  TRADE_CATALOG,
  tradeKeys,
  seedRows,
  categoryLabel,
  categoryKeysForIndustries,
  categoriesWithoutIndustry,
  instantTradeForCategory,
  categoryKeysForInstantTrade,
  primaryCategoryForInstantTrade,
  instantTrades,
  catalogueMismatches,
} from "@/lib/trades/catalog";
import {
  tradeDefinition,
  allTradeDefinitions,
  tradesMissingIntake,
} from "@/lib/trades/definition";
import { INDUSTRY_CATEGORY_KEYS } from "@/app/data/industryCategories";
import { INDUSTRIES } from "@/app/data/industries";
import { TRADE_PRICE_BOOKS, PRICE_BOOK_FIELDS } from "@/app/data/tradePriceBooks";
import { TAKEOFF_TRADES } from "@/lib/pricing/takeoffTrades";
import { INTAKE_FIELDS } from "@/app/data/quoteIntakeFields";
import { TIERED_PACKAGES } from "@/app/data/tieredPackages";
import { ADD_ON_FLAGS } from "@/lib/pricing/offerings";
import { STANDARD_ADDONS as ADDONS_BY_CATEGORY } from "@/app/data/standardAddOns";
import { planStandardAddOns } from "@/lib/products/seedStandardAddOns";
import {
  INSTANT_ESTIMATE_TRADES,
  INSTANT_ESTIMATE_DEFAULTS,
} from "@/lib/estimate/instantEstimate";
import { TRADE_LABELS } from "@/lib/estimate/instantQuoteServer";
import { instantTradeFor, callQuotableCategoryKeys } from "@/lib/estimate/callEstimate";

let failures = 0;
function ok(label, cond, detail) {
  if (cond) {
    console.log(`  ✓ ${label}`);
  } else {
    failures++;
    console.log(`  ✗ ${label}${detail !== undefined ? `\n      ${JSON.stringify(detail)}` : ""}`);
  }
}
function section(title) {
  console.log(`\n${title}`);
}

const BEFORE = JSON.parse(
  fs.readFileSync(new URL("./fixtures/trade-catalogue-before.json", import.meta.url), "utf8"),
);

/* ══ 1. No company's existing rows change meaning ═══════════════════════════ */
//
// Every CompanyServiceCategory row in production points at a ServiceCategory by
// id, and that row's `key` is what all the code above joins on. If the
// catalogue lost, renamed or re-keyed an entry, 29 companies' enabled trades
// would quietly start meaning something else.

section("The catalogue moved, it did not change");

const beforeKeys = BEFORE.categories.map((c) => c.key).sort();
const afterKeys = [...tradeKeys()].sort();
ok("every seeded key still exists, and no key was invented",
  JSON.stringify(beforeKeys) === JSON.stringify(afterKeys),
  { missing: beforeKeys.filter((k) => !afterKeys.includes(k)),
    added: afterKeys.filter((k) => !beforeKeys.includes(k)) });

const beforeLabels = Object.fromEntries(BEFORE.categories.map((c) => [c.key, c.label]));
const relabelled = tradeKeys().filter((k) => TRADE_CATALOG[k].label !== beforeLabels[k]);
ok("no trade was renamed", relabelled.length === 0, relabelled);

const beforeIcons = Object.fromEntries(BEFORE.categories.map((c) => [c.key, c.icon]));
const reiconed = tradeKeys().filter((k) => TRADE_CATALOG[k].icon !== beforeIcons[k]);
ok("no trade's icon changed", reiconed.length === 0, reiconed);

// sortOrder is the ONE thing that moved, and only for the two categories a
// second seed file added with numbers already taken. Asserted explicitly rather
// than waved through, because sortOrder is written by the seeder into every
// tenant's shared catalogue rows.
const beforeSort = Object.fromEntries(BEFORE.categories.map((c) => [c.key, c.sortOrder]));
const resorted = tradeKeys().filter((k) => TRADE_CATALOG[k].sortOrder !== beforeSort[k]);
ok("only the two colliding fence entries were re-ordered",
  JSON.stringify(resorted.sort()) === JSON.stringify(["fence_repair", "fence_restoration"]),
  resorted);
ok("and the collision they were in is gone",
  new Set(tradeKeys().map((k) => TRADE_CATALOG[k].sortOrder)).size === tradeKeys().length,
  tradeKeys().map((k) => TRADE_CATALOG[k].sortOrder).filter((v, i, a) => a.indexOf(v) !== i));

// The seeder writes ONLY these four fields. `industries` and `instantTrade` are
// code facts about a trade; a column holding a copy of one is the "written and
// never read" failure, and worse, it would go stale on the next deploy.
const seeded = seedRows();
ok("the seeder writes key/label/icon/sortOrder and nothing else",
  seeded.every((r) => JSON.stringify(Object.keys(r).sort()) === '["icon","key","label","sortOrder"]'),
  seeded.find((r) => Object.keys(r).length !== 4));

/* ══ 2. Industry presets resolve exactly as they did ════════════════════════ */

section("Every industry still offers the same trades");

for (const { slug } of INDUSTRIES) {
  const before = [...(BEFORE.industryCategoryKeys[slug] || [])].sort();
  const after = [...categoryKeysForIndustries([slug])].sort();
  ok(`${slug}: ${before.length} trades, unchanged`,
    JSON.stringify(before) === JSON.stringify(after),
    { dropped: before.filter((k) => !after.includes(k)),
      gained: after.filter((k) => !before.includes(k)) });
}

ok("INDUSTRY_CATEGORY_KEYS still covers every industry slug",
  JSON.stringify(Object.keys(INDUSTRY_CATEGORY_KEYS).sort()) ===
    JSON.stringify(Object.keys(BEFORE.industryCategoryKeys).sort()));

// A preset naming a trade the catalogue doesn't ship would render a signup
// checkbox for a quote type that cannot exist.
const inventedPresetKeys = Object.values(INDUSTRY_CATEGORY_KEYS)
  .flat()
  .filter((k) => !TRADE_CATALOG[k]);
ok("no preset names a trade that isn't in the catalogue", inventedPresetKeys.length === 0, inventedPresetKeys);

// Every slug a preset uses has to be a real marketing industry, or a company
// carrying it resolves to nothing and lands on the full 68-trade catalogue.
const knownSlugs = new Set(INDUSTRIES.map((i) => i.slug));
const inventedSlugs = [...new Set(tradeKeys().flatMap((k) => TRADE_CATALOG[k].industries))]
  .filter((s) => !knownSlugs.has(s));
ok("no trade claims an industry that doesn't exist", inventedSlugs.length === 0, inventedSlugs);

ok("an unknown industry slug resolves to nothing rather than throwing",
  categoryKeysForIndustries(["not-a-real-trade"]).length === 0);
ok("no industries at all resolves to nothing (the caller then shows everything)",
  categoryKeysForIndustries([]).length === 0 && categoryKeysForIndustries().length === 0);

/* ══ 3. Every catalogue resolves in the single definition ═══════════════════ */
//
// The lists that each held a slice of "what is a trade". A key in any of them
// that the catalogue doesn't ship is an orphan: code that prices, measures or
// asks about a trade nothing can enable.

section("Every list keyed by trade resolves in the catalogue");

const CATEGORY_KEYED = {
  TRADE_PRICE_BOOKS: Object.keys(TRADE_PRICE_BOOKS),
  PRICE_BOOK_FIELDS: Object.keys(PRICE_BOOK_FIELDS),
  TAKEOFF_TRADES,
  INTAKE_FIELDS: Object.keys(INTAKE_FIELDS),
  STANDARD_ADDONS: Object.keys(ADDONS_BY_CATEGORY),
  TIERED_PACKAGES: Object.keys(TIERED_PACKAGES),
  ADD_ON_FLAGS: Object.keys(ADD_ON_FLAGS),
  CATEGORY_TO_TRADE: callQuotableCategoryKeys(),
};

for (const [name, keys] of Object.entries(CATEGORY_KEYED)) {
  const orphans = keys.filter((k) => !TRADE_CATALOG[k]);
  ok(`${name} (${keys.length}) — every key is a catalogue trade`, orphans.length === 0, orphans);
}

// A price book with no field list is a rate card the settings screen cannot
// render; a field list with no book prices nothing.
ok("every price book has a field list and vice versa",
  JSON.stringify(Object.keys(TRADE_PRICE_BOOKS).sort()) ===
    JSON.stringify(Object.keys(PRICE_BOOK_FIELDS).sort()));

// A takeoff form for a trade with no book has no numbers to multiply.
const takeoffNoBook = TAKEOFF_TRADES.filter((k) => !TRADE_PRICE_BOOKS[k]);
ok("every takeoff trade has a price book", takeoffNoBook.length === 0, takeoffNoBook);

/* ══ 4. The two key spaces agree, in both directions ═══════════════════════ */

section("Estimator keys and catalogue keys agree");

const wired = Object.keys(INSTANT_ESTIMATE_TRADES);

const claimedButNotWired = instantTrades().filter((t) => !wired.includes(t));
ok("the catalogue claims no estimator this build doesn't ship",
  claimedButNotWired.length === 0, claimedButNotWired);

const wiredButUnclaimed = wired.filter((t) => categoryKeysForInstantTrade(t).length === 0);
ok("every wired estimator prices at least one catalogue trade",
  wiredButUnclaimed.length === 0, wiredButUnclaimed);

for (const trade of wired) {
  const primaries = categoryKeysForInstantTrade(trade).filter((k) => TRADE_CATALOG[k].primary);
  ok(`${trade}: at most one category is marked primary`, primaries.length <= 1, primaries);
}

// Whatever an instant draft files under has to be a category that EXISTS. The
// map this replaced named "stair" (the row is `stairs`) and "painting" (no such
// row), and both resolved to null — which reads identically to "this trade has
// no category", a real case, so the typo was invisible for months.
for (const trade of wired) {
  const key = primaryCategoryForInstantTrade(trade);
  ok(`${trade} files its draft under a category that exists, or none at all`,
    key === null || Boolean(TRADE_CATALOG[key]), key);
}

// callEstimate's map is the phone-call direction. It is allowed to cover FEWER
// trades (a caller cannot draw a lawn polygon), but never a different answer.
const disagreeing = tradeKeys().filter((k) => {
  const call = instantTradeFor(k);
  return call && call !== instantTradeForCategory(k);
});
ok("CATEGORY_TO_TRADE agrees with the catalogue wherever it has an opinion",
  disagreeing.length === 0,
  disagreeing.map((k) => ({ key: k, call: instantTradeFor(k), catalogue: instantTradeForCategory(k) })));

ok("every estimator has default config to seed a rate card from",
  wired.every((t) => INSTANT_ESTIMATE_DEFAULTS[t] !== undefined),
  wired.filter((t) => INSTANT_ESTIMATE_DEFAULTS[t] === undefined));
ok("every estimator has a homeowner-facing name",
  wired.every((t) => TRADE_LABELS[t]),
  wired.filter((t) => !TRADE_LABELS[t]));

/* ══ 5. Enabling a service offers its instant quote ════════════════════════ */
//
// The half of the owner's ask that is a behaviour, not a list. Executed against
// the real settings-screen rule: a card belongs to "your services" when the
// company has enabled any category the estimator prices.

section("A company enabling a service is offered its instant quote");

const offeredFor = (enabledKeys) => {
  const enabled = new Set(enabledKeys);
  return wired.filter((trade) =>
    categoryKeysForInstantTrade(trade).some((k) => enabled.has(k)),
  );
};

for (const key of tradeKeys()) {
  const trade = instantTradeForCategory(key);
  if (!trade || !wired.includes(trade)) continue;
  ok(`enabling ${key} offers the ${trade} estimator`, offeredFor([key]).includes(trade));
}

// And the reverse: a company that enabled nothing is offered nothing in the
// first group, so the screen no longer reads as a setup checklist.
ok("a company with no services is offered no estimator up front",
  offeredFor([]).length === 0);

// Interior and exterior painting are ONE estimator. Either alone covers it, and
// enabling both must not offer it twice.
ok("interior painting alone covers the painting estimator",
  offeredFor(["interior_painting"]).includes("painting"));
ok("exterior painting alone covers it too",
  offeredFor(["exterior_painting"]).includes("painting"));
ok("both together still offer it once",
  offeredFor(["interior_painting", "exterior_painting"]).filter((t) => t === "painting").length === 1);

/* ══ 6. The detector, against the real company's real rows ═════════════════ */
//
// Company cmsl36it7000004juyw4qyn0u, read from the database on 26/08/2026 —
// the rows as they stood when he wrote in, not a scenario invented to pass.

section("The inconsistency detector, on the rows he actually has");

const HIS_SERVICES = [
  "flooring", "cabinet_refinishing", "interior_painting",
  "exterior_painting", "cabinet_refacing", "countertop", "stairs",
];
// Nine InstantQuoteConfig rows: six on, three saved OFF. The three matter — a
// row that exists and is disabled is a decision he already took, and nagging
// him about it would be telling a contractor he is wrong about his own business
// every time the page loads.
const HIS_INSTANT_ROWS = [
  { trade: "countertop", enabled: true },
  { trade: "cabinet_refacing", enabled: true },
  { trade: "parging", enabled: true },
  { trade: "lawn_mowing", enabled: true },
  { trade: "roofing", enabled: true },
  { trade: "junk_removal", enabled: true },
  { trade: "stair", enabled: false },
  { trade: "epoxy", enabled: false },
  { trade: "flooring", enabled: false },
];

const found = catalogueMismatches({
  enabledCategoryKeys: HIS_SERVICES,
  instantRows: HIS_INSTANT_ROWS,
  wiredTrades: wired,
});

// Direction one, the expensive one: a stranger can be quoted for work nobody
// here does. Four of them, and roofing — the one he noticed — is among them.
ok("flags exactly the instant quotes he offers for work he doesn't sell",
  JSON.stringify(found.instantWithoutService.map((f) => f.trade).sort()) ===
    JSON.stringify(["junk_removal", "lawn_mowing", "parging", "roofing"]),
  found.instantWithoutService.map((f) => f.trade));

ok("roofing is named with the catalogue's own word for it",
  found.instantWithoutService.find((f) => f.trade === "roofing")?.categoryLabels[0] === "Roofing");

// Direction two: he sells it, it can be quoted instantly, he has never once
// opened that card. Cabinet refinishing — the trade the company is named for —
// and painting.
ok("flags exactly the services he sells and has never set up",
  JSON.stringify(found.serviceWithoutInstant.map((f) => f.trade).sort()) ===
    JSON.stringify(["cabinet_refinishing", "painting"]),
  found.serviceWithoutInstant.map((f) => f.trade));

ok("interior and exterior painting are ONE finding, not two",
  found.serviceWithoutInstant.find((f) => f.trade === "painting")?.categoryKeys.length === 2);

// The three he saved OFF are absent from both lists. This is the assertion that
// makes "and nothing else" mean something.
const allFlagged = [...found.instantWithoutService, ...found.serviceWithoutInstant].map((f) => f.trade);
ok("a trade he deliberately switched off is not flagged",
  !allFlagged.includes("stair") && !allFlagged.includes("epoxy") && !allFlagged.includes("flooring"),
  allFlagged);

ok("countertop and cabinet refacing — on, and sold — are not flagged",
  !allFlagged.includes("countertop") && !allFlagged.includes("cabinet_refacing"));

ok("six findings in total, from nine rows and seven services", allFlagged.length === 6, allFlagged);

// A company in agreement with itself is told nothing at all. A banner that
// always has something to say is a banner nobody reads.
const clean = catalogueMismatches({
  enabledCategoryKeys: ["cabinet_refacing"],
  instantRows: [{ trade: "cabinet_refacing", enabled: true }],
  wiredTrades: wired,
});
ok("a consistent company is flagged with nothing",
  clean.instantWithoutService.length === 0 && clean.serviceWithoutInstant.length === 0, clean);

// A company that has never touched either screen is not scolded for it.
const empty = catalogueMismatches({ wiredTrades: wired });
ok("a brand-new company is flagged with nothing",
  empty.instantWithoutService.length === 0 && empty.serviceWithoutInstant.length === 0, empty);

// A trade the catalogue knows and this build has NOT wired must not be reported
// as something to go and set up — there would be no card to set up.
const unwired = catalogueMismatches({
  enabledCategoryKeys: ["stairs"],
  instantRows: [],
  wiredTrades: wired.filter((t) => t !== "stair"),
});
ok("a service whose estimator this build doesn't ship isn't flagged",
  unwired.serviceWithoutInstant.length === 0, unwired.serviceWithoutInstant);

// Hostile input: the detector is handed rows straight out of the database and a
// tenant's own custom quote type has a key the catalogue has never heard of.
//
// The only real pair in it (refacing, enabled and configured) is consistent, so
// anything reported came from the junk — which is the point. `not_a_trade` is
// the case that matters: an InstantQuoteConfig row for a trade this build no
// longer ships must not be reported to a contractor as HIS inconsistency.
const hostile = catalogueMismatches({
  enabledCategoryKeys: ["custom_abc123", null, "", "cabinet_refacing"],
  instantRows: [
    null,
    { trade: null },
    { trade: "not_a_trade", enabled: true },
    { enabled: true },
    { trade: "cabinet_refacing", enabled: true },
  ],
  wiredTrades: wired,
});
ok("a custom quote type, a retired trade and malformed rows produce no finding",
  hostile.instantWithoutService.length === 0 && hostile.serviceWithoutInstant.length === 0, hostile);

/* ══ 7. The definition answers all six questions ═══════════════════════════ */

section("One call answers what a trade is");

const refinishing = tradeDefinition("cabinet_refinishing");
ok("cabinet refinishing knows its industry", refinishing.industries.includes("painting"));
ok("…that it can be quoted instantly", refinishing.instantTrade === "cabinet_refinishing");
ok("…that it has a price book", refinishing.hasPriceBook === true);
ok("…that it is NOT a takeoff trade (it prices per door)", refinishing.hasTakeoff === false);
ok("…that it has intake questions", refinishing.hasIntakeFields === true);
ok("…that it ships standard add-on products", refinishing.hasStandardAddOns === true);
ok("…and which upgrades a quote can tick",
  refinishing.addOnFlagKeys.includes("softCloseHinges") &&
    refinishing.addOnFlagKeys.includes("handleHoles"),
  refinishing.addOnFlagKeys);

ok("a key this build doesn't ship resolves to null, not a throw",
  tradeDefinition("custom_abc123") === null && tradeDefinition(null) === null);

ok("every catalogue trade resolves to a definition",
  allTradeDefinitions().every(Boolean));

ok("every label is non-empty and every sortOrder is a number",
  allTradeDefinitions().every((d) => d.label && Number.isFinite(d.sortOrder)));

ok("categoryLabel falls back to the key rather than rendering 'undefined'",
  categoryLabel("nope") === "nope" && categoryLabel("roofing_service") === "Roofing");


/* ══ 7b. One product, more than one trade ══════════════════════════════════ */
//
// His Products list, read from the database on 26/08/2026: thirteen rows, every
// one filed under Cabinet Refacing. Five of them — hinges, slides, handles,
// glass inserts — are ALSO the standard add-ons for Cabinet Refinishing, the
// trade the company is named for, and his refinishing quotes could not offer
// any of them.
//
// Product.categories has always been many-to-many. The seeder just never used
// it: a name it already had was skipped, and skipping meant doing nothing, so
// pressing "add standard items" on Refinishing reported "already has its
// standard items" and moved five products' worth of nothing.

section("A product can serve more than one trade");

const REFACING_ID = "cat_refacing";
const REFINISHING_ID = "cat_refinishing";
// His thirteen rows, names verbatim, every one linked to refacing only.
const HIS_PRODUCTS = [
  "Sink / Undermount Cutout", "Waterfall Edge", "Countertop Removal & Disposal",
  "New Painted MDF Doors", "Thermofoil / Vinyl-Wrapped Doors", "Soft-Close Hinges",
  "Soft-Close Drawer Slides", "New Handles — supply & install", "Crown Moulding",
  "Glass Inserts", "Under-Cabinet LED Lighting", "Pull-Out Shelf",
  "Cabinet Box Skinning — veneer/laminate",
].map((name, i) => ({ id: `p${i}`, name, categoryIds: [REFACING_ID] }));

const plan = planStandardAddOns({
  addons: ADDONS_BY_CATEGORY.cabinet_refinishing,
  existing: HIS_PRODUCTS,
  categoryId: REFINISHING_ID,
});

ok("pressing 'add standard items' on Refinishing links what he already owns",
  plan.toLink.map((p) => p.name).sort().join(" | ") ===
    ["Glass Inserts", "New Handles — supply & install", "Soft-Close Drawer Slides", "Soft-Close Hinges"].join(" | "),
  plan.toLink.map((p) => p.name));

ok("…and creates only the one he genuinely doesn't have",
  plan.toCreate.map((a) => a.name).join(" | ") === "Two-Tone Finish",
  plan.toCreate.map((a) => a.name));

ok("nothing is duplicated — five names, five decisions, no second row",
  plan.toCreate.length + plan.toLink.length + plan.alreadyLinked.length ===
    ADDONS_BY_CATEGORY.cabinet_refinishing.length);

// Idempotence: running it a second time must move nothing. The first pass is
// what made the shared rows serve both trades; a second pass that "linked 4"
// again would be a button reporting work it did not do.
const after = HIS_PRODUCTS.map((p) =>
  plan.toLink.some((l) => l.id === p.id)
    ? { ...p, categoryIds: [...p.categoryIds, REFINISHING_ID] }
    : p,
).concat(plan.toCreate.map((a, i) => ({ id: `n${i}`, name: a.name, categoryIds: [REFINISHING_ID] })));

const second = planStandardAddOns({
  addons: ADDONS_BY_CATEGORY.cabinet_refinishing,
  existing: after,
  categoryId: REFINISHING_ID,
});
ok("running it again creates nothing and links nothing",
  second.toCreate.length === 0 && second.toLink.length === 0,
  { create: second.toCreate.map((a) => a.name), link: second.toLink.map((p) => p.name) });

// And the trade it was already seeded for stays a no-op, so the button on
// Refacing keeps saying "already has its standard items" — truthfully.
const refacingAgain = planStandardAddOns({
  addons: ADDONS_BY_CATEGORY.cabinet_refacing,
  existing: HIS_PRODUCTS,
  categoryId: REFACING_ID,
});
ok("the trade already seeded stays a genuine no-op",
  refacingAgain.toCreate.length === 0 && refacingAgain.toLink.length === 0,
  refacingAgain.toCreate.map((a) => a.name));

// A product the company DELETED on purpose must not come back as a link — it
// has no name to match, so it is created only if the company asks for the whole
// starter set again. Same rule as before this change.
const withoutHinges = HIS_PRODUCTS.filter((p) => p.name !== "Soft-Close Hinges");
const deleted = planStandardAddOns({
  addons: ADDONS_BY_CATEGORY.cabinet_refinishing,
  existing: withoutHinges,
  categoryId: REFINISHING_ID,
});
ok("a deleted product is re-created, never silently re-linked",
  deleted.toCreate.some((a) => a.name === "Soft-Close Hinges") &&
    !deleted.toLink.some((p) => p.name === "Soft-Close Hinges"));

ok("a trade with no starter set plans nothing",
  planStandardAddOns({ addons: [], existing: HIS_PRODUCTS, categoryId: REFINISHING_ID })
    .toCreate.length === 0);

ok("hostile input plans nothing rather than throwing",
  planStandardAddOns({}).toCreate.length === 0 &&
    planStandardAddOns({ addons: null, existing: [null, {}], categoryId: null }).toLink.length === 0);

/* ══ 8. Gaps, reported rather than invented ════════════════════════════════ */
//
// These are NOT failures. Padding them would mean publishing an answer nobody
// chose — the failure class AGENTS.md calls "absence of a statement is not a
// statement" — so they are printed for a human and the count is pinned so a new
// one shows up as a diff rather than sliding in.

section("Known gaps (reported, not failed)");

const noIndustry = categoriesWithoutIndustry();
console.log(`  · ${noIndustry.length} trades belong to no industry preset, reachable only via "show other trades":`);
console.log(`      ${noIndustry.join(", ")}`);
ok("that list has not grown", noIndustry.length === 12, noIndustry);

const instantNoIndustry = noIndustry.filter((k) => instantTradeForCategory(k));
console.log(`  · of those, ${instantNoIndustry.length} have a wired instant estimator — offered to every company on one screen, surfaced by no industry on the other:`);
console.log(`      ${instantNoIndustry.join(", ")}`);
ok("that list has not grown either", instantNoIndustry.length === 3, instantNoIndustry);

const noIntake = tradesMissingIntake();
console.log(`  · ${noIntake.length} priceable trades ship no intake questions: ${noIntake.join(", ") || "(none)"}`);

const unclaimedByAnyEstimator = wired.filter((t) => !primaryCategoryForInstantTrade(t));
console.log(`  · ${unclaimedByAnyEstimator.length} estimators file a draft under no category: ${unclaimedByAnyEstimator.join(", ") || "(none)"}`);
ok("only `painting` is unresolved, and deliberately so",
  JSON.stringify(unclaimedByAnyEstimator) === JSON.stringify(["painting"]),
  unclaimedByAnyEstimator);

console.log(
  failures === 0
    ? "\nTrade catalogue is consistent — every list resolves, no tenant row changes meaning.\n"
    : `\n${failures} check(s) failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
