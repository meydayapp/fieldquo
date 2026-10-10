// scripts/check-services-trade-filter.mjs
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-services-trade-filter.mjs
//
// Settings › Services & pricing hid TrueFinish's ENABLED Roofing and Siding
// behind "Show other trades", because the trade preset filtered every system
// category, switched on or not. The owner: "all of the ones I have selected
// should already be displayed in Services & pricing".
//
// Executes lib/services/tradeFilter.js — the function the editor calls — and
// then asserts the editor still calls it, so a revert to an inline filter
// fails here rather than in front of a contractor.

import { readFileSync } from "node:fs";
import {
  filterServiceCategories,
  hiddenByTradePreset,
  countHiddenByTradePreset,
} from "@/lib/services/tradeFilter";

let pass = 0;
const failures = [];
// Label first — reversed, a non-empty string is the condition and nothing fails.
const ok = (label, cond, detail) =>
  cond ? (pass++, undefined) : failures.push(detail === undefined ? label : `${label} — ${JSON.stringify(detail)}`);

const sys = (key, label, enabled) => ({ id: key, key, label, isSystem: true, enabled });
// A cabinet company's preset.
const presetKeys = ["cabinet_painting", "kitchen_design"];
const categories = [
  sys("cabinet_painting", "Cabinet Painting", true),
  sys("kitchen_design", "Kitchen Design & New Installs", false),
  sys("roofing", "Roofing", true), // enabled, outside the preset — the bug
  sys("siding", "Siding", true), // enabled, outside the preset — the bug
  sys("pool_cleaning", "Pool Cleaning", false), // disabled, outside — stays hidden
  { id: "c1", key: null, label: "Custom Closet Builds", isSystem: false, enabled: false },
];
const keys = (list) => list.map((c) => c.key ?? c.id);

// 1. Enabled out-of-trade categories show with the toggle off.
const off = keys(filterServiceCategories(categories, { presetKeys, showAllTrades: false }));
ok("enabled Roofing visible with the toggle off", off.includes("roofing"), off);
ok("enabled Siding visible with the toggle off", off.includes("siding"), off);
ok("in-preset enabled visible", off.includes("cabinet_painting"), off);
ok("in-preset disabled visible", off.includes("kitchen_design"), off);

// 2. A disabled out-of-trade category is hidden.
ok("disabled Pool Cleaning hidden with the toggle off", !off.includes("pool_cleaning"), off);
ok("hiddenByTradePreset says so", hiddenByTradePreset(categories[4], { presetKeys }) === true);
ok("enabled out-of-trade never hiddenByTradePreset", hiddenByTradePreset(categories[2], { presetKeys }) === false);

// The toggle reveals it.
const on = keys(filterServiceCategories(categories, { presetKeys, showAllTrades: true }));
ok("toggle on shows everything", on.length === categories.length, on);

// 3. Search still narrows — including enabled and custom categories.
const roof = keys(filterServiceCategories(categories, { presetKeys, search: "  ROOF " }));
ok("search 'roof' finds only Roofing", roof.length === 1 && roof[0] === "roofing", roof);
const sid = keys(filterServiceCategories(categories, { presetKeys, search: "cabinet" }));
ok("search excludes enabled non-matches", !sid.includes("roofing") && !sid.includes("siding"), sid);
const pool = keys(filterServiceCategories(categories, { presetKeys, search: "pool" }));
ok("search does not override the preset for a disabled other trade", pool.length === 0, pool);
const poolOn = keys(filterServiceCategories(categories, { presetKeys, search: "pool", showAllTrades: true }));
ok("search + toggle finds the disabled other trade", poolOn.length === 1, poolOn);
const none = keys(filterServiceCategories(categories, { presetKeys, search: "zzz" }));
ok("search with no match is empty", none.length === 0, none);

// 4. Custom categories pass the trade filter, enabled or not.
ok("disabled custom category visible", off.includes("c1"), off);

// 5. The empty preset shows everything.
const noPreset = keys(filterServiceCategories(categories, { presetKeys: [] }));
ok("empty preset shows everything", noPreset.length === categories.length, noPreset);
const junkPreset = keys(filterServiceCategories(categories, { presetKeys: undefined }));
ok("missing preset shows everything", junkPreset.length === categories.length, junkPreset);
ok("no categories → empty list", filterServiceCategories(undefined, { presetKeys }).length === 0);

// Order is preserved.
ok("order preserved", JSON.stringify(off) === JSON.stringify(["cabinet_painting", "kitchen_design", "roofing", "siding", "c1"]), off);

// The "Show other trades" button counts only what it would reveal.
ok("count is only disabled out-of-trade", countHiddenByTradePreset(categories, { presetKeys }) === 1);
const allOn = categories.map((c) => ({ ...c, enabled: true }));
ok("nothing to reveal when every out-of-trade one is enabled", countHiddenByTradePreset(allOn, { presetKeys }) === 0);
ok("no preset → nothing hidden", countHiddenByTradePreset(categories, { presetKeys: [] }) === 0);

// Wiring: the editor uses the shared rule, not an inline copy.
const editor = readFileSync(new URL("../app/app/settings/services/ServicesEditor.js", import.meta.url), "utf8");
ok("ServicesEditor calls filterServiceCategories", /filterServiceCategories\(categories,/.test(editor));
ok("ServicesEditor gates the toggle on countHiddenByTradePreset", /countHiddenByTradePreset\(categories,/.test(editor));
ok("no inline presetKeys.includes left in ServicesEditor", !/presetKeys\.includes\(/.test(editor));

if (failures.length) {
  console.error(`✗ services trade filter: ${failures.length} failed, ${pass} passed`);
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log(`✓ services trade filter: ${pass} checks passed`);
