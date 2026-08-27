// scripts/check-access-editor.mjs
//
// The owner reported that the two team screens offered different roles:
//
//   New User     Worker (limited access) / Worker / Dispatcher / Manager / Custom
//   Manage Team  Worker / Manager / Administrator
//
// Renaming the labels could not fix that, because the screens were not
// offering the same KIND of thing. New User configured ACCESS — a preset plus
// ten permission categories and three toggles. Manage Team edited a ROLE, and
// nothing else.
//
// Which meant permissions were WRITE-ONCE. A "Worker (limited access)" could
// never become a full-view Worker. A Dispatcher and a Manager were
// indistinguishable once created, both showing as "Manager". "Custom" was
// unreachable for anyone already on the team.
//
// Both screens render one component now. These assert that, and that the
// preset/role mapping stays coherent — a preset IS a role plus a grid, and
// letting the two disagree is what produced a "Manager" holding admin.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-access-editor.mjs

import {
  PERMISSION_PRESETS,
  PERMISSION_CATEGORIES,
  PERMISSION_TOGGLES,
  PRESET_TO_ROLE,
} from "@/lib/permissions";
import {
  emptyPermissionValues,
  presetForValues,
} from "@/lib/permissions/accessPresets";
import { readFileSync } from "node:fs";

let fail = 0;
const t = (name, got, want = true) => {
  const ok = String(got) === String(want);
  if (!ok) fail++;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${ok ? "" : `  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`}`);
};
const read = (r) => readFileSync(new URL(r, import.meta.url), "utf8");

console.log("\nBoth screens render the same editor");
const NEW = read("../app/app/settings/team/new/page.js");
const TEAM = read("../app/app/settings/team/page.js");
t("New User uses AccessEditor", /<AccessEditor/.test(NEW));
t("Manage Team uses AccessEditor", /<AccessEditor/.test(TEAM));
t("New User no longer has its own preset grid", !/PERMISSION_PRESETS\)\s*\n?\s*\.filter/.test(NEW));
t("Manage Team can edit access at all", /openAccess\(/.test(TEAM));
t("...and saves permissions, not only a role", /permissions: isAdministrator/.test(TEAM));

console.log("\nEvery preset is reachable and lands on a real role");
for (const [key, preset] of Object.entries(PERMISSION_PRESETS)) {
  const role = PRESET_TO_ROLE[key];
  t(`"${preset.label}" maps to a role`, Boolean(role));
  t(`"${preset.label}" has a grid`, Object.keys(preset.values || {}).length > 0);
}
t("the five presets the owner listed all exist",
  ["worker", "estimator", "dispatcher", "manager"].every((k) => PERMISSION_PRESETS[k]));

console.log("\nA stored grid resolves back to the preset that made it");
// This is what lets the panel open showing "Dispatcher" for someone created
// as one — the owner's actual question: which of these is this person?
for (const [key, preset] of Object.entries(PERMISSION_PRESETS)) {
  const stored = { ...emptyPermissionValues(), ...preset.values };
  t(`"${preset.label}" round-trips`, presetForValues(stored, PRESET_TO_ROLE[key]), key);
}

console.log("\n...and a tweaked grid reads as custom, not as a preset");
const dispatcher = { ...emptyPermissionValues(), ...PERMISSION_PRESETS.dispatcher.values };
const tweaked = { ...dispatcher, payroll: "run_payroll" };
t("an extra grant is not still 'Dispatcher'",
  presetForValues(tweaked, PRESET_TO_ROLE.dispatcher), null);
const lowered = { ...dispatcher };
const firstCat = Object.keys(PERMISSION_CATEGORIES)[0];
lowered[firstCat] = PERMISSION_CATEGORIES[firstCat].levels[0].value;
t("a lowered dial is not still 'Dispatcher'",
  presetForValues(lowered, PRESET_TO_ROLE.dispatcher) === "dispatcher", false);

console.log("\nThe two Worker presets are genuinely different");
// They share a role, so the ROLE dropdown could never tell them apart — which
// is exactly why an access editor was needed rather than a relabelled select.
t("both are the same role", PRESET_TO_ROLE.worker === PRESET_TO_ROLE.estimator);
t("but they grant different things",
  JSON.stringify(PERMISSION_PRESETS.worker.values) !==
    JSON.stringify(PERMISSION_PRESETS.estimator.values));
t("limited access really is more limited",
  PERMISSION_PRESETS.worker.values.showPricing !== true);
t("full-view really does show pricing",
  PERMISSION_PRESETS.estimator.values.showPricing === true);
// Same for the two that share `supervisor`.
t("Dispatcher and Manager share a role",
  PRESET_TO_ROLE.dispatcher === PRESET_TO_ROLE.manager);
t("but grant different things",
  JSON.stringify(PERMISSION_PRESETS.dispatcher.values) !==
    JSON.stringify(PERMISSION_PRESETS.manager.values));

console.log("\nManage Team offers the SAME list as New User, in ONE control");
// The owner hit this twice: a three-entry ROLE dropdown here versus five
// presets on the invite screen, and then — briefly — a dropdown AND a separate
// "Edit access" link, which is two controls for one concept.
t("the row dropdown is built from presets, not roles", /choicesFor\(m\)/.test(TEAM));
t("every assignable preset is offered", /Object\.entries\(PERMISSION_PRESETS\)/.test(TEAM));
t("Administrator is offered when assignable", /assignable\.includes\("admin"\)/.test(TEAM));
t("Custom opens the grid", /choice === CUSTOM\) return openAccess/.test(TEAM));
t("picking a preset applies its permissions too, not just the role",
  /permissions,\s*\n\s*\}\),/.test(TEAM) && /PERMISSION_PRESETS\[choice\]\.values/.test(TEAM));
t("a member's CURRENT choice stays selectable even if unassignable",
  /disabled: true/.test(TEAM));
t("there is no longer a second 'Edit access' link beside it",
  !/app\.setTeam\.editAccess"/.test(TEAM));
t("the orphaned role-only handler is gone", !/async function updateRole/.test(TEAM));

console.log("\nCustom is a control, not a side effect");
const EDITOR = read("../app/components/team/AccessEditor.js");
t("Custom is a button you can press", /onClick=\{\(\) => onPresetChange\(null\)\}/.test(EDITOR));

console.log("\nEmpty values cover every dial");
const empty = emptyPermissionValues();
for (const key of Object.keys(PERMISSION_CATEGORIES))
  t(`${key} starts at its lowest level`, empty[key], PERMISSION_CATEGORIES[key].levels[0].value);
for (const key of Object.keys(PERMISSION_TOGGLES))
  t(`${key} starts off`, empty[key], false);

console.log("\nHostile input");
t("no values", presetForValues(null), null);
t("junk", presetForValues("nope"), null);
t("empty object matches nothing meaningful", presetForValues({}, "employee") === "manager", false);

console.log(fail ? `\n${fail} FAILED\n` : "\nALL PASS — one editor, and access can be changed after hiring\n");
process.exit(fail ? 1 : 0);
