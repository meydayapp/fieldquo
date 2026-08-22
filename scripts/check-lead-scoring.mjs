// scripts/check-lead-scoring.mjs
//
//   npm run check:lead-scoring
//
// Whether the lead score is doing anything, checked the only way that counts:
// against leads that were actually won or lost.
//
// lib/leads/score.js is a hand-tuned weighted sum — ASAP timeline 25, emergency
// 20, plan PDF 12, photos up to 10 — and not one of those weights has ever been
// validated. These assertions are about the analysis not flattering the model.
import {
  buildTemperatureAnalysis,
  buildReasonAnalysis,
  buildScoreCalibration,
} from "../lib/analytics/leadScoring.js";

let pass = 0;
const failures = [];
const check = (label, ok) => {
  if (ok) { pass += 1; console.log(`  ok   ${label}`); }
  else { failures.push(label); console.log(`  FAIL ${label}`); }
};

const lead = (temperature, status, score, reasons = []) => ({
  temperature, status, score, scoreReasons: reasons,
});
const many = (n, ...args) => Array(n).fill(0).map(() => lead(...args));

console.log("\nA model that works\n");
{
  const leads = [
    ...many(8, "hot", "converted", 70),
    ...many(2, "hot", "lost", 65),
    ...many(4, "warm", "converted", 40),
    ...many(6, "warm", "lost", 35),
    ...many(1, "cold", "converted", 15),
    ...many(9, "cold", "lost", 10),
  ];
  const t = buildTemperatureAnalysis(leads);
  const band = (x) => t.bands.find((b) => b.temperature === x);
  check("hot converts at 80%", band("hot").conversionRate === 80);
  check("cold converts at 10%", band("cold").conversionRate === 10);
  check("the verdict is 'working'", t.verdict === "working");
  check("the summary states both numbers", /80%/.test(t.summary) && /10%/.test(t.summary));
}

console.log("\nA model that isn't separating anything\n");
{
  const leads = [
    ...many(5, "hot", "converted", 70),
    ...many(5, "hot", "lost", 65),
    ...many(5, "cold", "converted", 15),
    ...many(5, "cold", "lost", 10),
  ];
  const t = buildTemperatureAnalysis(leads);
  check("equal rates → not_predictive", t.verdict === "not_predictive");
  check("and it says so plainly", /not separating/.test(t.summary));
}

console.log("\nOpen leads are not losses\n");
{
  const leads = [
    ...many(3, "hot", "converted", 70),
    ...many(20, "hot", "new", 70),
    ...many(3, "hot", "contacted", 70),
  ];
  const t = buildTemperatureAnalysis(leads);
  const hot = t.bands.find((b) => b.temperature === "hot");
  check("only decided leads form the denominator", hot.decided === 3);
  check("open leads are counted separately", hot.open === 23);
  check("a busy week doesn't crater the rate", hot.conversionLabel === "3 of 3");
}

console.log("\nThin bands report a fraction, never a percentage or a blank\n");
{
  const t = buildTemperatureAnalysis([lead("hot", "converted", 70), lead("hot", "lost", 65)]);
  const hot = t.bands.find((b) => b.temperature === "hot");
  check("2 decided → no percentage", hot.conversionRate === null);
  check("but '1 of 2' is shown", hot.conversionLabel === "1 of 2");
  check("flagged thin", hot.thin === true);
  check("and no verdict is drawn from it", t.verdict === "not_enough_data");
}
check("no leads at all → not_enough_data", buildTemperatureAnalysis([]).verdict === "not_enough_data");
check("null input doesn't throw", buildTemperatureAnalysis(null).bands.length === 3);

console.log("\nWhich signals actually predict a win\n");
{
  const asap = [{ label: "Needs it ASAP", weight: 25 }];
  const photos = [{ label: "3 photos attached", weight: 10 }];
  const both = [...asap, ...photos];
  const leads = [
    // ASAP wins most of the time.
    ...Array(8).fill(0).map(() => lead("hot", "converted", 70, asap)),
    ...Array(2).fill(0).map(() => lead("hot", "lost", 70, asap)),
    // Photos are noise — half and half.
    ...Array(5).fill(0).map(() => lead("warm", "converted", 40, photos)),
    ...Array(5).fill(0).map(() => lead("warm", "lost", 40, photos)),
    ...Array(1).fill(0).map(() => lead("hot", "converted", 80, both)),
  ];
  const r = buildReasonAnalysis(leads);
  const find = (frag) => r.reasons.find((x) => x.label.includes(frag));
  check("ASAP shows a lift above 1", find("asap").lift > 1);
  check("photos sit near 1 — decoration, not signal", Math.abs(find("photo").lift - 1) < 0.35);
  check("the strongest signal sorts first", r.reasons[0].label.includes("asap"));
  check("the model's own weight is carried for comparison", find("asap").weight === 25);
  check("photo counts are folded into one signal", find("photo").total === 11);
}
check("no decided leads → no overall rate, not 0%", buildReasonAnalysis([]).overallRate === null);
check("a lead with no reasons doesn't throw",
  buildReasonAnalysis([lead("hot", "converted", 70, null)]).reasons.length === 0);

console.log("\nAre the thresholds in the right place\n");
{
  const leads = [
    ...Array(6).fill(0).map(() => lead("cold", "lost", 15)),
    ...Array(6).fill(0).map(() => lead("warm", "converted", 45)),
    ...Array(6).fill(0).map(() => lead("hot", "converted", 75)),
  ];
  const c = buildScoreCalibration(leads);
  check("bands are ordered low to high", c[0].floor < c[c.length - 1].floor);
  check("the 40–59 band converts", c.find((b) => b.floor === 40).conversionRate === 100);
  check("the 0–19 band does not", c.find((b) => b.floor === 0).conversionRate === 0);
  check("a jump below the hot cutoff is visible — the point of the chart",
    c.find((b) => b.floor === 40).conversionRate > c.find((b) => b.floor === 0).conversionRate);
}
check("no scored leads → empty, not a crash", buildScoreCalibration([]).length === 0);
// Number(null) is 0, not NaN — so a Number.isFinite guard alone files every
// UNSCORED lead in the 0-19 band, and the chart then claims low scores never
// convert about leads that were never scored. Fourth appearance of this trap
// in this codebase; it gets a test this time.
check("a null score is excluded, not filed as 0",
  buildScoreCalibration([lead("hot", "converted", null)]).length === 0);
check("an undefined score is excluded",
  buildScoreCalibration([lead("hot", "converted", undefined)]).length === 0);
check("an empty-string score is excluded",
  buildScoreCalibration([lead("hot", "converted", "")]).length === 0);
check("a real 0 IS kept — zero is a score, absence is not",
  buildScoreCalibration([lead("hot", "converted", 0)]).length === 1);
check("median ignores unscored leads rather than counting them as 0",
  buildTemperatureAnalysis([
    lead("hot", "converted", 80), lead("hot", "lost", 70), lead("hot", "lost", null),
  ]).bands.find((b) => b.temperature === "hot").medianScore === 75);

console.log(`\n${pass + failures.length} checks, ${failures.length} failure(s).\n`);
if (failures.length) process.exitCode = 1;
