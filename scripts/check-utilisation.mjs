// scripts/check-utilisation.mjs
//
// The hours you paid for that never reached a job.
//
// ══ What this is guarding ══════════════════════════════════════════════════
//
// A contractor who guarantees somebody 37.5 hours and gets 28 hours of job time
// has paid for 9.5 hours of nothing in particular. Those hours behave exactly
// like overhead, and nothing in the product could see them: TimeEntry knew the
// hours that reached a job and no worker row carried a guaranteed week to
// compare them against.
//
// Every assertion here is EXECUTED against the real functions. The absence
// rules are the ones that matter most — this figure sits next to money, and a
// null that renders as a zero is how "we don't know" becomes "there is none".
import { labourUtilisation, weeksBetween } from "@/lib/costing/utilisation";
import { validateWorkProfile, WORK_TYPES } from "@/lib/team/workProfile";
import { actualJobCost } from "@/lib/costing/actualJobCost";

let fail = 0;
const ok = (c, m, d) => {
  console.log((c ? "  ok   " : "  FAIL ") + m + (c || d === undefined ? "" : `  — got ${JSON.stringify(d)}`));
  if (!c) fail++;
};
const section = (t) => console.log(`\n${t}\n`);

const field = (over = {}) => ({
  id: "w1", name: "Marc", workType: "field",
  scheduledHoursPerWeek: 37.5, hourlyRate: 30, ...over,
});

section("1. The owner's case: 37.5 guaranteed, 28 on jobs");

{
  const r = labourUtilisation({ workers: [field()], jobHoursById: { w1: 28 }, weeks: 1 });
  const row = r.rows[0];
  ok(row.scheduledHours === 37.5, "the guaranteed week is the yardstick", row.scheduledHours);
  ok(row.jobHours === 28, "against the hours that actually reached a job", row.jobHours);
  ok(row.unabsorbedHours === 9.5, "the gap is 9.5 hours", row.unabsorbedHours);
  ok(row.unabsorbedCost === 285, "which is $285 at $30/hr", row.unabsorbedCost);
  ok(r.unabsorbedCost === 285, "and it totals", r.unabsorbedCost);
}

section("2. Absence is absence, never zero");

{
  // No guaranteed week: this person is paid for what they log. There is no gap
  // to report, and reporting one of zero would say something untrue about an
  // arrangement that simply has no gap.
  const r = labourUtilisation({
    workers: [field({ scheduledHoursPerWeek: null })],
    jobHoursById: { w1: 31 }, weeks: 1,
  });
  ok(r.rows[0].scheduledHours === null, "no guaranteed week → no yardstick", r.rows[0].scheduledHours);
  ok(r.rows[0].unabsorbedHours === null, "…and no gap, rather than a gap of zero", r.rows[0].unabsorbedHours);
  ok(r.rows[0].missing === "schedule", "…and the screen is told which of the two it is", r.rows[0].missing);
  ok(r.unabsorbedCost === null, "a total nothing could be costed for is null, not 0", r.unabsorbedCost);
  ok(r.noScheduleWorkers === 1, "…and the person is counted", r.noScheduleWorkers);
}
{
  // Hours known, money not. The same rule actualJobCost applies to an unrated
  // worker: hours are counted, cost is withheld, and the shortfall is declared.
  const r = labourUtilisation({
    workers: [field({ hourlyRate: null })],
    jobHoursById: { w1: 20 }, weeks: 1,
  });
  ok(r.rows[0].unabsorbedHours === 17.5, "an unrated worker's HOURS are still known", r.rows[0].unabsorbedHours);
  ok(r.rows[0].unabsorbedCost === null, "…but their cost is withheld, never counted as free", r.rows[0].unabsorbedCost);
  ok(r.unratedWorkers === 1 && r.incomplete === true, "…and the total says it is short", r.unratedWorkers);
}
{
  ok(
    labourUtilisation({ workers: [field({ hourlyRate: 0 })], jobHoursById: { w1: 20 }, weeks: 1 })
      .rows[0].unabsorbedCost === 0,
    "a rate of genuinely zero is a number and costs zero — distinct from having no rate",
  );
}

section("3. Overtime is not negative idle time");

{
  const r = labourUtilisation({ workers: [field()], jobHoursById: { w1: 45 }, weeks: 1 });
  ok(r.rows[0].unabsorbedHours === 0, "somebody who worked over is not un-absorbed", r.rows[0].unabsorbedHours);
  ok(r.rows[0].overHours === 7.5, "…they are over, and that is a different number", r.rows[0].overHours);
  ok(r.rows[0].unabsorbedCost === 0, "…and no negative money is invented", r.rows[0].unabsorbedCost);
}

section("4. Office time is overhead in full, so it is not in this table");

{
  const r = labourUtilisation({
    workers: [field(), { id: "w2", name: "Ann", workType: "office", scheduledHoursPerWeek: 37.5, hourlyRate: 28 }],
    jobHoursById: { w1: 37.5 }, weeks: 1,
  });
  ok(r.rows.length === 1, "the office worker is excluded outright", r.rows.map((x) => x.workerId));
  ok(
    !r.rows.some((x) => x.workerId === "w2"),
    "…because a bookkeeper showing a 100% gap reads as a problem rather than as how they are employed",
  );
}

section("5. Periods");

{
  ok(weeksBetween(new Date("2026-08-01"), new Date("2026-08-08")) === 1, "seven days is one week");
  ok(Math.round(weeksBetween(new Date("2026-08-01"), new Date("2026-08-31")) * 100) / 100 === 4.29, "thirty days is 4.29");
  ok(weeksBetween(new Date("2026-08-08"), new Date("2026-08-01")) === 0, "a backwards period is zero, not negative");
  ok(weeksBetween("nonsense", new Date()) === 0, "and unparseable input is zero rather than NaN");
  const r = labourUtilisation({ workers: [field()], jobHoursById: { w1: 100 }, weeks: 4 });
  ok(r.rows[0].scheduledHours === 150, "the week scales to the period", r.rows[0].scheduledHours);
  ok(r.rows[0].unabsorbedHours === 50, "…and so does the gap", r.rows[0].unabsorbedHours);
}

section("6. Hostile and empty input");

{
  ok(labourUtilisation().rows.length === 0, "no arguments at all does not throw");
  ok(labourUtilisation({ workers: null, jobHoursById: null }).unabsorbedCost === null, "nulls give an honest null");
  ok(labourUtilisation({ workers: [null, {}, field()] }).rows.length === 1, "junk rows are skipped, real ones survive");
  const r = labourUtilisation({ workers: [field()], jobHoursById: { w1: "abc" }, weeks: 1 });
  ok(r.rows[0].jobHours === 0, "unparseable hours read as none logged", r.rows[0].jobHours);
}

section("7. The work profile: two questions, and null is an answer");

{
  ok(JSON.stringify(WORK_TYPES) === JSON.stringify(["field", "office"]), "two stored values");
  ok(validateWorkProfile({}).workType === "field", "absent means field — every existing row was created to do jobs");
  ok(
    validateWorkProfile({}).scheduledHoursPerWeek === null,
    "…and no guaranteed week is invented. A defaulted 40 would invent unabsorbed labour for somebody who has none",
  );
  ok(validateWorkProfile({ workType: "office" }).ok === true, "office is accepted");
  ok(validateWorkProfile({ workType: "technician" }).ok === false, "and a third kind is refused rather than coerced");
  ok(validateWorkProfile({ scheduledHoursPerWeek: "37.5" }).scheduledHoursPerWeek === 37.5, "a string week is read");
  ok(validateWorkProfile({ scheduledHoursPerWeek: "" }).scheduledHoursPerWeek === null, "an empty box clears it");
  ok(validateWorkProfile({ scheduledHoursPerWeek: 0 }).ok === false, "zero hours a week is refused — that is not a guarantee");
  ok(validateWorkProfile({ scheduledHoursPerWeek: 200 }).ok === false, "and a week longer than a week is a typo");
  ok(validateWorkProfile({ scheduledHoursPerWeek: "abc" }).ok === false, "junk is refused, never silently dropped");
}

section("8. Overhead reaches an actual job cost");

{
  const e = [{ category: "materials", amount: 500 }];
  const t = [{ hours: 10, status: "approved", workerId: "w1", worker: { hourlyRate: 30 } }];

  const bare = actualJobCost(e, t);
  ok(bare.total === 800, "without overhead the total is unchanged — existing callers are untouched", bare.total);
  ok(bare.overhead === null, "…and it reports having none", bare.overhead);

  const withOh = actualJobCost(e, t, { overheadPerJob: 220, overheadBasis: "per_job" });
  ok(withOh.total === 1020, "a job carries its share of the fixed costs", withOh.total);
  ok(
    withOh.overhead?.amount === 220 && withOh.overhead?.basis === "per_job",
    "…reported on its own line, because a margin that dropped must be explainable",
    withOh.overhead,
  );

  // The whole reason this argument exists: the quote's estimate has always
  // included overhead, so an actual that excluded it made every variance read
  // as under budget.
  ok(
    actualJobCost(e, t, { overheadPerJob: null }).total === 800,
    "an unknown overhead is absent, not zero",
  );
  ok(
    actualJobCost(e, t, { overheadPerJob: "nonsense" }).overhead === null,
    "and junk does not become a cost",
  );
  // The assertion above passes even if the TOTAL is computed from the raw
  // argument — which is how `Number("nonsense")` becomes NaN and a job's cost
  // renders as "NaN" on the panel. The line and the total are checked
  // separately because they can disagree.
  ok(
    actualJobCost(e, t, { overheadPerJob: "nonsense" }).total === 800,
    "…and junk never reaches the total either — NaN renders as a number and is not one",
    actualJobCost(e, t, { overheadPerJob: "nonsense" }).total,
  );
  ok(
    actualJobCost(e, t, { overheadPerJob: 0 }).overhead?.amount === 0,
    "a genuine zero is a stated zero — different from not knowing",
  );
}

console.log(`\n${fail === 0 ? "ALL PASS" : fail + " FAILED"}`);
process.exit(fail ? 1 : 0);
