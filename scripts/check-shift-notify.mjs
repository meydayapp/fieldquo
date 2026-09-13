// scripts/check-shift-notify.mjs
//
// Executes the seven reactive pieces of the 2026-09-13 team-management pass
// against the inputs that go wrong — no database, no React:
//
//   attendance     lib/shifts/attendance.js: late / no-show / early-out /
//                  on-time verdicts, the forgotten clock-out rule, which
//                  shift a punch belongs to, the 30-day summary
//   labour cost    lib/shifts/labourCost.js: the week priced with overtime
//                  at payroll's own multiplier, a person with no rate NAMED
//                  rather than priced at zero, the day's overtime decided by
//                  where in the week it falls
//   leave limits   lib/leave/rules.js: blackout edges, the cap counting
//                  approved leave only and naming who is off, the normaliser
//                  refusing junk
//   holidays       lib/leave/statutoryHolidays.js against known 2026 and
//                  2027 dates, the observed-day rules, countWorkingDays
//                  skipping them
//   notifications  shiftEvents (which transitions tell the worker), the
//                  named-recipient narrowing in the resolver, the catalog
//                  entries, the sentence keys in all nine languages
//   the trail      the routes call the hooks (source assertions)
//   the CSV / ICS  the export's columns and the multi-event calendar
//
//   npm run check:shift-notify
//   (= TZ=America/Toronto node --import ./scripts/alias-loader.mjs scripts/check-shift-notify.mjs)

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  attendanceFor,
  forgottenClockOut,
  shiftForEntry,
  summariseAttendance,
  LATE_AFTER_MIN,
  NO_SHOW_AFTER_MIN,
  EARLY_OUT_BEFORE_MIN,
} from "@/lib/shifts/attendance";
import { dailyLabourCost, minutesByWorker, weeklyLabourCost } from "@/lib/shifts/labourCost";
import { OVERTIME_MULTIPLIER, DEFAULT_OT_THRESHOLD_WEEKLY } from "@/lib/payroll/computePayRun";
import {
  blackoutFor,
  blackoutRefusal,
  concurrentRefusal,
  normaliseLeaveRules,
  othersOffDuring,
  peakConcurrent,
} from "@/lib/leave/rules";
import { easterSunday, holidayDays, holidayRegion, holidaysBetween, holidaysFor, HOLIDAY_KEYS } from "@/lib/leave/statutoryHolidays";
import { countWorkingDays } from "@/lib/leave/accrual";
import { describeShiftWhen, placeOf, shiftEvents } from "@/lib/shifts/shiftNotify";
import { selectRecipients } from "@/lib/notifications/recipients";
import { NOTIFICATION_TYPES, typeProblems } from "@/lib/notifications/catalog";
import { hrefFor } from "@/lib/notifications/render";
import { buildIcsCalendar } from "@/lib/calendar/ics";
import { APP_MESSAGES, APP_LANGUAGES } from "../app/i18n/appMessages.js";

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
const T = (s) => new Date(s);
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// ═══════════════════════════════════════════════════════════════════════════
// 1. Attendance
// ═══════════════════════════════════════════════════════════════════════════
const shift = { id: "s1", workerId: "w1", start: T("2026-09-14T12:00:00Z"), end: T("2026-09-14T20:00:00Z") };
const at = (min) => new Date(shift.start.getTime() + min * 60_000);

check("no punch before the grace runs out is pending, not a no-show", () => {
  const v = attendanceFor({ shift, entries: [], now: at(NO_SHOW_AFTER_MIN - 1) });
  assert.equal(v.status, "pending");
  assert.equal(v.final, false);
});
check("no punch after the grace is a no-show, provisional until the shift ends", () => {
  const v = attendanceFor({ shift, entries: [], now: at(NO_SHOW_AFTER_MIN) });
  assert.equal(v.status, "no_show");
  assert.equal(v.final, false);
  const done = attendanceFor({ shift, entries: [], now: at(8 * 60 + 1) });
  assert.equal(done.status, "no_show");
  assert.equal(done.final, true);
});
check("a punch inside the late grace is on time", () => {
  const v = attendanceFor({ shift, entries: [{ workerId: "w1", clockIn: at(LATE_AFTER_MIN), clockOut: null }], now: at(30) });
  assert.equal(v.status, "on_time");
  assert.equal(v.lateMinutes, 0);
});
check("a punch past the grace is late by the minutes", () => {
  const v = attendanceFor({ shift, entries: [{ workerId: "w1", clockIn: at(12), clockOut: null }], now: at(30) });
  assert.equal(v.status, "late");
  assert.equal(v.lateMinutes, 12);
  assert.equal(v.final, false);
});
check("an early punch is on time and not negative minutes", () => {
  const v = attendanceFor({ shift, entries: [{ workerId: "w1", clockIn: at(-40), clockOut: null }], now: at(30) });
  assert.equal(v.status, "on_time");
  assert.equal(v.lateMinutes, 0);
});
check("clocking out well before the end is early out, final once the shift is over", () => {
  const entries = [{ workerId: "w1", clockIn: at(0), clockOut: at(8 * 60 - 20) }];
  const during = attendanceFor({ shift, entries, now: at(8 * 60 - 10) });
  assert.equal(during.status, "early_out");
  assert.equal(during.earlyMinutes, 20);
  assert.equal(during.final, false);
  const after = attendanceFor({ shift, entries, now: at(8 * 60 + 5) });
  assert.equal(after.final, true);
});
check("clocking out inside the early grace is on time", () => {
  const v = attendanceFor({ shift, entries: [{ workerId: "w1", clockIn: at(0), clockOut: at(8 * 60 - EARLY_OUT_BEFORE_MIN) }], now: at(9 * 60) });
  assert.equal(v.status, "on_time");
  assert.equal(v.final, true);
});
check("late beats early out; both minutes are on the row", () => {
  const v = attendanceFor({ shift, entries: [{ workerId: "w1", clockIn: at(25), clockOut: at(8 * 60 - 30) }], now: at(9 * 60) });
  assert.equal(v.status, "late");
  assert.equal(v.lateMinutes, 25);
  assert.equal(v.earlyMinutes, 30);
});
check("an entry still open past the end is not final and not early out", () => {
  const v = attendanceFor({ shift, entries: [{ workerId: "w1", clockIn: at(0), clockOut: null }], now: at(8 * 60 + 40) });
  assert.equal(v.status, "on_time");
  assert.equal(v.final, false);
});
check("another worker's punch and last night's punch do not count", () => {
  const entries = [
    { workerId: "w2", clockIn: at(0), clockOut: null },
    { workerId: "w1", clockIn: at(-14 * 60), clockOut: at(-6 * 60 - 1) },
  ];
  assert.equal(attendanceFor({ shift, entries, now: at(NO_SHOW_AFTER_MIN) }).status, "no_show");
});
check("a split day: two entries, the second's clock-out decides early out", () => {
  const entries = [
    { workerId: "w1", clockIn: at(0), clockOut: at(4 * 60) },
    { workerId: "w1", clockIn: at(4 * 60 + 30), clockOut: at(8 * 60) },
  ];
  const v = attendanceFor({ shift, entries, now: at(9 * 60) });
  assert.equal(v.status, "on_time");
  assert.equal(v.final, true);
});
check("junk shifts and dates are pending, never a throw", () => {
  assert.equal(attendanceFor({ shift: null, entries: [], now: Date.now() }).status, "pending");
  assert.equal(attendanceFor({ shift: { start: "nope", end: "x" }, entries: [], now: Date.now() }).status, "pending");
  assert.equal(attendanceFor({ shift: { ...shift, end: shift.start }, entries: [], now: at(90) }).status, "pending");
});
check("thresholds are policy: an override moves the line", () => {
  const v = attendanceFor({ shift, entries: [{ workerId: "w1", clockIn: at(12), clockOut: null }], now: at(30), thresholds: { lateAfterMin: 15 } });
  assert.equal(v.status, "on_time");
});
check("forgotten clock-out: 30 min after the shift end, not before", () => {
  const entry = { clockIn: at(0), clockOut: null };
  assert.equal(forgottenClockOut({ entry, shift, now: at(8 * 60 + 29) }).forgotten, false);
  assert.deepEqual(forgottenClockOut({ entry, shift, now: at(8 * 60 + 30) }), { forgotten: true, reason: "after_shift" });
});
check("forgotten clock-out with no shift: 14 hours open", () => {
  const entry = { clockIn: T("2026-09-14T08:00:00Z"), clockOut: null };
  assert.equal(forgottenClockOut({ entry, shift: null, now: T("2026-09-14T21:59:00Z") }).forgotten, false);
  assert.deepEqual(forgottenClockOut({ entry, shift: null, now: T("2026-09-14T22:00:00Z") }), { forgotten: true, reason: "no_shift" });
});
check("a closed entry is never forgotten", () => {
  assert.equal(forgottenClockOut({ entry: { clockIn: at(0), clockOut: at(60) }, shift, now: at(20 * 60) }).forgotten, false);
});
check("shiftForEntry picks this worker's shift around the punch, the earliest-ending on a double day", () => {
  const s2 = { id: "s2", workerId: "w1", start: T("2026-09-14T22:00:00Z"), end: T("2026-09-15T04:00:00Z") };
  const other = { id: "s3", workerId: "w2", start: shift.start, end: shift.end };
  assert.equal(shiftForEntry({ workerId: "w1", clockIn: at(5) }, [s2, other, shift])?.id, "s1");
  assert.equal(shiftForEntry({ workerId: "w1", clockIn: T("2026-09-14T22:10:00Z") }, [shift, s2])?.id, "s2");
  assert.equal(shiftForEntry({ workerId: "w9", clockIn: at(5) }, [shift]), null);
});
check("the 30-day summary counts FINAL rows only", () => {
  const s = summariseAttendance([
    { status: "late", final: true },
    { status: "late", final: false },
    { status: "no_show", final: true },
    { status: "on_time", final: true },
    { status: "early_out", final: true },
    { status: "weird", final: true },
  ]);
  assert.deepEqual(s, { total: 4, on_time: 1, late: 1, no_show: 1, early_out: 1 });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. Labour cost
// ═══════════════════════════════════════════════════════════════════════════
const week = { start: T("2026-09-13T04:00:00Z").getTime(), end: T("2026-09-20T04:00:00Z").getTime() }; // Sun–Sun, Toronto
const day = (d, h1, h2, breaks = []) => ({
  workerId: "w1",
  start: T(`2026-09-${d}T${String(h1).padStart(2, "0")}:00:00-04:00`),
  end: T(`2026-09-${d}T${String(h2).padStart(2, "0")}:00:00-04:00`),
  breaks,
});
const lunch = (d) => ({ start: T(`2026-09-${d}T12:00:00-04:00`), end: T(`2026-09-${d}T12:30:00-04:00`), paid: false });

check("minutes per worker are net of unpaid breaks, drafts included", () => {
  const shifts = [{ ...day(14, 8, 16, [lunch(14)]), published: false }, { ...day(15, 8, 16), workerId: "w2" }];
  const m = minutesByWorker(shifts, week.start, week.end);
  assert.equal(m.w1, 450);
  assert.equal(m.w2, 480);
});
check("45 h at $20 is 40 regular + 5 overtime at payroll's multiplier", () => {
  const out = weeklyLabourCost({ minutes: { w1: 45 * 60 }, workers: [{ id: "w1", name: "Marc", hourlyRate: 20 }] });
  assert.equal(out.thresholdWeekly, DEFAULT_OT_THRESHOLD_WEEKLY);
  assert.equal(out.multiplier, OVERTIME_MULTIPLIER);
  const row = out.rows[0];
  assert.equal(row.regularHours, 40);
  assert.equal(row.overtimeHours, 5);
  assert.equal(row.overtime, true);
  assert.equal(row.cost, 40 * 20 + 5 * 20 * OVERTIME_MULTIPLIER);
  assert.equal(out.total, 950);
  assert.equal(out.overtimeCost, 150);
});
check("a person with no rate is NAMED, and the total covers the priced only", () => {
  const out = weeklyLabourCost({
    minutes: { w1: 40 * 60, w2: 40 * 60 },
    workers: [{ id: "w1", name: "Marc", hourlyRate: 20 }, { id: "w2", name: "Ana", hourlyRate: null }],
  });
  assert.equal(out.total, 800);
  assert.deepEqual(out.missingRate, [{ workerId: "w2", name: "Ana", hours: 40 }]);
  assert.equal(out.rows.find((r) => r.workerId === "w2").cost, null);
});
check("nobody priced → total null, never zero", () => {
  const out = weeklyLabourCost({ minutes: { w1: 600 }, workers: [{ id: "w1", name: "Marc" }] });
  assert.equal(out.total, null);
  assert.equal(out.missingRate.length, 1);
});
check("a string rate and a Decimal-like rate both price", () => {
  const out = weeklyLabourCost({ minutes: { w1: 60 }, workers: [{ id: "w1", name: "M", hourlyRate: "22.50" }] });
  assert.equal(out.total, 22.5);
});
check("the threshold is overridable (44 h province)", () => {
  const out = weeklyLabourCost({ minutes: { w1: 45 * 60 }, workers: [{ id: "w1", name: "M", hourlyRate: 10 }], thresholdWeekly: 44 });
  assert.equal(out.rows[0].overtimeHours, 1);
});
check("the day's overtime depends on the week before it: Saturday after 40 h is all overtime", () => {
  const out = dailyLabourCost({
    dayMinutes: { w1: 8 * 60 },
    weekMinutesBefore: { w1: 40 * 60 },
    workers: [{ id: "w1", name: "M", hourlyRate: 20 }],
  });
  assert.equal(out.overtimeHours, 8);
  assert.equal(out.total, 8 * 30);
  const monday = dailyLabourCost({ dayMinutes: { w1: 8 * 60 }, weekMinutesBefore: {}, workers: [{ id: "w1", name: "M", hourlyRate: 20 }] });
  assert.equal(monday.overtimeHours, 0);
  assert.equal(monday.total, 160);
});
check("hostile input to the cost functions is a zero line, not a throw", () => {
  assert.equal(weeklyLabourCost({ minutes: null, workers: null }).total, null);
  assert.equal(dailyLabourCost({}).total, null);
  assert.equal(weeklyLabourCost({ minutes: { w1: -50 }, workers: [{ id: "w1", hourlyRate: 20 }] }).rows[0].hours, 0);
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. Leave limits
// ═══════════════════════════════════════════════════════════════════════════
const rules = normaliseLeaveRules({
  blackouts: [{ from: "2026-12-15", to: "2027-01-05", label: "Christmas installs" }, { from: "2026-07-01", to: "2026-07-01", label: "" }],
  maxConcurrent: 2,
  holidayRegion: { country: "CA", province: "QC" },
}).rules;

check("the normaliser keeps sound rules and sorts blackouts", () => {
  assert.equal(rules.blackouts.length, 2);
  assert.equal(rules.blackouts[0].from, "2026-07-01");
  assert.equal(rules.maxConcurrent, 2);
  assert.deepEqual(rules.holidayRegion, { country: "CA", province: "QC" });
});
check("the normaliser refuses junk rather than repairing it", () => {
  const { errors } = normaliseLeaveRules({ blackouts: [{ from: "2026-02-10", to: "2026-02-01" }], maxConcurrent: 0 });
  assert.equal(errors.length, 2);
  assert.ok(normaliseLeaveRules({ holidayRegion: { country: "FR" } }).errors.length === 1);
  assert.ok(normaliseLeaveRules({ holidayRegion: { country: "CA" } }).errors.length === 1);
  assert.ok(normaliseLeaveRules({ blackouts: [{ from: "junk", to: "2026-01-01" }] }).errors.length === 1);
});
check("null / '' / undefined maxConcurrent all mean no limit", () => {
  for (const v of [null, "", undefined]) assert.equal(normaliseLeaveRules({ maxConcurrent: v }).rules.maxConcurrent, null);
});
check("blackout edges: the last day is in, the day after is out, a straddle is in", () => {
  assert.ok(blackoutFor(rules, "2026-12-10", "2026-12-15"));
  assert.equal(blackoutFor(rules, "2027-01-06", "2027-01-10"), null);
  assert.ok(blackoutFor(rules, "2026-12-01", "2027-02-01"));
  assert.equal(blackoutFor(rules, "2026-12-01", "2026-12-14"), null);
  assert.equal(blackoutRefusal(rules, "2026-12-20", "2026-12-21").reason, "blackout");
  assert.match(blackoutRefusal(rules, "2026-12-20", "2026-12-21").message, /Christmas installs/);
  assert.equal(blackoutRefusal(rules, "2026-03-01", "2026-03-02"), null);
});
const others = [
  { workerId: "a", workerName: "Ana", startDate: "2026-08-03", endDate: "2026-08-07", status: "approved" },
  { workerId: "b", workerName: "Bo", startDate: "2026-08-05", endDate: "2026-08-05", status: "approved" },
  { workerId: "c", workerName: "Cy", startDate: "2026-08-04", endDate: "2026-08-06", status: "pending" },
  { workerId: "d", workerName: "Di", startDate: "2026-08-10", endDate: "2026-08-12", status: "approved" },
];
check("who else is off counts approved leave only, once per person", () => {
  assert.deepEqual(othersOffDuring(others, "2026-08-05", "2026-08-05").map((o) => o.workerName), ["Ana", "Bo"]);
  assert.equal(peakConcurrent(others, "2026-08-03", "2026-08-07"), 2);
  assert.equal(peakConcurrent(others, "2026-08-06", "2026-08-07"), 1);
});
check("the cap refuses at the peak day and names who is off", () => {
  const r = concurrentRefusal(rules, others, "2026-08-05", "2026-08-05");
  assert.equal(r.reason, "max_concurrent");
  assert.deepEqual(r.alreadyOff, ["Ana", "Bo"]);
  assert.match(r.message, /Ana, Bo/);
  assert.equal(concurrentRefusal(rules, others, "2026-08-06", "2026-08-07"), null);
  assert.equal(concurrentRefusal({ maxConcurrent: null }, others, "2026-08-05", "2026-08-05"), null);
  assert.equal(concurrentRefusal({ maxConcurrent: 1 }, others, "2026-08-11", "2026-08-11").alreadyOff.length, 1);
});
check("a pending request does not count against the cap", () => {
  assert.equal(concurrentRefusal({ maxConcurrent: 3 }, others, "2026-08-05", "2026-08-05"), null);
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. Statutory holidays, against known dates
// ═══════════════════════════════════════════════════════════════════════════
const byKey = (list) => Object.fromEntries(list.map((h) => [h.key, h]));

check("Easter 2026 and 2027", () => {
  assert.equal(easterSunday(2026), "2026-04-05");
  assert.equal(easterSunday(2027), "2027-03-28");
});
check("Canada federal 2026: the known dates", () => {
  const h = byKey(holidaysFor({ country: "CA", year: 2026 }));
  assert.equal(h.goodFriday.date, "2026-04-03");
  assert.equal(h.victoriaDay.date, "2026-05-18");
  assert.equal(h.canadaDay.date, "2026-07-01");
  assert.equal(h.labourDay.date, "2026-09-07");
  assert.equal(h.truthReconciliation.date, "2026-09-30");
  assert.equal(h.thanksgivingCA.date, "2026-10-12");
  assert.equal(h.remembranceDay.date, "2026-11-11");
  assert.equal(h.christmas.date, "2026-12-25");
  assert.equal(h.boxingDay.date, "2026-12-26");
  assert.equal(h.boxingDay.observed, "2026-12-28", "a Saturday Boxing Day is taken on Monday");
  assert.equal(Object.keys(h).length, 10);
});
check("Ontario 2027: Family Day, Good Friday, Victoria Day, Thanksgiving; a Saturday Christmas moves to Monday and Boxing Day to Tuesday", () => {
  const h = byKey(holidaysFor({ country: "CA", province: "ON", year: 2027 }));
  assert.equal(h.familyDay.date, "2027-02-15");
  assert.equal(h.goodFriday.date, "2027-03-26");
  assert.equal(h.victoriaDay.date, "2027-05-24");
  assert.equal(h.labourDay.date, "2027-09-06");
  assert.equal(h.thanksgivingCA.date, "2027-10-11");
  assert.equal(h.christmas.observed, "2027-12-27");
  assert.equal(h.boxingDay.observed, "2027-12-28");
  assert.equal(h.remembranceDay, undefined, "Remembrance Day is not an Ontario statutory holiday");
  assert.equal(h.truthReconciliation, undefined);
});
check("Quebec: Patriots' Day, Fête nationale, no Family Day, no Boxing Day", () => {
  const h = byKey(holidaysFor({ country: "CA", province: "QC", year: 2026 }));
  assert.equal(h.patriotsDay.date, "2026-05-18");
  assert.equal(h.feteNationale.date, "2026-06-24");
  assert.equal(h.familyDay, undefined);
  assert.equal(h.boxingDay, undefined);
});
check("BC 2026: BC Day first Monday in August, Truth and Reconciliation is statutory", () => {
  const h = byKey(holidaysFor({ country: "CA", province: "BC", year: 2026 }));
  assert.equal(h.bcDay.date, "2026-08-03");
  assert.equal(h.truthReconciliation.date, "2026-09-30");
});
check("US federal 2026 and 2027: MLK, Memorial, Juneteenth, July 4 observed, Thanksgiving, Christmas observed", () => {
  const h = byKey(holidaysFor({ country: "US", year: 2026 }));
  assert.equal(h.mlkDay.date, "2026-01-19");
  assert.equal(h.presidentsDay.date, "2026-02-16");
  assert.equal(h.memorialDay.date, "2026-05-25");
  assert.equal(h.juneteenth.date, "2026-06-19");
  assert.equal(h.independenceDay.observed, "2026-07-03", "a Saturday Fourth is observed Friday");
  assert.equal(h.laborDay.date, "2026-09-07");
  assert.equal(h.columbusDay.date, "2026-10-12");
  assert.equal(h.thanksgivingUS.date, "2026-11-26");
  const n = byKey(holidaysFor({ country: "US", year: 2027 }));
  assert.equal(n.memorialDay.date, "2027-05-31");
  assert.equal(n.thanksgivingUS.date, "2027-11-25");
  assert.equal(n.independenceDay.observed, "2027-07-05", "a Sunday Fourth is observed Monday");
  assert.equal(n.christmas.observed, "2027-12-24");
  assert.equal(n.juneteenth.observed, "2027-06-18");
});
check("the region normaliser reads names and codes, and refuses the rest", () => {
  assert.deepEqual(holidayRegion({ country: "Canada", province: "Québec" }), { country: "CA", province: "QC" });
  assert.deepEqual(holidayRegion({ country: "ca", province: "on" }), { country: "CA", province: "ON" });
  assert.deepEqual(holidayRegion({ country: "United States", province: "TX" }), { country: "US", province: null });
  assert.deepEqual(holidayRegion({ country: "FR" }), { country: null, province: null });
  assert.deepEqual(holidaysFor({ country: "FR", year: 2026 }), []);
  assert.deepEqual(holidaysFor({ country: "CA", year: 1999 }), []);
});
check("holidaysBetween spans a year boundary and countWorkingDays skips the observed days", () => {
  const list = holidaysBetween({ country: "CA", province: "ON", from: "2026-12-20", to: "2027-01-03" });
  assert.deepEqual(list.map((h) => h.observed), ["2026-12-25", "2026-12-28", "2027-01-01"]);
  // Mon 21 Dec – Fri 1 Jan: 10 working days, less Christmas, Boxing Day (Mon 28) and New Year → 7
  assert.equal(countWorkingDays("2026-12-21", "2027-01-01", { holidays: holidayDays(list) }), 7);
  assert.equal(countWorkingDays("2026-12-21", "2027-01-01", {}), 10);
});
check("every holiday key has a name in all nine languages", () => {
  for (const key of HOLIDAY_KEYS) {
    for (const lang of APP_LANGUAGES) {
      assert.equal(typeof APP_MESSAGES[lang][`app.holiday.${key}`], "string", `${lang} app.holiday.${key}`);
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. Notifications
// ═══════════════════════════════════════════════════════════════════════════
const live = { id: "s1", workerId: "w1", start: "2026-09-14T12:00:00Z", end: "2026-09-14T20:00:00Z", jobId: "j1", published: true };
const draft = { ...live, published: false };

check("shiftEvents: draft → published tells the worker; drafts are silence", () => {
  assert.deepEqual(shiftEvents({ before: draft, after: live }), [{ type: "shift.published", workerId: "w1" }]);
  assert.deepEqual(shiftEvents({ before: null, after: draft }), []);
  assert.deepEqual(shiftEvents({ before: draft, after: { ...draft, start: "2026-09-14T13:00:00Z" } }), []);
  assert.deepEqual(shiftEvents({ before: draft, after: null }), []);
});
check("shiftEvents: a published shift moving, re-jobbed, deleted or unpublished", () => {
  assert.deepEqual(shiftEvents({ before: live, after: { ...live, end: "2026-09-14T21:00:00Z" } }), [{ type: "shift.changed", workerId: "w1" }]);
  assert.deepEqual(shiftEvents({ before: live, after: { ...live, jobId: "j2" } }), [{ type: "shift.changed", workerId: "w1" }]);
  assert.deepEqual(shiftEvents({ before: live, after: { ...live, note: "x" } }), [], "a note edit is not news");
  assert.deepEqual(shiftEvents({ before: live, after: null }), [{ type: "shift.cancelled", workerId: "w1" }]);
  assert.deepEqual(shiftEvents({ before: live, after: draft }), [{ type: "shift.cancelled", workerId: "w1" }]);
});
check("shiftEvents: moving a published shift to another person cancels one and publishes the other", () => {
  assert.deepEqual(shiftEvents({ before: live, after: { ...live, workerId: "w2" } }), [
    { type: "shift.cancelled", workerId: "w1" },
    { type: "shift.published", workerId: "w2" },
  ]);
});
check("shiftEvents: an open shift (no worker) tells nobody", () => {
  assert.deepEqual(shiftEvents({ before: { ...draft, workerId: null }, after: { ...live, workerId: null } }), []);
});
check("describeShiftWhen is in the language and the zone", () => {
  const en = describeShiftWhen({ start: live.start, end: live.end, language: "en", timeZone: "America/Toronto" });
  assert.match(en, /Mon/);
  assert.match(en, /Sep/);
  assert.match(en, /8:00/);
  assert.match(en, /4:00/);
  const fr = describeShiftWhen({ start: live.start, end: live.end, language: "fr", timeZone: "America/Toronto" });
  assert.match(fr, /lun/);
  assert.equal(describeShiftWhen({ start: "junk", end: live.end }), "");
});
check("placeOf reads the client and the SITE address, never the billing one", () => {
  assert.equal(placeOf({ client: { name: "Sophie Dubois" }, siteAddress: "12 rue Principale", title: "Kitchen" }), "Sophie Dubois, 12 rue Principale");
  assert.equal(placeOf({ title: "Kitchen" }), "Kitchen");
  assert.equal(placeOf(null), "");
});
const NEW_TYPES = ["shift.published", "shift.changed", "shift.cancelled", "timeclock.stillClockedIn", "timeclock.stillClockedInManager", "attendance.noShow"];
check("the six new catalog entries are sound and carry no money", () => {
  for (const t of NEW_TYPES) {
    assert.deepEqual(typeProblems(t), [], t);
    assert.equal(NOTIFICATION_TYPES[t].money, false);
    assert.ok(hrefFor({ entityType: NOTIFICATION_TYPES[t].entityType, entityId: "x" }), `${t} resolves to a screen`);
  }
  assert.equal(hrefFor({ entityType: "schedule", entityId: "s1" }), "/app/me/schedule");
  assert.equal(hrefFor({ entityType: "clock", entityId: "e1" }), "/app/clock");
});
check("every new sentence key exists in all nine languages and interpolates only declared params", () => {
  for (const t of NEW_TYPES) {
    const declared = NOTIFICATION_TYPES[t].params;
    for (const lang of APP_LANGUAGES) {
      const s = APP_MESSAGES[lang][`app.notif.type.${t}`];
      assert.equal(typeof s, "string", `${lang} ${t}`);
      const wanted = [...s.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((m) => m[1]);
      assert.ok(wanted.every((w) => declared.includes(w)), `${lang} ${t}: ${wanted}`);
      assert.ok(declared.every((d) => wanted.includes(d)), `${lang} ${t} renders every param`);
    }
  }
  for (const k of ["app.notif.shift.whenAt", "app.notif.shift.andMore"]) {
    for (const lang of APP_LANGUAGES) assert.equal(typeof APP_MESSAGES[lang][k], "string", `${lang} ${k}`);
  }
});
const members = [
  { id: "m1", userId: "u1", role: "employee", active: true, permissions: { schedule: "view_own", timeTracking: "view_record_own" } },
  { id: "m2", userId: "u2", role: "employee", active: true, permissions: { schedule: "view_own", timeTracking: "view_record_own" } },
  { id: "m3", userId: "u3", role: "owner", active: true, permissions: null },
  { id: "m4", userId: "u4", role: "supervisor", active: true, permissions: { schedule: "edit_all" } },
];
check("named recipients narrow the audience to the one person", () => {
  const got = selectRecipients({ members, type: "shift.published", recipientUserIds: ["u1"] });
  assert.deepEqual(got.map((m) => m.id), ["m1"]);
});
check("naming somebody the audience refuses delivers nothing to them", () => {
  const refused = [{ id: "m9", userId: "u9", role: "employee", active: true, permissions: { schedule: "none" } }];
  assert.deepEqual(selectRecipients({ members: refused, type: "shift.published", recipientUserIds: ["u9"] }), []);
});
check("an empty list is nobody; undefined is the whole audience; the actor is never told", () => {
  assert.deepEqual(selectRecipients({ members, type: "shift.published", recipientUserIds: [] }), []);
  assert.equal(selectRecipients({ members, type: "shift.published" }).length, 4);
  assert.deepEqual(selectRecipients({ members, type: "shift.published", recipientUserIds: ["u1"], actorUserId: "u1" }), []);
});
check("the manager types go to user:manage, narrowed to the reporting line when named", () => {
  assert.deepEqual(selectRecipients({ members, type: "attendance.noShow" }).map((m) => m.id), ["m3", "m4"]);
  assert.deepEqual(selectRecipients({ members, type: "attendance.noShow", recipientUserIds: ["u4"] }).map((m) => m.id), ["m4"]);
  assert.deepEqual(selectRecipients({ members, type: "timeclock.stillClockedInManager", recipientUserIds: ["u1"] }), [], "a crew member named as manager is refused");
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. The routes call the hooks (source)
// ═══════════════════════════════════════════════════════════════════════════
check("POST /api/shifts audits every created shift", () => {
  const s = src("app/api/shifts/route.js");
  assert.match(s, /auditCreatedShifts\(member, /);
  assert.match(s, /managerExtras\(/);
  assert.match(s, /workerExtras\(/);
});
check("PATCH and DELETE /api/shifts/[id] call the after-hooks", () => {
  const s = src("app/api/shifts/[id]/route.js");
  assert.equal((s.match(/await afterShiftUpdate\(member, existing, shift\)/g) || []).length, 2);
  assert.match(s, /await afterShiftDelete\(member, existing\)/);
});
check("the publish route reads what flips, scopes the update to it, and notifies after", () => {
  const s = src("app/api/shifts/publish/route.js");
  assert.match(s, /published: !target/);
  assert.match(s, /id: \{ in: changing\.map/);
  assert.match(s, /notifyPublished\(/);
  assert.ok(s.indexOf("updateMany") < s.indexOf("notifyPublished("), "notify after the write");
});
check("the time clock logs all five punches", () => {
  const s = src("app/api/time-clock/route.js");
  for (const a of ["in", "out", "switch", "break_start", "break_end"]) assert.match(s, new RegExp(`logPunch\\(member, "${a}"`), a);
});
check("the cron is scheduled every 15 minutes, gated, and never closes an entry", () => {
  const cron = JSON.parse(src("vercel.json")).crons.find((c) => c.path === "/api/cron/time-clock-watch");
  assert.equal(cron?.schedule, "*/15 * * * *");
  const s = src("app/api/cron/time-clock-watch/route.js");
  assert.match(s, /requireCronSecret\(request\)/);
  assert.doesNotMatch(s, /clockOut: (new Date|now)/, "the cron writes no clock-out");
  assert.match(s, /overrunNotifiedAt: now/);
  assert.match(s, /noShowNotifiedAt: now/);
});
check("the leave routes judge blackout, cap and holidays at request AND approval", () => {
  assert.match(src("app/api/leave/route.js"), /judgeLeaveRequest\(/);
  assert.match(src("app/api/leave/route.js"), /holidays: judged\.holidays/);
  assert.match(src("app/api/leave/[id]/route.js"), /judgeLeaveRequest\(/);
});
check("the rates leave /api/shifts only behind canSeeAllPay", () => {
  const s = src("lib/shifts/boardExtras.js");
  assert.match(s, /const payVisible = canSeeAllPay\(full\)/);
  assert.match(s, /if \(payVisible\) \{[\s\S]*hourlyRate: true/);
});
check("the CSV export is gated at the timesheet's level and carries no rate", () => {
  const s = src("app/api/time-entries/export/route.js");
  assert.match(s, /hasLevel\(full, "timeTracking", "view_record_edit_all"\)/);
  assert.doesNotMatch(s, /hourlyRate/);
  assert.match(s, /csvCell/);
  assert.match(s, /timesheet_\$\{from\}_\$\{to\}/);
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. The .ics calendar
// ═══════════════════════════════════════════════════════════════════════════
check("buildIcsCalendar emits one VEVENT per shift, PUBLISH, CRLF, escaped commas", () => {
  const ics = buildIcsCalendar({
    calendarName: "Roth's, shifts",
    events: [
      { uid: "shift-1@fieldquo", start: live.start, end: live.end, summary: "Roth's: Sophie Dubois, 12 rue Principale", location: "12 rue Principale, Laval" },
      { uid: "shift-2@fieldquo", start: live.start, end: live.end, summary: "x" },
      { uid: null, start: live.start, end: live.end, summary: "dropped" },
    ],
    dtstamp: T("2026-09-13T00:00:00Z"),
  });
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.match(ics, /METHOD:PUBLISH/);
  assert.match(ics, /X-WR-CALNAME:Roth's\\, shifts/);
  assert.match(ics, /DTSTART:20260914T120000Z/);
  assert.match(ics, /LOCATION:12 rue Principale\\, Laval/);
  assert.ok(ics.includes("\r\n"));
  assert.doesNotMatch(ics, /dropped/);
});

// ═══════════════════════════════════════════════════════════════════════════
console.log(`check-shift-notify: ${pass} ok, ${fails.length} failed`);
for (const f of fails) console.log(`  - ${f}`);
if (fails.length) process.exit(1);
