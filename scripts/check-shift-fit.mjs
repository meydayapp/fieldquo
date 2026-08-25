// scripts/check-shift-fit.mjs
//
// Executes the shift-fit engine against fixed instants. No database, no clock.
//
//   node --import ./scripts/alias-loader.mjs scripts/check-shift-fit.mjs
//
// The distinction this guards is the whole feature, and it is easy to get
// backwards:
//
//   declared availability  BLOCKS   — they told you they are not there
//   approved leave         BLOCKS   — they asked, and you said yes
//   usual working hours    WARNS    — an extra day at a six o'clock start is
//                                     the case a rota tool exists for
//
// Turn that last one into a block and the tool refuses the overtime week,
// which is the week people actually need it for.
import assert from "node:assert/strict";
import { shiftFit, workersMissingHours } from "@/lib/scheduling/shiftFit";

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

const TZ = "America/Toronto";
const weekdays = [1, 2, 3, 4, 5];
// Jonny: available 06:00–20:00 weekdays, normally works 08:00–16:00 weekdays.
const AVAIL = weekdays.map((d) => ({ dayOfWeek: d, startTime: "06:00", endTime: "20:00", timezone: TZ }));
const HOURS = weekdays.map((d) => ({ dayOfWeek: d, startTime: "08:00", endTime: "16:00", timezone: TZ }));

// 2026-08-31 is a Monday; -04:00 is Toronto in August.
const at = (day, from, to) => ({
  start: new Date(`${day}T${from}:00-04:00`),
  end: new Date(`${day}T${to}:00-04:00`),
});
const fit = (cfg, over = {}) =>
  shiftFit({ ...cfg, availability: AVAIL, workingHours: HOURS, timezone: TZ, ...over });

check("a normal day passes clean", () => {
  const r = fit(at("2026-08-31", "08", "16"));
  assert.equal(r.ok, true);
  assert.deepEqual(r.blocks, []);
  assert.deepEqual(r.warnings, []);
});

check("an early start inside availability is ALLOWED, with a warning", () => {
  // The exact case: "in two weeks he starts at 6am instead of 8".
  const r = fit(at("2026-08-31", "06", "14"));
  assert.equal(r.ok, true, "must not refuse the overtime week");
  assert.deepEqual(r.blocks, []);
  assert.ok(r.warnings.length > 0, "but it is not his usual pattern");
  assert.match(r.warnings[0], /usual/i);
});

check("outside declared availability is refused", () => {
  const r = fit(at("2026-08-31", "05", "13"));
  assert.equal(r.ok, false);
  assert.ok(r.blocks.some((b) => /available/i.test(b)));
});

check("a day they never declared is refused", () => {
  const r = fit(at("2026-08-29", "08", "16")); // Saturday
  assert.equal(r.ok, false);
  assert.ok(r.blocks.some((b) => /Saturday/.test(b)));
});

check("approved leave refuses; a pending request does not", () => {
  const window = { startDate: new Date("2026-08-31"), endDate: new Date("2026-09-01") };
  const approved = fit(at("2026-08-31", "08", "16"), {
    leave: [{ ...window, status: "approved" }],
  });
  assert.equal(approved.ok, false);
  assert.ok(approved.blocks.some((b) => /time off/i.test(b)));
  // A request nobody has answered must not block the rota — the person looking
  // at it may be the one about to approve or refuse it.
  for (const status of ["pending", "rejected", "cancelled"]) {
    const r = fit(at("2026-08-31", "08", "16"), { leave: [{ ...window, status }] });
    assert.equal(r.ok, true, status);
  }
});

check("silence is not a refusal", () => {
  // A new hire with nothing declared must be schedulable on their first day.
  const r = shiftFit({ ...at("2026-08-29", "03", "11"), timezone: TZ });
  assert.equal(r.ok, true);
  assert.deepEqual(r.blocks, []);
  assert.ok(r.notes.length >= 2, "but the gaps are named");
  assert.ok(r.notes.some((n) => /available/i.test(n)));
  assert.ok(r.notes.some((n) => /working hours/i.test(n)));
});

check("working hours alone never block, whatever the hour", () => {
  for (const [from, to] of [["03", "05"], ["20", "23"], ["00", "02"]]) {
    const r = shiftFit({ ...at("2026-08-31", from, to), workingHours: HOURS, timezone: TZ });
    assert.equal(r.ok, true, `${from}–${to}`);
    assert.ok(r.warnings.length > 0, `${from}–${to} should still warn`);
  }
});

check("a shift ending exactly on the boundary fits", () => {
  // Off-by-one at the edge is the classic way a rule refuses the shift it was
  // written to allow.
  assert.equal(fit(at("2026-08-31", "06", "20")).ok, true);
  assert.equal(fit(at("2026-08-31", "06", "21")).ok, false);
});

check("a shift crossing midnight is checked on BOTH days", () => {
  const nights = [5, 6].map((d) => ({ dayOfWeek: d, startTime: "22:00", endTime: "06:00", timezone: TZ }));
  // Friday 22:00 → Saturday 06:00, against a Friday-and-Saturday night window.
  const ok = shiftFit({
    start: new Date("2026-08-28T22:00:00-04:00"),
    end: new Date("2026-08-29T06:00:00-04:00"),
    availability: nights,
    timezone: TZ,
  });
  assert.equal(ok.ok, true, ok.blocks.join(" "));
  // The same hours with only weekday availability must be refused, not slip
  // through because the START looked fine.
  const bad = shiftFit({
    start: new Date("2026-08-28T22:00:00-04:00"),
    end: new Date("2026-08-29T06:00:00-04:00"),
    availability: AVAIL,
    timezone: TZ,
  });
  assert.equal(bad.ok, false);
});

check("availability is read in the worker's timezone, not the server's", () => {
  // 08:00 Toronto is 05:00 Vancouver. A Vancouver worker available 06:00–20:00
  // local must refuse a shift that is 08:00 in Toronto.
  const vanAvail = weekdays.map((d) => ({
    dayOfWeek: d,
    startTime: "06:00",
    endTime: "20:00",
    timezone: "America/Vancouver",
  }));
  const r = shiftFit({
    start: new Date("2026-08-31T08:00:00-04:00"),
    end: new Date("2026-08-31T16:00:00-04:00"),
    availability: vanAvail,
    timezone: "America/Vancouver",
  });
  assert.equal(r.ok, false, "05:00 local is before they are available");
});

check("hostile input never throws and never silently allows", () => {
  const nasty = [null, undefined, "", "nope", NaN, {}, [], 42, 1e308];
  for (const v of nasty) {
    const r = shiftFit({ start: v, end: v, availability: AVAIL, timezone: TZ });
    assert.equal(r.ok, false, String(v));
    assert.ok(r.blocks.length > 0, String(v));
  }
  // Junk rows are skipped, not crashed on, and not treated as a window.
  const junk = [null, {}, { dayOfWeek: 1, startTime: "25:00", endTime: "99:99" }, { dayOfWeek: "x" }];
  const r = shiftFit({ ...at("2026-08-31", "08", "16"), availability: junk, timezone: TZ });
  assert.equal(r.ok, false, "no usable window is not a free pass");
  const r2 = shiftFit({ ...at("2026-08-31", "08", "16"), workingHours: junk, timezone: TZ });
  assert.equal(r2.ok, true, "junk working hours still never block");
});

check("the missing-hours banner counts only people who could have hours", () => {
  const workers = [
    { id: "a", name: "Jonny", userId: "u1" },
    { id: "b", name: "Sam", userId: "u2" },
    { id: "c", name: "Sub with no login", userId: null },
  ];
  const missing = workersMissingHours(workers, { u1: [{ userId: "u1" }] });
  assert.deepEqual(missing.map((w) => w.name), ["Sam"]);
  // A worker with no login cannot HAVE working hours, so counting them would
  // make the banner permanent and therefore invisible.
  assert.ok(!missing.some((w) => w.userId === null));
  assert.deepEqual(workersMissingHours(null, null), []);
  assert.deepEqual(workersMissingHours([], {}), []);
});

if (fails.length) {
  console.error(`✗ ${fails.length} failed, ${pass} passed`);
  for (const f of fails) console.error("  - " + f);
  process.exit(1);
}
console.log(`✓ shift fit: ${pass} checks passed`);
