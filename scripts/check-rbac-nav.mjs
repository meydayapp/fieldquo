// scripts/check-rbac-nav.mjs
//
//   npm run check:rbac-nav
//
// The permission-aware nav filter, executed against real grids.
//
// QA reported an employee's sidebar listing eleven screens that refused them,
// which "reads as a broken product rather than a permissions boundary". These
// assertions are the regression guard — and the failure posture matters as
// much as the hiding: a missing provider must show EVERYTHING, because a nav
// that empties itself is far worse than a row leading to a gated page.
import {
  navRowAllowed,
  filterNavGroupsByPermission,
  filterNavItemsByPermission,
  NAV_REQUIREMENTS,
} from "../lib/permissions/nav.js";

let pass = 0;
const failures = [];
const check = (label, ok) => {
  if (ok) { pass += 1; console.log(`  ok   ${label}`); }
  else { failures.push(label); console.log(`  FAIL ${label}`); }
};

// Daniel's real grid, as saved in production.
const employee = {
  role: "employee",
  permissions: {
    jobs: "view_only", quotes: "view_only", invoices: "view_only",
    payroll: "view_own", expenses: "view_record_edit_own", payments: false,
    schedule: "view_complete_own", jobCosting: false, showPricing: false,
    timeTracking: "view_record_own", clientsProperties: "name_address_only",
    notes: "jobs_visits_only", requests: "view_only",
  },
};
const supervisor = { role: "supervisor", permissions: employee.permissions };
const owner = { role: "owner", permissions: null };
const admin = { role: "admin", permissions: employee.permissions };
const legacy = { role: "employee", permissions: null };

console.log("\nHidden from a restricted employee\n");
check("Insights — nothing survives showPricing:false", !navRowAllowed("app.nav.insights", employee));
check("Expenses roll-up — own-expenses only", !navRowAllowed("app.nav.expenses", employee));
check("Estimate reviews — approval is supervisor+", !navRowAllowed("app.nav.estimateReviews", employee));
check("Timesheets — review is not own-time-only", !navRowAllowed("app.nav.timesheets", employee));
check("Team — roster, invitations, owner's email", !navRowAllowed("app.nav.team", employee));

console.log("\nStill shown — view_only is a real level, not a punishment\n");
check("Quotes list stays", navRowAllowed("app.nav.quotes", employee));
check("Jobs list stays", navRowAllowed("app.nav.jobs", employee));
check("Invoices list stays", navRowAllowed("app.nav.invoices", employee));
check("Their own clock stays", navRowAllowed("app.nav.clock", employee));
check("Their own payslips stay", navRowAllowed("app.nav.payroll", employee));
check("Requests stay", navRowAllowed("app.nav.requests", employee));
check("A row nothing has an opinion about stays", navRowAllowed("app.nav.calendar", employee));

console.log("\nWho keeps the full menu\n");
check("owner sees everything", Object.keys(NAV_REQUIREMENTS).every((k) => navRowAllowed(k, owner)));
check("admin sees everything despite a restrictive grid", Object.keys(NAV_REQUIREMENTS).every((k) => navRowAllowed(k, admin)));
check("supervisor gets estimate reviews", navRowAllowed("app.nav.estimateReviews", supervisor));
check("supervisor gets the team roster", navRowAllowed("app.nav.team", supervisor));
check("supervisor still lacks the expense roll-up", !navRowAllowed("app.nav.expenses", supervisor));

console.log("\nFailure posture — a missing map must never empty the nav\n");
check("null member shows every row", Object.keys(NAV_REQUIREMENTS).every((k) => navRowAllowed(k, null)));
check("undefined member shows every row", navRowAllowed("app.nav.team", undefined));
// A missing GRID must not hide anything — that member predates the feature and
// locking them out of screens they used yesterday would be a regression.
// A missing grid is NOT a missing role, though: role is always known, so
// role-based rules still apply. Asserting both halves, because conflating them
// is how the failure posture would quietly become "hide nothing, ever".
const gridRules = Object.entries(NAV_REQUIREMENTS).filter(([, r]) => !r.role).map(([k]) => k);
const roleRules = Object.entries(NAV_REQUIREMENTS).filter(([, r]) => r.role).map(([k]) => k);
check("member with no grid keeps every grid-gated row", gridRules.every((k) => navRowAllowed(k, legacy)));
check("but role-gated rows still apply without a grid", roleRules.every((k) => !navRowAllowed(k, legacy)));
check("unknown nav key is shown", navRowAllowed("app.nav.somethingNew", employee));

console.log("\nGroup filtering\n");
const GROUPS = [
  { key: "work", items: [{ key: "app.nav.quotes" }, { key: "app.nav.estimateReviews" }] },
  { key: "money", items: [{ key: "app.nav.insights" }, { key: "app.nav.expenses" }] },
  { key: "misc", items: [{ key: "app.nav.calendar" }] },
];
const filtered = filterNavGroupsByPermission(GROUPS, employee);
check("a group keeps the rows that survive", filtered.find((g) => g.key === "work").items.length === 1);
check("a group that loses every row is dropped entirely", !filtered.some((g) => g.key === "money"));
check("an untouched group is untouched", filtered.find((g) => g.key === "misc").items.length === 1);
check("owner keeps all three groups", filterNavGroupsByPermission(GROUPS, owner).length === 3);
check("null member keeps all three groups", filterNavGroupsByPermission(GROUPS, null).length === 3);
check("other group properties survive", filterNavGroupsByPermission(GROUPS, employee)[0].key === "work");

console.log("\nHostile input\n");
check("non-array groups pass through", filterNavGroupsByPermission(null, employee) === null);
check("non-array items pass through", filterNavItemsByPermission(undefined, employee) === undefined);
check("a group with no items array doesn't throw", filterNavGroupsByPermission([{ key: "x" }], employee).length === 0);
check("flat item list filters", filterNavItemsByPermission([{ key: "app.nav.team" }, { key: "app.nav.clock" }], employee).length === 1);

console.log(`\n${pass + failures.length} checks, ${failures.length} failure(s).\n`);
if (failures.length) process.exitCode = 1;
