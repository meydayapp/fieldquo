// scripts/check-rbac-sideDoors.mjs
//
// A gate on one door and not the other is worse than no gate: the fix reads as
// done. These assert the doors that were found standing open AFTER the
// headline route beside each one had already been closed.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-rbac-sideDoors.mjs

import { validateInvite } from "@/lib/permissions/inviteGuard";
import { readFileSync } from "node:fs";

let fail = 0;
const t = (name, got, want = true) => {
  const ok = String(got) === String(want);
  if (!ok) fail++;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${ok ? "" : `  got=${got} want=${want}`}`);
};
const read = (r) => readFileSync(new URL(r, import.meta.url), "utf8");
const gated = (r, ...patterns) => {
  const s = read(r);
  return patterns.some((p) => new RegExp(p).test(s));
};

const MANAGER = { role: "supervisor", permissions: { payroll: "view_own" } };
const OWNER = { role: "owner", permissions: {} };

console.log("\nBoth invite routes share ONE guard");
// /api/settings/members was hardened after QA created an Administrator from a
// Manager account. /api/team/quick-add writes the same PendingTeamProfile and
// got none of it — so the same escalation survived in the sibling route.
t("a Manager cannot invite an admin", validateInvite({ actor: MANAGER, role: "admin" }).ok, false);
t("a Manager cannot invite a peer", validateInvite({ actor: MANAGER, role: "supervisor" }).ok, false);
t("a Manager can invite a Worker", validateInvite({ actor: MANAGER, role: "employee" }).ok, true);
t("isAdministrator is refused separately",
  validateInvite({ actor: MANAGER, role: "employee", permissions: { isAdministrator: true } }).ok, false);
t("a granted level above the actor's is clamped",
  validateInvite({ actor: MANAGER, role: "employee", permissions: { payroll: "run_payroll" } })
    .permissions.payroll, "view_own");
t("a Manager cannot set a pay rate",
  validateInvite({ actor: MANAGER, role: "employee", laborCostPerHour: 99 }).laborCostPerHour, null);
t("an owner can", validateInvite({ actor: OWNER, role: "admin", laborCostPerHour: 99 }).laborCostPerHour, 99);

for (const [label, r] of [
  ["settings/members", "../app/api/settings/members/route.js"],
  ["team/quick-add", "../app/api/team/quick-add/route.js"],
]) {
  t(`${label} calls the shared guard`, gated(r, "validateInvite\\("));
  t(`${label} does not re-implement it`, !gated(r, "assignableRoles\\(member\\.role\\)"));
}
t("quick-add clamps the Worker row's rate too",
  gated("../app/api/team/quick-add/route.js", "hourlyRate: vetted\\.laborCostPerHour"));

console.log("\nEvery door into the company's Stripe account has the same lock");
for (const d of ["login-link", "disconnect", "refresh"]) {
  t(`stripe/connect/${d} requires a billing admin`,
    gated(`../app/api/stripe/connect/${d}/route.js`, "isBillingAdmin|requirePermission"));
}

console.log("\nMoney movement is payroll authority, not 'may manage people'");
// The comment said owner/admin-only; the code said user:manage, which
// supervisors hold.
t("running payouts requires a payroll admin",
  gated("../app/api/payouts/route.js", "isPayrollAdmin\\(member\\.role\\)"));
t("...and no longer only user:manage",
  !gated("../app/api/payouts/route.js", 'requirePermission\\(member\\.role, "user:manage"\\); // owner'));

console.log("\nMutations gated and reads open — the shape most of these took");
const openReads = [
  ["salaries", "../app/api/salaries/route.js"],
  ["debt", "../app/api/debt/route.js"],
  ["overhead/fixed-costs", "../app/api/overhead/fixed-costs/route.js"],
  ["expenses/summary", "../app/api/expenses/summary/route.js"],
  ["payouts", "../app/api/payouts/route.js"],
];
for (const [label, r] of openReads) {
  const s = read(r);
  const get = s.slice(s.indexOf("export async function GET"));
  const body = get.slice(0, get.indexOf("\n}\n") + 3);
  t(`GET /${label} checks authority`,
    /requirePermission|requireLevel|hasLevel|isPayrollAdmin|isBillingAdmin/.test(body));
}

console.log("\nThe orphaned template CRUD is no longer open");
// No UI calls these, and they write the same rows
// /api/settings/document-templates guards. An orphan is not proof nothing
// reaches it, so they are gated rather than deleted.
for (const r of ["../app/api/templates/route.js", "../app/api/templates/[id]/route.js"]) {
  const s = read(r);
  const handlers = (s.match(/export async function (GET|POST|PATCH|PUT|DELETE)/g) || []).length;
  const guards = (s.match(/requirePermission\(member\.role/g) || []).length;
  t(`${r.split("/").slice(-2).join("/")}: every handler gated (${guards}/${handlers})`,
    handlers > 0 && guards >= handlers);
}

console.log(fail ? `\n${fail} FAILED\n` : "\nALL PASS — the side doors are locked too\n");
process.exit(fail ? 1 : 0);
