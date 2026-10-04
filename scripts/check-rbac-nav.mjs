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
import { PERMISSION_PRESETS, PRESET_TO_ROLE } from "../lib/permissions.js";
import { readFileSync, existsSync } from "node:fs";
import {
  phoneBarFor,
  phoneBarSetFor,
  phoneTabActive,
  phoneMoreActive,
  railPinsClock,
  rowGateKeys,
  PHONE_MORE,
} from "../lib/nav/phoneBar.js";

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

// REG-002: the first trimming pass left rows that lead straight to a refusal.
check("Plan & billing — a no-access panel for this role", !navRowAllowed("app.nav.plan", employee));
check("Refer & Earn — same", !navRowAllowed("app.nav.refer", employee));
check("Quick-add quote — composing one then losing it to a 403 is the worst case",
  !navRowAllowed("app.quickAdd.quote", employee));

console.log("\nStill shown — view_only is a real level, not a punishment\n");
check("Quotes list stays", navRowAllowed("app.nav.quotes", employee));
check("Jobs list stays", navRowAllowed("app.nav.jobs", employee));
check("Invoices list stays", navRowAllowed("app.nav.invoices", employee));
check("Their own clock stays", navRowAllowed("app.nav.clock", employee));
check("Their own payslips stay", navRowAllowed("app.nav.payroll", employee));
check("Requests stay", navRowAllowed("app.nav.requests", employee));
check("A row nothing has an opinion about stays", navRowAllowed("app.nav.calendar", employee));

// ── The inbox is the requests grid one screen over ─────────────────────────
//
// GET /api/messaging/threads refuses at requests:view_only (an inbound Page
// message IS a request). The Messages row had no rule, so a Crew member at
// requests:none saw the row and met the refusal behind it. Executed against
// the Crew preset itself, not a hand-written grid, so the assertion follows
// the preset if it moves.
console.log("\nMessages follows the requests dial, as the route does\n");
const crew = { role: PRESET_TO_ROLE.worker, permissions: PERMISSION_PRESETS.worker.values };
check("Crew (requests: none) does not see Messages", !navRowAllowed("app.nav.messages", crew));
check("Daniel's grid (requests: view_only) keeps Messages", navRowAllowed("app.nav.messages", employee));
check("the rule is the SAME dial and rung the route gates on",
  NAV_REQUIREMENTS["app.nav.messages"]?.category === "requests" &&
  NAV_REQUIREMENTS["app.nav.messages"]?.level === "view_only" &&
  /requireLevel\(full, "requests", "view_only"/.test(readFileSync(new URL("../app/api/messaging/threads/route.js", import.meta.url), "utf8")));

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

// ── The phone bar, per role (2026-10-03) ───────────────────────────────────
//
// The owner: "the core things of the other employees should be easily
// accessed there." Each preset's bar is pinned here, EXECUTED through the
// real phoneBarFor against the real preset grids — so a preset edit that
// would drop a tab (or add a tab its grid refuses) fails here, not on a
// phone. Every tab is then re-asked of navRowAllowed for its own key and
// every `also` key, its page must exist, and the More slot must be the
// only "More" — no tab duplicates it and the sheet drops the bar's rows.
console.log("\nThe phone bar, per preset — executed\n");
// 2026-10-03, the owner: "everyone should have a clock, even the boss" — the
// clock is the first tab on every set, and each set kept its size by moving
// one tab to More (Invoices, Leads, Jobs — lib/nav/phoneBar.js says why).
// `off` is the bar of the same person with their clock switched off: the
// swapped tab comes back, so nobody loses a tab to a button they cannot have.
const PRESET_BARS = {
  owner: { caller: owner, set: "office", hrefs: ["/app/clock", "/app/leads", "/app/quotes", "/app/jobs", "/app/chat"], more: "sheet", pin: true, slots: 6 },
  admin: { caller: { role: "admin", permissions: null }, set: "office", hrefs: ["/app/clock", "/app/leads", "/app/quotes", "/app/jobs", "/app/chat"], more: "sheet", pin: true, slots: 6 },
  worker: { set: "crew", hrefs: ["/app/clock", "/app", "/app/chat"], more: "page", pin: true, slots: 4, off: ["/app", "/app/chat"] },
  estimator: { set: "estimator", hrefs: ["/app/clock", "/app/quotes", "/app/appointments", "/app/chat"], more: "sheet", pin: true, slots: 5, off: ["/app/leads", "/app/quotes", "/app/appointments", "/app/chat"] },
  // Time Tracking at None also closes the timesheets screen, so Team goes with
  // the clock — the swap still brings Jobs back.
  dispatcher: { set: "dispatch", hrefs: ["/app/clock", "/app/scheduler", "/app/settings/team/timesheets", "/app/chat"], more: "sheet", pin: true, slots: 5, off: ["/app/scheduler", "/app/jobs", "/app/chat"] },
  manager: { set: "dispatch", hrefs: ["/app/clock", "/app/scheduler", "/app/settings/team/timesheets", "/app/chat"], more: "sheet", pin: true, slots: 5, off: ["/app/scheduler", "/app/jobs", "/app/chat"] },
};
const pageExists = (href) => existsSync(new URL(`../app${href}/page.js`, import.meta.url));
for (const [name, want] of Object.entries(PRESET_BARS)) {
  const caller = want.caller || { role: PRESET_TO_ROLE[name], permissions: PERMISSION_PRESETS[name].values };
  const bar = phoneBarFor(caller);
  const hrefs = bar.tabs.map((t) => t.href);
  check(`${name}: the ${want.set} set — ${hrefs.join(" · ")} · More`,
    bar.set === want.set && JSON.stringify(hrefs) === JSON.stringify(want.hrefs));
  check(`${name}: ${bar.tabs.length + 1} slots, at most six`, bar.tabs.length + 1 <= 6);
  check(`${name}: every tab passes navRowAllowed for its key and each 'also' key`,
    bar.tabs.every((row) => rowGateKeys(row).every((k) => navRowAllowed(k, caller))));
  check(`${name}: every tab is a real page`, bar.tabs.every((row) => pageExists(row.href)));
  check(`${name}: More is the ${want.more}${bar.more.href ? ` (${bar.more.href})` : ""}`,
    bar.more.kind === want.more && (!bar.more.href || pageExists(bar.more.href)));
  check(`${name}: no tab is a second More`, !hrefs.some((h) => h === "/app/more" || h === bar.more.href));
  check(`${name}: the desktop rail ${want.pin ? "pins" : "does not pin"} the clock`, railPinsClock(caller) === want.pin);
  check(`${name}: the clock is the FIRST tab`, hrefs[0] === "/app/clock");
  check(`${name}: the bar kept its size — ${want.slots} slots with More`, bar.tabs.length + 1 === want.slots);
  if (want.off) {
    // The grid's own switch, as Manage Team writes it: Time Tracking at None.
    const off = { ...caller, permissions: { ...caller.permissions, timeTracking: "none" } };
    const offBar = phoneBarFor(off);
    const offHrefs = offBar.tabs.map((t) => t.href);
    check(`${name}, clock switched off: ${offHrefs.join(" · ")} · More — no clock, the swapped tab back`,
      offBar.set === want.set && JSON.stringify(offHrefs) === JSON.stringify(want.off));
    check(`${name}, clock switched off: the rail pins nothing`, railPinsClock(off) === false);
  }
}

// Owners and admins bypass the grid, so a `none` written onto an owner's row
// (no screen offers it) still leaves them their clock — "even the boss".
check("an owner's clock cannot be switched off by a stray grid value",
  phoneBarFor({ role: "owner", permissions: { timeTracking: "none" } }).tabs[0]?.href === "/app/clock");

// Crew: no money anywhere on the bar. The four office documents are the money
// screens a crew grid refuses; none may be a tab, and Today is My day, whose
// payload is whitelisted (check:dashboard-home).
{
  const crewCaller = { role: PRESET_TO_ROLE.worker, permissions: PERMISSION_PRESETS.worker.values };
  const hrefs = phoneBarFor(crewCaller).tabs.map((t) => t.href);
  check("Crew: no quotes, invoices, leads or payroll on the bar",
    !hrefs.some((h) => ["/app/quotes", "/app/invoices", "/app/leads", "/app/payroll", "/app/me/earnings"].includes(h)));
  check("Crew: Today lights on /app only, not on every /app screen",
    phoneTabActive(phoneBarFor(crewCaller).tabs.find((t) => t.href === "/app"), "/app") &&
    !phoneTabActive(phoneBarFor(crewCaller).tabs.find((t) => t.href === "/app"), "/app/clock"));
  check("Crew: More is lit on the employee-home screens it opens", phoneMoreActive(PHONE_MORE.crew, "/app/me/earnings"));
}

// The Team tab needs BOTH rules: the timesheets page is NoAccessPanel below
// user:manage, the row below timeTracking:view_record_edit_all. A custom grid
// that holds one and not the other must not be handed the tab.
{
  const oddDispatcher = { role: "employee", permissions: { ...PERMISSION_PRESETS.dispatcher.values } };
  const bar = phoneBarFor(oddDispatcher);
  check("a schedule-running EMPLOYEE (no user:manage) gets no Team tab", bar.set === "dispatch" && !bar.tabs.some((t) => t.href === "/app/settings/team/timesheets"));
  check("…and still a bar with Clock, Schedule and Chat", ["/app/clock", "/app/scheduler", "/app/chat"].every((h) => bar.tabs.some((t) => t.href === h)));
}

// A grid at `none` on everything an estimator set carries falls back to the
// crew bar rather than "Chat · More" (the docs/MOBILE-TABBAR.md edge case).
{
  const bare = { role: "employee", permissions: { ...PERMISSION_PRESETS.estimator.values, requests: "none", quotes: "view_only", invoices: "view_only" } };
  check("a quotes-only reader is an estimator-set member", phoneBarSetFor(bare) === "estimator");
  const hollow = { role: "employee", permissions: { ...PERMISSION_PRESETS.worker.values, invoices: "view_only" } };
  const hb = phoneBarFor(hollow);
  check("an invoices-only reader (office set, Jobs survives; Invoices is in the sheet) keeps real tabs",
    hb.tabs.filter((t) => t.href !== "/app/chat" && t.href !== "/app/clock").length > 0);
}

// Legacy and unresolved callers keep the owner's bar, as before the split.
check("a null caller gets the office bar", phoneBarFor(null).set === "office" && phoneBarFor(null).tabs.length === 5);
check("a gridless employee keeps the office bar they had", phoneBarSetFor(legacy) === "office");
check("a gridless supervisor keeps the office bar they had", phoneBarSetFor({ role: "supervisor", permissions: null }) === "office");

// A feature that is off takes its tab with it, exactly as on the rail.
{
  const crewCaller = { role: PRESET_TO_ROLE.worker, permissions: PERMISSION_PRESETS.worker.values };
  const chatOff = { team_chat: { state: "hidden", visible: false, usable: false } };
  check("team_chat hidden → no Chat tab on the crew bar", !phoneBarFor(crewCaller, chatOff).tabs.some((t) => t.href === "/app/chat"));
}

// The More sheet subtracts the CALLER's bar (MoreMenu.js usePhoneSheetGroups),
// so an Estimator's sheet still reaches Jobs and Invoices and does not list
// Calendar twice. Source-level, because the hook needs React; the inputs it
// subtracts are the executed bars above.
{
  const moreSrc = readFileSync(new URL("../app/components/layout/MoreMenu.js", import.meta.url), "utf8");
  check("the sheet subtracts phoneBarFor(caller, flags), not a fixed list",
    /phoneBarFor\(caller, flags\)\.tabs/.test(moreSrc) && /!onBar\.has\(i\.href\)/.test(moreSrc) && !/TAB_HREFS/.test(moreSrc));
  const sidebarSrc = readFileSync(new URL("../app/components/layout/AdminSidebar.js", import.meta.url), "utf8");
  check("the rail pins through railPinsClock and drops the pinned row from More",
    /railPinsClock\(caller\) \? PINNED_CLOCK : NOTHING_PINNED/.test(sidebarSrc) &&
    /railPinsClock\(caller\) \? MORE_GROUPS_UNPINNED : MORE_GROUPS/.test(sidebarSrc));
}

// ── The crew shell: no accordion, one big clock button (2026-10-03) ─────────
//
// The owner: "for crews I don't think we need the accordion … just a little
// header with the button under it." lib/nav/crewShell.js decides who and
// which buttons; executed here against the real presets. Then the promise
// that makes removing the rail safe: every row the rail, the drawer, the
// avatar menu and Create offered a Crew member is still on a screen they
// can reach — their bar, their big buttons, or their More page.
console.log("\nThe crew shell — who gets it, what it carries, and nothing lost\n");
{
  const { usesCrewShell, crewButtonsFor, crewButtonActive, crewClockState, CREW_BUTTONS, CREW_CLOCK_HREF } =
    await import("../lib/nav/crewShell.js");
  const { contrastRatio } = await import("../lib/brand/colour.js");
  const crewCaller = { role: PRESET_TO_ROLE.worker, permissions: PERMISSION_PRESETS.worker.values };

  check("Crew get the crew shell", usesCrewShell(crewCaller) === true);
  check("…and still do with their clock switched off", usesCrewShell({ ...crewCaller, permissions: { ...crewCaller.permissions, timeTracking: "none" } }) === true);
  for (const name of ["estimator", "dispatcher", "manager"]) {
    check(`${name} keeps the rail`, usesCrewShell({ role: PRESET_TO_ROLE[name], permissions: PERMISSION_PRESETS[name].values }) === false);
  }
  check("owner keeps the rail", usesCrewShell(owner) === false);
  check("admin keeps the rail", usesCrewShell({ role: "admin", permissions: null }) === false);
  check("a null caller keeps the rail (no shell that flips while loading)", usesCrewShell(null) === false);
  check("a gridless member keeps the rail they had", usesCrewShell(legacy) === false);
  check("junk does not throw and keeps the rail", usesCrewShell({ role: 7 }) === false && usesCrewShell("crew") === false);

  const buttons = crewButtonsFor(crewCaller).map((b) => b.href);
  check(`Crew buttons: ${buttons.join(" · ")}`,
    JSON.stringify(buttons) === JSON.stringify(["/app", "/app/me/schedule", "/app/chat", "/app/jobs", "/app/me/more"]));
  check("every crew button is a real page", [...buttons, CREW_CLOCK_HREF].every((h) => pageExists(h)));
  check("every crew button but More passes navRowAllowed for its key",
    crewButtonsFor(crewCaller).filter((b) => b.href !== "/app/me/more").every((b) => navRowAllowed(b.key, crewCaller)));
  check("no money screen is a crew button", !CREW_BUTTONS.some((b) => ["/app/quotes", "/app/invoices", "/app/leads", "/app/payroll", "/app/me/earnings"].includes(b.href)));
  {
    const noJobs = { ...crewCaller, permissions: { ...crewCaller.permissions, jobs: "none" } };
    check("Jobs at No access → no Jobs button (never a link to a refusal)", !crewButtonsFor(noJobs).some((b) => b.href === "/app/jobs"));
    const chatOff = { team_chat: { state: "hidden", visible: false, usable: false } };
    check("team_chat hidden → no Chat button", !crewButtonsFor(crewCaller, chatOff).some((b) => b.href === "/app/chat"));
  }
  const today = CREW_BUTTONS.find((b) => b.href === "/app");
  const more = CREW_BUTTONS.find((b) => b.href === "/app/me/more");
  check("Today lights on /app only", crewButtonActive(today, "/app") && !crewButtonActive(today, "/app/jobs"));
  check("More lights on /app/me/more, not on /app/me/schedule", crewButtonActive(more, "/app/me/more") && !crewButtonActive(more, "/app/me/schedule"));

  // What the big button says — never "Clock in" on a guess.
  check("clock state: no answer → neutral", crewClockState(null) === "open" && crewClockState("x") === "open" && crewClockState({}) === "open");
  check("clock state: not on the roster → neutral (the clock page offers self-enrol)", crewClockState({ worker: null, open: null }) === "open");
  check("clock state: on the roster, nothing open → Clock in", crewClockState({ worker: { id: "w" }, open: null }) === "in");
  check("clock state: an open entry → Clock out", crewClockState({ worker: { id: "w" }, open: { clockIn: "2026-10-03T12:00:00Z", breaks: [{ end: "2026-10-03T12:30:00Z" }] } }) === "out");
  check("clock state: an open break → End break", crewClockState({ worker: { id: "w" }, open: { breaks: [{ end: null }] } }) === "break");
  check("clock state: junk breaks do not throw", crewClockState({ worker: { id: "w" }, open: { breaks: "x" } }) === "out");

  // Contrast, measured — the fills in the component source, the tokens in globals.css.
  const shellSrc = readFileSync(new URL("../app/components/layout/CrewShell.js", import.meta.url), "utf8");
  const fills = [...shellSrc.matchAll(/bg-\[(#[0-9a-fA-F]{6})\] text-white/g)].map((m) => m[1]);
  check(`the clock's three fixed fills are in the source (${fills.join(", ")})`, fills.length === 3);
  for (const hex of fills) check(`white on ${hex} ≥ 4.5:1 (${contrastRatio("#ffffff", hex).toFixed(2)})`, contrastRatio("#ffffff", hex) >= 4.5);
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const tok = (block, name) => (block.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`)) || [])[1];
  // The first `:root {` block is the light theme, `.dark {` the dark one.
  const rootAt = css.indexOf("\n:root {");
  const darkAt = css.indexOf("\n.dark {");
  const light = rootAt >= 0 && darkAt > rootAt ? css.slice(rootAt, darkAt) : "";
  const dark = darkAt >= 0 ? css.slice(darkAt, css.indexOf("\n}", darkAt)) : "";
  for (const [label, block] of [["light", light], ["dark", dark]]) {
    const pairs = [
      ["active button", tok(block, "inverted-foreground"), tok(block, "inverted")],
      ["button word", tok(block, "foreground"), tok(block, "card")],
      ["button border", tok(block, "muted-foreground"), tok(block, "card")],
    ];
    for (const [what, fg, bg] of pairs) {
      const r = fg && bg ? contrastRatio(fg, bg) : 0;
      check(`${label}: ${what} ${fg} on ${bg} ≥ 4.5:1 (${r.toFixed(2)})`, r >= 4.5);
    }
  }

  // Reachability. The rows the old shell offered a Crew member: every rail /
  // More row, the account rows and the Create rows, read from the source and
  // run through the real navRowAllowed. Each must land somewhere they reach.
  const sidebarSrc = readFileSync(new URL("../app/components/layout/AdminSidebar.js", import.meta.url), "utf8");
  const rows = [...sidebarSrc.matchAll(/\{ key: "(app\.(?:nav|quickAdd)\.[A-Za-z]+)", href: "([^"]+)"/g)].map((m) => ({ key: m[1], href: m[2] }));
  const before = rows.filter((r) => r.key !== "app.nav.influencer" && navRowAllowed(r.key, crewCaller));
  console.log(`  ·    Crew reached before (rail + More + account + Create): ${before.map((r) => r.href).join(", ")}`);
  const moreSrc = readFileSync(new URL("../app/app/me/more/page.js", import.meta.url), "utf8");
  const pageHrefs = JSON.parse((moreSrc.match(/const PAGE_HREFS = (\[[\s\S]*?\]);/) || [])[1]?.replace(/,\s*\]$/, "]") || "null");
  check("the More page names the rows it draws itself (PAGE_HREFS)", Array.isArray(pageHrefs) && pageHrefs.length > 0);
  // The exclusion list is only safe if the page really draws each of them.
  const drawn = (pageHrefs || []).filter((h) => moreSrc.includes(`href="${h}"`));
  check("…and every one of them IS a row on that page — the exclusion never hides a row",
    drawn.length === (pageHrefs || []).length, (pageHrefs || []).filter((h) => !drawn.includes(h)));
  check("Everything else is the rail's whole map: Home, NAV_GROUPS and MORE_GROUPS",
    /items: \[HOME_ITEM, \.\.\.NAV_GROUPS\.flatMap\(\(g\) => g\.items\), \.\.\.MORE_GROUPS\.flatMap\(\(g\) => g\.items\)\]/.test(moreSrc));
  check("…plus the account rows and the Create rows", /const CREW_ALL_ITEMS = \[\.\.\.BOTTOM_ITEMS, \.\.\.QUICK_ADD_ITEMS\];/.test(moreSrc));
  check("…through the rail's own filters (useNavGroups / useNavItems)", /useNavGroups\(CREW_ALL_GROUPS\)/.test(moreSrc) && /useNavItems\(CREW_ALL_ITEMS\)/.test(moreSrc));
  check("…and it is drawn for exactly the crew-shell callers", /crewShell \? <CrewEverythingElse pageDrawn \/> : null/.test(moreSrc) && /usesCrewShell\(caller, useFeatureFlags\(\)\)/.test(moreSrc));
  // Everything else leaves out only what the phone bar and the page itself
  // already draw — never the desktop buttons, which a phone does not have.
  check("Everything else subtracts the bar and the page's own rows, not the desktop buttons",
    /\.\.\.\(pageDrawn \? PAGE_HREFS : \[\]\),\s*CREW_CLOCK_HREF,\s*"\/app\/me\/more",\s*\.\.\.phoneBarFor\(caller, flags\)\.tabs\.map/.test(moreSrc) && !/CREW_BUTTONS/.test(moreSrc));
  check("…and when the page's own rows fail to load, the list stands alone and leaves none of them out",
    /<CrewEverythingElse pageDrawn \/>/.test(moreSrc) && /crewShell && !data && !loading \? \([\s\S]{0,80}<CrewEverythingElse pageDrawn=\{false\} \/>/.test(moreSrc));
  const bar = phoneBarFor(crewCaller).tabs.map((t) => t.href);
  check("every desktop button is also on the phone bar or the More page — the phone loses nothing",
    buttons.every((h) => h === "/app/me/more" || bar.includes(h) || (pageHrefs || []).includes(h)));
  // /app/more is the one row not carried over: it is a hub page of the
  // MORE_GROUPS rows, every one of which is in Everything else (asserted
  // above), and a "More" row on the page called More would be a loop.
  const placeOf = (h) =>
    h === "/app/more" ? "not linked — a hub of MORE_GROUPS rows, each of them in Everything else"
      : bar.includes(h) ? "phone bar" : (pageHrefs || []).includes(h) ? "More page" : "More › Everything else";
  console.log(`  ·    …after: ${before.map((r) => `${r.href} → ${placeOf(r.href)}${buttons.includes(r.href) || r.href === CREW_CLOCK_HREF ? " + desktop button" : ""}`).join("; ")}`);

  // The shells that used to carry them stand down for crew, and only for crew.
  check("the rail and the phone drawer draw nothing for crew", /const crewShell = usesCrewShell\(usePermissions\(\), featureFlags\);/.test(sidebarSrc) && /if \(crewShell\) return null;/.test(sidebarSrc));
  const topSrc = readFileSync(new URL("../app/components/layout/TopBar.js", import.meta.url), "utf8");
  check("the top bar drops its desktop header and its hamburger for crew", /\{!crew && \(\s*<header/.test(topSrc) && /\{!crew && \(\s*<button[\s\S]{0,120}shell\.open\("drawer"\)/.test(topSrc));
  const layoutSrc = readFileSync(new URL("../app/app/layout.js", import.meta.url), "utf8");
  check("the layout mounts the crew shell with the company's own name and logo", /<CrewShell companyName=\{company\?\.name \|\| null\} logoUrl=\{company\?\.logoUrl \|\| null\} \/>/.test(layoutSrc) && /logoUrl: true/.test(layoutSrc));
  check("the crew shell's clock follows the clock switch", /const clockOn = crew && clockOffered\(caller\);/.test(shellSrc) && /\{clockOn \? \(/.test(shellSrc));
}

console.log(`\n${pass + failures.length} checks, ${failures.length} failure(s).\n`);
if (failures.length) process.exitCode = 1;
