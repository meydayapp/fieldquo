// Executes lib/analytics/goal.js against the calendar's hostile edges.
import { deriveTargets, goalProgress, normaliseGoal } from "@/lib/analytics/goal";

let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`); } };
const near = (a, b, eps = 0.5) => Math.abs(a - b) <= eps;

console.log("\nderiveTargets");
const t = deriveTargets(520000);
ok("annual passes through", t.annual === 520000);
ok("monthly is annual/12", near(t.monthly, 43333.33));
ok("weekly is annual/52", near(t.weekly, 10000));
ok("null goal -> null", deriveTargets(null) === null);
ok("zero -> null (not targets of 0)", deriveTargets(0) === null);
ok("negative -> null", deriveTargets(-5) === null);
ok("garbage -> null", deriveTargets("abc") === null);

console.log("\nNo goal set");
ok("null annualGoal -> null progress", goalProgress({ annualGoal: null, revenueYtd: 1000 }) === null);
ok("missing everything -> null", goalProgress({}) === null);

console.log("\nMid-year, exactly on pace");
// July 2 in a 365-day year is day 183 ≈ 50.1% through. Half the goal by then = on pace.
const jul2 = new Date("2026-07-02T12:00:00Z");
const half = goalProgress({ annualGoal: 500000, revenueYtd: 250000, now: jul2 });
ok("~50% of the year elapsed", near(half.fractionOfYearElapsed, 0.5, 0.01), half.fractionOfYearElapsed);
ok("expectedByNow ~250k", near(half.expectedByNow, 250000, 1500), half.expectedByNow);
ok("aheadBy ~0", Math.abs(half.aheadBy) < 1500, half.aheadBy);
ok("reads as on pace", half.onPace === true);
ok("projects ~to goal", near(half.projectedYearEnd, 500000, 3000), half.projectedYearEnd);

console.log("\nBehind pace");
const behind = goalProgress({ annualGoal: 500000, revenueYtd: 180000, now: jul2 });
ok("aheadBy is negative", behind.aheadBy < 0, behind.aheadBy);
ok("not on pace", behind.onPace === false);
ok("projects under goal", behind.projectedVsGoal < 0, behind.projectedVsGoal);
ok("percentOfGoal is 36%", near(behind.percentOfGoal, 0.36, 0.001));
ok("percentOfExpected < 1", behind.percentOfExpected < 1);

console.log("\nAhead of pace");
const ahead = goalProgress({ annualGoal: 500000, revenueYtd: 320000, now: jul2 });
ok("aheadBy positive", ahead.aheadBy > 0);
ok("not (falsely) on pace", ahead.onPace === false);
ok("projects over goal", ahead.projectedVsGoal > 0);

console.log("\nThe same 36% is a disaster in November, triumph in February");
const feb = goalProgress({ annualGoal: 500000, revenueYtd: 180000, now: new Date("2026-02-14T12:00:00Z") });
const nov = goalProgress({ annualGoal: 500000, revenueYtd: 180000, now: new Date("2026-11-14T12:00:00Z") });
ok("February: ahead of pace", feb.aheadBy > 0, feb.aheadBy);
ok("November: behind pace", nov.aheadBy < 0, nov.aheadBy);
ok("same YTD, opposite verdict — the whole point", (feb.aheadBy > 0) && (nov.aheadBy < 0));

console.log("\nCalendar edges");
const jan1 = goalProgress({ annualGoal: 365000, revenueYtd: 2000, now: new Date("2026-01-01T12:00:00Z") });
ok("Jan 1 is day 1, ~1/365 elapsed", near(jan1.fractionOfYearElapsed, 1 / 365, 0.001), jan1.fractionOfYearElapsed);
ok("Jan 1 projection doesn't divide by zero", Number.isFinite(jan1.projectedYearEnd));
ok("Jan 1 projection is finite and positive", jan1.projectedYearEnd > 0);
const dec31 = goalProgress({ annualGoal: 365000, revenueYtd: 365000, now: new Date("2026-12-31T12:00:00Z") });
ok("Dec 31 ~ whole year elapsed", near(dec31.fractionOfYearElapsed, 1, 0.005), dec31.fractionOfYearElapsed);
ok("hit the goal exactly -> on pace", dec31.onPace === true);

console.log("\nLeap year uses 366");
// 2028 is a leap year. Day 183 (Jul 1) is 183/366, slightly under half.
const leap = goalProgress({ annualGoal: 366000, revenueYtd: 183000, now: new Date("2028-07-01T12:00:00Z") });
ok("fraction uses 366 not 365", near(leap.fractionOfYearElapsed, 183 / 366, 0.002), leap.fractionOfYearElapsed);

console.log("\nHostile revenue values");
ok("negative revenue clamps to 0", goalProgress({ annualGoal: 500000, revenueYtd: -50000, now: jul2 }).revenueYtd === 0);
ok("NaN revenue -> 0", goalProgress({ annualGoal: 500000, revenueYtd: NaN, now: jul2 }).revenueYtd === 0);
ok("zero revenue mid-year -> behind, not a crash", goalProgress({ annualGoal: 500000, revenueYtd: 0, now: jul2 }).aheadBy < 0);

console.log("\nnormaliseGoal");
ok("blank clears the goal", normaliseGoal("") === null);
ok("null clears", normaliseGoal(null) === null);
ok("zero clears (not a goal of 0)", normaliseGoal(0) === null);
ok("negative clears", normaliseGoal(-100) === null);
ok("rounds to whole dollars", normaliseGoal(499999.7) === 500000);
ok("caps a fat-fingered extra zero", normaliseGoal(5_000_000_000) === 100_000_000);
ok("a real goal passes", normaliseGoal(450000) === 450000);
ok("string number works", normaliseGoal("450000") === 450000);

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
