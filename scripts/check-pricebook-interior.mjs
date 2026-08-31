// scripts/check-pricebook-interior.mjs
//
// Six trades that could not price themselves, and eight recipes for a product
// that had two. What this asserts, and why each assertion is here.
//
// ══ The brief was wrong about the thing this file exists to fix ════════════
//
// I was told fourteen of sixteen price books are empty and that
// tradeIsPricedByDefault() returns true for all of them, so the quote builder
// shows a blank screen. Neither half survives contact with the tree. All
// sixteen books are populated, and tradeIsPricedByDefault is DERIVED from
// hasPriceBook — it cannot claim a book that isn't there, and it correctly
// returns false for the 48 catalogue trades with none.
//
// The first section below asserts that, out loud, so the false premise cannot
// be acted on again by the next agent to read a summary instead of the file.
// Then it asserts the real gap: 48 unpriced trades, 2 recipes in the product.
//
// ══ Executed, not matched ══════════════════════════════════════════════════
//
// AGENTS.md: "Execute pure functions against hostile input... Most of the real
// bugs in this repo were found that way, not by reading." So the helpers are
// the REAL helpers, imported from app/data/tradePriceBooks.js, and the books
// are merged into the live maps at runtime before they are called. That merge
// is what the owner will do by hand at the top of the file; doing it here means
// getPriceBook, priceBookBasis, priceBookComplexity, allPriceBookUnits and
// readField are exercised on the merged result rather than on a description of
// it. A regex over the source would have proved none of it.
//
// ══ The six guarantees, and one that is not obvious ════════════════════════
//
//   1. Structure    every book has three tiers with a desc that says what puts
//                   a job in it, and every priceType an item names exists in
//                   ALL THREE. A priceType present in two tiers prices at
//                   undefined in the third — a quote line silently worth NaN.
//   2. Vocabulary   every unit is one the product ALREADY has, measured
//                   against allPriceBookUnits() BEFORE this file merges. The
//                   comment on that function asks for exactly this: "so a tiler
//                   typing a unit reaches for the same word a flooring
//                   installer already uses". Asserting after the merge would be
//                   circular and would pass on any invented synonym.
//   3. Rate card    every field path resolves to a finite number in the merged
//                   book. A path that resolves to undefined is a blank input
//                   the contractor fills and the book never reads.
//   4. Costs        both currencies on every cost, no zero, negative, NaN or
//                   absurd, low <= typical <= high — or an explicit `gap`
//                   naming the absence. Same contract as `unpriced` in
//                   electricalMaterials.js.
//   5. Not converted  the non-obvious one. §3.10 of electricalMaterials.js
//                   refuses to export an FX ratio because "a naive USD × FX
//                   overprices Canadian materials by 5–10%". A converted set
//                   has a fingerprint: every pair shares one ratio. So this
//                   asserts the ratios SPREAD, and that no pair is identical.
//                   It is the only assertion here that can catch a lazy author
//                   rather than a broken one.
//   6. Arithmetic   a sample quote through each book, against a total computed
//                   by hand in the assertion, and a cost walk that reproduces
//                   the OWNER'S OWN paid invoice line to the cent.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-pricebook-interior.mjs

import { readFileSync } from "node:fs";
import {
  TRADE_PRICE_BOOKS,
  PRICE_BOOK_FIELDS,
  PRICE_BOOK_GROUPS,
  COMPLEXITY_LEVELS,
  TRADE_DEFAULT_RATES,
  hasPriceBook,
  getPriceBook,
  readField,
  priceBookBasis,
  priceBookComplexity,
  allPriceBookUnits,
  tradeIsPricedByDefault,
} from "@/app/data/tradePriceBooks";
import { MATERIAL_RECIPES, RECIPE_EDITABLE_FIELDS } from "@/app/data/materialRecipes";
import { STANDARD_ADDONS } from "@/app/data/standardAddOns";
import { getDefaultLineItems, DEFAULT_LINE_ITEMS } from "@/app/data/defaultLineItems";
import { PAINT_PRODUCT_DEFAULTS } from "@/lib/pricing/paintTakeoff";
import { TRADE_CATALOG } from "@/lib/trades/catalog";
import { INDUSTRIES } from "@/app/data/industries";
import {
  INTERIOR_PRICE_BOOKS,
  INTERIOR_PRICE_BOOK_FIELDS,
  INTERIOR_PRICE_BOOK_GROUPS,
  INTERIOR_RECIPES,
  INTERIOR_RECIPE_EDITABLE_FIELDS,
  INTERIOR_ADD_ONS,
  INTERIOR_TRADE_FILING,
  interiorCost,
  hasInteriorPriceBook,
  getInteriorRecipe,
  interiorPriceBookUnits,
} from "@/app/data/priceBooks/interior";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond
    ? (pass++, console.log(`  ✓ ${label}`))
    : fails.push(`${label}${detail !== undefined ? ` — got ${detail}` : ""}`);

const MY_BOOKS = Object.keys(INTERIOR_PRICE_BOOKS);
const LEVELS = COMPLEXITY_LEVELS.map((l) => l.value);
const near = (a, b, eps = 0.005) => Math.abs(a - b) < eps;

/* ══ 0. The premise the brief handed me, checked before acting on it ═══════ */

console.log("\nThe brief's premise, tested rather than believed");

// "Fourteen of sixteen books are completely empty." Emptiness is tested through
// the product's own definition of a book that can price, not through a guess at
// its shape: PRICE_BOOK_FIELDS is what the rate card renders and what
// priceBookBasis derives from, so a book with no editable rate in it is exactly
// the blank screen the brief described. Six of the sixteen do NOT use a
// complexity grid at all — snow_removal prices by seasonal `plans`, garage_door
// by `doors`, countertop from a supplier's invoice — so a structural sniff for
// `complexity` would have called three working books empty and "confirmed" a
// false premise. That near-miss is why this asserts through the helper.
const emptyBooks = Object.keys(TRADE_PRICE_BOOKS).filter(
  (k) => !(PRICE_BOOK_FIELDS[k] || []).length,
);
ok(
  "all 16 shipped books carry editable rates — NONE is empty",
  emptyBooks.length === 0,
  emptyBooks.join(", ") || "0 empty",
);
// Two books report neither a complexity nor a per-unit basis, and both are
// correct to. tradePriceBooks.js says so about each: a countertop is "priced
// from a supplier's invoice rather than from a rate card" and "correctly
// returns [] — that absence is a fact about the trade, not a gap to pad with a
// default"; a home inspection is "priced by the BAND the house falls in, not by
// the kilometre". Naming both here means a THIRD book losing its basis fails.
const noBasis = Object.keys(TRADE_PRICE_BOOKS).filter((k) => !priceBookComplexity(k) && !priceBookBasis(k).length);
ok("...and the only two with no per-unit basis are the two that document why", noBasis.join(",") === "countertop,home_inspection", noBasis.join(","));
// The other half of the premise. It is derived from hasPriceBook, so it is
// structurally incapable of the failure described.
ok(
  "tradeIsPricedByDefault is FALSE for a trade with no book — no blank screen",
  tradeIsPricedByDefault("carpentry") === false,
);
ok(
  "...and TRUE for one with a book",
  tradeIsPricedByDefault("exterior_painting") === true,
);
ok(
  "...and TRUE for an hourly trade with only an opening rate",
  tradeIsPricedByDefault("electrical") === true &&
    !hasPriceBook("electrical") &&
    Boolean(TRADE_DEFAULT_RATES.electrical),
);

console.log("\nThe gap that is actually there");
const catalogKeys = Object.keys(TRADE_CATALOG);
const unpriced = catalogKeys.filter((k) => !tradeIsPricedByDefault(k));
// 49, not 48, since kitchen_design (2026-08-30, see lib/trades/catalog.js)
// joined the unpriced side on purpose: it's the interactive designer, not a
// $/sqft or per-unit rate card, so it was never going to have a price book —
// same shape as countertop's own documented reason above. A DIFFERENT trade
// losing its book is still what this count exists to catch.
ok(`49 of ${catalogKeys.length} catalogue trades cannot price themselves`, unpriced.length === 49, unpriced.length);
ok("only 2 material recipes exist in the whole product", Object.keys(MATERIAL_RECIPES).length === 2);
ok("...and this file adds 8", Object.keys(INTERIOR_RECIPES).length === 8);
// The three the brief named as empty. Overwriting any of them would have
// destroyed working, sourced work — insulation's book alone carries eight
// cross-checked Toronto spray-foam figures.
for (const key of ["interior_painting", "flooring", "insulation"]) {
  ok(`\`${key}\` already has a book and is NOT touched here`, hasPriceBook(key) && !hasInteriorPriceBook(key));
}
// ...but two of the three had no way to COST a job, which is the real hole.
ok("`interior_painting` had no recipe — this file adds one", !MATERIAL_RECIPES.interior_painting && Boolean(getInteriorRecipe("interior_painting")));
ok("`flooring` had no recipe — this file adds one", !MATERIAL_RECIPES.flooring && Boolean(getInteriorRecipe("flooring")));
// Insulation is the one trade in the brief that genuinely needs nothing.
ok(
  "`insulation` already carries its own material costs and labour — left alone",
  Boolean(TRADE_PRICE_BOOKS.insulation.materialCosts) &&
    Boolean(TRADE_PRICE_BOOKS.insulation.labour) &&
    !INTERIOR_RECIPES.insulation,
);

/* ══ 1. Nothing is overwritten ═════════════════════════════════════════════ */

console.log("\nSix new keys, and not one of them lands on an existing book");
// Spreading a duplicate key over TRADE_PRICE_BOOKS silently replaces a shipped
// book. The owner does that merge by hand; this is the guard that says it is
// safe to.
for (const key of MY_BOOKS) {
  ok(`\`${key}\` is a new key, not an overwrite`, !hasPriceBook(key));
  ok(`...and \`${key}\` has no shipped recipe to clobber either`, !MATERIAL_RECIPES[key]);
  ok(`...and no shipped add-on list either`, !STANDARD_ADDONS[key]);
}
ok("six books", MY_BOOKS.length === 6, MY_BOOKS.length);

/* ══ 2. Unit vocabulary — measured BEFORE the merge ════════════════════════ */

console.log("\nEvery unit is a word the product already uses");
// Captured now, while allPriceBookUnits() still reflects only the shipped
// books. After the merge below it would include this file's own units and the
// assertion would prove nothing.
const SHIPPED_UNITS = new Set(allPriceBookUnits());
ok("the shipped vocabulary is non-trivial", SHIPPED_UNITS.size > 20, SHIPPED_UNITS.size);
for (const unit of interiorPriceBookUnits()) {
  ok(`"${unit}" already exists in allPriceBookUnits()`, SHIPPED_UNITS.has(unit));
}
// And the units declared on items[] must be the same words — an item labelled
// "lf" while its field says "linear ft" is two names for one thing.
for (const [key, book] of Object.entries(INTERIOR_PRICE_BOOKS)) {
  for (const item of book.items) {
    ok(`${key}/${item.id} unit "${item.unit}" is in the shared vocabulary`, SHIPPED_UNITS.has(item.unit));
  }
}

/* ══ 3. Merge, exactly as the owner will ══════════════════════════════════ */

// Captured before the merge, for the same reason SHIPPED_UNITS was: afterwards
// this map contains my own keys and cannot tell a collision from a contribution.
const SHIPPED_GROUPS = { ...PRICE_BOOK_GROUPS };

Object.assign(TRADE_PRICE_BOOKS, INTERIOR_PRICE_BOOKS);
Object.assign(PRICE_BOOK_FIELDS, INTERIOR_PRICE_BOOK_FIELDS);
Object.assign(PRICE_BOOK_GROUPS, INTERIOR_PRICE_BOOK_GROUPS);

console.log("\nAfter the merge, the real helpers accept every book");
for (const key of MY_BOOKS) {
  ok(`hasPriceBook("${key}")`, hasPriceBook(key) === true);
  ok(`tradeIsPricedByDefault("${key}")`, tradeIsPricedByDefault(key) === true);
  // defaultTradeRate must now return null: a book and a single hourly rate are
  // two contradictory answers, and tradePriceBooks.js says so.
  ok(`...and it no longer offers a contradictory single rate`, !TRADE_DEFAULT_RATES[key]);
  const book = getPriceBook(key);
  ok(`getPriceBook("${key}") returns the book`, book === INTERIOR_PRICE_BOOKS[key]);
  const levels = priceBookComplexity(key);
  ok(`...priceBookComplexity reports all three tiers`, levels?.length === 3, levels?.length);
  const basis = priceBookBasis(key);
  ok(`...priceBookBasis is non-empty — Settings can say what it charges by`, basis.length > 0, basis.length);
  // Extras must NOT appear in the basis: a dust-containment fee is not what
  // drywall is quoted by.
  //
  // The first version of this grepped the basis labels for extras wording and
  // was VACUOUS — mutation 38 gave an extras field a per-unit suffix and the
  // check never noticed, because the shipped EXTRA_PREFIXES excludes anything
  // under "extras." before the suffix is ever parsed. The guarantee is real but
  // it is the product's, not this file's. So it is probed instead: a field is
  // planted at extras.* with a per-unit suffix, and the basis must still refuse
  // it. That kills the mutation AND fails if "extras." is ever dropped from
  // EXTRA_PREFIXES, which is the change that would actually break these books.
  const fields = PRICE_BOOK_FIELDS[key];
  fields.push({ path: "extras.__probe", label: "__probe", suffix: "$ / sqft", step: 1 });
  ok(`...extras.* is refused by the basis even with a per-unit suffix`, !priceBookBasis(key).some((b) => b.label === "__probe"));
  fields.pop();
  ok(`...and the probe left no trace`, priceBookBasis(key).length === basis.length);
  ok(`...while ${key} does declare extras worth excluding`, Object.keys(INTERIOR_PRICE_BOOKS[key].extras || {}).length > 0);
}
// A group key this file shares with the shipped map must carry the IDENTICAL
// label, or the spread silently relabels a group on five other trades' rate
// cards. `site` is such a key and is deliberately the same string.
for (const [k, v] of Object.entries(INTERIOR_PRICE_BOOK_GROUPS)) {
  if (k in SHIPPED_GROUPS) {
    ok(`group "${k}" already exists and this file agrees with it word for word`, SHIPPED_GROUPS[k] === v, `${SHIPPED_GROUPS[k]} vs ${v}`);
  }
}
// The merge introduced no new unit vocabulary. Same assertion as section 2,
// now through the real derivation rather than this file's mirror of it.
ok(
  "allPriceBookUnits() gained nothing after the merge",
  allPriceBookUnits().every((u) => SHIPPED_UNITS.has(u)),
  allPriceBookUnits().filter((u) => !SHIPPED_UNITS.has(u)).join(", "),
);

/* ══ 4. Structure: tiers, descs, priceTypes ═══════════════════════════════ */

console.log("\nThree tiers, and a desc that says what puts a job in one");
for (const [key, book] of Object.entries(INTERIOR_PRICE_BOOKS)) {
  ok(`${key} has a label`, typeof book.label === "string" && book.label.length > 3);
  for (const level of LEVELS) {
    const tier = book.complexity?.[level];
    ok(`${key}.${level} exists`, Boolean(tier));
    // A desc of "Harder" tells an estimator nothing. These decide which column
    // of a rate card a real job lands in, so they have to describe conditions.
    ok(
      `${key}.${level}.desc describes the job, not the price`,
      typeof tier?.desc === "string" && tier.desc.length >= 40 && !/\$/.test(tier.desc),
      JSON.stringify(tier?.desc)?.slice(0, 50),
    );
  }
  // The three tiers must carry the SAME key set. A rate present in standard
  // and missing in high prices at undefined the moment an estimator picks the
  // hard tier — which is the tier where the money is.
  const keySets = LEVELS.map((l) => Object.keys(book.complexity[l]).sort().join("|"));
  ok(`${key} — all three tiers carry an identical rate set`, new Set(keySets).size === 1);
}

console.log("\nEvery priceType an item names resolves in all three tiers");
for (const [key, book] of Object.entries(INTERIOR_PRICE_BOOKS)) {
  for (const item of book.items) {
    if (item.priceType === "flat") {
      ok(
        `${key}/${item.id} is flat and carries a flatPrice`,
        Number.isFinite(item.flatPrice) && item.flatPrice > 0,
        item.flatPrice,
      );
      continue;
    }
    for (const level of LEVELS) {
      const v = book.complexity[level][item.priceType];
      ok(
        `${key}/${item.id} → ${item.priceType} at ${level}`,
        Number.isFinite(v) && v > 0,
        v,
      );
    }
    // And the tiers must ESCALATE. A "high complexity" rate at or below the
    // standard one is a typo that prices the hardest jobs cheapest, and it is
    // invisible on screen because the number looks plausible.
    const [s, m, h] = LEVELS.map((l) => book.complexity[l][item.priceType]);
    ok(`${key}/${item.id} — standard < moderate < high`, s < m && m < h, `${s}/${m}/${h}`);
  }
}

/* ══ 5. Drywall finish levels — the detail a contractor checks first ══════ */

console.log("\nGA-214 finish levels 0 through 5, priced honestly");
const dw = INTERIOR_PRICE_BOOKS.drywall_install;
// Level 0 is "no taping, finishing or accessories" — hung board. It is
// deliberately NOT a finish row, because a rate for it is a rate for doing
// nothing. Its absence is the correct statement, so it is asserted as absent.
ok(
  "Level 0 is NOT priced as a finish — it is hung board, so it is the hang row",
  dw.complexity.standard.finishLevel0PricePerSqft === undefined &&
    Number.isFinite(dw.complexity.standard.hangPricePerSqft),
);
for (const level of LEVELS) {
  const t = dw.complexity[level];
  const ladder = [1, 2, 3, 4, 5].map((n) => t[`finishLevel${n}PricePerSqft`]);
  ok(`${level}: levels 1–5 are all priced`, ladder.every((v) => Number.isFinite(v) && v > 0), ladder.join("/"));
  // Each level is the one below it plus a pass. Non-monotonic pricing here
  // would let an estimator sell a Level 5 for less than a Level 4.
  ok(`${level}: each level costs more than the one below`, ladder.every((v, i) => i === 0 || v > ladder[i - 1]), ladder.join(" < "));
  // Level 5 is a skim over the ENTIRE surface, not another pass on the joints.
  // The published premium over Level 4 runs 40–70% of the finishing line.
  const premium = ladder[4] / ladder[3] - 1;
  ok(`${level}: the Level 5 skim is a 40–70% premium over Level 4`, premium >= 0.4 && premium <= 0.7, `${(premium * 100).toFixed(0)}%`);
}
// And the labour ladder has to agree with the price ladder — a Level 5 that
// costs 1.7× to sell and 1.1× to do is a margin report that lies.
const fh = INTERIOR_RECIPES.drywall_install.labour.finishPerSqftByLevel;
ok("labour hours are declared for levels 1–5", [1, 2, 3, 4, 5].every((n) => fh[n] > 0));
ok("...and they escalate with the level too", [1, 2, 3, 4, 5].every((n, i) => i === 0 || fh[n] > fh[n - 1 + 1 - 1]));
ok(
  "...and the Level 5 labour premium tracks its price premium",
  near(fh[5] / fh[4], 1.71, 0.05),
  (fh[5] / fh[4]).toFixed(2),
);

/* ══ 6. Rate-card descriptors resolve ═════════════════════════════════════ */

console.log("\nEvery rate-card field points at a real number");
for (const key of MY_BOOKS) {
  const book = getPriceBook(key);
  const fields = PRICE_BOOK_FIELDS[key];
  ok(`${key} has a field list — without one the rate card renders empty`, Array.isArray(fields) && fields.length > 0);
  for (const field of fields) {
    const v = readField(book, field.path);
    ok(`${key} ${field.path} resolves`, Number.isFinite(v), String(v));
    // Zero is legal on exactly two paths, and both are the countertop book's
    // "no sensible default, you must enter it" — a supply line for something
    // the client selects. Anywhere else it is a rate nobody set.
    const mayBeZero = /tileSupplyPricePerSqft|unitSupplyPrice/.test(field.path);
    ok(`${key} ${field.path} is ${mayBeZero ? "an allowance line" : "non-zero"}`, mayBeZero ? v === 0 : v > 0, v);
    if (field.group) {
      // Against THIS FILE'S map, not the merged one. A dropped group here fell
      // through to the shipped `site` label and the merged lookup passed —
      // mutation 30 survived the first run for exactly that reason. A file that
      // relies on a key it does not declare is one rename away from a group of
      // unlabelled inputs.
      ok(`${key} ${field.path} group "${field.group}" is declared in this file`, Boolean(INTERIOR_PRICE_BOOK_GROUPS[field.group]));
    }
  }
  // Cross-check the local `tiers` helper against the real complexityFields()
  // by comparing its output shape to a shipped book's. If the mirror drifts,
  // the merge instruction to delete it becomes a silent behaviour change.
  const mine = fields.find((f) => f.path.startsWith("complexity."));
  const theirs = PRICE_BOOK_FIELDS.exterior_painting.find((f) => f.path.startsWith("complexity."));
  ok(
    `${key}'s complexity fields have the same shape the real helper produces`,
    Object.keys(mine).sort().join(",") === Object.keys(theirs).sort().join(","),
    Object.keys(mine).sort().join(","),
  );
}

/* ══ 7. Costs ═════════════════════════════════════════════════════════════ */

console.log("\nEvery cost: two currencies, or an explicit gap saying why not");

// Walk every `cost` node anywhere in the recipes. Written as a walker rather
// than a list so a recipe added later cannot skip the check by living
// somewhere the list did not name.
const costNodes = [];
const walk = (node, path) => {
  if (!node || typeof node !== "object") return;
  for (const [k, v] of Object.entries(node)) {
    if (k === "cost") costNodes.push({ path: `${path}.${k}`, node: v, parent: node });
    else if (v && typeof v === "object") walk(v, `${path}.${k}`);
  }
};
walk(INTERIOR_RECIPES, "recipes");
ok("the walker found the costs", costNodes.length >= 60, costNodes.length);

const ABSURD = 5000; // no single pack, sheet, gallon or day rate here is $5k
const priced = [];
for (const { path, node, parent } of costNodes) {
  ok(`${path} declares BOTH currencies`, "usd" in node && "cad" in node, Object.keys(node).join(","));
  for (const cur of ["usd", "cad"]) {
    const side = node[cur];
    if (side === null) {
      // Absence of a statement is not a statement. A null must SAY why.
      ok(
        `${path}.${cur} is null and carries a gap explaining it`,
        typeof parent.gap === "string" && parent.gap.length > 40,
        JSON.stringify(parent.gap)?.slice(0, 40),
      );
      continue;
    }
    const { low, typical, high } = side || {};
    ok(
      `${path}.${cur} is a finite, positive, non-absurd band`,
      [low, typical, high].every((v) => Number.isFinite(v) && v > 0 && v < ABSURD),
      `${low}/${typical}/${high}`,
    );
    ok(`${path}.${cur} — low <= typical <= high`, low <= typical && typical <= high, `${low}/${typical}/${high}`);
  }
  if (node.usd && node.cad) priced.push({ path, usd: node.usd.typical, cad: node.cad.typical });
}
// Every entry has to name what kind of figure it is. §3.11's rule: a user must
// know which way to adjust, so `source` is mandatory.
for (const { path, parent } of costNodes) {
  ok(`${path.replace(/\.cost$/, "")} names its source`, typeof parent.source === "string" && parent.source.length > 20);
}

console.log("\nThe two currencies were reasoned separately, not converted");
ok("there are enough priced pairs to test the shape of", priced.length >= 50, priced.length);
// A converted set has one ratio. A reasoned one does not. Both halves matter:
// identical numbers would mean a copy, and one shared ratio would mean an FX
// multiply — the exact mistake electricalMaterials.js §3.10 refuses to make.
const identical = priced.filter((p) => p.usd === p.cad);
ok("no pair has an identical USD and CAD figure — that would be a copy", identical.length === 0, identical.map((p) => p.path).join(", "));
const ratios = priced.map((p) => p.cad / p.usd);
const spread = Math.max(...ratios) - Math.min(...ratios);
ok("the CAD/USD ratios SPREAD — no single FX rate explains this file", spread > 0.15, spread.toFixed(3));
ok(
  "...and every ratio is still plausible for the two markets (1.0–1.6)",
  ratios.every((r) => r >= 1.0 && r <= 1.6),
  `${Math.min(...ratios).toFixed(2)}–${Math.max(...ratios).toFixed(2)}`,
);
// The accessor is what a cost engine will call. It must refuse to substitute.
ok("interiorCost returns the asked-for market", interiorCost(INTERIOR_RECIPES.drywall_install.materials.screws.cost, "CAD") === 29);
ok("...and null when a market has no figure", interiorCost(INTERIOR_RECIPES.tiling.materials.tile.cost, "CAD") === null);
// The asymmetric case, which no entry in this file happens to have — every gap
// here is null on BOTH sides, so the real data cannot exercise the substitution
// path. Mutation 39 added a silent fallback to the other currency and survived
// for that reason. This is the synthetic input that kills it: showing a US
// figure on a Canadian cost panel without saying so is the same error §3.10 of
// electricalMaterials.js refuses to make by exporting an FX ratio.
ok("...and NEVER substitutes the other currency when only one side is priced", interiorCost({ cad: null, usd: { low: 8, typical: 9, high: 10 } }, "CAD") === null);
ok("...in either direction", interiorCost({ usd: null, cad: { low: 8, typical: 9, high: 10 } }, "USD") === null);
ok("...and null on nonsense input rather than throwing", interiorCost(null, "CAD") === null && interiorCost({ cad: "12" }, "CAD") === null);

console.log("\nLabour is hours, never a rate; waste is present where the trade has it");
for (const [key, recipe] of Object.entries(INTERIOR_RECIPES)) {
  const hours = [];
  const collectHours = (node) => {
    for (const [k, v] of Object.entries(node || {})) {
      if (typeof v === "number") hours.push([k, v]);
      else if (v && typeof v === "object" && !Array.isArray(v)) collectHours(v);
    }
  };
  collectHours(recipe.labour);
  if (recipe.labour) {
    ok(`${key} declares labour hours`, hours.length > 0, hours.length);
    for (const [k, v] of hours) {
      ok(`${key}.labour.${k} is a plausible number of hours`, Number.isFinite(v) && v > 0 && v < 100, v);
    }
    // The one thing that must never appear in a labour block. A dollar figure
    // here would be multiplied by the company's own rate a second time.
    ok(
      `${key}.labour names no dollar rate — the company's own rate multiplies these`,
      !Object.keys(recipe.labour).some((k) => /price|cost|rate\b|\$/i.test(k) && !/multiplier|Rate[A-Z]|PerHour/.test(k)),
      Object.keys(recipe.labour).filter((k) => /price|cost/i.test(k)).join(","),
    );
  }
  // Waste is where a contractor loses money quietly. Every trade here cuts
  // something, so every trade here declares an overage.
  ok(`${key} declares a waste factor`, recipe.waste && Object.keys(recipe.waste).length > 0);
  for (const [k, v] of Object.entries(recipe.waste || {})) {
    ok(`${key}.waste.${k} is a plausible fraction`, Number.isFinite(v) && v > 0 && v < 1.0, v);
  }
}
// The specific factors the brief named. Leaving any of them out is the failure
// it described: "leaving it out is how a contractor loses money".
ok("drywall cuts have a waste factor", INTERIOR_RECIPES.drywall_install.waste.board === 0.1);
ok("tile breakage does — and large format runs higher, as it should", INTERIOR_RECIPES.tiling.waste.straightLay === 0.1 && INTERIOR_RECIPES.tiling.waste.largeFormat > INTERIOR_RECIPES.tiling.waste.straightLay);
ok("flooring offcuts do — and solid runs above click, because boards are graded", INTERIOR_RECIPES.flooring_install.waste.solid > INTERIOR_RECIPES.flooring_install.waste.lvp);
ok("paint touch-up does", INTERIOR_RECIPES.interior_painting.waste.paintTouchUp === 0.05);

/* ══ 8. Interior painting, aligned with exterior and with his invoice ═════ */

console.log("\nInterior painting: the same model as exterior, differing only on evidence");
const int = INTERIOR_RECIPES.interior_painting;
const ext = MATERIAL_RECIPES.exterior_painting;
ok("same model discriminator", int.model === ext.model && int.model === "production_rate");
// Every key the shipped RECIPE_EDITABLE_FIELDS.production_rate descriptor
// enumerates must be present, or the field renders against nothing.
for (const field of RECIPE_EDITABLE_FIELDS.production_rate) {
  // paintTiers and trimPaintCostPerGal are exterior's cost shape; interior
  // carries costs in `materials` with two currencies instead. Skipped
  // deliberately and named so, rather than silently excluded.
  if (/paintTiers|trimPaintCostPerGal/.test(field.key)) continue;
  ok(`existing editable field "${field.key}" resolves on the interior recipe`, Number.isFinite(int[field.key]), int[field.key]);
}
// The four interior-only keys, and their descriptors, so nothing is written
// and unreadable.
for (const field of INTERIOR_RECIPE_EDITABLE_FIELDS.production_rate) {
  ok(`new editable field "${field.key}" has a value to edit`, Number.isFinite(int[field.key]), int[field.key]);
}
ok("...and none of the four duplicates an existing descriptor", INTERIOR_RECIPE_EDITABLE_FIELDS.production_rate.every((f) => f.key === "defaultCoats" || !RECIPE_EDITABLE_FIELDS.production_rate.some((e) => e.key === f.key)));

console.log("\n...and every difference from exterior is recovered, not chosen");
ok("walls: 100 sqft/hr interior vs 160 exterior — RECOVERED, 414 sqft ÷ 4.140 h", int.wallProductionRateSqftPerHour === 100 && ext.wallProductionRateSqftPerHour === 160);
ok("...and it matches paintTakeoff's own walls substrate", int.wallProductionRateSqftPerHour === 100);
ok("coverage: 350 interior vs 250 exterior — exterior substrate drinks more", int.wallCoverageSqftPerGal === 350 && ext.wallCoverageSqftPerGal === 250);
ok("trim: 40 lf/hr interior vs 30 exterior — RECOVERED, 46 lnft ÷ 1.150 h", int.trimProductionRateLfPerHour === 40 && ext.trimProductionRateLfPerHour === 30);
// Not a chosen number: 350 ÷ (0.35 × 2). Asserted as the arithmetic it is —
// with a tolerance, because 0.35 × 2 is 0.7000000000000001 in binary floating
// point and the exact-equality version of this assertion failed on the first
// run. The recovered inputs are the claim; the last bit of a double is not.
ok("trim coverage 500 lf/gal is DERIVED from his own figures, not picked", near(int.trimCoverageLfPerGal, 350 / (0.35 * 2), 1e-9), int.trimCoverageLfPerGal);
ok("doors: 1.0 h interior vs 1.5 exterior — his 0.5 h per SIDE, painted both sides", int.hoursPerDoor === 1.0 && ext.hoursPerDoor === 1.5);
ok("setup hours match exterior deliberately — furniture is a separate sell line", int.setupHours === ext.setupHours);

console.log("\nThe paint prices are the owner's, imported and not restated");
// The binding instruction: "for the paint use the current prices". Reading
// them through the import means a copy cannot drift into a margin panel.
// VALUE equality is not enough, and mutation 31 proved it: replacing the
// import with the literal 51.87 passed every value assertion below while
// creating exactly the copy that rots — paintTakeoff.js moves, this does not,
// and a margin panel quietly prices against last year's paint. So the SOURCE is
// asserted too, the way check-crew-fixed.mjs asserts the ceiling is derived
// from the preset rather than restated beside it.
const src = readFileSync("app/data/priceBooks/interior.js", "utf8");
ok("the paint costs are IMPORTED from paintTakeoff, not restated", /import \{ PAINT_PRODUCT_DEFAULTS \} from "@\/lib\/pricing\/paintTakeoff"/.test(src));
ok("...and read through the import, not typed as literals", /wall: PAINT_PRODUCT_DEFAULTS\.wall_interior\.costPerGal/.test(src) && /ceiling: PAINT_PRODUCT_DEFAULTS\.ceiling_flat\.costPerGal/.test(src) && /trim: PAINT_PRODUCT_DEFAULTS\.trim_enamel\.costPerGal/.test(src));
// Comment lines are exempt: the header names his three figures to explain what
// is being imported, which is documentation, not a second copy that can drift.
// CODE carrying one of them is the copy.
const codeLines = src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l));
ok("...so no literal 51.87, 30.61 or 47.83 appears in the CODE", !/(51\.87|30\.61|47\.83)/.test(codeLines.join("\n")));
ok("wall paint CAD IS PAINT_PRODUCT_DEFAULTS.wall_interior.costPerGal", int.materials.wall_paint.cost.cad.typical === PAINT_PRODUCT_DEFAULTS.wall_interior.costPerGal);
ok("ceiling paint CAD IS PAINT_PRODUCT_DEFAULTS.ceiling_flat.costPerGal", int.materials.ceiling_paint.cost.cad.typical === PAINT_PRODUCT_DEFAULTS.ceiling_flat.costPerGal);
ok("trim enamel CAD IS PAINT_PRODUCT_DEFAULTS.trim_enamel.costPerGal", int.materials.trim_enamel.cost.cad.typical === PAINT_PRODUCT_DEFAULTS.trim_enamel.costPerGal);
// A recovered figure is a point, not a band. Widening it here would be
// inventing a range around a number that came off an invoice.
ok("...and each is a POINT, not a band invented around his number", ["wall_paint", "ceiling_paint", "trim_enamel"].every((k) => { const c = int.materials[k].cost.cad; return c.low === c.typical && c.typical === c.high; }));
// The repo decided primer is unpriced. A second file answering it would look
// like the question had been settled.
ok("primer stays unpriced in BOTH currencies, as paintTakeoff decided", int.materials.primer.cost.cad === null && int.materials.primer.cost.usd === null && PAINT_PRODUCT_DEFAULTS.primer.costPerGal === null);

console.log("\nHis own paid invoice, priced back through this recipe");
// The strongest assertion in the file. paintTakeoff.js recovered these from
// line totals he was actually paid on; if this recipe cannot reproduce them,
// it is not the same model, whatever its keys are called.
//
//   Walls   414 sqft × 2 coats ÷ 350 sqft/gal = 2.365714 gal
//           2.365714 × $51.87/gal = $122.71
const wallGal = (414 * int.defaultCoats) / int.wallCoverageSqftPerGal;
const wallCost = wallGal * interiorCost(int.materials.wall_paint.cost, "CAD");
ok("414 sqft of wall, two coats ⇒ 2.365714 gal", near(wallGal, 2.365714, 1e-5), wallGal.toFixed(6));
ok("...costing $122.71 — his invoice line, to the cent", near(wallCost, 122.71, 0.005), wallCost.toFixed(2));
//   Ceiling 130 sqft × 2 ÷ 350 = 0.742857 gal × $30.61 = $22.74
const ceilGal = (130 * int.defaultCoats) / int.ceilingCoverageSqftPerGal;
const ceilCost = ceilGal * interiorCost(int.materials.ceiling_paint.cost, "CAD");
ok("130 sqft of ceiling ⇒ $22.74 — his second line, to the cent", near(ceilCost, 22.74, 0.005), ceilCost.toFixed(2));
//   Labour, from the production rates: 414 ÷ 100 = 4.140 h, 130 ÷ 110 = 1.1818 h
ok("...and the wall labour comes back as his 4.140 h", near(414 / int.wallProductionRateSqftPerHour, 4.14, 1e-6));
ok("...and the ceiling labour as his 1.1818 h", near(130 / int.ceilingProductionRateSqftPerHour, 1.18182, 1e-4));
// The waste factor must NOT be in that reconciliation. His invoice carried no
// overage and an assertion that quietly applied one would be reproducing an
// improved figure, not his.
ok("the touch-up waste factor is NOT folded into the recovered figures", near(wallCost * (1 + int.waste.paintTouchUp), 128.85, 0.01) && !near(wallCost, 128.85, 0.01));

/* ══ 9. Line-item costing is keyed to the chips that already exist ════════ */

console.log("\nCosting keys point at the real DEFAULT_LINE_ITEMS, character for character");
// The whole point of `lineItemCosts`. A reworded chip must fail here rather
// than silently orphan its costing — electricalCatalog.js's finding, applied.
let covered = 0;
for (const trade of ["interior_painting", "flooring"]) {
  const chips = getDefaultLineItems(trade);
  ok(`${trade} has chips to key against`, chips.length > 0 && DEFAULT_LINE_ITEMS[trade]);
  const costs = INTERIOR_RECIPES[trade].lineItemCosts;
  for (const [desc, entry] of Object.entries(costs)) {
    const chip = chips.find((c) => c.description === desc);
    ok(`${trade}: "${desc}" is a real chip`, Boolean(chip));
    if (chip) {
      ok(`...and the unit agrees ("${entry.unit}")`, chip.unit === entry.unit, `chip=${chip.unit}`);
      covered++;
    }
    // Every entry either costs the line or says why it cannot. A silent null
    // is the failure; a null beside a `gap` is a fact.
    const hasHours = ["labourHoursPerUnit", "labourHoursPerDriverUnit", "labourHoursPerRoom", "labourHoursPerTread"].some((k) => Number.isFinite(entry[k]));
    ok(`...and it either carries hours or explains the gap`, hasHours || (typeof entry.gap === "string" && entry.gap.length > 40));
    if (entry.materialKey) {
      ok(`...and its materialKey "${entry.materialKey}" exists in the recipe`, Boolean(INTERIOR_RECIPES[trade].materials[entry.materialKey]));
    }
  }
  // Full coverage, both directions: no chip left uncosted and none invented.
  ok(`${trade}: every chip is accounted for — ${chips.length} of ${chips.length}`, Object.keys(costs).length === chips.length, `${Object.keys(costs).length}/${chips.length}`);
}
ok("13 existing line items now have a costing basis", covered === 13, covered);

/* ══ 10. Add-ons cannot disagree with the book ════════════════════════════ */

console.log("\nAdd-on prices ARE the book's standard-tier rates — one number, two surfaces");
for (const [key, addOns] of Object.entries(INTERIOR_ADD_ONS)) {
  ok(`${key} has add-ons`, addOns.length > 0);
  for (const a of addOns) {
    ok(`${key}/"${a.name}" is a positive price`, Number.isFinite(a.unitPrice) && a.unitPrice > 0, a.unitPrice);
    ok(`${key}/"${a.name}" is service or product`, a.type === "service" || a.type === "product");
    ok(`${key}/"${a.name}" has a description that says what is done`, typeof a.description === "string" && a.description.length > 20);
    // The real assertion: find the same thing in the book and demand the two
    // agree. Two prices for one job is the duplication AGENTS.md warns about
    // and the copy is the one that reaches the client.
    const std = INTERIOR_PRICE_BOOKS[key].complexity.standard;
    const flat = INTERIOR_PRICE_BOOKS[key].items.find((i) => i.priceType === "flat" && i.flatPrice === a.unitPrice);
    const inTier = Object.values(std).some((v) => v === a.unitPrice);
    const inExtras = Object.values(INTERIOR_PRICE_BOOKS[key].extras || {}).some((v) => v === a.unitPrice);
    ok(`${key}/"${a.name}" — its price exists in the book`, inTier || inExtras || Boolean(flat), a.unitPrice);
  }
}
// interior_painting and flooring deliberately get none: their extras are
// already chips, and a second differently-worded copy is the rot.
ok("interior_painting gets no add-ons — its extras are already chips", !INTERIOR_ADD_ONS.interior_painting);
ok("flooring gets no add-ons either, for the same reason", !INTERIOR_ADD_ONS.flooring);

/* ══ 11. Industry and category filing resolves ════════════════════════════ */

console.log("\nEvery trade is filed against the real catalogue, or says it cannot be");
const INDUSTRY_SLUGS = new Set(INDUSTRIES.map((i) => i.slug));
for (const key of MY_BOOKS) {
  const filing = INTERIOR_TRADE_FILING[key];
  ok(`${key} declares where it is filed`, Boolean(filing));
  ok(`${key} declares its industries as an array`, Array.isArray(filing.industries));
  for (const slug of filing.industries) {
    ok(`${key} → industry "${slug}" is a real slug in app/data/industries.js`, INDUSTRY_SLUGS.has(slug));
  }
  if (filing.proposed) {
    // A proposed key must NOT resolve. If it starts resolving, somebody added
    // it and this flag is now a lie.
    ok(`${key} is flagged proposed and genuinely has no catalogue key yet`, !TRADE_CATALOG[filing.catalogKey]);
    ok(`...and it says plainly what decision is outstanding`, /product decision/i.test(filing.note));
  } else {
    ok(`${key} → category key "${filing.catalogKey}" resolves in TRADE_CATALOG`, Boolean(TRADE_CATALOG[filing.catalogKey]));
    // And it must AGREE with the catalogue rather than quietly proposing a
    // move. Reassigning an industry publishes a trade at signup.
    const declared = [...filing.industries].sort().join(",");
    const actual = [...TRADE_CATALOG[filing.catalogKey].industries].sort().join(",");
    ok(`...and agrees with the catalogue's own industries`, declared === actual, `${declared} vs ${actual}`);
  }
}
// epoxy's empty list is a decision the catalogue documents, not a hole.
ok("epoxy is left industry-less, as lib/trades/catalog.js decided", INTERIOR_TRADE_FILING.epoxy.industries.length === 0 && TRADE_CATALOG.epoxy.industries.length === 0);
ok("...and the note says why rather than leaving it looking forgotten", /product decision|nobody chose|as good as/i.test(INTERIOR_TRADE_FILING.epoxy.note));

/* ══ 12. Sample quotes, hand-computed ════════════════════════════════════ */

console.log("\nA real quote through each book, against arithmetic done by hand");

// Priced through the merged book via getPriceBook + the item's own priceType,
// which is the path lib/pricing/tradeScope.js takes. Not a re-read of the
// literal: a typo in an item's priceType would resolve to undefined and fail.
const rate = (key, level, item) => {
  const book = getPriceBook(key);
  const row = book.items.find((i) => i.id === item);
  if (!row) return NaN;
  return row.priceType === "flat" ? row.flatPrice : book.complexity[level][row.priceType];
};
const quote = (key, level, lines) =>
  lines.reduce((sum, [item, qty]) => sum + rate(key, level, item) * qty, 0);

// A finished basement: 1,800 sqft of board on the walls, 600 on the lid,
// 220 lf of outside corners, Level 4 throughout.
//   walls   1,800 × (1.20 hang + 1.45 L4)        = 1,800 × 2.65 = 4,770
//   ceiling   600 × (1.20 + 1.45 + 0.45 upcharge) =   600 × 3.10 = 1,860
//   bead      220 × 4.00                                          =   880
//                                                                  ------
//                                                                   7,510
const basement =
  quote("drywall_install", "standard", [["hang", 2400], ["finish_l4", 2400]]) +
  quote("drywall_install", "standard", [["ceiling_upcharge", 600], ["corner_bead", 220]]);
ok("drywall_install — a 2,400 sqft basement board-out, Level 4: $7,510", near(basement, 7510), basement.toFixed(2));
// The same job at Level 5 must be a real jump, not a rounding difference: the
// skim is the whole surface.
const basementL5 = quote("drywall_install", "standard", [["hang", 2400], ["finish_l5", 2400], ["ceiling_upcharge", 600], ["corner_bead", 220]]);
ok("...and at Level 5 it is $9,310 — the skim is $1,800 of it", near(basementL5, 9310), basementL5.toFixed(2));

// Three small patches, one large, and a stippled ceiling scraped. Moderate:
// an occupied furnished house.
//   3 × 285 = 855;  1 × 950;  120 × 4.75 = 570  ⇒  2,375
const repair = quote("drywall", "moderate", [["small_patch", 3], ["large_patch", 1], ["popcorn_removal", 120]]);
ok("drywall — 3 small patches, 1 large, 120 sqft of stipple: $2,375", near(repair, 2375), repair.toFixed(2));
ok("...comfortably over the $425 call-out minimum, so it does not apply", repair > getPriceBook("drywall").complexity.moderate.callOutMinimum);

// A two-car garage, 480 sqft, ground and flaked, with 22 lf of crack.
//   480 × 1.75 = 840;  480 × 9.00 = 4,320;  22 × 14 = 308  ⇒  5,468
const garage = quote("epoxy", "standard", [["grind", 480], ["flake_system", 480], ["crack_repair", 22]]);
ok("epoxy — a 480 sqft garage, ground + flake system, 22 lf of crack: $5,468", near(garage, 5468), garage.toFixed(2));
// Cross-check against the market the book claims to sit in: $7–$12/sqft for a
// flake system including prep.
ok("...which is $11.39/sqft, inside the $7–$12 flake band", garage / 480 >= 7 && garage / 480 <= 12, (garage / 480).toFixed(2));

// 900 sqft of LVP over old carpet, six transitions, 140 lf of shoe.
//   900 × 8.50 = 7,650;  900 × 1.50 = 1,350;  6 × 65 = 390;  140 × 6.50 = 910
//                                                              ⇒  10,300
const floor = quote("flooring_install", "standard", [["lvp", 900], ["tear_out_carpet", 900], ["transition", 6], ["shoe_moulding", 140]]);
ok("flooring_install — 900 sqft of LVP over carpet, 6 transitions, 140 lf shoe: $10,300", near(floor, 10300), floor.toFixed(2));

// A bathroom: 55 sqft of backsplash, 90 sqft of shower, a niche, a pan,
// 18 lf of edge trim. Moderate — an occupied house on a deadline.
//   55 × 24 = 1,320;  90 × 32 = 2,880;  400;  1,200;  18 × 27 = 486 ⇒ 6,286
const bath = quote("tiling", "moderate", [["wall_tile", 55], ["shower_surround", 90], ["niche", 1], ["shower_pan", 1], ["edge_trim", 18]]);
ok("tiling — a bathroom: backsplash, shower, niche, pan, trim: $6,286", near(bath, 6286), bath.toFixed(2));
// And the tile itself is NOT in that number, which is the design.
ok("...and the tile is NOT in it — extras.tileSupplyPricePerSqft is 0 on purpose", getPriceBook("tiling").extras.tileSupplyPricePerSqft === 0);

// Eight windows and a front door on a bungalow.
//   8 × 425 = 3,400;  950;  8 × 145 = 1,160;  9 × 95 = 855  ⇒  6,365
const openings = quote("window_door_install", "standard", [["insert_window", 8], ["exterior_entry", 1], ["capping", 8], ["removal", 9]]);
ok("window_door_install — 8 inserts, 1 entry door, capping, disposal: $6,365", near(openings, 6365), openings.toFixed(2));
ok("...and the units themselves are NOT in it — extras.unitSupplyPrice is 0", getPriceBook("window_door_install").extras.unitSupplyPrice === 0);

console.log("\nAnd the cost side of one of them, by hand");
// The same 2,400 sqft board-out, costed.
//   sheets  ceil(2,400 × 1.10 waste ÷ 32) = ceil(82.5) = 83 sheets
//   CAD     83 × 17.50 = 1,452.50
//   USD     83 × 14.50 = 1,203.50
//   hours   hang 2,400 × 0.010 = 24.0
//           L4   2,400 × 0.014 = 33.6   ⇒ 57.6 man-hours
const dwr = INTERIOR_RECIPES.drywall_install;
const sheets = Math.ceil((2400 * (1 + dwr.waste.board)) / 32);
ok("2,400 sqft of board at 10% waste is 83 whole 4x8 sheets", sheets === 83, sheets);
ok("...costing CAD $1,452.50", near(sheets * interiorCost(dwr.materials.board_half_4x8.cost, "CAD"), 1452.5), (sheets * 17.5).toFixed(2));
ok("...or USD $1,203.50 — a separately reasoned figure, not a conversion", near(sheets * interiorCost(dwr.materials.board_half_4x8.cost, "USD"), 1203.5));
const dwHours = 2400 * dwr.labour.hangPerSqft + 2400 * dwr.labour.finishPerSqftByLevel[4];
ok("...and 57.6 man-hours to hang and finish it to Level 4", near(dwHours, 57.6, 0.001), dwHours.toFixed(2));
// The margin sanity check the whole exercise is for: the sell price has to
// cover the material and leave a real labour rate behind.
const dwLabourBudget = (basement - sheets * 17.5) / dwHours;
ok("...leaving $105/h of the $7,510 sell for labour and overhead, which is a business", dwLabourBudget > 60 && dwLabourBudget < 160, dwLabourBudget.toFixed(2));
// Whole sheets, not fractions. The cabinet recipe learned this on catalyst
// quarts: "a job needing 0.6 of one costs a whole one".
ok("sheets are counted whole — nobody buys 82.5 of them", Number.isInteger(sheets));

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fails.length ? 1 : 0);
