// scripts/check-material-recipe-guards.mjs
//
//   node --import ./scripts/alias-loader.mjs scripts/check-material-recipe-guards.mjs
//
// ── The bug ────────────────────────────────────────────────────────────────
//
// Settings > Material Costs renders number inputs whose onChange is
// `Number(e.target.value)`. Clear one and you send 0. MaterialRecipeSetting
// stored whatever arrived — the PUT route was the only settings route taking
// free-form JSON that did not sanitise it — and getRecipe() merged that 0 over
// the shipped default on every cost estimate afterwards.
//
// Several of those values are DIVISORS in lib/costing/estimateJobCost.js.
// Clearing "Primer coverage (sqft/gal)" and pressing Save produced a green
// "Saved" tick and then, on the next quote's Cost & Margin panel:
//
//     Primer (3 coats, extra prep)    —  gal    $0
//
// Not "$Infinity". round2() in the estimator already maps non-finite to 0, so
// the division by zero is absorbed silently: the line still renders, priced at
// nothing, and unpricedCount stays 0 so nothing flags it. On the 24-door,
// 8-drawer kitchen this file prices, materials fall from $1,126 to $494. The
// hardening turned a loud failure into a quiet 56% understatement of cost.
//
// The same PUT also accepted keys the screen has no control for, so
// `{ label: "…", sqftPerDoor: -999 }` merged cleanly and shadowed the default
// for good.
//
// ── Why this runs the real functions ───────────────────────────────────────
//
// Asserting that the route "mentions a sanitiser" would pass on a sanitiser
// that returns its input. So this executes sanitiseRecipeOverrides against the
// exact value the page produces, then feeds the result through the SHIPPED
// getRecipe() and the SHIPPED cost estimator and requires a finite number out
// the other end. If the divisor list and the estimator's divisions ever drift
// apart, the arithmetic assertion fails even though the key list still looks
// right.
//
// It also strips comments before reading source, because this file and the two
// it guards all now carry a write-up of the bug — and a description of the
// forbidden shape matches as the forbidden shape.

import { readFileSync } from "node:fs";
import {
  sanitiseRecipeOverrides,
  getRecipe,
  MATERIAL_RECIPES,
  RECIPE_EDITABLE_FIELDS,
  CONSUMABLE_EDITABLE_FIELDS,
} from "@/app/data/materialRecipes";
import { estimateScopeGroupCost } from "@/lib/costing/estimateJobCost";

let pass = 0;
const failures = [];
// Label FIRST. Reversed, a non-empty string becomes the condition and nothing
// in this file could ever fail.
const ok = (label, cond) => (cond ? (pass++, undefined) : failures.push(label));

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const stripComments = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");

const route = stripComments(read("app/api/settings/material-recipes/route.js"));
const page = stripComments(read("app/app/settings/material-costs/page.js"));

// ── 1. The sanitiser is real, and it refuses the value the page produces ───
//
// Every divisor is exercised individually rather than as a set, because a
// sanitiser that guards eight of nine still ships the ninth Infinity.
const DIVISOR_CASES = [
  ["cabinet_refinishing", { primerCoverageSqftPerGal: 0 }],
  ["cabinet_refinishing", { topCoatCoverageSqftPerGal: 0 }],
  ["cabinet_refinishing", { hardenerQuartsPerGal: 0 }],
  ["cabinet_refinishing", { consumables: { tape: { perUnits: 0 } } }],
  ["cabinet_refinishing", { consumables: { maskingFilm: { perUnits: 0 } } }],
  ["exterior_painting", { wallCoverageSqftPerGal: 0 }],
  ["exterior_painting", { trimCoverageLfPerGal: 0 }],
  ["exterior_painting", { wallProductionRateSqftPerHour: 0 }],
  ["exterior_painting", { trimProductionRateLfPerHour: 0 }],
];

for (const [key, override] of DIVISOR_CASES) {
  const name = Object.keys(override)[0] === "consumables"
    ? `consumables.${Object.keys(override.consumables)[0]}.perUnits`
    : Object.keys(override)[0];
  const { overrides, errors } = sanitiseRecipeOverrides(key, override);
  ok(`${key}: a zero ${name} is refused with a named field`, errors.length === 1);
  ok(
    `${key}: a zero ${name} is not stored`,
    JSON.stringify(overrides).indexOf('"perUnits":0') === -1 &&
      !Object.values(overrides).includes(0),
  );
}

// The empty string is what an <input type="number"> cleared to blank actually
// yields once Number() has run on it, so both spellings are covered.
ok(
  "an empty string in a cost field is refused, not coerced to 0",
  sanitiseRecipeOverrides("cabinet_refinishing", { topCoatCostPerGal: "" })
    .errors.length === 1,
);
ok(
  "a negative cost is refused",
  sanitiseRecipeOverrides("cabinet_refinishing", { primerCostPerGal: -5 })
    .errors.length === 1,
);
ok(
  "NaN is refused",
  sanitiseRecipeOverrides("cabinet_refinishing", { topCoats: NaN }).errors
    .length === 1,
);
ok(
  "Infinity is refused",
  sanitiseRecipeOverrides("cabinet_refinishing", { topCoats: Infinity }).errors
    .length === 1,
);

// ── 2. Zero is still legal where zero is a real answer ─────────────────────
//
// The failure mode of an over-eager guard is a shop that genuinely pays
// nothing for masking film, or does no pressure washing, being unable to say
// so. Those are values, not undefined quantities.
for (const [label, key, override] of [
  ["masking film that costs nothing", "cabinet_refinishing", { consumables: { maskingFilm: { costPerRoll: 0 } } }],
  ["no base masking-film allowance", "cabinet_refinishing", { consumables: { maskingFilm: { perJob: 0 } } }],
  ["no pressure washing", "exterior_painting", { washingHours: 0 }],
  ["no setup time", "exterior_painting", { setupHours: 0 }],
  ["free sandpaper", "cabinet_refinishing", { consumables: { sandpaper: { perUnit: 0 } } }],
]) {
  ok(`a company can still say: ${label}`, sanitiseRecipeOverrides(key, override).errors.length === 0);
}

// ── 3. Unknown keys are dropped rather than merged ─────────────────────────
{
  const { overrides, errors } = sanitiseRecipeOverrides("cabinet_refinishing", {
    pwned: 1,
    somethingNobodyReads: "x",
    topCoats: 3,
  });
  ok("a key absent from the recipe is dropped", !("pwned" in overrides) && !("somethingNobodyReads" in overrides));
  ok("...silently, because nothing could ever have read it", errors.length === 0);
  ok("...while the real key beside it survives", overrides.topCoats === 3);
}
ok(
  "an override cannot change the SHAPE the estimator iterates",
  !("threeCoatSpecies" in
    sanitiseRecipeOverrides("cabinet_refinishing", { threeCoatSpecies: "oak" }).overrides),
);

// ── 4. Lossless on the payload the page actually sends ─────────────────────
//
// The page PUTs the whole resolved recipe minus `_hasOverrides`, `model` and
// `label`. If sanitising changed any of it, pressing Save without touching a
// field would silently move a company's numbers — which is the same class of
// bug in the other direction.
for (const categoryKey of Object.keys(MATERIAL_RECIPES)) {
  const full = JSON.parse(JSON.stringify(MATERIAL_RECIPES[categoryKey]));
  delete full.model;
  delete full.label;
  const { overrides, errors } = sanitiseRecipeOverrides(categoryKey, full);
  ok(`${categoryKey}: the page's own untouched payload saves cleanly`, errors.length === 0);
  ok(
    `${categoryKey}: saving without editing resolves to the identical recipe`,
    JSON.stringify(getRecipe(categoryKey, overrides)) ===
      JSON.stringify(getRecipe(categoryKey, {})),
  );
}

// ── 5. Every editable field is one the sanitiser will actually accept ──────
//
// RECIPE_EDITABLE_FIELDS drives the form. A field rendered on screen that the
// sanitiser drops or refuses is a control that appears to work and doesn't —
// the exact thing this repo is swept for.
for (const [model, fields] of Object.entries(RECIPE_EDITABLE_FIELDS)) {
  const categoryKey = Object.keys(MATERIAL_RECIPES).find(
    (k) => MATERIAL_RECIPES[k].model === model,
  );
  for (const f of fields) {
    const probe = MATERIAL_RECIPES[categoryKey][f.key];
    const value = typeof probe === "number" && probe > 0 ? probe : 1;
    const { overrides, errors } = sanitiseRecipeOverrides(categoryKey, { [f.key]: value });
    ok(`${model}: the editable field "${f.key}" survives a save`, errors.length === 0 && overrides[f.key] === value);
  }
}
for (const [subKey, fields] of Object.entries(CONSUMABLE_EDITABLE_FIELDS)) {
  for (const f of fields) {
    const { overrides, errors } = sanitiseRecipeOverrides("cabinet_refinishing", {
      consumables: { [subKey]: { [f.key]: 2 } },
    });
    ok(
      `consumables.${subKey}.${f.key} survives a save`,
      errors.length === 0 && overrides.consumables?.[subKey]?.[f.key] === 2,
    );
  }
}

// ── 6. The arithmetic, end to end, through the shipped estimator ───────────
//
// The assertion that survives a refactor of the key list: whatever a company
// can get past the sanitiser, the cost function must return finite money for.
{
  // The narrow case, because it is the one a person actually produces: clear
  // two boxes on the form, not eight.
  const hostile = {
    primerCoverageSqftPerGal: 0,
    consumables: { tape: { perUnits: 0 } },
  };
  const { overrides } = sanitiseRecipeOverrides("cabinet_refinishing", hostile);
  const scope = {
    categoryKey: "cabinet_refinishing",
    intake: { doorCount: 24, drawerCount: 8, woodSpecies: "oak" },
  };
  // `recipeOverrides` is the saved MaterialRecipeSetting.overrides column —
  // the estimator calls getRecipe() on it itself, so this is the production
  // path, not a reconstruction of it.
  const before = estimateScopeGroupCost({
    ...scope,
    recipeOverrides: hostile,
    labourRatePerHour: 65,
  });
  const after = estimateScopeGroupCost({
    ...scope,
    recipeOverrides: overrides,
    labourRatePerHour: 65,
  });
  // The symptom is a line the job certainly consumes arriving with no usable
  // quantity and therefore no cost — not a crash, and not a visible Infinity.
  // Both halves matter: a non-finite qty is the raw division escaping, and a
  // priced unit at zero total is that division after round2() has swallowed it.
  const ghostLines = (r) =>
    (r?.materials || []).filter(
      (m) =>
        !Number.isFinite(m.qty) ||
        (Number(m.unitCost) > 0 && m.qty > 0 && m.cost === 0),
    ).length;

  // The detector proves itself: the UNSANITISED blob must still misprice, or
  // this whole assertion is measuring nothing.
  ok(
    "the unsanitised override still ghosts material lines (detector is live)",
    ghostLines(before) === 2,
  );
  ok("...and understates the materials total", before.materialTotal < after.materialTotal);
  ok("the sanitised override prices every material line", ghostLines(after) === 0);
  // The sanitiser refuses all three hostile keys, so what is left is the
  // shipped default — the only honest answer when the input was unusable.
  ok(
    "...at the shipped default, since nothing usable was saved",
    after.materialTotal ===
      estimateScopeGroupCost({ ...scope, recipeOverrides: {}, labourRatePerHour: 65 })
        .materialTotal,
  );
}

// ── 7. The route calls it, and stores the result rather than the input ─────
ok(
  "the PUT route imports the sanitiser",
  /sanitiseRecipeOverrides/.test(route),
);
ok(
  "the PUT route refuses rather than clamping",
  /errors\.length[\s\S]{0,120}status:\s*400/.test(route),
);
// The shape, not the words: `overrides` is the raw request field and `clean`
// is the sanitised one. Writing the raw field is the bug.
ok(
  "the row is written from the sanitised value, not the request body",
  /update:\s*\{\s*overrides:\s*clean\s*\}/.test(route) &&
    !/update:\s*\{\s*overrides\s*\}/.test(route),
);
ok(
  "...on the create path too",
  /create:\s*\{[^}]*overrides:\s*clean/.test(route) &&
    !/create:\s*\{[^}]*overrides\s*[,}]/.test(route),
);

// ── 8. The screen: failed and empty are different sentences ────────────────
//
// Every branch on this page was gated on a non-null `recipes`, and a 403 left
// it null — so a refused read rendered as a page title over white space.
ok("the page tracks a load failure separately from having no data", /const \[loadError, setLoadError\] = useState\(""\)/.test(page));
ok("the failed load reaches the page's own error state", /reportResponseError\(res, setLoadError\)/.test(page));
ok("the failure is rendered, not just toasted", /\{loadError && \(/.test(page));
ok(
  "the no-categories notice cannot fire on a failed read",
  /!loadError && recipes && Object\.keys\(recipes\)\.length === 0/.test(page),
);

// ── 9. Reset says what it destroys, before it destroys it ──────────────────
//
// It is grey 12px text next to a chip, and it DELETEs every rate the shop
// entered. The confirm has to come before the request, so the assertion is on
// the order, not on the presence of the word "confirm".
ok(
  "reset asks before deleting the company's rates",
  /function handleReset[\s\S]{0,900}window\.confirm[\s\S]{0,600}method: "DELETE"/.test(page),
);
ok(
  "...and bails out when the answer is no",
  /if \(!confirmed\) return;/.test(page),
);

// ── Report ─────────────────────────────────────────────────────────────────
console.log(
  `\ncheck-material-recipe-guards: ${pass} passed, ${failures.length} failed`,
);
for (const f of failures) console.log(`  ✗ ${f}`);
if (failures.length) process.exitCode = 1;
