// scripts/check-material-costs-labels.mjs
//
//   node --import ./scripts/alias-loader.mjs scripts/check-material-costs-labels.mjs
//
// ── What this is guarding ───────────────────────────────────────────────────
//
// The owner, of a consumable on Settings > Material Costs: "is the units per
// roll? is how many tapes are in one roll? and the cost of a pack of tapes in
// a roll? same for masking film?" — and separately: "where can they enter the
// number of materials used in a small, medium, large product? i'm not sure
// where those go."
//
// Both were reasonable readings of the OLD label ("Units per roll") and the
// old screen (no answer to the size question anywhere on it). Neither was
// what the field actually does: `perUnits` is how many doors+drawers one
// roll covers, there is no "how many tapes in a roll" concept, and there is
// no small/medium/large setting anywhere in the product — quantity is always
// the real door/drawer count typed on that quote.
//
// This file does two things a re-read of the labels can't:
//
//   1. Runs the production cost function, lib/costing/estimateJobCost.js's
//      estimateScopeGroupCost(), against the exact numbers the settings page
//      would compute a worked example from, and checks the two agree. If a
//      future change to the consumable formula (ceil vs round, base-roll
//      logic, etc.) ever drifts from what the settings page tells a
//      contractor to expect, this fails — a label can't drift silently from
//      the math it describes.
//   2. Reads the page and the field-config source for the specific promises
//      made in the fix: a hint beside each consumable field, and an explicit
//      "no small/medium/large" sentence on both material-cost categories.
import fs from "node:fs";
import { estimateScopeGroupCost } from "@/lib/costing/estimateJobCost";
import { CONSUMABLE_EDITABLE_FIELDS, RECIPE_EDITABLE_FIELDS } from "@/app/data/materialRecipes";

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

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

/* ══ 1. The worked example agrees with the real cost function ══════════════ */

section("The example beside each field matches what the job actually costs");

// Mirrors consumableExample() in app/app/settings/material-costs/page.js —
// duplicated here on purpose rather than imported, because that file is a
// "use client" component with JSX and node can't load it without a
// transpiler (see scripts/alias-loader.mjs: "Resolution only — no
// transpiling"). Cross-checked below against the real production function
// instead of trusting this copy on its own.
const EXAMPLE_KITCHEN = { doors: 24, drawers: 8 };
function pageExample(subKey, cfg) {
  const units = EXAMPLE_KITCHEN.doors + EXAMPLE_KITCHEN.drawers;
  if (!cfg) return null;
  if (subKey === "tape") {
    const perUnits = Number(cfg.perUnits);
    const costPerRoll = Number(cfg.costPerRoll);
    if (!(perUnits > 0) || !Number.isFinite(costPerRoll)) return null;
    const rolls = Math.ceil(units / perUnits);
    return { rolls, cost: Math.round(rolls * costPerRoll * 100) / 100 };
  }
  if (subKey === "maskingFilm") {
    const perJob = Number(cfg.perJob) || 0;
    const perUnits = Number(cfg.perUnits);
    const costPerRoll = Number(cfg.costPerRoll);
    if (!(perUnits > 0) || !Number.isFinite(costPerRoll)) return null;
    const rolls = perJob + Math.ceil(units / perUnits);
    return { rolls, cost: Math.round(rolls * costPerRoll * 100) / 100 };
  }
  if (subKey === "sandpaper") {
    const perUnit = Number(cfg.perUnit);
    if (!Number.isFinite(perUnit)) return null;
    return { cost: Math.round(units * perUnit * 100) / 100 };
  }
  return null;
}

function realMaterials(consumables) {
  const result = estimateScopeGroupCost({
    categoryKey: "cabinet_refinishing",
    intake: { doorCount: EXAMPLE_KITCHEN.doors, drawerCount: EXAMPLE_KITCHEN.drawers, woodSpecies: "maple" },
    recipeOverrides: { consumables },
  });
  const byName = Object.fromEntries((result?.materials || []).map((m) => [m.name, m]));
  return { result, byName };
}

const scenarios = [
  { tape: { perUnits: 8, costPerRoll: 8 }, maskingFilm: { perJob: 1, perUnits: 15, costPerRoll: 25 }, sandpaper: { perUnit: 2 } },
  // Not a multiple of the coverage rate — proves the round-up (never a
  // fractional roll) matches on the boundary, not just on tidy numbers.
  { tape: { perUnits: 7, costPerRoll: 6.5 }, maskingFilm: { perJob: 2, perUnits: 11, costPerRoll: 19.99 }, sandpaper: { perUnit: 0.85 } },
  // A company that raised its base masking allowance to 3 rolls a job.
  { tape: { perUnits: 10, costPerRoll: 10 }, maskingFilm: { perJob: 3, perUnits: 20, costPerRoll: 22 }, sandpaper: { perUnit: 1.5 } },
];

for (const [i, consumables] of scenarios.entries()) {
  const withLabels = {
    tape: { ...consumables.tape, label: "Painter's tape" },
    maskingFilm: { ...consumables.maskingFilm, label: "Masking film" },
    sandpaper: { ...consumables.sandpaper, label: "Sandpaper / abrasives" },
  };
  const { byName } = realMaterials(withLabels);
  const tapeExample = pageExample("tape", consumables.tape);
  const maskingExample = pageExample("maskingFilm", consumables.maskingFilm);
  const sandpaperExample = pageExample("sandpaper", consumables.sandpaper);

  ok(`scenario ${i + 1}: tape — page example (${tapeExample?.rolls} rolls, $${tapeExample?.cost}) matches the real cost function`,
    byName["Painter's tape"]?.qty === tapeExample?.rolls && byName["Painter's tape"]?.cost === tapeExample?.cost,
    { real: byName["Painter's tape"], example: tapeExample });

  ok(`scenario ${i + 1}: masking film — page example (${maskingExample?.rolls} rolls, $${maskingExample?.cost}) matches the real cost function`,
    byName["Masking film"]?.qty === maskingExample?.rolls && byName["Masking film"]?.cost === maskingExample?.cost,
    { real: byName["Masking film"], example: maskingExample });

  ok(`scenario ${i + 1}: sandpaper — page example ($${sandpaperExample?.cost}) matches the real cost function`,
    byName["Sandpaper / abrasives"]?.cost === sandpaperExample?.cost,
    { real: byName["Sandpaper / abrasives"], example: sandpaperExample });
}

/* ══ 2. Hostile input: the example function fails closed ══════════════════ */

section("Hostile input never produces a wrong-but-confident example");

ok("perUnits of 0 -> no example (would divide by zero)", pageExample("tape", { perUnits: 0, costPerRoll: 8 }) === null);
ok("perUnits missing -> no example", pageExample("tape", {}) === null);
ok("negative costPerRoll still computes (a real, if unusual, rate) rather than silently zeroing",
  pageExample("tape", { perUnits: 8, costPerRoll: -5 })?.cost === -20);
ok("non-numeric costPerRoll -> no example", pageExample("tape", { perUnits: 8, costPerRoll: "free" }) === null);
ok("null cfg -> no example, not a throw", pageExample("tape", null) === null);
ok("maskingFilm with no perJob defaults its base allowance to 0, not NaN",
  pageExample("maskingFilm", { perUnits: 15, costPerRoll: 25 })?.rolls === Math.ceil(32 / 15));

/* ══ 3. The actual field config carries a hint, not just a label ══════════ */

section("Every consumable field the owner asked about explains itself");

for (const [subKey, fields] of Object.entries(CONSUMABLE_EDITABLE_FIELDS)) {
  for (const f of fields) {
    ok(`${subKey}.${f.key} carries a hint sentence`, typeof f.hint === "string" && f.hint.length > 10, f);
  }
}

const tapePerUnits = CONSUMABLE_EDITABLE_FIELDS.tape.find((f) => f.key === "perUnits");
ok("tape's hint explicitly rules out the owner's own misreading (\"tapes in a roll\")",
  /roll/i.test(tapePerUnits.hint) && /door|drawer|piece/i.test(tapePerUnits.hint));

// RECIPE_EDITABLE_FIELDS (the primer/top-coat/labour fields) weren't part of
// the owner's question and don't need hints — asserted here only so nobody
// reads their absence as an oversight this file missed.
ok("the primer/top-coat fields are unchanged in shape (label + step, no hint required)",
  RECIPE_EDITABLE_FIELDS.cabinet_unit.every((f) => typeof f.label === "string" && typeof f.step === "number"));

/* ══ 4. The "where does small/medium/large go" question is answered ═══════ */

section('The size question is answered on the page, not left for someone to find');

const pageSrc = stripComments(
  fs.readFileSync(
    new URL("../app/app/settings/material-costs/page.js", import.meta.url),
    "utf8",
  ),
);
ok("cabinet_refinishing's card states there's no small/medium/large setting",
  /no separate small\/medium\/large/i.test(pageSrc));
ok("the sentence is rendered, not just defined — CATEGORY_META.sizeNote is read in the JSX",
  /meta\.sizeNote/.test(pageSrc));
ok("exterior_painting's card carries the same answer",
  (pageSrc.match(/no separate small\/medium\/large/gi) || []).length >= 2);

console.log(
  failures === 0
    ? "\nMaterial cost labels say what the calculation actually does.\n"
    : `\n${failures} check(s) failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
