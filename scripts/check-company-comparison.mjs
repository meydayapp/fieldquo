// scripts/check-company-comparison.mjs
//
//   npm run check:company-comparison
//
// One company against the cohort, executed.
//
// This output is meant to be READ DOWN A PHONE to a contractor. That raises
// the bar: a wrong number here is advice given to a real business. Every
// assertion below is a way it could produce a confident wrong comparison.
import {
  metricsForCompany,
  compareToCohort,
  talkingPoints,
  MIN_COHORT_COMPANIES,
} from "../lib/analytics/companyComparison.js";

let pass = 0;
const failures = [];
const check = (label, ok) => {
  if (ok) { pass += 1; console.log(`  ok   ${label}`); }
  else { failures.push(label); console.log(`  FAIL ${label}`); }
};

const quote = (status, total = 5000, extra = {}) => ({
  status, total, sentAt: status === "draft" ? null : "2026-08-01", ...extra,
});
const company = (wins, losses, total = 5000) => ({
  quotes: [
    ...Array(wins).fill(0).map(() => quote("accepted", total)),
    ...Array(losses).fill(0).map(() => quote("declined", total)),
  ],
  jobs: [], invoices: [],
});

console.log("\nA real comparison\n");
{
  const subject = metricsForCompany(company(3, 7));          // 30% win rate
  const others = [company(7, 3), company(6, 4), company(8, 2), company(7, 3), company(6, 4)]
    .map(metricsForCompany);                                  // median ~70%
  const c = compareToCohort(subject, others);
  const win = c.find((x) => x.key === "winRate");
  check("their win rate is computed", win.value === 30);
  check("the cohort median is computed", win.cohortMedian === 70);
  check("they are marked behind", win.position === "behind");
  check("the gap is signed and relative", win.deltaPct < 0);
  check("it is comparable", win.comparable === true);
  check("the cohort size is stated", win.cohortSize === 5);
}

console.log("\nThe three ways it must refuse to compare\n");
{
  // 1 — their sample is thin
  const subject = metricsForCompany(company(1, 1));
  const others = Array(6).fill(0).map(() => metricsForCompany(company(7, 3)));
  const win = compareToCohort(subject, others).find((x) => x.key === "winRate");
  check("2 quotes → not comparable", win.comparable === false);
  check("and it says WHY", win.reason === "their_sample_thin");
  check("but their own ratio is still shown", win.display === "1 of 2");
}
{
  // 2 — the cohort is thin
  const subject = metricsForCompany(company(3, 7));
  const others = Array(MIN_COHORT_COMPANIES - 1).fill(0).map(() => metricsForCompany(company(7, 3)));
  const win = compareToCohort(subject, others).find((x) => x.key === "winRate");
  check(`fewer than ${MIN_COHORT_COMPANIES} other companies → no comparison`, win.comparable === false);
  check("and it says which problem it is", win.reason === "cohort_thin");
  check("their own number survives — that part is real", win.value === 30);
}
{
  // 3 — the subject must not be inside its own benchmark. Callers pass only
  // OTHERS; this asserts the median is unaffected by the subject's value.
  const subject = metricsForCompany(company(0, 10));  // 0%
  const others = Array(5).fill(0).map(() => metricsForCompany(company(7, 3)));
  const win = compareToCohort(subject, others).find((x) => x.key === "winRate");
  check("a terrible subject does not drag its own benchmark down", win.cohortMedian === 70);
}
{
  // Companies with thin samples must not contribute to the median either.
  const subject = metricsForCompany(company(3, 7));
  const others = [
    ...Array(5).fill(0).map(() => metricsForCompany(company(7, 3))),
    metricsForCompany(company(1, 0)), // 100% off one quote
  ].map((m) => m);
  const win = compareToCohort(subject, others).find((x) => x.key === "winRate");
  check("a 100%-off-one-quote company is excluded from the median", win.cohortMedian === 70);
  check("and from the cohort size", win.cohortSize === 5);
}

console.log("\nDirection — a low number is not always bad\n");
{
  const fast = { medianComposeSeconds: { value: 45, sample: 10 } };
  const slow = Array(5).fill(0).map(() => ({ medianComposeSeconds: { value: 200, sample: 10 } }));
  const c = compareToCohort(fast, slow).find((x) => x.key === "medianComposeSeconds");
  check("building quotes FASTER than the median is 'ahead'", c.position === "ahead");
  check("the direction is declared", c.direction === "lower");
}
{
  const slow = { medianDecisionDays: { value: 14, sample: 10 } };
  const fast = Array(5).fill(0).map(() => ({ medianDecisionDays: { value: 3, sample: 10 } }));
  const c = compareToCohort(slow, fast).find((x) => x.key === "medianDecisionDays");
  check("clients taking LONGER to decide is 'behind'", c.position === "behind");
}

console.log("\nIn line means leave them alone\n");
{
  const subject = { winRate: { value: 72, sample: 20, won: 14 } };
  const others = Array(5).fill(0).map(() => ({ winRate: { value: 70, sample: 20, won: 14 } }));
  const c = compareToCohort(subject, others).find((x) => x.key === "winRate");
  check("within 15% of the median is 'in line'", c.position === "in_line");
}

console.log("\nHostile and empty input\n");
check("no subject at all doesn't throw", compareToCohort(null, []).length > 0);
check("no others doesn't throw", compareToCohort({}, null).every((c) => !c.comparable));
check("a metric with no data says so", compareToCohort({}, []).find((c) => c.key === "winRate").reason === "no_data");
check("division by a zero median is refused",
  compareToCohort(
    { winRate: { value: 30, sample: 10, won: 3 } },
    Array(5).fill(0).map(() => ({ winRate: { value: 0, sample: 10, won: 0 } })),
  ).find((c) => c.key === "winRate").comparable === false);
check("empty rows produce metrics, not a crash", metricsForCompany({}).winRate.sample === 0);

console.log("\nTalking points — what you actually say on the call\n");
{
  const subject = {
    winRate: { value: 30, sample: 20, won: 6 },
    medianComposeSeconds: { value: 40, sample: 20 },
  };
  const others = Array(5).fill(0).map(() => ({
    winRate: { value: 70, sample: 20, won: 14 },
    medianComposeSeconds: { value: 200, sample: 20 },
  }));
  const points = talkingPoints(compareToCohort(subject, others));
  check("both a strength and a weakness are surfaced", points.length === 2);
  check("the strength is marked good", points.some((p) => p.tone === "good"));
  check("the weakness is marked watch", points.some((p) => p.tone === "watch"));
  check("both numbers appear in the sentence", /30%/.test(points.find((p) => p.tone === "watch").text));
  check("it never invents a point from an incomparable metric",
    talkingPoints(compareToCohort({ winRate: { value: 30, sample: 2, won: 1 } }, [])).length === 0);
}

console.log(`\n${pass + failures.length} checks, ${failures.length} failure(s).\n`);
if (failures.length) process.exitCode = 1;
