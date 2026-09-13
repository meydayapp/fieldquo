// scripts/check-employee-home.mjs
//
// Executes the employee home's pure rules against hostile input. No
// database (lib/me/home.js is loaded through the db stub), no React.
//
//   npm run check:employee-home
//
// What is proved, and why each block is here:
//
//   the tab set        who gets Home · Schedule · Earnings and who gets
//                      Home · Schedule · Team, for every preset AND for a
//                      gridless legacy member — the case hasLevel fails open
//                      on, where the wrong answer hands a crew member a
//                      coverage strip
//   the state machine  every action from every state by every actor: a peer
//                      approving, a manager accepting for the peer, the
//                      requester approving their own swap, anything on a
//                      request whose shift started — each refused; the
//                      legal path accepted, with and without approval
//   the claim path     an open shift's claim skips the peer step and lands
//                      on the manager (or is approved outright), and the
//                      swap it writes is one shift to one person
//   availability       the day shape refuses what the schedule table cannot
//                      hold, "apply now" is decided by UTC calendar day,
//                      the diff names the days that changed
//   the money gate     lib/payroll/ownPayGate.js says yes to the presets
//                      that hold payroll view_own and no to a grid at none
//   named recipients   a targeted event with nobody named reaches nobody;
//                      with a crew member named reaches exactly them
//   team state         the pure classifier behind the manager's Gantt
import assert from "node:assert/strict";
import { PERMISSION_PRESETS } from "@/lib/permissions";
import { ME_TABS, activeMeTab, isMePath, meTabSetFor, meTabsFor } from "@/lib/me/tabs";
import { ACTOR_ROLES, REQUEST_ACTIONS, REQUEST_STATES, TERMINAL_STATES, actorRole, initialState, swapWrites, transition } from "@/lib/shiftRequests/state";
import { coverAudience, mayAccept, openShiftEligible, tradePartners } from "@/lib/shiftRequests/eligibility";
import { appliesNow, diffWeeks, effectiveDate, normaliseDays, weeklyHours } from "@/lib/availability/days";
import { canSeeOwnPay } from "@/lib/payroll/ownPayGate";
import { selectRecipients } from "@/lib/notifications/recipients";
import { NOTIFICATION_TYPES } from "@/lib/notifications/catalog";
import { estimateForShift, teamState, TEAM_STATES } from "@/lib/me/home";
import { nextUp, sortItems } from "@/lib/me/timeline";
import { jobTone } from "@/lib/shifts/jobTone";
import { weekDatesAround } from "@/lib/shifts/weekDates";

let pass = 0;
const fails = [];
function check(name, fn) {
  try {
    fn();
    pass += 1;
  } catch (err) {
    fails.push(`${name}: ${err.message}`);
  }
}

const preset = (key, role = "employee") => ({ role, permissions: PERMISSION_PRESETS[key].values });

// ── 1. The tab set ──────────────────────────────────────────────────────────
check("owner and admin get the manager tabs whatever their grid", () => {
  assert.equal(meTabSetFor({ role: "owner" }), "manager");
  assert.equal(meTabSetFor({ role: "admin", permissions: { schedule: "view_own" } }), "manager");
});
check("Crew and Estimator get the worker tabs; Dispatcher and Manager the manager tabs", () => {
  assert.equal(meTabSetFor(preset("worker")), "worker");
  assert.equal(meTabSetFor(preset("estimator")), "worker");
  assert.equal(meTabSetFor(preset("dispatcher", "supervisor")), "manager");
  assert.equal(meTabSetFor(preset("manager", "supervisor")), "manager");
});
check("a gridless legacy member is a worker unless their seat runs a crew", () => {
  assert.equal(meTabSetFor({ role: "employee", permissions: null }), "worker");
  assert.equal(meTabSetFor({ role: "employee", permissions: {} }), "worker");
  assert.equal(meTabSetFor({ role: "supervisor", permissions: null }), "manager");
  assert.equal(meTabSetFor(null), "worker");
  assert.equal(meTabSetFor({ role: 42 }), "worker");
  assert.equal(meTabSetFor({ role: "employee", permissions: { schedule: "godmode" } }), "worker");
});
check("both sets are five tabs with Home first, Messages fourth, More last", () => {
  for (const set of Object.values(ME_TABS)) {
    assert.equal(set.length, 5);
    assert.equal(set[0].href, "/app/me");
    assert.equal(set[3].href, "/app/chat");
    assert.equal(set[4].href, "/app/me/more");
  }
  assert.equal(ME_TABS.worker[2].href, "/app/me/earnings");
  assert.equal(ME_TABS.manager[2].href, "/app/me/team");
  assert.equal(ME_TABS.manager[1].href, "/app/scheduler");
});
check("the active tab is exact for Home and a prefix for the rest", () => {
  const tabs = meTabsFor(preset("worker"));
  assert.equal(activeMeTab(tabs, "/app/me"), "/app/me");
  assert.equal(activeMeTab(tabs, "/app/me/earnings"), "/app/me/earnings");
  assert.equal(activeMeTab(tabs, "/app/me/requests"), null);
  assert.equal(activeMeTab(tabs, "/app/chat?room=x"), null);
  assert.equal(activeMeTab(tabs, "/app/chat"), "/app/chat");
});
check("isMePath is exact on /app/me and its subtree only", () => {
  assert.equal(isMePath("/app/me"), true);
  assert.equal(isMePath("/app/me/more"), true);
  assert.equal(isMePath("/app/messages"), false);
  assert.equal(isMePath("/app/meta"), false);
  assert.equal(isMePath(null), false);
});

// ── 2. The state machine ────────────────────────────────────────────────────
const future = new Date(Date.now() + 86_400_000);
const past = new Date(Date.now() - 3_600_000);
const base = { fromWorkerId: "w_marc", toWorkerId: "w_ana", kind: "cover", shiftId: "s1", shiftStart: future };
const MARC = { workerId: "w_marc", isManager: false };
const ANA = { workerId: "w_ana", isManager: false };
const LUIS = { workerId: "w_luis", isManager: false };
const BOSS = { workerId: "w_boss", isManager: true };

check("actorRole names requester, peer, manager, and nobody", () => {
  assert.equal(actorRole(base, MARC), "requester");
  assert.equal(actorRole(base, ANA), "peer");
  assert.equal(actorRole(base, BOSS), "manager");
  assert.equal(actorRole(base, LUIS), "none");
  // An open cover: anyone who is not the requester is a peer; the route checks eligibility.
  assert.equal(actorRole({ ...base, toWorkerId: null }, LUIS), "peer");
  // A claim: the claimant is the requester.
  assert.equal(actorRole({ ...base, fromWorkerId: null, toWorkerId: "w_ana" }, ANA), "requester");
  assert.equal(actorRole(null, ANA), "none");
});

check("the legal path with approval: peer accepts → pending_manager, manager approves → applies", () => {
  const r = { ...base, status: "pending_peer" };
  const a = transition({ request: r, action: "accept", actor: ANA });
  assert.equal(a.ok, true);
  assert.equal(a.next, "pending_manager");
  assert.equal(a.appliesSwap, false);
  const b = transition({ request: { ...r, status: "pending_manager" }, action: "approve", actor: BOSS });
  assert.equal(b.ok, true);
  assert.equal(b.next, "approved");
  assert.equal(b.appliesSwap, true);
});
check("without approval the peer's accept applies the swap", () => {
  const a = transition({ request: { ...base, status: "pending_peer" }, action: "accept", actor: ANA, options: { needsApproval: false } });
  assert.equal(a.next, "approved");
  assert.equal(a.appliesSwap, true);
});
check("a peer cannot approve; a manager cannot accept for the peer; the requester cannot accept or approve", () => {
  assert.equal(transition({ request: { ...base, status: "pending_manager" }, action: "approve", actor: ANA }).ok, false);
  assert.equal(transition({ request: { ...base, status: "pending_peer" }, action: "accept", actor: BOSS }).ok, false);
  assert.equal(transition({ request: { ...base, status: "pending_peer" }, action: "accept", actor: MARC }).ok, false);
  assert.equal(transition({ request: { ...base, status: "pending_manager" }, action: "approve", actor: MARC }).ok, false);
  // A requester who is ALSO a manager still cannot approve their own swap.
  assert.equal(transition({ request: { ...base, status: "pending_manager" }, action: "approve", actor: { ...MARC, isManager: true } }).ok, false);
});
check("approve before the peer has accepted is refused and says so", () => {
  const v = transition({ request: { ...base, status: "pending_peer" }, action: "approve", actor: BOSS });
  assert.equal(v.ok, false);
  assert.match(v.error, /hasn't accepted/);
});
check("a manager may decline at either pending state; a peer only while it waits on them", () => {
  assert.equal(transition({ request: { ...base, status: "pending_peer" }, action: "decline", actor: BOSS }).next, "declined");
  assert.equal(transition({ request: { ...base, status: "pending_manager" }, action: "decline", actor: BOSS }).next, "declined");
  assert.equal(transition({ request: { ...base, status: "pending_peer" }, action: "decline", actor: ANA }).next, "declined");
  assert.equal(transition({ request: { ...base, status: "pending_manager" }, action: "decline", actor: ANA }).ok, false);
  assert.equal(transition({ request: { ...base, status: "pending_peer" }, action: "decline", actor: LUIS }).ok, false);
});
check("only the requester can cancel, from either pending state", () => {
  assert.equal(transition({ request: { ...base, status: "pending_peer" }, action: "cancel", actor: MARC }).next, "cancelled");
  assert.equal(transition({ request: { ...base, status: "pending_manager" }, action: "cancel", actor: MARC }).next, "cancelled");
  assert.equal(transition({ request: { ...base, status: "pending_peer" }, action: "cancel", actor: ANA }).ok, false);
  assert.equal(transition({ request: { ...base, status: "pending_peer" }, action: "cancel", actor: BOSS }).ok, false);
});
check("terminal states accept nothing from anybody", () => {
  for (const status of TERMINAL_STATES) {
    for (const action of REQUEST_ACTIONS) {
      for (const actor of [MARC, ANA, BOSS, LUIS]) {
        assert.equal(transition({ request: { ...base, status }, action, actor }).ok, false, `${status}/${action}`);
      }
    }
  }
});
check("a started shift: everything is refused as expired, and only `expire` succeeds", () => {
  const r = { ...base, status: "pending_manager", shiftStart: past };
  for (const action of ["accept", "decline", "cancel", "approve"]) {
    for (const actor of [MARC, ANA, BOSS]) {
      const v = transition({ request: r, action, actor });
      assert.equal(v.ok, false, `${action}`);
      assert.equal(v.expired, true, `${action} flags expired`);
    }
  }
  assert.equal(transition({ request: r, action: "expire", actor: null }).next, "expired");
  assert.equal(transition({ request: { ...r, shiftStart: future }, action: "expire", actor: null }).ok, false);
});
check("junk states, junk actions and junk actors are refused, never thrown", () => {
  assert.equal(transition({ request: { ...base, status: "sideways" }, action: "accept", actor: ANA }).ok, false);
  assert.equal(transition({ request: { ...base, status: "pending_peer" }, action: "teleport", actor: ANA }).ok, false);
  assert.equal(transition({ request: { ...base, status: "pending_peer" }, action: "accept", actor: null }).ok, false);
  assert.equal(transition({ request: { ...base, status: "pending_peer" }, action: "accept", actor: { workerId: 42 } }).ok, false);
  assert.equal(transition({ request: null, action: "accept", actor: ANA }).ok, false);
  assert.equal(transition({}).ok, false);
  assert.deepEqual(REQUEST_STATES.length, 6);
  assert.ok(ACTOR_ROLES.includes("system"));
});
check("an open cover: anyone accepting becomes the peer, the requester still cannot", () => {
  const r = { ...base, toWorkerId: null, status: "pending_peer" };
  assert.equal(transition({ request: { ...r, toWorkerId: "w_luis" }, action: "accept", actor: LUIS }).ok, true);
  assert.equal(transition({ request: r, action: "accept", actor: MARC }).ok, false);
});

// ── 3. The claim path ───────────────────────────────────────────────────────
check("a claim skips the peer step; with no approval it is approved on arrival", () => {
  assert.equal(initialState({ kind: "cover", fromWorkerId: null, needsApproval: true }), "pending_manager");
  assert.equal(initialState({ kind: "cover", fromWorkerId: null, needsApproval: false }), "approved");
  assert.equal(initialState({ kind: "cover", fromWorkerId: "w_marc", needsApproval: false }), "pending_peer");
  assert.equal(initialState({ kind: "trade", fromWorkerId: "w_marc" }), "pending_peer");
});
check("swapWrites: a cover or claim moves one shift; a trade with an offered shift moves two; nothing without a taker", () => {
  assert.deepEqual(swapWrites({ shiftId: "s1", toWorkerId: "w_ana", kind: "cover", fromWorkerId: "w_marc" }), [{ shiftId: "s1", workerId: "w_ana" }]);
  assert.deepEqual(swapWrites({ shiftId: "s1", toWorkerId: "w_ana", kind: "cover", fromWorkerId: null }), [{ shiftId: "s1", workerId: "w_ana" }]);
  assert.deepEqual(swapWrites({ shiftId: "s1", toWorkerId: "w_ana", kind: "trade", fromWorkerId: "w_marc", offeredShiftId: "s2" }), [
    { shiftId: "s1", workerId: "w_ana" },
    { shiftId: "s2", workerId: "w_marc" },
  ]);
  assert.deepEqual(swapWrites({ shiftId: "s1", toWorkerId: null }), []);
  assert.deepEqual(swapWrites(null), []);
});
check("eligibility: same title first, then everyone; open shifts to any active worker; trades need a login", () => {
  const workers = [
    { id: "a", name: "A", title: "Foreman", userId: "u1", active: true },
    { id: "b", name: "B", title: "foreman ", userId: "u2", active: true },
    { id: "c", name: "C", title: "Helper", userId: null, active: true },
    { id: "d", name: "D", title: "Foreman", userId: "u4", active: false },
  ];
  assert.deepEqual(coverAudience(workers[0], workers).map((w) => w.id), ["b"]);
  assert.deepEqual(coverAudience({ id: "c", title: "Helper" }, workers).map((w) => w.id), ["a", "b"]);
  assert.deepEqual(coverAudience({ id: "z", title: null }, workers).map((w) => w.id), ["a", "b", "c"]);
  assert.equal(mayAccept({ fromWorkerId: "a", toWorkerId: null }, workers[1], workers), true);
  assert.equal(mayAccept({ fromWorkerId: "a", toWorkerId: null }, workers[2], workers), false);
  assert.equal(mayAccept({ fromWorkerId: "a", toWorkerId: "c" }, workers[2], workers), true);
  assert.equal(mayAccept({ fromWorkerId: "a", toWorkerId: "c" }, workers[0], workers), false);
  assert.equal(openShiftEligible({ workerId: null }, workers[2]), true);
  assert.equal(openShiftEligible({ workerId: "a" }, workers[2]), false);
  assert.equal(openShiftEligible({ workerId: null }, workers[3]), false);
  assert.deepEqual(tradePartners(workers[0], workers).map((w) => w.id), ["b"]);
});

// ── 4. Availability ─────────────────────────────────────────────────────────
check("normaliseDays accepts several ranges per day and refuses the schedule table cannot hold", () => {
  const ok = normaliseDays([
    { dayOfWeek: 1, startTime: "08:00", endTime: "12:00" },
    { dayOfWeek: 1, startTime: "14:00", endTime: "18:00" },
    { dayOfWeek: "3", startTime: "00:00", endTime: "23:59" },
  ]);
  assert.equal(ok.ok, true);
  assert.equal(ok.days.length, 3);
  assert.equal(ok.days[0].timezone, "America/Toronto");
  assert.equal(normaliseDays([]).ok, false);
  assert.equal(normaliseDays(null).ok, false);
  assert.equal(normaliseDays([{ dayOfWeek: 7, startTime: "08:00", endTime: "12:00" }]).ok, false);
  assert.equal(normaliseDays([{ dayOfWeek: 1, startTime: "24:00", endTime: "25:00" }]).ok, false);
  assert.equal(normaliseDays([{ dayOfWeek: 1, startTime: "12:00", endTime: "08:00" }]).ok, false);
  assert.equal(normaliseDays([{ dayOfWeek: 1, startTime: "08:00", endTime: "12:00" }, { dayOfWeek: 1, startTime: "10:00", endTime: "14:00" }]).ok, false);
  assert.equal(normaliseDays([{ dayOfWeek: 1, startTime: "08:00", endTime: "12:00" }, null]).ok, false);
  assert.equal(normaliseDays([{ dayOfWeek: 1, startTime: "08:00", endTime: "12:00", timezone: "Europe/Paris" }]).days[0].timezone, "Europe/Paris");
});
check("effectiveDate reads YYYY-MM-DD only, as UTC midnight", () => {
  assert.equal(effectiveDate("2026-09-21").toISOString(), "2026-09-21T00:00:00.000Z");
  assert.equal(effectiveDate("21/09/2026"), null);
  assert.equal(effectiveDate("2026-13-40"), null);
  assert.equal(effectiveDate(20260921), null);
});
check("appliesNow is decided by UTC calendar day: today and the past yes, tomorrow no", () => {
  const now = new Date("2026-09-21T23:30:00.000Z");
  assert.equal(appliesNow(new Date("2026-09-21T00:00:00.000Z"), now), true);
  assert.equal(appliesNow(new Date("2026-09-01T00:00:00.000Z"), now), true);
  assert.equal(appliesNow(new Date("2026-09-22T00:00:00.000Z"), now), false);
  assert.equal(appliesNow("garbage", now), false);
});
check("diffWeeks names the days that changed; weeklyHours adds the ranges up", () => {
  const current = [{ dayOfWeek: 1, startTime: "08:00", endTime: "16:00" }, { dayOfWeek: 2, startTime: "08:00", endTime: "16:00" }];
  const proposed = [{ dayOfWeek: 1, startTime: "08:00", endTime: "12:00" }, { dayOfWeek: 2, startTime: "08:00", endTime: "16:00" }, { dayOfWeek: 6, startTime: "09:00", endTime: "13:00" }];
  const d = diffWeeks(current, proposed);
  assert.equal(d.length, 7);
  assert.equal(d[1].changed, true);
  assert.equal(d[2].changed, false);
  assert.equal(d[6].changed, true);
  assert.deepEqual(d[6].before, []);
  assert.equal(weeklyHours(proposed), 16);
  assert.equal(weeklyHours([{ startTime: "x", endTime: "y" }]), 0);
  assert.equal(weeklyHours(null), 0);
});

// ── 5. The money gate ───────────────────────────────────────────────────────
check("canSeeOwnPay: owners always; presets with payroll view_own yes; a grid at none no", () => {
  assert.equal(canSeeOwnPay({ role: "owner", permissions: { payroll: "none" } }), true);
  assert.equal(canSeeOwnPay(preset("worker")), PERMISSION_PRESETS.worker.values.payroll !== "none");
  assert.equal(canSeeOwnPay(preset("dispatcher", "supervisor")), true);
  assert.equal(canSeeOwnPay({ role: "employee", permissions: { payroll: "none" } }), false);
  assert.equal(canSeeOwnPay(null), false);
  assert.equal(canSeeOwnPay({ role: 7 }), false);
});

// ── 6. Named recipients ─────────────────────────────────────────────────────
const CAST = [
  { id: "m_owner", userId: "u_owner", role: "owner", permissions: null, active: true },
  { id: "m_crew", userId: "u_crew", role: "employee", permissions: PERMISSION_PRESETS.worker.values, active: true },
  { id: "m_est", userId: "u_est", role: "employee", permissions: PERMISSION_PRESETS.estimator.values, active: true },
  { id: "m_gone", userId: "u_gone", role: "employee", permissions: PERMISSION_PRESETS.worker.values, active: false },
];
check("the six employee-home types are in the catalog with the audiences the routes rely on", () => {
  for (const t of ["shift.request.peer", "shift.request.manager", "shift.request.decided", "availability.requested", "availability.decided", "shoutout.received"]) {
    assert.ok(NOTIFICATION_TYPES[t], t);
    assert.equal(NOTIFICATION_TYPES[t].money, false, t);
  }
  assert.deepEqual(NOTIFICATION_TYPES["shift.request.manager"].audience, { capability: "user:manage" });
  assert.deepEqual(NOTIFICATION_TYPES["shoutout.received"].audience, { category: "schedule", level: "view_own" });
});
check("a worker-facing type named to one crew member reaches exactly them; named to nobody reaches nobody; a departed member never", () => {
  const ids = (list) => list.map((m) => m.id).sort();
  assert.deepEqual(ids(selectRecipients({ members: CAST, type: "shoutout.received", recipientUserIds: ["u_crew"] })), ["m_crew"]);
  assert.deepEqual(ids(selectRecipients({ members: CAST, type: "shift.request.peer", recipientUserIds: [] })), []);
  assert.deepEqual(ids(selectRecipients({ members: CAST, type: "shift.request.decided", recipientUserIds: ["u_gone", "u_est"] })), ["m_est"]);
  // The actor is never told what they did, even when named.
  assert.deepEqual(ids(selectRecipients({ members: CAST, type: "shoutout.received", recipientUserIds: ["u_crew"], actorUserId: "u_crew" })), []);
  // Naming cannot widen: a crew member is not user:manage.
  assert.deepEqual(ids(selectRecipients({ members: CAST, type: "shift.request.manager", recipientUserIds: ["u_crew", "u_owner"] })), ["m_owner"]);
});

// ── 7. Team state and the timeline ──────────────────────────────────────────
const T = (h, m = 0) => new Date(Date.UTC(2026, 8, 14, h, m));
check("teamState classifies clocked in / on break / late / scheduled / clocked out / no-show / off", () => {
  const shift = { start: T(8), end: T(16) };
  assert.equal(teamState({ shifts: [shift], entries: [{ clockIn: T(7, 55), clockOut: null, breaks: [] }], now: T(10) }), "clocked_in");
  assert.equal(teamState({ shifts: [shift], entries: [{ clockIn: T(7, 55), clockOut: null, breaks: [{ start: T(9, 50), end: null }] }], now: T(10) }), "on_break");
  assert.equal(teamState({ shifts: [shift], entries: [], now: T(8, 5) }), "scheduled");
  assert.equal(teamState({ shifts: [shift], entries: [], now: T(8, 20) }), "late");
  assert.equal(teamState({ shifts: [shift], entries: [{ clockIn: T(8), clockOut: T(15), breaks: [] }], now: T(15, 30) }), "clocked_out");
  assert.equal(teamState({ shifts: [shift], entries: [], now: T(17) }), "no_show");
  assert.equal(teamState({ shifts: [shift], entries: [], now: T(6) }), "scheduled");
  assert.equal(teamState({ shifts: [], entries: [], now: T(10) }), "off");
  assert.equal(TEAM_STATES.length, 7);
});
check("estimateForShift: hours net of unpaid breaks × rate; null without a rate", () => {
  const shift = { start: T(8), end: T(16), breaks: [{ start: T(12), end: T(12, 30), paid: false }, { start: T(10), end: T(10, 15), paid: true }] };
  assert.deepEqual(estimateForShift(shift, 20), { hours: 7.5, amount: 150 });
  assert.equal(estimateForShift(shift, null), null);
  assert.equal(estimateForShift(shift, "abc"), null);
});
check("nextUp is the first item that has not ended, events excluded; sortItems puts a shift before a visit at the same instant", () => {
  const items = [
    { kind: "event", id: "e", start: T(0) },
    { kind: "visit", id: "v", start: T(9), end: null },
    { kind: "shift", id: "s", start: T(9), end: T(17) },
    { kind: "task", id: "t", start: T(13), end: null },
  ];
  assert.equal(sortItems(items).map((i) => i.id).join(""), "evst".replace("v", "").replace("s", "sv"));
  assert.equal(nextUp(items, T(8)).id, "s");
  assert.equal(nextUp(items, T(12)).id, "s");
  assert.equal(nextUp(items, T(18)), null);
  assert.equal(nextUp([], T(8)), null);
});

// ── 8. The week grid's small pure pieces ────────────────────────────────────
check("jobTone is stable per job id and never the same slot for a missing id", () => {
  assert.equal(jobTone("job_a"), jobTone("job_a"));
  assert.equal(jobTone(null), "bg-muted text-foreground");
  assert.match(jobTone("x"), /^bg-/);
});
check("weekDatesAround returns the seven days of the date's week from the company's week start", () => {
  const w = weekDatesAround("2026-09-16", 1); // a Wednesday, weeks start Monday
  assert.equal(w.length, 7);
  assert.equal(w[0].ymd, "2026-09-14");
  assert.equal(w[6].ymd, "2026-09-20");
  assert.equal(w[0].dow, 1);
  assert.deepEqual(weekDatesAround("garbage", 1), []);
  assert.equal(weekDatesAround("2026-09-16", 0)[0].ymd, "2026-09-13");
});

console.log(`check-employee-home: ${pass} passed, ${fails.length} failed`);
for (const f of fails) console.log(`  FAIL ${f}`);
process.exit(fails.length ? 1 : 0);
