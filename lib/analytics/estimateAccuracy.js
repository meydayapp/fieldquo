// lib/analytics/estimateAccuracy.js
//
// Where the estimate and the outcome diverge, across a range of finished jobs.
//
// ── The gap this fills ─────────────────────────────────────────────────────
//
// compareJobCost and actualJobCost already answer "did THIS job come in over?".
// They are only ever called per job — app/api/jobs/[id]/costing and the invoice
// lifecycle route — so a contractor can see that one kitchen ran long and can
// never see that every kitchen does. "You underestimate labour by 18% on
// repaints" is the sentence that changes how somebody prices; "this job was 18%
// over" is the sentence they shrug at.
//
// So this is the roll-up: the same comparison, over many jobs, split by
// DIRECTION and by DIMENSION, because labour and materials fail for different
// reasons. Labour runs over because the work took longer than the estimator
// thought. Materials run over because the price book is stale or somebody
// bought the expensive primer. A blended "your estimates are 12% out" hides
// both and tells you to fix nothing in particular.
//
// ── The rules inherited from lib/costing/actualJobCost.js ──────────────────
//
//   * Only APPROVED hours are cost. Pending hours are a claim, not a payroll
//     liability. Enforced by CALLING actualJobCost rather than re-deriving the
//     sum here — a second copy of that loop is the one that would rot.
//
//   * A worker with no rate contributes hours and no cost, and is COUNTED. A
//     roll-up makes this WORSE than a single job does: one unrated labourer on
//     six jobs drags a whole quarter's labour variance toward "under budget",
//     which reads as good news. So an unrated worker does two things here —
//     the job is dropped from the labour-COST comparison entirely (its actual
//     is knowably short by an unknown amount), and the worker is named in a
//     critical finding. It is NOT dropped from the labour-HOURS comparison:
//     an unknown rate does not make the hours unknown, and hours are the half
//     that actually measures estimating skill.
//
//   * Nothing is estimated, extrapolated or annualised. Every figure below is
//     an arithmetic function of rows that exist.
//
// ── The rules a roll-up needs and a single job never did ───────────────────
//
//   * A SMALL SAMPLE IS NOT A TREND. See MIN_SAMPLE. Below the floor this
//     reports its own thinness and hands back `null` where a percentage would
//     go — it does not print a number in smaller type.
//
//   * A JOB STILL RUNNING IS NOT EVIDENCE. Comparability is decided in two
//     places for two different reasons. The caller selects only jobs that are
//     `completed` with a `completedAt` inside the range, because an unfinished
//     job's costs are still arriving and every one of them would look under
//     budget. This file then decides, per DIMENSION, whether the two sides of
//     that particular comparison are both actually known.
//
//   * ONE CATASTROPHIC JOB MUST NOT BECOME THE HEADLINE. The headline is the
//     MEDIAN of the per-job percentages. See `summarise` for why, and for what
//     the mean and the aggregate are still good for.
//
//   * ABSENCE IS NOT ZERO. A completed job with no expense rows is not a job
//     that spent $0 on materials — it is a job nobody logged materials on, and
//     scoring it as a 100% saving would be the single most flattering lie this
//     file could tell. Those jobs are excluded and counted, and the count is
//     surfaced as a finding, because it is also the most likely thing wrong
//     with a real contractor's data.
//
// ── Why no AI writes the summary ──────────────────────────────────────────
//
// lib/ai/monthlyDigest.js is the precedent and it was deliberately not
// followed. The failure mode named for this feature is a model inventing a
// CAUSE — "kitchens run over because your crew is slower on tile" — and the
// findings here are one short step from causal language, on numbers a
// contractor will reprice against. The digest's own defence is that its flags
// are "computed in code, not by the model, so they're reliable"; here the
// flags ARE the deliverable, so there is nothing left for a model to add
// except risk and a quota check. Every sentence below is generated from the
// arithmetic that produced it and carries its own `values`, so a translator or
// a UI can re-template it without re-deriving anything.

import { actualJobCost } from "@/lib/costing/actualJobCost";

// Finite-safe, both directions — the same rule actualJobCost applies, restated
// rather than imported because that file does not export them and it is not
// this change's to edit.
//
// These are the LAST of three layers, and it is worth saying so because two of
// them are individually unreachable and a later reader will be tempted to
// delete one. A percentage is protected by (1) the eligibility check, which
// refuses a job whose estimate is not above zero, (2) the `estimated > 0`
// ternary where the division happens, and (3) the finite guards here. Removing
// any ONE of the three changes nothing observable — scripts/
// check-estimate-accuracy.mjs mutation-tested exactly that and reports it —
// and removing any TWO puts Infinity on a money screen, which is what its
// sub-cent and 1e308 fixtures demonstrate. Defence in depth on the one number
// this whole file exists to print.
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (v) => {
  const r = Math.round(num(v) * 100) / 100;
  return Number.isFinite(r) ? r : 0;
};
const round1 = (v) => {
  const r = Math.round(num(v) * 10) / 10;
  return Number.isFinite(r) ? r : 0;
};

/**
 * How many comparable jobs before a percentage is printed at all.
 *
 * Five, and the argument is a coin flip. The claim this report makes is
 * DIRECTIONAL — "you underestimate labour" — and if a contractor's estimating
 * carried no bias at all, each job would land over or under at random. The
 * chance that n jobs all land the same side is 2 × (1/2)^n: 25% at n=3, 12.5%
 * at n=4, 6.25% at n=5, 3.1% at n=6. Three jobs agreeing is a coincidence you
 * would see in one range out of four. Five is the first n where "they all ran
 * over" is rarer than one in ten, and it is also a number a one-van contractor
 * can actually reach in a quarter — a floor of twenty would be more defensible
 * statistically and would leave this screen permanently blank, which is a
 * different way of telling somebody nothing.
 *
 * Below the floor every percentage is null and `reportable` is false. The
 * COUNTS survive, because "3 of 3 ran over" is an observation about three jobs
 * and not a rate.
 */
export const MIN_SAMPLE = 5;

/**
 * The band around zero that counts as "you got it right".
 *
 * Nobody estimates a repaint to the dollar, and a report that flags a 2%
 * overrun as a problem trains its reader to ignore it. ±5% on the ESTIMATE.
 */
export const TOLERANCE_PCT = 5;

/**
 * How far the mean may sit from the median before the mean is called distorted.
 *
 * 25 percentage points. Not a statistical threshold — a readability one: past
 * that gap the two numbers tell visibly different stories and the reader has to
 * be told which job is doing it, or they will believe whichever is worse.
 */
export const MEAN_DISTORTION_PTS = 25;

/**
 * Why a job is not in a given comparison. A closed vocabulary, so the UI can
 * group them and a check can assert every exclusion has a stated reason.
 */
export const EXCLUSION_REASONS = {
  no_estimate: "The quote has no saved cost estimate",
  no_estimated_hours: "The estimate recorded no labour hours",
  no_estimated_labour_cost: "The estimate recorded no labour cost",
  no_estimated_materials: "The estimate recorded no materials",
  estimate_incomplete: "The estimate was costed with an unpriced crew",
  unpriced_materials: "The estimate had materials nobody had priced",
  no_hours_logged: "No approved hours were logged against the job",
  hours_awaiting_approval: "Timesheets on the job are still awaiting approval",
  unrated_worker: "Someone on the job has no hourly rate on file",
  no_expenses_recorded: "No expenses were recorded against the job",
};

const median = (values) => {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/** YYYY-MM-DD only. A Date here would make the range depend on a timezone. */
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

// ───────────────────────────────────────────────────────────────────────────
// The three comparisons
// ───────────────────────────────────────────────────────────────────────────
//
// Labour is TWO dimensions and that is the point of the split.
//
//   labourHours — did the work take as long as you said? This is estimating
//                 skill with the wage bill removed. An unrated worker cannot
//                 corrupt it, and neither can a raise.
//   labourCost  — what that time cost. Rate errors and hours errors both land
//                 here, which is why it is not the one to lead with when the
//                 question is "how should I price".
//   materials   — the estimate's bill of materials against what was actually
//                 spent on the job.
//
// `materials` is deliberately named for what it MEASURES rather than what it
// is called: the actual side is every expense tagged to the job, which on a
// real contractor's book includes subcontractors, dump runs and equipment
// hire. lib/accounting/statements.js labels the same sum "Materials,
// subcontractors and other job costs" for the same reason, and splitting it
// by Expense.category is not available — that column is free text.

const DIMENSIONS = [
  {
    key: "labourHours",
    unit: "hours",
    label: "Labour hours",
    estimated: (row) => num(row.estimate?.labourHours),
    actual: (row) => num(row.actual.labour.approvedHours),
    excludedBecause: (row) => {
      if (!row.estimate) return "no_estimate";
      if (num(row.estimate.labourHours) <= 0) return "no_estimated_hours";
      // Pending hours mean the actual is short by a known-unknown. Counting
      // them as cost is forbidden; counting the job without them would report
      // an overrun as an underrun, which is worse than reporting nothing.
      if (num(row.actual.labour.pendingHours) > 0) return "hours_awaiting_approval";
      if (num(row.actual.labour.approvedHours) <= 0) return "no_hours_logged";
      return null;
    },
  },
  {
    key: "labourCost",
    unit: "money",
    label: "Labour cost",
    estimated: (row) => num(row.estimate?.labourCost),
    actual: (row) => num(row.actual.labour.cost),
    excludedBecause: (row) => {
      if (!row.estimate) return "no_estimate";
      // The estimate itself was priced at no rate — quoteCosting sets this.
      if (row.estimate.costIncomplete) return "estimate_incomplete";
      if (num(row.estimate.labourCost) <= 0) return "no_estimated_labour_cost";
      if (num(row.actual.labour.pendingHours) > 0) return "hours_awaiting_approval";
      if (num(row.actual.labour.approvedHours) <= 0) return "no_hours_logged";
      // The whole reason unrated hours are surfaced rather than folded in as
      // zero. This job's labour cost is understated by (hours × a rate nobody
      // recorded), and averaging it into a quarter would drag the quarter.
      if (num(row.actual.labour.unratedHours) > 0) return "unrated_worker";
      return null;
    },
  },
  {
    key: "materials",
    unit: "money",
    label: "Materials and other job costs",
    estimated: (row) => num(row.estimate?.materialTotal),
    actual: (row) => num(row.actual.expenses.total),
    excludedBecause: (row) => {
      if (!row.estimate) return "no_estimate";
      if (num(row.estimate.materialTotal) <= 0) return "no_estimated_materials";
      // An estimate built over lines nobody had priced understates by an
      // unknown amount — QuoteCosting.unpricedMaterials exists to say so.
      if (num(row.estimate.unpricedMaterials) > 0) return "unpriced_materials";
      // Absence is not zero. Failure class 5, and the most flattering
      // arithmetic in the file if it were allowed through: no expense rows
      // would score as a 100% saving on every job.
      if (row.expenseCount <= 0) return "no_expenses_recorded";
      return null;
    },
  },
];

// ───────────────────────────────────────────────────────────────────────────
// Summarising one dimension
// ───────────────────────────────────────────────────────────────────────────

/**
 * Median leads. Mean and aggregate are reported beside it, and neither is the
 * headline.
 *
 * The median of the per-job percentages answers "what happens on a typical
 * job", which is the question somebody repricing has. It is also the only one
 * of the three that a single catastrophe cannot move far: a burst pipe that
 * turns a $400 job into a $9,000 one shifts the median by one position and can
 * move the mean by hundreds of points.
 *
 * The mean is kept because when it and the median agree, that agreement is
 * itself information — the bias is spread across the jobs rather than sitting
 * in one of them. When they disagree by more than MEAN_DISTORTION_PTS the job
 * responsible is named, rather than the mean being quietly dropped.
 *
 * The aggregate — total actual against total estimated — is the money answer
 * and is deliberately NOT the accuracy answer. It is weighted by job size, so
 * one large job dominates it. "Across these jobs you spent $12,400 more on
 * labour than you estimated" is true and useful and says nothing about how to
 * price the next small one.
 */
function summarise(entries, { minSample }) {
  const sample = entries.length;
  const direction = { over: 0, under: 0, onTarget: 0 };
  for (const e of entries) {
    if (e.pct > TOLERANCE_PCT) direction.over += 1;
    else if (e.pct < -TOLERANCE_PCT) direction.under += 1;
    else direction.onTarget += 1;
  }

  if (sample === 0) {
    return {
      sample: 0,
      minSample,
      reportable: false,
      medianPct: null,
      meanPct: null,
      aggregate: null,
      direction,
      tone: null,
      worst: null,
      meanDistortedBy: null,
    };
  }

  const pcts = entries.map((e) => e.pct);
  const medianPct = round1(median(pcts));
  const meanPct = round1(pcts.reduce((s, p) => s + p, 0) / sample);

  const estimatedTotal = round2(entries.reduce((s, e) => s + e.estimated, 0));
  const actualTotal = round2(entries.reduce((s, e) => s + e.actual, 0));
  const aggregateVariance = round2(actualTotal - estimatedTotal);
  // Guarded even though eligibility already requires a positive estimate on
  // every entry: a sum of positives is positive, and a report that relies on
  // that invariant holding forever is one refactor from Infinity on screen.
  const aggregatePct =
    estimatedTotal > 0 ? round1((aggregateVariance / estimatedTotal) * 100) : null;

  const worst = entries.reduce(
    (w, e) => (w === null || Math.abs(e.pct) > Math.abs(w.pct) ? e : w),
    null,
  );

  const reportable = sample >= minSample;
  const distorted = Math.abs(meanPct - medianPct) > MEAN_DISTORTION_PTS;

  return {
    sample,
    minSample,
    reportable,
    // Null, not a number in smaller type. Below the floor there is no rate to
    // report and the caller is told to say so.
    medianPct: reportable ? medianPct : null,
    meanPct: reportable ? meanPct : null,
    aggregate: reportable
      ? {
          estimated: estimatedTotal,
          actual: actualTotal,
          variance: aggregateVariance,
          variancePct: aggregatePct,
        }
      : null,
    // Counts are observations about individual jobs, not a rate, so they
    // survive a thin sample. "2 of 2 ran over" claims nothing about the third.
    direction,
    tone: reportable
      ? medianPct > TOLERANCE_PCT
        ? "over"
        : medianPct < -TOLERANCE_PCT
          ? "under"
          : "on_target"
      : null,
    // One job, named. A fact about that job at any sample size.
    worst: { jobId: worst.jobId, title: worst.title, pct: worst.pct },
    meanDistortedBy:
      reportable && distorted
        ? { jobId: worst.jobId, title: worst.title, pct: worst.pct, meanPct, medianPct }
        : null,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Segments
// ───────────────────────────────────────────────────────────────────────────
//
// "You underestimate labour on kitchens but not on exteriors" is actionable.
// "Your estimates are 12% out" is not. But a segment is a smaller sample by
// construction, so every one of them faces the same floor as the headline, and
// the ones that do not clear it are listed by NAME AND COUNT with no figures —
// so the reader can see the category exists and is thin, rather than wondering
// why their biggest trade is missing.

/**
 * @param entries  the comparable entries for one dimension
 * @param keyOf    entry → segment key, or null to leave the entry unattributed
 * @param labelOf  key → human label
 */
function segmentBy(entries, keyOf, labelOf, { minSample }) {
  const buckets = new Map();
  let unattributed = 0;
  for (const e of entries) {
    const key = keyOf(e);
    if (key == null) {
      unattributed += 1;
      continue;
    }
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(e);
  }

  const reported = [];
  const suppressed = [];
  for (const [key, rows] of buckets) {
    const label = labelOf(key, rows);
    if (rows.length < minSample) {
      suppressed.push({ key, label, sample: rows.length });
      continue;
    }
    reported.push({ key, label, ...summarise(rows, { minSample }) });
  }

  // Worst first — the reader is looking for where they are losing money.
  reported.sort((a, b) => (b.medianPct ?? 0) - (a.medianPct ?? 0));
  suppressed.sort((a, b) => b.sample - a.sample);
  return { reported, suppressed, unattributed };
}

/**
 * Job size, as terciles of THIS range's own estimated cost.
 *
 * Fixed dollar bands were the obvious alternative and were rejected twice
 * over: they assume a currency (a €900 job and a $900 job are not the same
 * job), and they assume a trade (a $5,000 job is enormous for a handyman and
 * routine for a roofer). Terciles of the range's own jobs are self-calibrating
 * and always balanced, so each band clears the floor whenever the whole does.
 *
 * Needs 3 × minSample entries before it is drawn at all, and each band carries
 * the real cost range inside it so "small" is a stated interval rather than an
 * adjective.
 */
function sizeBands(entries, { minSample }) {
  const sized = entries.filter((e) => e.sizeBasis > 0);
  if (sized.length < minSample * 3) {
    return {
      available: false,
      reason: "too_few_jobs",
      sample: sized.length,
      needed: minSample * 3,
      bands: [],
    };
  }
  const sorted = [...sized].sort((a, b) => a.sizeBasis - b.sizeBasis);
  const cut = Math.floor(sorted.length / 3);
  const slices = [
    { key: "small", label: "Smallest third", rows: sorted.slice(0, cut) },
    { key: "medium", label: "Middle third", rows: sorted.slice(cut, cut * 2) },
    { key: "large", label: "Largest third", rows: sorted.slice(cut * 2) },
  ];
  return {
    available: true,
    reason: null,
    sample: sized.length,
    needed: minSample * 3,
    bands: slices.map((s) => ({
      key: s.key,
      label: s.label,
      // The interval, so the band is a fact and not an adjective.
      from: round2(s.rows[0].sizeBasis),
      to: round2(s.rows[s.rows.length - 1].sizeBasis),
      ...summarise(s.rows, { minSample }),
    })),
  };
}

// ───────────────────────────────────────────────────────────────────────────
// The entry point
// ───────────────────────────────────────────────────────────────────────────

/**
 * @param {object}   p
 * @param {string}   p.from      YYYY-MM-DD, inclusive
 * @param {string}   p.to        YYYY-MM-DD, inclusive
 * @param {string}   p.currency  the COMPANY's billing currency; never defaulted
 * @param {object[]} p.jobs      completed jobs in the range. Each:
 *   {
 *     id, title, completedAt,
 *     clientId, clientName,
 *     tradeKeys: [{ key, label }],   every distinct trade on the quote
 *     estimate: { labourHours, labourCost, materialTotal, unpricedMaterials,
 *                 costIncomplete, totalCost, at } | null,
 *     expenses:    [{ category, amount }],
 *     timeEntries: [{ hours, status, workerId, worker: { name, hourlyRate } }],
 *   }
 * @param {number}   [p.minSample]
 * @param {object}   [p.segments]  which segmentations the CALLER may show —
 *                                 client and crew are behind permission dials
 */
export function buildEstimateAccuracy({
  from,
  to,
  currency,
  jobs = [],
  minSample = MIN_SAMPLE,
  segments = {},
} = {}) {
  if (!DAY_RE.test(from || "") || !DAY_RE.test(to || "")) {
    const err = new Error("A start and end date are required, as YYYY-MM-DD.");
    err.status = 400;
    err.code = "bad_range";
    throw err;
  }
  // Thrown rather than returned empty, for the reason the statements builder
  // gives about the same case: an inverted range would produce an empty report
  // that looks exactly like a quiet quarter, and somebody would act on it.
  if (from > to) {
    const err = new Error(`The period runs backwards (${from} to ${to}).`);
    err.status = 400;
    err.code = "backwards_range";
    throw err;
  }
  if (!currency) {
    const err = new Error(
      "Your company has no billing currency set, and this report will not assume one.",
    );
    err.status = 409;
    err.code = "no_currency";
    throw err;
  }

  const floor = Number.isFinite(Number(minSample)) && Number(minSample) >= 1
    ? Math.trunc(Number(minSample))
    : MIN_SAMPLE;

  const list = Array.isArray(jobs) ? jobs.filter(Boolean) : [];

  // ── Per-job actuals, through the shared costing function ─────────────────
  //
  // actualJobCost is called rather than reimplemented, so "approved only" and
  // "an unrated worker costs nothing and is counted" are inherited facts here
  // instead of a second implementation that agrees with it today.
  const rows = list.map((job) => {
    const expenses = Array.isArray(job.expenses) ? job.expenses : [];
    const timeEntries = Array.isArray(job.timeEntries) ? job.timeEntries : [];
    const actual = actualJobCost(expenses, timeEntries);

    // Identity, not arithmetic. actualJobCost counts unrated HOURS; it has no
    // reason to know whose they are, and a roll-up does — "someone" is not
    // something a contractor can act on, and one name usually explains the
    // whole quarter.
    const unratedWorkers = new Map();
    const approvedWorkers = new Set();
    for (const t of timeEntries) {
      if (t?.status !== "approved") continue;
      const hours = num(t?.hours);
      if (!hours) continue;
      const id = t?.workerId || t?.worker?.id || null;
      if (id) approvedWorkers.add(id);
      const rate = t?.worker?.hourlyRate;
      if (rate === null || rate === undefined || rate === "") {
        const key = id || "unknown";
        const prev = unratedWorkers.get(key) || {
          workerId: id,
          name: t?.worker?.name || "Unnamed worker",
          hours: 0,
        };
        prev.hours = round2(prev.hours + hours);
        unratedWorkers.set(key, prev);
      }
    }

    // ── Trade: one, or none ────────────────────────────────────────────────
    //
    // A job whose quote covers two trades is NOT counted under both. Putting
    // the same overrun in the painting bucket and the flooring bucket would
    // let a contractor "fix" whichever one they looked at first, on evidence
    // that never distinguished them. Mixed jobs are counted and named as
    // unattributed rather than dropped silently.
    const trades = Array.isArray(job.tradeKeys) ? job.tradeKeys.filter(Boolean) : [];
    const distinctTrades = [...new Map(trades.map((tr) => [tr.key, tr])).values()];
    const trade = distinctTrades.length === 1 ? distinctTrades[0] : null;

    // ── Crew: the sole worker, or nobody ───────────────────────────────────
    //
    // Same argument. "Dani's jobs run 22% over" is only a statement about Dani
    // when Dani did the job. Two people on a job means the overrun belongs to
    // the pair, and splitting it between them invents an attribution.
    const soleWorkerId = approvedWorkers.size === 1 ? [...approvedWorkers][0] : null;
    const soleWorkerName = soleWorkerId
      ? timeEntries.find((t) => (t?.workerId || t?.worker?.id) === soleWorkerId)?.worker
          ?.name || "Unnamed worker"
      : null;

    return {
      jobId: job.id,
      title: job.title || "Untitled job",
      completedAt: job.completedAt || null,
      clientId: job.clientId || null,
      clientName: job.clientName || null,
      trade,
      mixedTrade: distinctTrades.length > 1,
      soleWorkerId,
      soleWorkerName,
      estimate: job.estimate || null,
      estimatedAt: job.estimate?.at || null,
      expenseCount: expenses.length,
      actual,
      unratedWorkers: [...unratedWorkers.values()],
    };
  });

  const range = { from, to };

  // ── Nothing finished in this range ───────────────────────────────────────
  //
  // Said out loud, and never as 0% variance. A range with no completed jobs is
  // a range with no evidence; reporting it as accurate is the exact inversion
  // of what happened.
  if (rows.length === 0) {
    return {
      range,
      currency,
      minSample: floor,
      empty: true,
      emptyStatement:
        "No jobs were completed between these dates, so there is nothing to compare an estimate against. This is not a report of accurate estimating — it is a report of no finished work in the period.",
      jobsInRange: 0,
      comparableJobs: 0,
      dimensions: {},
      exclusions: [],
      findings: [],
      dataQuality: null,
      anyReportable: false,
    };
  }

  // ── One pass per dimension ───────────────────────────────────────────────
  const dimensions = {};
  const comparableJobIds = new Set();
  for (const dim of DIMENSIONS) {
    const entries = [];
    const excluded = new Map();
    for (const row of rows) {
      const reason = dim.excludedBecause(row);
      if (reason) {
        if (!excluded.has(reason)) excluded.set(reason, []);
        excluded.get(reason).push({ jobId: row.jobId, title: row.title });
        continue;
      }
      const estimated = round2(dim.estimated(row));
      const actual = round2(dim.actual(row));
      // estimated > 0 is guaranteed by excludedBecause; the guard stays because
      // a division that only works because of an invariant elsewhere is the
      // kind that produces Infinity after a refactor nobody connected to it.
      const pct = estimated > 0 ? round1(((actual - estimated) / estimated) * 100) : 0;
      entries.push({
        jobId: row.jobId,
        title: row.title,
        estimated,
        actual,
        pct,
        trade: row.trade,
        clientId: row.clientId,
        clientName: row.clientName,
        soleWorkerId: row.soleWorkerId,
        soleWorkerName: row.soleWorkerName,
        sizeBasis: num(row.estimate?.totalCost),
      });
      comparableJobIds.add(row.jobId);
    }

    const summary = summarise(entries, { minSample: floor });

    const bySegment = {
      trade: segmentBy(
        entries,
        (e) => e.trade?.key ?? null,
        (key, group) => group[0].trade?.label || key,
        { minSample: floor },
      ),
      size: sizeBands(entries, { minSample: floor }),
    };
    // Client and crew are behind their own dials — see the route. Absent
    // rather than empty, so the UI can say "your access does not include this"
    // instead of rendering a section that looks like there were no clients.
    if (segments.client) {
      bySegment.client = segmentBy(
        entries,
        (e) => e.clientId ?? null,
        (key, group) => group[0].clientName || key,
        { minSample: floor },
      );
    }
    if (segments.crew) {
      bySegment.crew = segmentBy(
        entries,
        (e) => e.soleWorkerId ?? null,
        (key, group) => group[0].soleWorkerName || key,
        { minSample: floor },
      );
    }

    dimensions[dim.key] = {
      key: dim.key,
      label: dim.label,
      unit: dim.unit,
      ...summary,
      excluded: [...excluded.entries()]
        .map(([reason, jobsOut]) => ({
          reason,
          statement: EXCLUSION_REASONS[reason] || reason,
          count: jobsOut.length,
          jobs: jobsOut.slice(0, 20),
        }))
        .sort((a, b) => b.count - a.count),
      segments: bySegment,
    };
  }

  // ── Data quality, gathered once ──────────────────────────────────────────
  const unratedByWorker = new Map();
  let pendingHours = 0;
  let jobsWithPending = 0;
  let jobsWithoutEstimate = 0;
  let jobsWithoutExpenses = 0;
  let mixedTradeJobs = 0;
  for (const row of rows) {
    for (const w of row.unratedWorkers) {
      const key = w.workerId || w.name;
      const prev = unratedByWorker.get(key) || { ...w, hours: 0, jobs: 0 };
      prev.hours = round2(prev.hours + w.hours);
      prev.jobs += 1;
      unratedByWorker.set(key, prev);
    }
    const pend = num(row.actual.labour.pendingHours);
    if (pend > 0) {
      pendingHours = round2(pendingHours + pend);
      jobsWithPending += 1;
    }
    if (!row.estimate) jobsWithoutEstimate += 1;
    if (row.expenseCount === 0) jobsWithoutExpenses += 1;
    if (row.mixedTrade) mixedTradeJobs += 1;
  }
  const unratedWorkers = [...unratedByWorker.values()].sort((a, b) => b.hours - a.hours);
  const unratedHoursTotal = round2(unratedWorkers.reduce((s, w) => s + w.hours, 0));

  const dataQuality = {
    jobsInRange: rows.length,
    jobsWithoutEstimate,
    jobsWithoutExpenses,
    jobsWithPendingHours: jobsWithPending,
    pendingHours,
    unratedWorkers,
    unratedHours: unratedHoursTotal,
    mixedTradeJobs,
  };

  const findings = buildFindings({ dimensions, dataQuality, floor });

  return {
    range,
    currency,
    minSample: floor,
    empty: false,
    emptyStatement: null,
    jobsInRange: rows.length,
    comparableJobs: comparableJobIds.size,
    dimensions,
    dataQuality,
    findings,
    anyReportable: Object.values(dimensions).some((d) => d.reportable),
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Findings
// ───────────────────────────────────────────────────────────────────────────
//
// Sentences derived from the arithmetic that produced them, in the order a
// reader needs them: what is WRONG WITH THE DATA first, because a bias claim
// read on top of six unrated hours is worse than no claim, then the biases.
//
// Every finding carries `values`, so the sentence can be re-templated without
// the numbers being re-derived from a formatted string.

const pctText = (p) => `${p > 0 ? "+" : ""}${p}%`;

function buildFindings({ dimensions, dataQuality, floor }) {
  const out = [];
  const push = (code, severity, text, values = {}) =>
    out.push({ code, severity, text, values });

  // ── Data quality, loudest first ────────────────────────────────────────
  if (dataQuality.unratedWorkers.length > 0) {
    const names = dataQuality.unratedWorkers.map((w) => w.name).join(", ");
    push(
      "unrated_workers",
      "critical",
      `${dataQuality.unratedHours} approved hours in this period were worked by someone with no hourly rate on file (${names}). Those hours cost nothing in FieldQuo, so every job they touched is excluded from the labour cost comparison — and would have dragged this whole period toward "under budget" if they weren't. Set their rate in Team, and this report gets a lot more useful.`,
      {
        hours: dataQuality.unratedHours,
        workers: dataQuality.unratedWorkers,
      },
    );
  }
  if (dataQuality.pendingHours > 0) {
    push(
      "hours_awaiting_approval",
      "warning",
      `${dataQuality.pendingHours} hours across ${dataQuality.jobsWithPendingHours} finished job${dataQuality.jobsWithPendingHours === 1 ? "" : "s"} are still awaiting approval. Unapproved hours are a claim rather than a payroll liability, so they are not costed anywhere in FieldQuo — and a finished job whose timesheets are still open cannot be compared, because its labour is short by an amount nobody has agreed yet.`,
      { hours: dataQuality.pendingHours, jobs: dataQuality.jobsWithPendingHours },
    );
  }
  if (dataQuality.jobsWithoutEstimate > 0) {
    push(
      "jobs_without_estimate",
      "warning",
      `${dataQuality.jobsWithoutEstimate} of the ${dataQuality.jobsInRange} jobs finished in this period have no saved cost estimate on their quote, so there is nothing to measure the outcome against. Fill in Cost & margin on a quote before you send it and the job it becomes joins this report.`,
      { jobs: dataQuality.jobsWithoutEstimate, total: dataQuality.jobsInRange },
    );
  }
  if (dataQuality.jobsWithoutExpenses > 0) {
    push(
      "jobs_without_expenses",
      "warning",
      `${dataQuality.jobsWithoutExpenses} finished job${dataQuality.jobsWithoutExpenses === 1 ? " has" : "s have"} no expenses recorded at all. That is not the same as spending nothing, so ${dataQuality.jobsWithoutExpenses === 1 ? "it is" : "they are"} left out of the materials comparison rather than counted as coming in free.`,
      { jobs: dataQuality.jobsWithoutExpenses },
    );
  }
  if (dataQuality.mixedTradeJobs > 0) {
    push(
      "mixed_trade_jobs",
      "info",
      `${dataQuality.mixedTradeJobs} job${dataQuality.mixedTradeJobs === 1 ? "" : "s"} covered more than one trade, so ${dataQuality.mixedTradeJobs === 1 ? "it is" : "they are"} counted in the totals but not under any single trade — an overrun on a job that was half tiling and half painting does not tell you which half.`,
      { jobs: dataQuality.mixedTradeJobs },
    );
  }

  // ── The biases ────────────────────────────────────────────────────────────
  for (const dim of Object.values(dimensions)) {
    if (!dim.reportable) {
      if (dim.sample > 0) {
        push(
          "thin_sample",
          "info",
          `${dim.label}: ${dim.sample} comparable job${dim.sample === 1 ? "" : "s"} in this period, and ${floor} is the fewest this report will draw a percentage from. ${floor - dim.sample} more and it will. Until then, ${dim.sample === 1 ? "one job is one job" : "this is an anecdote, not a pattern"}.`,
          { dimension: dim.key, sample: dim.sample, needed: floor },
        );
      } else {
        push(
          "no_comparable_jobs",
          "info",
          `${dim.label}: no job in this period had both sides of the comparison recorded, so nothing is reported. The exclusions below say exactly which jobs and why.`,
          { dimension: dim.key },
        );
      }
      continue;
    }

    const consistent = Math.max(dim.direction.over, dim.direction.under);
    const consistency = consistent / dim.sample;
    if (dim.tone === "over" || dim.tone === "under") {
      const word = dim.tone === "over" ? "over" : "under";
      push(
        `${dim.key}_bias`,
        consistency >= 0.7 ? "insight" : "info",
        `${dim.label}: on the typical job, the outcome came in ${pctText(dim.medianPct)} against the estimate — ${word} budget. ${dim.direction.over} of ${dim.sample} ran over, ${dim.direction.under} under, ${dim.direction.onTarget} within ${TOLERANCE_PCT}%.${
          consistency >= 0.7
            ? " That is consistent enough to be a pricing habit rather than luck."
            : " The jobs disagree with each other, so treat the middle figure as a rough centre rather than a rule."
        }`,
        {
          dimension: dim.key,
          medianPct: dim.medianPct,
          meanPct: dim.meanPct,
          direction: dim.direction,
          consistency: round2(consistency),
        },
      );
    } else {
      push(
        `${dim.key}_on_target`,
        "info",
        `${dim.label}: the typical job landed within ${TOLERANCE_PCT}% of the estimate (${pctText(dim.medianPct)}). Nothing to fix here.`,
        { dimension: dim.key, medianPct: dim.medianPct },
      );
    }

    if (dim.meanDistortedBy) {
      push(
        `${dim.key}_mean_distorted`,
        "info",
        `${dim.label}: the average across these jobs is ${pctText(dim.meanPct)}, well away from the typical ${pctText(dim.medianPct)}. "${dim.meanDistortedBy.title}" came in at ${pctText(dim.meanDistortedBy.pct)} and is doing most of that on its own. The typical figure is the one to price against; the average is the one to explain.`,
        {
          dimension: dim.key,
          meanPct: dim.meanPct,
          medianPct: dim.medianPct,
          job: dim.meanDistortedBy,
        },
      );
    }

    // The segment sentence — only when the segment and the whole are BOTH
    // reportable, so "kitchens are worse than average" is never a comparison
    // against a number this file refused to print.
    const trades = dim.segments?.trade?.reported || [];
    if (trades.length >= 2) {
      const worstTrade = trades[0];
      const bestTrade = trades[trades.length - 1];
      if (
        worstTrade.medianPct != null &&
        bestTrade.medianPct != null &&
        worstTrade.medianPct - bestTrade.medianPct > TOLERANCE_PCT * 2
      ) {
        push(
          `${dim.key}_trade_spread`,
          "insight",
          `${dim.label}: ${worstTrade.label} runs at ${pctText(worstTrade.medianPct)} on the typical job while ${bestTrade.label} runs at ${pctText(bestTrade.medianPct)}. The gap is where the money is — a single company-wide correction would overprice one and leave the other short.`,
          {
            dimension: dim.key,
            worst: { key: worstTrade.key, label: worstTrade.label, medianPct: worstTrade.medianPct, sample: worstTrade.sample },
            best: { key: bestTrade.key, label: bestTrade.label, medianPct: bestTrade.medianPct, sample: bestTrade.sample },
          },
        );
      }
    }
  }

  return out;
}
