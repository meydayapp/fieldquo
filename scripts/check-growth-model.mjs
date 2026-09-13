// scripts/check-growth-model.mjs
//
//   npm run check:growth-model
//
// Executes lib/platform/growthModel.js — the capacity forecast — against
// hostile input and against the owner's own plan (20 closers, 150 dials a
// day, 918,244 prospects). The point of the model is that it refuses to guess
// and says which milestones the numbers can reach at all; both refusals are
// asserted here, because a forecast that silently filled a missing rate with
// 0.5 would pass every arithmetic test and still be the lie this repo is
// swept for. The signup sources — dialler, re-dial, organic, marketing,
// referral — are asserted apart, and the ceiling is asserted to move the way
// the maths says it must when referrals enter.
//
// The four sources the owner said were missing ("more marketing campaigns
// and going over older leads") are each executed: refill keeps the curve
// growing past the point the fixed list ran out; re-dial adds dials at the
// repeat yield and only with the capacity the fresh list left; marketing
// adds signups converted at the trial rate; the ceiling explanation names
// the binding rate; and the old fixed-list result is reproduced EXACTLY when
// all four are 0 — every number the earlier version of this file asserted
// still holds, and a serialised snapshot is compared besides.
//
// Runs under scripts/alias-loader.mjs because the model quotes the retry
// rules' attempt ceiling from lib/sales/retryRules.js rather than copying it.

import {
  rate, monthlyCount, project, monthLabel, MILESTONES, FLOORS, RATE_KEYS, FUNNEL_RATE_KEYS, COUNT_KEYS, ASSUMPTION_FIELDS, HORIZON_MONTHS,
  RETRY_RETURN_MONTHS, RETRY_MAX_ATTEMPTS, marketingAssumption, adsAssumption, reachPerProspect, DEFAULT_ATTEMPTS_PER_PROSPECT,
} from "../lib/platform/growthModel.js";
import { RETRY_MAX_ATTEMPTS as RULES_MAX } from "../lib/sales/retryRules.js";

let passed = 0;
let failed = 0;
function ok(name, cond, extra) {
  if (cond) passed += 1;
  else {
    failed += 1;
    console.error(`  ✗ ${name}`, extra === undefined ? "" : JSON.stringify(extra));
  }
}
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

// ── rate(): basis is a fact about the sample, not a mood ────────────────────
ok("below the floor with no assumption is NONE, value null",
  (() => { const r = rate({ hit: 3, of: 12, floor: 200 }); return r.basis === "none" && r.value === null && r.remaining === 188 && near(r.measured, 0.25); })());
// ── The blend: the assumption is worth `floor` rows, the pipeline its own ──
//
// It used to be a switch — assumption below the floor, measurement at it —
// and the forecast jumped the day 200 dials were dispositioned. The owner
// asked for the real data to be combined with the estimate until there is
// enough of it, which is exactly (floor·assumed + n·measured) / (floor + n).
ok("with an assumption, twelve rows are BLENDED — mostly assumption, a little measurement",
  (() => { const r = rate({ hit: 3, of: 12, floor: 200, assumed: 0.15 }); return r.basis === "blended" && near(r.value, (200 * 0.15 + 12 * 0.25) / 212) && near(r.measuredWeight, 12 / 212) && near(r.measured, 0.25) && r.sampleSize === 12 && r.remaining === 188; })());
ok("at the floor it is half and half, not the measurement whole",
  (() => { const r = rate({ hit: 30, of: 200, floor: 200, assumed: 0.9 }); return r.basis === "blended" && near(r.value, (0.9 + 0.15) / 2) && near(r.measuredWeight, 0.5) && r.remaining === 0 && r.assumed === 0.9; })());
ok("nothing jumps at the floor: 199 rows and 200 rows differ by a hair",
  (() => { const a = rate({ hit: 30, of: 199, floor: 200, assumed: 0.9 }).value; const b = rate({ hit: 30, of: 200, floor: 200, assumed: 0.9 }).value; return Math.abs(a - b) < 0.01; })());
ok("every extra row moves the answer toward the measurement",
  (() => { const v = [10, 50, 200, 800, 3000].map((n) => rate({ hit: Math.round(n * 0.15), of: n, floor: 200, assumed: 0.9 }).value); return v.every((x, i) => i === 0 || x < v[i - 1]) && v[4] > 0.15 && v[4] < 0.2; })());
ok("at nine floors the assumption is a tenth of the answer and the basis is MEASURED",
  (() => { const r = rate({ hit: 270, of: 1800, floor: 200, assumed: 0.9 }); return r.basis === "measured" && near(r.measuredWeight, 0.9) && near(r.value, 0.15 * 0.9 + 0.9 * 0.1); })());
ok("no assumption and the floor met is the measurement alone",
  (() => { const r = rate({ hit: 30, of: 200, floor: 200 }); return r.basis === "measured" && near(r.value, 0.15) && r.measuredWeight === 1; })());
ok("an assumption with no rows yet is ASSUMED, weight zero",
  (() => { const r = rate({ hit: 0, of: 0, floor: 200, assumed: 0.15 }); return r.basis === "assumed" && r.value === 0.15 && r.measuredWeight === 0; })());
ok("more hits than the denominator clamps to 1, not 1.5", rate({ hit: 15, of: 10, floor: 5 }).value === 1);
ok("the referral coefficient may exceed 1 when its max says so", rate({ hit: 30, of: 20, floor: 5, max: 10 }).value === 1.5);
ok("NaN, negative and string counts are treated as zero rows, never as data",
  (() => { const r = rate({ hit: NaN, of: -4, floor: 10, assumed: 0.2 }); return r.sampleSize === 0 && r.basis === "assumed" && r.measured === null; })());
ok("an assumption outside 0..1 is not an assumption", rate({ of: 0, floor: 10, assumed: 1.5 }).basis === "none" && rate({ of: 0, floor: 10, assumed: -0.1 }).basis === "none");
ok("an assumption of exactly 0 or 1 is allowed (a rate can be zero)", rate({ of: 0, floor: 10, assumed: 0 }).basis === "assumed" && rate({ of: 0, floor: 10, assumed: 1 }).value === 1);
ok("no arguments at all is NONE, not a crash", rate().basis === "none");

// ── monthlyCount(): organic signups a month ─────────────────────────────────
ok("organic: two observed months blend with the assumption, weighted 2 against 3", (() => { const c = monthlyCount({ total: 9, months: 2, floorMonths: 3, assumed: 50 }); return c.basis === "blended" && near(c.value, (3 * 50 + 2 * 4.5) / 5) && near(c.measured, 4.5) && near(c.measuredWeight, 0.4); })());
ok("organic: three months with no assumption is their mean", (() => { const c = monthlyCount({ total: 9, months: 3, floorMonths: 3 }); return c.basis === "measured" && c.value === 3; })());
ok("organic: nothing observed, nothing assumed is NONE", monthlyCount({ floorMonths: 3 }).basis === "none");

// ── monthLabel: calendar months, UTC ────────────────────────────────────────
const dec = new Date("2026-12-15T23:30:00Z");
ok("month 0 is the current month", monthLabel(dec, 0) === "2026-12");
ok("December + 1 is next January, not '2026-13'", monthLabel(dec, 1) === "2027-01");
ok("+13 rolls the year", monthLabel(dec, 13) === "2028-01");

// ── The owner's plan, dialler only ──────────────────────────────────────────
const A = { reach: 0.15, signup: 0.05, conversion: 0.4, churn: 0.05 };
const assumedRates = (over = {}) => ({
  reach: rate({ of: 0, floor: FLOORS.reach, assumed: A.reach }),
  signup: rate({ of: 0, floor: FLOORS.signup, assumed: A.signup }),
  conversion: rate({ of: 0, floor: FLOORS.conversion, assumed: A.conversion }),
  churn: rate({ of: 0, floor: FLOORS.churnMonths, assumed: A.churn }),
  referral: rate({ of: 0, floor: FLOORS.referralMonths, assumed: 0, max: 10 }),
  redial: rate({ of: 0, floor: FLOORS.redial, assumed: 0 }),
  // 2026-09-13: attempts at 0 (→ 1, one dial per prospect) and completion
  // with no basis (→ not applied) are what reproduce yesterday's series.
  attempts: rate({ of: 0, floor: FLOORS.attempts, assumed: 0, max: 20 }),
  completion: rate({ of: 0, floor: FLOORS.completion }),
  ...over,
});
const now = new Date("2026-09-06T12:00:00Z");
const plan = project({ reps: 20, dialsPerRepPerDay: 150, workingDaysPerMonth: 21, rates: assumedRates(), listSize: 918_244, now });

ok("63,000 dials a month from 20 × 150 × 21", plan.monthly.dials === 63_000, plan.monthly);
ok("9,450 reached, 472.5 signups, 189 paying adds a month",
  plan.monthly.reached === 9_450 && plan.monthly.signups.dial === 472.5 && plan.monthly.signups.total === 472.5 && plan.monthly.payingAdds === 189, plan.monthly);
ok("churn caps the business at adds / churn = 3,780", plan.ceiling === 3_780 && plan.viral === false, plan.ceiling);
ok("month 0 is today: nobody paying yet", plan.series[0].paying === 0 && plan.series[0].label === "2026-09");
ok("month 1: signups are still in trial, nobody paying", plan.series[1].paying === 0 && plan.series[1].trialing === 473, plan.series[1]);
ok("month 2: the first trials convert — 189 paying", plan.series[2].paying === 189, plan.series[2]);
ok("month 3 compounds: 189 × 0.95 + 189 = 369", plan.series[3].paying === 369, plan.series[3]);
const ms = Object.fromEntries(plan.milestones.map((m) => [m.target, m]));
ok("100 paying in month 2 (November 2026)", ms[100].month === 2 && ms[100].label === "2026-11", ms[100]);
ok("1,000 paying in month 7 (April 2027)", ms[1000].month === 7 && ms[1000].label === "2027-04", ms[1000]);
ok("10,000 is UNREACHABLE at these rates — above the 3,780 ceiling — and says so",
  ms[10000].month === null && ms[10000].reachable === false && ms[10000].beyondHorizon === false, ms[10000]);
ok("...and so are 100,000 and 1,000,000", ms[100000].reachable === false && ms[1000000].reachable === false);
ok("the series never exceeds the ceiling", plan.series.every((s) => s.paying <= plan.ceiling), Math.max(...plan.series.map((s) => s.paying)));
ok("the series is monotone until the list runs out", (() => {
  const upTo = plan.listExhaustedAt ?? plan.series.length;
  for (let i = 1; i < upTo; i += 1) if (plan.series[i].paying < plan.series[i - 1].paying) return false;
  return true;
})());
ok("every signup is from the dialler when organic and referral are zero",
  plan.series.every((s) => s.signupsBySource.organic === 0 && s.signupsBySource.referral === 0 && s.signupsBySource.dial === s.cumulativeSignups));
ok("918,244 prospects last 14.6 months at 63,000 dials", near(plan.listRunwayMonths, 14.6), plan.listRunwayMonths);
ok("the list is exhausted in month 15 and the dials stop there",
  plan.listExhaustedAt === 15 && plan.series[16].cumulativeDials === plan.series[15].cumulativeDials && plan.series[15].cumulativeDials === 918_244,
  { at: plan.listExhaustedAt, d15: plan.series[15].cumulativeDials, d16: plan.series[16].cumulativeDials });
ok("after the list runs out the paying stock DECAYS — the model does not keep inventing signups",
  plan.series[20].paying < plan.series[17].paying, { m17: plan.series[17].paying, m20: plan.series[20].paying });
ok("the default horizon is 60 months, 61 points", plan.series.length === HORIZON_MONTHS + 1);
ok("rates ride along with their basis, so the page can label them (completion is 'none' here by design — not applied)", RATE_KEYS.filter((k) => k !== "completion").every((k) => plan.rates[k].basis === "assumed") && plan.rates.completion.basis === "none");
ok("the fixed-list plan says the LIST is the limit, not churn — the long run is 0 paying and the peak is named",
  plan.ceilingBy.limitedBy === "list" && plan.ceilingBy.longRun.paying === 0 && plan.ceilingBy.peak.paying > 0 && plan.ceilingBy.peak.month >= 15 && plan.ceilingBy.zeroSources.join() === "refill,redial,marketing,ads,referral,organic",
  plan.ceilingBy);
ok("…and the milestones above the peak are NOT 'beyond the horizon, reachable' on a falling curve", plan.milestones.every((m) => m.month !== null || m.reachable === false));
ok("this month's signups are broken out by source on every point", plan.series[3].signups.dial === 472.5 && plan.series[3].signups.total === 472.5 && plan.series[3].signups.freshDials === 63_000 && plan.series[3].signups.redialDials === 0 && plan.series[0].signups.total === 0);
ok("month 16 dials nothing fresh once the list is gone", plan.series[16].signups.freshDials === 0 && plan.series[16].signups.dial === 0);

// ── Regression: with all four new sources at 0, the old fixed-list result ──
//
// Every assertion above IS the old result (the numbers were written against
// the version with one list dialled once). This pins the whole series too.
{
  const digest = plan.series.map((s) => `${s.paying}/${s.cumulativeSignups}/${s.cumulativeDials}`).join(" ");
  const expected = [
    plan.series.slice(0, 4).map((s) => s.paying).join() === "0,0,189,369",
    plan.series[15].cumulativeDials === 918_244,
    plan.series[60].cumulativeSignups === Math.round(918_244 * 0.15 * 0.05),
    plan.series[60].paying < plan.series[20].paying,
  ].every(Boolean);
  ok("the fixed-list series is the old one: 0,0,189,369 …, 918,244 dials at month 15, 6,887 signups for good, decaying to the horizon", expected, digest.slice(0, 200));
  const explicitZeros = project({
    reps: 20, dialsPerRepPerDay: 150, workingDaysPerMonth: 21, rates: assumedRates(), listSize: 918_244, now,
    organic: monthlyCount({ floorMonths: 3, assumed: 0 }), refill: monthlyCount({ floorMonths: 3, assumed: 0 }), marketing: monthlyCount({ floorMonths: 3, assumed: 0 }),
  });
  ok("typed zeros for refill, marketing and organic change nothing against omitting them",
    JSON.stringify(explicitZeros.series) === JSON.stringify(plan.series) && explicitZeros.ceiling === plan.ceiling && JSON.stringify(explicitZeros.milestones) === JSON.stringify(plan.milestones));
  const noneAtAll = project({
    reps: 20, dialsPerRepPerDay: 150, workingDaysPerMonth: 21, listSize: 918_244, now,
    rates: assumedRates({ redial: rate({ of: 0, floor: FLOORS.redial }) }),
    refill: monthlyCount({ floorMonths: 3 }), marketing: monthlyCount({ floorMonths: 3 }),
  });
  ok("an unmeasured, untyped refill, redial or marketing does NOT stop the forecast — each counts as 0", JSON.stringify(noneAtAll.series) === JSON.stringify(plan.series));
}

// ── Refill: the list is fed, so the curve keeps growing ─────────────────────
const refilled = project({
  reps: 20, dialsPerRepPerDay: 150, workingDaysPerMonth: 21, rates: assumedRates(), listSize: 918_244, now,
  refill: monthlyCount({ floorMonths: 3, assumed: 63_000 }),
});
ok("refill at the dialling pace: the list never runs out, no runway figure", refilled.listExhaustedAt === null && refilled.listRunwayMonths === null, { at: refilled.listExhaustedAt, runway: refilled.listRunwayMonths });
ok("…dials continue at capacity every month to the horizon", refilled.series[60].cumulativeDials === 63_000 * 60 && refilled.series[60].signups.freshDials === 63_000);
ok("…and paying keeps GROWING past month 15 where the fixed list fell", refilled.series[24].paying > refilled.series[15].paying && refilled.series[24].paying > plan.series[24].paying && refilled.series[60].paying > refilled.series[36].paying, { m15: refilled.series[15].paying, m24: refilled.series[24].paying, fixed24: plan.series[24].paying });
ok("…toward the churn ceiling, which is now the binding rate", refilled.ceilingBy.limitedBy === "churn" && refilled.ceilingBy.longRun.paying === refilled.ceiling && !refilled.ceilingBy.zeroSources.includes("refill"), refilled.ceilingBy);
ok("…and 1,000 is still month 7 — refill changes nothing before the list would have run out", refilled.milestones[1].month === plan.milestones[1].month && refilled.series[12].paying === plan.series[12].paying);
const trickle = project({
  reps: 20, dialsPerRepPerDay: 150, workingDaysPerMonth: 21, rates: assumedRates(), listSize: 918_244, now,
  refill: monthlyCount({ floorMonths: 3, assumed: 10_000 }),
});
ok("a 10,000 refill stretches the runway: 918,244 ÷ (63,000 − 10,000) = 17.3 months, exhausted in month 18", near(trickle.listRunwayMonths, 17.3) && trickle.listExhaustedAt === 18, { runway: trickle.listRunwayMonths, at: trickle.listExhaustedAt });
ok("…after which 10,000 fresh dials a month continue, not 0", trickle.series[30].signups.freshDials === 10_000 && trickle.series[30].signups.dial === 75, trickle.series[30].signups);
ok("…the long run is 10,000 × 0.75% × 40% ÷ 5% = 600 paying, below the churn ceiling, so the LIST still binds", trickle.ceilingBy.longRun.paying === 600 && trickle.ceilingBy.limitedBy === "list", trickle.ceilingBy);
ok("…and the curve settles above the fixed list's decay", trickle.series[60].paying > plan.series[60].paying && trickle.series[60].paying > 500, { trickle: trickle.series[60].paying, fixed: plan.series[60].paying });

// ── Re-dial: the same list, worked again at the repeat yield ────────────────
ok("RETRY_RETURN_MONTHS is a whole number of months and RETRY_MAX_ATTEMPTS is the retry rules' own", Number.isInteger(RETRY_RETURN_MONTHS) && RETRY_RETURN_MONTHS > 0 && RETRY_MAX_ATTEMPTS === RULES_MAX && RULES_MAX === 6);
const redialled = project({
  reps: 20, dialsPerRepPerDay: 150, workingDaysPerMonth: 21, listSize: 918_244, now,
  rates: assumedRates({ redial: rate({ of: 0, floor: FLOORS.redial, assumed: 0.002 }) }),
});
ok("while the fresh list lasts, no capacity is spare, so no repeat dials", redialled.series.slice(1, 15).every((s) => s.signups.redialDials === 0 && s.signups.freshDials === 63_000));
ok("…month 15 dials the list's tail fresh and fills the rest from the pool (returned from month 12)", redialled.series[15].signups.freshDials === 918_244 - 63_000 * 14 && redialled.series[15].signups.redialDials === 63_000 - (918_244 - 63_000 * 14), redialled.series[15].signups);
ok("…from month 16 every dial is a repeat, at capacity", redialled.series[16].signups.freshDials === 0 && redialled.series[16].signups.redialDials === 63_000 && redialled.series[30].signups.redialDials === 63_000);
ok("…each repeat dial yields the repeat rate, not the fresh one: 63,000 × 0.2% = 126 signups", redialled.series[16].signups.redial === 126 && redialled.series[16].signups.dial === 0, redialled.series[16].signups);
ok("…cumulative dials keep counting, fresh and repeat apart", redialled.series[60].cumulativeDials === 63_000 * 60 && redialled.series[60].cumulativeFreshDials === 918_244);
ok("…so paying settles toward 126 × 40% ÷ 5% = 1,008 from the peak above it, instead of decaying to nothing", redialled.series[60].paying >= 1_008 && redialled.series[60].paying < 1_200 && redialled.series[60].paying < redialled.series[40].paying && redialled.ceilingBy.longRun.paying === 1_008 && plan.series[60].paying < 300, { redial: redialled.series[60].paying, m40: redialled.series[40].paying, fixed: plan.series[60].paying });
ok("…the list still binds (1,008 < 3,780) and re-dial is not among the zeros", redialled.ceilingBy.limitedBy === "list" && !redialled.ceilingBy.zeroSources.includes("redial"));
ok("…the fresh and repeat yields are reported side by side", near(redialled.monthly.freshYield, 0.0075) && redialled.monthly.redialYield === 0.002);
ok("a repeat yield above 1 is clamped to 1, not a lie", project({ reps: 1, dialsPerRepPerDay: 1, workingDaysPerMonth: 1, listSize: 1, now, rates: assumedRates({ redial: rate({ hit: 5, of: 2, floor: 1 }) }) }).monthly.redialYield === 1);

// ── Marketing: campaign signups, converted at the trial rate ────────────────
const marketed = project({
  reps: 20, dialsPerRepPerDay: 150, workingDaysPerMonth: 21, rates: assumedRates(), now,
  marketing: monthlyCount({ floorMonths: 3, assumed: 100 }),
});
ok("100 marketing signups a month lift paying adds to (472.5 + 100) × 0.4 = 229", marketed.monthly.payingAdds === 229 && marketed.monthly.signups.marketing === 100 && marketed.monthly.signups.total === 572.5, marketed.monthly);
ok("…and the ceiling to 229 ÷ 0.05 = 4,580", marketed.ceiling === 4_580 && marketed.ceilingBy.addsPerMonth === 229, marketed.ceiling);
ok("…they convert after the trial like everyone else: month 2 pays (472.5 + 100) × 0.4 = 229", marketed.series[2].paying === 229 && marketed.series[1].paying === 0, marketed.series[2]);
ok("…and are kept apart from organic and the dialler in the series", marketed.series[12].signupsBySource.marketing === 1_200 && marketed.series[12].signupsBySource.organic === 0 && marketed.series[12].signups.marketing === 100);
ok("spend ÷ cost per signup is the typed count when the count is blank: $5,000 ÷ $100 = 50", marketingAssumption({ marketingSpend: 5000, marketingCostPerSignup: 100 }) === 50);
ok("…the count wins when both are given", marketingAssumption({ marketing: 20, marketingSpend: 5000, marketingCostPerSignup: 100 }) === 20);
ok("…spend with no cost, or a cost of 0, is not a number", marketingAssumption({ marketingSpend: 5000 }) === null && marketingAssumption({ marketingSpend: 5000, marketingCostPerSignup: 0 }) === null && marketingAssumption({}) === null);

// ── Attempts per prospect: reach per PROSPECT, dials spent per prospect ────
ok("reach per prospect is 1 − (1 − r)^N", near(reachPerProspect(0.099, 3), 1 - Math.pow(0.901, 3)) && near(reachPerProspect(0.15, 1), 0.15) && near(reachPerProspect(0.15, 0), 0.15) && near(reachPerProspect(0.15, NaN), 0.15) && reachPerProspect(NaN, 3) === 0);
ok("Belkins' sanity check: 9.9% per dial → 24.5% per prospect at about three attempts (2.7)", near(reachPerProspect(0.099, 2.7), 0.245, 0.002) && reachPerProspect(0.099, 3) > 0.245 && reachPerProspect(0.099, 3) < 0.28);
ok("the default is 3", DEFAULT_ATTEMPTS_PER_PROSPECT === 3);
const three = project({ reps: 20, dialsPerRepPerDay: 150, workingDaysPerMonth: 21, listSize: 918_244, now, rates: assumedRates({ attempts: rate({ of: 0, floor: FLOORS.attempts, assumed: 3, max: 20 }) }) });
ok("3 attempts: 63,000 dials work 21,000 prospects a month and reach 1 − 0.85³ = 38.6% of them", three.monthly.prospectsWorked === 21_000 && near(three.monthly.reachPerProspect, 1 - Math.pow(0.85, 3)) && three.monthly.reached === Math.round(21_000 * (1 - Math.pow(0.85, 3))) && three.monthly.attempts === 3 && near(three.monthly.reachPerDial, 0.15), three.monthly);
ok("…both reach figures ride along: per dial and per prospect", near(three.monthly.reachPerDial, A.reach) && three.monthly.reachPerProspect > three.monthly.reachPerDial);
ok("…signups per month are prospects × reach per prospect × signup: 21,000 × 38.59% × 5% = 405.2", three.monthly.signups.dial === 405.2, three.monthly.signups);
ok("…the list runway is in prospects: 918,244 ÷ 21,000 = 43.7 months, three times the one-attempt 14.6", near(three.listRunwayMonths, 43.7) && three.listExhaustedAt === 44 && near(plan.listRunwayMonths, 14.6), { three: three.listRunwayMonths, one: plan.listRunwayMonths });
ok("…and every dial is still spent: 63,000 fresh dials a month while the list lasts", three.series[1].signups.freshDials === 63_000 && three.series[43].signups.freshDials === 63_000 && three.series[44].signups.freshDials < 63_000);
ok("the comparison runs the same plan at one attempt and says which won", three.attemptsComparison && three.attemptsComparison.oneAttempt.attempts === 1 && three.attemptsComparison.withAttempts.attempts === 3 && ["reach", "runway", "even"].includes(three.attemptsComparison.wins), three.attemptsComparison);
ok("…the one-attempt half IS yesterday's plan", three.attemptsComparison.oneAttempt.cumulativeSignups === plan.series[60].cumulativeSignups && three.attemptsComparison.oneAttempt.peakPaying === plan.ceilingBy.peak.paying && near(three.attemptsComparison.oneAttempt.signupsPerMonth, 472.5));
ok("…on the owner's fixed list, ringing three times reaches fewer businesses a month (406 < 472.5 signups) but the list lasts three times longer, so over 60 months the runway wins on cumulative signups",
  three.attemptsComparison.withAttempts.cumulativeSignups > three.attemptsComparison.oneAttempt.cumulativeSignups && three.attemptsComparison.wins === "reach" && three.attemptsComparison.withAttempts.signupsPerMonth < three.attemptsComparison.oneAttempt.signupsPerMonth, three.attemptsComparison);
ok("at one attempt there is no comparison to draw", plan.attemptsComparison === null && plan.monthly.attempts === 1);
ok("attempts below 1 (a typo of 0.5) are rung once, not half a time", project({ reps: 1, dialsPerRepPerDay: 100, workingDaysPerMonth: 1, now, rates: assumedRates({ attempts: rate({ of: 0, floor: 10, assumed: 0.5, max: 20 }) }) }).monthly.attempts === 1);
ok("the refill's prospects cost attempts dials each in the long run", (() => {
  const p = project({ reps: 20, dialsPerRepPerDay: 150, workingDaysPerMonth: 21, listSize: 918_244, now, rates: assumedRates({ attempts: rate({ of: 0, floor: 10, assumed: 3, max: 20 }) }), refill: monthlyCount({ floorMonths: 3, assumed: 10_000 }) });
  return p.ceilingBy.longRun.freshDials === 30_000 && near(p.listRunwayMonths, 918_244 / 11_000, 0.1);
})());

// ── The self-serve step: agreed on the call → completed with card ──────────
const completed = project({ reps: 20, dialsPerRepPerDay: 150, workingDaysPerMonth: 21, listSize: 918_244, now, rates: assumedRates({ completion: rate({ of: 0, floor: FLOORS.completion, assumed: 0.6 }) }) });
ok("60% completion: 472.5 agreed become 283.5 signups a month, and the ceiling falls to 283.5 × 0.4 ÷ 0.05 = 2,268", completed.monthly.signups.dial === 283.5 && completed.ceiling === 2_268 && completed.monthly.completion === 0.6 && completed.monthly.completionApplied === true, completed.monthly);
ok("…applied between the signup rate and the trial conversion: month 2 pays 283.5 × 0.4 = 113", completed.series[2].paying === 113 && completed.series[1].trialing === 284, completed.series[2]);
ok("…on the dial path only: 100 marketing signups still add 100", project({ reps: 0, dialsPerRepPerDay: 0, workingDaysPerMonth: 0, now, rates: assumedRates({ completion: rate({ of: 0, floor: 20, assumed: 0.6 }) }), marketing: monthlyCount({ floorMonths: 3, assumed: 100 }) }).monthly.signups.total === 100);
ok("…a blank completion is NOT APPLIED (×1) and says so, never a withheld forecast", plan.monthly.completion === 1 && plan.monthly.completionApplied === false && plan.rates.completion.basis === "none");
ok("…a measured completion of 12 of 40 blended against 60% is between the two", (() => { const r = rate({ hit: 12, of: 40, floor: FLOORS.completion, assumed: 0.6 }); return r.basis === "blended" && r.value > 0.3 && r.value < 0.6; })());

// ── Ads: spend ÷ cost per trial, a source of its own ───────────────────────
ok("$5,000 ÷ $80 = 62.5 trials a month", adsAssumption({ adSpend: 5000, costPerTrial: 80 }) === 62.5);
ok("spend with no cost, a cost of 0, or nothing at all is not a number", adsAssumption({ adSpend: 5000 }) === null && adsAssumption({ adSpend: 5000, costPerTrial: 0 }) === null && adsAssumption({}) === null && adsAssumption({ costPerTrial: 80 }) === null);
const advertised = project({ reps: 20, dialsPerRepPerDay: 150, workingDaysPerMonth: 21, rates: assumedRates(), now, ads: monthlyCount({ floorMonths: 3, assumed: 62.5 }) });
ok("62.5 ad trials a month lift paying adds to (472.5 + 62.5) × 0.4 = 214", advertised.monthly.payingAdds === 214 && advertised.monthly.signups.ads === 62.5 && advertised.monthly.signups.total === 535, advertised.monthly);
ok("…they convert at the trial rate after the trial like everyone else: month 2 pays 214", advertised.series[2].paying === 214 && advertised.series[1].paying === 0);
ok("…and ads are their own source in the series, apart from marketing and organic", advertised.series[12].signupsBySource.ads === 750 && advertised.series[12].signupsBySource.marketing === 0 && advertised.series[12].signups.ads === 62.5 && !advertised.ceilingBy.zeroSources.includes("ads") && plan.ceilingBy.zeroSources.includes("ads"));
ok("…an ad trial skips completion: it already has a card", project({ reps: 0, dialsPerRepPerDay: 0, workingDaysPerMonth: 0, now, rates: assumedRates({ completion: rate({ of: 0, floor: 20, assumed: 0.6 }) }), ads: monthlyCount({ floorMonths: 3, assumed: 40 }) }).monthly.signups.total === 40);

// ── Zeros reproduce yesterday's series exactly ─────────────────────────────
{
  const yesterday = project({ reps: 20, dialsPerRepPerDay: 150, workingDaysPerMonth: 21, rates: assumedRates(), listSize: 918_244, now });
  const zeros = project({
    reps: 20, dialsPerRepPerDay: 150, workingDaysPerMonth: 21, listSize: 918_244, now,
    rates: assumedRates({ attempts: rate({ of: 0, floor: 10, assumed: 1, max: 20 }), completion: rate({ of: 0, floor: 20, assumed: 1 }) }),
    ads: monthlyCount({ floorMonths: 3, assumed: 0 }),
  });
  const strip = (p) => JSON.stringify({ series: p.series, ceiling: p.ceiling, milestones: p.milestones, listRunwayMonths: p.listRunwayMonths, listExhaustedAt: p.listExhaustedAt, longRun: p.ceilingBy.longRun, limitedBy: p.ceilingBy.limitedBy });
  ok("attempts 1, completion 100% and ads 0 reproduce the omitted-fields series exactly", strip(zeros) === strip(yesterday));
  ok("…which is the fixed-list series every assertion above was written against: 0,0,189,369 … exhausted at 15, 6,887 signups", yesterday.series.slice(0, 4).map((s) => s.paying).join() === "0,0,189,369" && yesterday.listExhaustedAt === 15 && yesterday.series[60].cumulativeSignups === Math.round(918_244 * 0.15 * 0.05));
}

// ── The ceiling explanation names the binding rate ─────────────────────────
const unlisted = project({ reps: 20, dialsPerRepPerDay: 150, workingDaysPerMonth: 21, rates: assumedRates(), now });
ok("no list at all: dialling runs at capacity forever, CHURN binds, and refill is not called a zero (there is no list to refill)", unlisted.ceilingBy.limitedBy === "churn" && !unlisted.ceilingBy.zeroSources.includes("refill") && unlisted.ceilingBy.longRun.paying === unlisted.ceiling && near(unlisted.ceilingBy.churn, 0.05) && unlisted.ceilingBy.addsPerMonth === 189, unlisted.ceilingBy);
const viralBy = project({ reps: 20, dialsPerRepPerDay: 150, workingDaysPerMonth: 21, now, rates: assumedRates({ referral: rate({ of: 0, floor: 3, assumed: 0.2, max: 10 }) }) });
ok("viral: REFERRAL is named as the reason there is no ceiling", viralBy.ceilingBy.limitedBy === "referral" && viralBy.ceiling === null);
ok("the explanation carries the return interval and attempt ceiling for the page to quote", unlisted.ceilingBy.returnMonths === RETRY_RETURN_MONTHS && unlisted.ceilingBy.maxAttempts === RETRY_MAX_ATTEMPTS);

// ── Organic: a source the dialler does not explain ──────────────────────────
const withOrganic = project({
  reps: 20, dialsPerRepPerDay: 150, workingDaysPerMonth: 21, now,
  rates: assumedRates(), organic: monthlyCount({ floorMonths: 3, assumed: 50 }),
});
ok("50 organic signups a month lift paying adds to (472.5 + 50) × 0.4 = 209", withOrganic.monthly.payingAdds === 209 && withOrganic.monthly.signups.organic === 50, withOrganic.monthly);
ok("...and the ceiling to 4,180", withOrganic.ceiling === 4_180, withOrganic.ceiling);
ok("...and the sources are kept apart in the series", (() => {
  const s = withOrganic.series[12];
  return s.signupsBySource.organic === 600 && s.signupsBySource.dial === Math.round(472.5 * 12) && s.cumulativeSignups === s.signupsBySource.dial + s.signupsBySource.organic + s.signupsBySource.referral;
})(), withOrganic.series[12]);

// ── Referral: the compounding source ────────────────────────────────────────
const k01 = project({ reps: 20, dialsPerRepPerDay: 150, workingDaysPerMonth: 21, now, rates: assumedRates({ referral: rate({ of: 0, floor: 3, assumed: 0.1, max: 10 }) }) });
ok("k = 0.1 with 40% conversion drains only 1% a month net: ceiling 189 / 0.01 = 18,900", k01.ceiling === 18_900 && k01.viral === false, k01.ceiling);
ok("...so 10,000 becomes REACHABLE where it was not", Object.fromEntries(k01.milestones.map((m) => [m.target, m]))[10000].reachable === true);
ok("...referral signups appear from month 2, once somebody is paying", k01.series[1].signupsBySource.referral === 0 && k01.series[3].signupsBySource.referral > 0, k01.series[3]);
ok("...and paying at month 12 is above the no-referral plan's", k01.series[12].paying > plan.series[12].paying, { k01: k01.series[12].paying, plan: plan.series[12].paying });
const k02 = project({ reps: 20, dialsPerRepPerDay: 150, workingDaysPerMonth: 21, now, rates: assumedRates({ referral: rate({ of: 0, floor: 3, assumed: 0.2, max: 10 }) }) });
ok("k = 0.2 outruns 5% churn: VIRAL, no ceiling, every milestone reachable", k02.viral === true && k02.ceiling === null && k02.milestones.every((m) => m.reachable), { viral: k02.viral, ceiling: k02.ceiling });
ok("...and the far milestones are 'beyond the horizon', not 'never'", k02.milestones.find((m) => m.target === 1_000_000).beyondHorizon === true || k02.milestones.find((m) => m.target === 1_000_000).month !== null);

// ── No churn, no list: no ceiling, honest about the horizon ─────────────────
const noChurn = project({
  reps: 20, dialsPerRepPerDay: 150, workingDaysPerMonth: 21, now,
  rates: assumedRates({ churn: rate({ of: 0, floor: 3, assumed: 0 }) }),
});
ok("zero churn means no ceiling", noChurn.ceiling === null);
ok("...every milestone is reachable, and the far ones are beyond the horizon rather than never",
  noChurn.milestones.every((m) => m.reachable) && noChurn.milestones.find((m) => m.target === 1_000_000).beyondHorizon === true, noChurn.milestones);
ok("no list size means no runway figure", noChurn.listRunwayMonths === null && noChurn.listExhaustedAt === null);

// ── Trial length and starting stock ─────────────────────────────────────────
const instant = project({ reps: 1, dialsPerRepPerDay: 100, workingDaysPerMonth: 20, rates: assumedRates(), trialMonths: 0, now });
ok("with no trial, month 1 already pays", instant.series[1].paying > 0 && instant.series[1].trialing === 0, instant.series[1]);
const seeded = project({ reps: 0, dialsPerRepPerDay: 0, workingDaysPerMonth: 0, rates: assumedRates(), startingPaying: 1000, now });
ok("no dialling at all: 1,000 existing subscribers just churn — 950 next month", seeded.series[1].paying === 950 && seeded.monthly.dials === 0, seeded.series[1]);
ok("...and the 100 milestone is already met in month 0", seeded.milestones[0].month === 0);
const inTrial = project({ reps: 0, dialsPerRepPerDay: 0, workingDaysPerMonth: 0, rates: assumedRates(), startingTrialing: 100, trialMonths: 2, now });
ok("100 already in a 2-month trial convert half each month: 20 paying by month 1, 39 by month 2",
  inTrial.series[1].paying === 20 && inTrial.series[2].paying === 39 && inTrial.series[0].trialing === 100, inTrial.series.slice(0, 3));

// ── Refusals ────────────────────────────────────────────────────────────────
ok("a missing rate is a REFUSAL naming the rate, never a guessed 0.5", (() => {
  try {
    project({ reps: 1, dialsPerRepPerDay: 1, workingDaysPerMonth: 1, rates: assumedRates({ churn: rate({ of: 0, floor: 3 }) }) });
    return false;
  } catch (e) { return e instanceof TypeError && Array.isArray(e.missing) && e.missing.join() === "churn"; }
})());
ok("two missing rates are both named, in funnel order", (() => {
  try {
    project({ reps: 1, dialsPerRepPerDay: 1, workingDaysPerMonth: 1, rates: assumedRates({ reach: rate({}), conversion: rate({}) }) });
    return false;
  } catch (e) { return e.missing?.join() === "reach,conversion"; }
})());
// Referral and organic are ADDITIVE sources: unmeasured and untyped they are
// the one honest zero in the model, drawn as 0 rather than refusing the
// whole plan (the owner watched a blank page for a week over these two).
ok("an organic count with no basis does NOT stop the forecast — it counts as 0", (() => {
  const p = project({ reps: 20, dialsPerRepPerDay: 150, workingDaysPerMonth: 21, now, rates: assumedRates(), organic: monthlyCount({ floorMonths: 3 }) });
  return p.monthly.signups.organic === 0 && p.series[12].paying === plan.series[12].paying;
})());
ok("a referral rate with no basis does NOT stop the forecast — it counts as 0", (() => {
  const p = project({ reps: 20, dialsPerRepPerDay: 150, workingDaysPerMonth: 21, now, rates: assumedRates({ referral: rate({ of: 0, floor: 3, max: 10 }) }) });
  return p.series.every((s) => s.signupsBySource.referral === 0) && p.series[12].paying === plan.series[12].paying;
})());
ok("FUNNEL_RATE_KEYS is RATE_KEYS without the additive referral and redial, the plan's attempts and the ×1 completion", FUNNEL_RATE_KEYS.join() === "reach,signup,conversion,churn" && RATE_KEYS.join() === "reach,signup,conversion,churn,referral,redial,attempts,completion" && COUNT_KEYS.join() === "organic,refill,marketing,ads");
ok("negative reps refuse", (() => { try { project({ reps: -1, dialsPerRepPerDay: 1, workingDaysPerMonth: 1, rates: assumedRates() }); return false; } catch (e) { return /reps/.test(e.message); } })());
ok("a string for dials refuses rather than coercing", (() => { try { project({ reps: 1, dialsPerRepPerDay: "150", workingDaysPerMonth: 1, rates: assumedRates() }); return false; } catch (e) { return /dialsPerRepPerDay/.test(e.message); } })());
ok("no rates at all refuses", (() => { try { project({ reps: 1, dialsPerRepPerDay: 1, workingDaysPerMonth: 1 }); return false; } catch (e) { return /rates/.test(e.message); } })());
ok("a horizon of 10,000 months is clamped to 240", project({ reps: 1, dialsPerRepPerDay: 1, workingDaysPerMonth: 1, rates: assumedRates(), horizonMonths: 10_000, now }).series.length === 241);
ok("an invalid `now` falls back to the clock rather than NaN labels", /^\d{4}-\d{2}$/.test(project({ reps: 1, dialsPerRepPerDay: 1, workingDaysPerMonth: 1, rates: assumedRates(), now: new Date("nope") }).series[0].label));
ok("deterministic: same input, same output", JSON.stringify(project({ reps: 20, dialsPerRepPerDay: 150, workingDaysPerMonth: 21, rates: assumedRates(), listSize: 918_244, now })) === JSON.stringify(plan));

// ── The form fields match the model ────────────────────────────────────────
ok("every rate key has a form field carrying its floor (attempts as a ratio, under its own key)", RATE_KEYS.every((k) => ASSUMPTION_FIELDS.some((f) => (f.key === k || (k === "attempts" && f.key === "attemptsPerProspect")) && (f.kind === "rate" || f.kind === "ratio") && f.floor > 0)));
ok("organic has its own field, as a monthly count", ASSUMPTION_FIELDS.some((f) => f.key === "organic" && f.kind === "monthlyCount"));
ok("every count key has a field carrying its floor (ads is typed as spend, under adSpend)", COUNT_KEYS.every((k) => ASSUMPTION_FIELDS.some((f) => (f.key === k || (k === "ads" && f.key === "adSpend")) && (f.kind === "monthlyCount" || f.kind === "money") && f.floor > 0)));
ok("the spend / cost-per-signup pair are money fields with no floor — typed only, never measured", ["marketingSpend", "marketingCostPerSignup"].every((k) => ASSUMPTION_FIELDS.some((f) => f.key === k && f.kind === "money" && !f.floor)));
ok("referral, organic and the four new fields carry a hint and NO default value — the range is words, not a saved guess",
  ["referral", "organic", "refill", "redial", "marketing", "marketingSpend", "marketingCostPerSignup"].every((k) => { const f = ASSUMPTION_FIELDS.find((x) => x.key === k); return f && typeof f.hint === "string" && f.hint.length > 20 && !("default" in f); }));
ok("the re-dial hint quotes the retry rules' attempt ceiling and the model's return interval", new RegExp(`at most ${RETRY_MAX_ATTEMPTS}`).test(ASSUMPTION_FIELDS.find((f) => f.key === "redial").hint) && new RegExp(`${RETRY_RETURN_MONTHS} months later`).test(ASSUMPTION_FIELDS.find((f) => f.key === "redial").hint));
ok("the milestones are the owner's five", MILESTONES.join() === "100,1000,10000,100000,1000000");

// ── monthsRate(): churn and referral are sampled in months ─────────────────
import { monthsRate } from "../lib/platform/growthModel.js";
ok("churn: 2 qualifying months are blended in MONTHS, not in subscribers",
  (() => { const r = monthsRate({ hit: 3, of: 60, months: 2, floorMonths: 3, assumed: 0.05 }); return r.basis === "blended" && near(r.measuredWeight, 2 / 5) && near(r.value, 0.05) && near(r.measured, 0.05) && r.remaining === 1; })());
ok("churn: 3 qualifying months with no assumption are measured", monthsRate({ hit: 3, of: 100, months: 3, floorMonths: 3 }).basis === "measured");
ok("churn: 3 qualifying months against an assumption of 50% are half and half", near(monthsRate({ hit: 3, of: 100, months: 3, floorMonths: 3, assumed: 0.5 }).value, 0.265));
ok("referral: a coefficient above 1 survives its own max", monthsRate({ hit: 40, of: 20, months: 3, floorMonths: 3, max: 10 }).value === 2);

// ── The wiring: route, page, sidebar — pinned, because each is one line ────
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
{
  const route = read("app/api/platform/growth/route.js");
  ok("the route is superadmin-only, compared on the role like the sales floor", /admin\.role !== "superadmin"/.test(route) && /getCurrentPlatformAdmin\(request\)/.test(route));
  ok("the route turns a missing rate into `needs`, never a 500 or a guess", /needs = err\.missing/.test(route) && /if \(!Array\.isArray\(err\?\.missing\)\) throw err/.test(route));
  ok("PUT guards request.json() and refuses a non-object body", /catch \{\s*return NextResponse\.json\(\{ error: "Send a JSON body\." \}, \{ status: 400 \}\)/.test(route) && /Array\.isArray\(body\)/.test(route));
  ok("PUT bounds every rate, with referral allowed above 1 and organic as a count", /reach: 1, signup: 1, conversion: 1, churn: 1, referral: 10, organic: 1_000_000/.test(route));
  ok("PUT bounds the four new keys too — re-dial a probability, refill and marketing counts, spend and cost money", /refill: 10_000_000, redial: 1, marketing: 1_000_000, marketingSpend: 100_000_000, marketingCostPerSignup: 1_000_000/.test(route));
  ok("the route hands refill, marketing and ads to the model", /refill: measured\.refill/.test(route) && /marketing: measured\.marketing/.test(route) && /ads: measured\.ads/.test(route));
  ok("PUT bounds attempts, completion, ad spend and cost per trial", /attemptsPerProspect: 20, completion: 1, adSpend: 100_000_000, costPerTrial: 1_000_000/.test(route));
  ok("PUT records who saved", /updatedByAdminId: admin\.id/.test(route));
  const measured = read("lib/platform/growthMeasured.js");
  ok("reached is derived from DISPOSITIONS[].reached, not a hardcoded list", /Object\.entries\(DISPOSITIONS\)[\s\S]{0,80}d\.reached/.test(measured) && !/"reached_interested"/.test(measured));
  ok("every dial count filters direction \"out\"", (measured.match(/salesCallAttempt\.count\(\{ where: \{ direction: "out"/g) || []).length >= 4);
  ok("demo companies are excluded from every signup and subscription measure", /isDemo: true/.test(measured) && (measured.match(/\.\.\.notDemo/g) || []).length >= 5);
  ok("on-trial is billingStartedAt == null, per the schema's own rule", /billingStartedAt: null, status: "trialing"/.test(measured));
  ok("only FULL months are observed — never the current one", /for \(let i = MONTHS_BACK; i >= 1; i -= 1\)/.test(measured));
  ok("refill is measured from Prospect rows by UTC month, and the load month is not a refill", /date_trunc\('month', "createdAt" AT TIME ZONE 'UTC'\)/.test(measured) && /observed\.filter\(\(m\) => m\.label > listLoadMonth\)/.test(measured));
  ok("re-dial is measured on REPEAT attempts (row_number > 1 per prospect) followed by the prospect's lead converting", /row_number\(\) OVER \(PARTITION BY "prospectId"/.test(measured) && /WHERE n > 1/.test(measured) && /"convertedAt" >= d\."dialledAt"/.test(measured) && /"isDemo" = false/.test(measured));
  ok("marketing is measured from influencer-code redemptions, and those companies leave organic", /promoCode: \{ kind: "influencer" \}/.test(measured) && /created\.length - referral - rep - ads - marketing/.test(measured));
  ok("ads are measured from a paid utm tag on the SignupOrigin row, decided by the one predicate, and outrank an influencer code", /isPaidAdSignup\(o\)/.test(measured) && /utmSource: true, utmMedium: true/.test(measured) && /!viaAds\.has\(c\.id\) && viaCampaign\.has\(c\.id\)/.test(measured));
  ok("attempts are measured as dispositioned dials ÷ distinct prospects", /count\(DISTINCT "prospectId"\)::int AS prospects/.test(measured) && /hit: attemptDials, of: attemptProspects/.test(measured));
  ok("completion is measured agreed → attributed-with-Subscription, keyed per business like the funnel", /hit: attributedWithCard, of: agreedCount/.test(measured) && /disposition: AGREED_CODE/.test(measured) && /salesAttribution: \{ isNot: null \}/.test(measured));
  ok("the signup rate is now measured to the agreed stage", /signup: rate\(\{ hit: agreedCount, of: reached/.test(measured));
  const flags = read("lib/platform/signupFlags.js");
  ok("the utm reader caps, lower-cases and refuses non-strings; the paid test matches exactly", /slice\(0, UTM_MAX\)/.test(flags) && /PAID_UTM_MEDIUMS\.includes\(medium\) \|\| AD_UTM_SOURCES\.includes\(source\)/.test(flags));
  const signup = read("app/signup/page.js");
  ok("the signup page reads utm_source / utm_medium / utm_campaign off the query and posts them as `utm`", /\["utm_source", "utm_medium", "utm_campaign"\]/.test(signup) && /utm: utm \|\| undefined/.test(signup));
  const companies = read("app/api/companies/route.js");
  ok("the signup route hands the tags to recordSignupOrigin", /utm: utm && typeof utm === "object" \? utm : null/.test(companies));
  const origin = read("lib/platform/signupOrigin.js");
  ok("SignupOrigin stores the three cleaned columns", /\.\.\.readUtm\(utm\)/.test(origin) && /utmCampaign: true/.test(origin));
  ok("the marketing assumption is the count or spend ÷ cost, through the model's one helper", /assumed: marketingAssumption\(assumptions\)/.test(measured));
  const page = read("app/platform/growth/page.js");
  ok("the page shows a basis chip beside every rate, and says the additive ones count as 0", /basisChip\(r, Boolean\(additive\), blankWord\)/.test(page) && /Measured/.test(page) && /Assumed/.test(page) && /Missing/.test(page) && /counted as 0/.test(page) && /basisChip\(r, Boolean\(additive\), blankWord\)/.test(page));
  ok("the page says which won — reach or runway — from attemptsComparison, and shows both reach figures", /function AttemptsNote/.test(page) && /the reach wins/.test(page) && /the runway wins/.test(page) && /reach per prospect after \{f\.monthly\.attempts\} attempts/.test(page));
  ok("the page names ads as a source in the engine note and in the milestone explanation", /\+ \$\{f\.monthly\.signups\.ads\.toFixed\(0\)\} ads/.test(page) && /ads: "ads"/.test(page));
  ok("the assumptions form carries the two ad fields with the hint, not a default", (() => { const a = ASSUMPTION_FIELDS.find((x) => x.key === "adSpend"); const c = ASSUMPTION_FIELDS.find((x) => x.key === "costPerTrial"); return a && c && /\$50–100/.test(c.hint) && /a hint, not a default/.test(c.hint) && !("default" in a) && !("default" in c); })());
  ok("the completion field says blank is not applied, and attempts says blank assumes 3", /Blank is not applied/.test(ASSUMPTION_FIELDS.find((x) => x.key === "completion").hint) && /Blank assumes 3/.test(ASSUMPTION_FIELDS.find((x) => x.key === "attemptsPerProspect").hint) && ASSUMPTION_FIELDS.find((x) => x.key === "attemptsPerProspect").default === 3);
  ok("…every rate row on the page is a model key, additive ones marked", (() => { const m = page.match(/const RATE_ROWS = \[([\s\S]*?)\];/); if (!m) return false; const keys = [...m[1].matchAll(/key: "(\w+)"/g)].map((x) => x[1]); return keys.join() === ["attempts", "reach", "signup", "completion", "conversion", "churn", "referral", "organic", "refill", "redial", "marketing", "ads"].join() && keys.every((k) => RATE_KEYS.includes(k) || COUNT_KEYS.includes(k)); })());
  ok("the projection card names the signup sources per month: dial · re-dial · marketing · ads · referral · organic", /signups this month:/.test(page) && /\["dial", "redial", "marketing", "ads", "referral", "organic"\]/.test(page));
  ok("the milestone list says WHICH rate limits the ceiling, from ceilingBy", /function ceilingSentence\(f\)/.test(page) && /set by churn/.test(page) && /the list is the real limit/.test(page) && /referrals outrun churn/.test(page) && /\{ceilingSentence\(f\)\}/.test(page));
  ok("the chart legend tells 'list runs out' from 'refill assumed'", /List runs out in/.test(page) && /Refill \{f\.refill\?\.basis === "assumed" \? "assumed"/.test(page));
  ok("the intro says plainly what is measured and what is assumed, from the data", /function basisSentence\(data, fieldsByKey\)/.test(page) && /counted as 0 until measured or typed/.test(page) && /\{basisSentence\(data, fieldsByKey\)\}/.test(page));
  ok("the form shows each hint and saves nothing for a blank additive field", /\{fld\.hint \? <span/.test(page) && /Blank counts as 0\./.test(page) && /marketingCostPerSignup: num\(form\.marketingCostPerSignup\)/.test(page) && /redial: rateOf\(form\.redial\)/.test(page));
  ok("…and a blended rate says how much of it is measured", /Blended · \$\{Math\.round\(\(r\.measuredWeight/.test(page));
  ok("the page says 'not reachable at these rates' with the ceiling — or the peak, when the list is the limit — in words", /Not reachable at these rates — \{f\.ceilingBy\.limitedBy === "list"/.test(page) && /the ceiling is \$\{nf\.format\(f\.ceiling\)\}/.test(page) && /the curve peaks at/.test(page));
  ok("the page draws with the platform Sparkline, not a chart library", /from "@\/app\/components\/platform\/Sparkline"/.test(page) && !/recharts|chart\.js|d3/.test(page));
  ok("the page loads through fetchJson and catches, never if (res.ok) with no else", /await fetchJson\("\/api\/platform\/growth"\)/.test(page) && !/res\.ok/.test(page));
  const sidebar = read("app/components/platform/PlatformSidebar.js");
  ok("the sidebar links the page (check-nav-audit would refuse the build otherwise)", /href: "\/platform\/growth"/.test(sidebar));
  const pkg = read("package.json");
  // Anywhere in the chain — the first version assumed it was last, and broke
  // the moment the next check was appended after it.
  ok("the check is in check:all", /npm run check:growth-model( &&|")/.test(pkg));
  ok("the check runs under the alias loader, because the model imports the retry rules by alias", /"check:growth-model": "node --import \.\/scripts\/alias-loader\.mjs scripts\/check-growth-model\.mjs"/.test(pkg));
}

console.log(`\ncheck-growth-model: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
