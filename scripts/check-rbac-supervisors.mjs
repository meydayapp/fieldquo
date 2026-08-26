// scripts/check-rbac-supervisors.mjs
//
//   npm run check:rbac-supervisors
//
// The two supervisor-level personas, executed.
//
// Dispatcher and Manager both sit on Member.role "supervisor", which is NOT in
// UNRESTRICTED_ROLES — so unlike an owner or admin, everything they can do is
// decided by the grid on their Member row. That makes them the pair where a
// dial being wrong is invisible: they hold enough for the app to look normal
// and not enough for a missing gate to be obvious.
//
// The fixtures below are NOT copies of the matrix. They are built from
// PERMISSION_PRESETS and PRESET_TO_ROLE at run time, so editing a preset moves
// these assertions with it rather than leaving them asserting last month's
// product. The few places a LITERAL level appears are the ones the assertion
// is about — "payroll is view_own for both" has to name view_own or it says
// nothing.
//
// Existing coverage this deliberately does not repeat:
//   check:rbac-redaction   — the client/quote payload shaping
//   check:rbac-side-doors  — the invite guard, the arity bug, the orphan CRUD
//   check:rbac-nav         — which rails are drawn
//   check:settings-access  — which settings rows are drawn and what they fetch
//   check:job-deletion     — jobs specifically, end to end
//   check:role-vocabulary  — that no preset lands on an unrestricted role
import { readFileSync } from "node:fs";
import {
  PERMISSION_PRESETS,
  PRESET_TO_ROLE,
  PERMISSION_CATEGORIES,
} from "@/lib/permissions";
import {
  UNRESTRICTED_ROLES,
  hasLevel,
  hasToggle,
  canSeeAllPay,
  redactPay,
  redactPayList,
  scopeFilter,
} from "@/lib/permissions/enforce";
import { validateInvite } from "@/lib/permissions/inviteGuard";
import { isBillingAdmin } from "@/lib/billing/billingAdmin";
import { isPayrollAdmin } from "@/lib/permissions/settingsAccess";

let pass = 0;
const failures = [];
const t = (label, got, want = true) => {
  const ok = String(got) === String(want);
  if (ok) {
    pass += 1;
    console.log(`  ok   ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL ${label}  got=${got} want=${want}`);
  }
};
const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");
// Source assertions are used only where the claim is about WHICH helper a
// route calls. Everything answerable by running a function is run.
const src = (rel, pattern) => new RegExp(pattern).test(read(rel));

// ── The two personas, built from the shipped presets ──────────────────────
const asMember = (preset) => ({
  id: `m_${preset}`,
  role: PRESET_TO_ROLE[preset],
  permissions: { ...PERMISSION_PRESETS[preset].values },
});
const DISPATCHER = asMember("dispatcher");
const MANAGER = asMember("manager");
const BOTH = [
  ["Dispatcher", DISPATCHER],
  ["Manager", MANAGER],
];
const OWNER = { id: "m_owner", role: "owner", permissions: null };
const WORKER = asMember("worker");

const DISPATCHER_USER = "u_dispatch";
const COLLEAGUE_USER = "u_colleague";

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n2. Manager is a supervisor, and the grid therefore applies\n");
// Manager used to map to `admin`. While it did, hasLevel/hasToggle returned
// true for everything before ever reading the grid, so every assertion below
// this line would have passed vacuously. This is the guard that keeps the rest
// of the file meaningful.
for (const [label, m] of BOTH) {
  t(`${label} is role "supervisor"`, m.role, "supervisor");
  t(`${label}'s role is not unrestricted`, !UNRESTRICTED_ROLES.has(m.role));
  t(`${label} carries a real grid`, Object.keys(m.permissions).length > 0);
}
t("the grid is actually consulted for a supervisor (control)",
  hasLevel(MANAGER, "payroll", "view_all"), false);
t("...and skipped for an owner (control)", hasLevel(OWNER, "payroll", "view_all"));
// Every category in the editor is set by both presets — an unset category
// falls open by design (hasLevel returns true), so a preset that forgot one
// would grant it silently.
for (const category of Object.keys(PERMISSION_CATEGORIES)) {
  for (const [label, m] of BOTH) {
    t(`${label} has an explicit ${category} level`,
      m.permissions[category] !== undefined);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n1a. Payroll is view_own for BOTH — the READ side\n");
for (const [label, m] of BOTH) {
  t(`${label} payroll level`, m.permissions.payroll, "view_own");
  t(`${label} cannot see everyone's pay`, canSeeAllPay(m), false);
}
t("an owner can", canSeeAllPay(OWNER));

// The three payload shapes QA read a colleague's rate out of. Executed against
// the real redactor rather than asserted about it: if the stripping in
// redactPay is removed, these fail.
const WORKERS_ROW = {
  id: "w1", userId: COLLEAGUE_USER, name: "Marc", type: "employee",
  hourlyRate: 25, active: true,
};
const OWN_WORKERS_ROW = { ...WORKERS_ROW, id: "w2", userId: DISPATCHER_USER, name: "Léa", hourlyRate: 31 };
const MEMBERS_ROW = {
  id: "mem1", userId: COLLEAGUE_USER, name: "Marc", role: "employee",
  laborCostPerHour: 25, phone: "819-238-7263",
};
const TIME_ENTRY = {
  id: "te1", workerId: "w1", hours: 7.5, jobId: "j1",
  worker: { id: "w1", name: "Marc", hourlyRate: 25, userId: COLLEAGUE_USER },
};

for (const [label, m] of BOTH) {
  const list = redactPayList(m, [WORKERS_ROW, OWN_WORKERS_ROW], { ownUserId: DISPATCHER_USER });
  // `in`, not `=== undefined`: the default parameter on t() swallows an
  // explicit undefined and compares against true instead, so an absence
  // assertion has to be written as a boolean.
  t(`${label}: GET /api/workers hides a colleague's rate`, !("hourlyRate" in list[0]));
  t(`${label}: ...and says so rather than reading as unset`, list[0].payHidden, true);
  t(`${label}: ...but keeps their OWN rate`, list[1].hourlyRate, 31);
  t(`${label}: ...and the row is otherwise intact`, list[0].name, "Marc");

  const mem = redactPay(m, MEMBERS_ROW, { fields: ["laborCostPerHour"], ownUserId: DISPATCHER_USER });
  t(`${label}: GET /api/settings/members hides the labour cost`,
    !("laborCostPerHour" in mem));
  t(`${label}: ...marked hidden`, mem.payHidden, true);

  const te = redactPay(m, TIME_ENTRY, { ownUserId: DISPATCHER_USER });
  t(`${label}: GET /api/time-entries hides the NESTED worker rate`,
    !("hourlyRate" in te.worker));
  t(`${label}: ...while the hours survive`, te.hours, 7.5);
  t(`${label}: ...and the source row is not mutated`, TIME_ENTRY.worker.hourlyRate, 25);
}
t("an owner still reads the rate", redactPayList(OWNER, [WORKERS_ROW])[0].hourlyRate, 25);

// The three routes above have to be the ones calling it.
t("GET /api/workers redacts",
  src("../app/api/workers/route.js", "redactPayList\\(full, workers"));
t("GET /api/workers/[id] redacts the single row too",
  src("../app/api/workers/[id]/route.js", "redactPay\\(full, worker"));
t("...and does not even FETCH payouts without pay access",
  src("../app/api/workers/[id]/route.js", "seesPay\\s*\\n?\\s*\\?\\s*\\{ payouts"));
t("GET /api/settings/members redacts laborCostPerHour",
  src("../app/api/settings/members/route.js", 'fields: \\["laborCostPerHour"\\]'));
t("GET /api/settings/members/pending redacts it as well",
  src("../app/api/settings/members/pending/route.js", 'fields: \\["laborCostPerHour"\\]'));
t("GET /api/time-entries redacts",
  src("../app/api/time-entries/route.js", "redactPayList\\(full, entries"));

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n1b. Payroll — the WRITE side, which is the worse half\n");
// Reading a colleague's rate was the reported bug. Setting one is what QA
// actually did ($25 -> $26, and it stuck).
for (const [label, m] of BOTH) {
  const vetted = validateInvite({ actor: m, role: "employee", laborCostPerHour: 99 });
  t(`${label} cannot set a rate on an invite`, vetted.laborCostPerHour, null);
  t(`${label} cannot grant themselves payroll on the way past`,
    validateInvite({ actor: m, role: "employee", permissions: { payroll: "run_payroll" } })
      .permissions.payroll, "view_own");
}
t("an owner can set a rate", validateInvite({ actor: OWNER, role: "employee", laborCostPerHour: 99 }).laborCostPerHour, 99);

// Each write door asks canSeeAllPay before the rate reaches the column.
t("PATCH /api/workers/[id] refuses hourlyRate",
  src("../app/api/workers/[id]/route.js",
    "hourlyRate !== undefined && !canSeeAllPay\\(full\\)"));
// POST was the door PATCH left open: same field, same permission, one verb
// along. A Manager could create the Worker row for a colleague who had none
// and set their pay on the way in.
t("POST /api/workers refuses hourlyRate too",
  src("../app/api/workers/route.js", "!canSeeAllPay\\(full\\)"));
t("...before the create, not after",
  read("../app/api/workers/route.js").indexOf("canSeeAllPay(full)") <
    read("../app/api/workers/route.js").indexOf("db.worker.create"));
t("POST /api/settings/members clamps through the shared guard",
  src("../app/api/settings/members/route.js", "validateInvite\\("));
t("PATCH /api/settings/members clamps as well",
  src("../app/api/settings/members/route.js", 'hasLevel\\(actor, "payroll", "view_all"\\)'));
t("POST /api/team/quick-add clamps the Worker row's rate",
  src("../app/api/team/quick-add/route.js", "hourlyRate: vetted\\.laborCostPerHour"));
// Recording time for a colleague is a pay INPUT, so it is gated on the
// timeTracking level rather than left at company scope.
t("POST /api/time-entries gates recording against someone else",
  src("../app/api/time-entries/route.js",
    'hasLevel\\(full, "timeTracking", "view_record_edit_all"\\)'));

// Where the money actually lands is a payroll question, not a people one.
for (const [label, m] of BOTH) {
  t(`${label} is not a payroll admin`, isPayrollAdmin(m.role), false);
}
t("POST /api/payouts requires a payroll admin",
  src("../app/api/payouts/route.js", "isPayrollAdmin\\(member\\.role\\)"));
t("POST /api/workers/[id]/connect requires one too",
  src("../app/api/workers/[id]/connect/route.js", "isPayrollAdmin\\(member\\.role\\)"));
t("running a pay run requires run_payroll",
  src("../app/api/payroll/runs/route.js", 'hasLevel\\(full, "payroll", "run_payroll"\\)'));
t("exporting one requires view_all at least",
  src("../app/api/payroll/runs/[id]/export/route.js", 'hasLevel\\(full, "payroll", "view_all"\\)'));
t("the Workers settings page is payroll-gated above its hooks",
  src("../app/app/settings/team/workers/page.js", 'access\\.canSee\\("payroll"\\)'));

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n3. Delete stops at Dispatcher, and the endpoints agree\n");
// Every category runs edit for the Dispatcher and edit_delete for the Manager.
// Asserted by EXECUTING hasLevel at the delete level for both, so a preset
// edit that accidentally levels the two up shows here.
const DELETE_LEVELS = {
  quotes: "view_create_edit_delete",
  jobs: "view_create_edit_delete",
  invoices: "view_create_edit_delete",
  requests: "view_create_edit_delete",
  clientsProperties: "full_edit_delete",
  schedule: "edit_delete_all",
  notes: "view_edit_delete_all",
};
for (const [category, level] of Object.entries(DELETE_LEVELS)) {
  t(`Dispatcher may NOT delete ${category}`, hasLevel(DISPATCHER, category, level), false);
  t(`Manager MAY delete ${category}`, hasLevel(MANAGER, category, level));
  // Both hold the tier below, or the pair above says nothing.
  const levels = PERMISSION_CATEGORIES[category].levels.map((l) => l.value);
  const below = levels[levels.indexOf(level) - 1];
  t(`Dispatcher still holds ${category}:${below}`, hasLevel(DISPATCHER, category, below));
}

const DELETE_ROUTES = [
  ["quotes", "../app/api/quotes/[id]/route.js", 'requireLevel\\(full, "quotes", "view_create_edit_delete"'],
  ["jobs", "../app/api/jobs/[id]/route.js", 'requireLevel\\(full, "jobs", "view_create_edit_delete"'],
  ["invoices", "../app/api/invoices/[id]/route.js", '"invoices",\\s*\\n?\\s*"view_create_edit_delete"'],
  ["clients", "../app/api/clients/[id]/route.js", '"clientsProperties",\\s*\\n?\\s*"full_edit_delete"'],
  ["appointments", "../app/api/appointments/[id]/route.js", 'hasLevel\\(full, "schedule", "edit_delete_all"\\)'],
];
for (const [label, rel, pattern] of DELETE_ROUTES) {
  t(`DELETE ${label} asks for the delete level`, src(rel, pattern));
}
// A shift is a schedule row like an appointment is. This handler was a copy of
// its own PATCH gate, so it stopped at edit_all — which the Dispatcher preset
// IS. Deleting a shift was the one schedule verb where the two tiers came out
// identical and the Manage Team dial withheld nothing.
const SHIFT = read("../app/api/shifts/[id]/route.js");
const shiftDelete = SHIFT.slice(SHIFT.indexOf("export async function DELETE"));
t("DELETE shifts asks for edit_delete_all, not edit_all",
  /hasLevel\(full, "schedule", "edit_delete_all"\)/.test(shiftDelete));
t("...and its PATCH still asks only for edit_all",
  /hasLevel\(full, "schedule", "edit_all"\)/.test(
    SHIFT.slice(0, SHIFT.indexOf("export async function DELETE"))));
// The to-do list: PATCH grew an ownership rule and DELETE kept "any session,
// any row in the company" — the more destructive of the two.
const TASK = read("../app/api/tasks/[id]/route.js");
const taskDelete = TASK.slice(TASK.indexOf("export async function DELETE"));
t("DELETE a to-do is gated at all", /status: 403/.test(taskDelete));
t("...on the same ownership rule PATCH uses",
  /can\(member\.role, "task:create"\)/.test(taskDelete));
t("...and an unassigned task is not destroyable by anyone who could claim it",
  !/claimable/.test(taskDelete));

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n4a. Dispatcher has jobCosting OFF — all three surfaces\n");
t("Dispatcher jobCosting", hasToggle(DISPATCHER, "jobCosting"), false);
t("Manager jobCosting", hasToggle(MANAGER, "jobCosting"), true);
for (const [label, rel] of [
  ["quote", "../app/api/quotes/[id]/costing/route.js"],
  ["job", "../app/api/jobs/[id]/costing/route.js"],
  ["invoice", "../app/api/invoices/costing/route.js"],
]) {
  t(`GET ${label} costing checks the toggle`, src(rel, 'hasToggle\\(full, "jobCosting"\\)'));
  t(`GET ${label} costing refuses with 403, not 500`, src(rel, "status: 403"));
}
t("the invoice lifecycle read drops the costing block rather than leaking it",
  src("../app/api/invoices/[id]/lifecycle/route.js", 'hasToggle\\(full, "jobCosting"\\)'));
t("the AI copilot does not even QUERY a rate without the toggle",
  src("../lib/ai/copilotTools.js", 'showCost = hasToggle\\(member, "jobCosting"\\)'));

// Posting a costing block used to be DROPPED: the quote saved, the panel's
// contents vanished, and the response said 200. Absence of a refusal reads as
// success, which is the dead-control failure from the other side.
for (const [label, rel] of [
  ["POST /api/quotes", "../app/api/quotes/route.js"],
  ["PATCH /api/quotes/[id]", "../app/api/quotes/[id]/route.js"],
  ["POST /api/invoices", "../app/api/invoices/route.js"],
  ["PATCH /api/invoices/[id]", "../app/api/invoices/[id]/route.js"],
]) {
  t(`${label} REFUSES a costing block it may not write`,
    src(rel, "if \\(costing !== undefined\\) requireCost\\(full\\)"));
  // Silence must stay silence: a status-only PATCH from a Dispatcher carries
  // no costing key and must not start failing.
  t(`${label} only refuses when a block was actually sent`,
    src(rel, "costing !== undefined\\) requireCost"));
}
t("requireCost is one definition, re-exported not reimplemented",
  src("../app/api/quotes/costingWrite.js",
    "export \\{ mayCost, requireCost \\} from \"@/app/api/invoices/costingWrite\""));
t("...and it throws a 403, never a 500",
  src("../app/api/invoices/costingWrite.js", "err\\.status = 403"));

console.log("\n4b. Dispatcher has payments OFF\n");
t("Dispatcher payments", hasToggle(DISPATCHER, "payments"), false);
t("Manager payments", hasToggle(MANAGER, "payments"), true);
for (const [label, rel, pattern] of [
  ["GET /api/payments", "../app/api/payments/route.js", 'requireToggle\\(full, "payments", "see payments"'],
  ["POST /api/payments", "../app/api/payments/route.js", 'requireToggle\\(full, "payments", "record payments"'],
  ["POST invoice checkout-link", "../app/api/invoices/[id]/checkout-link/route.js", 'requireToggle\\(full, "payments"'],
  ["POST credit-visit-fee", "../app/api/invoices/[id]/credit-visit-fee/route.js", 'requireToggle\\(full, "payments"'],
  ["POST service-plan authorise", "../app/api/service-plans/[id]/authorise/route.js", 'requireToggle\\(full, "payments", "set up recurring payments"'],
  ["POST /api/service-plans", "../app/api/service-plans/route.js", 'requireToggle\\(full, "payments"'],
]) {
  t(`${label} requires the payments toggle`, src(rel, pattern));
}
// Withdrawing a stored mandate is the same authority as granting one; a gate
// on the create and not the destroy is the half-fix this repo keeps finding.
const AUTHORISE = read("../app/api/service-plans/[id]/authorise/route.js");
const authDelete = AUTHORISE.slice(AUTHORISE.indexOf("export async function DELETE"));
t("DELETE service-plan authorise requires it as well",
  /requireToggle\(full, "payments"/.test(authDelete));

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n5. The expenses/time asymmetry is deliberate — and real\n");
// Dispatcher edits EVERYONE's time and only their OWN expenses. It looks like
// an oversight and is not; this asserts it as written so a future tidy-up
// toward consistency shows up as a failing check rather than a quiet widening.
t("Dispatcher edits everyone's TIME",
  hasLevel(DISPATCHER, "timeTracking", "view_record_edit_all"));
t("Dispatcher edits only their OWN expenses",
  hasLevel(DISPATCHER, "expenses", "view_record_edit_all"), false);
t("Manager edits everyone's expenses",
  hasLevel(MANAGER, "expenses", "view_record_edit_all"));
t("Manager edits everyone's time too",
  hasLevel(MANAGER, "timeTracking", "view_record_edit_all"));

// scopeFilter is what the list endpoints narrow with — executed on both.
t("the expenses list narrows to the Dispatcher's own rows",
  JSON.stringify(scopeFilter(DISPATCHER, "expenses", "createdById", DISPATCHER_USER)),
  JSON.stringify({ createdById: DISPATCHER_USER }));
t("...and does not narrow for the Manager",
  JSON.stringify(scopeFilter(MANAGER, "expenses", "createdById", DISPATCHER_USER)), "{}");
t("the timesheet list does not narrow for EITHER",
  JSON.stringify(scopeFilter(DISPATCHER, "timeTracking", "workerId", DISPATCHER_USER)), "{}");
t("a Worker's timesheet still narrows (control)",
  JSON.stringify(scopeFilter(WORKER, "timeTracking", "workerId", DISPATCHER_USER)),
  JSON.stringify({ workerId: DISPATCHER_USER }));
t("GET /api/expenses scopes on the level",
  src("../app/api/expenses/route.js", 'hasLevel\\(full, "expenses", "view_record_edit_all"\\)'));
t("PATCH/DELETE one expense gates on it (a single row has nothing to narrow)",
  src("../app/api/expenses/[id]/route.js", 'hasLevel\\(full, "expenses", "view_record_edit_all"\\)'));
t("...and lets you touch your own regardless",
  src("../app/api/expenses/[id]/route.js", "existing\\.createdById === member\\.userId"));
t("the company expense roll-up refuses a Dispatcher",
  src("../app/api/expenses/summary/route.js", 'hasLevel\\(full, "expenses", "view_record_edit_all"\\)'));

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n6. Billing, and every door into the company's Stripe account\n");
for (const [label, m] of BOTH) {
  t(`${label} is not a billing admin`, isBillingAdmin(m.role), false);
}
t("an owner is", isBillingAdmin("owner"));
t("an admin is", isBillingAdmin("admin"));

for (const [label, rel] of [
  ["subscription", "../app/api/settings/subscription/route.js"],
  ["retention offer", "../app/api/settings/subscription/retention/route.js"],
  ["plans", "../app/api/settings/plans/route.js"],
  ["referral", "../app/api/settings/referral/route.js"],
]) {
  t(`company billing: ${label} requires a billing admin`, src(rel, "isBillingAdmin"));
}
// These four said "Only owners/admins can …" in the error string while asking
// requirePermission(role, "user:manage") — which supervisors hold. The settings
// row is hidden behind the `billing` capability, so the button was gone and the
// endpoint was live: a hidden control over an open door.
for (const [label, rel] of [
  ["connect (start onboarding)", "../app/api/stripe/connect/route.js"],
  ["disconnect", "../app/api/stripe/connect/disconnect/route.js"],
  ["refresh (resume onboarding)", "../app/api/stripe/connect/refresh/route.js"],
  ["login-link (Manage in Stripe)", "../app/api/stripe/connect/login-link/route.js"],
  ["status (the read half)", "../app/api/stripe/connect/status/route.js"],
]) {
  t(`stripe/connect ${label} requires a billing admin`, src(rel, "isBillingAdmin\\(member\\.role\\)"));
  t(`...and no longer settles for user:manage`,
    src(rel, 'requirePermission\\(member\\.role, "user:manage"\\)'), false);
}
// The sidebar hiding the row is a courtesy on top, not the gate.
t("the payments settings row is rated as billing",
  src("../lib/permissions/settingsAccess.js", '"app\\.settings\\.payments": "billing"'));
t("the account-billing row too",
  src("../lib/permissions/settingsAccess.js", '"app\\.settings\\.accountBilling": "billing"'));

// ═══════════════════════════════════════════════════════════════════════════
console.log("\nRefusals are 403 — a permission failure must never be a 500\n");
for (const rel of [
  "../app/api/workers/route.js",
  "../app/api/workers/[id]/route.js",
  "../app/api/workers/[id]/connect/route.js",
  "../app/api/shifts/[id]/route.js",
  "../app/api/tasks/[id]/route.js",
  "../app/api/stripe/connect/route.js",
  "../app/api/stripe/connect/status/route.js",
  "../app/api/stripe/connect/disconnect/route.js",
  "../app/api/stripe/connect/refresh/route.js",
  "../app/api/invoices/[id]/checkout-link/route.js",
]) {
  t(`${rel.split("/").slice(-3).join("/")} answers 403`,
    src(rel, "status: 403") || src(rel, "permissionErrorResponse"));
}

console.log(`\n${pass + failures.length} checks, ${failures.length} failure(s).\n`);
if (failures.length) {
  console.log("Failures:");
  for (const f of failures) console.log(`  - ${f}`);
  process.exitCode = 1;
}
