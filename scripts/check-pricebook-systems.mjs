// scripts/check-pricebook-systems.mjs
//
// The systems price books, executed rather than read.
//
// ══ What this file is really guarding ══════════════════════════════════════
//
// Three different lies, in descending order of how much damage they do.
//
// 1. A BOOK THAT APPEARS TO SIZE A SYSTEM. HVAC capacity is a Manual J load
//    calculation. A sprinkler layout is hydraulically calculated and stamped.
//    A PV array's attachment spacing is a structural letter. If any of that
//    ever leaks into this data — a heads-per-square-foot default, a tons-per-
//    square-foot rule of thumb, a hanger spacing — FieldQuo starts producing
//    numbers that read as engineering, about a building nobody looked at.
//    The refusals are DATA (`refusedDefaults`), and the last section of this
//    file proves each refused key is genuinely absent rather than commented
//    about. A refusal a later edit can quietly overturn is not a refusal.
//
// 2. A CONVERTED CURRENCY. Every cost carries an explicit `usd` and an
//    explicit `cad`, reasoned separately, because electricalMaterials.js
//    already measured what happens when you don't: at a live rate of
//    1.35-1.40 a naive `USD x FX` overprices Canadian materials by 5-10%.
//    A converted pair is detectable — every ratio comes out identical — and
//    the ratio-spread assertion below is what detects it.
//
// 3. A BOOK THAT RENDERS BLANK. tradeIsPricedByDefault() returning true while
//    priceBookBasis() returns [] is the exact "control that appears to work and
//    doesn't" this repo has been swept for three times. So the books are
//    SPLICED INTO THE LIVE MAPS in-process and the real helpers are called
//    against them — not re-implemented here, not regex-matched. If
//    tradePriceBooks.js changes how a book is read, this fails.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-pricebook-systems.mjs

import {
  TRADE_PRICE_BOOKS,
  PRICE_BOOK_FIELDS,
  PRICE_BOOK_GROUPS,
  COMPLEXITY_LEVELS,
  TRADE_DEFAULT_RATES,
  allPriceBookUnits,
  priceBookBasis,
  priceBookComplexity,
  hasPriceBook,
  getPriceBook,
  readField,
  tradeIsPricedByDefault,
} from "@/app/data/tradePriceBooks";
import { DEFAULT_LINE_ITEMS } from "@/app/data/defaultLineItems";
import { INDUSTRIES } from "@/app/data/industries";
import { TRADE_CATALOG } from "@/lib/trades/catalog";
import {
  SYSTEMS_PRICE_BOOKS,
  SYSTEMS_PRICE_BOOK_FIELDS,
  SYSTEMS_PRICE_BOOK_GROUPS,
  SYSTEMS_NEW_UNITS,
  SYSTEMS_RECIPES,
  SYSTEMS_RECIPE_EDITABLE_FIELDS,
  SYSTEMS_ADD_ONS,
  SYSTEMS_LINE_ITEMS,
  SYSTEMS_TRADES,
  SYSTEMS_ENGINEERING_LIMITS,
  SYSTEMS_COVERAGE,
  MERGE_NOTES,
  engineeringLimitFor,
  getSystemsRecipe,
  costIn,
} from "@/app/data/priceBooks/systems";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond
    ? (pass++, console.log(`  ✓ ${label}`))
    : fails.push(`${label}${detail !== undefined ? ` — got ${detail}` : ""}`);

const NEW_BOOK_KEYS = Object.keys(SYSTEMS_PRICE_BOOKS);
const RECIPE_KEYS = Object.keys(SYSTEMS_RECIPES);
const round2 = (n) => Math.round(n * 100) / 100;

/* ══ 0. The premise the brief was written on ═══════════════════════════════
 *
 * The brief said "16 price books and 14 are empty". Asserting the opposite here
 * is not point-scoring: the next agent handed the same sentence should find it
 * contradicted by a check that runs, not by a comment it might not read.
 */
console.log("\nThe existing books are NOT empty — the brief's premise, checked");
const EXISTING = Object.keys(TRADE_PRICE_BOOKS);
ok("tradePriceBooks.js ships 16 books", EXISTING.length === 16, EXISTING.length);
const populated = EXISTING.filter((k) => Object.keys(TRADE_PRICE_BOOKS[k]).length > 1);
ok("...and every one of them has content beyond a label", populated.length === 16, populated.length);
for (const key of ["roofing_service", "siding", "gutter_services", "garage_door"]) {
  const book = TRADE_PRICE_BOOKS[key];
  ok(`${key} is populated, not empty`, Object.keys(book).length > 2, Object.keys(book).length);
  ok(`...and priceBookBasis(${key}) already answers`, priceBookBasis(key).length > 0);
}

console.log("\nThe trades that genuinely cannot be priced today");
for (const key of ["hvac_install", "hvac_repair"]) {
  ok(`${key} IS a catalogue key`, Boolean(TRADE_CATALOG[key]));
  ok(`...with no price book before the merge`, !hasPriceBook(key));
  ok(`...and no opening hourly rate either`, !TRADE_DEFAULT_RATES[key]);
  ok(`...so tradeIsPricedByDefault(${key}) is false — the real gap`,
    tradeIsPricedByDefault(key) === false);
}
for (const key of ["solar_pv_install", "fire_sprinkler"]) {
  ok(`${key} is not a catalogue key at all`, !TRADE_CATALOG[key]);
  ok(`...and SYSTEMS_TRADES says so`, SYSTEMS_TRADES[key].categoryExists === false);
}

/* ══ 1. Splice into the live maps and call the REAL helpers ════════════════ */

// Snapshotted BEFORE the splice. Deriving the pre-existing vocabulary by
// subtracting the systems units afterwards looks equivalent and is not: it
// deletes "each" and "linear ft" from the known list because the systems books
// also use them, and then reports every one of them as an undeclared new unit.
// (It did, on the first run of this file.)
const PRE_EXISTING_UNITS = new Set(allPriceBookUnits());

console.log("\nThe books, spliced in and run through the real helpers");
for (const key of NEW_BOOK_KEYS) {
  TRADE_PRICE_BOOKS[key] = SYSTEMS_PRICE_BOOKS[key];
  PRICE_BOOK_FIELDS[key] = SYSTEMS_PRICE_BOOK_FIELDS[key];
}
for (const [k, v] of Object.entries(SYSTEMS_PRICE_BOOK_GROUPS)) PRICE_BOOK_GROUPS[k] = v;

for (const key of NEW_BOOK_KEYS) {
  ok(`hasPriceBook(${key})`, hasPriceBook(key) === true);
  ok(`...tradeIsPricedByDefault(${key}) is now true`, tradeIsPricedByDefault(key) === true);
  const basis = priceBookBasis(key);
  ok(`...priceBookBasis returns units, not []`, basis.length > 0, basis.length);
  const levels = priceBookComplexity(key);
  ok(`...priceBookComplexity finds all three tiers`, levels && levels.length === 3,
    levels ? levels.length : "null");
  ok(`...getPriceBook round-trips an override without losing the rest`, (() => {
    const merged = getPriceBook(key, { complexity: { standard: { __probe: 1 } } });
    return merged.complexity.standard.__probe === 1 && merged.label === SYSTEMS_PRICE_BOOKS[key].label;
  })());
}

console.log("\nEvery declared field path resolves to a number in its book");
for (const key of NEW_BOOK_KEYS) {
  const book = SYSTEMS_PRICE_BOOKS[key];
  for (const field of SYSTEMS_PRICE_BOOK_FIELDS[key]) {
    const value = readField(book, field.path);
    ok(`${key}: ${field.path}`, Number.isFinite(value), String(value));
  }
  // And the reverse: a rate the settings screen cannot reach is a rate nobody
  // can fix. Every complexity rate must have a field pointing at it.
  const paths = new Set(SYSTEMS_PRICE_BOOK_FIELDS[key].map((f) => f.path));
  for (const level of ["standard", "moderate", "high"]) {
    for (const rate of Object.keys(book.complexity[level])) {
      if (rate === "desc") continue;
      ok(`${key}: complexity.${level}.${rate} is editable`,
        paths.has(`complexity.${level}.${rate}`));
    }
  }
  for (const [name, value] of Object.entries(book.extras || {})) {
    if (typeof value === "object") {
      for (const sub of Object.keys(value)) {
        ok(`${key}: extras.${name}.${sub} is editable`, paths.has(`extras.${name}.${sub}`));
      }
    } else {
      ok(`${key}: extras.${name} is editable`, paths.has(`extras.${name}`));
    }
  }
}

console.log("\nEvery group a field names exists in PRICE_BOOK_GROUPS");
for (const key of NEW_BOOK_KEYS) {
  for (const field of SYSTEMS_PRICE_BOOK_FIELDS[key]) {
    if (!field.group) continue;
    ok(`${key}: group "${field.group}"`,
      Object.prototype.hasOwnProperty.call(PRICE_BOOK_GROUPS, field.group));
  }
}

/* ══ 2. Tiers and priceTypes ══════════════════════════════════════════════ */

console.log("\nThree tiers, each with a desc that says what puts a job in it");
for (const key of NEW_BOOK_KEYS) {
  const c = SYSTEMS_PRICE_BOOKS[key].complexity;
  const levels = COMPLEXITY_LEVELS.map((l) => l.value);
  ok(`${key} declares exactly the shared tier vocabulary`,
    levels.every((l) => c[l]) && Object.keys(c).length === 3);
  for (const level of levels) {
    ok(`${key}.${level} has a desc of substance`,
      typeof c[level].desc === "string" && c[level].desc.length > 40);
  }
  // Three tiers with the same number in each is a tier system that does
  // nothing. Rates must strictly increase with difficulty.
  for (const rate of Object.keys(c.standard).filter((k) => k !== "desc")) {
    ok(`${key}.${rate} rises standard < moderate < high`,
      c.standard[rate] < c.moderate[rate] && c.moderate[rate] < c.high[rate],
      `${c.standard[rate]}/${c.moderate[rate]}/${c.high[rate]}`);
  }
}

console.log("\nEvery priceType an item uses exists in ALL THREE tiers");
for (const key of NEW_BOOK_KEYS) {
  const book = SYSTEMS_PRICE_BOOKS[key];
  for (const item of book.items) {
    if (item.priceType === "flat") {
      ok(`${key}/${item.id}: flat item carries a flatPrice`,
        Number.isFinite(item.flatPrice), String(item.flatPrice));
      // A flat price of zero is allowed and is sometimes the honest answer —
      // but only when the book says why, the way garage_door.installPricePerDoor
      // already does. A silent zero is a control that appears to work.
      if (item.flatPrice === 0) {
        ok(`${key}/${item.id}: a zero price states its reason`,
          typeof item.blankReason === "string" && item.blankReason.length > 40);
      } else {
        ok(`${key}/${item.id}: a real flat price is positive`, item.flatPrice > 0);
      }
      continue;
    }
    for (const level of ["standard", "moderate", "high"]) {
      const rate = book.complexity[level][item.priceType];
      ok(`${key}/${item.id}: ${item.priceType} present in ${level}`,
        Number.isFinite(rate) && rate > 0, String(rate));
    }
  }
  // The reverse — a tier rate nothing prices by is dead weight on the rate card.
  const used = new Set(book.items.map((i) => i.priceType));
  for (const rate of Object.keys(book.complexity.standard)) {
    if (rate === "desc") continue;
    ok(`${key}: ${rate} is actually used by an item`, used.has(rate));
  }
}

/* ══ 3. Units ═════════════════════════════════════════════════════════════ */

console.log("\nUnits: known vocabulary, or declared new with a reason");
const preExisting = PRE_EXISTING_UNITS;
// Post-splice, the vocabulary must have GROWN by exactly the declared new
// units and nothing else — a unit that appears without being declared is the
// synonym problem arriving silently.
const afterUnits = new Set(allPriceBookUnits());
for (const u of afterUnits) {
  ok(`post-merge unit "${u}" is either pre-existing or declared`,
    preExisting.has(u) || Object.prototype.hasOwnProperty.call(SYSTEMS_NEW_UNITS, u));
}

// Normalising catches the real failure: "linear foot" beside the existing
// "linear ft" would be one concept wearing two names, and the copy is the one
// that rots.
const norm = (u) => String(u).toLowerCase().replace(/[^a-z]/g, "");
const preExistingNorm = new Map([...preExisting].map((u) => [norm(u), u]));

for (const key of NEW_BOOK_KEYS) {
  for (const item of SYSTEMS_PRICE_BOOKS[key].items) {
    const known = preExisting.has(item.unit) ||
      Object.prototype.hasOwnProperty.call(SYSTEMS_NEW_UNITS, item.unit);
    ok(`${key}/${item.id}: unit "${item.unit}" is known or declared`, known);
  }
}
for (const [unit, why] of Object.entries(SYSTEMS_NEW_UNITS)) {
  ok(`new unit "${unit}" says why it is needed`, typeof why === "string" && why.length > 40);
  const collision = preExistingNorm.get(norm(unit));
  ok(`new unit "${unit}" is not a synonym of an existing one`,
    collision === undefined || collision === unit, collision);
}
// Every declared new unit must be earned by an item that uses it. A unit
// vocabulary that grows without a user is a feature flag for a feature that
// does not exist.
const unitsInUse = new Set();
for (const key of NEW_BOOK_KEYS)
  for (const item of SYSTEMS_PRICE_BOOKS[key].items) unitsInUse.add(item.unit);
for (const unit of Object.keys(SYSTEMS_NEW_UNITS)) {
  ok(`new unit "${unit}" is used by at least one item`,
    unitsInUse.has(unit) || unit === "hour" || preExisting.has(unit));
}

/* ══ 4. Industry and category mapping ═════════════════════════════════════ */

console.log("\nIndustry and category keys resolve");
const SLUGS = new Set(INDUSTRIES.map((i) => i.slug));
for (const [key, trade] of Object.entries(SYSTEMS_TRADES)) {
  for (const slug of trade.industries) {
    ok(`${key}: industry "${slug}" exists in INDUSTRIES`, SLUGS.has(slug));
  }
  ok(`${key}: categoryExists matches lib/trades/catalog.js`,
    trade.categoryExists === Boolean(TRADE_CATALOG[key]));
  // An empty industries array is a STATEMENT — "no industry preset offers
  // this" — and it has to be defended in the note, not left looking like an
  // oversight. Absence of a statement is not a statement.
  if (trade.industries.length === 0) {
    ok(`${key}: an empty industry list explains itself`,
      /No industry|no industry|own trade/.test(trade.note), trade.note);
  }
  // And where the catalogue already knows the trade, the industries here must
  // agree with it rather than quietly proposing a different set.
  if (TRADE_CATALOG[key]) {
    const live = [...TRADE_CATALOG[key].industries].sort().join(",");
    ok(`${key}: industries match the catalogue's own`,
      live === [...trade.industries].sort().join(","), live);
  }
}

/* ══ 5. Costs — both currencies, never converted, never zero ══════════════ */

console.log("\nEvery cost carries BOTH currencies, or neither with a reason");
const allCosts = [];
function walkCosts(node, path) {
  if (!node || typeof node !== "object") return;
  if (Object.prototype.hasOwnProperty.call(node, "usd") &&
      Object.prototype.hasOwnProperty.call(node, "cad")) {
    allCosts.push({ path, cost: node });
    return;
  }
  for (const [k, v] of Object.entries(node)) walkCosts(v, `${path}.${k}`);
}
for (const key of RECIPE_KEYS) walkCosts(SYSTEMS_RECIPES[key], key);

ok("the recipes contain costs at all", allCosts.length > 40, allCosts.length);
for (const { path, cost } of allCosts) {
  const bothNull = cost.usd === null && cost.cad === null;
  const bothNumbers = Number.isFinite(cost.usd) && Number.isFinite(cost.cad);
  ok(`${path}: usd and cad are both present or both absent`, bothNull || bothNumbers,
    `${cost.usd}/${cost.cad}`);
  if (bothNull) {
    ok(`${path}: a blank cost states its reason`,
      typeof cost.blankReason === "string" && cost.blankReason.length > 40);
  }
  if (bothNumbers) {
    ok(`${path}: usd is positive and finite`, cost.usd > 0, cost.usd);
    ok(`${path}: cad is positive and finite`, cost.cad > 0, cost.cad);
    // Absurdity. Nothing in these trades is a fraction of a cent, and nothing
    // a contractor buys off a shelf is six figures.
    ok(`${path}: usd is not absurd`, cost.usd >= 0.05 && cost.usd <= 50000, cost.usd);
    ok(`${path}: cad is not absurd`, cost.cad >= 0.05 && cost.cad <= 50000, cost.cad);
  }
}

console.log("\nThe two currencies were reasoned separately, not converted");
// A converted table has ONE ratio. A reasoned one has many. This is the only
// mechanical way to catch somebody running USD x 1.38 down the column, and it
// is exactly the failure electricalMaterials.js measured and refused.
const ratios = allCosts
  .filter(({ cost }) => Number.isFinite(cost.usd) && Number.isFinite(cost.cad))
  .map(({ cost }) => Math.round((cost.cad / cost.usd) * 1000) / 1000);
const distinct = new Set(ratios);
ok("no single fixed ratio explains every cost", distinct.size > ratios.length * 0.5,
  `${distinct.size} distinct ratios across ${ratios.length} costs`);
ok("...and no one ratio covers more than a fifth of them", (() => {
  const counts = new Map();
  for (const r of ratios) counts.set(r, (counts.get(r) || 0) + 1);
  return Math.max(...counts.values()) <= Math.ceil(ratios.length * 0.2);
})());
// Every costed material must also say where EACH currency came from. One basis
// string for a pair is the tell that one of them was derived from the other.
for (const key of RECIPE_KEYS) {
  for (const [name, m] of Object.entries(SYSTEMS_RECIPES[key].materials || {})) {
    if (m.cost?.usd == null) continue;
    ok(`${key}/${name}: usdBasis states a source`, typeof m.usdBasis === "string" && m.usdBasis.length > 15);
    ok(`${key}/${name}: cadBasis states a SEPARATE source`,
      typeof m.cadBasis === "string" && m.cadBasis.length > 15 && m.cadBasis !== m.usdBasis);
    ok(`${key}/${name}: confidence is a declared value`,
      ["read", "derived", "market_typical"].includes(m.confidence), m.confidence);
  }
}

console.log("\ncostIn() reads one currency and refuses to invent the other");
const probe = { usd: 10, cad: 14 };
ok("reads usd", costIn(probe, "usd") === 10);
ok("reads cad", costIn(probe, "cad") === 14);
ok("...case-insensitively", costIn(probe, "CAD") === 14);
ok("an unknown currency returns null, not a conversion", costIn(probe, "eur") === null);
ok("a null side returns null, not the other side",
  costIn({ usd: null, cad: 14 }, "usd") === null);
ok("...and never falls back", costIn({ usd: null, cad: null }, "cad") === null);
ok("a non-object returns null", costIn(null, "usd") === null);

/* ══ 6. Labour is hours. Always. ══════════════════════════════════════════ */

console.log("\nEvery recipe has the four parts a recipe is made of");
// Structural, and FIRST. Mutation-testing this file found it crashing on a
// malformed recipe instead of reporting one, which is a check that fails
// unhelpfully — the reader gets a stack trace where they wanted a sentence.
for (const key of RECIPE_KEYS) {
  const r = SYSTEMS_RECIPES[key];
  ok(`${key} has materials`, r.materials && Object.keys(r.materials).length > 0);
  ok(`${key} has labourHours`, r.labourHours && Object.keys(r.labourHours).length > 1);
  ok(`${key} has consumption`, Boolean(r.consumption));
  ok(`${key} has equipment`, r.equipment && Object.keys(r.equipment).length > 0);
  ok(`${key} declares a model`, typeof r.model === "string" && r.model.startsWith("systems_"));
  for (const [name, value] of Object.entries(r.consumption || {})) {
    ok(`${key}.consumption.${name} is a positive number`,
      Number.isFinite(value) && value > 0, value);
  }
}

console.log("\nLabour is HOURS — there is no dollar rate anywhere in a recipe");
for (const key of RECIPE_KEYS) {
  const hours = SYSTEMS_RECIPES[key].labourHours;
  ok(`${key} declares labourHours`, Boolean(hours));
  for (const [name, value] of Object.entries(hours || {})) {
    if (name === "note" || name.endsWith("AppliesTo")) continue;
    if (typeof value === "object") {
      for (const [sub, v] of Object.entries(value)) {
        ok(`${key}.labourHours.${name}.${sub} is a positive factor`,
          Number.isFinite(v) && v > 0, v);
      }
      continue;
    }
    ok(`${key}.labourHours.${name} is a positive number of hours`,
      Number.isFinite(value) && value > 0, value);
    // Hours, not dollars. Nothing in these trades takes 200 crew-hours as a
    // single constant, and a rate that slipped in would land far above this.
    ok(`${key}.labourHours.${name} is plausibly hours, not a rate`, value <= 40, value);
  }
  // The name is load-bearing: `labourRate`, `costPerHour` or `hourlyRate`
  // showing up here means two places in the product know what an hour costs.
  const names = Object.keys(hours || {}).join(" ").toLowerCase();
  ok(`${key}: no rate-shaped key hiding among the hours`,
    !/(rate|cost|price|dollar|perhour|hourly)/.test(names.replace(/hours/g, "")), names);
}
ok("the editable-fields list for labour offers hours and nothing else",
  SYSTEMS_RECIPE_EDITABLE_FIELDS.labourHours.every((f) => f.label === "Crew-hours"));
ok("...and the material list offers both currencies separately",
  SYSTEMS_RECIPE_EDITABLE_FIELDS.material.some((f) => f.key === "cost.usd") &&
  SYSTEMS_RECIPE_EDITABLE_FIELDS.material.some((f) => f.key === "cost.cad"));

console.log("\nEditing one currency leaves the other exactly where it was");
const before = SYSTEMS_RECIPES.gutter_services.materials.alum_coil_5in;
const edited = getSystemsRecipe("gutter_services", {
  materials: { alum_coil_5in: { cost: { usd: 99 } } },
});
ok("the edited currency changed", edited?.materials?.alum_coil_5in?.cost?.usd === 99);
ok("...the other currency did NOT", edited?.materials?.alum_coil_5in?.cost?.cad === before.cost.cad,
  edited?.materials?.alum_coil_5in?.cost?.cad);
ok("...the pack survived", edited?.materials?.alum_coil_5in?.pack?.size === before.pack.size);
ok("...and so did both provenance strings",
  edited?.materials?.alum_coil_5in?.usdBasis === before.usdBasis &&
  edited?.materials?.alum_coil_5in?.cadBasis === before.cadBasis);
ok("...and the base object was not mutated", before.cost.usd === 132, before.cost.usd);
ok("a __proto__ key in company JSON is refused", (() => {
  const dirty = getSystemsRecipe("gutter_services", JSON.parse('{"__proto__":{"polluted":1}}'));
  return dirty.polluted === undefined && {}.polluted === undefined;
})());

/* ══ 7. Sample quotes, against hand-computed figures ══════════════════════ */
//
// Each total is worked out by hand in the comment above it. If a rate moves,
// this fails and somebody has to redo the arithmetic — which is the point.

console.log("\nSample quotes match figures computed by hand");

const rate = (key, level, type) => SYSTEMS_PRICE_BOOKS[key].complexity[level][type];
const flat = (key, id) => SYSTEMS_PRICE_BOOKS[key].items.find((i) => i.id === id).flatPrice;

// HVAC install, MODERATE: a 3-ton heat pump and a furnace going into an attic,
// with 40 ft of new branch duct, six registers, a new lineset, a thermostat,
// commissioning and hauling the old equipment away.
//   3 t x 3200 = 9600 | 1 furnace x 6600 = 6600 | 40 ft x 38 = 1520
//   6 registers x 95 = 570 | lineset 900 | thermostat 320 | startup 250
//   removal 175
//   9600+6600+1520+570+900+320+250+175 = 19935
const hvacQuote =
  3 * rate("hvac_install", "moderate", "heatPumpPerTon") +
  1 * rate("hvac_install", "moderate", "furnaceEach") +
  40 * rate("hvac_install", "moderate", "ductLinearFt") +
  6 * rate("hvac_install", "moderate", "registerEach") +
  flat("hvac_install", "lineset") +
  flat("hvac_install", "thermostat") +
  flat("hvac_install", "startup") +
  SYSTEMS_PRICE_BOOKS.hvac_install.extras.oldEquipmentRemovalPrice;
ok("hvac_install moderate: 3-ton heat pump + furnace changeout = $19,935",
  hvacQuote === 19935, hvacQuote);

// HVAC repair, STANDARD: a diagnostic, two and a half hours of repair, and
// three pounds of refrigerant weighed in.
//   149 + 2.5 x 125 (=312.50) + 3 x 95 (=285) = 746.50
const repairQuote =
  flat("hvac_repair", "diagnostic") +
  2.5 * rate("hvac_repair", "standard", "labourHour") +
  3 * rate("hvac_repair", "standard", "refrigerantPerLb");
ok("hvac_repair standard: diagnostic + 2.5 h + 3 lb = $746.50", repairQuote === 746.5, repairQuote);
ok("...and it clears the minimum call charge, so the floor does not apply",
  repairQuote > SYSTEMS_PRICE_BOOKS.hvac_repair.extras.minimumCallPrice);

// Solar, STANDARD: an 8,400 W array, a 13.5 kWh battery and 60 ft of critter
// guard on a walkable single-storey comp-shingle roof.
//   8400 W x 2.60 = 21840 | 13.5 kWh x 900 = 12150 | 60 ft x 9 = 540
//   21840 + 12150 + 540 = 34530
const solarQuote =
  8400 * rate("solar_pv_install", "standard", "pvPerWatt") +
  13.5 * rate("solar_pv_install", "standard", "batteryPerKwh") +
  60 * flat("solar_pv_install", "critter_guard");
ok("solar_pv_install standard: 8.4 kW + 13.5 kWh + guard = $34,530",
  round2(solarQuote) === 34530, round2(solarQuote));

// Fire sprinkler, MODERATE: a 46-head 13R retrofit with 180 ft of main, a
// riser, a backflow and the switches. Head count and pipe length are TAKEN OFF
// A STAMPED DRAWING — this arithmetic prices a design, it does not make one.
//   46 x 320 = 14720 | 180 x 22 = 3960 | riser 3200 | backflow 2800
//   switches 650  ->  14720+3960+3200+2800+650 = 25330
const sprinklerQuote =
  46 * rate("fire_sprinkler", "moderate", "headEach") +
  180 * rate("fire_sprinkler", "moderate", "pipePerFt") +
  flat("fire_sprinkler", "riser") +
  flat("fire_sprinkler", "backflow") +
  flat("fire_sprinkler", "switches");
ok("fire_sprinkler moderate: 46 heads + 180 ft main + devices = $25,330",
  sprinklerQuote === 25330, sprinklerQuote);

console.log("\nSample COSTS match figures computed by hand, in both currencies");
// 180 ft of 5" seamless aluminium, four runs, six downspouts, single storey.
//
// USD, per material, quantity x (pack cost / pack size):
//   coil      180 x 1.08 waste = 194.4 ft x (132/50 = 2.64)   = 513.216
//   hangers   180 x 0.5 = 90 x 3.10                           = 279
//   sealant   180 x 0.025 = 4.5 tubes x 9.50                  = 42.75
//   screws    180 x 0.6 = 108 x (14.00/250 = 0.056)           = 6.048
//   end caps  4 runs x 6.40                                   = 25.60
//   downspout 6 x 12 = 72 ft x (13.50/10 = 1.35)              = 97.20
//   elbows    6 x 3 = 18 x 4.90                               = 88.20
//   brackets  6 x 2 = 12 x 3.40                               = 40.80
//                                                     total   = 1092.814
// CAD, the same quantities against the separately-reasoned Canadian costs:
//   194.4 x 3.70 = 719.28 | 90 x 4.30 = 387 | 4.5 x 13.00 = 58.50
//   108 x 0.078 = 8.424   | 4 x 9.00 = 36   | 72 x 1.90 = 136.80
//   18 x 6.90 = 124.20    | 12 x 4.80 = 57.60          total = 1527.804
const G = SYSTEMS_RECIPES.gutter_services;
const gm = G.materials;
const gc = G.consumption;
const per = (m, cur) => costIn(m.cost, cur) / m.pack.size;
function gutterMaterialCost(currency) {
  const ft = 180;
  const runs = 4;
  const downspouts = 6;
  return (
    ft * (1 + gm.alum_coil_5in.wastePct) * per(gm.alum_coil_5in, currency) +
    ft * gc.hangersPerFt * per(gm.hidden_hanger, currency) +
    ft * gc.sealantTubesPerFt * per(gm.gutter_sealant, currency) +
    ft * gc.zipScrewsPerFt * per(gm.zip_screws, currency) +
    runs * gc.endCapPairsPerRun * per(gm.end_cap_pair, currency) +
    downspouts * gc.downspoutFtPerDownspout * per(gm.downspout_2x3, currency) +
    downspouts * gc.elbowsPerDownspout * per(gm.downspout_elbow, currency) +
    downspouts * gc.bracketsPerDownspout * per(gm.downspout_bracket, currency)
  );
}
ok("gutters, 180 ft + 6 downspouts: USD materials = $1,092.81",
  round2(gutterMaterialCost("usd")) === 1092.81, round2(gutterMaterialCost("usd")));
ok("...CAD materials = $1,527.80",
  round2(gutterMaterialCost("cad")) === 1527.8, round2(gutterMaterialCost("cad")));
// And the two are NOT one number times a constant — the whole point of
// carrying both. If they were, this ratio would equal every other ratio in the
// file, which the spread assertion above already refuses.
ok("...and the two totals do not sit on a round exchange rate",
  Math.abs(gutterMaterialCost("cad") / gutterMaterialCost("usd") - 1.4) > 0.0001);

// Crew-hours for the same job, single storey (storeyFactor.one = 1.0):
//   mobilisation 1.25 + 180 x 0.09 (=16.2) + 6 x 0.65 (=3.9) = 21.35
const gh = G.labourHours;
const gutterHours =
  gh.mobilisationHours +
  (180 * gh.runHoursPerFt + 6 * gh.downspoutHoursEach) * gh.storeyFactor.one;
ok("gutters, same job: 21.35 crew-hours", round2(gutterHours) === 21.35, round2(gutterHours));
// Three storeys is the same job up a lift, and only the install side moves.
//   1.25 + (16.2 + 3.9) x 1.55 = 1.25 + 31.155 = 32.405
const gutterHours3 =
  gh.mobilisationHours +
  (180 * gh.runHoursPerFt + 6 * gh.downspoutHoursEach) * gh.storeyFactor.three_plus;
ok("...and 32.41 at three storeys", round2(gutterHours3) === 32.41, round2(gutterHours3));
ok("...cleaning is NOT in the list the storey factor applies to — the book's own trap",
  !gh.storeyFactorAppliesTo.includes("cleaning"));

// Garage door, one 16x7 opening with an opener, capped, old door away.
//   door 1180 + spring 68 + track 115 + opener 255 + seal 24
//   + stop 31 + capping 46 + fasteners 19  = 1738 USD
const gd = SYSTEMS_RECIPES.garage_door.materials;
const doorCostUsd =
  costIn(gd.door_16x7_insulated_steel.cost, "usd") +
  costIn(gd.torsion_spring_pair.cost, "usd") +
  costIn(gd.track_hardware_kit.cost, "usd") +
  costIn(gd.opener_belt_075hp.cost, "usd") +
  costIn(gd.weatherstrip_bottom_seal.cost, "usd") +
  costIn(gd.perimeter_stop_moulding.cost, "usd") +
  costIn(gd.alum_capping_coil.cost, "usd") +
  costIn(gd.fasteners_and_sealant.cost, "usd");
ok("garage door, 16x7 with opener and capping: USD materials = $1,738",
  doorCostUsd === 1738, doorCostUsd);
//   1620 + 95 + 160 + 350 + 34 + 44 + 64 + 27 = 2394 CAD
const doorCostCad =
  costIn(gd.door_16x7_insulated_steel.cost, "cad") +
  costIn(gd.torsion_spring_pair.cost, "cad") +
  costIn(gd.track_hardware_kit.cost, "cad") +
  costIn(gd.opener_belt_075hp.cost, "cad") +
  costIn(gd.weatherstrip_bottom_seal.cost, "cad") +
  costIn(gd.perimeter_stop_moulding.cost, "cad") +
  costIn(gd.alum_capping_coil.cost, "cad") +
  costIn(gd.fasteners_and_sealant.cost, "cad");
ok("...CAD materials = $2,394", doorCostCad === 2394, doorCostCad);
//   0.75 mobilisation + 1.0 removal + 5.0 install + 1.5 opener + 1.25 capping = 9.5 h
const dh = SYSTEMS_RECIPES.garage_door.labourHours;
const doorHours =
  dh.mobilisationHours + dh.removeExistingHoursPerDoor +
  dh.installHoursDoubleDoor + dh.openerHours + dh.cappingHoursPerOpening;
ok("...and 9.5 crew-hours", doorHours === 9.5, doorHours);

/* ══ 8. Nothing here sizes or designs a system ════════════════════════════ */

console.log("\nNothing in the data claims to size, space or design anything");

// Key-path fragments, normalised so camelCase cannot hide one.
//
// ── Why this list is scoped, and why that is not a loophole ────────────────
//
// The first run of this file failed on `gutter_services.consumption.hangersPerFt`
// against the term "hangersper", which was on one global list. Deleting the
// term to make it pass would have been the wrong fix: hanger spacing in a
// SPRINKLER system is prescribed by NFPA 13 and appears on a stamped drawing,
// and a default for it is precisely what must never ship. Hanger spacing on a
// GUTTER is 24 inches on centre because that is how gutter crews hang gutters.
// Same word, two completely different kinds of fact.
//
// So the strict list applies to the engineered trades, and the universal list
// applies everywhere including them. Scoping by trade is honest; deleting the
// term would have been the check bending to the data.
const UNIVERSAL_SIZING_TERMS = [
  "loadcalculation", "manualj", "manuald", "tonsper", "tonnagefor",
  "designdensity", "hazardclass", "areaofoperation", "conductorsize",
  "windload", "sizingrule", "ruleofthumb",
];
const ENGINEERED_SIZING_TERMS = [
  "sizefor", "spacingper", "perspacing", "headsper", "headspacing",
  "springsize", "attachmentsper", "hangersper", "pipesizefor",
  "wattsperroof", "arraywattsper",
];
// A trade is engineered when its own limit says a licensed professional
// decides what gets installed — read from the data, not listed again here.
const ENGINEERED = new Set(
  Object.entries(SYSTEMS_ENGINEERING_LIMITS)
    .filter(([, l]) => l.blocking === true)
    .map(([k]) => k),
);
// Phrases in string VALUES that would make a renderer say the product sized
// something. Deliberately narrow — the disclaimers are full of the word
// "size" and must not trip this.
const FORBIDDEN_CLAIMS = [
  /\bwe size\b/i,
  /\bsizes? (the|your) (system|equipment|array|head)/i,
  /\bcalculates? the (load|demand|density)\b/i,
  /\brecommended (tonnage|capacity|size)\b/i,
  /\bautomatically siz/i,
  /\bdetermines? the (hazard|head count|spacing)\b/i,
];
// Subtrees whose whole job is to state the limit. Scanning them would fail on
// the disclaimer itself, which would be the check misreading its own subject.
const LIMIT_SUBTREES = new Set(["engineeringLimit", "refusedDefaults"]);

const sizingHits = [];
function scanForSizing(node, path, key, terms) {
  if (LIMIT_SUBTREES.has(key)) return;
  if (typeof node === "string") {
    for (const re of FORBIDDEN_CLAIMS) {
      if (re.test(node)) sizingHits.push(`${path}: claim ${re}`);
    }
    return;
  }
  if (!node || typeof node !== "object") return;
  for (const [k, v] of Object.entries(node)) {
    const flatK = k.toLowerCase().replace(/[^a-z]/g, "");
    for (const term of terms) {
      if (flatK.includes(term)) sizingHits.push(`${path}.${k}: key term "${term}"`);
    }
    scanForSizing(v, `${path}.${k}`, k, terms);
  }
}
// Trade-keyed exports are scanned trade by trade so the strict list follows the
// engineered ones. Everything else gets the universal list.
for (const [name, byTrade] of Object.entries({
  SYSTEMS_PRICE_BOOKS, SYSTEMS_RECIPES, SYSTEMS_ADD_ONS,
  SYSTEMS_LINE_ITEMS, SYSTEMS_PRICE_BOOK_FIELDS, SYSTEMS_TRADES,
})) {
  for (const [trade, node] of Object.entries(byTrade)) {
    const terms = ENGINEERED.has(trade)
      ? [...UNIVERSAL_SIZING_TERMS, ...ENGINEERED_SIZING_TERMS]
      : UNIVERSAL_SIZING_TERMS;
    scanForSizing(node, `${name}.${trade}`, trade, terms);
  }
}
for (const [name, node] of Object.entries({
  SYSTEMS_COVERAGE, SYSTEMS_NEW_UNITS, MERGE_NOTES,
})) scanForSizing(node, name, name, UNIVERSAL_SIZING_TERMS);
ok("no sizing vocabulary anywhere in the shipped data", sizingHits.length === 0,
  sizingHits.join(" | "));
// And the strict list must actually be doing work: if none of its terms would
// ever hit anything, the scope split is decoration. Prove it fires by running
// it over a deliberately bad recipe.
const poison = { consumption: { headsPerSqft: 0.006 } };
const before2 = sizingHits.length;
scanForSizing(poison, "poison", "fire_sprinkler",
  [...UNIVERSAL_SIZING_TERMS, ...ENGINEERED_SIZING_TERMS]);
ok("the engineered term list would catch a heads-per-square-foot default",
  sizingHits.length === before2 + 1);
sizingHits.length = before2;

console.log("\nThe refusals are real — every refused key is genuinely absent");
for (const key of RECIPE_KEYS) {
  const recipe = SYSTEMS_RECIPES[key];
  ok(`${key} declares what it refuses to default`,
    Array.isArray(recipe.refusedDefaults) && recipe.refusedDefaults.length > 0);
  for (const refusal of recipe.refusedDefaults || []) {
    ok(`${key}: refusal "${refusal.key}" explains itself`,
      typeof refusal.why === "string" && refusal.why.length > 60);
    // The assertion that makes a refusal more than a comment: the key must not
    // exist in consumption, in labourHours, or in materials.
    ok(`${key}: "${refusal.key}" is absent from consumption`,
      !Object.prototype.hasOwnProperty.call(recipe.consumption || {}, refusal.key));
    ok(`${key}: "${refusal.key}" is absent from labourHours`,
      !Object.prototype.hasOwnProperty.call(recipe.labourHours || {}, refusal.key));
    ok(`${key}: "${refusal.key}" is absent from materials`,
      !Object.prototype.hasOwnProperty.call(recipe.materials || {}, refusal.key));
  }
}

console.log("\nThe engineering limit is data a renderer can act on");
for (const key of Object.keys(SYSTEMS_ENGINEERING_LIMITS)) {
  const limit = engineeringLimitFor(key);
  ok(`${key}: engineeringLimitFor returns a limit`, limit !== null);
  ok(`${key}: it says what FieldQuo does NOT do`,
    typeof limit.fieldquoDoesNot === "string" && limit.fieldquoDoesNot.length > 20);
  ok(`${key}: it names where the quantities come from`,
    typeof limit.inputSource === "string" && limit.inputSource.length > 20);
}
// roofing and siding are in SYSTEMS_TRADES as coverage records, not as trades
// this file owns, so they carry no limit — and must not, because inventing one
// would put a banner on a trade this file did not touch.
for (const key of ["roofing_service", "siding"]) {
  ok(`${key}: no engineering limit, because this file does not own it`,
    engineeringLimitFor(key) === null);
}
ok("engineeringLimitFor refuses a prototype key, like every other lookup here",
  engineeringLimitFor("__proto__") === null && engineeringLimitFor("constructor") === null);
// The four engineered trades must be blocking and must carry a banner; the two
// that are not engineered must carry NEITHER, or contractors learn to click
// past the banner that matters.
for (const key of ["hvac_install", "solar_pv_install", "fire_sprinkler"]) {
  const limit = SYSTEMS_ENGINEERING_LIMITS[key];
  ok(`${key} blocks a total until the design source is stated`, limit.blocking === true);
  ok(`${key} carries a client-facing banner`,
    typeof limit.quoteBanner === "string" && limit.quoteBanner.length > 40);
  ok(`${key} names who engineers it`, typeof limit.engineeredBy === "string");
}
for (const key of ["gutter_services", "garage_door"]) {
  ok(`${key} is not engineered and shows no banner`,
    SYSTEMS_ENGINEERING_LIMITS[key].quoteBanner === null &&
    SYSTEMS_ENGINEERING_LIMITS[key].blocking === false);
}
// And every book and every recipe must actually carry the limit, not just the
// registry — a book spliced into TRADE_PRICE_BOOKS travels without it otherwise.
for (const key of NEW_BOOK_KEYS) {
  ok(`${key} book carries its engineeringLimit inline`,
    SYSTEMS_PRICE_BOOKS[key].engineeringLimit === SYSTEMS_ENGINEERING_LIMITS[key]);
}
for (const key of RECIPE_KEYS) {
  ok(`${key} recipe carries its engineeringLimit inline`,
    SYSTEMS_RECIPES[key].engineeringLimit != null &&
    SYSTEMS_RECIPES[key].engineeringLimit === SYSTEMS_ENGINEERING_LIMITS[key]);
}

/* ══ 9. The public/internal boundary ══════════════════════════════════════ */

console.log("\nCost data never leaks into a client-facing list");
// Non-negotiable #4, and the same boundary check-electrical-catalog.mjs
// enforces between its catalogue and its two internal companions.
const leaked = [];
function scanForCostShape(node, path) {
  if (!node || typeof node !== "object") return;
  for (const [k, v] of Object.entries(node)) {
    if (["usdBasis", "cadBasis", "wastePct", "pack", "confidence", "ownedByMostCrews"].includes(k))
      leaked.push(`${path}.${k}`);
    if (k === "cost" && v && typeof v === "object" && "usd" in v) leaked.push(`${path}.${k}`);
    scanForCostShape(v, `${path}.${k}`);
  }
}
scanForCostShape(SYSTEMS_LINE_ITEMS, "SYSTEMS_LINE_ITEMS");
scanForCostShape(SYSTEMS_ADD_ONS, "SYSTEMS_ADD_ONS");
ok("no internal cost fields inside the line items or add-ons", leaked.length === 0,
  leaked.join(", "));

console.log("\nLine items ship a description and a unit, and no price");
const LIVE_UNITS = new Set(
  Object.values(DEFAULT_LINE_ITEMS).flat().map((i) => i.unit),
);
for (const [key, items] of Object.entries(SYSTEMS_LINE_ITEMS)) {
  ok(`${key} is not already in defaultLineItems.js`, !DEFAULT_LINE_ITEMS[key]);
  const keys = new Set();
  for (const item of items) {
    ok(`${key}/${item.key}: has a description`,
      typeof item.description === "string" && item.description.length > 5);
    ok(`${key}/${item.key}: unit is one defaultLineItems.js already uses`,
      LIVE_UNITS.has(item.unit), item.unit);
    ok(`${key}/${item.key}: carries NO rate`, !("rate" in item));
    ok(`${key}/${item.key}: key is unique`, !keys.has(item.key));
    keys.add(item.key);
  }
  // The $0 clause-line pattern electricalCatalog.js took from real estimates:
  // an exclusion read inside the price table is accepted with the quote.
  ok(`${key} carries at least one exclusion clause line`,
    items.some((i) => /not included|by others|not assessed|not warranted|billed separately/.test(i.description)));
}

console.log("\nAdd-ons are seedable Products, and a zero price explains itself");
for (const [key, addons] of Object.entries(SYSTEMS_ADD_ONS)) {
  for (const a of addons) {
    ok(`${key}/${a.name}: type is service or product`,
      ["service", "product"].includes(a.type), a.type);
    ok(`${key}/${a.name}: price is a finite non-negative number`,
      Number.isFinite(a.unitPrice) && a.unitPrice >= 0, a.unitPrice);
    ok(`${key}/${a.name}: has a unit`, typeof a.unit === "string" && a.unit.length > 0);
    if (a.unitPrice === 0) {
      ok(`${key}/${a.name}: a zero price says why`,
        typeof a.description === "string" && a.description.length > 50);
    }
  }
}

/* ══ 10. Roofing and siding: covered, and the map proves it ═══════════════ */

console.log("\nroofing_service: the coverage map matches the live line items");
const liveRoofing = DEFAULT_LINE_ITEMS.roofing_service;
const map = SYSTEMS_COVERAGE.roofing_service.lineItemMap;
ok("the map has an entry per live line item",
  Object.keys(map).length === liveRoofing.length,
  `${Object.keys(map).length} vs ${liveRoofing.length}`);
for (const item of liveRoofing) {
  const entry = map[item.description];
  // Asserting on the STRING is the point: if somebody rewords a chip, this
  // fails loudly instead of the mapping rotting where nobody looks.
  ok(`"${item.description}" is mapped`, Boolean(entry));
  if (!entry) continue;
  ok(`..."${item.description}" unit agrees with the live file`,
    entry.unit === item.unit, `${entry.unit} vs ${item.unit}`);
  ok(`..."${item.description}" names where its sell rate lives`,
    typeof entry.sell === "string" && entry.sell.includes("roofing_service."));
  ok(`..."${item.description}" names where its crew-hours live`,
    typeof entry.hours === "string" && entry.hours.length > 10);
  ok(`..."${item.description}" names its cost, or names the gap`,
    typeof entry.cost === "string" && entry.cost.length > 10);
}
// And every field the map points at must actually exist in the live book.
const roofBook = TRADE_PRICE_BOOKS.roofing_service;
for (const path of [
  "tearOff.firstLayerPerSquare", "deckSheetPrice", "details.iceWaterPerLf",
  "details.dripEdgePerLf", "details.ridgeVentPerLf", "penetrations.chimney.price",
  "penetrations.skylight.price", "materialCosts.deckSheetEach",
  "materialCosts.iceWaterPerRoll", "materialCosts.dripEdgePerLength",
  "materialCosts.ridgeVentPerSection", "materialCosts.skylightKitEach",
]) {
  ok(`roofing_service.${path} exists, so the map is not pointing at nothing`,
    readField(roofBook, path) !== undefined, String(readField(roofBook, path)));
}
ok("chimneyFlashingEach is still null in the live book — the map says so and is right",
  roofBook.materialCosts.chimneyFlashingEach === null);
ok("roofing has no tipping fee anywhere — the gap the map records",
  !JSON.stringify(roofBook).toLowerCase().includes("tipping") &&
  !JSON.stringify(roofBook).toLowerCase().includes("dumpfee"));
ok("...and the coverage map records exactly that gap",
  /dump fee/i.test(SYSTEMS_COVERAGE.roofing_service.gaps.tippingFee.what));

console.log("\nsiding: covered, with its own gap recorded");
const sidingBook = TRADE_PRICE_BOOKS.siding;
ok("siding has a labour rate", Number.isFinite(sidingBook.labourHoursPerSqft));
ok("siding has material costs", Object.keys(sidingBook.materialCosts).length > 3);
ok("...and no equipment or disposal cost, which is the recorded gap",
  !("equipment" in sidingBook) && !JSON.stringify(sidingBook).includes("disposal"));
ok("...recorded", /lift/i.test(SYSTEMS_COVERAGE.siding.gaps.liftAndDisposal.what));

console.log("\nNothing already covered was duplicated into this file");
for (const key of ["roofing_service", "siding"]) {
  ok(`${key} gets no second price book`, !SYSTEMS_PRICE_BOOKS[key]);
  ok(`${key} gets no second cost recipe`, !SYSTEMS_RECIPES[key]);
  ok(`${key} gets no second line-item list`, !SYSTEMS_LINE_ITEMS[key]);
  ok(`${key} is recorded as covered instead`, SYSTEMS_COVERAGE[key].verdict === "covered");
}
// The boom lift appears in two recipes and MUST carry the same figure — it is
// the same machine from the same yard, and two numbers for one thing is how
// they start to disagree.
ok("the boom lift day rate agrees across the recipes that hire one",
  SYSTEMS_RECIPES.solar_pv_install.equipment.boom_lift_day.cost.usd ===
    SYSTEMS_RECIPES.gutter_services.equipment.boom_lift_day.cost.usd &&
  SYSTEMS_RECIPES.solar_pv_install.equipment.boom_lift_day.cost.cad ===
    SYSTEMS_RECIPES.gutter_services.equipment.boom_lift_day.cost.cad);
ok("...and so does the refrigerant cylinder across install and service",
  SYSTEMS_RECIPES.hvac_install.materials.refrigerant_r410a.cost.usd ===
    SYSTEMS_RECIPES.hvac_repair.materials.r410a_topup.cost.usd);

console.log("\nEvery merge this file needs is written down");
for (const note of MERGE_NOTES) {
  ok(`merge note for ${note.target} says what breaks if it is skipped`,
    typeof note.ifSkipped === "string" && note.ifSkipped.length > 30);
}
ok("the catalogue merge is named first — nothing else works without it",
  MERGE_NOTES[0].target === "lib/trades/catalog.js");

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fails.length ? 1 : 0);
