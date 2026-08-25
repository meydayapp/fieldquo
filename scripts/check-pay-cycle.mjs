// scripts/check-pay-cycle.mjs
//
// Executes the pay-cycle engine against a fixed "today". No database, no clock.
//
//   node --import ./scripts/alias-loader.mjs scripts/check-pay-cycle.mjs
//
// The two properties worth guarding, because getting either wrong is money:
//
//   1. Periods contain WHOLE WEEKS. buildPayRun computes overtime against a
//      weekly threshold; a period that splits somebody's week computes their
//      overtime twice, on two partial weeks, and understates it both times.
//   2. Moving the PAYDAY does not move the PERIOD. A company switching from
//      Thursday to Friday is changing how long the office has to approve hours,
//      not which days belong to which cheque — and if the periods shifted, one
//      day of everyone's work would fall through the gap.
import assert from "node:assert/strict";
import {
  DEFAULT_PAY_CYCLE,
  PAY_FREQUENCIES,
  payPeriodFor,
  currentPayPeriod,
  payDateFor,
  reviewDays,
  resolvePayCycle,
  periodProgress,
  describePayCycle,
  isoDay,
  utcDate,
} from "@/lib/payroll/payCycle";

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

const TODAY = "2026-08-25"; // a Tuesday
const DAY_MS = 86400000;
const span = (p) => Math.round((p.end - p.start) / DAY_MS) + 1;

check("the default is a fortnight of whole weeks ending Sunday", () => {
  const p = payPeriodFor(TODAY, null);
  assert.equal(span(p), 14);
  assert.equal(p.end.getUTCDay(), 0, "ends Sunday");
  assert.equal(p.start.getUTCDay(), 1, "starts Monday");
  assert.equal(isoDay(p.payDate), "2026-09-03");
  assert.equal(p.payDate.getUTCDay(), 4, "paid Thursday");
});

check("every week-aligned frequency contains whole weeks", () => {
  for (const [key, meta] of Object.entries(PAY_FREQUENCIES)) {
    if (!meta.alignsToWeeks) continue;
    const p = payPeriodFor(TODAY, { frequency: key });
    assert.equal(span(p) % 7, 0, `${key} spans ${span(p)} days`);
    assert.equal(span(p), meta.weeks * 7, key);
  }
});

check("moving the payday does NOT move the period", () => {
  const base = payPeriodFor(TODAY, null);
  for (const payDayOfWeek of [0, 1, 2, 3, 4, 5, 6]) {
    const p = payPeriodFor(TODAY, { payDayOfWeek });
    assert.equal(isoDay(p.start), isoDay(base.start), `payday ${payDayOfWeek}`);
    assert.equal(isoDay(p.end), isoDay(base.end), `payday ${payDayOfWeek}`);
    // ...and the payday always lands after the period closes, never on it.
    assert.ok(p.payDate > p.end, `payday ${payDayOfWeek} is not after the end`);
    assert.equal(p.payDate.getUTCDay(), payDayOfWeek);
  }
});

check("the review gap is what the payday choice actually changes", () => {
  assert.equal(reviewDays(null), 4); // Sunday close → Thursday pay
  assert.equal(reviewDays({ payDayOfWeek: 5 }), 5);
  assert.equal(reviewDays({ payDayOfWeek: 3 }), 3);
  assert.equal(reviewDays({ payDayOfWeek: 1 }), 1);
  // Paying on the day the period closes would mean approving hours nobody
  // could have reviewed, so it becomes a full week rather than zero.
  assert.equal(reviewDays({ payDayOfWeek: 0 }), 7);
  assert.equal(isoDay(payDateFor("2026-08-30", { payDayOfWeek: 0 })), "2026-09-06");
});

check("periods tile with no gap and no overlap", () => {
  let p = payPeriodFor("2026-01-15", null);
  for (let i = 0; i < 30; i++) {
    const next = payPeriodFor(new Date(p.end.getTime() + DAY_MS), null);
    assert.equal(
      next.start.getTime(),
      p.end.getTime() + DAY_MS,
      `gap after ${isoDay(p.end)}`,
    );
    p = next;
  }
});

check("every day of a period resolves to that same period", () => {
  const p = payPeriodFor(TODAY, null);
  for (let d = new Date(p.start); d <= p.end; d = new Date(d.getTime() + DAY_MS)) {
    const got = payPeriodFor(d, null);
    assert.equal(isoDay(got.start), isoDay(p.start), isoDay(d));
    assert.equal(isoDay(got.end), isoDay(p.end), isoDay(d));
  }
});

check("dates before the anchor still land in a real period", () => {
  // A company back-dating a run is a normal Tuesday, and the modulo that
  // computes "how many periods since the anchor" is the classic place a
  // negative number produces a period that does not contain its own date.
  for (const day of ["2020-03-01", "2025-12-31", "2026-01-03", "2026-01-04"]) {
    const p = payPeriodFor(day, null);
    const on = utcDate(day);
    assert.ok(on >= p.start && on <= p.end, `${day} outside ${isoDay(p.start)}–${isoDay(p.end)}`);
    assert.equal(span(p), 14, day);
  }
});

check("the current period is open and the previous one has closed", () => {
  const { current, previous } = currentPayPeriod(null, TODAY);
  const now = utcDate(TODAY);
  assert.ok(now >= current.start && now <= current.end);
  assert.ok(previous.end < current.start);
  assert.equal(
    previous.end.getTime() + DAY_MS,
    current.start.getTime(),
    "they must be adjacent",
  );
});

check("semi-monthly and monthly are calendar periods, and say so", () => {
  const semi = payPeriodFor("2026-08-25", { frequency: "semimonthly" });
  assert.equal(isoDay(semi.start), "2026-08-16");
  assert.equal(isoDay(semi.end), "2026-08-31");
  assert.equal(semi.alignsToWeeks, false);
  const firstHalf = payPeriodFor("2026-08-15", { frequency: "semimonthly" });
  assert.equal(isoDay(firstHalf.start), "2026-08-01");
  assert.equal(isoDay(firstHalf.end), "2026-08-15");
  const month = payPeriodFor("2026-02-10", { frequency: "monthly" });
  assert.equal(isoDay(month.end), "2026-02-28", "leap-year-adjacent February");
  assert.equal(isoDay(payPeriodFor("2028-02-10", { frequency: "monthly" }).end), "2028-02-29");
});

check("a stored cycle survives hostile input", () => {
  for (const bad of [
    null,
    undefined,
    42,
    "biweekly",
    [],
    { frequency: "__proto__" },
    { frequency: "fortnightly" },
    { payDayOfWeek: 9 },
    { payDayOfWeek: -1 },
    { payDayOfWeek: "Thursday" },
    { periodEndDayOfWeek: NaN },
    { anchorDate: "not-a-date" },
    { anchorDate: 1e308 },
  ]) {
    const c = resolvePayCycle(bad);
    assert.ok(PAY_FREQUENCIES[c.frequency], JSON.stringify(bad));
    assert.ok(c.payDayOfWeek >= 0 && c.payDayOfWeek <= 6, JSON.stringify(bad));
    assert.ok(utcDate(c.anchorDate), JSON.stringify(bad));
    const p = payPeriodFor(TODAY, bad);
    assert.ok(p && p.start <= p.end, JSON.stringify(bad));
    assert.ok(p.payDate > p.end, JSON.stringify(bad));
  }
});

check("a bad date is null, not today", () => {
  // Falling back to `new Date()` would make this file impure and would quietly
  // pay somebody for the wrong fortnight.
  for (const bad of [null, undefined, "", "nope", {}, NaN, [], 42]) {
    assert.equal(payPeriodFor(bad, null), null, JSON.stringify(bad));
    assert.equal(currentPayPeriod(null, bad), null, JSON.stringify(bad));
  }
});

check("progress is clamped, so a mid-period cadence change cannot exceed 1", () => {
  const p = payPeriodFor(TODAY, null);
  assert.equal(periodProgress(p, isoDay(p.start)), 1 / 14);
  assert.equal(periodProgress(p, isoDay(p.end)), 1);
  assert.equal(periodProgress(p, "2030-01-01"), 1);
  assert.equal(periodProgress(p, "2000-01-01"), 0);
  assert.equal(periodProgress(null, TODAY), 0);
});

check("the sentence a settings screen prints is true", () => {
  const s = describePayCycle(null);
  assert.match(s, /Every 2 weeks/);
  assert.match(s, /closes Sunday/);
  assert.match(s, /Thursday/);
  assert.match(s, /4 days to approve/);
  assert.match(describePayCycle({ payDayOfWeek: 1 }), /1 day to approve/);
  assert.match(describePayCycle({ frequency: "monthly" }), /Once a month/);
});

check("the default is the one the schema comment promises", () => {
  assert.equal(DEFAULT_PAY_CYCLE.frequency, "biweekly");
  assert.equal(DEFAULT_PAY_CYCLE.periodEndDayOfWeek, 0);
  assert.equal(DEFAULT_PAY_CYCLE.payDayOfWeek, 4);
  assert.equal(utcDate(DEFAULT_PAY_CYCLE.anchorDate).getUTCDay(), 0, "anchor is a Sunday");
});

if (fails.length) {
  console.error(`✗ ${fails.length} failed, ${pass} passed`);
  for (const f of fails) console.error("  - " + f);
  process.exit(1);
}
console.log(`✓ pay cycle: ${pass} checks passed`);
