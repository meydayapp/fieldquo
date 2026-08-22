// scripts/check-role-vocabulary.mjs
//
// The invite screen offered "Worker / Dispatcher / Manager". Manage Team showed
// "Employee / Supervisor / Admin" for the same people. Nothing on either screen
// connected the two, so the owner invited a Manager, later saw "Admin", and
// concluded the member had escalated their own role — which is the correct
// reading of what the UI said.
//
// Two causes, both guarded here:
//   1. ROLE_LABELS was duplicated inside app/app/settings/team/page.js, so the
//      two screens were free to disagree.
//   2. The "Manager" preset mapped to `admin`, and `admin` is in
//      UNRESTRICTED_ROLES — so the preset's grid was written, shown, and then
//      ignored. Its description promised "excludes payroll"; the member got
//      full payroll, every pay rate, and the power to cancel the subscription.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-role-vocabulary.mjs

import { PERMISSION_PRESETS, PRESET_TO_ROLE } from "@/lib/permissions";
import { UNRESTRICTED_ROLES } from "@/lib/permissions/enforce";
import { ROLE_LABELS, ROLE_RANK, assignableRoles } from "@/lib/permissions/roleManagement";
import { readFileSync } from "node:fs";

let fail = 0;
const t = (name, got, want = true) => {
  const ok = String(got) === String(want);
  if (!ok) fail++;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${ok ? "" : `  got=${got} want=${want}`}`);
};
const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");

console.log("\nA preset never lands on a role that ignores its grid");
const unrestricted = UNRESTRICTED_ROLES; // the real set, not a copy
for (const [preset, role] of Object.entries(PRESET_TO_ROLE)) {
  const hasGrid = Object.keys(PERMISSION_PRESETS[preset]?.values || {}).length > 0;
  t(`"${PERMISSION_PRESETS[preset]?.label}" → ${role} — grid is honoured`,
    !(hasGrid && unrestricted.has(role)));
}
t("manager specifically is no longer an admin", PRESET_TO_ROLE.manager !== "admin");
t("manager maps to a role the grid applies to", !unrestricted.has(PRESET_TO_ROLE.manager));

console.log("\nThe Manager preset's description matches what it actually grants");
const mgr = PERMISSION_PRESETS.manager;
t("payroll is restricted in the grid", mgr.values.payroll === "view_own");
t("...and the description no longer promises billing",
  !/including billing/i.test(mgr.description));
t("...and does say payroll is excluded", /payroll/i.test(mgr.description));
// supervisor is not owner|admin, so isBillingAdmin() refuses it. The description
// would be lying again if manager were ever remapped upward.
t("the role it maps to cannot reach billing",
  !["owner", "admin"].includes(PRESET_TO_ROLE.manager));

console.log("\nEvery role a person can be shown has exactly one name");
for (const role of Object.keys(ROLE_RANK)) t(`${role} has a label`, Boolean(ROLE_LABELS[role]));
t("no two roles share a label",
  new Set(Object.values(ROLE_LABELS)).size === Object.keys(ROLE_LABELS).length);
t("the vocabulary is job titles, not the enum",
  ROLE_LABELS.employee === "Worker" && ROLE_LABELS.supervisor === "Manager");

console.log("\nOne definition, not one per screen");
const teamPage = read("../app/app/settings/team/page.js");
t("Manage Team does not redefine ROLE_LABELS", !/const ROLE_LABELS\s*=/.test(teamPage));
t("Manage Team does not redefine ROLE_RANK", !/const ROLE_RANK\s*=/.test(teamPage));
t("Manage Team imports the shared map",
  /from "@\/lib\/permissions\/roleManagement"/.test(teamPage));

console.log("\nWherever a preset is offered, it says which tier it creates");
// The full new-member page used to render this itself. It now renders
// AccessEditor, which both it and Manage Team share — so the assertion follows
// the responsibility rather than the file it used to live in.
for (const [file, rel] of [
  ["quick-add modal", "../app/components/team/AddEmployeeModal.js"],
  ["shared access editor", "../app/components/team/AccessEditor.js"],
]) {
  const src = read(rel);
  t(`${file} shows the tier`, /ROLE_LABELS\[PRESET_TO_ROLE\[/.test(src));
  t(`${file} imports it from the shared map`,
    /ROLE_LABELS.*from "@\/lib\/permissions\/roleManagement"/.test(src));
}
// And the page that dropped it really did hand the job over, rather than
// simply losing it.
t("the new-member page delegates to the editor",
  /<AccessEditor/.test(read("../app/app/settings/team/new/page.js")));

console.log("\nWhat a Manager can hand out");
// Strictly below themselves — a Manager can create Workers and nothing more.
t("a Manager cannot assign Administrator", !assignableRoles("supervisor").includes("admin"));
t("a Manager cannot assign another Manager", !assignableRoles("supervisor").includes("supervisor"));
t("a Manager can assign a Worker", assignableRoles("supervisor").includes("employee"));

console.log("\nThe old vocabulary is gone from what people read");
const msgs = read("../app/i18n/appMessages.js");
t("no approval string still says 'supervisor, admin or owner'",
  !/a supervisor, admin or owner/i.test(msgs));
t("no permission string still says 'owner, admin or supervisor'",
  !/an owner, admin or supervisor/i.test(msgs));
// Different concepts that must NOT have been swept up: a job site needing a
// senior supervisor present, and the employee-vs-contractor tax classification.
t("job-site supervisor wording is untouched", /senior supervisor on site/i.test(msgs));
t("employee-vs-contractor tax wording is untouched",
  /Employee or contractor isn't editable here/i.test(msgs));

console.log(fail ? `\n${fail} FAILED\n` : "\nALL PASS — one vocabulary, and no preset outranks its own grid\n");
process.exit(fail ? 1 : 0);
