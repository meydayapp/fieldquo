// scripts/check-time-activities.mjs
//
//   npm run check:time-activities
//
// The time clock's activity tiles (2026-10-03): On site, Driving, Office,
// Supplies, Break, Lunch, General; the Time log; "This week" on the crew's
// home; the clock in the crew's own menu.
//
// ══ WHAT THIS EXECUTES ═════════════════════════════════════════════════════
//
// The shipped routes — app/api/time-clock (POST action "activity", "out"),
// app/api/time-clock/log and app/api/settings/time-activities — against
// scripts/fixtures/timeClockDb.mjs, the fixture whose filter engine APPLIES
// the nested Prisma operators (see its header). Loaded the same way
// check:time-clock-job loads the route:
//
//   node --import ./scripts/alias-loader.mjs \
//        --import ./scripts/timeclock-stub-loader.mjs scripts/check-time-activities.mjs
//
// The pure modules (lib/timeclock/activities.js, segments.js, entryHours.js,
// todayHours.js, lib/costing/*) are the shipped files.
//
// ══ THE MONEY PROOF ════════════════════════════════════════════════════════
//
// "Pay for existing entries stays byte-identical" is proved, not asserted:
// the clock-out arithmetic as it stood on origin/main before this change is
// copied below VERBATIM (OLD_entryHours, OLD_todayHoursFrom), both versions
// are run over the same 2,000 generated legacy entries (no `paid`, breaks
// paid and unpaid, open and closed), and the md5 of the two outputs must
// match. A legacy punch's write payload is diffed the same way.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { rows, writes, session, reset } from "@/lib/db";
import { POST as clockPOST, GET as clockGET } from "@/app/api/time-clock/route.js";
import { GET as logGET } from "@/app/api/time-clock/log/route.js";
import { GET as weekGET } from "@/app/api/time-clock/week/route.js";
import { PATCH as settingsPATCH } from "@/app/api/settings/time-activities/route.js";
import { entryHours } from "@/lib/timeclock/entryHours";
import { todayHoursFrom } from "@/lib/timeclock/todayHours";
import {
  resolveTimeActivities,
  sanitiseTimeActivities,
  effectiveActivity,
  checkActivityJob,
} from "@/lib/timeclock/activities";
import {
  entrySegments,
  dayBoundsForDate,
  buildDayLog,
  segmentTotals,
  weekStartInZone,
  isoDayInZone,
} from "@/lib/timeclock/segments";
import { actualJobCost } from "@/lib/costing/actualJobCost";
import { unattributedLabourForJob } from "@/lib/costing/unattributedHours";
import { queuedPunchState } from "@/lib/offline/punchState";
import { PERMISSION_PRESETS } from "@/lib/permissions";
import { meTabsFor, activeMeTab } from "@/lib/me/tabs";
import { isCrewHome } from "@/lib/dashboard/crewHome";
import { navRowAllowed } from "@/lib/permissions/nav";

let pass = 0;
const failures = [];
const ok = (name, cond, got) => {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name}${got !== undefined ? `   got: ${JSON.stringify(got)}` : ""}`);
  }
};
const section = (title) => console.log(`\n── ${title} ${"─".repeat(Math.max(0, 66 - title.length))}`);
const md5 = (v) => createHash("md5").update(JSON.stringify(v)).digest("hex");

// Activity rows write through recordActivity, which the fixture does not
// script; it logs and carries on (its own never-throws contract). Silenced
// here so the output is the assertions.
const realError = console.error;
console.error = (...a) => (String(a[0]).includes("[activity]") ? undefined : realError(...a));
const realWarn = console.warn;
console.warn = (...a) => (String(a[0]).includes("[activity]") ? undefined : realWarn(...a));

// ═══════════════════════════════════════════════════════════════════════════
// Fixtures
// ═══════════════════════════════════════════════════════════════════════════

const OURS = "co_ours";
const TZ = "America/Toronto";
const HOUR = 3_600_000;
const grid = (key) => PERMISSION_PRESETS[key].values;

const CREW = { id: "mem_crew", userId: "usr_crew", companyId: OURS, role: "employee", permissions: grid("worker") };
const OTHER = { id: "mem_other", userId: "usr_other", companyId: OURS, role: "employee", permissions: grid("worker") };
const OWNER = { id: "mem_owner", userId: "usr_owner", companyId: OURS, role: "owner", permissions: null };

function seed({ member = CREW, policy = null, entries = [], breaks = [], jobs = [], visits = [] } = {}) {
  reset();
  session.member = { ...member };
  rows.company = [{ id: OURS, timezone: TZ, timeActivities: policy, weekStartsOn: 1 }];
  rows.member = [CREW, OTHER, OWNER].map((m) => ({ ...m }));
  rows.worker = [
    { id: "wrk_crew", companyId: OURS, userId: "usr_crew", name: "Dee", hourlyRate: 30 },
    { id: "wrk_other", companyId: OURS, userId: "usr_other", name: "Ana", hourlyRate: 28 },
  ];
  rows.job = jobs;
  rows.jobVisit = visits;
  rows.timeEntry = entries;
  rows.timeEntryBreak = breaks;
}

// A job the crew member is assigned to today, so the shipped clockableJobWhere
// (Crew is scoped to assigned jobs) lets them book time to it.
const job = (id, over = {}) => ({
  id,
  companyId: OURS,
  title: `Job ${id}`,
  status: "in_progress",
  archivedAt: null,
  updatedAt: new Date("2026-09-01T00:00:00.000Z"),
  client: { name: "Client" },
  ...over,
});
const visit = (jobId) => ({
  id: `v_${jobId}`,
  jobId,
  assignedToId: "usr_crew",
  scheduledAt: new Date(),
  status: "scheduled",
});

const post = (body) =>
  new Request("http://x/api/time-clock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
async function call(handler, req) {
  const res = await handler(req);
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}
const ago = (h) => new Date(Date.now() - h * HOUR);
const open = () => rows.timeEntry.filter((e) => e.workerId === "wrk_crew" && e.clockOut == null);

// ═══════════════════════════════════════════════════════════════════════════
section("1. The policy — defaults, sanitising, the job rule");
// ═══════════════════════════════════════════════════════════════════════════
{
  const d = resolveTimeActivities(null);
  ok("seven tiles in drawing order", d.map((a) => a.key).join(",") === "visit,driving,office,supplies,break,lunch,general", d.map((a) => a.key));
  ok("never configured: every tile on", d.every((a) => a.enabled));
  ok("never configured: work paid, break and lunch unpaid (the rule the clock always had)",
    d.filter((a) => a.paid).map((a) => a.key).join(",") === "visit,driving,office,supplies,general");
  const junk = resolveTimeActivities({ visit: { enabled: false, paid: false }, general: { enabled: false }, driving: { enabled: "no", paid: "yes" }, bogus: { enabled: false } });
  ok("On site and General cannot be switched off; On site cannot be made unpaid",
    junk.find((a) => a.key === "visit").enabled && junk.find((a) => a.key === "visit").paid && junk.find((a) => a.key === "general").enabled);
  ok("junk values resolve to the defaults, never to `false`",
    junk.find((a) => a.key === "driving").enabled === true && junk.find((a) => a.key === "driving").paid === true);
  const stored = sanitiseTimeActivities({
    supplies: { label: "  Supply\u0000 run  ", enabled: true },
    break: { paid: true },
    office: { enabled: false },
    visit: { enabled: false, paid: false, label: "x".repeat(80) },
    hack: { enabled: false },
  });
  ok("sanitise keeps only what differs from the defaults, cleans labels, caps length, drops unknown keys",
    JSON.stringify(stored) === JSON.stringify({ visit: { label: "x".repeat(24) }, office: { enabled: false }, supplies: { label: "Supply run" }, break: { paid: true } }),
    stored);
  ok("On site needs a job", checkActivityJob("visit", null).error === "job_required");
  ok("Office refuses one", checkActivityJob("office", "j1").error === "job_not_allowed");
  ok("Driving may take one or not", !checkActivityJob("driving", "j1").error && !checkActivityJob("driving", null).error);
  ok("only On site books to a plan step", checkActivityJob("driving", "j1", "t1").error === "step_not_allowed");
  ok("an old entry with a job reads as On site, without one as General — read, never rewritten",
    effectiveActivity({ activity: null, jobId: "j" }) === "visit" && effectiveActivity({ activity: null, jobId: null }) === "general");
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. Switching closes one segment and opens the next, on the server");
// ═══════════════════════════════════════════════════════════════════════════
{
  seed({ jobs: [job("j1"), job("j2")], visits: [visit("j1"), visit("j2")] });
  let r = await call(clockPOST, post({ action: "activity", activity: "driving" }));
  ok("off the clock, a work tile clocks in", r.status === 200 && r.body?.open?.activity === "driving", r);
  ok("…with the activity and the pay rule stamped on the entry", rows.timeEntry[0].activity === "driving" && rows.timeEntry[0].paid === true);
  ok("…and no job (Driving unlinked)", rows.timeEntry[0].jobId === null);

  r = await call(clockPOST, post({ action: "activity", activity: "break" }));
  ok("Break from the clock is a break on the running entry, not an entry", r.status === 200 && rows.timeEntry.length === 1 && rows.timeEntryBreak.length === 1, r);

  // Age the entry past the mis-tap window so the next tap is a real switch.
  rows.timeEntry[0].clockIn = ago(2);
  rows.timeEntryBreak[0].start = ago(1);
  r = await call(clockPOST, post({ action: "activity", activity: "visit", jobId: "j1" }));
  ok("a different tile switches", r.status === 200 && r.body?.open?.activity === "visit" && r.body?.open?.jobId === "j1", r);
  const [first, second] = rows.timeEntry;
  ok("the first segment is CLOSED at the switch instant", first.clockOut instanceof Date && Math.abs(first.clockOut - second.clockIn) === 0);
  ok("the running break closed at the same instant", rows.timeEntryBreak[0].end instanceof Date && +rows.timeEntryBreak[0].end === +first.clockOut);
  ok("the closed segment's hours are net of its unpaid break (2 h less 1 h)", Math.abs(Number(first.hours) - 1) < 0.02, first.hours);
  ok("exactly one entry is open afterwards", open().length === 1 && open()[0].id === second.id);

  r = await call(clockPOST, post({ action: "activity", activity: "visit", jobId: "j1" }));
  ok("tapping what is already running (no break) is refused, not doubled", r.status === 409 && open().length === 1, r);

  r = await call(clockPOST, post({ action: "activity", activity: "lunch" }));
  ok("Lunch starts a break on the On site entry", r.status === 200 && rows.timeEntryBreak.filter((b) => b.timeEntryId === second.id && b.end == null).length === 1);
  rows.timeEntryBreak.at(-1).start = ago(0.5);
  r = await call(clockPOST, post({ action: "activity", activity: "visit", jobId: "j1" }));
  ok("the same tile during a break ENDS the break — the stretch carries on, no new entry",
    r.status === 200 && rows.timeEntry.length === 2 && rows.timeEntryBreak.at(-1).end instanceof Date, r);

  r = await call(clockPOST, post({ action: "activity", activity: "visit" }));
  ok("On site with no job is refused", r.status === 400 && /job/i.test(r.body?.error || ""), r);
  r = await call(clockPOST, post({ action: "activity", activity: "office", jobId: "j1" }));
  ok("Office with a job is refused", r.status === 400, r);
  r = await call(clockPOST, post({ action: "activity", activity: "visit", jobId: "j_foreign" }));
  ok("a job the crew member may not book to is refused", r.status === 400, r);
  r = await call(clockPOST, post({ action: "activity", activity: "teleport" }));
  ok("an unknown activity is refused", r.status === 400, r);
}

{
  // Switched off by the company → refused by the server, not just undrawn.
  seed({ policy: { supplies: { enabled: false } } });
  const r = await call(clockPOST, post({ action: "activity", activity: "supplies" }));
  ok("a switched-off activity is refused by the server", r.status === 400 && rows.timeEntry.length === 0, r);
  const g = await call(clockGET, new Request("http://x/api/time-clock"));
  ok("…and GET hands the screen the policy that says so", g.body?.activities?.find((a) => a.key === "supplies")?.enabled === false, g.body?.activities);
}

{
  seed();
  const r = await call(clockPOST, post({ action: "activity", activity: "break" }));
  ok("Break off the clock is refused — a break is taken FROM the clock", r.status === 409 && rows.timeEntryBreak.length === 0, r);
}

{
  // The mis-tap window: a tile corrected within a minute re-points.
  seed();
  await call(clockPOST, post({ action: "activity", activity: "office" }));
  const r = await call(clockPOST, post({ action: "activity", activity: "general" }));
  ok("a tile corrected within the mis-tap minute re-points the entry instead of leaving a 0.01 h row",
    r.status === 200 && r.body?.corrected === true && rows.timeEntry.length === 1 && rows.timeEntry[0].activity === "general", r);
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. Clock out ends the day");
// ═══════════════════════════════════════════════════════════════════════════
{
  seed({
    entries: [{ id: "te1", workerId: "wrk_crew", clockIn: ago(3), clockOut: null, jobId: null, activity: "office", paid: true, status: "pending" }],
    breaks: [{ id: "b1", timeEntryId: "te1", start: ago(1), end: null, kind: "break", paid: false }],
  });
  const r = await call(clockPOST, post({ action: "out" }));
  ok("Clock out closes the open segment", r.status === 200 && rows.timeEntry[0].clockOut instanceof Date, r);
  ok("…closes the running break at the same instant", +rows.timeEntryBreak[0].end === +rows.timeEntry[0].clockOut);
  ok("…and books hours net of it (3 h less 1 h)", Math.abs(Number(rows.timeEntry[0].hours) - 2) < 0.02, rows.timeEntry[0].hours);
  ok("…leaving nothing open", open().length === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. Payroll and job costing");
// ═══════════════════════════════════════════════════════════════════════════
{
  // On site → the job's labour.
  seed({
    jobs: [job("j1")],
    visits: [visit("j1")],
    entries: [{ id: "te1", workerId: "wrk_crew", clockIn: ago(4), clockOut: null, jobId: "j1", activity: "visit", paid: true, status: "pending" }],
  });
  await call(clockPOST, post({ action: "activity", activity: "driving", jobId: "j1" }));
  rows.timeEntry[1].clockIn = ago(2);
  await call(clockPOST, post({ action: "activity", activity: "driving" }));
  rows.timeEntry[2].clockIn = ago(1);
  await call(clockPOST, post({ action: "out" }));
  const [visitEntry, drivingLinked, drivingUnlinked] = rows.timeEntry;
  ok("On site time carries the job", visitEntry.jobId === "j1" && visitEntry.activity === "visit");
  ok("Driving linked to a job carries it", drivingLinked.jobId === "j1" && drivingLinked.activity === "driving");
  ok("Driving unlinked carries none", drivingUnlinked.jobId === null);

  // Job costing reads `where: { jobId }` and multiplies approved hours by
  // the rate — run the shipped arithmetic over exactly that selection.
  const forJob = rows.timeEntry
    .filter((e) => e.jobId === "j1")
    .map((e) => ({ ...e, status: "approved", worker: { hourlyRate: 30 } }));
  const cost = actualJobCost([], forJob);
  const expected = (Number(visitEntry.hours) + Number(drivingLinked.hours)) * 30;
  ok("the job's labour = On site + linked Driving, at the rate", Math.abs(cost.labour.cost - expected) < 0.01 && forJob.length === 2, { cost: cost.labour, expected });

  // Unattributed: unlinked Driving still counts as a gap; Office/General are
  // declared overhead and do not.
  rows.timeEntry.push(
    { id: "te_off", workerId: "wrk_crew", clockIn: ago(1.5), clockOut: ago(1.4), hours: 0.1, jobId: null, activity: "office", paid: true, status: "pending" },
    { id: "te_old", workerId: "wrk_crew", clockIn: ago(1.3), clockOut: ago(1.2), hours: 0.1, jobId: null, activity: null, paid: true, status: "pending" },
  );
  const un = await unattributedLabourForJob(
    (await import("@/lib/db")).db,
    { companyId: OURS, jobId: "j1", attributed: [{ clockIn: ago(5), clockOut: new Date() }] },
  );
  const unHours = un?.hours ?? 0;
  const expectUn = Number(drivingUnlinked.hours) + 0.1; // unlinked driving + the old null-activity row
  ok("unattributed hours keep unlinked Driving and old untagged rows, and leave Office out",
    Math.abs(unHours - expectUn) < 0.02, { unHours, expectUn });
}

{
  // Breaks paid / unpaid per the company setting.
  const run = async (policy) => {
    seed({
      policy,
      entries: [{ id: "te1", workerId: "wrk_crew", clockIn: ago(3), clockOut: null, jobId: null, activity: "general", paid: true, status: "pending" }],
    });
    await call(clockPOST, post({ action: "activity", activity: "break" }));
    rows.timeEntryBreak[0].start = ago(1);
    await call(clockPOST, post({ action: "activity", activity: "general" }));
    await call(clockPOST, post({ action: "out" }));
    return { brk: rows.timeEntryBreak[0], hours: Number(rows.timeEntry[0].hours) };
  };
  const unpaid = await run(null);
  ok("default: a break is recorded unpaid and comes off the hours (3 h → 2 h)", unpaid.brk.paid !== true && Math.abs(unpaid.hours - 2) < 0.02, unpaid);
  const paid = await run({ break: { paid: true } });
  ok("company says breaks are paid: recorded paid, hours untouched (3 h)", paid.brk.paid === true && Math.abs(paid.hours - 3) < 0.02, paid);
  const lunch = await (async () => {
    seed({ entries: [{ id: "te1", workerId: "wrk_crew", clockIn: ago(3), clockOut: null, jobId: null, activity: "general", paid: true, status: "pending" }] });
    await call(clockPOST, post({ action: "break_start", kind: "lunch" }));
    return rows.timeEntryBreak[0];
  })();
  ok("Lunch from the old break_start action: as today (schema-default unpaid)", lunch.kind === "lunch" && lunch.paid === undefined, lunch);
}

{
  // An activity the company does not pay for books 0 h — payroll and costing
  // read `hours`, so neither pays nor costs it.
  seed({ policy: { driving: { paid: false } } });
  await call(clockPOST, post({ action: "activity", activity: "driving" }));
  ok("an unpaid activity is stamped unpaid at clock-in", rows.timeEntry[0].paid === false);
  rows.timeEntry[0].clockIn = ago(2);
  await call(clockPOST, post({ action: "out" }));
  ok("…and books 0 h when it closes", Number(rows.timeEntry[0].hours) === 0, rows.timeEntry[0].hours);
  ok("the live total leaves a running unpaid stretch out",
    todayHoursFrom([{ clockIn: ago(2), clockOut: null, paid: false }]) === 0 && todayHoursFrom([{ clockIn: ago(2), clockOut: null }]) === 2);

  // Changing the setting later never re-prices a stretch already opened.
  seed({ policy: null });
  await call(clockPOST, post({ action: "activity", activity: "driving" }));
  session.member = { ...OWNER };
  const p = await call(settingsPATCH, new Request("http://x", { method: "PATCH", body: JSON.stringify({ activities: { driving: { paid: false } } }) }));
  session.member = { ...CREW };
  ok("an owner may change the policy", p.status === 200 && rows.company[0].timeActivities?.driving?.paid === false, p);
  ok("…the entry already open keeps the rule it opened under", rows.timeEntry[0].paid === true);
  session.member = { ...OTHER };
  const denied = await call(settingsPATCH, new Request("http://x", { method: "PATCH", body: JSON.stringify({ activities: { driving: { paid: true } } }) }));
  ok("a crew member may not change it", denied.status === 403 && rows.company[0].timeActivities?.driving?.paid === false, denied);
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. Existing entries: pay byte-identical (md5)");
// ═══════════════════════════════════════════════════════════════════════════
//
// Copied VERBATIM from origin/main's lib/timeclock/entryHours.js and
// lib/timeclock/todayHours.js as they stood before this change. Do not edit.
const OLD_MS_HOUR = 3_600_000;
const OLD_toMs = (v) => {
  if (v instanceof Date) return v.getTime();
  if (typeof v === "number") return v;
  if (v == null || v === "") return NaN;
  return new Date(v).getTime();
};
function OLD_unpaidBreakMs(breaks, clockIn, clockOut) {
  const s = OLD_toMs(clockIn);
  const e = OLD_toMs(clockOut);
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return 0;
  let total = 0;
  for (const b of Array.isArray(breaks) ? breaks : []) {
    if (!b || b.paid === true) continue;
    const bs = OLD_toMs(b.start);
    const be = b.end == null ? e : OLD_toMs(b.end);
    if (!Number.isFinite(bs) || !Number.isFinite(be)) continue;
    const from = Math.max(bs, s);
    const to = Math.min(be, e);
    if (to > from) total += to - from;
  }
  return total;
}
function OLD_entryHours(clockIn, clockOut, breaks = []) {
  const s = OLD_toMs(clockIn);
  const e = OLD_toMs(clockOut);
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return null;
  const worked = e - s - OLD_unpaidBreakMs(breaks, s, e);
  return Math.round((Math.max(0, worked) / OLD_MS_HOUR) * 100) / 100;
}
function OLD_todayHoursFrom(entries, now = Date.now()) {
  if (!Array.isArray(entries)) return null;
  const at = now instanceof Date ? now.getTime() : Number(now);
  let total = 0;
  for (const e of entries) {
    if (!e) continue;
    if (e.clockOut) {
      const booked = Number(e.hours);
      if (Number.isFinite(booked)) total += booked;
      continue;
    }
    const started = new Date(e.clockIn).getTime();
    if (!Number.isFinite(started)) continue;
    const elapsed = Math.max(0, at - started);
    total += Math.max(0, elapsed - OLD_unpaidBreakMs(e.breaks, started, at)) / 3_600_000;
  }
  return Math.round(total * 100) / 100;
}
{
  // A seeded generator, so the fixture is the same on every run.
  let s = 20261003;
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const base = Date.UTC(2026, 8, 1, 11);
  const legacy = [];
  for (let i = 0; i < 2000; i++) {
    const start = base + Math.floor(rnd() * 40 * 24) * HOUR / 4;
    const len = Math.floor(rnd() * 14 * 60) * 60_000;
    const breaks = [];
    const nb = Math.floor(rnd() * 3);
    for (let b = 0; b < nb; b++) {
      const bs = start + Math.floor(rnd() * len);
      breaks.push({
        start: new Date(bs),
        end: rnd() < 0.15 ? null : new Date(bs + Math.floor(rnd() * 90) * 60_000),
        kind: rnd() < 0.5 ? "lunch" : "break",
        paid: rnd() < 0.25,
      });
    }
    legacy.push({ clockIn: new Date(start), clockOut: rnd() < 0.1 ? null : new Date(start + len), breaks, jobId: rnd() < 0.6 ? "j" : null });
  }
  const oldHours = legacy.map((e) => OLD_entryHours(e.clockIn, e.clockOut || new Date(base + 50 * 24 * HOUR), e.breaks));
  // The new signature, called the way every caller now calls it — with the
  // entry's `paid`, which a legacy row does not have (undefined) or has as
  // the column default (true).
  const newUndefined = legacy.map((e) => entryHours(e.clockIn, e.clockOut || new Date(base + 50 * 24 * HOUR), e.breaks, { paid: e.paid }));
  const newDefault = legacy.map((e) => entryHours(e.clockIn, e.clockOut || new Date(base + 50 * 24 * HOUR), e.breaks, { paid: true }));
  const newBare = legacy.map((e) => entryHours(e.clockIn, e.clockOut || new Date(base + 50 * 24 * HOUR), e.breaks));
  const h0 = md5(oldHours);
  console.log(`       md5 old entryHours over 2000 legacy entries: ${h0}`);
  ok("entryHours: new (paid undefined) md5 == old md5", md5(newUndefined) === h0, md5(newUndefined));
  ok("entryHours: new (paid true, the column default) md5 == old md5", md5(newDefault) === h0, md5(newDefault));
  ok("entryHours: new (no options) md5 == old md5", md5(newBare) === h0, md5(newBare));

  const days = [];
  for (let i = 0; i < 2000; i += 5) {
    const day = legacy.slice(i, i + 5).map((e, j) => ({ ...e, hours: e.clockOut ? oldHours[i + j] : null, paid: j % 2 ? true : undefined }));
    days.push(day);
  }
  const now = base + 45 * 24 * HOUR;
  const oldToday = days.map((d) => OLD_todayHoursFrom(d, now));
  const newToday = days.map((d) => todayHoursFrom(d, now));
  const t0 = md5(oldToday);
  console.log(`       md5 old todayHoursFrom over 400 legacy days: ${t0}`);
  ok("todayHoursFrom: new md5 == old md5", md5(newToday) === t0, md5(newToday));

  // The write a legacy punch makes is unchanged — an old phone with an old
  // page, or a punch queued before this deploy, writes exactly what it did.
  seed({ jobs: [job("j1")], visits: [visit("j1")] });
  await call(clockPOST, post({ action: "in", jobId: "j1" }));
  const inWrite = writes.find((w) => w.model === "timeEntry" && w.action === "create");
  const keys = Object.keys(inWrite?.data || {}).sort();
  ok("legacy `in` writes the same five fields it always did, no activity and no paid",
    md5(keys) === md5(["clockIn", "jobId", "status", "taskId", "workerId"]), keys);
  rows.timeEntry[0].clockIn = ago(2);
  await call(clockPOST, post({ action: "out" }));
  const outWrite = writes.filter((w) => w.model === "timeEntry" && w.action === "update").at(-1);
  ok("legacy `out` writes clockOut and hours only", md5(Object.keys(outWrite?.data || {}).sort()) === md5(["clockOut", "hours"]), outWrite?.data);
  ok("no existing closed entry is ever updated by a punch",
    writes.filter((w) => w.model === "timeEntry" && w.action === "update").every((w) => w.where?.id === rows.timeEntry[0].id));
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. Time zone: days are the company's, and midnight splits a segment");
// ═══════════════════════════════════════════════════════════════════════════
{
  const oct3 = dayBoundsForDate("2026-10-03", TZ);
  ok("2026-10-03 in Toronto starts at 04:00Z (EDT)", oct3.start.toISOString() === "2026-10-03T04:00:00.000Z", oct3.start);
  const nov1 = dayBoundsForDate("2026-11-01", TZ);
  ok("the DST fall-back day is 25 hours long", nov1.next - nov1.start === 25 * HOUR, (nov1.next - nov1.start) / HOUR);
  ok("a date that does not exist is refused, not rolled over", dayBoundsForDate("2026-02-30", TZ) === null && dayBoundsForDate("x", TZ) === null);

  // A night shift 22:00–02:00 local, with a lunch across midnight.
  const night = {
    id: "n1",
    workerId: "wrk_crew",
    clockIn: new Date("2026-10-04T02:00:00.000Z"), // 22:00 EDT Oct 3
    clockOut: new Date("2026-10-04T06:00:00.000Z"), // 02:00 EDT Oct 4
    activity: "visit",
    jobId: "j1",
    paid: true,
    breaks: [{ start: new Date("2026-10-04T03:45:00.000Z"), end: new Date("2026-10-04T04:15:00.000Z"), kind: "lunch", paid: false }],
  };
  const d3 = entrySegments(night, { from: oct3.start, to: oct3.next });
  const oct4 = dayBoundsForDate("2026-10-04", TZ);
  const d4 = entrySegments(night, { from: oct4.start, to: oct4.next });
  const t3 = segmentTotals(d3);
  const t4 = segmentTotals(d4);
  ok("Oct 3 shows 2 h on the clock (22:00–24:00), 15 min of it lunch", t3.trackedMs === 2 * HOUR && t3.paidMs === 1.75 * HOUR, t3);
  ok("Oct 4 shows the other 2 h (00:00–02:00), 15 min of it lunch", t4.trackedMs === 2 * HOUR && t4.paidMs === 1.75 * HOUR, t4);
  ok("the lunch is split at midnight into two segments, one per day", d3.at(-1).kind === "lunch" && d4[0].kind === "lunch");
  ok("the two days add up to the entry's own paid hours", (t3.paidMs + t4.paidMs) / HOUR === entryHours(night.clockIn, night.clockOut, night.breaks));

  // The log route, executed, for each of the two days.
  seed({ entries: [{ ...night, breaks: undefined, status: "approved" }], breaks: night.breaks.map((b, i) => ({ ...b, id: `nb${i}`, timeEntryId: "n1" })) });
  const r3 = await call(logGET, new Request("http://x/api/time-clock/log?date=2026-10-03"));
  const r4 = await call(logGET, new Request("http://x/api/time-clock/log?date=2026-10-04"));
  ok("GET /api/time-clock/log puts the night shift on BOTH dates",
    r3.body?.people?.[0]?.trackedMs === 2 * HOUR && r4.body?.people?.[0]?.trackedMs === 2 * HOUR, [r3.body?.people?.[0]?.trackedMs, r4.body?.people?.[0]?.trackedMs]);
  const bad = await call(logGET, new Request("http://x/api/time-clock/log?date=2026-13-01"));
  ok("…and refuses a date that is not one", bad.status === 400);

  const ws = weekStartInZone(new Date("2026-10-04T03:30:00.000Z"), TZ, 1); // Sat 23:30 EDT
  ok("the week starts at the company's Monday midnight, not UTC's", ws.toISOString() === "2026-09-28T04:00:00.000Z", ws);
  ok("isoDayInZone reads the company's date", isoDayInZone(new Date("2026-10-04T03:30:00.000Z"), TZ) === "2026-10-03");
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. Crew see only their own log; a manager sees everyone");
// ═══════════════════════════════════════════════════════════════════════════
{
  const day = "2026-10-02";
  const at = (h) => new Date(`${day}T${String(h).padStart(2, "0")}:00:00.000Z`);
  const entries = [
    { id: "e1", workerId: "wrk_crew", clockIn: at(12), clockOut: at(16), activity: "visit", jobId: "j1", paid: true, status: "pending" },
    { id: "e2", workerId: "wrk_other", clockIn: at(13), clockOut: at(17), activity: "office", jobId: null, paid: true, status: "pending" },
  ];
  seed({ member: CREW, entries, jobs: [job("j1")] });
  const mine = await call(logGET, new Request(`http://x/api/time-clock/log?date=${day}`));
  ok("crew: scope is own", mine.body?.scope === "own", mine.body?.scope);
  ok("crew: only their own person on the log", mine.body?.people?.length === 1 && mine.body.people[0].worker.id === "wrk_crew", mine.body?.people?.map((p) => p.worker.id));
  ok("crew: no colleague's segment anywhere in the payload", !JSON.stringify(mine.body).includes("wrk_other") && !JSON.stringify(mine.body).includes("Ana"));

  seed({ member: OWNER, entries, jobs: [job("j1")] });
  const all = await call(logGET, new Request(`http://x/api/time-clock/log?date=${day}`));
  ok("owner: scope is all, both people", all.body?.scope === "all" && all.body?.people?.length === 2, all.body?.people?.length);

  const mgr = { id: "mem_mgr", userId: "usr_mgr", companyId: OURS, role: "supervisor", permissions: grid("manager") };
  seed({ member: mgr, entries, jobs: [job("j1")] });
  rows.member.push(mgr);
  const m = await call(logGET, new Request(`http://x/api/time-clock/log?date=${day}`));
  ok("Manager preset (timeTracking view_record_edit_all): everyone", m.body?.scope === "all" && m.body?.people?.length === 2);

  const est = { id: "mem_est", userId: "usr_crew", companyId: OURS, role: "employee", permissions: grid("estimator") };
  seed({ member: est, entries, jobs: [job("j1")] });
  rows.member.push(est);
  const e = await call(logGET, new Request(`http://x/api/time-clock/log?date=${day}`));
  ok("Estimator preset: own only", e.body?.scope === "own" && e.body?.people?.length === 1);

  // buildDayLog, pure: me first, then by name.
  const people = buildDayLog({
    entries,
    workers: [{ id: "wrk_crew", name: "Zed" }, { id: "wrk_other", name: "Ana" }],
    meWorkerId: "wrk_crew",
    bounds: dayBoundsForDate(day, "UTC"),
    now: at(23),
  });
  ok("the log lists the reader first, then by name", people.map((p) => p.worker.name).join(",") === "Zed,Ana");

  seed({ member: CREW, entries: [{ id: "w1", workerId: "wrk_crew", clockIn: ago(2), clockOut: null, activity: "general", paid: true, status: "pending" }] });
  const w = await call(weekGET, new Request("http://x/api/time-clock/week"));
  ok("GET /api/time-clock/week: the person's own week, hours only — no rate, no money",
    w.status === 200 && Math.abs(w.body.hours - 2) < 0.02 && !/rate|amount|pay\b|earn/i.test(Object.keys(w.body).join(",")), w.body);
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. The crew's menu shows the clock — and the clock serves them");
// ═══════════════════════════════════════════════════════════════════════════
{
  const crew = { role: "employee", permissions: grid("worker") };
  const estimator = { role: "employee", permissions: grid("estimator") };
  const manager = { role: "supervisor", permissions: grid("manager") };
  ok("Crew's tab bar has the clock", meTabsFor(crew).some((t) => t.href === "/app/clock"), meTabsFor(crew).map((t) => t.href));
  ok("…lit when they are on it", activeMeTab(meTabsFor(crew), "/app/clock") === "/app/clock");
  ok("Estimator (worker set) has it too", meTabsFor(estimator).some((t) => t.href === "/app/clock"));
  ok("Crew are the crew home — the same decision that now gives them the employee bar everywhere", isCrewHome(crew) && !isCrewHome(estimator) && !isCrewHome(manager));

  const bar = readFileSync("app/components/layout/MobileTabBar.js", "utf8");
  const gate = bar.slice(bar.indexOf("if (\n    isMePath(pathname)"), bar.indexOf("return <MeTabBar />"));
  ok("MobileTabBar swaps to the employee bar for a crew member, not only on /app/me", gate.length > 0 && /isCrewHome\(caller\)/.test(gate), gate.slice(0, 120));

  const more = readFileSync("app/app/me/more/page.js", "utf8");
  ok("a manager reaches the clock from More (their tabs have no clock)", /manager \? <BigRow icon=\{Clock\} title=\{t\("app\.nav\.clock"\)\} href="\/app\/clock"/.test(more));
  ok("the Jobs row on More is behind the same navRowAllowed the bar used", /navRowAllowed\("app\.nav\.jobs", caller\)/.test(more));
  ok("…which lets Crew through (jobs view_only, scoped to their own)", navRowAllowed("app.nav.jobs", crew));
  ok("Earnings is a More row for every set now, not only the worker set", /<BigRow icon=\{Wallet\} title=\{t\("app\.me\.tab\.earnings"\)\} href="\/app\/me\/earnings" \/>/.test(more));

  // Never a link to a page that refuses them: GET /api/time-clock serves the
  // Crew preset (it resolves the person from the session; no grid gate).
  seed({ member: CREW });
  const g = await call(clockGET, new Request("http://x/api/time-clock"));
  ok("GET /api/time-clock answers a Crew member with their own worker", g.status === 200 && g.body?.worker?.id === "wrk_crew", g.status);
}

// ═══════════════════════════════════════════════════════════════════════════
section("9. Offline: a day tapped through with no signal shows as tapped");
// ═══════════════════════════════════════════════════════════════════════════
{
  const item = (n, payload) => ({ kind: "timesheet", status: "queued", createdAt: n, payload });
  const q = [
    item(1, { action: "activity", activity: "driving", jobId: null, at: "2026-10-02T12:00:00Z" }),
    item(2, { action: "activity", activity: "lunch", at: "2026-10-02T13:00:00Z" }),
  ];
  const s1 = queuedPunchState(q, null);
  ok("a queued Driving then Lunch shows Driving with a running lunch", s1.pending && s1.open?.activity === "driving" && s1.open.breaks.at(-1)?.kind === "lunch" && s1.open.breaks.at(-1).end == null, s1);
  const s2 = queuedPunchState([...q, item(3, { action: "activity", activity: "driving", jobId: null, at: "2026-10-02T13:30:00Z" })], null);
  ok("…and tapping Driving again ends the lunch on the same stretch", s2.open?.clockIn === "2026-10-02T12:00:00Z" && s2.open.breaks.at(-1).end === "2026-10-02T13:30:00Z", s2);
  const s3 = queuedPunchState([...q, item(3, { action: "out", at: "2026-10-02T17:00:00Z" })], null);
  ok("…and a queued Clock out shows clocked out", s3.open === null && s3.pending);
  const queue = readFileSync("lib/offline/queue.js", "utf8");
  ok("the replay carries the activity to the server", /\.\.\.\(p\.activity \? \{ activity: p\.activity \} : \{\}\)/.test(queue));
}

console.error = realError;
console.warn = realWarn;
console.log(
  `\n${failures.length === 0 ? `ALL PASS — ${pass} checks` : `${failures.length} FAILED of ${pass + failures.length}`}`,
);
for (const f of failures) console.log(`  ✗ ${f}`);
process.exit(failures.length ? 1 : 0);
