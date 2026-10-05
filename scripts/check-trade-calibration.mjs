// scripts/check-trade-calibration.mjs
//
//   npm run check:trade-calibration
//
// The trade labour defaults calibrated against the Craftsman estimating guides
// (owner, 2026-10-05: "fill the gaps and fix the mismatches using their
// numbers as reference"; and "this is only for the preset; the company can
// modify them to adjust to their own rates"). Executed against the real
// modules:
//
//   1. every changed or added default is pinned to its cited value AND to the
//      source comment beside it in code (book, year, page, row → figure)
//   2. every preset is a finite, cited figure; the screen names the guides,
//      never a book table
//   3. a company's own figure WINS — one new item and one changed item per
//      path (presets, the roofing rate card) — and no company override is
//      read-modified: frozen inputs, byte-identical after, and the sanitiser
//      keeps them, drops junk
//   4. every figure is editable where the trade's rates are edited
//   5. the "No rate — add one" items the report listed are priced, the ones
//      no preview prints still say so
//   6. the water heater's type choice: catalogue, op, hours
//   7. roofing: tear-off by material, labour-only materials, the job
//      minimum, the pitch ladder is monotone and editable
//   8. the complexity ladder's values unchanged, its provenance cited
//   9. painting's suggested rates as the owner decided them (2026-10-05)
//  10. strings in all nine languages; wired into check:all
import { readFileSync } from "node:fs";

import {
  allPresets,
  LABOUR_PRESETS,
  PRESET_HOME,
  PRESET_HOME_CATEGORIES,
  presetValue,
  presetFieldsFor,
  presetBook,
  presetsForCategory,
  sanitisePresetOverrides,
  SOURCE_LABEL,
  LABEL_PARTS,
  UNIT_LABELS,
  parseConduit,
  parseInches,
  parsePipeMaterial,
} from "@/lib/pricing/labourPresets";
import { sanitiseRates } from "@/lib/pricing/sanitiseRates";
import { ROOF_LABOUR_DEFAULTS, PITCH_BANDS, roofLabour, roofLabourRates, pitchBand } from "@/lib/pricing/roofLabour";
import { getPriceBook, PRICE_BOOK_FIELDS } from "@/app/data/tradePriceBooks";
import { getInteriorRecipe } from "@/app/data/priceBooks/interior";
import { STRUCTURAL_RECIPES } from "@/app/data/priceBooks/structural";
import { PANEL_SWAP_HOURS, RESIDENTIAL_PRODUCTIVITY_FACTOR, RESIDENTIAL_PRODUCTIVITY_FACTOR_STANDARD } from "@/lib/estimate/rewireTakeoff";
import { SUGGESTED_PRODUCTION, suggestedProduction, hoursFor } from "@/lib/services/productionRates";
import { isMeasurementKey, MEASUREMENT_KEYS } from "@/lib/services/measurementKeys";
import { suggestionFor, waterHeaterHours, COMPLEXITY_HOUR_FACTORS, COMPLEXITY_SOURCE } from "@/lib/planRead/tradeDefaults";
import { priceTrade, assumptionsIndex, engineBooks } from "@/lib/planRead/tradePricing";
import { TRADE_ITEMS, ITEM_ATTRIBUTE_CHOICES, itemDef } from "@/lib/planRead/tradeCatalogue";
import { applyTradeOps, cleanAttributes } from "@/lib/planRead/tradeModel";
import { presetReader } from "@/lib/pricing/labourPresets";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

let pass = 0;
const fails = [];
function ok(name, cond, detail) {
  if (cond) pass += 1;
  else fails.push(`${name}${detail === undefined ? "" : ` — got ${typeof detail === "string" ? detail : JSON.stringify(detail)}`}`);
}
const near = (a, b, tol = 1e-9) => Math.abs(Number(a) - Number(b)) <= tol;
const code = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const deepFreeze = (o) => {
  if (o && typeof o === "object") {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
};
const preset = (group, key) => LABOUR_PRESETS[group].find((p) => p.key === key);

// ═══════════════════════════════════════════════════════════════════════════
// 1. Every changed or added default, pinned to its value and its source line
// ═══════════════════════════════════════════════════════════════════════════
//
// [label, actual, expected, file, the source comment that must sit in that file]

const ROOF = "lib/pricing/roofLabour.js";
const INTERIOR = "app/data/priceBooks/interior.js";
const STRUCT = "app/data/priceBooks/structural.js";
const PRESETS = "lib/pricing/labourPresets.js";
const PROD = "lib/services/productionRates.js";
const DL = getInteriorRecipe("drywall_install").labour;
const FL = getInteriorRecipe("flooring_install").labour;
const TL = getInteriorRecipe("tiling").labour;
const WL = getInteriorRecipe("window_door_install").labour;
const FR = STRUCTURAL_RECIPES.framing;
const CR = STRUCTURAL_RECIPES.concrete;
const MR = STRUCTURAL_RECIPES.masonry;
const R = ROOF_LABOUR_DEFAULTS;

const PINS = [
  // Roofing — fixes
  ["roof: tear-off, first layer (asphalt)", R.tearOffFirstLayerPerSquare, 1.0, ROOF, /Craftsman NRR 2018 p\.359, "remove 3-tab to deck" LB 0\.85 Lg \/ 1\.00 Sm → 1\.00 mh\/sq/],
  ["roof: tear-off, each further layer", R.tearOffAdditionalLayerPerSquare, 0.67, ROOF, /Craftsman NHI 2026 p\.34, asphalt tear-off "double layer" BL@2\.00 − "single layer" 1\.33 → 0\.67 mh\/sq/],
  ["roof: tear-off, wood shingle", R.tearOffPerSquareByMaterial.wood, 2.02, ROOF, /Craftsman NHI 2026 p\.34, tear-off "wood shingle" → 2\.02 mh\/sq/],
  ["roof: tear-off, slate", R.tearOffPerSquareByMaterial.slate, 1.79, ROOF, /Craftsman NHI 2026 p\.34, tear-off "slate" → 1\.79 mh\/sq/],
  ["roof: tear-off, tile", R.tearOffPerSquareByMaterial.tile, 1.65, ROOF, /Craftsman NHI 2026 p\.34, tear-off "clay or concrete tile" → 1\.65 mh\/sq/],
  ["roof: tear-off, built-up", R.tearOffPerSquareByMaterial.built_up, 1.5, ROOF, /Craftsman NHI 2026 p\.34, tear-off "built-up roofing" → 1\.50 mh\/sq/],
  ["roof: underlayment (felt / synthetic only)", R.underlaymentPerSquare, 0.08, ROOF, /Craftsman NRR 2018 p\.359–360, laminated shingles over deck incl\. felt 1\.21 − over existing roofing 1\.13 → 0\.08 mh\/sq/],
  ["roof: drip edge", R.dripEdgePerLf, 0.035, ROOF, /Craftsman NCE 2018 p\.267, "drip edge or roof edge, 10'" SW@\.350 → 0\.035 mh\/LF/],
  ["roof: pitch, steep (10–12/12)", pitchBand(11).factor, 1.5, ROOF, /Craftsman NRI 2018 p\.339, "add 50% labour above 8\/12" → ×1\.50 \(WAS 1\.6\)/],
  ["roof: pitch, very steep (>12/12)", pitchBand(14).factor, 1.5, ROOF, /Craftsman NRI 2018 p\.339, "add 50% labour above 8\/12" → ×1\.50 \(WAS 2\.0\)/],
  // Roofing — fills
  ["roof: job minimum", R.jobMinimumHours, 5.5, ROOF, /Craftsman NRI 2018 p\.339, "minimum charge per roofing job" 6R@5\.50 → 5\.5 mh/],
  ["roof: concrete tile labour factor", R.materialLabourFactor.concrete_tile, 3.04, ROOF, /Craftsman NCE 2018 p\.261, "concrete tile" R1@4\.25 per sq ÷ installPerSquare 1\.4 → ×3\.04/],
  ["roof: clay tile labour factor", R.materialLabourFactor.clay_tile, 3.21, ROOF, /Craftsman NCE 2018 p\.261, "clay S-tile" R1@4\.50 per sq ÷ 1\.4 → ×3\.21/],
  ["roof: slate labour factor", R.materialLabourFactor.slate, 2.86, ROOF, /Craftsman NRI 2018 p\.340, "slate" 6R@4\.00 per sq ÷ 1\.4 → ×2\.86/],
  ["roof: fibre-cement slate labour factor", R.materialLabourFactor.fiber_cement_slate, 4.46, ROOF, /Craftsman NCE 2018 p\.261, "fiber-cement slate" R1@5\.50–7\.00 per sq \(mid 6\.25\) ÷ 1\.4 → ×4\.46/],
  ["roof: load tile onto the roof", R.tileLoadingPerSquare, 0.822, ROOF, /Craftsman NCE 2018 p\.262, "load tile onto roof" R1@\.822 → 0\.822 mh\/sq/],
  // Drywall
  ["drywall: finish Level 4 (walls)", DL.finishPerSqftByLevel[4], 0.008, INTERIOR, /Craftsman NHI 2018 p\.242, "tape and finish only, walls" DT@\.008 → 0\.008 mh\/sf/],
  ["drywall: ceiling finish ×1.25", DL.finishCeilingMultiplier, 1.25, INTERIOR, /Craftsman NHI 2018 p\.242, tape and finish ceilings DT@\.010 ÷ walls DT@\.008 → ×1\.25/],
  ["drywall: corner bead, install only", DL.cornerBeadPerLf, 0.016, INTERIOR, /Craftsman NHI 2018 p\.243, "metal or plastic bullnose, 8' piece" DI@\.128 → 0\.016 mh\/LF/],
  ["drywall: Type X hang adder", DL.typeXHangAdderPerSqft, 0.001, INTERIOR, /Craftsman NHI 2018 p\.242, hang only, 5\/8" Type X \.009 vs 1\/2" \.008 → \+0\.001 mh\/sf/],
  ["drywall: patch", DL.patchEach, 1.0, INTERIOR, /Craftsman NHI 2018 p\.244, "patch hole: cut back, backing, 3 coats, sand" BC@1\.00 → 1\.00 mh\/ea/],
  ["drywall: removal", DL.demoPerSqft, 0.01, INTERIOR, /Craftsman NHI 2026 p\.35, "drywall removal" BL@\.010 → 0\.010 mh\/sf/],
  ["drywall: knockdown texture", DL.texturePerSqft.knockdown, 0.008, INTERIOR, /Craftsman NHI 2018 p\.244, texture by type/],
  ["drywall: orange peel / spatter / skip trowel / popcorn", [DL.texturePerSqft.orangePeel, DL.texturePerSqft.spatter, DL.texturePerSqft.skipTrowel, DL.texturePerSqft.popcorn].join(), "0.006,0.007,0.009,0.005", INTERIOR, /"orange peel" \.006 … "skip trowel" \.009, "popcorn" \.005/],
  ["drywall: production rate agrees with the recipe (25 sheets a labour-day)", SUGGESTED_PRODUCTION.drywall_install.drywallSheets.amount, 25, PROD, /WAS\s+\/\/\s+12 sheets a day|WAS\n\/\/\s+12 sheets a day|12 sheets a day, read from/],
  // Electrical
  ["electrical: panel swap", PANEL_SWAP_HOURS, 15.9, "lib/estimate/rewireTakeoff.js", /Craftsman NRI 2018 p\.126, "remove breaker panel" 1D@6\.09 \+ p\.128 "200 amp int\. breaker panel \(15 breakers\)" 7E@9\.77 → 15\.86 mh/],
  ["electrical: 0.456 kept, documented as NRI's economy grade", RESIDENTIAL_PRODUCTIVITY_FACTOR, 0.456, "lib/estimate/rewireTakeoff.js", /economy grade" 9E@\.053 mh\/sf/],
  ["electrical: NRI's standard grade exposed as the alternative (~0.66)", RESIDENTIAL_PRODUCTIVITY_FACTOR_STANDARD, 0.66, "lib/estimate/rewireTakeoff.js", /No settings screen\s+\*\s+renders REWIRE_EDITABLE_FIELDS yet/],
  // Framing
  ["framing: interior 2x4 wall", FR.labourPartitionHoursPerLf.value, 0.224, STRUCT, /Craftsman NCE 2020 p\.34, "2x4 interior wall, 1\/2" drywall one side" \.046 − \.018 → \.028 mh\/sf × 8 ft = 0\.224 mh\/LF/],
  ["framing: exterior 2x6 wall", FR.labourWallFrameHoursPerLf.value, 0.288, STRUCT, /Craftsman NCE 2020 p\.34, "2x6 wall, 1\/2" drywall one side" \.054 − \.018 → \.036 mh\/sf × 8 ft = 0\.288 mh\/LF/],
  ["framing: wall sheathing", FR.labourSheathingHoursPerSqft.value, 0.016, STRUCT, /Craftsman NCE 2026 p\.7 worked example, "1\/2" plywood wall sheathing" B1@\.016 → 0\.016 mh\/sf/],
  ["framing: roof sheathing", FR.labourRoofSheathingHoursPerSqft.value, 0.0087, STRUCT, /Craftsman NCE 2020 p\.32, "roof sheathing" \.010 per sf floor ÷ 1\.15 sf of sheet per sf floor → 0\.0087 mh\/sf/],
  ["framing: subfloor", FR.labourSubfloorHoursPerSqft.value, 0.0096, STRUCT, /Craftsman NCE 2020 p\.32, "subfloor 5\/8" OSB" \.011 per sf floor at 1,150 sf of sheet per 1,000 sf → 0\.0096 mh\/sf/],
  ["framing: blocking", FR.labourBlockingHoursPerLf.value, 0.043, STRUCT, /Craftsman NCE 2020 p\.41, "solid blocking 2x10" \.057 each at 16" o\.c\. → \.057 × 12\/16 = 0\.043 mh\/LF/],
  ["framing: ceiling joists", FR.labourCeilingJoistHoursPerSqft.value, 0.045, STRUCT, /Craftsman NCE 2020 p\.32, "ceiling joists" \.045 per sf floor → 0\.045 mh\/sf of ceiling/],
  ["framing: cut-roof factor, cut-up over 6/12 only", FR.labourCutRoofFactor.value, 2.69, STRUCT, /Craftsman NCE 2020 p\.39, cut-up small-job rafters ×1\.95 and slope over 6\/12 \+38% → \.028 × 1\.95 × 1\.38 = \.075 → factor 2\.69/],
  ["framing: a simple stick gable", FR.labourStickRoofHoursPerSqft.value, 0.028, STRUCT, /Craftsman NCE 2020 p\.37, "conventionally framed gable 2x8 @24, ≤6\/12, no hips or valleys" → \.028 mh\/sf plan/],
  // Flooring
  ["flooring: laminate (click), between the book and a click crew", FL.laminatePerSqft, 0.03, INTERIOR, /Craftsman NCE 2018 p\.155, "laminate \(Pergo\), glued tongue and groove" BF@\.051 → 0\.051 mh\/sf; click taken at 0\.030/],
  ["flooring: solid oak strip, nailed", FL.solidNailPerSqft, 0.062, INTERIOR, /Craftsman NCE 2018 p\.154, "prefinished solid strip 2-1\/4", nailed" BF@\.062 → 0\.062 mh\/sf/],
  ["flooring: engineered", FL.engineeredNailPerSqft, 0.051, INTERIOR, /Craftsman NCE 2018 p\.155, "floating engineered" FL@\.051 → 0\.051 mh\/sf/],
  ["flooring: sheet vinyl", FL.sheetVinylPerSqft, 0.016, INTERIOR, /Craftsman NRR 2018 p\.351–353, sheet vinyl FB \.145\/SY ÷ 9 → 0\.016 mh\/sf/],
  ["flooring: vinyl tile", FL.vinylTilePerSqft, 0.016, INTERIOR, /Craftsman NRR 2018 p\.351–353, "vinyl tile over wood" FB \.016 → 0\.016 mh\/sf/],
  ["flooring: sand and finish on site", FL.sandAndFinishPerSqft, 0.045, INTERIOR, /Craftsman NCE 2018 p\.155, unfinished strip: sand 3 passes \.023 \+ stain\/seal \.010 \+ 2 coats urethane \.012 → 0\.045 mh\/sf/],
  ["flooring: tear out nailed hardwood", FL.tearOutHardwoodNailedPerSqft, 0.032, INTERIOR, /Craftsman NHI 2026 p\.36, "hardwood floor, nailed" BL@\.290\/SY ÷ 9 → 0\.032 mh\/sf/],
  ["flooring: tear out glued hardwood", FL.tearOutHardwoodGluedPerSqft, 0.056, INTERIOR, /Craftsman NHI 2026 p\.36, "hardwood floor, glued" BL@\.503\/SY ÷ 9 → 0\.056 mh\/sf/],
  ["tiling: backer board", TL.backerBoardPerSqft, 0.042, INTERIOR, /Craftsman NHI 2018 p\.245, "Durock 1\/2"" TL@\.042 → 0\.042 mh\/sf/],
  ["flooring (refinishing) suggested production: sand + seal + two coats", near(hoursFor(SUGGESTED_PRODUCTION.flooring.floorSqft && { key: "floorSqft", ...SUGGESTED_PRODUCTION.flooring.floorSqft }, 1000), 45, 0.05), true, PROD, /Craftsman NCE 2018 p\.155, sand \.023 \+ stain\/seal \.010 \+ 2 coats urethane \.012 → 0\.045 mh\/sf/],
  // Concrete, masonry, windows and doors (staged recipes)
  ["concrete: place and finish", CR.labourPlaceFinishHoursPerSqft.value, 0.013, STRUCT, /Craftsman NCE 2019 p\.615, "walkway 4", from chute, broom finish, no forms" P8@\.013 → 0\.013 mh\/sf/],
  ["concrete: forms", CR.labourFormingHoursPerLf.value, 0.027, STRUCT, /Craftsman NCE 2019 p\.615, "driveway apron 4", forms, mesh, finishing" P9@\.024 − walkway place & broom \.013 − mesh \.006 → forms \.005\/sf; on the book's 12 x 20 apron \(44 LF of form\) = 0\.027 mh\/LF/],
  ["concrete: mesh (inside the book's apron)", CR.labourReinforcingHoursPerSqft.value, 0.006, STRUCT, /Inside Craftsman NCE 2019 p\.615's \.024 all-in apron/],
  ["concrete: suggested production, forms + mesh + finish", hoursFor({ key: "areaSqFt", ...SUGGESTED_PRODUCTION.concrete.areaSqFt }, 1000), 24, PROD, /Craftsman NCE 2019 p\.615, "driveway apron 4", forms, mesh and finishing" P9@\.024 → 0\.024 mh\/sf/],
  ["masonry: brick veneer", MR.labourBrickHoursPerSqft.value, 0.144, STRUCT, /Craftsman NRI 2019 p\.240, "brick veneer, standard brick" 4M@\.144 → 0\.144 mh\/sf/],
  ["masonry: bond adders (common … curved)", ["Common", "Flemish", "English", "Herringbone", "Basketweave", "Soldier", "Stack", "CurvedWall"].map((b) => MR[`labourBond${b}Add`].value).join(), "0.16,0.54,0.65,1.25,1.22,0.15,0.08,0.27", STRUCT, /Craftsman NRI 2019 p\.241, labour add for brick bond patterns/],
  ["masonry: suggested production is the recipe's figure", SUGGESTED_PRODUCTION.masonry.areaSqFt.amount, 0.144, PROD, /Craftsman NRI 2019 p\.240, 4M@\.144/],
  ["windows: full-frame install (no trim or flashing in the item)", WL.fullFrameWindowEach, 1.39, INTERIOR, /Craftsman NRI 2019 p\.447, "install window, average size \(11 to 16 sf\)" 1C@1\.39 → 1\.39 mh\/ea/],
  ["doors: entry door install (split from its flashing)", WL.exteriorEntryDoorEach, 2.05, INTERIOR, /Craftsman NRR 2018 p\.139, "entrance door units" 2C 1\.33 Lg \/ 2\.05 Sm → 2\.05 mh\/ea/],
  ["doors: entry door flashing and sill pan, its own row", WL.exteriorEntryDoorFlashEach, 1.0, INTERIOR, /No Craftsman row prices a door's sill pan and flashing\. ASSUMPTION/],
  // Gates, HVAC, cabinets (production-rate presets)
  ["fencing: gate build and hang", SUGGESTED_PRODUCTION.fence_services.gateCount.amount, 1.51, PROD, /Craftsman NCE 2018 p\.147, "build and hang wood fence gate, total" BL@1\.51 → 1\.51 mh\/ea/],
  ["hvac: supply registers", SUGGESTED_PRODUCTION.hvac_install.ventCount.amount, 0.389, PROD, /Craftsman NRR 2025 p\.31, "supply registers 10x6 to 14x6" UA \.333–\.444 → midpoint 0\.389 mh\/ea/],
  ["hvac: returns", SUGGESTED_PRODUCTION.hvac_install.returnCount.amount, 0.45, PROD, /Craftsman NRR 2025 p\.31, "return air grilles" \.40–\.50 → midpoint 0\.45 mh\/ea/],
  ["hvac: condenser per ton", SUGGESTED_PRODUCTION.hvac_install.condenserTons.amount, 5.33, PROD, /Craftsman NRR 2025 p\.29, condensing unit, crew SB, 2 t 10\.7 \/ 3 t 16\.0 \/ 4 t 21\.3 → 5\.33 mh per ton/],
  ["hvac: galvanized duct per lb", SUGGESTED_PRODUCTION.hvac_install.ductLb.amount, 0.12, PROD, /Craftsman NRR 2025 p\.31, galvanized rectangular duct incl\. fittings and supports, under 400 lb, UF \.120 → 0\.120 mh\/lb/],
  ["hvac: flex duct per ft (6 in, insulated)", hoursFor({ key: "flexDuctFt", ...SUGGESTED_PRODUCTION.hvac_install.flexDuctFt }, 1000), 91, PROD, /Craftsman NRR 2025 p\.32, insulated flex duct 6" UD \.091 → 0\.091 mh\/LF/],
  ["hvac: commission + air balance per system", SUGGESTED_PRODUCTION.hvac_install.hvacSystems.amount, 8, PROD, /Craftsman NPH 2018 p\.289, "commission and test" 4\.00 \+ "air balance" 4\.00 → 8\.0 mh per system/],
  ["hvac: the air handler's 21–27 h is NOT adopted, and says so", SUGGESTED_PRODUCTION.hvac_install.airHandlers, undefined, PROD, /NOT adopted: NRR 2025 p\.28 prints an air handler at 21\.3–26\.7 h/],
  ["cabinets: base install per ft", SUGGESTED_PRODUCTION.kitchen_design.baseCabinetFt.amount, 0.521, PROD, /Craftsman NCE 2020 p\.29, "base cabinets, 34-1\/2" high" BC@\.521 → 0\.521 mh\/LF/],
  ["cabinets: wall install per ft", SUGGESTED_PRODUCTION.kitchen_design.wallCabinetFt.amount, 0.34, PROD, /Craftsman NCE 2020 p\.29, "wall cabinets, 30" high" BC@\.340 → 0\.340 mh\/LF/],
];
for (const [label, actual, expected, file, src] of PINS) {
  ok(`pinned: ${label} = ${expected}`, typeof expected === "number" ? near(actual, expected) : actual === expected, actual);
  ok(`…cited in ${file}`, src.test(code(file)), String(src));
}

// The electrical and plumbing presets: value and citation, from the registry.
const PRESET_PINS = [
  ["electrical", "resReceptacle", 0.977, /Craftsman NRI 2018 p\.127, "install switch or outlet with wiring run & box" → 0\.977 mh\/ea/],
  ["electrical", "resSwitch", 0.977, /Craftsman NRI 2018 p\.127/],
  ["electrical", "resSwitch3Way", 1.95, /"install 3-way switch with wiring run & box" → 1\.95 mh\/ea/],
  ["electrical", "resGfci", 1.139, /Craftsman NCE 2019 p\.563, "Ground fault circuit interrupter receptacle" \.324 − "grounded duplex" \.162 → 1\.139 mh\/ea/],
  ["electrical", "resDimmer", 1.347, /Craftsman NCE 2019 p\.564, dimmer \.417–\.626 \(mid \.52\) − one-pole switch \.112–\.187 \(mid \.15\) → 1\.347 mh\/ea/],
  ["electrical", "resLightFixture", 1.376, /Craftsman NRI 2018 p\.129, "interior incandescent light fixture" \.574 \+ p\.127 "wiring run, typical 120 volt outlet or light" \.802 → 1\.376 mh\/ea/],
  ["electrical", "resSmokeCo", 1.2, /Craftsman NRI 2018 p\.128, "detector, direct-wired" \.398 \+ p\.127 wiring run \.802 → 1\.20 mh\/ea/],
  ["electrical", "resDedicated", 1.34, /"240 volt system, install outlet or switch with wiring run & box" → 1\.34 mh\/ea/],
  ["electrical", "resCircuit", 1.438, /Craftsman NRI 2018 p\.128, "single-pole circuit breaker" \.636 \+ p\.127 wiring run \.802 → 1\.438 mh\/ea/],
  ["electrical", "resDataDrop", 0.614, /Craftsman NRI 2018 p\.128, "low-voltage outlet, install outlet" \.256 \+ "wiring \(per outlet\)" \.358 → 0\.614 mh\/ea/],
  ["electrical", "romexNewPerLf", 0.03, /Craftsman NCE 2019 p\.559, NM-B "12 gauge, 2 conductor" E4@\.030 → 0\.030 mh\/LF/],
  ["electrical", "romexRenoPerLf", 0.047, /Craftsman NRI 2018 p\.127, "#12 2 wire with ground Romex" → 0\.047 mh\/LF/],
  ["electrical", "comCircuit", 2.49, /Craftsman NCE 2019 p\.547, EMT branch circuit 30', "3 #12 wire, 1\/2" conduit" E4@2\.49 → 2\.49 mh\/ea/],
  ["electrical", "gfciPremium", 0.162, /Craftsman NCE 2019 p\.563/],
  ["electrical", "dimmerPremium", 0.37, /Craftsman NCE 2019 p\.564/],
  ["electrical", "threeWayPremium", 0.11, /"Three-way switch" \.227–\.291/],
  ["electrical", "panelSwap", 15.9, /remove breaker panel" 6\.09 \+ p\.128 "200 amp int\. breaker panel" 9\.77/],
  ["electrical", "removeDevice", 0.15, /Craftsman NRI 2018 p\.126, "remove 120 volt switch or outlet" 1D@\.150 → 0\.150 mh\/ea/],
  ["electrical", "disconnect30", 3.06, /Craftsman NCE 2019 p\.568, NEMA-1 safety switch "30 amp" E4@3\.06 → 3\.06 mh\/ea/],
  ["electrical", "disconnect60", 3.89, /"60 amp" E4@3\.89/],
  ["electrical", "disconnect100", 4.2, /"100 amp" E4@4\.20/],
  ["electrical", "disconnect200", 6.92, /"200 amp" E4@6\.92/],
  ["electrical", "fireAlarmSmoke", 0.71, /Craftsman NCE 2019 p\.591, "Ionization AC smoke detector, with wiring" E4@\.710 → 0\.710 mh\/ea/],
  ["electrical", "fireAlarmPull", 0.497, /"Fire alarm pull stations, manual operation" E4@\.497/],
  ["electrical", "fireAlarmHeat", 0.746, /"Fixed temp\. and rate of rise smoke detector" E4@\.746/],
  ["electrical", "conduit_emtConcealed_0_75", 3.75, /Craftsman NEE 2025 p\.17, EMT concealed in walls and closed ceilings ¾″ L1@3\.75 per CLF → 3\.75 mh\/100 LF/],
  ["electrical", "conduit_emtExposed_2", 10, /Craftsman NEE 2025 p\.17, EMT exposed 2″ L1@10 per CLF/],
  ["electrical", "conduit_pvc_1", 3.3, /Craftsman NEE 2025 p\.37, PVC Schedule 40 1″ L1@3\.3/],
  ["electrical", "conduit_grs_1_25", 7, /Craftsman NEE 2025 p\.49, galvanized rigid steel 1¼″ L1@7/],
  ["electrical", "conduit_ent_0_5", 2.15, /Craftsman NEE 2025 p\.48, ENT ½″ L1@2\.15/],
  ["electrical", "conduit_flex_0_75", 3.0, /Craftsman NEE 2025 p\.28, flexible steel conduit ¾″ L1@3/],
  ["electrical", "conduit_liquidTight_1", 5.0, /Craftsman NEE 2025 p\.33, liquid-tight flexible conduit 1″ L1@5/],
  ["electrical", "conduit_emtSlab_2", 7.0, /Craftsman NEE 2025 p\.17, EMT in slab 2″ L1@7/],
  ["electrical", "thhn_12", 0.007, /Craftsman NCE 2019 p\.558, THHN "12 gauge" pulled, E4@0\.007 → 0\.007 mh per conductor-LF/],
  ["electrical", "thhn_4_0", 0.018, /THHN "4\/0 gauge" pulled, E4@0\.018/],
  ["electrical", "thhn_250", 0.02, /THHN "250 MCM" pulled, E4@0\.02/],
  ["plumbing", "wcSet", 2.1, /Craftsman NPH 2025 p\.27, "Water closet, floor mounted, tank type" P1@2\.10 → 2\.10 mh\/ea/],
  ["plumbing", "wcRough", 2.0, /Craftsman NPH 2025 p\.31, residential rough-in "Water closet" → 2\.00 mh\/ea/],
  ["plumbing", "lavSet", 2.0, /"Lavatory, countertop" → 2\.00/],
  ["plumbing", "lavRough", 1.75, /rough-in "Lavatory" → 1\.75/],
  ["plumbing", "sinkSet", 2.15, /"Kitchen sink, double, stainless" → 2\.15/],
  ["plumbing", "sinkRough", 1.75, /rough-in "Sink" → 1\.75/],
  ["plumbing", "tubSet", 2.5, /"Bathtub, steel \/ fiberglass \/ acrylic" → 2\.50/],
  ["plumbing", "tubRough", 2.1, /rough-in "Bathtub" → 2\.10/],
  ["plumbing", "showerSet", 3.5, /"Shower stall, 1-piece" → 3\.50/],
  ["plumbing", "showerRough", 2.45, /rough-in "Shower" → 2\.45/],
  ["plumbing", "urinalSet", 3.0, /"Urinal, wall hung" → 3\.00/],
  ["plumbing", "urinalRough", 2.75, /"Water closet, flush valve" 2\.75 — NPH prints no urinal rough-in/],
  ["plumbing", "mopSinkSet", 2.5, /"Mop sink" 2\.35–2\.65 → midpoint 2\.50/],
  ["plumbing", "mopSinkRough", 2.4, /commercial rough-in "Mop sink" → 2\.40/],
  ["plumbing", "fountainSet", 2.25, /"Drinking fountain" 2\.00–2\.50 → midpoint 2\.25/],
  ["plumbing", "fountainRough", 1.9, /commercial rough-in "Lavatory" 1\.90 — NPH prints no fountain rough-in/],
  ["plumbing", "floorDrainSet", 0.5, /Craftsman NPH 2018 p\.168, "Floor drain" P1@\.500 → 0\.50 mh\/ea/],
  ["plumbing", "cleanoutEach", 0.33, /Craftsman NPH 2018 p\.169, "Cleanout, in-line, ABS\/PVC 2–4"" \.30–\.35 → midpoint 0\.33 mh\/ea/],
  ["plumbing", "gasOutletEach", 1.15, /Craftsman NPH 2025 p\.26, "Kitchen appliance gas trim, 1\/2"" P1@1\.15 → 1\.15 mh\/ea/],
  ["plumbing", "comWc", 8, /Craftsman NPH 2019 p\.436, budget per fixture, plastic, "Water closet, tank" → 8 mh\/ea/],
  ["plumbing", "comLav", 9, /"Lavatory" → 9 mh\/ea/],
  ["plumbing", "comSink", 10, /"Kitchen sink" → 10 mh\/ea/],
  ["plumbing", "comTub", 12, /"Tub" → 12 mh\/ea/],
  ["plumbing", "comShower", 7, /"Shower" → 7 mh\/ea/],
  ["plumbing", "comFloorDrain", 7, /"Floor drain" → 7 mh\/ea/],
  ["plumbing", "comCleanout", 4, /"Cleanout" → 4 mh\/ea/],
  ["plumbing", "heaterGasSet", 1.0, /Craftsman NPH 2025 p\.19, gas-fired residential "40 gallon" P1@1\.00/],
  ["plumbing", "heaterElectricSet", 1.2, /Craftsman NPH 2025 p\.19, electric residential "40 gallon" P1@1\.20/],
  ["plumbing", "heaterTanklessSet", 18, /Craftsman NPH 2025 p\.20, tankless natural gas P1@16\.0–20\.0 → midpoint 18 mh\/ea/],
  ["plumbing", "heaterConnection", 1.75, /Craftsman NPH 2025 p\.21, "connection assembly, 3\/4" residential" P1@1\.75/],
  ["plumbing", "heaterVentPerLf", 0.11, /Craftsman NPH 2025 p\.21, "4" B-vent" P1@\.110/],
  ["plumbing", "heaterTanklessVent", 2.5, /"Tankless heater vent kit" P1@2\.50/],
  ["plumbing", "heaterRemoveGas", 2.0, /Craftsman NPH 2019 p\.432, "remove gas water heater, 40 gal" → 2\.00 mh\/ea/],
  ["plumbing", "pipe_copper_0_5", 0.104, /Craftsman NRI 2018 p\.334–336, copper pipe ½″ → 0\.104 mh\/LF/],
  ["plumbing", "pipe_plastic_4", 0.31, /plastic pipe 4″ → 0\.31 mh\/LF/],
  ["plumbing", "pipe_castIron_4", 0.27, /cast iron pipe 4″ → 0\.27 mh\/LF/],
  ["plumbing", "pipe_noHub_2", 0.21, /no-hub cast iron pipe 2″ → 0\.21 mh\/LF/],
  ["plumbing", "pipe_steel_0_75", 0.136, /steel pipe ¾″ → 0\.136 mh\/LF/],
  ["plumbing", "accessAttic", 1.5, /Craftsman NPH 2025 p\.6, labour adjustment "attic" ×1\.50/],
  ["plumbing", "accessCrawl", 1.2, /"crawl space" ×1\.20/],
  ["plumbing", "height20", 1.2, /work height 20' ×1\.20/],
  ["plumbing", "height40", 1.5, /work height 35–40' ×1\.50/],
];
for (const [group, key, value, src] of PRESET_PINS) {
  const p = preset(group, key);
  ok(`preset ${group}.${key} = ${value}`, p && near(p.value, value, 1e-9), p?.value);
  ok(`…and cites ${String(src).slice(1, 60)}`, p && src.test(p.src), p?.src);
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. Every preset: a finite figure, cited; the screen names the guides
// ═══════════════════════════════════════════════════════════════════════════

const presets = allPresets();
ok("every preset is a finite, non-negative figure", presets.every((p) => Number.isFinite(p.value) && p.value >= 0), presets.filter((p) => !Number.isFinite(p.value)).map((p) => p.key));
ok("every preset has a source and a READ / DERIVED / ASSUMPTION tag", presets.every((p) => p.src && ["READ", "DERIVED", "ASSUMPTION"].includes(p.tag)));
ok("every electrical and plumbing preset cites a Craftsman book, year and page — or says it is an assumption", [...LABOUR_PRESETS.electrical, ...LABOUR_PRESETS.plumbing].every((p) => /Craftsman (NRI|NCE|NEE|NPH|NHI|NRR) 20\d\d p\.\d/.test(p.src) || p.tag === "ASSUMPTION"), [...LABOUR_PRESETS.electrical, ...LABOUR_PRESETS.plumbing].filter((p) => !/Craftsman/.test(p.src)).map((p) => p.key));
ok("framing, drywall and flooring presets are READ from their recipes (one copy)", [...LABOUR_PRESETS.framing, ...LABOUR_PRESETS.drywall, ...LABOUR_PRESETS.flooring].every((p) => /app\/data\/priceBooks\/(structural|interior)\.js/.test(p.src)));
ok("…and they equal the recipe figure", near(preset("framing", "labourWallFrameHoursPerLf").value, FR.labourWallFrameHoursPerLf.value) && near(preset("drywall", "finishLevel4").value, DL.finishPerSqftByLevel[4]) && near(preset("flooring", "laminatePerSqft").value, FL.laminatePerSqft));
ok("the screen's wording: \"industry reference (Craftsman estimating guides)\"", SOURCE_LABEL === "industry reference (Craftsman estimating guides)");
const sugg = suggestionFor("electrical", "receptacle", { commercial: false, currency: "USD" });
ok("a suggestion's line names the guides — not a book, a page or a table", sugg.coefficients[0].source.includes(SOURCE_LABEL) && !/p\.\d|NRI|NCE|NEE|NPH|NHI|NRR/.test(sugg.coefficients[0].source), sugg.coefficients[0].source);
ok("no dollar figure from the books: every preset unit is hours, a factor or feet", presets.every((p) => ["each", "lf", "clf", "sqft", "factor", "ft"].includes(p.unit)));
ok("ROOF_LABOUR_DEFAULTS' comment says labour-hours, not crew-hours", !/Starting labour constants, in crew-hours/.test(code(ROOF)) && /Starting labour constants, in LABOUR-hours/.test(code(ROOF)));
ok("the roofing rate card's labour suffixes say labour-hours", PRICE_BOOK_FIELDS.roofing_service.filter((f) => f.group === "roofLabour" && /hours/.test(f.suffix)).every((f) => /labour-hours|^hours$/.test(f.suffix)));
ok("underlayment: deliberately felt / synthetic only, because ice-and-water has its own line", /Underlayment: felt or SYNTHETIC only\. Ice-and-water has its own line/.test(code(ROOF)) && R.iceWaterPerLf > 0);

// ═══════════════════════════════════════════════════════════════════════════
// 3. The company's own figure wins; overrides are read, never modified
// ═══════════════════════════════════════════════════════════════════════════

const it = (id, itemKey, value, unit, attributes = {}) => ({ id, itemKey, label: itemKey, active: true, attributes, quantity: { value, unit, confidence: "high" } });
const T = (tradeKey, items, extra = {}) => ({ tradeKey, items, complexity: { level: "low" }, included: true, ...extra });
const ctx = { currency: "USD", labourRate: 40, books: engineBooks({}), services: [], assumptions: assumptionsIndex([]) };
const blockOf = (pt, id) => pt.blocks.find((b) => b.itemIds.includes(id));

// One NEW item (conduit — no rate before) and one CHANGED item (the panel swap).
const elecTrade = T("electrical", [it("c1", "conduit", 200, "lnft", { conduit: "3/4\" EMT" }), it("p1", "panel", 1, "each", { amps: 200 })]);
const companyRates = deepFreeze({ electrical: { presets: { conduit_emtConcealed_0_75: 2.5, panelSwap: 10 } } });
const before = JSON.stringify(companyRates);
const def = priceTrade(elecTrade, { ...ctx, commercial: false, presetRates: {} });
const own = priceTrade(elecTrade, { ...ctx, commercial: false, presetRates: companyRates });
ok("NEW item, preset: 200 ft of 3/4 EMT concealed at 3.75 h/100 ft = 7.5 h", blockOf(def, "c1").hours === 7.5, blockOf(def, "c1").hours);
ok("NEW item, the company's own 2.5 h/100 ft WINS = 5 h", blockOf(own, "c1").hours === 5, blockOf(own, "c1").hours);
ok("CHANGED item, preset: the panel swap at the book's 15.9 h", blockOf(def, "p1").hours === 15.9, blockOf(def, "p1").hours);
ok("CHANGED item, the company's own 10 h WINS", blockOf(own, "p1").hours === 10, blockOf(own, "p1").hours);
ok("…the line says whose figure it is: \"Your figure\" vs \"FieldQuo default\"", /^Your figure/.test(blockOf(own, "p1").coefficients[0].source) && /^FieldQuo default/.test(blockOf(def, "p1").coefficients[0].source));
ok("the company's rates are READ, never modified (frozen, byte-identical after)", JSON.stringify(companyRates) === before);

// The same through the roofing rate card: a changed figure (first-layer
// strip) and a new one (slate's tear-off), via getPriceBook's merge.
const roofOverrides = deepFreeze({ labour: { tearOffFirstLayerPerSquare: 0.4, tearOffPerSquareByMaterial: { slate: 1.2 } } });
const roofBefore = JSON.stringify(roofOverrides);
const book = getPriceBook("roofing_service", roofOverrides);
const strip = (cfg, rates) => roofLabour({ squares: 20, pitchRise: 4, layers: 1, storeys: "one", ...cfg }, rates).breakdown.find((b) => b.key === "tear_off").hours;
ok("roofing CHANGED: preset strip 20 sq × 1.0 = 20 h", strip({}, null) === 20, strip({}, null));
ok("roofing CHANGED: the company's 0.4 WINS = 8 h", strip({}, book.labour) === 8, strip({}, book.labour));
ok("roofing NEW: slate strip preset 20 × 1.79 = 35.8 h", strip({ tearOffMaterial: "slate" }, null) === 35.8, strip({ tearOffMaterial: "slate" }, null));
ok("roofing NEW: the company's slate 1.2 WINS = 24 h — and its other materials keep the presets", strip({ tearOffMaterial: "slate" }, book.labour) === 24 && strip({ tearOffMaterial: "tile" }, book.labour) === 33, [strip({ tearOffMaterial: "slate" }, book.labour), strip({ tearOffMaterial: "tile" }, book.labour)]);
ok("…the roofing overrides are read, never modified", JSON.stringify(roofOverrides) === roofBefore);
ok("a pitch factor override wins for its band only", roofLabour({ squares: 10, pitchRise: 14 }, roofLabourRates({ pitchFactor: { very_steep: 1.8 } })).pitch.factor === 1.8 && roofLabour({ squares: 10, pitchRise: 11 }, roofLabourRates({ pitchFactor: { very_steep: 1.8 } })).pitch.factor === 1.5);
ok("…and a zero or junk pitch override falls back to the preset, never zeroes a roof", [0, -1, "x", null].every((v) => roofLabour({ squares: 10, pitchRise: 14 }, roofLabourRates({ pitchFactor: { very_steep: v } })).pitch.factor === 1.5));

// The sanitiser: presets kept for a trade with no book, junk dropped.
const rawIn = deepFreeze({ presets: { panelSwap: "12", resReceptacle: 0.8, made_up: 4, comCircuit: -1, resSwitch: NaN, __proto__: { x: 1 }, gfciPremium: true }, junk: 5 });
const rawBefore = JSON.stringify(rawIn);
const clean = sanitiseRates("electrical", rawIn);
ok("sanitiseRates keeps an electrical company's presets though electrical has no price book", clean && clean.presets.panelSwap === 12 && clean.presets.resReceptacle === 0.8, clean);
ok("…and drops undeclared keys, negatives, NaN, booleans and junk", clean && !("made_up" in clean.presets) && !("comCircuit" in clean.presets) && !("resSwitch" in clean.presets) && !("gfciPremium" in clean.presets) && !("junk" in clean), clean);
ok("…without modifying what it was given", JSON.stringify(rawIn) === rawBefore);
ok("drywall_install keeps BOTH its book fields and its presets", (() => {
  const c = sanitiseRates("drywall_install", { complexity: { standard: { hangPricePerSqft: 2 } }, presets: { finishLevel4: 0.01 } });
  return c.complexity.standard.hangPricePerSqft === 2 && c.presets.finishLevel4 === 0.01;
})());
ok("a trade with neither a book nor presets still stores nothing", sanitiseRates("lawn_care", { presets: { panelSwap: 3 } }) === null);
ok("an electrical preset sent on the plumbing card is dropped", sanitisePresetOverrides("plumbing", { panelSwap: 3 }) === null);
ok("roofing's new labour fields go through the same sanitiser", (() => {
  const c = sanitiseRates("roofing_service", { labour: { pitchFactor: { steep: 1.4 }, tearOffPerSquareByMaterial: { slate: "2" }, jobMinimumHours: 4, dripEdgePerLf: 0.02, materialLabourFactor: { slate: 3 }, tileLoadingPerSquare: 0.5 } });
  return c.labour.pitchFactor.steep === 1.4 && c.labour.tearOffPerSquareByMaterial.slate === 2 && c.labour.jobMinimumHours === 4 && c.labour.dripEdgePerLf === 0.02 && c.labour.materialLabourFactor.slate === 3 && c.labour.tileLoadingPerSquare === 0.5;
})());
ok("presets saved alone do not make the drywall BOOK the company's (\"Your drywall rate card\" stays honest)", engineBooks({ drywall_install: { presets: { finishLevel4: 0.01 } } }).drywall_install.own === false && engineBooks({ drywall_install: { complexity: { standard: { hangPricePerSqft: 2 } } } }).drywall_install.own === true);
ok("a drywall preset override reaches the engine block's hours", (() => {
  const dry = T("drywall", [it("w1", "wall_board", 1000, "sqft", { finishLevel: 4 })]);
  const a = priceTrade(dry, { ...ctx, presetRates: {} }).blocks[0].hours;
  const b = priceTrade(dry, { ...ctx, presetRates: { drywall_install: { presets: { finishLevel4: 0.02 } } } }).blocks[0].hours;
  return a === 18 && b === 30;
})());

// ═══════════════════════════════════════════════════════════════════════════
// 4. Editable where the trade's rates are edited
// ═══════════════════════════════════════════════════════════════════════════

for (const [group, home] of Object.entries(PRESET_HOME)) {
  const fields = presetFieldsFor(home);
  ok(`every ${group} preset has a field on the ${home} rate card`, LABOUR_PRESETS[group].every((p) => fields.some((f) => f.path === `presets.${p.key}`)));
}
ok("the rate card's book fragment shows the preset when nothing is saved and the company's figure when it is", presetBook("electrical", null).presets.panelSwap === 15.9 && presetBook("electrical", { presets: { panelSwap: 9 } }).presets.panelSwap === 9);
const rc = code("app/app/settings/services/RateCard.js");
ok("RateCard renders preset fields — for a trade with no book too — and says \"FieldQuo default\" on an unchanged one", /presetFieldsFor\(category\.key\)/.test(rc) && /\(!hasBook && presetFields\.length === 0\)/.test(rc) && /t\("app\.labourPresets\.fieldquoDefault", "FieldQuo default"\)/.test(rc) && /field\.group === "roofLabour"/.test(rc));
const ROOF_FIELDS = ["labour.dripEdgePerLf", "labour.tearOffFirstLayerPerSquare", "labour.tearOffAdditionalLayerPerSquare", "labour.underlaymentPerSquare", "labour.jobMinimumHours", "labour.tileLoadingPerSquare", ...["wood", "slate", "tile", "built_up"].map((k) => `labour.tearOffPerSquareByMaterial.${k}`), ...PITCH_BANDS.map((b) => `labour.pitchFactor.${b.key}`), ...Object.keys(R.materialLabourFactor).map((k) => `labour.materialLabourFactor.${k}`)];
ok("every changed or added roofing figure is a field on the roofing rate card", ROOF_FIELDS.every((p) => PRICE_BOOK_FIELDS.roofing_service.some((f) => f.path === p)), ROOF_FIELDS.filter((p) => !PRICE_BOOK_FIELDS.roofing_service.some((f) => f.path === p)));
ok("the read loads the preset home categories' saved rates and passes them on", /PRESET_HOME_CATEGORIES/.test(code("lib/planRead/readPricing.js")) && /presetRates: ctx\.presetRates/.test(code("lib/planRead/readPricing.js")) && PRESET_HOME_CATEGORIES.includes("electrical") && PRESET_HOME_CATEGORIES.includes("carpentry"));
ok("the production-rate suggestions are DERIVED from the presets, not restated", near(suggestedProduction("electrical", "receptaclesPractical").amount, preset("electrical", "resReceptacle").value) && near(suggestedProduction("electrical", "panels").amount, PANEL_SWAP_HOURS) && near(suggestedProduction("carpentry", "wallFramingFt").amount, FR.labourPartitionHoursPerLf.value) && /presetHours\(/.test(code(PROD)));
ok("…and every new suggestion has a registered key", Object.entries(SUGGESTED_PRODUCTION).every(([, byKey]) => Object.keys(byKey).every(isMeasurementKey)));
ok("the new typed keys exist (HVAC and cabinets)", ["condenserTons", "ductLb", "flexDuctFt", "hvacSystems", "baseCabinetFt", "wallCabinetFt"].every((k) => MEASUREMENT_KEYS[k] && MEASUREMENT_KEYS[k].unit !== "hour"));

// ═══════════════════════════════════════════════════════════════════════════
// 5. The "No rate — add one" items the report listed are priced
// ═══════════════════════════════════════════════════════════════════════════

const FILLED = {
  electrical: [["conduit", { conduit: "1\" PVC" }], ["feeder", { conduit: "EMT" }], ["feeder", {}], ["data_drop"], ["disconnect", { amps: 60 }], ["fire_alarm_device"], ["demo_device"], ["switch_3way"], ["receptacle_gfci"], ["dimmer"]],
  plumbing: [["water_closet"], ["urinal"], ["lavatory"], ["sink"], ["mop_sink"], ["shower"], ["tub"], ["drinking_fountain"], ["floor_drain"], ["cleanout"], ["gas_outlet"], ["supply_pipe", { material: "PEX", pipeSize: "3/4\"" }], ["drain_pipe", { material: "cast iron", pipeSize: "4 in" }]],
  drywall: [["patch"], ["demo"], ["texture", { textureType: "popcorn" }]],
  framing: [["blocking"], ["ceiling_joists"], ["sheathing", { surface: "roof" }]],
  flooring: [["tear_out", { material: "glued hardwood" }], ["floor_area", { material: "sheet vinyl" }], ["floor_area", { material: "VCT" }], ["floor_area", { material: "unfinished oak strip" }]],
};
for (const [trade, list] of Object.entries(FILLED)) {
  for (const [itemKey, attributes = {}] of list) {
    for (const commercial of [false, true]) {
      const s = suggestionFor(trade, itemKey, { commercial, currency: "USD", attributes });
      ok(`${trade}.${itemKey}${Object.keys(attributes).length ? ` ${JSON.stringify(attributes)}` : ""} (${commercial ? "commercial" : "house"}) has hours`, s && Number.isFinite(s.hoursPerUnit) && s.hoursPerUnit > 0, s);
    }
  }
}
ok("…a commercial toilet is NPH's budget (8 h); a house toilet is set + rough-in (4.10 h)", suggestionFor("plumbing", "water_closet", { commercial: true }).hoursPerUnit === 8 && near(suggestionFor("plumbing", "water_closet", { commercial: false }).hoursPerUnit, 4.1));
ok("…a 3-way in a house is NRI's 1.95 h; commercially NECA's switch + the 0.11 premium", suggestionFor("electrical", "switch_3way").hoursPerUnit === 1.95 && near(suggestionFor("electrical", "switch_3way", { commercial: true }).hoursPerUnit, (25 / 60) * 1.4 + 0.11, 1e-4));
ok("…a GFCI and a dimmer each carry their premium over the plain device, commercially", near(suggestionFor("electrical", "receptacle_gfci", { commercial: true }).hoursPerUnit - suggestionFor("electrical", "receptacle", { commercial: true }).hoursPerUnit, 0.162, 1e-4) && near(suggestionFor("electrical", "dimmer", { commercial: true }).hoursPerUnit - suggestionFor("electrical", "switch", { commercial: true }).hoursPerUnit, 0.37, 1e-4));
ok("…a commercial circuit is NCE's 2.49 h; a house circuit 1.438 h", suggestionFor("electrical", "circuit", { commercial: true }).hoursPerUnit === 2.49 && suggestionFor("electrical", "circuit").hoursPerUnit === 1.438);
ok("…a house feeder with no conduit is new-work cable (0.030 h/ft); one in EMT is conduit + three #12 pulls", suggestionFor("electrical", "feeder", { attributes: {} }).hoursPerUnit === 0.03 && near(suggestionFor("electrical", "feeder", { attributes: { conduit: "3/4 EMT" } }).hoursPerUnit, 0.0375 + 3 * 0.007, 1e-6));
ok("…pipe in an attic carries NPH's ×1.5 and at 22 ft the ×1.2 height factor", near(suggestionFor("plumbing", "supply_pipe", { attributes: { material: "copper", pipeSize: "1/2", access: "attic", heightFt: 22 } }).hoursPerUnit, 0.104 * 1.5 * 1.2, 1e-4));
ok("…unfinished oak adds sand-and-finish to the install (0.062 + 0.045)", near(suggestionFor("flooring", "floor_area", { attributes: { material: "unfinished oak strip" } }).hoursPerUnit, 0.107, 1e-9));
ok("…a roof-sheathing item takes the roof figure, a subfloor the subfloor's", suggestionFor("framing", "sheathing", { attributes: { surface: "roof" } }).hoursPerUnit === 0.0087 && suggestionFor("framing", "sheathing", { attributes: { surface: "floor" } }).hoursPerUnit === 0.0096 && suggestionFor("framing", "sheathing", {}).hoursPerUnit === 0.016);
ok("…a ceiling board's finish is 1.25× the wall's", near(suggestionFor("drywall", "ceiling_board", { attributes: { finishLevel: 4 } }).hoursPerUnit - 0.01 * 1.35, 0.008 * 1.25, 1e-9));
for (const [trade, itemKey] of [["electrical", "ev_charger"], ["plumbing", "hose_bib"], ["plumbing", "riser"]]) {
  ok(`${trade}.${itemKey}: no Craftsman preview prints it — still "No rate — add one"`, suggestionFor(trade, itemKey, {}) === null);
}
ok("the new item variants are in the read's vocabulary", ["switch_3way"].every((k) => itemDef("electrical", k)) && itemDef("drywall", "texture") && itemDef("framing", "ceiling_joists") && itemDef("flooring", "tear_out"));
ok("the conduit, size and pipe parsers read what drawings print", parseConduit('1-1/4" RMC').type === "grs" && parseConduit("3/4 EMT exposed").type === "emtExposed" && parseConduit("PVC sch 40").type === "pvc" && parseInches('1-1/4"') === 1.25 && parseInches("¾") === 0.75 && parsePipeMaterial("Type L copper") === "copper" && parsePipeMaterial("no-hub CI") === "noHub" && parsePipeMaterial("PEX-A") === "plastic");

// ═══════════════════════════════════════════════════════════════════════════
// 6. The water heater's type
// ═══════════════════════════════════════════════════════════════════════════

const get = presetReader({});
ok("electric tank: set 1.20 + connection 1.75 = 2.95 h", waterHeaterHours("electric", get).total === 2.95);
ok("gas tank, new: 1.00 + 1.75 + 10 ft × .11 = 3.85 h", waterHeaterHours("gas", get).total === 3.85);
ok("gas tank, replacing one: 3.85 + remove 2.00 = 5.85 h", waterHeaterHours("gas_replacement", get).total === 5.85);
ok("tankless: set 18 (NPH 16–20) + connection 1.75 + vent kit 2.50 = 22.25 h", waterHeaterHours("tankless", get).total === 22.25);
ok("the type is a closed choice on the item, the four the owner named", JSON.stringify(ITEM_ATTRIBUTE_CHOICES.heaterType) === '["electric","gas","gas_replacement","tankless"]' && TRADE_ITEMS.plumbing.water_heater.attrs.includes("heaterType"));
ok("the sanitiser keeps an answer and drops anything else, never coerces", cleanAttributes({ heaterType: "Tankless" }, itemDef("plumbing", "water_heater")).heaterType === "tankless" && !("heaterType" in cleanAttributes({ heaterType: "solar" }, itemDef("plumbing", "water_heater"))));
const wModel = { trades: [{ tradeKey: "plumbing", items: [{ id: "wh1", itemKey: "water_heater", label: "Water heaters", attributes: {} }] }] };
const set = applyTradeOps(wModel, [{ op: "set_item_choice", tradeKey: "plumbing", itemId: "wh1", attribute: "heaterType", value: "tankless" }], { actor: "person" });
ok("a PERSON sets the type on the item", set.model.trades[0].items[0].attributes.heaterType === "tankless" && set.dropped.length === 0, set);
ok("…the model cannot (person only)", applyTradeOps(wModel, [{ op: "set_item_choice", tradeKey: "plumbing", itemId: "wh1", attribute: "heaterType", value: "gas" }]).model.trades[0].items[0].attributes.heaterType === undefined);
ok("…an unknown type, or another attribute, is refused by name", applyTradeOps(wModel, [{ op: "set_item_choice", tradeKey: "plumbing", itemId: "wh1", attribute: "heaterType", value: "solar" }, { op: "set_item_choice", tradeKey: "plumbing", itemId: "wh1", attribute: "material", value: "x" }], { actor: "person" }).dropped.length === 2);
ok("…an attribute a person may not set on this item (access on a water heater) is refused, even with a valid answer", (() => {
  const r = applyTradeOps(wModel, [{ op: "set_item_choice", tradeKey: "plumbing", itemId: "wh1", attribute: "access", value: "attic" }], { actor: "person" });
  return r.dropped.length === 1 && r.model.trades[0].items[0].attributes.access === undefined;
})());
ok("…null clears it", applyTradeOps(set.model, [{ op: "set_item_choice", tradeKey: "plumbing", itemId: "wh1", attribute: "heaterType", value: null }], { actor: "person" }).model.trades[0].items[0].attributes.heaterType === undefined);
const wh = (type) => blockOf(priceTrade(T("plumbing", [it("w", "water_heater", 1, "each", type ? { heaterType: type } : {})]), { ...ctx, presetRates: {} }), "w");
ok("…and the type moves the hours: none 3.85 (asked), tankless 22.25", wh(null).hours === 3.85 && wh(null).notes.some((n) => /Choose the type/.test(n)) && wh("tankless").hours === 22.25, [wh(null).hours, wh("tankless").hours]);
const ws = code("app/components/planRead/PlanReadWorkspace.js");
ok("the read's screen offers the choice on a water heater row", /op: "set_item_choice"/.test(ws) && /attribute: "heaterType"/.test(ws) && /ITEM_ATTRIBUTE_CHOICES\.heaterType\.map/.test(ws));

// ═══════════════════════════════════════════════════════════════════════════
// 7. Roofing: tear-off by material, labour-only materials, the job minimum
// ═══════════════════════════════════════════════════════════════════════════

ok("a tiny repair is never shorter than the 5.5 h job minimum, and the top-up is its own row", (() => {
  const r = roofLabour({ squares: 0.5, pitchRise: 4, layers: 0 });
  return r.hours === 5.5 && r.breakdown.some((b) => b.key === "job_minimum");
})());
ok("…a real roof is untouched by it", !roofLabour({ squares: 20, pitchRise: 4, layers: 1 }).breakdown.some((b) => b.key === "job_minimum"));
ok("tile carries the loading-onto-the-roof hours; shingles do not", roofLabour({ squares: 10, pitchRise: 4, materialKey: "concrete_tile" }).breakdown.some((b) => b.key === "tile_loading" && near(b.hours, 8.22)) && !roofLabour({ squares: 10, pitchRise: 4, materialKey: "asphalt_arch" }).breakdown.some((b) => b.key === "tile_loading"));
ok("a material the book does not sell takes its labour factor from the labour block (slate ×2.86)", roofLabour({ squares: 10, pitchRise: 4, materialKey: "slate" }).materialFactor === 2.86);
const slateRoof = priceTrade(T("roofing", [it("r1", "roof_plane", 20, "sq", { pitch: 6, material: "natural slate", layers: 0 })]), { ...ctx, presetRates: {} });
ok("a slate roof on the drawings is a SUGGESTION timed at slate's factor — never the default shingle's price", slateRoof.blocks.length === 1 && slateRoof.blocks[0].rung === "suggestion" && slateRoof.blocks[0].sell === null && slateRoof.blocks[0].lines.length === 0 && slateRoof.blocks[0].takeoff.materialKey === "slate", slateRoof.blocks[0]);
ok("the roofing takeoff screen offers what is being stripped", /TEAR_OFF_MATERIALS\.map/.test(code("app/components/quotes/builder/TradeTakeoff.js")) && /set\(\{ tearOffMaterial/.test(code("app/components/quotes/builder/TradeTakeoff.js")));
ok("…and shows the pitch factor the engine used (the company's own when it has one)", /labour\.pitch\?\.factor \?\? band\.factor/.test(code("app/components/quotes/builder/TradeTakeoff.js")));
ok("the pitch ladder never falls as the roof steepens", PITCH_BANDS.every((b, i) => i === 0 || b.factor >= PITCH_BANDS[i - 1].factor));
ok("roofing's cut-up factor is the complexity factors' job — cited there, not a second multiplier", /cutUp/.test(code("lib/pricing/complexity/roofing.js")) && /Craftsman NRI 2018 p\.339/.test(code("lib/pricing/complexity/roofing.js")));

// ═══════════════════════════════════════════════════════════════════════════
// 8. The complexity ladder: values kept, provenance cited
// ═══════════════════════════════════════════════════════════════════════════

ok("the complexity ladder keeps 1.0 / 1.15 / 1.35 / 1.6", JSON.stringify(COMPLEXITY_HOUR_FACTORS) === '{"low":1,"medium":1.15,"high":1.35,"very_high":1.6}');
ok("…cites the books' published ranges (NHI +20–50%, NEE ×1.10–1.5, NRR 1.18–1.54×)", /Craftsman NHI 2019 p\.13/.test(code("lib/planRead/tradeDefaults.js")) && /Craftsman NEE 2025 p\.6/.test(code("lib/planRead/tradeDefaults.js")) && /×1\.18 roofing \(1\.33 \/ 1\.13\) to ×1\.54 windows and doors/.test(code("lib/planRead/tradeDefaults.js")));
const cx = priceTrade(T("electrical", [it("e", "receptacle", 10, "each")], { complexity: { level: "high" } }), { ...ctx, presetRates: {} }).blocks[0].coefficients.find((c) => c.name === "Complexity");
ok("…and the line no longer tags it a GUESS", cx && cx.tag === "DERIVED" && cx.source === COMPLEXITY_SOURCE && !/tag: "GUESS"/.test(code("lib/planRead/tradePricing.js").match(/name: "Complexity"[^\n]*/g).join("\n")), cx);

// ═══════════════════════════════════════════════════════════════════════════
// 9. Painting untouched; nothing written to a company
// ═══════════════════════════════════════════════════════════════════════════

// The owner decided painting's corrections on 2026-10-05: interior suggestions
// are FINISHED rates now (110 / 120 / 45), the takeoff's basis; exterior as was.
ok("painting's suggested rates are the owner's decided finished rates (110 / 120 / 45; exterior unchanged)", JSON.stringify(SUGGESTED_PRODUCTION.interior_painting) === JSON.stringify({ wallSqft: { amount: 110, basis: "per_hour" }, ceilingSqft: { amount: 120, basis: "per_hour" }, linearFt: { amount: 45, basis: "per_hour" } }) && JSON.stringify(SUGGESTED_PRODUCTION.exterior_painting) === JSON.stringify({ wallSqft: { amount: 150, basis: "per_hour" }, linearFt: { amount: 40, basis: "per_hour" } }));
ok("...and the comment says they are finished rates, not per coat", /interior figures are FINISHED rates/.test(code(PROD)) && /WAS 250 \/ 200 \/ 75/.test(code(PROD)));
ok("no preset belongs to a painting category", !PRESET_HOME_CATEGORIES.some((k) => /painting/.test(k)) && presetsForCategory("interior_painting").length === 0);
ok("nothing in the presets module writes a database row", !/prisma|\.update\(|\.upsert\(|\.create\(/.test(code(PRESETS)));

// ═══════════════════════════════════════════════════════════════════════════
// 10. Nine languages; wired in
// ═══════════════════════════════════════════════════════════════════════════

const NEW_KEYS = [
  "app.labourPresets.intro",
  "app.labourPresets.fieldquoDefault",
  ...Object.keys(PRESET_HOME).map((g) => `app.labourPresets.group.${g}`),
  ...Object.keys(LABEL_PARTS).map((k) => `app.labourPresets.part.${k}`),
  ...Object.keys(UNIT_LABELS).map((k) => `app.labourPresets.unit.${k}`),
  "app.roof.tearOffMaterial",
  ...["asphalt", "wood", "slate", "tile", "built_up"].map((k) => `app.roof.tearOff.${k}`),
  ...["heaterType", "access", "surface", "textureType"].map((k) => `app.planRead.attr.${k}`),
  "app.planRead.choice.heaterType.unset",
  ...Object.entries(ITEM_ATTRIBUTE_CHOICES).flatMap(([a, vs]) => vs.map((v) => `app.planRead.choice.${a}.${v}`)),
  "app.planRead.item.electrical.switch_3way",
  "app.planRead.item.drywall.texture",
  "app.planRead.item.framing.ceiling_joists",
  "app.planRead.item.flooring.tear_out",
  ...["condenserTons", "ductLb", "flexDuctFt", "hvacSystems", "baseCabinetFt", "wallCabinetFt"].map((k) => `app.serviceTemplates.measure_${k}`),
];
const LANGS = ["en", "fr", "es", "uk", "pa", "tl", "de", "zh", "it"];
const missing = [];
for (const k of NEW_KEYS) for (const l of LANGS) if (typeof APP_MESSAGES[l]?.[k] !== "string" || !APP_MESSAGES[l][k]) missing.push(`${l}:${k}`);
ok(`every new string exists in all nine languages (${NEW_KEYS.length} keys)`, missing.length === 0, missing.slice(0, 10));
ok("the English catalogue says what the code's fallback says", Object.entries(LABEL_PARTS).every(([k, en]) => APP_MESSAGES.en[`app.labourPresets.part.${k}`] === en));
ok("check:trade-calibration runs in check:all", /npm run check:trade-calibration/.test(JSON.parse(code("package.json")).scripts["check:all"]));

console.log(`\ncheck-trade-calibration: ${pass} passed, ${fails.length} failed`);
if (fails.length) {
  for (const f of fails) console.log(`  ✗ ${f}`);
  process.exit(1);
}
