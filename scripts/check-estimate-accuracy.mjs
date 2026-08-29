// scripts/check-estimate-accuracy.mjs
//
//   node --import ./scripts/alias-loader.mjs scripts/check-estimate-accuracy.mjs
//
// A roll-up is a much better liar than a single job.
//
// ══ Why this file exists ═══════════════════════════════════════════════════
//
// app/api/jobs/[id]/costing answers "did THIS job come in over?", and when it
// gets that wrong the contractor is looking at one job they remember. A range
// report is different: nobody remembers the fourteen jobs behind "-8% on
// labour", so nothing on screen contradicts it. Every way this feature can be
// wrong is therefore silent, and three of them are actively flattering:
//
//   * an unrated worker costs nothing, so the jobs they were on look cheap,
//     and one of them on six jobs drags a whole quarter toward "under budget";
//   * a job with no expense rows scores as 100% under on materials if absence
//     is read as zero;
//   * five jobs is enough to produce a confident-looking percentage and not
//     nearly enough to mean anything.
//
// So the assertions below are almost all about REFUSING to report, and the
// arithmetic is EXECUTED rather than read — lib/analytics/estimateAccuracy.js
// is pure, so there is no excuse for reasoning about it, and section 9 runs the
// real route handler against a scripted database because a gate that is written
// down is not a gate that refuses.
//
// ══ What is NOT covered ════════════════════════════════════════════════════
//
// app/app/analytics/estimate-accuracy/page.js is JSX and nothing in the
// alias-loader run can parse it. The parts of it that matter — that a null
// percentage renders as an absence and that the endpoint behind it refuses a
// crew member — are covered by the payload assertions and by section 9
// respectively. The JSX itself is checked as text, positionally, so deleting
// the guard fails.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { register } from "node:module";

import {
  buildEstimateAccuracy,
  MIN_SAMPLE,
  TOLERANCE_PCT,
  MEAN_DISTORTION_PTS,
  EXCLUSION_REASONS,
} from "@/lib/analytics/estimateAccuracy";
import { PERMISSION_PRESETS, PRESET_TO_ROLE } from "@/lib/permissions";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond
    ? (pass++, console.log(`  ok   ${label}`))
    : (fails.push(`${label}${detail !== undefined ? ` — got ${JSON.stringify(detail)}` : ""}`),
      console.log(`  FAIL ${label}${detail !== undefined ? ` — got ${JSON.stringify(detail)}` : ""}`));

// ── Fixture builders ───────────────────────────────────────────────────────
//
// Deliberately close to the shape the route actually hands the builder: Decimal
// columns already Numbered, expenses and time entries as flat arrays. A fixture
// that is tidier than reality proves the builder works on tidy input.

const RANGE = { from: "2026-01-01", to: "2026-06-30", currency: "CAD" };

const est = (o = {}) => ({
  labourHours: 0,
  labourCost: 0,
  materialTotal: 0,
  unpricedMaterials: 0,
  costIncomplete: false,
  totalCost: 0,
  at: new Date("2026-01-05"),
  ...o,
});

/** One time entry. `rate: null` is the unrated worker this file is about. */
const entry = (hours, o = {}) => ({
  hours,
  status: "approved",
  workerId: "w_dani",
  worker: { id: "w_dani", name: "Dani", hourlyRate: 50 },
  ...o,
  ...(o.rate !== undefined
    ? {
        worker: {
          id: o.workerId || "w_dani",
          name: o.name || "Dani",
          hourlyRate: o.rate,
        },
      }
    : {}),
});

let seq = 0;
const job = (o = {}) => {
  seq += 1;
  return {
    id: o.id || `job_${seq}`,
    title: o.title || `Job ${seq}`,
    completedAt: new Date("2026-03-01"),
    clientId: "cl_1",
    clientName: "Ana Ruiz",
    tradeKeys: [{ key: "interior_painting", label: "Interior painting" }],
    estimate: est(),
    expenses: [],
    timeEntries: [],
    ...o,
  };
};

const run = (jobs, extra = {}) =>
  buildEstimateAccuracy({ ...RANGE, jobs, ...extra });

/** Every non-finite number anywhere in a payload, with its path. */
function badNumbers(value, path = "$", out = []) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) out.push(`${path} = ${value}`);
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => badNumbers(v, `${path}[${i}]`, out));
  } else if (value && typeof value === "object" && !(value instanceof Date)) {
    for (const [k, v] of Object.entries(value)) badNumbers(v, `${path}.${k}`, out);
  }
  return out;
}

const threw = (fn) => {
  try {
    fn();
    return null;
  } catch (err) {
    return err;
  }
};

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n1. The floor, and the fact that it is a real refusal\n");
//
// Five, because the claim is directional. If a contractor's estimating carried
// no bias, each job would land over or under at random, and the chance that n
// jobs all agree is 2 × (1/2)^n — 25% at three, 6.25% at five. Three jobs
// agreeing is a coincidence you would see in one range out of four, which is
// exactly the anecdote this feature must not print as a trend.
//
// The number itself matters less than it being ENFORCED, so what is asserted
// here is that crossing it is what turns the percentage on, in both directions.

ok("the floor is five", MIN_SAMPLE === 5, MIN_SAMPLE);

// Four identical jobs, each 20% over on hours. The pattern is perfectly
// consistent and it is still four jobs.
const overrunHours = (n, pct) =>
  Array.from({ length: n }, () =>
    job({
      estimate: est({ labourHours: 10, labourCost: 500, totalCost: 500 }),
      timeEntries: [entry(10 * (1 + pct / 100))],
    }),
  );

const four = run(overrunHours(4, 20));
ok(
  "four consistent jobs report NO percentage",
  four.dimensions.labourHours.medianPct === null &&
    four.dimensions.labourHours.meanPct === null &&
    four.dimensions.labourHours.aggregate === null,
  four.dimensions.labourHours.medianPct,
);
ok(
  "…and say so, with the sample and the shortfall",
  four.dimensions.labourHours.reportable === false &&
    four.dimensions.labourHours.sample === 4,
);
ok(
  "…as a finding a human can read, not just a boolean",
  four.findings.some((f) => f.code === "thin_sample" && f.values.needed === 5),
);
// The counts survive, because "4 of 4 ran over" is an observation about four
// jobs rather than a rate. That distinction is the whole reason `direction` is
// not nulled with everything else.
ok(
  "…while the raw counts DO survive — a count is not a rate",
  four.dimensions.labourHours.direction.over === 4,
  four.dimensions.labourHours.direction,
);

const five = run(overrunHours(5, 20));
ok(
  "the fifth job turns the percentage on",
  five.dimensions.labourHours.reportable === true &&
    five.dimensions.labourHours.medianPct === 20,
  five.dimensions.labourHours.medianPct,
);
// A caller cannot quietly lower it to make a screen look populated: the floor
// travels back with the report, so the UI's sentence and the arithmetic cannot
// disagree about what it was.
ok(
  "the floor in force is reported alongside the figures",
  five.minSample === 5 && five.dimensions.labourHours.minSample === 5,
);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n2. Only APPROVED hours are cost — inherited, not re-implemented\n");
//
// actualJobCost's rule: a pending entry is a claim, not a payroll liability.
// The roll-up calls that function rather than summing hours itself, so this
// section is really asserting that the call is real and that the roll-up did
// not quietly re-add the pending hours on the way past.
//
// The second half is the one a roll-up has to answer for on its own: a finished
// job whose timesheets are still open has labour short by an amount NOBODY has
// agreed yet. Including it without the pending hours would report an overrun as
// an underrun, so the job leaves the comparison entirely and is counted.

const six = [
  ...overrunHours(5, 0), // five jobs dead on: 10 est hours, 10 approved
  job({
    id: "job_pending",
    title: "Timesheets still open",
    estimate: est({ labourHours: 10, labourCost: 500, totalCost: 500 }),
    timeEntries: [entry(10), entry(100, { status: "pending" })],
  }),
];
const withPending = run(six);

ok(
  "a job with pending hours is EXCLUDED from labour hours…",
  withPending.dimensions.labourHours.excluded.some(
    (e) => e.reason === "hours_awaiting_approval" && e.count === 1,
  ),
);
ok(
  "…and from labour cost",
  withPending.dimensions.labourCost.excluded.some(
    (e) => e.reason === "hours_awaiting_approval" && e.count === 1,
  ),
);
// The number that proves the pending hours did not sneak in as cost anywhere.
// Five jobs × 10 hours = 50; the 100 pending hours are worth $5,000 at $50 and
// appear in no total.
ok(
  "the aggregate actual hours are the approved ones and nothing else",
  withPending.dimensions.labourHours.aggregate.actual === 50,
  withPending.dimensions.labourHours.aggregate,
);
ok(
  "the aggregate actual labour COST is approved-only too",
  withPending.dimensions.labourCost.aggregate.actual === 2500,
  withPending.dimensions.labourCost.aggregate,
);
// And it is said out loud, rather than the job merely vanishing.
ok(
  "the pending hours are reported as a warning, with the hour count",
  withPending.findings.some(
    (f) => f.code === "hours_awaiting_approval" && f.values.hours === 100,
  ),
);
ok(
  "…and counted in the data-quality block",
  withPending.dataQuality.pendingHours === 100 &&
    withPending.dataQuality.jobsWithPendingHours === 1,
  withPending.dataQuality,
);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n3. The unrated worker: counted, named, and kept out of the money\n");
//
// The rule inherited from actualJobCost is "contributes hours and no cost, and
// is COUNTED". A roll-up makes the damage worse rather than better — one
// labourer with no rate on six jobs is six jobs that look cheap — so this file
// takes it further in two directions at once:
//
//   * the job is dropped from labour COST, because its actual is short by
//     (hours × a rate nobody recorded), which is a known unknown;
//   * the job is KEPT in labour HOURS, because an unknown rate does not make
//     the hours unknown, and hours are the half that measures estimating.
//
// Getting that second half wrong in the safe-looking direction — dropping the
// job from both — would throw away the most useful number in the report every
// time a contractor forgot to fill in a rate.

const unrated = run([
  ...overrunHours(5, 20),
  job({
    id: "job_unrated",
    title: "Nobody priced Sam",
    estimate: est({ labourHours: 10, labourCost: 500, totalCost: 500 }),
    timeEntries: [entry(12, { workerId: "w_sam", name: "Sam", rate: null })],
  }),
]);

ok(
  "the unrated job is excluded from labour COST",
  unrated.dimensions.labourCost.excluded.some(
    (e) => e.reason === "unrated_worker" && e.count === 1,
  ),
);
ok(
  "…but NOT from labour HOURS — an unknown rate is not unknown time",
  unrated.dimensions.labourHours.sample === 6 &&
    !unrated.dimensions.labourHours.excluded.some((e) => e.reason === "unrated_worker"),
  unrated.dimensions.labourHours.sample,
);
ok(
  "the worker is NAMED, not counted as 'someone'",
  unrated.findings.some(
    (f) => f.code === "unrated_workers" && f.values.workers.some((w) => w.name === "Sam"),
  ),
);
ok(
  "…at the top severity, because this one skews a whole quarter",
  unrated.findings.find((f) => f.code === "unrated_workers")?.severity === "critical",
);
ok(
  "…with their hours, so the size of the hole is visible",
  unrated.dataQuality.unratedHours === 12,
  unrated.dataQuality.unratedHours,
);
// The failure this guards, in the arithmetic rather than in the prose. The five
// good jobs estimate $2,500 of labour and cost $3,000 — a real +20% overrun.
// The unrated job estimated $500 and "cost" $0. Folded in, the totals become
// $3,000 against $3,000: exactly 0%, which reads as "you price labour
// perfectly" on a company that is 20% over and has one worker with no rate.
ok(
  "the unrated job is out of the labour-cost sample entirely",
  unrated.dimensions.labourCost.sample === 5,
  unrated.dimensions.labourCost.sample,
);
ok(
  "…so the overrun stays +20% instead of being flattened to 0%",
  unrated.dimensions.labourCost.aggregate.estimated === 2500 &&
    unrated.dimensions.labourCost.aggregate.actual === 3000 &&
    unrated.dimensions.labourCost.aggregate.variancePct === 20,
  unrated.dimensions.labourCost.aggregate,
);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n4. Absence is not zero\n");
//
// Failure class 5, and the single most flattering arithmetic available to this
// file. A finished job with no expense rows against it is not a job that spent
// nothing on materials; it is a job nobody logged materials on. Scored as zero
// it would be 100% under budget, and a contractor who never records receipts
// would be shown a report saying their materials estimating is superb.

const noExpenses = run([
  ...Array.from({ length: 5 }, () =>
    job({
      estimate: est({ materialTotal: 1000, totalCost: 1000 }),
      expenses: [{ category: "materials", amount: 1000 }],
    }),
  ),
  job({
    id: "job_no_receipts",
    title: "Nobody kept the receipts",
    estimate: est({ materialTotal: 1000, totalCost: 1000 }),
    expenses: [],
  }),
]);

ok(
  "a job with no expenses is excluded from materials, not scored at -100%",
  noExpenses.dimensions.materials.excluded.some(
    (e) => e.reason === "no_expenses_recorded" && e.count === 1,
  ),
);
ok(
  "…so the materials median is 0%, not -16.7%",
  noExpenses.dimensions.materials.medianPct === 0,
  noExpenses.dimensions.materials.medianPct,
);
ok(
  "…and the omission is stated as a warning",
  noExpenses.findings.some((f) => f.code === "jobs_without_expenses" && f.values.jobs === 1),
);
// The same rule one step earlier: no saved cost estimate is not a $0 estimate.
const noEstimate = run([...overrunHours(5, 20), job({ id: "job_uncosted", estimate: null })]);
ok(
  "a job whose quote was never costed is excluded, and counted",
  noEstimate.dataQuality.jobsWithoutEstimate === 1 &&
    noEstimate.dimensions.labourHours.excluded.some((e) => e.reason === "no_estimate"),
);
// An estimate built over lines nobody had priced understates by an unknown
// amount — QuoteCosting.unpricedMaterials exists to say exactly that.
const unpriced = run([
  ...Array.from({ length: 5 }, () =>
    job({
      estimate: est({ materialTotal: 1000, totalCost: 1000 }),
      expenses: [{ category: "materials", amount: 1000 }],
    }),
  ),
  job({
    id: "job_unpriced",
    estimate: est({ materialTotal: 1000, unpricedMaterials: 4, totalCost: 1000 }),
    expenses: [{ category: "materials", amount: 4000 }],
  }),
]);
ok(
  "an estimate with unpriced material lines is not compared against",
  unpriced.dimensions.materials.excluded.some(
    (e) => e.reason === "unpriced_materials" && e.count === 1,
  ),
);
// Every exclusion reason resolves to a sentence. A payload that hands the UI a
// bare code has moved the explaining into the component, which is where it goes
// missing.
const allReasons = [
  ...unpriced.dimensions.materials.excluded,
  ...unrated.dimensions.labourCost.excluded,
  ...withPending.dimensions.labourHours.excluded,
  ...noEstimate.dimensions.labourHours.excluded,
];
ok(
  "every exclusion carries a stated reason, not a bare code",
  allReasons.length > 0 &&
    allReasons.every((e) => e.statement && e.statement !== e.reason) &&
    allReasons.every((e) => EXCLUSION_REASONS[e.reason]),
);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n5. One catastrophic job cannot become the headline\n");
//
// The scenario is real: a $400 repaint where a pipe bursts and the job costs
// $9,000. The mean of the per-job percentages is unbounded — one job can move
// it as far as you like — and it is the number a naive implementation reaches
// for first. The median moves by one position.
//
// So the median leads, the mean is kept and LABELLED, and when they diverge the
// job responsible is named rather than the mean being quietly dropped: a reader
// who sees only "+10%" while their books say they lost thousands stops trusting
// the page.

const outlier = run([
  ...overrunHours(5, 10),
  job({
    id: "job_burst_pipe",
    title: "Burst pipe, 12 Elm",
    estimate: est({ labourHours: 10, labourCost: 500, totalCost: 500 }),
    timeEntries: [entry(210)], // +2000%
  }),
]);
const lh = outlier.dimensions.labourHours;

ok("the median is unmoved by the catastrophe", lh.medianPct === 10, lh.medianPct);
ok("…while the mean is dragged past +300%", lh.meanPct > 300, lh.meanPct);
ok(
  "the divergence is declared, not left for the reader to spot",
  lh.meanDistortedBy?.jobId === "job_burst_pipe",
  lh.meanDistortedBy,
);
ok(
  `…using the stated ${MEAN_DISTORTION_PTS}pt threshold`,
  Math.abs(lh.meanPct - lh.medianPct) > MEAN_DISTORTION_PTS,
);
ok(
  "…and named in a finding, with the job title in the sentence",
  outlier.findings.some(
    (f) => f.code === "labourHours_mean_distorted" && f.text.includes("Burst pipe"),
  ),
);
// The aggregate is dollar-weighted and therefore ALSO distorted — that is not a
// bug, it is the money question. What matters is that it is not the headline.
ok(
  "the aggregate is distorted too, and is a separate, labelled figure",
  lh.aggregate.actual === 265 && lh.aggregate.variancePct > 300,
  lh.aggregate,
);
// Removing the outlier changes the mean enormously and the median not at all.
const withoutOutlier = run(overrunHours(5, 10));
ok(
  "deleting the outlier leaves the headline where it was",
  withoutOutlier.dimensions.labourHours.medianPct === lh.medianPct,
);
ok(
  "…and moves the average by hundreds of points",
  Math.abs(withoutOutlier.dimensions.labourHours.meanPct - lh.meanPct) > 300,
);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n6. An empty range says it is empty\n");
//
// The inversion this guards: no finished jobs produces no variance, and a
// report that renders no variance as 0% is telling a contractor their
// estimating was perfect in a quarter where nothing happened. Somebody would
// act on that.

const empty = run([]);
ok("an empty range is flagged empty", empty.empty === true);
ok(
  "…and says so in a sentence that refuses the reading",
  /not a report of accurate estimating/i.test(empty.emptyStatement || ""),
);
ok("…with no percentages anywhere", badNumbers(empty).length === 0 && empty.anyReportable === false);
ok(
  "…and no dimension quietly reporting on target",
  Object.keys(empty.dimensions).length === 0,
);

// Jobs exist, but none is comparable — the other half of the same failure.
const noneComparable = run([job({ estimate: null }), job({ estimate: null })]);
ok(
  "jobs with nothing to compare do not become an on-target report",
  noneComparable.empty === false &&
    noneComparable.anyReportable === false &&
    noneComparable.dimensions.labourHours.sample === 0 &&
    noneComparable.dimensions.labourHours.medianPct === null,
);
ok(
  "…and the reason is a finding, not a blank card",
  noneComparable.findings.some((f) => f.code === "no_comparable_jobs"),
);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n7. Segments obey the same floor, and nothing is double-counted\n");
//
// "You underestimate labour on kitchens but not on exteriors" is the sentence
// worth reading. It is also a smaller sample by construction, which is why a
// segment faces the same floor as the headline — a per-trade table is the
// easiest place in this feature to print a percentage off two jobs.
//
// The other trap is attribution. A job whose quote covers two trades cannot say
// which trade the overrun belongs to. Counting it under BOTH would let a
// contractor raise their tiling rate on evidence that was half painting.

const trade = (key, label) => [{ key, label }];
const tradeJobs = [
  ...Array.from({ length: 5 }, () =>
    job({
      tradeKeys: trade("kitchens", "Kitchens"),
      estimate: est({ labourHours: 10, labourCost: 500, totalCost: 500 }),
      timeEntries: [entry(14)], // +40%
    }),
  ),
  ...Array.from({ length: 5 }, () =>
    job({
      tradeKeys: trade("exteriors", "Exteriors"),
      estimate: est({ labourHours: 10, labourCost: 500, totalCost: 500 }),
      timeEntries: [entry(10)], // 0%
    }),
  ),
  // Two trades on one quote, wildly over. It must reach neither bucket.
  job({
    id: "job_mixed",
    tradeKeys: [...trade("kitchens", "Kitchens"), ...trade("exteriors", "Exteriors")],
    estimate: est({ labourHours: 10, labourCost: 500, totalCost: 500 }),
    timeEntries: [entry(30)],
  }),
  // A single trade, on its own. Named and counted, never given a figure.
  job({
    id: "job_lone_trade",
    tradeKeys: trade("decking", "Decking"),
    estimate: est({ labourHours: 10, labourCost: 500, totalCost: 500 }),
    timeEntries: [entry(20)],
  }),
];
const byTrade = run(tradeJobs).dimensions.labourHours.segments.trade;

ok(
  "both trades that clear the floor are reported",
  byTrade.reported.length === 2 &&
    byTrade.reported.map((s) => s.key).sort().join(",") === "exteriors,kitchens",
  byTrade.reported.map((s) => s.key),
);
ok(
  "…worst first, so the reader lands on where the money is going",
  byTrade.reported[0].key === "kitchens" && byTrade.reported[0].medianPct === 40,
  byTrade.reported[0],
);
ok(
  "each trade's sample is exactly five — the mixed job is in neither",
  byTrade.reported.every((s) => s.sample === 5),
  byTrade.reported.map((s) => s.sample),
);
ok(
  "…and is counted as unattributed rather than silently dropped",
  byTrade.unattributed === 1,
  byTrade.unattributed,
);
ok(
  "the thin trade is named and counted, with NO percentage",
  byTrade.suppressed.length === 1 &&
    byTrade.suppressed[0].key === "decking" &&
    byTrade.suppressed[0].sample === 1 &&
    byTrade.suppressed[0].medianPct === undefined,
  byTrade.suppressed,
);
ok(
  "the mixed-trade job is explained to the reader",
  run(tradeJobs).findings.some((f) => f.code === "mixed_trade_jobs" && f.values.jobs === 1),
);
// The spread sentence is only written when BOTH sides were reportable, so
// "kitchens are worse than exteriors" is never a comparison against a figure
// this file refused to print.
ok(
  "the trade-spread insight fires only on two reportable trades",
  run(tradeJobs).findings.some(
    (f) => f.code === "labourHours_trade_spread" && f.values.worst.key === "kitchens",
  ) && !run(overrunHours(5, 20)).findings.some((f) => f.code === "labourHours_trade_spread"),
);

// The spread sentence has a THRESHOLD as well as a floor, and mutation testing
// found it unguarded: two reportable trades a couple of points apart must not
// be presented as a gap worth acting on, or the insight fires on every range
// with more than one trade in it and stops meaning anything.
const closeTrades = [
  ...Array.from({ length: 5 }, () =>
    job({
      tradeKeys: trade("kitchens", "Kitchens"),
      estimate: est({ labourHours: 100, labourCost: 500, totalCost: 500 }),
      timeEntries: [entry(120)], // +20%
    }),
  ),
  ...Array.from({ length: 5 }, () =>
    job({
      tradeKeys: trade("exteriors", "Exteriors"),
      estimate: est({ labourHours: 100, labourCost: 500, totalCost: 500 }),
      timeEntries: [entry(122)], // +22%
    }),
  ),
];
const close = run(closeTrades);
ok(
  "two reportable trades two points apart are NOT called a spread",
  close.dimensions.labourHours.segments.trade.reported.length === 2 &&
    !close.findings.some((f) => f.code === "labourHours_trade_spread"),
  close.findings.map((f) => f.code),
);

// Crew attribution follows the same rule: a job with two people on it belongs
// to neither of them.
const crewJobs = [
  ...Array.from({ length: 5 }, () =>
    job({
      estimate: est({ labourHours: 10, labourCost: 500, totalCost: 500 }),
      timeEntries: [entry(10)],
    }),
  ),
  job({
    id: "job_two_up",
    estimate: est({ labourHours: 10, labourCost: 500, totalCost: 500 }),
    timeEntries: [entry(5), entry(5, { workerId: "w_sam", name: "Sam", rate: 40 })],
  }),
];
const byCrew = run(crewJobs, { segments: { crew: true } }).dimensions.labourHours.segments.crew;
ok(
  "a two-person job is attributed to neither person",
  byCrew.unattributed === 1 && byCrew.reported.every((s) => s.sample === 5),
  byCrew,
);
// Client and crew segments are behind permission dials, so they must be ABSENT
// rather than empty when not granted — "you may not see this" and "there is
// nothing here" are different sentences.
const ungated = run(crewJobs).dimensions.labourHours.segments;
ok(
  "an ungranted segment is absent from the payload, not an empty list",
  ungated.crew === undefined && ungated.client === undefined,
  Object.keys(ungated),
);

// Size bands are terciles of the range's own jobs, so they need three times the
// floor before they are drawn at all.
const sized = Array.from({ length: 15 }, (_, i) =>
  job({
    estimate: est({ labourHours: 10, labourCost: 500, totalCost: (i + 1) * 1000 }),
    timeEntries: [entry(11)],
  }),
);
const bands = run(sized).dimensions.labourHours.segments.size;
ok(
  "size bands need 3 × the floor before they are drawn",
  bands.available === true && bands.bands.length === 3,
  bands.available,
);
ok(
  "…each band clears the floor on its own",
  bands.bands.every((b) => b.sample >= MIN_SAMPLE && b.reportable),
  bands.bands.map((b) => b.sample),
);
ok(
  "…and states its real cost interval rather than an adjective",
  bands.bands[0].from === 1000 && bands.bands[2].to === 15000,
  bands.bands.map((b) => [b.from, b.to]),
);
const fewSized = run(overrunHours(6, 10)).dimensions.labourHours.segments.size;
ok(
  "…and below that they are refused with a reason, not drawn thin",
  fewSized.available === false && fewSized.reason === "too_few_jobs" && fewSized.bands.length === 0,
  fewSized,
);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n8. Hostile input: no NaN, no Infinity, no division by zero\n");
//
// Everything here has a real route in from the database. `hours` is a nullable
// Decimal, `estimate.totalCost` can be 0 on a row that exists, a job can have
// no quote at all, and a Decimal that round-trips through JSON arrives as a
// string. The tolerance for a NaN on a money screen is zero — it renders, and
// it renders as an answer.

const hostile = [
  // No quote behind the job at all.
  job({ id: "h_no_quote", estimate: null, tradeKeys: [], clientId: null, clientName: null }),
  // An estimate that exists and is entirely zero. Every percentage here would
  // divide by zero if eligibility were not doing its job.
  job({
    id: "h_zero_estimate",
    estimate: est({ labourHours: 0, labourCost: 0, materialTotal: 0, totalCost: 0 }),
    expenses: [{ category: "materials", amount: 500 }],
    timeEntries: [entry(8)],
  }),
  // Hours as junk: null, empty string, a word, and a number no column holds.
  job({
    id: "h_junk_hours",
    estimate: est({ labourHours: 10, labourCost: 500, totalCost: 500 }),
    timeEntries: [
      entry(null),
      entry(""),
      entry("banana"),
      entry(Infinity),
      entry(1e308),
      entry(-4),
    ],
  }),
  // Decimals as strings, the shape a JSON round-trip produces.
  job({
    id: "h_string_decimals",
    estimate: est({ labourHours: "10", labourCost: "500", materialTotal: "100", totalCost: "600" }),
    expenses: [{ category: "materials", amount: "125.50" }],
    timeEntries: [entry("12")],
  }),
  // Negative money, and an expense with no amount.
  job({
    id: "h_negatives",
    estimate: est({ labourHours: 10, labourCost: 500, materialTotal: -100, totalCost: 400 }),
    expenses: [{ category: "refund", amount: -50 }, { category: "x" }],
    timeEntries: [entry(10)],
  }),
  // Arrays that are not arrays, and a job that is barely a job.
  job({ id: "h_not_arrays", expenses: null, timeEntries: undefined, tradeKeys: "painting" }),
  job({ id: "h_bare", estimate: undefined }),
];

const hostileReport = run(hostile);
const bad = badNumbers(hostileReport);
ok("no non-finite number anywhere in the payload", bad.length === 0, bad.slice(0, 5));
ok(
  "…including in the findings' machine-readable values",
  badNumbers(hostileReport.findings).length === 0,
);
ok("the report still answers, rather than throwing", hostileReport.empty === false);
// The zero estimate is the division-by-zero case, and it is refused by name in
// all three dimensions rather than producing Infinity.
for (const [dim, reason] of [
  ["labourHours", "no_estimated_hours"],
  ["labourCost", "no_estimated_labour_cost"],
  ["materials", "no_estimated_materials"],
]) {
  ok(
    `a zero estimate is refused by name in ${dim}, not divided by`,
    hostileReport.dimensions[dim].excluded.some(
      (e) => e.reason === reason && e.jobs.some((j) => j.jobId === "h_zero_estimate"),
    ),
  );
}
// Strings that are really numbers still count — the guard must not reject real
// data on its way to rejecting junk.
ok(
  "string decimals are read as the numbers they are",
  hostileReport.dimensions.labourHours.excluded.every(
    (e) => !e.jobs.some((j) => j.jobId === "h_string_decimals"),
  ),
);
// A job with a null time entry and an Infinity one contributes only the hours
// that are real: 1e308 survives Number() and dies at the ×100 in round2, and
// -4 and Infinity are dropped by the same guard actualJobCost applies.
ok(
  "junk hours neither crash nor become cost",
  Number.isFinite(hostileReport.dataQuality.pendingHours),
);

// ── The estimate that is positive and rounds to zero ──────────────────────
//
// The nastiest arithmetic in the file, and the one no obvious fixture reaches.
// Eligibility asks whether the RAW estimate is above zero; every figure is then
// rounded to the cent. A quote costed at $0.001 of labour passes the first test
// and becomes 0 in the second, so the denominator of every percentage is zero
// on a job the report considers comparable. Without the guards that is a
// division by zero in the per-job rate AND in the aggregate.
const subCent = run(
  Array.from({ length: 5 }, () =>
    job({
      estimate: est({ labourHours: 0.001, labourCost: 0.001, totalCost: 0.001 }),
      timeEntries: [entry(8)],
    }),
  ),
);
ok(
  "a sub-cent estimate produces no non-finite number",
  badNumbers(subCent).length === 0,
  badNumbers(subCent).slice(0, 3),
);
ok(
  "…the aggregate rate is null rather than 0%, because there is no denominator",
  subCent.dimensions.labourHours.aggregate.estimated === 0 &&
    subCent.dimensions.labourHours.aggregate.variancePct === null,
  subCent.dimensions.labourHours.aggregate,
);
ok(
  "…and the per-job rate falls back to 0, not to Infinity",
  subCent.dimensions.labourHours.medianPct === 0 &&
    subCent.dimensions.labourHours.worst.pct === 0,
  subCent.dimensions.labourHours.worst,
);
// The same shape one column over: an estimate too large for the money column.
// round2 refuses 1e308 rather than letting it reach a sum.
const overflow = run([
  ...Array.from({ length: 4 }, () =>
    job({
      estimate: est({ materialTotal: 1000, totalCost: 1000 }),
      expenses: [{ category: "materials", amount: 1000 }],
    }),
  ),
  job({
    id: "h_overflow",
    estimate: est({ materialTotal: 1e308, totalCost: 1e308 }),
    expenses: [{ category: "materials", amount: 1e308 }],
  }),
]);
ok(
  "an estimate past what the money column holds cannot reach a total",
  badNumbers(overflow).length === 0 &&
    overflow.dimensions.materials.aggregate.estimated === 4000,
  overflow.dimensions.materials.aggregate,
);

// A quote with no job is structurally absent from this report — the unit is the
// JOB, and section 9 asserts the route never queries the quote model at all.
ok(
  "a job with no quote is counted, and excluded for having no estimate",
  hostileReport.dataQuality.jobsWithoutEstimate === 2 &&
    hostileReport.dimensions.labourCost.excluded.some((e) => e.reason === "no_estimate"),
  hostileReport.dataQuality.jobsWithoutEstimate,
);

// ── Ranges ────────────────────────────────────────────────────────────────
//
// An inverted range THROWS rather than returning empty, for the reason the
// statements builder gives about the same case: three empty sections look
// exactly like a quiet quarter, and somebody would file them.
const backwards = threw(() =>
  buildEstimateAccuracy({ from: "2026-06-30", to: "2026-01-01", currency: "CAD", jobs: [] }),
);
ok("an inverted range throws, rather than reporting nothing", backwards?.status === 400);
ok("…with a code the route can turn into a sentence", backwards?.code === "backwards_range");
const junkRange = threw(() =>
  buildEstimateAccuracy({ from: "banana", to: "2026-01-01", currency: "CAD", jobs: [] }),
);
ok("a malformed date throws before it reaches a Date constructor", junkRange?.status === 400);
// Currency is never assumed. A dollar sign in front of a euro overrun is the
// same class of bug as $2100.00 on a client document.
const noCurrency = threw(() =>
  buildEstimateAccuracy({ from: "2026-01-01", to: "2026-06-30", jobs: [] }),
);
ok("a missing currency is refused, never defaulted to CAD", noCurrency?.status === 409);

// The tolerance band is real: a 3% overrun is not an alert.
const tight = run(
  Array.from({ length: 5 }, () =>
    job({
      estimate: est({ labourHours: 100, labourCost: 500, totalCost: 500 }),
      timeEntries: [entry(103)],
    }),
  ),
);
ok(
  `a ${3}% drift lands inside the ±${TOLERANCE_PCT}% band`,
  tight.dimensions.labourHours.tone === "on_target" &&
    tight.dimensions.labourHours.direction.onTarget === 5,
  tight.dimensions.labourHours.tone,
);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n9. The route, EXECUTED against a scripted database\n");
//
// A regex proving a gate is written down does not prove it refuses, and it
// passes happily against a guard disabled with `false &&`. So the real GET
// handler is imported and called with "@/lib/db", "@/lib/currentMember" and
// "next/server" swapped for stubs — the technique check-crew-access.mjs
// section 10 uses.
//
// The db proxy THROWS on any model this check did not script. That is the
// assertion behind "a quote with no job cannot appear here": the route is run
// without the quote model existing at all, and it answers.

globalThis.__FQ_ROWS = { member: [], company: [], job: [], expense: [], timeEntry: [] };

function matchWhere(row, where = {}) {
  if (!row) return false;
  for (const [key, cond] of Object.entries(where)) {
    if (cond === undefined) continue;
    const value = row[key];
    if (cond === null) {
      if (value != null) return false;
      continue;
    }
    if (cond instanceof Date) {
      if (!(value instanceof Date) || value.getTime() !== cond.getTime()) return false;
      continue;
    }
    if (cond && typeof cond === "object") {
      if ("in" in cond) {
        if (!cond.in.includes(value)) return false;
        continue;
      }
      if ("gte" in cond || "lte" in cond) {
        const v = value instanceof Date ? value.getTime() : Number(value);
        if ("gte" in cond && !(v >= new Date(cond.gte).getTime())) return false;
        if ("lte" in cond && !(v <= new Date(cond.lte).getTime())) return false;
        continue;
      }
      // A to-one relation filter, e.g. `worker: { companyId }`.
      if (!matchWhere(value, cond)) return false;
      continue;
    }
    if (value !== cond) return false;
  }
  return true;
}

const RELATIONS = new Set(["client", "quote", "worker", "costing", "scopeGroups", "category"]);

function projectRelation(value, spec) {
  if (spec === true) return value;
  if (Array.isArray(value)) return value.map((v) => projectRow(v, spec));
  if (value == null) return null;
  return projectRow(value, spec);
}

function projectRow(row, spec = {}) {
  if (!row) return row;
  if (spec.select) {
    const out = {};
    for (const [key, sub] of Object.entries(spec.select)) {
      out[key] = sub === true ? row[key] : projectRelation(row[key], sub);
    }
    return out;
  }
  const out = {};
  for (const [key, value] of Object.entries(row)) if (!RELATIONS.has(key)) out[key] = value;
  return out;
}

function stubModel(name) {
  const all = () => globalThis.__FQ_ROWS[name] || [];
  return {
    async findMany(args = {}) {
      return all().filter((r) => matchWhere(r, args.where)).map((r) => projectRow(r, args));
    },
    async findFirst(args = {}) {
      const hit = all().find((r) => matchWhere(r, args.where));
      return hit ? projectRow(hit, args) : null;
    },
    async findUnique(args = {}) {
      const hit = all().find((r) => matchWhere(r, args.where));
      return hit ? projectRow(hit, args) : null;
    },
  };
}

globalThis.__FQ_DB = new Proxy(
  {},
  {
    get(_t, prop) {
      if (typeof prop !== "string") return undefined;
      // Loud, not quiet. A check must never pass because a query it did not
      // model answered "nothing" — and this is also what proves the route
      // never reaches for the quote table.
      if (!(prop in globalThis.__FQ_ROWS)) {
        throw new Error(`dbStub: db.${prop} is not scripted in this check`);
      }
      return stubModel(prop);
    },
  },
);

globalThis.__FQ_MEMBER = async () => globalThis.__FQ_SESSION;

const HOOKS = `
const STUBS = {
  "@/lib/db": "fq-stub:db",
  "@/lib/currentMember": "fq-stub:member",
  "next/server": "fq-stub:next",
};
export async function resolve(specifier, context, nextResolve) {
  if (STUBS[specifier]) return { url: STUBS[specifier], shortCircuit: true };
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  if (url === "fq-stub:db") {
    return { format: "module", shortCircuit: true,
      source: "export const db = new Proxy({}, { get: (_t, p) => globalThis.__FQ_DB[p] });" };
  }
  if (url === "fq-stub:member") {
    return { format: "module", shortCircuit: true,
      source: "export const getCurrentMember = (...a) => globalThis.__FQ_MEMBER(...a);" };
  }
  if (url === "fq-stub:next") {
    return { format: "module", shortCircuit: true,
      source: "export const NextResponse = { json: (body, init) => ({ body, status: init?.status ?? 200 }) };" };
  }
  return nextLoad(url, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);

const route = await import("@/app/api/analytics/estimate-accuracy/route.js");

// Callers built from the REAL presets. A hand-written grid would drift from the
// thing the product ships and this check would keep passing on the copy.
const caller = (id, presetKey, over = {}) => ({
  id,
  userId: `u_${id}`,
  companyId: "co",
  role: PRESET_TO_ROLE[presetKey] || "employee",
  permissions: { ...PERMISSION_PRESETS[presetKey].values, ...over },
});
const OWNER = { id: "m_owner", userId: "u_owner", companyId: "co", role: "owner", permissions: null };
const CREW = caller("m_crew", "worker");
const ESTIMATOR = caller("m_est", "estimator");
const DISPATCHER = caller("m_disp", "dispatcher");
const MANAGER = caller("m_mgr", "manager");
// A manager whose client book and timesheet access were dialled back. Same
// report, two fewer breakdowns.
const NARROW_MANAGER = caller("m_narrow", "manager", {
  clientsProperties: "name_address_only",
  timeTracking: "view_record_edit_own",
});
// The case the third gate exists for: somebody handed jobCosting while still
// scoped to the jobs they personally have a visit on.
const SCOPED_COSTER = caller("m_scoped", "worker", { jobCosting: true, showPricing: true });
// Every SHIPPED preset that fails showPricing also fails jobCosting, so the
// presets alone cannot tell the two gates apart — mutation testing showed
// deleting the showPricing line changed no assertion. This caller exists purely
// to separate them: a manager with pricing switched off, which is a grid an
// owner can build in the access editor today.
const PRICING_BLIND = caller("m_blind", "manager", { showPricing: false });

globalThis.__FQ_ROWS.member = [OWNER, CREW, ESTIMATOR, DISPATCHER, MANAGER, NARROW_MANAGER, SCOPED_COSTER, PRICING_BLIND];
globalThis.__FQ_ROWS.company = [{ id: "co", currency: "CAD" }];

const costingRow = (o = {}) => ({
  labourHours: 10,
  labourCost: 500,
  materialTotal: 1000,
  unpricedMaterials: 0,
  costIncomplete: false,
  totalCost: 1500,
  updatedAt: new Date("2026-01-05"),
  ...o,
});

const dbJob = (id, o = {}) => ({
  id,
  companyId: "co",
  title: o.title || id,
  status: o.status || "completed",
  completedAt: o.completedAt || new Date("2026-03-15"),
  client: { id: "cl_1", name: "Ana Ruiz" },
  quote: o.quote === null ? null : { id: `q_${id}`, costing: costingRow(o.costing), scopeGroups: [{ category: { key: "interior_painting", label: "Interior painting" } }] },
});

globalThis.__FQ_ROWS.job = [
  ...Array.from({ length: 5 }, (_, i) => dbJob(`j${i}`)),
  // Outside the range, and still running — neither may reach the report.
  dbJob("j_old", { completedAt: new Date("2025-03-15") }),
  dbJob("j_running", { status: "in_progress", completedAt: null }),
];
globalThis.__FQ_ROWS.expense = globalThis.__FQ_ROWS.job
  .filter((j) => j.status === "completed")
  .map((j, i) => ({ id: `e${i}`, companyId: "co", projectId: j.id, category: "materials", amount: 1200 }));
globalThis.__FQ_ROWS.timeEntry = globalThis.__FQ_ROWS.job.map((j, i) => ({
  id: `t${i}`,
  jobId: j.id,
  hours: 12,
  status: "approved",
  workerId: "w_dani",
  worker: { id: "w_dani", companyId: "co", name: "Dani", hourlyRate: 50 },
}));

async function as(who, { from = "2026-01-01", to = "2026-06-30" } = {}) {
  globalThis.__FQ_SESSION = who;
  return route.GET({ url: `http://x/api/analytics/estimate-accuracy?from=${from}&to=${to}` });
}

const crewRes = await as(CREW);
ok("a crew member is REFUSED", crewRes.status === 403, crewRes.status);
ok(
  "…without being told which permission they are missing",
  !/jobCosting|showPricing|company_wide/.test(JSON.stringify(crewRes.body)),
  crewRes.body,
);
ok("an estimator is refused — jobCosting is off on that preset", (await as(ESTIMATOR)).status === 403);
ok("a dispatcher is refused", (await as(DISPATCHER)).status === 403);
// The third gate, on its own. This member holds both toggles and is still
// refused, because a roll-up over the three jobs they have a visit on is not
// the company's estimating accuracy — it is a wrong number with a real number's
// confidence.
const scopedRes = await as(SCOPED_COSTER);
ok(
  "a member scoped to their own jobs is refused even holding both toggles",
  scopedRes.status === 403,
  scopedRes.status,
);
// showPricing on its own. A range of per-trade cost variances IS the rate card
// in reverse — "kitchens cost you $3,100 to deliver" is what a competitor pays
// for — so somebody who may not see prices may not see this either.
const blindRes = await as(PRICING_BLIND);
ok(
  "a member with pricing switched off is refused, even holding jobCosting",
  blindRes.status === 403,
  blindRes.status,
);

const mgr = await as(MANAGER);
ok("a manager is allowed", mgr.status === 200, mgr.status);
ok("an owner is allowed", (await as(OWNER)).status === 200);

// The population, decided by the route's own where-clause.
ok(
  "only completed jobs inside the range are counted",
  mgr.body.jobsInRange === 5,
  mgr.body.jobsInRange,
);
ok(
  "…so the sample clears the floor and the report speaks",
  mgr.body.dimensions.labourHours.reportable === true &&
    mgr.body.dimensions.labourHours.medianPct === 20,
  mgr.body.dimensions.labourHours.medianPct,
);
ok("…in the company's own currency, never assumed", mgr.body.currency === "CAD");
ok("no non-finite number survives the round trip", badNumbers(mgr.body).length === 0);

// Segment gating, both directions.
ok(
  "a full manager gets the client and crew breakdowns",
  mgr.body.segmentAccess.client === true &&
    mgr.body.segmentAccess.crew === true &&
    mgr.body.dimensions.labourHours.segments.client !== undefined &&
    mgr.body.dimensions.labourHours.segments.crew !== undefined,
);
const narrow = await as(NARROW_MANAGER);
ok("a narrowed manager still gets the report", narrow.status === 200);
ok(
  "…with the client and crew breakdowns ABSENT, not empty",
  narrow.body.segmentAccess.client === false &&
    narrow.body.segmentAccess.crew === false &&
    narrow.body.dimensions.labourHours.segments.client === undefined &&
    narrow.body.dimensions.labourHours.segments.crew === undefined,
);
ok(
  "…and no client name anywhere in the payload",
  !JSON.stringify(narrow.body).includes("Ana Ruiz"),
);

// Ranges, at the route boundary.
ok("a backwards range is a 400", (await as(MANAGER, { from: "2026-06-30", to: "2026-01-01" })).status === 400);
ok("a malformed date is a 400", (await as(MANAGER, { from: "yesterday" })).status === 400);
// A range with nothing finished in it answers 200 and says it is empty. A 404
// or a silent zero would both read as "your estimates were perfect".
const quiet = await as(MANAGER, { from: "2024-01-01", to: "2024-03-31" });
ok("a quiet range is a 200 that says it is empty", quiet.status === 200 && quiet.body.empty === true);
ok("…and reports nothing as reportable", quiet.body.anyReportable === false);

// The currency refusal, at the route.
globalThis.__FQ_ROWS.company = [{ id: "co", currency: null }];
ok("a company with no currency is refused with a code the UI can act on",
  (await as(MANAGER)).status === 409 && (await as(MANAGER)).body.code === "no_currency");
globalThis.__FQ_ROWS.company = [{ id: "co", currency: "CAD" }];

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n10. The screen tells the same story the server does\n");
//
// The page is JSX and cannot be executed here, so only what can be checked as
// TEXT is checked, and positionally — a deleted guard fails rather than a
// reworded comment.

const page = readFileSync(join(ROOT, "app/app/analytics/estimate-accuracy/page.js"), "utf8");
ok(
  "one renderer decides how a null percentage looks",
  /function Rate\(\{ value, absent \}\)/.test(page) &&
    /if \(value == null\) \{/.test(page),
);
ok(
  "…and the thin-sample branch renders a sentence instead of a figure",
  /dim\.reportable \?/.test(page) && /app\.estimateAccuracy\.tooThin/.test(page),
);
ok(
  "the median is the headline and the mean is labelled 'average'",
  /app\.estimateAccuracy\.typicalJob/.test(page) &&
    /Average across the jobs/.test(page),
);
// Matched at the three points that make the control WORK — the toggle flips
// state, the list is rendered behind that state, and each row links to the job.
// The first version of this assertion matched the chevron icons beside the
// button, and mutation testing walked straight through it.
ok(
  "every excluded job stays reachable from the card",
  /setShowExclusions\(\(v\) => !v\)/.test(page) &&
    /\{showExclusions && \(/.test(page) &&
    /ex\.jobs\.map\(\(j\) => \(/.test(page) &&
    /href=\{`\/app\/jobs\/\$\{j\.jobId\}`\}/.test(page),
);
ok(
  "a restricted segment says it is restricted rather than rendering empty",
  /app\.estimateAccuracy\.clientRestricted/.test(page) &&
    /app\.estimateAccuracy\.crewRestricted/.test(page),
);
ok(
  "the fetch has an error branch — no silent `if (res.ok)`",
  /catch \(err\) \{/.test(page) && /setError\(err\.message\)/.test(page),
);
// A working page nothing links to is a page nobody finds.
const benchmark = readFileSync(join(ROOT, "app/app/analytics/benchmark/page.js"), "utf8");
ok(
  "the Insights hub links to it",
  benchmark.includes('href="/app/analytics/estimate-accuracy"'),
);

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  x ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fails.length ? 1 : 0);
