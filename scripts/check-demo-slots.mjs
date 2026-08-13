// scripts/check-demo-slots.mjs
//
//   npm run check:demo-slots
//
// Executes lib/booking/slotGrid.js and lib/demo/slots.js against real inputs.
// Both are pure by design — hosts, their windows and their bookings are passed
// in — so every claim below is a call with an asserted answer rather than a
// reading of the code.
//
// ── What this is guarding ──────────────────────────────────────────────────
//
// The demo calendar used to be three constants: 6–10pm Eastern, eight slots,
// every day for a fortnight, weekends and holidays included, with a global
// unique on DemoBooking.scheduledAt that capped the whole platform at one demo
// per half hour. The failures worth catching are therefore:
//
//   1. hours appearing that nobody stated (the old grid, re-invented as a
//      "sensible default" by a future edit);
//   2. a second host adding no capacity, which is the old constraint back;
//   3. DST arithmetic done with a constant offset, which moves every evening
//      slot by an hour twice a year.
//
// Times are asserted as LOCAL LABELS, not as UTC instants, because a local
// label is what the prospect reads and what the calendar invite says.
//
// ── Mutation-tested, and it needed the practice ────────────────────────────
//
// Fourteen deliberate breaks were introduced into slotGrid.js / slots.js and
// this suite was run against each. All fourteen now fail it:
//
//   empty windows fall back to an invented 6–10pm grid · dayOfWeek ignored ·
//   bookings stop removing slots · overlap test uses <= so an abutting booking
//   eats the next slot · lead time ignored · wall-clock→UTC done with a
//   constant −5h offset · a slot allowed to overrun the window's close · the
//   union collects duplicates instead of deduping · hostsFreeAt trusts any
//   parseable timestamp · host assignment randomised · the day walk anchored on
//   local midnight instead of noon · unparseable times degrading to 00:00 ·
//   the range end ignored · days bucketed in UTC rather than the viewer's zone.
//
// Three of those initially SURVIVED and the suite was widened for them: the
// midnight anchor (which only misbehaves on the autumn transition, so the
// fortnight test now runs in both directions), the deduping union (only
// observable with two hosts sharing one half hour), and time parsing (only
// observable when ONE end of a window is garbage and the other is valid).
import { slotGrid, dayKeyIn } from "@/lib/booking/slotGrid";
import {
  availableSlotsByDay,
  assembleHosts,
  hostsFreeAt,
  hostGrid,
  pickHost,
  demoRange,
  DEMO_TZ,
  SLOT_MINUTES,
  LEAD_MS,
} from "@/lib/demo/slots";

let pass = 0;
let fail = 0;
function ok(name, condition, got) {
  if (condition) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`);
  }
}
const eq = (name, actual, expected) =>
  ok(name, JSON.stringify(actual) === JSON.stringify(expected), actual);

const timeFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: DEMO_TZ, hour: "numeric", minute: "2-digit", hour12: true,
});
const labelsIn = (dates, tz = DEMO_TZ) =>
  dates.map((d) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true,
    }).format(d),
  );

const win = (dayOfWeek, startTime, endTime, timezone = DEMO_TZ) => ({
  dayOfWeek, startTime, endTime, timezone,
});
const weekdays = (startTime, endTime, tz = DEMO_TZ) =>
  [1, 2, 3, 4, 5].map((d) => win(d, startTime, endTime, tz));
const everyDay = (startTime, endTime, tz = DEMO_TZ) =>
  [0, 1, 2, 3, 4, 5, 6].map((d) => win(d, startTime, endTime, tz));

// A fixed Sunday well clear of any DST transition, so the general cases aren't
// quietly testing the special ones.
const SUN = new Date("2026-06-07T12:00:00Z"); // Sunday 8am Eastern
const week = (from) => ({
  from,
  to: new Date(from.getTime() + 7 * 86400000),
  slotMinutes: 30,
  timezone: DEMO_TZ,
  now: from,
});
/** One day out of an availableSlotsByDay result, by its display label. */
const dayNamed = (days, label) => days.find((d) => d.day === label) ?? { day: label, slots: [] };
/** One day out of a slotGrid result, by its ISO key. */
const gridDay = (grid, key) => grid.find((g) => g.day === key) ?? { day: key, starts: [] };

// ───────────────────────────────────────────────────────────────────────────
console.log("\nA host's stated days are the only days offered");

{
  const grid = slotGrid({ ...week(SUN), windows: weekdays("09:00", "17:00") });
  const days = grid.map((g) => g.day);
  const weekendDays = days.filter((day) => {
    const dow = new Date(`${day}T12:00:00Z`).getUTCDay();
    return dow === 0 || dow === 6;
  });
  ok("Mon–Fri 9–5 offers something on 5 days", days.length === 5, days);
  eq("Mon–Fri 9–5 offers nothing at the weekend", weekendDays, []);
  ok(
    "every offered day is a weekday",
    days.every((day) => {
      const dow = new Date(`${day}T12:00:00Z`).getUTCDay();
      return dow >= 1 && dow <= 5;
    }),
    days,
  );
  ok("9–5 in 30s is 16 slots a day", grid[0].starts.length === 16, grid[0].starts.length);
  eq("the day runs 9:00 AM to 4:30 PM", [
    labelsIn(grid[0].starts)[0],
    labelsIn(grid[0].starts).at(-1),
  ], ["9:00 AM", "4:30 PM"]);
}

{
  // Saturday-only. The mirror image: proving weekends aren't hard-excluded
  // either, only unstated.
  const grid = slotGrid({ ...week(SUN), windows: [win(6, "10:00", "12:00")] });
  ok("a Saturday-only host is offered on Saturday", grid.length === 1, grid.map((g) => g.day));
  ok(
    "…and that day is a Saturday",
    new Date(`${grid[0].day}T12:00:00Z`).getUTCDay() === 6,
    grid[0]?.day,
  );
}

// ───────────────────────────────────────────────────────────────────────────
console.log("\nNo windows means no slots — never an invented grid");

eq("no windows at all", slotGrid({ ...week(SUN), windows: [] }), []);
eq("windows undefined", slotGrid({ ...week(SUN), windows: undefined }), []);
eq("windows null", slotGrid({ ...week(SUN), windows: null }), []);
eq("not an array", slotGrid({ ...week(SUN), windows: "9-5" }), []);
eq("a window with no times", slotGrid({ ...week(SUN), windows: [{ dayOfWeek: 1 }] }), []);
eq("a window with no timezone",
  slotGrid({ ...week(SUN), windows: [{ dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }] }), []);
eq("end before start", slotGrid({ ...week(SUN), windows: [win(1, "17:00", "09:00")] }), []);
eq("end equal to start", slotGrid({ ...week(SUN), windows: [win(1, "09:00", "09:00")] }), []);
eq("garbage times", slotGrid({ ...week(SUN), windows: [win(1, "nine", "five")] }), []);
// An unparseable START must not degrade to midnight — that turns "we didn't
// understand this row" into "available from 00:00", which is the invented-hours
// failure wearing a different hat.
eq("garbage start with a real end",
  slotGrid({ ...week(SUN), windows: [win(1, "nine", "17:00")] }), []);
eq("garbage end with a real start",
  slotGrid({ ...week(SUN), windows: [win(1, "09:00", "later")] }), []);
eq("out-of-range clock times",
  slotGrid({ ...week(SUN), windows: [win(1, "09:70", "25:00")] }), []);
eq("dayOfWeek out of range", slotGrid({ ...week(SUN), windows: [win(7, "09:00", "17:00")] }), []);
eq("a window shorter than one slot",
  slotGrid({ ...week(SUN), windows: [win(1, "09:00", "09:20")] }), []);
eq("zero configured hosts yields zero days", availableSlotsByDay([], SUN), []);
eq("a host object with no windows yields zero days",
  availableSlotsByDay([{ adminId: "a", windows: [], busy: [] }], SUN), []);
eq("hostsFreeAt with no hosts", hostsFreeAt([], "2026-06-08T22:00:00.000Z", SUN), []);

// ───────────────────────────────────────────────────────────────────────────
console.log("\nBookings remove slots, per host");

{
  const monday = "2026-06-08";
  const nine = new Date("2026-06-08T13:00:00Z"); // 9:00 AM Eastern
  const busy = [{ start: nine, end: new Date(nine.getTime() + 30 * 60000) }];

  const free = slotGrid({ ...week(SUN), windows: [win(1, "09:00", "11:00")] });
  const blocked = slotGrid({ ...week(SUN), windows: [win(1, "09:00", "11:00")], busy });

  eq("with nothing booked", labelsIn(free[0].starts),
    ["9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM"]);
  eq("the booked 9:00 disappears", labelsIn(blocked[0].starts),
    ["9:30 AM", "10:00 AM", "10:30 AM"]);
  ok("…on the right day", blocked[0].day === monday, blocked[0].day);

  // The same booking, on the OTHER host's calendar, must not touch this one.
  const hostA = { adminId: "a", windows: [win(1, "09:00", "11:00")], busy, load: 1 };
  const hostB = { adminId: "b", windows: [win(1, "09:00", "11:00")], busy: [], load: 0 };
  eq("host A has lost 9:00", labelsIn(hostGrid(hostA, SUN)[0].starts),
    ["9:30 AM", "10:00 AM", "10:30 AM"]);
  eq("host B still has 9:00", labelsIn(hostGrid(hostB, SUN)[0].starts),
    ["9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM"]);
  eq("the union still offers 9:00",
    availableSlotsByDay([hostA, hostB], SUN)[0].slots.map((s) => s.label),
    ["9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM"]);
  eq("only host B is free at 9:00",
    hostsFreeAt([hostA, hostB], nine.toISOString(), SUN).map((h) => h.adminId), ["b"]);

  // An overlapping range that isn't slot-aligned still blocks what it covers.
  const messy = [{ start: new Date("2026-06-08T13:15:00Z"), end: new Date("2026-06-08T13:45:00Z") }];
  eq("a booking straddling two slots removes both",
    labelsIn(slotGrid({ ...week(SUN), windows: [win(1, "09:00", "11:00")], busy: messy })[0].starts),
    ["10:00 AM", "10:30 AM"]);
  // Touching, not overlapping: 9:30 ends exactly as 9:30–10:00 begins.
  const abutting = [{ start: new Date("2026-06-08T13:00:00Z"), end: new Date("2026-06-08T13:30:00Z") }];
  eq("a booking that merely abuts the next slot doesn't remove it",
    labelsIn(slotGrid({ ...week(SUN), windows: [win(1, "09:00", "11:00")], busy: abutting })[0].starts),
    ["9:30 AM", "10:00 AM", "10:30 AM"]);
}

// ───────────────────────────────────────────────────────────────────────────
console.log("\nTwo hosts are twice the capacity of one");

{
  // One half-hour window on one Monday: the narrowest possible test of the
  // thing the old global unique([scheduledAt]) got wrong. The picker covers a
  // fortnight, so the same weekly window recurs the following Monday — every
  // assertion is scoped to the ONE day the booking lands on.
  const MON = "Mon, Jun 8";
  const iso = "2026-06-08T13:00:00.000Z"; // Monday 9:00 AM Eastern
  const windows = [win(1, "09:00", "09:30")];
  const booking = [{ start: new Date(iso), end: new Date(Date.parse(iso) + 30 * 60000) }];

  const one = [{ adminId: "a", windows, busy: [], load: 0 }];
  const two = [
    { adminId: "a", windows, busy: [], load: 0 },
    { adminId: "b", windows, busy: [], load: 0 },
  ];

  ok("one host: the slot is offered",
    dayNamed(availableSlotsByDay(one, SUN), MON).slots.length === 1);
  eq("one host: after it's booked, nothing is offered that day",
    dayNamed(availableSlotsByDay([{ ...one[0], busy: booking }], SUN), MON).slots, []);
  ok("…but the following Monday is untouched",
    dayNamed(availableSlotsByDay([{ ...one[0], busy: booking }], SUN), "Mon, Jun 15").slots.length === 1);

  ok("two hosts: still ONE chip, not a duplicate",
    dayNamed(availableSlotsByDay(two, SUN), MON).slots.length === 1,
    dayNamed(availableSlotsByDay(two, SUN), MON).slots);
  eq("two hosts: two people are free at it",
    hostsFreeAt(two, iso, SUN).map((h) => h.adminId), ["a", "b"]);

  const afterFirst = [{ ...two[0], busy: booking, load: 1 }, two[1]];
  ok("two hosts: the slot survives the FIRST booking",
    dayNamed(availableSlotsByDay(afterFirst, SUN), MON).slots.length === 1);
  eq("…and only the second host is free for it",
    hostsFreeAt(afterFirst, iso, SUN).map((h) => h.adminId), ["b"]);

  const afterBoth = [
    { ...two[0], busy: booking, load: 1 },
    { ...two[1], busy: booking, load: 1 },
  ];
  eq("two hosts: the slot goes after the SECOND booking",
    dayNamed(availableSlotsByDay(afterBoth, SUN), MON).slots, []);
  eq("…and nobody is free for it", hostsFreeAt(afterBoth, iso, SUN), []);
}

// ───────────────────────────────────────────────────────────────────────────
console.log("\nRows → hosts: who a booking blocks");

{
  const rows = [
    { adminId: "a", email: "a@x", dayOfWeek: 1, startTime: "09:00", endTime: "11:00", timezone: DEMO_TZ },
    { adminId: "a", email: "a@x", dayOfWeek: 2, startTime: "09:00", endTime: "11:00", timezone: DEMO_TZ },
    { adminId: "b", email: "b@x", dayOfWeek: 1, startTime: "09:00", endTime: "11:00", timezone: DEMO_TZ },
  ];
  const iso = "2026-06-08T13:00:00.000Z"; // Monday 9:00 AM Eastern

  eq("no rows means no hosts", assembleHosts([], []), []);
  eq("rows group by admin", assembleHosts(rows, []).map((h) => [h.adminId, h.windows.length]),
    [["a", 2], ["b", 1]]);
  eq("the admin's email comes along", assembleHosts(rows, []).map((h) => h.email), ["a@x", "b@x"]);

  const owned = assembleHosts(rows, [{ hostAdminId: "a", scheduledAt: new Date(iso) }]);
  eq("a booking with a host blocks only that host",
    owned.map((h) => [h.adminId, h.busy.length, h.load]), [["a", 1, 1], ["b", 0, 0]]);
  eq("…and only they lose the slot",
    hostsFreeAt(owned, iso, SUN).map((h) => h.adminId), ["b"]);

  // The legacy case: rows written before hosts existed carry no hostAdminId.
  const orphan = assembleHosts(rows, [{ hostAdminId: null, scheduledAt: new Date(iso) }]);
  eq("a host-less booking blocks EVERY host",
    orphan.map((h) => [h.adminId, h.busy.length]), [["a", 1], ["b", 1]]);
  eq("…so nobody is offered that slot", hostsFreeAt(orphan, iso, SUN), []);
  eq("…and it counts against nobody's load", orphan.map((h) => h.load), [0, 0]);
  ok("…but the rest of the day survives",
    hostGrid(orphan[0], SUN)[0].starts.length === 3,
    labelsIn(hostGrid(orphan[0], SUN)[0].starts));

  eq("an unparseable booking time is ignored, not treated as blocking",
    assembleHosts(rows, [{ hostAdminId: "a", scheduledAt: "whenever" }]).map((h) => h.busy.length),
    [0, 0]);
  eq("bookings that aren't an array", assembleHosts(rows, null).map((h) => h.busy.length), [0, 0]);
}

console.log("\nHost assignment is deterministic");
{
  const h = (adminId, load) => ({ adminId, load, windows: [], busy: [] });
  eq("least-loaded wins", pickHost([h("z", 0), h("a", 4)]).adminId, "z");
  eq("ties break on id, ascending", pickHost([h("z", 2), h("a", 2)]).adminId, "a");
  eq("input order doesn't matter", pickHost([h("a", 2), h("z", 2)]).adminId, "a");
  eq("no free hosts yields null", pickHost([]), null);
  ok("pickHost doesn't mutate its input", (() => {
    const list = [h("z", 2), h("a", 2)];
    pickHost(list);
    return list[0].adminId === "z";
  })());
}

// ───────────────────────────────────────────────────────────────────────────
console.log("\nLead time excludes imminent slots");

{
  // Monday 08:50 Eastern. With a 2h lead, 9:00 and 10:30 are out; 11:00 is in.
  const now = new Date("2026-06-08T12:50:00Z");
  const windows = [win(1, "09:00", "13:00")];
  const opts = { windows, from: now, to: new Date(now.getTime() + 86400000),
    slotMinutes: 30, timezone: DEMO_TZ, now };

  eq("no lead: the whole window", labelsIn(slotGrid(opts)[0].starts).slice(0, 3),
    ["9:00 AM", "9:30 AM", "10:00 AM"]);
  eq("2h lead: starts at 11:00",
    labelsIn(slotGrid({ ...opts, leadMs: 2 * 3600000 })[0].starts),
    ["11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM"]);
  eq("a lead longer than the window empties the day",
    slotGrid({ ...opts, leadMs: 24 * 3600000 }), []);
  ok("the demo lead is 2 hours", LEAD_MS === 2 * 60 * 60 * 1000, LEAD_MS);

  // And through the demo path, which is what the route actually calls.
  const host = { adminId: "a", windows, busy: [] };
  eq("hostGrid applies the same lead",
    labelsIn(hostGrid(host, now)[0].starts), ["11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM"]);
  eq("a slot inside the lead can't be booked",
    hostsFreeAt([host], "2026-06-08T13:00:00.000Z", now), []);
  eq("a slot past the lead can",
    hostsFreeAt([host], "2026-06-08T15:00:00.000Z", now).map((h) => h.adminId), ["a"]);
}

// ───────────────────────────────────────────────────────────────────────────
console.log("\nDST — America/Toronto, both directions");

// 2026: forward Sun 8 Mar (02:00 EST → 03:00 EDT), back Sun 1 Nov (02:00 EDT →
// 01:00 EST). Asserted as local labels: a constant UTC offset passes none of
// these, which is the point.
{
  const before = new Date("2026-03-01T12:00:00Z");
  const grid = slotGrid({
    windows: [win(0, "01:00", "05:00")],
    from: new Date("2026-03-08T00:00:00Z"),
    to: new Date("2026-03-09T12:00:00Z"),
    slotMinutes: 30,
    timezone: DEMO_TZ,
    now: before,
  });
  const starts = grid[0]?.starts ?? [];
  ok("spring forward: a 4-hour window is 3 real hours", starts.length === 6, starts.length);
  eq("spring forward: 2 AM never appears", labelsIn(starts),
    ["1:00 AM", "1:30 AM", "3:00 AM", "3:30 AM", "4:00 AM", "4:30 AM"]);
  ok("spring forward: the day is 8 March local", grid[0]?.day === "2026-03-08", grid[0]?.day);
  ok("spring forward: real elapsed time is 3h",
    starts.at(-1).getTime() - starts[0].getTime() === 2.5 * 3600000,
    (starts.at(-1) - starts[0]) / 3600000);
}

{
  const before = new Date("2026-10-25T12:00:00Z");
  const grid = slotGrid({
    windows: [win(0, "01:00", "05:00")],
    from: new Date("2026-11-01T00:00:00Z"),
    to: new Date("2026-11-02T12:00:00Z"),
    slotMinutes: 30,
    timezone: DEMO_TZ,
    now: before,
  });
  const starts = grid[0]?.starts ?? [];
  ok("fall back: a 4-hour window is 5 real hours", starts.length === 10, starts.length);
  eq("fall back: the 1 AM hour happens twice", labelsIn(starts),
    ["1:00 AM", "1:30 AM", "1:00 AM", "1:30 AM", "2:00 AM", "2:30 AM",
      "3:00 AM", "3:30 AM", "4:00 AM", "4:30 AM"]);
  ok("fall back: the repeated hour is two DIFFERENT instants",
    new Set(starts.map((s) => s.getTime())).size === 10);
  ok("fall back: it's all still 1 November local", grid[0]?.day === "2026-11-01", grid[0]?.day);
}

{
  // The evening window the product actually ships: 6–10 PM has to read 6:00 PM
  // in January and in July, which a fixed offset cannot do. The ranges are
  // deliberately wider than the day under test and the day is picked by key —
  // a range boundary that happens to fall mid-window would otherwise truncate
  // the answer and look like a DST bug.
  const pad = (n) => String(n).padStart(2, "0");
  const dayIn = (month, day, now) =>
    gridDay(
      slotGrid({
        windows: everyDay("18:00", "22:00"),
        from: new Date(`2026-${month}-${pad(day - 1)}T12:00:00Z`),
        to: new Date(`2026-${month}-${pad(day + 1)}T12:00:00Z`),
        slotMinutes: 30, timezone: DEMO_TZ, now,
      }),
      `2026-${month}-${pad(day)}`,
    );

  const summer = dayIn("07", 6, new Date("2026-07-01T00:00:00Z"));
  const winter = dayIn("01", 6, new Date("2026-01-01T00:00:00Z"));
  const shape = ["6:00 PM", "6:30 PM", "7:00 PM", "7:30 PM",
    "8:00 PM", "8:30 PM", "9:00 PM", "9:30 PM"];
  eq("July: 6–10 PM is eight slots starting 6:00 PM", labelsIn(summer.starts), shape);
  eq("January: identical local labels", labelsIn(winter.starts), shape);
  ok("…and they are different UTC offsets",
    summer.starts[0].toISOString().slice(11, 16) !==
      winter.starts[0].toISOString().slice(11, 16),
    [summer.starts[0].toISOString(), winter.starts[0].toISOString()]);
  eq("July 6:00 PM Eastern is 22:00 UTC (EDT, UTC-4)",
    summer.starts[0].toISOString(), "2026-07-06T22:00:00.000Z");
  eq("January 6:00 PM Eastern is 23:00 UTC (EST, UTC-5)",
    winter.starts[0].toISOString(), "2026-01-06T23:00:00.000Z");
}

// The transition falling INSIDE the fortnight the picker covers, in BOTH
// directions. Autumn is the one that catches a day-stepper anchored on local
// midnight: 1 Nov midnight Eastern + 24h is 11pm the SAME date, so the walk
// stops advancing and every later day silently vanishes from the picker.
for (const [season, nowIso] of [
  ["spring", "2026-03-01T18:00:00Z"], // 1 Mar, 1pm Eastern — forward on the 8th
  ["autumn", "2026-10-26T17:00:00Z"], // 26 Oct, 1pm Eastern — back on the 1st
]) {
  const now = new Date(nowIso);
  const days = availableSlotsByDay(
    [{ adminId: "a", windows: everyDay("18:00", "22:00"), busy: [] }],
    now,
  );
  ok(`${season}: the picker spans 15 local days across the transition`,
    days.length === 15, days.length);
  ok(`${season}: every day has the full eight slots`,
    days.every((d) => d.slots.length === 8), days.map((d) => d.slots.length));
  ok(`${season}: no day label repeats`,
    new Set(days.map((d) => d.day)).size === days.length, days.map((d) => d.day));
  ok(`${season}: the run of days is consecutive`,
    days.every((d, i) => i === 0 ||
      new Date(d.slots[0].iso) - new Date(days[i - 1].slots[0].iso) >= 20 * 3600000),
    days.map((d) => d.day));
  ok(`${season}: every slot reads between 6:00 and 9:30 PM`,
    days.every((d) => d.slots.every((s) => / PM$/.test(s.label))),
    days.flatMap((d) => d.slots.map((s) => s.label)).filter((l) => !/ PM$/.test(l)));
  ok(`${season}: the transition day itself is present with eight slots`,
    days.some((d) => d.day === (season === "spring" ? "Sun, Mar 8" : "Sun, Nov 1") &&
      d.slots.length === 8),
    days.map((d) => `${d.day}:${d.slots.length}`));
}

// ───────────────────────────────────────────────────────────────────────────
console.log("\nHosts in other timezones compose");

{
  // Vancouver 9–5 Monday is 12:00–20:00 Eastern the same day.
  const now = new Date("2026-06-07T12:00:00Z");
  const bc = { adminId: "bc", windows: [win(1, "09:00", "17:00", "America/Vancouver")], busy: [] };
  const on = { adminId: "on", windows: [win(1, "09:00", "17:00")], busy: [] };

  const bcLabels = labelsIn(hostGrid(bc, now)[0].starts);
  eq("a Vancouver 9–5 reads noon–7:30 PM Eastern",
    [bcLabels[0], bcLabels.at(-1)], ["12:00 PM", "7:30 PM"]);
  eq("…and 9:00 AM Vancouver is 9:00 AM Vancouver",
    labelsIn([hostGrid(bc, now)[0].starts[0]], "America/Vancouver"), ["9:00 AM"]);

  const union = availableSlotsByDay([on, bc], now);
  const monday = union.find((d) => d.slots.length > 16);
  eq("the union runs 9:00 AM to 7:30 PM Eastern",
    [monday.slots[0].label, monday.slots.at(-1).label], ["9:00 AM", "7:30 PM"]);
  ok("overlapping hours are offered once, not twice",
    new Set(monday.slots.map((s) => s.iso)).size === monday.slots.length,
    monday.slots.length);
  ok("the union is chronological",
    monday.slots.every((s, i) => i === 0 || s.iso > monday.slots[i - 1].iso));
}

// ───────────────────────────────────────────────────────────────────────────
console.log("\nThe response shape the marketing hero renders");

{
  const now = new Date("2026-06-07T12:00:00Z");
  const days = availableSlotsByDay(
    [{ adminId: "a", windows: everyDay("18:00", "22:00"), busy: [] }],
    now,
  );
  ok("days is a non-empty array", Array.isArray(days) && days.length > 0);
  ok("every day has { day, slots }",
    days.every((d) => typeof d.day === "string" && Array.isArray(d.slots)));
  ok("every slot has { iso, label }",
    days.every((d) => d.slots.every((s) => typeof s.iso === "string" && typeof s.label === "string")));
  ok("no day is emitted empty", days.every((d) => d.slots.length > 0));
  ok("iso parses back to the labelled instant",
    days.every((d) => d.slots.every((s) => timeFmt.format(new Date(s.iso)) === s.label)));
  ok("day labels look like 'Sun, Jun 7'", /^[A-Z][a-z]{2}, [A-Z][a-z]{2} \d{1,2}$/.test(days[0].day),
    days[0].day);
  ok("the slot length is 30 minutes", SLOT_MINUTES === 30, SLOT_MINUTES);

  const { from, to } = demoRange(now);
  ok("the range starts now", from.getTime() === now.getTime());
  ok("the range ends at a local midnight", dayKeyIn(new Date(to.getTime() - 1), DEMO_TZ) !==
    dayKeyIn(to, DEMO_TZ));
  ok("nothing is offered outside the range",
    days.every((d) => d.slots.every((s) => {
      const t = new Date(s.iso).getTime();
      return t >= from.getTime() && t < to.getTime();
    })));
}

// ───────────────────────────────────────────────────────────────────────────
console.log("\nHostile input doesn't produce phantom availability");

{
  const host = { adminId: "a", windows: everyDay("18:00", "22:00"), busy: [] };
  const now = new Date("2026-06-07T12:00:00Z");
  for (const posted of [
    "",
    "not-a-date",
    null,
    undefined,
    "2026-06-08T03:00:00.000Z",   // 11pm Eastern — outside every window
    "2026-06-08T22:15:00.000Z",   // 6:15pm — between offered starts
    "2027-06-08T22:00:00.000Z",   // right time of day, a year out
    "1999-06-08T22:00:00.000Z",   // in the past
  ]) {
    eq(`rejects ${JSON.stringify(posted)}`, hostsFreeAt([host], posted, now), []);
  }
  const good = availableSlotsByDay([host], now)[0].slots[0].iso;
  eq("but accepts one it actually offered",
    hostsFreeAt([host], good, now).map((h) => h.adminId), ["a"]);
}

{
  // Busy ranges that make no sense must not be treated as blocking everything,
  // nor throw. Absence of a valid range is absence of a block.
  const windows = [win(1, "09:00", "11:00")];
  const junk = [
    { start: null, end: null },
    { start: new Date("2026-06-08T13:00:00Z"), end: new Date("2026-06-08T12:00:00Z") }, // backwards
    { start: "nonsense", end: "nonsense" },
    {},
  ];
  eq("malformed busy ranges are ignored, not obeyed",
    labelsIn(slotGrid({ ...week(SUN), windows, busy: junk })[0].starts),
    ["9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM"]);
  eq("busy that isn't an array", labelsIn(slotGrid({ ...week(SUN), windows, busy: "nope" })[0].starts),
    ["9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM"]);
}

{
  eq("an inverted range yields nothing",
    slotGrid({ windows: weekdays("09:00", "17:00"), from: new Date("2026-06-10T00:00:00Z"),
      to: new Date("2026-06-01T00:00:00Z"), slotMinutes: 30, timezone: DEMO_TZ, now: SUN }), []);
  eq("a zero-length slot yields nothing",
    slotGrid({ ...week(SUN), windows: weekdays("09:00", "17:00"), slotMinutes: 0 }), []);
  ok("a slot longer than the window yields nothing for it",
    slotGrid({ ...week(SUN), windows: [win(1, "09:00", "10:00")], slotMinutes: 90 }).length === 0);
  ok("a 60-minute slot in a 60-minute window yields exactly one",
    slotGrid({ ...week(SUN), windows: [win(1, "09:00", "10:00")], slotMinutes: 60 })[0].starts.length === 1);
}

{
  // Two windows on the same day, one wholly inside the other: the overlap is
  // offered once. A Set-free implementation double-books the picker.
  const grid = slotGrid({
    ...week(SUN),
    windows: [win(1, "09:00", "12:00"), win(1, "10:00", "11:00")],
  });
  eq("overlapping windows on one day are merged, not concatenated",
    labelsIn(grid[0].starts),
    ["9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM"]);
}

{
  // stepMinutes: starts every 15 minutes, each still 30 minutes long, so the
  // last start is 30 minutes before close.
  const grid = slotGrid({
    ...week(SUN), windows: [win(1, "09:00", "10:00")], slotMinutes: 30, stepMinutes: 15,
  });
  eq("a 15-minute step inside a 1-hour window", labelsIn(grid[0].starts),
    ["9:00 AM", "9:15 AM", "9:30 AM"]);
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
