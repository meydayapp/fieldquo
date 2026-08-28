// scripts/check-pricebook-structural.mjs
//
// Seven trades' worth of money, and the four ways it could be quietly wrong.
//
// app/data/priceBooks/structural.js adds concrete, asphalt paving, masonry,
// stucco/EIFS, framing, demolition and deck building, plus a cost recipe for
// sealcoating. Every number in it becomes the opening position on somebody's
// real quote. Four failure modes matter here and none of them shows up by
// reading the file:
//
//   A BOOK THAT CANNOT BE EDITED. RateCard.js returns null the moment
//   PRICE_BOOK_FIELDS[key] is empty or a path does not resolve, so a book with
//   a missing or misspelled field descriptor is seven trades of prices with no
//   screen to change them. Worse, `readField` on a two-currency pair renders
//   "[object Object]" into a number input — a control that appears to work and
//   doesn't, verbatim. So every field path is READ, on the flattened book, and
//   asserted to be a finite number.
//
//   A UNIT THAT DISAGREES WITH ITSELF. priceBookBasis() parses the unit back
//   out of a field's `suffix` string, and that is what Settings > Services
//   tells a contractor he charges by. The shipped exterior_painting book
//   already has an item saying "lf" beside a rate card saying "$ / linear ft".
//   Here the book declares `priceTypeUnits` once and BOTH the items and the
//   suffixes are checked against it, so there is an arbiter rather than two
//   lists that must agree and nothing to say which is right.
//
//   A CURRENCY THAT IS REALLY ONE CURRENCY WITH A MULTIPLIER ON IT.
//   app/data/electricalMaterials.js already measured why converting is wrong —
//   Canadian shelf prices sit at 1.24–1.31x US list while the live FX rate runs
//   1.35–1.40 — and the structural trades make it worse in both directions,
//   because Canadian SPF and cedar are cheaper relative to US prices and
//   Canadian composite decking is dearer. So this file does not merely check
//   that both currencies are present: it computes the cad/usd ratio of every
//   pair in a book and FAILS a book whose ratios are too tightly clustered,
//   because that is what a conversion looks like from the outside.
//
//   A DEFAULT NOBODY CAN JUSTIFY. Every money pair carries a `basis` and a
//   `confidence`. `guess` is not an allowed tag; a figure with no evidence is
//   supposed to be ABSENT and named in the book's `notPriced` list instead.
//   That absence is asserted, including the one that is a liability and not
//   merely an inaccuracy: there is no asbestos, lead or mould line in the
//   demolition book, because those are regulated abatement scopes and a
//   plausible default would put a price in front of a contractor for work he
//   may not legally perform.
//
// ══ The merge is performed, not described ══════════════════════════════════
//
// The owner does the real merge by hand. This script does it in memory first —
// Object.assign onto the live TRADE_PRICE_BOOKS, PRICE_BOOK_FIELDS,
// MATERIAL_RECIPES and STANDARD_ADDONS — and then runs the REAL helpers over
// the result: hasPriceBook, getPriceBook, priceBookBasis, priceBookComplexity,
// allPriceBookUnits, readField, getRecipe, getStandardAddOns. Nothing here
// re-implements what it is checking, and nothing here is a regex over source
// text except the two places that are explicitly testing a claim written in
// prose.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-pricebook-structural.mjs

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
} from "@/app/data/tradePriceBooks";
import {
  MATERIAL_RECIPES,
  RECIPE_EDITABLE_FIELDS,
  CONSUMABLE_EDITABLE_FIELDS,
  getRecipe,
  hasRecipe,
} from "@/app/data/materialRecipes";
import { STANDARD_ADDONS, getStandardAddOns } from "@/app/data/standardAddOns";
import { INDUSTRIES } from "@/app/data/industries";
import { INDUSTRY_CATEGORY_KEYS } from "@/app/data/industryCategories";
import { TRADE_CATALOG } from "@/lib/trades/catalog";
import {
  STRUCTURAL_PRICE_BOOKS,
  STRUCTURAL_RECIPES,
  STRUCTURAL_ADD_ONS,
  STRUCTURAL_PRICE_BOOK_FIELDS,
  STRUCTURAL_PRICE_BOOK_GROUPS,
  STRUCTURAL_RECIPE_FIELDS,
  STRUCTURAL_CONSUMABLE_FIELDS,
  STRUCTURAL_CATALOG_PROPOSALS,
  STRUCTURAL_FIXED_SPEC_KEYS,
  CONFIDENCE_TAGS,
  isMoneyPair,
  isSpec,
  money,
  flattenPriceBook,
  flattenRecipe,
  flattenAddOns,
  itemFlatPrice,
} from "@/app/data/priceBooks/structural";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond
    ? (pass++, console.log(`  ✓ ${label}`))
    : fails.push(`${label}${detail !== undefined ? ` — got ${detail}` : ""}`);
const near = (label, got, want, tol = 0.005) =>
  ok(
    label,
    Number.isFinite(got) && Math.abs(got - want) <= Math.abs(want * tol) + 1e-9,
    `${got} (wanted ${want})`,
  );

// Units that only ever appear on an EXTRA — a rented day, a tipped ton. They
// are not what the trade is priced by, which is why priceBookBasis excludes
// them and why they never reach allPriceBookUnits. Listed rather than waved
// through, so a typo in a suffix still fails.
const EXTRA_ONLY_UNITS = ["day", "ton"];

// Facts about arithmetic and about how sheet goods are sold. A rate-card row
// beside one of these is a control that appears to work and does — it would
// break every quantity computed from it. Written out here, independently of
// the file being checked, so removing the exclusion there does not remove the
// assertion here.
const DEFINITIONAL_KEYS = [
  "cuFtPerCuYd",
  "sqftPerCuYdAtOneInch",
  "specSqftPerSheet",
  "specEifsBoardSqftPerSheet",
];

/** A plain object holding sub-fields — not a money pair, not a spec. */
const isNestedBlock = (v) =>
  v !== null &&
  typeof v === "object" &&
  !Array.isArray(v) &&
  !isMoneyPair(v) &&
  !isSpec(v);

const BOOK_KEYS = Object.keys(STRUCTURAL_PRICE_BOOKS);
const RECIPE_KEYS = Object.keys(STRUCTURAL_RECIPES);

/* ══ 0. Nothing is overwritten ══════════════════════════════════════════════
 *
 * The merge is a spread, and a spread is silent. If one of these keys already
 * held a book, spreading would replace it and the loss would show up as a
 * contractor's rates changing overnight. driveway_sealing is the live example:
 * it already has a sourced Ontario book, which is exactly why the sealcoating
 * work here ships as a RECIPE and not as a second book.
 */

console.log("\nThe spread cannot destroy a book that is already there");
for (const key of BOOK_KEYS) {
  ok(`${key} is not already a price book`, !hasPriceBook(key), key);
}
ok(
  "sealcoating adds a recipe and NOT a competing book",
  !BOOK_KEYS.includes("driveway_sealing") &&
    Object.keys(STRUCTURAL_RECIPES).includes("driveway_sealing"),
);
ok(
  "...and the book it would have replaced is real and complexity-tiered",
  hasPriceBook("driveway_sealing") &&
    (priceBookComplexity("driveway_sealing") || []).length === 3,
);
for (const key of RECIPE_KEYS) {
  ok(`${key} has no recipe yet`, !hasRecipe(key), key);
}
for (const key of BOOK_KEYS) {
  // A trade with a book must not also carry an hourly opening rate: the
  // settings screen hides the single-rate box for exactly that reason, and two
  // contradictory numbers are worse than one.
  ok(
    `${key} carries no contradicting hourly default`,
    TRADE_DEFAULT_RATES[key] === undefined,
  );
}

/* ── Perform the merge, in memory, on the real modules ────────────────────── */

Object.assign(TRADE_PRICE_BOOKS, STRUCTURAL_PRICE_BOOKS);
Object.assign(PRICE_BOOK_FIELDS, STRUCTURAL_PRICE_BOOK_FIELDS);
Object.assign(PRICE_BOOK_GROUPS, STRUCTURAL_PRICE_BOOK_GROUPS);
Object.assign(MATERIAL_RECIPES, STRUCTURAL_RECIPES);
Object.assign(RECIPE_EDITABLE_FIELDS, STRUCTURAL_RECIPE_FIELDS);
Object.assign(CONSUMABLE_EDITABLE_FIELDS, STRUCTURAL_CONSUMABLE_FIELDS);
Object.assign(STANDARD_ADDONS, STRUCTURAL_ADD_ONS);

/* ══ 1. The real helpers see the real books ═════════════════════════════════ */

console.log("\nEvery book satisfies the helpers it will be read through");
for (const key of BOOK_KEYS) {
  const book = STRUCTURAL_PRICE_BOOKS[key];
  ok(`${key} — hasPriceBook`, hasPriceBook(key) === true);
  ok(`${key} — getPriceBook returns it`, getPriceBook(key) === book);
  ok(`${key} — has a label`, typeof book.label === "string" && book.label.length > 2);

  // A tier the estimator can pick that the rates do not move with is a
  // dropdown that changes nothing.
  const levels = priceBookComplexity(key) || [];
  ok(
    `${key} — priceBookComplexity returns all three levels`,
    levels.length === 3 &&
      levels.map((l) => l.value).join(",") ===
        COMPLEXITY_LEVELS.map((l) => l.value).join(","),
    levels.map((l) => l.value).join(","),
  );

  // priceBookBasis is what Settings > Services prints as "priced by". An empty
  // one would say a concrete contractor charges by nothing.
  const basis = priceBookBasis(key);
  ok(`${key} — priceBookBasis is non-empty`, basis.length > 0, basis.length);
  ok(
    `${key} — every basis unit is in allPriceBookUnits`,
    basis.every((b) => allPriceBookUnits().includes(b.unit)),
    basis.map((b) => b.unit).join(","),
  );
}

console.log("\nThe complexity tiers say something, and say it three times");
for (const key of BOOK_KEYS) {
  const book = STRUCTURAL_PRICE_BOOKS[key];
  const types = Object.keys(book.priceTypeUnits);
  const descs = new Set();
  for (const level of ["standard", "moderate", "high"]) {
    const tier = book.complexity[level];
    ok(
      `${key}.${level} — desc explains what puts a job here`,
      typeof tier.desc === "string" && tier.desc.length >= 40,
      tier && tier.desc && tier.desc.length,
    );
    descs.add(tier.desc);
    // Every priceType in EVERY tier. A rate present at standard and missing at
    // high prices a hard job at zero.
    for (const type of types) {
      ok(
        `${key}.${level}.${type} — present and a two-currency pair`,
        isMoneyPair(tier[type]),
        JSON.stringify(tier[type]),
      );
    }
    const strays = Object.keys(tier).filter(
      (k) => k !== "desc" && !types.includes(k),
    );
    ok(`${key}.${level} — no rate outside priceTypeUnits`, strays.length === 0, strays.join(","));
  }
  ok(`${key} — the three descs are distinct`, descs.size === 3, descs.size);

  // Rates must climb. A "high" tier priced below "standard" is a tier that
  // costs the contractor money for picking the honest answer.
  for (const type of types) {
    for (const cur of ["usd", "cad"]) {
      const s = book.complexity.standard[type][cur];
      const m = book.complexity.moderate[type][cur];
      const h = book.complexity.high[type][cur];
      ok(
        `${key}.${type} — ${cur} climbs standard < moderate < high`,
        s < m && m < h,
        `${s} ${m} ${h}`,
      );
    }
  }
}

/* ══ 2. Items, units and flats ══════════════════════════════════════════════ */

console.log("\nAn item's unit and its rate card agree, because both read one map");
for (const key of BOOK_KEYS) {
  const book = STRUCTURAL_PRICE_BOOKS[key];
  const units = allPriceBookUnits();
  const flatKeysUsed = new Set();

  for (const item of book.items) {
    ok(`${key}.${item.id} — has an id and a label`, Boolean(item.id && item.label));
    if (item.priceType === "flat") {
      ok(
        `${key}.${item.id} — flatKey resolves in flats`,
        Boolean(item.flatKey) &&
          isMoneyPair(book.flats[item.flatKey]),
        item.flatKey,
      );
      flatKeysUsed.add(item.flatKey);
      // The reader has to actually work in both currencies.
      ok(
        `${key}.${item.id} — itemFlatPrice reads it in both currencies`,
        itemFlatPrice(book, item, "USD") === book.flats[item.flatKey].usd &&
          itemFlatPrice(book, item, "CAD") === book.flats[item.flatKey].cad,
      );
    } else {
      ok(
        `${key}.${item.id} — priceType is declared in priceTypeUnits`,
        Object.prototype.hasOwnProperty.call(book.priceTypeUnits, item.priceType),
        item.priceType,
      );
      ok(
        `${key}.${item.id} — item unit matches the declared unit`,
        item.unit === book.priceTypeUnits[item.priceType],
        `${item.unit} vs ${book.priceTypeUnits[item.priceType]}`,
      );
    }
    ok(`${key}.${item.id} — its unit is in allPriceBookUnits`, units.includes(item.unit), item.unit);
  }

  // A flat price nothing points at is a number nobody can reach.
  const orphans = Object.keys(book.flats || {}).filter((k) => !flatKeysUsed.has(k));
  ok(`${key} — no orphan flat prices`, orphans.length === 0, orphans.join(","));

  // Every priceType must be reachable from at least one item.
  const covered = new Set(book.items.map((i) => i.priceType));
  const unreachable = Object.keys(book.priceTypeUnits).filter((t) => !covered.has(t));
  ok(`${key} — every priceType has an item`, unreachable.length === 0, unreachable.join(","));
}

/* ══ 3. The rate card renders, and renders numbers ══════════════════════════ */

console.log("\nEvery rate-card row resolves to a number a screen can show");
for (const key of BOOK_KEYS) {
  const book = STRUCTURAL_PRICE_BOOKS[key];
  const fields = PRICE_BOOK_FIELDS[key];
  ok(`${key} — RateCard would render (fields non-empty)`, Array.isArray(fields) && fields.length > 0, fields && fields.length);

  const flatUsd = flattenPriceBook(getPriceBook(key), "USD");
  const flatCad = flattenPriceBook(getPriceBook(key), "CAD");

  for (const field of fields) {
    // The defect this exists to catch: readField on the RAW book returns a
    // {usd,cad} object, and a number input renders that as "[object Object]".
    ok(
      `${key} — ${field.path} is a two-currency pair before flattening`,
      isMoneyPair(readField(book, field.path)),
      JSON.stringify(readField(book, field.path)),
    );
    const u = readField(flatUsd, field.path);
    const c = readField(flatCad, field.path);
    ok(
      `${key} — ${field.path} flattens to finite numbers in both currencies`,
      Number.isFinite(u) && Number.isFinite(c) && u > 0 && c > 0,
      `${u} / ${c}`,
    );
    ok(`${key} — ${field.path} has a label`, typeof field.label === "string" && field.label.length > 1);
    ok(`${key} — ${field.path} has a numeric step`, Number.isFinite(field.step) && field.step > 0, field.step);
    if (field.group !== undefined) {
      ok(
        `${key} — ${field.path} group "${field.group}" resolves`,
        typeof PRICE_BOOK_GROUPS[field.group] === "string",
      );
    }
  }

  // Suffix units. This is the one that keeps the settings screen honest.
  //
  // The membership test only applies to paths priceBookBasis actually reads.
  // `extras.` is in that function's EXTRA_PREFIXES list, so an extra's unit
  // never enters allPriceBookUnits and asserting it does would be stricter
  // than the helper it is checking. Extras are held to a named whitelist
  // instead, so "$ / dya" still fails.
  for (const field of fields) {
    const m = /^\$\s*\/\s*(.+)$/.exec(field.suffix);
    if (!m) {
      ok(`${key} — ${field.path} suffix "${field.suffix}" is a whole-job price`, field.suffix === "$ flat");
      continue;
    }
    const unit = m[1].trim();
    const isExtra = field.path.startsWith("extras.");
    ok(
      `${key} — ${field.path} unit "${unit}" is a known unit`,
      isExtra ? EXTRA_ONLY_UNITS.includes(unit) || allPriceBookUnits().includes(unit) : allPriceBookUnits().includes(unit),
      unit,
    );
    const cx = /^complexity\.(standard|moderate|high)\.(.+)$/.exec(field.path);
    if (cx) {
      ok(
        `${key} — ${field.path} suffix matches priceTypeUnits.${cx[2]}`,
        unit === book.priceTypeUnits[cx[2]],
        `${unit} vs ${book.priceTypeUnits[cx[2]]}`,
      );
    }
    const fl = /^flats\.(.+)$/.exec(field.path);
    if (fl) {
      const item = book.items.find((i) => i.flatKey === fl[1]);
      ok(`${key} — ${field.path} suffix matches its item's unit`, unit === item.unit, `${unit} vs ${item.unit}`);
    }
  }

  // Every complexity rate must have a row. A rate with no row is a price
  // nobody can change.
  for (const level of ["standard", "moderate", "high"]) {
    for (const type of Object.keys(book.priceTypeUnits)) {
      const path = `complexity.${level}.${type}`;
      ok(`${key} — ${path} has a rate-card row`, fields.some((f) => f.path === path));
    }
  }
  for (const type of Object.keys(book.extras || {})) {
    ok(`${key} — extras.${type} has a rate-card row`, fields.some((f) => f.path === `extras.${type}`), type);
  }
  for (const flatKey of Object.keys(book.flats || {})) {
    ok(`${key} — flats.${flatKey} has a rate-card row`, fields.some((f) => f.path === `flats.${flatKey}`), flatKey);
  }
  ok(`${key} — minimumTotal has a rate-card row`, fields.some((f) => f.path === "minimumTotal"));
}

console.log("\nA company's own number survives the merge and the flatten");
// The whole reason money() takes a bare number: RateCard writes one, mergeDeep
// replaces the pair with it, and the flattener must pass it through unharmed.
for (const key of BOOK_KEYS) {
  const merged = getPriceBook(key, { complexity: { standard: { [Object.keys(STRUCTURAL_PRICE_BOOKS[key].priceTypeUnits)[0]]: 99.5 } } });
  const type = Object.keys(STRUCTURAL_PRICE_BOOKS[key].priceTypeUnits)[0];
  ok(
    `${key} — an override of ${type} wins in USD and CAD alike`,
    flattenPriceBook(merged, "USD").complexity.standard[type] === 99.5 &&
      flattenPriceBook(merged, "CAD").complexity.standard[type] === 99.5,
  );
  // And it must not have detached the rest of the tier.
  const others = Object.keys(STRUCTURAL_PRICE_BOOKS[key].priceTypeUnits).filter((t) => t !== type);
  ok(
    `${key} — the rest of the tier still inherits`,
    others.every((t) => isMoneyPair(merged.complexity.standard[t])),
  );
}

/* ══ 4. Money discipline ════════════════════════════════════════════════════ */

/** Every money pair anywhere in a tree, with the path it was found at. */
function walkMoney(node, path = "", out = []) {
  if (node === null || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    node.forEach((n, i) => walkMoney(n, `${path}[${i}]`, out));
    return out;
  }
  if (isMoneyPair(node)) {
    out.push([path, node]);
    return out;
  }
  for (const k of Object.keys(node)) walkMoney(node[k], path ? `${path}.${k}` : k, out);
  return out;
}
function walkSpec(node, path = "", out = []) {
  if (node === null || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    node.forEach((n, i) => walkSpec(n, `${path}[${i}]`, out));
    return out;
  }
  if (isMoneyPair(node)) return out;
  if (isSpec(node)) {
    out.push([path, node]);
    return out;
  }
  for (const k of Object.keys(node)) walkSpec(node[k], path ? `${path}.${k}` : k, out);
  return out;
}

const ALL_TREES = {
  ...Object.fromEntries(Object.entries(STRUCTURAL_PRICE_BOOKS).map(([k, v]) => [`book:${k}`, v])),
  ...Object.fromEntries(Object.entries(STRUCTURAL_RECIPES).map(([k, v]) => [`recipe:${k}`, v])),
  ...Object.fromEntries(Object.entries(STRUCTURAL_ADD_ONS).map(([k, v]) => [`addons:${k}`, v])),
};

console.log("\nNo cost is zero, negative, NaN, or absurd — and both markets are stated");
let moneyCount = 0;
for (const [tree, node] of Object.entries(ALL_TREES)) {
  const pairs = walkMoney(node);
  moneyCount += pairs.length;
  const bad = [];
  for (const [path, pair] of pairs) {
    const finite = Number.isFinite(pair.usd) && Number.isFinite(pair.cad);
    const positive = pair.usd > 0 && pair.cad > 0;
    // The absurdity band: a tenth of a cent is not a real material cost and
    // $200,000 is not a residential line item. Both ends have been hit by real
    // typos — a misplaced decimal is the commonest way a rate card lies.
    const sane = pair.usd >= 0.001 && pair.usd <= 200000 && pair.cad >= 0.001 && pair.cad <= 200000;
    if (!finite || !positive || !sane) bad.push(`${path}=${pair.usd}/${pair.cad}`);
  }
  ok(`${tree} — ${pairs.length} costs, all finite, positive and sane`, bad.length === 0, bad.join(" "));
}
ok("...and there are enough of them to be a real catalogue", moneyCount > 300, moneyCount);

console.log("\nEvery cost says where it came from, and none of them says 'I guessed'");
for (const [tree, node] of Object.entries(ALL_TREES)) {
  const thin = [];
  const untagged = [];
  for (const [path, pair] of walkMoney(node)) {
    if (typeof pair.basis !== "string" || pair.basis.length < 20) thin.push(path);
    if (!CONFIDENCE_TAGS.includes(pair.confidence)) untagged.push(`${path}=${pair.confidence}`);
  }
  ok(`${tree} — every cost carries a basis`, thin.length === 0, thin.join(" "));
  ok(`${tree} — every confidence tag is read|derived`, untagged.length === 0, untagged.join(" "));
}
ok("...'guess' is not an allowed tag at all", !CONFIDENCE_TAGS.includes("guess"));

console.log("\nThe two currencies were reasoned twice, not multiplied once");
// A conversion is visible from the outside: every pair in the book shares one
// ratio. Two markets do not. This is the assertion that would have caught the
// tempting shortcut, and it is deliberately loud about what "too clustered"
// means rather than asserting a magic number.
for (const key of BOOK_KEYS) {
  const ratios = walkMoney(STRUCTURAL_PRICE_BOOKS[key]).map(([, p]) => p.cad / p.usd);
  const lo = Math.min(...ratios);
  const hi = Math.max(...ratios);
  const distinct = new Set(ratios.map((r) => r.toFixed(3))).size;
  ok(
    `book:${key} — the cad/usd ratios spread (${lo.toFixed(2)}–${hi.toFixed(2)}, ${distinct} distinct)`,
    hi - lo > 0.05 && distinct > 3,
    `${lo.toFixed(3)}–${hi.toFixed(3)}, ${distinct} distinct of ${ratios.length}`,
  );
}
for (const key of RECIPE_KEYS) {
  const ratios = walkMoney(STRUCTURAL_RECIPES[key]).map(([, p]) => p.cad / p.usd);
  const distinct = new Set(ratios.map((r) => r.toFixed(3))).size;
  ok(`recipe:${key} — ratios spread (${distinct} distinct of ${ratios.length})`, distinct > 3, distinct);
}
// The three that make the argument concretely: Canadian softwood is milled
// here and Canadian composite is imported, so they cannot share a rate.
{
  const d = STRUCTURAL_RECIPES.deck_building;
  const pt = d.matDeckBoardPtPerBoard16ft.cad / d.matDeckBoardPtPerBoard16ft.usd;
  const cedar = d.matDeckBoardCedarPerBoard16ft.cad / d.matDeckBoardCedarPerBoard16ft.usd;
  const comp = d.matDeckBoardCompositePerBoard16ft.cad / d.matDeckBoardCompositePerBoard16ft.usd;
  ok(
    `deck lumber and deck composite do not share a ratio (pt ${pt.toFixed(2)}, cedar ${cedar.toFixed(2)}, composite ${comp.toFixed(2)})`,
    comp > cedar && Math.abs(comp - cedar) > 0.1,
    `${pt.toFixed(3)} ${cedar.toFixed(3)} ${comp.toFixed(3)}`,
  );
}

console.log("\nEvery consumption rate is a number, and a percentage is a percentage");
for (const [tree, node] of Object.entries(ALL_TREES)) {
  const bad = [];
  for (const [path, s] of walkSpec(node)) {
    if (!Number.isFinite(s.value) || s.value <= 0) bad.push(`${path}=${s.value}`);
    if (/Pct$/.test(path) && (s.value <= 0 || s.value >= 1)) bad.push(`${path}=${s.value} not a fraction`);
    if (typeof s.basis !== "string" || s.basis.length < 10) bad.push(`${path} thin basis`);
  }
  ok(`${tree} — specs are positive, fractional where they should be, and sourced`, bad.length === 0, bad.join(" "));
}

console.log("\nWaste and overage exist where the trade actually has them");
// Leaving these out is how a contractor loses money quietly, so their presence
// is asserted by name rather than by count.
const REQUIRED_WASTE = {
  concrete: ["wasteConcreteOverOrderPct", "wasteRebarPct", "wasteMeshPct"],
  asphalt_paving: ["wasteMixOverOrderPct"],
  masonry: ["wasteBrickPct", "wasteBlockPct", "wasteStoneNaturalPct", "wasteMortarPct"],
  stucco: ["wasteLathPct", "wasteMeshPct", "wasteMixPct"],
  framing: ["wasteLumberPct", "wasteSheathingPct"],
  deck_building: ["wasteDeckingPct", "wasteDeckingDiagonalPct", "wasteFramingPct"],
  driveway_sealing: ["wasteSealerOverOrderPct"],
};
for (const [key, keys] of Object.entries(REQUIRED_WASTE)) {
  for (const w of keys) {
    ok(`recipe:${key} — ${w} is stated`, isSpec(STRUCTURAL_RECIPES[key][w]), JSON.stringify(STRUCTURAL_RECIPES[key][w]));
  }
}
ok(
  "diagonal decking wastes materially more than square decking",
  STRUCTURAL_RECIPES.deck_building.wasteDeckingDiagonalPct.value >
    STRUCTURAL_RECIPES.deck_building.wasteDeckingPct.value * 1.5,
);
ok(
  "natural stone wastes more than brick, because it is sorted and cut on site",
  STRUCTURAL_RECIPES.masonry.wasteStoneNaturalPct.value > STRUCTURAL_RECIPES.masonry.wasteBrickPct.value,
);

/* ══ 5. Recipes: labour is hours, equipment is a day rate ═══════════════════ */

console.log("\nLabour is HOURS, never a dollar rate — the company's own rate multiplies it");
for (const key of RECIPE_KEYS) {
  const r = STRUCTURAL_RECIPES[key];
  const dollarised = Object.keys(r).filter((k) => k.startsWith("labour") && isMoneyPair(r[k]));
  ok(`recipe:${key} — no labour key holds money`, dollarised.length === 0, dollarised.join(","));
  const hourKeys = Object.keys(r).filter((k) => k.startsWith("labour"));
  ok(`recipe:${key} — has labour hours at all`, hourKeys.length >= 4, hourKeys.length);
  ok(`recipe:${key} — every labour key is a spec`, hourKeys.every((k) => isSpec(r[k])), hourKeys.filter((k) => !isSpec(r[k])).join(","));
  // Fixed mobilisation, separately from the per-unit rate. lib/pricing/paverLabour.js
  // makes the argument: a pure per-unit rate is wrong at both ends.
  ok(`recipe:${key} — carries a fixed mobilisation figure`, isSpec(r.labourMobilisationHours), JSON.stringify(r.labourMobilisationHours));
}

console.log("\nEquipment is a day rate or a move, in both currencies");
for (const key of RECIPE_KEYS) {
  const r = STRUCTURAL_RECIPES[key];
  const equip = Object.keys(r).filter((k) => k.startsWith("equip"));
  ok(`recipe:${key} — has equipment at all`, equip.length >= 2, equip.length);
  ok(`recipe:${key} — every equipment key is a two-currency cost`, equip.every((k) => isMoneyPair(r[k])), equip.filter((k) => !isMoneyPair(r[k])).join(","));
  const shaped = equip.every((k) => /(PerDay|PerWeek|PerHalfDay|PerHaul|Move)$/.test(k));
  ok(`recipe:${key} — every equipment key names its period or its move`, shaped, equip.filter((k) => !/(PerDay|PerWeek|PerHalfDay|PerHaul|Move)$/.test(k)).join(","));
}
// The trades that genuinely need a machine must name one, or the cost panel is
// short by the biggest single line on the job.
const REQUIRED_EQUIPMENT = {
  concrete: ["equipConcretePumpPerDay", "equipPlateCompactorPerDay", "equipPowerTrowelPerDay"],
  asphalt_paving: ["equipPaverPerDay", "equipRollerPerDay", "equipMachineMove"],
  masonry: ["equipScaffoldSectionPerWeek", "equipMortarMixerPerDay"],
  stucco: ["equipPlasterMixerPerDay", "equipSwingStagePerDay"],
  framing: ["equipCranePerHalfDay", "equipDumpsterPerHaul"],
  demolition: ["equipMiniExcavatorPerDay", "equipDumpsterPerHaul", "equipJackhammerPerDay"],
  deck_building: ["equipAugerPerDay", "equipDumpsterPerHaul"],
  driveway_sealing: ["equipSealRigPerDay", "equipCrackMelterPerDay"],
};
for (const [key, keys] of Object.entries(REQUIRED_EQUIPMENT)) {
  for (const e of keys) {
    ok(`recipe:${key} — ${e} is priced`, isMoneyPair(STRUCTURAL_RECIPES[key][e]), e);
  }
}

console.log("\nEvery recipe field is editable, and getRecipe merges it correctly");
const seenModels = new Set();
for (const key of RECIPE_KEYS) {
  const r = STRUCTURAL_RECIPES[key];
  ok(`recipe:${key} — declares a model`, typeof r.model === "string" && r.model.length > 3, r.model);
  ok(`recipe:${key} — the model is unique`, !seenModels.has(r.model), r.model);
  seenModels.add(r.model);
  ok(`recipe:${key} — hasRecipe after the merge`, hasRecipe(key) === true);

  const fields = RECIPE_EDITABLE_FIELDS[r.model];
  ok(`recipe:${key} — RECIPE_EDITABLE_FIELDS has its model`, Array.isArray(fields) && fields.length > 0, fields && fields.length);

  // Every editable value, exactly once, and nothing offered that isn't there.
  const editable = Object.keys(r).filter(
    (k) => (isMoneyPair(r[k]) || isSpec(r[k])) && !STRUCTURAL_FIXED_SPEC_KEYS.includes(k),
  );
  const declared = fields.map((f) => f.key);
  ok(`recipe:${key} — no duplicate rows`, new Set(declared).size === declared.length);
  ok(
    `recipe:${key} — every editable value has a row`,
    editable.every((k) => declared.includes(k)),
    editable.filter((k) => !declared.includes(k)).join(","),
  );
  ok(
    `recipe:${key} — no row points at a field that isn't there`,
    declared.every((k) => isMoneyPair(r[k]) || isSpec(r[k])),
    declared.filter((k) => !(isMoneyPair(r[k]) || isSpec(r[k]))).join(","),
  );
  ok(`recipe:${key} — every row has a label and a step`, fields.every((f) => f.label && f.label.length > 2 && Number.isFinite(f.step)));

  // The definitional constants must NOT be offered. 27 cubic feet to the yard
  // is arithmetic, and a number input beside it breaks every quantity below.
  //
  // Named here rather than read back out of STRUCTURAL_FIXED_SPEC_KEYS: doing
  // it that way was a tautology — both sides came from the same export, so
  // deleting a key from the export deleted the assertion with it, and the
  // mutation went straight through. This list is the second opinion.
  const fixedOffered = DEFINITIONAL_KEYS.filter((k) => declared.includes(k));
  ok(`recipe:${key} — no definitional constant is offered as editable`, fixedOffered.length === 0, fixedOffered.join(","));
  const notFixed = DEFINITIONAL_KEYS.filter((k) => r[k] !== undefined && !STRUCTURAL_FIXED_SPEC_KEYS.includes(k));
  ok(`recipe:${key} — every definitional constant it holds is declared fixed`, notFixed.length === 0, notFixed.join(","));

  // ── The flat-key decision, EXECUTED rather than asserted about ────────────
  //
  // getRecipe deep-merges exactly the keys in its own module-private
  // NESTED_KEYS list, and `materials` is not one of them. So a nested block of
  // costs is not a style choice here: overriding one field inside it replaces
  // the whole block and silently deletes every sibling. The proof is to try it
  // on each nested key the recipe actually carries.
  const nestedKeys = Object.keys(r).filter((k) => isNestedBlock(r[k]));
  // The rule, stated flatly: `consumables` is the ONE key materialRecipes.js
  // deep-merges. Any other nested block is a group of costs waiting to be
  // deleted wholesale by the first company that edits one field inside it, and
  // an EMPTY one slips past the probe below because there are no siblings left
  // to lose — so membership is asserted as well as behaviour.
  ok(
    `recipe:${key} — "consumables" is its only nested block`,
    nestedKeys.length === 1 && nestedKeys[0] === "consumables",
    nestedKeys.join(","),
  );
  for (const nested of nestedKeys) {
    const sub = Object.keys(r[nested]);
    const probe = getRecipe(key, { [nested]: { [sub[0]]: {} } });
    const survived = sub.slice(1).every((k) => probe[nested][k] !== undefined);
    ok(
      `recipe:${key} — the nested block "${nested}" survives a one-field override`,
      survived,
      `${sub.length - 1} siblings, ${sub.slice(1).filter((k) => probe[nested][k] === undefined).length} lost`,
    );
  }

  // The flat-key decision, tested rather than argued: getRecipe's NESTED_KEYS
  // is module-private and holds only `consumables` and `paintTiers`. A nested
  // `materials` block would be destroyed wholesale by a single override.
  const firstMat = Object.keys(r).find((k) => k.startsWith("mat") && isMoneyPair(r[k]));
  const merged = getRecipe(key, { [firstMat]: 12.34 });
  ok(`recipe:${key} — an override of ${firstMat} wins`, merged[firstMat] === 12.34, merged[firstMat]);
  const survivors = Object.keys(r).filter((k) => k !== firstMat && isMoneyPair(r[k]));
  ok(
    `recipe:${key} — the other ${survivors.length} costs survive it`,
    survivors.every((k) => isMoneyPair(merged[k])),
    survivors.filter((k) => !isMoneyPair(merged[k])).join(","),
  );
  ok(`recipe:${key} — money() reads the override straight through`, money(merged[firstMat], "USD") === 12.34 && money(merged[firstMat], "CAD") === 12.34);

  // Consumables ARE registered as nested, so a sub-key override must merge.
  const firstCons = Object.keys(r.consumables)[0];
  const consKey = Object.keys(r.consumables[firstCons]).find((k) => isMoneyPair(r.consumables[firstCons][k]));
  const cMerged = getRecipe(key, { consumables: { [firstCons]: { [consKey]: 9.99 } } });
  ok(`recipe:${key} — consumables.${firstCons}.${consKey} override wins`, cMerged.consumables[firstCons][consKey] === 9.99);
  ok(`recipe:${key} — ...and its label survives`, cMerged.consumables[firstCons].label === r.consumables[firstCons].label);

  // Consumable rows, namespaced so a mason's blades cannot edit a framer's.
  for (const name of Object.keys(r.consumables)) {
    const cf = CONSUMABLE_EDITABLE_FIELDS[`${r.model}.${name}`];
    ok(`recipe:${key} — consumable ${name} has editable rows`, Array.isArray(cf) && cf.length > 0, cf && cf.length);
  }
}
ok(
  "the four names that collide across trades are namespaced by model",
  ["concrete_flatwork.blades", "masonry_unit.blades", "framing_component.blades", "deck_component.blades"].every(
    (k) => Array.isArray(CONSUMABLE_EDITABLE_FIELDS[k]),
  ),
);

console.log("\nA whole recipe flattens to numbers, in either currency");
for (const key of RECIPE_KEYS) {
  for (const cur of ["USD", "CAD"]) {
    const flat = flattenRecipe(STRUCTURAL_RECIPES[key], cur);
    const bad = Object.keys(STRUCTURAL_RECIPES[key])
      .filter((k) => isMoneyPair(STRUCTURAL_RECIPES[key][k]) || isSpec(STRUCTURAL_RECIPES[key][k]))
      .filter((k) => !Number.isFinite(flat[k]) || flat[k] <= 0);
    ok(`recipe:${key} — flattens clean in ${cur}`, bad.length === 0, bad.join(","));
  }
}

/* ══ 6. Add-ons ════════════════════════════════════════════════════════════ */

console.log("\nAdd-ons are shaped like the ones already shipping, and agree with the book");
for (const key of Object.keys(STRUCTURAL_ADD_ONS)) {
  const list = getStandardAddOns(key);
  ok(`addons:${key} — getStandardAddOns finds them`, list.length > 0, list.length);
  for (const a of list) {
    ok(`addons:${key} — "${a.name}" has a unit, type and description`,
      Boolean(a.unit) && ["service", "product"].includes(a.type) && a.description && a.description.length > 15,
      `${a.unit}/${a.type}`);
    ok(`addons:${key} — "${a.name}" carries both currencies`, isMoneyPair(a.unitPrice), JSON.stringify(a.unitPrice));
  }
  const flat = flattenAddOns(list, "CAD");
  ok(`addons:${key} — flattens to plain numbers`, flat.every((a) => Number.isFinite(a.unitPrice) && a.unitPrice > 0));
}

console.log("\nAn add-on that claims to match a rate on the card actually matches it");
// The claim is written in prose, so the prose is parsed and the numbers
// compared. Two routes to the same decision are fine; two routes to two
// different prices on one quote are not.
let claims = 0;
const mismatched = [];
for (const [key, list] of Object.entries(STRUCTURAL_ADD_ONS)) {
  const book = STRUCTURAL_PRICE_BOOKS[key];
  if (!book) continue;
  for (const a of list) {
    const m = /Matches (extras|flats)\.([A-Za-z0-9_]+)/.exec(a.unitPrice.basis);
    if (!m) continue;
    claims++;
    const target = book[m[1]] && book[m[1]][m[2]];
    if (!isMoneyPair(target) || target.usd !== a.unitPrice.usd || target.cad !== a.unitPrice.cad) {
      mismatched.push(`${key}/"${a.name}" -> ${m[1]}.${m[2]}`);
    }
  }
}
ok(`${claims} add-ons claim to match a book rate, and every one does`, mismatched.length === 0, mismatched.join(" "));
ok("...and there are enough claims for the check to mean something", claims >= 40, claims);
// The cross-book one: deck removal is quoted by two different trades and must
// not be two different prices.
ok(
  "deck removal costs the same whether a deck builder or a demolition crew quotes it",
  STRUCTURAL_PRICE_BOOKS.deck_building.extras.demoExistingDeckPerSqft.usd ===
    STRUCTURAL_PRICE_BOOKS.demolition.complexity.standard.deckRemoval.usd &&
    STRUCTURAL_PRICE_BOOKS.deck_building.extras.demoExistingDeckPerSqft.cad ===
      STRUCTURAL_PRICE_BOOKS.demolition.complexity.standard.deckRemoval.cad,
);

/* ══ 7. Refusals ═══════════════════════════════════════════════════════════ */

console.log("\nWhat these books refuse to guess, they refuse everywhere");
for (const key of BOOK_KEYS) {
  const book = STRUCTURAL_PRICE_BOOKS[key];
  ok(`${key} — names what it will not price`, Array.isArray(book.notPriced) && book.notPriced.length > 0, book.notPriced && book.notPriced.length);
  for (const entry of book.notPriced) {
    const [name] = entry.split(" — ");
    ok(`${key} — "${name}" says WHY it is absent`, entry.includes(" — ") && entry.length > name.length + 30);
    // And it must genuinely be absent, not merely undocumented.
    const found = walkMoney(book).some(([path]) => path.endsWith(`.${name}`) || path === name);
    ok(`${key} — "${name}" carries no price anywhere in the book`, !found, name);
  }
}
// The one that is a liability rather than an inaccuracy.
{
  const dem = STRUCTURAL_PRICE_BOOKS.demolition;
  const text = JSON.stringify(walkMoney(dem).map(([p]) => p));
  ok("demolition prices no abatement of any kind", !/asbestos|lead|mould|mold/i.test(text));
  const refusals = dem.notPriced.join(" ").toLowerCase();
  for (const word of ["asbestos", "lead", "mould"]) {
    ok(`...and says so by name: ${word}`, refusals.includes(word));
  }
  ok("...and gives the reason as licensing, not difficulty", /regulated|licensed|legally/i.test(dem.notPriced.join(" ")));
}
// Permits: a municipal fee, and every book that could plausibly carry one
// refuses it.
for (const key of ["concrete", "asphalt_paving", "framing", "demolition", "deck_building"]) {
  ok(`${key} — refuses to invent a permit fee`, STRUCTURAL_PRICE_BOOKS[key].notPriced.some((n) => /permit/i.test(n)));
}

/* ══ 8. Industry and category ══════════════════════════════════════════════ */

console.log("\nEvery trade is filed under a real industry and a real category");
const SLUGS = INDUSTRIES.map((i) => i.slug);
for (const key of BOOK_KEYS) {
  const meta = STRUCTURAL_PRICE_BOOKS[key].meta;
  ok(`${key} — meta.categoryKey matches its own key`, meta.categoryKey === key, meta.categoryKey);
  ok(`${key} — declares at least one industry`, Array.isArray(meta.industries) && meta.industries.length > 0);
  for (const slug of meta.industries) {
    ok(`${key} — "${slug}" is one of the 12 real industries`, SLUGS.includes(slug), slug);
  }
  ok(`${key} — catalogStatus is stated`, ["existing", "proposed"].includes(meta.catalogStatus), meta.catalogStatus);

  if (meta.catalogStatus === "existing") {
    const entry = TRADE_CATALOG[key];
    ok(`${key} — the ServiceCategory key really exists`, Boolean(entry));
    // The category must actually surface under every industry it claims, or
    // the trade is unreachable from the preset that says it sells it.
    for (const slug of meta.industries) {
      ok(
        `${key} — INDUSTRY_CATEGORY_KEYS.${slug} contains it`,
        (INDUSTRY_CATEGORY_KEYS[slug] || []).includes(key),
        (INDUSTRY_CATEGORY_KEYS[slug] || []).length,
      );
      ok(`${key} — the catalogue agrees it belongs to ${slug}`, entry.industries.includes(slug), entry.industries.join(","));
    }
  } else {
    // A proposal that has been merged must stop calling itself a proposal, or
    // this file becomes a stale claim about the catalogue.
    ok(`${key} — is genuinely absent from TRADE_CATALOG (still a proposal)`, TRADE_CATALOG[key] === undefined);
    const p = STRUCTURAL_CATALOG_PROPOSALS[key];
    ok(`${key} — the proposal is complete`, Boolean(p && p.label && p.icon && Number.isFinite(p.sortOrder)));
    ok(`${key} — the proposal's industries match the book's`, JSON.stringify(p.industries) === JSON.stringify(meta.industries));
    for (const slug of p.industries) ok(`${key} — proposed slug "${slug}" is real`, SLUGS.includes(slug), slug);
    // sortOrder must not land on top of an existing row.
    const taken = Object.values(TRADE_CATALOG).map((e) => e.sortOrder);
    ok(`${key} — its sortOrder ${p.sortOrder} is free`, !taken.includes(p.sortOrder), p.sortOrder);
  }
}
// The recipe-only trade has to be filed too, and it already is.
ok("driveway_sealing is a live category with a live book", Boolean(TRADE_CATALOG.driveway_sealing) && hasPriceBook("driveway_sealing"));
ok("...surfaced by three industries already", TRADE_CATALOG.driveway_sealing.industries.length === 3, TRADE_CATALOG.driveway_sealing.industries.join(","));
// The duplicate the demolition book names.
ok(
  "the demolition book names the duplicate catalogue key rather than ignoring it",
  STRUCTURAL_PRICE_BOOKS.demolition.meta.duplicateCatalogKey === "demolition_contractor" &&
    Boolean(TRADE_CATALOG.demolition_contractor),
);

/* ══ 9. Sample quotes, against figures computed by hand ═════════════════════
 *
 * The arithmetic below is written out longhand in each comment. If the book
 * changes and these fail, the book moved — which is the point.
 */

console.log("\nA sample job priced through each book lands where the arithmetic says");

const rate = (key, level, type, cur) => money(STRUCTURAL_PRICE_BOOKS[key].complexity[level][type], cur);
const ex = (key, name, cur) => money(STRUCTURAL_PRICE_BOOKS[key].extras[name], cur);
const fl = (key, name, cur) => money(STRUCTURAL_PRICE_BOOKS[key].flats[name], cur);
const rc = (key, field, cur) => money(STRUCTURAL_RECIPES[key][field], cur);
const sp = (key, field) => STRUCTURAL_RECIPES[key][field].value;

// ── Concrete: a 600 sqft standard slab in USD, sealed, with two steps.
//    600 x 8.00 = 4,800.00 slab
//    600 x 0.60 =   360.00 sealer
//      2 x 300  =   600.00 steps
//               = 5,760.00
{
  const total = 600 * rate("concrete", "standard", "slab", "USD") + 600 * ex("concrete", "sealerPerSqft", "USD") + 2 * fl("concrete", "stepEach", "USD");
  near("concrete — 600 sqft slab + sealer + 2 steps = $5,760 USD", total, 5760);
  ok("...and it clears the minimum charge", total > money(STRUCTURAL_PRICE_BOOKS.concrete.minimumTotal, "USD"));
}
// ── Concrete cost side, same slab, USD.
//    Volume  600 x 4 / 324        = 7.4074 cu yd
//    Ordered 7.4074 x 1.08        = 8.0000 cu yd
//    Mix     8.0000 x 155         = 1,240.00
//    Delivery                     +    90.00
//                                 = 1,330.00
//    Place & finish 600 x 0.032   = 19.2 crew-hours
{
  const cuYd = (600 * sp("concrete", "defaultSlabThicknessIn")) / 324;
  const ordered = cuYd * (1 + sp("concrete", "wasteConcreteOverOrderPct"));
  const mix = ordered * rc("concrete", "matReadyMixPerCuYd", "USD") + rc("concrete", "matReadyMixDeliveryPerLoad", "USD");
  near("concrete — 600 sqft at 4in orders 8.00 cu yd", ordered, 8.0);
  near("...costing $1,330 USD in mix and delivery", mix, 1330);
  near("...and 19.2 crew-hours to place and finish", 600 * sp("concrete", "labourPlaceFinishHoursPerSqft"), 19.2);
  // Below the plant minimum the short-load fee bites, and it is real money.
  const small = 2;
  const short = (sp("concrete", "specShortLoadMinCuYd") - small) * rc("concrete", "matShortLoadFeePerCuYdShort", "USD");
  near("...a 2 cu yd pour carries a $45 short-load fee", short, 45);
}

// ── Asphalt: an 800 sqft standard new driveway in USD, with mobilisation.
//    800 x 4.00 = 3,200.00
//    mobilise   =   750.00
//               = 3,950.00
{
  const total = 800 * rate("asphalt_paving", "standard", "newDriveway", "USD") + ex("asphalt_paving", "mobilisationFlat", "USD");
  near("asphalt — 800 sqft new driveway + float = $3,950 USD", total, 3950);
}
// ── Asphalt cost side: tonnage is the whole bill and it comes from a density.
//    Coverage at 2in = 165 / 2      = 82.5 sqft per ton
//    Tons  800 / 82.5               =  9.697
//    Ordered 9.697 x 1.06           = 10.279
//    Mix   10.279 x 110             = 1,130.66
//    Haul  10.279 x 12              =   123.35
{
  const sqftPerTon = sp("asphalt_paving", "specSqftPerTonAtOneInch") / sp("asphalt_paving", "defaultSurfaceLiftIn");
  near("asphalt — a ton covers 82.5 sqft at 2 inches", sqftPerTon, 82.5);
  const tons = (800 / sqftPerTon) * (1 + sp("asphalt_paving", "wasteMixOverOrderPct"));
  near("...800 sqft needs 10.28 tons ordered", tons, 10.279, 0.01);
  near("...at $1,130.66 USD of mix", tons * rc("asphalt_paving", "matHotMixPerTon", "USD"), 1130.66, 0.01);
  near("...plus $123.35 USD of haul", tons * rc("asphalt_paving", "matHotMixHaulPerTon", "USD"), 123.35, 0.01);
}

// ── Masonry: 400 sqft of standard brick veneer in CAD.
//    400 x 24 = 9,600.00
{
  near("masonry — 400 sqft brick veneer = $9,600 CAD", 400 * rate("masonry", "standard", "brick", "CAD"), 9600);
}
// ── Masonry cost side, same wall, CAD.
//    Brick    400 x 6.75 x 1.05     = 2,835 brick
//    Cost     2.835 x 1,050         = 2,976.75
//    Mortar   400 x 0.22 x 1.08     = 95.04 bags x 9.50 = 902.88
//    Labour   400 x 0.22            = 88 crew-hours
{
  const brick = 400 * sp("masonry", "specBricksPerSqft") * (1 + sp("masonry", "wasteBrickPct"));
  near("masonry — 400 sqft needs 2,835 brick ordered", brick, 2835);
  near("...at $2,976.75 CAD", (brick / 1000) * rc("masonry", "matBrickPer1000", "CAD"), 2976.75, 0.001);
  const bags = 400 * sp("masonry", "specMortarBagsPerSqftBrick") * (1 + sp("masonry", "wasteMortarPct"));
  near("...and 95.04 bags of mortar, $902.88 CAD", bags * rc("masonry", "matMortarPerBag", "CAD"), 902.88, 0.001);
  near("...taking 88 crew-hours to lay", 400 * sp("masonry", "labourBrickHoursPerSqft"), 88);
}

// ── Stucco: 1,200 sqft of standard three-coat in USD.
//    1,200 x 9 = 10,800.00
{
  near("stucco — 1,200 sqft three-coat = $10,800 USD", 1200 * rate("stucco", "standard", "traditional", "USD"), 10800);
}
// ── Stucco cost side: two base coats at 25 sqft to the bag.
//    Bags  1,200 / 25 x 2 x 1.08 = 103.68 bags x 11 = 1,140.48
//    Mesh consumption is a LAP, not waste: 1,200 x 1.15 = 1,380 sqft of mesh.
{
  const bags = (1200 / sp("stucco", "specBaseCoatSqftPerBag")) * sp("stucco", "specBaseCoats") * (1 + sp("stucco", "wasteMixPct"));
  near("stucco — 1,200 sqft needs 103.68 bags of base", bags, 103.68, 0.001);
  near("...at $1,140.48 USD", bags * rc("stucco", "matBaseCoatPerBag", "USD"), 1140.48, 0.001);
  near("...and 1,380 sqft of mesh once the lap is counted", 1200 * sp("stucco", "specMeshLapFactor"), 1380);
  ok("...the lap is held apart from the waste factor", sp("stucco", "specMeshLapFactor") > 1 && sp("stucco", "wasteMeshPct") < 1);
}

// ── Framing: 140 lf of standard exterior wall with sheathing, USD.
//    140 x 26              = 3,640.00 wall
//    140 x 8 = 1,120 sqft x 3.20 = 3,584.00 sheathing
//                          = 7,224.00
{
  const total = 140 * rate("framing", "standard", "wallFrame", "USD") + 1120 * rate("framing", "standard", "sheathing", "USD");
  near("framing — 140 lf of wall plus its sheathing = $7,224 USD", total, 7224);
  near("...taking 22.4 crew-hours to build and stand", 140 * sp("framing", "labourWallFrameHoursPerLf"), 22.4);
  near("...and 20.16 more to sheathe", 1120 * sp("framing", "labourSheathingHoursPerSqft"), 20.16, 0.001);
  // A cut roof against a truss roof, as a multiplier rather than a second rate.
  near("...a stick-framed roof costs 2.5x a truss roof in hours", sp("framing", "labourCutRoofFactor") * sp("framing", "labourTrussSetHoursPerSqft"), 0.07);
}

// ── Demolition: a 1,200 sqft standard interior strip in USD, with the cans.
//    Debris   1,200 / 100 x 5 = 60 cu yd -> 3 cans of 20
//    Strip    1,200 x 3.50    = 4,200.00
//    Cans     3 x 550         = 1,650.00
//                             = 5,850.00
{
  const debris = (1200 / 100) * sp("demolition", "specDebrisCuYdPer100SqftStrip");
  near("demolition — a 1,200 sqft strip makes 60 cu yd of debris", debris, 60);
  const cans = Math.ceil(debris / sp("demolition", "specDumpsterCuYd"));
  ok("...which is 3 cans", cans === 3, cans);
  const total = 1200 * rate("demolition", "standard", "interiorStrip", "USD") + cans * ex("demolition", "dumpsterPerHaul", "USD");
  near("...and $5,850 USD all in", total, 5850);
  near("...with 33 crew-hours of carrying it out by hand", debris * sp("demolition", "labourLoadOutHoursPerCuYd"), 33);
  // The load-out figure is the one that gets forgotten, so its size relative to
  // the demolition itself is asserted rather than left implicit.
  ok(
    "...load-out by hand costs more hours than machine demolition of the same volume",
    sp("demolition", "labourLoadOutHoursPerCuYd") > sp("demolition", "labourMachineDemoHoursPerCuYd") * 3,
  );
  // Weight, which is where the overage comes from.
  //    60 cu yd x 0.25 t = 15 t against 3 cans x 3 t included = 9 t
  //    Overage 6 t x 75  = 450.00
  const tons = debris * sp("demolition", "specMixedDebrisTonsPerCuYd");
  const over = tons - cans * sp("demolition", "specDumpsterIncludedTons");
  near("...15 tons against 9 included, so 6 tons of overage", over, 6);
  near("...costing $450 USD nobody counted", over * rc("demolition", "matTipOveragePerTon", "USD"), 450);
}

// ── Deck: a 320 sqft standard composite deck in CAD, 60 lf of rail, 4 steps.
//    320 x 65  = 20,800.00
//     60 x 98  =  5,880.00
//      4 x 210 =    840.00
//              = 27,520.00
{
  const total =
    320 * rate("deck_building", "standard", "composite", "CAD") +
    60 * rate("deck_building", "standard", "railing", "CAD") +
    4 * fl("deck_building", "stepEach", "CAD");
  near("deck — 320 sqft composite + 60 lf rail + 4 steps = $27,520 CAD", total, 27520);
  ok("...and it clears the minimum charge", total > money(STRUCTURAL_PRICE_BOOKS.deck_building.minimumTotal, "CAD"));
}
// ── Deck cost side: boards, and the diagonal penalty that gets forgotten.
//    Square    320 / 7.5 x 1.10 = 46.93 boards x 82 = 3,848.53
//    Diagonal  320 / 7.5 x 1.18 = 50.35 boards x 82 = 4,128.43
{
  const sq = (320 / sp("deck_building", "specSqftPerBoard16ft")) * (1 + sp("deck_building", "wasteDeckingPct"));
  const dg = (320 / sp("deck_building", "specSqftPerBoard16ft")) * (1 + sp("deck_building", "wasteDeckingDiagonalPct"));
  near("deck — 320 sqft square-laid needs 46.93 composite boards", sq, 46.933, 0.001);
  near("...at $3,848.53 CAD", sq * rc("deck_building", "matDeckBoardCompositePerBoard16ft", "CAD"), 3848.53, 0.001);
  near("...and diagonal costs $279.89 CAD more in boards alone", (dg - sq) * rc("deck_building", "matDeckBoardCompositePerBoard16ft", "CAD"), 279.89, 0.001);
  ok("...plus a third more framing, because the joists go to 12 inches", sp("deck_building", "specJoistSpacingIn") / sp("deck_building", "specJoistSpacingDiagonalIn") > 1.3);
}

// ── Sealcoating: 900 sqft, two coats, USD. The trade this file only costs.
//    Gallons  900 x 2 / 70 = 25.714 x 1.10 = 28.286
//    Sealer   28.286 x 2.60                = 73.54
//    Labour   prep 2.70 + apply 7.20 + mobilise 1.50 + cure 1.00 = 12.40 h
{
  const gal = ((900 * sp("driveway_sealing", "defaultCoats")) / sp("driveway_sealing", "specCoverageSqftPerGalPerCoat")) * (1 + sp("driveway_sealing", "wasteSealerOverOrderPct"));
  near("sealcoating — 900 sqft, two coats, needs 28.29 gallons", gal, 28.286, 0.001);
  near("...at $73.54 USD of sealer", gal * rc("driveway_sealing", "matSealerPerGal", "USD"), 73.54, 0.001);
  const hours =
    sp("driveway_sealing", "labourMobilisationHours") +
    900 * sp("driveway_sealing", "labourPrepHoursPerSqft") +
    900 * sp("driveway_sealing", "labourApplyHoursPerSqftPerCoat") * sp("driveway_sealing", "defaultCoats") +
    sp("driveway_sealing", "labourCureWatchHours");
  near("...and 12.40 crew-hours, which is where the money on this job goes", hours, 12.4);
  ok("...material is under a tenth of the labour at any sane rate", gal * rc("driveway_sealing", "matSealerPerGal", "USD") < hours * 80);
}

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fails.length ? 1 : 0);
