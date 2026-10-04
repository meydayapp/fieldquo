// scripts/check-leave-hour-accrual.mjs
//
// Leave EARNED from hours worked, executed — not read.
//
// The owner (2026-10-03): "we should be calculating the time earned for
// vacation and sick leave as that is based on time worked.. and an ability to
// register already worked hours since January 1". The arithmetic lives in
// lib/leave/hourAccrual.js; this runs it against the inputs that go wrong:
//
//   zero hours, negative hours, absurd hours, NaN and Infinity
//   a mid-year start (hours entered for days before they were hired)
//   a yearly cap reached
//   a rate changed in July (March's hours keep March's rate)
//   a personal rate from an anniversary, then back to the company rate
//   an opening balance and FieldQuo entries covering the same days
//   an unpaid drive (hours 0 on the entry) that was still worked
//   a policy with no day length (no invented 8)
//
// and then checks the wiring: every new column is written AND read, the
// presets cite a source, and nothing writes the opening hours into a time
// entry or a pay run.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-leave-hour-accrual.mjs

import { readFileSync } from "node:fs";
import {
  ACCRUAL_PRESETS,
  accrueFromHours,
  buildRateAt,
  cleanRateHistory,
  hoursToDays,
  nextRateHistory,
  normaliseCap,
  normaliseHoursPerDay,
  normaliseRate,
  openingTakenFor,
  presetStillMatches,
  ratePercent,
  utcDayMs,
  validateOpening,
  validateOverride,
  workedHoursOfEntry,
} from "@/lib/leave/hourAccrual";
import { accrueForPolicy, remainingBalance, canTakeLeave } from "@/lib/leave/accrual";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) => {
  if (cond) pass += 1;
  else fails.push(`${label}${detail === undefined ? "" : ` — got ${JSON.stringify(detail)}`}`);
};
const eq = (label, got, want) => ok(label, Object.is(got, want) || JSON.stringify(got) === JSON.stringify(want), got);

const Y = 2026;
const at = (iso) => new Date(`${iso}T15:00:00Z`);
const policy = (he, per, extra = {}) => ({ accrualHoursEarned: he, accrualPerHoursWorked: per, ...extra });
const run = (o) => accrueFromHours({ year: Y, hoursPerDay: 8, ...o });

// ── 1. Rates refuse rather than repair ──────────────────────────────────────
ok("rate 4 per 100 accepted", normaliseRate(4, 100).rate?.hoursEarned === 4);
ok("rate strings accepted", normaliseRate("1", "30").rate?.perHoursWorked === 30);
for (const [he, per, why] of [
  [0, 100, "zero earned"],
  [4, 0, "per zero (divide by zero)"],
  [-4, 100, "negative earned"],
  [4, -100, "negative per"],
  [100, 4, "more than an hour per hour (typo shape)"],
  ["abc", 30, "not a number"],
  [1, Infinity, "Infinity"],
  [1, 20000, "per beyond any year"],
  ["", "", "blank"],
  [null, undefined, "absent"],
]) {
  ok(`rate refused: ${why}`, normaliseRate(he, per).rate === null && Boolean(normaliseRate(he, per).error));
}
eq("percent of 4/100", ratePercent({ hoursEarned: 4, perHoursWorked: 100 }), 4);
eq("percent of 1/30", ratePercent({ hoursEarned: 1, perHoursWorked: 30 }), 3.33);
ok("cap blank = no cap", normaliseCap("").cap === null && !normaliseCap("").error);
ok("cap 0 refused (0 would mean nothing is ever earned)", Boolean(normaliseCap(0).error));
ok("cap negative refused", Boolean(normaliseCap(-5).error));
ok("cap beyond a year refused", Boolean(normaliseCap(9000).error));
ok("day length required", Boolean(normaliseHoursPerDay("").error) && Boolean(normaliseHoursPerDay(null).error));
ok("day length 25 refused", Boolean(normaliseHoursPerDay(25).error));
ok("day length 0 refused", Boolean(normaliseHoursPerDay(0).error));
eq("day length 7.5", normaliseHoursPerDay("7.5").hoursPerDay, 7.5);

// ── 2. Zero, negative, absurd hours ─────────────────────────────────────────
{
  const rateAt = buildRateAt({ policy: policy(1, 30) });
  const none = run({ entries: [], rateAt });
  eq("no hours → 0 h", none.accruedHours, 0);
  eq("no hours → 0 days", none.accruedDays, 0);
  const junk = run({
    rateAt,
    entries: [
      { at: at("2026-03-02"), hours: -8 },
      { at: at("2026-03-03"), hours: NaN },
      { at: at("2026-03-04"), hours: Infinity },
      { at: at("2026-03-05"), hours: "eight" },
      { at: "not a date", hours: 8 },
      { at: at("2025-12-31"), hours: 8 }, // last year
      { at: at("2027-01-01"), hours: 8 }, // next year
      { at: at("2026-03-06"), hours: 30 },
    ],
  });
  eq("garbage entries ignored; only the 30 h counts", junk.accruedHours, 1);
  eq("garbage never NaN", Number.isFinite(junk.accruedDays), true);
  // 30 one-hour entries at 1/30 must make exactly 1, not 0.9999999.
  const thirty = run({ rateAt, entries: Array.from({ length: 30 }, (_, i) => ({ at: at(`2026-04-${String((i % 28) + 1).padStart(2, "0")}`), hours: 1 })) });
  eq("30 × 1 h at 1/30 = exactly 1 h", thirty.accruedHours, 1);
  // A full-time year at 4% ≈ two weeks.
  const fullYear = run({ rateAt: buildRateAt({ policy: policy(4, 100) }), entries: [{ at: at("2026-06-01"), hours: 2080 }] });
  eq("2,080 h at 4% = 83.2 h", fullYear.accruedHours, 83.2);
  eq("83.2 h at 8 h/day = 10.4 days (two weeks)", fullYear.accruedDays, 10.4);
}

// ── 3. No day length → no invented 8 ────────────────────────────────────────
{
  const r = accrueFromHours({ year: Y, hoursPerDay: null, rateAt: buildRateAt({ policy: policy(1, 30) }), entries: [{ at: at("2026-02-02"), hours: 60 }] });
  eq("hours still earned without a day length", r.accruedHours, 2);
  eq("days unknown → null, not 2 ÷ 8", r.accruedDays, null);
  eq("basis says no day length", r.basis.hoursPerDay, null);
  eq("hoursToDays(16, 0) null", hoursToDays(16, 0), null);
  eq("hoursToDays(16, 10) = 1.6", hoursToDays(16, 10), 1.6);
}

// ── 4. Cap reached ──────────────────────────────────────────────────────────
{
  const rateAt = buildRateAt({ policy: policy(1, 30) });
  const r = run({ rateAt, capHours: 48, entries: [{ at: at("2026-05-01"), hours: 2000 }] });
  eq("2,000 h at 1/30 capped at 48", r.accruedHours, 48);
  eq("capped flag", r.basis.capped, true);
  eq("uncapped figure kept for the explanation", r.basis.uncappedHours, 66.67);
  const under = run({ rateAt, capHours: 48, entries: [{ at: at("2026-05-01"), hours: 300 }] });
  eq("under the cap is not capped", under.accruedHours, 10);
  eq("not capped flag", under.basis.capped, false);
  const exactly = run({ rateAt, capHours: 10, entries: [{ at: at("2026-05-01"), hours: 300 }] });
  eq("exactly at the cap is not 'capped'", exactly.basis.capped, false);
}

// ── 5. A rate changed mid-year keeps earlier hours at the earlier rate ─────
{
  const p = policy(6, 100, {
    accrualRateHistory: [
      { from: "2026-02-10", hoursEarned: 4, perHoursWorked: 100 },
      { from: "2026-07-01", hoursEarned: 6, perHoursWorked: 100 },
    ],
  });
  const rateAt = buildRateAt({ policy: p });
  const r = run({
    rateAt,
    entries: [
      { at: at("2026-01-15"), hours: 100 }, // before the first entry's date — first rate reaches back to 1 Jan
      { at: at("2026-03-15"), hours: 100 },
      { at: at("2026-06-30"), hours: 100 },
      { at: at("2026-07-01"), hours: 100 },
      { at: at("2026-09-01"), hours: 100 },
    ],
  });
  eq("300 h at 4% + 200 h at 6% = 24 h", r.accruedHours, 24);
  eq("two rate groups in the explanation", r.basis.parts.length, 2);
  const lowered = buildRateAt({
    policy: policy(2, 100, {
      accrualRateHistory: [
        { from: "2026-01-05", hoursEarned: 6, perHoursWorked: 100 },
        { from: "2026-08-01", hoursEarned: 2, perHoursWorked: 100 },
      ],
    }),
  });
  const lr = run({ rateAt: lowered, entries: [{ at: at("2026-03-01"), hours: 1000 }] });
  eq("a LOWERED rate does not take back March's leave", lr.accruedHours, 60);
  // The history helper
  const h1 = nextRateHistory([], { hoursEarned: 4, perHoursWorked: 100 }, "2026-03-01");
  eq("first save starts the history", h1.length, 1);
  eq("same rate saved again adds nothing", nextRateHistory(h1, { hoursEarned: "4", perHoursWorked: "100" }, "2026-04-01").length, 1);
  const h2 = nextRateHistory(h1, { hoursEarned: 6, perHoursWorked: 100 }, "2026-07-01");
  eq("a change appends", h2.length, 2);
  const h3 = nextRateHistory(h2, { hoursEarned: 5, perHoursWorked: 100 }, "2026-07-01");
  eq("a second change the same day replaces that day", [h3.length, h3[1].hoursEarned], [2, 5]);
  eq("an invalid rate never enters the history", nextRateHistory(h3, { hoursEarned: 0, perHoursWorked: 100 }, "2026-08-01").length, 2);
  eq("junk history rows dropped", cleanRateHistory([{ from: "nope", hoursEarned: 1, perHoursWorked: 30 }, { from: "2026-01-01", hoursEarned: -1, perHoursWorked: 30 }, null]).length, 0);
  eq("no history falls back to the columns", buildRateAt({ policy: policy(1, 40) })(Date.UTC(2026, 5, 1))?.perHoursWorked, 40);
  eq("no rate at all → null (counted as unrated, never as earned)", buildRateAt({ policy: {} })(Date.UTC(2026, 5, 1)), null);
  const unrated = run({ rateAt: buildRateAt({ policy: {} }), entries: [{ at: at("2026-06-01"), hours: 40 }] });
  eq("unrated hours earn nothing and are reported", [unrated.accruedHours, unrated.basis.unratedHours], [0, 40]);
}

// ── 6. A personal rate from an anniversary, then back to the company rate ──
{
  const rateAt = buildRateAt({
    policy: policy(4, 100),
    overrides: [
      { effectiveFrom: new Date("2026-05-01T00:00:00Z"), hoursEarned: 6, perHoursWorked: 100, createdAt: "2026-04-20" },
      { effectiveFrom: new Date("2026-09-01T00:00:00Z"), hoursEarned: null, perHoursWorked: null, createdAt: "2026-08-20" },
      // Half a rate is ignored, never read as "back to policy" or as a rate.
      { effectiveFrom: new Date("2026-06-01T00:00:00Z"), hoursEarned: 9, perHoursWorked: null, createdAt: "2026-05-20" },
    ],
  });
  eq("before the override: company rate", rateAt(Date.UTC(2026, 3, 30))?.hoursEarned, 4);
  eq("from the override day: personal rate", rateAt(Date.UTC(2026, 4, 1))?.source, "override");
  eq("malformed row ignored", rateAt(Date.UTC(2026, 6, 1))?.hoursEarned, 6);
  eq("back to company rate", [rateAt(Date.UTC(2026, 8, 2))?.hoursEarned, rateAt(Date.UTC(2026, 8, 2))?.source], [4, "policy"]);
  const r = run({
    rateAt,
    entries: [
      { at: at("2026-03-01"), hours: 100 },
      { at: at("2026-06-01"), hours: 100 },
      { at: at("2026-10-01"), hours: 100 },
    ],
  });
  eq("4 + 6 + 4 = 14 h", r.accruedHours, 14);
  // Two overrides on the same day: the newer one wins.
  const tie = buildRateAt({
    policy: policy(4, 100),
    overrides: [
      { effectiveFrom: "2026-05-01", hoursEarned: 8, perHoursWorked: 100, createdAt: "2026-05-01T10:00:00Z" },
      { effectiveFrom: "2026-05-01", hoursEarned: 6, perHoursWorked: 100, createdAt: "2026-05-01T11:00:00Z" },
    ],
  });
  eq("same-day overrides: newest wins", tie(Date.UTC(2026, 4, 2))?.hoursEarned, 6);
}

// ── 7. Opening balance + FieldQuo entries over the same days ───────────────
{
  const rateAt = buildRateAt({ policy: policy(1, 30) });
  const r = run({
    rateAt,
    opening: { hoursWorked: 600, throughDate: new Date("2026-03-31T00:00:00Z") },
    entries: [
      { at: at("2026-03-31"), hours: 8 }, // covered by the opening — left out
      { at: at("2026-04-01"), hours: 30 },
    ],
  });
  eq("600 h opening + 30 h after = 21 h", r.accruedHours, 21);
  eq("the overlapping 8 h is reported as excluded", r.basis.excludedHours, 8);
  eq("opening earned 20", r.basis.opening.earned, 20);
  // An opening outside the year is not used for this year.
  const other = run({ rateAt, opening: { hoursWorked: 600, throughDate: "2025-12-31" }, entries: [] });
  eq("last year's opening is not this year's", [other.accruedHours, other.basis.opening], [0, null]);
  // Opening valued at the rate on its last day — an override in force then wins.
  const ov = buildRateAt({ policy: policy(4, 100), overrides: [{ effectiveFrom: "2026-03-01", hoursEarned: 6, perHoursWorked: 100 }] });
  const r2 = run({ rateAt: ov, opening: { hoursWorked: 1000, throughDate: "2026-03-31" }, entries: [] });
  eq("opening valued at the rate in force on its last day", r2.accruedHours, 60);
  // Opening counts toward the cap.
  const capped = run({ rateAt, capHours: 40, opening: { hoursWorked: 1500, throughDate: "2026-06-30" }, entries: [{ at: at("2026-07-02"), hours: 300 }] });
  eq("opening + FieldQuo capped together", capped.accruedHours, 40);
}

// ── 8. Which hours were WORKED ──────────────────────────────────────────────
{
  eq("paid entry: its hours", workedHoursOfEntry({ hours: "7.25", paid: true }), 7.25);
  eq("entry before the paid column: its hours", workedHoursOfEntry({ hours: 6 }), 6);
  // An unpaid drive closes at hours 0 — it was still worked.
  const drive = {
    paid: false,
    hours: 0,
    clockIn: "2026-05-04T08:00:00Z",
    clockOut: "2026-05-04T16:00:00Z",
    breaks: [{ start: "2026-05-04T12:00:00Z", end: "2026-05-04T12:30:00Z", paid: false }],
  };
  eq("unpaid stretch counts as worked, less the unpaid lunch", workedHoursOfEntry(drive), 7.5);
  eq("a paid break does not come off", workedHoursOfEntry({ ...drive, breaks: [{ ...drive.breaks[0], paid: true }] }), 8);
  eq("unpaid stretch still open → 0", workedHoursOfEntry({ paid: false, hours: 0, clockIn: drive.clockIn, clockOut: null }), 0);
  eq("negative hours → 0", workedHoursOfEntry({ hours: -3 }), 0);
  eq("garbage → 0", workedHoursOfEntry({ hours: "lots" }), 0);
  eq("clock-out before clock-in → 0", workedHoursOfEntry({ paid: false, clockIn: drive.clockOut, clockOut: drive.clockIn }), 0);
}

// ── 9. The opening-balance form, refused rather than repaired ──────────────
{
  const base = { year: 2026, hoursWorked: 600, throughDate: "2026-03-31", policyIds: ["vac", "sick", "unpaid"], todayIso: "2026-10-03" };
  const good = validateOpening({ ...base, taken: [{ policyId: "vac", days: 3 }, { policyId: "unpaid", days: "1.5" }, { policyId: "sick", days: "" }], note: "From the old spreadsheet\u0000" });
  ok("a sensible opening balance is accepted", good.errors.length === 0, good.errors);
  eq("blank taken rows dropped, decimals kept", good.value?.taken, [{ policyId: "vac", days: 3 }, { policyId: "unpaid", days: 1.5 }]);
  ok("control characters stripped from the note", good.value && !good.value.note.includes("\u0000"));
  const bad = (label, extra) => {
    const r = validateOpening({ ...base, ...extra });
    ok(`refused: ${label}`, r.errors.length > 0 && r.value === null, r.errors);
  };
  bad("negative hours", { hoursWorked: -1 });
  bad("hours blank", { hoursWorked: "" });
  bad("hours NaN", { hoursWorked: "lots" });
  bad("more hours than the days hold (90 days × 24 = 2,160)", { hoursWorked: 2161 });
  bad("Infinity hours", { hoursWorked: Infinity });
  bad("through date in another year", { throughDate: "2025-12-31" });
  bad("through date in the future", { throughDate: "2026-10-04" });
  bad("through date not a date", { throughDate: "31/03/2026" });
  bad("31 February", { throughDate: "2026-02-31" });
  bad("a future year", { year: 2027, throughDate: "2027-01-05" });
  bad("year 1970", { year: 1970, throughDate: "1970-03-01" });
  bad("someone else's policy", { taken: [{ policyId: "other-tenant", days: 2 }] });
  bad("the same policy twice", { taken: [{ policyId: "vac", days: 1 }, { policyId: "vac", days: 2 }] });
  bad("negative days taken", { taken: [{ policyId: "vac", days: -2 }] });
  bad("more days taken than the span", { taken: [{ policyId: "vac", days: 91 }] });
  ok("zero hours is a real answer, not a refusal", validateOpening({ ...base, hoursWorked: 0 }).errors.length === 0);
  // Mid-year start: hired 1 March, through 31 March = 31 days = 744 h max.
  const hired = new Date("2026-03-01T00:00:00Z");
  ok("mid-year start: 744 h in 31 days accepted", validateOpening({ ...base, hiredOn: hired, hoursWorked: 744 }).errors.length === 0);
  bad("mid-year start: 745 h in 31 days", { hiredOn: hired, hoursWorked: 745 });
  bad("hired after the last day covered", { hiredOn: new Date("2026-04-15T00:00:00Z") });
  ok("hired after the last day, 0 hours, leave taken only", validateOpening({ ...base, hiredOn: new Date("2026-04-15T00:00:00Z"), hoursWorked: 0, taken: [] }).errors.length === 0);
  bad("hired next year", { hiredOn: new Date("2027-02-01T00:00:00Z") });
  ok("hired in an earlier year: whole span from 1 Jan", validateOpening({ ...base, hiredOn: new Date("2019-01-01T00:00:00Z"), hoursWorked: 2000 }).errors.length === 0);
  eq("openingTakenFor reads one policy", openingTakenFor({ taken: [{ policyId: "vac", days: 3 }] }, "vac"), 3);
  eq("openingTakenFor absent → 0", openingTakenFor(null, "vac"), 0);
  eq("openingTakenFor junk → 0", openingTakenFor({ taken: [{ policyId: "vac", days: "x" }] }, "vac"), 0);
  eq("utcDayMs refuses 2026-02-29", Number.isNaN(utcDayMs("2026-02-29")), true);
  eq("utcDayMs accepts 2028-02-29", Number.isNaN(utcDayMs("2028-02-29")), false);
}

// ── 10. The personal-rate form ──────────────────────────────────────────────
{
  ok("rate from a date accepted", validateOverride({ effectiveFrom: "2026-05-01", hoursEarned: 6, perHoursWorked: 100, todayIso: "2026-10-03" }).errors.length === 0);
  const back = validateOverride({ effectiveFrom: "2026-09-01", hoursEarned: "", perHoursWorked: "", todayIso: "2026-10-03" });
  ok("both blank = back to the company rate", back.errors.length === 0 && back.value.hoursEarned === null);
  ok("half a rate refused", validateOverride({ effectiveFrom: "2026-09-01", hoursEarned: 6, perHoursWorked: "", todayIso: "2026-10-03" }).errors.length > 0);
  ok("no date refused", validateOverride({ effectiveFrom: "", hoursEarned: 6, perHoursWorked: 100, todayIso: "2026-10-03" }).errors.length > 0);
  ok("two years ahead refused", validateOverride({ effectiveFrom: "2028-10-03", hoursEarned: 6, perHoursWorked: 100, todayIso: "2026-10-03" }).errors.length > 0);
}

// ── 11. Balances: taken before FieldQuo comes off what is left ─────────────
{
  const b = remainingBalance({ accruedDays: 10, usedDays: 2, openingUsedDays: 3, carriedInDays: 1, accruedHours: 80 }, { pendingDays: 1 });
  eq("left = 10 + 1 − 2 − 3 − 1 = 5", b.remainingDays, 5);
  eq("taken total includes before FieldQuo", b.usedDays, 5);
  eq("the two takens stay apart", [b.approvedUsedDays, b.openingUsedDays], [2, 3]);
  eq("hours passed through", b.accruedHours, 80);
  const legacy = remainingBalance({ accruedDays: 10, usedDays: 2 });
  eq("a balance row from before the column reads as before", legacy.remainingDays, 8);
  eq("negative opening never adds entitlement", remainingBalance({ accruedDays: 5, openingUsedDays: -10 }).remainingDays, 5);
  const refused = canTakeLeave({
    policy: { accrualMethod: "per_hours_worked", paid: true },
    balance: { accruedDays: 4, usedDays: 0, openingUsedDays: 3 },
    requestedDays: 2,
  });
  eq("a request is judged against what is left after leave taken before FieldQuo", refused.ok, false);
  const unpaid = canTakeLeave({ policy: { paid: false }, balance: {}, requestedDays: 5 });
  eq("unpaid leave is never limited by a balance", unpaid.ok, true);
  eq("per_hours_worked never falls through to a year's allotment", accrueForPolicy({ policy: { accrualMethod: "per_hours_worked", annualDays: 10 } }), { accruedDays: 0, accruedAmount: 0 });
}

// ── 12. Presets cite a source, and only state what the source states ──────
{
  ok("presets exist", ACCRUAL_PRESETS.length >= 5);
  for (const p of ACCRUAL_PRESETS) {
    ok(`${p.key}: has a source`, typeof p.source === "string" && p.source.length > 5);
    ok(`${p.key}: links the source`, /^https:\/\//.test(p.sourceUrl || ""));
    ok(`${p.key}: a valid rate`, normaliseRate(p.hoursEarned, p.perHoursWorked).rate !== null);
    ok(`${p.key}: cap valid or none`, p.yearlyCapHours === null || normaliseCap(p.yearlyCapHours).cap === p.yearlyCapHours);
    ok(`${p.key}: still matches itself`, presetStillMatches(p.key, p));
  }
  ok("an edited rate no longer claims the preset", !presetStillMatches("ca_sick", { hoursEarned: 1, perHoursWorked: 40, yearlyCapHours: null }));
  ok("an added cap no longer claims the preset", !presetStillMatches("ca_sick", { hoursEarned: 1, perHoursWorked: 30, yearlyCapHours: 24 }));
  ok("unknown preset never matches", !presetStillMatches("made_up", { hoursEarned: 1, perHoursWorked: 30 }));
  const ca = ACCRUAL_PRESETS.find((p) => p.key === "ca_sick");
  eq("California: 1 per 30, no imposed cap", [ca.hoursEarned, ca.perHoursWorked, ca.yearlyCapHours], [1, 30, null]);
  const co = ACCRUAL_PRESETS.find((p) => p.key === "co_sick");
  eq("Colorado: 1 per 30, 48 a year", [co.hoursEarned, co.perHoursWorked, co.yearlyCapHours], [1, 30, 48]);
  const wa = ACCRUAL_PRESETS.find((p) => p.key === "wa_sick");
  eq("Washington: 1 per 40", [wa.hoursEarned, wa.perHoursWorked], [1, 40]);
  const on = ACCRUAL_PRESETS.find((p) => p.key === "on_vacation_4");
  eq("Ontario: 4 per 100", [on.hoursEarned, on.perHoursWorked], [4, 100]);
}

// ── 13. Wiring: written AND read, and never into payroll ───────────────────
{
  const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
  const schema = read("prisma/schema.prisma");
  const balances = read("lib/leave/balances.js");
  const leaveGet = read("app/api/leave/route.js");
  const policiesRoute = read("app/api/settings/leave-policies/route.js");
  const openingRoute = read("app/api/leave/opening/route.js");
  const overrideRoute = read("app/api/leave/accrual-override/route.js");
  const panels = read("app/components/leave/AccrualPanels.js");
  const team = read("app/app/time-off/TeamTimeOff.js");
  const settingsPage = read("app/app/settings/leave/page.js");
  const buildPayRun = read("lib/payroll/buildPayRun.js");

  for (const col of ["accrualHoursEarned", "accrualPerHoursWorked", "accrualYearlyCapHours", "hoursPerDay", "accrualPreset", "accrualRateHistory"]) {
    ok(`LeavePolicy.${col} in the schema`, schema.includes(`  ${col} `));
    ok(`LeavePolicy.${col} written by the policies route`, policiesRoute.includes(col));
  }
  ok("rate + cap + day read by refreshAccruals", /accrualYearlyCapHours/.test(balances) && /policy\.hoursPerDay/.test(balances) && /buildRateAt\(/.test(balances));
  ok("preset label read by the settings card", settingsPage.includes("policy.accrualPreset"));
  for (const col of ["accruedHours", "openingUsedDays", "accrualBasis"]) {
    ok(`LeaveBalance.${col} written by refreshAccruals`, balances.includes(col));
    ok(`LeaveBalance.${col} read by the balance panels`, panels.includes(col));
  }
  ok("LeaveOpeningBalance written by its route", openingRoute.includes("db.leaveOpeningBalance.create"));
  ok("LeaveOpeningBalance read by refreshAccruals", balances.includes("db.leaveOpeningBalance.findMany"));
  ok("LeaveOpeningBalance shown by GET /api/leave", leaveGet.includes("db.leaveOpeningBalance.findMany"));
  ok("LeaveAccrualOverride written by its route", overrideRoute.includes("db.leaveAccrualOverride.create"));
  ok("LeaveAccrualOverride read by refreshAccruals", balances.includes("db.leaveAccrualOverride.findMany"));
  ok("both POST routes have a caller", panels.includes('"/api/leave/opening"') && panels.includes('"/api/leave/accrual-override"'));
  ok("the Team tab renders the balances", team.includes("<TeamBalances"));
  ok("append-only: no update or delete of opening rows", !/leaveOpeningBalance\.(update|delete|upsert)/.test(openingRoute + balances + leaveGet));
  ok("append-only: no update or delete of override rows", !/leaveAccrualOverride\.(update|delete|upsert)/.test(overrideRoute + balances + leaveGet));
  ok("opening hours never become a time entry", !/timeEntry\.(create|update|upsert)/.test(openingRoute));
  ok("payroll never reads opening balances", !/leaveOpeningBalance/.test(buildPayRun));
  ok("both writes are owner/admin and refuse read-only support", openingRoute.includes("leaveAdminRefusal(member)") && overrideRoute.includes("leaveAdminRefusal(member)"));
  ok("the self view is scoped to the person's own worker", /accrualRecords\(\{ companyId: member\.companyId, year, workerId: worker\.id \}\)/.test(leaveGet));
  ok("every policy-day fallback avoids an invented 8 in accrual", !/hoursPerDay\s*\?\?\s*8|hoursPerDay\s*\|\|\s*8/.test(balances));
}

if (fails.length) {
  console.error(`check-leave-hour-accrual: ${fails.length} FAILED, ${pass} passed`);
  for (const f of fails) console.error("  ✗ " + f);
  process.exit(1);
}
console.log(`check-leave-hour-accrual: ${pass} passed`);
