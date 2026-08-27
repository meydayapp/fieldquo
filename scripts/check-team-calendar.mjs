// scripts/check-team-calendar.mjs
//
// The Calendar shows two lists: everything assigned to you, and — for people
// with the permission — what the crew reporting to them is doing. This
// EXECUTES the scoping resolver against a fixture company rather than reading
// the JSX and believing it, because hiding a list in the UI is not access
// control and a check that inspects markup would pass on a build where the API
// happily served a stranger's fortnight.
//
// The fixture is one company with an org chart drawn, plus a second company
// that exists only to be refused.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-team-calendar.mjs

import {
  resolveTeamScope,
  canViewMemberSchedule,
  canSeeTeamSchedule,
  ownScheduleFilter,
  TEAM_SCHEDULE_PERMISSION,
  TEAM_SCHEDULE_LEVEL,
} from "@/lib/schedule/teamScope";
import { can, PERMISSIONS } from "@/lib/permissions";
import { PERMISSION_CATEGORIES, PERMISSION_PRESETS, PRESET_TO_ROLE } from "@/lib/permissions";
import { bookingToCalendarEntry } from "@/lib/schedule/jobVisits";

let fail = 0;
const t = (name, got, want = true) => {
  const ok = String(got) === String(want);
  if (!ok) fail++;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${ok ? "" : `  got=${got} want=${want}`}`);
};
const names = (scope) => scope.team.map((m) => m.user.name).sort().join(",");

// ───────────────────────────────────────────────────────────────────────────
// THE FIXTURE
//
//   Olivia (owner)
//   ├── Adam   (admin)
//   ├── Maria  (supervisor / "Manager" preset)
//   │   ├── Eli  (employee — the estimator)
//   │   └── Pat  (employee — a plain worker)
//   └── Marco  (supervisor — MARIA'S PEER, not her report)
//       └── Nina (employee — Marco's, therefore not Maria's either)
//
// Marco and Nina are the whole point of the fixture: a manager list that
// accidentally returns "everyone below the top" would contain them, and would
// look completely correct on a company with one manager.
// ───────────────────────────────────────────────────────────────────────────

const CO = "co-A";
const mk = (key, name, role, permissions) => ({
  id: `m-${key}`,
  userId: `u-${key}`,
  companyId: CO,
  role,
  permissions,
  user: { id: `u-${key}`, name },
});

const MANAGER_GRID = PERMISSION_PRESETS.manager.values;
const WORKER_GRID = PERMISSION_PRESETS.estimator.values;

const olivia = mk("olivia", "Olivia", "owner", null);
const adam = mk("adam", "Adam", "admin", null);
const maria = mk("maria", "Maria", "supervisor", MANAGER_GRID);
const marco = mk("marco", "Marco", "supervisor", MANAGER_GRID);
const eli = mk("eli", "Eli", "employee", WORKER_GRID);
const pat = mk("pat", "Pat", "employee", WORKER_GRID);
const nina = mk("nina", "Nina", "employee", WORKER_GRID);

const members = [olivia, adam, maria, marco, eli, pat, nina];

const worker = (key, managerKey) => ({
  id: `w-${key}`,
  userId: `u-${key}`,
  managerId: managerKey ? `w-${managerKey}` : null,
  name: key,
});
const workers = [
  worker("olivia", null),
  worker("adam", "olivia"),
  worker("maria", "olivia"),
  worker("marco", "olivia"),
  worker("eli", "maria"),
  worker("pat", "maria"),
  worker("nina", "marco"),
];

const scopeFor = (member, opts = {}) =>
  resolveTeamScope({ member, members, workers, ...opts });

// ───────────────────────────────────────────────────────────────────────────
console.log("\nThe role vocabulary the gate is written against still exists");
// If someone renames a role or a schedule level, every assertion below would
// keep passing while gating on a permission nobody has. Assert the vocabulary.
t("the coarse permission is real", PERMISSIONS.supervisor.includes(TEAM_SCHEDULE_PERMISSION));
t("employees do NOT hold it — this is what 'own only' means",
  PERMISSIONS.employee.includes(TEAM_SCHEDULE_PERMISSION), false);
t("the schedule level is real",
  PERMISSION_CATEGORIES.schedule.levels.some((l) => l.value === TEAM_SCHEDULE_LEVEL));
t("the Manager preset maps to a role that holds it",
  can(PRESET_TO_ROLE.manager, TEAM_SCHEDULE_PERMISSION));
t("the Worker preset maps to a role that does NOT",
  can(PRESET_TO_ROLE.estimator, TEAM_SCHEDULE_PERMISSION), false);

// ───────────────────────────────────────────────────────────────────────────
console.log("\nList 1 — everyone's OWN list is exactly what is assigned to them");
//
// The route builds its `where` from ownScheduleFilter. This interprets the
// REAL fragment against fixture rows: testing a re-implementation of the rule
// would prove only that the check and the check agree.
function matches(fragment, row) {
  if (!fragment || Object.keys(fragment).length === 0) return true; // {} = everyone
  if (fragment.OR) return fragment.OR.some((f) => matches(f, row));
  return Object.entries(fragment).every(([k, v]) => row[k] === v);
}

const rows = [
  { id: "r-eli", assignedToId: "u-eli" },
  { id: "r-pat", assignedToId: "u-pat" },
  { id: "r-maria", assignedToId: "u-maria" },
  { id: "r-none", assignedToId: null }, // unclaimed
];
const ownIds = (member) => {
  const f = ownScheduleFilter(member, member.userId, { field: "assignedToId" });
  return rows.filter((r) => matches(f, r)).map((r) => r.id).sort().join(",");
};

t("the estimator gets his own row and the unclaimed one — nobody else's",
  ownIds(eli), "r-eli,r-none");
t("the plain employee likewise", ownIds(pat), "r-none,r-pat");
t("Eli's list does NOT contain Pat's row",
  ownIds(eli).includes("r-pat"), false);
// Parity with today: the calendar has always shown unclaimed work to everyone,
// and an unclaimed job nobody can see is a job nobody does.
t("unassigned work stays visible to an employee — no view is lost",
  ownIds(eli).includes("r-none"));
t("a manager with edit_delete_all sees everyone — the {} fragment",
  Object.keys(ownScheduleFilter(maria, maria.userId)).length, 0);
t("the owner sees everyone", Object.keys(ownScheduleFilter(olivia, olivia.userId)).length, 0);
// The booking source is scoped through EventType.userId, a different column.
t("the booking fragment names the booking's own assignee column",
  JSON.stringify(ownScheduleFilter(eli, eli.userId, { field: "userId" })),
  JSON.stringify({ OR: [{ userId: "u-eli" }, { userId: null }] }));

// ───────────────────────────────────────────────────────────────────────────
console.log("\nList 2 — the team list is absent for an employee, not empty");
const eliScope = scopeFor(eli);
t("the estimator may not see a team at all", eliScope.allowed, false);
t("...and there is no data behind the missing heading", eliScope.team.length, 0);
t("...and no basis is claimed", eliScope.basis, "none");
const patScope = scopeFor(pat);
t("the plain employee likewise", patScope.allowed, false);
t("...with nothing behind it", patScope.team.length, 0);
t("canSeeTeamSchedule agrees with the resolver for the estimator",
  canSeeTeamSchedule(eli), false);

// ───────────────────────────────────────────────────────────────────────────
console.log("\nList 2 — a manager gets their REPORTS and not their PEERS");
const mariaScope = scopeFor(maria);
t("she may see a team", mariaScope.allowed);
t("it is drawn from the org chart, not from role level", mariaScope.basis, "reporting_line");
t("it is exactly her two reports", names(mariaScope), "Eli,Pat");
t("Marco is her PEER and is not in it",
  mariaScope.team.some((m) => m.id === marco.id), false);
t("Nina reports to Marco, so she is not in it either",
  mariaScope.team.some((m) => m.id === nina.id), false);
t("her own manager is not in it", mariaScope.team.some((m) => m.id === olivia.id), false);
t("she is not in her own team list", mariaScope.team.some((m) => m.id === maria.id), false);

const marcoScope = scopeFor(marco);
t("Marco gets Nina and only Nina", names(marcoScope), "Nina");

// ───────────────────────────────────────────────────────────────────────────
console.log("\nOwner and admin get the whole company");
// (Default string sort, so "Marco" precedes "Maria" — 'c' < 'i'.)
t("the owner sees everyone else", names(scopeFor(olivia)),
  "Adam,Eli,Marco,Maria,Nina,Pat");
t("...labelled as company-wide, not as an org chart", scopeFor(olivia).basis, "company");
t("the admin too", names(scopeFor(adam)), "Eli,Marco,Maria,Nina,Olivia,Pat");
t("neither includes themselves",
  scopeFor(olivia).team.some((m) => m.id === olivia.id), false);

// ───────────────────────────────────────────────────────────────────────────
console.log("\nRemoving the permission removes the DATA, not just the heading");
// The grid, not the role: this is the case the owner asked for by name —
// governed by RBAC rather than by job title.
const mariaDialledDown = { ...maria, permissions: { ...MANAGER_GRID, schedule: "view_own" } };
const downScope = scopeFor(mariaDialledDown);
t("a manager dialled to view_own may not see a team", downScope.allowed, false);
t("...and gets no rows, not merely no heading", downScope.team.length, 0);
t("...and cannot reach a report by naming them directly",
  canViewMemberSchedule({ member: mariaDialledDown, targetMemberId: eli.id, members, workers }).ok,
  false);
t("edit_own is still not enough",
  scopeFor({ ...maria, permissions: { ...MANAGER_GRID, schedule: "edit_own" } }).allowed, false);
t("edit_all is the first level that is",
  scopeFor({ ...maria, permissions: { ...MANAGER_GRID, schedule: "edit_all" } }).allowed);

// The coarse floor holds independently of the grid.
const eliPromotedGrid = { ...WORKER_GRID, schedule: "edit_delete_all" };
t("an EMPLOYEE handed edit_delete_all still gets no team — the coarse floor holds",
  scopeFor({ ...eli, permissions: eliPromotedGrid }).allowed, false);
// And the grid holds independently of the role. Both, not either.
t("owner is unaffected by the grid, as UNRESTRICTED_ROLES says",
  scopeFor({ ...olivia, permissions: { schedule: "view_own" } }).allowed);

// ───────────────────────────────────────────────────────────────────────────
console.log("\nA member id from another company is refused outright");
const foreign = {
  id: "m-bianca",
  userId: "u-bianca",
  companyId: "co-B",
  role: "employee",
  permissions: null,
  user: { id: "u-bianca", name: "Bianca" },
};
t("the owner cannot open a foreign member's schedule",
  canViewMemberSchedule({ member: olivia, targetMemberId: foreign.id, members, workers }).ok, false);
t("...and the reason is not 'unknown', which would confirm nothing exists",
  canViewMemberSchedule({ member: olivia, targetMemberId: foreign.id, members, workers }).reason,
  "not_in_team");
t("a manager cannot either",
  canViewMemberSchedule({ member: maria, targetMemberId: foreign.id, members, workers }).ok, false);
t("nor can an employee",
  canViewMemberSchedule({ member: eli, targetMemberId: foreign.id, members, workers }).ok, false);
// The structural guarantee: a foreign row cannot be in the company-scoped
// input, so even smuggling it in as a "member" only proves the gate re-checks.
t("even if a foreign row is smuggled into the member list, an employee is still refused",
  canViewMemberSchedule({
    member: eli, targetMemberId: foreign.id, members: [...members, foreign], workers,
  }).ok, false);

console.log("\nWithin the company, the drill-down matches the list");
t("Maria may open Eli — he reports to her",
  canViewMemberSchedule({ member: maria, targetMemberId: eli.id, members, workers }).ok);
t("Maria may NOT open Marco — he is her peer",
  canViewMemberSchedule({ member: maria, targetMemberId: marco.id, members, workers }).ok, false);
t("Maria may NOT open Nina — Marco's report, not hers",
  canViewMemberSchedule({ member: maria, targetMemberId: nina.id, members, workers }).ok, false);
t("Eli may open himself",
  canViewMemberSchedule({ member: eli, targetMemberId: eli.id, members, workers }).ok);
t("...and that is reported as 'self', so the route cannot mistake it for standing",
  canViewMemberSchedule({ member: eli, targetMemberId: eli.id, members, workers }).reason, "self");
t("Eli may not open Pat, his peer",
  canViewMemberSchedule({ member: eli, targetMemberId: pat.id, members, workers }).ok, false);

// ───────────────────────────────────────────────────────────────────────────
console.log("\nHostile input is refused, not crashed on");
for (const [label, value] of [
  ["__proto__", "__proto__"],
  ["constructor", "constructor"],
  ["prototype", "prototype"],
  ["toString", "toString"],
  ["null", null],
  ["undefined", undefined],
  ["empty string", ""],
  ["a number", 12345],
  ["an object", { id: "m-eli" }],
  ["an array", ["m-eli"]],
  ["a forged id", "m-eli-but-not-really"],
]) {
  let ok;
  try {
    ok = canViewMemberSchedule({ member: maria, targetMemberId: value, members, workers }).ok;
  } catch (e) {
    ok = `THREW ${e.message}`;
  }
  t(`targetMemberId = ${label} is refused`, ok, false);
}
// can() indexed PERMISSIONS bare, so can("__proto__") reached Object.prototype
// and threw a TypeError — a permission check whose failure mode was a 500.
for (const role of ["__proto__", "constructor", "toString", null, undefined, "", 7, {}]) {
  let got;
  try {
    got = can(role, TEAM_SCHEDULE_PERMISSION);
  } catch (e) {
    got = `THREW ${e.constructor.name}`;
  }
  t(`can(${JSON.stringify(role)}) denies rather than throwing`, got, false);
}
for (const [label, member] of [
  ["null", null],
  ["undefined", undefined],
  ["a string", "maria"],
  ["a role that does not exist", { ...maria, role: "wizard" }],
  ["a prototype key as a role", { ...maria, role: "__proto__" }],
  ["a grid level that is not real", { ...maria, permissions: { schedule: "view_the_moon" } }],
]) {
  let r;
  try {
    r = scopeFor(member).allowed;
  } catch (e) {
    r = `THREW ${e.message}`;
  }
  t(`a member that is ${label} gets no team`, r, false);
}
// A missing or unreadable grid falls back to the COARSE ROLE — hasLevel says
// so in as many words, because members predate the grid and defaulting them to
// "no access" would lock out working accounts on deploy. Asserted rather than
// treated as a bug, but asserted in BOTH directions: the fallback must never
// hand an employee something their role does not carry.
for (const [label, grid] of [
  ["missing", null],
  ["a string", "everything"],
  ["a number", 7],
]) {
  t(`a supervisor whose grid is ${label} falls back to their role — allowed`,
    scopeFor({ ...maria, permissions: grid }).allowed);
  t(`...and an employee whose grid is ${label} is still refused`,
    scopeFor({ ...eli, permissions: grid }).allowed, false);
}

t("a null member list does not throw",
  resolveTeamScope({ member: maria, members: null, workers: null }).team.length, 0);
t("junk rows in the member list are dropped",
  resolveTeamScope({ member: olivia, members: [null, {}, { id: "x" }, eli], workers }).team.length, 1);

// ───────────────────────────────────────────────────────────────────────────
console.log("\nA company that never drew an org chart keeps today's behaviour");
const flat = workers.map((w) => ({ ...w, managerId: null }));
const flatScope = resolveTeamScope({ member: maria, members, workers: flat });
t("a manager still sees the company", flatScope.allowed);
t("...and it says so, rather than implying an org chart", flatScope.basis, "company");
t("...but an employee still does not",
  resolveTeamScope({ member: eli, members, workers: flat }).allowed, false);
// The narrowing case: chart drawn, this supervisor simply isn't on it.
const chartWithoutMaria = workers.filter((w) => w.id !== "w-maria");
const orphan = resolveTeamScope({ member: maria, members, workers: chartWithoutMaria });
t("a supervisor absent from a drawn chart has no reports", orphan.team.length, 0);
t("...which is narrower than company-wide, never wider", orphan.basis, "reporting_line");

console.log("\nA broken org chart terminates instead of hanging");
// The control that sets a manager is a dropdown of colleagues, so cycles are a
// data-entry mistake rather than a hypothetical.
const cyclic = [
  { id: "w-a", userId: "u-maria", managerId: "w-b" },
  { id: "w-b", userId: "u-marco", managerId: "w-a" },
  { id: "w-c", userId: "u-eli", managerId: "w-a" },
];
let cycleOk = true;
try {
  resolveTeamScope({ member: maria, members, workers: cyclic });
} catch {
  cycleOk = false;
}
t("a two-person cycle does not hang or throw", cycleOk);
t("a worker who is their own manager does not either",
  resolveTeamScope({ member: maria, members, workers: [{ id: "w-a", userId: "u-maria", managerId: "w-a" }] }).allowed);

// ───────────────────────────────────────────────────────────────────────────
console.log("\nBookings reach the calendar, exactly once, with the right shape");
const bk = {
  id: "b1",
  startTime: new Date("2026-08-26T14:00:00Z"),
  endTime: new Date("2026-08-26T15:00:00Z"),
  status: "confirmed",
  clientName: "Ms Okafor",
  address: "9 Bay St",
  mode: "visit",
  latitude: 43.6,
  longitude: -79.4,
  eventType: { name: "Estimate visit", userId: "u-eli", user: { id: "u-eli", name: "Eli" } },
};
const be = bookingToCalendarEntry(bk);
t("it is labelled a booking, not an appointment", be.kind, "booking");
// The assign <select> on the calendar PATCHes /api/appointments/[id]. Offering
// it on a Booking id would 404 — a control that appears to work.
t("the person filter reads assignedToId, which is present", be.assignedToId, "u-eli");
t("it carries its end time, so the travel check can use it", be.booking.endTime, bk.endTime);
t("coordinates come through for the same reason", be.latitude, 43.6);
t("the synthesised client is marked as such — there may be no Client row",
  be.client.synthetic);
t("a booking type owned by nobody is unassigned, not company-owned",
  bookingToCalendarEntry({ ...bk, eventType: { name: "X", userId: null } }).assignedToId, null);
t("status is passed through, never mapped onto an appointment status",
  bookingToCalendarEntry({ ...bk, status: "pending_payment" }).status, "pending_payment");
t("junk in, null out", bookingToCalendarEntry({}), null);
t("null in, null out", bookingToCalendarEntry(null), null);

// ── The route's own no-double-count rule ──────────────────────────────────
// A booking that DID become an appointment is already on the list as one.
// Both routes exclude it with `appointmentId: null`; assert the source says so
// rather than trusting that it still does.
import { readFileSync } from "node:fs";
const apptRoute = readFileSync(new URL("../app/api/appointments/route.js", import.meta.url), "utf8");
const teamRoute = readFileSync(new URL("../app/api/schedule/team/route.js", import.meta.url), "utf8");
t("the own-calendar route excludes converted bookings", apptRoute.includes("appointmentId: null"));
t("the team route does too", teamRoute.includes("appointmentId: null"));
t("neither puts unpaid holds on a calendar",
  !apptRoute.includes('"pending_payment"') && !teamRoute.includes('"pending_payment"'));
t("the own-calendar route builds its scope from the shared filter",
  apptRoute.includes("ownScheduleFilter"));
t("the team route gates before it queries — the resolver call precedes findMany",
  teamRoute.indexOf("resolveTeamScope") < teamRoute.indexOf("db.appointment.findMany"));

// ── Timezone ──────────────────────────────────────────────────────────────
// The house rule (lib/format/companyDate.js): a calendar DAY formats from the
// UTC getters, an INSTANT formats local. scheduledAt and startTime are
// instants — 8pm Monday in Toronto is Tuesday in UTC, so running them through
// the date-only formatter would file half of every evening under tomorrow.
console.log("\nCalendar entries are instants, and stay instants");
t("a booking entry keeps a Date, not a truncated day string",
  bookingToCalendarEntry(bk).scheduledAt instanceof Date);
t("the team route never applies the date-ONLY formatter to an instant",
  !teamRoute.includes("isoDateOnly") && !teamRoute.includes("formatDateOnly"));

console.log(fail === 0 ? "\nAll good.\n" : `\n${fail} FAILED\n`);
process.exit(fail ? 1 : 0);
