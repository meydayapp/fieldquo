// scripts/check-cabinet-switch.mjs
//
// Refinish | Reface inside one cabinet group (lib/quotes/cabinetServiceSwitch
// .js), executed rather than read.
//
//   npm run check:cabinet-switch
//
// The owner's rule after the complexity rework broke stairs pricing: never
// replace a working control, and prove prices unchanged. So the first half of
// this file is about the groups nobody switches:
//
//   1. UNTOUCHED. The saved payload of a refinishing group and a refacing
//      group, built the way the builder builds them, hashes to the md5 pinned
//      below. The pins were taken from origin/main before the switch existed
//      (lib/quotes/builderPayload.js is not touched by it), so a future change
//      that moves a cabinet payload fails here and has to say why.
//   2. OFFERED ONLY WHERE IT CAN WORK. Both trades sold → two options; one →
//      nothing; a saved or imported group → nothing.
//   3. WHAT CARRIES. Every count and answer survives the move by value; only
//      the service and its base price change; the money attached to the
//      carried answers is re-read from the target trade's book.
//   4. ROUND TRIP. refinish → reface → refinish saves byte-for-byte what the
//      untouched group saved, including a base price typed by hand; and a
//      price typed on the other side is still there on the next visit.
//   5. THE DOCUMENT. The switched payload names the chosen service only — no
//      trace of the other, no new field on the wire.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-cabinet-switch.mjs

import { createHash } from "node:crypto";
import { newScopeGroup, scopeGroupPayload, groupSubtotal } from "@/lib/quotes/builderPayload";
import { cabinetServiceOptions, switchCabinetService } from "@/lib/quotes/cabinetServiceSwitch";
import { COMPLEXITY_MODEL } from "@/lib/pricing/complexity";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) => {
  if (cond) pass += 1;
  else fails.push(`${label}${detail !== undefined ? ` — ${detail}` : ""}`);
};
const md5 = (o) => createHash("md5").update(JSON.stringify(o)).digest("hex");
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const REFIN = { id: "cat_rf", key: "cabinet_refinishing", label: "Cabinet Refinishing", enabled: true };
const REFACE = { id: "cat_rc", key: "cabinet_refacing", label: "Cabinet Refacing", enabled: true };
const STAIRS = { id: "cat_st", key: "stairs", label: "Stairs", enabled: true };
const BOTH = [REFIN, REFACE, STAIRS];

// A company that has tuned the refacing book: its own per-door, a dearer
// hinge, a dearer Moderate. Refinishing left on the defaults.
const OVERRIDES = {
  cat_rf: null,
  cat_rc: { perDoor: 500, addOns: { softCloseHingesPerDoor: 40 }, complexityUpchargePerUnit: { moderate: 30, high: 55 } },
};
const overridesFor = (cat) => OVERRIDES[cat.id] ?? null;
const catOf = (g) => BOTH.find((c) => c.id === g.categoryId) || null;
const payloadOf = (g) => scopeGroupPayload(g, overridesFor(catOf(g)), "en");
// What QuoteBuilder's switchCabinetGroupService does, with this file's
// category list standing in for the company's.
const flip = (g, target) =>
  switchCabinetService(g, target, { currentCategory: catOf(g), rateOverrides: overridesFor(target) });

// ── Fixtures: groups as the builder holds them after an estimator's edits ──
// Built with newScopeGroup and then the same spreads updateIntakeValue /
// updatePricing apply. Counts arrive as strings, as a number input sends them.
function kitchenRefinishing() {
  const g = newScopeGroup(REFIN, REFIN.label, null, { tempId: "t-kitchen" });
  return {
    ...g,
    intakeValues: { ...g.intakeValues, doorCount: "25", drawerCount: "10", woodSpecies: "oak", boxLinearFt: "22" },
    complexityLevel: "moderate",
    complexityReasons: ["deep_damage", "tight_access"],
    softCloseHinges: true,
    twoTone: true,
    addOnUnits: { tone: 8 },
    color: "BM Chantilly Lace",
    sheen: "satin",
    doorStyle: "Shaker",
    lineItems: [{ description: "Crown moulding touch-up", quantity: 1, unit: "flat", rate: 180, amount: 180 }],
    customFactors: [{ id: "cf1", label: "Third-floor walk-up", mode: "percent", value: 10 }],
  };
}
function vanityRefacingRenamed() {
  const g = newScopeGroup(REFACE, REFACE.label, OVERRIDES.cat_rc, { tempId: "t-vanity" });
  return {
    ...g,
    label: "Primary bath vanity",
    baseUnitPrice: 620, // typed over the book's figure
    intakeValues: { ...g.intakeValues, doorCount: "6", drawerCount: "3" },
    complexity: { model: COMPLEXITY_MODEL, factors: { surface: "worn", hardware: "seized_hinges" } },
    complexityLevel: "moderate",
    handleHoles: true,
    drawerSlides: true,
    softCloseHinges: true,
  };
}
function customUpchargeRefinishing() {
  const g = newScopeGroup(REFIN, REFIN.label, null, { tempId: "t-custom" });
  return {
    ...g,
    intakeValues: { ...g.intakeValues, doorCount: 19, drawerCount: 6 },
    complexityLevel: "custom",
    complexityUpcharge: 63.5,
    threeTone: true,
  };
}
function blankRefacing() {
  return newScopeGroup(REFACE, REFACE.label, OVERRIDES.cat_rc, { tempId: "t-blank" });
}
const FIXTURES = [
  ["kitchen refinishing (chips, add-ons, extra line, custom factor)", kitchenRefinishing],
  ["renamed vanity refacing (factor answers, typed base price)", vanityRefacingRenamed],
  ["refinishing on a custom upcharge", customUpchargeRefinishing],
  ["blank refacing group", blankRefacing],
];

// ───────────────────────────────────────────────────────────────────────────
console.log("1. untouched groups save exactly what they saved before the switch existed");
// ───────────────────────────────────────────────────────────────────────────
// Pinned from origin/main (ef759bb1) with this file's fixtures. A move here
// is a cabinet price moving — say why in the commit, then re-pin.
const PINNED = {
  "kitchen refinishing (chips, add-ons, extra line, custom factor)": "38d6697aceea669e2f4a92a213f7bef6",
  "renamed vanity refacing (factor answers, typed base price)": "5f29000ae1cb705a59b0dd93f4b56b11",
  "refinishing on a custom upcharge": "236c9663d37d0e5e95d4374b9a3c0268",
  "blank refacing group": "29470ee9ad8ade286d0043526ae13c1e",
};
const printPins = process.argv.includes("--print-pins");
for (const [name, make] of FIXTURES) {
  const h = md5(payloadOf(make()));
  if (printPins) console.log(`  ${JSON.stringify(name)}: ${JSON.stringify(h)},`);
  ok(`untouched payload md5 unchanged: ${name}`, h === PINNED[name], h);
  const g = make();
  ok(`pressing the service it is already on is a no-op: ${name}`, flip(g, catOf(g)) === g);
}

// ───────────────────────────────────────────────────────────────────────────
console.log("2. offered only where it can work");
// ───────────────────────────────────────────────────────────────────────────
{
  const g = kitchenRefinishing();
  const both = cabinetServiceOptions(g, BOTH);
  ok("both sold → two options, refinishing first", both?.length === 2 && both[0].key === "cabinet_refinishing" && both[1].key === "cabinet_refacing", JSON.stringify(both?.map((c) => c.key)));
  ok("only refinishing sold → no switch", cabinetServiceOptions(g, [REFIN, STAIRS]) === null);
  ok("only refacing sold → no switch", cabinetServiceOptions(vanityRefacingRenamed(), [REFACE]) === null);
  ok("no categories loaded yet → no switch", cabinetServiceOptions(g, undefined) === null);
  ok("a saved group → no switch (its price is frozen)", cabinetServiceOptions({ ...g, persisted: true }, BOTH) === null);
  ok("an imported group → no switch", cabinetServiceOptions({ ...g, imported: true }, BOTH) === null);
  const stairs = newScopeGroup(STAIRS, "Stairs", null, { tempId: "s" });
  ok("a non-cabinet group → no switch", cabinetServiceOptions(stairs, BOTH) === null);
  ok("switch refuses a saved group even if called", flip({ ...g, persisted: true }, REFACE).categoryKey === "cabinet_refinishing");
  ok("switch refuses a non-cabinet target", flip(g, STAIRS) === g);
}

// ───────────────────────────────────────────────────────────────────────────
console.log("3. what carries, and what the money is read from");
// ───────────────────────────────────────────────────────────────────────────
{
  const before = kitchenRefinishing();
  const after = flip(before, REFACE);
  ok("the service moved", after.categoryId === "cat_rc" && after.categoryKey === "cabinet_refacing");
  ok("the input group was not mutated", before.categoryKey === "cabinet_refinishing" && before.serviceFigures === undefined);
  const CARRIED = [
    "tempId", "intakeValues", "complexityLevel", "complexityUpcharge", "complexityReasons", "complexity",
    "handleHoles", "softCloseHinges", "drawerSlides", "twoTone", "threeTone", "addOnUnits",
    "color", "sheen", "doorStyle", "lineItems", "customFactors", "persisted", "id", "isTiered",
  ];
  for (const k of CARRIED) ok(`carries ${k}`, same(after[k], before[k]), `${JSON.stringify(before[k])} → ${JSON.stringify(after[k])}`);
  ok("the default name follows the service", after.label === "Cabinet Refacing", after.label);
  ok("the base price opens at the target book's per-door (company override)", after.baseUnitPrice === 500, after.baseUnitPrice);

  const p = payloadOf(after);
  const base = p.lineItems[0];
  // Moderate on the chips: the fixed +$20 the chips always used — the chip
  // path never read the book, on either trade, and a switch must not start.
  ok("base line = 35 units × (500 + chip Moderate 20)", base.quantity === 35 && base.rate === 520 && base.amount === 18200, JSON.stringify(base));
  const hinge = p.lineItems.find((l) => /hinge/i.test(l.description));
  ok("soft-close hinges re-priced off the REFACING book ($40, the override)", hinge?.rate === 40 && hinge?.quantity === 25, JSON.stringify(hinge));
  const tone = p.lineItems.find((l) => /two-tone/i.test(l.description));
  ok("two-tone keeps its stated 8-piece count", tone?.amount === 600 + 15 * 8, JSON.stringify(tone));
  ok("the typed extra line rides along", p.lineItems.some((l) => l.description === "Crown moulding touch-up" && l.amount === 180));
  ok("the custom factor is priced on the new base", p.lineItems.some((l) => l.meta?.customFactor?.id === "cf1"));
  ok("wood species and box linear ft are still in the intake", p.intakeValues.woodSpecies === "oak" && p.intakeValues.boxLinearFt === "22");

  // Factor answers: the same seven questions on both trades, the level mapped
  // onto the TARGET book's per-unit grid.
  const vanity = vanityRefacingRenamed();
  const toRefin = flip(vanity, REFIN);
  ok("a renamed group keeps its name", toRefin.label === "Primary bath vanity");
  ok("factor answers carry", same(toRefin.complexity, vanity.complexity));
  ok("first visit to refinishing opens at its book's $150", toRefin.baseUnitPrice === 150, toRefin.baseUnitPrice);
  const vp = payloadOf(toRefin);
  ok("factor Moderate on refinishing reads refinishing's +$20", vp.lineItems[0].rate === 170, vp.lineItems[0].rate);
  const vpBack = payloadOf(vanity);
  ok("…and on refacing, refacing's own +$30", vpBack.lineItems[0].rate === 650, vpBack.lineItems[0].rate);
  ok("the reasons the client reads are the same answers either side", vp.lineItems[0].detail === vpBack.lineItems[0].detail && Boolean(vp.lineItems[0].detail));
}

// ───────────────────────────────────────────────────────────────────────────
console.log("4. round trip restores the payload exactly");
// ───────────────────────────────────────────────────────────────────────────
for (const [name, make] of FIXTURES) {
  const g = make();
  const other = g.categoryKey === "cabinet_refinishing" ? REFACE : REFIN;
  const there = flip(g, other);
  const back = flip(there, catOf(g));
  ok(`there and back saves byte-for-byte the same: ${name}`, md5(payloadOf(back)) === md5(payloadOf(g)), `${md5(payloadOf(back))} vs ${md5(payloadOf(g))}`);
  ok(`…and the same subtotal: ${name}`, groupSubtotal(back, overridesFor(catOf(back))) === groupSubtotal(g, overridesFor(catOf(g))));
  const thrice = flip(flip(back, other), catOf(g));
  ok(`twice round is still the same: ${name}`, md5(payloadOf(thrice)) === md5(payloadOf(g)));
}
{
  // A price typed on the far side is remembered for the next visit.
  const g = kitchenRefinishing();
  const reface = { ...flip(g, REFACE), baseUnitPrice: 575 };
  const refin = flip(reface, REFIN);
  ok("refinishing's own $150 is back", refin.baseUnitPrice === 150);
  ok("refacing's typed $575 is still there next time", flip(refin, REFACE).baseUnitPrice === 575);
  // Counts edited while on the far side are NOT undone by coming back — the
  // round trip restores the service's figures, never the kitchen's answers.
  const edited = flip({ ...flip(g, REFACE), intakeValues: { ...g.intakeValues, doorCount: "27" } }, REFIN);
  ok("a count changed on the far side survives the return", edited.intakeValues.doorCount === "27");
}

// ───────────────────────────────────────────────────────────────────────────
console.log("5. the saved row names the chosen service only");
// ───────────────────────────────────────────────────────────────────────────
{
  const g = kitchenRefinishing();
  const switched = flip(g, REFACE);
  const p = payloadOf(switched);
  const wire = JSON.stringify(p);
  ok("no memory of the other service on the wire", !wire.includes("serviceFigures") && !wire.includes("cabinet_refinishing") && !wire.includes("cat_rf") && !wire.includes("Cabinet Refinishing"), wire.slice(0, 200));
  ok("same payload keys as an untouched group", same(Object.keys(p), Object.keys(payloadOf(g))), JSON.stringify(Object.keys(p)));
  ok("same intake keys as an untouched group", same(Object.keys(p.intakeValues).sort(), Object.keys(payloadOf(g).intakeValues).sort()));
  ok("categoryId is the chosen service", p.categoryId === "cat_rc");
  ok("the base line is described by the chosen name", p.lineItems[0].description === "Cabinet Refacing");
}

// ───────────────────────────────────────────────────────────────────────────
if (fails.length) {
  console.error(`\n✗ cabinet switch: ${fails.length} failed, ${pass} passed`);
  for (const f of fails) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`\n✓ cabinet switch: ${pass} checks`);
