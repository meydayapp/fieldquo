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
  // requireCostBasisRead joined the list when the overhead trio moved onto the
  // shared rule in lib/permissions/costBasis.js. Named here rather than
  // loosened to "anything that throws", because the whole value of this
  // assertion is that it enumerates what a gate looks like in this codebase.
  t(`GET /${label} checks authority`,
    /requirePermission|requireLevel|hasLevel|requireCostBasisRead|isPayrollAdmin|isBillingAdmin/.test(body));
}

console.log("\nloadEnforceableMember is called with (db, memberId) everywhere");
// GET /api/products called it as loadEnforceableMember(member) — one argument.
// `memberId` was undefined, the helper returned null (deliberately: a check
// that can't identify the caller refuses), requireToggle threw, and the route
// answered 403 to EVERYONE including the owner. It looked like an empty price
// book because the page ignored res.ok.
//
// Grepped rather than executed: the failure is an arity mistake, and arity is
// visible in the source.
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".js")) out.push(p);
  }
  return out;
}
const root = new URL("../", import.meta.url).pathname;
const bad = [];
for (const f of [...walk(join(root, "app")), ...walk(join(root, "lib"))]) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/loadEnforceableMember\(([^)]*)\)/g)) {
    const args = m[1].trim();
    if (!args || args.startsWith("db,") || args.startsWith("db ,")) continue;
    if (/^db\b/.test(args)) continue;
    bad.push(`${f.replace(root, "")}: loadEnforceableMember(${args})`);
  }
}
t(`every call site passes (db, …)${bad.length ? " — " + bad.join("; ") : ""}`, bad.length, 0);
t("the price book route specifically",
  /loadEnforceableMember\(db, member\.id\)/.test(read("../app/api/products/route.js")));
t("the products page surfaces a refusal instead of an empty list",
  /loadError/.test(read("../app/app/settings/products/page.js")));

console.log("\nRank applies to every field, not just the active flag");
// The lockout fix was scoped to `active === false`, which left the sideways
// edit open: a supervisor could PATCH the OWNER's row and rewrite their phone,
// home address and pay rate.
const MEMBERS = read("../app/api/settings/members/route.js");
t("PATCH refuses editing someone at or above your rank",
  /userId !== member\.userId && rankOf\(target\.role\) >= rankOf\(member\.role\)/.test(MEMBERS));
t("...but you can still edit yourself", /userId !== member\.userId/.test(MEMBERS));
t("PATCH clamps the pay rate like POST does",
  /laborCostPerHour !== undefined/.test(MEMBERS) &&
  /hasLevel\(actor, "payroll", "view_all"\)/.test(MEMBERS));
t("the comment no longer claims a Manager may set a rate",
  !/still set a labour rate — everything/.test(MEMBERS));

console.log("\nThe client DETAIL route redacts like the list beside it");
// QA enumerated ids from the correctly-restricted list, then pulled each
// detail and harvested every customer's email and phone. The exportable
// customer list, reached through the one door nobody checked.
const CLIENT_DETAIL = read("../app/api/clients/[id]/route.js");
t("GET applies redactClient", /redactClient\(full, client\)/.test(CLIENT_DETAIL));
t("...and redacts the nested quotes' share tokens",
  /redactQuotes\(full, client\.quotes\)/.test(CLIENT_DETAIL));

console.log("\nToggles gate the READ, not only the write");
const PAY = read("../app/api/payments/route.js");
const payGet = PAY.slice(PAY.indexOf("export async function GET"));
t("GET /api/payments requires the payments toggle",
  /requireToggle\(full, "payments"/.test(payGet.slice(0, payGet.indexOf("export async function POST"))));

console.log("\nCross-user mutations are scoped to the person");
const VISIT = read("../app/api/jobs/[id]/visits/[visitId]/route.js");
t("a visit can only be updated by its assignee (or schedule edit_all)",
  /hasLevel\(full, "schedule", "edit_all"\)/.test(VISIT));
t("...unassigned visits stay claimable", /visit\.assignedToId !== null/.test(VISIT));
const TASK = read("../app/api/tasks/[id]/route.js");
t("a to-do can only be edited by its owner (or someone who may create them)",
  /can\(member\.role, "task:create"\)/.test(TASK));
t("...your own stays editable with no permission", /existing\.assignedToId === member\.userId/.test(TASK));

console.log("\nThe quick-add menu is filtered by permission, not only by flag");
// NAV_REQUIREMENTS has carried app.quickAdd.quote since it was written, with a
// comment about losing a composed quote to a 403 — and the sidebar ran the
// list through the FEATURE-FLAG filter alone, so it never applied.
const SIDEBAR = read("../app/components/layout/AdminSidebar.js");
t("quick-add runs through filterNavItemsByPermission",
  /quickAddItems[\s\S]{0,200}filterNavItemsByPermission/.test(SIDEBAR));
t("the Create button hides when nothing is creatable",
  /quickAddItems\.length > 0 && \(/.test(SIDEBAR));
const PRODUCTS_PAGE = read("../app/app/settings/products/page.js");
t("a refused price book hides its Add/Import/Export controls",
  /\{!loadError && \(/.test(PRODUCTS_PAGE));

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
