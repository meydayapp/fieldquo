// scripts/check-shift-board.mjs
//
// Executes lib/shifts/coverage.js — the day board's arithmetic — against the
// inputs that go wrong in production. No database, no React.
//
//   npm run check:shift-board
//   (= TZ=America/Toronto node --import ./scripts/alias-loader.mjs scripts/check-shift-board.mjs)
//
// The cases, and why each one is here:
//
//   overlapping shifts      two people on the same hour count as two, not one
//   breaks outside a shift  a row a script wrote badly must not make the
//                           strip show a person on break at an hour they
//                           were never on shift
//   the DST days            8 March 2026 has 23 hours in Toronto and 1 November
//                           has 25; a board that counts columns in "hour
//                           numbers" draws the afternoon an hour off on both
//   a midnight-crossing     22:00–06:00 belongs to the evening's board, is
//   shift                   clipped at midnight and SAYS it is clipped
//   nothing at all          an empty day is a strip of zeros, not a crash
//
// Toronto is the process timezone, set on the command line in package.json
// rather than in here: the hour-column and day-bounds helpers deliberately use
// the local Date constructor (that is how they get the 23- and 25-hour days
// right), and Node reads TZ once at start-up. Not process.env inside the
// script — check-env-docs would then ask for TZ in docs/VERCEL.md, where a
// timezone row would tell the owner to set a Vercel variable that does
// nothing. The guard below refuses to run in any other zone rather than
// passing vacuously in UTC, where no DST case exists.
if (Intl.DateTimeFormat().resolvedOptions().timeZone !== "America/Toronto") {
  console.error(
    "check-shift-board: run with TZ=America/Toronto (npm run check:shift-board) — the DST cases only exist in a zone that observes it.",
  );
  process.exit(1);
}

import assert from "node:assert/strict";
import {
  boardRange,
  coverageSlots,
  dayBoundsLocal,
  hourColumns,
  interval,
  midpointLunch,
  placeBlock,
  scheduledMinutes,
  statusAt,
  validateBreaks,
} from "@/lib/shifts/coverage";
import { entryHours, openBreak, unpaidBreakMs } from "@/lib/timeclock/entryHours";

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

const at = (ymd, hhmm) => new Date(`${ymd}T${hhmm}:00`).getTime(); // local
const H = 3_600_000;

// ── Intervals and placement ────────────────────────────────────────────────
check("interval rejects garbage and inverted ranges", () => {
  assert.equal(interval("x", "y"), null);
  assert.equal(interval(null, 5), null);
  assert.equal(interval(10, 10), null);
  assert.equal(interval(10, 5), null);
  assert.deepEqual(interval(5, 10), { start: 5, end: 10 });
});

check("placeBlock maps a shift onto the axis in percent", () => {
  const axis = [at("2026-09-14", "07:00"), at("2026-09-14", "19:00")];
  const p = placeBlock(at("2026-09-14", "08:00"), at("2026-09-14", "16:00"), ...axis);
  assert.ok(Math.abs(p.leftPct - 100 / 12) < 1e-9);
  assert.ok(Math.abs(p.widthPct - (8 * 100) / 12) < 1e-9);
  assert.equal(p.clippedStart, false);
  assert.equal(p.clippedEnd, false);
});

check("placeBlock returns null for a block entirely off the axis", () => {
  const axis = [at("2026-09-14", "07:00"), at("2026-09-14", "19:00")];
  assert.equal(placeBlock(at("2026-09-14", "20:00"), at("2026-09-14", "23:00"), ...axis), null);
  assert.equal(placeBlock("nope", "nope", ...axis), null);
});

// ── Midnight-crossing shift ────────────────────────────────────────────────
check("a 22:00–06:00 shift is clipped at midnight and says so", () => {
  const day = dayBoundsLocal("2026-09-14");
  const s = at("2026-09-14", "22:00");
  const e = at("2026-09-15", "06:00");
  const range = boardRange({ businessDay: null, dayStart: day.start, dayEnd: day.end, shifts: [{ start: s, end: e }] });
  assert.equal(range.startHour, 7);
  assert.equal(range.endHour, 24, "axis widened to midnight, not past it");
  const cols = hourColumns("2026-09-14", range.startHour, range.endHour);
  const p = placeBlock(s, e, cols[0].start, cols[cols.length - 1].end);
  assert.equal(p.clippedEnd, true);
  assert.equal(p.clippedStart, false);
  assert.ok(Math.abs(p.widthPct - (2 * 100) / 17) < 1e-9, "two of seventeen hours");
});

check("the morning half of that shift shows on the next day, clipped at its start", () => {
  const day = dayBoundsLocal("2026-09-15");
  const s = at("2026-09-14", "22:00");
  const e = at("2026-09-15", "06:00");
  const range = boardRange({ businessDay: null, dayStart: day.start, dayEnd: day.end, shifts: [{ start: s, end: e }] });
  assert.equal(range.startHour, 0);
  const cols = hourColumns("2026-09-15", range.startHour, range.endHour);
  const p = placeBlock(s, e, cols[0].start, cols[cols.length - 1].end);
  assert.equal(p.clippedStart, true);
  assert.equal(p.clippedEnd, false);
  assert.equal(scheduledMinutes([{ start: s, end: e }], day.start, day.end), 360, "six hours belong to this day");
});

// ── DST ─────────────────────────────────────────────────────────────────────
check("8 March 2026 (spring forward) has no 2am column and 23 hours", () => {
  const cols = hourColumns("2026-03-08", 0, 24);
  assert.equal(cols.length, 23);
  assert.equal(cols.find((c) => c.hour === 2), undefined);
  const day = dayBoundsLocal("2026-03-08");
  assert.equal((day.end - day.start) / H, 23);
  // Every column is exactly one real hour.
  for (const c of cols) assert.equal(c.end - c.start, H);
});

check("1 November 2026 (fall back) has a two-hour 1am column and 25 hours", () => {
  const cols = hourColumns("2026-11-01", 0, 24);
  assert.equal(cols.length, 24);
  const one = cols.find((c) => c.hour === 1);
  assert.equal(one.end - one.start, 2 * H);
  const day = dayBoundsLocal("2026-11-01");
  assert.equal((day.end - day.start) / H, 25);
});

check("on the spring-forward day a 07:00–15:00 shift still lands on the 7 and 15 columns", () => {
  const day = dayBoundsLocal("2026-03-08");
  const s = at("2026-03-08", "07:00");
  const e = at("2026-03-08", "15:00");
  assert.equal((e - s) / H, 8, "the wall clock says eight hours and so does the instant maths after 3am");
  const range = boardRange({ businessDay: null, dayStart: day.start, dayEnd: day.end, shifts: [{ start: s, end: e }] });
  assert.equal(range.startHour, 7);
  assert.equal(range.endHour, 18);
  const cols = hourColumns("2026-03-08", 7, 18);
  const p = placeBlock(s, e, cols[0].start, cols[cols.length - 1].end);
  assert.equal(p.leftPct, 0);
  assert.ok(Math.abs(p.widthPct - (8 * 100) / 11) < 1e-9);
});

check("on the fall-back day a 00:30–03:30 shift is four real hours and boardRange says so", () => {
  const day = dayBoundsLocal("2026-11-01");
  const s = at("2026-11-01", "00:30");
  const e = s + 4 * H; // 03:30 wall clock, because 1am happens twice
  assert.equal(scheduledMinutes([{ start: s, end: e }], day.start, day.end), 240);
  const range = boardRange({ businessDay: null, dayStart: day.start, dayEnd: day.end, shifts: [{ start: s, end: e }] });
  assert.equal(range.startHour, 0);
  assert.ok(range.endHour >= 18);
});

// ── Board range from business hours ────────────────────────────────────────
check("business hours 08:00–17:00 give a 7–18 axis; 06:30–16:30 give 5–18", () => {
  const day = dayBoundsLocal("2026-09-14");
  const a = boardRange({ businessDay: { closed: false, open: "08:00", close: "17:00" }, dayStart: day.start, dayEnd: day.end });
  assert.deepEqual(a, { startHour: 7, endHour: 18 });
  const b = boardRange({ businessDay: { closed: false, open: "06:30", close: "16:30" }, dayStart: day.start, dayEnd: day.end });
  assert.deepEqual(b, { startHour: 5, endHour: 18 });
});

check("a closed day, no hours, or garbage hours fall back to 7–18 — never an invented day", () => {
  const day = dayBoundsLocal("2026-09-14");
  for (const businessDay of [null, undefined, { closed: true, open: "08:00", close: "17:00" }, { closed: false, open: "99:00", close: "x" }, { closed: false, open: "17:00", close: "08:00" }]) {
    assert.deepEqual(boardRange({ businessDay, dayStart: day.start, dayEnd: day.end }), { startHour: 7, endHour: 18 });
  }
});

check("a shift outside business hours widens the axis rather than being hidden", () => {
  const day = dayBoundsLocal("2026-09-14");
  const r = boardRange({
    businessDay: { closed: false, open: "08:00", close: "17:00" },
    dayStart: day.start,
    dayEnd: day.end,
    shifts: [{ start: at("2026-09-14", "05:15"), end: at("2026-09-14", "20:45") }, { start: "junk", end: "junk" }],
  });
  assert.deepEqual(r, { startHour: 5, endHour: 21 });
});

// ── Coverage ────────────────────────────────────────────────────────────────
const D = "2026-09-14";
const dayS = dayBoundsLocal(D);
const axis = { axisStart: at(D, "07:00"), axisEnd: at(D, "18:00") };
const biz = { start: at(D, "08:00"), end: at(D, "17:00") };

check("empty day: every slot is zero, gaps only inside business hours", () => {
  const slots = coverageSlots({ shifts: [], ...axis, business: biz });
  assert.equal(slots.length, 22);
  assert.ok(slots.every((s) => s.onShift === 0 && s.onBreak === 0 && s.working === 0));
  assert.equal(slots.filter((s) => s.gap).length, 18, "08:00–17:00 is eighteen half hours");
  assert.equal(slots[0].gap, false, "07:00 is before opening");
  // Hostile shapes do not throw.
  assert.deepEqual(coverageSlots({ shifts: null, ...axis }), coverageSlots({ shifts: [], ...axis }));
  assert.deepEqual(coverageSlots({ shifts: [null, {}, { start: "x" }], ...axis }).map((s) => s.onShift), coverageSlots({ shifts: [], ...axis }).map((s) => s.onShift));
  assert.deepEqual(coverageSlots({ shifts: [], axisStart: 10, axisEnd: 5 }), []);
});

check("two overlapping shifts count as two; staggered lunches keep one person working", () => {
  const shifts = [
    { start: at(D, "08:00"), end: at(D, "16:00"), breaks: [{ start: at(D, "12:00"), end: at(D, "12:30") }] },
    { start: at(D, "09:00"), end: at(D, "17:00"), breaks: [{ start: at(D, "12:30"), end: at(D, "13:00") }] },
  ];
  const slots = coverageSlots({ shifts, ...axis, business: biz });
  const atSlot = (hhmm) => slots.find((s) => s.start === at(D, hhmm));
  assert.equal(atSlot("08:00").onShift, 1);
  assert.equal(atSlot("09:00").onShift, 2);
  assert.equal(atSlot("12:00").onBreak, 1);
  assert.equal(atSlot("12:00").working, 1);
  assert.equal(atSlot("12:30").onBreak, 1);
  assert.equal(atSlot("12:30").working, 1);
  assert.ok(slots.every((s) => !s.gap || s.start < at(D, "08:00") || s.start >= at(D, "17:00")));
  assert.equal(slots.filter((s) => s.gap).length, 0, "somebody is on site all day");
});

check("the same lunch for both is a gap, and the strip says so", () => {
  const shifts = [
    { start: at(D, "08:00"), end: at(D, "16:00"), breaks: [{ start: at(D, "12:00"), end: at(D, "12:30") }] },
    { start: at(D, "08:00"), end: at(D, "16:00"), breaks: [{ start: at(D, "12:00"), end: at(D, "12:30") }] },
  ];
  const slots = coverageSlots({ shifts, ...axis, business: biz });
  const noon = slots.find((s) => s.start === at(D, "12:00"));
  assert.equal(noon.onShift, 2);
  assert.equal(noon.onBreak, 2);
  assert.equal(noon.working, 0);
  assert.equal(noon.gap, true);
  assert.equal(slots.filter((s) => s.gap).length, 3, "12:00, 16:00 and 16:30 — nobody after four either");
});

check("a break outside its shift is ignored by the strip, not drawn as a phantom", () => {
  const shifts = [
    { start: at(D, "08:00"), end: at(D, "12:00"), breaks: [{ start: at(D, "14:00"), end: at(D, "14:30") }, { start: at(D, "11:45"), end: at(D, "12:15") }] },
  ];
  const slots = coverageSlots({ shifts, ...axis });
  const two = slots.find((s) => s.start === at(D, "14:00"));
  assert.equal(two.onShift, 0);
  assert.equal(two.onBreak, 0, "off shift at 14:00, so not on break either");
  const late = slots.find((s) => s.start === at(D, "11:30"));
  assert.equal(late.onBreak, 1, "the part inside the shift counts");
  const after = slots.find((s) => s.start === at(D, "12:00"));
  assert.equal(after.onShift, 0);
});

check("a 45-minute slot size and a slot that does not divide the axis both work", () => {
  const slots = coverageSlots({ shifts: [], axisStart: at(D, "07:00"), axisEnd: at(D, "08:00"), slotMinutes: 45 });
  assert.equal(slots.length, 2);
  assert.equal(slots[1].end, at(D, "08:00"), "last slot is trimmed to the axis");
  assert.equal(coverageSlots({ shifts: [], ...axis, slotMinutes: 0 }).length, 132, "a zero step is floored to five minutes rather than looping forever");
});

// ── Break validation (what the routes run) ─────────────────────────────────
const S = at(D, "08:00");
const E = at(D, "16:00");
check("validateBreaks accepts a clean set and normalises it", () => {
  const r = validateBreaks(S, E, [
    { start: at(D, "14:00"), end: at(D, "14:15"), kind: "break", paid: true },
    { start: at(D, "12:00"), end: at(D, "12:30"), kind: "lunch", paid: "yes" },
  ]);
  assert.equal(r.ok, true);
  assert.equal(r.breaks.length, 2);
  assert.equal(r.breaks[0].kind, "lunch", "sorted by start");
  assert.equal(r.breaks[0].paid, false, "'yes' is not true — paid is a real boolean or it is false");
  assert.equal(r.breaks[1].paid, true);
  assert.equal(typeof r.breaks[0].start, "string");
});

check("validateBreaks refuses each way a set can be wrong", () => {
  const bad = (breaks) => validateBreaks(S, E, breaks);
  assert.equal(bad([{ start: at(D, "07:30"), end: at(D, "08:15"), kind: "break" }]).ok, false, "starts before the shift");
  assert.equal(bad([{ start: at(D, "15:45"), end: at(D, "16:30"), kind: "break" }]).ok, false, "ends after the shift");
  assert.equal(bad([{ start: at(D, "12:30"), end: at(D, "12:00"), kind: "lunch" }]).ok, false, "end before start");
  assert.equal(bad([{ start: at(D, "12:00"), end: at(D, "12:00"), kind: "lunch" }]).ok, false, "zero length");
  assert.equal(bad([{ start: at(D, "12:00"), end: at(D, "12:30"), kind: "lunch" }, { start: at(D, "12:15"), end: at(D, "12:45"), kind: "break" }]).ok, false, "overlap");
  assert.equal(bad([{ start: at(D, "12:00"), end: at(D, "12:30"), kind: "nap" }]).ok, false, "unknown kind");
  assert.equal(bad([{ start: at(D, "12:00"), end: at(D, "12:30") }]).ok, false, "no kind");
  assert.equal(bad("lunch").ok, false, "not a list");
  assert.equal(bad([null]).ok, false);
  assert.equal(bad([{ start: "x", end: "y", kind: "lunch" }]).ok, false, "garbage instants");
  assert.equal(bad(Array.from({ length: 13 }, (_, i) => ({ start: S + i * 1800000, end: S + i * 1800000 + 600000, kind: "break" }))).ok, false, "too many");
  assert.equal(validateBreaks(E, S, []).ok, false, "an inverted shift is refused before its breaks are read");
});

check("validateBreaks treats an absent list as none and an empty list as clear", () => {
  assert.deepEqual(validateBreaks(S, E, undefined), { ok: true, breaks: [] });
  assert.deepEqual(validateBreaks(S, E, null), { ok: true, breaks: [] });
  assert.deepEqual(validateBreaks(S, E, []), { ok: true, breaks: [] });
  // Touching, not overlapping, is fine.
  assert.equal(validateBreaks(S, E, [{ start: at(D, "12:00"), end: at(D, "12:30"), kind: "lunch" }, { start: at(D, "12:30"), end: at(D, "12:45"), kind: "break" }]).ok, true);
});

// ── Midpoint lunch, scheduled minutes, status ──────────────────────────────
check("midpointLunch lands at 12:00 on an 8–16 shift and snaps to the quarter hour", () => {
  const l = midpointLunch(S, E);
  assert.equal(l.start, at(D, "11:45"));
  assert.equal(l.end, at(D, "12:15"));
  assert.equal(l.kind, "lunch");
  assert.equal(l.paid, false);
  const odd = midpointLunch(at(D, "08:10"), at(D, "15:50"));
  assert.equal(odd.start % 900000, at(D, "00:00") % 900000, "on a quarter hour");
  assert.equal(midpointLunch(S, S + 45 * 60000), null, "too short to hold one");
  assert.equal(midpointLunch("x", "y"), null);
});

check("scheduledMinutes subtracts unpaid breaks, keeps paid ones, ignores breaks outside the shift", () => {
  const shifts = [{ start: S, end: E, breaks: [
    { start: at(D, "12:00"), end: at(D, "12:30"), paid: false },
    { start: at(D, "10:00"), end: at(D, "10:15"), paid: true },
    { start: at(D, "17:00"), end: at(D, "17:30"), paid: false },
  ] }];
  assert.equal(scheduledMinutes(shifts, dayS.start, dayS.end), 450);
  assert.equal(scheduledMinutes([], dayS.start, dayS.end), 0);
  assert.equal(scheduledMinutes(null, dayS.start, dayS.end), 0);
  assert.equal(scheduledMinutes(shifts, "x", "y"), 0);
});

check("statusAt: on shift, on break, off — and hostile rows", () => {
  const shifts = [{ start: S, end: E, breaks: [{ start: at(D, "12:00"), end: at(D, "12:30") }] }];
  assert.equal(statusAt(shifts, at(D, "09:00")), "on_shift");
  assert.equal(statusAt(shifts, at(D, "12:10")), "on_break");
  assert.equal(statusAt(shifts, at(D, "12:30")), "on_shift", "the break's end is exclusive");
  assert.equal(statusAt(shifts, at(D, "16:00")), "off", "the shift's end is exclusive");
  assert.equal(statusAt(shifts, at(D, "06:00")), "off");
  assert.equal(statusAt([null, {}, { start: "x", end: "y", breaks: "?" }], at(D, "09:00")), "off");
  assert.equal(statusAt(shifts, "not a time"), "off");
});

check("hourColumns and dayBoundsLocal refuse a malformed day", () => {
  assert.deepEqual(hourColumns("nope", 7, 18), []);
  assert.equal(dayBoundsLocal("2026-13"), null);
  assert.equal(hourColumns("2026-09-14", 30, 2).length, 1, "clamped to one column rather than none");
});

// ── What happened: the time clock's breaks and the hours they come off ─────
check("entryHours: unpaid breaks come off, paid ones do not, a running one ends at clock-out", () => {
  const cin = at(D, "08:00");
  const cout = at(D, "16:00");
  assert.equal(entryHours(cin, cout, []), 8);
  assert.equal(entryHours(cin, cout, [{ start: at(D, "12:00"), end: at(D, "12:30"), paid: false }]), 7.5);
  assert.equal(entryHours(cin, cout, [{ start: at(D, "12:00"), end: at(D, "12:30"), paid: true }]), 8);
  assert.equal(entryHours(cin, cout, [{ start: at(D, "15:30"), end: null, paid: false }]), 7.5, "still running at clock-out");
  assert.equal(entryHours(cin, cout, [{ start: at(D, "17:00"), end: at(D, "17:30"), paid: false }]), 8, "outside the entry counts for nothing");
  assert.equal(entryHours(cin, cout, [{ start: at(D, "07:45"), end: at(D, "08:15"), paid: false }]), 7.75, "only the part inside");
  assert.equal(entryHours(cin, cout, [{ start: "x", end: "y" }, null]), 8, "hostile rows ignored");
  assert.equal(entryHours(cout, cin, []), null);
  assert.equal(entryHours(cin, cin + 7 * 60000 + 30000, []), 0.13, "two decimals, same rounding as before");
  assert.equal(unpaidBreakMs([{ start: at(D, "12:00"), end: at(D, "12:30") }], cin, cout), 1800000);
  assert.equal(unpaidBreakMs("nope", cin, cout), 0);
});

check("openBreak finds the running one and ignores garbage", () => {
  assert.equal(openBreak([]), null);
  assert.equal(openBreak(null), null);
  assert.equal(openBreak([{ start: at(D, "12:00"), end: at(D, "12:30") }]), null);
  const running = { id: "b2", start: at(D, "14:00"), end: null };
  assert.equal(openBreak([{ start: at(D, "12:00"), end: at(D, "12:30") }, running]), running);
  assert.equal(openBreak([{ start: "junk", end: null }]), null, "an unreadable start is not a running break");
});

console.log(`shift board: ${pass} passed, ${fails.length} failed`);
for (const f of fails) console.error(`  ✗ ${f}`);
if (fails.length) process.exit(1);
