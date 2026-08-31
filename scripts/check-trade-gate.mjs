// scripts/check-trade-gate.mjs
//
//   node --import ./scripts/alias-loader.mjs \
//        --import ./scripts/db-stub-loader.mjs scripts/check-trade-gate.mjs
//
// ── The bug this exists because of ──────────────────────────────────────────
//
// Settings > Cabinet Rates (/app/settings/cabinet-rates) rendered for every
// company, including one that sells no cabinetry at all — no
// cabinet_refinishing, no cabinet_refacing, and not the kitchen_design
// category the Kitchen Designer's own gate (lib/kitchen/access.js) uses. Its
// API was gated only by role, so hiding the nav row alone would have been
// exactly the "hiding a button is not access control" failure AGENTS.md names
// first.
//
// lib/settings/tradeGate.js is the fix, and its header comment carries the
// (a)-vs-(b) reasoning: gate Cabinet Rates alone, or build one small
// mechanism and apply it to every settings screen that is genuinely
// trade-specific. That header explains that Material Costs — the report's own
// example of "shows for non-painters too" — turned out to be exactly as
// trade-specific as Cabinet Rates once read off its route (MATERIAL_RECIPES
// has exactly two keys), so this file proves BOTH screens, not one, and
// proves the two maps that carry the mechanism (lib/settings/tradeGate.js,
// lib/settings/tradeGateNav.js) cannot drift apart from each other or from
// the sidebar's own source without this failing.
//
// ── What is asserted, and why each one is EXECUTED rather than read ─────────
//
//   the pure functions, against hostile input      no DB, so nothing here
//                                                    can pass by asserting the
//                                                    shape of a query instead
//                                                    of the logic itself.
//
//   the owner's exact scenario, against a scripted  cabinet_refinishing and
//   db (scripts/fixtures/dbStub.mjs)                cabinet_refacing do NOT
//                                                    unlock Cabinet Rates —
//                                                    only kitchen_design does,
//                                                    or a rate card the
//                                                    company already saved.
//
//   the existing-data rule, both screens            a company that saved
//                                                    cabinet rates, or a
//                                                    material-cost override,
//                                                    keeps the screen even
//                                                    after switching the
//                                                    trade off.
//
//   the two maps agree with each other              SETTINGS_ROW_TRADE_GATE's
//                                                    values must all be real
//                                                    fields of companyTradeGate's
//                                                    own output shape.
//
//   the two maps agree with the sidebar              both row keys still name
//                                                    real settings rows —
//                                                    the reverse of what
//                                                    check-settings-access.mjs
//                                                    already proves for
//                                                    SETTINGS_ROW_CAPABILITY,
//                                                    and check-nav-audit.mjs
//                                                    does not know this map
//                                                    exists, so nothing else
//                                                    catches this drift.
//
//   the routes are actually WIRED to the lib          reading the fix is not
//                                                    the same as shipping it;
//                                                    this greps the route
//                                                    source the same way
//                                                    check-settings-access.mjs
//                                                    does, on code with
//                                                    comments stripped first.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rows, resetDbStub } from "./fixtures/dbStub.mjs";
import {
  CABINET_RATES_CATEGORY_KEYS,
  MATERIAL_COSTS_CATEGORY_KEYS,
  cabinetRatesEnabledPure,
  canUseCabinetRatesSettings,
  materialCostsCategoryAllowedPure,
  materialCostsVisibleCategoriesPure,
  materialCostsVisibleCategories,
  canUseMaterialCostsCategory,
  canUseMaterialCostsSettings,
  companyTradeGate,
} from "@/lib/settings/tradeGate";
import {
  SETTINGS_ROW_TRADE_GATE,
  tradeGateAllowsRow,
  filterSettingsGroupsByTrade,
} from "@/lib/settings/tradeGateNav";
import { MATERIAL_RECIPES } from "@/app/data/materialRecipes";
import { APP_MESSAGES } from "../app/i18n/appMessages.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

let checks = 0;
let failures = 0;
function ok(name, pass, detail = "") {
  checks++;
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${detail ? `  ${detail}` : ""}`);
}

// Comments carry the reasoning in this codebase and are usually right, which
// is exactly why a regex over raw source is unsafe: a header line like
// "canUseCabinetRatesSettings — the real gate" would make a naive grep for
// that identifier pass whether or not the route actually calls it. Every
// wiring assertion below runs on code with comments removed. Line comments
// FIRST — reversed, a `/*` inside a header's prose (there are several in this
// codebase) opens a block comment that swallows real code before the next
// `*/`, which would make a check pass by deleting the thing it's supposed to
// inspect.
function stripComments(src) {
  return src.replace(/(^|[^:])\/\/.*$/gm, "$1").replace(/\/\*[\s\S]*?\*\//g, " ");
}

/** Braces-only leaf-item parser, matching check-nav-audit.mjs exactly. */
function leafItems(block) {
  const out = [];
  for (const m of block.matchAll(/\{[^{}]*\}/g)) {
    const text = m[0];
    const keyM = text.match(/key:\s*"([^"]+)"/);
    const hrefM = text.match(/href:\s*"([^"]+)"/);
    if (keyM && hrefM) out.push({ key: keyM[1], href: hrefM[1] });
  }
  return out;
}
function sliceArray(src, decl) {
  const start = src.indexOf(decl);
  if (start < 0) throw new Error(`missing ${decl}`);
  const i = src.indexOf("[", start);
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === "[") depth++;
    else if (src[j] === "]" && --depth === 0) return src.slice(i, j + 1);
  }
  throw new Error(`unterminated ${decl}`);
}

console.log("Trade gate — Cabinet Rates and Material Costs, executed\n");

// ── 1. Pure functions against hostile input ─────────────────────────────

console.log("Pure functions, hostile input\n");

ok("cabinetRatesEnabledPure([]) is false", cabinetRatesEnabledPure([]) === false);
ok("cabinetRatesEnabledPure(null) is false", cabinetRatesEnabledPure(null) === false);
ok("cabinetRatesEnabledPure(undefined) is false", cabinetRatesEnabledPure(undefined) === false);
ok("cabinetRatesEnabledPure('kitchen_design') (a string, not an array) is false",
  cabinetRatesEnabledPure("kitchen_design") === false);
ok("cabinetRatesEnabledPure(['kitchen_design']) is true",
  cabinetRatesEnabledPure(["kitchen_design"]) === true);
// The exact claim the owner's report turns on: cabinet_refinishing and
// cabinet_refacing are cabinetry, but neither is what unlocks this screen.
ok("cabinetRatesEnabledPure(['cabinet_refinishing']) is false",
  cabinetRatesEnabledPure(["cabinet_refinishing"]) === false);
ok("cabinetRatesEnabledPure(['cabinet_refacing']) is false",
  cabinetRatesEnabledPure(["cabinet_refacing"]) === false);
ok("cabinetRatesEnabledPure(['cabinet_refinishing','cabinet_refacing']) is still false",
  cabinetRatesEnabledPure(["cabinet_refinishing", "cabinet_refacing"]) === false);
ok("cabinetRatesEnabledPure(['countertop','kitchen_design']) is true (order/extras don't matter)",
  cabinetRatesEnabledPure(["countertop", "kitchen_design"]) === true);

ok("materialCostsCategoryAllowedPure hostile: null/null/null is false",
  materialCostsCategoryAllowedPure("cabinet_refinishing", null, null) === false);
ok("materialCostsCategoryAllowedPure: enabled unlocks its own category",
  materialCostsCategoryAllowedPure("cabinet_refinishing", ["cabinet_refinishing"], []) === true);
ok("materialCostsCategoryAllowedPure: enabled for ONE category does not unlock the other",
  materialCostsCategoryAllowedPure("exterior_painting", ["cabinet_refinishing"], []) === false);
ok("materialCostsCategoryAllowedPure: an override alone unlocks it (existing-data rule)",
  materialCostsCategoryAllowedPure("exterior_painting", [], ["exterior_painting"]) === true);
ok("materialCostsCategoryAllowedPure: neither enabled nor overridden is false",
  materialCostsCategoryAllowedPure("cabinet_refinishing", ["kitchen_design"], ["exterior_painting"]) === false);

ok("materialCostsVisibleCategoriesPure([],[]) is empty",
  materialCostsVisibleCategoriesPure([], []).length === 0);
ok("materialCostsVisibleCategoriesPure only ever names catalogue keys",
  materialCostsVisibleCategoriesPure(
    ["cabinet_refinishing", "exterior_painting", "kitchen_design", "not_a_real_key"],
    [],
  ).every((k) => MATERIAL_COSTS_CATEGORY_KEYS.includes(k)));
ok("MATERIAL_COSTS_CATEGORY_KEYS is read off MATERIAL_RECIPES, not hand-typed",
  MATERIAL_COSTS_CATEGORY_KEYS.length === Object.keys(MATERIAL_RECIPES).length &&
    MATERIAL_COSTS_CATEGORY_KEYS.every((k) => k in MATERIAL_RECIPES));

ok("tradeGateAllowsRow(null, cabinetRates key) fails OPEN (unresolved -> shown)",
  tradeGateAllowsRow(null, "app.settings.cabinetRates") === true);
ok("tradeGateAllowsRow({}, cabinetRates key) with a real object but missing field is false",
  tradeGateAllowsRow({}, "app.settings.cabinetRates") === false);
ok("tradeGateAllowsRow(*, an unrelated row key) is always true — no rule for it",
  tradeGateAllowsRow({ cabinetRates: false, materialCosts: false }, "app.settings.products") === true);
ok("tradeGateAllowsRow({cabinetRates:true}, cabinetRates key) is true",
  tradeGateAllowsRow({ cabinetRates: true, materialCosts: false }, "app.settings.cabinetRates") === true);

{
  const groups = [
    { key: "g1", items: [
      { key: "app.settings.products" },
      { key: "app.settings.cabinetRates" },
      { key: "app.settings.materialCosts" },
    ] },
    { key: "g2", items: [{ key: "app.settings.cabinetRates" }] },
  ];
  const filtered = filterSettingsGroupsByTrade(groups, { cabinetRates: false, materialCosts: true });
  const g1Keys = filtered.find((g) => g.key === "g1")?.items.map((i) => i.key) || [];
  ok("filterSettingsGroupsByTrade drops cabinetRates, keeps materialCosts and unrelated rows",
    g1Keys.includes("app.settings.products") &&
      g1Keys.includes("app.settings.materialCosts") &&
      !g1Keys.includes("app.settings.cabinetRates"),
    JSON.stringify(g1Keys));
  ok("filterSettingsGroupsByTrade drops a group left with nothing",
    !filtered.some((g) => g.key === "g2"), JSON.stringify(filtered.map((g) => g.key)));
  ok("filterSettingsGroupsByTrade(groups, null) leaves everything (unresolved -> shown)",
    filterSettingsGroupsByTrade(groups, null).flatMap((g) => g.items).length === 4);
}

// ── 2. The owner's scenario, and its neighbours, EXECUTED against a scripted db

console.log("\nExecuted against scripts/fixtures/dbStub.mjs\n");

const COMPANY = "co_1";

function setCompanyCategories(enabledKeys) {
  rows.companyServiceCategory = enabledKeys.map((key) => ({
    companyId: COMPANY,
    enabled: true,
    category: { key },
  }));
}

// Scenario A — the owner's exact report: sells no cabinetry of any kind, has
// never saved a rate card, has never overridden a recipe.
resetDbStub();
rows.company = [{ id: COMPANY, cabinetRates: null }];
setCompanyCategories([]);
{
  const gate = await companyTradeGate(COMPANY);
  ok("scenario A (sells nothing cabinet-related): Cabinet Rates refused",
    (await canUseCabinetRatesSettings(COMPANY)) === false);
  ok("scenario A: Material Costs refused",
    (await canUseMaterialCostsSettings(COMPANY)) === false);
  ok("scenario A: companyTradeGate matches both individual checks",
    gate.cabinetRates === false && gate.materialCosts === false, JSON.stringify(gate));
}

// Scenario B — kitchen_design switched on, nothing else.
resetDbStub();
rows.company = [{ id: COMPANY, cabinetRates: null }];
setCompanyCategories(["kitchen_design"]);
ok("scenario B (kitchen_design on): Cabinet Rates allowed",
  (await canUseCabinetRatesSettings(COMPANY)) === true);
ok("scenario B: Material Costs still refused — kitchen_design isn't a recipe category",
  (await canUseMaterialCostsSettings(COMPANY)) === false);

// Scenario C — the exact wrong-axis case the owner's report and the header
// comment both call out: cabinet_refinishing AND cabinet_refacing on, but
// kitchen_design never touched.
resetDbStub();
rows.company = [{ id: COMPANY, cabinetRates: null }];
setCompanyCategories(["cabinet_refinishing", "cabinet_refacing", "countertop"]);
ok("scenario C (refinishing+refacing+countertop, no kitchen_design): Cabinet Rates STILL refused",
  (await canUseCabinetRatesSettings(COMPANY)) === false);
ok("scenario C: Material Costs allowed — cabinet_refinishing has a recipe",
  (await canUseMaterialCostsSettings(COMPANY)) === true);
{
  const visible = await materialCostsVisibleCategories(COMPANY);
  ok("scenario C: Material Costs shows ONLY cabinet_refinishing, not exterior_painting",
    visible.length === 1 && visible[0] === "cabinet_refinishing", JSON.stringify(visible));
}

// Scenario D — existing-data rule, Cabinet Rates: no category enabled at all,
// but the company already saved its own rate card.
resetDbStub();
rows.company = [{ id: COMPANY, cabinetRates: { lfBase: 42, lfUpper: 38 } }];
setCompanyCategories([]);
ok("scenario D (no category enabled, but rates already saved): Cabinet Rates STILL allowed",
  (await canUseCabinetRatesSettings(COMPANY)) === true);
ok("scenario D: Material Costs is unaffected and still refused (different screen, different rule)",
  (await canUseMaterialCostsSettings(COMPANY)) === false);

// Scenario E — hasOwnRates' own edge case: an empty object is not "own rates"
// (matches lib/kitchen/rates.js's own definition — Object.keys(...).length).
resetDbStub();
rows.company = [{ id: COMPANY, cabinetRates: {} }];
setCompanyCategories([]);
ok("scenario E: an empty {} cabinetRates object does NOT count as saved rates",
  (await canUseCabinetRatesSettings(COMPANY)) === false);

// Scenario F — existing-data rule, Material Costs, PER CATEGORY: exterior
// painting was switched off, but the company already overrode its recipe.
resetDbStub();
rows.company = [{ id: COMPANY, cabinetRates: null }];
setCompanyCategories([]);
rows.materialRecipeSetting = [
  { companyId: COMPANY, categoryKey: "exterior_painting", overrides: { defaultCoats: 3 } },
];
{
  const visible = await materialCostsVisibleCategories(COMPANY);
  ok("scenario F: Material Costs allowed via a saved override alone",
    (await canUseMaterialCostsSettings(COMPANY)) === true);
  ok("scenario F: shows exactly the overridden category, not the other one",
    visible.length === 1 && visible[0] === "exterior_painting", JSON.stringify(visible));
  ok("scenario F: canUseMaterialCostsCategory allows a write to the overridden category",
    (await canUseMaterialCostsCategory(COMPANY, "exterior_painting")) === true);
  ok("scenario F: canUseMaterialCostsCategory REFUSES a write to the other (unsold, unoverridden) category",
    (await canUseMaterialCostsCategory(COMPANY, "cabinet_refinishing")) === false);
}

// Scenario G — half-relevant Material Costs: sells exactly one of the two,
// which is the case the whole-screen shape of Cabinet Rates would have
// gotten wrong if reused verbatim here (see lib/settings/tradeGate.js's
// header on granularity).
resetDbStub();
rows.company = [{ id: COMPANY, cabinetRates: null }];
setCompanyCategories(["exterior_painting"]);
{
  const visible = await materialCostsVisibleCategories(COMPANY);
  ok("scenario G: selling exactly one trade shows exactly that one card",
    visible.length === 1 && visible[0] === "exterior_painting", JSON.stringify(visible));
  ok("scenario G: the row itself is still shown (materialCosts gate true)",
    (await canUseMaterialCostsSettings(COMPANY)) === true);
}

// Scenario H — companyId missing entirely; must refuse rather than throw.
ok("canUseCabinetRatesSettings(null) refuses without throwing",
  (await canUseCabinetRatesSettings(null)) === false);
ok("canUseMaterialCostsSettings(undefined) refuses without throwing",
  (await canUseMaterialCostsSettings(undefined)) === false);
ok("companyTradeGate(null) resolves to null (unresolved, not a crash)",
  (await companyTradeGate(null)) === null);

// ── 3. The two maps cannot drift from each other ─────────────────────────

console.log("\nThe two maps agree with each other and with the sidebar\n");

{
  const gateFields = new Set(Object.keys((await companyTradeGate(COMPANY)) || {}));
  const claimedFields = Object.values(SETTINGS_ROW_TRADE_GATE);
  ok("every field SETTINGS_ROW_TRADE_GATE names is a real field of companyTradeGate's output",
    claimedFields.every((f) => gateFields.has(f)), `${[...gateFields]} vs ${claimedFields}`);
}

const settingsSrc = read("app/components/layout/SettingsSidebar.js");
const settingsGroups = sliceArray(settingsSrc, "const GROUPS = [");
const settingsItems = leafItems(settingsGroups);
const settingsKeys = new Set(settingsItems.map((i) => i.key));

{
  const stale = Object.keys(SETTINGS_ROW_TRADE_GATE).filter((k) => !settingsKeys.has(k));
  ok("SETTINGS_ROW_TRADE_GATE: every key still names a real settings row",
    stale.length === 0, stale.join(", "));
}
ok("app.settings.cabinetRates is exactly one of the two gated rows",
  "app.settings.cabinetRates" in SETTINGS_ROW_TRADE_GATE);
ok("app.settings.materialCosts is exactly one of the two gated rows",
  "app.settings.materialCosts" in SETTINGS_ROW_TRADE_GATE);
ok("no OTHER row is trade-gated — the mechanism stays narrow, per lib/settings/tradeGate.js's header",
  Object.keys(SETTINGS_ROW_TRADE_GATE).length === 2,
  Object.keys(SETTINGS_ROW_TRADE_GATE).join(", "));

// ── 4. The routes are actually wired to the lib, not just described ──────

console.log("\nThe routes call the trade gate, not just the role gate\n");

const cabinetRoute = stripComments(read("app/api/settings/cabinet-rates/route.js"));
ok("cabinet-rates route imports canUseCabinetRatesSettings from the shared module",
  cabinetRoute.includes('canUseCabinetRatesSettings') &&
    cabinetRoute.includes('from "@/lib/settings/tradeGate"'));
ok("cabinet-rates route actually CALLS it (not just imports it)",
  /canUseCabinetRatesSettings\(\s*member\.companyId\s*\)/.test(cabinetRoute));
// GET/PUT/DELETE share one requireAdmin(), so proving the call sits inside
// that function proves all three verbs are covered by one edit, not three
// that could disagree.
ok("the trade-gate call lives inside requireAdmin, which every verb calls",
  /async function requireAdmin[\s\S]*canUseCabinetRatesSettings[\s\S]*^}/m.test(cabinetRoute));

const cabinetLayout = stripComments(
  read("app/app/settings/cabinet-rates/layout.js"),
);
// Not just "both strings appear somewhere in the file" — notFound() is also
// called for a missing member, so that weaker check would still pass with the
// refusal branch below deleted. This requires the trade-gate RESULT to feed a
// notFound() call within a short span, so a mutation that keeps computing
// `allowed` but stops acting on it is caught.
ok("cabinet-rates layout actually ACTS on the trade-gate result (refuses, not just computes)",
  /canUseCabinetRatesSettings\([^)]*\)[\s\S]{0,80}notFound\(\)/.test(cabinetLayout));
ok("the page-level gate carves out impersonation, matching the route's own carve-out",
  /member\.impersonation[\s\S]{0,40}return children/.test(cabinetLayout));

const recipesRoute = stripComments(read("app/api/settings/material-recipes/route.js"));
ok("material-recipes route imports both trade-gate helpers",
  recipesRoute.includes("materialCostsVisibleCategories") &&
    recipesRoute.includes("canUseMaterialCostsCategory") &&
    recipesRoute.includes('from "@/lib/settings/tradeGate"'));
ok("GET filters its response through materialCostsVisibleCategories",
  /materialCostsVisibleCategories\(\s*member\.companyId\s*\)/.test(recipesRoute));
ok("PUT checks canUseMaterialCostsCategory before writing an override",
  /canUseMaterialCostsCategory\(\s*member\.companyId,\s*categoryKey\s*\)/.test(recipesRoute));
ok("GET still carves impersonation out, seeing every category regardless of trade",
  /member\.impersonation[\s\S]*Object\.keys\(MATERIAL_RECIPES\)/.test(recipesRoute));

const sidebarSrc = stripComments(settingsSrc);
ok("SettingsSidebar imports the trade-gate filter",
  sidebarSrc.includes("filterSettingsGroupsByTrade") &&
    sidebarSrc.includes('from "@/lib/settings/tradeGateNav"'));
ok("SettingsSidebar actually applies the filter in its groups computation",
  /filterSettingsGroupsByTrade\(/.test(sidebarSrc));
ok("SettingsSidebar accepts tradeGate as a prop rather than hardcoding it",
  /function SettingsSidebar\(\{[^}]*tradeGate/.test(sidebarSrc));

const layoutSrc = stripComments(read("app/app/settings/layout.js"));
ok("the settings layout resolves the company's trade gate server-side",
  layoutSrc.includes("companyTradeGate"));
ok("the settings layout passes it to SettingsSidebar",
  /<SettingsSidebar[^>]*tradeGate=\{tradeGate\}/.test(layoutSrc));

// ── 5. Translations ────────────────────────────────────────────────────

console.log("\nTranslations\n");

ok("app.setMaterialCosts.noneApplicable exists in English",
  "app.setMaterialCosts.noneApplicable" in APP_MESSAGES.en);
ok("app.setMaterialCosts.noneApplicable exists in French",
  "app.setMaterialCosts.noneApplicable" in APP_MESSAGES.fr);
ok("the empty-state message is actually rendered by the page",
  read("app/app/settings/material-costs/page.js").includes(
    't("app.setMaterialCosts.noneApplicable")',
  ));

console.log(`\n${checks} checks, ${failures} failure(s).`);
process.exit(failures ? 1 : 0);
