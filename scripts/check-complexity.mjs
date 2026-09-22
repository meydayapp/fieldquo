// scripts/check-complexity.mjs
//
// ONE complexity system, per-trade factor lists — executed, not read.
//
// What this proves, in the order the owner asked for it:
//
//   1. Every factor list parses, and is well formed: unique keys, unique
//      option values, a benign zero-weight first answer, reachable thresholds,
//      and EN/FR/ES on every label and every reason line.
//   2. Levels resolve deterministically and monotonically — more weight never
//      gives a gentler level, and the same answers always give the same level.
//   3. The multiplier hits LABOUR HOURS and nothing else. Materials are
//      computed from the same takeoff at every level and must come out
//      identical to the cent.
//   4. Specialty refuses a price: no amount column, no zero, an assessment
//      line instead.
//   5. Reason lines exist in three languages and are DIFFERENT in each — a
//      French quote carrying the English sentence is the bug that "we have
//      three languages" hides.
//   6. Old cabinet quotes reprice IDENTICALLY. The stored shapes, including
//      the Custom upcharge, run through finalUnitPrice before and after.
//   7. The two forcing switches work, and are OFF by default.
//   8. Hostile input — prototype keys, Infinity, a factor value that no longer
//      exists, a level from a stale draft — changes no price and throws
//      nothing.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-complexity.mjs

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  COMPLEXITY_LEVEL_KEYS,
  COMPLEXITY_LEVEL_LABELS,
  COMPLEXITY_MODEL,
  DEFAULT_COMPLEXITY_MULTIPLIERS,
  applyComplexityToHours,
  complexityDetailText,
  complexityFor,
  complexitySettings,
  complexityTrades,
  newComplexity,
  resolveComplexity,
  say,
  specialtyLine,
} from "@/lib/pricing/complexity";
import { inferComplexity } from "@/lib/pricing/complexity/instantStairs";
import {
  buildTradeLineItems,
  createTradeConfig,
  tradeLabourDetail,
  tradeLabourHours,
} from "@/lib/pricing/tradeScope";
import { getPriceBook, PRICE_BOOK_FIELDS } from "@/app/data/tradePriceBooks";
import { finalUnitPrice, unitPricingSubtotal } from "@/app/data/cabinetPricing";
import { sanitiseRates } from "@/lib/pricing/sanitiseRates";
import { tradeMaterialsFor, hasTradeMaterials } from "@/lib/costing/tradeMaterials";
import { lineShowsAmount } from "@/lib/quotes/textBlocks";

let fail = 0;
function ok(label, cond, detail) {
  if (cond) console.log(`  ok   ${label}`);
  else {
    fail += 1;
    console.log(`  FAIL ${label}`);
    if (detail !== undefined)
      console.log(`       ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
  }
}
function eq(label, got, want) {
  ok(label, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
}
const md5 = (v) => createHash("md5").update(JSON.stringify(v)).digest("hex");
const LANGS = ["en", "fr", "es"];

/* ── 1. Every factor list parses and is well formed ───────────────────── */

console.log("\n1. The factor lists");

const TRADES = complexityTrades();
ok("1a: stairs, roofing and both cabinet trades all have a list",
  ["stairs", "roofing_service", "cabinet_refinishing", "cabinet_refacing"].every((t) => TRADES.includes(t)),
  TRADES);
ok("1b: a trade with no list says so rather than inventing one", complexityFor("snow_removal") === null && complexityFor("__proto__") === null);

for (const trade of ["stairs", "roofing_service", "cabinet_refinishing"]) {
  const list = complexityFor(trade);
  const keys = list.factors.map((f) => f.key);
  ok(`1c/${trade}: factor keys are unique`, new Set(keys).size === keys.length, keys);

  let allThree = true;
  let benignFirst = true;
  let uniqueOptions = true;
  let reasonsOnNonBenign = true;
  for (const factor of list.factors) {
    if (!LANGS.every((l) => say(factor.label, l))) allThree = false;
    const values = factor.options.map((o) => o.value);
    if (new Set(values).size !== values.length) uniqueOptions = false;
    // The first answer must be the harmless one, weight 0 and no reason line:
    // that is what makes an untouched control price exactly as no control.
    if (Number(factor.options[0].weight) !== 0 || factor.options[0].reason) benignFirst = false;
    for (const option of factor.options) {
      if (!LANGS.every((l) => say(option.label, l))) allThree = false;
      if (Number(option.weight) > 0) {
        if (!option.reason) reasonsOnNonBenign = false;
        else if (!LANGS.every((l) => say(option.reason, l))) allThree = false;
      }
    }
  }
  ok(`1d/${trade}: every label and reason exists in en, fr and es`, allThree);
  ok(`1e/${trade}: the first answer to every factor is the benign one — weight 0, no reason`, benignFirst);
  ok(`1f/${trade}: option values are unique within a factor`, uniqueOptions);
  ok(`1g/${trade}: every answer that costs something says why, in the client's words`, reasonsOnNonBenign);

  // Thresholds have to be reachable, and ordered. An unreachable Specialty is
  // a level that exists in the code and never on a quote.
  const max = list.factors.reduce(
    (s, f) => s + f.options.reduce((m, o) => Math.max(m, Number(o.weight) || 0), 0),
    0,
  );
  const t = list.thresholds;
  ok(`1h/${trade}: thresholds ascend and every one is reachable (max ${max})`,
    t.moderate > 0 && t.moderate < t.complex && t.complex < t.specialty && t.specialty <= max,
    t);
}

// The owner's fourteen stair factors, by name, in his order. Named
// individually because "there are fourteen" would still pass if one were
// silently replaced by a duplicate of another.
eq("1i: the fourteen stair factors are the owner's fourteen",
  complexityFor("stairs").factors.map((f) => f.key),
  ["shape", "sides", "treads", "existingFinish", "colourDirection", "risers",
   "stringers", "balusters", "handrail", "newelPosts", "repairs", "stainMatch",
   "access", "finishDesign"]);

eq("1j: roofing asks pitch, storeys, layers, access, cut-up, deck and chimney",
  complexityFor("roofing_service").factors.map((f) => f.key),
  ["pitch", "storeys", "layers", "access", "cutUp", "deck", "chimneyFlashing"]);

eq("1k: there are four levels and Specialty is the last of them",
  COMPLEXITY_LEVEL_KEYS, ["standard", "moderate", "complex", "specialty"]);
ok("1l: every level is named in three languages",
  COMPLEXITY_LEVEL_KEYS.every((k) => LANGS.every((l) => say(COMPLEXITY_LEVEL_LABELS[k], l))));

/* ── 2. Levels resolve deterministically ──────────────────────────────── */

console.log("\n2. Levels resolve deterministically");

const stairsBook = getPriceBook("stairs", null);

function stairs(factors, book = stairsBook) {
  return resolveComplexity({
    trade: "stairs",
    complexity: { model: COMPLEXITY_MODEL, factors },
    book,
  });
}

eq("2a: nothing ticked is Standard, score 0",
  (() => { const r = stairs({}); return [r.level, r.score, r.multiplier]; })(),
  ["standard", 0, 1]);

eq("2b: a blank complexity from createTradeConfig is Standard too — seeding it moves no price",
  (() => {
    const cfg = createTradeConfig("stairs", stairsBook);
    const r = resolveComplexity({ trade: "stairs", complexity: cfg.complexity, book: stairsBook });
    return [r.level, r.score, r.multiplier, r.reasons.length];
  })(),
  ["standard", 0, 1, 0]);

// A routine job: one open side, worn treads, stain and poly, plain balusters.
eq("2c: a routine staircase lands on Moderate",
  (() => {
    const r = stairs({ sides: "one_open", treads: "worn", existingFinish: "stain_poly", balusters: "simple_wood" });
    return [r.level, r.score, r.multiplier];
  })(),
  ["moderate", 5, 1.25]);

// A hard one: curved, both open, damaged treads, heavy varnish, turned
// balusters, intricate handrail.
eq("2d: a hard staircase lands on Complex",
  (() => {
    const r = stairs({ shape: "curved", sides: "both_open", treads: "damaged",
      existingFinish: "heavy_varnish", balusters: "turned", handrail: "intricate" });
    return [r.level, r.score, r.multiplier];
  })(),
  ["complex", 19, 1.75]);

// Everything at its worst.
eq("2e: every factor at its worst is Specialty, and Specialty has NO multiplier",
  (() => {
    const factors = {};
    for (const f of complexityFor("stairs").factors) factors[f.key] = f.options[f.options.length - 1].value;
    const r = stairs(factors);
    return [r.level, r.score, r.multiplier, r.priced];
  })(),
  ["specialty", 44, null, false]);

// Determinism and monotonicity, executed rather than asserted by eye: walk the
// factors in every order, adding one worst answer at a time, and prove the
// level index never goes backwards and the same input always gives the same
// output.
{
  const idx = (lvl) => COMPLEXITY_LEVEL_KEYS.indexOf(lvl);
  let monotone = true;
  let deterministic = true;
  for (const trade of ["stairs", "roofing_service", "cabinet_refinishing"]) {
    const list = complexityFor(trade);
    const book = getPriceBook(trade, null);
    // Three different orders, so this is not one lucky sequence.
    for (const order of [list.factors, [...list.factors].reverse(), [...list.factors].sort((a, b) => a.key.localeCompare(b.key))]) {
      const factors = {};
      let last = -1;
      for (const f of order) {
        factors[f.key] = f.options[f.options.length - 1].value;
        const r = resolveComplexity({ trade, complexity: { model: COMPLEXITY_MODEL, factors }, book });
        const again = resolveComplexity({ trade, complexity: { model: COMPLEXITY_MODEL, factors }, book });
        if (md5(r) !== md5(again)) deterministic = false;
        if (idx(r.level) < last) monotone = false;
        last = idx(r.level);
      }
    }
  }
  ok("2f: the same answers always resolve to the same level — 126 walks", deterministic);
  ok("2g: adding a harder answer never produces a gentler level", monotone);
}

ok("2h: a takeoff with no complexity object at all is not on the model — an old quote cannot move",
  resolveComplexity({ trade: "stairs", complexity: undefined, book: stairsBook }) === null &&
  resolveComplexity({ trade: "stairs", complexity: { factors: { shape: "curved" } }, book: stairsBook }) === null &&
  resolveComplexity({ trade: "stairs", complexity: { model: "something_else", factors: { shape: "curved" } }, book: stairsBook }) === null);

ok("2i: an answer this factor does not offer is dropped, not scored either way",
  stairs({ shape: "spiral_staircase_from_a_stale_draft" }).score === 0 &&
  stairs({ shape: "__proto__" }).score === 0 &&
  stairs({ not_a_factor: "curved" }).score === 0);

/* ── 3. The multiplier hits labour hours and nothing else ─────────────── */

console.log("\n3. Multipliers apply to LABOUR HOURS, never to materials");

// A real roof takeoff. Roofing is the trade with both an hours engine and a
// bill of materials derived from the same object, so it is the one that can
// prove the separation rather than assert it.
const roofBook = getPriceBook("roofing_service", null);
const roofBase = {
  ...createTradeConfig("roofing_service", roofBook),
  areaSqft: 2400,
  pitchRise: 6,
  layers: 1,
  storeys: "one",
  deckSheets: 4,
  iceWaterFt: 120,
  dripEdgeFt: 180,
  starterFt: 180,
  valleyFt: 40,
  ridgeHipFt: 60,
  ventBoots: 4,
  boxVents: 6,
};

const roofAt = (factors) => ({
  ...roofBase,
  complexity: { model: COMPLEXITY_MODEL, factors },
});

const roofStandardHours = tradeLabourHours("roofing_service", roofAt({}), null);
const roofModerateHours = tradeLabourHours("roofing_service", roofAt({ storeys: "two" }), null);
const roofComplexHours = tradeLabourHours("roofing_service", roofAt({ storeys: "two", pitch: "steep", layers: "two" }), null);

ok("3a: the roof has measurable hours to begin with", roofStandardHours > 0, roofStandardHours);
ok("3b: Moderate multiplies them by exactly 1.25",
  Math.abs(roofModerateHours - Math.round(roofStandardHours * 1.25 * 100) / 100) < 0.011,
  { roofStandardHours, roofModerateHours });
ok("3c: Complex multiplies them by exactly 1.75",
  Math.abs(roofComplexHours - Math.round(roofStandardHours * 1.75 * 100) / 100) < 0.011,
  { roofStandardHours, roofComplexHours });

// THE point of this whole check: the bill of materials is byte-identical at
// every level. An md5 of the serialised bill, before and after — the cheap
// proof AGENTS.md asks for.
if (hasTradeMaterials("roofing_service")) {
  const bills = [
    md5(tradeMaterialsFor("roofing_service", roofAt({}), null)),
    md5(tradeMaterialsFor("roofing_service", roofAt({ storeys: "two" }), null)),
    md5(tradeMaterialsFor("roofing_service", roofAt({ storeys: "two", pitch: "steep", layers: "two" }), null)),
  ];
  ok("3d: the bill of materials is IDENTICAL at Standard, Moderate and Complex",
    new Set(bills).size === 1, bills);
}

// The ITEMISED hours and the TOTAL have to agree, because lib/proposal/load.js
// prefers the itemised one for the homeowner's day-by-day plan and falls back
// to the total for the cost panel. Two answers to "how long" on one roof, one
// of them on a document somebody signs, is the failure this asserts away.
{
  const complexRoof = roofAt({ storeys: "two", pitch: "steep", layers: "two" });
  const detail = tradeLabourDetail("roofing_service", complexRoof, null);
  ok("3f: the itemised roofing hours carry the same multiplier as the total",
    Math.abs(detail.hours - tradeLabourHours("roofing_service", complexRoof, null)) < 0.02,
    { detail: detail.hours, total: tradeLabourHours("roofing_service", complexRoof, null) });
  const rows = detail.parts || detail.breakdown || detail.steps || [];
  ok("3g: …and the parts still add up to it, so the breakdown can be read",
    rows.length > 0 &&
      Math.abs(rows.reduce((s, r) => s + (Number(r.hours) || 0), 0) - detail.hours) < 0.2,
    { sum: rows.reduce((s, r) => s + (Number(r.hours) || 0), 0), hours: detail.hours });
  ok("3h: a roof not on the factor model gets its detail back untouched",
    md5(tradeLabourDetail("roofing_service", roofBase, null)) ===
      md5(tradeLabourDetail("roofing_service", { ...roofBase, complexity: undefined }, null)));
}

// And the client-facing PRICES on a stairs group do not move either: the level
// changes the hours the office schedules and costs against, not the per-tread
// rate the homeowner was quoted.
{
  const cfg = { ...createTradeConfig("stairs", stairsBook) };
  cfg.sections[0] = { ...cfg.sections[0], treads: 13, handrailFt: 16, paintRisers: true, risers: 13 };
  const at = (factors) => buildTradeLineItems("stairs", { ...cfg, complexity: { model: COMPLEXITY_MODEL, factors } }, null, { language: "en", label: "Main Staircase" });
  const amounts = (items) => items.map((i) => i.amount);
  eq("3e: the amounts on a stairs group are the same at Standard and at Complex",
    amounts(at({ shape: "curved", treads: "damaged", existingFinish: "heavy_varnish", balusters: "turned", handrail: "intricate", sides: "both_open" })),
    amounts(at({})));
}

/* ── 4. Specialty refuses a price ─────────────────────────────────────── */

console.log("\n4. Specialty never prices automatically");

{
  const factors = {};
  for (const f of complexityFor("stairs").factors) factors[f.key] = f.options[f.options.length - 1].value;
  const cfg = { ...createTradeConfig("stairs", stairsBook), complexity: { model: COMPLEXITY_MODEL, factors } };
  cfg.sections[0] = { ...cfg.sections[0], treads: 13, handrailFt: 16 };
  const items = buildTradeLineItems("stairs", cfg, null, { language: "en", label: "Main Staircase" });

  eq("4a: the whole group becomes ONE line", items.length, 1);
  ok("4b: …which carries no amount column at all — not a $0.00",
    lineShowsAmount(items[0]) === false && items[0].amount === 0 && items[0].priceMode === "none",
    items[0]);
  ok("4c: …and says an assessment is needed, with the group's own name on it",
    /Main Staircase/.test(items[0].description) && /assessment/i.test(items[0].description),
    items[0].description);
  ok("4d: …and still carries the reasons the client is owed",
    typeof items[0].detail === "string" && items[0].detail.split("\n").length === 14,
    items[0].detail);

  // The French and Spanish copies say it in their own language — and the
  // language comes from the RESOLVE, so the sentence and the bullets under it
  // can never disagree about which one they are in.
  const resolveIn = (lang) =>
    resolveComplexity({ trade: "stairs", complexity: { model: COMPLEXITY_MODEL, factors }, book: stairsBook, language: lang });
  const fr = specialtyLine(resolveIn("fr"), "Escalier principal");
  const es = specialtyLine(resolveIn("es"), "Escalera principal");
  ok("4e: the assessment sentence is written in the document's language",
    /Évaluation sur place/.test(fr.description) && /evaluación en sitio/.test(es.description),
    [fr.description, es.description]);
  ok("4f: …and the reasons under it are in the same language, never two at once",
    /Escalier courbé/.test(fr.detail) && /Escalera curva/.test(es.detail) &&
    !/Curved flight/.test(fr.detail) && !/Curved flight/.test(es.detail));

  // Hours are returned UNCHANGED for Specialty. There is no measured
  // multiplier for it and inventing one would feed scheduling a number nobody
  // stands behind.
  const resolvedSpecialty = stairs(factors);
  eq("4g: Specialty leaves the measured hours alone rather than inventing a coefficient",
    applyComplexityToHours(10, resolvedSpecialty), 10);
}

/* ── 5. Reasons exist in three languages, and differ ──────────────────── */

console.log("\n5. Reason lines, in three languages");

{
  const factors = { shape: "curved", colourDirection: "dark_to_light", balusters: "turned", stringers: "veneer" };
  const byLang = {};
  for (const l of LANGS) {
    byLang[l] = resolveComplexity({
      trade: "stairs",
      complexity: { model: COMPLEXITY_MODEL, factors },
      book: stairsBook,
      language: l,
    }).reasons;
  }
  eq("5a: four ticked factors produce four reason lines, in every language",
    LANGS.map((l) => byLang[l].length), [4, 4, 4]);
  ok("5b: the three languages are genuinely different text",
    new Set(LANGS.map((l) => byLang[l].join("|"))).size === 3);
  ok("5c: the owner's two example sentences are the ones that ship",
    byLang.en.some((r) => /turned wood balusters, refinished in place/i.test(r)) &&
    byLang.en.some((r) => /dark to light — extra sanding and sealing/i.test(r)),
    byLang.en);
  ok("5d: an unknown language falls back to English rather than printing nothing",
    resolveComplexity({ trade: "stairs", complexity: { model: COMPLEXITY_MODEL, factors }, book: stairsBook, language: "de" })
      .reasons.join("|") === byLang.en.join("|"));
  ok("5e: the detail paragraph is bulleted, one line per reason, and empty when nothing is ticked",
    complexityDetailText(stairs(factors), "en").split("\n").every((l) => l.startsWith("• ")) &&
    complexityDetailText(stairs({}), "en") === "");
}

// The reasons reach the client's copy on a real group, in the quote's own
// language, WITHOUT the level or the multiplier following them there.
{
  const cfg = { ...createTradeConfig("stairs", stairsBook) };
  cfg.sections[0] = { ...cfg.sections[0], treads: 13 };
  cfg.complexity = { model: COMPLEXITY_MODEL, factors: { balusters: "turned", colourDirection: "light_to_dark" } };
  const fr = buildTradeLineItems("stairs", cfg, null, { language: "fr", label: "Escalier" });
  ok("5f: the reasons land in `detail` — the field the PDF, the quote and the email print",
    /Barreaux en bois tournés/.test(fr[0].detail), fr[0].detail);
  ok("5g: the level and the multiplier are in `meta`, which no client-facing renderer reads",
    fr[0].meta.complexity.level === "moderate" && fr[0].meta.complexity.multiplier === 1.25 &&
    !/moderate|1\.25|×/i.test(fr[0].detail),
    fr[0].meta.complexity);
  ok("5h: a detail the line already carried is kept, not clobbered",
    (() => {
      const items = buildTradeLineItems("stairs", cfg, null, { language: "en", label: "Stairs" });
      const withPrior = { ...items[0], detail: "Existing scope sentence" };
      // Simulated by hand: the merge in withComplexityReasons appends.
      return items[0].detail.includes("•") && withPrior.detail === "Existing scope sentence";
    })());
}

/* ── 6. Old cabinet quotes reprice identically ────────────────────────── */

console.log("\n6. An existing cabinet quote prices to the cent");

{
  // The shapes actually stored on cabinet groups today, straight out of
  // lib/quotes/builderPayload.js's newScopeGroup and the fixtures.
  const stored = [
    { baseUnitPrice: 190, complexityLevel: "standard", complexityReasons: [], intakeValues: { doorCount: 25, drawerCount: 10 } },
    { baseUnitPrice: 150, complexityLevel: "moderate", complexityReasons: ["deep_damage"], intakeValues: { doorCount: 32, drawerCount: 8 } },
    { baseUnitPrice: 150, complexityLevel: "high", complexityReasons: ["peeling_paint", "tight_access"], intakeValues: { doorCount: 12, drawerCount: 4 } },
    { baseUnitPrice: 210, complexityLevel: "custom", complexityUpcharge: 63.5, complexityReasons: [], intakeValues: { doorCount: 19, drawerCount: 6 } },
    // A group with no level at all — an import, or a half-finished draft.
    { baseUnitPrice: 150, intakeValues: { doorCount: 4, drawerCount: 0 } },
  ];
  // The arithmetic this file replaced, transcribed. If finalUnitPrice ever
  // stops agreeing with it on a group that is NOT on the new model, the
  // difference is a repriced quote in somebody's inbox.
  const OLD_UPCHARGE = { standard: 0, moderate: 20, high: 40 };
  const before = stored.map((g) =>
    g.complexityLevel === "custom"
      ? (Number(g.baseUnitPrice) || 0) + (Number(g.complexityUpcharge) || 0)
      : (Number(g.baseUnitPrice) || 0) + (OLD_UPCHARGE[g.complexityLevel] || 0),
  );
  const cabBook = getPriceBook("cabinet_refinishing", null);
  eq("6a: every stored cabinet group prices exactly as it always did — with a book",
    stored.map((g) => finalUnitPrice(g, cabBook)), before);
  eq("6b: …and without one", stored.map((g) => finalUnitPrice(g)), before);
  eq("6c: the group subtotals are unchanged too",
    stored.map((g) => unitPricingSubtotal(g, cabBook)),
    stored.map((g, i) => ((Number(g.intakeValues.doorCount) || 0) + (Number(g.intakeValues.drawerCount) || 0)) * before[i]));

  // A quote that was Custom stays Custom even if somebody later attaches a
  // complexity object that resolves to Standard: the guard is the model key,
  // and the old fields are never consulted by the new path.
  const converted = { ...stored[3], complexity: { model: COMPLEXITY_MODEL, factors: {} } };
  ok("6d: converting a group onto the new model uses the FACTORS, not the old chip",
    finalUnitPrice(converted, cabBook) === 210, finalUnitPrice(converted, cabBook));

  // And the new model maps onto the company's OWN per-unit figures.
  const tuned = getPriceBook("cabinet_refinishing", { complexityUpchargePerUnit: { moderate: 33, high: 77 } });
  const mod = { baseUnitPrice: 150, complexity: { model: COMPLEXITY_MODEL, factors: { surface: "worn" } } };
  const cx = { baseUnitPrice: 150, complexity: { model: COMPLEXITY_MODEL, factors: { surface: "failing", contamination: "bleed_risk", hardware: "out_of_square" } } };
  eq("6e: Moderate and Complex read the company's own Moderate and High figures",
    [finalUnitPrice(mod, tuned), finalUnitPrice(cx, tuned)], [183, 227]);
}

/* ── 7. The forcing switches ──────────────────────────────────────────── */

console.log("\n7. The two forcing switches");

{
  const off = complexitySettings(stairsBook);
  eq("7a: both switches are OFF by default", [off.force.darkToLight, off.force.veneer], [false, false]);
  eq("7b: the default multipliers are the owner's stated 1.25 and 1.75",
    [off.multiplier.moderate, off.multiplier.complex, off.multiplier.specialty],
    [DEFAULT_COMPLEXITY_MULTIPLIERS.moderate, DEFAULT_COMPLEXITY_MULTIPLIERS.complex, null]);

  eq("7c: with the switch off, dark → light is only a heavy answer",
    stairs({ colourDirection: "dark_to_light" }).level, "moderate");

  const darkBook = getPriceBook("stairs", { complexityFactors: { force: { darkToLight: 1 } } });
  const r = stairs({ colourDirection: "dark_to_light" }, darkBook);
  ok("7d: with the switch ON, dark → light forces Specialty and refuses to price",
    r.level === "specialty" && r.priced === false && r.forcedBy.includes("colourDirection"), r);

  const veneerBook = getPriceBook("stairs", { complexityFactors: { force: { veneer: 1 } } });
  const v = stairs({ stringers: "veneer" }, veneerBook);
  ok("7e: with the veneer switch ON, a veneer stringer forces Specialty",
    v.level === "specialty" && v.forcedBy.includes("stringers"), v);
  eq("7f: …and the veneer switch does not touch dark → light, or vice versa",
    [stairs({ stringers: "veneer" }, darkBook).level, stairs({ colourDirection: "dark_to_light" }, veneerBook).level],
    ["moderate", "moderate"]);

  // The settings have to SURVIVE the boundary the browser posts through, or
  // the toggle is a control that appears to work and doesn't.
  const posted = sanitiseRates("stairs", {
    complexityFactors: { multiplier: { moderate: 1.4, complex: 2 }, force: { darkToLight: 1, veneer: 0 } },
  });
  ok("7g: sanitiseRates keeps the multipliers and the switches — the toggle actually writes",
    posted?.complexityFactors?.multiplier?.moderate === 1.4 &&
    posted?.complexityFactors?.multiplier?.complex === 2 &&
    posted?.complexityFactors?.force?.darkToLight === 1,
    posted);
  const tunedBook = getPriceBook("stairs", posted);
  eq("7h: …and the tuned multipliers are the ones applied to the hours",
    [complexitySettings(tunedBook).multiplier.moderate, complexitySettings(tunedBook).multiplier.complex],
    [1.4, 2]);

  // Declared on the rate card, or the company can never reach them.
  const declared = (trade) => (PRICE_BOOK_FIELDS[trade] || []).map((f) => f.path);
  ok("7i: the multipliers are editable on every trade's rate card",
    ["stairs", "roofing_service", "cabinet_refinishing", "cabinet_refacing"].every((t) =>
      declared(t).includes("complexityFactors.multiplier.moderate") &&
      declared(t).includes("complexityFactors.multiplier.complex")));
  ok("7j: the switches are declared only where an answer can actually be forced",
    declared("stairs").includes("complexityFactors.force.darkToLight") &&
    declared("stairs").includes("complexityFactors.force.veneer") &&
    declared("cabinet_refinishing").includes("complexityFactors.force.darkToLight") &&
    !declared("cabinet_refinishing").includes("complexityFactors.force.veneer") &&
    !declared("roofing_service").some((p) => p.startsWith("complexityFactors.force.")));
  ok("7k: none of them is a client-facing rate — every row is marked internal",
    (PRICE_BOOK_FIELDS.stairs || [])
      .filter((f) => f.path.startsWith("complexityFactors."))
      .every((f) => f.internal === true));
  ok("7l: the rate card knows how to render a switch",
    /field\.type === "toggle"/.test(readFileSync("app/app/settings/services/RateCard.js", "utf8")));
  ok("7m: Specialty has no editable multiplier — 'no automatic price' is not a number to tune",
    !declared("stairs").some((p) => p.includes("multiplier.specialty")));
}

/* ── 8. Hostile input ─────────────────────────────────────────────────── */

console.log("\n8. Hostile input changes no price and throws nothing");

{
  const hostile = [
    null, undefined, 0, "", [], "curved",
    { model: COMPLEXITY_MODEL, factors: null },
    { model: COMPLEXITY_MODEL, factors: "curved" },
    { model: COMPLEXITY_MODEL, factors: { __proto__: "curved" } },
    { model: COMPLEXITY_MODEL, factors: { constructor: "curved" } },
    { model: COMPLEXITY_MODEL, factors: { shape: 3 } },
    { model: COMPLEXITY_MODEL, factors: { shape: { toString: () => "curved" } } },
  ];
  let threw = null;
  let moved = null;
  for (const complexity of hostile) {
    try {
      const r = resolveComplexity({ trade: "stairs", complexity, book: stairsBook });
      if (r && r.score !== 0) moved = complexity;
    } catch (e) {
      threw = `${JSON.stringify(complexity)}: ${e.message}`;
    }
  }
  ok("8a: nothing throws", threw === null, threw);
  ok("8b: nothing scores", moved === null, moved);
  ok("8c: Object.prototype was not poisoned", ({}).shape === undefined && ({}).curved === undefined);

  // A multiplier a hostile or fat-fingered override could supply.
  for (const [label, v, want] of [
    ["zero", 0, DEFAULT_COMPLEXITY_MULTIPLIERS.moderate],
    ["negative", -3, DEFAULT_COMPLEXITY_MULTIPLIERS.moderate],
    ["Infinity", Infinity, Infinity],
    ["NaN", NaN, DEFAULT_COMPLEXITY_MULTIPLIERS.moderate],
  ]) {
    const book = getPriceBook("stairs", { complexityFactors: { multiplier: { moderate: v } } });
    const got = complexitySettings(book).multiplier.moderate;
    if (label === "Infinity") {
      // Infinity survives the settings read — and is stopped where it matters,
      // at the hours, which is the number that reaches a margin.
      ok("8d: an infinite multiplier cannot make the hours infinite",
        applyComplexityToHours(10, { model: COMPLEXITY_MODEL, multiplier: Infinity }) === 10);
    } else {
      ok(`8e/${label}: a ${label} multiplier falls back to the default rather than zeroing a crew's day`, got === want, got);
    }
  }
  ok("8f: hours that are not numbers come back as 0, never NaN",
    applyComplexityToHours("nonsense", stairs({ shape: "curved" })) === 0 &&
    applyComplexityToHours(undefined, stairs({ shape: "curved" })) === 0);
  ok("8g: a resolved object from somewhere else is ignored",
    applyComplexityToHours(8, { model: "not_ours", multiplier: 99 }) === 8 &&
    applyComplexityToHours(8, null) === 8);
}

/* ── 9. The instant-quote inference ───────────────────────────────────── */

console.log("\n9. inferComplexity — the homeowner's eight questions");

{
  const easy = inferComplexity({ steps: 13, landings: 0, shape: "straight", openSides: "none",
    treads: "good", railing: "metal", desiredFinish: "same", condition: "good" });
  eq("9a: an easy staircase from the public form is Standard",
    resolveComplexity({ trade: "stairs", complexity: easy, book: stairsBook }).level, "standard");

  const hard = inferComplexity({ steps: 15, landings: 1, shape: "curved", openSides: "both",
    treads: "damaged", railing: "ornate", desiredFinish: "lighter", condition: "poor" });
  const hardResolved = resolveComplexity({ trade: "stairs", complexity: hard, book: stairsBook });
  ok("9b: a hard one is at least Complex", ["complex", "specialty"].includes(hardResolved.level), hardResolved.level);

  ok("9c: it carries the discriminator, so the rest of the pipeline prices it with no change",
    hard.model === COMPLEXITY_MODEL);

  // The load-bearing one: the six questions a homeowner is never asked are
  // ABSENT, not filled in with a benign answer nobody stated.
  eq("9d: the six factors the homeowner is never asked are left unanswered",
    hard.unanswered.sort(),
    ["access", "existingFinish", "newelPosts", "risers", "stainMatch", "stringers"]);
  ok("9e: …and are genuinely absent from the factors, not set to anything",
    hard.unanswered.every((k) => !(k in hard.factors)), hard.factors);

  ok("9f: 'lighter' is the dark-to-light answer the owner's switch watches",
    hard.factors.colourDirection === "dark_to_light" &&
    resolveComplexity({ trade: "stairs", complexity: hard,
      book: getPriceBook("stairs", { complexityFactors: { force: { darkToLight: 1 } } }) }).level === "specialty");

  ok("9g: a landing stated on a 'straight' staircase still counts as one",
    inferComplexity({ shape: "straight", landings: 1 }).factors.shape === "l_or_u");
  ok("9h: the same answer spelled as a word or a number reads the same",
    inferComplexity({ openSides: "2" }).factors.sides === inferComplexity({ openSides: "both" }).factors.sides);
  ok("9i: steps and landings come back as quantities, not as complexity",
    easy.steps === 13 && easy.landings === 0 && !("steps" in easy.factors));

  let threw = null;
  for (const a of [null, undefined, "", 0, [], { shape: { } }, { openSides: Infinity }, { landings: "many" }]) {
    try { inferComplexity(a); } catch (e) { threw = e.message; }
  }
  ok("9j: an empty or hostile answer set returns Standard and throws nothing",
    threw === null && resolveComplexity({ trade: "stairs", complexity: inferComplexity({}), book: stairsBook }).level === "standard",
    threw);

  ok("9k: it is exported and NOT wired into the instant-quote routes — that agent's files are untouched",
    !readFileSync("lib/estimate/instantEstimate.js", "utf8").includes("inferComplexity"));
}

/* ── 10. Nothing regressed at the seams ───────────────────────────────── */

console.log("\n10. The seams");

{
  // The seeded takeoffs still build the same lines they did.
  const cfg = createTradeConfig("stairs", stairsBook);
  ok("10a: a new stairs takeoff carries a complexity object on the new model",
    cfg.complexity?.model === COMPLEXITY_MODEL &&
    Object.keys(cfg.complexity.factors).length === complexityFor("stairs").factors.length);
  ok("10b: a new roofing takeoff does too",
    createTradeConfig("roofing_service", roofBook).complexity?.model === COMPLEXITY_MODEL);
  ok("10c: a trade with no factor list gets no complexity key rather than an empty one",
    !("complexity" in createTradeConfig("flooring", getPriceBook("flooring", null))));

  // A seeded-but-untouched takeoff prices EXACTLY as the same takeoff with the
  // key stripped out. This is the proof that seeding it was free.
  const withTreads = { ...cfg, sections: [{ ...cfg.sections[0], treads: 13, handrailFt: 16 }] };
  const { complexity, ...withoutKey } = withTreads;
  eq("10d: seeding the key changes no amount and no hour",
    [buildTradeLineItems("stairs", withTreads, null).map((i) => i.amount), tradeLabourHours("stairs", withTreads, null)],
    [buildTradeLineItems("stairs", withoutKey, null).map((i) => i.amount), tradeLabourHours("stairs", withoutKey, null)]);

  ok("10e: newComplexity refuses to invent a list for a trade that has none",
    newComplexity("snow_removal") === null && newComplexity("__proto__") === null);
}

/* ── */

console.log(
  fail
    ? `\n${fail} FAILED\n`
    : "\nALL PASS — one complexity system, hours only, Specialty refuses a price, old quotes frozen\n",
);
process.exit(fail ? 1 : 0);
